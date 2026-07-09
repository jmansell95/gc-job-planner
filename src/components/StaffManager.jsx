import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit2, Users, UserPlus, CheckCircle2, Mail, Clock, Bell, BellOff, ShieldCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import StaffComplianceEditor from '@/components/staff/StaffComplianceEditor';
import PageHeader from '@/components/PageHeader';
import PrintReportButton from '@/components/PrintReportButton';
import { CardGridSkeleton } from '@/components/StateViews';
import StaffShiftEditor from '@/components/StaffShiftEditor';
import { formatWorkerType } from '@/utils/format';
import { format } from 'date-fns';

const workerBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

export default function StaffManager() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(null);
  const [inviteOnCreate, setInviteOnCreate] = useState(true);
  const [shiftOpenId, setShiftOpenId] = useState(null);
  const [complianceStaff, setComplianceStaff] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', worker_type: 'direct_employee', team_id: '', default_vehicle_id: '', day_rate: '', meterage_rate: '', manager_id: '', email_notifications_enabled: true });

  const queryClient = useQueryClient();

  const cleanPayload = (data) => {
    const cleaned = { ...data };
    ['day_rate', 'meterage_rate'].forEach(k => {
      if (cleaned[k] === '' || cleaned[k] == null) delete cleaned[k];
      else cleaned[k] = Number(cleaned[k]);
    });
    ['default_vehicle_id', 'manager_id', 'team_id'].forEach(k => {
      if (cleaned[k] === '') delete cleaned[k];
    });
    delete cleaned.job_role;
    return cleaned;
  };

  const { data: staff = [], isLoading: staffLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [], isLoading: teamsLoading } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => base44.entities.User.list() });

  const getUserForStaff = (member) => users.find(u => u.email?.toLowerCase() === member.email?.toLowerCase());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = cleanPayload(formData);
      if (editingId) {
        const original = staff.find(s => s.id === editingId);
        if (original && original.email && original.email.toLowerCase() !== (formData.email || '').toLowerCase()) {
          payload.invite_sent = false;
        }
        await base44.entities.Staff.update(editingId, payload);
        toast({ title: 'Crew member updated' });
      } else {
        const created = await base44.entities.Staff.create(payload);
        if (inviteOnCreate && formData.email) {
          try {
            await base44.users.inviteUser(formData.email, 'user');
            await base44.entities.Staff.update(created.id, { invite_sent: true });
            toast({ title: 'Crew member added', description: `Invite sent to ${formData.email}` });
          } catch (err) {
            toast({ title: 'Crew member added', description: 'App invite could not be sent — use the "Send app invite" button on the card.', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Crew member added' });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setFormData({ name: '', email: '', worker_type: 'direct_employee', job_role: 'groundworker', team_id: '', default_vehicle_id: '', day_rate: '', meterage_rate: '', manager_id: '', email_notifications_enabled: true });
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      toast({ title: 'Could not save crew member', description: error?.message || 'Please check all fields and try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
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
      toast({ title: `${member.name} deleted` });
    } catch (error) {
      toast({ title: 'Could not delete crew member', description: error?.message, variant: 'destructive' });
    }
  };

  const handleInvite = async (member) => {
    setInviteLoading(member.id);
    try {
      await base44.users.inviteUser(member.email, 'user');
      await base44.entities.Staff.update(member.id, { invite_sent: true });
      try {
        await base44.functions.invoke('manageEmailAlerts', { action: 'send_invitation', email: member.email, staff_name: member.name });
      } catch (e) { /* branded invite email is non-fatal */ }
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Invite sent', description: member.email });
    } catch (error) {
      toast({ title: 'Could not send invite', description: error?.message || 'User may already have an account', variant: 'destructive' });
    }
    setInviteLoading(null);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await base44.entities.User.update(userId, { role: newRole });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      toast({ title: 'Role updated' });
    } catch (error) {
      toast({ title: 'Could not update role', description: error?.message, variant: 'destructive' });
    }
  };

  const buildStaffPrintHtml = () => {
    const rows = staff.map(s =>
      `<tr><td>${s.name}</td><td>${s.email}</td><td>${formatWorkerType(s.worker_type)}</td><td>${teams.find(t => t.id === s.team_id)?.name || '—'}</td><td>${getUserForStaff(s) ? 'Yes' : 'No'}</td></tr>`
    ).join('');
    return `<!DOCTYPE html><html><head><title>Crew Report</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:16px;margin-bottom:4px}p{color:#555;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1a5c3a;color:white;padding:6px 8px;text-align:left;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafb}@media print{body{margin:10mm}}</style>
    </head><body><h1>Crew Report</h1>
    <p>${staff.length} crew members &nbsp;&middot;&nbsp; Printed ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p>
    <table><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Crew</th><th>App Access</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
  };

  const resetForm = () => {
    setShowForm(!showForm);
    setEditingId(null);
    setFormData({ name: '', email: '', worker_type: 'direct_employee', team_id: '', default_vehicle_id: '', day_rate: '', meterage_rate: '', email_notifications_enabled: true });
  };

  const activeCount = staff.filter(s => getUserForStaff(s)).length;
  const awaitingCount = staff.filter(s => !getUserForStaff(s) && s.invite_sent).length;
  const pendingCount = staff.filter(s => !getUserForStaff(s) && !s.invite_sent).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <PageHeader title="Manage Crew" icon={Users} />
        <div className="flex items-center gap-2">
          <PrintReportButton buildHtml={buildStaffPrintHtml} label="Print" />
          <button onClick={resetForm} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Crew Member
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Total Crew</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{staff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">App Access</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Awaiting Confirmation</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{awaitingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Needs Invite</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{editingId ? 'Edit Crew Member' : 'New Crew Member'}</h3>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Crew *</label>
              <select value={formData.team_id} onChange={e => setFormData({ ...formData, team_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Crew</option>
                {teams.map(t => {
                  const parent = teams.find(p => p.id === t.parent_team_id);
                  return <option key={t.id} value={t.id}>{parent ? `${parent.name} — ${t.name}` : t.name}</option>;
                })}
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

          {editingId && (
            <label className="flex items-center gap-2 mt-4 cursor-pointer">
              <input type="checkbox" checked={formData.email_notifications_enabled !== false} onChange={e => setFormData({ ...formData, email_notifications_enabled: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-slate-600 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-emerald-600" />
                Receive schedule and assignment emails
              </span>
            </label>
          )}

          <div className="flex gap-2 mt-5">
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm disabled:opacity-50">
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Add'} Crew Member
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {staffLoading || teamsLoading ? (
        <CardGridSkeleton count={6} />
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No crew yet. Add your first crew member above.</div>
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
                        <option value="viewer">Viewer</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </>
                  ) : member.invite_sent ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
                      <Mail className="w-3 h-3" /> Awaiting Confirmation
                    </span>
                  ) : (
                    <button onClick={() => handleInvite(member)} disabled={inviteLoading === member.id}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50">
                      <UserPlus className="w-3 h-3" /> {inviteLoading === member.id ? 'Sending...' : 'Send app invite'}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${workerBadge[member.worker_type] || 'bg-slate-100 text-slate-600'}`}>{formatWorkerType(member.worker_type)}</span>
                  {teams.find(t => t.id === member.team_id) && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{teams.find(t => t.id === member.team_id).name}</span>
                  )}
                  {member.email_notifications_enabled === false && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500 flex items-center gap-1">
                      <BellOff className="w-3 h-3" /> Emails off
                    </span>
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

                {/* Schedule acknowledgement status */}
                {member.last_acknowledged_week ? (
                  <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Schedule acknowledged: <span className="text-slate-600 font-medium">{format(new Date(member.last_acknowledged_week + 'T00:00:00'), 'dd MMM yyyy')}</span>{member.schedule_acknowledged_at && <span className="text-slate-400"> at {format(new Date(member.schedule_acknowledged_at), 'HH:mm')}</span>}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span>Schedule not yet acknowledged</span>
                  </div>
                )}

                <div className="flex gap-1 justify-end mt-auto">
                  <button onClick={() => setComplianceStaff(member)} className="p-2 rounded-lg transition text-emerald-600 hover:bg-emerald-50" title="Compliance"><ShieldCheck className="w-4 h-4" /></button>
                  <button onClick={() => setShiftOpenId(shiftOpenId === member.id ? null : member.id)} className={`p-2 rounded-lg transition ${shiftOpenId === member.id ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:bg-slate-100'}`} title="Shift times"><Clock className="w-4 h-4" /></button>
                  <button onClick={() => handleEdit(member)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(member)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                </div>
                {shiftOpenId === member.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Shift times</p>
                    <StaffShiftEditor staffId={member.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compliance Editor Sheet */}
      <Sheet open={!!complianceStaff} onOpenChange={(open) => !open && setComplianceStaff(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              {complianceStaff?.name}'s Compliance
            </SheetTitle>
          </SheetHeader>
          {complianceStaff && <StaffComplianceEditor staffId={complianceStaff.id} staffName={complianceStaff.name} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}