// Reverse geocode utility — uses Nominatim (OpenStreetMap) for UK road + postcode
// data, with BigDataCloud as a fast fallback. Nominatim has excellent UK address
// coverage (road names, postcodes) but is rate-limited to 1 req/sec. BigDataCloud
// is faster (no rate limit) but its free tier doesn't include street-level data
// and returns `postCode` (camelCase), not `postcode`.
// Cached per-coordinate to avoid duplicate calls.

const cache = new Map();        // key → formatted label
const structuredCache = new Map(); // key → structured parts

// Nominatim rate limiter — max 1 request per second (their usage policy)
let lastNominatimCall = 0;
const NOMINATIM_MIN_INTERVAL = 1100; // 1.1s for safety margin

async function nominatimRateLimit() {
  const now = Date.now();
  const elapsed = now - lastNominatimCall;
  if (elapsed < NOMINATIM_MIN_INTERVAL) {
    await new Promise(r => setTimeout(r, NOMINATIM_MIN_INTERVAL - elapsed));
  }
  lastNominatimCall = Date.now();
}

// Build a readable UK-style address from structured parts.
// Priority: street + postcode (most specific), then progressively looser
// fallbacks so we ALWAYS show something useful if the API returned any data.
// Exported so all vehicle/trip components share one consistent label builder.
export function buildLabelFromParts(parts) {
  if (!parts) return null;
  const road = parts.road || '';
  const suburb = parts.suburb || '';
  const town = parts.town || '';
  const postcode = parts.postcode || '';

  // Best case: "High Street, AB1 2CD"
  if (road && postcode) return `${road}, ${postcode}`;
  // "Springfield, AB1 2CD"
  if (suburb && postcode) return `${suburb}, ${postcode}`;
  // "High Street, Springfield"
  if (road && suburb) return `${road}, ${suburb}`;
  // "High Street, London"
  if (road && town) return `${road}, ${town}`;
  // Just postcode
  if (postcode) return postcode;
  // Just road
  if (road) return road;
  // Just suburb/locality
  if (suburb) return suburb;
  // Just town/city — better than "Unknown"!
  if (town) return town;
  return null;
}

// Parse Nominatim (OpenStreetMap) response into structured parts.
// Nominatim returns { address: { road, suburb, city, postcode, ... } }
function parseNominatim(json) {
  if (!json?.address) return null;
  const a = json.address;
  return {
    road: a.road || a.pedestrian || a.footway || a.path || a.cycleway || '',
    suburb: a.suburb || a.neighbourhood || a.hamlet || a.locality || '',
    town: a.city || a.town || a.village || a.municipality || '',
    postcode: a.postcode || '',
    country: a.country || '',
  };
}

// Parse BigDataCloud response (fallback).
// NOTE: BigDataCloud's free tier returns `postCode` (camelCase), NOT `postcode`.
// It also does NOT return `street` or `streetName` — only town-level data.
function parseBigDataCloud(json) {
  if (!json) return null;
  return {
    road: json.street || json.streetName || '',
    suburb: json.locality || json.subLocality || json.neighbourhood || '',
    town: json.city || json.principalSubdivision || '',
    postcode: json.postCode || json.postcode || '',
    country: json.countryName || '',
  };
}

export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return 'Unknown location';
  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);

  let parts = null;

  // Try Nominatim first — has road + postcode for UK addresses
  try {
    await nominatimRateLimit();
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.ok) {
      const json = await res.json();
      parts = parseNominatim(json);
    }
  } catch (_) {
    // network error — fall through to BigDataCloud
  }

  // Fallback: BigDataCloud (faster but no road data in free tier)
  if (!parts) {
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const json = await res.json();
        parts = parseBigDataCloud(json);
      }
    } catch (_) {
      // network error — fall through to coordinates
    }
  }

  if (parts) {
    const label = buildLabelFromParts(parts);
    if (label) {
      cache.set(key, label);
      structuredCache.set(key, parts);
      return label;
    }
  }

  // Fall back to coordinates rather than "Unknown location" — gives the user
  // at least some context. Do NOT cache failures so transient errors recover.
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}

// Return structured address parts (road, suburb, town, postcode) for a coordinate.
// Useful when the UI needs to display the postcode separately from the street.
export async function reverseGeocodeStructured(lat, lng) {
  if (lat == null || lng == null) return null;
  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  if (structuredCache.has(key)) return structuredCache.get(key);

  // Ensure the label cache is populated (which also populates structured cache)
  await reverseGeocode(lat, lng);
  return structuredCache.get(key) || null;
}

// Batch geocode multiple coordinate pairs with caching.
// Returns a map of "lat,lng" → label.
// Processes sequentially to respect Nominatim's 1 req/sec rate limit.
// The cache prevents redundant calls for coordinates already resolved.
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
  // Sequential — Nominatim rate-limits to 1 req/sec
  for (const { lat, lng, key } of unique) {
    results[key] = await reverseGeocode(lat, lng);
  }
  return results;
}

// Batch geocode returning structured parts (road, postcode, etc.) per coordinate.
// Returns a map of "lat,lng" → { road, suburb, town, postcode, country }.
// Processes sequentially to respect Nominatim's 1 req/sec rate limit.
export async function batchReverseGeocodeStructured(coords) {
  const results = {};
  const unique = [];
  const seen = new Set();
  for (const { lat, lng } of coords) {
    if (lat == null || lng == null) continue;
    const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
    if (structuredCache.has(key)) {
      results[key] = structuredCache.get(key);
    } else if (!seen.has(key)) {
      seen.add(key);
      unique.push({ lat, lng, key });
    }
  }
  // Sequential — Nominatim rate-limits to 1 req/sec
  for (const { lat, lng, key } of unique) {
    results[key] = await reverseGeocodeStructured(lat, lng);
  }
  return results;
}