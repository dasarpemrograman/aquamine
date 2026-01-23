"""Tests for anomaly detection module."""

import pytest
from unittest.mock import patch
import pandas as pd
from datetime import datetime, timezone

from anomaly import AnomalyDetector, calculate_severity_score


class TestSeverityScoring:
    def test_ph_normal(self):
        assert calculate_severity_score("ph", 6.5) == (1, "normal")
        assert calculate_severity_score("ph", 7.0) == (1, "normal")

    def test_ph_warning(self):
        assert calculate_severity_score("ph", 6.4) == (5, "warning")
        assert calculate_severity_score("ph", 5.5) == (5, "warning")
        assert calculate_severity_score("ph", 5.0) == (6, "warning")
        assert calculate_severity_score("ph", 4.5) == (6, "warning")

    def test_ph_critical(self):
        assert calculate_severity_score("ph", 4.4) == (9, "critical")
        assert calculate_severity_score("ph", 3.0) == (9, "critical")

    def test_turbidity_normal(self):
        assert calculate_severity_score("turbidity", 25) == (1, "normal")

    def test_turbidity_warning(self):
        assert calculate_severity_score("turbidity", 30) == (5, "warning")
        assert calculate_severity_score("turbidity", 50) == (5, "warning")
        assert calculate_severity_score("turbidity", 60) == (6, "warning")

    def test_conductivity_normal(self):
        assert calculate_severity_score("conductivity", 500) == (1, "normal")

    def test_conductivity_warning(self):
        assert calculate_severity_score("conductivity", 600) == (5, "warning")

    def test_conductivity_critical(self):
        assert calculate_severity_score("conductivity", 1001) == (8, "critical")

    def test_temperature_always_normal(self):
        assert calculate_severity_score("temperature", 100) == (0, "normal")


class TestAnomalyDetector:
    @pytest.fixture
    def sample_df(self):
        return pd.DataFrame(
            {
                "timestamp": [datetime.now(timezone.utc)],
                "sensor_id": ["sensor-1"],
                "ph": [5.0],
                "turbidity": [20.0],
                "conductivity": [450.0],
                "temperature": [28.0],
            }
        )

    def test_detect_threshold_returns_anomalies(self, sample_df):
        detector = AnomalyDetector(use_timegpt=False)
        anomalies = detector.detect(sample_df)

        assert len(anomalies) == 1
        assert anomalies[0]["parameter"] == "ph"
        assert anomalies[0]["severity"] == "warning"

    def test_detect_threshold_no_false_positives(self):
        df = pd.DataFrame(
            {
                "timestamp": [datetime.now(timezone.utc)],
                "sensor_id": ["sensor-1"],
                "ph": [7.0],
                "turbidity": [20.0],
                "conductivity": [400.0],
                "temperature": [28.0],
            }
        )

        detector = AnomalyDetector(use_timegpt=False)
        anomalies = detector.detect(df)

        assert len(anomalies) == 0

    def test_detect_critical_values(self):
        df = pd.DataFrame(
            {
                "timestamp": [datetime.now(timezone.utc)],
                "sensor_id": ["sensor-1"],
                "ph": [4.0],
                "turbidity": [20.0],
                "conductivity": [1200],
                "temperature": [28.0],
            }
        )

        detector = AnomalyDetector(use_timegpt=False)
        anomalies = detector.detect(df)

        assert len(anomalies) == 2
        severities = {a["parameter"]: a["severity"] for a in anomalies}
        assert severities["ph"] == "critical"
        assert severities["conductivity"] == "critical"

    def test_detect_empty_dataframe(self):
        detector = AnomalyDetector(use_timegpt=False)
        anomalies = detector.detect(pd.DataFrame())

        assert anomalies == []

    def test_detect_falls_back_when_no_api_key(self):
        with patch.dict("os.environ", {}, clear=True):
            detector = AnomalyDetector(use_timegpt=True)
            assert detector._client is None
