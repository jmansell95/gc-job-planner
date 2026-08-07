import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// ============================================================
// checkDriverSafety — scans vehicles for Geotab safety events
// (harsh braking, speeding, harsh acceleration, harsh cornering)
// and emails admins when a vehicle exceeds the configured event
// threshold. Uses the 'driver_safety_alert' email template.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Load the driver_safety_alert email template
    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'driver_safety_alert' });
    const cfg = settings[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Driver safety alert disabled' });
    }
    if (!cfg.template) {
      return Response.json({ skipped: true, reason: 'No template configured for driver safety alert' });
    }

    // Threshold: number of events in 30 days that triggers an alert.
    // Reuses days_before_warning as the event threshold (default 5).
    const eventThreshold = (cfg.days_before_warning && Number(cfg.days_before_warning) > 0) ? Number(cfg.days_before_warning) : 5;

    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-safety_event_count', 500);
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

    // Find vehicles exceeding the safety event threshold
    const flaggedVehicles = vehicles.filter((v: any) =>
      v.geotab_sync_status === 'synced' &&
      (v.safety_event_count || 0) >= eventThreshold
    );

    if (flaggedVehicles.length === 0) {
      return Response.json({ sent: false, reason: 'No vehicles above threshold', checked: vehicles.length, threshold: eventThreshold });
    }

    const today = new Date().toLocaleDateString('en-GB');
    const baseUrl = await getAppBaseUrl(base44);

    // Send one email per flagged vehicle (each has its own driver/event data)
    let sentCount = 0;
    for (const v of flaggedVehicles) {
      const eventList: string[] = [];
      if (v.safety_harsh_braking_count > 0) eventList.push(`   • Harsh braking: ${v.safety_harsh_braking_count} event(s)`);
      if (v.safety_speeding_count > 0) eventList.push(`   • Speeding: ${v.safety_speeding_count} event(s)`);
      if (v.safety_harsh_accel_count > 0) eventList.push(`   • Harsh acceleration: ${v.safety_harsh_accel_count} event(s)`);
      if (v.safety_harsh_cornering_count > 0) eventList.push(`   • Harsh cornering: ${v.safety_harsh_cornering_count} event(s)`);
      const eventListStr = eventList.join('\n');

      const subject = cfg.subject
        ? cfg.subject.replace(/\{vehicle_name\}/g, v.name || v.registration_number)
        : `Driver Safety Alert — ${v.name || v.registration_number}`;

      const text = cfg.template
        .replace(/\{vehicle_name\}/g, `${v.name || ''} (${v.registration_number || ''})`)
        .replace(/\{driver_name\}/g, v.geotab_driver_name || 'Unknown driver')
        .replace(/\{event_count\}/g, String(v.safety_event_count || 0))
        .replace(/\{event_list\}/g, eventListStr)
        .replace(/\{date\}/g, today);

      const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open Fleet Hub');

      for (const to of recipients) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to,
          subject,
          body: styledHtml(bodyHtml, cfg),
        });
      }
      sentCount++;
    }

    return Response.json({
      sent: true,
      vehicles_flagged: flaggedVehicles.length,
      notified_recipients: recipients.length,
      threshold: eventThreshold,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}