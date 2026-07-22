import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Briefcase, FileText, Eye, Search, MapPin, Calendar } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { EmptyState, ErrorState, CardGridSkeleton } from '@/components/StateViews';
import JobDetail from '@/components/JobDetail';
import JobForm from '@/components/JobForm';
import PrintReportButton from '@/components/PrintReportButton';
import JobCreatedModal from '@/components/JobCreatedModal';
import { getJobPrimaryType, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';
import { format, parseISO } from 'date-fns';

const fmtDate = (d) => {
  try { return d ? format(parseISO(d), 'dd MMM yyyy') : '—'; } catch { return d || '—'; }
};

const jobTypeBadge = {
  groundworks: 'bg-[#2E5A1A]/15 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20',
  cp_drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  rotary_drilling: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  enabling_works: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  depot: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

const jobTypeBar = {
  groundworks: 'bg-gradient-to-r from-[#8DC63F] to-[#2E5A1A]',
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
  equipment_items: []
};

export default function JobManager({ onNavigateRota }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [formData, setFormData] = useState(emptyForm);
  const [createdJob, setCreatedJob] = useState(null);

  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list()
  });

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { equipment_items, ...cleanData } = { ...formData };
      ['budget_amount', 'actual_cost', 'meterage', 'client_charge', 'markup_percentage', 'vat_rate'].forEach(k => {
        if (cleanData[k] === '' || cleanData[k] === undefined || cleanData[k] === null) delete cleanData[k];
      });
      let savedJob = null;
      if (editingId) {
        await base44.entities.Job.update(editingId, cleanData);
      } else {
        savedJob = await base44.entities.Job.create(cleanData);
        if (savedJob && equipment_items?.length > 0) {
          try {
            await base44.entities.JobCostItem.bulkCreate(
              equipment_items.map(item => {
                const isContractor = item.category === 'contractor_supplied';
                return {
                  job_id: savedJob.id,
                  category: item.category || 'hired_equipment',
                  supplier_id: isContractor ? '' : (item.supplier_id || ''),
                  contractor_id: isContractor ? (item.contractor_id || '') : '',
                  description: item.description,
                  reference_number: item.reference_number || '',
                  po_number: item.po_number || '',
                  start_date: item.start_date || '',
                  end_date: item.end_date || '',
                  unit_cost: isContractor ? 0 : (Number(item.unit_cost) || 0),
                  quantity: Number(item.quantity) || 1,
                  unit_label: isContractor ? 'each' : (item.unit_label || 'each'),
                  vat_exempt: isContractor ? false : !!item.vat_exempt,
                  notes: item.notes || '',
                  hire_status: 'active',
                  current_location: isContractor ? 'site' : 'yard'
                };
              })
            );
          } catch (e) { console.error('Equipment creation error:', e); }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setFormData(emptyForm);
      setShowForm(false);
      setEditingId(null);
      if (savedJob) setCreatedJob(savedJob);
    } catch (error) {
      console.error('Error saving job:', error);
      alert('Could not save the job: ' + (error?.message || 'Please check all required fields.'));
    }
  };

  const handleEdit = (job) => {
    setFormData({ ...emptyForm, ...job });
    setEditingId(job.id);
    setShowForm(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, requisition_list_url: file_url, requisition_list_name: file.name }));
    } catch (error) {
      console.error('Error uploading file:', error);
    }
    setUploadingFile(false);
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
    const matchesStatus = statusFilter === 'all' || (job.status || 'planning') === statusFilter;
    const matchesClient = clientFilter === 'all' || job.client_id === clientFilter;
    const primaryType = getJobPrimaryType(job, teams);
    const matchesType = typeFilter === 'all' || primaryType === typeFilter;
    return matchesSearch && matchesStatus && matchesClient && matchesType;
  });

  // Summary stats — reflect the current filter context
  const stats = {
    total: filteredJobs.length,
    in_progress: filteredJobs.filter(j => (j.status || 'planning') === 'in_progress').length,
    planning: filteredJobs.filter(j => (j.status || 'planning') === 'planning').length,
    completed: filteredJobs.filter(j => j.status === 'completed').length,
  };

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
            <PrintReportButton buildHtml={buildJobsPrintHtml} label="Print Jobs List" />
            <button
              onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyForm); }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-[#2E5A1A] rounded-lg hover:bg-[#2E5A1A]/10 transition text-sm font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Job
            </button>
          </>
        }
      />

      {showForm && (
        <JobForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          editingId={editingId}
          clients={clients}
          contractors={contractors}
          onFileUpload={handleFileUpload}
          uploadingFile={uploadingFile}
        />
      )}

      {/* Search & Filter */}
      {jobs.length > 0 && (
        <>
          {/* Summary stats — reflect active filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard icon={Briefcase} value={stats.total} label="Showing" gradient="stat-gradient-slate" />
            <StatCard icon={Briefcase} value={stats.in_progress} label="In Progress" gradient="stat-gradient-emerald" />
            <StatCard icon={Briefcase} value={stats.planning} label="Planning" gradient="stat-gradient-blue" />
            <StatCard icon={Briefcase} value={stats.completed} label="Completed" gradient="stat-gradient-cyan" />
          </div>
          <SearchFilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search jobs by name, location or reference..."
            showCount
            totalCount={filteredJobs.length}
            filters={[
              {
                value: statusFilter, onChange: setStatusFilter,
                options: [
                  { value: 'all', label: 'All Statuses' },
                  { value: 'planning', label: 'Planning' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'decommissioning', label: 'Decommissioning' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'on_hold', label: 'On Hold' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]
              },
              {
                value: typeFilter, onChange: setTypeFilter,
                options: [
                  { value: 'all', label: 'All Types' },
                  { value: 'groundworks', label: 'Groundworks' },
                  { value: 'cp_drilling', label: 'CP Drilling' },
                  { value: 'rotary_drilling', label: 'Rotary Drilling' },
                  { value: 'enabling_works', label: 'Enabling Works' },
                  { value: 'depot', label: 'Depot' },
                ]
              },
              {
                value: clientFilter, onChange: setClientFilter,
                options: [
                  { value: 'all', label: 'All Clients' },
                  ...clients.map(c => ({ value: c.id, label: c.name }))
                ]
              },
            ]}
          />
        </>
      )}

      {/* Jobs Grid */}
      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : isError ? (
        <ErrorState message="Couldn't load jobs" onRetry={refetch} />
      ) : jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title="No jobs yet" message="Add your first job to start scheduling crews and shifts." actionLabel="Add Job" onAction={() => { setEditingId(null); setShowForm(true); }} />
      ) : filteredJobs.length === 0 ? (
        <EmptyState icon={Search} title="No jobs match your search" message="Try a different name, location, or status filter." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const client = clients.find(c => c.id === job.client_id);
            const primaryType = getJobPrimaryType(job, teams);
            return (
            <div key={job.id} className="card-modern rounded-xl overflow-hidden flex flex-col">
              <div className={`h-1.5 ${getJobTypeColor(primaryType, jobTypes).bar}`} />
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getJobTypeColor(primaryType, jobTypes).badge}`}>{getJobTypeLabel(primaryType, jobTypes)}</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge[job.status || 'planning']}`}>{statusLabels[job.status || 'planning']}</span>
                  </div>
                  {job.requisition_list_url && <FileText className="w-4 h-4 text-[#2E5A1A] flex-shrink-0 mt-0.5" title="Has requisition list" />}
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">{job.name}</h3>
                {job.job_reference && <p className="text-xs text-slate-400 mb-1 truncate">Ref: {job.job_reference}</p>}
                {client && <p className="text-xs text-slate-400 mb-1.5 truncate">{client.name}</p>}
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-1">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{job.location}</span>
                </div>
                <div className="flex items-start gap-1.5 text-slate-400 text-xs">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words">{fmtDate(job.start_date)} → {fmtDate(job.end_date)}</span>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button onClick={() => setSelectedJob(job)} className="flex items-center gap-1.5 text-sm font-medium text-[#2E5A1A] hover:text-[#1c4a12] transition"><Eye className="w-4 h-4" /> View Details</button>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(job)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(job.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
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