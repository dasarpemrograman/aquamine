"use client";

import { useTheme } from "../context/ThemeContext";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-xl transition-all duration-200 ${
        isDarkMode 
          ? "text-indigo-400 hover:bg-slate-800 hover:text-indigo-300" 
          : "text-slate-500 hover:bg-white/60 hover:text-indigo-600"
      }`}
      title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle Dark Mode"
    >
      {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
