import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench, Plus, Trash2, Edit2, X, ShieldCheck, ShieldAlert, ShieldX, Truck, Cog, Package, RefreshCw, Anchor } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';
import SyncComplianceButton from '@/components/SyncComplianceButton';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const assetTypeConfig = {
  rig: { label: 'Rig', icon: Cog, badge: 'bg-blue-100 text-blue-700' },
  machinery: { label: 'Machinery', icon: Wrench, badge: 'bg-purple-100 text-purple-700' },
  trailer: { label: 'Trailer', icon: Package, badge: 'bg-amber-100 text-amber-700' },
  vehicle: { label: 'Vehicle', icon: Truck, badge: 'bg-slate-100 text-slate-700' },
  lifting: { label: 'Lifting Equipment', icon: Anchor, badge: 'bg-teal-100 text-teal-700' },
};

const complianceConfig = {
  compliant: { label: 'Compliant', icon: ShieldCheck, badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  expiring: { label: 'Expiring Soon', icon: ShieldAlert, badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  expired: { label: 'Expired', icon: ShieldX, badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  unknown: { label: 'Unknown', icon: ShieldAlert, badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

const emptyForm = {
  name: '', asset_type: 'rig', rig_type: 'n/a', serial_number: '',
  external_compliance_id: '', tooling_notes: '', linked_equipment_ids: [], is_active: true, notes: '',
};

export default function SiteAssetManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list(),
  });

  const handleEdit = (asset) => {
    setForm({ ...emptyForm, ...asset, linked_equipment_ids: asset.linked_equipment_ids || [] });
    setEditingId(asset.id);
    setShowForm(true);
  };

  const handleAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, compliance_last_checked: new Date().toISOString() };
      if (editingId) {
        await base44.entities.SiteAsset.update(editingId, payload);
        toast({ title: 'Asset updated' });
      } else {
        await base44.entities.SiteAsset.create(payload);
        toast({ title: 'Asset added' });
      }
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      toast({ title: 'Error saving asset', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this asset?')) return;
    try {
      await base44.entities.SiteAsset.delete(id);
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      toast({ title: 'Asset deleted' });
    } catch (err) {
      toast({ title: 'Error deleting', description: err.message, variant: 'destructive' });
    }
  };

  // Compliance issue counts for visual warnings
  const expiredCount = assets.filter(a => a.compliance_status === 'expired').length;
  const unknownCount = assets.filter(a => a.compliance_status === 'unknown').length;
  const expiringCount = assets.filter(a => a.compliance_status === 'expiring').length;
  const neverSyncedCount = assets.filter(a => !a.compliance_last_checked).length;

  // Filter state
  const [typeTab, setTypeTab] = useState('all');
  const [search, setSearch] = useState('');
  const [compFilter, setCompFilter] = useState('all');

  const typeTabs = [
    { key: 'all', label: 'All', icon: null },
    { key: 'rig', label: 'Rigs', icon: Cog },
    { key: 'lifting', label: 'Lifting', icon: Anchor },
    { key: 'machinery', label: 'Machinery', icon: Wrench },
    { key: 'trailer', label: 'Trailers', icon: Package },
    { key: 'vehicle', label: 'Vehicles', icon: Truck },
  ];

  const filteredAssets = assets.filter(a => {
    if (typeTab !== 'all' && a.asset_type !== typeTab) return false;
    if (compFilter !== 'all' && (a.compliance_status || 'unknown') !== compFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const nameMatch = (a.name || '').toLowerCase().includes(q);
      const serialMatch = (a.serial_number || '').toLowerCase().includes(q);
      if (!nameMatch && !serialMatch) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Site Assets</h2>
          <p className="text-sm text-slate-500">Rigs, machinery & trailers — compliance synced from GC Compliance Manager</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncComplianceButton />
          <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      {/* Issue banners */}
      {(expiredCount > 0 || unknownCount > 0 || neverSyncedCount > 0) && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {expiredCount > 0 && <p className="text-sm font-semibold text-red-700">{expiredCount} expired</p>}
            {expiringCount > 0 && <p className="text-sm font-semibold text-amber-700">{expiringCount} expiring soon</p>}
            {unknownCount > 0 && <p className="text-sm font-semibold text-slate-600">{unknownCount} unknown status</p>}
            {neverSyncedCount > 0 && <p className="text-sm font-semibold text-blue-600">{neverSyncedCount} never synced</p>}
            <p className="text-xs text-amber-600 w-full">Click "Sync Compliance" to refresh statuses from GC Compliance Manager.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {assets.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-4 space-y-3">
          <div className="flex gap-1 flex-wrap">
            {typeTabs.map(tab => {
              const count = tab.key === 'all' ? assets.length : assets.filter(a => a.asset_type === tab.key).length;
              const TabIcon = tab.icon;
              return (
                <button key={tab.key} onClick={() => setTypeTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${typeTab === tab.key ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {TabIcon && <TabIcon className="w-3.5 h-3.5" />} {tab.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeTab === tab.key ? 'bg-emerald-600' : 'bg-slate-200'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or serial..."
              className="flex-1 min-w-[180px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            <select value={compFilter} onChange={e => setCompFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
              <option value="all">All Status</option>
              <option value="compliant">Compliant</option>
              <option value="expiring">Expiring Soon</option>
              <option value="expired">Expired</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">{editingId ? 'Edit Asset' : 'New Asset'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Asset Name</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} placeholder="e.g. Truck-mounted Rig 1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Asset Type</label>
              <select value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })} className={inputCls}>
                <option value="rig">Rig</option>
                <option value="machinery">Machinery</option>
                <option value="trailer">Trailer</option>
                <option value="vehicle">Vehicle</option>
                <option value="lifting">Lifting Equipment</option>
              </select>
            </div>
            {form.asset_type === 'rig' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Rig Type</label>
                <select value={form.rig_type} onChange={e => setForm({ ...form, rig_type: e.target.value })} className={inputCls}>
                  <option value="n/a">N/A</option>
                  <option value="cp">CP (Cable Percussion)</option>
                  <option value="rotary">Rotary</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Serial / Reg Number</label>
              <input type="text" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Compliance status and expiry date are synced automatically from the <strong>GC Compliance Manager</strong> app. Use the "Sync Compliance" button above to refresh.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">GC Compliance Manager ID <span className="text-slate-400 font-normal">(optional)</span></label>
              <input type="text" value={form.external_compliance_id} onChange={e => setForm({ ...form, external_compliance_id: e.target.value })} className={inputCls} placeholder="Auto-matched by serial/name if blank" />
              <p className="text-[11px] text-slate-400 mt-1">Leave blank — the sync auto-matches by serial number or name.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tooling Notes</label>
              <textarea value={form.tooling_notes} onChange={e => setForm({ ...form, tooling_notes: e.target.value })} rows={2} className={inputCls} placeholder="Associated tooling (casing sizes, augers, core barrels)" />
            </div>
            {form.asset_type === 'rig' && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Linked Equipment</label>
                <p className="text-xs text-slate-400 mb-2">Select the lifting equipment, machinery and trailers that belong to this rig. When assigning this rig to a drilling job, the linked equipment is shown for quick bulk assignment.</p>
                <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-lg divide-y divide-slate-100 bg-white">
                  {assets.filter(a => a.asset_type !== 'rig' && a.id !== editingId).length === 0 ? (
                    <p className="text-xs text-slate-400 px-3 py-2">No equipment available to link. Add machinery or trailers first.</p>
                  ) : (
                    assets.filter(a => a.asset_type !== 'rig' && a.id !== editingId).map(a => {
                      const TypeIcon = assetTypeConfig[a.asset_type]?.icon || Wrench;
                      const isChecked = (form.linked_equipment_ids || []).includes(a.id);
                      return (
                        <label key={a.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" checked={isChecked}
                            onChange={(e) => {
                              const current = new Set(form.linked_equipment_ids || []);
                              if (e.target.checked) current.add(a.id);
                              else current.delete(a.id);
                              setForm({ ...form, linked_equipment_ids: Array.from(current) });
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                          <TypeIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-700 flex-1">{a.name}</span>
                          {a.serial_number && <span className="text-xs text-slate-400 font-mono">{a.serial_number}</span>}
                        </label>
                      );
                    })
                  )}
                </div>
                {(form.linked_equipment_ids || []).length > 0 && (
                  <p className="text-[11px] text-emerald-600 mt-1.5">{(form.linked_equipment_ids || []).length} item(s) linked</p>
                )}
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="px-5 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">{editingId ? 'Update' : 'Add Asset'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : assets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={Wrench} title="No assets yet" message="Add your rigs, machinery and trailers here. Link each asset to its record in GC Compliance Manager." actionLabel="Add Asset" onAction={handleAdd} />
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={Wrench} title="No matches" message="No assets match your current filters. Try clearing the search or changing the filter." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAssets.map(asset => {
            const typeCfg = assetTypeConfig[asset.asset_type] || assetTypeConfig.machinery;
            const compCfg = complianceConfig[asset.compliance_status] || complianceConfig.unknown;
            const TypeIcon = typeCfg.icon;
            const CompIcon = compCfg.icon;
            const cardBorder = asset.compliance_status === 'expired' ? 'border-l-4 border-l-red-400' :
              asset.compliance_status === 'expiring' ? 'border-l-4 border-l-amber-400' :
              asset.compliance_status === 'unknown' ? 'border-l-4 border-l-slate-300' :
              !asset.compliance_last_checked ? 'border-l-4 border-l-blue-300' : '';
            return (
              <div key={asset.id} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${cardBorder}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <TypeIcon className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{asset.name}</p>
                      {asset.serial_number && <p className="text-xs text-slate-400 font-mono truncate">{asset.serial_number}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleEdit(asset)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(asset.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeCfg.badge}`}>{typeCfg.label}</span>
                  {asset.rig_type && asset.rig_type !== 'n/a' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 uppercase">{asset.rig_type}</span>
                  )}
                  {!asset.is_active && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600">Inactive</span>}
                </div>
                <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${compCfg.badge}`}>
                  <CompIcon className="w-4 h-4" />
                  <span className="text-xs font-semibold">{compCfg.label}</span>
                  {asset.compliance_expiry_date && <span className="text-xs opacity-70 ml-auto">Expires {asset.compliance_expiry_date}</span>}
                </div>
                {asset.compliance_last_checked && (
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5" />
                    Synced {new Date(asset.compliance_last_checked).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {asset.tooling_notes && (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{asset.tooling_notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}