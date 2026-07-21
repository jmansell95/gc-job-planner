import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Boxes, PoundSterling, FolderOpen, FileText, Eye, Download, Activity, Mountain } from 'lucide-react';
import JobLogisticsHub from '@/components/logistics/JobLogisticsHub';
import InvestigationLogManager from '@/components/InvestigationLogManager';
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
import PortalLinkManager from '@/components/PortalLinkManager';

export default function JobDetailTabs({ job, primaryType, assignedStaff, allStaff, suppliers, contractors, canSeeCosts, isDrillingJob, totalCost, staffCosts, totalMeterage }) {
  return (
    <Tabs defaultValue="logistics" className="w-full">
      <TabsList className="flex w-full flex-wrap h-auto p-1 gap-1">
        <TabsTrigger value="logistics" className="text-xs sm:text-sm flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5"><Boxes className="w-3.5 h-3.5 shrink-0" />Logistics</TabsTrigger>
        <TabsTrigger value="boreholes" className="text-xs sm:text-sm flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5"><Mountain className="w-3.5 h-3.5 shrink-0" />Boreholes</TabsTrigger>
        <TabsTrigger value="schedule" className="text-xs sm:text-sm flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5"><Activity className="w-3.5 h-3.5 shrink-0" />Activity</TabsTrigger>
        {canSeeCosts && <TabsTrigger value="financials" className="text-xs sm:text-sm flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5"><PoundSterling className="w-3.5 h-3.5 shrink-0" />Financials</TabsTrigger>}
        <TabsTrigger value="documents" className="text-xs sm:text-sm flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5"><FolderOpen className="w-3.5 h-3.5 shrink-0" />Documents</TabsTrigger>
      </TabsList>

      {/* Logistics Tab */}
      <TabsContent value="logistics" className="space-y-6 mt-4">
        <JobLogisticsHub jobId={job.id} job={job} suppliers={suppliers} contractors={contractors} canSeeCosts={canSeeCosts} isDrillingJob={isDrillingJob} />
      </TabsContent>

      {/* Boreholes Tab */}
      <TabsContent value="boreholes" className="space-y-6 mt-4">
        <BoreholeDrillDown job={job} />
      </TabsContent>

      {/* Schedule Tab */}
      <TabsContent value="schedule" className="space-y-6 mt-4">
        <InvestigationLogManager job={job} isDrillingJob={isDrillingJob} />
        <JobHotelBookings job={job} assignedStaff={assignedStaff} allStaff={allStaff} />
      </TabsContent>

      {/* Financials Tab */}
      {canSeeCosts && (
        <TabsContent value="financials" className="space-y-6 mt-4">
          <PendingPricingWidget jobId={job.id} />
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-emerald-700" />
              <h3 className="font-semibold text-slate-900 text-sm">Billing Export</h3>
            </div>
            <p className="text-xs text-slate-600 mb-3">Pull every billable item — equipment, labour, hotel, deliveries, meterage — into one printable report for invoicing. Nothing is missed.</p>
            <BillingExportButton jobId={job.id} jobName={job.name} />
          </div>
          <JobCostingManager job={job} totalCost={totalCost} staffCosts={staffCosts} isDrillingJob={isDrillingJob} totalMeterage={totalMeterage} />
        </TabsContent>
      )}

      {/* Documents Tab */}
      <TabsContent value="documents" className="space-y-6 mt-4">
        <JobPhotoGallery job={job} />
        <DocumentManager job={job} />
        <JobCommentsViewer job={job} />
        <JobWorkLog job={job} />
        <MilestoneManager job={job} />
        {job.requisition_list_url && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Requisition List</h2>
            </div>
            <div className="px-5 py-4 space-y-2">
              <p className="text-sm text-slate-700 truncate">{job.requisition_list_name || 'Requisition List'}</p>
              <div className="flex gap-2">
                <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-medium transition">
                  <Eye className="w-3.5 h-3.5" /> View
                </a>
                <a href={job.requisition_list_url} download={job.requisition_list_name || 'requisition'} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              </div>
            </div>
          </div>
        )}
        <PortalLinkManager job={job} />
      </TabsContent>
    </Tabs>
  );
}