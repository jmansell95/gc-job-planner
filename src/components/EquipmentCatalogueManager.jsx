import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, X, Trash2, Edit2, Truck, ShoppingCart, Wrench, HardHat, Search } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const blankForm = () => ({
  description: '', category: 'hired_equipment', default_supplier_id: '',
  default_unit_cost: '', default_unit_label: 'day', default_vat_exempt: false,
  reference_number: ''
});

const categoryMeta = {
  hired_equipment: { label: 'Hired', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
  purchased_equipment: { label: 'Purchased', icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
  internal_equipment: { label: 'Internal', icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50' },
  contractor_supplied: { label: 'Contractor', icon: HardHat, color: 'text-indigo-600', bg: 'bg-indigo-50' }
};

export default function EquipmentCatalogueManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['equipment-catalogue'],
    queryFn: async () => {
      const list = await base44.entities.EquipmentCatalogue.list();
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.description || '').localeCompare(b.description || ''));
    }
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers-catalogue'], queryFn: () => base44.entities.Supplier.list() });

  const q = query.toLowerCase().trim();
  const filtered = q ? items.filter(i => (i.description || '').toLowerCase().includes(q)) : items;
  const grouped = Object.keys(categoryMeta).reduce((acc, cat) => {
    acc[cat] = filtered.filter(i => (i.category || 'hired_equipment') === cat);
    return acc;
  }, {});

  const save = async (e) => {
    e.preventDefault();
    if (!form.description.trim() || !form.default_unit_cost) return;
    setSaving(true);
    try {
      const payload = {
        description: form.description,
        category: form.category,
        default_supplier_id: form.category === 'internal_equipment' || form.category === 'contractor_supplied' ? '' : (form.default_supplier_id || ''),
        default_unit_cost: Number(form.default_unit_cost) || 0,
        default_unit_label: form.default_unit_label,
        default_vat_exempt: !!form.default_vat_exempt,
        reference_number: form.reference_number || '',
        is_active: true
      };
      if (editingId) {
        await base44.entities.EquipmentCatalogue.update(editingId, payload);
      } else {
        await base44.entities.EquipmentCatalogue.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue-active'] });
      setForm(blankForm()); setEditingId(null); setShowForm(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const editItem = (item) => {
    setForm({
      description: item.description, category: item.category || 'hired_equipment',
      default_supplier_id: item.default_supplier_id || '',
      default_unit_cost: String(item.default_unit_cost ?? ''),
      default_unit_label: item.default_unit_label || 'day',
      default_vat_exempt: !!item.default_vat_exempt,
      reference_number: item.reference_number || ''
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const deleteItem = async (id) => {
    if (!confirm('Remove this item from the catalogue?')) return;
    await base44.entities.EquipmentCatalogue.delete(id);
    queryClient.invalidateQueries({ queryKey: ['equipment-catalogue'] });
    queryClient.invalidateQueries({ queryKey: ['equipment-catalogue-active'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900">Equipment Catalogue</h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">{items.length}</span>
        </div>
        <button onClick={() => { setEditingId(null); setForm(blankForm()); setShowForm(s => !s); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition active:scale-95">
          {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New Item</>}
        </button>
      </div>
      <p className="text-sm text-slate-500 -mt-2">Your master list of standard equipment. Items here appear in the dropdown when adding equipment to any job — no re-typing needed.</p>

      {showForm && (
        <form onSubmit={save} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">{editingId ? 'Edit catalogue item' : 'New catalogue item'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required placeholder="e.g. Excavator 5-ton, Transformer 110V" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value, default_unit_label: e.target.value === 'hired_equipment' ? 'day' : 'each', default_supplier_id: ['internal_equipment', 'contractor_supplied'].includes(e.target.value) ? '' : p.default_supplier_id }))} className={inputCls}>
                <option value="hired_equipment">Hired Equipment</option>
                <option value="purchased_equipment">Purchased Equipment</option>
                <option value="internal_equipment">Internal Equipment</option>
                <option value="contractor_supplied">Contractor Supplied</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
              <select value={form.default_supplier_id} onChange={e => setForm(p => ({ ...p, default_supplier_id: e.target.value }))} disabled={['internal_equipment', 'contractor_supplied'].includes(form.category)} className={inputCls}>
                <option value="">{['internal_equipment', 'contractor_supplied'].includes(form.category) ? 'N/A' : 'Supplier (optional)'}</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Default Unit Cost £ *</label>
              <input type="number" min="0" step="0.01" value={form.default_unit_cost} onChange={e => setForm(p => ({ ...p, default_unit_cost: e.target.value }))} required placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Default Unit</label>
              <select value={form.default_unit_label} onChange={e => setForm(p => ({ ...p, default_unit_label: e.target.value }))} className={inputCls}>
                <option value="day">per day</option>
                <option value="hour">per hour</option>
                <option value="m">per metre</option>
                <option value="each">each</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reference / Serial (optional)</label>
              <input value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} placeholder="Asset tag / serial no." className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer self-end pb-2">
              <input type="checkbox" checked={form.default_vat_exempt} onChange={e => setForm(p => ({ ...p, default_vat_exempt: e.target.checked }))} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
              VAT exempt by default
            </label>
          </div>
          <button type="submit" disabled={saving} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50">
            {saving ? 'Saving…' : editingId ? 'Update Item' : 'Add to Catalogue'}
          </button>
        </form>
      )}

      {/* Search */}
      {items.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search catalogue..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </div>
      )}

      {isLoading ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 h-24 animate-pulse" />
      ) : items.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 py-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No catalogue items yet</p>
          <p className="text-sm text-slate-400 mt-1">Add your standard equipment here so you can quickly add it to any job.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catItems]) => {
            if (catItems.length === 0) return null;
            const meta = categoryMeta[cat];
            const Icon = meta.icon;
            return (
              <div key={cat}>
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{meta.label}</p>
                  <span className="text-xs text-slate-400">({catItems.length})</span>
                </div>
                <div className="space-y-1.5">
                  {catItems.map(item => {
                    const supplier = item.default_supplier_id ? suppliers.find(s => s.id === item.default_supplier_id) : null;
                    return (
                      <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-2.5 flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{item.description}</p>
                          <p className="text-xs text-slate-400">
                            {fmt(item.default_unit_cost)} / {item.default_unit_label}
                            {supplier && ` · ${supplier.name}`}
                            {item.default_vat_exempt && ' · VAT exempt'}
                            {item.reference_number && ` · ${item.reference_number}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => editItem(item)} className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"><Edit2 className="w-3 h-3" /></button>
                          <button onClick={() => deleteItem(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}