import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, CheckCircle2, XCircle, FileText, Trash2, Edit2, Save, Send, PoundSterling, X, TrendingUp, RotateCcw, AlertTriangle, Coffee } from 'lucide-react';
import { format } from 'date-fns';
import { computeStaffOvertime, buildRateMap, weekKey, entryMinutes } from '@/utils/overtime';

const statusConfig = {
  draft: { label: 'Draft', icon: FileText, badge: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Submitted', icon: Clock, badge: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', icon: XCircle, badge: 'bg-red-100 text-red-700' },
};

const TASK_SUGGESTIONS = [
  'Setting up the rig', 'Putting up heras fencing', 'Drilling',
  'Dismantling the rig', 'Site clearance', 'Machine maintenance', 'Breakdown',
];

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      const dispH = h % 12 === 0 ? 12 : h % 12;
      slots.push({ value, label: `${dispH}:${String(m).padStart(2, '0')} ${period}` });
    }
  }
  return slots;
})();

const minsFromEntry = (t) => Number(t?.task_duration_minutes) || (t?.total_hours ? t.total_hours * 60 : 0);

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};

const fmtCost = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function StaffTimesheets({ staffId, staffName }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ job_id: '', date: format(new Date(), 'yyyy-MM-dd'), task_description: '', start_time: '', end_time: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

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
  const availableJobs = jobs.filter(j => assignedJobIds.includes(j.id));

  const hourlyRate = staffRecord?.day_rate ? staffRecord.day_rate / 8 : 0;
  const durationMins = (() => {
    if (!form.start_time || !form.end_time) return 0;
    const [sh, sm] = form.start_time.split(':').map(Number);
    const [eh, em] = form.end_time.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? diff : 0;
  })();
  const otRateMap = buildRateMap(overtimeRates);
  const otThreshold = overtimeSetting?.weekly_threshold_hours ?? 40;

  const visibleTimesheets = timesheets.filter(t => t.status !== 'deleted' && t.status !== 'merged');
  const countedTimesheets = visibleTimesheets.filter(t => t.status !== 'rejected');
  const otBreakdown = computeStaffOvertime(countedTimesheets, otRateMap, otThreshold, hourlyRate);
  const previewEntry = { id: '__preview__', date: form.date, task_duration_minutes: durationMins, created_date: new Date().toISOString() };
  const previewBreakdown = computeStaffOvertime([...countedTimesheets, previewEntry], otRateMap, otThreshold, hourlyRate);
  const previewResult = previewBreakdown['__preview__'] || {};
  const previewCost = previewResult.cost != null ? previewResult.cost : (durationMins / 60) * hourlyRate;
  const previewOT = previewResult.isOvertime;
  const currentWeekKey = weekKey(format(new Date(), 'yyyy-MM-dd'));
  const weekMins = countedTimesheets.filter(t => weekKey(t.date) === currentWeekKey).reduce((s, t) => s + entryMinutes(t), 0);

  const resetForm = () => {
    setForm({ job_id: '', date: format(new Date(), 'yyyy-MM-dd'), task_description: '', start_time: '', end_time: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setForm({
      job_id: t.job_id || '',
      date: t.date || format(new Date(), 'yyyy-MM-dd'),
      task_description: t.task_description || '',
      start_time: t.start_time || '',
      end_time: t.end_time || '',
      notes: t.notes || ''
    });
    setShowForm(true);
  };

  const buildPayload = (status) => ({
    staff_id: staffId,
    job_id: form.job_id,
    date: form.date,
    task_description: form.task_description.trim(),
    start_time: form.start_time,
    end_time: form.end_time,
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
    } catch (e) { console.error(e); }
    setSubmitting(false);
  };

  const handleSubmitDraft = async (id) => {
    try {
      await base44.entities.Timesheet.update(id, { status: 'submitted' });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets', staffId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets-for-job'] });
    } catch (e) { console.error(e); }
  };

  const handleDeleteDraft = async (id) => {
    if (!confirm('Delete this draft entry?')) return;
    await base44.entities.Timesheet.delete(id);
    queryClient.invalidateQueries({ queryKey: ['staff-timesheets', staffId] });
  };

  const openWithdraw = (t) => {
    setWithdrawingId(t.id);
    setWithdrawReason('');
  };

  const confirmWithdraw = async () => {
    if (!withdrawReason.trim()) return;
    setWithdrawing(true);
    try {
      await base44.entities.Timesheet.update(withdrawingId, {
        status: 'deleted',
        deletion_reason: withdrawReason.trim(),
        deleted_at: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets', staffId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets-for-job'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      setWithdrawingId(null);
      setWithdrawReason('');
    } catch (e) { console.error(e); }
    setWithdrawing(false);
  };

  const drafts = visibleTimesheets.filter(t => t.status === 'draft');
  const submitted = visibleTimesheets.filter(t => t.status !== 'draft');

  const tabs = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'overtime', label: 'Overtime' },
    { key: 'breaks', label: 'Breaks' },
  ];
  const tabFilter = {
    pending: t => t.status === 'submitted',
    approved: t => t.status === 'approved',
    rejected: t => t.status === 'rejected',
    overtime: t => !!t.is_overtime || !!otBreakdown[t.id]?.isOvertime,
    breaks: t => !!t.is_break,
  };
  const tabCounts = {};
  tabs.forEach(tb => { tabCounts[tb.key] = submitted.filter(tabFilter[tb.key]).length; });
  const activeList = submitted.filter(tabFilter[activeTab]);
  const byDate = {};
  activeList.forEach(t => { (byDate[t.date] = byDate[t.date] || []).push(t); });
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
      <div key={t.id} className="p-3 bg-white rounded-xl border border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
          {t.is_break ? <Coffee className="w-4 h-4 text-amber-600" /> : <Clock className="w-4 h-4 text-emerald-600" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm text-slate-900 truncate">{t.is_break ? 'Break' : (job?.name || 'Unknown job')}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${t.is_break ? 'bg-amber-100 text-amber-700' : status.badge}`}>{t.is_break ? 'Break' : status.label}</span>
          </div>
          {t.task_description && !t.is_break && <p className="text-xs text-slate-500 truncate mt-0.5">{t.task_description}</p>}
          <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
            <span className="font-semibold text-slate-700">{fmtDur(mins)}</span>
            {isOT && <span className="text-amber-600 font-medium">OT ×{ot.multiplier}</span>}
          </div>
        </div>
        {t.status === 'draft' && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => handleSubmitDraft(t.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Submit now"><Send className="w-4 h-4" /></button>
            <button onClick={() => startEdit(t)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition" title="Edit"><Edit2 className="w-4 h-4" /></button>
            <button onClick={() => handleDeleteDraft(t.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition" title="Delete draft"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
        {t.status === 'submitted' && (
          <button onClick={() => openWithdraw(t)} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition font-medium flex-shrink-0" title="Withdraw with reason">
            <RotateCcw className="w-3 h-3" /> Withdraw
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">My Timesheets</h2>
          </div>
        </div>
        <button onClick={() => { resetForm(); if (availableJobs.length === 1) setForm(f => ({ ...f, job_id: availableJobs[0].id })); setShowForm(true); }} disabled={availableJobs.length === 0}
          className="flex items-center gap-1.5 px-3 md:px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold touch-manipulation flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Entry</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      {weekMins > 0 && (
        <div className="mb-4 bg-slate-50 border border-slate-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-700">This week's hours</span>
            <span className="text-slate-500 font-medium">{(weekMins / 60).toFixed(1)}h / {otThreshold}h</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${weekMins > otThreshold * 60 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, (weekMins / (otThreshold * 60)) * 100)}%` }} />
          </div>
          {weekMins > otThreshold * 60 && <p className="text-[10px] text-amber-600 mt-1.5 font-medium">Overtime applies above {otThreshold}h/week</p>}
        </div>
      )}

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); handleSave('submitted'); }} className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          {availableJobs.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2.5 rounded-lg border border-amber-100">You can only log time for jobs you've been assigned to. Ask your manager to assign you to a job first.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
              <select value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })} required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white">
                <option value="">Select job</option>
                {availableJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">What were you doing? *</label>
              <input type="text" value={form.task_description} onChange={e => setForm({ ...form, task_description: e.target.value })} required
                placeholder="e.g. Setting up the rig"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TASK_SUGGESTIONS.map(s => (
                  <button type="button" key={s} onClick={() => setForm({ ...form, task_description: s })}
                    className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition">{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="sm:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start time *</label>
                <select value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value, end_time: form.end_time && e.target.value >= form.end_time ? '' : form.end_time })} required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white">
                  <option value="">Select start</option>
                  {TIME_SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End time *</label>
                <select value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white">
                  <option value="">Select end</option>
                  {TIME_SLOTS.filter(s => !form.start_time || s.value > form.start_time).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 resize-none" />
            </div>
          </div>
          {durationMins > 0 && (
            <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm bg-emerald-50 border border-emerald-200">
              <span className="text-slate-600">Duration: <span className="font-semibold text-slate-900">{fmtDur(durationMins)}</span></span>
              {previewOT && <span className="text-amber-700 font-medium text-xs">Overtime · ×{previewResult.multiplier}</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting} className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
              <Send className="w-3.5 h-3.5" /> {editingId ? 'Update & Submit' : 'Submit'}
            </button>
            <button type="button" onClick={() => handleSave('draft')} disabled={submitting} className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
              <Save className="w-3.5 h-3.5" /> {editingId ? 'Save as Draft' : 'Save for Later'}
            </button>
            <button type="button" onClick={resetForm} className="flex items-center gap-1.5 px-4 py-2.5 text-slate-500 rounded-xl hover:bg-slate-100 transition text-sm font-semibold touch-manipulation">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </form>
      )}

      {visibleTimesheets.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No timesheets yet. Tap "Add Entry" to log your first task.</p>
      ) : (
        <div className="space-y-5">
          {drafts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Drafts ({drafts.length})</p>
              <div className="space-y-2">{drafts.map(renderEntry)}</div>
            </div>
          )}
          {submitted.length > 0 && (
            <div>
              <div className="border-b border-slate-200 mb-4">
                <div className="flex gap-1 overflow-x-auto -mb-px">
                  {tabs.map(tb => (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                      className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition flex items-center gap-1.5 ${activeTab === tb.key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                      {tb.label}
                      {tabCounts[tb.key] > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${activeTab === tb.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{tabCounts[tb.key]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {activeList.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No {tabs.find(t => t.key === activeTab).label.toLowerCase()} timesheets.</p>
              ) : (
                <div className="space-y-4">
                  {sortedDates.map(date => (
                    <div key={date}>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{format(new Date(date + 'T00:00:00'), 'EEEE, dd MMM yyyy')}</p>
                      <div className="space-y-2">{byDate[date].map(renderEntry)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Withdraw modal */}
      {withdrawingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !withdrawing && setWithdrawingId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <h3 className="font-bold text-slate-900">Withdraw timesheet?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-3">This removes the entry from your manager's approval list. A reason is required so your manager understands why.</p>
            <textarea value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} rows={3} autoFocus
              placeholder="e.g. Submitted to the wrong job by mistake"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 resize-none" />
            <div className="flex gap-2 mt-4">
              <button onClick={confirmWithdraw} disabled={withdrawing || !withdrawReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition text-sm font-semibold disabled:opacity-50">
                {withdrawing ? 'Withdrawing…' : 'Withdraw with reason'}
              </button>
              <button onClick={() => setWithdrawingId(null)} disabled={withdrawing}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}