const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export interface ForecastRequest {
  data: Array<{
    timestamp: string;
    sensor_id: string;
    ph: number;
    turbidity: number;
    conductivity: number;
    temperature: number;
  }>;
  horizon_days: number;
}

export interface ForecastResponse {
  forecasts: Array<{
    timestamp: string;
    sensor_id: string;
    parameter: string;
    predicted: number;
    lower_bound: number;
    upper_bound: number;
  }>;
  horizon_days: number;
  data_points: number;
}

export interface AlertStatesResponse {
  alert_states: Record<string, string>;
  last_updated: string | null;
}

export async function fetchForecast(data: ForecastRequest): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/api/v1/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchAlertStates(): Promise<AlertStatesResponse> {
  const res = await fetch(`${API_BASE}/api/v1/alerts`);
  return res.json();
}
