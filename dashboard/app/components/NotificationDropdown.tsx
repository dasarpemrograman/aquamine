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
  const newCount = settings?.last_notification_seen_at 
    ? alerts.filter(a => new Date(a.created_at) > new Date(settings.last_notification_seen_at!)).length
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

  useEffect(() => {
    loadData();
    
    const interval = setInterval(() => {
      loadData();
    }, (settings?.refresh_interval_seconds || 10) * 1000);
    
    return () => clearInterval(interval);
  }, [userId, settings?.refresh_interval_seconds]);

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
        return <AlertOctagon className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'border-l-red-500 bg-red-50/30';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50/30';
      default:
        return 'border-l-blue-500 bg-blue-50/30';
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
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] glass rounded-2xl shadow-xl border border-white/40 z-50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/20">
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X size={16} className="text-slate-500" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <Bell className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-white/20">
                {filteredAlerts.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 hover:bg-white/40 transition-colors border-l-4 ${getSeverityClass(alert.severity)} ${
                      !alert.acknowledged_at ? 'bg-white/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium uppercase ${
                            alert.severity.toLowerCase() === 'critical' ? 'text-red-600' :
                            alert.severity.toLowerCase() === 'warning' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`}>
                            {alert.severity}
                          </span>
                          {!alert.acknowledged_at && (
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="text-sm text-slate-700 mt-1 line-clamp-2">
                          {alert.message || `Alert for sensor ${alert.sensor_id}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!alert.acknowledged_at && (
                        <button
                          onClick={() => handleMarkRead(alert.id)}
                          className="p-1.5 hover:bg-white/60 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
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

          <div className="p-3 border-t border-white/20 bg-white/30">
            <Link
              href="/alerts"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-white/40 rounded-xl transition-colors"
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
