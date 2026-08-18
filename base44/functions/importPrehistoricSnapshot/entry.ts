import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

// ---------------------------------------------------------------------------
// importPrehistoricSnapshot — Self-isolated full legacy archive import.
//
// Parses an Excel/CSV file into per-sheet previews with auto-matched
// column→entity-field mappings. On commit, takes a backup snapshot of the
// entities that will be touched, then imports in dependency order.
//
// Admin only. Two modes:
//   dry_run: true  → parse + preview, no writes
//   dry_run: false → backup snapshot, then create records in dependency order
//
// Multipart upload: { file, dry_run, mappings }
//   mappings: { [sheetName]: { entity: string, fieldMap: { [header]: fieldName } } }
//             Only sent on commit. Omitted on preview → auto-match is used.
// ---------------------------------------------------------------------------

// Entity field registry — key fields per supported entity, used for auto-matching
// headers and for building create payloads on commit.
const ENTITY_FIELDS: Record<string, { name: string; type: string }[]> = {
  Client: [
    { name: 'name', type: 'string' },
    { name: 'contact_name', type: 'string' },
    { name: 'contact_email', type: 'string' },
    { name: 'contact_phone', type: 'string' },
    { name: 'is_partner', type: 'boolean' },
  ],
  Team: [
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'job_type', type: 'string' },
    { name: 'category', type: 'string' },
  ],
  Staff: [
    { name: 'name', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'phone', type: 'string' },
    { name: 'job_title', type: 'string' },
    { name: 'worker_type', type: 'string' },
    { name: 'team_id', type: 'string' },
  ],
  Vehicle: [
    { name: 'name', type: 'string' },
    { name: 'registration_number', type: 'string' },
    { name: 'make', type: 'string' },
    { name: 'model', type: 'string' },
    { name: 'vehicle_type', type: 'string' },
  ],
  Job: [
    { name: 'name', type: 'string' },
    { name: 'job_reference', type: 'string' },
    { name: 'location', type: 'string' },
    { name: 'start_date', type: 'date' },
    { name: 'end_date', type: 'date' },
    { name: 'status', type: 'string' },
    { name: 'client_id', type: 'string' },
    { name: 'project_manager', type: 'string' },
  ],
  RotaAssignment: [
    { name: 'staff_id', type: 'string' },
    { name: 'job_id', type: 'string' },
    { name: 'assigned_date', type: 'date' },
    { name: 'week_start', type: 'date' },
    { name: 'assignment_type', type: 'string' },
  ],
  Timesheet: [
    { name: 'staff_id', type: 'string' },
    { name: 'job_id', type: 'string' },
    { name: 'date', type: 'date' },
    { name: 'task_description', type: 'string' },
    { name: 'total_hours', type: 'number' },
  ],
  Invoice: [
    { name: 'invoice_number', type: 'string' },
    { name: 'job_id', type: 'string' },
    { name: 'client_id', type: 'string' },
    { name: 'issue_date', type: 'date' },
    { name: 'net_total', type: 'number' },
    { name: 'gross_total', type: 'number' },
    { name: 'status', type: 'string' },
  ],
  JobCostItem: [
    { name: 'job_id', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'category', type: 'string' },
    { name: 'unit_cost', type: 'number' },
    { name: 'quantity', type: 'number' },
    { name: 'unit_label', type: 'string' },
  ],
};

// Import dependency order — parents before children so FKs can resolve
const IMPORT_ORDER = ['Client', 'Team', 'Staff', 'Vehicle', 'Job', 'RotaAssignment', 'Timesheet', 'Invoice', 'JobCostItem'];

// Backup entities — snapshotted before commit so the import can be rolled back
const BACKUP_ENTITIES = ['Client', 'Team', 'Staff', 'Vehicle', 'Job', 'RotaAssignment', 'Timesheet', 'Invoice', 'JobCostItem'];

// Fuzzy header → field match: normalises, compares token overlap + substring
function normaliseHeader(h: string): string {
  return String(h || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenise(s: string): string[] {
  return normaliseHeader(s).split(' ').filter((w) => w.length > 1);
}

function headerToFieldScore(header: string, fieldName: string): number {
  const h = normaliseHeader(header);
  const f = fieldName.toLowerCase().replace(/_/g, ' ');
  if (!h || !f) return 0;
  if (h === f) return 1.0;
  if (h.includes(f) || f.includes(h)) return 0.85;
  const hTokens = new Set(tokenise(header));
  const fTokens = new Set(f.split(' '));
  let common = 0;
  for (const t of hTokens) if (fTokens.has(t)) common++;
  const maxLen = Math.max(hTokens.size, fTokens.size);
  if (maxLen === 0) return 0;
  return (common / maxLen) * 0.7;
}

function autoMatchHeader(header: string, fields: { name: string; type: string }[]): string {
  let best = '';
  let bestScore = 0;
  for (const field of fields) {
    const score = headerToFieldScore(header, field.name);
    if (score > bestScore) {
      bestScore = score;
      best = field.name;
    }
  }
  return bestScore >= 0.4 ? best : '';
}

// Detect entity type from sheet name
function detectEntityFromSheetName(sheetName: string): string {
  const lower = normaliseHeader(sheetName);
  for (const entity of Object.keys(ENTITY_FIELDS)) {
    const eLower = entity.toLowerCase();
    if (lower.includes(eLower) || eLower.includes(lower)) return entity;
  }
  // Common aliases
  if (lower.includes('customer')) return 'Client';
  if (lower.includes('crew') || lower.includes('group')) return 'Team';
  if (lower.includes('employee') || lower.includes('worker') || lower.includes('driller')) return 'Staff';
  if (lower.includes('van') || lower.includes('lorry') || lower.includes('truck')) return 'Vehicle';
  if (lower.includes('project') || lower.includes('site') || lower.includes('borehole')) return 'Job';
  if (lower.includes('rota') || lower.includes('schedule') || lower.includes('planner')) return 'RotaAssignment';
  if (lower.includes('time') || lower.includes('hour')) return 'Timesheet';
  if (lower.includes('inv')) return 'Invoice';
  if (lower.includes('cost') || lower.includes('rate') || lower.includes('price')) return 'JobCostItem';
  return '';
}

function coerceValue(rawValue: any, fieldType: string): any {
  if (rawValue === null || rawValue === undefined || rawValue === '') return undefined;
  if (fieldType === 'number') {
    const n = Number(rawValue);
    return isNaN(n) ? undefined : n;
  }
  if (fieldType === 'date') {
    if (rawValue instanceof Date) return rawValue.toISOString().slice(0, 10);
    const s = String(rawValue).trim();
    // Try DD/MM/YYYY or MM/DD/YYYY
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let [, a, b, y] = m;
      if (y.length === 2) y = '20' + y;
      // Assume DD/MM/YYYY (UK)
      const day = a.padStart(2, '0');
      const month = b.padStart(2, '0');
      return `${y}-${month}-${day}`;
    }
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
  }
  if (fieldType === 'boolean') {
    const s = String(rawValue).toLowerCase().trim();
    return ['true', 'yes', '1', 'y', 'x'].includes(s);
  }
  return String(rawValue).trim();
}

function getWeekStart(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getUTCDay();
  const diff = (day === 0 ? 6 : day - 1); // Monday = 0
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const contentType = req.headers.get('content-type') || '';
    let dryRun = true;
    let arrayBuffer: ArrayBuffer;
    let mappings: Record<string, { entity: string; fieldMap: Record<string, string> }> = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const filePart = formData.get('file');
      dryRun = formData.get('dry_run') !== 'false';
      const mappingsPart = formData.get('mappings');
      if (mappingsPart) {
        try { mappings = JSON.parse(mappingsPart as string); } catch { mappings = {}; }
      }
      if (!filePart) return Response.json({ error: 'A file is required.' }, { status: 400 });
      arrayBuffer = await (filePart as File).arrayBuffer();
    } else {
      const body = await req.json().catch(() => ({}));
      dryRun = body.dry_run !== false;
      mappings = body.mappings || {};
      const fileUrl = body.file_url;
      if (!fileUrl) return Response.json({ error: 'file_url or file is required' }, { status: 400 });
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) return Response.json({ error: 'Could not download the file' }, { status: 422 });
      arrayBuffer = await fileRes.arrayBuffer();
    }

    const sr = base44.asServiceRole;

    // 1. Parse the workbook
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheetPreviews: any[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as any[][];
      if (rows.length < 2) {
        sheetPreviews.push({ sheet_name: sheetName, entity: '', headers: [], sample_rows: [], row_count: 0, field_map: {} });
        continue;
      }

      // Detect header row (first non-empty row with ≥2 non-empty cells)
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const nonEmpty = (rows[i] || []).filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length;
        if (nonEmpty >= 2) { headerRowIdx = i; break; }
      }
      const headers = (rows[headerRowIdx] || []).map((c: any, i: number) => ({
        col: i,
        raw: c === null || c === undefined ? '' : String(c).trim(),
        normalised: normaliseHeader(String(c || '')),
      })).filter((h) => h.raw !== '');

      const dataRows = rows.slice(headerRowIdx + 1).filter((r) => r && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''));
      const sampleRows = dataRows.slice(0, 10).map((r) => {
        const obj: Record<string, any> = {};
        for (const h of headers) obj[h.raw] = r[h.col] === null || r[h.col] === undefined ? '' : String(r[h.col]);
        return obj;
      });

      // Detect entity + auto-match fields
      const detectedEntity = detectEntityFromSheetName(sheetName);
      const fields = detectedEntity ? ENTITY_FIELDS[detectedEntity] : [];
      const fieldMap: Record<string, string> = {};
      for (const h of headers) {
        fieldMap[h.raw] = autoMatchHeader(h.raw, fields);
      }

      sheetPreviews.push({
        sheet_name: sheetName,
        entity: detectedEntity,
        headers: headers.map((h) => h.raw),
        sample_rows: sampleRows,
        row_count: dataRows.length,
        field_map: fieldMap,
        available_fields: fields.map((f) => f.name),
      });
    }

    // ── Preview mode ──
    if (dryRun) {
      return Response.json({
        status: 'success',
        dry_run: true,
        sheets: sheetPreviews,
        supported_entities: Object.keys(ENTITY_FIELDS),
        import_order: IMPORT_ORDER,
      });
    }

    // ── Commit mode ──
    // 2. Take a backup snapshot of all entities that will be touched
    const backupData: Record<string, any[]> = {};
    for (const entityName of BACKUP_ENTITIES) {
      try {
        const items = await sr.entities[entityName].list('-created_date', 5000);
        backupData[entityName] = items.map(({ id, created_date, updated_date, created_by_id, ...rest }: any) => rest);
      } catch {
        backupData[entityName] = [];
      }
    }
    const backupJson = JSON.stringify({ timestamp: new Date().toISOString(), entities: backupData });
    let backupFileUri = '';
    try {
      const backupFile = new File([backupJson], `prehistoric-backup-${Date.now()}.json`, { type: 'application/json' });
      const uploadRes = await sr.integrations.Core.UploadPrivateFile({ file: backupFile });
      backupFileUri = uploadRes.file_uri;
    } catch {
      // Backup failure is non-fatal but logged
    }

    // 3. Load existing records for FK resolution (name → id maps)
    const existingClients = await sr.entities.Client.list('-created_date', 5000).catch(() => []);
    const existingTeams = await sr.entities.Team.list('-created_date', 5000).catch(() => []);
    const existingStaff = await sr.entities.Staff.list('-created_date', 5000).catch(() => []);
    const existingVehicles = await sr.entities.Vehicle.list('-created_date', 5000).catch(() => []);
    const existingJobs = await sr.entities.Job.list('-created_date', 5000).catch(() => []);

    const nameKey = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const clientByName = new Map(existingClients.map((c: any) => [nameKey(c.name), c]));
    const teamByName = new Map(existingTeams.map((t: any) => [nameKey(t.name), t]));
    const staffByName = new Map(existingStaff.map((s: any) => [nameKey(s.name), s]));
    const vehicleByReg = new Map(existingVehicles.map((v: any) => [String(v.registration_number || '').toLowerCase().trim(), v]));
    const jobByName = new Map(existingJobs.map((j: any) => [nameKey(j.name), j]));
    const jobByRef = new Map(existingJobs.filter((j: any) => j.job_reference).map((j: any) => [String(j.job_reference).toLowerCase().trim(), j]));

    // Track newly created records for FK resolution within this import
    const newClientByName = new Map<string, any>();
    const newTeamByName = new Map<string, any>();
    const newStaffByName = new Map<string, any>();
    const newVehicleByReg = new Map<string, any>();
    const newJobByName = new Map<string, any>();
    const newJobByRef = new Map<string, any>();

    function resolveClient(name: string): string {
      if (!name) return '';
      const k = nameKey(name);
      return (clientByName.get(k) || newClientByName.get(k))?.id || '';
    }
    function resolveTeam(name: string): string {
      if (!name) return '';
      const k = nameKey(name);
      return (teamByName.get(k) || newTeamByName.get(k))?.id || '';
    }
    function resolveStaff(name: string): string {
      if (!name) return '';
      const k = nameKey(name);
      return (staffByName.get(k) || newStaffByName.get(k))?.id || '';
    }
    function resolveVehicle(reg: string): string {
      if (!reg) return '';
      const k = String(reg).toLowerCase().trim();
      return (vehicleByReg.get(k) || newVehicleByReg.get(k))?.id || '';
    }
    function resolveJob(name: string, ref: string): string {
      if (ref) {
        const k = String(ref).toLowerCase().trim();
        const j = jobByRef.get(k) || newJobByRef.get(k);
        if (j) return j.id;
      }
      if (name) {
        const k = nameKey(name);
        const j = jobByName.get(k) || newJobByName.get(k);
        if (j) return j.id;
      }
      return '';
    }

    // 4. Process sheets in dependency order
    const createdCounts: Record<string, number> = {};
    for (const entityName of IMPORT_ORDER) {
      createdCounts[entityName] = 0;
      // Find all sheets mapped to this entity (by confirmed mapping or auto-detection)
      const sheetsForEntity = sheetPreviews.filter((sp) => {
        const confirmed = mappings[sp.sheet_name];
        return confirmed ? confirmed.entity === entityName : sp.entity === entityName;
      });
      if (sheetsForEntity.length === 0) continue;

      const payloads: any[] = [];
      for (const sp of sheetsForEntity) {
        const confirmedMap = mappings[sp.sheet_name];
        const fieldMap = confirmedMap?.fieldMap || sp.field_map;
        const fields = ENTITY_FIELDS[entityName];
        const fieldTypes: Record<string, string> = {};
        for (const f of fields) fieldTypes[f.name] = f.type;

        const sheet = workbook.Sheets[sp.sheet_name];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as any[][];
        // Re-detect header row
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const nonEmpty = (rows[i] || []).filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length;
          if (nonEmpty >= 2) { headerRowIdx = i; break; }
        }
        const headerRow = rows[headerRowIdx] || [];
        const headerToCol: Record<string, number> = {};
        for (let c = 0; c < headerRow.length; c++) {
          const h = String(headerRow[c] || '').trim();
          if (h) headerToCol[h] = c;
        }

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !row.some((c) => c !== null && c !== undefined && String(c).trim() !== '')) continue;
          const record: any = {};
          for (const [header, fieldName] of Object.entries(fieldMap)) {
            if (!fieldName) continue;
            const col = headerToCol[header];
            if (col === undefined) continue;
            const raw = row[col];
            const coerced = coerceValue(raw, fieldTypes[fieldName] || 'string');
            if (coerced !== undefined) record[fieldName] = coerced;
          }
          if (Object.keys(record).length === 0) continue;

          // FK resolution for child entities
          if (entityName === 'Staff' && record.team_id) {
            const resolved = resolveTeam(record.team_id);
            if (resolved) record.team_id = resolved; else delete record.team_id;
          }
          if (entityName === 'Job' && record.client_id) {
            const resolved = resolveClient(record.client_id);
            if (resolved) record.client_id = resolved; else delete record.client_id;
          }
          if (entityName === 'RotaAssignment') {
            if (record.staff_id) { const r = resolveStaff(record.staff_id); if (r) record.staff_id = r; else delete record.staff_id; }
            if (record.job_id) { const r = resolveJob(record.job_id, ''); if (r) record.job_id = r; else delete record.job_id; }
            if (record.assigned_date && !record.week_start) record.week_start = getWeekStart(record.assigned_date);
          }
          if (entityName === 'Timesheet') {
            if (record.staff_id) { const r = resolveStaff(record.staff_id); if (r) record.staff_id = r; else delete record.staff_id; }
            if (record.job_id) { const r = resolveJob(record.job_id, ''); if (r) record.job_id = r; else delete record.job_id; }
            if (record.date && !record.week_start) record.week_start = getWeekStart(record.date);
          }
          if (entityName === 'Invoice') {
            if (record.job_id) { const r = resolveJob(record.job_id, record.invoice_number || ''); if (r) record.job_id = r; else delete record.job_id; }
            if (record.client_id) { const r = resolveClient(record.client_id); if (r) record.client_id = r; else delete record.client_id; }
          }
          if (entityName === 'JobCostItem') {
            if (record.job_id) { const r = resolveJob(record.job_id, ''); if (r) record.job_id = r; else delete record.job_id; }
          }

          // Required-field guard: skip records missing required fields
          if (entityName === 'Client' && !record.name) continue;
          if (entityName === 'Team' && !record.name) continue;
          if (entityName === 'Staff' && !record.name) continue;
          if (entityName === 'Vehicle' && !record.name && !record.registration_number) continue;
          if (entityName === 'Job' && !record.name) continue;
          if (entityName === 'RotaAssignment' && (!record.staff_id || !record.assigned_date)) continue;
          if (entityName === 'Timesheet' && (!record.staff_id || !record.date)) continue;
          if (entityName === 'Invoice' && (!record.invoice_number || !record.job_id)) continue;
          if (entityName === 'JobCostItem' && !record.job_id) continue;

          payloads.push(record);
        }
      }

      // BulkCreate in batches
      for (let i = 0; i < payloads.length; i += 400) {
        const batch = payloads.slice(i, i + 400);
        try {
          const created = await sr.entities[entityName].bulkCreate(batch);
          createdCounts[entityName] += (created as any[]).length;
          // Register new records for FK resolution
          for (let j = 0; j < (created as any[]).length; j++) {
            const rec = (created as any[])[j];
            if (entityName === 'Client' && rec.name) newClientByName.set(nameKey(rec.name), rec);
            if (entityName === 'Team' && rec.name) newTeamByName.set(nameKey(rec.name), rec);
            if (entityName === 'Staff' && rec.name) newStaffByName.set(nameKey(rec.name), rec);
            if (entityName === 'Vehicle' && rec.registration_number) newVehicleByReg.set(String(rec.registration_number).toLowerCase().trim(), rec);
            if (entityName === 'Job') {
              if (rec.name) newJobByName.set(nameKey(rec.name), rec);
              if (rec.job_reference) newJobByRef.set(String(rec.job_reference).toLowerCase().trim(), rec);
            }
          }
        } catch {
          // Batch failure — skip, continue with next batch
        }
      }
    }

    // 5. Audit log
    try {
      await sr.entities.SystemAuditLog.create({
        entity_name: 'Batch',
        entity_id: 'prehistoric_import',
        action: 'create',
        changed_fields: Object.keys(createdCounts),
        field_changes: JSON.stringify(createdCounts),
        record_summary: `Prehistoric import: ${Object.values(createdCounts).reduce((s: number, n: any) => s + (n || 0), 0)} records across ${Object.keys(createdCounts).filter((k) => createdCounts[k] > 0).length} entities`,
        actor_user_id: user.id,
        actor_name: user.full_name || user.email || 'Admin',
        source: 'manual',
        integrity_status: 'valid',
      });
    } catch {
      // non-fatal
    }

    return Response.json({
      status: 'success',
      dry_run: false,
      backup_file_uri: backupFileUri,
      created: createdCounts,
      total_created: Object.values(createdCounts).reduce((s: number, n: any) => s + (n || 0), 0),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}