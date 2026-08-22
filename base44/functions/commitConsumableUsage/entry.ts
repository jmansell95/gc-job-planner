import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Commits consumable usage — decrements warehouse stock and creates a cost
 * record against either a job or a service/repair.
 *
 * For jobs: creates a JobCostItem (category: purchased_equipment) so the
 *   consumable cost flows into the job's financials.
 * For service/repair: updates the ServiceRecord's consumables_cost +
 *   consumables_summary so the repair cost includes parts used.
 *
 * Payload: {
 *   consumable_item_id: string,
 *   quantity: number,
 *   usage_type: 'job' | 'service_repair',
 *   job_id?: string,
 *   service_record_id?: string,
 *   staff_id: string,
 *   staff_name: string,
 *   notes?: string
 * }
 * Returns: { success, stock_remaining, cost, cost_item_id?, service_record_id? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const consumableItemId = body?.consumable_item_id;
    const quantity = Number(body?.quantity) || 1;
    const usageType = body?.usage_type || 'job';
    const jobId = body?.job_id || '';
    const serviceRecordId = body?.service_record_id || '';
    const staffId = body?.staff_id || user.id;
    const staffName = body?.staff_name || user.full_name || '';
    const notes = body?.notes || '';

    if (!consumableItemId) return Response.json({ error: 'Consumable item required' }, { status: 400 });
    if (quantity < 1) return Response.json({ error: 'Quantity must be at least 1' }, { status: 400 });

    // Fetch the consumable
    const item = await base44.entities.ConsumableStockItem.get(consumableItemId);
    if (!item) return Response.json({ error: 'Consumable not found' }, { status: 404 });

    // Check stock
    const currentStock = Number(item.current_stock) || 0;
    if (currentStock < quantity) {
      return Response.json({
        error: `Insufficient stock — only ${currentStock} ${item.unit || 'each'} available`,
      }, { status: 400 });
    }

    // Decrement stock
    const newStock = currentStock - quantity;
    await base44.entities.ConsumableStockItem.update(consumableItemId, { current_stock: newStock });

    const unitCost = Number(item.unit_cost) || 0;
    const totalCost = unitCost * quantity;
    const today = new Date().toISOString().split('T')[0];
    const summaryLine = `${quantity}× ${item.name} @ £${unitCost.toFixed(2)}/${item.unit || 'each'} = £${totalCost.toFixed(2)}${notes ? ' — ' + notes : ''}`;

    const result = { success: true, stock_remaining: newStock, cost: totalCost };

    if (usageType === 'job' && jobId) {
      const costItem = await base44.entities.JobCostItem.create({
        job_id: jobId,
        category: 'purchased_equipment',
        description: `${item.name} (consumable)`,
        unit_cost: unitCost,
        quantity,
        unit_label: item.unit || 'each',
        start_date: today,
        notes: `Consumed from warehouse stock by ${staffName}${notes ? ' — ' + notes : ''}`,
      });
      result.cost_item_id = costItem.id;
    } else if (usageType === 'service_repair' && serviceRecordId) {
      const record = await base44.entities.ServiceRecord.get(serviceRecordId);
      if (!record) return Response.json({ error: 'Service record not found' }, { status: 404 });

      const existingCost = Number(record.consumables_cost) || 0;
      const existingSummary = record.consumables_summary || '';
      const newSummary = existingSummary ? `${existingSummary}\n${summaryLine}` : summaryLine;

      await base44.entities.ServiceRecord.update(serviceRecordId, {
        consumables_cost: existingCost + totalCost,
        consumables_summary: newSummary,
      });
      result.service_record_id = serviceRecordId;
    } else {
      return Response.json({ error: 'Must specify a job_id or service_record_id' }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});