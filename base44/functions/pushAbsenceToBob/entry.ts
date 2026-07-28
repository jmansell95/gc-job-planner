import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { bobAuthHeaders, pushSingleAbsenceToBob } from '../../shared/bobHrHelpers.ts';

// ============================================================
// pushAbsenceToBob — real-time push of a single approved absence
// to Bob HR (Hibob).
// ============================================================
// Triggered by an entity automation when an Absence record's status
// changes to 'approved' (and it originated in this app, not from Bob).
// Pushes immediately so Bob HR reflects approved leave without waiting
// for the nightly batch sync.
//
// Payload (from entity automation): { event: { type, entity_name, entity_id }, data: {...absence} }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Entity automations run without a user session — use service role.
    const body = await req.json().catch(() => ({}));
    const absenceId = body.event?.entity_id || body.data?.id || body.absence_id;
    if (!absenceId) return Response.json({ ok: false, error: 'No absence id provided' }, { status: 400 });

    const absence = body.data && body.data.id && !body.payload_too_large
      ? body.data
      : await base44.asServiceRole.entities.Absence.get(absenceId).catch(() => null);

    if (!absence) return Response.json({ ok: false, error: 'Absence not found' }, { status: 404 });

    // Only push app-created absences that are approved and not yet synced
    if (absence.status !== 'approved') {
      return Response.json({ ok: true, skipped: true, reason: 'not approved' });
    }
    if (absence.source === 'bob_hr') {
      return Response.json({ ok: true, skipped: true, reason: 'originated from Bob HR — no push needed' });
    }
    if (absence.bob_status === 'synced' && absence.bob_request_id) {
      return Response.json({ ok: true, skipped: true, reason: 'already synced' });
    }

    // Load Bob HR config
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'bob_hr_config' });
    const cfg = settings[0]?.value || {};
    if (!cfg.username || !cfg.api_token) {
      return Response.json({ ok: true, skipped: true, reason: 'Bob HR not configured' });
    }
    if (cfg.push_time_off === false) {
      return Response.json({ ok: true, skipped: true, reason: 'push disabled in settings' });
    }

    const apiUrl = (cfg.api_url || 'https://api.hibob.com/v1').replace(/\/$/, '');
    const headers = bobAuthHeaders(cfg.username, cfg.api_token);

    // Load the staff member
    const staffMember = await base44.asServiceRole.entities.Staff.get(absence.staff_id).catch(() => null);
    if (!staffMember) {
      return Response.json({ ok: false, error: 'Staff member not found' }, { status: 404 });
    }

    const result = await pushSingleAbsenceToBob(apiUrl, headers, absence, staffMember);

    if (result.ok) {
      await base44.asServiceRole.entities.Absence.update(absenceId, {
        bob_request_id: result.bobId,
        bob_status: 'synced',
      });
      return Response.json({ ok: true, pushed: true, bob_request_id: result.bobId });
    } else {
      // Mark as error so the nightly sync can retry
      await base44.asServiceRole.entities.Absence.update(absenceId, {
        bob_status: 'error',
      });
      return Response.json({ ok: false, error: result.error }, { status: 502 });
    }
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}