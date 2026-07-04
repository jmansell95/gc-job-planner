import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, XCircle, Ruler } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';

const statusConfig = {
  draft: { label: 'Draft', badge: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Submitted', badge: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700' }
};

const fmtDur = (t) => {
  const m = Math.round((Number(t?.task_duration_minutes) || (t?.total_hours ? t.total_hours * 60 : 0)) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};

const meterage = (t) => Number(t?.task_meterage) || 0;
const isMeterageEntry = (t) => meterage(t) > 0;

export default function TimesheetManager() {
  const [filter, setFilter] = useState('submitted');
  const queryClient = useQueryClient();

  const { data: timesheets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list('-created_date', 100)
  });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const filtered = filter === 'all' ? timesheets : timesheets.filter(t => t.status === filter);

  const handleApprove = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'approved' });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };
  const handleReject = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };

  const totalHours = timesheets.filter(t => t.status === 'approved').reduce((sum, t) => sum + (t.total_hours || 0), 0);
  const pendingCount = timesheets.filter(t => t.status === 'submitted').length;
  const totalMeterage = timesheets.filter(t => t.status === 'approved').reduce((sum, t) => sum + meterage(t), 0);

  return (
    <div>
      <PageHeader title="Timesheets" icon={Clock} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Pending Approval</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Approved Hours</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{totalHours}h</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Total Timesheets</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{timesheets.length}</p>
        </div>
        {totalMeterage > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:col-span-3">
            <p className="text-xs text-slate-500 font-medium inline-flex items-center gap-1"><Ruler className="w-3 h-3" />Approved Meterage</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{totalMeterage}m</p>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['submitted', 'approved', 'rejected', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize ${
              filter === f ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : isError ? (
          <ErrorState message="Couldn't load timesheets" onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Clock} title="No timesheets found" message={filter === 'all' ? 'Timesheets will appear here once staff submit them.' : `No ${filter} timesheets.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Task</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(ts => {
                  const member = staff.find(s => s.id === ts.staff_id);
                  const job = jobs.find(j => j.id === ts.job_id);
                  const status = statusConfig[ts.status] || statusConfig.draft;
                  return (
                    <tr key={ts.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{member?.name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-[180px]">{job?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{format(new Date(ts.date + 'T00:00:00'), 'dd MMM')}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-[220px]">{ts.task_description || <span className="text-slate-400 italic">{ts.start_time ? `${ts.start_time}–${ts.end_time}` : '—'}</span>}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900 text-center whitespace-nowrap">
                        {isMeterageEntry(ts)
                          ? <span className="inline-flex items-center gap-1 text-amber-600"><Ruler className="w-3.5 h-3.5" />{meterage(ts)}m</span>
                          : fmtDur(ts)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.badge}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {ts.status === 'submitted' && (
                            <>
                              <button onClick={() => handleApprove(ts.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Approve">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleReject(ts.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Reject">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}