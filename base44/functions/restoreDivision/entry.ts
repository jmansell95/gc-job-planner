import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * restoreDivision — restores a division's configuration from a snapshot checkpoint.
 *
 * Before restoring, automatically creates a pre-flight snapshot of the division's
 * current state (so the admin can undo the restore). Then rolls back the division's
 * configuration (settings, enabled_hubs, nav_items, landing_page) to the snapshot.
 *
 * The full data backup file remains available for download via the snapshot's
 * file_uri — in-app restore focuses on configuration; full data restore would
 * require manual re-import to preserve record IDs and referential integrity.
 *
 * Super-admin only.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { snapshot_id } = body;
    if (!snapshot_id) return Response.json({ error: 'snapshot_id required' }, { status: 400 });

    const sr = base44.asServiceRole;

    // 1. Get the snapshot
    const snapshot = await sr.entities.DivisionSnapshot.get(snapshot_id);
    if (!snapshot) return Response.json({ error: 'Snapshot not found' }, { status: 404 });
    if (snapshot.status !== 'completed') return Response.json({ error: 'Snapshot is not in a completed state' }, { status: 400 });

    // 2. Get the division
    const division = await sr.entities.Division.get(snapshot.division_id);
    if (!division) return Response.json({ error: 'Division no longer exists' }, { status: 404 });

    // 3. Create a pre-restore snapshot of the current state (undo safety net)
    let preRestoreSnapshotId = null;
    try {
      const entitiesToBackup = ['Staff', 'Job', 'Vehicle', 'RotaAssignment', 'Timesheet'];
      const backupData = {
        division: {
          name: division.name, code: division.code, division_type: division.division_type,
          settings: division.settings, enabled_hubs: division.enabled_hubs,
          nav_items: division.nav_items, landing_page: division.landing_page,
        },
        entities: {},
        timestamp: new Date().toISOString(),
        pre_restore_for: snapshot_id,
      };
      const entityCounts = {};
      let totalRecords = 0;
      for (const name of entitiesToBackup) {
        try {
          const items = await sr.entities[name].list('-created_date', 5000);
          const divisionItems = items.filter(i => i.division_id === snapshot.division_id);
          backupData.entities[name] = divisionItems.map(({ id, created_date, updated_date, created_by_id, ...rest }) => rest);
          entityCounts[name] = divisionItems.length;
          totalRecords += divisionItems.length;
        } catch (e) {
          entityCounts[name] = 0;
        }
      }
      const backupJson = JSON.stringify(backupData);
      const file = new File([backupJson], `pre-restore-${division.code || snapshot.division_id}-${Date.now()}.json`, { type: 'application/json' });
      const uploadResult = await sr.integrations.Core.UploadPrivateFile({ file });
      const preSnapshot = await sr.entities.DivisionSnapshot.create({
        division_id: snapshot.division_id,
        division_name: division.name,
        snapshot_type: 'pre_flight',
        status: 'completed',
        entity_counts: JSON.stringify(entityCounts),
        total_records: totalRecords,
        file_uri: uploadResult.file_uri,
        file_size_bytes: backupJson.length,
        division_config: JSON.stringify({
          settings: division.settings,
          enabled_hubs: division.enabled_hubs,
          nav_items: division.nav_items,
          landing_page: division.landing_page,
        }),
        created_by_name: user.full_name || user.email || 'Admin',
        trigger_reason: `Auto-backup before restore of snapshot ${snapshot_id}`,
      });
      preRestoreSnapshotId = preSnapshot.id;
    } catch (e) {
      // Pre-restore backup failed — warn but continue
      console.error('Pre-restore backup failed:', e.message);
    }

    // 4. Restore division configuration from snapshot
    let configRestored = false;
    try {
      const config = JSON.parse(snapshot.division_config || '{}');
      const updateData = {};
      if (config.settings) updateData.settings = config.settings;
      if (config.enabled_hubs) updateData.enabled_hubs = config.enabled_hubs;
      if (config.nav_items) updateData.nav_items = config.nav_items;
      if (config.landing_page) updateData.landing_page = config.landing_page;
      if (Object.keys(updateData).length > 0) {
        await sr.entities.Division.update(snapshot.division_id, updateData);
        configRestored = true;
      }
    } catch (e) {
      return Response.json({ error: 'Failed to restore configuration: ' + e.message, preRestoreSnapshotId }, { status: 500 });
    }

    // 5. Mark the source snapshot as restored
    await sr.entities.DivisionSnapshot.update(snapshot_id, {
      status: 'restored',
      restored_at: new Date().toISOString(),
      restored_by_name: user.full_name || user.email || 'Admin',
    });

    return Response.json({
      success: true,
      configRestored,
      preRestoreSnapshotId,
      message: preRestoreSnapshotId
        ? 'Division configuration restored. A pre-restore backup was created for safety.'
        : 'Division configuration restored. WARNING: pre-restore backup failed — no undo available.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}