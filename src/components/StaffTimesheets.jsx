import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, CheckCircle2, XCircle, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig = {
  draft: { label: 'Draft', icon: FileText, badge: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Submitted', icon: Clock, badge: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', icon: XCircle, badge: 'bg-red-100 text-red-700' },
};

export default function StaffTimesheets({ staffId, staffName }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ job_id: '', date: format(new Date(), 'yyyy-MM-dd'), start_time: '07:00', end_time: '17:00', break_minutes: 30, meterage: '', notes: '' });

  const queryClient = useQueryClient();

  const { data: timesheets = [] } = useQuery({
    queryKey: ['staff-timesheets', staffId],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId }, '-date', 50),
    enabled: !!staffId
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['staff-assignments', staffId],
    queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffId }),
    enabled: !!staffId
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-assignments'], queryFn: () => base44.entities.Job.list() });

  const assignedJobIds = [...new Set(assignments.map(a => a.job_id))];
  const assignedJobs = jobs.filter(j => assignedJobIds.includes(j.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      staff_id: staffId,
      break_minutes: parseInt(formData.break_minutes) || 30,
      meterage: formData.meterage ? parseFloat(formData.meterage) : undefined,
    };
    await base44.entities.Timesheet.create(data);
    queryClient.invalidateQueries({ queryKey: ['staff-timesheets', staffId] });
    setFormData({ job_id: '', date: format(new Date(), 'yyyy-MM-dd'), start_time: '07:00', end_time: '17:00', break_minutes: 30, meterage: '', notes: '' });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this timesheet?')) return;
    await base44.entities.Timesheet.delete(id);
    queryClient.invalidateQueries({ queryKey: ['staff-timesheets', staffId] });
  };

  return (
    <div className="bg-white rounded-lg p-4 md:p-6 border border-green-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-700" />
          <h2 className="text-lg font-bold text-slate-900">My Timesheets</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          {assignedJobs.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">You have no job assignments yet. Ask your manager to assign you to a job first.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
              <select value={formData.job_id} onChange={e => setFormData({ ...formData, job_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">Select job</option>
                {assignedJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Break (minutes)</label>
              <input type="number" min="0" step="5" value={formData.break_minutes} onChange={e => setFormData({ ...formData, break_minutes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Time *</label>
              <input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Time *</label>
              <input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Meterage (m) — for drilling roles</label>
              <input type="number" min="0" step="0.1" value={formData.meterage} onChange={e => setFormData({ ...formData, meterage: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">Submit Timesheet</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium">Cancel</button>
          </div>
        </form>
      )}

      {timesheets.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No timesheets yet. Click "Add" to submit one.</p>
      ) : (
        <div className="space-y-2">
          {timesheets.map(t => {
            const job = jobs.find(j => j.id === t.job_id);
            const status = statusConfig[t.status] || statusConfig.submitted;
            const StatusIcon = status.icon;
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-slate-900 truncate">{job?.name || 'Unknown job'}</p>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.badge} flex-shrink-0`}>
                      <StatusIcon className="w-2.5 h-2.5" /> {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {format(new Date(t.date + 'T00:00:00'), 'dd MMM yyyy')} · {t.start_time}–{t.end_time}
                    {t.meterage ? ` · ${t.meterage}m` : ''}
                  </p>
                </div>
                {(t.status === 'draft' || t.status === 'submitted') && (
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}