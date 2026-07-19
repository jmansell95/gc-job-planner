import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Truck, Briefcase, Grid3x3, ClipboardCheck, Plus, Calendar, Settings2, Check, Eye } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MaintenanceQuickView from '@/components/MaintenanceQuickView';
import JobCostAnalytics from '@/components/JobCostAnalytics';
import DeliveryStats from '@/components/DeliveryStats';
import WidgetCard from '@/components/dashboard/WidgetCard';
import { WIDGET_REGISTRY, DEFAULT_WIDGET_ORDER, DEFAULT_WIDGET_SIZES, DASHBOARD_TABS, WIDGET_TO_TAB, COST_WIDGETS } from '@/components/dashboard/registry';
import { KpiStatsWidget, FieldCrewsWidget, ChartsWidget } from '@/components/dashboard/DashboardWidgets';
import ComplianceOverviewWidget from '@/components/dashboard/ComplianceOverviewWidget';
import SupervisorOverviewWidget from '@/components/dashboard/SupervisorOverviewWidget';
import JobAssetsWidget from '@/components/dashboard/JobAssetsWidget';
import AiInsightsWidget from '@/components/dashboard/AiInsightsWidget';
import SiteHazardMapWidget from '@/components/dashboard/SiteHazardMapWidget';
import ProfitabilityDashboard from '@/components/ProfitabilityDashboard';
import AssetCrewProfitability from '@/components/AssetCrewProfitability';
import RigProfitabilityWidget from '@/components/dashboard/RigProfitabilityWidget';
import PillTabs from '@/components/PillTabs';
import { canViewCostings } from '@/utils/access';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import JobSelectorBar from '@/components/dashboard/JobSelectorBar';

export default function DashboardOverview({ onNavigate, onSelectJob }) {
  const [customizeMode, setCustomizeMode] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState(DEFAULT_WIDGET_ORDER);
  const [widgetSizes, setWidgetSizes] = useState({});
  const [layoutId, setLayoutId] = useState(null);
  const [activeTab, setActiveTab] = useState(DASHBOARD_TABS[0].id);
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
    { label: isAllJobs ? 'Active Jobs' : 'Job Status', value: isAllJobs ? activeJobs.length : (scopedJobs[0]?.status || '—').replace(/_/g, ' '), sub: isAllJobs ? (onHoldJobs.length ? `${onHoldJobs.length} on hold · ${planningJobs} planning` : `${planningJobs} planning · ${scopedJobs.length} total`) : (scopedJobs[0]?.location || ''), icon: Briefcase, gradient: 'stat-gradient-emerald', nav: 'jobs' },
    { label: 'Crews Deployed', value: staffToday, sub: `${activeStaff} active crew`, icon: Users, gradient: 'stat-gradient-blue', nav: 'rota' },
    { label: 'Timesheet Queue', value: pendingTs, sub: 'awaiting approval', icon: ClipboardCheck, gradient: pendingTs > 0 ? 'stat-gradient-amber' : 'stat-gradient-slate', nav: 'timesheets' },
    { label: 'Deliveries Today', value: pendingDeliveries, sub: `${scopedDeliveries.length} scheduled`, icon: Truck, gradient: pendingDeliveries > 0 ? 'stat-gradient-rose' : 'stat-gradient-slate', nav: 'deliveries' },
  ];

  const canViewCosts = canViewCostings(profile);

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case 'delivery-stats': return <DeliveryStats onNavigate={onNavigate} onSelectJob={onSelectJob} jobs={scopedJobs} />;
      case 'kpi-stats': return <KpiStatsWidget stats={stats} onNavigate={onNavigate} />;
      case 'compliance-overview': return <ComplianceOverviewWidget onNavigate={onNavigate} />;
      case 'supervisor-overview': return <SupervisorOverviewWidget profile={profile} />;
      case 'field-crews': return <FieldCrewsWidget todaysRotas={todaysRotas} staff={staff} jobs={scopedJobs} vehicles={vehicles} onSelectJob={onSelectJob} onNavigate={onNavigate} />;
      case 'charts': return <ChartsWidget jobs={scopedJobs} staff={staff} rotas={scopedRotas} weekDays={weekDays} />;
      case 'cost-analytics': return canViewCosts ? <JobCostAnalytics /> : null;
      case 'maintenance-quick-view': return <MaintenanceQuickView onNavigate={onNavigate} />;
      case 'job-assets': return <JobAssetsWidget onSelectJob={onSelectJob} />;
      case 'ai-insights': return <AiInsightsWidget />;
      case 'job-profitability': return canViewCosts ? <ProfitabilityDashboard /> : null;
      case 'asset-crew-profitability': return canViewCosts ? <AssetCrewProfitability /> : null;
      case 'rig-profitability': return canViewCosts ? <RigProfitabilityWidget /> : null;
      case 'site-hazards': return <SiteHazardMapWidget onNavigate={onNavigate} />;
      default: return null;
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const visible = widgetOrder.filter(id => WIDGET_TO_TAB[id] === activeTab);
    const newVisible = [...visible];
    const [moved] = newVisible.splice(result.source.index, 1);
    newVisible.splice(result.destination.index, 0, moved);
    // Rebuild full order, splicing the reordered visible widgets back into their original slots.
    const newOrder = [];
    let vi = 0;
    for (const id of widgetOrder) {
      if (WIDGET_TO_TAB[id] === activeTab) {
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
  const canShowWidget = (id) => canViewCosts || !COST_WIDGETS.includes(id);
  const visibleOrder = widgetOrder.filter(canShowWidget);
  const visibleHidden = hiddenWidgets.filter(canShowWidget);
  const visibleTabs = DASHBOARD_TABS.filter(t => t.widgets.some(w => visibleOrder.includes(w) || visibleHidden.includes(w)));

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  return (
    <div>
      {/* Hero header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6">
        <div className="command-gradient relative overflow-hidden rounded-2xl shadow-lg px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-3 bg-white/15 ring-1 ring-white/25 rounded-2xl flex-shrink-0 backdrop-blur-sm">
                <Grid3x3 className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
                  {greeting}{firstName ? `, ${firstName}` : ''}
                </h1>
                <p className="text-emerald-50 text-sm mt-0.5">{format(new Date(), 'EEEE, do MMMM yyyy')}</p>
                <p className="text-emerald-100/80 text-xs mt-0.5">{thisWeekRotas.length} {thisWeekRotas.length === 1 ? 'shift' : 'shifts'} this week · Week of {format(weekStart, 'dd MMM yyyy')}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {!customizeMode ? (
                <>
                  <button onClick={() => onNavigate('jobs')} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/15 ring-1 ring-white/25 text-white rounded-lg hover:bg-white/25 transition text-sm font-medium backdrop-blur-sm w-full sm:w-auto">
                    <Plus className="w-4 h-4" /> Add Job
                  </button>
                  <button onClick={() => onNavigate('rota')} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-emerald-800 rounded-lg hover:bg-emerald-50 transition text-sm font-semibold shadow-sm w-full sm:w-auto">
                    <Calendar className="w-4 h-4" /> Build Rota
                  </button>
                  <button onClick={() => setCustomizeMode(true)} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/15 ring-1 ring-white/25 text-white rounded-lg hover:bg-white/25 transition text-sm font-medium backdrop-blur-sm w-full sm:w-auto">
                    <Settings2 className="w-4 h-4" /> Customise
                  </button>
                </>
              ) : (
                <button onClick={handleExitCustomize} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-emerald-800 rounded-lg hover:bg-emerald-50 transition text-sm font-semibold shadow-sm w-full sm:w-auto">
                  <Check className="w-4 h-4" /> Done
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <JobSelectorBar />

      {customizeMode && (
        <div className="mb-4 bg-emerald-50/80 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
          Drag sections to reorder them within a tab. Tap S, M or L to resize a section, or Hide to remove it from your dashboard.
        </div>
      )}

      <PillTabs
        tabs={visibleTabs}
        activeId={activeTab}
        onChange={setActiveTab}
      />

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard-widgets">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
              {visibleOrder.filter(id => WIDGET_TO_TAB[id] === activeTab).map((widgetId, index) => (
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
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition text-sm font-medium">
                  <Eye className="w-4 h-4" /> {config.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}