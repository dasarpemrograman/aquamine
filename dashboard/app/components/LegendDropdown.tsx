"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle, X, Activity, Signal, RefreshCw, Clock } from "lucide-react";

export default function LegendDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setIsOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1.5 px-2 py-1 text-slate-500 hover:bg-white/60 hover:text-cyan-600 rounded-lg transition-all text-sm font-medium shrink-0"
        aria-label="Legenda"
        aria-expanded={isOpen}
      >
        <HelpCircle size={16} />
        <span className="hidden lg:inline">Legenda</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 md:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden text-left">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-semibold text-slate-900">Legenda Status Sistem</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-500"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Signal size={16} className="text-sky-600" />
                <h4>Konektivitas</h4>
              </div>
              <p className="text-xs text-slate-600 mb-2">
                Menunjukkan apakah dashboard bisa terhubung ke API/server.
              </p>
              <div className="grid gap-2 text-xs">
                <div className="flex gap-2 items-start">
                  <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium whitespace-nowrap">Connection: Online</span>
                  <span className="text-slate-600">Sistem terhubung.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium whitespace-nowrap">Connection: Offline</span>
                  <span className="text-slate-600">Tidak ada internet atau API bermasalah.</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Clock size={16} className="text-amber-600" />
                <h4>Kebaruan Data</h4>
              </div>
              <p className="text-xs text-slate-600 mb-2">
                Waktu sejak paket data sensor terakhir diterima.
              </p>
              <div className="grid gap-2 text-xs">
                <div className="flex gap-2 items-start">
                  <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium whitespace-nowrap">Fresh: &lt;15m</span>
                  <span className="text-slate-600">Data masih baru.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium whitespace-nowrap">Fresh: 15-60m</span>
                  <span className="text-slate-600">Data mulai basi. Cek koneksi internet di lokasi.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium whitespace-nowrap">Fresh: &gt;60m</span>
                  <span className="text-slate-600">Tidak ada data terbaru. Kemungkinan perangkat offline.</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Activity size={16} className="text-rose-600" />
                <h4>Status Keamanan</h4>
              </div>
              <p className="text-xs text-slate-600 mb-2">
                Status terburuk dari semua sensor yang aktif.
              </p>
              <div className="grid gap-2 text-xs">
                <div className="flex gap-2 items-start">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium whitespace-nowrap">Safety: Safe</span>
                  <span className="text-slate-600">Semua sensor masih dalam batas aman.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium whitespace-nowrap">Safety: Warn</span>
                  <span className="text-slate-600">Ada sensor yang mendekati ambang bahaya.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-medium whitespace-nowrap">Safety: Crit</span>
                  <span className="text-slate-600">Bahaya! Ambang batas terlampaui.</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <RefreshCw size={16} className="text-slate-600" />
                <h4>Queue Sinkronisasi</h4>
              </div>
              <p className="text-xs text-slate-600">
                Aksi saat offline (mis. Ack/Resolve) akan disimpan di antrean dan otomatis tersinkron saat online.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
