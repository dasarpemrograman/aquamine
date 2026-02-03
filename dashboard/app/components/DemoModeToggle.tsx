"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";

export const DEMO_MODE_STORAGE_KEY = "aquamine_demo_mode";
export const DEMO_REFRESH_INTERVAL = 2000;

export default function DemoModeToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (stored === "true") {
      setEnabled(true);
      document.body.classList.add("demo-mode");
    }
  }, []);

  const toggleDemoMode = () => {
    const newState = !enabled;
    setEnabled(newState);
    if (newState) {
      localStorage.setItem(DEMO_MODE_STORAGE_KEY, "true");
      document.body.classList.add("demo-mode");
      window.dispatchEvent(new Event("demo-mode-changed"));
    } else {
      localStorage.setItem(DEMO_MODE_STORAGE_KEY, "false");
      document.body.classList.remove("demo-mode");
      window.dispatchEvent(new Event("demo-mode-changed"));
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/50 border border-slate-200" title="Enable high-frequency updates for presentation">
      <div className="flex items-center gap-2">
        <FlaskConical 
          size={16} 
          className={enabled ? "text-indigo-600 fill-indigo-100" : "text-slate-400"} 
        />
        <span className={`text-xs font-medium ${enabled ? "text-indigo-700" : "text-slate-500"}`}>
          Demo Mode
        </span>
        <button
          type="button"
          onClick={toggleDemoMode}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
            enabled ? 'bg-indigo-600' : 'bg-slate-200'
          }`}
        >
          <span className="sr-only">Toggle Demo Mode</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
