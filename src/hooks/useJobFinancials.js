import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { eachDayOfInterval, isWeekend } from 'date-fns';

// Calculates nights between two date strings (YYYY-MM-DD).
export function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const inD = new Date(checkIn + 'T00:00:00');
  const outD = new Date(checkOut + 'T00:00:00');
  return Math.max(0, Math.round((outD - inD) / (1000 * 60 * 60 * 24)));
}

// Working days (excl weekends) between two date strings.
function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (e < s) return 0;
  return eachDayOfInterval({ start: s, end: e }).filter((d) => !isWeekend(d)).length;
}

/**
 * Aggregates all financial data for a single job:
 *  - Equipment costs (JobCostItem)
 *  - Hotel costs (HotelBooking: cost_per_night × room_count × nights)
 *  - Delivery & task charges
 *  - Revenue by the job's revenue_method
 *
 * Returns { costs, revenue, additional, totals }.
 */
export function useJobFinancials(job) {
  const jobId = job?.id;
  const vatRate = Number(job?.vat_rate) || 20;
  const markup = Number(job?.markup_percentage) || 0;

  const { data: costItems = [] } = useQuery({
    queryKey: ['job-cost-items-fin', jobId],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const { data: hotelBookings = [] } = useQuery({
    queryKey: ['job-hotel-bookings-fin', jobId],
    queryFn: () => base44.entities.HotelBooking.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['job-deliveries-fin', jobId],
    queryFn: () => base44.entities.DeliveryLog.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['job-timesheets-fin', jobId],
    queryFn: () => base44.entities.Timesheet.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const { data: rotas = [] } = useQuery({
    queryKey: ['job-rotas-fin', jobId],
    queryFn: () => base44.entities.RotaAssignment.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const { data: rigAssignments = [] } = useQuery({
    queryKey: ['job-rig-assignments-fin', jobId],
    queryFn: async () => {
      const all = await base44.entities.JobAssetAssignment.filter({ job_id: jobId });
      return all.filter((a) => a.asset_type === 'rig');
    },
    enabled: !!jobId,
  });

  const { data: rateItems = [] } = useQuery({
    queryKey: ['rate-card-items-labour-day-fin'],
    queryFn: async () => {
      const all = await base44.entities.RateCardItem.filter({ category: 'labour' });
      return all.filter((r) => r.unit === 'day' && r.price != null);
    },
  });

  const { data: invLogs = [] } = useQuery({
    queryKey: ['job-inv-logs-fin', jobId],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  // ---- Costs ----
  const itemNet = (c) => (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1);
  const equipmentNet = costItems.reduce((s, c) => s + itemNet(c), 0);
  const equipmentVat = costItems.reduce((s, c) => s + (c.vat_exempt ? 0 : itemNet(c) * (vatRate / 100)), 0);

  const hotelRows = hotelBookings.map((b) => {
    const nights = calcNights(b.check_in_date, b.check_out_date);
    const rooms = Number(b.room_count) || 1;
    const perNight = Number(b.cost_per_night) || 0;
    const total = perNight * rooms * nights;
    return { id: b.id, name: b.hotel_name, nights, rooms, perNight, total };
  });
  const hotelNet = hotelRows.reduce((s, h) => s + h.total, 0);
  const hotelVat = hotelNet * (vatRate / 100);

  const totalCostNet = equipmentNet + hotelNet;
  const totalCostVat = equipmentVat + hotelVat;
  const totalCostGross = totalCostNet + totalCostVat;

  // ---- Additional charges (deliveries + chargeable tasks) ----
  const deliveryCharges = deliveries
    .filter((d) => d.chargeable !== false)
    .reduce((s, d) => s + (Number(d.charge_amount) || 0), 0);
  const taskCharges = timesheets
    .filter((t) => t.chargeable && !t.is_break)
    .reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);
  const additionalCharges = deliveryCharges + taskCharges;

  // ---- Revenue by method ----
  const method = job?.revenue_method || 'none';
  let revenueNet = 0;
  let revenueLabel = 'Markup on cost';
  let revenueBreakdown = [];

  if (method === 'meterage_rate') {
    const meterage = Number(job?.meterage) || 0;
    const rate = Number(job?.meterage_rate) || 0;
    revenueNet = meterage * rate;
    revenueLabel = 'Meterage revenue';
    revenueBreakdown = [{ label: `${meterage}m × £${rate}/m`, value: revenueNet }];
  } else if (method === 'day_rate') {
    // Sum of rig crew day rates × working days, reusing the RigCostAnalysis auto-match logic.
    const plannedDays = workingDays(job?.start_date, job?.end_date);
    let dayRateTotal = 0;
    const rows = [];
    rigAssignments.forEach((a) => {
      const rate = rateItems.find((r) => {
        if (a.rig_type === 'rotary') return /rotary crew/i.test(r.description);
        if (a.rig_type === 'cp') return /^cable percussive crew$/i.test(r.description.trim());
        return false;
      });
      if (rate) {
        const line = rate.price * plannedDays;
        dayRateTotal += line;
        rows.push({ label: `${a.asset_name || 'Rig'}: ${rate.description}`, value: line });
      }
    });
    revenueNet = dayRateTotal;
    revenueLabel = 'Day-rate revenue';
    revenueBreakdown = rows.length ? rows : [{ label: 'No rig crew rates matched', value: 0 }];
  } else if (method === 'unit_rate') {
    const unitPrice = Number(job?.unit_price) || 0;
    const unitsDone = invLogs.reduce((s, l) => s + (Number(l.units_completed) || 0), 0);
    revenueNet = unitsDone * unitPrice;
    revenueLabel = 'Unit-rate revenue';
    revenueBreakdown = [{ label: `${unitsDone} units × £${unitPrice}`, value: revenueNet }];
  } else if (method === 'flat_fee') {
    revenueNet = Number(job?.client_charge) || 0;
    revenueLabel = 'Agreed flat fee';
    revenueBreakdown = [{ label: 'Project fee', value: revenueNet }];
  } else {
    // 'none' — legacy markup-on-cost model
    const markupAmount = totalCostNet * (markup / 100);
    revenueNet = totalCostNet + markupAmount + additionalCharges;
    revenueLabel = 'Cost + markup';
    revenueBreakdown = [
      { label: 'Internal cost (net)', value: totalCostNet },
      { label: `Markup (${markup}%)`, value: markupAmount },
      ...(additionalCharges > 0 ? [{ label: 'Delivery & task charges', value: additionalCharges }] : []),
    ];
  }

  const revenueVat = revenueNet * (vatRate / 100);
  const revenueGross = revenueNet + revenueVat;

  return {
    costs: {
      equipmentNet,
      equipmentVat,
      hotelRows,
      hotelNet,
      hotelVat,
      totalCostNet,
      totalCostVat,
      totalCostGross,
    },
    revenue: {
      method,
      net: revenueNet,
      vat: revenueVat,
      gross: revenueGross,
      label: revenueLabel,
      breakdown: revenueBreakdown,
    },
    additional: {
      deliveries: deliveryCharges,
      tasks: taskCharges,
      total: additionalCharges,
    },
    rotas,
  };
}