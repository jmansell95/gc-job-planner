import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PoundSterling, Plus, Trash2, Edit2, Check, X, TrendingUp, ChevronDown, ChevronUp,
  Truck, Wrench, Ruler, Percent, Calculator, Save
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const roleLabels = {
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};

const blankForm = () => ({
  category: 'hired_equipment', supplier_id: '', description: '',
  reference_number: '', start_date: '', end_date: '', unit_cost: '', quantity: '1',
  unit_label: 'day', vat_exempt: false, notes: '',
  delivery_notes: '', collection_notes: ''
});

export default function JobCostingManager({ job, staffCosts, totalCost, isDrillingJob, totalMeterage }) {
  const queryClient = useQueryClient();
  const [markup, setMarkup] = useState(job.markup_percentage ?? 0);
  const [vatRate, setVatRate] = useState(job.vat_rate ?? 20);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [showLabour, setShowLabour] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [savingItem, setSavingItem] = useState(false);

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: items = [] } = useQuery({
    queryKey: ['job-cost-items', job.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id })
  });

  const itemNet = (c) => (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1);
  const itemVat = (c) => c.vat_exempt ? 0 : itemNet(c) * (Number(vatRate) / 100);

  const equipmentNet = items.reduce((s, c) => s + itemNet(c), 0);
  const equipmentVat = items.reduce((s, c) => s + itemVat(c), 0);
  const labourNet = Number(totalCost) || 0;
  const labourVat = labourNet * (Number(vatRate) / 100);
  const internalNet = labourNet + equipmentNet;
  const internalVat = labourVat + equipmentVat;
  const internalTotal = internalNet + internalVat;
  const markupAmount = internalNet * (Number(markup) / 100);
  const clientNet = internalNet + markupAmount;
  const clientVat = clientNet * (Number(vatRate) / 100);
  const clientTotal = clientNet + clientVat;

  const configDirty = (job.markup_percentage ?? 0) !== (Number(markup) || 0) || (job.vat_rate ?? 20) !== (Number(vatRate) || 0);

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await base44.entities.Job.update(job.id, {
        markup_percentage: Number(markup) || 0,
        vat_rate: Number(vatRate) || 0
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSavingConfig(false);
  };

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

  const submitItem = async (e) => {
    e.preventDefault();
    setSavingItem(true);
    try {
      const payload = {
        job_id: job.id,
        category: form.category,
        supplier_id: form.supplier_id || '',
        description: form.description,
        reference_number: form.reference_number || '',
        start_date: form.start_date || '',
        end_date: form.end_date || '',
        unit_cost: Number(form.unit_cost) || 0,
        quantity: effectiveQty,
        unit_label: form.unit_label,
        vat_exempt: !!form.vat_exempt,
        delivery_notes: form.delivery_notes || '',
        collection_notes: form.collection_notes || '',
        notes: form.notes || ''
      };
      if (editingId) {
        await base44.entities.JobCostItem.update(editingId, payload);
      } else {
        await base44.entities.JobCostItem.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
      setAdding(false); setEditingId(null); setForm(blankForm());
    } catch (err) { console.error(err); }
    setSavingItem(false);
  };

  const editItem = (c) => {
    setEditingId(c.id);
    setForm({
      category: c.category, supplier_id: c.supplier_id || '', description: c.description,
      reference_number: c.reference_number || '',
      start_date: c.start_date || '', end_date: c.end_date || '',
      unit_cost: String(c.unit_cost ?? ''), quantity: String(c.quantity ?? '1'),
      unit_label: c.unit_label || 'each', vat_exempt: !!c.vat_exempt,
      delivery_notes: c.delivery_notes || '', collection_notes: c.collection_notes || '',
      notes: c.notes || ''
    });
    setAdding(true);
  };

  const deleteItem = async (id) => {
    if (!confirm('Remove this cost item?')) return;
    await base44.entities.JobCostItem.delete(id);
    queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <PoundSterling className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Costing & Billing</h2>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{items.length} items</span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Client-facing total banner */}
        <div className="hero-gradient rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-200" />
            <span className="text-xs font-medium text-emerald-100">Client Total (incl. VAT & markup)</span>
          </div>
          <p className="text-3xl font-bold">{fmt(clientTotal)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-emerald-100">
            <span>Net: {fmt(clientNet)}</span>
            <span>VAT ({Number(vatRate) || 0}%): {fmt(clientVat)}</span>
            <span>Markup: {Number(markup) || 0}%</span>
          </div>
        </div>

        {/* Internal cost summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Labour (net)</p>
            <p className="text-base font-bold text-slate-900 truncate">{fmt(labourNet)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Equipment (net)</p>
            <p className="text-base font-bold text-slate-900 truncate">{fmt(equipmentNet)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Internal total</p>
            <p className="text-base font-bold text-slate-900 truncate">{fmt(internalTotal)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Markup amount</p>
            <p className="text-base font-bold text-emerald-700 truncate">{fmt(markupAmount)}</p>
          </div>
        </div>

        {/* Markup & VAT config */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5"><Percent className="w-4 h-4 text-emerald-700" /> Markup %</label>
              <input type="number" min="0" step="0.1" value={markup} onChange={(e) => setMarkup(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5"><PoundSterling className="w-4 h-4 text-emerald-700" /> VAT rate %</label>
              <input type="number" min="0" step="0.1" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={saveConfig} disabled={savingConfig || !configDirty} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-medium hover:bg-emerald-800 transition disabled:opacity-50">
              {savingConfig ? <span>Saving...</span> : <><Save className="w-3.5 h-3.5" /> Save rates</>}
            </button>
            {configSaved && <span className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
            {!configDirty && !configSaved && <span className="text-xs text-slate-400">Rates applied to this job</span>}
          </div>
        </div>

        {/* Equipment & Hire items */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5"><Truck className="w-4 h-4 text-emerald-700" /> Equipment & Hire</h3>
            {!adding && (
              <button onClick={() => { setForm(blankForm()); setEditingId(null); setAdding(true); }} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            )}
          </div>

          {adding && (
            <form onSubmit={submitItem} className="border border-emerald-200 rounded-lg p-4 mb-3 space-y-3 bg-emerald-50/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, unit_label: e.target.value === 'hired_equipment' ? 'day' : 'each' })} className={inputCls}>
                    <option value="hired_equipment">Hired Equipment</option>
                    <option value="internal_equipment">Internal Equipment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
                  <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={inputCls} disabled={form.category !== 'hired_equipment'}>
                    <option value="">{form.category === 'hired_equipment' ? 'Select supplier (optional)' : 'N/A'}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="e.g. Transformer hire" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
                  <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="Asset tag, PO no., serial no." className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End date</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Unit cost (net) *</label>
                  <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} required placeholder="0.00" className={inputCls} />
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
                {form.unit_label === 'day' && form.start_date && form.end_date && (
                  <div className="sm:col-span-2 text-xs text-slate-500 bg-white rounded-md px-3 py-2 border border-slate-200">
                    Duration: <b>{daysFromForm()} days</b> × {fmt(form.unit_cost || 0)}/day = <b>{fmt((Number(form.unit_cost) || 0) * (daysFromForm() || 1))}</b> (net)
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2 cursor-pointer">
                  <input type="checkbox" checked={form.vat_exempt} onChange={(e) => setForm({ ...form, vat_exempt: e.target.checked })} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
                  VAT exempt (zero-rated item)
                </label>
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Notes</label>
                    <textarea value={form.delivery_notes} onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })} rows="2" placeholder="Delivery address, contact, timing" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Collection Notes</label>
                    <textarea value={form.collection_notes} onChange={(e) => setForm({ ...form, collection_notes: e.target.value })} rows="2" placeholder="Collection date, contact, return condition" className={inputCls} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingItem} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-50">{editingId ? 'Update' : 'Add'} item</button>
                <button type="button" onClick={() => { setAdding(false); setEditingId(null); setForm(blankForm()); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition">Cancel</button>
              </div>
            </form>
          )}

          {items.length === 0 && !adding ? (
            <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
              No equipment or hire items yet. Add hired equipment to track supplier costs.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(c => {
                const supplier = suppliers.find(s => s.id === c.supplier_id);
                const net = itemNet(c);
                return (
                  <div key={c.id} className="border border-slate-200 rounded-lg p-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      {c.category === 'hired_equipment'
                        ? <div className="w-full h-full bg-amber-50 rounded-lg flex items-center justify-center"><Truck className="w-4 h-4 text-amber-600" /></div>
                        : <div className="w-full h-full bg-blue-50 rounded-lg flex items-center justify-center"><Wrench className="w-4 h-4 text-blue-600" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">{c.description}</p>
                        {c.reference_number && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium font-mono">Ref: {c.reference_number}</span>}
                        {c.vat_exempt && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">VAT exempt</span>}
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{c.category === 'hired_equipment' ? 'Hired' : 'Internal'}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.start_date && c.end_date ? `${format(new Date(c.start_date + 'T00:00:00'), 'dd MMM')} → ${format(new Date(c.end_date + 'T00:00:00'), 'dd MMM')}` : ''}
                        {supplier && ` · ${supplier.name}`}
                        {` · ${c.quantity} ${c.unit_label}${c.quantity > 1 ? 's' : ''}`}
                      </p>
                      {(c.delivery_notes || c.collection_notes) && (
                        <div className="mt-1.5 space-y-1">
                          {c.delivery_notes && (
                            <div className="flex items-start gap-1.5 text-xs text-slate-500">
                              <Truck className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                              <span><span className="font-medium text-slate-600">Delivery:</span> {c.delivery_notes}</span>
                            </div>
                          )}
                          {c.collection_notes && (
                            <div className="flex items-start gap-1.5 text-xs text-slate-500">
                              <Truck className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span><span className="font-medium text-slate-600">Collection:</span> {c.collection_notes}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-900">{fmt(net)}</p>
                      <p className="text-[10px] text-slate-400">net</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => editItem(c)} className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteItem(c.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Labour breakdown */}
        {staffCosts && staffCosts.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <button onClick={() => setShowLabour(!showLabour)} className="flex items-center justify-between w-full text-sm font-medium text-slate-700 hover:text-emerald-700 transition">
              <span className="inline-flex items-center gap-2"><Calculator className="w-3.5 h-3.5" /> Labour breakdown ({staffCosts.length} staff)</span>
              {showLabour ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showLabour && (
              <div className="mt-3 space-y-2">
                {staffCosts.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-900">{sc.name}</span>
                      {sc.costType === 'meterage'
                        ? <span className="text-xs text-slate-400 ml-2">{sc.meterage}m × £{sc.meterageRate}/m</span>
                        : sc.costType === 'timesheet'
                        ? <span className="text-xs text-slate-400 ml-2">{(sc.timesheetMinutes / 60).toFixed(1)}h × £{sc.hourlyRate.toFixed(0)}/h</span>
                        : <span className="text-xs text-slate-400 ml-2">{sc.shifts} shifts × £{sc.dayRate}</span>}
                    </div>
                    <span className="font-semibold text-slate-700 flex-shrink-0">{fmt(sc.cost)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Labour total</span>
                  <span className="font-bold text-emerald-700">{fmt(totalCost)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}