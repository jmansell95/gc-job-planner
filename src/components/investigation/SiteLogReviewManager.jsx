import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Activity, Clock, CheckCircle2, AlertTriangle, Tablet, Edit2, X, Save,
  Send, Loader2, Calendar, User, FileText, RefreshCw, ChevronDown, ChevronRight
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

// Compare activities by clock order (not lexicographic — "7:30" must come
// after "08:45" but before "12:30"). Activities without a time sort last.
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

// SiteLogReviewManager — for drilling jobs, shows the AI-professionalised
// driller activities parsed from KeyLogBook remarks. Admins can edit each
// activity (description, times) before approving. Approving generates the
// timesheet automatically via the approveKeyLogBookLogs backend function.
export default function SiteLogReviewManager({ job, assignedStaff }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [approving, setApproving] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [expandedDays, setExpandedDays] = useState(new Set()); // collapsed by default

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

  // Driller remarks logs (the professionalised site activities)
  const remarksLogs = logs.filter(l => l.source === 'keylogbook_remarks');
  // Group by date
  const byDate = {};
  remarksLogs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = [];
    byDate[l.date].push(l);
  });
  const sortedDates = Object.keys(byDate).sort().reverse();

  const pendingCount = remarksLogs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const approvedCount = remarksLogs.filter(l => l.manager_review_status === 'approved').length;

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
    // Recalculate duration from start/end times
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
      toast({
        title: 'Site logs approved',
        description: res?.data?.message || `Timesheet generated for ${format(new Date(date + 'T00:00:00'), 'dd MMM')}.`,
      });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not approve logs. Please try again.', variant: 'destructive' });
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
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Tablet className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-indigo-900">Site Logs from KeyLogBook</p>
          <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
            These activities were automatically parsed and professionalised from your driller's KeyLogBook remarks. Review and edit each entry, then approve to generate the timesheet automatically.
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
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-400 uppercase font-medium">Activities</p>
              <p className="text-xl font-bold text-slate-800">{remarksLogs.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-400 uppercase font-medium">Pending</p>
              <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-400 uppercase font-medium">Approved</p>
              <p className="text-xl font-bold text-emerald-600">{approvedCount}</p>
            </div>
          </div>

          {/* Day groups */}
          {sortedDates.map(date => {
            const dayLogs = byDate[date].sort(byClockOrder);
            const dayPending = dayLogs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
            const dayTotalMins = dayLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
            const d = new Date(date + 'T00:00:00');
            const namedLog = dayLogs.find(l => l.staff_name || l.completed_by_name);
            const drillerName = namedLog?.staff_name || namedLog?.completed_by_name || '';

            return (
              <div key={date} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Day header — clickable to expand/collapse */}
                <button
                  onClick={() => toggleDay(date)}
                  className="w-full px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3 flex-wrap text-left hover:bg-slate-100/70 transition"
                >
                  <div className="flex items-center gap-2">
                    {expandedDays.has(date)
                      ? <ChevronDown className="w-4 h-4 text-slate-500" />
                      : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">{format(d, 'EEEE, dd MMM yyyy')}</span>
                  </div>
                  <span className="text-xs text-slate-400">{dayLogs.length} activities</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDur(dayTotalMins)}</span>
                  {drillerName && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      <User className="w-3 h-3" /> {drillerName}
                    </span>
                  )}
                  {dayPending > 0 ? (
                    <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {dayPending} pending review
                    </span>
                  ) : (
                    <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                  )}
                </button>

                {/* Activity list — collapsed by default */}
                {expandedDays.has(date) && (
                <div className="divide-y divide-slate-100">
                  {dayLogs.map(log => {
                    const isPending = (log.manager_review_status || 'pending') === 'pending';
                    const isEditing = editingId === log.id;

                    if (isEditing) {
                      return (
                        <div key={log.id} className="p-3.5 bg-amber-50/40">
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
                      );
                    }

                    return (
                      <div key={log.id} className="p-3.5 flex items-start gap-3">
                        <div className={`w-1.5 h-full min-h-[2.5rem] rounded-full flex-shrink-0 ${isPending ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                        <div className="min-w-0 flex-1">
                          {/* Time + status row */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {log.start_time || '—'}–{log.end_time || '—'}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs font-medium text-slate-500">{fmtDur(log.duration_minutes)}</span>
                            {(log.staff_name || log.completed_by_name) && (
                              <>
                                <span className="text-xs text-slate-400">·</span>
                                <span className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> {log.staff_name || log.completed_by_name}</span>
                              </>
                            )}
                            <RoleBadge role={log.logged_by_role} />
                            {isPending ? (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Pending
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                              </span>
                            )}
                            {isPending && (
                              <button onClick={() => handleEdit(log)}
                                className="ml-auto text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1 font-medium">
                                <Edit2 className="w-3 h-3" /> Edit
                              </button>
                            )}
                          </div>
                          {/* Description */}
                          <p className="text-sm text-slate-700 leading-relaxed">{log.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}

                {/* Approve button — only when expanded */}
                {dayPending > 0 && expandedDays.has(date) && (
                  <div className="px-4 py-3 bg-amber-50/40 border-t border-amber-100">
                    <button onClick={() => handleApproveDate(date)} disabled={approving}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                      {approving ? <><Loader2 className="w-4 h-4 animate-spin" /> Approving…</> : <><Send className="w-4 h-4" /> Approve & Generate Timesheet</>}
                    </button>
                    <p className="text-[11px] text-slate-500 text-center mt-1.5">
                      This will create draft timesheet entries for each approved activity.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}