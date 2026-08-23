import React from 'react';
import { Printer } from 'lucide-react';
import { getPayloadStatus, calculateAxleGuidance } from '@/utils/loadWeight';

/**
 * Printable per-run load manifest — opens a print-optimised window showing
 * vehicle reg, driver name, each loaded item with its weight, a running
 * total, the vehicle payload limit, a safe-to-drive confirmation line, and
 * axle guidance. Uses the existing window.open + print pattern.
 */
export default function PrintLoadManifest({ delivery, vehicle, driverName, items, axleGuidanceNote }) {
  const handlePrint = () => {
    const totalKg = items.reduce((s, i) => s + (Number(i.weight_kg) || 0) * (Number(i.quantity) || 1), 0);
    const maxKg = vehicle?.max_weight_kg || null;
    const status = getPayloadStatus(totalKg, maxKg);
    const guidance = axleGuidanceNote || calculateAxleGuidance(items, vehicle).note;
    const dateStr = delivery?.scheduled_date
      ? new Date(delivery.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    let runningTotal = 0;
    const itemRows = items.map((item, i) => {
      const qty = Number(item.quantity) || 1;
      const w = (Number(item.weight_kg) || 0) * qty;
      runningTotal += w;
      return `<tr>
        <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${item.description || item.name || 'Item'}</td>
        <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #e2e8f0;">${qty > 1 ? qty + '×' : '1'}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e2e8f0;">${w > 0 ? Math.round(w) + ' kg' : '—'}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${runningTotal > 0 ? Math.round(runningTotal) + ' kg' : '—'}</td>
      </tr>`;
    }).join('');

    const statusColor = status.status === 'safe' ? '#16a34a' : status.status === 'near' ? '#d97706' : status.status === 'over' ? '#dc2626' : '#64748b';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Load Manifest — ${vehicle?.registration_number || 'Vehicle'}</title>
    <style>
      @page { margin: 1.5cm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; }
      .header { background: linear-gradient(135deg, #2E5A1A, #1c4a12); color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px; }
      .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
      .header .sub { font-size: 13px; opacity: 0.85; margin-top: 4px; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
      .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
      .meta-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
      .meta-card .value { font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { background: #f1f5f9; padding: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; font-weight: 700; text-align: left; border-bottom: 2px solid #e2e8f0; }
      th.center { text-align: center; } th.right { text-align: right; }
      .total-row td { font-weight: 800; background: #f0fdf4; border-top: 2px solid #16a34a; font-size: 14px; }
      .status-box { border: 2px solid ${statusColor}; background: ${statusColor}11; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
      .status-box .badge { background: ${statusColor}; color: white; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
      .status-box .detail { font-size: 13px; color: #1e293b; }
      .guidance { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
      .guidance .title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; font-weight: 700; margin-bottom: 4px; }
      .guidance .text { font-size: 13px; color: #334155; }
      .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
      .sign-line { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
      .sign-line .line { border-top: 1px solid #475569; padding-top: 4px; font-size: 11px; color: #64748b; }
    </style></head><body>
      <div class="header">
        <h1>Load Manifest</h1>
        <div class="sub">Ground Control — ${dateStr}</div>
      </div>
      <div class="meta-grid">
        <div class="meta-card"><div class="label">Vehicle</div><div class="value">${vehicle?.name || '—'}<br><span style="font-family:monospace;font-size:13px;">${vehicle?.registration_number || ''}</span></div></div>
        <div class="meta-card"><div class="label">Driver</div><div class="value">${driverName || '—'}</div></div>
        <div class="meta-card"><div class="label">Job / Destination</div><div class="value" style="font-size:13px;">${delivery?.job_name || '—'}<br><span style="font-size:11px;font-weight:400;color:#64748b;">${delivery?.delivery_address || delivery?.pickup_address || ''}</span></div></div>
      </div>
      <table>
        <thead><tr><th class="center" style="width:40px;">#</th><th>Item</th><th class="center" style="width:60px;">Qty</th><th class="right" style="width:80px;">Weight</th><th class="right" style="width:90px;">Running</th></tr></thead>
        <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">No items logged</td></tr>'}</tbody>
        <tfoot><tr class="total-row"><td colspan="3" style="text-align:right;padding:8px;">Total Loaded Weight:</td><td colspan="2" style="text-align:right;padding:8px;">${Math.round(totalKg)} kg${maxKg ? ' / ' + Math.round(maxKg) + ' kg limit' : ''}</td></tr></tfoot>
      </table>
      <div class="status-box">
        <span class="badge">${status.label}</span>
        <span class="detail">${maxKg ? Math.round(totalKg) + ' kg of ' + Math.round(maxKg) + ' kg payload used (' + Math.round(status.pct) + '%)' : 'No payload limit set for this vehicle.'}</span>
      </div>
      <div class="guidance">
        <div class="title">Axle Load Guidance</div>
        <div class="text">${guidance}</div>
      </div>
      ${vehicle?.height_m ? `<div class="guidance"><div class="title">Vehicle Height</div><div class="text">Vehicle height: ${vehicle.height_m} m — check bridge clearance on route.</div></div>` : ''}
      <div class="sign-line">
        <div class="line">Driver signature: </div>
        <div class="line">Dispatcher signature: </div>
      </div>
      <div class="footer">Ground Control — Load Manifest · Generated ${new Date().toLocaleString('en-GB')}</div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to print the load manifest.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  return (
    <button onClick={handlePrint} type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
      <Printer className="w-3.5 h-3.5" /> Load Manifest
    </button>
  );
}