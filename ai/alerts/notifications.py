import os
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session


def format_whatsapp_message(
    sensor_name: str,
    severity: str,
    ph_value: float | None = None,
    turbidity_value: float | None = None,
    temperature_value: float | None = None,
    timestamp: datetime | None = None,
) -> str:
    emoji = "🚨" if severity == "critical" else "⚠️"
    severity_display = severity.upper()

    ts_str = timestamp.strftime("%Y-%m-%d %H:%M:%S UTC") if timestamp else "N/A"

    lines = [
        f"{emoji} ALERT: AquaMine AI",
        "━━━━━━━━━━━━━━━━━━",
        f"📍 Sensor: {sensor_name}",
        f"⚠️ Status: {severity_display}",
    ]

    if ph_value is not None:
        lines.append(f"📊 pH: {ph_value}")
    if turbidity_value is not None:
        lines.append(f"💧 Turbidity: {turbidity_value} NTU")
    if temperature_value is not None:
        lines.append(f"🌡️ Temperature: {temperature_value}°C")

    lines.extend(
        [
            f"🕐 Time: {ts_str}",
            "",
            _get_recommendation(severity, ph_value),
            "━━━━━━━━━━━━━━━━━━",
        ]
    )

    return "\n".join(lines)


def _get_recommendation(severity: str, ph_value: float | None) -> str:
    if severity == "critical":
        return "⚡ IMMEDIATE ACTION REQUIRED: Check sensor and water source immediately."
    elif severity == "warning":
        return "📋 Monitor closely and prepare mitigation measures."
    return "✅ System operating normally."


def send_whatsapp(
    phone: str,
    message: str,
    api_token: str | None = None,
) -> dict[str, Any]:
    token = api_token or os.getenv("FONNTE_API_TOKEN")

    if not token:
        return {"success": False, "error": "FONNTE_API_TOKEN not configured"}

    try:
        response = httpx.post(
            "https://api.fonnte.com/send",
            headers={"Authorization": token},
            data={
                "target": phone,
                "message": message,
            },
            timeout=30.0,
        )

        data = response.json()
        return {
            "success": response.status_code == 200 and data.get("status", False),
            "response": data,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def format_email_html(
    sensor_name: str,
    severity: str,
    ph_value: float | None = None,
    turbidity_value: float | None = None,
    temperature_value: float | None = None,
    timestamp: datetime | None = None,
) -> str:
    severity_color = "#dc2626" if severity == "critical" else "#f59e0b"
    ts_str = timestamp.strftime("%Y-%m-%d %H:%M:%S UTC") if timestamp else "N/A"

    readings_html = ""
    if ph_value is not None:
        readings_html += f"<tr><td>pH</td><td><strong>{ph_value}</strong></td></tr>"
    if turbidity_value is not None:
        readings_html += (
            f"<tr><td>Turbidity</td><td><strong>{turbidity_value} NTU</strong></td></tr>"
        )
    if temperature_value is not None:
        readings_html += (
            f"<tr><td>Temperature</td><td><strong>{temperature_value}°C</strong></td></tr>"
        )

    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: {severity_color}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">AquaMine Alert</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">{severity.upper()}</p>
        </div>
        
        <div style="padding: 20px; background: #f9fafb;">
            <h2 style="color: #1f2937;">Sensor: {sensor_name}</h2>
            <p style="color: #6b7280;">Alert triggered at {ts_str}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #e5e7eb;">
                        <th style="padding: 10px; text-align: left;">Parameter</th>
                        <th style="padding: 10px; text-align: left;">Value</th>
                    </tr>
                </thead>
                <tbody>
                    {readings_html}
                </tbody>
            </table>
            
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <strong>Recommendation:</strong><br>
                {_get_recommendation(severity, ph_value)}
            </div>
        </div>
        
        <div style="background: #1f2937; color: white; padding: 15px; text-align: center;">
            <p style="margin: 0;">AquaMine AI - Early Warning System</p>
        </div>
    </div>
    """


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    api_key: str | None = None,
) -> dict[str, Any]:
    api_key = api_key or os.getenv("RESEND_API_KEY")

    if not api_key:
        return {"success": False, "error": "RESEND_API_KEY not configured"}

    try:
        import resend

        resend.api_key = api_key

        result = resend.Emails.send(
            {
                "from": "AquaMine AI <alerts@aquamine.id>",
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }
        )

        return {"success": True, "email_id": result.get("id")}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_active_recipients(
    session: Session,
    severity: str,
) -> list:
    from db.models import NotificationRecipient

    query = session.query(NotificationRecipient).filter(NotificationRecipient.is_active == True)

    if severity == "warning":
        query = query.filter(NotificationRecipient.notify_warning == True)
    elif severity == "critical":
        query = query.filter(NotificationRecipient.notify_critical == True)

    return query.all()


class NotificationService:
    def __init__(
        self,
        fonnte_token: str | None = None,
        resend_api_key: str | None = None,
    ):
        self.fonnte_token = fonnte_token or os.getenv("FONNTE_API_TOKEN")
        self.resend_api_key = resend_api_key or os.getenv("RESEND_API_KEY")

    def notify_all(
        self,
        recipients: list[dict],
        sensor_name: str,
        severity: str,
        ph_value: float | None = None,
        turbidity_value: float | None = None,
        temperature_value: float | None = None,
        timestamp: datetime | None = None,
    ) -> list[dict[str, Any]]:
        results = []

        for recipient in recipients:
            phone = recipient.get("phone")
            email = recipient.get("email")

            if phone:
                wa_result = self._send_whatsapp(
                    phone=phone,
                    sensor_name=sensor_name,
                    severity=severity,
                    ph_value=ph_value,
                    turbidity_value=turbidity_value,
                    temperature_value=temperature_value,
                    timestamp=timestamp,
                )
                results.append({"type": "whatsapp", "recipient": phone, **wa_result})

            if email:
                email_result = self._send_email(
                    to_email=email,
                    sensor_name=sensor_name,
                    severity=severity,
                    ph_value=ph_value,
                    turbidity_value=turbidity_value,
                    temperature_value=temperature_value,
                    timestamp=timestamp,
                )
                results.append({"type": "email", "recipient": email, **email_result})

        return results

    def _send_whatsapp(
        self,
        phone: str,
        sensor_name: str,
        severity: str,
        **kwargs,
    ) -> dict[str, Any]:
        message = format_whatsapp_message(
            sensor_name=sensor_name,
            severity=severity,
            **kwargs,
        )
        return send_whatsapp(phone=phone, message=message, api_token=self.fonnte_token)

    def _send_email(
        self,
        to_email: str,
        sensor_name: str,
        severity: str,
        **kwargs,
    ) -> dict[str, Any]:
        html = format_email_html(
            sensor_name=sensor_name,
            severity=severity,
            **kwargs,
        )
        subject = f"[{severity.upper()}] AquaMine Alert - {sensor_name}"
        return send_email(
            to_email=to_email,
            subject=subject,
            html_content=html,
            api_key=self.resend_api_key,
        )
