import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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
        await base44.integrations.Core.SendEmail({
          to: job.project_manager,
          subject: `Milestone completed: ${ref} on ${job.name}`,
          body: `${summary}\n\nJob: ${job.name} (${job.job_reference || 'no ref'})\nLocation: ${job.location || 'N/A'}\nReviewed by: ${log.manager_reviewed_by || 'Manager'}\n\nThis milestone has been published to the client portal automatically.`,
        });
        emailed = true;
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