/**
 * Shared weight & axle-load helpers — frontend mirror of base44/shared/loadWeight.ts.
 * Reused by the load planner, driver hub, and printable manifests so the
 * safe-to-drive logic stays consistent everywhere.
 */

export function totalWeight(items) {
  return items.reduce((sum, i) => sum + (Number(i.weight_kg) || 0) * (Number(i.quantity) || 1), 0);
}

export function getPayloadStatus(loadedKg, maxKg) {
  if (!maxKg || maxKg <= 0) return { status: 'unknown', pct: 0, label: 'No payload limit set', color: 'slate' };
  const pct = (loadedKg / maxKg) * 100;
  if (pct > 100) return { status: 'over', pct: 100, label: 'Overloaded', color: 'rose' };
  if (pct >= 90) return { status: 'near', pct, label: 'Near limit', color: 'amber' };
  return { status: 'safe', pct, label: 'Safe to drive', color: 'emerald' };
}

/**
 * Lightweight axle-load heuristic. Estimates front/rear distribution for a
 * set of loaded items on a typical van/truck load bed. Heavier items are
 * placed toward the front (cab end) for stability; remaining weight is spread
 * evenly. Returns kg per axle and a human-readable recommendation.
 */
export function calculateAxleGuidance(items, vehicle) {
  const weighted = (items || [])
    .map(i => ({ name: i.name || 'Item', kg: (Number(i.weight_kg) || 0) * (Number(i.quantity) || 1) }))
    .filter(i => i.kg > 0)
    .sort((a, b) => b.kg - a.kg);

  const total = weighted.reduce((s, i) => s + i.kg, 0);
  if (total === 0) return { frontKg: 0, rearKg: 0, totalKg: 0, note: 'No weighted items loaded.', heaviest: null };

  const frontKg = Math.round(total * 0.4);
  const rearKg = Math.round(total * 0.6);

  const heaviest = weighted[0];
  const note = [
    `Total load ${Math.round(total)} kg — est. ${frontKg} kg front / ${rearKg} kg rear axle.`,
    `Place heaviest item (${heaviest.name}, ${Math.round(heaviest.kg)} kg) toward the cab for stability.`,
    'Distribute remaining items evenly across the load bed.',
  ].join(' ');

  return { frontKg, rearKg, totalKg: total, note, heaviest };
}