import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Shift differential automation — calculates night shift, weekend, and bank
// holiday pay multipliers for rota assignments. Returns the applicable rate
// multiplier for a given date + shift times, so timesheets can auto-apply the
// correct pay enhancement without manual tagging.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { date, start_time, end_time, staff_id } = body;
    if (!date) return Response.json({ error: 'date is required' }, { status: 400 });

    // Fetch bank holidays to check if this date is one
    const bankHolidays = await base44.asServiceRole.entities.BankHoliday.filter({ date });
    const isBankHoliday = bankHolidays.length > 0;

    const dayOfWeek = new Date(date + 'T00:00:00').getDay(); // 0=Sun, 6=Sat
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;

    // Fetch overtime rates to find applicable multipliers
    const overtimeRates = await base44.asServiceRole.entities.OvertimeRate.list();
    const rates = overtimeRates || [];

    // Determine the applicable multiplier
    let multiplier = 1.0;
    let rateType = 'standard';
    let reason = 'Standard weekday day rate';

    if (isBankHoliday) {
      // Bank holiday — check for a bank holiday rate
      const bhRate = rates.find(r => r.day_type === 'bank_holiday');
      multiplier = bhRate?.multiplier || 2.0;
      rateType = 'bank_holiday';
      reason = `Bank holiday rate (${multiplier}x)`;
    } else if (isSunday) {
      const sunRate = rates.find(r => r.day_type === 'sunday');
      multiplier = sunRate?.multiplier || 2.0;
      rateType = 'sunday';
      reason = `Sunday rate (${multiplier}x)`;
    } else if (isSaturday) {
      const satRate = rates.find(r => r.day_type === 'saturday');
      multiplier = satRate?.multiplier || 1.5;
      rateType = 'saturday';
      reason = `Saturday rate (${multiplier}x)`;
    }

    // Check for night shift (any work between 00:00–06:00 or 20:00–24:00)
    let isNightShift = false;
    if (start_time && end_time) {
      const [sh] = start_time.split(':').map(Number);
      const [eh] = end_time.split(':').map(Number);
      // Night shift if start >= 20:00 or end <= 06:00
      if (sh >= 20 || eh <= 6 || (sh >= 0 && eh <= 6)) {
        isNightShift = true;
        const nightRate = rates.find(r => r.day_type === 'night');
        const nightMultiplier = nightRate?.multiplier || 1.33;
        // Use the higher of the day rate or night rate
        if (nightMultiplier > multiplier) {
          multiplier = nightMultiplier;
          rateType = 'night';
          reason = `Night shift rate (${multiplier}x)`;
        }
      }
    }

    // If staff_id provided, check their personal rate
    let staffRate = null;
    if (staff_id) {
      const staffRates = rates.filter(r => r.staff_id === staff_id);
      const matching = staffRates.find(r => r.day_type === rateType);
      if (matching) {
        multiplier = matching.multiplier;
        reason = `Personal ${rateType} rate (${multiplier}x)`;
        staffRate = matching;
      }
    }

    return Response.json({
      ok: true,
      date,
      start_time,
      end_time,
      is_bank_holiday: isBankHoliday,
      is_saturday: isSaturday,
      is_sunday: isSunday,
      is_night_shift: isNightShift,
      rate_type: rateType,
      multiplier,
      reason,
      staff_rate: staffRate,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}