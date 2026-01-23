"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

export default function AlertList() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/alerts`);
        const json = await res.json();
        setAlerts(json);
      } catch (e) {
        console.error("Failed to fetch alerts", e);
      }
    }
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const getIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="text-red-500" />;
      case "warning": return <AlertTriangle className="text-yellow-500" />;
      default: return <Info className="text-blue-500" />;
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4">Recent Alerts</h3>
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-gray-500">No active alerts</p>
        ) : (
          alerts.map((alert: any) => (
            <div key={alert.id} className={`p-3 border rounded flex items-start gap-3 ${alert.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
              {getIcon(alert.severity)}
              <div>
                <p className="font-semibold text-sm">Sensor {alert.sensor_id} - {alert.severity.toUpperCase()}</p>
                <p className="text-sm text-gray-700">{alert.message}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
