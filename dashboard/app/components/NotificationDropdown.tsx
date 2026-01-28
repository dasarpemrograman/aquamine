"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, AlertTriangle, AlertOctagon, Info, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { fetchAlerts, acknowledgeAlert, fetchSettings, updateSettings, Alert, UserSettings } from "@/lib/api";

interface NotificationDropdownProps {
  onCountChange?: (count: { unread: number; new: number }) => void;
}

export default function NotificationDropdown({ onCountChange }: NotificationDropdownProps) {
  const { user } = useUser();
  const userId = user?.id || "anonymous";
  
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = alerts.filter(a => !a.acknowledged_at).length;
  const lastSeenMs = settings?.last_notification_seen_at
    ? Date.parse(settings.last_notification_seen_at)
    : NaN;
  const newCount = Number.isFinite(lastSeenMs)
    ? alerts.filter(a => Date.parse(a.created_at) > lastSeenMs).length
    : alerts.length;

  const isQuietHours = () => {
    if (!settings?.quiet_hours_start || !settings?.quiet_hours_end) return false;
    
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const start = settings.quiet_hours_start;
    const end = settings.quiet_hours_end;
    
    if (start < end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  };

  useEffect(() => {
    onCountChange?.({ unread: unreadCount, new: newCount });
  }, [unreadCount, newCount, onCountChange]);

  const refreshMs = (settings?.refresh_interval_seconds ?? 10) * 1000;

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, refreshMs);

    return () => clearInterval(interval);
  }, [userId, refreshMs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      const [alertsData, settingsData] = await Promise.all([
        fetchAlerts(),
        fetchSettings(userId)
      ]);
      setAlerts(alertsData);
      setSettings(settingsData);
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  };

  const handleOpen = async () => {
    setIsOpen(true);
    setLoading(true);
    
    try {
      await updateSettings(userId, {
        last_notification_seen_at: new Date().toISOString()
      });
      
      const updatedSettings = await fetchSettings(userId);
      setSettings(updatedSettings);
    } catch (err) {
      console.error("Error updating last seen:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadAlerts = alerts.filter(a => !a.acknowledged_at);
    
    try {
      await Promise.all(unreadAlerts.map(alert => acknowledgeAlert(alert.id)));
      await loadData();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleMarkRead = async (alertId: number) => {
    try {
      await acknowledgeAlert(alertId);
      await loadData();
    } catch (err) {
      console.error("Error marking alert as read:", err);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return <AlertOctagon className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (!settings?.notifications_enabled) return false;
    
    switch (alert.severity.toLowerCase()) {
      case 'critical':
        return settings.notify_critical;
      case 'warning':
        return settings.notify_warning;
      default:
        return settings.notify_info;
    }
  });

  const showNewBadge = newCount > 0 && !isQuietHours();

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => isOpen ? setIsOpen(false) : handleOpen()}
        className="relative p-2.5 rounded-xl text-slate-500 hover:bg-white/60 hover:text-cyan-600 hover:shadow-sm transition-all duration-200 group"
      >
        <Bell size={20} />
        {showNewBadge && (
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-xs font-medium text-white bg-rose-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto bg-slate-50/50">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Bell className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div>
                {filteredAlerts.slice(0, 10).map((alert, index) => (
                  <div
                    key={alert.id}
                    className={`px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors ${
                      !alert.acknowledged_at 
                        ? 'bg-white hover:bg-slate-50' 
                        : 'bg-slate-50/50 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-1.5 rounded-lg ${
                        alert.severity.toLowerCase() === 'critical' ? 'bg-red-100' :
                        alert.severity.toLowerCase() === 'warning' ? 'bg-amber-100' :
                        'bg-blue-100'
                      }`}>
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getSeverityBadgeClass(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          {!alert.acknowledged_at && (
                            <span className="w-2 h-2 rounded-full bg-blue-500" title="Unread" />
                          )}
                        </div>
                        <p className={`text-sm mt-1 line-clamp-2 ${
                          !alert.acknowledged_at ? 'text-slate-900 font-medium' : 'text-slate-600'
                        }`}>
                          {alert.message || `Alert for sensor ${alert.sensor_id}`}
                        </p>
                        <p className="text-xs text-slate-400 mt-1.5">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!alert.acknowledged_at && (
                        <button
                          onClick={() => handleMarkRead(alert.id)}
                          className="mt-0.5 p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                          title="Mark as read"
                        >
                          <Check size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-100 bg-white">
            <Link
              href="/alerts"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 py-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              View all alerts
              <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
