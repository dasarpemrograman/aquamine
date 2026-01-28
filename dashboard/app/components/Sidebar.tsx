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
  Menu
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Forecast", href: "/forecast", icon: LineChart },
  { name: "Recipients", href: "/recipients", icon: Users },
  { name: "CV Analysis", href: "/cv", icon: Camera },
  { name: "AI Assistant", href: "/chat", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 lg:w-64 bg-surface border-r border-white/5 flex flex-col z-40 transition-all duration-300">
      <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-white/5">
        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-glow rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="text-background font-bold text-xl">A</span>
        </div>
        <span className="hidden lg:block ml-3 font-bold text-xl tracking-tight text-foreground">
          Aqua<span className="text-primary">Mine</span>
        </span>
      </div>

      <nav className="flex-1 py-8 px-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex items-center px-3 py-3 rounded-xl transition-all duration-200
                ${isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground-muted hover:bg-white/5 hover:text-foreground"
                }
              `}
            >
              <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-[2px]"}`} />
              <span className={`hidden lg:block ml-3 font-medium ${isActive ? "font-semibold" : ""}`}>
                {item.name}
              </span>
              
              {isActive && (
                <div className="absolute left-0 w-1 h-8 bg-primary rounded-r-full lg:hidden" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button className="flex items-center w-full px-3 py-3 text-foreground-muted hover:text-foreground hover:bg-white/5 rounded-xl transition-all">
          <Settings className="w-6 h-6" />
          <span className="hidden lg:block ml-3 font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
