from datetime import timezone
from typing import Any, cast
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql.schema import Table

from ai.db.models import Alert, Base, Sensor
from ai.main import app, get_current_user, get_db
from ai.realtime.websocket import manager as ws_manager


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    sensor_table: Table = cast(Table, Sensor.__table__)
    alert_table: Table = cast(Table, Alert.__table__)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=cast(Any, [sensor_table, alert_table]),
            )
        )

    try:
        yield engine
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: Base.metadata.drop_all(
                    sync_conn,
                    tables=cast(Any, [alert_table, sensor_table]),
                )
            )
        await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_db_session(test_engine):
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
async def client(test_db_session: AsyncSession):
    async def override_get_db():
        yield test_db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: "user_123"

    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = False

    with patch.object(ws_manager, "start_redis_listener", new_callable=AsyncMock):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()
    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = True


@pytest.mark.asyncio
async def test_resolve_and_reopen_alert(client: AsyncClient, test_db_session: AsyncSession):
    sensor = Sensor(sensor_id="TEST_SENSOR_001", name="Test Sensor")
    test_db_session.add(sensor)
    await test_db_session.commit()
    await test_db_session.refresh(sensor)

    alert = Alert(
        sensor_id=sensor.id,
        severity="warning",
        previous_state="normal",
        message="Test alert",
    )
    test_db_session.add(alert)
    await test_db_session.commit()
    await test_db_session.refresh(alert)

    resolve_resp = await client.post(
        f"/api/v1/alerts/{alert.id}/resolve",
        json={"resolution_note": "Fixed in the field"},
        headers={"Authorization": "Bearer valid_token"},
    )
    assert resolve_resp.status_code == 200
    assert resolve_resp.json() == {"status": "resolved"}

    result = await test_db_session.execute(select(Alert).where(Alert.id == alert.id))
    resolved = result.scalar_one()
    assert resolved.resolved_at is not None
    assert resolved.resolved_at.tzinfo in (timezone.utc, None)
    assert resolved.resolved_by == "user_123"
    assert resolved.resolution_note == "Fixed in the field"
    assert resolved.reopened_at is None
    assert resolved.reopened_by is None

    reopen_resp = await client.post(
        f"/api/v1/alerts/{alert.id}/reopen",
        headers={"Authorization": "Bearer valid_token"},
    )
    assert reopen_resp.status_code == 200
    assert reopen_resp.json() == {"status": "reopened"}

    result = await test_db_session.execute(select(Alert).where(Alert.id == alert.id))
    reopened = result.scalar_one()
    assert reopened.resolved_at is None
    assert reopened.resolved_by is None
    assert reopened.resolution_note is None
    assert reopened.reopened_at is not None
    assert reopened.reopened_at.tzinfo in (timezone.utc, None)
    assert reopened.reopened_by == "user_123"


@pytest.mark.asyncio
async def test_resolve_404(client: AsyncClient):
    response = await client.post(
        "/api/v1/alerts/999/resolve",
        json={"resolution_note": "does not matter"},
        headers={"Authorization": "Bearer valid_token"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_reopen_404(client: AsyncClient):
    response = await client.post(
        "/api/v1/alerts/999/reopen",
        headers={"Authorization": "Bearer valid_token"},
    )
    assert response.status_code == 404
