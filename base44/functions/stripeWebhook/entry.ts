import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue, updateAppSettingValue } from '../../shared/appSettings.ts';

// Stripe webhook receiver — public endpoint (no user auth).
// Verifies the Stripe-Signature header using Web Crypto HMAC-SHA256,
// then marks the referenced invoice as paid on checkout.session.completed
// or payment_intent.succeeded events.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const stripeConfig = await getAppSettingValue(base44, 'stripe_config');
    if (!stripeConfig.secret_key) {
      return Response.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('Stripe-Signature') || '';

    // Parse Stripe-Signature header: t=timestamp,v1=signature
    const sigParts = {};
    signature.split(',').forEach(p => {
      const idx = p.indexOf('=');
      if (idx > 0) sigParts[p.substring(0, idx)] = p.substring(idx + 1);
    });
    const timestamp = sigParts.t;
    const v1 = sigParts.v1;
    if (!timestamp || !v1) {
      return Response.json({ error: 'Invalid signature format' }, { status: 400 });
    }

    // Reject stale signatures (>5 min old)
    const ageMs = Date.now() - (parseInt(timestamp) * 1000);
    if (ageMs > 300000) {
      return Response.json({ error: 'Stale signature' }, { status: 400 });
    }

    // Compute HMAC-SHA256 of `${timestamp}.${rawBody}` with the webhook secret
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(stripeConfig.webhook_secret || ''),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
    const computedSig = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedSig !== v1) {
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Extract invoice_id from metadata
    let invoiceId = null;
    if (event.type === 'checkout.session.completed') {
      invoiceId = event.data?.object?.metadata?.invoice_id;
    } else if (event.type === 'payment_intent.succeeded') {
      invoiceId = event.data?.object?.metadata?.invoice_id;
    }

    // Mark invoice as paid if auto-mark is enabled
    if (invoiceId && stripeConfig.auto_mark_paid !== false) {
      const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (invoices?.[0] && invoices[0].status !== 'paid') {
        await base44.asServiceRole.entities.Invoice.update(invoices[0].id, {
          status: 'paid',
          paid_at: new Date().toISOString()
        });
      }
    }

    // Update webhook status on the config record
    await updateAppSettingValue(base44, 'stripe_config', 'Stripe Payment Gateway Configuration', {
      ...stripeConfig,
      last_webhook_at: new Date().toISOString(),
      last_webhook_status: 'ok',
      last_webhook_summary: `${event.type} — invoice ${invoiceId || 'N/A'}`
    });

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}