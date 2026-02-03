import pytest
import pandas as pd
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from unittest.mock import MagicMock, patch
from ai.forecasting.timegpt_client import TimeGPTClient
from ai.schemas.forecast import ForecastPoint
from ai.main import compute_forecast_window, check_forecast_staleness, _trim_forecast_to_window


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


class TestComputeForecastWindow:
    """Tests for compute_forecast_window helper"""

    def test_basic_window_calculation(self):
        """Test that window is anchored to today 00:00 WIB"""
        # Feb 1, 2026 12:00 UTC = Feb 1, 2026 19:00 WIB
        now_utc = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        window_start, window_end = compute_forecast_window(now_utc)

        # Window start should be Feb 1, 2026 00:00 WIB = Jan 31, 2026 17:00 UTC
        expected_start = datetime(2026, 1, 31, 17, 0, 0, tzinfo=timezone.utc)
        expected_end = expected_start + timedelta(hours=168)  # Default 7 days

        assert window_start == expected_start
        assert window_end == expected_end

    def test_naive_datetime_treated_as_utc(self):
        """Test that naive datetimes are treated as UTC"""
        now_naive = datetime(2026, 2, 1, 12, 0, 0)
        window_start, window_end = compute_forecast_window(now_naive)

        expected_start = datetime(2026, 1, 31, 17, 0, 0, tzinfo=timezone.utc)
        assert window_start == expected_start

    def test_window_span_is_7_days(self):
        """Test that default window is exactly 7 days (168 hours)"""
        now_utc = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        window_start, window_end = compute_forecast_window(now_utc)

        assert (window_end - window_start) == timedelta(hours=168)

    def test_window_span_24_hours(self):
        """Test that 24h window is exactly 24 hours"""
        now_utc = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        window_start, window_end = compute_forecast_window(now_utc, horizon_hours=24)

        assert (window_end - window_start) == timedelta(hours=24)

    def test_window_span_30_days(self):
        """Test that 30d window is exactly 720 hours"""
        now_utc = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        window_start, window_end = compute_forecast_window(now_utc, horizon_hours=720)

        assert (window_end - window_start) == timedelta(hours=720)


class TestCheckForecastStaleness:
    """Tests for check_forecast_staleness helper"""

    def test_no_prediction_is_stale(self):
        """Test that no prediction is considered stale"""
        now_utc = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        window_end = now_utc + timedelta(days=7)

        result = check_forecast_staleness(None, None, window_end, now_utc)

        assert result["is_stale"] is True
        assert result["stale_reason"] == "no_prediction"

    def test_forecast_end_before_window_end_is_stale(self):
        """Test that forecast ending before window end is stale"""
        now_utc = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        window_end = now_utc + timedelta(days=7)

        prediction = MagicMock()
        prediction.created_at = now_utc
        prediction.forecast_end = now_utc + timedelta(days=6)  # Ends before window

        result = check_forecast_staleness(prediction, None, window_end, now_utc)

        assert result["is_stale"] is True
        assert result["stale_reason"] == "forecast_end_before_window_end"

    def test_created_before_today_wib_is_stale(self):
        """Test that prediction created before today WIB is stale"""
        # Feb 2, 2026 00:00 UTC = Feb 2, 2026 07:00 WIB
        now_utc = datetime(2026, 2, 2, 0, 0, 0, tzinfo=timezone.utc)
        window_end = now_utc + timedelta(days=7)

        # Prediction created Feb 1, 2026 12:00 UTC = Feb 1, 2026 19:00 WIB
        prediction = MagicMock()
        prediction.created_at = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        prediction.forecast_end = window_end + timedelta(days=1)

        result = check_forecast_staleness(prediction, None, window_end, now_utc)

        assert result["is_stale"] is True
        assert result["stale_reason"] == "created_before_today_wib"

    def test_newer_reading_exists_is_stale(self):
        """Test that prediction older than latest reading is stale"""
        now_utc = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        window_end = now_utc + timedelta(days=7)

        prediction = MagicMock()
        prediction.created_at = now_utc - timedelta(hours=2)
        prediction.forecast_end = window_end + timedelta(days=1)

        latest_reading = MagicMock()
        latest_reading.timestamp = now_utc - timedelta(hours=1)

        result = check_forecast_staleness(prediction, latest_reading, window_end, now_utc)

        assert result["is_stale"] is True
        assert result["stale_reason"] == "newer_reading_exists"

    def test_fresh_prediction_is_not_stale(self):
        """Test that fresh prediction is not stale"""
        now_utc = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        window_start, window_end = compute_forecast_window(now_utc)

        prediction = MagicMock()
        prediction.created_at = now_utc
        prediction.forecast_end = window_end + timedelta(days=1)

        result = check_forecast_staleness(prediction, None, window_end, now_utc)

        assert result["is_stale"] is False
        assert result["stale_reason"] is None

    def test_daily_refresh_precedence_over_newer_reading(self):
        """Test that created_before_today_wib takes precedence over newer_reading_exists"""
        # Feb 2, 2026 00:00 UTC = Feb 2, 2026 07:00 WIB (today)
        now_utc = datetime(2026, 2, 2, 0, 0, 0, tzinfo=timezone.utc)
        window_end = now_utc + timedelta(hours=168)

        # Prediction created Feb 1, 2026 12:00 UTC = Feb 1, 2026 19:00 WIB (yesterday)
        prediction = MagicMock()
        prediction.created_at = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
        prediction.forecast_end = window_end + timedelta(days=1)

        # Latest reading today (newer than prediction)
        latest_reading = MagicMock()
        latest_reading.timestamp = datetime(2026, 2, 1, 23, 0, 0, tzinfo=timezone.utc)

        result = check_forecast_staleness(prediction, latest_reading, window_end, now_utc)

        # Should be stale due to created_before_today_wib, not newer_reading_exists
        assert result["is_stale"] is True
        assert result["stale_reason"] == "created_before_today_wib"


class TestTrimForecastToWindow:
    """Tests for _trim_forecast_to_window helper"""

    def test_filters_points_outside_window(self):
        """Test that points outside window are filtered out"""
        window_start = datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
        window_end = window_start + timedelta(days=7)

        forecast = [
            {
                "timestamp": "2026-01-31T00:00:00Z",
                "ph_pred": 7.0,
                "confidence": 0.9,
            },  # Before window
            {"timestamp": "2026-02-02T00:00:00Z", "ph_pred": 7.1, "confidence": 0.9},  # In window
            {
                "timestamp": "2026-02-08T00:00:00Z",
                "ph_pred": 7.2,
                "confidence": 0.9,
            },  # At window end (exclusive)
            {
                "timestamp": "2026-02-09T00:00:00Z",
                "ph_pred": 7.3,
                "confidence": 0.9,
            },  # After window
        ]

        result = _trim_forecast_to_window(forecast, window_start, window_end)

        assert len(result) == 2
        assert [p["ph_pred"] for p in result] == [7.1, 7.2]

    def test_sorts_points_by_timestamp(self):
        """Test that points are sorted by timestamp ascending"""
        window_start = datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
        window_end = window_start + timedelta(days=7)

        forecast = [
            {"timestamp": "2026-02-03T00:00:00Z", "ph_pred": 7.2, "confidence": 0.9},
            {"timestamp": "2026-02-01T00:00:00Z", "ph_pred": 7.0, "confidence": 0.9},
            {"timestamp": "2026-02-02T00:00:00Z", "ph_pred": 7.1, "confidence": 0.9},
        ]

        result = _trim_forecast_to_window(forecast, window_start, window_end)

        assert len(result) == 3
        assert result[0]["ph_pred"] == 7.0
        assert result[1]["ph_pred"] == 7.1
        assert result[2]["ph_pred"] == 7.2

    def test_handles_datetime_objects(self):
        """Test that function handles datetime objects in timestamp field"""
        window_start = datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
        window_end = window_start + timedelta(days=7)

        forecast = [
            {
                "timestamp": datetime(2026, 2, 2, 0, 0, 0, tzinfo=timezone.utc),
                "ph_pred": 7.1,
                "confidence": 0.9,
            },
        ]

        result = _trim_forecast_to_window(forecast, window_start, window_end)

        assert len(result) == 1
        assert result[0]["ph_pred"] == 7.1

    def test_handles_naive_datetimes(self):
        """Test that function handles naive datetimes (treated as UTC)"""
        window_start = datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
        window_end = window_start + timedelta(days=7)

        forecast = [
            {"timestamp": datetime(2026, 2, 2, 0, 0, 0), "ph_pred": 7.1, "confidence": 0.9},
        ]

        result = _trim_forecast_to_window(forecast, window_start, window_end)

        assert len(result) == 1

    def test_returns_empty_list_for_no_valid_points(self):
        """Test that empty list is returned when no points are in window"""
        window_start = datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
        window_end = window_start + timedelta(days=7)

        forecast = [
            {"timestamp": "2026-01-31T00:00:00Z", "ph_pred": 7.0, "confidence": 0.9},
            {"timestamp": "2026-02-09T00:00:00Z", "ph_pred": 7.1, "confidence": 0.9},
        ]

        result = _trim_forecast_to_window(forecast, window_start, window_end)

        assert result == []
