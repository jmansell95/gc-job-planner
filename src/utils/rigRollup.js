// Shared helpers for the Rig Hub — compliance rollup + rig/equipment relationships.

export const COMPLIANCE_META = {
  compliant: { label: 'Compliant', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  expiring: { label: 'Expiring Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500', ring: 'ring-amber-200' },
  expired: { label: 'Expired', tone: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500', ring: 'ring-red-200' },
  unknown: { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200', dot: 'bg-slate-400', ring: 'ring-slate-200' },
};

export const ASSET_TYPE_META = {
  rig: { label: 'Rig', icon: 'Cog', tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  machinery: { label: 'Machinery', icon: 'Wrench', tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  trailer: { label: 'Trailer', icon: 'Package', tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  vehicle: { label: 'Vehicle', icon: 'Truck', tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  lifting: { label: 'Lifting Gear', icon: 'Anchor', tint: 'bg-teal-50 text-teal-700 border-teal-200' },
  portable_appliance: { label: 'PAT / Electrical', icon: 'Plug', tint: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/**
 * Derive the live compliance status from the actual expiry date rather than
 * relying solely on the stored compliance_status field (which may be stale
 * if the Asset Panda sync hasn't run recently). Falls back to the stored
 * status when no expiry date is present.
 */
export function derivedComplianceStatus(asset) {
  if (!asset) return 'unknown';
  const d = daysUntil(asset.compliance_expiry_date);
  if (d !== null) {
    if (d < 0) return 'expired';
    if (d <= 30) return 'expiring';
    return 'compliant';
  }
  return asset.compliance_status || 'unknown';
}

/**
 * Compute the master compliance status of a rig by rolling up its own status
 * with the status of every linked child asset. A single expired or expiring
 * child drags the whole rig system to that severity so nothing is missed.
 * Uses derivedComplianceStatus so the pill reflects the live expiry date,
 * not just the last-synced status field.
 */
export function rollupCompliance(rig, linkedItems = []) {
  const all = [rig, ...linkedItems].filter(Boolean);
  const counts = { compliant: 0, expiring: 0, expired: 0, unknown: 0 };
  all.forEach(a => { counts[derivedComplianceStatus(a)]++; });
  const master = counts.expired > 0 ? 'expired'
    : counts.expiring > 0 ? 'expiring'
    : counts.compliant === 0 && counts.unknown > 0 ? 'unknown'
    : 'compliant';
  return { counts, master, total: all.length };
}

/** Find the rig that a given equipment item is linked to (if any). */
export function findParentRig(equipmentId, rigs = []) {
  return rigs.find(r => (r.linked_equipment_ids || []).includes(equipmentId)) || null;
}

/** Days until a date (negative = past). null when no date. */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.floor((d - new Date(new Date().toDateString())) / 86400000);
}