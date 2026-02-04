"use client";

import { Battery, Signal, WifiOff, Clock } from "lucide-react";
import { Sensor } from "@/lib/api";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { UI_COPY, getSeverityLabel, formatString } from "@/lib/copy";

interface FieldSensorStatusProps {
  sensors: Sensor[];
}

export default function FieldSensorStatus({ sensors }: FieldSensorStatusProps) {
  // Group sensors by status
  const statusCounts = {
    normal: sensors.filter(s => s.current_state === 'normal' && s.is_active).length,
    warning: sensors.filter(s => s.current_state === 'warning' && s.is_active).length,
    critical: sensors.filter(s => s.current_state === 'critical' && s.is_active).length,
    offline: sensors.filter(s => !s.is_active).length,
    total: sensors.length
  };

  // Mock function for last update - in real app would come from sensor.last_seen
  const getTimeAgo = (sensorId: number) => {
    // Deterministic mock based on ID
    const minutes = (sensorId * 7) % 15 + 1;
    return formatString(UI_COPY.minutes_ago, { minutes });
  };

  return (
    <div className="space-y-4">
      {/* Summary Chips */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-emerald-100 border border-emerald-200 p-2 rounded-lg text-center">
          <span className="block text-2xl font-bold text-emerald-700">{statusCounts.normal}</span>
          <span className="text-xs text-emerald-600 font-medium uppercase">{UI_COPY.normal_short}</span>
        </div>
        <div className="bg-amber-100 border border-amber-200 p-2 rounded-lg text-center">
          <span className="block text-2xl font-bold text-amber-700">{statusCounts.warning}</span>
          <span className="text-xs text-amber-600 font-medium uppercase">{UI_COPY.warn_short}</span>
        </div>
        <div className="bg-rose-100 border border-rose-200 p-2 rounded-lg text-center">
          <span className="block text-2xl font-bold text-rose-700">{statusCounts.critical}</span>
          <span className="text-xs text-rose-600 font-medium uppercase">{UI_COPY.crit_short}</span>
        </div>
        <div className="bg-slate-100 border border-slate-200 p-2 rounded-lg text-center">
          <span className="block text-2xl font-bold text-slate-700">{statusCounts.offline}</span>
          <span className="text-xs text-slate-600 font-medium uppercase">{UI_COPY.offline}</span>
        </div>
      </div>

      {/* Sensor List */}
      <GlassCard className="max-h-[300px] overflow-y-auto custom-scrollbar">
        <h3 className="text-sm font-semibold text-slate-500 mb-3 sticky top-0 bg-white/80 backdrop-blur-sm pb-2 border-b border-slate-100">
          {UI_COPY.sensor_fleet_status}
        </h3>
        
        {sensors.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <WifiOff className="mx-auto w-8 h-8 mb-2 opacity-50" />
            <p>{UI_COPY.no_sensors_connected}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sensors.map((sensor, idx) => (
              <div key={sensor.id} className="flex flex-col gap-2 p-3 rounded-lg border border-slate-100 bg-white/50 hover:bg-white transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-slate-800">{sensor.name}</span>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                       <Clock size={12} />
                       <span>{getTimeAgo(sensor.id)}</span>
                    </div>
                  </div>
                  <StatusChip
                    status={!sensor.is_active ? 'inactive' : sensor.current_state === 'critical' ? 'critical' : sensor.current_state === 'warning' ? 'warning' : 'active'}
                    label={!sensor.is_active ? UI_COPY.offline.toUpperCase() : getSeverityLabel(sensor.current_state).toUpperCase()}
                    size="sm"
                  />
                </div>

                {sensor.is_active && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100/50 p-1.5 rounded">
                      <Battery size={14} className="text-emerald-500" />
                      <span>{80 + (sensor.id % 20)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100/50 p-1.5 rounded">
                      <Signal size={14} className="text-cyan-500" />
                      <span>-{50 + (sensor.id % 30)} dBm</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
