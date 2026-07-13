import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Wrench, ArrowRight, AlertTriangle, CalendarClock, ShieldX, ShieldAlert } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { complianceDaysUntil } from '@/utils/complianceDate';
import { Skeleton } from '@/components/StateViews';

const TYPE_LABELS = { mot: 'MOT', service: 'Service', windscreen: 'Windscreen', repair: 'Repair', inspection: 'Inspection', other: 'Maintenance' };
const STATUS_COLORS = {
  requested: 'bg-amber-50 text-amber-700',
  booked: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-violet-50 text-violet-700',
};

const goToVehicles = () => {
  window.dispatchEvent(new CustomEvent('app-navigate', { detail: { section: 'settings', settingsTab: 'vehicles' } }));
};

export default function MaintenanceQuickView({ onNavigate }) {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['maintenance-bookings-quick'],
    queryFn: () => base44.entities.VehicleMaintenanceBooking.list('-booking_date', 20)
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: complianceItems = [] } = useQuery({
    queryKey: ['vehicle-compliance-quick'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'vehicle' })
  });

  // Compute MOT/service alerts from vehicle dates
  const today = new Date();
  const allIssues = vehicles.flatMap(v => {
    const issues = [];
    if (v.mot_expiry) {
      const days = differenceInDays(new Date(v.mot_expiry + 'T00:00:00'), today);
      if (days < 0) issues.push({ severity: 'expired' });
      else if (days <= 30) issues.push({ severity: 'warning' });
    }
    if (v.service_due_date) {
      const days = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
      if (days < 0) issues.push({ severity: 'expired' });
      else if (days <= 30) issues.push({ severity: 'warning' });
    }
    return issues;
  });
  const expiredCount = allIssues.filter(i => i.severity === 'expired').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;

  // Per-vehicle due items (MOT, service) — expired or due within 30 days
  const dueItems = vehicles.flatMap(v => {
    const items = [];
    if (v.mot_expiry) {
      const days = differenceInDays(new Date(v.mot_expiry + 'T00:00:00'), today);
      if (days <= 30) items.push({ label: 'MOT', date: v.mot_expiry, days, severity: days < 0 ? 'expired' : 'warning', vehicleReg: v.registration_number, vehicleName: v.name });
    }
    if (v.service_due_date) {
      const days = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
      if (days <= 30) items.push({ label: 'Service', date: v.service_due_date, days, severity: days < 0 ? 'expired' : 'warning', vehicleReg: v.registration_number, vehicleName: v.name });
    }
    return items;
  }).sort((a, b) => a.days - b.days);

  // Vehicle compliance items (MOT, insurance, etc. from compliance manager)
  const todayStr = format(today, 'yyyy-MM-dd');
  const vehicleComplianceItems = complianceItems.filter(c => c.status_override !== 'not_required' && c.expiry_date);
  const complianceExpired = vehicleComplianceItems.filter(c => c.expiry_date < todayStr).length;
  const complianceExpiring = vehicleComplianceItems.filter(c => {
    const days = complianceDaysUntil(c.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  const upcoming = bookings.filter(b => ['requested', 'booked', 'in_progress'].includes(b.status));
  const nextFour = upcoming.slice(0, 4);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Fleet Compliance</h2>
            <p className="text-xs text-slate-400">Vehicle maintenance &amp; bookings</p>
          </div>
        </div>
        <button onClick={goToVehicles} className="text-xs text-emerald-700 font-medium hover:underline flex items-center gap-1 whitespace-nowrap flex-shrink-0">
          View all <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {(expiredCount > 0 || warningCount > 0 || complianceExpired > 0 || complianceExpiring > 0) && (
        <div className="px-5 py-2.5 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2 flex-wrap">
          {expiredCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
              <AlertTriangle className="w-3 h-3" /> {expiredCount} MOT/service expired
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
              <CalendarClock className="w-3 h-3" /> {warningCount} due soon
            </span>
          )}
          {complianceExpired > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
              <ShieldX className="w-3 h-3" /> {complianceExpired} compliance expired
            </span>
          )}
          {complianceExpiring > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
              <ShieldAlert className="w-3 h-3" /> {complianceExpiring} compliance expiring
            </span>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={goToVehicles} className="text-xs text-slate-500 hover:text-emerald-700 font-medium">
              Review →
            </button>
          </div>
        </div>
      )}

      {/* Due soon — per-vehicle MOT/service breakdown */}
      {dueItems.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Due Soon</p>
          <div className="space-y-2">
            {dueItems.slice(0, 6).map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${item.severity === 'expired' ? 'bg-red-50' : 'bg-amber-50'}`}>
                  {item.severity === 'expired' ? <ShieldX className="w-3.5 h-3.5 text-red-600" /> : <CalendarClock className="w-3.5 h-3.5 text-amber-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-400 truncate">{item.vehicleReg} · {item.vehicleName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-bold ${item.severity === 'expired' ? 'text-red-600' : 'text-amber-600'}`}>
                    {item.severity === 'expired' ? 'Expired' : format(new Date(item.date + 'T00:00:00'), 'dd MMM')}
                  </p>
                  {item.severity !== 'expired' && <p className="text-[10px] text-slate-400">{item.days}d left</p>}
                  {item.severity === 'expired' && <p className="text-[10px] text-red-400">{Math.abs(item.days)}d ago</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="px-5 py-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
      ) : nextFour.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          <Wrench className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          No maintenance booked yet
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4">
          {nextFour.map(b => {
            const vehicle = vehicles.find(v => v.id === b.vehicle_id);
            const typeLabel = TYPE_LABELS[b.booking_type] || 'Maintenance';
            return (
              <button key={b.id} onClick={goToVehicles} className="w-full px-4 py-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-slate-50 transition cursor-pointer text-left group flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{typeLabel}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[b.status] || 'bg-slate-50 text-slate-600'}`}>{b.status?.replace('_', ' ')}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{vehicle ? `${vehicle.registration_number} · ${vehicle.name}` : b.vehicle_name || 'Vehicle'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {b.booking_date && <p className="text-xs font-medium text-slate-700">{format(new Date(b.booking_date + 'T00:00:00'), 'dd MMM')}</p>}
                  {b.booking_time && <p className="text-[10px] text-slate-400">{b.booking_time}</p>}
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0" />
              </button>
            );
          })}
          {upcoming.length > 4 && (
            <div className="text-center pt-1">
              <button onClick={goToVehicles} className="text-xs text-slate-500 hover:text-emerald-700 font-medium">
                +{upcoming.length - 4} more upcoming
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}