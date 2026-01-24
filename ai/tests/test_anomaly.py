import pytest
from datetime import datetime, timezone
from ai.anomaly.detector import AnomalyDetector


def test_ph_thresholds():
    detector = AnomalyDetector()
    sensor_id = 1
    ts = datetime.now(timezone.utc)

    # Normal pH
    anomalies = detector.detect_threshold_anomalies(sensor_id, {"ph": 7.0}, ts)
    assert len(anomalies) == 0

    # Warning pH
    anomalies = detector.detect_threshold_anomalies(sensor_id, {"ph": 5.0}, ts)
    assert len(anomalies) == 1
    assert anomalies[0].parameter == "ph"
    assert anomalies[0].detection_method == "threshold_warning"
    assert anomalies[0].anomaly_score == 5.0

    # Critical pH
    anomalies = detector.detect_threshold_anomalies(sensor_id, {"ph": 4.0}, ts)
    assert len(anomalies) == 1
    assert anomalies[0].parameter == "ph"
    assert anomalies[0].detection_method == "threshold_critical"
    assert anomalies[0].anomaly_score == 10.0


def test_turbidity_thresholds():
    detector = AnomalyDetector()
    sensor_id = 1
    ts = datetime.now(timezone.utc)

    # Normal
    anomalies = detector.detect_threshold_anomalies(sensor_id, {"turbidity": 20.0}, ts)
    assert len(anomalies) == 0

    # Warning
    anomalies = detector.detect_threshold_anomalies(sensor_id, {"turbidity": 60.0}, ts)
    assert len(anomalies) == 1
    assert anomalies[0].parameter == "turbidity"
    assert anomalies[0].detection_method == "threshold_warning"

    # Critical
    anomalies = detector.detect_threshold_anomalies(sensor_id, {"turbidity": 150.0}, ts)
    assert len(anomalies) == 1
    assert anomalies[0].parameter == "turbidity"
    assert anomalies[0].detection_method == "threshold_critical"
