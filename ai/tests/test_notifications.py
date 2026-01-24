import pytest
import os
import resend
from unittest.mock import MagicMock, patch, AsyncMock
from ai.alerts.notifications import NotificationService
from ai.schemas.alert import AlertCreate, RecipientBase


@pytest.fixture
def alert():
    return AlertCreate(
        sensor_id=1,
        severity="critical",
        previous_state="normal",
        message="Critical pH level detected!",
    )


@pytest.fixture
def recipient():
    return RecipientBase(
        name="Test User",
        phone="628123456789",
        email="test@example.com",
        is_active=True,
        notify_warning=True,
        notify_critical=True,
    )


@pytest.mark.asyncio
async def test_notification_routing(alert, recipient):
    with patch(
        "os.getenv",
        side_effect=lambda k: "fake_token" if k in ["FONNTE_API_TOKEN", "RESEND_API_KEY"] else None,
    ):
        service = NotificationService()

        # Mock internal send methods to verify routing logic
        service.send_whatsapp = AsyncMock()
        service.send_email = AsyncMock()

        await service.send_notifications(alert, [recipient])

        service.send_whatsapp.assert_awaited_once_with(recipient.phone, alert)
        service.send_email.assert_awaited_once_with(recipient.email, alert)


@pytest.mark.asyncio
async def test_notification_filtering(alert, recipient):
    with patch("os.getenv", side_effect=lambda k: "fake_token"):
        service = NotificationService()
        service.send_whatsapp = AsyncMock()
        service.send_email = AsyncMock()

        # Disable critical notifications for recipient
        recipient.notify_critical = False

        await service.send_notifications(alert, [recipient])

        service.send_whatsapp.assert_not_awaited()
        service.send_email.assert_not_awaited()


@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_send_whatsapp(mock_post, alert):
    with patch("os.getenv", return_value="fake_token"):
        service = NotificationService()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        await service.send_whatsapp("628123456789", alert)

        mock_post.assert_awaited_once()
        args, kwargs = mock_post.call_args
        assert kwargs["data"]["target"] == "628123456789"
        assert "Critical pH level detected" in kwargs["data"]["message"]


@pytest.mark.asyncio
@patch("resend.Emails.send")
async def test_send_email(mock_send, alert):
    with patch("os.getenv", return_value="fake_key"):
        service = NotificationService()

        await service.send_email("test@example.com", alert)

        mock_send.assert_called_once()
        call_args = mock_send.call_args[0][0]
        assert call_args["to"] == ["test@example.com"]
        assert "CRITICAL" in call_args["subject"]
