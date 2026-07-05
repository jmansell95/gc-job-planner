import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Square, Coffee, Clock, Briefcase, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

const fmtClock = (totalSec) => {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
};
const fmtMins = (mins) => {
  const mm = Math.round(Number(mins) || 0);
  const h = Math.floor(mm / 60), r = mm % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return mm > 0 ? `${r}m` : '0m';
};

const sessionKey = (staffId) => `dtt_session_${staffId}`;

export default function DailyTimeTracker({ staffId }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [jobId, setJobId] = useState('');
  const [task, setTask] = useState('');
  const [saving, setSaving] = useState(false);
  const [justLogged, setJustLogged] = useState(null);
  const queryClient = useQueryClient();

  // Restore any in-progress session from this device
  useEffect(() => {
    if (!staffId) return;
    try {
      const raw = localStorage.getItem(sessionKey(staffId));
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.startedAt && new Date(s.startedAt).toDateString() === new Date().toDateString()) {
          setSession(s);
          if (s.type === 'task') { setJobId(s.jobId || ''); setTask(s.task || ''); }
        } else {
          localStorage.removeItem(sessionKey(staffId));
        }
      }
    } catch { /* ignore */ }
  }, [staffId]);

  // Tick the live clock only while a session is running
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  const { data: assignments = [] } = useQuery({ queryKey: ['staff-assignments', staffId], queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffId }), enabled: !!staffId });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-assignments'], queryFn: () => base44.entities.Job.list() });
  const { data: todayEntries = [] } = useQuery({ queryKey: ['dtt-today', staffId, today], queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, date: today }), enabled: !!staffId });

  const assignedJobIds = [...new Set(assignments.map(a => a.job_id))];
  const assignedJobs = jobs.filter(j => assignedJobIds.includes(j.id));

  // Auto-select when only one assigned job
  useEffect(() => {
    if (!jobId && assignedJobs.length === 1) setJobId(assignedJobs[0].id);
  }, [assignedJobs, jobId]);

  const saveSession = (s) => {
    setSession(s);
    if (s) localStorage.setItem(sessionKey(staffId), JSON.stringify(s));
    else localStorage.removeItem(sessionKey(staffId));
  };

  const liveSec = session ? Math.max(0, (now - session.startedAt) / 1000) : 0;
  const loggedJobMins = todayEntries.filter(t => !t.is_break).reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
  const loggedBreakMins = todayEntries.filter(t => t.is_break).reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
  const liveJobMins = session?.type === 'task' ? liveSec / 60 : 0;
  const liveBreakMins = session?.type === 'break' ? liveSec / 60 : 0;
  const totalJobMins = loggedJobMins + liveJobMins;
  const totalBreakMins = loggedBreakMins + liveBreakMins;
  const totalDayMins = totalJobMins + totalBreakMins;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['dtt-today'] });
    queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['today-board'] });
  };

  const startTask = () => {
    if (!jobId || !task.trim()) return;
    saveSession({ type: 'task', jobId, task: task.trim(), startedAt: Date.now() });
    setNow(Date.now());
  };
  const startBreak = () => {
    saveSession({ type: 'break', startedAt: Date.now() });
    setNow(Date.now());
  };

  const stopTask = async () => {
    if (!session) return;
    const mins = Math.max(1, Math.round(liveSec / 60));
    setSaving(true);
    try {
      await base44.entities.Timesheet.create({
        staff_id: staffId, job_id: session.jobId, date: today,
        task_description: session.task, task_duration_minutes: mins,
        total_hours: Math.round((mins / 60) * 100) / 100, status: 'submitted', is_break: false
      });
      setJustLogged({ task: session.task, mins, type: 'task' });
      saveSession(null); invalidateAll();
    } catch (e) { console.error(e); }
    setSaving(false);
  };
  const endBreak = async () => {
    if (!session) return;
    const mins = Math.max(1, Math.round(liveSec / 60));
    setSaving(true);
    try {
      await base44.entities.Timesheet.create({
        staff_id: staffId, job_id: '', date: today,
        task_description: 'Break', task_duration_minutes: mins,
        total_hours: Math.round((mins / 60) * 100) / 100, status: 'submitted', is_break: true
      });
      setJustLogged({ task: 'Break', mins, type: 'break' });
      saveSession(null); invalidateAll();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const barMax = Math.max(480, totalDayMins); // 8h baseline
  const jobPct = Math.min(100, (totalJobMins / barMax) * 100);
  const breakPct = Math.min(100 - jobPct, (totalBreakMins / barMax) * 100);
  const activeJobName = jobs.find(j => j.id === (session?.jobId || jobId))?.name;
  const isTasking = session?.type === 'task';
  const isBreak = session?.type === 'break';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="hero-gradient px-4 md:px-6 py-4 md:py-5 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold leading-tight">Today's Time</h2>
              <p className="text-emerald-100 text-xs">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-emerald-100 font-medium">Total day</p>
            <p className="text-2xl md:text-3xl font-bold tabular-nums leading-none mt-0.5">{fmtMins(totalDayMins)}</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Stacked bar + legend */}
        <div>
          <div className="flex h-3.5 w-full rounded-full overflow-hidden bg-slate-100">
            <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${jobPct}%` }} />
            <div className="bg-amber-400 transition-all duration-500" style={{ width: `${breakPct}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <Briefcase className="w-3.5 h-3.5 text-emerald-600" /> Job time: <b className="text-slate-900">{fmtMins(totalJobMins)}</b>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <Coffee className="w-3.5 h-3.5 text-amber-500" /> Break: <b className="text-slate-900">{fmtMins(totalBreakMins)}</b>
            </span>
          </div>
        </div>

        {/* Live session / controls */}
        {isTasking && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Working on
                </p>
                <p className="font-semibold text-slate-900 truncate">{activeJobName}</p>
                <p className="text-xs text-slate-500 truncate">{session.task}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-emerald-700">{fmtClock(liveSec)}</p>
              </div>
            </div>
            <button onClick={stopTask} disabled={saving}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
              <Square className="w-4 h-4 fill-current" /> {saving ? 'Saving…' : 'Stop & Log'}
            </button>
          </div>
        )}

        {isBreak && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Coffee className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> On break
                  </p>
                  <p className="font-semibold text-slate-900">Break</p>
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-amber-600">{fmtClock(liveSec)}</p>
            </div>
            <button onClick={endBreak} disabled={saving}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
              <Square className="w-4 h-4 fill-current" /> {saving ? 'Saving…' : 'End Break'}
            </button>
          </div>
        )}

        {!session && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
            {assignedJobs.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2.5 rounded-lg border border-amber-100">
                You can only log time for jobs you've been assigned to. Ask your manager to assign you to a job first.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
                  <select value={jobId} onChange={e => setJobId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white">
                    <option value="">Select job</option>
                    {assignedJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">What are you doing? *</label>
                  <input type="text" value={task} onChange={e => setTask(e.target.value)}
                    placeholder="e.g. Putting up heras fencing"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={startTask} disabled={!jobId || !task.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
                    <Play className="w-4 h-4 fill-current" /> Start Timer
                  </button>
                  <button onClick={startBreak}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 active:scale-95 transition text-sm font-semibold touch-manipulation">
                    <Coffee className="w-4 h-4" /> Start Break
                  </button>
                </div>
              </>
            )}
            {justLogged && (
              <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Logged {fmtMins(justLogged.mins)} — {justLogged.task}
              </p>
            )}
          </div>
        )}

        {/* Today's logged entries */}
        {todayEntries.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Today's log ({todayEntries.length})</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {[...todayEntries].reverse().map(t => {
                const job = jobs.find(j => j.id === t.job_id);
                const mins = Number(t.task_duration_minutes) || 0;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-slate-50">
                    <div className="min-w-0 flex items-center gap-2">
                      {t.is_break ? <Coffee className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> : <Briefcase className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{t.is_break ? 'Break' : (t.task_description || job?.name || 'Task')}</p>
                        {!t.is_break && <p className="text-[11px] text-slate-400 truncate">{job?.name || '—'}</p>}
                      </div>
                    </div>
                    <span className={`font-semibold tabular-nums flex-shrink-0 ${t.is_break ? 'text-amber-600' : 'text-slate-700'}`}>{fmtMins(mins)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}