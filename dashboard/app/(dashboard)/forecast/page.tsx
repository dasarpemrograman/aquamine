"use client";

import { useEffect, useState } from "react";
import { useWebSocket } from "@/lib/websocket";
import ForecastChart from "@/app/components/ForecastChart";
import AlertList from "@/app/components/AlertList";
import SensorStatus from "@/app/components/SensorStatus";

import { StatusChip } from "@/app/components/ui/StatusChip";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { Activity, AlertTriangle, LineChart } from "lucide-react";
import { UI_COPY } from "@/lib/copy";
import { fetchSensors, Sensor } from "@/lib/api";

export default function ForecastPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL ? `${process.env.NEXT_PUBLIC_WS_BASE_URL}/ws/realtime` : "ws://localhost:8181/ws/realtime";
  const { lastMessage, isConnected } = useWebSocket(wsUrl);

  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedSensorId, setSelectedSensorId] = useState<string>("1");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSensors = async () => {
      try {
        const data = await fetchSensors();
        setSensors(data);
        
        if (data.length > 0) {
          const currentExists = data.some(s => s.id.toString() === "1");
          if (!currentExists) {
            setSelectedSensorId(data[0].id.toString());
          }
        }
      } catch (err) {
        console.error("Failed to fetch sensors:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSensors();
  }, []);

  const selectedSensor = sensors.find(s => s.id.toString() === selectedSensorId);

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title={UI_COPY.forecast_title}
          subtitle={
            selectedSensor 
              ? `${UI_COPY.forecast_subtitle} • ${selectedSensor.name}` 
              : UI_COPY.forecast_subtitle
          }
          icon={LineChart}
          actions={
            <div className="flex items-center gap-3">
              <select
                value={selectedSensorId}
                onChange={(e) => setSelectedSensorId(e.target.value)}
                disabled={loading}
                className="pl-3 pr-8 py-2 bg-white/50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 appearance-none cursor-pointer hover:bg-white/80 transition-colors disabled:opacity-50"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: "right 0.5rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.5em 1.5em"
                }}
              >
                {sensors.map((sensor) => (
                  <option key={sensor.id} value={sensor.id.toString()}>
                    {sensor.name}
                  </option>
                ))}
                {loading && sensors.length === 0 && <option>Loading...</option>}
              </select>
              <StatusChip
                status={isConnected ? "info" : "warning"}
                label={isConnected ? UI_COPY.live_feed_active : UI_COPY.connecting}
              />
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <ForecastChart sensorId={selectedSensorId} />
            <div className="space-y-4">
              <SectionHeader title={UI_COPY.sensor_status} icon={Activity} />
              <SensorStatus />
            </div>
          </div>
          <div className="space-y-4">
            <SectionHeader title={UI_COPY.recent_alerts} icon={AlertTriangle} />
            <AlertList limit={4} compact={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
