import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Batch goods-in commit — creates GoodsInReceipt records for all received
 * line items in one call and increments the on-hand stock for linked
 * ConsumableStockItem records.
 *
 * Payload: {
 *   receipts: [{ item_name, consumable_item_id, category, quantity_received, unit, supplier_name, po_number, notes }],
 *   received_by_staff_id, received_by_name, supplier_name, po_number
 * }
 * Returns: { success, receipts_created, stock_updated }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const receipts = Array.isArray(body?.receipts) ? body.receipts : [];
    const receivedByStaffId = body?.received_by_staff_id || user.id;
    const receivedByName = body?.received_by_name || user.full_name || '';
    const fallbackSupplier = body?.supplier_name || '';
    const fallbackPo = body?.po_number || '';

    if (receipts.length === 0) return Response.json({ error: 'No receipts to commit' }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];

    // Build the receipt payloads
    const receiptPayloads = receipts.map(r => ({
      item_name: r.item_name || '',
      consumable_item_id: r.consumable_item_id || null,
      category: r.category || 'other',
      quantity_received: Number(r.quantity_received) || 0,
      unit: r.unit || 'each',
      received_by_staff_id: receivedByStaffId,
      received_by_name: receivedByName,
      received_date: today,
      supplier_name: r.supplier_name || fallbackSupplier || null,
      po_number: r.po_number || fallbackPo || null,
      notes: r.notes || null,
      status: 'pending_verification',
    }));

    // Create all receipts in one batch
    const created = await base44.entities.GoodsInReceipt.bulkCreate(receiptPayloads);

    // Increment stock for linked consumable items
    const stockUpdates = [];
    const linkedReceipts = receipts.filter(r => r.consumable_item_id && Number(r.quantity_received) > 0);
    if (linkedReceipts.length > 0) {
      // Group by consumable_item_id to sum quantities
      const byItem = {};
      for (const r of linkedReceipts) {
        if (!byItem[r.consumable_item_id]) byItem[r.consumable_item_id] = 0;
        byItem[r.consumable_item_id] += Number(r.quantity_received);
      }
      // Fetch current stock levels
      const itemIds = Object.keys(byItem);
      const items = await base44.entities.ConsumableStockItem.filter({ id: { $in: itemIds } });
      for (const item of items) {
        const addQty = byItem[item.id] || 0;
        const newStock = (Number(item.current_stock) || 0) + addQty;
        stockUpdates.push({ id: item.id, current_stock: newStock });
      }
      if (stockUpdates.length > 0) {
        try { await base44.entities.ConsumableStockItem.bulkUpdate(stockUpdates); } catch (_) {}
      }
    }

    return Response.json({
      success: true,
      receipts_created: created.length || receiptPayloads.length,
      stock_updated: stockUpdates.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});