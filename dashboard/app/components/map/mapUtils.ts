export const SEVERITY_COLORS = {
  normal: "#22c55e",
  warning: "#eab308",
  critical: "#ef4444",
  offline: "#6b7280",
  unknown: "#9ca3af",
} as const;

export type Severity = keyof typeof SEVERITY_COLORS;

export interface SensorWithState {
  id: number;
  sensor_id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
  current_state?: string | null;
}

export type LatLngExpression = [number, number];

export const BERKELEY_PIT_POLYGON: LatLngExpression[] = [
  [46.025, -112.52],
  [46.025, -112.50],
  [46.015, -112.50],
  [46.015, -112.52],
];

export const BERKELEY_PIT_CENTER: LatLngExpression = [46.02, -112.51];

function isPointInPolygon(point: [number, number], polygon: LatLngExpression[]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

export function getMarkerColor(sensor: SensorWithState): string {
  if (!sensor.is_active) return SEVERITY_COLORS.offline;
  const state = sensor.current_state?.toLowerCase();
  if (state === "normal") return SEVERITY_COLORS.normal;
  if (state === "warning") return SEVERITY_COLORS.warning;
  if (state === "critical") return SEVERITY_COLORS.critical;
  return SEVERITY_COLORS.unknown;
}

export function getPolygonColor(sensors: SensorWithState[]): string {
  const severities = sensors
    .filter(s => s.is_active && s.latitude && s.longitude)
    .filter(s => isPointInPolygon([s.latitude!, s.longitude!], BERKELEY_PIT_POLYGON))
    .map(s => s.current_state?.toLowerCase())
    .filter((s): s is string => !!s);
  
  if (severities.length === 0) return SEVERITY_COLORS.unknown;
  
  if (severities.includes("critical")) return SEVERITY_COLORS.critical;
  if (severities.includes("warning")) return SEVERITY_COLORS.warning;
  if (severities.includes("normal")) return SEVERITY_COLORS.normal;
  
  return SEVERITY_COLORS.unknown;
}

export function countMissingCoords(sensors: SensorWithState[]): number {
  return sensors.filter(s => !s.latitude || !s.longitude).length;
}
