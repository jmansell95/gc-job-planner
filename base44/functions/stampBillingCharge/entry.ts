import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveRate, loadActiveContract } from '../../shared/rateResolver.ts';

// ============================================================
// stampBillingCharge — auto-stamps charge_amount + billing_rule_id
// ============================================================
// Triggered by entity automations on Timesheet, InvestigationLog,
// DeliveryLog and DailyCost CREATE events.
//
// Acts as a safety net: if a record was created without going through
// the interactive calculateCharge flow (e.g. via import, API, or a
// form that didn't call the charge endpoint), this fills in the
// charge so no billable work slips through with £0.
//
// Loop safety: only listens to 'create' events — the update it
// writes back does NOT re-trigger this function.

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const ENTITY_CONFIG: Record<string, {
  chargeFields: string[];
  ruleType: string;
  descriptionField: string;
}> = {
  Timesheet: { chargeFields: ['chargeable', 'billing_rule_id', 'charge_amount', 'charge_breakdown', 'billing_status'], ruleType: 'task', descriptionField: 'task_description' },
  InvestigationLog: { chargeFields: ['chargeable', 'billing_rule_id', 'charge_amount', 'charge_breakdown', 'billing_status'], ruleType: 'task', descriptionField: 'description' },
  DeliveryLog: { chargeFields: ['chargeable', 'billing_rule_id', 'charge_amount', 'charge_breakdown', 'billing_status'], ruleType: 'delivery', descriptionField: 'delivery_type' },
  DailyCost: { chargeFields: ['client_charge', 'amount_gross'], ruleType: 'consumable', descriptionField: 'description' },
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const event = body.event || {};
    const data = body.data || null;

    const entityId = event.entity_id || body.entity_id;
    const entityName = event.entity_name || body.entity_name;
    const action = event.type || body.action;

    if (!entityId || action !== 'create') {
      return Response.json({ ok: true, skipped: true, reason: 'not a create event' });
    }

    const config = ENTITY_CONFIG[entityName];
    if (!config) {
      return Response.json({ ok: true, skipped: true, reason: `entity ${entityName} not supported` });
    }

    // Fetch the record (data may be null if payload_too_large)
    let record = data;
    if (!record) {
      try {
        record = await base44.asServiceRole.entities[entityName].get(entityId);
      } catch (_) {
        return Response.json({ ok: false, error: 'Could not fetch record' }, { status: 500 });
      }
    }
    if (!record) {
      return Response.json({ ok: true, skipped: true, reason: 'record not found' });
    }

    // ── Skip if already stamped (interactive flow handled it) ──
    const hasCharge = Number(record.charge_amount) > 0 ||
      (entityName === 'DailyCost' && Number(record.client_charge) > 0) ||
      (record.billing_status === 'no_charge') ||
      (record.billing_status === 'custom_fee');
    if (hasCharge) {
      return Response.json({ ok: true, skipped: true, reason: 'charge already stamped' });
    }

    // ── DailyCost: calculate client_charge from markup (no rule matching) ──
    if (entityName === 'DailyCost') {
      const amountNet = Number(record.amount_net) || 0;
      const markupPct = Number(record.markup_percentage) || 0;
      const vatRate = Number(record.vat_rate) || 20;
      const clientCharge = round2(amountNet * (1 + markupPct / 100));
      const amountGross = round2(amountNet + (Number(record.amount_vat) || amountNet * vatRate / 100));
      try {
        await base44.asServiceRole.entities.DailyCost.update(entityId, {
          client_charge: clientCharge,
          amount_gross: amountGross,
        });
      } catch (e) { /* non-fatal */ }
      return Response.json({ ok: true, entity_id: entityId, stamped: true, client_charge: clientCharge });
    }

    // ── InvestigationLog: unified rate resolver (contract → project → global) ──
    if (entityName === 'InvestigationLog' && record.job_id) {
      try {
        const job = await base44.asServiceRole.entities.Job.get(record.job_id);
        if (job && record.description) {
          const activeContract = await loadActiveContract(base44.asServiceRole, record.job_id);
          const qty = Number(record.units_completed) ||
            ((Number(record.depth_to) || 0) - (Number(record.depth_from) || 0)) || 1;
          const resolved = await resolveRate(base44.asServiceRole, {
            job_id: record.job_id,
            project_id: job.project_id,
            description: String(record.description),
            quantity: qty,
            activeContract,
            job_date: record.log_date || job.start_date || null,
          });
          if (resolved) {
            const breakdown = {
              source: resolved.rate_source,
              rate_card_item_id: resolved.rate_card_item_id,
              unit_price: resolved.unit_price,
              quantity: resolved.quantity,
              total: resolved.total,
            };
            try {
              await base44.asServiceRole.entities.InvestigationLog.update(entityId, {
                chargeable: true,
                charge_amount: resolved.total,
                charge_breakdown: JSON.stringify(breakdown),
                billing_status: 'auto',
              });
            } catch (e) { /* non-fatal */ }
            // Trigger BOQ variation check after pricing a new investigation log
            try {
              await base44.asServiceRole.functions.invoke('checkBOQVariations', { job_id: record.job_id });
            } catch (_) { /* non-fatal — BOQ check runs independently */ }
            return Response.json({ ok: true, entity_id: entityId, stamped: true, source: resolved.rate_source, charge_amount: resolved.total });
          }
        }
      } catch (_) { /* job lookup failed — fall through to BillingRule */ }
    }

    // ── BillingRule matching (Timesheet, InvestigationLog, DeliveryLog) ──
    const descValue = String(record[config.descriptionField] || '').toLowerCase().trim();
    const rules = await base44.asServiceRole.entities.BillingRule.filter({
      rule_type: config.ruleType,
      is_active: true,
    });

    // Match by exact name (case-insensitive)
    let rule = rules.find((r: any) => String(r.name || '').toLowerCase().trim() === descValue);

    // For delivery_type matching, also try matching the delivery_type value
    if (!rule && entityName === 'DeliveryLog' && record.delivery_type) {
      rule = rules.find((r: any) => String(r.name || '').toLowerCase().trim() === String(record.delivery_type).toLowerCase());
    }

    // No matching rule — stamp as no_charge (chargeable=false, £0)
    if (!rule || !rule.is_chargeable) {
      try {
        await base44.asServiceRole.entities[entityName].update(entityId, {
          chargeable: false,
          charge_amount: 0,
          billing_status: 'no_charge',
          charge_breakdown: JSON.stringify({ reason: 'no_matching_rule', total: 0 }),
        });
      } catch (e) { /* non-fatal */ }
      return Response.json({ ok: true, entity_id: entityId, stamped: true, reason: 'no_matching_rule' });
    }

    // ── Calculate charge from the matched rule ──
    const flatFee = Number(rule.flat_fee) || 0;
    const mileRate = Number(rule.per_mile_rate) || 0;
    const hourRate = Number(rule.per_hour_rate) || 0;
    const unitRate = Number(rule.per_unit_rate) || 0;
    const miles = Number(record.miles) || 0;
    const durationMins = Number(record.duration_minutes) || Number(record.task_duration_minutes) || 0;
    const units = Number(record.units_completed) || 1;
    const hours = durationMins / 60;

    let amount = 0;
    const components: any[] = [];

    switch (rule.charge_method) {
      case 'flat_fee':
        amount = flatFee; components.push({ label: 'Flat fee', value: flatFee });
        break;
      case 'per_mile':
        amount = mileRate * miles; components.push({ label: `${miles} miles × £${mileRate}/mi`, value: amount });
        break;
      case 'per_hour':
        amount = hourRate * hours; components.push({ label: `${hours.toFixed(1)}h × £${hourRate}/h`, value: amount });
        break;
      case 'per_unit':
        amount = unitRate * units; components.push({ label: `${units} ${rule.unit_label || 'units'} × £${unitRate}`, value: amount });
        break;
      case 'flat_plus_mileage': {
        const mc = mileRate * miles;
        amount = flatFee + mc;
        components.push({ label: 'Flat fee', value: flatFee });
        components.push({ label: `${miles} miles × £${mileRate}/mi`, value: mc });
        break;
      }
      case 'flat_plus_time': {
        const tc = hourRate * hours;
        amount = flatFee + tc;
        components.push({ label: 'Flat fee', value: flatFee });
        components.push({ label: `${hours.toFixed(1)}h × £${hourRate}/h`, value: tc });
        break;
      }
      case 'flat_plus_mileage_plus_time': {
        const mc = mileRate * miles;
        const tc = hourRate * hours;
        amount = flatFee + mc + tc;
        components.push({ label: 'Flat fee', value: flatFee });
        components.push({ label: `${miles} miles × £${mileRate}/mi`, value: mc });
        components.push({ label: `${hours.toFixed(1)}h × £${hourRate}/h`, value: tc });
        break;
      }
      default:
        amount = flatFee; components.push({ label: 'Flat fee', value: flatFee });
    }

    const chargeAmount = round2(amount);
    const breakdown = { rule_name: rule.name, method: rule.charge_method, components, total: chargeAmount };

    try {
      await base44.asServiceRole.entities[entityName].update(entityId, {
        chargeable: true,
        billing_rule_id: rule.id,
        charge_amount: chargeAmount,
        charge_breakdown: JSON.stringify(breakdown),
        billing_status: 'auto',
      });
    } catch (e) { /* non-fatal */ }

    return Response.json({
      ok: true,
      entity_id: entityId,
      stamped: true,
      rule_name: rule.name,
      charge_amount: chargeAmount,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}