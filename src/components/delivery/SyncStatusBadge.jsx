import React, { useState, useEffect } from 'react';
import { CloudOff, Cloud, RefreshCw } from 'lucide-react';
import { getTotalOfflineCount } from '@/utils/offlineSync';

export default function SyncStatusBadge({ onSync, isSyncing = false }) {
  const [count, setCount] = useState(getTotalOfflineCount());

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(getTotalOfflineCount());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0 && !isSyncing) return null;

  return (
    <button
      onClick={onSync}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold hover:bg-amber-100 transition active:scale-95"
    >
      {isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Syncing…</span>
        </>
      ) : (
        <>
          <CloudOff className="w-4 h-4" />
          <span>{count} pending sync{count > 1 ? 's' : ''}</span>
          <Cloud className="w-3.5 h-3.5 text-amber-500" />
        </>
      )}
    </button>
  );
}