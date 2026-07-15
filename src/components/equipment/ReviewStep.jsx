import React from 'react';
import { FileText, HardHat, Building2 } from 'lucide-react';
import { fmt, categoryConfig } from './shared';

export default function ReviewStep({ form, suppliers = [], contractors = [] }) {
  const isNoCost = form.category === 'contractor_supplied' || form.category === 'client_supplied';
  const isPurchased = form.category === 'purchased_equipment';
  const isContractorSupplied = form.category === 'contractor_supplied';
  const isClientSupplied = form.category === 'client_supplied';
  const lineTotal = (Number(form.unit_cost) || 0) * (Number(form.quantity) || 1);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Review</p>
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-medium text-slate-800">{categoryConfig[form.category]?.label}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Description</span><span className="font-medium text-slate-800 text-right">{form.description}</span></div>
        {!isNoCost && form.supplier_id && <div className="flex justify-between"><span className="text-slate-500">Supplier</span><span className="font-medium text-slate-800">{suppliers.find((s) => s.id === form.supplier_id)?.name || '—'}</span></div>}
        {isContractorSupplied && <div className="flex justify-between"><span className="text-slate-500">Contractor</span><span className="font-medium text-slate-800">{contractors.find((c) => c.id === form.contractor_id)?.name || '—'}</span></div>}
        {isPurchased && form.po_number && <div className="flex justify-between"><span className="text-slate-500">PO Number</span><span className="font-medium text-slate-800 font-mono">{form.po_number}</span></div>}
        {!isNoCost && Number(form.unit_cost) > 0 && <div className="flex justify-between"><span className="text-slate-500">Line total</span><span className="font-bold text-slate-900">{fmt(lineTotal)}</span></div>}
        {form.order_slip_url && <div className="flex items-center gap-1.5 text-emerald-700"><FileText className="w-3.5 h-3.5" /> <span className="text-xs">Order slip attached</span></div>}
      </div>
      {isContractorSupplied && (
        <div className="text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2 border border-blue-200 flex items-center gap-1.5">
          <HardHat className="w-3.5 h-3.5" /> Contractor-supplied — no cost tracked, no driver collection needed.
        </div>
      )}
      {isClientSupplied && (
        <div className="text-xs text-slate-600 bg-slate-50 rounded-md px-3 py-2 border border-slate-200 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Client-supplied — informational only. No cost or charge is tracked.
        </div>
      )}
    </div>
  );
}