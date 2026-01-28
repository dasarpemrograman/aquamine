"use client";

import { useEffect, useState } from "react";
import { Activity, Battery, Signal, Wifi, WifiOff } from "lucide-react";

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
    <div className="bg-surface border border-white/5 p-6 rounded-2xl shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Activity className="text-primary" />
          Sensor Network
        </h3>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
          {sensors.length} Active
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sensors.map((sensor: any) => (
          <div 
            key={sensor.id} 
            className="group relative bg-background/50 border border-white/5 hover:border-primary/50 p-4 rounded-xl transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-lg">{sensor.name}</span>
                <span className="text-xs text-foreground-muted font-mono">ID: {sensor.sensor_id}</span>
              </div>
              
              <div className={`
                flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border
                ${sensor.is_active 
                  ? 'bg-success/10 text-success border-success/20' 
                  : 'bg-danger/10 text-danger border-danger/20'}
              `}>
                {sensor.is_active ? <Wifi size={12} /> : <WifiOff size={12} />}
                {sensor.is_active ? 'ONLINE' : 'OFFLINE'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="flex items-center gap-2 text-xs text-foreground-muted bg-background/50 p-2 rounded-lg">
                <Battery size={14} className={sensor.battery < 20 ? "text-danger" : "text-success"} />
                <span>Battery: 100%</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground-muted bg-background/50 p-2 rounded-lg">
                <Signal size={14} className="text-primary" />
                <span>Signal: -65 dBm</span>
              </div>
            </div>
            
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
        ))}

        {sensors.length === 0 && (
          <div className="text-center py-8 text-foreground-muted">
            <WifiOff className="mx-auto w-8 h-8 mb-2 opacity-50" />
            <p>No sensors connected</p>
          </div>
        )}
      </div>
    </div>
  );
}
