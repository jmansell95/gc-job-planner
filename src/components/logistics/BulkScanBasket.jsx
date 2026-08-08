import React from 'react';
import { X, Trash2, Package, Weight, Box } from 'lucide-react';

/**
 * Reusable basket list for bulk-scanned assets. Shows each item with a
 * remove button, plus aggregate weight/volume. Used by both the Asset Lens
 * (bulk mode) and the full-screen Asset Scanner kiosk page.
 */
export default function BulkScanBasket({ items, onRemove, onClear, compact = false }) {
  if (!items || items.length === 0) return null;

  const totalWeight = items.reduce((sum, a) => sum + (Number(a.weight_kg) || 0), 0);
  const totalVolume = items.reduce((sum, a) => sum + (Number(a.volume_m3) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-emerald-600" />
          {items.length} item{items.length !== 1 ? 's' : ''} in basket
        </p>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear all
          </button>
        )}
      </div>

      <div className={`space-y-1.5 ${compact ? 'max-h-40' : 'max-h-64'} overflow-y-auto -mx-1 px-1`}>
        {items.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg px-3 py-2.5 animate-pop-in"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{a.name}</p>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {a.serial_number || '—'}
              </p>
            </div>
            {onRemove && (
              <button
                onClick={() => onRemove(a.id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {(totalWeight > 0 || totalVolume > 0) && (
        <div className="flex items-center gap-3 text-[11px] text-slate-500 px-1 pt-0.5">
          {totalWeight > 0 && (
            <span className="flex items-center gap-1">
              <Weight className="w-3 h-3" /> {Math.round(totalWeight)} kg
            </span>
          )}
          {totalVolume > 0 && (
            <span className="flex items-center gap-1">
              <Box className="w-3 h-3" /> {totalVolume.toFixed(2)} m³
            </span>
          )}
        </div>
      )}
    </div>
  );
}