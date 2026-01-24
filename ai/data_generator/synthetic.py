import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
import random
from typing import List, Dict, Optional, Literal


class AMDWaterQualityGenerator:
    """Generates synthetic Acid Mine Drainage (AMD) water quality data."""

    def __init__(
        self, start_date: datetime, days: int = 7, interval_minutes: int = 60, seed: int = 42
    ):
        self.start_date = start_date
        self.days = days
        self.interval_minutes = interval_minutes
        self.seed = seed
        self.n_samples = int((days * 24 * 60) / interval_minutes)
        np.random.seed(seed)
        random.seed(seed)

    def generate_timestamps(self) -> List[datetime]:
        """Generate sequence of timestamps."""
        return [
            self.start_date + timedelta(minutes=i * self.interval_minutes)
            for i in range(self.n_samples)
        ]

    def generate_normal_data(self) -> pd.DataFrame:
        """Generate data representing normal conditions (safe water)."""
        timestamps = self.generate_timestamps()

        # Temperature: Tropical (25-30 C) with diurnal cycle
        temp_base = 27.0
        temp_diurnal = 2.0 * np.sin(
            2
            * np.pi
            * (np.arange(self.n_samples) - 6 * 60 / self.interval_minutes)
            / (24 * 60 / self.interval_minutes)
        )
        temp_noise = np.random.normal(0, 0.5, self.n_samples)
        temp = temp_base + temp_diurnal + temp_noise

        # pH: Normal range 6.0 - 9.0
        # Correlation: Temp naik -> pH cenderung sedikit turun (kimia air dasar)
        ph_base = 7.0
        ph_noise = np.random.normal(0, 0.1, self.n_samples)
        ph_diurnal = 0.1 * np.sin(
            2 * np.pi * np.arange(self.n_samples) / (24 * 60 / self.interval_minutes)
        )
        ph = ph_base + ph_diurnal + ph_noise
        ph = np.clip(ph, 6.0, 9.0)

        # Turbidity: Low (clean), < 25 NTU
        # Correlation: Hujan (Temp turun drastis) -> Turbidity naik.
        # Simple random walk for robustness
        turb_base = 10.0
        turb_noise = np.random.gamma(2, 2, self.n_samples)
        turb = turb_base + turb_noise
        turb = np.clip(turb, 0, 25)

        return pd.DataFrame(
            {
                "timestamp": timestamps,
                "ph": ph,
                "turbidity": turb,
                "temperature": temp,
                "scenario": "normal",
            }
        )

    def generate_warning_data(self) -> pd.DataFrame:
        """Generate data representing early AMD warning (declining pH)."""
        df = self.generate_normal_data()

        # Linear drift down for pH
        drift = np.linspace(0, -1.5, self.n_samples)
        df["ph"] = df["ph"] + drift

        # Negative correlation: pH down -> Turbidity UP
        # Turbidity increases as pH drops (dissolved metals precipitate)
        turb_increase = np.linspace(0, 40, self.n_samples)
        df["turbidity"] = df["turbidity"] + turb_increase

        df["scenario"] = "warning"
        return df

    def generate_critical_data(self) -> pd.DataFrame:
        """Generate data representing critical AMD event (pH crash)."""
        df = self.generate_normal_data()

        # Sudden crash half-way through
        crash_point = self.n_samples // 2

        # Pre-crash: normal
        # Post-crash: pH < 4.5 (Acidic)
        df.loc[crash_point:, "ph"] = df.loc[crash_point:, "ph"] - 4.0

        # Strong Negative Correlation: Turbidity SPIKE
        df.loc[crash_point:, "turbidity"] = (
            df.loc[crash_point:, "turbidity"]
            + 150
            + np.random.normal(0, 10, self.n_samples - crash_point)
        )

        df["scenario"] = "critical"
        return df

    def generate_sensor_drift_anomaly(self) -> pd.DataFrame:
        """Generate data with gradual sensor drift (uncalibrated sensor)."""
        df = self.generate_normal_data()
        # pH drifting up incorrectly (sensor fouling)
        drift = np.linspace(0, 2.0, self.n_samples)
        df["ph"] = df["ph"] + drift
        df["scenario"] = "sensor_drift"
        return df

    def inject_calibration_error(
        self, df: pd.DataFrame, parameter: str = "ph", offset: float = 1.0
    ) -> pd.DataFrame:
        """Inject sudden step change due to bad calibration."""
        error_point = self.n_samples // 3
        df.loc[error_point:, parameter] = df.loc[error_point:, parameter] + offset
        return df

    def to_timegpt_format(self, df: pd.DataFrame, unique_id: str = "sensor_1") -> pd.DataFrame:
        """Convert to Nixtla TimeGPT format (unique_id, ds, y)."""
        long_df = pd.melt(
            df,
            id_vars=["timestamp"],
            value_vars=["ph", "turbidity", "temperature"],
            var_name="parameter",
            value_name="y",
        )
        long_df["ds"] = long_df["timestamp"]
        long_df["unique_id"] = unique_id + "_" + long_df["parameter"]
        return long_df[["unique_id", "ds", "y"]]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate synthetic AMD water quality data")
    parser.add_argument("--days", type=int, default=7, help="Number of days to generate")
    parser.add_argument(
        "--scenario", type=str, choices=["normal", "warning", "critical", "drift"], default="normal"
    )
    parser.add_argument("--output", type=str, default="synthetic_data.csv")

    args = parser.parse_args()

    generator = AMDWaterQualityGenerator(start_date=datetime.now(timezone.utc), days=args.days)

    if args.scenario == "normal":
        df = generator.generate_normal_data()
    elif args.scenario == "warning":
        df = generator.generate_warning_data()
    elif args.scenario == "critical":
        df = generator.generate_critical_data()
    elif args.scenario == "drift":
        df = generator.generate_sensor_drift_anomaly()

    df.to_csv(args.output, index=False)
    print(f"Generated {len(df)} rows of {args.scenario} data to {args.output}")
