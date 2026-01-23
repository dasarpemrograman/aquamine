import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch, MagicMock
import pandas as pd


class TestTimeGPTClient:
    def test_forecast_returns_7_days_predictions(self):
        from forecasting.timegpt_client import TimeGPTClient
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=14, scenario="normal")
        timegpt_df = generator.to_timegpt_format(df, sensor_id="TEST_001")

        client = TimeGPTClient(api_key="test_key")

        with patch.object(client, "_call_nixtla_api") as mock_api:
            mock_api.return_value = _create_mock_forecast_response(7)

            result = client.forecast(timegpt_df, horizon=7, parameter="ph")

            assert len(result) == 7 * 24
            assert "timestamp" in result.columns
            assert "value" in result.columns

    def test_forecast_includes_confidence_intervals(self):
        from forecasting.timegpt_client import TimeGPTClient
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=14, scenario="normal")
        timegpt_df = generator.to_timegpt_format(df, sensor_id="TEST_001")

        client = TimeGPTClient(api_key="test_key")

        with patch.object(client, "_call_nixtla_api") as mock_api:
            mock_api.return_value = _create_mock_forecast_response(7, with_intervals=True)

            result = client.forecast(timegpt_df, horizon=7, parameter="ph")

            assert "lower" in result.columns
            assert "upper" in result.columns

    def test_handles_api_error_gracefully(self):
        from forecasting.timegpt_client import TimeGPTClient, ForecastError
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=14, scenario="normal")
        timegpt_df = generator.to_timegpt_format(df, sensor_id="TEST_001")

        client = TimeGPTClient(api_key="test_key")

        with patch.object(client, "_call_nixtla_api") as mock_api:
            mock_api.side_effect = Exception("API unavailable")

            with pytest.raises(ForecastError) as exc_info:
                client.forecast(timegpt_df, horizon=7, parameter="ph")

            assert "API unavailable" in str(exc_info.value)

    def test_validates_minimum_data_points(self):
        from forecasting.timegpt_client import TimeGPTClient, InsufficientDataError

        client = TimeGPTClient(api_key="test_key")
        small_df = pd.DataFrame(
            {
                "unique_id": ["sensor_ph"] * 10,
                "ds": pd.date_range("2026-01-01", periods=10, freq="h"),
                "y": [7.0] * 10,
            }
        )

        with pytest.raises(InsufficientDataError):
            client.forecast(small_df, horizon=7, parameter="ph")


class TestForecastGeneration:
    def test_generates_forecast_for_all_parameters(self):
        from forecasting.timegpt_client import TimeGPTClient, generate_all_forecasts
        from data_generator.synthetic import AMDWaterQualityGenerator

        generator = AMDWaterQualityGenerator(seed=42)
        df = generator.generate(days=14, scenario="normal")
        timegpt_df = generator.to_timegpt_format(df, sensor_id="TEST_001")

        with patch("forecasting.timegpt_client.TimeGPTClient") as MockClient:
            mock_instance = MockClient.return_value
            mock_instance.forecast.return_value = _create_mock_forecast_df(7)

            results = generate_all_forecasts(timegpt_df, api_key="test_key")

            assert "ph" in results
            assert "turbidity" in results
            assert "temperature" in results
            assert mock_instance.forecast.call_count == 3


class TestForecastStorage:
    def test_forecast_stored_in_database(self, db_session):
        from forecasting.timegpt_client import store_forecast
        from db.models import Sensor, Prediction

        sensor = Sensor(sensor_id="FORECAST_TEST", name="Forecast Test Sensor")
        db_session.add(sensor)
        db_session.commit()

        forecast_df = _create_mock_forecast_df(7)
        prediction = store_forecast(
            db_session,
            sensor_id=sensor.id,
            parameter="ph",
            forecast_df=forecast_df,
        )

        assert prediction.id is not None
        assert prediction.parameter == "ph"
        assert len(prediction.forecast_values) > 0


def _create_mock_forecast_response(days: int, with_intervals: bool = False) -> dict:
    hours = days * 24
    base_time = datetime.now(timezone.utc)
    response = {
        "timestamp": [(base_time + timedelta(hours=i)).isoformat() for i in range(hours)],
        "value": [7.0 + 0.1 * i for i in range(hours)],
    }
    if with_intervals:
        response["lower"] = [6.5 + 0.1 * i for i in range(hours)]
        response["upper"] = [7.5 + 0.1 * i for i in range(hours)]
    return response


def _create_mock_forecast_df(days: int) -> pd.DataFrame:
    hours = days * 24
    base_time = datetime.now(timezone.utc)
    return pd.DataFrame(
        {
            "timestamp": [base_time + timedelta(hours=i) for i in range(hours)],
            "value": [7.0 + 0.01 * i for i in range(hours)],
            "lower": [6.8 + 0.01 * i for i in range(hours)],
            "upper": [7.2 + 0.01 * i for i in range(hours)],
        }
    )
