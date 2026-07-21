import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ---- AGS v3/v4 text parser (robust) ----
// AGS is typically tab-delimited but some exports use commas or semicolons.
// Each block (group) has a heading row (group name + field names) and data rows.
// v4 prefixes data rows with "DATA"; v3 repeats the group name. We handle both
// and auto-detect the delimiter so we work with whatever KeyLogBook exports.

// Split a single delimited line into fields, respecting double-quoted values
// that may contain the delimiter character.
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current); current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map(f => f.trim());
}

// Detect the most likely delimiter from the first non-empty lines.
function detectDelimiter(lines: string[]): string {
  const samples = lines.filter(l => l.trim()).slice(0, 20);
  const counts: Record<string, number> = { '\t': 0, ',': 0, ';': 0 };
  for (const l of samples) {
    if (l.includes('\t')) counts['\t']++;
    if (l.includes(',')) counts[',']++;
    if (l.includes(';')) counts[';']++;
  }
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) return '\t';
  if (counts[','] >= counts[';']) return ',';
  return ';';
}

function parseAGS(text: string) {
  const lines = text.split(/\r?\n/);
  const delimiter = detectDelimiter(lines);
  // Store groups in UPPER CASE so lookups are case-insensitive.
  const groups: Record<string, { headings: string[]; rows: string[][] }> = {};

  // KeyLogBook uses standard AGS v4 format with explicit marker rows:
  //   "GROUP","PROJ"
  //   "HEADING","PROJ_ID","PROJ_NAME",...
  //   "UNIT",...
  //   "TYPE",...
  //   "DATA","I260101",...
  // We track the active group via `currentGroup` so DATA rows know which
  // group (and thus which headings) they belong to.
  let currentGroup: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = splitLine(line, delimiter);
    const first = (fields[0] || '').toUpperCase();

    // "GROUP","PROJ" — declares the start of a new group
    if (first === 'GROUP' && fields.length >= 2) {
      currentGroup = (fields[1] || '').toUpperCase();
      if (currentGroup && !groups[currentGroup]) {
        groups[currentGroup] = { headings: [], rows: [] };
      }
      continue;
    }

    // "HEADING","PROJ_ID","PROJ_NAME",... — field names for the current group
    if (first === 'HEADING' && fields.length >= 2) {
      if (currentGroup && groups[currentGroup]) {
        groups[currentGroup].headings = fields.slice(1).map(f => f.toUpperCase());
      }
      continue;
    }

    // Skip AGS metadata rows (units / type / file / remarks / dictionary)
    if (['UNIT', 'TYPE', 'FILE', 'REMARK', 'COMMENT', 'ABBR', 'DICT', 'TRAN'].includes(first)) continue;

    // "DATA","value1","value2",... — data row for the current group
    if (first === 'DATA' && fields.length >= 2) {
      if (currentGroup && groups[currentGroup] && groups[currentGroup].headings.length > 0) {
        groups[currentGroup].rows.push(fields.slice(1));
      }
      continue;
    }

    // Fallback: v3-style line where the group name is the first field.
    // Either a heading row (group name + field names) or a data row (group name + values).
    if (/^[A-Z][A-Z0-9_]{1,}$/.test(first)) {
      if (!groups[first]) {
        const rest = fields.slice(1).map(f => f.toUpperCase());
        const valid = rest.filter(f => /^[A-Z][A-Z0-9_]{1,}$/.test(f));
        if (rest.length > 0 && valid.length >= Math.ceil(rest.length / 2)) {
          groups[first] = { headings: rest, rows: [] };
          currentGroup = first;
        }
      } else if (groups[first].headings.length > 0) {
        groups[first].rows.push(fields.slice(1));
      }
    }
  }

  return groups;
}

// Build a case-insensitive lookup for a row object so we can try multiple
// field-name aliases without worrying about case.
function rowToObj(group: { headings: string[] }, row: string[]) {
  const obj: Record<string, string> = {};
  group.headings.forEach((h, i) => { obj[h.toUpperCase()] = row[i] != null ? row[i] : ''; });
  return obj;
}

// Read the first non-empty value from a row object by trying several aliases.
function pick(obj: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k.toUpperCase()];
    if (v != null && v.trim() !== '') return v.trim();
  }
  return '';
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

    // Resolve the target job. Explicit job_id wins; otherwise match by
    // job_reference / job name against the AGS PROJ group (trying many aliases).
    let job: any = null;
    if (jobId) {
      try { job = await base44.asServiceRole.entities.Job.get(jobId); } catch (e) { job = null; }
    }
    if (!job && groups.PROJ && groups.PROJ.rows.length) {
      const proj = rowToObj(groups.PROJ, groups.PROJ.rows[0]);
      const projId = pick(proj, 'PROJ_ID', 'PROJ_REF', 'PROJ_CODE', 'PROJECT_ID', 'PROJECT_NO', 'PROJECT_CODE', 'PROJ_NAME', 'PROJECT_NAME', 'PROJ_TITLE', 'PROJ_DESC');
      const projName = pick(proj, 'PROJ_NAME', 'PROJECT_NAME', 'PROJ_TITLE', 'PROJ_DESC', 'PROJ_LOC', 'PROJ_CL_REF', 'PROJ_CLIENT_REF');
      if (projId || projName) {
        const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
        const candidates = [projId, projName].filter(Boolean).map(s => s.toLowerCase());
        for (const cand of candidates) {
          job = jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === cand)
            || jobs.find((j: any) => j.name && j.name.toLowerCase() === cand)
            || jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase().includes(cand))
            || jobs.find((j: any) => j.name && j.name.toLowerCase().includes(cand))
            || jobs.find((j: any) => cand.includes(j.job_reference?.toLowerCase() || '___'))
            || jobs.find((j: any) => cand.includes(j.name?.toLowerCase() || '___'));
          if (job) break;
        }
      }
    }
    if (!job) {
      return Response.json({
        error: 'Could not match an existing job. Select the job manually, or make sure the job reference matches the AGS PROJ_ID / PROJ_NAME.'
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
    const counts = { locations: 0, strata: 0, samples: 0, spt: 0, installations: 0 };

    // Build a lookup of LOCA_ID → final depth / groundwater so we can enrich
    // strata/sample/SPT logs with the borehole reference even when the child
    // rows only carry a location reference under a different column name.
    const locaRefs: Record<string, string> = {};
    if (groups.LOCA) {
      for (const row of groups.LOCA.rows) {
        const r = rowToObj(groups.LOCA, row);
        const id = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID');
        if (id) locaRefs[id.toLowerCase()] = id;
      }
    }
    const resolveLocaRef = (r: Record<string, string>) => {
      const id = pick(r, 'LOCA_ID', 'LOCA_REF', 'SAMP_LOCA_ID', 'GEOL_LOCA_ID', 'SPT_LOCA_ID', 'LOCA_REF_LOCA', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'LOC_ID');
      if (id) return id;
      return '';
    };

    // LOCA — borehole locations → one summary log per hole
    if (groups.LOCA && groups.LOCA.rows.length) {
      for (const row of groups.LOCA.rows) {
        const r = rowToObj(groups.LOCA, row);
        const locaId = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID');
        if (!locaId) continue;
        const locaType = pick(r, 'LOCA_TYPE', 'LOCA_LETT', 'LOCA_TYPE_LOCA', 'TYPE');
        const locaDate = pick(r, 'LOCA_STAR', 'LOCA_ENDD', 'LOCA_START', 'LOCA_DATE', 'LOCA_END', 'STAR', 'ENDD');
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: locaDate || today,
          log_type: 'borehole_progress',
          borehole_ref: locaId,
          depth_to: num(pick(r, 'LOCA_FDEP', 'LOCA_GL', 'LOCA_FDEPTH', 'LOCA_DEPTH', 'LOCA_DEPTH_TO', 'LOCA_FINAL_DEPTH', 'LOCA_TD', 'FDEPTH')) || null,
          groundwater_strike_depth: num(pick(r, 'LOCA_GND', 'LOCA_GW_DEPTH', 'LOCA_GWL', 'LOCA_WATER', 'GND', 'GW_DEPTH')) || null,
          description: `Imported from KeyLogBook AGS — borehole ${locaId} (${locaType || 'borehole'}).`,
          source: 'ags_import',
          completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved',
          chargeable: false,
        });
        counts.locations++;
      }
    }

    // GEOL — strata / geology descriptions (also try CHIS for chiselling)
    const geolGroups = [
      { g: groups.GEOL, countKey: 'strata' as const },
      { g: groups.CHIS, countKey: 'strata' as const },
    ];
    for (const { g } of geolGroups) {
      if (g && g.rows.length) {
        for (const row of g.rows) {
          const r = rowToObj(g, row);
          const desc = pick(r, 'GEOL_DESC', 'GEOL_LEGEND', 'GEOL_GEN', 'GEOL_DESC_GEOL', 'GEOL_TERM', 'GEOL_GEOL', 'CHIS_DESC', 'CHIS_LEGEND', 'DESC', 'DESCRIPTION', 'LEGEND', 'STRATA_DESC');
          if (!desc) continue;
          logs.push({
            job_id: job.id,
            staff_id: staffId,
            date: today,
            log_type: 'borehole_progress',
            borehole_ref: resolveLocaRef(r),
            depth_from: num(pick(r, 'GEOL_TOP', 'CHIS_TOP', 'TOP', 'GEOL_TOP_GEOL', 'DEPTH_FROM', 'DEPTH_TOP')) || null,
            depth_to: num(pick(r, 'GEOL_BASE', 'GEOL_BOT', 'CHIS_BASE', 'CHIS_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'DEPTH_BASE', 'GEOL_BASE_GEOL')) || null,
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
    }

    // SAMP — samples
    if (groups.SAMP && groups.SAMP.rows.length) {
      for (const row of groups.SAMP.rows) {
        const r = rowToObj(groups.SAMP, row);
        const sampId = pick(r, 'SAMP_ID', 'SAMP_REF', 'SAMP_NO', 'SAMP_NO_SAMP', 'SAMPLE_ID', 'SAMPLE_REF', 'SAMP_SAMP', 'ID');
        const sampType = pick(r, 'SAMP_TYPE', 'SAMP_TYPE_SAMP', 'SAMPLE_TYPE', 'TYPE');
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: today,
          log_type: 'sample_collection',
          borehole_ref: resolveLocaRef(r),
          sample_id: sampId,
          depth_from: num(pick(r, 'SAMP_TOP', 'SAMP_DEP', 'SAMP_TOP_SAMP', 'SAMP_DEPTH', 'SAMP_DEP_SAMP', 'TOP', 'DEPTH', 'DEPTH_FROM')) || null,
          sample_type: mapSampleType(sampType),
          description: `Imported from KeyLogBook AGS — sample ${sampId} (${sampType}).`,
          source: 'ags_import',
          completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved',
          chargeable: false,
        });
        counts.samples++;
      }
    }

    // SPT — standard penetration tests (also try DENS for density/penetration)
    const sptGroups = [groups.SPT, groups.DENS];
    for (const g of sptGroups) {
      if (g && g.rows.length) {
        for (const row of g.rows) {
          const r = rowToObj(g, row);
          const blows = [
            pick(r, 'SPT_BL1', 'SPT_BL1_RES', 'SPT_BLOW1', 'SPT_BLOWS_1', 'BL1', 'BLOW1'),
            pick(r, 'SPT_BL2', 'SPT_BL2_RES', 'SPT_BLOW2', 'SPT_BLOWS_2', 'BL2', 'BLOW2'),
            pick(r, 'SPT_BL3', 'SPT_BL3_RES', 'SPT_BLOW3', 'SPT_BLOWS_3', 'BL3', 'BLOW3'),
            pick(r, 'SPT_BL4', 'SPT_BL4_RES', 'SPT_BLOW4', 'SPT_BLOWS_4', 'BL4', 'BLOW4'),
          ].map(b => num(b)).filter((b): b is number => b != null);
          const nval = num(pick(r, 'SPT_NVAL', 'SPT_N', 'SPT_N_VALUE', 'NVAL', 'N_VALUE', 'DENS_NVAL', 'SPT_NVAL_SPT'))
            || (blows.length >= 3 ? blows[1] + blows[2] : (blows.length === 2 ? blows[0] + blows[1] : (blows.length === 1 ? blows[0] : null)));
          logs.push({
            job_id: job.id,
            staff_id: staffId,
            date: today,
            log_type: 'borehole_progress',
            borehole_ref: resolveLocaRef(r),
            depth_from: num(pick(r, 'SPT_TOP', 'SPT_TOP_SPT', 'DENS_TOP', 'SPT_DEPTH', 'TOP', 'DEPTH_FROM')) || null,
            depth_to: num(pick(r, 'SPT_BASE', 'SPT_BOT', 'SPT_BASE_SPT', 'DENS_BASE', 'DENS_BOT', 'BASE', 'BOT', 'DEPTH_TO')) || null,
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
    }

    // TREM — installation / tremie pipe records (standpipe installations, etc.)
    if (groups.TREM && groups.TREM.rows.length) {
      for (const row of groups.TREM.rows) {
        const r = rowToObj(groups.TREM, row);
        const tremId = pick(r, 'TREM_ID', 'TREM_REF', 'TREM_NO', 'PIPE_ID', 'INSTALL_ID');
        const tremType = pick(r, 'TREM_TYPE', 'TREM_TYPE_TREM', 'TYPE');
        const tremMat = pick(r, 'TREM_MAT', 'TREM_MATERIAL', 'MATERIAL');
        const tremDiam = pick(r, 'TREM_DIAM', 'TREM_DIA', 'DIAM', 'DIAMETER');
        const tremDesc = pick(r, 'TREM_DESC', 'TREM_REM', 'TREM_LEGEND', 'DESC', 'DESCRIPTION', 'REMARK', 'TREM_NOTE');
        // Compose a readable description from the available fields
        const parts = [tremType, tremMat, tremDiam ? `${tremDiam}mm` : ''].filter(Boolean);
        const summary = parts.length > 0 ? parts.join(' · ') : 'Installation pipe';
        const detail = tremDesc ? `${summary} — ${tremDesc}` : summary;
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: today,
          log_type: 'installation',
          borehole_ref: resolveLocaRef(r),
          standpipe_ref: tremId || null,
          depth_from: num(pick(r, 'TREM_TOP', 'TREM_TOP_TREM', 'TOP', 'DEPTH_FROM')) || null,
          depth_to: num(pick(r, 'TREM_BASE', 'TREM_BOT', 'TREM_BASE_TREM', 'BASE', 'BOT', 'DEPTH_TO')) || null,
          description: `Imported from KeyLogBook AGS — installation pipe${tremId ? ` ${tremId}` : ''}: ${detail}.`,
          source: 'ags_import',
          completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved',
          chargeable: false,
        });
        counts.installations++;
      }
    }

    if (logs.length === 0) {
      // Include the group names we actually found, so the admin can see why
      // nothing matched (e.g. KeyLogBook used non-standard group names).
      const found = Object.keys(groups).sort().join(', ');
      return Response.json({
        error: `No LOCA, GEOL, SAMP, SPT or TREM records were found in this AGS file. Groups found: ${found || '(none)'}.`
      }, { status: 422 });
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