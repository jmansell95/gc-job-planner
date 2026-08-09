import React, { useEffect, useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';

/**
 * Shows when a data source was last fetched, with a relative time label
 * ("2 min ago") and a manual refresh button. Use the `query` prop to pass
 * a react-query useQuery result.
 */
export default function DataFreshnessIndicator({ query, label = 'Updated' }) {
  const [, setTick] = useState(0);

  // Re-render every 30s to keep the relative time fresh
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const lastFetched = query?.dataUpdatedAt;
  const isFetching = query?.isFetching;

  const relativeTime = (() => {
    if (!lastFetched) return '—';
    const diff = Date.now() - lastFetched;
    if (diff < 5000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  })();

  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
      {isFetching ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : (
        <Check className="w-3 h-3 text-emerald-500" />
      )}
      <span>{label} {relativeTime}</span>
      {!isFetching && query?.refetch && (
        <button
          onClick={() => query.refetch()}
          className="p-0.5 hover:text-slate-600 transition"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}