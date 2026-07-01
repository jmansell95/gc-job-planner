import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Briefcase, Upload, FileText, X, Eye, Download, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function JobManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    job_type: 'groundworks',
    start_date: '',
    end_date: '',
    client_id: '',
    contractor_id: '',
    notes: '',
    requisition_list_url: '',
    requisition_list_name: ''
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
        requisition_list_name: ''
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

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <PageHeader title="Manage Jobs" icon={Briefcase} />
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
              requisition_list_name: ''
            });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Job
        </button>
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
              <label className="block text-sm font-medium text-slate-700 mb-2">Contractor</label>
              <select
                value={formData.contractor_id}
                onChange={(e) => setFormData({ ...formData, contractor_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              >
                <option value="">Select Contractor (Optional)</option>
                {contractors.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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

      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-emerald-700 border-b border-emerald-800">
              <th className="px-4 py-3 text-left font-semibold text-white">Job Name</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Location</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Dates</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Requisition</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-slate-200 hover:bg-emerald-50 transition">
                <td className="px-4 py-3 text-slate-900 font-medium">{job.name}</td>
                <td className="px-4 py-3 text-slate-600">{job.location}</td>
                <td className="px-4 py-3 text-slate-600 text-sm capitalize">{job.job_type.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-slate-600 text-sm">{job.start_date} to {job.end_date}</td>
                <td className="px-4 py-3">
                  {job.requisition_list_url ? (
                    <div className="flex items-center gap-1">
                      <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer" title="View" className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded transition">
                        <Eye className="w-4 h-4" />
                      </a>
                      <a href={job.requisition_list_url} download={job.requisition_list_name || 'requisition-list'} title="Download" className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition">
                        <Download className="w-4 h-4" />
                      </a>
                      <label title="Replace" className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition cursor-pointer">
                        <RefreshCw className="w-4 h-4" />
                        <input type="file" className="hidden" onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                          await base44.entities.Job.update(job.id, { requisition_list_url: file_url, requisition_list_name: file.name });
                          queryClient.invalidateQueries({ queryKey: ['jobs'] });
                        }} />
                      </label>
                    </div>
                  ) : (
                    <label title="Upload" className="flex items-center gap-1 text-slate-400 hover:text-emerald-700 cursor-pointer transition text-sm">
                      <Upload className="w-4 h-4" />
                      <span>Upload</span>
                      <input type="file" className="hidden" onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        await base44.entities.Job.update(job.id, { requisition_list_url: file_url, requisition_list_name: file.name });
                        queryClient.invalidateQueries({ queryKey: ['jobs'] });
                      }} />
                    </label>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(job)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 break-words">{job.name}</h3>
                <p className="text-sm text-slate-600 mt-1 break-words">{job.location}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEdit(job)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-slate-500 font-medium">Type</p>
                <p className="text-slate-900 capitalize">{job.job_type.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Dates</p>
                <p className="text-slate-900 text-xs">{job.start_date} to {job.end_date}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500 font-medium mb-1">Requisition List</p>
                {job.requisition_list_url ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-md">
                      <Eye className="w-3.5 h-3.5" /> View
                    </a>
                    <a href={job.requisition_list_url} download={job.requisition_list_name || 'requisition-list'} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                    <label className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-md cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" /> Replace
                      <input type="file" className="hidden" onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        await base44.entities.Job.update(job.id, { requisition_list_url: file_url, requisition_list_name: file.name });
                        queryClient.invalidateQueries({ queryKey: ['jobs'] });
                      }} />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 bg-slate-100 rounded-md cursor-pointer w-fit">
                    <Upload className="w-3.5 h-3.5" /> Upload
                    <input type="file" className="hidden" onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      await base44.entities.Job.update(job.id, { requisition_list_url: file_url, requisition_list_name: file.name });
                      queryClient.invalidateQueries({ queryKey: ['jobs'] });
                    }} />
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}