import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, addDays, format, subWeeks } from 'date-fns';
import {
  Plus, Calendar, ChevronLeft, ChevronRight, X, Copy,
  MapPin, Truck, Clock, CheckCircle2, PlayCircle, ClipboardCheck,
  Users, Briefcase, Search, Filter, StickyNote, Save, Send, Loader2
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import AssignmentModal from '@/components/AssignmentModal';
import { EmptyState, ErrorState, RotaSkeleton, Skeleton, SkeletonText } from '@/components/StateViews';
import { formatJobType } from '@/utils/format';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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
  const [smartFillLoading, setSmartFillLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, assignment: null, defaultStaffId: '', defaultDate: '' });
  const [teamFilter, setTeamFilter] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState(null);

  const queryClient = useQueryClient();
  const weekStart = startOfWeek(selectedWeek);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { data: staff = [], isLoading: staffLoading, isError: staffError, refetch: refetchStaff } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring-absences'], queryFn: () => base44.entities.RecurringAbsence.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });

  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas', weekStartStr],
    queryFn: async () => {
      const all = await base44.entities.RotaAssignment.list();
      return all.filter(a => a.week_start === weekStartStr);
    }
  });

  const { data: weekRecord } = useQuery({
    queryKey: ['rota-week', weekStartStr],
    queryFn: async () => { const list = await base44.entities.RotaWeek.filter({ week_start: weekStartStr }); return list[0] || null; }
  });
  const isPublished = weekRecord?.status === 'published';

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filter staff by team and search
  const filteredStaff = staff.filter(s => {
    if (teamFilter && s.team_id !== teamFilter) return false;
    if (staffSearch && !s.name.toLowerCase().includes(staffSearch.toLowerCase())) return false;
    return true;
  });

  const rotasByStaff = {};
  filteredStaff.forEach(s => { rotasByStaff[s.id] = Array.from({ length: 7 }, () => []); });
  rotas.forEach(rota => {
    const dayIndex = days.findIndex(d => format(d, 'yyyy-MM-dd') === rota.assigned_date);
    if (dayIndex !== -1 && rotasByStaff[rota.staff_id]) {
      rotasByStaff[rota.staff_id][dayIndex].push(rota);
    }
  });

  const leaveState = (staffId, dateStr) => {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const rec = recurring.find(r => r.staff_id === staffId && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow));
    if (rec) return { recurring: true, label: rec.label || 'Day Off' };
    const leave = absences.some(a => a.staff_id === staffId && a.status === 'approved' && a.start_date <= dateStr && a.end_date >= dateStr);
    if (leave) return { recurring: false, label: 'On Leave' };
    return null;
  };

  const handleCellClick = (staffId, dateStr) => {
    setModal({ isOpen: true, assignment: null, defaultStaffId: staffId, defaultDate: dateStr });
  };

  const handleEditAssignment = (assignment) => {
    setModal({ isOpen: true, assignment, defaultStaffId: '', defaultDate: '' });
  };

  const handleDeleteAssignment = async (id) => {
    if (!confirm('Delete this assignment?')) return;
    try {
      await base44.entities.RotaAssignment.delete(id);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const [srcStaff, srcDate] = source.droppableId.split('|');
    const [dstStaff, dstDate] = destination.droppableId.split('|');
    if (srcStaff === dstStaff && srcDate === dstDate) return;
    const assignment = rotas.find(r => r.id === draggableId);
    if (!assignment) return;
    try {
      await base44.entities.RotaAssignment.update(assignment.id, { staff_id: dstStaff, assigned_date: dstDate });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error moving assignment:', error);
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
          start_time: r.start_time || '',
          end_time: r.end_time || '',
          notes: r.notes || '',
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

  const handleSaveDraft = async () => {
    try {
      if (weekRecord) {
        if (weekRecord.status !== 'published') {
          await base44.entities.RotaWeek.update(weekRecord.id, { status: 'draft' });
        }
      } else {
        await base44.entities.RotaWeek.create({ week_start: weekStartStr, status: 'draft' });
      }
      queryClient.invalidateQueries({ queryKey: ['rota-week'] });
      setNotice({ type: 'success', msg: 'Draft saved. Come back any time to finish and submit.' });
    } catch (e) {
      setNotice({ type: 'error', msg: e.message || 'Failed to save draft' });
    }
  };

  const handleSubmitWeek = async () => {
    if (rotas.length === 0) { setNotice({ type: 'error', msg: 'No assignments to submit yet.' }); return; }
    const label = `${format(weekStart, 'dd MMM')} – ${format(addDays(weekStart, 6), 'dd MMM yyyy')}`;
    if (!confirm(`Submit the rota for ${label}?\n\nThis will email each assigned staff member their personal schedule.`)) return;
    setPublishing(true);
    try {
      const res = await base44.functions.invoke('publishRotaWeek', { weekStart: weekStartStr });
      const d = res.data || {};
      queryClient.invalidateQueries({ queryKey: ['rota-week'] });
      const parts = [`Rota published — ${d.emailed || 0} staff emailed`];
      if (d.skipped) parts.push(`${d.skipped} without a valid email`);
      if (d.disabled) parts.push('schedule email is disabled in Settings');
      setNotice({ type: 'success', msg: parts.join(', ') + '.' });
    } catch (e) {
      setNotice({ type: 'error', msg: e.response?.data?.error || e.message || 'Failed to publish rota' });
    } finally {
      setPublishing(false);
    }
  };

  const goToPrevWeek = () => setSelectedWeek(prev => addDays(prev, -7));
  const goToNextWeek = () => setSelectedWeek(prev => addDays(prev, 7));

  const totalAssignments = rotas.length;
  const staffWorking = [...new Set(rotas.map(r => r.staff_id))].length;
  const jobsActive = [...new Set(rotas.map(r => r.job_id))].length;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const renderAssignmentCard = (assignment) => {
    const job = jobs.find(j => j.id === assignment.job_id);
    const vehicle = vehicles.find(v => v.id === assignment.vehicle_id);
    const client = clients.find(c => c.id === job?.client_id);
    const colors = jobTypeColors[job?.job_type] || jobTypeColors.depot;
    const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
    const StatusIcon = status.icon;
    return (
      <div key={assignment.id} className={`group relative px-2.5 py-2 rounded-lg text-xs border-l-[3px] cursor-pointer hover:shadow-sm transition ${colors.bg} ${colors.border}`}
        onClick={() => handleEditAssignment(assignment)}>
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="font-semibold text-slate-900 truncate flex-1">{job?.name || 'Unknown'}</span>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(assignment.id); }}
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
        {(assignment.start_time || assignment.end_time) && (
          <div className="flex items-center gap-1 text-slate-500 mb-1">
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{assignment.start_time || '—'} - {assignment.end_time || '—'}</span>
          </div>
        )}
        {assignment.notes && (
          <div className="flex items-start gap-1 text-slate-500 mb-1">
            <StickyNote className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
            <span className="truncate italic">{assignment.notes}</span>
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
          {assignment.briefing_signed && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600">
              <ClipboardCheck className="w-2.5 h-2.5" />
            </span>
          )}
          {assignment.shift_status === 'confirmed' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">✓ Confirmed</span>
          )}
          {assignment.shift_status === 'declined' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">✗ Declined</span>
          )}
          {assignment.meterage > 0 && (
            <span className="text-[10px] text-amber-600 font-medium">{assignment.meterage}m</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <PageHeader title="Weekly Rota Builder" icon={Calendar} />
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleSmartFill} disabled={smartFillLoading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
            <Copy className="w-4 h-4" /> {smartFillLoading ? 'Copying...' : 'Smart Fill'}
          </button>
          <button onClick={() => setModal({ isOpen: true, assignment: null, defaultStaffId: '', defaultDate: '' })}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Assignment
          </button>
          <button onClick={handleSaveDraft} disabled={isPublished}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition text-sm font-medium">
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button onClick={handleSubmitWeek} disabled={publishing}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm font-medium disabled:opacity-50">
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {isPublished ? 'Resend' : 'Submit Week'}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${notice.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <span className="font-medium flex-1">{notice.msg}</span>
          <button onClick={() => setNotice(null)} className="text-current opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Week Navigator + Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2 sm:gap-3 bg-white rounded-xl border border-slate-200 shadow-sm px-3 sm:px-4 py-3 w-full sm:w-fit flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <button onClick={goToPrevWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
            <div className="text-sm font-semibold text-slate-900 flex-1 sm:min-w-[180px] text-center">
              {format(weekStart, 'dd MMM')} — {format(addDays(weekStart, 6), 'dd MMM yyyy')}
            </div>
            <button onClick={goToNextWeek} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
          </div>
          <div className="hidden sm:block h-4 w-px bg-slate-200 mx-1" />
          <input type="date" value={weekStartStr} onChange={(e) => setSelectedWeek(new Date(e.target.value))}
            className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-600 w-full sm:w-auto" />
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-2.5 shadow-sm">
            <span className="w-7 h-7 rounded-lg stat-gradient-emerald flex items-center justify-center"><Calendar className="w-4 h-4 text-white" /></span>
            <span className="text-sm font-bold text-slate-900">{totalAssignments}</span>
            <span className="text-xs text-slate-500">assignments</span>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-2.5 shadow-sm">
            <span className="w-7 h-7 rounded-lg stat-gradient-blue flex items-center justify-center"><Users className="w-4 h-4 text-white" /></span>
            <span className="text-sm font-bold text-slate-900">{staffWorking}</span>
            <span className="text-xs text-slate-500">staff working</span>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-2.5 shadow-sm">
            <span className="w-7 h-7 rounded-lg stat-gradient-amber flex items-center justify-center"><Briefcase className="w-4 h-4 text-white" /></span>
            <span className="text-sm font-bold text-slate-900">{jobsActive}</span>
            <span className="text-xs text-slate-500">jobs active</span>
          </div>
          {weekRecord && (
            <div className={`bg-white rounded-lg border px-4 py-2.5 flex items-center gap-2.5 shadow-sm ${isPublished ? 'border-emerald-300' : 'border-amber-300'}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${isPublished ? 'stat-gradient-emerald' : 'bg-amber-100'}`}>
                {isPublished ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Clock className="w-4 h-4 text-amber-600" />}
              </span>
              <div>
                <p className={`text-sm font-bold leading-tight ${isPublished ? 'text-emerald-700' : 'text-amber-700'}`}>{isPublished ? 'Published' : 'Draft'}</p>
                <p className="text-xs text-slate-500 leading-tight">{isPublished ? (weekRecord.published_at ? format(new Date(weekRecord.published_at), 'dd MMM, HH:mm') : 'Sent') : 'In progress'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2 shadow-sm flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input type="text" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)}
            placeholder="Search staff..."
            className="flex-1 text-sm focus:outline-none bg-transparent text-slate-700 placeholder:text-slate-400" />
          {staffSearch && (
            <button onClick={() => setStaffSearch('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2 shadow-sm">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
            className="text-sm focus:outline-none bg-transparent text-slate-700 font-medium">
            <option value="">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {(teamFilter || staffSearch) && (
          <span className="text-xs text-slate-500 self-center">
            Showing {filteredStaff.length} of {staff.length} staff
          </span>
        )}
      </div>

      {/* Assignment Modal */}
      <AssignmentModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, assignment: null, defaultStaffId: '', defaultDate: '' })}
        assignment={modal.assignment}
        defaultStaffId={modal.defaultStaffId}
        defaultDate={modal.defaultDate}
        weekStartStr={weekStartStr}
        staff={staff}
        jobs={jobs}
        vehicles={vehicles}
        existingRotas={rotas}
      />

      {/* Desktop Grid */}
      <div className="hidden lg:block bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        {staffLoading ? (
          <RotaSkeleton />
        ) : staffError ? (
          <ErrorState message="Couldn't load the rota" onRetry={refetchStaff} />
        ) : (
        <div className="overflow-x-auto">
          <DragDropContext onDragEnd={onDragEnd}><table className="w-full border-collapse min-w-[800px]">
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
              {filteredStaff.map((member, idx) => (
                <tr key={member.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 sticky left-0 z-10 bg-inherit border-r border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-xs">{member.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm whitespace-nowrap truncate">{member.name}</p>
                        <p className="text-xs text-slate-400">{teams.find(t => t.id === member.team_id)?.name || 'No team'}</p>
                      </div>
                    </div>
                  </td>
                  {days.map((day, dayIdx) => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const dayAssignments = rotasByStaff[member.id]?.[dayIdx] || [];
                    const isToday = dayStr === todayStr;
                    const ls = leaveState(member.id, dayStr);
                    return (
                      <td key={`${member.id}-${dayIdx}`} className={`px-2 py-2 align-top min-w-[130px] ${isToday ? 'bg-emerald-50/40' : ''} ${ls ? (ls.recurring ? 'bg-slate-100/70' : 'bg-red-50/60') : ''} group/cell`}>
                        <Droppable droppableId={`${member.id}|${dayStr}`}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps}
                              className={`space-y-1.5 min-h-[44px] rounded-lg transition ${snapshot.isDraggingOver ? 'bg-emerald-50/70 ring-2 ring-emerald-300/60' : ''}`}>
                              {ls && (
                                <div className={`px-2 py-1 rounded text-[10px] font-bold text-center ${ls.recurring ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-600'}`}>
                                  {ls.recurring ? (ls.label || 'DAY OFF').toUpperCase() : 'ON LEAVE'}
                                </div>
                              )}
                              {dayAssignments.map((assignment, aIdx) => (
                                <Draggable draggableId={assignment.id} index={aIdx} key={assignment.id}>
                                  {(p) => (
                                    <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                                      className="active:cursor-grabbing">
                                      {renderAssignmentCard(assignment)}
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              <button onClick={() => handleCellClick(member.id, dayStr)}
                                className="w-full py-1 text-[10px] text-slate-300 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg transition flex items-center justify-center gap-0.5 opacity-0 group-hover/cell:opacity-100">
                                <Plus className="w-2.5 h-2.5" /> Add
                              </button>
                            </div>
                          )}
                        </Droppable>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredStaff.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                  {staff.length === 0 ? 'No staff found. Add staff in Settings.' : 'No staff match your filters.'}
                </td></tr>
              )}
            </tbody>
          </table></DragDropContext>
        </div>
        )}
      </div>

      {/* Mobile Day Cards */}
      <div className="lg:hidden space-y-3">
        {staffLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <Skeleton className="h-5 w-24 mb-3" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        ) : staffError ? (
          <ErrorState message="Couldn't load the rota" onRetry={refetchStaff} />
        ) : days.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const isToday = dayStr === todayStr;
          const dayAssignments = rotas.filter(r => r.assigned_date === dayStr && filteredStaff.some(s => s.id === r.staff_id));
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
                      <div key={assignment.id} className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition"
                        onClick={() => handleEditAssignment(assignment)}>
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
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(assignment.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {job && <span className={`px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>{formatJobType(job.job_type)}</span>}
                          {vehicle && <span className="flex items-center gap-0.5 text-slate-500"><Truck className="w-3 h-3" />{vehicle.registration_number}</span>}
                          {job?.location && <span className="flex items-center gap-0.5 text-slate-500"><MapPin className="w-3 h-3" />{job.location}</span>}
                          <span className={`inline-flex items-center gap-0.5 ${status.text}`}><StatusIcon className="w-3 h-3" />{status.label}</span>
                          {assignment.briefing_signed && <span className="inline-flex items-center text-emerald-600"><ClipboardCheck className="w-3 h-3" />Briefed</span>}
                          {assignment.shift_status === 'confirmed' && <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium text-[10px]">✓ Confirmed</span>}
                          {assignment.shift_status === 'declined' && <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium text-[10px]">✗ Declined</span>}
                          {assignment.meterage > 0 && <span className="text-amber-600 font-medium">{assignment.meterage}m</span>}
                        </div>
                        {assignment.notes && (
                          <div className="mt-1.5 flex items-start gap-1 text-xs text-slate-500">
                            <StickyNote className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span className="italic">{assignment.notes}</span>
                          </div>
                        )}
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