"""TimeGPT-based forecasting for water quality parameters."""

import os
from typing import Optional

import pandas as pd


class TimeGPTForecaster:
    """TimeGPT-based forecasting for water quality parameters."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize forecaster with Nixtla API key.

        Args:
            api_key: API key for Nixtla. If None, reads from NIXTLA_API_KEY env var.

        Raises:
            ValueError: If no API key provided or found in environment.
        """
        self.api_key = api_key or os.getenv("NIXTLA_API_KEY")
        if not self.api_key:
            raise ValueError("NIXTLA_API_KEY environment variable required")

        from nixtla import NixtlaClient

        self.client = NixtlaClient(api_key=self.api_key)

    def forecast(
        self,
        df: pd.DataFrame,
        horizon_days: int = 7,
    ) -> pd.DataFrame:
        """
        Generate forecast for all parameters in the DataFrame.

        Args:
            df: DataFrame with columns [timestamp, sensor_id, ph, turbidity, conductivity, temperature]
            horizon_days: Number of days to forecast (default 7)

        Returns:
            DataFrame with forecast predictions including confidence intervals

        Raises:
            ValueError: If input DataFrame is empty or missing required columns
            Exception: If TimeGPT API call fails
        """
        if df.empty:
            raise ValueError("Input DataFrame is empty")

        required_cols = ["timestamp", "sensor_id", "ph", "turbidity", "conductivity", "temperature"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        # Transform wide format to long format for TimeGPT
        long_df = self._to_long_format(df)

        # Calculate horizon in 5-minute intervals (288 per day)
        horizon = horizon_days * 288

        # Call TimeGPT forecast
        forecast_df = self.client.forecast(
            df=long_df,
            h=horizon,
            time_col="ds",
            target_col="y",
            freq="5min",
        )

        return forecast_df

    def _to_long_format(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Transform wide format DataFrame to long format for TimeGPT.

        Wide format: [timestamp, sensor_id, ph, turbidity, conductivity, temperature]
        Long format: [unique_id, ds, y]

        unique_id = {sensor_id}_{parameter}
        """
        parameters = ["ph", "turbidity", "conductivity", "temperature"]
        records = []

        for _, row in df.iterrows():
            for param in parameters:
                records.append(
                    {
                        "unique_id": f"{row['sensor_id']}_{param}",
                        "ds": row["timestamp"],
                        "y": row[param],
                    }
                )

        return pd.DataFrame(records)
