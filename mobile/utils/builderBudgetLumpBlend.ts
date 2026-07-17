/**
 * Nationwide builder-budget lump blending for Confirm Scope packages.
 *
 * Local SHV / Silver Leaf installed packages are a barometer reading (not a
 * Utah-only price book). Blend 60% barometer + 40% national package, then
 * scale by the job state's regional multiplier.
 */

import {
  BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT,
  BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT,
} from '@/utils/southernUtahCalibratedRates';
import {
  resolveRegionalPricingMultiplier,
  type RegionalPricingLocation,
} from '@/utils/regionalPricingMultipliers';

export type BlendedLumpResult = {
  /** Pre-state blended total (60/40). */
  blendedBase: number;
  /** Final suggested total after state multiplier. */
  total: number;
  multiplier: number;
  stateCode: string | null;
  rateSourceLabel: string;
  blendHelper: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 60% local barometer package + 40% national package anchor. */
export function blendBarometerLump(localInstalled: number, nationalPackage: number): number {
  return round2(
    localInstalled * BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT +
      nationalPackage * BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT
  );
}

/** Scale a blended (or national) lump by the job state's regional multiplier. */
export function scaleLumpForState(
  total: number,
  location?: RegionalPricingLocation | null
): { total: number; multiplier: number; stateCode: string | null } {
  const regional = resolveRegionalPricingMultiplier(location);
  if (regional.multiplier === 1) {
    return { total: round2(total), multiplier: 1, stateCode: regional.stateCode };
  }
  return {
    total: round2(total * regional.multiplier),
    multiplier: regional.multiplier,
    stateCode: regional.stateCode,
  };
}

/**
 * Full lump path: blend barometer with national, then × state.
 * `barometerLabel` is e.g. "Plan 41" or "detached mid".
 */
export function resolveBlendedLump(params: {
  local: number;
  national: number;
  barometerLabel: string;
  state?: string | null;
  zipCode?: string | null;
  city?: string | null;
  scopeNoun?: string;
}): BlendedLumpResult {
  const blendedBase = blendBarometerLump(params.local, params.national);
  const scaled = scaleLumpForState(blendedBase, {
    state: params.state,
    zipCode: params.zipCode,
    city: params.city,
  });
  const noun = params.scopeNoun || 'package';
  const stateSuffix = scaled.stateCode && scaled.multiplier !== 1 ? ` · ${scaled.stateCode}` : '';
  return {
    blendedBase,
    total: scaled.total,
    multiplier: scaled.multiplier,
    stateCode: scaled.stateCode,
    rateSourceLabel: `Blended national + barometer · ${params.barometerLabel}${stateSuffix}`,
    blendHelper: `60% ${params.barometerLabel} ${noun} ($${params.local.toLocaleString()}) + 40% national ($${params.national.toLocaleString()})${
      scaled.multiplier !== 1 && scaled.stateCode
        ? ` · ${scaled.stateCode} regional ${scaled.multiplier.toFixed(2)}×`
        : ''
    }.`,
  };
}

/** Scale material + labor keeping their ratio (for packages that already split). */
export function scaleSplitLumpForState(
  material: number,
  labor: number,
  location?: RegionalPricingLocation | null
): { material: number; labor: number; total: number; multiplier: number; stateCode: string | null } {
  const baseTotal = material + labor;
  const scaled = scaleLumpForState(baseTotal, location);
  if (!(baseTotal > 0) || scaled.multiplier === 1) {
    return {
      material: round2(material),
      labor: round2(labor),
      total: round2(baseTotal),
      multiplier: scaled.multiplier,
      stateCode: scaled.stateCode,
    };
  }
  return {
    material: round2(material * scaled.multiplier),
    labor: round2(labor * scaled.multiplier),
    total: scaled.total,
    multiplier: scaled.multiplier,
    stateCode: scaled.stateCode,
  };
}
