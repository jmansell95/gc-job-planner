import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, Truck, Gauge, CalendarClock, Wrench, Link2, Link2Off, Satellite,
  ShieldCheck, ShieldAlert, ShieldX, Hash, Fuel, Palette, Car, User, Users,
  MapPin, Navigation, Clock, Activity,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { differenceInDays } from 'date-fns';
import VehicleLocationMiniMap from '@/components/vehicles/VehicleLocationMiniMap';

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

function InfoRow({ icon: Icon, label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-slate-50 transition">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <span className="text-xs text-slate-500 font-medium w-20 flex-shrink-0">{label}</span>
      <span className={`text-sm text-slate-800 font-semibold truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function DateRow({ icon: Icon, label, dateStr }) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const days = differenceInDays(date, new Date());
  const tone = days < 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-emerald-600';
  return (
    <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-slate-50 transition">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <span className="text-xs text-slate-500 font-medium w-20 flex-shrink-0">{label}</span>
      <span className={`text-sm font-semibold ${tone}`}>
        {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        <span className="text-[11px] font-normal ml-1.5">({days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`})</span>
      </span>
    </div>
  );
}

export default function VehicleDetailDrawer({ vehicle, onClose }) {
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
      return Array.isArray(data) ? data : (Array.isArray(data?.locations) ? data.locations : []);
    },
    enabled: !!vehicle,
    refetchInterval: 30000,
  });

  const latestLoc = useMemo(() => {
    if (!vehicle) return null;
    const forVehicle = liveLocations.filter(l => l.vehicle_id === vehicle.id);
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
            {vehicle.geotab_sync_status === 'synced' && (
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

        {/* Live location */}
        {latestLoc && (
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-4 h-4 text-[#2E5A1A]" />
              <h3 className="text-sm font-bold text-slate-800">Live Position</h3>
              <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(latestLoc.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <VehicleLocationMiniMap {...latestLoc} />
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Speed</p>
                <p className="text-sm font-bold text-slate-700 tabular-nums">{Math.round(latestLoc.speed_kph || 0)} <span className="text-[10px] font-normal">kph</span></p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Ignition</p>
                <p className={`text-sm font-bold ${latestLoc.ignition_on ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {latestLoc.ignition_on ? 'ON' : 'OFF'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Heading</p>
                <p className="text-sm font-bold text-slate-700 tabular-nums">{Math.round(latestLoc.heading || 0)}°</p>
              </div>
            </div>
          </div>
        )}

        {/* Vehicle specification */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <Car className="w-4 h-4 text-[#2E5A1A]" />
            <h3 className="text-sm font-bold text-slate-800">Vehicle Specification</h3>
          </div>
          <div className="space-y-0.5">
            <InfoRow icon={Car} label="Make / Model" value={makeModel} />
            <InfoRow icon={CalendarClock} label="Year" value={vehicle.year || '—'} />
            <InfoRow icon={Fuel} label="Fuel" value={FUEL_LABELS[vehicle.fuel_type] || vehicle.fuel_type || '—'} />
            <InfoRow icon={Truck} label="Type" value={vehicle.vehicle_type || '—'} />
            <InfoRow icon={Palette} label="Colour" value={vehicle.color || '—'} />
            <InfoRow icon={Hash} label="VIN" value={vehicle.vin || '—'} mono />
          </div>
        </div>

        {/* Compliance */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-[#2E5A1A]" />
            <h3 className="text-sm font-bold text-slate-800">Compliance & Maintenance</h3>
          </div>
          {issues.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {issues.map((issue, i) => (
                <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                  {issue.label} ({issue.days >= 0 ? `in ${issue.days}d` : `${Math.abs(issue.days)}d ago`})
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-600 font-medium mb-2 px-3">All compliance up to date</p>
          )}
          <div className="space-y-0.5">
            <DateRow icon={ShieldCheck} label="MOT Due" dateStr={vehicle.mot_expiry} />
            <DateRow icon={Wrench} label="Service" dateStr={vehicle.service_due_date} />
            <DateRow icon={Activity} label="Last Service" dateStr={vehicle.last_service_date} />
          </div>
        </div>

        {/* Assignment & capacity */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-[#2E5A1A]" />
            <h3 className="text-sm font-bold text-slate-800">Assignment & Capacity</h3>
          </div>
          <div className="space-y-0.5">
            <InfoRow icon={User} label="Driver" value={assignedStaff?.name || 'Unassigned'} />
            <InfoRow icon={Users} label="Team" value={team?.name || '—'} />
            {vehicle.max_weight_kg != null && (
              <InfoRow icon={Truck} label="Max Weight" value={`${Number(vehicle.max_weight_kg).toLocaleString()} kg`} />
            )}
            {vehicle.max_volume_m3 != null && (
              <InfoRow icon={Truck} label="Max Volume" value={`${Number(vehicle.max_volume_m3).toLocaleString()} m³`} />
            )}
          </div>
        </div>

        {/* Telematics */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Satellite className="w-4 h-4 text-[#2E5A1A]" />
            <h3 className="text-sm font-bold text-slate-800">Telematics & Mileage</h3>
          </div>
          <div className="space-y-0.5">
            {vehicle.current_mileage != null && (
              <InfoRow icon={Gauge} label="Mileage" value={`${Number(vehicle.current_mileage).toLocaleString()} mi`} />
            )}
            <InfoRow icon={Satellite} label="Geotab ID" value={vehicle.geotab_device_id || '—'} mono />
            <InfoRow icon={Hash} label="Device S/N" value={vehicle.geotab_device_serial || '—'} mono />
            {vehicle.last_geotab_sync && (
              <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-slate-50 transition">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-500 font-medium w-20 flex-shrink-0">Last Sync</span>
                <span className="text-sm text-slate-800 font-semibold">
                  {new Date(vehicle.last_geotab_sync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            {vehicle.holman_vehicle_id && (
              <InfoRow icon={Link2} label="Holman ID" value={vehicle.holman_vehicle_id} mono />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}