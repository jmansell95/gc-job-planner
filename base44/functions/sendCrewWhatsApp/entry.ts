import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendWhatsAppMessage, sendWhatsAppToStaff } from '../../shared/whatsappSend.ts';

// ============================================================
// sendCrewWhatsApp — sends a WhatsApp message to crew members.
// ============================================================
// Payload: {
//   action: "test" | "notify",
//   staff_ids?: string[],      // specific staff (notify)
//   team_id?: string,          // all staff in a team (notify)
//   job_id?: string,           // all staff assigned to a job today (notify)
//   message?: string,          // message body (notify) or test message
//   to?: string,               // single phone number (test)
// }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'test';

    // --- Test mode: send a single test message ---
    if (action === 'test') {
      const to = body.to || '';
      const message = body.message || 'GC Mission Control — WhatsApp test message. If you received this, crew notifications are working.';
      if (!to) return Response.json({ ok: false, error: 'Provide a phone number in the "to" field.' }, { status: 400 });

      const result = await sendWhatsAppMessage(base44, to, message);
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }

    // --- Notify mode: send to selected staff / team / job crew ---
    if (action === 'notify') {
      const message = body.message;
      if (!message || !message.trim()) {
        return Response.json({ ok: false, error: 'Message body is required.' }, { status: 400 });
      }

      let recipients: any[] = [];

      // By staff IDs
      if (body.staff_ids && Array.isArray(body.staff_ids) && body.staff_ids.length > 0) {
        const all = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
        recipients = all.filter(s => body.staff_ids.includes(s.id));
      }

      // By team
      if (body.team_id) {
        const all = await base44.asServiceRole.entities.Staff.filter({ team_id: body.team_id, is_active: true }, '-created_date', 200);
        recipients = [...recipients, ...all];
      }

      // By job (staff assigned today)
      if (body.job_id) {
        const today = new Date().toISOString().slice(0, 10);
        const rotas = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: body.job_id, assigned_date: today }, '-created_date', 100);
        const staffIds = [...new Set(rotas.map(r => r.staff_id).filter(Boolean))];
        if (staffIds.length > 0) {
          const all = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
          recipients = [...recipients, ...all.filter(s => staffIds.includes(s.id))];
        }
      }

      // De-duplicate by staff id
      const seen = new Set();
      recipients = recipients.filter(s => {
        if (!s.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return s.is_active !== false;
      });

      if (recipients.length === 0) {
        return Response.json({ ok: false, error: 'No active staff found for the selected recipients.' }, { status: 400 });
      }

      const results = await sendWhatsAppToStaff(base44, recipients, message);
      const successCount = results.filter(r => r.ok).length;
      const failCount = results.filter(r => !r.ok).length;

      // Update last sync status on the config
      const configRec = await base44.asServiceRole.entities.AppSetting.filter({ key: 'whatsapp_config' }, '-created_date', 1);
      if (configRec?.[0]) {
        const cfg = configRec[0].value || {};
        await base44.asServiceRole.entities.AppSetting.update(configRec[0].id, {
          value: {
            ...cfg,
            last_sync_at: new Date().toISOString(),
            last_sync_status: failCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed'),
            last_sync_summary: `Sent to ${successCount} of ${recipients.length} crew (${failCount} failed)`,
          },
        });
      }

      return Response.json({
        ok: failCount === 0,
        total: recipients.length,
        success: successCount,
        failed: failCount,
        results,
      });
    }

    return Response.json({ ok: false, error: 'Unknown action. Use "test" or "notify".' }, { status: 400 });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}