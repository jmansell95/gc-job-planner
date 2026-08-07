import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // This is a webhook receiver — use service role, validate via portal token
    const body = await req.json();
    const { job_id, rating, feedback_id, comment } = body;

    if (!job_id) return Response.json({ error: 'job_id required' }, { status: 400 });

    // Fetch the job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Poor rating threshold: 1-2 stars out of 5
    const isPoorRating = rating && rating <= 2;

    if (isPoorRating) {
      // Set job to "needs management review" by putting it on hold with a reason
      await base44.asServiceRole.entities.Job.update(job_id, {
        status: 'on_hold',
        status_reason: 'Client feedback: Poor rating (' + rating + '/5) received via portal. Requires management review before completion.',
        status_changed_at: new Date().toISOString(),
      });

      // Create a safety report for management review
      await base44.asServiceRole.entities.SafetyReport.create({
        job_id: job_id,
        job_name: job.name,
        type: 'client_feedback',
        severity: 'medium',
        description: 'Client submitted poor feedback (' + rating + '/5) via portal. Comment: ' + (comment || 'No comment provided'),
        status: 'open',
        report_source: 'portal_sync',
        reported_at: new Date().toISOString(),
      });

      return Response.json({
        updated: true,
        job_id,
        action: 'job_put_on_hold',
        message: 'Job put on hold pending management review due to poor client rating',
      });
    }

    // Good rating — no status change needed, just log it
    return Response.json({
      updated: false,
      job_id,
      rating,
      action: 'no_change',
      message: 'Rating is acceptable — no status change required',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}