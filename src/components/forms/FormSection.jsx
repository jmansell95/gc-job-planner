import React from 'react';

// Shared, consistent section wrapper for all settings/entity forms.
// Renders a titled, icon-led header and a responsive grid (or stacked) body.
export default function FormSection({ title, icon: Icon, description, children, className = '', columns = true, actions = null }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-emerald-700" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 truncate">{title}</h3>
            {description && <p className="text-xs text-slate-400 truncate">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
      <div className={columns ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-4'}>{children}</div>
    </div>
  );
}