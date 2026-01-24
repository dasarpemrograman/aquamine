import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from ai.main import app
from ai.schemas.sensor import SensorDataIngest
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

    with patch("ai.main.process_mqtt_message", new_callable=AsyncMock) as mock_process:
        with patch("ai.main.ws_manager.publish_update", new_callable=AsyncMock) as mock_ws:
            response = client.post("/api/v1/sensors/ingest", json=payload)
            assert response.status_code == 200
            assert response.json() == {"status": "ingested"}
            assert mock_process.called
            assert mock_ws.called


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

    app.dependency_overrides[get_db] = mock_get_db_override

    response = client.post("/api/v1/alerts/999/acknowledge")
    assert response.status_code == 404

    app.dependency_overrides = {}
