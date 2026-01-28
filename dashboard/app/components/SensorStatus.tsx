"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { Activity, Battery, Signal } from "lucide-react";

export default function SensorStatus() {
  const [sensors, setSensors] = useState([]);

  useEffect(() => {
    async function fetchSensors() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/sensors`);
        const json = await res.json();
        setSensors(json);
      } catch (e) {
        console.error("Failed to fetch sensors", e);
      }
    }
    fetchSensors();
  }, []);

  return (
    <GlassCard>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sensors.map((sensor: any) => (
          <div key={sensor.id} className="border p-4 rounded-lg flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold">{sensor.name}</span>
              <StatusChip
                status={sensor.is_active ? 'active' : 'critical'}
                label={sensor.is_active ? 'ACTIVE' : 'OFFLINE'}
                size="sm"
              />
            </div>
            <div className="text-sm text-gray-500">ID: {sensor.sensor_id}</div>
            <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Battery size={14} /> 100%
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Signal size={14} /> -65 dBm
                </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
