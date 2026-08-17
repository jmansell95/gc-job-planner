import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { pushSignOutToPanda } from '../../shared/assetPandaPush.ts';

/**
 * Push a sign-out (gear assigned to a job) to Asset Panda so the yard's
 * Panda dashboard shows the gear as 'Out on Job'.
 *
 * Payload: { panda_ids: string[], job_name?: string }
 * Called by the Equipment Sign-Out modal after creating local JobAssetAssignment records.
 * Any authenticated user can call this — field staff sign gear out.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pandaIds = Array.isArray(body?.panda_ids) ? body.panda_ids.filter(Boolean) : [];
    const jobName = body?.job_name || '';

    if (!pandaIds.length) {
      return Response.json({ attempted: false, reason: 'No Panda IDs provided' });
    }

    const result = await pushSignOutToPanda(base44, pandaIds, jobName);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});