import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';

// Creates a Stripe Checkout Session for a client-portal invoice payment.
// Called from the public client portal (no user auth) — validated via the
// job's portal_token, same as getJobByPortalToken.
//
// Payload: { portal_token, invoice_id }
// Returns: { url, session_id } — the frontend redirects to url.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { portal_token, invoice_id } = body;
    if (!portal_token || !invoice_id) {
      return Response.json({ error: 'portal_token and invoice_id are required' }, { status: 400 });
    }

    // Validate portal token → job
    const jobs = await base44.asServiceRole.entities.Job.filter({ portal_token });
    if (jobs.length === 0) return Response.json({ error: 'Invalid portal token' }, { status: 404 });
    const job = jobs[0];
    if (!job.portal_enabled) return Response.json({ error: 'Portal access is disabled' }, { status: 403 });

    // Fetch invoice and verify it belongs to this job
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: invoice_id });
    const invoice = invoices?.[0];
    if (!invoice || invoice.job_id !== job.id) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }
    if (invoice.status === 'paid') {
      return Response.json({ error: 'Invoice already paid' }, { status: 400 });
    }

    // Read Stripe config
    const stripeConfig = await getAppSettingValue(base44, 'stripe_config');
    if (!stripeConfig.secret_key) {
      return Response.json({ error: 'Stripe is not configured' }, { status: 500 });
    }
    if (!stripeConfig.portal_payments_enabled) {
      return Response.json({ error: 'Portal payments are not enabled' }, { status: 403 });
    }

    const currency = stripeConfig.currency || 'gbp';
    const amountPence = Math.round(Number(invoice.gross_total) * 100);

    // Build success/cancel URLs from the request origin
    const origin = new URL(req.url).origin;
    const successUrl = `${origin}/client-portal/${portal_token}?payment=success`;
    const cancelUrl = `${origin}/client-portal/${portal_token}?payment=cancelled`;

    // Create Stripe Checkout Session via REST API
    const formData = new URLSearchParams();
    formData.append('mode', 'payment');
    formData.append('line_items[0][price_data][currency]', currency);
    formData.append('line_items[0][price_data][product_data][name]', `Invoice ${invoice.invoice_number} — ${job.name}`);
    formData.append('line_items[0][price_data][unit_amount]', String(amountPence));
    formData.append('line_items[0][quantity]', '1');
    formData.append('metadata[invoice_id]', invoice.id);
    formData.append('metadata[portal_token]', portal_token);
    formData.append('success_url', successUrl);
    formData.append('cancel_url', cancelUrl);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || 'Stripe API error' }, { status: 502 });
    }

    return Response.json({ url: data.url, session_id: data.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}