import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch


class TestAlertStateTransitions:
    def test_normal_to_warning_triggers_alert(self):
        from alerts.state_machine import AlertStateMachine

        machine = AlertStateMachine()
        result = machine.process_state_change(
            sensor_id=1,
            current_state="normal",
            new_severity="warning",
        )

        assert result.should_alert is True
        assert result.new_state == "warning"
        assert result.previous_state == "normal"

    def test_warning_to_warning_no_new_alert(self):
        from alerts.state_machine import AlertStateMachine

        machine = AlertStateMachine()
        result = machine.process_state_change(
            sensor_id=1,
            current_state="warning",
            new_severity="warning",
        )

        assert result.should_alert is False
        assert result.new_state == "warning"

    def test_normal_to_critical_triggers_alert(self):
        from alerts.state_machine import AlertStateMachine

        machine = AlertStateMachine()
        result = machine.process_state_change(
            sensor_id=1,
            current_state="normal",
            new_severity="critical",
        )

        assert result.should_alert is True
        assert result.new_state == "critical"

    def test_critical_to_normal_triggers_recovery_alert(self):
        from alerts.state_machine import AlertStateMachine

        machine = AlertStateMachine()
        result = machine.process_state_change(
            sensor_id=1,
            current_state="critical",
            new_severity=None,
        )

        assert result.should_alert is True
        assert result.new_state == "normal"
        assert result.is_recovery is True


class TestCooldownLogic:
    def test_cooldown_prevents_rapid_alerts(self):
        from alerts.state_machine import AlertStateMachine

        machine = AlertStateMachine(cooldown_minutes=5)

        first_result = machine.process_state_change(
            sensor_id=1,
            current_state="normal",
            new_severity="warning",
            last_notification_at=None,
        )
        assert first_result.should_notify is True

        recent_time = datetime.now(timezone.utc) - timedelta(minutes=2)
        second_result = machine.process_state_change(
            sensor_id=1,
            current_state="warning",
            new_severity="warning",
            last_notification_at=recent_time,
        )
        assert second_result.should_notify is False

    def test_cooldown_expired_allows_notification(self):
        from alerts.state_machine import AlertStateMachine

        machine = AlertStateMachine(cooldown_minutes=5)

        old_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        result = machine.process_state_change(
            sensor_id=1,
            current_state="normal",
            new_severity="warning",
            last_notification_at=old_time,
        )

        assert result.should_notify is True

    def test_escalation_bypasses_cooldown(self):
        from alerts.state_machine import AlertStateMachine

        machine = AlertStateMachine(cooldown_minutes=5)

        recent_time = datetime.now(timezone.utc) - timedelta(minutes=2)
        result = machine.process_state_change(
            sensor_id=1,
            current_state="normal",
            new_severity="critical",
            last_notification_at=recent_time,
        )

        assert result.should_notify is True


class TestMultiSensorAggregation:
    def test_aggregation_returns_max_severity(self):
        from alerts.state_machine import aggregate_sensor_states

        states = [
            {"sensor_id": 1, "current_state": "warning"},
            {"sensor_id": 2, "current_state": "critical"},
            {"sensor_id": 3, "current_state": "normal"},
        ]

        result = aggregate_sensor_states(states)

        assert result["max_severity"] == "critical"
        assert result["warning_count"] == 1
        assert result["critical_count"] == 1
        assert result["normal_count"] == 1

    def test_all_normal_returns_normal(self):
        from alerts.state_machine import aggregate_sensor_states

        states = [
            {"sensor_id": 1, "current_state": "normal"},
            {"sensor_id": 2, "current_state": "normal"},
        ]

        result = aggregate_sensor_states(states)

        assert result["max_severity"] is None
        assert result["normal_count"] == 2


class TestAlertStorage:
    def test_alert_created_in_database(self, db_session):
        from alerts.state_machine import create_alert
        from db.models import Sensor, Alert

        sensor = Sensor(sensor_id="ALERT_TEST", name="Alert Test Sensor")
        db_session.add(sensor)
        db_session.commit()

        alert = create_alert(
            db_session,
            sensor_id=sensor.id,
            severity="warning",
            previous_state="normal",
            message="pH dropped below threshold",
        )

        assert alert.id is not None
        assert alert.severity == "warning"
        assert alert.previous_state == "normal"

    def test_alert_acknowledged(self, db_session):
        from alerts.state_machine import create_alert, acknowledge_alert
        from db.models import Sensor

        sensor = Sensor(sensor_id="ACK_TEST", name="Ack Test Sensor")
        db_session.add(sensor)
        db_session.commit()

        alert = create_alert(
            db_session,
            sensor_id=sensor.id,
            severity="critical",
            previous_state="warning",
            message="Critical pH level",
        )

        acknowledged = acknowledge_alert(db_session, alert.id, acknowledged_by="admin@aquamine.id")

        assert acknowledged.acknowledged_at is not None
        assert acknowledged.acknowledged_by == "admin@aquamine.id"
