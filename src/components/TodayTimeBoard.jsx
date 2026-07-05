import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Clock, Coffee, Briefcase, Users } from 'lucide-react';
import { format } from 'date-fns';
import { EmptyState } from '@/components/StateViews';

const fmtMins = (mins) => {
  const mm = Math.round(Number(mins) || 0);
  const h = Math.floor(mm / 60), r = mm % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return mm > 0 ? `${r}m` : '0m';
};

export default function TodayTimeBoard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: timesheets = [] } = useQuery({ queryKey: ['today-board', today], queryFn: () => base44.entities.Timesheet.filter({ date: today }) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const rows = staff.map(s => {
    const entries = timesheets.filter(t => t.staff_id === s.id && t.status !== 'deleted' && t.status !== 'rejected');
    if (!entries.length) return null;
    const jobMins = entries.filter(t => !t.is_break).reduce((a, t) => a + (Number(t.task_duration_minutes) || 0), 0);
    const breakMins = entries.filter(t => t.is_break).reduce((a, t) => a + (Number(t.task_duration_minutes) || 0), 0);
    return { id: s.id, name: s.name, jobMins, breakMins, total: jobMins + breakMins, count: entries.filter(t => !t.is_break).length };
  }).filter(Boolean).sort((a, b) => b.total - a.total);

  const totals = rows.reduce((acc, r) => ({ job: acc.job + r.jobMins, brk: acc.brk + r.breakMins }), { job: 0, brk: 0 });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4 text-emerald-700" />
        </div>
        <h2 className="font-semibold text-slate-900">Today's Time</h2>
        <span className="text-xs text-slate-400">{format(new Date(), 'EEEE, dd MMM yyyy')}</span>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Job {fmtMins(totals.job)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Break {fmtMins(totals.brk)}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No time logged today" message="Live time entries will appear here as staff start logging their day." />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map(r => {
            const barMax = Math.max(480, r.total);
            const jobPct = Math.min(100, (r.jobMins / barMax) * 100);
            const breakPct = Math.min(100 - jobPct, (r.breakMins / barMax) * 100);
            return (
              <div key={r.id} className="px-5 py-3.5 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0 w-40 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-bold text-xs">{r.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-400">{r.count} {r.count === 1 ? 'task' : 'tasks'}</p>
                  </div>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-emerald-500 transition-all" style={{ width: `${jobPct}%` }} />
                    <div className="bg-amber-400 transition-all" style={{ width: `${breakPct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm flex-shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase flex items-center gap-1 justify-end"><Briefcase className="w-3 h-3" /> Job</p>
                    <p className="font-semibold text-slate-900">{fmtMins(r.jobMins)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase flex items-center gap-1 justify-end"><Coffee className="w-3 h-3" /> Break</p>
                    <p className="font-semibold text-amber-600">{fmtMins(r.breakMins)}</p>
                  </div>
                  <div className="text-right pl-2 border-l border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase">Total</p>
                    <p className="font-bold text-emerald-700">{fmtMins(r.total)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}