import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, Check, Receipt, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fmt } from './shared';

export default function LabourItemPicker({ value, onChange, rateCardGroups = [], staff = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => {
    if (!value) return null;
    if (value.startsWith('rc-')) {
      const id = value.slice(3);
      for (const g of rateCardGroups) {
        const r = g.items.find((i) => i.id === id);
        if (r) return { name: r.description, sub: `${r.price != null ? fmt(r.price) : r.price_text || 'POA'}${r.unit ? `/${r.unit}` : ''}${r.men ? ` · ${r.men} men` : ''}` };
      }
      return null;
    }
    if (value.startsWith('st-')) {
      const id = value.slice(3);
      const s = staff.find((i) => i.id === id);
      if (s) return { name: s.name, sub: 'Staff member' };
      return null;
    }
    return null;
  }, [value, rateCardGroups, staff]);

  const q = query.toLowerCase().trim();
  const match = (text) => !q || String(text || '').toLowerCase().includes(q);

  const filteredRC = rateCardGroups
    .map((g) => ({ label: g.label, items: g.items.filter((r) => match(r.description) || match(r.unit) || match(r.price)) }))
    .filter((g) => g.items.length > 0);
  const filteredStaff = staff.filter((s) => match(s.name));
  const hasAny = filteredRC.length > 0 || filteredStaff.length > 0;

  const pick = (v) => { onChange(v); setOpen(false); setQuery(''); };

  const panelMax = 'min(60vh, 24rem)';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className="w-full flex items-center gap-2.5 px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-left hover:border-emerald-600 transition focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
          <Users className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {selected ? (
              <>
                <p className="text-sm font-medium text-slate-800 truncate">{selected.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{selected.sub}</p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Select a labour rate or staff member…</p>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-[22rem] max-w-[calc(100vw-2rem)]"
        style={{ maxHeight: panelMax }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-md">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, rate, price…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: `calc(${panelMax} - 49px)` }}>
          {!hasAny && <p className="text-xs text-slate-400 italic px-4 py-6 text-center">No items match your search.</p>}
          {filteredRC.map((g) => (
            <div key={`rc-${g.label}`}>
              <div className="px-3 py-1.5 bg-slate-50/80 flex items-center gap-1.5 sticky top-0">
                <Receipt className="w-3 h-3 text-emerald-500" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{g.label}</p>
              </div>
              <div className="divide-y divide-slate-50">
                {g.items.map((r) => {
                  const sel = value === `rc-${r.id}`;
                  return (
                    <button key={r.id} type="button" onClick={() => pick(`rc-${r.id}`)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-emerald-50 ${sel ? 'bg-emerald-50' : ''}`}>
                      <Receipt className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{r.description}</p>
                        {r.notes && <p className="text-[11px] text-slate-400 truncate">{r.notes}</p>}
                      </div>
                      <span className="text-xs font-semibold text-slate-700 flex-shrink-0 whitespace-nowrap">
                        {r.price != null ? fmt(r.price) : r.price_text || 'POA'}{r.unit ? `/${r.unit}` : ''}{r.men ? ` · ${r.men}m` : ''}
                      </span>
                      {sel && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filteredStaff.length > 0 && (
            <div key="st-staff">
              <div className="px-3 py-1.5 bg-slate-50/80 flex items-center gap-1.5 sticky top-0">
                <Users className="w-3 h-3 text-slate-500" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Staff Members</p>
              </div>
              <div className="divide-y divide-slate-50">
                {filteredStaff.map((s) => {
                  const sel = value === `st-${s.id}`;
                  return (
                    <button key={s.id} type="button" onClick={() => pick(`st-${s.id}`)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50 ${sel ? 'bg-slate-50' : ''}`}>
                      <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{s.role || s.job_title || 'Crew member'}</p>
                      </div>
                      {sel && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}