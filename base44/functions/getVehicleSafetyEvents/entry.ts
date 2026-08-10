import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// getVehicleSafetyEvents — fetches individual Geotab safety
// violation events (ExceptionEvent) for a specific vehicle
// over a custom date range. Returns detailed per-event data
// (date, time, violation type, driver, speed, location) so
// managers can drill down and coach drivers.
// ============================================================
// Payload:
//   { vehicle_id: string,
//     from_date?: string (ISO),   // default: 30 days ago
//     to_date?: string (ISO),     // default: now
//     limit?: number }            // default: 1000, max: 5000
//
// Returns:
//   { ok: true, events: [...], summary: { total, by_type, ... } }
//
// Each event:
//   { id, date, time, datetime, violation_type, rule_name,
//     driver_name, speed_kph, speed_limit_kph, duration_seconds,
//     latitude, longitude, device_name, severity }

interface GeotabCredentials {
  sessionId: string;
  userName: string;
  database: string;
}

function classifyRule(ruleName: string): string {
  const n = (ruleName || '').toLowerCase();
  if (n.includes('brak')) return 'harsh_braking';
  if (n.includes('speed')) return 'speeding';
  if (n.includes('accel')) return 'harsh_accel';
  if (n.includes('corner') || n.includes('turn')) return 'harsh_cornering';
  if (n.includes('seatbelt') || n.includes('seat belt')) return 'seatbelt';
  if (n.includes('idling')) return 'idling';
  return 'other';
}

const VIOLATION_LABELS: Record<string, string> = {
  harsh_braking: 'Harsh Braking',
  speeding: 'Speeding',
  harsh_accel: 'Harsh Acceleration',
  harsh_cornering: 'Harsh Cornering',
  seatbelt: 'Seatbelt Violation',
  idling: 'Excessive Idling',
  other: 'Safety Event',
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const vehicleId = body.vehicle_id;
    if (!vehicleId) {
      return Response.json({ ok: false, error: 'vehicle_id is required' });
    }

    const limit = Math.min(Number(body.limit) || 1000, 5000);
    const toDate = body.to_date ? new Date(body.to_date) : new Date();
    const fromDate = body.from_date ? new Date(body.from_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Load the vehicle
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const vehicle = vehicles.find((v: any) => v.id === vehicleId);
    if (!vehicle) {
      return Response.json({ ok: false, error: 'Vehicle not found' });
    }
    if (!vehicle.geotab_device_id) {
      return Response.json({ ok: false, error: 'This vehicle has no Geotab device linked. Sync from Geotab first.' });
    }

    // Load Geotab config
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'geotab_config' });
    const cfg = settings[0]?.value || {};
    if (!cfg.username || !cfg.password || !cfg.database) {
      return Response.json({ ok: false, error: 'Geotab credentials not configured. Add them in Settings → Geotab GPS Sync.' });
    }

    const serverHint = cfg.server || 'my.geotab.com';

    async function authenticate(server: string): Promise<{ creds?: GeotabCredentials; redirectServer?: string; error?: string }> {
      const apiUrl = `https://${server.replace(/^https?:\/\//, '')}/apiv1`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Authenticate',
          params: { userName: cfg.username, password: cfg.password, database: cfg.database },
        }),
      }).catch(() => null);
      if (!res || !res.ok) return { error: 'Geotab authentication failed' };
      const json = await res.json().catch(() => null);
      if (json?.error) {
        const errMsg = json.error.message || '';
        if (/IncorrectServer/i.test(errMsg)) {
          const redirect = json.error.data?.path || '';
          if (redirect) return { error: errMsg, redirectServer: redirect };
        }
        return { error: errMsg };
      }
      const creds = json?.result?.credentials || null;
      if (!creds?.sessionId) return { error: 'No session returned' };
      return { creds };
    }

    let authResult = await authenticate(serverHint);
    if (!authResult.creds && authResult.redirectServer && authResult.redirectServer !== serverHint) {
      authResult = await authenticate(authResult.redirectServer);
    }
    if (!authResult.creds) {
      return Response.json({ ok: false, error: authResult.error || 'Geotab authentication failed' });
    }
    const creds: GeotabCredentials = authResult.creds;
    const apiUrl = `https://${(cfg.server || serverHint).replace(/^https?:\/\//, '')}/apiv1`;

    // Fetch ExceptionEvents for this device in the date range
    async function geotabGet(typeName: string, search: any, resultsLimit = 1000): Promise<any[]> {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'Get', params: { typeName, credentials: creds, search, resultsLimit } }),
      }).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      return Array.isArray(json?.result) ? json.result : [];
    }

    const [exceptions, ruleList] = await Promise.all([
      geotabGet('ExceptionEvent', {
        deviceSearch: { id: vehicle.geotab_device_id },
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      }, limit),
      geotabGet('Rule', undefined, 2000),
    ]);

    // Build rule lookup map
    const ruleMap: Record<string, any> = {};
    for (const r of ruleList) ruleMap[r.id] = r;

    // Process events into a clean structure
    const events = exceptions
      .map((ex: any) => {
        const rule = ex.rule?.id ? ruleMap[ex.rule.id] : null;
        const ruleName = rule?.name || ex.rule?.name || 'Unknown Rule';
        const violationType = classifyRule(ruleName);
        const dt = ex.dateTime ? new Date(ex.dateTime) : null;
        return {
          id: ex.id || `${ex.device?.id}-${ex.dateTime}`,
          datetime: dt?.toISOString() || null,
          date: dt ? dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
          time: dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—',
          violation_type: violationType,
          violation_label: VIOLATION_LABELS[violationType] || ruleName,
          rule_name: ruleName,
          driver_name: ex.driver?.name || null,
          speed_kph: ex.speed != null ? Number(ex.speed) : null,
          speed_limit_kph: ex.maximumSpeed != null ? Number(ex.maximumSpeed) : null,
          duration_seconds: ex.duration != null ? Number(ex.duration) : null,
          latitude: ex.latitude != null ? Number(ex.latitude) : null,
          longitude: ex.longitude != null ? Number(ex.longitude) : null,
          device_name: ex.device?.name || null,
          severity: ex.isSeverityHigh ? 'high' : ex.isSeverityMedium ? 'medium' : 'low',
        };
      })
      .sort((a: any, b: any) => {
        if (!a.datetime) return 1;
        if (!b.datetime) return -1;
        return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
      });

    // Build summary
    const summary = {
      total: events.length,
      harsh_braking: events.filter((e: any) => e.violation_type === 'harsh_braking').length,
      speeding: events.filter((e: any) => e.violation_type === 'speeding').length,
      harsh_accel: events.filter((e: any) => e.violation_type === 'harsh_accel').length,
      harsh_cornering: events.filter((e: any) => e.violation_type === 'harsh_cornering').length,
      seatbelt: events.filter((e: any) => e.violation_type === 'seatbelt').length,
      idling: events.filter((e: any) => e.violation_type === 'idling').length,
      other: events.filter((e: any) => e.violation_type === 'other').length,
      unique_drivers: [...new Set(events.map((e: any) => e.driver_name).filter(Boolean))].length,
      date_range_days: Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)),
    };

    return Response.json({ ok: true, events, summary, vehicle: { registration_number: vehicle.registration_number, name: vehicle.name } });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || 'Failed to fetch safety events' }, { status: 500 });
  }
}