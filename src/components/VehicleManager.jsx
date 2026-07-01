import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Truck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function VehicleManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    registration_number: '',
    assigned_staff_id: '',
    team_id: ''
  });

  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list()
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list()
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list()
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await base44.entities.Vehicle.update(editingId, formData);
      } else {
        await base44.entities.Vehicle.create(formData);
      }
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setFormData({ name: '', registration_number: '', assigned_staff_id: '', team_id: '' });
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving vehicle:', error);
    }
  };

  const handleEdit = (vehicle) => {
    setFormData(vehicle);
    setEditingId(vehicle.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) {
      try {
        await base44.entities.Vehicle.delete(id);
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      } catch (error) {
        console.error('Error deleting vehicle:', error);
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <PageHeader title="Manage Vehicles" icon={Truck} />
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ name: '', registration_number: '', assigned_staff_id: '', team_id: '' });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 md:p-6 border border-green-200 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <input
              type="text"
              placeholder="Vehicle Name/Description"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            />
            <input
              type="text"
              placeholder="Registration Number"
              value={formData.registration_number}
              onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
              required
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            />
            
            <select
              value={formData.team_id}
              onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            >
              <option value="">Select Team (Optional)</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>

            <select
              value={formData.assigned_staff_id}
              onChange={(e) => setFormData({ ...formData, assigned_staff_id: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            >
              <option value="">Assign to Staff (Optional)</option>
              {staff.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              {editingId ? 'Update Vehicle' : 'Add Vehicle'}
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
              <th className="px-4 py-3 text-left font-semibold text-white">Registration</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Description</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Assigned To</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Team</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => {
              const assignedStaff = staff.find(s => s.id === vehicle.assigned_staff_id);
              return (
                <tr key={vehicle.id} className="border-b border-slate-200 hover:bg-emerald-50 transition">
                  <td className="px-4 py-3 text-slate-900 font-mono font-bold">{vehicle.registration_number}</td>
                  <td className="px-4 py-3 text-slate-600">{vehicle.name}</td>
                  <td className="px-4 py-3 text-slate-600 text-sm">{assignedStaff?.name || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 text-sm">{vehicle.team_id || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(vehicle)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(vehicle.id)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {vehicles.map((vehicle) => {
          const assignedStaff = staff.find(s => s.id === vehicle.assigned_staff_id);
          return (
            <div key={vehicle.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">{vehicle.registration_number}</h3>
                  <p className="text-sm text-slate-600 mt-1">{vehicle.name}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(vehicle)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(vehicle.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Assigned To</p>
                  <p className="text-slate-900">{assignedStaff?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Team</p>
                  <p className="text-slate-900">{vehicle.team_id || '-'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}