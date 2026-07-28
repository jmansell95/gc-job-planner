import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, MapPin, Calendar, Users, Clock, Edit2,
  CalendarClock, AlertCircle, FileBarChart, PoundSterling, Ruler,
} from 'lucide-react';
import { format } from 'date-fns';
import PrintReportButton from '@/components/PrintReportButton';
import JobWizardModal from '@/components/JobWizardModal';
import { getJobPrimaryType, isDrillingJob as isDrillingJobByTeams, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';
import { getCrewLabel } from '@/utils/terminology';
import { canViewCostings } from '@/utils/access';
import JobStatusModal from '@/components/JobStatusModal';
import JobDetailTabs from '@/components/JobDetailTabs';
import JobWarningsBanner from '@/components/JobWarningsBanner';

const roleLabels = {
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};

const statusBadge = {
  planning: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-emerald-100 text-emerald-700',
  decommissioning: 'bg-orange-100 text-orange-700',
  completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

export default function JobDetail({ job: initialJob, onBack }) {
  const [job, setJob] = useState(initialJob);
  const queryClient = useQueryClient();
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-created_date', 200) });
  const { data: allJobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const primaryType = getJobPrimaryType(job, teams);
  const colors = getJobTypeColor(primaryType, jobTypes);
  const jobProject = projects.find(p => p.id === job.project_id) || null;
  const siblingJobs = jobProject ? allJobs.filter(j => j.project_id === jobProject.id && j.id !== job.id) : [];

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });
  // Default to true while the profile is loading so cost-gated buttons (Add
  // Billable Item, Add Rig & Gear) appear immediately — same pattern as
  // canAccessSection which returns true while the profile is unresolved.
  const canSeeCosts = profileLoading || canViewCostings(profile);

  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers-job-detail'], queryFn: () => base44.entities.Supplier.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['rotas-for-job', job.id], queryFn: () => base44.entities.RotaAssignment.filter({ job_id: job.id }) });
  const { data: hotelBookings = [] } = useQuery({ queryKey: ['hotel-bookings-for-job', job.id], queryFn: () => base44.entities.HotelBooking.filter({ job_id: job.id }) });

  const assignedStaffIds = [...new Set(rotas.map(r => r.staff_id))];
  const assignedStaff = assignedStaffIds.map(id => allStaff.find(s => s.id === id)).filter(Boolean);
  const client = clients.find(c => c.id === job.client_id);
  const contractor = contractors.find(c => c.id === job.contractor_id);

  const rotasByDate = {};
  rotas.forEach(r => { if (!rotasByDate[r.assigned_date]) rotasByDate[r.assigned_date] = []; rotasByDate[r.assigned_date].push(r); });
  const sortedDates = Object.keys(rotasByDate).sort();

  const isDrillingJob = isDrillingJobByTeams(job, teams, jobTypes);
  const jobMeterage = isDrillingJob && job.meterage != null && job.meterage !== '' ? Number(job.meterage) : 0;
  const useJobMeterage = jobMeterage > 0;
  const staffCosts = assignedStaff.map(member => {
    const memberRotas = rotas.filter(r => r.staff_id === member.id);
    const memberMeterage = memberRotas.reduce((sum, r) => sum + (r.meterage || 0), 0);
    return { name: member.name, role: roleLabels[member.job_role] || member.job_role, shifts: memberRotas.length, overtimeShifts: memberRotas.filter(r => r.is_overtime).length, meterage: useJobMeterage ? jobMeterage : memberMeterage, cost: 0 };
  });
  const totalCost = 0;
  const totalMeterage = useJobMeterage ? jobMeterage : staffCosts.reduce((sum, s) => sum + s.meterage, 0);

  const startDate = job.start_date ? new Date(job.start_date + 'T00:00:00') : null;
  const endDate = job.end_date ? new Date(job.end_date + 'T00:00:00') : null;

  const handleFullReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await base44.functions.invoke('generateJobReport', { jobId: job.id });
      const win = window.open('', '_blank');
      win.document.write(res.data.html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (err) { console.error('Report generation error:', err); }
    setGeneratingReport(false);
  };

  const handleStatusSave = async (data) => {
    await base44.entities.Job.update(job.id, data);
    setJob(prev => ({ ...prev, ...data }));
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const handleEdit = () => setShowEditWizard(true);

  const handleEditSaved = (savedJob) => {
    setShowEditWizard(false);
    setJob(prev => ({ ...prev, ...savedJob }));
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const handleProjectJobSelect = (sib) => { setJob(sib); window.scrollTo(0, 0); };

  const buildJobPrintHtml = () => {
    const staffRows = assignedStaff.map(s => {
      const shifts = rotas.filter(r => r.staff_id === s.id).length;
      return `<tr><td>${s.name}</td><td>${roleLabels[s.job_role] || s.job_role}</td><td>${s.worker_type?.replace(/_/g,' ')}</td><td>${shifts}</td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html><head><title>Job Report – ${job.name}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:18px;margin-bottom:2px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}table{width:100%;border-collapse:collapse}th{background:#1a5c3a;color:white;padding:5px 8px;text-align:left;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}@media print{body{margin:10mm}}</style></head><body>
    <h1>${job.name}</h1><div style="color:#555;font-size:11px;margin-bottom:14px">${getJobTypeLabel(primaryType, jobTypes)} · ${job.location} · ${job.start_date} → ${job.end_date || 'TBC'}</div>
    ${assignedStaff.length > 0 ? `<h2>Assigned Staff (${assignedStaff.length})</h2><table><thead><tr><th>Name</th><th>Role</th><th>Type</th><th>Shifts</th></tr></thead><tbody>${staffRows}</tbody></table>` : ''}
    ${job.notes ? `<h2>Notes</h2><p>${job.notes}</p>` : ''}</body></html>`;
  };

  if (showEditWizard) {
    return (
      <JobWizardModal
        open={showEditWizard}
        onClose={() => setShowEditWizard(false)}
        onCreated={handleEditSaved}
        editingJob={job}
      />
    );
  }

  return (
    <div>
      {/* Top bar — compact */}
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#2E5A1A] hover:text-[#1c4a12] font-medium transition">
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowStatusModal(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> <span className="hidden sm:inline">Change</span> Status
          </button>
          <button onClick={handleEdit} className="flex items-center gap-2 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-sm font-medium">
            <Edit2 className="w-4 h-4" /> Edit
          </button>
          <PrintReportButton buildHtml={buildJobPrintHtml} label="Print" className="px-3 py-2" />
          <button onClick={handleFullReport} disabled={generatingReport} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition text-sm font-medium disabled:opacity-50">
            <FileBarChart className="w-4 h-4" /> {generatingReport ? '...' : 'Report'}
          </button>
        </div>
      </div>

      {/* Compact header — all key info in one band */}
      <div className="rounded-2xl overflow-hidden mb-3 sm:mb-4 shadow-sm border border-slate-200">
        <div className={`px-4 py-3 sm:px-5 sm:py-4 ${colors.bg} ${colors.border} border-b`}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/80 ${colors.text}`}>
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                  {getJobTypeLabel(primaryType, jobTypes)}
                </span>
                <button onClick={() => setShowStatusModal(true)} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge[job.status || 'planning']} hover:opacity-80 transition cursor-pointer`}>
                  {statusLabels[job.status || 'planning']}
                </button>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">{job.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 text-slate-700 text-sm">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{job.location}</span>
                {job.job_reference && <><span className="text-slate-400">·</span><span className="text-slate-600">Ref: {job.job_reference}</span></>}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-700 md:justify-end items-center">
              {startDate && (
                <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /><span className="text-xs">{format(startDate, 'dd MMM')} → {endDate ? format(endDate, 'dd MMM') : 'TBC'}</span></div>
              )}
              {startDate && endDate && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/70 rounded-lg border border-slate-200/60">
                  <CalendarClock className="w-4 h-4 text-[#2E5A1A]" />
                  <span className="font-bold text-slate-900 text-xs">{Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1)}</span>
                  <span className="text-slate-500 text-xs">days</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Metric chips strip — compact */}
        <div className="px-4 py-2 sm:px-5 sm:py-2.5 bg-white border-t border-slate-100 flex items-center gap-3 md:gap-5 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm">
            <Users className="w-4 h-4 text-[#2E5A1A]" />
            <span className="font-bold text-slate-900">{assignedStaff.length}</span>
            <span className="text-slate-500 text-xs">{assignedStaff.length === 1 ? getCrewLabel(primaryType, 1).toLowerCase() : 'crew'}</span>
          </div>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-900">{rotas.length}</span>
            <span className="text-slate-500 text-xs">{rotas.length === 1 ? 'shift' : 'shifts'}</span>
          </div>
          {isDrillingJob && totalMeterage > 0 && (
            <>
              <div className="h-5 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5 text-sm">
                <Ruler className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-slate-900">{totalMeterage}m</span>
                <span className="text-slate-500 text-xs">drilled</span>
              </div>
            </>
          )}
          {canSeeCosts && job.budget_amount != null && (
            <>
              <div className="h-5 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5 text-sm">
                <PoundSterling className="w-4 h-4 text-violet-600" />
                <span className="font-bold text-slate-900">£{Number(job.budget_amount).toLocaleString()}</span>
                <span className="text-slate-500 text-xs">budget</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Intelligent warnings — only shows when there are issues */}
      <div className="mb-4">
        <JobWarningsBanner job={job} assignedStaffCount={assignedStaff.length} />
      </div>

      {/* Unified tabbed command center — no more long scroll */}
      <JobDetailTabs
        job={job}
        primaryType={primaryType}
        assignedStaff={assignedStaff}
        rotas={rotas}
        allStaff={allStaff}
        vehicles={vehicles}
        rotasByDate={rotasByDate}
        sortedDates={sortedDates}
        client={client}
        contractor={contractor}
        suppliers={suppliers}
        contractors={contractors}
        canSeeCosts={canSeeCosts}
        isDrillingJob={isDrillingJob}
        totalCost={totalCost}
        staffCosts={staffCosts}
        totalMeterage={totalMeterage}
        hotelBookings={hotelBookings}
        colors={colors}
        statusBadge={statusBadge}
        statusLabels={statusLabels}
        startDate={startDate}
        endDate={endDate}
        jobProject={jobProject}
        siblingJobs={siblingJobs}
        onProjectClick={handleProjectJobSelect}
        jobTypes={jobTypes}
      />

      {showStatusModal && (
        <JobStatusModal job={job} onClose={() => setShowStatusModal(false)} onSave={handleStatusSave} />
      )}
    </div>
  );
}