import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, addDays, format, subWeeks } from 'date-fns';
import {
  Plus, Calendar, ChevronLeft, ChevronRight, Trash2, X, Copy,
  AlertTriangle, MapPin, Truck, Clock, CheckCircle2, PlayCircle, ClipboardCheck,
  Users, Briefcase
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintEmailSchedule from '@/components/PrintEmailSchedule';
import PrintReportButton from '@/components/PrintReportButton';

const jobTypeColors = {
  groundworks: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-800', dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  cp_drilling: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  rotary_drilling: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  enabling_works: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-800', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  depot: { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-700', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' }
};

const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, dot: 'bg-slate-400', text: 'text-slate-500' },
  started: { label: 'Started', icon: PlayCircle, dot: 'bg-blue-500', text: 'text-blue-600' },
  completed: { label: 'Done', icon: CheckCircle2, dot: 'bg-emerald-500', text: 'text-emerald-600' }
};

export default function WeeklyRotaBuilder() {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(null);
  const [smartFillLoading, setSmartFillLoading] = useState(false);
  const [formData, setFormData] = useState({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '' });

  const queryClient = useQueryClient();
  const weekStart = startOfWeek(selectedWeek);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });

  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas', weekStartStr],
    queryFn: async () => {
      const all = await base44.entities.RotaAssignment.list();
      return all.filter(a => a.week_start === weekStartStr);
    }
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const rotasByStaff = {};
  staff.forEach(s => { rotasByStaff[s.id] = Array.from({ length: 7 }, () => []); });
  rotas.forEach(rota => {
    const dayIndex = days.findIndex(d => format(d, 'yyyy-MM-dd') === rota.assigned_date);
    if (dayIndex !== -1 && rotasByStaff[rota.staff_id]) {
      rotasByStaff[rota.staff_id][dayIndex].push(rota);
    }
  });

  const checkConflict = (staffId, date) => {
    return rotas.some(r => r.staff_id === staffId && r.assigned_date === date);
  };

  const handleStaffChange = (staffId) => {
    setFormData(prev => ({ ...prev, staff_id: staffId }));
    if (staffId && formData.assigned_date) {
      setConflictWarning(checkConflict(staffId, formData.assigned_date) ? 'This staff member is already assigned on this date.' : null);
    } else setConflictWarning(null);
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, assigned_date: date }));
    if (date && formData.staff_id) {
      setConflictWarning(checkConflict(formData.staff_id, date) ? 'This staff member is already assigned on this date.' : null);
    } else setConflictWarning(null);
  };

  const handleCellClick = (staffId, dateStr) => {
    setFormData({ job_id: '', staff_id: staffId, assigned_date: dateStr, vehicle_id: '' });
    setConflictWarning(null);
    setShowAssignmentForm(true);
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    if (checkConflict(formData.staff_id, formData.assigned_date)) {
      if (!confirm('This staff member is already assigned on this date. Add anyway?')) return;
    }
    try {
      await base44.entities.RotaAssignment.create({
        ...formData,
        week_start: weekStartStr,
        status: 'assigned'
      });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      setFormData({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '' });
      setShowAssignmentForm(false);
      setConflictWarning(null);
    } catch (error) {
      console.error('Error adding assignment:', error);
    }
  };

  const handleDeleteAssignment = async (id) => {
    try {
      await base44.entities.RotaAssignment.delete(id);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  const handleSmartFill = async () => {
    const prevWeekStart = subWeeks(weekStart, 1);
    const prevWeekStr = format(prevWeekStart, 'yyyy-MM-dd');
    setSmartFillLoading(true);
    try {
      const all = await base44.entities.RotaAssignment.list();
      const prevWeekRotas = all.filter(r => r.week_start === prevWeekStr);
      if (prevWeekRotas.length === 0) {
        alert('No assignments found for last week to copy.');
        setSmartFillLoading(false);
        return;
      }
      if (!confirm(`Copy ${prevWeekRotas.length} assignments from last week to this week?`)) {
        setSmartFillLoading(false);
        return;
      }
      const newAssignments = prevWeekRotas.map(r => {
        const prevDate = new Date(r.assigned_date + 'T00:00:00');
        return {
          job_id: r.job_id,
          staff_id: r.staff_id,
          assigned_date: format(addDays(prevDate, 7), 'yyyy-MM-dd'),
          vehicle_id: r.vehicle_id || '',
          week_start: weekStartStr,
          status: 'assigned'
        };
      });
      await base44.entities.RotaAssignment.bulkCreate(newAssignments);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error smart filling:', error);
      alert('Failed to copy assignments.');
    }
    setSmartFillLoading(false);
  };

  const goToPrevWeek = () => setSelectedWeek(prev => addDays(prev, -7));
  const goToNextWeek = () => setSelectedWeek(prev => addDays(prev, 7));

  // Stats
  const totalAssignments = rotas.length;
  const staffWorking = [...new Set(rotas.map(r => r.staff_id))].length;
  const jobsActive = [...new Set(rotas.map(r => r.job_id))].length;

  const buildRotaPrintHtml = () => {
    const dayLabels = days.map(d => format(d, 'EEE dd MMM'));
    const rows = staff.map(member => {
      const cells = days.map((_, i) => {
        const cellRotas = rotasByStaff[member.id]?.[i] || [];
        return cellRotas.map(a => {
          const job = jobs.find(j => j.id === a.job_id);
          const vehicle = vehicles.find(v => v.id === a.vehicle_id);
          return job ? `${job.name}${vehicle ? ' (' + vehicle.registration_number + ')' : ''}` : '—';
        }).join(', ') || '';
      });
      return { name: member.name, cells };
    });
    return `<!DOCTYPE html><html><head><title>Weekly Rota – ${format(weekStart, 'dd MMM yyyy')}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:16px;margin-bottom:4px}p{color:#555;margin-bottom:12px;font-size:11px}table{width:100%;border-collapse:collapse}th{background:#1a5c3a;color:white;padding:6px 8px;text-align:left;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}tr:nth-child(even) td{background:#f8fafb}@media print{body{margin:10mm}}</style></head><body>
    <h1>Weekly Rota</h1><p>Week of ${format(weekStart, 'dd MMM yyyy')} – ${format(addDays(weekStart, 6), 'dd MMM yyyy')} &nbsp;·&nbsp; ${totalAssignments} assignments &nbsp;·&nbsp; Printed ${format(new Date(), 'dd MMM yyyy HH:mm')}</p>
    <table><thead><tr><th>Staff</th>${dayLabels.map(d => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr><td><strong>${r.name}</strong></td>${r.cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <PageHeader title="Weekly Rota Builder" icon={Calendar} />
        <div className="flex flex-wrap items-center gap-2">
          <PrintReportButton buildHtml={buildRotaPrintHtml} label="Print Rota" />
          <PrintEmailSchedule weekStart={weekStart} staffId={null} />
          <button onClick={handleSmartFill} disabled={smartFillLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
            <Copy className="w-4 h-4" /> {smartFillLoading ? 'Copying...' : 'Smart Fill'}
          </button>
          <button onClick={() => { setShowAssignmentForm(!showAssignmentForm); setFormData({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '' }); setConflictWarning(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Assignment
          </button>
        </div>
      </div>

      {/* Week Navigator + Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 w-fit">
          <button onClick={goToPrevWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
          <div className="text-sm font-semibold text-slate-900 min-w-[180px] text-center">
            {format(weekStart, 'dd MMM')} — {format(addDays(weekStart, 6), 'dd MMM yyyy')}
          </div>
          <button onClick={goToNextWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <input type="date" value={weekStartStr} onChange={(e) => setSelectedWeek(new Date(e.target.value))}
            className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-600" />
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-2 shadow-sm">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span className="text-sm font-bold text-slate-900">{totalAssignments}</span>
            <span className="text-xs text-slate-500">assignments</span>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-2 shadow-sm">
            <Users className="w-4 h-4 text-emerald-700" />
            <span className="text-sm font-bold text-slate-900">{staffWorking}</span>
            <span className="text-xs text-slate-500">staff working</span>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-2 shadow-sm">
            <Briefcase className="w-4 h-4 text-emerald-700" />
            <span className="text-sm font-bold text-slate-900">{jobsActive}</span>
            <span className="text-xs text-slate-500">jobs active</span>
          </div>
        </div>
      </div>

      {/* Assignment Form */}
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
              <select value={formData.staff_id} onChange={(e) => handleStaffChange(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input type="date" value={formData.assigned_date} onChange={(e) => handleDateChange(e.target.value)} required
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
          {conflictWarning && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {conflictWarning}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">Add Assignment</button>
            <button type="button" onClick={() => setShowAssignmentForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Desktop Grid */}
      <div className="hidden lg:block bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-emerald-800 text-white">
                <th className="px-4 py-3 text-left font-semibold text-sm w-44 sticky left-0 z-10 bg-emerald-800">Staff</th>
                {days.map(day => {
                  const isToday = format(day, 'yyyy-MM-dd') === todayStr;
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
                  <td className="px-4 py-3 sticky left-0 z-10 bg-inherit border-r border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-xs">{member.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm whitespace-nowrap truncate">{member.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{member.job_role?.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </td>
                  {days.map((day, dayIdx) => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const dayAssignments = rotasByStaff[member.id]?.[dayIdx] || [];
                    const isToday = dayStr === todayStr;
                    return (
                      <td key={`${member.id}-${dayIdx}`} className={`px-2 py-2 align-top min-w-[130px] ${isToday ? 'bg-emerald-50/40' : ''} group/cell`}>
                        <div className="space-y-1.5">
                          {dayAssignments.map(assignment => {
                            const job = jobs.find(j => j.id === assignment.job_id);
                            const vehicle = vehicles.find(v => v.id === assignment.vehicle_id);
                            const client = clients.find(c => c.id === job?.client_id);
                            const colors = jobTypeColors[job?.job_type] || jobTypeColors.depot;
                            const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
                            const StatusIcon = status.icon;
                            const briefingSigned = assignment.briefing_signed;
                            return (
                              <div key={assignment.id} className={`group relative px-2.5 py-2 rounded-lg text-xs border-l-[3px] ${colors.bg} ${colors.border}`}>
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <span className="font-semibold text-slate-900 truncate flex-1">{job?.name || 'Unknown'}</span>
                                  <button onClick={() => handleDeleteAssignment(assignment.id)}
                                    className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 rounded transition">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                {job?.location && (
                                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                    <span className="truncate">{job.location}</span>
                                  </div>
                                )}
                                {vehicle && (
                                  <div className="flex items-center gap-1 text-slate-500 mb-1">
                                    <Truck className="w-2.5 h-2.5 flex-shrink-0" />
                                    <span className="font-mono truncate">{vehicle.registration_number}</span>
                                  </div>
                                )}
                                {client && (
                                  <div className="text-slate-400 truncate mb-1">{client.name}</div>
                                )}
                                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50">
                                  <span className={`inline-flex items-center gap-0.5 ${status.text}`}>
                                    <StatusIcon className="w-2.5 h-2.5" />
                                    <span className="text-[10px] font-medium">{status.label}</span>
                                  </span>
                                  {briefingSigned && (
                                    <span className="inline-flex items-center gap-0.5 text-emerald-600">
                                      <ClipboardCheck className="w-2.5 h-2.5" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <button onClick={() => handleCellClick(member.id, dayStr)}
                            className="w-full py-1 text-[10px] text-slate-300 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg transition flex items-center justify-center gap-0.5 opacity-0 group-hover/cell:opacity-100">
                            <Plus className="w-2.5 h-2.5" /> Add
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">No staff found. Add staff in Settings.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Day Cards */}
      <div className="lg:hidden space-y-3">
        {days.map((day, dayIdx) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const isToday = dayStr === todayStr;
          const dayAssignments = rotas.filter(r => r.assigned_date === dayStr);
          return (
            <div key={dayStr} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isToday ? 'border-emerald-400' : 'border-slate-200'}`}>
              <div className={`px-4 py-2.5 flex items-center justify-between ${isToday ? 'bg-emerald-700 text-white' : 'bg-slate-50 border-b border-slate-100'}`}>
                <span className={`font-semibold text-sm ${isToday ? 'text-white' : 'text-slate-800'}`}>{format(day, 'EEEE')}</span>
                <span className={`text-xs ${isToday ? 'text-emerald-100' : 'text-slate-500'}`}>{format(day, 'dd MMM')} · {dayAssignments.length}</span>
              </div>
              {dayAssignments.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">No assignments</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {dayAssignments.map(assignment => {
                    const member = staff.find(s => s.id === assignment.staff_id);
                    const job = jobs.find(j => j.id === assignment.job_id);
                    const vehicle = vehicles.find(v => v.id === assignment.vehicle_id);
                    const client = clients.find(c => c.id === job?.client_id);
                    const colors = jobTypeColors[job?.job_type] || jobTypeColors.depot;
                    const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
                    const StatusIcon = status.icon;
                    return (
                      <div key={assignment.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-emerald-700 font-bold text-xs">{member?.name?.charAt(0) || '?'}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                              <p className="text-xs text-slate-600 truncate">{job?.name || '—'}</p>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteAssignment(assignment.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {job && <span className={`px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>{job.job_type.replace(/_/g, ' ')}</span>}
                          {vehicle && <span className="flex items-center gap-0.5 text-slate-500"><Truck className="w-3 h-3" />{vehicle.registration_number}</span>}
                          {job?.location && <span className="flex items-center gap-0.5 text-slate-500"><MapPin className="w-3 h-3" />{job.location}</span>}
                          <span className={`inline-flex items-center gap-0.5 ${status.text}`}><StatusIcon className="w-3 h-3" />{status.label}</span>
                          {assignment.briefing_signed && <span className="inline-flex items-center text-emerald-600"><ClipboardCheck className="w-3 h-3" />Briefed</span>}
                        </div>
                        {client && <p className="text-xs text-slate-400 mt-1.5">{client.name}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}