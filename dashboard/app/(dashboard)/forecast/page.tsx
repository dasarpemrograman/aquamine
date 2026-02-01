"use client";

import { useState } from "react";
import { useWebSocket } from "@/lib/websocket";
import ForecastChart from "@/app/components/ForecastChart";
import AlertList from "@/app/components/AlertList";
import SensorStatus from "@/app/components/SensorStatus";

import { StatusChip } from "@/app/components/ui/StatusChip";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { Activity, AlertTriangle, LineChart, Calendar } from "lucide-react";

export default function ForecastPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL ? `${process.env.NEXT_PUBLIC_WS_BASE_URL}/ws/realtime` : "ws://localhost:8181/ws/realtime";
  const { lastMessage, isConnected } = useWebSocket(wsUrl);
  
  const [forecastType, setForecastType] = useState<'7day' | '14day' | 'daily'>('7day');
  const [selectedDate, setSelectedDate] = useState(new Date());

    const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    };

    const getForecastTitle = () => {
    if (forecastType === '7day') {
      return '7-day predictions and anomaly context';
    } else if (forecastType === '14day') {
      return '14-day extended predictions and trend analysis';
    } else {
      return `Daily forecast for ${formatDate(selectedDate)}`;
    }
    };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 md:px-8 md:py-12">
        <div className="space-y-10">
          {/* Enhanced Header Card */}
          <div className="glass-panel rounded-2xl p-8 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-aqua/20 to-teal/20 shadow-sm ring-1 ring-white/30">
                  <LineChart size={28} strokeWidth={2} className="text-aqua" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gradient mb-2">Forecast & Analysis</h1>
                  <p className="text-lg text-secondary font-medium">{getForecastTitle()}</p>
                </div>
              </div>
              
              {/* Enhanced Controls */}
              <div className="flex items-center gap-6">
                {/* Forecast Type Dropdown */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-secondary">Forecast Period:</label>
                  <select
                    value={forecastType}
                    onChange={(e) => setForecastType(e.target.value as '7day' | '14day' | 'daily')}
                    className="glass-border rounded-xl px-4 py-2 text-sm font-semibold bg-white/50 hover:bg-white/70 focus:bg-white/80 focus:ring-2 focus:ring-aqua/30 focus:border-aqua/50 transition-all duration-300 text-secondary min-w-[140px]"
                  >
                    <option value="7day">7-Day Forecast</option>
                    <option value="14day">14-Day Extended</option>
                    <option value="daily">Daily View</option>
                  </select>
                </div>
                
                {/* Date Picker */}
                {forecastType === 'daily' && (
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-teal" />
                    <input
                      type="date"
                      value={selectedDate.toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(new Date(e.target.value))}
                      className="glass-border rounded-xl px-4 py-2 text-sm font-medium bg-white/50 focus:bg-white/70 focus:ring-2 focus:ring-aqua/30 focus:border-aqua/50 transition-all duration-300"
                    />
                  </div>
                )}
                
                {/* Connection Status */}
                <StatusChip
                  status={isConnected ? "info" : "warning"}
                  label={isConnected ? "Live Feed Active" : "Connecting..."}
                />
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Primary Content */}
            <div className="xl:col-span-3 space-y-8">
              {/* Forecast Chart Card */}
              <div className="glass-panel rounded-2xl p-8 shadow-xl">
                <ForecastChart 
                  sensorId="1" 
                  forecastType={forecastType}
                  selectedDate={forecastType === 'daily' ? selectedDate : undefined}
                />
              </div>
              
              {/* Sensor Status Card */}
              <div className="glass-panel rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-teal/20 to-aqua/20 shadow-sm ring-1 ring-white/30">
                    <Activity size={24} strokeWidth={2} className="text-teal" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Sensor Network Status</h2>
                    <p className="text-sm text-muted font-medium">Real-time monitoring across all sensors</p>
                  </div>
                </div>
                <SensorStatus />
              </div>
            </div>
            
            {/* Sidebar */}
            <div className="xl:col-span-1">
              <div className="glass-panel rounded-2xl p-6 sticky top-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-coral/20 to-aqua/20 shadow-sm ring-1 ring-white/30">
                    <AlertTriangle size={20} strokeWidth={2} className="text-coral" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">System Alerts</h2>
                    <p className="text-xs text-muted font-medium">Recent notifications</p>
                  </div>
                </div>
                <AlertList />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
