import pytest
from datetime import datetime, timezone
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

from ai.alerts.notifications import NotificationService
from ai.alerts.state_machine import AlertStateMachine
from ai.anomaly.detector import AnomalyDetector
from ai.main import process_mqtt_message
from ai.schemas.alert import RecipientBase
from ai.schemas.sensor import SensorDataIngest


@pytest.mark.asyncio
async def test_full_flow_ingest_to_alert():
    """Test the complete flow:
    1) Ingest Data (MQTT) -> 2) Store DB -> 3) Detect Anomaly -> 4) Trigger Alert -> 5) Notify
    """

    payload = SensorDataIngest(
        sensor_id="TEST_FLOW_001",
        timestamp=datetime.now(timezone.utc),
        readings={"ph": 4.0, "turbidity": 10.0, "temperature": 25.0},
        metadata={},
    )

    mock_db_session = AsyncMock()
    # SQLAlchemy AsyncSession.add() is sync; keep it a MagicMock to avoid "coroutine was never awaited".
    mock_db_session.add = MagicMock()
    mock_sensor = MagicMock()
    mock_sensor.id = 1

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_sensor
    mock_db_session.execute.return_value = mock_result

    with patch("ai.iot.mqtt_bridge.AsyncSessionLocal") as mock_session_cls:
        mock_session_cls.return_value.__aenter__.return_value = mock_db_session

        await process_mqtt_message(payload)

        assert mock_db_session.add.called
        assert mock_db_session.commit.called

        detector = AnomalyDetector()
        readings = {k: v for k, v in payload.readings.items() if v is not None}
        anomalies = detector.detect_threshold_anomalies(
            1, cast(dict[str, float], readings), payload.timestamp
        )

        assert len(anomalies) > 0
        assert anomalies[0].parameter == "ph"
        assert anomalies[0].detection_method == "threshold_critical"

        sm = AlertStateMachine()
        alert, _new_state, _new_last_alert_at = sm.process_anomaly(
            sensor_id=1,
            severity="critical",
            message="Critical pH detected",
            current_state="normal",
            last_alert_at=None,
            now=payload.timestamp,
        )

        assert alert is not None
        assert alert.severity == "critical"
        assert alert.previous_state == "normal"

        notifier = NotificationService()
        notifier.fonnte_token = "fake_token"
        notifier.resend_key = "fake_key"
        notifier.send_whatsapp = AsyncMock()
        notifier.send_email = AsyncMock()

        recipients = [
            RecipientBase(
                name="Test Recipient",
                phone="123",
                email="test@test.com",
                is_active=True,
                notify_critical=True,
            )
        ]

        with patch(
            "os.getenv",
            side_effect=lambda k: "fake" if k in ["FONNTE_API_TOKEN", "RESEND_API_KEY"] else None,
        ):
            await notifier.send_notifications(cast(Any, alert), recipients)

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
            # Build an async-session-like mock
            mock_db = AsyncMock()
            mock_db.add = MagicMock()
            mock_db.commit = AsyncMock()
            mock_db.rollback = AsyncMock()

            mock_sensor = MagicMock()
            mock_sensor.id = 1
            mock_sensor.sensor_id = "WS_TEST"

            # First execute() returns Sensor; second returns SensorAlertState (None -> create default)
            res_sensor = MagicMock()
            res_sensor.scalar_one_or_none.return_value = mock_sensor
            res_state = MagicMock()
            res_state.scalar_one_or_none.return_value = None
            mock_db.execute = AsyncMock(side_effect=[res_sensor, res_state])

            await ingest_sensor_data(
                cast(Any, MagicMock()),
                SensorDataIngest(**payload),
                cast(Any, MagicMock()),
                cast(Any, mock_db),
                "test-key",
            )

            mock_pub.assert_called_once()
            args = mock_pub.call_args
            assert args[0][0] == "sensor_reading"
            assert args[0][1]["sensor_id"] == "WS_TEST"
