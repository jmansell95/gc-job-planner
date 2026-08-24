/**
 * UK geocoder — accurate per-postcode coordinates.
 *
 * Postcodes.io is a free, key-less UK postcode lookup that returns precise
 * lat/lng for a given postcode. Nominatim (OpenStreetMap) is the fallback for
 * addresses that don't contain a parseable postcode.
 *
 * Used by geocodeJobAddress (single address) and reGeocodeAllJobs (bulk).
 */

// UK postcode regex — matches outward + inward, with optional spaces.
// e.g. "SE28 0JJ", "E6 7FB", "SW1A1AA", "M1 1AA"
const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

export function extractUKPostcode(address: string): string | null {
  if (!address) return null;
  const m = address.match(POSTCODE_RE);
  if (!m) return null;
  // Normalise to "OUT INR" form (single space) for the API call.
  return `${m[1].toUpperCase()} ${m[2].toUpperCase()}`;
}

async function lookupPostcodesIo(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const r = body?.result;
    if (r && typeof r.latitude === 'number' && typeof r.longitude === 'number') {
      return { lat: r.latitude, lng: r.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

async function lookupNominatim(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // Nominatim usage policy requires a valid identifying User-Agent.
        'User-Agent': 'GC-Mission-Control/1.0 (geocoding)',
      },
    });
    if (!res.ok) return null;
    const arr = await res.json();
    const first = Array.isArray(arr) ? arr[0] : null;
    if (first && first.lat && first.lon) {
      return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Geocode a UK address. Tries Postcodes.io first (precise), then Nominatim.
 * Returns { lat, lng, source } or null if nothing resolves.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; source: string } | null> {
  if (!address || !address.trim()) return null;

  const postcode = extractUKPostcode(address);
  if (postcode) {
    const hit = await lookupPostcodesIo(postcode);
    if (hit) return { ...hit, source: 'postcodes.io' };
  }

  const hit = await lookupNominatim(address.trim());
  if (hit) return { ...hit, source: 'nominatim' };

  return null;
}