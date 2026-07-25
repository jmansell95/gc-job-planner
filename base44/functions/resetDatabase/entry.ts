import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { WIPE_ENTITIES } from '../../shared/demoData.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const results = {};

    for (const entityName of WIPE_ENTITIES) {
      try {
        const entity = base44.asServiceRole.entities[entityName];
        if (!entity || typeof entity.deleteMany !== 'function') {
          results[entityName] = 'skipped (no deleteMany)';
          continue;
        }
        await entity.deleteMany({});
        results[entityName] = 'deleted';
      } catch (err) {
        results[entityName] = `error: ${err.message}`;
      }
    }

    return Response.json({
      success: true,
      message: 'All operational data has been wiped. Configurations, sync settings, and user accounts are preserved.',
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});