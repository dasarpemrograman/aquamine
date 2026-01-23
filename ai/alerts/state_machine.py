import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from ai.schemas.alert import AlertCreate
from ai.db.models import SensorAlertState

logger = logging.getLogger(__name__)


class AlertStateMachine:
    """
    Manages state transitions: NORMAL -> WARNING -> CRITICAL
    Enforces cooldowns and escalation rules.
    """

    COOLDOWN_MINUTES = 5

    def __init__(self):
        # In-memory cache for fast lookups (sync with DB ideally, but here purely memory for simplicity)
        # In production, this should be Redis or DB-backed
        self.state_cache = {}

    def process_anomaly(self, sensor_id: int, severity: str, message: str) -> Optional[AlertCreate]:
        """
        Decide if an alert should be triggered based on current state and anomaly severity.
        Returns AlertCreate if alert needed, None otherwise.
        """
        current_state_info = self.state_cache.get(
            sensor_id, {"state": "normal", "last_alert_at": None}
        )

        current_state = current_state_info["state"]
        last_alert_at = current_state_info["last_alert_at"]
        now = datetime.now(timezone.utc)

        new_state = severity.lower()  # warning or critical

        # Logic Table
        # 1. State Change (Normal -> Warning/Critical) => ALERT
        # 2. Escalation (Warning -> Critical) => ALERT (Bypass Cooldown)
        # 3. Same State (Warning -> Warning) => CHECK COOLDOWN
        # 4. Recovery (Critical/Warning -> Normal) => Handled separately (process_recovery)

        should_alert = False

        if current_state == "normal":
            # Always alert on first issue
            should_alert = True

        elif current_state == "warning" and new_state == "critical":
            # Escalation: Always alert
            should_alert = True

        elif current_state == new_state:
            # Same state: Check cooldown
            if last_alert_at:
                elapsed = (now - last_alert_at).total_seconds() / 60
                if elapsed >= self.COOLDOWN_MINUTES:
                    should_alert = True
            else:
                should_alert = True

        # If alert triggered, update state
        if should_alert:
            self.state_cache[sensor_id] = {"state": new_state, "last_alert_at": now}
            return AlertCreate(
                sensor_id=sensor_id,
                severity=new_state,
                previous_state=current_state,
                message=message,
            )

        return None

    def process_recovery(self, sensor_id: int) -> Optional[AlertCreate]:
        """Check if sensor recovered to normal."""
        current_state_info = self.state_cache.get(sensor_id)
        if not current_state_info or current_state_info["state"] == "normal":
            return None

        # Transition to normal
        previous_state = current_state_info["state"]
        self.state_cache[sensor_id] = {"state": "normal", "last_alert_at": None}

        return AlertCreate(
            sensor_id=sensor_id,
            severity="info",
            previous_state=previous_state,
            message="Sensor recovered to normal levels.",
        )
