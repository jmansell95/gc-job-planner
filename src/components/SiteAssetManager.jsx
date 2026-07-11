import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench, Plus, Trash2, Edit2, X, ShieldCheck, ShieldAlert, ShieldX, Truck, Cog, Package } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const assetTypeConfig = {
  rig: { label: 'Rig', icon: Cog, badge: 'bg-blue-100 text-blue-700' },
  machinery: { label: 'Machinery', icon: Wrench, badge: 'bg-purple-100 text-purple-700' },
  trailer: { label: 'Trailer', icon: Package, badge: 'bg-amber-100 text-amber-700' },
  vehicle: { label: 'Vehicle', icon: Truck, badge: 'bg-slate-100 text-slate-700' },
};

const complianceConfig = {
  compliant: { label: 'Compliant', icon: ShieldCheck, badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  expiring: { label: 'Expiring Soon', icon: ShieldAlert, badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  expired: { label: 'Expired', icon: ShieldX, badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  unknown: { label: 'Unknown', icon: ShieldAlert, badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

const emptyForm = {
  name: '', asset_type: 'rig', rig_type: 'n/a', serial_number: '',
  external_compliance_id: '', compliance_status: 'unknown', compliance_expiry_date: '',
  tooling_notes: '', is_active: true, notes: '',
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
    setForm({ ...emptyForm, ...asset });
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Site Assets</h2>
          <p className="text-sm text-slate-500">Rigs, machinery & trailers — linked to GC Compliance Manager</p>
        </div>
        <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </div>

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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">GC Compliance Manager ID</label>
              <input type="text" value={form.external_compliance_id} onChange={e => setForm({ ...form, external_compliance_id: e.target.value })} className={inputCls} placeholder="Asset ID from Compliance app" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Compliance Status</label>
              <select value={form.compliance_status} onChange={e => setForm({ ...form, compliance_status: e.target.value })} className={inputCls}>
                <option value="compliant">Compliant</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Compliance Expiry Date</label>
              <input type="date" value={form.compliance_expiry_date || ''} onChange={e => setForm({ ...form, compliance_expiry_date: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tooling Notes</label>
              <textarea value={form.tooling_notes} onChange={e => setForm({ ...form, tooling_notes: e.target.value })} rows={2} className={inputCls} placeholder="Associated tooling (casing sizes, augers, core barrels)" />
            </div>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assets.map(asset => {
            const typeCfg = assetTypeConfig[asset.asset_type] || assetTypeConfig.machinery;
            const compCfg = complianceConfig[asset.compliance_status] || complianceConfig.unknown;
            const TypeIcon = typeCfg.icon;
            const CompIcon = compCfg.icon;
            return (
              <div key={asset.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
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