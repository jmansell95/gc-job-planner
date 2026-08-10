import { useState, useEffect } from 'react';
import {
  reverseGeocodeFast,
  reverseGeocodeUpgrade,
  buildLabelFromParts,
} from '@/utils/reverseGeocode';

/**
 * Two-phase reverse geocoding hook for instant location display.
 *
 * Phase 1 (instant): BigDataCloud — no rate limit, returns immediately
 *   with town + postcode (may lack street/road name in free tier).
 * Phase 2 (background upgrade): Nominatim — rate-limited (1 req/sec)
 *   but has road/street names + accurate postcodes. Fires after phase 1
 *   and updates state when the better data arrives.
 *
 * Returns { label, parts, isLoading, isUpgraded }
 *   - label: readable string ("Street, Postcode" or "Town, Postcode")
 *   - parts: structured { road, suburb, town, postcode, country }
 *   - isLoading: true until phase 1 completes
 *   - isUpgraded: true once Nominatim has improved the result
 */
export function useReverseGeocode(lat, lng) {
  const [state, setState] = useState({
    label: null,
    parts: null,
    isLoading: true,
    isUpgraded: false,
  });

  useEffect(() => {
    if (lat == null || lng == null) {
      setState({ label: null, parts: null, isLoading: false, isUpgraded: false });
      return;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, isLoading: true }));

    // Phase 1: Fast BigDataCloud (instant, no rate limit)
    reverseGeocodeFast(lat, lng).then(parts => {
      if (cancelled) return;
      const label = buildLabelFromParts(parts);
      setState({ label, parts, isLoading: false, isUpgraded: false });

      // Phase 2: Upgrade with Nominatim (rate-limited, has road + postcode)
      // Only upgrade if BigDataCloud didn't return road-level data
      if (!parts?.road) {
        reverseGeocodeUpgrade(lat, lng).then(upgradedParts => {
          if (cancelled || !upgradedParts) return;
          const upgradedLabel = buildLabelFromParts(upgradedParts);
          if (upgradedLabel) {
            setState({ label: upgradedLabel, parts: upgradedParts, isLoading: false, isUpgraded: true });
          }
        });
      }
    });

    return () => { cancelled = true; };
  }, [lat, lng]);

  return state;
}

/**
 * Batch two-phase geocoding for lists of coordinates.
 * Returns { labels, parts, upgrade } where:
 *   - labels/parts are populated instantly from BigDataCloud
 *   - upgrade() kicks off Nominatim upgrades sequentially (rate-limited)
 *     and calls onUpdate when each coordinate is upgraded.
 */
export async function batchReverseGeocodeFast(coords) {
  const labels = {};
  const parts = {};
  const needs = [];

  for (const { lat, lng } of coords) {
    if (lat == null || lng == null) continue;
    const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
    const fastParts = await reverseGeocodeFast(lat, lng);
    if (fastParts) {
      parts[key] = fastParts;
      const label = buildLabelFromParts(fastParts);
      if (label) labels[key] = label;
      // Only queue for upgrade if we don't have road data yet
      if (!fastParts.road) needs.push({ lat, lng, key });
    }
  }

  return { labels, parts, needsUpgrade: needs };
}