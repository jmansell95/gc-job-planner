import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, AlertTriangle, UserX, Clock, CalendarDays, CheckCircle2, Hourglass } from 'lucide-react';
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
  const loggedDays = new Set(remarksLogs.map(l => l.date).filter(Boolean)).size;
  const totalMinutes = remarksLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const pendingCount = remarksLogs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const approvedCount = remarksLogs.filter(l => l.manager_review_status === 'approved').length;
  const noNameCount = logs.filter(l => !l.logged_by_role || l.logged_by_role === 'unspecified' || l.logged_by_role === 'ags_import').length;
  const hasNoName = noNameCount > 0 && logs.length > 0;

  const fmtDur = (mins) => {
    const m = Math.round(mins || 0);
    const h = Math.floor(m / 60), r = m % 60;
    if (h && r) return `${h}h ${r}m`;
    if (h) return `${h}h`;
    return m > 0 ? `${r}m` : '0m';
  };

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

      {/* Modern dashboard ribbon */}
      <div className="hero-gradient rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Activity className="w-5 h-5" />
          <h2 className="text-lg font-bold">Site Activity Logs</h2>
          <span className="ml-auto text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">{logs.length} total entries</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HeroStat icon={CalendarDays} label="Days Logged" value={loggedDays} sub="unique dates" />
          <HeroStat icon={Clock} label="Total Time" value={fmtDur(totalMinutes)} sub="from remarks" />
          <HeroStat icon={Activity} label="Activities" value={remarksLogs.length} sub={`${otherLogs.length} other`} />
          <HeroStat icon={pendingCount > 0 ? Hourglass : CheckCircle2} label="Approved" value={approvedCount} sub={pendingCount > 0 ? `${pendingCount} pending` : 'all done'} />
        </div>
      </div>

      {/* Driller activity review timeline */}
      <SiteLogReviewManager job={job} assignedStaff={assignedStaff} />
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-3 border border-white/10">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-white/70" />
        <p className="text-[10px] uppercase font-medium text-white/70 tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-white/50">{sub}</p>
    </div>
  );
}