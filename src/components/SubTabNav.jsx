import React from 'react';

/**
 * Compact sub-tab bar for sub-pages within a main tab.
 * Only renders when there are 2+ tabs — a single-section tab shows nothing.
 */
export default function SubTabNav({ tabs, activeTab, onChange, className = '' }) {
  if (!tabs || tabs.length <= 1) return null;
  return (
    <div className={`bg-slate-50 rounded-xl border border-slate-200/70 p-1 flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${className}`}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex-shrink-0 whitespace-nowrap active:scale-[0.97] ${
              active
                ? 'bg-white text-[#2E5A1A] shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-[#2E5A1A]/10 text-[#2E5A1A]' : 'bg-slate-200 text-slate-500'}`}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}