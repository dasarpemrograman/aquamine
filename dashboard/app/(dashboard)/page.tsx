"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Activity, 
  AlertTriangle, 
  Camera, 
  Zap, 
  Clock, 
  Waves,
  ArrowRight
} from "lucide-react";

import SensorStatus from "@/app/components/SensorStatus";
import AlertList from "@/app/components/AlertList";
import HeatmapVisualization from "@/app/components/HeatmapVisualization";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { IconBadge } from "@/app/components/ui/IconBadge";

export default function Home() {
  const [stats, setStats] = useState({
    healthScore: 100,
    activeSensors: 0,
    totalSensors: 0,
    latestAnomaly: "None",
    lastUpdate: "--:--:--"
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [sensorsRes, alertsRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/sensors`),
            fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/alerts`)
        ]);

        const sensors = await sensorsRes.json();
        const alerts = await alertsRes.json();

        const active = Array.isArray(sensors) ? sensors.filter((s: any) => s.is_active).length : 0;
        const total = Array.isArray(sensors) ? sensors.length : 0;
        
        const criticalAlerts = Array.isArray(alerts) ? alerts.filter((a: any) => a.severity === 'critical').length : 0;
        const warningAlerts = Array.isArray(alerts) ? alerts.filter((a: any) => a.severity === 'warning').length : 0;
        const inactiveSensors = total - active;
        
        let calculatedHealth = 100 - (criticalAlerts * 20) - (warningAlerts * 5) - (inactiveSensors * 10);
        if (calculatedHealth < 0) calculatedHealth = 0;

        const latest = Array.isArray(alerts) && alerts.length > 0 ? alerts[0].severity : "None";

        setStats({
            healthScore: calculatedHealth,
            activeSensors: active,
            totalSensors: total,
            latestAnomaly: latest,
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
  }, []);

  return (
    <div className="h-full w-full bg-transparent overflow-y-auto lg:overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col w-full mx-auto p-4 gap-4 lg:p-5 lg:gap-5 min-h-0">
        {/* Row 1: System Overview + Last Update (Horizontal) */}
        <div className="flex-none flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-5 lg:justify-between">
          {/* System Overview */}
          <div className="flex-1">
             <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight">System Overview</h1>
                  <span className="text-xs text-slate-500 font-medium px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">v2.4.0</span>
                </div>
                <p className="text-sm text-slate-500 font-medium mt-1">Real-time AMD monitoring and environmental analysis</p>
             </div>
          </div>
          
          {/* Last Update - No Container */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
              <div className="flex items-end gap-3">
                  <p className="text-sm text-slate-500 mb-1">Last Update</p>
                  <span className="text-2xl font-bold text-slate-800 leading-none">{stats.lastUpdate}</span>
              </div>
          </div>
        </div>

        {/* Row 2: Analysis (Heatmap + Sensor Status) - High Priority Content (lg:flex-[2]) */}
        <div className="flex-none lg:flex-[2] grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 min-h-0">
          {/* Heatmap Visualization */}
          <div className="h-[400px] lg:h-full min-h-0">
             <HeatmapVisualization />
          </div>

          {/* Sensor Status Container */}
          <GlassCard className="h-[400px] lg:h-full flex flex-col min-h-0" padding="sm">
            <div className="flex-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Sensor Status</h2>
                
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500">Active Sensors</span>
                    <span className="text-base font-bold text-slate-800">
                        {stats.activeSensors}<span className="text-slate-400 text-xs font-normal">/{stats.totalSensors}</span>
                    </span>
                    <StatusChip 
                        status={
                            stats.activeSensors === stats.totalSensors ? 'active' : 
                            stats.activeSensors === 0 ? 'inactive' : 'partial'
                        } 
                        label={
                            stats.activeSensors === stats.totalSensors ? 'Online' : 
                            stats.activeSensors === 0 ? 'Offline' : 'Partial'
                        } 
                        size="sm" 
                    />
                </div>
            </div>
            
            <div className="relative flex-1 min-h-0 overflow-y-auto">
                <SensorStatus />
            </div>
          </GlassCard>
        </div>

        {/* Row 3: Stats (System Health + Status History + Quick Actions) - Secondary Info (lg:flex-1) */}
        <div className="flex-none lg:flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 min-h-0">
          {/* Status History (9/12) */}
          <GlassCard className="lg:col-span-9 h-[300px] lg:h-full flex flex-col gap-4" padding="sm">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Status History</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
              {/* Latest Status */}
              <div className="relative group bg-white/40 border border-white/50 shadow-sm rounded-xl hover:bg-white/60 transition-colors h-full flex flex-col justify-center p-3">
                  <div className="flex justify-between items-start mb-2">
                      <IconBadge icon={AlertTriangle} variant={stats.latestAnomaly === 'critical' ? 'coral' : 'default'} />
                      <span className="text-[10px] font-mono text-slate-400">LOG-01</span>
                  </div>
                  <div>
                      <span className={`text-xl font-bold capitalize ${stats.latestAnomaly === 'critical' ? 'text-rose-600' : 'text-slate-800'}`}>
                          {stats.latestAnomaly}
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">Latest Status</p>
                  </div>
              </div>
              
              {/* Recent Alerts */}
              <div className="relative h-full overflow-y-auto pr-1">
                  <AlertList />
              </div>
            </div>
          </GlassCard>

          {/* System Health (2/12) */}
          <GlassCard variant="elevated" className="lg:col-span-2 h-[160px] lg:h-full relative overflow-hidden group flex flex-col justify-between gap-4 " padding="sm">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity size={40} />
              </div>
              <div className="space-y-2">
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">System Health</h2>
                  <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold bg-gradient-to-r from-aqua to-teal bg-clip-text text-transparent">
                            {stats.healthScore}%
                        </span>
                        <span className={`text-xs font-medium ${stats.healthScore > 90 ? 'text-teal' : 'text-amber-600'}`}>
                            {stats.healthScore > 90 ? 'Good' : 'Attention'}
                        </span>
                      </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                          className="h-full bg-gradient-to-r from-aqua to-teal transition-all duration-1000" 
                          style={{ width: `${stats.healthScore}%` }} 
                      />
                  </div>
              </div>
          </GlassCard>

          {/* Action Buttons (1/12) */}
          <div className="lg:col-span-1 grid grid-cols-3 lg:flex lg:flex-col gap-3 h-auto lg:h-full">
              {/* Forecast Button */}
              <Link href="/forecast" className="flex-1 min-h-0">
                  <GlassCard className="h-full flex flex-col items-center justify-center hover:border-cyan-200 transition-all group cursor-pointer p-2 lg:p-1">
                       <Waves size={24} className="text-cyan-600 group-hover:scale-110 transition-transform mb-1" />
                       <span className="text-[16px] font-bold text-slate-600">Forecast</span>
                  </GlassCard>
              </Link>
              
              {/* Alerts Button */}
              <Link href="/alerts" className="flex-1 min-h-0">
                  <GlassCard className="h-full flex flex-col items-center justify-center hover:border-rose-200 transition-all group cursor-pointer p-2 lg:p-1">
                       <AlertTriangle size={24} className="text-rose-500 group-hover:scale-110 transition-transform mb-1" />
                       <span className="text-[16px] font-bold text-slate-600">Alerts</span>
                  </GlassCard>
              </Link>

              {/* Visual Analysis Button */}
              <Link href="/cv" className="flex-1 min-h-0">
                  <GlassCard className="h-full flex flex-col items-center justify-center hover:border-emerald-200 transition-all group cursor-pointer p-2 lg:p-1">
                       <Camera size={24} className="text-emerald-600 group-hover:scale-110 transition-transform mb-1" />
                       <span className="text-[16px] font-bold text-slate-600">Visual</span>
                  </GlassCard>
              </Link>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 w-32 h-32 rounded-full -mr-8 -mb-8 pointer-events-none" />
      </div>
    </div>
  );
}
