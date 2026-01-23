"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Bell } from "lucide-react";
import { wsClient } from "@/lib/websocket";

interface Alert {
  id: number;
  sensor_id: number;
  severity: "warning" | "critical";
  message: string;
  created_at: string;
  acknowledged_at?: string;
}

export default function AlertList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const fetchAlerts = () => {
    fetch("/api/v1/alerts?limit=10")
      .then((res) => res.json())
      .then(setAlerts)
      .catch(console.error);
  };

  useEffect(() => {
    fetchAlerts();

    const unsubscribe = wsClient.subscribe((msg) => {
      if (msg.type === "alert") {
        setAlerts((prev) => [msg.data, ...prev]);
      }
    });

    return unsubscribe;
  }, []);

  const acknowledgeAlert = (id: number) => {
    fetch(`/api/v1/alerts/${id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledged_by: "User" }),
    }).then(fetchAlerts);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Recent Alerts
        </h3>
      </div>
      <div className="divide-y max-h-[400px] overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No alerts</div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 flex justify-between items-start ${
                alert.severity === "critical" ? "bg-red-50" : "bg-yellow-50"
              }`}
            >
              <div className="flex gap-3">
                <AlertTriangle
                  className={`w-5 h-5 mt-1 ${
                    alert.severity === "critical" ? "text-red-600" : "text-yellow-600"
                  }`}
                />
                <div>
                  <p className="font-medium text-gray-900">{alert.message}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(alert.created_at).toLocaleString()} • Sensor #{alert.sensor_id}
                  </p>
                </div>
              </div>
              {!alert.acknowledged_at && (
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50 flex items-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Ack
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
