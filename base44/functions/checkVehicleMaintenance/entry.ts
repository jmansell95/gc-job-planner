import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    if (admins.length === 0) {
      return Response.json({ skipped: true, reason: 'No admin users to notify' });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const alerts = [];

    vehicles.forEach(v => {
      const issues = [];
      if (v.mot_expiry) {
        const motDate = new Date(v.mot_expiry + 'T00:00:00');
        if (motDate < now) {
          issues.push({ type: 'MOT', status: 'OVERDUE', date: v.mot_expiry });
        } else if (motDate <= thirtyDaysFromNow) {
          issues.push({ type: 'MOT', status: 'Due soon', date: v.mot_expiry });
        }
      }
      if (v.service_due_date) {
        const serviceDate = new Date(v.service_due_date + 'T00:00:00');
        if (serviceDate < now) {
          issues.push({ type: 'Service', status: 'OVERDUE', date: v.service_due_date });
        } else if (serviceDate <= thirtyDaysFromNow) {
          issues.push({ type: 'Service', status: 'Due soon', date: v.service_due_date });
        }
      }
      if (issues.length > 0) {
        alerts.push({ vehicle: v.name, registration: v.registration_number, issues });
      }
    });

    if (alerts.length === 0) {
      return Response.json({ sent: false, reason: 'No maintenance alerts', checked: vehicles.length });
    }

    let emailBody = 'Vehicle Maintenance Report\n\n';
    emailBody += alerts.length + ' vehicle(s) require maintenance attention:\n\n';
    alerts.forEach(a => {
      emailBody += a.vehicle + ' (' + a.registration + '):\n';
      a.issues.forEach(issue => {
        emailBody += '  - ' + issue.type + ': ' + issue.status + ' (due ' + issue.date + ')\n';
      });
      emailBody += '\n';
    });
    emailBody += 'Please schedule maintenance as soon as possible.\n\nGC Job Planner';

    for (const admin of admins) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: 'Vehicle Maintenance Alert - ' + alerts.length + ' vehicle(s) need attention',
        body: emailBody
      });
    }

    return Response.json({ sent: true, alertCount: alerts.length, notifiedAdmins: admins.length, alerts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});