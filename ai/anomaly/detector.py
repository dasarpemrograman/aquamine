from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy.orm import Session


@dataclass
class AnomalyResult:
    parameter: str
    value: float
    is_anomaly: bool
    severity: Literal["warning", "critical"] | None
    score: float
    detection_method: str = "threshold"


THRESHOLDS = {
    "ph": {
        "warning_low": 5.5,
        "critical_low": 4.5,
        "warning_high": 8.5,
        "critical_high": 9.5,
    },
    "turbidity": {
        "warning_high": 50.0,
        "critical_high": 100.0,
    },
    "temperature": {
        "warning_low": 10.0,
        "critical_low": 5.0,
        "warning_high": 35.0,
        "critical_high": 40.0,
    },
}


def detect_anomaly(parameter: str, value: float) -> AnomalyResult:
    thresholds = THRESHOLDS.get(parameter, {})

    if not thresholds:
        return AnomalyResult(
            parameter=parameter,
            value=value,
            is_anomaly=False,
            severity=None,
            score=0.0,
        )

    severity = None
    score = 0.0

    critical_low = thresholds.get("critical_low")
    warning_low = thresholds.get("warning_low")
    warning_high = thresholds.get("warning_high")
    critical_high = thresholds.get("critical_high")

    if critical_low is not None and value < critical_low:
        severity = "critical"
        score = min(10.0, (critical_low - value) * 2 + 7)
    elif warning_low is not None and value < warning_low:
        severity = "warning"
        score = min(6.9, (warning_low - value) * 2 + 3)
    elif critical_high is not None and value > critical_high:
        severity = "critical"
        score = min(10.0, (value - critical_high) * 2 + 7)
    elif warning_high is not None and value > warning_high:
        severity = "warning"
        score = min(6.9, (value - warning_high) * 0.1 + 3)

    return AnomalyResult(
        parameter=parameter,
        value=value,
        is_anomaly=severity is not None,
        severity=severity,
        score=round(score, 2),
    )


class AnomalyDetector:
    def __init__(self):
        self.thresholds = THRESHOLDS

    def analyze_reading(
        self,
        ph: float | None = None,
        turbidity: float | None = None,
        temperature: float | None = None,
    ) -> list[AnomalyResult]:
        results = []

        if ph is not None:
            results.append(detect_anomaly("ph", ph))
        if turbidity is not None:
            results.append(detect_anomaly("turbidity", turbidity))
        if temperature is not None:
            results.append(detect_anomaly("temperature", temperature))

        return results

    def get_max_severity(
        self,
        ph: float | None = None,
        turbidity: float | None = None,
        temperature: float | None = None,
    ) -> Literal["warning", "critical"] | None:
        results = self.analyze_reading(ph=ph, turbidity=turbidity, temperature=temperature)

        severities = [r.severity for r in results if r.severity is not None]

        if not severities:
            return None

        if "critical" in severities:
            return "critical"
        return "warning"


def store_anomaly(
    session: Session,
    sensor_id: int,
    timestamp: datetime,
    parameter: str,
    value: float,
    anomaly_score: float,
    detection_method: str = "threshold",
) -> "Anomaly":
    from db.models import Anomaly

    anomaly = Anomaly(
        sensor_id=sensor_id,
        timestamp=timestamp,
        parameter=parameter,
        value=value,
        anomaly_score=anomaly_score,
        detection_method=detection_method,
    )

    session.add(anomaly)
    session.commit()

    return anomaly
