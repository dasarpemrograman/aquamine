import pandas as pd
import numpy as np
from datetime import datetime, timedelta
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

        # pH: Normal range 6.0 - 9.0 (neutral)
        # Diurnal cycle amplitude 0.2
        ph_base = 7.0
        ph_noise = np.random.normal(0, 0.1, self.n_samples)
        ph_diurnal = 0.2 * np.sin(
            2 * np.pi * np.arange(self.n_samples) / (24 * 60 / self.interval_minutes)
        )
        ph = ph_base + ph_diurnal + ph_noise
        ph = np.clip(ph, 6.0, 9.0)

        # Turbidity: Low (clean), < 25 NTU
        turb_base = 10.0
        turb_noise = np.random.gamma(2, 2, self.n_samples)  # Right-skewed
        turb = turb_base + turb_noise
        turb = np.clip(turb, 0, 25)

        # Temperature: Tropical (25-30 C)
        temp_base = 27.0
        temp_diurnal = 2.0 * np.sin(
            2
            * np.pi
            * (np.arange(self.n_samples) - 6 * 60 / self.interval_minutes)
            / (24 * 60 / self.interval_minutes)
        )
        temp_noise = np.random.normal(0, 0.5, self.n_samples)
        temp = temp_base + temp_diurnal + temp_noise

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

        # Slight increase in turbidity (rain event usually brings both)
        turb_increase = np.linspace(0, 20, self.n_samples)
        df["turbidity"] = df["turbidity"] + turb_increase

        df["scenario"] = "warning"
        return df

    def generate_critical_data(self) -> pd.DataFrame:
        """Generate data representing critical AMD event (pH crash)."""
        df = self.generate_normal_data()

        # Sudden crash half-way through
        crash_point = self.n_samples // 2

        # Pre-crash: normal
        # Post-crash: pH < 4.0
        df.loc[crash_point:, "ph"] = df.loc[crash_point:, "ph"] - 3.5

        # Turbidity spike
        df.loc[crash_point:, "turbidity"] = df.loc[crash_point:, "turbidity"] + 100

        df["scenario"] = "critical"
        return df

    def generate_sensor_drift_anomaly(self) -> pd.DataFrame:
        """Generate data with gradual sensor drift (uncalibrated sensor)."""
        df = self.generate_normal_data()
        drift = np.linspace(0, 1.0, self.n_samples)  # Drifting upwards incorrectly
        df["ph"] = df["ph"] + drift
        df["scenario"] = "sensor_drift"
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

    generator = AMDWaterQualityGenerator(start_date=datetime.now(), days=args.days)

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
