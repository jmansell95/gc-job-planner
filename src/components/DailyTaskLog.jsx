import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Send, Trash2, Ruler, CheckCircle2, FileText, Timer, Coffee, AlertTriangle, TrendingUp, X, Car, Briefcase, PoundSterling, ShieldAlert, ExternalLink, Hourglass } from 'lucide-react';
import { format } from 'date-fns';
import { canViewCostings } from '@/utils/access';
import DelayLogForm from '@/components/DelayLogForm';

const SAFETY_REPORT_URL = 'https://app.safetyculture.com/inspection/audit_3f1be1e08438431a9bacaab5137107f7?page=1&isNew=true&holisticOnboarding=false';

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

export default function DailyTaskLog({ staffId, hideSubmit = false }) {
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
  const [isTravel, setIsTravel] = useState(false);
  const [travelDirection, setTravelDirection] = useState('to');
  const [adding, setAdding] = useState(false);
  const [submittingDay, setSubmittingDay] = useState(false);
  const [fixingGapId, setFixingGapId] = useState(null);
  const [showDelayForm, setShowDelayForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: assignments = [] } = useQuery({ queryKey: ['staff-assignments', staffId], queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffId }), enabled: !!staffId });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-assignments'], queryFn: () => base44.entities.Job.list() });
  const { data: todayEntries = [] } = useQuery({ queryKey: ['daily-tasks', staffId, today], queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, date: today }), enabled: !!staffId });
  const { data: shifts = [] } = useQuery({ queryKey: ['staff-shifts', staffId], queryFn: () => base44.entities.StaffShift.filter({ staff_id: staffId }), enabled: !!staffId });
  const { data: taskBillingRules = [] } = useQuery({ queryKey: ['billing-rules-task'], queryFn: () => base44.entities.BillingRule.filter({ rule_type: 'task', is_active: true }) });
  const { data: profile } = useQuery({ queryKey: ['my-staff-profile'], queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; } });
  const { data: bizConfig } = useQuery({ queryKey: ['business-config'], queryFn: async () => { const list = await base44.entities.BusinessConfig.filter({ key: 'global' }); return list[0] || null; } });
  // Show cost-gated content while the profile is loading or errored (published
  // site edge cases); enforce the real role gate once the profile resolves.
  const canSeeCosts = !profile || canViewCostings(profile);

  const todayAssignments = assignments.filter(a => a.assigned_date === today);
  const todayJobIds = [...new Set(todayAssignments.map(a => a.job_id))];
  const todayJobs = jobs.filter(j => todayJobIds.includes(j.id));
  const otherJobIds = [...new Set(assignments.filter(a => a.assigned_date !== today).map(a => a.job_id))];
  const otherJobs = jobs.filter(j => otherJobIds.includes(j.id) && !todayJobIds.includes(j.id));
  const assignedJobs = [...todayJobs, ...otherJobs];
  const todayShift = shifts.find(s => s.day_of_week === todayDow);

  useEffect(() => { if (!jobId && todayJobs.length === 1) setJobId(todayJobs[0].id); else if (!jobId && todayJobs.length === 0 && assignedJobs.length === 1) setJobId(assignedJobs[0].id); }, [todayJobs, assignedJobs, jobId]);
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
    queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
  };

  const resetForm = () => {
    setTask(''); setEndTime(''); setMeterage(''); setNotes('');
    setStartTime(todayShift?.start_time || '');
    setIsLunch(false);
    setIsOvertime(false);
    setIsTravel(false);
    setTravelDirection('to');
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!startTime || !endTime || durMins <= 0 || overlapEntry) return;
    if (!isLunch && !isTravel && (!jobId || !task.trim())) return;
    if (isTravel && !jobId) return;
    setAdding(true);
    try {
      const taskType = isTravel ? (travelDirection === 'to' ? 'travel_to' : 'travel_from') : 'on_site';
      const taskDesc = isTravel ? (travelDirection === 'to' ? 'Travel to site' : 'Travel from site') : (isLunch ? 'Lunch Break' : task.trim());
      const created = await base44.entities.Timesheet.create({
        staff_id: staffId, date: today,
        job_id: isLunch ? '' : jobId,
        task_description: taskDesc,
        start_time: startTime, end_time: endTime,
        task_duration_minutes: durMins,
        total_hours: Math.round((durMins / 60) * 100) / 100,
        meterage: isLunch ? 0 : (isDriller ? (parseFloat(meterage) || 0) : 0),
        notes: notes.trim(), status: 'draft', is_break: isLunch, is_overtime: isOvertime,
        task_type: taskType
      });
      // Auto-calculate client charge for on-site tasks
      if (!isLunch && !isTravel && taskDesc) {
        try {
          const res = await base44.functions.invoke('calculateCharge', {
            entity_type: 'task',
            task_description: taskDesc,
            duration_minutes: durMins
          });
          const cd = res.data;
          if (cd && created.id) {
            await base44.entities.Timesheet.update(created.id, {
              chargeable: cd.charge_amount > 0,
              charge_amount: cd.charge_amount || 0,
              charge_breakdown: JSON.stringify(cd.breakdown || {}),
              billing_rule_id: cd.billing_rule_id || ''
            });
          }
        } catch (calcErr) { console.error('Charge calc error:', calcErr); }
      }
      resetForm();
      invalidateAll();
    } catch (err) { console.error(err); }
    setAdding(false);
  };

  const deleteDraft = async (id) => {
    await base44.entities.Timesheet.delete(id);
    invalidateAll();
  };

  const extendToFillGap = async (g) => {
    setFixingGapId(g.prev.id);
    try {
      const newDur = calcDur(g.prev.start_time, g.to);
      await base44.entities.Timesheet.update(g.prev.id, {
        end_time: g.to,
        task_duration_minutes: newDur,
        total_hours: Math.round((newDur / 60) * 100) / 100,
      });
      invalidateAll();
    } catch (err) { console.error(err); }
    setFixingGapId(null);
  };

  const prefillGapTask = (g) => {
    setStartTime(g.from);
    setEndTime(g.to);
    setIsLunch(false);
    setIsOvertime(false);
    setTask('');
    setNotes('');
    setMeterage('');
    setJobId(assignedJobs.length === 1 ? assignedJobs[0].id : '');
    document.getElementById('daily-task-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitDay = async () => {
    const drafts = todayEntries.filter(t => t.status === 'draft');
    if (drafts.length === 0 || !dayComplete) return;
    if (!confirm(`Submit your timesheet for today (${fmtDur(nonOTTotal)} on-site${otMins > 0 ? ` + ${fmtDur(otMins)} overtime` : ''}) to your manager?`)) return;
    setSubmittingDay(true);
    try {
      await base44.functions.invoke('submitDailyTimesheet', { staff_id: staffId, date: today });
      invalidateAll();
    } catch (err) { console.error(err); }
    setSubmittingDay(false);
  };

  const entries = todayEntries.filter(t => t.status !== 'deleted' && t.status !== 'rejected' && t.status !== 'merged');
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

  // Day completion: no gaps, 9 hours total (incl. 1h break), overtime excluded.
  const TARGET_MINS = Number(bizConfig?.required_daily_on_site_minutes) || 540;
  const BREAK_MINS = Number(bizConfig?.default_break_minutes) || 60;
  const nonOTEntries = entries.filter(t => !t.is_overtime && t.task_type !== 'travel_to' && t.task_type !== 'travel_from');
  const nonOTTotal = nonOTEntries.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
  const breakTotal = entries.filter(t => t.is_break).reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
  const sortedAll = [...nonOTEntries].sort((a, b) => (toMins(a.start_time) ?? 0) - (toMins(b.start_time) ?? 0));
  // Display list includes ALL entries (travel, breaks, on-site) sorted chronologically
  const displayEntries = [...entries].sort((a, b) => (toMins(a.start_time) ?? 0) - (toMins(b.start_time) ?? 0));
  const gaps = [];
  for (let i = 1; i < sortedAll.length; i++) {
    const prevEnd = toMins(sortedAll[i - 1].end_time);
    const curStart = toMins(sortedAll[i].start_time);
    if (prevEnd != null && curStart != null && curStart !== prevEnd) {
      gaps.push({ from: sortedAll[i - 1].end_time, to: sortedAll[i].start_time, prev: sortedAll[i - 1], next: sortedAll[i] });
    }
  }
  const gap = gaps[0] || null;
  const otMins = totalMins - nonOTTotal;
  const dayComplete = entries.length > 0 && !gap && nonOTTotal === TARGET_MINS && breakTotal === BREAK_MINS;
  const checks = [
    { ok: entries.length > 0 && !gap, label: 'No gaps in your schedule', detail: gap ? `Gap ${gap.from}–${gap.to}` : null },
    { ok: nonOTTotal === TARGET_MINS, label: `${fmtDur(TARGET_MINS)} total (incl. break)`, detail: `${fmtDur(nonOTTotal)} of ${fmtDur(TARGET_MINS)}` },
    { ok: breakTotal === BREAK_MINS, label: `${fmtDur(BREAK_MINS)} lunch break`, detail: `${fmtDur(breakTotal)} of ${fmtDur(BREAK_MINS)}` },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 md:p-6 space-y-4">
        {/* Report a safety issue */}
        <a href={SAFETY_REPORT_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 p-3.5 bg-red-50 rounded-xl border border-red-200 hover:bg-red-100 transition">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-red-900 text-sm">Action a Safety Issue on Site</p>
              <p className="text-xs text-red-600">Tap to open a Safety Culture report for any safety issues on site.</p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-red-500 flex-shrink-0" />
        </a>

        {/* Shift reference */}
        {todayShift && todayShift.start_time && todayShift.end_time && (
          <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
            <Timer className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-slate-600">Your shift today: <b className="text-slate-900">{todayShift.start_time} – {todayShift.end_time}</b> ({fmtDur(shiftMins)})</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">Worked <b className="text-slate-900">{fmtDur(totalMins)}</b>{shiftMins > 0 ? ` of ${fmtDur(shiftMins)}` : ''}</span>
          </div>
        )}

        {/* Today's assignment context */}
        {todayJobs.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
            <Briefcase className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-slate-600">Assigned to <b className="text-slate-900">{todayJobs.map(j => j.name).join(', ')}</b> today</span>
          </div>
        )}

        {/* Log a site delay — surfaces delays so managers can shift the rota */}
        {assignedJobs.length > 0 && (
          <>
            <button type="button" onClick={() => setShowDelayForm(true)}
              className="w-full flex items-center justify-between gap-3 p-3.5 bg-amber-50 rounded-xl border border-amber-200 hover:bg-amber-100 transition text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <Hourglass className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-amber-900 text-sm">Log a Site Delay</p>
                  <p className="text-xs text-amber-600">Hit ground, breakdown, weather? Tell your manager so the rota can be updated.</p>
                </div>
              </div>
              <Plus className="w-4 h-4 text-amber-600 flex-shrink-0" />
            </button>
            <DelayLogForm
              open={showDelayForm}
              onOpenChange={setShowDelayForm}
              jobId={todayJobs[0]?.id || assignedJobs[0]?.id}
              jobName={todayJobs[0]?.name || assignedJobs[0]?.name}
              staffId={staffId}
              staffName={profile?.name}
              jobOptions={assignedJobs.map(j => ({ id: j.id, name: j.name }))}
              onSaved={() => { queryClient.invalidateQueries({ queryKey: ['job-delay-logs'] }); }}
            />
          </>
        )}

        {/* Add task form */}
        {assignedJobs.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2.5 rounded-lg border border-amber-100">
            You can only log time for jobs you've been assigned to. Ask your manager to assign you to a job first.
          </p>
        ) : (
          <form id="daily-task-form" onSubmit={addTask} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
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
            {isTravel && (
              <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-blue-800 flex-wrap">
                <Car className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Travel:</span>
                <button type="button" onClick={() => setTravelDirection('to')}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${travelDirection === 'to' ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-700'}`}>To Site</button>
                <button type="button" onClick={() => setTravelDirection('from')}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${travelDirection === 'from' ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-700'}`}>From Site</button>
                <span className="text-[11px] text-blue-600 ml-1">First 1.5h unpaid (non-depot teams)</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{isLunch ? 'Break type' : isTravel ? 'Travel time' : 'What did you do? *'}</label>
              {!isLunch && !isTravel && (
                <input type="text" value={task} onChange={e => setTask(e.target.value)} required={!isLunch && !isTravel}
                  placeholder="e.g. Put up heras fencing around the compound"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TASK_SUGGESTIONS.map(s => {
                  const hasRule = canSeeCosts && taskBillingRules.some(r => r.name?.toLowerCase().trim() === s.toLowerCase().trim() && r.is_chargeable !== false);
                  return (
                    <button type="button" key={s} onClick={() => { setTask(s); setIsLunch(false); setIsOvertime(false); setIsTravel(false); }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1 ${!isLunch && !isOvertime && task === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700'}`}>
                      {s}
                      {hasRule && <PoundSterling className="w-2.5 h-2.5 opacity-70" />}
                    </button>
                  );
                })}
                <button type="button" onClick={() => { setIsLunch(true); setTask('Lunch Break'); setIsOvertime(false); setIsTravel(false); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1 ${isLunch ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400'}`}>
                  <Coffee className="w-3 h-3" /> Lunch Break
                </button>
                <button type="button" onClick={() => { setIsOvertime(true); setIsLunch(false); setIsTravel(false); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1 ${isOvertime ? 'bg-orange-600 text-white border-orange-600' : 'bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-400'}`}>
                  <TrendingUp className="w-3 h-3" /> Overtime
                </button>
                <button type="button" onClick={() => { setIsTravel(true); setIsLunch(false); setIsOvertime(false); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1 ${isTravel ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-400'}`}>
                  <Car className="w-3 h-3" /> Travel
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
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl hover:opacity-90 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation ${isLunch ? 'bg-amber-500' : isOvertime ? 'bg-orange-600' : isTravel ? 'bg-blue-600' : 'bg-emerald-700'}`}>
              <Plus className="w-4 h-4" /> {adding ? 'Adding…' : isLunch ? 'Add Lunch Break' : isOvertime ? 'Add Overtime Task' : isTravel ? (travelDirection === 'to' ? 'Add Travel To Site' : 'Add Travel From Site') : 'Add Task'}
            </button>
          </form>
        )}

        {/* Today's task list */}
        {entries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Today's log</p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {displayEntries.map(t => {
                const job = jobs.find(j => j.id === t.job_id);
                const tMins = Number(t.task_duration_minutes) || 0;
                return (
                  <div key={t.id} className={`px-3.5 py-3 flex items-center justify-between gap-3 ${t.is_break ? 'bg-amber-50/40' : (t.task_type === 'travel_to' || t.task_type === 'travel_from') ? 'bg-blue-50/40' : 'bg-white'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.is_break && <Coffee className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                        {(t.task_type === 'travel_to' || t.task_type === 'travel_from') && <Car className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                        <p className="font-medium text-sm text-slate-900 truncate">{t.is_break ? 'Lunch Break' : t.task_description}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${t.is_break ? 'bg-amber-100 text-amber-700' : statusBadge(t.status)}`}>
                          {t.is_break ? 'Break' : t.status === 'draft' ? 'Draft' : t.status === 'submitted' ? 'Submitted' : t.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                        {t.is_overtime && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                            <TrendingUp className="w-2.5 h-2.5" /> OT
                          </span>
                        )}
                        {(t.task_type === 'travel_to' || t.task_type === 'travel_from') && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Travel</span>
                        )}
                        {!t.is_break && t.meterage > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                            <Ruler className="w-2.5 h-2.5" /> {t.meterage}m
                          </span>
                        )}
                        {canSeeCosts && t.chargeable && Number(t.charge_amount) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">
                            <PoundSterling className="w-2.5 h-2.5" /> {Number(t.charge_amount).toFixed(2)}
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

        {/* Gap fixes */}
        {gaps.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-800">Fix the gap{gaps.length > 1 ? 's' : ''} before submitting</p>
            </div>
            {gaps.map((g, idx) => {
              const gapMins = (toMins(g.to) ?? 0) - (toMins(g.from) ?? 0);
              const canExtend = g.prev.status === 'draft';
              return (
                <div key={idx} className="bg-white rounded-lg border border-amber-200 p-2.5">
                  <p className="text-xs text-amber-800 mb-2">
                    <b>{g.from}–{g.to}</b> <span className="text-amber-600">({fmtDur(gapMins)} uncovered)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => prefillGapTask(g)}
                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-95 transition font-semibold">
                      <Plus className="w-3 h-3" /> Add task in gap
                    </button>
                    {canExtend && (
                      <button type="button" onClick={() => extendToFillGap(g)} disabled={fixingGapId === g.prev.id}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 active:scale-95 transition font-semibold disabled:opacity-50">
                        {fixingGapId === g.prev.id ? 'Extending…' : `Extend "${(g.prev.task_description || 'task').slice(0, 18)}" to ${g.to}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit day */}
        {drafts.length > 0 && !hideSubmit && (
          <div className={`rounded-xl border p-3.5 ${dayComplete ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/80'}`}>
            <ul className="space-y-1.5 mb-3">
              {checks.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    {c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          : <X className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    <span className={`${c.ok ? 'text-slate-500' : 'text-slate-700 font-medium'} truncate`}>{c.label}</span>
                  </span>
                  {!c.ok && c.detail && <span className="text-[10px] text-slate-400 flex-shrink-0">{c.detail}</span>}
                </li>
              ))}
            </ul>
            <button onClick={submitDay} disabled={submittingDay || !dayComplete}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation">
              <Send className="w-4 h-4" /> {submittingDay ? 'Submitting…' : dayComplete ? 'Submit Timesheet' : 'Complete the day to submit'}
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-2">Overtime tasks are extra and don't count toward the {fmtDur(TARGET_MINS)}.</p>
          </div>
        )}
      </div>
    </div>
  );
}