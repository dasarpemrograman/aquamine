import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone


class TestAPIEndpoints:
    @pytest.fixture(autouse=True)
    def override_dependencies(self):
        from main import app, get_session

        # Create a mock session
        mock_session = MagicMock()

        # Override the dependency
        app.dependency_overrides[get_session] = lambda: mock_session

        yield mock_session

        # Clean up
        app.dependency_overrides = {}

    def test_get_sensors_list(self, client, override_dependencies):
        mock_session = override_dependencies

        mock_sensor = MagicMock()
        mock_sensor.id = 1
        mock_sensor.sensor_id = "ESP32_001"
        mock_sensor.name = "Test Sensor"
        mock_sensor.is_active = True
        mock_sensor.created_at = datetime.now(timezone.utc)

        mock_session.query.return_value.filter.return_value.all.return_value = [mock_sensor]

        response = client.get("/api/v1/sensors")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["sensor_id"] == "ESP32_001"

    def test_ingest_sensor_data(self, client, override_dependencies):
        payload = {
            "sensor_id": "ESP32_001",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "readings": {"ph": 6.8, "turbidity": 25.0},
        }

        with patch("main.process_mqtt_message") as mock_process:
            mock_process.return_value = {"success": True, "reading_id": 123}

            response = client.post("/api/v1/sensors/ingest", json=payload)

            assert response.status_code == 200
            assert response.json()["success"] is True

    def test_get_forecast(self, client, override_dependencies):
        mock_session = override_dependencies

        mock_prediction = MagicMock()
        mock_prediction.id = 1
        mock_prediction.sensor_id = 1
        mock_prediction.forecast_start = datetime.now(timezone.utc)
        mock_prediction.forecast_end = datetime.now(timezone.utc)
        mock_prediction.parameter = "ph"
        mock_prediction.forecast_values = [
            {"timestamp": datetime.now(timezone.utc).isoformat(), "value": 7.0}
        ]
        mock_prediction.model_version = "v1"
        mock_prediction.created_at = datetime.now(timezone.utc)

        mock_session.query.return_value.filter.return_value.order_by.return_value.first.return_value = mock_prediction

        response = client.get("/api/v1/forecast/1?parameter=ph")

        assert response.status_code == 200
        data = response.json()
        assert data["parameter"] == "ph"
        assert len(data["forecast_values"]) == 1

    def test_trigger_forecast_generation(self, client, override_dependencies):
        mock_session = override_dependencies

        # Mock sensor query
        mock_sensor = MagicMock()
        mock_sensor.sensor_id = "ESP32_001"
        mock_session.query.return_value.filter.return_value.first.return_value = mock_sensor

        # Mock readings query (pandas read_sql)
        with patch("main.pd.read_sql") as mock_read_sql:
            mock_df = MagicMock()
            mock_df.empty = False  # Explicitly set empty to False
            mock_read_sql.return_value = mock_df

            # Mock forecast generation
            with patch("main.generate_all_forecasts") as mock_generate:
                mock_generate.return_value = {"ph": MagicMock(empty=False)}

                with patch("main.store_forecast") as mock_store:
                    mock_store.return_value = MagicMock(id=1)

                    response = client.post("/api/v1/forecast/generate", json={"sensor_id": 1})

                    assert response.status_code == 200
                    assert response.json()["success"] is True
                    mock_generate.assert_called_once()

    def test_get_alerts_list(self, client, override_dependencies):
        mock_session = override_dependencies

        mock_alert = MagicMock()
        mock_alert.id = 1
        mock_alert.sensor_id = 1
        mock_alert.severity = "critical"
        mock_alert.message = "pH low"
        mock_alert.created_at = datetime.now(timezone.utc)
        mock_alert.acknowledged_at = None
        mock_alert.acknowledged_by = None
        mock_alert.previous_state = "warning"

        mock_session.query.return_value.order_by.return_value.limit.return_value.all.return_value = [
            mock_alert
        ]

        response = client.get("/api/v1/alerts")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["severity"] == "critical"

    def test_acknowledge_alert(self, client, override_dependencies):
        mock_session = override_dependencies

        # Mock alert acknowledge
        with patch("main.acknowledge_alert") as mock_ack:
            mock_alert = MagicMock()
            mock_alert.id = 1
            mock_alert.sensor_id = 1
            mock_alert.severity = "critical"
            mock_alert.message = "pH low"
            mock_alert.created_at = datetime.now(timezone.utc)
            mock_alert.acknowledged_at = datetime.now(timezone.utc)
            mock_alert.acknowledged_by = "Admin"
            mock_alert.previous_state = "warning"

            mock_ack.return_value = mock_alert

            response = client.post(
                "/api/v1/alerts/1/acknowledge", json={"acknowledged_by": "Admin"}
            )

            assert response.status_code == 200
            assert response.json()["acknowledged_by"] == "Admin"
