import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, Check, Receipt, Factory, ShieldCheck, ShieldAlert, ShieldX, Tag } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fmt } from './shared';
import { resolveAssetPrice } from '@/components/logistics/rigRateMatcher';

const complianceMeta = {
  compliant: { icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring: { icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200' },
  unknown: null,
};

export default function OwnedItemPicker({ value, onChange, rateCardGroups = [], assetGroups = [], rateCardItems = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => {
    if (!value) return null;
    if (value.startsWith('rc-')) {
      const id = value.slice(3);
      for (const g of rateCardGroups) {
        const r = g.items.find((i) => i.id === id);
        if (r) return { name: r.description, sub: `${r.price != null ? fmt(r.price) : r.price_text || 'POA'}${r.unit ? `/${r.unit}` : ''}` };
      }
      return null;
    }
    if (value.startsWith('ap-')) {
      const id = value.slice(3);
      for (const g of assetGroups) {
        const a = g.items.find((i) => i.id === id);
        if (a) {
          const price = resolveAssetPrice(a, rateCardItems);
          const priceText = price.source === 'rate-card'
            ? `${fmt(price.chargeOut)}${price.unit ? `/${price.unit}` : '/day'}`
            : price.source === 'asset-panda'
            ? `${fmt(price.chargeOut)}/day (AP)`
            : 'no rate';
          return { name: a.name, sub: `${priceText}${a.serial_number ? ` · ${a.serial_number}` : ''}` };
        }
      }
      return null;
    }
    return null;
  }, [value, rateCardGroups, assetGroups, rateCardItems]);

  const q = query.toLowerCase().trim();
  const match = (text) => !q || String(text || '').toLowerCase().includes(q);

  const filteredRC = rateCardGroups
    .map((g) => ({ label: g.label, items: g.items.filter((r) => match(r.description) || match(r.unit) || match(r.price)) }))
    .filter((g) => g.items.length > 0);
  const filteredAP = assetGroups
    .map((g) => ({ label: g.label, items: g.items.filter((a) => match(a.name) || match(a.serial_number) || match(a.equipment_type)) }))
    .filter((g) => g.items.length > 0);
  const hasAny = filteredRC.length > 0 || filteredAP.length > 0;

  const pick = (v) => { onChange(v); setOpen(false); setQuery(''); };

  const panelMax = 'min(60vh, 24rem)';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className="w-full flex items-center gap-2.5 px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-left hover:border-emerald-600 transition focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
          <Tag className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {selected ? (
              <>
                <p className="text-sm font-medium text-slate-800 truncate">{selected.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{selected.sub}</p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Select an item…</p>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 shadow-lg"
        style={{ width: 'var(--radix-popover-trigger-width)', maxHeight: panelMax }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-md">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, serial, price…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </div>
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: `calc(${panelMax} - 49px)` }}>
          {!hasAny && <p className="text-xs text-slate-400 italic px-4 py-6 text-center">No items match your search.</p>}
          {filteredRC.map((g) => (
            <div key={`rc-${g.label}`}>
              <div className="px-3 py-1.5 bg-slate-50/80 flex items-center gap-1.5 sticky top-0">
                <Receipt className="w-3 h-3 text-blue-500" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{g.label}</p>
              </div>
              <div className="divide-y divide-slate-50">
                {g.items.map((r) => {
                  const sel = value === `rc-${r.id}`;
                  return (
                    <button key={r.id} type="button" onClick={() => pick(`rc-${r.id}`)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-blue-50 ${sel ? 'bg-blue-50' : ''}`}>
                      <Receipt className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{r.description}</p>
                        {r.notes && <p className="text-[11px] text-slate-400 truncate">{r.notes}</p>}
                      </div>
                      <span className="text-xs font-semibold text-slate-700 flex-shrink-0 whitespace-nowrap">
                        {r.price != null ? fmt(r.price) : r.price_text || 'POA'}{r.unit ? `/${r.unit}` : ''}
                      </span>
                      {sel && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filteredAP.map((g) => (
            <div key={`ap-${g.label}`}>
              <div className="px-3 py-1.5 bg-slate-50/80 flex items-center gap-1.5 sticky top-0">
                <Factory className="w-3 h-3 text-indigo-500" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{g.label}</p>
              </div>
              <div className="divide-y divide-slate-50">
                {g.items.map((a) => {
                  const sel = value === `ap-${a.id}`;
                  const price = resolveAssetPrice(a, rateCardItems);
                  const priceText = price.source === 'rate-card'
                    ? `${fmt(price.chargeOut)}${price.unit ? `/${price.unit}` : '/day'}`
                    : price.source === 'asset-panda'
                    ? `${fmt(price.chargeOut)}/day`
                    : 'no rate';
                  const isAP = price.source === 'asset-panda';
                  const comp = complianceMeta[a.compliance_status];
                  const CompIcon = comp?.icon;
                  return (
                    <button key={a.id} type="button" onClick={() => pick(`ap-${a.id}`)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-indigo-50 ${sel ? 'bg-indigo-50' : ''}`}>
                      <Factory className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{a.serial_number ? `${a.serial_number} · ` : ''}{priceText}</p>
                      </div>
                      {isAP && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full flex-shrink-0">AP</span>
                      )}
                      {a.rate_card_link_status === 'confirmed' && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex-shrink-0" title="Rate card link confirmed — master price list price takes precedence">RC ✓</span>
                      )}
                      {a.rate_card_link_status === 'proposed' && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0" title="Proposed rate card match — confirm in Settings → Asset Panda">RC?</span>
                      )}
                      {comp && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium border flex-shrink-0 ${comp.cls}`}>
                          {CompIcon && <CompIcon className="w-2.5 h-2.5" />} {a.compliance_status}
                        </span>
                      )}
                      {sel && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}