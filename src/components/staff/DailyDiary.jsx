import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BookOpen, Plus, Send, Trash2, Clock, Coffee, Car, Briefcase, CheckCircle2, XCircle, AlertCircle, CalendarDays } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';

const TASK_TYPES = [
  { value: 'on_site', label: 'On-Site', icon: Briefcase },
  { value: 'travel_to', label: 'Travel To', icon: Car },
  { value: 'travel_from', label: 'Travel From', icon: Car },
  { value: 'break', label: 'Break', icon: Coffee },
];

const TASK_SUGGESTIONS = ['Setting up the rig', 'Putting up heras fencing', 'Drilling', 'Dismantling the rig', 'Site clearance', 'Machine maintenance', 'Breakdown'];

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

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};

const statusConfig = {
  submitted: { label: 'Pending', badge: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700' },
};

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return format(d, 'yyyy-MM-dd');
}

export default function DailyDiary({ staffId }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ job_id: '', task_type: 'on_site', task_description: '', start_time: '', end_time: '' });
  const [submitting, setSubmitting] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['daily-diary', staffId],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, is_summary: true }, '-date', 200),
    enabled: !!staffId
  });

  const { data: drafts = [] } = useQuery({
    queryKey: ['diary-drafts', staffId, selectedDate],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, date: selectedDate, status: 'draft' }),
    enabled: !!staffId
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['staff-assignments', staffId],
    queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffId }),
    enabled: !!staffId
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-assignments'], queryFn: () => base44.entities.Job.list() });

  const assignedJobIds = [...new Set(assignments.map(a => a.job_id))];
  const availableJobs = jobs.filter(j => assignedJobIds.includes(j.id));

  const durationMins = (() => {
    if (!form.start_time || !form.end_time) return 0;
    const [sh, sm] = form.start_time.split(':').map(Number);
    const [eh, em] = form.end_time.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? diff : 0;
  })();

  const isBreak = form.task_type === 'break';
  const draftsTotalMins = drafts.reduce((s, d) => s + (Number(d.task_duration_minutes) || 0), 0);
  const alreadySubmitted = summaries.some(s => s.date === selectedDate);

  const handleAddTask = async () => {
    if (!isBreak && !form.job_id) return;
    if (!form.start_time || !form.end_time) return;
    setAdding(true);
    try {
      await base44.entities.Timesheet.create({
        staff_id: staffId,
        job_id: isBreak ? '' : form.job_id,
        date: selectedDate,
        task_description: isBreak ? 'Break' : form.task_description.trim(),
        task_type: isBreak ? 'on_site' : form.task_type,
        is_break: isBreak,
        start_time: form.start_time,
        end_time: form.end_time,
        task_duration_minutes: durationMins,
        total_hours: Math.round((durationMins / 60) * 100) / 100,
        break_minutes: isBreak ? durationMins : 30,
        status: 'draft'
      });
      queryClient.invalidateQueries({ queryKey: ['diary-drafts', staffId, selectedDate] });
      setForm({ job_id: '', task_type: 'on_site', task_description: '', start_time: '', end_time: '' });
      setShowForm(false);
    } catch (e) { console.error(e); }
    setAdding(false);
  };

  const handleDeleteDraft = async (id) => {
    await base44.entities.Timesheet.delete(id);
    queryClient.invalidateQueries({ queryKey: ['diary-drafts', staffId, selectedDate] });
  };

  const handleSubmitDiary = async () => {
    setSubmitting(true);
    try {
      await base44.functions.invoke('submitDailyTimesheet', { staff_id: staffId, date: selectedDate });
      queryClient.invalidateQueries({ queryKey: ['diary-drafts', staffId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['daily-diary', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets', staffId] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats', staffId] });
      toast({ title: 'Daily diary submitted', description: 'Your tasks have been merged and sent for approval.' });
    } catch (e) {
      toast({ title: 'Error submitting diary', description: e.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const byDate = {};
  summaries.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
  const sortedDates = Object.keys(byDate).sort().reverse();

  const renderDraft = (d) => {
    const job = jobs.find(j => j.id === d.job_id);
    const typeIcon = d.is_break ? Coffee : (d.task_type === 'travel_to' || d.task_type === 'travel_from' ? Car : Briefcase);
    return (
      <div key={d.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-3 py-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
          {React.createElement(typeIcon, { className: 'w-4 h-4 text-slate-500' })}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate">{d.is_break ? 'Break' : (job?.name || 'Unknown')}</p>
          {d.task_description && !d.is_break && <p className="text-xs text-slate-400 truncate">{d.task_description}</p>}
        </div>
        <span className="text-xs font-semibold text-slate-600 flex-shrink-0">{fmtDur(d.task_duration_minutes)}</span>
        <button onClick={() => handleDeleteDraft(d.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderDiaryEntry = (s) => {
    const job = jobs.find(j => j.id === s.job_id);
    const status = statusConfig[s.status] || statusConfig.submitted;
    const tasks = (s.notes || '').split('; ').filter(Boolean);
    return (
      <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <p className="font-semibold text-sm text-slate-900 truncate">{job?.name || 'No job'}</p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status.badge}`}>{status.label}</span>
        </div>
        <div className="flex items-center gap-3 mb-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700 text-sm">{fmtDur(s.task_duration_minutes)}</span>
          {s.on_site_minutes > 0 && <span>On-site: {fmtDur(s.on_site_minutes)}</span>}
          {s.payable_travel_minutes > 0 && <span>Travel: {fmtDur(s.payable_travel_minutes)}</span>}
          {s.meterage > 0 && <span className="text-amber-600 font-medium">{s.meterage}m drilled</span>}
        </div>
        {tasks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tasks.map((task, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full">{task}</span>
            ))}
          </div>
        )}
        {s.travel_depart_home && (
          <p className="text-xs text-slate-400 mt-2">Left home {s.travel_depart_home} · Arrived home {s.travel_arrive_home || '—'}</p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-emerald-700" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Daily Diary</h2>
      </div>

      {/* Date selector + Add button */}
      <div className="flex items-center gap-3 mb-4">
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 bg-white" />
        <button onClick={() => { setShowForm(true); if (availableJobs.length === 1 && !isBreak) setForm(f => ({ ...f, job_id: availableJobs[0].id })); }}
          disabled={availableJobs.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold touch-manipulation disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {availableJobs.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2.5 rounded-lg border border-amber-100 mb-4">
          You need a job assignment before you can log tasks. Ask your manager to assign you to a job.
        </p>
      )}

      {/* Add task form */}
      {showForm && (
        <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex gap-2">
            {TASK_TYPES.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, task_type: t.value, job_id: t.value === 'break' ? '' : form.job_id })}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium border transition ${form.task_type === t.value ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
          {!isBreak && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Job</label>
              <select value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 bg-white">
                <option value="">Select job</option>
                {availableJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
          )}
          {!isBreak && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">What were you doing?</label>
              <input type="text" value={form.task_description} onChange={e => setForm({ ...form, task_description: e.target.value })}
                placeholder="e.g. Setting up the rig"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TASK_SUGGESTIONS.map(s => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, task_description: s })}
                    className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition">{s}</button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start time</label>
              <select value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value, end_time: form.end_time && e.target.value >= form.end_time ? '' : form.end_time })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 bg-white">
                <option value="">Select</option>
                {TIME_SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End time</label>
              <select value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 bg-white">
                <option value="">Select</option>
                {TIME_SLOTS.filter(s => !form.start_time || s.value > form.start_time).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          {durationMins > 0 && (
            <p className="text-xs text-slate-500">Duration: <span className="font-semibold text-slate-700">{fmtDur(durationMins)}</span></p>
          )}
          <div className="flex gap-2">
            <button onClick={handleAddTask} disabled={adding || (!isBreak && !form.job_id) || !form.start_time || !form.end_time}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
              {adding ? 'Adding…' : 'Add to Diary'}
            </button>
            <button onClick={() => { setShowForm(false); setForm({ job_id: '', task_type: 'on_site', task_description: '', start_time: '', end_time: '' }); }}
              className="px-4 py-2 text-slate-500 rounded-xl hover:bg-slate-100 transition text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {/* Drafts for selected date */}
      {drafts.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tasks for {format(new Date(selectedDate + 'T00:00:00'), 'EEE dd MMM')}</p>
            <span className="text-xs font-semibold text-slate-600">Total: {fmtDur(draftsTotalMins)}</span>
          </div>
          <div className="space-y-2 mb-3">
            {drafts.map(renderDraft)}
          </div>
          <button onClick={handleSubmitDiary} disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting…' : 'Submit Daily Diary'}
          </button>
        </div>
      )}

      {alreadySubmitted && drafts.length === 0 && (
        <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          This day has already been submitted. Adding new tasks will create an additional entry.
        </div>
      )}

      {/* Diary history */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Diary History</p>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : sortedDates.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No diary entries yet" message="Add tasks for a day and submit to start your diary." />
        ) : (
          <div className="space-y-5">
            {sortedDates.map(date => (
              <div key={date}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  {format(new Date(date + 'T00:00:00'), 'EEEE, dd MMM yyyy')}
                </p>
                <div className="space-y-2">
                  {byDate[date].map(renderDiaryEntry)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}