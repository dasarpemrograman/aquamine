"use client";

import { useFieldMode } from "../context/FieldModeContext";
import { Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function FieldModeToggle() {
  const { isFieldMode, toggleFieldMode } = useFieldMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/50 border border-slate-200" title="Enable Field Mode (High Contrast)">
      <div className="flex items-center gap-2">
        <Sun 
          size={16} 
          className={isFieldMode ? "text-amber-600 fill-amber-100" : "text-slate-400"} 
        />
        <span className={`text-xs font-medium ${isFieldMode ? "text-amber-700" : "text-slate-500"}`}>
          Field Mode
        </span>
        <button
          type="button"
          onClick={toggleFieldMode}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 ${
            isFieldMode ? 'bg-amber-600' : 'bg-slate-200'
          }`}
        >
          <span className="sr-only">Toggle Field Mode</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isFieldMode ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
