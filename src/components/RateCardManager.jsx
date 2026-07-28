import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PoundSterling, Search, Plus, Pencil, Check, X, Users, Wrench, Package,
  Loader2, Receipt, Building2, TrendingUp, Percent, Copy, Upload
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SORRateCardManager from '@/components/SORRateCardManager';
import ProjectRateCardManager from '@/components/ProjectRateCardManager';


const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_META = {
  labour: { label: 'Labour', icon: Users, color: 'emerald' },
  plant: { label: 'Plant Hire', icon: Wrench, color: 'blue' },
  materials: { label: 'Materials', icon: Package, color: 'amber' },
};

const inputCls = "w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]";

function RateItemRow({ item, subcategory, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    description: item.description,
    price: item.price ?? '',
    price_text: item.price_text ?? '',
    cost_price: item.cost_price ?? '',
    unit: item.unit ?? '',
    men: item.men ?? '',
    notes: item.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  // Calculated daily charge-out: if the item has men (e.g. 2-man crew), the daily rate is price × men.
  const dailyCharge = item.men && item.men > 0 && item.price != null ? item.price * item.men : null;
  const hasCost = item.cost_price != null;
  // Margin indicator: only show when both charge-out and cost are present
  const marginPct = hasCost && item.cost_price > 0 && item.price != null && item.price > 0
    ? ((item.price - item.cost_price) / item.price) * 100 : null;

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.RateCardItem.update(item.id, {
        description: form.description,
        price: form.price === '' ? null : Number(form.price),
        price_text: form.price_text || null,
        cost_price: form.cost_price === '' ? null : Number(form.cost_price),
        unit: form.unit || null,
        men: form.men === '' ? null : Number(form.men),
        notes: form.notes || null,
      });
      onUpdate();
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const priceDisplay = item.price != null ? fmt(item.price) : item.price_text || '—';
  const costDisplay = hasCost ? fmt(item.cost_price) : '—';

  return (
    <div className="border-b border-slate-100 last:border-0">
      {editing ? (
        <div className="p-3 bg-slate-50 space-y-2">
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputCls} />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div>
              <label className="text-[10px] text-emerald-700 font-medium">Charge Out (£)</label>
              <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className="text-[10px] text-amber-700 font-medium">Internal Cost (£)</label>
              <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-medium">Price text</label>
              <input value={form.price_text} onChange={e => setForm({ ...form, price_text: e.target.value })} className={inputCls} placeholder="POA" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-medium">Unit</label>
              <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inputCls} placeholder="day" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-medium">Men</label>
              <input type="number" value={form.men} onChange={e => setForm({ ...form, men: e.target.value })} className={inputCls} placeholder="—" />
            </div>
          </div>
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={inputCls} />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-300">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50 transition group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-slate-800">{item.description}</p>
              {item.price == null && (
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5 border border-amber-300">POA</span>
              )}
              {item.men != null && item.men > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A] border border-[#2E5A1A]/20">
                  <Users className="w-2.5 h-2.5" /> {item.men} man{item.men > 1 ? 's' : ''}
                </span>
              )}
              {marginPct != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${marginPct >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {marginPct.toFixed(0)}% margin
                </span>
              )}
            </div>
            {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
            {dailyCharge != null && (
              <p className="text-xs text-[#2E5A1A] font-semibold mt-1 inline-flex items-center gap-1 bg-[#2E5A1A]/10 px-2 py-0.5 rounded-md">
                <PoundSterling className="w-3 h-3" /> {fmt(dailyCharge)}/day charge
                <span className="text-slate-400 font-normal">({fmt(item.price)} × {item.men})</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            {item.unit && <span className="text-xs text-slate-400">/{item.unit}</span>}
            {/* Internal Cost */}
            <div className="text-right w-20">
              <p className="text-[9px] text-amber-600 uppercase font-medium">Cost</p>
              <span className={`text-sm font-semibold tabular-nums block ${hasCost ? 'text-amber-700' : 'text-slate-300'}`}>{costDisplay}</span>
            </div>
            {/* Charge Out */}
            <div className="text-right w-20">
              <p className="text-[9px] text-emerald-600 uppercase font-medium">Charge</p>
              <span className={`text-sm font-semibold tabular-nums block ${item.price != null ? 'text-slate-900' : 'text-slate-400 italic'}`}>{priceDisplay}</span>
            </div>
            <button onClick={() => { setForm({ description: item.description, price: item.price ?? '', price_text: item.price_text ?? '', cost_price: item.cost_price ?? '', unit: item.unit ?? '', men: item.men ?? '', notes: item.notes ?? '' }); setEditing(true); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-[#2E5A1A] transition">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddRateForm({ category, subcategory, source, supplierId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: '', price: '', cost_price: '', unit: 'day', notes: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      await base44.entities.RateCardItem.create({
        category,
        subcategory: subcategory || null,
        description: form.description.trim(),
        price: form.price === '' ? null : Number(form.price),
        cost_price: form.cost_price === '' ? null : Number(form.cost_price),
        unit: form.unit || null,
        notes: form.notes || null,
        rate_card_source: source,
        supplier_id: supplierId || null,
      });
      setForm({ description: '', price: '', cost_price: '', unit: 'day', notes: '' });
      setOpen(false);
      onAdded();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-[#2E5A1A] hover:bg-[#2E5A1A]/5 rounded-lg transition border border-dashed border-slate-200">
        <Plus className="w-3.5 h-3.5" /> Add rate
      </button>
    );
  }

  return (
    <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2">
      <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputCls} autoFocus />
      <div className="grid grid-cols-3 gap-2">
        <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Charge Out £" className={inputCls} />
        <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} placeholder="Internal Cost £" className={inputCls} />
        <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="Unit (day, hour, m)" className={inputCls} />
      </div>
      <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={inputCls} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
        </button>
        <button onClick={() => setOpen(false)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-300">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function RateCardManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeRateCard, setActiveRateCard] = useState('our_company'); // 'our_company' or supplier_id
  const [activeCategory, setActiveCategory] = useState('labour');
  const [query, setQuery] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPct, setBulkPct] = useState('');
  const [bulkScope, setBulkScope] = useState('category');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [viewMode, setViewMode] = useState('master');
  const [cloneOpen, setCloneOpen] = useState(false);
  const [clonePct, setClonePct] = useState('');
  const [cloning, setCloning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const masterFileInputRef = useRef(null);

  const handleMasterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('processMasterPriceListUpload', { file_url: uploadRes.file_url });
      toast({
        title: 'Master price list ingested',
        description: `${res.data.ingested} rates loaded.`,
      });
      refresh();
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.message || 'Could not process file', variant: 'destructive' });
    }
    setUploading(false);
    if (masterFileInputRef.current) masterFileInputRef.current.value = '';
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['rate-card-items'],
    queryFn: () => base44.entities.RateCardItem.list('-created_date', 500)
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['rate-card-items'] });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  };

  const isOurCard = activeRateCard === 'our_company';
  const activeSupplier = isOurCard ? null : suppliers.find(s => s.id === activeRateCard);

  // Suppliers that have ingested rate card items
  const suppliersWithItems = useMemo(() => {
    const supplierIds = new Set(items.filter(i => i.rate_card_source === 'supplier' && i.supplier_id).map(i => i.supplier_id));
    return suppliers.filter(s => supplierIds.has(s.id));
  }, [items, suppliers]);

  const filtered = useMemo(() => {
    let list = items.filter(i => {
      if (isOurCard) return i.rate_card_source !== 'supplier';
      return i.rate_card_source === 'supplier' && i.supplier_id === activeRateCard;
    }).filter(i => i.category === activeCategory);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        (i.description || '').toLowerCase().includes(q) ||
        (i.subcategory || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [items, activeCategory, query, isOurCard, activeRateCard]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(i => {
      const key = i.subcategory || 'General';
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return Object.entries(map);
  }, [filtered]);

  const counts = useMemo(() => {
    const scoped = isOurCard
      ? items.filter(i => i.rate_card_source !== 'supplier')
      : items.filter(i => i.rate_card_source === 'supplier' && i.supplier_id === activeRateCard);
    return {
      labour: scoped.filter(i => i.category === 'labour').length,
      plant: scoped.filter(i => i.category === 'plant').length,
      materials: scoped.filter(i => i.category === 'materials').length,
    };
  }, [items, isOurCard, activeRateCard]);

  const totalForCard = counts.labour + counts.plant + counts.materials;

  const applyBulkAdjustment = async () => {
    const pct = parseFloat(bulkPct);
    if (isNaN(pct)) {
      toast({ title: 'Enter a valid percentage', variant: 'destructive' });
      return;
    }
    const multiplier = 1 + pct / 100;
    let targetItems;
    if (bulkScope === 'category') {
      targetItems = filtered.filter(i => i.price != null);
    } else {
      const scoped = isOurCard
        ? items.filter(i => i.rate_card_source !== 'supplier')
        : items.filter(i => i.rate_card_source === 'supplier' && i.supplier_id === activeRateCard);
      targetItems = scoped.filter(i => i.price != null);
    }
    if (targetItems.length === 0) {
      toast({ title: 'No adjustable rates', description: 'Only items with a numeric price can be bulk-adjusted.', variant: 'destructive' });
      return;
    }
    if (!confirm(`Apply ${pct > 0 ? '+' : ''}${pct}% to ${targetItems.length} rate${targetItems.length === 1 ? '' : 's'} (${bulkScope === 'category' ? CATEGORY_META[activeCategory].label : 'all categories'})?`)) return;
    setBulkApplying(true);
    try {
      const updates = targetItems.map(i => ({
        id: i.id,
        price: Math.round(i.price * multiplier * 100) / 100,
      }));
      await base44.entities.RateCardItem.bulkUpdate(updates);
      toast({ title: 'Rates updated', description: `${updates.length} rate${updates.length === 1 ? '' : 's'} adjusted by ${pct > 0 ? '+' : ''}${pct}%.` });
      setBulkOpen(false);
      setBulkPct('');
      refresh();
    } catch (e) {
      toast({ title: 'Could not apply adjustment', description: e?.message, variant: 'destructive' });
    }
    setBulkApplying(false);
  };

  // Clone the entire live "our_company" rate card into a draft supplier tab
  // (e.g. "Our Rate Card — 2027 Draft") with an optional % uplift. This gives
  // a safe Draft/Live workflow without changing the rate-card matcher or
  // affecting live job billing — edit the draft, then swap when ready.
  const cloneToDraft = async () => {
    const pct = parseFloat(clonePct);
    const multiplier = isNaN(pct) ? 1 : 1 + pct / 100;
    const nextYear = new Date().getFullYear() + 1;
    const draftName = `Our Rate Card — ${nextYear} Draft`;
    setCloning(true);
    try {
      const sourceItems = items.filter(i => i.rate_card_source !== 'supplier' && i.price != null);
      if (sourceItems.length === 0) {
        toast({ title: 'No rates to clone', description: 'Add rates to the live card first.', variant: 'destructive' });
        setCloning(false); return;
      }
      let draftSupplier = suppliers.find(s => s.name === draftName);
      if (!draftSupplier) {
        draftSupplier = await base44.entities.Supplier.create({ name: draftName, notes: 'Draft rate card clone — edit prices here before going live.' });
      }
      const clones = sourceItems.map(i => ({
        category: i.category,
        subcategory: i.subcategory || null,
        description: i.description,
        unit: i.unit || null,
        men: i.men ?? null,
        size: i.size || null,
        notes: i.notes || null,
        sort_order: i.sort_order || 0,
        is_active: true,
        rate_card_source: 'supplier',
        supplier_id: draftSupplier.id,
        price: i.price != null ? Math.round(i.price * multiplier * 100) / 100 : null,
        price_text: i.price_text || null,
      }));
      for (let i = 0; i < clones.length; i += 500) {
        await base44.entities.RateCardItem.bulkCreate(clones.slice(i, i + 500));
      }
      toast({ title: 'Draft rate card created', description: `${clones.length} rates cloned to "${draftName}"${!isNaN(pct) ? ` with ${pct > 0 ? '+' : ''}${pct}% uplift` : ''}.` });
      setCloneOpen(false); setClonePct('');
      refresh();
      setActiveRateCard(draftSupplier.id);
    } catch (e) {
      toast({ title: 'Clone failed', description: e?.message, variant: 'destructive' });
    }
    setCloning(false);
  };

  if (viewMode === 'project') {
    return (
      <div className="space-y-4">
        <SettingsSectionHeader icon={Receipt} title="Rate Card Manager" description="Master Price List (day rates, labour, plant) and Drilling SOR (meterage & investigation rates)" />
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
          <button onClick={() => setViewMode('master')} className="px-4 py-2 rounded-md text-sm font-semibold transition text-slate-500">
            Master Price List
          </button>
          <button onClick={() => setViewMode('sor')} className="px-4 py-2 rounded-md text-sm font-semibold transition text-slate-500">
            Drilling SOR 2026
          </button>
          <button onClick={() => setViewMode('project')} className="px-4 py-2 rounded-md text-sm font-semibold transition bg-white text-[#2E5A1A] shadow-sm">
            Project Rate Cards
          </button>
        </div>
        <ProjectRateCardManager />
      </div>
    );
  }

  if (viewMode === 'sor') {
    return (
      <div className="space-y-4">
        <SettingsSectionHeader icon={Receipt} title="Rate Card Manager" description="Master Price List (day rates, labour, plant) and Drilling SOR (meterage & investigation rates)" />
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
          <button onClick={() => setViewMode('master')} className="px-4 py-2 rounded-md text-sm font-semibold transition text-slate-500">
            Master Price List
          </button>
          <button onClick={() => setViewMode('sor')} className="px-4 py-2 rounded-md text-sm font-semibold transition bg-white text-[#2E5A1A] shadow-sm">
            Drilling SOR 2026
          </button>
          <button onClick={() => setViewMode('project')} className="px-4 py-2 rounded-md text-sm font-semibold transition text-slate-500">
            Project Rate Cards
          </button>
        </div>
        <SORRateCardManager />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsSectionHeader icon={Receipt} title="Rate Card Manager" description="Master Price List (day rates, labour, plant) and Drilling SOR (meterage & investigation rates)" />
      <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setViewMode('master')} className="px-4 py-2 rounded-md text-sm font-semibold transition bg-white text-[#2E5A1A] shadow-sm">
          Master Price List
        </button>
        <button onClick={() => setViewMode('sor')} className="px-4 py-2 rounded-md text-sm font-semibold transition text-slate-500">
          Drilling SOR 2026
        </button>
        <button onClick={() => setViewMode('project')} className="px-4 py-2 rounded-md text-sm font-semibold transition text-slate-500">
          Project Rate Cards
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        {isOurCard ? <Receipt className="w-5 h-5 text-[#2E5A1A]" /> : <Building2 className="w-5 h-5 text-[#2E5A1A]" />}
        <h2 className="font-semibold text-slate-900">{isOurCard ? 'Master Price List — Our Rate Card' : `Rate Card — ${activeSupplier?.name || 'Supplier'}`}</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{totalForCard} rates</span>
        {isOurCard && (
          <>
            <input ref={masterFileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleMasterUpload} className="hidden" />
            <button onClick={() => masterFileInputRef.current?.click()} disabled={uploading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition bg-[#2E5A1A] text-white hover:bg-[#1c4a12] disabled:opacity-50 flex-shrink-0">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Processing...' : 'Upload Master Price List'}
            </button>
          </>
        )}
      </div>

      {/* Rate card source tabs */}
      <div className="flex gap-1.5 px-3 pt-3 overflow-x-auto no-scrollbar border-b border-slate-100">
        <button onClick={() => setActiveRateCard('our_company')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 whitespace-nowrap ${isOurCard ? 'border-[#2E5A1A] text-[#2E5A1A] bg-[#2E5A1A]/5' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Receipt className="w-4 h-4" /> Our Rate Card
        </button>
        {suppliersWithItems.map(s => (
          <button key={s.id} onClick={() => setActiveRateCard(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 whitespace-nowrap ${activeRateCard === s.id ? 'border-[#2E5A1A] text-[#2E5A1A] bg-[#2E5A1A]/5' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Building2 className="w-4 h-4" /> {s.name}
            <span className="text-xs text-slate-400">({s.rate_card_item_count || items.filter(i => i.supplier_id === s.id).length})</span>
          </button>
        ))}
        {suppliersWithItems.length === 0 && (
          <span className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">No supplier rate cards yet — upload one under Suppliers</span>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 pt-3 border-b border-slate-100">
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const active = activeCategory === key;
          return (
            <button key={key} onClick={() => setActiveCategory(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 ${active ? 'border-[#2E5A1A] text-[#2E5A1A] bg-[#2E5A1A]/5' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" /> {meta.label}
              <span className="text-xs text-slate-400">({counts[key]})</span>
            </button>
          );
        })}
      </div>

      {/* Search + Bulk Adjust */}
      <div className="px-4 py-3 border-b border-slate-100 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${CATEGORY_META[activeCategory].label.toLowerCase()} rates...`} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
          </div>
          <button onClick={() => setBulkOpen(!bulkOpen)} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition w-full sm:w-auto flex-shrink-0 ${bulkOpen ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <TrendingUp className="w-4 h-4" /> Bulk Adjust
          </button>
          <button onClick={() => setCloneOpen(!cloneOpen)} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition w-full sm:w-auto flex-shrink-0 ${cloneOpen ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Copy className="w-4 h-4" /> Clone to Draft
          </button>
        </div>
        {bulkOpen && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
              <Percent className="w-3.5 h-3.5" /> Bulk Percentage Adjustment
            </div>
            <p className="text-xs text-amber-700">Apply a percentage increase or decrease to all rates with a numeric price. Use a negative value to decrease (e.g. -5 for -5%). Items with "POA" or text-only prices are skipped.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={bulkScope} onChange={e => setBulkScope(e.target.value)} className="px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500">
                <option value="category">This category only ({CATEGORY_META[activeCategory].label})</option>
                <option value="card">Entire rate card ({isOurCard ? 'Our Rate Card' : activeSupplier?.name || 'Supplier'})</option>
              </select>
              <input type="number" step="0.1" value={bulkPct} onChange={e => setBulkPct(e.target.value)} placeholder="e.g. 5 or -3" className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500" />
              <button onClick={applyBulkAdjustment} disabled={bulkApplying} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition">
                {bulkApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Apply
              </button>
              <button onClick={() => { setBulkOpen(false); setBulkPct(''); }} className="px-3 py-2 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-medium transition">Cancel</button>
            </div>
          </div>
        )}
        {cloneOpen && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <Copy className="w-3.5 h-3.5" /> Clone Live Rate Card to a {new Date().getFullYear() + 1} Draft
            </div>
            <p className="text-xs text-emerald-700">Copies every rate from "Our Rate Card" into a new draft supplier tab so you can prepare next year's prices without affecting live billing. Optionally apply an uplift %.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="number" step="0.1" value={clonePct} onChange={e => setClonePct(e.target.value)} placeholder="Uplift % (e.g. 5, or leave blank)" className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500" />
              <button onClick={cloneToDraft} disabled={cloning} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
                {cloning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Clone
              </button>
              <button onClick={() => { setCloneOpen(false); setClonePct(''); }} className="px-3 py-2 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-medium transition">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[55vh]">
        {/* Column header */}
        <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-100/80 border-b border-slate-200 sticky top-0 z-20">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex-1">Description</span>
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide w-20 text-right">Internal Cost</span>
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide w-20 text-right">Charge Out</span>
          <span className="w-6 flex-shrink-0" />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">
            {isOurCard ? 'No rates found for this category.' : 'No items ingested for this supplier yet. Upload their rate card in Settings → Suppliers.'}
          </div>
        ) : (
          grouped.map(([subcategory, subItems]) => (
            <div key={subcategory} className="border-b border-slate-100 last:border-0">
              <div className="px-4 py-2 bg-slate-50/80 sticky top-0 z-10">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{subcategory}</p>
              </div>
              {subItems.map(item => <RateItemRow key={item.id} item={item} onUpdate={refresh} />)}
              <AddRateForm category={activeCategory} subcategory={subcategory} source={isOurCard ? 'our_company' : 'supplier'} supplierId={isOurCard ? null : activeRateCard} onAdded={refresh} />
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}