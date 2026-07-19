import React from 'react';

/**
 * Shared pill-style tab navigation.
 * tabs: [{ id, label, icon }]
 * activeId, onChange
 * contextLabel: optional label shown as a prefix chip before the tabs
 */
export default function PillTabs({ tabs, activeId, onChange, className = '', contextLabel }) {
  return (
    <div className={`sticky top-0 z-20 -mx-4 px-4 sm:mx-0 sm:px-0 mb-5 pt-1 ${className}`}>
      <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-sm p-1.5">
        {contextLabel && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {contextLabel}
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition flex-shrink-0 whitespace-nowrap border active:scale-[0.97] ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-600 shadow-sm shadow-emerald-200/60'
                    : 'bg-transparent text-slate-600 border-transparent hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}