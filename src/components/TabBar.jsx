import React from 'react';

/**
 * Shared tab bar — consistent styling across all admin pages.
 * White glass card with green-gradient active state.
 */
export default function TabBar({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-1.5 inline-flex flex-wrap gap-1 ${className}`}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} type="button"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            {Icon && <Icon className="w-4 h-4" />}
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-600">{t.badge}</span>
            )}
            {t.count != null && (
              <span className="ml-0.5 text-xs text-slate-400 font-normal">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}