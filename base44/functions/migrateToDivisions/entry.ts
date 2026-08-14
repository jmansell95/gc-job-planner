import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * migrateToDivisions — one-time migration that bootstraps the multi-division model.
 *
 * 1. Creates a default "Geotechnical" Division if none exists (so the current
 *    Geotechnical data has a home).
 * 2. Backfills `division_id` on every core entity record that is missing it
 *    (Staff, Job, Vehicle, RotaAssignment, Timesheet) with the Geotechnical
 *    division id — so all existing data is tagged to the Geotechnical division.
 *
 * Admin-only. Uses the service role to read/update every record regardless of
 * future RLS rules.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const sr = base44.asServiceRole;

    // 1. Ensure the default Geotechnical division exists.
    let divisions = await sr.entities.Division.list('-created_date', 100);
    let geotech = divisions.find(d => d.division_type === 'geotechnical' || (d.code || '').toUpperCase() === 'GEO');
    let divisionCreated = false;
    if (!geotech) {
      geotech = await sr.entities.Division.create({
        name: 'Geotechnical',
        code: 'GEO',
        division_type: 'geotechnical',
        description: 'Geotechnical investigation division — borehole drilling, sampling, laboratory testing and ground engineering.',
        color: '#2E5A1A',
        is_active: true,
        enabled_hubs: ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'investigation', 'compliance', 'billing', 'settings'],
        status: 'active',
        sort_order: 0,
      });
      divisionCreated = true;
    }
    const divisionId = geotech.id;

    // 2. Backfill division_id on core entities (only the ones that have the field).
    const entitiesToTag = ['Staff', 'Job', 'Vehicle', 'RotaAssignment', 'Timesheet'];
    const counts = {};

    for (const name of entitiesToTag) {
      const items = await sr.entities[name].list('-created_date', 5000);
      const untagged = items.filter(i => !i.division_id);
      let tagged = 0;
      // bulkUpdate in batches of 500
      for (let i = 0; i < untagged.length; i += 500) {
        const batch = untagged.slice(i, i + 500).map(item => ({ id: item.id, division_id: divisionId }));
        try {
          await sr.entities[name].bulkUpdate(batch);
          tagged += batch.length;
        } catch (e) {
          // fall back to single updates if bulk fails
          for (const item of batch) {
            try { await sr.entities[name].update(item.id, { division_id: divisionId }); tagged++; } catch {}
          }
        }
      }
      counts[name] = { total: items.length, tagged };
    }

    return Response.json({
      success: true,
      divisionId,
      divisionName: geotech.name,
      divisionCreated,
      counts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}