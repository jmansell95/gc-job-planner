import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function StaffManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    worker_type: 'direct_employee',
    job_role: 'groundworker',
    team_id: '',
    default_vehicle_id: ''
  });

  const queryClient = useQueryClient();

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list()
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list()
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list()
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await base44.entities.Staff.update(editingId, formData);
      } else {
        await base44.entities.Staff.create(formData);
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setFormData({
        name: '',
        email: '',
        worker_type: 'direct_employee',
        job_role: 'groundworker',
        team_id: '',
        default_vehicle_id: ''
      });
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving staff:', error);
    }
  };

  const handleEdit = (staffMember) => {
    setFormData(staffMember);
    setEditingId(staffMember.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) {
      try {
        await base44.entities.Staff.delete(id);
        queryClient.invalidateQueries({ queryKey: ['staff'] });
      } catch (error) {
        console.error('Error deleting staff:', error);
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <PageHeader title="Manage Staff" icon={Users} />
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({
              name: '',
              email: '',
              worker_type: 'direct_employee',
              job_role: 'groundworker',
              team_id: '',
              default_vehicle_id: ''
            });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 md:p-6 border border-green-200 mb-6 shadow-sm overflow-x-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <input
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            />
            
            <select
              value={formData.worker_type}
              onChange={(e) => setFormData({ ...formData, worker_type: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            >
              <option value="direct_employee">Direct Employee</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="agency">Agency Worker</option>
            </select>

            <select
              value={formData.job_role}
              onChange={(e) => setFormData({ ...formData, job_role: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            >
              <option value="groundworker">Groundworker</option>
              <option value="cp_driller">CP Driller</option>
              <option value="rotary_driller">Rotary Driller</option>
              <option value="enabling_crew">Enabling Crew</option>
              <option value="depot">Depot</option>
              <option value="supervisor">Supervisor</option>
            </select>

            <select
              value={formData.team_id}
              onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
              required
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            >
              <option value="">Select Team</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>

            <select
              value={formData.default_vehicle_id}
              onChange={(e) => setFormData({ ...formData, default_vehicle_id: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            >
              <option value="">Select Default Vehicle (Optional)</option>
              {vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.registration_number} - {vehicle.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              {editingId ? 'Update Staff' : 'Add Staff'}
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
              <th className="px-4 py-3 text-left font-semibold text-white">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Team</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member, idx) => (
              <tr key={member.id} className="border-b border-slate-200 hover:bg-emerald-50 transition">
                <td className="px-4 py-3 text-slate-900 font-medium">{member.name}</td>
                <td className="px-4 py-3 text-slate-600 text-sm">{member.email}</td>
                <td className="px-4 py-3 text-slate-600 text-sm capitalize">{member.job_role.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-slate-600 text-sm capitalize">{member.worker_type.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-slate-600 text-sm">{member.team_id}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(member)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
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
        {staff.map((member) => (
          <div key={member.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 break-words">{member.name}</h3>
                <p className="text-xs text-slate-500 mt-1 break-words">{member.email}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEdit(member)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(member.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-slate-500 font-medium">Role</p>
                <p className="text-slate-900 capitalize">{member.job_role.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Type</p>
                <p className="text-slate-900 capitalize">{member.worker_type.replace('_', ' ')}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500 font-medium">Team</p>
                <p className="text-slate-900">{member.team_id}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}