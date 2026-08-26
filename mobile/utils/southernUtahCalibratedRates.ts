/**
 * Builder-budget barometer for national average unit rates.
 *
 * Local evidence (barometer only — not a market-locked price book):
 * SHV Lots 39 / 41 / 49 / 58 Iron Mesa preliminary budgets (detached median).
 * Silver Leaf twin-home scopes stay in the stage benchmark dataset but are
 * excluded from detached medians (same policy as southern_utah_residential_benchmark_v1).
 *
 * Method:
 * 1. Reverse-engineer installed $/unit from each lot's bid line ÷ planning qty.
 * 2. Take the 4-lot detached median as the barometer reading.
 * 3. Blend with national mat+labor at 60% barometer / 40% national when we have
 *    four detached samples (same weight policy as the stage benchmark dataset).
 *    Still applied nationwide — not a Utah-only price book.
 * 4. Split blended totals into material/labor using the national ratio.
 * 5. Apply state regional multipliers on top of this nationwide baseline.
 */

import type { NationalAverageBudgetSplit } from '@/utils/scopeItemQuantities';

/** Barometer weight with 4+ detached bid samples — pulls hard when national overstates. */
export const BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT = 0.6;
export const BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT = 0.4;
export const BUILDER_BUDGET_BAROMETER_SAMPLE_COUNT = 4;

/** @deprecated Use BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT */
export const SOUTHERN_UTAH_LOCAL_WEIGHT = BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT;
/** @deprecated Use BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT */
export const SOUTHERN_UTAH_NATIONAL_WEIGHT = BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT;
/** @deprecated Use BUILDER_BUDGET_BAROMETER_SAMPLE_COUNT */
export const SOUTHERN_UTAH_SAMPLE_COUNT = BUILDER_BUDGET_BAROMETER_SAMPLE_COUNT;

export type CalibratedUnitRateKey =
  | 'excavation:cy'
  | 'concrete:cy'
  | 'foundation:cy'
  | 'shingles_roofing:squares'
  | 'roofing:squares'
  | 'framing:sqft'
  | 'drywall:sqft'
  | 'cabinets:lf'
  | 'countertops:sqft'
  | 'flooring:sqft'
  | 'tile_flooring:sqft'
  | 'hvac:each'
  | 'hvac:sqft'
  | 'insulation:sqft'
  | 'stucco:sqft'
  | 'windows_doors:each'
  | 'windows_doors:sqft'
  | 'windows:each'
  | 'windows:sqft'
  | 'exterior_doors:each'
  | 'sliding_doors:each'
  | 'plumbing_rough:sqft'
  | 'electrical_rough:sqft';

/** Detached median installed $/unit before national blend (documentation / tests). */
export const SOUTHERN_UTAH_LOCAL_INSTALLED_UNIT_RATES: Record<
  CalibratedUnitRateKey,
  { unit: string; installed: number; note: string }
> = {
  'excavation:cy': {
    unit: 'cy',
    installed: 22.7,
    note: 'Excav/backfill bid ÷ planning trench+pad CY (Lots 39/41/49/58)',
  },
  'concrete:cy': {
    unit: 'cy',
    installed: 321.76,
    note: 'Foundation walls + slabs + garage floor ÷ planning foundation CY',
  },
  'foundation:cy': {
    unit: 'cy',
    installed: 321.76,
    note: 'Alias of concrete:cy',
  },
  'shingles_roofing:squares': {
    unit: 'squares',
    installed: 395.13,
    note: 'Roofing bid ÷ planning roof squares (footprint × pitch + waste)',
  },
  'roofing:squares': {
    unit: 'squares',
    installed: 395.13,
    note: 'Alias of shingles_roofing:squares',
  },
  'framing:sqft': {
    unit: 'sqft',
    // Detached median on covered framed SF (living + garage): mat+lab ≈ $15.81/SF.
    installed: 15.81,
    note: 'Lumber + trusses + framing labor ÷ covered framed SF (living + garage)',
  },
  'drywall:sqft': {
    unit: 'sqft',
    installed: 2.21,
    note: 'Drywall bid ÷ (living SF × 3.5 surface fallback)',
  },
  // Interior paint uses installed lump-sum comparables (southernUtahPaintTrimComparables).
  // Do not reverse-engineer a surface-SF barometer or invent material/labor splits.
  'cabinets:lf': {
    unit: 'lf',
    installed: 216.15,
    note: 'Cabinet bid ÷ (living SF / 25) planning LF',
  },
  'countertops:sqft': {
    unit: 'sqft',
    installed: 151.88,
    note: 'Countertop bid ÷ 80 SF typical kitchen tops',
  },
  'flooring:sqft': {
    unit: 'sqft',
    installed: 8.29,
    note: 'Flooring allowance ÷ living SF (Lots 39/41/49/58 detached median)',
  },
  'tile_flooring:sqft': {
    unit: 'sqft',
    installed: 8.29,
    note: 'Alias of flooring:sqft',
  },
  'hvac:each': {
    unit: 'each',
    // Retained as a Utah builder-budget reference; national HVAC pricing is
    // resolved by the production package model before this rate is considered.
    installed: 18500,
    note: 'Detached HVAC package mid (Plan 39/58 H64 band)',
  },
  'hvac:sqft': {
    unit: 'sqft',
    installed: 6.05,
    note: 'Detached median HVAC ÷ living SF',
  },
  'insulation:sqft': {
    unit: 'sqft',
    // Detached median ÷ thermal envelope (exterior walls + attic − openings), not drywall ×3.5.
    installed: 1.32,
    note: 'Detached median insulation ÷ thermal-envelope SF (walls + attic − openings)',
  },
  'stucco:sqft': {
    unit: 'sqft',
    installed: 7.76,
    note: 'Stucco bid ÷ planning exterior wall SF (Lots 39/41/49/58)',
  },
  'windows_doors:each': {
    unit: 'each',
    installed: 750,
    note: 'Legacy alias — Windows bid ÷ ~16 openings planning count',
  },
  'windows_doors:sqft': {
    unit: 'sqft',
    installed: 4.09,
    note: 'Legacy alias — Windows bid ÷ living SF',
  },
  'windows:each': {
    unit: 'each',
    installed: 750,
    note: 'H34 Windows bid ÷ ~16 openings planning count',
  },
  'windows:sqft': {
    unit: 'sqft',
    installed: 4.09,
    note: 'H34 Windows bid ÷ living SF (planning when count missing)',
  },
  'exterior_doors:each': {
    unit: 'each',
    installed: 3000,
    note: 'SHV exterior + iron entry package mid ≈ $6,000 ÷ ~2 doors planning',
  },
  'sliding_doors:each': {
    unit: 'each',
    installed: 4000,
    note: 'SHV sliding mid (~$7.3k package) ÷ ~2 units, or ~$4k one mid slider',
  },
  'plumbing_rough:sqft': {
    unit: 'sqft',
    installed: 7.62,
    note: 'Plumbing rough bid ÷ living SF (planning when points missing)',
  },
  'electrical_rough:sqft': {
    unit: 'sqft',
    installed: 7.62,
    note: 'Electrical rough bid ÷ living SF (planning when device count missing)',
  },
};

/**
 * Framing keeps explicit local mat vs labor from bid lines (not national ratio).
 * Basis: covered framed SF = living + garage (patio/deck excluded until confirmed in shell).
 * Lot 41 example: labor $19,500 ÷ 2,873 SF ≈ $6.79/framed SF (competitive in the $5–$10 band).
 */
const FRAMING_LOCAL_MAT_PER_FRAMED_SF = 9.49; // lumber + trusses
const FRAMING_LOCAL_LAB_PER_FRAMED_SF = 6.32;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function blendInstalled(localInstalled: number, nationalTotal: number): number {
  return (
    localInstalled * BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT +
    nationalTotal * BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT
  );
}

function splitByNationalRatio(
  blendedTotal: number,
  national: Pick<NationalAverageBudgetSplit, 'material' | 'labor'>
): { material: number; labor: number } {
  const nationalTotal = national.material + national.labor;
  if (!(nationalTotal > 0)) {
    return { material: round2(blendedTotal), labor: 0 };
  }
  return {
    material: round2(blendedTotal * (national.material / nationalTotal)),
    labor: round2(blendedTotal * (national.labor / nationalTotal)),
  };
}

function calibrationKey(itemId: string, unit: string | null | undefined): CalibratedUnitRateKey | null {
  const id = String(itemId || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const u = String(unit || '')
    .trim()
    .toLowerCase();
  const normalizedUnit =
    u === 'sq' || u === 'square' ? 'squares' : u === 'sf' || u === 'sq.ft' ? 'sqft' : u;

  const candidates: CalibratedUnitRateKey[] = [
    `${id}:${normalizedUnit}` as CalibratedUnitRateKey,
  ];
  if (id === 'foundation' || id === 'pour_foundation') {
    candidates.push('concrete:cy', 'foundation:cy');
  }
  if (id === 'roofing' || id === 'roof_tie_in') {
    candidates.push('shingles_roofing:squares', 'roofing:squares');
  }
  if (id === 'tile_flooring' || id === 'flooring') {
    candidates.push('flooring:sqft', 'tile_flooring:sqft');
  }

  for (const key of candidates) {
    if (SOUTHERN_UTAH_LOCAL_INSTALLED_UNIT_RATES[key]) return key;
  }
  return null;
}

/**
 * @deprecated Barometer rates apply nationwide; market gating is no longer used.
 * Kept for tests/docs that still name the evidence geography.
 */
export function isSouthernUtahCalibrationMarket(_location?: {
  state?: string | null;
  zipCode?: string | null;
  city?: string | null;
} | null): boolean {
  return true;
}

/**
 * Nudge national mat/labor unit rates with the builder-budget barometer.
 * Returns null when this item/unit has no barometer evidence.
 */
export function applySouthernUtahCalibration(
  itemId: string,
  unit: string | null | undefined,
  national: NationalAverageBudgetSplit
): NationalAverageBudgetSplit | null {
  const key = calibrationKey(itemId, unit || national.unit);
  if (!key) return null;

  const local = SOUTHERN_UTAH_LOCAL_INSTALLED_UNIT_RATES[key];
  if (!local) return null;

  let material: number;
  let labor: number;

  if (key === 'framing:sqft') {
    material = round2(
      blendInstalled(FRAMING_LOCAL_MAT_PER_FRAMED_SF, national.material)
    );
    labor = round2(blendInstalled(FRAMING_LOCAL_LAB_PER_FRAMED_SF, national.labor));
  } else {
    // Roofing is a verified takeoff-based line, and the current SHV roofing
    // barometer is materially below the national new-construction rate. Keep
    // it modestly national-led so planning does not understate the roof.
    const blended =
      key === 'roofing:squares' || key === 'shingles_roofing:squares'
        ? local.installed * 0.5 + (national.material + national.labor) * 0.5
        : blendInstalled(local.installed, national.material + national.labor);
    const split = splitByNationalRatio(blended, national);
    material = split.material;
    labor = split.labor;
  }

  return {
    ...national,
    unit: local.unit || national.unit,
    material,
    labor,
    sourceLabel: 'Suggested · National Average (builder-budget calibrated)',
    rateSource: 'bps_southern_utah_calibrated',
    rateSourceReference:
      key === 'roofing:squares' || key === 'shingles_roofing:squares'
        ? 'Roofing uses a modest 50/50 blend of national new-construction rate and SHV Lots 39/41/49/58 barometer; state multipliers still apply'
        : 'National unit rates blended 60/40 with SHV Lots 39/41/49/58 detached medians (barometer); state multipliers still apply',
    geographicBasis: 'national',
  };
}

/** Alias for clarity at call sites. */
export const applyBuilderBudgetBarometer = applySouthernUtahCalibration;

/**
 * Soft-cost allowances for ground-up Confirm Scope (flat $ / job).
 * Evidence: SHV Iron Mesa Lots 39/41/49/58 + Silver Leaf fee schedules.
 * These are planning allowances — jurisdiction fees still need verification.
 */
export const BUILDER_BUDGET_SOFT_COST_ALLOWANCES: Record<
  string,
  { amount: number; note: string; sourceLabel: string }
> = {
  plans_engineering: {
    // Lot 41 / SL detail: Architectural Plan Design $3,000 (eng often separate ~$750).
    amount: 3000,
    note: 'Architectural plan design from SHV detached budgets (~$3,000). Engineering / soils often separate.',
    sourceLabel: 'Suggested · National Average (builder-budget calibrated)',
  },
  permits: {
    // Lot 41 Permits & Fees / city impact $32,000; detached median city impact $35,000.
    // Excludes water/sewer/fire impact add-ons (Silver Leaf itemizes those separately).
    amount: 32000,
    note:
      'Inclusive of city impact fee (not permit-only). Varies widely by state/jurisdiction — confirm locally. Water/sewer/fire impact often extra.',
    sourceLabel: 'Suggested · National Average (builder-budget calibrated)',
  },
};

export function getBuilderBudgetSoftCostAllowance(
  itemId: string,
  templateKey?: string | null
): { amount: number; note: string; sourceLabel: string } | null {
  if (String(templateKey || '').toLowerCase() !== 'ground_up') return null;
  const id = String(itemId || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return BUILDER_BUDGET_SOFT_COST_ALLOWANCES[id] || null;
}
