import React from 'react';
import { ArrowLeft, Search } from 'lucide-react';

/**
 * FieldPageShell — unified mobile/tablet layout for all field-facing pages.
 * Provides the sticky blur header, optional search, optional horizontal
 * filter pills, and page-bg-vibrant background matching the Help Guides style.
 */
export default function FieldPageShell({
  title,
  subtitle,
  icon: Icon,
  onBack,
  actions,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  activeFilter,
  onFilterChange,
  children,
  contentClassName = '',
  headerTone = 'light',
}) {
  return (
    <div className="min-h-screen page-bg-vibrant">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <button onClick={onBack} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0 active:scale-95 touch-manipulation">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
            {Icon && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm flex-shrink-0">
                <Icon className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate leading-tight">{title}</h1>
              {subtitle && <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
        </div>

        {/* Search bar */}
        {onSearchChange && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search || ''}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30"
              />
            </div>
          </div>
        )}

        {/* Horizontal filter pills */}
        {filters && filters.length > 0 && (
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            {filters.map(f => {
              const active = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => onFilterChange(f.key)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition active:scale-95 ${
                    active ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {f.label}
                  {f.count != null && (
                    <span className={`ml-1.5 text-xs ${active ? 'opacity-80' : 'text-slate-400'}`}>{f.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={contentClassName}>
        {children}
      </div>
    </div>
  );
}