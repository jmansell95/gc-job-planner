import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Lists platform User records that have no linked Staff (crew) profile.
 * A user is "linked" if any Staff record matches by user_id OR email
 * (case-insensitive). Admin-only — returns 403 for non-admins.
 *
 * Also returns the full Staff list so the frontend can show link status
 * without a second round-trip.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [users, allStaff] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 500),
      base44.asServiceRole.entities.Staff.list('-created_date', 500),
    ]);

    const staffUserIds = new Set(allStaff.filter((s) => s.user_id).map((s) => s.user_id));
    const staffEmails = new Set(
      allStaff.filter((s) => s.email).map((s) => s.email.toLowerCase())
    );

    const unlinked = users.filter((u) => {
      if (u.id && staffUserIds.has(u.id)) return false;
      if (u.email && staffEmails.has(u.email.toLowerCase())) return false;
      return true;
    });

    return Response.json({
      unlinked: unlinked.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name || '',
        role: u.role || '',
        created_date: u.created_date || null,
      })),
      total: unlinked.length,
      staff: allStaff.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        user_id: s.user_id || null,
        team_id: s.team_id || null,
        job_title: s.job_title || null,
        worker_type: s.worker_type || null,
        is_active: s.is_active !== false,
        system_role: s.system_role || null,
        permission_group_id: s.permission_group_id || null,
        delivery_dashboard_enabled: s.delivery_dashboard_enabled === true,
        email_notifications_enabled: s.email_notifications_enabled !== false,
        phone: s.phone || null,
        date_of_birth: s.date_of_birth || null,
        ni_number: s.ni_number || null,
        avatar_url: s.avatar_url || null,
      })),
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : (typeof error === 'string' ? error : 'Internal server error');
    return Response.json({ error: msg }, { status: 500 });
  }
}