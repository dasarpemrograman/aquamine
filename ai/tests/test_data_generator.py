import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from ai.data_generator.synthetic import AMDWaterQualityGenerator


def test_normal_data_generation():
    generator = AMDWaterQualityGenerator(start_date=datetime.now(timezone.utc), days=1)
    df = generator.generate_normal_data()

    assert len(df) == 24  # 1 day, hourly interval
    assert df["ph"].between(6.0, 9.0).all()
    assert df["turbidity"].between(0, 25).all()
    assert df["scenario"].unique()[0] == "normal"


def test_warning_scenario():
    generator = AMDWaterQualityGenerator(start_date=datetime.now(timezone.utc), days=2)
    df = generator.generate_warning_data()

    # Check that pH generally decreases (end < start)
    # Using means of first and last 6 hours to smooth noise
    assert df["ph"].iloc[-6:].mean() < df["ph"].iloc[:6].mean()
    assert df["scenario"].unique()[0] == "warning"


def test_critical_scenario():
    generator = AMDWaterQualityGenerator(start_date=datetime.now(timezone.utc), days=2)
    df = generator.generate_critical_data()

    # Check for crash (pH < 4.0 at the end)
    assert (df["ph"] < 4.5).any()
    assert df["turbidity"].max() > 100
    assert df["scenario"].unique()[0] == "critical"


def test_ph_turbidity_correlation():
    # In warning/critical, pH drops and turbidity rises -> negative correlation
    generator = AMDWaterQualityGenerator(start_date=datetime.now(timezone.utc), days=7)
    df = generator.generate_critical_data()

    corr = df["ph"].corr(df["turbidity"])
    assert corr < -0.3


def test_no_missing_values():
    generator = AMDWaterQualityGenerator(start_date=datetime.now(timezone.utc), days=1)
    df = generator.generate_normal_data()
    assert not df.isnull().values.any()


def test_timegpt_format():
    generator = AMDWaterQualityGenerator(start_date=datetime.now(timezone.utc), days=1)
    df = generator.generate_normal_data()
    timegpt_df = generator.to_timegpt_format(df, unique_id="test_sensor")

    assert list(timegpt_df.columns) == ["unique_id", "ds", "y"]
    assert len(timegpt_df) == len(df) * 3  # 3 parameters
    assert "test_sensor_ph" in timegpt_df["unique_id"].values
