import os
import pytest

# Set env vars BEFORE importing anything from ai
os.environ["DATABASE_URL"] = "postgresql+psycopg://user:pass@localhost/db"
os.environ["REDIS_URL"] = "redis://localhost"
os.environ["INGEST_API_KEY"] = "test-key"
os.environ["CLERK_SECRET_KEY"] = "test-secret"
os.environ["CLERK_ISSUER"] = "https://clerk.test"
os.environ["RATE_LIMIT_ENABLED"] = "true"

from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
from ai.main import app, limiter, get_current_user
from ai.db.connection import get_db
from limits.storage import MemoryStorage

client = TestClient(app)

# Override dependencies
app.dependency_overrides[get_current_user] = lambda: "test_user"


async def mock_get_db():
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    # Mock execute result if needed
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock()  # Mock sensor/alert state
    mock_session.execute.return_value = mock_result
    yield mock_session


app.dependency_overrides[get_db] = mock_get_db


@pytest.fixture(autouse=True)
def setup_limiter():
    """Swap to memory storage for testing to verify logic without Redis."""
    # Access private attribute _storage to hot-swap backend
    original_storage = limiter._storage
    # Also need to check if we need to update the underlying strategy's storage
    original_strategy_storage = None
    if hasattr(limiter, "limiter") and hasattr(limiter.limiter, "storage"):
        original_strategy_storage = limiter.limiter.storage

    memory_storage = MemoryStorage()
    limiter._storage = memory_storage
    if hasattr(limiter, "limiter"):
        limiter.limiter.storage = memory_storage

    yield

    limiter._storage = original_storage
    if original_strategy_storage and hasattr(limiter, "limiter"):
        limiter.limiter.storage = original_strategy_storage


@pytest.mark.asyncio
async def test_rate_limit_chat():
    # Limit: 30/minute

    # Mock orchestrator to be fast and successful
    with patch(
        "ai.main.chat_orchestrator.process_user_message", new_callable=AsyncMock
    ) as mock_chat:
        mock_chat.return_value = "Hello"

        # Consume all 30 tokens
        for i in range(30):
            response = client.post(
                "/api/v1/chat",
                json={"message": "hi", "session_id": "test"},
            )
            assert response.status_code == 200, f"Request {i + 1} failed"

        # 31st request should be blocked
        response = client.post(
            "/api/v1/chat",
            json={"message": "hi", "session_id": "test"},
        )
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.text


@pytest.mark.asyncio
async def test_rate_limit_cv():
    # Limit: 10/minute

    with patch("ai.main.cv_detector.detect") as mock_detect, patch("PIL.Image.open") as mock_open:
        mock_detect.return_value = ([], [])
        mock_open.return_value.size = (100, 100)

        file_content = b"fake image"
        files = {"file": ("test.jpg", file_content, "image/jpeg")}

        for i in range(10):
            response = client.post("/api/v1/cv/analyze", files=files)
            assert response.status_code == 200, f"Request {i + 1} failed"

        response = client.post("/api/v1/cv/analyze", files=files)
        assert response.status_code == 429


@pytest.mark.asyncio
async def test_rate_limit_ingest():
    # Limit: 100/minute

    # Create proper mock return value for alert
    mock_alert = MagicMock()
    mock_alert.severity = "info"
    mock_alert.previous_state = "normal"
    mock_alert.message = "Test recovery"
    mock_alert.sensor_id = 1

    with (
        patch("ai.main.process_mqtt_message", new_callable=AsyncMock),
        patch("ai.main.ws_manager.publish_update", new_callable=AsyncMock),
        patch("ai.main.notifier.send_notifications", new_callable=AsyncMock),
        patch("ai.main.anomaly_detector.detect_threshold_anomalies", return_value=[]),
        patch("ai.main.alert_sm.process_recovery", new_callable=AsyncMock, return_value=mock_alert),
    ):
        payload = {
            "sensor_id": "TEST_LIMIT",
            "timestamp": "2024-01-01T00:00:00Z",
            "readings": {"ph": 7.0},
            "metadata": {},
        }

        headers = {"X-Ingest-Key": "test-key"}

        # We verify checking limit
        # 100 requests OK
        for i in range(100):
            response = client.post("/api/v1/sensors/ingest", json=payload, headers=headers)
            assert response.status_code == 200, (
                f"Request {i + 1} failed with {response.status_code}: {response.text}"
            )

        # 101 blocked
        response = client.post("/api/v1/sensors/ingest", json=payload, headers=headers)
        assert response.status_code == 429
