import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Briefcase, FileText, Eye, Search, MapPin, FolderOpen, Copy, LayoutGrid, BarChart3, Users, Truck, PoundSterling, Calendar } from 'lucide-react';
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
import JobSummaryCard from '@/components/jobs/JobSummaryCard';
import WorkloadOwnershipPanel from '@/components/jobs/WorkloadOwnershipPanel';
import HubStatsBar from '@/components/dashboard/HubStatsBar';
import { format, parseISO, differenceInCalendarDays, addDays } from 'date-fns';

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
  const [statusFilter, setStatusFilter] = useState('all');
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
  const { data: rotas = [] } = useQuery({ queryKey: ['rotas-for-jobs'], queryFn: () => base44.entities.RotaAssignment.list('-created_date', 5000) });
  const { data: costItems = [] } = useQuery({ queryKey: ['cost-items-for-jobs'], queryFn: () => base44.entities.JobCostItem.list('-created_date', 5000) });
  const { data: siteAssets = [] } = useQuery({ queryKey: ['site-assets-for-rig-count'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 5000) });

  // Compute crew count (unique staff) and rig count (internal_equipment) per job
  const crewCountByJob = React.useMemo(() => {
    const m = {};
    for (const r of rotas) {
      if (!r.job_id) continue;
      if (!m[r.job_id]) m[r.job_id] = new Set();
      if (r.staff_id) m[r.job_id].add(r.staff_id);
    }
    const out = {};
    for (const [k, s] of Object.entries(m)) out[k] = s.size;
    return out;
  }, [rotas]);
  const rigCountByJob = React.useMemo(() => {
    // Count UNIQUE rigs per job — cross-reference with SiteAsset to only
    // count actual rigs (is_rig / asset_type === 'rig'), NOT lifting gear
    // (shackles, slings, hooks) that are also category 'internal_equipment'.
    const rigAssetIds = new Set();
    for (const a of siteAssets) {
      if (a.is_rig || a.asset_type === 'rig') rigAssetIds.add(a.id);
    }
    const m = {};
    for (const ci of costItems) {
      if (ci.category !== 'internal_equipment') continue;
      if (!ci.site_asset_id) continue;
      if (!rigAssetIds.has(ci.site_asset_id)) continue;
      if (!m[ci.job_id]) m[ci.job_id] = new Set();
      m[ci.job_id].add(ci.site_asset_id);
    }
    const out = {};
    for (const [k, s] of Object.entries(m)) out[k] = s.size;
    return out;
  }, [costItems, siteAssets]);

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

      {/* Workload Ownership — Direct vs Partner split (Jobs view only) */}
      {view === 'jobs' && jobs.length > 0 && (
        <WorkloadOwnershipPanel />
      )}

      {/* Jobs KPI Stats Bar — quick overview of job portfolio health */}
      {view === 'jobs' && jobs.length > 0 && (() => {
        const active = jobs.filter(j => ['planning', 'in_progress', 'decommissioning'].includes(j.status || 'planning')).length;
        const inProgress = jobs.filter(j => (j.status || 'planning') === 'in_progress').length;
        const totalCrew = Object.values(crewCountByJob).reduce((s, n) => s + n, 0);
        const totalRigs = Object.values(rigCountByJob).reduce((s, n) => s + n, 0);
        const totalBudget = jobs.reduce((s, j) => s + (Number(j.budget_amount) || 0), 0);
        const startingThisWeek = jobs.filter(j => {
          if (!j.start_date) return false;
          try {
            const d = parseISO(j.start_date);
            const now = new Date();
            const weekEnd = addDays(now, 7);
            return d >= now && d <= weekEnd;
          } catch { return false; }
        }).length;
        return (
          <div className="mb-4">
            <HubStatsBar tiles={[
              { icon: Briefcase, label: 'Total Jobs', value: jobs.length, sublabel: `${active} active`, color: 'brand' },
              { icon: BarChart3, label: 'In Progress', value: inProgress, sublabel: 'On site now', color: 'emerald' },
              { icon: Users, label: 'Crew Deployed', value: totalCrew, sublabel: 'Across all jobs', color: 'blue' },
              { icon: Truck, label: 'Rigs In Use', value: totalRigs, sublabel: 'Active drilling', color: 'amber' },
              { icon: PoundSterling, label: 'Total Budget', value: totalBudget > 0 ? '£' + totalBudget.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '—', sublabel: 'Portfolio value', color: 'violet' },
              { icon: Calendar, label: 'Starting Soon', value: startingThisWeek, sublabel: 'Next 7 days', color: 'teal' },
            ]} />
          </div>
        );
      })()}

      {/* Status buttons + search — only in Jobs view */}
      {view === 'jobs' && jobs.length > 0 && (
        <div className="mb-5 space-y-3">
          {/* Status buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {[
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
                const parentClient = client?.parent_client_id ? clients.find(c => c.id === client.parent_client_id) : null;
                const project = projects.find(p => p.id === job.project_id);
                const siblingCount = project ? jobs.filter(j => j.project_id === project.id).length : 0;
                return (
                  <JobSummaryCard
                    key={job.id}
                    job={job}
                    client={client}
                    parentClient={parentClient}
                    project={project}
                    siblingCount={siblingCount}
                    crewCount={crewCountByJob[job.id] || 0}
                    rigCount={rigCountByJob[job.id] || 0}
                    jobTypes={jobTypes}
                    teams={teams}
                    cloningId={cloningId}
                    onView={(j) => setSelectedJob(j)}
                    onEdit={(j) => handleEdit(j)}
                    onClone={(j) => handleClone(j)}
                    onDelete={(id) => handleDelete(id)}
                    onProjectClick={() => setView('projects')}
                  />
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