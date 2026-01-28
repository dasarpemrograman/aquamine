import Sidebar from "@/app/components/Sidebar";
import TopBar from "@/app/components/TopBar";
import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 flex flex-col md:ml-72 transition-all duration-300 relative">
        <TopBar />
        
        <main className="flex-1 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
