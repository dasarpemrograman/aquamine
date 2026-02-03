import asyncio
import os
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ai.config exits the process if required env vars are missing.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://aquamine:changeme@localhost:5432/aquamine_db"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("INGEST_API_KEY", "test")
os.environ.setdefault("CLERK_SECRET_KEY", "test")
os.environ.setdefault("CLERK_ISSUER", "test")
os.environ.setdefault("ENVIRONMENT", "test")

# Allow importing ai.main in minimal test envs.
try:  # pragma: no cover
    import slowapi  # noqa: F401
except ModuleNotFoundError:  # pragma: no cover
    slowapi_mod = types.ModuleType("slowapi")
    slowapi_util_mod = types.ModuleType("slowapi.util")
    slowapi_errors_mod = types.ModuleType("slowapi.errors")

    class RateLimitExceeded(Exception):
        pass

    def get_remote_address(_request):
        return "test"

    def _rate_limit_exceeded_handler(_request, _exc):
        return None

    class Limiter:
        def __init__(self, *args, **kwargs):
            self.enabled = kwargs.get("enabled", True)

        def limit(self, *_args, **_kwargs):
            def decorator(fn):
                return fn

            return decorator

    setattr(slowapi_mod, "Limiter", Limiter)
    setattr(slowapi_mod, "_rate_limit_exceeded_handler", _rate_limit_exceeded_handler)
    setattr(slowapi_util_mod, "get_remote_address", get_remote_address)
    setattr(slowapi_errors_mod, "RateLimitExceeded", RateLimitExceeded)

    sys.modules["slowapi"] = slowapi_mod
    sys.modules["slowapi.util"] = slowapi_util_mod
    sys.modules["slowapi.errors"] = slowapi_errors_mod

if "uvicorn.middleware.proxy_headers" not in sys.modules:
    uvicorn_mod = types.ModuleType("uvicorn")
    middleware_mod = types.ModuleType("uvicorn.middleware")
    proxy_headers_mod = types.ModuleType("uvicorn.middleware.proxy_headers")

    class ProxyHeadersMiddleware:  # pragma: no cover
        def __init__(self, app, **_kwargs):
            self.app = app

        async def __call__(self, scope, receive, send):
            return await self.app(scope, receive, send)

    setattr(proxy_headers_mod, "ProxyHeadersMiddleware", ProxyHeadersMiddleware)
    setattr(uvicorn_mod, "middleware", middleware_mod)
    setattr(middleware_mod, "proxy_headers", proxy_headers_mod)

    sys.modules["uvicorn"] = uvicorn_mod
    sys.modules["uvicorn.middleware"] = middleware_mod
    sys.modules["uvicorn.middleware.proxy_headers"] = proxy_headers_mod

from ai.main import (
    ForecastCompatibilityRequest,
    FORECAST_REGEN_FAILURE_TTL_SECONDS,
    FORECAST_REGEN_LOCK_TTL_SECONDS,
    FORECAST_REGEN_TS_TTL_SECONDS,
    get_forecast_compatibility,
)


class FakeRedis:
    def __init__(self):
        self._data: dict[str, object] = {}
        self._expiry: dict[str, float] = {}
        self._lock = asyncio.Lock()

        self.set_calls: list[tuple[str, object, bool, int | None]] = []
        self.get_calls: list[str] = []
        self.delete_calls: list[str] = []
        self.eval_calls: list[tuple[str, int, tuple[object, ...]]] = []

    def _now(self) -> float:
        return asyncio.get_running_loop().time()

    def _purge_if_expired(self, key: str) -> None:
        exp = self._expiry.get(key)
        if exp is not None and exp <= self._now():
            self._data.pop(key, None)
            self._expiry.pop(key, None)

    async def get(self, key: str):
        self.get_calls.append(key)
        async with self._lock:
            self._purge_if_expired(key)
            val = self._data.get(key)
            if val is None:
                return None
            if isinstance(val, (bytes, bytearray)):
                return bytes(val)
            if isinstance(val, str):
                return val.encode("utf-8")
            return str(val).encode("utf-8")

    async def set(self, key: str, value, nx: bool = False, ex: int | None = None):
        self.set_calls.append((key, value, nx, ex))
        async with self._lock:
            self._purge_if_expired(key)
            if nx and key in self._data:
                return False

            self._data[key] = value
            if ex is not None:
                self._expiry[key] = self._now() + int(ex)
            else:
                self._expiry.pop(key, None)
            return True

    async def delete(self, key: str):
        self.delete_calls.append(key)
        async with self._lock:
            existed = 1 if key in self._data else 0
            self._data.pop(key, None)
            self._expiry.pop(key, None)
            return existed

    async def eval(self, script: str, numkeys: int, *keys_and_args):
        self.eval_calls.append((script, numkeys, keys_and_args))
        if numkeys != 1 or len(keys_and_args) < 2:
            raise AssertionError("Unexpected eval signature")
        key = str(keys_and_args[0])
        token = str(keys_and_args[1])
        async with self._lock:
            self._purge_if_expired(key)
            current = self._data.get(key)
            if current == token:
                self._data.pop(key, None)
                self._expiry.pop(key, None)
                return 1
            return 0


@pytest.mark.asyncio
async def test_forecast_regeneration_distributed_locking():
    mock_db = AsyncMock()

    with (
        patch("ai.main._get_latest_reading", new_callable=AsyncMock) as mock_get_reading,
        patch("ai.main.ws_manager.get_redis_client", new_callable=AsyncMock) as mock_get_redis,
        patch(
            "ai.main._generate_and_store_forecast_for_sensor", new_callable=AsyncMock
        ) as mock_generate,
        patch("ai.main.check_forecast_staleness") as mock_staleness,
    ):
        fake_redis = FakeRedis()
        mock_get_redis.return_value = fake_redis

        async def slow_generate(*_args, **_kwargs):
            await asyncio.sleep(0.1)
            return {"status": "success", "predictions_generated": 10}

        mock_generate.side_effect = slow_generate
        mock_get_reading.return_value = None
        mock_staleness.return_value = {"is_stale": True, "stale_reason": "no_prediction"}

        async def mock_execute(_query):
            m = MagicMock()
            m.scalar_one.return_value = 20
            m.scalar_one_or_none.return_value = None
            m.scalars().all.return_value = []
            return m

        mock_db.execute.side_effect = mock_execute

        req = ForecastCompatibilityRequest(sensor_id=123, horizon_hours=168)
        await asyncio.gather(
            get_forecast_compatibility(req, mock_db),
            get_forecast_compatibility(req, mock_db),
            get_forecast_compatibility(req, mock_db),
            get_forecast_compatibility(req, mock_db),
        )

        assert mock_generate.call_count == 1

        lock_sets = [c for c in fake_redis.set_calls if c[0].startswith("forecast:regen:lock:")]
        assert len(lock_sets) == 4
        assert all(
            (nx is True and ex is not None and ex == FORECAST_REGEN_LOCK_TTL_SECONDS)
            for _, _, nx, ex in lock_sets
        )

        ts_sets = [c for c in fake_redis.set_calls if c[0].startswith("forecast:regen:ts:")]
        assert len(ts_sets) == 1
        ts_ex = ts_sets[0][3]
        assert ts_ex is not None
        assert ts_ex == FORECAST_REGEN_TS_TTL_SECONDS

        assert len(fake_redis.eval_calls) == 1


@pytest.mark.asyncio
async def test_forecast_regeneration_failure_sets_failure_timestamp_with_ttl():
    mock_db = AsyncMock()

    with (
        patch("ai.main._get_latest_reading", new_callable=AsyncMock) as mock_get_reading,
        patch("ai.main.ws_manager.get_redis_client", new_callable=AsyncMock) as mock_get_redis,
        patch(
            "ai.main._generate_and_store_forecast_for_sensor", new_callable=AsyncMock
        ) as mock_generate,
        patch("ai.main.check_forecast_staleness") as mock_staleness,
    ):
        fake_redis = FakeRedis()
        mock_get_redis.return_value = fake_redis

        async def slow_fail(*_args, **_kwargs):
            await asyncio.sleep(0.1)
            return {"status": "error", "message": "boom"}

        mock_generate.side_effect = slow_fail
        mock_get_reading.return_value = None
        mock_staleness.return_value = {"is_stale": True, "stale_reason": "no_prediction"}

        async def mock_execute(_query):
            m = MagicMock()
            m.scalar_one.return_value = 20
            m.scalar_one_or_none.return_value = None
            m.scalars().all.return_value = []
            return m

        mock_db.execute.side_effect = mock_execute

        req = ForecastCompatibilityRequest(sensor_id=123, horizon_hours=168)
        await asyncio.gather(
            get_forecast_compatibility(req, mock_db),
            get_forecast_compatibility(req, mock_db),
            get_forecast_compatibility(req, mock_db),
        )

        assert mock_generate.call_count == 1

        lock_sets = [c for c in fake_redis.set_calls if c[0].startswith("forecast:regen:lock:")]
        assert len(lock_sets) == 3
        assert all(
            (nx is True and ex is not None and ex == FORECAST_REGEN_LOCK_TTL_SECONDS)
            for _, _, nx, ex in lock_sets
        )

        ts_sets = [c for c in fake_redis.set_calls if c[0].startswith("forecast:regen:ts:")]
        assert ts_sets == []

        fail_sets = [c for c in fake_redis.set_calls if c[0].startswith("forecast:regen:failure:")]
        assert len(fail_sets) == 1
        fail_ex = fail_sets[0][3]
        assert fail_ex == FORECAST_REGEN_FAILURE_TTL_SECONDS

        assert len(fake_redis.eval_calls) == 1
