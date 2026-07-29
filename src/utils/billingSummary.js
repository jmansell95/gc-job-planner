import { eachDayOfInterval, isWeekend } from 'date-fns';
import { getTotalMetres } from '@/utils/geotechBilling';

// Nights between two YYYY-MM-DD date strings.
export function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const inD = new Date(checkIn + 'T00:00:00');
  const outD = new Date(checkOut + 'T00:00:00');
  return Math.max(0, Math.round((outD - inD) / (1000 * 60 * 60 * 24)));
}

// Working days (excl weekends) between two date strings.
export function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (e < s) return 0;
  return eachDayOfInterval({ start: s, end: e }).filter((d) => !isWeekend(d)).length;
}

// Net cost of a JobCostItem, accounting for POA negotiated pricing.
const itemNet = (c) => {
  const rate = c.price_confirmed && c.negotiated_unit_cost != null
    ? Number(c.negotiated_unit_cost)
    : (Number(c.unit_cost) || 0);
  return rate * (Number(c.quantity) || 1);
};

/**
 * Compute a single job's billing summary from pre-grouped entity arrays.
 * Mirrors useJobFinancials so the billing team sees identical figures to the
 * job costing screen.
 *
 * @param {object} job - Job record
 * @param {object} d - { costItems, hotelBookings, deliveries, timesheets, invLogs, rigAssignments, rateItems, rotas, siteAssets, staffRecords }
 *   each already filtered to this job (rateItems is the global labour/day rate list)
 */
export function computeBillingRow(job, d) {
  const vatRate = Number(job.vat_rate) || 20;
  const markup = Number(job.markup_percentage) || 0;

  const costItems = d.costItems || [];
  const hotelBookings = d.hotelBookings || [];
  const deliveries = d.deliveries || [];
  const timesheets = d.timesheets || [];
  const invLogs = d.invLogs || [];
  const rigAssignments = d.rigAssignments || [];
  const rateItems = d.rateItems || [];
  const rotas = d.rotas || [];
  const siteAssets = d.siteAssets || [];
  const staffRecords = d.staffRecords || [];

  // ---- Identify rig vs non-rig cost items (same logic as useJobFinancials) ----
  const siteAssetMap = {};
  siteAssets.forEach((a) => { siteAssetMap[a.id] = a; });
  const isRigItem = (c) => {
    if (!c.site_asset_id) return false;
    const a = siteAssetMap[c.site_asset_id];
    return a && (a.is_rig === true || a.asset_type === 'rig');
  };

  const nonRigCostItems = costItems.filter((c) => !isRigItem(c));
  const rigCostItems = costItems.filter((c) => isRigItem(c));

  // ---- Equipment costs (non-rig, with POA pricing) ----
  const equipmentNet = nonRigCostItems.reduce((s, c) => s + itemNet(c), 0);
  const equipmentVat = nonRigCostItems.reduce((s, c) => s + (c.vat_exempt ? 0 : itemNet(c) * (vatRate / 100)), 0);

  // ---- Rig costs: day rate × working days (from delivery to off-hire) ----
  const rigCostRows = rigCostItems.map((c) => {
    const dayRate = c.price_confirmed && c.negotiated_unit_cost != null
      ? Number(c.negotiated_unit_cost)
      : (Number(c.unit_cost) || 0);
    const isDelivered = c.current_location === 'site' || c.current_location === 'returned' || c.hire_status === 'off_hired';
    const locDate = c.location_updated_at ? c.location_updated_at.split('T')[0] : null;
    const startDate = c.start_date || (isDelivered ? locDate : null);
    const endDate = c.off_hire_date || c.end_date || null;
    const rigDays = isDelivered && startDate ? workingDays(startDate, endDate || new Date().toISOString().split('T')[0]) : 0;
    return { name: c.description, day_rate: dayRate, days: rigDays, total: Math.round(dayRate * rigDays * 100) / 100 };
  });
  const rigCost = rigCostRows.reduce((s, r) => s + r.total, 0);

  // ---- Crew costs: staff on rota without a labour JobCostItem × their day rate ----
  const labourItemStaffIds = new Set(
    costItems.filter((c) => c.category === 'labour' && c.staff_id).map((c) => c.staff_id)
  );
  const staffMap = {};
  staffRecords.forEach((s) => { staffMap[s.id] = s; });
  const staffDayMap = {};
  rotas.forEach((a) => {
    if (!a.staff_id || labourItemStaffIds.has(a.staff_id)) return;
    if (!staffDayMap[a.staff_id]) staffDayMap[a.staff_id] = { dates: new Set(), overtimeDates: new Set(), multiplier: 1.5 };
    if (a.assigned_date) staffDayMap[a.staff_id].dates.add(a.assigned_date);
    if (a.is_overtime && a.assigned_date) staffDayMap[a.staff_id].overtimeDates.add(a.assigned_date);
    if (a.rate_multiplier) staffDayMap[a.staff_id].multiplier = Number(a.rate_multiplier);
  });
  const crewRows = Object.entries(staffDayMap).map(([sid, info]) => {
    const dayRateItem = rateItems.find((r) => r.staff_id === sid) || rateItems.find((r) => !r.staff_id);
    const dayRate = dayRateItem ? Number(dayRateItem.price) : 0;
    const totalDays = info.dates.size;
    const otDays = info.overtimeDates.size;
    const stdDays = totalDays - otDays;
    const total = Math.round((stdDays * dayRate + otDays * dayRate * info.multiplier) * 100) / 100;
    return { staff_id: sid, staff_name: staffMap[sid]?.name || sid, day_rate: dayRate, standard_days: stdDays, overtime_days: otDays, total_cost: total };
  });
  const crewCost = crewRows.reduce((s, r) => s + r.total_cost, 0);

  // ---- Hotel costs ----
  const hotelNet = hotelBookings.reduce((s, b) => {
    const nights = calcNights(b.check_in_date, b.check_out_date);
    const rooms = Number(b.room_count) || 1;
    return s + (Number(b.cost_per_night) || 0) * rooms * nights;
  }, 0);
  const hotelVat = hotelNet * (vatRate / 100);

  const totalCostNet = equipmentNet + hotelNet + rigCost + crewCost;
  const totalCostVat = equipmentVat + hotelVat;
  const totalCostGross = totalCostNet + totalCostVat;

  // ---- Additional charges (deliveries + chargeable tasks) ----
  const deliveryCharges = deliveries
    .filter((x) => x.chargeable !== false)
    .reduce((s, x) => s + (Number(x.charge_amount) || 0), 0);
  const taskCharges = timesheets
    .filter((t) => t.chargeable && !t.is_break)
    .reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);
  const additionalCharges = deliveryCharges + taskCharges;

  // ---- Revenue by method ----
  const method = job.revenue_method || 'none';
  let revenueNet = 0;
  let revenueLabel = 'Markup on cost';
  if (method === 'meterage_rate') {
    const manualMeterage = Number(job.meterage) || 0;
    const meterage = manualMeterage > 0 ? manualMeterage : getTotalMetres(invLogs);
    revenueNet = meterage * (Number(job.meterage_rate) || 0);
    revenueLabel = manualMeterage > 0 ? 'Meterage' : 'Meterage (auto)';
  } else if (method === 'day_rate') {
    const plannedDays = workingDays(job.start_date, job.end_date);
    let total = 0;
    rigAssignments.forEach((a) => {
      if (a.asset_type !== 'rig') return;
      const rate = rateItems.find((r) => {
        if (a.rig_type === 'rotary') return /rotary crew/i.test(r.description);
        if (a.rig_type === 'cp') return /^cable percussive crew$/i.test(r.description.trim());
        return false;
      });
      if (rate) total += rate.price * plannedDays;
    });
    revenueNet = total;
    revenueLabel = 'Day rate';
  } else if (method === 'unit_rate') {
    const units = invLogs.reduce((s, l) => s + (Number(l.units_completed) || 0), 0);
    revenueNet = units * (Number(job.unit_price) || 0);
    revenueLabel = 'Unit rate';
  } else if (method === 'flat_fee') {
    revenueNet = Number(job.client_charge) || 0;
    revenueLabel = 'Flat fee';
  } else {
    const markupAmount = totalCostNet * (markup / 100);
    revenueNet = totalCostNet + markupAmount + additionalCharges;
    revenueLabel = 'Cost + markup';
  }

  const revenueVat = revenueNet * (vatRate / 100);
  const revenueGross = revenueNet + revenueVat;

  return {
    job,
    equipmentNet,
    hotelNet,
    rigCost,
    crewCost,
    totalCostNet,
    totalCostVat,
    totalCostGross,
    deliveryCharges,
    taskCharges,
    additionalCharges,
    revenueNet,
    revenueVat,
    revenueGross,
    revenueLabel,
    method,
    vatRate,
  };
}

// Group a flat entity list into { [job_id]: [...] }.
export function groupByJob(list) {
  const map = {};
  (list || []).forEach((item) => {
    const jid = item.job_id;
    if (!jid) return;
    if (!map[jid]) map[jid] = [];
    map[jid].push(item);
  });
  return map;
}

// Jobs considered ready for the billing team to invoice / complete a CDR.
export const READY_STATUSES = ['decommissioning', 'completed'];