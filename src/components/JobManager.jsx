import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Briefcase, FileText, Eye, Search, MapPin, FolderOpen, Copy, LayoutGrid, BarChart3 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState, CardGridSkeleton } from '@/components/StateViews';
import JobDetail from '@/components/JobDetail';
import JobWizardModal from '@/components/JobWizardModal';
import PrintReportButton from '@/components/PrintReportButton';
import JobCreatedModal from '@/components/JobCreatedModal';
import ProjectManager from '@/components/ProjectManager';
import JobKanbanBoard from '@/components/dashboard/JobKanbanBoard';
import { getJobPrimaryType, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';
import DisciplinePills from '@/components/disciplines/DisciplinePills';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';

const fmtDate = (d) => {
  try { return d ? format(parseISO(d), 'dd MMM yyyy') : '—'; } catch { return d || '—'; }
};

const fmtDateShort = (d) => {
  try { return d ? format(parseISO(d), 'dd MMM') : '—'; } catch { return d || '—'; }
};

const calcDuration = (start, end) => {
  if (!start || !end) return null;
  try {
    const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
    if (days <= 0) return 1;
    return days;
  } catch { return null; }
};

const jobTypeBadge = {
  drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  groundworks: 'bg-[#2E5A1A]/15 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20',
  // Legacy types — kept for backward-compatible display of old records
  cp_drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  rotary_drilling: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  enabling_works: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  depot: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

const jobTypeBar = {
  drilling: 'bg-gradient-to-r from-amber-400 to-orange-500',
  groundworks: 'bg-gradient-to-r from-[#8DC63F] to-[#2E5A1A]',
  // Legacy types — kept for backward-compatible display of old records
  cp_drilling: 'bg-gradient-to-r from-amber-400 to-orange-500',
  rotary_drilling: 'bg-gradient-to-r from-blue-400 to-indigo-500',
  enabling_works: 'bg-gradient-to-r from-purple-400 to-fuchsia-500',
  depot: 'bg-gradient-to-r from-slate-300 to-slate-500',
};

const statusBadge = {
  planning: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  in_progress: 'bg-[#2E5A1A]/15 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20',
  decommissioning: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  completed: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',
  on_hold: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  cancelled: 'bg-red-100 text-red-700 ring-1 ring-red-200',
};

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning', completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

const emptyForm = {
  name: '', job_reference: '', job_type: '', location: '', required_team_ids: [], status: 'planning',
  start_date: '', end_date: '', client_id: '', contractor_id: '',
  project_manager: '', site_contact_name: '', site_contact_phone: '',
  notes: '', requisition_list_url: '', requisition_list_name: '',
  budget_amount: '', actual_cost: '', meterage: '', client_charge: '', client_charge_description: '',
  project_id: '',
  equipment_items: []
};

export default function JobManager({ onNavigateRota }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [cloningId, setCloningId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [createdJob, setCreatedJob] = useState(null);
  const [view, setView] = useState('jobs'); // 'jobs' | 'projects'
  const [layoutView, setLayoutView] = useState('grid'); // 'grid' | 'kanban'

  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list()
  });

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-created_date', 200) });

  const handleEdit = (job) => {
    setEditingJob(job);
    setShowWizard(true);
  };

  const handleAddJobToProject = (project) => {
    setEditingJob({ project_id: project?.id || '', client_id: project?.client_id || '' });
    setShowWizard(true);
    setView('jobs');
  };

  const handleWizardCreated = (savedJob) => {
    setShowWizard(false);
    setEditingJob(null);
    if (savedJob && !editingJob?.id) setCreatedJob(savedJob);
  };

  const handleClone = async (job) => {
    const shiftStr = prompt(`Clone "${job.name}" — shift dates by how many days? (e.g. 7 = one week forward)`, '7');
    if (shiftStr === null) return;
    const shift = parseInt(shiftStr);
    if (isNaN(shift)) { alert('Please enter a valid number of days.'); return; }
    setCloningId(job.id);
    try {
      const res = await fetch('/api/functions/cloneJob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id, date_shift_days: shift }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clone failed');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      alert(`Cloned "${job.name}" → "${data.new_job_name}"\n${data.cost_items_copied} cost items, ${data.logistics_copied} logistics, ${data.milestones_copied} milestones copied.`);
    } catch (e) {
      alert('Could not clone job: ' + e.message);
    }
    setCloningId(null);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) {
      try {
        await base44.entities.Job.delete(id);
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
      } catch (error) {
        console.error('Error deleting job:', error);
      }
    }
  };

  const buildJobsPrintHtml = () => {
    const rows = jobs.map(j => {
      const jt = getJobPrimaryType(j, teams) || '';
      return `<tr><td>${j.name}</td><td>${j.location}</td><td>${getJobTypeLabel(jt, jobTypes)}</td><td>${(statusLabels[j.status]||'Planning')}</td><td>${j.start_date}</td><td>${j.end_date}</td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html><head><title>Jobs Report</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:16px;margin-bottom:4px}p{color:#555;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1a5c3a;color:white;padding:6px 8px;text-align:left;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafb}@media print{body{margin:10mm}}</style>
    </head><body>
    <h1>Jobs Report</h1>
    <p>${jobs.length} jobs &nbsp;&middot;&nbsp; Printed ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p>
    <table><thead><tr><th>Name</th><th>Location</th><th>Type</th><th>Status</th><th>Start</th><th>End</th></tr></thead>
    <tbody>${rows}</tbody></table>
    </body></html>`;
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery ||
      job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.job_reference || '').toLowerCase().includes(searchQuery.toLowerCase());
    const jobStatus = job.status || 'planning';
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && (jobStatus === 'planning' || jobStatus === 'in_progress')) ||
      jobStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (selectedJob) {
    return <JobDetail job={selectedJob} onBack={() => setSelectedJob(null)} />;
  }

  return (
    <div>
      <PageHeader
        title="Manage Jobs"
        icon={Briefcase}
        subtitle={`${jobs.length} job${jobs.length === 1 ? '' : 's'} in total`}
        actions={
          <>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setView('jobs')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'jobs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Briefcase className="w-3.5 h-3.5" /> Jobs
              </button>
              <button onClick={() => setView('projects')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'projects' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <FolderOpen className="w-3.5 h-3.5" /> Projects
              </button>
            </div>
            {view === 'jobs' && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setLayoutView('grid')} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition ${layoutView === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <LayoutGrid className="w-3.5 h-3.5" /> Grid
                </button>
                <button onClick={() => setLayoutView('kanban')} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition ${layoutView === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <BarChart3 className="w-3.5 h-3.5" /> Kanban
                </button>
              </div>
            )}
            <PrintReportButton buildHtml={buildJobsPrintHtml} label="Print Jobs List" />
            <button
              onClick={() => { setEditingJob(null); setShowWizard(true); }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-[#2E5A1A] rounded-lg hover:bg-[#2E5A1A] hover:text-white transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Job
            </button>
          </>
        }
      />

      {showWizard && (
        <JobWizardModal
          open={showWizard}
          onClose={() => { setShowWizard(false); setEditingJob(null); }}
          onCreated={handleWizardCreated}
          editingJob={editingJob}
        />
      )}

      {/* Projects view — group jobs by project */}
      {view === 'projects' && (
        <ProjectManager
          jobs={jobs}
          teams={teams}
          jobTypes={jobTypes}
          clients={clients}
          onSelectJob={(job) => setSelectedJob(job)}
          onAddJob={handleAddJobToProject}
        />
      )}

      {/* Status buttons + search — only in Jobs view */}
      {view === 'jobs' && jobs.length > 0 && (
        <div className="mb-5 space-y-3">
          {/* Status buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: 'active', label: 'Active', count: jobs.filter(j => ['planning','in_progress','decommissioning'].includes(j.status || 'planning')).length },
              { value: 'all', label: 'All', count: jobs.length },
              { value: 'planning', label: 'Planning', count: jobs.filter(j => (j.status || 'planning') === 'planning').length },
              { value: 'in_progress', label: 'In Progress', count: jobs.filter(j => (j.status || 'planning') === 'in_progress').length },
              { value: 'decommissioning', label: 'Decommissioning', count: jobs.filter(j => j.status === 'decommissioning').length },
              { value: 'completed', label: 'Completed', count: jobs.filter(j => j.status === 'completed').length },
              { value: 'on_hold', label: 'On Hold', count: jobs.filter(j => j.status === 'on_hold').length },
              { value: 'cancelled', label: 'Cancelled', count: jobs.filter(j => j.status === 'cancelled').length },
            ].map(btn => {
              const active = statusFilter === btn.value;
              return (
                <button
                  key={btn.value}
                  onClick={() => setStatusFilter(btn.value)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${
                    active ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#2E5A1A]/30 hover:text-slate-900'
                  }`}
                >
                  {btn.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                    {btn.count}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search jobs by name, location or reference..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
            />
          </div>
        </div>
      )}

      {/* Jobs Grid/Kanban — only in Jobs view */}
      {view === 'jobs' && (
        <>
          {layoutView === 'kanban' ? (
            <JobKanbanBoard onSelectJob={(job) => setSelectedJob(job)} />
          ) : (
          <>
          {isLoading ? (
            <CardGridSkeleton count={6} />
          ) : isError ? (
            <ErrorState message="Couldn't load jobs" onRetry={refetch} />
          ) : jobs.length === 0 ? (
            <EmptyState icon={Briefcase} title="No jobs yet" message="Add your first job to start scheduling crews and shifts." actionLabel="Add Job" onAction={() => { setEditingJob(null); setShowWizard(true); }} />
          ) : filteredJobs.length === 0 ? (
            <EmptyState icon={Search} title="No jobs match your search" message="Try a different name, location, or status filter." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredJobs.map((job) => {
                const client = clients.find(c => c.id === job.client_id);
                const primaryType = getJobPrimaryType(job, teams);
                const project = projects.find(p => p.id === job.project_id);
                const siblingCount = project ? jobs.filter(j => j.project_id === project.id).length : 0;
                return (
                <div key={job.id} className="card-modern rounded-xl overflow-hidden flex flex-col group">
                  <div className={`h-1.5 ${getJobTypeColor(primaryType, jobTypes).bar}`} />
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getJobTypeColor(primaryType, jobTypes).badge}`}>{getJobTypeLabel(primaryType, jobTypes)}</span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge[job.status || 'planning']}`}>{statusLabels[job.status || 'planning']}</span>
                        <DisciplinePills job={job} size="sm" />
                      </div>
                      {job.requisition_list_url && <FileText className="w-4 h-4 text-[#2E5A1A] flex-shrink-0 mt-0.5" title="Has requisition list" />}
                    </div>
                    <h3 className="font-bold text-slate-900 text-base mb-1 truncate">{job.name}</h3>
                    {project && (
                      <button onClick={() => { setView('projects'); }} className="flex items-center gap-1.5 mb-1 hover:underline">
                        <FolderOpen className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-indigo-600 truncate">{project.name}</span>
                        <span className="text-[10px] text-slate-400">· {siblingCount} job{siblingCount !== 1 ? 's' : ''}</span>
                      </button>
                    )}
                    {job.job_reference && <p className="text-xs text-slate-400 mb-1 truncate">Ref: {job.job_reference}</p>}
                    {client && <p className="text-xs text-slate-400 mb-1.5 truncate">{client.name}</p>}
                    <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-3">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </div>
                    {/* Prominent date block */}
                    {(() => {
                      const duration = calcDuration(job.start_date, job.end_date);
                      return (
                        <div className="flex items-stretch gap-2.5 mb-1">
                           <div className="flex flex-col items-center justify-center min-w-[52px] px-2 py-1.5 rounded-lg bg-slate-900 text-white">
                             <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 leading-none">Start</span>
                             <span className="text-base font-bold leading-tight mt-0.5">{fmtDateShort(job.start_date).split(' ')[0]}</span>
                             <span className="text-[10px] font-medium text-slate-300 leading-none">{fmtDateShort(job.start_date).split(' ')[1]}</span>
                           </div>
                           <div className="flex flex-col items-center justify-center min-w-[52px] px-2 py-1.5 rounded-lg bg-slate-700 text-white">
                             <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 leading-none">End</span>
                             <span className="text-base font-bold leading-tight mt-0.5">{fmtDateShort(job.end_date).split(' ')[0]}</span>
                             <span className="text-[10px] font-medium text-slate-300 leading-none">{fmtDateShort(job.end_date).split(' ')[1]}</span>
                           </div>
                           {duration != null && (
                             <span className={`inline-flex items-center self-center text-xs font-bold px-2 py-0.5 rounded-full ${
                               duration === 1 ? 'bg-blue-50 text-blue-700' :
                               duration <= 7 ? 'bg-emerald-50 text-emerald-700' :
                               duration <= 30 ? 'bg-amber-50 text-amber-700' :
                               'bg-violet-50 text-violet-700'
                             }`}>
                               {duration} {duration === 1 ? 'day' : 'days'}
                             </span>
                           )}
                         </div>
                      );
                    })()}
                  </div>
                  <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button onClick={() => setSelectedJob(job)} className="flex items-center gap-1.5 text-sm font-medium text-[#2E5A1A] hover:text-[#1c4a12] transition"><Eye className="w-4 h-4" /> View Details</button>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(job)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleClone(job)} disabled={cloningId === job.id} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition disabled:opacity-50" title="Clone job"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(job.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
          </>
          )}
        </>
      )}

      {createdJob && (
        <JobCreatedModal
          job={createdJob}
          onView={() => { setSelectedJob(createdJob); setCreatedJob(null); }}
          onBuildRota={onNavigateRota ? () => { onNavigateRota(); setCreatedJob(null); } : undefined}
          onLater={() => setCreatedJob(null)}
          onClose={() => setCreatedJob(null)}
        />
      )}
    </div>
  );
}