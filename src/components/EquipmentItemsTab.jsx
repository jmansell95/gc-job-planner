import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, X, Trash2, Edit2, Truck, ShoppingCart, Wrench, HardHat, Search, ShieldCheck, Download, Link2, ChevronDown, ChevronUp, User, Lock, Power, PowerOff, Factory, PackageCheck, PackageX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

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

const stockBadge = {
  in_stock: { label: 'In Stock', icon: PackageCheck, cls: 'bg-emerald-50 text-emerald-700' },
  low_stock: { label: 'Low Stock', icon: Package, cls: 'bg-amber-50 text-amber-700' },
  out_of_stock: { label: 'Out of Stock', icon: PackageX, cls: 'bg-red-50 text-red-700' },
  needs_service: { label: 'Needs Service', icon: Package, cls: 'bg-amber-50 text-amber-700' },
  unknown: null,
};

export default function EquipmentItemsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedRigId, setExpandedRigId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [bulkActive, setBulkActive] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['equipment-catalogue'],
    queryFn: async () => {
      const list = await base44.entities.EquipmentCatalogue.list('-created_date', 500);
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.description || '').localeCompare(b.description || ''));
    }
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers-catalogue'], queryFn: () => base44.entities.Supplier.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets-catalogue'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });

  const catalogueByAssetId = (assetId) => items.find(i => i.site_asset_id === assetId);
  const linkedItems = (item) => (item.linked_catalogue_ids || []).map(id => items.find(i => i.id === id)).filter(Boolean);
  const assetFor = (item) => item.site_asset_id ? assets.find(a => a.id === item.site_asset_id) : null;

  const q = query.toLowerCase().trim();
  const filtered = items.filter(i => {
    const matchesSearch = !q || (i.description || '').toLowerCase().includes(q) || (i.reference_number || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'all' || i.category === categoryFilter;
    const matchesActive = activeFilter === 'all' || (activeFilter === 'active' ? i.is_active !== false : i.is_active === false);
    return matchesSearch && matchesCategory && matchesActive;
  });
  const personGroups = filtered.reduce((acc, item) => {
    const person = item.responsible_person || 'Unassigned';
    if (!acc[person]) acc[person] = [];
    acc[person].push(item);
    return acc;
  }, {});

  const bulkSetActive = async (active) => {
    const targets = filtered.filter(i => i.is_active !== active);
    if (targets.length === 0) {
      toast({ title: 'Nothing to update', description: `All filtered items are already ${active ? 'active' : 'inactive'}.` });
      return;
    }
    if (!confirm(`${active ? 'Activate' : 'Deactivate'} ${targets.length} item${targets.length === 1 ? '' : 's'}?`)) return;
    setBulkActive(true);
    try {
      await base44.entities.EquipmentCatalogue.bulkUpdate(targets.map(i => ({ id: i.id, is_active: active })));
      toast({ title: `${targets.length} item${targets.length === 1 ? '' : 's'} ${active ? 'activated' : 'deactivated'}` });
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue-active'] });
    } catch (e) {
      toast({ title: 'Bulk update failed', description: e?.message, variant: 'destructive' });
    }
    setBulkActive(false);
  };

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
          <button onClick={() => { setEditingId(null); setForm(blankForm()); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition active:scale-95">
            <Plus className="w-4 h-4" /> New Item
          </button>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setForm(blankForm()); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Item' : 'New Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            {form.site_asset_id && (
              <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2 border border-blue-200">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Synced from GC Compliance Manager — description, category and reference are locked. Only billing rate details can be edited.
              </div>
            )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Link to GC Compliance Asset</label>
              <select value={form.site_asset_id} onChange={e => selectAsset(e.target.value)} className={inputCls} disabled={!!editingId}>
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
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required placeholder="e.g. Excavator 5-ton, CP Rig 1" className={`${inputCls} ${form.site_asset_id ? 'bg-slate-50 text-slate-500' : ''}`} readOnly={!!form.site_asset_id} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select value={form.category} disabled={!!form.site_asset_id} onChange={e => setForm(p => ({ ...p, category: e.target.value, default_unit_label: e.target.value === 'hired_equipment' ? 'day' : 'each', default_supplier_id: ['internal_equipment', 'contractor_supplied'].includes(e.target.value) ? '' : p.default_supplier_id }))} className={`${inputCls} ${form.site_asset_id ? 'bg-slate-50 text-slate-500' : ''}`}>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Default Billing Rate £ *</label>
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
              <input value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} placeholder="Auto-filled from linked asset" className={`${inputCls} ${form.site_asset_id ? 'bg-slate-50 text-slate-500' : ''}`} readOnly={!!form.site_asset_id} />
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
        </DialogContent>
      </Dialog>

      {items.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search items or reference..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-600 flex-shrink-0">
              <option value="all">All Categories</option>
              <option value="hired_equipment">Hired</option>
              <option value="purchased_equipment">Purchased</option>
              <option value="internal_equipment">Internal</option>
              <option value="contractor_supplied">Contractor</option>
            </select>
            <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-600 flex-shrink-0">
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-500">
              <span className="font-medium">Showing {filtered.length} of {items.length} items</span>
              <div className="flex gap-1.5 sm:ml-auto">
                <button onClick={() => bulkSetActive(true)} disabled={bulkActive} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition disabled:opacity-50">
                  <Power className="w-3.5 h-3.5" /> Activate All
                </button>
                <button onClick={() => bulkSetActive(false)} disabled={bulkActive} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition disabled:opacity-50">
                  <PowerOff className="w-3.5 h-3.5" /> Deactivate All
                </button>
              </div>
            </div>
          )}
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
          {Object.entries(personGroups).map(([person, personItems]) => {
            return (
              <div key={person}>
                <div className="flex items-center gap-1.5 mb-2 px-1 sticky top-0 bg-white py-1 z-10">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{person}</p>
                  <span className="text-xs text-slate-400">({personItems.length})</span>
                </div>
                <div className="space-y-1.5">
                  {personItems.map(item => {
                    const meta = categoryMeta[item.category] || categoryMeta.hired_equipment;
                    const Icon = meta.icon;
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
                              {asset && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600"><Factory className="w-2.5 h-2.5" /> Asset Panda</span>}
                              {cb && <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cb.cls}`}><ShieldCheck className="w-2.5 h-2.5" /> {cb.label}</span>}
                              {asset && asset.stock_level && stockBadge[asset.stock_level] && (() => {
                                const sb = stockBadge[asset.stock_level];
                                const SIcon = sb.icon;
                                const qtyText = (asset.quantity_available != null || asset.quantity_owned != null) ? ` · ${asset.quantity_available != null ? asset.quantity_available : '?'}${asset.quantity_owned != null ? `/${asset.quantity_owned}` : ''}` : '';
                                return <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sb.cls}`}><SIcon className="w-2.5 h-2.5" /> {sb.label}{qtyText}</span>;
                              })()}
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