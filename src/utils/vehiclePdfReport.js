import jsPDF from 'jspdf';
import { batchReverseGeocodeStructured, buildLabelFromParts } from '@/utils/reverseGeocode';

/**
 * Generate a PDF trip history & mileage report for a single vehicle.
 * Geocodes all trip start/end coordinates to proper street + postcode addresses
 * before rendering, so the report shows real locations instead of "Unknown".
 * @param {Object} vehicle - Vehicle entity
 * @param {Object} tripData - Result from getVehicleLocationHistory (geotab_history mode)
 * @param {Array} maintenanceBookings - VehicleMaintenanceBooking records for this vehicle
 */
export async function generateVehicleReport(vehicle, tripData, maintenanceBookings = []) {
  // Geocode all trip coordinates to street + postcode addresses.
  // The backend returns "Unknown location" for all trips — geocoding happens
  // client-side via BigDataCloud (reliable in browser, unreliable in edge runtime).
  const trips = tripData?.trips || [];
  if (trips.length > 0) {
    const coords = [];
    for (const t of trips) {
      if (t.start_lat != null) coords.push({ lat: t.start_lat, lng: t.start_lng });
      if (t.end_lat != null) coords.push({ lat: t.end_lat, lng: t.end_lng });
    }
    if (coords.length > 0) {
      const labels = await batchReverseGeocodeStructured(coords);
      for (const t of trips) {
        const sKey = t.start_lat != null ? `${Number(t.start_lat).toFixed(4)},${Number(t.start_lng).toFixed(4)}` : null;
        const eKey = t.end_lat != null ? `${Number(t.end_lat).toFixed(4)},${Number(t.end_lng).toFixed(4)}` : null;
        if (sKey && labels[sKey]) t.start_location = buildLabelFromParts(labels[sKey]) || t.start_location;
        if (eKey && labels[eKey]) t.end_location = buildLabelFromParts(labels[eKey]) || t.end_location;
      }
    }
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Header bar ──
  doc.setFillColor(46, 90, 26); // GC brand green
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Vehicle Report', margin, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, margin, 20);
  doc.text('GC Mission Control — Fleet Command', margin, 26);

  y = 40;

  // ── Vehicle identity ──
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${vehicle.registration_number || 'Unknown Reg'}`, margin, y);
  y += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.name || '';
  if (makeModel) { doc.text(`Make/Model: ${makeModel}`, margin, y); y += 5; }
  if (vehicle.year) { doc.text(`Year: ${vehicle.year}`, margin, y); y += 5; }
  if (vehicle.vin) { doc.text(`VIN: ${vehicle.vin}`, margin, y); y += 5; }
  if (vehicle.fuel_type && vehicle.fuel_type !== 'unknown') { doc.text(`Fuel: ${vehicle.fuel_type}`, margin, y); y += 5; }
  if (vehicle.color) { doc.text(`Colour: ${vehicle.color}`, margin, y); y += 5; }
  if (vehicle.current_mileage != null) { doc.text(`Current Mileage: ${Number(vehicle.current_mileage).toLocaleString()} mi`, margin, y); y += 5; }

  // ── Compliance summary ──
  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Compliance Status', margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  if (vehicle.mot_expiry) {
    const days = Math.ceil((new Date(vehicle.mot_expiry + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24));
    const status = days < 0 ? 'EXPIRED' : days <= 30 ? `Due in ${days}d` : `Valid (${days}d remaining)`;
    doc.text(`MOT Expiry: ${vehicle.mot_expiry} — ${status}`, margin, y);
    y += 5;
  }
  if (vehicle.service_due_date) {
    const days = Math.ceil((new Date(vehicle.service_due_date + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24));
    const status = days < 0 ? 'OVERDUE' : days <= 30 ? `Due in ${days}d` : `OK (${days}d remaining)`;
    doc.text(`Service Due: ${vehicle.service_due_date} — ${status}`, margin, y);
    y += 5;
  }

  // ── Trip summary ──
  if (tripData?.trips?.length > 0) {
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Trip History (${tripData.trips.length} trips)`, margin, y);
    y += 6;

    // Summary stats
    const totalDistMi = (tripData.total_distance_km || 0) * 0.621371;
    const totalDuration = tripData.trips.reduce((s, t) => s + (t.duration_minutes || 0), 0);
    const totalIdle = tripData.trips.reduce((s, t) => s + (t.idle_minutes || 0), 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Distance: ${totalDistMi.toFixed(1)} mi`, margin, y); y += 5;
    doc.text(`Total Drive Time: ${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`, margin, y); y += 5;
    doc.text(`Total Idle Time: ${Math.floor(totalIdle / 60)}h ${totalIdle % 60}m`, margin, y); y += 8;

    // Trip table header — redesigned to show both Start AND End locations
    // Column layout (mm from left margin):
    //   Date(2)  Start(20)  End(36)  Dist(52)  Dur(68)  Max(84)
    //   Start Location(98)  End Location(140)
    const tableY = y;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, tableY, contentW, 8, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Date', margin + 2, tableY + 5.5);
    doc.text('Start', margin + 20, tableY + 5.5);
    doc.text('End', margin + 36, tableY + 5.5);
    doc.text('Dist', margin + 52, tableY + 5.5);
    doc.text('Dur', margin + 66, tableY + 5.5);
    doc.text('Max', margin + 80, tableY + 5.5);
    doc.text('From (Street, Postcode)', margin + 92, tableY + 5.5);
    doc.text('To (Street, Postcode)', margin + 138, tableY + 5.5);
    y = tableY + 8;

    // Trip rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    for (const trip of tripData.trips.slice(0, 40)) {
      if (y > pageH - 20) {
        doc.addPage();
        y = margin;
      }
      const date = new Date(trip.start_time).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      const start = new Date(trip.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const end = new Date(trip.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const distMi = ((trip.distance_km || 0) * 0.621371).toFixed(1);
      const dur = trip.duration_minutes >= 60 ? `${Math.floor(trip.duration_minutes / 60)}h ${trip.duration_minutes % 60}m` : `${trip.duration_minutes}m`;
      const maxMph = Math.round((trip.max_speed_kph || 0) * 0.621371);
      // Truncate street+postcode to fit the column width (~44mm at 7.5pt)
      const fromLoc = (trip.start_location || '—').slice(0, 42);
      const toLoc = (trip.end_location || '—').slice(0, 42);
      doc.setFontSize(7.5);
      doc.text(date, margin + 2, y + 5);
      doc.text(start, margin + 20, y + 5);
      doc.text(end, margin + 36, y + 5);
      doc.text(distMi + 'mi', margin + 52, y + 5);
      doc.text(dur, margin + 66, y + 5);
      doc.text(String(maxMph), margin + 80, y + 5);
      doc.text(fromLoc, margin + 92, y + 5);
      doc.text(toLoc, margin + 138, y + 5);
      y += 6;
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, pageW - margin, y);
    }
    y += 4;
  }

  // ── Maintenance history ──
  if (maintenanceBookings.length > 0) {
    if (y > pageH - 40) { doc.addPage(); y = margin; }
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Maintenance History (${maintenanceBookings.length} bookings)`, margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    for (const b of maintenanceBookings.slice(0, 30)) {
      if (y > pageH - 15) { doc.addPage(); y = margin; }
      const date = b.booking_date || '—';
      const type = (b.booking_type || '').toUpperCase();
      const status = b.status || '';
      const supplier = b.supplier_name || '';
      const cost = b.cost ? `£${Number(b.cost).toLocaleString()}` : '';
      doc.text(`${date}  ${type}  ${status}  ${supplier}  ${cost}`, margin, y);
      y += 5;
    }
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount} · GC Mission Control`, pageW / 2, pageH - 8, { align: 'center' });
  }

  // Save
  const filename = `vehicle-report-${(vehicle.registration_number || 'unknown').replace(/\s/g, '')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}