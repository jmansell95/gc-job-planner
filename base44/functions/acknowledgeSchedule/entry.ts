import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const week_start = body.week_start;
    if (!week_start) return Response.json({ error: 'week_start is required' }, { status: 400 });

    let staff = await base44.entities.Staff.filter({ email: user.email });
    if (staff.length === 0 && user.id) {
      try { staff = await base44.entities.Staff.filter({ user_id: user.id }); } catch (_) {}
    }
    if (staff.length === 0) {
      return Response.json({ error: 'Staff profile not found' }, { status: 404 });
    }

    await base44.asServiceRole.entities.Staff.update(staff[0].id, {
      last_acknowledged_week: week_start
    });

    return Response.json({ success: true, week_start });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});