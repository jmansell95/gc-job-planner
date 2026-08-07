import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCallback, useRef } from 'react';

// useCachedQuery — caching strategy hook for frequently accessed data.
// Uses React Query's built-in cache with extended staleTime and
// gcTime to minimize API calls for reference data (staff lists, jobs,
// rate cards) that changes infrequently.

const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_GC_TIME = 30 * 60 * 1000; // 30 minutes

export function useCachedQuery(queryKey, queryFn, options = {}) {
  return useQuery({
    queryKey,
    queryFn,
    staleTime: options.staleTime || DEFAULT_STALE_TIME,
    gcTime: options.gcTime || DEFAULT_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    ...options,
  });
}

// useCachedEntity — convenience wrapper for entity list queries
// with extended caching. Perfect for reference data like staff,
// jobs, teams, rate cards that don't change often.
export function useCachedEntity(entityName, sortOrFilter, limit, options = {}) {
  return useCachedQuery(
    [entityName, 'cached', sortOrFilter, limit],
    async () => {
      if (sortOrFilter && typeof sortOrFilter === 'object') {
        return base44.entities[entityName].filter(sortOrFilter, null, limit);
      }
      return base44.entities[entityName].list(sortOrFilter, limit);
    },
    options
  );
}

// useSmartRefresh — returns a function that invalidates only the
// specified cache keys, avoiding full-page refetches.
export function useSmartRefresh() {
  const queryClient = useQueryClient();
  return useCallback((keys) => {
    if (!keys || keys.length === 0) {
      queryClient.invalidateQueries();
      return;
    }
    keys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
    });
  }, [queryClient]);
}

// usePrefetch — prefetch data before it's needed (e.g. prefetch job
// details when hovering over a job card).
export function usePrefetch() {
  const queryClient = useQueryClient();
  return useCallback((queryKey, queryFn) => {
    queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: DEFAULT_STALE_TIME,
    });
  }, [queryClient]);
}