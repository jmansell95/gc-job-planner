import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

/**
 * checkMilestoneTriggers — evaluates pending billing milestones on active
 * JobBillingContracts and auto-raises a milestone invoice when a trigger is met.
 *
 * Triggers supported:
 *   metres_drilled     — total metres drilled (from AGS logs) >= trigger_value
 *   units_completed    — sum of units_completed on investigation logs >= trigger_value
 *   percentage_complete— metres / meterage_target * 100 >= trigger_value
 *   date               — now >= effective_from + trigger_value days
 *   manual             — never auto-fires (left for manual triggering)
 *
 * On trigger: marks the milestone 'triggered', raises a draft Invoice for
 * invoice_percentage of total_contract_value_net, then marks it 'invoiced'
 * and increments the contract's total_invoiced_net.
 *
 * Payload: { contract_id?, job_id?, all?: true }
 *   all = true (default) scans every active milestone-enabled contract.
 */
function computeMetres(invLogs) {
  const byRef = {};
  (invLogs || [])
    .filter((l) => l.source === 'ags_import' && l.borehole_ref && l.depth_to != null)
    .forEach((l) => { if (byRef[l.borehole_ref] == null || l.depth_to > byRef[l.borehole_ref]) byRef[l.borehole_ref] = l.depth_to; });
  return Object.values(byRef).reduce((s, d) => s + d, 0);
}

async function evaluateContract(base44, contract) {
  const triggered = [];
  if (!contract || !contract.milestones || contract.milestones.length === 0) return triggered;

  const job = await base44.asServiceRole.entities.Job.get(contract.job_id).catch(() => null);
  if (!job) return triggered;

  const invLogs = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: contract.job_id }, '-created_date', 1000);
  const metres = computeMetres(invLogs);
  const units = invLogs.reduce((s, l) => s + (Number(l.units_completed) || 0), 0);
  const target = Number(contract.meterage_target) || Number(job.meterage_target) || 0;
  const pct = target > 0 ? (metres / target) * 100 : 0;
  const now = new Date();

  let updatedMilestones = contract.milestones.map((m) => ({ ...m }));
  let totalInvoicedDelta = 0;

  for (let i = 0; i < updatedMilestones.length; i++) {
    const m = updatedMilestones[i];
    if (m.status !== 'pending') continue;

    let due = false;
    if (m.trigger_type === 'metres_drilled') due = metres >= (Number(m.trigger_value) || 0);
    else if (m.trigger_type === 'units_completed') due = units >= (Number(m.trigger_value) || 0);
    else if (m.trigger_type === 'percentage_complete') due = pct >= (Number(m.trigger_value) || 0);
    else if (m.trigger_type === 'date') {
      const base = contract.effective_from ? new Date(contract.effective_from) : (contract.contract_date ? new Date(contract.contract_date) : null);
      if (base) {
        const dueDate = new Date(base.getTime() + (Number(m.trigger_value) || 0) * 86400000);
        due = now >= dueDate;
      }
    }
    // 'manual' never auto-fires

    if (!due) continue;

    // Trigger the milestone and raise an invoice
    const contractValue = Number(contract.total_contract_value_net) || 0;
    const netAmount = Math.round(contractValue * (Number(m.invoice_percentage) || 0) / 100 * 100) / 100;
    if (netAmount <= 0) {
      updatedMilestones[i] = { ...m, status: 'triggered', triggered_at: now.toISOString() };
      triggered.push({ label: m.label, skipped: 'zero_value' });
      continue;
    }

    const vatRate = Number(contract.vat_rate) || 20;
    const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
    const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;

    const year = now.getFullYear();
    const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
    const yearCount = allInvoices.filter((inv) => (inv.invoice_number || '').includes(`INV-${year}-`)).length + 1;
    const invoiceNumber = `INV-${year}-${String(yearCount).padStart(4, '0')}`;

    const client = contract.client_id ? (await base44.asServiceRole.entities.Client.get(contract.client_id).catch(() => null)) : null;

    const invoice = {
      invoice_number: invoiceNumber,
      job_id: contract.job_id,
      job_name: job.name,
      job_reference: job.job_reference || '',
      client_id: contract.client_id || job.client_id || '',
      client_name: client?.name || '',
      status: 'draft',
      issue_date: now.toISOString().slice(0, 10),
      due_date: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10),
      line_items: [{
        description: `Milestone — ${m.label || 'Billing milestone'} (${Number(m.invoice_percentage) || 0}% of contract value)`,
        quantity: 1,
        unit_label: 'sum',
        unit_cost: netAmount,
        line_total: netAmount,
        category: 'Milestone',
      }],
      net_total: netAmount,
      vat_rate: vatRate,
      vat_total: vatAmount,
      gross_total: grossAmount,
      revenue_method: contract.revenue_method || 'none',
      raised_by_name: 'Milestone Auto-Invoice',
      notes: `Auto-generated on milestone trigger: ${m.label || ''}. Contract version ${contract.version}.`,
    };
    await base44.asServiceRole.entities.Invoice.create(invoice);

    updatedMilestones[i] = { ...m, status: 'invoiced', triggered_at: now.toISOString() };
    totalInvoicedDelta += netAmount;
    triggered.push({ label: m.label, invoice_number: invoiceNumber, net_total: netAmount, gross_total: grossAmount });
  }

  if (triggered.length > 0) {
    await base44.asServiceRole.entities.JobBillingContract.update(contract.id, {
      milestones: updatedMilestones,
      total_invoiced_net: (Number(contract.total_invoiced_net) || 0) + totalInvoicedDelta,
    });
  }

  return triggered;
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
    } else if (body.job_id) {
      contracts = await base44.asServiceRole.entities.JobBillingContract.filter({ job_id: body.job_id, status: 'active' });
    } else {
      contracts = await base44.asServiceRole.entities.JobBillingContract.filter({ status: 'active', milestone_billing_enabled: true });
    }

    const allTriggered = [];
    for (const c of contracts) {
      if (!c.milestone_billing_enabled) continue;
      try {
        const t = await evaluateContract(base44, c);
        if (t.length > 0) allTriggered.push({ contract_id: c.id, job_id: c.job_id, triggered: t });
      } catch (e) {
        allTriggered.push({ contract_id: c.id, error: e.message });
      }
    }

    // Email admins a digest when milestone invoices were raised
    const raised = allTriggered.flatMap((r) => r.triggered || []).filter((t) => t.invoice_number);
    if (raised.length > 0) {
      try {
        const baseUrl = await getAppBaseUrl(base44);
        const admins = (await base44.asServiceRole.entities.User.list()).filter((u) => u.role === 'admin');
        if (admins.length > 0) {
          const rows = raised.map((r) =>
            '<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">' + escapeHtml(r.label || 'Milestone') + '</td>' +
            '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600">' + escapeHtml(r.invoice_number) + '</td>' +
            '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">£' + (Number(r.gross_total) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 }) + '</td></tr>'
          ).join('');
          const bodyHtml = '<p>The Milestone Auto-Invoice engine raised <strong>' + raised.length + '</strong> draft invoice' + (raised.length === 1 ? '' : 's') + ' from triggered billing milestones:</p>' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px"><thead><tr><th style="text-align:left;padding:8px 10px;background:#f1f5f9">Milestone</th><th style="text-align:left;padding:8px 10px;background:#f1f5f9">Invoice No.</th><th style="text-align:right;padding:8px 10px;background:#f1f5f9">Total</th></tr></thead><tbody>' + rows + '</tbody></table>' +
            '<p style="margin-top:14px">Review and mark them sent from the Billing panel once checked.</p>';
          const to = admins.map((a) => a.email).filter(Boolean).join(',');
          if (to) {
            await base44.integrations.Core.SendEmail({
              to,
              subject: 'Milestone Auto-Invoice — ' + raised.length + ' draft' + (raised.length === 1 ? '' : 's') + ' raised',
              body: styledHtml(bodyHtml, { banner_title: 'GC Mission Control — Milestone Invoice Digest', accent_color: '#2E5A1A' }),
            });
          }
        }
      } catch (_) { /* email is non-fatal */ }
    }

    return Response.json({
      ok: true,
      contracts_checked: contracts.length,
      milestones_triggered: raised.length,
      results: allTriggered,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}