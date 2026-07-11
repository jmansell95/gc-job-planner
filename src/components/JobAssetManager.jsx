import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cog, Plus, Trash2, X, ShieldCheck, ShieldAlert, ShieldX, Truck, Wrench, Package, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';

const roleLabels = {
  primary_rig: 'Primary Rig',
  support_rig: 'Support Rig',
  machinery: 'Machinery',
  trailer: 'Trailer',
  welfare_unit: 'Welfare Unit',
};

const assetTypeIcon = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck };

const complianceConfig = {
  compliant: { label: 'Compliant', icon: ShieldCheck, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring: { label: 'Expiring', icon: ShieldAlert, badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', icon: ShieldX, badge: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { label: 'Unknown', icon: ShieldAlert, badge: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export default function JobAssetManager({ job, isDrillingJob }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ asset_id: '', role: 'primary_rig', notes: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['job-asset-assignments', job.id],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: job.id }),
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list(),
  });

  const availableAssets = assets.filter(a => {
    if (a.is_active === false) return false;
    if (assignments.some(asg => asg.asset_id === a.id)) return false;
    if (isDrillingJob) return true;
    return a.asset_type !== 'rig';
  });

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!form.asset_id) return;
    try {
      const asset = assets.find(a => a.id === form.asset_id);
      if (!asset) return;
      if (!isDrillingJob && asset.asset_type === 'rig') {
        toast({ title: 'Rigs can only be assigned to drilling jobs', variant: 'destructive' });
        return;
      }
      if (asset.asset_type === 'rig' && asset.compliance_status !== 'compliant') {
        toast({ title: 'Rig not compliant', description: 'This rig cannot be taken to site. Please speak with the Compliance Manager, Jordan Mansell, to get this compliant before deploying.', variant: 'destructive' });
        return;
      }
      await base44.entities.JobAssetAssignment.create({
        job_id: job.id,
        job_name: job.name,
        asset_id: asset.id,
        asset_name: asset.name,
        asset_type: asset.asset_type,
        rig_type: asset.rig_type || 'n/a',
        role: form.role,
        compliance_status: asset.compliance_status || 'unknown',
        status: 'assigned',
        assigned_date: new Date().toISOString().split('T')[0],
        notes: form.notes,
      });
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments', job.id] });
      toast({ title: 'Asset assigned', description: `${asset.name} added to ${job.name}` });
      setForm({ asset_id: '', role: 'primary_rig', notes: '' });
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Error assigning asset', description: err.message, variant: 'destructive' });
    }
  };

  const handleRemove = async (assignmentId, assetName) => {
    if (!confirm(`Remove ${assetName} from this job?`)) return;
    try {
      await base44.entities.JobAssetAssignment.delete(assignmentId);
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments', job.id] });
      toast({ title: 'Asset removed' });
    } catch (err) {
      toast({ title: 'Error removing asset', description: err.message, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (assignmentId, newStatus) => {
    try {
      const update = { status: newStatus };
      if (newStatus === 'on_site') update.arrived_on_site_date = new Date().toISOString().split('T')[0];
      if (newStatus === 'returned') update.returned_date = new Date().toISOString().split('T')[0];
      await base44.entities.JobAssetAssignment.update(assignmentId, update);
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments', job.id] });
    } catch (err) {
      toast({ title: 'Error updating status', description: err.message, variant: 'destructive' });
    }
  };

  const hasNonCompliant = assignments.some(a => {
    const asset = assets.find(as => as.id === a.asset_id);
    const status = asset?.compliance_status || a.compliance_status || 'unknown';
    return status === 'expired' || status === 'unknown';
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Cog className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Rigs & Equipment</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{assignments.length}</span>
        {isDrillingJob && assignments.length === 0 && (
          <span className="text-xs text-amber-600 font-medium">Drilling job — assign a rig</span>
        )}
        {!isDrillingJob && (
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">Machinery & trailers only</span>
        )}
      </div>

      {hasNonCompliant && (
        <div className="flex items-start gap-2 bg-red-50 border-b border-red-100 px-5 py-3">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-800">Non-compliant asset assigned</p>
            <p className="text-[11px] text-red-700 mt-0.5">One or more assets have expired or unknown compliance. Check GC Compliance Manager before deploying.</p>
          </div>
        </div>
      )}

      <div className="p-5">
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : assignments.length === 0 ? (
          <div className="text-center py-6">
            <Cog className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No rigs or equipment assigned yet</p>
            {isDrillingJob ? (
              <p className="text-xs text-amber-600 mt-1">This is a drilling job — assign a rig and associated tooling.</p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">Machinery, trailers and welfare units can be assigned. Rigs are only available on drilling jobs.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(a => {
              const asset = assets.find(as => as.id === a.asset_id);
              const liveStatus = asset?.compliance_status || a.compliance_status || 'unknown';
              const compCfg = complianceConfig[liveStatus] || complianceConfig.unknown;
              const CompIcon = compCfg.icon;
              const TypeIcon = assetTypeIcon[a.asset_type] || Cog;
              return (
                <div key={a.id} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <TypeIcon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{a.asset_name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{roleLabels[a.role] || a.role}</span>
                      {a.rig_type && a.rig_type !== 'n/a' && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 uppercase">{a.rig_type}</span>}
                    </div>
                    {asset?.serial_number && <p className="text-xs text-slate-400 font-mono mt-0.5">{asset.serial_number}</p>}
                    {asset?.tooling_notes && <p className="text-xs text-slate-500 mt-1">{asset.tooling_notes}</p>}
                    {a.notes && <p className="text-xs text-slate-500 mt-1 italic">{a.notes}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${compCfg.badge}`}>
                        <CompIcon className="w-3 h-3" /> {compCfg.label}
                      </span>
                      {asset?.compliance_expiry_date && <span className="text-xs text-slate-400">Expires {asset.compliance_expiry_date}</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {['assigned', 'on_site', 'returned'].map(st => (
                        <button key={st} onClick={() => handleStatusChange(a.id, st)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition ${a.status === st ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          {st === 'assigned' ? 'Planned' : st === 'on_site' ? 'On Site' : 'Returned'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => handleRemove(a.id, a.asset_name)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {showForm ? (
          <form onSubmit={handleAssign} className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Assign Asset</h4>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            {availableAssets.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">No available assets. All assets are already assigned or inactive. Add more in Settings → Assets.</p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Asset {isDrillingJob && <span className="text-amber-600 font-normal">— rigs only (drilling job)</span>}
                  </label>
                  <div className="max-h-56 overflow-y-auto border border-slate-300 rounded-lg divide-y divide-slate-100 bg-white">
                    {availableAssets.map(a => {
                      const compCfg = complianceConfig[a.compliance_status] || complianceConfig.unknown;
                      const CompIcon = compCfg.icon;
                      const TypeIcon = assetTypeIcon[a.asset_type] || Cog;
                      const isRig = a.asset_type === 'rig';
                      const isNonCompliantRig = isRig && a.compliance_status !== 'compliant';
                      const isSelected = form.asset_id === a.id;
                      return (
                        <button key={a.id} type="button"
                          onClick={() => {
                            if (isNonCompliantRig) {
                              toast({ title: 'Rig not compliant', description: 'This rig cannot be taken to site. Please speak with the Compliance Manager, Jordan Mansell, to get this compliant before deploying.', variant: 'destructive' });
                              return;
                            }
                            setForm({ ...form, asset_id: a.id });
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${isNonCompliantRig ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-50 cursor-pointer'} ${isSelected ? 'bg-emerald-100 ring-1 ring-emerald-300' : ''}`}>
                          <TypeIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{a.name}</p>
                            {a.serial_number && <p className="text-[10px] text-slate-400 font-mono truncate">{a.serial_number}</p>}
                          </div>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border flex-shrink-0 ${compCfg.badge}`}>
                            <CompIcon className="w-2.5 h-2.5" /> {compCfg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {form.asset_id && (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Selected: <strong>{assets.find(a => a.id === form.asset_id)?.name}</strong>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                    {Object.entries(roleLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                  <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                </div>
                <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">Assign to Job</button>
              </>
            )}
          </form>
        ) : (
          <button onClick={() => setShowForm(true)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> {isDrillingJob ? 'Assign Rig / Equipment' : 'Assign Machinery / Trailer'}
          </button>
        )}
      </div>
    </div>
  );
}