import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

/**
 * releaseRetention — releases held retention on a JobBillingContract and raises
 * the final retention invoice.
 *
 * Retention is held back from each progress invoice (retention_percentage of the
 * contract value). It is released once the job/project is complete. This function:
 *   1. Verifies the contract is active and has retention held.
 *   2. Confirms completion — the linked job (or its parent project) is 'completed'.
 *   3. Raises a draft Invoice for the held retention amount (net + contract VAT).
 *   4. Updates the contract: retention_released += released, total_retention_held = 0,
 *      total_invoiced_net += released.
 *   5. Emails admins a digest.
 *
 * Payload:
 *   { contract_id }       — release one contract
 *   { project_id }        — release every active contract under a completed project
 *   { all_complete: true }— scan all active contracts with retention held whose job is completed
 */
async function isComplete(base44, contract) {
  const job = contract.job_id ? await base44.asServiceRole.entities.Job.get(contract.job_id).catch(() => null) : null;
  if (job?.status === 'completed') return true;
  if (contract.project_id) {
    const project = await base44.asServiceRole.entities.Project.get(contract.project_id).catch(() => null);
    if (project?.status === 'completed') return true;
  }
  return false;
}

async function releaseOne(base44, contract) {
  const held = Number(contract.total_retention_held) || 0;
  if (held <= 0) return { contract_id: contract.id, job_id: contract.job_id, skipped: 'no_retention_held' };

  const complete = await isComplete(base44, contract);
  if (!complete) return { contract_id: contract.id, job_id: contract.job_id, skipped: 'not_complete' };

  const job = await base44.asServiceRole.entities.Job.get(contract.job_id).catch(() => null);
  const vatRate = Number(contract.vat_rate) || 20;
  const netAmount = Math.round(held * 100) / 100;
  const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
  const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;

  const now = new Date();
  const year = now.getFullYear();
  const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
  const yearCount = allInvoices.filter((i) => (i.invoice_number || '').includes(`INV-${year}-`)).length + 1;
  const invoiceNumber = `INV-${year}-${String(yearCount).padStart(4, '0')}`;

  const client = contract.client_id ? (await base44.asServiceRole.entities.Client.get(contract.client_id).catch(() => null)) : null;

  await base44.asServiceRole.entities.Invoice.create({
    invoice_number: invoiceNumber,
    job_id: contract.job_id,
    job_name: job?.name || '',
    job_reference: job?.job_reference || '',
    client_id: contract.client_id || job?.client_id || '',
    client_name: client?.name || '',
    status: 'draft',
    issue_date: now.toISOString().slice(0, 10),
    due_date: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10),
    line_items: [{
      description: `Retention release — ${contract.retention_percentage}% held on contract v${contract.version}`,
      quantity: 1,
      unit_label: 'sum',
      unit_cost: netAmount,
      line_total: netAmount,
      category: 'Retention',
    }],
    net_total: netAmount,
    vat_rate: vatRate,
    vat_total: vatAmount,
    gross_total: grossAmount,
    revenue_method: contract.revenue_method || 'none',
    raised_by_name: 'Retention Release Engine',
    notes: `Final retention release on contract completion. Contract version ${contract.version}.`,
  });

  await base44.asServiceRole.entities.JobBillingContract.update(contract.id, {
    retention_released: (Number(contract.retention_released) || 0) + netAmount,
    total_retention_held: 0,
    total_invoiced_net: (Number(contract.total_invoiced_net) || 0) + netAmount,
  });

  return { contract_id: contract.id, job_id: contract.job_id, job_name: job?.name, invoice_number: invoiceNumber, net_total: netAmount, gross_total: grossAmount, released: netAmount };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    let contracts = [];
    if (body.contract_id) {
      const c = await base44.asServiceRole.entities.JobBillingContract.get(body.contract_id).catch(() => null);
      contracts = c ? [c] : [];
    } else if (body.project_id) {
      contracts = await base44.asServiceRole.entities.JobBillingContract.filter({ project_id: body.project_id, status: 'active' });
    } else {
      // all_complete — every active contract with retention still held
      const active = await base44.asServiceRole.entities.JobBillingContract.filter({ status: 'active' });
      contracts = active.filter((c) => (Number(c.total_retention_held) || 0) > 0);
    }

    const results = [];
    for (const c of contracts) {
      try { results.push(await releaseOne(base44, c)); }
      catch (e) { results.push({ contract_id: c.id, error: e.message }); }
    }

    const released = results.filter((r) => r.invoice_number);

    if (released.length > 0) {
      try {
        const admins = (await base44.asServiceRole.entities.User.list()).filter((u) => u.role === 'admin');
        if (admins.length > 0) {
          const rows = released.map((r) =>
            '<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">' + escapeHtml(r.job_name || 'Job') + '</td>' +
            '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600">' + escapeHtml(r.invoice_number) + '</td>' +
            '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">£' + (Number(r.gross_total) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 }) + '</td></tr>'
          ).join('');
          const bodyHtml = '<p>The Retention Release Engine released held retention and raised <strong>' + released.length + '</strong> final invoice' + (released.length === 1 ? '' : 's') + ':</p>' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px"><thead><tr><th style="text-align:left;padding:8px 10px;background:#f1f5f9">Job</th><th style="text-align:left;padding:8px 10px;background:#f1f5f9">Invoice No.</th><th style="text-align:right;padding:8px 10px;background:#f1f5f9">Total</th></tr></thead><tbody>' + rows + '</tbody></table>' +
            '<p style="margin-top:14px">Review and mark them sent from the Billing panel once checked.</p>';
          const to = admins.map((a) => a.email).filter(Boolean).join(',');
          if (to) {
            await base44.integrations.Core.SendEmail({
              to,
              subject: 'Retention Release — ' + released.length + ' final invoice' + (released.length === 1 ? '' : 's') + ' raised',
              body: styledHtml(bodyHtml, { banner_title: 'GC Job Planner — Retention Release', accent_color: '#2E5A1A' }),
            });
          }
        }
      } catch (_) { /* email is non-fatal */ }
    }

    return Response.json({
      ok: true,
      contracts_checked: contracts.length,
      released: released.length,
      results,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}