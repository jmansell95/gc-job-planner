import { useQuery } from '@tanstack/react-query';
import { fetchWeather } from '@/utils/siteWeather';

/**
 * useJobWeather — React Query-cached weather fetch for a single job location.
 * Deduplicates requests for the same rounded coordinates and caches for 10 minutes.
 */
export function useJobWeather(lat, lng, enabled = true) {
  const key = (lat != null && !isNaN(lat)) ? lat.toFixed(3) : null;
  const val = (lng != null && !isNaN(lng)) ? lng.toFixed(3) : null;

  return useQuery({
    queryKey: ['job-weather', key, val],
    queryFn: () => fetchWeather(lat, lng),
    enabled: enabled && key != null && val != null,
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });
}