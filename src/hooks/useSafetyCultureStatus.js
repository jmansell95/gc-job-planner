import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useSafetyCultureStatus — shared hook that checks whether SafetyCulture
 * integration is connected (enabled + webhook secret configured).
 *
 * Returns { isConnected, isLoading, config }.
 *
 * Used by dashboard widgets and stat cards to zero-out or hide
 * SafetyCulture-derived data when the sync is not active, so stale
 * demo/orphan records in the SafetyReport entity don't surface as
 * live compliance stats.
 */
export function useSafetyCultureStatus() {
  const { data: config, isLoading } = useQuery({
    queryKey: ['safetyculture-config'],
    queryFn: async () => {
      const list = await base44.entities.SafetyCultureConfig.filter({ key: 'global' });
      return list?.[0] || null;
    },
    staleTime: 60 * 1000,
  });

  const isConnected = !!(config?.enabled && config?.webhook_secret);

  return { isConnected, isLoading, config };
}