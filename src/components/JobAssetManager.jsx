import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cog, Plus, Trash2, ShieldCheck, ShieldAlert, ShieldX, Truck, Wrench, Package, AlertTriangle, Link2, Anchor, ArrowRight, Check, X, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import JobAssetAssignForm from '@/components/JobAssetAssignForm';

const roleLabels = {
  primary_rig: 'Primary Rig',
  support_rig: 'Support Rig',
  machinery: 'Machinery',
  trailer: 'Trailer',
  lifting: 'Lifting Equipment',
  welfare_unit: 'Welfare Unit',
};

const assetTypeIcon = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor };

const statusConfig = {
  assigned: { label: 'Planned', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
  on_site: { label: 'On Site', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  returned: { label: 'Returned', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
};

const complianceConfig = {
  compliant: { label: 'Compliant', icon: ShieldCheck, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring: { label: 'Expiring', icon: ShieldAlert, badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', icon: ShieldX, badge: 'bg-red-50 text-red-700 border-red-200' },
  non_compliant: { label: 'Not Compliant', icon: ShieldX, badge: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { label: 'Unknown', icon: ShieldAlert, badge: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const tabConfig = {
  rigs: { label: 'Rigs', icon: Cog },
  lifting: { label: 'Lifting Equipment', icon: Anchor },
  machinery: { label: 'Machinery', icon: Wrench },
  trailers: { label: 'Trailers', icon: Package },
};

const goToAssets = () => {
  window.dispatchEvent(new CustomEvent('app-navigate', { detail: { section: 'settings', settingsTab: 'assets' } }));
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

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const assignedAssetIds = new Set(assignments.map(a => a.asset_id));

  // Partition assignments by asset type
  const rigAssignments = assignments.filter(a => a.asset_type === 'rig');
  const trailerAssignments = assignments.filter(a => a.asset_type === 'trailer');
  const machineryAssignments = assignments.filter(a => a.asset_type === 'machinery');
  const liftingAssignments = assignments.filter(a => a.asset_type === 'lifting');

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
  const standaloneLifting = liftingAssignments.filter(a => !linkedEquipmentIds.has(a.asset_id));

  // Rigs tab only visible for drilling jobs
  // Lifting Equipment tab only visible to drillers and admins/managers
  const canViewLifting = profile?.is_admin || profile?.system_role === 'admin' || profile?.system_role === 'manager' ||
    profile?.job_role === 'cp_driller' || profile?.job_role === 'rotary_driller' ||
    profile?.team?.job_type === 'cp_drilling' || profile?.team?.job_type === 'rotary_drilling';
  const baseTabs = isDrillingJob ? ['rigs', 'lifting', 'machinery', 'trailers'] : ['machinery', 'trailers'];
  const tabs = canViewLifting ? baseTabs : baseTabs.filter(t => t !== 'lifting');

  // Ensure activeTab is valid for non-drilling (in case isDrillingJob changes)
  if (!isDrillingJob && activeTab === 'rigs') {
    setActiveTab('machinery');
  }
  if (!canViewLifting && activeTab === 'lifting') {
    setActiveTab(isDrillingJob ? 'rigs' : 'machinery');
  }

  const currentAssignments = activeTab === 'rigs' ? rigAssignments : activeTab === 'lifting' ? standaloneLifting : activeTab === 'trailers' ? standaloneTrailers : standaloneMachinery;

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

  // Calculate overall compliance for a rig + all its linked equipment
  const getOverallRigCompliance = (rigAssignment) => {
    const rigAsset = assets.find(as => as.id === rigAssignment.asset_id);
    const allItems = [rigAsset];
    if (rigAsset?.linked_equipment_ids) {
      for (const id of rigAsset.linked_equipment_ids) {
        const linked = assets.find(as => as.id === id);
        if (linked) allItems.push(linked);
      }
    }
    return allItems.filter(Boolean).every(a => (a.compliance_status || 'unknown') === 'compliant');
  };

  const renderAssetCard = (a, showTooling = false, linkedStats = null, overallCompliant = null) => {
    const asset = assets.find(as => as.id === a.asset_id);
    const liveStatus = asset?.compliance_status || a.compliance_status || 'unknown';
    const statusKey = (liveStatus === 'expired' || liveStatus === 'unknown') ? 'non_compliant' : liveStatus;
    const compCfg = complianceConfig[statusKey] || complianceConfig.unknown;
    const CompIcon = compCfg.icon;
    const TypeIcon = assetTypeIcon[a.asset_type] || Cog;
    return (
      <div key={a.id} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <TypeIcon className="w-5 h-5 text-slate-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={goToAssets} className="font-semibold text-slate-900 text-sm hover:text-emerald-700 hover:underline inline-flex items-center gap-1">
              {a.asset_name} <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{roleLabels[a.role] || a.role}</span>
            {a.rig_type && a.rig_type !== 'n/a' && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 uppercase">{a.rig_type}</span>}
            {asset?.equipment_type && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{asset.equipment_type}</span>
            )}
            {overallCompliant !== null && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${overallCompliant ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {overallCompliant ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {overallCompliant ? 'All Compliant' : 'Not Compliant'}
              </span>
            )}
          </div>
          {asset?.serial_number && <p className="text-sm font-bold text-slate-600 font-mono mt-1">{asset.serial_number}</p>}
          {linkedStats && linkedStats.total > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <Link2 className="w-3 h-3" /> {linkedStats.total} {linkedStats.total === 1 ? 'piece' : 'pieces'} of equipment connected · {linkedStats.compliant}/{linkedStats.total} compliant
            </div>
          )}
          {showTooling && (() => {
            const rigAsset = assets.find(as => as.id === a.asset_id);
            const linkedLifting = (rigAsset?.linked_equipment_ids || [])
              .map(id => assets.find(as => as.id === id))
              .filter(as => as && as.asset_type === 'lifting');
            if (linkedLifting.length === 0) return null;
            return (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Lifting Equipment on this Rig</p>
                {linkedLifting.map(item => {
                  const itemStatus = item.compliance_status || 'unknown';
                  const itemKey = (itemStatus === 'expired' || itemStatus === 'unknown') ? 'non_compliant' : itemStatus;
                  const itemCfg = complianceConfig[itemKey] || complianceConfig.unknown;
                  const ItemIcon = itemCfg.icon;
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-md px-2 py-1.5">
                      <Anchor className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 truncate">
                        <span className="text-slate-700 font-medium">{item.name}</span>
                        {item.equipment_type && <span className="ml-1.5 text-[10px] text-emerald-600 font-medium">({item.equipment_type})</span>}
                        {item.serial_number && <span className="ml-2 font-mono text-[10px] font-bold text-slate-500">{item.serial_number}</span>}
                      </div>
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium border ${itemCfg.badge}`}>
                        <ItemIcon className="w-2.5 h-2.5" /> {itemCfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {showTooling && asset?.tooling_notes && (
            <div className="mt-1.5 bg-blue-50/50 border border-blue-100 rounded-md px-2.5 py-1.5">
              <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Tooling & Equipment</p>
              <p className="text-xs text-slate-600">{asset.tooling_notes}</p>
            </div>
          )}
          {a.notes && <p className="text-xs text-slate-500 mt-1 italic">{a.notes}</p>}
          <div className="flex items-center gap-2 mt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition ${statusConfig[a.status || 'assigned']?.badge || statusConfig.assigned.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[a.status || 'assigned']?.dot || statusConfig.assigned.dot}`} />
                  {statusConfig[a.status || 'assigned']?.label || 'Planned'}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {['assigned', 'on_site', 'returned'].map(st => (
                  <DropdownMenuItem key={st} onClick={() => handleStatusChange(a.id, st)} className={`text-xs ${a.status === st ? 'font-semibold' : ''}`}>
                    {statusConfig[st].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {asset?.compliance_expiry_date && <span className="text-xs text-slate-400">Expires {asset.compliance_expiry_date}</span>}
          </div>
        </div>
        <button onClick={() => handleRemove(a.id, a.asset_name)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const emptyIcon = activeTab === 'rigs' ? Cog : activeTab === 'lifting' ? Anchor : activeTab === 'trailers' ? Package : Wrench;

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
      <div className="flex gap-1 px-5 pt-4 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {tabs.map(tabKey => {
          const cfg = tabConfig[tabKey];
          const TabIcon = cfg.icon;
          const count = tabKey === 'rigs' ? rigAssignments.length : tabKey === 'lifting' ? standaloneLifting.length : tabKey === 'trailers' ? standaloneTrailers.length : standaloneMachinery.length;
          return (
            <button key={tabKey} type="button" onClick={() => setActiveTab(tabKey)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition flex-shrink-0 whitespace-nowrap ${activeTab === tabKey ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
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
              {activeTab === 'rigs' ? 'No rigs assigned yet' : activeTab === 'lifting' ? 'No lifting equipment assigned' : activeTab === 'trailers' ? 'No trailers assigned' : 'No machinery assigned'}
            </p>
            {activeTab === 'rigs' && isDrillingJob && (
              <p className="text-xs text-amber-600 mt-1">This is a drilling job — assign a rig and associated tooling.</p>
            )}
          </div>
        ) : activeTab === 'rigs' ? (
          /* Rigs tab: show each rig with a count of connected equipment */
          <div className="space-y-3">
            {rigAssignments.map(rigA => renderAssetCard(rigA, true, getLinkedEquipmentStats(rigA), getOverallRigCompliance(rigA)))}
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