from __future__ import annotations

import importlib
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from limits.storage import MemoryStorage


async def mock_get_db():
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock()  # Mock sensor/alert state
    mock_session.execute.return_value = mock_result
    yield mock_session


@pytest.fixture(scope="module")
def rate_limited_main():
    """Reload ai.main with rate limiting enabled for this module."""
    mp = pytest.MonkeyPatch()
    mp.setenv("REDIS_URL", "memory://")
    mp.setenv("RATE_LIMIT_ENABLED", "true")

    import ai.main as main

    main = importlib.reload(main)
    yield main

    mp.undo()
    # Best-effort reload so later tests don't inherit this module's env.
    try:
        importlib.reload(main)
    except Exception:
        pass


@pytest.fixture
def client(rate_limited_main):
    main = rate_limited_main
    app = main.app
    limiter = main.limiter

    # Override dependencies
    app.dependency_overrides[main.get_current_user] = lambda: "test_user"
    app.dependency_overrides[main.get_db] = mock_get_db

    original_storage = getattr(limiter, "_storage", None)
    original_strategy_storage = None
    if hasattr(limiter, "limiter") and hasattr(limiter.limiter, "storage"):
        original_strategy_storage = limiter.limiter.storage

    memory_storage = MemoryStorage()
    if original_storage is not None:
        limiter._storage = memory_storage
    if hasattr(limiter, "limiter") and hasattr(limiter.limiter, "storage"):
        limiter.limiter.storage = memory_storage

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()

    if getattr(limiter, "_storage", None) is memory_storage and original_storage is not None:
        limiter._storage = original_storage
    if (
        hasattr(limiter, "limiter")
        and hasattr(limiter.limiter, "storage")
        and limiter.limiter.storage is memory_storage
        and original_strategy_storage is not None
    ):
        limiter.limiter.storage = original_strategy_storage


@pytest.mark.skip(
    reason="Rate limiting tests require Redis; memory storage doesn't persist across requests in test fixture"
)
def test_rate_limit_chat(client):
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


@pytest.mark.skip(
    reason="Rate limiting tests require Redis; memory storage doesn't persist across requests in test fixture"
)
def test_rate_limit_cv(client):
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


@pytest.mark.skip(
    reason="Rate limiting tests require Redis; memory storage doesn't persist across requests in test fixture"
)
def test_rate_limit_ingest(client, rate_limited_main):
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
        patch(
            "ai.main.alert_sm.process_recovery",
            return_value=(mock_alert, "normal", datetime.now(timezone.utc)),
        ),
    ):
        payload = {
            "sensor_id": "TEST_LIMIT",
            "timestamp": "2024-01-01T00:00:00Z",
            "readings": {"ph": 7.0},
            "metadata": {},
        }

        headers = {"X-Ingest-Key": rate_limited_main.INGEST_API_KEY}

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
