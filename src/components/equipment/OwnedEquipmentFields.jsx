import React from 'react';
import { Boxes, Calendar, Lock, User } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { inputCls, fmt } from './shared';

export default function OwnedEquipmentFields({ form, setForm, ownedAssets = [], defaultDates }) {
  const isSynced = !!form.site_asset_id;

  const pickOwnedAsset = (id) => {
    if (!id) return;
    const asset = (ownedAssets || []).find((a) => a.id === id);
    if (!asset) return;
    setForm({
      ...form,
      category: 'internal_equipment',
      description: asset.name || form.description,
      reference_number: asset.serial_number || form.reference_number,
      responsible_person: asset.responsible_person || form.responsible_person,
      site_asset_id: asset.id,
      unit_cost: String(asset.daily_billing_rate ?? ''),
      unit_label: 'day',
      supplier_id: '',
      rate_card_item_id: '',
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
      {isSynced && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2 border border-blue-200">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Synced from Asset Panda — description and reference are locked. Only billing and hire details can be edited.
        </div>
      )}

      {!isSynced && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
            <Boxes className="w-3 h-3 text-blue-600" /> Pick from Asset Panda (in stock only)
          </label>
          <select value="" onChange={(e) => { pickOwnedAsset(e.target.value); e.target.value = ''; }} className={inputCls}>
            <option value="">Select from Asset Panda inventory…</option>
            {ownedAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.daily_billing_rate ? ` · ${fmt(a.daily_billing_rate)}/day` : ''}{a.stock_level && a.stock_level !== 'unknown' ? ` · ${a.stock_level.replace('_', ' ')}` : ''}
              </option>
            ))}
          </select>
          {ownedAssets.length === 0 && <p className="text-xs text-slate-400 italic mt-1">No equipment currently in stock. Check Asset Panda sync status.</p>}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} ${isSynced ? 'bg-slate-50 text-slate-500' : ''}`} readOnly={isSynced} />
      </div>

      {form.responsible_person && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><User className="w-3 h-3 text-slate-400" /> Responsible Person</label>
          <input value={form.responsible_person} readOnly className={`${inputCls} bg-slate-50 text-slate-500`} />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
        <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} className={`${inputCls} ${isSynced ? 'bg-slate-50 text-slate-500' : ''}`} readOnly={isSynced} />
      </div>

      {isHiredByDay && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
              <Calendar className="w-3 h-3 text-emerald-700" /> Hire start
              {defaultDates && defaultDates.start && (
                <button type="button" onClick={() => setForm({ ...form, start_date: defaultDates.start, end_date: defaultDates.end })} className="text-emerald-600 hover:text-emerald-800 font-medium ml-1">Use job dates</button>
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
            <option value="each">each</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity{isHiredByDay ? ' (items to deploy)' : ''}</label>
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

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
      </div>
    </div>
  );
}