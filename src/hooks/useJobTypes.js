import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Fetches all job types sorted by order. Cached via React Query
 * so all components share the same data.
 */
export function useJobTypes() {
  return useQuery({
    queryKey: ['job-types'],
    queryFn: () => base44.entities.JobType.list('-order'),
    staleTime: 60 * 1000,
  });
}