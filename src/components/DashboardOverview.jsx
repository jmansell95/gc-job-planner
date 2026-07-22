import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Truck, Briefcase, Grid3x3, ClipboardCheck, Plus, Calendar, Settings2, Check, Eye, MapPin } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MaintenanceQuickView from '@/components/MaintenanceQuickView';
import JobCostAnalytics from '@/components/JobCostAnalytics';
import DeliveryStats from '@/components/DeliveryStats';
import WidgetCard from '@/components/dashboard/WidgetCard';
import { WIDGET_REGISTRY, DEFAULT_WIDGET_ORDER, DEFAULT_WIDGET_SIZES, DASHBOARD_SECTIONS, WIDGET_TO_SECTION, COST_WIDGETS, GLOBAL_ONLY_WIDGETS } from '@/components/dashboard/registry';
import { KpiStatsWidget, FieldCrewsWidget, ChartsWidget } from '@/components/dashboard/DashboardWidgets';
import ComplianceOverviewWidget from '@/components/dashboard/ComplianceOverviewWidget';
import SupervisorOverviewWidget from '@/components/dashboard/SupervisorOverviewWidget';
import JobAssetsWidget from '@/components/dashboard/JobAssetsWidget';
import AiInsightsWidget from '@/components/dashboard/AiInsightsWidget';
import SiteHazardMapWidget from '@/components/dashboard/SiteHazardMapWidget';
import ProfitabilityDashboard from '@/components/ProfitabilityDashboard';
import AssetCrewProfitability from '@/components/AssetCrewProfitability';
import RigProfitabilityWidget from '@/components/dashboard/RigProfitabilityWidget';
import JobQuickDrawer from '@/components/dashboard/JobQuickDrawer';
import SiteSnapshotGrid from '@/components/dashboard/SiteSnapshotGrid';
import CommandJobModal from '@/components/dashboard/CommandJobModal';
import { canViewCostings } from '@/utils/access';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import JobSelectorBar from '@/components/dashboard/JobSelectorBar';
import PulseRibbon from '@/components/dashboard/PulseRibbon';

export default function DashboardOverview({ onNavigate, onSelectJob }) {
  const [customizeMode, setCustomizeMode] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState(DEFAULT_WIDGET_ORDER);
  const [widgetSizes, setWidgetSizes] = useState({});
  const [layoutId, setLayoutId] = useState(null);
  const [drawerJob, setDrawerJob] = useState(null);
  const [modalJob, setModalJob] = useState(null);
  const queryClient = useQueryClient();
  const { selectedJobId } = useJobFilter();
  const isAllJobs = selectedJobId === 'all';

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 100) });
  const { data: deliveries = [] } = useQuery({ queryKey: ['deliveries'], queryFn: () => base44.entities.DeliveryLog.filter({ scheduled_date: todayStr }) });

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

  // Apply job filter to all dashboard data
  const scopedJobs = isAllJobs ? jobs : jobs.filter(j => j.id === selectedJobId);
  const scopedTimesheets = isAllJobs ? timesheets : timesheets.filter(t => t.job_id === selectedJobId);
  const scopedDeliveries = isAllJobs ? deliveries : deliveries.filter(d => d.job_id === selectedJobId);
  const scopedRotas = isAllJobs ? thisWeekRotas : thisWeekRotas.filter(r => r.job_id === selectedJobId);

  const activeJobs = scopedJobs.filter(j => (j.status || 'planning') === 'in_progress');
  const onHoldJobs = scopedJobs.filter(j => j.status === 'on_hold');
  const todaysRotas = scopedRotas.filter(r => r.assigned_date === todayStr);
  const staffToday = [...new Set(todaysRotas.map(r => r.staff_id))].length;
  const pendingTs = scopedTimesheets.filter(t => t.status === 'submitted').length;
  const activeStaff = staff.filter(s => s.is_active !== false).length;

  const pendingDeliveries = scopedDeliveries.filter(d => d.status === 'pending' || d.status === 'in_progress').length;
  const planningJobs = scopedJobs.filter(j => (j.status || 'planning') === 'planning').length;

  const stats = [
    { label: isAllJobs ? 'Active Jobs' : 'Job Status', value: isAllJobs ? activeJobs.length : titleCase((scopedJobs[0]?.status || '—').replace(/_/g, ' ')), isText: !isAllJobs, sub: isAllJobs ? (onHoldJobs.length ? `${onHoldJobs.length} On Hold · ${planningJobs} Planning` : `${planningJobs} Planning · ${scopedJobs.length} Total`) : (scopedJobs[0]?.location || ''), icon: Briefcase, gradient: 'stat-gradient-emerald', nav: 'jobs' },
    { label: 'Crews Deployed', value: staffToday, sub: `${activeStaff} Active Crew`, icon: Users, gradient: 'stat-gradient-blue', nav: 'rota' },
    { label: 'Timesheet Queue', value: pendingTs, sub: 'Awaiting Approval', icon: ClipboardCheck, gradient: pendingTs > 0 ? 'stat-gradient-amber' : 'stat-gradient-slate', nav: 'timesheets' },
    { label: 'Deliveries Today', value: pendingDeliveries, sub: `${scopedDeliveries.length} Scheduled`, icon: Truck, gradient: pendingDeliveries > 0 ? 'stat-gradient-rose' : 'stat-gradient-slate', nav: 'deliveries' },
  ];

  const canViewCosts = canViewCostings(profile);

  const openJobDrawer = (job) => setDrawerJob(job);

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case 'delivery-stats': return <DeliveryStats onNavigate={onNavigate} onSelectJob={openJobDrawer} jobs={scopedJobs} />;
      case 'kpi-stats': return <KpiStatsWidget stats={stats} onNavigate={onNavigate} />;
      case 'compliance-overview': return <ComplianceOverviewWidget onNavigate={onNavigate} />;
      case 'supervisor-overview': return <SupervisorOverviewWidget profile={profile} onSelectJob={openJobDrawer} />;
      case 'field-crews': return <FieldCrewsWidget todaysRotas={todaysRotas} staff={staff} jobs={scopedJobs} vehicles={vehicles} onSelectJob={openJobDrawer} onNavigate={onNavigate} />;
      case 'charts': return <ChartsWidget jobs={scopedJobs} staff={staff} rotas={scopedRotas} weekDays={weekDays} />;
      case 'cost-analytics': return canViewCosts ? <JobCostAnalytics onSelectJob={openJobDrawer} /> : null;
      case 'maintenance-quick-view': return <MaintenanceQuickView onNavigate={onNavigate} />;
      case 'job-assets': return <JobAssetsWidget onSelectJob={openJobDrawer} />;
      case 'ai-insights': return <AiInsightsWidget />;
      case 'job-profitability': return canViewCosts ? <ProfitabilityDashboard onSelectJob={openJobDrawer} /> : null;
      case 'asset-crew-profitability': return canViewCosts ? <AssetCrewProfitability onSelectJob={openJobDrawer} /> : null;
      case 'rig-profitability': return canViewCosts ? <RigProfitabilityWidget onSelectJob={openJobDrawer} /> : null;
      case 'site-hazards': return <SiteHazardMapWidget onNavigate={onNavigate} />;
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

  const getWidgetSize = (widgetId) => widgetSizes[widgetId] || DEFAULT_WIDGET_SIZES[widgetId] || 'md';

  const sizeColSpan = (size) => {
    if (size === 'sm') return 'col-span-1';
    if (size === 'lg') return 'col-span-1 lg:col-span-4';
    return 'col-span-1 lg:col-span-2';
  };

  const handleExitCustomize = () => {
    saveLayout(widgetOrder, widgetSizes);
    setCustomizeMode(false);
  };

  const hiddenWidgets = DEFAULT_WIDGET_ORDER.filter(id => !widgetOrder.includes(id));

  // Hide cost-gated widgets from users who can't view financials.
  // Hide global-only widgets when the dashboard is focused on a single job.
  const canShowWidget = (id) => (canViewCosts || !COST_WIDGETS.includes(id)) && (isAllJobs || !GLOBAL_ONLY_WIDGETS.includes(id));
  const visibleOrder = widgetOrder.filter(canShowWidget);
  const visibleHidden = hiddenWidgets.filter(canShowWidget);

  const selectedJob = !isAllJobs ? jobs.find(j => j.id === selectedJobId) : null;

  return (
    <div>
      {/* Hero header — context-aware */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-5">
        <div className="mesh-bg relative overflow-hidden rounded-3xl shadow-xl px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-3 bg-white/15 ring-1 ring-white/25 rounded-2xl flex-shrink-0 backdrop-blur-sm">
                {isAllJobs ? <Grid3x3 className="w-7 h-7 text-white" /> : <Briefcase className="w-7 h-7 text-white" />}
              </div>
              <div className="min-w-0">
                {isAllJobs ? (
                  <>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
                      {greeting}{firstName ? `, ${firstName}` : ''}
                    </h1>
                    <p className="text-white/90 text-sm mt-0.5">{format(new Date(), 'EEEE, do MMMM yyyy')}</p>
                    <p className="text-white/70 text-xs mt-0.5">{thisWeekRotas.length} {thisWeekRotas.length === 1 ? 'Shift' : 'Shifts'} This Week · Week of {format(weekStart, 'dd MMM yyyy')}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">{selectedJob?.name || 'Job'}</h1>
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
                  {isAllJobs && (
                    <button onClick={() => onNavigate('jobs')} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/15 ring-1 ring-white/25 text-white rounded-lg hover:bg-white/25 transition text-sm font-medium backdrop-blur-sm w-full sm:w-auto">
                      <Plus className="w-4 h-4" /> Add Job
                    </button>
                  )}
                  <button onClick={() => onNavigate('rota')} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-[#2E5A1A] rounded-lg hover:bg-[#2E5A1A]/10 transition text-sm font-semibold shadow-sm w-full sm:w-auto">
                    <Calendar className="w-4 h-4" /> Build Rota
                  </button>
                  <button onClick={() => setCustomizeMode(true)} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/15 ring-1 ring-white/25 text-white rounded-lg hover:bg-white/25 transition text-sm font-medium backdrop-blur-sm w-full sm:w-auto">
                    <Settings2 className="w-4 h-4" /> Customise
                  </button>
                </>
              ) : (
                <button onClick={handleExitCustomize} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-[#2E5A1A] rounded-lg hover:bg-[#2E5A1A]/10 transition text-sm font-semibold shadow-sm w-full sm:w-auto">
                  <Check className="w-4 h-4" /> Done
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <JobSelectorBar />

      {/* At-a-glance intelligence — surfaces critical items needing attention */}
      {!customizeMode && isAllJobs && (
        <PulseRibbon onNavigate={onNavigate} />
      )}

      {/* Live Site Activity — visual snapshot grid of active sites (click to open quick drawer) */}
      {!customizeMode && isAllJobs && (
        <SiteSnapshotGrid onSelectJob={openJobDrawer} />
      )}

      {customizeMode && (
        <div className="mb-4 bg-[#2E5A1A]/10 border border-[#2E5A1A]/20 rounded-xl px-4 py-3 text-sm text-[#2E5A1A]">
          Drag sections to reorder them. Tap S, M or L to resize a section, or Hide to remove it from your dashboard.
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        {DASHBOARD_SECTIONS.map(section => {
          const sectionWidgets = visibleOrder.filter(id => WIDGET_TO_SECTION[id] === section.id);
          if (sectionWidgets.length === 0) return null;
          const Icon = section.icon;
          return (
            <section key={section.id} className="mb-7">
              <div className="flex items-center gap-2.5 mb-3 px-1">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{section.label}</h2>
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{sectionWidgets.length}</span>
              </div>
              <Droppable droppableId={section.id}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
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