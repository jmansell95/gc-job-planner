import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TYPE_LABELS = {
  cscs_card: 'CSCS card',
  cpcs_card: 'CPCS card',
  npors_card: 'NPORS card',
  first_aid_cert: 'First Aid certificate',
  driver_license: 'UK driving licence',
  dbs_certificate: 'DBS certificate',
  forklift: 'forklift training certificate',
  other: 'qualification or training certificate',
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url, back_file_url, qualification_type } = body;
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    const docType = TYPE_LABELS[qualification_type] || 'document';
    const isCard = ['cscs_card', 'cpcs_card', 'npors_card', 'driver_license'].includes(qualification_type);

    const prompt = `You are an expert at reading UK construction site credentials and certificates.
This image is the ${back_file_url ? 'BACK' : 'FRONT'} of a ${docType}.
${back_file_url ? 'The front image is also provided for context.' : ''}

Extract the following information visible on the card/certificate:
- title: The full official name/title of the qualification, card or certificate (e.g. "CSCS Skilled Worker Card", "First Aid at Work", "Category C Driving Licence")
- card_number: The registration number, card number, serial number or reference number (if visible)
- issue_date: The issue/valid-from date in YYYY-MM format (if visible). If only a year is shown use YYYY-01.
- expiry_date: The expiry/valid-to date in YYYY-MM format (if visible). If only a year is shown use YYYY-12.

Return null for any field you cannot clearly read from the image. Do not guess or fabricate values.`;

    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        card_number: { type: 'string' },
        issue_date: { type: 'string' },
        expiry_date: { type: 'string' },
      },
    };

    const fileUrls = back_file_url ? [file_url, back_file_url] : [file_url];

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: fileUrls,
      response_json_schema: schema,
    });

    return Response.json({ extracted: result, is_card: isCard });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}