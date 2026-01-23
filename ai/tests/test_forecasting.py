import pytest
import pandas as pd
from unittest.mock import MagicMock, patch
from ai.forecasting.timegpt_client import TimeGPTClient
from ai.schemas.forecast import ForecastPoint


@pytest.fixture
def mock_timegpt_df():
    """Mock dataframe returned by TimeGPT"""
    data = {
        "unique_id": ["sensor_1_ph"] * 3,
        "ds": pd.to_datetime(["2024-01-01 00:00:00", "2024-01-01 01:00:00", "2024-01-01 02:00:00"]),
        "TimeGPT": [7.0, 7.1, 7.2],
        "TimeGPT-lo-90": [6.8, 6.9, 7.0],
        "TimeGPT-hi-90": [7.2, 7.3, 7.4],
    }
    return pd.DataFrame(data)


def test_init_without_key():
    """Test initialization warning without API key"""
    with patch("os.getenv", return_value=None):
        client = TimeGPTClient()
        assert client.client is None


def test_init_with_key():
    """Test initialization with API key"""
    with patch("os.getenv", return_value="fake_key"):
        client = TimeGPTClient()
        assert client.client is not None


def test_generate_forecast(mock_timegpt_df):
    """Test forecast generation and parsing"""
    with patch("os.getenv", return_value="fake_key"):
        client = TimeGPTClient()

        # Mock the internal NixtlaClient
        client.client = MagicMock()
        client.client.forecast.return_value = mock_timegpt_df

        # Input DF
        input_df = pd.DataFrame(
            {"unique_id": ["sensor_1_ph"], "ds": [pd.Timestamp("2023-12-31")], "y": [7.0]}
        )

        results = client.generate_forecast(input_df, horizon=3)

        assert "sensor_1_ph" in results
        points = results["sensor_1_ph"]
        assert len(points) == 3
        assert isinstance(points[0], ForecastPoint)
        assert points[0].value == 7.0
        assert points[0].lower == 6.8
        assert points[0].upper == 7.2


def test_validate_data_requirements():
    """Test data validation"""
    with patch("os.getenv", return_value="fake_key"):
        client = TimeGPTClient()

        # Too short
        short_df = pd.DataFrame({"unique_id": ["sensor_1"] * 10, "ds": range(10), "y": range(10)})

        # Should return True but log warning (check logs manually if needed, or mock logger)
        assert client.validate_data_requirements(short_df) is True
