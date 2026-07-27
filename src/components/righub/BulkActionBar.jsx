import React from 'react';
import { Lock, X, CheckSquare } from 'lucide-react';

/**
 * Sticky bottom action bar shown when assets are selected in bulk mode.
 * Lets the user view all certificates for the selected assets at once.
 */
export default function BulkActionBar({ count, total, onClear, onSelectAll, onViewCerts }) {
  if (!count) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl ring-1 ring-white/10 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CheckSquare className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="font-semibold text-sm">{count} selected</span>
          {total != null && <span className="text-xs text-white/50 hidden sm:inline">of {total}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onSelectAll && count < total && (
            <button onClick={onSelectAll} className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg transition">Select all</button>
          )}
          <button onClick={onViewCerts} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition">
            <Lock className="w-3.5 h-3.5" /> View Certificates
          </button>
          <button onClick={onClear} className="p-1.5 hover:bg-white/10 rounded-lg transition"><X className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}