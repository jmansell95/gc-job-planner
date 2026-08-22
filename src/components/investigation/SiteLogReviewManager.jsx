import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Activity, Clock, CheckCircle2, AlertTriangle, Tablet, Edit2, X, Save,
  Send, Loader2, Calendar, User, FileText, ChevronDown, ChevronRight, MapPin, RotateCcw
} from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';
import { RoleBadge } from '@/components/financials/AutoFinancialsBreakdown';

function fmtDur(mins) {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
}

function timeToMins(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}
function byClockOrder(a, b) {
  const av = timeToMins(a.start_time);
  const bv = timeToMins(b.start_time);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return av - bv;
}

export default function SiteLogReviewManager({ job, assignedStaff }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [approving, setApproving] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [expandedDays, setExpandedDays] = useState(new Set());

  const toggleDay = (date) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  const remarksLogs = logs.filter(l => l.source === 'keylogbook_remarks');
  const byDate = {};
  remarksLogs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = [];
    byDate[l.date].push(l);
  });
  const sortedDates = Object.keys(byDate).sort().reverse();

  const pendingCount = remarksLogs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const approvedCount = remarksLogs.filter(l => l.manager_review_status === 'approved').length;
  const totalMinutes = remarksLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);

  const handleEdit = (log) => {
    setEditingId(log.id);
    setEditForm({
      start_time: log.start_time || '',
      end_time: log.end_time || '',
      description: log.description || '',
    });
  };

  const handleSave = async (logId) => {
    setSavingId(logId);
    let durationMins = 0;
    if (editForm.start_time && editForm.end_time) {
      const [sh, sm] = editForm.start_time.split(':').map(Number);
      const [eh, em] = editForm.end_time.split(':').map(Number);
      durationMins = (eh * 60 + em) - (sh * 60 + sm);
      if (durationMins < 0) durationMins = 0;
    }
    try {
      await base44.entities.InvestigationLog.update(logId, {
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        duration_minutes: durationMins,
        description: editForm.description,
      });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', job.id] });
      toast({ title: 'Log updated', description: 'Your edits have been saved.' });
      setEditingId(null);
    } catch (e) {
      toast({ title: 'Error', description: 'Could not save the edit.', variant: 'destructive' });
    }
    setSavingId(null);
  };

  const handleApproveDate = async (date) => {
    setApproving(true);
    try {
      const res = await base44.functions.invoke('approveKeyLogBookLogs', { job_id: job.id, date });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', job.id] });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast({
        title: 'Timesheet re-generated',
        description: res?.data?.message || `Timesheet re-generated for ${format(new Date(date + 'T00:00:00'), 'dd MMM')}.`,
      });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not re-generate timesheet. Please try again.', variant: 'destructive' });
    }
    setApproving(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Tablet className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-emerald-900">Site Logs from KeyLogBook — Auto-Approved</p>
          <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
            These activities were automatically parsed, professionalised, and auto-priced from your driller's KeyLogBook remarks. A daily summary timesheet is generated automatically when the data arrives. You can still edit any entry and re-generate the timesheet if needed.
          </p>
        </div>
      </div>

      {remarksLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <EmptyState
            icon={Activity}
            title="No site logs yet"
            message="Site activities will appear here automatically when your driller saves their daily remarks in KeyLogBook and the data syncs via the webhook."
          />
        </div>
      ) : (
        <>
          {/* Summary mini-stats */}
          <div className="grid grid-cols-4 gap-2">
            <MiniStat label="Activities" value={remarksLogs.length} tone="slate" />
            <MiniStat label="Approved" value={approvedCount} tone="emerald" />
            <MiniStat label="Auto-Priced" value={remarksLogs.filter(l => l.chargeable).length} tone="amber" />
            <MiniStat label="Total Time" value={fmtDur(totalMinutes)} tone="indigo" />
          </div>

          {/* Vertical timeline */}
          <div className="relative pl-7">
            {/* Main timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-400 via-slate-200 to-slate-100" />

            {sortedDates.map(date => {
              const dayLogs = byDate[date].sort(byClockOrder);
              const dayPending = dayLogs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
              const dayTotalMins = dayLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
              const d = new Date(date + 'T00:00:00');
              const namedLog = dayLogs.find(l => l.staff_name || l.completed_by_name);
              const drillerName = namedLog?.staff_name || namedLog?.completed_by_name || '';
              const isExpanded = expandedDays.has(date);

              return (
                <div key={date} className="relative mb-4">
                  {/* Date node */}
                  <div className={`absolute -left-[22px] top-3 w-4 h-4 rounded-full border-2 border-white shadow z-10 ${dayPending > 0 ? 'bg-amber-500' : 'bg-emerald-600'}`} />

                  {/* Day card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Day header */}
                    <button
                      onClick={() => toggleDay(date)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center gap-3 flex-wrap text-left hover:from-slate-100 transition"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-slate-500" />
                          : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-800">{format(d, 'EEEE, dd MMM yyyy')}</span>
                      </div>
                      <span className="text-xs text-slate-400">{dayLogs.length} {dayLogs.length === 1 ? 'activity' : 'activities'}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDur(dayTotalMins)}</span>
                      {drillerName && (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          <User className="w-3 h-3" /> {drillerName}
                        </span>
                      )}
                      <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-Approved
                      </span>
                    </button>

                    {/* Activity timeline — inside the day */}
                    {isExpanded && (
                      <div className="relative px-4 py-3">
                        {/* Inner vertical line */}
                        <div className="absolute left-[22px] top-3 bottom-3 w-0.5 bg-slate-100" />

                        <div className="space-y-2.5">
                          {dayLogs.map(log => {
                            const isPending = (log.manager_review_status || 'pending') === 'pending';
                            const isEditing = editingId === log.id;

                            if (isEditing) {
                              return (
                                <div key={log.id} className="relative pl-6">
                                  <div className="absolute left-[2px] top-3 w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow z-10" />
                                  <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                                      <p className="text-xs font-bold text-amber-800">Editing activity</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                      <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Start time</label>
                                        <input type="time" value={editForm.start_time} onChange={e => setEditForm({ ...editForm, start_time: e.target.value })}
                                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white" />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">End time</label>
                                        <input type="time" value={editForm.end_time} onChange={e => setEditForm({ ...editForm, end_time: e.target.value })}
                                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white" />
                                      </div>
                                    </div>
                                    <div className="mb-2">
                                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Description</label>
                                      <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={2}
                                        className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white resize-none" />
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => handleSave(log.id)} disabled={savingId === log.id}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold disabled:opacity-50">
                                        {savingId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                                      </button>
                                      <button onClick={() => setEditingId(null)} disabled={savingId === log.id}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-xs font-semibold">
                                        <X className="w-3.5 h-3.5" /> Cancel
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={log.id} className="relative pl-6">
                                {/* Activity node */}
                                <div className={`absolute left-[2px] top-3.5 w-3 h-3 rounded-full border-2 border-white shadow z-10 ${isPending ? 'bg-amber-400' : 'bg-emerald-500'}`} />

                                {/* Activity card */}
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 hover:shadow-sm transition">
                                  {/* Time + status row */}
                                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <span className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm">
                                      {log.start_time || '—'} – {log.end_time || '—'}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {fmtDur(log.duration_minutes)}
                                    </span>
                                    {(log.staff_name || log.completed_by_name) && (
                                      <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <User className="w-3 h-3" /> {log.staff_name || log.completed_by_name}
                                      </span>
                                    )}
                                    <RoleBadge role={log.logged_by_role} />
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                                    </span>
                                    {log.chargeable && log.charge_amount && (
                                      <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                        £{Number(log.charge_amount).toFixed(0)}
                                      </span>
                                    )}
                                    <button onClick={() => handleEdit(log)}
                                      className="ml-auto text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1 font-medium">
                                      <Edit2 className="w-3 h-3" /> Edit
                                    </button>
                                  </div>
                                  {/* Description */}
                                  <p className="text-sm text-slate-700 leading-relaxed">{log.description}</p>
                                  {/* Extra metadata */}
                                  {(log.borehole_ref || log.manager_reviewed_by) && (
                                    <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[10px] text-slate-400">
                                      {log.borehole_ref && (
                                        <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {log.borehole_ref}</span>
                                      )}
                                      {log.manager_reviewed_by && (
                                        <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Reviewed by {log.manager_reviewed_by}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Re-generate timesheet button */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100">
                        <button onClick={() => handleApproveDate(date)} disabled={approving}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-800 active:scale-[0.98] transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                          {approving ? <><Loader2 className="w-4 h-4 animate-spin" /> Re-generating…</> : <><RotateCcw className="w-4 h-4" /> Re-generate Timesheet</>}
                        </button>
                        <p className="text-[11px] text-slate-500 text-center mt-1.5">
                          Re-creates the daily summary timesheet from these activities (use after editing).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const tones = {
    slate: 'text-slate-700',
    amber: 'text-amber-600',
    emerald: 'text-emerald-700',
    indigo: 'text-indigo-700',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-2 py-2.5 text-center shadow-sm">
      <p className="text-[9px] text-slate-400 uppercase font-medium tracking-wide">{label}</p>
      <p className={`text-base font-bold tabular-nums ${tones[tone] || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}