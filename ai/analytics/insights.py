from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from ai.analytics.patterns import (
    ComplianceStandardValues,
    compliance_percent,
    compliance_ph,
    compliance_temperature,
    compliance_turbidity,
    evenly_spaced_sample,
    pearson_correlation,
    slope_per_hour,
)
from ai.chatbot.cerebras_client import CerebrasClient
from ai.config import settings
from ai.db.models import Alert, Anomaly, Reading, Sensor, SensorAlertState
from ai.schemas.analytics import (
    AnalyticsInsightsResponse,
    EvidenceCitation,
    InsightFinding,
    InsightsExecutiveSummary,
)

logger = logging.getLogger(__name__)


INSIGHTS_CACHE_TTL_SECONDS = 300
MAX_RAW_SAMPLES = 12
MAX_TREND_POINTS = 168
MIN_CORRELATION_POINTS = 20

_TIME_BUCKET_SUPPORTED: Optional[bool] = None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _format_dt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


async def supports_time_bucket(db: AsyncSession) -> bool:
    global _TIME_BUCKET_SUPPORTED
    if _TIME_BUCKET_SUPPORTED is not None:
        return _TIME_BUCKET_SUPPORTED

    try:
        res = await db.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'time_bucket')")
        )
        _TIME_BUCKET_SUPPORTED = bool(res.scalar_one())
    except Exception:
        _TIME_BUCKET_SUPPORTED = False
    return _TIME_BUCKET_SUPPORTED


def _bucket_expr(aggregation: str, use_time_bucket: bool):
    if aggregation not in {"hourly", "daily"}:
        raise ValueError("Invalid aggregation")

    if aggregation == "hourly":
        if use_time_bucket:
            return func.time_bucket("1 hour", Reading.timestamp)
        return func.date_trunc("hour", Reading.timestamp)

    if use_time_bucket:
        return func.time_bucket("1 day", Reading.timestamp)
    return func.date_trunc("day", Reading.timestamp)


async def fetch_trend_points(
    db: AsyncSession,
    *,
    start: datetime,
    end: datetime,
    aggregation: str,
    sensor_id: Optional[int] = None,
    max_points: int = MAX_TREND_POINTS,
) -> list[dict[str, Any]]:
    use_time_bucket = await supports_time_bucket(db)
    bucket = _bucket_expr(aggregation, use_time_bucket).label("bucket")

    stmt = (
        select(
            bucket,
            func.avg(Reading.ph).label("ph_avg"),
            func.min(Reading.ph).label("ph_min"),
            func.max(Reading.ph).label("ph_max"),
            func.avg(Reading.turbidity).label("turbidity_avg"),
            func.min(Reading.turbidity).label("turbidity_min"),
            func.max(Reading.turbidity).label("turbidity_max"),
            func.avg(Reading.temperature).label("temperature_avg"),
            func.min(Reading.temperature).label("temperature_min"),
            func.max(Reading.temperature).label("temperature_max"),
        )
        .where(Reading.timestamp >= start, Reading.timestamp <= end)
        .group_by(bucket)
        .order_by(bucket.asc())
    )
    if sensor_id is not None:
        stmt = stmt.where(Reading.sensor_id == sensor_id)

    try:
        res = await db.execute(stmt)
    except DBAPIError as exc:
        if use_time_bucket:
            logger.info("time_bucket failed; falling back to date_trunc")
            global _TIME_BUCKET_SUPPORTED
            _TIME_BUCKET_SUPPORTED = False

            # The failed statement can leave the transaction aborted.
            # Roll back before retrying with the fallback query.
            try:
                await db.rollback()
            except Exception:
                pass

            return await fetch_trend_points(
                db,
                start=start,
                end=end,
                aggregation=aggregation,
                sensor_id=sensor_id,
                max_points=max_points,
            )
        raise exc

    rows = res.all()
    points: list[dict[str, Any]] = []
    for row in rows:
        points.append(
            {
                "timestamp": row.bucket,
                "ph_avg": row.ph_avg,
                "ph_min": row.ph_min,
                "ph_max": row.ph_max,
                "turbidity_avg": row.turbidity_avg,
                "turbidity_min": row.turbidity_min,
                "turbidity_max": row.turbidity_max,
                "temperature_avg": row.temperature_avg,
                "temperature_min": row.temperature_min,
                "temperature_max": row.temperature_max,
            }
        )

    if len(points) > max_points:
        points = evenly_spaced_sample(points, max_points)
    return points


async def build_insights_evidence(
    db: AsyncSession,
    *,
    period: str = "24h",
    sensor_id: Optional[int] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    now_utc = now or _now_utc()
    if period != "24h":
        raise ValueError("Only period=24h is supported for insights")

    start = now_utc - timedelta(hours=24)

    standard = ComplianceStandardValues(
        source=settings.COMPLIANCE_STANDARD_SOURCE,
        ph_min=settings.COMPLIANCE_PH_MIN,
        ph_max=settings.COMPLIANCE_PH_MAX,
        turbidity_max_ntu=settings.COMPLIANCE_TURBIDITY_MAX_NTU,
        temperature_max_c=settings.COMPLIANCE_TEMPERATURE_MAX_C,
    )

    sensors_stmt = (
        select(Sensor, SensorAlertState)
        .join(SensorAlertState, SensorAlertState.sensor_id == Sensor.id, isouter=True)
        .order_by(Sensor.id)
    )
    if sensor_id is not None:
        sensors_stmt = sensors_stmt.where(Sensor.id == sensor_id)
    sensors_res = await db.execute(sensors_stmt)
    sensors_rows = sensors_res.all()

    # Trends (hourly) for slopes/correlation
    trend_points = await fetch_trend_points(
        db,
        start=start,
        end=now_utc,
        aggregation="hourly",
        sensor_id=sensor_id,
        max_points=MAX_TREND_POINTS,
    )

    ph_series = [
        (p["timestamp"], float(p["ph_avg"]))
        for p in trend_points
        if p.get("timestamp") is not None and p.get("ph_avg") is not None
    ]
    turb_series = [
        (p["timestamp"], float(p["turbidity_avg"]))
        for p in trend_points
        if p.get("timestamp") is not None and p.get("turbidity_avg") is not None
    ]
    temp_series = [
        (p["timestamp"], float(p["temperature_avg"]))
        for p in trend_points
        if p.get("timestamp") is not None and p.get("temperature_avg") is not None
    ]

    overall_ph_slope = slope_per_hour(ph_series)
    overall_turbidity_slope = slope_per_hour(turb_series)
    overall_temperature_slope = slope_per_hour(temp_series)

    # Correlation on paired bucket points
    paired_ph: list[float] = []
    paired_turb: list[float] = []
    for p in trend_points:
        phv = p.get("ph_avg")
        tv = p.get("turbidity_avg")
        if phv is None or tv is None:
            continue
        paired_ph.append(float(phv))
        paired_turb.append(float(tv))
    ph_turb_corr = pearson_correlation(paired_ph, paired_turb, min_points=MIN_CORRELATION_POINTS)

    # Alerts/anomalies summaries
    alerts_stmt = (
        select(Alert.severity, func.count(Alert.id))
        .where(Alert.created_at >= start, Alert.created_at <= now_utc)
        .group_by(Alert.severity)
    )
    if sensor_id is not None:
        alerts_stmt = alerts_stmt.where(Alert.sensor_id == sensor_id)
    alerts_res = await db.execute(alerts_stmt)
    alerts_by_sev = {str(sev): int(cnt) for sev, cnt in alerts_res.all()}

    anomalies_stmt = (
        select(Anomaly.parameter, func.count(Anomaly.id))
        .where(Anomaly.timestamp >= start, Anomaly.timestamp <= now_utc)
        .group_by(Anomaly.parameter)
    )
    if sensor_id is not None:
        anomalies_stmt = anomalies_stmt.where(Anomaly.sensor_id == sensor_id)
    anomalies_res = await db.execute(anomalies_stmt)
    anomalies_by_param = {str(param): int(cnt) for param, cnt in anomalies_res.all()}

    # Compliance stats (raw readings)
    readings_stmt = (
        select(Reading.timestamp, Reading.ph, Reading.turbidity, Reading.temperature)
        .where(Reading.timestamp >= start, Reading.timestamp <= now_utc)
        .order_by(Reading.timestamp.asc())
    )
    if sensor_id is not None:
        readings_stmt = readings_stmt.where(Reading.sensor_id == sensor_id)
    readings_res = await db.execute(readings_stmt)
    readings_rows = readings_res.all()

    ph_values = [r.ph for r in readings_rows]
    turb_values = [r.turbidity for r in readings_rows]
    temp_values = [r.temperature for r in readings_rows]

    ph_samples, ph_violations, ph_pct = compliance_percent(
        ph_values, lambda v: compliance_ph(v, standard)
    )
    turb_samples, turb_violations, turb_pct = compliance_percent(
        turb_values, lambda v: compliance_turbidity(v, standard)
    )
    temp_samples, temp_violations, temp_pct = compliance_percent(
        temp_values, lambda v: compliance_temperature(v, standard)
    )

    # Bounded raw samples to pass to the LLM
    raw_rows = evenly_spaced_sample(readings_rows, MAX_RAW_SAMPLES)
    raw_samples = [
        {
            "timestamp": _format_dt(r.timestamp),
            "ph": r.ph,
            "turbidity": r.turbidity,
            "temperature": r.temperature,
        }
        for r in raw_rows
    ]

    numeric: dict[str, float] = {}
    if overall_ph_slope is not None:
        numeric["overall.ph_slope_per_hour"] = float(round(overall_ph_slope, 4))
    if overall_turbidity_slope is not None:
        numeric["overall.turbidity_slope_per_hour"] = float(round(overall_turbidity_slope, 4))
    if overall_temperature_slope is not None:
        numeric["overall.temperature_slope_per_hour"] = float(round(overall_temperature_slope, 4))
    if ph_turb_corr is not None:
        numeric["overall.ph_turbidity_correlation"] = float(round(ph_turb_corr, 4))

    numeric["data.readings_samples"] = float(len(readings_rows))
    if ph_pct is not None:
        numeric["compliance.ph_percent"] = float(round(ph_pct, 2))
    if turb_pct is not None:
        numeric["compliance.turbidity_percent"] = float(round(turb_pct, 2))
    if temp_pct is not None:
        numeric["compliance.temperature_percent"] = float(round(temp_pct, 2))

    evidence = {
        "period": period,
        "generated_at": _format_dt(now_utc),
        "standard": {
            "source": standard.source,
            "ph_min": standard.ph_min,
            "ph_max": standard.ph_max,
            "turbidity_max_ntu": standard.turbidity_max_ntu,
            "temperature_max_c": standard.temperature_max_c,
        },
        "numeric": numeric,
        "alerts": alerts_by_sev,
        "anomalies": anomalies_by_param,
        "data_quality": {
            "trend_points": len(trend_points),
            "raw_samples": len(readings_rows),
        },
        "raw_samples": raw_samples,
        "sensors": [
            {
                "id": s.id,
                "sensor_id": s.sensor_id,
                "name": s.name,
                "current_state": (state.current_state if state else "normal"),
            }
            for (s, state) in sensors_rows
        ],
        "compliance": {
            "ph": {"sample_count": ph_samples, "violation_count": ph_violations, "percent": ph_pct},
            "turbidity": {
                "sample_count": turb_samples,
                "violation_count": turb_violations,
                "percent": turb_pct,
            },
            "temperature": {
                "sample_count": temp_samples,
                "violation_count": temp_violations,
                "percent": temp_pct,
            },
        },
    }
    return evidence


ANALYTICS_INSIGHTS_SYSTEM_PROMPT = (
    "Anda adalah AquaMine AI Analyst. "
    "Gunakan HANYA bukti yang diberikan. Jangan menambahkan sinyal baru seperti CV/rainfall jika tidak ada di bukti. "
    "Jangan mencampur threshold alert/anomali dengan standar kepatuhan (compliance). "
    "Jika menyebut kepatuhan, sebutkan standar (pH min/max, turbidity max, temperature max) dan persentase kepatuhan dari bukti."
)


def _extract_message_content(response: object | None) -> Optional[str]:
    if response is None:
        return None
    if isinstance(response, dict):
        choices = response.get("choices") or []
        if not choices:
            return None
        message = choices[0].get("message") or {}
        return message.get("content")
    choices = getattr(response, "choices", None)
    if not choices:
        return None
    first = choices[0]
    message = getattr(first, "message", None)
    if message is None:
        return None
    return getattr(message, "content", None)


def _parse_json_object(text_value: str) -> Optional[dict[str, Any]]:
    text_value = (text_value or "").strip()
    if not text_value:
        return None
    try:
        return json.loads(text_value)
    except Exception:
        pass

    # Best-effort extraction if model wraps JSON in text.
    start = text_value.find("{")
    end = text_value.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text_value[start : end + 1])
    except Exception:
        return None


def _validate_citations(
    parsed: AnalyticsInsightsResponse, numeric_evidence: dict[str, float]
) -> bool:
    citations: list[EvidenceCitation] = []
    citations.extend(parsed.executive_summary.evidence or [])
    for f in parsed.key_findings or []:
        citations.extend(f.evidence or [])
    if not citations:
        return False

    for c in citations:
        if c.key not in numeric_evidence:
            return False
        expected = float(numeric_evidence[c.key])
        if abs(expected - float(c.value)) > 1e-6:
            return False
    return True


async def generate_insights_with_llm(
    *,
    evidence: dict[str, Any],
    cerebras_client: Optional[CerebrasClient] = None,
) -> Optional[AnalyticsInsightsResponse]:
    numeric_evidence = evidence.get("numeric") or {}

    prompt_payload = {
        "period": evidence.get("period"),
        "standard": evidence.get("standard"),
        "numeric": numeric_evidence,
        "alerts": evidence.get("alerts"),
        "anomalies": evidence.get("anomalies"),
        "data_quality": evidence.get("data_quality"),
        "raw_samples": evidence.get("raw_samples"),
        "sensors": evidence.get("sensors"),
        "compliance": evidence.get("compliance"),
    }

    messages = [
        {"role": "system", "content": ANALYTICS_INSIGHTS_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Buat output JSON yang valid dengan schema:\n"
                "{generated_at, period, executive_summary{status,headline,severity_score,trend,recommendation,evidence[]}, "
                "key_findings[{type,title,description,confidence,recommended_actions[],evidence[]}], evidence}.\n\n"
                "ATURAN SITASI (WAJIB):\n"
                "- Semua angka penting HARUS disitasi menggunakan evidence[]: {key, value, unit}.\n"
                "- key harus salah satu dari evidence.numeric keys yang disediakan.\n"
                "- value harus SAMA PERSIS dengan evidence.numeric[key].\n\n"
                "BUKTI (JSON):\n"
                f"{json.dumps(prompt_payload, ensure_ascii=True, default=str)}"
            ),
        },
    ]

    client = cerebras_client or CerebrasClient(api_key=settings.CEREBRAS_API_KEY)
    response = await client.chat_completion(messages)
    content = _extract_message_content(response)
    if not content:
        return None

    parsed_obj = _parse_json_object(content)
    if parsed_obj is None:
        return None

    try:
        parsed = AnalyticsInsightsResponse.model_validate(parsed_obj)
    except Exception:
        return None

    if not _validate_citations(parsed, {str(k): float(v) for k, v in numeric_evidence.items()}):
        return None
    return parsed


def deterministic_insights_response(evidence: dict[str, Any]) -> AnalyticsInsightsResponse:
    now_utc = evidence.get("generated_at")
    if not isinstance(now_utc, datetime):
        now_utc = _now_utc()

    numeric = {str(k): float(v) for k, v in (evidence.get("numeric") or {}).items()}
    ph_pct = numeric.get("compliance.ph_percent")
    turb_pct = numeric.get("compliance.turbidity_percent")
    temp_pct = numeric.get("compliance.temperature_percent")

    worst_pct = None
    for v in [ph_pct, turb_pct, temp_pct]:
        if v is None:
            continue
        worst_pct = v if worst_pct is None else min(worst_pct, v)

    status = "NORMAL"
    trend = "stable"
    severity = 10
    headline = "Kondisi kualitas air relatif stabil."
    recommendation = "Lanjutkan pemantauan rutin dan pastikan sensor tetap aktif."

    ph_slope = numeric.get("overall.ph_slope_per_hour")
    if ph_slope is not None and ph_slope < -0.05:
        trend = "degrading"
        status = "WARNING"
        severity = max(severity, 60)
        headline = "pH menunjukkan tren menurun dalam 24 jam terakhir."
        recommendation = "Verifikasi pH dengan sampling manual dan cek potensi sumber asam di hulu."

    if worst_pct is not None and worst_pct < 80.0:
        status = "CRITICAL"
        severity = 85
        headline = "Terdapat indikasi pelanggaran standar kepatuhan dalam 24 jam terakhir."
        recommendation = "Prioritaskan investigasi parameter yang paling sering melanggar dan dokumentasikan tindakan perbaikan."

    citations: list[EvidenceCitation] = []
    for k in [
        "compliance.ph_percent",
        "compliance.turbidity_percent",
        "compliance.temperature_percent",
        "overall.ph_slope_per_hour",
    ]:
        if k in numeric:
            citations.append(EvidenceCitation(key=k, value=float(numeric[k]), unit=""))

    findings: list[InsightFinding] = []
    if ph_pct is not None:
        findings.append(
            InsightFinding(
                type="compliance",
                title="Kepatuhan pH",
                description=(
                    "Kepatuhan pH dihitung terhadap standar yang dikonfigurasi pada sistem."
                ),
                confidence=0.9,
                recommended_actions=[
                    "Cek kalibrasi sensor pH",
                    "Lakukan sampling manual untuk validasi",
                ],
                evidence=[
                    EvidenceCitation(
                        key="compliance.ph_percent", value=float(ph_pct), unit="percent"
                    )
                ],
            )
        )
    if turb_pct is not None:
        findings.append(
            InsightFinding(
                type="compliance",
                title="Kepatuhan turbidity",
                description="Kepatuhan turbidity dihitung terhadap batas NTU standar.",
                confidence=0.9,
                recommended_actions=["Periksa potensi sedimentasi atau gangguan aliran"],
                evidence=[
                    EvidenceCitation(
                        key="compliance.turbidity_percent", value=float(turb_pct), unit="percent"
                    )
                ],
            )
        )

    if "overall.ph_turbidity_correlation" in numeric:
        findings.append(
            InsightFinding(
                type="correlation",
                title="Korelasi pH dan turbidity",
                description=("Korelasi dihitung hanya bila jumlah data berpasangan mencukupi."),
                confidence=0.7,
                evidence=[
                    EvidenceCitation(
                        key="overall.ph_turbidity_correlation",
                        value=float(numeric["overall.ph_turbidity_correlation"]),
                        unit="r",
                    )
                ],
            )
        )

    return AnalyticsInsightsResponse(
        generated_at=now_utc,
        period=str(evidence.get("period") or "24h"),
        executive_summary=InsightsExecutiveSummary(
            status=status,
            headline=headline,
            severity_score=int(severity),
            trend=trend,
            recommendation=recommendation,
            evidence=citations,
        ),
        key_findings=findings,
        evidence=evidence,
    )
