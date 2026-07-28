import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * syncConcurExpenses — SAP Concur integration bridge.
 * Reads credentials + config from the AppSetting record keyed "concur_config"
 * (saved by admins in Settings → SAP Concur Sync), authenticates with the
 * Concur OAuth2 client-credentials flow, then either tests the connection or
 * exports approved DailyCost + SubcontractorLog records as Quick Expenses and
 * locks them on success.
 *
 * Payload: { action: "test" | "export" }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = ['export', 'test', 'scheduled'].includes(body.action) ? body.action : 'test';

    // 1. Load saved Concur config from AppSetting
    const settings = await base44.entities.AppSetting.filter({ key: 'concur_config' });
    const cfg = settings[0]?.value || {};
    const apiUrl = (cfg.api_url || '').replace(/\/$/, '');
    const tokenUrl = (cfg.token_url || '').replace(/\/$/, '');
    const clientId = cfg.client_id;
    const clientSecret = cfg.client_secret;
    const companyUuid = cfg.company_uuid;
    const currency = cfg.default_gl_currency || 'GBP';
    const lockAfterSync = cfg.lock_after_sync !== false;

    if (!clientId || !clientSecret || !tokenUrl) {
      return Response.json({
        ok: false,
        message: 'No API credentials configured — enter your SAP Concur client ID, secret and token URL in Settings to connect.',
      }, { status: 400 });
    }

    // Scheduled mode — respect the auto-sync toggle and the configured cadence
    if (action === 'scheduled') {
      if (cfg.auto_sync_enabled === false) {
        return Response.json({ ok: true, skipped: true, reason: 'auto-sync disabled' });
      }
      const last = cfg.last_auto_sync_at ? new Date(cfg.last_auto_sync_at) : null;
      const nowDate = new Date();
      const freq = cfg.sync_frequency || 'weekly';
      const dayMs = 24 * 3600 * 1000;
      let due = true;
      if (last) {
        if (freq === 'daily') due = (nowDate - last) > 23 * 3600 * 1000;
        else if (freq === 'weekly') due = (nowDate - last) > 6 * dayMs;
        else if (freq === 'monthly') due = (nowDate - last) > 27 * dayMs;
      }
      if (!due) {
        return Response.json({ ok: true, skipped: true, reason: `not due (${freq}) — last sync ${cfg.last_auto_sync_at}` });
      }
    }

    // 2. Authenticate (OAuth2 client-credentials grant)
    const tokenRes = await fetch(`${tokenUrl}/access-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => '');
      return Response.json({
        ok: false,
        message: `Concur authentication failed (${tokenRes.status}). ${detail.slice(0, 200)}`,
      }, { status: 402 });
    }
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return Response.json({ ok: false, message: 'Concur did not return an access token.' }, { status: 502 });
    }

    // Test mode — just verify the connection works
    if (action === 'test') {
      return Response.json({
        ok: true,
        message: `Connected to SAP Concur successfully. Company UUID: ${companyUuid || 'n/a'}, token expires in ${tokenData.expires_in || '?'}s.`,
      });
    }

    // 3. Export mode — push approved records as Quick Expenses
    const baseHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(companyUuid ? { 'Concur-CorrelationId': companyUuid } : {}),
    };

    const approvedCosts = await base44.entities.DailyCost.filter({ status: 'approved' }, '-created_date', 500);
    const approvedSubcons = await base44.entities.SubcontractorLog.filter({ status: 'approved' }, '-created_date', 500);

    const exported = [];
    const errors = [];
    const batchId = `BATCH-${Date.now()}`;
    const now = new Date().toISOString();

    // Push DailyCost records
    for (const c of approvedCosts) {
      try {
        const payload = {
          transactionDate: c.date,
          businessPurpose: c.description || c.category || 'Site expense',
          cost: Number(c.amount_gross || c.amount_net || 0),
          currencyCode: currency,
          expenseTypeCode: c.gl_code || 'MISC',
          vendorName: c.supplier_name || 'Site Crew',
          ...(companyUuid ? { companyId: companyUuid } : {}),
        };
        const res = await fetch(`${apiUrl}/api/v3.0/expense/quickexpenses`, {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          errors.push({ id: c.id, kind: 'expense', error: `${res.status}: ${detail.slice(0, 150)}` });
          continue;
        }
        const data = await res.json().catch(() => ({}));
        const concurId = data.ID || data.id || data.uri || `sent-${c.id}`;
        await base44.entities.DailyCost.update(c.id, {
          status: 'synced_to_concur',
          concur_export_id: concurId,
          synced_at: now,
        });
        exported.push({ id: c.id, kind: 'expense', concur_id: concurId });
      } catch (e) {
        errors.push({ id: c.id, kind: 'expense', error: e.message });
      }
    }

    // Push SubcontractorLog records
    for (const s of approvedSubcons) {
      try {
        const payload = {
          transactionDate: s.date,
          businessPurpose: `${s.work_type || 'Subcontractor'} — ${s.description || s.subcontractor_name || ''}`.trim(),
          cost: Number(s.purchase_cost_gross || s.purchase_cost_net || 0),
          currencyCode: currency,
          expenseTypeCode: s.gl_code || 'SUBCON',
          vendorName: s.subcontractor_name || 'Subcontractor',
          ...(companyUuid ? { companyId: companyUuid } : {}),
        };
        const res = await fetch(`${apiUrl}/api/v3.0/expense/quickexpenses`, {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          errors.push({ id: s.id, kind: 'subcon', error: `${res.status}: ${detail.slice(0, 150)}` });
          continue;
        }
        const data = await res.json().catch(() => ({}));
        const concurId = data.ID || data.id || data.uri || `sent-${s.id}`;
        await base44.entities.SubcontractorLog.update(s.id, {
          status: 'synced',
          concur_export_id: concurId,
          synced_at: now,
        });
        exported.push({ id: s.id, kind: 'subcon', concur_id: concurId });
      } catch (e) {
        errors.push({ id: s.id, kind: 'subcon', error: e.message });
      }
    }

    if (action === 'scheduled' && settings[0]?.id) {
      try {
        await base44.entities.AppSetting.update(settings[0].id, {
          value: { ...cfg, last_auto_sync_at: now },
        });
      } catch (_) { /* non-fatal — audit still captured by export itself */ }
    }
    return Response.json({
      ok: true,
      batch_id: batchId,
      exported: exported.length,
      errors: errors.length,
      error_details: errors.slice(0, 20),
      locked: lockAfterSync ? exported.length : 0,
      message: `Exported ${exported.length} record(s) to SAP Concur${errors.length ? ` · ${errors.length} error(s)` : ''}.`,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}