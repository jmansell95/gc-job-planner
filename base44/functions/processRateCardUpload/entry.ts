import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const supplierId = body.supplier_id;
    const fileUrl = body.file_url;

    if (!supplierId || !fileUrl) {
      return Response.json({ error: 'supplier_id and file_url are required' }, { status: 400 });
    }

    // Verify the supplier exists
    const supplier = await base44.asServiceRole.entities.Supplier.get(supplierId);
    if (!supplier) return Response.json({ error: 'Supplier not found' }, { status: 404 });

    // Extract structured line items from the uploaded file
    const extractRes = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                category: { type: 'string', enum: ['labour', 'plant', 'materials'] },
                subcategory: { type: 'string' },
                price: { type: 'number' },
                price_text: { type: 'string' },
                unit: { type: 'string' },
                notes: { type: 'string' }
              }
            }
          }
        }
      }
    });

    if (extractRes.status === 'error' || !extractRes.output) {
      return Response.json({ error: extractRes.details || 'Could not read rate card file' }, { status: 422 });
    }

    const rawItems = Array.isArray(extractRes.output) ? extractRes.output : (extractRes.output.items || []);
    const items = rawItems.filter(i => i && i.description && String(i.description).trim());

    if (items.length === 0) {
      return Response.json({ error: 'No rate card line items could be read from this file' }, { status: 422 });
    }

    // Replace existing supplier items: delete old, insert new
    await base44.asServiceRole.entities.RateCardItem.deleteMany({
      rate_card_source: 'supplier',
      supplier_id: supplierId
    });

    const payload = items.map((i, idx) => ({
      category: i.category || 'plant',
      subcategory: i.subcategory || null,
      description: String(i.description).trim(),
      price: typeof i.price === 'number' ? i.price : null,
      price_text: i.price_text || (typeof i.price === 'string' ? i.price : null),
      unit: i.unit || null,
      notes: i.notes || null,
      rate_card_source: 'supplier',
      supplier_id: supplierId,
      sort_order: idx,
      is_active: true
    }));

    await base44.asServiceRole.entities.RateCardItem.bulkCreate(payload);

    // Update the supplier record with sync info
    await base44.asServiceRole.entities.Supplier.update(supplierId, {
      rate_card_file_url: fileUrl,
      rate_card_synced_at: new Date().toISOString(),
      rate_card_item_count: payload.length
    });

    return Response.json({ status: 'success', ingested: payload.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});