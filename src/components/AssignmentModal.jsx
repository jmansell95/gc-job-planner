import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, Trash2, RotateCcw, Loader2, CheckCircle2, Clock, MapPin, Calendar, CalendarClock, User, Phone, Briefcase, FileText } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { isStaffOutsideJobTeams, getJobTeamIds } from '@/utils/jobTeams';
import { isWeekend, buildRateMap } from '@/utils/overtime';
import { getCurrentTimeStr, SITE_CLOSE_TIME } from '@/utils/siteHours';
import { findConflict, suggestAutoTimes, getDailyShiftSummary } from '@/utils/rotaScheduling';

export default function AssignmentModal({ isOpen, onClose, assignment, defaultStaffId, defaultDate, weekStartStr, staff, jobs, vehicles, existingRotas }) {
  const [formData, setFormData] = useState({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '', start_time: '', end_time: '', notes: '', is_overtime: false, rate_multiplier: '', start_delayed: false, actual_start_date: '' });
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [timeConflict, setTimeConflict] = useState(null);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring-absences'], queryFn: () => base44.entities.RecurringAbsence.list() });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const rateMap = buildRateMap(overtimeRates);

  const computeWeekStart = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return format(monday, 'yyyy-MM-dd');
  };

  const buildDateRange = (startStr, endStr) => {
    const days = [];
    let d = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    while (d <= end) {
      days.push(format(d, 'yyyy-MM-dd'));
      d = addDays(d, 1);
    }
    return days;
  };

  const isEditing = !!assignment;

  useEffect(() => {
    if (isOpen) {
      if (assignment) {
        setFormData({
          job_id: assignment.job_id || '',
          staff_id: assignment.staff_id || '',
          assigned_date: assignment.assigned_date || '',
          vehicle_id: assignment.vehicle_id || '',
          start_time: assignment.start_time || '',
          end_time: assignment.end_time || '',
          notes: assignment.notes || '',
          is_overtime: !!assignment.is_overtime,
          rate_multiplier: assignment.rate_multiplier != null ? String(assignment.rate_multiplier) : '',
          start_delayed: !!assignment.start_delayed,
          actual_start_date: assignment.actual_start_date || ''
        });
      } else {
        const defaults = getStaffDefaultTimes(defaultStaffId);
        setFormData({
          job_id: '',
          staff_id: defaultStaffId || '',
          assigned_date: '',
          vehicle_id: '',
          start_time: defaults.start_time,
          end_time: defaults.end_time,
          notes: '',
          is_overtime: false,
          rate_multiplier: '',
          start_delayed: false,
          actual_start_date: ''
        });
      }
      setConflictWarnings([]);
      setTimeConflict(null);
    }
  }, [isOpen, assignment, defaultStaffId, defaultDate]);

  if (!isOpen) return null;

  const checkConflicts = (staffId, date, vehicleId, startTime, endTime) => {
    const warnings = [];
    let timeConflict = null;
    if (staffId && date) {
      const dup = existingRotas.some(r => r.staff_id === staffId && r.assigned_date === date && r.id !== assignment?.id);
      if (dup) warnings.push('This staff member already has an assignment on this date — multi-job days are supported. The times below auto-adjust so they won\'t overlap.');
      const dow = new Date(date + 'T00:00:00').getDay();
      const rec = recurring.find(r => r.staff_id === staffId && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow));
      if (rec) warnings.push(`Staff is regularly off (${rec.label || 'Day Off'}) on this day.`);
      const onLeave = absences.some(a => a.staff_id === staffId && a.status === 'approved' && a.start_date <= date && a.end_date >= date);
      if (onLeave) warnings.push('Staff has an approved absence (leave) on this date.');
      // Time overlap (hard block)
      if (startTime && endTime) {
        timeConflict = findConflict(existingRotas, staffId, date, startTime, endTime, assignment?.id);
        if (timeConflict) {
          const cj = jobs.find(j => j.id === timeConflict.job_id);
          warnings.push(`Time clash with "${cj?.name || 'another shift'}" (${timeConflict.start_time}–${timeConflict.end_time}). Pick a different time or the clash must be resolved.`);
        }
      }
    }
    if (vehicleId && date) {
      const vehClash = existingRotas.some(r => r.vehicle_id === vehicleId && r.assigned_date === date && r.id !== assignment?.id && r.staff_id !== staffId);
      if (vehClash) warnings.push('This vehicle is already assigned to another staff member on this date.');
    }
    return { warnings, timeConflict };
  };

  const getStaffDefaultTimes = (staffId) => {
    const member = staff.find(s => s.id === staffId);
    const team = teams.find(t => t.id === member?.team_id);
    if (team?.job_type === 'depot' || /depot/i.test(team?.name || '')) {
      return { start_time: '07:00', end_time: '16:00' };
    }
    return { start_time: '08:00', end_time: '17:00' };
  };

  const handleStaffChange = (staffId) => {
    // When the staff already has a shift this date, auto-suggest a non-overlapping slot.
    let suggested = null;
    if (!isEditing && staffId && formData.assigned_date) {
      const dayCount = existingRotas.filter(r => r.staff_id === staffId && r.assigned_date === formData.assigned_date).length;
      if (dayCount > 0) {
        suggested = suggestAutoTimes(existingRotas, staffId, formData.assigned_date);
      }
    }
    const defaults = isEditing ? {} : (suggested || getStaffDefaultTimes(staffId));
    setFormData(prev => ({ ...prev, staff_id: staffId, ...defaults }));
    if (staffId && formData.assigned_date) {
      const res = checkConflicts(staffId, formData.assigned_date, formData.vehicle_id, formData.start_time, formData.end_time);
      setConflictWarnings(res.warnings);
      setTimeConflict(res.timeConflict);
    } else { setConflictWarnings([]); setTimeConflict(null); }
  };

  const handleJobChange = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    const plannedStart = job?.start_date || '';
    setFormData(prev => {
      const next = { ...prev, job_id: jobId, assigned_date: plannedStart, start_delayed: false, actual_start_date: '' };
      if (plannedStart) {
        const weekend = isWeekend(plannedStart);
        if (weekend && !prev.is_overtime && prev.rate_multiplier === '') {
          next.is_overtime = true;
          next.rate_multiplier = String(rateMap[new Date(plannedStart + 'T00:00:00').getDay()] ?? 1.5);
        }
        if (!weekend && prev.is_overtime && prev.rate_multiplier === '') {
          next.is_overtime = false;
        }
      }
      return next;
    });
    if (plannedStart && formData.staff_id) {
      const res = checkConflicts(formData.staff_id, plannedStart, formData.vehicle_id, formData.start_time, formData.end_time);
      setConflictWarnings(res.warnings);
      setTimeConflict(res.timeConflict);
    } else {
      setConflictWarnings([]);
      setTimeConflict(null);
    }
  };

  const selectedJob = jobs.find(j => j.id === formData.job_id);
  const selectedStaff = staff.find(s => s.id === formData.staff_id);
  const effectiveStartDisplay = formData.start_delayed && formData.actual_start_date ? formData.actual_start_date : formData.assigned_date;
  const multiDayDays = (!isEditing && selectedJob?.end_date && effectiveStartDisplay && selectedJob.end_date > effectiveStartDisplay) ? buildDateRange(effectiveStartDisplay, selectedJob.end_date) : [];
  const teamMismatch = isStaffOutsideJobTeams(selectedStaff, selectedJob, teams);
  const requiredTeamNames = selectedJob ? getJobTeamIds(selectedJob).map(id => teams.find(t => t.id === id)?.name).filter(Boolean) : [];
  const selectedStaffTeamName = selectedStaff ? (teams.find(t => t.id === selectedStaff.team_id)?.name || 'No team') : '';

  const handleDateChange = (date) => {
    const weekend = isWeekend(date);
    const dayCount = formData.staff_id ? existingRotas.filter(r => r.staff_id === formData.staff_id && r.assigned_date === date && r.id !== assignment?.id).length : 0;
    const suggested = (dayCount > 0 && !isEditing) ? suggestAutoTimes(existingRotas, formData.staff_id, date) : null;
    setFormData(prev => {
      const next = { ...prev, assigned_date: date };
      if (suggested) { next.start_time = suggested.start_time; next.end_time = suggested.end_time; }
      if (weekend && !prev.is_overtime && prev.rate_multiplier === '') {
        next.is_overtime = true;
        next.rate_multiplier = String(rateMap[new Date(date + 'T00:00:00').getDay()] ?? 1.5);
      }
      if (!weekend && prev.is_overtime && prev.rate_multiplier === '') {
        next.is_overtime = false;
      }
      return next;
    });
    if (date && formData.staff_id) {
      const res = checkConflicts(formData.staff_id, date, formData.vehicle_id, suggested?.start_time || formData.start_time, suggested?.end_time || formData.end_time);
      setConflictWarnings(res.warnings);
      setTimeConflict(res.timeConflict);
    } else {
      setConflictWarnings([]);
      setTimeConflict(null);
    }
  };

  const toggleOvertime = (on) => {
    setFormData(prev => {
      const next = { ...prev, is_overtime: on };
      if (on && (!prev.rate_multiplier || prev.rate_multiplier === '')) {
        const dow = prev.assigned_date ? new Date(prev.assigned_date + 'T00:00:00').getDay() : 6;
        next.rate_multiplier = String(rateMap[dow] ?? 1.5);
      }
      return next;
    });
  };

  const handleVehicleChange = (vehicleId) => {
    setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    if (formData.staff_id && formData.assigned_date) {
      const res = checkConflicts(formData.staff_id, formData.assigned_date, vehicleId, formData.start_time, formData.end_time);
      setConflictWarnings(res.warnings);
      setTimeConflict(res.timeConflict);
    }
  };

  const handleTimeChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (next.staff_id && next.assigned_date && next.start_time && next.end_time) {
        const res = checkConflicts(next.staff_id, next.assigned_date, next.vehicle_id, next.start_time, next.end_time);
        setConflictWarnings(res.warnings);
        setTimeConflict(res.timeConflict);
      }
      return next;
    });
  };

  // Live day summary for the selected staff+date (multi-job indicator)
  const daySummary = (formData.staff_id && formData.assigned_date)
    ? getDailyShiftSummary(existingRotas, formData.staff_id, formData.assigned_date)
    : null;
  const showAutoSuggest = daySummary && daySummary.assignments.length > 0 && !isEditing;

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Block creating assignments for past days or today after working hours
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isDateLocked = (dateStr) => {
      if (!dateStr) return false;
      if (dateStr < todayStr) return true;
      if (dateStr === todayStr) return getCurrentTimeStr() > SITE_CLOSE_TIME;
      return false;
    };
    const effectiveDate = formData.start_delayed && formData.actual_start_date ? formData.actual_start_date : formData.assigned_date;
    if (!isEditing && isDateLocked(effectiveDate)) {
      alert('Cannot create assignments for past days or after the working day has ended.');
      return;
    }
    if (teamMismatch) {
      if (!confirm(`This staff member (${selectedStaffTeamName}) is not in the required teams for this job (${requiredTeamNames.join(', ')}).\n\nAssign anyway?`)) return;
    }
    // Hard block: overlapping shift times can't be saved.
    if (timeConflict) {
      alert(`This shift's times overlap with another shift for the same person on this date. Adjust the start/end time first.`);
      return;
    }
    if (conflictWarnings.length > 0) {
      if (!confirm('There are scheduling conflicts:\n\n' + conflictWarnings.map(w => '• ' + w).join('\n') + '\n\nAdd anyway?')) return;
    }
    if (!formData.assigned_date) {
      alert('Please select a job — the assignment date is taken from the job\'s planned start.');
      return;
    }
    try {
      const rateMultiplier = formData.rate_multiplier === '' ? null : Number(formData.rate_multiplier);
      const effectiveStart = formData.start_delayed && formData.actual_start_date ? formData.actual_start_date : formData.assigned_date;
      const isMultiDay = !isEditing && selectedJob?.end_date && selectedJob.end_date > effectiveStart;
      if (isEditing) {
        const payload = {
          ...formData,
          rate_multiplier: rateMultiplier,
          actual_start_date: formData.start_delayed ? (formData.actual_start_date || null) : null
        };
        if (formData.start_delayed && formData.actual_start_date) payload.assigned_date = formData.actual_start_date;
        await base44.entities.RotaAssignment.update(assignment.id, payload);
      } else if (isMultiDay) {
        const days = buildDateRange(effectiveStart, selectedJob.end_date);
        const assignments = days.map((dateStr, idx) => ({
          job_id: formData.job_id,
          staff_id: formData.staff_id,
          assigned_date: dateStr,
          vehicle_id: formData.vehicle_id || '',
          week_start: computeWeekStart(dateStr),
          start_time: formData.start_time || '',
          end_time: formData.end_time || '',
          notes: formData.notes || '',
          is_overtime: !!formData.is_overtime,
          rate_multiplier: rateMultiplier,
          start_delayed: idx === 0 ? !!formData.start_delayed : false,
          actual_start_date: idx === 0 ? (formData.start_delayed ? (formData.actual_start_date || null) : null) : null,
          status: 'assigned'
        }));
        await base44.entities.RotaAssignment.bulkCreate(assignments);
      } else {
        await base44.entities.RotaAssignment.create({
          job_id: formData.job_id,
          staff_id: formData.staff_id,
          assigned_date: effectiveStart,
          vehicle_id: formData.vehicle_id || '',
          week_start: computeWeekStart(effectiveStart),
          start_time: formData.start_time || '',
          end_time: formData.end_time || '',
          notes: formData.notes || '',
          is_overtime: !!formData.is_overtime,
          rate_multiplier: rateMultiplier,
          start_delayed: !!formData.start_delayed,
          actual_start_date: formData.start_delayed ? (formData.actual_start_date || null) : null,
          status: 'assigned'
        });
      }
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      onClose();
    } catch (error) {
      console.error('Error saving assignment:', error);
    }
  };

  const handleResetBriefing = async () => {
    if (!confirm('Reset the briefing for this shift?\n\nThe crew member will need to complete the site briefing again before they can start work.')) return;
    setResetting(true);
    try {
      await base44.functions.invoke('resetAssignmentBriefing', { assignment_id: assignment.id });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      onClose();
    } catch (error) {
      console.error('Error resetting briefing:', error);
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this shift?')) return;
    try {
      await base44.entities.RotaAssignment.delete(assignment.id);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      onClose();
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-semibold text-slate-900">{isEditing ? 'Edit Shift' : 'New Shift'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
              <select value={formData.job_id} onChange={(e) => handleJobChange(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Job</option>
                {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
              </select>
              {selectedJob && requiredTeamNames.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">Required teams: {requiredTeamNames.join(', ')}</p>
              )}
            </div>
            {selectedJob && (
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <Briefcase className="w-4 h-4 text-emerald-700" />
                  <p className="text-sm font-bold text-slate-900 truncate">{selectedJob.name}</p>
                  {selectedJob.job_reference && (
                    <span className="ml-auto text-[11px] font-mono text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">{selectedJob.job_reference}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedJob.location && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{selectedJob.location}</span>
                    </div>
                  )}
                  {selectedJob.start_date && (
                    <div className="flex items-center gap-1.5 text-slate-600 bg-white/60 rounded-md px-1.5 py-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="truncate"><span className="text-slate-400">Planned:</span> <span className="font-semibold text-slate-700">{format(new Date(selectedJob.start_date + 'T00:00:00'), 'dd MMM yyyy')}</span> → {selectedJob.end_date ? format(new Date(selectedJob.end_date + 'T00:00:00'), 'dd MMM yyyy') : 'TBC'}</span>
                    </div>
                  )}
                  {selectedJob.project_manager && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">PM: {selectedJob.project_manager}</span>
                    </div>
                  )}
                  {selectedJob.site_contact_phone && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{selectedJob.site_contact_name ? `${selectedJob.site_contact_name} · ` : ''}{selectedJob.site_contact_phone}</span>
                    </div>
                  )}
                </div>
                {selectedJob.notes && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 pt-1 border-t border-slate-200">
                    <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="line-clamp-2">{selectedJob.notes}</p>
                  </div>
                )}
              </div>
            )}
            {selectedJob?.start_date && (
              <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock className="w-4 h-4 text-emerald-700" />
                  <p className="text-xs font-semibold text-slate-800">Job Start Timing</p>
                </div>
                <p className="text-xs text-slate-500 mb-2.5">
                  Planned start: <span className="font-semibold text-slate-700">{format(new Date(selectedJob.start_date + 'T00:00:00'), 'dd MMM yyyy')}</span>. Is the job starting on time?
                </p>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => { setFormData(prev => ({ ...prev, start_delayed: false, actual_start_date: '', assigned_date: selectedJob.start_date })); if (formData.staff_id) setConflictWarnings(checkConflicts(formData.staff_id, selectedJob.start_date, formData.vehicle_id)); }}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${!formData.start_delayed ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> On time
                  </button>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, start_delayed: true, actual_start_date: prev.actual_start_date || prev.assigned_date || selectedJob.start_date }))}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${formData.start_delayed ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <AlertTriangle className="w-3.5 h-3.5" /> Delayed
                  </button>
                </div>
                {formData.start_delayed && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Actual start date</label>
                    <input type="date" value={formData.actual_start_date} onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, actual_start_date: v, assigned_date: v })); if (formData.staff_id) setConflictWarnings(checkConflicts(formData.staff_id, v, formData.vehicle_id)); else setConflictWarnings([]); }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 text-sm" />
                    {formData.actual_start_date && selectedJob.start_date && formData.actual_start_date > selectedJob.start_date && (
                      <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {differenceInDays(new Date(formData.actual_start_date + 'T00:00:00'), new Date(selectedJob.start_date + 'T00:00:00'))} day(s) behind planned start
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member *</label>
              <select value={formData.staff_id} onChange={(e) => handleStaffChange(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Staff</option>
                {staff.map(s => {
                  const teamName = teams.find(t => t.id === s.team_id)?.name || 'No team';
                  const aligned = selectedJob ? !isStaffOutsideJobTeams(s, selectedJob, teams) : false;
                  return <option key={s.id} value={s.id}>{s.name} — {teamName}{selectedJob && aligned ? ' ✓' : ''}</option>;
                })}
              </select>
              {selectedJob && (
                <p className="text-[11px] text-slate-400 mt-1">All staff are listed. Those in the required teams are marked ✓.</p>
              )}
              {formData.assigned_date && staff.length > 0 && (() => {
                const date = formData.assigned_date;
                const dow = new Date(date + 'T00:00:00').getDay();
                const free = staff.filter(s => {
                  if (existingRotas.some(r => r.staff_id === s.id && r.assigned_date === date && r.id !== assignment?.id)) return false;
                  if (recurring.some(r => r.staff_id === s.id && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow))) return false;
                  if (absences.some(a => a.staff_id === s.id && a.status === 'approved' && a.start_date <= date && a.end_date >= date)) return false;
                  return true;
                });
                return (
                  <p className="text-[11px] mt-1">
                    <span className="text-emerald-700 font-medium">{free.length} available</span>
                    <span className="text-slate-400"> · {staff.length - free.length} busy/off</span>
                  </p>
                );
              })()}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assignment Date</label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                {formData.assigned_date ? format(new Date(formData.assigned_date + 'T00:00:00'), 'EEE dd MMM yyyy') : <span className="text-slate-400 italic">Select a job first</span>}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Auto from job planned start · override via "Delayed"</p>
            </div>
            {multiDayDays.length > 0 && (
              <div className="sm:col-span-2 flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CalendarClock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Multi-day job — assignments will be created for each day from <strong>{format(new Date(effectiveStartDisplay + 'T00:00:00'), 'dd MMM')}</strong> to <strong>{format(new Date(selectedJob.end_date + 'T00:00:00'), 'dd MMM yyyy')}</strong> ({multiDayDays.length} days).</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle</label>
              <select value={formData.vehicle_id} onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Vehicle (Optional)</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-700" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Shift Hours</p>
                    <p className="text-[11px] text-slate-400">Site hours 08:00–17:00{daySummary ? ` · ${daySummary.assignments.length} shift${daySummary.assignments.length !== 1 ? 's' : ''} today` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="time" value={formData.start_time} onChange={(e) => handleTimeChange('start_time', e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600" />
                  <span className="text-slate-300">→</span>
                  <input type="time" value={formData.end_time} onChange={(e) => handleTimeChange('end_time', e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600" />
                </div>
              </div>
              {showAutoSuggest && (
                <div className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2 py-1.5">
                  <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
                  This is the {daySummary.assignments.length + 1}{['st','nd','rd'][Math.min(daySummary.assignments.length, 2)] || 'th'} job today — times auto-fit to avoid overlapping.
                </div>
              )}
              {daySummary && daySummary.hasOverlap && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Existing shifts on this day overlap — resolve before publishing.
                </div>
              )}
            </div>
            {/* Overtime */}
            <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Overtime Shift</p>
                    <p className="text-[11px] text-slate-400">
                      {isWeekend(formData.assigned_date)
                        ? 'Weekend date — overtime suggested.'
                        : 'Enable to bill this shift at an overtime rate.'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => toggleOvertime(!formData.is_overtime)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition flex-shrink-0 ${formData.is_overtime ? 'bg-amber-500' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${formData.is_overtime ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {formData.is_overtime && (
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Rate multiplier</label>
                  <select value={formData.rate_multiplier} onChange={(e) => setFormData({ ...formData, rate_multiplier: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 text-sm">
                    <option value="">Use day default</option>
                    <option value="1.5">1.5x (time-and-a-half)</option>
                    <option value="2">2.0x (double time)</option>
                    <option value="2.5">2.5x</option>
                    <option value="3">3.0x</option>
                  </select>
                  {formData.rate_multiplier && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-md whitespace-nowrap">
                      {Number(formData.rate_multiplier).toFixed(1)}x
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
                placeholder="Add any notes for this assignment..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm resize-none" />
            </div>
          </div>
          {teamMismatch && (
            <div className="mt-3 flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Team alignment warning</p>
                <p className="text-xs text-orange-600 mt-0.5">{selectedStaff?.name} ({selectedStaffTeamName}) is not in the required teams for this job ({requiredTeamNames.join(', ')}). You can still assign them.</p>
              </div>
            </div>
          )}
          {selectedJob && selectedStaff && !teamMismatch && requiredTeamNames.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{selectedStaff.name} is in a required team for this job.</span>
            </div>
          )}
          {conflictWarnings.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {conflictWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button type="submit" className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
              {isEditing ? 'Update Assignment' : 'Add Assignment'}
            </button>
            {isEditing && assignment.briefing_signed && (
              <button type="button" onClick={handleResetBriefing} disabled={resetting}
                className="px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition font-medium text-sm flex items-center gap-1.5 disabled:opacity-50">
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reset Briefing
              </button>
            )}
            {isEditing && (
              <button type="button" onClick={handleDelete} className="px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium text-sm flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}