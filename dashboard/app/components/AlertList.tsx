"use client";

interface AlertListProps {
  alertStates: Record<string, string>;
}

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  normal: { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
  warning: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
  critical: { bg: "bg-red-100", text: "text-red-800", border: "border-red-200" },
};

export default function AlertList({ alertStates }: AlertListProps) {
  const sensors = Object.entries(alertStates);

  if (sensors.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Alert Status</h3>
        <p className="text-gray-500">No sensors registered yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Alert Status</h3>
      <ul className="space-y-3">
        {sensors.map(([sensorId, state]) => {
          const colors = severityColors[state] || severityColors.normal;
          return (
            <li
              key={sensorId}
              className={`flex items-center justify-between p-3 rounded-lg border ${colors.border} ${colors.bg}`}
            >
              <span className="font-medium text-gray-700">{sensorId}</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold uppercase ${colors.text}`}
              >
                {state}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
