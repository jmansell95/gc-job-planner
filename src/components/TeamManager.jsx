import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Users, ChevronDown, ChevronRight, GitBranch, UserCircle2, UserMinus, Check, Shield, GraduationCap, PoundSterling, LayoutGrid, Briefcase } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ChipMultiSelect from '@/components/forms/ChipMultiSelect';
import FormSection from '@/components/forms/FormSection';
import { Skeleton, SkeletonText } from '@/components/StateViews';
import { formatWorkerType } from '@/utils/format';
import { useConfigLists } from '@/hooks/useConfigLists';
import { useAuth } from '@/lib/AuthContext';
import { TEAM_CATEGORIES, LANDING_PAGES, CAPABILITY_KEYS, DEFAULT_CAPABILITIES, DEFAULT_LANDING_PAGE } from '@/utils/teamAccess';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { useDivision } from '@/contexts/DivisionContext';

const workerBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

const statusDot = {
  active: 'bg-emerald-500',
  invited: 'bg-blue-400',
  none: 'bg-slate-300',
};
const blankForm = () => ({ name: '', description: '', parent_team_id: '', job_type: '', category: '', default_landing_page: '', allowed_tool_access: [], revenue_stream_type: '', billing_default_markup: 0, compatible_asset_types: [], required_qualifications: [], is_supervisor_team: false, supervisor_staff_id: '', managed_team_ids: [] });

export default function TeamManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(blankForm());
  const [presetParent, setPresetParent] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  const queryClient = useQueryClient();

  const { activeDivisionId } = useDivision();
  const { data: teams = [], isLoading: teamsLoading } = useScopedEntity('Team', { queryKey: ['teams'] });
  const { data: staff = [], isLoading: staffLoading } = useScopedEntity('Staff', { queryKey: ['staff'] });
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => base44.entities.User.list().catch(() => []), enabled: !!isAdmin });
  const isLoading = teamsLoading || staffLoading;

  // Dynamic dropdown options — fetched from ConfigList (editable in Settings → Dropdown Manager)
  const { getOptions } = useConfigLists();
  const JOB_TYPE_OPTIONS = getOptions('team_job_types');
  const REVENUE_STREAMS = getOptions('revenue_streams');
  const ASSET_TYPE_OPTIONS = getOptions('asset_types');
  const QUALIFICATION_OPTIONS = getOptions('qualifications');
  const JOB_TYPE_LABELS = Object.fromEntries(JOB_TYPE_OPTIONS.map(o => [o.value, o.label]));

  const getUserForStaff = (m) => users.find(u => u.email?.toLowerCase() === m.email?.toLowerCase());
  const statusOf = (m) => {
    if (getUserForStaff(m)) return 'active';
    if (m.invite_sent) return 'invited';
    return 'none';
  };
  const membersOf = (teamId) => staff.filter(s => s.team_id === teamId);

  const teamIds = new Set(teams.map(t => t.id));
  const parentTeams = teams.filter(t => !t.parent_team_id || !teamIds.has(t.parent_team_id));
  const subTeamsOf = (parentId) => teams.filter(t => t.parent_team_id === parentId && teamIds.has(parentId));

  const unassignedStaff = staff.filter(s => !s.team_id || !teamIds.has(s.team_id));

  const openCreate = (parentId = null) => {
    setEditingId(null);
    setFormData(blankForm());
    setPresetParent(parentId);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setPresetParent(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: formData.name, description: formData.description, parent_team_id: formData.parent_team_id || '', job_type: formData.job_type || '', category: formData.category || '', default_landing_page: formData.default_landing_page || '', allowed_tool_access: formData.allowed_tool_access || [], revenue_stream_type: formData.revenue_stream_type || '', billing_default_markup: Number(formData.billing_default_markup) || 0, compatible_asset_types: formData.compatible_asset_types || [], required_qualifications: formData.required_qualifications || [], is_supervisor_team: formData.is_supervisor_team || false, supervisor_staff_id: formData.supervisor_staff_id || '', managed_team_ids: formData.managed_team_ids || [] };
    try {
      if (editingId) {
        await base44.entities.Team.update(editingId, payload);
      } else {
        await base44.entities.Team.create({ ...payload, division_id: activeDivisionId });
      }
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Team'] });
      setFormData(blankForm());
      closeForm();
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };

  const handleEdit = (team) => {
    setFormData({ name: team.name, description: team.description || '', parent_team_id: team.parent_team_id || '', job_type: team.job_type || '', category: team.category || '', default_landing_page: team.default_landing_page || '', allowed_tool_access: team.allowed_tool_access || [], revenue_stream_type: team.revenue_stream_type || '', billing_default_markup: team.billing_default_markup ?? 0, compatible_asset_types: team.compatible_asset_types || [], required_qualifications: team.required_qualifications || [], is_supervisor_team: team.is_supervisor_team || false, supervisor_staff_id: team.supervisor_staff_id || '', managed_team_ids: team.managed_team_ids || [] });
    setEditingId(team.id);
    setPresetParent(null);
    setShowForm(true);
  };

  const handleDelete = async (team) => {
    const subs = subTeamsOf(team.id);
    const members = membersOf(team.id);
    const bits = [];
    if (subs.length) bits.push(`${subs.length} sub-crew${subs.length === 1 ? '' : 's'}`);
    if (members.length) bits.push(`${members.length} crew member${members.length === 1 ? '' : 's'} (they'll become unassigned)`);
    const msg = bits.length ? `This crew has ${bits.join(' and ')}. Delete it anyway?` : 'Are you sure?';
    if (confirm(msg)) {
      try {
        await base44.entities.Team.delete(team.id);
        queryClient.invalidateQueries({ queryKey: ['scoped', 'Team'] });
        queryClient.invalidateQueries({ queryKey: ['scoped', 'Staff'] });
      } catch (error) {
        console.error('Error deleting team:', error);
      }
    }
  };

  const toggleCollapse = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const MemberRow = ({ m }) => (
    <div className="flex items-center gap-2.5 py-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-xs">{m.name.charAt(0)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">{m.name}</p>
        <p className="text-xs text-slate-500 truncate">{formatWorkerType(m.worker_type)}</p>
      </div>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[statusOf(m)]}`} title={statusOf(m)} />
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${workerBadge[m.worker_type] || 'bg-slate-100 text-slate-600'}`}>
        {formatWorkerType(m.worker_type)}
      </span>
    </div>
  );

  const TeamCard = ({ team, isSub = false }) => {
    const subs = subTeamsOf(team.id);
    const members = membersOf(team.id);
    const isCollapsed = collapsed[team.id];
    const subMemberCount = subs.reduce((sum, s) => sum + membersOf(s.id).length, 0);
    const totalPeople = members.length + subMemberCount;
    return (
      <div className={isSub ? '' : 'bg-white rounded-xl p-4 md:p-6 border border-slate-200 shadow-sm hover:shadow-md transition'}>
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex items-start gap-2 flex-1">
            {!isSub && (subs.length > 0 || members.length > 0) && (
              <button onClick={() => toggleCollapse(team.id)} className="mt-0.5 text-slate-400 hover:text-emerald-700 transition flex-shrink-0">
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <div className="min-w-0">
              <h3 className={`font-bold text-slate-900 break-words flex items-center gap-1.5 ${isSub ? 'text-sm' : 'text-base md:text-lg'}`}>
                {isSub && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                {team.name}
              </h3>
              {team.description && <p className="text-slate-500 text-xs md:text-sm mt-0.5">{team.description}</p>}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {members.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    <UserCircle2 className="w-3 h-3" /> {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                )}
                {!isSub && subs.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    <GitBranch className="w-3 h-3" /> {subs.length} sub-crew{subs.length === 1 ? '' : 's'}
                  </span>
                )}
                {!isSub && totalPeople > members.length && (
                  <span className="text-xs text-slate-400">{totalPeople} people total</span>
                )}
                {team.category && (
                  <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">{TEAM_CATEGORIES.find(c => c.value === team.category)?.label || team.category}</span>
                )}
                {team.default_landing_page && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">→ {LANDING_PAGES.find(p => p.value === team.default_landing_page)?.label || team.default_landing_page}</span>
                )}
                {team.job_type && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{JOB_TYPE_LABELS[team.job_type] || team.job_type}</span>
                )}
                {team.revenue_stream_type && team.revenue_stream_type !== 'none' && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    £ {REVENUE_STREAMS.find(r => r.value === team.revenue_stream_type)?.label.split(' (')[0] || team.revenue_stream_type}
                    {team.billing_default_markup > 0 && ` · +${team.billing_default_markup}%`}
                  </span>
                )}
                {team.compatible_asset_types && team.compatible_asset_types.length > 0 && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                    {team.compatible_asset_types.map(t => ASSET_TYPE_OPTIONS.find(o => o.value === t)?.label || t).join(', ')}
                  </span>
                )}
                {team.required_qualifications && team.required_qualifications.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                    <GraduationCap className="w-3 h-3" /> {team.required_qualifications.length} qual{team.required_qualifications.length !== 1 ? 's' : ''}
                  </span>
                )}
                {team.is_supervisor_team && (
                  <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    <Shield className="w-3 h-3" /> Supervisor
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1 md:gap-2 flex-shrink-0">
            {!isSub && (
              <button onClick={() => openCreate(team.id)} title="Add sub-crew" className="p-1.5 md:p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => handleEdit(team)} className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => handleDelete(team)} className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isCollapsed && members.length > 0 && (
          <div className={`mt-3 ${isSub ? '' : 'border-t border-slate-100 pt-2'}`}>
            <div className="divide-y divide-slate-50">
              {members.map(m => <MemberRow key={m.id} m={m} />)}
            </div>
          </div>
        )}

        {!isSub && subs.length > 0 && !isCollapsed && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 ml-1 border-l-2 border-emerald-100 pl-3">
            {subs.map(sub => <TeamCard key={sub.id} team={sub} isSub />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Users}
        title="Manage Crews"
        description={`${teams.length} crew${teams.length === 1 ? '' : 's'} · ${staff.length - unassignedStaff.length} assigned`}
        actions={
          <button onClick={() => openCreate()} className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-semibold shadow-sm">
            <Plus className="w-4 h-4" /> Add Crew
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
          <p className="text-xs text-slate-500 font-medium">Crews</p>
          <p className="text-xl md:text-2xl font-bold text-slate-900 mt-1">{teams.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
          <p className="text-xs text-slate-500 font-medium">Assigned</p>
          <p className="text-xl md:text-2xl font-bold text-emerald-700 mt-1">{staff.length - unassignedStaff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
          <p className="text-xs text-slate-500 font-medium">Unassigned</p>
          <p className="text-xl md:text-2xl font-bold text-amber-600 mt-1">{unassignedStaff.length}</p>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Crew' : 'Add Crew'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormSection title="Core Details" icon={Users} description="Name, hierarchy and job type">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Crew Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Parent Crew {presetParent && <span className="text-xs text-emerald-600 font-normal">(sub-crew)</span>}
                </label>
                <select value={formData.parent_team_id} onChange={(e) => setFormData({ ...formData, parent_team_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white">
                  <option value="">— Top-level crew group —</option>
                  {parentTeams.filter(t => t.id !== editingId).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1">Leave blank for a crew group; pick a parent to create a sub-crew under it.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Job Type</label>
                <select value={formData.job_type} onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white">
                  <option value="">Flexible (any job type)</option>
                  {JOB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1">Crew members in this crew can only be assigned to matching job types. Leave flexible for supervisors/managers. Coring &amp; Trial Pit crews sit under the Groundworks parent.</p>
              </div>
            </FormSection>

            <FormSection title="Revenue & Billing" icon={PoundSterling} description="How this crew earns and what they're qualified to use" columns={false}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Revenue Stream</label>
                  <select value={formData.revenue_stream_type} onChange={(e) => setFormData({ ...formData, revenue_stream_type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white">
                    {REVENUE_STREAMS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  {formData.revenue_stream_type && (
                    <p className="text-xs text-slate-400 mt-1">{REVENUE_STREAMS.find(r => r.value === formData.revenue_stream_type)?.description}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Default Billing Markup %</label>
                  <input type="number" min="0" step="0.1" value={formData.billing_default_markup} onChange={(e) => setFormData({ ...formData, billing_default_markup: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" placeholder="0" />
                  <p className="text-xs text-slate-400 mt-1">Applied as the starting markup when this crew is assigned to a job.</p>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-2">Compatible Asset Types</label>
                <ChipMultiSelect options={ASSET_TYPE_OPTIONS} value={formData.compatible_asset_types || []}
                  onChange={(next) => setFormData({ ...formData, compatible_asset_types: next })} columns={3}
                  hint="Only compatible assets are offered when this crew's equipment is selected on a job." />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Required Qualifications &amp; Training
                </label>
                <ChipMultiSelect options={QUALIFICATION_OPTIONS} value={formData.required_qualifications || []}
                  onChange={(next) => setFormData({ ...formData, required_qualifications: next })} columns={3} color="violet"
                  hint="Staff missing these qualifications are flagged in the Training Gaps dashboard. Red dot = critical (e.g. CSCS card required on site)." />
              </div>
            </FormSection>

            <FormSection title="Crew Description" icon={Briefcase} description="Internal notes about this crew">
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" rows="3" />
            </FormSection>

            <FormSection title="Access & Landing Page" icon={LayoutGrid} description="Where this crew lands and what they can see" columns={false}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Top-Level Group</label>
                  <select value={formData.category} onChange={(e) => {
                    const cat = e.target.value;
                    setFormData({
                      ...formData,
                      category: cat,
                      default_landing_page: DEFAULT_LANDING_PAGE[cat] || formData.default_landing_page,
                      allowed_tool_access: formData.allowed_tool_access.length === 0 ? (DEFAULT_CAPABILITIES[cat] || []) : formData.allowed_tool_access
                    });
                  }} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white">
                    <option value="">— Select group —</option>
                    {TEAM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {formData.category && (
                    <p className="text-xs text-slate-400 mt-1">{TEAM_CATEGORIES.find(c => c.value === formData.category)?.description}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Default Landing Page <span className="text-slate-400">(first page after login)</span></label>
                  <div className="grid grid-cols-1 gap-2">
                    {LANDING_PAGES.map(p => (
                      <button type="button" key={p.value} onClick={() => setFormData({ ...formData, default_landing_page: p.value })}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition text-left ${formData.default_landing_page === p.value ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Admin Tool Access</label>
                <ChipMultiSelect options={CAPABILITY_KEYS.map(cap => ({ value: cap.key, label: cap.label }))} value={formData.allowed_tool_access}
                  onChange={(next) => setFormData({ ...formData, allowed_tool_access: next })} columns={2}
                  hint="Pick which sections this crew can access. Field crews typically only need Schedule View. Selecting a group above auto-fills sensible defaults." />
              </div>
            </FormSection>

            <FormSection title="Supervisor Settings" icon={Shield} description="Link this crew to the crews it oversees" columns={false}>
              <div className="mb-4">
                <button type="button" onClick={() => setFormData({ ...formData, is_supervisor_team: !formData.is_supervisor_team })}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition text-left ${formData.is_supervisor_team ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${formData.is_supervisor_team ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                    {formData.is_supervisor_team && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  This is a supervisor team (oversees other crews)
                </button>
                <p className="text-xs text-slate-400 mt-1">Enable for supervisor teams like a Drilling Supervisor who manages all CP and Rotary crews.</p>
              </div>
              {formData.is_supervisor_team && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Supervisor</label>
                      <select value={formData.supervisor_staff_id} onChange={(e) => setFormData({ ...formData, supervisor_staff_id: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white">
                        <option value="">— Select supervisor —</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Managed Crews</label>
                    <ChipMultiSelect options={teams.filter(t => t.id !== editingId).map(t => ({ value: t.id, label: t.name }))}
                      value={formData.managed_team_ids} onChange={(next) => setFormData({ ...formData, managed_team_ids: next })} columns={2}
                      hint="Pick which crews this supervisor oversees. They'll see a production overview of these crews on their dashboard." />
                  </div>
                </>
              )}
            </FormSection>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
                {editingId ? 'Update Crew' : 'Add Crew'}
              </button>
              <button type="button" onClick={closeForm}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm">
                Cancel
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
              <Skeleton className="h-5 w-1/3 mb-3" />
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          No crews yet — add your first crew group above, then assign crew members to it from the Crews tab.
        </div>
      ) : (
        <div className="space-y-4">
          {parentTeams.map(team => <TeamCard key={team.id} team={team} />)}
        </div>
      )}

      {unassignedStaff.length > 0 && (
        <div className="mt-6 bg-amber-50/50 rounded-xl border border-amber-200 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <UserMinus className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Unassigned Crew ({unassignedStaff.length})</h3>
            <span className="text-xs text-slate-500">— assign them a crew from the Crews tab</span>
          </div>
          <div className="bg-white rounded-lg border border-amber-100 divide-y divide-slate-50">
            {unassignedStaff.map(m => <MemberRow key={m.id} m={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}