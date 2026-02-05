"use client";

import { ClipboardCheck, AlertTriangle, MapPin } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/app/components/ui/GlassCard";

export default function FieldTaskActions() {
  return (
    <GlassCard className="w-full">
      <h3 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">Field Tasks</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/cv" className="block">
          <div className="flex items-center justify-center gap-2 p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium shadow-sm active:scale-[0.98] h-full w-full">
            <ClipboardCheck size={20} />
            <span>Mulai Inspeksi</span>
          </div>
        </Link>
        
        <Link href="/alerts" className="block">
          <div className="flex items-center justify-center gap-2 p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-medium shadow-sm active:scale-[0.98] h-full w-full">
            <AlertTriangle size={20} />
            <span>Laporkan Kejadian</span>
          </div>
        </Link>
        
        <Link href="/map" className="block">
          <div className="flex items-center justify-center gap-2 p-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium shadow-sm active:scale-[0.98] h-full w-full">
            <MapPin size={20} />
            <span>Cek Sensor Terdekat</span>
          </div>
        </Link>
      </div>
    </GlassCard>
  );
}
