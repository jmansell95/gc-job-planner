import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Drill } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { getTotalMetres } from '@/utils/geotechBilling';

/**
 * Borehole Progress — live drilling metreage vs targets for active jobs.
 * Shows a progress bar per job with drilled metres, target, and % complete.
 */
export default function BoreholeProgressWidget() {
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-borehole-progress'],
    queryFn: () => base44.entities.Job.list('-start_date', 50),
  });

  const drillingJobs = jobs.filter(j => j.status === 'in_progress' && j.meterage_target);

  const { data: invLogs = [] } = useQuery({
    queryKey: ['inv-logs-progress'],
    queryFn: () => base44.entities.InvestigationLog.list('-created_date', 200),
  });

  if (drillingJobs.length === 0) {
    return (
      <WidgetShell icon={Drill} title="Borehole Progress" subtitle="Live drilling metreage vs targets">
        <div className="text-center py-6 text-slate-400">
          <Drill className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">No active drilling jobs with metreage targets</p>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell icon={Drill} title="Borehole Progress" subtitle={`${drillingJobs.length} active drilling job${drillingJobs.length === 1 ? '' : 's'}`}>
      <div className="space-y-3.5">
        {drillingJobs.slice(0, 5).map(job => {
          const jobLogs = invLogs.filter(l => l.job_id === job.id);
          const drilled = getTotalMetres(jobLogs);
          const target = job.meterage_target || 0;
          const pct = target > 0 ? Math.min(100, Math.round((drilled / target) * 100)) : 0;
          return (
            <div key={job.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 truncate">{job.name}</p>
                <span className="text-xs font-bold text-slate-600 tabular-nums flex-shrink-0">{drilled}m / {target}m</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2E5A1A, #8DC63F)' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{pct}% complete</span>
                {pct >= 100 && <span className="text-[11px] font-bold text-emerald-600">Target reached</span>}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}