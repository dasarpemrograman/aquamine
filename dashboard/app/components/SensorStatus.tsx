"use client";

import { useEffect, useState } from "react";
import { wsClient } from "@/lib/websocket";

interface SensorReading {
  sensor_id: string;
  ph: number;
  turbidity: number;
  temperature: number;
  timestamp: string;
}

export default function SensorStatus({ sensorId }: { sensorId: string }) {
  const [reading, setReading] = useState<SensorReading | null>(null);

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((msg) => {
      if (msg.type === "reading" && msg.data.sensor_id === sensorId) {
        setReading(msg.data);
      }
    });

    return unsubscribe;
  }, [sensorId]);

  if (!reading) return <div className="text-gray-500">Waiting for data...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatusCard label="pH" value={reading.ph.toFixed(2)} unit="" />
      <StatusCard label="Turbidity" value={reading.turbidity.toFixed(1)} unit="NTU" />
      <StatusCard label="Temp" value={reading.temperature.toFixed(1)} unit="°C" />
    </div>
  );
}

function StatusCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow text-center">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold">
        {value}
        <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}
