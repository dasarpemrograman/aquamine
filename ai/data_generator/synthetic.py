from datetime import datetime, timedelta
from enum import Enum
from typing import Literal

import numpy as np
import pandas as pd


class Scenario(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"


class AMDWaterQualityGenerator:
    """
    Generates synthetic AMD water quality data based on domain chemistry.

    AMD (Acid Mine Drainage) involves oxidation of sulfide minerals exposed by mining,
    producing sulfuric acid that lowers pH and increases metal dissolution/turbidity.
    """

    PH_NORMAL_MEAN = 7.0
    PH_NORMAL_STD = 0.3
    PH_WARNING_TARGET = 5.5
    PH_CRITICAL_TARGET = 4.0

    TURBIDITY_NORMAL_MEAN = 25.0
    TURBIDITY_NORMAL_STD = 5.0
    TURBIDITY_ANOMALY_MULTIPLIER = 3.0

    TEMP_BASE = 27.0
    TEMP_AMPLITUDE = 3.0
    TEMP_NOISE_STD = 0.5

    def __init__(self, seed: int | None = None):
        self.rng = np.random.default_rng(seed)
        self._seed = seed

    def generate(
        self,
        days: int = 7,
        scenario: Literal["normal", "warning", "critical"] = "normal",
        interval_minutes: int = 60,
        start_time: datetime | None = None,
    ) -> pd.DataFrame:
        if start_time is None:
            start_time = datetime.now().replace(minute=0, second=0, microsecond=0)

        n_readings = (days * 24 * 60) // interval_minutes
        timestamps = [
            start_time + timedelta(minutes=i * interval_minutes) for i in range(n_readings)
        ]

        if scenario == "normal":
            ph_values = self._generate_normal_ph(n_readings)
        elif scenario == "warning":
            ph_values = self._generate_warning_ph(n_readings)
        elif scenario == "critical":
            ph_values = self._generate_critical_ph(n_readings)
        else:
            raise ValueError(f"Unknown scenario: {scenario}")

        turbidity_values = self._generate_turbidity(ph_values)
        temperature_values = self._generate_temperature(n_readings, timestamps)

        return pd.DataFrame(
            {
                "timestamp": timestamps,
                "ph": ph_values,
                "turbidity": turbidity_values,
                "temperature": temperature_values,
            }
        )

    def _generate_normal_ph(self, n: int) -> np.ndarray:
        base = self.rng.normal(self.PH_NORMAL_MEAN, self.PH_NORMAL_STD, n)
        diurnal = 0.2 * np.sin(np.linspace(0, 2 * np.pi * (n / 24), n))
        ph = base + diurnal
        return np.clip(ph, 5.5, 8.5)

    def _generate_warning_ph(self, n: int) -> np.ndarray:
        start_ph = self.PH_NORMAL_MEAN
        end_ph = self.PH_WARNING_TARGET
        trend = np.linspace(start_ph, end_ph, n)

        noise = self.rng.normal(0, 0.2, n)
        diurnal = 0.15 * np.sin(np.linspace(0, 2 * np.pi * (n / 24), n))

        ph = trend + noise + diurnal
        return np.clip(ph, 4.0, 8.5)

    def _generate_critical_ph(self, n: int) -> np.ndarray:
        crash_point = int(n * 0.6)

        pre_crash = np.linspace(self.PH_NORMAL_MEAN, 5.5, crash_point)
        pre_crash += self.rng.normal(0, 0.15, crash_point)

        post_crash_len = n - crash_point
        crash_curve = np.exp(-np.linspace(0, 3, post_crash_len))
        post_crash = 5.5 * crash_curve + self.PH_CRITICAL_TARGET * (1 - crash_curve)
        post_crash += self.rng.normal(0, 0.1, post_crash_len)

        ph = np.concatenate([pre_crash, post_crash])
        return np.clip(ph, 3.0, 8.5)

    def _generate_turbidity(self, ph_values: np.ndarray) -> np.ndarray:
        """
        Turbidity inversely correlates with pH in AMD scenarios.
        Lower pH -> higher metal dissolution -> higher turbidity.
        """
        ph_deviation = self.PH_NORMAL_MEAN - ph_values
        turbidity_increase = np.maximum(0, ph_deviation) * 15

        base_turbidity = self.rng.normal(
            self.TURBIDITY_NORMAL_MEAN, self.TURBIDITY_NORMAL_STD, len(ph_values)
        )
        turbidity = base_turbidity + turbidity_increase

        noise = self.rng.normal(0, 2, len(ph_values))
        turbidity = turbidity + noise

        return np.clip(turbidity, 1.0, 500.0)

    def _generate_temperature(self, n: int, timestamps: list[datetime]) -> np.ndarray:
        hours = np.array([t.hour for t in timestamps])
        diurnal = self.TEMP_AMPLITUDE * np.sin((hours - 6) * np.pi / 12)

        base = self.TEMP_BASE + diurnal
        noise = self.rng.normal(0, self.TEMP_NOISE_STD, n)

        return np.clip(base + noise, 15.0, 40.0)

    def to_timegpt_format(self, df: pd.DataFrame, sensor_id: str = "sensor_001") -> pd.DataFrame:
        """
        Convert to TimeGPT long format: unique_id, ds, y
        Creates separate rows for each parameter.
        """
        records = []
        for _, row in df.iterrows():
            ts = row["timestamp"]
            for param in ["ph", "turbidity", "temperature"]:
                records.append(
                    {
                        "unique_id": f"{sensor_id}_{param}",
                        "ds": ts,
                        "y": row[param],
                    }
                )

        return pd.DataFrame(records)

    def generate_multi_sensor(
        self,
        sensor_ids: list[str],
        days: int = 7,
        scenarios: dict[str, Literal["normal", "warning", "critical"]] | None = None,
        interval_minutes: int = 60,
    ) -> pd.DataFrame:
        if scenarios is None:
            scenarios = {sid: "normal" for sid in sensor_ids}

        all_data = []
        for sensor_id in sensor_ids:
            scenario: Literal["normal", "warning", "critical"] = scenarios.get(sensor_id, "normal")  # type: ignore[assignment]
            df = self.generate(days=days, scenario=scenario, interval_minutes=interval_minutes)
            df["sensor_id"] = sensor_id
            all_data.append(df)

        return pd.concat(all_data, ignore_index=True)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate synthetic AMD water quality data")
    parser.add_argument("--days", type=int, default=7, help="Number of days to generate")
    parser.add_argument("--scenario", choices=["normal", "warning", "critical"], default="normal")
    parser.add_argument("--interval", type=int, default=60, help="Interval in minutes")
    parser.add_argument("--output", type=str, default="synthetic_data.csv", help="Output file")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    parser.add_argument("--sensor-id", type=str, default="ESP32_001", help="Sensor ID")
    parser.add_argument("--timegpt-format", action="store_true", help="Output in TimeGPT format")

    args = parser.parse_args()

    generator = AMDWaterQualityGenerator(seed=args.seed)
    df = generator.generate(days=args.days, scenario=args.scenario, interval_minutes=args.interval)

    if args.timegpt_format:
        df = generator.to_timegpt_format(df, sensor_id=args.sensor_id)

    df.to_csv(args.output, index=False)
    print(f"Generated {len(df)} rows -> {args.output}")


if __name__ == "__main__":
    main()
