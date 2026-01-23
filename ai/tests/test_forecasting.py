"""Tests for TimeGPT forecasting module."""

import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
from datetime import datetime, timezone


class TestTimeGPTForecaster:
    def test_init_requires_api_key(self):
        with patch.dict("os.environ", {}, clear=True):
            from forecasting import TimeGPTForecaster

            with pytest.raises(ValueError, match="NIXTLA_API_KEY"):
                TimeGPTForecaster()

    def test_init_uses_env_var(self):
        with patch.dict("os.environ", {"NIXTLA_API_KEY": "test-key"}):
            with patch("nixtla.NixtlaClient") as MockClient:
                from forecasting import TimeGPTForecaster

                TimeGPTForecaster()
                MockClient.assert_called_once_with(api_key="test-key")

    def test_init_uses_explicit_key(self):
        with patch("nixtla.NixtlaClient") as MockClient:
            from forecasting import TimeGPTForecaster

            TimeGPTForecaster(api_key="explicit-key")
            MockClient.assert_called_once_with(api_key="explicit-key")

    def test_forecast_empty_df_raises(self):
        with patch("nixtla.NixtlaClient"):
            from forecasting import TimeGPTForecaster

            forecaster = TimeGPTForecaster(api_key="test")
            empty_df = pd.DataFrame()

            with pytest.raises(ValueError, match="empty"):
                forecaster.forecast(empty_df)

    def test_forecast_missing_columns_raises(self):
        with patch("nixtla.NixtlaClient"):
            from forecasting import TimeGPTForecaster

            forecaster = TimeGPTForecaster(api_key="test")
            incomplete_df = pd.DataFrame({"timestamp": [datetime.now(timezone.utc)]})

            with pytest.raises(ValueError, match="Missing required columns"):
                forecaster.forecast(incomplete_df)

    def test_forecast_transforms_to_long_format(self):
        mock_client = MagicMock()
        mock_client.forecast.return_value = pd.DataFrame(
            {
                "unique_id": ["sensor-1_ph"],
                "ds": [datetime.now(timezone.utc)],
                "TimeGPT": [6.8],
            }
        )

        with patch("nixtla.NixtlaClient", return_value=mock_client):
            from forecasting import TimeGPTForecaster

            forecaster = TimeGPTForecaster(api_key="test")
            df = pd.DataFrame(
                {
                    "timestamp": [datetime.now(timezone.utc)],
                    "sensor_id": ["sensor-1"],
                    "ph": [7.0],
                    "turbidity": [20.0],
                    "conductivity": [400.0],
                    "temperature": [28.0],
                }
            )

            forecaster.forecast(df, horizon_days=1)

            mock_client.forecast.assert_called_once()
            call_kwargs = mock_client.forecast.call_args
            assert call_kwargs.kwargs["h"] == 288

    def test_to_long_format(self):
        with patch("nixtla.NixtlaClient"):
            from forecasting import TimeGPTForecaster

            forecaster = TimeGPTForecaster(api_key="test")
            df = pd.DataFrame(
                {
                    "timestamp": [datetime.now(timezone.utc)],
                    "sensor_id": ["sensor-1"],
                    "ph": [7.0],
                    "turbidity": [20.0],
                    "conductivity": [400.0],
                    "temperature": [28.0],
                }
            )

            long_df = forecaster._to_long_format(df)

            assert len(long_df) == 4
            assert set(long_df.columns) == {"unique_id", "ds", "y"}
            assert "sensor-1_ph" in long_df["unique_id"].values
