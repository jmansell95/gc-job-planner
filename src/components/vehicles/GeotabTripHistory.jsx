import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Route, Loader2, Calendar, Clock, Gauge, MapPin, ChevronDown, ChevronRight,
  Navigation, Zap, TrendingDown, RefreshCw, AlertCircle,
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';

function formatDuration(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const KM_TO_MI = 0.621371;
function kmToMi(km) { return (Number(km) || 0) * KM_TO_MI; }

function TripRouteMiniMap({ breadcrumbs, start, end }) {
  // Filter to only valid coordinates (Geotab can return null lat/lng for some trips)
  const validCrumbs = (breadcrumbs || []).filter(b => b?.lat != null && b?.lng != null);
  const startCoord = start?.lat != null && start?.lng != null ? [start.lat, start.lng] : null;
  const endCoord = end?.lat != null && end?.lng != null ? [end.lat, end.lng] : null;

  // Need at least one valid point to render a map
  const fallback = validCrumbs.length > 0
    ? [validCrumbs[0].lat, validCrumbs[0].lng]
    : startCoord || endCoord;
  if (!fallback) return null;

  const path = validCrumbs.map(b => [b.lat, b.lng]);
  const center = path.length > 0
    ? path[Math.floor(path.length / 2)]
    : fallback;

  return (
    <div style={{ height: '120px' }} className="rounded-lg overflow-hidden border border-slate-200">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} doubleClickZoom={false} dragging={false} touchZoom={false} zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {path.length >= 2 && <Polyline positions={path} pathOptions={{ color: '#06b6d4', weight: 3, opacity: 0.7 }} />}
        {startCoord && <CircleMarker center={startCoord} pathOptions={{ color: '#10b981' }} radius={5}><Popup>Start</Popup></CircleMarker>}
        {endCoord && <CircleMarker center={endCoord} pathOptions={{ color: '#ef4444' }} radius={5}><Popup>End</Popup></CircleMarker>}
      </MapContainer>
    </div>
  );
}

export default function GeotabTripHistory({ vehicle }) {
  const [expanded, setExpanded] = useState(null);
  const [days, setDays] = useState(7);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['geotab-trip-history', vehicle?.id, days],
    queryFn: async () => {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const res = await base44.functions.invoke('getVehicleLocationHistory', {
        mode: 'geotab_history',
        vehicle_id: vehicle.id,
        from_date: fromDate,
        limit: 200,
      });
      return res?.data || res;
    },
    enabled: !!vehicle?.id && !!vehicle?.geotab_device_id,
  });

  if (!vehicle?.geotab_device_id) {
    return (
      <div className="text-center py-4 bg-slate-50 rounded-xl">
        <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
        <p className="text-xs text-slate-400">No Geotab device linked to this vehicle.</p>
      </div>
    );
  }

  const trips = data?.trips || [];
  const totalDistance = data?.total_distance_km || 0;
  const totalDuration = trips.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
  const breadcrumbs = data?.breadcrumbs || [];

  return (
    <div className="space-y-3">
      {/* Header with date range selector */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-800">Trip History (Geotab)</h3>
          <span className="text-[10px] text-slate-400">by reg {vehicle.registration_number}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-cyan-400">
            <option value={1}>24h</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <button onClick={() => refetch()} disabled={isFetching}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition">
            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
          <span className="ml-2 text-xs text-slate-500">Fetching trips from Geotab...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-600">
          {error.message || 'Failed to fetch trip history'}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-4 bg-slate-50 rounded-xl">
          <Route className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400">No trips recorded in the last {days} day{days > 1 ? 's' : ''}.</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-cyan-50 rounded-lg p-2.5 border border-cyan-100">
              <p className="text-[10px] uppercase text-cyan-500 font-semibold flex items-center gap-1"><Route className="w-3 h-3" /> Trips</p>
              <p className="text-lg font-bold text-cyan-700 tabular-nums mt-0.5">{trips.length}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
              <p className="text-[10px] uppercase text-emerald-500 font-semibold flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Distance</p>
              <p className="text-lg font-bold text-emerald-700 tabular-nums mt-0.5">{kmToMi(totalDistance).toFixed(1)} <span className="text-[10px] font-normal">mi</span></p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
              <p className="text-[10px] uppercase text-slate-400 font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Drive Time</p>
              <p className="text-lg font-bold text-slate-700 tabular-nums mt-0.5">{formatDuration(totalDuration)}</p>
            </div>
          </div>

          {/* Trip list */}
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {trips.map((trip, i) => {
              const isExpanded = expanded === i;
              const tripBreadcrumbs = isExpanded ? (() => {
                const start = new Date(trip.start_time).getTime();
                const end = new Date(trip.end_time).getTime();
                return breadcrumbs.filter(b => {
                  const t = new Date(b.timestamp).getTime();
                  return t >= start && t <= end;
                });
              })() : [];
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <button onClick={() => setExpanded(isExpanded ? null : i)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition text-left">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          {new Date(trip.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(trip.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {' → '}
                          {new Date(trip.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
                      <span className="flex items-center gap-0.5 text-emerald-600 font-semibold"><TrendingDown className="w-3 h-3" />{kmToMi(trip.distance_km).toFixed(1)}mi</span>
                      <span className="flex items-center gap-0.5 text-slate-500"><Clock className="w-3 h-3" />{formatDuration(trip.duration_minutes)}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 space-y-2 bg-slate-50/50">
                      <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                        {trip.max_speed_kph > 0 && (
                          <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> Max: {Math.round(trip.max_speed_kph * KM_TO_MI)} mph</span>
                        )}
                        {trip.average_speed_kph != null && trip.average_speed_kph > 0 && (
                          <span className="flex items-center gap-1"><Navigation className="w-3 h-3" /> Avg: {Math.round(trip.average_speed_kph * KM_TO_MI)} mph</span>
                        )}
                        {trip.idle_minutes > 0 && <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Idle: {trip.idle_minutes}m</span>}
                        {trip.odometer_km != null && (
                          <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> Odo: {Math.round(kmToMi(trip.odometer_km)).toLocaleString()} mi</span>
                        )}
                      </div>
                      <TripRouteMiniMap breadcrumbs={tripBreadcrumbs} start={trip} end={trip} />
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-500" /> Start: {trip.start_lat?.toFixed(4)}, {trip.start_lng?.toFixed(4)}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-rose-500" /> End: {trip.end_lat?.toFixed(4)}, {trip.end_lng?.toFixed(4)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}