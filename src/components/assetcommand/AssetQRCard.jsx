import React, { useState } from 'react';
import { QrCode, Printer, Copy, Check } from 'lucide-react';
import { safeFormat } from '@/utils/format';

/**
 * Asset QR Card — generates a scannable QR code encoding a compact
 * compliance summary for the asset, plus a print-friendly label card.
 * Scanning with any phone QR reader shows the asset name, type, serial
 * and current compliance/expiry so crews can verify fitness-for-use on site.
 */
export default function AssetQRCard({ asset }) {
  const [copied, setCopied] = useState(false);

  if (!asset) return null;

  // QR encodes the serial number (or name fallback) so the Asset Lens camera
  // can scan it and instantly match the asset. The human-readable summary is
  // shown below for anyone scanning with a generic phone QR reader.
  const qrData = asset.serial_number || asset.name || asset.id;
  const summary = [
    `ASSET: ${asset.name}`,
    `TYPE: ${(asset.asset_type || '').toUpperCase()}`,
    asset.serial_number ? `SERIAL: ${asset.serial_number}` : '',
    `STATUS: ${(asset.compliance_status || 'unknown').toUpperCase()}`,
    asset.compliance_expiry_date ? `EXPIRES: ${safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy')}` : '',
    asset.next_service_date ? `NEXT SERVICE: ${safeFormat(asset.next_service_date, 'dd MMM yyyy')}` : '',
  ].filter(Boolean).join('\n');

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(qrData)}`;

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) return;
    w.document.write(`
      <html><head><title>Asset Label — ${asset.name}</title>
      <style>
        body { font-family: Inter, sans-serif; margin: 0; padding: 24px; text-align: center; }
        .card { border: 2px solid #2E5A1A; border-radius: 12px; padding: 20px; max-width: 360px; margin: 0 auto; }
        h2 { margin: 0 0 4px; font-size: 18px; color: #1c4a12; }
        .meta { font-size: 12px; color: #475569; margin: 2px 0; }
        .badge { display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        img { width: 200px; height: 200px; }
      </style></head>
      <body>
        <div class="card">
          <h2>${asset.name}</h2>
          <div class="meta">${(asset.asset_type || '').toUpperCase()}${asset.serial_number ? ' · ' + asset.serial_number : ''}</div>
          <div class="badge">${(asset.compliance_status || 'unknown').toUpperCase()}${asset.compliance_expiry_date ? ' · EXP ' + safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy') : ''}</div>
          <img src="${qrSrc}" alt="QR" />
          <div class="meta">Scan with Asset Lens · Ground Control</div>
        </div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
          <QrCode className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800">On-Site QR Code</p>
          <p className="text-[10px] text-slate-400">Scan to verify asset fitness for use</p>
        </div>
      </div>
      <div className="p-5 flex flex-col items-center text-center">
        <div className="w-44 h-44 rounded-xl border-2 border-slate-200 overflow-hidden bg-white flex items-center justify-center mb-3">
          <img src={qrSrc} alt="Asset QR" className="w-full h-full" />
        </div>
        <pre className="text-[10px] text-slate-500 bg-slate-50 rounded-lg p-2.5 w-full text-left whitespace-pre-wrap font-mono leading-relaxed mb-3 max-h-32 overflow-y-auto">{summary}</pre>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition">
            <Printer className="w-3.5 h-3.5" /> Print Label
          </button>
          <button onClick={handleCopy} type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}