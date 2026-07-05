import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, CheckCircle2, XCircle, FileText, Trash2, Edit2, Save, Send, PoundSterling, X, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { computeStaffOvertime, buildRateMap, weekKey, entryMinutes } from '@/utils/overtime';

const statusConfig = {
  draft: { label: 'Draft', icon: FileText, badge: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Submitted', icon: Clock, badge: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', icon: XCircle, badge: 'bg-red-100 text-red-700' },
};

const TASK_SUGGESTIONS = [
  'Setting up the rig',
  'Putting up heras fencing',
  'Drilling',
  'Dismantling the rig',
  'Site clearance',
  'Machine maintenance',
  'Breakdown',
];

const DURATION_CHIPS = [15, 30, 60, 90, 120, 240];

const minsFromEntry = (t) => Number(t?.task_duration_minutes) || (t?.total_hours ? t.total_hours * 60 : 0);

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};

const fmtCost = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function StaffTimesheets({ staffId, staffName }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ job_id: '', date: format(new Date(), 'yyyy-MM-dd'), task_description: '', task_duration_minutes: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const queryClient = useQueryClient();

  const { data: timesheets = [] } = useQuery({
    queryKey: ['staff-timesheets', staffId],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId }, '-date', 100),
    enabled: !!staffId
  });

  const { data: staffRecord } = useQuery({
    queryKey: ['staff-record', staffId],
    queryFn: () => base44.entities.Staff.get(staffId),
    enabled: !!staffId
  });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: overtimeSetting } = useQuery({
    queryKey: ['overtime-setting'],
    queryFn: async () => { const list = await base44.entities.OvertimeSetting.list(); return list[0] || null; }
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['staff-assignments', staffId],
    queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffId }),
    enabled: !!staffId
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-assignments'], queryFn: () => base44.entities.Job.list() });

  const assignedJobIds = [...new Set(assignments.map(a => a.job_id))];
  const assignedJobs = jobs.filter(j => assignedJobIds.includes(j.id));
  const availableJobs = assignedJobs.length > 0 ? assignedJobs : jobs;

  const hourlyRate = staffRecord?.day_rate ? staffRecord.day_rate / 8 : 0;
  const durationMins = parseInt(form.task_duration_minutes) || 0;
  const otRateMap = buildRateMap(overtimeRates);
  const otThreshold = overtimeSetting?.weekly_threshold_hours ?? 40;
  const otBreakdown = computeStaffOvertime(timesheets, otRateMap, otThreshold, hourlyRate);
  const previewEntry = { id: '__preview__', date: form.date, task_duration_minutes: durationMins, created_date: new Date().toISOString() };
  const previewBreakdown = computeStaffOvertime([...timesheets, previewEntry], otRateMap, otThreshold, hourlyRate);
  const previewResult = previewBreakdown['__preview__'] || {};
  const previewCost = previewResult.cost != null ? previewResult.cost : (durationMins / 60) * hourlyRate;
  const previewOT = previewResult.isOvertime;
  const currentWeekKey = weekKey(format(new Date(), 'yyyy-MM-dd'));
  const weekMins = timesheets.filter(t => weekKey(t.date) === currentWeekKey).reduce((s, t) => s + entryMinutes(t), 0);

  const resetForm = () => {
    setForm({ job_id: '', date: format(new Date(), 'yyyy-MM-dd'), task_description: '', task_duration_minutes: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setForm({
      job_id: t.job_id || '',
      date: t.date || format(new Date(), 'yyyy-MM-dd'),
      task_description: t.task_description || '',
      task_duration_minutes: t.task_duration_minutes ? String(t.task_duration_minutes) : '',
      notes: t.notes || ''
    });
    setShowForm(true);
  };

  const buildPayload = (status) => ({
    staff_id: staffId,
    job_id: form.job_id,
    date: form.date,
    task_description: form.task_description.trim(),
    task_duration_minutes: durationMins || 0,
    total_hours: Math.round((durationMins / 60) * 100) / 100,
    notes: form.notes.trim(),
    status
  });

  const handleSave = async (status) => {
    if (!form.job_id || !durationMins || !form.task_description.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await base44.entities.Timesheet.update(editingId, buildPayload(status));
      } else {
        await base44.entities.Timesheet.create(buildPayload(status));
      }
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets', staffId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets-for-job'] });
      resetForm();
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this timesheet entry?')) return;
    await base44.entities.Timesheet.delete(id);
    queryClient.invalidateQueries({ queryKey: ['staff-timesheets', staffId] });
    queryClient.invalidateQueries({ queryKey: ['timesheets-for-job'] });
  };

  const canEdit = (t) => t.status === 'draft' || t.status === 'submitted';

  const drafts = timesheets.filter(t => t.status === 'draft');
  const submitted = timesheets.filter(t => t.status !== 'draft');
  const byDate = {};
  submitted.forEach(t => { (byDate[t.date] = byDate[t.date] || []).push(t); });
  const sortedDates = Object.keys(byDate).sort().reverse();

  const renderEntry = (t) => {
    const job = jobs.find(j => j.id === t.job_id);
    const status = statusConfig[t.status] || statusConfig.submitted;
    const StatusIcon = status.icon;
    const mins = minsFromEntry(t);
    const ot = otBreakdown[t.id] || {};
    const cost = ot.cost != null ? ot.cost : (mins / 60) * hourlyRate;
    const isOT = ot.isOvertime;
    return (
      <div key={t.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm text-slate-900 truncate">{job?.name || 'Unknown job'}</p>
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.badge} flex-shrink-0`}>
                <StatusIcon className="w-2.5 h-2.5" /> {status.label}
              </span>
            </div>
            {t.task_description && <p className="text-sm text-slate-700 mt-1">{t.task_description}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDur(mins)}</span>
              {hourlyRate > 0 && <span className="inline-flex items-center gap-1"><PoundSterling className="w-3 h-3" />{fmtCost(cost)}</span>}
              {isOT && <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><TrendingUp className="w-3 h-3" />OT {fmtDur(ot.otMins)} ×{ot.multiplier}</span>}
              {t.notes && <span className="truncate">· {t.notes}</span>}
            </div>
          </div>
          {canEdit(t) && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => startEdit(t)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition" title="Edit"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(t.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg p-4 md:p-6 border border-green-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-700" />
          <h2 className="text-lg font-bold text-slate-900">My Timesheets</h2>
          {staffRecord?.day_rate ? <span className="text-xs text-slate-400">· £{staffRecord.day_rate}/day (£{hourlyRate.toFixed(0)}/h)</span> : null}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {weekMins > 0 && (
        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-slate-600">This week's hours</span>
            <span className="text-slate-500">{(weekMins / 60).toFixed(1)}h / {otThreshold}h</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${weekMins > otThreshold * 60 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, (weekMins / (otThreshold * 60)) * 100)}%` }} />
          </div>
          {weekMins > otThreshold * 60 && <p className="text-[10px] text-amber-600 mt-1 font-medium">Overtime applies above {otThreshold}h/week</p>}
        </div>
      )}

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); handleSave('submitted'); }} className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          {availableJobs.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">No jobs available yet. Ask your manager to assign you to a job first.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
              <select value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">Select job</option>
                {availableJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">What were you doing? *</label>
              <input type="text" value={form.task_description} onChange={e => setForm({ ...form, task_description: e.target.value })} required
                placeholder="e.g. Setting up the rig"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TASK_SUGGESTIONS.map(s => (
                  <button type="button" key={s} onClick={() => setForm({ ...form, task_description: s })}
                    className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition">{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Time taken (minutes) *</label>
              <input type="number" min="1" step="1" value={form.task_duration_minutes} onChange={e => setForm({ ...form, task_duration_minutes: e.target.value })} required
                placeholder="e.g. 30"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {DURATION_CHIPS.map(d => (
                  <button type="button" key={d} onClick={() => setForm({ ...form, task_duration_minutes: String(d) })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${durationMins === d ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400'}`}>{fmtDur(d)}</button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          {durationMins > 0 && (
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${previewOT ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <span className="text-slate-600">Duration: <span className="font-semibold text-slate-900">{fmtDur(durationMins)}</span></span>
              {hourlyRate > 0 && (
                <span className="text-slate-600">
                  {previewOT ? 'Overtime cost' : 'Calculated cost'}: <span className={`font-semibold ${previewOT ? 'text-amber-700' : 'text-emerald-700'}`}>{fmtCost(previewCost)}</span>
                  {previewOT && <span className="ml-1 text-[10px] text-amber-600">×{previewResult.multiplier}</span>}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium disabled:opacity-50">
              <Send className="w-3.5 h-3.5" /> {editingId ? 'Update & Submit' : 'Submit'}
            </button>
            <button type="button" onClick={() => handleSave('draft')} disabled={submitting} className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {editingId ? 'Save as Draft' : 'Save for Later'}
            </button>
            <button type="button" onClick={resetForm} className="flex items-center gap-1.5 px-4 py-2 text-slate-500 rounded-lg hover:bg-slate-100 transition text-sm font-medium">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </form>
      )}

      {timesheets.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No timesheets yet. Click "Add Entry" to log your first task.</p>
      ) : (
        <div className="space-y-5">
          {drafts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Drafts ({drafts.length})</p>
              <div className="space-y-2">{drafts.map(renderEntry)}</div>
            </div>
          )}
          {sortedDates.map(date => (
            <div key={date}>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{format(new Date(date + 'T00:00:00'), 'EEEE, dd MMM yyyy')}</p>
              <div className="space-y-2">{byDate[date].map(renderEntry)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}