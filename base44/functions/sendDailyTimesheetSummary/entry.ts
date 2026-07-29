import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const manual = !!body.manual;

    // Skip automation-control check when triggered manually from the dashboard
    if (!manual) {
      const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'daily_timesheet_summary' });
      const ac = ctrl[0];
      if (ac && ac.enabled === false) {
        return Response.json({ skipped: true, reason: 'Automation disabled' });
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const staff = await base44.asServiceRole.entities.Staff.list();
    const jobs = await base44.asServiceRole.entities.Job.list();
    const todaysRotas = await base44.asServiceRole.entities.RotaAssignment.filter({ assigned_date: todayStr });
    const todayTimesheets = await base44.asServiceRole.entities.Timesheet.filter({ date: todayStr });

    // Build per-staff status
    const byStaff = {};
    todaysRotas.forEach(a => {
      if (!byStaff[a.staff_id]) byStaff[a.staff_id] = [];
      byStaff[a.staff_id].push(a);
    });

    const submitted = [];
    const inProgress = [];
    const notStarted = [];

    staff.forEach(s => {
      const sAssignments = byStaff[s.id] || [];
      if (sAssignments.length === 0) return;
      const job = jobs.find(j => j.id === sAssignments[0]?.job_id);
      const jobName = job ? job.name : '—';
      const submittedTs = todayTimesheets.find(t => t.staff_id === s.id && t.is_summary && (t.status === 'submitted' || t.status === 'approved'));
      const arrived = sAssignments.some(a => a.arrived_on_site_at);
      const started = sAssignments.some(a => a.status === 'started');
      const completed = sAssignments.some(a => a.status === 'completed');
      const earlyLeave = sAssignments.some(a => a.early_leave_reason);
      const earlyLeaveReason = sAssignments.find(a => a.early_leave_reason)?.early_leave_reason || '';
      const submittedAt = submittedTs?.created_date ? new Date(submittedTs.created_date).toISOString().slice(11, 16) : '';
      const arrivedAt = sAssignments.map(a => a.arrived_on_site_at).filter(Boolean).sort()[0] || '';

      const row = { name: s.name, jobName, earlyLeave, earlyLeaveReason, submittedAt, arrivedAt: arrivedAt ? new Date(arrivedAt).toISOString().slice(11, 16) : '' };
      if (submittedTs) submitted.push(row);
      else if (started || completed || arrived) inProgress.push(row);
      else notStarted.push(row);
    });

    if (submitted.length === 0 && inProgress.length === 0 && notStarted.length === 0) {
      return Response.json({ skipped: true, reason: 'No staff on rota today' });
    }

    // Recipients: admins and managers (staff with system_role admin/manager) who have email + notifications enabled
    const recipients = staff
      .filter(s => (s.system_role === 'admin' || s.system_role === 'manager') && s.email && s.email_notifications_enabled !== false)
      .map(s => s.email);

    if (recipients.length === 0) {
      return Response.json({ skipped: true, reason: 'No recipients configured', submitted, inProgress, notStarted });
    }

    const baseUrl = await getAppBaseUrl(base44);
    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'timesheet_summary' });
    const cfg = cfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' };
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const fmtRows = (rows) => rows.length > 0
      ? rows.map(r => '   • ' + r.name + ' — ' + r.jobName + (r.submittedAt ? ' (submitted ' + r.submittedAt + ')' : r.arrivedAt ? ' (arrived ' + r.arrivedAt + ')' : '') + (r.earlyLeave ? ' [left early: ' + (r.earlyLeaveReason || '—') + ']' : '')).join('\n')
      : '   None';

    let text;
    if (cfg.template) {
      text = cfg.template
        .replace(/\{date\}/g, todayStr)
        .replace(/\{submitted_count\}/g, String(submitted.length))
        .replace(/\{in_progress_count\}/g, String(inProgress.length))
        .replace(/\{not_started_count\}/g, String(notStarted.length))
        .replace(/\{submitted_list\}/g, fmtRows(submitted))
        .replace(/\{in_progress_list\}/g, fmtRows(inProgress))
        .replace(/\{not_started_list\}/g, fmtRows(notStarted));
    } else {
      const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
      text = intro +
        'Daily timesheet summary for ' + todayStr + ':\n\n' +
        'SUBMITTED (' + submitted.length + '):\n' + fmtRows(submitted) + '\n\n' +
        'IN PROGRESS (' + inProgress.length + '):\n' + fmtRows(inProgress) + '\n\n' +
        'NOT STARTED (' + notStarted.length + '):\n' + fmtRows(notStarted) + '\n\n' +
        'Review and approve pending timesheets in the Timesheets page.\n\nGC Job Planner';
    }
    const subject = cfg.subject
      ? cfg.subject.replace(/\{date\}/g, todayStr)
      : 'Daily timesheet summary — ' + todayStr;

    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open Timesheets');

    let sent = 0;
    const errors = [];
    for (const email of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject,
          body: styledHtml(bodyHtml, cfg)
        });
        sent++;
      } catch (e) {
        errors.push({ email, message: e.message });
      }
    }

    if (!manual) {
      const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'daily_timesheet_summary' });
      const ac = ctrl[0];
      if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    }

    return Response.json({
      success: true,
      date: todayStr,
      recipients: sent,
      submitted: submitted.length,
      inProgress: inProgress.length,
      notStarted: notStarted.length,
      errors
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});