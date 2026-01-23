"""Tests for notification service."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from notifications import NotificationService


class TestNotificationService:
    @pytest.fixture
    def alert_info(self):
        return {
            "sensor_id": "sensor-1",
            "old_state": "normal",
            "new_state": "warning",
            "severity_score": 5,
            "anomalies": [
                {"parameter": "ph", "value": 5.5, "severity": "warning", "reason": "pH low"}
            ],
        }

    def test_init_uses_env_vars(self):
        env = {
            "FONNTE_API_TOKEN": "fonnte-token",
            "RESEND_API_KEY": "resend-key",
            "ALERT_PHONE": "08123456789",
            "ALERT_EMAIL": "test@example.com",
            "RESEND_FROM_EMAIL": "alerts@domain.com",
        }

        with patch.dict("os.environ", env):
            with patch("resend.Emails"):
                svc = NotificationService()
                assert svc.fonnte_token == "fonnte-token"
                assert svc.phone == "08123456789"
                assert svc.email == "test@example.com"

    def test_init_uses_explicit_params(self):
        svc = NotificationService(fonnte_token="explicit-token", phone="explicit-phone")
        assert svc.fonnte_token == "explicit-token"
        assert svc.phone == "explicit-phone"

    def test_send_whatsapp_success(self):
        with patch("httpx.post") as mock_post:
            mock_post.return_value = Mock(status_code=200)
            mock_post.return_value.raise_for_status = Mock()

            svc = NotificationService(fonnte_token="token", phone="08123")
            result = svc.send_whatsapp("Test message")

            assert result["success"] is True
            mock_post.assert_called_once()

    def test_send_whatsapp_no_token(self):
        svc = NotificationService(fonnte_token=None, phone="08123")
        result = svc.send_whatsapp("Test")

        assert result["success"] is False
        assert "not configured" in result["error"]

    def test_send_whatsapp_no_phone(self):
        svc = NotificationService(fonnte_token="token", phone=None)
        result = svc.send_whatsapp("Test")

        assert result["success"] is False
        assert "ALERT_PHONE" in result["error"]

    def test_send_whatsapp_api_error(self):
        with patch("httpx.post") as mock_post:
            mock_post.side_effect = Exception("API error")

            svc = NotificationService(fonnte_token="token", phone="08123")
            result = svc.send_whatsapp("Test")

            assert result["success"] is False
            assert "API error" in result["error"]

    def test_send_email_not_configured(self):
        svc = NotificationService()
        svc._resend = None
        result = svc.send_email("Subject", "<html>Body</html>")

        assert result["success"] is False
        assert "not configured" in result["error"]

    def test_send_email_no_recipient(self):
        mock_resend = MagicMock()
        svc = NotificationService(resend_key="key", email=None)
        svc._resend = mock_resend
        result = svc.send_email("Subject", "<html>Body</html>")

        assert result["success"] is False
        assert "ALERT_EMAIL" in result["error"]

    def test_notify_alert_sends_both(self, alert_info):
        svc = NotificationService(
            fonnte_token="token",
            resend_key="key",
            phone="08123",
            email="test@example.com",
        )
        svc._resend = MagicMock()

        with patch("httpx.post") as mock_post:
            mock_post.return_value = Mock(status_code=200)
            mock_post.return_value.raise_for_status = Mock()

            result = svc.notify_alert(alert_info)

            assert "whatsapp" in result
            assert "email" in result

    def test_build_message_escalation(self, alert_info):
        svc = NotificationService()
        message = svc._build_message(alert_info)

        assert "ALERT" in message
        assert "sensor-1" in message
        assert "normal" in message.lower()
        assert "warning" in message.lower()

    def test_build_message_recovery(self):
        alert_info = {
            "sensor_id": "sensor-1",
            "old_state": "critical",
            "new_state": "warning",
            "severity_score": 5,
            "anomalies": [],
        }

        svc = NotificationService()
        message = svc._build_message(alert_info)

        assert "RECOVERY" in message

    def test_build_subject(self, alert_info):
        svc = NotificationService()
        subject = svc._build_subject(alert_info)

        assert "AquaMine" in subject
        assert "WARNING" in subject
        assert "sensor-1" in subject
