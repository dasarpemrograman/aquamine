import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from ai.main import process_mqtt_message
from ai.schemas.sensor import SensorDataIngest
from ai.anomaly.detector import AnomalyDetector
from ai.alerts.state_machine import AlertStateMachine
from ai.alerts.notifications import NotificationService
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_full_flow_ingest_to_alert():
    """
    Test the complete flow:
    1. Ingest Data (MQTT) -> 2. Store DB -> 3. Detect Anomaly -> 4. Trigger Alert -> 5. Notify
    """

    # Payload: Critical pH drop
    payload = SensorDataIngest(
        sensor_id="TEST_FLOW_001",
        timestamp=datetime.now(timezone.utc),
        readings={"ph": 4.0, "turbidity": 10.0, "temperature": 25.0},  # pH 4.0 is critical (< 4.5)
        metadata={},
    )

    # Mocks
    mock_db_session = AsyncMock()
    # Mock sensor object that is NOT a coroutine
    mock_sensor = MagicMock()
    mock_sensor.id = 1

    # Correctly mock the result object to be a MagicMock (sync), not AsyncMock
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_sensor
    mock_db_session.execute.return_value = mock_result

    with patch("ai.iot.mqtt_bridge.AsyncSessionLocal") as mock_session_cls:
        mock_session_cls.return_value.__aenter__.return_value = mock_db_session

        # 1. Ingest & Store
        await process_mqtt_message(payload)

        # Verify storage
        assert mock_db_session.add.called  # Reading stored
        assert mock_db_session.commit.called

        # 2. Anomaly Detection logic
        detector = AnomalyDetector()
        anomalies = detector.detect_threshold_anomalies(1, payload.readings, payload.timestamp)

        assert len(anomalies) > 0
        assert anomalies[0].parameter == "ph"
        assert anomalies[0].detection_method == "threshold_critical"

        # 3. Alert Logic
        sm = AlertStateMachine()
        # Force cache state for reliable testing
        sm.state_cache[1] = {"state": "normal", "last_alert_at": None}

        alert = sm.process_anomaly(1, "critical", "Critical pH detected")

        assert alert is not None
        assert alert.severity == "critical"
        assert alert.previous_state == "normal"

        # 4. Notification
        notifier = NotificationService()
        notifier.fonnte_token = "fake_token"
        notifier.resend_key = "fake_key"
        notifier.send_whatsapp = AsyncMock()
        notifier.send_email = AsyncMock()

        recipients = [
            MagicMock(phone="123", email="test@test.com", is_active=True, notify_critical=True)
        ]

        with patch(
            "os.getenv",
            side_effect=lambda k: "fake" if k in ["FONNTE_API_TOKEN", "RESEND_API_KEY"] else None,
        ):
            await notifier.send_notifications(alert, recipients)

            assert notifier.send_whatsapp.called
            assert notifier.send_email.called


@pytest.mark.asyncio
async def test_websocket_integration():
    """Test that data ingestion triggers websocket broadcast."""
    payload = {
        "sensor_id": "WS_TEST",
        "timestamp": "2024-01-01T12:00:00Z",
        "readings": {"ph": 7.0},
        "metadata": {},
    }

    from ai.main import ingest_sensor_data, ws_manager

    with patch("ai.main.process_mqtt_message", new_callable=AsyncMock):
        with patch.object(ws_manager, "publish_update", new_callable=AsyncMock) as mock_pub:
            await ingest_sensor_data(SensorDataIngest(**payload), MagicMock())

            mock_pub.assert_called_once()
            args = mock_pub.call_args
            assert args[0][0] == "sensor_reading"
            assert args[0][1]["sensor_id"] == "WS_TEST"
