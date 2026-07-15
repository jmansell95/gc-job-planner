import React from 'react';
import { HardHat } from 'lucide-react';
import { inputCls } from './shared';

export default function NoCostFields({ form, setForm, contractors = [], isContractor }) {
  return (
    <div className="space-y-3">
      {isContractor && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><HardHat className="w-3 h-3 text-blue-600" /> Contractor *</label>
          <select value={form.contractor_id || ''} onChange={(e) => setForm({ ...form, contractor_id: e.target.value })} className={inputCls}>
            <option value="">Select contractor…</option>
            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is being supplied?" className={inputCls} />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
        <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value, unit_label: 'each' })} className={inputCls} />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
      </div>
    </div>
  );
}