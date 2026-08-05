// ============================================================
// vinDecoder — shared VIN WMI (World Manufacturer Identifier)
// decoding logic. Used by syncGeotabFleet and syncVehicleSpecs
// to validate / fallback-derive vehicle make and year.
// ============================================================

// VIN World Manufacturer Identifier (WMI) codes — the first 3 characters
// of the VIN identify the manufacturer globally.
// Note: LRW is used by BOTH Land Rover AND Tesla (Shanghai factory), so
// it's marked as ambiguous — the LLM should resolve it.
export const WMI_TO_MAKE: Record<string, string> = {
  // Land Rover / Jaguar
  'LRV': 'Land Rover', 'LRU': 'Land Rover', 'LRT': 'Land Rover',
  'SAJ': 'Jaguar', 'SAL': 'Land Rover',
  // Ford
  'WF0': 'Ford', 'WF1': 'Ford', '1FA': 'Ford', 'WFO': 'Ford',
  // Vauxhall / Opel (GM) — W0V is used for both; UK market = Vauxhall
  'W0V': 'Vauxhall', 'W0L': 'Opel', 'WOL': 'Opel', 'VX1': 'Vauxhall',
  // Mercedes-Benz
  'WDB': 'Mercedes-Benz', 'WDC': 'Mercedes-Benz', 'WDD': 'Mercedes-Benz', 'WDF': 'Mercedes-Benz',
  // BMW
  'WBA': 'BMW', 'WBS': 'BMW', 'WBW': 'BMW',
  // Volkswagen
  'WVW': 'Volkswagen', 'WV1': 'Volkswagen', 'WV2': 'Volkswagen',
  // Audi
  'WAU': 'Audi', 'WAV': 'Audi', 'WUA': 'Audi',
  // Volvo
  'YV1': 'Volvo', 'YV4': 'Volvo', '4V1': 'Volvo',
  // Peugeot / Citroen / Renault
  'VF3': 'Peugeot', 'VF7': 'Citroen', 'VF6': 'Renault', 'VF1': 'Renault',
  // Iveco
  'ZC1': 'Iveco', 'ZC2': 'Iveco', 'ZC3': 'Iveco',
  // Nissan
  'SJN': 'Nissan', 'JN1': 'Nissan',
  // Toyota
  'JTN': 'Toyota', 'JTD': 'Toyota', 'NMT': 'Toyota',
  // LDV
  'LDV': 'LDV',
  // MAN
  'WMA': 'MAN', 'WMK': 'MAN',
  // Scania
  'XTS': 'Scania',
  // DAF
  'SDB': 'DAF',
  // Renault Trucks
  'VFV': 'Renault Trucks',
  // Tesla — 5YJ (US), 7SA (Berlin), LRW (Shanghai, ambiguous with Land Rover)
  '5YJ': 'Tesla', '7SA': 'Tesla',
};

// WMIs that are ambiguous (used by multiple manufacturers). The LLM should
// resolve these — don't trust the WMI table alone for these.
export const AMBIGUOUS_WMIS = new Set(['LRW']);

// VIN model year codes (10th character). Standardised globally by ISO 3779.
const VIN_YEAR_CODES: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
  T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
  1: 2031, 2: 2032, 3: 2033, 4: 2034, 5: 2035, 6: 2036, 7: 2037, 8: 2038, 9: 2039, 0: 2040,
};

export function decodeVin(vin: string): { make?: string; year?: number; wmi?: string } {
  if (!vin || vin.length < 10) return {};
  const wmi = vin.slice(0, 3).toUpperCase();
  const yearChar = vin.slice(9, 10).toUpperCase();
  return {
    wmi,
    make: WMI_TO_MAKE[wmi],
    year: VIN_YEAR_CODES[yearChar],
  };
}

/**
 * Validates an LLM-looked-up make against the VIN WMI. Returns the make
 * that should be trusted:
 * - If the VIN WMI is unambiguous and disagrees with the LLM make, the
 *   VIN WMI make wins (the LLM web search is unreliable for UK plates and
 *   frequently returns "Tesla" for non-Tesla vehicles).
 * - If the VIN WMI is ambiguous (e.g. LRW = Land Rover or Tesla), the LLM
 *   make wins.
 * - If the VIN WMI is unknown, the LLM make wins.
 * - If they agree, either is fine.
 *
 * Also returns whether the model should be trusted — if the make was
 * corrected from the LLM value, the model is likely wrong too and should
 * be discarded.
 */
export function validateMakeAgainstVin(
  llmMake: string | null,
  vin: string | null,
): { make: string | null; trustModel: boolean } {
  const decoded = decodeVin(vin || '');
  const vinMake = decoded.wmi ? WMI_TO_MAKE[decoded.wmi] : undefined;
  const isAmbiguous = decoded.wmi ? AMBIGUOUS_WMIS.has(decoded.wmi) : false;

  // No VIN or unknown WMI → trust LLM
  if (!vinMake) return { make: llmMake, trustModel: true };
  // Ambiguous WMI → trust LLM
  if (isAmbiguous) return { make: llmMake || vinMake, trustModel: true };
  // Unambiguous WMI and LLM disagrees → trust VIN, discard model
  if (llmMake && vinMake.toLowerCase() !== llmMake.toLowerCase()) {
    return { make: vinMake, trustModel: false };
  }
  // Agreement → trust either
  return { make: vinMake, trustModel: true };
}