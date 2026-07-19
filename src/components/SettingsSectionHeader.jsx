import React from 'react';

/**
 * Consistent section header for every settings sub-page.
 * Sits below the parent "Settings" hero header and provides a uniform,
 * professional layout: icon + title + description on the left, optional
 * action buttons on the right.
 */
export default function SettingsSectionHeader({ icon: Icon, title, description, actions }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-emerald-700" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight truncate">{title}</h2>
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0 [&>button]:whitespace-nowrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}