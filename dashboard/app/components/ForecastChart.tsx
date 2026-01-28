"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { formatWIB, formatWIBShort } from "@/lib/dateUtils";

interface ForecastPoint {
  timestamp: string;
  ph_pred: number;
  confidence: number;
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
  ph_pred: number;
  confidence: number;
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/forecast`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sensor_id: parseInt(sensorId) }),
        });

        if (!res.ok) {
          throw new Error(`Error: ${res.status}`);
        }

        const json: ForecastResponse = await res.json();

        setWarning(json.warning ?? null);
        setLatestReading(json.latest_reading ?? null);
        setHistoryHours(json.history_hours ?? null);

        if (json && json.forecast) {
          const chartData = json.forecast.map((p) => ({
            timestamp: new Date(p.timestamp).getTime(),
            ph_pred: p.ph_pred,
            confidence: p.confidence,
          }));
          setData(chartData);
        } else {
          setData([]);
        }

        if (json && json.anomaly) {
          setAnomaly(json.anomaly);
        }
      } catch (e) {
        console.error("Failed to fetch forecast", e);
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

  if (loading) return <div className="text-foreground-muted animate-pulse">Loading forecast...</div>;

  const statusTone = anomaly
    ? anomaly.severity === "critical"
      ? "bg-danger/10 text-danger border border-danger/20"
      : anomaly.severity === "warning"
      ? "bg-warning/10 text-warning border border-warning/20"
      : anomaly.severity === "normal"
      ? "bg-success/10 text-success border border-success/20"
      : "bg-surface text-foreground-muted border border-white/10"
    : "bg-surface text-foreground-muted border border-white/10";

  const statusLabel = anomaly ? anomaly.severity.toUpperCase() : "UNKNOWN";
  const lastUpdatedLabel = anomaly?.last_updated ? formatWIB(anomaly.last_updated) : null;
  const forecastStart = data.length ? formatWIB(data[0].timestamp) : null;

  return (
    <div className="w-full bg-surface border border-white/5 p-6 rounded-2xl shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">7-Day Forecast</h3>
          {historyHours ? (
            <p className="text-xs text-foreground-muted">Based on: {historyHours}h of sensor data</p>
          ) : null}
        </div>
        {anomaly && (
          <div className="flex flex-col items-end gap-1">
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${statusTone}`}>
              Status: {statusLabel}
            </div>
            {lastUpdatedLabel ? (
              <div className="text-xs text-foreground-muted">Last updated: {lastUpdatedLabel}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="h-96 w-full">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={chartDomain}
                tickFormatter={(value) => formatWIBShort(value)}
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                label={{ value: "pH", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
                domain={[0, 14]}
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: "Confidence", angle: 90, position: "insideRight", fill: "#94a3b8" }}
                domain={[0, 1]}
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0B1121",
                  borderColor: "#1e293b",
                  borderRadius: "12px",
                  color: "#f1f5f9",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                }}
                itemStyle={{ color: "#f1f5f9" }}
                labelFormatter={(value) => formatWIB(value as number)}
                formatter={(value, name) => {
                  if (value === null || value === undefined) {
                    return ["--", name ?? "Value"];
                  }
                  const numeric = typeof value === "number" ? value : Number(value);
                  const safeValue = Number.isNaN(numeric) ? value : numeric.toFixed(2);
                  if (name === "ph_pred") {
                    return [safeValue, "Predicted pH"];
                  }
                  if (name === "confidence") {
                    return [safeValue, "Confidence"];
                  }
                  return [safeValue, name ?? "Value"];
                }}
              />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="confidence"
                name="Confidence"
                fill="#06b6d4"
                stroke="#06b6d4"
                fillOpacity={0.1}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ph_pred"
                name="Predicted pH"
                stroke="#22d3ee"
                activeDot={{ r: 6, fill: "#22d3ee", stroke: "#fff" }}
                strokeWidth={3}
                dot={false}
              />
              <ReferenceLine
                x={nowTimestamp}
                stroke="#f1f5f9"
                strokeDasharray="4 4"
                label={{
                  value: `NOW`,
                  position: "top",
                  fill: "#f1f5f9",
                  fontSize: 10,
                }}
              />
              {lastReadingTimestamp !== null && latestReading?.ph != null ? (
                <ReferenceDot
                  x={lastReadingTimestamp}
                  y={latestReading.ph}
                  r={5}
                  fill="#22d3ee"
                  stroke="none"
                  label={{
                    value: `Last Reading`,
                    position: "top",
                    fill: "#22d3ee",
                    fontSize: 10,
                  }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-foreground-muted bg-background/50 rounded-xl border border-white/5 border-dashed">
            {warning ?? "No forecast available"}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-foreground-muted">
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
        <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-xl text-sm text-foreground">
          <strong className="text-primary block mb-1">Analysis Report:</strong> {anomaly.reason}
        </div>
      ) : null}
    </div>
  );
}
