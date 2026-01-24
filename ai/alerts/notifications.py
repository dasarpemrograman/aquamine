import os
import asyncio
import httpx
import logging
import resend
from typing import List
from ai.schemas.alert import AlertCreate, RecipientBase

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self):
        self.fonnte_token = os.getenv("FONNTE_API_TOKEN")
        self.resend_key = os.getenv("RESEND_API_KEY")

        if self.resend_key:
            resend.api_key = self.resend_key
        else:
            logger.warning("RESEND_API_KEY not found. Email notifications disabled.")

    async def send_notifications(self, alert: AlertCreate, recipients: List[RecipientBase]):
        """Send notifications to all active recipients via configured channels."""

        for recipient in recipients:
            if not recipient.is_active:
                continue

            # Check preferences
            if alert.severity == "warning" and not recipient.notify_warning:
                continue
            if alert.severity == "critical" and not recipient.notify_critical:
                continue

            # Send WhatsApp
            if recipient.phone and self.fonnte_token:
                await self.send_whatsapp(recipient.phone, alert)

            # Send Email
            if recipient.email and self.resend_key:
                await self.send_email(recipient.email, alert)

    async def send_whatsapp(self, phone: str, alert: AlertCreate):
        """Send WhatsApp message using Fonnte."""
        message = (
            f"🚨 *AQUAMINE ALERT*\n"
            f"📍 Sensor: {alert.sensor_id}\n"
            f"⚠️ Severity: *{alert.severity.upper()}*\n"
            f"📝 Message: {alert.message}\n"
            f"🕒 Time: {os.getenv('TZ', 'UTC')}"
        )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.fonnte.com/send",
                    headers={"Authorization": self.fonnte_token},
                    data={
                        "target": phone,
                        "message": message,
                    },
                    timeout=10.0,
                )
                if response.status_code != 200:
                    logger.error(f"Fonnte Error: {response.text}")
                else:
                    logger.info(f"WhatsApp sent to {phone}")
        except Exception as e:
            logger.error(f"WhatsApp Send Error: {e}")

    async def send_email(self, email: str, alert: AlertCreate):
        """Send Email using Resend."""
        subject = f"[{alert.severity.upper()}] AquaMine Alert - Sensor {alert.sensor_id}"

        html_content = f"""
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
            <h2 style="color: {"#e11d48" if alert.severity == "critical" else "#f59e0b"};">
                {alert.severity.upper()} ALERT
            </h2>
            <p><strong>Sensor ID:</strong> {alert.sensor_id}</p>
            <p><strong>Message:</strong> {alert.message}</p>
            <p><strong>Previous State:</strong> {alert.previous_state}</p>
            <hr>
            <p><small>AquaMine AI Monitoring System</small></p>
            <a href="{os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:3000")}/alerts" 
               style="background: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
               View Dashboard
            </a>
        </div>
        """

        try:
            # Resend SDK is sync, but we wrap it or just call it directly (it's fast)
            # ideally run in threadpool if blocking
            params = {
                "from": "AquaMine Alert <alerts@draftanakitb.tech>",
                "to": [email],
                "subject": subject,
                "html": html_content,
            }

            await asyncio.to_thread(resend.Emails.send, params)
            logger.info(f"Email sent to {email}")
        except Exception as e:
            logger.error(f"Email Send Error: {e}")
