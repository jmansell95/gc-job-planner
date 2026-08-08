import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  FolderKanban, Loader2, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert,
  Calendar, AlertTriangle, CheckCircle2, Activity, PoundSterling, Clock,
} from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useAllJobsFinancials } from '@/hooks/useAllJobsFinancials';

const fmtGbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

// Project Health Dashboard — combines schedule progress, compliance status,
// risk flags and financials into one executive health score per project.
// Each project gets a health badge (green/amber/red) based on:
//   • Schedule — is the project on time or slipping?
//   • Compliance — any expired equipment or staff quals on active jobs?
//   • Financials — is margin positive and within budget?
export default function ProjectHealthDashboardWidget({ onNavigate }) {
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const { data: projects = [], isLoading: projLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-active'],
    queryFn: () => base44.entities.Job.filter({ status: 'in_progress' }),
  });
  const { data: assets = [] } = useQuery({
    queryKey: ['assets-all'],
    queryFn: () => base44.entities.SiteAsset.list(),
  });
  const { data: complianceItems = [] } = useQuery({
    queryKey: ['compliance-staff-all-health'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-active-health'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });
  const { data: allFin, isLoading: finLoading } = useAllJobsFinancials();

  const finMap = allFin?.finMap || {};
  const allJobs = allFin?.jobs || jobs;

  const jobsByProject = useMemo(() => {
    const map = {};
    allJobs.forEach((j) => { if (j.project_id) { (map[j.project_id] ||= []).push(j); } });
    return map;
  }, [allJobs]);

  const projectOptions = useMemo(
    () => projects.filter((p) => (jobsByProject[p.id] || []).length > 0),
    [projects, jobsByProject]
  );

  const effectiveProjectId = selectedProjectId || projectOptions[0]?.id || null;
  const project = projects.find((p) => p.id === effectiveProjectId);
  const projectJobs = jobsByProject[effectiveProjectId] || [];

  // ── Health calculations ──
  const health = useMemo(() => {
    if (!projectJobs.length) return null;

    // Financials
    let totalRevenue = 0, totalCost = 0, totalInvoiced = 0;
    projectJobs.forEach((j) => {
      const f = finMap[j.id] || {};
      totalRevenue += f.earned || f.revenue || 0;
      totalCost += f.cost || 0;
      totalInvoiced += f.invoiced || 0;
    });
    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const unbilled = totalRevenue - totalInvoiced;

    // Schedule — compare planned end vs today
    const today = new Date().toISOString().slice(0, 10);
    const overdueJobs = projectJobs.filter((j) => j.end_date && j.end_date < today && j.status !== 'completed');
    const onTrackJobs = projectJobs.filter((j) => !j.end_date || j.end_date >= today);

    // Compliance — check assets assigned to this project's jobs
    const projectJobIds = new Set(projectJobs.map((j) => j.id));
    const projectAssets = assets.filter((a) => a.is_active);
    const expiredAssets = projectAssets.filter((a) => a.compliance_status === 'expired');
    const expiringAssets = projectAssets.filter((a) => a.compliance_status === 'expiring');

    // Staff compliance — check staff assigned to this project's jobs
    const projectStaff = staff.filter((s) => s.is_active);
    const expiredStaffCompliance = complianceItems.filter((c) =>
      c.category === 'staff' && c.expiry_date && c.expiry_date < today
    );

    // Risk flags
    const risks = [];
    if (overdueJobs.length > 0) risks.push({ type: 'schedule', label: `${overdueJobs.length} job(s) past planned end date`, severity: 'amber' });
    if (expiredAssets.length > 0) risks.push({ type: 'compliance', label: `${expiredAssets.length} asset(s) with expired compliance`, severity: 'red' });
    if (margin < 0) risks.push({ type: 'financial', label: `Negative margin (${margin.toFixed(1)}%)`, severity: 'red' });
    if (unbilled > 10000) risks.push({ type: 'financial', label: `High unbilled revenue (${fmtGbp(unbilled)})`, severity: 'amber' });
    if (expiringAssets.length > 0) risks.push({ type: 'compliance', label: `${expiringAssets.length} asset(s) expiring soon`, severity: 'amber' });

    // Overall health score
    const hasRed = risks.some((r) => r.severity === 'red');
    const hasAmber = risks.some((r) => r.severity === 'amber');
    const healthStatus = hasRed ? 'at_risk' : hasAmber ? 'warning' : 'healthy';
    const healthScore = Math.max(0, 100 - risks.length * 15 - (hasRed ? 20 : 0));

    return {
      totalRevenue, totalCost, profit, margin, totalInvoiced, unbilled,
      overdueJobs: overdueJobs.length, onTrackJobs: onTrackJobs.length,
      expiredAssets: expiredAssets.length, expiringAssets: expiringAssets.length,
      expiredStaffCompliance: expiredStaffCompliance.length,
      risks, healthStatus, healthScore,
      jobCount: projectJobs.length,
    };
  }, [projectJobs, finMap, assets, staff, complianceItems]);

  if (projLoading || finLoading) {
    return (
      <WidgetShell title="Project Health" icon={Activity}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      </WidgetShell>
    );
  }

  if (!projectOptions.length) {
    return (
      <WidgetShell title="Project Health" icon={Activity}>
        <div className="text-center py-8 text-sm text-slate-400">
          No active projects with jobs yet.
        </div>
      </WidgetShell>
    );
  }

  const healthConfig = {
    healthy: { label: 'Healthy', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
    warning: { label: 'Warning', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: ShieldAlert },
    at_risk: { label: 'At Risk', color: 'red', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle },
  };

  const cfg = health ? healthConfig[health.healthStatus] : healthConfig.healthy;
  const HealthIcon = cfg.icon;

  return (
    <WidgetShell title="Project Health" icon={Activity}>
      {/* Project selector */}
      {projectOptions.length > 1 && (
        <div className="mb-3">
          <select
            value={effectiveProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-600"
          >
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {project && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <FolderKanban className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 truncate">{project.name}</h3>
          </div>
          {project.reference && (
            <p className="text-xs text-slate-500 ml-6 font-mono">{project.reference}</p>
          )}
        </div>
      )}

      {health && (
        <>
          {/* Health badge */}
          <div className={`flex items-center gap-2.5 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3 mb-3`}>
            <HealthIcon className={`w-5 h-5 ${cfg.text} flex-shrink-0`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{health.risks.length} risk flag(s) · {health.jobCount} active job(s)</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${cfg.text}`}>{health.healthScore}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">score</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <PoundSterling className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Revenue</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{fmtGbp(health.totalRevenue)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Cost</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{fmtGbp(health.totalCost)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Margin</p>
              </div>
              <p className={`text-sm font-bold ${health.margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {health.margin.toFixed(1)}%
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Unbilled</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{fmtGbp(health.unbilled)}</p>
            </div>
          </div>

          {/* Compliance row */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className={`rounded-lg p-2.5 border ${health.expiredAssets > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldAlert className={`w-3.5 h-3.5 ${health.expiredAssets > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Assets Expired</p>
              </div>
              <p className={`text-sm font-bold ${health.expiredAssets > 0 ? 'text-red-700' : 'text-slate-700'}`}>{health.expiredAssets}</p>
            </div>
            <div className={`rounded-lg p-2.5 border ${health.overdueJobs > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Calendar className={`w-3.5 h-3.5 ${health.overdueJobs > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Jobs Overdue</p>
              </div>
              <p className={`text-sm font-bold ${health.overdueJobs > 0 ? 'text-amber-700' : 'text-slate-700'}`}>{health.overdueJobs}</p>
            </div>
          </div>

          {/* Risk flags */}
          {health.risks.length > 0 && (
            <div className="space-y-1.5">
              {health.risks.map((r, i) => {
                const Icon = r.severity === 'red' ? AlertTriangle : ShieldAlert;
                const color = r.severity === 'red' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200';
                return (
                  <div key={i} className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-2 ${color}`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{r.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {health.risks.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>No risk flags — project is on track.</span>
            </div>
          )}
        </>
      )}
    </WidgetShell>
  );
}