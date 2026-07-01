import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { weekStart, staffId } = await req.json();

    // Fetch data
    const staff = staffId 
      ? await base44.entities.Staff.get(staffId)
      : null;
    
    const rotas = await base44.entities.RotaAssignment.filter({ week_start: weekStart });
    
    const filteredRotas = staffId 
      ? rotas.filter(r => r.staff_id === staffId)
      : rotas;

    const jobIds = [...new Set(filteredRotas.map(r => r.job_id))];
    const jobs = await Promise.all(jobIds.map(id => base44.entities.Job.get(id).catch(() => null)));

    const vehicleIds = [...new Set(filteredRotas.map(r => r.vehicle_id).filter(Boolean))];
    const vehicles = await Promise.all(vehicleIds.map(id => base44.entities.Vehicle.get(id).catch(() => null)));

    // Generate simple HTML-based PDF content
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
          .header { background-color: #16A34A; color: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
          .info-box { background: #F0FDF4; border: 1px solid #BBF7D0; padding: 12px; border-radius: 6px; }
          .info-box p { margin: 0; font-size: 12px; color: #6B7280; }
          .info-box .value { font-weight: bold; color: #111827; font-size: 16px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background-color: #16A34A; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 14px; }
          td { padding: 12px; border-bottom: 1px solid #E5E7EB; }
          tr:nth-child(even) { background-color: #F9FAFB; }
          .job-name { font-weight: bold; color: #111827; }
          .location { color: #6B7280; font-size: 13px; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
    `;

    if (staffId && staff) {
      // Individual schedule
      htmlContent += `
        <div class="header">
          <h1>${staff.name}'s Weekly Schedule</h1>
          <p>Week of ${weekStart}</p>
        </div>
        <div class="info-grid">
          <div class="info-box">
            <p>Job Role</p>
            <div class="value">${staff.job_role.replace('_', ' ')}</div>
          </div>
          <div class="info-box">
            <p>Worker Type</p>
            <div class="value">${staff.worker_type.replace('_', ' ')}</div>
          </div>
          <div class="info-box">
            <p>Contact</p>
            <div class="value">${staff.email}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Job</th>
              <th>Location</th>
              <th>Type</th>
              <th>Vehicle</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const rota of filteredRotas) {
        const job = jobs.find(j => j?.id === rota.job_id);
        const vehicle = vehicles.find(v => v?.id === rota.vehicle_id);
        if (job) {
          htmlContent += `
            <tr>
              <td>${rota.assigned_date}</td>
              <td class="job-name">${job.name}</td>
              <td class="location">${job.location}</td>
              <td>${job.job_type.replace('_', ' ')}</td>
              <td>${vehicle ? vehicle.registration_number : '-'}</td>
            </tr>
          `;
        }
      }

      htmlContent += `</tbody></table>`;
    } else {
      // Full rota
      htmlContent += `
        <div class="header">
          <h1>Weekly Rota Schedule</h1>
          <p>Week of ${weekStart}</p>
        </div>
        <div class="info-grid">
          <div class="info-box">
            <p>Total Assignments</p>
            <div class="value">${filteredRotas.length}</div>
          </div>
          <div class="info-box">
            <p>Active Jobs</p>
            <div class="value">${jobIds.length}</div>
          </div>
          <div class="info-box">
            <p>Vehicles</p>
            <div class="value">${vehicleIds.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Date</th>
              <th>Job</th>
              <th>Location</th>
              <th>Type</th>
              <th>Vehicle</th>
            </tr>
          </thead>
          <tbody>
      `;

      // Group by staff for better readability
      const staffMap = new Map();
      for (const rota of filteredRotas) {
        if (!staffMap.has(rota.staff_id)) {
          staffMap.set(rota.staff_id, []);
        }
        staffMap.get(rota.staff_id).push(rota);
      }

      for (const [staffId, staffRotas] of staffMap) {
        const staffMember = await base44.entities.Staff.get(staffId).catch(() => null);
        for (const rota of staffRotas) {
          const job = jobs.find(j => j?.id === rota.job_id);
          const vehicle = vehicles.find(v => v?.id === rota.vehicle_id);
          if (job) {
            htmlContent += `
              <tr>
                <td class="job-name">${staffMember?.name || 'Unknown'}</td>
                <td>${rota.assigned_date}</td>
                <td class="job-name">${job.name}</td>
                <td class="location">${job.location}</td>
                <td>${job.job_type.replace('_', ' ')}</td>
                <td>${vehicle ? vehicle.registration_number : '-'}</td>
              </tr>
            `;
          }
        }
      }

      htmlContent += `</tbody></table>`;
    }

    htmlContent += `
      <div class="footer">
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>WorkRota Platform</p>
      </div>
      </body>
      </html>
    `;

    // Return HTML (can be converted to PDF by frontend using libraries like html2pdf)
    return Response.json({ 
      html: htmlContent,
      fileName: staffId ? `${staff.name}_schedule_${weekStart}.html` : `rota_${weekStart}.html`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});