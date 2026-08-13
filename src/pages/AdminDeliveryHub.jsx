import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, Search, LayoutGrid, List, Filter, Clock, PlayCircle, CheckCircle2, AlertTriangle, ArrowRightLeft, Package, Store, Boxes } from 'lucide-react';
import { format, isToday, isFuture, isPast } from 'date-fns';
import DeliveryBoard from '@/components/admin/DeliveryBoard';
import DeliveryTable from '@/components/admin/DeliveryTable';
import RouteOptimizeBar from '@/components/delivery/RouteOptimizeBar';
import BulkDeliveryReconciliation from '@/components/delivery/BulkDeliveryReconciliation';
import GoodsInPanel from '@/components/logistics/GoodsInPanel';
import ConsumableInventoryManager from '@/components/settings/ConsumableInventoryManager';
import DeliveryDetailDrawer from '@/components/logistics/DeliveryDetailDrawer';
import { Skeleton, EmptyState } from '@/components/StateViews';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';

const typeFilters = [
  { value: 'all', label: 'All Types', icon: Filter },
  { value: 'site_delivery', label: 'Deliveries', icon: Truck },
  { value: 'supplier_delivery', label: 'Goods In', icon: Store },
  { value: 'supplier_collection', label: 'Collections', icon: Package },
  { value: 'item_handover', label: 'Handovers', icon: ArrowRightLeft },
];

const dateFilters = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
];

export default function AdminDeliveryHub() {
  const [tab, setTab] = useState('board');
  const [view, setView] = useState('board');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['admin-all-deliveries'],
    queryFn: async () => {
      const list = await base44.entities.DeliveryLog.list('-scheduled_date', 500);
      return list;
    }
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['admin-delivery-jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['admin-delivery-staff'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });

  const drivers = useMemo(() => {
    const ids = new Set(deliveries.map(d => d.driver_staff_id).filter(Boolean));
    return staff.filter(s => ids.has(s.id));
  }, [deliveries, staff]);

  const filtered = useMemo(() => {
    let result = [...deliveries];
    if (typeFilter !== 'all') result = result.filter(d => d.delivery_type === typeFilter);
    if (driverFilter !== 'all') result = result.filter(d => d.driver_staff_id === driverFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        (d.items || '').toLowerCase().includes(q) ||
        (d.job_name || '').toLowerCase().includes(q) ||
        (d.delivery_address || '').toLowerCase().includes(q) ||
        (d.pickup_address || '').toLowerCase().includes(q) ||
        (d.driver_staff_name || '').toLowerCase().includes(q) ||
        (d.signed_by_name || '').toLowerCase().includes(q));
    }
    if (dateFilter === 'today') result = result.filter(d => isToday(new Date(d.scheduled_date + 'T00:00:00')));
    if (dateFilter === 'upcoming') result = result.filter(d => isFuture(new Date(d.scheduled_date + 'T00:00:00')) && d.status !== 'completed');
    if (dateFilter === 'overdue') result = result.filter(d => d.status === 'pending' && isPast(new Date(d.scheduled_date + 'T23:59:59')));
    if (dateFilter === 'completed') result = result.filter(d => d.status === 'completed');
    return result.sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));
  }, [deliveries, typeFilter, driverFilter, search, dateFilter]);

  const stats = useMemo(() => {
    const today = deliveries.filter(d => isToday(new Date(d.scheduled_date + 'T00:00:00')));
    return {
      total: deliveries.length,
      today: today.length,
      inTransit: deliveries.filter(d => d.status === 'in_progress').length,
      completed: deliveries.filter(d => d.status === 'completed').length,
      overdue: deliveries.filter(d => d.status === 'pending' && isPast(new Date(d.scheduled_date + 'T23:59:59'))).length,
      handovers: deliveries.filter(d => d.delivery_type === 'item_handover').length,
    };
  }, [deliveries]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Truck}
        title="Logistics Hub"
        subtitle="Delivery board, collections, route optimisation & driver handovers"
        stats={[
          { label: 'Today', value: stats.today, icon: Clock },
          { label: 'In Transit', value: stats.inTransit, icon: PlayCircle },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2 },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle },
        ]}
      />
      <TabBar
        tabs={[
          { id: 'board', label: 'Delivery Board', icon: LayoutGrid },
          { id: 'reconcile', label: 'Reconcile', icon: CheckCircle2 },
          { id: 'goods-in', label: 'Goods In', icon: Store },
          { id: 'stock', label: 'Stock', icon: Boxes },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {/* Reconciliation tab — bulk proof-of-delivery approval */}
      {tab === 'reconcile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
          <BulkDeliveryReconciliation />
        </div>
      )}

      {/* Goods In tab — gatekeeper verification of received stock */}
      {tab === 'goods-in' && <GoodsInPanel />}

      {/* Stock tab — consumable inventory catalog management */}
      {tab === 'stock' && <ConsumableInventoryManager />}

      {/* Board tab content */}
      {tab === 'board' && (
      <>
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by job, items, address, driver or signatory…"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setView('board')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'board' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
              <LayoutGrid className="w-4 h-4" /> Board
            </button>
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
              <List className="w-4 h-4" /> List
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {typeFilters.map(f => (
            <button key={f.value} onClick={() => setTypeFilter(f.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${typeFilter === f.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <f.icon className="w-3.5 h-3.5" />{f.label}
            </button>
          ))}
          <span className="w-px bg-slate-200 my-1" />
          {dateFilters.map(f => (
            <button key={f.value} onClick={() => setDateFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${dateFilter === f.value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          ))}
          {drivers.length > 0 && (
            <>
              <span className="w-px bg-slate-200 my-1" />
              <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border-0 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                <option value="all">All Drivers</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Route optimiser — shows when a specific driver is selected */}
      {driverFilter !== 'all' && (() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const driverTodays = deliveries.filter(d =>
          d.driver_staff_id === driverFilter &&
          d.scheduled_date === todayStr &&
          (d.status === 'pending' || d.status === 'in_progress')
        );
        if (driverTodays.length < 2) return null;
        return (
          <RouteOptimizeBar driverStaffId={driverFilter} date={todayStr} count={driverTodays.length} />
        );
      })()}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState icon={Truck} title="No deliveries found" message="Try adjusting your filters, or create delivery tasks from within a job." />
        </div>
      ) : view === 'board' ? (
        <DeliveryBoard deliveries={filtered} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
      ) : (
        <DeliveryTable deliveries={filtered} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
      )}
      </>
      )}

      {/* Detail drawer — integrated day planner + chain view */}
      {selected && (
        <DeliveryDetailDrawer delivery={selected} jobs={jobs} staff={staff} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}