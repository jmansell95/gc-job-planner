import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// processSiteCollection — handles the site collection & transfer
// workflow for physical assets moving between sites.
//
// Actions:
//   'collect'           — scan an item on site, mark it in_transit,
//                         link it to the active collection delivery.
//                         Splits the JobCostItem if collecting a partial
//                         quantity.
//   'complete_return'   — finish collection, return all collected
//                         items to the depot (yard / returned).
//   'complete_transfer' — finish collection, transfer all collected
//                         items to a DIFFERENT job. Marks the original
//                         cost items as returned, creates new cost
//                         items on the destination job (in_transit),
//                         and creates a chained site_delivery task.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ---------- COLLECT: scan an item on site ----------
    if (action === 'collect') {
      const { delivery_id, site_asset_id, serial_number, quantity_collected } = body;
      if (!delivery_id) return Response.json({ ok: false, error: 'delivery_id required' }, { status: 400 });

      const delivery = await base44.asServiceRole.entities.DeliveryLog.get(delivery_id).catch(() => null);
      if (!delivery) return Response.json({ ok: false, error: 'Delivery not found' }, { status: 404 });

      // Resolve the SiteAsset by id or serial number
      let asset = null;
      if (site_asset_id) {
        asset = await base44.asServiceRole.entities.SiteAsset.get(site_asset_id).catch(() => null);
      } else if (serial_number) {
        const matches = await base44.asServiceRole.entities.SiteAsset.filter({ serial_number });
        asset = matches[0] || null;
      }
      if (!asset) return Response.json({ ok: false, error: 'Asset not found' }, { status: 404 });

      // Find the JobCostItem on this job with this asset currently on site
      const costItems = await base44.asServiceRole.entities.JobCostItem.filter({
        job_id: delivery.job_id,
        site_asset_id: asset.id,
        current_location: 'site'
      });
      if (costItems.length === 0) {
        return Response.json({ ok: false, error: 'Item is not on this site (already collected or not assigned)' }, { status: 404 });
      }

      const item = costItems[0];
      const totalQty = Math.max(1, Number(item.quantity) || 1);
      const collectQty = Math.max(1, Math.min(Number(quantity_collected) || 1, totalQty));
      const now = new Date().toISOString();

      // Link the item to the delivery
      const existingIds = (delivery.linked_cost_item_ids || '').split(',').map(s => s.trim()).filter(Boolean);

      if (collectQty >= totalQty) {
        // Collecting all — mark the whole item as in_transit
        await base44.asServiceRole.entities.JobCostItem.update(item.id, {
          current_location: 'in_transit',
          location_updated_at: now,
        });
        if (!existingIds.includes(item.id)) existingIds.push(item.id);
        await base44.asServiceRole.entities.DeliveryLog.update(delivery_id, {
          linked_cost_item_ids: existingIds.join(','),
        });
        return Response.json({ ok: true, item_id: item.id, quantity: collectQty, split: false, asset_name: asset.name });
      }

      // Partial collection — split the cost item
      const remainingQty = totalQty - collectQty;
      await base44.asServiceRole.entities.JobCostItem.update(item.id, { quantity: remainingQty });

      const newItem = await base44.asServiceRole.entities.JobCostItem.create({
        job_id: item.job_id,
        category: item.category,
        site_asset_id: item.site_asset_id,
        description: item.description,
        unit_cost: item.unit_cost,
        quantity: collectQty,
        unit_label: item.unit_label,
        hire_status: item.hire_status,
        current_location: 'in_transit',
        location_updated_at: now,
        supplier_id: item.supplier_id || '',
        rate_card_item_id: item.rate_card_item_id || '',
        reference_number: item.reference_number || '',
        responsible_person: item.responsible_person || '',
        notes: (item.notes || '') + ' [split for partial collection]',
      });

      existingIds.push(newItem.id);
      await base44.asServiceRole.entities.DeliveryLog.update(delivery_id, {
        linked_cost_item_ids: existingIds.join(','),
      });
      return Response.json({ ok: true, item_id: newItem.id, quantity: collectQty, split: true, asset_name: asset.name });
    }

    // ---------- COMPLETE RETURN: return collected items to depot ----------
    if (action === 'complete_return') {
      const { delivery_id, signature_data_url, signed_by_name } = body;
      if (!delivery_id) return Response.json({ ok: false, error: 'delivery_id required' }, { status: 400 });

      const delivery = await base44.asServiceRole.entities.DeliveryLog.get(delivery_id).catch(() => null);
      if (!delivery) return Response.json({ ok: false, error: 'Delivery not found' }, { status: 404 });

      const linkedIds = (delivery.linked_cost_item_ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      let count = 0;

      for (const id of linkedIds) {
        const item = await base44.asServiceRole.entities.JobCostItem.get(id).catch(() => null);
        if (!item) continue;
        const isHired = item.category === 'hired_equipment';
        await base44.asServiceRole.entities.JobCostItem.update(id, {
          current_location: isHired ? 'returned' : 'yard',
          location_updated_at: now,
          return_destination: 'depot',
          ...(isHired ? { hire_status: 'off_hired', off_hire_date: today } : {}),
        });
        count++;
      }

      // Mark delivery completed with signature
      await base44.asServiceRole.entities.DeliveryLog.update(delivery_id, {
        status: 'completed',
        completed_at: now,
        ...(signature_data_url ? { signature_data_url } : {}),
        ...(signed_by_name ? { signed_by_name } : {}),
      });

      return Response.json({ ok: true, items_returned: count });
    }

    // ---------- COMPLETE TRANSFER: move collected items to another job ----------
    if (action === 'complete_transfer') {
      const { delivery_id, destination_job_id, destination_job_name, destination_address, signature_data_url, signed_by_name } = body;
      if (!delivery_id) return Response.json({ ok: false, error: 'delivery_id required' }, { status: 400 });
      if (!destination_job_id) return Response.json({ ok: false, error: 'destination_job_id required' }, { status: 400 });

      const delivery = await base44.asServiceRole.entities.DeliveryLog.get(delivery_id).catch(() => null);
      if (!delivery) return Response.json({ ok: false, error: 'Delivery not found' }, { status: 404 });

      const linkedIds = (delivery.linked_cost_item_ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const newItemIds = [];

      for (const id of linkedIds) {
        const item = await base44.asServiceRole.entities.JobCostItem.get(id).catch(() => null);
        if (!item) continue;

        // Mark original as returned (collected from site A)
        await base44.asServiceRole.entities.JobCostItem.update(id, {
          current_location: 'returned',
          location_updated_at: now,
          hire_status: 'off_hired',
          off_hire_date: today,
          return_destination: 'transferred',
        });

        // Create new cost item on the destination job
        const newItem = await base44.asServiceRole.entities.JobCostItem.create({
          job_id: destination_job_id,
          category: item.category === 'hired_equipment' ? 'internal_equipment' : item.category,
          site_asset_id: item.site_asset_id || '',
          description: item.description || '',
          unit_cost: item.unit_cost || 0,
          quantity: item.quantity || 1,
          unit_label: item.unit_label || 'day',
          hire_status: 'active',
          current_location: 'in_transit',
          location_updated_at: now,
          supplier_id: item.supplier_id || '',
          rate_card_item_id: item.rate_card_item_id || '',
          reference_number: item.reference_number || '',
          responsible_person: item.responsible_person || '',
          notes: `Transferred from ${delivery.job_name || 'previous site'}`,
        });
        newItemIds.push(newItem.id);
      }

      // Create a chained site_delivery task for the destination job
      const newDelivery = await base44.asServiceRole.entities.DeliveryLog.create({
        job_id: destination_job_id,
        job_name: destination_job_name || '',
        driver_staff_id: delivery.driver_staff_id || '',
        driver_staff_name: delivery.driver_staff_name || '',
        delivery_type: 'site_delivery',
        status: 'pending',
        items: `Transferred from ${delivery.job_name || 'previous site'} (${newItemIds.length} item${newItemIds.length !== 1 ? 's' : ''})`,
        linked_cost_item_ids: newItemIds.join(','),
        delivery_address: destination_address || '',
        scheduled_date: today,
        vehicle_id: delivery.vehicle_id || '',
        parent_delivery_id: delivery_id,
        handover_from_staff_name: delivery.driver_staff_name || '',
        notes: `Site-to-site transfer from ${delivery.job_name || 'previous job'}`,
      });

      // Mark original delivery completed with signature
      await base44.asServiceRole.entities.DeliveryLog.update(delivery_id, {
        status: 'completed',
        completed_at: now,
        ...(signature_data_url ? { signature_data_url } : {}),
        ...(signed_by_name ? { signed_by_name } : {}),
      });

      return Response.json({
        ok: true,
        items_transferred: newItemIds.length,
        new_delivery_id: newDelivery.id,
      });
    }

    return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}