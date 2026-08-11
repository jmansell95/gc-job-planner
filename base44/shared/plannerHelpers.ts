// Planner helper functions — extracted from importPlannerSpreadsheet to keep
// the entry file under the line limit.

import { normalizeName, nameKey } from './entityRegistry.ts';
import { looksLikeCompanyName } from './spreadsheetParser.ts';
import {
  SUBCONTRACTOR_PATTERNS, KNOWN_AGENCY_NAMES, DEPOT_ALIASES,
  YARD_DEPOT_EXACT_TEXTS, NON_WORK_SECTION_KEYWORDS, DEPOT_TEAM_NAME,
} from './plannerConstants.ts';

export function isSubcontractor(name) {
  const lower = normalizeName(name).toLowerCase();
  if (SUBCONTRACTOR_PATTERNS.some(p => lower.includes(p))) return true;
  return looksLikeCompanyName(name);
}

export function isAgencySection(name) {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase();
  if (lower.includes('agency')) return true;
  return KNOWN_AGENCY_NAMES.some(a => lower.includes(a));
}

export function extractAgencyNameFromSection(sectionName) {
  if (!sectionName) return '';
  const lower = normalizeName(sectionName).toLowerCase();
  for (const agency of KNOWN_AGENCY_NAMES) {
    if (lower.includes(agency)) {
      return agency.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return '';
}

export function isDepotSection(name) {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase();
  return DEPOT_ALIASES.some(a => lower === a || lower.includes(a));
}

export function isYardDepotText(text) {
  if (!text) return false;
  const lower = normalizeName(text).toLowerCase().trim();
  return YARD_DEPOT_EXACT_TEXTS.includes(lower);
}

export function isNonWorkSection(name) {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase().trim();
  return NON_WORK_SECTION_KEYWORDS.some(kw => lower === kw || lower.includes(kw));
}

export function normalizeSection(section) {
  if (!section) return section;
  if (isNonWorkSection(section)) return '';
  if (isDepotSection(section)) return DEPOT_TEAM_NAME;
  return section;
}