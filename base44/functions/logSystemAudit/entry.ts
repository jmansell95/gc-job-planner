import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * logSystemAudit — invoked by entity automations on critical entities to
 * capture a tamper-evident audit record with SHA-256 record hashing and
 * chain linking (previous_hash). This is the ISO 27001 non-repudiation layer.
 *
 * Can also be called directly with action='manual' for ad-hoc audit entries.
 *
 * Payload (from entity automation):
 *   event: { type, entity_name, entity_id }
 *   data: current entity data (null if payload_too_large)
 *   old_data: previous data (update only)
 *   changed_fields: top-level fields that changed (update only)
 *
 * Direct call payload:
 *   { entity_name, entity_id, action, data, old_data, changed_fields, source, actor_name }
 */

const LABEL_FIELDS: Record<string, string[]> = {
  Job: ['name', 'job_reference', 'location', 'status'],
  RateCardItem: ['description', 'subcategory', 'price', 'price_text'],
  InvestigationSOR: ['description', 'sheet_name', 'price', 'price_text'],
  BillingRule: ['name', 'rule_type', 'charge_method', 'flat_fee', 'per_unit_rate'],
  JobBillingContract: ['job_id', 'version', 'status', 'revenue_method'],
  LabTestResult: ['test_type', 'result_value_primary', 'result_unit', 'review_status'],
  InvestigationLog: ['log_type', 'borehole_ref', 'strata_descriptor', 'manager_review_status'],
  Sample: ['sample_id', 'sample_type', 'status', 'borehole_ref'],
  Contractor: ['name', 'onboarding_status', 'cis_status'],
  Invoice: ['invoice_number', 'status', 'gross_total'],
  SystemAuditLog: ['entity_name', 'action', 'record_summary'],
};

function summarize(entityName: string, data: any): string {
  if (!data) return `${entityName} record`;
  const fields = LABEL_FIELDS[entityName] || [];
  const parts: string[] = [];
  for (const f of fields) {
    if (data[f] !== undefined && data[f] !== null && data[f] !== '') {
      parts.push(String(data[f]));
    }
    if (parts.length >= 3) break;
  }
  return parts.length ? `${entityName}: ${parts.join(' — ')}` : `${entityName} record`;
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

    // If payload was too large, fetch the current record
    let recordData = data;
    if (!recordData && action !== 'delete') {
      try {
        recordData = await base44.asServiceRole.entities[entityName]?.get?.(entityId);
      } catch (_) { recordData = null; }
    }

    // Compute field-level diff for updates
    let fieldChanges: string | null = null;
    if (action === 'update' && oldData) {
      const diff: Record<string, any> = {};
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

    // Compute SHA-256 hash of the record content
    const hashPayload = recordData ? JSON.stringify(recordData) : `${entityName}:${entityId}:${action}`;
    const recordHash = await sha256(hashPayload);

    // Find the previous audit entry for this entity to chain the hash
    const prevEntries = await base44.asServiceRole.entities.SystemAuditLog
      .filter({ entity_name: entityName, entity_id: entityId }, '-created_date', 1)
      .catch(() => []);
    const previousHash = prevEntries.length > 0 ? (prevEntries[0].record_hash || '') : '';

    // Identify actor
    const actorId = (recordData && (recordData.created_by_id || recordData.updated_by_id)) || body.actor_user_id || null;
    const actorName = body.actor_name || actorId || 'system';
    const source = body.source || 'entity_automation';

    await base44.asServiceRole.entities.SystemAuditLog.create({
      entity_name: entityName,
      entity_id: entityId,
      action,
      changed_fields: action === 'update' ? changedFields : [],
      field_changes: fieldChanges,
      record_summary: action === 'delete' ? `${entityName} record (deleted)` : summarize(entityName, recordData),
      record_hash: recordHash,
      previous_hash: previousHash,
      actor_user_id: actorId,
      actor_name: actorName,
      actor_ip: body.actor_ip || null,
      source,
      integrity_status: 'valid',
    });

    return Response.json({ ok: true, entity: entityName, action, record_hash: recordHash });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}