import pytest
from datetime import datetime, timedelta, timezone
from ai.alerts.state_machine import AlertStateMachine


def test_state_machine_transitions():
    sm = AlertStateMachine()
    sensor_id = 1

    # 1. Normal -> Warning
    alert = sm.process_anomaly(sensor_id, "warning", "pH Low")
    assert alert is not None
    assert alert.severity == "warning"
    assert alert.previous_state == "normal"

    # 2. Warning -> Warning (Rapid, < 5 min)
    # Should be suppressed by cooldown
    alert = sm.process_anomaly(sensor_id, "warning", "pH Low")
    assert alert is None

    # 3. Warning -> Critical (Escalation)
    # Should bypass cooldown
    alert = sm.process_anomaly(sensor_id, "critical", "pH Critical")
    assert alert is not None
    assert alert.severity == "critical"
    assert alert.previous_state == "warning"

    # 4. Critical -> Normal (Recovery)
    alert = sm.process_recovery(sensor_id)
    assert alert is not None
    assert alert.severity == "info"
    assert alert.previous_state == "critical"

    # 5. Normal -> Normal
    alert = sm.process_recovery(sensor_id)
    assert alert is None


def test_cooldown_expiration():
    sm = AlertStateMachine()
    sensor_id = 2

    # Initial alert
    sm.process_anomaly(sensor_id, "warning", "msg")

    # Manually backdate the last_alert_at
    sm.state_cache[sensor_id]["last_alert_at"] = datetime.now(timezone.utc) - timedelta(minutes=6)

    # Should alert again after 6 minutes
    alert = sm.process_anomaly(sensor_id, "warning", "msg")
    assert alert is not None
