import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { styledHtml, escapeHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// ============================================================
// generateMonthlyStatements
// ============================================================
// Generates a per-client monthly statement summarising every invoice
// raised in the chosen month (issued / paid / outstanding / overdue),
// and emails each client's statement to their contact_email.
//
// SendEmail only reaches REGISTERED app users. When a client's contact
// isn't registered the direct send fails gracefully and the statement
// is emailed to the requesting admin instead (so they can forward it).
//
// Triggered on demand from the Billing → Statements panel, and by a
// scheduled automation that runs on the 1st of each month.

const gbp = (n) => '£' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function monthRange(month) {
  // month = "YYYY-MM"
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  return { startISO: start.toISOString(), endISO: end.toISOString(), startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

function fmtMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function statementHtml({ client, month, monthLabel, invoices, companyName, baseUrl, year, monthNum }) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = invoices.map((inv, i) => {
    const overdue = inv.status === 'sent' && inv.due_date && inv.due_date < today;
    const badge = inv.status === 'paid'
      ? '<span style="color:#047857;font-weight:700">Paid</span>'
      : inv.status === 'sent'
        ? (overdue ? '<span style="color:#dc2626;font-weight:700">Overdue</span>' : '<span style="color:#2563eb;font-weight:700">Sent</span>')
        : inv.status === 'void'
          ? '<span style="color:#94a3b8;text-decoration:line-through">Void</span>'
          : '<span style="color:#64748b">Draft</span>';
    return '<tr>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">' + (i + 1) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600">' + escapeHtml(inv.invoice_number) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">' + escapeHtml(inv.job_name || '—') + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">' + (inv.issue_date || '—') + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">' + (inv.due_date || '—') + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">' + badge + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#2E5A1A">' + gbp(inv.gross_total) + '</td>' +
      '</tr>';
  }).join('');

  const totalGross = invoices.filter((i) => i.status !== 'void').reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
  const outstanding = invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
  const overdueAmt = invoices.filter((i) => i.status === 'sent' && i.due_date && i.due_date < today).reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

  const totalsBlock =
    '<table style="width:100%;margin-top:20px;border-collapse:collapse">' +
    '<tr><td style="padding:8px 12px;background:#f1f5f9;border-radius:6px 0 0 6px;font-size:12px;color:#475569">Total Invoiced</td><td style="padding:8px 12px;background:#f1f5f9;text-align:right;font-weight:700">' + gbp(totalGross) + '</td></tr>' +
    '<tr><td style="padding:8px 12px;font-size:12px;color:#475569">Received / Paid</td><td style="padding:8px 12px;text-align:right;color:#047857;font-weight:600">' + gbp(totalPaid) + '</td></tr>' +
    '<tr><td style="padding:8px 12px;font-size:12px;color:#475569">Outstanding</td><td style="padding:8px 12px;text-align:right;color:#2563eb;font-weight:600">' + gbp(outstanding) + '</td></tr>' +
    (overdueAmt > 0 ? '<tr><td style="padding:8px 12px;font-size:12px;color:#dc2626;font-weight:600">Overdue</td><td style="padding:8px 12px;text-align:right;color:#dc2626;font-weight:700">' + gbp(overdueAmt) + '</td></tr>' : '') +
    '<tr><td style="padding:10px 12px;border-top:2px solid #2E5A1A;font-size:13px;font-weight:800;color:#2E5A1A">Balance Due</td><td style="padding:10px 12px;border-top:2px solid #2E5A1A;text-align:right;font-size:15px;font-weight:800;color:#2E5A1A">' + gbp(outstanding) + '</td></tr>' +
    '</table>';

  const intro = '<p style="margin:0 0 14px">Dear ' + escapeHtml(client.contact_name || client.name) + ',</p>' +
    '<p style="margin:0 0 16px">Please find below your statement for <strong>' + escapeHtml(monthLabel) + '</strong>. It summarises all invoices raised during this period.</p>';

  const invTable =
    '<table style="width:100%;border-collapse:collapse;margin-top:8px">' +
    '<thead><tr style="background:#f8fafc">' +
    '<th style="text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:2px solid #e2e8f0">#</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Invoice</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Job</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Issued</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Due</th>' +
    '<th style="text-align:center;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Status</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:2px solid #e2e8f0">Amount</th>' +
    '</tr></thead><tbody>' + (rows || '<tr><td colspan="7" style="padding:14px;text-align:center;color:#94a3b8">No invoices this period</td></tr>') + '</tbody></table>';

  const body =
    '<p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8">Statement</p>' +
    '<h2 style="margin:0 0 4px;color:#2E5A1A">' + escapeHtml(client.name) + '</h2>' +
    '<p style="margin:0 0 16px;font-size:13px;color:#64748b">' + escapeHtml(monthLabel) + '</p>' +
    intro + invTable + totalsBlock +
    '<p style="margin-top:22px;font-size:12px;color:#64748b">If you have any queries about this statement, please contact us. Payment for outstanding invoices is due within 30 days of issue.</p>' +
    '<p style="margin-top:18px;font-size:12px;color:#64748b">Kind regards,<br><strong>' + escapeHtml(companyName) + '</strong></p>';

  return styledHtml(body, {
    accent_color: '#2E5A1A',
    banner_title: 'Monthly Statement · ' + monthLabel,
    footer_text: companyName + ' · ' + (year ? `${year}-${String(monthNum || '').padStart(2, '0')}` : ''),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* ok */ }

    // Default to last full month
    const now = new Date();
    const lm = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const month = String(body.month || `${lm.getUTCFullYear()}-${String(lm.getUTCMonth() + 1).padStart(2, '0')}`);
    if (!/^\d{4}-\d{2}$/.test(month)) return Response.json({ error: 'month must be YYYY-MM' }, { status: 400 });

    const sendEmail = body.send_email !== false; // default true
    const onlyClientId = String(body.client_id || '').trim() || null;

    const { startISO, endISO } = monthRange(month);
    const monthLabel = fmtMonth(month);

    // Company name from app settings (best effort)
    let companyName = 'Ground Control';
    try {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'global' });
      if (settings[0]?.company_name) companyName = settings[0].company_name;
    } catch { /* ignore */ }
    const baseUrl = await getAppBaseUrl(base44);

    // Fetch all invoices, filter to the month + optional client
    const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 500);
    const monthInvoices = allInvoices.filter((inv) => {
      if (!inv.issue_date) return false;
      const d = inv.issue_date.includes('T') ? inv.issue_date : inv.issue_date + 'T00:00:00';
      const t = new Date(d).toISOString();
      return t >= startISO && t <= endISO && (!onlyClientId || inv.client_id === onlyClientId);
    });

    // Group by client
    const byClient = {};
    monthInvoices.forEach((inv) => {
      const cid = inv.client_id || '_unknown';
      if (!byClient[cid]) byClient[cid] = { client_id: cid, invoices: [] };
      byClient[cid].invoices.push(inv);
    });

    const clientIds = Object.keys(byClient);
    if (clientIds.length === 0) {
      return Response.json({ month, monthLabel, results: [], message: `No invoices found for ${monthLabel}.` });
    }

    // Resolve client records
    const clients = await base44.asServiceRole.entities.Client.list();
    const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));

    const [y, m] = month.split('-').map(Number);
    const results = [];

    for (const cid of clientIds) {
      const client = clientById[cid] || { id: cid, name: 'Unknown Client' };
      const invoices = byClient[cid].invoices.sort((a, b) => (a.invoice_number || '').localeCompare(b.invoice_number || ''));
      const html = statementHtml({ client, month, monthLabel, invoices, companyName, baseUrl, year: y, monthNum: m });

      const totalGross = invoices.filter((i) => i.status !== 'void').reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
      const outstanding = invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

      let email_status = 'skipped';
      let email_note = 'Email not requested.';

      if (sendEmail) {
        const to = client.contact_email || '';
        const subject = `Statement · ${monthLabel} · ${companyName}`;
        // Try sending directly to the client contact.
        if (to) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html });
            email_status = 'sent_client';
            email_note = `Sent to ${to}`;
          } catch (e) {
            // Client contact likely not a registered app user — fall back to the requester.
            try {
              await base44.asServiceRole.integrations.Core.SendEmail({ to: user.email, subject: `[Forward to ${client.name}] ${subject}`, body: html });
              email_status = 'sent_admin_fallback';
              email_note = `Client email not deliverable — sent to you for forwarding (${to}).`;
            } catch (e2) {
              email_status = 'failed';
              email_note = (e2?.message || e?.message || 'Send failed');
            }
          }
        } else {
          // No contact email on file — send to requester as a fallback.
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({ to: user.email, subject: `[No client email on file] ${subject}`, body: html });
            email_status = 'sent_admin_fallback';
            email_note = 'No client email on file — sent to you for forwarding.';
          } catch (e3) {
            email_status = 'failed';
            email_note = e3?.message || 'Send failed';
          }
        }
      }

      results.push({
        client_id: cid,
        client_name: client.name,
        contact_email: client.contact_email || '',
        invoice_count: invoices.length,
        total_gross: totalGross,
        outstanding,
        email_status,
        email_note,
        preview_html: body.include_html ? html : undefined,
      });
    }

    return Response.json({
      month,
      monthLabel,
      client_count: results.length,
      results,
      message: `${results.length} statement(s) prepared for ${monthLabel}.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});