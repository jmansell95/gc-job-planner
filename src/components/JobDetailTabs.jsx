import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Boxes, PoundSterling, FolderOpen, FileText, Eye, Download, Activity, Mountain,
  LayoutGrid, CalendarDays, ShieldCheck, Users, Truck, Hotel,
  Camera, Clock, FlaskConical
} from 'lucide-react';
import JobLogisticsHub from '@/components/logistics/JobLogisticsHub';
import InvestigationLogManager from '@/components/InvestigationLogManager';
import LogReviewQuickStat from '@/components/investigation/LogReviewQuickStat';
import BoreholeDrillDown from '@/components/BoreholeDrillDown';
import JobHotelBookings from '@/components/JobHotelBookings';
import AutoFinancialsBreakdown from '@/components/financials/AutoFinancialsBreakdown';
import SubcontractorLogManager from '@/components/financials/SubcontractorLogManager';
import DailyCostViewer from '@/components/financials/DailyCostViewer';
import JobFinancialFootprint from '@/components/financials/JobFinancialFootprint';
import BillingExportButton from '@/components/BillingExportButton';
import BOQManager from '@/components/billing/BOQManager';
import JobPhotoGallery from '@/components/JobPhotoGallery';
import DocumentManager from '@/components/DocumentManager';
import JobCommentsViewer from '@/components/JobCommentsViewer';
import JobWorkLog from '@/components/JobWorkLog';
import MilestoneManager from '@/components/MilestoneManager';
import PortalLinkManager from '@/components/PortalLinkManager';
import JobScheduleOverview from '@/components/JobScheduleOverview';
import StaffActivityBreakdown from '@/components/StaffActivityBreakdown';
import DelayLogManager from '@/components/DelayLogManager';
import RigCompliancePanel from '@/components/RigCompliancePanel';
import JobHazardMap from '@/components/JobHazardMap';
import JobContextView from '@/components/JobContextView';
import JobDependencyManager from '@/components/JobDependencyManager';
import DrillingWeatherWidget from '@/components/DrillingWeatherWidget';
import FloodRiskWidget from '@/components/jobs/FloodRiskWidget';
import PredictiveHazardAlerts from '@/components/jobs/PredictiveHazardAlerts';
import GeotechDataTab from '@/components/geotech/GeotechDataTab';
import TabStatRibbon from '@/components/TabStatRibbon';
import JobSiteManager from '@/components/jobs/JobSiteManager';
export default function JobDetailTabs({
  job, primaryType, assignedStaff, rotas, allStaff, vehicles, rotasByDate, sortedDates,
  client, contractor, suppliers, contractors, canSeeCosts, isDrillingJob, isGroundworksJob, totalCost,
  staffCosts, totalMeterage, hotelBookings, colors, statusBadge, statusLabels,
  startDate, endDate, jobProject, siblingJobs, onProjectClick, jobTypes = []
}) {
  const [activeTab, setActiveTab] = useState('context');

  const assignedVehicleIds = [...new Set(rotas.map(r => r.vehicle_id).filter(Boolean))];
  const assignedVehicles = assignedVehicleIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-sm p-1.5 mb-4">
        <TabsList className="flex w-full flex-nowrap overflow-x-auto no-scrollbar h-auto p-0 gap-1 bg-transparent">
          <TabsTrigger value="context" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl flex-shrink-0 whitespace-nowrap data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2E5A1A] data-[state=active]:to-[#5A8C1E] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"><LayoutGrid className="w-4 h-4 shrink-0" />Summary</TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl flex-shrink-0 whitespace-nowrap data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2E5A1A] data-[state=active]:to-[#5A8C1E] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"><CalendarDays className="w-4 h-4 shrink-0" />Schedule</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl flex-shrink-0 whitespace-nowrap data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2E5A1A] data-[state=active]:to-[#5A8C1E] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"><Activity className="w-4 h-4 shrink-0" />Site Logs</TabsTrigger>
          {isDrillingJob && <TabsTrigger value="boreholes" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl flex-shrink-0 whitespace-nowrap data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2E5A1A] data-[state=active]:to-[#5A8C1E] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"><Mountain className="w-4 h-4 shrink-0" />Boreholes</TabsTrigger>}
          {isDrillingJob && <TabsTrigger value="geotech" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl flex-shrink-0 whitespace-nowrap data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2E5A1A] data-[state=active]:to-[#5A8C1E] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"><FlaskConical className="w-4 h-4 shrink-0" />Geotech</TabsTrigger>}
          <TabsTrigger value="logistics" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl flex-shrink-0 whitespace-nowrap data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2E5A1A] data-[state=active]:to-[#5A8C1E] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"><Boxes className="w-4 h-4 shrink-0" />Logistics</TabsTrigger>
          {canSeeCosts && <TabsTrigger value="financials" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl flex-shrink-0 whitespace-nowrap data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2E5A1A] data-[state=active]:to-[#5A8C1E] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"><PoundSterling className="w-4 h-4 shrink-0" />Financials</TabsTrigger>}
          <TabsTrigger value="documents" className="text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl flex-shrink-0 whitespace-nowrap data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2E5A1A] data-[state=active]:to-[#5A8C1E] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"><FolderOpen className="w-4 h-4 shrink-0" />Documents</TabsTrigger>
        </TabsList>
      </div>

      {/* ── Summary Tab (multi-pane high-density view) ── */}
      <TabsContent value="context" className="mt-0 space-y-4">
        <JobContextView
        job={job}
        primaryType={primaryType}
        assignedStaff={assignedStaff}
        rotas={rotas}
        allStaff={allStaff}
        client={client}
        contractor={contractor}
        suppliers={suppliers}
        vehicles={vehicles}
        hotelBookings={hotelBookings}
        canSeeCosts={canSeeCosts}
        isDrillingJob={isDrillingJob}
        colors={colors}
        statusBadge={statusBadge}
        statusLabels={statusLabels}
        startDate={startDate}
        endDate={endDate}
        jobProject={jobProject}
        siblingJobs={siblingJobs}
        onProjectClick={onProjectClick}
        jobTypes={jobTypes}
        />
        <JobSiteManager job={job} />
        <JobDependencyManager job={job} />
        <PredictiveHazardAlerts job={job} />
        {(job.site_lat != null && job.site_lng != null) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DrillingWeatherWidget
              lat={job.site_lat}
              lng={job.site_lng}
              locationName={job.location}
              compact={isDrillingJob ? false : true}
              rigType={job.drilling_method === 'cp' ? 'cp' : job.drilling_method === 'rotary' ? 'rotary' : undefined}
            />
            <FloodRiskWidget
              lat={job.site_lat}
              lng={job.site_lng}
              locationName={job.location}
            />
          </div>
        )}
      </TabsContent>

      {/* ── Schedule Tab ── */}
      <TabsContent value="schedule" className="space-y-4 mt-0">
        <TabStatRibbon
          icon={CalendarDays}
          title="Schedule Summary"
          stats={[
            { icon: Users, value: assignedStaff.length, label: assignedStaff.length === 1 ? 'Crew Member' : 'Crew Members', iconColor: 'text-emerald-600' },
            { icon: CalendarDays, value: sortedDates.length, label: sortedDates.length === 1 ? 'Work Day' : 'Work Days', iconColor: 'text-blue-600' },
            { icon: Truck, value: assignedVehicles.length, label: 'Vehicles', iconColor: 'text-violet-600' },
            { icon: Clock, value: rotas.length, label: rotas.length === 1 ? 'Shift' : 'Total Shifts', iconColor: 'text-amber-600' },
          ]}
        />
        <DelayLogManager job={job} />
        <JobScheduleOverview primaryType={primaryType} assignedStaff={assignedStaff} rotas={rotas} allStaff={allStaff} vehicles={vehicles} rotasByDate={rotasByDate} sortedDates={sortedDates} />
        <StaffActivityBreakdown job={job} assignedStaff={assignedStaff} primaryType={primaryType} />
      </TabsContent>

      {/* ── Site Logs & Compliance Tab ── */}
      <TabsContent value="activity" className="space-y-4 mt-0">
        <TabStatRibbon
          icon={Activity}
          title="Site Logs & Compliance"
          stats={[
            { icon: Users, value: assignedStaff.length, label: 'Crew On Job', iconColor: 'text-emerald-600' },
            { icon: CalendarDays, value: rotas.filter(r => r.status === 'started' || r.status === 'completed').length, label: 'Active Shifts', iconColor: 'text-blue-600' },
            { icon: ShieldCheck, value: rotas.filter(r => r.briefing_signed).length, label: 'Briefings Signed', iconColor: 'text-amber-600' },
          ]}
        />
        <InvestigationLogManager job={job} isDrillingJob={isDrillingJob} assignedStaff={assignedStaff} allStaff={allStaff} canSeeCosts={canSeeCosts} onViewBoreholes={() => setActiveTab('boreholes')} />
        <JobHazardMap job={job} />
        {isDrillingJob && <RigCompliancePanel job={job} />}
      </TabsContent>

      {/* ── Logistics Tab (includes accommodation) ── */}
      <TabsContent value="logistics" className="space-y-4 mt-0">
        <TabStatRibbon
          icon={Boxes}
          title="Logistics & Accommodation"
          stats={[
            { icon: Truck, value: assignedVehicles.length, label: 'Vehicles', iconColor: 'text-violet-600' },
            { icon: Users, value: assignedStaff.length, label: 'Crew', iconColor: 'text-emerald-600' },
            { icon: Hotel, value: hotelBookings?.length || 0, label: 'Hotel Bookings', iconColor: 'text-amber-600' },
          ]}
        />
        <JobLogisticsHub jobId={job.id} job={job} suppliers={suppliers} contractors={contractors} canSeeCosts={canSeeCosts} isDrillingJob={isDrillingJob} />
        <JobHotelBookings job={job} assignedStaff={assignedStaff} allStaff={allStaff} />
      </TabsContent>

      {/* ── Boreholes Tab (drilling jobs only) ── */}
      {isDrillingJob && (
      <TabsContent value="boreholes" className="space-y-4 mt-0">
        <TabStatRibbon
          icon={Mountain}
          title="Drilling Progress"
          stats={[
            { icon: Users, value: assignedStaff.length, label: 'Crew', iconColor: 'text-emerald-600' },
            { icon: Mountain, value: `${(totalMeterage || 0).toFixed(1)}m`, label: 'Total Drilled', iconColor: 'text-blue-600' },
            { icon: CalendarDays, value: rotas.length, label: 'Shifts Logged', iconColor: 'text-amber-600' },
          ]}
        />
        <BoreholeDrillDown job={job} jobType={primaryType} />
      </TabsContent>
      )}

      {/* ── Geotech Data Tab (drilling jobs only — samples, lab tests, monitoring wells, calibration) ── */}
      {isDrillingJob && (
      <TabsContent value="geotech" className="space-y-4 mt-0">
        <GeotechDataTab job={job} allStaff={allStaff} suppliers={suppliers} assets={undefined} />
      </TabsContent>
      )}

      {/* ── Financials Tab (includes sub-contractors) ── */}
      {canSeeCosts && (
        <TabsContent value="financials" className="space-y-4 mt-0">
          <AutoFinancialsBreakdown job={job} />
          <SubcontractorLogManager job={job} />
          <JobFinancialFootprint job={job} />
          <BOQManager job={job} />
          <DailyCostViewer job={job} />
          <div className="bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 rounded-xl border border-[#2E5A1A]/20 p-4">
            <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-[#2E5A1A]" /><h3 className="font-semibold text-slate-900 text-sm">Billing Export</h3></div>
            <p className="text-xs text-slate-600 mb-3">Pull every billable item — equipment, labour, hotel, deliveries, meterage — into one printable report for invoicing.</p>
            <BillingExportButton jobId={job.id} jobName={job.name} />
          </div>
        </TabsContent>
      )}

      {/* ── Documents Tab ── */}
      <TabsContent value="documents" className="space-y-4 mt-0">
        <TabStatRibbon
          icon={FolderOpen}
          title="Documents & Records"
          stats={[
            { icon: Camera, value: '—', label: 'Photos', iconColor: 'text-emerald-600' },
            { icon: FileText, value: job.requisition_list_url ? '1' : '0', label: 'Requisitions', iconColor: 'text-blue-600' },
            { icon: FolderOpen, value: '—', label: 'Documents', iconColor: 'text-amber-600' },
          ]}
        />
        <JobPhotoGallery job={job} />
        <DocumentManager job={job} />
        {job.requisition_list_url && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2"><FileText className="w-5 h-5 text-[#2E5A1A]" /><h3 className="font-semibold text-slate-900 text-sm">Requisition List</h3></div>
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