import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// Milestone Auto-Push — when an investigation log (borehole/pit completion) is
// approved by a manager, this function publishes a client-facing milestone
// summary as a JobComment (visible in the Client Portal) and emails the
// project manager a digest. This closes the transparency loop automatically:
// the client sees progress the second work is signed off, with zero admin
// overhead.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const logId = body.log_id;
    if (!logId) return Response.json({ error: 'log_id is required' }, { status: 400 });

    const e = base44.asServiceRole.entities;
    const log = await e.InvestigationLog.get(logId);
    if (!log) return Response.json({ error: 'Log not found' }, { status: 404 });
    if (log.manager_review_status !== 'approved') {
      return Response.json({ skipped: true, reason: 'Log not yet approved by a manager' });
    }

    const job = await e.Job.get(log.job_id);
    if (!job) return Response.json({ skipped: true, reason: 'Linked job not found' });

    // Build the milestone summary
    const ref = log.borehole_ref || log.sample_id || 'Activity';
    const depth = (log.depth_from != null && log.depth_to != null)
      ? `${log.depth_from}m–${log.depth_to}m`
      : log.units_completed ? `${log.units_completed} ${log.units_label || 'units'}` : '';
    const summary = `✅ ${ref} completed${depth ? ` (${depth})` : ''} on ${log.date}. ${log.description || ''}`.trim();

    // 1. Post a client-visible job comment (appears in the Client Portal timeline)
    await e.JobComment.create({
      job_id: job.id,
      author_name: 'System (Milestone Auto-Push)',
      message: summary,
      is_client: false,
      is_system_milestone: true,
    });

    // 2. Email the project manager a digest (if they're a registered app user)
    let emailed = false;
    if (job.project_manager) {
      try {
        const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'milestone_push' });
        const cfg = cfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Mission Control', show_banner: true, footer_text: 'GC Mission Control' };
        if (cfg.enabled !== false) {
          const tok = {
            milestone: summary,
            job_name: job.name || '—',
            job_reference: job.job_reference || 'no ref',
            location: job.location || 'N/A',
            reviewed_by: log.manager_reviewed_by || 'Manager',
            borehole_ref: ref
          };
          let text;
          if (cfg.template) {
            text = cfg.template
              .replace(/\{milestone\}/g, tok.milestone)
              .replace(/\{job_name\}/g, tok.job_name)
              .replace(/\{job_reference\}/g, tok.job_reference)
              .replace(/\{location\}/g, tok.location)
              .replace(/\{reviewed_by\}/g, tok.reviewed_by)
              .replace(/\{borehole_ref\}/g, tok.borehole_ref);
          } else {
            const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
            text = intro + `${tok.milestone}\n\nJob: ${tok.job_name} (${tok.job_reference})\nLocation: ${tok.location}\nReviewed by: ${tok.reviewed_by}\n\nThis milestone has been published to the client portal automatically.`;
          }
          const subject = cfg.subject
            ? cfg.subject.replace(/\{borehole_ref\}/g, tok.borehole_ref).replace(/\{job_name\}/g, tok.job_name)
            : `Milestone completed: ${tok.borehole_ref} on ${tok.job_name}`;
          const baseUrl = await getAppBaseUrl(base44);
          const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: job.project_manager,
            subject,
            body: styledHtml(bodyHtml, cfg),
          });
          emailed = true;
        }
      } catch (emailErr) {
        // PM may not be a registered user — skip silently
      }
    }

    return Response.json({
      success: true,
      job_id: job.id,
      milestone: summary,
      comment_posted: true,
      pm_emailed: emailed,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}