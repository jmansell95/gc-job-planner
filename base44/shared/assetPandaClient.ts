// ---------------------------------------------------------------------------
// assetPandaClient — shared helpers for the Asset Panda integration functions.
// Used by: syncAssetPanda, getAssetPandaGroupFields, assetPandaWebhook,
// pushAllToAssetPanda, pushAssetUpdateToPanda, pushSignOutToPanda,
// testAssetPandaConnection.
// ---------------------------------------------------------------------------

export interface PandaField {
  key: string;
  label: string;
}

/**
 * Resolve a bearer token from the saved Asset Panda config.
 * Uses api_token if present, otherwise authenticates with the Asset Panda
 * web-login email + password (POST /v3/session-token).
 * Returns { token } on success, { error, skipped } when no credentials are
 * configured (skipped=true so scheduled automations don't auto-pause), or
 * { error } when authentication fails.
 */
export async function resolvePandaToken(
  config: any,
  baseUrl: string
): Promise<{ token?: string; error?: string; skipped?: boolean }> {
  // 1. A pre-generated session token (api_token) wins if present and valid-looking.
  let token = config.api_token || '';

  // 2. Otherwise authenticate with the Asset Panda WEB LOGIN (email + password)
  //    to get a fresh session token. The V3 /v3/session-token endpoint requires
  //    a real Asset Panda user email + password — the "Client ID"/"Client Secret"
  //    issued on the API Configuration page is a UUID that this endpoint rejects
  //    with "User email not found!". Use the email + password you sign into
  //    app.assetpanda.com with. Session tokens expire, so we generate a new one
  //    on every call. Trim whitespace (copy-paste often adds stray spaces).
  const email = String(config.email || '').trim();
  const secret = String(config.password || '').trim();
  if (!token && email && secret) {
    try {
      // The documented endpoint is /v3/session-token (hyphen). Try it first,
      // then fall back to /v3/session/token (slash) for older base URLs.
      const paths = ['/v3/session-token', '/v3/session/token'];
      let tokenRes: Response | null = null;
      let lastErrBody = '';
      for (const path of paths) {
        tokenRes = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ email, password: secret }),
        });
        if (tokenRes.ok) break;
        lastErrBody = await tokenRes.text().catch(() => '');
        // If we got a structured auth error (not a 404), don't retry the other path.
        if (tokenRes.status !== 404) break;
      }
      if (tokenRes && !tokenRes.ok) {
        return {
          error:
            `Asset Panda rejected the credentials: ${lastErrBody || `HTTP ${tokenRes.status}`}. ` +
            `The Email and Password must be the credentials you sign into app.assetpanda.com with ` +
            `(not the API Configuration Client ID/Secret, which is a UUID the session endpoint rejects). ` +
            `Check both are correct and have no trailing spaces.`,
        };
      }
      const tokenJson: any = await (tokenRes as Response).json();
      token =
        tokenJson.token ||
        tokenJson.access_token ||
        tokenJson.accessToken ||
        (typeof tokenJson === 'string' ? tokenJson : '');
      if (!token) {
        return { error: 'Asset Panda did not return a session token. Check your email and password.' };
      }
    } catch (e: any) {
      return { error: `Token request failed: ${e.message}` };
    }
  }

  if (!token) {
    return {
      skipped: true,
      error:
        'No credentials configured. Enter your Asset Panda web-login email and password (the ones you sign into app.assetpanda.com with) in Settings → Asset Panda.',
    };
  }
  return { token };
}

/**
 * Fetch all groups in the Asset Panda account via GET /v3/groups.
 * Returns normalised [{ id, name, key }].
 */
export async function fetchAllPandaGroups(
  baseUrl: string,
  token: string
): Promise<{ id: string; name: string; key: string }[]> {
  const res = await fetch(`${baseUrl}/v3/groups`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch groups (HTTP ${res.status})`);
  }
  const json: any = await res.json();
  const groups = Array.isArray(json) ? json : json.groups || json.data || [];
  return groups.map((g: any) => ({
    id: String(g.id ?? g._id ?? ''),
    name: String(g.name || g.label || ''),
    key: String(g.key || ''),
  }));
}

/**
 * Fetch the field definitions for a group. Returns normalised [{ key, label }].
 */
export async function fetchPandaGroupFields(
  baseUrl: string,
  token: string,
  groupId: string
): Promise<PandaField[]> {
  const fieldsRes = await fetch(`${baseUrl}/v3/groups/${groupId}/fields`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!fieldsRes.ok) {
    throw new Error(`Could not fetch group fields (HTTP ${fieldsRes.status})`);
  }
  const fieldsJson: any = await fieldsRes.json();
  const fields = Array.isArray(fieldsJson)
    ? fieldsJson
    : fieldsJson.fields || fieldsJson.data || [];
  return fields.map((f: any) => ({
    key: String(f.key || f.id || f.field_key || ''),
    label: String(f.label || f.name || f.key || ''),
  }));
}

/**
 * Build a complete field map: system_field -> panda_field_key.
 * Merges the custom field_map array with the legacy fixed field_* defaults.
 * The custom field_map entries take precedence over the legacy fixed fields.
 */
export function buildFullFieldMap(config: any): Record<string, string> {
  const map: Record<string, string> = {};
  // Legacy fixed fields as defaults (backward compatible)
  if (config.field_name) map.name = config.field_name;
  if (config.field_serial) map.serial_number = config.field_serial;
  if (config.field_daily_rate) map.daily_billing_rate = config.field_daily_rate;
  if (config.field_stock_status) map.stock_level = config.field_stock_status;
  if (config.field_asset_type) map.asset_type = config.field_asset_type;
  // Custom field_map overrides + extends
  if (Array.isArray(config.field_map)) {
    for (const entry of config.field_map) {
      if (entry?.system_field && entry?.panda_field_key) {
        map[entry.system_field] = entry.panda_field_key;
      }
    }
  }
  return map;
}