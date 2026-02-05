from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from ai.db.connection import get_db
from ai.main import app
from ai.schemas.analytics import (
    AnalyticsInsightsResponse,
    EvidenceCitation,
    InsightFinding,
    InsightsExecutiveSummary,
)


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one(self):
        return self._value


class _OneResult:
    def __init__(self, row):
        self._row = row

    def one(self):
        return self._row


class _AllResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class DummySession:
    def __init__(self, results):
        self._results = list(results)
        self.execute_calls = 0

    async def execute(self, _stmt):
        if self.execute_calls >= len(self._results):
            raise AssertionError("Unexpected execute() call")
        res = self._results[self.execute_calls]
        self.execute_calls += 1
        return res


class FakeRedis:
    def __init__(self):
        self._data: dict[str, bytes] = {}
        self.set_calls = []
        self.get_calls = []

    async def get(self, key: str):
        self.get_calls.append(key)
        return self._data.get(key)

    async def set(self, key: str, value: str, ex: int | None = None, nx: bool | None = None):
        self.set_calls.append((key, value, ex, nx))
        self._data[key] = value.encode("utf-8")
        return True


def test_analytics_summary_shape(client):
    session = DummySession(
        [
            _ScalarResult(3),
            _ScalarResult(2),
            _ScalarResult(1),
            _OneResult(
                SimpleNamespace(
                    ph_avg=6.8,
                    ph_min=5.2,
                    ph_max=7.5,
                    ph_samples=12,
                    ph_violations=2,
                    turbidity_avg=45.2,
                    turbidity_min=20.0,
                    turbidity_max=180.0,
                    turbidity_samples=8,
                    turbidity_violations=5,
                    temperature_avg=27.5,
                    temperature_min=24.2,
                    temperature_max=31.0,
                    temperature_samples=6,
                    temperature_violations=0,
                )
            ),
            _AllResult([("critical", 3), ("warning", 10), ("info", 2)]),
            _ScalarResult(5),
        ]
    )

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        resp = client.get("/api/v1/analytics/summary")
        assert resp.status_code == 200
        data = resp.json()

        assert data["period"] == "24h"
        assert data["system_health"]["total_sensors"] == 3
        assert data["system_health"]["active_sensors"] == 2
        assert data["system_health"]["offline_sensors"] == 1
        assert data["system_health"]["sensors_low_battery"] == 1

        assert data["alerts"]["total_24h"] == 15
        assert data["alerts"]["critical"] == 3
        assert data["alerts"]["warning"] == 10
        assert data["alerts"]["info"] == 2
        assert data["alerts"]["unacknowledged"] == 5

        assert data["water_quality"]["ph"]["percent_compliance"] == 83.33
        assert data["water_quality"]["turbidity"]["percent_compliance"] == 37.5
        assert data["water_quality"]["temperature"]["percent_compliance"] == 100.0
    finally:
        app.dependency_overrides = {}


def test_analytics_compliance_includes_standard_values(client, monkeypatch):
    monkeypatch.setattr("ai.routers.analytics.supports_time_bucket", AsyncMock(return_value=False))

    session = DummySession(
        [
            _OneResult(
                SimpleNamespace(
                    ph_samples=10,
                    ph_violations=1,
                    turb_samples=10,
                    turb_violations=2,
                    temp_samples=10,
                    temp_violations=0,
                )
            ),
            _AllResult([SimpleNamespace(v=1), SimpleNamespace(v=1), SimpleNamespace(v=0)]),
            _AllResult([SimpleNamespace(v=1), SimpleNamespace(v=1), SimpleNamespace(v=1)]),
            _AllResult([SimpleNamespace(v=0)]),
        ]
    )

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        resp = client.get("/api/v1/analytics/compliance?period=7d")
        assert resp.status_code == 200
        data = resp.json()

        assert data["period"] == "7d"
        assert data["standard"]["source"] == "KepMen LH 113/2003"
        assert data["standard"]["ph_min"] == 6.0
        assert data["standard"]["ph_max"] == 9.0
        assert data["standard"]["turbidity_max_ntu"] == 50
        assert data["standard"]["temperature_max_c"] == 35

        assert data["ph"]["percent_compliance"] == 90.0
        assert data["turbidity"]["percent_compliance"] == 80.0
        assert data["temperature"]["percent_compliance"] == 100.0

        assert data["violation_hours"] == 2.0
        assert data["trend"] == "improving"
    finally:
        app.dependency_overrides = {}


def test_analytics_insights_uses_redis_cache(client, monkeypatch):
    import ai.routers.analytics as analytics_router

    fake_redis = FakeRedis()
    monkeypatch.setattr(
        analytics_router.ws_manager, "get_redis_client", AsyncMock(return_value=fake_redis)
    )

    evidence = {
        "period": "24h",
        "generated_at": "2026-01-01T00:00:00Z",
        "standard": {
            "source": "KepMen LH 113/2003",
            "ph_min": 6.0,
            "ph_max": 9.0,
            "turbidity_max_ntu": 50,
            "temperature_max_c": 35,
        },
        "numeric": {"compliance.ph_percent": 90.0},
        "alerts": {},
        "anomalies": {},
        "data_quality": {"trend_points": 24, "raw_samples": 100},
        "raw_samples": [],
        "sensors": [],
        "compliance": {},
    }
    monkeypatch.setattr(
        analytics_router, "build_insights_evidence", AsyncMock(return_value=evidence)
    )

    ts = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    mocked = AnalyticsInsightsResponse(
        generated_at=ts,
        period="24h",
        executive_summary=InsightsExecutiveSummary(
            status="NORMAL",
            headline="OK",
            severity_score=10,
            trend="stable",
            recommendation="Monitor",
            evidence=[EvidenceCitation(key="compliance.ph_percent", value=90.0, unit="percent")],
        ),
        key_findings=[
            InsightFinding(
                type="compliance",
                title="pH",
                description="Kepatuhan pH.",
                confidence=0.9,
                recommended_actions=[],
                evidence=[
                    EvidenceCitation(key="compliance.ph_percent", value=90.0, unit="percent")
                ],
            )
        ],
        evidence=evidence,
    )

    llm_mock = AsyncMock(return_value=mocked)
    monkeypatch.setattr(analytics_router, "generate_insights_with_llm", llm_mock)

    session = DummySession([])

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        resp1 = client.get("/api/v1/analytics/insights")
        assert resp1.status_code == 200
        body1 = resp1.json()

        resp2 = client.get("/api/v1/analytics/insights")
        assert resp2.status_code == 200
        body2 = resp2.json()

        assert body1 == body2
        assert llm_mock.call_count == 1

        assert len(fake_redis.set_calls) == 1
        key, value, ex, _nx = fake_redis.set_calls[0]
        assert key.startswith("analytics:insights:24h")
        assert ex == 300
        json.loads(value)
    finally:
        app.dependency_overrides = {}
