const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181";

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
