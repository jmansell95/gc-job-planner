import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Briefcase, Grid3x3, Calendar, MapPin, Percent, ClipboardCheck, ShieldAlert } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { GLOBAL_ONLY_WIDGETS } from '@/components/dashboard/registry';
import CustomizableWidgetGrid from '@/components/dashboard/CustomizableWidgetGrid';
import ExecutiveSnapshotWidget from '@/components/dashboard/ExecutiveSnapshotWidget';
import GeotechnicalHeatmapWidget from '@/components/dashboard/GeotechnicalHeatmapWidget';
import AiInsightsWidget from '@/components/dashboard/AiInsightsWidget';
import FieldPrioritiesWidget from '@/components/dashboard/FieldPrioritiesWidget';
import PredictiveInsightsWidget from '@/components/dashboard/PredictiveInsightsWidget';
import LiveSiteMapWidget from '@/components/dashboard/LiveSiteMapWidget';
import ClientFeedbackWidget from '@/components/dashboard/ClientFeedbackWidget';
import BenchmarkComparisonsWidget from '@/components/dashboard/BenchmarkComparisonsWidget';
import SiteWeatherOverviewWidget from '@/components/dashboard/SiteWeatherOverviewWidget';
import ExceptionMonitorWidget from '@/components/dashboard/ExceptionMonitorWidget';
import YardControlWidget from '@/components/dashboard/YardControlWidget';
import MissionControlWidget from '@/components/dashboard/MissionControlWidget';
import PredictiveMaintenanceWidget from '@/components/vehicles/PredictiveMaintenanceWidget';
import SiteReadinessGateWidget from '@/components/dashboard/SiteReadinessGateWidget';
import BoreholeProgressWidget from '@/components/dashboard/BoreholeProgressWidget';
import CrewCertificationPulseWidget from '@/components/dashboard/CrewCertificationPulseWidget';
import ReportsHubWidget from '@/components/dashboard/ReportsHubWidget';
import ProjectHealthDashboardWidget from '@/components/dashboard/ProjectHealthDashboardWidget';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import JobSelectorBar from '@/components/dashboard/JobSelectorBar';
import StateMonitorBar from '@/components/dashboard/StateMonitorBar';
import SiteSnapshotGrid from '@/components/dashboard/SiteSnapshotGrid';
import JobQuickDrawer from '@/components/dashboard/JobQuickDrawer';
import CommandJobModal from '@/components/dashboard/CommandJobModal';

export default function DashboardOverview({ onNavigate, onSelectJob }) {
  const [drawerJob, setDrawerJob] = useState(null);
  const [modalJob, setModalJob] = useState(null);
  const { selectedJobId } = useJobFilter();
  const isAllJobs = selectedJobId === 'all';

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 100) });
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: deliveries = [] } = useQuery({ queryKey: ['deliveries'], queryFn: () => base44.entities.DeliveryLog.filter({ scheduled_date: todayStr }) });
  const { data: safetyReports = [] } = useQuery({ queryKey: ['safety-reports-open'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }) });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  const { data: thisWeekRotas = [] } = useQuery({
    queryKey: ['rotas-this-week', weekStartStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: weekStartStr })
  });

  const { data: todayRotasRaw = [] } = useQuery({
    queryKey: ['rotas-today', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr })
  });

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name?.split(' ')[0] || '';

  const titleCase = (s) => s ? s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : s;
  const gbp = (n) => (n != null && !isNaN(n)) ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;

  // Apply job filter to all dashboard data
  const scopedJobs = isAllJobs ? jobs : jobs.filter(j => j.id === selectedJobId);
  const scopedTimesheets = isAllJobs ? timesheets : timesheets.filter(t => t.job_id === selectedJobId);
  const scopedDeliveries = isAllJobs ? deliveries : deliveries.filter(d => d.job_id === selectedJobId);
  const scopedRotas = isAllJobs ? thisWeekRotas : thisWeekRotas.filter(r => r.job_id === selectedJobId);
  const scopedTodayRotas = isAllJobs ? todayRotasRaw : todayRotasRaw.filter(r => r.job_id === selectedJobId);

  const activeJobs = scopedJobs.filter(j => (j.status || 'planning') === 'in_progress');
  const todaysRotas = scopedTodayRotas.filter(r => (r.assigned_date || '').slice(0, 10) === todayStr);
  const staffToday = [...new Set(todaysRotas.map(r => r.staff_id))].length;
  const pendingTs = scopedTimesheets.filter(t => t.status === 'submitted').length;
  const activeStaff = staff.filter(s => s.is_active !== false).length;

  const utilizationPct = activeStaff > 0 ? Math.round((staffToday / activeStaff) * 100) : 0;
  const nowMs = Date.now();
  const overdueSubmittedTs = scopedTimesheets.filter(t => t.status === 'submitted' && t.created_date && (nowMs - new Date(t.created_date).getTime()) > 48 * 3600 * 1000).length;
  const overdueActions = safetyReports.flatMap(r => (r.action_items || [])).filter(a => a && a.due_date && new Date(a.due_date) < new Date()).length;

  const openJobDrawer = (job) => setDrawerJob(job);

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case 'site-readiness-gate': return <SiteReadinessGateWidget onNavigate={onNavigate} />;
      case 'borehole-progress': return <BoreholeProgressWidget />;
      case 'crew-cert-pulse': return <CrewCertificationPulseWidget />;
      case 'executive-snapshot': return <ExecutiveSnapshotWidget onNavigate={onNavigate} />;
      case 'mission-control': return <MissionControlWidget onNavigate={onNavigate} />;
      case 'field-priorities': return <FieldPrioritiesWidget />;
      case 'yard-control': return <YardControlWidget onNavigate={onNavigate} />;
      case 'exception-monitor': return <ExceptionMonitorWidget onNavigate={onNavigate} />;
      case 'live-site-map': return <LiveSiteMapWidget />;
      case 'ai-insights': return <AiInsightsWidget />;
      case 'predictive-insights': return <PredictiveInsightsWidget />;
      case 'site-weather': return <SiteWeatherOverviewWidget onSelectJob={openJobDrawer} />;
      case 'client-feedback': return <ClientFeedbackWidget />;
      case 'benchmark-comparisons': return <BenchmarkComparisonsWidget />;
      case 'geo-heatmap': return <GeotechnicalHeatmapWidget />;
      case 'predictive-maintenance': return <PredictiveMaintenanceWidget onSelectVehicle={(v) => onNavigate?.('assets')} />;
      case 'reports-hub': return <ReportsHubWidget onNavigate={onNavigate} />;
      case 'project-health': return <ProjectHealthDashboardWidget onNavigate={onNavigate} />;
      default: return null;
    }
  };

  const canShowWidget = (id) => isAllJobs || !GLOBAL_ONLY_WIDGETS.includes(id);
  const selectedJob = !isAllJobs ? jobs.find(j => j.id === selectedJobId) : null;

  return (
    <div>
      {/* Hero header — context-aware */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-4 mt-0">
        <div className="bg-white relative overflow-hidden rounded-t-none rounded-b-2xl md:rounded-2xl shadow-sm border border-slate-200/80 px-4 py-3 sm:px-5 sm:py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#2E5A1A] to-[#8DC63F]" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative z-10 pl-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] rounded-xl flex-shrink-0 shadow-sm">
                {isAllJobs ? <Grid3x3 className="w-6 h-6 text-white" /> : <Briefcase className="w-6 h-6 text-white" />}
              </div>
              <div className="min-w-0">
                {isAllJobs ? (
                  <>
                    <h1 className="text-base sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight truncate">
                      {greeting}{firstName ? `, ${firstName}` : ''}
                    </h1>
                    <p className="text-slate-600 text-xs mt-0.5">{format(new Date(), 'EEEE, do MMMM yyyy')}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">{thisWeekRotas.length} {thisWeekRotas.length === 1 ? 'Shift' : 'Shifts'} This Week · Week of {format(weekStart, 'dd MMM yyyy')}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight truncate">{selectedJob?.name || 'Job'}</h1>
                      {selectedJob?.status && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-[#2E5A1A]/10 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20">
                          {titleCase(selectedJob.status.replace(/_/g, ' '))}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                      {selectedJob?.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selectedJob.location}</span>}
                      {selectedJob?.start_date && selectedJob?.end_date && (
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(selectedJob.start_date), 'dd MMM')} – {format(new Date(selectedJob.end_date), 'dd MMM yyyy')}</span>
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isAllJobs && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {gbp(selectedJob?.budget_amount) && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium">Budget</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{gbp(selectedJob.budget_amount)}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                    <Users className="w-3.5 h-3.5 text-[#2E5A1A]" />
                    <span className="text-sm font-bold text-slate-900 tabular-nums">{staffToday}</span>
                    <span className="text-[11px] text-slate-500 font-medium">Crew Today</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* State Monitor Bar — live operational pulse */}
      {isAllJobs && (
        <StateMonitorBar
          className="mb-4"
          monitors={[
            { key: 'active', icon: Briefcase, label: 'Active Jobs', value: activeJobs.length, sublabel: `${scopedJobs.length} total in system`, tone: 'emerald', nav: 'jobs', live: true },
            { key: 'util', icon: Percent, label: 'Crew Utilisation', value: utilizationPct, unit: '%', sublabel: `${staffToday} of ${activeStaff} active crew on site`, tone: 'blue', nav: 'rota', trend: staffToday > 0 ? 'up' : 'down' },
            { key: 'ts', icon: ClipboardCheck, label: 'Timesheet Queue', value: pendingTs, sublabel: overdueSubmittedTs > 0 ? `${overdueSubmittedTs} overdue (>48h)` : 'All within target', tone: overdueSubmittedTs > 0 ? 'rose' : 'amber', nav: 'staff', trend: overdueSubmittedTs > 0 ? 'up' : null },
            { key: 'actions', icon: ShieldAlert, label: 'Overdue Actions', value: overdueActions, sublabel: overdueActions > 0 ? 'Safety items past due' : 'No overdue safety actions', tone: overdueActions > 0 ? 'rose' : 'slate', nav: 'compliance', trend: overdueActions > 0 ? 'up' : 'down' },
          ]}
          onNavigate={onNavigate}
        />
      )}

      <JobSelectorBar />

      {/* Live Site Activity — visual snapshot grid of active sites */}
      {isAllJobs && (
        <SiteSnapshotGrid onSelectJob={openJobDrawer} onNavigate={onNavigate} />
      )}

      {/* Customizable widget grid — drag to reorder, toggle visibility */}
      <CustomizableWidgetGrid renderWidget={renderWidget} canShowWidget={canShowWidget} />

      {/* Job Quick Drawer — slide-out drill-down without leaving the dashboard */}
      <JobQuickDrawer job={drawerJob} onClose={() => setDrawerJob(null)} onOpenFullDetails={onSelectJob} />

      {/* Command Job Modal — full JobDetail in a centered pop-up (from snapshot grid) */}
      <CommandJobModal job={modalJob} onClose={() => setModalJob(null)} />
    </div>
  );
}