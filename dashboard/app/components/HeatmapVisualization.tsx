"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./ui/GlassCard";
import { Map } from "lucide-react";

interface MiningPit {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  temperature: number;
  ph_level: number;
  risk_level: 'low' | 'medium' | 'high';
}

export default function HeatmapVisualization() {
  const [pits, setPits] = useState<MiningPit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now - replace with actual API call
    const mockPits: MiningPit[] = [
      { id: '1', name: 'Pit Alpha', latitude: -6.2088, longitude: 106.8456, temperature: 25.5, ph_level: 6.8, risk_level: 'low' },
      { id: '2', name: 'Pit Beta', latitude: -6.2188, longitude: 106.8556, temperature: 28.2, ph_level: 5.2, risk_level: 'high' },
      { id: '3', name: 'Pit Gamma', latitude: -6.1988, longitude: 106.8356, temperature: 26.1, ph_level: 6.2, risk_level: 'medium' },
      { id: '4', name: 'Pit Delta', latitude: -6.2288, longitude: 106.8656, temperature: 24.8, ph_level: 7.1, risk_level: 'low' },
    ];
    
    setTimeout(() => {
      setPits(mockPits);
      setLoading(false);
    }, 1000);
  }, []);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getRiskTextColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <GlassCard className="h-full">
        <div className="flex items-center gap-3 mb-6">
          <Map className="text-purple-600" size={20} />
          <h3 className="text-lg font-bold text-slate-800">Mining Pits Heatmap</h3>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full">
      <div className="flex items-center gap-3 mb-6">
        <Map className="text-purple-600" size={20} />
        <h3 className="text-lg font-bold text-slate-800">Mining Pits Heatmap</h3>
      </div>
      
      {/* Mock visualization - replace with actual map/heatmap */}
      <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 h-64 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="grid grid-cols-4 h-full gap-2">
            {pits.map((pit, index) => (
              <div
                key={pit.id}
                className={`relative rounded-lg ${getRiskColor(pit.risk_level)} opacity-70 hover:opacity-100 transition-opacity cursor-pointer group`}
                style={{
                  transform: `translate(${index * 20}px, ${index * 15}px)`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white text-xs font-bold">{pit.name}</div>
                </div>
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white rounded px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity text-xs whitespace-nowrap">
                  <div className="font-semibold">{pit.name}</div>
                  <div>Temp: {pit.temperature}°C</div>
                  <div>pH: {pit.ph_level}</div>
                  <div className={`font-medium ${getRiskTextColor(pit.risk_level)}`}>
                    Risk: {pit.risk_level}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-sm text-slate-600 mb-3">Risk Levels:</div>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-slate-600">Low Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span className="text-slate-600">Medium Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-slate-600">High Risk</span>
          </div>
        </div>
        <div className="text-xs text-slate-400 mt-3">
          Total Pits: {pits.length} | Active Monitoring
        </div>
      </div>
    </GlassCard>
  );
}