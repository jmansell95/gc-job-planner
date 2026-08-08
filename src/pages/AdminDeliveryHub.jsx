import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, Search, LayoutGrid, List, Filter, Clock, PlayCircle, CheckCircle2, AlertTriangle, ArrowRightLeft, Package, X, Link2, Navigation, Store, Boxes } from 'lucide-react';
import { format, isToday, isFuture, isPast } from 'date-fns';
import DeliveryBoard from '@/components/admin/DeliveryBoard';
import DeliveryTable from '@/components/admin/DeliveryTable';
import RouteOptimizeBar from '@/components/delivery/RouteOptimizeBar';
import DeliveryChainBuilder from '@/components/logistics/DeliveryChainBuilder';
import DriverDayPlanner from '@/components/logistics/DriverDayPlanner';
import BulkDeliveryReconciliation from '@/components/delivery/BulkDeliveryReconciliation';
import DeliveryRouteMap from '@/components/delivery/DeliveryRouteMap';
import GoodsInPanel from '@/components/logistics/GoodsInPanel';
import ConsumableInventoryManager from '@/components/settings/ConsumableInventoryManager';
import { Skeleton, EmptyState } from '@/components/StateViews';

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
  const [tab, setTab] = useState('planner');
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
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Logistics Hub</h1>
          <p className="text-sm text-slate-500 mt-0.5">Delivery board, collections, route optimisation & driver handovers</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"><Clock className="w-3.5 h-3.5 text-slate-400" /> {stats.today} Today</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"><PlayCircle className="w-3.5 h-3.5 text-slate-400" /> {stats.inTransit} In Transit</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"><CheckCircle2 className="w-3.5 h-3.5 text-slate-400" /> {stats.completed} Completed</span>
          {stats.overdue > 0 && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700"><AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> {stats.overdue} Overdue</span>}
        </div>
      </div>

      {/* Tab toggle: Day Planner vs Delivery Board vs Delivery Chains vs Reconciliation */}
      <div className="flex bg-slate-100 rounded-xl p-1 flex-wrap gap-1">
        <button onClick={() => setTab('planner')} className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'planner' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Navigation className="w-4 h-4" /> Day Planner
        </button>
        <button onClick={() => setTab('board')} className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'board' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <LayoutGrid className="w-4 h-4" /> Delivery Board
        </button>
        <button onClick={() => setTab('chains')} className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'chains' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Link2 className="w-4 h-4" /> Delivery Chains
        </button>
        <button onClick={() => setTab('reconcile')} className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'reconcile' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <CheckCircle2 className="w-4 h-4" /> Reconcile
        </button>
        <button onClick={() => setTab('goods-in')} className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'goods-in' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Store className="w-4 h-4" /> Goods In
        </button>
        <button onClick={() => setTab('stock')} className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'stock' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Boxes className="w-4 h-4" /> Stock
        </button>
      </div>

      {/* Day Planner tab — plan a driver's whole day */}
      {tab === 'planner' && <DriverDayPlanner />}

      {/* Chain builder tab */}
      {tab === 'chains' && <DeliveryChainBuilder />}

      {/* Reconciliation tab */}
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

      {/* Detail drawer — inline expand */}
      {selected && (
        <DeliveryDetailDrawer delivery={selected} jobs={jobs} staff={staff} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function DeliveryRouteMapLegs({ jobId }) {
  const { data: legs = [] } = useQuery({
    queryKey: ['delivery-legs-map', jobId],
    queryFn: () => base44.entities.DeliveryLeg.filter({ job_id: jobId }),
    enabled: !!jobId,
  });
  if (!legs.length) return null;
  return <DeliveryRouteMap legs={legs} />;
}

function DeliveryDetailDrawer({ delivery, jobs, staff, onClose }) {
  const job = jobs.find(j => j.id === delivery.job_id);
  const driver = staff.find(s => s.id === delivery.driver_staff_id);
  const handoverTo = staff.find(s => s.id === delivery.handover_to_staff_id);
  const dest = delivery.delivery_type === 'supplier_collection' ? delivery.pickup_address : delivery.delivery_address;

  const rows = [
    { label: 'Type', value: delivery.delivery_type?.replace(/_/g, ' ') },
    { label: 'Status', value: delivery.status },
    { label: 'Job', value: delivery.job_name || job?.name },
    { label: 'Driver', value: delivery.driver_staff_name || driver?.name },
    { label: 'Scheduled', value: delivery.scheduled_date && format(new Date(delivery.scheduled_date + 'T00:00:00'), 'EEE dd MMM yyyy') },
    { label: 'Destination', value: dest },
    { label: 'Pickup', value: delivery.pickup_address },
    { label: 'Items', value: delivery.items },
    { label: 'Contact', value: delivery.contact_name },
    { label: 'Phone', value: delivery.contact_phone },
    { label: 'PO Number', value: delivery.po_number },
    { label: 'Notes', value: delivery.notes },
    { label: 'Condition', value: delivery.condition_report },
    { label: 'Signed by', value: delivery.signed_by_name },
    { label: 'Completed at', value: delivery.completed_at && format(new Date(delivery.completed_at), 'dd MMM yyyy HH:mm') },
    { label: 'Handover to', value: delivery.handover_to_staff_name || handoverTo?.name },
    { label: 'Handover from', value: delivery.handover_from_staff_name },
    { label: 'GPS', value: delivery.gps_coordinates },
  ].filter(r => r.value);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-900">Delivery Details</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {delivery.signature_url && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Signature</p>
              <img src={delivery.signature_url} alt="Signature" className="max-h-24 rounded-lg border border-slate-200" />
            </div>
          )}
          {delivery.photo_urls && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Photos</p>
              <div className="flex gap-2 flex-wrap">
                {delivery.photo_urls.split(',').filter(Boolean).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Evidence ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {rows.map(r => (
            <div key={r.label} className="border-b border-slate-100 pb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{r.label}</p>
              <p className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap break-words">{String(r.value)}</p>
            </div>
          ))}
          {/* Route map showing GPS-tagged delivery legs for this job */}
          {delivery.job_id && (
            <div className="pt-3">
              <DeliveryRouteMapLegs jobId={delivery.job_id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}