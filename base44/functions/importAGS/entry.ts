import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ============================================================
// AGS v3/v4 parser with suffix-based field matching
// ============================================================
// AGS field names follow the convention {GROUP}_{FIELD}, e.g.
// GEOL_TOP, LOCA_ID, SPT_NVAL. KeyLogBook sometimes doubles the
// group suffix (GEOL_TOP_GEOL). We normalize every heading by
// stripping the group prefix/suffix so matching is robust against
// any variant — GEOL_TOP, GEOL_TOP_GEOL, and TOP all map to "TOP".

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

function detectDelimiter(lines: string[]): string {
  const samples = lines.filter(l => l.trim()).slice(0, 30);
  const counts: Record<string, number> = { '\t': 0, ',': 0, ';': 0, '|': 0 };
  for (const l of samples) {
    if (l.includes('\t')) counts['\t']++;
    if (l.includes(',')) counts[',']++;
    if (l.includes(';')) counts[';']++;
    if (l.includes('|')) counts['|']++;
  }
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';'] && counts['\t'] >= counts['|']) return '\t';
  if (counts[','] >= counts[';'] && counts[','] >= counts['|']) return ',';
  if (counts[';'] >= counts['|']) return ';';
  return '|';
}

interface GroupData { name: string; headings: string[]; rows: string[][]; }

function parseAGS(text: string): Record<string, GroupData> {
  const lines = text.split(/\r?\n/);
  const delimiter = detectDelimiter(lines);
  const groups: Record<string, GroupData> = {};
  let currentGroup: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = splitLine(line, delimiter);
    const first = (fields[0] || '').toUpperCase().replace(/"/g, '');

    // v4 keyword-based format
    if (first === 'GROUP' && fields.length >= 2) {
      currentGroup = (fields[1] || '').toUpperCase().replace(/"/g, '');
      if (currentGroup && !groups[currentGroup]) {
        groups[currentGroup] = { name: currentGroup, headings: [], rows: [] };
      }
      continue;
    }
    if (first === 'HEADING' && fields.length >= 2) {
      if (currentGroup && groups[currentGroup]) {
        groups[currentGroup].headings = fields.slice(1).map(f => f.toUpperCase().replace(/"/g, ''));
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

    // v3-style: group name is the first field on every line
    if (/^[A-Z][A-Z0-9_]*$/.test(first) && first.length >= 2) {
      if (!groups[first]) {
        // First occurrence — treat as heading row
        const rest = fields.slice(1).map(f => f.toUpperCase().replace(/"/g, ''));
        const valid = rest.filter(f => /^[A-Z][A-Z0-9_]*$/.test(f) && f.length >= 2);
        if (rest.length > 0 && valid.length >= Math.ceil(rest.length / 2)) {
          groups[first] = { name: first, headings: rest, rows: [] };
          currentGroup = first;
        }
      } else if (groups[first].headings.length > 0) {
        groups[first].rows.push(fields.slice(1));
      }
    }
  }
  return groups;
}

// Strip the group prefix (and any doubled suffix) from a field name.
// GEOL_TOP → TOP, GEOL_TOP_GEOL → TOP, LOCA_ID → ID, LOCA_LOCA_ID → ID
function normalizeKey(fieldName: string, groupName: string): string {
  let result = fieldName.toUpperCase();
  const g = groupName.toUpperCase();
  let changed = true;
  while (changed) {
    changed = false;
    if (result.startsWith(g + '_')) { result = result.slice(g.length + 1); changed = true; }
    if (result.endsWith('_' + g)) { result = result.slice(0, result.length - g.length - 1); changed = true; }
  }
  return result;
}

// Build a row lookup keyed by both the full heading name and its normalized suffix.
function buildRow(group: GroupData, row: string[]): Record<string, string> {
  const lookup: Record<string, string> = {};
  group.headings.forEach((h, i) => {
    const val = row[i] != null ? row[i].trim() : '';
    const full = h.toUpperCase();
    const suffix = normalizeKey(h, group.name);
    if (!(full in lookup)) lookup[full] = val;
    if (!(suffix in lookup)) lookup[suffix] = val;
  });
  return lookup;
}

// Match a value by trying each target key against both the full-name and
// normalized-suffix maps. Targets should be suffixes (e.g. "ID", "TOP", "DESC").
function pick(row: Record<string, string>, ...targets: string[]): string {
  for (const t of targets) {
    const tu = t.toUpperCase();
    const v = row[tu];
    if (v != null && v !== '') return v;
  }
  // Fallback: any key that ends with one of the targets
  for (const key of Object.keys(row)) {
    for (const t of targets) {
      const tu = t.toUpperCase();
      if (key === tu || key.endsWith('_' + tu)) {
        if (row[key] != null && row[key] !== '') return row[key];
      }
    }
  }
  return '';
}

function num(v: string | undefined | null): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

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

    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return Response.json({ error: 'Could not download AGS file' }, { status: 422 });
    const text = await fileRes.text();
    const groups = parseAGS(text);

    // Resolve the target job
    let job: any = null;
    if (jobId) {
      try { job = await base44.asServiceRole.entities.Job.get(jobId); } catch (e) { job = null; }
    }
    if (!job && groups.PROJ && groups.PROJ.rows.length) {
      const proj = buildRow(groups.PROJ, groups.PROJ.rows[0]);
      const projId = pick(proj, 'PROJ_ID', 'PROJ_REF', 'PROJ_CODE', 'PROJECT_ID', 'PROJECT_NO', 'PROJECT_CODE', 'ID', 'REF');
      const projName = pick(proj, 'PROJ_NAME', 'PROJECT_NAME', 'PROJ_TITLE', 'PROJ_DESC', 'NAME', 'TITLE', 'DESC', 'PROJ_LOC', 'PROJ_CL_REF', 'PROJ_CLIENT_REF');
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

    // Resolve staff_id for the imported logs
    let staffId = user.id;
    try {
      const staff = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id });
      if (staff.length) staffId = staff[0].id;
    } catch (e) { /* fall back to user.id */ }

    // Overwrite mode: delete existing AGS-imported logs for this job
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

    let lastLocaRef = '';
    const resolveLocaRef = (r: Record<string, string>) => {
      const id = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'LOC_ID', 'ID', 'REF');
      if (id) { lastLocaRef = id; return id; }
      return lastLocaRef || '';
    };

    // ---- LOCA — borehole locations ----
    if (groups.LOCA && groups.LOCA.rows.length) {
      for (const row of groups.LOCA.rows) {
        const r = buildRow(groups.LOCA, row);
        const locaId = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
        if (!locaId) continue;
        lastLocaRef = locaId;
        const locaType = pick(r, 'LOCA_TYPE', 'LOCA_LETT', 'TYPE', 'LETT');
        const locaDate = pick(r, 'LOCA_STAR', 'LOCA_START', 'STAR', 'LOCA_ENDD', 'LOCA_END', 'ENDD', 'LOCA_DATE', 'DATE');
        const locaElev = num(pick(r, 'LOCA_GL', 'LOCA_ELEV', 'LOCA_LEVEL', 'LOCA_DATUM', 'GL', 'ELEV', 'LEVEL'));
        const locaX = pick(r, 'LOCA_NATE', 'LOCA_X', 'LOCA_EAST', 'NATE', 'EASTING', 'EAST', 'X');
        const locaY = pick(r, 'LOCA_NATN', 'LOCA_Y', 'LOCA_NORTH', 'NATN', 'NORTHING', 'NORTH', 'Y');
        const descParts = [
          `borehole ${locaId} (${locaType || 'borehole'})`,
          locaElev != null ? `, ground level ${locaElev}m` : '',
          locaX && locaY ? `, coordinates ${locaX}, ${locaY}` : '',
        ];
        logs.push({
          job_id: job.id, staff_id: staffId, date: locaDate || today,
          log_type: 'borehole_progress', borehole_ref: locaId,
          depth_to: num(pick(r, 'LOCA_FDEP', 'LOCA_FDEPTH', 'LOCA_DEPTH', 'LOCA_FINAL_DEPTH', 'LOCA_TD', 'FDEP', 'FDEPTH', 'DEPTH', 'TD')) || null,
          groundwater_strike_depth: num(pick(r, 'LOCA_GND', 'LOCA_GW_DEPTH', 'LOCA_GWL', 'LOCA_WATER', 'GND', 'GW_DEPTH', 'GWL', 'WATER')) || null,
          description: `Imported from KeyLogBook AGS — ${descParts.join('')}.`,
          source: 'ags_import', completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved', chargeable: false,
        });
        counts.locations++;
      }
    }

    // ---- GEOL / CHIS — strata or core runs ----
    const geolGroups = [groups.GEOL, groups.CHIS];
    for (const g of geolGroups) {
      if (g && g.rows.length) {
        const hasCoreFields = g.headings.some(h => {
          const n = normalizeKey(h, g.name);
          return n.includes('RQD') || n.includes('REC') || n.includes('RECOVERY') || n.includes('ROCK_QUALITY');
        });
        for (const row of g.rows) {
          const r = buildRow(g, row);
          const desc = pick(r, 'GEOL_DESC', 'GEOL_LEGEND', 'GEOL_GEN', 'GEOL_TERM', 'GEOL_GEOL', 'CHIS_DESC', 'CHIS_LEGEND', 'DESC', 'DESCRIPTION', 'LEGEND', 'GEN', 'TERM', 'GEOL');
          if (!desc) continue;
          const ref = resolveLocaRef(r);
          const dFrom = num(pick(r, 'GEOL_TOP', 'CHIS_TOP', 'TOP', 'DEPTH_FROM', 'DEPTH_TOP', 'TOP_DEPTH', 'FROM'));
          const dTo = num(pick(r, 'GEOL_BASE', 'GEOL_BOT', 'CHIS_BASE', 'CHIS_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'DEPTH_BASE', 'BOT_DEPTH', 'TO'));

          if (hasCoreFields) {
            const rqd = num(pick(r, 'GEOL_RQD', 'RQD', 'CORE_RQD', 'ROCK_QUALITY'));
            const recovery = num(pick(r, 'GEOL_REC', 'GEOL_RECOVERY', 'GEOL_PER_REC', 'CORE_REC', 'REC', 'RECOVERY', 'PER_REC'));
            const runNo = pick(r, 'GEOL_RUN', 'GEOL_RUN_NO', 'CORE_RUN', 'RUN_NO', 'RUN');
            const boxNo = pick(r, 'GEOL_BOX', 'GEOL_BOX_NO', 'CORE_BOX', 'BOX_NO', 'BOX');
            logs.push({
              job_id: job.id, staff_id: staffId, date: today,
              log_type: 'core_inspection', borehole_ref: ref,
              core_run_number: runNo || null, core_box_number: boxNo || null,
              depth_from: dFrom || null, depth_to: dTo || null,
              coring_rqd: rqd, coring_recovery: recovery, strata_description_detail: desc,
              description: `Imported from KeyLogBook AGS — core run${runNo ? ` ${runNo}` : ''}${rqd != null ? ` (RQD ${rqd}%)` : ''}${recovery != null ? ` (recovery ${recovery}%)` : ''}.`,
              source: 'ags_import', completed_by_type: 'internal_staff',
              completed_by_name: 'AGS Import (KeyLogBook)',
              manager_review_status: 'approved', chargeable: false,
            });
            counts.core++;
          } else {
            logs.push({
              job_id: job.id, staff_id: staffId, date: today,
              log_type: 'borehole_progress', borehole_ref: ref,
              depth_from: dFrom || null, depth_to: dTo || null,
              strata_descriptor: mapStrataDescriptor(desc), strata_description_detail: desc,
              description: 'Imported from KeyLogBook AGS — strata.',
              source: 'ags_import', completed_by_type: 'internal_staff',
              completed_by_name: 'AGS Import (KeyLogBook)',
              manager_review_status: 'approved', chargeable: false,
            });
            counts.strata++;
          }
        }
      }
    }

    // ---- CORE — rotary core runs ----
    if (groups.CORE && groups.CORE.rows.length) {
      for (const row of groups.CORE.rows) {
        const r = buildRow(groups.CORE, row);
        const coreId = pick(r, 'CORE_ID', 'CORE_REF', 'CORE_NO', 'ID', 'REF');
        const runNo = pick(r, 'CORE_RUN', 'CORE_RUN_NO', 'RUN_NO', 'RUN');
        const boxNo = pick(r, 'CORE_BOX', 'CORE_BOX_NO', 'CORE_BOXES', 'BOX_NO', 'BOX');
        const rqd = num(pick(r, 'CORE_RQD', 'RQD', 'CORE_ROCK_QUALITY', 'ROCK_QUALITY'));
        const recovery = num(pick(r, 'CORE_REC', 'CORE_RECOVERY', 'CORE_PER_REC', 'CORE_RECOVERY_PCT', 'CORE_REC_PCT', 'REC', 'RECOVERY', 'PER_REC'));
        const coreDesc = pick(r, 'CORE_DESC', 'CORE_LEGEND', 'CORE_REM', 'CORE_NOTE', 'CORE_NOTES', 'DESC', 'LEGEND', 'REM', 'NOTE', 'NOTES');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'CORE_TOP', 'CORE_FROM', 'CORE_DEPTH_FROM', 'CORE_TOP_DEPTH', 'TOP', 'FROM', 'DEPTH_FROM'));
        const dTo = num(pick(r, 'CORE_BASE', 'CORE_BOT', 'CORE_BOTTOM', 'CORE_TO', 'CORE_DEPTH_TO', 'CORE_BOT_DEPTH', 'BASE', 'BOT', 'TO', 'DEPTH_TO'));
        logs.push({
          job_id: job.id, staff_id: staffId, date: today,
          log_type: 'core_inspection', borehole_ref: ref,
          core_run_number: runNo || coreId || null, core_box_number: boxNo || null,
          depth_from: dFrom || null, depth_to: dTo || null,
          coring_rqd: rqd, coring_recovery: recovery, strata_description_detail: coreDesc || null,
          description: `Imported from KeyLogBook AGS — core run${runNo || coreId ? ` ${runNo || coreId}` : ''}${rqd != null ? ` (RQD ${rqd}%)` : ''}${recovery != null ? ` (recovery ${recovery}%)` : ''}.${coreDesc ? ' ' + coreDesc : ''}`,
          source: 'ags_import', completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved', chargeable: false,
        });
        counts.core++;
      }
    }

    // ---- SAMP — samples ----
    if (groups.SAMP && groups.SAMP.rows.length) {
      for (const row of groups.SAMP.rows) {
        const r = buildRow(groups.SAMP, row);
        const sampId = pick(r, 'SAMP_ID', 'SAMP_REF', 'SAMP_NO', 'SAMPLE_ID', 'SAMPLE_REF', 'ID', 'REF');
        const sampType = pick(r, 'SAMP_TYPE', 'SAMPLE_TYPE', 'TYPE');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'SAMP_TOP', 'SAMP_DEP', 'SAMP_DEPTH', 'TOP', 'DEPTH', 'DEPTH_FROM', 'DEP', 'FROM'));
        logs.push({
          job_id: job.id, staff_id: staffId, date: today,
          log_type: 'sample_collection', borehole_ref: ref,
          sample_id: sampId, depth_from: dFrom || null,
          sample_type: mapSampleType(sampType),
          description: `Imported from KeyLogBook AGS — sample ${sampId} (${sampType}).`,
          source: 'ags_import', completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved', chargeable: false,
        });
        counts.samples++;
      }
    }

    // ---- SPT / DENS / ISPT — penetration tests ----
    const sptGroups = [groups.SPT, groups.DENS, groups.ISPT];
    for (const g of sptGroups) {
      if (g && g.rows.length) {
        for (const row of g.rows) {
          const r = buildRow(g, row);
          const blows = [
            pick(r, 'SPT_BL1', 'SPT_BLOW1', 'SPT_BLOWS_1', 'SPT_N1', 'BL1', 'BLOW1', 'BL_1', 'BLOWS_1', 'N1'),
            pick(r, 'SPT_BL2', 'SPT_BLOW2', 'SPT_BLOWS_2', 'SPT_N2', 'BL2', 'BLOW2', 'BL_2', 'BLOWS_2', 'N2'),
            pick(r, 'SPT_BL3', 'SPT_BLOW3', 'SPT_BLOWS_3', 'SPT_N3', 'BL3', 'BLOW3', 'BL_3', 'BLOWS_3', 'N3'),
            pick(r, 'SPT_BL4', 'SPT_BLOW4', 'SPT_BLOWS_4', 'SPT_N4', 'BL4', 'BLOW4', 'BL_4', 'BLOWS_4', 'N4'),
          ].map(b => num(b)).filter((b): b is number => b != null);
          const nval = num(pick(r, 'SPT_NVAL', 'SPT_N', 'SPT_N_VALUE', 'NVAL', 'N_VALUE', 'N'))
            || (blows.length >= 3 ? blows[1] + blows[2] : (blows.length === 2 ? blows[0] + blows[1] : (blows.length === 1 ? blows[0] : null)));
          const ref = resolveLocaRef(r);
          const dFrom = num(pick(r, 'SPT_TOP', 'SPT_DEPTH', 'DENS_TOP', 'TOP', 'DEPTH_FROM', 'DEP', 'FROM'));
          const dTo = num(pick(r, 'SPT_BASE', 'SPT_BOT', 'DENS_BASE', 'DENS_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'TO'));
          logs.push({
            job_id: job.id, staff_id: staffId, date: today,
            log_type: 'borehole_progress', borehole_ref: ref,
            depth_from: dFrom || null, depth_to: dTo || null,
            spt_blows: blows, spt_n_value: nval,
            description: `Imported from KeyLogBook AGS — SPT (N=${nval != null ? nval : 'n/a'}).`,
            source: 'ags_import', completed_by_type: 'internal_staff',
            completed_by_name: 'AGS Import (KeyLogBook)',
            manager_review_status: 'approved', chargeable: false,
          });
          counts.spt++;
        }
      }
    }

    // ---- TREM — installation / tremie pipes ----
    if (groups.TREM && groups.TREM.rows.length) {
      for (const row of groups.TREM.rows) {
        const r = buildRow(groups.TREM, row);
        const tremId = pick(r, 'TREM_ID', 'TREM_REF', 'TREM_NO', 'PIPE_ID', 'INSTALL_ID', 'ID', 'REF');
        const tremType = pick(r, 'TREM_TYPE', 'TYPE');
        const tremMat = pick(r, 'TREM_MAT', 'TREM_MATERIAL', 'MAT', 'MATERIAL');
        const tremDiam = pick(r, 'TREM_DIAM', 'TREM_DIA', 'DIAM', 'DIAMETER', 'DIA');
        const tremDesc = pick(r, 'TREM_DESC', 'TREM_REM', 'TREM_LEGEND', 'TREM_NOTE', 'DESC', 'DESCRIPTION', 'REMARK', 'LEGEND', 'NOTE', 'REM');
        const ref = resolveLocaRef(r);
        const parts = [tremType, tremMat, tremDiam ? `${tremDiam}mm` : ''].filter(Boolean);
        const summary = parts.length > 0 ? parts.join(' · ') : 'Installation pipe';
        const detail = tremDesc ? `${summary} — ${tremDesc}` : summary;
        logs.push({
          job_id: job.id, staff_id: staffId, date: today,
          log_type: 'installation', borehole_ref: ref, standpipe_ref: tremId || null,
          depth_from: num(pick(r, 'TREM_TOP', 'TOP', 'DEPTH_FROM', 'FROM')) || null,
          depth_to: num(pick(r, 'TREM_BASE', 'TREM_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'TO')) || null,
          description: `Imported from KeyLogBook AGS — installation pipe${tremId ? ` ${tremId}` : ''}: ${detail}.`,
          source: 'ags_import', completed_by_type: 'internal_staff',
          completed_by_name: 'AGS Import (KeyLogBook)',
          manager_review_status: 'approved', chargeable: false,
        });
        counts.installations++;
      }
    }

    // ---- WSTG — standpipe installations + groundwater readings ----
    if (groups.WSTG && groups.WSTG.rows.length) {
      for (const row of groups.WSTG.rows) {
        const r = buildRow(groups.WSTG, row);
        const wstgId = pick(r, 'WSTG_ID', 'WSTG_REF', 'WSTG_NO', 'PIPE_ID', 'STANDPIPE_ID', 'ID', 'REF');
        const wstgType = pick(r, 'WSTG_TYPE', 'TYPE');
        const wstgMat = pick(r, 'WSTG_MAT', 'WSTG_MATERIAL', 'MAT', 'MATERIAL');
        const wstgDiam = pick(r, 'WSTG_DIA', 'WSTG_DIAM', 'DIAM', 'DIAMETER', 'DIA');
        const wstgDesc = pick(r, 'WSTG_DESC', 'WSTG_REM', 'WSTG_LEGEND', 'WSTG_NOTE', 'DESC', 'DESCRIPTION', 'REMARK', 'LEGEND', 'NOTE', 'REM');
        const ref = resolveLocaRef(r);
        const dFrom = num(pick(r, 'WSTG_TOP', 'TOP', 'DEPTH_FROM', 'FROM'));
        const dTo = num(pick(r, 'WSTG_BASE', 'WSTG_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'TO'));
        const waterLevel = num(pick(r, 'WSTG_DP', 'WSTG_READ', 'WSTG_DEPTH', 'WSTG_LEVEL', 'WSTG_WLEVEL', 'WATER_DEPTH', 'DP', 'READ', 'LEVEL', 'WLEVEL', 'DEPTH'));
        const readDate = pick(r, 'WSTG_DATE', 'WSTG_READ_DATE', 'WSTG_DP_DATE', 'DATE', 'READ_DATE');

        if (wstgType || wstgMat || wstgDiam || dFrom != null || dTo != null) {
          const parts = [wstgType, wstgMat, wstgDiam ? `${wstgDiam}mm` : ''].filter(Boolean);
          const summary = parts.length > 0 ? parts.join(' · ') : 'Standpipe installation';
          const detail = wstgDesc ? `${summary} — ${wstgDesc}` : summary;
          logs.push({
            job_id: job.id, staff_id: staffId, date: today,
            log_type: 'installation', borehole_ref: ref, standpipe_ref: wstgId || null,
            depth_from: dFrom, depth_to: dTo,
            description: `Imported from KeyLogBook AGS — standpipe${wstgId ? ` ${wstgId}` : ''}: ${detail}.`,
            source: 'ags_import', completed_by_type: 'internal_staff',
            completed_by_name: 'AGS Import (KeyLogBook)',
            manager_review_status: 'approved', chargeable: false,
          });
          counts.installations++;
        }

        if (waterLevel != null) {
          logs.push({
            job_id: job.id, staff_id: staffId, date: readDate || today,
            log_type: 'standpipe_reading', borehole_ref: ref, standpipe_ref: wstgId || null,
            standpipe_reading_m: waterLevel,
            description: `Imported from KeyLogBook AGS — groundwater monitoring reading: ${waterLevel}mBGL${wstgId ? ` on standpipe ${wstgId}` : ''}.`,
            source: 'ags_import', completed_by_type: 'internal_staff',
            completed_by_name: 'AGS Import (KeyLogBook)',
            manager_review_status: 'approved', chargeable: false,
          });
          counts.waterReadings++;
        }
      }
    }

    if (logs.length === 0) {
      const found = Object.keys(groups).sort().join(', ');
      return Response.json({
        error: `No LOCA, GEOL, CORE, SAMP, SPT/ISPT, TREM or WSTG records were found in this AGS file. Groups found: ${found || '(none)'}.`
      }, { status: 422 });
    }

    let inserted = 0;
    for (let i = 0; i < logs.length; i += 500) {
      const batch = logs.slice(i, i + 500);
      await base44.asServiceRole.entities.InvestigationLog.bulkCreate(batch);
      inserted += batch.length;
    }

    const groupDebug: Record<string, string[]> = {};
    for (const [name, g] of Object.entries(groups)) {
      if (g.headings && g.headings.length > 0) groupDebug[name] = g.headings;
    }

    return Response.json({
      status: 'success', job_id: job.id, job_name: job.name,
      job_reference: job.job_reference, deleted: deletedCount, inserted,
      counts, groups: groupDebug,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});