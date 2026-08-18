import React from 'react';

/**
 * SubPills — secondary segmented control rendered below a hub's main TabBar.
 *
 * Used by the consolidated hubs to group related sub-views inside a single
 * merged tab (e.g. "People" → Crew Members | Crew Types | Reviews | Directory).
 *
 * Props:
 *  - pills: [{ id, label, icon?, badge?, count? }]
 *  - active: active pill id
 *  - onChange: (id) => void
 *
 * Returns null when there's only one (or zero) pill — no need to choose.
 */
export default function SubPills({ pills = [], active, onChange }) {
  if (!pills || pills.length <= 1) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
      {pills.map(p => {
        const Icon = p.icon;
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              isActive
                ? 'bg-[#2E5A1A]/10 text-[#2E5A1A] border border-[#2E5A1A]/20'
                : 'text-slate-500 hover:bg-slate-100 border border-transparent'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {p.label}
            {p.badge != null && p.badge > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-[#2E5A1A]/15 text-[#2E5A1A]' : 'bg-rose-100 text-rose-600'}`}>
                {p.badge}
              </span>
            )}
            {p.count != null && (
              <span className={`ml-0.5 text-xs font-normal ${isActive ? 'text-[#2E5A1A]/70' : 'text-slate-400'}`}>{p.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}