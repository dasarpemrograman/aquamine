from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from ai.schemas.alert import AlertCreate


class AlertStateMachine:
    """Pure state transition logic for alerts.

    Persistence is handled by the caller (DB-backed `sensor_alert_state`).
    """

    COOLDOWN_MINUTES = 5

    def _as_utc(self, dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    def process_anomaly(
        self,
        *,
        sensor_id: int,
        severity: str,
        message: str,
        current_state: str,
        last_alert_at: Optional[datetime],
        now: Optional[datetime] = None,
    ) -> tuple[Optional[AlertCreate], str, Optional[datetime]]:
        """Process an anomaly and decide whether to emit an alert.

        Returns: (alert_or_none, new_state, new_last_alert_at)
        """

        normalized_current = (current_state or "normal").lower()
        normalized_new = (severity or "normal").lower()
        now_dt = self._as_utc(now or datetime.now(timezone.utc))

        should_alert = False

        if normalized_current == "normal" and normalized_new in {"warning", "critical"}:
            should_alert = True
        elif normalized_current == "warning" and normalized_new == "critical":
            should_alert = True
        elif normalized_current == normalized_new and normalized_new in {"warning", "critical"}:
            if last_alert_at is None:
                should_alert = True
            else:
                elapsed = (now_dt - self._as_utc(last_alert_at)).total_seconds() / 60
                if elapsed >= self.COOLDOWN_MINUTES:
                    should_alert = True

        if not should_alert:
            return None, normalized_current, last_alert_at

        alert = AlertCreate(
            sensor_id=sensor_id,
            severity=normalized_new,
            previous_state=normalized_current,
            message=message,
        )
        return alert, normalized_new, now_dt

    def process_recovery(
        self,
        *,
        sensor_id: int,
        current_state: str,
        last_alert_at: Optional[datetime],
        now: Optional[datetime] = None,
    ) -> tuple[Optional[AlertCreate], str, Optional[datetime]]:
        """Emit a one-time recovery alert when transitioning back to normal."""

        normalized_current = (current_state or "normal").lower()
        if normalized_current == "normal":
            return None, "normal", last_alert_at

        now_dt = self._as_utc(now or datetime.now(timezone.utc))
        alert = AlertCreate(
            sensor_id=sensor_id,
            severity="info",
            previous_state=normalized_current,
            message="Sensor recovered to normal levels.",
        )
        return alert, "normal", now_dt
