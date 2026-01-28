"use client";

import { useState } from "react";
import AlertList from "@/app/components/AlertList";
import { Bell, Filter, Calendar } from "lucide-react";
import { SectionHeader } from "@/app/components/ui/SectionHeader";

export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("30d");

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title="Alert History"
          subtitle="Monitor and manage critical system events"
          icon={Bell}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Filter size={16} />
                </div>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-white/40 border border-white/60 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 hover:bg-white/80 hover:border-cyan-200 transition-all appearance-none cursor-pointer shadow-sm backdrop-blur-sm"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={16} />
                </div>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-white/40 border border-white/60 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 hover:bg-white/80 hover:border-cyan-200 transition-all appearance-none cursor-pointer shadow-sm backdrop-blur-sm"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
            </div>
          }
        />

        <AlertList severityFilter={severityFilter} timeRange={timeRange} />
      </div>
    </div>
  );
}
