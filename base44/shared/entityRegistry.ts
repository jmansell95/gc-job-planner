// ---------------------------------------------------------------------------
// Entity Registry — Shared deduplication & resolution logic
// ---------------------------------------------------------------------------
// Used by both importPlannerSpreadsheet (active data) and importLegacyArchive
// (prehistoric data) to ensure the same person/company/job is never created
// twice under slightly different name formats.
// ---------------------------------------------------------------------------

export function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ');
}

// Aggressive dedup key: lowercases, strips punctuation, and normalises
// "Last, First" → "first last" so the same person isn't imported twice
// under slightly different name formats.
export function nameKey(name) {
  let n = normalizeName(name).toLowerCase();
  // "smith, john" → "john smith"
  const commaMatch = n.match(/^([a-z.'-]+),\s*(.+)$/);
  if (commaMatch) n = `${commaMatch[2]} ${commaMatch[1]}`;
  // strip all punctuation except spaces
  n = n.replace(/[.,'"`’‘()]/g, '').replace(/\s+/g, ' ').trim();
  return n;
}

const DEFAULT_DOMAIN = 'ground-control.co.uk';

export function generateEmail(name, existingEmails) {
  const clean = normalizeName(name).toLowerCase().replace(/[^a-z0-9\s.-]/g, '').trim();
  if (!clean) return `imported.staff@${DEFAULT_DOMAIN}`;
  const parts = clean.split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join('') || parts[0] || '';
  let base = `${first}.${last}@${DEFAULT_DOMAIN}`;
  if (existingEmails && existingEmails.has(base.toLowerCase())) {
    let i = 2;
    while (existingEmails.has(`${first}.${last}${i}@${DEFAULT_DOMAIN}`.toLowerCase())) i++;
    base = `${first}.${last}${i}@${DEFAULT_DOMAIN}`;
  }
  return base;
}

// Build lookup maps from a list of entity records.
// Returns { byNameKey, byEmail, byRef } for fast matching.
export function buildStaffMaps(staffList) {
  const byNameKey = new Map();
  const byEmail = new Map();
  for (const s of staffList) {
    if (s.name) byNameKey.set(nameKey(s.name), s);
    if (s.email) byEmail.set(s.email.toLowerCase(), s);
  }
  return { byNameKey, byEmail };
}

export function buildJobMaps(jobList) {
  const byNameKey = new Map();
  const byRef = new Map();
  for (const j of jobList) {
    if (j.name) byNameKey.set(nameKey(j.name), j);
    if (j.job_reference) byRef.set(j.job_reference.toLowerCase(), j);
  }
  return { byNameKey, byRef };
}

export function buildContractorMaps(contractorList) {
  const byNameKey = new Map();
  for (const c of contractorList) {
    if (c.name) byNameKey.set(nameKey(c.name), c);
  }
  return { byNameKey };
}

// Resolve or create an Agency (Contractor with contractor_type='agency').
// Returns the contractor record (existing or newly created).
// In dry_run mode, returns a temp object with a synthetic id.
export async function findOrCreateAgency(base44, agencyName, contractorMaps, dryRun) {
  const key = nameKey(agencyName);
  let agency = contractorMaps.byNameKey.get(key);
  if (agency) return agency;

  if (dryRun) {
    agency = { id: `temp_agency_${key}`, name: agencyName, contractor_type: 'agency' };
  } else {
    agency = await base44.asServiceRole.entities.Contractor.create({
      name: agencyName,
      contractor_type: 'agency',
      onboarding_status: 'approved',
    });
  }
  contractorMaps.byNameKey.set(key, agency);
  return agency;
}