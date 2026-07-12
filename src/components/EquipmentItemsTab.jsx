import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, X, Trash2, Edit2, Truck, ShoppingCart, Wrench, HardHat, Search, ShieldCheck, Download, Link2, ChevronDown, ChevronUp, User } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const blankForm = () => ({
  description: '', category: 'hired_equipment', default_supplier_id: '',
  default_unit_cost: '', default_unit_label: 'day', default_vat_exempt: false,
  reference_number: '', responsible_person: '', site_asset_id: '', linked_catalogue_ids: []
});

const categoryMeta = {
  hired_equipment: { label: 'Hired', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
  purchased_equipment: { label: 'Purchased', icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
  internal_equipment: { label: 'Internal', icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50' },
  contractor_supplied: { label: 'Contractor', icon: HardHat, color: 'text-indigo-600', bg: 'bg-indigo-50' }
};

const complianceBadge = {
  compliant: { label: 'Compliant', cls: 'bg-emerald-50 text-emerald-700' },
  expiring: { label: 'Expiring', cls: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Expired', cls: 'bg-red-50 text-red-700' },
  unknown: { label: 'Unknown', cls: 'bg-slate-100 text-slate-500' }
};

export default function EquipmentItemsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedRigId, setExpandedRigId] = useState(null);
  const [importing, setImporting] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['equipment-catalogue'],
    queryFn: async () => {
      const list = await base44.entities.EquipmentCatalogue.list();
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.description || '').localeCompare(b.description || ''));
    }
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers-catalogue'], queryFn: () => base44.entities.Supplier.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets-catalogue'], queryFn: () => base44.entities.SiteAsset.list() });

  const catalogueByAssetId = (assetId) => items.find(i => i.site_asset_id === assetId);
  const linkedItems = (item) => (item.linked_catalogue_ids || []).map(id => items.find(i => i.id === id)).filter(Boolean);
  const assetFor = (item) => item.site_asset_id ? assets.find(a => a.id === item.site_asset_id) : null;

  const q = query.toLowerCase().trim();
  const filtered = q ? items.filter(i => (i.description || '').toLowerCase().includes(q)) : items;
  const grouped = Object.keys(categoryMeta).reduce((acc, cat) => {
    acc[cat] = filtered.filter(i => (i.category || 'hired_equipment') === cat);
    return acc;
  }, {});

  const unimportedAssets = assets.filter(a => a.is_active !== false && !catalogueByAssetId(a.id) && ['rig', 'machinery', 'trailer', 'lifting'].includes(a.asset_type));

  const importFromCompliance = async () => {
    setImporting(true);
    try {
      const newEntries = unimportedAssets.map(a => ({
        description: a.name,
        category: 'internal_equipment',
        default_supplier_id: '',
        default_unit_cost: 0,
        default_unit_label: 'day',
        default_vat_exempt: false,
        reference_number: a.serial_number || '',
        responsible_person: a.responsible_person || '',
        site_asset_id: a.id,
        is_active: true
      }));
      if (newEntries.length > 0) {
        const created = await base44.entities.EquipmentCatalogue.bulkCreate(newEntries);
        const allItems = [...items, ...created];
        const updates = [];
        for (const asset of assets.filter(a => a.asset_type === 'rig' && a.linked_equipment_ids?.length)) {
          const rigCat = allItems.find(i => i.site_asset_id === asset.id);
          if (!rigCat) continue;
          const linkedCatIds = asset.linked_equipment_ids
            .map(lid => allItems.find(i => i.site_asset_id === lid)?.id)
            .filter(Boolean);
          if (linkedCatIds.length > 0) {
            updates.push({ id: rigCat.id, linked_catalogue_ids: linkedCatIds });
          }
        }
        if (updates.length > 0) {
          await base44.entities.EquipmentCatalogue.bulkUpdate(updates);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue-active'] });
    } catch (err) { console.error(err); }
    setImporting(false);
  };

  const selectAsset = (assetId) => {
    if (!assetId) {
      setForm(p => ({ ...p, site_asset_id: '' }));
      return;
    }
    const asset = assets.find(a => a.id === assetId);
    setForm(p => ({
      ...p,
      site_asset_id: assetId,
      description: asset?.name || p.description,
      reference_number: asset?.serial_number || p.reference_number,
      responsible_person: asset?.responsible_person || p.responsible_person,
      category: 'internal_equipment'
    }));
  };

  const toggleLinked = (catId) => {
    setForm(p => {
      const ids = p.linked_catalogue_ids || [];
      return { ...p, linked_catalogue_ids: ids.includes(catId) ? ids.filter(id => id !== catId) : [...ids, catId] };
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.description.trim() || form.default_unit_cost === '') return;
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
        responsible_person: form.responsible_person || '',
        site_asset_id: form.site_asset_id || '',
        linked_catalogue_ids: form.linked_catalogue_ids || [],
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
      reference_number: item.reference_number || '',
      responsible_person: item.responsible_person || '',
      site_asset_id: item.site_asset_id || '',
      linked_catalogue_ids: item.linked_catalogue_ids || []
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

  const isRigForm = form.site_asset_id && assets.find(a => a.id === form.site_asset_id)?.asset_type === 'rig';
  const linkableItems = items.filter(i => i.id !== editingId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900">Items</h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">{items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {unimportedAssets.length > 0 && (
            <button onClick={importFromCompliance} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold transition active:scale-95 disabled:opacity-50">
              <Download className="w-4 h-4" /> {importing ? 'Importing…' : `Import ${unimportedAssets.length} from GC Compliance`}
            </button>
          )}
          <button onClick={() => { setEditingId(null); setForm(blankForm()); setShowForm(s => !s); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition active:scale-95">
            {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New Item</>}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">{editingId ? 'Edit item' : 'New item'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Link to GC Compliance Asset</label>
              <select value={form.site_asset_id} onChange={e => selectAsset(e.target.value)} className={inputCls}>
                <option value="">No link — standalone item</option>
                {assets.filter(a => a.is_active !== false).map(a => <option key={a.id} value={a.id}>{a.name}{a.serial_number ? ` · ${a.serial_number}` : ''} ({a.asset_type})</option>)}
              </select>
              {form.site_asset_id && (() => {
                const a = assets.find(x => x.id === form.site_asset_id);
                if (!a) return null;
                const cb = complianceBadge[a.compliance_status] || complianceBadge.unknown;
                return <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium mt-1.5 ${cb.cls}`}><ShieldCheck className="w-2.5 h-2.5" /> {cb.label}</span>;
              })()}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required placeholder="e.g. Excavator 5-ton, CP Rig 1" className={inputCls} />
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Reference / Serial</label>
              <input value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} placeholder="Auto-filled from linked asset" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer self-end pb-2">
              <input type="checkbox" checked={form.default_vat_exempt} onChange={e => setForm(p => ({ ...p, default_vat_exempt: e.target.checked }))} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
              VAT exempt by default
            </label>
          </div>

          {isRigForm && linkableItems.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <Link2 className="w-3.5 h-3.5 text-emerald-600" /> Linked Equipment (adds with this rig on jobs)
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1 bg-white rounded-lg border border-slate-200 p-2">
                {linkableItems.map(i => {
                  const checked = (form.linked_catalogue_ids || []).includes(i.id);
                  return (
                    <label key={i.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 rounded px-1.5 py-1">
                      <input type="checkbox" checked={checked} onChange={() => toggleLinked(i.id)} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
                      <span className="font-medium text-slate-700">{i.description}</span>
                      <span className="text-slate-400">{fmt(i.default_unit_cost)}/{i.default_unit_label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50">
            {saving ? 'Saving…' : editingId ? 'Update Item' : 'Add to Library'}
          </button>
        </form>
      )}

      {items.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search items..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </div>
      )}

      {isLoading ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 h-24 animate-pulse" />
      ) : items.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 py-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No items yet</p>
          <p className="text-sm text-slate-400 mt-1">Add items manually or import from GC Compliance Manager.</p>
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
                    const asset = assetFor(item);
                    const cb = asset ? (complianceBadge[asset.compliance_status] || complianceBadge.unknown) : null;
                    const linked = linkedItems(item);
                    const hasLinked = linked.length > 0;
                    const isExpanded = expandedRigId === item.id;
                    return (
                      <div key={item.id}>
                        <div className="bg-white rounded-lg border border-slate-200 p-2.5 flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium text-slate-900 truncate">{item.description}</p>
                              {cb && <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cb.cls}`}><ShieldCheck className="w-2.5 h-2.5" /> {cb.label}</span>}
                              {hasLinked && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600"><Link2 className="w-2.5 h-2.5" /> {linked.length} linked</span>}
                            </div>
                            <p className="text-xs text-slate-400">
                              {fmt(item.default_unit_cost)} / {item.default_unit_label}
                              {supplier && ` · ${supplier.name}`}
                              {item.default_vat_exempt && ' · VAT exempt'}
                              {item.reference_number && ` · ${item.reference_number}`}
                            </p>
                            {item.responsible_person && (
                              <p className="text-xs text-slate-500 inline-flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-slate-400" /> {item.responsible_person}
                              </p>
                            )}
                          </div>
                          {hasLinked && (
                            <button onClick={() => setExpandedRigId(isExpanded ? null : item.id)} className="p-1 text-slate-400 hover:text-slate-700 rounded transition">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => editItem(item)} className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => deleteItem(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                        {hasLinked && isExpanded && (
                          <div className="ml-9 mt-1 space-y-1 border-l-2 border-blue-100 pl-3">
                            {linked.map(li => {
                              const lmeta = categoryMeta[li.category] || categoryMeta.hired_equipment;
                              const LIcon = lmeta.icon;
                              return (
                                <div key={li.id} className="text-xs flex items-center gap-2 py-0.5">
                                  <LIcon className={`w-3 h-3 ${lmeta.color}`} />
                                  <span className="font-medium text-slate-600">{li.description}</span>
                                  <span className="text-slate-400">{fmt(li.default_unit_cost)}/{li.default_unit_label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
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