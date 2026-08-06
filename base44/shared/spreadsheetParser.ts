// ---------------------------------------------------------------------------
// Spreadsheet Parser — Shared parsing & name-detection logic
// ---------------------------------------------------------------------------
// Used by importPlannerSpreadsheet (active data) and importLegacyArchive
// (prehistoric data) to ensure both importers use identical parsing rules.
// ---------------------------------------------------------------------------

import { normalizeName, nameKey } from './entityRegistry.ts';
export { normalizeName, nameKey };

// --- Keyword constants ---

export const SECTION_KEYWORDS = [
  'cable', 'rotary', 'groundwork', 'coring', 'trial pit', 'trial_pit',
  'enabling', 'depot', 'yard', 'dartford', 'warehouse', 'leave', 'sick', 'holiday', 'plant',
  'subbies', 'subcontractor', 'sub-contractor', 'subby', 'drilling subbies',
  'sub.con', 'sub con', 'sub-con', 'field teams',
  'agency', 'bh', 'bank holiday', 'absence',
];

export const NON_PERSON_WORDS = [
  'team', 'teams', 'crew', 'driver', 'supervisor', 'excavator', 'excavtion',
  'operative', 'labourer', 'labour', 'helper', 'assistant',
  'mobilisation', 'mobilization', 'mobil', 'sampling',
  'fitter', 'mechanic', 'groundworker', 'groundworker+', 'ground',
  'man', 'ex', 'subbies', 'subcontractor', 'sub-contractor',
  'sub.con', 'sub', 'eng', 'field', 'drilling',
  'agent', 'manager', 'engineer', 'engineers', 'operator', 'operators',
  'inspector', 'surveyor', 'technician', 'analyst', 'consultant',
  'site', 'plant', 'safety', 'welfare', 'office', 'admin', 'administration',
  'lead', 'senior', 'junior', 'trainee', 'apprentice', 'master',
  'night', 'day', 'early', 'late', 'shift', 'rota',
  'chargehand', 'foreman', 'ganger', 'charge',
  'driller', 'drillers', 'piling', 'pile', 'coring', 'cable', 'rotary',
  'groundworks', 'enabling', 'depot', 'yard', 'dartford', 'warehouse', 'leave', 'sick',
  'holiday', 'absence', 'off', 'rest', 'break',
  'tbc', 'tba', 'tbd', 'unknown', 'n/a', 'na', 'none',
  'no', 'yes', 'am', 'pm', 'hrs', 'hours',
  'resource', 'resources', 'allocation', 'allocated', 'unallocated',
  'cover', 'covering', 'spare', 'backup', 'relief',
  'staff', 'personnel', 'workforce', 'gang', 'squad', 'unit',
  'agency', 'workers', 'worker', 'driller', 'drillers',
  'base', 'area', 'rig', 'type', 'number', 'asset',
  'opratives', 'operatives', 'full name',
  'job', 'title',
];

export const COMPANY_KEYWORDS = [
  'drilling', 'services', 'ltd', 'limited', 'construction', 'groundwork',
  'groundworks', 'engineering', 'solutions', 'group', 'plant', 'hire',
  'contractors', 'contracting', 'uk', 'co', 'trading', 'enterprises',
  'holdings', 'developments', 'foundations', 'piling', 'civils',
  'geotechnical', 'environmental', 'consulting', 'associates', 'partners',
  'subbies', 'subcontractor', 'sub-contractor', 'subby',
  'logistics', 'transport', 'haulage', 'demolition', 'excavation',
  'remediation', 'specialists', 'industries', 'works',
  'investigations', 'investigation', 'geo', 'surveying', 'testing',
];

export const STRONG_ROLE_WORDS = [
  'supervisor', 'manager', 'agent', 'crew', 'team', 'teams', 'staff',
  'operator', 'operators', 'driver', 'labourer', 'labour', 'mechanic',
  'fitter', 'inspector', 'surveyor', 'technician', 'analyst', 'consultant',
  'lead', 'senior', 'junior', 'trainee', 'apprentice', 'master',
  'chargehand', 'foreman', 'ganger', 'operative', 'helper', 'assistant',
  'charge', 'night', 'day', 'shift', 'rota', 'holiday', 'absence',
  'sick', 'leave', 'cover', 'covering', 'spare', 'backup', 'relief',
  'personnel', 'workforce', 'gang', 'squad', 'unit', 'resource',
  'resources', 'allocation', 'allocated', 'unallocated',
  'driller', 'drillers', 'agency', 'workers', 'worker',
  'type', 'number', 'base', 'area', 'asset',
];

const ANNUAL_LEAVE_CELL_KEYWORDS = [
  'off', 'golf', 'golf day', 'holiday', 'holidays', 'al', 'annual leave',
  'leave', 'vacation', 'pto', 'rest day', 'day off', 'rest', 'leave day',
  'bh', 'bank holiday',
];
const SICK_CELL_KEYWORDS = ['sick', 'off sick', 'illness', 'unwell', 'sick leave'];
const TRAINING_CELL_KEYWORDS = ['training', 'training course', 'course', 'cpd', 'training day'];

// --- Functions ---

export function cellToDate(cell) {
  if (!cell) return null;
  let iso = null;
  if (cell instanceof Date) {
    // Guard against invalid Date objects (NaN) — toISOString() throws on them
    if (isNaN(cell.getTime())) return null;
    iso = cell.toISOString().slice(0, 10);
  } else {
    const s = String(cell).trim();
    if (!s) return null;
    // ISO format: YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    } else {
      // UK text format: DD/MM/YYYY or D/M/YYYY (also DD/MM/YY)
      const ukMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (ukMatch) {
        let day = ukMatch[1].padStart(2, '0');
        let month = ukMatch[2].padStart(2, '0');
        let year = ukMatch[3];
        if (year.length === 2) year = '20' + year;
        iso = `${year}-${month}-${day}`;
      } else {
        // Excel serial number
        const num = Number(s);
        if (!isNaN(num) && num > 30000 && num < 80000) {
          const d = new Date(Math.round((num - 25569) * 86400 * 1000));
          iso = d.toISOString().slice(0, 10);
        }
      }
    }
  }
  if (!iso) return null;
  const year = parseInt(iso.slice(0, 4), 10);
  if (year < 2018 || year > 2030) return null;
  return iso;
}

export function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function categorizeNonJobCell(cellValue) {
  if (!cellValue) return null;
  const lower = String(cellValue).trim().toLowerCase();
  if (!lower || lower.length < 2) return null;

  // Unassigned placeholder
  if (lower === 'unassigned') return 'annual_leave';

  // Annual leave / holidays / absence (exact match or starts-with)
  if (/^(off|golf|golf day|holiday|holidays|hoilday|hoildays|al|bh|bank holiday|annual leave|leave|vacation|pto|rest|rest day|day off|leave day|on leave|absent|awol|left|compassionate|unpaid leave|unauthorised leave|emergency leave|no longer works|last day|start date|requested absence|italy)$/.test(lower)) return 'annual_leave';
  if (lower.startsWith('annual leave') || lower.startsWith('golf') || lower.startsWith('holiday') || lower.startsWith('hoilday') || lower.startsWith('compassionate') || lower.startsWith('unpaid') || lower.startsWith('unauthorised') || lower.startsWith('emergency leave') || lower.startsWith('on leave') || lower.startsWith('requested absence') || lower.startsWith('no longer')) return 'annual_leave';

  // Sick
  if (lower.startsWith('sick') || /^(off sick|illness|unwell|sick leave)$/.test(lower)) return 'sick';

  // Training courses (first aid, SSSTS, IOSH, ROLO, CAT&Genny, inductions, medicals, etc.)
  if (/training|first aid|sssts|iosh|rolo|cat&genny|cscs|breathing|asbestos|confined space|induction|orientation|medical|course|refresher|learning|streetworks|cpd/.test(lower)) return 'training';

  // Overheads / yard / depot / internal work (not client jobs)
  if (/^yard|^depot|^dartford|^home$|^leeds depot|overhead|^internal|^driving|^warehouse|rig repair|cp rig|rig maintenance|collecting rigs|potholes|site visit|internal works|internal job|internal site|^fuel$|^van$|^mot$|^service$|breakdown|holman|geotab|^site$/.test(lower)) return 'training';

  // Audits
  if (/audit|bda/.test(lower)) return 'training';

  // Meetings / networking / concepts / other non-job activities
  if (/meeting|^meet |networking|^wfh|working from home|sample run|^deliveries|^rigs$|^monitoring$|half day|ft visit|st marys axe visit|^3750$|rotary drilling|cable percussion|rail & infrastructure|^concept job|greenwich concept|hap regeneration|ads rotary|geotechnica/.test(lower)) return 'training';

  return null;
}

// Normalize a job/site name for project matching: strips references, noise
// suffixes (Window Sampling, Demob, Mob, Half Day, etc.) so that "Hayes -
// Window Sampling" matches the "Hayes" project.
export function normalizeForProjectMatching(name) {
  return String(name || '').toLowerCase().trim()
    .replace(/[a-z]{1,2}\d{6}(?:\/\d+)?/g, '')   // remove references like I260XXX
    .replace(/inv\s*\d+/g, '')                    // remove INV 12345
    .replace(/window sampling|concrete coring|demob|de-mob|mob|mobilised|monitoring|half day|one person|cancelled|morning|aft|afternoon|saturday night/g, '')
    .replace(/[()]/g, '').replace(/\?+/g, '').replace(/^- /g, '').replace(/\s+/g, ' ').trim();
}

// Find the best-matching existing project for a job name using bidirectional
// substring matching on normalized names. Prefers the longest match (most
// specific project) to avoid generic names stealing real sites.
export function findProjectForJob(jobName, projects) {
  const jobNorm = normalizeForProjectMatching(jobName);
  if (!jobNorm || jobNorm.length < 3) return null;
  let bestMatch = null;
  let bestLen = 0;
  for (const p of projects) {
    const pNorm = normalizeForProjectMatching(p.name);
    if (!pNorm || pNorm.length < 3) continue;
    if (jobNorm.includes(pNorm) || pNorm.includes(jobNorm)) {
      if (pNorm.length > bestLen) { bestMatch = p; bestLen = pNorm.length; }
    }
  }
  return bestMatch;
}

// Extract a clean, title-cased site name from a job name for new project creation.
export function extractSiteName(jobName) {
  const clean = normalizeForProjectMatching(jobName);
  if (!clean) return jobName;
  return clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim() || jobName;
}

export function isSectionHeader(text) {
  if (!text) return false;
  const s = String(text).trim();
  if (s.length > 50 || /[\r\n]/.test(s)) return false;
  if (/[^a-z0-9\s/.-]/i.test(s)) return false;
  const lower = s.toLowerCase();
  const words = lower.split(/\s+/);
  if (words.length >= 2 && words.some(w => COMPANY_KEYWORDS.includes(w)) && !words.some(w => STRONG_ROLE_WORDS.includes(w))) {
    return false;
  }
  return SECTION_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw) || lower.includes(kw));
}

// Training course keywords — only these create TrainingCourse records.
// Overheads (yard, depot, home), meetings, audits etc. are NOT training courses
// even though they share the 'training' rota assignment type.
export const TRAINING_COURSE_KEYWORDS = [
  'first aid', 'sssts', 'iosh', 'rolo', 'cat&genny', 'cat & genny', 'cscs',
  'breathing apparatus', 'breathing', 'asbestos', 'confined space',
  'induction', 'orientation', 'medical', 'refresher', 'streetworks',
  'cpd', 'training', 'course', 'npors', 'cpcs', 'forklift',
  'working at height', 'manual handling', 'fire warden', 'fire marshal',
  'abrasive wheels', 'noise', 'vibration', 'hsv', 'puwer', 'loler',
  'mental health', 'dse', 'display screen', 'ladder', 'harness',
  'spillage', 'spill kit', 'traffic marshal', 'banksman', 'signaller',
  'cat & genny', 'cable avoidance', 'underground services',
];

const OVERHEAD_NON_TRAINING_KEYWORDS = [
  'yard', 'depot', 'dartford', 'home', 'leeds depot', 'overhead',
  'internal', 'driving', 'warehouse', 'rig repair', 'rig maintenance',
  'collecting rigs', 'potholes', 'site visit', 'internal works',
  'internal job', 'internal site', 'fuel', 'van', 'mot', 'service',
  'breakdown', 'holman', 'geotab', 'site', 'meeting', 'meet',
  'networking', 'wfh', 'working from home', 'sample run', 'deliveries',
  'rigs', 'monitoring', 'half day', 'ft visit', 'st marys axe',
  'concept', 'greenwich', 'hap regeneration', 'ads rotary',
  'rotary drilling', 'cable percussion', 'rail & infrastructure',
  'audit', 'bda',
];

export function isActualTrainingCourse(label) {
  if (!label) return false;
  const lower = String(label).trim().toLowerCase();
  if (!lower) return false;
  // Exclude overheads/meetings/audits first
  for (const kw of OVERHEAD_NON_TRAINING_KEYWORDS) {
    if (lower === kw || lower.startsWith(kw)) return false;
  }
  return TRAINING_COURSE_KEYWORDS.some(kw => lower.includes(kw));
}

export function extractTrainingCourseTitle(label) {
  if (!label) return null;
  let s = String(label).trim();
  // Strip common prefixes/suffixes
  s = s.replace(/^training\s*course\s*[-:–]?\s*/i, '');
  s = s.replace(/^training\s*[-:–]?\s*/i, '');
  s = s.replace(/\s*training\s*course$/i, '');
  s = s.replace(/\s*course\s*$/i, '');
  s = s.replace(/^course\s*[-:–]?\s*/i, '');
  s = s.replace(/\s*day\s*$/i, '');
  s = s.trim();
  if (!s) return null;
  // Title-case the result
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim() || null;
}

export function inferTrainingCategory(title) {
  if (!title) return 'other';
  const lower = String(title).toLowerCase();
  if (lower.includes('first aid')) return 'first_aid_cert';
  if (lower.includes('cscs')) return 'cscs_card';
  if (lower.includes('cpcs')) return 'cpcs_card';
  if (lower.includes('npors')) return 'npors_card';
  if (lower.includes('forklift')) return 'forklift';
  if (lower.includes('driver') || lower.includes('licence') || lower.includes('license')) return 'driver_license';
  if (lower.includes('dbs')) return 'dbs_certificate';
  return 'other';
}

// Common suffix words that don't add specificity to a job/site name.
// Stripping these during base-key extraction ensures "EWR" and "EWR Site"
// consolidate into one master job rather than creating duplicates.
export const JOB_NAME_NOISE_SUFFIXES = [
  'site', 'project', 'job', 'works', 'work', 'phase', 'package',
  'contract', 'scheme', 'development', 'area', 'zone', 'phase 1', 'phase 2',
];

// Second-layer filter: catches cells that pass categorizeNonJobCell but
// still aren't real client jobs (pure rig names, asset tags, placeholders,
// generic single words). These are treated as overhead/non-job days instead
// of being created as Job entities that clutter the dashboard.
const NON_JOB_NAME_PATTERNS = [
  /^rig\s*\d/i, /^cp\s*rig/i, /^rotary\s*rig/i, /^rig\s+\d/i,
  /^r\d{1,3}$/i, /^t[-_]?\d+/i, /^gc[-_]r/i,            // asset tags / rig IDs
  /^sn\d+/i, /^geo\s*\d+/i, /^mi\d+$/i,                 // asset serials (SN5765, GEO 205, Mi8)
  /^tbc$|^tba$|^tbd$|^n\/a$|^na$|^none$|^unknown$/i,   // placeholders
  /^\d+$/,                                              // pure numbers
  /^unassigned$|^spare$|^cover$|^relief$|^tba$/i,      // unassigned markers
  /^rig\s*repair$|^rig\s*maintenance$|^breakdown$/i,   // rig maintenance
  /^potholes$|^monitoring$|^deliveries$|^rigs$/i,     // overhead activities
  /^geotechnica$/i,                                   // company name, not a job
];

// Role titles and column-header text that appear in spreadsheet date cells
// but are NOT job/site names. These are labels mistakenly placed in the grid
// (e.g. "Drilling Supervisor/Lead Driller", "Rig Type & Plant Number",
// "Operatives Full Name") that would otherwise be created as fake Job entities.
const ROLE_HEADER_KEYWORDS = [
  'supervisor', 'lead driller', 'drilling supervisor', 'working drilling',
  'asistant', 'assistant driller', 'operative', 'operatives', 'opratives',
  'full name', 'rig type', 'plant number', 'rig type & plant number',
  'optratives', 'operatives full name',
  'asset id', 'asset id/sn', 'job title', 'labourers', 'labourer',
];

// Building/site indicator words — when present in a name, it's a real job/site
// (e.g. "Kingsnorth Power Station", "Beatrice Tate School") not a person name.
// Used to protect real jobs from the person-name filter below.
const BUILDING_SITE_KEYWORDS = [
  'school', 'station', 'hospital', 'college', 'university', 'centre', 'center',
  'bridge', 'tunnel', 'extension', 'road', 'street', 'lane', 'avenue', 'drive',
  'place', 'way', 'grove', 'close', 'view', 'hill', 'park', 'green', 'gardens',
  'estate', 'court', 'house', 'farm', 'mill', 'factory', 'works', 'wharf',
  'quay', 'docks', 'port', 'airport', 'hall', 'plaza', 'tower', 'phase',
  'package', 'project', 'site', 'depot', 'yard', 'warehouse', 'building',
  'construction', 'development', 'regeneration', 'infrastructure', 'rail',
  'underground', 'overground', 'thamesmead', 'london', 'parliament',
];

export function isLikelyRealJob(jobName) {
  if (!jobName) return false;
  const s = String(jobName).trim();
  if (s.length < 3) return false;
  const lower = s.toLowerCase();
  // Pure rig/asset names, placeholders, and overhead markers
  for (const pattern of NON_JOB_NAME_PATTERNS) {
    if (pattern.test(lower)) return false;
  }
  // Role titles and column headers — not job names
  for (const kw of ROLE_HEADER_KEYWORDS) {
    if (lower === kw || lower.includes(kw)) return false;
  }
  // Person names in date columns (e.g. "Richard Horsman") — not job names.
  // But protect real jobs that contain building/site keywords (e.g.
  // "Kingsnorth Power Station" looks like a person name but is a real job).
  if (looksLikePersonName(s) && !BUILDING_SITE_KEYWORDS.some(kw => lower.includes(kw))) return false;
  return true;
}

// Canonical base key for job deduplication. Strips references, quantity
// suffixes, and common noise suffix words so that variations of the same
// site consolidate into one master job.
export function canonicalJobKey(jobName) {
  const name = normalizeName(jobName);
  // Extract location after reference if present (e.g. "I260124 - EWR" → "EWR")
  const dashMatch = name.match(/^[A-Za-z]{1,3}\d{4,6}\s*[-–—]\s*(.+)$/);
  let base = dashMatch ? dashMatch[1] : name;
  // Strip quantity suffix: " - N No. <anything>" or " - NNo. <anything>"
  base = base.replace(/\s*[-–—]\s*\d+\s*No\.?\s*.*$/i, '').trim();
  // Strip noise suffix words (site, project, works, etc.) — but only when
  // there's more than one word left, so single-word site names are preserved.
  const words = base.toLowerCase().split(/\s+/).filter(Boolean);
  while (words.length > 1 && JOB_NAME_NOISE_SUFFIXES.includes(words[words.length - 1])) {
    words.pop();
  }
  return nameKey(words.join(' '));
}

export function isNonPersonName(text) {
  if (!text) return true;
  const lower = String(text).trim().toLowerCase();
  const words = lower.split(/\s+/);
  return words.some(w => NON_PERSON_WORDS.includes(w));
}

export function looksLikeCompanyName(text) {
  if (!text) return false;
  if (text instanceof Date) return false;
  const s = String(text).trim();
  if (s.length < 2) return false;
  if (cellToDate(s)) return false;
  if (isSectionHeader(s)) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  if (/\d/.test(s)) return false;
  const lower = s.toLowerCase();
  const words = lower.split(/\s+/);
  for (const w of words) {
    if (STRONG_ROLE_WORDS.includes(w)) return false;
  }
  if (words.some(w => COMPANY_KEYWORDS.includes(w))) return true;
  const firstWord = s.split(/\s+/)[0];
  if (words.length >= 2 && /^[A-Z]{2,}$/.test(firstWord)) return true;
  return false;
}

// Common lowercase particles in names — these don't need to be capitalised
const LOWERCASE_PARTICLES = [
  'van', 'de', 'der', 'den', 'di', 'le', 'la', 'du', 'da', 'von', 'ter',
  'ten', 'el', 'al', 'bin', 'ibn', 'del', 'della', 'lo', 'des', 'dos', 'das',
];

export function looksLikePersonName(text) {
  if (!text) return false;
  if (text instanceof Date) return false;
  const s = String(text).trim();
  if (s.length < 2) return false;
  if (cellToDate(s)) return false;
  if (isSectionHeader(s)) return false;
  const lower = s.toLowerCase();
  if (lower === 'team planner' || lower === 'plant planner') return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  if (/\d/.test(s)) return false;
  if (isNonPersonName(s)) return false;
  if (looksLikeCompanyName(s)) return false;
  const words = s.split(/\s+/);
  if (words.length < 2) return false;
  if (words.length > 6) return false;
  // First word must start with an uppercase letter
  if (!/^[A-Z]/.test(words[0])) return false;
  // Every word must either start with uppercase OR be a known lowercase particle
  // (handles "van der Berg", "de la Cruz", etc.)
  return words.every(w => /^[A-Z]/.test(w) || LOWERCASE_PARTICLES.includes(w.toLowerCase()));
}

// Detect rig/equipment/plant names in the name column. These often contain
// digits (asset numbers, serial tags) which causes looksLikePersonName and
// looksLikeCompanyName to reject them — so without this check, rig rows in
// the team planner sheets are silently skipped and never linked to jobs.
export function looksLikeAssetName(text) {
  if (!text) return false;
  if (text instanceof Date) return false;
  const s = String(text).trim();
  if (s.length < 2) return false;
  if (cellToDate(s)) return false;
  if (isSectionHeader(s)) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  const lower = s.toLowerCase();
  if (lower === 'team planner' || lower === 'plant planner') return false;
  // Rig / plant keywords
  const ASSET_KEYWORDS = [
    'rig', 'trailer', 'compressor', 'pump', 'excavator', 'generator',
    'welfare', 'cabin', 'van', 'truck', 'tractor', 'forklift', 'crusher',
    'screen', 'dozer', 'roller', 'dumper', 'mount', 'bobcat', 'jcb',
    'hino', 'iveco', 'volvo', 'trailer-mounted', 'truck-mounted',
  ];
  if (ASSET_KEYWORDS.some(kw => lower.includes(kw))) return true;
  // Contains digits AND at least one letter — likely an asset tag/number
  // (e.g. "R1", "CP Rig 2", "T-03", "GC-R1-023")
  if (/\d/.test(s) && /[a-zA-Z]/.test(s)) return true;
  return false;
}