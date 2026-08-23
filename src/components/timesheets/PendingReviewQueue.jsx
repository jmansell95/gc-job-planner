import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Clock, CheckCircle2, XCircle, TrendingUp, Car, ShieldCheck, Loader2,
  PenLine, AlertTriangle, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';
import { entryMinutes } from '@/utils/overtime';
import { fmtDur, getWeekSignatures } from '@/utils/timesheetHelpers';

/**
 * Pending Review Queue — shows all staff weeks that have submitted timesheet
 * entries for the selected week, grouped by staff member. Shows staff-signed
 * status and lets the manager approve individual days or the whole week.
 */
export default function PendingReviewQueue({ timesheets, staff, jobs, otBreakdowns, currentUser, weekStart }) {
  const queryClient = useQueryClient();
  const [expandedStaff, setExpandedStaff] = useState(new Set());
  const [approvingId, setApprovingId] = useState(null);
  const [signaturesByStaff, setSignaturesByStaff] = useState({});
  const [bulkApproving, setBulkApproving] = useState(false);

  // Get all submitted entries for this week
  const submittedEntries = timesheets.filter(
    (t) => t.status === 'submitted' && t.week_start === weekStart
  );

  // Group by staff
  const byStaff = {};
  submittedEntries.forEach((t) => {
    if (!byStaff[t.staff_id]) byStaff[t.staff_id] = [];
    byStaff[t.staff_id].push(t);
  });

  const staffIds = Object.keys(byStaff);

  // Fetch signatures for each staff member's week
  useEffect(() => {
    let alive = true;
    (async () => {
      const sigMap = {};
      for (const sid of staffIds) {
        const sigs = await getWeekSignatures(weekStart, sid);
        sigMap[sid] = sigs;
      }
      if (alive) setSignaturesByStaff(sigMap);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, staffIds.join(',')]);

  const toggleStaff = (sid) => {
    setExpandedStaff((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const handleApprove = async (id) => {
    setApprovingId(id);
    try {
      await base44.entities.Timesheet.update(id, { status: 'approved', approved_by_name: currentUser?.full_name || '' });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
    } catch { /* bubble */ }
    setApprovingId(null);
  };

  const handleReject = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
  };

  const handleApproveAllForStaff = async (sid) => {
    const entries = byStaff[sid] || [];
    if (entries.length === 0) return;
    setBulkApproving(true);
    try {
      await base44.entities.Timesheet.bulkUpdate(
        entries.map((t) => ({ id: t.id, status: 'approved', approved_by_name: currentUser?.full_name || '' }))
      );
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
    } catch { /* bubble */ }
    setBulkApproving(false);
  };

  if (staffIds.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Zap className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Pending Review</h3>
        </div>
        <p className="text-sm text-slate-400 text-center py-4">
          No timesheets awaiting approval this week. Green-path auto-approval handles routine days automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
          <Clock className="w-4 h-4 text-amber-700" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Pending Review</h3>
          <p className="text-[11px] text-slate-500">{staffIds.length} staff member{staffIds.length !== 1 ? 's' : ''} with submitted timesheets</p>
        </div>
        <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">
          {submittedEntries.length} day{submittedEntries.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {staffIds.map((sid) => {
          const member = staff.find((s) => s.id === sid);
          const entries = byStaff[sid].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
          const sigs = signaturesByStaff[sid] || [];
          const staffSigned = !!sigs.find((s) => s.tier === 'daily_worker');
          const isExpanded = expandedStaff.has(sid);
          const totalMins = entries.reduce((s, t) => s + entryMinutes(t), 0);

          return (
            <div key={sid}>
              {/* Staff header */}
              <button
                onClick={() => toggleStaff(sid)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50/80 transition text-left"
              >
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-sm">{(member?.name || '?').charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400">{entries.length} day{entries.length !== 1 ? 's' : ''} · {fmtDur(totalMins)}</span>
                    {staffSigned && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                        <PenLine className="w-2.5 h-2.5" /> Staff signed
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold flex-shrink-0">
                  {entries.length} pending
                </span>
              </button>

              {/* Expanded entries */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {entries.map((t) => {
                    const job = jobs.find((j) => j.id === t.job_id);
                    const ot = otBreakdowns[sid]?.[t.id] || {};
                    const mins = entryMinutes(t);
                    return (
                      <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                        <div className="flex flex-col items-center flex-shrink-0 w-12">
                          <span className="text-xs font-bold text-slate-700">{format(new Date(t.date + 'T00:00:00'), 'EEE')}</span>
                          <span className="text-[10px] text-slate-400">{format(new Date(t.date + 'T00:00:00'), 'dd MMM')}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{job?.name || '—'}</p>
                          {t.is_summary ? (
                            <p className="text-xs text-slate-500 truncate">Daily summary{t.notes ? ` · ${t.notes.slice(0, 60)}` : ''}</p>
                          ) : (
                            <p className="text-xs text-slate-500 truncate">{t.task_description || '—'}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                            <span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />{fmtDur(mins)}</span>
                            {t.on_site_minutes > 0 && <span>On-site {fmtDur(t.on_site_minutes)}</span>}
                            {(t.travel_to_minutes > 0 || t.travel_from_minutes > 0) && (
                              <span className="inline-flex items-center gap-0.5"><Car className="w-3 h-3" />{fmtDur((t.travel_to_minutes || 0) + (t.travel_from_minutes || 0))}</span>
                            )}
                            {ot.isOvertime && <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium"><TrendingUp className="w-3 h-3" />{fmtDur(ot.otMins)} ×{ot.multiplier}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleApprove(t.id)}
                            disabled={approvingId === t.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                          >
                            {approvingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(t.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Approve all */}
                  <button
                    onClick={() => handleApproveAllForStaff(sid)}
                    disabled={bulkApproving}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition text-xs font-semibold disabled:opacity-50"
                  >
                    {bulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Approve all {entries.length} days for {member?.name?.split(' ')[0] || 'staff'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}