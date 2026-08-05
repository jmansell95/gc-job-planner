import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Truck, ShieldCheck, ShieldAlert, ShieldX, Link2, Wrench, Search,
  ExternalLink, PhoneCall, Gauge, MapPin, Satellite, Car, Hash,
  Navigation, Clock, Sparkles, Route,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import AdminNav from '@/components/AdminNav';
import HolmanSyncBar from '@/components/vehicles/HolmanSyncBar';
import VehicleMaintenanceManager from '@/components/VehicleMaintenanceManager';
import UsefulNumbersModal from '@/components/UsefulNumbersModal';
import GeotabLiveMap from '@/components/vehicles/GeotabLiveMap';
import VehicleLocationMiniMap from '@/components/vehicles/VehicleLocationMiniMap';
import VehicleDetailDrawer from '@/components/vehicles/VehicleDetailDrawer';
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

const LEVEL_BADGE = {
  compliant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  unknown: 'bg-slate-50 text-slate-500 border-slate-200',
};

const LEVEL_ACCENT = {
  compliant: 'before:bg-emerald-500',
  warning: 'before:bg-amber-500',
  expired: 'before:bg-red-500',
  unknown: 'before:bg-slate-300',
};

export default function Vehicles() {
  const navigate = useNavigate();
  const [view, setView] = useState('fleet'); // 'fleet' | 'maintenance' | 'livemap'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNumbers, setShowNumbers] = useState(false);
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
  const { data: liveLocations = [] } = useQuery({
    queryKey: ['geotab-live-locations-fleet'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live', limit: 500 });
      const data = res?.data ?? res;
      return Array.isArray(data) ? data : (Array.isArray(data?.locations) ? data.locations : []);
    },
    refetchInterval: 60000,
  });

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

  // Fuzzy search across reg, name, VIN, driver name, make/model
  const q = search.toLowerCase().trim();
  const staffByVehicle = useMemo(() => {
    const map = {};
    staff.forEach(s => { if (s.id) map[s.id] = s; });
    return map;
  }, [staff]);

  const filtered = vehicles.filter(v => {
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
                  <button onClick={() => setView('livemap')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${view === 'livemap' ? 'bg-white text-[#2E5A1A]' : 'text-white/80 hover:bg-white/10'}`}>
                    <MapPin className="w-3.5 h-3.5 inline mr-1" /> Live Map
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
          ) : view === 'livemap' ? (
            <GeotabLiveMap />
          ) : (
            <>
              {/* Fleet health rings */}
              <div className="mb-4">
                <FleetHealthRings stats={stats} />
              </div>

              {/* Sync bar */}
              <div className="mb-4">
                <HolmanSyncBar />
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
                    { val: 'all', label: 'All', icon: null },
                    { val: 'compliant', label: 'OK', icon: ShieldCheck, color: 'text-emerald-600' },
                    { val: 'warning', label: 'Attention', icon: ShieldAlert, color: 'text-amber-600' },
                    { val: 'expired', label: 'Critical', icon: ShieldX, color: 'text-rose-600' },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setStatusFilter(opt.val)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold transition ${statusFilter === opt.val ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                      {opt.icon && <opt.icon className={`w-3.5 h-3.5 ${statusFilter === opt.val ? 'text-[#2E5A1A]' : opt.color}`} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-400 ml-1">{filtered.length} of {vehicles.length}</span>
              </div>

              {/* Fleet grid */}
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                  <Truck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">{vehicles.length === 0 ? 'No vehicles yet. Add them via Settings → Vehicles.' : 'No vehicles match your filters.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(v => {
                    const { issues, level } = getVehicleStatus(v);
                    const nb = nextBookingByVehicle[v.id];
                    const loc = latestByVehicle[v.id];
                    const makeModel = [v.make, v.model].filter(Boolean).join(' ');
                    const driver = staffByVehicle[v.assigned_staff_id]?.name || '';
                    const geotabLive = v.geotab_sync_status === 'synced';

                    return (
                      <div key={v.id}
                        onClick={() => setSelectedVehicle(v)}
                        className={`insight-card rounded-xl overflow-hidden relative cursor-pointer ${LEVEL_ACCENT[level]} before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1`}>
                        {/* Card header */}
                        <div className="px-4 pt-4 pb-3 pl-5">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${geotabLive ? 'stat-gradient-cyan' : 'stat-gradient-slate'}`}>
                                <Truck className="w-5 h-5 text-white" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-mono font-bold text-slate-900 truncate">{v.registration_number}</p>
                                <p className="text-xs text-slate-500 truncate">{makeModel || v.name}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${LEVEL_BADGE[level]} flex-shrink-0`}>
                              {level === 'compliant' && <ShieldCheck className="w-3 h-3" />}
                              {level === 'warning' && <ShieldAlert className="w-3 h-3" />}
                              {level === 'expired' && <ShieldX className="w-3 h-3" />}
                              {level === 'compliant' ? 'OK' : level === 'unknown' ? 'No Data' : level === 'expired' ? 'Critical' : 'Attention'}
                            </span>
                          </div>

                          {/* Spec chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {v.year && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1"><Car className="w-2.5 h-2.5" /> {v.year}</span>}
                            {v.fuel_type && v.fuel_type !== 'unknown' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{v.fuel_type.charAt(0).toUpperCase() + v.fuel_type.slice(1)}</span>}
                            {v.vehicle_type && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{v.vehicle_type}</span>}
                            {v.vin && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono flex items-center gap-1"><Hash className="w-2.5 h-2.5" /> {v.vin.slice(-6)}</span>}
                            {driver && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{driver}</span>}
                          </div>

                          {/* Issue badges or status chips */}
                          {issues.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {issues.map((issue, i) => (
                                <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {issue.label}{issue.days >= 0 ? ` (${issue.days}d)` : ''}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {v.mot_expiry && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">MOT: {new Date(v.mot_expiry + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
                              {v.service_due_date && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Service: {new Date(v.service_due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
                            </div>
                          )}
                        </div>

                        {/* Live location snapshot */}
                        <div className="px-4 pb-3 pl-5">
                          <VehicleLocationMiniMap {...(loc || {})} />
                        </div>

                        {/* Next booking banner */}
                        {nb && (
                          <button onClick={(e) => { e.stopPropagation(); setView('maintenance'); }}
                            className="w-full flex items-center gap-2 px-4 py-2 bg-violet-50 border-y border-violet-100 text-left hover:bg-violet-100 transition">
                            <Wrench className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                            <span className="text-[11px] font-semibold text-violet-700 truncate flex-1">{nb.booking_type ? nb.booking_type.charAt(0).toUpperCase() + nb.booking_type.slice(1) : 'Booking'} booked</span>
                            <span className="text-[11px] text-violet-600 font-medium flex-shrink-0">{nb.booking_date ? new Date(nb.booking_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'TBC'}</span>
                          </button>
                        )}

                        {/* Footer */}
                        <div className="px-4 py-3 pl-5 flex items-center justify-between gap-2 text-[11px]">
                          <button onClick={(e) => { e.stopPropagation(); setView('maintenance'); }} className="flex items-center gap-1 text-[#2E5A1A] font-medium hover:underline">
                            <Wrench className="w-3 h-3" /> Book Maintenance
                          </button>
                          <div className="flex items-center gap-2">
                            {geotabLive && (
                              <span className="flex items-center gap-1 text-cyan-600 font-medium"><Satellite className="w-3 h-3" /> Live</span>
                            )}
                            {v.holman_sync_status === 'synced' && (
                              <span className="flex items-center gap-1 text-blue-600 font-medium"><Link2 className="w-3 h-3" /> Holman</span>
                            )}
                            {!geotabLive && v.holman_sync_status !== 'synced' && (
                              <span className="flex items-center gap-1 text-slate-300">Not synced</span>
                            )}
                          </div>
                        </div>

                        {/* Mileage strip */}
                        {v.current_mileage != null && (
                          <div className="px-4 pb-3 pl-5 flex items-center gap-1.5 text-[10px] text-slate-400">
                            <Gauge className="w-3 h-3" />
                            <span>{Number(v.current_mileage).toLocaleString()} mi</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <UsefulNumbersModal open={showNumbers} onClose={() => setShowNumbers(false)}
            onLogBooking={() => { setView('maintenance'); }} />
        </div>
      </main>
      <VehicleDetailDrawer vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
    </div>
  );
}