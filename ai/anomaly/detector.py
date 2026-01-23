"""Anomaly detection for water quality data."""

import os
from typing import Optional

import pandas as pd

from .scoring import calculate_severity_score


class AnomalyDetector:
    """Detect anomalies in water quality data."""

    def __init__(self, use_timegpt: bool = True, api_key: Optional[str] = None):
        """
        Initialize detector.

        Args:
            use_timegpt: Whether to try TimeGPT first (falls back to thresholds)
            api_key: Nixtla API key. If None, reads from NIXTLA_API_KEY env var.
        """
        self.use_timegpt = use_timegpt
        self.api_key = api_key or os.getenv("NIXTLA_API_KEY")
        self._client = None

        if self.use_timegpt and self.api_key:
            try:
                from nixtla import NixtlaClient

                self._client = NixtlaClient(api_key=self.api_key)
            except ImportError:
                self._client = None

    def detect(self, df: pd.DataFrame) -> list[dict]:
        """
        Detect anomalies in the data.

        Args:
            df: DataFrame with columns [timestamp, sensor_id, ph, turbidity, conductivity, temperature]

        Returns:
            List of anomaly dicts with keys:
                timestamp, sensor_id, parameter, value, severity, severity_score, reason
        """
        if df.empty:
            return []

        # Try TimeGPT first if available
        if self._client and self.use_timegpt:
            try:
                return self._detect_timegpt(df)
            except Exception:
                pass  # Fall through to threshold

        # Fallback: threshold-based detection
        return self._detect_threshold(df)

    def _detect_timegpt(self, df: pd.DataFrame) -> list[dict]:
        """Use TimeGPT detect_anomalies with confidence level 90."""
        # Transform to long format
        long_df = self._to_long_format(df)

        # Call TimeGPT anomaly detection
        anomaly_df = self._client.detect_anomalies(
            df=long_df,
            time_col="ds",
            target_col="y",
            freq="5min",
        )

        # Filter to anomalies and convert to our format
        anomalies = []
        if "anomaly" in anomaly_df.columns:
            anomaly_rows = anomaly_df[anomaly_df["anomaly"] == 1]
            for _, row in anomaly_rows.iterrows():
                unique_id = row["unique_id"]
                # Parse unique_id: sensor_id_parameter
                parts = unique_id.rsplit("_", 1)
                if len(parts) == 2:
                    sensor_id, param = parts
                    value = row["y"]
                    score, severity = calculate_severity_score(param, value)
                    anomalies.append(
                        {
                            "timestamp": row["ds"],
                            "sensor_id": sensor_id,
                            "parameter": param,
                            "value": value,
                            "severity": severity,
                            "severity_score": score,
                            "reason": f"TimeGPT detected anomaly in {param}",
                        }
                    )

        return anomalies

    def _detect_threshold(self, df: pd.DataFrame) -> list[dict]:
        """Threshold-based anomaly detection."""
        anomalies = []
        parameters = ["ph", "turbidity", "conductivity", "temperature"]

        for _, row in df.iterrows():
            for param in parameters:
                if param not in row:
                    continue

                value = row[param]
                score, severity = calculate_severity_score(param, value)

                # Only report if not normal
                if severity != "normal":
                    anomalies.append(
                        {
                            "timestamp": row["timestamp"],
                            "sensor_id": row["sensor_id"],
                            "parameter": param,
                            "value": value,
                            "severity": severity,
                            "severity_score": score,
                            "reason": f"{param} value {value} indicates {severity} condition",
                        }
                    )

        return anomalies

    def _to_long_format(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transform wide format to long format for TimeGPT."""
        parameters = ["ph", "turbidity", "conductivity", "temperature"]
        records = []

        for _, row in df.iterrows():
            for param in parameters:
                if param in row:
                    records.append(
                        {
                            "unique_id": f"{row['sensor_id']}_{param}",
                            "ds": row["timestamp"],
                            "y": row[param],
                        }
                    )

        return pd.DataFrame(records)
