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
  ['investigation-logs'],
  ['staff-timesheets'],
  ['all-timesheets-mgr'],
  ['timesheets'],
];

export default function useJobRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubscribe = null;
    let unsubLogs = null;
    try {
      unsubscribe = base44.entities.Job.subscribe((event) => {
        if (!event || !event.type) return;
        // Invalidate all job-scoped queries so every view refreshes.
        JOB_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      });
    } catch {
      // Realtime not available — silently skip; views still refresh on navigation.
    }
    try {
      unsubLogs = base44.entities.InvestigationLog.subscribe((event) => {
        if (!event || !event.type) return;
        // Invalidate log + timesheet queries so the Site Logs tab refreshes
        // when the KeyLogBook webhook creates new entries.
        queryClient.invalidateQueries({ queryKey: ['investigation-logs'] });
        queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
        queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
        queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      });
    } catch {
      // Realtime not available — silently skip
    }
    let unsubTimesheets = null;
    try {
      unsubTimesheets = base44.entities.Timesheet.subscribe((event) => {
        if (!event || !event.type) return;
        // Invalidate all timesheet queries so both the staff view and the
        // manager Timesheets tab update instantly when entries are submitted,
        // approved, rejected, or merged — no manual refresh needed.
        queryClient.invalidateQueries({ queryKey: ['timesheets'] });
        queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
        queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      });
    } catch {
      // Realtime not available — silently skip
    }
    return () => {
      if (typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch {}
      }
      if (typeof unsubLogs === 'function') {
        try { unsubLogs(); } catch {}
      }
      if (typeof unsubTimesheets === 'function') {
        try { unsubTimesheets(); } catch {}
      }
    };
  }, [queryClient]);
}