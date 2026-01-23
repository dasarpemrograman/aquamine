# ai/notifications/service.py

import os
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class NotificationService:
    """Send notifications via WhatsApp (Fonnte) and Email (Resend)."""

    def __init__(
        self,
        fonnte_token: Optional[str] = None,
        resend_key: Optional[str] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        from_email: Optional[str] = None,
    ):
        """
        Initialize notification service.

        Args:
            fonnte_token: Fonnte API token. Defaults to FONNTE_API_TOKEN env var.
            resend_key: Resend API key. Defaults to RESEND_API_KEY env var.
            phone: Recipient phone number. Defaults to ALERT_PHONE env var.
            email: Recipient email. Defaults to ALERT_EMAIL env var.
            from_email: Sender email for Resend. Defaults to RESEND_FROM_EMAIL env var.
        """
        self.fonnte_token = fonnte_token or os.getenv("FONNTE_API_TOKEN")
        self.resend_key = resend_key or os.getenv("RESEND_API_KEY")
        self.phone = phone or os.getenv("ALERT_PHONE")
        self.email = email or os.getenv("ALERT_EMAIL")
        self.from_email = from_email or os.getenv("RESEND_FROM_EMAIL", "alerts@example.com")

        # Initialize Resend client if key available
        self._resend = None
        if self.resend_key:
            try:
                import resend

                resend.api_key = self.resend_key
                self._resend = resend
            except ImportError:
                logger.warning("Resend package not installed")

    def send_whatsapp(self, message: str) -> dict:
        """
        Send WhatsApp message via Fonnte API.

        Args:
            message: Text message to send

        Returns:
            dict with keys: success (bool), error (str or None)
        """
        if not self.fonnte_token:
            logger.warning("FONNTE_API_TOKEN not configured, skipping WhatsApp")
            return {"success": False, "error": "FONNTE_API_TOKEN not configured"}

        if not self.phone:
            logger.warning("ALERT_PHONE not configured, skipping WhatsApp")
            return {"success": False, "error": "ALERT_PHONE not configured"}

        try:
            response = httpx.post(
                "https://api.fonnte.com/send",
                headers={"Authorization": self.fonnte_token},
                data={"target": self.phone, "message": message},
            )
            response.raise_for_status()
            return {"success": True, "error": None}
        except Exception as e:
            logger.error(f"WhatsApp send failed: {e}")
            return {"success": False, "error": str(e)}

    def send_email(self, subject: str, html: str) -> dict:
        """
        Send email via Resend.

        Args:
            subject: Email subject
            html: HTML body content

        Returns:
            dict with keys: success (bool), error (str or None)
        """
        if not self._resend:
            logger.warning("Resend not configured, skipping email")
            return {"success": False, "error": "Resend not configured"}

        if not self.email:
            logger.warning("ALERT_EMAIL not configured, skipping email")
            return {"success": False, "error": "ALERT_EMAIL not configured"}

        try:
            self._resend.Emails.send(
                {"from": self.from_email, "to": self.email, "subject": subject, "html": html}
            )
            return {"success": True, "error": None}
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return {"success": False, "error": str(e)}

    def notify_alert(self, alert_info: dict) -> dict:
        """
        Send alert notification via both channels.

        Args:
            alert_info: Dict with keys:
                sensor_id, old_state, new_state, severity_score, anomalies

        Returns:
            dict with keys: whatsapp (result), email (result)
        """
        # Build message from alert_info
        message = self._build_message(alert_info)
        subject = self._build_subject(alert_info)
        html = self._build_html(alert_info)

        # Send both
        whatsapp_result = self.send_whatsapp(message)
        email_result = self.send_email(subject, html)

        return {"whatsapp": whatsapp_result, "email": email_result}

    def _build_message(self, alert_info: dict) -> str:
        """Build WhatsApp message from alert info."""
        sensor_id = alert_info["sensor_id"]
        old_state = alert_info["old_state"]
        new_state = alert_info["new_state"]
        anomalies = alert_info.get("anomalies", [])

        # Determine if escalation or recovery
        if self._state_order(new_state) > self._state_order(old_state):
            emoji = "🚨" if new_state == "critical" else "⚠️"
            prefix = "ALERT"
        else:
            emoji = "⬇️"
            prefix = "RECOVERY"

        lines = [
            f"{emoji} {prefix}: {sensor_id}",
            f"State: {old_state.upper()} → {new_state.upper()}",
            "",
            "Parameters:",
        ]

        for a in anomalies:
            lines.append(f"  • {a['parameter']}: {a['value']} ({a['severity']})")

        return "\n".join(lines)

    def _build_subject(self, alert_info: dict) -> str:
        """Build email subject."""
        new_state = alert_info["new_state"]
        sensor_id = alert_info["sensor_id"]
        return f"[AquaMine] {new_state.upper()} Alert - {sensor_id}"

    def _build_html(self, alert_info: dict) -> str:
        """Build HTML email body."""
        message = self._build_message(alert_info)
        return f"<pre>{message}</pre>"

    def _state_order(self, state: str) -> int:
        """Get numeric order for state comparison."""
        return {"normal": 0, "warning": 1, "critical": 2}.get(state, 0)
