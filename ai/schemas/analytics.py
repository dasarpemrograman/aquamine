from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional, TypeAlias

from ai.schemas.base import BaseSchema


MetricStatus: TypeAlias = Literal["normal", "warning", "critical", "unknown"]
InsightStatus: TypeAlias = Literal["NORMAL", "WARNING", "CRITICAL"]
TrendDirection: TypeAlias = Literal["improving", "stable", "degrading", "unknown"]


class AnalyticsSystemHealth(BaseSchema):
    total_sensors: int
    active_sensors: int
    offline_sensors: int
    sensors_low_battery: int


class AnalyticsMetricSummary(BaseSchema):
    avg: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    status: MetricStatus = "unknown"
    percent_compliance: Optional[float] = None


class AnalyticsWaterQualitySummary(BaseSchema):
    ph: AnalyticsMetricSummary
    turbidity: AnalyticsMetricSummary
    temperature: AnalyticsMetricSummary


class AnalyticsAlertsSummary(BaseSchema):
    total_24h: int
    critical: int
    warning: int
    info: int
    unacknowledged: int


class AnalyticsSummaryResponse(BaseSchema):
    period: str
    generated_at: datetime
    system_health: AnalyticsSystemHealth
    water_quality: AnalyticsWaterQualitySummary
    alerts: AnalyticsAlertsSummary


class AnalyticsTrendPoint(BaseSchema):
    timestamp: datetime

    ph_avg: Optional[float] = None
    ph_min: Optional[float] = None
    ph_max: Optional[float] = None

    turbidity_avg: Optional[float] = None
    turbidity_min: Optional[float] = None
    turbidity_max: Optional[float] = None

    temperature_avg: Optional[float] = None
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None


class AnalyticsTrendsResponse(BaseSchema):
    period: str
    aggregation: Literal["hourly", "daily"]
    sensor_id: Optional[int] = None
    points: list[AnalyticsTrendPoint]


class LatestReading(BaseSchema):
    timestamp: Optional[datetime] = None
    ph: Optional[float] = None
    turbidity: Optional[float] = None
    temperature: Optional[float] = None
    battery_voltage: Optional[float] = None


class HeatmapSensor(BaseSchema):
    id: int
    sensor_id: str
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    current_state: str
    staleness_hours: Optional[float] = None
    latest_reading: LatestReading


class AnalyticsHeatmapResponse(BaseSchema):
    generated_at: datetime
    sensors: list[HeatmapSensor]


class ComplianceStandard(BaseSchema):
    source: str
    ph_min: float
    ph_max: float
    turbidity_max_ntu: float
    temperature_max_c: float


class ComplianceMetric(BaseSchema):
    percent_compliance: Optional[float] = None
    sample_count: int
    violation_count: int


class AnalyticsComplianceResponse(BaseSchema):
    period: str
    generated_at: datetime
    standard: ComplianceStandard
    ph: ComplianceMetric
    turbidity: ComplianceMetric
    temperature: ComplianceMetric
    violation_hours: float
    trend: TrendDirection = "unknown"


class EvidenceCitation(BaseSchema):
    key: str
    value: float
    unit: Optional[str] = None


class InsightsExecutiveSummary(BaseSchema):
    status: InsightStatus
    headline: str
    severity_score: int
    trend: TrendDirection
    recommendation: str
    evidence: list[EvidenceCitation] = []


class InsightFinding(BaseSchema):
    type: str
    title: str
    description: str
    confidence: float
    recommended_actions: list[str] = []
    evidence: list[EvidenceCitation] = []


class AnalyticsInsightsResponse(BaseSchema):
    generated_at: datetime
    period: str
    executive_summary: InsightsExecutiveSummary
    key_findings: list[InsightFinding]
    evidence: dict[str, Any]
