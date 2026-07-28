import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Mountain, Tablet, ChevronRight } from 'lucide-react';
import SiteLogReviewManager from '@/components/investigation/SiteLogReviewManager';

/**
 * DrillingSiteLogs — the Site Logs tab content for drilling jobs.
 *
 * Reconciles the count shown in the Overview "Log Review" card (which counts
 * every InvestigationLog for the job) with what's actually displayed on this
 * tab. It groups the logs into two organised sections:
 *   1. Driller Activities — KeyLogBook remarks pending manager review/approval.
 *   2. Borehole Records — AGS-imported technical data (strata, SPT, core,
 *      samples). Full detail lives on the Boreholes tab; here we show a
 *      per-borehole index with a shortcut to jump there.
 */
export default function DrillingSiteLogs({ job, assignedStaff, onViewBoreholes }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  const remarksLogs = logs.filter(l => l.source === 'keylogbook_remarks');
  const agsLogs = logs.filter(l => l.source === 'ags_import');
  const otherLogs = logs.filter(l => l.source !== 'keylogbook_remarks' && l.source !== 'ags_import');
  const loggedDays = new Set(logs.map(l => l.date).filter(Boolean)).size;

  const byBorehole = {};
  agsLogs.forEach(l => {
    const ref = l.borehole_ref || '—';
    if (!byBorehole[ref]) byBorehole[ref] = [];
    byBorehole[ref].push(l);
  });
  const boreholeEntries = Object.entries(byBorehole).sort((a, b) => a[0].localeCompare(b[0]));

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unified summary — reconciles with the Overview Log Review card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <Activity className="w-5 h-5 text-emerald-700" />
          <h2 className="font-semibold text-slate-900">Site Logs</h2>
          <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{logs.length} total</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
          <SummaryStat label="Days Logged" value={loggedDays} hint="unique dates" tone="emerald" />
          <SummaryStat label="Driller Activities" value={remarksLogs.length} hint="KeyLogBook remarks" tone="indigo" />
          <SummaryStat label="Borehole Records" value={agsLogs.length} hint="AGS technical data" tone="violet" />
          <SummaryStat label="Other Entries" value={otherLogs.length} hint="field logs" tone="slate" />
        </div>
      </div>

      {/* 1. Driller activity review */}
      <SiteLogReviewManager job={job} assignedStaff={assignedStaff} />

      {/* 2. Borehole Records — AGS-imported technical data (strata, SPT, core,
            samples, installations, readings). Full detail lives on the
            Boreholes tab; here we show a per-borehole index with a shortcut. */}
      {boreholeEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <Mountain className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Borehole Records</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
              <Tablet className="w-3 h-3" /> KeyLogBook
            </span>
            <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{boreholeEntries.length} borehole{boreholeEntries.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {boreholeEntries.map(([ref, refLogs]) => {
              const s = boreholeSummary(refLogs);
              return (
                <button key={ref} onClick={onViewBoreholes} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition text-left">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Mountain className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-slate-900 text-sm truncate">{ref}</p>
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] mt-0.5">
                      {s.maxDepth != null && <span className="text-slate-600 font-medium">{s.maxDepth}m deep</span>}
                      {s.strata > 0 && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md font-medium">{s.strata} strata</span>}
                      {s.samples > 0 && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-md font-medium">{s.samples} samples</span>}
                      {s.spt > 0 && <span className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-md font-medium">{s.spt} SPT</span>}
                      {s.core > 0 && <span className="bg-fuchsia-50 text-fuchsia-700 px-1.5 py-0.5 rounded-md font-medium">{s.core} core</span>}
                      {s.install > 0 && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md font-medium">{s.install} install{s.install !== 1 ? 's' : ''}</span>}
                      {s.water > 0 && <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-md font-medium">{s.water} reading{s.water !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium flex-shrink-0">
                    View <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">Full detail on the Boreholes tab</p>
          </div>
        </div>
      )}

    </div>
  );
}

function SummaryStat({ label, value, hint, tone }) {
  const tones = {
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
    slate: 'text-slate-700',
    violet: 'text-violet-700',
  };
  return (
    <div className="text-center">
      <p className="text-xs text-slate-400 uppercase font-medium">{label}</p>
      <p className={`text-lg font-bold ${tones[tone] || 'text-slate-800'}`}>{value}</p>
      <p className="text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}

// Per-borehole roll-up of the AGS-imported technical records, used to render
// the borehole index on the Site Logs tab. Mirrors the grouping the Borehole
// Data Explorer uses, kept lightweight so the index loads instantly.
function boreholeSummary(logs) {
  const depths = logs.map(l => l.depth_to).filter(d => d != null);
  return {
    maxDepth: depths.length ? Math.max(...depths) : null,
    strata: logs.filter(l => (l.strata_descriptor || l.strata_description_detail) && l.log_type !== 'core_inspection').length,
    samples: logs.filter(l => l.log_type === 'sample_collection').length,
    spt: logs.filter(l => l.spt_n_value != null || (l.spt_blows && l.spt_blows.length > 0)).length,
    core: logs.filter(l => l.log_type === 'core_inspection').length,
    install: logs.filter(l => l.log_type === 'installation').length,
    water: logs.filter(l => l.log_type === 'standpipe_reading').length,
  };
}