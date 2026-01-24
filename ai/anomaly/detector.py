import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime
from ai.schemas.alert import AnomalyCreate

# Timeline-specified general water quality thresholds for demos, not AMD-specific.
ANOMALY_THRESHOLDS = {
    "ph": {
        "warning_low": 5.5,  # Warning when pH dips below safe range
        "critical_low": 4.5,  # Critical acidity threshold
        "warning_high": 9.0,  # High pH (less common in AMD)
        "critical_high": 10.0,
    },
    "turbidity": {
        "warning_high": 50.0,  # Elevated turbidity warning
        "critical_high": 100.0,  # Critical turbidity
    },
    "temperature": {
        "warning_high": 35.0,  # High temperature warning
        "critical_high": 40.0,
    },
}


class AnomalyDetector:
    """Hybrid anomaly detection using thresholds and TimeGPT."""

    def __init__(self, timegpt_client=None):
        self.timegpt = timegpt_client

        self.thresholds = ANOMALY_THRESHOLDS

    def detect_threshold_anomalies(
        self, sensor_id: int, reading: Dict[str, float], timestamp: datetime
    ) -> List[AnomalyCreate]:
        """Check reading against static thresholds."""
        anomalies = []

        # Check pH
        if "ph" in reading and reading["ph"] is not None:
            val = reading["ph"]
            if val < self.thresholds["ph"]["critical_low"]:
                anomalies.append(
                    self._create_anomaly(
                        sensor_id, timestamp, "ph", val, 10.0, "threshold_critical"
                    )
                )
            elif val < self.thresholds["ph"]["warning_low"]:
                anomalies.append(
                    self._create_anomaly(sensor_id, timestamp, "ph", val, 5.0, "threshold_warning")
                )

        # Check Turbidity
        if "turbidity" in reading and reading["turbidity"] is not None:
            val = reading["turbidity"]
            if val > self.thresholds["turbidity"]["critical_high"]:
                anomalies.append(
                    self._create_anomaly(
                        sensor_id, timestamp, "turbidity", val, 10.0, "threshold_critical"
                    )
                )
            elif val > self.thresholds["turbidity"]["warning_high"]:
                anomalies.append(
                    self._create_anomaly(
                        sensor_id, timestamp, "turbidity", val, 5.0, "threshold_warning"
                    )
                )

        return anomalies

    def _create_anomaly(
        self,
        sensor_id: int,
        timestamp: datetime,
        param: str,
        value: float,
        score: float,
        method: str,
    ) -> AnomalyCreate:
        return AnomalyCreate(
            sensor_id=sensor_id,
            timestamp=timestamp,
            parameter=param,
            value=value,
            anomaly_score=score,
            detection_method=method,
        )
