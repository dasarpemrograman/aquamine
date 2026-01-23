"""Integration tests for the full forecast + anomaly + alert flow."""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from data_generator import SyntheticDataGenerator
from anomaly import AnomalyDetector


class TestEndToEndFlow:
    """Test the complete flow: generate data → detect anomaly → trigger alert."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch):
        """Set up environment variables and mocks for all tests."""
        monkeypatch.setenv("AQUAMINE_FORCE_MOCK", "1")
        monkeypatch.setenv("NIXTLA_API_KEY", "test-key")
        monkeypatch.setenv("FONNTE_API_TOKEN", "test-token")
        monkeypatch.setenv("RESEND_API_KEY", "test-key")
        monkeypatch.setenv("ALERT_PHONE", "08123456789")
        monkeypatch.setenv("ALERT_EMAIL", "test@example.com")
        monkeypatch.setenv("RESEND_FROM_EMAIL", "alerts@test.com")

    @pytest.fixture
    def client(self):
        """FastAPI test client with reset state machine."""
        with patch("main.YellowBoyDetector"):
            from main import app, alert_state_machine

            alert_state_machine.reset()
            return TestClient(app)

    @pytest.fixture
    def generator(self):
        """Synthetic data generator with fixed seed for reproducibility."""
        return SyntheticDataGenerator(seed=42)

    def test_normal_scenario_no_ph_anomalies(self, generator):
        """Normal scenario: pH stays in normal range, no pH anomalies."""
        df = generator.generate(scenario="normal", hours=24, sensor_id="sensor-1")

        assert len(df) == 288

        assert df["ph"].min() >= 6.5
        assert df["ph"].max() <= 7.2

        detector = AnomalyDetector(use_timegpt=False)
        anomalies = detector.detect(df)

        ph_anomalies = [a for a in anomalies if a["parameter"] == "ph"]
        assert len(ph_anomalies) == 0

    def test_normal_scenario_api_no_critical_alerts(self, client, generator):
        """Normal scenario via API: no critical state changes."""
        df = generator.generate(scenario="normal", hours=1, sensor_id="sensor-1")

        data = [
            {
                "timestamp": row["timestamp"].isoformat(),
                "sensor_id": row["sensor_id"],
                "ph": row["ph"],
                "turbidity": row["turbidity"],
                "conductivity": row["conductivity"],
                "temperature": row["temperature"],
            }
            for _, row in df.iterrows()
        ]

        response = client.post("/api/v1/anomaly", json={"data": data})
        assert response.status_code == 200
        anomaly_data = response.json()

        ph_anomalies = [a for a in anomaly_data["anomalies"] if a["parameter"] == "ph"]
        assert len(ph_anomalies) == 0

        critical_anomalies = [a for a in anomaly_data["anomalies"] if a["severity"] == "critical"]
        assert len(critical_anomalies) == 0

    # --- Scenario: Warning ---
    def test_warning_scenario_detects_anomalies(self, generator):
        """Warning scenario: generates data that triggers warning-level anomalies."""
        df = generator.generate(scenario="warning", hours=24, sensor_id="sensor-1")

        # pH should decline from ~7.0 to ~5.5
        assert df["ph"].iloc[0] > 6.5  # Start in normal range
        assert df["ph"].iloc[-1] < 6.0  # End in warning range

        # Detect anomalies
        detector = AnomalyDetector(use_timegpt=False)
        anomalies = detector.detect(df)

        # Should have some anomalies
        assert len(anomalies) > 0

        # At least some should be warning level
        warning_anomalies = [a for a in anomalies if a["severity"] == "warning"]
        assert len(warning_anomalies) > 0

    def test_warning_scenario_api_flow(self, client, generator):
        """Warning scenario via API: triggers state change to warning."""
        df = generator.generate(scenario="warning", hours=24, sensor_id="sensor-1")

        # Get last few rows (should be in warning range)
        last_rows = df.tail(5)
        data = [
            {
                "timestamp": row["timestamp"].isoformat(),
                "sensor_id": row["sensor_id"],
                "ph": row["ph"],
                "turbidity": row["turbidity"],
                "conductivity": row["conductivity"],
                "temperature": row["temperature"],
            }
            for _, row in last_rows.iterrows()
        ]

        # Call anomaly endpoint
        response = client.post("/api/v1/anomaly", json={"data": data})
        assert response.status_code == 200
        anomaly_data = response.json()

        # Should have anomalies
        assert anomaly_data["total_anomalies"] > 0

        # Call alerts endpoint
        response = client.post(
            "/api/v1/alerts",
            json={"anomalies": anomaly_data["anomalies"], "notify": False},
        )
        assert response.status_code == 200
        alert_data = response.json()

        # Should have state change
        assert alert_data["processed"] > 0
        assert len(alert_data["state_changes"]) > 0

        # Verify state change is from normal
        state_change = alert_data["state_changes"][0]
        assert state_change["old_state"] == "normal"
        assert state_change["new_state"] in ["warning", "critical"]

    # --- Scenario: Critical ---
    def test_critical_scenario_detects_anomalies(self, generator):
        """Critical scenario: generates data that triggers critical-level anomalies."""
        df = generator.generate(scenario="critical", hours=24, sensor_id="sensor-1")

        # pH should decay exponentially from ~7.0 to ~4.2
        assert df["ph"].iloc[0] > 6.5  # Start in normal range
        assert df["ph"].iloc[-1] < 4.5  # End in critical range

        # Detect anomalies
        detector = AnomalyDetector(use_timegpt=False)
        anomalies = detector.detect(df)

        # Should have anomalies
        assert len(anomalies) > 0

        # Should have critical level anomalies
        critical_anomalies = [a for a in anomalies if a["severity"] == "critical"]
        assert len(critical_anomalies) > 0

        # Check severity scores for critical pH (<4.5)
        ph_criticals = [a for a in critical_anomalies if a["parameter"] == "ph"]
        assert len(ph_criticals) > 0
        for a in ph_criticals:
            assert a["severity_score"] >= 7  # Critical threshold

    def test_critical_scenario_api_flow(self, client, generator):
        """Critical scenario via API: triggers state change to critical."""
        df = generator.generate(scenario="critical", hours=24, sensor_id="sensor-1")

        # Get last few rows (should be in critical range)
        last_rows = df.tail(5)
        data = [
            {
                "timestamp": row["timestamp"].isoformat(),
                "sensor_id": row["sensor_id"],
                "ph": row["ph"],
                "turbidity": row["turbidity"],
                "conductivity": row["conductivity"],
                "temperature": row["temperature"],
            }
            for _, row in last_rows.iterrows()
        ]

        # Call anomaly endpoint
        response = client.post("/api/v1/anomaly", json={"data": data})
        assert response.status_code == 200
        anomaly_data = response.json()
        assert anomaly_data["total_anomalies"] > 0

        # Call alerts endpoint
        response = client.post(
            "/api/v1/alerts",
            json={"anomalies": anomaly_data["anomalies"], "notify": False},
        )
        assert response.status_code == 200
        alert_data = response.json()

        # Should have state change to critical
        assert alert_data["processed"] > 0
        assert len(alert_data["state_changes"]) > 0

        state_change = alert_data["state_changes"][0]
        assert state_change["old_state"] == "normal"
        assert state_change["new_state"] == "critical"


class TestStateTransitions:
    """Test alert state machine transitions."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch):
        monkeypatch.setenv("AQUAMINE_FORCE_MOCK", "1")

    @pytest.fixture
    def client(self):
        with patch("main.YellowBoyDetector"):
            from main import app, alert_state_machine

            alert_state_machine.reset()
            return TestClient(app)

    def test_state_persists_across_calls(self, client):
        """State persists: second call with same anomaly doesn't trigger change."""
        anomaly = {
            "sensor_id": "sensor-1",
            "parameter": "ph",
            "value": 4.2,
            "severity": "critical",
            "severity_score": 9,
            "reason": "pH critical",
        }

        # First call: triggers state change
        response1 = client.post("/api/v1/alerts", json={"anomalies": [anomaly], "notify": False})
        assert response1.status_code == 200
        data1 = response1.json()
        assert len(data1["state_changes"]) == 1

        # Second call: no state change (already critical)
        response2 = client.post("/api/v1/alerts", json={"anomalies": [anomaly], "notify": False})
        assert response2.status_code == 200
        data2 = response2.json()
        assert len(data2["state_changes"]) == 0

    def test_recovery_triggers_state_change(self, client):
        """Recovery: critical → normal triggers state change."""
        critical_anomaly = {
            "sensor_id": "sensor-1",
            "parameter": "ph",
            "value": 4.2,
            "severity": "critical",
            "severity_score": 9,
            "reason": "pH critical",
        }

        # Set to critical
        client.post("/api/v1/alerts", json={"anomalies": [critical_anomaly], "notify": False})

        # Now send normal-level (score <= 3)
        normal_anomaly = {
            "sensor_id": "sensor-1",
            "parameter": "ph",
            "value": 6.8,
            "severity": "normal",
            "severity_score": 1,
            "reason": "pH normal",
        }

        response = client.post(
            "/api/v1/alerts", json={"anomalies": [normal_anomaly], "notify": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["state_changes"]) == 1
        assert data["state_changes"][0]["old_state"] == "critical"
        assert data["state_changes"][0]["new_state"] == "normal"

    def test_get_alert_states(self, client):
        """GET /api/v1/alerts returns current states."""
        # Initially empty
        response = client.get("/api/v1/alerts")
        assert response.status_code == 200
        data = response.json()
        assert data["alert_states"] == {}

        # Trigger critical
        anomaly = {
            "sensor_id": "sensor-1",
            "parameter": "ph",
            "value": 4.2,
            "severity": "critical",
            "severity_score": 9,
            "reason": "pH critical",
        }
        client.post("/api/v1/alerts", json={"anomalies": [anomaly], "notify": False})

        # Now should have state
        response = client.get("/api/v1/alerts")
        data = response.json()
        assert data["alert_states"]["sensor-1"] == "critical"


class TestNotificationIntegration:
    """Test notification sending with mocked external services."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch):
        monkeypatch.setenv("AQUAMINE_FORCE_MOCK", "1")
        monkeypatch.setenv("FONNTE_API_TOKEN", "test-token")
        monkeypatch.setenv("RESEND_API_KEY", "test-key")
        monkeypatch.setenv("ALERT_PHONE", "08123456789")
        monkeypatch.setenv("ALERT_EMAIL", "test@example.com")
        monkeypatch.setenv("RESEND_FROM_EMAIL", "alerts@test.com")

    @pytest.fixture
    def mock_httpx(self):
        """Mock httpx.post for Fonnte calls."""
        with patch("notifications.service.httpx.post") as mock:
            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()
            mock.return_value = mock_response
            yield mock

    @pytest.fixture
    def mock_resend(self, monkeypatch):
        """Mock Resend SDK."""
        mock_emails = MagicMock()
        mock_emails.send.return_value = {"id": "test-email-id"}

        # Need to mock at import time in the notification service
        with patch.dict("sys.modules", {"resend": MagicMock()}):
            import sys

            mock_resend_module = sys.modules["resend"]
            mock_resend_module.Emails = mock_emails
            mock_resend_module.api_key = None
            yield mock_emails

    @pytest.fixture
    def client(self, mock_httpx, mock_resend):
        """Client with mocked notification services."""
        with patch("main.YellowBoyDetector"):
            # Need to reimport after mocking
            import importlib
            import notifications.service

            importlib.reload(notifications.service)

            from main import app, alert_state_machine

            alert_state_machine.reset()
            return TestClient(app)

    def test_notifications_sent_on_state_change(self, mock_httpx):
        """Notifications are sent when notify=True and state changes."""
        with patch("main.YellowBoyDetector"):
            # Reload notification service with mocked httpx
            import importlib
            import notifications.service

            importlib.reload(notifications.service)

            from main import app, alert_state_machine, notification_service

            alert_state_machine.reset()

            # Mock the notification service methods directly
            with (
                patch.object(notification_service, "send_whatsapp") as mock_wa,
                patch.object(notification_service, "send_email") as mock_email,
            ):
                mock_wa.return_value = {"success": True, "error": None}
                mock_email.return_value = {"success": True, "error": None}

                client = TestClient(app)

                anomaly = {
                    "sensor_id": "sensor-1",
                    "parameter": "ph",
                    "value": 4.2,
                    "severity": "critical",
                    "severity_score": 9,
                    "reason": "pH critical",
                }

                response = client.post(
                    "/api/v1/alerts", json={"anomalies": [anomaly], "notify": True}
                )
                assert response.status_code == 200
                data = response.json()

                # Verify notifications were sent
                assert data["notifications_sent"]["whatsapp"] is True
                assert data["notifications_sent"]["email"] is True

                # Verify mocks were called
                mock_wa.assert_called_once()
                mock_email.assert_called_once()

    def test_no_notifications_when_notify_false(self):
        """No notifications when notify=False."""
        with patch("main.YellowBoyDetector"):
            from main import app, alert_state_machine, notification_service

            alert_state_machine.reset()

            with (
                patch.object(notification_service, "send_whatsapp") as mock_wa,
                patch.object(notification_service, "send_email") as mock_email,
            ):
                client = TestClient(app)

                anomaly = {
                    "sensor_id": "sensor-1",
                    "parameter": "ph",
                    "value": 4.2,
                    "severity": "critical",
                    "severity_score": 9,
                    "reason": "pH critical",
                }

                response = client.post(
                    "/api/v1/alerts", json={"anomalies": [anomaly], "notify": False}
                )
                assert response.status_code == 200
                data = response.json()

                # No notifications sent
                assert data["notifications_sent"]["whatsapp"] is False
                assert data["notifications_sent"]["email"] is False

                # Mocks should NOT be called
                mock_wa.assert_not_called()
                mock_email.assert_not_called()

    def test_no_notifications_on_same_state(self):
        """No notifications when state doesn't change."""
        with patch("main.YellowBoyDetector"):
            from main import app, alert_state_machine, notification_service

            alert_state_machine.reset()

            with (
                patch.object(notification_service, "send_whatsapp") as mock_wa,
                patch.object(notification_service, "send_email") as mock_email,
            ):
                mock_wa.return_value = {"success": True, "error": None}
                mock_email.return_value = {"success": True, "error": None}

                client = TestClient(app)

                anomaly = {
                    "sensor_id": "sensor-1",
                    "parameter": "ph",
                    "value": 4.2,
                    "severity": "critical",
                    "severity_score": 9,
                    "reason": "pH critical",
                }

                # First call: triggers notification
                client.post("/api/v1/alerts", json={"anomalies": [anomaly], "notify": True})
                assert mock_wa.call_count == 1
                assert mock_email.call_count == 1

                # Second call: no notification (same state)
                response = client.post(
                    "/api/v1/alerts", json={"anomalies": [anomaly], "notify": True}
                )
                assert response.status_code == 200
                data = response.json()

                # Still only 1 call each (no new notifications)
                assert mock_wa.call_count == 1
                assert mock_email.call_count == 1
                assert len(data["state_changes"]) == 0


class TestMultipleSensors:
    """Test handling of multiple sensors simultaneously."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch):
        monkeypatch.setenv("AQUAMINE_FORCE_MOCK", "1")

    @pytest.fixture
    def client(self):
        with patch("main.YellowBoyDetector"):
            from main import app, alert_state_machine

            alert_state_machine.reset()
            return TestClient(app)

    def test_multiple_sensors_independent_states(self, client):
        """Each sensor maintains its own state independently."""
        anomalies = [
            {
                "sensor_id": "sensor-1",
                "parameter": "ph",
                "value": 4.2,
                "severity": "critical",
                "severity_score": 9,
                "reason": "pH critical",
            },
            {
                "sensor_id": "sensor-2",
                "parameter": "ph",
                "value": 5.8,
                "severity": "warning",
                "severity_score": 5,
                "reason": "pH warning",
            },
        ]

        response = client.post("/api/v1/alerts", json={"anomalies": anomalies, "notify": False})
        assert response.status_code == 200
        data = response.json()

        # Both should trigger state changes
        assert data["processed"] == 2
        assert len(data["state_changes"]) == 2

        # Check states
        states_response = client.get("/api/v1/alerts")
        states = states_response.json()["alert_states"]
        assert states["sensor-1"] == "critical"
        assert states["sensor-2"] == "warning"

    def test_aggregate_to_max_severity(self, client):
        """Multiple anomalies from same sensor aggregate to max severity."""
        anomalies = [
            {
                "sensor_id": "sensor-1",
                "parameter": "ph",
                "value": 5.8,
                "severity": "warning",
                "severity_score": 5,
                "reason": "pH warning",
            },
            {
                "sensor_id": "sensor-1",
                "parameter": "conductivity",
                "value": 800,
                "severity": "critical",
                "severity_score": 8,
                "reason": "conductivity critical",
            },
        ]

        response = client.post("/api/v1/alerts", json={"anomalies": anomalies, "notify": False})
        assert response.status_code == 200
        data = response.json()

        # Only one sensor processed
        assert data["processed"] == 1

        # Should be critical (max of warning and critical)
        assert len(data["state_changes"]) == 1
        assert data["state_changes"][0]["new_state"] == "critical"
