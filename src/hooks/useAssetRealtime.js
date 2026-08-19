import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Subscribes to SiteAsset realtime events and invalidates the assets query
 * so the Asset Hub (and any other screen keyed on ['site-assets']) reflects
 * live changes — Asset Panda webhook updates, admin edits, staff sign-out/in —
 * without a manual refresh.
 *
 * Usage: call once near the top of a hub page.
 *   useAssetRealtime();
 */
export function useAssetRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = base44.entities.SiteAsset.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['site-assets'] });
        queryClient.invalidateQueries({ queryKey: ['scoped', 'SiteAsset'] });
        queryClient.invalidateQueries({ queryKey: ['asset-detail'] });
      });
    } catch (_) {
      // realtime not available — silently no-op
    }
    return unsub;
  }, [queryClient]);
}