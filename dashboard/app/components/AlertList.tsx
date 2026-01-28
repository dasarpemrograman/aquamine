"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { formatWIB } from "@/lib/dateUtils";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { StatusChip } from "@/app/components/ui/StatusChip";

interface Alert {
  id: number;
  sensor_id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  created_at: string;
  status?: string;
}

interface AlertListProps {
  severityFilter?: string;
  timeRange?: string;
}

export default function AlertList({ severityFilter = "all", timeRange = "24h" }: AlertListProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

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

  const getStatusVariant = (severity: string) => {
    switch (severity) {
      case "critical": return "critical";
      case "warning": return "warning";
      case "info": return "info";
      default: return "active";
    }
  };

  const getSeverityIcon = (severity: string) => {
    const baseClass = "flex items-center justify-center rounded-full shadow-sm border border-white/50 backdrop-blur-md w-10 h-10";
    
    switch (severity) {
      case "critical": 
        return (
          <div className={`${baseClass} bg-rose-100 text-rose-700`}>
            <AlertTriangle size={18} strokeWidth={2.5} />
          </div>
        );
      case "warning": 
        return (
          <div className={`${baseClass} bg-amber-100 text-amber-700`}>
            <AlertTriangle size={18} strokeWidth={2.5} />
          </div>
        );
      case "info": 
      default: 
        return (
          <div className={`${baseClass} bg-sky-100 text-sky-700`}>
            <Info size={18} strokeWidth={2.5} />
          </div>
        );
    }
  };

  // Filter Logic
  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;

    // Time Filter: Client-side filtering as per constraints to keep fetch logic unchanged
    if (timeRange !== "all") {
      const alertDate = new Date(alert.created_at).getTime();
      const now = new Date().getTime();
      const hoursDiff = (now - alertDate) / (1000 * 60 * 60);
      
      if (timeRange === "24h" && hoursDiff > 24) return false;
      if (timeRange === "7d" && hoursDiff > 24 * 7) return false;
      if (timeRange === "30d" && hoursDiff > 24 * 30) return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-4">
      {filteredAlerts.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-12 text-center" variant="flat">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
            <CheckCircle2 size={32} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No alerts found</h3>
          <p className="text-slate-400 mt-1 max-w-xs mx-auto">System is running normally. No issues detected matching your filters.</p>
        </GlassCard>
      ) : (
        filteredAlerts.map((alert) => (
          <GlassCard 
            key={alert.id} 
            className="group transition-all duration-300 hover:shadow-md hover:bg-white/60"
            variant="flat"
            padding="md"
          >
            
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                {getSeverityIcon(alert.severity)}
              </div>
              
              <div className="flex-grow min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
                      #{alert.id} • {alert.sensor_id}
                    </span>
                    <StatusChip 
                      status={getStatusVariant(alert.severity) as any} 
                      label={alert.severity.toUpperCase()} 
                      size="sm" 
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-400 whitespace-nowrap bg-slate-100/50 px-2 py-1 rounded-md">
                    {formatWIB(alert.created_at)}
                  </span>
                </div>
                
                <h4 className="text-base font-semibold text-slate-800 leading-snug mb-1">
                  {alert.message}
                </h4>
              </div>
            </div>
          </GlassCard>
        ))
      )}
    </div>
  );
}
