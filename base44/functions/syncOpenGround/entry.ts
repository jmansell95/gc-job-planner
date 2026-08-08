import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue, updateAppSettingValue } from '../../shared/appSettings.ts';
import { buildAGSContent } from '../../shared/agsBuilder.ts';

// ============================================================
// syncOpenGround
// ============================================================
// Pushes approved investigation logs for a job directly to the
// Bentley OpenGround cloud database via its REST API.
//
// Actions:
//   - "test":  Validates credentials by requesting an access token.
//   - "sync":  Builds the AGS file and POSTs it to OpenGround.
//
// Credentials are stored in the AppSetting entity (key:
// "openground_config") — the admin enters them via the settings UI.

const DEFAULTS = {
  token_url: 'https://ims.bentley.com/connect/token',
  api_url: 'https://api.bentley.com/geotechnical/imports',
  scope: 'geotechnical:modify',
};

async function getAccessToken(cfg: any): Promise<string> {
  const tokenUrl = cfg.token_url || DEFAULTS.token_url;
  const scope = cfg.scope || DEFAULTS.scope;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    scope,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in response');
  return data.access_token as string;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'manager') {
      return Response.json({ error: 'Admin or manager only' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action || 'sync';

    // Load OpenGround config from AppSetting
    const cfg: any = await getAppSettingValue(base44, 'openground_config', {});

    if (!cfg.client_id || !cfg.client_secret) {
      return Response.json({
        ok: false,
        error: 'OpenGround credentials not configured. Enter your Client ID and Client Secret in Settings → OpenGround Sync.',
      }, { status: 422 });
    }

    // ---- TEST action: just validate credentials ----
    if (action === 'test') {
      try {
        const token = await getAccessToken(cfg);
        return Response.json({
          ok: true,
          message: 'Connection successful — OpenGround credentials are valid.',
          token_preview: token.slice(0, 12) + '...',
        });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 400 });
      }
    }

    // ---- SYNC action: build AGS + push to OpenGround ----
    const jobId: string = body.job_id;
    if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    const allLogs = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: jobId });
    const logs = allLogs.filter((l: any) => (l.manager_review_status || 'pending') === 'approved');

    if (logs.length === 0) {
      return Response.json({
        ok: false,
        error: 'No approved logs to push. Review and approve logs in Log QC first.',
      }, { status: 422 });
    }

    // Build the AGS file content
    const agsContent = buildAGSContent(job, logs);

    // Get access token
    const token = await getAccessToken(cfg);

    // Push to OpenGround
    const apiUrl = cfg.api_url || DEFAULTS.api_url;
    const projectId = cfg.project_id || '';

    const pushRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
        'Accept': 'application/json',
        ...(projectId ? { 'X-Project-Id': projectId } : {}),
      },
      body: agsContent,
    });

    if (!pushRes.ok) {
      const errText = await pushRes.text();
      // Update last sync status
      await updateAppSettingValue(base44, 'openground_config', 'OpenGround Sync Configuration', {
        ...cfg,
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'failed',
        last_sync_summary: `Push failed (${pushRes.status}): ${errText.slice(0, 200)}`,
      });
      return Response.json({
        ok: false,
        error: `OpenGround push failed (${pushRes.status}): ${errText.slice(0, 300)}`,
      }, { status: 502 });
    }

    // Parse the response (may be JSON or empty)
    let responseSummary = 'Push accepted by OpenGround.';
    let importId = '';
    try {
      const respData = await pushRes.json();
      if (respData.importId || respData.id) importId = respData.importId || respData.id;
      if (respData.message) responseSummary = respData.message;
    } catch {
      // Response was not JSON — that's fine, the push succeeded
    }

    // Update last sync status
    await updateAppSettingValue(base44, 'openground_config', 'OpenGround Sync Configuration', {
      ...cfg,
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_summary: `Pushed ${logs.length} approved logs for "${job.name}" to OpenGround.`,
    });

    return Response.json({
      ok: true,
      message: responseSummary,
      logs_pushed: logs.length,
      boreholes: [...new Set(logs.map((l: any) => l.borehole_ref).filter(Boolean))].length,
      import_id: importId,
      job_name: job.name,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}