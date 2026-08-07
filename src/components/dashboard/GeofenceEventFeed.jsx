import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Radar, LogIn, LogOut, MapPin, Truck, Building2, Briefcase, Loader2 } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

export default function GeofenceEventFeed({ onSelectJob }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['geofence-events-recent'],
    queryFn: () => base44.entities.GeofenceEvent.list('-created_date', 30),
    refetchInterval: 30000, // refresh every 30s for near-real-time updates
  });

  const arrivals = (events || []).filter((e) => e.event_type === 'arrival').length;
  const departures = (events || []).filter((e) => e.event_type === 'departure').length;
  const autoCheckins = (events || []).filter((e) => e.auto_arrival_triggered).length;

  return (
    <WidgetShell icon={Radar} title="Geofence Activity" subtitle="Live vehicle arrivals & departures">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
          <LogIn className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-emerald-700 tabular-nums">{arrivals}</p>
          <p className="text-[10px] uppercase text-slate-500 font-semibold">Arrivals</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
          <LogOut className="w-4 h-4 text-amber-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-amber-700 tabular-nums">{departures}</p>
          <p className="text-[10px] uppercase text-slate-500 font-semibold">Departures</p>
        </div>
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2.5 text-center">
          <MapPin className="w-4 h-4 text-cyan-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-cyan-700 tabular-nums">{autoCheckins}</p>
          <p className="text-[10px] uppercase text-slate-500 font-semibold">Auto Check-ins</p>
        </div>
      </div>

      {/* Event list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
        </div>
      ) : (events || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Radar className="w-8 h-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">No geofence events yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Events appear here when vehicles arrive at or leave job sites, supplier yards and client collection points. Make sure Geotab sync is active and locations have coordinates set.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {(events || []).slice(0, 20).map((e) => {
            const isArrival = e.event_type === 'arrival';
            const isJob = e.target_type === 'job';
            const isClient = e.target_type === 'client';
            const time = e.timestamp ? new Date(e.timestamp).toLocaleString('en-GB', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            }) : '';
            const TargetIcon = isJob ? Building2 : isClient ? Briefcase : MapPin;
            return (
              <div
                key={e.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition cursor-pointer hover:shadow-sm ${
                  isArrival
                    ? 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200'
                    : 'bg-amber-50/50 border-amber-100 hover:border-amber-200'
                }`}
                onClick={() => isJob && onSelectJob && onSelectJob(e.target_id)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isArrival ? 'bg-emerald-100' : 'bg-amber-100'
                }`}>
                  {isArrival
                    ? <LogIn className="w-4 h-4 text-emerald-600" />
                    : <LogOut className="w-4 h-4 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {e.vehicle_name || e.registration_number || 'Vehicle'}
                    </p>
                    {e.auto_arrival_triggered && (
                      <span className="text-[9px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                        AUTO CHECK-IN
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TargetIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <p className="text-xs text-slate-500 truncate">
                      {isArrival ? 'Arrived at' : 'Left'} {e.target_name || 'site'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400 tabular-nums">{time}</p>
                  <p className="text-[10px] text-slate-400">{Math.round(e.distance_meters || 0)}m away</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}