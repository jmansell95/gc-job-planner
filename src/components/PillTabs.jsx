import React from 'react';

/**
 * Shared pill-style tab navigation.
 * tabs: [{ id, label, icon }]
 * activeId, onChange
 */
export default function PillTabs({ tabs, activeId, onChange, className = '' }) {
  return (
    <div className={`sticky top-0 z-20 -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 pt-1 ${className}`}>
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-sm p-1.5">
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
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm shadow-emerald-200/60'
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