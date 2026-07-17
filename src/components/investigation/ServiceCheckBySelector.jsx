import React from 'react';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 bg-white";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

// Records WHO carried out the service check (internal staff, client, or contractor)
// when a service is encountered during excavation. The timestamp is captured
// automatically when the log is saved (service_check_at on the entity).
export default function ServiceCheckBySelector({ value, onChange, nameValue, onNameChange, staffName }) {
  const options = [
    { value: 'internal_staff', label: 'Our Crew', hint: staffName || 'Internal staff' },
    { value: 'client', label: 'Client' },
    { value: 'contractor', label: 'Contractor' },
  ];

  return (
    <div className="p-2.5 bg-red-50/60 rounded-xl border border-red-100 mt-2">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-semibold text-red-700">Service check carried out by</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition ${value === o.value ? 'border-red-600 bg-red-100 text-red-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
            {o.label}
          </button>
        ))}
      </div>
      {value && value !== 'internal_staff' && (
        <div className="mt-2">
          <label className={labelCls}>Checker Name *</label>
          <input type="text" value={nameValue} onChange={e => onNameChange(e.target.value)}
            placeholder="e.g. John Smith" className={inputCls} />
          <p className="text-[11px] text-slate-400 mt-1">Time &amp; date captured automatically when saved.</p>
        </div>
      )}
    </div>
  );
}