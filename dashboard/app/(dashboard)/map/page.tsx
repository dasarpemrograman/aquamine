"use client";

import { useEffect, useState, useMemo } from "react";
import { Map as MapIcon, Filter } from "lucide-react";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { GlassCard } from "@/app/components/ui/GlassCard";
import BerkeleyPitMap, { 
  SensorWithState, 
  Severity, 
  SEVERITY_COLORS 
} from "@/app/components/map/BerkeleyPitMap";

const SEVERITIES: { key: Severity; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "warning", label: "Warning" },
  { key: "critical", label: "Critical" },
  { key: "offline", label: "Offline" },
  { key: "unknown", label: "Unknown" },
];

export default function MapPage() {
  const [sensors, setSensors] = useState<SensorWithState[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>([]);
  const [missingCoordsCount, setMissingCoordsCount] = useState(0);

  useEffect(() => {
    async function fetchSensors() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/sensors`
        );
        if (res.ok) {
          const data = await res.json();
          setSensors(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to fetch sensors:", e);
      }
    }

    fetchSensors();
    const interval = setInterval(fetchSensors, 10000);
    return () => clearInterval(interval);
  }, []);

  const severityFilter = useMemo(() => {
    return selectedSeverities.length > 0 ? selectedSeverities : undefined;
  }, [selectedSeverities]);

  const toggleSeverity = (severity: Severity) => {
    setSelectedSeverities(prev => 
      prev.includes(severity)
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
  };

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <SectionHeader
          title="Site Map"
          subtitle="Berkeley Pit sensor locations and severity overview"
          icon={MapIcon}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <GlassCard className="overflow-hidden">
              <BerkeleyPitMap
                sensors={sensors}
                height="500px"
                showPolygon={true}
                severityFilter={severityFilter}
                onMissingCoords={setMissingCoordsCount}
              />
            </GlassCard>
          </div>

          <div className="space-y-4">
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Filter size={18} className="text-cyan-600" />
                <h3 className="font-semibold text-slate-800">Severity Filter</h3>
              </div>
              
              <div className="space-y-2">
                {SEVERITIES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleSeverity(key)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                      selectedSeverities.includes(key)
                        ? "bg-cyan-50 border border-cyan-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: SEVERITY_COLORS[key] }}
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                  </button>
                ))}
              </div>

              {selectedSeverities.length > 0 && (
                <button
                  onClick={() => setSelectedSeverities([])}
                  className="mt-3 text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  Clear filters
                </button>
              )}
            </GlassCard>

            <GlassCard>
              <h3 className="font-semibold text-slate-800 mb-3">Legend</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-600">Normal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-slate-600">Warning</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-slate-600">Critical</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-slate-600">Offline</span>
                </div>
                <div className="pt-2 border-t border-slate-200 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-3 rounded bg-green-500/30 border border-green-500" />
                    <span className="text-slate-600">Polygon Overlay</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Color = max severity inside polygon
                  </p>
                </div>
              </div>
            </GlassCard>

            {missingCoordsCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-sm text-amber-800">
                  {missingCoordsCount} sensor{missingCoordsCount > 1 ? "s" : ""} without coordinates
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
