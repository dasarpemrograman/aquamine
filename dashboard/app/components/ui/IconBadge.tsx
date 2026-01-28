import React from 'react';
import { LucideIcon } from 'lucide-react';

interface IconBadgeProps {
  icon: LucideIcon;
  variant?: 'default' | 'aqua' | 'teal' | 'coral';
  size?: 'sm' | 'md' | 'lg';
}

export function IconBadge({ icon: Icon, variant = 'default', size = 'md' }: IconBadgeProps) {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-600',
    aqua: 'bg-cyan-100 text-cyan-700',
    teal: 'bg-teal-100 text-teal-700',
    coral: 'bg-rose-100 text-rose-700',
  };
  
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  
  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  return (
    <div className={`
      flex items-center justify-center rounded-full 
      shadow-sm border border-white/50 backdrop-blur-md
      ${variantStyles[variant]}
      ${sizeStyles[size]}
    `}>
      <Icon size={iconSizes[size]} strokeWidth={2.5} />
    </div>
  );
}
