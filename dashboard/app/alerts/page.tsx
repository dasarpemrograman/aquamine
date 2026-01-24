"use client";

import AlertList from "@/app/components/AlertList";

export default function AlertsPage() {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Alert History</h1>
      <AlertList />
    </div>
  );
}
