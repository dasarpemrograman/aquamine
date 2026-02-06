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
  ClipboardList
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  BarChart,
  Bar,
  Legend, 
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


const formatIDR = (value: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
};

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
  const [isFinancialDetailsOpen, setIsFinancialDetailsOpen] = useState(false);

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
            <div className="flex items-center gap-3">
              <select
                value={selectedSensorId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedSensorId(value ? Number(value) : undefined);
                }}
                className="pl-3 pr-8 py-2 bg-white/50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 appearance-none cursor-pointer hover:bg-white/80 transition-colors"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: "right 0.5rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.5em 1.5em"
                }}
              >
                <option value="">Semua Sensor</option>
                {sensors.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {lastRefreshed && (
                <span className="text-xs text-slate-500 hidden sm:inline-block">
                  {UI_COPY.updated}: {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => loadData(true)}
                disabled={loading}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors text-slate-600 disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </button>
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
                      {trends?.points.length ?? 0}
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatString(UI_COPY.recorded_in_last, { period: summary.period })}
                    </p>
                  </div>
                </GlassCard>
              </div>
            )}


            {trends && trends.points.length > 0 && (
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-slate-800">{UI_COPY.water_quality_trends}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="w-3 h-3 rounded-full bg-cyan-500"></span> pH
                    <span className="w-3 h-3 rounded-full bg-amber-500 ml-2"></span> {UI_COPY.turbidity}
                    <span className="w-3 h-3 rounded-full bg-indigo-500 ml-2"></span> {UI_COPY.temperature}
                  </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={formatTrendDate}
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
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}

            {/* Strategic Decision Row */}
            {insights?.strategic_decision_support && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* AI Prescriptive Instruction */}
                    <GlassCard className="p-6 flex flex-col h-full bg-gradient-to-br from-white/60 to-cyan-50/60 border-cyan-100">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-cyan-100 text-cyan-700 rounded-lg">
                                <Zap size={20} />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">Tindakan Pencegahan Wajib</h3>
                        </div>
                        
                        <div className="space-y-4 flex-1">
                            <div className="p-4 bg-white/60 rounded-xl border border-white/50 shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium text-slate-500">Dosis Kapur (CaO) Diperlukan</span>
                                    <span className="text-xs font-semibold text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-full">Segera</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-800">
                                    {insights.strategic_decision_support.treatment.cao_dosage_kg_ph.toFixed(2)} <span className="text-lg font-medium text-slate-500">kg/jam</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                 <div className="p-3 bg-white/60 rounded-xl border border-white/50">
                                    <span className="text-xs text-slate-500 block mb-1">Estimasi Waktu Kepatuhan</span>
                                    <span className="text-xl font-bold text-slate-800">
                                        {insights.strategic_decision_support.compliance_eta_minutes ?? 45} <span className="text-sm font-normal">mnt</span>
                                    </span>
                                 </div>
                                 <div className="p-3 bg-white/60 rounded-xl border border-white/50">
                                    <span className="text-xs text-slate-500 block mb-1">Status Risiko Hukum</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${insights.strategic_decision_support.legal_risk_status === 'Pidana' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                                        <span className="font-semibold text-slate-700">
                                            {insights.strategic_decision_support.legal_risk_status || "Administratif"}
                                        </span>
                                    </div>
                                 </div>
                            </div>
                            
                        {/* Infrastructure Alert */}
                            {insights.strategic_decision_support.infrastructure_alert && (
                                <div className="mb-4 p-3 bg-amber-50 text-amber-900 text-sm rounded-lg border border-amber-200 flex items-start gap-2 animate-pulse">
                                    <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
                                    <div>
                                        <p className="font-bold">{insights.strategic_decision_support.infrastructure_alert.title}</p>
                                        <p>{insights.strategic_decision_support.infrastructure_alert.message}</p>
                                    </div>
                                </div>
                            )}

                            {insights.strategic_decision_support.prescriptive_plan && (
                                <div className="p-3 bg-cyan-50 text-cyan-900 text-sm rounded-lg border border-cyan-100">
                                    <p className="font-medium mb-1">Instruksi:</p>
                                    {insights.strategic_decision_support.prescriptive_plan}
                                </div>
                            )}
                        </div>
                    </GlassCard>

                    {/* Financial Exposure Card with Improved Breakdown */}
                    <GlassCard className="p-6 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Analisis Eksposur Finansial</h3>
                             <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">Proyeksi Per Jam</span>
                        </div>
                        
                        <div className="flex-1 w-full min-h-[250px]">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart layout="vertical" data={[
                                    {
                                        name: 'OpEx',
                                        'Kapur': insights.strategic_decision_support.treatment.cost_breakdown?.chemical || 0,
                                        'Energi': insights.strategic_decision_support.treatment.cost_breakdown?.energy || 0,
                                        'SDM & Maint': (insights.strategic_decision_support.treatment.cost_breakdown?.labor || 0) + (insights.strategic_decision_support.treatment.cost_breakdown?.maintenance || 0),
                                    },
                                    {
                                        name: 'Risk',
                                        'Denda': insights.strategic_decision_support.legal_risk.risk_breakdown?.fine || 0,
                                        'Restorasi': insights.strategic_decision_support.legal_risk.risk_breakdown?.restoration || 0,
                                        'Infra Darurat': insights.strategic_decision_support.legal_risk.risk_breakdown?.infrastructure || 0,
                                    }
                                ]} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={50} tick={{fontSize: 12, fontWeight: 600}} />
                                    <Tooltip
                                        formatter={(value: string | number | Array<string | number>) => {
                                          const numValue = Array.isArray(value) ? value[0] : value;
                                          return formatIDR(Number(numValue) || 0);
                                        }}
                                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                    
                                    {/* OpEx Stacks */}
                                    <Bar dataKey="Kapur" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} barSize={40} />
                                    <Bar dataKey="Energi" stackId="a" fill="#34d399" />
                                    <Bar dataKey="SDM & Maint" stackId="a" fill="#6ee7b7" />
                                    
                                    {/* Risk Stacks */}
                                    <Bar dataKey="Denda" stackId="a" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={40} />
                                    <Bar dataKey="Restorasi" stackId="a" fill="#fb7185" />
                                    <Bar dataKey="Infra Darurat" stackId="a" fill="#be123c" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 group relative">
                            <div className="flex justify-between items-center cursor-help">
                                <span className="text-sm font-medium text-slate-500 border-b border-dotted border-slate-400">Potensi Penghematan Bersih</span>
                                <span className={`text-xl font-bold ${
                                    (insights.strategic_decision_support.net_potential_savings_idr ?? 0) > 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}>
                                    {formatIDR(insights.strategic_decision_support.net_potential_savings_idr ?? 
                                        ((insights.strategic_decision_support.legal_risk.risk_exposure_idr) - insights.strategic_decision_support.treatment.estimated_cost_idr_ph)
                                    )}
                                </span>
                            </div>

                            {/* Summary Highlight */}
                             {insights.strategic_decision_support.financial_narrative?.summary_highlight && (
                                <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100 italic">
                                    "{insights.strategic_decision_support.financial_narrative.summary_highlight}"
                                </div>
                            )}

                            {/* Hover Details for Net Savings */}
                            <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-800 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                <div className="flex justify-between mb-1">
                                    <span>Total Risiko:</span>
                                    <span className="font-mono text-rose-300">{formatIDR(insights.strategic_decision_support.legal_risk.risk_exposure_idr)}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span>Total Treatment:</span>
                                    <span className="font-mono text-emerald-300">-{formatIDR(insights.strategic_decision_support.treatment.estimated_cost_idr_ph)}</span>
                                </div>
                                <div className="border-t border-slate-600 mt-1 pt-1 flex justify-between font-bold">
                                    <span>Net:</span>
                                    <span>{formatIDR(insights.strategic_decision_support.net_potential_savings_idr || 0)}</span>
                                </div>
                            </div>
                        </div>

                         {/* Financial Details Accordion */}
                         <div className="mt-4 border-t border-slate-100">
                            <button 
                                onClick={() => setIsFinancialDetailsOpen(!isFinancialDetailsOpen)}
                                className="w-full flex items-center justify-between py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
                            >
                                <span>Rincian Kalkulasi Keuangan</span>
                                {isFinancialDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            
                            {isFinancialDetailsOpen && insights.strategic_decision_support.financial_narrative && (
                                <div className="mt-2 space-y-3 text-xs text-slate-600 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                        <span className="font-bold text-emerald-600 block mb-1">OpEx (Penanganan)</span>
                                        <p>{insights.strategic_decision_support.financial_narrative.opex}</p>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                        <span className="font-bold text-amber-600 block mb-1">CapEx (Infrastruktur)</span>
                                        <p>{insights.strategic_decision_support.financial_narrative.capex}</p>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                        <span className="font-bold text-rose-600 block mb-1">Risk Exposure</span>
                                        <p>{insights.strategic_decision_support.financial_narrative.risk}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>
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
