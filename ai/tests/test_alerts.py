from datetime import datetime, timedelta, timezone

from ai.alerts.state_machine import AlertStateMachine


def test_state_machine_transitions():
    sm = AlertStateMachine()
    sensor_id = 1

    state = "normal"
    last_alert_at = None
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)

    # 1. Normal -> Warning
    alert, state, last_alert_at = sm.process_anomaly(
        sensor_id=sensor_id,
        severity="warning",
        message="pH Low",
        current_state=state,
        last_alert_at=last_alert_at,
        now=t0,
    )
    assert alert is not None
    assert alert.severity == "warning"
    assert alert.previous_state == "normal"
    assert state == "warning"
    assert last_alert_at == t0

    # 2. Warning -> Warning (Rapid, < 5 min)
    # Should be suppressed by cooldown
    alert, state, last_alert_at_2 = sm.process_anomaly(
        sensor_id=sensor_id,
        severity="warning",
        message="pH Low",
        current_state=state,
        last_alert_at=last_alert_at,
        now=t0 + timedelta(minutes=1),
    )
    assert alert is None
    assert state == "warning"
    assert last_alert_at_2 == last_alert_at

    # 3. Warning -> Critical (Escalation)
    # Should bypass cooldown
    alert, state, last_alert_at = sm.process_anomaly(
        sensor_id=sensor_id,
        severity="critical",
        message="pH Critical",
        current_state=state,
        last_alert_at=last_alert_at,
        now=t0 + timedelta(minutes=2),
    )
    assert alert is not None
    assert alert.severity == "critical"
    assert alert.previous_state == "warning"
    assert state == "critical"
    assert last_alert_at == t0 + timedelta(minutes=2)

    # 4. Critical -> Normal (Recovery)
    alert, state, last_alert_at = sm.process_recovery(
        sensor_id=sensor_id,
        current_state=state,
        last_alert_at=last_alert_at,
        now=t0 + timedelta(minutes=3),
    )
    assert alert is not None
    assert alert.severity == "info"
    assert alert.previous_state == "critical"
    assert state == "normal"
    assert last_alert_at == t0 + timedelta(minutes=3)

    # 5. Normal -> Normal
    alert, state, last_alert_at_2 = sm.process_recovery(
        sensor_id=sensor_id,
        current_state=state,
        last_alert_at=last_alert_at,
        now=t0 + timedelta(minutes=4),
    )
    assert alert is None
    assert state == "normal"
    assert last_alert_at_2 == last_alert_at


def test_cooldown_expiration():
    sm = AlertStateMachine()
    sensor_id = 2

    state = "normal"
    last_alert_at = None
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)

    # Initial alert
    alert, state, last_alert_at = sm.process_anomaly(
        sensor_id=sensor_id,
        severity="warning",
        message="msg",
        current_state=state,
        last_alert_at=last_alert_at,
        now=t0,
    )
    assert alert is not None

    # Should alert again after 6 minutes
    alert, state, last_alert_at = sm.process_anomaly(
        sensor_id=sensor_id,
        severity="warning",
        message="msg",
        current_state=state,
        last_alert_at=last_alert_at,
        now=t0 + timedelta(minutes=6),
    )
    assert alert is not None
    assert state == "warning"
    assert last_alert_at == t0 + timedelta(minutes=6)
