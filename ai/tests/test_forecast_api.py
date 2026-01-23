import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch


class TestForecastAPI:
    @pytest.fixture
    def client(self):
        with patch("main.YellowBoyDetector"):
            with patch("nixtla.NixtlaClient"):
                from main import app

                return TestClient(app)

    @pytest.fixture
    def valid_request(self):
        return {
            "data": [
                {
                    "timestamp": "2026-01-23T10:00:00Z",
                    "sensor_id": "sensor-1",
                    "ph": 6.8,
                    "turbidity": 25.0,
                    "conductivity": 450.0,
                    "temperature": 28.5,
                }
            ],
            "horizon_days": 7,
        }

    def test_forecast_empty_data(self, client):
        response = client.post("/api/v1/forecast", json={"data": [], "horizon_days": 7})
        assert response.status_code == 400

    def test_forecast_missing_data(self, client):
        response = client.post("/api/v1/forecast", json={"horizon_days": 7})
        assert response.status_code == 422

    def test_forecast_validation_error(self, client):
        response = client.post(
            "/api/v1/forecast",
            json={"data": [{"invalid": "data"}], "horizon_days": 7},
        )
        assert response.status_code == 422
