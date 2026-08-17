import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * backupDivision — creates a snapshot of a division's data and configuration.
 *
 * Reads all division-scoped entity records (Staff, Job, Vehicle, RotaAssignment,
 * Timesheet), serialises them to JSON, uploads the JSON as a private file, and
 * creates a DivisionSnapshot record pointing to it. Also captures the division's
 * configuration (settings, hubs, nav) so it can be rolled back on restore.
 *
 * Super-admin only. Supports a `snapshot_type` of 'manual', 'automatic', or
 * 'pre_flight' (auto-triggered before structural changes).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { division_id, snapshot_type = 'manual', trigger_reason = '' } = body;
    if (!division_id) return Response.json({ error: 'division_id required' }, { status: 400 });

    const sr = base44.asServiceRole;

    // 1. Get the division
    const division = await sr.entities.Division.get(division_id);
    if (!division) return Response.json({ error: 'Division not found' }, { status: 404 });

    // 2. Create snapshot record (status: creating)
    const snapshot = await sr.entities.DivisionSnapshot.create({
      division_id,
      division_name: division.name,
      snapshot_type,
      status: 'creating',
      created_by_name: user.full_name || user.email || 'Admin',
      trigger_reason,
    });

    try {
      // 3. Read all division-scoped entities
      const entitiesToBackup = ['Staff', 'Job', 'Vehicle', 'RotaAssignment', 'Timesheet'];
      const backupData = {
        division: {
          name: division.name,
          code: division.code,
          division_type: division.division_type,
          description: division.description,
          tagline: division.tagline,
          color: division.color,
          logo_url: division.logo_url,
          is_active: division.is_active,
          enabled_hubs: division.enabled_hubs,
          nav_items: division.nav_items,
          landing_page: division.landing_page,
          settings: division.settings,
          status: division.status,
          sort_order: division.sort_order,
        },
        entities: {},
        snapshot_id: snapshot.id,
        timestamp: new Date().toISOString(),
      };
      const entityCounts = {};
      let totalRecords = 0;

      for (const name of entitiesToBackup) {
        try {
          const items = await sr.entities[name].list('-created_date', 5000);
          const divisionItems = items.filter(i => i.division_id === division_id);
          // Strip internal fields to reduce file size
          backupData.entities[name] = divisionItems.map(({ id, created_date, updated_date, created_by_id, ...rest }) => rest);
          entityCounts[name] = divisionItems.length;
          totalRecords += divisionItems.length;
        } catch (e) {
          entityCounts[name] = 0;
        }
      }

      // 4. Upload as private file
      const backupJson = JSON.stringify(backupData);
      const fileName = `backup-${division.code || division_id}-${Date.now()}.json`;
      const file = new File([backupJson], fileName, { type: 'application/json' });
      const uploadResult = await sr.integrations.Core.UploadPrivateFile({ file });

      // 5. Update snapshot record
      const updated = await sr.entities.DivisionSnapshot.update(snapshot.id, {
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
      });

      return Response.json({
        success: true,
        snapshot_id: snapshot.id,
        division_name: division.name,
        counts: entityCounts,
        total_records: totalRecords,
        file_size_bytes: backupJson.length,
      });
    } catch (e) {
      await sr.entities.DivisionSnapshot.update(snapshot.id, {
        status: 'failed',
        notes: (e.message || 'Unknown error').slice(0, 500),
      });
      return Response.json({ error: e.message }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}