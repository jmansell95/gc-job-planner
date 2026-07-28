import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, AlertTriangle, UserX } from 'lucide-react';
import SiteLogReviewManager from '@/components/investigation/SiteLogReviewManager';

/**
 * DrillingSiteLogs — the Site Logs tab content for drilling jobs.
 *
 * Shows the driller's daily activity log (KeyLogBook remarks) for manager
 * review and timesheet generation. Technical borehole data (strata, SPT,
 * core, samples) lives on the Boreholes tab, not here.
 */
export default function DrillingSiteLogs({ job, assignedStaff }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  const remarksLogs = logs.filter(l => l.source === 'keylogbook_remarks');
  const otherLogs = logs.filter(l => l.source !== 'keylogbook_remarks' && l.source !== 'ags_import');
  const loggedDays = new Set(logs.map(l => l.date).filter(Boolean)).size;
  const noNameCount = logs.filter(l => !l.logged_by_role || l.logged_by_role === 'unspecified' || l.logged_by_role === 'ags_import').length;
  const hasNoName = noNameCount > 0 && logs.length > 0;

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
      {/* No name entered alert */}
      {hasNoName && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <UserX className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-red-800">No name entered for {noNameCount} log {noNameCount === 1 ? 'entry' : 'entries'}</p>
            <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
              These activities were imported without a driller or engineer name. The AGS file did not contain a name field, so attribution is missing. Add the name in the AGS file or assign the log manually to track who did the work.
            </p>
          </div>
        </div>
      )}

      {/* Unified summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <Activity className="w-5 h-5 text-emerald-700" />
          <h2 className="font-semibold text-slate-900">Site Logs</h2>
          <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{logs.length} total</span>
        </div>
        <div className="grid grid-cols-3 gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
          <SummaryStat label="Days Logged" value={loggedDays} hint="unique dates" tone="emerald" />
          <SummaryStat label="Driller Activities" value={remarksLogs.length} hint="KeyLogBook remarks" tone="indigo" />
          <SummaryStat label="Other Entries" value={otherLogs.length} hint="field logs" tone="slate" />
        </div>
      </div>

      {/* Driller activity review */}
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