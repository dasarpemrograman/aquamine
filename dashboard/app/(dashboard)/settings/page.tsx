"use client";

import { useEffect, useState } from "react";
import { Settings, Bell, Clock, RefreshCw, Check, AlertCircle, Globe } from "lucide-react";
import { useUser } from "@clerk/nextjs";

import { GlassPanel } from "@/app/components/ui/GlassPanel";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { fetchSettings, updateSettings, UserSettings, UserSettingsUpdate } from "@/lib/api";

export default function SettingsPage() {
  const { user } = useUser();
  const userId = user?.id || "anonymous";
  
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [formData, setFormData] = useState<UserSettingsUpdate>({});

  useEffect(() => {
    if (userId) {
      loadSettings();
    }
  }, [userId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await fetchSettings(userId);
      setSettings(data);
      
      setFormData({
        notifications_enabled: data.notifications_enabled,
        notify_critical: data.notify_critical,
        notify_warning: data.notify_warning,
        notify_info: data.notify_info,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end,
        timezone: data.timezone,
        refresh_interval_seconds: data.refresh_interval_seconds,
      });
    } catch (err) {
      console.error("Error loading settings:", err);
      showToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    if (formData.refresh_interval_seconds !== undefined) {
      if (formData.refresh_interval_seconds < 5 || formData.refresh_interval_seconds > 60) {
        showToast("Refresh interval must be between 5 and 60 seconds", "error");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { ...formData };
      if (!payload.timezone) {
        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
      
      const updated = await updateSettings(userId, payload);
      setSettings(updated);
      showToast("Settings saved successfully", "success");
    } catch (err) {
      console.error("Error saving settings:", err);
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (field: keyof UserSettingsUpdate) => {
    setFormData(prev => ({
      ...prev,
      [field]: !(prev[field] as boolean)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <SectionHeader
          title="Settings"
          subtitle="Manage your notification preferences and dashboard settings"
          icon={Settings}
        />

        {toast && (
          <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 text-white transition-opacity ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {toast.message}
          </div>
        )}

        <div className="space-y-6">
          <GlassPanel>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100/50 rounded-lg">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Notifications</h2>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-white/40 rounded-xl hover:bg-white/60 transition-colors cursor-pointer">
                <div>
                  <p className="font-medium text-slate-800">Enable Notifications</p>
                  <p className="text-sm text-slate-500">Receive alerts and updates</p>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notifications_enabled ?? true}
                    onChange={() => handleToggle('notifications_enabled')}
                    className="peer h-6 w-6 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-blue-500 checked:bg-blue-500"
                  />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                    <Check size={16} strokeWidth={3} />
                  </div>
                </div>
              </label>

              <div className="pl-4 space-y-3">
                <label className="flex items-center justify-between p-3 bg-white/30 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                  <span className="text-slate-700">Critical Alerts</span>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.notify_critical ?? true}
                      onChange={() => handleToggle('notify_critical')}
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-red-500 checked:bg-red-500"
                    />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between p-3 bg-white/30 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                  <span className="text-slate-700">Warning Alerts</span>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.notify_warning ?? true}
                      onChange={() => handleToggle('notify_warning')}
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-yellow-500 checked:bg-yellow-500"
                    />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between p-3 bg-white/30 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                  <span className="text-slate-700">Info Alerts</span>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.notify_info ?? false}
                      onChange={() => handleToggle('notify_info')}
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-blue-500 checked:bg-blue-500"
                    />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100/50 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Quiet Hours</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.quiet_hours_start || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, quiet_hours_start: e.target.value || null }))}
                  className="w-full px-4 py-2.5 bg-white/50 border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.quiet_hours_end || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, quiet_hours_end: e.target.value || null }))}
                  className="w-full px-4 py-2.5 bg-white/50 border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              During quiet hours, notification badges will be suppressed.
            </p>
          </GlassPanel>

          <GlassPanel>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100/50 rounded-lg">
                <RefreshCw className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Refresh Interval (seconds)
                </label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={formData.refresh_interval_seconds || 10}
                  onChange={(e) => setFormData(prev => ({ ...prev, refresh_interval_seconds: parseInt(e.target.value) || 10 }))}
                  className="w-full max-w-xs px-4 py-2.5 bg-white/50 border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                />
                <p className="mt-1 text-sm text-slate-500">
                  How often to refresh data (5-60 seconds)
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white/40 rounded-xl">
                <Globe className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-800">Timezone</p>
                  <p className="text-sm text-slate-500">
                    {formData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                </div>
              </div>
            </div>
          </GlassPanel>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
