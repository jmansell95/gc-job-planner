import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, Truck, Gauge, CalendarClock, Wrench, Link2, Satellite,
  ShieldCheck, ShieldAlert, ShieldX, Hash, Fuel, Palette, Car, User, Users,
  MapPin, Navigation, Clock, Activity, Zap,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { differenceInDays } from 'date-fns';
import VehicleLocationMiniMap from '@/components/vehicles/VehicleLocationMiniMap';
import GeotabTripHistory from '@/components/vehicles/GeotabTripHistory';
import MaintenanceTimeline from '@/components/vehicles/MaintenanceTimeline';

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
  compliant: { label: 'Compliant', Icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warning: { label: 'Attention', Icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Critical', Icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { label: 'No Data', Icon: ShieldX, cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const FUEL_LABELS = {
  diesel: 'Diesel', petrol: 'Petrol', hybrid: 'Hybrid', electric: 'Electric',
  lpg: 'LPG', cng: 'CNG', unknown: 'Unknown',
};

function InfoTile({ icon: Icon, label, value, mono, color }) {
  if (!value && value !== 0) return null;
  return (
    <div className={`rounded-lg p-2.5 ${color || 'bg-slate-50'}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] uppercase text-slate-400 font-semibold">{label}</span>
      </div>
      <p className={`text-sm font-bold text-slate-800 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

export default function VehicleDetailDrawer({ vehicle, onClose }) {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'compliance'

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
    enabled: !!vehicle,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!vehicle,
  });
  const { data: liveLocations = [] } = useQuery({
    queryKey: ['geotab-live-locations-fleet'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live', limit: 500 });
      const data = res?.data ?? res;
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.vehicles) ? data.vehicles : (Array.isArray(data?.locations) ? data.locations : []));
      return arr;
    },
    enabled: !!vehicle,
    refetchInterval: 30000,
  });

  const latestLoc = useMemo(() => {
    if (!vehicle) return null;
    const locs = Array.isArray(liveLocations) ? liveLocations : [];
    const forVehicle = locs.filter(l => l.vehicle_id === vehicle.id);
    if (forVehicle.length === 0) return null;
    return forVehicle.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b);
  }, [liveLocations, vehicle]);

  if (!vehicle) return null;

  const { issues, level } = getVehicleStatus(vehicle);
  const badge = LEVEL_BADGE[level];
  const StatusIcon = badge.Icon;
  const assignedStaff = staff.find(s => s.id === vehicle.assigned_staff_id);
  const team = teams.find(t => t.id === vehicle.team_id);
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—';
  const geotabLive = vehicle.geotab_sync_status === 'synced';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="hero-gradient text-white px-5 py-4 sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-mono font-bold text-lg truncate">{vehicle.registration_number || 'No Reg'}</p>
                <p className="text-sm text-white/80 truncate">{vehicle.name || makeModel}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
              <StatusIcon className="w-3.5 h-3.5" /> {badge.label}
            </span>
            {geotabLive && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                <Satellite className="w-3.5 h-3.5" /> Geotab Live
              </span>
            )}
            {vehicle.holman_sync_status === 'synced' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <Link2 className="w-3.5 h-3.5" /> Holman
              </span>
            )}
          </div>
        </div>

        {/* Attention banner */}
        {issues.length > 0 && (
          <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-rose-700">Action Required</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {issues.map((issue, i) => (
                  <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {issue.label} ({issue.days >= 0 ? `in ${issue.days}d` : `${Math.abs(issue.days)}d ago`})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="mx-5 mt-4 flex p-1 bg-slate-100 rounded-lg">
          <button onClick={() => setActiveTab('live')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition ${activeTab === 'live' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`}>
            <Satellite className="w-3.5 h-3.5" /> Live Ops
          </button>
          <button onClick={() => setActiveTab('compliance')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition ${activeTab === 'compliance' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
            <Wrench className="w-3.5 h-3.5" /> Compliance
          </button>
        </div>

        {/* === LIVE OPERATIONS TAB (Geotab) === */}
        {activeTab === 'live' && (
          <div className="px-5 py-4 space-y-4">
            {/* Live position */}
            {latestLoc ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-sm font-bold text-slate-800">Live Position</h3>
                  <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(latestLoc.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <VehicleLocationMiniMap {...latestLoc} />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <InfoTile icon={Gauge} label="Speed" value={`${Math.round((latestLoc.speed_kph || 0) * 0.621371)} mph`} color="bg-cyan-50" />
                  <InfoTile icon={Zap} label="Ignition" value={latestLoc.ignition_on ? 'ON' : 'OFF'} color={latestLoc.ignition_on ? 'bg-emerald-50' : 'bg-slate-50'} />
                </div>
                {vehicle.current_mileage != null && (
                  <div className="mt-2">
                    <InfoTile icon={Gauge} label="Odometer" value={`${Number(vehicle.current_mileage).toLocaleString()} mi`} color="bg-slate-50" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-xl">
                <Satellite className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">{geotabLive ? 'No live position data right now' : 'Not tracking via Geotab yet'}</p>
              </div>
            )}

            {/* Trip history — pulled directly from Geotab by reg number */}
            <GeotabTripHistory vehicle={vehicle} />
          </div>
        )}

        {/* === COMPLIANCE TAB (Holman) === */}
        {activeTab === 'compliance' && (
          <div className="px-5 py-4 space-y-4">
            {/* Vehicle specification */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Car className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Vehicle Specification</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InfoTile icon={Car} label="Make / Model" value={makeModel} color="bg-blue-50" />
                <InfoTile icon={CalendarClock} label="Year" value={vehicle.year || '—'} color="bg-slate-50" />
                <InfoTile icon={Fuel} label="Fuel" value={FUEL_LABELS[vehicle.fuel_type] || vehicle.fuel_type || '—'} color="bg-slate-50" />
                <InfoTile icon={Truck} label="Type" value={vehicle.vehicle_type || '—'} color="bg-slate-50" />
                <InfoTile icon={Palette} label="Colour" value={vehicle.color || '—'} color="bg-slate-50" />
                <InfoTile icon={Hash} label="VIN" value={vehicle.vin ? vehicle.vin.slice(-8) : '—'} mono color="bg-slate-50" />
                <InfoTile icon={User} label="Driver" value={assignedStaff?.name || 'Unassigned'} color="bg-slate-50" />
                <InfoTile icon={Users} label="Team" value={team?.name || '—'} color="bg-slate-50" />
              </div>
            </div>

            {/* Key dates */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Key Compliance Dates</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: 'MOT Due', date: vehicle.mot_expiry, icon: ShieldCheck },
                  { label: 'Service Due', date: vehicle.service_due_date, icon: Wrench },
                  { label: 'Last Service', date: vehicle.last_service_date, icon: Activity },
                ].filter(d => d.date).map(d => {
                  const date = new Date(d.date + 'T00:00:00');
                  const days = differenceInDays(date, new Date());
                  const tone = days < 0 ? 'rose' : days <= 30 ? 'amber' : 'emerald';
                  const colors = COLOR_MAP[tone] || COLOR_MAP.slate;
                  return (
                    <div key={d.label} className={`flex items-center gap-3 p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
                      <d.icon className={`w-4 h-4 ${colors.text}`} />
                      <div className="flex-1">
                        <p className="text-[10px] uppercase font-semibold text-slate-400">{d.label}</p>
                        <p className={`text-sm font-bold ${colors.text}`}>
                          {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-[11px] font-semibold ${colors.text}`}>
                        {days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`}
                      </span>
                    </div>
                  );
                })}
                {!vehicle.mot_expiry && !vehicle.service_due_date && !vehicle.last_service_date && (
                  <p className="text-xs text-slate-400 px-3 py-2">No compliance dates on record.</p>
                )}
              </div>
            </div>

            {/* Maintenance timeline */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Maintenance History</h3>
                <span className="ml-auto text-[10px] text-slate-400">Holman</span>
              </div>
              <MaintenanceTimeline vehicleId={vehicle.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
};