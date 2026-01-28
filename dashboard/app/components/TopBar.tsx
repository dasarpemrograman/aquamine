"use client";

import { Search, Bell, User } from "lucide-react";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between px-6 lg:px-10 bg-background/80 backdrop-blur-md border-b border-white/5 transition-all">
      <div className="hidden md:flex items-center flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
          <input 
            type="text" 
            placeholder="Search analytics, sensors, or alerts..." 
            className="w-full bg-surface border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="md:hidden">
        <span className="font-bold text-lg text-foreground">Dashboard</span>
      </div>

      <div className="flex items-center space-x-4">
        <button className="relative p-2.5 rounded-xl text-foreground-muted hover:bg-surface hover:text-primary transition-all group">
          <Bell className="w-6 h-6" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-danger rounded-full ring-2 ring-background animate-pulse"></span>
        </button>
        
        <div className="flex items-center pl-4 border-l border-white/10">
          <div className="flex flex-col items-end mr-3 hidden sm:flex">
            <span className="text-sm font-bold text-foreground">Admin User</span>
            <span className="text-xs text-foreground-muted">System Operator</span>
          </div>
          <button className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-primary overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all">
            <User className="w-6 h-6" />
          </button>
        </div>
      </div>
    </header>
  );
}
