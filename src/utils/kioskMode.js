// Kiosk mode — when enabled on a device, the app auto-redirects to the
// full-screen Asset Scanner page on load. Stored in localStorage so it
// persists per-device without touching user/entity records.
const KEY = 'gc_kiosk_scanner_mode';

export function isKioskScannerMode() {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function enableKioskScannerMode() {
  try {
    localStorage.setItem(KEY, 'true');
  } catch {}
}

export function disableKioskScannerMode() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}