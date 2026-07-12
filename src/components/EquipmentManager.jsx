import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Wrench, ShoppingCart, Plus, Trash2, Edit2,
  Package, FileCheck, Undo2, ExternalLink, AlertTriangle, Boxes, HardHat
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import EquipmentForm from '@/components/EquipmentForm';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const blankForm = () => ({
  category: 'hired_equipment', supplier_id: '', contractor_id: '', description: '',
  reference_number: '', po_number: '', start_date: '', end_date: '',
  unit_cost: '', quantity: '1', unit_label: 'day', vat_exempt: false, notes: ''
});

const categoryConfig = {
  hired_equipment: { label: 'Hired', icon: Truck, bg: 'bg-amber-50', text: 'text-amber-600' },
  purchased_equipment: { label: 'Purchased', icon: ShoppingCart, bg: 'bg-purple-50', text: 'text-purple-600' },
  internal_equipment: { label: 'Internal', icon: Wrench, bg: 'bg-blue-50', text: 'text-blue-600' },
  contractor_supplied: { label: 'Contractor', icon: HardHat, bg: 'bg-indigo-50', text: 'text-indigo-600' },
};

const locationBadge = {
  in_transit: { label: 'In Transit', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  site: { label: 'On Site', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  returned: { label: 'Returned', cls: 'bg-teal-50 text-teal-700 border border-teal-200' },
};

export default function EquipmentManager({ jobId, job, items: externalItems, onItemsChange, suppliers: externalSuppliers }) {
  const isJobMode = !!jobId;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: fetchedItems = [] } = useQuery({
    queryKey: ['job-cost-items', jobId],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: jobId }),
    enabled: isJobMode
  });
  const { data: fetchedSuppliers = [] } = useQuery({
    queryKey: ['suppliers-equip'],
    queryFn: () => base44.entities.Supplier.list(),
    enabled: isJobMode && !externalSuppliers
  });
  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors-equip'],
    queryFn: () => base44.entities.Contractor.list()
  });
  const { data: presets = [] } = useQuery({
    queryKey: ['cost-presets-active'],
    queryFn: async () => {
      const list = await base44.entities.CostPreset.filter({ is_active: true });
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
    },
    enabled: isJobMode
  });
  const { data: catalogueItems = [] } = useQuery({
    queryKey: ['equipment-catalogue-active'],
    queryFn: async () => {
      const list = await base44.entities.EquipmentCatalogue.filter({ is_active: true });
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.description || '').localeCompare(b.description || ''));
    }
  });

  const items = isJobMode ? fetchedItems : (externalItems || []);
  const suppliers = externalSuppliers || fetchedSuppliers || [];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [savingItem, setSavingItem] = useState(false);
  const [hireFilter, setHireFilter] = useState('active');
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [addingRigGear, setAddingRigGear] = useState(false);

  const [offHiringId, setOffHiringId] = useState(null);
  const [offHireDate, setOffHireDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [offHireFile, setOffHireFile] = useState(null);
  const [uploadingOffHire, setUploadingOffHire] = useState(false);
  const offHireFileRef = useRef(null);

  const itemNet = (c) => (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1);
  const totalNet = items.reduce((s, c) => s + itemNet(c), 0);
  const defaultDates = job ? { start: job.start_date, end: job.end_date } : null;
  const rigsWithGear = catalogueItems.filter(c => (c.linked_catalogue_ids || []).length > 0);

  const handleSubmitItem = async (formData) => {
    if (isJobMode) {
      setSavingItem(true);
      try {
        const isContractorItem = formData.category === 'contractor_supplied';
        const payload = {
          job_id: jobId,
          category: formData.category,
          supplier_id: isContractorItem ? '' : (formData.supplier_id || ''),
          contractor_id: isContractorItem ? (formData.contractor_id || '') : '',
          description: formData.description,
          reference_number: formData.reference_number || '',
          po_number: formData.po_number || '',
          start_date: formData.start_date || '',
          end_date: formData.end_date || '',
          unit_cost: isContractorItem ? 0 : (Number(formData.unit_cost) || 0),
          quantity: Number(formData.quantity) || 1,
          unit_label: isContractorItem ? 'each' : formData.unit_label,
          vat_exempt: isContractorItem ? false : !!formData.vat_exempt,
          notes: formData.notes || '',
          ...(isContractorItem ? { current_location: 'site', location_updated_at: new Date().toISOString() } : {})
        };
        if (editingId) {
          await base44.entities.JobCostItem.update(editingId, payload);
        } else {
          await base44.entities.JobCostItem.create(payload);
        }
        queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
        setAdding(false); setEditingId(null); setForm(blankForm());
      } catch (err) { console.error(err); toast({ title: 'Error', description: 'Could not save item.' }); }
      setSavingItem(false);
    } else {
      const isContractorItem = formData.category === 'contractor_supplied';
      const newItem = {
        id: editingId || `temp-${Date.now()}`,
        category: formData.category,
        supplier_id: isContractorItem ? '' : (formData.supplier_id || ''),
        contractor_id: isContractorItem ? (formData.contractor_id || '') : '',
        description: formData.description,
        reference_number: formData.reference_number || '',
        po_number: formData.po_number || '',
        start_date: formData.start_date || '',
        end_date: formData.end_date || '',
        unit_cost: isContractorItem ? 0 : (Number(formData.unit_cost) || 0),
        quantity: Number(formData.quantity) || 1,
        unit_label: isContractorItem ? 'each' : formData.unit_label,
        vat_exempt: isContractorItem ? false : !!formData.vat_exempt,
        notes: formData.notes || ''
      };
      if (editingId) {
        onItemsChange(items.map(i => i.id === editingId ? newItem : i));
        setEditingId(null);
        setAdding(false);
      } else {
        onItemsChange([...items, newItem]);
      }
      setForm(blankForm());
    }
  };

  const editItem = (c) => {
    if (isJobMode) {
      setEditingId(c.id);
      setForm({
        category: c.category, supplier_id: c.supplier_id || '', contractor_id: c.contractor_id || '', description: c.description,
        reference_number: c.reference_number || '', po_number: c.po_number || '',
        start_date: c.start_date || '', end_date: c.end_date || '',
        unit_cost: String(c.unit_cost ?? ''), quantity: String(c.quantity ?? '1'),
        unit_label: c.unit_label || 'each', vat_exempt: !!c.vat_exempt,
        notes: c.notes || ''
      });
    } else {
      setEditingId(c.id);
      setForm({
        category: c.category || 'hired_equipment', supplier_id: c.supplier_id || '', contractor_id: c.contractor_id || '',
        description: c.description, reference_number: c.reference_number || '',
        po_number: c.po_number || '', start_date: c.start_date || '', end_date: c.end_date || '',
        unit_cost: String(c.unit_cost ?? ''), quantity: String(c.quantity ?? '1'),
        unit_label: c.unit_label || 'each', vat_exempt: !!c.vat_exempt, notes: c.notes || ''
      });
    }
    setAdding(true);
  };

  const deleteItem = async (id) => {
    if (isJobMode) {
      if (!confirm('Remove this equipment item?')) return;
      try {
        await base44.entities.JobCostItem.delete(id);
        queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      } catch (e) { console.error(e); }
    } else {
      onItemsChange(items.filter(i => i.id !== id));
    }
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
        job_id: jobId,
        category: item.category || 'hired_equipment',
        supplier_id: item.supplier_id || '',
        description: item.description,
        reference_number: item.reference_number || '',
        po_number: '', site_asset_id: item.site_asset_id || '',
        start_date: '', end_date: '',
        unit_cost: Number(item.unit_cost) || 0,
        quantity: Number(item.quantity) || 1,
        unit_label: item.unit_label || 'each',
        vat_exempt: !!item.vat_exempt,
        hire_status: 'active', current_location: 'yard', notes: ''
      }));
      await base44.entities.JobCostItem.bulkCreate(payload);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      toast({ title: `Added ${payload.length} items`, description: `From "${preset?.name || 'Preset'}" — adjust prices or dates as needed.` });
    } catch (err) { console.error(err); toast({ title: 'Error', description: 'Could not apply preset.' }); }
    setApplyingPreset(false);
  };

  const addRigWithGear = async (e) => {
    const catId = e.target.value;
    if (!catId) return;
    e.target.value = '';
    setAddingRigGear(true);
    try {
      const rig = catalogueItems.find(c => c.id === catId);
      if (!rig) return;
      const gear = (rig.linked_catalogue_ids || []).map(id => catalogueItems.find(c => c.id === id)).filter(Boolean);
      const payload = [
        {
          job_id: jobId,
          category: rig.category,
          supplier_id: rig.default_supplier_id || '',
          description: rig.description,
          reference_number: rig.reference_number || '',
          site_asset_id: rig.site_asset_id || '',
          po_number: '', start_date: '', end_date: '',
          unit_cost: Number(rig.default_unit_cost) || 0,
          quantity: 1, unit_label: rig.default_unit_label || 'day',
          vat_exempt: !!rig.default_vat_exempt,
          hire_status: 'active', current_location: 'yard', notes: ''
        },
        ...gear.map(g => ({
          job_id: jobId,
          category: g.category,
          supplier_id: g.default_supplier_id || '',
          description: g.description,
          reference_number: g.reference_number || '',
          site_asset_id: g.site_asset_id || '',
          po_number: '', start_date: '', end_date: '',
          unit_cost: Number(g.default_unit_cost) || 0,
          quantity: 1, unit_label: g.default_unit_label || 'day',
          vat_exempt: !!g.default_vat_exempt,
          hire_status: 'active', current_location: 'yard', notes: ''
        }))
      ];
      await base44.entities.JobCostItem.bulkCreate(payload);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      toast({ title: `Added ${payload.length} items`, description: `${rig.description} + ${gear.length} linked items — adjust dates and costs as needed.` });
    } catch (err) { console.error(err); toast({ title: 'Error', description: 'Could not add rig and gear.' }); }
    setAddingRigGear(false);
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
      let noteUrl = '', noteName = '';
      if (offHireFile) {
        const res = await base44.integrations.Core.UploadFile({ file: offHireFile });
        noteUrl = res.file_url; noteName = offHireFile.name;
      }
      await base44.entities.JobCostItem.update(offHiringId, {
        hire_status: 'off_hired', off_hire_date: offHireDate,
        off_hire_note_url: noteUrl, off_hire_note_name: noteName
      });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      setOffHiringId(null); setOffHireFile(null);
    } catch (err) { console.error(err); }
    setUploadingOffHire(false);
  };

  const reinstate = async (c) => {
    await base44.entities.JobCostItem.update(c.id, {
      hire_status: 'active', off_hire_date: '', off_hire_note_url: '', off_hire_note_name: ''
    });
    queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
  };

  const activeItems = isJobMode ? items.filter(c => (c.hire_status || 'active') !== 'off_hired') : items;
  const returnedItems = isJobMode ? items.filter(c => c.hire_status === 'off_hired') : [];
  const visibleItems = isJobMode ? (hireFilter === 'active' ? activeItems : returnedItems) : items;
  const offHiringItem = items.find(c => c.id === offHiringId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <Boxes className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Equipment & Hire</h2>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{items.length} items{items.some(i => i.category !== 'contractor_supplied') ? ` · ${fmt(totalNet)}` : ''}</span>
      </div>

      <div className="px-5 py-4 space-y-4">
        {!adding && (
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => { setForm(blankForm()); setEditingId(null); setAdding(true); }} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
              <Plus className="w-3.5 h-3.5" /> Add equipment
            </button>
            {isJobMode && presets.length > 0 && (
              <select value="" onChange={applyPreset} disabled={applyingPreset} className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-white text-emerald-700 font-medium hover:bg-emerald-50 cursor-pointer disabled:opacity-50">
                <option value="">{applyingPreset ? 'Adding…' : '📋 Add from preset…'}</option>
                {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {isJobMode && rigsWithGear.length > 0 && (
              <select value="" onChange={addRigWithGear} disabled={addingRigGear} className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 font-medium hover:bg-blue-50 cursor-pointer disabled:opacity-50">
                <option value="">{addingRigGear ? 'Adding…' : '🚜 Add rig + gear…'}</option>
                {rigsWithGear.map(r => <option key={r.id} value={r.id}>{r.description} (+{(r.linked_catalogue_ids || []).length})</option>)}
              </select>
            )}
          </div>
        )}

        {adding && (
          <EquipmentForm
            form={form}
            setForm={setForm}
            onSubmit={handleSubmitItem}
            onCancel={() => { setAdding(false); setEditingId(null); setForm(blankForm()); }}
            saving={savingItem}
            editing={!!editingId}
            suppliers={suppliers}
            contractors={contractors}
            defaultDates={defaultDates}
            catalogueItems={catalogueItems}
          />
        )}

        {isJobMode && (activeItems.length > 0 || returnedItems.length > 0) && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto sm:inline-flex">
            <button onClick={() => setHireFilter('active')} className={`flex-1 sm:flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${hireFilter === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <Truck className="w-3.5 h-3.5" /> Active ({activeItems.length})
            </button>
            <button onClick={() => setHireFilter('off_hired')} className={`flex-1 sm:flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${hireFilter === 'off_hired' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <FileCheck className="w-3.5 h-3.5" /> Returned ({returnedItems.length})
            </button>
          </div>
        )}

        {items.length === 0 && !adding ? (
          <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            No equipment added yet. Click "Add equipment" to hire or assign items — costs flow automatically into Costing & Billing.
          </div>
        ) : isJobMode && hireFilter === 'off_hired' ? (
          returnedItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">No equipment has been returned yet.</div>
          ) : (
            <div className="space-y-2">
              {returnedItems.map(c => {
                const supplier = suppliers.find(s => s.id === c.supplier_id);
                const net = itemNet(c);
                const cfg = categoryConfig[c.category] || categoryConfig.hired_equipment;
                return (
                  <div key={c.id} className="border border-slate-200 bg-slate-50/70 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <FileCheck className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-600 line-through truncate">{c.description}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">{cfg.label}</span>
                        {c.po_number && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium font-mono inline-flex items-center gap-1"><Package className="w-2.5 h-2.5" />{c.po_number}</span>}
                        {c.off_hire_date && <span className="text-[10px] text-slate-400">Returned {format(new Date(c.off_hire_date + 'T00:00:00'), 'dd MMM yyyy')}</span>}
                      </div>
                      {c.off_hire_note_url ? (
                        <a href={c.off_hire_note_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-medium bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition">
                          <FileCheck className="w-3.5 h-3.5" /> View off-hire note<ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <p className="mt-1 text-xs text-amber-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No off-hire note</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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
        ) : visibleItems.length === 0 && !adding ? (
          <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">No active equipment.</div>
        ) : (
          <div className="space-y-2">
            {visibleItems.map(c => {
              const net = itemNet(c);
              const cfg = categoryConfig[c.category] || categoryConfig.hired_equipment;
              const CatIcon = cfg.icon;
              const supplier = suppliers.find(s => s.id === c.supplier_id);
              const contractor = contractors.find(ct => ct.id === c.contractor_id);
              const isContractorItem = c.category === 'contractor_supplied';
              const loc = c.current_location || 'yard';
              const locBadge = locationBadge[loc];
              return (
                <div key={c.id} className="border border-slate-200 bg-white rounded-lg p-3 flex items-start gap-3 transition">
                  <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <CatIcon className={`w-4 h-4 ${cfg.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.description}</p>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{cfg.label}</span>
                      {c.po_number && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium font-mono inline-flex items-center gap-1"><Package className="w-2.5 h-2.5" />{c.po_number}</span>}
                      {c.reference_number && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium font-mono">Ref: {c.reference_number}</span>}
                      {c.vat_exempt && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">VAT exempt</span>}
                      {isJobMode && locBadge && loc !== 'yard' && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${locBadge.cls}`}>{locBadge.label}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isContractorItem ? (
                        <>
                          {contractor && `${contractor.name}`}
                          {` · ${c.quantity} ${c.unit_label}${c.quantity > 1 ? 's' : ''}`}
                          {` · Supplied by contractor`}
                        </>
                      ) : (
                        <>
                          {c.start_date && c.end_date ? `${format(new Date(c.start_date + 'T00:00:00'), 'dd MMM')} → ${format(new Date(c.end_date + 'T00:00:00'), 'dd MMM')}` : ''}
                          {supplier && ` · ${supplier.name}`}
                          {` · ${c.quantity} ${c.unit_label}${c.quantity > 1 ? 's' : ''}`}
                          {` · ${fmt(Number(c.unit_cost) || 0)}/${c.unit_label}`}
                        </>
                      )}
                    </p>
                    {isJobMode && c.category === 'hired_equipment' && (
                      <button onClick={() => openOffHire(c)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 font-medium bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition">
                        <FileCheck className="w-3.5 h-3.5" /> Return Item
                      </button>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isContractorItem ? (
                      <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">Contractor</p>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-900">{fmt(net)}</p>
                        <p className="text-[10px] text-slate-400">net</p>
                      </>
                    )}
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

      {isJobMode && offHiringId && offHiringItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !uploadingOffHire && setOffHiringId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><FileCheck className="w-5 h-5 text-slate-700" /></div>
              <div>
                <h3 className="font-bold text-slate-900">Return equipment</h3>
                <p className="text-xs text-slate-400 truncate">{offHiringItem.description}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-3">Mark this as returned to the supplier and attach the off-hire note.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Return date</label>
                <input type="date" value={offHireDate} onChange={e => setOffHireDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Off-hire note (PDF / photo)</label>
                <input ref={offHireFileRef} type="file" accept=".pdf,image/*,.doc,.docx" onChange={e => setOffHireFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 cursor-pointer" />
                {offHireFile && <p className="text-xs text-emerald-700 mt-1.5 inline-flex items-center gap-1"><FileCheck className="w-3 h-3" /> {offHireFile.name}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={confirmOffHire} disabled={uploadingOffHire} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition text-sm font-semibold disabled:opacity-50">
                {uploadingOffHire ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</> : <><FileCheck className="w-3.5 h-3.5" /> Confirm return</>}
              </button>
              <button onClick={() => setOffHiringId(null)} disabled={uploadingOffHire} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}