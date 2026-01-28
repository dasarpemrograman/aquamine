"use client";

import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { useState } from "react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? "pl-16" : "pl-64"}`}
      >
        <TopBar />
        <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
