"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Map as MapIcon, Waves, AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
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

// Dynamic import for Leaflet components (SSR fix)
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
}

export default function BerkeleyPitMap({
  sensors,
  height = "400px",
  showPolygon = true,
  severityFilter,
  onMissingCoords,
}: BerkeleyPitMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (onMissingCoords) {
      onMissingCoords(countMissingCoords(sensors));
    }
  }, [sensors, onMissingCoords]);

  const filteredSensors = severityFilter
    ? sensors.filter((s) => severityFilter.includes(s.current_state as Severity))
    : sensors;

  // Don't render map on server
  if (!isMounted) {
    return (
      <div
        className="relative w-full rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center"
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
      className="relative w-full rounded-xl overflow-hidden"
      style={{ height }}
    >
      <MapContainer
        center={BERKELEY_PIT_CENTER}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full"
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

          return (
            <CircleMarker
              key={sensor.sensor_id}
              center={[sensor.latitude, sensor.longitude]}
              radius={10}
              pathOptions={{
                color: getMarkerColor(sensor.current_state),
                fillColor: getMarkerColor(sensor.current_state),
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
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
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
