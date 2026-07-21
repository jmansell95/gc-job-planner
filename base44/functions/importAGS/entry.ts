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
  const groups: Record<string, { headings: string[]; rows: string[][] }> = {};

  let currentGroup: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = splitLine(line, delimiter);
    const first = (fields[0] || '').toUpperCase();

    if (first === 'GROUP' && fields.length >= 2) {
      currentGroup = (fields[1] || '').toUpperCase();
      if (currentGroup && !groups[currentGroup]) {
        groups[currentGroup] = { headings: [], rows: [] };
      }
      continue;
    }

    if (first === 'HEADING' && fields.length >= 2) {
      if (currentGroup && groups[currentGroup]) {
        groups[currentGroup].headings = fields.slice(1).map(f => f.toUpperCase());
      }
      continue;
    }

    if (['UNIT', 'TYPE', 'FILE', 'REMARK', 'COMMENT', 'ABBR', 'DICT', 'TRAN'].includes(first)) continue;

    if (first === 'DATA' && fields.length >= 2) {
      if (currentGroup && groups[currentGroup] && groups[currentGroup].headings.length > 0) {
        groups[currentGroup].rows.push(fields.slice(1));
      }
      continue;
    }

    // Fallback: v3-style line where the group name is the first field.
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

// Fuzzy pick: try any field whose name contains one of the keywords
// (case-insensitive), skipping ID/ref/desc/name/legend/type fields.
// This catches KeyLogBook variants like GEOL_TOP_GEOL that exact aliases miss.
function fuzzyPick(obj: Record<string, string>, ...keywords: string[]): string {
  const upperKeywords = keywords.map(k => k.toUpperCase());
  const skip = ['ID', 'REF', 'DESC', 'NAME', 'TYPE', 'LEGEND'];
  for (const key of Object.keys(obj)) {
    if (skip.some(s => key.includes(s))) continue;
    for (const kw of upperKeywords) {
      if (key.includes(kw) && obj[key] && obj[key].trim() !== '') return obj[key].trim();
    }
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
    // job_reference / job name against the AGS PROJ group.
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

    // Overwrite mode: delete existing AGS-imported logs for this job before re-importing.
    // This keeps borehole data fresh on each upload — no duplicates, always latest data.
    let deletedCount = 0;
    try {
      const existing = await base44.asServiceRole.entities.InvestigationLog.filter({
        job_id: job.id,
        source: 'ags_import',
      });
      deletedCount = existing.length;
      if (deletedCount > 0) {
        await base44.asServiceRole.entities.InvestigationLog.deleteMany({
          job_id: job.id,
          source: 'ags_import',
        });
      }
    } catch (e) { /* continue with insert */ }

    const today = new Date().toISOString().slice(0, 10);
    const logs: any[] = [];
    const counts = { locations: 0, strata: 0, core: 0, samples: 0, spt: 0, installations: 0, waterReadings: 0 };

    // Build a lookup of LOCA_ID → ref so we can enrich child rows.
    const locaRefs: Record<string, string> = {};
    if (groups.LOCA) {
      for (const row of groups.LOCA.rows) {
        const r = rowToObj(groups.LOCA, row);
        const id = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID');
        if (id) locaRefs[id.toLowerCase()] = id;
      }
    }

    // Track the last seen borehole ref as a fallback for child rows that
    // don't carry an explicit LOCA_ID (some KeyLogBook exports rely on
    // row ordering within the group to imply the borehole).
    let lastLocaRef = '';
    const resolveLocaRef = (r: Record<string, string>) => {
      const id = pick(r, 'LOCA_ID', 'LOCA_REF', 'SAMP_LOCA_ID', 'GEOL_LOCA_ID', 'SPT_LOCA_ID', 'CORE_LOCA_ID', 'TREM_LOCA_ID', 'WSTG_LOCA_ID', 'LOCA_REF_LOCA', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'LOC_ID');
      if (id) { lastLocaRef = id; return id; }
      return lastLocaRef || '';
    };

    // LOCA — borehole locations → one summary log per hole
    if (groups.LOCA && groups.LOCA.rows.length) {
      for (const row of groups.LOCA.rows) {
        const r = rowToObj(groups.LOCA, row);
        const locaId = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID');
        if (!locaId) continue;
        lastLocaRef = locaId;
        const locaType = pick(r, 'LOCA_TYPE', 'LOCA_LETT', 'LOCA_TYPE_LOCA', 'TYPE');
        const locaDate = pick(r, 'LOCA_STAR', 'LOCA_ENDD', 'LOCA_START', 'LOCA_DATE', 'LOCA_END', 'STAR', 'ENDD');
        const locaElev = num(pick(r, 'LOCA_GL', 'LOCA_ELEV', 'LOCA_LEVEL', 'LOCA_DATUM', 'GL', 'ELEV'));
        const locaX = pick(r, 'LOCA_NATE', 'LOCA_X', 'LOCA_EAST', 'NATE', 'EASTING', 'EAST');
        const locaY = pick(r, 'LOCA_NATN', 'LOCA_Y', 'LOCA_NORTH', 'NATN', 'NORTHING', 'NORTH');
        const descParts = [
          `borehole ${locaId} (${locaType || 'borehole'})`,
          locaElev != null ? `, ground level ${locaElev}m` : '',
          locaX && locaY ? `, coordinates ${locaX}, ${locaY}` : '',
        ];
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: locaDate || today,
          log_type: 'borehole_progress',
          borehole_ref: locaId,
          depth_to: num(pick(r, 'LOCA_FDEP', 'LOCA_GL', 'LOCA_FDEPTH', 'LOCA_DEPTH', 'LOCA_DEPTH_TO', 'LOCA_FINAL_DEPTH', 'LOCA_TD', 'FDEPTH')) || null,
          groundwater_strike_depth: num(pick(r, 'LOCA_GND', 'LOCA_GW_DEPTH', 'LOCA_GWL', 'LOCA_WATER', 'GND', 'GW_DEPTH')) || null,
          description: `Imported from KeyLogBook AGS — ${descParts.join('')}.`,
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
    // KeyLogBook sometimes puts core run data (with RQD/recovery) in the GEOL group.
    // Detect this and treat those rows as core runs, not strata.
    const geolGroups = [groups.GEOL, groups.CHIS];
    for (const g of geolGroups) {
      if (g && g.rows.length) {
        const hasCoreFields = g.headings.some(h =>
          h.includes('RQD') || h.includes('ROCK_QUALITY') ||
          h.includes('REC') || h.includes('RECOVERY') || h.includes('PER_REC')
        );
        for (const row of g.rows) {
          const r = rowToObj(g, row);
          const desc = pick(r, 'GEOL_DESC', 'GEOL_LEGEND', 'GEOL_GEN', 'GEOL_DESC_GEOL', 'GEOL_TERM', 'GEOL_GEOL', 'CHIS_DESC', 'CHIS_LEGEND', 'DESC', 'DESCRIPTION', 'LEGEND', 'STRATA_DESC');
          if (!desc) continue;
          const ref = resolveLocaRef(r);
          const dFrom = num(pick(r, 'GEOL_TOP', 'CHIS_TOP', 'TOP', 'GEOL_TOP_GEOL', 'DEPTH_FROM', 'DEPTH_TOP', 'LOCA_TOP', 'TOP_DEPTH', 'GEOL_TOP_FROM'))
            || num(fuzzyPick(r, 'TOP'));
          const dTo = num(pick(r, 'GEOL_BASE', 'GEOL_BOT', 'CHIS_BASE', 'CHIS_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'DEPTH_BASE', 'GEOL_BASE_GEOL', 'LOCA_BOT', 'BOT_DEPTH', 'GEOL_BASE_TO'))
            || num(fuzzyPick(r, 'BASE', 'BOT'));

          if (hasCoreFields) {
            // Treat as core run — KeyLogBook put coring data in the GEOL group
            const rqd = num(pick(r, 'GEOL_RQD', 'RQD', 'CORE_RQD', 'GEOL_ROCK_QUALITY', 'GEOL_RQD_GEOL'))
              || num(fuzzyPick(r, 'RQD'));
            const recovery = num(pick(r, 'GEOL_REC', 'GEOL_RECOVERY', 'GEOL_PER_REC', 'CORE_REC', 'REC', 'RECOVERY', 'GEOL_REC_GEOL', 'GEOL_RECOVERY_GEOL'))
              || num(fuzzyPick(r, 'REC', 'RECOVERY'));
            const runNo = pick(r, 'GEOL_RUN', 'GEOL_RUN_NO', 'CORE_RUN', 'RUN_NO', 'RUN');
            const boxNo = pick(r, 'GEOL_BOX', 'GEOL_BOX_NO', 'CORE_BOX', 'BOX_NO', 'BOX');
            logs.push({
              job_id: job.id,
              staff_id: staffId,
              date: today,
              log_type: 'core_inspection',
              borehole_ref: ref,
              core_run_number: runNo || null,
              core_box_number: boxNo || null,
              depth_from: dFrom || null,
              depth_to: dTo || null,
              coring_rqd: rqd,
              coring_recovery: recovery,
              strata_description_detail: desc,
              description: `Imported from KeyLogBook AGS — core run${runNo ? ` ${runNo}` : ''}${rqd != null ? ` (RQD ${rqd}%)` : ''}${recovery != null ? ` (recovery ${recovery}%)` : ''}.`,
              source: 'ags_import',
              completed_by_type: 'internal_staff',
              completed_by_name: 'AGS Import (KeyLogBook)',
              manager_review_status: 'approved',
              chargeable: false,
            });
            counts.core++;
          } else {
            // Treat as strata
            logs.push({
              job_id: job.id,
              staff_id: staffId,
              date: today,
              log_type: 'borehole_progress',
              borehole_ref: ref,
              depth_from: dFrom || null,
              depth_to: dTo || null,
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
    }

    // CORE — rotary core runs (RQD, recovery, box numbers)
    if (groups.CORE && groups.CORE.rows.length) {
      for (const row of groups.CORE.rows) {
        const r = rowToObj(groups.CORE, row);
        const coreId = pick(r, 'CORE_ID', 'CORE_REF', 'CORE_NO');
        const runNo = pick(r, 'CORE_RUN', 'CORE_RUN_NO', 'CORE_RUN_NO_CORE', 'RUN_NO', 'RUN');
        const boxNo = pick(r, 'CORE_BOX', 'CORE_BOX_NO', 'CORE_BOX_NO_CORE', 'CORE_BOXES', 'BOX_NO', 'BOX');
        const rqd = num(pick(r, 'CORE_RQD', 'CORE_RQD_CORE', 'RQD', 'CORE_ROCK_QUALITY'));
        const recovery = num(pick(r, 'CORE_REC', 'CORE_RECOVERY', 'CORE_REC_CORE', 'CORE_PER_REC', 'CORE_RECOVERY_PCT', 'CORE_REC_PCT', 'REC', 'RECOVERY'));
        const coreDesc = pick(r, 'CORE_DESC', 'CORE_DESC_CORE', 'CORE_LEGEND', 'CORE_REM', 'CORE_REM_CORE', 'CORE_NOTE', 'CORE_NOTES');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'CORE_TOP', 'CORE_TOP_CORE', 'CORE_FROM', 'CORE_DEPTH_FROM', 'CORE_TOP_DEPTH'))
          || num(fuzzyPick(r, 'TOP'));
        const dTo = num(pick(r, 'CORE_BASE', 'CORE_BOT', 'CORE_BOTTOM', 'CORE_BASE_CORE', 'CORE_TO', 'CORE_DEPTH_TO', 'CORE_BOT_DEPTH'))
          || num(fuzzyPick(r, 'BASE', 'BOT'));
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: today,
          log_type: 'core_inspection',
          borehole_ref: ref,
          core_run_number: runNo || coreId || null,
          core_box_number: boxNo || null,
          depth_from: dFrom || null,
          depth_to: dTo || null,
          coring_rqd: rqd,
          coring_recovery: recovery,
          strata_description_detail: coreDesc || null,
          description: `Imported from KeyLogBook AGS — core run${runNo || coreId ? ` ${runNo || coreId}` : ''}${rqd != null ? ` (RQD ${rqd}%)` : ''}${recovery != null ? ` (recovery ${recovery}%)` : ''}.${coreDesc ? ' ' + coreDesc : ''}`,
          source: 'ags_import',
          completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved',
          chargeable: false,
        });
        counts.core++;
      }
    }

    // SAMP — samples
    if (groups.SAMP && groups.SAMP.rows.length) {
      for (const row of groups.SAMP.rows) {
        const r = rowToObj(groups.SAMP, row);
        const sampId = pick(r, 'SAMP_ID', 'SAMP_REF', 'SAMP_NO', 'SAMP_NO_SAMP', 'SAMPLE_ID', 'SAMPLE_REF', 'SAMP_SAMP', 'ID');
        const sampType = pick(r, 'SAMP_TYPE', 'SAMP_TYPE_SAMP', 'SAMPLE_TYPE', 'TYPE');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'SAMP_TOP', 'SAMP_DEP', 'SAMP_TOP_SAMP', 'SAMP_DEPTH', 'SAMP_DEP_SAMP', 'TOP', 'DEPTH', 'DEPTH_FROM', 'SAMP_TOP_DEPTH'))
          || num(fuzzyPick(r, 'TOP', 'DEP'));
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: today,
          log_type: 'sample_collection',
          borehole_ref: ref,
          sample_id: sampId,
          depth_from: dFrom || null,
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
          const ref = resolveLocaRef(r);
          const dFrom = num(pick(r, 'SPT_TOP', 'SPT_TOP_SPT', 'DENS_TOP', 'SPT_DEPTH', 'TOP', 'DEPTH_FROM', 'SPT_TOP_DEPTH'))
            || num(fuzzyPick(r, 'TOP', 'DEP'));
          const dTo = num(pick(r, 'SPT_BASE', 'SPT_BOT', 'SPT_BASE_SPT', 'DENS_BASE', 'DENS_BOT', 'BASE', 'BOT', 'DEPTH_TO'))
            || num(fuzzyPick(r, 'BASE', 'BOT'));
          logs.push({
            job_id: job.id,
            staff_id: staffId,
            date: today,
            log_type: 'borehole_progress',
            borehole_ref: ref,
            depth_from: dFrom || null,
            depth_to: dTo || null,
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

    // TREM — installation / tremie pipe records
    if (groups.TREM && groups.TREM.rows.length) {
      for (const row of groups.TREM.rows) {
        const r = rowToObj(groups.TREM, row);
        const tremId = pick(r, 'TREM_ID', 'TREM_REF', 'TREM_NO', 'PIPE_ID', 'INSTALL_ID');
        const tremType = pick(r, 'TREM_TYPE', 'TREM_TYPE_TREM', 'TYPE');
        const tremMat = pick(r, 'TREM_MAT', 'TREM_MATERIAL', 'MATERIAL');
        const tremDiam = pick(r, 'TREM_DIAM', 'TREM_DIA', 'DIAM', 'DIAMETER');
        const tremDesc = pick(r, 'TREM_DESC', 'TREM_REM', 'TREM_LEGEND', 'DESC', 'DESCRIPTION', 'REMARK', 'TREM_NOTE');
        const ref = resolveLocaRef(r);
        const parts = [tremType, tremMat, tremDiam ? `${tremDiam}mm` : ''].filter(Boolean);
        const summary = parts.length > 0 ? parts.join(' · ') : 'Installation pipe';
        const detail = tremDesc ? `${summary} — ${tremDesc}` : summary;
        logs.push({
          job_id: job.id,
          staff_id: staffId,
          date: today,
          log_type: 'installation',
          borehole_ref: ref,
          standpipe_ref: tremId || null,
          depth_from: num(pick(r, 'TREM_TOP', 'TREM_TOP_TREM', 'TOP', 'DEPTH_FROM', 'TREM_TOP_DEPTH')) || null,
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

    // WSTG — water standpipe installations + groundwater monitoring readings
    if (groups.WSTG && groups.WSTG.rows.length) {
      for (const row of groups.WSTG.rows) {
        const r = rowToObj(groups.WSTG, row);
        const wstgId = pick(r, 'WSTG_ID', 'WSTG_REF', 'WSTG_NO', 'PIPE_ID', 'STANDPIPE_ID');
        const wstgType = pick(r, 'WSTG_TYPE', 'WSTG_TYPE_WSTG', 'TYPE');
        const wstgMat = pick(r, 'WSTG_MAT', 'WSTG_MATERIAL', 'MATERIAL');
        const wstgDiam = pick(r, 'WSTG_DIA', 'WSTG_DIAM', 'DIAM', 'DIAMETER');
        const wstgDesc = pick(r, 'WSTG_DESC', 'WSTG_REM', 'WSTG_LEGEND', 'DESC', 'DESCRIPTION', 'REMARK', 'WSTG_NOTE');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'WSTG_TOP', 'WSTG_TOP_WSTG', 'TOP', 'DEPTH_FROM', 'WSTG_TOP_DEPTH')) || null;
        const dTo = num(pick(r, 'WSTG_BASE', 'WSTG_BOT', 'WSTG_BASE_WSTG', 'BASE', 'BOT', 'DEPTH_TO')) || null;
        const waterLevel = num(pick(r, 'WSTG_DP', 'WSTG_READ', 'WSTG_DEPTH', 'WSTG_LEVEL', 'WSTG_WLEVEL', 'WATER_DEPTH', 'WSTG_DP_WSTG', 'DP', 'READ'));
        const readDate = pick(r, 'WSTG_DATE', 'WSTG_READ_DATE', 'DATE', 'READ_DATE', 'WSTG_DP_DATE');

        // Installation record (if it has type/material/depth)
        if (wstgType || wstgMat || wstgDiam || dFrom != null || dTo != null) {
          const parts = [wstgType, wstgMat, wstgDiam ? `${wstgDiam}mm` : ''].filter(Boolean);
          const summary = parts.length > 0 ? parts.join(' · ') : 'Standpipe installation';
          const detail = wstgDesc ? `${summary} — ${wstgDesc}` : summary;
          logs.push({
            job_id: job.id,
            staff_id: staffId,
            date: today,
            log_type: 'installation',
            borehole_ref: ref,
            standpipe_ref: wstgId || null,
            depth_from: dFrom,
            depth_to: dTo,
            description: `Imported from KeyLogBook AGS — standpipe${wstgId ? ` ${wstgId}` : ''}: ${detail}.`,
            source: 'ags_import',
            completed_by_type: 'internal_staff',
            completed_by_name: 'AGS Import (KeyLogBook)',
            manager_review_status: 'approved',
            chargeable: false,
          });
          counts.installations++;
        }

        // Water level reading record (if it has a dip/reading)
        if (waterLevel != null) {
          logs.push({
            job_id: job.id,
            staff_id: staffId,
            date: readDate || today,
            log_type: 'standpipe_reading',
            borehole_ref: ref,
            standpipe_ref: wstgId || null,
            standpipe_reading_m: waterLevel,
            description: `Imported from KeyLogBook AGS — groundwater monitoring reading: ${waterLevel}mBGL${wstgId ? ` on standpipe ${wstgId}` : ''}.`,
            source: 'ags_import',
            completed_by_type: 'internal_staff',
            completed_by_name: 'AGS Import (KeyLogBook)',
            manager_review_status: 'approved',
            chargeable: false,
          });
          counts.waterReadings++;
        }
      }
    }

    if (logs.length === 0) {
      const found = Object.keys(groups).sort().join(', ');
      return Response.json({
        error: `No LOCA, GEOL, CORE, SAMP, SPT, TREM or WSTG records were found in this AGS file. Groups found: ${found || '(none)'}.`
      }, { status: 422 });
    }

    // Bulk insert (cap at 500 per call per platform limit)
    let inserted = 0;
    for (let i = 0; i < logs.length; i += 500) {
      const batch = logs.slice(i, i + 500);
      await base44.asServiceRole.entities.InvestigationLog.bulkCreate(batch);
      inserted += batch.length;
    }

    // Debug: include found groups + headings so future uploads can be diagnosed
    const groupDebug: Record<string, string[]> = {};
    for (const [name, g] of Object.entries(groups)) {
      if (g.headings && g.headings.length > 0) groupDebug[name] = g.headings;
    }

    return Response.json({
      status: 'success',
      job_id: job.id,
      job_name: job.name,
      job_reference: job.job_reference,
      deleted: deletedCount,
      inserted,
      counts,
      groups: groupDebug,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});