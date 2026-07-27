import React from 'react';
import { Database, MapPin, Palette, CheckCircle2, AlertCircle, Clock, Box } from 'lucide-react';

const stockBadge = {
  in_stock: { label: 'In Stock', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  low_stock: { label: 'Low Stock', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  out_of_stock: { label: 'Out of Stock', cls: 'bg-red-50 text-red-700 border-red-200' },
  needs_service: { label: 'Needs Service', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  unknown: { label: 'Unknown', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const syncMeta = {
  synced: { label: 'Synced', icon: CheckCircle2, cls: 'text-emerald-600' },
  pending: { label: 'Pending', icon: Clock, cls: 'text-amber-600' },
  failed: { label: 'Failed', icon: AlertCircle, cls: 'text-red-600' },
  never: { label: 'Not synced', icon: AlertCircle, cls: 'text-slate-400' },
};

function fmtSync(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ts; }
}

/**
 * Shows the live Asset Panda inventory source for a single asset:
 * stock level, sync status, warehouse location and colour.
 * Rendered inside the Rig and Equipment detail drawers.
 */
export default function AssetPandaInfoPanel({ asset }) {
  if (!asset) return null;
  const hasPanda = !!asset.panda_asset_id;
  const sb = stockBadge[asset.stock_level || 'unknown'] || stockBadge.unknown;
  const sm = syncMeta[asset.sync_status || 'never'] || syncMeta.never;
  const SyncIcon = sm.icon;

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2.5 flex items-center gap-1.5">
        <Database className="w-3 h-3" /> Asset Panda · Inventory Source
      </p>
      {!hasPanda ? (
        <p className="text-xs text-slate-400 italic">Not linked to Asset Panda — this asset was created manually. Sync from the Fleet Hub to pull live stock levels.</p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${sb.cls}`}>
              <Box className="w-3 h-3" /> {sb.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${sm.cls}`}>
              <SyncIcon className="w-3.5 h-3.5" /> {sm.label}
              {asset.last_sync_timestamp && <span className="text-slate-400 font-normal">· {fmtSync(asset.last_sync_timestamp)}</span>}
            </span>
          </div>
          {(asset.storage_location || asset.colour) && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {asset.storage_location && (
                <div className="flex items-center gap-1.5 min-w-0"><MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /><span className="text-slate-500 flex-shrink-0">Location:</span><span className="font-medium text-slate-700 truncate">{asset.storage_location}</span></div>
              )}
              {asset.colour && (
                <div className="flex items-center gap-1.5 min-w-0"><Palette className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /><span className="text-slate-500 flex-shrink-0">Colour:</span><span className="font-medium text-slate-700 truncate">{asset.colour}</span></div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}