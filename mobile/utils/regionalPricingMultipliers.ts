import type { NationalAverageBudgetSplit } from '@/utils/scopeItemQuantities';

/** Planning-only residential construction cost index by state (1.0 = US national baseline). */
export const STATE_REGIONAL_MULTIPLIERS: Record<string, number> = {
  AK: 1.3,
  AL: 0.9,
  AR: 0.88,
  AZ: 1.02,
  CA: 1.38,
  CO: 1.12,
  CT: 1.22,
  DC: 1.25,
  DE: 1.08,
  FL: 1.0,
  GA: 0.95,
  HI: 1.45,
  IA: 0.92,
  ID: 1.0,
  IL: 1.1,
  IN: 0.93,
  KS: 0.92,
  KY: 0.9,
  LA: 0.92,
  MA: 1.28,
  MD: 1.15,
  ME: 1.05,
  MI: 0.98,
  MN: 1.05,
  MO: 0.93,
  MS: 0.88,
  MT: 0.98,
  NC: 0.95,
  ND: 0.95,
  NE: 0.92,
  NH: 1.1,
  NJ: 1.25,
  NM: 0.95,
  NV: 1.05,
  NY: 1.3,
  OH: 0.95,
  OK: 0.9,
  OR: 1.15,
  PA: 1.08,
  RI: 1.15,
  SC: 0.92,
  SD: 0.9,
  TN: 0.93,
  TX: 0.95,
  UT: 1.0,
  VA: 1.05,
  VT: 1.08,
  WA: 1.18,
  WI: 0.98,
  WV: 0.88,
  WY: 0.95,
};

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};

export type RegionalPricingLocation = {
  state?: string | null;
  zipCode?: string | null;
  city?: string | null;
};

export type ResolvedRegionalPricing = {
  multiplier: number;
  stateCode: string | null;
  geographicBasis: 'national' | 'state';
  rateSourceLabel: string;
};

function roundRate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeUsStateCode(state?: string | null): string | null {
  const raw = String(state || '').trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const named = STATE_NAME_TO_CODE[raw.toLowerCase()];
  return named || null;
}

export function resolveRegionalPricingMultiplier(
  location?: RegionalPricingLocation | null
): ResolvedRegionalPricing {
  const stateCode = normalizeUsStateCode(location?.state);
  const multiplier =
    stateCode && STATE_REGIONAL_MULTIPLIERS[stateCode] != null
      ? STATE_REGIONAL_MULTIPLIERS[stateCode]
      : 1;

  if (!stateCode || multiplier === 1) {
    return {
      multiplier: 1,
      stateCode: null,
      geographicBasis: 'national',
      rateSourceLabel: 'Suggested · National Average',
    };
  }

  const multiplierLabel =
    multiplier % 1 === 0 ? `${multiplier.toFixed(0)}×` : `${multiplier.toFixed(2)}×`;

  return {
    multiplier,
    stateCode,
    geographicBasis: 'state',
    rateSourceLabel: `Suggested · ${stateCode} regional (${multiplierLabel})`,
  };
}

export function applyRegionalMultiplierToBudgetSplit(
  average: NationalAverageBudgetSplit,
  regional: ResolvedRegionalPricing
): NationalAverageBudgetSplit {
  if (regional.multiplier === 1) return average;
  const material =
    average.material != null && average.material > 0
      ? roundRate(average.material * regional.multiplier)
      : average.material;
  const labor =
    average.labor != null && average.labor > 0
      ? roundRate(average.labor * regional.multiplier)
      : average.labor;
  return {
    ...average,
    material,
    labor,
    sourceLabel: regional.rateSourceLabel.replace('Suggested · ', 'Suggested budget split · '),
    geographicBasis: regional.geographicBasis,
    regionalMultiplier: regional.multiplier,
    regionalStateCode: regional.stateCode,
  };
}
