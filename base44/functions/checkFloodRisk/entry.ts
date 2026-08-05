import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// checkFloodRisk — checks Environment Agency flood warnings
// near a job site. Returns the severity level and count of
// active warnings within ~5km of the coordinates.
// ============================================================
// Payload: { lat: number, lng: number, radius_km?: number (default 5) }
//
// Uses the free EA Flood Monitoring API (no API key required):
//   https://environment.data.gov.uk/flood-monitoring/id/floods

const SEVERITY_RANK: Record<string, number> = {
  'Severe flood warning': 4,
  'Flood warning': 3,
  'Flood alert': 2,
  'Warning no longer in force': 1,
  'Withdrawn': 0,
};

const SEVERITY_LABEL: Record<string, string> = {
  'Severe flood warning': 'severe',
  'Flood warning': 'high',
  'Flood alert': 'moderate',
  'Warning no longer in force': 'low',
  'Withdrawn': 'none',
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const radiusKm = Number(body.radius_km) || 5;

    if (isNaN(lat) || isNaN(lng)) {
      return Response.json({ ok: false, error: 'Valid lat and lng are required.' }, { status: 400 });
    }

    // Fetch all current EA flood warnings
    const eaRes = await fetch('https://environment.data.gov.uk/flood-monitoring/id/floods', {
      headers: { 'Accept': 'application/json' },
    }).catch(() => null);

    if (!eaRes || !eaRes.ok) {
      return Response.json({ ok: false, error: 'EA flood monitoring API unavailable.' });
    }

    const eaJson = await eaRes.json().catch(() => null);
    const floods: any[] = Array.isArray(eaJson?.items) ? eaJson.items : [];

    // Check each flood warning for proximity to the site.
    // EA flood warnings have a 'floodArea' with a 'polygon' URL, but fetching
    // each polygon is expensive. Instead, we check the 'floodArea' centroid
    // coordinates if available, or skip warnings without coordinates.
    const nearbyWarnings: any[] = [];
    let maxSeverity = 'none';
    let maxSeverityRank = 0;

    for (const f of floods) {
      // Try to get coordinates from the flood area
      const area = f.floodArea || {};
      const fLat = area.lat ? Number(area.lat) : null;
      const fLng = area.long ? Number(area.long) : null;
      if (fLat == null || fLng == null) continue;

      const dist = haversineKm(lat, lng, fLat, fLng);
      if (dist <= radiusKm) {
        const severity = f.severityLevel || 'Unknown';
        const label = SEVERITY_LABEL[severity] || 'low';
        const rank = SEVERITY_RANK[severity] || 1;
        nearbyWarnings.push({
          description: f.description || area.name || 'Flood warning',
          severity,
          severity_label: label,
          distance_km: Math.round(dist * 10) / 10,
          message_url: f.messageUrl || null,
        });
        if (rank > maxSeverityRank) {
          maxSeverityRank = rank;
          maxSeverity = label;
        }
      }
    }

    return Response.json({
      ok: true,
      lat,
      lng,
      radius_km: radiusKm,
      flood_risk_level: maxSeverity,
      warning_count: nearbyWarnings.length,
      warnings: nearbyWarnings.sort((a, b) => a.distance_km - b.distance_km),
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}