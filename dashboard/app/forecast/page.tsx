"use client";

import { useWebSocket } from "@/lib/websocket";
import ForecastChart from "@/app/components/ForecastChart";
import AlertList from "@/app/components/AlertList";
import SensorStatus from "@/app/components/SensorStatus";

export default function ForecastPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL ? `${process.env.NEXT_PUBLIC_WS_BASE_URL}/ws/realtime` : "ws://localhost:8181/ws/realtime";
  const { lastMessage, isConnected } = useWebSocket(wsUrl);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">AquaMine AI Dashboard</h1>
        <div className={`px-3 py-1 rounded text-sm ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {isConnected ? 'Real-time Connected' : 'Connecting...'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <ForecastChart sensorId="1" />
            <SensorStatus />
        </div>
        <div>
            <AlertList />
        </div>
      </div>
    </div>
  );
}
