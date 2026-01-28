"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, Bell, CheckCircle2 } from "lucide-react";
import { formatWIB } from "@/lib/dateUtils";

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
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const getIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="text-danger w-5 h-5 mt-0.5" />;
      case "warning": return <AlertTriangle className="text-warning w-5 h-5 mt-0.5" />;
      default: return <Info className="text-primary w-5 h-5 mt-0.5" />;
    }
  };

  const getStyle = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-danger/10 border-danger/20 hover:bg-danger/15";
      case "warning": return "bg-warning/10 border-warning/20 hover:bg-warning/15";
      default: return "bg-background/50 border-white/5 hover:bg-background/80";
    }
  };

  return (
    <div className="bg-surface border border-white/5 p-6 rounded-2xl shadow-lg h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bell className="text-primary" />
          Recent Alerts
        </h3>
        <button className="text-xs text-primary hover:text-primary-glow font-medium transition-colors">
          View All
        </button>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
            <CheckCircle2 className="w-12 h-12 mb-3 text-success opacity-50" />
            <p>All systems normal</p>
          </div>
        ) : (
          alerts.map((alert: any) => (
            <div 
              key={alert.id} 
              className={`p-4 border rounded-xl flex items-start gap-4 transition-all duration-200 ${getStyle(alert.severity)}`}
            >
              {getIcon(alert.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    alert.severity === 'critical' ? 'bg-danger/20 text-danger' : 
                    alert.severity === 'warning' ? 'bg-warning/20 text-warning' : 
                    'bg-primary/20 text-primary'
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-foreground-muted whitespace-nowrap ml-2">
                    {formatWIB(alert.created_at)}
                  </span>
                </div>
                <p className="font-semibold text-sm text-foreground mb-1">Sensor {alert.sensor_id}</p>
                <p className="text-sm text-foreground-muted leading-relaxed">{alert.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
