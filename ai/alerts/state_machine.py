from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy.orm import Session


@dataclass
class StateChangeResult:
    should_alert: bool
    should_notify: bool
    new_state: Literal["normal", "warning", "critical"]
    previous_state: Literal["normal", "warning", "critical"]
    is_recovery: bool = False
    is_escalation: bool = False


SEVERITY_ORDER = {"normal": 0, "warning": 1, "critical": 2}


class AlertStateMachine:
    def __init__(self, cooldown_minutes: int = 5):
        self.cooldown_minutes = cooldown_minutes

    def process_state_change(
        self,
        sensor_id: int,
        current_state: Literal["normal", "warning", "critical"],
        new_severity: Literal["warning", "critical"] | None,
        last_notification_at: datetime | None = None,
    ) -> StateChangeResult:
        new_state: Literal["normal", "warning", "critical"] = (
            new_severity if new_severity else "normal"
        )

        state_changed = current_state != new_state

        is_recovery = (
            SEVERITY_ORDER.get(current_state, 0) > SEVERITY_ORDER.get(new_state, 0)
            and new_state == "normal"
        )

        is_escalation = current_state == "normal" and new_state == "critical"

        should_alert = state_changed

        should_notify = False
        if should_alert:
            if is_escalation:
                should_notify = True
            elif self._cooldown_expired(last_notification_at):
                should_notify = True

        return StateChangeResult(
            should_alert=should_alert,
            should_notify=should_notify,
            new_state=new_state,
            previous_state=current_state,
            is_recovery=is_recovery,
            is_escalation=is_escalation,
        )

    def _cooldown_expired(self, last_notification_at: datetime | None) -> bool:
        if last_notification_at is None:
            return True

        now = datetime.now(timezone.utc)
        cooldown_threshold = last_notification_at + timedelta(minutes=self.cooldown_minutes)

        return now > cooldown_threshold


def aggregate_sensor_states(states: list[dict]) -> dict:
    normal_count = 0
    warning_count = 0
    critical_count = 0

    for state in states:
        current = state.get("current_state", "normal")
        if current == "normal":
            normal_count += 1
        elif current == "warning":
            warning_count += 1
        elif current == "critical":
            critical_count += 1

    max_severity = None
    if critical_count > 0:
        max_severity = "critical"
    elif warning_count > 0:
        max_severity = "warning"

    return {
        "max_severity": max_severity,
        "normal_count": normal_count,
        "warning_count": warning_count,
        "critical_count": critical_count,
        "total_sensors": len(states),
    }


def create_alert(
    session: Session,
    sensor_id: int,
    severity: Literal["warning", "critical"],
    previous_state: Literal["normal", "warning", "critical"],
    message: str | None = None,
) -> "Alert":
    from db.models import Alert

    alert = Alert(
        sensor_id=sensor_id,
        severity=severity,
        previous_state=previous_state,
        message=message,
    )

    session.add(alert)
    session.commit()

    return alert


def acknowledge_alert(
    session: Session,
    alert_id: int,
    acknowledged_by: str,
) -> "Alert":
    from db.models import Alert

    alert = session.query(Alert).filter(Alert.id == alert_id).first()

    if alert is None:
        raise ValueError(f"Alert {alert_id} not found")

    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by = acknowledged_by

    session.commit()

    return alert
