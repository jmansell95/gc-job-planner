import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Wrench, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/StateViews';

const TYPE_LABELS = { mot: 'MOT', service: 'Service', windscreen: 'Windscreen', repair: 'Repair', inspection: 'Inspection', other: 'Maintenance' };
const STATUS_COLORS = {
  requested: 'bg-amber-50 text-amber-700',
  booked: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-violet-50 text-violet-700',
};

export default function MaintenanceQuickView({ onNavigate }) {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['maintenance-bookings-quick'],
    queryFn: () => base44.entities.VehicleMaintenanceBooking.list('-booking_date', 20)
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });

  const upcoming = bookings.filter(b => ['requested', 'booked', 'in_progress'].includes(b.status));
  const nextThree = upcoming.slice(0, 4);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-600" />
          <h2 className="font-semibold text-slate-900">Upcoming Maintenance</h2>
        </div>
        {upcoming.length > 0 && (
          <button onClick={() => onNavigate('settings')} className="text-xs text-emerald-700 font-medium hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="px-5 py-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
      ) : nextThree.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          <Wrench className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          No upcoming maintenance bookings
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {nextThree.map(b => {
            const vehicle = vehicles.find(v => v.id === b.vehicle_id);
            const typeLabel = TYPE_LABELS[b.booking_type] || 'Maintenance';
            return (
              <button key={b.id} onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: { section: 'settings', settingsTab: 'vehicles' } }))} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer text-left">
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
              </button>
            );
          })}
          {upcoming.length > 4 && (
            <div className="px-5 py-2 text-center">
              <button onClick={() => onNavigate('settings')} className="text-xs text-slate-500 hover:text-emerald-700 font-medium">
                +{upcoming.length - 4} more upcoming
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}