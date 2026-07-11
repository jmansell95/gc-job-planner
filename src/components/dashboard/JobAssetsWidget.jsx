import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Cog, Wrench, Package, ArrowRight, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const assetTypeConfig = {
  rig: { icon: Cog, chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  machinery: { icon: Wrench, chip: 'bg-purple-50 text-purple-700 border-purple-200' },
  trailer: { icon: Package, chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  vehicle: { icon: Package, chip: 'bg-slate-50 text-slate-600 border-slate-200' },
};

function AssetChip({ type, name, status }) {
  const cfg = assetTypeConfig[type] || assetTypeConfig.machinery;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border ${cfg.chip}`}>
      <Icon className="w-3 h-3" />
      {name}
      {status === 'on_site' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
    </span>
  );
}

export default function JobAssetsWidget({ onSelectJob }) {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['job-asset-assignments-active'],
    queryFn: () => base44.entities.JobAssetAssignment.list('-assigned_date', 200),
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const activeAssignments = assignments.filter(a => a.status === 'assigned' || a.status === 'on_site');

  const byJob = {};
  activeAssignments.forEach(a => {
    if (!byJob[a.job_id]) byJob[a.job_id] = [];
    byJob[a.job_id].push(a);
  });

  const jobEntries = Object.entries(byJob)
    .map(([jobId, assets]) => ({ job: jobs.find(j => j.id === jobId), assets }))
    .filter(e => e.job)
    .sort((a, b) => (a.job.name || '').localeCompare(b.job.name || ''));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Boxes className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Job Assets</h2>
            <p className="text-xs text-slate-400">Rigs, machinery &amp; trailers on active jobs</p>
          </div>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{jobEntries.length} {jobEntries.length === 1 ? 'job' : 'jobs'}</span>
      </div>

      {isLoading ? (
        <div className="px-5 py-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : jobEntries.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          <Boxes className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          No rigs or equipment assigned to jobs yet
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 max-h-[480px] overflow-y-auto">
          {jobEntries.map(({ job, assets }) => {
            const rigs = assets.filter(a => a.asset_type === 'rig');
            const machinery = assets.filter(a => a.asset_type === 'machinery');
            const trailers = assets.filter(a => a.asset_type === 'trailer');
            return (
              <button key={job.id} onClick={() => onSelectJob(job)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-slate-50 transition cursor-pointer text-left group">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-slate-900 truncate flex-1">{job.name}</p>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0" />
                </div>
                {job.location && (
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1 mb-2">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {job.location}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {rigs.map(a => <AssetChip key={a.id} type="rig" name={a.asset_name} status={a.status} />)}
                  {machinery.map(a => <AssetChip key={a.id} type="machinery" name={a.asset_name} status={a.status} />)}
                  {trailers.map(a => <AssetChip key={a.id} type="trailer" name={a.asset_name} status={a.status} />)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}