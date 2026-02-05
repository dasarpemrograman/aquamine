"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, CheckCircle2, MapPin, Check, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Paperclip, Image as ImageIcon, X } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { formatRelativeTime } from "@/lib/dateUtils";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { fetchAlerts, Alert, acknowledgeAlertOffline, resolveAlertOffline, reopenAlertOffline, getAlertEvidence, type AlertEvidence } from "@/lib/api";
import { UI_COPY, formatString } from "@/lib/copy";
import Link from "next/link";

interface AlertListProps {
  severityFilter?: string;
  timeRange?: string;
  limit?: number;
  compact?: boolean; // For dashboard widget mode
}

const THRESHOLDS = {
  ph: {
    warning_low: 5.5,
    critical_low: 4.5,
    warning_high: 9.0,
    critical_high: 10.0,
  },
  turbidity: {
    warning_high: 50.0,
    critical_high: 100.0,
  },
  temperature: {
    warning_high: 35.0,
    critical_high: 40.0,
  },
};

export default function AlertList({ severityFilter = "all", timeRange = "24h", limit, compact = false }: AlertListProps) {
  const { getToken } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'acknowledged' | 'resolved'>('active');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  type QueuedNotice = { action: "acknowledge" | "resolve" | "reopen"; message: string };
  const [queuedNoticeById, setQueuedNoticeById] = useState<Record<number, QueuedNotice>>({});

  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceList, setEvidenceList] = useState<AlertEvidence[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [selectedEvidenceIndex, setSelectedEvidenceIndex] = useState(0);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, severityFilter, timeRange]);

  async function loadAlerts() {
    try {
      const token = await getToken();
      const json = await fetchAlerts(token);
      setAlerts(json);

      setQueuedNoticeById((prev) => {
        const entries = Object.entries(prev);
        if (entries.length === 0) return prev;

        const byId = new Map(json.map((a) => [a.id, a] as const));
        const next: Record<number, QueuedNotice> = {};

        for (const [idStr, notice] of entries) {
          const id = Number(idStr);
          const alert = byId.get(id);
          if (!alert) continue;

          if (notice.action === "acknowledge") {
            if (alert.acknowledged_at || alert.resolved_at) continue;
          }

          if (notice.action === "resolve") {
            if (alert.resolved_at) continue;
          }

          if (notice.action === "reopen") {
            if (!alert.resolved_at) continue;
          }

          next[id] = notice;
        }

        return next;
      });
    } catch (e) {
      console.error("Failed to fetch alerts", e);
    }
  }

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 10000);
    return () => clearInterval(interval);
  }, [getToken]);

  const handleAcknowledge = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoadingId(id);
      const token = await getToken();
      const result = await acknowledgeAlertOffline(id, token);

      if (result.status === "queued") {
        setQueuedNoticeById((prev) => ({ ...prev, [id]: { action: "acknowledge", message: result.message } }));
        return;
      }

      await loadAlerts();
    } catch (error) {
      console.error("Failed to acknowledge alert", error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleResolve = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAlertId(id);
    setResolutionNote("");
    setIsResolveModalOpen(true);
  };

  const confirmResolve = async () => {
    if (!selectedAlertId) return;
    
    const id = selectedAlertId;
    const normalized = resolutionNote.trim();
    
    setIsResolveModalOpen(false);

    try {
      setLoadingId(id);
      const token = await getToken();
      const result = await resolveAlertOffline(id, normalized ? { resolution_note: normalized } : undefined, token);

      if (result.status === "queued") {
        setQueuedNoticeById((prev) => ({ ...prev, [id]: { action: "resolve", message: result.message } }));
        return;
      }

      await loadAlerts();
    } catch (error) {
      console.error("Failed to resolve alert", error);
    } finally {
      setLoadingId(null);
      setSelectedAlertId(null);
    }
  };

  const handleReopen = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setLoadingId(id);
      const token = await getToken();
      const result = await reopenAlertOffline(id, token);

      if (result.status === "queued") {
        setQueuedNoticeById((prev) => ({ ...prev, [id]: { action: "reopen", message: result.message } }));
        return;
      }

      await loadAlerts();
    } catch (error) {
      console.error("Failed to reopen alert", error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleViewEvidence = async (alertId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingEvidence(true);
    setSelectedAlertId(alertId);
    setShowEvidenceModal(true);
    setSelectedEvidenceIndex(0);
    
    try {
      const token = await getToken();
      const evidence = await getAlertEvidence(alertId, token);
      setEvidenceList(evidence);
    } catch (error) {
      console.error("Failed to load evidence:", error);
    } finally {
      setLoadingEvidence(false);
    }
  };

  const queuedIds = useMemo(() => new Set(Object.keys(queuedNoticeById).map(Number)), [queuedNoticeById]);

  const getSeverityIcon = (severity: string) => {
    const baseClass = "flex items-center justify-center rounded-full shadow-sm border border-white/50 backdrop-blur-md w-10 h-10 flex-shrink-0";
    
    switch (severity) {
      case "critical": 
        return (
          <div className={`${baseClass} bg-rose-100 text-rose-700`}>
            <AlertTriangle size={18} strokeWidth={2.5} />
          </div>
        );
      case "warning": 
        return (
          <div className={`${baseClass} bg-amber-100 text-amber-700`}>
            <AlertTriangle size={18} strokeWidth={2.5} />
          </div>
        );
      case "info": 
      default: 
        return (
          <div className={`${baseClass} bg-sky-100 text-sky-700`}>
            <Info size={18} strokeWidth={2.5} />
          </div>
        );
    }
  };

  // --- Parsing & Enrichment ---

  const parseAlertMessage = (message: string | null, severity: string) => {
    if (!message) return { title: "Unknown Alert", description: "", suggestion: null };

    const regex = /^(\w+)\s+(\w+):\s+([\d.]+)/i;
    const match = message.match(regex);

    if (!match) return { title: message, description: "", suggestion: null };

    const param = match[1].toLowerCase();
    const value = parseFloat(match[3]);
    
    let title = "";
    let description = "";
    let suggestion = null;

    if (param === "ph") {
      if (value < THRESHOLDS.ph.critical_low) {
        title = "pH KRITIS";
        description = `${value.toFixed(2)} (di bawah batas ${THRESHOLDS.ph.critical_low})`;
        suggestion = "Saran: Cek sistem netralisasi, tambah kapur";
      } else if (value < THRESHOLDS.ph.warning_low) {
        title = "pH RENDAH";
        description = `${value.toFixed(2)} (di bawah batas ${THRESHOLDS.ph.warning_low})`;
        suggestion = "Saran: Cek dosis netralisasi";
      } else if (value > THRESHOLDS.ph.critical_high) {
        title = "pH TINGGI (KRITIS)";
        description = `${value.toFixed(2)} (di atas batas ${THRESHOLDS.ph.critical_high})`;
        suggestion = "Saran: Cek kebocoran alkali, sistem treatment";
      } else if (value > THRESHOLDS.ph.warning_high) {
        title = "pH TINGGI";
        description = `${value.toFixed(2)} (di atas batas ${THRESHOLDS.ph.warning_high})`;
        suggestion = "Saran: Cek kebocoran alkali";
      } else {
        title = `pH ${severity.toUpperCase()}`;
        description = `${value.toFixed(2)}`;
      }
    } else if (param === "turbidity") {
       if (value > THRESHOLDS.turbidity.critical_high) {
         title = "TURBIDITY KRITIS";
         description = `${value.toFixed(2)} NTU (di atas batas ${THRESHOLDS.turbidity.critical_high} NTU)`;
         suggestion = "Saran: Cek sediment/runoff, tanggul, pompa";
       } else if (value > THRESHOLDS.turbidity.warning_high) {
         title = "TURBIDITY TINGGI";
         description = `${value.toFixed(2)} NTU (di atas batas ${THRESHOLDS.turbidity.warning_high} NTU)`;
         suggestion = "Saran: Cek pengendapan";
       } else {
         title = `TURBIDITY ${severity.toUpperCase()}`;
         description = `${value.toFixed(2)} NTU`;
       }
    } else if (param === "temperature") {
       if (value > THRESHOLDS.temperature.critical_high) {
         title = "TEMPERATURE KRITIS";
         description = `${value.toFixed(2)}C (di atas batas ${THRESHOLDS.temperature.critical_high}C)`;
         suggestion = "Saran: Cek sumber panas, pendinginan";
       } else if (value > THRESHOLDS.temperature.warning_high) {
         title = "TEMPERATURE TINGGI";
         description = `${value.toFixed(2)}C (di atas batas ${THRESHOLDS.temperature.warning_high}C)`;
         suggestion = "Saran: Monitor suhu peralatan";
       } else {
         title = `TEMPERATURE ${severity.toUpperCase()}`;
         description = `${value.toFixed(2)}C`;
       }
    } else {
      title = `${param.toUpperCase()} ${severity.toUpperCase()}`;
      description = `${value}`;
    }

    return { title, description, suggestion };
  };

  const alertsWithinFilters = useMemo(() => {
    return alerts.filter((alert) => {
      // 1. External severityFilter prop (from parent)
      if (severityFilter !== "all" && alert.severity !== severityFilter) return false;

      // 2. Time range
      if (timeRange !== "all") {
        const alertDate = new Date(alert.created_at).getTime();
        const now = new Date().getTime();
        const hoursDiff = (now - alertDate) / (1000 * 60 * 60);

        if (timeRange === "24h" && hoursDiff > 24) return false;
        if (timeRange === "7d" && hoursDiff > 24 * 7) return false;
        if (timeRange === "30d" && hoursDiff > 24 * 30) return false;
      }

      return true;
    });
  }, [alerts, severityFilter, timeRange]);

  const tabCounts = useMemo(() => {
    let active = 0;
    let acknowledged = 0;
    let resolved = 0;

    for (const alert of alertsWithinFilters) {
      const isResolved = Boolean(alert.resolved_at);
      const isAcknowledged = Boolean(alert.acknowledged_at);

      if (isResolved) {
        resolved++;
      } else if (isAcknowledged) {
        acknowledged++;
      } else {
        active++;
      }
    }

    return { active, acknowledged, resolved };
  }, [alertsWithinFilters]);

  // Filter Logic
  const filteredAlerts = alertsWithinFilters.filter((alert) => {
    const isResolved = Boolean(alert.resolved_at);
    const isAcknowledged = Boolean(alert.acknowledged_at);

    if (activeTab === "active") return !isResolved && !isAcknowledged;
    if (activeTab === "acknowledged") return !isResolved && isAcknowledged;
    return isResolved;
  });

  useEffect(() => {
    const maxPage = Math.ceil(filteredAlerts.length / ITEMS_PER_PAGE);
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(maxPage);
    }
  }, [filteredAlerts.length, currentPage]);

  const totalPages = Math.ceil(filteredAlerts.length / ITEMS_PER_PAGE);

  const displayAlerts = limit 
    ? filteredAlerts.slice(0, limit) 
    : filteredAlerts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex p-1 bg-slate-100/50 backdrop-blur-sm rounded-lg w-fit border border-slate-200">
            {(['active', 'acknowledged', 'resolved'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  // Reset sub-filter when changing tabs if needed, or keep it
                }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab 
                    ? 'bg-white text-slate-800 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'active' ? UI_COPY.tab_active : tab === 'acknowledged' ? UI_COPY.tab_acknowledged : UI_COPY.tab_resolved}
                 <span className="ml-2 text-xs opacity-60 bg-slate-200 px-1.5 py-0.5 rounded-full">
                  {tab === "active" ? tabCounts.active : tab === "acknowledged" ? tabCounts.acknowledged : tabCounts.resolved}
                 </span>
               </button>
             ))}
           </div>


        </div>
       )}

      {displayAlerts.length === 0 ? (
        <GlassCard 
          className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-12'}`} 
          variant="flat"
        >
          <div className={`${compact ? 'w-12 h-12 mb-2' : 'w-16 h-16 mb-4'} bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner`}>
            <CheckCircle2 size={compact ? 24 : 32} className="text-slate-300" />
          </div>
          <h3 className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-slate-700`}>{formatString(UI_COPY.no_alerts_title, { status: activeTab === 'active' ? UI_COPY.tab_active : activeTab === 'acknowledged' ? UI_COPY.tab_acknowledged : UI_COPY.tab_resolved })}</h3>
          <p className="text-slate-400 mt-1 max-w-xs mx-auto">{UI_COPY.system_normal}</p>
        </GlassCard>
      ) : (
        displayAlerts.map((alert) => {
            const { title, description, suggestion } = parseAlertMessage(alert.message, alert.severity);
            
            return (
              <div key={alert.id} className="relative">
                 <GlassCard 
                   className={`group transition-all duration-300 hover:shadow-md ${
                    alert.resolved_at
                      ? 'bg-slate-50/70 border-slate-200'
                      : alert.acknowledged_at
                      ? 'bg-slate-50/50 border-slate-200'
                      : 'hover:bg-white/60'
                   }`}
                   variant="flat"
                   padding={compact ? "sm" : "md"}
                 >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {!compact && (
                      <div className="flex-shrink-0 mt-1 hidden sm:block">
                        {getSeverityIcon(alert.severity)}
                      </div>
                    )}

                      <div className="flex-grow min-w-0 w-full">
                        {/* Header Row */}
                        {compact ? (
                          <div className="flex flex-col gap-2 mb-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-bold text-slate-800 flex-1 leading-snug">{title}</h4>
                              {getSeverityIcon(alert.severity)}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 w-full">
                              <MapPin size={10} className="flex-shrink-0" />
                              <span className="truncate">{alert.sensor_name || `Sensor ${alert.sensor_id}`}</span>
                              <span className="text-slate-300 flex-shrink-0">•</span>
                              <span className="whitespace-nowrap flex-shrink-0">{formatRelativeTime(alert.created_at)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-y-1 mb-2">
                             <h4 className="text-base font-bold text-slate-800 leading-snug flex items-center gap-2">
                               <span className="sm:hidden">{getSeverityIcon(alert.severity)}</span>
                               {title}
                             </h4>
                             <span className="text-xs font-medium text-slate-400 flex items-center gap-1 max-w-full overflow-hidden">
                               <MapPin size={12} className="flex-shrink-0" />
                               <span className="truncate">
                                 {alert.sensor_name || `Sensor ${alert.sensor_id}`}
                               </span>
                               <span className="flex-shrink-0">• {formatRelativeTime(alert.created_at)}</span>
                             </span>
                          </div>
                        )}
                        
                         {/* Description */}
                        <div className="text-sm font-medium text-slate-600 mb-3 flex items-center justify-between">
                            <span>{description}</span>
                            {alert.evidence_count > 0 && (
                              <button
                                onClick={(e) => handleViewEvidence(alert.id, e)}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors"
                                title={`${alert.evidence_count} bukti terlampir`}
                              >
                                <Paperclip size={14} />
                                {alert.evidence_count} Bukti
                              </button>
                            )}
                        </div>

                        {/* Suggestion Box */}
                        {suggestion && (
                            <div className="mb-4 bg-yellow-50/50 border border-yellow-100 rounded-md p-2.5 text-sm text-slate-700">
                                {suggestion}
                            </div>
                        )}

                        {/* Resolution Note */}
                        {activeTab === 'resolved' && alert.resolution_note && (
                          <div className="mb-4 text-sm text-slate-500 bg-slate-100/50 p-2 rounded-md border border-slate-100">
                            <span className="font-medium text-slate-600 mr-1">Catatan resolusi:</span>
                            {alert.resolution_note}
                          </div>
                        )}

                         {!compact && (
                           <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100/50">
                            {activeTab === 'active' && (
                              <button 
                                onClick={(e) => handleAcknowledge(alert.id, e)}
                                disabled={loadingId === alert.id || queuedIds.has(alert.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors disabled:opacity-50"
                              >
                                <Check size={14} />
                                {loadingId === alert.id ? UI_COPY.saving : UI_COPY.acknowledge}
                              </button>
                            )}

                          {(activeTab === 'acknowledged') && (
                            <button 
                              onClick={(e) => handleResolve(alert.id, e)}
                              disabled={loadingId === alert.id || queuedIds.has(alert.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 border border-slate-200"
                            >
                              <CheckCircle2 size={14} />
                              {loadingId === alert.id ? UI_COPY.saving : UI_COPY.resolve}
                            </button>
                          )}

                          {activeTab === 'resolved' && (
                            <button
                              onClick={(e) => handleReopen(alert.id, e)}
                              disabled={loadingId === alert.id || queuedIds.has(alert.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 border border-slate-200"
                            >
                              <RotateCcw size={14} />
                              {loadingId === alert.id ? UI_COPY.saving : "Buka kembali"}
                            </button>
                          )}

                          {queuedNoticeById[alert.id] && (
                            <span className="text-xs font-medium text-slate-500 ml-2">
                              {queuedNoticeById[alert.id].message}
                            </span>
                          )}

                           <div className="ml-auto flex items-center gap-2">
                            <Link 
                              href={`/map?sensor_id=${alert.sensor_id}`}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                              title="Lihat di Peta"
                            >
                              <MapPin size={14} />
                              <span>Lokasi</span>
                            </Link>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </div>
            );
        })
      )}

      {!limit && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-200">
          <div className="text-sm text-slate-500 font-medium">
            Halaman <span className="font-medium text-slate-900">{currentPage}</span> dari <span className="font-medium text-slate-900">{totalPages}</span> <span className="text-slate-300 mx-2">|</span> Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAlerts.length)} dari <span className="font-medium text-slate-900">{filteredAlerts.length}</span> alert
          </div>
          
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/50 rounded-lg border border-slate-200">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all text-slate-600"
              title="Awal"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all text-slate-600"
              title="Sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = currentPage;
                if (totalPages <= 5) {
                    p = i + 1;
                } else if (currentPage <= 3) {
                    p = i + 1;
                } else if (currentPage >= totalPages - 2) {
                    p = totalPages - 4 + i;
                } else {
                    p = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-semibold transition-all ${
                      currentPage === p
                        ? "bg-cyan-600 text-white shadow-md shadow-cyan-200"
                        : "text-slate-600 hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all text-slate-600"
              title="Berikutnya"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all text-slate-600"
              title="Akhir"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md bg-white/90" variant="elevated" padding="lg">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Selesaikan Alert</h3>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Catatan resolusi (opsional)..."
              className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none mb-6 text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmResolve}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
              >
                Selesaikan
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {showEvidenceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Bukti Terlampir</h3>
                <p className="text-sm text-slate-500">
                  {evidenceList.length} bukti untuk peringatan #{selectedAlertId}
                </p>
              </div>
              <button 
                onClick={() => setShowEvidenceModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {loadingEvidence ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                </div>
              ) : evidenceList.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  Tidak ada bukti terlampir
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-hidden bg-slate-900 flex items-center justify-center p-4">
                    <img 
                      src={evidenceList[selectedEvidenceIndex].image_data} 
                      alt={`Evidence ${selectedEvidenceIndex + 1}`}
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  </div>
                  
                  {evidenceList.length > 1 && (
                    <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedEvidenceIndex(Math.max(0, selectedEvidenceIndex - 1))}
                        disabled={selectedEvidenceIndex === 0}
                        className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← Sebelumnya
                      </button>
                      <span className="text-sm text-slate-600">
                        {selectedEvidenceIndex + 1} / {evidenceList.length}
                      </span>
                      <button
                        onClick={() => setSelectedEvidenceIndex(Math.min(evidenceList.length - 1, selectedEvidenceIndex + 1))}
                        disabled={selectedEvidenceIndex === evidenceList.length - 1}
                        className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Berikutnya →
                      </button>
                    </div>
                  )}

                  <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                    <div className="flex items-center gap-4">
                      <span>
                        Dilampirkan: {new Date(evidenceList[selectedEvidenceIndex].attached_at).toLocaleString('id-ID')}
                      </span>
                      {evidenceList[selectedEvidenceIndex].attached_by && (
                        <span>Oleh: {evidenceList[selectedEvidenceIndex].attached_by}</span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
