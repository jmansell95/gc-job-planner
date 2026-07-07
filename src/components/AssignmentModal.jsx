import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, Trash2, RotateCcw, Loader2, CheckCircle2 } from 'lucide-react';
import { isStaffOutsideJobTeams, getJobTeamIds } from '@/utils/jobTeams';

export default function AssignmentModal({ isOpen, onClose, assignment, defaultStaffId, defaultDate, weekStartStr, staff, jobs, vehicles, existingRotas }) {
  const [formData, setFormData] = useState({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '', start_time: '', end_time: '', notes: '' });
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring-absences'], queryFn: () => base44.entities.RecurringAbsence.list() });

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
          notes: assignment.notes || ''
        });
      } else {
        setFormData({
          job_id: '',
          staff_id: defaultStaffId || '',
          assigned_date: defaultDate || '',
          vehicle_id: '',
          start_time: '',
          end_time: '',
          notes: ''
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

  const handleStaffChange = (staffId) => {
    setFormData(prev => ({ ...prev, staff_id: staffId }));
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
    setFormData(prev => ({ ...prev, assigned_date: date }));
    setConflictWarnings(date && formData.staff_id ? checkConflicts(formData.staff_id, date, formData.vehicle_id) : []);
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
      if (isEditing) {
        await base44.entities.RotaAssignment.update(assignment.id, formData);
      } else {
        await base44.entities.RotaAssignment.create({
          ...formData,
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
              <input type="date" value={formData.assigned_date} onChange={(e) => handleDateChange(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle</label>
              <select value={formData.vehicle_id} onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Vehicle (Optional)</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
                <input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Time</label>
                <input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
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