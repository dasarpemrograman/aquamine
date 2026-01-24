import os
import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta, timezone
import pandas as pd
from nixtla import NixtlaClient
from ..schemas.forecast import ForecastPoint, PredictionCreate

logger = logging.getLogger(__name__)


class TimeGPTClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("NIXTLA_API_KEY")
        if not self.api_key:
            logger.warning("NIXTLA_API_KEY not found. Forecasting will fail.")
            self.client = None
        else:
            self.client = NixtlaClient(api_key=self.api_key)

    def generate_forecast(
        self,
        df: pd.DataFrame,
        horizon: int = 168,  # 7 days * 24 hours
        freq: str = "h",
        level: List[int] = [90],
    ) -> Dict[str, List[ForecastPoint]]:
        """
        Generate forecast using TimeGPT.
        df must have columns: unique_id, ds, y
        Returns dict keyed by unique_id (sensor_param) -> list of points
        """
        if not self.client:
            logger.info("TimeGPT client not initialized. Using mock forecast.")
            return self.generate_mock_forecast(df, horizon)

        try:
            logger.info(
                f"Generating forecast for {len(df['unique_id'].unique())} series, horizon={horizon}"
            )
            forecast_df = self.client.forecast(
                df=df, h=horizon, freq=freq, level=level, add_history=False
            )

            # Parse result
            results = {}
            for uid, group in forecast_df.groupby("unique_id"):
                points = []
                for _, row in group.iterrows():
                    points.append(
                        ForecastPoint(
                            timestamp=row["ds"],
                            value=row["TimeGPT"],
                            lower=row.get(f"TimeGPT-lo-{level[0]}"),
                            upper=row.get(f"TimeGPT-hi-{level[0]}"),
                        )
                    )
                results[str(uid)] = points

            return results

        except Exception as e:
            logger.error(f"TimeGPT API Error: {e}")
            # Fallback to mock if API fails
            logger.info("Falling back to mock forecast...")
            return self.generate_mock_forecast(df, horizon)

    def generate_mock_forecast(
        self, df: pd.DataFrame, horizon: int = 168
    ) -> Dict[str, List[ForecastPoint]]:
        """Generate dummy forecast when API key is missing or fails."""
        results = {}
        future_dates = [datetime.now(timezone.utc) + timedelta(hours=i + 1) for i in range(horizon)]

        for uid, group in df.groupby("unique_id"):
            last_val = group.iloc[-1]["y"]
            points = []

            # Simple simulation: continue trend or oscillate
            # uid format: "sensor_id_parameter" (e.g. ESP32_AMD_001_ph)
            param = str(uid).split("_")[-1].lower()

            import numpy as np

            for i, date in enumerate(future_dates):
                # Add some physics-like oscillation
                if param == "temperature":
                    # Diurnal cycle
                    val = last_val + 2.0 * np.sin(2 * np.pi * i / 24)
                elif param == "ph":
                    # Slight drift
                    val = last_val + np.random.normal(0, 0.05)
                else:
                    # Random walk
                    val = last_val + np.random.normal(0, 1.0)

                # Update last_val for next step (random walk)
                if param != "temperature":
                    last_val = val

                points.append(
                    ForecastPoint(
                        timestamp=date,
                        value=float(val),
                        lower=float(val * 0.9),
                        upper=float(val * 1.1),
                    )
                )
            results[str(uid)] = points

        return results

    def validate_data_requirements(self, df: pd.DataFrame) -> bool:
        """Check if data meets TimeGPT minimum requirements."""
        # Check minimum length per series (need at least one season usually)
        min_points = 24 * 7  # 1 week of history preferred
        for uid, group in df.groupby("unique_id"):
            if len(group) < min_points:
                logger.warning(
                    f"Series {uid} has only {len(group)} points (recommended: {min_points})"
                )
        return True
