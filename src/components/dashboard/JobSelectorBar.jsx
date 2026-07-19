import React, { useState, useRef, useEffect } from 'react';
import { Layers, Briefcase, ChevronDown, Search, X, MapPin, Calendar, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useJobFilter } from './JobFilterContext';
import { format } from 'date-fns';

const statusStyles = {
  in_progress: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', label: 'In Progress' },
  planning: { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700', label: 'Planning' },
  on_hold: { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'On Hold' },
  completed: { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600', label: 'Completed' },
  decommissioning: { dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700', label: 'Decommissioning' },
  cancelled: { dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700', label: 'Cancelled' },
};

export default function JobSelectorBar() {
  const { selectedJobId, setSelectedJobId } = useJobFilter();
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const isAll = selectedJobId === 'all';
  const selectedJob = !isAll ? jobs.find(j => j.id === selectedJobId) : null;

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const filtered = jobs.filter(j =>
    !search || j.name?.toLowerCase().includes(search.toLowerCase()) ||
    j.location?.toLowerCase().includes(search.toLowerCase()) ||
    j.job_reference?.toLowerCase().includes(search.toLowerCase())
  );

  const activeStatus = selectedJob?.status ? statusStyles[selectedJob.status] || statusStyles.planning : null;

  return (
    <div className="mb-5">
      {/* Segmented scope switcher */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* All Jobs button */}
        <button
          onClick={() => setSelectedJobId('all')}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition flex-shrink-0 ${
            isAll
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-600 shadow-md shadow-emerald-200/50'
              : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAll ? 'bg-white/20' : 'bg-emerald-50'}`}>
            <Layers className={`w-5 h-5 ${isAll ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">All Jobs</p>
            <p className={`text-[11px] leading-tight ${isAll ? 'text-emerald-50' : 'text-slate-400'}`}>Full Overview</p>
          </div>
        </button>

        {/* Divider */}
        <div className="hidden sm:flex items-center px-1 text-slate-300 font-semibold text-xs">OR</div>

        {/* Job picker */}
        <div className="relative flex-1" ref={dropdownRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition text-left ${
              !isAll
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-md shadow-blue-200/50'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!isAll ? 'bg-white/20' : 'bg-blue-50'}`}>
              <Briefcase className={`w-5 h-5 ${!isAll ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <div className="text-left flex-1 min-w-0">
              {selectedJob ? (
                <>
                  <p className="text-sm font-bold leading-tight truncate">{selectedJob.name}</p>
                  <p className={`text-[11px] leading-tight truncate ${!isAll ? 'text-blue-50' : 'text-slate-400'}`}>
                    {selectedJob.location || 'No location set'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold leading-tight">Focus on a Job</p>
                  <p className={`text-[11px] leading-tight ${!isAll ? 'text-blue-50' : 'text-slate-400'}`}>Select a specific project</p>
                </>
              )}
            </div>
            {activeStatus && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${activeStatus.badge}`}>
                {activeStatus.label}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 flex-shrink-0 transition ${open ? 'rotate-180' : ''} ${!isAll ? 'text-white' : 'text-slate-400'}`} />
          </button>

          {/* Searchable dropdown */}
          {open && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
              <div className="p-2.5 border-b border-slate-100">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={inputRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, location or reference…"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-400 focus:bg-white"
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-6">No jobs match "{search}"</p>
                ) : filtered.map(j => {
                  const st = statusStyles[j.status] || statusStyles.planning;
                  return (
                    <button
                      key={j.id}
                      onClick={() => { setSelectedJobId(j.id); setOpen(false); setSearch(''); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 transition text-left border-b border-slate-50 last:border-0 ${
                        j.id === selectedJobId ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{j.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          {j.location && <span className="flex items-center gap-0.5 truncate"><MapPin className="w-3 h-3" />{j.location}</span>}
                          {j.start_date && <span className="flex items-center gap-0.5 flex-shrink-0"><Calendar className="w-3 h-3" />{format(new Date(j.start_date), 'dd MMM')}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${st.badge}`}>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Job context strip — only when a specific job is selected */}
      {selectedJob && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <ContextChip icon={Building2} label="Client" value={selectedJob.client_id ? 'Linked' : '—'} />
          <ContextChip icon={MapPin} label="Location" value={selectedJob.location || '—'} />
          <ContextChip icon={Calendar} label="Start Date" value={selectedJob.start_date ? format(new Date(selectedJob.start_date), 'dd MMM yyyy') : '—'} />
          <ContextChip icon={Calendar} label="End Date" value={selectedJob.end_date ? format(new Date(selectedJob.end_date), 'dd MMM yyyy') : '—'} />
        </div>
      )}
    </div>
  );
}

function ContextChip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 px-3 py-2.5 shadow-sm">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
}