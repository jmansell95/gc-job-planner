import React from 'react';
import { Briefcase, Layers, ChevronDown, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useJobFilter } from './JobFilterContext';

export default function JobSelectorBar() {
  const { selectedJobId, setSelectedJobId } = useJobFilter();
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const isAll = selectedJobId === 'all';
  const selectedJob = !isAll ? jobs.find(j => j.id === selectedJobId) : null;

  const statusColor = (s) => {
    if (s === 'in_progress') return 'bg-emerald-100 text-emerald-700';
    if (s === 'planning') return 'bg-blue-100 text-blue-700';
    if (s === 'on_hold') return 'bg-amber-100 text-amber-700';
    if (s === 'completed') return 'bg-slate-100 text-slate-600';
    if (s === 'cancelled') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-500';
  };

  return (
    <div className="mb-4 flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 shadow-sm px-3 sm:px-4 py-2.5">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isAll ? 'bg-emerald-50' : 'bg-blue-50'}`}>
          {isAll ? <Layers className="w-4 h-4 text-emerald-600" /> : <Briefcase className="w-4 h-4 text-blue-600" />}
        </div>
        <span className="text-xs font-medium text-slate-500 hidden sm:inline">Dashboard Scope</span>
      </div>
      <div className="h-5 w-px bg-slate-200 hidden sm:block" />
      <div className="relative flex-1 min-w-0">
        <select
          value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          className="w-full text-sm font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer appearance-none pr-7 truncate"
        >
          <option value="all">All Jobs — Full Overview</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.name}{j.status ? ` · ${j.status.replace(/_/g, ' ')}` : ''}</option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {selectedJob?.status && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor(selectedJob.status)}`}>
          {selectedJob.status.replace(/_/g, ' ')}
        </span>
      )}
      {!isAll && (
        <button onClick={() => setSelectedJobId('all')}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-50 transition flex-shrink-0">
          <X className="w-3.5 h-3.5" /> <span className="hidden sm:inline">All Jobs</span>
        </button>
      )}
    </div>
  );
}