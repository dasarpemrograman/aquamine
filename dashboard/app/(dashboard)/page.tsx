"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { 
  LayoutDashboard, 
  Activity, 
  AlertTriangle, 
  Camera, 
  Clock, 
  Waves,
  ArrowRight,
  Map,
  Maximize2,
  Minimize2
} from "lucide-react";

import FieldSensorStatus from "@/app/components/FieldSensorStatus";
import FieldTaskActions from "@/app/components/FieldTaskActions";
import AlertList from "@/app/components/AlertList";
import AnalyticsWidget from "@/app/components/AnalyticsWidget";
import BerkeleyPitMap from "@/app/components/map/BerkeleyPitMap";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { IconBadge } from "@/app/components/ui/IconBadge";
import { fetchSensors, Sensor } from "@/lib/api";
import { UI_COPY, getSeverityLabel } from "@/lib/copy";

export default function Home() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState({
    healthScore: 100,
    activeSensors: 0,
    totalSensors: 0,
    currentStatus: "offline",
    statusSensorName: "",
    lastUpdate: "--:--:--"
  });
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const token = await getToken();
        const sensorsData = await fetchSensors(token);

        setSensors(Array.isArray(sensorsData) ? sensorsData : []);

        const activeSensors = Array.isArray(sensorsData) ? sensorsData.filter((s: Sensor) => s.is_active) : [];
        const active = activeSensors.length;
        const total = Array.isArray(sensorsData) ? sensorsData.length : 0;
        
        const sensorAvailability = total > 0 ? Math.round((active / total) * 100) : 0;

        const getMostCriticalSensor = (): { status: string; name: string } => {
          if (activeSensors.length === 0) return { status: "offline", name: "" };
          
          const critical = activeSensors.find((s: Sensor) => s.current_state?.toLowerCase() === "critical");
          if (critical) return { status: "critical", name: critical.name };
          
          const warning = activeSensors.find((s: Sensor) => s.current_state?.toLowerCase() === "warning");
          if (warning) return { status: "warning", name: warning.name };
          
          const normal = activeSensors.find((s: Sensor) => s.current_state?.toLowerCase() === "normal");
          if (normal) return { status: "normal", name: normal.name };
          
          return { status: "unknown", name: activeSensors[0]?.name || "" };
        };

        const { status, name } = getMostCriticalSensor();

        setStats({
            healthScore: sensorAvailability,
            activeSensors: active,
            totalSensors: total,
            currentStatus: status,
            statusSensorName: name,
            lastUpdate: new Date().toLocaleTimeString()
        });
      } catch (e) {
        console.error("Failed to fetch dashboard stats", e);
        setStats(prev => ({ ...prev, lastUpdate: new Date().toLocaleTimeString() }));
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [getToken]);

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title={UI_COPY.system_overview}
          subtitle={UI_COPY.system_subtitle}
          icon={LayoutDashboard}
          actions={<span className="text-xs text-slate-400 font-medium px-2">v2.4.0</span>}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <GlassCard variant="elevated" className="relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity size={48} />
              </div>
              <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-500">{UI_COPY.sensor_availability}</p>
                  <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                          {stats.healthScore}%
                      </span>
                      <span className={`text-sm font-medium mb-1 ${stats.healthScore > 90 ? 'text-teal-600' : 'text-amber-600'}`}>
                          {stats.healthScore > 90 ? UI_COPY.all_online : stats.healthScore > 0 ? UI_COPY.partial : UI_COPY.offline}
                      </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                      <div 
                          className="h-full bg-gradient-to-r from-cyan-400 to-teal-500 transition-all duration-1000" 
                          style={{ width: `${stats.healthScore}%` }} 
                      />
                  </div>
              </div>
          </GlassCard>

          <GlassCard variant="flat" className="relative group hover:bg-white/60 transition-colors">
              <div className="flex justify-between items-start mb-4">
                  <IconBadge icon={Waves} variant="aqua" />
                  <StatusChip status={stats.activeSensors > 0 ? 'active' : 'inactive'} label={stats.activeSensors > 0 ? 'Online' : 'Offline'} size="sm" />
              </div>
              <div>
                  <span className="text-3xl font-bold text-slate-800">{stats.activeSensors}</span>
                  <span className="text-slate-400 text-sm ml-1">/ {stats.totalSensors}</span>
                  <p className="text-sm text-slate-500 mt-1">{UI_COPY.active_sensors}</p>
              </div>
          </GlassCard>

          <GlassCard variant="flat" className="relative group hover:bg-white/60 transition-colors">
              <div className="flex justify-between items-start mb-4">
                  <IconBadge icon={AlertTriangle} variant={stats.currentStatus === 'critical' ? 'coral' : stats.currentStatus === 'warning' ? 'amber' : 'default'} />
                  {stats.statusSensorName && (
                    <span className="text-xs font-medium text-slate-400 truncate max-w-[100px]" title={stats.statusSensorName}>
                      {stats.statusSensorName}
                    </span>
                  )}
              </div>
              <div>
                  <span className={`text-2xl font-bold capitalize ${
                    stats.currentStatus === 'critical' ? 'text-rose-600' : 
                    stats.currentStatus === 'warning' ? 'text-amber-600' : 
                    stats.currentStatus === 'normal' ? 'text-emerald-600' : 'text-slate-800'
                  }`}>
                      {getSeverityLabel(stats.currentStatus)}
                  </span>
                  <p className="text-sm text-slate-500 mt-1">{UI_COPY.current_status}</p>
              </div>
          </GlassCard>

          <GlassCard variant="flat" className="relative group hover:bg-white/60 transition-colors">
              <div className="flex justify-between items-start mb-4">
                  <IconBadge icon={Clock} variant="teal" />
              </div>
              <div>
                  <span className="text-2xl font-bold text-slate-800">{stats.lastUpdate}</span>
                  <p className="text-sm text-slate-500 mt-1">{UI_COPY.last_update}</p>
              </div>
          </GlassCard>
        </div>

        {/* Field Actions - Prominent placement for Field View */}
        <FieldTaskActions />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Expandable Map Section */}
            <div className={`transition-all duration-300 ${isMapExpanded ? 'fixed inset-0 z-50 bg-slate-50 p-4 flex flex-col' : 'relative'}`}>
               <GlassCard className={`flex flex-col ${isMapExpanded ? 'h-full' : ''}`}>
                 <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                     <IconBadge icon={Map} variant="aqua" size="lg" />
                     <div>
                       <h3 className="text-lg font-bold text-slate-800">{UI_COPY.field_map}</h3>
                       {!isMapExpanded && <p className="text-xs text-slate-400">{UI_COPY.tap_expand}</p>}
                     </div>
                   </div>
                   <button 
                     onClick={() => setIsMapExpanded(!isMapExpanded)}
                     className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-cyan-600 transition-colors"
                   >
                     {isMapExpanded ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                   </button>
                 </div>
                 <div className={`rounded-lg overflow-hidden ${isMapExpanded ? 'flex-1' : 'h-[300px]'}`}>
                   <BerkeleyPitMap sensors={sensors} height="100%" showPolygon={true} />
                 </div>
               </GlassCard>
            </div>

            {/* Prominent Sensor Status */}
            <div>
                <SectionHeader title={UI_COPY.sensor_status} icon={Activity} />
                <div className="relative">
                    <FieldSensorStatus sensors={sensors} />
                </div>
            </div>
          </div>

          {/* Right Column / Triage */}
          <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <SectionHeader title={UI_COPY.priority_alerts} icon={AlertTriangle} />
                <Link href="/alerts" className="text-xs text-cyan-600 font-medium hover:underline">
                    {UI_COPY.view_all}
                </Link>
              </div>
              <div className="relative">
                  <AlertList limit={5} compact={true} />
              </div>

              {/* Visual Analysis Link - Compact */}
              <Link href="/cv" className="block">
                  <GlassCard className="hover:border-cyan-300 transition-all duration-300 group cursor-pointer relative overflow-hidden">
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <IconBadge icon={Camera} variant="aqua" />
                              <div>
                                  <h3 className="font-bold text-slate-800 group-hover:text-cyan-700">{UI_COPY.visual_analysis}</h3>
                                  <p className="text-xs text-slate-500">{UI_COPY.check_water_quality}</p>
                              </div>
                          </div>
                          <ArrowRight className="text-slate-300 group-hover:text-cyan-500 transition-colors" />
                      </div>
                  </GlassCard>
              </Link>
              
              <AnalyticsWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
