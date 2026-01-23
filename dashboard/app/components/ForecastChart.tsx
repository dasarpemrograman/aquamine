"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { wsClient } from "@/lib/websocket";

interface ForecastData {
  timestamp: string;
  value: number;
  lower?: number;
  upper?: number;
}

interface ForecastChartProps {
  sensorId: number;
  parameter: "ph" | "turbidity" | "temperature";
}

export default function ForecastChart({ sensorId, parameter }: ForecastChartProps) {
  const [data, setData] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    fetch(`/api/v1/forecast/${sensorId}?parameter=${parameter}`)
      .then((res) => res.json())
      .then((forecast) => {
        setData(forecast.forecast_values);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch forecast", err);
        setLoading(false);
      });

    // Real-time updates via WebSocket
    const unsubscribe = wsClient.subscribe((msg) => {
      if (msg.type === "reading" && msg.data.sensor_id === sensorId) {
        // In a real app, we might update historical data here
        // For forecast, we might trigger a refresh if needed
      }
    });

    return unsubscribe;
  }, [sensorId, parameter]);

  if (loading) return <div>Loading forecast...</div>;

  return (
    <div className="w-full h-[400px] bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4 capitalize">{parameter} Forecast (7 Days)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(tick) => new Date(tick).toLocaleDateString()} 
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(label) => new Date(label).toLocaleString()}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            name="Forecast"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="upper"
            stroke="#93c5fd"
            strokeDasharray="5 5"
            name="Upper Bound"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="lower"
            stroke="#93c5fd"
            strokeDasharray="5 5"
            name="Lower Bound"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
