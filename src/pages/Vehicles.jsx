import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Truck, ShieldCheck, ShieldAlert, ShieldX, Link2, Wrench, Search, ExternalLink, CalendarClock, PhoneCall } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import HolmanSyncBar from '@/components/vehicles/HolmanSyncBar';
import VehicleMaintenanceManager from '@/components/VehicleMaintenanceManager';
import UsefulNumbersModal from '@/components/UsefulNumbersModal';
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

const LEVEL_BORDER = {
  compliant: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  expired: 'border-l-red-500',
  unknown: 'border-l-slate-300',
};

export default function Vehicles() {
  const navigate = useNavigate();
  const [view, setView] = useState('fleet'); // 'fleet' | 'maintenance'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNumbers, setShowNumbers] = useState(false);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 500),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['vehicles-maintenance-bookings'],
    queryFn: () => base44.entities.VehicleMaintenanceBooking.list('-booking_date', 500),
  });

  // Next upcoming booking per vehicle — shows on each fleet card
  const nextBookingByVehicle = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map = {};
    bookings.forEach(b => {
      if (!['requested', 'booked', 'in_progress'].includes(b.status)) return;
      if (!b.vehicle_id) return;
      if (b.booking_date && b.booking_date < today) return; // past
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
    let compliant = 0, warning = 0, expired = 0, synced = 0;
    vehicles.forEach(v => {
      if (v.holman_sync_status === 'synced') synced++;
      const { level } = getVehicleStatus(v);
      if (level === 'expired') expired++;
      else if (level === 'warning') warning++;
      else if (level === 'compliant') compliant++;
    });
    return { total: vehicles.length, compliant, warning, expired, synced };
  }, [vehicles]);

  const q = search.toLowerCase().trim();
  const filtered = vehicles.filter(v => {
    if (statusFilter !== 'all') {
      const { level } = getVehicleStatus(v);
      if (statusFilter !== level) return false;
    }
    if (!q) return true;
    return (v.name || '').toLowerCase().includes(q) || (v.registration_number || '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Breadcrumbs />
      {/* Hero header */}
      <div className="hero-gradient text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate('/admin')} className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight truncate">Vehicles</h1>
                <p className="text-sm text-white/70">Fleet status, Holman sync & maintenance bookings</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
               <button onClick={() => setShowNumbers(true)}
                 className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-lg font-semibold text-sm transition">
                 <PhoneCall className="w-4 h-4" /> Useful Numbers
               </button>
               <button onClick={() => setView(view === 'fleet' ? 'maintenance' : 'fleet')}
                 className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-lg font-semibold text-sm transition">
                 {view === 'fleet' ? <><Wrench className="w-4 h-4" /> Maintenance</> : <><Truck className="w-4 h-4" /> Fleet Status</>}
               </button>
              <button onClick={() => navigate('/admin', { state: { section: 'settings', settingsTab: 'vehicles' } })}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-[#2E5A1A] rounded-lg font-semibold text-sm hover:bg-white/90 transition shadow-sm">
                <ExternalLink className="w-4 h-4" /> Manage Records
              </button>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Vehicles', value: stats.total, icon: Truck, grad: 'stat-gradient-brand' },
              { label: 'Compliant', value: stats.compliant, icon: ShieldCheck, grad: 'stat-gradient-emerald' },
              { label: 'Need Attention', value: stats.warning, icon: ShieldAlert, grad: 'stat-gradient-amber' },
              { label: 'Critical', value: stats.expired, icon: ShieldX, grad: 'stat-gradient-rose' },
              { label: 'Holman Synced', value: stats.synced, icon: Link2, grad: 'stat-gradient-blue' },
              { label: 'Active Bookings', value: activeBookingCount, icon: Wrench, grad: 'stat-gradient-amber' },
              ].map(s => {
              const SIcon = s.icon;
              return (
                <div key={s.label} className={`${s.grad} rounded-xl p-3.5 text-white shadow-lg ring-1 ring-white/20`}>
                  <SIcon className="w-5 h-5 text-white/90 mb-1.5" />
                  <p className="text-2xl font-bold tabular-nums drop-shadow-sm">{s.value}</p>
                  <p className="text-[11px] text-white/85 font-medium">{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {view === 'maintenance' ? (
          <VehicleMaintenanceManager />
        ) : (
          <>
            {/* Holman sync bar */}
            <div className="mb-4">
              <HolmanSyncBar />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-5 flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reg or description..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
              </div>
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                {[
                  { val: 'all', label: 'All' },
                  { val: 'compliant', label: 'Compliant' },
                  { val: 'warning', label: 'Attention' },
                  { val: 'expired', label: 'Critical' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setStatusFilter(opt.val)}
                    className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${statusFilter === opt.val ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Read-only grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
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
                  return (
                    <div key={v.id} className={`insight-card rounded-xl p-4 border-l-4 ${LEVEL_BORDER[level]} hover:scale-[1.01]`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-xl stat-gradient-brand flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Truck className="w-6 h-6 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-slate-900 truncate text-[15px]">{v.registration_number}</p>
                            <p className="text-xs text-slate-500 truncate">{v.name}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${LEVEL_BADGE[level]} flex-shrink-0`}>
                          {level === 'compliant' && <ShieldCheck className="w-3.5 h-3.5" />}
                          {level === 'warning' && <ShieldAlert className="w-3.5 h-3.5" />}
                          {level === 'expired' && <ShieldX className="w-3.5 h-3.5" />}
                          {level === 'unknown' && <ShieldX className="w-3.5 h-3.5" />}
                          {level === 'compliant' ? 'OK' : level === 'unknown' ? 'No Data' : level === 'expired' ? 'Critical' : 'Attention'}
                        </span>
                      </div>

                      {issues.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {issues.map((issue, i) => (
                            <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                              {issue.label}{issue.days >= 0 ? ` (${issue.days}d)` : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {v.mot_expiry && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">MOT: {new Date(v.mot_expiry + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
                          {v.service_due_date && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Service: {new Date(v.service_due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
                        </div>
                      )}

                      {(() => {
                        const nb = nextBookingByVehicle[v.id];
                        if (!nb) return null;
                        const typeLabel = nb.booking_type ? nb.booking_type.charAt(0).toUpperCase() + nb.booking_type.slice(1) : 'Booking';
                        const dateLabel = nb.booking_date ? new Date(nb.booking_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'TBC';
                        return (
                          <button onClick={() => setView('maintenance')}
                            className="w-full flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg bg-blue-50 border border-blue-100 text-left hover:bg-blue-100 transition">
                            <Wrench className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-[11px] font-semibold text-blue-700 truncate flex-1">{typeLabel} booked</span>
                            <span className="text-[11px] text-blue-600 font-medium flex-shrink-0">{dateLabel}</span>
                          </button>
                        );
                      })()}
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <button onClick={() => setView('maintenance')} className="flex items-center gap-1 text-blue-600 font-medium hover:underline">
                          <CalendarClock className="w-3 h-3" /> Book Maintenance
                        </button>
                        {v.holman_sync_status === 'synced' ? (
                          <span className="flex items-center gap-1 text-blue-600 font-medium"><Link2 className="w-3 h-3" /> Holman Synced</span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-300">Not synced</span>
                        )}
                      </div>
                      {v.current_mileage != null && (
                        <p className="text-[10px] text-slate-400 mt-1.5">{Number(v.current_mileage).toLocaleString()} mi</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
          )}
          </div>
          <UsefulNumbersModal open={showNumbers} onClose={() => setShowNumbers(false)}
          onLogBooking={() => { setView('maintenance'); }} />
          </div>
          );
          }