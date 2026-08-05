import React from 'react';
import {
  Truck, ShieldCheck, ShieldAlert, ShieldX, Wrench, Gauge,
  Satellite, Link2, Car, Hash, MapPin, Navigation,
} from 'lucide-react';
import VehicleLocationMiniMap from '@/components/vehicles/VehicleLocationMiniMap';
import { differenceInDays } from 'date-fns';

const LEVEL_BADGE = {
  compliant: { label: 'OK', Icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warning: { label: 'Attention', Icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Critical', Icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { label: 'No Data', Icon: ShieldX, cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const LEVEL_ACCENT = {
  compliant: 'before:bg-emerald-500',
  warning: 'before:bg-amber-500',
  expired: 'before:bg-red-500',
  unknown: 'before:bg-slate-300',
};

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

/**
 * FleetVehicleCard — a single modern vehicle card for the Fleet tab.
 * Shows compliance status, spec, live GPS location, and maintenance booking
 * in one clean, self-contained card.
 */
export default function FleetVehicleCard({ vehicle, liveLocation, nextBooking, driverName, onSelect, onBookMaintenance }) {
  const { issues, level } = getVehicleStatus(vehicle);
  const badge = LEVEL_BADGE[level];
  const StatusIcon = badge.Icon;
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const geotabLive = vehicle.geotab_sync_status === 'synced';
  const holmanSynced = vehicle.holman_sync_status === 'synced';

  return (
    <div
      onClick={() => onSelect(vehicle)}
      className={`insight-card rounded-xl overflow-hidden relative cursor-pointer ${LEVEL_ACCENT[level]} before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1`}
    >
      {/* ── Header: identity + status ── */}
      <div className="px-4 pt-4 pb-3 pl-5">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${geotabLive ? 'stat-gradient-cyan' : 'stat-gradient-slate'}`}>
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-mono font-bold text-slate-900 truncate text-sm">{vehicle.registration_number}</p>
              <p className="text-xs text-slate-500 truncate">{makeModel || vehicle.name}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${badge.cls} flex-shrink-0`}>
            <StatusIcon className="w-3 h-3" /> {badge.label}
          </span>
        </div>

        {/* Spec chips — single clean row */}
        <div className="flex flex-wrap gap-1.5">
          {vehicle.year && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1">
              <Car className="w-2.5 h-2.5" /> {vehicle.year}
            </span>
          )}
          {vehicle.fuel_type && vehicle.fuel_type !== 'unknown' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {vehicle.fuel_type.charAt(0).toUpperCase() + vehicle.fuel_type.slice(1)}
            </span>
          )}
          {vehicle.vehicle_type && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{vehicle.vehicle_type}</span>
          )}
          {vehicle.vin && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono flex items-center gap-1">
              <Hash className="w-2.5 h-2.5" /> {vehicle.vin.slice(-6)}
            </span>
          )}
          {driverName && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{driverName}</span>
          )}
        </div>

        {/* Compliance alerts — only show if there are issues */}
        {issues.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {issues.map((issue, i) => (
              <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                {issue.label}{issue.days >= 0 ? ` (${issue.days}d)` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Live location snapshot ── */}
      <div className="px-4 pb-3 pl-5">
        <VehicleLocationMiniMap {...(liveLocation || {})} />
      </div>

      {/* ── Next maintenance booking banner ── */}
      {nextBooking && (
        <button
          onClick={(e) => { e.stopPropagation(); onBookMaintenance(); }}
          className="w-full flex items-center gap-2 px-4 py-2 bg-violet-50 border-y border-violet-100 text-left hover:bg-violet-100 transition"
        >
          <Wrench className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-violet-700 truncate flex-1">
            {nextBooking.booking_type ? nextBooking.booking_type.charAt(0).toUpperCase() + nextBooking.booking_type.slice(1) : 'Booking'} booked
          </span>
          <span className="text-[11px] text-violet-600 font-medium flex-shrink-0">
            {nextBooking.booking_date ? new Date(nextBooking.booking_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'TBC'}
          </span>
        </button>
      )}

      {/* ── Footer: mileage + sync sources + action ── */}
      <div className="px-4 py-3 pl-5 flex items-center justify-between gap-2 text-[11px]">
        <button
          onClick={(e) => { e.stopPropagation(); onBookMaintenance(); }}
          className="flex items-center gap-1 text-[#2E5A1A] font-medium hover:underline"
        >
          <Wrench className="w-3 h-3" /> Book Maintenance
        </button>
        <div className="flex items-center gap-2">
          {vehicle.current_mileage != null && (
            <span className="flex items-center gap-1 text-slate-400">
              <Gauge className="w-3 h-3" />{Number(vehicle.current_mileage).toLocaleString()} mi
            </span>
          )}
          {geotabLive && (
            <span className="flex items-center gap-1 text-cyan-600 font-medium">
              <Satellite className="w-3 h-3" /> Live
            </span>
          )}
          {holmanSynced && (
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <Link2 className="w-3 h-3" /> Holman
            </span>
          )}
        </div>
      </div>
    </div>
  );
}