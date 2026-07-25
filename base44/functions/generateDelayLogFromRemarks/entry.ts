import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// generateDelayLogFromRemarks
// ============================================================
// AI-powered scan of a job's recent driller remarks / investigation
// log descriptions. Detects delay-causing language (ground conditions,
// utility clashes, weather, mechanical failure, access issues, client
// requests, third-party hold-ups) and auto-creates pending JobDelayLog
// entries for manager review — bridging the gap between field diaries
// and the formal delay-approval / rota-shift workflow.
//
// Triggered on demand from the DelayLogManager ("Scan remarks for delays").
// Deduplicates against existing pending delay logs to avoid recreating
// the same event on repeated scans.

const DELAY_TYPES = [
  'ground_conditions', 'utility_clash', 'weather', 'mechanical_failure',
  'access_issue', 'client_request', 'third_party', 'other',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* empty payload ok */ }
    const jobId = String(body.job_id || '').trim();
    if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 });

    // Pull recent investigation logs for the job (remarks + manual logs with text).
    const since = body.since_date
      ? String(body.since_date)
      : new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const logs = await base44.asServiceRole.entities.InvestigationLog.filter({
      job_id: jobId,
      date: { $gte: since },
    }, '-created_date', 200);

    // Only keep entries with meaningful free-text descriptions.
    const candidates = logs.filter((l) => {
      const d = (l.description || '').trim();
      return d.length >= 12;
    });

    if (candidates.length === 0) {
      return Response.json({ scanned: 0, created: 0, message: 'No remark text found to scan for this job.' });
    }

    // Existing pending delay logs (for dedup).
    const existing = await base44.asServiceRole.entities.JobDelayLog.filter({
      job_id: jobId,
      manager_review_status: 'pending',
    });

    // Normalised snippet set for cheap duplicate detection.
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const existingSnippets = new Set(existing.map((l) => norm(l.description)));
    const scannedIds = new Set(existing.map((l) => String(l.description || '').match(/\[log:([a-f0-9]+)\]/i)?.[1]).filter(Boolean));

    // Build the LLM corpus — each item keyed by its log id.
    const corpus = candidates.map((l) => ({
      id: l.id,
      date: l.date,
      staff: l.staff_name || '',
      text: (l.description || '').trim().slice(0, 500),
    }));

    const corpusText = corpus.map((c) => `LOG ${c.id} (${c.date}, ${c.staff}): ${c.text}`).join('\n');

    const schema = {
      type: 'object',
      properties: {
        delays: {
          type: 'array',
          description: 'Genuine delay events inferred from the driller remarks. Empty if none.',
          items: {
            type: 'object',
            properties: {
              source_log_id: { type: 'string', description: 'The LOG id this delay was inferred from.' },
              delay_type: { type: 'string', enum: DELAY_TYPES },
              description: { type: 'string', description: 'A concise description of what caused the delay and the impact, in professional English.' },
              impacted_days: { type: 'number', description: 'Whole working days added to the job. 0 if sub-day.' },
              impacted_hours: { type: 'number', description: 'Additional hours for a sub-day delay. 0 if whole-day.' },
            },
            required: ['source_log_id', 'delay_type', 'description', 'impacted_days', 'impacted_hours'],
          },
        },
      },
      required: ['delays'],
    };

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a geotechnical operations analyst. The following are time-stamped driller remarks and site log descriptions from a ground investigation job. Identify any that describe a genuine DELAY to the works — i.e. the crew was held up, stopped, or slowed by something outside normal progress (not routine activities like briefing, lunch, mobilising, sampling, or standby).

Delay categories:
- ground_conditions: boulders, obstructions, voids, hard digging, fluid loss
- utility_clash: uncharted services, cables, pipes encountered
- weather: rain, snow, high wind, flooding halting work
- mechanical_failure: rig/plant breakdown, hydraulic issues, generator failure
- access_issue: plant can't reach location, traffic, gate locked, ground too soft for rig
- client_request: scope change, hold requested by client
- third_party: another contractor on site, waiting on others
- other: anything else that genuinely delayed progress

Rules:
- Only flag REAL delays. Routine drilling, sampling, standpipe installs, lunch, standby, travel are NOT delays.
- Estimate impacted_days (whole working days) and impacted_hours (sub-day hours). Be conservative — if unsure, use 0.
- Keep descriptions concise and factual.
- If no genuine delay is present, return an empty delays array.

Remarks:
${corpusText}`,
      response_json_schema: schema,
    });

    const detected = Array.isArray((llmRes as any)?.delays) ? (llmRes as any).delays : [];

    // Create delay logs, deduping against existing snippets + already-scanned source ids.
    const created = [];
    for (const d of detected) {
      const sourceId = String(d.source_log_id || '').trim();
      if (!sourceId) continue;
      if (scannedIds.has(sourceId)) continue; // already generated a delay from this log
      const src = corpus.find((c) => c.id === sourceId);
      if (!src) continue;
      const desc = `${String(d.description || '').trim()} [log:${sourceId}]`;
      if (existingSnippets.has(norm(desc))) continue;

      const impacted_days = Math.max(0, Math.round(Number(d.impacted_days) || 0));
      const impacted_hours = Math.max(0, Number(d.impacted_hours) || 0);

      const rec = await base44.asServiceRole.entities.JobDelayLog.create({
        job_id: jobId,
        job_name: body.job_name || '',
        staff_id: (logs.find((l) => l.id === sourceId)?.staff_id) || '',
        staff_name: src.staff || '',
        reported_at: new Date().toISOString(),
        delay_type: DELAY_TYPES.includes(d.delay_type) ? d.delay_type : 'other',
        impacted_days,
        impacted_hours,
        description: desc,
        manager_review_status: 'pending',
      });
      created.push(rec);
      existingSnippets.add(norm(desc));
      scannedIds.add(sourceId);
    }

    return Response.json({
      scanned: candidates.length,
      detected: detected.length,
      created: created.length,
      delays: created.map((r) => ({
        id: r.id, delay_type: r.delay_type, description: r.description.replace(/\s*\[log:[a-f0-9]+\]$/, ''),
        impacted_days: r.impacted_days, impacted_hours: r.impacted_hours,
      })),
      message: created.length > 0
        ? `${created.length} potential delay(s) detected and logged for review.`
        : detected.length === 0
          ? 'No delay language found in recent remarks.'
          : 'All detected delays were already logged previously.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});