import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Users, ChevronDown, ChevronRight, GitBranch, UserCircle2, UserMinus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Skeleton, SkeletonText } from '@/components/StateViews';
import { formatWorkerType } from '@/utils/format';

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
const JOB_TYPE_LABELS = {
  groundworks: 'Groundworks', cp_drilling: 'CP Drilling', rotary_drilling: 'Rotary Drilling',
  enabling_works: 'Enabling Works', depot: 'Depot'
};

export default function TeamManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', parent_team_id: '', job_type: '' });
  const [presetParent, setPresetParent] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  const queryClient = useQueryClient();

  const { data: teams = [], isLoading: teamsLoading } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: staff = [], isLoading: staffLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => base44.entities.User.list() });
  const isLoading = teamsLoading || staffLoading;

  const getUserForStaff = (m) => users.find(u => u.email?.toLowerCase() === m.email?.toLowerCase());
  const statusOf = (m) => {
    if (getUserForStaff(m)) return 'active';
    if (m.invite_sent) return 'invited';
    return 'none';
  };
  const membersOf = (teamId) => staff.filter(s => s.team_id === teamId);

  const parentTeams = teams.filter(t => !t.parent_team_id);
  const subTeamsOf = (parentId) => teams.filter(t => t.parent_team_id === parentId);

  const assignedTeamIds = new Set(teams.map(t => t.id));
  const unassignedStaff = staff.filter(s => !s.team_id || !assignedTeamIds.has(s.team_id));

  const openCreate = (parentId = null) => {
    setEditingId(null);
    setFormData({ name: '', description: '', parent_team_id: parentId || '', job_type: '' });
    setPresetParent(parentId);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: formData.name, description: formData.description, parent_team_id: formData.parent_team_id || '', job_type: formData.job_type || '' };
    try {
      if (editingId) {
        await base44.entities.Team.update(editingId, payload);
      } else {
        await base44.entities.Team.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setFormData({ name: '', description: '', parent_team_id: '', job_type: '' });
      setShowForm(false);
      setEditingId(null);
      setPresetParent(null);
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };

  const handleEdit = (team) => {
    setFormData({ name: team.name, description: team.description || '', parent_team_id: team.parent_team_id || '', job_type: team.job_type || '' });
    setEditingId(team.id);
    setShowForm(true);
    setPresetParent(null);
  };

  const handleDelete = async (team) => {
    const subs = subTeamsOf(team.id);
    const members = membersOf(team.id);
    const bits = [];
    if (subs.length) bits.push(`${subs.length} sub-team${subs.length === 1 ? '' : 's'}`);
    if (members.length) bits.push(`${members.length} staff member${members.length === 1 ? '' : 's'} (they'll become unassigned)`);
    const msg = bits.length ? `This team has ${bits.join(' and ')}. Delete it anyway?` : 'Are you sure?';
    if (confirm(msg)) {
      try {
        await base44.entities.Team.delete(team.id);
        queryClient.invalidateQueries({ queryKey: ['teams'] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
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
                    <GitBranch className="w-3 h-3" /> {subs.length} sub-team{subs.length === 1 ? '' : 's'}
                  </span>
                )}
                {!isSub && totalPeople > members.length && (
                  <span className="text-xs text-slate-400">{totalPeople} people total</span>
                )}
                {team.job_type && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{JOB_TYPE_LABELS[team.job_type] || team.job_type}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1 md:gap-2 flex-shrink-0">
            {!isSub && (
              <button onClick={() => openCreate(team.id)} title="Add sub-team" className="p-1.5 md:p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <PageHeader title="Manage Teams" icon={Users} />
        <button onClick={() => openCreate()} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium self-start md:self-auto">
          <Plus className="w-4 h-4" /> Add Team
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
          <p className="text-xs text-slate-500 font-medium">Teams</p>
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

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 md:p-6 border border-emerald-200 mb-6 shadow-sm">
          <div className="space-y-4 md:space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Team Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Parent Team {presetParent && <span className="text-xs text-emerald-600 font-normal">(sub-team)</span>}
              </label>
              <select value={formData.parent_team_id} onChange={(e) => setFormData({ ...formData, parent_team_id: e.target.value })}
                disabled={!!editingId && editingId === formData.parent_team_id}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white">
                <option value="">— Top-level team group —</option>
                {parentTeams.filter(t => t.id !== editingId).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">Leave blank for a team group; pick a parent to create a sub-team under it.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Job Type</label>
              <select value={formData.job_type} onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white">
                <option value="">Flexible (any job type)</option>
                <option value="groundworks">Groundworks</option>
                <option value="cp_drilling">CP Drilling</option>
                <option value="rotary_drilling">Rotary Drilling</option>
                <option value="enabling_works">Enabling Works</option>
                <option value="depot">Depot</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Staff in this team can only be assigned to matching job types. Leave flexible for supervisors/managers.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Team Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" rows="3" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
              {editingId ? 'Update Team' : 'Add Team'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setPresetParent(null); }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

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
          No teams yet — add your first team group above, then assign staff to it from the Staff tab.
        </div>
      ) : (
        <div className="space-y-4">
          {parentTeams.map(team => <TeamCard key={team.id} team={team} />)}
        </div>
      )}

      {/* Unassigned staff */}
      {unassignedStaff.length > 0 && (
        <div className="mt-6 bg-amber-50/50 rounded-xl border border-amber-200 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <UserMinus className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Unassigned Staff ({unassignedStaff.length})</h3>
            <span className="text-xs text-slate-500">— assign them a team from the Staff tab</span>
          </div>
          <div className="bg-white rounded-lg border border-amber-100 divide-y divide-slate-50">
            {unassignedStaff.map(m => <MemberRow key={m.id} m={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}