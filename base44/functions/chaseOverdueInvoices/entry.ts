import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { styledHtml, escapeHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// Automated invoice chasing — sends escalating reminder emails for overdue invoices.
// Escalation schedule:
//   7-14 days overdue  → reminder_1 (friendly nudge)
//   15-28 days overdue → reminder_2 (firmer, mentions late payment interest)
//   29+ days overdue   → final_notice (final notice before debt collection)
// Reminders are spaced at least 7 days apart. Runs on a schedule (admin-only).

const STAGE_CONFIG = {
  reminder_1: {
    subject: 'Payment Reminder: Invoice {INV} — {CLIENT}',
    heading: 'Friendly Payment Reminder',
    body: 'We hope this email finds you well. This is a friendly reminder that payment for invoice <strong>{INV}</strong> is now overdue. The total outstanding amount is <strong>£{AMOUNT}</strong>, originally due on <strong>{DUE_DATE}</strong>.<br/><br/>If you have already sent payment, please disregard this notice. If you have any questions about this invoice, please don\'t hesitate to contact us.',
  },
  reminder_2: {
    subject: 'Second Notice: Invoice {INV} — {CLIENT}',
    heading: 'Second Payment Notice',
    body: 'We are writing to follow up on invoice <strong>{INV}</strong> which remains unpaid. The outstanding amount of <strong>£{AMOUNT}</strong> was due on <strong>{DUE_DATE}</strong>.<br/><br/>Please arrange payment at your earliest convenience to avoid any disruption to services. If payment has already been made, please send proof of payment so we can update our records.',
  },
  final_notice: {
    subject: 'FINAL NOTICE: Invoice {INV} — {CLIENT}',
    heading: 'Final Notice — Action Required',
    body: 'This is our final notice regarding invoice <strong>{INV}</strong> with an outstanding balance of <strong>£{AMOUNT}</strong>, which was due on <strong>{DUE_DATE}</strong>.<br/><br/>Despite previous reminders, payment has not yet been received. Please arrange payment within 7 days. If we do not receive payment, we may need to escalate this matter to our debt recovery process.<br/><br/>If you are experiencing payment difficulties, please contact us immediately to discuss a payment plan.',
  },
};

function daysOverdue(dueDate, today) {
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
}

function determineStage(daysOver, currentStage) {
  if (daysOver >= 29) return 'final_notice';
  if (daysOver >= 15) return 'reminder_2';
  if (daysOver >= 7) return 'reminder_1';
  return null;
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const today = new Date().toISOString().split('T')[0];
    const baseUrl = await getAppBaseUrl(base44);

    // Fetch all overdue invoices
    const overdueInvoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'overdue' });

    // Fetch clients for contact emails
    const clientIds = [...new Set(overdueInvoices.map(i => i.client_id).filter(Boolean))];
    const clients = clientIds.length > 0
      ? await base44.asServiceRole.entities.Client.filter({ id: { $in: clientIds } })
      : [];
    const clientMap = new Map(clients.map(c => [c.id, c]));

    let sent = 0;
    let skipped = 0;
    const results = [];

    for (const inv of overdueInvoices) {
      const days = daysOverdue(inv.due_date, today);
      const targetStage = determineStage(days, inv.chase_stage);
      if (!targetStage) { skipped++; continue; }

      // Skip if already at or past this stage and last chase was < 7 days ago
      const stageOrder = ['none', 'reminder_1', 'reminder_2', 'final_notice'];
      const currentStageIdx = stageOrder.indexOf(inv.chase_stage || 'none');
      const targetStageIdx = stageOrder.indexOf(targetStage);
      if (targetStageIdx <= currentStageIdx) {
        // Already sent this stage — check if enough time passed for re-send
        if (inv.last_chase_at) {
          const lastChase = new Date(inv.last_chase_at);
          const daysSinceChase = Math.floor((new Date() - lastChase) / (1000 * 60 * 60 * 24));
          if (daysSinceChase < 7) { skipped++; continue; }
        } else {
          skipped++;
          continue;
        }
      }

      const config = STAGE_CONFIG[targetStage];
      const client = clientMap.get(inv.client_id);
      const clientEmail = client?.contact_email || '';

      const amount = formatMoney(inv.gross_total || inv.net_total || 0);
      const bodyHtml = config.body
        .replace(/\{INV\}/g, escapeHtml(inv.invoice_number))
        .replace(/\{AMOUNT\}/g, amount)
        .replace(/\{DUE_DATE\}/g, escapeHtml(inv.due_date || '—'));

      const subject = config.subject
        .replace(/\{INV\}/g, inv.invoice_number)
        .replace(/\{CLIENT\}/g, inv.client_name || '');

      const fullHtml = styledHtml(
        `<h2 style="margin:0 0 16px;color:#2E5A1A;font-size:16px;font-family:Arial,Helvetica,sans-serif">${escapeHtml(config.heading)}</h2>` +
        `<p style="margin:0 0 12px;color:#64748b;font-size:13px">Invoice: <strong>${escapeHtml(inv.invoice_number)}</strong> · Client: <strong>${escapeHtml(inv.client_name || '')}</strong></p>` +
        `<div style="color:#1e293b;font-size:14px;line-height:1.6">${bodyHtml}</div>` +
        `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>` +
        `<p style="color:#64748b;font-size:12px">This is an automated reminder from GC Mission Control. Please reply to this email if you have any questions.</p>`
      );

      // Try sending to the client contact email
      let emailSent = false;
      if (clientEmail) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: clientEmail,
            subject,
            body_html: fullHtml,
          });
          emailSent = true;
        } catch (e) {
          // Client email not a registered user — fall through to admin notification
        }
      }

      // Always notify the admin team about the chase (so they have a record)
      const adminSubject = emailSent
        ? `[Chase Sent] ${targetStage.replace('_', ' ')}: ${inv.invoice_number} — ${inv.client_name}`
        : `[Action Needed] ${targetStage.replace('_', ' ')}: ${inv.invoice_number} — ${inv.client_name || 'Unknown client'}`;
      const adminBody = emailSent
        ? `<p>A ${targetStage.replace('_', ' ')} reminder was automatically sent to <strong>${escapeHtml(clientEmail)}</strong> for invoice <strong>${escapeHtml(inv.invoice_number)}</strong>.</p><p>Outstanding: <strong>£${amount}</strong> · Due: ${escapeHtml(inv.due_date || '—')} · ${days} days overdue</p>`
        : `<p>Invoice <strong>${escapeHtml(inv.invoice_number)}</strong> is <strong>${days} days overdue</strong> but no client email is on file (or the email is not a registered user).</p><p>Please contact <strong>${escapeHtml(inv.client_name || 'the client')}</strong> manually to chase payment of <strong>£${amount}</strong>.</p><div style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:8px;font-size:13px"><strong>Email content for manual forwarding:</strong><br/><br/>Subject: ${escapeHtml(subject)}<br/><br/>${bodyHtml}</div>`;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: adminSubject,
          body_html: styledHtml(adminBody),
        });
      } catch (e) { /* non-fatal */ }

      // Update the invoice chase tracking
      await base44.asServiceRole.entities.Invoice.update(inv.id, {
        chase_stage: targetStage,
        chase_count: (inv.chase_count || 0) + 1,
        last_chase_at: new Date().toISOString(),
      });

      sent++;
      results.push({
        invoice: inv.invoice_number,
        client: inv.client_name,
        stage: targetStage,
        days_overdue: days,
        amount: inv.gross_total || inv.net_total,
        email_sent_to_client: emailSent,
      });
    }

    return Response.json({
      success: true,
      checked: overdueInvoices.length,
      sent,
      skipped,
      date: today,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}