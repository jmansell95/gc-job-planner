import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const token = body.portal_token;
    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const jobs = await base44.asServiceRole.entities.Job.filter({ portal_token: token });
    if (jobs.length === 0) return Response.json({ error: 'Job not found' }, { status: 404 });

    const job = jobs[0];
    if (!job.portal_enabled) return Response.json({ error: 'Portal access is disabled for this job' }, { status: 403 });

    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: job.id });
    const allStaff = await base44.asServiceRole.entities.Staff.list();
    const photos = await base44.asServiceRole.entities.SitePhoto.filter({ job_id: job.id });
    const documents = await base44.asServiceRole.entities.JobDocument.filter({ job_id: job.id });
    const comments = await base44.asServiceRole.entities.JobComment.filter({ job_id: job.id });
    const milestones = await base44.asServiceRole.entities.JobMilestone.filter({ job_id: job.id });
    const timesheets = await base44.asServiceRole.entities.Timesheet.filter({ job_id: job.id });
    const costItems = await base44.asServiceRole.entities.JobCostItem.filter({ job_id: job.id });

    let client = null;
    if (job.client_id) {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: job.client_id });
      client = clients[0] || null;
    }

    let contractor = null;
    if (job.contractor_id) {
      const contractors = await base44.asServiceRole.entities.Contractor.filter({ id: job.contractor_id });
      contractor = contractors[0] || null;
    }

    const schedule = {};
    const teamMap = {};
    assignments.forEach(a => {
      if (!schedule[a.assigned_date]) schedule[a.assigned_date] = [];
      const staffMember = allStaff.find(s => s.id === a.staff_id);
      const name = staffMember?.name || 'Unknown';
      const role = staffMember?.job_role || '';
      schedule[a.assigned_date].push({
        staff_name: name,
        role,
        status: a.status || 'assigned',
        meterage: a.meterage || 0
      });
      if (!teamMap[a.staff_id]) teamMap[a.staff_id] = { name, role, shifts: 0, meterage: 0 };
      teamMap[a.staff_id].shifts += 1;
      teamMap[a.staff_id].meterage += a.meterage || 0;
    });
    const team = Object.values(teamMap).sort((a, b) => a.name.localeCompare(b.name));

    const validTimesheets = timesheets.filter(t => t.status === 'submitted' || t.status === 'approved');
    let totalMinutes = 0;
    let totalMeterage = 0;
    validTimesheets.forEach(t => {
      totalMinutes += Number(t.task_duration_minutes) || (t.total_hours ? t.total_hours * 60 : 0);
      totalMeterage += Number(t.meterage) || 0;
    });
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    const total = assignments.length;
    const completed = assignments.filter(a => a.status === 'completed').length;
    const started = assignments.filter(a => a.status === 'started').length;

    // ---- Billing calculation (client-facing, internal costs never exposed) ----
    const vatRate = job.vat_rate != null ? Number(job.vat_rate) : 20;
    const markup = job.markup_percentage != null ? Number(job.markup_percentage) : 0;

    const isDrillingJob = job.job_type === 'cp_drilling' || job.job_type === 'rotary_drilling';
    const jobMeterage = isDrillingJob && job.meterage != null && job.meterage !== '' ? Number(job.meterage) : 0;
    const useJobMeterage = jobMeterage > 0;

    const tsByStaff = {};
    validTimesheets.forEach(t => {
      const mins = Number(t.task_duration_minutes) || (t.total_hours ? t.total_hours * 60 : 0);
      if (!tsByStaff[t.staff_id]) tsByStaff[t.staff_id] = { minutes: 0 };
      tsByStaff[t.staff_id].minutes += mins;
    });

    const assignedStaffIds = [...new Set(assignments.map(a => a.staff_id))];
    let labourNet = 0;
    assignedStaffIds.forEach(sid => {
      const m = allStaff.find(s => s.id === sid);
      if (!m) return;
      const memberRotas = assignments.filter(a => a.staff_id === sid);
      const memberMeterage = memberRotas.reduce((s, a) => s + (a.meterage || 0), 0);
      const meterageRate = m.meterage_rate || 0;
      const dayRate = m.day_rate || 0;
      const usesMeterage = isDrillingJob && meterageRate > 0;
      const meterage = useJobMeterage ? jobMeterage : memberMeterage;
      const ts = tsByStaff[sid];
      const usesTimesheet = !usesMeterage && ts && ts.minutes > 0;
      const hourlyRate = dayRate > 0 ? dayRate / 8 : 0;
      const cost = usesMeterage ? meterage * meterageRate
        : usesTimesheet ? (ts.minutes / 60) * hourlyRate
        : memberRotas.length * dayRate;
      labourNet += cost;
    });

    if (job.actual_cost != null && job.actual_cost !== '') labourNet = Number(job.actual_cost);

    let itemNet = 0;
    const lineItems = [];
    costItems.forEach(c => {
      const qty = Number(c.quantity) || 1;
      const unit = Number(c.unit_cost) || 0;
      itemNet += qty * unit;
      lineItems.push({ description: c.description, category: c.category });
    });

    const internalNet = labourNet + itemNet;
    const markupAmount = internalNet * (markup / 100);
    const clientNet = internalNet + markupAmount;
    const clientVat = clientNet * (vatRate / 100);
    const clientTotal = clientNet + clientVat;

    const hasBilling = costItems.length > 0 || labourNet > 0 || job.client_charge != null;
    const billing = {
      quote_label: job.client_charge_description || 'Project Investment',
      line_items: lineItems,
      subtotal: Math.round(clientNet * 100) / 100,
      vat_rate: vatRate,
      vat_amount: Math.round(clientVat * 100) / 100,
      total: Math.round(clientTotal * 100) / 100,
      has_items: costItems.length > 0 || labourNet > 0
    };
    // Fallback to legacy manual client_charge when no calculated billing exists
    if (!billing.has_items && job.client_charge != null) {
      billing.subtotal = Number(job.client_charge);
      billing.vat_amount = 0;
      billing.total = Number(job.client_charge);
      billing.legacy = true;
    }

    return Response.json({
      job: {
        name: job.name,
        location: job.location,
        job_type: job.job_type,
        status: job.status,
        start_date: job.start_date,
        end_date: job.end_date,
        notes: job.notes,
        job_reference: job.job_reference || '',
        project_manager: job.project_manager || '',
        site_contact_name: job.site_contact_name || '',
        site_contact_phone: job.site_contact_phone || '',
        client_charge_description: job.client_charge_description || '',
        portal_sections: job.portal_sections || null
      },
      client: client ? { name: client.name, contact_name: client.contact_name } : null,
      contractor: contractor ? { name: contractor.name, contact_name: contractor.contact_name || '' } : null,
      schedule,
      progress: { total, completed, started },
      team,
      totals: { staff: team.length, shifts: total, hours: totalHours, meterage: totalMeterage },
      billing: hasBilling ? billing : null,
      documents: documents.map(d => ({
        document_url: d.document_url,
        document_name: d.document_name,
        category: d.category || 'other'
      })),
      milestones: milestones.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(m => ({
        name: m.name,
        completed: m.completed || false,
        target_date: m.target_date || '',
        completed_date: m.completed_date || ''
      })),
      comments: comments.map(c => ({
        author_name: c.author_name,
        message: c.message,
        is_client: c.is_client || false,
        created_date: c.created_date || ''
      })),
      photos: photos.map(p => ({
        photo_url: p.photo_url,
        caption: p.caption || '',
        uploaded_by: p.uploaded_by_name || ''
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});