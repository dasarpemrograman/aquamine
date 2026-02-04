"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle, Info, TrendingUp, XCircle } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import {
  fetchAnalyticsSummary,
  fetchAnalyticsInsights,
  AnalyticsSummaryResponse,
  AnalyticsInsightsResponse,
} from "@/lib/api";

const DEMO_MODE_STORAGE_KEY = "aquamine_demo_mode";
const DEMO_REFRESH_INTERVAL = 5000;
const NORMAL_REFRESH_INTERVAL = 60000;

function getStatusColor(status: string): string {
  switch (status) {
    case "normal":
    case "NORMAL":
      return "text-emerald-600 bg-emerald-50 border-emerald-200";
    case "warning":
    case "WARNING":
      return "text-amber-600 bg-amber-50 border-amber-200";
    case "critical":
    case "CRITICAL":
      return "text-rose-600 bg-rose-50 border-rose-200";
    default:
      return "text-slate-600 bg-slate-50 border-slate-200";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "normal":
    case "NORMAL":
      return <CheckCircle className="w-4 h-4" />;
    case "warning":
    case "WARNING":
      return <AlertTriangle className="w-4 h-4" />;
    case "critical":
    case "CRITICAL":
      return <XCircle className="w-4 h-4" />;
    default:
      return <Info className="w-4 h-4" />;
  }
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

export default function AnalyticsWidget() {
  const { user } = useUser();
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const checkDemoMode = () => {
      const enabled = localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
      setIsDemoMode(enabled);
    };

    checkDemoMode();
    const handleDemoChange = () => checkDemoMode();
    window.addEventListener("demo-mode-changed", handleDemoChange);

    return () => {
      window.removeEventListener("demo-mode-changed", handleDemoChange);
    };
  }, []);

  const refreshInterval = isDemoMode ? DEMO_REFRESH_INTERVAL : NORMAL_REFRESH_INTERVAL;

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const [summaryData, insightsData] = await Promise.all([
        fetchAnalyticsSummary(),
        fetchAnalyticsInsights(),
      ]);

      setSummary(summaryData);
      setInsights(insightsData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  if (loading && !summary) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-cyan-600" />
          <h3 className="font-semibold text-slate-800">Analytics</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-cyan-600" />
          <h3 className="font-semibold text-slate-800">Analytics</h3>
        </div>
        <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg">
          {error}
        </div>
        <button
          onClick={fetchData}
          className="mt-3 text-sm text-cyan-600 hover:text-cyan-700 font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const executiveStatus = insights?.executive_summary?.status || "NORMAL";
  const headline = insights?.executive_summary?.headline || "No insights available";
  const recommendation = insights?.executive_summary?.recommendation || "";

  const phCompliance = summary?.water_quality?.ph?.percent_compliance;
  const turbidityCompliance = summary?.water_quality?.turbidity?.percent_compliance;
  const temperatureCompliance = summary?.water_quality?.temperature?.percent_compliance;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-600" />
          <h3 className="font-semibold text-slate-800">Analytics</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(executiveStatus)}`}>
          {getStatusIcon(executiveStatus)}
          <span className="capitalize">{executiveStatus.toLowerCase()}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-500 mb-1">pH</div>
          <div className={`text-sm font-semibold ${phCompliance && phCompliance >= 80 ? "text-emerald-600" : phCompliance && phCompliance >= 60 ? "text-amber-600" : "text-rose-600"}`}>
            {formatPercent(phCompliance)}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-500 mb-1">Turbidity</div>
          <div className={`text-sm font-semibold ${turbidityCompliance && turbidityCompliance >= 80 ? "text-emerald-600" : turbidityCompliance && turbidityCompliance >= 60 ? "text-amber-600" : "text-rose-600"}`}>
            {formatPercent(turbidityCompliance)}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-500 mb-1">Temp</div>
          <div className={`text-sm font-semibold ${temperatureCompliance && temperatureCompliance >= 80 ? "text-emerald-600" : temperatureCompliance && temperatureCompliance >= 60 ? "text-amber-600" : "text-rose-600"}`}>
            {formatPercent(temperatureCompliance)}
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 mb-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-slate-700 font-medium line-clamp-2">{headline}</p>
            {recommendation && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{recommendation}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <a
          href="/analytics"
          className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
        >
          View details →
        </a>
        {lastUpdated && (
          <span className="text-xs text-slate-400">
            {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}