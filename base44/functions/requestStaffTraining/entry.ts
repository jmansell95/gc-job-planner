import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TYPE_LABELS = {
  cscs_card: 'CSCS Card',
  cpcs_card: 'CPCS Card',
  npors_card: 'NPORS Card',
  first_aid_cert: 'First Aid Certificate',
  driver_license: 'Driver License',
  dbs_certificate: 'DBS Certificate',
  forklift: 'Forklift Training',
  other: 'Training',
};

function defaultDate(daysAhead = 14) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return d.toISOString().split('T')[0];
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { staff_id, staff_name, request_text, qualification_type, preferred_date } = body;
    if (!staff_id || !staff_name) {
      return Response.json({ error: 'staff_id and staff_name are required' }, { status: 400 });
    }

    const docType = TYPE_LABELS[qualification_type] || 'training';

    const todayStr = new Date().toISOString().split('T')[0];
    const prompt = `A UK construction field worker named "${staff_name}" is requesting training via their self-service portal.
Today's date is ${todayStr}.
Request: "${request_text || `Renewal for ${docType}`}"
${preferred_date ? `Preferred date: ${preferred_date}` : 'No specific date — suggest one 2-4 weeks from now.'}

Suggest a practical UK training course. Return:
- title: A clear course title (e.g. "CSCS Skilled Worker Card Renewal", "First Aid at Work (3 Day)", "NPORS Plant Operator")
- category: One of: cscs_card, cpcs_card, npors_card, first_aid_cert, driver_license, dbs_certificate, forklift, other
- provider: A real UK training provider name (e.g. "CITB", "St John Ambulance", "3B Training", "SSSTS Course Provider")
- suggested_date: A date in YYYY-MM-DD format (2-4 weeks from now, ideally a weekday)

Keep it realistic for the UK construction industry.`;

    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        category: { type: 'string' },
        provider: { type: 'string' },
        suggested_date: { type: 'string' },
      },
    };

    const suggestion = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
    });

    const startDate = suggestion.suggested_date || preferred_date || defaultDate();

    // Create the training course
    const course = await base44.entities.TrainingCourse.create({
      title: suggestion.title || `${docType} Renewal`,
      category: suggestion.category || qualification_type || 'other',
      provider: suggestion.provider || '',
      start_date: startDate,
      end_date: startDate,
      start_time: '08:00',
      end_time: '16:00',
      status: 'scheduled',
      description: `Requested by ${staff_name} via self-service portal. ${request_text || ''}`.trim(),
    });

    // Create the booking for the staff member
    const booking = await base44.entities.TrainingBooking.create({
      course_id: course.id,
      staff_id,
      staff_name,
      status: 'booked',
    });

    // Notify admins so they can confirm/arrange
    try {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins) {
        if (admin.email) {
          await base44.integrations.Core.SendEmail({
            to: admin.email,
            subject: `Training Request — ${staff_name}: ${course.title}`,
            body: `${staff_name} has requested training via the self-service portal.\n\n` +
              `Suggested course: ${course.title}\n` +
              `Provider: ${course.provider || 'TBC'}\n` +
              `Date: ${startDate}\n\n` +
              `Please review and confirm the booking in the Training Manager (Admin → Training).`,
          });
        }
      }
    } catch (_) {
      // Email failures shouldn't block the request
    }

    return Response.json({ course, booking, suggestion });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}