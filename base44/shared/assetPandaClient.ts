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
  const token = config.api_token || '';
  if (!token) {
    return {
      skipped: true,
      error:
        'No API token configured. Paste your Asset Panda API token in Settings → Asset Panda.',
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