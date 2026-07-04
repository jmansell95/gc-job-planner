import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Users, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function TeamManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', parent_team_id: '' });
  const [presetParent, setPresetParent] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list()
  });

  const parentTeams = teams.filter(t => !t.parent_team_id);
  const subTeamsOf = (parentId) => teams.filter(t => t.parent_team_id === parentId);

  const openCreate = (parentId = null) => {
    setEditingId(null);
    setFormData({ name: '', description: '', parent_team_id: parentId || '' });
    setPresetParent(parentId);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description,
      parent_team_id: formData.parent_team_id || ''
    };
    try {
      if (editingId) {
        await base44.entities.Team.update(editingId, payload);
      } else {
        await base44.entities.Team.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setFormData({ name: '', description: '', parent_team_id: '' });
      setShowForm(false);
      setEditingId(null);
      setPresetParent(null);
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };

  const handleEdit = (team) => {
    setFormData({ name: team.name, description: team.description || '', parent_team_id: team.parent_team_id || '' });
    setEditingId(team.id);
    setShowForm(true);
  };

  const handleDelete = async (team) => {
    const subs = subTeamsOf(team.id);
    const msg = subs.length > 0
      ? `This is a team group with ${subs.length} sub-team${subs.length === 1 ? '' : 's'}. Delete it too?`
      : 'Are you sure?';
    if (confirm(msg)) {
      try {
        await base44.entities.Team.delete(team.id);
        queryClient.invalidateQueries({ queryKey: ['teams'] });
      } catch (error) {
        console.error('Error deleting team:', error);
      }
    }
  };

  const toggleCollapse = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const TeamCard = ({ team, isSub = false }) => {
    const subs = subTeamsOf(team.id);
    const isCollapsed = collapsed[team.id];
    return (
      <div className={isSub ? '' : 'bg-white rounded-lg p-4 md:p-6 border border-emerald-200 shadow-sm hover:shadow-md transition'}>
        <div className={`flex justify-between items-start ${isSub ? 'py-2.5' : 'mb-1'} gap-2`}>
          <div className="min-w-0 flex items-start gap-2">
            {!isSub && subs.length > 0 && (
              <button onClick={() => toggleCollapse(team.id)} className="mt-0.5 text-slate-400 hover:text-emerald-700 transition flex-shrink-0">
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <div className="min-w-0">
              <h3 className={`font-bold text-slate-900 break-words flex items-center gap-1.5 ${isSub ? 'text-sm' : 'text-base md:text-lg'}`}>
                {isSub && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                {team.name}
              </h3>
              <p className="text-slate-500 text-xs md:text-sm mt-0.5">{team.description || 'No description'}</p>
              {!isSub && subs.length > 0 && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  <GitBranch className="w-3 h-3" /> {subs.length} sub-team{subs.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 md:gap-2 flex-shrink-0">
            {!isSub && (
              <button
                onClick={() => openCreate(team.id)}
                title="Add sub-team"
                className="p-1.5 md:p-2 text-emerald-600 hover:bg-emerald-50 rounded transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => handleEdit(team)} className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 rounded transition">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => handleDelete(team)} className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {!isSub && subs.length > 0 && !isCollapsed && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-0.5 ml-1 border-l-2 border-emerald-100 pl-3">
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
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Team
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 md:p-6 border border-emerald-200 mb-6 shadow-sm">
          <div className="space-y-4 md:space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Team Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Parent Team {presetParent && <span className="text-xs text-emerald-600 font-normal">(sub-team)</span>}
              </label>
              <select
                value={formData.parent_team_id}
                onChange={(e) => setFormData({ ...formData, parent_team_id: e.target.value })}
                disabled={!!editingId && editingId === formData.parent_team_id}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white"
              >
                <option value="">— Top-level team group —</option>
                {parentTeams
                  .filter(t => t.id !== editingId)
                  .map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Leave blank for a team group; pick a parent to create a sub-team under it.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Team Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                rows="3"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium"
            >
              {editingId ? 'Update Team' : 'Add Team'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setPresetParent(null); }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {teams.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No teams yet — add your first team group above.</div>
      ) : (
        <div className="space-y-4">
          {parentTeams.map(team => <TeamCard key={team.id} team={team} />)}
        </div>
      )}
    </div>
  );
}