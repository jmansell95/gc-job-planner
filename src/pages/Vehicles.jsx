import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Truck, Wrench, Search, ExternalLink, PhoneCall, Sparkles,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import AdminNav from '@/components/AdminNav';
import FleetSyncBar from '@/components/vehicles/FleetSyncBar';
import FleetVehicleCard from '@/components/vehicles/FleetVehicleCard';
import VehicleMaintenanceManager from '@/components/VehicleMaintenanceManager';
import UsefulNumbersModal from '@/components/UsefulNumbersModal';
import VehicleDetailDrawer from '@/components/vehicles/VehicleDetailDrawer';
import GeotabReportModal from '@/components/vehicles/GeotabReportModal';
import FleetHealthRings from '@/components/vehicles/FleetHealthRings';
import { Skeleton } from '@/components/StateViews';
import { differenceInDays } from 'date-fns';

function getVehicleStatus(v) {
  const today = new Date();
  const issues = [];
  if (v.mot_expiry) {
    const d = differenceInDays(new Date(v.mot_expiry + 'T00:00:00'), today);
    if (d < 0) issues.push({ label: 'MOT Expired', severity: 'expired', days: d });
    else if (d <= 30) issues.push({ label: 'MOT Due', severity: 'warning', days: d });
  }
  if (v.service_due_date) {
    const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
    if (d < 0) issues.push({ label: 'Service Overdue', severity: 'expired', days: d });
    else if (d <= 30) issues.push({ label: 'Service Due', severity: 'warning', days: d });
  }
  const level = issues.find(i => i.severity === 'expired') ? 'expired'
    : issues.find(i => i.severity === 'warning') ? 'warning'
    : (v.mot_expiry || v.service_due_date ? 'compliant' : 'unknown');
  return { issues, level };
}

export default function Vehicles() {
  const navigate = useNavigate();
  const [view, setView] = useState('fleet'); // 'fleet' | 'maintenance'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showNumbers, setShowNumbers] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 500),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['vehicles-maintenance-bookings'],
    queryFn: () => base44.entities.VehicleMaintenanceBooking.list('-booking_date', 500),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
  });

  // Live GPS locations from Geotab
  const { data: liveData } = useQuery({
    queryKey: ['geotab-live-locations-fleet'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live', limit: 500 });
      return res?.data ?? res;
    },
    refetchInterval: 60000,
  });

  const liveLocations = liveData?.vehicles || [];

  const latestByVehicle = useMemo(() => {
    const map = {};
    liveLocations.forEach(loc => {
      if (!loc.vehicle_id) return;
      if (!map[loc.vehicle_id] || new Date(loc.timestamp) > new Date(map[loc.vehicle_id].timestamp)) {
        map[loc.vehicle_id] = loc;
      }
    });
    return map;
  }, [liveLocations]);

  const nextBookingByVehicle = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map = {};
    bookings.forEach(b => {
      if (!['requested', 'booked', 'in_progress'].includes(b.status)) return;
      if (!b.vehicle_id) return;
      if (b.booking_date && b.booking_date < today) return;
      if (!map[b.vehicle_id] || (b.booking_date || '9999') < (map[b.vehicle_id].booking_date || '9999')) {
        map[b.vehicle_id] = b;
      }
    });
    return map;
  }, [bookings]);

  const activeBookingCount = useMemo(
    () => bookings.filter(b => ['requested', 'booked', 'in_progress'].includes(b.status)).length,
    [bookings]
  );

  const stats = useMemo(() => {
    let compliant = 0, warning = 0, expired = 0, holmanSynced = 0, geotabSynced = 0;
    vehicles.forEach(v => {
      if (v.holman_sync_status === 'synced') holmanSynced++;
      if (v.geotab_sync_status === 'synced') geotabSynced++;
      const { level } = getVehicleStatus(v);
      if (level === 'expired') expired++;
      else if (level === 'warning') warning++;
      else if (level === 'compliant') compliant++;
    });
    return { total: vehicles.length, compliant, warning, expired, holmanSynced, geotabSynced, activeBookings: activeBookingCount };
  }, [vehicles, activeBookingCount]);

  const q = search.toLowerCase().trim();
  const staffByVehicle = useMemo(() => {
    const map = {};
    staff.forEach(s => { if (s.id) map[s.id] = s; });
    return map;
  }, [staff]);

  const filtered = vehicles.filter(v => {
    const hasGeotab = v.geotab_sync_status === 'synced' || !!v.geotab_device_id;
    const hasHolman = v.holman_sync_status === 'synced' || !!v.holman_vehicle_id;
    if (sourceFilter === 'geotab' && !hasGeotab) return false;
    if (sourceFilter === 'holman' && !hasHolman) return false;
    if (sourceFilter === 'both' && !(hasGeotab && hasHolman)) return false;
    if (statusFilter !== 'all') {
      const { level } = getVehicleStatus(v);
      if (statusFilter !== level) return false;
    }
    if (!q) return true;
    const driver = staffByVehicle[v.assigned_staff_id]?.name || '';
    return (
      (v.name || '').toLowerCase().includes(q) ||
      (v.registration_number || '').toLowerCase().includes(q) ||
      (v.vin || '').toLowerCase().includes(q) ||
      (v.make || '').toLowerCase().includes(q) ||
      (v.model || '').toLowerCase().includes(q) ||
      driver.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/20 to-slate-100/80">
      <AdminNav activeSection="vehicles" setActiveSection={(s) => { if (s === 'vehicles') return; navigate('/admin', { state: { section: s } }); }} />
      <main className="flex-1 overflow-auto pt-[calc(3.5rem+env(safe-area-inset-top)-25px)] lg:pt-0 lg:pb-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="px-4 pb-4 md:px-6 md:pb-6 lg:pt-6 w-full">
          <Breadcrumbs />

          {/* Action bar */}
          <div className="hero-gradient rounded-2xl text-white shadow-lg overflow-hidden mb-4">
            <div className="px-4 md:px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-white truncate flex items-center gap-2">
                    Fleet Command
                    <Sparkles className="w-4 h-4 text-white/60" />
                  </h1>
                  <p className="text-xs text-white/70 truncate">Live tracking · Maintenance · Trip history</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setShowNumbers(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 md:px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg font-semibold text-xs transition">
                  <PhoneCall className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Numbers</span>
                </button>
                <div className="flex p-1 bg-white/10 rounded-lg gap-0.5">
                  <button onClick={() => setView('fleet')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${view === 'fleet' ? 'bg-white text-[#2E5A1A]' : 'text-white/80 hover:bg-white/10'}`}>
                    <Truck className="w-3.5 h-3.5 inline mr-1" /> Fleet
                  </button>
                  <button onClick={() => setView('maintenance')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${view === 'maintenance' ? 'bg-white text-[#2E5A1A]' : 'text-white/80 hover:bg-white/10'}`}>
                    <Wrench className="w-3.5 h-3.5 inline mr-1" /> Maintenance
                  </button>
                </div>
                <button onClick={() => navigate('/admin', { state: { section: 'settings', settingsTab: 'vehicles' } })}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-white text-[#2E5A1A] rounded-lg font-semibold text-xs hover:bg-white/90 transition shadow-sm">
                  <ExternalLink className="w-3.5 h-3.5" /> Manage
                </button>
              </div>
            </div>
          </div>

          {view === 'maintenance' ? (
            <VehicleMaintenanceManager />
          ) : (
            <>
              {/* Fleet health rings */}
              <div className="mb-4">
                <FleetHealthRings stats={stats} />
              </div>

              {/* Unified sync bar — Geotab + Holman + Reports */}
              <div className="mb-4">
                <FleetSyncBar liveData={liveData} onShowReport={() => setShowReport(true)} />
              </div>

              {/* Search & filters */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-4 flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by reg, name, VIN, make/model or driver..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10" />
                </div>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  {[
                    { val: 'all', label: 'All' },
                    { val: 'compliant', label: 'OK' },
                    { val: 'warning', label: 'Attention' },
                    { val: 'expired', label: 'Critical' },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setStatusFilter(opt.val)}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${statusFilter === opt.val ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  {[
                    { val: 'all', label: 'All Sources' },
                    { val: 'geotab', label: 'Geotab' },
                    { val: 'holman', label: 'Holman' },
                    { val: 'both', label: 'Both' },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setSourceFilter(opt.val)}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${sourceFilter === opt.val ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-400 ml-1">{filtered.length} of {vehicles.length}</span>
              </div>

              {/* Fleet grid */}
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                  <Truck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">{vehicles.length === 0 ? 'No vehicles yet. Add them via Settings → Vehicles.' : 'No vehicles match your filters.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(v => (
                    <FleetVehicleCard
                      key={v.id}
                      vehicle={v}
                      liveLocation={latestByVehicle[v.id]}
                      nextBooking={nextBookingByVehicle[v.id]}
                      driverName={staffByVehicle[v.assigned_staff_id]?.name || ''}
                      onSelect={setSelectedVehicle}
                      onBookMaintenance={() => setView('maintenance')}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <UsefulNumbersModal open={showNumbers} onClose={() => setShowNumbers(false)}
            onLogBooking={() => { setView('maintenance'); }} />
        </div>
      </main>
      <VehicleDetailDrawer vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
      {showReport && <GeotabReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}