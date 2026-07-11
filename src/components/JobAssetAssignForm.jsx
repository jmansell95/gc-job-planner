import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Cog, Wrench, Package, Truck, ShieldCheck, ShieldAlert, ShieldX, Plus, CheckCircle2, Link2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const complianceConfig = {
  compliant: { label: 'Compliant', icon: ShieldCheck, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring: { label: 'Expiring', icon: ShieldAlert, badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', icon: ShieldX, badge: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { label: 'Unknown', icon: ShieldAlert, badge: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const assetTypeIcon = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck };

const tabConfig = {
  rigs: { label: 'Rigs', icon: Cog, asset_type: 'rig' },
  machinery: { label: 'Machinery', icon: Wrench, asset_type: 'machinery' },
  trailers: { label: 'Trailers', icon: Package, asset_type: 'trailer' },
};

export default function JobAssetAssignForm({ job, isDrillingJob, assets, assignedAssetIds, onClose }) {
  const [activeTab, setActiveTab] = useState(isDrillingJob ? 'rigs' : 'machinery');
  const [selectedRigId, setSelectedRigId] = useState(null);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(new Set());
  const [selectedSingleId, setSelectedSingleId] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tabs = isDrillingJob ? ['rigs', 'machinery', 'trailers'] : ['machinery', 'trailers'];

  // Collect ALL equipment IDs linked to ANY rig — excluded from Machinery tab (lifting equipment lives under its rig)
  const allLinkedEquipmentIds = new Set();
  for (const asset of assets) {
    if (asset.asset_type === 'rig' && asset.linked_equipment_ids) {
      asset.linked_equipment_ids.forEach(id => allLinkedEquipmentIds.add(id));
    }
  }

  const availableForTab = (tabKey) => {
    const targetType = tabConfig[tabKey].asset_type;
    return assets.filter(a => {
      if (a.is_active === false) return false;
      if (assignedAssetIds.has(a.id)) return false;
      if (a.asset_type !== targetType) return false;
      // Exclude rig-linked lifting equipment from Machinery tab
      if (tabKey === 'machinery' && allLinkedEquipmentIds.has(a.id)) return false;
      return true;
    });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedRigId(null);
    setSelectedSingleId(null);
    setSelectedEquipmentIds(new Set());
  };

  const handleRigSelect = (rig) => {
    if (rig.compliance_status !== 'compliant') {
      toast({ title: 'Rig not compliant', description: 'This rig cannot be taken to site. Please speak with the Compliance Manager, Jordan Mansell, to get this compliant before deploying.', variant: 'destructive' });
      return;
    }
    setSelectedRigId(rig.id);
    const linked = new Set(rig.linked_equipment_ids || []);
    const availableLinked = Array.from(linked).filter(eid =>
      !assignedAssetIds.has(eid) && assets.find(a => a.id === eid && a.is_active !== false)
    );
    setSelectedEquipmentIds(new Set(availableLinked));
  };

  const toggleEquipment = (eqId) => {
    const next = new Set(selectedEquipmentIds);
    if (next.has(eqId)) next.delete(eqId);
    else next.add(eqId);
    setSelectedEquipmentIds(next);
  };

  const handleAssign = async () => {
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const assignments = [];

      if (activeTab === 'rigs' && selectedRigId) {
        const rig = assets.find(a => a.id === selectedRigId);
        if (!rig) return;
        assignments.push({
          job_id: job.id, job_name: job.name,
          asset_id: rig.id, asset_name: rig.name,
          asset_type: 'rig', rig_type: rig.rig_type || 'n/a',
          role: 'primary_rig', compliance_status: rig.compliance_status || 'unknown',
          status: 'assigned', assigned_date: today, notes,
        });
        for (const eqId of selectedEquipmentIds) {
          const eq = assets.find(a => a.id === eqId);
          if (eq) {
            assignments.push({
              job_id: job.id, job_name: job.name,
              asset_id: eq.id, asset_name: eq.name,
              asset_type: eq.asset_type, rig_type: 'n/a',
              role: eq.asset_type === 'trailer' ? 'trailer' : 'machinery',
              compliance_status: eq.compliance_status || 'unknown',
              status: 'assigned', assigned_date: today,
              notes: `Linked to ${rig.name}`,
            });
          }
        }
      } else if (selectedSingleId) {
        const asset = assets.find(a => a.id === selectedSingleId);
        if (asset) {
          assignments.push({
            job_id: job.id, job_name: job.name,
            asset_id: asset.id, asset_name: asset.name,
            asset_type: asset.asset_type, rig_type: 'n/a',
            role: asset.asset_type === 'trailer' ? 'trailer' : 'machinery', compliance_status: asset.compliance_status || 'unknown',
            status: 'assigned', assigned_date: today, notes,
          });
        }
      }

      if (assignments.length === 0) {
        toast({ title: 'Select an asset first', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      await base44.entities.JobAssetAssignment.bulkCreate(assignments);
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments', job.id] });
      const label = assignments.length > 1
        ? `${assignments[0].asset_name} + ${assignments.length - 1} linked items`
        : assignments[0].asset_name;
      toast({ title: 'Asset assigned', description: `${label} added to ${job.name}` });
      onClose();
    } catch (err) {
      toast({ title: 'Error assigning asset', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderAssetItem = (asset, isSelected, onSelect, disabled = false) => {
    const compCfg = complianceConfig[asset.compliance_status] || complianceConfig.unknown;
    const CompIcon = compCfg.icon;
    const TypeIcon = assetTypeIcon[asset.asset_type] || Cog;
    return (
      <button key={asset.id} type="button" onClick={onSelect}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-50 cursor-pointer'} ${isSelected ? 'bg-emerald-100 ring-1 ring-emerald-300' : ''}`}>
        <TypeIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 truncate">{asset.name}</p>
          {asset.serial_number && <p className="text-[10px] text-slate-400 font-mono truncate">{asset.serial_number}</p>}
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border flex-shrink-0 ${compCfg.badge}`}>
          <CompIcon className="w-2.5 h-2.5" /> {compCfg.label}
        </span>
      </button>
    );
  };

  const selectedRig = selectedRigId ? assets.find(a => a.id === selectedRigId) : null;
  const linkedEquipment = selectedRig?.linked_equipment_ids
    ? selectedRig.linked_equipment_ids.map(id => assets.find(a => a.id === id)).filter(Boolean)
    : [];

  const canSubmit = activeTab === 'rigs' ? selectedRigId : selectedSingleId;

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleAssign(); }} className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">Assign Asset</h4>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(tabKey => {
          const cfg = tabConfig[tabKey];
          const TabIcon = cfg.icon;
          const count = availableForTab(tabKey).length;
          return (
            <button key={tabKey} type="button" onClick={() => handleTabChange(tabKey)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${activeTab === tabKey ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <TabIcon className="w-3.5 h-3.5" /> {cfg.label}
              <span className="ml-0.5 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Rigs Tab */}
      {activeTab === 'rigs' && (
        <div className="space-y-3">
          {availableForTab('rigs').length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">No rigs available. All rigs are already assigned, inactive, or not yet synced.</p>
          ) : (
            <>
              <label className="block text-xs font-medium text-slate-600">Select a Rig</label>
              <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-lg divide-y divide-slate-100 bg-white">
                {availableForTab('rigs').map(a => renderAssetItem(a, selectedRigId === a.id, () => handleRigSelect(a), a.compliance_status !== 'compliant'))}
              </div>

              {selectedRig && linkedEquipment.length > 0 && (
                <div className="bg-white border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                    Linked Equipment for {selectedRig.name}
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {linkedEquipment.map(eq => {
                      const isAssigned = assignedAssetIds.has(eq.id);
                      const isChecked = selectedEquipmentIds.has(eq.id);
                      const TypeIcon = assetTypeIcon[eq.asset_type] || Wrench;
                      return (
                        <label key={eq.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${isAssigned ? 'opacity-50' : 'hover:bg-slate-50 cursor-pointer'}`}>
                          <input type="checkbox" checked={isChecked} disabled={isAssigned}
                            onChange={() => !isAssigned && toggleEquipment(eq.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                          <TypeIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-medium text-slate-700 flex-1 truncate">{eq.name}</span>
                          {isAssigned && <span className="text-[10px] text-slate-400">Already assigned</span>}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Checked items will be assigned alongside the rig. Uncheck any you don't need.</p>
                </div>
              )}

              {selectedRig && linkedEquipment.length === 0 && (
                <p className="text-xs text-slate-400 italic">No equipment linked to this rig. You can link equipment in Settings → Assets.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Machinery / Trailers Tab */}
      {(activeTab === 'machinery' || activeTab === 'trailers') && (
        <div className="space-y-3">
          {availableForTab(activeTab).length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">No {activeTab === 'machinery' ? 'machinery' : 'trailers'} available.</p>
          ) : (
            <>
              <label className="block text-xs font-medium text-slate-600">Select {activeTab === 'machinery' ? 'Machinery' : 'Trailer'}</label>
              <div className="max-h-56 overflow-y-auto border border-slate-300 rounded-lg divide-y divide-slate-100 bg-white">
                {availableForTab(activeTab).map(a => renderAssetItem(a, selectedSingleId === a.id, () => setSelectedSingleId(a.id)))}
              </div>
              {selectedSingleId && (
                <p className="text-[11px] text-slate-500">Selected: <strong>{assets.find(a => a.id === selectedSingleId)?.name}</strong></p>
              )}
            </>
          )}
        </div>
      )}

      {/* Notes + Submit */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
      </div>
      <button type="submit" disabled={submitting || !canSubmit}
        className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
        <Plus className="w-4 h-4" /> {submitting ? 'Assigning...' : 'Assign to Job'}
      </button>
    </form>
  );
}