// Shared Asset Panda push logic — used by processAssetReturn (real-time)
// and retryAssetReturnSync (scheduled retry of failed pushes).
// Updates each asset's stock-status field to 'In Stock' via the Asset Panda REST API.

export async function pushToAssetPanda(base44, pandaAssetIds) {
  const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
  const config = configs && configs[0];
  if (!config || !config.group_id) {
    return { attempted: false, reason: 'Asset Panda not configured' };
  }

  const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
  let token = config.api_token || '';

  if (!token && config.email && config.password) {
    const tokenRes = await fetch(`${baseUrl}/v3/session/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: config.email, password: config.password }),
    });
    if (!tokenRes.ok) return { attempted: true, success: false, error: 'Auth failed' };
    const tokenJson = await tokenRes.json();
    token = tokenJson.token || tokenJson.access_token || tokenJson.accessToken || '';
  }
  if (!token) return { attempted: false, reason: 'No token' };

  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const stockField = config.field_stock_status || '';
  let updated = 0;
  const errors = [];

  for (const pandaId of pandaAssetIds) {
    try {
      const updateBody = {};
      if (stockField) updateBody[stockField] = 'In Stock';
      const res = await fetch(`${baseUrl}/v3/groups/${config.group_id}/objects/${pandaId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(updateBody),
      });
      if (res.ok) updated++;
      else errors.push(`${pandaId}: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${pandaId}: ${e.message}`);
    }
  }

  // Cache the token for the next sync run
  if (config.id && token) {
    try {
      await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, { api_token: token });
    } catch (_) {}
  }

  return {
    attempted: true,
    success: errors.length === 0,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  };
}