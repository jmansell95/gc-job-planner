import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// ============================================================
// checkGeotechAlerts — scans monitoring wells, equipment
// calibrations, and samples for issues that need attention:
//   1. Monitoring wells overdue for readings
//   2. Equipment calibrations expired or expiring soon
//   3. Samples with compromised lab receipt conditions
//   4. Samples dispatched but not received at lab within 7 days
// Emails admins a digest using the 'geotech_alert' email template.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Load the geotech_alert email template
    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'geotech_alert' });
    const cfg = settings[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Geotech alert disabled' });
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // 1. Overdue monitoring wells
    const wells = await base44.asServiceRole.entities.MonitoringWell.list('-created_date', 500);
    const overdueWells = wells.filter((w: any) =>
      w.status === 'active' &&
      w.next_reading_due &&
      w.next_reading_due < todayStr
    );

    // 2. Expired / expiring calibrations
    const calibrations = await base44.asServiceRole.entities.EquipmentCalibration.list('-calibration_date', 500);
    const expiredCal = calibrations.filter((c: any) =>
      c.calibration_result !== 'fail' &&
      c.next_calibration_date &&
      c.next_calibration_date < todayStr
    );
    const expiringCal = calibrations.filter((c: any) =>
      c.calibration_result !== 'fail' &&
      c.next_calibration_date &&
      c.next_calibration_date >= todayStr &&
      c.next_calibration_date <= in30Days
    );

    // 3. Compromised samples
    const samples = await base44.asServiceRole.entities.Sample.list('-collection_date', 500);
    const compromised = samples.filter((s: any) =>
      ['compromised', 'leaked', 'broken'].includes(s.lab_receipt_condition)
    );

    // 4. Samples dispatched but not received within 7 days
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lostInTransit = samples.filter((s: any) =>
      s.status === 'dispatched' &&
      s.dispatch_date &&
      s.dispatch_date < sevenDaysAgo
    );

    const totalCount = overdueWells.length + expiredCal.length + expiringCal.length + compromised.length + lostInTransit.length;

    if (totalCount === 0) {
      return Response.json({ sent: false, reason: 'No geotech alerts', checked: { wells: wells.length, calibrations: calibrations.length, samples: samples.length } });
    }

    // Build recipients
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

    const baseUrl = await getAppBaseUrl(base44);

    // Build alert list
    const sections: string[] = [];
    if (overdueWells.length > 0) {
      sections.push(`OVERDUE MONITORING READINGS (${overdueWells.length}):`);
      sections.push(overdueWells.map((w: any) =>
        `   • ${w.well_reference}${w.borehole_ref ? ` (in ${w.borehole_ref})` : ''} — due ${w.next_reading_due}`
      ).join('\n'));
    }
    if (expiredCal.length > 0) {
      sections.push(`\nEXPIRED CALIBRATIONS (${expiredCal.length}):`);
      sections.push(expiredCal.map((c: any) =>
        `   • ${c.asset_name || c.equipment_type}${c.serial_number ? ` [${c.serial_number}]` : ''} — expired ${c.next_calibration_date}`
      ).join('\n'));
    }
    if (expiringCal.length > 0) {
      sections.push(`\nCALIBRATIONS EXPIRING SOON (${expiringCal.length}):`);
      sections.push(expiringCal.map((c: any) =>
        `   • ${c.asset_name || c.equipment_type}${c.serial_number ? ` [${c.serial_number}]` : ''} — expires ${c.next_calibration_date}`
      ).join('\n'));
    }
    if (compromised.length > 0) {
      sections.push(`\nCOMPROMISED SAMPLES (${compromised.length}):`);
      sections.push(compromised.map((s: any) =>
        `   • ${s.sample_id}${s.borehole_ref ? ` (${s.borehole_ref})` : ''} — ${s.lab_receipt_condition}`
      ).join('\n'));
    }
    if (lostInTransit.length > 0) {
      sections.push(`\nSAMPLES LOST IN TRANSIT (${lostInTransit.length}):`);
      sections.push(lostInTransit.map((s: any) =>
        `   • ${s.sample_id} — dispatched ${s.dispatch_date}, not received at lab`
      ).join('\n'));
    }

    const alertList = sections.join('\n');

    const subject = cfg.subject
      ? cfg.subject.replace(/\{alert_count\}/g, String(totalCount)).replace(/\{date\}/g, todayStr)
      : `Geotech Alert — ${totalCount} item(s) need attention`;

    let text: string;
    if (cfg.template) {
      text = cfg.template
        .replace(/\{alert_count\}/g, String(totalCount))
        .replace(/\{alert_list\}/g, alertList)
        .replace(/\{date\}/g, todayStr);
    } else {
      text = `Geotechnical Data Alert\n\nDate: ${todayStr}\n\n${alertList}\n\nReview these items in the Geotech tab of the relevant job.\n\nGC Mission Control`;
    }

    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open Dashboard');

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body: styledHtml(bodyHtml, cfg),
      });
    }

    return Response.json({
      sent: true,
      total_alerts: totalCount,
      notified_recipients: recipients.length,
      breakdown: {
        overdue_wells: overdueWells.length,
        expired_calibrations: expiredCal.length,
        expiring_calibrations: expiringCal.length,
        compromised_samples: compromised.length,
        lost_in_transit: lostInTransit.length,
      },
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}