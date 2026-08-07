import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// zapierWebhook — exposes key system events as outbound webhooks
// for no-code automation with Zapier, Make (Integromat), n8n, etc.
//
// Events are fired by other backend functions calling this with
// a payload describing what happened. The function looks up
// registered webhook URLs from AppSetting and forwards the event.
//
// Payload: {
//   event: string (e.g. 'job.created', 'rota.published', 'timesheet.submitted'),
//   data: object (the event payload to forward),
//   entity_id?: string (optional related entity ID)
// }
// ============================================================

const EVENT_TYPES = [
  'job.created',
  'job.status_changed',
  'job.completed',
  'rota.published',
  'rota.assignment_created',
  'timesheet.submitted',
  'timesheet.approved',
  'delivery.completed',
  'invoice.generated',
  'invoice.paid',
  'compliance.expired',
  'maintenance.booking_created',
  'asset.returned',
];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { event, data, entity_id } = body;

    if (!event) return Response.json({ error: 'Missing event name' }, { status: 400 });

    // Load registered webhook URLs from AppSetting
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'zapier_webhooks' });
    const config = (settings as any[])[0]?.value || { webhooks: [] };
    const webhooks: Array<{ url: string; events: string[]; is_active: boolean }> = config.webhooks || [];

    const matchingWebhooks = webhooks.filter(w => w.is_active && w.url && (!w.events || w.events.length === 0 || w.events.includes(event)));

    if (matchingWebhooks.length === 0) {
      return Response.json({ ok: true, forwarded: 0, message: 'No matching webhooks registered' });
    }

    const payload = {
      event,
      entity_id: entity_id || null,
      data,
      timestamp: new Date().toISOString(),
      source: 'gc-mission-control',
    };

    const results = await Promise.allSettled(
      matchingWebhooks.map(w =>
        fetch(w.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      )
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return Response.json({
      ok: true,
      event,
      forwarded: succeeded,
      failed,
      total_webhooks: matchingWebhooks.length,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}