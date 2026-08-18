import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { syncAllOfflineData, getTotalOfflineCount } from '@/utils/offlineSync';

// Persistent sync-status indicator — gives field staff confidence their
// data has reached the office, even from remote sites with poor signal.
// States: synced (green) | offline/queued (amber) | syncing (blue pulse) | error (red)
export default function SyncHUD() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getTotalOfflineCount());
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncing(true);
      syncAllOfflineData().then(result => {
        setSyncing(false);
        setPendingCount(getTotalOfflineCount());
        if (result.total > 0) setLastSyncedAt(new Date());
      }).catch(() => setSyncing(false));
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll the queue count every few seconds for the badge
    const interval = setInterval(() => setPendingCount(getTotalOfflineCount()), 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const hasError = isOnline && pendingCount > 0 && !syncing;

  let state, icon, bg, text, subtext;
  if (syncing) {
    state = 'syncing';
    icon = <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />;
    bg = 'bg-gradient-to-r from-blue-50 to-blue-100/40 border-blue-200/60';
    text = 'text-blue-700';
    subtext = 'Uploading your data…';
  } else if (!isOnline) {
    state = 'offline';
    icon = <WifiOff className="w-4 h-4" strokeWidth={2.5} />;
    bg = 'bg-gradient-to-r from-amber-50 to-amber-100/40 border-amber-200/60';
    text = 'text-amber-700';
    subtext = pendingCount > 0 ? `${pendingCount} item${pendingCount !== 1 ? 's' : ''} queued — will send when reconnected` : 'Offline — your work is saved locally';
  } else if (hasError) {
    state = 'error';
    icon = <AlertTriangle className="w-4 h-4" strokeWidth={2.5} />;
    bg = 'bg-gradient-to-r from-red-50 to-red-100/40 border-red-200/60';
    text = 'text-red-700';
    subtext = `${pendingCount} item${pendingCount !== 1 ? 's' : ''} failed to sync — tap retry`;
  } else {
    state = 'synced';
    icon = <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />;
    bg = 'bg-gradient-to-r from-emerald-50 to-[#8DC63F]/8 border-emerald-200/60';
    text = 'text-emerald-700';
    subtext = lastSyncedAt ? 'All data synced to office' : 'All synced';
  }

  const handleRetry = async () => {
    if (!isOnline) return;
    setSyncing(true);
    try {
      await syncAllOfflineData();
      setPendingCount(getTotalOfflineCount());
      setLastSyncedAt(new Date());
    } catch (e) { /* keep */ }
    setSyncing(false);
  };

  return (
    <button
      onClick={hasError ? handleRetry : undefined}
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border ${bg} ${text} ${hasError ? 'hover:bg-red-100 cursor-pointer' : 'cursor-default'} transition w-full text-left`}
    >
      <div className="relative flex-shrink-0 w-7 h-7 rounded-lg bg-white/60 flex items-center justify-center">
        {icon}
        {state === 'syncing' && (
          <span className="absolute inset-0 rounded-lg bg-blue-400 opacity-30 animate-ping" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide">
          {state === 'synced' ? 'Synced' : state === 'syncing' ? 'Syncing' : state === 'offline' ? 'Offline' : 'Sync Error'}
        </p>
        <p className="text-[11px] opacity-80 truncate">{subtext}</p>
      </div>
      {hasError && <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />}
    </button>
  );
}