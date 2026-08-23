import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Clock, CheckCircle2, PenLine, ShieldCheck,
  Merge, Loader2, Users,
} from 'lucide-react';
import { fmtDur, getWeekSignatures, computeWeekStatus } from '@/utils/timesheetHelpers';
import { entryMinutes } from '@/utils/overtime';

/**
 * Consolidated all-staff weekly summary table — one row per staff member
 * showing hours, OT, meterage, approval state, and signature status for
 * the selected week. Includes a "Merge All Ready Weeks" bulk action.
 */
export default function WeeklySummaryTable({ weeklyGroups, staff, jobs, otBreakdowns, weekStart, onMergeAll, merging }) {
  const [signaturesByStaff, setSignaturesByStaff] = useState({});

  // Fetch signatures for each staff member's week
  useEffect(() => {
    let alive = true;
    (async () => {
      const sigMap = {};
      for (const g of weeklyGroups) {
        const sigs = await getWeekSignatures(g.weekStart, g.staffId);
        sigMap[g.staffId] = sigs;
      }
      if (alive) setSignaturesByStaff(sigMap);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, weeklyGroups.map((g) => g.staffId).join(',')]);

  const readyToMergeCount = weeklyGroups.filter((g) => {
    const sigs = signaturesByStaff[g.staffId] || [];
    const status = computeWeekStatus(g.entries, sigs);
    return status.readyToMerge;
  }).length;

  if (weeklyGroups.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Users className="w-4 h-4 text-emerald-700" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Weekly Overview</h3>
          <p className="text-[11px] text-slate-500">{weeklyGroups.length} staff member{weeklyGroups.length !== 1 ? 's' : ''} · Week of {format(new Date(weekStart + 'T00:00:00'), 'dd MMM yyyy')}</p>
        </div>
        {readyToMergeCount > 0 && (
          <button
            onClick={onMergeAll}
            disabled={merging}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50 transition"
          >
            {merging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />}
            Merge All Ready Weeks ({readyToMergeCount})
          </button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] text-slate-400 uppercase font-medium tracking-wide">
              <th className="text-left px-4 py-2.5">Staff</th>
              <th className="text-right px-3 py-2.5">Hours</th>
              <th className="text-right px-3 py-2.5">OT</th>
              <th className="text-right px-3 py-2.5">Meterage</th>
              <th className="text-center px-3 py-2.5">Approval</th>
              <th className="text-center px-3 py-2.5">Staff Sig</th>
              <th className="text-center px-3 py-2.5">Manager Sig</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {weeklyGroups.map((g) => {
              const member = staff.find((s) => s.id === g.staffId);
              const sigs = signaturesByStaff[g.staffId] || [];
              const status = computeWeekStatus(g.entries, sigs);
              const counted = g.entries.filter((t) => t.status === 'approved' || t.status === 'merged' || t.is_weekly_summary);
              const totalMins = counted.reduce((s, t) => s + entryMinutes(t), 0);
              const otMins = counted.reduce((s, t) => s + (otBreakdowns[g.staffId]?.[t.id]?.otMins || 0), 0);
              const meterage = counted.reduce((s, t) => s + (Number(t.meterage) || 0), 0);

              return (
                <tr key={g.staffId} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-xs">{(member?.name || '?').charAt(0)}</span>
                      </div>
                      <span className="font-semibold text-slate-900 truncate">{member?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="text-right px-3 py-3 font-semibold text-slate-700 tabular-nums">{fmtDur(totalMins)}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{otMins > 0 ? <span className="text-amber-600 font-medium">{fmtDur(otMins)}</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="text-right px-3 py-3 tabular-nums">{meterage > 0 ? <span className="text-violet-600 font-medium">{meterage}m</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="text-center px-3 py-3">
                    <ApprovalBadge status={status} />
                  </td>
                  <td className="text-center px-3 py-3">
                    <SigBadge signed={status.staffSigned} label="Staff" />
                  </td>
                  <td className="text-center px-3 py-3">
                    <SigBadge signed={status.managerSigned} label="Manager" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-slate-100">
        {weeklyGroups.map((g) => {
          const member = staff.find((s) => s.id === g.staffId);
          const sigs = signaturesByStaff[g.staffId] || [];
          const status = computeWeekStatus(g.entries, sigs);
          const counted = g.entries.filter((t) => t.status === 'approved' || t.status === 'merged' || t.is_weekly_summary);
          const totalMins = counted.reduce((s, t) => s + entryMinutes(t), 0);
          const otMins = counted.reduce((s, t) => s + (otBreakdowns[g.staffId]?.[t.id]?.otMins || 0), 0);
          const meterage = counted.reduce((s, t) => s + (Number(t.meterage) || 0), 0);

          return (
            <div key={g.staffId} className="px-4 py-3">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-xs">{(member?.name || '?').charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500">{fmtDur(totalMins)}</span>
                    {otMins > 0 && <span className="text-xs text-amber-600 font-medium">OT {fmtDur(otMins)}</span>}
                    {meterage > 0 && <span className="text-xs text-violet-600 font-medium">{meterage}m</span>}
                  </div>
                </div>
                <ApprovalBadge status={status} />
              </div>
              <div className="flex items-center gap-2">
                <SigBadge signed={status.staffSigned} label="Staff" />
                <SigBadge signed={status.managerSigned} label="Manager" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApprovalBadge({ status }) {
  if (status.isMerged && status.managerSigned) {
    return <span className="inline-flex items-center gap-1 text-xs bg-emerald-700 text-white px-2.5 py-1 rounded-full font-semibold"><ShieldCheck className="w-3 h-3" /> Signed off</span>;
  }
  if (status.isMerged) {
    return <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold"><CheckCircle2 className="w-3 h-3" /> Merged</span>;
  }
  if (status.readyToMerge) {
    return <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold"><CheckCircle2 className="w-3 h-3" /> Ready to merge</span>;
  }
  if (status.hasSubmitted) {
    return <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold"><Clock className="w-3 h-3" /> Pending</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-semibold">Draft</span>;
}

function SigBadge({ signed, label }) {
  if (signed) {
    return <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium"><PenLine className="w-2.5 h-2.5" /> {label}</span>;
  }
  return <span className="inline-flex items-center gap-0.5 text-[10px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded-full font-medium">{label} —</span>;
}