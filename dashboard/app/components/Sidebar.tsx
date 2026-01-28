"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  LineChart, 
  Users, 
  Camera, 
  Bot, 
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";


const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Forecast", href: "/forecast", icon: LineChart },
  { name: "Recipients", href: "/recipients", icon: Users },
  { name: "CV Analysis", href: "/cv", icon: Camera },
  { name: "AI Assistant", href: "/chat", icon: Bot },
];


export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-surface border-r border-white/5 flex flex-col z-40 transition-all duration-300
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      <div className={`h-20 flex items-center border-b border-white/5 px-2 sm:px-4`}> 
        <div className={`flex items-center flex-1 ${collapsed ? "justify-center" : "justify-start"}`}>
          <div className={`bg-gradient-to-br from-primary to-primary-glow rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 transition-all duration-300 ${collapsed ? "w-10 h-10 pl-1" : "w-10 h-10"}`}>
            <span className={`text-background font-bold ${collapsed ? "text-xl" : "text-xl"}`}>A</span>
          </div>
          {!collapsed && (
            <span className="ml-3 font-bold text-xl tracking-tight text-foreground">
              Aqua<span className="text-primary">Mine</span>
            </span>
          )}
        </div>
        <button
          className="p-1 rounded hover:bg-white/10 transition-colors"
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

      <nav className={`flex-1 py-8 ${collapsed ? "px-2" : "px-4"} space-y-2`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex items-center ${collapsed ? "justify-center" : ""} px-3 py-3 rounded-xl transition-all duration-200 relative
                ${isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground-muted hover:bg-white/5 hover:text-foreground"
                }
              `}
            >
              <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-[2px]"}`} />
              {!collapsed && (
                <span className={`ml-3 font-medium ${isActive ? "font-semibold" : ""}`}>
                  {item.name}
                </span>
              )}
              {isActive && collapsed && (
                <div className="absolute left-0 w-1 h-8 bg-primary rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button className={`flex items-center w-full px-3 py-3 text-foreground-muted hover:text-foreground hover:bg-white/5 rounded-xl transition-all ${collapsed ? "justify-center" : ""}`}>
          <Settings className="w-6 h-6" />
          {!collapsed && <span className="ml-3 font-medium">Settings</span>}
        </button>
      </div>
    </aside>
  );
}
