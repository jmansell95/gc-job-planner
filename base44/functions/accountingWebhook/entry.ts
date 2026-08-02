import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue, updateAppSettingValue } from '../../shared/appSettings.ts';

// Accounting (Xero / Sage) webhook receiver — public endpoint (no user auth).
//
// Xero sends webhook intent-verification requests as a POST with an
// `events` array; we echo it back to confirm receipt. Sage sends
// invoice-status-update events. Both are logged on the config record.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const config = await getAppSettingValue(base44, 'accounting_config');

    const body = await req.json();

    // Xero intent verification — respond with the events array
    if (body.events && Array.isArray(body.events)) {
      const summary = `Received ${body.events.length} webhook event(s) from ${config.provider || 'accounting'}`;
      await updateAppSettingValue(base44, 'accounting_config', 'Accounting Sync Configuration', {
        ...config,
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'ok',
        last_sync_summary: summary
      });
      return Response.json({ events: body.events });
    }

    // Generic acknowledgment for Sage or other providers
    await updateAppSettingValue(base44, 'accounting_config', 'Accounting Sync Configuration', {
      ...config,
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'ok',
      last_sync_summary: 'Webhook received'
    });

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}