"""Tests for alert state machine."""

import pytest
from alerts import AlertStateMachine


class TestAlertStateMachine:
    @pytest.fixture
    def state_machine(self):
        return AlertStateMachine()

    def test_aggregate_single_anomaly(self, state_machine):
        anomalies = [
            {
                "sensor_id": "sensor-1",
                "parameter": "ph",
                "value": 5.0,
                "severity": "warning",
                "severity_score": 6,
                "reason": "pH low",
            }
        ]

        result = state_machine.aggregate_anomalies(anomalies)

        assert "sensor-1" in result
        assert result["sensor-1"]["severity_score"] == 6
        assert result["sensor-1"]["state"] == "warning"
        assert len(result["sensor-1"]["anomalies"]) == 1

    def test_aggregate_multiple_anomalies_same_sensor(self, state_machine):
        anomalies = [
            {
                "sensor_id": "sensor-1",
                "parameter": "ph",
                "value": 5.0,
                "severity": "warning",
                "severity_score": 5,
                "reason": "pH low",
            },
            {
                "sensor_id": "sensor-1",
                "parameter": "conductivity",
                "value": 1200,
                "severity": "critical",
                "severity_score": 8,
                "reason": "Conductivity high",
            },
        ]

        result = state_machine.aggregate_anomalies(anomalies)

        assert result["sensor-1"]["severity_score"] == 8
        assert result["sensor-1"]["state"] == "critical"
        assert len(result["sensor-1"]["anomalies"]) == 2

    def test_aggregate_multiple_sensors(self, state_machine):
        anomalies = [
            {
                "sensor_id": "sensor-1",
                "parameter": "ph",
                "value": 5.0,
                "severity": "warning",
                "severity_score": 5,
                "reason": "...",
            },
            {
                "sensor_id": "sensor-2",
                "parameter": "conductivity",
                "value": 1200,
                "severity": "critical",
                "severity_score": 8,
                "reason": "...",
            },
        ]

        result = state_machine.aggregate_anomalies(anomalies)

        assert len(result) == 2
        assert result["sensor-1"]["state"] == "warning"
        assert result["sensor-2"]["state"] == "critical"

    def test_process_first_warning_notifies(self, state_machine):
        aggregated = {
            "sensor_id": "sensor-1",
            "severity_score": 5,
            "state": "warning",
            "anomalies": [{"parameter": "ph", "value": 5.5}],
        }

        should_notify, alert_info = state_machine.process_aggregated(aggregated)

        assert should_notify is True
        assert alert_info["old_state"] == "normal"
        assert alert_info["new_state"] == "warning"

    def test_process_same_state_no_notify(self, state_machine):
        aggregated = {
            "sensor_id": "sensor-1",
            "severity_score": 5,
            "state": "warning",
            "anomalies": [],
        }

        state_machine.process_aggregated(aggregated)
        should_notify, alert_info = state_machine.process_aggregated(aggregated)

        assert should_notify is False
        assert alert_info is None

    def test_process_escalation_notifies(self, state_machine):
        state_machine.sensor_states["sensor-1"] = "warning"

        aggregated = {
            "sensor_id": "sensor-1",
            "severity_score": 9,
            "state": "critical",
            "anomalies": [],
        }

        should_notify, alert_info = state_machine.process_aggregated(aggregated)

        assert should_notify is True
        assert alert_info["old_state"] == "warning"
        assert alert_info["new_state"] == "critical"

    def test_process_recovery_notifies(self, state_machine):
        state_machine.sensor_states["sensor-1"] = "critical"

        aggregated = {
            "sensor_id": "sensor-1",
            "severity_score": 5,
            "state": "warning",
            "anomalies": [],
        }

        should_notify, alert_info = state_machine.process_aggregated(aggregated)

        assert should_notify is True
        assert alert_info["old_state"] == "critical"
        assert alert_info["new_state"] == "warning"

    def test_score_to_state_normal(self, state_machine):
        assert state_machine._score_to_state(0) == "normal"
        assert state_machine._score_to_state(1) == "normal"
        assert state_machine._score_to_state(3) == "normal"

    def test_score_to_state_warning(self, state_machine):
        assert state_machine._score_to_state(4) == "warning"
        assert state_machine._score_to_state(5) == "warning"
        assert state_machine._score_to_state(6) == "warning"

    def test_score_to_state_critical(self, state_machine):
        assert state_machine._score_to_state(7) == "critical"
        assert state_machine._score_to_state(8) == "critical"
        assert state_machine._score_to_state(10) == "critical"

    def test_get_state_unknown_sensor(self, state_machine):
        assert state_machine.get_state("unknown-sensor") == "normal"

    def test_get_all_states(self, state_machine):
        state_machine.sensor_states["sensor-1"] = "warning"
        state_machine.sensor_states["sensor-2"] = "critical"

        states = state_machine.get_all_states()

        assert states == {"sensor-1": "warning", "sensor-2": "critical"}

    def test_reset(self, state_machine):
        state_machine.sensor_states["sensor-1"] = "warning"
        state_machine.reset()

        assert state_machine.get_all_states() == {}
