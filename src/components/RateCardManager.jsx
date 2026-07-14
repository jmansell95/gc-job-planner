import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PoundSterling, Search, Plus, Pencil, Check, X, Users, Wrench, Package,
  Loader2, Receipt, Building2
} from 'lucide-react';


const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_META = {
  labour: { label: 'Labour', icon: Users, color: 'emerald' },
  plant: { label: 'Plant Hire', icon: Wrench, color: 'blue' },
  materials: { label: 'Materials', icon: Package, color: 'amber' },
};

const inputCls = "w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600";

function RateItemRow({ item, subcategory, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    description: item.description,
    price: item.price ?? '',
    price_text: item.price_text ?? '',
    unit: item.unit ?? '',
    men: item.men ?? '',
    notes: item.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.RateCardItem.update(item.id, {
        description: form.description,
        price: form.price === '' ? null : Number(form.price),
        price_text: form.price_text || null,
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

  return (
    <div className="border-b border-slate-100 last:border-0">
      {editing ? (
        <div className="p-3 bg-slate-50 space-y-2">
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputCls} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 font-medium">Price (£)</label>
              <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className={inputCls} placeholder="0.00" />
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
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-300">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition group">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800">{item.description}</p>
            {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {item.men != null && <span className="text-xs text-slate-400">{item.men} man{item.men > 1 ? 's' : ''}</span>}
            {item.unit && <span className="text-xs text-slate-400">/{item.unit}</span>}
            <span className={`text-sm font-semibold tabular-nums w-20 text-right ${item.price != null ? 'text-slate-900' : 'text-slate-400 italic'}`}>{priceDisplay}</span>
            <button onClick={() => { setForm({ description: item.description, price: item.price ?? '', price_text: item.price_text ?? '', unit: item.unit ?? '', men: item.men ?? '', notes: item.notes ?? '' }); setEditing(true); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-700 transition">
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
  const [form, setForm] = useState({ description: '', price: '', unit: 'day', notes: '' });
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
        unit: form.unit || null,
        notes: form.notes || null,
        rate_card_source: source,
        supplier_id: supplierId || null,
      });
      setForm({ description: '', price: '', unit: 'day', notes: '' });
      setOpen(false);
      onAdded();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-lg transition border border-dashed border-slate-200">
        <Plus className="w-3.5 h-3.5" /> Add rate
      </button>
    );
  }

  return (
    <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2">
      <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputCls} autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Price £" className={inputCls} />
        <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="Unit (day, hour, m)" className={inputCls} />
      </div>
      <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={inputCls} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50">
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
  const queryClient = useQueryClient();
  const [activeRateCard, setActiveRateCard] = useState('our_company'); // 'our_company' or supplier_id
  const [activeCategory, setActiveCategory] = useState('labour');
  const [query, setQuery] = useState('');

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

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        {isOurCard ? <Receipt className="w-5 h-5 text-emerald-700" /> : <Building2 className="w-5 h-5 text-emerald-700" />}
        <h2 className="font-semibold text-slate-900">{isOurCard ? 'Master Price List — Our Rate Card' : `Rate Card — ${activeSupplier?.name || 'Supplier'}`}</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{totalForCard} rates</span>
      </div>

      {/* Rate card source tabs */}
      <div className="flex gap-1.5 px-3 pt-3 overflow-x-auto no-scrollbar border-b border-slate-100">
        <button onClick={() => setActiveRateCard('our_company')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 whitespace-nowrap ${isOurCard ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Receipt className="w-4 h-4" /> Our Rate Card
        </button>
        {suppliersWithItems.map(s => (
          <button key={s.id} onClick={() => setActiveRateCard(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 whitespace-nowrap ${activeRateCard === s.id ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 ${active ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" /> {meta.label}
              <span className="text-xs text-slate-400">({counts[key]})</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${CATEGORY_META[activeCategory].label.toLowerCase()} rates...`} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[55vh]">
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
  );
}