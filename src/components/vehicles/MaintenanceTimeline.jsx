import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Wrench, CalendarClock, Fuel, AlertTriangle, Check, Clock } from 'lucide-react';
import { differenceInDays } from 'date-fns';

/**
 * MaintenanceTimeline — visual timeline of Holman-sourced maintenance events
 * (MOT, service, breakdown, windscreen, fuel card) for a vehicle. Shows
 * past events as green checkmarks and future/overdue as amber/red markers.
 */
const EVENT_CONFIG = {
  mot: { label: 'MOT', icon: ShieldCheck, color: 'emerald' },
  service: { label: 'Service', icon: Wrench, color: 'blue' },
  breakdown: { label: 'Breakdown', icon: AlertTriangle, color: 'rose' },
  windscreen: { label: 'Windscreen', icon: AlertTriangle, color: 'amber' },
  fuel_card: { label: 'Fuel Card', icon: Fuel, color: 'violet' },
  inspection: { label: 'Inspection', icon: Check, color: 'cyan' },
};

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', dot: 'bg-blue-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', dot: 'bg-rose-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', dot: 'bg-amber-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', dot: 'bg-violet-500' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-300' },
};

function TimelineEvent({ event, isLast }) {
  const cfg = EVENT_CONFIG[event.booking_type] || { label: event.booking_type || 'Event', icon: Clock, color: 'slate' };
  const colors = COLOR_MAP[cfg.color];
  const Icon = cfg.icon;
  const date = event.booking_date ? new Date(event.booking_date + 'T00:00:00') : null;
  const days = date ? differenceInDays(date, new Date()) : null;
  const isPast = days != null && days < 0;
  const isOverdue = days != null && days < 0 && ['requested', 'booked'].includes(event.status);
  const isUpcoming = days != null && days >= 0 && ['requested', 'booked'].includes(event.status);

  const statusColor = isOverdue ? 'rose' : isUpcoming && days <= 30 ? 'amber' : cfg.color;
  const statusColors = COLOR_MAP[statusColor];

  return (
    <div className="flex gap-3 relative">
      {/* Timeline line */}
      {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-100" />}

      {/* Dot */}
      <div className={`w-8 h-8 rounded-full ${statusColors.bg} ${statusColors.border} border-2 flex items-center justify-center flex-shrink-0 z-10`}>
        <Icon className={`w-3.5 h-3.5 ${statusColors.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-800">{cfg.label}</p>
          {date && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors.bg} ${statusColors.text}`}>
              {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
          )}
        </div>
        {event.provider_name && <p className="text-[11px] text-slate-500 mt-0.5">{event.provider_name}</p>}
        {event.notes && <p className="text-[11px] text-slate-400 mt-1">{event.notes}</p>}
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isPast ? 'bg-slate-100 text-slate-500' : statusColors.bg + ' ' + statusColors.text}`}>
            {event.status ? event.status.charAt(0).toUpperCase() + event.status.slice(1) : '—'}
          </span>
          {days != null && isUpcoming && (
            <span className={`text-[10px] font-medium ${days <= 7 ? 'text-rose-600' : days <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
              in {days}d
            </span>
          )}
          {isOverdue && <span className="text-[10px] font-medium text-rose-600">{Math.abs(days)}d overdue</span>}
        </div>
      </div>
    </div>
  );
}

export default function MaintenanceTimeline({ vehicleId }) {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['vehicle-maintenance-bookings', vehicleId],
    queryFn: () => base44.entities.VehicleMaintenanceBooking.filter({ vehicle_id: vehicleId }, '-booking_date', 200),
    enabled: !!vehicleId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" /></div>;
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-6">
        <Wrench className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-xs text-slate-400">No maintenance history yet.</p>
      </div>
    );
  }

  // Sort: future first (upcoming), then past (most recent first)
  const sorted = [...bookings].sort((a, b) => {
    const da = a.booking_date || '';
    const db = b.booking_date || '';
    return db.localeCompare(da);
  });

  return (
    <div className="space-y-0">
      {sorted.map((event, i) => (
        <TimelineEvent key={event.id || i} event={event} isLast={i === sorted.length - 1} />
      ))}
    </div>
  );
}