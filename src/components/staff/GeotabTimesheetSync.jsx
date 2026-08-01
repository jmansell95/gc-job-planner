import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Navigation2, MapPin, Navigation, NavigationOff, Edit2, Check, Loader2, AlertCircle } from 'lucide-react';

/**
 * GeotabTimesheetSync — shows auto-detected timesheet entries from
 * Geotab GPS data inside the Schedule Splash. Staff can see the
 * detected travel-to / on-site / travel-home times and edit them
 * if needed. Entries are created by the syncGeotabTimesheets backend
 * function (triggered by admins or a scheduled automation).
 */
export default function GeotabTimesheetSync({ staff, jobs, date }) {
  const [autoTimesheets, setAutoTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValues, setEditValues] = useState({});

  useEffect(() => {
    if (!staff?.id) { setLoading(false); return; }
    (async () => {
      try {
        const all = await base44.entities.Timesheet.filter({ staff_id: staff.id, date });
        setAutoTimesheets(all.filter(t => t.source === 'geotab_auto'));
      } catch (e) {
        console.error('Error loading Geotab timesheets:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [staff?.id, date]);

  // Group by job_id → task_type
  const byJob = {};
  for (const t of autoTimesheets) {
    if (!byJob[t.job_id]) byJob[t.job_id] = {};
    byJob[t.job_id][t.task_type] = t;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-100 py-2 px-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking GPS data…
      </div>
    );
  }

  if (autoTimesheets.length === 0) return null;

  const handleSave = async (ts) => {
    try {
      const start = editValues.start_time || ts.start_time;
      const end = editValues.end_time || ts.end_time;
      // Recalculate duration from edited times
      let duration = ts.task_duration_minutes;
      if (start && end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        duration = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      }
      await base44.entities.Timesheet.update(ts.id, {
        start_time: start,
        end_time: end,
        task_duration_minutes: duration,
        total_hours: duration / 60,
      });
      setAutoTimesheets(prev => prev.map(t => t.id === ts.id ? { ...t, start_time: start, end_time: end, task_duration_minutes: duration, total_hours: duration / 60 } : t));
      setEditing(null);
    } catch (e) {
      console.error('Error updating timesheet:', e);
    }
  };

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100 px-1">
        <Navigation2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Auto-detected from vehicle GPS (Geotab)</span>
        <span className="text-[10px] text-emerald-200/70 font-normal italic">— tap ✎ to adjust</span>
      </div>
      {Object.entries(byJob).map(([jobId, entries]) => {
        const job = jobs.find(j => j.id === jobId);
        const travelTo = entries.travel_to;
        const onSite = entries.on_site;
        const travelFrom = entries.travel_from;
        return (
          <div key={jobId} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 ring-1 ring-white/15">
            <p className="text-sm font-semibold text-white mb-2 truncate">{job?.name || 'Unknown job'}</p>
            <div className="space-y-1.5">
              {travelTo && (
                <TimesheetRow label="Travel to site" icon={Navigation} entry={travelTo} editing={editing} setEditing={setEditing} editValues={editValues} setEditValues={setEditValues} onSave={handleSave} />
              )}
              {onSite && (
                <TimesheetRow label="On site" icon={MapPin} entry={onSite} editing={editing} setEditing={setEditing} editValues={editValues} setEditValues={setEditValues} onSave={handleSave} />
              )}
              {travelFrom && (
                <TimesheetRow label="Travel home" icon={NavigationOff} entry={travelFrom} editing={editing} setEditing={setEditing} editValues={editValues} setEditValues={setEditValues} onSave={handleSave} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimesheetRow({ label, icon: Icon, entry, editing, setEditing, editValues, setEditValues, onSave }) {
  const isEditing = editing === entry.id;
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-emerald-200 flex-shrink-0" />
      <span className="text-xs text-emerald-100 w-20 flex-shrink-0">{label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <input type="time" value={editValues.start_time ?? entry.start_time ?? ''} onChange={e => setEditValues(v => ({ ...v, start_time: e.target.value }))} className="px-1.5 py-1 text-xs rounded bg-white/20 text-white border-0 focus:outline-none focus:ring-1 focus:ring-emerald-400 min-w-0" />
          <span className="text-white/50 text-xs flex-shrink-0">→</span>
          <input type="time" value={editValues.end_time ?? entry.end_time ?? ''} onChange={e => setEditValues(v => ({ ...v, end_time: e.target.value }))} className="px-1.5 py-1 text-xs rounded bg-white/20 text-white border-0 focus:outline-none focus:ring-1 focus:ring-emerald-400 min-w-0" />
          <button onClick={() => onSave(entry)} className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-xs text-white font-mono truncate">{entry.start_time || '—'} → {entry.end_time || '—'}</span>
          <button onClick={() => { setEditing(entry.id); setEditValues({ start_time: entry.start_time || '', end_time: entry.end_time || '' }); }} className="p-1 rounded hover:bg-white/15 text-emerald-200 flex-shrink-0">
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}