"use client";

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { GlassCard } from "@/app/components/ui/GlassCard";
import { FinancialImpact } from "@/lib/api";

interface FinancialProjectionCardProps {
  data: FinancialImpact;
}

export function FinancialProjectionCard({ data }: FinancialProjectionCardProps) {
  const [showCalculation, setShowCalculation] = useState(false);

  const chartData = [
    { name: 'Biaya Treatment', value: data.treatment_cost_hourly, color: '#3b82f6' },
    { name: 'Risiko Finansial', value: data.risk_exposure, color: '#ef4444' },
  ];

  const formatIDR = (value: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

  // Configurable rates
  const riskRatePerMinute = 1_000_000;
  const handlingCostPerHour = data.treatment_cost_hourly;
  const violationMinutes = data.risk_exposure > 0 ? Math.round(data.risk_exposure / riskRatePerMinute) : 0;

  return (
    <GlassCard className="p-6 relative overflow-hidden">
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Proyeksi Finansial Evaluasi (Per Jam/Kejadian)</h3>
        
        <div className="flex-grow w-full h-[200px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number | undefined) => [formatIDR(value ?? 0), '']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col items-center">
            <span className="text-sm text-slate-500 font-medium uppercase tracking-wider">Potensi Penghematan</span>
            <span className="text-3xl font-bold text-emerald-500 mt-1">
              {formatIDR(data.potential_savings)}
            </span>
        </div>

        {/* Accordion: Rincian Perhitungan & Asumsi */}
        <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowCalculation(!showCalculation)}
            className="w-full flex flex-col items-start gap-1 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="w-full flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Rincian Perhitungan & Asumsi</span>
              {showCalculation ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </div>
            <p className="text-[10px] text-slate-400 italic">Nilai ditampilkan berdasarkan window waktu yang dipilih dan parameter yang dapat dikonfigurasi.</p>
          </button>

          {showCalculation && (
            <div className="p-4 bg-white space-y-5">
              {/* 1. Nilai pada Window Saat Ini */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                  Nilai pada Window Saat Ini
                </h4>
                <p className="text-[10px] text-slate-500 italic mb-2">Data observasi aktual dari sistem monitoring</p>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between items-center px-3 py-2 bg-cyan-50/50 rounded border border-cyan-100 text-xs">
                    <span className="text-slate-600">Durasi Pelanggaran</span>
                    <span className="font-semibold text-slate-800">{violationMinutes} menit</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-cyan-50/50 rounded border border-cyan-100 text-xs">
                    <span className="text-slate-600">Biaya Penanganan Aktual</span>
                    <span className="font-semibold text-slate-800">{formatIDR(handlingCostPerHour)} / jam</span>
                  </div>
                </div>
              </div>

              {/* 2. Parameter & Asumsi (Dapat Dikustomisasi) */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Parameter & Asumsi (Dapat Dikustomisasi)
                </h4>
                <p className="text-[10px] text-slate-500 italic mb-2">Parameter dapat disesuaikan sesuai kebijakan perusahaan atau regulasi yang berlaku</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-3 py-2 bg-amber-50/50 rounded border border-amber-100 text-xs">
                    <span className="text-slate-600">Tarif Risiko per Menit</span>
                    <span className="font-semibold text-slate-800">{formatIDR(riskRatePerMinute)}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-amber-50/50 rounded border border-amber-100 text-xs">
                    <span className="text-slate-600">Standar pH yang Berlaku</span>
                    <span className="font-semibold text-slate-800">6.0 – 9.0 (KepMen LH 113/2003)</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-amber-50/50 rounded border border-amber-100 text-xs">
                    <span className="text-slate-600">Status Baseline Pembanding</span>
                    <span className="font-semibold text-slate-800">{data.potential_savings > 0 ? 'Tersedia' : 'Belum Tersedia'}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 px-2 py-1.5 bg-slate-50 rounded border border-slate-100">
                  <span className="font-medium">Catatan:</span> Tarif risiko merepresentasikan estimasi denda regulasi dan biaya pemulihan lingkungan berdasarkan kebijakan internal.
                </p>
              </div>

              {/* 3. Metode Perhitungan */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                  Metode Perhitungan
                </h4>
                <p className="text-[10px] text-slate-500 italic mb-2">Penjelasan logika perhitungan finansial</p>
                <div className="space-y-2.5 text-xs text-slate-700">
                  <div className="px-3 py-2.5 bg-slate-50 rounded border border-slate-100 leading-relaxed">
                    <p className="font-medium text-slate-800 mb-1">Risiko Finansial (Rp/jam)</p>
                    <p className="text-slate-600">Dihitung dari <span className="font-semibold text-slate-800">Durasi Pelanggaran (menit)</span> dikalikan <span className="font-semibold text-slate-800">Tarif Risiko per Menit</span>.</p>
                  </div>
                  <div className="px-3 py-2.5 bg-slate-50 rounded border border-slate-100 leading-relaxed">
                    <p className="font-medium text-slate-800 mb-1">Biaya Penanganan (Rp/jam)</p>
                    <p className="text-slate-600">Dihitung dari <span className="font-semibold text-slate-800">Total Dosis Aktual</span> dikalikan <span className="font-semibold text-slate-800">Harga per Unit</span> bahan kimia yang digunakan.</p>
                  </div>
                  <div className="px-3 py-2.5 bg-slate-50 rounded border border-slate-100 leading-relaxed">
                    <p className="font-medium text-slate-800 mb-1">Potensi Penghematan (Rp/jam)</p>
                    <p className="text-slate-600">Merupakan selisih antara <span className="font-semibold text-slate-800">Baseline Tanpa Tindakan</span> dan <span className="font-semibold text-slate-800">Biaya Aktual</span> yang terjadi.</p>
                    {data.potential_savings === 0 && (
                      <p className="text-amber-600 font-medium mt-1.5">⚠️ Baseline pembanding belum tersedia untuk periode ini.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
