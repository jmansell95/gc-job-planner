import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, addDays, format } from 'date-fns';
import { Plus } from 'lucide-react';
import PrintEmailSchedule from '@/components/PrintEmailSchedule';

export default function WeeklyRotaBuilder() {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [formData, setFormData] = useState({
    job_id: '',
    staff_id: '',
    assigned_date: '',
    vehicle_id: ''
  });

  const queryClient = useQueryClient();
  const weekStart = startOfWeek(selectedWeek);

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list()
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list()
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list()
  });

  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas', weekStart.toISOString()],
    queryFn: async () => {
      const assignments = await base44.entities.RotaAssignment.list();
      return assignments.filter(a => a.week_start === format(weekStart, 'yyyy-MM-dd'));
    }
  });

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    try {
      await base44.entities.RotaAssignment.create({
        ...formData,
        week_start: format(weekStart, 'yyyy-MM-dd')
      });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      setFormData({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '' });
      setShowAssignmentForm(false);
    } catch (error) {
      console.error('Error adding assignment:', error);
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group rotas by staff
  const rotasByStaff = {};
  staff.forEach(s => {
    rotasByStaff[s.id] = Array.from({ length: 7 }, () => []);
  });
  
  rotas.forEach(rota => {
    const dayIndex = days.findIndex(d => format(d, 'yyyy-MM-dd') === rota.assigned_date);
    if (dayIndex !== -1 && rotasByStaff[rota.staff_id]) {
      rotasByStaff[rota.staff_id][dayIndex].push(rota);
    }
  });

  const jobTypeColors = {
    groundworks: 'bg-green-100 border-green-500 text-green-900',
    cp_drilling: 'bg-amber-100 border-amber-500 text-amber-900',
    rotary_drilling: 'bg-blue-100 border-blue-500 text-blue-900',
    enabling_works: 'bg-purple-100 border-purple-500 text-purple-900',
    depot: 'bg-slate-100 border-slate-500 text-slate-900'
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Weekly Rota Builder</h2>
        <div className="flex gap-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Week starting:</label>
            <input
              type="date"
              value={format(weekStart, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedWeek(new Date(e.target.value))}
              className="ml-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            />
          </div>
          <button
            onClick={() => setShowAssignmentForm(!showAssignmentForm)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Assignment
          </button>
        </div>
      </div>

      {/* Print/Email Controls */}
      <div className="mb-6">
        <PrintEmailSchedule 
          weekStart={weekStart}
          staffId={null}
        />
      </div>

      {showAssignmentForm && (
        <form onSubmit={handleAddAssignment} className="bg-white rounded-lg p-6 border border-green-200 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={formData.job_id}
              onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
              required
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            >
              <option value="">Select Job</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>{job.name}</option>
              ))}
            </select>

            <select
              value={formData.staff_id}
              onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
              required
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            >
              <option value="">Select Staff</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={formData.assigned_date}
              onChange={(e) => setFormData({ ...formData, assigned_date: e.target.value })}
              required
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            />

            <select
              value={formData.vehicle_id}
              onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-600"
            >
              <option value="">Select Vehicle (Optional)</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.registration_number} - {v.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Add Assignment
            </button>
            <button
              type="button"
              onClick={() => setShowAssignmentForm(false)}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Rota Grid */}
      <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="px-4 py-3 text-left font-semibold text-sm">Staff</th>
                {days.map(day => (
                  <th key={day.toISOString()} className="px-4 py-3 text-center font-semibold text-sm whitespace-nowrap">
                    <div>{format(day, 'EEE')}</div>
                    <div className="text-xs font-normal">{format(day, 'MMM d')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((member, idx) => (
                <tr key={member.id} className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-4 py-3 font-medium text-slate-900 text-sm sticky left-0 bg-inherit">
                    {member.name}
                  </td>
                  {days.map((day, dayIdx) => {
                    const dayAssignments = rotasByStaff[member.id]?.[dayIdx] || [];
                    return (
                      <td key={`${member.id}-${dayIdx}`} className="px-2 py-2 text-center">
                        <div className="space-y-1">
                          {dayAssignments.map(assignment => {
                            const job = jobs.find(j => j.id === assignment.job_id);
                            return (
                              <div
                                key={assignment.id}
                                className={`px-2 py-1 rounded text-xs font-medium border-l-2 ${jobTypeColors[job?.job_type] || 'bg-slate-100'}`}
                              >
                                {job?.name.substring(0, 15)}...
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}