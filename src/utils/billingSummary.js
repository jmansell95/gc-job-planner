import { eachDayOfInterval, isWeekend } from 'date-fns';

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

const itemNet = (c) => (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1);

/**
 * Compute a single job's billing summary from pre-grouped entity arrays.
 * Mirrors useJobFinancials so the billing team sees identical figures to the
 * job costing screen.
 *
 * @param {object} job - Job record
 * @param {object} d - { costItems, hotelBookings, deliveries, timesheets, invLogs, rigAssignments, rateItems }
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

  const equipmentNet = costItems.reduce((s, c) => s + itemNet(c), 0);
  const hotelNet = hotelBookings.reduce((s, b) => {
    const nights = calcNights(b.check_in_date, b.check_out_date);
    const rooms = Number(b.room_count) || 1;
    return s + (Number(b.cost_per_night) || 0) * rooms * nights;
  }, 0);
  const totalCostNet = equipmentNet + hotelNet;
  const totalCostVat = totalCostNet * (vatRate / 100);
  const totalCostGross = totalCostNet + totalCostVat;

  const deliveryCharges = deliveries
    .filter((x) => x.chargeable !== false)
    .reduce((s, x) => s + (Number(x.charge_amount) || 0), 0);
  const taskCharges = timesheets
    .filter((t) => t.chargeable && !t.is_break)
    .reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);
  const additionalCharges = deliveryCharges + taskCharges;

  const method = job.revenue_method || 'none';
  let revenueNet = 0;
  let revenueLabel = 'Markup on cost';
  if (method === 'meterage_rate') {
    revenueNet = (Number(job.meterage) || 0) * (Number(job.meterage_rate) || 0);
    revenueLabel = 'Meterage';
  } else if (method === 'day_rate') {
    const plannedDays = workingDays(job.start_date, job.end_date);
    let total = 0;
    rigAssignments.forEach((a) => {
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