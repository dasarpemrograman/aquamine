export const SEVERITY_LABELS: Record<string, string> = {
  normal: "Normal",
  warning: "Waspada",
  critical: "Kritis",
  unknown: "Tidak Diketahui",
  offline: "Offline",
  info: "Info",
  active: "Aktif",
};

export const STALE_REASONS: Record<string, string> = {
  newer_reading_exists: "Data sensor terbaru tersedia",
  insufficient_history: "Riwayat data tidak cukup",
  model_not_ready: "Model belum siap",
  forecast_outdated: "Prediksi kadaluarsa",
};

export const UI_COPY = {
  // Dashboard
  system_overview: "Ikhtisar Sistem",
  system_subtitle: "Pemantauan AMD real-time dan analisis lingkungan",
  sensor_availability: "Ketersediaan Sensor",
  all_online: "Semua Online",
  partial: "Parsial",
  offline: "Offline",
  active_sensors: "Sensor Aktif",
  current_status: "Status Saat Ini",
  last_update: "Terakhir Diperbarui",
  field_map: "Peta Lapangan",
  tap_expand: "Ketuk untuk memperbesar",
  priority_alerts: "Peringatan Prioritas",
  view_all: "Lihat Semua",
  visual_analysis: "Analisis Visual",
  check_water_quality: "Cek kualitas air",
  sensor_fleet_status: "Status Armada Sensor",
  no_sensors_connected: "Tidak ada sensor terhubung",
  normal_short: "Normal",
  warn_short: "Waspada",
  crit_short: "Kritis",
  minutes_ago: "{minutes}m yang lalu",
  view_details: "Lihat detail",
  
  no_insights: "Tidak ada wawasan tersedia",
  
  // Forecast
  forecast_title: "Prediksi & Analisis",
  forecast_subtitle: "Prediksi 7-hari dan konteks anomali",
  live_feed_active: "Live Feed Aktif",
  connecting: "Menghubungkan...",
  sensor_status: "Status Sensor",
  recent_alerts: "Peringatan Terkini",
  range_24h: "24 Jam",
  range_7d: "7 Hari",
  range_30d: "30 Hari",
  forecast_range_label: "Rentang",
  forecast_points: "titik",
  based_on_history: "Berdasarkan: {hours} jam data sensor",
  last_reading: "Pembacaan Terakhir",
  forecast_start: "Mulai Prediksi",
  analysis: "Analisis",
  predicted_ph: "Prediksi pH",
  confidence: "Kepercayaan",
  start: "Mulai",
  now: "Sekarang",
  stale: "Kadaluarsa",
  no_forecast: "Prediksi tidak tersedia",
  loading_forecast: "Memuat prediksi...",
  
  // Alerts
  alert_history: "Riwayat Peringatan",
  alert_subtitle: "Pantau dan kelola kejadian sistem kritis",
  no_alerts_title: "Tidak ada peringatan {status}",
  system_normal: "Sistem berjalan normal.",
  acknowledge: "Tandai Dibaca",
  resolve: "Selesaikan",
  map: "Peta",
  collapse: "Tutup",
  expand_history: "Lihat Riwayat",
  all_severities: "Semua Tingkat",
  last_24h: "24 Jam Terakhir",
  last_7d: "7 Hari Terakhir",
  last_30d: "30 Hari Terakhir",
  tab_active: "Aktif",
  tab_acknowledged: "Dibaca",
  tab_resolved: "Selesai",
  similar_alerts: "+{count} alert serupa",
  similar_alerts_tooltip: "Menandakan ada {count} alert serupa (sensor & tipe sama) yang dikelompokkan. Klik 'Lihat Riwayat' untuk melihat detail.",
  saving: "Menyimpan...",
  
  // Analytics
  analytics_title: "Analitik",
  analytics_subtitle: "Kesehatan sistem, metrik kepatuhan, dan wawasan AI",
  system_health: "Kesehatan Sistem",
  degraded: "Terdegradasi",
  healthy: "Sehat",
  online_sensors: "{active} dari {total} sensor online",
  alerts_24h: "Peringatan (24j)",
  water_quality: "Kualitas Air",
  compliance_24h: "Kepatuhan {percent}% (24j)",
  data_points: "Titik Data",
  recorded_in_last: "Terekam dalam {period} terakhir",
  water_quality_trends: "Tren Kualitas Air",
  compliance_standards: "Standar Kepatuhan",
  compliant: "Patuh",
  violations: "{count} pelanggaran",
  ai_insights: "Wawasan AI",
  key_findings: "Temuan Utama",
  summary: "Ringkas",
  facts: "Fakta",
  action_checklist: "Checklist Tindakan",
  source: "Sumber",
  refresh_forecast: "Segarkan Prediksi",
  turbidity: "Kekeruhan",
  temperature: "Suhu",
  
  // General
  loading: "Memuat...",
  retry: "Coba Lagi",
  updated: "Diperbarui",
  max: "Maks",
  standard: "Standar",
};

export function getSeverityLabel(severity: string | null | undefined): string {
  if (!severity) return SEVERITY_LABELS.unknown;
  const key = severity.toLowerCase();
  return SEVERITY_LABELS[key] || severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function getStaleReason(reason: string | null | undefined): string {
  if (!reason) return "";
  const key = reason.toLowerCase();
  return STALE_REASONS[key] || reason.replace(/_/g, " ");
}

export function formatString(template: string, values: Record<string, string | number>): string {
  return template.replace(/{(\w+)}/g, (match, key) => {
    return typeof values[key] !== 'undefined' ? String(values[key]) : match;
  });
}
