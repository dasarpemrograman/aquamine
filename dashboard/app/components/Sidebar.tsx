"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { 
  LayoutDashboard, 
  LineChart, 
  Bell, 
  Users, 
  Camera, 
  MessageSquare,
  Shield
} from "lucide-react";

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/forecast', label: 'Forecast', icon: LineChart },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/recipients', label: 'Recipients', icon: Users },
  { href: '/cv', label: 'CV Analysis', icon: Camera },
  { href: '/chat', label: 'AI Assistant', icon: MessageSquare },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps = {}) {
  const pathname = usePathname();
  const { user, isLoaded, isSignedIn } = useUser();

  const finalNavItems = [...navItems];
  if (user?.publicMetadata?.role === 'superadmin') {
    finalNavItems.push({ href: '/admin/users', label: 'Admin', icon: Shield });
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-72 z-40 hidden md:flex flex-col border-r border-white/75 bg-white/60 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300">
      <div className="h-20 flex items-center px-8 border-b border-white/50">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20 flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800 group-hover:text-blue-600 transition-colors">
            AquaMine
          </span>
        </Link>
      </div>

      <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
        {finalNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group
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
              <span className="text-[15px] tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 m-4 rounded-2xl bg-white/40 border border-white/60 shadow-sm backdrop-blur-xl">
        {!isLoaded ? (
            <div className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-slate-200" />
                <div className="flex flex-col gap-2 flex-1">
                    <div className="w-20 h-3 rounded bg-slate-200" />
                    <div className="w-16 h-2 rounded bg-slate-200" />
                </div>
            </div>
        ) : isSignedIn && user ? (
            <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                <img 
                src={user.imageUrl} 
                alt={user.fullName || "User"}
                className="w-full h-full object-cover"
                />
            </div>
            <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-slate-800 truncate block max-w-[140px]">
                    {user.fullName || user.username || "User"}
                </span>
                <span className="text-xs text-slate-500 truncate block max-w-[140px]">
                    {user.primaryEmailAddress?.emailAddress}
                </span>
            </div>
            </div>
        ) : (
            <Link href="/login" className="flex items-center gap-3 group/login cursor-pointer hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-400 group-hover/login:bg-slate-200 group-hover/login:text-slate-600 transition-colors">
                    <Users size={20} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">Guest User</span>
                    <span className="text-xs text-cyan-600 font-medium">Sign in to access</span>
                </div>
            </Link>
        )}
      </div>
    </aside>
  );
}
