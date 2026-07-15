import React from 'react';
import { Calendar, Receipt } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { inputCls, fmt } from './shared';

export default function HiredEquipmentFields({ form, setForm, suppliers = [], rateCardItems = [], defaultDates }) {
  const supplierRateItems = (rateCardItems || []).filter(
    (i) => i.is_active !== false && i.rate_card_source === 'supplier' && i.supplier_id === form.supplier_id
  );

  const pickFromRateCard = (id) => {
    if (!id) return;
    const item = (rateCardItems || []).find((r) => r.id === id);
    if (!item) return;
    setForm({
      ...form,
      description: item.description || form.description,
      unit_cost: String(item.price ?? ''),
      unit_label: item.unit || form.unit_label || 'day',
      vat_exempt: false,
      rate_card_item_id: item.id,
      men: item.men != null ? String(item.men) : '',
      notes: item.notes || form.notes,
    });
  };

  const isHiredByDay = form.unit_label === 'day';
  const itemCount = Number(form.quantity) || 1;
  const daysFromForm = () => {
    if (form.start_date && form.end_date) {
      const d = differenceInCalendarDays(new Date(form.end_date + 'T00:00:00'), new Date(form.start_date + 'T00:00:00')) + 1;
      return d > 0 ? d : 1;
    }
    return null;
  };
  const days = isHiredByDay ? (daysFromForm() ?? 1) : 1;
  const lineTotal = (Number(form.unit_cost) || 0) * itemCount * days;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Supplier *</label>
        <select
          value={form.supplier_id}
          onChange={(e) => setForm({ ...form, supplier_id: e.target.value, rate_card_item_id: '' })}
          className={inputCls}
        >
          <option value="">Select supplier…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {form.supplier_id && supplierRateItems.length > 0 && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
            <Receipt className="w-3 h-3 text-emerald-700" /> Pick from {suppliers.find((s) => s.id === form.supplier_id)?.name}'s rate card
          </label>
          <select
            value=""
            onChange={(e) => { pickFromRateCard(e.target.value); e.target.value = ''; }}
            className={inputCls}
          >
            <option value="">Select a rate to auto-fill…</option>
            {supplierRateItems.map((r) => (
              <option key={r.id} value={r.id}>
                {r.description} · {r.price != null ? fmt(r.price) : r.price_text || 'POA'}{r.unit ? `/${r.unit}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {form.supplier_id && supplierRateItems.length === 0 && (
        <p className="text-xs text-slate-400 italic">No rate card items found for this supplier. Enter details manually below.</p>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="e.g. Excavator 5-ton"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
        <input
          value={form.reference_number}
          onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
          placeholder="Asset tag / serial no."
          className={inputCls}
        />
      </div>

      {isHiredByDay && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
              <Calendar className="w-3 h-3 text-emerald-700" /> Hire start
              {defaultDates && defaultDates.start && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, start_date: defaultDates.start, end_date: defaultDates.end })}
                  className="text-emerald-600 hover:text-emerald-800 font-medium ml-1"
                >
                  Use job dates
                </button>
              )}
            </label>
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hire end</label>
            <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputCls} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Billing rate (net) *</label>
          <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
          <select value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} className={inputCls}>
            <option value="day">per day</option>
            <option value="hour">per hour</option>
            <option value="m">per metre</option>
            <option value="each">each</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity{isHiredByDay ? ' (items to hire)' : ''}</label>
          <input type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="1" className={inputCls} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={form.vat_exempt} onChange={(e) => setForm({ ...form, vat_exempt: e.target.checked })} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
        VAT exempt (zero-rated item)
      </label>

      {Number(form.unit_cost) > 0 && (
        <div className="text-xs text-slate-600 bg-white rounded-md px-3 py-2 border border-slate-200 flex items-center justify-between">
          <span>Line revenue: {itemCount} item{itemCount > 1 ? 's' : ''}{isHiredByDay && days > 1 ? ` × ${days} days` : ''} × {fmt(Number(form.unit_cost) || 0)}</span>
          <span className="font-bold text-slate-900">{fmt(lineTotal)}</span>
        </div>
      )}
      {form.rate_card_item_id && (
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Linked to a rate card item — this is chargeable to the client.
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
      </div>
    </div>
  );
}