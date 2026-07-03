import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

export default function AssignmentModal({ isOpen, onClose, assignment, defaultStaffId, defaultDate, weekStartStr, staff, jobs, vehicles, existingRotas }) {
  const [formData, setFormData] = useState({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '', start_time: '', end_time: '', notes: '' });
  const [conflictWarning, setConflictWarning] = useState(null);
  const queryClient = useQueryClient();

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
      setConflictWarning(null);
    }
  }, [isOpen, assignment, defaultStaffId, defaultDate]);

  if (!isOpen) return null;

  const checkConflict = (staffId, date) => {
    return existingRotas.some(r => r.staff_id === staffId && r.assigned_date === date && r.id !== assignment?.id);
  };

  const handleStaffChange = (staffId) => {
    setFormData(prev => ({ ...prev, staff_id: staffId }));
    if (staffId && formData.assigned_date) {
      setConflictWarning(checkConflict(staffId, formData.assigned_date) ? 'This staff member is already assigned on this date.' : null);
    } else setConflictWarning(null);
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, assigned_date: date }));
    if (date && formData.staff_id) {
      setConflictWarning(checkConflict(formData.staff_id, date) ? 'This staff member is already assigned on this date.' : null);
    } else setConflictWarning(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (checkConflict(formData.staff_id, formData.assigned_date)) {
      if (!confirm('This staff member is already assigned on this date. Add anyway?')) return;
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
              <select value={formData.job_id} onChange={(e) => setFormData({ ...formData, job_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Job</option>
                {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member *</label>
              <select value={formData.staff_id} onChange={(e) => handleStaffChange(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input type="date" value={formData.assigned_date} onChange={(e) => handleDateChange(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle</label>
              <select value={formData.vehicle_id} onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
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
          {conflictWarning && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {conflictWarning}
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button type="submit" className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
              {isEditing ? 'Update Assignment' : 'Add Assignment'}
            </button>
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