import React from 'react';
import { Printer } from 'lucide-react';

const TYPE_LABELS = {
  rig: 'Rigs', machinery: 'Machinery', trailer: 'Trailers', vehicle: 'Vehicles',
  lifting: 'Lifting Gear', portable_appliance: 'Portable Appliances',
};

/**
 * Printable full asset weight register — a catalogue of every SiteAsset
 * with its weight_kg, grouped by asset type, with subtotals per group and
 * a grand total. Uses the existing window.open + print pattern.
 */
export default function PrintWeightRegister({ assets }) {
  const handlePrint = () => {
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const grouped = {};
    for (const a of assets) {
      const t = a.asset_type || 'machinery';
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(a);
    }

    const typeOrder = ['rig', 'machinery', 'trailer', 'vehicle', 'lifting', 'portable_appliance'];
    const sections = typeOrder.filter(t => grouped[t]).map(t => {
      const items = grouped[t];
      const subtotal = items.reduce((s, a) => s + (Number(a.weight_kg) || 0), 0);
      const rows = items.map((a, i) => `<tr>
        <td style="text-align:center;padding:5px 8px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;">${a.name || 'Unnamed'}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${a.serial_number || a.fleet_number || '—'}</td>
        <td style="text-align:center;padding:5px 8px;border-bottom:1px solid #e2e8f0;">${a.panda_asset_id ? 'Panda' : 'Local'}</td>
        <td style="text-align:right;padding:5px 8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${a.weight_kg ? Math.round(a.weight_kg) + ' kg' : '—'}</td>
      </tr>`).join('');
      return `<h3 style="font-size:15px;font-weight:700;color:#2E5A1A;margin:20px 0 8px;border-bottom:2px solid #d1fae5;padding-bottom:4px;">${TYPE_LABELS[t] || t} <span style="font-size:12px;color:#64748b;font-weight:400;">(${items.length} items · ${Math.round(subtotal)} kg)</span></h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <thead><tr><th style="text-align:center;width:36px;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">#</th><th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Asset</th><th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Serial / FAA</th><th style="text-align:center;width:60px;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Source</th><th style="text-align:right;width:80px;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Weight</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }).join('');

    const grandTotal = assets.reduce((s, a) => s + (Number(a.weight_kg) || 0), 0);
    const withWeight = assets.filter(a => a.weight_kg).length;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Asset Weight Register — Ground Control</title>
    <style>
      @page { margin: 1.5cm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; }
      .header { background: linear-gradient(135deg, #2E5A1A, #1c4a12); color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px; }
      .header h1 { margin: 0; font-size: 22px; font-weight: 800; } .header .sub { font-size: 13px; opacity: 0.85; margin-top: 4px; }
      .summary { display: flex; gap: 12px; margin-bottom: 20px; }
      .summary-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; text-align: center; }
      .summary-card .num { font-size: 24px; font-weight: 800; color: #2E5A1A; } .summary-card .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-top: 2px; }
      .grand-total { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 10px; padding: 14px 20px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; }
      .grand-total .label { font-size: 14px; font-weight: 700; color: #166534; } .grand-total .value { font-size: 20px; font-weight: 800; color: #166534; }
      .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
    </style></head><body>
      <div class="header"><h1>Asset Weight Register</h1><div class="sub">Ground Control — ${dateStr}</div></div>
      <div class="summary">
        <div class="summary-card"><div class="num">${assets.length}</div><div class="lbl">Total Assets</div></div>
        <div class="summary-card"><div class="num">${withWeight}</div><div class="lbl">With Weight Data</div></div>
        <div class="summary-card"><div class="num">${assets.length - withWeight}</div><div class="lbl">Missing Weight</div></div>
      </div>
      ${sections}
      <div class="grand-total"><span class="label">Grand Total Weight</span><span class="value">${Math.round(grandTotal)} kg</span></div>
      <div class="footer">Ground Control — Asset Weight Register · Generated ${new Date().toLocaleString('en-GB')}</div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to print the weight register.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  return (
    <button onClick={handlePrint} type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
      <Printer className="w-3.5 h-3.5" /> Weight Register
    </button>
  );
}