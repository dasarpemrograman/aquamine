import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Literal, get_args


class TestAMDWaterQualityGenerator:
    def test_normal_scenario_generates_stable_ph(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=7, scenario="normal")

        assert "ph" in df.columns
        assert df["ph"].min() >= 5.5
        assert df["ph"].max() <= 8.5
        assert df["ph"].mean() >= 6.5
        assert df["ph"].mean() <= 7.5

    def test_warning_scenario_shows_declining_ph(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=7, scenario="warning")

        first_half = df["ph"].iloc[: len(df) // 2].mean()
        second_half = df["ph"].iloc[len(df) // 2 :].mean()
        assert second_half < first_half

    def test_critical_scenario_shows_ph_crash(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=7, scenario="critical")

        assert df["ph"].min() < 5.0
        final_readings = df["ph"].tail(24)
        assert final_readings.mean() < 5.5

    def test_ph_turbidity_negative_correlation(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=14, scenario="warning")

        correlation: float = df["ph"].corr(df["turbidity"])  # type: ignore[assignment]
        assert correlation < -0.3

    def test_no_missing_values(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)

        scenarios: list[Literal["normal", "warning", "critical"]] = [
            "normal",
            "warning",
            "critical",
        ]
        for scenario in scenarios:
            df = generator.generate(days=7, scenario=scenario)
            assert df["ph"].isna().sum() == 0
            assert df["turbidity"].isna().sum() == 0
            assert df["temperature"].isna().sum() == 0

    def test_timegpt_compatible_format(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=7, scenario="normal")
        timegpt_df = generator.to_timegpt_format(df, sensor_id="ESP32_001")

        assert "unique_id" in timegpt_df.columns
        assert "ds" in timegpt_df.columns
        assert "y" in timegpt_df.columns
        assert timegpt_df["unique_id"].nunique() == 3

    def test_generates_correct_number_of_readings(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=7, scenario="normal", interval_minutes=60)

        expected_readings = 7 * 24
        assert len(df) == expected_readings

    def test_temperature_within_realistic_range(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=7, scenario="normal")

        assert df["temperature"].min() >= 15
        assert df["temperature"].max() <= 40

    def test_turbidity_increases_during_anomaly(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        normal_df = generator.generate(days=7, scenario="normal")
        critical_df = generator.generate(days=7, scenario="critical")

        assert critical_df["turbidity"].mean() > normal_df["turbidity"].mean()

    def test_reproducible_with_seed(self):
        from data_generator.synthetic import AMDWaterQualityGenerator

        gen1 = AMDWaterQualityGenerator(seed=123)
        gen2 = AMDWaterQualityGenerator(seed=123)

        df1 = gen1.generate(days=3, scenario="normal")
        df2 = gen2.generate(days=3, scenario="normal")

        pd.testing.assert_frame_equal(df1, df2)
