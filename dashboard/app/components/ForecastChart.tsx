"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ResponsiveContainer,
} from "recharts";

interface ChartDataPoint {
  timestamp: string;
  ph?: number;
  ph_forecast?: number;
  ph_lower?: number;
  ph_upper?: number;
}

interface ForecastChartProps {
  data: ChartDataPoint[];
}

export default function ForecastChart({ data }: ForecastChartProps) {
  const formatTime = (ts: string | number) => {
    const date = new Date(ts);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="w-full h-96 bg-white rounded-lg p-4 shadow-sm border">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">pH Forecast</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatTime}
            tick={{ fontSize: 12 }}
            stroke="#666"
          />
          <YAxis domain={[4, 8]} tick={{ fontSize: 12 }} stroke="#666" />
          <Tooltip 
            labelFormatter={(label) => formatTime(label as string)}
            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e0e0e0" }}
          />
          <Legend />
          
          {/* Confidence interval shading - render first so lines are on top */}
          <Area
            type="monotone"
            dataKey="ph_upper"
            stroke="none"
            fill="#3b82f6"
            fillOpacity={0.1}
            name="Upper bound"
          />
          <Area
            type="monotone"
            dataKey="ph_lower"
            stroke="none"
            fill="#ffffff"
            fillOpacity={1}
            name="Lower bound"
          />
          
          <Line
            type="monotone"
            dataKey="ph"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Historical pH"
          />
          
          <Line
            type="monotone"
            dataKey="ph_forecast"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Forecast pH"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
