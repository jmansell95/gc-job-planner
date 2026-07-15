import React, { useState, useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import {
  Package, Calendar, HardHat, User, Lock, Receipt, Boxes, Building2, Upload, FileText, Loader2, X, Check, ChevronRight, ChevronLeft, Truck, ShoppingCart, Wrench, Hammer
} from 'lucide-react';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";
const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const categoryConfig = {
  hired_equipment: { label: 'Hired Equipment', icon: Truck, desc: 'Hired from a supplier', color: 'amber' },
  purchased_equipment: { label: 'Purchased Equipment', icon: ShoppingCart, desc: 'Bought for this job (needs PO + order slip)', color: 'purple' },
  internal_equipment: { label: 'Owned Equipment', icon: Wrench, desc: 'Owned by us (synced from Asset Panda)', color: 'blue' },
  contractor_supplied: { label: 'Contractor Supplied', icon: HardHat, desc: 'Supplied by the contractor — no cost tracked', color: 'indigo' },
  client_supplied: { label: 'Client Supplied', icon: Hammer, desc: 'Delivered by client — informational only', color: 'slate' },
};

export default function EquipmentForm({ form, setForm, onSubmit, onCancel, saving = false, editing = false, suppliers = [], contractors = [], defaultDates = null, catalogueItems = [], rateCardItems = [], ownedAssets = [] }) {
  const [orderSlipFile, setOrderSlipFile] = useState(null);
  const [uploadingOrderSlip, setUploadingOrderSlip] = useState(false);
  const [step, setStep] = useState(1);

  const isContractorSupplied = form.category === 'contractor_supplied';
  const isClientSupplied = form.category === 'client_supplied';
  const isPurchased = form.category === 'purchased_equipment';
  const isInternal = form.category === 'internal_equipment';
  const isNoCost = isContractorSupplied || isClientSupplied;
  const isSynced = !!form.site_asset_id;
  const isHiredByDay = form.unit_label === 'day' && !isPurchased;

  const daysFromForm = () => {
    if (form.start_date && form.end_date) {
      const d = differenceInCalendarDays(new Date(form.end_date + 'T00:00:00'), new Date(form.start_date + 'T00:00:00')) + 1;
      return d > 0 ? d : 1;
    }
    return null;
  };
  const effectiveQty = form.unit_label === 'day' ? (daysFromForm() ?? (Number(form.quantity) || 1)) : (Number(form.quantity) || 1);
  const lineTotal = (Number(form.unit_cost) || 0) * effectiveQty;

  // Step 2 is skipped for client/contractor supplied (they only need description + qty + notes)
  const totalSteps = isNoCost ? 3 : (isPurchased ? 4 : 3);

  const scopedRateItems = (rateCardItems || []).filter(i => {
    if (i.is_active === false) return false;
    if (isInternal) return i.rate_card_source !== 'supplier';
    if (!form.supplier_id) return i.rate_card_source !== 'supplier';
    return i.rate_card_source === 'supplier' && i.supplier_id === form.supplier_id;
  });

  const pickFromRateCard = (id) => {
    if (!id) return;
    const item = (rateCardItems || []).find(r => r.id === id);
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

  const pickOwnedAsset = (id) => {
    if (!id) return;
    const asset = (ownedAssets || []).find(a => a.id === id);
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

  const pickFromCatalogue = (id) => {
    if (!id) return;
    const item = (catalogueItems || []).find(c => c.id === id);
    if (!item) return;
    setForm({
      ...form,
      category: item.category || form.category,
      description: item.description || form.description,
      reference_number: item.reference_number || form.reference_number,
      responsible_person: item.responsible_person || form.responsible_person,
      site_asset_id: item.site_asset_id || form.site_asset_id,
      supplier_id: item.default_supplier_id || form.supplier_id,
      unit_cost: String(item.default_unit_cost ?? ''),
      unit_label: item.default_unit_label || form.unit_label || 'day',
      vat_exempt: !!item.default_vat_exempt,
    });
  };

  // Validation per step
  const stepValid = useMemo(() => {
    if (step === 1) {
      if (isContractorSupplied) return !!form.contractor_id;
      if (isClientSupplied) return true;
      if (isInternal) return true;
      // hired / purchased need supplier for purchased (required), optional for hired
      if (isPurchased) return !!form.supplier_id;
      return true;
    }
    if (step === 2) {
      if (!form.description?.trim()) return false;
      if (!isNoCost && !form.unit_cost) return false;
      if (isPurchased && !form.po_number?.trim()) return false;
      return true;
    }
    return true;
  }, [step, form]);

  const submit = async () => {
    if (!form.description?.trim()) return;
    if (!isNoCost && !form.unit_cost) return;
    if (isPurchased && !form.po_number?.trim()) return;

    let payload = { ...form };

    if (isPurchased && orderSlipFile) {
      setUploadingOrderSlip(true);
      try {
        const res = await base44.integrations.Core.UploadFile({ file: orderSlipFile });
        payload.order_slip_url = res.file_url;
        payload.order_slip_name = orderSlipFile.name;
      } catch (err) {
        setUploadingOrderSlip(false);
        return;
      }
      setUploadingOrderSlip(false);
    }

    if (isNoCost) {
      payload = { ...payload, unit_cost: 0, quantity: effectiveQty, supplier_id: '', contractor_id: isContractorSupplied ? form.contractor_id : '', vat_exempt: false, order_slip_url: '', order_slip_name: '' };
    } else {
      payload = { ...payload, contractor_id: '' };
    }

    if (isPurchased) {
      payload = { ...payload, start_date: '', end_date: '' };
    }

    onSubmit(payload);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); }
  };

  const changeCategory = (v) => {
    setForm({
      ...form,
      category: v,
      unit_label: v === 'hired_equipment' ? 'day' : 'each',
      supplier_id: (v === 'internal_equipment' || v === 'contractor_supplied' || v === 'client_supplied') ? '' : form.supplier_id,
      contractor_id: v === 'contractor_supplied' ? form.contractor_id : '',
      unit_cost: (v === 'contractor_supplied' || v === 'client_supplied') ? 0 : form.unit_cost,
      rate_card_item_id: (v === 'contractor_supplied' || v === 'client_supplied') ? '' : form.rate_card_item_id,
      po_number: v === 'purchased_equipment' ? form.po_number : '',
      start_date: v === 'purchased_equipment' ? '' : form.start_date,
      end_date: v === 'purchased_equipment' ? '' : form.end_date,
    });
    setStep(1);
  };

  const canNext = stepValid;
  const isLastStep = step >= totalSteps;

  return (
    <div onKeyDown={handleKeyDown} className="space-y-4">
      {/* Synced banner */}
      {isSynced && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2 border border-blue-200">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Synced from GC Compliance Manager / Asset Panda — description and reference are locked. Only billing and hire details can be edited.
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const s = i + 1;
          const active = s === step;
          const done = s < step;
          return (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition ${active ? 'bg-emerald-700 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              {i < totalSteps - 1 && <div className={`flex-1 h-0.5 rounded ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 1: Category & Source */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">How is this item sourced? *</label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(categoryConfig).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const active = form.category === key;
                const colorClasses = {
                  amber: 'border-amber-400 bg-amber-50 text-amber-800',
                  purple: 'border-purple-400 bg-purple-50 text-purple-800',
                  blue: 'border-blue-400 bg-blue-50 text-blue-800',
                  indigo: 'border-indigo-400 bg-indigo-50 text-indigo-800',
                  slate: 'border-slate-400 bg-slate-50 text-slate-800',
                };
                return (
                  <button key={key} type="button" disabled={isSynced} onClick={() => changeCategory(key)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition ${active ? colorClasses[cfg.color] : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'} ${isSynced ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{cfg.label}</p>
                      <p className="text-xs text-slate-500">{cfg.desc}</p>
                    </div>
                    {active && <Check className="w-4 h-4 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Equipment catalogue picker */}
          {!isNoCost && (catalogueItems || []).length > 0 && !isSynced && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                <Package className="w-3 h-3 text-emerald-700" /> Pick from equipment catalogue
              </label>
              <select value="" onChange={(e) => { pickFromCatalogue(e.target.value); e.target.value = ''; }} className={inputCls}>
                <option value="">Select a catalogue item to auto-fill…</option>
                {catalogueItems.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.description}{c.default_unit_cost ? ` · ${fmt(c.default_unit_cost)}/${c.default_unit_label || 'day'}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Source selection */}
          {isContractorSupplied && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><HardHat className="w-3 h-3 text-blue-600" /> Contractor *</label>
              <select value={form.contractor_id || ''} onChange={(e) => setForm({ ...form, contractor_id: e.target.value })} className={inputCls}>
                <option value="">Select contractor…</option>
                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {isClientSupplied && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client delivery notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Who delivers it / when (optional)" className={inputCls} />
            </div>
          )}

          {!isNoCost && !isInternal && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Supplier {isPurchased && <span className="text-red-500">*</span>}
                {!isPurchased && <span className="text-slate-400 font-normal"> (optional)</span>}
              </label>
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value, rate_card_item_id: '' })} className={inputCls}>
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Owned asset picker */}
          {isInternal && (ownedAssets || []).length > 0 && !isSynced && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                <Boxes className="w-3 h-3 text-blue-600" /> Pick owned equipment (Asset Panda)
              </label>
              <select value="" onChange={(e) => { pickOwnedAsset(e.target.value); e.target.value = ''; }} className={inputCls}>
                <option value="">Select from Asset Panda inventory…</option>
                {ownedAssets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.daily_billing_rate ? ` · ${fmt(a.daily_billing_rate)}/day` : ''}{a.stock_level && a.stock_level !== 'unknown' ? ` · ${a.stock_level.replace('_', ' ')}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Rate card picker (after source is chosen) */}
          {!isNoCost && scopedRateItems.length > 0 && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                <Receipt className="w-3 h-3 text-emerald-700" /> Pick from rate card {isInternal ? '(our rate card)' : form.supplier_id ? `(this supplier's rates)` : '(our rate card)'}
              </label>
              <select value="" onChange={(e) => { pickFromRateCard(e.target.value); e.target.value = ''; }} className={inputCls}>
                <option value="">Select a rate to auto-fill…</option>
                {scopedRateItems.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.description} · {r.price != null ? fmt(r.price) : (r.price_text || 'POA')}{r.unit ? `/${r.unit}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Details & Billing */}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Transformer hire, Excavator 5-ton" className={`${inputCls} ${isSynced ? 'bg-slate-50 text-slate-500' : ''}`} readOnly={isSynced} />
          </div>

          {form.responsible_person && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><User className="w-3 h-3 text-slate-400" /> Responsible Person</label>
              <input value={form.responsible_person} readOnly className={`${inputCls} bg-slate-50 text-slate-500`} />
              <p className="text-[10px] text-slate-400 mt-1">Synced from GC Compliance Manager</p>
            </div>
          )}

          {isNoCost ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
              <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value, unit_label: 'each' })} className={inputCls} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                  <Package className="w-3 h-3 text-emerald-700" /> PO Number {isPurchased && <span className="text-red-500">*</span>}
                </label>
                <input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} placeholder={isPurchased ? "e.g. PO-1042 (required)" : "e.g. PO-1042 (optional)"} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
                <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="Asset tag / serial no." className={`${inputCls} ${isSynced ? 'bg-slate-50 text-slate-500' : ''}`} readOnly={isSynced} />
              </div>
              {isHiredByDay && (
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
              {form.unit_label !== 'day' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
                  <input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} />
                </div>
              )}
            </div>
          )}

          {!isNoCost && (
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.vat_exempt} onChange={(e) => setForm({ ...form, vat_exempt: e.target.checked })} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
              VAT exempt (zero-rated item)
            </label>
          )}

          {!isNoCost && Number(form.unit_cost) > 0 && (
            <div className="text-xs text-slate-600 bg-white rounded-md px-3 py-2 border border-slate-200 flex items-center justify-between">
              <span>Line revenue: {effectiveQty} × {fmt(Number(form.unit_cost) || 0)}</span>
              <span className="font-bold text-slate-900">{fmt(lineTotal)}</span>
            </div>
          )}
          {form.rate_card_item_id && !isNoCost && (
            <div className="text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Linked to a rate card item — this is chargeable to the client.
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Order slip (purchased) OR notes/review (others) */}
      {step === 3 && isPurchased && !isNoCost && (
        <div className="space-y-3">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
              <Upload className="w-3 h-3 text-emerald-700" /> Order Slip / Purchase Document <span className="text-red-500">*</span>
            </label>
            {form.order_slip_url && !orderSlipFile && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 mb-2">
                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                <a href={form.order_slip_url} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium truncate">{form.order_slip_name || 'View order slip'}</a>
                <button type="button" onClick={() => setForm({ ...form, order_slip_url: '', order_slip_name: '' })} className="ml-auto text-slate-400 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {!form.order_slip_url && (
              <input type="file" accept=".pdf,image/*,.doc,.docx,.xlsx,.xls" onChange={e => setOrderSlipFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 cursor-pointer" />
            )}
            {orderSlipFile && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 mt-1.5">
                <FileText className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{orderSlipFile.name}</span>
                <button type="button" onClick={() => setOrderSlipFile(null)} className="ml-auto text-slate-400 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1">Upload the supplier's order confirmation or purchase document.</p>
          </div>
          {!isClientSupplied && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
            </div>
          )}
        </div>
      )}

      {/* STEP 3 (no-cost) / STEP 4 (purchased): Review */}
      {(step === 3 && isNoCost) || (step === 4 && isPurchased) ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Review</p>
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-medium text-slate-800">{categoryConfig[form.category]?.label}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Description</span><span className="font-medium text-slate-800 text-right">{form.description}</span></div>
            {!isNoCost && form.supplier_id && <div className="flex justify-between"><span className="text-slate-500">Supplier</span><span className="font-medium text-slate-800">{suppliers.find(s => s.id === form.supplier_id)?.name || '—'}</span></div>}
            {isContractorSupplied && <div className="flex justify-between"><span className="text-slate-500">Contractor</span><span className="font-medium text-slate-800">{contractors.find(c => c.id === form.contractor_id)?.name || '—'}</span></div>}
            {isPurchased && form.po_number && <div className="flex justify-between"><span className="text-slate-500">PO Number</span><span className="font-medium text-slate-800 font-mono">{form.po_number}</span></div>}
            {!isNoCost && Number(form.unit_cost) > 0 && <div className="flex justify-between"><span className="text-slate-500">Line total</span><span className="font-bold text-slate-900">{fmt(lineTotal)}</span></div>}
            {(form.order_slip_url || orderSlipFile) && <div className="flex items-center gap-1.5 text-emerald-700"><FileText className="w-3.5 h-3.5" /> <span className="text-xs">Order slip attached</span></div>}
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
          {isNoCost && !isClientSupplied && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
            </div>
          )}
        </div>
      ) : null}

      {/* Navigation */}
      <div className="flex gap-2 pt-1">
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        {!isLastStep ? (
          <button type="button" onClick={() => canNext && setStep(step + 1)} disabled={!canNext} className="flex-1 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-40 flex items-center justify-center gap-1.5">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={saving || uploadingOrderSlip || !form.description?.trim() || (!isNoCost && !form.unit_cost) || (isPurchased && !form.po_number?.trim())} className="flex-1 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {uploadingOrderSlip ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : saving ? 'Saving...' : editing ? 'Update item' : 'Add item'}
          </button>
        )}
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition">Cancel</button>
      </div>
    </div>
  );
}