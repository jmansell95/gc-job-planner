import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Boxes, PoundSterling, FolderOpen, FileText, Eye, Download, Activity, Mountain,
  LayoutGrid, CalendarDays, ShieldCheck, Users, Truck, Hotel,
  Camera, Clock, FlaskConical, Link2, AlertTriangle, TrendingUp, Receipt, FileBarChart, ClipboardList
} from 'lucide-react';
import SubTabNav from '@/components/SubTabNav';
import JobLogisticsHub from '@/components/logistics/JobLogisticsHub';
import InvestigationLogManager from '@/components/InvestigationLogManager';
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
import PermanentCrewCard from '@/components/jobs/PermanentCrewCard';
import DelayLogManager from '@/components/DelayLogManager';
import JobHazardMap from '@/components/JobHazardMap';
import JobContextView from '@/components/JobContextView';
import JobDependencyManager from '@/components/JobDependencyManager';
import PredictiveHazardAlerts from '@/components/jobs/PredictiveHazardAlerts';
import DrillingWeatherWidget from '@/components/DrillingWeatherWidget';
import FloodRiskWidget from '@/components/jobs/FloodRiskWidget';
import GeotechDataTab from '@/components/geotech/GeotechDataTab';
import TabStatRibbon from '@/components/TabStatRibbon';
import JobSiteManager from '@/components/jobs/JobSiteManager';
import CVRAFPDashboard from '@/components/cvr/CVRAFPDashboard';

export default function JobDetailTabs({
  job, primaryType, assignedStaff, rotas, allStaff, vehicles, rotasByDate, sortedDates,
  client, contractor, suppliers, contractors, canSeeCosts, isDrillingJob, isGroundworksJob, totalCost,
  staffCosts, totalMeterage, hotelBookings, colors, statusBadge, statusLabels,
  startDate, endDate, jobTypes = []
}) {
  const [activeTab, setActiveTab] = useState('context');
  const [summarySub, setSummarySub] = useState('overview');
  const [scheduleSub, setScheduleSub] = useState('daily');
  const [logsSub, setLogsSub] = useState('activity');
  const [logisticsSub, setLogisticsSub] = useState('equipment');
  const [finSub, setFinSub] = useState('overview');
  const [docsSub, setDocsSub] = useState('photos');

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

      {/* ── Summary Tab ── */}
      <TabsContent value="context" className="mt-0 space-y-3">
        <SubTabNav
          tabs={[
            { id: 'overview', label: 'Overview', icon: LayoutGrid },
            { id: 'links', label: 'Links & Notes', icon: Link2 },
          ]}
          activeTab={summarySub}
          onChange={setSummarySub}
        />
        {summarySub === 'overview' ? (
          <>
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
              jobTypes={jobTypes}
              subTab="overview"
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
          </>
        ) : (
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
            jobTypes={jobTypes}
            subTab="links"
          />
        )}
      </TabsContent>

      {/* ── Schedule Tab ── */}
      <TabsContent value="schedule" className="space-y-3 mt-0">
        <SubTabNav
          tabs={[
            { id: 'daily', label: 'Daily Schedule', icon: CalendarDays },
            { id: 'delays', label: 'Delays', icon: AlertTriangle },
          ]}
          activeTab={scheduleSub}
          onChange={setScheduleSub}
        />
        {scheduleSub === 'daily' ? (
          <>
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
            <PermanentCrewCard job={job} />
            <JobScheduleOverview primaryType={primaryType} assignedStaff={assignedStaff} rotas={rotas} allStaff={allStaff} vehicles={vehicles} rotasByDate={rotasByDate} sortedDates={sortedDates} />
          </>
        ) : (
          <DelayLogManager job={job} />
        )}
      </TabsContent>

      {/* ── Site Logs Tab ── */}
      <TabsContent value="activity" className="space-y-3 mt-0">
        <SubTabNav
          tabs={[
            { id: 'activity', label: 'Activity Logs', icon: Activity },
            { id: 'hazards', label: 'Hazard Map', icon: ShieldCheck },
          ]}
          activeTab={logsSub}
          onChange={setLogsSub}
        />
        {logsSub === 'activity' ? (
          <>
            <TabStatRibbon
              icon={Activity}
              title="Site Logs"
              stats={[
                { icon: Users, value: assignedStaff.length, label: 'Crew On Job', iconColor: 'text-emerald-600' },
                { icon: CalendarDays, value: rotas.filter(r => r.status === 'started' || r.status === 'completed').length, label: 'Active Shifts', iconColor: 'text-blue-600' },
                { icon: ShieldCheck, value: rotas.filter(r => r.briefing_signed).length, label: 'Briefings Signed', iconColor: 'text-amber-600' },
              ]}
            />
            <InvestigationLogManager job={job} isDrillingJob={isDrillingJob} assignedStaff={assignedStaff} allStaff={allStaff} canSeeCosts={canSeeCosts} onViewBoreholes={() => setActiveTab('boreholes')} />
          </>
        ) : (
          <JobHazardMap job={job} />
        )}
      </TabsContent>

      {/* ── Logistics Tab ── */}
      <TabsContent value="logistics" className="space-y-3 mt-0">
        <SubTabNav
          tabs={[
            { id: 'equipment', label: 'Equipment', icon: Boxes },
            { id: 'accommodation', label: 'Accommodation', icon: Hotel },
          ]}
          activeTab={logisticsSub}
          onChange={setLogisticsSub}
        />
        {logisticsSub === 'equipment' ? (
          <>
            <TabStatRibbon
              icon={Boxes}
              title="Logistics"
              stats={[
                { icon: Truck, value: assignedVehicles.length, label: 'Vehicles', iconColor: 'text-violet-600' },
                { icon: Users, value: assignedStaff.length, label: 'Crew', iconColor: 'text-emerald-600' },
              ]}
            />
            <JobLogisticsHub jobId={job.id} job={job} suppliers={suppliers} contractors={contractors} canSeeCosts={canSeeCosts} isDrillingJob={isDrillingJob} />
          </>
        ) : (
          <>
            <TabStatRibbon
              icon={Hotel}
              title="Accommodation"
              stats={[
                { icon: Hotel, value: hotelBookings?.length || 0, label: 'Hotel Bookings', iconColor: 'text-amber-600' },
                { icon: Users, value: assignedStaff.length, label: 'Crew', iconColor: 'text-emerald-600' },
              ]}
            />
            <JobHotelBookings job={job} assignedStaff={assignedStaff} allStaff={allStaff} />
          </>
        )}
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

      {/* ── Geotech Data Tab (drilling jobs only) ── */}
      {isDrillingJob && (
      <TabsContent value="geotech" className="space-y-4 mt-0">
        <GeotechDataTab job={job} allStaff={allStaff} suppliers={suppliers} assets={undefined} />
      </TabsContent>
      )}

      {/* ── Financials Tab ── */}
      {canSeeCosts && (
        <TabsContent value="financials" className="space-y-3 mt-0">
          <SubTabNav
            tabs={[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'cvr-afp', label: 'CVR / AFP', icon: FileBarChart },
              { id: 'subcon', label: 'Sub-contractors', icon: Users },
              { id: 'boq', label: 'BOQ', icon: FileBarChart },
              { id: 'costs', label: 'Daily Costs', icon: Receipt },
              { id: 'export', label: 'Export', icon: Download },
            ]}
            activeTab={finSub}
            onChange={setFinSub}
          />
          {finSub === 'overview' && (
            <>
              <AutoFinancialsBreakdown job={job} />
              <JobFinancialFootprint job={job} />
            </>
          )}
          {finSub === 'cvr-afp' && <CVRAFPDashboard job={job} />}
          {finSub === 'subcon' && <SubcontractorLogManager job={job} />}
          {finSub === 'boq' && <BOQManager job={job} />}
          {finSub === 'costs' && <DailyCostViewer job={job} />}
          {finSub === 'export' && (
            <div className="bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 rounded-xl border border-[#2E5A1A]/20 p-4">
              <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-[#2E5A1A]" /><h3 className="font-semibold text-slate-900 text-sm">Billing Export</h3></div>
              <p className="text-xs text-slate-600 mb-3">Pull every billable item — equipment, labour, hotel, deliveries, meterage — into one printable report for invoicing.</p>
              <BillingExportButton jobId={job.id} jobName={job.name} />
            </div>
          )}
        </TabsContent>
      )}

      {/* ── Documents Tab ── */}
      <TabsContent value="documents" className="space-y-3 mt-0">
        <SubTabNav
          tabs={[
            { id: 'photos', label: 'Photos', icon: Camera },
            { id: 'files', label: 'Documents', icon: FolderOpen },
            { id: 'comments', label: 'Comments', icon: FileText },
            { id: 'worklog', label: 'Work Log', icon: ClipboardList },
            { id: 'milestones', label: 'Milestones', icon: Clock },
          ]}
          activeTab={docsSub}
          onChange={setDocsSub}
        />
        {docsSub === 'photos' && <JobPhotoGallery job={job} />}
        {docsSub === 'files' && (
          <>
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
          </>
        )}
        {docsSub === 'comments' && <JobCommentsViewer job={job} />}
        {docsSub === 'worklog' && <JobWorkLog job={job} />}
        {docsSub === 'milestones' && <MilestoneManager job={job} />}
      </TabsContent>
    </Tabs>
  );
}