import { base44 } from '@/api/base44Client';

/**
 * Close any open ComplianceTask (recert) records for an asset, called after a
 * passing inspection is logged. Idempotent — no-op when there are no open tasks.
 * Returns the number of tasks closed.
 */
export async function closeOpenRecertTasks(assetId, reason = 'passing_inspection_logged') {
  if (!assetId) return 0;
  try {
    const open = await base44.entities.ComplianceTask.filter({
      site_asset_id: assetId,
      status: 'open',
    });
    if (!open || open.length === 0) return 0;
    const now = new Date().toISOString();
    await base44.entities.ComplianceTask.bulkUpdate(
      open.map(t => ({ id: t.id, status: 'done', closed_at: now, closed_reason: reason }))
    );
    return open.length;
  } catch (e) {
    console.error('closeOpenRecertTasks error:', e);
    return 0;
  }
}