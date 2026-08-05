import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit2, Users, UserPlus, CheckCircle2, Mail, Clock, Bell, BellOff, ShieldCheck, Hotel, Truck, KeyRound, Link2, Calendar } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import StaffComplianceEditor from '@/components/staff/StaffComplianceEditor';
import HotelBookingsManager from '@/components/staff/HotelBookingsManager';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SearchFilterBar from '@/components/SearchFilterBar';
import PrintReportButton from '@/components/PrintReportButton';
import { CardGridSkeleton } from '@/components/StateViews';
import StaffShiftEditor from '@/components/StaffShiftEditor';
import AvailabilityCalendar from '@/components/staff/AvailabilityCalendar';
import { formatWorkerType } from '@/utils/format';
import { format } from 'date-fns';
import { useConfigLists } from '@/hooks/useConfigLists';
import { useAuth } from '@/lib/AuthContext';

const workerBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

import { SYSTEM_ROLES } from '@/utils/access';

const roleBadge = {
  super_admin: 'bg-purple-100 text-purple-700 border border-purple-200',
  admin: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  management: 'bg-blue-100 text-blue-700 border border-blue-200',
  user: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  field: 'bg-amber-100 text-amber-700 border border-amber-200',
  read_only: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const roleLabel = Object.fromEntries(SYSTEM_ROLES.map(r => [r.value, r.label]));

export default function StaffManager() {
  const { toast } = useToast();
  const { getOptions } = useConfigLists();
  const workerTypeOptions = getOptions('worker_types');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(null);
  const [inviteOnCreate, setInviteOnCreate] = useState(true);
  const [shiftOpenId, setShiftOpenId] = useState(null);
  const [complianceStaff, setComplianceStaff] = useState(null);
  const [hotelStaff, setHotelStaff] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [showAvailability, setShowAvailability] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', worker_type: 'direct_employee', team_id: '', default_vehicle_id: '', manager_id: '', email_notifications_enabled: true, delivery_dashboard_enabled: false, system_role: 'field' });

  const queryClient = useQueryClient();

  const cleanPayload = (data) => {
    const cleaned = { ...data };
    ['default_vehicle_id', 'manager_id', 'team_id', 'system_role'].forEach(k => {
      if (cleaned[k] === '') delete cleaned[k];
    });
    return cleaned;
  };

  const { data: staff = [], isLoading: staffLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [], isLoading: teamsLoading } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => base44.entities.User.list().catch(() => []), enabled: !!isAdmin });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-hotel'], queryFn: () => base44.entities.Job.list() });

  const getUserForStaff = (member) => {
    if (member.user_id) return users.find(u => u.id === member.user_id);
    return users.find(u => u.email?.toLowerCase() === member.email?.toLowerCase());
  };

  // Explicitly link a Staff record to its User account (by email) and sync the
  // platform role so permissions resolve correctly. super_admin/admin on the
  // Staff record → User.role 'admin' (full platform admin); anything else → 'user'.
  const linkUserAccount = async (member, opts = {}) => {
    const user = users.find(u => u.email?.toLowerCase() === member.email?.toLowerCase());
    if (!user) {
      if (!opts.silent) toast({ title: 'No matching user account', description: 'Send an app invite first to create their login.', variant: 'destructive' });
      return null;
    }
    try {
      const wantsAdmin = member.system_role === 'admin' || member.system_role === 'super_admin';
      const targetRole = wantsAdmin ? 'admin' : 'user';
      if (member.user_id !== user.id) {
        await base44.entities.Staff.update(member.id, { user_id: user.id });
      }
      if (user.role !== targetRole) {
        try { await base44.entities.User.update(user.id, { role: targetRole }); } catch (_) {}
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      if (!opts.silent) toast({ title: 'Account linked', description: `${member.name} is now linked to their login — permissions synced.` });
      return user;
    } catch (err) {
      if (!opts.silent) toast({ title: 'Could not link account', description: err?.message, variant: 'destructive' });
      return null;
    }
  };

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
        // Sync the linked User's platform role to match the new access level
        // so permissions (e.g. platform admin for super_admin/admin) stay correct.
        const updatedMember = { ...original, ...payload, id: editingId };
        const linkedUser = getUserForStaff(updatedMember);
        if (linkedUser) {
          const wantsAdmin = (formData.system_role === 'admin' || formData.system_role === 'super_admin');
          const targetRole = wantsAdmin ? 'admin' : 'user';
          if (linkedUser.role !== targetRole || !updatedMember.user_id) {
            try {
              if (!updatedMember.user_id) await base44.entities.Staff.update(editingId, { user_id: linkedUser.id });
              if (linkedUser.role !== targetRole) await base44.entities.User.update(linkedUser.id, { role: targetRole });
              queryClient.invalidateQueries({ queryKey: ['users-list'] });
            } catch (_) {}
          }
        }
        toast({ title: 'Crew member updated' });
      } else {
        const created = await base44.entities.Staff.create(payload);
        if (inviteOnCreate && formData.email) {
          try {
            await base44.users.inviteUser(formData.email, 'user');
            await base44.entities.Staff.update(created.id, { invite_sent: true });
            // Also send the customisable branded invitation email (editable
            // in Settings → Email Alerts → App Invitation) so the crew member
            // receives your custom message in addition to the platform invite.
            try {
              await base44.functions.invoke('manageEmailAlerts', { action: 'send_invitation', email: formData.email, staff_name: formData.name });
            } catch (e) { /* branded invite is non-fatal */ }
            // Link the new Staff record to the User account created by the
            // invite and sync the platform role so permissions resolve immediately.
            await queryClient.refetchQueries({ queryKey: ['users-list'] });
            const freshUsers = queryClient.getQueryData(['users-list']) || [];
            const matchedUser = freshUsers.find(u => u.email?.toLowerCase() === formData.email.toLowerCase());
            if (matchedUser) {
              try { await base44.entities.Staff.update(created.id, { user_id: matchedUser.id }); } catch (_) {}
              const wantsAdmin = formData.system_role === 'admin' || formData.system_role === 'super_admin';
              if (matchedUser.role !== (wantsAdmin ? 'admin' : 'user')) {
                try { await base44.entities.User.update(matchedUser.id, { role: wantsAdmin ? 'admin' : 'user' }); } catch (_) {}
              }
            }
            toast({ title: 'Crew member added', description: `Invite sent to ${formData.email}${matchedUser ? ' · account linked' : ''}` });
          } catch (err) {
            toast({ title: 'Crew member added', description: 'App invite could not be sent — use the "Send app invite" button on the card.', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Crew member added' });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setFormData({ name: '', email: '', phone: '', worker_type: 'direct_employee', team_id: '', default_vehicle_id: '', manager_id: '', email_notifications_enabled: true, delivery_dashboard_enabled: false, system_role: 'field' });
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
      // Link the Staff record to the newly created User account and sync role
      await queryClient.refetchQueries({ queryKey: ['users-list'] });
      const freshUsers = queryClient.getQueryData(['users-list']) || [];
      const matchedUser = freshUsers.find(u => u.email?.toLowerCase() === member.email.toLowerCase());
      if (matchedUser) {
        try { await base44.entities.Staff.update(member.id, { user_id: matchedUser.id }); } catch (_) {}
        const wantsAdmin = member.system_role === 'admin' || member.system_role === 'super_admin';
        if (matchedUser.role !== (wantsAdmin ? 'admin' : 'user')) {
          try { await base44.entities.User.update(matchedUser.id, { role: wantsAdmin ? 'admin' : 'user' }); } catch (_) {}
        }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Invite sent', description: `${member.email}${matchedUser ? ' · account linked' : ''}` });
    } catch (error) {
      toast({ title: 'Could not send invite', description: error?.message || 'User may already have an account', variant: 'destructive' });
    }
    setInviteLoading(null);
  };

  const handleToggleDelivery = async (member) => {
    try {
      await base44.entities.Staff.update(member.id, { delivery_dashboard_enabled: !member.delivery_dashboard_enabled });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: member.delivery_dashboard_enabled ? 'Delivery access removed' : 'Delivery access granted', description: member.name });
    } catch (error) {
      toast({ title: 'Could not update', description: error?.message, variant: 'destructive' });
    }
  };

  const [resetLoading, setResetLoading] = useState(null);

  const handlePasswordReset = async (member) => {
    if (!member.email) {
      toast({ title: 'No email on file', description: 'Add an email address to this crew member first.', variant: 'destructive' });
      return;
    }
    if (!confirm(`Send a password reset link to ${member.email}?`)) return;
    setResetLoading(member.id);
    try {
      await base44.auth.resetPasswordRequest(member.email);
      toast({ title: 'Password reset link sent', description: `Check ${member.email} for instructions.` });
    } catch (error) {
      toast({ title: 'Could not send reset link', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
    setResetLoading(null);
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
    setFormData({ name: '', email: '', phone: '', worker_type: 'direct_employee', team_id: '', default_vehicle_id: '', email_notifications_enabled: true, delivery_dashboard_enabled: false, system_role: '' });
  };

  const activeCount = staff.filter(s => getUserForStaff(s)).length;
  const awaitingCount = staff.filter(s => !getUserForStaff(s) && s.invite_sent).length;
  const pendingCount = staff.filter(s => !getUserForStaff(s) && !s.invite_sent).length;

  const filteredStaff = staff.filter(member => {
    const matchesSearch = !searchQuery ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = teamFilter === 'all' || member.team_id === teamFilter;
    const matchesWorker = workerFilter === 'all' || member.worker_type === workerFilter;
    return matchesSearch && matchesTeam && matchesWorker;
  });

  return (
    <div>
      <SettingsSectionHeader
        icon={Users}
        title="Manage Crew"
        description={`${staff.length} crew member${staff.length === 1 ? '' : 's'} in total`}
        actions={
          <>
            <button
              onClick={() => setShowAvailability(!showAvailability)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg transition text-sm font-semibold ${
                showAvailability ? 'bg-[#2E5A1A] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-[#2E5A1A]/40'
              }`}
            >
              <Calendar className="w-4 h-4" /> {showAvailability ? 'Back to List' : 'Availability'}
            </button>
            <PrintReportButton buildHtml={buildStaffPrintHtml} label="Print" />
            <button onClick={resetForm} className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Add Crew Member
            </button>
          </>
        }
      />

      {showAvailability && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <AvailabilityCalendar />
        </div>
      )}

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
              { label: 'Phone Number', key: 'phone', type: 'tel', required: false },
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
                {workerTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Access Level</label>
              <select value={formData.system_role || 'field'} onChange={e => setFormData({ ...formData, system_role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="field">Field (schedule & profile only)</option>
                <option value="read_only">Read Only (read-only dashboard)</option>
                <option value="user">User (basic office access)</option>
                <option value="management">Management (operations access)</option>
                <option value="admin">Admin (full dashboard access)</option>
                <option value="super_admin">Super Admin (unrestricted + manage users)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Admin & Super Admin are also granted platform-admin rights automatically when linked to a login.</p>
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

          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input type="checkbox" checked={formData.delivery_dashboard_enabled === true} onChange={e => setFormData({ ...formData, delivery_dashboard_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm text-slate-600 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              Driver — delivery dashboard access
            </span>
          </label>
          {formData.delivery_dashboard_enabled && !formData.system_role && (
            <p className="text-xs text-amber-600 mt-1.5 ml-6">Field staff with this enabled see the Delivery Dashboard only — they won't see their schedule or profile.</p>
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
        <div className="space-y-5">
          <SearchFilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search crew by name or email..."
            showCount
            totalCount={filteredStaff.length}
            filters={[
              {
                value: teamFilter, onChange: setTeamFilter,
                options: [{ value: 'all', label: 'All Crews' }, ...teams.map(t => {
                  const parent = teams.find(p => p.id === t.parent_team_id);
                  return { value: t.id, label: parent ? `${parent.name} — ${t.name}` : t.name };
                })]
              },
              {
                value: workerFilter, onChange: setWorkerFilter,
                options: [
                  { value: 'all', label: 'All Worker Types' },
                  { value: 'direct_employee', label: 'Direct Employee' },
                  { value: 'subcontractor', label: 'Subcontractor' },
                  { value: 'agency', label: 'Agency Worker' },
                ]
              },
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredStaff.map(member => {
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

                  <div className="mb-3 flex items-center gap-2 flex-wrap">
                    {!linkedUser && (
                      member.invite_sent ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
                          <Mail className="w-3 h-3" /> Awaiting Confirmation
                        </span>
                      ) : (
                        <button onClick={() => handleInvite(member)} disabled={inviteLoading === member.id}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50">
                          <UserPlus className="w-3 h-3" /> {inviteLoading === member.id ? 'Sending...' : 'Send app invite'}
                        </button>
                      )
                    )}
                    {linkedUser && !member.user_id && (
                      <button onClick={() => linkUserAccount(member)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 font-medium border border-violet-200 hover:bg-violet-100 transition">
                        <Link2 className="w-3 h-3" /> Link account
                      </button>
                    )}
                    {linkedUser && member.user_id && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Linked
                      </span>
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
                    {member.delivery_dashboard_enabled && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-700 flex items-center gap-1 border border-blue-200">
                        <Truck className="w-3 h-3" /> Driver
                      </span>
                    )}
                    {member.system_role && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadge[member.system_role] || 'bg-slate-100 text-slate-600'}`}>
                        {roleLabel[member.system_role] || member.system_role}
                      </span>
                    )}
                  </div>

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
                    <button onClick={() => handleToggleDelivery(member)} className={`p-2 rounded-lg transition ${member.delivery_dashboard_enabled ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`} title="Delivery dashboard access"><Truck className="w-4 h-4" /></button>
                    <button onClick={() => handlePasswordReset(member)} disabled={resetLoading === member.id} className="p-2 rounded-lg transition text-amber-600 hover:bg-amber-50 disabled:opacity-50" title="Send password reset link"><KeyRound className="w-4 h-4" /></button>
                    <button onClick={() => setHotelStaff(member)} className="p-2 rounded-lg transition text-blue-600 hover:bg-blue-50" title="Hotel bookings"><Hotel className="w-4 h-4" /></button>
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

      {/* Hotel Bookings Sheet */}
      <Sheet open={!!hotelStaff} onOpenChange={(open) => !open && setHotelStaff(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Hotel className="w-5 h-5 text-blue-600" />
              {hotelStaff?.name}'s Hotel Bookings
            </SheetTitle>
          </SheetHeader>
          {hotelStaff && <HotelBookingsManager staffId={hotelStaff.id} staffName={hotelStaff.name} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}