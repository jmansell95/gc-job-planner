import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function WithdrawnTimesheetsPanel({ timesheets, staff, jobs }) {
  const withdrawn = timesheets
    .filter(t => t.status === 'deleted')
    .sort((a, b) => new Date(b.deleted_at || b.updated_date) - new Date(a.deleted_at || a.updated_date))
    .slice(0, 12);

  if (withdrawn.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <RotateCcw className="w-4 h-4 text-slate-600" />
        </div>
        <h2 className="font-semibold text-slate-900">Withdrawn by staff</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{withdrawn.length}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {withdrawn.map(t => {
          const member = staff.find(s => s.id === t.staff_id);
          const job = jobs.find(j => j.id === t.job_id);
          return (
            <div key={t.id} className="px-5 py-3 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-200 text-slate-500 line-through">Withdrawn</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{job?.name || '—'} · {format(new Date(t.date + 'T00:00:00'), 'EEE dd MMM yyyy')}</p>
                {t.deletion_reason && (
                  <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                    <Trash2 className="w-3 h-3 mt-0.5 flex-shrink-0" /> {t.deletion_reason}
                  </p>
                )}
              </div>
              {t.deleted_at && (
                <span className="text-[10px] text-slate-400 flex-shrink-0 whitespace-nowrap">
                  {format(new Date(t.deleted_at), 'dd MMM, HH:mm')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}