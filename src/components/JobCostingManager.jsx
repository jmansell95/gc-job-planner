import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PoundSterling, Plus, Trash2, Edit2, Check, X, TrendingUp, ChevronDown, ChevronUp,
  Truck, Wrench, Percent, Calculator, Save, Package, FileCheck, Undo2, Upload, ExternalLink, AlertTriangle, ShoppingCart,
  ShieldCheck, ShieldAlert, ShieldX, Clock, MapPin, CheckCircle2
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const blankForm = () => ({
  category: 'hired_equipment', supplier_id: '', description: '',
  reference_number: '', po_number: '', start_date: '', end_date: '',
  unit_cost: '', quantity: '1', unit_label: 'day', vat_exempt: false, notes: ''
});

const complianceBadge = {
  compliant: { label: 'Compliant', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ShieldCheck },
  expiring: { label: 'Expiring', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: ShieldAlert },
  expired: { label: 'Expired', cls: 'bg-red-50 text-red-700 border-red-200', icon: ShieldX },
  unknown: { label: 'Check', cls: 'bg-slate-50 text-slate-500 border-slate-200', icon: ShieldAlert }
};

const locationBadge = {
  yard: { label: 'At Depot', cls: 'bg-slate-100 text-slate-500', icon: Clock },
  in_transit: { label: 'In Transit', cls: 'bg-blue-50 text-blue-700 border border-blue-200', icon: Truck },
  site: { label: 'On Site', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: MapPin },
  returned: { label: 'Returned', cls: 'bg-teal-50 text-teal-700 border border-teal-200', icon: CheckCircle2 }
};

function BudgetMarginTracker({ budget, actualNet, clientNet, markup }) {
  const hasBudget = budget > 0;
  const profit = clientNet - actualNet;
  const marginPct = clientNet > 0 ? (profit / clientNet) * 100 : 0;
  const variance = hasBudget ? budget - actualNet : 0;
  const overBudget = hasBudget && actualNet > budget;
  const budgetPct = hasBudget ? Math.min((actualNet / budget) * 100, 100) : 0;

  if (!hasBudget && actualNet === 0) return null;

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-emerald-700" />
        <h3 className="text-sm font-semibold text-slate-800">Budget & Margin</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-400">Budget</p>
          <p className="text-base font-bold text-slate-900 truncate">{hasBudget ? fmt(budget) : 'Not set'}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-400">Actual cost (net)</p>
          <p className={`text-base font-bold truncate ${overBudget ? 'text-red-600' : 'text-slate-900'}`}>{fmt(actualNet)}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-400">{hasBudget ? 'Variance' : 'Profit'}</p>
          <p className={`text-base font-bold truncate ${hasBudget ? (overBudget ? 'text-red-600' : 'text-emerald-700') : 'text-emerald-700'}`}>
            {hasBudget ? `${variance >= 0 ? '+' : ''}${fmt(variance)}` : fmt(profit)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-400">Margin</p>
          <p className="text-base font-bold text-emerald-700 truncate">{marginPct.toFixed(1)}%</p>
        </div>
      </div>

      {hasBudget && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500 font-medium">Budget used</span>
            <span className={overBudget ? 'text-red-600 font-semibold' : 'text-slate-600'}>
              {budgetPct.toFixed(0)}%{overBudget && ` · ${fmt(actualNet - budget)} over`}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${budgetPct}%` }} />
          </div>
          {overBudget && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              This job is over budget by {fmt(actualNet - budget)}.
            </div>
          )}
        </div>
      )}
      {!hasBudget && (
        <p className="text-xs text-slate-400 mt-2">Set a job budget in the job details to track spend against it.</p>
      )}
    </div>
  );
}

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
  const [hireFilter, setHireFilter] = useState('active');
  const [applyingPreset, setApplyingPreset] = useState(false);
  const { toast } = useToast();

  // Off-hire modal state
  const [offHiringId, setOffHiringId] = useState(null);
  const [offHireDate, setOffHireDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [offHireFile, setOffHireFile] = useState(null);
  const [uploadingOffHire, setUploadingOffHire] = useState(false);
  const offHireFileRef = useRef(null);

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: items = [] } = useQuery({
    queryKey: ['job-cost-items', job.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id })
  });
  const { data: deliveries = [] } = useQuery({
    queryKey: ['job-deliveries-costing', job.id],
    queryFn: () => base44.entities.DeliveryLog.filter({ job_id: job.id })
  });
  const { data: siteAssets = [] } = useQuery({
    queryKey: ['site-assets-costing'],
    queryFn: () => base44.entities.SiteAsset.list()
  });
  const { data: jobTimesheets = [] } = useQuery({
    queryKey: ['job-timesheets-costing', job.id],
    queryFn: () => base44.entities.Timesheet.filter({ job_id: job.id })
  });
  const { data: presets = [] } = useQuery({
    queryKey: ['cost-presets-active'],
    queryFn: async () => {
      const list = await base44.entities.CostPreset.filter({ is_active: true });
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
    }
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
  const deliveryCharges = deliveries.filter(d => d.chargeable !== false).reduce((s, d) => s + (Number(d.charge_amount) || 0), 0);
  const taskCharges = jobTimesheets.filter(t => t.chargeable && !t.is_break).reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);
  const additionalCharges = deliveryCharges + taskCharges;
  const clientNet = internalNet + markupAmount + additionalCharges;
  const clientVat = clientNet * (Number(vatRate) / 100);
  const clientTotal = clientNet + clientVat;

  const activeItems = items.filter(c => (c.hire_status || 'active') !== 'off_hired');
  const returnedItems = items.filter(c => c.hire_status === 'off_hired');
  const visibleItems = hireFilter === 'active' ? activeItems : returnedItems;

  const getItemLocation = (item) => {
    const loc = item.current_location || 'yard';
    return { status: loc, delivery: null };
  };

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
        po_number: form.po_number || '',
        start_date: form.start_date || '',
        end_date: form.end_date || '',
        unit_cost: Number(form.unit_cost) || 0,
        quantity: effectiveQty,
        unit_label: form.unit_label,
        vat_exempt: !!form.vat_exempt,
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

  const applyPreset = async (e) => {
    const presetId = e.target.value;
    if (!presetId) return;
    e.target.value = '';
    setApplyingPreset(true);
    try {
      const presetItems = await base44.entities.PresetItem.filter({ preset_id: presetId });
      if (presetItems.length === 0) {
        toast({ title: 'Preset is empty', description: 'Add items to this preset in Settings first.' });
        return;
      }
      const preset = presets.find(p => p.id === presetId);
      const payload = presetItems.map(item => ({
        job_id: job.id,
        category: item.category || 'hired_equipment',
        supplier_id: item.supplier_id || '',
        description: item.description,
        reference_number: item.reference_number || '',
        po_number: '',
        site_asset_id: item.site_asset_id || '',
        start_date: '',
        end_date: '',
        unit_cost: Number(item.unit_cost) || 0,
        quantity: Number(item.quantity) || 1,
        unit_label: item.unit_label || 'each',
        vat_exempt: !!item.vat_exempt,
        hire_status: 'active',
        current_location: 'yard',
        notes: ''
      }));
      await base44.entities.JobCostItem.bulkCreate(payload);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
      toast({ title: `Added ${payload.length} items`, description: `From "${preset?.name || 'Preset'}" — adjust prices or dates as needed.` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not apply preset.' });
    }
    setApplyingPreset(false);
  };

  const editItem = (c) => {
    setEditingId(c.id);
    setForm({
      category: c.category, supplier_id: c.supplier_id || '', description: c.description,
      reference_number: c.reference_number || '', po_number: c.po_number || '',
      start_date: c.start_date || '', end_date: c.end_date || '',
      unit_cost: String(c.unit_cost ?? ''), quantity: String(c.quantity ?? '1'),
      unit_label: c.unit_label || 'each', vat_exempt: !!c.vat_exempt,
      notes: c.notes || ''
    });
    setAdding(true);
  };

  const deleteItem = async (id) => {
    if (!confirm('Remove this cost item?')) return;
    await base44.entities.JobCostItem.delete(id);
    queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
  };

  const openOffHire = (c) => {
    setOffHiringId(c.id);
    setOffHireDate(format(new Date(), 'yyyy-MM-dd'));
    setOffHireFile(null);
    if (offHireFileRef.current) offHireFileRef.current.value = '';
  };

  const confirmOffHire = async () => {
    setUploadingOffHire(true);
    try {
      let noteUrl = '';
      let noteName = '';
      if (offHireFile) {
        const res = await base44.integrations.Core.UploadFile({ file: offHireFile });
        noteUrl = res.file_url;
        noteName = offHireFile.name;
      }
      await base44.entities.JobCostItem.update(offHiringId, {
        hire_status: 'off_hired',
        off_hire_date: offHireDate,
        off_hire_note_url: noteUrl,
        off_hire_note_name: noteName
      });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
      setOffHiringId(null);
      setOffHireFile(null);
    } catch (err) { console.error(err); }
    setUploadingOffHire(false);
  };

  const reinstate = async (c) => {
    await base44.entities.JobCostItem.update(c.id, {
      hire_status: 'active',
      off_hire_date: '',
      off_hire_note_url: '',
      off_hire_note_name: ''
    });
    queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
  };

  const offHiringItem = items.find(c => c.id === offHiringId);

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
            {additionalCharges > 0 && <span>Delivery & Task Charges: {fmt(additionalCharges)}</span>}
          </div>
        </div>

        {/* Budget & Margin tracker */}
        <BudgetMarginTracker
          budget={Number(job.budget_amount) || 0}
          actualNet={internalNet}
          clientNet={clientNet}
          markup={Number(markup) || 0}
        />

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
          {additionalCharges > 0 && (
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
              <p className="text-xs text-emerald-600">Delivery & Task Charges</p>
              <p className="text-base font-bold text-emerald-800 truncate">{fmt(additionalCharges)}</p>
              <p className="text-[10px] text-emerald-500 mt-0.5">
                {deliveries.filter(d => d.chargeable !== false && Number(d.charge_amount) > 0).length} deliveries · {jobTimesheets.filter(t => t.chargeable && Number(t.charge_amount) > 0).length} chargeable tasks
              </p>
            </div>
          )}
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
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5"><Truck className="w-4 h-4 text-emerald-700" /> Equipment & Hire</h3>
            {!adding && (
              <div className="flex items-center gap-2">
                <button onClick={() => { setForm(blankForm()); setEditingId(null); setAdding(true); }} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                  <Plus className="w-3.5 h-3.5" /> Add item
                </button>
                {presets.length > 0 && (
                  <select value="" onChange={applyPreset} disabled={applyingPreset} className="text-xs px-2.5 py-1 rounded-lg border border-emerald-200 bg-white text-emerald-700 font-medium hover:bg-emerald-50 cursor-pointer disabled:opacity-50">
                    <option value="">{applyingPreset ? 'Adding…' : '📋 Add from preset…'}</option>
                    {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Active / Returned toggle */}
          {(activeItems.length > 0 || returnedItems.length > 0) && (
            <div className="flex gap-1 mb-3 bg-slate-100 p-1 rounded-lg w-full sm:w-auto sm:inline-flex">
              <button onClick={() => setHireFilter('active')}
                className={`flex-1 sm:flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${hireFilter === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                <Truck className="w-3.5 h-3.5" /> Active ({activeItems.length})
              </button>
              <button onClick={() => setHireFilter('off_hired')}
                className={`flex-1 sm:flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${hireFilter === 'off_hired' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                <FileCheck className="w-3.5 h-3.5" /> Returned ({returnedItems.length})
              </button>
            </div>
          )}

          {adding && (
            <form onSubmit={submitItem} className="border border-emerald-200 rounded-lg p-4 mb-3 space-y-3 bg-emerald-50/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, category: v, unit_label: v === 'hired_equipment' ? 'day' : 'each', supplier_id: v === 'internal_equipment' ? '' : form.supplier_id });
                  }} className={inputCls}>
                    <option value="hired_equipment">Hired Equipment</option>
                    <option value="purchased_equipment">Purchased Equipment</option>
                    <option value="internal_equipment">Internal Equipment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
                  <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={inputCls} disabled={form.category === 'internal_equipment'}>
                    <option value="">{form.category === 'internal_equipment' ? 'N/A' : 'Select supplier (optional)'}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="e.g. Transformer hire" className={inputCls} />
                </div>
                {(form.category === 'hired_equipment' || form.category === 'purchased_equipment') && (
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                      <Package className="w-3 h-3 text-emerald-700" /> PO Number *
                    </label>
                    <input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} required placeholder="e.g. PO-1042" className={`${inputCls} font-mono`} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
                  <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="Asset tag / serial no." className={inputCls} />
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
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
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
          ) : hireFilter === 'off_hired' ? (
            returnedItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                No equipment has been returned yet.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Returned to supplier · {returnedItems.length} {returnedItems.length === 1 ? 'item' : 'items'}</p>
                {returnedItems.map(c => {
                  const supplier = suppliers.find(s => s.id === c.supplier_id);
                  const net = itemNet(c);
                  return (
                    <div key={c.id} className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <FileCheck className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-600 line-through truncate">{c.description}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">Hired</span>
                          {c.po_number && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium font-mono inline-flex items-center gap-1"><Package className="w-2.5 h-2.5" /> {c.po_number}</span>}
                          {c.reference_number && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium font-mono">Ref: {c.reference_number}</span>}
                          {supplier && <span className="text-[10px] text-slate-400">{supplier.name}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Returned{c.off_hire_date ? ` ${format(new Date(c.off_hire_date + 'T00:00:00'), 'dd MMM yyyy')}` : ''}{` · ${c.quantity} ${c.unit_label}${c.quantity > 1 ? 's' : ''}`}
                        </p>
                        {c.off_hire_note_url ? (
                          <a href={c.off_hire_note_url} target="_blank" rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-medium bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition">
                            <FileCheck className="w-3.5 h-3.5" /> View off-hire note{c.off_hire_note_name ? ` · ${c.off_hire_note_name}` : ''}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <p className="mt-2 text-xs text-amber-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No off-hire note attached</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <p className="text-sm font-bold text-slate-400">{fmt(net)}</p>
                        <button onClick={() => reinstate(c)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700 font-medium px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 transition">
                          <Undo2 className="w-3.5 h-3.5" /> Reinstate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeItems.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
              No active equipment on site.
            </div>
          ) : (
            <div className="space-y-2">
              {activeItems.map(c => {
                const supplier = suppliers.find(s => s.id === c.supplier_id);
                const net = itemNet(c);
                const linkedAsset = c.site_asset_id ? siteAssets.find(a => a.id === c.site_asset_id) : null;
                const deliveryStatus = getItemLocation(c);
                return (
                  <div key={c.id} className="border border-slate-200 bg-white rounded-lg p-3 flex items-start gap-3 transition">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      {c.category === 'hired_equipment'
                        ? <div className="w-full h-full bg-amber-50 rounded-lg flex items-center justify-center"><Truck className="w-4 h-4 text-amber-600" /></div>
                        : c.category === 'purchased_equipment'
                        ? <div className="w-full h-full bg-purple-50 rounded-lg flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-purple-600" /></div>
                        : <div className="w-full h-full bg-blue-50 rounded-lg flex items-center justify-center"><Wrench className="w-4 h-4 text-blue-600" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">{c.description}</p>
                        {c.po_number && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium font-mono inline-flex items-center gap-1"><Package className="w-2.5 h-2.5" /> {c.po_number}</span>}
                        {c.reference_number && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium font-mono">Ref: {c.reference_number}</span>}
                        {c.vat_exempt && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">VAT exempt</span>}
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{c.category === 'hired_equipment' ? 'Hired' : c.category === 'purchased_equipment' ? 'Purchased' : 'Internal'}</span>
                        {linkedAsset && (() => {
                          const cb = complianceBadge[linkedAsset.compliance_status] || complianceBadge.unknown;
                          const CIcon = cb.icon;
                          return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 border ${cb.cls}`}><CIcon className="w-2.5 h-2.5" />{cb.label}</span>;
                        })()}
                        {(() => {
                          const sb = locationBadge[deliveryStatus.status] || locationBadge.yard;
                          const SIcon = sb.icon;
                          return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${sb.cls}`}><SIcon className="w-2.5 h-2.5" />{sb.label}</span>;
                        })()}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.start_date && c.end_date ? `${format(new Date(c.start_date + 'T00:00:00'), 'dd MMM')} → ${format(new Date(c.end_date + 'T00:00:00'), 'dd MMM')}` : ''}
                        {supplier && ` · ${supplier.name}`}
                        {` · ${c.quantity} ${c.unit_label}${c.quantity > 1 ? 's' : ''}`}
                      </p>
                      {deliveryStatus.status !== 'yard' && (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          {deliveryStatus.status === 'in_transit' && <Truck className="w-3 h-3 text-blue-500" />}
                          {deliveryStatus.status === 'site' && <MapPin className="w-3 h-3 text-emerald-500" />}
                          {deliveryStatus.status === 'returned' && <CheckCircle2 className="w-3 h-3 text-teal-500" />}
                          {deliveryStatus.status === 'in_transit' ? 'Loaded on vehicle' : deliveryStatus.status === 'site' ? 'On site' : 'Collected & returned'}
                          {c.location_updated_at && ` · ${format(new Date(c.location_updated_at), 'dd MMM HH:mm')}`}
                        </p>
                      )}
                      {c.category === 'hired_equipment' && (
                        <button onClick={() => openOffHire(c)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 font-medium bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition">
                          <FileCheck className="w-3.5 h-3.5" /> Return Item
                        </button>
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

      {/* Off-hire modal */}
      {offHiringId && offHiringItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !uploadingOffHire && setOffHiringId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><FileCheck className="w-5 h-5 text-slate-700" /></div>
              <div>
                <h3 className="font-bold text-slate-900">Off-hire equipment</h3>
                <p className="text-xs text-slate-400 truncate">{offHiringItem.description}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-3">Mark this as returned to the supplier and attach the off-hire note for your records.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Return / off-hire date</label>
                <input type="date" value={offHireDate} onChange={e => setOffHireDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Off-hire note (PDF / photo)</label>
                <input ref={offHireFileRef} type="file" accept=".pdf,image/*,.doc,.docx" onChange={e => setOffHireFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 cursor-pointer" />
                {offHireFile && <p className="text-xs text-emerald-700 mt-1.5 inline-flex items-center gap-1"><FileCheck className="w-3 h-3" /> {offHireFile.name}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={confirmOffHire} disabled={uploadingOffHire}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition text-sm font-semibold disabled:opacity-50">
                {uploadingOffHire ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</> : <><FileCheck className="w-3.5 h-3.5" /> Confirm off-hire</>}
              </button>
              <button onClick={() => setOffHiringId(null)} disabled={uploadingOffHire}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}