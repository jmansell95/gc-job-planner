// Canonical public base URL for GC Mission Control.
// All webhook URLs and external links use this fixed production domain
// (not window.location.origin) so they stay stable across preview/published environments.
export const CANONICAL_APP_BASE_URL = 'https://gc-mission-control.base44.app';

/**
 * Builds a full webhook URL from a relative path (e.g. '/functions/importAGS').
 * Always uses the canonical production domain.
 */
export function buildWebhookUrl(path) {
  return `${CANONICAL_APP_BASE_URL}${path}`;
}