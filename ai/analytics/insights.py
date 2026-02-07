from __future__ import annotations

import json
import logging
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from dataclasses import asdict

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
from ai.analytics.strategy import analyze_strategic_impact, evaluate_compliance_risk, analyze_financial_history
from ai.chatbot.cerebras_client import CerebrasClient
from ai.config import settings
from ai.db.models import Alert, Anomaly, Reading, Sensor, SensorAlertState
from ai.schemas.analytics import (
    AnalyticsInsightsResponse,
    EvidenceCitation,
    InsightFinding,
    InsightsExecutiveSummary,
    StrategicImpactSchema,
    FinancialImpactSchema,
    RegulatoryMappingSchema,
    ViolationStatsSchema,
)

logger = logging.getLogger(__name__)


INSIGHTS_CACHE_TTL_SECONDS = 300
MAX_RAW_SAMPLES = 12
MAX_TREND_POINTS = 168
MIN_CORRELATION_POINTS = 20

# Thread-safe cache for time_bucket support check (per-request context)
_time_bucket_supported: ContextVar[Optional[bool]] = ContextVar(
    "_time_bucket_supported", default=None
)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _format_dt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


async def supports_time_bucket(db: AsyncSession) -> bool:
    cached = _time_bucket_supported.get()
    if cached is not None:
        return cached

    try:
        res = await db.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'time_bucket')")
        )
        result = bool(res.scalar_one())
    except Exception:
        result = False

    _time_bucket_supported.set(result)
    return result


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
            _time_bucket_supported.set(False)

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
        select(
            Sensor.id,
            Sensor.sensor_id,
            Sensor.name,
            SensorAlertState.current_state,
        )
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

    # --- Financial Breakdown Calculation ---
    # Validate pH bounds (0-14 range) to prevent invalid sensor readings from affecting calculations
    series_24h = [
        (r.timestamp.replace(tzinfo=timezone.utc) if r.timestamp.tzinfo is None else r.timestamp, float(r.ph)) 
        for r in readings_rows 
        if r.ph is not None and 0 <= float(r.ph) <= 14
    ]
    
    cutoff_1h = now_utc - timedelta(hours=1)
    series_1h = [x for x in series_24h if x[0] >= cutoff_1h]
    
    # Needs 7d data. Currently valid readings are 24h. Use a specific fetch for 7d hourly trends.
    start_7d = now_utc - timedelta(days=7)
    trend_points_7d = await fetch_trend_points(
        db, start=start_7d, end=now_utc, aggregation="hourly", sensor_id=sensor_id, max_points=200
    )
    series_7d = [
        (ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts, float(p["ph_avg"])) 
        for p in trend_points_7d 
        if (ts := p.get("timestamp")) and isinstance(ts, datetime) and p.get("ph_avg") is not None and 0 <= float(p["ph_avg"]) <= 14
    ]

    # Handle empty time series edge cases - return zero values if no data available
    if series_1h:
        fin_1h = analyze_financial_history(series_1h, 1.0)
    else:
        from ai.analytics.strategy import FinancialImpact, ViolationStats
        fin_1h = FinancialImpact(
            treatment_cost_hourly=0.0,
            regulatory_fine_risk=0.0,
            ecosystem_remediation_risk=0.0,
            risk_exposure=0.0,
            potential_savings=0.0,
            recommended_lime_dosage_kg_h=0.0,
            estimated_recovery_time_minutes=0.0,
            holding_pond_cost_risk=0.0,
            violation_stats=ViolationStats(0.0, 0, None, None, 0.0),
        )
    
    if series_24h:
        fin_24h = analyze_financial_history(series_24h, 24.0)
    else:
        from ai.analytics.strategy import FinancialImpact, ViolationStats
        fin_24h = FinancialImpact(
            treatment_cost_hourly=0.0,
            regulatory_fine_risk=0.0,
            ecosystem_remediation_risk=0.0,
            risk_exposure=0.0,
            potential_savings=0.0,
            recommended_lime_dosage_kg_h=0.0,
            estimated_recovery_time_minutes=0.0,
            holding_pond_cost_risk=0.0,
            violation_stats=ViolationStats(0.0, 0, None, None, 0.0),
        )
    
    # Using 168 hours (7d) as duration baseline
    if series_7d:
        fin_7d = analyze_financial_history(series_7d, 168.0)
    else:
        from ai.analytics.strategy import FinancialImpact, ViolationStats
        fin_7d = FinancialImpact(
            treatment_cost_hourly=0.0,
            regulatory_fine_risk=0.0,
            ecosystem_remediation_risk=0.0,
            risk_exposure=0.0,
            potential_savings=0.0,
            recommended_lime_dosage_kg_h=0.0,
            estimated_recovery_time_minutes=0.0,
            holding_pond_cost_risk=0.0,
            violation_stats=ViolationStats(0.0, 0, None, None, 0.0),
        ) 

    financial_breakdown_dict = {
        "1h": asdict(fin_1h),
        "24h": asdict(fin_24h),
        "7d": asdict(fin_7d)
    }
    # ----------------------------------------

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
    
    # Add current latest values for strategic impact analysis
    if readings_rows:
        last_r = readings_rows[-1]
        if last_r.ph is not None:
            numeric["current.ph"] = float(last_r.ph)
        if last_r.turbidity is not None:
            numeric["current.turbidity"] = float(last_r.turbidity)

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
        "financial_breakdown": financial_breakdown_dict,
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
                "id": row.id,
                "sensor_id": row.sensor_id,
                "name": row.name,
                "current_state": (row.current_state if row.current_state is not None else "normal"),
            }
            for row in sensors_rows
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


ANALYTICS_INSIGHTS_SYSTEM_PROMPT = """Anda adalah AquaMine AI Analyst untuk operasi tambang batubara di Indonesia.

KONTEKS OPERASIONAL:
- Standar kepatuhan mengacu pada KepMen LH 113/2003 (Baku Mutu Air Limbah Pertambangan Batubara)
- Target pembaca: operator lapangan & supervisor yang perlu tindakan konkret
- Fokus: identifikasi risiko AMD (Acid Mine Drainage) dan kepatuhan lingkungan

ATURAN PENULISAN:
1. Gunakan HANYA data dari bukti yang diberikan. Jangan mengarang angka.
2. Sebutkan nama sensor spesifik jika ada di bukti (misal: "Settling Pond A").
3. Jika pH turun < 6 atau naik > 9, ini PELANGGARAN standar - tekankan.
4. Berikan aksi prioritas: apa yang harus dicek PERTAMA, KEDUA, dst.
5. Jika ada tren menurun pH, jelaskan risiko AMD (asam dari oksidasi sulfida).
6. Hindari jargon teknis berlebihan. Tulis seperti shift handover notes.

FORMAT AKSI YANG BAIK:
- "Cek sensor pH di [lokasi] - nilai terakhir [X] di bawah standar 6.0"
- "Prioritas 1: Verifikasi dosis kapur di [lokasi]"
- "Eskalasi ke supervisor jika [kondisi] berlanjut > 2 jam"

JANGAN:
- Menampilkan key mentah seperti "compliance.ph_percent" di teks
- Mencampur threshold alert dengan standar kepatuhan
- Menambahkan data yang tidak ada di bukti (CV, curah hujan, dll)"""


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

    # --- Strategic Logic Integration ---
    current_ph_val = numeric_evidence.get("current.ph")
    current_turb_val = numeric_evidence.get("current.turbidity")
    
    # Flag to distinguish between actual pH = 7.0 and missing data fallback
    ph_is_fallback = current_ph_val is None
    current_ph = float(current_ph_val) if current_ph_val is not None else 7.0
    current_turb = float(current_turb_val) if current_turb_val is not None else None
    
    # Log warning if using fallback pH value
    if ph_is_fallback:
        logger.warning("Current pH value missing from numeric evidence, using fallback value of 7.0")

    fi_data = analyze_strategic_impact(current_ph)
    comp_data = evaluate_compliance_risk(current_ph, current_turb)

    strategic_impact = StrategicImpactSchema(
        financial=FinancialImpactSchema(
            treatment_cost_hourly=fi_data.treatment_cost_hourly,
            regulatory_fine_risk=fi_data.regulatory_fine_risk,
            ecosystem_remediation_risk=fi_data.ecosystem_remediation_risk,
            risk_exposure=fi_data.risk_exposure,
            potential_savings=fi_data.potential_savings,
            recommended_lime_dosage_kg_h=fi_data.recommended_lime_dosage_kg_h,
            estimated_recovery_time_minutes=fi_data.estimated_recovery_time_minutes,
            holding_pond_cost_risk=fi_data.holding_pond_cost_risk,
            violation_stats=None if fi_data.violation_stats is None else ViolationStatsSchema(
                violation_minutes=fi_data.violation_stats.violation_minutes,
                event_count=fi_data.violation_stats.event_count,
                max_severity_ph=fi_data.violation_stats.max_severity_ph,
                min_severity_ph=fi_data.violation_stats.min_severity_ph,
                affected_volume_m3=fi_data.violation_stats.affected_volume_m3
            ),
            risk_parameters_used=fi_data.risk_parameters_used,
        ),
        compliance=RegulatoryMappingSchema(
            is_compliant=comp_data.is_compliant,
            status_label=comp_data.status_label,
            violated_regulations=comp_data.violated_regulations,
            action_plan=comp_data.action_plan,
        ),
    )
    # -----------------------------------

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
        "strategic_impact": strategic_impact.model_dump(),
    }

    messages = [
        {"role": "system", "content": ANALYTICS_INSIGHTS_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Buat output JSON yang valid dengan schema:\n"
                "{generated_at, period, executive_summary{status,headline,severity_score,trend,recommendation,evidence[]}, "
                "key_findings[{type,title,description,confidence,recommended_actions[],evidence[]}], evidence}.\n\n"
                "PENJELASAN FIELD:\n"
                "- status: 'NORMAL' | 'WARNING' | 'CRITICAL'\n"
                "- severity_score: 0-100 (0=aman, 100=kritis)\n"
                "- trend: 'improving' | 'stable' | 'degrading'\n\n"
                "GAYA PENULISAN (WAJIB):\n"
                "- headline: 1 kalimat (maks 120 karakter). Contoh: 'pH di Settling Pond A turun di bawah standar - perlu tindakan segera'\n"
                "- recommendation: 2-3 kalimat. Jelaskan (1) kondisi saat ini, (2) risiko jika dibiarkan, (3) prioritas tindakan.\n"
                "- key_findings: Buat 2-4 temuan. Setiap temuan punya recommended_actions berupa checklist 3-5 langkah.\n"
                "- recommended_actions: Mulai dengan kata kerja (Cek/Verifikasi/Inspeksi/Dokumentasikan/Eskalasi). Sebutkan lokasi sensor jika relevan.\n"
                "- JANGAN tampilkan key mentah seperti 'compliance.ph_percent' di teks. Gunakan bahasa natural.\n\n"
                "CONTOH AKSI YANG BAIK:\n"
                "- 'Cek sensor pH di Settling Pond A - nilai terakhir 5.8 di bawah standar 6.0'\n"
                "- 'Verifikasi dosis kapur sudah sesuai SOP (target pH 7.0-8.0)'\n"
                "- 'Eskalasi ke supervisor jika pH < 6 berlanjut > 2 jam'\n\n"
                "ATURAN SITASI (WAJIB):\n"
                "- Semua angka penting HARUS disitasi menggunakan evidence[]: {key, value, unit}.\n"
                "- key harus salah satu dari evidence.numeric keys yang disediakan.\n"
                "- value harus SAMA PERSIS dengan evidence.numeric[key].\n\n"
                "INSTRUKSI STRATEGIS (QUARRY COMPLIANCE):\n"
                "- Gunakan Bahasa Indonesia yang formal dan lugas.\n"
                "- Gunakan data 'strategic_impact' untuk memperkaya analisis.\n"
                "- Jika pH < 6 atau > 9, sertakan Referensi Hukum (PP 22/2021, Kepmen 1827). Jika sangat kritis (<4), sebut UU 32/2009 (Potensi Pidana).\n"
                "- Tampilkan estimasi kerugian finansial (Risk Exposure) dengan label 'Estimasi Risiko Finansial Harian'.\n"
                "- Sertakan 'Rekomendasi Dosis Kapur (kg/jam)' dan 'Estimasi Waktu Pemulihan' dalam Action Plan.\n\n"
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
        # Attach the deterministic strategic data to ensure it's available for UI
        parsed.strategic_impact = strategic_impact
        
        financial_breakdown_raw = evidence.get("financial_breakdown")
        if financial_breakdown_raw:
            # Handle financial breakdown construction with graceful error handling
            parsed.financial_breakdown = {}
            for k, v in financial_breakdown_raw.items():
                try:
                    # Extract violation_stats if present
                    violation_stats_data = v.get("violation_stats")
                    violation_stats_obj = None
                    if violation_stats_data:
                        try:
                            violation_stats_obj = ViolationStatsSchema(
                                violation_minutes=violation_stats_data.get("violation_minutes", 0.0),
                                event_count=violation_stats_data.get("event_count", 0),
                                max_severity_ph=violation_stats_data.get("max_severity_ph"),
                                min_severity_ph=violation_stats_data.get("min_severity_ph"),
                                affected_volume_m3=violation_stats_data.get("affected_volume_m3", 0.0),
                            )
                        except (KeyError, TypeError, ValueError) as e:
                            logger.warning(f"Failed to parse violation_stats for period {k}: {e}")
                    
                    parsed.financial_breakdown[k] = FinancialImpactSchema(
                        treatment_cost_hourly=v.get("treatment_cost_hourly", 0.0),
                        regulatory_fine_risk=v.get("regulatory_fine_risk", 0.0),
                        ecosystem_remediation_risk=v.get("ecosystem_remediation_risk", 0.0),
                        risk_exposure=v.get("risk_exposure", 0.0),
                        potential_savings=v.get("potential_savings", 0.0),
                        recommended_lime_dosage_kg_h=v.get("recommended_lime_dosage_kg_h", 0.0),
                        estimated_recovery_time_minutes=v.get("estimated_recovery_time_minutes", 0.0),
                        holding_pond_cost_risk=v.get("holding_pond_cost_risk", 0.0),
                        violation_stats=violation_stats_obj,
                        risk_parameters_used=v.get("risk_parameters_used"),
                    )
                except (KeyError, TypeError, ValueError) as e:
                    logger.warning(f"Failed to parse financial breakdown for period {k}: {e}")
                    continue
            
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
    standard = evidence.get("standard") or {}
    sensors = evidence.get("sensors") or []
    compliance_data = evidence.get("compliance") or {}

    financial_breakdown_raw = evidence.get("financial_breakdown")
    financial_breakdown = None
    if financial_breakdown_raw:
        financial_breakdown = {
            k: FinancialImpactSchema(
                treatment_cost_hourly=v["treatment_cost_hourly"],
                regulatory_fine_risk=v["regulatory_fine_risk"],
                ecosystem_remediation_risk=v["ecosystem_remediation_risk"],
                risk_exposure=v["risk_exposure"],
                potential_savings=v["potential_savings"],
                recommended_lime_dosage_kg_h=v["recommended_lime_dosage_kg_h"],
                estimated_recovery_time_minutes=v["estimated_recovery_time_minutes"],
                holding_pond_cost_risk=v["holding_pond_cost_risk"],
            ) 
            for k, v in financial_breakdown_raw.items()
        }

    # Calculate Strategic Impact
    current_ph = numeric.get("current.ph")
    current_turb = numeric.get("current.turbidity")
    strategic_impact = None

    if current_ph is not None:
        fi = analyze_strategic_impact(current_ph)
        rm = evaluate_compliance_risk(current_ph, current_turb)

        strategic_impact = StrategicImpactSchema(
            financial=FinancialImpactSchema(
                treatment_cost_hourly=fi.treatment_cost_hourly,
                regulatory_fine_risk=fi.regulatory_fine_risk,
                ecosystem_remediation_risk=fi.ecosystem_remediation_risk,
                risk_exposure=fi.risk_exposure,
                potential_savings=fi.potential_savings,
                recommended_lime_dosage_kg_h=fi.recommended_lime_dosage_kg_h,
                estimated_recovery_time_minutes=fi.estimated_recovery_time_minutes,
                holding_pond_cost_risk=fi.holding_pond_cost_risk,
                violation_stats=None if fi.violation_stats is None else ViolationStatsSchema(
                    violation_minutes=fi.violation_stats.violation_minutes,
                    event_count=fi.violation_stats.event_count,
                    max_severity_ph=fi.violation_stats.max_severity_ph,
                    min_severity_ph=fi.violation_stats.min_severity_ph,
                    affected_volume_m3=fi.violation_stats.affected_volume_m3
                ),
                risk_parameters_used=fi.risk_parameters_used,
            ),
            compliance=RegulatoryMappingSchema(
                is_compliant=rm.is_compliant,
                status_label=rm.status_label,
                violated_regulations=rm.violated_regulations,
                action_plan=rm.action_plan,
            ),
        )

    ph_pct = numeric.get("compliance.ph_percent")
    turb_pct = numeric.get("compliance.turbidity_percent")
    temp_pct = numeric.get("compliance.temperature_percent")
    ph_slope = numeric.get("overall.ph_slope_per_hour")

    ph_min = standard.get("ph_min", 6.0)
    ph_max = standard.get("ph_max", 9.0)
    turb_max = standard.get("turbidity_max_ntu", 50)
    standard_source = standard.get("source", "KepMen LH 113/2003")

    sensor_names = [s.get("name") or s.get("sensor_id", "Unknown") for s in sensors]
    sensor_context = sensor_names[0] if len(sensor_names) == 1 else f"{len(sensor_names)} sensor"

    worst_pct = None
    worst_param = None
    for param, v in [("pH", ph_pct), ("kekeruhan", turb_pct), ("suhu", temp_pct)]:
        if v is None:
            continue
        if worst_pct is None or v < worst_pct:
            worst_pct = v
            worst_param = param

    status = "NORMAL"
    trend = "stable"
    severity = 10
    headline = f"Kondisi air dari {sensor_context} dalam batas normal per {standard_source}."
    recommendation = (
        f"Semua parameter (pH, kekeruhan, suhu) memenuhi standar {standard_source} dalam 24 jam terakhir. "
        "Lanjutkan pemantauan rutin dan pastikan sensor tetap terkalibrasi."
    )

    if ph_slope is not None and ph_slope < -0.05:
        trend = "degrading"
        status = "WARNING"
        severity = max(severity, 60)
        slope_desc = f"{abs(ph_slope):.2f}/jam"
        headline = f"pH menurun {slope_desc} - potensi awal AMD perlu dipantau."
        recommendation = (
            f"Tren pH menurun {slope_desc} dalam 24 jam terakhir. "
            f"Ini bisa mengindikasikan awal Acid Mine Drainage (AMD) dari oksidasi sulfida. "
            "Prioritas: (1) Cek dosis kapur/lime, (2) Verifikasi dengan pH meter manual, (3) Pantau tren 6 jam ke depan."
        )

    if worst_pct is not None and worst_pct < 80.0:
        status = "CRITICAL"
        severity = 85
        ph_violations = compliance_data.get("ph", {}).get("violation_count", 0)
        turb_violations = compliance_data.get("turbidity", {}).get("violation_count", 0)

        if worst_param == "pH":
            headline = f"Pelanggaran standar pH ({ph_violations}x dalam 24 jam) - tindakan segera diperlukan."
            recommendation = (
                f"pH melanggar batas {ph_min}-{ph_max} sebanyak {ph_violations}x. "
                f"Risiko: Jika pH < {ph_min}, air bersifat asam dan dapat merusak ekosistem serta melanggar {standard_source}. "
                "Prioritas: (1) Cek dan tingkatkan dosis kapur, (2) Sampling manual untuk verifikasi, (3) Dokumentasikan untuk laporan kepatuhan."
            )
        elif worst_param == "kekeruhan":
            headline = f"Kekeruhan melebihi standar ({turb_violations}x dalam 24 jam) - periksa settling pond."
            recommendation = (
                f"Kekeruhan melebihi batas {turb_max} NTU sebanyak {turb_violations}x. "
                "Penyebab umum: overflow settling pond, agitasi sedimen, atau hujan deras. "
                "Prioritas: (1) Inspeksi settling pond, (2) Cek level air dan waktu retensi, (3) Bersihkan sensor jika perlu."
            )
        else:
            headline = f"Parameter {worst_param} melanggar standar kepatuhan dalam 24 jam terakhir."
            recommendation = (
                f"Parameter {worst_param} menunjukkan pelanggaran standar {standard_source}. "
                "Lakukan verifikasi lapangan dan dokumentasikan tindakan perbaikan."
            )

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
        ph_status = (
            "memenuhi standar"
            if ph_pct >= 95
            else ("perlu perhatian" if ph_pct >= 80 else "melanggar standar")
        )
        ph_actions = [
            f"Cek kalibrasi sensor pH (standar: {ph_min}-{ph_max})",
            "Ambil sampel manual untuk cross-check dengan lab",
            "Catat waktu, cuaca, dan lokasi pengambilan sampel",
        ]
        if ph_pct < 80:
            ph_actions.insert(0, "PRIORITAS: Tingkatkan dosis kapur/lime dosing")
            ph_actions.append("Eskalasi ke supervisor jika pH < 6 berlanjut > 2 jam")

        findings.append(
            InsightFinding(
                type="compliance",
                title=f"Kepatuhan pH: {ph_pct:.1f}% ({ph_status})",
                description=(
                    f"Dari total pembacaan, {ph_pct:.1f}% memenuhi standar pH {ph_min}-{ph_max} "
                    f"sesuai {standard_source}."
                ),
                confidence=0.9,
                recommended_actions=ph_actions,
                evidence=[
                    EvidenceCitation(
                        key="compliance.ph_percent", value=float(ph_pct), unit="percent"
                    )
                ],
            )
        )

    if turb_pct is not None:
        turb_status = (
            "memenuhi standar"
            if turb_pct >= 95
            else ("perlu perhatian" if turb_pct >= 80 else "melanggar standar")
        )
        turb_actions = [
            "Inspeksi visual settling pond (cek overflow, sedimen)",
            f"Periksa sensor kekeruhan (fouling) - batas: {turb_max} NTU",
            "Bandingkan dengan turbidimeter manual untuk validasi",
        ]
        if turb_pct < 80:
            turb_actions.insert(0, "PRIORITAS: Cek waktu retensi settling pond")
            turb_actions.append("Pertimbangkan penambahan flocculant jika diperlukan")

        findings.append(
            InsightFinding(
                type="compliance",
                title=f"Kepatuhan Kekeruhan: {turb_pct:.1f}% ({turb_status})",
                description=(
                    f"Dari total pembacaan, {turb_pct:.1f}% memenuhi standar kekeruhan maksimal "
                    f"{turb_max} NTU."
                ),
                confidence=0.9,
                recommended_actions=turb_actions,
                evidence=[
                    EvidenceCitation(
                        key="compliance.turbidity_percent", value=float(turb_pct), unit="percent"
                    )
                ],
            )
        )

    if ph_slope is not None and ph_slope < -0.02:
        slope_severity = "signifikan" if ph_slope < -0.05 else "ringan"
        findings.append(
            InsightFinding(
                type="trend",
                title=f"Tren pH Menurun ({slope_severity})",
                description=(
                    f"pH menurun rata-rata {abs(ph_slope):.3f} per jam. "
                    "Tren menurun bisa mengindikasikan peningkatan asam dari oksidasi sulfida (AMD)."
                ),
                confidence=0.8,
                recommended_actions=[
                    "Pantau tren pH setiap 2 jam",
                    "Siapkan lime dosing tambahan jika tren berlanjut",
                    "Cek sumber air masuk (apakah ada aliran baru dari area tambang)",
                ],
                evidence=[
                    EvidenceCitation(
                        key="overall.ph_slope_per_hour",
                        value=float(ph_slope),
                        unit="pH/jam",
                    )
                ],
            )
        )

    if "overall.ph_turbidity_correlation" in numeric:
        corr = numeric["overall.ph_turbidity_correlation"]
        corr_desc = "kuat" if abs(corr) > 0.7 else ("moderat" if abs(corr) > 0.4 else "lemah")
        findings.append(
            InsightFinding(
                type="correlation",
                title=f"Korelasi pH-Kekeruhan: {corr_desc} (r={corr:.2f})",
                description=(
                    f"Korelasi {corr_desc} antara pH dan kekeruhan. "
                    "Korelasi negatif kuat bisa menunjukkan bahwa peningkatan kekeruhan "
                    "terkait dengan penurunan pH (umum pada AMD)."
                ),
                confidence=0.7,
                evidence=[
                    EvidenceCitation(
                        key="overall.ph_turbidity_correlation",
                        value=float(corr),
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
        strategic_impact=strategic_impact,
        financial_breakdown=financial_breakdown,
    )
