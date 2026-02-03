import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

from ai.main import app, get_db
from ai.db.models import Base, Sensor, Reading, Alert, Anomaly
from ai.schemas.sensor import SensorDataIngest
from ai.realtime.websocket import manager as ws_manager

# Use SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    # SQLite compatibility: Modify Reading model to use single PK (id) instead of composite PK
    # This enables AUTOINCREMENT on 'id' which is not supported on composite PKs in SQLite.
    from sqlalchemy import PrimaryKeyConstraint

    reading_pk = Reading.__table__.primary_key
    if len(reading_pk.columns) > 1:
        Reading.__table__.constraints.remove(reading_pk)
        new_pk = PrimaryKeyConstraint(Reading.__table__.c.id)
        Reading.__table__.append_constraint(new_pk)
        Reading.__table__.primary_key = new_pk

    # Create async engine with StaticPool for in-memory SQLite
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_db_session(test_engine):
    # Create session factory
    async_session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    async with async_session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture(scope="function")
async def client(test_db_session):
    # Override dependency
    async def override_get_db():
        yield test_db_session

    app.dependency_overrides[get_db] = override_get_db

    # Disable Rate Limiter for tests
    # Check if limiter exists in app.state (it should if initialized)
    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = False

    # Mock Redis listener to prevent connection attempts
    with patch.object(ws_manager, "start_redis_listener", new_callable=AsyncMock) as mock_redis:
        # Mock Ingest Key
        with patch("os.getenv", return_value="test_ingest_key"):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                yield ac

    app.dependency_overrides.clear()
    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = True


@pytest.mark.asyncio
async def test_golden_flow(client, test_db_session):
    """
    Golden E2E Test:
    1. POST to /api/v1/sensors/ingest with critical pH reading
    2. Verify reading stored in DB
    3. Verify alert created
    4. Verify WebSocket message published
    """

    # 0. Setup: Create a sensor in DB first (so foreign keys work)
    sensor_id = "GOLDEN_SENSOR_001"
    new_sensor = Sensor(
        sensor_id=sensor_id, name="Golden Test Sensor", latitude=0.0, longitude=0.0, is_active=True
    )
    test_db_session.add(new_sensor)
    await test_db_session.commit()
    await test_db_session.refresh(new_sensor)

    # Mock WebSocket manager to verify broadcast
    with patch.object(ws_manager, "publish_update", new_callable=AsyncMock) as mock_ws_publish:
        # Mock NotificationService to avoid real sends
        with patch("ai.main.notifier.send_notifications", new_callable=AsyncMock) as mock_notify:
            # 1. POST to /api/v1/sensors/ingest with critical pH reading
            # pH 3.0 is critical (< 4.0 typically, or based on thresholds)
            payload = {
                "sensor_id": sensor_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "readings": {"ph": 3.0, "turbidity": 10.0, "temperature": 25.0},
                "metadata": {},
            }

            headers = {"X-Ingest-Key": "test_ingest_key"}
            # We mocked os.getenv("INGEST_API_KEY") in the client fixture,
            # but verify_ingest_token reads existing os.environ or os.getenv?
            # The code uses os.getenv("INGEST_API_KEY") at module level in main.py?
            # actually INGEST_API_KEY is loaded at module level in main.py:
            # INGEST_API_KEY = os.getenv("INGEST_API_KEY")
            # So patching os.getenv inside the test might be too late if main.py is already imported.
            # However, we can patch ai.main.INGEST_API_KEY directly.

            with patch("ai.main.INGEST_API_KEY", "test_ingest_key"):
                response = await client.post(
                    "/api/v1/sensors/ingest", json=payload, headers=headers
                )

            assert response.status_code == 200, f"Ingest failed: {response.text}"
            data = response.json()
            assert data["status"] == "ingested"
            assert data["anomalies_detected"] > 0

            # 2. Verify reading stored in DB
            # Need to query DB
            from sqlalchemy import select

            stmt = (
                select(Reading)
                .where(Reading.sensor_id == new_sensor.id)
                .order_by(Reading.timestamp.desc())
            )
            result = await test_db_session.execute(stmt)
            reading = result.scalars().first()

            assert reading is not None
            assert reading.ph == 3.0

            # 3. Verify alert created
            stmt = (
                select(Alert)
                .where(Alert.sensor_id == new_sensor.id)
                .order_by(Alert.created_at.desc())
            )
            result = await test_db_session.execute(stmt)
            alert = result.scalars().first()

            assert alert is not None
            assert alert.severity == "critical"
            assert "pH" in alert.message or "PH" in alert.message

            # 4. Verify WebSocket message published
            # process_mqtt_message -> ws_manager.publish_update("sensor_reading", ...)
            # ingest_sensor_data -> ws_manager.publish_update("alert", ...)

            assert mock_ws_publish.called

            # Check for alert broadcast
            alert_calls = [
                args for args, kwargs in mock_ws_publish.call_args_list if args[0] == "alert"
            ]
            assert len(alert_calls) > 0, "WebSocket 'alert' message not published"
            assert alert_calls[0][1]["severity"] == "critical"

            # Check for reading broadcast
            reading_calls = [
                args
                for args, kwargs in mock_ws_publish.call_args_list
                if args[0] == "sensor_reading"
            ]
            assert len(reading_calls) > 0, "WebSocket 'sensor_reading' message not published"
