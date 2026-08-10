import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldAlert, ShieldCheck, Loader2, Calendar, Clock, User, Gauge,
  MapPin, Filter, ChevronDown, ChevronRight, AlertTriangle, Zap,
  TrendingDown, CornerUpRight, Activity, AlertCircle, FileDown,
} from 'lucide-react';
import { reverseGeocode } from '@/utils/reverseGeocode';

const VIOLATION_META = {
  harsh_braking: { label: 'Harsh Braking', Icon: AlertCircle, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  speeding: { label: 'Speeding', Icon: Gauge, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  harsh_accel: { label: 'Harsh Acceleration', Icon: Zap, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  harsh_cornering: { label: 'Harsh Cornering', Icon: CornerUpRight, bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  seatbelt: { label: 'Seatbelt', Icon: AlertTriangle, bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  idling: { label: 'Excessive Idling', Icon: Activity, bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  other: { label: 'Safety Event', Icon: ShieldAlert, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

const DATE_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
];

function formatDuration(seconds) {
  if (!seconds) return null;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function SafetyEventsDrillDown({ vehicle }) {
  const [days, setDays] = useState(30);
  const [filterType, setFilterType] = useState('all');
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [addresses, setAddresses] = useState({});
  const [exporting, setExporting] = useState(false);

  const fromDate = useMemo(() => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(), [days]);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['vehicle-safety-events', vehicle?.id, days],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleSafetyEvents', {
        vehicle_id: vehicle.id,
        from_date: fromDate,
        limit: 2000,
      });
      return res?.data || res;
    },
    enabled: !!vehicle?.id && !!vehicle?.geotab_device_id,
  });

  const events = data?.events || [];
  const summary = data?.summary || {};

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter(e => e.violation_type === filterType);
  }, [events, filterType]);

  // Group events by date for the timeline view
  const groupedByDate = useMemo(() => {
    const groups = {};
    for (const e of filteredEvents) {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    }
    return Object.entries(groups).sort((a, b) => {
      const da = new Date(a[1][0]?.datetime || 0).getTime();
      const db = new Date(b[1][0]?.datetime || 0).getTime();
      return db - da;
    });
  }, [filteredEvents]);

  // Geocode event locations (batch, only for first 20 events)
  useEffect(() => {
    if (filteredEvents.length === 0) return;
    const needsGeocoding = filteredEvents.filter(e => e.latitude && e.longitude && addresses[e.id] === undefined).slice(0, 20);
    if (needsGeocoding.length === 0) return;
    let cancelled = false;
    (async () => {
      const newAddrs = {};
      for (const e of needsGeocoding) {
        if (cancelled) return;
        try {
          const addr = await reverseGeocode(e.latitude, e.longitude);
          newAddrs[e.id] = addr;
        } catch (_) {
          newAddrs[e.id] = null;
        }
      }
      if (!cancelled) setAddresses(prev => ({ ...prev, ...newAddrs }));
    })();
    return () => { cancelled = true; };
  }, [filteredEvents, addresses]);

  const handleExportCSV = () => {
    if (filteredEvents.length === 0) return;
    setExporting(true);
    const headers = ['Date', 'Time', 'Violation Type', 'Rule', 'Driver', 'Speed (km/h)', 'Speed Limit (km/h)', 'Duration', 'Location', 'Severity'];
    const rows = filteredEvents.map(e => [
      e.date, e.time, e.violation_label, e.rule_name, e.driver_name || '',
      e.speed_kph || '', e.speed_limit_kph || '',
      formatDuration(e.duration_seconds) || '',
      addresses[e.id] || (e.latitude ? `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : ''),
      e.severity,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safety-events-${vehicle.registration_number || vehicle.id}-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  if (!vehicle?.geotab_device_id) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-xl">
        <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No Geotab device linked</p>
        <p className="text-xs text-slate-400 mt-1">Sync this vehicle from Geotab to see safety events.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Header: date range + filter controls ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <ShieldAlert className="w-4 h-4 text-slate-600 flex-shrink-0" />
          <h3 className="text-sm font-bold text-slate-800">Safety Violation Log</h3>
        </div>
        <div className="flex p-0.5 bg-slate-100 rounded-lg gap-0.5 flex-wrap">
          {DATE_PRESETS.map(preset => (
            <button key={preset.days} onClick={() => setDays(preset.days)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition ${days === preset.days ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary stat tiles ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
          {error.message || 'Failed to load safety events'}
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-4 gap-2">
            <div className={`rounded-lg p-2.5 border ${summary.total > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className="text-[10px] uppercase font-semibold text-slate-500">Total Events</p>
              <p className={`text-lg font-bold tabular-nums ${summary.total > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{summary.total}</p>
            </div>
            <div className="rounded-lg p-2.5 border border-amber-200 bg-amber-50">
              <p className="text-[10px] uppercase font-semibold text-amber-500">Speeding</p>
              <p className="text-lg font-bold tabular-nums text-amber-700">{summary.speeding || 0}</p>
            </div>
            <div className="rounded-lg p-2.5 border border-red-200 bg-red-50">
              <p className="text-[10px] uppercase font-semibold text-red-500">Harsh Braking</p>
              <p className="text-lg font-bold tabular-nums text-red-700">{summary.harsh_braking || 0}</p>
            </div>
            <div className="rounded-lg p-2.5 border border-slate-200 bg-slate-50">
              <p className="text-[10px] uppercase font-semibold text-slate-500">Drivers</p>
              <p className="text-lg font-bold tabular-nums text-slate-700">{summary.unique_drivers || 0}</p>
            </div>
          </div>

          {/* Filter pills + export */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase">
              <Filter className="w-3 h-3" /> Filter:
            </div>
            {[
              { key: 'all', label: 'All', count: summary.total },
              { key: 'speeding', label: 'Speeding', count: summary.speeding },
              { key: 'harsh_braking', label: 'Braking', count: summary.harsh_braking },
              { key: 'harsh_accel', label: 'Accel', count: summary.harsh_accel },
              { key: 'harsh_cornering', label: 'Cornering', count: summary.harsh_cornering },
              { key: 'other', label: 'Other', count: (summary.seatbelt || 0) + (summary.idling || 0) + (summary.other || 0) },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterType(f.key)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold transition ${filterType === f.key ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {f.label} <span className="opacity-70">({f.count || 0})</span>
              </button>
            ))}
            <button onClick={handleExportCSV} disabled={exporting || filteredEvents.length === 0}
              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition">
              {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />} CSV
            </button>
          </div>

          {/* ── Events timeline ── */}
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 bg-emerald-50 rounded-xl border border-emerald-200">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-700">No violations in this period</p>
              <p className="text-xs text-emerald-600 mt-1">This driver has a clean record for the last {days} days.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {groupedByDate.map(([date, dayEvents]) => (
                <div key={date}>
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-white py-1 z-10">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                      <Calendar className="w-3 h-3 text-slate-500" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">{date}</p>
                    <span className="text-[10px] text-slate-400 font-semibold">{dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  {/* Event cards */}
                  <div className="space-y-1.5 ml-4 border-l-2 border-slate-100 pl-3">
                    {dayEvents.map((e) => {
                      const meta = VIOLATION_META[e.violation_type] || VIOLATION_META.other;
                      const VIcon = meta.Icon;
                      const isExpanded = expandedEvent === e.id;
                      const hasLocation = e.latitude && e.longitude;
                      const addr = addresses[e.id];
                      return (
                        <div key={e.id} className={`rounded-lg border ${meta.border} ${meta.bg} overflow-hidden transition`}>
                          <button onClick={() => setExpandedEvent(isExpanded ? null : e.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-opacity-80 transition">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                            <div className={`w-7 h-7 rounded-lg ${meta.bg} border ${meta.border} flex items-center justify-center flex-shrink-0`}>
                              <VIcon className={`w-3.5 h-3.5 ${meta.text}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-xs font-bold ${meta.text} truncate`}>{e.violation_label}</p>
                                {e.severity === 'high' && <span className="text-[9px] font-bold px-1 py-0.5 rounded-full bg-red-600 text-white">HIGH</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                                <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {e.time}</span>
                                {e.driver_name && <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> {e.driver_name}</span>}
                                {e.speed_kph != null && <span className="flex items-center gap-0.5"><Gauge className="w-2.5 h-2.5" /> {Math.round(e.speed_kph)} km/h</span>}
                              </div>
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-200/60 bg-white/50">
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <p className="text-[9px] uppercase font-semibold text-slate-400">Rule</p>
                                  <p className="text-slate-700 font-medium">{e.rule_name}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] uppercase font-semibold text-slate-400">Severity</p>
                                  <p className={`font-bold capitalize ${e.severity === 'high' ? 'text-red-600' : e.severity === 'medium' ? 'text-amber-600' : 'text-slate-500'}`}>{e.severity}</p>
                                </div>
                                {e.speed_limit_kph != null && (
                                  <div>
                                    <p className="text-[9px] uppercase font-semibold text-slate-400">Speed Limit</p>
                                    <p className="text-slate-700 font-medium">{Math.round(e.speed_limit_kph)} km/h</p>
                                  </div>
                                )}
                                {e.duration_seconds != null && (
                                  <div>
                                    <p className="text-[9px] uppercase font-semibold text-slate-400">Duration</p>
                                    <p className="text-slate-700 font-medium">{formatDuration(e.duration_seconds)}</p>
                                  </div>
                                )}
                              </div>
                              {hasLocation && (
                                <div>
                                  <p className="text-[9px] uppercase font-semibold text-slate-400 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> Location</p>
                                  <p className="text-[11px] text-slate-600 mt-0.5">
                                    {addr || (addr === null ? `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : 'Resolving...')}
                                  </p>
                                </div>
                              )}
                              {e.driver_name && (
                                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-blue-700">{e.driver_name.charAt(0)}</span>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400">Driver</p>
                                    <p className="text-xs font-semibold text-slate-700">{e.driver_name}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer note */}
          {filteredEvents.length > 0 && (
            <p className="text-[10px] text-slate-400 text-center pt-1">
              Showing {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} from the last {days} days · Data from Geotab Exception Events
              {isFetching && ' · Updating...'}
            </p>
          )}
        </>
      )}
    </div>
  );
}