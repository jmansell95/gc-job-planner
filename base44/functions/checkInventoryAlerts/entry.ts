import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// ============================================================
// checkInventoryAlerts — scans SiteAssets for low or out-of-stock
// items (from Asset Panda sync) and emails admins a digest so
// the yard manager can replenish gear before it runs out.
// Uses the 'inventory_alert' email template.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Load the inventory_alert email template
    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'inventory_alert' });
    const cfg = settings[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Inventory alert disabled' });
    }
    if (!cfg.template) {
      return Response.json({ skipped: true, reason: 'No template configured for inventory alert' });
    }

    // Find assets with low or out-of-stock levels (skip demo data)
    const assets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 2000);
    const flagged = assets.filter((a: any) =>
      a.is_active !== false &&
      a.is_demo_data !== true &&
      (a.stock_level === 'low_stock' || a.stock_level === 'out_of_stock' || a.stock_level === 'needs_service')
    );

    // Also check consumable stock items for low stock (current <= minimum)
    const consumables = await base44.asServiceRole.entities.ConsumableStockItem.filter({ is_active: true });
    const lowStockConsumables = consumables.filter((c: any) => {
      const stock = Number(c.current_stock) || 0;
      const min = Number(c.minimum_stock) || 0;
      return min > 0 && stock <= min;
    });

    if (flagged.length === 0 && lowStockConsumables.length === 0) {
      return Response.json({ sent: false, reason: 'No low-stock items', checked: assets.length });
    }

    // Build recipients
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter((u: any) => u.role === 'admin');
    let recipients: string[] = [];
    if (cfg.recipient_emails) {
      recipients = cfg.recipient_emails.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      recipients = admins.map((u: any) => u.email);
    }
    if (recipients.length === 0) {
      return Response.json({ skipped: true, reason: 'No recipients configured' });
    }

    const today = new Date().toLocaleDateString('en-GB');
    const baseUrl = await getAppBaseUrl(base44);

    const STATUS_LABEL = {
      low_stock: 'Low Stock',
      out_of_stock: 'Out of Stock',
      needs_service: 'Needs Service',
    };

    // Group by status for the list
    const assetLines = flagged.map((a: any) => {
      const status = STATUS_LABEL[a.stock_level] || a.stock_level;
      const loc = a.storage_location ? ` (${a.storage_location})` : '';
      const serial = a.serial_number ? ` [${a.serial_number}]` : '';
      return `   • ${a.name}${serial} — ${status}${loc}`;
    }).join('\n');

    const consumableLines = lowStockConsumables.map((c: any) => {
      const stock = Number(c.current_stock) || 0;
      const min = Number(c.minimum_stock) || 0;
      const loc = c.storage_location ? ` (${c.storage_location})` : '';
      return `   • ${c.name} — ${stock}/${min} ${c.unit || 'each'}${loc}`;
    }).join('\n');

    const lines = [
      assetLines,
      consumableLines ? `\nConsumables below minimum stock:\n${consumableLines}` : '',
    ].filter(Boolean).join('\n');

    const totalAlerts = flagged.length + lowStockConsumables.length;
    const subject = cfg.subject
      ? cfg.subject.replace(/\{alert_count\}/g, String(totalAlerts))
      : `Inventory Alert — ${totalAlerts} item(s) need attention`;

    const text = cfg.template
      .replace(/\{alert_count\}/g, String(totalAlerts))
      .replace(/\{alert_list\}/g, lines)
      .replace(/\{date\}/g, today);

    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/assets', 'Open Asset Hub');

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body: styledHtml(bodyHtml, cfg),
      });
    }

    return Response.json({
      sent: true,
      assets_flagged: flagged.length,
      consumables_flagged: lowStockConsumables.length,
      notified_recipients: recipients.length,
      breakdown: {
        low_stock: flagged.filter(a => a.stock_level === 'low_stock').length,
        out_of_stock: flagged.filter(a => a.stock_level === 'out_of_stock').length,
        needs_service: flagged.filter(a => a.stock_level === 'needs_service').length,
        consumables_below_min: lowStockConsumables.length,
      },
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}