import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Users, ShieldAlert, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { computeJobWarnings } from '@/utils/jobWarnings';

const severityStyles = {
  critical: {
    container: 'bg-red-50 border-red-200',
    iconBg: 'bg-red-100 text-red-600',
    title: 'text-red-900',
    body: 'text-red-700',
    badge: 'bg-red-600 text-white',
    label: 'Critical'
  },
  warning: {
    container: 'bg-amber-50 border-amber-200',
    iconBg: 'bg-amber-100 text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-700',
    badge: 'bg-amber-500 text-white',
    label: 'Warning'
  },
  info: {
    container: 'bg-blue-50 border-blue-200',
    iconBg: 'bg-blue-100 text-blue-600',
    title: 'text-blue-900',
    body: 'text-blue-700',
    badge: 'bg-blue-600 text-white',
    label: 'Info'
  }
};

const iconFor = (key) => {
  switch (key) {
    case 'users': return Users;
    case 'shield': return ShieldAlert;
    case 'wrench': return Wrench;
    default: return AlertTriangle;
  }
};

export default function JobWarningsBanner({ job, assignedStaffCount = 0 }) {
  const { data: costItems = [] } = useQuery({
    queryKey: ['job-cost-items-warnings', job.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id })
  });
  const { data: rateCardItems = [] } = useQuery({
    queryKey: ['rate-card-items-warnings'],
    queryFn: () => base44.entities.RateCardItem.list('-created_date', 500)
  });
  const { data: siteAssets = [] } = useQuery({
    queryKey: ['site-assets-warnings'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500)
  });

  const [expanded, setExpanded] = React.useState(false);

  const warnings = computeJobWarnings({ job, costItems, rateCardItems, siteAssets, assignedStaffCount });

  if (warnings.length === 0) return null;

  const criticalCount = warnings.filter(w => w.severity === 'critical').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;

  const visible = expanded ? warnings : warnings.slice(0, 2);

  return (
    <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-amber-50/40 p-4 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 text-sm">
            {criticalCount > 0 ? `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}` : ''}
            {criticalCount > 0 && warningCount > 0 ? ' · ' : ''}
            {warningCount > 0 ? `${warningCount} warning${warningCount > 1 ? 's' : ''}` : ''}
            {criticalCount === 0 && warningCount === 0 ? 'Attention needed' : ''}
          </h3>
          <p className="text-[11px] text-slate-500">Review before deploying to site</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {criticalCount > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">{criticalCount} CRITICAL</span>}
          {warningCount > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">{warningCount}</span>}
        </div>
      </div>

      <div className="space-y-2">
        {visible.map((w, idx) => {
          const s = severityStyles[w.severity] || severityStyles.warning;
          const Icon = iconFor(w.icon);
          return (
            <div key={idx} className={`flex items-start gap-2.5 rounded-xl border p-3 ${s.container}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${s.title}`}>{w.title}</p>
                <p className={`text-xs mt-0.5 ${s.body}`}>{w.message}</p>
              </div>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide flex-shrink-0 ${s.badge}`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {warnings.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 transition"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Show fewer</> : <><ChevronDown className="w-3.5 h-3.5" /> Show {warnings.length - 2} more</>}
        </button>
      )}
    </div>
  );
}