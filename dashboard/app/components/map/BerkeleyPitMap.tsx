"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Map as MapIcon, 
  Waves, 
  Filter, 
  Layers, 
  X, 
  Plus,
  Minus,
  Navigation
} from "lucide-react";
import dynamic from "next/dynamic";
import type { Map as LeafletMap } from "leaflet";
import { useMap } from "react-leaflet";
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

// Dynamic imports for Leaflet components
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

function CustomZoomControl() {
  const map = useMap();
  
  return (
    <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2">
      <button
        onClick={() => map.zoomIn()}
        className="w-12 h-12 bg-white/90 backdrop-blur-md shadow-lg border border-slate-200 rounded-xl flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all"
        aria-label="Zoom in"
      >
        <Plus size={24} />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-12 h-12 bg-white/90 backdrop-blur-md shadow-lg border border-slate-200 rounded-xl flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all"
        aria-label="Zoom out"
      >
        <Minus size={24} />
      </button>
    </div>
  );
}

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

  const statusCounts = useMemo(() => {
    const counts = {
      normal: 0,
      warning: 0,
      critical: 0
    };
    sensors.forEach(s => {
      if (s.current_state === 'normal') counts.normal++;
      else if (s.current_state === 'warning') counts.warning++;
      else if (s.current_state === 'critical') counts.critical++;
    });
    return counts;
  }, [sensors]);

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
      className="relative w-full h-full min-h-[500px] rounded-xl overflow-hidden group bg-slate-50"
      style={{ height }}
    >
      <MapContainer
        ref={mapRef}
        center={BERKELEY_PIT_CENTER}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {interactive && <CustomZoomControl />}

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
              radius={isSelected ? 16 : 12}
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
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white/90 backdrop-blur-md shadow-md border border-slate-200 rounded-full p-1.5 px-3 pointer-events-auto">
             <div className="flex items-center gap-1.5 px-2">
               <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-sm font-bold text-slate-700">{statusCounts.normal}</span>
             </div>
             <div className="w-px h-4 bg-slate-300" />
             <div className="flex items-center gap-1.5 px-2">
               <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
               <span className="text-sm font-bold text-slate-700">{statusCounts.warning}</span>
             </div>
             <div className="w-px h-4 bg-slate-300" />
             <div className="flex items-center gap-1.5 px-2">
               <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
               <span className="text-sm font-bold text-slate-700">{statusCounts.critical}</span>
             </div>
          </div>

          <div className="absolute top-6 right-6 z-[1000] flex flex-col items-end gap-2 max-w-[320px]">
            <button
              onClick={() => setIsControlsExpanded(!isControlsExpanded)}
              className={`
                bg-white/90 backdrop-blur-md shadow-lg border border-slate-200 p-3 rounded-xl 
                hover:bg-white transition-all active:scale-95 flex items-center gap-2
                ${isControlsExpanded ? 'ring-2 ring-cyan-500/20' : ''}
              `}
              aria-label="Toggle map controls"
            >
              <span className="font-semibold text-slate-700 text-sm hidden md:block">
                {isControlsExpanded ? 'Close Controls' : 'Map Controls'}
              </span>
              {isControlsExpanded ? <X size={20} className="text-slate-600" /> : <Layers size={20} className="text-slate-600" />}
            </button>

            {isControlsExpanded && (
              <div className="bg-white/95 backdrop-blur-xl shadow-xl border border-slate-200 rounded-2xl p-5 w-full animate-in fade-in slide-in-from-top-4 duration-200 origin-top-right">
                <div className="space-y-5">
                  
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <Filter size={14} /> Filter Status
                      </h3>
                      {internalFilter.length > 0 && (
                        <button onClick={clearFilter} className="text-xs text-cyan-600 font-bold hover:bg-cyan-50 px-2 py-1 rounded transition-colors">
                          RESET ALL
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {SEVERITIES.map(({ key, label }) => {
                        const isActive = internalFilter.includes(key);
                        return (
                          <button
                            key={key}
                            onClick={() => toggleSeverity(key)}
                            className={`
                              flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border
                              ${isActive 
                                ? "bg-slate-800 text-white border-slate-800 shadow-md transform scale-[1.02]" 
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                              }
                            `}
                          >
                            <span 
                              className={`w-2 h-2 rounded-full ${isActive ? 'ring-2 ring-white/30' : ''}`}
                              style={{ backgroundColor: isActive ? '#fff' : SEVERITY_COLORS[key] }} 
                            />
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  <div>
                    <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider">Map Legend</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                         <div className="w-8 h-8 rounded bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                           <span className="text-[10px] font-bold text-green-700">ZONE</span>
                         </div>
                         <div className="flex-1">
                           <span className="block text-xs font-bold text-slate-700">Pit Perimeter</span>
                           <span className="text-[10px] text-slate-500 leading-tight">Max severity determines color</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                         <div className="w-8 h-8 rounded-full border-2 border-cyan-600 bg-cyan-600/20 flex items-center justify-center">
                           <div className="w-3 h-3 bg-cyan-600 rounded-full"></div>
                         </div>
                         <div className="flex-1">
                           <span className="block text-xs font-bold text-slate-700">Active Sensor</span>
                           <span className="text-[10px] text-slate-500 leading-tight">Click for telemetry</span>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedSensor && (
            <div className="absolute bottom-6 left-6 z-[1000] w-[calc(100%-48px)] md:w-[400px] animate-in slide-in-from-bottom-10 duration-300">
              <div className="bg-white/95 backdrop-blur-xl shadow-2xl border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">{selectedSensor.name}</h2>
                    <p className="text-slate-500 text-xs font-mono mt-1 flex items-center gap-1">
                      <Navigation size={10} /> 
                      {selectedSensor.latitude?.toFixed(5)}, {selectedSensor.longitude?.toFixed(5)}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedSensor(null)}
                    className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Current Status</span>
                    <span 
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                        selectedSensor.current_state === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        selectedSensor.current_state === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        selectedSensor.current_state === 'normal' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {selectedSensor.current_state || 'Unknown'}
                    </span>
                  </div>

                  <Link
                    href={`/sensors/${selectedSensor.sensor_id}`}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-4 py-3.5 rounded-xl font-semibold transition-all active:scale-95 shadow-lg shadow-slate-900/10 w-full"
                  >
                    <Waves size={18} />
                    View Live Telemetry
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
