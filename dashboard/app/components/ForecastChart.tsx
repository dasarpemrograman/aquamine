"use client";

import { useEffect, useMemo, useState } from "react";
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
import { GlassCard } from "@/app/components/ui/GlassCard";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { formatWIB, formatWIBShort } from "@/lib/dateUtils";

interface ForecastPoint {
  timestamp: string;
  ph_pred: number;
  confidence: number;
}

interface HistoricalReading {
  timestamp: string;
  ph?: number | null;
  turbidity?: number | null;
  temperature?: number | null;
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
}

interface ChartPoint {
  timestamp: number;
  ph_actual?: number | null;
  ph_pred?: number | null;
  confidence?: number | null;
  type: 'actual' | 'forecast';
}

type ForecastTooltipPayload = {
  dataKey?: string;
  value?: number | string;
};

type ForecastTooltipProps = {
  active?: boolean;
  payload?: ForecastTooltipPayload[];
  label?: number | string;
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

function ForecastTooltip({ active, payload, label }: ForecastTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const phActualItem = payload.find((item) => item.dataKey === "ph_actual");
  const phPredItem = payload.find((item) => item.dataKey === "ph_pred");
  const confidenceItem = payload.find((item) => item.dataKey === "confidence");

  // Determine if this is actual or forecast data
  const isForecast = phPredItem !== undefined;
  const isActual = phActualItem !== undefined;

  return (
    <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md">
      <div className="text-xs font-semibold text-slate-600">{formatTooltipLabel(label)}</div>
      <div className="mt-1 space-y-1 text-xs text-slate-600">
        {isActual && phActualItem && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Actual pH</span>
            <span className="font-semibold text-slate-800">{formatTooltipNumber(phActualItem.value)}</span>
          </div>
        )}
        {isForecast && phPredItem && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Predicted pH</span>
            <span className="font-semibold text-slate-800">{formatTooltipNumber(phPredItem.value)}</span>
          </div>
        )}
        {isForecast && confidenceItem && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Confidence</span>
            <span className="font-semibold text-slate-800">{formatTooltipConfidence(confidenceItem.value)}</span>
          </div>
        )}
        <div className="pt-1 border-t border-slate-200">
          <span className={`text-xs font-medium ${isActual ? 'text-blue-600' : 'text-amber-600'}`}>
            {isActual ? '📊 Actual Reading' : '🔮 Forecast'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ForecastChart({ sensorId }: { sensorId: string }) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [anomaly, setAnomaly] = useState<AnomalyData | null>(null);
  const [latestReading, setLatestReading] = useState<LatestReading | null>(null);
  const [historyHours, setHistoryHours] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch forecast data
        const forecastRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/forecast`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sensor_id: parseInt(sensorId) }),
        });

        if (!forecastRes.ok) {
          throw new Error(`Error fetching forecast: ${forecastRes.status}`);
        }

        const forecastJson: ForecastResponse = await forecastRes.json();

        setWarning(forecastJson.warning ?? null);
        setLatestReading(forecastJson.latest_reading ?? null);
        setHistoryHours(forecastJson.history_hours ?? null);

        // Fetch historical data (last 7 days)
        const historicalRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/sensors/${sensorId}/readings?hours=168`
        );

        let historicalData: HistoricalReading[] = [];
        if (historicalRes.ok) {
          historicalData = await historicalRes.json();
        }

        // Combine historical and forecast data
        const combinedData: ChartPoint[] = [];

        // Add historical data (actual readings)
        historicalData.forEach((reading) => {
          if (reading.ph !== null && reading.ph !== undefined) {
            combinedData.push({
              timestamp: new Date(reading.timestamp).getTime(),
              ph_actual: reading.ph,
              type: 'actual',
            });
          }
        });

        // Add forecast data
        if (forecastJson && forecastJson.forecast) {
          forecastJson.forecast.forEach((p) => {
            combinedData.push({
              timestamp: new Date(p.timestamp).getTime(),
              ph_pred: p.ph_pred,
              confidence: p.confidence,
              type: 'forecast',
            });
          });
        }

        // Sort by timestamp
        combinedData.sort((a, b) => a.timestamp - b.timestamp);
        setData(combinedData);

        if (forecastJson && forecastJson.anomaly) {
          setAnomaly(forecastJson.anomaly);
        }
      } catch (e) {
        console.error("Failed to fetch data", e);
      } finally {
        setLoading(false);
      }
    }

    if (sensorId) {
      fetchData();
    }
  }, [sensorId]);

  const nowTimestamp = Date.now();
  const lastReadingTimestamp = latestReading
    ? new Date(latestReading.timestamp).getTime()
    : null;

  const chartDomain = useMemo(() => {
    if (!data.length) {
      return undefined;
    }
    const timestamps = data.map((point) => point.timestamp);
    let min = Math.min(...timestamps, nowTimestamp);
    let max = Math.max(...timestamps, nowTimestamp);
    if (lastReadingTimestamp !== null) {
      min = Math.min(min, lastReadingTimestamp);
      max = Math.max(max, lastReadingTimestamp);
    }
    return [min, max] as [number, number];
  }, [data, lastReadingTimestamp, nowTimestamp]);

  if (loading) return <div className="text-sm text-slate-500">Loading forecast...</div>;

  const statusLabel = anomaly ? anomaly.severity.toUpperCase() : "UNKNOWN";
  const lastUpdatedLabel = anomaly?.last_updated ? formatWIB(anomaly.last_updated) : null;
  const forecastStart = data.length ? formatWIB(data[0].timestamp) : null;

  return (
    <GlassCard className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/40">
        <div>
          <h3 className="text-lg font-bold text-slate-800">7-Day Forecast with Historical Data</h3>
          {historyHours ? (
            <p className="text-xs text-slate-500">Based on: {historyHours}h of sensor data</p>
          ) : null}
          <div className="flex flex-wrap gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-xs text-slate-600">Actual pH (past 7 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-xs text-slate-600">Predicted pH (next 7 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-amber-300"></div>
              <span className="text-xs text-slate-600">Forecast confidence</span>
            </div>
          </div>
        </div>
        {anomaly && (
          <div className="flex flex-col items-start sm:items-end gap-1">
            <StatusChip
              status={
                anomaly.severity === "critical" ? "critical" :
                anomaly.severity === "warning" ? "warning" :
                anomaly.severity === "normal" ? "active" : "info"
              }
              label={statusLabel}
              size="sm"
            />
            {lastUpdatedLabel ? (
              <div className="text-xs text-slate-500">Last updated: {lastUpdatedLabel}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="h-96 w-full">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="actual-ph-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                <linearGradient id="forecast-ph-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <linearGradient id="forecast-confidence-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(245, 158, 11, 0.25)" />
                  <stop offset="100%" stopColor="rgba(245, 158, 11, 0.02)" />
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
                label={{ value: "pH", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 12 }}
                domain={[0, 14]}
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
              <Tooltip content={<ForecastTooltip />} cursor={{ stroke: "#bae6fd", strokeDasharray: "4 4" }} />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="confidence"
                name="Confidence"
                fill="url(#forecast-confidence-area)"
                stroke="#f59e0b"
                strokeWidth={1.5}
                fillOpacity={1}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ph_actual"
                name="Actual pH"
                stroke="url(#actual-ph-line)"
                strokeWidth={2.5}
                dot={{ r: 2, fill: "#3b82f6" }}
                activeDot={{ r: 5, stroke: "#1d4ed8", strokeWidth: 2, fill: "#ffffff" }}
                connectNulls={true}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ph_pred"
                name="Predicted pH"
                stroke="url(#forecast-ph-line)"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 5, stroke: "#d97706", strokeWidth: 2, fill: "#ffffff" }}
                connectNulls={true}
              />
              <ReferenceLine
                x={nowTimestamp}
                stroke="#38bdf8"
                strokeDasharray="4 4"
                label={{
                  value: `Now (${formatWIBShort(nowTimestamp)})`,
                  position: "top",
                  fill: "#38bdf8",
                  fontSize: 11,
                }}
              />
              {lastReadingTimestamp !== null && latestReading?.ph != null ? (
                <ReferenceDot
                  x={lastReadingTimestamp}
                  y={latestReading.ph}
                  r={4}
                  fill="#ffffff"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  label={{
                    value: `Last Reading`,
                    position: "top",
                    fill: "#0ea5e9",
                    fontSize: 11,
                  }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            {warning ?? "No forecast available"}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1 text-sm text-slate-600">
        {latestReading ? (
          <div className="p-3 bg-background/50 rounded-xl border border-white/5">
            <span className="block text-xs font-bold uppercase tracking-wider mb-1 text-primary">Last Reading</span>
             pH {latestReading.ph?.toFixed(2) ?? "--"} at {formatWIB(latestReading.timestamp)}
          </div>
        ) : (
          <div className="p-3 bg-background/50 rounded-xl border border-white/5">Last Reading: No data</div>
        )}
        {forecastStart ? (
           <div className="p-3 bg-background/50 rounded-xl border border-white/5">
              <span className="block text-xs font-bold uppercase tracking-wider mb-1 text-primary">Forecast Start</span>
              {forecastStart}
           </div>
        ) : null}
      </div>

      {anomaly && anomaly.reason ? (
        <div className="mt-2 text-sm text-slate-600">
          <strong>Analysis:</strong> {anomaly.reason}
        </div>
      ) : null}
    </GlassCard>
  );
}
