import React from 'react';

const completedByOptions = [
  { value: 'internal_staff', label: 'Our Staff' },
  { value: 'client', label: 'Client' },
  { value: 'contractor', label: 'Contractor' },
];

const accentMap = {
  amber: 'border-amber-600 bg-amber-50 text-amber-700',
  blue: 'border-blue-600 bg-blue-50 text-blue-700',
  teal: 'border-teal-600 bg-teal-50 text-teal-700',
  slate: 'border-slate-700 bg-slate-100 text-slate-800',
};

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 bg-white";

export default function CompletedBySelector({ value, onChange, nameValue, onNameChange, accent = 'amber', label = 'Activity Completed By' }) {
  const activeCls = accentMap[accent] || accentMap.slate;
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <div className="grid grid-cols-3 gap-1.5">
        {completedByOptions.map(o => (
          <button key={o.value} type="button"
            onClick={() => onChange(o.value, o.value === 'internal_staff' ? '' : nameValue)}
            className={`py-1.5 rounded-lg text-[11px] font-medium border transition ${value === o.value ? activeCls : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
            {o.label}
          </button>
        ))}
      </div>
      {value !== 'internal_staff' && (
        <input type="text" value={nameValue} onChange={e => onNameChange(e.target.value)}
          placeholder="Representative name (required)" className={`${inputCls} mt-2`} />
      )}
    </div>
  );
}

export const completedByOptionsList = completedByOptions;