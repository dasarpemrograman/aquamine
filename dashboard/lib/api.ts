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
  sessionId: string
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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
