"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { ShieldAlert, Waves, LogOut } from "lucide-react";

export default function AccessPendingPage() {
  const { user } = useUser();

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-orange-400/20 rounded-full blur-[80px] pointer-events-none mix-blend-overlay" />

      <div className="w-full max-w-md relative z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700 slide-in-from-bottom-4">
        
        <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4 group transform transition-all hover:scale-105">
                <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
                Access Pending
            </h1>
            <p className="text-slate-500 font-medium">
                Hold tight, we're reviewing your account
            </p>
        </div>

        <div className="w-full bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-1 sm:p-2">
             <div className="bg-white/50 rounded-[20px] p-6 sm:p-8 space-y-6 text-center">
                <div className="space-y-2">
                    <p className="text-slate-700 font-medium">
                        Hello, <span className="text-slate-900 font-bold">{user?.firstName || 'User'}</span>
                    </p>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Your account has been created but requires administrator approval before you can access the dashboard.
                    </p>
                </div>
                
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-sm font-medium flex items-center gap-3 text-left">
                    <div className="min-w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Status: Awaiting Approval
                </div>

                <div className="pt-2">
                    <SignOutButton>
                        <button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300">
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    </SignOutButton>
                </div>
             </div>
        </div>
        
        <div className="flex gap-6 text-sm text-slate-400 font-medium">
            <span className="flex items-center gap-2">
                <Waves size={16} />
                AquaMine AI
            </span>
        </div>
      </div>
    </div>
  );
}
