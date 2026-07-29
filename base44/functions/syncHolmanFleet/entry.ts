import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// Holman Fleet sync — manual pull & connection test
// ============================================================
// Used by the Holman Sync settings page. Supports two actions:
//   - 'test': validates that the stored API credentials can reach
//     the Holman API endpoint and returns a status message.
//   - 'sync': fetches the fleet vehicle list from Holman and updates
//     MOT/service dates and mileage on matching local Vehicle records.
//
// Holman API shapes vary; this function is intentionally defensive,
// trying several common response field paths.

function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function deepGet(obj: any, ...paths: string[]): any {
  for (const p of paths) {
    const parts = p.split('.');
    let cur: any = obj;
    let ok = true;
    for (const part of parts) {
      if (cur == null || typeof cur !== 'object' || !(part in cur)) { ok = false; break; }
      cur = cur[part];
    }
    if (ok && cur != null && cur !== '') return cur;
  }
  return '';
}

function toDateStr(v: any): string | null {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function normalizeReg(reg: any): string {
  return String(reg || '').toUpperCase().replace(/\s/g, '');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const action = payload.action || 'test';

    // Load Holman config
    const configs = await base44.asServiceRole.entities.AppSetting.filter({ key: 'holman_config' });
    const configRec = configs && configs[0];
    if (!configRec) {
      return Response.json({ ok: false, message: 'Holman is not configured. Add your API credentials in Settings first.' });
    }
    const cfg = configRec.value || {};
    if (!cfg.api_key && !cfg.client_id) {
      return Response.json({ ok: false, message: 'No API credentials found. Enter your Holman API key in Settings first.' });
    }
    const baseUrl = (cfg.api_url || 'https://api.holman.com').replace(/\/$/, '');

    // ---- TEST CONNECTION ----
    if (action === 'test') {
      try {
        const testUrl = `${baseUrl}/vehicles?limit=1`;
        const resp = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cfg.api_key}`,
            'x-api-key': cfg.api_key,
            'Accept': 'application/json',
          },
        });

        if (resp.ok) {
          return Response.json({
            ok: true,
            message: `Connected to Holman API at ${baseUrl}.`,
            status_code: resp.status,
          });
        }
        // 401/403 — credentials invalid
        if (resp.status === 401 || resp.status === 403) {
          return Response.json({ ok: false, message: `Authentication failed (HTTP ${resp.status}). Check your API key.` });
        }
        // Other status codes — endpoint may differ but Holman responded
        return Response.json({
          ok: true,
          message: `Holman API responded (HTTP ${resp.status}). Connection is live — verify the endpoint URL matches your Holman portal.`,
          status_code: resp.status,
        });
      } catch (e) {
        return Response.json({ ok: false, message: `Could not reach Holman API: ${e.message}` });
      }
    }

    // ---- SYNC VEHICLES ----
    if (action === 'sync') {
      let fleetData: any[] = [];

      try {
        const syncUrl = `${baseUrl}/vehicles`;
        const resp = await fetch(syncUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cfg.api_key}`,
            'x-api-key': cfg.api_key,
            'Accept': 'application/json',
          },
        });

        if (!resp.ok) {
          return Response.json({ ok: false, message: `Holman API returned HTTP ${resp.status}. Check credentials and endpoint URL.` });
        }

        const json = await resp.json();
        // Defensive: Holman may wrap the list in various keys
        fleetData = Array.isArray(json) ? json
          : Array.isArray(json.vehicles) ? json.vehicles
          : Array.isArray(json.data) ? json.data
          : Array.isArray(json.results) ? json.results
          : [];
      } catch (e) {
        return Response.json({ ok: false, message: `Failed to fetch fleet data: ${e.message}` });
      }

      if (fleetData.length === 0) {
        return Response.json({ ok: false, message: 'Holman API returned no vehicles. Check your Holman account has fleet data available.' });
      }

      // Load all local vehicles for matching
      const localVehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
      let synced = 0;
      let unmatched = 0;

      for (const fv of fleetData) {
        const reg = normalizeReg(deepGet(fv, 'registration', 'registration_number', 'vrn', 'license_plate'));
        const holmanId = String(deepGet(fv, 'id', 'vehicle_id', 'fleet_id', 'asset_id') || '');
        const vin = String(deepGet(fv, 'vin', 'chassis_number') || '');

        let match: any = null;
        if (reg) match = localVehicles.find((v: any) => normalizeReg(v.registration_number) === reg);
        if (!match && holmanId) match = localVehicles.find((v: any) => v.holman_vehicle_id === holmanId);
        if (!match && vin) match = localVehicles.find((v: any) => v.vin === vin);

        if (!match) { unmatched++; continue; }

        const update: any = {
          last_holman_sync: new Date().toISOString(),
          holman_sync_status: 'synced',
        };
        if (holmanId) update.holman_vehicle_id = holmanId;
        if (vin) update.vin = vin;

        const motExpiry = toDateStr(deepGet(fv, 'mot_expiry', 'mot_expiry_date', 'next_mot_date', 'mot.due_date'));
        const serviceDue = toDateStr(deepGet(fv, 'service_due', 'service_due_date', 'next_service_date', 'service.next_due'));
        const lastService = toDateStr(deepGet(fv, 'last_service_date', 'last_service', 'service.last_completed'));
        const mileage = num(deepGet(fv, 'mileage', 'odometer', 'current_mileage'));

        if (motExpiry) update.mot_expiry = motExpiry;
        if (serviceDue) update.service_due_date = serviceDue;
        if (lastService) update.last_service_date = lastService;
        if (mileage != null) update.current_mileage = mileage;

        await base44.asServiceRole.entities.Vehicle.update(match.id, update);
        synced++;
      }

      // Update config status
      try {
        await base44.asServiceRole.entities.AppSetting.update(configRec.id, {
          value: {
            ...cfg,
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'success',
            last_sync_summary: `${synced} vehicle(s) synced, ${unmatched} unmatched from ${fleetData.length} total.`,
          },
        });
      } catch (e) { /* non-fatal */ }

      return Response.json({
        ok: true,
        message: `Sync complete — ${synced} vehicle(s) updated, ${unmatched} unmatched.`,
        synced,
        unmatched,
        total: fleetData.length,
      });
    }

    return Response.json({ ok: false, message: `Unknown action: ${action}` });
  } catch (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 });
  }
}