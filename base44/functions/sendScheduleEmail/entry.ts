import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { weekStart, staffId, recipientEmail } = await req.json();

    // Fetch schedule data
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

    // Build email body
    let emailBody = '';
    let subject = '';

    if (staffId && staff) {
      subject = `Your Weekly Schedule - Week of ${weekStart}`;
      emailBody = `
Hi ${staff.name},

Here is your schedule for the week of ${weekStart}:

ASSIGNMENTS:
`;
      for (const rota of filteredRotas) {
        const job = jobs.find(j => j?.id === rota.job_id);
        const vehicle = vehicles.find(v => v?.id === rota.vehicle_id);
        if (job) {
          emailBody += `
• Date: ${rota.assigned_date}
  Job: ${job.name}
  Location: ${job.location}
  Type: ${job.job_type.replace('_', ' ')}
  Vehicle: ${vehicle ? `${vehicle.registration_number} (${vehicle.name})` : 'Not assigned'}
  Equipment: ${job.equipment_needed || 'None specified'}
  Notes: ${job.notes || 'None'}

`;
        }
      }
    } else {
      subject = `Weekly Rota Schedule - Week of ${weekStart}`;
      emailBody = `
Hello,

The weekly rota schedule for ${weekStart} is attached.

Total Assignments: ${filteredRotas.length}
Active Jobs: ${jobIds.length}
Vehicles: ${vehicleIds.length}

Please review and confirm your team's availability.

`;
    }

    emailBody += `

Best regards,
WorkRota Platform
`;

    // Send email using Core integration
    await base44.integrations.Core.SendEmail({
      to: recipientEmail,
      subject: subject,
      body: emailBody,
      from_name: 'WorkRota'
    });

    return Response.json({ 
      success: true,
      message: `Schedule emailed to ${recipientEmail}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});