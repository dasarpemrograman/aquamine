import pytest
from unittest.mock import MagicMock, patch, ANY
from datetime import datetime, timezone
import json


class TestE2EFlow:
    @pytest.fixture(autouse=True)
    def override_dependencies(self):
        from main import app, get_session

        mock_session = MagicMock()
        app.dependency_overrides[get_session] = lambda: mock_session

        yield mock_session

        app.dependency_overrides = {}

    def test_full_pipeline_flow(self, client, override_dependencies):
        mock_session = override_dependencies

        # 1. Ingest Data (MQTT Bridge)
        # Mock database sensor lookup
        mock_sensor = MagicMock()
        mock_sensor.id = 1
        mock_sensor.sensor_id = "ESP32_E2E"

        # When querying for sensor, return None first (to trigger creation) then the mock
        mock_session.query.return_value.filter.return_value.first.side_effect = [None, mock_sensor]

        ingest_payload = {
            "sensor_id": "ESP32_E2E",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "readings": {"ph": 4.2, "turbidity": 120.0, "temperature": 38.0},  # Critical values
            "metadata": {"battery_voltage": 3.8},
        }

        with patch("main.process_mqtt_message") as mock_process:
            mock_process.return_value = {
                "success": True,
                "sensor_id": "ESP32_E2E",
                "reading_id": 100,
            }

            response = client.post("/api/v1/sensors/ingest", json=ingest_payload)
            assert response.status_code == 200
            assert response.json()["success"] is True

            # Verify process_mqtt_message was called
            mock_process.assert_called_once()

    def test_forecast_generation_trigger(self, client, override_dependencies):
        mock_session = override_dependencies

        # Mock sensor existence
        mock_sensor = MagicMock()
        mock_sensor.id = 1
        mock_sensor.sensor_id = "ESP32_E2E"
        mock_session.query.return_value.filter.return_value.first.return_value = mock_sensor

        # Mock historical data
        with patch("main.pd.read_sql") as mock_read_sql:
            mock_df = MagicMock()
            mock_df.empty = False
            mock_df.iterrows.return_value = []  # Return empty iterator but valid df
            mock_read_sql.return_value = mock_df

            # Mock forecast generation logic
            with patch("main.generate_all_forecasts") as mock_gen:
                mock_gen.return_value = {
                    "ph": MagicMock(empty=False),
                    "turbidity": MagicMock(empty=False),
                    "temperature": MagicMock(empty=False),
                }

                with patch("main.store_forecast") as mock_store:
                    mock_store.return_value = MagicMock(id=50)

                    response = client.post("/api/v1/forecast/generate", json={"sensor_id": 1})

                    assert response.status_code == 200
                    assert response.json()["success"] is True
                    assert response.json()["generated_count"] == 3  # 3 parameters

    def test_alert_acknowledgment_flow(self, client, override_dependencies):
        mock_session = override_dependencies

        # Mock existing alert
        mock_alert = MagicMock()
        mock_alert.id = 99
        mock_alert.severity = "critical"
        mock_alert.acknowledged_at = None

        # Setup mock return for acknowledge_alert
        mock_alert_after_ack = MagicMock()
        mock_alert_after_ack.id = 99
        mock_alert_after_ack.sensor_id = 1
        mock_alert_after_ack.severity = "critical"
        mock_alert_after_ack.acknowledged_at = datetime.now(timezone.utc)
        mock_alert_after_ack.acknowledged_by = "Admin"
        mock_alert_after_ack.previous_state = "warning"
        mock_alert_after_ack.message = "Test alert"
        mock_alert_after_ack.created_at = datetime.now(timezone.utc)

        with patch("main.acknowledge_alert") as mock_ack_func:
            mock_ack_func.return_value = mock_alert_after_ack

            response = client.post(
                "/api/v1/alerts/99/acknowledge", json={"acknowledged_by": "Admin"}
            )

            assert response.status_code == 200
            assert response.json()["acknowledged_by"] == "Admin"
            assert response.json()["acknowledged_at"] is not None

            mock_ack_func.assert_called_once_with(ANY, 99, "Admin")
