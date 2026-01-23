from collections import defaultdict
from typing import Optional


class AlertStateMachine:
    """
    Track alert states per sensor with deduplication.

    Only triggers notification on state CHANGE (normal→warning, warning→critical, etc.)
    """

    def __init__(self):
        """Initialize with empty state tracking."""
        self.sensor_states: dict[str, str] = {}  # sensor_id -> state

    def aggregate_anomalies(self, anomalies: list[dict]) -> dict[str, dict]:
        """
        Group anomalies by sensor_id and compute max severity.

        Args:
            anomalies: List of AnomalyItem dicts with keys:
                       sensor_id, parameter, value, severity, severity_score, reason

        Returns:
            dict[sensor_id] -> {sensor_id, severity_score, state, anomalies}
        """
        by_sensor: dict[str, list[dict]] = defaultdict(list)
        for a in anomalies:
            by_sensor[a["sensor_id"]].append(a)

        result = {}
        for sensor_id, sensor_anomalies in by_sensor.items():
            max_score = max(a["severity_score"] for a in sensor_anomalies)
            max_state = self._score_to_state(max_score)
            result[sensor_id] = {
                "sensor_id": sensor_id,
                "severity_score": max_score,
                "state": max_state,
                "anomalies": sensor_anomalies,
            }
        return result

    def process_aggregated(self, aggregated: dict) -> tuple[bool, Optional[dict]]:
        """
        Process aggregated anomalies for a single sensor.

        Args:
            aggregated: Output from aggregate_anomalies for one sensor
                        {sensor_id, severity_score, state, anomalies}

        Returns:
            (should_notify, AlertInfo dict or None)
            AlertInfo: {sensor_id, old_state, new_state, severity_score, anomalies}
        """
        sensor_id = aggregated["sensor_id"]
        new_state = aggregated["state"]
        old_state = self.sensor_states.get(sensor_id, "normal")

        # Always update state
        self.sensor_states[sensor_id] = new_state

        # Only notify on state CHANGE
        if old_state != new_state:
            return True, {
                "sensor_id": sensor_id,
                "old_state": old_state,
                "new_state": new_state,
                "severity_score": aggregated["severity_score"],
                "anomalies": aggregated["anomalies"],
            }
        return False, None

    def get_state(self, sensor_id: str) -> str:
        """Get current state for a sensor."""
        return self.sensor_states.get(sensor_id, "normal")

    def get_all_states(self) -> dict[str, str]:
        """Get all current sensor states."""
        return dict(self.sensor_states)

    def reset(self):
        """Clear all state (for testing)."""
        self.sensor_states.clear()

    def _score_to_state(self, score: int) -> str:
        """Convert severity score to state."""
        if score <= 3:
            return "normal"
        elif score <= 6:
            return "warning"
        return "critical"
