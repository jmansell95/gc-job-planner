import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BookOpen, ChevronDown, Clock, Briefcase } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};

const fmtH = (mins) => ((Number(mins) || 0) / 60).toFixed(1) + 'h';

const statusBadge = {
  approved: 'bg-emerald-100 text-emerald-700',
  submitted: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-slate-100 text-slate-500',
};

const statusLabel = {
  approved: 'Approved',
  submitted: 'Pending',
  rejected: 'Rejected',
  draft: 'Draft',
};

// Read-only history of submitted daily diaries (timesheet summaries), grouped
// by month with an expandable task breakdown per day. Replaces the old
// DailyDiary (which had an entry form) and WorkHistory on the profile page —
// task entry now happens in the Shift Wizard on the schedule page.
export default function TimesheetHistory({ staffId }) {
  const [expandedMonth, setExpandedMonth] = useState(null);

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['timesheet-history', staffId],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, is_summary: true }, '-date', 200),
    enabled: !!staffId
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-history'], queryFn: () => base44.entities.Job.list() });

  const valid = summaries.filter(s => s.status !== 'deleted' && s.status !== 'merged');

  const byMonth = {};
  valid.forEach(s => {
    const monthKey = s.date?.substring(0, 7);
    if (!monthKey) return;
    (byMonth[monthKey] = byMonth[monthKey] || []).push(s);
  });

  const months = Object.keys(byMonth).sort().reverse();
  const totalDays = valid.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Timesheet History (Daily Diaries)</h2>
          <p className="text-xs text-slate-500">{totalDays} day{totalDays !== 1 ? 's' : ''} recorded</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : valid.length === 0 ? (
        <EmptyState icon={BookOpen} title="No timesheets yet" message="Your submitted daily diaries will appear here once you complete a shift." />
      ) : (
        <div className="space-y-2">
          {months.map(monthKey => {
            const entries = byMonth[monthKey].sort((a, b) => new Date(b.date) - new Date(a.date));
            const monthMins = entries.reduce((sum, s) => sum + (Number(s.task_duration_minutes) || 0), 0);
            const expanded = expandedMonth === monthKey || (months.length <= 2 && expandedMonth === null);
            return (
              <div key={monthKey} className="rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setExpandedMonth(expanded ? null : monthKey)}
                  className="w-full text-left flex items-center gap-3 p-3 hover:bg-slate-50 transition">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{format(new Date(monthKey + '-01T00:00:00'), 'MMMM yyyy')}</p>
                    <p className="text-xs text-slate-400">{entries.length} shifts · {fmtH(monthMins)}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {entries.map(s => {
                      const job = jobs.find(j => j.id === s.job_id);
                      const d = new Date(s.date + 'T00:00:00');
                      const tasks = (s.notes || '').split('; ').filter(Boolean);
                      const hasMeta = s.on_site_minutes > 0 || s.payable_travel_minutes > 0 || s.meterage > 0;
                      return (
                        <div key={s.id} className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                              <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800 truncate">{job?.name || 'Work entry'}</p>
                              <p className="text-xs text-slate-400">{format(d, 'EEE dd MMM yyyy')}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-sm font-semibold text-slate-700">{fmtDur(s.task_duration_minutes)}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge[s.status] || statusBadge.draft}`}>{statusLabel[s.status] || s.status}</span>
                            </div>
                          </div>
                          {(hasMeta || tasks.length > 0) && (
                            <div className="mt-2 pl-11 space-y-1.5">
                              {hasMeta && (
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                  {s.on_site_minutes > 0 && <span>On-site: {fmtDur(s.on_site_minutes)}</span>}
                                  {s.payable_travel_minutes > 0 && <span>Travel: {fmtDur(s.payable_travel_minutes)}</span>}
                                  {s.meterage > 0 && <span className="text-amber-600 font-medium">{s.meterage}m drilled</span>}
                                </div>
                              )}
                              {tasks.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {tasks.map((task, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full">{task}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}