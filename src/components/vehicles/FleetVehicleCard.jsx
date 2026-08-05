import React, { useState } from 'react';
import {
  Truck, ShieldCheck, ShieldAlert, ShieldX, Wrench, Gauge,
  Satellite, Link2, Car, Hash, MapPin, Navigation, Zap, Clock, Palette,
  FileText, Loader2, BadgeCheck,
} from 'lucide-react';
import VehicleLocationMiniMap from '@/components/vehicles/VehicleLocationMiniMap';
import { generateVehicleReport } from '@/utils/vehiclePdfReport';
import { base44 } from '@/api/base44Client';
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

// Determine live motion status from the Geotab location data
function getMotionStatus(liveLocation, geotabLive) {
  if (!geotabLive) return { state: 'offline', label: 'Offline', color: 'slate', Icon: Satellite };
  if (!liveLocation) return { state: 'no_data', label: 'No Signal', color: 'slate', Icon: Satellite };
  const isMoving = liveLocation.ignition_on && (liveLocation.speed_kph || 0) > 0;
  if (isMoving) return { state: 'moving', label: 'Moving', color: 'emerald', Icon: Navigation };
  if (liveLocation.ignition_on) return { state: 'idle', label: 'Engine On', color: 'amber', Icon: Zap };
  return { state: 'stopped', label: 'Stopped', color: 'slate', Icon: Clock };
}

const MOTION_STYLES = {
  moving: { badge: 'bg-emerald-500 text-white', dot: 'bg-emerald-400', pulse: true },
  idle: { badge: 'bg-amber-500 text-white', dot: 'bg-amber-400', pulse: true },
  stopped: { badge: 'bg-slate-400 text-white', dot: 'bg-slate-300', pulse: false },
  no_data: { badge: 'bg-slate-200 text-slate-500', dot: 'bg-slate-300', pulse: false },
  offline: { badge: 'bg-slate-200 text-slate-500', dot: 'bg-slate-300', pulse: false },
};

const KM_TO_MI = 0.621371;

/**
 * FleetVehicleCard — a single modern vehicle card for the Fleet tab.
 * Shows live motion status (moving/stopped/idle), compliance, full spec
 * (make, model, year, colour, fuel, VIN), live GPS location, and next
 * maintenance booking — all linked to Geotab (live) and Holman (compliance).
 */
export default function FleetVehicleCard({ vehicle, liveLocation, nextBooking, driverName, onSelect, onBookMaintenance }) {
  const [reportLoading, setReportLoading] = useState(false);
  const { issues, level } = getVehicleStatus(vehicle);
  const badge = LEVEL_BADGE[level];
  const StatusIcon = badge.Icon;
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');

  // MOT pass/fail badge — prominent green/red indicator based on MOT expiry
  const motDays = vehicle.mot_expiry ? differenceInDays(new Date(vehicle.mot_expiry + 'T00:00:00'), new Date()) : null;
  const motBadge = motDays == null
    ? null
    : motDays < 0
      ? { label: 'MOT FAIL', cls: 'bg-red-500 text-white', Icon: ShieldX }
      : motDays <= 30
        ? { label: 'MOT DUE', cls: 'bg-amber-500 text-white', Icon: ShieldAlert }
        : { label: 'MOT PASS', cls: 'bg-emerald-500 text-white', Icon: BadgeCheck };
  const geotabLive = vehicle.geotab_sync_status === 'synced';
  const holmanSynced = vehicle.holman_sync_status === 'synced';
  const motion = getMotionStatus(liveLocation, geotabLive);
  const motionStyle = MOTION_STYLES[motion.state];
  const MotionIcon = motion.Icon;

  // Speed in mph
  const speedMph = liveLocation?.speed_kph ? Math.round(liveLocation.speed_kph * KM_TO_MI) : 0;
  const isMoving = motion.state === 'moving';

  // Last seen relative time
  const lastSeen = liveLocation?.timestamp
    ? new Date(liveLocation.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Download PDF report for this vehicle
  const handleDownloadReport = async (e) => {
    e.stopPropagation();
    setReportLoading(true);
    try {
      // Fetch trip history (last 7 days) + maintenance bookings in parallel
      const [tripRes, bookingRes] = await Promise.all([
        geotabLive
          ? base44.functions.invoke('getVehicleLocationHistory', {
              mode: 'geotab_history', vehicle_id: vehicle.id,
              from_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              limit: 100,
            })
          : Promise.resolve({ data: { trips: [] } }),
        base44.entities.VehicleMaintenanceBooking.filter({ vehicle_id: vehicle.id }, '-booking_date', 50),
      ]);
      const tripData = tripRes?.data || tripRes || {};
      generateVehicleReport(vehicle, tripData, bookingRes || []);
    } catch (_) {
      generateVehicleReport(vehicle, { trips: [] }, []);
    }
    setReportLoading(false);
  };

  return (
    <div
      onClick={() => onSelect(vehicle)}
      className={`insight-card rounded-xl overflow-hidden relative cursor-pointer ${LEVEL_ACCENT[level]} before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1`}
    >
      {/* ── Header: identity + live motion + status ── */}
      <div className="px-4 pt-4 pb-3 pl-5">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${geotabLive ? 'stat-gradient-cyan' : 'stat-gradient-slate'}`}>
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-mono font-bold text-slate-900 truncate text-sm">{vehicle.registration_number}</p>
              <p className="text-xs font-semibold text-slate-600 truncate">{makeModel || vehicle.name || '—'}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${badge.cls}`}>
              <StatusIcon className="w-3 h-3" /> {badge.label}
            </span>
            {motBadge && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${motBadge.cls}`}>
                <motBadge.Icon className="w-3 h-3" /> {motBadge.label}
                {motDays != null && motDays >= 0 && motDays <= 30 && <span className="opacity-80">({motDays}d)</span>}
              </span>
            )}
          </div>
        </div>

        {/* Live motion status badge — prominent moving/stopped indicator */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${motionStyle.badge}`}>
            <span className={`relative w-2 h-2 rounded-full ${motionStyle.dot}`}>
              {motionStyle.pulse && (
                <span className={`absolute inset-0 rounded-full ${motionStyle.dot} animate-ping opacity-75`} />
              )}
            </span>
            <MotionIcon className="w-3 h-3" /> {motion.label}
            {isMoving && speedMph > 0 && <span className="ml-0.5">{speedMph} mph</span>}
          </span>
          {lastSeen && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> {lastSeen}
            </span>
          )}
        </div>

        {/* Spec chips — make/model, year, colour, fuel, type, VIN, driver */}
        <div className="flex flex-wrap gap-1.5">
          {vehicle.year && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1">
              <Car className="w-2.5 h-2.5" /> {vehicle.year}
            </span>
          )}
          {vehicle.color && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1">
              <Palette className="w-2.5 h-2.5" /> {vehicle.color}
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

      {/* ── Footer: mileage + sync sources + actions ── */}
      <div className="px-4 py-3 pl-5 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onBookMaintenance(); }}
            className="flex items-center gap-1 text-[#2E5A1A] font-medium hover:underline"
          >
            <Wrench className="w-3 h-3" /> Book
          </button>
          <button
            onClick={handleDownloadReport}
            disabled={reportLoading}
            className="flex items-center gap-1 text-blue-600 font-medium hover:underline disabled:opacity-50"
          >
            {reportLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} PDF
          </button>
        </div>
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