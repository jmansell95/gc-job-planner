import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cog, Plus, Trash2, ShieldCheck, ShieldAlert, ShieldX, Truck, Wrench, Package, AlertTriangle, Link2 } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';
import JobAssetAssignForm from '@/components/JobAssetAssignForm';

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

const tabConfig = {
  rigs: { label: 'Rigs', icon: Cog },
  trailers: { label: 'Trailers', icon: Package },
  machinery: { label: 'Machinery', icon: Wrench },
};

export default function JobAssetManager({ job, isDrillingJob }) {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState(isDrillingJob ? 'rigs' : 'machinery');
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

  const assignedAssetIds = new Set(assignments.map(a => a.asset_id));

  // Partition assignments by asset type
  const rigAssignments = assignments.filter(a => a.asset_type === 'rig');
  const trailerAssignments = assignments.filter(a => a.asset_type === 'trailer');
  const machineryAssignments = assignments.filter(a => a.asset_type === 'machinery');

  // Collect ALL equipment IDs linked to ANY rig (not just assigned ones) — excluded from Machinery/Trailer tabs
  const linkedEquipmentIds = new Set();
  for (const asset of assets) {
    if (asset.asset_type === 'rig' && asset.linked_equipment_ids) {
      asset.linked_equipment_ids.forEach(id => linkedEquipmentIds.add(id));
    }
  }

  // Standalone trailers & machinery (exclude rig-linked equipment like shackles, ropes)
  const standaloneTrailers = trailerAssignments.filter(a => !linkedEquipmentIds.has(a.asset_id));
  const standaloneMachinery = machineryAssignments.filter(a => !linkedEquipmentIds.has(a.asset_id));

  // Rigs tab only visible for drilling jobs
  const tabs = isDrillingJob ? ['rigs', 'trailers', 'machinery'] : ['trailers', 'machinery'];

  // Ensure activeTab is valid for non-drilling (in case isDrillingJob changes)
  if (!isDrillingJob && activeTab === 'rigs') {
    setActiveTab('machinery');
  }

  const currentAssignments = activeTab === 'rigs' ? rigAssignments : activeTab === 'trailers' ? standaloneTrailers : standaloneMachinery;

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

  // Get linked equipment stats (total + compliant count) for a given rig
  const getLinkedEquipmentStats = (rigAssignment) => {
    const rigAsset = assets.find(as => as.id === rigAssignment.asset_id);
    if (!rigAsset?.linked_equipment_ids || rigAsset.linked_equipment_ids.length === 0) return { total: 0, compliant: 0 };
    const linkedAssets = rigAsset.linked_equipment_ids
      .map(id => assets.find(as => as.id === id))
      .filter(Boolean);
    const compliant = linkedAssets.filter(a => (a.compliance_status || 'unknown') === 'compliant').length;
    return { total: linkedAssets.length, compliant };
  };

  const renderAssetCard = (a, showTooling = false, linkedStats = null) => {
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
          {linkedStats && linkedStats.total > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <Link2 className="w-3 h-3" /> {linkedStats.total} {linkedStats.total === 1 ? 'piece' : 'pieces'} of equipment connected · {linkedStats.compliant}/{linkedStats.total} compliant
            </div>
          )}
          {showTooling && asset?.tooling_notes && (
            <div className="mt-1.5 bg-blue-50/50 border border-blue-100 rounded-md px-2.5 py-1.5">
              <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Tooling & Equipment</p>
              <p className="text-xs text-slate-600">{asset.tooling_notes}</p>
            </div>
          )}
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
  };

  const emptyIcon = activeTab === 'rigs' ? Cog : activeTab === 'trailers' ? Package : Wrench;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Cog className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Equipment</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{assignments.length}</span>
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

      {/* Tabs */}
      <div className="flex gap-1 px-5 pt-4 border-b border-slate-200">
        {tabs.map(tabKey => {
          const cfg = tabConfig[tabKey];
          const TabIcon = cfg.icon;
          const count = tabKey === 'rigs' ? rigAssignments.length : tabKey === 'trailers' ? standaloneTrailers.length : standaloneMachinery.length;
          return (
            <button key={tabKey} type="button" onClick={() => setActiveTab(tabKey)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${activeTab === tabKey ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <TabIcon className="w-3.5 h-3.5" /> {cfg.label}
              <span className="ml-0.5 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : currentAssignments.length === 0 ? (
          <div className="text-center py-6">
            {React.createElement(emptyIcon, { className: 'w-8 h-8 text-slate-300 mx-auto mb-2' })}
            <p className="text-sm text-slate-400">
              {activeTab === 'rigs' ? 'No rigs assigned yet' : activeTab === 'trailers' ? 'No trailers assigned' : 'No machinery assigned'}
            </p>
            {activeTab === 'rigs' && isDrillingJob && (
              <p className="text-xs text-amber-600 mt-1">This is a drilling job — assign a rig and associated tooling.</p>
            )}
          </div>
        ) : activeTab === 'rigs' ? (
          /* Rigs tab: show each rig with a count of connected equipment */
          <div className="space-y-3">
            {rigAssignments.map(rigA => renderAssetCard(rigA, true, getLinkedEquipmentStats(rigA)))}
          </div>
        ) : (
          /* Trailers / Machinery tabs: no tooling notes shown */
          <div className="space-y-3">
            {currentAssignments.map(a => renderAssetCard(a, false))}
          </div>
        )}

        {showForm ? (
          <JobAssetAssignForm
            job={job}
            isDrillingJob={isDrillingJob}
            assets={assets}
            assignedAssetIds={assignedAssetIds}
            onClose={() => setShowForm(false)}
          />
        ) : (
          <button onClick={() => setShowForm(true)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> {isDrillingJob ? 'Assign Rig / Equipment' : 'Assign Machinery / Trailer'}
          </button>
        )}
      </div>
    </div>
  );
}