import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, MapPin, Calendar, Users, Truck, FileText, Briefcase,
  Clock, Eye, Download, User, HardHat, Phone, Mail, Tag
} from 'lucide-react';
import { format } from 'date-fns';
import PrintReportButton from '@/components/PrintReportButton';
import PortalLinkManager from '@/components/PortalLinkManager';
import PortalSectionManager from '@/components/PortalSectionManager';
import DocumentManager from '@/components/DocumentManager';
import MilestoneManager from '@/components/MilestoneManager';
import JobCostingManager from '@/components/JobCostingManager';
import JobCommentsViewer from '@/components/JobCommentsViewer';
import JobWorkLog from '@/components/JobWorkLog';
import { formatJobType } from '@/utils/format';
import { computeStaffOvertime, buildRateMap } from '@/utils/overtime';

const jobTypeColors = {
  groundworks: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', border: 'border-green-200' },
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
};

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', completed: 'Completed', on_hold: 'On Hold',
};

export default function JobDetail({ job, onBack }) {
  const colors = jobTypeColors[job.job_type] || jobTypeColors.depot;

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
      ${job.job_type.replace(/_/g,' ')} &nbsp;·&nbsp; ${job.location} &nbsp;·&nbsp; ${job.start_date} → ${job.end_date || 'TBC'}
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
  const isDrillingJob = job.job_type === 'cp_drilling' || job.job_type === 'rotary_drilling';
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
    return {
      name: member.name,
      role: roleLabels[member.job_role] || member.job_role,
      shifts: memberRotas.length,
      dayRate,
      meterage,
      meterageRate,
      costType: usesMeterage ? 'meterage' : (usesTimesheet ? 'timesheet' : 'day_rate'),
      timesheetMinutes: ts ? ts.minutes : 0,
      timesheetCount: ts ? ts.count : 0,
      hourlyRate,
      cost: usesMeterage ? meterage * meterageRate
        : usesTimesheet ? jobEntryCost
        : memberRotas.length * dayRate
    };
  });
  const totalCost = staffCosts.reduce((sum, s) => sum + s.cost, 0);
  const totalMeterage = useJobMeterage ? jobMeterage : staffCosts.reduce((sum, s) => sum + s.meterage, 0);

  const startDate = job.start_date ? new Date(job.start_date + 'T00:00:00') : null;
  const endDate = job.end_date ? new Date(job.end_date + 'T00:00:00') : null;

  return (
    <div>
      {/* Top bar */}
      <div className="mb-5 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900 font-medium transition">
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </button>
        <PrintReportButton buildHtml={buildJobPrintHtml} label="Print Report" />
      </div>

      {/* Hero header */}
      <div className={`rounded-2xl p-5 md:p-6 border ${colors.border} ${colors.bg} mb-6`}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                {formatJobType(job.job_type)}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadge[job.status || 'planning']}`}>
                {statusLabels[job.status || 'planning']}
              </span>
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
                {formatJobType(job.job_type)}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-medium">Status</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[job.status || 'planning']}`}>
                {statusLabels[job.status || 'planning']}
              </span>
            </div>
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
          </div>
          {assignedVehicles.length > 0 ? (
            <div className="space-y-1.5">
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
          ) : (
            <p className="text-xs text-slate-400">No vehicles assigned</p>
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
                  const dayRotas = rotasByDate[date];
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
                            <div key={rota.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium text-slate-700">{member?.name || 'Unknown'}</span>
                              {vehicle && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-slate-500 font-mono">{vehicle.registration_number}</span>
                                </>
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
    </div>
  );
}