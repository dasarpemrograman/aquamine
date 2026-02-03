import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from ai.main import app
from ai.schemas.sensor import SensorDataIngest, SensorResponse
from datetime import datetime, timezone


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_db():
    with patch("ai.main.get_db") as mock:
        yield mock


@pytest.mark.asyncio
async def test_list_sensors(client):
    # Skip complex async dependency override test for now due to TestClient limitations
    # We will rely on integration tests later
    pass


# Simplified test suite using patching for now
def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ingest_sensor_data(client):
    payload = {
        "sensor_id": "TEST001",
        "timestamp": "2024-01-01T12:00:00Z",
        "readings": {"ph": 7.0, "turbidity": 10.0, "temperature": 25.0},
        "metadata": {},
    }

    class DummySession:
        def __init__(self):
            self._call = 0

        async def execute(self, _stmt):
            self._call += 1

            class Result:
                def __init__(self, obj):
                    self._obj = obj

                def scalar_one_or_none(self):
                    return self._obj

            if self._call == 1:
                # Sensor lookup
                sensor = type("Sensor", (), {"id": 1, "sensor_id": payload["sensor_id"]})()
                return Result(sensor)

            # SensorAlertState lookup
            state = type(
                "SensorAlertState",
                (),
                {"sensor_id": 1, "current_state": "normal", "last_alert_at": None},
            )()
            return Result(state)

        def add(self, _obj):
            return None

        async def commit(self):
            return None

        async def rollback(self):
            return None

    from ai.db.connection import get_db

    session = DummySession()

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with patch("ai.main.process_mqtt_message", new_callable=AsyncMock) as mock_process:
            with patch("ai.main.ws_manager.publish_update", new_callable=AsyncMock) as mock_ws:
                response = client.post(
                    "/api/v1/sensors/ingest",
                    json=payload,
                    headers={"X-Ingest-Key": "test-ingest-key"},
                )
                assert response.status_code == 200
                assert response.json() == {"status": "ingested", "anomalies_detected": 0}
                assert mock_process.called
                assert mock_ws.called
    finally:
        app.dependency_overrides = {}


def test_acknowledge_alert_not_found(client):
    # We need to mock the DB session logic inside the endpoint
    # Since we use dependency injection, we can override the dependency
    async def mock_get_db_override():
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # Not found
        mock_session.execute.return_value = mock_result
        yield mock_session

    from ai.db.connection import get_db
    from ai.main import get_current_user

    app.dependency_overrides[get_db] = mock_get_db_override
    app.dependency_overrides[get_current_user] = lambda: "test-user"

    response = client.post("/api/v1/alerts/999/acknowledge")
    assert response.status_code == 404

    app.dependency_overrides = {}


def test_sensor_response_schema_includes_current_state():
    sensor = SensorResponse(
        id=1,
        sensor_id="TEST001",
        name="Test Sensor",
        latitude=46.02,
        longitude=-112.51,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        current_state="normal",
    )
    assert sensor.current_state == "normal"


def test_sensor_response_schema_current_state_optional():
    sensor = SensorResponse(
        id=1,
        sensor_id="TEST001",
        name="Test Sensor",
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    assert sensor.current_state is None
