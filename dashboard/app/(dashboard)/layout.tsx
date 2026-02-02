import Sidebar from "@/app/components/Sidebar";
import TopBar from "@/app/components/TopBar";
import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300 relative h-full">
        <div className="flex-none">
          <TopBar />
        </div>
        
        <main className="flex-1 w-full min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
