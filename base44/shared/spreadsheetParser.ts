// ---------------------------------------------------------------------------
// Spreadsheet Parser — Shared parsing & name-detection logic
// ---------------------------------------------------------------------------
// Used by importPlannerSpreadsheet (active data) and importLegacyArchive
// (prehistoric data) to ensure both importers use identical parsing rules.
// ---------------------------------------------------------------------------

export { normalizeName, nameKey } from './entityRegistry.ts';

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
    iso = cell.toISOString().slice(0, 10);
  } else {
    const s = String(cell).trim();
    if (!s) return null;
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    } else {
      const num = Number(s);
      if (!isNaN(num) && num > 30000 && num < 80000) {
        const d = new Date(Math.round((num - 25569) * 86400 * 1000));
        iso = d.toISOString().slice(0, 10);
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
  if (ANNUAL_LEAVE_CELL_KEYWORDS.includes(lower)) return 'annual_leave';
  if (lower.startsWith('annual leave') || lower.startsWith('golf')) return 'annual_leave';
  if (SICK_CELL_KEYWORDS.includes(lower)) return 'sick';
  if (lower.startsWith('sick')) return 'sick';
  if (TRAINING_CELL_KEYWORDS.includes(lower)) return 'training';
  if (lower.startsWith('training') || lower.startsWith('course ')) return 'training';
  return null;
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

export function isNonPersonName(text) {
  if (!text) return true;
  const lower = String(text).trim().toLowerCase();
  const words = lower.split(/\s+/);
  return words.some(w => NON_PERSON_WORDS.includes(w));
}

export function looksLikeCompanyName(text) {
  if (!text) return false;
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

export function looksLikePersonName(text) {
  if (!text) return false;
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
  if (words.length > 5) return false;
  return words.every(w => /^[A-Z]/.test(w));
}