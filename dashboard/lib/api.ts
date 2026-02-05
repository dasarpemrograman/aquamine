import {
  alertOfflineQueue,
  OFFLINE_QUEUED_MESSAGE,
  isLikelyNetworkError,
  type AlertActionPayload,
  type AlertActionType,
} from "@/lib/offlineQueue";

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
  sensor_name: string | null;
  severity: string;
  previous_state: string | null;
  message: string | null;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  evidence_count: number;
}

export interface AlertEvidence {
  id: number;
  alert_id: number;
  image_data: string;
  analysis_result: AnalysisResponse | null;
  attached_by: string | null;
  attached_at: string;
}

export interface AlertActionStatusResponse {
  status: "acknowledged" | "resolved" | "reopened";
}

export type OfflineAwareResult<T> =
  | { status: "success"; data: T }
  | { status: "queued"; queuedId: string; message: string };

export interface Sensor {
  id: number;
  sensor_id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
  created_at?: string;
  current_state?: string | null;
}

export interface Reading {
  id: number;
  sensor_id: number;
  timestamp: string;
  ph: number | null;
  turbidity: number | null;
  temperature: number | null;
  battery_voltage: number | null;
  signal_strength: number | null;
}

export interface RecipientBase {
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  notify_warning: boolean;
  notify_critical: boolean;
}

export interface Recipient extends RecipientBase {
  id: number;
}

export type RecipientCreate = RecipientBase;

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
  token?: string | null
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

export async function fetchSettings(userId: string, token?: string | null): Promise<UserSettings> {
  const headers: Record<string, string> = {
    "x-user-id": userId,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/settings/${userId}`, {
      headers,
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
  payload: UserSettingsUpdate,
  token?: string | null
): Promise<UserSettings> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-user-id": userId,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/settings/${userId}`, {
    method: "PATCH",
    headers,
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

export async function fetchAlerts(token?: string | null): Promise<Alert[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}/api/v1/alerts`, { headers });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function attachEvidenceToAlert(
  alertId: number,
  imageData: string,
  analysisResult: AnalysisResponse | null,
  token: string | null
): Promise<AlertEvidence> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/alerts/${alertId}/evidence`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      alert_id: alertId,
      image_data: imageData,
      analysis_result: analysisResult,
    }),
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

export async function getAlertEvidence(
  alertId: number,
  token: string | null
): Promise<AlertEvidence[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/alerts/${alertId}/evidence`, { headers });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function fetchSensors(token?: string | null): Promise<Sensor[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/sensors`, { headers });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function fetchReadings(
  sensorId: number,
  hours: number = 24,
  token?: string | null
): Promise<Reading[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE}/api/v1/sensors/${sensorId}/readings?hours=${hours}`,
    { headers }
  );

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`,
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function acknowledgeAlert(alertId: number, token?: string | null): Promise<AlertActionStatusResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/alerts/${alertId}/acknowledge`, {
    method: "POST",
    headers,
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

export async function resolveAlert(
  alertId: number,
  payload?: { resolution_note?: string | null },
  token?: string | null
): Promise<AlertActionStatusResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/alerts/${alertId}/resolve`, {
    method: "POST",
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`,
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function reopenAlert(alertId: number, token?: string | null): Promise<AlertActionStatusResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/alerts/${alertId}/reopen`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`,
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

async function enqueueAlertAction(actionType: AlertActionType, payload: AlertActionPayload) {
  const item = await alertOfflineQueue.enqueue(actionType, payload);
  return {
    status: "queued" as const,
    queuedId: item.id,
    message: OFFLINE_QUEUED_MESSAGE,
  };
}

function shouldEnqueueNow() {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.onLine === false;
}

export async function acknowledgeAlertOffline(
  alertId: number,
  token?: string | null
): Promise<OfflineAwareResult<AlertActionStatusResponse>> {
  if (shouldEnqueueNow()) {
    return enqueueAlertAction("acknowledge", { alertId });
  }

  try {
    const data = await acknowledgeAlert(alertId, token);
    return { status: "success", data };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      return enqueueAlertAction("acknowledge", { alertId });
    }
    throw err;
  }
}

export async function resolveAlertOffline(
  alertId: number,
  payload?: { resolution_note?: string | null },
  token?: string | null
): Promise<OfflineAwareResult<AlertActionStatusResponse>> {
  if (shouldEnqueueNow()) {
    return enqueueAlertAction("resolve", { alertId, resolution_note: payload?.resolution_note ?? null });
  }

  try {
    const data = await resolveAlert(alertId, payload, token);
    return { status: "success", data };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      return enqueueAlertAction("resolve", { alertId, resolution_note: payload?.resolution_note ?? null });
    }
    throw err;
  }
}

export async function reopenAlertOffline(
  alertId: number,
  token?: string | null
): Promise<OfflineAwareResult<AlertActionStatusResponse>> {
  if (shouldEnqueueNow()) {
    return enqueueAlertAction("reopen", { alertId });
  }

  try {
    const data = await reopenAlert(alertId, token);
    return { status: "success", data };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      return enqueueAlertAction("reopen", { alertId });
    }
    throw err;
  }
}

export async function fetchRecipients(token?: string | null): Promise<Recipient[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/recipients`, { headers });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
        error: "Unknown error",
        detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}

export async function createRecipient(payload: RecipientCreate, token?: string | null): Promise<Recipient> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/recipients`, {
    method: "POST",
    headers,
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

export async function updateRecipient(id: number, payload: Partial<RecipientBase>, token?: string | null): Promise<Recipient> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/recipients/${id}`, {
    method: "PATCH",
    headers,
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

export async function deleteRecipient(id: number, token?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/recipients/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
        error: "Unknown error",
        detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }
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

export interface AnalyticsInsightsEvidence {
  compliance: {
    ph: { percent: number; ok: number; total: number };
    turbidity: { percent: number; ok: number; total: number };
    temperature: { percent: number; ok: number; total: number };
  };
  standard: {
    ph_min: number;
    ph_max: number;
    turbidity_max_ntu: number;
    temperature_max_c: number;
  };
}

export interface AnalyticsInsightsResponse {
  generated_at: string;
  period: string;
  executive_summary: InsightsExecutiveSummary;
  key_findings: InsightFinding[];
  evidence?: AnalyticsInsightsEvidence;
}

export async function fetchAnalyticsSummary(
  sensorId?: number,
  token?: string | null
): Promise<AnalyticsSummaryResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const params = new URLSearchParams({ period: "24h" });
  if (sensorId) {
    params.append("sensor_id", sensorId.toString());
  }

  const response = await fetch(`${API_BASE}/api/v1/analytics/summary?${params}`, { headers });

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
  sensorId?: number,
  token?: string | null
): Promise<AnalyticsComplianceResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const params = new URLSearchParams({ period });
  if (sensorId) {
    params.append("sensor_id", sensorId.toString());
  }

  const response = await fetch(`${API_BASE}/api/v1/analytics/compliance?${params}`, { headers });

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

export async function fetchAnalyticsInsights(
  sensorId?: number,
  token?: string | null,
  options?: { refresh?: boolean }
): Promise<AnalyticsInsightsResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const params = new URLSearchParams({ period: "24h" });
  if (sensorId) {
    params.append("sensor_id", sensorId.toString());
  }
  if (options?.refresh) {
    params.set("refresh", "true");
  }

  const response = await fetch(`${API_BASE}/api/v1/analytics/insights?${params}`, { headers });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({
      error: "Unknown error",
      detail: `Server returned ${response.status} ${response.statusText}`
    }));
    throw new Error(error.detail || error.error);
  }

  return response.json();
}
