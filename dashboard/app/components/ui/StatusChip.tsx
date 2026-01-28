import React from 'react';

interface StatusChipProps {
  status: 'active' | 'inactive' | 'warning' | 'critical' | 'info';
  label: string;
  size?: 'sm' | 'md';
}

export function StatusChip({ status, label, size = 'md' }: StatusChipProps) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-100 text-slate-600 border-slate-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    critical: 'bg-rose-100 text-rose-700 border-rose-200',
    info: 'bg-sky-100 text-sky-700 border-sky-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-semibold rounded-full border
        backdrop-blur-sm bg-opacity-80 shadow-sm
        ${styles[status]}
        ${sizeStyles[size]}
      `}
    >
      <span className={`rounded-full bg-current opacity-60 ${size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} />
      {label}
    </span>
  );
}
