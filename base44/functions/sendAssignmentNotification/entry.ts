import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Payload from entity automation: { event, data, old_data }
    // Or direct invocation: { staff_id, job_id, assigned_date }
    const data = body.data || body;
    const staffId = data.staff_id;
    const jobId = data.job_id;
    const assignedDate = data.assigned_date;

    if (!staffId || !jobId) {
      return Response.json({ skipped: true, reason: 'Missing staff_id or job_id' });
    }

    const staffList = await base44.asServiceRole.entities.Staff.filter({ id: staffId });
    const staff = staffList[0];
    if (!staff || !staff.email) {
      return Response.json({ skipped: true, reason: 'Staff not found or no email' });
    }

    const jobList = await base44.asServiceRole.entities.Job.filter({ id: jobId });
    const job = jobList[0];
    if (!job) {
      return Response.json({ skipped: true, reason: 'Job not found' });
    }

    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'assignment_notification' });
    const cfg = settings[0];
    if (cfg && cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Alert disabled' });
    }

    const dateObj = assignedDate ? new Date(assignedDate + 'T00:00:00') : new Date();
    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const subject = (cfg && cfg.subject) ? cfg.subject.replace(/\{job_name\}/g, job.name) : 'New Job Assignment: ' + job.name;
    const intro = (cfg && cfg.intro_message) ? cfg.intro_message + '\n\n' : '';
    const emailBody = 'Hello ' + staff.name + ',\n\n' + intro + 'You have been assigned to a new job:\n\n' +
      'Job: ' + job.name + '\n' +
      'Location: ' + job.location + '\n' +
      'Date: ' + formattedDate + '\n' +
      'Job Type: ' + job.job_type.replace(/_/g, ' ') + '\n' +
      (job.notes ? '\nNotes: ' + job.notes + '\n' : '') +
      '\nPlease check your schedule for full details.\n\nGC Job Planner';

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: staff.email,
      subject,
      body: emailBody
    });

    return Response.json({ sent: true, to: staff.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});