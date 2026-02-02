import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'flat';
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
}

export function GlassCard({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
}: GlassCardProps) {
  const paddingClasses = {
    none: 'p-0',
    xs: 'p-3',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const variantClasses = {
    default: 'glass',
    elevated: 'glass shadow-lg',
    flat: 'glass shadow-none',
  };

  return (
    <div
      className={`
        rounded-xl 
        transition-all duration-300
        hover:border-white/80 hover:shadow-md
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
