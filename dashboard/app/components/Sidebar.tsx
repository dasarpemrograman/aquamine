"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { 
  LayoutDashboard, 
  BarChart3,
  LineChart, 
  Bell, 
  Users, 
  Camera, 
  MessageSquare,
  Shield,
  ChevronLeft,
  ChevronRight,
  X,
  Map
} from "lucide-react";
const classNames = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/forecast', label: 'Forecast', icon: LineChart },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/recipients', label: 'Recipients', icon: Users },
  { href: '/cv', label: 'CV Analysis', icon: Camera },
  { href: '/chat', label: 'AI Assistant', icon: MessageSquare },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

export default function Sidebar({ 
  collapsed, 
  setCollapsed, 
  mobileOpen, 
  setMobileOpen 
}: SidebarProps) {
  const pathname = usePathname();
  const { user, isLoaded, isSignedIn } = useUser();

  const finalNavItems = [...navItems];
  if (user?.publicMetadata?.role === 'superadmin') {
    finalNavItems.push({ href: '/admin/users', label: 'Admin', icon: Shield });
  }

  const sidebarWidthClass = collapsed ? "md:w-[70px]" : "md:w-72";

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={classNames(
          "fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity duration-300 backdrop-blur-sm",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar Aside */}
      <aside
        className={classNames(
          "fixed left-0 top-0 h-full z-50 flex flex-col border-r border-slate-200 md:border-white/75 bg-white md:bg-white/80 md:backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out",
          // Mobile transform & width
          "w-72", 
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop transform & width
          "md:translate-x-0",
          sidebarWidthClass
        )}
      >
        {/* Header / Logo */}
        <div className={classNames(
          "h-20 flex items-center border-b border-white/50 transition-all duration-300",
          collapsed ? "px-0 justify-center" : "px-8 justify-between"
        )}>
          <Link href="/" className="flex items-center gap-3 group overflow-hidden">
            <div className="w-8 h-8 min-w-[32px] rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20 flex items-center justify-center text-white font-bold text-lg">
              A
            </div>
            <span className={classNames(
              "font-bold text-xl tracking-tight text-slate-800 group-hover:text-blue-600 transition-all duration-300 whitespace-nowrap",
              collapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto"
            )}>
              AquaMine
            </span>
          </Link>

          {/* Mobile Close Button */}
          <button 
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Desktop Toggle Button - Absolute positioned on border */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-24 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-500 hover:text-cyan-600 hover:border-cyan-200 shadow-sm transition-all z-50"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
          {finalNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)} // Close on navigate (mobile)
                className={classNames(
                  "relative flex items-center rounded-xl transition-all duration-300 group",
                  collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3.5",
                  isActive 
                    ? 'bg-cyan-50 text-cyan-900 font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <div className={classNames(
                    "absolute top-1/2 -translate-y-1/2 bg-cyan-500 rounded-r-full shadow-[0_0_8px_rgba(6,182,212,0.4)] transition-all",
                    collapsed ? "left-0 h-1.5 w-1.5 rounded-full" : "left-0 h-8 w-1"
                  )} />
                )}
                
                <Icon 
                  size={22} 
                  className={classNames(
                    "transition-colors duration-300 min-w-[22px]",
                    isActive ? 'text-cyan-600' : 'text-slate-400 group-hover:text-slate-600'
                  )} 
                />
                
                <span className={classNames(
                  "text-[15px] tracking-wide whitespace-nowrap transition-all duration-300",
                  collapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto"
                )}>
                  {item.label}
                </span>

                {/* Desktop Hover Tooltip for Collapsed State */}
                {collapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl">
                    {item.label}
                    {/* Tiny triangle pointer */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 w-2 h-2 bg-slate-800 rotate-45" />
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className={classNames(
          "m-4 rounded-2xl bg-white/40 border border-white/60 shadow-sm backdrop-blur-xl transition-all duration-300 overflow-hidden",
          collapsed ? "p-2" : "p-4"
        )}>
          {!isLoaded ? (
            <div className={classNames("flex items-center animate-pulse", collapsed ? "justify-center" : "gap-3")}>
              <div className="w-8 h-8 rounded-full bg-slate-200 min-w-[32px]" />
              {!collapsed && (
                <div className="flex flex-col gap-2 flex-1">
                  <div className="w-20 h-3 rounded bg-slate-200" />
                  <div className="w-16 h-2 rounded bg-slate-200" />
                </div>
              )}
            </div>
          ) : isSignedIn && user ? (
            <div className={classNames("flex items-center", collapsed ? "justify-center" : "gap-3")}>
              <div className="w-9 h-9 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden min-w-[36px]">
                <img 
                  src={user.imageUrl} 
                  alt={user.fullName || "User"}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className={classNames(
                "flex flex-col overflow-hidden transition-all duration-300",
                collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
              )}>
                <span className="text-sm font-semibold text-slate-800 truncate block max-w-[140px]">
                  {user.fullName || user.username || "User"}
                </span>
                <span className="text-xs text-slate-500 truncate block max-w-[140px]">
                  {user.primaryEmailAddress?.emailAddress}
                </span>
              </div>
            </div>
          ) : (
            <Link href="/login" className={classNames(
              "flex items-center cursor-pointer hover:opacity-80 transition-opacity group/login",
              collapsed ? "justify-center" : "gap-3"
            )}>
              <div className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-400 group-hover/login:bg-slate-200 group-hover/login:text-slate-600 transition-colors min-w-[36px]">
                <Users size={18} />
              </div>
              <div className={classNames(
                "flex flex-col transition-all duration-300",
                collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
              )}>
                <span className="text-sm font-semibold text-slate-800">Guest User</span>
                <span className="text-xs text-cyan-600 font-medium">Sign in</span>
              </div>
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-white/90 backdrop-blur-xl border-t border-slate-200/60 flex justify-around items-center z-40 md:hidden px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
        {[
          { href: '/', label: 'Beranda', icon: LayoutDashboard },
          { href: '/map', label: 'Peta', icon: Map },
          { href: '/alerts', label: 'Alert', icon: Bell },
          { href: '/chat', label: 'Chat', icon: MessageSquare },
        ].map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                "relative flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform",
                isActive ? "text-cyan-600" : "text-slate-400"
              )}
            >
              <div className={classNames(
                "p-1.5 rounded-2xl transition-all duration-300",
                isActive ? "bg-cyan-50 shadow-[0_0_12px_rgba(6,182,212,0.2)] translate-y-[-2px]" : "bg-transparent"
              )}>
                <Icon 
                  size={24} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className={isActive ? "text-cyan-600" : "text-slate-400"}
                />
              </div>
              <span className={classNames(
                "text-[10px] font-medium tracking-wide transition-colors duration-300",
                isActive ? "text-cyan-700" : "text-slate-500"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
