import pytest
from datetime import datetime, timezone


class TestThresholdDetection:
    def test_ph_6_no_anomaly(self):
        from anomaly.detector import detect_anomaly

        result = detect_anomaly(parameter="ph", value=6.0)

        assert result.is_anomaly is False
        assert result.severity is None

    def test_ph_5_3_warning_detected(self):
        from anomaly.detector import detect_anomaly

        result = detect_anomaly(parameter="ph", value=5.3)

        assert result.is_anomaly is True
        assert result.severity == "warning"

    def test_ph_4_2_critical_detected(self):
        from anomaly.detector import detect_anomaly

        result = detect_anomaly(parameter="ph", value=4.2)

        assert result.is_anomaly is True
        assert result.severity == "critical"

    def test_turbidity_60_warning_detected(self):
        from anomaly.detector import detect_anomaly

        result = detect_anomaly(parameter="turbidity", value=60.0)

        assert result.is_anomaly is True
        assert result.severity == "warning"

    def test_turbidity_120_critical_detected(self):
        from anomaly.detector import detect_anomaly

        result = detect_anomaly(parameter="turbidity", value=120.0)

        assert result.is_anomaly is True
        assert result.severity == "critical"

    def test_temperature_normal_no_anomaly(self):
        from anomaly.detector import detect_anomaly

        result = detect_anomaly(parameter="temperature", value=28.0)

        assert result.is_anomaly is False

    def test_temperature_high_warning(self):
        from anomaly.detector import detect_anomaly

        result = detect_anomaly(parameter="temperature", value=38.0)

        assert result.is_anomaly is True
        assert result.severity == "warning"


class TestAnomalyScore:
    def test_anomaly_score_calculated_correctly(self):
        from anomaly.detector import detect_anomaly

        result_warning = detect_anomaly(parameter="ph", value=5.3)
        result_critical = detect_anomaly(parameter="ph", value=4.0)

        assert 0 <= result_warning.score <= 10
        assert 0 <= result_critical.score <= 10
        assert result_critical.score > result_warning.score

    def test_normal_reading_zero_score(self):
        from anomaly.detector import detect_anomaly

        result = detect_anomaly(parameter="ph", value=7.0)

        assert result.score == 0.0


class TestAnomalyDetector:
    def test_detect_from_reading(self):
        from anomaly.detector import AnomalyDetector

        detector = AnomalyDetector()
        results = detector.analyze_reading(
            ph=4.2,
            turbidity=80.0,
            temperature=28.0,
        )

        assert len(results) == 3
        ph_result = next(r for r in results if r.parameter == "ph")
        assert ph_result.is_anomaly is True
        assert ph_result.severity == "critical"

        turbidity_result = next(r for r in results if r.parameter == "turbidity")
        assert turbidity_result.is_anomaly is True
        assert turbidity_result.severity == "warning"

    def test_returns_max_severity(self):
        from anomaly.detector import AnomalyDetector

        detector = AnomalyDetector()
        max_severity = detector.get_max_severity(
            ph=5.3,
            turbidity=120.0,
            temperature=28.0,
        )

        assert max_severity == "critical"

    def test_all_normal_returns_none(self):
        from anomaly.detector import AnomalyDetector

        detector = AnomalyDetector()
        max_severity = detector.get_max_severity(
            ph=7.0,
            turbidity=25.0,
            temperature=27.0,
        )

        assert max_severity is None


class TestAnomalyStorage:
    def test_anomaly_stored_in_database(self, db_session):
        from anomaly.detector import store_anomaly
        from db.models import Sensor, Anomaly

        sensor = Sensor(sensor_id="ANOMALY_TEST", name="Anomaly Test Sensor")
        db_session.add(sensor)
        db_session.commit()

        anomaly = store_anomaly(
            db_session,
            sensor_id=sensor.id,
            timestamp=datetime.now(timezone.utc),
            parameter="ph",
            value=4.2,
            anomaly_score=8.5,
            detection_method="threshold",
        )

        assert anomaly.id is not None
        assert anomaly.parameter == "ph"
        assert anomaly.anomaly_score == 8.5
