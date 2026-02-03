"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup, Tooltip } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import Link from "next/link";
import { Map as MapIcon, Waves, AlertTriangle } from "lucide-react";
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

interface BerkeleyPitMapProps {
  sensors: SensorWithState[];
  height?: string;
  showPolygon?: boolean;
  severityFilter?: Severity[];
  onMissingCoords?: (count: number) => void;
}

export default function BerkeleyPitMap({
  sensors,
  height = "400px",
  showPolygon = true,
  severityFilter,
  onMissingCoords,
}: BerkeleyPitMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);

    setMounted(true);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (onMissingCoords) {
      onMissingCoords(countMissingCoords(sensors));
    }
  }, [sensors, onMissingCoords]);

  if (!mounted) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-100 rounded-xl"
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-slate-400">
          <MapIcon size={24} />
          <span>Loading map...</span>
        </div>
      </div>
    );
  }

  const polygonColor = getPolygonColor(sensors);
  const missingCount = countMissingCoords(sensors);

  const filteredSensors = severityFilter
    ? sensors.filter(s => {
        if (!s.is_active) return severityFilter.includes("offline");
        const state = (s.current_state?.toLowerCase() || "unknown") as Severity;
        return severityFilter.includes(state);
      })
    : sensors;

  const sensorsWithCoords = filteredSensors.filter(
    s => s.latitude && s.longitude
  );

  return (
    <div className="relative">
      <MapContainer
        center={BERKELEY_PIT_CENTER}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height, width: "100%" }}
        className="rounded-xl z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {showPolygon && (
          <Polygon
            positions={BERKELEY_PIT_POLYGON}
            pathOptions={{
              fillColor: polygonColor,
              fillOpacity: 0.3,
              color: polygonColor,
              weight: 2,
            }}
          />
        )}

        {sensorsWithCoords.map((sensor) => (
          <CircleMarker
            key={sensor.id}
            center={[sensor.latitude!, sensor.longitude!]}
            radius={8}
            pathOptions={{
              fillColor: getMarkerColor(sensor),
              color: "#fff",
              weight: 2,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip 
              permanent 
              direction="top" 
              offset={[0, -10]}
            >
              <div className="bg-white/90 border border-slate-200 px-2 py-0.5 rounded shadow-sm text-xs font-medium text-slate-700">
                {sensor.name}
              </div>
            </Tooltip>
            <Popup>
              <SensorPopup sensor={sensor} />
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {missingCount > 0 && (
        <div className="absolute bottom-2 left-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md shadow-sm">
          {missingCount} sensor{missingCount > 1 ? "s" : ""} without coordinates
        </div>
      )}
    </div>
  );
}

function SensorPopup({ sensor }: { sensor: SensorWithState }) {
  const [lastReading, setLastReading] = useState<{
    ph?: number;
    turbidity?: number;
    timestamp?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchLastReading() {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/sensors/${sensor.id}/readings?hours=24`
        );
        if (res.ok) {
          const readings = await res.json();
          if (readings.length > 0) {
            const latest = readings[0];
            setLastReading({
              ph: latest.ph,
              turbidity: latest.turbidity,
              timestamp: latest.timestamp,
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch reading:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchLastReading();
  }, [sensor.id]);

  const statusColor = getMarkerColor(sensor);
  const statusText = !sensor.is_active 
    ? "Offline" 
    : (sensor.current_state || "Unknown").charAt(0).toUpperCase() + (sensor.current_state || "Unknown").slice(1);

  return (
    <div className="p-1 min-w-[200px]">
      <h3 className="font-semibold text-slate-800 mb-1">{sensor.name}</h3>
      <p className="text-xs text-slate-500 mb-2">ID: {sensor.sensor_id}</p>
      
      <div className="flex items-center gap-2 mb-3">
        <span 
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        <span className="text-sm font-medium capitalize">{statusText}</span>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading reading...</p>
      ) : lastReading ? (
        <div className="space-y-1 text-sm">
          {lastReading.ph !== null && (
            <p className="flex items-center gap-1">
              <Waves size={14} className="text-cyan-500" />
              pH: {lastReading.ph}
            </p>
          )}
          {lastReading.turbidity !== null && (
            <p className="flex items-center gap-1">
              <AlertTriangle size={14} className="text-amber-500" />
              Turbidity: {lastReading.turbidity} NTU
            </p>
          )}
          <p className="text-xs text-slate-400 mt-2">
            {lastReading.timestamp 
              ? new Date(lastReading.timestamp).toLocaleString() 
              : "No timestamp"}
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">No recent readings</p>
      )}

      <div className="flex gap-2 mt-3 pt-2 border-t border-slate-200">
        <Link
          href={`/forecast?sensor=${sensor.id}`}
          className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
        >
          Forecast →
        </Link>
        <Link
          href={`/alerts?sensor=${sensor.id}`}
          className="text-xs text-rose-600 hover:text-rose-700 font-medium"
        >
          Alerts →
        </Link>
      </div>
    </div>
  );
}
