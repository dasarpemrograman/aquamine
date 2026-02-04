from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.analytics.insights import (
    INSIGHTS_CACHE_TTL_SECONDS,
    MAX_TREND_POINTS,
    build_insights_evidence,
    deterministic_insights_response,
    fetch_trend_points,
    generate_insights_with_llm,
    supports_time_bucket,
)
from ai.config import settings
from ai.db.connection import get_db
from ai.db.models import Alert, Reading, Sensor, SensorAlertState
from ai.realtime.websocket import manager as ws_manager
from ai.schemas.analytics import (
    AnalyticsAlertsSummary,
    AnalyticsComplianceResponse,
    AnalyticsHeatmapResponse,
    AnalyticsInsightsResponse,
    AnalyticsMetricSummary,
    AnalyticsSummaryResponse,
    AnalyticsSystemHealth,
    AnalyticsTrendPoint,
    AnalyticsTrendsResponse,
    AnalyticsWaterQualitySummary,
    ComplianceMetric,
    ComplianceStandard,
    HeatmapSensor,
    LatestReading,
    MetricStatus,
)

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_period(period: str) -> timedelta:
    if period == "24h":
        return timedelta(hours=24)
    if period == "1d":
        return timedelta(days=1)
    if period == "7d":
        return timedelta(days=7)
    if period == "30d":
        return timedelta(days=30)
    raise HTTPException(status_code=400, detail="Invalid period")


UNKNOWN_STATUS: MetricStatus = "unknown"
NORMAL_STATUS: MetricStatus = "normal"
WARNING_STATUS: MetricStatus = "warning"
CRITICAL_STATUS: MetricStatus = "critical"


def _status_from_percent(pct: Optional[float]) -> MetricStatus:
    if pct is None:
        return UNKNOWN_STATUS
    if pct >= 95.0:
        return NORMAL_STATUS
    if pct >= 80.0:
        return WARNING_STATUS
    return CRITICAL_STATUS


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(period: str = "24h", db: AsyncSession = Depends(get_db)):
    if period != "24h":
        raise HTTPException(status_code=400, detail="Only period=24h is supported")

    now = _now_utc()
    start = now - timedelta(hours=24)

    # System health
    total_sensors = int((await db.execute(select(func.count(Sensor.id)))).scalar_one())
    active_sensors = int(
        (
            await db.execute(
                select(func.count(func.distinct(Reading.sensor_id))).where(
                    Reading.timestamp >= now - timedelta(hours=2)
                )
            )
        ).scalar_one()
    )
    offline_sensors = max(total_sensors - active_sensors, 0)

    # Low battery on latest readings
    latest = select(
        Reading.sensor_id.label("sensor_db_id"),
        Reading.battery_voltage.label("battery_voltage"),
        func.row_number()
        .over(partition_by=Reading.sensor_id, order_by=Reading.timestamp.desc())
        .label("rn"),
    ).subquery()
    low_battery_count = int(
        (
            await db.execute(
                select(func.count())
                .select_from(latest)
                .where(
                    latest.c.rn == 1,
                    latest.c.battery_voltage.is_not(None),
                    latest.c.battery_voltage < 3.7,
                )
            )
        ).scalar_one()
    )

    # Water quality aggregates + compliance percent (using compliance standards)
    ph_min = settings.COMPLIANCE_PH_MIN
    ph_max = settings.COMPLIANCE_PH_MAX
    turb_max = settings.COMPLIANCE_TURBIDITY_MAX_NTU
    temp_max = settings.COMPLIANCE_TEMPERATURE_MAX_C

    agg_stmt = select(
        func.avg(Reading.ph).label("ph_avg"),
        func.min(Reading.ph).label("ph_min"),
        func.max(Reading.ph).label("ph_max"),
        func.count(Reading.ph).label("ph_samples"),
        func.sum(
            case(
                (
                    and_(
                        Reading.ph.is_not(None),
                        (Reading.ph < ph_min) | (Reading.ph > ph_max),
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("ph_violations"),
        func.avg(Reading.turbidity).label("turbidity_avg"),
        func.min(Reading.turbidity).label("turbidity_min"),
        func.max(Reading.turbidity).label("turbidity_max"),
        func.count(Reading.turbidity).label("turbidity_samples"),
        func.sum(
            case(
                (
                    and_(
                        Reading.turbidity.is_not(None),
                        Reading.turbidity > turb_max,
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("turbidity_violations"),
        func.avg(Reading.temperature).label("temperature_avg"),
        func.min(Reading.temperature).label("temperature_min"),
        func.max(Reading.temperature).label("temperature_max"),
        func.count(Reading.temperature).label("temperature_samples"),
        func.sum(
            case(
                (
                    and_(
                        Reading.temperature.is_not(None),
                        Reading.temperature > temp_max,
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("temperature_violations"),
    ).where(Reading.timestamp >= start, Reading.timestamp <= now)

    agg = (await db.execute(agg_stmt)).one()

    def pct(samples: int, violations: int) -> Optional[float]:
        if not samples:
            return None
        return round(100.0 * (samples - violations) / float(samples), 2)

    ph_pct = pct(int(agg.ph_samples or 0), int(agg.ph_violations or 0))
    turb_pct = pct(int(agg.turbidity_samples or 0), int(agg.turbidity_violations or 0))
    temp_pct = pct(int(agg.temperature_samples or 0), int(agg.temperature_violations or 0))

    # Alerts summary
    alerts_group = (
        await db.execute(
            select(Alert.severity, func.count(Alert.id))
            .where(Alert.created_at >= start, Alert.created_at <= now)
            .group_by(Alert.severity)
        )
    ).all()
    by_sev = {str(sev): int(cnt) for sev, cnt in alerts_group}
    unack = int(
        (
            await db.execute(
                select(func.count(Alert.id)).where(
                    Alert.created_at >= start,
                    Alert.created_at <= now,
                    Alert.acknowledged_at.is_(None),
                )
            )
        ).scalar_one()
    )

    return AnalyticsSummaryResponse(
        period=period,
        generated_at=now,
        system_health=AnalyticsSystemHealth(
            total_sensors=total_sensors,
            active_sensors=active_sensors,
            offline_sensors=offline_sensors,
            sensors_low_battery=low_battery_count,
        ),
        water_quality=AnalyticsWaterQualitySummary(
            ph=AnalyticsMetricSummary(
                avg=agg.ph_avg,
                min=agg.ph_min,
                max=agg.ph_max,
                percent_compliance=ph_pct,
                status=_status_from_percent(ph_pct),
            ),
            turbidity=AnalyticsMetricSummary(
                avg=agg.turbidity_avg,
                min=agg.turbidity_min,
                max=agg.turbidity_max,
                percent_compliance=turb_pct,
                status=_status_from_percent(turb_pct),
            ),
            temperature=AnalyticsMetricSummary(
                avg=agg.temperature_avg,
                min=agg.temperature_min,
                max=agg.temperature_max,
                percent_compliance=temp_pct,
                status=_status_from_percent(temp_pct),
            ),
        ),
        alerts=AnalyticsAlertsSummary(
            total_24h=sum(by_sev.values()),
            critical=int(by_sev.get("critical", 0)),
            warning=int(by_sev.get("warning", 0)),
            info=int(by_sev.get("info", 0)),
            unacknowledged=unack,
        ),
    )


@router.get("/trends", response_model=AnalyticsTrendsResponse)
async def get_analytics_trends(
    period: str = "7d",
    aggregation: str = "hourly",
    sensor_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    if aggregation not in {"hourly", "daily"}:
        raise HTTPException(status_code=400, detail="Invalid aggregation")
    aggregation_out = "hourly" if aggregation == "hourly" else "daily"

    window = _parse_period(period)
    now = _now_utc()
    start = now - window

    max_points = MAX_TREND_POINTS
    if period in {"24h", "1d"} and aggregation == "hourly":
        max_points = 24
    elif period == "7d" and aggregation == "hourly":
        max_points = 168
    elif period == "30d" and aggregation == "daily":
        max_points = 30
    elif period == "7d" and aggregation == "daily":
        max_points = 7

    points_raw = await fetch_trend_points(
        db,
        start=start,
        end=now,
        aggregation=aggregation_out,
        sensor_id=sensor_id,
        max_points=max_points,
    )

    points = [
        AnalyticsTrendPoint(
            timestamp=p["timestamp"],
            ph_avg=p.get("ph_avg"),
            ph_min=p.get("ph_min"),
            ph_max=p.get("ph_max"),
            turbidity_avg=p.get("turbidity_avg"),
            turbidity_min=p.get("turbidity_min"),
            turbidity_max=p.get("turbidity_max"),
            temperature_avg=p.get("temperature_avg"),
            temperature_min=p.get("temperature_min"),
            temperature_max=p.get("temperature_max"),
        )
        for p in points_raw
    ]

    return AnalyticsTrendsResponse(
        period=period,
        aggregation=aggregation_out,
        sensor_id=sensor_id,
        points=points,
    )


@router.get("/heatmap", response_model=AnalyticsHeatmapResponse)
async def get_analytics_heatmap(db: AsyncSession = Depends(get_db)):
    now = _now_utc()

    latest_reading = select(
        Reading.sensor_id.label("sensor_db_id"),
        Reading.timestamp.label("timestamp"),
        Reading.ph.label("ph"),
        Reading.turbidity.label("turbidity"),
        Reading.temperature.label("temperature"),
        Reading.battery_voltage.label("battery_voltage"),
        func.row_number()
        .over(partition_by=Reading.sensor_id, order_by=Reading.timestamp.desc())
        .label("rn"),
    ).subquery()

    stmt = (
        select(
            Sensor,
            SensorAlertState,
            latest_reading.c.timestamp,
            latest_reading.c.ph,
            latest_reading.c.turbidity,
            latest_reading.c.temperature,
            latest_reading.c.battery_voltage,
        )
        .join(
            latest_reading,
            and_(latest_reading.c.sensor_db_id == Sensor.id, latest_reading.c.rn == 1),
            isouter=True,
        )
        .join(SensorAlertState, SensorAlertState.sensor_id == Sensor.id, isouter=True)
        .order_by(Sensor.id)
    )

    res = await db.execute(stmt)
    sensors: list[HeatmapSensor] = []
    for sensor, state, ts, ph, turb, temp, batt in res.all():
        staleness = None
        if ts is not None:
            staleness = round((now - ts).total_seconds() / 3600.0, 2)
        sensors.append(
            HeatmapSensor(
                id=sensor.id,
                sensor_id=sensor.sensor_id,
                name=sensor.name,
                latitude=sensor.latitude,
                longitude=sensor.longitude,
                current_state=(state.current_state if state else "normal"),
                staleness_hours=staleness,
                latest_reading=LatestReading(
                    timestamp=ts,
                    ph=ph,
                    turbidity=turb,
                    temperature=temp,
                    battery_voltage=batt,
                ),
            )
        )

    return AnalyticsHeatmapResponse(generated_at=now, sensors=sensors)


@router.get("/compliance", response_model=AnalyticsComplianceResponse)
async def get_analytics_compliance(period: str = "7d", db: AsyncSession = Depends(get_db)):
    window = _parse_period(period)
    now = _now_utc()
    start = now - window

    standard = ComplianceStandard(
        source=settings.COMPLIANCE_STANDARD_SOURCE,
        ph_min=settings.COMPLIANCE_PH_MIN,
        ph_max=settings.COMPLIANCE_PH_MAX,
        turbidity_max_ntu=settings.COMPLIANCE_TURBIDITY_MAX_NTU,
        temperature_max_c=settings.COMPLIANCE_TEMPERATURE_MAX_C,
    )

    ph_min = standard.ph_min
    ph_max = standard.ph_max
    turb_max = standard.turbidity_max_ntu
    temp_max = standard.temperature_max_c

    ph_samples = func.count(Reading.ph)
    ph_violations = func.sum(
        case(
            (
                and_(
                    Reading.ph.is_not(None),
                    (Reading.ph < ph_min) | (Reading.ph > ph_max),
                ),
                1,
            ),
            else_=0,
        )
    )
    turb_samples = func.count(Reading.turbidity)
    turb_violations = func.sum(
        case(
            (
                and_(Reading.turbidity.is_not(None), Reading.turbidity > turb_max),
                1,
            ),
            else_=0,
        )
    )
    temp_samples = func.count(Reading.temperature)
    temp_violations = func.sum(
        case(
            (
                and_(Reading.temperature.is_not(None), Reading.temperature > temp_max),
                1,
            ),
            else_=0,
        )
    )

    agg_stmt = select(
        ph_samples.label("ph_samples"),
        ph_violations.label("ph_violations"),
        turb_samples.label("turb_samples"),
        turb_violations.label("turb_violations"),
        temp_samples.label("temp_samples"),
        temp_violations.label("temp_violations"),
    ).where(Reading.timestamp >= start, Reading.timestamp <= now)

    agg = (await db.execute(agg_stmt)).one()

    def pct(samples: int, violations: int) -> Optional[float]:
        if not samples:
            return None
        return round(100.0 * (samples - violations) / float(samples), 2)

    ph_pct = pct(int(agg.ph_samples or 0), int(agg.ph_violations or 0))
    turb_pct = pct(int(agg.turb_samples or 0), int(agg.turb_violations or 0))
    temp_pct = pct(int(agg.temp_samples or 0), int(agg.temp_violations or 0))

    # Violation hours: hourly buckets where ANY compliance violation occurs.
    use_time_bucket = await supports_time_bucket(db)
    if use_time_bucket:
        bucket = func.time_bucket("1 hour", Reading.timestamp)
    else:
        bucket = func.date_trunc("hour", Reading.timestamp)

    violation_flag = func.max(
        case(
            (
                and_(
                    Reading.ph.is_not(None),
                    ((Reading.ph < ph_min) | (Reading.ph > ph_max)),
                ),
                1,
            ),
            (
                and_(Reading.turbidity.is_not(None), Reading.turbidity > turb_max),
                1,
            ),
            (
                and_(Reading.temperature.is_not(None), Reading.temperature > temp_max),
                1,
            ),
            else_=0,
        )
    )

    hours_stmt = (
        select(bucket.label("b"), violation_flag.label("v"))
        .where(Reading.timestamp >= start, Reading.timestamp <= now)
        .group_by(bucket)
    )

    try:
        hours_res = await db.execute(hours_stmt)
        violation_hours = float(sum(int(r.v or 0) for r in hours_res.all()))
    except Exception:
        logger.warning("Failed to compute violation hours", exc_info=True)
        violation_hours = 0.0

    # Trend: compare violation hours in first/second half.
    mid = start + (now - start) / 2

    async def _violation_hours_between(a: datetime, b: datetime) -> float:
        stmt = (
            select(bucket.label("b"), violation_flag.label("v"))
            .where(Reading.timestamp >= a, Reading.timestamp <= b)
            .group_by(bucket)
        )
        try:
            res = await db.execute(stmt)
            return float(sum(int(r.v or 0) for r in res.all()))
        except Exception:
            logger.warning("Failed to compute violation hours for period", exc_info=True)
            return 0.0

    first_half = await _violation_hours_between(start, mid)
    second_half = await _violation_hours_between(mid, now)
    trend = "stable"
    if second_half + 1.0 < first_half:
        trend = "improving"
    elif first_half + 1.0 < second_half:
        trend = "degrading"

    return AnalyticsComplianceResponse(
        period=period,
        generated_at=now,
        standard=standard,
        ph=ComplianceMetric(
            percent_compliance=ph_pct,
            sample_count=int(agg.ph_samples or 0),
            violation_count=int(agg.ph_violations or 0),
        ),
        turbidity=ComplianceMetric(
            percent_compliance=turb_pct,
            sample_count=int(agg.turb_samples or 0),
            violation_count=int(agg.turb_violations or 0),
        ),
        temperature=ComplianceMetric(
            percent_compliance=temp_pct,
            sample_count=int(agg.temp_samples or 0),
            violation_count=int(agg.temp_violations or 0),
        ),
        violation_hours=round(float(violation_hours), 2),
        trend=trend,
    )


@router.get("/insights", response_model=AnalyticsInsightsResponse)
async def get_analytics_insights(
    period: str = "24h",
    sensor_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    if period != "24h":
        raise HTTPException(status_code=400, detail="Only period=24h is supported")

    redis = await ws_manager.get_redis_client()
    cache_key = (
        f"analytics:insights:{period}:sensor:{sensor_id if sensor_id is not None else 'all'}"
    )

    try:
        cached = await redis.get(cache_key)
    except Exception:
        cached = None

    if cached:
        try:
            payload = json.loads(cached.decode("utf-8"))
            return AnalyticsInsightsResponse.model_validate(payload)
        except Exception:
            pass

    now = _now_utc()
    evidence = await build_insights_evidence(db, period=period, sensor_id=sensor_id, now=now)

    parsed = await generate_insights_with_llm(evidence=evidence)
    if parsed is None:
        parsed = deterministic_insights_response(evidence)

    try:
        await redis.set(
            cache_key,
            json.dumps(parsed.model_dump(mode="json"), ensure_ascii=True),
            ex=INSIGHTS_CACHE_TTL_SECONDS,
        )
    except Exception:
        logger.warning("Failed to write insights cache", exc_info=True)

    return parsed
