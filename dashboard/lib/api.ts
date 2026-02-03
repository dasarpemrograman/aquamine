const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8181";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface AnalysisResponse {
  detected: boolean;
  confidence: number;
  severity: "none" | "mild" | "moderate" | "severe";
  bbox: BoundingBox | null;
  bboxes: BoundingBox[];
  latency_ms: number;
  warnings: string[];
  model_version: string;
  image_width: number;
  image_height: number;
}

export interface ErrorResponse {
  error: string;
  detail: string;
}

export interface ChatResponse {
  response: string;
}

export interface UserSettings {
  user_id: string;
  notifications_enabled: boolean;
  notify_critical: boolean;
  notify_warning: boolean;
  notify_info: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  refresh_interval_seconds: number;
  last_notification_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsUpdate {
  notifications_enabled?: boolean;
  notify_critical?: boolean;
  notify_warning?: boolean;
  notify_info?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string;
  refresh_interval_seconds?: number;
  last_notification_seen_at?: string | null;
}

export interface Alert {
  id: number;
  sensor_id: number;
  severity: string;
  previous_state: string | null;
  message: string | null;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

export interface Sensor {
  id: number;
  sensor_id: string;
  is_active: boolean;
}

export async function analyzeImage(file: File): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/v1/cv/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function sendChatMessage(
  message: string,
  sessionId: string,
  token?: string
): Promise<ChatResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, session_id: sessionId })
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function fetchSettings(userId: string): Promise<UserSettings> {
  const response = await fetch(`${API_BASE}/api/v1/settings/${userId}`, {
      headers: {
        "x-user-id": userId,
      },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function updateSettings(
  userId: string,
  payload: UserSettingsUpdate
): Promise<UserSettings> {
  const response = await fetch(`${API_BASE}/api/v1/settings/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function fetchAlerts(): Promise<Alert[]> {
  const response = await fetch(`${API_BASE}/api/v1/alerts`);

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function fetchSensors(): Promise<Sensor[]> {
  const response = await fetch(`${API_BASE}/api/v1/sensors`);

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function acknowledgeAlert(alertId: number): Promise<Alert> {
  const response = await fetch(`${API_BASE}/api/v1/alerts/${alertId}/acknowledge`, {
    method: "POST"
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function fetchHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export interface AnalyticsSystemHealth {
  total_sensors: number;
  active_sensors: number;
  offline_sensors: number;
  sensors_low_battery: number;
}

export interface AnalyticsMetricSummary {
  avg: number | null;
  min: number | null;
  max: number | null;
  status: "normal" | "warning" | "critical" | "unknown";
  percent_compliance: number | null;
}

export interface AnalyticsWaterQualitySummary {
  ph: AnalyticsMetricSummary;
  turbidity: AnalyticsMetricSummary;
  temperature: AnalyticsMetricSummary;
}

export interface AnalyticsAlertsSummary {
  total_24h: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
}

export interface AnalyticsSummaryResponse {
  period: string;
  generated_at: string;
  system_health: AnalyticsSystemHealth;
  water_quality: AnalyticsWaterQualitySummary;
  alerts: AnalyticsAlertsSummary;
}

export interface AnalyticsTrendPoint {
  timestamp: string;
  ph_avg: number | null;
  ph_min: number | null;
  ph_max: number | null;
  turbidity_avg: number | null;
  turbidity_min: number | null;
  turbidity_max: number | null;
  temperature_avg: number | null;
  temperature_min: number | null;
  temperature_max: number | null;
}

export interface AnalyticsTrendsResponse {
  period: string;
  aggregation: "hourly" | "daily";
  sensor_id: number | null;
  points: AnalyticsTrendPoint[];
}

export interface ComplianceStandard {
  source: string;
  ph_min: number;
  ph_max: number;
  turbidity_max_ntu: number;
  temperature_max_c: number;
}

export interface ComplianceMetric {
  percent_compliance: number | null;
  sample_count: number;
  violation_count: number;
}

export interface AnalyticsComplianceResponse {
  period: string;
  generated_at: string;
  standard: ComplianceStandard;
  ph: ComplianceMetric;
  turbidity: ComplianceMetric;
  temperature: ComplianceMetric;
  violation_hours: number;
  trend: "improving" | "stable" | "degrading" | "unknown";
}

export interface EvidenceCitation {
  key: string;
  value: number;
  unit: string | null;
}

export interface InsightsExecutiveSummary {
  status: "NORMAL" | "WARNING" | "CRITICAL";
  headline: string;
  severity_score: number;
  trend: "improving" | "stable" | "degrading" | "unknown";
  recommendation: string;
  evidence: EvidenceCitation[];
}

export interface InsightFinding {
  type: string;
  title: string;
  description: string;
  confidence: number;
  recommended_actions: string[];
  evidence: EvidenceCitation[];
}

export interface AnalyticsInsightsResponse {
  generated_at: string;
  period: string;
  executive_summary: InsightsExecutiveSummary;
  key_findings: InsightFinding[];
}

export async function fetchAnalyticsSummary(token?: string | null): Promise<AnalyticsSummaryResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/analytics/summary?period=24h`, { headers });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function fetchAnalyticsCompliance(
  period: string = "7d",
  token?: string | null
): Promise<AnalyticsComplianceResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/analytics/compliance?period=${period}`, { headers });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function fetchAnalyticsTrends(
  period: string = "7d",
  aggregation: "hourly" | "daily" = "hourly",
  sensorId?: number,
  token?: string | null
): Promise<AnalyticsTrendsResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const params = new URLSearchParams({ period, aggregation });
  if (sensorId) {
    params.append("sensor_id", sensorId.toString());
  }

  const response = await fetch(`${API_BASE}/api/v1/analytics/trends?${params}`, { headers });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function fetchAnalyticsInsights(token?: string | null): Promise<AnalyticsInsightsResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/analytics/insights?period=24h`, { headers });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}
