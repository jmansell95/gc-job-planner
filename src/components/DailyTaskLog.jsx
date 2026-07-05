import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Send, Trash2, Ruler, CheckCircle2, FileText, Timer, Coffee, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const TASK_SUGGESTIONS = [
  'Setting up the rig', 'Putting up heras fencing', 'Drilling',
  'Dismantling the rig', 'Site clearance',
];

const toMins = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const calcDur = (s, e) => {
  const a = toMins(s), b = toMins(e);
  if (a == null || b == null) return 0;
  if (b <= a) return 0;
  return b - a;
};
const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
};

export default function DailyTaskLog({ staffId }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDow = new Date().getDay();
  const [jobId, setJobId] = useState('');
  const [task, setTask] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [meterage, setMeterage] = useState('');
  const [notes, setNotes] = useState('');
  const [isLunch, setIsLunch] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);
  const [adding, setAdding] = useState(false);
  const [submittingDay, setSubmittingDay] = useState(false);
  const queryClient = useQueryClient();

  const { data: assignments = [] } = useQuery({ queryKey: ['staff-assignments', staffId], queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffId }), enabled: !!staffId });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-assignments'], queryFn: () => base44.entities.Job.list() });
  const { data: todayEntries = [] } = useQuery({ queryKey: ['daily-tasks', staffId, today], queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, date: today }), enabled: !!staffId });
  const { data: shifts = [] } = useQuery({ queryKey: ['staff-shifts', staffId], queryFn: () => base44.entities.StaffShift.filter({ staff_id: staffId }), enabled: !!staffId });

  const assignedJobIds = [...new Set(assignments.map(a => a.job_id))];
  const assignedJobs = jobs.filter(j => assignedJobIds.includes(j.id));
  const todayShift = shifts.find(s => s.day_of_week === todayDow);

  useEffect(() => { if (!jobId && assignedJobs.length === 1) setJobId(assignedJobs[0].id); }, [assignedJobs, jobId]);
  useEffect(() => { if (!startTime && todayShift?.start_time) setStartTime(todayShift.start_time); }, [todayShift]);

  const selectedJob = jobs.find(j => j.id === jobId);
  const isDriller = selectedJob?.job_type === 'cp_drilling' || selectedJob?.job_type === 'rotary_drilling';
  const durMins = calcDur(startTime, endTime);
  const shiftMins = todayShift ? calcDur(todayShift.start_time, todayShift.end_time) : 0;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['today-board'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets-for-job'] });
  };

  const resetForm = () => {
    setTask(''); setEndTime(''); setMeterage(''); setNotes('');
    setStartTime(todayShift?.start_time || '');
    setIsLunch(false);
    setIsOvertime(false);
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!startTime || !endTime || durMins <= 0 || overlapEntry) return;
    if (!isLunch && (!jobId || !task.trim())) return;
    setAdding(true);
    try {
      await base44.entities.Timesheet.create({
        staff_id: staffId, date: today,
        job_id: isLunch ? '' : jobId,
        task_description: isLunch ? 'Lunch Break' : task.trim(),
        start_time: startTime, end_time: endTime,
        task_duration_minutes: durMins,
        total_hours: Math.round((durMins / 60) * 100) / 100,
        meterage: isLunch ? 0 : (isDriller ? (parseFloat(meterage) || 0) : 0),
        notes: notes.trim(), status: 'draft', is_break: isLunch, is_overtime: isOvertime
      });
      resetForm();
      invalidateAll();
    } catch (err) { console.error(err); }
    setAdding(false);
  };

  const deleteDraft = async (id) => {
    await base44.entities.Timesheet.delete(id);
    invalidateAll();
  };

  const submitDay = async () => {
    const drafts = todayEntries.filter(t => t.status === 'draft');
    if (drafts.length === 0) return;
    if (!confirm(`Submit ${drafts.length} task${drafts.length === 1 ? '' : 's'} for today (${fmtDur(totalMins)}) to your manager?`)) return;
    setSubmittingDay(true);
    try {
      await base44.entities.Timesheet.bulkUpdate(drafts.map(d => ({ id: d.id, status: 'submitted' })));
      invalidateAll();
    } catch (err) { console.error(err); }
    setSubmittingDay(false);
  };

  const entries = todayEntries.filter(t => t.status !== 'deleted' && t.status !== 'rejected');
  const tasks = entries.filter(t => !t.is_break);
  const drafts = entries.filter(t => t.status === 'draft');
  const totalMins = entries.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);

  const statusBadge = (status) => {
    if (status === 'draft') return 'bg-slate-100 text-slate-500';
    if (status === 'submitted') return 'bg-blue-100 text-blue-700';
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-500';
  };

  const durInvalid = startTime && endTime && durMins <= 0;
  const overlapEntry = startTime && endTime && durMins > 0
    ? entries.find(t => {
        const es = toMins(t.start_time), ee = toMins(t.end_time);
        if (es == null || ee == null) return false;
        const ns = toMins(startTime), ne = toMins(endTime);
        return ns < ee && es < ne;
      })
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header with running total */}
      <div className="hero-gradient px-4 md:px-6 py-4 md:py-5 text-white flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold leading-tight">Today's Tasks</h2>
            <p className="text-emerald-100 text-xs">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-emerald-100 font-medium">Day total</p>
          <p className="text-2xl md:text-3xl font-bold tabular-nums leading-none mt-0.5">{fmtDur(totalMins)}</p>
          <p className="text-[10px] text-emerald-100 mt-0.5">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</p>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Shift reference */}
        {todayShift && todayShift.start_time && todayShift.end_time && (
          <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
            <Timer className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-slate-600">Your shift today: <b className="text-slate-900">{todayShift.start_time} – {todayShift.end_time}</b> ({fmtDur(shiftMins)})</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">Worked <b className="text-slate-900">{fmtDur(totalMins)}</b>{shiftMins > 0 ? ` of ${fmtDur(shiftMins)}` : ''}</span>
          </div>
        )}

        {/* Add task form */}
        {assignedJobs.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2.5 rounded-lg border border-amber-100">
            You can only log time for jobs you've been assigned to. Ask your manager to assign you to a job first.
          </p>
        ) : (
          <form onSubmit={addTask} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            {!isLunch && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
                <select value={jobId} onChange={e => setJobId(e.target.value)} required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white">
                  <option value="">Select job</option>
                  {assignedJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
            )}
            {isLunch && (
              <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-amber-800">
                <Coffee className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Lunch break — set the time below</span>
              </div>
            )}
            {isOvertime && (
              <div className="flex items-center gap-2 text-sm bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 text-orange-800">
                <TrendingUp className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Overtime task — paid at the overtime rate for this day.</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{isLunch ? 'Break type' : 'What did you do? *'}</label>
              {!isLunch && (
                <input type="text" value={task} onChange={e => setTask(e.target.value)} required={!isLunch}
                  placeholder="e.g. Put up heras fencing around the compound"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TASK_SUGGESTIONS.map(s => (
                  <button type="button" key={s} onClick={() => { setTask(s); setIsLunch(false); setIsOvertime(false); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${!isLunch && !isOvertime && task === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700'}`}>{s}</button>
                ))}
                <button type="button" onClick={() => { setIsLunch(true); setTask('Lunch Break'); setIsOvertime(false); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1 ${isLunch ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400'}`}>
                  <Coffee className="w-3 h-3" /> Lunch Break
                </button>
                <button type="button" onClick={() => { setIsOvertime(true); setIsLunch(false); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1 ${isOvertime ? 'bg-orange-600 text-white border-orange-600' : 'bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-400'}`}>
                  <TrendingUp className="w-3 h-3" /> Overtime
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start – Finish time *</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                  className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                <span className="text-slate-400 text-sm">to</span>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                  className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                {durMins > 0 && <span className="text-xs text-slate-500">= <b className="text-slate-700">{fmtDur(durMins)}</b></span>}
              </div>
              {durInvalid && <p className="text-[11px] text-red-500 mt-1">Finish time must be after the start time.</p>}
              {overlapEntry && (
                <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Overlaps with another task ({overlapEntry.start_time}–{overlapEntry.end_time}). Pick a different time.
                </p>
              )}
            </div>
            {isDriller && !isLunch && (
              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Ruler className="w-3 h-3 text-amber-600" /> Meterage drilled (m)</label>
                <input type="number" min="0" step="0.1" value={meterage} onChange={e => setMeterage(e.target.value)}
                  placeholder="e.g. 12.5"
                  className="w-36 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Anything else worth noting"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <button type="submit" disabled={adding || !startTime || !endTime || durMins <= 0 || !!overlapEntry || (!isLunch && (!jobId || !task.trim()))}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl hover:opacity-90 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation ${isLunch ? 'bg-amber-500' : isOvertime ? 'bg-orange-600' : 'bg-emerald-700'}`}>
              <Plus className="w-4 h-4" /> {adding ? 'Adding…' : isLunch ? 'Add Lunch Break' : isOvertime ? 'Add Overtime Task' : 'Add Task'}
            </button>
          </form>
        )}

        {/* Today's task list */}
        {entries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Today's log</p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {[...entries].reverse().map(t => {
                const job = jobs.find(j => j.id === t.job_id);
                const tMins = Number(t.task_duration_minutes) || 0;
                return (
                  <div key={t.id} className={`px-3.5 py-3 flex items-center justify-between gap-3 ${t.is_break ? 'bg-amber-50/40' : 'bg-white'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.is_break && <Coffee className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                        <p className="font-medium text-sm text-slate-900 truncate">{t.is_break ? 'Lunch Break' : t.task_description}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${t.is_break ? 'bg-amber-100 text-amber-700' : statusBadge(t.status)}`}>
                          {t.is_break ? 'Break' : t.status === 'draft' ? 'Draft' : t.status === 'submitted' ? 'Submitted' : t.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                        {t.is_overtime && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                            <TrendingUp className="w-2.5 h-2.5" /> OT
                          </span>
                        )}
                        {!t.is_break && t.meterage > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                            <Ruler className="w-2.5 h-2.5" /> {t.meterage}m
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {t.start_time && t.end_time ? `${t.start_time}–${t.end_time}` : ''}{!t.is_break && <span>{` · ${job?.name || '—'}`}</span>}{t.notes ? ` · ${t.notes}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtDur(tMins)}</span>
                      {t.status === 'draft' && (
                        <button onClick={() => deleteDraft(t.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition" title="Remove">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">No tasks logged yet. Add your first task above.</p>
          </div>
        )}

        {/* Submit day */}
        {drafts.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <p className="text-sm text-slate-700">
                  <b className="text-slate-900">{drafts.length}</b> draft {drafts.length === 1 ? 'task' : 'tasks'} ready ·{' '}
                  <b className="text-slate-900">{fmtDur(drafts.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0))}</b> to submit
                </p>
              </div>
            </div>
            <button onClick={submitDay} disabled={submittingDay}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
              <Send className="w-4 h-4" /> {submittingDay ? 'Submitting…' : `Submit Day (${drafts.length})`}
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-2">Submitted tasks go to your manager for approval.</p>
          </div>
        )}
      </div>
    </div>
  );
}