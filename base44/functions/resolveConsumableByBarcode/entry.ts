import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Looks up a ConsumableStockItem by barcode, SKU, or name.
 * Used by the Goods-In scanner to match scanned barcodes against the catalog.
 *
 * Payload: { scan: string }
 * Returns: { item: ConsumableStockItem | null, source: 'catalog' | 'none' }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scan = String(body?.scan || '').trim();
    if (!scan) return Response.json({ source: 'none', item: null });

    const q = scan.toLowerCase();

    // Fetch all active consumables (catalog is small enough for a single fetch)
    const items = await base44.entities.ConsumableStockItem.filter({ is_active: true });

    // Exact barcode match first
    let found = items.find(c => {
      const bc = String(c.barcode || '').toLowerCase().trim();
      return bc && bc === q;
    });
    // Then exact SKU match
    if (!found) {
      found = items.find(c => {
        const sku = String(c.sku || '').toLowerCase().trim();
        return sku && sku === q;
      });
    }
    // Then exact name match
    if (!found) {
      found = items.find(c => {
        const nm = String(c.name || '').toLowerCase().trim();
        return nm && nm === q;
      });
    }
    // Then barcode contains
    if (!found) {
      found = items.find(c => {
        const bc = String(c.barcode || '').toLowerCase().trim();
        return bc && bc.includes(q);
      });
    }

    return Response.json({
      source: found ? 'catalog' : 'none',
      item: found || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});