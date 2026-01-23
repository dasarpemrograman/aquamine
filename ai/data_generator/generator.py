"""Synthetic AMD water quality data generator for testing and development."""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone


class SyntheticDataGenerator:
    """Generate realistic synthetic AMD (Acid Mine Drainage) water quality data.

    Produces time-series data with configurable scenarios for testing
    forecasting and anomaly detection models.
    """

    SCENARIOS = {"normal", "warning", "critical"}
    SAMPLES_PER_HOUR = 12

    def __init__(self, seed: int | None = None):
        self.rng = np.random.default_rng(seed)

    def generate(
        self,
        scenario: str,
        hours: int,
        sensor_id: str = "sensor-1",
        start_time: datetime | None = None,
    ) -> pd.DataFrame:
        """Generate synthetic AMD data for the specified scenario.

        Args:
            scenario: One of "normal", "warning", or "critical"
            hours: Duration in hours
            sensor_id: Sensor identifier
            start_time: Starting timestamp (defaults to now UTC)

        Returns:
            DataFrame with columns: timestamp, sensor_id, ph, turbidity,
            conductivity, temperature. Rows = hours * 12 (5-minute intervals).

        Raises:
            ValueError: If scenario is not one of the valid options.
        """
        if scenario not in self.SCENARIOS:
            raise ValueError(f"Invalid scenario '{scenario}'. Must be one of: {self.SCENARIOS}")

        if start_time is None:
            start_time = datetime.now(timezone.utc)

        n_samples = hours * self.SAMPLES_PER_HOUR
        timestamps = [start_time + timedelta(minutes=5 * i) for i in range(n_samples)]

        ph_values = self._generate_ph(scenario, n_samples)
        conductivity = self._generate_conductivity(scenario, ph_values)
        temperature = self._generate_temperature(n_samples, timestamps)
        turbidity = self._generate_turbidity(scenario, n_samples)

        return pd.DataFrame(
            {
                "timestamp": timestamps,
                "sensor_id": sensor_id,
                "ph": ph_values,
                "turbidity": turbidity,
                "conductivity": conductivity,
                "temperature": temperature,
            }
        )

    def _generate_ph(self, scenario: str, n_samples: int) -> np.ndarray:
        """Generate pH values based on scenario.

        - normal: Random walk between 6.5-7.2
        - warning: Linear decline 7.0 -> 5.5
        - critical: Exponential decay 7.0 -> 4.2
        """
        if scenario == "normal":
            return self._random_walk_ph(n_samples)
        elif scenario == "warning":
            return self._linear_decline_ph(n_samples)
        else:
            return self._exponential_decay_ph(n_samples)

    def _random_walk_ph(self, n_samples: int) -> np.ndarray:
        ph = np.zeros(n_samples)
        ph[0] = self.rng.uniform(6.5, 7.2)
        mean_target = 6.85
        mean_reversion_strength = 0.05
        for i in range(1, n_samples):
            step = self.rng.uniform(-0.1, 0.1)
            mean_reversion = (mean_target - ph[i - 1]) * mean_reversion_strength
            ph[i] = np.clip(ph[i - 1] + step + mean_reversion, 6.5, 7.2)
        return ph

    def _linear_decline_ph(self, n_samples: int) -> np.ndarray:
        base = np.linspace(7.0, 5.5, n_samples)
        noise = self.rng.uniform(-0.05, 0.05, n_samples)
        return base + noise

    def _exponential_decay_ph(self, n_samples: int) -> np.ndarray:
        # Formula: pH(t) = final + (initial - final) * exp(-decay_rate * t)
        t = np.linspace(0, 1, n_samples)
        initial_ph, final_ph, decay_rate = 7.0, 4.2, 5.0
        decay_factor = np.exp(-decay_rate * t)
        base = final_ph + (initial_ph - final_ph) * decay_factor
        noise = self.rng.uniform(-0.03, 0.03, n_samples)
        return base + noise

    def _generate_conductivity(self, scenario: str, ph_values: np.ndarray) -> np.ndarray:
        """Generate conductivity inversely correlated with pH (lower pH -> higher conductivity)."""
        n_samples = len(ph_values)

        ranges = {"normal": (400, 500), "warning": (450, 600), "critical": (500, 800)}
        base_min, base_max = ranges.get(scenario, (400, 500))

        # Normalize pH to 0-1 (assuming pH 4-8 range), then invert
        ph_normalized = (ph_values - 4) / 4
        ph_factor = 1 - ph_normalized

        base_range = base_max - base_min
        conductivity = base_min + ph_factor * base_range * 0.7
        noise = self.rng.uniform(-20, 20, n_samples)

        return np.clip(conductivity + noise, base_min, base_max)

    def _generate_temperature(self, n_samples: int, timestamps: list[datetime]) -> np.ndarray:
        """Generate temperature with diurnal (24h) sine wave cycle.

        Peak at 14:00, trough at 02:00. Range: 26-30°C, mean: 28°C.
        """
        hours = np.array([ts.hour + ts.minute / 60 for ts in timestamps])
        # sin(-2π(h-14)/24) peaks when h=14, troughs at h=2
        phase = 2 * np.pi * (hours - 14) / 24
        base = 28 + 2 * np.sin(-phase)
        noise = self.rng.uniform(-0.3, 0.3, n_samples)
        return np.clip(base + noise, 26, 30)

    def _generate_turbidity(self, scenario: str, n_samples: int) -> np.ndarray:
        ranges = {"normal": (10, 30), "warning": (10, 35), "critical": (10, 40)}
        low, high = ranges.get(scenario, (10, 30))
        return self.rng.uniform(low, high, n_samples)
