// Smart defaults and auto-calculation helpers for SiteAsset records.
// Used by the Add Asset Form and the compliance automation engine.

// Default service intervals (engine hours) by asset type
export const DEFAULT_SERVICE_INTERVALS = {
  rig: 250,
  machinery: 500,
  trailer: null,      // date-based
  vehicle: null,      // date-based
  lifting: null,      // date-based (LOLER)
  portable_appliance: null, // date-based (PAT)
};

// Default compliance category labels by asset type
export const DEFAULT_COMPLIANCE_CATEGORIES = {
  rig: 'Plant',
  machinery: 'Plant',
  trailer: 'Plant',
  vehicle: 'Vehicle',
  lifting: 'Lifting Gear',
  portable_appliance: 'Portable Appliance',
};

// Default inspection cycle in months (for auto-calculating next service date)
export const DEFAULT_INSPECTION_CYCLE_MONTHS = {
  rig: 6,
  machinery: 6,
  trailer: 12,
  vehicle: 12,
  lifting: 6,        // LOLER 6-monthly
  portable_appliance: 12, // PAT annual
};

// Common storage locations
export const COMMON_STORAGE_LOCATIONS = [
  'Dartford Depot',
  'Yard',
  'Van',
  'Site',
  'Workshop',
];

// Common colours for rig identification
export const COMMON_COLOURS = [
  'Red', 'Blue', 'Green', 'Yellow', 'White', 'Black', 'Orange', 'Silver',
];

/**
 * Auto-calculate compliance_status from expiry date.
 * - Expired: date in the past
 * - Expiring: within 30 days
 * - Compliant: more than 30 days away
 * - Unknown: no date set
 */
export function autoComplianceStatus(expiryDate) {
  if (!expiryDate) return 'unknown';
  const d = new Date(expiryDate + 'T00:00:00');
  if (isNaN(d.getTime())) return 'unknown';
  const days = Math.floor((d - new Date(new Date().toDateString())) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'compliant';
}

/**
 * Auto-calculate next_service_date from last_service_date + inspection cycle.
 * Returns null if no last service date or no cycle for the asset type.
 */
export function autoNextServiceDate(lastServiceDate, assetType) {
  if (!lastServiceDate) return null;
  const cycle = DEFAULT_INSPECTION_CYCLE_MONTHS[assetType];
  if (!cycle) return null;
  const d = new Date(lastServiceDate + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + cycle);
  return d.toISOString().slice(0, 10);
}

/**
 * Auto-calculate maintenance_status from operating hours and service interval.
 * - overdue: hours_since_last_service > service_interval_hours
 * - due_soon: within 80% of the interval
 * - ok: below 80%
 * - unknown: no interval set
 */
export function autoMaintenanceStatus(asset) {
  if (!asset.service_interval_hours) {
    // Date-based maintenance for vehicles/trailers/lifting/PAT
    if (asset.next_service_date) {
      const d = new Date(asset.next_service_date + 'T00:00:00');
      const days = Math.floor((d - new Date(new Date().toDateString())) / 86400000);
      if (days < 0) return 'overdue';
      if (days <= 30) return 'due_soon';
      return 'ok';
    }
    return 'unknown';
  }
  const since = Number(asset.hours_since_last_service) || 0;
  const interval = Number(asset.service_interval_hours) || 0;
  if (interval === 0) return 'unknown';
  if (since >= interval) return 'overdue';
  if (since >= interval * 0.8) return 'due_soon';
  return 'ok';
}

/**
 * Detect duplicate serial numbers across existing assets.
 * Returns matching asset names if found.
 */
export function findDuplicateSerial(serialNumber, existingAssets, excludeId = null) {
  if (!serialNumber || !serialNumber.trim()) return [];
  const q = serialNumber.trim().toLowerCase();
  return existingAssets
    .filter(a => a.id !== excludeId && a.serial_number && a.serial_number.trim().toLowerCase() === q)
    .map(a => a.name);
}