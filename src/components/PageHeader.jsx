import React from 'react';

export default function PageHeader({ title, icon: Icon, subtitle, actions }) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          {Icon && (
            <div className="p-2.5 md:p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex-shrink-0 shadow-md ring-1 ring-emerald-300/40">
              <Icon className="w-6 md:w-8 h-6 md:h-8 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none [&>button]:justify-center [&>button]:whitespace-nowrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}