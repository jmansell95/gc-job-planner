import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Clock } from 'lucide-react';
import { format } from 'date-fns';

const minsFromEntry = (t) => Number(t?.task_duration_minutes) || (t?.total_hours ? t.total_hours * 60 : 0);

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};

export default function JobWorkLog({ job }) {
  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets-for-job', job.id],
    queryFn: () => base44.entities.Timesheet.filter({ job_id: job.id })
  });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const valid = (timesheets || [])
    .filter(t => t.status === 'submitted' || t.status === 'approved')
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalMins = valid.reduce((s, t) => s + minsFromEntry(t), 0);

  if (valid.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Work Log</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{valid.length} tasks</span>
      </div>
      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {valid.map(t => {
          const m = staff.find(s => s.id === t.staff_id);
          const mins = minsFromEntry(t);
          return (
            <div key={t.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 truncate">{t.task_description || 'Work recorded'}</p>
                <span className="text-xs text-slate-500 inline-flex items-center gap-1 flex-shrink-0"><Clock className="w-3 h-3" />{fmtDur(mins)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {m?.name || 'Unknown'} · {format(new Date(t.date + 'T00:00:00'), 'dd MMM yyyy')}
                {t.status === 'approved' && <span className="text-emerald-600"> · approved</span>}
              </p>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-sm">
        <span className="text-slate-500">Total logged time</span>
        <span className="font-semibold text-slate-900">{fmtDur(totalMins)}</span>
      </div>
    </div>
  );
}