import os
import logging

from datetime import datetime, timedelta, timezone
import pandas as pd
from nixtla import NixtlaClient
from ..schemas.forecast import ForecastPoint

logger = logging.getLogger(__name__)


class TimeGPTClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("NIXTLA_API_KEY")
        if not self.api_key:
            logger.warning("NIXTLA_API_KEY not found. Forecasting will fail.")
            self.client = None
        else:
            self.client = NixtlaClient(api_key=self.api_key)

    def preprocess_timeseries(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fill short gaps so TimeGPT sees a contiguous hourly series.

        Strategy (per unique_id):
        - Reindex to a complete hourly range
        - Interpolate inside gaps up to 6 hours
        - Forward-fill remaining NaNs up to 12 hours
        - Drop anything still NaN (gap too large)
        """

        if df.empty:
            return df

        required_cols = {"unique_id", "ds", "y"}
        missing = required_cols - set(df.columns)
        if missing:
            raise ValueError(f"TimeGPT input df missing columns: {sorted(missing)}")

        df = df.copy()
        df["ds"] = pd.to_datetime(df["ds"], utc=True)

        value_cols = [c for c in df.columns if c not in ("unique_id", "ds")]
        processed: list[pd.DataFrame] = []

        for uid, group in df.groupby("unique_id"):
            group = group.sort_values("ds").drop_duplicates(subset=["ds"], keep="last")

            start = group["ds"].min()
            end = group["ds"].max()
            if start is pd.NaT or end is pd.NaT:
                continue

            hourly_index = pd.date_range(start=start, end=end, freq="h")
            reindexed = group.set_index("ds")[value_cols].reindex(hourly_index)

            numeric_cols = reindexed.select_dtypes(include="number").columns.tolist()
            other_cols = [c for c in value_cols if c not in numeric_cols]

            if numeric_cols:
                reindexed.loc[:, numeric_cols] = reindexed.loc[:, numeric_cols].interpolate(
                    method="time", limit=6, limit_area="inside"
                )
                reindexed.loc[:, numeric_cols] = reindexed.loc[:, numeric_cols].ffill(limit=12)

            if other_cols:
                reindexed.loc[:, other_cols] = reindexed.loc[:, other_cols].ffill(limit=12)

            reindexed = reindexed.dropna(how="any")
            if reindexed.empty:
                continue

            reindexed["unique_id"] = uid
            reindexed = (
                reindexed.reset_index()
                .rename(columns={"index": "ds"})
                .loc[:, ["unique_id", "ds", *value_cols]]
            )
            processed.append(reindexed)

        if not processed:
            return df.iloc[0:0].copy()

        return pd.concat(processed, ignore_index=True)

    def generate_forecast(
        self,
        df: pd.DataFrame,
        horizon: int = 168,  # 7 days * 24 hours
        freq: str = "h",
        level: list[int | float] = [90],
    ) -> dict[str, list[ForecastPoint]]:
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

            df = self.preprocess_timeseries(df)
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
    ) -> dict[str, list[ForecastPoint]]:
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
