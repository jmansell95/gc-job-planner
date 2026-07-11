import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, MapPin, Calendar, Users, Truck, FileText, Briefcase,
  Clock, Eye, Download, User, HardHat, Phone, Mail, Tag, Edit2,
  ShieldCheck, PlayCircle, CheckCircle2, MessageSquare,
  UsersRound, CalendarClock, Send, AlertCircle, Cog, Wrench, Package
} from 'lucide-react';
import { format } from 'date-fns';
import PrintReportButton from '@/components/PrintReportButton';
import JobForm from '@/components/JobForm';
import PortalLinkManager from '@/components/PortalLinkManager';
import PortalSectionManager from '@/components/PortalSectionManager';
import DocumentManager from '@/components/DocumentManager';
import MilestoneManager from '@/components/MilestoneManager';
import JobCostingManager from '@/components/JobCostingManager';
import JobCommentsViewer from '@/components/JobCommentsViewer';
import JobWorkLog from '@/components/JobWorkLog';
import JobPhotoGallery from '@/components/JobPhotoGallery';
import { getJobPrimaryType, isDrillingJob as isDrillingJobByTeams, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';
import { computeStaffOvertime, buildRateMap, getAssignmentMultiplier } from '@/utils/overtime';
import JobStatusModal from '@/components/JobStatusModal';
import JobHotelBookings from '@/components/JobHotelBookings';
import DeliveryManager from '@/components/delivery/DeliveryManager';
import JobAssetManager from '@/components/JobAssetManager';
import InvestigationLogManager from '@/components/InvestigationLogManager';

const jobTypeColors = {
  groundworks: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  cp_drilling: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', border: 'border-amber-200' },
  rotary_drilling: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', border: 'border-blue-200' },
  enabling_works: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500', border: 'border-purple-200' },
  depot: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', border: 'border-slate-200' },
};

const roleLabels = {
  groundworker: 'Groundworker',
  cp_driller: 'CP Driller',
  rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew',
  depot: 'Depot',
  supervisor: 'Supervisor',
};

const workerTypeBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

const statusBadge = {
  planning: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

export default function JobDetail({ job: initialJob, onBack }) {
  const [job, setJob] = useState(initialJob);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });
  const primaryType = getJobPrimaryType(job, teams);
  const colors = getJobTypeColor(primaryType, jobTypes);
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const handleStatusSave = async (data) => {
    await base44.entities.Job.update(job.id, data);
    setJob(prev => ({ ...prev, ...data }));
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const handleEdit = () => {
    setFormData({ ...job });
    setEditingId(job.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await base44.entities.Job.update(editingId, formData);
      setJob(prev => ({ ...prev, ...formData }));
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setShowForm(false);
      setEditingId(null);
    } catch (err) { console.error('Error saving job:', err); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, requisition_list_url: file_url, requisition_list_name: file.name }));
    } catch (err) { console.error('Error uploading file:', err); }
    setUploadingFile(false);
  };

  const buildJobPrintHtml = () => {
    const staffRows = assignedStaff.map(s => {
      const shifts = rotas.filter(r => r.staff_id === s.id).length;
      const vids = [...new Set(rotas.filter(r => r.staff_id === s.id).map(r => r.vehicle_id).filter(Boolean))];
      const vehs = vids.map(id => vehicles.find(v => v.id === id)?.registration_number).filter(Boolean).join(', ');
      return `<tr><td>${s.name}</td><td>${roleLabels[s.job_role] || s.job_role}</td><td>${s.worker_type?.replace(/_/g,' ')}</td><td>${shifts}</td><td>${vehs || '—'}</td></tr>`;
    }).join('');
    const scheduleRows = sortedDates.map(date => {
      const dayRotas = rotasByDate[date];
      const d = new Date(date + 'T00:00:00');
      const names = dayRotas.map(r => {
        const m = allStaff.find(s => s.id === r.staff_id);
        const v = vehicles.find(v => v.id === r.vehicle_id);
        return m ? `${m.name}${v ? ' ('+v.registration_number+')' : ''}` : '';
      }).filter(Boolean).join(', ');
      return `<tr><td>${format(d, 'EEEE, dd MMM yyyy')}</td><td>${names}</td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html><head><title>Job Report – ${job.name}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 2px; }
      h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      .meta { color: #555; font-size: 11px; margin-bottom: 14px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
      th { background: #1a5c3a; color: white; padding: 5px 8px; text-align: left; font-size: 11px; }
      td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) td { background: #f8fafb; }
      @media print { body { margin: 10mm; } }
    </style></head><body>
    <h1>${job.name}</h1>
    <div class="meta">
      ${getJobTypeLabel(primaryType, jobTypes)} &nbsp;·&nbsp; ${job.location} &nbsp;·&nbsp; ${job.start_date} → ${job.end_date || 'TBC'}
      &nbsp;·&nbsp; Printed ${format(new Date(), 'dd MMM yyyy HH:mm')}
    </div>
    ${assignedStaff.length > 0 ? `<h2>Assigned Staff (${assignedStaff.length})</h2>
    <table><thead><tr><th>Name</th><th>Role</th><th>Type</th><th>Shifts</th><th>Vehicles</th></tr></thead>
    <tbody>${staffRows}</tbody></table>` : ''}
    ${sortedDates.length > 0 ? `<h2>Daily Schedule</h2>
    <table><thead><tr><th>Date</th><th>Personnel</th></tr></thead>
    <tbody>${scheduleRows}</tbody></table>` : ''}
    ${job.notes ? `<h2>Notes</h2><p>${job.notes}</p>` : ''}
    </body></html>`;
  };

  const { data: allStaff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list()
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list()
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => base44.entities.Contractor.list()
  });

  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas-for-job', job.id],
    queryFn: () => base44.entities.RotaAssignment.filter({ job_id: job.id })
  });

  const { data: assetAssignments = [] } = useQuery({
    queryKey: ['job-asset-assignments', job.id],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: job.id })
  });

  const { data: siteAssets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list()
  });

  const { data: hotelBookings = [] } = useQuery({
    queryKey: ['hotel-bookings-for-job', job.id],
    queryFn: () => base44.entities.HotelBooking.filter({ job_id: job.id })
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets-for-job', job.id],
    queryFn: () => base44.entities.Timesheet.filter({ job_id: job.id })
  });
  const { data: allTimesheets = [] } = useQuery({ queryKey: ['all-timesheets-ot'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: overtimeSetting } = useQuery({
    queryKey: ['overtime-setting'],
    queryFn: async () => { const list = await base44.entities.OvertimeSetting.list(); return list[0] || null; }
  });

  // Unique staff assigned to this job
  const assignedStaffIds = [...new Set(rotas.map(r => r.staff_id))];
  const assignedStaff = assignedStaffIds.map(id => allStaff.find(s => s.id === id)).filter(Boolean);

  // Unique vehicles used
  const assignedVehicleIds = [...new Set(rotas.map(r => r.vehicle_id).filter(Boolean))];
  const assignedVehicles = assignedVehicleIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean);

  const client = clients.find(c => c.id === job.client_id);
  const contractor = contractors.find(c => c.id === job.contractor_id);

  // Group rotas by date for timeline
  const rotasByDate = {};
  rotas.forEach(r => {
    if (!rotasByDate[r.assigned_date]) rotasByDate[r.assigned_date] = [];
    rotasByDate[r.assigned_date].push(r);
  });
  const sortedDates = Object.keys(rotasByDate).sort();

  // Job cost estimation — meterage-based for drilling jobs, day-rate for others,
  // with task-based timesheet labour overriding day-rate cost where tasks are logged.
  const isDrillingJob = isDrillingJobByTeams(job, teams, jobTypes);
  const jobMeterage = isDrillingJob && job.meterage != null && job.meterage !== '' ? Number(job.meterage) : 0;
  const useJobMeterage = jobMeterage > 0;
  const validTimesheets = (timesheets || []).filter(t => t.status === 'submitted' || t.status === 'approved');
  const timesheetByStaff = {};
  validTimesheets.forEach(t => {
    const mins = Number(t.task_duration_minutes) || (t.total_hours ? t.total_hours * 60 : 0);
    if (!timesheetByStaff[t.staff_id]) timesheetByStaff[t.staff_id] = { minutes: 0, count: 0 };
    timesheetByStaff[t.staff_id].minutes += mins;
    timesheetByStaff[t.staff_id].count += 1;
  });
  const otRateMap = buildRateMap(overtimeRates);
  const otThreshold = overtimeSetting?.weekly_threshold_hours ?? 40;
  const staffCosts = assignedStaff.map(member => {
    const memberRotas = rotas.filter(r => r.staff_id === member.id);
    const memberMeterage = memberRotas.reduce((sum, r) => sum + (r.meterage || 0), 0);
    const meterageRate = member.meterage_rate || 0;
    const dayRate = member.day_rate || 0;
    const usesMeterage = isDrillingJob && meterageRate > 0;
    const meterage = useJobMeterage ? jobMeterage : memberMeterage;
    const ts = timesheetByStaff[member.id];
    const hourlyRate = dayRate > 0 ? dayRate / 8 : 0;
    const staffAllEntries = (allTimesheets || []).filter(t => t.staff_id === member.id && (t.status === 'submitted' || t.status === 'approved'));
    const otBreakdown = computeStaffOvertime(staffAllEntries, otRateMap, otThreshold, hourlyRate);
    const jobEntryCost = validTimesheets.filter(t => t.staff_id === member.id).reduce((sum, t) => sum + (otBreakdown[t.id]?.cost || 0), 0);
    const usesTimesheet = !usesMeterage && jobEntryCost > 0;
    const overtimeShifts = memberRotas.filter(r => r.is_overtime);
    const dayRateCost = memberRotas.reduce((sum, r) => {
      const mult = r.is_overtime ? getAssignmentMultiplier(r, otRateMap) : 1;
      return sum + dayRate * mult;
    }, 0);
    return {
      name: member.name,
      role: roleLabels[member.job_role] || member.job_role,
      shifts: memberRotas.length,
      overtimeShifts: overtimeShifts.length,
      dayRate,
      meterage,
      meterageRate,
      costType: usesMeterage ? 'meterage' : (usesTimesheet ? 'timesheet' : 'day_rate'),
      timesheetMinutes: ts ? ts.minutes : 0,
      timesheetCount: ts ? ts.count : 0,
      hourlyRate,
      cost: usesMeterage ? meterage * meterageRate
        : usesTimesheet ? jobEntryCost
        : dayRateCost
    };
  });
  const totalCost = staffCosts.reduce((sum, s) => sum + s.cost, 0);
  const totalMeterage = useJobMeterage ? jobMeterage : staffCosts.reduce((sum, s) => sum + s.meterage, 0);

  const startDate = job.start_date ? new Date(job.start_date + 'T00:00:00') : null;
  const endDate = job.end_date ? new Date(job.end_date + 'T00:00:00') : null;

  if (showForm) {
    return (
      <div>
        <div className="mb-5">
          <button onClick={() => setShowForm(false)} className="flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900 font-medium transition">
            <ArrowLeft className="w-4 h-4" /> Back to Job
          </button>
        </div>
        <JobForm formData={formData} setFormData={setFormData} onSubmit={handleSubmit} onCancel={() => setShowForm(false)} editingId={editingId} clients={clients} contractors={contractors} onFileUpload={handleFileUpload} uploadingFile={uploadingFile} />
      </div>
    );
  }

  return (
    <div>
      {/* Top bar */}
      <div className="mb-5 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900 font-medium transition">
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowStatusModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> Change Status
          </button>
          <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
            <Edit2 className="w-4 h-4" /> Edit Job
          </button>
          <PrintReportButton buildHtml={buildJobPrintHtml} label="Print Report" />
        </div>
      </div>

      {/* Hero header */}
      <div className={`rounded-2xl p-5 md:p-6 border ${colors.border} ${colors.bg} mb-6`}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                {getJobTypeLabel(primaryType, jobTypes)}
              </span>
              <button
                onClick={() => setShowStatusModal(true)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge[job.status || 'planning']} hover:opacity-80 transition cursor-pointer`}
                title="Click to change status"
              >
                {statusLabels[job.status || 'planning']}
              </button>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{job.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-slate-600">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm md:text-base">{job.location}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600 md:justify-end">
            {startDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{format(startDate, 'dd MMM yyyy')} → {endDate ? format(endDate, 'dd MMM yyyy') : 'TBC'}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{assignedStaff.length} staff</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{rotas.length} shifts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow guidance banner */}
      {job.status === 'planning' && (
        <div className="rounded-2xl p-5 mb-6 bg-gradient-to-br from-slate-50 to-emerald-50/60 border border-emerald-200">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-sm">Job Setup Checklist</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`rounded-xl p-3 border ${job.required_team_ids?.length > 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-2 mb-1">
                {job.required_team_ids?.length > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <UsersRound className="w-4 h-4 text-slate-400" />}
                <p className="text-xs font-bold text-slate-800">1. Assign Teams</p>
              </div>
              <p className="text-[11px] text-slate-500">{job.required_team_ids?.length > 0 ? `${job.required_team_ids.length} team(s) assigned` : 'Edit the job to pick required teams'}</p>
            </div>
            <div className={`rounded-xl p-3 border ${hotelBookings.length > 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-2 mb-1">
                {hotelBookings.length > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <CalendarClock className="w-4 h-4 text-slate-400" />}
                <p className="text-xs font-bold text-slate-800">2. Hotel Bookings <span className="font-normal text-slate-400">(optional)</span></p>
              </div>
              <p className="text-[11px] text-slate-500">{hotelBookings.length > 0 ? `${hotelBookings.length} booking(s) added` : 'Add accommodation if crew need stays'}</p>
            </div>
            <div className={`rounded-xl p-3 border ${rotas.length > 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-2 mb-1">
                {rotas.length > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <CalendarClock className="w-4 h-4 text-slate-400" />}
                <p className="text-xs font-bold text-slate-800">3. Build Rota</p>
              </div>
              <p className="text-[11px] text-slate-500">{rotas.length > 0 ? `${rotas.length} shifts scheduled` : 'Go to Weekly Rota Builder to assign staff'}</p>
            </div>
            <div className={`rounded-xl p-3 border ${job.status === 'in_progress' || job.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-2 mb-1">
                {job.status === 'in_progress' || job.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Send className="w-4 h-4 text-slate-400" />}
                <p className="text-xs font-bold text-slate-800">4. Publish & Activate</p>
              </div>
              <p className="text-[11px] text-slate-500">{job.status === 'in_progress' || job.status === 'completed' ? 'Job activated & staff emailed' : 'Submit the rota week to email staff'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick info row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Job Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-emerald-700" />
            <h3 className="font-semibold text-slate-900 text-sm">Job Info</h3>
          </div>
          <div className="space-y-2.5 text-sm">
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-medium">Type</p>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
                {getJobTypeLabel(primaryType, jobTypes)}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-medium">Status</p>
              <button
                onClick={() => setShowStatusModal(true)}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[job.status || 'planning']} hover:opacity-80 transition cursor-pointer`}
              >
                {statusLabels[job.status || 'planning']}
              </button>
            </div>
            {job.status_reason && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-[11px] text-amber-600 font-semibold uppercase mb-0.5">Status Reason</p>
                <p className="text-xs text-amber-800">{job.status_reason}</p>
              </div>
            )}
            {job.job_reference && (
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-medium">Reference</p>
                <p className="text-slate-700">{job.job_reference}</p>
              </div>
            )}
            {startDate && (
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-medium">Duration</p>
                <p className="text-slate-700">{format(startDate, 'dd MMM yyyy')} → {endDate ? format(endDate, 'dd MMM yyyy') : 'TBC'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contacts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-emerald-700" />
            <h3 className="font-semibold text-slate-900 text-sm">Contacts</h3>
          </div>
          <div className="space-y-2.5 text-sm">
            {job.project_manager ? (
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-medium">Project Manager</p>
                <p className="text-slate-700">{job.project_manager}</p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-medium">Project Manager</p>
                <p className="text-xs text-slate-400">Not set</p>
              </div>
            )}
            {(job.site_contact_name || job.site_contact_phone) ? (
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-medium">Site Contact</p>
                {job.site_contact_name && <p className="text-slate-700">{job.site_contact_name}</p>}
                {job.site_contact_phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone className="w-3 h-3" />{job.site_contact_phone}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-medium">Site Contact</p>
                <p className="text-xs text-slate-400">Not set</p>
              </div>
            )}
          </div>
        </div>

        {/* Client / Contractor */}
        {(client || contractor) ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <HardHat className="w-4 h-4 text-emerald-700" />
              <h3 className="font-semibold text-slate-900 text-sm">Client</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              {client && (
                <div>
                  <p className="text-[11px] text-slate-400 uppercase font-medium">Client</p>
                  <p className="font-semibold text-slate-900">{client.name}</p>
                  {client.contact_phone && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <Phone className="w-3 h-3" />{client.contact_phone}
                    </div>
                  )}
                </div>
              )}
              {contractor && (
                <div>
                  <p className="text-[11px] text-slate-400 uppercase font-medium">Contractor</p>
                  <p className="font-semibold text-slate-900">{contractor.name}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-emerald-700" />
              <h3 className="font-semibold text-slate-900 text-sm">Notes</h3>
            </div>
            {job.notes ? (
              <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-4">{job.notes}</p>
            ) : (
              <p className="text-xs text-slate-400">No notes</p>
            )}
          </div>
        )}

        {/* Vehicles & Equipment */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-emerald-700" />
            <h3 className="font-semibold text-slate-900 text-sm">Vehicles & Equipment</h3>
            {(assignedVehicles.length > 0 || assetAssignments.length > 0) && (
              <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{assignedVehicles.length + assetAssignments.length}</span>
            )}
          </div>
          {assetAssignments.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {assetAssignments.map(a => {
                const asset = siteAssets.find(as => as.id === a.asset_id);
                const liveStatus = asset?.compliance_status || a.compliance_status || 'unknown';
                const compBadge = {
                  compliant: 'bg-emerald-50 text-emerald-700',
                  expiring: 'bg-amber-50 text-amber-700',
                  expired: 'bg-red-50 text-red-700',
                  unknown: 'bg-slate-50 text-slate-500',
                }[liveStatus] || 'bg-slate-50 text-slate-500';
                return (
                  <div key={a.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                      {a.asset_type === 'rig' ? <Cog className="w-3 h-3 text-blue-600" /> : a.asset_type === 'trailer' ? <Package className="w-3 h-3 text-amber-600" /> : <Wrench className="w-3 h-3 text-purple-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">{a.asset_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{a.role === 'primary_rig' ? 'Primary Rig' : a.role === 'support_rig' ? 'Support Rig' : a.asset_type}{a.rig_type && a.rig_type !== 'n/a' ? ` · ${a.rig_type.toUpperCase()}` : ''}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${compBadge}`}>{liveStatus}</span>
                  </div>
                );
              })}
            </div>
          )}
          {assignedVehicles.length > 0 && (
            <div className={`space-y-1.5 ${assetAssignments.length > 0 ? 'pt-2 border-t border-slate-100' : ''}`}>
              {assignedVehicles.map(v => (
                <div key={v.id} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-bold text-slate-900">{v.registration_number}</p>
                    <p className="text-[11px] text-slate-500 truncate">{v.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {assignedVehicles.length === 0 && assetAssignments.length === 0 && (
            <p className="text-xs text-slate-400">No vehicles or equipment assigned</p>
          )}
          {job.requisition_list_url && (
            <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 mt-2.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-medium transition">
              <FileText className="w-3 h-3" /> View Requisition
            </a>
          )}
        </div>
      </div>

      {/* Full notes (when client card is shown) */}
      {job.notes && (client || contractor) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-emerald-700" />
            <h3 className="font-semibold text-slate-900 text-sm">Job Notes</h3>
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      {/* Main content - balanced */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assigned Staff */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Assigned Staff</h2>
              <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{assignedStaff.length}</span>
            </div>
            {assignedStaff.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No staff assigned yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {assignedStaff.map(member => {
                  const memberRotas = rotas.filter(r => r.staff_id === member.id);
                  const memberVehicleIds = [...new Set(memberRotas.map(r => r.vehicle_id).filter(Boolean))];
                  const memberVehicles = memberVehicleIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean);
                  return (
                    <div key={member.id} className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-700 font-bold text-sm">{member.name.charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                          <p className="text-xs text-slate-500">{roleLabels[member.job_role] || member.job_role}</p>
                          {memberVehicles.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Truck className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs text-slate-500">{memberVehicles.map(v => v.registration_number).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${workerTypeBadge[member.worker_type] || 'bg-slate-100 text-slate-600'}`}>
                          {member.worker_type?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-slate-400">{memberRotas.length} shifts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily Schedule */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Daily Schedule</h2>
              <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{sortedDates.length} days</span>
            </div>
            {sortedDates.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No scheduled days yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedDates.map(date => {
                  const _rawDayRotas = rotasByDate[date];
                  const _seenStaff = {};
                  const dayRotas = _rawDayRotas.filter(r => {
                    if (_seenStaff[r.staff_id]) return false;
                    _seenStaff[r.staff_id] = true;
                    return true;
                  });
                  const d = new Date(date + 'T00:00:00');
                  return (
                    <div key={date} className="px-5 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-slate-900">{format(d, 'EEEE, dd MMM yyyy')}</span>
                        <span className="text-xs text-slate-400">{dayRotas.length} {dayRotas.length === 1 ? 'person' : 'people'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {dayRotas.map(rota => {
                          const member = allStaff.find(s => s.id === rota.staff_id);
                          const vehicle = vehicles.find(v => v.id === rota.vehicle_id);
                          return (
                            <div key={rota.id} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium text-slate-700">{member?.name || 'Unknown'}</span>
                                {vehicle && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-slate-500 font-mono">{vehicle.registration_number}</span>
                                  </>
                                )}
                                {rota.briefing_signed && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium ml-auto">
                                    <ShieldCheck className="w-3 h-3" /> Briefing {rota.briefing_signed_at ? format(new Date(rota.briefing_signed_at), 'HH:mm') : ''}
                                  </span>
                                )}
                                {rota.status === 'started' && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                    <PlayCircle className="w-3 h-3" /> Started
                                  </span>
                                )}
                                {rota.status === 'completed' && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                    <CheckCircle2 className="w-3 h-3" /> Done
                                  </span>
                                )}
                              </div>
                              {rota.progress_notes && (
                                <div className="flex items-start gap-1.5 mt-1.5 pl-5">
                                  <MessageSquare className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                                  <p className="text-slate-500 leading-relaxed">{rota.progress_notes}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rigs & Equipment */}
          <JobAssetManager job={job} isDrillingJob={isDrillingJob} />

          {/* Investigation Log */}
          <InvestigationLogManager job={job} isDrillingJob={isDrillingJob} />

          {/* Accommodations */}
          <JobHotelBookings job={job} assignedStaff={assignedStaff} allStaff={allStaff} />

          {/* Deliveries & Collections */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <DeliveryManager jobId={job.id} jobName={job.name} />
          </div>

          {/* Site Photos */}
          <JobPhotoGallery job={job} />

          {/* Job Costing & Billing */}
          <JobCostingManager job={job} totalCost={totalCost} staffCosts={staffCosts} isDrillingJob={isDrillingJob} totalMeterage={totalMeterage} />

          {/* Work Log */}
          <JobWorkLog job={job} />

          {/* Milestones */}
          <MilestoneManager job={job} />

          {/* Documents */}
          <DocumentManager job={job} />

          {/* Client Messages */}
          <JobCommentsViewer job={job} />
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Client / Contractor full details */}
          {(client || contractor) && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <HardHat className="w-5 h-5 text-emerald-700" />
                <h2 className="font-semibold text-slate-900">Client Details</h2>
              </div>
              <div className="px-5 py-4 space-y-4">
                {client && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-medium mb-1">Client</p>
                    <p className="text-sm font-semibold text-slate-900">{client.name}</p>
                    {client.contact_name && <p className="text-xs text-slate-500 mt-0.5">{client.contact_name}</p>}
                    {client.contact_email && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <Mail className="w-3.5 h-3.5" />{client.contact_email}
                      </div>
                    )}
                    {client.contact_phone && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                        <Phone className="w-3.5 h-3.5" />{client.contact_phone}
                      </div>
                    )}
                  </div>
                )}
                {contractor && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-medium mb-1">Contractor</p>
                    <p className="text-sm font-semibold text-slate-900">{contractor.name}</p>
                    {contractor.contact_name && <p className="text-xs text-slate-500 mt-0.5">{contractor.contact_name}</p>}
                    {contractor.contact_email && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <Mail className="w-3.5 h-3.5" />{contractor.contact_email}
                      </div>
                    )}
                    {contractor.contact_phone && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                        <Phone className="w-3.5 h-3.5" />{contractor.contact_phone}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Requisition */}
          {job.requisition_list_url && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                <h2 className="font-semibold text-slate-900">Requisition List</h2>
              </div>
              <div className="px-5 py-4 space-y-2">
                <p className="text-sm text-slate-700 truncate">{job.requisition_list_name || 'Requisition List'}</p>
                <div className="flex gap-2">
                  <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-medium transition">
                    <Eye className="w-3.5 h-3.5" /> View
                  </a>
                  <a href={job.requisition_list_url} download={job.requisition_list_name || 'requisition'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition">
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Client Portal */}
          <PortalLinkManager job={job} />
          <PortalSectionManager job={job} />
        </div>
      </div>

      {showStatusModal && (
        <JobStatusModal job={job} onClose={() => setShowStatusModal(false)} onSave={handleStatusSave} />
      )}
    </div>
  );
}