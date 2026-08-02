import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { pushToAssetPanda } from '../../shared/assetPandaPush.ts';

// Scheduled retry of failed Asset Panda pushes.
// Finds AssetReturnLog records where synced_to_panda is false and re-attempts
// the stock-level push. Runs on a schedule (every 30 min) via asServiceRole so
// it doesn't depend on a user session. Can also be invoked manually by an admin.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (service-role) and manual admin invocation.
    // When called from the frontend, verify admin auth. Scheduled runs have no
    // user session, so we skip the auth check when no user is present.
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    } catch (_) {
      // No user session (scheduled run) — proceed with service role.
    }

    // Find all return logs that haven't synced to Panda yet
    const pendingLogs = await base44.asServiceRole.entities.AssetReturnLog.filter({
      synced_to_panda: false,
    });

    if (pendingLogs.length === 0) {
      return Response.json({ success: true, retried: 0, message: 'No pending returns to sync.' });
    }

    let succeeded = 0;
    let stillFailing = 0;
    const errors = [];

    for (const log of pendingLogs) {
      // Collect panda asset IDs from the scanned items
      const pandaIds = (log.scanned_items || [])
        .map(item => item.panda_asset_id)
        .filter(Boolean);

      if (pandaIds.length === 0) {
        // No Panda IDs to push — mark as synced (nothing to do)
        await base44.asServiceRole.entities.AssetReturnLog.update(log.id, {
          synced_to_panda: true,
          synced_at: new Date().toISOString(),
          sync_error: '',
        });
        succeeded++;
        continue;
      }

      try {
        const result = await pushToAssetPanda(base44, pandaIds);
        if (result.success) {
          await base44.asServiceRole.entities.AssetReturnLog.update(log.id, {
            synced_to_panda: true,
            synced_at: new Date().toISOString(),
            sync_error: '',
          });
          succeeded++;
        } else if (result.attempted === false) {
          // Asset Panda not configured — don't keep retrying every 30 min;
          // leave the log pending and stop the whole run.
          return Response.json({
            success: true,
            retried: succeeded,
            skipped: pendingLogs.length - succeeded,
            message: 'Asset Panda not configured. Skipping retry.',
          });
        } else {
          await base44.asServiceRole.entities.AssetReturnLog.update(log.id, {
            sync_error: (result.errors || []).join('; ') || result.error || 'Push failed',
          });
          stillFailing++;
          errors.push(`Log ${log.id}: ${result.error || 'push failed'}`);
        }
      } catch (pushErr) {
        await base44.asServiceRole.entities.AssetReturnLog.update(log.id, {
          sync_error: pushErr.message,
        });
        stillFailing++;
        errors.push(`Log ${log.id}: ${pushErr.message}`);
      }
    }

    return Response.json({
      success: true,
      retried: succeeded,
      still_failing: stillFailing,
      total_pending: pendingLogs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}