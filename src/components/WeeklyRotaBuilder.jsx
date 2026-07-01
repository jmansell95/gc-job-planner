import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, addDays, format } from 'date-fns';
import { Plus, Calendar, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintEmailSchedule from '@/components/PrintEmailSchedule';
import PrintReportButton from '@/components/PrintReportButton';

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

  const handleDeleteAssignment = async (id) => {
    try {
      await base44.entities.RotaAssignment.delete(id);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  const goToPrevWeek = () => setSelectedWeek(prev => addDays(prev, -7));
  const goToNextWeek = () => setSelectedWeek(prev => addDays(prev, 7));

  const buildRotaPrintHtml = () => {
    const dayLabels = days.map(d => format(d, 'EEE dd MMM'));
    const rows = staff.map(member => {
      const cells = days.map((_, i) => {
        const assignments = rotasByStaff[member.id]?.[i] || [];
        return assignments.map(a => jobs.find(j => j.id === a.job_id)?.name || '—').join(', ') || '';
      });
      return { name: member.name, cells };
    });
    return `<!DOCTYPE html><html><head><title>Weekly Rota – ${format(weekStart, 'dd MMM yyyy')}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
      h1 { font-size: 16px; margin-bottom: 4px; }
      p { color: #555; margin-bottom: 12px; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1a5c3a; color: white; padding: 6px 8px; text-align: left; font-size: 11px; }
      td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      tr:nth-child(even) td { background: #f8fafb; }
      @media print { body { margin: 10mm; } }
    </style></head><body>
    <h1>Weekly Rota</h1>
    <p>Week of ${format(weekStart, 'dd MMM yyyy')} – ${format(addDays(weekStart, 6), 'dd MMM yyyy')} &nbsp;·&nbsp; Printed ${format(new Date(), 'dd MMM yyyy HH:mm')}</p>
    <table><thead><tr><th>Staff</th>${dayLabels.map(d => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr><td><strong>${r.name}</strong></td>${r.cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></body></html>`;
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <PageHeader title="Weekly Rota" icon={Calendar} />
        <div className="flex items-center gap-2">
          <PrintReportButton buildHtml={buildRotaPrintHtml} label="Print Rota" />
          <PrintEmailSchedule weekStart={weekStart} staffId={null} />
          <button
            onClick={() => setShowAssignmentForm(!showAssignmentForm)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Assignment
          </button>
        </div>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center gap-3 mb-6 bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 w-fit">
        <button onClick={goToPrevWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="text-sm font-semibold text-slate-900 min-w-[180px] text-center">
          {format(weekStart, 'dd MMM')} — {format(addDays(weekStart, 6), 'dd MMM yyyy')}
        </div>
        <button onClick={goToNextWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <input
          type="date"
          value={format(weekStart, 'yyyy-MM-dd')}
          onChange={(e) => setSelectedWeek(new Date(e.target.value))}
          className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-600"
        />
      </div>

      {showAssignmentForm && (
        <form onSubmit={handleAddAssignment} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">New Assignment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
              <select value={formData.job_id} onChange={(e) => setFormData({ ...formData, job_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Job</option>
                {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member *</label>
              <select value={formData.staff_id} onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input type="date" value={formData.assigned_date} onChange={(e) => setFormData({ ...formData, assigned_date: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle</label>
              <select value={formData.vehicle_id} onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Vehicle (Optional)</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
              Add Assignment
            </button>
            <button type="button" onClick={() => setShowAssignmentForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Rota Grid */}
      <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-emerald-800 text-white">
                <th className="px-4 py-3 text-left font-semibold text-sm w-40">Staff</th>
                {days.map(day => {
                  const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <th key={day.toISOString()} className={`px-3 py-3 text-center font-semibold text-sm whitespace-nowrap ${isToday ? 'bg-emerald-600' : ''}`}>
                      <div className="text-xs font-normal opacity-80">{format(day, 'EEE')}</div>
                      <div>{format(day, 'dd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staff.map((member, idx) => (
                <tr key={member.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 sticky left-0 bg-inherit z-10 border-r border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-xs">{member.name.charAt(0)}</span>
                      </div>
                      <span className="font-medium text-slate-900 text-sm whitespace-nowrap">{member.name}</span>
                    </div>
                  </td>
                  {days.map((day, dayIdx) => {
                    const dayAssignments = rotasByStaff[member.id]?.[dayIdx] || [];
                    const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                      <td key={`${member.id}-${dayIdx}`} className={`px-2 py-2 align-top min-w-[110px] ${isToday ? 'bg-emerald-50/50' : ''}`}>
                        <div className="space-y-1">
                          {dayAssignments.map(assignment => {
                            const job = jobs.find(j => j.id === assignment.job_id);
                            return (
                              <div key={assignment.id} className={`group relative px-2 py-1.5 rounded-lg text-xs font-medium border-l-2 ${jobTypeColors[job?.job_type] || 'bg-slate-100 border-slate-400 text-slate-700'}`}>
                                <div className="truncate pr-4">{job?.name || 'Unknown'}</div>
                                <button
                                  onClick={() => handleDeleteAssignment(assignment.id)}
                                  className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 p-0.5 text-current hover:bg-black/10 rounded transition"
                                  title="Remove"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">No staff found. Add staff in Settings.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}