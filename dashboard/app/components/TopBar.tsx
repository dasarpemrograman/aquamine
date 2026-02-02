"use client";

import { useEffect, useState } from "react";
import { Settings, HelpCircle, LogIn, Menu } from "lucide-react";
import { StatusChip } from "./ui/StatusChip";
import { UserButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import Link from "next/link";
import NotificationDropdown from "./NotificationDropdown";
import { fetchHealth, fetchSensors, fetchSettings, Sensor } from "@/lib/api";

type SystemStatus = "active" | "warning" | "critical";

interface TopBarProps {
  onMenuClick?: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useUser();
  const userId = user?.id;
  const [status, setStatus] = useState<SystemStatus>("active");
  const [statusLabel, setStatusLabel] = useState("System Active");
  const [refreshInterval, setRefreshInterval] = useState(10000);

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
        setRefreshInterval(settings.refresh_interval_seconds * 1000);
      })
      .catch(() => {});
  }, [userId]);

  const checkSystemStatus = async () => {
    try {
      const healthRes = await fetchHealth();
      const healthOk = healthRes.status === "ok";

      let activeSensors = 0;
      try {
        const sensors: Sensor[] = await fetchSensors();
        activeSensors = sensors.filter((sensor) => sensor.is_active).length;
      } catch {
        activeSensors = 0;
      }

      if (!healthOk) {
        setStatus("critical");
        setStatusLabel("System Offline");
      } else if (activeSensors === 0) {
        setStatus("warning");
        setStatusLabel("No Active Sensors");
      } else {
        setStatus("active");
        setStatusLabel("System Active");
      }
    } catch {
      setStatus("critical");
      setStatusLabel("System Offline");
    }
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
        <div className="mr-2 hidden md:block">
          <StatusChip status={status} label={statusLabel} size="sm" />
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
