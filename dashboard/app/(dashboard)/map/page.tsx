"use client";

import { useEffect, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import BerkeleyPitMap, { 
  SensorWithState, 
} from "@/app/components/map/BerkeleyPitMap";
import { fetchSensors } from "@/lib/api";

export default function MapPage() {
  const { getToken } = useAuth();
  const [sensors, setSensors] = useState<SensorWithState[]>([]);
  const [missingCoordsCount, setMissingCoordsCount] = useState(0);

  useEffect(() => {
    async function loadSensors() {
      try {
        const token = await getToken();
        const data = await fetchSensors(token);
        setSensors(Array.isArray(data) ? (data as SensorWithState[]) : []);
      } catch (e) {
        console.error("Failed to fetch sensors:", e);
        setSensors([]);
      }
    }

    loadSensors();
    const interval = setInterval(loadSensors, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col px-6 py-6 md:px-8">
      <div className="flex flex-col h-full">
        <SectionHeader
          title="Site Map"
          subtitle="Berkeley Pit sensor locations and severity overview"
          icon={MapIcon}
        />

        <div className="flex-1 w-full min-h-0 mt-6 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
          <BerkeleyPitMap
            sensors={sensors}
            height="100%"
            showPolygon={true}
            interactive={true}
            onMissingCoords={setMissingCoordsCount}
          />
        </div>
        
        {missingCoordsCount > 0 && (
          <div className="text-center text-amber-600 text-sm mt-4">
            {missingCoordsCount} sensor{missingCoordsCount > 1 ? "s" : ""} missing coordinates
          </div>
        )}
      </div>
    </div>
  );
}
