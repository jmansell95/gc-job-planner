import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { loadProjectRateCardItems, resolveProjectCharge } from '../../shared/projectRateMatcher.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve the caller's staff profile to determine their system_role.
    // This is used to control what financial detail is returned — field staff
    // and supervisors get the charge amount (needed for entity saves) but NOT
    // the detailed rate breakdown, which is visible only to admins and managers.
    let systemRole = null;
    let isAdmin = user.role === 'admin';
    if (!isAdmin) {
      try {
        const staffList = await base44.entities.Staff.filter({ email: user.email });
        if (staffList.length > 0) {
          systemRole = staffList[0].system_role || null;
        }
      } catch (_) {}
    }
    const canViewCostings = isAdmin || systemRole === 'admin' || systemRole === 'manager';

    const body = await req.json();
    const {
      entity_type,       // 'delivery' | 'task' | 'investigation'
      billing_rule_id,   // explicit rule to use (optional)
      task_description,  // for matching task rules by name (optional)
      miles,             // for per-mile calculations
      duration_minutes,  // for per-hour calculations
      units,             // for per-unit calculations
      chargeable,        // if false, return 0
      custom_fee,         // if set, return this amount as override
      project_id,        // linked project — enables project rate card auto-pricing
      description,       // activity description — matched against project rate card
      quantity,          // qty for per-unit rate card items (metres, hours, etc.)
      job_date           // working date — for effective-dated rate resolution
    } = body;

    // Not chargeable — zero out
    if (chargeable === false) {
      return Response.json({
        charge_amount: 0,
        breakdown: { reason: 'not_chargeable', components: [], total: 0 },
        billing_status: 'no_charge'
      });
    }

    // Custom fee override
    if (custom_fee != null && custom_fee !== '') {
      const fee = Math.round((Number(custom_fee) || 0) * 100) / 100;
      return Response.json({
        charge_amount: fee,
        breakdown: { reason: 'custom_fee', components: [{ label: 'Custom fee', value: fee }], total: fee },
        billing_status: 'custom_fee'
      });
    }

    // Project rate card auto-pricing (e.g. the East West Rail schedule of rates).
    // When an investigation or task has a project_id and a description, look up the
    // matching RateCardItem for that project and price it directly — before falling
    // back to the generic BillingRule mechanism.
    if (project_id && description && (entity_type === 'investigation' || entity_type === 'task')) {
      const rateCardItems = await loadProjectRateCardItems(base44, project_id, job_date);
      const qty = Number(quantity ?? units) || 1;
      const match = resolveProjectCharge(String(description), rateCardItems, qty);
      if (match) {
        const breakdown = canViewCostings
          ? { source: 'project_rate_card', rate_card_item_id: match.rateCardItem.id, rate_card_item: match.rateCardItem.description, unit_price: match.unitPrice, quantity: match.quantity, total: match.total }
          : { total: match.total };
        return Response.json({
          charge_amount: match.total,
          breakdown,
          billing_status: 'auto',
        });
      }
    }

    // Find the billing rule
    let rule = null;
    if (billing_rule_id) {
      try {
        rule = await base44.entities.BillingRule.get(billing_rule_id);
      } catch (_e) { /* rule not found, try matching below */ }
    }

    // For tasks, match by name (case-insensitive) if no explicit rule
    if (!rule && entity_type === 'task' && task_description) {
      const taskRules = await base44.entities.BillingRule.filter({ rule_type: 'task', is_active: true });
      const matchKey = String(task_description).toLowerCase().trim();
      rule = taskRules.find(r => String(r.name || '').toLowerCase().trim() === matchKey);
    }

    // No matching rule or rule not chargeable
    if (!rule || !rule.is_chargeable) {
      return Response.json({
        charge_amount: 0,
        breakdown: { reason: 'no_matching_rule', components: [], total: 0 },
        billing_status: 'auto'
      });
    }

    // Extract rate values
    const flatFee = Number(rule.flat_fee) || 0;
    const mileRate = Number(rule.per_mile_rate) || 0;
    const hourRate = Number(rule.per_hour_rate) || 0;
    const unitRate = Number(rule.per_unit_rate) || 0;
    const actualMiles = Number(miles) || 0;
    const actualMins = Number(duration_minutes) || 0;
    const actualUnits = Number(units) || 1;
    const hours = actualMins / 60;

    let amount = 0;
    const components = [];

    switch (rule.charge_method) {
      case 'flat_fee':
        amount = flatFee;
        components.push({ label: 'Flat fee', value: flatFee });
        break;
      case 'per_mile':
        amount = mileRate * actualMiles;
        components.push({ label: `${actualMiles} miles × £${mileRate}/mi`, value: amount });
        break;
      case 'per_hour':
        amount = hourRate * hours;
        components.push({ label: `${hours.toFixed(1)}h × £${hourRate}/h`, value: amount });
        break;
      case 'per_unit':
        amount = unitRate * actualUnits;
        components.push({ label: `${actualUnits} ${rule.unit_label || 'units'} × £${unitRate}`, value: amount });
        break;
      case 'flat_plus_mileage': {
        const mileageCharge = mileRate * actualMiles;
        amount = flatFee + mileageCharge;
        components.push({ label: 'Flat fee', value: flatFee });
        components.push({ label: `${actualMiles} miles × £${mileRate}/mi`, value: mileageCharge });
        break;
      }
      case 'flat_plus_time': {
        const timeCharge = hourRate * hours;
        amount = flatFee + timeCharge;
        components.push({ label: 'Flat fee', value: flatFee });
        components.push({ label: `${hours.toFixed(1)}h × £${hourRate}/h`, value: timeCharge });
        break;
      }
      case 'flat_plus_mileage_plus_time': {
        const mileageCharge = mileRate * actualMiles;
        const timeCharge = hourRate * hours;
        amount = flatFee + mileageCharge + timeCharge;
        components.push({ label: 'Flat fee', value: flatFee });
        components.push({ label: `${actualMiles} miles × £${mileRate}/mi`, value: mileageCharge });
        components.push({ label: `${hours.toFixed(1)}h × £${hourRate}/h`, value: timeCharge });
        break;
      }
      default:
        amount = flatFee;
        components.push({ label: 'Flat fee', value: flatFee });
    }

    const chargeAmount = Math.round(amount * 100) / 100;

    // Security: only admins and managers receive the full breakdown with rate
    // details, rule names, and component labels. Other users get the charge
    // amount (needed for entity saves) but a redacted breakdown.
    const breakdown = canViewCostings
      ? { rule_name: rule.name, method: rule.charge_method, components, total: chargeAmount }
      : { total: chargeAmount };

    return Response.json({
      charge_amount: chargeAmount,
      breakdown,
      billing_rule_id: rule.id,
      billing_status: 'auto'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});