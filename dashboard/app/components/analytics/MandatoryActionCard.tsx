"use client";

import { AlertTriangle, CheckCircle2, Clock, Activity, Gavel } from 'lucide-react';
import { GlassCard } from "@/app/components/ui/GlassCard";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { StrategicImpact } from "@/lib/api";

interface MandatoryActionCardProps {
  data: StrategicImpact;
}

export function MandatoryActionCard({ data }: MandatoryActionCardProps) {
  const { compliance, financial } = data;
  const isCompliant = compliance.is_compliant;
  
  return (
    <GlassCard className={`p-6 border-l-4 ${isCompliant ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
        <div className="flex items-start justify-between mb-4">
            <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {isCompliant ? <CheckCircle2 className="text-emerald-500" /> : <AlertTriangle className="text-rose-500" />}
                    Mandatory Action
                </h3>
                <p className="text-sm text-slate-500 mt-1">Prescriptive analytics based on regulation</p>
            </div>
            <StatusChip status={isCompliant ? 'normal' : 'critical'}>
                {compliance.status_label}
            </StatusChip>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 font-medium bg-white w-fit px-2 py-0.5 rounded border border-slate-200">
                   <Activity size={12} /> REKOMENDASI DOSIS
                </div>
                <div className="text-xl font-bold text-slate-800">
                    {financial.recommended_lime_dosage_kg_h > 0 
                        ? `${financial.recommended_lime_dosage_kg_h.toFixed(1)} kg/jam` 
                        : "Tidak perlu dosing"}
                </div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 font-medium bg-white w-fit px-2 py-0.5 rounded border border-slate-200">
                   <Clock size={12} /> ESTIMASI PEMULIHAN
                </div>
                <div className="text-xl font-bold text-slate-800">
                    {financial.estimated_recovery_time_minutes > 0
                        ? `${Math.round(financial.estimated_recovery_time_minutes)} Menit`
                        : "Normal"}
                </div>
            </div>
        </div>

        {!isCompliant && (
           <div className="mt-4 bg-rose-50 rounded-lg p-3 border border-rose-100">
              <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm mb-2">
                  <Gavel size={14} /> STATUS LEGAL
              </div>
              <ul className="list-disc list-inside text-xs text-rose-600 space-y-1">
                  {compliance.violated_regulations.map((reg, idx) => (
                      <li key={idx}>{reg}</li>
                  ))}
              </ul>
           </div>
        )}
    </GlassCard>
  );
}
