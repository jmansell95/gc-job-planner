import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Briefcase, Upload, FileText, X, Eye, Download, RefreshCw, ChevronRight, MapPin, Calendar, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import JobDetail from '@/components/JobDetail';
import PrintReportButton from '@/components/PrintReportButton';
import { formatJobType } from '@/utils/format';
import { format, parseISO } from 'date-fns';

const fmtDate = (d) => {
  try { return d ? format(parseISO(d), 'dd MMM yyyy') : '—'; } catch { return d || '—'; }
};

const jobTypeBadge = {
  groundworks: 'bg-green-100 text-green-700',
  cp_drilling: 'bg-amber-100 text-amber-700',
  rotary_drilling: 'bg-blue-100 text-blue-700',
  enabling_works: 'bg-purple-100 text-purple-700',
  depot: 'bg-slate-100 text-slate-600',
};

const statusBadge = {
  planning: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700',
};

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', completed: 'Completed', on_hold: 'On Hold',
};

export default function JobManager() {
  const [selectedJob, setSelectedJob] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    job_type: 'groundworks',
    status: 'planning',
    start_date: '',
    end_date: '',
    client_id: '',
    contractor_id: '',
    notes: '',
    requisition_list_url: '',
    requisition_list_name: '',
    budget_amount: ''
  });

  const queryClient = useQueryClient();

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list()
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => base44.entities.Contractor.list()
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await base44.entities.Job.update(editingId, formData);
      } else {
        await base44.entities.Job.create(formData);
      }
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setFormData({
        name: '',
        location: '',
        job_type: 'groundworks',
        start_date: '',
        end_date: '',
        client_id: '',
        contractor_id: '',
        notes: '',
        requisition_list_url: '',
        requisition_list_name: '',
        budget_amount: ''
      });
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving job:', error);
    }
  };

  const handleEdit = (job) => {
    setFormData(job);
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
    const rows = jobs.map(j =>
      `<tr><td>${j.name}</td><td>${j.location}</td><td>${j.job_type.replace(/_/g,' ')}</td><td>${(statusLabels[j.status]||'Planning')}</td><td>${j.start_date}</td><td>${j.end_date}</td></tr>`
    ).join('');
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
      job.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (job.status || 'planning') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (selectedJob) {
    return <JobDetail job={selectedJob} onBack={() => setSelectedJob(null)} />;
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <PageHeader title="Manage Jobs" icon={Briefcase} />
        <div className="flex items-center gap-2">
          <PrintReportButton buildHtml={buildJobsPrintHtml} label="Print Jobs List" />
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                name: '',
                location: '',
                job_type: 'groundworks',
                start_date: '',
                end_date: '',
                client_id: '',
                contractor_id: '',
                notes: '',
                requisition_list_url: '',
                requisition_list_name: '',
                budget_amount: ''
              });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Job
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 md:p-6 border border-emerald-200 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Job Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Job Type</label>
              <select
                value={formData.job_type}
                onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              >
                <option value="groundworks">Groundworks</option>
                <option value="cp_drilling">CP Drilling</option>
                <option value="rotary_drilling">Rotary Drilling</option>
                <option value="enabling_works">Enabling Works</option>
                <option value="depot">Depot</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select
                value={formData.status || 'planning'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              >
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              >
                <option value="">Select Client (Optional)</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Client (Contractor)</label>
              <select
                value={formData.contractor_id}
                onChange={(e) => setFormData({ ...formData, contractor_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              >
                <option value="">Select Client (Optional)</option>
                {contractors.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Budget (GBP)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.budget_amount || ''}
                onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value ? parseFloat(e.target.value) : '' })}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
            </div>

            <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              rows="2"
            />
            </div>

            <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Requisition List</label>
            {formData.requisition_list_url ? (
              <div className="border border-emerald-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 p-3 bg-emerald-50">
                  <FileText className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                  <span className="text-sm text-emerald-800 font-medium flex-1 truncate">
                    {formData.requisition_list_name || 'Requisition List'}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-emerald-100">
                  <a
                    href={formData.requisition_list_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </a>
                  <a
                    href={formData.requisition_list_url}
                    download={formData.requisition_list_name || 'requisition-list'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition cursor-pointer">
                    {uploadingFile ? (
                      <span>Uploading...</span>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5" /> Replace</>
                    )}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, requisition_list_url: '', requisition_list_name: '' }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition ml-auto"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-400 transition">
                {uploadingFile ? (
                  <span className="text-sm text-slate-500">Uploading...</span>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-500">Click to upload requisition list (PDF, Excel, Word, etc.)</span>
                  </>
                )}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
              </label>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium"
            >
              {editingId ? 'Update Job' : 'Add Job'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter */}
      {jobs.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs by name or location..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>
      )}

      {/* Jobs Grid */}
      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No jobs yet. Add your first job above.
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No jobs match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const client = clients.find(c => c.id === job.client_id);
            return (
            <div key={job.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${jobTypeBadge[job.job_type] || 'bg-slate-100 text-slate-600'}`}>
                      {formatJobType(job.job_type)}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge[job.status || 'planning']}`}>
                      {statusLabels[job.status || 'planning']}
                    </span>
                  </div>
                  {job.requisition_list_url && (
                    <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" title="Has requisition list" />
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">{job.name}</h3>
                {client && (
                  <p className="text-xs text-slate-400 mb-1.5 truncate">{client.name}</p>
                )}
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
                <button
                  onClick={() => setSelectedJob(job)}
                  className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-900 transition"
                >
                  <Eye className="w-4 h-4" /> View Details
                </button>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(job)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(job.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}