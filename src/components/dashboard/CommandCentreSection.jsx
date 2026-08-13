import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Radar, TrendingUp, AlertTriangle, Activity, PoundSterling, Gauge, ArrowRight } from 'lucide-react';
import StateMonitorBar from '@/components/dashboard/StateMonitorBar';

/**
 * CommandCentreSection — merges the live stat tiles (Active Jobs, Crew
 * Utilisation, etc.) with a redesigned Mission Control strip into one
 * cohesive command centre at the top of the dashboard.
 */
export default function CommandCentreSection({ monitors, onNavigate }) {
  const { data: jobs = [] } = useQuery({ queryKey: ['mc-jobs'], queryFn: () => base44.entities.Job.list('-updated_date', 200) });
  const { data: invoices = [] } = useQuery({ queryKey: ['mc-invoices'], queryFn: () => base44.entities.Invoice.list('-created_date', 50) });
  const { data: timesheets = [] } = useQuery({ queryKey: ['mc-timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 50) });
  const { data: safetyReports = [] } = useQuery({ queryKey: ['mc-safety'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }) });

  const m = useMemo(() => {
    const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
    const totalBudget = activeJobs.reduce((s, j) => s + (Number(j.budget_amount) || 0), 0);
    const totalActualCost = activeJobs.reduce((s, j) => s + (Number(j.actual_cost) || 0), 0);
    const burnRate = totalBudget > 0 ? Math.round((totalActualCost / totalBudget) * 100) : 0;
    const pendingInvoices = invoices.filter(i => i.status === 'draft' || i.status === 'sent').length;
    const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
    const totalInvoiceValue = invoices
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const pendingTs = timesheets.filter(t => t.status === 'submitted').length;
    const openSafety = safetyReports.length;
    const criticalSafety = safetyReports.filter(r => r.severity === 'critical' || r.severity === 'high').length;

    const issues = [];
    if (overdueInvoices > 0) issues.push(`${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''}`);
    if (criticalSafety > 0) issues.push(`${criticalSafety} critical safety item${criticalSafety > 1 ? 's' : ''}`);
    if (pendingTs > 5) issues.push(`${pendingTs} timesheets awaiting approval`);
    if (burnRate > 80) issues.push(`Burn rate at ${burnRate}%`);

    const status = issues.filter((_, i) => i).length > 0 && (overdueInvoices > 0 || criticalSafety > 0) ? 'critical' : issues.length > 0 ? 'warning' : 'healthy';

    return { burnRate, pendingInvoices, overdueInvoices, totalInvoiceValue, pendingTs, openSafety, criticalSafety, activeJobs: activeJobs.length, totalJobs: jobs.length, issues, status };
  }, [jobs, invoices, timesheets, safetyReports]);

  const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';
  const isHealthy = m.status === 'healthy';
  const isWarning = m.status === 'warning';
  const healthColor = isHealthy ? 'emerald' : isWarning ? 'amber' : 'rose';
  const healthLabel = isHealthy ? 'All Systems Operational' : isWarning ? 'Minor Issues Detected' : 'Critical Attention Required';

  const burnColor = m.burnRate > 80 ? 'bg-rose-400' : m.burnRate > 60 ? 'bg-amber-400' : 'bg-emerald-400';
  const burnText = m.burnRate > 80 ? 'text-rose-300' : m.burnRate > 60 ? 'text-amber-300' : 'text-emerald-300';

  return (
    <div className="mb-4 space-y-2.5">
      {/* Stat tiles */}
      <StateMonitorBar monitors={monitors} onNavigate={onNavigate} />

      {/* Mission Control strip — dark gradient bar that flows from the stat tiles */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1a3a0e] via-[#2E5A1A] to-[#1c4a12] shadow-lg ring-1 ring-[#8DC63F]/20">
        {/* Decorative sheen */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 px-4 py-3.5 flex items-center gap-4 flex-wrap">
          {/* System health indicator */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isHealthy ? 'bg-emerald-500/30 ring-1 ring-emerald-400/40' : isWarning ? 'bg-amber-500/30 ring-1 ring-amber-400/40' : 'bg-rose-500/30 ring-1 ring-rose-400/40'}`}>
              {isHealthy ? <Activity className="w-5 h-5 text-emerald-300" /> : <AlertTriangle className="w-5 h-5 text-amber-300" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5 text-[#8DC63F]" />
                <p className="text-xs font-bold text-[#8DC63F] uppercase tracking-wide">Mission Control</p>
              </div>
              <p className="text-sm font-bold text-white truncate">{healthLabel}</p>
              {m.issues.length > 0 && (
                <p className="text-[11px] text-white/60 truncate">{m.issues.join(' · ')}</p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-10 w-px bg-white/15 flex-shrink-0" />

          {/* Inline metrics */}
          <div className="flex items-center gap-4 sm:gap-5 flex-wrap flex-1 min-w-0">
            {/* Burn Rate */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Gauge className="w-4 h-4 text-white/80" />
              </div>
              <div>
                <p className={`text-lg font-bold tabular-nums leading-none ${burnText}`}>{m.burnRate}%</p>
                <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wide mt-0.5">Burn Rate</p>
                <div className="mt-1 w-16 h-1 bg-white/15 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${burnColor}`} style={{ width: `${Math.min(m.burnRate, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Outstanding Revenue */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <PoundSterling className="w-4 h-4 text-white/80" />
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-white leading-none">{gbp(m.totalInvoiceValue)}</p>
                <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wide mt-0.5">Outstanding</p>
                <p className="text-[10px] text-white/40 mt-0.5">{m.pendingInvoices} pending · {m.overdueInvoices} overdue</p>
              </div>
            </div>

            {/* Safety Status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-white/80" />
              </div>
              <div>
                <p className={`text-lg font-bold tabular-nums leading-none ${m.criticalSafety > 0 ? 'text-rose-300' : 'text-white'}`}>{m.openSafety}</p>
                <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wide mt-0.5">Open Safety</p>
                <p className="text-[10px] text-white/40 mt-0.5">{m.criticalSafety > 0 ? `${m.criticalSafety} critical` : 'No critical items'}</p>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
            <button onClick={() => onNavigate?.('jobs')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition active:scale-95">
              Jobs <ArrowRight className="w-3 h-3" />
            </button>
            <button onClick={() => onNavigate?.('billing')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition active:scale-95">
              Billing <ArrowRight className="w-3 h-3" />
            </button>
            <button onClick={() => onNavigate?.('compliance')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition active:scale-95">
              Safety <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}