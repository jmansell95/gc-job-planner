import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, Trash2, RotateCcw, Loader2, CheckCircle2, Clock, MapPin, Calendar, User, Phone, Briefcase, FileText } from 'lucide-react';
import { isStaffOutsideJobTeams, getJobTeamIds } from '@/utils/jobTeams';
import { isWeekend, buildRateMap } from '@/utils/overtime';

export default function AssignmentModal({ isOpen, onClose, assignment, defaultStaffId, defaultDate, weekStartStr, staff, jobs, vehicles, existingRotas }) {
  const [formData, setFormData] = useState({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '', start_time: '', end_time: '', notes: '', is_overtime: false, rate_multiplier: '' });
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring-absences'], queryFn: () => base44.entities.RecurringAbsence.list() });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const rateMap = buildRateMap(overtimeRates);

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
          rate_multiplier: assignment.rate_multiplier != null ? String(assignment.rate_multiplier) : ''
        });
      } else {
        const weekend = isWeekend(defaultDate);
        const defaults = getStaffDefaultTimes(defaultStaffId);
        setFormData({
          job_id: '',
          staff_id: defaultStaffId || '',
          assigned_date: defaultDate || '',
          vehicle_id: '',
          start_time: defaults.start_time,
          end_time: defaults.end_time,
          notes: '',
          is_overtime: weekend,
          rate_multiplier: weekend ? String(rateMap[new Date(defaultDate + 'T00:00:00').getDay()] ?? 1.5) : ''
        });
      }
      setConflictWarnings([]);
    }
  }, [isOpen, assignment, defaultStaffId, defaultDate]);

  if (!isOpen) return null;

  const checkConflicts = (staffId, date, vehicleId) => {
    const warnings = [];
    if (staffId && date) {
      const dup = existingRotas.some(r => r.staff_id === staffId && r.assigned_date === date && r.id !== assignment?.id);
      if (dup) warnings.push('This staff member is already assigned on this date.');
      const dow = new Date(date + 'T00:00:00').getDay();
      const rec = recurring.find(r => r.staff_id === staffId && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow));
      if (rec) warnings.push(`Staff is regularly off (${rec.label || 'Day Off'}) on this day.`);
      const onLeave = absences.some(a => a.staff_id === staffId && a.status === 'approved' && a.start_date <= date && a.end_date >= date);
      if (onLeave) warnings.push('Staff has an approved absence (leave) on this date.');
    }
    if (vehicleId && date) {
      const vehClash = existingRotas.some(r => r.vehicle_id === vehicleId && r.assigned_date === date && r.id !== assignment?.id && r.staff_id !== staffId);
      if (vehClash) warnings.push('This vehicle is already assigned to another staff member on this date.');
    }
    return warnings;
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
    const defaults = isEditing ? {} : getStaffDefaultTimes(staffId);
    setFormData(prev => ({ ...prev, staff_id: staffId, ...defaults }));
    if (staffId && formData.assigned_date) {
      setConflictWarnings(checkConflicts(staffId, formData.assigned_date, formData.vehicle_id));
    } else setConflictWarnings([]);
  };

  const handleJobChange = (jobId) => {
    setFormData(prev => ({ ...prev, job_id: jobId }));
  };

  const selectedJob = jobs.find(j => j.id === formData.job_id);
  const selectedStaff = staff.find(s => s.id === formData.staff_id);
  const teamMismatch = isStaffOutsideJobTeams(selectedStaff, selectedJob, teams);
  const requiredTeamNames = selectedJob ? getJobTeamIds(selectedJob).map(id => teams.find(t => t.id === id)?.name).filter(Boolean) : [];
  const selectedStaffTeamName = selectedStaff ? (teams.find(t => t.id === selectedStaff.team_id)?.name || 'No team') : '';

  const handleDateChange = (date) => {
    const weekend = isWeekend(date);
    setFormData(prev => {
      // Auto-enable overtime + default rate when a weekend is picked (unless the
      // user previously turned it off for this same edit session).
      const next = { ...prev, assigned_date: date };
      if (weekend && !prev.is_overtime && prev.rate_multiplier === '') {
        next.is_overtime = true;
        next.rate_multiplier = String(rateMap[new Date(date + 'T00:00:00').getDay()] ?? 1.5);
      }
      if (!weekend && prev.is_overtime && prev.rate_multiplier === '') {
        next.is_overtime = false;
      }
      return next;
    });
    setConflictWarnings(date && formData.staff_id ? checkConflicts(formData.staff_id, date, formData.vehicle_id) : []);
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
    setConflictWarnings(formData.staff_id && formData.assigned_date ? checkConflicts(formData.staff_id, formData.assigned_date, vehicleId) : []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (teamMismatch) {
      if (!confirm(`This staff member (${selectedStaffTeamName}) is not in the required teams for this job (${requiredTeamNames.join(', ')}).\n\nAssign anyway?`)) return;
    }
    if (conflictWarnings.length > 0) {
      if (!confirm('There are scheduling conflicts:\n\n' + conflictWarnings.map(w => '• ' + w).join('\n') + '\n\nAdd anyway?')) return;
    }
    try {
      const payload = {
        ...formData,
        rate_multiplier: formData.rate_multiplier === '' ? null : Number(formData.rate_multiplier)
      };
      if (isEditing) {
        await base44.entities.RotaAssignment.update(assignment.id, payload);
      } else {
        await base44.entities.RotaAssignment.create({
          ...payload,
          week_start: weekStartStr,
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
    if (!confirm('Reset the briefing for this assignment?\n\nThe staff member will need to complete the site briefing again before they can start work.')) return;
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
    if (!confirm('Delete this assignment?')) return;
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
          <h3 className="font-semibold text-slate-900">{isEditing ? 'Edit Assignment' : 'New Assignment'}</h3>
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
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{selectedJob.start_date} → {selectedJob.end_date || 'TBC'}</span>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              {defaultDate ? (
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium">
                  {(() => { try { return new Date(formData.assigned_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); } catch { return formData.assigned_date; } })()}
                </div>
              ) : (
                <input type="date" value={formData.assigned_date} onChange={(e) => handleDateChange(e.target.value)} required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle</label>
              <select value={formData.vehicle_id} onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Vehicle (Optional)</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Shift Hours (auto from team)</p>
                  <p className="text-[11px] text-slate-400">{selectedStaff ? (teams.find(t => t.id === selectedStaff.team_id)?.name || 'No team') : 'Select staff to apply team hours'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md">{formData.start_time || '—'}</span>
                <span className="text-slate-300">→</span>
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md">{formData.end_time || '—'}</span>
              </div>
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