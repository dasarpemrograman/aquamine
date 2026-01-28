import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  icon: Icon,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="p-2 rounded-xl bg-white/40 shadow-sm text-teal-600 ring-1 ring-white/50">
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
          {subtitle && (
            <p className="text-sm text-slate-500 font-medium mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
