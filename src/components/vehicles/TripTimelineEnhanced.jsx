import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Route, Loader2, Calendar, Clock, Gauge, MapPin, ChevronDown, ChevronRight,
  Navigation, Zap, TrendingDown, RefreshCw, AlertCircle, Circle, Flag,
  Square, Activity, Timer,
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import { batchReverseGeocode } from '@/utils/reverseGeocode';

const KM_TO_MI = 0.621371;
function kmToMi(km) { return (Number(km) || 0) * KM_TO_MI; }
function formatDuration(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Trip route map with start/end markers and stop points
function TripRouteMap({ breadcrumbs, trip }) {
  const validCrumbs = (breadcrumbs || []).filter(b => b?.lat != null && b?.lng != null);
  const startCoord = trip.start_lat != null ? [trip.start_lat, trip.start_lng] : null;
  const endCoord = trip.end_lat != null ? [trip.end_lat, trip.end_lng] : null;
  const fallback = validCrumbs.length > 0 ? [validCrumbs[0].lat, validCrumbs[0].lng] : startCoord || endCoord;
  if (!fallback) return null;

  const path = validCrumbs.map(b => [b.lat, b.lng]);
  const center = path.length > 0 ? path[Math.floor(path.length / 2)] : fallback;

  return (
    <div style={{ height: '160px' }} className="rounded-lg overflow-hidden border border-slate-200">
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {path.length >= 2 && (
          <Polyline positions={path} pathOptions={{ color: '#06b6d4', weight: 4, opacity: 0.8 }} />
        )}
        {startCoord && (
          <CircleMarker center={startCoord} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 1 }} radius={6}>
            <Popup>Start: {trip.start_location || 'Unknown'}</Popup>
          </CircleMarker>
        )}
        {endCoord && (
          <CircleMarker center={endCoord} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }} radius={6}>
            <Popup>End: {trip.end_location || 'Unknown'}</Popup>
          </CircleMarker>
        )}
        {(trip.stops || []).filter(s => s.lat != null).map((stop, i) => (
          <CircleMarker key={i} center={[stop.lat, stop.lng]} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8 }} radius={4}>
            <Popup>Stop {i + 1}: {stop.location || 'Unknown'} ({formatDuration(stop.duration_minutes)})</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

// Stop event card within a trip
function StopCard({ stop, index }) {
  return (
    <div className="flex items-start gap-2.5 pl-4 py-1.5 relative">
      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-amber-200" />
      <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-sm flex-shrink-0 mt-0.5 z-10" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Square className="w-3 h-3 text-amber-500" />
          <span className="text-xs font-bold text-amber-700">Stop {index + 1}</span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-[10px] font-semibold text-slate-500">{formatDuration(stop.duration_minutes)}</span>
        </div>
        <p className="text-xs text-slate-600 mt-0.5 truncate">{stop.location || 'Unknown location'}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {formatTime(stop.arrival_time)} → {formatTime(stop.departure_time)}
        </p>
      </div>
    </div>
  );
}

// Single trip card — colourful, organized, with expandable detail
function TripCard({ trip, breadcrumbs, isExpanded, onToggle }) {
  const tripCrumbs = isExpanded ? (() => {
    const start = new Date(trip.start_time).getTime();
    const end = new Date(trip.end_time).getTime();
    return breadcrumbs.filter(b => {
      const t = new Date(b.timestamp).getTime();
      return t >= start && t <= end;
    });
  })() : [];

  const distanceMi = kmToMi(trip.distance_km).toFixed(1);
  const isOvernight = new Date(trip.start_time).getHours() < 6;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition ${isExpanded ? 'border-cyan-300 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
      {/* Trip header — always visible */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-slate-50 transition text-left">
        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700">{formatDate(trip.start_time)}</span>
            <span className="text-[11px] text-slate-400">
              {formatTime(trip.start_time)} → {formatTime(trip.end_time)}
            </span>
            {isOvernight && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-bold">EARLY</span>
            )}
          </div>
          {/* Start → End location summary */}
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
            <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            <span className="truncate">{trip.start_location || 'Unknown'}</span>
            <Navigation className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />
            <span className="truncate">{trip.end_location || 'Unknown'}</span>
          </div>
        </div>
        {/* Quick stats */}
        <div className="flex items-center gap-2.5 text-[11px] flex-shrink-0">
          <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
            <TrendingDown className="w-3 h-3" />{distanceMi}mi
          </span>
          <span className="flex items-center gap-0.5 text-slate-500">
            <Clock className="w-3 h-3" />{formatDuration(trip.duration_minutes)}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 bg-gradient-to-b from-slate-50/50 to-white space-y-3">
          {/* Stats grid — colourful tiles */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-cyan-50 rounded-lg p-2 border border-cyan-100 text-center">
              <Gauge className="w-3 h-3 text-cyan-500 mx-auto mb-0.5" />
              <p className="text-[9px] uppercase text-cyan-500 font-semibold">Max</p>
              <p className="text-sm font-bold text-cyan-700 tabular-nums">{Math.round(kmToMi(trip.max_speed_kph))}</p>
            </div>
            <div className="bg-violet-50 rounded-lg p-2 border border-violet-100 text-center">
              <Activity className="w-3 h-3 text-violet-500 mx-auto mb-0.5" />
              <p className="text-[9px] uppercase text-violet-500 font-semibold">Avg</p>
              <p className="text-sm font-bold text-violet-700 tabular-nums">{Math.round(kmToMi(trip.average_speed_kph || 0))}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 text-center">
              <Timer className="w-3 h-3 text-amber-500 mx-auto mb-0.5" />
              <p className="text-[9px] uppercase text-amber-500 font-semibold">Idle</p>
              <p className="text-sm font-bold text-amber-700 tabular-nums">{formatDuration(trip.idle_minutes)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 text-center">
              <Gauge className="w-3 h-3 text-slate-400 mx-auto mb-0.5" />
              <p className="text-[9px] uppercase text-slate-400 font-semibold">Odo</p>
              <p className="text-sm font-bold text-slate-600 tabular-nums">{Math.round(kmToMi(trip.odometer_km || 0)).toLocaleString()}</p>
            </div>
          </div>

          {/* Route map */}
          {tripCrumbs.length > 0 && <TripRouteMap breadcrumbs={tripCrumbs} trip={trip} />}

          {/* Timeline: Start → Stops → End */}
          <div className="space-y-0">
            {/* Start point */}
            <div className="flex items-start gap-2.5 py-1.5 relative">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-sm flex-shrink-0 mt-0.5 z-10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Circle className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700">Start</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 truncate">{trip.start_location || 'Unknown location'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(trip.start_time)}</p>
              </div>
            </div>

            {/* Stops */}
            {(trip.stops || []).map((stop, i) => (
              <StopCard key={i} stop={stop} index={i} />
            ))}

            {/* End point */}
            <div className="flex items-start gap-2.5 py-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-400 border-2 border-white shadow-sm flex-shrink-0 mt-0.5 z-10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Flag className="w-3 h-3 text-rose-500" />
                  <span className="text-xs font-bold text-rose-700">End</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 truncate">{trip.end_location || 'Unknown location'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(trip.end_time)}</p>
              </div>
            </div>
          </div>

          {/* Coordinates */}
          {trip.start_lat != null && (
            <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                Start: {trip.start_lat?.toFixed(4)}, {trip.start_lng?.toFixed(4)}
              </span>
              {trip.end_lat != null && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 text-rose-400" />
                  End: {trip.end_lat?.toFixed(4)}, {trip.end_lng?.toFixed(4)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Group trips by day and compute per-day stats
function groupTripsByDay(trips) {
  const groups = {};
  for (const t of trips) {
    const dayKey = new Date(t.start_time).toISOString().slice(0, 10);
    if (!groups[dayKey]) groups[dayKey] = [];
    groups[dayKey].push(t);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayTrips]) => {
      const distance = dayTrips.reduce((s, t) => s + (t.distance_km || 0), 0);
      const duration = dayTrips.reduce((s, t) => s + (t.duration_minutes || 0), 0);
      const idle = dayTrips.reduce((s, t) => s + (t.idle_minutes || 0), 0);
      const stops = dayTrips.reduce((s, t) => s + (t.stop_count || 0), 0);
      const maxSpeed = dayTrips.reduce((m, t) => Math.max(m, t.max_speed_kph || 0), 0);
      return { date, trips: dayTrips, distance, duration, idle, stops, maxSpeed, tripCount: dayTrips.length };
    });
}

// Day group header with daily stats
function DayGroup({ dayGroup, breadcrumbs, geocodedTrips, expanded, setExpanded, globalIndex }) {
  const [dayOpen, setDayOpen] = useState(false);
  const dateObj = new Date(dayGroup.date + 'T00:00:00');
  const isToday = dayGroup.date === new Date().toISOString().slice(0, 10);
  const dayLabel = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Day header */}
      <button
        onClick={() => setDayOpen(!dayOpen)}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 transition text-left"
      >
        {dayOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-sm font-bold text-slate-800">{dayLabel}</span>
            {isToday && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-bold">TODAY</span>}
          </div>
        </div>
        {/* Daily stats */}
        <div className="flex items-center gap-2.5 text-[11px] flex-shrink-0">
          <span className="flex items-center gap-0.5 text-slate-500 font-semibold" title="Trips">
            <Route className="w-3 h-3" />{dayGroup.tripCount}
          </span>
          <span className="flex items-center gap-0.5 text-emerald-600 font-bold" title="Distance">
            <TrendingDown className="w-3 h-3" />{kmToMi(dayGroup.distance).toFixed(1)}mi
          </span>
          <span className="flex items-center gap-0.5 text-slate-500 font-semibold" title="Drive time">
            <Clock className="w-3 h-3" />{formatDuration(dayGroup.duration)}
          </span>
          <span className="flex items-center gap-0.5 text-amber-600 font-semibold" title="Idle time">
            <Timer className="w-3 h-3" />{formatDuration(dayGroup.idle)}
          </span>
          <span className="flex items-center gap-0.5 text-violet-600 font-semibold" title="Stops">
            <MapPin className="w-3 h-3" />{dayGroup.stops}
          </span>
        </div>
      </button>

      {/* Trips under this day */}
      {dayOpen && (
        <div className="p-2 space-y-2 bg-white">
          {dayGroup.trips.map((trip, i) => {
            const geo = geocodedTrips[trip.trip_id];
            const mergedTrip = geo
              ? { ...trip, start_location: geo.start_location, end_location: geo.end_location, stops: geo.stops }
              : trip;
            const tripIdx = globalIndex + i;
            return (
              <TripCard
                key={trip.trip_id}
                trip={mergedTrip}
                breadcrumbs={breadcrumbs}
                isExpanded={expanded === tripIdx}
                onToggle={() => setExpanded(expanded === tripIdx ? null : tripIdx)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TripTimelineEnhanced({ vehicle }) {
  const [expanded, setExpanded] = useState(null);
  const [days, setDays] = useState(7);
  const [geocodedTrips, setGeocodedTrips] = useState({});

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['geotab-trip-history-enhanced', vehicle?.id, days],
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

  // Frontend geocoding — the backend function's external geocoding calls can
  // fail in the edge runtime. We always geocode trip coordinates here in the
  // browser where BigDataCloud is reliably accessible. The cache prevents
  // redundant API calls for coordinates already resolved.
  const trips = data?.trips || [];
  useEffect(() => {
    if (trips.length === 0) return;
    let cancelled = false;
    (async () => {
      const coords = [];
      for (const t of trips) {
        if (t.start_lat != null) coords.push({ lat: t.start_lat, lng: t.start_lng });
        if (t.end_lat != null) coords.push({ lat: t.end_lat, lng: t.end_lng });
        for (const s of (t.stops || [])) {
          if (s.lat != null) coords.push({ lat: s.lat, lng: s.lng });
        }
      }
      if (coords.length === 0) return;
      const labels = await batchReverseGeocode(coords);
      if (cancelled) return;
      const updated = {};
      for (const t of trips) {
        const sKey = t.start_lat != null ? `${Number(t.start_lat).toFixed(4)},${Number(t.start_lng).toFixed(4)}` : null;
        const eKey = t.end_lat != null ? `${Number(t.end_lat).toFixed(4)},${Number(t.end_lng).toFixed(4)}` : null;
        const startLoc = sKey && labels[sKey] ? labels[sKey] : t.start_location;
        const endLoc = eKey && labels[eKey] ? labels[eKey] : t.end_location;
        const stopLocs = (t.stops || []).map(s => {
          const stKey = s.lat != null ? `${Number(s.lat).toFixed(4)},${Number(s.lng).toFixed(4)}` : null;
          return stKey && labels[stKey] ? { ...s, location: labels[stKey] } : s;
        });
        updated[t.trip_id] = { start_location: startLoc, end_location: endLoc, stops: stopLocs };
      }
      if (!cancelled) setGeocodedTrips(updated);
    })();
    return () => { cancelled = true; };
  }, [trips]);

  if (!vehicle?.geotab_device_id) {
    return (
      <div className="text-center py-4 bg-slate-50 rounded-xl">
        <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
        <p className="text-xs text-slate-400">No Geotab device linked to this vehicle.</p>
      </div>
    );
  }

  const breadcrumbs = data?.breadcrumbs || [];
  const totalDistance = data?.total_distance_km || 0;
  const totalIdle = trips.reduce((sum, t) => sum + (t.idle_minutes || 0), 0);
  const totalStops = trips.reduce((sum, t) => sum + (t.stop_count || 0), 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-800">Trip Timeline</h3>
          <span className="text-[10px] text-slate-400">Geotab · {vehicle.registration_number}</span>
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
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
          <span className="ml-2 text-xs text-slate-500">Fetching trips & locations from Geotab...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-600">
          {error.message || 'Failed to fetch trip history'}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-6 bg-slate-50 rounded-xl">
          <Route className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400">No trips recorded in the last {days} day{days > 1 ? 's' : ''}.</p>
        </div>
      ) : (
        <>
          {/* Summary tiles — colourful */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-2.5 border border-cyan-200">
              <p className="text-[10px] uppercase text-cyan-600 font-semibold flex items-center gap-1"><Route className="w-3 h-3" /> Trips</p>
              <p className="text-lg font-bold text-cyan-700 tabular-nums mt-0.5">{trips.length}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-2.5 border border-emerald-200">
              <p className="text-[10px] uppercase text-emerald-600 font-semibold flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Miles</p>
              <p className="text-lg font-bold text-emerald-700 tabular-nums mt-0.5">{kmToMi(totalDistance).toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-2.5 border border-amber-200">
              <p className="text-[10px] uppercase text-amber-600 font-semibold flex items-center gap-1"><Timer className="w-3 h-3" /> Idle</p>
              <p className="text-lg font-bold text-amber-700 tabular-nums mt-0.5">{formatDuration(totalIdle)}</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-lg p-2.5 border border-violet-200">
              <p className="text-[10px] uppercase text-violet-600 font-semibold flex items-center gap-1"><MapPin className="w-3 h-3" /> Stops</p>
              <p className="text-lg font-bold text-violet-700 tabular-nums mt-0.5">{totalStops}</p>
            </div>
          </div>

          {/* Trip list — grouped by day */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {(() => {
              const dayGroups = groupTripsByDay(trips);
              let runningIndex = 0;
              return dayGroups.map((dg) => {
                const idx = runningIndex;
                runningIndex += dg.trips.length;
                return (
                  <DayGroup
                    key={dg.date}
                    dayGroup={dg}
                    breadcrumbs={breadcrumbs}
                    geocodedTrips={geocodedTrips}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    globalIndex={idx}
                  />
                );
              });
            })()}
          </div>
        </>
      )}
    </div>
  );
}