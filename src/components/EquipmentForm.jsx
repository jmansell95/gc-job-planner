import React from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { Package, Calendar, HardHat, User, Lock } from 'lucide-react';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";
const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EquipmentForm({ form, setForm, onSubmit, onCancel, saving = false, editing = false, suppliers = [], contractors = [], defaultDates = null, catalogueItems = [] }) {
  const isContractorSupplied = form.category === 'contractor_supplied';
  const isSynced = !!form.site_asset_id;

  const daysFromForm = () => {
    if (form.start_date && form.end_date) {
      const d = differenceInCalendarDays(new Date(form.end_date + 'T00:00:00'), new Date(form.start_date + 'T00:00:00')) + 1;
      return d > 0 ? d : 1;
    }
    return null;
  };
  const effectiveQty = form.unit_label === 'day'
    ? (daysFromForm() ?? (Number(form.quantity) || 1))
    : (Number(form.quantity) || 1);
  const lineTotal = (Number(form.unit_cost) || 0) * effectiveQty;

  const submit = () => {
    if (!form.description?.trim()) return;
    if (!isContractorSupplied && !form.unit_cost) return;
    const payload = isContractorSupplied
      ? { ...form, unit_cost: 0, quantity: effectiveQty, supplier_id: '', vat_exempt: false }
      : { ...form, contractor_id: '', quantity: effectiveQty };
    onSubmit(payload);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  };

  const selectFromCatalogue = (id) => {
    if (!id) return;
    const item = catalogueItems.find(c => c.id === id);
    if (!item) return;
    setForm({
      ...form,
      description: item.description || form.description,
      category: item.category || form.category,
      supplier_id: item.default_supplier_id || form.supplier_id,
      reference_number: item.reference_number || form.reference_number,
      responsible_person: item.responsible_person || form.responsible_person,
      site_asset_id: item.site_asset_id || form.site_asset_id,
      unit_cost: String(item.default_unit_cost ?? form.unit_cost),
      unit_label: item.default_unit_label || form.unit_label,
      vat_exempt: !!item.default_vat_exempt,
    });
  };

  return (
    <div onKeyDown={handleKeyDown} className="border border-emerald-200 rounded-lg p-4 space-y-3 bg-emerald-50/30">
      {catalogueItems.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quick add from catalogue</label>
          <select value="" onChange={(e) => { selectFromCatalogue(e.target.value); e.target.value = ''; }} className={inputCls}>
            <option value="">Select from catalogue…</option>
            {catalogueItems.map(c => <option key={c.id} value={c.id}>{c.description} · {fmt(Number(c.default_unit_cost) || 0)}/{c.default_unit_label || 'each'}</option>)}
          </select>
        </div>
      )}
      {isSynced && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2 border border-blue-200">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Synced from GC Compliance Manager — description, category and reference are locked. Only cost and hire details can be edited.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
          <select value={form.category} disabled={isSynced} onChange={(e) => {
            const v = e.target.value;
            setForm({
              ...form,
              category: v,
              unit_label: v === 'hired_equipment' ? 'day' : 'each',
              supplier_id: v === 'internal_equipment' || v === 'contractor_supplied' ? '' : form.supplier_id,
              contractor_id: v === 'contractor_supplied' ? form.contractor_id : '',
              unit_cost: v === 'contractor_supplied' ? 0 : form.unit_cost
            });
          }} className={inputCls}>
            <option value="hired_equipment">Hired Equipment</option>
            <option value="purchased_equipment">Purchased Equipment</option>
            <option value="internal_equipment">Internal Equipment</option>
            <option value="contractor_supplied">Contractor Supplied</option>
          </select>
        </div>

        {/* Supplier or Contractor selector */}
        {isContractorSupplied ? (
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
              <HardHat className="w-3 h-3 text-blue-600" /> Contractor
            </label>
            <select value={form.contractor_id || ''} onChange={(e) => setForm({ ...form, contractor_id: e.target.value })} className={inputCls}>
              <option value="">Select contractor…</option>
              {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
            <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={inputCls} disabled={form.category === 'internal_equipment'}>
              <option value="">{form.category === 'internal_equipment' ? 'N/A' : 'Select supplier (optional)'}</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Transformer hire, Excavator 5-ton" className={`${inputCls} ${isSynced ? 'bg-slate-50 text-slate-500' : ''}`} readOnly={isSynced} />
        </div>

        {form.responsible_person && (
          <div className="sm:col-span-2">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
              <User className="w-3 h-3 text-slate-400" /> Responsible Person
            </label>
            <input value={form.responsible_person} readOnly className={`${inputCls} bg-slate-50 text-slate-500`} />
            <p className="text-[10px] text-slate-400 mt-1">Synced from GC Compliance Manager</p>
          </div>
        )}

        {isContractorSupplied ? (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
            <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value, unit_label: 'each' })} className={inputCls} />
          </div>
        ) : (
          <>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                <Package className="w-3 h-3 text-emerald-700" /> PO Number
              </label>
              <input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} placeholder="e.g. PO-1042 (optional)" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
              <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="Asset tag / serial no." className={`${inputCls} ${isSynced ? 'bg-slate-50 text-slate-500' : ''}`} readOnly={isSynced} />
            </div>
            {form.unit_label === 'day' && (
              <>
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
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unit cost (net) *</label>
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
            {form.unit_label !== 'day' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
                <input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} />
              </div>
            )}
          </>
        )}
      </div>

      {!isContractorSupplied && Number(form.unit_cost) > 0 && (
        <div className="text-xs text-slate-600 bg-white rounded-md px-3 py-2 border border-slate-200 flex items-center justify-between">
          <span>Line total (net): {effectiveQty} × {fmt(Number(form.unit_cost) || 0)}</span>
          <span className="font-bold text-slate-900">{fmt(lineTotal)}</span>
        </div>
      )}
      {isContractorSupplied && (
        <div className="text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2 border border-blue-200 flex items-center gap-1.5">
          <HardHat className="w-3.5 h-3.5" /> Contractor-supplied — no cost tracked, no driver collection needed. The contractor delivers this directly to site.
        </div>
      )}
      {!isContractorSupplied && (
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.vat_exempt} onChange={(e) => setForm({ ...form, vat_exempt: e.target.checked })} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
          VAT exempt (zero-rated item)
        </label>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={submit} disabled={saving || !form.description?.trim() || (!isContractorSupplied && !form.unit_cost)} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-50">
          {saving ? 'Saving...' : editing ? 'Update item' : 'Add item'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition">Cancel</button>
      </div>
    </div>
  );
}