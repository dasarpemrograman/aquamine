"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  BarChart3, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  RefreshCw,
  Zap,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Radio,
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
} from "recharts";

import { GlassCard } from "@/app/components/ui/GlassCard";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { StatusChip } from "@/app/components/ui/StatusChip";
import { 
  fetchAnalyticsSummary, 
  fetchAnalyticsTrends, 
  fetchAnalyticsCompliance, 
  fetchAnalyticsInsights,
  fetchSensors,
  AnalyticsSummaryResponse,
  AnalyticsTrendsResponse,
  AnalyticsComplianceResponse,
  AnalyticsInsightsResponse,
  Sensor,
} from "@/lib/api";
import { formatWIB } from "@/lib/dateUtils";
import { UI_COPY, formatString, getSeverityLabel } from "@/lib/copy";
import { useRealtimeAnalytics } from "@/lib/useRealtimeAnalytics";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrendsResponse | null>(null);
  const [compliance, setCompliance] = useState<AnalyticsComplianceResponse | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsightsResponse | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedSensorId, setSelectedSensorId] = useState<number | undefined>(undefined);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  const realtimeState = useRealtimeAnalytics(realtimeEnabled, "5m", selectedSensorId);

  const formatEvidenceKey = (key: string) => {
    const map: Record<string, string> = {
      "compliance.ph_percent": "Kepatuhan pH (%)",
      "compliance.turbidity_percent": "Kepatuhan Kekeruhan (%)",
      "compliance.temperature_percent": "Kepatuhan Suhu (%)",
      "overall.ph_turbidity_correlation": "Korelasi pH-Kekeruhan",
      "trend.ph_slope": "Tren pH (Slope)",
      "trend.turbidity_slope": "Tren Kekeruhan (Slope)",
    };
    if (map[key]) return map[key];
    return key.split('.').pop()?.replace(/_/g, ' ') || key;
  };

  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, trendsData, complianceData, insightsData] = await Promise.all([
        fetchAnalyticsSummary(selectedSensorId),
        fetchAnalyticsTrends("7d", "hourly", selectedSensorId),
        fetchAnalyticsCompliance("24h", selectedSensorId),
        fetchAnalyticsInsights(selectedSensorId, undefined, { refresh: forceRefresh })
      ]);

      setSummary(summaryData);
      setTrends(trendsData);
      setCompliance(complianceData);
      setInsights(insightsData);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load analytics data:", err);
      setError("Failed to load analytics data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedSensorId]);

  useEffect(() => {
    fetchSensors().then(setSensors).catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getComplianceColor = (percent: number | null) => {
    if (percent === null) return "text-slate-400";
    if (percent >= 80) return "text-emerald-500";
    if (percent >= 60) return "text-amber-500";
    return "text-rose-500";
  };

  const getComplianceLabel = (percent: number | null) => {
    if (percent === null) return "--";
    if (percent >= 80) return UI_COPY.compliant;
    if (percent >= 60) return UI_COPY.warn_short;
    return "Tidak Patuh";
  };

  const formatTrendDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
  };

  const formatRealtimeDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const chartPoints = realtimeEnabled ? realtimeState.points : (trends?.points ?? []);
  const chartTitle = realtimeEnabled ? UI_COPY.realtime_chart : UI_COPY.water_quality_trends;

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title={UI_COPY.analytics_title}
          subtitle={
            selectedSensorId 
              ? `${UI_COPY.analytics_subtitle} • ${sensors.find(s => s.id === selectedSensorId)?.name || 'Sensor #' + selectedSensorId}`
              : UI_COPY.analytics_subtitle
          }
          icon={BarChart3}
          actions={
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                onClick={() => setRealtimeEnabled(prev => !prev)}
                className={`
                  relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border shrink-0
                  ${realtimeEnabled
                    ? "bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-200/50 hover:bg-cyan-700"
                    : "bg-white text-slate-600 border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800"
                  }
                `}
              >
                <Radio size={16} className={realtimeEnabled ? "animate-pulse" : ""} />
                <span className="hidden sm:inline">Realtime</span>
                {realtimeEnabled && (
                  <span className="flex h-2 w-2 relative">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${realtimeState.isConnected ? "bg-emerald-400" : "bg-rose-400"}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${realtimeState.isConnected ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                  </span>
                )}
              </button>
              
              {realtimeEnabled && (
                <div className="hidden md:flex flex-col shrink-0">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${realtimeState.isConnected ? "text-emerald-600" : "text-rose-500"}`}>
                    {realtimeState.isConnected ? UI_COPY.realtime_connected : UI_COPY.realtime_disconnected}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-none">{UI_COPY.realtime_5m}</span>
                </div>
              )}

              <div className="h-6 w-px bg-slate-200 hidden sm:block shrink-0" />

              <div className="relative shrink-0">
                <select
                  value={selectedSensorId ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedSensorId(value ? Number(value) : undefined);
                  }}
                  className="appearance-none w-40 sm:w-56 pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 hover:border-slate-300 transition-all shadow-sm cursor-pointer"
                >
                  <option value="">Semua Sensor</option>
                  {sensors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {!realtimeEnabled && (
                <button
                  onClick={() => loadData(true)}
                  disabled={loading}
                  className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-cyan-600 hover:border-cyan-200 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title="Refresh Data"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
              )}
            </div>
          }
        />

        {error ? (
          <GlassCard className="p-6 border-rose-200 bg-rose-50/50">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle size={20} />
              <p>{error}</p>
              <button 
                onClick={() => loadData()}
                className="ml-auto px-4 py-1.5 bg-white/50 hover:bg-white/80 rounded-lg text-sm font-medium transition-colors"
              >
                {UI_COPY.retry}
              </button>
            </div>
          </GlassCard>
        ) : null}

        {loading && !summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
             {[...Array(4)].map((_, i) => (
               <div key={i} className="h-32 bg-white/40 rounded-2xl border border-white/20" />
             ))}
             <div className="col-span-1 md:col-span-2 lg:col-span-4 h-96 bg-white/40 rounded-2xl border border-white/20" />
          </div>
        ) : (
          <div className="space-y-8">
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <GlassCard className="p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-500">{UI_COPY.system_health}</span>
                    <Activity size={16} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold text-slate-800">
                        {Math.round((summary.system_health.active_sensors / summary.system_health.total_sensors) * 100)}%
                      </span>
                      <StatusChip 
                        status={summary.system_health.offline_sensors > 0 ? "warning" : "active"} 
                        label={summary.system_health.offline_sensors > 0 ? UI_COPY.degraded : UI_COPY.healthy}
                        size="sm"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatString(UI_COPY.online_sensors, { active: summary.system_health.active_sensors, total: summary.system_health.total_sensors })}
                    </p>
                  </div>
                </GlassCard>

                <GlassCard className="p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-500">{UI_COPY.alerts_24h}</span>
                    <AlertTriangle size={16} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800 mb-1">
                      {summary.alerts.total_24h}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-rose-600 font-medium">{summary.alerts.critical} {getSeverityLabel('critical')}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-amber-600 font-medium">{summary.alerts.warning} {getSeverityLabel('warning')}</span>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-500">{UI_COPY.water_quality}</span>
                    <CheckCircle2 size={16} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`text-2xl font-bold ${getComplianceColor(summary.water_quality.ph.percent_compliance)}`}>
                        pH
                      </div>
                      <span className="text-sm text-slate-600">
                        {summary.water_quality.ph.avg?.toFixed(1) ?? "--"} avg
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatString(UI_COPY.compliance_24h, { percent: summary.water_quality.ph.percent_compliance ?? 0 })}
                    </p>
                  </div>
                </GlassCard>

                <GlassCard className="p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-500">{UI_COPY.data_points}</span>
                    <TrendingUp size={16} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800 mb-1">
                      {realtimeEnabled ? realtimeState.points.length : (trends?.points.length ?? 0)}
                    </div>
                    <p className="text-xs text-slate-500">
                      {realtimeEnabled
                        ? formatString(UI_COPY.realtime_points_count, { count: realtimeState.points.length })
                        : formatString(UI_COPY.recorded_in_last, { period: summary.period })}
                    </p>
                  </div>
                </GlassCard>
              </div>
            )}

            {(realtimeEnabled || (trends && trends.points.length > 0)) && (
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-slate-800">{chartTitle}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    {realtimeEnabled && (
                      <span className="text-xs text-slate-400 mr-2">
                        {formatString(UI_COPY.realtime_points_count, { count: chartPoints.length })}
                      </span>
                    )}
                    <span className="w-3 h-3 rounded-full bg-cyan-500"></span> pH
                    <span className="w-3 h-3 rounded-full bg-amber-500 ml-2"></span> {UI_COPY.turbidity}
                    <span className="w-3 h-3 rounded-full bg-indigo-500 ml-2"></span> {UI_COPY.temperature}
                  </div>
                </div>
                <div className="h-[350px] w-full">
                  {chartPoints.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Radio size={32} className="mx-auto text-slate-300 animate-pulse mb-3" />
                        <p className="text-sm text-slate-400">{UI_COPY.realtime_no_data}</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartPoints}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={realtimeEnabled ? formatRealtimeDate : formatTrendDate}
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={{ stroke: '#e2e8f0' }}
                          minTickGap={30}
                        />
                        <YAxis 
                          yAxisId="left"
                          domain={[0, 14]}
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          label={{ value: 'pH', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          label={{ value: 'Turbidity (NTU) / Temp (°C)', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                            borderRadius: '12px', 
                            border: '1px solid rgba(255, 255, 255, 0.5)',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                          labelFormatter={(label) => formatWIB(label)}
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="ph_avg" 
                          name="pH"
                          stroke="#06b6d4" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6, fill: "#06b6d4" }}
                          isAnimationActive={!realtimeEnabled}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="turbidity_avg" 
                          name="Turbidity"
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6, fill: "#f59e0b" }}
                          isAnimationActive={!realtimeEnabled}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="temperature_avg" 
                          name="Temperature"
                          stroke="#6366f1" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6, fill: "#6366f1" }}
                          isAnimationActive={!realtimeEnabled}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </GlassCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {compliance && (
                <GlassCard className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{UI_COPY.compliance_standards}</h3>
                      <p className="text-xs text-slate-500">24 jam terakhir</p>
                    </div>
                    <div className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-500">
                      {compliance.standard.source}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-slate-700">pH Levels</span>
                        <span className={`font-bold ${getComplianceColor(compliance.ph.percent_compliance)}`}>
                          {compliance.ph.percent_compliance}% {getComplianceLabel(compliance.ph.percent_compliance)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${compliance.ph.percent_compliance && compliance.ph.percent_compliance >= 80 ? 'bg-emerald-500' : compliance.ph.percent_compliance && compliance.ph.percent_compliance >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${compliance.ph.percent_compliance}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{UI_COPY.standard}: {compliance.standard.ph_min} - {compliance.standard.ph_max}</span>
                        <span>{formatString(UI_COPY.violations, { count: compliance.ph.violation_count })}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-slate-700">{UI_COPY.turbidity}</span>
                        <span className={`font-bold ${getComplianceColor(compliance.turbidity.percent_compliance)}`}>
                          {compliance.turbidity.percent_compliance}% {getComplianceLabel(compliance.turbidity.percent_compliance)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${compliance.turbidity.percent_compliance && compliance.turbidity.percent_compliance >= 80 ? 'bg-emerald-500' : compliance.turbidity.percent_compliance && compliance.turbidity.percent_compliance >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${compliance.turbidity.percent_compliance}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{UI_COPY.max}: {compliance.standard.turbidity_max_ntu} NTU</span>
                        <span>{formatString(UI_COPY.violations, { count: compliance.turbidity.violation_count })}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-slate-700">{UI_COPY.temperature}</span>
                        <span className={`font-bold ${getComplianceColor(compliance.temperature.percent_compliance)}`}>
                          {compliance.temperature.percent_compliance}% {getComplianceLabel(compliance.temperature.percent_compliance)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${compliance.temperature.percent_compliance && compliance.temperature.percent_compliance >= 80 ? 'bg-emerald-500' : compliance.temperature.percent_compliance && compliance.temperature.percent_compliance >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${compliance.temperature.percent_compliance}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{UI_COPY.max}: {compliance.standard.temperature_max_c}°C</span>
                        <span>{formatString(UI_COPY.violations, { count: compliance.temperature.violation_count })}</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}

              {insights && (
                <GlassCard className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-800">{UI_COPY.ai_insights}</h3>
                    <StatusChip 
                      status={insights.executive_summary.status === "NORMAL" ? "active" : insights.executive_summary.status === "WARNING" ? "warning" : "critical"}
                      label={getSeverityLabel(insights.executive_summary.status)}
                      size="sm"
                    />
                  </div>

                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 mb-6">
                    <div className="flex flex-col gap-6">
                      <div className="flex gap-4">
                        <Zap className="text-amber-500 shrink-0 mt-1" size={20} />
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{UI_COPY.summary}</h4>
                          <p className="text-base font-bold text-slate-800 leading-relaxed mb-3">
                            {insights.executive_summary.headline}
                          </p>
                          
                          <div className="bg-white/60 p-3 rounded-lg border border-slate-200/60">
                            <h5 className="text-xs font-semibold text-slate-500 mb-1">Kondisi Saat Ini</h5>
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {insights.executive_summary.recommendation}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4 border-t border-slate-200">
                         <ClipboardList className="text-emerald-500 shrink-0 mt-1" size={20} />
                         <div className="w-full">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{UI_COPY.action_checklist}</h4>
                            <ul className="space-y-2">
                              {Array.from(new Set(insights.key_findings.flatMap(f => f.recommended_actions)))
                                .slice(0, 5)
                                .map((action, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                  <CheckSquare size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{action}</span>
                                </li>
                              ))}
                            </ul>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <button 
                        onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-sm font-medium text-slate-600">Detail Teknis & Korelasi</span>
                        {showTechnicalDetails ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                      </button>
                      
                      {showTechnicalDetails && (
                        <div className="p-4 bg-white space-y-4">
                            {insights.key_findings.map((finding, idx) => (
                              <div key={idx} className="pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                                <p className="text-sm font-medium text-slate-800">
                                  {finding.title}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5 mb-2">
                                  {finding.description}
                                </p>
                                {finding.evidence.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                    {finding.evidence.map((ev, i) => (
                                      <div key={i} className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded border border-slate-100 text-xs">
                                        <span className="text-slate-500">{formatEvidenceKey(ev.key)}</span>
                                        <span className="font-mono font-medium text-slate-700">{ev.value}{ev.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
