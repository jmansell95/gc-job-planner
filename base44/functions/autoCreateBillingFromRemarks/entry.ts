import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { log_id } = body;
    if (!log_id) return Response.json({ error: 'log_id required' }, { status: 400 });

    // Fetch the investigation log
    const log = await base44.asServiceRole.entities.InvestigationLog.get(log_id);
    if (!log) return Response.json({ error: 'Log not found' }, { status: 404 });

    // Use LLM to analyze the driller's remarks and identify billable events
    const remarks = log.remarks || log.description || log.progress_notes || '';
    if (!remarks || remarks.trim().length < 10) {
      return Response.json({ created: 0, message: 'No significant remarks to analyze' });
    }

    const prompt = `You are a drilling industry billing analyst. Analyze these driller diary remarks and identify any billable events that should be charged to the client.

Job: ${log.job_name || 'Unknown'}
Date: ${log.log_date || 'Unknown'}

Remarks:
${remarks}

Identify billable events such as:
- Standby/delay time caused by client
- Additional equipment mobilized
- Extra work beyond scope (additional boreholes, extra depth, casing)
- Waiting on materials/client access
- Weekend or out-of-hours work
- Aborted work due to client

Return a JSON object with this schema:
{
  "billable_items": [
    {
      "description": "Clear description of the billable event",
      "suggested_code": "Billing code or category (e.g. standby, additional_borehole, overtime, mobilization)",
      "quantity": number,
      "unit": "hours|days|each|metres",
      "reasoning": "Why this is billable based on the remarks"
    }
  ],
  "summary": "Brief summary of analysis"
}

Only include items that are clearly billable based on the remarks. If nothing is billable, return an empty array.`;

    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          billable_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                suggested_code: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                reasoning: { type: 'string' },
              },
            },
          },
          summary: { type: 'string' },
        },
      },
    });

    const analysis = llmResponse;
    if (!analysis.billable_items || analysis.billable_items.length === 0) {
      return Response.json({ created: 0, message: analysis.summary || 'No billable items identified', analysis });
    }

    // Create JobCostItem records for each identified billable event
    const itemsToCreate = analysis.billable_items.map(item => ({
      job_id: log.job_id,
      job_name: log.job_name,
      item_type: 'additional_work',
      description: item.description + ' (Auto-detected from driller diary)',
      quantity: item.quantity,
      unit: item.unit,
      source: 'driller_diary_auto',
      source_log_id: log_id,
      notes: 'Billing code: ' + item.suggested_code + ' · Reasoning: ' + item.reasoning,
      status: 'pending_review',
    }));

    const created = await base44.asServiceRole.entities.JobCostItem.bulkCreate(itemsToCreate);

    return Response.json({
      created: created.length,
      items: created,
      analysis: analysis,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}