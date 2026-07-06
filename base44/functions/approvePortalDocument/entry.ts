import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { portal_token, document_id, approver_name } = body;
    if (!portal_token || !document_id || !approver_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const jobs = await base44.asServiceRole.entities.Job.filter({ portal_token });
    if (jobs.length === 0) return Response.json({ error: 'Job not found' }, { status: 404 });

    const job = jobs[0];
    if (!job.portal_enabled) return Response.json({ error: 'Portal access is disabled for this job' }, { status: 403 });

    const docs = await base44.asServiceRole.entities.JobDocument.filter({ job_id: job.id });
    const doc = docs.find(d => d.id === document_id);
    if (!doc) return Response.json({ error: 'Document not found' }, { status: 404 });
    if (doc.client_visible !== true) return Response.json({ error: 'Document is not available on the portal' }, { status: 403 });

    const now = new Date().toISOString();
    const updated = await base44.asServiceRole.entities.JobDocument.update(document_id, {
      client_approved: true,
      client_approved_at: now,
      client_approved_by_name: approver_name
    });

    return Response.json({
      success: true,
      document: {
        id: document_id,
        client_approved: true,
        client_approved_at: now,
        client_approved_by_name: approver_name
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});