import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch


class TestAnomalyAPI:
    @pytest.fixture
    def client(self):
        with patch("main.YellowBoyDetector"):
            from main import app

            return TestClient(app)

    @pytest.fixture
    def valid_request(self):
        return {
            "data": [
                {
                    "timestamp": "2026-01-23T10:00:00Z",
                    "sensor_id": "sensor-1",
                    "ph": 4.2,
                    "turbidity": 65.0,
                    "conductivity": 450.0,
                    "temperature": 28.5,
                }
            ]
        }

    def test_anomaly_empty_data(self, client):
        response = client.post("/api/v1/anomaly", json={"data": []})
        assert response.status_code == 200
        data = response.json()
        assert data["anomalies"] == []
        assert data["total_anomalies"] == 0

    def test_anomaly_returns_critical(self, client, valid_request):
        response = client.post("/api/v1/anomaly", json=valid_request)
        assert response.status_code == 200
        data = response.json()
        assert data["total_anomalies"] >= 1

        ph_anomaly = next((a for a in data["anomalies"] if a["parameter"] == "ph"), None)
        assert ph_anomaly is not None
        assert ph_anomaly["severity"] == "critical"
        assert ph_anomaly["severity_score"] == 9

    def test_anomaly_normal_values(self, client):
        request = {
            "data": [
                {
                    "timestamp": "2026-01-23T10:00:00Z",
                    "sensor_id": "sensor-1",
                    "ph": 7.0,
                    "turbidity": 20.0,
                    "conductivity": 400.0,
                    "temperature": 28.0,
                }
            ]
        }
        response = client.post("/api/v1/anomaly", json=request)
        assert response.status_code == 200
        data = response.json()
        assert data["anomalies"] == []
        assert data["total_anomalies"] == 0

    def test_anomaly_validation_error(self, client):
        response = client.post("/api/v1/anomaly", json={"data": [{"invalid": "data"}]})
        assert response.status_code == 422
