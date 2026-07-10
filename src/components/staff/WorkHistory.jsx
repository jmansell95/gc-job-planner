import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Clock, Briefcase, ChevronDown, ChevronUp, History } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';

const fmtH = (mins) => {
  const h = (Number(mins) || 0) / 60;
  return h.toFixed(1) + 'h';
};

const statusBadge = {
  approved: 'bg-emerald-100 text-emerald-700',
  submitted: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-slate-100 text-slate-500',
};

const monthLabel = (key) => {
  try {
    const d = new Date(key + '-01T00:00:00');
    return format(d, 'MMMM yyyy');
  } catch {
    return key;
  }
};

export default function WorkHistory({ staffId }) {
  const [expandedMonth, setExpandedMonth] = useState(null);

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['work-history', staffId],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, is_summary: true }, '-date', 200),
    enabled: !!staffId
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-history'], queryFn: () => base44.entities.Job.list() });

  const valid = summaries.filter(s => s.status !== 'deleted' && s.status !== 'merged');

  const byMonth = {};
  valid.forEach(s => {
    const monthKey = s.date?.substring(0, 7);
    if (!monthKey) return;
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(s);
  });

  const months = Object.keys(byMonth).sort().reverse();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <History className="w-4 h-4 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Work History</h2>
          <p className="text-xs text-slate-500">{valid.length} day{valid.length !== 1 ? 's' : ''} recorded</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : valid.length === 0 ? (
        <EmptyState icon={History} title="No work history yet" message="Your completed and approved shifts will appear here." />
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
                    <p className="text-sm font-semibold text-slate-900">{monthLabel(monthKey)}</p>
                    <p className="text-xs text-slate-400">{entries.length} shifts · {fmtH(monthMins)}</p>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {expanded && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {entries.map(s => {
                      const job = jobs.find(j => j.id === s.job_id);
                      const d = new Date(s.date + 'T00:00:00');
                      return (
                        <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{job?.name || 'Work entry'}</p>
                            <p className="text-xs text-slate-400">{format(d, 'EEE dd MMM')}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-semibold text-slate-700">{fmtH(s.task_duration_minutes)}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge[s.status] || statusBadge.draft}`}>{s.status}</span>
                          </div>
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