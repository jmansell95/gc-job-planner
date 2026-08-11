import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, Package, Loader2, CheckCircle2, Plus, AlertCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { playConfirm } from '@/utils/scanFeedback';

const ASSET_TYPES = [
  { value: 'rig', label: 'Drilling Rig' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'lifting', label: 'Lifting Gear' },
  { value: 'portable_appliance', label: 'Portable Appliance (PAT)' },
];

/**
 * Quick Add Asset Modal — shown when a scan returns no match.
 * Pre-fills the serial from the scan. On save, creates a SiteAsset and
 * triggers a push to Asset Panda so the new item appears in both systems.
 */
export default function QuickAddAssetModal({ scannedValue, onClose, onCreated }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [serial, setSerial] = useState(scannedValue || '');
  const [assetType, setAssetType] = useState('machinery');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Enter an asset name', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const isRig = assetType === 'rig';
      const newAsset = await base44.entities.SiteAsset.create({
        name: name.trim(),
        serial_number: serial.trim(),
        asset_type: assetType,
        is_rig: isRig,
        rig_type: isRig ? 'cp' : 'n/a',
        compliance_status: 'unknown',
        stock_level: 'in_stock',
        sync_status: 'pending',
        is_active: true,
      });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      // Push to Asset Panda (best-effort — don't block on failure)
      try {
        await base44.functions.invoke('pushAssetUpdateToPanda', { asset_id: newAsset.id, action: 'create' });
      } catch (pushErr) {
        console.warn('Asset Panda push failed (non-blocking):', pushErr);
      }
      setCreated(newAsset);
      playConfirm();
      if (onCreated) onCreated(newAsset);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error('Create asset error:', err);
      toast({ title: 'Error', description: 'Could not create the asset.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Unknown Item</h3>
              <p className="text-[11px] text-slate-400">Add it to your inventory</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        {created ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="font-bold text-slate-900 mb-1">Added to Inventory!</p>
            <p className="text-sm text-slate-500">Syncing to Asset Panda in the background.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              <Package className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">This serial/QR wasn't found in your inventory. Fill in the details below to add it — it'll sync to Asset Panda automatically.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Asset Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
                placeholder="e.g. 110V Transformer T-12"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:border-emerald-600" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Serial / QR Code</label>
              <input type="text" value={serial} onChange={e => setSerial(e.target.value)}
                placeholder="Serial number"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base font-mono focus:outline-none focus:border-emerald-600" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Asset Type</label>
              <select value={assetType} onChange={e => setAssetType(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:border-emerald-600 bg-white">
                {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {!created && (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-semibold text-sm hover:bg-emerald-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 active:scale-95">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><Plus className="w-4 h-4" /> Add to Inventory</>}
            </button>
            <button onClick={() => !saving && onClose()} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}