"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { formatWIB, formatWIBShort } from "@/lib/dateUtils";
import { UI_COPY, getSeverityLabel, getStaleReason, formatString } from "@/lib/copy";

interface ForecastPoint {
  timestamp: string;
  ph_pred: number;
  confidence: number;
  turbidity_pred?: number;
  turbidity_confidence?: number;
  temperature_pred?: number;
  temperature_confidence?: number;
}

interface AnomalyData {
  score: number;
  severity: string;
  reason: string;
  last_updated?: string | null;
}

interface LatestReading {
  timestamp: string;
  ph?: number | null;
  turbidity?: number | null;
  temperature?: number | null;
}

interface ForecastResponse {
  forecast: ForecastPoint[];
  anomaly: AnomalyData;
  latest_reading?: LatestReading | null;
  history_hours?: number | null;
  warning?: string | null;
  forecast_generated_at?: string | null;
  forecast_start?: string | null;
  forecast_end?: string | null;
  forecast_timezone?: string;
  forecast_is_stale?: boolean;
  forecast_stale_reason?: string | null;
}

interface ChartPoint {
  timestamp: number;
  ph_pred?: number;
  confidence?: number;
  turbidity_pred?: number;
  turbidity_confidence?: number;
  temperature_pred?: number;
  temperature_confidence?: number;
}

type ForecastParameter = "ph" | "turbidity" | "temperature";

const PARAMETER_CONFIG: Record<ForecastParameter, {
  label: string;
  unit: string;
  dataKey: keyof ChartPoint;
  confidenceKey: keyof ChartPoint;
  domain: [number, number | "auto"];
  color: string;
  gradientId: string;
  areaGradientId: string;
  copy: string;
}> = {
  ph: {
    label: "pH",
    unit: "pH",
    dataKey: "ph_pred",
    confidenceKey: "confidence",
    domain: [0, 14],
    color: "#0ea5e9", // Sky blue
    gradientId: "forecast-ph-line",
    areaGradientId: "forecast-confidence-area-ph",
    copy: UI_COPY.predicted_ph,
  },
  turbidity: {
    label: UI_COPY.turbidity,
    unit: "NTU",
    dataKey: "turbidity_pred",
    confidenceKey: "turbidity_confidence",
    domain: [0, "auto"],
    color: "#d97706", // Amber
    gradientId: "forecast-turbidity-line",
    areaGradientId: "forecast-confidence-area-turbidity",
    copy: `Prediksi ${UI_COPY.turbidity}`,
  },
  temperature: {
    label: UI_COPY.temperature,
    unit: "°C",
    dataKey: "temperature_pred",
    confidenceKey: "temperature_confidence",
    domain: [0, 50],
    color: "#ef4444", // Red
    gradientId: "forecast-temperature-line",
    areaGradientId: "forecast-confidence-area-temperature",
    copy: `Prediksi ${UI_COPY.temperature}`,
  },
};

type ForecastTooltipPayload = {
  dataKey?: string;
  value?: number | string;
  color?: string;
};

type ForecastTooltipProps = {
  active?: boolean;
  payload?: ForecastTooltipPayload[];
  label?: number | string;
  parameter?: ForecastParameter;
};

const formatTooltipNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return "--";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return numeric.toFixed(2);
};

const formatTooltipConfidence = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return "--";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return `${Math.round(numeric * 100)}%`;
};

const formatTooltipLabel = (label: number | string | undefined) => {
  if (label === undefined) {
    return "--";
  }
  const numeric = typeof label === "number" ? label : Number(label);
  if (Number.isNaN(numeric)) {
    return String(label);
  }
  return formatWIB(numeric);
};

function ForecastTooltip({ active, payload, label, parameter = "ph" }: ForecastTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const config = PARAMETER_CONFIG[parameter];
  const predItem = payload.find((item) => item.dataKey === config.dataKey);
  const confidenceItem = payload.find((item) => item.dataKey === config.confidenceKey);

  return (
    <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md">
      <div className="text-xs font-semibold text-slate-600">{formatTooltipLabel(label)}</div>
      <div className="mt-1 space-y-1 text-xs text-slate-600">
        {predItem && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">{config.copy}</span>
            <span className="font-semibold text-slate-800">
              {formatTooltipNumber(predItem.value)} <span className="text-[10px] text-slate-400 font-normal">{config.unit}</span>
            </span>
          </div>
        )}
        {confidenceItem && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">{UI_COPY.confidence}</span>
            <span className="font-semibold text-slate-800">{formatTooltipConfidence(confidenceItem.value)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const RANGE_OPTIONS = [
  { label: "24h", value: 24, description: UI_COPY.range_24h },
  { label: "7d", value: 168, description: UI_COPY.range_7d },
  { label: "30d", value: 720, description: UI_COPY.range_30d },
] as const;

export default function ForecastChart({ sensorId }: { sensorId: string }) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [anomaly, setAnomaly] = useState<AnomalyData | null>(null);
  const [latestReading, setLatestReading] = useState<LatestReading | null>(null);
  const [historyHours, setHistoryHours] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [forecastGeneratedAt, setForecastGeneratedAt] = useState<string | null>(null);
  const [forecastStart, setForecastStart] = useState<string | null>(null);
  const [forecastEnd, setForecastEnd] = useState<string | null>(null);
  const [forecastIsStale, setForecastIsStale] = useState<boolean>(false);
  const [forecastStaleReason, setForecastStaleReason] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<number>(168);
  const [selectedParameter, setSelectedParameter] = useState<ForecastParameter>("ph");
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/forecast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sensor_id: parseInt(sensorId), horizon_hours: selectedRange }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      const json: ForecastResponse = await res.json();

      setWarning(json.warning ?? null);
      setLatestReading(json.latest_reading ?? null);
      setHistoryHours(json.history_hours ?? null);
      setForecastGeneratedAt(json.forecast_generated_at ?? null);
      setForecastStart(json.forecast_start ?? null);
      setForecastEnd(json.forecast_end ?? null);
      setForecastIsStale(json.forecast_is_stale ?? false);
      setForecastStaleReason(json.forecast_stale_reason ?? null);

      const dataMap = new Map<number, ChartPoint>();

      if (json && json.forecast) {
        json.forecast.forEach((p) => {
          const ts = new Date(p.timestamp).getTime();
          dataMap.set(ts, {
            timestamp: ts,
            ph_pred: p.ph_pred,
            confidence: p.confidence,
            turbidity_pred: p.turbidity_pred,
            turbidity_confidence: p.turbidity_confidence,
            temperature_pred: p.temperature_pred,
            temperature_confidence: p.temperature_confidence,
          });
        });
      }

      const mergedData = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      setData(mergedData);

      if (json && json.anomaly) {
        setAnomaly(json.anomaly);
      }
    } catch (e) {
      console.error("Failed to fetch forecast", e);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [sensorId, selectedRange]);

  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (sensorId) {
          fetchData();
        }
      }, 10 * 60 * 1000);
    };

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && sensorId) {
        // Reset interval to prevent duplicate fetches near the 10-minute boundary
        stopInterval();
        fetchData();
        startInterval();
      }
    };

    if (sensorId) {
      fetchData();
      startInterval();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sensorId, fetchData]);

  const nowTimestamp = Date.now();
  const lastReadingTimestamp = latestReading
    ? new Date(latestReading.timestamp).getTime()
    : null;

  const activeConfig = PARAMETER_CONFIG[selectedParameter];

  // Get the latest prediction point if available
  const latestPrediction = data.length > 0 ? data[0] : null;
  const latestPredictionValue = latestPrediction ? latestPrediction[activeConfig.dataKey] : null;

  const hasDataForParameter = useMemo(() => {
    return data.some((p) => p[activeConfig.dataKey] != null);
  }, [data, activeConfig.dataKey]);

  const chartDomain = useMemo(() => {
    if (!data.length) return undefined;

    let min = data[0].timestamp;
    let max = data[data.length - 1].timestamp;

    if (nowTimestamp < min) min = nowTimestamp;
    if (nowTimestamp > max) max = nowTimestamp;

    if (lastReadingTimestamp) {
        if (lastReadingTimestamp < min) min = lastReadingTimestamp;
        if (lastReadingTimestamp > max) max = lastReadingTimestamp;
    }

    return [min, max] as [number, number];
  }, [data, nowTimestamp, lastReadingTimestamp]);

  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <div className="text-sm text-slate-500">{UI_COPY.loading_forecast}</div>;

  const statusLabel = anomaly ? getSeverityLabel(anomaly.severity) : getSeverityLabel(null);
  const forecastGeneratedLabel = forecastGeneratedAt ? formatWIB(forecastGeneratedAt) : null;
  const forecastStartLabel = data.length ? formatWIB(data[0].timestamp) : null;
  const forecastEndLabel = data.length ? formatWIB(data[data.length - 1].timestamp) : null;

  const latestReadingValue = latestReading ? (
    selectedParameter === 'ph' ? latestReading.ph :
    selectedParameter === 'turbidity' ? latestReading.turbidity :
    selectedParameter === 'temperature' ? latestReading.temperature : null
  ) : null;

  return (
    <GlassCard className="w-full">
      <div className="flex flex-col gap-6 pb-6 border-b border-white/40">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold text-slate-800">
                {RANGE_OPTIONS.find((r) => r.value === selectedRange)?.description ?? UI_COPY.forecast_title}
              </h3>
              {forecastIsStale && (
                <StatusChip 
                  status="warning" 
                  label={UI_COPY.stale} 
                  size="sm"
                />
              )}
            </div>
            
            {/* Big Number Summary */}
            {latestPrediction && (
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-4xl font-bold text-slate-900">
                  {typeof latestPredictionValue === 'number' ? latestPredictionValue.toFixed(2) : "--"}
                </span>
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                  {activeConfig.copy} ({UI_COPY.now})
                </span>
              </div>
            )}

            {forecastStartLabel && forecastEndLabel && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-cyan-700">
                <span>{UI_COPY.forecast_range_label}: {forecastStartLabel} → {forecastEndLabel}</span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span>{data.length} {UI_COPY.forecast_points}</span>
              </div>
            )}
            
            {selectedParameter === 'ph' && (
              <div className="mt-2 inline-flex items-center px-2 py-1 bg-slate-100 rounded text-[10px] font-medium text-slate-500 border border-slate-200">
                {UI_COPY.source}: Kepmen LH 113/2003 (pH 6-9)
              </div>
            )}
          </div>

          <div className="flex flex-col items-start md:items-end gap-3">
             <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                {(Object.keys(PARAMETER_CONFIG) as ForecastParameter[]).map((param) => (
                  <button
                    key={param}
                    onClick={() => setSelectedParameter(param)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      selectedParameter === param
                        ? "bg-white text-cyan-700 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    }`}
                  >
                    {PARAMETER_CONFIG[param].label}
                  </button>
                ))}
             </div>

             <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  {RANGE_OPTIONS.map((range) => (
                    <button
                      key={range.value}
                      onClick={() => setSelectedRange(range.value)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        selectedRange === range.value
                          ? "bg-white text-cyan-700 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={handleRefresh}
                  className="p-2 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors border border-transparent hover:border-cyan-100"
                  title={UI_COPY.refresh_forecast}
                >
                  <RefreshCw size={16} className={isFetchingRef.current ? "animate-spin" : ""} />
                </button>
             </div>

            {anomaly && (
              <div className="flex flex-col items-start md:items-end gap-1">
                <StatusChip
                  status={
                    anomaly.severity === "critical" ? "critical" :
                    anomaly.severity === "warning" ? "warning" :
                    anomaly.severity === "normal" ? "active" : "info"
                  }
                  label={statusLabel}
                  size="sm"
                />
                {forecastIsStale && forecastStaleReason && (
                   <span className="text-xs text-amber-600 font-medium text-right max-w-[200px]">
                      {getStaleReason(forecastStaleReason)}
                   </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-96 w-full">
        {data.length && hasDataForParameter ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <defs>
                <linearGradient id={activeConfig.gradientId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={activeConfig.color} />
                  <stop offset="100%" stopColor={activeConfig.color} />
                </linearGradient>
                <linearGradient id={activeConfig.areaGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`${activeConfig.color}40`} />
                  <stop offset="100%" stopColor={`${activeConfig.color}05`} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 6" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={chartDomain}
                tickFormatter={(value) => formatWIBShort(value)}
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                label={{ value: activeConfig.unit, angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 12 }}
                domain={activeConfig.domain}
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: "Confidence", angle: 90, position: "insideRight", fill: "#94a3b8", fontSize: 12 }}
                domain={[0, 1]}
                tickFormatter={(value) => `${Math.round(value * 100)}%`}
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ForecastTooltip parameter={selectedParameter} />} cursor={{ stroke: "#bae6fd", strokeDasharray: "4 4" }} />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey={activeConfig.confidenceKey}
                name="Confidence"
                fill={`url(#${activeConfig.areaGradientId})`}
                stroke={activeConfig.color}
                strokeOpacity={0.5}
                strokeWidth={1.5}
                fillOpacity={1}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey={activeConfig.dataKey}
                name={activeConfig.copy}
                stroke={`url(#${activeConfig.gradientId})`}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, stroke: activeConfig.color, strokeWidth: 2, fill: "#ffffff" }}
              />
              <ReferenceLine
                x={data[0].timestamp}
                stroke="#64748b"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
                label={{
                  value: UI_COPY.start,
                  position: "insideTop",
                  fill: "#64748b",
                  fontSize: 10,
                  textAnchor: "start",
                  dx: 4,
                }}
              />
              <ReferenceLine
                x={nowTimestamp}
                stroke="#38bdf8"
                strokeDasharray="4 4"
                label={{
                  value: `${UI_COPY.now} (${formatWIBShort(nowTimestamp)})`,
                  position: "top",
                  fill: "#38bdf8",
                  fontSize: 11,
                }}
              />
              {lastReadingTimestamp !== null && latestReadingValue != null ? (
                <ReferenceDot
                  x={lastReadingTimestamp}
                  y={latestReadingValue}
                  r={4}
                  fill="#ffffff"
                  stroke={activeConfig.color}
                  strokeWidth={2}
                  label={{
                    value: UI_COPY.last_reading,
                    position: "top",
                    fill: activeConfig.color,
                    fontSize: 11,
                  }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            {warning ?? (data.length ? "Data tidak tersedia untuk parameter ini" : UI_COPY.no_forecast)}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1 text-sm text-slate-600">
        {latestReading && latestReadingValue != null ? (
          <div className="p-3 bg-background/50 rounded-xl border border-white/5">
            <span className="block text-xs font-bold uppercase tracking-wider mb-1 text-primary">{UI_COPY.last_reading}</span>
             {activeConfig.label} {latestReadingValue.toFixed(2)} {activeConfig.unit} @ {formatWIB(latestReading.timestamp)}
          </div>
        ) : (
          <div className="p-3 bg-background/50 rounded-xl border border-white/5">{UI_COPY.last_reading}: Tidak ada data</div>
        )}
        {forecastStartLabel ? (
           <div className="p-3 bg-background/50 rounded-xl border border-white/5">
              <span className="block text-xs font-bold uppercase tracking-wider mb-1 text-primary">{UI_COPY.forecast_start}</span>
              {forecastStartLabel}
           </div>
        ) : null}
      </div>

      {anomaly && anomaly.reason ? (
        <div className="mt-2 text-sm text-slate-600">
          <strong>{UI_COPY.analysis}:</strong> {anomaly.reason}
        </div>
      ) : null}
    </GlassCard>
  );
}
