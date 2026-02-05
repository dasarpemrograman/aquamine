"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, CheckCircle2, MapPin, Check, ChevronDown, ChevronUp, RotateCcw, X } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { formatWIB } from "@/lib/dateUtils";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { fetchAlerts, Alert, acknowledgeAlertOffline, resolveAlertOffline, reopenAlertOffline } from "@/lib/api";
import { groupAlerts, GroupedAlert } from "@/lib/alertGrouping";
import { UI_COPY, getSeverityLabel, formatString } from "@/lib/copy";
import Link from "next/link";

interface AlertListProps {
  severityFilter?: string;
  timeRange?: string;
  limit?: number;
  compact?: boolean; // For dashboard widget mode
}

export default function AlertList({ severityFilter = "all", timeRange = "24h", limit, compact = false }: AlertListProps) {
  const { getToken } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'acknowledged' | 'resolved'>('active');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  type QueuedNotice = { action: "acknowledge" | "resolve" | "reopen"; message: string };
  const [queuedNoticeById, setQueuedNoticeById] = useState<Record<number, QueuedNotice>>({});

  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  useEffect(() => {
    setVisibleCount(50);
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

  const queuedIds = useMemo(() => new Set(Object.keys(queuedNoticeById).map(Number)), [queuedNoticeById]);

  const toggleGroup = (id: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedGroups(newExpanded);
  };

  const getStatusVariant = (severity: string): 'critical' | 'warning' | 'info' | 'active' => {
    switch (severity) {
      case "critical": return "critical";
      case "warning": return "warning";
      case "info": return "info";
      default: return "active";
    }
  };

  const getSeverityIcon = (severity: string) => {
    const baseClass = "flex items-center justify-center rounded-full shadow-sm border border-white/50 backdrop-blur-md w-10 h-10";
    
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

  const alertsWithinFilters = useMemo(() => {
    return alerts.filter((alert) => {
      if (severityFilter !== "all" && alert.severity !== severityFilter) return false;

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

  const groupedAlerts = groupAlerts(filteredAlerts);
  const displayAlerts = limit 
    ? groupedAlerts.slice(0, limit) 
    : groupedAlerts.slice(0, visibleCount);

  const hasMore = !limit && groupedAlerts.length > displayAlerts.length;

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex p-1 bg-slate-100/50 backdrop-blur-sm rounded-lg w-fit border border-slate-200">
          {(['active', 'acknowledged', 'resolved'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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
        displayAlerts.map((group) => (
          <div key={group.id} className="relative">
             <GlassCard 
               className={`group transition-all duration-300 hover:shadow-md ${
                group.resolved_at
                  ? 'bg-slate-50/70 border-slate-200'
                  : group.acknowledged_at
                  ? 'bg-slate-50/50 border-slate-200'
                  : 'hover:bg-white/60'
               }`}
               variant="flat"
               padding={compact ? "sm" : "md"}
             >
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getSeverityIcon(group.severity)}
                </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-y-2 gap-x-4 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider mr-1">
                          #{group.id} • {group.sensor_id}
                        </span>
                        <StatusChip 
                          status={getStatusVariant(group.severity)} 
                          label={getSeverityLabel(group.severity)} 
                          size="sm" 
                        />
                        {group.count > 1 && (
                          <span 
                            className={`inline-flex items-center justify-center font-semibold rounded-full border border-slate-200 backdrop-blur-sm bg-slate-100 text-slate-600 shadow-sm gap-1 cursor-help whitespace-nowrap ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}
                            title={formatString(UI_COPY.similar_alerts_tooltip, { count: group.count - 1 })}
                          >
                            {formatString(UI_COPY.similar_alerts, { count: group.count - 1 })}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-400 whitespace-nowrap bg-slate-100/50 px-2 py-1 rounded-md self-start sm:self-auto">
                        {formatWIB(group.created_at)}
                      </span>
                    </div>
                    
                    <h4 className="text-base font-semibold text-slate-800 leading-snug mb-2">
                      {group.message}
                    </h4>
                    {activeTab === 'resolved' && group.resolution_note && (
                      <div className="mt-2 text-sm text-slate-500 bg-slate-100/50 p-2 rounded-md border border-slate-100">
                        <span className="font-medium text-slate-600 mr-1">Catatan resolusi:</span>
                        {group.resolution_note}
                      </div>
                    )}

                    {!compact && (
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100/50">
                       {activeTab === 'active' && (
                         <button 
                           onClick={(e) => handleAcknowledge(group.id, e)}
                           disabled={loadingId === group.id || queuedIds.has(group.id)}
                           className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors disabled:opacity-50"
                         >
                           <Check size={14} />
                           {loadingId === group.id ? UI_COPY.saving : UI_COPY.acknowledge}
                         </button>
                       )}

                      {(activeTab === 'active' || activeTab === 'acknowledged') && (
                        <button 
                          onClick={(e) => handleResolve(group.id, e)}
                          disabled={loadingId === group.id || queuedIds.has(group.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          {loadingId === group.id ? UI_COPY.saving : UI_COPY.resolve}
                        </button>
                      )}

                      {activeTab === 'resolved' && (
                        <button
                          onClick={(e) => handleReopen(group.id, e)}
                          disabled={loadingId === group.id || queuedIds.has(group.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                        >
                          <RotateCcw size={14} />
                          {loadingId === group.id ? UI_COPY.saving : "Buka kembali"}
                        </button>
                      )}

                      {queuedNoticeById[group.id] && (
                        <span className="text-xs font-medium text-slate-500">
                          {queuedNoticeById[group.id].message}
                        </span>
                      )}

                      <Link 
                        href={`/map?sensor_id=${group.sensor_id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <MapPin size={14} />
                        {UI_COPY.map}
                      </Link>

                      {group.count > 1 && (
                        <button 
                          onClick={() => toggleGroup(group.id)}
                          className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                        >
                          {expandedGroups.has(group.id) ? UI_COPY.collapse : UI_COPY.expand_history}
                          {expandedGroups.has(group.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {expandedGroups.has(group.id) && group.childAlerts.length > 0 && (
                <div className="mt-3 pl-14 space-y-3 border-l-2 border-slate-100/60">
                  {group.childAlerts.map(child => (
                    <div key={child.id} className="relative pl-4">
                      <div className="flex justify-between items-start text-sm">
                        <span className="text-slate-600">{child.message}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{formatWIB(child.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        ))
      )}

      {hasMore && (
        <button
          onClick={() => setVisibleCount((prev) => prev + 50)}
          className="w-full py-4 mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 bg-white/50 backdrop-blur-sm border border-slate-200 rounded-xl hover:bg-white hover:text-cyan-700 hover:border-cyan-300 transition-all shadow-sm group"
        >
          <span>Muat lebih banyak</span>
          <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
        </button>
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
    </div>
  );
}
