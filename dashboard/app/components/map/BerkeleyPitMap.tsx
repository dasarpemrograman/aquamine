"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Map as MapIcon, 
  Waves, 
  AlertTriangle, 
  Filter, 
  Layers, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Check,
  Maximize2,
  Minimize2
} from "lucide-react";
import dynamic from "next/dynamic";
import type { Map as LeafletMap } from "leaflet";
import {
  SEVERITY_COLORS,
  SensorWithState,
  Severity,
  BERKELEY_PIT_POLYGON,
  BERKELEY_PIT_CENTER,
  getMarkerColor,
  getPolygonColor,
  countMissingCoords,
} from "./mapUtils";

export { SEVERITY_COLORS, BERKELEY_PIT_POLYGON, BERKELEY_PIT_CENTER, getMarkerColor, getPolygonColor, countMissingCoords };
export type { SensorWithState, Severity };

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Polygon = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polygon),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("react-leaflet").then((mod) => mod.Tooltip),
  { ssr: false }
);

interface BerkeleyPitMapProps {
  sensors: SensorWithState[];
  height?: string;
  showPolygon?: boolean;
  severityFilter?: Severity[];
  onMissingCoords?: (count: number) => void;
  interactive?: boolean;
}

const SEVERITIES: { key: Severity; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "warning", label: "Warning" },
  { key: "critical", label: "Critical" },
  { key: "offline", label: "Offline" },
  { key: "unknown", label: "Unknown" },
];

export default function BerkeleyPitMap({
  sensors,
  height = "400px",
  showPolygon = true,
  severityFilter: externalFilter,
  onMissingCoords,
  interactive = false,
}: BerkeleyPitMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  
  const [internalFilter, setInternalFilter] = useState<Severity[]>([]);
  const [isControlsExpanded, setIsControlsExpanded] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<SensorWithState | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const raf = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });

    return () => cancelAnimationFrame(raf);
  }, [isMounted]);

  useEffect(() => {
    if (onMissingCoords) {
      onMissingCoords(countMissingCoords(sensors));
    }
  }, [sensors, onMissingCoords]);

  const activeFilter = interactive ? (internalFilter.length > 0 ? internalFilter : undefined) : externalFilter;

  const filteredSensors = useMemo(() => {
    return activeFilter
      ? sensors.filter((s) => activeFilter.includes(s.current_state as Severity))
      : sensors;
  }, [sensors, activeFilter]);

  const toggleSeverity = (severity: Severity) => {
    setInternalFilter(prev => 
      prev.includes(severity)
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
  };

  const clearFilter = () => setInternalFilter([]);

  if (!isMounted) {
    return (
      <div
        className="relative w-full h-full min-h-[500px] rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center text-slate-400">
          <MapIcon size={48} className="mx-auto mb-2 opacity-50" />
          <p>Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full min-h-[500px] rounded-xl overflow-hidden group"
      style={{ height }}
    >
      <MapContainer
        ref={mapRef}
        center={BERKELEY_PIT_CENTER}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        style={{ height: "100%", width: "100%" }}
        zoomControl={!interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showPolygon && (
          <Polygon
            positions={BERKELEY_PIT_POLYGON}
            pathOptions={{
              color: getPolygonColor(sensors),
              fillColor: getPolygonColor(sensors),
              fillOpacity: 0.3,
              weight: 2,
            }}
          />
        )}

        {filteredSensors.map((sensor) => {
          if (!sensor.latitude || !sensor.longitude) return null;

          const isSelected = selectedSensor?.sensor_id === sensor.sensor_id;

          return (
            <CircleMarker
              key={sensor.sensor_id}
              center={[sensor.latitude, sensor.longitude]}
              radius={isSelected ? 14 : 10}
              pathOptions={{
                color: isSelected ? "#fff" : getMarkerColor(sensor),
                fillColor: getMarkerColor(sensor),
                fillOpacity: 0.9,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => {
                   if (interactive) {
                     setSelectedSensor(sensor);
                   }
                }
              }}
            >
              {!interactive && (
                <>
                  <Tooltip>
                    <span className="font-medium">{sensor.name}</span>
                  </Tooltip>
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-bold text-lg mb-2">{sensor.name}</h3>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-slate-500">Status:</span>{" "}
                          <span
                            className={`font-medium capitalize ${
                              sensor.current_state === "critical"
                                ? "text-rose-600"
                                : sensor.current_state === "warning"
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {sensor.current_state}
                          </span>
                        </p>
                        <p>
                          <span className="text-slate-500">Location:</span>{" "}
                          {sensor.latitude.toFixed(5)},{" "}
                          {sensor.longitude.toFixed(5)}
                        </p>
                        {sensor.sensor_id && (
                          <Link
                            href={`/sensors/${sensor.sensor_id}`}
                            className="inline-flex items-center gap-1 text-cyan-600 hover:text-cyan-700 mt-2 text-sm font-medium"
                          >
                            <Waves size={14} />
                            View Details →
                          </Link>
                        )}
                      </div>
                    </div>
                  </Popup>
                </>
              )}
            </CircleMarker>
          );
        })}
      </MapContainer>

      {interactive && (
        <>
          <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2 max-w-[280px]">
            <button
              onClick={() => setIsControlsExpanded(!isControlsExpanded)}
              className="bg-white/90 backdrop-blur-md shadow-lg border border-slate-200 p-3 rounded-xl hover:bg-white transition-all active:scale-95"
              aria-label="Toggle map controls"
            >
              {isControlsExpanded ? <X size={24} className="text-slate-600" /> : <Layers size={24} className="text-slate-600" />}
            </button>

            {isControlsExpanded && (
              <div className="bg-white/90 backdrop-blur-md shadow-xl border border-slate-200 rounded-2xl p-4 w-full animate-in fade-in slide-in-from-top-4 duration-200">
                <div className="space-y-4">
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Filter size={16} /> Filter
                      </h3>
                      {internalFilter.length > 0 && (
                        <button onClick={clearFilter} className="text-xs text-cyan-600 font-medium px-2 py-1 hover:bg-cyan-50 rounded">
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SEVERITIES.map(({ key, label }) => {
                        const isActive = internalFilter.includes(key);
                        return (
                          <button
                            key={key}
                            onClick={() => toggleSeverity(key)}
                            className={`
                              flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border
                              ${isActive 
                                ? "bg-slate-800 text-white border-slate-800" 
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                              }
                            `}
                            style={{ minHeight: '44px' }}
                          >
                            <span 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: isActive ? '#fff' : SEVERITY_COLORS[key] }} 
                            />
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  <div>
                    <h3 className="font-bold text-slate-800 mb-2 text-sm">Legend</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {SEVERITIES.map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2 text-slate-600">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[key] }} />
                          {label}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 text-slate-600 col-span-2">
                        <span className="w-6 h-2 rounded bg-green-500/30 border border-green-500" />
                        Safe Zone
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedSensor && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] animate-in slide-in-from-bottom-10 duration-300">
              <div className="bg-white/95 backdrop-blur-xl shadow-2xl border border-slate-200 rounded-2xl p-5 md:p-6 max-w-2xl mx-auto relative">
                <button 
                  onClick={() => setSelectedSensor(null)}
                  className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-bold text-slate-900">{selectedSensor.name}</h2>
                      <span 
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                          selectedSensor.current_state === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          selectedSensor.current_state === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          selectedSensor.current_state === 'normal' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {selectedSensor.current_state || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm font-mono flex items-center gap-2">
                      <MapIcon size={14} /> 
                      {selectedSensor.latitude?.toFixed(5)}, {selectedSensor.longitude?.toFixed(5)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-4 md:pt-0 md:border-l border-slate-200 md:pl-6">
                     <Link
                        href={`/sensors/${selectedSensor.sensor_id}`}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-xl font-semibold transition-all active:scale-95 shadow-lg shadow-cyan-600/20"
                        style={{ minHeight: '48px' }}
                      >
                        <Waves size={18} />
                        View Telemetry
                      </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
