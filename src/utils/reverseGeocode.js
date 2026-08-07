// Reverse geocode utility — uses BigDataCloud's free client-side API
// (no API key, no rate limit). Cached per-coordinate to avoid duplicate calls.
// This runs in the browser where BigDataCloud is reliably accessible,
// unlike the backend function environment where external API calls can fail.

const cache = new Map();        // key → formatted label
const structuredCache = new Map(); // key → structured parts

// Build a readable UK-style address from BigDataCloud response fields.
// Priority: street + postcode (most specific), falling back to locality/city.
function formatAddress(json) {
  if (!json) return null;
  const road = json.street || json.streetName || '';
  const suburb = json.locality || json.subLocality || json.neighbourhood || '';
  const town = json.city || json.principalSubdivision || '';
  const postcode = json.postcode || '';

  // Best case: "High Street, AB1 2CD" — street + postcode is most readable
  if (road && postcode) {
    return `${road}, ${postcode}`;
  }
  // No street but have locality + postcode: "Springfield, AB1 2CD"
  if (suburb && postcode) {
    return `${suburb}, ${postcode}`;
  }
  // No postcode: "High Street, Springfield" or "High Street, London"
  if (road && (suburb || town)) {
    return `${road}, ${suburb || town}`;
  }
  // Just postcode
  if (postcode) return postcode;
  // Just road
  if (road) return road;
  // Fall back to locality/town
  if (suburb) return suburb;
  if (town) return town;
  return null;
}

// Return structured address parts for richer UI display (separate street, postcode, etc.)
function parseStructured(json) {
  if (!json) return null;
  return {
    road: json.street || json.streetName || '',
    suburb: json.locality || json.subLocality || json.neighbourhood || '',
    town: json.city || json.principalSubdivision || '',
    postcode: json.postcode || '',
    country: json.countryName || '',
  };
}

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
        const label = formatAddress(json);
        if (label) {
          cache.set(key, label);
          structuredCache.set(key, parseStructured(json));
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

// Batch geocode returning structured parts (road, postcode, etc.) per coordinate.
// Returns a map of "lat,lng" → { road, suburb, town, postcode, country }.
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
  const BATCH_SIZE = 8;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async ({ lat, lng, key }) => {
      results[key] = await reverseGeocodeStructured(lat, lng);
    }));
  }
  return results;
}