// Shared helpers for parsing Asset Panda raw field caches.
// Used by getAssetPandaObject and refreshScannedAsset so the raw-field
// quantity / stock / compliance extraction logic isn't duplicated.

/**
 * Find a value in the label→value raw field cache by matching any keyword
 * against the field label (case-insensitive). Returns the first match.
 */
export function findRawByKeywords(
  rawFields: Record<string, string>,
  keywords: string[]
): string {
  for (const k of keywords) {
    for (const [label, val] of Object.entries(rawFields)) {
      if (label.toLowerCase().includes(k)) return val;
    }
  }
  return '';
}

/**
 * Parse a numeric quantity from a raw string (strips non-numeric chars).
 * Returns null when empty or not a number.
 */
export function parseQty(s: string): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}