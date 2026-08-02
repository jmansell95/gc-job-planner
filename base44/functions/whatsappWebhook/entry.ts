import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue, updateAppSettingValue } from '../../shared/appSettings.ts';

// WhatsApp Business API webhook receiver — public endpoint (no user auth).
//
// GET  — Meta webhook verification: echoes back hub.challenge when the
//        verify token matches the configured webhook_secret.
// POST — Inbound message / delivery status events from Meta. We log the
//        receipt timestamp on the config record for the settings UI.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const config = await getAppSettingValue(base44, 'whatsapp_config');

    // --- GET: Meta webhook verification ---
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token && token === config.webhook_secret) {
        return new Response(challenge || '', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      return Response.json({ error: 'Verification failed' }, { status: 403 });
    }

    // --- POST: inbound message or status event ---
    const body = await req.json();

    await updateAppSettingValue(base44, 'whatsapp_config', 'WhatsApp Business API Configuration', {
      ...config,
      last_webhook_at: new Date().toISOString(),
    });

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}