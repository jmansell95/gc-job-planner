import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * syncPowerBI — pulls table data from Power BI datasets into cached
 * PowerBIDataset records so the Reporting Hub can render them as native charts.
 *
 * Uses Azure AD client-credentials to authenticate as a service principal,
 * then calls the Power BI REST executeQueries endpoint for each configured
 * dataset/table. Designed to run both manually (from the Power BI settings UI)
 * and on a nightly schedule (no user context) — all entity reads/writes go
 * through base44.asServiceRole so there's no dependency on a logged-in user.
 *
 * Config is stored in the AppSetting entity under key 'powerbi_config':
 *   { tenant_id, client_id, client_secret, datasets: [{ dataset_id, table_name, label, chart_type, x_field, y_field }], max_rows }
 */
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;

  // --- Load Power BI config ---
  let settings;
  try {
    settings = await db.entities.AppSetting.filter({ key: 'powerbi_config' });
  } catch (e) {
    return Response.json({ ok: false, error: 'Unable to read Power BI config: ' + String(e).slice(0, 200) }, { status: 500 });
  }
  const cfg = settings[0]?.value;
  if (!cfg || !cfg.tenant_id || !cfg.client_id || !cfg.client_secret) {
    return Response.json({ ok: false, error: 'Power BI not configured. Add tenant ID, client ID and client secret in Enterprise Settings → Integrations → Power BI.' }, { status: 400 });
  }

  const datasets = Array.isArray(cfg.datasets) ? cfg.datasets : [];
  if (!datasets.length) {
    return Response.json({ ok: false, error: 'No datasets configured. Add at least one dataset/table to sync.' }, { status: 400 });
  }
  const maxRows = Math.min(Math.max(Number(cfg.max_rows) || 500, 10), 2000);

  // --- Azure AD client-credentials token ---
  let accessToken;
  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${cfg.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.client_id,
        client_secret: cfg.client_secret,
        scope: 'https://analysis.windows.net/powerbi/api/.default',
        grant_type: 'client_credentials',
      }),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return Response.json({ ok: false, error: 'Azure AD auth failed: ' + errText.slice(0, 300) }, { status: 401 });
    }
    const tokenJson = await tokenRes.json();
    accessToken = tokenJson.access_token;
  } catch (e) {
    return Response.json({ ok: false, error: 'Azure AD token request error: ' + String(e).slice(0, 200) }, { status: 502 });
  }

  const authHeaders = { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' };

  // --- Sync each configured dataset/table ---
  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const ds of datasets) {
    const datasetId = ds.dataset_id;
    const table = ds.table_name;
    if (!datasetId || !table) {
      results.push({ dataset_id: datasetId, table, ok: false, error: 'Missing dataset_id or table_name' });
      failCount++;
      continue;
    }
    try {
      const body = JSON.stringify({
        queries: [{ query: `EVALUATE TOPN(${maxRows}, VALUES('${table}'))` }],
      });
      const qRes = await fetch(`https://api.powerbi.com/v1.0/myorg/datasets/${datasetId}/executeQueries`, {
        method: 'POST',
        headers: authHeaders,
        body,
      });
      if (!qRes.ok) {
        const errText = await qRes.text();
        results.push({ dataset_id: datasetId, table, ok: false, error: errText.slice(0, 200) });
        failCount++;
        continue;
      }
      const qJson = await qRes.json();
      const tableData = qJson?.results?.[0]?.tables?.[0];
      const rawRows = Array.isArray(tableData?.rows) ? tableData.rows : [];
      const rows = rawRows.slice(0, maxRows).map(r => {
        const o = {};
        for (const [k, v] of Object.entries(r)) o[k] = v;
        return o;
      });
      const columns = rows.length ? Object.keys(rows[0]) : [];

      const key = `datasetId:${datasetId}:${table}`;
      const label = ds.label || table;
      const payload = {
        key,
        label,
        dataset_id: datasetId,
        table_name: table,
        columns,
        rows,
        row_count: rows.length,
        chart_type: ds.chart_type || 'table',
        x_field: ds.x_field || (columns[0] || ''),
        y_field: ds.y_field || (columns[1] || ''),
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        sync_error: '',
      };

      const existing = await db.entities.PowerBIDataset.filter({ key });
      if (existing[0]) await db.entities.PowerBIDataset.update(existing[0].id, payload);
      else await db.entities.PowerBIDataset.create(payload);

      results.push({ dataset_id: datasetId, table, ok: true, rows: rows.length });
      successCount++;
    } catch (e) {
      results.push({ dataset_id: datasetId, table, ok: false, error: String(e).slice(0, 200) });
      failCount++;
    }
  }

  // --- Update config last-sync metadata ---
  try {
    await db.entities.AppSetting.update(settings[0].id, {
      value: {
        ...cfg,
        last_sync_at: new Date().toISOString(),
        last_sync_status: failCount === 0 ? 'success' : (successCount === 0 ? 'failed' : 'partial'),
      },
    });
  } catch (e) {
    // non-fatal — sync results are already persisted on the dataset records
  }

  return Response.json({ ok: true, synced: successCount, failed: failCount, results });
}