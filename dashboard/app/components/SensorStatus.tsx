"use client";

import { useEffect, useState } from "react";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { Battery, Signal, WifiOff } from "lucide-react";

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

  // Handle the empty state outside of the grid to allow for full-height centering
  if (sensors.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-center text-slate-500">
        <WifiOff className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">No sensors connected</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sensors.map((sensor: any) => (
        <div key={sensor.id} className="group relative bg-white/40 border border-white/50 p-4 rounded-xl flex flex-col gap-2 shadow-sm transition-all hover:bg-white/60 hover:shadow-md">
          <div className="flex justify-between items-center">
            <span className="font-semibold">{sensor.name}</span>
            <StatusChip
              status={sensor.is_active ? 'active' : 'inactive'}
              label={sensor.is_active ? 'Online' : 'Offline'}
              size="sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="flex items-center gap-2 text-xs text-foreground-muted bg-white/50 p-2 rounded-lg">
              <Battery size={14} className={sensor.battery < 20 ? "text-danger" : "text-success"} />
              <span>Battery: 100%</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground-muted bg-white/50 p-2 rounded-lg">
              <Signal size={14} className="text-primary" />
              <span>Signal: -65 dBm</span>
            </div>
          </div>
          
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
      ))}
    </div>
  );
}