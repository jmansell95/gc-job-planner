import React from 'react';
import {
  Database, Package, Cog, Wrench, Truck, Anchor, Plug, Link2, XCircle, Loader2,
} from 'lucide-react';

const TYPE_ICONS = {
  rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck,
  lifting: Anchor, portable_appliance: Plug,
};

/**
 * PandaScanConfirmCard — shown when a scanned Asset Panda barcode resolves to
 * a Panda object that has no local SiteAsset yet. Displays the live Panda
 * fields (name, serial, barcode, type, stock) and asks the user to confirm
 * before creating & linking the local record (which is also pushed back to
 * Asset Panda). Distinct blue styling differentiates it from the standard
 * ScanResultCard used for already-local assets.
 */
export default function PandaScanConfirmCard({ panda, confirming, onConfirm, onCancel }) {
  if (!panda) return null;
  const Icon = TYPE_ICONS[panda.asset_type] || Package;

  return (
    <div className="animate-pop-in bg-white rounded-2xl border-2 border-blue-300 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">New from Asset Panda</p>
          <p className="text-[11px] text-white/80">Not in your inventory yet — confirm to create &amp; link</p>
        </div>
        <button
          onClick={onCancel}
          disabled={confirming}
          className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition flex-shrink-0 disabled:opacity-50"
          aria-label="Dismiss"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Identity */}
      <div className="px-4 py-3.5 flex items-center gap-3 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900 truncate">{panda.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {panda.serial && (
              <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{panda.serial}</span>
            )}
            {panda.barcode && (
              <span className="text-[11px] text-blue-700 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                Barcode: {panda.barcode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meta chips */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-slate-100">
        {panda.asset_type && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
            {panda.asset_type}
          </span>
        )}
        {panda.stock_level && panda.stock_level !== 'unknown' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 capitalize">
            {panda.stock_level.replace(/_/g, ' ')}
          </span>
        )}
        {panda.group_label && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-600 truncate max-w-[160px]">
            <Database className="w-3 h-3" /> {panda.group_label}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex gap-2">
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm font-bold transition active:scale-95 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm disabled:opacity-60"
        >
          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {confirming ? 'Linking…' : 'Create & Link'}
        </button>
        <button
          onClick={onCancel}
          disabled={confirming}
          className="px-3 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition active:scale-95 disabled:opacity-60"
          aria-label="Cancel"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}