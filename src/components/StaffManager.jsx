import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintReportButton from '@/components/PrintReportButton';

const roleLabels = {
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};
const workerBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

export default function StaffManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', worker_type: 'direct_employee', job_role: 'groundworker', team_id: '', default_vehicle_id: '' });

  const queryClient = useQueryClient();

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) { await base44.entities.Staff.update(editingId, formData); }
    else { await base44.entities.Staff.create(formData); }
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    setFormData({ name: '', email: '', worker_type: 'direct_employee', job_role: 'groundworker', team_id: '', default_vehicle_id: '' });
    setShowForm(false); setEditingId(null);
  };

  const handleEdit = (m) => { setFormData(m); setEditingId(m.id); setShowForm(true); };
  const handleDelete = async (id) => {
    if (confirm('Delete this staff member?')) {
      await base44.entities.Staff.delete(id);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    }
  };

  const buildStaffPrintHtml = () => {
    const rows = staff.map(s =>
      `<tr><td>${s.name}</td><td>${s.email}</td><td>${roleLabels[s.job_role] || s.job_role}</td><td>${s.worker_type?.replace(/_/g,' ')}</td><td>${teams.find(t => t.id === s.team_id)?.name || '—'}</td></tr>`
    ).join('');
    return `<!DOCTYPE html><html><head><title>Staff Report</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:16px;margin-bottom:4px}p{color:#555;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1a5c3a;color:white;padding:6px 8px;text-align:left;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafb}@media print{body{margin:10mm}}</style>
    </head><body><h1>Staff Report</h1>
    <p>${staff.length} staff members &nbsp;&middot;&nbsp; Printed ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p>
    <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Type</th><th>Team</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
  };

  const resetForm = () => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', email: '', worker_type: 'direct_employee', job_role: 'groundworker', team_id: '', default_vehicle_id: '' }); };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <PageHeader title="Manage Staff" icon={Users} />
        <div className="flex items-center gap-2">
          <PrintReportButton buildHtml={buildStaffPrintHtml} label="Print" />
          <button onClick={resetForm} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{editingId ? 'Edit Staff Member' : 'New Staff Member'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', key: 'name', type: 'text', required: true },
              { label: 'Email Address', key: 'email', type: 'email', required: true },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}{f.required && ' *'}</label>
                <input type={f.type} value={formData[f.key]} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} required={f.required}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Worker Type</label>
              <select value={formData.worker_type} onChange={e => setFormData({ ...formData, worker_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="direct_employee">Direct Employee</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="agency">Agency Worker</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Job Role</label>
              <select value={formData.job_role} onChange={e => setFormData({ ...formData, job_role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="groundworker">Groundworker</option>
                <option value="cp_driller">CP Driller</option>
                <option value="rotary_driller">Rotary Driller</option>
                <option value="enabling_crew">Enabling Crew</option>
                <option value="depot">Depot</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Team *</label>
              <select value={formData.team_id} onChange={e => setFormData({ ...formData, team_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Team</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Default Vehicle</label>
              <select value={formData.default_vehicle_id} onChange={e => setFormData({ ...formData, default_vehicle_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">None (Optional)</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
              {editingId ? 'Update' : 'Add'} Staff Member
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No staff yet. Add your first staff member above.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-emerald-800 text-white">
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Team</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member, idx) => (
                  <tr key={member.id} className={`border-b border-slate-100 hover:bg-emerald-50 transition ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{member.name}</td>
                    <td className="px-4 py-3 text-slate-600">{roleLabels[member.job_role] || member.job_role}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${workerBadge[member.worker_type] || 'bg-slate-100 text-slate-600'}`}>
                        {member.worker_type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{teams.find(t => t.id === member.team_id)?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{member.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(member)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(member.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/tablet cards */}
          <div className="lg:hidden space-y-3">
            {staff.map(member => (
              <div key={member.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-sm">{member.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleEdit(member)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(member.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">{roleLabels[member.job_role] || member.job_role}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${workerBadge[member.worker_type] || 'bg-slate-100 text-slate-600'}`}>{member.worker_type?.replace(/_/g, ' ')}</span>
                  {teams.find(t => t.id === member.team_id) && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{teams.find(t => t.id === member.team_id).name}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}