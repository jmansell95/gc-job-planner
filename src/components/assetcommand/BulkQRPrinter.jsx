import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Printer, X, QrCode, Search, Loader2 } from 'lucide-react';

/**
 * Bulk QR Printer — generates a printable sheet of QR code labels for
 * selected assets. Each label encodes the asset's serial number so it can
 * be scanned by the Asset Lens camera to instantly pull up the asset.
 */
export default function BulkQRPrinter({ onClose }) {
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return assets;
    return assets.filter(a =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.serial_number || '').toLowerCase().includes(q) ||
      (a.asset_type || '').toLowerCase().includes(q)
    );
  }, [assets, search]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map(a => a.id)));
  const clearAll = () => setSelected(new Set());

  const selectedAssets = assets.filter(a => selected.has(a.id));

  const handlePrint = () => {
    if (selectedAssets.length === 0) return;
    const labels = selectedAssets.map(a => {
      const qrData = a.serial_number || a.name || a.id;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=2&data=${encodeURIComponent(qrData)}`;
      return `
        <div class="label">
          <img src="${qrSrc}" alt="QR" />
          <div class="name">${a.name}</div>
          <div class="serial">${a.serial_number || ''}</div>
          <div class="type">${(a.asset_type || '').toUpperCase()}</div>
        </div>`;
    }).join('');

    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    w.document.write(`
      <html><head><title>Asset QR Labels — ${selectedAssets.length} labels</title>
      <style>
        @page { margin: 12mm; }
        body { font-family: Inter, sans-serif; margin: 0; padding: 0; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
        .label { border: 2px solid #2E5A1A; border-radius: 10px; padding: 10px; text-align: center; page-break-inside: avoid; }
        .label img { width: 130px; height: 130px; }
        .name { font-size: 12px; font-weight: 700; color: #1c4a12; margin-top: 6px; line-height: 1.2; }
        .serial { font-size: 10px; color: #475569; font-family: monospace; margin-top: 2px; }
        .type { font-size: 9px; color: #64748b; text-transform: uppercase; margin-top: 2px; font-weight: 600; }
        h1 { font-size: 14px; color: #2E5A1A; margin-bottom: 12px; }
      </style></head>
      <body>
        <h1>Ground Control — Asset QR Labels (${selectedAssets.length})</h1>
        <p style="font-size:10px;color:#64748b;margin-bottom:16px;">Scan with the Logistics Hub in the GC app to view details, log service, or book to a vehicle.</p>
        <div class="grid">${labels}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><QrCode className="w-4 h-4 text-emerald-700" /></div>
            <div>
              <h3 className="font-bold text-slate-900">Print QR Labels</h3>
              <p className="text-[11px] text-slate-400">Generate printable QR labels for assets & vans</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <button onClick={selectAll} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200">Select All</button>
            <button onClick={clearAll} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200">Clear</button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
              {filtered.map(a => {
                const isSel = selected.has(a.id);
                return (
                  <button key={a.id} onClick={() => toggle(a.id)}
                    className={`text-left p-2.5 rounded-lg border-2 transition ${isSel ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${isSel ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                        {isSel && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{a.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{a.serial_number || '—'}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selected.size > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-700" />
              <span className="text-sm font-medium text-emerald-800 flex-1">{selected.size} asset{selected.size > 1 ? 's' : ''} selected</span>
              <span className="text-[11px] text-emerald-600">QR encodes serial number — scannable by Logistics Hub</span>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button onClick={handlePrint} disabled={selected.size === 0}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            <Printer className="w-4 h-4" /> Print {selected.size > 0 ? `${selected.size} Label${selected.size > 1 ? 's' : ''}` : 'Labels'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}