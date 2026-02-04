"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, HelpCircle, LogIn, Menu } from "lucide-react";
import { StatusChip } from "./ui/StatusChip";
import { UserButton, SignedIn, SignedOut, useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import NotificationDropdown from "./NotificationDropdown";
import LegendDropdown from "./LegendDropdown";
import {
  fetchHealth,
  fetchSensors,
  fetchSettings,
  Sensor,
  fetchReadings,
  acknowledgeAlert,
  resolveAlert,
  reopenAlert,
} from "@/lib/api";
import { DEMO_MODE_STORAGE_KEY, DEMO_REFRESH_INTERVAL } from "./DemoModeToggle";
import ThemeToggle from "./ThemeToggle";
import { alertOfflineQueue, type ReplayExecutor } from "@/lib/offlineQueue";

type ConnectivityState = "info" | "warning" | "inactive";
type SafetyState = "active" | "warning" | "critical" | "inactive";

interface TopBarProps {
  onMenuClick?: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const userId = user?.id;
  
  const [connectivityStatus, setConnectivityStatus] = useState<ConnectivityState>("info");
  const [connectivityLabel, setConnectivityLabel] = useState("Online");
  const [lastUpdateLabel, setLastUpdateLabel] = useState("0m ago");
  const [safetyStatus, setSafetyStatus] = useState<SafetyState>("active");
  const [safetyLabel, setSafetyLabel] = useState("Normal");
  
  const [userRefreshInterval, setUserRefreshInterval] = useState(10000);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [syncState, setSyncState] = useState(() => alertOfflineQueue.getState());
  const replayExecutorRef = useRef<ReplayExecutor | null>(null);

  const refreshInterval = isDemoMode ? DEMO_REFRESH_INTERVAL : userRefreshInterval;

  const checkSystemStatus = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setConnectivityStatus("inactive");
        setConnectivityLabel("Offline");
        setLastUpdateLabel("No data");
        setSafetyStatus("inactive");
        setSafetyLabel("Status: Unknown");
        return;
      }

      // Parallel fetch for health and sensors
      const [healthRes, sensors] = await Promise.all([
        fetchHealth().catch(() => ({ status: "error" })),
        fetchSensors().catch(() => [] as Sensor[])
      ]);

      const healthOk = healthRes.status === "ok";

      // 1. Determine Connectivity Status
      if (!healthOk) {
        setConnectivityStatus("inactive");
        setConnectivityLabel("Offline (API Error)");
        setLastUpdateLabel("No data");
      } else {
        // Fetch readings for all sensors to find last data timestamp
        // Use 2 hours window to cover Offline threshold (60m)
        const readingsPromises = sensors.map(s => 
          fetchReadings(s.id, 2).catch(() => [])
        );
        const results = await Promise.all(readingsPromises);
        
        let lastDataTime = 0;
        results.forEach(readings => {
          if (readings.length > 0) {
            // API returns desc order, so [0] is latest
            const latest = new Date(readings[0].timestamp).getTime();
            if (latest > lastDataTime) lastDataTime = latest;
          }
        });

        if (lastDataTime === 0) {
          setConnectivityStatus("inactive");
          setConnectivityLabel("Offline");
          setLastUpdateLabel("No data");
        } else {
          const diffMinutes = Math.floor((Date.now() - lastDataTime) / 60000);
          const timeText = `${diffMinutes}m ago`;
          
          setLastUpdateLabel(`Updated: ${timeText}`);
          
          if (diffMinutes < 15) {
            setConnectivityStatus("info"); // Blue
            setConnectivityLabel("Online");
          } else if (diffMinutes < 60) {
            setConnectivityStatus("warning"); // Yellow
            setConnectivityLabel("Stale");
          } else {
            setConnectivityStatus("inactive"); // Gray
            setConnectivityLabel("Offline");
          }
        }
      }

      // 2. Determine Safety Status (Worst-case precedence)
      // critical > warning > normal > unknown
      let worstState = "unknown";
      
      if (sensors.length > 0) {
        const states = sensors.map(s => s.current_state?.toLowerCase() || "unknown");
        
        if (states.includes("critical")) {
          worstState = "critical";
        } else if (states.includes("warning")) {
          worstState = "warning";
        } else if (states.includes("normal")) {
          worstState = "normal";
        } else {
          worstState = "unknown";
        }
      } else {
        worstState = "unknown";
      }

      switch (worstState) {
        case "critical":
          setSafetyStatus("critical");
          setSafetyLabel("Status: Critical");
          break;
        case "warning":
          setSafetyStatus("warning");
          setSafetyLabel("Status: Warning");
          break;
        case "normal":
          setSafetyStatus("active");
          setSafetyLabel("Status: Normal");
          break;
        default:
          setSafetyStatus("inactive");
          setSafetyLabel("Status: Unknown");
      }

    } catch (e) {
      console.error("System status check failed", e);
      setConnectivityStatus("inactive");
      setConnectivityLabel("Offline (Error)");
      setLastUpdateLabel("No data");
      setSafetyStatus("inactive");
      setSafetyLabel("Status: ?");
    }
  };

  useEffect(() => {
    let mounted = true;

    const unsubscribe = alertOfflineQueue.subscribe(() => {
      if (!mounted) return;
      setSyncState(alertOfflineQueue.getState());
    });

    void alertOfflineQueue.init().catch(() => {});

    const checkDemoMode = () => {
      const enabled = localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
      setIsDemoMode(enabled);
    };

    checkDemoMode();
    const handleDemoChange = () => checkDemoMode();
    window.addEventListener("demo-mode-changed", handleDemoChange);
    
    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener("demo-mode-changed", handleDemoChange);
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let stopAuto: (() => void) | null = null;

    const executor: ReplayExecutor = async (item) => {
      const token = await getToken().catch(() => null);
      const alertId = item.payload.alertId;

      switch (item.actionType) {
        case "acknowledge":
          await acknowledgeAlert(alertId, token);
          return;
        case "resolve":
          if ("resolution_note" in item.payload) {
            await resolveAlert(alertId, { resolution_note: item.payload.resolution_note ?? null }, token);
          } else {
            await resolveAlert(alertId, undefined, token);
          }
          return;
        case "reopen":
          await reopenAlert(alertId, token);
          return;
      }
    };

    replayExecutorRef.current = executor;

    (async () => {
      await alertOfflineQueue.init().catch(() => {});
      if (stopped) return;
      await alertOfflineQueue.replay(executor).catch(() => {});
      if (stopped) return;
      stopAuto = alertOfflineQueue.startAutoReplay(executor, 20000);
    })();

    return () => {
      stopped = true;
      stopAuto?.();
    };
  }, [getToken]);

  useEffect(() => {
    checkSystemStatus();

    const interval = setInterval(() => {
      checkSystemStatus();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    fetchSettings(userId)
      .then((settings) => {
        setUserRefreshInterval(settings.refresh_interval_seconds * 1000);
      })
      .catch(() => {});
  }, [userId]);

  const syncStatus: ConnectivityState = !syncState.isOnline
    ? "inactive"
    : syncState.pendingCount > 0
      ? "warning"
      : "info";
  const syncLabel = !syncState.isOnline
    ? `Queue: ${syncState.pendingCount}`
    : syncState.isReplaying
      ? `Syncing: ${syncState.pendingCount}`
      : `Queue: ${syncState.pendingCount}`;

  const connectivityLabelMobile = connectivityLabel;
  
  const safetyLabelMobile = safetyLabel;

  const syncLabelMobile = !syncState.isOnline
    ? `Q: ${syncState.pendingCount}`
    : syncState.isReplaying
      ? `Sync: ${syncState.pendingCount}`
      : `Q: ${syncState.pendingCount}`;

  const triggerReplay = () => {
    const executor = replayExecutorRef.current;
    if (!executor) return;
    void alertOfflineQueue.replay(executor);
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between px-4 md:px-8 backdrop-blur-md bg-white/40 border-b border-white/50 transition-all duration-300">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-white/60 hover:text-slate-700 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="mr-2 hidden md:flex gap-2 items-center">
          <StatusChip 
            status={connectivityStatus} 
            label={`Connection: ${connectivityLabel}`} 
            size="sm" 
            title={`Status Koneksi:\n• Online: data diterima < 15 menit lalu\n• Stale: data diterima 15-60 menit lalu\n• Offline: tidak ada data > 60 menit`}
          />
          <StatusChip 
            status="inactive"
            label={lastUpdateLabel} 
            size="sm" 
          />
          <StatusChip 
            status={safetyStatus} 
            label={safetyLabel} 
            size="sm" 
            title={`Status Keamanan (paling buruk):\n• Normal: semua sensor aman\n• Warning: minimal 1 sensor berstatus Warning\n• Critical: minimal 1 sensor berstatus Critical`}
          />
          <button 
            onClick={triggerReplay} 
            type="button" 
            title={`Queue Sinkronisasi:\n• Aksi (Ack/Resolve) disimpan saat offline\n• Klik untuk coba kirim ulang`}
          >
            <StatusChip status={syncStatus} label={syncLabel} size="sm" />
          </button>
          
          <LegendDropdown />
        </div>

        <div className="mr-2 flex md:hidden gap-2 items-center">
          <StatusChip 
            status={connectivityStatus} 
            label={connectivityLabelMobile} 
            size="sm" 
            title="Status Koneksi"
          />
          <StatusChip
            status={safetyStatus}
            label={safetyLabelMobile}
            size="sm"
            title="Status Keamanan"
          />
          <button 
            onClick={triggerReplay} 
            type="button" 
            title="Queue Sinkronisasi"
          >
            <StatusChip status={syncStatus} label={syncLabelMobile} size="sm" />
          </button>
          <LegendDropdown />
        </div>

        <div className="hidden md:block">
          <ThemeToggle />
        </div>

        <NotificationDropdown />
        
        <Link 
          href="/help"
          className="p-2 md:p-2.5 rounded-xl text-slate-500 hover:bg-white/60 hover:text-cyan-600 hover:shadow-sm transition-all duration-200 hidden sm:block"
        >
          <HelpCircle size={20} />
        </Link>

        <Link 
          href="/settings"
          className="p-2 md:p-2.5 rounded-xl text-slate-500 hover:bg-white/60 hover:text-cyan-600 hover:shadow-sm transition-all duration-200"
        >
          <Settings size={20} />
        </Link>

        <div className="pl-2 border-l border-slate-200 ml-2 flex items-center">
          <SignedIn>
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 md:h-9 md:w-9 ring-2 ring-white shadow-sm"
                }
              }}
            />
          </SignedIn>
          <SignedOut>
            <Link 
              href="/login" 
              className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
