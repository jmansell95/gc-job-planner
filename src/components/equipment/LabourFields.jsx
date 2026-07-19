import React from 'react';
import { Users, Calendar, Receipt, User } from 'lucide-react';
import { differenceInCalendarDays, eachDayOfInterval, isWeekend } from 'date-fns';
import { inputCls, fmt } from './shared';

export default function LabourFields({ form, setForm, rateCardItems = [], staff = [], defaultDates }) {
  // Labour rate card items from our company Master Price List
  const labourRateItems = (rateCardItems || []).filter(
    (i) => i.is_active !== false && i.category === 'labour' && i.rate_card_source === 'our_company'
  );

  const pickFromRateCard = (id) => {
    if (!id) return;
    const item = (rateCardItems || []).find((r) => r.id === id);
    if (!item) return;
    setForm({
      ...form,
      description: item.description || form.description,
      unit_cost: String(item.price ?? ''),
      unit_label: item.unit || 'day',
      men: item.men != null ? String(item.men) : '',
      rate_card_item_id: item.id,
      notes: item.notes || form.notes,
    });
  };

  const pickStaff = (id) => {
    if (!id) return;
    const member = (staff || []).find((s) => s.id === id);
    setForm({
      ...form,
      staff_id: id,
      responsible_person: member?.name || form.responsible_person,
    });
  };

  const isByDay = form.unit_label === 'day';
  const itemCount = Number(form.quantity) || 1;
  const daysFromForm = () => {
    if (form.start_date && form.end_date) {
      const d = differenceInCalendarDays(new Date(form.end_date + 'T00:00:00'), new Date(form.start_date + 'T00:00:00')) + 1;
      return d > 0 ? d : 1;
    }
    return null;
  };
  const days = isByDay ? (daysFromForm() ?? 1) : 1;
  const lineTotal = (Number(form.unit_cost) || 0) * itemCount * days;
  const workingDaysCount = form.start_date && form.end_date
    ? eachDayOfInterval({ start: new Date(form.start_date + 'T00:00:00'), end: new Date(form.end_date + 'T00:00:00') }).filter((d) => !isWeekend(d)).length
    : 0;

  return (
    <div className="space-y-3">
      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
          <Receipt className="w-3 h-3 text-emerald-700" /> Pick from Master Price List (Labour)
        </label>
        <select value="" onChange={(e) => { pickFromRateCard(e.target.value); e.target.value = ''; }} className={inputCls}>
          <option value="">Select a labour rate…</option>
          {labourRateItems.map((r) => (
            <option key={r.id} value={r.id}>
              {r.description} · {r.price != null ? fmt(r.price) : r.price_text || 'POA'}{r.unit ? `/${r.unit}` : ''}{r.men ? ` · ${r.men} men` : ''}
            </option>
          ))}
        </select>
        {labourRateItems.length === 0 && <p className="text-xs text-slate-400 italic mt-1">No labour rates found in the Master Price List. Add labour items in Settings → Rate Card.</p>}
      </div>

      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
          <User className="w-3 h-3 text-emerald-700" /> Assign staff member *
        </label>
        <select value={form.staff_id || ''} onChange={(e) => pickStaff(e.target.value)} className={inputCls}>
          <option value="">Select staff member…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <p className="text-[11px] text-slate-500 mt-1">A rota assignment is created for each working day so the crew member appears on the job schedule.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
            <Calendar className="w-3 h-3 text-emerald-700" /> Start date
            {defaultDates && defaultDates.start && (
              <button type="button" onClick={() => setForm({ ...form, start_date: defaultDates.start, end_date: defaultDates.end })} className="text-emerald-600 hover:text-emerald-800 font-medium ml-1">Use job dates</button>
            )}
          </label>
          <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">End date</label>
          <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputCls} />
        </div>
      </div>

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
            <option value="each">each</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity{isByDay ? ' (people)' : ''}</label>
          <input type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="1" className={inputCls} />
        </div>
      </div>

      {Number(form.unit_cost) > 0 && (
        <div className="text-xs text-slate-600 bg-white rounded-md px-3 py-2 border border-slate-200 flex items-center justify-between">
          <span>Line revenue: {itemCount} {isByDay ? 'person' : 'unit'}{itemCount > 1 ? 's' : ''}{isByDay && days > 1 ? ` × ${days} days` : ''} × {fmt(Number(form.unit_cost) || 0)}</span>
          <span className="font-bold text-slate-900">{fmt(lineTotal)}</span>
        </div>
      )}

      {form.start_date && form.end_date && workingDaysCount > 0 && (
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> {workingDaysCount} working day{workingDaysCount > 1 ? 's' : ''} → {workingDaysCount * itemCount} rota assignment{workingDaysCount * itemCount > 1 ? 's' : ''} will be created.
        </div>
      )}

      {form.rate_card_item_id && (
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Linked to a rate card item — this is chargeable to the client.
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this crew member" className={inputCls} />
      </div>
    </div>
  );
}