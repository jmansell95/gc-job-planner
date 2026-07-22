import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Search, ChevronDown, ChevronRight, FileText, Download, X } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import JobPackView from '@/components/audit/JobPackView';

/**
 * ISO-compliant Audit Trail hub.
 * Auditors request "Job Packs" — a complete start-to-finish traceability
 * record for each job. This page lets them search for a job and expand a
 * full audit pack: who was on it, what they did, compliance sign-offs,
 * equipment, commercial confirmations, and a chronological timeline.
 */
export default function AuditTrailHub() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedJob, setExpandedJob] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-audit'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-audit'],
    queryFn: () => base44.entities.Client.list(),
  });
  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors-audit'],
    queryFn: () => base44.entities.Contractor.list(),
  });

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);
  const contractorMap = useMemo(() => Object.fromEntries(contractors.map(c => [c.id, c.name])), [contractors]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return jobs.filter(j => {
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (j.name || '').toLowerCase().includes(q) ||
        (j.job_reference || '').toLowerCase().includes(q) ||
        (j.location || '').toLowerCase().includes(q) ||
        (j.project_manager || '').toLowerCase().includes(q)
      );
    });
  }, [jobs, query, statusFilter]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <SettingsSectionHeader
        title="Audit Trail & Job Packs"
        description="ISO-compliant audit trail — search for a job and expand its full Job Pack: personnel, technical activity, compliance sign-offs, equipment, commercial confirmations, and a chronological timeline from start to finish."
        icon={ShieldCheck}
      />

      {/* Search & filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by job name, reference, location or project manager..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white"
          >
            <option value="all">All statuses</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="decommissioning">Decommissioning</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Showing {filtered.length} of {jobs.length} jobs. Click a job to expand its full audit pack.
        </p>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {isLoading && (
          <div className="text-center py-12 text-sm text-slate-400">Loading jobs…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-400">No jobs match your search.</div>
        )}
        {filtered.map(job => {
          const isExpanded = expandedJob === job.id;
          return (
            <div key={job.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition text-left"
              >
                {isExpanded
                  ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 truncate">{job.name}</p>
                    {job.job_reference && (
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                        {job.job_reference}
                      </span>
                    )}
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {job.location || 'No location'}
                    {clientMap[job.client_id] && ` · ${clientMap[job.client_id]}`}
                    {contractorMap[job.contractor_id] && ` · Contractor: ${contractorMap[job.contractor_id]}`}
                    {job.start_date && ` · ${job.start_date}`}
                    {job.end_date && ` → ${job.end_date}`}
                  </p>
                </div>
                <FileText className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  <JobPackView job={job} clientName={clientMap[job.client_id]} contractorName={contractorMap[job.contractor_id]} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    planning: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-emerald-100 text-emerald-700',
    decommissioning: 'bg-amber-100 text-amber-700',
    completed: 'bg-slate-100 text-slate-600',
    on_hold: 'bg-orange-100 text-orange-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  const cls = styles[status] || 'bg-slate-100 text-slate-600';
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{(status || 'unknown').replace('_', ' ')}</span>;
}