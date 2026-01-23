import pytest
import pandas as pd
from datetime import datetime, timedelta, timezone

from data_generator import SyntheticDataGenerator


class TestSyntheticDataGenerator:
    def test_generator_deterministic(self):
        fixed_start = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        gen1 = SyntheticDataGenerator(seed=42)
        gen2 = SyntheticDataGenerator(seed=42)

        df1 = gen1.generate("normal", hours=2, start_time=fixed_start)
        df2 = gen2.generate("normal", hours=2, start_time=fixed_start)

        pd.testing.assert_frame_equal(df1, df2)

    def test_generate_normal_scenario_ph_range(self):
        gen = SyntheticDataGenerator(seed=123)
        df = gen.generate("normal", hours=24)

        assert df["ph"].min() >= 6.5
        assert df["ph"].max() <= 7.2

    def test_generate_warning_scenario_ph_ends_around_5_5(self):
        gen = SyntheticDataGenerator(seed=456)
        df = gen.generate("warning", hours=24)

        final_ph = df["ph"].iloc[-1]
        assert 5.4 <= final_ph <= 5.6

    def test_generate_critical_scenario_ph_ends_around_4_2(self):
        gen = SyntheticDataGenerator(seed=789)
        df = gen.generate("critical", hours=24)

        final_ph = df["ph"].iloc[-1]
        assert 4.1 <= final_ph <= 4.3

    def test_correct_columns(self):
        gen = SyntheticDataGenerator(seed=1)
        df = gen.generate("normal", hours=1)

        expected_columns = {
            "timestamp",
            "sensor_id",
            "ph",
            "turbidity",
            "conductivity",
            "temperature",
        }
        assert set(df.columns) == expected_columns

    def test_correct_row_count(self):
        gen = SyntheticDataGenerator(seed=1)

        df_1h = gen.generate("normal", hours=1)
        assert len(df_1h) == 12

        df_24h = gen.generate("normal", hours=24)
        assert len(df_24h) == 288

    def test_5_minute_intervals(self):
        gen = SyntheticDataGenerator(seed=1)
        fixed_start = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        df = gen.generate("normal", hours=2, start_time=fixed_start)

        timestamps = df["timestamp"].tolist()
        for i in range(1, len(timestamps)):
            delta = timestamps[i] - timestamps[i - 1]
            assert delta == timedelta(minutes=5)

    def test_sensor_id_custom(self):
        gen = SyntheticDataGenerator(seed=1)
        df = gen.generate("normal", hours=1, sensor_id="custom-sensor-42")

        assert all(df["sensor_id"] == "custom-sensor-42")

    def test_invalid_scenario_raises(self):
        gen = SyntheticDataGenerator(seed=1)

        with pytest.raises(ValueError, match="Invalid scenario"):
            gen.generate("invalid", hours=1)

    def test_temperature_in_diurnal_range(self):
        gen = SyntheticDataGenerator(seed=1)
        df = gen.generate("normal", hours=48)

        assert df["temperature"].min() >= 26
        assert df["temperature"].max() <= 30

    def test_turbidity_normal_range(self):
        gen = SyntheticDataGenerator(seed=1)
        df = gen.generate("normal", hours=24)

        assert df["turbidity"].min() >= 10
        assert df["turbidity"].max() <= 30

    def test_turbidity_critical_range(self):
        gen = SyntheticDataGenerator(seed=1)
        df = gen.generate("critical", hours=24)

        assert df["turbidity"].min() >= 10
        assert df["turbidity"].max() <= 40

    def test_conductivity_normal_range(self):
        gen = SyntheticDataGenerator(seed=1)
        df = gen.generate("normal", hours=24)

        assert df["conductivity"].min() >= 400
        assert df["conductivity"].max() <= 500

    def test_conductivity_critical_range(self):
        gen = SyntheticDataGenerator(seed=1)
        df = gen.generate("critical", hours=24)

        assert df["conductivity"].min() >= 500
        assert df["conductivity"].max() <= 800
