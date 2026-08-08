import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, X, Loader2, AlertTriangle, Weight, Tag, FileText, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'steel', label: 'Steel', color: 'bg-slate-100 text-slate-700' },
  { value: 'copper', label: 'Copper', color: 'bg-orange-100 text-orange-700' },
  { value: 'aluminum', label: 'Aluminum', color: 'bg-blue-100 text-blue-700' },
  { value: 'mixed_metal', label: 'Mixed Metal', color: 'bg-amber-100 text-amber-700' },
  { value: 'electrical', label: 'Electrical / PAT', color: 'bg-purple-100 text-purple-700' },
  { value: 'other', label: 'Other', color: 'bg-slate-100 text-slate-600' },
];

export default function ScrapModal({ asset, onClose }) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('mixed_metal');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => setUserName(u?.full_name || u?.email || '')).catch(() => {});
  }, []);

  const handleScrap = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      // Mark the asset as disposed / scrapped
      await base44.entities.SiteAsset.update(asset.id, {
        lifecycle_status: 'disposed',
        disposal_date: today,
        is_active: false,
        notes: (asset.notes || '') + (asset.notes ? '\n' : '') + `[SCRAPPED ${today}] ${reason || 'Beyond economic repair'}`,
      });
      // Create the ScrapLog record — this adds it to the scrap pile
      await base44.entities.ScrapLog.create({
        asset_id: asset.id,
        asset_name: asset.name,
        serial_number: asset.serial_number || '',
        asset_type: asset.asset_type || '',
        scrapped_date: today,
        scrapped_by_name: userName,
        scrap_category: category,
        estimated_weight_kg: Number(estimatedWeight) || null,
        reason: reason || 'Beyond economic repair',
        notes: notes || '',
        status: 'scrapped',
      });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['scrap-logs'] });
      setDone(true);
      setTimeout(() => onClose(), 1600);
    } catch (e) {
      console.error('Scrap error:', e);
    }
    setSaving(false);
  };

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-600" /></div>
            <div>
              <h3 className="font-bold text-slate-900">Scrap Asset</h3>
              <p className="text-[11px] text-slate-400">Mark for scrap & add to the scrap pile</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-7 h-7 text-red-600" /></div>
            <p className="font-bold text-slate-900 mb-1">Sent to Scrap Pile</p>
            <p className="text-sm text-slate-500">{asset.name} has been deactivated and added to the scrap pile. Book it onto a vehicle for weigh-in from the Scrap Pile tab.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Asset identity */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0"><Trash2 className="w-5 h-5 text-slate-500" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{asset.name}</p>
                <p className="text-xs text-slate-500 font-mono truncate">{asset.serial_number || 'No serial'}</p>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">This will permanently deactivate the asset and move it to the scrap pile. This cannot be undone.</p>
            </div>

            {/* Category */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><Tag className="w-3 h-3" /> Scrap Category</label>
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORIES.map(c => (
                  <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                    className={`px-2 py-2 rounded-lg text-xs font-semibold border-2 transition ${category === c.value ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated weight */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><Weight className="w-3 h-3" /> Estimated Weight (kg)</label>
              <input type="number" step="0.1" value={estimatedWeight} onChange={e => setEstimatedWeight(e.target.value)} placeholder="e.g. 250" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-red-500" />
            </div>

            {/* Reason */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><FileText className="w-3 h-3" /> Reason for Scrapping</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Beyond economic repair, obsolete…" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-red-500" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional details…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-red-500 resize-none" />
            </div>
          </div>
        )}

        {!done && (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
            <button onClick={handleScrap} disabled={saving}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {saving ? 'Scrapping…' : 'Confirm Scrap'}
            </button>
            <button onClick={() => !saving && onClose()} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}