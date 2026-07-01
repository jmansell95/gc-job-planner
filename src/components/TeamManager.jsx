import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function TeamManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list()
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await base44.entities.Team.update(editingId, formData);
      } else {
        await base44.entities.Team.create(formData);
      }
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setFormData({ name: '', description: '' });
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };

  const handleEdit = (team) => {
    setFormData(team);
    setEditingId(team.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) {
      try {
        await base44.entities.Team.delete(id);
        queryClient.invalidateQueries({ queryKey: ['teams'] });
      } catch (error) {
        console.error('Error deleting team:', error);
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <PageHeader title="Manage Teams" icon={Users} />
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ name: '', description: '' });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Team
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 md:p-6 border border-green-200 mb-6 shadow-sm">
          <div className="space-y-3 md:space-y-4">
            <input
              type="text"
              placeholder="Team Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            />
            
            <textarea
              placeholder="Team Description (Optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
              rows="3"
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              {editingId ? 'Update Team' : 'Add Team'}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {teams.map((team) => (
          <div key={team.id} className="bg-white rounded-lg p-4 md:p-6 border border-green-200 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-4 gap-2">
              <div className="min-w-0">
                <h3 className="text-base md:text-lg font-bold text-slate-900 break-words">{team.name}</h3>
                <p className="text-slate-600 text-sm mt-1">{team.description || 'No description'}</p>
              </div>
              <div className="flex gap-1 md:gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(team)}
                  className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(team.id)}
                  className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}