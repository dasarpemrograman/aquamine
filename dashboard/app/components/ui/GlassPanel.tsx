import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function GlassPanel({
  children,
  className = '',
  header,
  footer,
}: GlassPanelProps) {
  return (
    <div className={`glass-panel rounded-3xl overflow-hidden flex flex-col ${className}`}>
      {header && (
        <div className="px-6 py-4 border-b border-white/30 bg-white/10 backdrop-blur-sm">
          {header}
        </div>
      )}
      <div className="p-6 flex-1">
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-white/30 bg-white/5">
          {footer}
        </div>
      )}
    </div>
  );
}
