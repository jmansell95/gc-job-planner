import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Cog, MapPin, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const complianceBadge = {
  compliant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expiring: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  unknown: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function RigTrackerWidget({ onSelectJob }) {
  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['job-asset-assignments-all'],
    queryFn: () => base44.entities.JobAssetAssignment.list('-assigned_date', 200),
  });

  const { data: assets = [] } = useQuery({ queryKey: ['site-assets'], queryFn: () => base44.entities.SiteAsset.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const rigAssignments = allAssignments.filter(a =>
    a.asset_type === 'rig' && (a.status === 'assigned' || a.status === 'on_site')
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Cog className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Rig Locations</h2>
            <p className="text-xs text-slate-400">Rigs currently deployed to sites</p>
          </div>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{rigAssignments.length}</span>
      </div>
      {isLoading ? (
        <div className="px-5 py-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : rigAssignments.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          <Cog className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          No rigs currently assigned to jobs
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {rigAssignments.map(a => {
            const rig = assets.find(as => as.id === a.asset_id);
            const job = jobs.find(j => j.id === a.job_id);
            const compStatus = rig?.compliance_status || 'unknown';
            return (
              <button key={a.id} onClick={() => job && onSelectJob(job)}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50 transition cursor-pointer text-left">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Cog className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{a.asset_name}</p>
                    {a.rig_type && a.rig_type !== 'n/a' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 uppercase">{a.rig_type}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {job ? `${job.name}${job.location ? ' · ' + job.location : ''}` : a.job_name || 'Unassigned'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${a.status === 'on_site' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
                    {a.status === 'on_site' ? 'On Site' : 'Planned'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border capitalize ${complianceBadge[compStatus] || complianceBadge.unknown}`}>
                    {compStatus}
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}