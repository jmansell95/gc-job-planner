import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Reusable collapsible wrapper for optional log form sections.
// Keeps the field UI clean by hiding rarely-used groups until the user taps to expand.
const accents = {
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
  red: 'bg-red-50 border-red-100 text-red-700',
  blue: 'bg-blue-50 border-blue-100 text-blue-700',
  amber: 'bg-amber-50 border-amber-100 text-amber-700',
  cyan: 'bg-cyan-50 border-cyan-100 text-cyan-700',
};

export default function CollapsibleSection({ icon: Icon, title, hint, accent = 'slate', defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border ${accents[accent] || accents.slate}`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-1.5 px-3 py-2.5">
        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="text-xs font-semibold flex-1 text-left">{title}</span>
        {hint && !open && <span className="text-[11px] font-normal opacity-60 mr-1">{hint}</span>}
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}