import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generatePredictions } from '../../shared/predictMaintenance.ts';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// ============================================================
// checkPredictiveMaintenance — runs the AI predictive maintenance
// engine and emails admins a digest of vehicles flagged as
// critical or high risk for upcoming breakdown, MOT or service.
// Uses the 'predictive_maintenance_alert' email template.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Load the predictive_maintenance_alert email template
    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'predictive_maintenance_alert' });
    const cfg = settings[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Predictive maintenance alert disabled' });
    }
    if (!cfg.template) {
      return Response.json({ skipped: true, reason: 'No template configured for predictive maintenance alert' });
    }

    // Threshold: minimum risk level to include in the alert.
    // Reuses days_before_warning as a risk-score threshold (default 35 = high risk).
    const riskThreshold = (cfg.days_before_warning && Number(cfg.days_before_warning) > 0) ? Number(cfg.days_before_warning) : 35;

    const result = await generatePredictions(base44);
    const flagged = result.vehicles.filter(v => v.risk_score >= riskThreshold);

    if (flagged.length === 0) {
      return Response.json({ sent: false, reason: 'No vehicles above risk threshold', checked: result.summary.total, threshold: riskThreshold });
    }

    // Build recipients list
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter((u: any) => u.role === 'admin');
    let recipients: string[] = [];
    if (cfg.recipient_emails) {
      recipients = cfg.recipient_emails.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      recipients = admins.map((u: any) => u.email);
    }
    if (recipients.length === 0) {
      return Response.json({ skipped: true, reason: 'No recipients configured' });
    }

    const today = new Date().toLocaleDateString('en-GB');
    const baseUrl = await getAppBaseUrl(base44);

    // Build the vehicle list text
    const vehicleLines = flagged.map(v => {
      const reg = v.registration_number || 'No Reg';
      const name = [v.make, v.model].filter(Boolean).join(' ') || v.vehicle_name || '';
      const level = v.risk_level.toUpperCase();
      const factors = v.risk_factors.join(', ');
      let details = '';
      if (v.mot_days_remaining != null) {
        details += ` | MOT ${v.mot_days_remaining < 0 ? `${Math.abs(v.mot_days_remaining)}d OVERDUE` : `in ${v.mot_days_remaining}d`}`;
      }
      if (v.service_days_remaining != null) {
        details += ` | Service ${v.service_days_remaining < 0 ? `${Math.abs(v.service_days_remaining)}d OVERDUE` : `in ${v.service_days_remaining}d`}`;
      }
      return `   • ${reg} (${name}) — Risk: ${level} (${v.risk_score}/100)${details} | ${factors}`;
    }).join('\n');

    const subject = cfg.subject
      ? cfg.subject.replace(/\{vehicle_count\}/g, String(flagged.length))
      : `Predictive Maintenance Alert — ${flagged.length} vehicle(s) flagged`;

    const text = cfg.template
      .replace(/\{vehicle_count\}/g, String(flagged.length))
      .replace(/\{vehicle_list\}/g, vehicleLines)
      .replace(/\{date\}/g, today);

    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open Fleet Hub');

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body: styledHtml(bodyHtml, cfg),
      });
    }

    return Response.json({
      sent: true,
      vehicles_flagged: flagged.length,
      notified_recipients: recipients.length,
      threshold: riskThreshold,
      summary: result.summary,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}