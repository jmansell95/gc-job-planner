import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Truck, Briefcase, Grid3x3, ClipboardCheck, Calendar, Settings2, Check, Eye, MapPin, ArrowRight, ShieldAlert, Percent, Timer } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MaintenanceQuickView from '@/components/MaintenanceQuickView';
import DeliveryStats from '@/components/DeliveryStats';
import WidgetCard from '@/components/dashboard/WidgetCard';
import { WIDGET_REGISTRY, DEFAULT_WIDGET_ORDER, DEFAULT_WIDGET_SIZES, DASHBOARD_SECTIONS, WIDGET_TO_SECTION, COST_WIDGETS, GLOBAL_ONLY_WIDGETS, VIEW_PROFILES } from '@/components/dashboard/registry';
import { FieldCrewsWidget, ChartsWidget } from '@/components/dashboard/DashboardWidgets';
import ComplianceOverviewWidget from '@/components/dashboard/ComplianceOverviewWidget';
import ExecutiveSnapshotWidget from '@/components/dashboard/ExecutiveSnapshotWidget';
import JobAssetsWidget from '@/components/dashboard/JobAssetsWidget';
import GeotechnicalHeatmapWidget from '@/components/dashboard/GeotechnicalHeatmapWidget';
import UnbilledLiabilityWidget from '@/components/dashboard/UnbilledLiabilityWidget';
import ProjectFinancialsWidget from '@/components/dashboard/ProjectFinancialsWidget';
import SubconMarginGuardWidget from '@/components/dashboard/SubconMarginGuardWidget';
import FinancialReconciliationWidget from '@/components/dashboard/FinancialReconciliationWidget';
import BillingReadinessGate from '@/components/dashboard/BillingReadinessGate';
import OutstandingReceivablesWidget from '@/components/dashboard/OutstandingReceivablesWidget';
import AiInsightsWidget from '@/components/dashboard/AiInsightsWidget';
import EfficiencySnapshotWidget from '@/components/dashboard/EfficiencySnapshotWidget';
import ProfitabilityDashboard from '@/components/ProfitabilityDashboard';
import RigProfitabilityWidget from '@/components/dashboard/RigProfitabilityWidget';
import FieldPrioritiesWidget from '@/components/dashboard/FieldPrioritiesWidget';
import CashFlowForecastWidget from '@/components/dashboard/CashFlowForecastWidget';
import DrillingPerformanceWidget from '@/components/dashboard/DrillingPerformanceWidget';
import SafetyDashboardWidget from '@/components/dashboard/SafetyDashboardWidget';
import PredictiveInsightsWidget from '@/components/dashboard/PredictiveInsightsWidget';
import TrafficHeatmapWidget from '@/components/dashboard/TrafficHeatmapWidget';
import ProfitabilityAlertsWidget from '@/components/dashboard/ProfitabilityAlertsWidget';
import ComplianceExpiryWidget from '@/components/dashboard/ComplianceExpiryWidget';
import JobQuickDrawer from '@/components/dashboard/JobQuickDrawer';
import SiteSnapshotGrid from '@/components/dashboard/SiteSnapshotGrid';
import CommandJobModal from '@/components/dashboard/CommandJobModal';
import { canViewCostings } from '@/utils/access';
import { useAuth } from '@/lib/AuthContext';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import JobSelectorBar from '@/components/dashboard/JobSelectorBar';
import PulseRibbon from '@/components/dashboard/PulseRibbon';
import CommandCentreTabs from '@/components/dashboard/CommandCentreTabs';
import StateMonitorBar from '@/components/dashboard/StateMonitorBar';

export default function DashboardOverview({ onNavigate, onSelectJob }) {
  const [customizeMode, setCustomizeMode] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState(DEFAULT_WIDGET_ORDER);
  const [widgetSizes, setWidgetSizes] = useState({});
  const [layoutId, setLayoutId] = useState(null);
  const [drawerJob, setDrawerJob] = useState(null);
  const [modalJob, setModalJob] = useState(null);
  const [viewProfile, setViewProfile] = useState('operations');
  const queryClient = useQueryClient();
  const { selectedJobId } = useJobFilter();
  const isAllJobs = selectedJobId === 'all';

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 100) });
  const { data: deliveries = [] } = useQuery({ queryKey: ['deliveries'], queryFn: () => base44.entities.DeliveryLog.filter({ scheduled_date: todayStr }) });
  const { data: safetyReports = [] } = useQuery({ queryKey: ['safety-reports-open'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }) });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  const { data: thisWeekRotas = [] } = useQuery({
    queryKey: ['rotas-this-week', weekStartStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: weekStartStr })
  });

  // Fetch current user's profile + saved dashboard layout
  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const { data: layout } = useQuery({
    queryKey: ['dashboard-layout', profile?.id],
    queryFn: async () => {
      const layouts = await base44.entities.DashboardLayout.filter({ staff_id: profile.id });
      return layouts[0] || null;
    },
    enabled: !!profile?.id
  });

  useEffect(() => {
    if (layout) {
      setLayoutId(layout.id);
      if (layout.widget_order && layout.widget_order.length > 0) {
        setWidgetOrder(layout.widget_order.filter(id => WIDGET_REGISTRY[id]));
      }
      if (layout.widget_sizes) {
        setWidgetSizes(layout.widget_sizes);
      }
    }
  }, [layout]);

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

  const activeJobs = scopedJobs.filter(j => (j.status || 'planning') === 'in_progress');
  const todaysRotas = scopedRotas.filter(r => r.assigned_date === todayStr);
  const staffToday = [...new Set(todaysRotas.map(r => r.staff_id))].length;
  const pendingTs = scopedTimesheets.filter(t => t.status === 'submitted').length;
  const activeStaff = staff.filter(s => s.is_active !== false).length;

  const pendingDeliveries = scopedDeliveries.filter(d => d.status === 'pending' || d.status === 'in_progress').length;

  // Intelligence metrics — contextual, not just raw counts
  const utilizationPct = activeStaff > 0 ? Math.round((staffToday / activeStaff) * 100) : 0;
  const nowMs = Date.now();
  const overdueSubmittedTs = scopedTimesheets.filter(t => t.status === 'submitted' && t.created_date && (nowMs - new Date(t.created_date).getTime()) > 48 * 3600 * 1000).length;
  const overdueActions = safetyReports.flatMap(r => (r.action_items || [])).filter(a => a && a.due_date && new Date(a.due_date) < new Date()).length;

  // Show cost-gated widgets while the profile is loading or errored (published
  // site edge cases); enforce the real role gate once the profile resolves.
  const { user: authUser } = useAuth();
  const isPlatformAdmin = authUser?.role === 'admin';
  const canViewCosts = !profile || canViewCostings(profile, isPlatformAdmin);

  const openJobDrawer = (job) => setDrawerJob(job);

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case 'executive-snapshot': return <ExecutiveSnapshotWidget onNavigate={onNavigate} />;
      case 'delivery-stats': return <DeliveryStats onNavigate={onNavigate} onSelectJob={openJobDrawer} jobs={scopedJobs} />;
      case 'compliance-overview': return <ComplianceOverviewWidget onNavigate={onNavigate} />;
      case 'geo-heatmap': return <GeotechnicalHeatmapWidget />;
      case 'unbilled-wip': return canViewCosts ? <UnbilledLiabilityWidget /> : null;
      case 'project-financials': return canViewCosts ? <ProjectFinancialsWidget onNavigate={onNavigate} /> : null;
      case 'field-crews': return <FieldCrewsWidget todaysRotas={todaysRotas} staff={staff} jobs={scopedJobs} vehicles={vehicles} onSelectJob={openJobDrawer} onNavigate={onNavigate} />;
      case 'charts': return <ChartsWidget jobs={scopedJobs} staff={staff} rotas={scopedRotas} weekDays={weekDays} />;
      case 'maintenance-quick-view': return <MaintenanceQuickView onNavigate={onNavigate} />;
      case 'job-assets': return <JobAssetsWidget onSelectJob={openJobDrawer} />;
      case 'ai-insights': return <AiInsightsWidget />;
      case 'job-profitability': return canViewCosts ? <ProfitabilityDashboard onSelectJob={openJobDrawer} /> : null;
      case 'rig-profitability': return canViewCosts ? <RigProfitabilityWidget onSelectJob={openJobDrawer} /> : null;
      case 'efficiency-snapshot': return canViewCosts ? <EfficiencySnapshotWidget onSelectJob={openJobDrawer} /> : null;
      case 'subcon-margin-guard': return canViewCosts ? <SubconMarginGuardWidget /> : null;
      case 'financial-reconciliation': return canViewCosts ? <FinancialReconciliationWidget /> : null;
      case 'billing-readiness': return canViewCosts ? <BillingReadinessGate onNavigateToJob={(jid) => { const j = jobs.find(x => x.id === jid); if (j) openJobDrawer(j); }} /> : null;
      case 'outstanding-receivables': return canViewCosts ? <OutstandingReceivablesWidget /> : null;
      case 'field-priorities': return <FieldPrioritiesWidget />;
      case 'cash-flow-forecast': return canViewCosts ? <CashFlowForecastWidget /> : null;
      case 'drilling-performance': return <DrillingPerformanceWidget />;
      case 'safety-dashboard': return <SafetyDashboardWidget />;
      case 'predictive-insights': return <PredictiveInsightsWidget />;
      case 'traffic-heatmap': return <TrafficHeatmapWidget onNavigateToJob={onNavigate} />;
      case 'profitability-alerts': return canViewCosts ? <ProfitabilityAlertsWidget onSelectJob={openJobDrawer} /> : null;
      case 'compliance-expiry': return <ComplianceExpiryWidget onNavigate={onNavigate} />;
      default: return null;
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const sectionId = result.source.droppableId;
    const visible = widgetOrder.filter(id => WIDGET_TO_SECTION[id] === sectionId && canShowWidget(id));
    const newVisible = [...visible];
    const [moved] = newVisible.splice(result.source.index, 1);
    newVisible.splice(result.destination.index, 0, moved);
    // Rebuild full order, splicing the reordered visible widgets back into their original slots.
    const newOrder = [];
    let vi = 0;
    for (const id of widgetOrder) {
      if (WIDGET_TO_SECTION[id] === sectionId && canShowWidget(id)) {
        newOrder.push(newVisible[vi++]);
      } else {
        newOrder.push(id);
      }
    }
    setWidgetOrder(newOrder);
  };

  const saveLayout = async (order, sizes) => {
    if (!profile?.id) return;
    try {
      const payload = { widget_order: order, widget_sizes: sizes || {} };
      if (layoutId) {
        await base44.entities.DashboardLayout.update(layoutId, payload);
      } else {
        const created = await base44.entities.DashboardLayout.create({ staff_id: profile.id, ...payload });
        setLayoutId(created.id);
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard-layout', profile.id] });
    } catch (e) { console.error('Layout save error:', e); }
  };

  const handleToggleWidget = (widgetId) => {
    setWidgetOrder(prev => prev.includes(widgetId) ? prev.filter(id => id !== widgetId) : [...prev, widgetId]);
  };

  const handleResize = (widgetId, size) => {
    setWidgetSizes(prev => ({ ...prev, [widgetId]: size }));
  };

  // Click-to-reorder a widget within its section (no dragging required).
  const moveWidget = (widgetId, dir) => {
    setWidgetOrder(prev => {
      const sectionId = WIDGET_TO_SECTION[widgetId];
      const sectionSlots = prev
        .map((id, i) => ({ id, i }))
        .filter(x => WIDGET_TO_SECTION[x.id] === sectionId && canShowWidget(x.id));
      const pos = sectionSlots.findIndex(x => x.id === widgetId);
      if (pos === -1) return prev;
      const target = dir === 'up' ? sectionSlots[pos - 1] : sectionSlots[pos + 1];
      if (!target) return prev;
      const arr = [...prev];
      [arr[sectionSlots[pos].i], arr[target.i]] = [arr[target.i], arr[sectionSlots[pos].i]];
      return arr;
    });
  };

  const getWidgetSize = (widgetId) => widgetSizes[widgetId] || DEFAULT_WIDGET_SIZES[widgetId] || 'md';

  const sizeColSpan = (size) => {
    if (size === 'sm') return 'col-span-1 sm:col-span-1 lg:col-span-1';
    if (size === 'lg') return 'col-span-1 sm:col-span-2 lg:col-span-4';
    return 'col-span-1 sm:col-span-1 lg:col-span-2';
  };

  const handleExitCustomize = () => {
    saveLayout(widgetOrder, widgetSizes);
    setCustomizeMode(false);
  };

  const hiddenWidgets = DEFAULT_WIDGET_ORDER.filter(id => !widgetOrder.includes(id));

  // Active view profile — allow-list of widgets to surface for the current focus.
  const profileWidgets = (VIEW_PROFILES.find(p => p.id === viewProfile) || VIEW_PROFILES[0]).widgets;

  // Hide cost-gated widgets from users who can't view financials.
  // Hide global-only widgets when the dashboard is focused on a single job.
  // Apply the active view profile on top so only that focus area's widgets show.
  const canShowWidget = (id) => (canViewCosts || !COST_WIDGETS.includes(id)) && (isAllJobs || !GLOBAL_ONLY_WIDGETS.includes(id)) && profileWidgets.includes(id);
  const visibleOrder = widgetOrder.filter(canShowWidget);
  const visibleHidden = hiddenWidgets.filter(canShowWidget);

  const selectedJob = !isAllJobs ? jobs.find(j => j.id === selectedJobId) : null;

  return (
    <div>
      {/* Hero header — context-aware */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-4 mt-0">
        <div className="mesh-bg relative overflow-hidden rounded-t-none rounded-b-2xl md:rounded-2xl shadow-lg px-4 py-2.5 sm:px-5 sm:py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 sm:p-2.5 bg-white/15 ring-1 ring-white/25 rounded-xl flex-shrink-0 backdrop-blur-sm">
                {isAllJobs ? <Grid3x3 className="w-6 h-6 text-white" /> : <Briefcase className="w-6 h-6 text-white" />}
              </div>
              <div className="min-w-0">
                {isAllJobs ? (
                  <>
                    <h1 className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-tight truncate">
                      {greeting}{firstName ? `, ${firstName}` : ''}
                    </h1>
                    <p className="text-white/90 text-xs mt-0.5">{format(new Date(), 'EEEE, do MMMM yyyy')}</p>
                    <p className="text-white/70 text-[11px] mt-0.5">{thisWeekRotas.length} {thisWeekRotas.length === 1 ? 'Shift' : 'Shifts'} This Week · Week of {format(weekStart, 'dd MMM yyyy')}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight truncate">{selectedJob?.name || 'Job'}</h1>
                      {selectedJob?.status && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-white/20 text-white ring-1 ring-white/30 backdrop-blur-sm">
                          {titleCase(selectedJob.status.replace(/_/g, ' '))}
                        </span>
                      )}
                    </div>
                    <p className="text-white/90 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                      {selectedJob?.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selectedJob.location}</span>}
                      {selectedJob?.start_date && selectedJob?.end_date && (
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(selectedJob.start_date), 'dd MMM')} – {format(new Date(selectedJob.end_date), 'dd MMM yyyy')}</span>
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {!customizeMode ? (
                <>
                  {/* Job-scoped snapshot only — All Jobs pills moved to StateMonitorBar below */}
                  {!isAllJobs && (
                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                      {gbp(selectedJob?.budget_amount) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                          <span className="text-[11px] text-white/75 font-medium">Budget</span>
                          <span className="text-sm font-bold text-white tabular-nums">{gbp(selectedJob.budget_amount)}</span>
                        </span>
                      )}
                      {gbp(selectedJob?.actual_cost) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                          <span className="text-[11px] text-white/75 font-medium">Spent</span>
                          <span className="text-sm font-bold text-white tabular-nums">{gbp(selectedJob.actual_cost)}</span>
                        </span>
                      )}
                      {(selectedJob?.meterage || selectedJob?.meterage_target) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                          <span className="text-[11px] text-white/75 font-medium">Meterage</span>
                          <span className="text-sm font-bold text-white tabular-nums">{selectedJob.meterage || 0}{selectedJob.meterage_target ? ` / ${selectedJob.meterage_target}` : ''}m</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                        <Users className="w-3.5 h-3.5 text-white/90" />
                        <span className="text-sm font-bold text-white tabular-nums">{staffToday}</span>
                        <span className="text-[11px] text-white/75 font-medium">Crew Today</span>
                      </span>
                    </div>
                  )}
                  <button onClick={() => setCustomizeMode(true)} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/15 ring-1 ring-white/25 text-white rounded-lg hover:bg-white/25 transition text-sm font-medium backdrop-blur-sm w-full sm:w-auto">
                    <Settings2 className="w-4 h-4" /> Customise
                  </button>
                </>
              ) : (
                <button onClick={handleExitCustomize} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-[#2E5A1A] rounded-lg hover:bg-[#2E5A1A] hover:text-white transition text-sm font-semibold shadow-sm w-full sm:w-auto">
                  <Check className="w-4 h-4" /> Done
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* State Monitor Bar — upgraded real-time status cards (replaces the old pills) */}
      {!customizeMode && isAllJobs && (
        <StateMonitorBar
          className="mb-4"
          monitors={[
            { key: 'active', icon: Briefcase, label: 'Active Jobs', value: activeJobs.length, sublabel: `${scopedJobs.length} total in system`, tone: 'emerald', nav: 'jobs' },
            { key: 'util', icon: Percent, label: 'Crew Utilisation', value: utilizationPct, unit: '%', sublabel: `${staffToday} of ${activeStaff} active crew on site`, tone: 'blue', nav: 'rota' },
            { key: 'ts', icon: ClipboardCheck, label: 'Timesheet Queue', value: pendingTs, sublabel: overdueSubmittedTs > 0 ? `${overdueSubmittedTs} overdue (>48h)` : 'All within target', tone: overdueSubmittedTs > 0 ? 'rose' : 'amber', nav: 'timesheets' },
            { key: 'actions', icon: ShieldAlert, label: 'Overdue Actions', value: overdueActions, sublabel: overdueActions > 0 ? 'Safety items past due' : 'No overdue safety actions', tone: overdueActions > 0 ? 'rose' : 'slate', nav: 'safety-hub' },
          ]}
          onNavigate={onNavigate}
        />
      )}

      <JobSelectorBar />

      {/* Command Centre Tabs — full-width focus switcher (Operations / Financials / Compliance) */}
      {!customizeMode && (
        <CommandCentreTabs activeId={viewProfile} onChange={setViewProfile} />
      )}

      {/* At-a-glance intelligence — surfaces critical items needing attention (Operations only) */}
      {!customizeMode && isAllJobs && viewProfile === 'operations' && (
        <PulseRibbon onNavigate={onNavigate} />
      )}

      {/* Live Site Activity — visual snapshot grid of active sites (Operations only) */}
      {!customizeMode && isAllJobs && viewProfile === 'operations' && (
        <SiteSnapshotGrid onSelectJob={openJobDrawer} onNavigate={onNavigate} />
      )}

      {customizeMode && (
        <div className="mb-4 bg-[#2E5A1A]/10 border border-[#2E5A1A]/20 rounded-xl px-4 py-3 text-sm text-[#2E5A1A]">
          Use the ▲ / ▼ arrows to reorder a section, tap S / M / L to resize it, or Hide to remove it. (Dragging still works too.)
        </div>
      )}

      {customizeMode ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          {DASHBOARD_SECTIONS.map(section => {
            const sectionWidgets = visibleOrder.filter(id => WIDGET_TO_SECTION[id] === section.id);
            if (sectionWidgets.length === 0) return null;
            const Icon = section.icon;
            return (
              <section key={section.id} className="mb-5">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{section.label}</h2>
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{sectionWidgets.length}</span>
                </div>
                <Droppable droppableId={section.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 items-start">
                      {sectionWidgets.map((widgetId, index) => (
                        <Draggable key={widgetId} draggableId={widgetId} index={index} isDragDisabled={!customizeMode}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} className={sizeColSpan(getWidgetSize(widgetId))}>
                              <WidgetCard
                                widgetId={widgetId}
                                customizeMode={customizeMode}
                                dragHandleProps={provided.dragHandleProps}
                                onHide={() => handleToggleWidget(widgetId)}
                                size={getWidgetSize(widgetId)}
                                onResize={(s) => handleResize(widgetId, s)}
                                onMoveUp={() => moveWidget(widgetId, 'up')}
                                onMoveDown={() => moveWidget(widgetId, 'down')}
                                canMoveUp={index > 0}
                                canMoveDown={index < sectionWidgets.length - 1}
                              >
                                {renderWidget(widgetId)}
                              </WidgetCard>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </section>
            );
          })}
        </DragDropContext>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 items-start">
          {visibleOrder.map((widgetId) => (
            <div key={widgetId} className={sizeColSpan(getWidgetSize(widgetId))}>
              <WidgetCard widgetId={widgetId} customizeMode={false} size={getWidgetSize(widgetId)}>
                {renderWidget(widgetId)}
              </WidgetCard>
            </div>
          ))}
        </div>
      )}

      {/* Hidden widgets — add them back */}
      {customizeMode && visibleHidden.length > 0 && (
        <div className="mt-2 bg-white rounded-2xl border border-dashed border-slate-300 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Hidden sections — tap to add back</p>
          <div className="flex flex-wrap gap-2">
            {visibleHidden.map(widgetId => {
              const config = WIDGET_REGISTRY[widgetId];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <button key={widgetId} onClick={() => handleToggleWidget(widgetId)} type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:bg-[#2E5A1A]/10 hover:text-[#2E5A1A] hover:border-[#2E5A1A]/20 transition text-sm font-medium">
                  <Eye className="w-4 h-4" /> {config.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Job Quick Drawer — slide-out drill-down without leaving the dashboard */}
      <JobQuickDrawer job={drawerJob} onClose={() => setDrawerJob(null)} onOpenFullDetails={onSelectJob} />

      {/* Command Job Modal — full JobDetail in a centered pop-up (from snapshot grid) */}
      <CommandJobModal job={modalJob} onClose={() => setModalJob(null)} />
    </div>
  );
}