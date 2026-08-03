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

// ---------------------------------------------------------------------------
// Fuzzy Matching — for legacy/historical data with typos & variations
// ---------------------------------------------------------------------------

// Levenshtein edit distance between two strings.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Normalised similarity score 0–1 (1 = identical, 0 = completely different)
function stringSimilarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Token-based Jaccard similarity: compares word sets (handles word order,
// missing/extra words). E.g. "John David Smith" vs "John Smith" → 0.67
function tokenSimilarity(a, b) {
  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union;
}

// Fuzzy match a staff name against a list of staff records.
// Tries exact nameKey first, then falls back to token + Levenshtein similarity.
// Returns { staff, score, method } or null if no match above threshold.
export function fuzzyFindStaff(queryName, staffList, threshold = 0.65) {
  const queryKey = nameKey(queryName);
  if (!queryKey) return null;

  let bestMatch = null;
  let bestScore = 0;
  let bestMethod = '';

  for (const s of staffList) {
    if (!s.name) continue;
    const staffKey = nameKey(s.name);
    if (!staffKey) continue;

    // Exact key match — instant winner
    if (queryKey === staffKey) return { staff: s, score: 1, method: 'exact' };

    // Token similarity (handles word order, missing/extra words)
    const tokSim = tokenSimilarity(queryKey, staffKey);
    // String similarity (handles typos within words)
    const strSim = stringSimilarity(queryKey, staffKey);
    const score = Math.max(tokSim, strSim);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = s;
      bestMethod = tokSim >= strSim ? 'token' : 'levenshtein';
    }
  }

  if (bestScore >= threshold) {
    return { staff: bestMatch, score: bestScore, method: bestMethod };
  }
  return null;
}

// Fuzzy match a job name against a list of job records.
// Jobs have more variation (site names, references, suffixes) so the threshold
// is lower and substring matching gets a bonus.
export function fuzzyFindJob(queryName, jobList, threshold = 0.55) {
  const queryKey = nameKey(queryName);
  if (!queryKey) return null;

  let bestMatch = null;
  let bestScore = 0;
  let bestMethod = '';

  for (const j of jobList) {
    if (!j.name) continue;
    const jobKey = nameKey(j.name);
    if (!jobKey) continue;

    // Exact key match
    if (queryKey === jobKey) return { job: j, score: 1, method: 'exact' };

    const tokSim = tokenSimilarity(queryKey, jobKey);
    const strSim = stringSimilarity(queryKey, jobKey);
    // Substring bonus: if one name contains the other (e.g. "Hayes" in "Hayes Coring")
    let subBonus = 0;
    if (queryKey.length >= 4 && jobKey.length >= 4) {
      if (queryKey.includes(jobKey) || jobKey.includes(queryKey)) subBonus = 0.15;
    }
    const score = Math.min(1, Math.max(tokSim, strSim) + subBonus);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = j;
      bestMethod = tokSim >= strSim ? 'token' : 'levenshtein';
    }
  }

  if (bestScore >= threshold) {
    return { job: bestMatch, score: bestScore, method: bestMethod };
  }
  return null;
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