import React from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';

/**
 * Banner shown when scans are queued offline (network down or resolve failed).
 * Parent owns the queue; this component just surfaces the count and triggers a retry.
 */
export default function OfflineScanQueueBanner({ count = 0, retrying = false, onRetry, onDismiss }) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
        <WifiOff className="w-4 h-4 text-amber-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-900">{count} scan{count !== 1 ? 's' : ''} queued</p>
        <p className="text-[11px] text-amber-700">Will auto-sync when back online</p>
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold active:scale-95 transition disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} /> Retry
      </button>
      {onDismiss && (
        <button onClick={onDismiss} className="p-1.5 text-amber-400 hover:text-amber-600">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}