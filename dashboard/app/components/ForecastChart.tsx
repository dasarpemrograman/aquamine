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

  if (loading) return <div>Loading forecast...</div>;

  const statusTone = anomaly
    ? anomaly.severity === "critical"
      ? "bg-red-100 text-red-800"
      : anomaly.severity === "warning"
      ? "bg-yellow-100 text-yellow-800"
      : anomaly.severity === "normal"
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-700"
    : "bg-gray-100 text-gray-700";

  const statusLabel = anomaly ? anomaly.severity.toUpperCase() : "UNKNOWN";
  const lastUpdatedLabel = anomaly?.last_updated ? formatWIB(anomaly.last_updated) : null;
  const forecastStart = data.length ? formatWIB(data[0].timestamp) : null;

  return (
    <div className="w-full bg-white p-4 rounded-lg shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">7-Day Forecast</h3>
          {historyHours ? (
            <p className="text-xs text-gray-500">Based on: {historyHours}h of sensor data</p>
          ) : null}
        </div>
        {anomaly && (
          <div className="flex flex-col items-end gap-1">
            <div className={`px-3 py-1 rounded text-sm font-medium ${statusTone}`}>
              Current Status: {statusLabel}
            </div>
            {lastUpdatedLabel ? (
              <div className="text-xs text-gray-500">Last updated: {lastUpdatedLabel}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="h-96">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={chartDomain}
                tickFormatter={(value) => formatWIBShort(value)}
              />
              <YAxis
                yAxisId="left"
                label={{ value: "pH", angle: -90, position: "insideLeft" }}
                domain={[0, 14]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: "Confidence", angle: 90, position: "insideRight" }}
                domain={[0, 1]}
              />
              <Tooltip
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
              <Legend />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="confidence"
                name="Confidence"
                fill="#82ca9d"
                stroke="#82ca9d"
                fillOpacity={0.3}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ph_pred"
                name="Predicted pH"
                stroke="#2563eb"
                activeDot={{ r: 6 }}
                strokeWidth={2}
              />
              <ReferenceLine
                x={nowTimestamp}
                stroke="#111827"
                strokeDasharray="4 4"
                label={{
                  value: `NOW (${formatWIBShort(nowTimestamp)})`,
                  position: "top",
                  fill: "#111827",
                  fontSize: 12,
                }}
              />
              {lastReadingTimestamp !== null && latestReading?.ph != null ? (
                <ReferenceDot
                  x={lastReadingTimestamp}
                  y={latestReading.ph}
                  r={5}
                  fill="#2563eb"
                  stroke="none"
                  label={{
                    value: `Last Reading (${formatWIBShort(lastReadingTimestamp)})`,
                    position: "top",
                    fill: "#2563eb",
                    fontSize: 12,
                  }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            {warning ?? "No forecast available"}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1 text-sm text-gray-600">
        {latestReading ? (
          <div>
            Last Reading: pH {latestReading.ph?.toFixed(2) ?? "--"} at{" "}
            {formatWIB(latestReading.timestamp)}
          </div>
        ) : (
          <div>Last Reading: No data</div>
        )}
        {forecastStart ? <div>Forecast start: {forecastStart}</div> : null}
      </div>

      {anomaly && anomaly.reason ? (
        <div className="mt-2 text-sm text-gray-600">
          <strong>Analysis:</strong> {anomaly.reason}
        </div>
      ) : null}
    </div>
  );
}
