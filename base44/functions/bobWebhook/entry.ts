import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// bobWebhook — receives real-time time-off events from Bob HR.
// ============================================================
// Bob HR can be configured (in their dashboard) to send webhook events to
// this endpoint when time-off requests are created/approved/updated.
// The shared secret (webhook_secret in AppSetting 'bob_hr_config') is used
// to verify authenticity — Bob sends it in the `X-Bob-Webhook-Secret` header
// or as a `?secret=` query param.
//
// Supported events:
//   • timeoff.request.created  — create a pending Absence record
//   • timeoff.request.approved — approve the matching Absence (or create one)
//   • timeoff.request.updated  — update dates/reason
//   • timeoff.request.cancelled — set status to rejected

import { mapReason, isApprovedStatus, isCancelledStatus } from '../../shared/bobHrHelpers.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // ── Verify shared secret ──
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'bob_hr_config' });
    const cfg = settings[0]?.value || {};
    const expectedSecret = cfg.webhook_secret || '';
    if (!expectedSecret) {
      return Response.json({ ok: false, error: 'Webhook secret not configured — set it in Settings → Bob HR Sync.' }, { status: 400 });
    }

    const url = new URL(req.url);
    const headerSecret = req.headers.get('X-Bob-Webhook-Secret') || '';
    const querySecret = url.searchParams.get('secret') || '';
    if (headerSecret !== expectedSecret && querySecret !== expectedSecret) {
      return Response.json({ ok: false, error: 'Invalid webhook secret' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const eventType = body.event || body.type || '';
    const data = body.data || body.payload || body;

    // Extract event details
    const bobId = String(data.id || data.requestId || data.request_id || '');
    const email = (data.employeeEmail || data.email || data.employee?.email || '').toLowerCase();
    const startDate = (data.startDate || data.start_date || '').slice(0, 10);
    const endDate = (data.endDate || data.end_date || '').slice(0, 10);
    const bobStatus = (data.status || data.approvalStatus || '').toLowerCase();
    const reason = mapReason(data.type || data.policyName || data.requestType || '');

    if (!bobId) {
      return Response.json({ ok: false, error: 'Missing request id in webhook payload' }, { status: 400 });
    }

    // Match staff by email
    if (!email) {
      return Response.json({ ok: false, error: 'Missing employee email — cannot match staff' }, { status: 400 });
    }
    const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
    const staffMember = allStaff.find((s: any) => (s.email || '').toLowerCase() === email);
    if (!staffMember) {
      return Response.json({ ok: false, error: `No staff member matches email ${email}` }, { status: 404 });
    }

    // Find existing Absence by bob_request_id
    let existingAbsences: any[] = [];
    try {
      existingAbsences = await base44.asServiceRole.entities.Absence.filter({ bob_request_id: bobId }, '-created_date', 10);
    } catch (_) {}
    const existing = existingAbsences[0];

    if (eventType.includes('cancelled') || isCancelledStatus(bobStatus)) {
      if (existing) {
        await base44.asServiceRole.entities.Absence.update(existing.id, { status: 'rejected' });
      }
      return Response.json({ ok: true, action: 'rejected', bob_request_id: bobId });
    }

    const isApproved = eventType.includes('approved') || isApprovedStatus(bobStatus);

    if (existing) {
      // Update existing record
      await base44.asServiceRole.entities.Absence.update(existing.id, {
        start_date: startDate || existing.start_date,
        end_date: endDate || existing.end_date,
        reason: reason || existing.reason,
        status: isApproved ? 'approved' : 'pending',
        bob_status: 'synced',
      });
      return Response.json({ ok: true, action: 'updated', id: existing.id });
    }

    // Create new absence from webhook
    await base44.asServiceRole.entities.Absence.create({
      staff_id: staffMember.id,
      start_date: startDate,
      end_date: endDate,
      reason,
      notes: `Bob HR webhook (${eventType || 'time-off event'})`,
      status: isApproved ? 'approved' : 'pending',
      bob_request_id: bobId,
      bob_status: 'synced',
      source: 'bob_hr',
    });

    return Response.json({ ok: true, action: 'created', bob_request_id: bobId });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}