import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Send, CheckCircle2, Ruler, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const TASK_SUGGESTIONS = [
  'Setting up the rig', 'Putting up heras fencing', 'Drilling',
  'Dismantling the rig', 'Site clearance', 'Machine maintenance', 'Breakdown',
];

const DURATION_CHIPS = [10, 15, 30, 60, 90, 120, 240];

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
};

export default function QuickTaskLog({ jobId, jobType, staffId, date }) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState('');
  const [mins, setMins] = useState('');
  const [meterage, setMeterage] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastLogged, setLastLogged] = useState(null);
  const queryClient = useQueryClient();

  const isDriller = jobType === 'cp_drilling' || jobType === 'rotary_drilling';
  const workDate = date || format(new Date(), 'yyyy-MM-dd');
  const minsNum = parseInt(mins) || 0;

  const reset = () => { setTask(''); setMins(''); setMeterage(''); setNotes(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!task.trim() || !minsNum) return;
    setSubmitting(true);
    try {
      await base44.entities.Timesheet.create({
        staff_id: staffId,
        job_id: jobId,
        date: workDate,
        task_description: task.trim(),
        task_duration_minutes: minsNum,
        total_hours: Math.round((minsNum / 60) * 100) / 100,
        meterage: isDriller ? (parseFloat(meterage) || 0) : 0,
        notes: notes.trim(),
        status: 'submitted'
      });
      setLastLogged({ task: task.trim(), mins: minsNum });
      reset();
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets-for-job'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      setOpen(false);
    } catch (err) {
      console.error('Error logging task:', err);
    }
    setSubmitting(false);
  };

  return (
    <div>
      {/* Toggle button + last logged confirmation */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => { setOpen(!open); if (open) reset(); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition text-sm font-semibold touch-manipulation">
          <Clock className="w-4 h-4" /> Log Time
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {lastLogged && (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
            <CheckCircle2 className="w-3.5 h-3.5" /> Logged {fmtDur(lastLogged.mins)} — {lastLogged.task}
          </span>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
          {/* Task description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">What did you do? *</label>
            <input type="text" value={task} onChange={e => setTask(e.target.value)} required
              placeholder="e.g. Putting up heras fencing"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TASK_SUGGESTIONS.map(s => (
                <button type="button" key={s} onClick={() => setTask(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${task === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700'}`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Time taken *</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DURATION_CHIPS.map(d => (
                <button type="button" key={d} onClick={() => setMins(String(d))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${minsNum === d ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400'}`}>{fmtDur(d)}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="1" step="1" value={mins} onChange={e => setMins(e.target.value)} required
                placeholder="Custom minutes"
                className="w-36 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              {minsNum > 0 && <span className="text-xs text-slate-500">= <b className="text-slate-700">{fmtDur(minsNum)}</b></span>}
            </div>
          </div>

          {/* Driller meterage */}
          {isDriller && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Ruler className="w-3 h-3 text-amber-600" /> Meterage drilled (m)</label>
              <input type="number" min="0" step="0.1" value={meterage} onChange={e => setMeterage(e.target.value)}
                placeholder="e.g. 12.5"
                className="w-36 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Anything else worth noting"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
              <Send className="w-3.5 h-3.5" /> {submitting ? 'Saving…' : 'Submit'}
            </button>
            <button type="button" onClick={() => { setOpen(false); reset(); }}
              className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition text-sm font-semibold">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}