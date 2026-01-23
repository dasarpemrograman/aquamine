import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch, MagicMock


class TestWhatsAppNotification:
    def test_whatsapp_message_formatted_correctly(self):
        from alerts.notifications import format_whatsapp_message

        message = format_whatsapp_message(
            sensor_name="Sensor AMD-001",
            severity="warning",
            ph_value=5.3,
            turbidity_value=45.0,
            timestamp=datetime(2026, 1, 24, 10, 30, 0, tzinfo=timezone.utc),
        )

        assert "ALERT" in message
        assert "Sensor AMD-001" in message
        assert "warning" in message.lower()
        assert "5.3" in message
        assert "45.0" in message

    def test_fonnte_send_success(self):
        from alerts.notifications import send_whatsapp

        with patch("alerts.notifications.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(
                status_code=200, json=lambda: {"status": True, "detail": "sent"}
            )

            result = send_whatsapp(
                phone="+6281234567890",
                message="Test alert message",
                api_token="test_token",
            )

            assert result["success"] is True
            mock_post.assert_called_once()

    def test_fonnte_send_failure_handled(self):
        from alerts.notifications import send_whatsapp

        with patch("alerts.notifications.httpx.post") as mock_post:
            mock_post.side_effect = Exception("Network error")

            result = send_whatsapp(
                phone="+6281234567890",
                message="Test alert message",
                api_token="test_token",
            )

            assert result["success"] is False
            assert "error" in result


class TestEmailNotification:
    def test_email_html_template_renders(self):
        from alerts.notifications import format_email_html

        html = format_email_html(
            sensor_name="Sensor AMD-001",
            severity="critical",
            ph_value=4.2,
            turbidity_value=120.0,
            temperature_value=29.0,
            timestamp=datetime(2026, 1, 24, 10, 30, 0, tzinfo=timezone.utc),
        )

        assert "<html>" in html.lower() or "<!doctype" in html.lower() or "<div" in html.lower()
        assert "Sensor AMD-001" in html
        assert "critical" in html.lower()
        assert "4.2" in html

    def test_resend_send_success(self):
        from alerts.notifications import send_email

        with patch("resend.Emails.send") as mock_send:
            mock_send.return_value = {"id": "email_123"}

            result = send_email(
                to_email="admin@aquamine.id",
                subject="[CRITICAL] AquaMine Alert",
                html_content="<p>Alert content</p>",
                api_key="test_key",
            )

            assert result["success"] is True
            mock_send.assert_called_once()

    def test_resend_send_failure_handled(self):
        from alerts.notifications import send_email

        with patch("resend.Emails.send") as mock_send:
            mock_send.side_effect = Exception("API error")

            result = send_email(
                to_email="admin@aquamine.id",
                subject="[CRITICAL] AquaMine Alert",
                html_content="<p>Alert content</p>",
                api_key="test_key",
            )

            assert result["success"] is False
            assert "error" in result


class TestNotificationRecipients:
    def test_recipients_loaded_from_database(self, db_session):
        from alerts.notifications import get_active_recipients
        from db.models import NotificationRecipient

        recipient1 = NotificationRecipient(
            name="Admin",
            phone="+6281234567890",
            email="admin@aquamine.id",
            is_active=True,
        )
        recipient2 = NotificationRecipient(
            name="Inactive User",
            phone="+6289876543210",
            is_active=False,
        )
        db_session.add_all([recipient1, recipient2])
        db_session.commit()

        recipients = get_active_recipients(db_session, severity="warning")

        assert len(recipients) == 1
        assert recipients[0].name == "Admin"


class TestNotificationService:
    def test_send_all_notifications(self):
        from alerts.notifications import NotificationService

        service = NotificationService(
            fonnte_token="test_fonnte",
            resend_api_key="test_resend",
        )

        recipients = [
            {"name": "Admin", "phone": "+6281234567890", "email": "admin@aquamine.id"},
        ]

        with patch.object(service, "_send_whatsapp") as mock_wa:
            with patch.object(service, "_send_email") as mock_email:
                mock_wa.return_value = {"success": True}
                mock_email.return_value = {"success": True}

                results = service.notify_all(
                    recipients=recipients,
                    sensor_name="Test Sensor",
                    severity="warning",
                    ph_value=5.3,
                    turbidity_value=45.0,
                    timestamp=datetime.now(timezone.utc),
                )

                assert len(results) == 2
                mock_wa.assert_called_once()
                mock_email.assert_called_once()
