"use client";

import { useWebSocket } from "@/lib/websocket";
import ForecastChart from "@/app/components/ForecastChart";
import AlertList from "@/app/components/AlertList";
import SensorStatus from "@/app/components/SensorStatus";
import { Activity } from "lucide-react";

export default function ForecastPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL ? `${process.env.NEXT_PUBLIC_WS_BASE_URL}/ws/realtime` : "ws://localhost:8181/ws/realtime";
  const { lastMessage, isConnected } = useWebSocket(wsUrl);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Forecast & Analytics
          </h1>
          <p className="text-foreground-muted mt-1">
            Predictive modeling for water quality parameters.
          </p>
        </div>
        <div className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${isConnected ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'}`}>
            <Activity size={16} className={isConnected ? "animate-pulse" : ""} />
            {isConnected ? 'Real-time Connected' : 'Connecting...'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <ForecastChart sensorId="1" />
            <SensorStatus />
        </div>
        <div className="h-full">
            <AlertList />
        </div>
      </div>
    </div>
  );
}
