import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ============================================================
// syncAssetCompliance — the smart compliance automation engine
// ============================================================
// Runs nightly (or on-demand from the Rig Hub) to:
//   1. Auto-calculate compliance_status from expiry dates
//      (expired < 0 days, expiring ≤ 30 days, compliant > 30 days)
//   2. Auto-calculate next_service_date from last_service_date +
//      the asset type's inspection cycle (6mo rigs, 12mo vehicles, etc.)
//   3. Auto-calculate maintenance_status from operating hours vs
//      service interval (or next_service_date for date-based assets)
//   4. Auto-deactivate assets with expired compliance (can't be assigned)
//   5. Reactivate assets when compliance is renewed
// Returns a summary of all changes so admins can audit what was updated.

const INSPECTION_CYCLE_MONTHS = {
  rig: 6,
  machinery: 6,
  trailer: 12,
  vehicle: 12,
  lifting: 6,
  portable_appliance: 12,
};

const DEFAULT_SERVICE_INTERVALS = {
  rig: 250,
  machinery: 500,
};

function autoComplianceStatus(expiryDate) {
  if (!expiryDate) return 'unknown';
  const d = new Date(expiryDate + 'T00:00:00');
  if (isNaN(d.getTime())) return 'unknown';
  const days = Math.floor((d - new Date(new Date().toDateString())) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'compliant';
}

function autoNextServiceDate(lastServiceDate, assetType) {
  if (!lastServiceDate) return null;
  const cycle = INSPECTION_CYCLE_MONTHS[assetType];
  if (!cycle) return null;
  const d = new Date(lastServiceDate + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + cycle);
  return d.toISOString().slice(0, 10);
}

function autoMaintenanceStatus(asset) {
  // Usage-based (rigs & machinery with service_interval_hours)
  if (asset.service_interval_hours) {
    const since = Number(asset.hours_since_last_service) || 0;
    const interval = Number(asset.service_interval_hours) || 0;
    if (interval === 0) return 'unknown';
    if (since >= interval) return 'overdue';
    if (since >= interval * 0.8) return 'due_soon';
    return 'ok';
  }
  // Date-based (vehicles, trailers, lifting, PAT)
  if (asset.next_service_date) {
    const d = new Date(asset.next_service_date + 'T00:00:00');
    if (isNaN(d.getTime())) return 'unknown';
    const days = Math.floor((d - new Date(new Date().toDateString())) / 86400000);
    if (days < 0) return 'overdue';
    if (days <= 30) return 'due_soon';
    return 'ok';
  }
  return 'unknown';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Allow service-role execution when invoked from a scheduled automation
    // (no user session), but require admin when called manually from the UI.
    let isAdmin = true;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
      if (!user) isAdmin = false; // scheduled — continue with service role
    } catch (_) { isAdmin = false; }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Load all assets
    const assets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);

    const updates = [];
    const changes = {
      compliance_status: 0,
      next_service_date: 0,
      maintenance_status: 0,
      deactivated: 0,
      reactivated: 0,
    };
    const details = [];

    for (const asset of assets) {
      const update: any = {};
      const changesList = [];

      // 1. Auto-calc compliance_status from expiry date
      if (asset.compliance_expiry_date) {
        const newStatus = autoComplianceStatus(asset.compliance_expiry_date);
        if (newStatus !== (asset.compliance_status || 'unknown')) {
          update.compliance_status = newStatus;
          changes.compliance_status++;
          changesList.push(`status: ${asset.compliance_status || 'unknown'} → ${newStatus}`);
        }
      }

      // 2. Auto-calc next_service_date from last_service_date + cycle
      if (asset.last_service_date && !asset.next_service_date) {
        const nextDate = autoNextServiceDate(asset.last_service_date, asset.asset_type);
        if (nextDate) {
          update.next_service_date = nextDate;
          changes.next_service_date++;
          changesList.push(`next_service: → ${nextDate}`);
        }
      }

      // 3. Auto-calc maintenance_status
      const newMaintStatus = autoMaintenanceStatus(asset);
      if (newMaintStatus !== (asset.maintenance_status || 'unknown')) {
        update.maintenance_status = newMaintStatus;
        changes.maintenance_status++;
        changesList.push(`maintenance: ${asset.maintenance_status || 'unknown'} → ${newMaintStatus}`);
      }

      // 4. Auto-deactivate expired assets (can't be assigned to jobs)
      if (update.compliance_status === 'expired' && asset.is_active !== false) {
        update.is_active = false;
        changes.deactivated++;
        changesList.push('deactivated (expired compliance)');
      }
      // 4b. Reactivate when compliance is renewed
      if ((update.compliance_status === 'compliant' || update.compliance_status === 'expiring') && asset.is_active === false) {
        update.is_active = true;
        changes.reactivated++;
        changesList.push('reactivated (compliance renewed)');
      }

      if (Object.keys(update).length > 0) {
        updates.push({ id: asset.id, name: asset.name, ...update });
        details.push({ id: asset.id, name: asset.name, asset_type: asset.asset_type, changes: changesList });
      }
    }

    // Apply updates in batches
    if (!dryRun && updates.length > 0) {
      for (let i = 0; i < updates.length; i += 400) {
        const batch = updates.slice(i, i + 400).map(u => {
          const { id, name, ...rest } = u;
          return { id, ...rest };
        });
        await base44.asServiceRole.entities.SiteAsset.bulkUpdate(batch);
      }
    }

    return Response.json({
      status: 'success',
      dry_run: dryRun,
      total_assets: assets.length,
      assets_updated: updates.length,
      changes,
      details: details.slice(0, 100),
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : (typeof error === 'string' ? error : 'Internal server error');
    return Response.json({ error: msg }, { status: 500 });
  }
}