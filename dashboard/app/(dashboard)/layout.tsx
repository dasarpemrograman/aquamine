"use client";

import Sidebar from "@/app/components/Sidebar";
import TopBar from "@/app/components/TopBar";
import React, { useState } from "react";
const classNames = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      
      <div 
        className={classNames(
          "flex-1 flex flex-col transition-all duration-300 ease-in-out relative min-h-screen",
          collapsed ? "md:ml-[70px]" : "md:ml-72"
        )}
      >
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        
        <main className="flex-1 w-full p-4 md:p-8 max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
