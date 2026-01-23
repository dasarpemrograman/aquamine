import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch


class TestAlertsAPI:
    @pytest.fixture
    def client(self):
        with patch("main.YellowBoyDetector"):
            from main import app, alert_state_machine

            alert_state_machine.reset()
            return TestClient(app)

    @pytest.fixture
    def valid_anomaly(self):
        return {
            "sensor_id": "sensor-1",
            "parameter": "ph",
            "value": 4.2,
            "severity": "critical",
            "severity_score": 9,
            "reason": "pH below critical threshold",
        }

    def test_alerts_post_empty(self, client):
        response = client.post("/api/v1/alerts", json={"anomalies": [], "notify": False})
        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 0
        assert data["state_changes"] == []

    def test_alerts_post_triggers_state_change(self, client, valid_anomaly):
        response = client.post(
            "/api/v1/alerts", json={"anomalies": [valid_anomaly], "notify": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 1
        assert len(data["state_changes"]) == 1
        assert data["state_changes"][0]["old_state"] == "normal"
        assert data["state_changes"][0]["new_state"] == "critical"

    def test_alerts_post_no_change_same_state(self, client, valid_anomaly):
        client.post("/api/v1/alerts", json={"anomalies": [valid_anomaly], "notify": False})

        response = client.post(
            "/api/v1/alerts", json={"anomalies": [valid_anomaly], "notify": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 1
        assert len(data["state_changes"]) == 0

    def test_alerts_get_empty(self, client):
        response = client.get("/api/v1/alerts")
        assert response.status_code == 200
        data = response.json()
        assert data["alert_states"] == {}

    def test_alerts_get_returns_states(self, client, valid_anomaly):
        client.post("/api/v1/alerts", json={"anomalies": [valid_anomaly], "notify": False})

        response = client.get("/api/v1/alerts")
        assert response.status_code == 200
        data = response.json()
        assert data["alert_states"]["sensor-1"] == "critical"

    def test_alerts_post_validation_error(self, client):
        response = client.post(
            "/api/v1/alerts", json={"anomalies": [{"invalid": "data"}], "notify": False}
        )
        assert response.status_code == 422
