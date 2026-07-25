import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { parseRemarks, professionaliseActivities, hasTimePattern, timeToMins, normaliseTime } from '../../shared/keylogbookRemarks.ts';

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

// ============================================================
// Driller remarks extraction from AGS files
// ============================================================
// KeyLogBook embeds the driller's time-stamped daily diary
// ("7:30_8:45 = Start briefing...") into AGS remark/note fields.
// Standard AGS also carries per-record remarks (LOCA_REM, GEOL_REM,
// SAMP_REM) and project remarks (PROJ_REM). We harvest every remark
// field value that matches the time-stamped activity pattern and feed
// it through the same parseRemarks pipeline the webhook uses, so
// manual uploads populate the Site Logs tab identically to real-time
// webhooks.
//
// Each remark chunk is tagged with the date of the borehole row it
// came from (LOCA_STAR / LOCA_ENDD), so the imported activities land
// on the correct day rather than all on "today". Plain descriptive
// remarks without a time pattern stay on their technical logs.

const REMARK_FIELD_SUFFIXES = ['REM', 'REMARK', 'REMARKS', 'NOTE', 'NOTES', 'COMMENT', 'COMMENTS', 'DIARY', 'DAILY'];
const REMARK_GROUP_NAMES = ['REMARK', 'REMARKS', 'NOTE', 'NOTES', 'COMMENT', 'COMMENTS', 'DIARY', 'DAILY', 'LOG', 'LOGS'];

function isRemarkField(fieldName: string, groupName: string): boolean {
  const suffix = normalizeKey(fieldName, groupName);
  return REMARK_FIELD_SUFFIXES.includes(suffix);
}

interface RemarkChunk { text: string; borehole_ref: string; explicitDate: string; }

// Normalise an AGS date value to ISO YYYY-MM-DD. Handles the common formats
// KeyLogBook exports (ISO, DD/MM/YYYY, YYYYMMDD) so remark rows dated with a
// different format than LOCA still land on the correct day.
function normaliseDate(v: string): string {
  if (!v) return '';
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}

// Working-day helpers. Each diary fragment represents one shift day
// (Mon–Fri, activities ~7:30–17:00). When an AGS file carries several
// diary fragments for one borehole but no explicit per-row date, we
// spread them across consecutive working days starting from the
// borehole's start date so every shift becomes its own Site Log day
// instead of all collapsing onto the single drilling date (which is
// what made the other days vanish from the timeline).
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isWeekend(iso: string): boolean {
  const day = new Date(iso + 'T00:00:00Z').getUTCDay(); // 0=Sun .. 6=Sat
  return day === 0 || day === 6;
}
function nextWorkingDay(iso: string): string {
  let d = iso;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

// Collect time-stamped remark text from every *_REM / *_NOTE field and
// REMARK / DIARY group. Each chunk keeps the borehole ref it came from and
// any explicit DATE column value found on its row; the final calendar date
// is resolved later by assignChunkDates so multiple fragments for one
// borehole land on distinct working days rather than all on one date.
function extractRemarkChunks(groups: Record<string, GroupData>): RemarkChunk[] {
  const chunks: RemarkChunk[] = [];
  // De-duplicate identical diary text harvested from several remark columns
  // on the same row (a row often carries the same diary in REM, NOTE and
  // REMARK columns). Keyed by borehole + text so the diary is parsed once.
  const seen = new Set<string>();
  const push = (text: string, ref: string, explicitDate: string) => {
    if (!text || !hasTimePattern(text)) return;
    const key = `${ref || ''}|${text.trim()}`;
    if (seen.has(key)) return;
    seen.add(key);
    chunks.push({ text, borehole_ref: ref, explicitDate });
  };

  // LOCA group — per-row remark fields belong to that borehole.
  if (groups.LOCA && groups.LOCA.rows.length) {
    for (const row of groups.LOCA.rows) {
      const r = buildRow(groups.LOCA, row);
      const locaId = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
      const explicit = normaliseDate(pick(r, 'DATE', 'LOCA_DATE', 'REMARK_DATE', 'DIARY_DATE', 'DAY'));
      groups.LOCA.headings.forEach((h) => {
        const full = h.toUpperCase();
        if (!isRemarkField(h, 'LOCA')) return;
        push(r[full] || '', locaId, explicit);
      });
    }
  }

  // Other groups — remark/diary groups or any *_REM field.
  for (const [name, g] of Object.entries(groups)) {
    if (name === 'LOCA') continue;
    if (!g.headings || g.rows.length === 0) continue;
    const wholeGroupRemark = REMARK_GROUP_NAMES.includes(name.toUpperCase());
    if (!wholeGroupRemark && !g.headings.some(h => REMARK_FIELD_SUFFIXES.includes(normalizeKey(h, name)))) continue;
    for (const row of g.rows) {
      const r = buildRow(g, row);
      const ref = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
      const explicit = normaliseDate(pick(r, 'DATE', 'LOCA_DATE', 'REMARK_DATE', 'DIARY_DATE', 'DAY'));
      g.headings.forEach((h) => {
        const full = h.toUpperCase();
        if (!(wholeGroupRemark || isRemarkField(h, name))) return;
        push(r[full] || '', ref, explicit);
      });
    }
  }
  return chunks;
}

// Assign each chunk a calendar date. Chunks with an explicit DATE column keep
// it (and consume that working day). Undated chunks for the same borehole are
// spread across consecutive working days (Mon–Fri) starting from the
// borehole's start date (LOCA_STAR via locaDates), then the job start date,
// then today — skipping weekends and any day already taken by an explicit
// chunk. This guarantees one diary fragment per shift day so no days vanish.
function assignChunkDates(rawChunks: RemarkChunk[], locaDates: Record<string, string>, jobStartDate: string, defaultDate: string): { text: string; date: string; borehole_ref: string }[] {
  const byBorehole: Record<string, RemarkChunk[]> = {};
  const order: string[] = [];
  for (const c of rawChunks) {
    const key = c.borehole_ref || '';
    if (!byBorehole[key]) { byBorehole[key] = []; order.push(key); }
    byBorehole[key].push(c);
  }
  const out: { text: string; date: string; borehole_ref: string }[] = [];
  for (const ref of order) {
    const list = byBorehole[ref];
    const startRaw = normaliseDate(locaDates[ref] || '') || jobStartDate || defaultDate;
    const used = new Set<string>();
    let cursor = nextWorkingDay(startRaw);
    for (const c of list) {
      const explicit = c.explicitDate ? normaliseDate(c.explicitDate) : '';
      if (explicit) {
        used.add(explicit);
        out.push({ text: c.text, date: explicit, borehole_ref: ref });
        continue;
      }
      while (isWeekend(cursor) || used.has(cursor)) cursor = addDays(cursor, 1);
      out.push({ text: c.text, date: cursor, borehole_ref: ref });
      used.add(cursor);
      cursor = addDays(cursor, 1);
    }
  }
  return out;
}

// Build a map of borehole ref → date from the LOCA group, used to date
// every technical log (strata, samples, SPT, installations, readings)
// and the driller remarks harvested from those boreholes.
function buildLocaDates(groups: Record<string, GroupData>, fallback: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (groups.LOCA && groups.LOCA.rows.length) {
    for (const row of groups.LOCA.rows) {
      const r = buildRow(groups.LOCA, row);
      const id = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
      if (!id) continue;
      const date = pick(r, 'LOCA_STAR', 'LOCA_START', 'STAR', 'LOCA_ENDD', 'LOCA_END', 'ENDD', 'LOCA_DATE', 'DATE') || fallback;
      map[id] = date;
    }
  }
  return map;
}

// Stable signature for de-duplicating logs within a single import.
// Two rows that produce the same signature are treated as the same
// entry and only the first is kept.
function logSignature(log: any): string {
  return [
    log.date || '',
    log.log_type || '',
    log.borehole_ref || '',
    log.sample_id || '',
    log.standpipe_ref || '',
    log.depth_from ?? '',
    log.depth_to ?? '',
    log.core_run_number || '',
    log.start_time || '',
    log.end_time || '',
    (log.description || '').trim().toLowerCase(),
  ].join('|');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Any authenticated user can import an AGS file — the import only creates
    // non-chargeable, manager-reviewed log entries. Access to the settings
    // page itself is already gated by the app's route guard.
    const body = await req.json();
    const fileContent = body.file_content;
    const fileUrl = body.file_url;
    const jobId: string | null = body.job_id || null;
    if (!fileContent && !fileUrl) return Response.json({ error: 'An AGS file is required.' }, { status: 400 });

    // Prefer the raw text sent directly from the browser (avoids the admin-only
    // UploadFile integration so managers can import). Fall back to fetching a
    // previously-uploaded file URL for backward compatibility.
    let text: string;
    if (fileContent) {
      text = String(fileContent);
    } else {
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) return Response.json({ error: 'Could not download AGS file' }, { status: 422 });
      text = await fileRes.text();
    }
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
    // Capture the real person performing the import so every AGS-imported
    // log is attributed to them (shown on the Borehole / Logs pages).
    const importerName = (user.full_name || user.email || 'AGS Import (KeyLogBook)');

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
    const locaDates = buildLocaDates(groups, today);

    const logs: any[] = [];
    const seen = new Set<string>();
    const counts = { locations: 0, strata: 0, core: 0, samples: 0, spt: 0, installations: 0, waterReadings: 0, remarks: 0, duplicates: 0 };

    // Push a log only if it is not a duplicate of one already staged.
    const addLog = (log: any) => {
      const sig = logSignature(log);
      if (seen.has(sig)) { counts.duplicates++; return false; }
      seen.add(sig);
      logs.push(log);
      return true;
    };

    let lastLocaRef = '';
    const resolveLocaRef = (r: Record<string, string>) => {
      const id = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'LOC_ID', 'ID', 'REF');
      if (id) { lastLocaRef = id; return id; }
      return lastLocaRef || '';
    };
    const resolveDate = (ref: string) => (ref && locaDates[ref]) || today;

    // ---- LOCA — borehole locations ----
    if (groups.LOCA && groups.LOCA.rows.length) {
      for (const row of groups.LOCA.rows) {
        const r = buildRow(groups.LOCA, row);
        const locaId = pick(r, 'LOCA_ID', 'LOCA_REF', 'LOCA_NO', 'LOCATION_ID', 'HOLE_ID', 'BH_ID', 'ID', 'REF');
        if (!locaId) continue;
        lastLocaRef = locaId;
        const locaType = pick(r, 'LOCA_TYPE', 'LOCA_LETT', 'TYPE', 'LETT');
        const locaDate = pick(r, 'LOCA_STAR', 'LOCA_START', 'STAR', 'LOCA_ENDD', 'LOCA_END', 'ENDD', 'LOCA_DATE', 'DATE') || today;
        const locaElev = num(pick(r, 'LOCA_GL', 'LOCA_ELEV', 'LOCA_LEVEL', 'LOCA_DATUM', 'GL', 'ELEV', 'LEVEL'));
        const locaX = pick(r, 'LOCA_NATE', 'LOCA_X', 'LOCA_EAST', 'NATE', 'EASTING', 'EAST', 'X');
        const locaY = pick(r, 'LOCA_NATN', 'LOCA_Y', 'LOCA_NORTH', 'NATN', 'NORTHING', 'NORTH', 'Y');
        const descParts = [
          `borehole ${locaId} (${locaType || 'borehole'})`,
          locaElev != null ? `, ground level ${locaElev}m` : '',
          locaX && locaY ? `, coordinates ${locaX}, ${locaY}` : '',
        ];
        if (addLog({
          job_id: job.id, staff_id: staffId, date: locaDate,
          log_type: 'borehole_progress', borehole_ref: locaId,
          depth_to: num(pick(r, 'LOCA_FDEP', 'LOCA_FDEPTH', 'LOCA_DEPTH', 'LOCA_FINAL_DEPTH', 'LOCA_TD', 'FDEP', 'FDEPTH', 'DEPTH', 'TD')) || null,
          groundwater_strike_depth: num(pick(r, 'LOCA_GND', 'LOCA_GW_DEPTH', 'LOCA_GWL', 'LOCA_WATER', 'GND', 'GW_DEPTH', 'GWL', 'WATER')) || null,
          description: `Imported from KeyLogBook AGS — ${descParts.join('')}.`,
          source: 'ags_import', completed_by_type: 'internal_staff',
          completed_by_name: importerName,
          manager_review_status: 'approved', chargeable: false,
        })) counts.locations++;
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
          const logDate = resolveDate(ref);

          if (hasCoreFields) {
            const rqd = num(pick(r, 'GEOL_RQD', 'RQD', 'CORE_RQD', 'ROCK_QUALITY'));
            const recovery = num(pick(r, 'GEOL_REC', 'GEOL_RECOVERY', 'GEOL_PER_REC', 'CORE_REC', 'REC', 'RECOVERY', 'PER_REC'));
            const runNo = pick(r, 'GEOL_RUN', 'GEOL_RUN_NO', 'CORE_RUN', 'RUN_NO', 'RUN');
            const boxNo = pick(r, 'GEOL_BOX', 'GEOL_BOX_NO', 'CORE_BOX', 'BOX_NO', 'BOX');
            if (addLog({
              job_id: job.id, staff_id: staffId, date: logDate,
              log_type: 'core_inspection', borehole_ref: ref,
              core_run_number: runNo || null, core_box_number: boxNo || null,
              depth_from: dFrom || null, depth_to: dTo || null,
              coring_rqd: rqd, coring_recovery: recovery, strata_description_detail: desc,
              description: `Imported from KeyLogBook AGS — core run${runNo ? ` ${runNo}` : ''}${rqd != null ? ` (RQD ${rqd}%)` : ''}${recovery != null ? ` (recovery ${recovery}%)` : ''}.`,
              source: 'ags_import', completed_by_type: 'internal_staff',
              completed_by_name: importerName,
              manager_review_status: 'approved', chargeable: false,
            })) counts.core++;
          } else {
            if (addLog({
              job_id: job.id, staff_id: staffId, date: logDate,
              log_type: 'borehole_progress', borehole_ref: ref,
              depth_from: dFrom || null, depth_to: dTo || null,
              strata_descriptor: mapStrataDescriptor(desc), strata_description_detail: desc,
              description: 'Imported from KeyLogBook AGS — strata.',
              source: 'ags_import', completed_by_type: 'internal_staff',
              completed_by_name: importerName,
              manager_review_status: 'approved', chargeable: false,
            })) counts.strata++;
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
        if (addLog({
          job_id: job.id, staff_id: staffId, date: resolveDate(ref),
          log_type: 'core_inspection', borehole_ref: ref,
          core_run_number: runNo || coreId || null, core_box_number: boxNo || null,
          depth_from: dFrom || null, depth_to: dTo || null,
          coring_rqd: rqd, coring_recovery: recovery, strata_description_detail: coreDesc || null,
          description: `Imported from KeyLogBook AGS — core run${runNo || coreId ? ` ${runNo || coreId}` : ''}${rqd != null ? ` (RQD ${rqd}%)` : ''}${recovery != null ? ` (recovery ${recovery}%)` : ''}.${coreDesc ? ' ' + coreDesc : ''}`,
          source: 'ags_import', completed_by_type: 'internal_staff',
          completed_by_name: importerName,
          manager_review_status: 'approved', chargeable: false,
        })) counts.core++;
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
        if (addLog({
          job_id: job.id, staff_id: staffId, date: resolveDate(ref),
          log_type: 'sample_collection', borehole_ref: ref,
          sample_id: sampId, depth_from: dFrom || null,
          sample_type: mapSampleType(sampType),
          description: `Imported from KeyLogBook AGS — sample ${sampId} (${sampType}).`,
          source: 'ags_import', completed_by_type: 'internal_staff',
          completed_by_name: importerName,
          manager_review_status: 'approved', chargeable: false,
        })) counts.samples++;
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
          if (addLog({
            job_id: job.id, staff_id: staffId, date: resolveDate(ref),
            log_type: 'borehole_progress', borehole_ref: ref,
            depth_from: dFrom || null, depth_to: dTo || null,
            spt_blows: blows, spt_n_value: nval,
            description: `Imported from KeyLogBook AGS — SPT (N=${nval != null ? nval : 'n/a'}).`,
            source: 'ags_import', completed_by_type: 'internal_staff',
            completed_by_name: importerName,
            manager_review_status: 'approved', chargeable: false,
          })) counts.spt++;
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
        if (addLog({
          job_id: job.id, staff_id: staffId, date: resolveDate(ref),
          log_type: 'installation', borehole_ref: ref, standpipe_ref: tremId || null,
          depth_from: num(pick(r, 'TREM_TOP', 'TOP', 'DEPTH_FROM', 'FROM')) || null,
          depth_to: num(pick(r, 'TREM_BASE', 'TREM_BOT', 'BASE', 'BOT', 'DEPTH_TO', 'TO')) || null,
          description: `Imported from KeyLogBook AGS — installation pipe${tremId ? ` ${tremId}` : ''}: ${detail}.`,
          source: 'ags_import', completed_by_type: 'internal_staff',
          completed_by_name: importerName,
          manager_review_status: 'approved', chargeable: false,
        })) counts.installations++;
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
        const logDate = resolveDate(ref);

        if (wstgType || wstgMat || wstgDiam || dFrom != null || dTo != null) {
          const parts = [wstgType, wstgMat, wstgDiam ? `${wstgDiam}mm` : ''].filter(Boolean);
          const summary = parts.length > 0 ? parts.join(' · ') : 'Standpipe installation';
          const detail = wstgDesc ? `${summary} — ${wstgDesc}` : summary;
          if (addLog({
            job_id: job.id, staff_id: staffId, date: logDate,
            log_type: 'installation', borehole_ref: ref, standpipe_ref: wstgId || null,
            depth_from: dFrom, depth_to: dTo,
            description: `Imported from KeyLogBook AGS — standpipe${wstgId ? ` ${wstgId}` : ''}: ${detail}.`,
            source: 'ags_import', completed_by_type: 'internal_staff',
            completed_by_name: importerName,
            manager_review_status: 'approved', chargeable: false,
          })) counts.installations++;
        }

        if (waterLevel != null) {
          if (addLog({
            job_id: job.id, staff_id: staffId, date: readDate || logDate,
            log_type: 'standpipe_reading', borehole_ref: ref, standpipe_ref: wstgId || null,
            standpipe_reading_m: waterLevel,
            description: `Imported from KeyLogBook AGS — groundwater monitoring reading: ${waterLevel}mBGL${wstgId ? ` on standpipe ${wstgId}` : ''}.`,
            source: 'ags_import', completed_by_type: 'internal_staff',
            completed_by_name: importerName,
            manager_review_status: 'approved', chargeable: false,
          })) counts.waterReadings++;
        }
      }
    }

    // ---- Driller remarks (daily diary) — same pipeline as the webhook ----
    // Harvest time-stamped remark text from *_REM / *_NOTE fields and
    // REMARK/DIARY groups, tagged with the borehole's date. Parse into
    // activities, AI-professionalise in a single call, and save as
    // source='keylogbook_remarks' (pending review) so the manager can
    // approve them into a timesheet from the Site Logs tab.
    const rawChunks = extractRemarkChunks(groups);
    const remarkChunks = assignChunkDates(rawChunks, locaDates, job.start_date || today, today);
    if (remarkChunks.length > 0) {
      // Parse each dated chunk and tag every activity with its chunk's date AND
      // borehole ref so the imported Site Logs are linked to the correct day.
      const allActivities: { activity: any; date: string; borehole_ref: string }[] = [];
      for (const chunk of remarkChunks) {
        const acts = parseRemarks(chunk.text);
        for (const a of acts) allActivities.push({ activity: a, date: chunk.date, borehole_ref: chunk.borehole_ref });
      }
      if (allActivities.length > 0) {
        const cleaned = await professionaliseActivities(base44, allActivities.map(x => x.activity));
        // Overwrite previous remarks logs for this job (manual re-import)
        try {
          const prevRemarks = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: job.id, source: 'keylogbook_remarks' });
          if (prevRemarks.length > 0) {
            await base44.asServiceRole.entities.InvestigationLog.deleteMany({ job_id: job.id, source: 'keylogbook_remarks' });
            deletedCount += prevRemarks.length;
          }
        } catch (e) { /* continue */ }

        allActivities.forEach((x, i) => {
          if (addLog({
            job_id: job.id,
            staff_id: staffId,
            staff_name: importerName,
            date: x.date,
            log_type: 'other',
            borehole_ref: x.borehole_ref || null,
            source: 'keylogbook_remarks',
            start_time: x.activity.start_time,
            end_time: x.activity.end_time,
            duration_minutes: x.activity.duration_minutes,
            description: cleaned[i] || x.activity.raw_description,
            completed_by_type: 'internal_staff',
            completed_by_name: importerName,
            manager_review_status: 'pending',
            chargeable: false,
            billing_status: 'no_charge',
          })) counts.remarks++;
        });
      }
    }

    if (logs.length === 0) {
      const found = Object.keys(groups).sort().join(', ');
      return Response.json({
        error: `No LOCA, GEOL, CORE, SAMP, SPT/ISPT, TREM or WSTG records were found in this AGS file. Groups found: ${found || '(none)'}.`
      }, { status: 422 });
    }

    // Organise: sort by date, then start time, then borehole ref so the
    // imported logs read chronologically day-by-day, activity-by-activity.
    logs.sort((a, b) => {
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
      const at = timeToMins(a.start_time);
      const bt = timeToMins(b.start_time);
      // Activities with a real time sort by clock order; entries without a
      // time (borehole/strata/sample logs) sort after the timed activities.
      const av = at != null ? at : 9999;
      const bv = bt != null ? bt : 9999;
      if (av !== bv) return av - bv;
      return (a.borehole_ref || '').localeCompare(b.borehole_ref || '');
    });

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
      duplicates: counts.duplicates, counts, groups: groupDebug,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});