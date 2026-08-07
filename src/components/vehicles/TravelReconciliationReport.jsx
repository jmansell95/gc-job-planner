import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Route, Loader2, Clock, MapPin, ChevronDown, ChevronRight, RefreshCw,
  AlertCircle, FileDown, Calendar, TrendingDown, Timer, Navigation,
  CheckCircle2, AlertTriangle, XCircle, User,
} from 'lucide-react';
import { batchReverseGeocode } from '@/utils/reverseGeocode';
import jsPDF from 'jspdf';

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

// Group trips by day
function groupTripsByDay(trips) {
  const groups = {};
  for (const t of trips) {
    const dayKey = (t.start_time || '').slice(0, 10);
    if (!dayKey) continue;
    if (!groups[dayKey]) groups[dayKey] = [];
    groups[dayKey].push(t);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayTrips]) => ({
      date,
      trips: dayTrips,
      distance: dayTrips.reduce((s, t) => s + (t.distance_km || 0), 0),
      duration: dayTrips.reduce((s, t) => s + (t.duration_minutes || 0), 0),
      firstStart: dayTrips.reduce((m, t) => m && m < t.start_time ? m : t.start_time, null),
      lastEnd: dayTrips.reduce((m, t) => m && m > t.end_time ? m : t.end_time, null),
    }));
}

// Match GPS trips to timesheet entries for the same staff member on the same date.
// Timesheets don't have vehicle_id, so we match by the vehicle's assigned staff_id.
function reconcileTripsWithTimesheets(trips, timesheets, staffMap, assignedStaffId, vehicleName) {
  // Group GPS trips by date
  const byDate = {};
  for (const t of trips) {
    const date = (t.start_time || '').slice(0, 10);
    if (!date) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(t);
  }

  const reconciliations = [];
  for (const [date, dayTrips] of Object.entries(byDate)) {
    const gpsDriveMins = dayTrips.reduce((s, t) => s + (t.duration_minutes || 0), 0);
    const gpsFirstStart = dayTrips.reduce((m, t) => (m && m < t.start_time ? m : t.start_time), null);
    const gpsLastEnd = dayTrips.reduce((m, t) => (m > t.end_time ? m : t.end_time), null);
    const distanceMi = kmToMi(dayTrips.reduce((s, t) => s + (t.distance_km || 0), 0));

    // Find matching timesheets — same staff_id and date
    // Sum travel_to + travel_from minutes (the claimed travel hours)
    const matchingTs = timesheets.filter(ts =>
      ts.staff_id === assignedStaffId &&
      (ts.date || '').slice(0, 10) === date &&
      !ts.is_break
    );

    if (matchingTs.length > 0) {
      // Aggregate claimed travel from all entries for this staff on this date
      const claimedTravelMins = matchingTs.reduce((s, ts) => {
        const travel = Number(ts.travel_to_minutes || 0) + Number(ts.travel_from_minutes || 0);
        // If no explicit travel fields, count travel-type task entries
        if (travel === 0 && (ts.task_type === 'travel_to' || ts.task_type === 'travel_from')) {
          return s + Number(ts.task_duration_minutes || 0);
        }
        return s + travel;
      }, 0);
      const variance = gpsDriveMins - claimedTravelMins;
      const status = Math.abs(variance) <= 15 ? 'match' : variance > 15 ? 'under_claimed' : 'over_claimed';
      const staff = staffMap[assignedStaffId];

      reconciliations.push({
        staff_name: staff?.name || matchingTs[0]?.staff_name || 'Unknown',
        date,
        gps_drive_mins: gpsDriveMins,
        gps_first_start: gpsFirstStart,
        gps_last_end: gpsLastEnd,
        claimed_travel_mins: claimedTravelMins,
        variance,
        status,
        trip_count: dayTrips.length,
        distance_mi: distanceMi,
      });
    } else {
      // No timesheet entries for this date — GPS shows driving but no claim
      reconciliations.push({
        staff_name: staffMap[assignedStaffId]?.name || vehicleName || 'Unassigned',
        date,
        gps_drive_mins: gpsDriveMins,
        gps_first_start: gpsFirstStart,
        gps_last_end: gpsLastEnd,
        claimed_travel_mins: 0,
        variance: gpsDriveMins,
        status: 'unrecorded',
        trip_count: dayTrips.length,
        distance_mi: distanceMi,
      });
    }
  }
  return reconciliations.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// Generate a full PDF report with all trips + reconciliation
function generateFullPDF(vehicle, tripData, reconciliations, dateRange) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297, margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Header bar
  doc.setFillColor(46, 90, 26);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Vehicle Travel Reconciliation Report', margin, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, margin, 20);
  doc.text('GC Mission Control — Fleet Command', margin, 26);
  y = 40;

  // Vehicle identity
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${vehicle.registration_number || 'Unknown Reg'}`, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.name || '';
  if (makeModel) { doc.text(`Make/Model: ${makeModel}`, margin, y); y += 5; }
  if (dateRange.from || dateRange.to) {
    doc.text(`Period: ${dateRange.from || '—'} to ${dateRange.to || '—'}`, margin, y); y += 5;
  }
  y += 4;

  // Summary stats
  const trips = tripData?.trips || [];
  const totalDistMi = kmToMi(tripData?.total_distance_km || 0);
  const totalDriveMins = trips.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const totalIdleMins = trips.reduce((s, t) => s + (t.idle_minutes || 0), 0);

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Summary', margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Trips: ${trips.length}`, margin, y); y += 5;
  doc.text(`Total Distance: ${totalDistMi.toFixed(1)} mi`, margin, y); y += 5;
  doc.text(`Total Drive Time: ${formatDuration(totalDriveMins)}`, margin, y); y += 5;
  doc.text(`Total Idle Time: ${formatDuration(totalIdleMins)}`, margin, y); y += 8;

  // Reconciliation summary
  if (reconciliations.length > 0) {
    if (y > pageH - 40) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Travel-Hour Reconciliation (GPS vs Timesheet)', margin, y);
    y += 6;

    // Table header
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Date', margin + 2, y + 5.5);
    doc.text('Staff', margin + 25, y + 5.5);
    doc.text('GPS Drive', margin + 70, y + 5.5);
    doc.text('Claimed Travel', margin + 100, y + 5.5);
    doc.text('Variance', margin + 130, y + 5.5);
    doc.text('Status', margin + 160, y + 5.5);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    for (const r of reconciliations) {
      if (y > pageH - 15) { doc.addPage(); y = margin; }
      const date = r.date || '—';
      const staff = (r.staff_name || '').slice(0, 20);
      const gps = formatDuration(r.gps_drive_mins);
      const claimed = formatDuration(r.claimed_travel_mins);
      const variance = (r.variance > 0 ? '+' : '') + formatDuration(r.variance);
      const status = r.status === 'match' ? 'MATCH' : r.status === 'under_claimed' ? 'UNDER-CLAIMED' : r.status === 'over_claimed' ? 'OVER-CLAIMED' : 'UNRECORDED';

      // Colour-code variance
      if (r.status === 'match') doc.setTextColor(16, 185, 129);
      else if (r.status === 'under_claimed') doc.setTextColor(245, 158, 11);
      else doc.setTextColor(239, 68, 68);

      doc.text(date, margin + 2, y + 5);
      doc.setTextColor(71, 85, 105);
      doc.text(staff, margin + 25, y + 5);
      doc.text(gps, margin + 70, y + 5);
      doc.text(claimed, margin + 100, y + 5);
      if (r.status === 'match') doc.setTextColor(16, 185, 129);
      else if (r.status === 'under_claimed') doc.setTextColor(245, 158, 11);
      else doc.setTextColor(239, 68, 68);
      doc.text(variance, margin + 130, y + 5);
      doc.text(status, margin + 160, y + 5);
      y += 6;
      doc.setDrawColor(241, 245, 249);
      doc.setTextColor(71, 85, 105);
      doc.line(margin, y, pageW - margin, y);
    }
    y += 4;
  }

  // Full trip log — ALL trips (not capped)
  if (trips.length > 0) {
    if (y > pageH - 40) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Full Trip Log (${trips.length} trips)`, margin, y);
    y += 6;

    // Table header
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Date', margin + 2, y + 5.5);
    doc.text('Start', margin + 22, y + 5.5);
    doc.text('End', margin + 38, y + 5.5);
    doc.text('From', margin + 54, y + 5.5);
    doc.text('To', margin + 104, y + 5.5);
    doc.text('Mi', margin + 154, y + 5.5);
    doc.text('Dur', margin + 168, y + 5.5);
    doc.text('Max', margin + 184, y + 5.5);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    for (const trip of trips) {
      if (y > pageH - 15) { doc.addPage(); y = margin; }
      const date = new Date(trip.start_time).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      const start = formatTime(trip.start_time);
      const end = formatTime(trip.end_time);
      const from = (trip.start_location || '—').slice(0, 28);
      const to = (trip.end_location || '—').slice(0, 28);
      const distMi = kmToMi(trip.distance_km).toFixed(1);
      const dur = formatDuration(trip.duration_minutes);
      const maxMph = Math.round(kmToMi(trip.max_speed_kph || 0));
      doc.text(date, margin + 2, y + 5);
      doc.text(start, margin + 22, y + 5);
      doc.text(end, margin + 38, y + 5);
      doc.text(from, margin + 54, y + 5);
      doc.text(to, margin + 104, y + 5);
      doc.text(distMi, margin + 154, y + 5);
      doc.text(dur, margin + 168, y + 5);
      doc.text(String(maxMph), margin + 184, y + 5);
      y += 5.5;
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, pageW - margin, y);
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount} · GC Mission Control`, pageW / 2, pageH - 8, { align: 'center' });
  }

  const filename = `travel-reconciliation-${(vehicle.registration_number || 'unknown').replace(/\s/g, '')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export default function TravelReconciliationReport({ vehicle }) {
  const [expanded, setExpanded] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [geocodedTrips, setGeocodedTrips] = useState({});

  // Default to last 7 days if no dates selected
  const effectiveFrom = useMemo(() => {
    if (fromDate) return new Date(fromDate + 'T00:00:00').toISOString();
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }, [fromDate]);
  const effectiveTo = useMemo(() => {
    if (toDate) return new Date(toDate + 'T23:59:59').toISOString();
    return new Date().toISOString();
  }, [toDate]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['travel-reconciliation', vehicle?.id, effectiveFrom, effectiveTo],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', {
        mode: 'geotab_history',
        vehicle_id: vehicle.id,
        from_date: effectiveFrom,
        to_date: effectiveTo,
        limit: 500,
      });
      return res?.data || res;
    },
    enabled: !!vehicle?.id && !!vehicle?.geotab_device_id,
  });

  // Load timesheets for reconciliation
  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets-for-reconciliation'],
    queryFn: () => base44.entities.Timesheet.list('-created_date', 500),
  });
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-for-reconciliation'],
    queryFn: () => base44.entities.Staff.list(),
  });

  const staffMap = useMemo(() => {
    const m = {};
    for (const s of staffList) m[s.id] = s;
    return m;
  }, [staffList]);

  const trips = data?.trips || [];
  const breadcrumbs = data?.breadcrumbs || [];

  // Tag trips with vehicle_id for reconciliation matching
  const tripsTagged = useMemo(() =>
    trips.map(t => ({ ...t, _vehicle_id: vehicle?.id, _driver_name: data?.vehicle_name })),
    [trips, vehicle?.id, data?.vehicle_name]
  );

  // Frontend geocoding — resolves "Unknown location" labels
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
        updated[t.trip_id] = {
          start_location: sKey && labels[sKey] ? labels[sKey] : t.start_location,
          end_location: eKey && labels[eKey] ? labels[eKey] : t.end_location,
        };
      }
      if (!cancelled) setGeocodedTrips(updated);
    })();
    return () => { cancelled = true; };
  }, [trips]);

  // Merge geocoded locations into trips
  const geocodedTripList = useMemo(() =>
    tripsTagged.map(t => {
      const geo = geocodedTrips[t.trip_id];
      return geo ? { ...t, start_location: geo.start_location, end_location: geo.end_location } : t;
    }),
    [tripsTagged, geocodedTrips]
  );

  // Reconcile with timesheets — match by the vehicle's assigned staff member
  const reconciliations = useMemo(() =>
    reconcileTripsWithTimesheets(geocodedTripList, timesheets, staffMap, vehicle?.assigned_staff_id, vehicle?.name),
    [geocodedTripList, timesheets, staffMap, vehicle?.assigned_staff_id, vehicle?.name]
  );

  const dayGroups = useMemo(() => groupTripsByDay(geocodedTripList), [geocodedTripList]);

  const totalDistance = data?.total_distance_km || 0;
  const totalDriveMins = trips.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const totalIdleMins = trips.reduce((s, t) => s + (t.idle_minutes || 0), 0);
  const matchCount = reconciliations.filter(r => r.status === 'match').length;
  const underClaimedCount = reconciliations.filter(r => r.status === 'under_claimed').length;
  const unrecordedCount = reconciliations.filter(r => r.status === 'unrecorded').length;

  const handleDownloadPDF = () => {
    generateFullPDF(vehicle, { ...data, trips: geocodedTripList }, reconciliations, { from: fromDate, to: toDate });
  };

  if (!vehicle?.geotab_device_id) {
    return (
      <div className="text-center py-4 bg-slate-50 rounded-xl">
        <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
        <p className="text-xs text-slate-400">No Geotab device linked to this vehicle.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with date picker + PDF */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-800">Travel Reconciliation</h3>
          <span className="text-[10px] text-slate-400">Geotab · {vehicle.registration_number}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-cyan-400" />
            <span className="text-xs text-slate-400">→</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-cyan-400" />
          </div>
          <button onClick={handleDownloadPDF} disabled={isLoading || trips.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => refetch()} disabled={isFetching}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition">
            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
          <span className="ml-2 text-xs text-slate-500">Fetching trips & reconciling...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-600">
          {error.message || 'Failed to fetch trip history'}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-6 bg-slate-50 rounded-xl">
          <Route className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400">No trips recorded in this period.</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-2.5 border border-cyan-200">
              <p className="text-[10px] uppercase text-cyan-600 font-semibold flex items-center gap-1"><Route className="w-3 h-3" /> Trips</p>
              <p className="text-lg font-bold text-cyan-700 tabular-nums mt-0.5">{trips.length}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-2.5 border border-emerald-200">
              <p className="text-[10px] uppercase text-emerald-600 font-semibold flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Miles</p>
              <p className="text-lg font-bold text-emerald-700 tabular-nums mt-0.5">{kmToMi(totalDistance).toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2.5 border border-blue-200">
              <p className="text-[10px] uppercase text-blue-600 font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Drive</p>
              <p className="text-lg font-bold text-blue-700 tabular-nums mt-0.5">{formatDuration(totalDriveMins)}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-2.5 border border-amber-200">
              <p className="text-[10px] uppercase text-amber-600 font-semibold flex items-center gap-1"><Timer className="w-3 h-3" /> Idle</p>
              <p className="text-lg font-bold text-amber-700 tabular-nums mt-0.5">{formatDuration(totalIdleMins)}</p>
            </div>
          </div>

          {/* Reconciliation summary */}
          {reconciliations.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Travel-Hour Reconciliation (GPS vs Timesheet)
              </h4>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-600">{matchCount} matched</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-slate-600">{underClaimedCount} under-claimed</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-slate-600">{unrecordedCount} unrecorded</span>
                </div>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {reconciliations.slice(0, 20).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded hover:bg-slate-50">
                    <span className="font-mono text-slate-500 w-20">{r.date}</span>
                    <span className="font-semibold text-slate-700 flex-1 truncate">{r.staff_name}</span>
                    <span className="text-slate-500">GPS: {formatDuration(r.gps_drive_mins)}</span>
                    <span className="text-slate-400">vs</span>
                    <span className="text-slate-500">Claimed: {formatDuration(r.claimed_travel_mins)}</span>
                    <span className={`font-bold w-20 text-right ${
                      r.status === 'match' ? 'text-emerald-600' :
                      r.status === 'under_claimed' ? 'text-amber-600' :
                      r.status === 'over_claimed' ? 'text-rose-600' : 'text-rose-600'
                    }`}>
                      {r.variance > 0 ? '+' : ''}{formatDuration(r.variance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trip list — grouped by day */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {dayGroups.map((dg) => (
              <div key={dg.date} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-slate-50 to-white">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-sm font-bold text-slate-800">
                    {new Date(dg.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                  <div className="flex-1" />
                  <span className="flex items-center gap-0.5 text-[11px] text-emerald-600 font-bold">
                    <TrendingDown className="w-3 h-3" />{kmToMi(dg.distance).toFixed(1)}mi
                  </span>
                  <span className="flex items-center gap-0.5 text-[11px] text-slate-500 font-semibold">
                    <Clock className="w-3 h-3" />{formatDuration(dg.duration)}
                  </span>
                </div>
                <div className="p-2 space-y-1.5 bg-white">
                  {dg.trips.map((trip, i) => {
                    const isExp = expanded === trip.trip_id;
                    return (
                      <div key={trip.trip_id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <button onClick={() => setExpanded(isExp ? null : trip.trip_id)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition text-left">
                          {isExp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] text-slate-400">
                              {formatTime(trip.start_time)} → {formatTime(trip.end_time)}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                              <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                              <span className="truncate">{trip.start_location || 'Resolving...'}</span>
                              <Navigation className="w-2.5 h-2.5 text-slate-300" />
                              <span className="truncate">{trip.end_location || 'Resolving...'}</span>
                            </div>
                          </div>
                          <span className="flex items-center gap-0.5 text-[11px] text-emerald-600 font-bold">
                            <TrendingDown className="w-3 h-3" />{kmToMi(trip.distance_km).toFixed(1)}mi
                          </span>
                          <span className="flex items-center gap-0.5 text-[11px] text-slate-500">
                            <Clock className="w-3 h-3" />{formatDuration(trip.duration_minutes)}
                          </span>
                        </button>
                        {isExp && (
                          <div className="px-3 pb-3 pt-1 bg-slate-50/50 space-y-2">
                            <div className="grid grid-cols-4 gap-2">
                              <div className="bg-cyan-50 rounded-lg p-2 border border-cyan-100 text-center">
                                <p className="text-[9px] uppercase text-cyan-500 font-semibold">Max</p>
                                <p className="text-sm font-bold text-cyan-700 tabular-nums">{Math.round(kmToMi(trip.max_speed_kph))}mph</p>
                              </div>
                              <div className="bg-violet-50 rounded-lg p-2 border border-violet-100 text-center">
                                <p className="text-[9px] uppercase text-violet-500 font-semibold">Avg</p>
                                <p className="text-sm font-bold text-violet-700 tabular-nums">{Math.round(kmToMi(trip.average_speed_kph || 0))}mph</p>
                              </div>
                              <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 text-center">
                                <p className="text-[9px] uppercase text-amber-500 font-semibold">Idle</p>
                                <p className="text-sm font-bold text-amber-700 tabular-nums">{formatDuration(trip.idle_minutes)}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 text-center">
                                <p className="text-[9px] uppercase text-slate-400 font-semibold">Odo</p>
                                <p className="text-sm font-bold text-slate-600 tabular-nums">{Math.round(kmToMi(trip.odometer_km || 0)).toLocaleString()}mi</p>
                              </div>
                            </div>
                            {(trip.stops || []).length > 0 && (
                              <div className="text-[11px] text-slate-500">
                                <span className="font-semibold">{trip.stops.length} stop(s)</span>
                                {trip.stops.map((s, si) => (
                                  <div key={si} className="flex items-center gap-1 pl-3 py-0.5">
                                    <MapPin className="w-2.5 h-2.5 text-amber-400" />
                                    <span className="truncate">{s.location || 'Resolving...'}</span>
                                    <span className="text-slate-400">({formatDuration(s.duration_minutes)})</span>
                                  </div>
                                ))}
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
        </>
      )}
    </div>
  );
}