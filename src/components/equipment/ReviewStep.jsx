import React from 'react';
import { FileText, HardHat, Building2, Factory, Truck, MapPin, PenLine, CheckCircle2 } from 'lucide-react';
import { fmt, categoryConfig } from './shared';
import SignaturePad from '@/components/staff/SignaturePad';

export default function ReviewStep({ form, setForm, suppliers = [], contractors = [], clients = [] }) {
  const isNoCost = form.category === 'contractor_supplied' || form.category === 'client_supplied';
  const isPurchased = form.category === 'purchased_equipment';
  const isContractorSupplied = form.category === 'contractor_supplied';
  const isClientSupplied = form.category === 'client_supplied';
  const isInternal = form.category === 'internal_equipment';
  const isLabour = form.category === 'labour';
  const lineTotal = (Number(form.unit_cost) || 0) * (Number(form.quantity) || 1);
  const canBeOnSite = !isNoCost && !isLabour;
  const hasSignature = !!form.on_site_signature;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Review</p>
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-medium text-slate-800">{categoryConfig[form.category]?.label}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Description</span><span className="font-medium text-slate-800 text-right">{form.description}</span></div>
        {!isNoCost && form.supplier_id && <div className="flex justify-between"><span className="text-slate-500">Supplier</span><span className="font-medium text-slate-800">{suppliers.find((s) => s.id === form.supplier_id)?.name || '—'}</span></div>}
        {isContractorSupplied && <div className="flex justify-between"><span className="text-slate-500">Contractor</span><span className="font-medium text-slate-800">{contractors.find((c) => c.id === form.contractor_id)?.name || '—'}</span></div>}
        {isClientSupplied && <div className="flex justify-between"><span className="text-slate-500">Client</span><span className="font-medium text-slate-800">{clients.find((c) => c.id === form.client_id)?.name || '—'}</span></div>}
        {form.reference_number && <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-medium text-slate-800 font-mono">{form.reference_number}</span></div>}
        {form.responsible_person && <div className="flex justify-between"><span className="text-slate-500">Responsible</span><span className="font-medium text-slate-800">{form.responsible_person}</span></div>}
        {isPurchased && form.po_number && <div className="flex justify-between"><span className="text-slate-500">PO Number</span><span className="font-medium text-slate-800 font-mono">{form.po_number}</span></div>}
        {!isNoCost && Number(form.unit_cost) > 0 && <div className="flex justify-between"><span className="text-slate-500">Line total</span><span className="font-bold text-slate-900">{fmt(lineTotal)}</span></div>}
        {isLabour && form.staff_id && <div className="flex justify-between"><span className="text-slate-500">Staff member</span><span className="font-medium text-slate-800">{form.responsible_person || '—'}</span></div>}
        {form.start_date && form.end_date && <div className="flex justify-between"><span className="text-slate-500">Dates</span><span className="font-medium text-slate-800">{form.start_date} → {form.end_date}</span></div>}
        {form.order_slip_url && <div className="flex items-center gap-1.5 text-emerald-700"><FileText className="w-3.5 h-3.5" /> <span className="text-xs">Order slip attached</span></div>}
        {form.delivery_notes && <div className="flex items-center gap-1.5 text-slate-600"><Truck className="w-3.5 h-3.5" /> <span className="text-xs">{form.delivery_notes}</span></div>}
      </div>
      {isInternal && form.site_asset_id && (
        <div className="text-xs text-indigo-700 bg-indigo-50 rounded-md px-3 py-2 border border-indigo-200 flex items-center gap-1.5">
          <Factory className="w-3.5 h-3.5" /> Linked to an Asset Panda inventory item.
        </div>
      )}
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
      {canBeOnSite && (
        <>
          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition">
            <input type="checkbox" checked={!!form.already_on_site}
              onChange={(e) => setForm(f => ({ ...f, already_on_site: e.target.checked, on_site_signature: e.target.checked ? f.on_site_signature : null }))}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Already on site</p>
                <p className="text-xs text-slate-500">Skip the yard/load planning — mark this item as already delivered to the job site.</p>
              </div>
            </div>
          </label>
          {form.already_on_site && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <PenLine className="w-4 h-4 text-emerald-700" />
                <p className="text-sm font-semibold text-emerald-800">Sign to confirm on-site receipt</p>
                {hasSignature && <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" />}
              </div>
              <p className="text-xs text-slate-500">Draw your signature below to confirm this item is present on site. This is recorded as proof of receipt.</p>
              <SignaturePad onChange={(dataUrl) => setForm(f => ({ ...f, on_site_signature: dataUrl }))} />
              {!hasSignature && (
                <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <PenLine className="w-3 h-3" /> Signature required to add this item as on-site.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}