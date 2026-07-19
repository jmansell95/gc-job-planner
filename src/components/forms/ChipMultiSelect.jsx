import React from 'react';
import { Check } from 'lucide-react';

// Reusable chip-style multi-select. Used for qualifications, asset types,
// required teams, tool access — anywhere we toggle a list of string values.
// options: [{ value, label, critical? }]
// value: string[]  · onChange(next: string[])
const COLORS = {
  emerald: { on: 'border-emerald-600 bg-emerald-50 text-emerald-700', box: 'bg-emerald-600 border-emerald-600' },
  violet: { on: 'border-violet-600 bg-violet-50 text-violet-700', box: 'bg-violet-600 border-violet-600' },
  blue: { on: 'border-blue-600 bg-blue-50 text-blue-700', box: 'bg-blue-600 border-blue-600' },
  indigo: { on: 'border-indigo-600 bg-indigo-50 text-indigo-700', box: 'bg-indigo-600 border-indigo-600' },
};

export default function ChipMultiSelect({ options = [], value = [], onChange, columns = 3, color = 'emerald', hint }) {
  const c = COLORS[color] || COLORS.emerald;
  const gridCls = columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1';
  return (
    <div>
      <div className={`grid ${gridCls} gap-2`}>
        {options.map(opt => {
          const checked = value.includes(opt.value);
          return (
            <button type="button" key={opt.value} onClick={() => {
              const next = checked ? value.filter(v => v !== opt.value) : [...value, opt.value];
              onChange(next);
            }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition text-left ${checked ? c.on : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${checked ? c.box : 'border-slate-300'}`}>
                {checked && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <span className="truncate">{opt.label}</span>
              {opt.critical && <span className="text-[9px] text-red-500 font-bold ml-auto">●</span>}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-xs text-slate-400 mt-2">{hint}</p>}
    </div>
  );
}