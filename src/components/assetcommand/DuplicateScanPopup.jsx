import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

const COMPLIANCE_RING = {
  emerald: 'ring-emerald-400 bg-emerald-50 text-emerald-700',
  amber: 'ring-amber-400 bg-amber-50 text-amber-700',
  red: 'ring-red-400 bg-red-50 text-red-700',
  slate: 'ring-slate-300 bg-slate-50 text-slate-600',
};

/**
 * Single polished popup shown when a scanned asset is already in the basket.
 * Replaces the old flood of toast notifications. Auto-dismisses after 2.5s or on tap.
 */
export default function DuplicateScanPopup({ asset, onDismiss }) {
  useEffect(() => {
    if (!asset) return;
    const t = setTimeout(onDismiss, 2500);
    return () => clearTimeout(t);
  }, [asset, onDismiss]);

  if (!asset) return null;

  const colorKey = {
    compliant: 'emerald',
    expiring: 'amber',
    expired: 'red',
    unknown: 'slate',
  }[asset.compliance_status] || 'slate';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none p-6">
      <div
        className="pointer-events-auto bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden animate-pop-in"
        onClick={onDismiss}
      >
        <div className="relative p-5 flex flex-col items-center text-center">
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className={`w-16 h-16 rounded-full flex items-center justify-center ring-4 ${COMPLIANCE_RING[colorKey]} mb-3`}>
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <p className="text-base font-bold text-slate-900">Already in basket</p>
          <p className="text-sm text-slate-500 mt-0.5 truncate max-w-full">{asset.name}</p>

          {asset.serial_number && (
            <p className="text-xs text-slate-400 mt-1 font-mono">{asset.serial_number}</p>
          )}

          <div className="mt-3 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
            <p className="text-xs font-semibold text-amber-700">Scanned again — not duplicated</p>
          </div>
        </div>
      </div>
    </div>
  );
}