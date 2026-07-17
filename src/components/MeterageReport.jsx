import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ruler, TrendingUp, Save, Check, Target, PoundSterling, Gauge } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

export default function MeterageReport({ job }) {
  const queryClient = useQueryClient();
  const [meterageRate, setMeterageRate] = useState(job.meterage_rate ?? '');
  const [meterageTarget, setMeterageTarget] = useState(job.meterage_target ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ['investigation-logs-meterage', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id })
  });

  // Calculate total meterage from borehole progress / sample collection logs
  const boreholeLogs = logs.filter(l => l.log_type === 'borehole_progress' || l.log_type === 'sample_collection');
  const loggedMeterage = boreholeLogs.reduce((sum, l) => {
    if (l.depth_from != null && l.depth_to != null) return sum + (l.depth_to - l.depth_from);
    return sum;
  }, 0);

  // Use job.meterage override if set, otherwise auto-calculated from logs
  const totalMeterage = job.meterage != null && job.meterage !== '' ? Number(job.meterage) : loggedMeterage;
  const rate = Number(meterageRate) || 0;
  const target = Number(meterageTarget) || 0;
  const meterageRevenue = totalMeterage * rate;
  const targetPct = target > 0 ? Math.min((totalMeterage / target) * 100, 100) : 0;
  const remaining = target > 0 ? target - totalMeterage : 0;

  // Per-borehole breakdown
  const byBorehole = {};
  boreholeLogs.forEach(l => {
    const ref = l.borehole_ref || 'Unspecified';
    if (!byBorehole[ref]) byBorehole[ref] = { ref, depth: 0, entries: 0 };
    if (l.depth_from != null && l.depth_to != null) byBorehole[ref].depth += (l.depth_to - l.depth_from);
    byBorehole[ref].entries++;
  });
  const boreholeList = Object.values(byBorehole).sort((a, b) => a.ref.localeCompare(b.ref));

  const dirty = (job.meterage_rate ?? 0) !== (Number(meterageRate) || 0) || (job.meterage_target ?? 0) !== (Number(meterageTarget) || 0);

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Job.update(job.id, {
        meterage_rate: Number(meterageRate) || 0,
        meterage_target: Number(meterageTarget) || 0
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
      <div className="flex items-center gap-2 mb-3">
        <Ruler className="w-4 h-4 text-blue-700" />
        <h3 className="text-sm font-semibold text-slate-800">Meterage Rate & Revenue</h3>
        <span className="ml-auto text-xs text-slate-500">per-metre costing</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Gauge className="w-3.5 h-3.5 text-blue-600" />
            <p className="text-xs text-slate-400">Total Drilled</p>
          </div>
          <p className="text-lg font-bold text-blue-700">{totalMeterage.toFixed(1)}m</p>
          <p className="text-[10px] text-slate-400">
            {job.meterage != null && job.meterage !== '' ? 'manual override' : `from ${boreholeLogs.length} log entries`}
          </p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 mb-1">
            <PoundSterling className="w-3.5 h-3.5 text-emerald-600" />
            <p className="text-xs text-slate-400">Rate / metre</p>
          </div>
          <p className="text-lg font-bold text-slate-900">{rate > 0 ? fmt(rate) : 'Not set'}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <p className="text-xs text-emerald-600">Meterage Revenue</p>
          </div>
          <p className="text-lg font-bold text-emerald-800">{fmt(meterageRevenue)}</p>
          {rate > 0 && <p className="text-[10px] text-emerald-500">{totalMeterage.toFixed(1)}m × {fmt(rate)}/m</p>}
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-xs text-slate-400">Target</p>
          </div>
          <p className="text-lg font-bold text-slate-900">{target > 0 ? `${target}m` : 'Not set'}</p>
          {target > 0 && <p className="text-[10px] text-slate-400">{targetPct.toFixed(0)}% complete</p>}
        </div>
      </div>

      {/* Target progress bar */}
      {target > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500 font-medium">Progress vs target</span>
            <span className={remaining < 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
              {totalMeterage.toFixed(1)}m / {target}m
              {remaining >= 0 ? ` · ${remaining.toFixed(1)}m remaining` : ` · ${Math.abs(remaining).toFixed(1)}m over`}
            </span>
          </div>
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${remaining < 0 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${targetPct}%` }} />
          </div>
        </div>
      )}

      {/* Per-borehole breakdown */}
      {boreholeList.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Per-Borehole Breakdown</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {boreholeList.map(b => (
              <div key={b.ref} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-slate-100">
                <span className="text-xs font-mono font-bold text-blue-700 flex-shrink-0">{b.ref}</span>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${totalMeterage > 0 ? Math.min((b.depth / totalMeterage) * 100, 100) : 0}%` }} />
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-700 flex-shrink-0">{b.depth.toFixed(1)}m</span>
                <span className="text-[10px] text-slate-400 flex-shrink-0">{b.entries} {b.entries === 1 ? 'entry' : 'entries'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rate & target editor */}
      <div className="border border-slate-200 rounded-lg p-3 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
              <PoundSterling className="w-3.5 h-3.5 text-emerald-700" /> Meterage rate (£/m)
            </label>
            <input type="number" min="0" step="0.01" value={meterageRate} onChange={e => setMeterageRate(e.target.value)} className={inputCls} placeholder="e.g. 45.00" />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
              <Target className="w-3.5 h-3.5 text-amber-600" /> Target meterage (m)
            </label>
            <input type="number" min="0" step="0.1" value={meterageTarget} onChange={e => setMeterageTarget(e.target.value)} className={inputCls} placeholder="e.g. 150" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-medium hover:bg-emerald-800 transition disabled:opacity-50">
            {saving ? <span>Saving...</span> : <><Save className="w-3.5 h-3.5" /> Save rates</>}
          </button>
          {saved && <span className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
          {!dirty && !saved && <span className="text-xs text-slate-400">Set the per-metre rate and target for this job</span>}
        </div>
      </div>
    </div>
  );
}