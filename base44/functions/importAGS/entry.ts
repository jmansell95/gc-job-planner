import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ---- AGS v3/v4 text parser ----
// AGS is a tab-delimited text format. Each block (group) has a heading row
// (group name + field names) and data rows. v4 prefixes data rows with "DATA";
// v3 repeats the group name. We handle both.
function parseAGS(text: string) {
  const lines = text.split(/\r?\n/);
  const groups: Record<string, { headings: string[]; rows: string[][] }> = {};

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = line.split('\t').map(f => f.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    const first = fields[0];

    // Skip AGS metadata rows (units / data types)
    if (first === 'UNIT' || first === 'TYPE') continue;

    if (first === 'DATA' && fields.length >= 2) {
      const groupName = fields[1];
      if (groups[groupName] && groups[groupName].headings) {
        groups[groupName].rows.push(fields.slice(2));
      }
      continue;
    }

    // Potential group heading or v3 data row
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(first)) {
      if (!groups[first]) {
        const rest = fields.slice(1);
        // Heading row — remaining fields must look like AGS field names
        if (rest.length > 0 && rest.every(f => /^[A-Z][A-Z0-9_]{1,}$/.test(f))) {
          groups[first] = { headings: rest, rows: [] };
        }
      } else if (groups[first].headings) {
        // v3 data row (same group name prefix)
        groups[first].rows.push(fields.slice(1));
      }
    }
  }

  return groups;
}

function rowToObj(group: { headings: string[] }, row: string[]) {
  const obj: Record<string, string> = {};
  group.headings.forEach((h, i) => { obj[h] = row[i] != null ? row[i] : ''; });
  return obj;
}

function num(v: string | undefined | null): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

// Map free-text geology to the InvestigationLog strata_descriptor enum
function mapStrataDescriptor(text: string): string {
  if (!text) return 'other';
  const t = text.toLowerCase();
  if (t.includes('topsoil')) return 'topsoil';
  if (t.includes('made') || t.includes('fill')) return 'made_ground';
  if (t.includes('peat')) return 'peat';
  if (t.includes('chalk')) return 'chalk';
  if (t.includes('mudstone') || t.includes('claystone') || t.includes('shale')) return 'mudstone';
  if (t.includes('sandstone')) return 'sandstone';
  if (t.includes('limestone')) return 'limestone';
  if (t.includes('granite') || t.includes('igneous') || t.includes('basalt')) return 'granite';
  if (t.includes('concrete')) return 'concrete';
  if (t.includes('tarmac') || t.includes('asphalt')) return 'tarmac';
  if (t.includes('gravel') || t.includes('cobble') || t.includes('boulder')) return 'gravel';
  if (t.includes('silt') && !t.includes('clay')) return 'silt';
  if (t.includes('clay')) {
    if (t.includes('soft') || t.includes('sloppy')) return 'clay_soft';
    if (t.includes('stiff') || t.includes('hard') || t.includes('very')) return 'clay_stiff';
    return 'clay_firm';
  }
  if (t.includes('sand')) {
    if (t.includes('dense')) return 'sand_dense';
    if (t.includes('medium') || t.includes('med') || t.includes('compact')) return 'sand_medium_dense';
    if (t.includes('loose')) return 'sand_loose';
    return 'sand_medium_dense';
  }
  return 'other';
}

function mapSampleType(agsType: string): string {
  const t = String(agsType || '').toUpperCase().trim();
  if (t.startsWith('U')) return 'undisturbed';
  if (t.startsWith('D') || t.startsWith('B')) return 'disturbed';
  if (t.startsWith('W')) return 'water';
  return 'none';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const fileUrl = body.file_url;
    const jobId: string | null = body.job_id || null;
    if (!fileUrl) return Response.json({ error: 'file_url is required' }, { status: 400 });

    // Download + parse the AGS file
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return Response.json({ error: 'Could not download AGS file' }, { status: 422 });
    const text = await fileRes.text();
    const groups = parseAGS(text);

    // Resolve the target job. Explicit job_id wins; otherwise match by job_reference
    // against the AGS PROJ_ID (or PROJ_NAME).
    let job: any = null;
    if (jobId) {
      try { job = await base44.asServiceRole.entities.Job.get(jobId); } catch (e) { job = null; }
    }
    if (!job && groups.PROJ && groups.PROJ.rows.length) {
      const proj = rowToObj(groups.PROJ, groups.PROJ.rows[0]);
      const projId = (proj.PROJ_ID || proj.PROJ_NAME || '').trim();
      if (projId) {
        const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
        const lower = projId.toLowerCase();
        job = jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === lower)
          || jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase().includes(lower))
          || jobs.find((j: any) => j.name && j.name.toLowerCase().includes(lower));
      }
    }
    if (!job) {
      return Response.json({
        error: 'Could not match an existing job. Select the job manually, or make sure the job reference matches the AGS PROJ_ID.'
      }, { status: 422 });
    }

    // Resolve a staff_id for the imported logs (the importing admin's Staff record)
    let staffId = user.id;
    try {
      const staff = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id });
      if (staff.length) staffId = staff[0].id;
    } catch (e) { /* fall back to user.id */ }

    const today = new Date().toISOString().slice(0, 10);
    const logs: any[] = [];
    const counts = { locations: 0, strata: 0, samples: 0, spt: 0 };

    // LOCA — borehole locations → one summary log per hole
    if (groups.LOCA && groups.LOCA.rows.length) {
      for (const row of groups.LOCA.rows) {
        const r = rowToObj(groups.LOCA, row);
        const locaId = r.LOCA_ID || r.LOCA_REF;
        if (!locaId) continue;
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: today,
          log_type: 'borehole_progress',
          borehole_ref: locaId,
          depth_to: num(r.LOCA_GL) || num(r.LOCA_FDEPTH),
          groundwater_strike_depth: num(r.LOCA_GND) || num(r.LOCA_GW_DEPTH),
          description: `Imported from KeyLogBook AGS — borehole ${locaId} (${r.LOCA_TYPE || 'borehole'}).`,
          source: 'ags_import',
          completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved',
          chargeable: false,
        });
        counts.locations++;
      }
    }

    // GEOL — strata / geology descriptions
    if (groups.GEOL && groups.GEOL.rows.length) {
      for (const row of groups.GEOL.rows) {
        const r = rowToObj(groups.GEOL, row);
        const desc = (r.GEOL_DESC || r.GEOL_LEGEND || r.GEOL_GEN || '').trim();
        if (!desc) continue;
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: today,
          log_type: 'borehole_progress',
          borehole_ref: r.LOCA_ID || r.GEOL_LOCA_ID || '',
          depth_from: num(r.GEOL_TOP),
          depth_to: num(r.GEOL_BASE) || num(r.GEOL_BOT),
          strata_descriptor: mapStrataDescriptor(desc),
          strata_description_detail: desc,
          description: 'Imported from KeyLogBook AGS — strata.',
          source: 'ags_import',
          completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved',
          chargeable: false,
        });
        counts.strata++;
      }
    }

    // SAMP — samples
    if (groups.SAMP && groups.SAMP.rows.length) {
      for (const row of groups.SAMP.rows) {
        const r = rowToObj(groups.SAMP, row);
        const sampId = r.SAMP_ID || r.SAMP_REF || r.SAMP_NO || '';
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: today,
          log_type: 'sample_collection',
          borehole_ref: r.LOCA_ID || r.SAMP_LOCA_ID || '',
          sample_id: sampId,
          depth_from: num(r.SAMP_TOP) || num(r.SAMP_DEP),
          sample_type: mapSampleType(r.SAMP_TYPE),
          description: `Imported from KeyLogBook AGS — sample ${sampId} (${r.SAMP_TYPE || ''}).`,
          source: 'ags_import',
          completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved',
          chargeable: false,
        });
        counts.samples++;
      }
    }

    // SPT — standard penetration tests
    if (groups.SPT && groups.SPT.rows.length) {
      for (const row of groups.SPT.rows) {
        const r = rowToObj(groups.SPT, row);
        const blows = [r.SPT_BL1, r.SPT_BL2, r.SPT_BL3].map(b => num(b)).filter((b): b is number => b != null);
        const nval = num(r.SPT_NVAL) || (blows.length >= 3 ? blows[1] + blows[2] : null);
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: today,
          log_type: 'borehole_progress',
          borehole_ref: r.LOCA_ID || r.SPT_LOCA_ID || '',
          depth_from: num(r.SPT_TOP),
          depth_to: num(r.SPT_BASE) || num(r.SPT_BOT),
          spt_blows: blows,
          spt_n_value: nval,
          description: `Imported from KeyLogBook AGS — SPT (N=${nval != null ? nval : 'n/a'}).`,
          source: 'ags_import',
          completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved',
          chargeable: false,
        });
        counts.spt++;
      }
    }

    if (logs.length === 0) {
      return Response.json({ error: 'No LOCA, GEOL, SAMP or SPT records were found in this AGS file.' }, { status: 422 });
    }

    // Bulk insert (cap at 500 per call per platform limit)
    let inserted = 0;
    for (let i = 0; i < logs.length; i += 500) {
      const batch = logs.slice(i, i + 500);
      await base44.asServiceRole.entities.InvestigationLog.bulkCreate(batch);
      inserted += batch.length;
    }

    return Response.json({
      status: 'success',
      job_id: job.id,
      job_name: job.name,
      job_reference: job.job_reference,
      inserted,
      counts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});