import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, Send, CheckCircle2 } from 'lucide-react';

export default function TimesheetEntry({ assignment, jobId, staffId }) {
  const [showForm, setShowForm] = useState(false);
  const [startTime, setStartTime] = useState(
    assignment?.started_at ? new Date(assignment.started_at).toTimeString().slice(0, 5) : '07:30'
  );
  const [endTime, setEndTime] = useState(
    assignment?.completed_at ? new Date(assignment.completed_at).toTimeString().slice(0, 5) : '17:00'
  );
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [meterage, setMeterage] = useState(assignment?.meterage || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const calcHours = () => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm) - (parseInt(breakMinutes) || 0);
    if (mins < 0) mins += 24 * 60;
    return Math.round((mins / 60) * 10) / 10;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await base44.entities.Timesheet.create({
        staff_id: staffId,
        job_id: jobId,
        date: assignment.assigned_date,
        start_time: startTime,
        end_time: endTime,
        break_minutes: parseInt(breakMinutes) || 0,
        total_hours: calcHours(),
        meterage: parseFloat(meterage) || 0,
        notes,
        status: 'submitted'
      });
      setSubmitted(true);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    } catch (error) {
      console.error('Error submitting timesheet:', error);
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4" />
        <span className="font-medium">Timesheet submitted ({calcHours()}h)</span>
      </div>
    );
  }

  return (
    <div>
      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Break (mins)</label>
              <input type="number" value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)} min="0" step="15"
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Total Hours</label>
              <div className="px-2 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-bold text-emerald-700">
                {calcHours()}h
              </div>
            </div>
          </div>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes"
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-50">
              <Send className="w-3.5 h-3.5" /> {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm font-medium w-full sm:w-auto">
          <Clock className="w-4 h-4" /> Submit Timesheet
        </button>
      )}
    </div>
  );
}