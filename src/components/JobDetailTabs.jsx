import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Boxes, PoundSterling, FolderOpen, FileText, Eye, Download, Activity, Mountain,
  LayoutGrid, CalendarDays, ShieldCheck, Users, Briefcase, Truck, User, HardHat,
  Phone, MapPin, Send, CheckCircle2, UsersRound, CalendarClock, Ruler, StickyNote, Hotel
} from 'lucide-react';
import { format } from 'date-fns';
import JobLogisticsHub from '@/components/logistics/JobLogisticsHub';
import InvestigationLogManager from '@/components/InvestigationLogManager';
import LogReviewQuickStat from '@/components/investigation/LogReviewQuickStat';
import BoreholeDrillDown from '@/components/BoreholeDrillDown';
import JobHotelBookings from '@/components/JobHotelBookings';
import JobCostingManager from '@/components/JobCostingManager';
import BillingExportButton from '@/components/BillingExportButton';
import PendingPricingWidget from '@/components/PendingPricingWidget';
import JobPhotoGallery from '@/components/JobPhotoGallery';
import DocumentManager from '@/components/DocumentManager';
import JobCommentsViewer from '@/components/JobCommentsViewer';
import JobWorkLog from '@/components/JobWorkLog';
import MilestoneManager from '@/components/MilestoneManager';
import PortalSectionManager from '@/components/PortalSectionManager';
import JobScheduleOverview from '@/components/JobScheduleOverview';
import StaffActivityBreakdown from '@/components/StaffActivityBreakdown';
import DelayLogManager from '@/components/DelayLogManager';
import RigCompliancePanel from '@/components/RigCompliancePanel';
import { getJobTypeLabel } from '@/utils/jobTeams';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const roleLabels = {
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};

const workerTypeBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

function InfoCard({ icon: Icon, iconBg, title, count, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}><Icon className="w-3.5 h-3.5" /></div>
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        {count != null && <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyField({ label }) {
  return <p className="text-xs text-slate-400">Not set</p>;
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 uppercase font-medium">{label}</p>
      <div className="text-slate-700">{children}</div>
    </div>
  );
}

export default function JobDetailTabs({
  job, primaryType, assignedStaff, rotas, allStaff, vehicles, rotasByDate, sortedDates,
  client, contractor, suppliers, contractors, canSeeCosts, isDrillingJob, totalCost,
  staffCosts, totalMeterage, hotelBookings, colors, statusBadge, statusLabels,
  startDate, endDate, jobProject, siblingJobs, onProjectClick, jobTypes = []
}) {
  const queryClient = useQueryClient();
  const [showPortalDialog, setShowPortalDialog] = useState(false);
  const [showProjectJobs, setShowProjectJobs] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(job.portal_enabled || false);
  const [togglingPortal, setTogglingPortal] = useState(false);

  useEffect(() => { setPortalEnabled(job.portal_enabled || false); }, [job.id, job.portal_enabled]);

  const enabledSections = job.portal_sections ? Object.values(job.portal_sections).filter(Boolean).length : 10;

  const handleTogglePortal = async () => {
    const next = !portalEnabled;
    setPortalEnabled(next);
    setTogglingPortal(true);
    try {
      await base44.entities.Job.update(job.id, { portal_enabled: next });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (e) {
      setPortalEnabled(!next);
    }
    setTogglingPortal(false);
  };

  const assignedVehicleIds = [...new Set(rotas.map(r => r.vehicle_id).filter(Boolean))];
  const assignedVehicles = assignedVehicleIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean);

  return (
    <Tabs defaultValue="overview" className="w-full">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 -mx-1 px-1 py-2 mb-4 rounded-t-xl">
        <TabsList className="flex w-full flex-nowrap overflow-x-auto no-scrollbar h-auto p-1.5 gap-1.5 justify-start sm:justify-center">
          <TabsTrigger value="overview" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3 py-1.5 shrink-0 rounded-md"><LayoutGrid className="w-3.5 h-3.5 shrink-0" />Overview</TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3 py-1.5 shrink-0 rounded-md"><CalendarDays className="w-3.5 h-3.5 shrink-0" />Schedule</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3 py-1.5 shrink-0 rounded-md"><Activity className="w-3.5 h-3.5 shrink-0" />Site Logs</TabsTrigger>
          <TabsTrigger value="logistics" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3 py-1.5 shrink-0 rounded-md"><Boxes className="w-3.5 h-3.5 shrink-0" />Logistics</TabsTrigger>
          <TabsTrigger value="boreholes" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3 py-1.5 shrink-0 rounded-md"><Mountain className="w-3.5 h-3.5 shrink-0" />Boreholes</TabsTrigger>
          <TabsTrigger value="accommodation" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3 py-1.5 shrink-0 rounded-md"><Hotel className="w-3.5 h-3.5 shrink-0" />Accommodation</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3 py-1.5 shrink-0 rounded-md"><ShieldCheck className="w-3.5 h-3.5 shrink-0" />Compliance</TabsTrigger>
          {canSeeCosts && <TabsTrigger value="financials" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3 py-1.5 shrink-0 rounded-md"><PoundSterling className="w-3.5 h-3.5 shrink-0" />Financials</TabsTrigger>}
          <TabsTrigger value="documents" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3 py-1.5 shrink-0 rounded-md"><FolderOpen className="w-3.5 h-3.5 shrink-0" />Documents</TabsTrigger>
        </TabsList>
      </div>

      {/* ── Overview Tab ── */}
      <TabsContent value="overview" className="space-y-4 mt-0">
        {/* Workflow checklist for planning jobs */}
        {job.status === 'planning' && (
          <div className="rounded-xl p-4 bg-gradient-to-br from-slate-50 to-[#2E5A1A]/5 border border-emerald-200">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-4 h-4 text-[#2E5A1A]" />
              <h3 className="font-bold text-slate-900 text-sm">Setup Checklist</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className={`rounded-lg p-2.5 border ${job.required_team_ids?.length > 0 ? 'border-[#2E5A1A]/20 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {job.required_team_ids?.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2E5A1A]" /> : <UsersRound className="w-3.5 h-3.5 text-slate-400" />}
                  <p className="text-xs font-bold text-slate-800">1. Teams</p>
                </div>
                <p className="text-[11px] text-slate-500">{job.required_team_ids?.length > 0 ? `${job.required_team_ids.length} assigned` : 'Pick required teams'}</p>
              </div>
              <div className={`rounded-lg p-2.5 border ${hotelBookings.length > 0 ? 'border-[#2E5A1A]/20 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {hotelBookings.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2E5A1A]" /> : <CalendarClock className="w-3.5 h-3.5 text-slate-400" />}
                  <p className="text-xs font-bold text-slate-800">2. Hotels <span className="font-normal text-slate-400">(opt)</span></p>
                </div>
                <p className="text-[11px] text-slate-500">{hotelBookings.length > 0 ? `${hotelBookings.length} booking(s)` : 'Add if needed'}</p>
              </div>
              <div className={`rounded-lg p-2.5 border ${rotas.length > 0 ? 'border-[#2E5A1A]/20 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {rotas.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2E5A1A]" /> : <CalendarClock className="w-3.5 h-3.5 text-slate-400" />}
                  <p className="text-xs font-bold text-slate-800">3. Rota</p>
                </div>
                <p className="text-[11px] text-slate-500">{rotas.length > 0 ? `${rotas.length} shifts` : 'Build the rota'}</p>
              </div>
              <div className={`rounded-lg p-2.5 border ${job.status === 'in_progress' || job.status === 'completed' ? 'border-[#2E5A1A]/20 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {job.status === 'in_progress' || job.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2E5A1A]" /> : <Send className="w-3.5 h-3.5 text-slate-400" />}
                  <p className="text-xs font-bold text-slate-800">4. Publish</p>
                </div>
                <p className="text-[11px] text-slate-500">{job.status === 'in_progress' || job.status === 'completed' ? 'Activated' : 'Submit to email staff'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick info grid — compact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <InfoCard icon={Briefcase} iconBg="bg-[#2E5A1A]/10" title="Job Info">
            <div className="space-y-2 text-sm">
              <Field label="Type">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
                  {getJobTypeLabel(primaryType, jobTypes)}
                </span>
              </Field>
              <Field label="Status">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[job.status || 'planning']}`}>{statusLabels[job.status || 'planning']}</span>
              </Field>
              {job.job_reference && <Field label="Reference"><p className="text-sm">{job.job_reference}</p></Field>}
              {startDate && <Field label="Duration"><p className="text-sm">{format(startDate, 'dd MMM yyyy')} → {endDate ? format(endDate, 'dd MMM yyyy') : 'TBC'}</p></Field>}
            </div>
          </InfoCard>

          <InfoCard icon={User} iconBg="bg-blue-50" title="Contacts">
            <div className="space-y-2 text-sm">
              <Field label="Project Manager">{job.project_manager ? <p className="text-slate-700">{job.project_manager}</p> : <EmptyField />}</Field>
              <Field label="Site Contact">
                {job.site_contact_name || job.site_contact_phone ? (
                  <div>
                    {job.site_contact_name && <p className="text-slate-700">{job.site_contact_name}</p>}
                    {job.site_contact_phone && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Phone className="w-3 h-3" />{job.site_contact_phone}</div>}
                  </div>
                ) : <EmptyField />}
              </Field>
            </div>
          </InfoCard>

          <InfoCard icon={HardHat} iconBg="bg-amber-50" title="Client / Contractor">
            <div className="space-y-2 text-sm">
              {client ? (
                <Field label="Client"><div><p className="font-semibold text-slate-900">{client.name}</p>{client.contact_phone && <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5"><Phone className="w-3 h-3" />{client.contact_phone}</div>}</div></Field>
              ) : contractor ? (
                <Field label="Contractor"><p className="font-semibold text-slate-900">{contractor.name}</p></Field>
              ) : (
                <Field label="Notes">{job.notes ? <p className="text-sm text-slate-600 line-clamp-3">{job.notes}</p> : <EmptyField />}</Field>
              )}
              {contractor && client && <Field label="Contractor"><p className="font-semibold text-slate-900">{contractor.name}</p></Field>}
            </div>
          </InfoCard>

          <InfoCard icon={Truck} iconBg="bg-violet-50" title="Vehicles" count={assignedVehicles.length || undefined}>
            {assignedVehicles.length > 0 ? (
              <div className="space-y-1.5">
                {assignedVehicles.map(v => (
                  <div key={v.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center flex-shrink-0"><Truck className="w-3 h-3 text-slate-500" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-bold text-slate-900">{v.registration_number}</p>
                      <p className="text-[11px] text-slate-500 truncate">{v.name}</p>
                    </div>
                  </div>
                ))}
                {job.requisition_list_url && (
                  <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 bg-[#2E5A1A]/10 text-[#2E5A1A] hover:bg-[#2E5A1A]/20 rounded-lg text-xs font-medium transition">
                    <FileText className="w-3 h-3" /> Requisition
                  </a>
                )}
              </div>
            ) : <p className="text-xs text-slate-400">No vehicles assigned</p>}
          </InfoCard>

        </div>

        {/* Project link */}
        {jobProject && (
          <button onClick={() => setShowProjectJobs(true)} className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 hover:shadow-md transition text-left">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0"><FolderOpen className="w-4 h-4 text-indigo-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 text-sm truncate">{jobProject.name}</p>
              <p className="text-xs text-slate-400">{siblingJobs.length} other job{siblingJobs.length !== 1 ? 's' : ''} in this project</p>
            </div>
            <FolderOpen className="w-4 h-4 text-slate-300 flex-shrink-0" />
          </button>
        )}

        {/* Log review + Client portal — in line */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LogReviewQuickStat job={job} />
          <div className={`rounded-xl border shadow-sm overflow-hidden transition ${portalEnabled ? 'border-[#2E5A1A]/30 bg-gradient-to-br from-[#2E5A1A]/5 to-white' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition ${portalEnabled ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-400'}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 text-sm">Client Portal Access</p>
                <p className="text-xs text-slate-400">{portalEnabled ? 'Client can view this job' : 'Hidden from client'} · {enabledSections}/10 sections visible</p>
              </div>
              <button
                onClick={handleTogglePortal}
                disabled={togglingPortal}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition flex-shrink-0 disabled:opacity-50 ${portalEnabled ? 'bg-[#2E5A1A]' : 'bg-slate-300'}`}
                aria-pressed={portalEnabled}
                aria-label="Toggle client portal access"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${portalEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <button onClick={() => setShowPortalDialog(true)} className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition text-left">
              <span className="flex items-center gap-2 text-xs font-medium text-[#2E5A1A]"><Eye className="w-3.5 h-3.5" /> Manage which sections the client can see</span>
              <span className="text-xs text-slate-400">{enabledSections}/10 →</span>
            </button>
          </div>
        </div>

        {/* Full notes */}
        {job.notes && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <StickyNote className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-slate-900 text-sm">Notes</h3>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}

        {/* Dialogs */}
        <Dialog open={showPortalDialog} onOpenChange={setShowPortalDialog}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#2E5A1A]" /> Client Portal Visibility</DialogTitle></DialogHeader>
            <PortalSectionManager job={job} embedded />
          </DialogContent>
        </Dialog>

        <Dialog open={showProjectJobs} onOpenChange={setShowProjectJobs}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-indigo-600" /> {jobProject?.name}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-slate-500">This job is one of {siblingJobs.length + 1} jobs linked to this project.</p>
              {siblingJobs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No other jobs in this project yet.</p>
              ) : siblingJobs.map(sib => (
                <button key={sib.id} onClick={() => { setShowProjectJobs(false); onProjectClick?.(sib); }} className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/30 transition text-left">
                  <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 truncate">{sib.name}</p><p className="text-xs text-slate-500 truncate">{sib.location} · {statusLabels[sib.status || 'planning']}</p></div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </TabsContent>

      {/* ── Schedule Tab ── */}
      <TabsContent value="schedule" className="space-y-4 mt-0">
        <DelayLogManager job={job} />
        <JobScheduleOverview primaryType={primaryType} assignedStaff={assignedStaff} rotas={rotas} allStaff={allStaff} vehicles={vehicles} rotasByDate={rotasByDate} sortedDates={sortedDates} />
        <StaffActivityBreakdown job={job} assignedStaff={assignedStaff} primaryType={primaryType} />
      </TabsContent>

      {/* ── Site Logs Tab ── */}
      <TabsContent value="activity" className="space-y-4 mt-0">
        <InvestigationLogManager job={job} isDrillingJob={isDrillingJob} assignedStaff={assignedStaff} allStaff={allStaff} canSeeCosts={canSeeCosts} />
      </TabsContent>

      {/* ── Logistics Tab ── */}
      <TabsContent value="logistics" className="space-y-4 mt-0">
        <JobLogisticsHub jobId={job.id} job={job} suppliers={suppliers} contractors={contractors} canSeeCosts={canSeeCosts} isDrillingJob={isDrillingJob} />
      </TabsContent>

      {/* ── Boreholes Tab ── */}
      <TabsContent value="boreholes" className="space-y-4 mt-0">
        <BoreholeDrillDown job={job} jobType={primaryType} />
      </TabsContent>

      {/* ── Accommodation Tab ── */}
      <TabsContent value="accommodation" className="space-y-4 mt-0">
        <JobHotelBookings job={job} assignedStaff={assignedStaff} allStaff={allStaff} />
      </TabsContent>

      {/* ── Compliance Tab ── */}
      <TabsContent value="compliance" className="space-y-4 mt-0">
        <RigCompliancePanel job={job} />
      </TabsContent>

      {/* ── Financials Tab ── */}
      {canSeeCosts && (
        <TabsContent value="financials" className="space-y-4 mt-0">
          <PendingPricingWidget jobId={job.id} />
          <div className="bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 rounded-xl border border-[#2E5A1A]/20 p-4">
            <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-[#2E5A1A]" /><h3 className="font-semibold text-slate-900 text-sm">Billing Export</h3></div>
            <p className="text-xs text-slate-600 mb-3">Pull every billable item — equipment, labour, hotel, deliveries, meterage — into one printable report for invoicing.</p>
            <BillingExportButton jobId={job.id} jobName={job.name} />
          </div>
          <JobCostingManager job={job} totalCost={totalCost} staffCosts={staffCosts} isDrillingJob={isDrillingJob} totalMeterage={totalMeterage} />
        </TabsContent>
      )}

      {/* ── Documents Tab ── */}
      <TabsContent value="documents" className="space-y-4 mt-0">
        <JobPhotoGallery job={job} />
        <DocumentManager job={job} />
        {job.requisition_list_url && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2"><FileText className="w-5 h-5 text-[#2E5A1A]" /><h2 className="font-semibold text-slate-900">Requisition List</h2></div>
            <div className="px-5 py-4 space-y-2">
              <p className="text-sm text-slate-700 truncate">{job.requisition_list_name || 'Requisition List'}</p>
              <div className="flex gap-2">
                <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-[#2E5A1A] hover:bg-emerald-100 rounded-lg text-xs font-medium transition"><Eye className="w-3.5 h-3.5" /> View</a>
                <a href={job.requisition_list_url} download={job.requisition_list_name || 'requisition'} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition"><Download className="w-3.5 h-3.5" /> Download</a>
              </div>
            </div>
          </div>
        )}
        <JobCommentsViewer job={job} />
        <JobWorkLog job={job} />
        <MilestoneManager job={job} />
      </TabsContent>
    </Tabs>
  );
}