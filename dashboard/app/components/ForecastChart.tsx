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
  Area,
  ComposedChart
} from "recharts";

export default function ForecastChart({ sensorId }: { sensorId: string }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/forecast/${sensorId}`);
        const json = await res.json();
        
        // Flatten data for chart (one line per parameter)
        // This is a simplified view, assuming we show one parameter or aggregate
        // Ideally we filter by parameter
        if (json && json.length > 0) {
            // Transform for chart
            // For now, let's just mock or use the first prediction set
            const firstPred = json[0]; 
            const chartData = firstPred.forecast_values.map((p: any) => ({
                time: new Date(p.timestamp).toLocaleTimeString(),
                value: p.value,
                lower: p.lower,
                upper: p.upper
            }));
            setData(chartData);
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

  if (loading) return <div>Loading forecast...</div>;
  if (!data.length) return <div>No forecast available</div>;

  return (
    <div className="w-full h-96 bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4">7-Day Forecast</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="lower" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.2} />
          <Area type="monotone" dataKey="upper" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.2} />
          <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
