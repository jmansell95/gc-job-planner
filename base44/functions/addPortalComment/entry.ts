import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { portal_token, author_name, message } = body;
    if (!portal_token || !author_name || !message) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const jobs = await base44.asServiceRole.entities.Job.filter({ portal_token });
    if (jobs.length === 0) return Response.json({ error: 'Job not found' }, { status: 404 });

    const job = jobs[0];
    if (!job.portal_enabled) return Response.json({ error: 'Portal access disabled' }, { status: 403 });

    const comment = await base44.asServiceRole.entities.JobComment.create({
      job_id: job.id,
      author_name,
      message,
      is_client: true
    });

    return Response.json({ success: true, comment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});