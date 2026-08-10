import React, { useState } from 'react';
import { Search, X, Link2, Unlink } from 'lucide-react';
import { fmt } from './shared';

const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

/**
 * Rate Card Link Selector — lets a BillingRule pull its rate dynamically
 * from a RateCardItem (Master Price List) instead of hardcoding the price.
 * When linked, the rate card becomes the single source of truth: update
 * the rate card and all linked billing rules update automatically.
 */
export default function RateCardLinkSelector({ form, setForm, rateCardItems }) {
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const linkedItem = rateCardItems?.find(r => r.id === form.rate_card_item_id);

  const filtered = rateCardItems
    ? rateCardItems
        .filter(r => r.price != null && r.is_active !== false)
        .filter(r => !search || r.description?.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 50)
    : [];

  // Already linked — show the linked rate card item with an unlink button
  if (form.rate_card_item_id && linkedItem) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Link2 className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-indigo-900">Linked to Rate Card</p>
            <p className="text-sm text-slate-700 truncate">{linkedItem.description}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {linkedItem.category} · {linkedItem.unit || 'sum'} · <span className="font-bold text-indigo-700">{fmt(linkedItem.price)}</span>
            </p>
          </div>
          <button type="button" onClick={() => setForm({ ...form, rate_card_item_id: '' })}
            className="p-1 text-indigo-400 hover:text-red-600 hover:bg-red-50 rounded transition">
            <Unlink className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-indigo-600 bg-indigo-100 rounded px-2 py-1">
          Rate is pulled dynamically from the Master Price List. Update the rate card and this rule updates automatically.
        </p>
      </div>
    );
  }

  // Not linked — show the "Link to Rate Card" button
  if (!showPicker) {
    return (
      <button type="button" onClick={() => setShowPicker(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 border border-dashed border-indigo-300 rounded-xl text-sm text-indigo-600 hover:bg-indigo-50 transition">
        <Link2 className="w-4 h-4" /> Link to Rate Card item (dynamic pricing)
      </button>
    );
  }

  // Picker open — show search + list of rate card items
  return (
    <div className="border border-indigo-200 rounded-xl p-3 space-y-2 bg-indigo-50/50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-indigo-900 flex items-center gap-1"><Link2 className="w-3 h-3" /> Select Rate Card Item</p>
        <button type="button" onClick={() => { setShowPicker(false); setSearch(''); }}
          className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rate card…"
          className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500" autoFocus />
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1 bg-white rounded-lg border border-slate-200">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No rate card items found</p>
        ) : filtered.map(r => (
          <button key={r.id} type="button"
            onClick={() => { setForm({ ...form, rate_card_item_id: r.id }); setShowPicker(false); setSearch(''); }}
            className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition border-b border-slate-100 last:border-0">
            <p className="text-sm text-slate-800 truncate">{r.description}</p>
            <p className="text-[11px] text-slate-500">{r.category} · {r.unit || 'sum'} · <span className="font-bold text-indigo-700">{fmt(r.price)}</span></p>
          </button>
        ))}
      </div>
    </div>
  );
}