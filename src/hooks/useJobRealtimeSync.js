import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Subscribes to realtime Job entity changes (create / update / delete) and
 * invalidates all job-related React Query caches so every dashboard, hub and
 * detail view stays in sync without manual refreshes.
 *
 * Mount once near the app root (e.g. inside AuthenticatedApp).
 */
const JOB_QUERY_KEYS = [
  ['jobs'],
  ['job'],
  ['my-today-assignments'],
  ['outstanding-asset-assignments'],
  ['job-asset-assignments'],
  ['job-chain-legs-detail'],
  ['job-chain-legs'],
  ['delivery-legs-map'],
  ['admin-all-deliveries'],
  ['driver-day-stops'],
  ['all-jobs-financials'],
  ['job-financials'],
  ['site-assets'],
];

export default function useJobRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubscribe = null;
    try {
      unsubscribe = base44.entities.Job.subscribe((event) => {
        if (!event || !event.type) return;
        // Invalidate all job-scoped queries so every view refreshes.
        JOB_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      });
    } catch {
      // Realtime not available — silently skip; views still refresh on navigation.
    }
    return () => {
      if (typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch {}
      }
    };
  }, [queryClient]);
}