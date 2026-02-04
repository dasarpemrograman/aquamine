"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const FIELD_MODE_STORAGE_KEY = "aquamine_field_mode";

interface FieldModeContextType {
  isFieldMode: boolean;
  toggleFieldMode: () => void;
}

const FieldModeContext = createContext<FieldModeContextType | undefined>(undefined);

export function FieldModeProvider({ children }: { children: React.ReactNode }) {
  const [isFieldMode, setIsFieldMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(FIELD_MODE_STORAGE_KEY);
    const initialMode = stored === "true";
    setIsFieldMode(initialMode);
    
    if (initialMode) {
      document.body.classList.add("field-mode");
      document.documentElement.setAttribute("data-field-mode", "true");
    } else {
      document.body.classList.remove("field-mode");
      document.documentElement.setAttribute("data-field-mode", "false");
    }
  }, []);

  const toggleFieldMode = () => {
    const newMode = !isFieldMode;
    setIsFieldMode(newMode);
    localStorage.setItem(FIELD_MODE_STORAGE_KEY, String(newMode));
    
    if (newMode) {
      document.body.classList.add("field-mode");
      document.documentElement.setAttribute("data-field-mode", "true");
    } else {
      document.body.classList.remove("field-mode");
      document.documentElement.setAttribute("data-field-mode", "false");
    }
  };

  return (
    <FieldModeContext.Provider value={{ isFieldMode, toggleFieldMode }}>
      {children}
    </FieldModeContext.Provider>
  );
}

export function useFieldMode() {
  const context = useContext(FieldModeContext);
  if (context === undefined) {
    throw new Error("useFieldMode must be used within a FieldModeProvider");
  }
  return context;
}
