import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Validates that a rig and all its linked tooling/equipment are compliance-
// safe before the rig can be assigned to a job. Returns the list of blocked
// (expired/missing-compliance) linked assets so the frontend can hard-stop
// the assignment.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const rigId = body.rig_id;
    if (!rigId) return Response.json({ error: 'rig_id is required' }, { status: 400 });

    const e = base44.asServiceRole.entities;
    const rig = await e.SiteAsset.get(rigId);
    if (!rig) return Response.json({ error: 'Rig not found' }, { status: 404 });

    const linkedIds = Array.isArray(rig.linked_equipment_ids) ? rig.linked_equipment_ids : [];
    const today = new Date().toISOString().slice(0, 10);

    // Check the rig itself
    const blocked = [];
    if (rig.compliance_status === 'expired') {
      blocked.push({ id: rig.id, name: rig.name, reason: 'Rig LOLER/compliance expired' });
    }
    if (rig.is_active === false) {
      blocked.push({ id: rig.id, name: rig.name, reason: 'Rig is inactive (out of stock or needs service)' });
    }

    // Check each linked tool/lifting asset (fetch individually — bulkGet is not in the SDK)
    if (linkedIds.length > 0) {
      for (const aid of linkedIds) {
        let asset;
        try { asset = await e.SiteAsset.get(aid); } catch (_) { continue; }
        if (!asset) continue;
        if (asset.is_active === false) {
          blocked.push({ id: asset.id, name: asset.name, reason: 'Inactive / out of service' });
        } else if (asset.compliance_status === 'expired') {
          blocked.push({ id: asset.id, name: asset.name, reason: 'Compliance expired' });
        } else if (asset.compliance_expiry_date && asset.compliance_expiry_date < today) {
          blocked.push({ id: asset.id, name: asset.name, reason: `Compliance expired on ${asset.compliance_expiry_date}` });
        }
      }
    }

    return Response.json({
      rig_id: rigId,
      rig_name: rig.name,
      blocked,
      can_assign: blocked.length === 0,
      checked_count: linkedIds.length + 1,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}