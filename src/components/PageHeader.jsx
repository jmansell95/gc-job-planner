import React from 'react';

export default function PageHeader({ title, icon: Icon, subtitle, actions }) {
  return (
    <div className="hero-gradient relative overflow-hidden rounded-t-none rounded-b-2xl md:rounded-2xl mb-6">
      <div className="relative px-5 md:px-7 py-5 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight truncate">{title}</h1>
              {subtitle && <p className="text-white/85 text-xs md:text-sm mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0 [&>button]:whitespace-nowrap">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}