"use client";

import ForecastChart from "@/app/components/ForecastChart";
import AlertList from "@/app/components/AlertList";

const MOCK_CHART_DATA = [
  { timestamp: "2026-01-29T08:00:00Z", ph: 6.9 },
  { timestamp: "2026-01-29T09:00:00Z", ph: 6.8 },
  { timestamp: "2026-01-29T10:00:00Z", ph: 6.85 },
  { timestamp: "2026-01-29T11:00:00Z", ph: 6.7 },
  { timestamp: "2026-01-29T12:00:00Z", ph: 6.75 },
  { timestamp: "2026-01-29T13:00:00Z", ph: 6.8 },
  { timestamp: "2026-01-29T14:00:00Z", ph: 6.65 },
  { timestamp: "2026-01-29T15:00:00Z", ph: 6.6 },
  { timestamp: "2026-01-30T10:00:00Z", ph_forecast: 6.5, ph_lower: 6.2, ph_upper: 6.8 },
  { timestamp: "2026-01-31T10:00:00Z", ph_forecast: 6.4, ph_lower: 6.1, ph_upper: 6.7 },
  { timestamp: "2026-02-01T10:00:00Z", ph_forecast: 6.3, ph_lower: 6.0, ph_upper: 6.6 },
  { timestamp: "2026-02-02T10:00:00Z", ph_forecast: 6.2, ph_lower: 5.9, ph_upper: 6.5 },
  { timestamp: "2026-02-03T10:00:00Z", ph_forecast: 6.1, ph_lower: 5.8, ph_upper: 6.4 },
  { timestamp: "2026-02-04T10:00:00Z", ph_forecast: 6.0, ph_lower: 5.7, ph_upper: 6.3 },
  { timestamp: "2026-02-05T10:00:00Z", ph_forecast: 5.9, ph_lower: 5.6, ph_upper: 6.2 },
];

const MOCK_ALERT_STATES = {
  "sensor-1": "normal",
  "sensor-2": "warning",
  "sensor-3": "critical",
};

export default function ForecastPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Water Quality Forecast
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ForecastChart data={MOCK_CHART_DATA} />
          </div>

          <div className="lg:col-span-1">
            <AlertList alertStates={MOCK_ALERT_STATES} />
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Chart shows historical pH values (solid line) and 7-day forecast (dashed line) 
          with 90% confidence interval (shaded area).
        </p>
      </div>
    </div>
  );
}
