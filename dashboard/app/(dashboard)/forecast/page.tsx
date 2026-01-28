"use client";

import { useWebSocket } from "@/lib/websocket";
import ForecastChart from "@/app/components/ForecastChart";
import AlertList from "@/app/components/AlertList";
import SensorStatus from "@/app/components/SensorStatus";

import { StatusChip } from "@/app/components/ui/StatusChip";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { Activity, AlertTriangle, LineChart } from "lucide-react";

export default function ForecastPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL ? `${process.env.NEXT_PUBLIC_WS_BASE_URL}/ws/realtime` : "ws://localhost:8181/ws/realtime";
  const { lastMessage, isConnected } = useWebSocket(wsUrl);

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title="Forecast & Analysis"
          subtitle="7-day predictions and anomaly context"
          icon={LineChart}
          actions={
            <StatusChip
              status={isConnected ? "info" : "warning"}
              label={isConnected ? "Live Feed Active" : "Connecting..."}
            />
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <ForecastChart sensorId="1" />
            <div className="space-y-4">
              <SectionHeader title="Sensor Status" icon={Activity} />
              <SensorStatus />
            </div>
          </div>
          <div className="space-y-4">
            <SectionHeader title="Recent Alerts" icon={AlertTriangle} />
            <AlertList />
          </div>
        </div>
      </div>
    </div>
  );
}
