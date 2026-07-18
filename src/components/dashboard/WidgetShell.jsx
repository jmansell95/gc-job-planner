import React from 'react';

export default function WidgetShell({ icon: Icon, iconBg = 'bg-emerald-50', iconColor = 'text-emerald-700', title, subtitle, action, children, bodyClassName = 'p-5' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-4 bg-gradient-to-r from-emerald-50/80 via-white to-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0 w-full sm:w-auto flex justify-end">{action}</div>}
      </div>
      <div className={bodyClassName}>
        {children}
      </div>
    </div>
  );
}