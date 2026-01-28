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

import SensorStatus from "./components/SensorStatus";
import AlertList from "./components/AlertList";
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
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title="System Overview"
          subtitle="Real-time AMD monitoring and environmental analysis"
          icon={LayoutDashboard}
          actions={<span className="text-xs text-slate-400 font-medium px-2">v2.4.0</span>}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <GlassCard variant="elevated" className="relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity size={48} />
              </div>
              <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-500">System Health</p>
                  <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                          {stats.healthScore}%
                      </span>
                      <span className={`text-sm font-medium mb-1 ${stats.healthScore > 90 ? 'text-teal-600' : 'text-amber-600'}`}>
                          {stats.healthScore > 90 ? 'Excellent' : stats.healthScore > 70 ? 'Good' : 'Attention'}
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
                  <p className="text-sm text-slate-500 mt-1">Active Sensors</p>
              </div>
          </GlassCard>

          <GlassCard variant="flat" className="relative group hover:bg-white/60 transition-colors">
              <div className="flex justify-between items-start mb-4">
                  <IconBadge icon={AlertTriangle} variant={stats.latestAnomaly === 'critical' ? 'coral' : 'default'} />
                  <span className="text-xs font-mono text-slate-400">LOG-01</span>
              </div>
              <div>
                  <span className={`text-2xl font-bold capitalize ${stats.latestAnomaly === 'critical' ? 'text-rose-600' : 'text-slate-800'}`}>
                      {stats.latestAnomaly}
                  </span>
                  <p className="text-sm text-slate-500 mt-1">Latest Status</p>
              </div>
          </GlassCard>

          <GlassCard variant="flat" className="relative group hover:bg-white/60 transition-colors">
              <div className="flex justify-between items-start mb-4">
                  <IconBadge icon={Clock} variant="teal" />
              </div>
              <div>
                  <span className="text-2xl font-bold text-slate-800">{stats.lastUpdate}</span>
                  <p className="text-sm text-slate-500 mt-1">Last Update</p>
              </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link href="/cv" className="block h-full">
                    <GlassCard className="h-full hover:border-cyan-300 transition-all duration-300 group cursor-pointer relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start">
                                <IconBadge icon={Camera} variant="aqua" size="lg" />
                                <ArrowRight className="text-slate-300 group-hover:text-cyan-500 transition-colors" />
                            </div>
                            <div className="mt-6">
                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-cyan-700 transition-colors">Visual Analysis</h3>
                                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                    Upload water source images to detect Yellow Boy precipitates using Computer Vision.
                                </p>
                            </div>
                        </div>
                    </GlassCard>
                </Link>

                <GlassCard className="h-full flex flex-col">
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <Zap className="text-amber-500" size={20} />
                            <h3 className="text-lg font-bold text-slate-800">Quick Actions</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3 flex-1">
                            <Link href="/forecast" className="block h-full">
                                <div className="p-3 rounded-lg bg-white/50 border border-white/60 hover:bg-white hover:border-cyan-200 transition-all text-sm font-medium text-slate-600 flex flex-col items-center justify-center gap-2 group cursor-pointer h-full min-h-[100px]">
                                    <Waves size={18} className="text-cyan-600 group-hover:scale-110 transition-transform" />
                                    <span>Forecast</span>
                                </div>
                            </Link>
                            <Link href="/alerts" className="block h-full">
                                <div className="p-3 rounded-lg bg-white/50 border border-white/60 hover:bg-white hover:border-rose-200 transition-all text-sm font-medium text-slate-600 flex flex-col items-center justify-center gap-2 group cursor-pointer h-full min-h-[100px]">
                                    <AlertTriangle size={18} className="text-rose-500 group-hover:scale-110 transition-transform" />
                                    <span>Alerts</span>
                                </div>
                            </Link>
                        </div>
                    </div>
                </GlassCard>
            </div>

            <div>
                <SectionHeader title="Sensor Status" icon={Activity} />
                <div className="relative">
                    <SensorStatus />
                </div>
            </div>
          </div>

          <div className="space-y-6">
              <SectionHeader title="Recent Alerts" icon={AlertTriangle} />
              <div className="relative">
                  <AlertList />
              </div>
          </div>
           <div className="absolute right-0 bottom-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-8 -mb-8" />
        </div>
      </div>
    </div>
  );
}
