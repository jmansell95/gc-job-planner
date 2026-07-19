import React from 'react';
import { HardHat, Building2, Truck } from 'lucide-react';
import { inputCls } from './shared';

export default function NoCostFields({ form, setForm, contractors = [], clients = [], isContractor }) {
  const isClient = !isContractor;
  return (
    <div className="space-y-3">
      {isContractor && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><HardHat className="w-3 h-3 text-blue-600" /> Contractor *</label>
          <select value={form.contractor_id || ''} onChange={(e) => setForm({ ...form, contractor_id: e.target.value })} className={inputCls}>
            <option value="">Select contractor…</option>
            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!form.contractor_id && <p className="text-[10px] text-amber-500 mt-1">Required — select who is supplying this item.</p>}
        </div>
      )}

      {isClient && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Building2 className="w-3 h-3 text-emerald-600" /> Client *</label>
          <select value={form.client_id || ''} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className={inputCls}>
            <option value="">Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!form.client_id && <p className="text-[10px] text-amber-500 mt-1">Required — select which client is supplying this item.</p>}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={isContractor ? "e.g. Excavator supplied by contractor" : "e.g. Materials delivered by client"} className={inputCls} />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Reference / Asset tag</label>
        <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="Optional — serial no. or asset tag" className={inputCls} />
      </div>

      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
          <Truck className="w-3 h-3 text-slate-400" /> Delivery notes
        </label>
        <input value={form.delivery_notes || ''} onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })} placeholder={isContractor ? "When/how the contractor delivers to site" : "When/how the client delivers to site"} className={inputCls} />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
        <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value, unit_label: 'each' })} className={inputCls} />
      </div>

      <div className="text-xs text-slate-600 bg-slate-50 rounded-md px-3 py-2 border border-slate-200 flex items-center gap-1.5">
        {isContractor
          ? <HardHat className="w-3.5 h-3.5 text-blue-600" />
          : <Building2 className="w-3.5 h-3.5 text-emerald-600" />}
        {isContractor
          ? 'Contractor-supplied — no cost tracked, no driver collection needed.'
          : 'Client-supplied — informational only. No cost or charge is tracked.'}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
      </div>
    </div>
  );
}