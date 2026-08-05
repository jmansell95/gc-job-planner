import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ============================================================
// cloneJob — duplicates a job with a date shift.
// ============================================================
// Payload:
//   { job_id, date_shift_days, copy_cost_items, copy_logistics, copy_milestones }
//
// Creates a new Job with all fields copied, start_date and end_date shifted
// by date_shift_days. Optionally copies cost items, logistics assignments,
// and milestones. Returns the new job ID.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { job_id, date_shift_days = 0, copy_cost_items = true, copy_logistics = true, copy_milestones = true } = body;
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const shift = Number(date_shift_days) || 0;

    function shiftDate(dateStr) {
      if (!dateStr) return dateStr;
      const d = new Date(dateStr + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + shift);
      return d.toISOString().slice(0, 10);
    }

    // Load the source job
    const source = await base44.asServiceRole.entities.Job.get(job_id);
    if (!source) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Build the new job payload — copy all editable fields, shift dates
    const newJob: Record<string, any> = {
      name: source.name + ' (Clone)',
      project_id: source.project_id || undefined,
      job_reference: source.job_reference || undefined,
      location: source.location || undefined,
      site_lat: source.site_lat || undefined,
      site_lng: source.site_lng || undefined,
      status: 'planning',
      start_date: shiftDate(source.start_date),
      end_date: shiftDate(source.end_date),
      client_id: source.client_id || undefined,
      contractor_id: source.contractor_id || undefined,
      project_manager: source.project_manager || undefined,
      site_contact_name: source.site_contact_name || undefined,
      site_contact_phone: source.site_contact_phone || undefined,
      notes: source.notes || undefined,
      budget_amount: source.budget_amount || undefined,
      meterage_target: source.meterage_target || undefined,
      drilling_method: source.drilling_method || 'not_applicable',
      job_type: source.job_type || undefined,
      revenue_method: source.revenue_method || 'none',
      unit_price: source.unit_price || undefined,
      meterage_rate: source.meterage_rate || undefined,
      markup_percentage: source.markup_percentage || 0,
      vat_rate: source.vat_rate || 20,
      primary_discipline: source.primary_discipline || undefined,
    };

    // Copy disciplines array with shifted dates
    if (Array.isArray(source.disciplines) && source.disciplines.length > 0) {
      newJob.disciplines = source.disciplines.map((d: any) => ({
        ...d,
        status: 'planning',
        start_date: shiftDate(d.start_date),
        end_date: shiftDate(d.end_date),
      }));
    }

    // Copy legacy fields
    if (source.required_team_ids) newJob.required_team_ids = source.required_team_ids;

    // Create the new job
    const newJobRecord = await base44.entities.Job.create(newJob);

    // Copy cost items (equipment, labour) with shifted dates
    let costItemsCopied = 0;
    if (copy_cost_items) {
      const costItems = await base44.asServiceRole.entities.JobCostItem.filter({ job_id });
      if (costItems.length > 0) {
        const payloads = costItems.map((ci: any) => ({
          ...ci,
          id: undefined,
          created_date: undefined,
          updated_date: undefined,
          created_by_id: undefined,
          job_id: newJobRecord.id,
          start_date: shiftDate(ci.start_date),
          end_date: shiftDate(ci.end_date),
          off_hire_date: undefined,
          hire_status: 'active',
          current_location: 'yard',
        }));
        for (let i = 0; i < payloads.length; i += 400) {
          const batch = payloads.slice(i, i + 400);
          await base44.asServiceRole.entities.JobCostItem.bulkCreate(batch);
          costItemsCopied += batch.length;
        }
      }
    }

    // Copy asset assignments with shifted dates
    let logisticsCopied = 0;
    if (copy_logistics) {
      const assignments = await base44.asServiceRole.entities.JobAssetAssignment.filter({ job_id });
      if (assignments.length > 0) {
        const payloads = assignments.map((a: any) => ({
          ...a,
          id: undefined,
          created_date: undefined,
          updated_date: undefined,
          created_by_id: undefined,
          job_id: newJobRecord.id,
          assigned_date: shiftDate(a.assigned_date),
          arrived_on_site_date: undefined,
          returned_date: undefined,
          status: 'assigned',
        }));
        for (let i = 0; i < payloads.length; i += 400) {
          const batch = payloads.slice(i, i + 400);
          await base44.asServiceRole.entities.JobAssetAssignment.bulkCreate(batch);
          logisticsCopied += batch.length;
        }
      }
    }

    // Copy milestones with shifted dates
    let milestonesCopied = 0;
    if (copy_milestones) {
      const milestones = await base44.asServiceRole.entities.JobMilestone.filter({ job_id });
      if (milestones.length > 0) {
        const payloads = milestones.map((m: any) => ({
          ...m,
          id: undefined,
          created_date: undefined,
          updated_date: undefined,
          created_by_id: undefined,
          job_id: newJobRecord.id,
          due_date: shiftDate(m.due_date),
          completed: false,
          completed_at: undefined,
        }));
        for (let i = 0; i < payloads.length; i += 400) {
          const batch = payloads.slice(i, i + 400);
          await base44.asServiceRole.entities.JobMilestone.bulkCreate(batch);
          milestonesCopied += batch.length;
        }
      }
    }

    return Response.json({
      ok: true,
      new_job_id: newJobRecord.id,
      new_job_name: newJobRecord.name,
      cost_items_copied: costItemsCopied,
      logistics_copied: logisticsCopied,
      milestones_copied: milestonesCopied,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}