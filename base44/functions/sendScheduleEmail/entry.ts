import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { weekStart, staffId, recipientEmail } = await req.json();

    const staff = staffId ? await base44.entities.Staff.get(staffId) : null;
    const rotas = await base44.entities.RotaAssignment.filter({ week_start: weekStart });
    const filteredRotas = staffId ? rotas.filter(r => r.staff_id === staffId) : rotas;

    const jobIds = [...new Set(filteredRotas.map(r => r.job_id))];
    const jobs = await Promise.all(jobIds.map(id => base44.entities.Job.get(id).catch(() => null)));

    const vehicleIds = [...new Set(filteredRotas.map(r => r.vehicle_id).filter(Boolean))];
    const vehicles = await Promise.all(vehicleIds.map(id => base44.entities.Vehicle.get(id).catch(() => null)));

    const allStaffIds = [...new Set(filteredRotas.map(r => r.staff_id))];
    const allStaff = await Promise.all(allStaffIds.map(id => base44.entities.Staff.get(id).catch(() => null)));

    const fmtDate = (d) => {
      const date = new Date(d + 'T00:00:00');
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return days[date.getDay()] + ' ' + date.getDate() + ' ' + months[date.getMonth()];
    };

    const subject = staffId
      ? `${staff.name}'s Weekly Schedule – ${fmtDate(weekStart)}`
      : `Weekly Rota – ${fmtDate(weekStart)}`;

    const greeting = staffId
      ? `Hi ${staff.name}, here is your schedule for the week of ${fmtDate(weekStart)}.`
      : `The weekly rota for ${fmtDate(weekStart)} is below.`;

    let tableRows = '';
    for (const rota of filteredRotas) {
      const job = jobs.find(j => j?.id === rota.job_id);
      const vehicle = vehicles.find(v => v?.id === rota.vehicle_id);
      const member = allStaff.find(s => s?.id === rota.staff_id);
      if (!job) continue;
      const times = (rota.start_time || rota.end_time) ? (rota.start_time || '—') + '–' + (rota.end_time || '—') : '—';
      const staffCell = staffId ? '' : `<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600">${member?.name || '—'}</td>`;
      tableRows += `<tr>${staffCell}<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${fmtDate(rota.assigned_date)}</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600">${job.name}</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b">${job.location}</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${times}</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${vehicle ? vehicle.registration_number : '—'}</td></tr>`;
    }

    const staffHeader = staffId ? '' : `<th style="padding:10px;background:#065f46;color:white;text-align:left;font-size:12px;text-transform:uppercase">Staff</th>`;

    const emailBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1e293b">
<table style="width:100%;max-width:680px;margin:0 auto;border-collapse:collapse">
  <tr><td style="background:linear-gradient(135deg,#064e3b,#065f46);padding:24px 28px;border-radius:12px 12px 0 0">
    <h1 style="color:white;font-size:20px;margin:0;font-weight:700">${staffId ? 'Your Weekly Schedule' : 'Weekly Rota'}</h1>
    <p style="color:#a7f3d0;font-size:13px;margin:4px 0 0 0">${fmtDate(weekStart)}</p>
  </td></tr>
  <tr><td style="padding:20px 28px;background:white">
    <p style="font-size:14px;color:#475569;margin:0 0 16px 0">${greeting}</p>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        ${staffHeader}
        <th style="padding:10px;background:#065f46;color:white;text-align:left;font-size:12px;text-transform:uppercase">Date</th>
        <th style="padding:10px;background:#065f46;color:white;text-align:left;font-size:12px;text-transform:uppercase">Job</th>
        <th style="padding:10px;background:#065f46;color:white;text-align:left;font-size:12px;text-transform:uppercase">Location</th>
        <th style="padding:10px;background:#065f46;color:white;text-align:left;font-size:12px;text-transform:uppercase">Times</th>
        <th style="padding:10px;background:#065f46;color:white;text-align:left;font-size:12px;text-transform:uppercase">Vehicle</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </td></tr>
  <tr><td style="padding:16px 28px;background:#f8fafb;border-radius:0 0 12px 12px">
    <p style="font-size:12px;color:#94a3b8;margin:0">GC Job Planner · Please confirm your availability with the office.</p>
  </td></tr>
</table>
</body></html>`;

    await base44.integrations.Core.SendEmail({
      to: recipientEmail,
      subject,
      body: emailBody,
      from_name: 'GC Job Planner'
    });

    return Response.json({ success: true, message: `Schedule emailed to ${recipientEmail}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});