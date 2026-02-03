import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, date
from ai.main import (
    get_forecast_compatibility,
    ForecastCompatibilityRequest,
    _last_forecast_regeneration,
    _last_forecast_failure,
)


@pytest.mark.asyncio
async def test_forecast_regeneration_distributed_locking():
    # Setup mocks
    mock_db = AsyncMock()
    # Mock DB queries to force "should_refresh = True"
    # The function queries:
    # 1. _get_latest_reading -> None
    # 2. _format_current_sensor_state -> ...
    # 3. Reading count -> 24 (good data)
    # 4. Prediction -> None (force refresh)

    # We need to carefully mock the returns of db.execute
    # This is complex because multiple queries happen.
    # Instead of mocking DB extensively, let's patch the helpers or the logic flow.
    # Actually, simpler: patch 'ai.main.check_forecast_staleness' ?
    # But get_forecast_compatibility logic for 'should_refresh' is partly outside check_forecast_staleness.

    # Let's try to mock the specific calls.
    # The code does:
    # latest_reading = await _get_latest_reading(...)
    # ...
    # count_result = await db.execute(...) -> scalar_one()
    # prediction_query = ... -> result.scalar_one_or_none()

    # If we patch 'ai.main._get_latest_reading', 'ai.main._format_current_sensor_state' etc, it's easier.

    with (
        patch("ai.main._get_latest_reading", new_callable=AsyncMock) as mock_get_reading,
        patch("ai.main.ws_manager.get_redis_client", new_callable=AsyncMock) as mock_get_redis,
        patch(
            "ai.main._generate_and_store_forecast_for_sensor", new_callable=AsyncMock
        ) as mock_generate,
        patch("ai.main.check_forecast_staleness") as mock_staleness,
    ):
        # 1. Mock Redis
        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        # Redis Lock behavior:
        # First call to set(nx=True) returns True
        # Subsequent calls return False (until deleted?)
        # Since we run in parallel, we need a side_effect that manages state
        lock_state = {"locked": False}

        async def mock_set(key, value, nx=False, ex=None):
            if nx:
                if lock_state["locked"]:
                    return False
                lock_state["locked"] = True
                return True
            return True

        async def mock_delete(key):
            lock_state["locked"] = False
            return True

        async def mock_get(key):
            return None

        mock_redis.set.side_effect = mock_set
        mock_redis.delete.side_effect = mock_delete
        mock_redis.get.side_effect = mock_get

        # 2. Mock Generator
        async def slow_generate(*args, **kwargs):
            await asyncio.sleep(0.1)
            return {"status": "success", "predictions_generated": 10}

        mock_generate.side_effect = slow_generate

        # 3. Mock DB / Helpers to trigger refresh
        mock_get_reading.return_value = None  # No reading, but we want to trigger flow

        # Wait, if latest_reading is None, logic continues.
        # "if recent_ph_count < 12" -> warning.
        # We want to hit the block where it checks prediction.

        # We need db.execute to return specific things.
        # Let's mock db.execute to return a mock that has scalar_one/scalar_one_or_none

        async def mock_execute(query):
            m = MagicMock()
            m.scalar_one.return_value = 20  # > 12, so data quality good
            m.scalar_one_or_none.return_value = None  # No prediction -> trigger refresh
            m.scalars().all.return_value = []
            return m

        mock_db.execute.side_effect = mock_execute

        # 4. Ensure globals are clean
        _last_forecast_regeneration.clear()
        _last_forecast_failure.clear()

        # 5. Run Concurrent Requests
        req = ForecastCompatibilityRequest(sensor_id=123, horizon_hours=168)

        tasks = [
            get_forecast_compatibility(req, mock_db),
            get_forecast_compatibility(req, mock_db),
            get_forecast_compatibility(req, mock_db),
            get_forecast_compatibility(req, mock_db),
        ]

        results = await asyncio.gather(*tasks)

        # 6. Verify
        # Should call generate exactly ONCE
        assert mock_generate.call_count == 1

        # Should attempt to acquire lock 4 times
        # Redis set calls: 1 successful lock, 3 failed locks
        # Plus maybe other set calls? No, just the lock attempt + timestamp update (1 time)
        # 4 attempts + 1 success update = 5 calls?
        # Actually set(nx=True) is called 4 times. set(ts) is called 1 time.
        # So total >= 5.
        assert mock_redis.set.call_count >= 4

        # Verify lock was released
        assert mock_redis.delete.call_count == 1

        # Verify timestamp update
        # One call to set timestamp
        # Check that one call was NOT nx=True
        # We can inspect call_args_list
