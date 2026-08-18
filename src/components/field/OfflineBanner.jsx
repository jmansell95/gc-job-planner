import React from 'react';
import { WifiOff, CloudUpload, Loader2 } from 'lucide-react';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

// OfflineBanner — slim status strip shown when the device is offline or has
// queued actions syncing. Drop into any field screen's top to give crews
// confidence their work is saved even without signal. Renders nothing when
// online and the queue is empty.
export default function OfflineBanner() {
  const { isOnline, pendingCount, flush } = useOfflineQueue();

  if (isOnline && pendingCount === 0) return null;

  const syncing = isOnline && pendingCount > 0;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold ${
        syncing ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {syncing ? (
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        ) : (
          <WifiOff className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="truncate">
          {syncing
            ? `Syncing ${pendingCount} queued action${pendingCount > 1 ? 's' : ''}…`
            : `Offline — ${pendingCount} action${pendingCount > 1 ? 's' : ''} queued, will sync on reconnect`}
        </span>
      </div>
      {syncing && (
        <button onClick={flush} className="flex items-center gap-1 underline flex-shrink-0">
          <CloudUpload className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}