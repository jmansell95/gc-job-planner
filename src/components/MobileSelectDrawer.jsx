import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Check, ChevronDown } from 'lucide-react';

// Reusable select that renders a native <select> on desktop (>= md) and a
// bottom drawer (vaul) on mobile (< md). Drop-in replacement for a styled
// select — pass options [{value,label}], value, onChange, label, placeholder.
//
// The swap is internal so adopting it anywhere gives mobile users the
// native-feeling bottom-sheet picker while desktop keeps the compact select.
export default function MobileSelectDrawer({
  options = [],
  value,
  onChange,
  label,
  placeholder = 'Select…',
  className = '',
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const display = selected ? selected.label : placeholder;

  const triggerCls = `w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-left flex items-center justify-between gap-2 transition focus:outline-none focus:border-emerald-600 ${value ? 'text-slate-900' : 'text-slate-400'} ${className}`;

  return (
    <>
      {/* Desktop: native select */}
      <div className="hidden md:block">
        <select value={value ?? ''} onChange={e => onChange?.(e.target.value)} required={required} className={triggerCls}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Mobile: drawer trigger */}
      <button type="button" onClick={() => setOpen(true)} className={`${triggerCls} md:hidden active:scale-[0.99]`}>
        <span className="truncate">{display}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[80vh]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle>{label || placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="px-3 pb-4 overflow-y-auto">
            {options.map(o => {
              const isSel = o.value === value;
              return (
                <button key={o.value} type="button"
                  onClick={() => { onChange?.(o.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition active:scale-[0.99] ${isSel ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                </button>
              );
            })}
            {options.length === 0 && <p className="text-center text-sm text-slate-400 py-6">No options</p>}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}