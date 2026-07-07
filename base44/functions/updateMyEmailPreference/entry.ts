import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const enabled = body.enabled !== false;

    let staff = await base44.asServiceRole.entities.Staff.filter({ email: user.email });
    if (staff.length === 0 && user.id) {
      try { staff = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id }); } catch (_) {}
    }
    if (staff.length === 0) {
      return Response.json({ error: 'No staff profile found for this account' }, { status: 404 });
    }

    await base44.asServiceRole.entities.Staff.update(staff[0].id, { email_notifications_enabled: enabled });
    return Response.json({ success: true, email_notifications_enabled: enabled });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});