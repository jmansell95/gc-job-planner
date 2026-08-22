/**
 * Depreciation calculation engine — supports three methods:
 *   1. straight_line      — (cost - salvage) / useful_life_years, equal each year
 *   2. reducing_balance   — book_value × rate% each year (higher early charges)
 *   3. units_of_production — (cost - salvage) / total_units × units_consumed
 *
 * Shared by the recalculateDepreciation backend function, the AssetFinancialTab
 * live-preview, and the DepreciationSchedule table so every surface shows the
 * same numbers.
 */

export type DepreciationMethod = 'straight_line' | 'reducing_balance' | 'units_of_production';

export interface DepreciationInput {
  method: DepreciationMethod;
  acquisition_cost: number;
  acquisition_date: string;      // ISO date
  salvage_value: number;
  useful_life_years: number;
  depreciation_rate?: number;   // % for reducing balance
  units_estimated_total?: number;
  units_produced_to_date?: number;
  asOfDate?: string;            // ISO date — defaults to today
}

export interface DepreciationYearRow {
  year: number;                 // 1-based year number
  year_label: string;           // e.g. "2024"
  opening_value: number;
  annual_charge: number;
  accumulated_depreciation: number;
  closing_value: number;
}

export interface DepreciationResult {
  method: DepreciationMethod;
  annual_depreciation: number;
  accumulated_depreciation: number;
  current_book_value: number;
  cost_per_unit: number;
  years_elapsed: number;
  remaining_years: number;
  is_fully_depreciated: boolean;
  schedule: DepreciationYearRow[];
  current_year_index: number;   // 0-based index into schedule
  configured: boolean;           // false when missing required inputs
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Compute the full depreciation schedule and current position for an asset.
 * Returns { configured: false } gracefully when required inputs are missing.
 */
export function calculateDepreciation(input: DepreciationInput): DepreciationResult {
  const cost = Number(input.acquisition_cost) || 0;
  const salvage = Math.max(Number(input.salvage_value) || 0, 0);
  const method = input.method || 'straight_line';
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  const acqDate = input.acquisition_date ? new Date(input.acquisition_date) : null;

  // Validate required inputs
  if (!cost || cost <= 0 || !acqDate) {
    return {
      method,
      annual_depreciation: 0,
      accumulated_depreciation: 0,
      current_book_value: 0,
      cost_per_unit: 0,
      years_elapsed: 0,
      remaining_years: 0,
      is_fully_depreciated: false,
      schedule: [],
      current_year_index: -1,
      configured: false,
    };
  }

  const yearsElapsed = (asOf.getTime() - acqDate.getTime()) / MS_PER_YEAR;
  const currentYear = asOf.getFullYear();
  const acqYear = acqDate.getFullYear();
  const totalYears = method === 'units_of_production'
    ? (input.useful_life_years || Math.ceil((input.units_estimated_total || 1) / 1000))
    : (Number(input.useful_life_years) || 0);

  let schedule: DepreciationYearRow[] = [];
  let costPerUnit = 0;

  if (method === 'straight_line') {
    if (!totalYears || totalYears <= 0) {
      return { ...emptyResult(method), configured: false };
    }
    const annualCharge = (cost - salvage) / totalYears;
    let opening = cost;
    let accumulated = 0;
    for (let y = 1; y <= totalYears; y++) {
      const charge = Math.min(annualCharge, opening - salvage);
      accumulated = Math.min(accumulated + charge, cost - salvage);
      const closing = Math.max(opening - charge, salvage);
      schedule.push({
        year: y,
        year_label: String(acqYear + y - 1),
        opening_value: round2(opening),
        annual_charge: round2(charge),
        accumulated_depreciation: round2(accumulated),
        closing_value: round2(closing),
      });
      opening = closing;
    }
    const accDep = Math.min(annualCharge * yearsElapsed, cost - salvage);
    const bookValue = Math.max(cost - accDep, salvage);
    return {
      method,
      annual_depreciation: round2(annualCharge),
      accumulated_depreciation: round2(accDep),
      current_book_value: round2(bookValue),
      cost_per_unit: 0,
      years_elapsed: round2(yearsElapsed),
      remaining_years: round2(Math.max(totalYears - yearsElapsed, 0)),
      is_fully_depreciated: bookValue <= salvage + 0.01,
      schedule,
      current_year_index: Math.min(Math.floor(yearsElapsed), schedule.length - 1),
      configured: true,
    };
  }

  if (method === 'reducing_balance') {
    const rate = (Number(input.depreciation_rate) || 0) / 100;
    if (!rate || rate <= 0) {
      return { ...emptyResult(method), configured: false };
    }
    let opening = cost;
    let accumulated = 0;
    // Build schedule until book value hits salvage (cap at 30 years for safety)
    const maxYears = totalYears || 30;
    for (let y = 1; y <= maxYears; y++) {
      let charge = opening * rate;
      // Don't depreciate below salvage
      if (opening - charge < salvage) {
        charge = opening - salvage;
      }
      accumulated += charge;
      const closing = Math.max(opening - charge, salvage);
      schedule.push({
        year: y,
        year_label: String(acqYear + y - 1),
        opening_value: round2(opening),
        annual_charge: round2(charge),
        accumulated_depreciation: round2(accumulated),
        closing_value: round2(closing),
      });
      opening = closing;
      if (opening <= salvage + 0.01) break;
    }
    // Current position: apply rate for elapsed years
    let bookValue = cost;
    let accDep = 0;
    const fullYearsElapsed = Math.floor(yearsElapsed);
    for (let y = 0; y < fullYearsElapsed && y < schedule.length; y++) {
      accDep += schedule[y].annual_charge;
      bookValue = Math.max(cost - accDep, salvage);
      if (bookValue <= salvage + 0.01) break;
    }
    const currentAnnual = bookValue > salvage ? bookValue * rate : 0;
    return {
      method,
      annual_depreciation: round2(currentAnnual),
      accumulated_depreciation: round2(accDep),
      current_book_value: round2(bookValue),
      cost_per_unit: 0,
      years_elapsed: round2(yearsElapsed),
      remaining_years: schedule.length > 0 ? round2(Math.max(schedule.length - yearsElapsed, 0)) : 0,
      is_fully_depreciated: bookValue <= salvage + 0.01,
      schedule,
      current_year_index: Math.min(fullYearsElapsed, schedule.length - 1),
      configured: true,
    };
  }

  // units_of_production
  const totalUnits = Number(input.units_estimated_total) || 0;
  const unitsToDate = Number(input.units_produced_to_date) || 0;
  if (!totalUnits || totalUnits <= 0) {
    return { ...emptyResult(method), configured: false };
  }
  costPerUnit = (cost - salvage) / totalUnits;
  const accDep = Math.min(costPerUnit * unitsToDate, cost - salvage);
  const bookValue = Math.max(cost - accDep, salvage);
  // Build a schedule based on useful life years for display (each year assumes
  // equal unit consumption = total / years)
  const displayYears = totalYears || Math.ceil(totalUnits / 1000);
  let opening = cost;
  let accumulated = 0;
  const annualUnits = totalUnits / displayYears;
  for (let y = 1; y <= displayYears; y++) {
    const charge = Math.min(costPerUnit * annualUnits, opening - salvage);
    accumulated += charge;
    const closing = Math.max(opening - charge, salvage);
    schedule.push({
      year: y,
      year_label: String(acqYear + y - 1),
      opening_value: round2(opening),
      annual_charge: round2(charge),
      accumulated_depreciation: round2(accumulated),
      closing_value: round2(closing),
    });
    opening = closing;
  }
  return {
    method,
    annual_depreciation: round2(costPerUnit * annualUnits),
    accumulated_depreciation: round2(accDep),
    current_book_value: round2(bookValue),
    cost_per_unit: round2(costPerUnit),
    years_elapsed: round2(yearsElapsed),
    remaining_years: round2(Math.max(displayYears - yearsElapsed, 0)),
    is_fully_depreciated: bookValue <= salvage + 0.01,
    schedule,
    current_year_index: Math.min(Math.floor(yearsElapsed), schedule.length - 1),
    configured: true,
  };
}

function emptyResult(method: DepreciationMethod): Omit<DepreciationResult, 'method'> {
  return {
    annual_depreciation: 0,
    accumulated_depreciation: 0,
    current_book_value: 0,
    cost_per_unit: 0,
    years_elapsed: 0,
    remaining_years: 0,
    is_fully_depreciated: false,
    schedule: [],
    current_year_index: -1,
    configured: false,
  };
}

export const METHOD_META: Record<DepreciationMethod, { label: string; short: string; description: string }> = {
  straight_line: {
    label: 'Straight-Line',
    short: 'SL',
    description: 'Equal annual charge over useful life. (Cost − Salvage) ÷ Years.',
  },
  reducing_balance: {
    label: 'Reducing Balance',
    short: 'RB',
    description: 'Fixed % of remaining book value each year. Higher charges early on.',
  },
  units_of_production: {
    label: 'Units of Production',
    short: 'UoP',
    description: 'Charge per unit of usage (hours, metres) against estimated total. Depreciates with usage, not time.',
  },
};