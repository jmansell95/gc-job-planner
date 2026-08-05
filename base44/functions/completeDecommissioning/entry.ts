import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ---------------------------------------------------------------------------
// Complete Job Decommissioning
// ---------------------------------------------------------------------------
// Called when all assets are returned and the site is cleared. Transitions
// the job from 'decommissioning' to 'completed' and records the final
// inspection checklist.
//
// Pre-conditions:
//   - Job must be in 'decommissioning' status
//   - All JobCostItems for this job must have current_location !== 'site'
//     (everything returned or handed over)
//
// Returns success or a list of items still on site blocking completion.
// ---------------------------------------------------------------------------

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { job_id, checklist } = body;
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    if (job.status !== 'decommissioning') {
      return Response.json({ error: `Job must be in 'decommissioning' status (currently: ${job.status})` }, { status: 422 });
    }

    // Check all items are returned
    const allCostItems = await base44.asServiceRole.entities.JobCostItem.filter({ job_id });
    const stillOnSite = allCostItems.filter(ci => ci.current_location === 'site');

    if (stillOnSite.length > 0) {
      return Response.json({
        error: 'Cannot complete — items still on site',
        items_on_site: stillOnSite.map(ci => ({
          id: ci.id,
          description: ci.description,
          current_location: ci.current_location,
        })),
        count: stillOnSite.length,
      }, { status: 422 });
    }

    // Mark all disciplines as completed
    const disciplines = (job.disciplines || []).map(d => ({
      ...d,
      status: 'completed',
    }));

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Job.update(job_id, {
      status: 'completed',
      status_changed_at: now,
      decommissioning_completed_at: now,
      disciplines,
      decommissioning_checklist: {
        photos_uploaded: checklist?.photos_uploaded || false,
        final_meters_recorded: checklist?.final_meters_recorded || false,
        site_handback_confirmed: checklist?.site_handback_confirmed || false,
        all_assets_returned: true,
        final_notes: checklist?.final_notes || '',
        handback_contact_name: checklist?.handback_contact_name || '',
        completed_by_name: user.full_name || user.email || 'Admin',
        completed_at: now,
      },
    });

    return Response.json({
      status: 'success',
      job_id,
      job_name: job.name,
      new_status: 'completed',
      items_returned: allCostItems.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}