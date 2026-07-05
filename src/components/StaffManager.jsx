import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Users, UserPlus, CheckCircle2, Mail } from 'lucide-react';
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
  const [inviteLoading, setInviteLoading] = useState(null);
  const [inviteOnCreate, setInviteOnCreate] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', worker_type: 'direct_employee', job_role: 'groundworker', team_id: '', default_vehicle_id: '', day_rate: '', meterage_rate: '', manager_id: '' });

  const queryClient = useQueryClient();

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => base44.entities.User.list() });

  const getUserForStaff = (member) => users.find(u => u.email?.toLowerCase() === member.email?.toLowerCase());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await base44.entities.Staff.update(editingId, formData);
    } else {
      await base44.entities.Staff.create(formData);
      if (inviteOnCreate && formData.email) {
        try {
          await base44.users.inviteUser(formData.email, 'user');
          queryClient.invalidateQueries({ queryKey: ['users-list'] });
        } catch (err) {
          console.error('Invite failed:', err);
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    setFormData({ name: '', email: '', worker_type: 'direct_employee', job_role: 'groundworker', team_id: '', default_vehicle_id: '', day_rate: '', meterage_rate: '', manager_id: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (m) => { setFormData(m); setEditingId(m.id); setShowForm(true); };

  const handleDelete = async (member) => {
    const linkedUser = getUserForStaff(member);
    const msg = linkedUser
      ? `Delete ${member.name}? Their linked user account will also be removed.`
      : `Delete ${member.name}?`;
    if (!confirm(msg)) return;
    try {
      if (linkedUser) {
        await base44.entities.User.delete(linkedUser.id);
        queryClient.invalidateQueries({ queryKey: ['users-list'] });
      }
      await base44.entities.Staff.delete(member.id);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleInvite = async (member) => {
    setInviteLoading(member.id);
    try {
      await base44.users.inviteUser(member.email, 'user');
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    } catch (error) {
      console.error('Error inviting:', error);
      alert(error.message || 'Failed to send invite — user may already have an account');
    }
    setInviteLoading(null);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await base44.entities.User.update(userId, { role: newRole });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const buildStaffPrintHtml = () => {
    const rows = staff.map(s =>
      `<tr><td>${s.name}</td><td>${s.email}</td><td>${roleLabels[s.job_role] || s.job_role}</td><td>${s.worker_type?.replace(/_/g,' ')}</td><td>${teams.find(t => t.id === s.team_id)?.name || '—'}</td><td>${getUserForStaff(s) ? 'Yes' : 'No'}</td></tr>`
    ).join('');
    return `<!DOCTYPE html><html><head><title>Staff Report</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:16px;margin-bottom:4px}p{color:#555;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1a5c3a;color:white;padding:6px 8px;text-align:left;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafb}@media print{body{margin:10mm}}</style>
    </head><body><h1>Staff Report</h1>
    <p>${staff.length} staff members &nbsp;&middot;&nbsp; Printed ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p>
    <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Type</th><th>Team</th><th>App Access</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
  };

  const resetForm = () => {
    setShowForm(!showForm);
    setEditingId(null);
    setFormData({ name: '', email: '', worker_type: 'direct_employee', job_role: 'groundworker', team_id: '', default_vehicle_id: '', day_rate: '', meterage_rate: '' });
  };

  const activeCount = staff.filter(s => getUserForStaff(s)).length;
  const pendingCount = staff.length - activeCount;

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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Total Staff</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{staff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">App Access</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Needs Invite</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Day Rate (GBP)</label>
              <input type="number" min="0" step="0.01" value={formData.day_rate || ''} onChange={e => setFormData({ ...formData, day_rate: e.target.value ? parseFloat(e.target.value) : '' })}
                placeholder="0.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Meterage Rate £/m (Drillers)</label>
              <input type="number" min="0" step="0.01" value={formData.meterage_rate || ''} onChange={e => setFormData({ ...formData, meterage_rate: e.target.value ? parseFloat(e.target.value) : '' })}
                placeholder="0.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Timesheet Manager</label>
              <select value={formData.manager_id || ''} onChange={e => setFormData({ ...formData, manager_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">None (Admin approves)</option>
                {staff.filter(s => s.id !== editingId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {!editingId && (
            <label className="flex items-center gap-2 mt-4 cursor-pointer">
              <input type="checkbox" checked={inviteOnCreate} onChange={e => setInviteOnCreate(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-slate-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                Send app invite so they can log in and see their schedule
              </span>
            </label>
          )}

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {staff.map(member => {
            const linkedUser = getUserForStaff(member);
            return (
              <div key={member.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition p-4 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">{member.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 truncate">{member.email}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  {linkedUser ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                      <select value={linkedUser.role || 'user'} onChange={e => handleRoleChange(linkedUser.id, e.target.value)}
                        className="text-xs px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600">
                        <option value="viewer">viewer</option>
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </>
                  ) : (
                    <button onClick={() => handleInvite(member)} disabled={inviteLoading === member.id}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50">
                      <UserPlus className="w-3 h-3" /> {inviteLoading === member.id ? 'Sending...' : 'Send app invite'}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">{roleLabels[member.job_role] || member.job_role}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${workerBadge[member.worker_type] || 'bg-slate-100 text-slate-600'}`}>{member.worker_type?.replace(/_/g, ' ')}</span>
                  {teams.find(t => t.id === member.team_id) && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{teams.find(t => t.id === member.team_id).name}</span>
                  )}
                </div>

                {(member.day_rate || member.meterage_rate) && (
                  <div className="text-xs text-slate-400 mb-3">
                    {member.day_rate && <span>£{member.day_rate}/day</span>}
                    {member.day_rate && member.meterage_rate && <span> · </span>}
                    {member.meterage_rate && <span>£{member.meterage_rate}/m</span>}
                  </div>
                )}

                {member.manager_id && staff.find(s => s.id === member.manager_id) && (
                  <div className="text-xs text-slate-400 mb-3">Approves to: <span className="text-slate-600 font-medium">{staff.find(s => s.id === member.manager_id).name}</span></div>
                )}

                <div className="flex gap-1 justify-end mt-auto">
                  <button onClick={() => handleEdit(member)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(member)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}