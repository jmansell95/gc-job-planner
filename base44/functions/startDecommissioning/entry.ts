import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ---------------------------------------------------------------------------
// Start Job Decommissioning
// ---------------------------------------------------------------------------
// Triggered when a manager clicks "Finish Job" — transitions the job to
// 'decommissioning' status and auto-generates DeliveryLog (collection) tasks
// for every JobCostItem currently marked current_location: 'site'.
//
// This kicks off the site clearance workflow:
//   1. Job status → 'decommissioning' (locks new billable items)
//   2. All on-site JobCostItems flagged for collection
//   3. DeliveryLog collection tasks created for each item
//   4. Dashboard shows "Equipment Removal Required" banner
//
// Returns a summary of collection tasks generated.
// ---------------------------------------------------------------------------

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { job_id } = body;
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    if (job.status === 'decommissioning') {
      return Response.json({ error: 'Job is already in decommissioning' }, { status: 422 });
    }
    if (job.status === 'completed') {
      return Response.json({ error: 'Job is already completed' }, { status: 422 });
    }

    // 1. Transition job to decommissioning
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Job.update(job_id, {
      status: 'decommissioning',
      decommissioning_started_at: now,
      status_changed_at: now,
    });

    // 2. Find all JobCostItems currently on site for this job
    const allCostItems = await base44.asServiceRole.entities.JobCostItem.filter({ job_id });
    const onSiteItems = allCostItems.filter(ci => ci.current_location === 'site');

    // 3. Find existing delivery logs to avoid duplicates
    const existingDeliveries = await base44.asServiceRole.entities.DeliveryLog.filter({ job_id });
    const existingCollectionKeys = new Set();
    for (const d of existingDeliveries) {
      if (d.delivery_type === 'supplier_collection' && d.linked_cost_item_id) {
        existingCollectionKeys.add(d.linked_cost_item_id);
      }
    }

    // 4. Create collection delivery logs for each on-site item
    const collectionTasks = [];
    for (const item of onSiteItems) {
      // Skip if a collection task already exists for this cost item
      if (existingCollectionKeys.has(item.id)) continue;

      // Determine collection address based on category
      let pickupAddress = job.location || '';
      let deliveryAddress = 'Depot';
      if (item.category === 'hired_equipment' && item.supplier_id) {
        deliveryAddress = 'Supplier return';
      }

      collectionTasks.push({
        job_id: job_id,
        job_name: job.name,
        driver_staff_id: '', // unassigned — manager assigns from delivery hub
        delivery_type: 'supplier_collection',
        status: 'pending',
        items: item.description,
        linked_cost_item_id: item.id,
        linked_cost_item_ids: item.id,
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        scheduled_date: now.slice(0, 10),
        notes: `Auto-generated during decommissioning — collect ${item.description} from ${job.name}`,
        chargeable: false, // collections are not chargeable to client
      });
    }

    let created = 0;
    if (collectionTasks.length > 0) {
      for (let i = 0; i < collectionTasks.length; i += 400) {
        const batch = collectionTasks.slice(i, i + 400);
        await base44.asServiceRole.entities.DeliveryLog.bulkCreate(batch);
        created += batch.length;
      }
    }

    return Response.json({
      status: 'success',
      job_id,
      job_name: job.name,
      new_status: 'decommissioning',
      on_site_items_found: onSiteItems.length,
      collection_tasks_created: created,
      skipped_duplicates: onSiteItems.length - created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}