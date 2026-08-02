import React from 'react';

/**
 * ModernSectionHeader — Phase 2 UI primitive.
 *
 * Consistent section header with icon, title, description, and optional
 * action slot. Used across settings pages, dashboard widgets, and panels
 * for visual standardisation.
 */
export default function ModernSectionHeader({
  icon: Icon,
  title,
  description,
  actions,
  gradient = 'from-[#2E5A1A] to-[#5A8C1E]',
  className = '',
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 ${className}`}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 text-base leading-tight">{title}</h3>
          {description && <p className="text-sm text-slate-500 mt-0.5 leading-snug">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}