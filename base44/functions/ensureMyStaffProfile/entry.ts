import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildMyProfile } from '../../shared/staffProfile.ts';

/**
 * Explicit "ensure I have a crew profile" endpoint. Identical to
 * getMyStaffProfile (which also auto-provisions) — kept as a distinct
 * function so the "Create My Crew Profile" button expresses its intent
 * clearly and so admins can trigger a re-resolve on demand.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return Response.json(await buildMyProfile(base44, user));
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : (typeof error === 'string' ? error : 'Internal server error');
    return Response.json({ error: msg }, { status: 500 });
  }
}