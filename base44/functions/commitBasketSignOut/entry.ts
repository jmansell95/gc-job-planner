import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Batch sign-out — creates JobAssetAssignment records for all scanned assets
 * in one call and pushes the sign-out to Asset Panda so the yard dashboard
 * shows the gear as 'Out on Job'.
 *
 * Payload: { asset_ids: string[], job_id, job_name, staff_id, staff_name, vehicle_id?, vehicle_name? }
 * Returns: { success, assignments_created, panda_push }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const assetIds = Array.isArray(body?.asset_ids) ? body.asset_ids.filter(Boolean) : [];
    const jobId = body?.job_id || '';
    const jobName = body?.job_name || '';
    const staffId = body?.staff_id || user.id;
    const staffName = body?.staff_name || user.full_name || '';
    const vehicleId = body?.vehicle_id || '';
    const vehicleName = body?.vehicle_name || '';

    if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 });
    if (assetIds.length === 0) return Response.json({ error: 'No assets to sign out' }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];

    // Fetch the actual SiteAsset records to denormalise into assignments
    const assets = await base44.entities.SiteAsset.filter({ id: { $in: assetIds } });
    const assetMap = {};
    for (const a of assets) assetMap[a.id] = a;

    // Build JobAssetAssignment records
    const records = assetIds.map(id => {
      const a = assetMap[id] || {};
      return {
        job_id: jobId,
        job_name: jobName,
        asset_id: id,
        asset_name: a.name || '',
        asset_type: a.asset_type || 'machinery',
        rig_type: a.rig_type || 'n/a',
        role: a.is_rig ? 'primary_rig' : a.asset_type === 'trailer' ? 'trailer' : a.asset_type === 'lifting' ? 'lifting' : 'machinery',
        compliance_status: a.compliance_status || 'unknown',
        status: 'on_site',
        assigned_date: today,
        arrived_on_site_date: today,
        vehicle_id: vehicleId || undefined,
        vehicle_name: vehicleName || undefined,
        notes: `Signed out via scanner by ${staffName}${vehicleName ? ` onto ${vehicleName}` : ''}`,
      };
    });

    await base44.entities.JobAssetAssignment.bulkCreate(records);

    // Update SiteAsset stock_level to out_of_stock for single-unit items
    const stockUpdates = assets
      .filter(a => (a.quantity_owned == null || a.quantity_owned <= 1))
      .map(a => ({ id: a.id, stock_level: 'out_of_stock', sync_status: 'pending' }));
    if (stockUpdates.length > 0) {
      try { await base44.entities.SiteAsset.bulkUpdate(stockUpdates); } catch (_) {}
    }

    // Push sign-out to Asset Panda (best-effort, non-blocking)
    let pandaResult = { attempted: false };
    const pandaIds = assets.map(a => a.panda_asset_id).filter(Boolean);
    if (pandaIds.length > 0) {
      try {
        pandaResult = await base44.functions.invoke('pushSignOutToPanda', {
          panda_ids: pandaIds,
          job_name: jobName,
        });
        pandaResult = pandaResult.data || pandaResult;
      } catch (e) {
        pandaResult = { attempted: true, success: false, error: e.message };
      }
    }

    return Response.json({
      success: true,
      assignments_created: records.length,
      panda_push: pandaResult,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});