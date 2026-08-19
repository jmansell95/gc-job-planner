// ---------------------------------------------------------------------------
// assetPandaClient — shared helpers for the Asset Panda integration functions.
// Used by: syncAssetPanda, getAssetPandaGroupFields, assetPandaWebhook.
// ---------------------------------------------------------------------------

export interface PandaField {
  key: string;
  label: string;
}

/**
 * Resolve a bearer token from the saved Asset Panda config.
 * Uses api_token if present, otherwise authenticates with email/password.
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

  // 2. Otherwise exchange the Client ID + Client Secret (issued on Asset Panda's
  //    API Configuration page) for a fresh session token via POST /v3/session/token.
  //    Asset Panda labels these "Client ID" and "Client Secret" in their UI; the
  //    V3 session endpoint accepts them as the email/password pair. Session tokens
  //    expire, so we generate a new one on every call rather than storing it.
  if (!token && (config.client_id || config.email) && (config.client_secret || config.password)) {
    try {
      const tokenRes = await fetch(`${baseUrl}/v3/session/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: config.client_id || config.email,
          password: config.client_secret || config.password,
        }),
      });
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        return { error: `Asset Panda authentication failed: ${errBody}` };
      }
      const tokenJson: any = await tokenRes.json();
      token =
        tokenJson.token ||
        tokenJson.access_token ||
        tokenJson.accessToken ||
        (typeof tokenJson === 'string' ? tokenJson : '');
      if (!token) {
        return { error: 'Asset Panda did not return a session token. Check your Client ID and Client Secret.' };
      }
    } catch (e: any) {
      return { error: `Token request failed: ${e.message}` };
    }
  }

  if (!token) {
    return {
      skipped: true,
      error:
        'No credentials configured. Paste your Asset Panda Client ID and Client Secret (from Asset Panda → Settings → API Configuration) in Settings → Asset Panda.',
    };
  }
  return { token };
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