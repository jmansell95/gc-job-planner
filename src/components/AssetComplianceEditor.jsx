import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Save, Trash2, Cog, Wrench, Package, Truck, Anchor, AlertTriangle, Plug } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ASSET_TYPES = [
  { value: 'rig', label: 'Rig', icon: Cog },
  { value: 'machinery', label: 'Machinery', icon: Wrench },
  { value: 'trailer', label: 'Trailer', icon: Package },
  { value: 'vehicle', label: 'Vehicle', icon: Truck },
  { value: 'lifting', label: 'Lifting Gear', icon: Anchor },
  { value: 'portable_appliance', label: 'PAT / Electrical', icon: Plug },
];

const COMPLIANCE_STATUSES = [
  { value: 'compliant', label: 'Compliant' },
  { value: 'expiring', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'unknown', label: 'Unknown' },
];

const RIG_TYPES = [
  { value: 'n/a', label: 'N/A' },
  { value: 'cp', label: 'CP (Cable Percussion)' },
  { value: 'rotary', label: 'Rotary' },
];

const EMPTY = {
  name: '', asset_type: 'machinery', rig_type: 'n/a', is_rig: false,
  equipment_type: '', compliance_category: '', serial_number: '',
  responsible_person: '', tooling_notes: '', compliance_status: 'unknown',
  compliance_expiry_date: '', last_service_date: '', next_service_date: '',
  service_notes: '', repair_notes: '', is_active: true, notes: '',
};

export default function AssetComplianceEditor({ asset, onClose }) {
  const isEdit = !!asset;
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (asset) {
      setForm({
        ...EMPTY,
        ...asset,
        rig_type: asset.rig_type || 'n/a',
        compliance_status: asset.compliance_status || 'unknown',
        is_active: asset.is_active !== false,
        is_rig: asset.asset_type === 'rig',
      });
    }
  }, [asset]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleTypeChange = (type) => {
    setForm(prev => ({ ...prev, asset_type: type, is_rig: type === 'rig', rig_type: type === 'rig' ? (prev.rig_type || 'n/a') : 'n/a' }));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        asset_type: form.asset_type,
        is_rig: form.asset_type === 'rig',
        rig_type: form.asset_type === 'rig' ? form.rig_type : 'n/a',
        equipment_type: form.equipment_type || '',
        compliance_category: form.compliance_category || '',
        serial_number: form.serial_number || '',
        responsible_person: form.responsible_person || '',
        tooling_notes: form.tooling_notes || '',
        compliance_status: form.compliance_status || 'unknown',
        compliance_expiry_date: form.compliance_expiry_date || null,
        last_service_date: form.last_service_date || null,
        next_service_date: form.next_service_date || null,
        service_notes: form.service_notes || '',
        repair_notes: form.repair_notes || '',
        is_active: form.is_active !== false,
        notes: form.notes || '',
      };
      if (isEdit) {
        await base44.entities.SiteAsset.update(asset.id, payload);
        toast({ title: 'Asset updated', description: `${payload.name} saved.` });
      } else {
        await base44.entities.SiteAsset.create(payload);
        toast({ title: 'Asset added', description: `${payload.name} created locally.` });
      }
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      onClose();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await base44.entities.SiteAsset.delete(asset.id);
      toast({ title: 'Asset deleted', description: `${asset.name} removed.` });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      onClose();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{isEdit ? 'Edit Asset' : 'Add Asset'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{isEdit ? 'Manage compliance & service records locally' : 'Create a new compliance record in this app'}</p>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
          {/* Identity */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Asset Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Truck-mounted Rig 1, Sling S-04, Excavator CAT 320"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Asset Type</label>
                <div className="grid grid-cols-3 gap-1">
                  {ASSET_TYPES.map(t => {
                    const Icon = t.icon;
                    const active = form.asset_type === t.value;
                    return (
                      <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                        className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-medium transition ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        <Icon className="w-4 h-4" /> {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {form.asset_type === 'rig' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Rig Type</label>
                  <select value={form.rig_type} onChange={e => set('rig_type', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                    {RIG_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Serial / Reg Number</label>
                <input type="text" value={form.serial_number} onChange={e => set('serial_number', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Equipment Type</label>
                <input type="text" value={form.equipment_type} onChange={e => set('equipment_type', e.target.value)}
                  placeholder="e.g. Overshot Tool, Sling, Shackle"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Compliance Category</label>
                <input type="text" value={form.compliance_category} onChange={e => set('compliance_category', e.target.value)}
                  placeholder="e.g. Lifting Gear, Plant, Vehicle"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Responsible Person</label>
                <input type="text" value={form.responsible_person} onChange={e => set('responsible_person', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">Compliance & Inspection</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Compliance Status</label>
                <select value={form.compliance_status} onChange={e => set('compliance_status', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                  {COMPLIANCE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Compliance Expiry Date</label>
                <input type="date" value={form.compliance_expiry_date || ''} onChange={e => set('compliance_expiry_date', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Service / Test Date</label>
                <input type="date" value={form.last_service_date || ''} onChange={e => set('last_service_date', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Next Service Due</label>
                <input type="date" value={form.next_service_date || ''} onChange={e => set('next_service_date', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Notes & History</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tooling Notes</label>
              <textarea value={form.tooling_notes} onChange={e => set('tooling_notes', e.target.value)} rows={2}
                placeholder="Casing sizes, augers, core barrels..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Service Notes</label>
              <textarea value={form.service_notes} onChange={e => set('service_notes', e.target.value)} rows={2}
                placeholder="Last test result, tested by, inspector..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Repair Notes</label>
              <textarea value={form.repair_notes} onChange={e => set('repair_notes', e.target.value)} rows={2}
                placeholder="Faults, decommission reasons..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">General Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-slate-700 font-medium">Active &amp; available for job assignment</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2">
          {isEdit && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          {isEdit && confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Delete permanently?</span>
              <button onClick={handleDelete} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Yes, delete
              </button>
              <button onClick={() => setConfirmDelete(false)} disabled={saving}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition">Cancel</button>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => !saving && onClose()} disabled={saving}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition disabled:opacity-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}