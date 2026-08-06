// Reverse geocode utility — uses BigDataCloud's free client-side API
// (no API key, no rate limit). Cached per-coordinate to avoid duplicate calls.
// This runs in the browser where BigDataCloud is reliably accessible,
// unlike the backend function environment where external API calls can fail.

const cache = new Map();

export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return 'Unknown location';
  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.ok) {
      const json = await res.json();
      if (json) {
        // BigDataCloud returns `street` (not `streetName`) for the road name.
        const road = json.street || json.streetName || '';
        const suburb = json.locality || json.subLocality || json.neighbourhood || '';
        const town = json.city || json.principalSubdivision || json.countryName || '';
        const parts = [road, suburb, town].filter(Boolean);
        const label = parts.length > 0 ? parts.join(', ') : '';
        if (label) {
          cache.set(key, label);
          return label;
        }
      }
    }
  } catch (_) {
    // network error — fall through
  }

  // Fall back to coordinates rather than "Unknown location" — gives the user
  // at least some context. Do NOT cache failures so transient errors recover.
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}

// Batch geocode multiple coordinate pairs with caching.
// Returns a map of "lat,lng" → label.
export async function batchReverseGeocode(coords) {
  const results = {};
  const unique = [];
  const seen = new Set();
  for (const { lat, lng } of coords) {
    if (lat == null || lng == null) continue;
    const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
    if (cache.has(key)) {
      results[key] = cache.get(key);
    } else if (!seen.has(key)) {
      seen.add(key);
      unique.push({ lat, lng, key });
    }
  }
  // Process in small batches to avoid overwhelming the browser's connection
  // pool (browsers limit ~6 concurrent connections per origin). Sending 100+
  // parallel requests causes some to fail silently, returning "Unknown location".
  const BATCH_SIZE = 8;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async ({ lat, lng, key }) => {
      results[key] = await reverseGeocode(lat, lng);
    }));
  }
  return results;
}