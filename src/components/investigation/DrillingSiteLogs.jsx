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
        <div className="grid grid-cols-2 gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
          <SummaryStat label="Driller Activities" value={remarksLogs.length} hint="KeyLogBook remarks" tone="indigo" />
          <SummaryStat label="Other Entries" value={otherLogs.length} hint="field logs" tone="slate" />
        </div>
      </div>

      {/* 1. Driller activity review */}
      <SiteLogReviewManager job={job} assignedStaff={assignedStaff} />

    </div>
  );
}

function SummaryStat({ label, value, hint, tone }) {
  const tones = {
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
    slate: 'text-slate-700',
  };
  return (
    <div className="text-center">
      <p className="text-xs text-slate-400 uppercase font-medium">{label}</p>
      <p className={`text-lg font-bold ${tones[tone] || 'text-slate-800'}`}>{value}</p>
      <p className="text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}