import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, X, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const statusConfig = {
  planning: { label: 'Planning', badge: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', badge: 'bg-blue-100 text-blue-700' },
  decommissioning: { label: 'Decommissioning', badge: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', badge: 'bg-emerald-100 text-emerald-700' },
  on_hold: { label: 'On Hold', badge: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelled', badge: 'bg-slate-100 text-slate-500' }
};

export default function JobDependencyManager({ job }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: allJobs = [] } = useQuery({
    queryKey: ['all-jobs-for-dependencies'],
    queryFn: () => base44.entities.Job.list('-updated_date', 200)
  });

  const dependencyIds = job.depends_on_job_ids || [];
  const dependencies = dependencyIds
    .map(id => allJobs.find(j => j.id === id))
    .filter(Boolean);

  const blockingDeps = dependencies.filter(d => d.status !== 'completed' && d.status !== 'cancelled');
  const allClear = dependencies.length === 0 || blockingDeps.length === 0;

  const availableJobs = allJobs.filter(j =>
    j.id !== job.id &&
    !dependencyIds.includes(j.id) &&
    (search === '' || (j.name || '').toLowerCase().includes(search.toLowerCase()) || (j.location || '').toLowerCase().includes(search.toLowerCase()))
  );

  const addDependency = async (depId) => {
    setSaving(true);
    try {
      const updated = [...dependencyIds, depId];
      await base44.entities.Job.update(job.id, { depends_on_job_ids: updated });
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['all-jobs-for-dependencies'] });
      setShowPicker(false);
      setSearch('');
    } catch (e) {
      console.error('Add dependency error:', e);
    }
    setSaving(false);
  };

  const removeDependency = async (depId) => {
    setSaving(true);
    try {
      const updated = dependencyIds.filter(id => id !== depId);
      await base44.entities.Job.update(job.id, { depends_on_job_ids: updated });
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    } catch (e) {
      console.error('Remove dependency error:', e);
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Job Dependencies</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{dependencies.length}</span>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Warning banner if dependencies are blocking */}
        {dependencies.length > 0 && !allClear && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{blockingDeps.length} prerequisite {blockingDeps.length === 1 ? 'job' : 'jobs'} not yet complete</p>
              <p className="text-xs text-amber-700 mt-0.5">This job should not start until the above {blockingDeps.length === 1 ? 'dependency is' : 'dependencies are'} finished.</p>
            </div>
          </div>
        )}
        {dependencies.length > 0 && allClear && (
          <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">All dependencies cleared</p>
              <p className="text-xs text-emerald-700 mt-0.5">All prerequisite jobs are completed — this job is clear to start.</p>
            </div>
          </div>
        )}

        {/* Dependency list */}
        {dependencies.length > 0 ? (
          <div className="space-y-2">
            {dependencies.map(dep => {
              const cfg = statusConfig[dep.status] || statusConfig.planning;
              const isBlocking = dep.status !== 'completed' && dep.status !== 'cancelled';
              return (
                <div key={dep.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isBlocking ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                    {isBlocking ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{dep.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                      {dep.start_date && <span className="text-[10px] text-slate-400">{format(parseISO(dep.start_date), 'dd MMM')}</span>}
                      {dep.location && <span className="text-[10px] text-slate-400 truncate">· {dep.location}</span>}
                    </div>
                  </div>
                  <button onClick={() => removeDependency(dep.id)} disabled={saving}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-3">No dependencies set — this job can start independently.</p>
        )}

        {/* Add dependency picker */}
        {showPicker ? (
          <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs by name or location…"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableJobs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">No matching jobs found</p>
              ) : (
                availableJobs.slice(0, 20).map(j => {
                  const cfg = statusConfig[j.status] || statusConfig.planning;
                  return (
                    <button key={j.id} onClick={() => addDependency(j.id)} disabled={saving}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/30 transition text-left disabled:opacity-50">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{j.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{j.location || 'No location'}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.badge} flex-shrink-0`}>{cfg.label}</span>
                    </button>
                  );
                })
              )}
            </div>
            <button onClick={() => setShowPicker(false)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-emerald-400 hover:text-emerald-700 transition text-sm font-medium w-full justify-center">
            <Plus className="w-4 h-4" /> Add prerequisite job
          </button>
        )}
      </div>
    </div>
  );
}