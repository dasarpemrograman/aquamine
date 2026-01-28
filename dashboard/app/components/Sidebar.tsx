"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  LineChart, 
  Bell, 
  Users, 
  Camera, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/forecast', label: 'Forecast', icon: LineChart },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/recipients', label: 'Recipients', icon: Users },
  { href: '/cv', label: 'CV Analysis', icon: Camera },
  { href: '/chat', label: 'AI Assistant', icon: MessageSquare },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 hidden md:flex flex-col border-r border-white/75 bg-white/60 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300
        ${collapsed ? 'w-20' : 'w-72'}
      `}
    >
      <div className={`h-20 flex items-center border-b border-white/50 px-2 ${collapsed ? 'justify-center' : 'justify-between px-8'}`}>
        <Link href="/" className={`flex items-center gap-3 group ${collapsed ? 'justify-center w-full' : ''}`}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20 flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          {!collapsed && (
            <span className="font-bold text-xl tracking-tight text-slate-800 group-hover:text-blue-600 transition-colors">
              AquaMine
            </span>
          )}
        </Link>
        <button
          className="p-1 rounded hover:bg-cyan-100/40 transition-colors ml-2"
          style={{ minWidth: 0, width: 28, height: 28 }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      <nav className={`flex-1 py-8 ${collapsed ? 'px-2' : 'px-4'} space-y-2 overflow-y-auto`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all duration-300 group
                ${isActive 
                  ? 'bg-cyan-50 text-cyan-900 font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-cyan-500 rounded-r-full shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
              )}
              <Icon 
                size={22} 
                className={`
                  transition-colors duration-300
                  ${isActive ? 'text-cyan-600' : 'text-slate-400 group-hover:text-slate-600'}
                `} 
              />
              {!collapsed && <span className="text-[15px] tracking-wide">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`p-4 m-4 rounded-2xl bg-white/40 border border-white/60 shadow-sm backdrop-blur-xl ${collapsed ? 'flex flex-col items-center p-2 m-2' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'flex-col gap-1' : ''}`}>
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
              alt="User"
              className="w-full h-full object-cover"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800">Admin User</span>
              <span className="text-xs text-slate-500">View Profile</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
