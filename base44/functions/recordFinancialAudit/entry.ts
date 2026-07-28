import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * recordFinancialAudit — invoked by entity automations on the locked financial
 * entities (RateCardItem, InvestigationSOR, BillingRule, AppSetting,
 * ExpensePreset, JobBillingContract). Captures a tamper-evident audit record
 * of every create/update/delete mutation into FinancialAuditLog.
 *
 * Payload (from entity automation):
 *   event: { type, entity_name, entity_id }
 *   data: current entity data (null if payload_too_large)
 *   old_data: previous data (update only)
 *   changed_fields: top-level fields that changed (update only)
 */
const LABEL_FIELDS = {
  RateCardItem: ['description', 'subcategory', 'price', 'price_text'],
  InvestigationSOR: ['description', 'sheet_name', 'price', 'price_text'],
  BillingRule: ['name', 'rule_type', 'charge_method', 'flat_fee', 'per_unit_rate'],
  AppSetting: ['key', 'label'],
  ExpensePreset: ['label', 'category', 'default_amount'],
  JobBillingContract: ['job_id', 'version', 'status', 'revenue_method'],
};

function summarize(entityName, data) {
  if (!data) return `${entityName} record`;
  const fields = LABEL_FIELDS[entityName] || [];
  const parts = [];
  for (const f of fields) {
    if (data[f] !== undefined && data[f] !== null && data[f] !== '') parts.push(String(data[f]));
    if (parts.length >= 3) break;
  }
  return parts.length ? `${entityName}: ${parts.join(' — ')}` : `${entityName} record`;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const event = body.event || {};
    const data = body.data || null;
    const oldData = body.old_data || null;
    const changedFields = body.changed_fields || [];

    const entityName = event.entity_name || body.entity_name;
    const entityId = event.entity_id || body.entity_id;
    const action = event.type || body.action;

    if (!entityName || !entityId || !action) {
      return Response.json({ ok: false, error: 'Missing event metadata' }, { status: 400 });
    }

    // If payload was too large, fetch the current record to summarise it
    let recordData = data;
    if (!recordData && action !== 'delete') {
      try {
        recordData = await base44.asServiceRole.entities[entityName]?.get?.(entityId);
      } catch (_) { recordData = null; }
    }

    // Compute field-level diff for updates
    let fieldChanges = null;
    if (action === 'update' && oldData) {
      const diff = {};
      const keys = changedFields.length ? changedFields : Object.keys(oldData);
      for (const k of keys) {
        if (k === 'updated_date' || k === 'created_date') continue;
        const before = oldData[k];
        const after = recordData ? recordData[k] : undefined;
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          diff[k] = { before, after };
        }
      }
      fieldChanges = Object.keys(diff).length ? JSON.stringify(diff) : null;
    }

    // Identify actor — prefer created_by_id (always present), fall back to updated_by
    const actorId = (recordData && (recordData.created_by_id || recordData.updated_by_id)) || null;

    await base44.asServiceRole.entities.FinancialAuditLog.create({
      entity_name: entityName,
      entity_id: entityId,
      action,
      changed_fields: action === 'update' ? changedFields : [],
      field_changes: fieldChanges,
      record_summary: action === 'delete' ? `${entityName} record (deleted)` : summarize(entityName, recordData),
      actor_user_id: actorId,
      actor_name: actorId ? actorId : 'system',
      source: 'entity_automation',
    });

    return Response.json({ ok: true, entity: entityName, action });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}