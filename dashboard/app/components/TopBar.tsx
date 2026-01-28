"use client";

import { Search, Bell, Settings, HelpCircle, LogIn } from "lucide-react";
import { StatusChip } from "./ui/StatusChip";
import { UserButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between px-8 backdrop-blur-md bg-white/40 border-b border-white/50 transition-all duration-300">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative group w-full max-w-md">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 group-focus-within:text-cyan-600 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="block w-full rounded-xl border border-white/60 bg-white/50 py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 shadow-sm backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/10 transition-all duration-200 hover:bg-white/70"
            placeholder="Search dashboard..."
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="mr-2 hidden md:block">
            <StatusChip status="info" label="System Active" size="sm" />
        </div>

        <button className="relative p-2.5 rounded-xl text-slate-500 hover:bg-white/60 hover:text-cyan-600 hover:shadow-sm transition-all duration-200 group">
          <Bell size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white scale-0 group-hover:scale-100 transition-transform duration-200" />
        </button>
        
        <button className="p-2.5 rounded-xl text-slate-500 hover:bg-white/60 hover:text-cyan-600 hover:shadow-sm transition-all duration-200">
          <HelpCircle size={20} />
        </button>

        <button className="p-2.5 rounded-xl text-slate-500 hover:bg-white/60 hover:text-cyan-600 hover:shadow-sm transition-all duration-200">
          <Settings size={20} />
        </button>

        <div className="pl-2 border-l border-slate-200 ml-2 flex items-center">
          <SignedIn>
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9 ring-2 ring-white shadow-sm"
                }
              }}
            />
          </SignedIn>
          <SignedOut>
            <Link 
              href="/sign-in" 
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </Link>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
