import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useMittiStatus — shared hook that checks whether Mitti
 * integration is connected (enabled + webhook secret configured).
 *
 * Returns { isConnected, isLoading, config }.
 *
 * Used by dashboard widgets and stat cards to zero-out or hide
 * Mitti-derived data when the sync is not active, so stale
 * demo/orphan records in the SafetyReport entity don't surface as
 * live compliance stats.
 */
export function useMittiStatus() {
  const { data: config, isLoading } = useQuery({
    queryKey: ['mitti-config'],
    queryFn: async () => {
      const list = await base44.entities.MittiConfig.filter({ key: 'global' });
      return list?.[0] || null;
    },
    staleTime: 60 * 1000,
  });

  const isConnected = !!(config?.enabled && config?.webhook_secret);

  return { isConnected, isLoading, config };
}