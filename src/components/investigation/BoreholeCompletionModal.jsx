import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ban, CheckCircle2, AlertTriangle, X, Loader2, Droplet, Layers, Gauge, Ruler, ArrowDownToLine } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white";

/**
 * End-of-Hole completion modal with validation gates.
 * Checks that mandatory geotechnical data (groundwater, final strata, SPT)
 * has been recorded before the borehole is sealed. Creates a
 * borehole_decommissioning log entry as the completion marker.
 */
export default function BoreholeCompletionModal({ boreholeRef, boreholeLogs, jobId, staffId, staffName, onClose, onComplete }) {
  const [form, setForm] = useState({
    backfill_material: 'Bentonite pellets',
    seal_depth: boreholeLogs.length > 0 ? String(Math.max(...boreholeLogs.map(l => l.depth_to || 0))) : '',
    grout_volume: '',
    notes: '',
  });
  const [confirmNoWater, setConfirmNoWater] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Validation gates — derived from the borehole's existing logs
  const maxDepth = boreholeLogs.length > 0 ? Math.max(...boreholeLogs.map(l => l.depth_to || 0)) : 0;
  const hasGroundwater = boreholeLogs.some(l => l.groundwater_strike_depth != null || l.groundwater_static_level != null);
  const hasStrata = boreholeLogs.some(l => l.strata_descriptor && l.strata_descriptor !== 'other');
  const hasStrataDetail = boreholeLogs.some(l => l.strata_description_detail && l.strata_description_detail.trim());
  const hasSPT = boreholeLogs.some(l => l.spt_n_value != null || (l.spt_blows && l.spt_blows.length > 0));
  const hasDecommissioning = boreholeLogs.some(l => l.log_type === 'borehole_decommissioning');

  const gates = [
    {
      label: 'Final depth recorded',
      passed: maxDepth > 0,
      detail: maxDepth > 0 ? `${maxDepth.toFixed(1)}m` : 'No depth logged',
      icon: Ruler,
    },
    {
      label: 'Groundwater assessed',
      passed: hasGroundwater || confirmNoWater,
      detail: hasGroundwater ? 'Strike/static level recorded' : confirmNoWater ? 'Confirmed: no water encountered' : 'No water data — confirm below',
      icon: Droplet,
      requiresConfirm: !hasGroundwater,
    },
    {
      label: 'Strata described',
      passed: hasStrata || hasStrataDetail,
      detail: hasStrata ? 'Standardised strata logged' : hasStrataDetail ? 'Strata detail recorded' : 'No strata description',
      icon: Layers,
    },
    {
      label: 'SPT / sampling done',
      passed: hasSPT,
      detail: hasSPT ? 'SPT blow counts recorded' : 'No SPT recorded (may not be required)',
      icon: Gauge,
      optional: true,
    },
  ];

  const blockingGates = gates.filter(g => !g.optional && !g.passed);
  const canComplete = blockingGates.length === 0 && !hasDecommissioning;

  const handleComplete = async () => {
    if (!canComplete) return;
    setSaving(true);
    try {
      const payload = {
        job_id: jobId,
        staff_id: staffId,
        staff_name: staffName || '',
        date: todayStr,
        source: 'staff',
        logged_by_role: 'driller',
        log_type: 'borehole_decommissioning',
        borehole_ref: boreholeRef,
        depth_from: maxDepth > 0 ? maxDepth : null,
        depth_to: maxDepth > 0 ? maxDepth : null,
        backfill_material: form.backfill_material || '',
        seal_depth: form.seal_depth ? parseFloat(form.seal_depth) : (maxDepth > 0 ? maxDepth : null),
        grout_volume: form.grout_volume ? parseFloat(form.grout_volume) : null,
        description: `Borehole ${boreholeRef} completed at ${maxDepth.toFixed(1)}m. ${confirmNoWater ? 'No groundwater encountered. ' : ''}${form.notes || ''}`.trim(),
        completed_by_type: 'internal_staff',
        chargeable: false,
      };
      await base44.entities.InvestigationLog.create(payload);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-all'] });
      toast({ title: `Borehole ${boreholeRef} completed`, description: `Sealed at ${maxDepth.toFixed(1)}m with ${form.backfill_material}.` });
      onComplete?.();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not complete borehole.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center"><Ban className="w-5 h-5 text-blue-700" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900">End of Hole — {boreholeRef}</h3>
            <p className="text-xs text-slate-400">Complete borehole validation & sealing</p>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {hasDecommissioning ? (
          <div className="p-5 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-900">This borehole is already completed</p>
            <p className="text-sm text-slate-400 mt-1">A decommissioning record already exists for {boreholeRef}.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Validation gates checklist */}
            <div className="space-y-2">
              {gates.map((gate) => {
                const Icon = gate.icon;
                return (
                  <div key={gate.label} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${gate.passed ? 'border-emerald-200 bg-emerald-50/50' : gate.optional ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${gate.passed ? 'bg-emerald-100' : gate.optional ? 'bg-amber-100' : 'bg-red-100'}`}>
                      {gate.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : gate.optional ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <X className="w-4 h-4 text-red-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{gate.label}</p>
                      <p className="text-xs text-slate-500">{gate.detail}</p>
                    </div>
                    <Icon className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  </div>
                );
              })}
            </div>

            {/* Groundwater confirmation if no water data */}
            {!hasGroundwater && (
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 cursor-pointer">
                <input type="checkbox" checked={confirmNoWater} onChange={e => setConfirmNoWater(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-700">I confirm <strong>no groundwater was encountered</strong> in this borehole</span>
              </label>
            )}

            {/* Sealing details */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <ArrowDownToLine className="w-3.5 h-3.5 text-blue-700" />
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Borehole Sealing</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Backfill / seal material *</label>
                <input value={form.backfill_material} onChange={e => setForm({ ...form, backfill_material: e.target.value })} placeholder="e.g. Bentonite pellets, cement-bentonite grout" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Seal depth (m)</label>
                  <input type="number" step="0.1" value={form.seal_depth} onChange={e => setForm({ ...form, seal_depth: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Grout vol (L)</label>
                  <input type="number" step="0.1" value={form.grout_volume} onChange={e => setForm({ ...form, grout_volume: e.target.value })} placeholder="optional" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Completion notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="e.g. installed standpipe to 5m, response zone 3-5m" className={inputCls} />
              </div>
            </div>

            {blockingGates.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{blockingGates.length} requirement{blockingGates.length > 1 ? 's' : ''} not met. Complete or confirm before sealing.</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleComplete} disabled={!canComplete || saving} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sealing…</> : <><CheckCircle2 className="w-4 h-4" /> Complete & Seal</>}
              </button>
              <button onClick={onClose} disabled={saving} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}