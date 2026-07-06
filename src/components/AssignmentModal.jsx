import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, Trash2, RotateCcw, Loader2 } from 'lucide-react';

const JOB_TYPE_LABELS = {
  groundworks: 'Groundworks',
  cp_drilling: 'CP Drilling',
  rotary_drilling: 'Rotary Drilling',
  enabling_works: 'Enabling Works',
  depot: 'Depot'
};

export default function AssignmentModal({ isOpen, onClose, assignment, defaultStaffId, defaultDate, weekStartStr, staff, jobs, vehicles, existingRotas }) {
  const [formData, setFormData] = useState({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '', start_time: '', end_time: '', notes: '' });
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring-absences'], queryFn: () => base44.entities.RecurringAbsence.list() });

  const teamJobType = (staffMember) => {
    if (!staffMember?.team_id) return null;
    return teams.find(t => t.id === staffMember.team_id)?.job_type || null;
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
    const s = staff.find(x => x.id === staffId);
    setFormData(prev => {
      const currentJob = jobs.find(j => j.id === prev.job_id);
      const staffJobType = teamJobType(s);
      const jobOk = currentJob && (!staffJobType || currentJob.job_type === staffJobType);
      return { ...prev, staff_id: staffId, job_id: jobOk ? prev.job_id : '' };
    });
    if (staffId && formData.assigned_date) {
      setConflictWarnings(checkConflicts(staffId, formData.assigned_date, formData.vehicle_id));
    } else setConflictWarnings([]);
  };

  const handleJobChange = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    setFormData(prev => {
      const currentStaff = staff.find(s => s.id === prev.staff_id);
      const staffJobType = teamJobType(currentStaff);
      const staffOk = currentStaff && (!staffJobType || (job && job.job_type === staffJobType));
      return { ...prev, job_id: jobId, staff_id: staffOk ? prev.staff_id : '' };
    });
  };

  const selectedJob = jobs.find(j => j.id === formData.job_id);
  const selectedStaff = staff.find(s => s.id === formData.staff_id);
  const selectedStaffJobType = teamJobType(selectedStaff);
  const eligibleStaff = selectedJob
    ? staff.filter(s => { const tj = teamJobType(s); return !tj || tj === selectedJob.job_type || s.id === formData.staff_id; })
    : staff;
  const eligibleJobs = selectedStaff && selectedStaffJobType
    ? jobs.filter(j => j.job_type === selectedStaffJobType || j.id === formData.job_id)
    : jobs;

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
                {eligibleJobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
              </select>
              {selectedStaff && selectedStaffJobType && (
                <p className="text-[11px] text-slate-400 mt-1">Only {JOB_TYPE_LABELS[selectedStaffJobType]} jobs are shown for this staff member's team.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member *</label>
              <select value={formData.staff_id} onChange={(e) => handleStaffChange(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Staff</option>
                {eligibleStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {selectedJob && (
                <p className="text-[11px] text-slate-400 mt-1">Only staff in teams handling {JOB_TYPE_LABELS[selectedJob.job_type]} jobs can be assigned.</p>
              )}
              {formData.assigned_date && eligibleStaff.length > 0 && (() => {
                const date = formData.assigned_date;
                const dow = new Date(date + 'T00:00:00').getDay();
                const free = eligibleStaff.filter(s => {
                  if (existingRotas.some(r => r.staff_id === s.id && r.assigned_date === date && r.id !== assignment?.id)) return false;
                  if (recurring.some(r => r.staff_id === s.id && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow))) return false;
                  if (absences.some(a => a.staff_id === s.id && a.status === 'approved' && a.start_date <= date && a.end_date >= date)) return false;
                  return true;
                });
                return (
                  <p className="text-[11px] mt-1">
                    <span className="text-emerald-700 font-medium">{free.length} available</span>
                    <span className="text-slate-400"> · {eligibleStaff.length - free.length} busy/off</span>
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