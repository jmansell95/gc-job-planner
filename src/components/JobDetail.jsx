import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, MapPin, Calendar, Users, Truck, FileText, Briefcase,
  Clock, Eye, Download, User, HardHat, Phone, Mail, Tag, PoundSterling
} from 'lucide-react';
import { format } from 'date-fns';
import PrintReportButton from '@/components/PrintReportButton';
import PortalLinkManager from '@/components/PortalLinkManager';

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

  // Job cost estimation (meterage-based for drillers, day-rate for others)
  const staffCosts = assignedStaff.map(member => {
    const memberRotas = rotas.filter(r => r.staff_id === member.id);
    const isDriller = member.job_role === 'cp_driller' || member.job_role === 'rotary_driller';
    const totalMeterage = memberRotas.reduce((sum, r) => sum + (r.meterage || 0), 0);
    const meterageRate = member.meterage_rate || 0;
    const dayRate = member.day_rate || 0;
    const usesMeterage = isDriller && meterageRate > 0;
    return {
      name: member.name,
      role: roleLabels[member.job_role] || member.job_role,
      shifts: memberRotas.length,
      dayRate,
      meterage: totalMeterage,
      meterageRate,
      costType: usesMeterage ? 'meterage' : 'day_rate',
      cost: usesMeterage ? totalMeterage * meterageRate : memberRotas.length * dayRate
    };
  });
  const totalCost = staffCosts.reduce((sum, s) => sum + s.cost, 0);
  const totalMeterage = staffCosts.reduce((sum, s) => sum + s.meterage, 0);

  const startDate = job.start_date ? new Date(job.start_date + 'T00:00:00') : null;
  const endDate = job.end_date ? new Date(job.end_date + 'T00:00:00') : null;

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900 font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Jobs
          </button>
          <PrintReportButton buildHtml={buildJobPrintHtml} label="Print Report" />
        </div>

        <div className={`rounded-xl p-5 md:p-7 border ${colors.border} ${colors.bg}`}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                  {job.job_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
            <div className="flex flex-col gap-2 text-sm text-slate-600 md:text-right">
              {startDate && (
                <div className="flex items-center gap-2 md:justify-end">
                  <Calendar className="w-4 h-4" />
                  <span>{format(startDate, 'dd MMM yyyy')} → {endDate ? format(endDate, 'dd MMM yyyy') : 'TBC'}</span>
                </div>
              )}
              <div className="flex items-center gap-2 md:justify-end">
                <Users className="w-4 h-4" />
                <span>{assignedStaff.length} staff assigned</span>
              </div>
              <div className="flex items-center gap-2 md:justify-end">
                <Clock className="w-4 h-4" />
                <span>{rotas.length} total shifts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
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
        </div>

        {/* Right Column */}
        <div className="space-y-6">

          {/* Job Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Job Info</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-xs text-slate-400 uppercase font-medium mb-1">Job Type</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
                  {job.job_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-medium mb-1">Status</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge[job.status || 'planning']}`}>
                  {statusLabels[job.status || 'planning']}
                </span>
              </div>
              {startDate && (
                <div>
                  <p className="text-xs text-slate-400 uppercase font-medium mb-1">Duration</p>
                  <p className="text-sm text-slate-700">{format(startDate, 'dd MMM yyyy')}</p>
                  <p className="text-xs text-slate-400">to {endDate ? format(endDate, 'dd MMM yyyy') : 'TBC'}</p>
                </div>
              )}
              {job.notes && (
                <div>
                  <p className="text-xs text-slate-400 uppercase font-medium mb-1">Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Job Cost Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <PoundSterling className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Estimated Cost</h2>
            </div>
            <div className="px-5 py-4">
              {totalCost === 0 ? (
                <p className="text-sm text-slate-400">No day rates set for assigned staff</p>
              ) : (
                <>
                  <div className="space-y-2 mb-3">
                    {staffCosts.map((sc, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-900">{sc.name}</span>
                          {sc.costType === 'meterage' ? (
                            <span className="text-xs text-slate-400 ml-2">{sc.meterage}m × £{sc.meterageRate}/m</span>
                          ) : (
                            <span className="text-xs text-slate-400 ml-2">{sc.shifts} × £{sc.dayRate}</span>
                          )}
                        </div>
                        <span className="font-semibold text-slate-700 flex-shrink-0">£{sc.cost.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {totalMeterage > 0 && (
                    <div className="flex items-center justify-between pt-2 pb-2 text-sm border-t border-slate-100">
                      <span className="text-slate-500">Total Meterage</span>
                      <span className="font-semibold text-amber-700">{totalMeterage}m</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="font-semibold text-slate-900">Total</span>
                    <span className="text-lg font-bold text-emerald-700">£{totalCost.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Client Info */}
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

          {/* Vehicles */}
          {assignedVehicles.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-700" />
                <h2 className="font-semibold text-slate-900">Vehicles</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {assignedVehicles.map(v => (
                  <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-mono font-bold text-slate-900">{v.registration_number}</p>
                      <p className="text-xs text-slate-500">{v.name}</p>
                    </div>
                  </div>
                ))}
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
        </div>
      </div>
    </div>
  );
}