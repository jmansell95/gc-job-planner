import { useState, useEffect } from 'react';
import { subscribe, queueAction, flush, getState } from '@/lib/offlineQueue';

// React binding for the singleton offline queue.
// Returns { isOnline, queue, pendingCount, queueAction, flush }.
export function useOfflineQueue() {
  const [state, setState] = useState(() => getState());
  useEffect(() => subscribe(setState), []);
  return {
    isOnline: state.isOnline,
    queue: state.queue,
    pendingCount: state.queue.length,
    queueAction,
    flush,
  };
}