import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  X, AlertTriangle, Loader2, CheckCircle2, Wrench,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Report Fault — quick field fault log. Creates a ServiceRecord of type
 * 'repair' against the asset. If severity is 'breakdown', the asset is
 * deactivated (is_active = false) so it can't be dispatched until fixed.
 */
export default function ReportFaultModal({ asset, staffProfile, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [faultNote, setFaultNote] = useState('');
  const [severity, setSeverity] = useState('advisory');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async () => {
    if (!faultNote.trim()) { toast({ title: 'Describe the fault', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await base44.entities.ServiceRecord.create({
        site_asset_id: asset.id,
        record_type: 'repair',
        date: format(new Date(), 'yyyy-MM-dd'),
        result: severity === 'breakdown' ? 'fail' : 'advisory',
        tested_by: staffProfile?.name || 'Field Report',
        notes: `[Fault Report] ${faultNote}`,
      });
      if (severity === 'breakdown') {
        await base44.entities.SiteAsset.update(asset.id, {
          is_active: false,
          repair_notes: faultNote,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['service-records'] });
      setConfirmed(true);
      setTimeout(() => onClose(), 1800);
    } catch (err) {
      console.error('Fault report error:', err);
      toast({ title: 'Error', description: 'Could not log fault.', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[92vh] overflow-y-auto animate-pop-in" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Report Fault</h3>
              <p className="text-[11px] text-slate-400">Log a defect so the yard & managers are alerted</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        {confirmed ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-amber-600" />
            </div>
            <p className="font-bold text-slate-900 mb-1">Fault Logged</p>
            <p className="text-sm text-slate-500">The yard team has been notified about {asset.name}.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-amber-200 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-5 h-5 text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{asset.name}</p>
                <p className="text-xs text-slate-500 font-mono truncate">{asset.serial_number || 'No serial'}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Severity</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSeverity('advisory')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition ${severity === 'advisory' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-amber-300'}`}
                >
                  Advisory
                  <p className="text-[10px] font-normal mt-0.5">Still usable, needs attention</p>
                </button>
                <button
                  onClick={() => setSeverity('breakdown')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition ${severity === 'breakdown' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500 hover:border-red-300'}`}
                >
                  Breakdown
                  <p className="text-[10px] font-normal mt-0.5">Withdraw from service</p>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Describe the fault *</label>
              <textarea
                value={faultNote}
                onChange={e => setFaultNote(e.target.value)}
                rows={3}
                placeholder="e.g. Hydraulic leak from the main ram, losing pressure when drilling…"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-600 resize-none"
              />
            </div>
          </div>
        )}

        {!confirmed && (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!faultNote.trim() || saving}
              className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 active:scale-95"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Logging…</> : <><AlertTriangle className="w-4 h-4" /> Log Fault</>}
            </button>
            <button onClick={() => !saving && onClose()} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}