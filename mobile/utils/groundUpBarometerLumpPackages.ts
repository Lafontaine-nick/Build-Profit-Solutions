/**
 * Ground-up Confirm Scope installed lump packages from SHV H-lines:
 * stucco (H33), insulation (H40), plumbing rough (H60), electrical rough (H65),
 * flooring (H51), exterior paint (national planning anchor).
 *
 * Blends 60% SHV barometer + 40% size-adjusted NAHB / national, then × state.
 * Use when takeoff is missing or notes-derived SF would overstate unit-rate pricing.
 */

import {
  resolveBlendedLump,
  scaleNationalPackageByLivingSf,
} from '@/utils/builderBudgetLumpBlend';
import { splitInstalledPackageByMaterialShare } from '@/utils/groundUpFinishPackages';
import {
  matchSouthernUtahProjectByLivingSf,
  type SouthernUtahProjectId,
} from '@/utils/southernUtahPaintTrimComparables';

export type GroundUpBarometerLumpFill = {
  material: number;
  labor: number;
  total: number;
  rateSourceLabel: string;
  helper: string;
  comparisonRange: { low: number; high: number };
  projectId: SouthernUtahProjectId | null;
};

/** H33 — Stucco, masonry & siding (installed lump / allowance). */
export const STUCCO_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 12720,
  lot39: 29300,
  lot41: 25000,
  lot49: 27000,
  lot58: 29000,
};
export const STUCCO_DETACHED_MEDIAN_TOTAL = 28000;
export const STUCCO_ALL_PROJECT_RANGE = { low: 25000, high: 29300 } as const;
/** National $9/SF × ~1.05× living at Plan 41 reference. */
export const STUCCO_NATIONAL_REFERENCE_TOTAL = 17757;

/** H60 — Plumbing rough & labor. */
export const PLUMBING_ROUGH_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 6842.5,
  lot39: 22500,
  lot41: 16500,
  lot49: 20500,
  lot58: 23500,
};
export const PLUMBING_ROUGH_DETACHED_MEDIAN_TOTAL = 21500;
export const PLUMBING_ROUGH_ALL_PROJECT_RANGE = { low: 16500, high: 23500 } as const;
export const PLUMBING_ROUGH_NATIONAL_REFERENCE_TOTAL = 18000;

/** H65 — Electrical rough & labor. */
export const ELECTRICAL_ROUGH_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 10545,
  lot39: 22500,
  lot41: 15500,
  lot49: 20500,
  lot58: 24500,
};
export const ELECTRICAL_ROUGH_DETACHED_MEDIAN_TOTAL = 21500;
export const ELECTRICAL_ROUGH_ALL_PROJECT_RANGE = { low: 15500, high: 24500 } as const;
export const ELECTRICAL_ROUGH_NATIONAL_REFERENCE_TOTAL = 18000;

/** H40 — Insulation (thermal envelope installed lump). */
export const INSULATION_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 4000,
  lot39: 7500,
  lot41: 5500,
  lot49: 6500,
  lot58: 7800,
};
export const INSULATION_DETACHED_MEDIAN_TOTAL = 7000;
export const INSULATION_ALL_PROJECT_RANGE = { low: 5500, high: 7800 } as const;
/** ~$3/SF national × Plan 41-class thermal envelope (~3,516 SF). */
export const INSULATION_NATIONAL_REFERENCE_TOTAL = 10548;

/** Exterior paint — no SHV line; national mid-market package anchor. */
export const EXTERIOR_PAINT_NATIONAL_REFERENCE_TOTAL = 9000;
export const EXTERIOR_PAINT_ALL_PROJECT_RANGE = { low: 6500, high: 14000 } as const;

/** H51 — LVP / hard flooring allowance (mixed-finish planning lump, not 100% tile). */
export const FLOORING_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 6184,
  lot39: 25800,
  lot41: 15500,
  lot49: 21500,
  lot58: 25500,
};
export const FLOORING_DETACHED_MEDIAN_TOTAL = 23500;
export const FLOORING_ALL_PROJECT_RANGE = { low: 15500, high: 25800 } as const;
/** Generic national flooring ~$9/SF × Plan 41 living SF (not full tile $16/SF). */
export const FLOORING_NATIONAL_REFERENCE_TOTAL = 16911;

const STUCCO_MATERIAL_SHARE = 0.39; // national 3.5 / 9
const MEP_ROUGH_MATERIAL_SHARE = 0.3; // national plumbing/electrical rough mat share
const INSULATION_MATERIAL_SHARE = 0.42; // national 1.25 / 3
const EXTERIOR_PAINT_MATERIAL_SHARE = 0.29; // national 0.9 / 3.15
const FLOORING_MATERIAL_SHARE = 4 / 9; // national flooring mat / (mat+labor)

function resolveProjectLump(params: {
  livingSf?: number | null;
  state?: string | null;
  byProject: Record<SouthernUtahProjectId, number>;
  median: number;
  nationalBase: number;
  range: { low: number; high: number };
  scopeNoun: string;
  materialShare: number;
}): GroundUpBarometerLumpFill {
  const project = matchSouthernUtahProjectByLivingSf(params.livingSf);
  const local = project ? params.byProject[project.id] : params.median;
  const national = scaleNationalPackageByLivingSf(params.nationalBase, params.livingSf);
  const barometerLabel = project ? project.label : 'detached mid';
  const blended = resolveBlendedLump({
    local,
    national,
    barometerLabel,
    state: params.state,
    scopeNoun: params.scopeNoun,
  });
  const split = splitInstalledPackageByMaterialShare(blended.total, params.materialShare);
  return {
    ...split,
    rateSourceLabel: blended.rateSourceLabel,
    helper: `${blended.blendHelper} Installed house allowance until trade takeoff is verified.`,
    comparisonRange: { ...params.range },
    projectId: project?.id ?? null,
  };
}

export function resolveStuccoLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): GroundUpBarometerLumpFill {
  return resolveProjectLump({
    ...params,
    byProject: STUCCO_INSTALLED_BY_PROJECT,
    median: STUCCO_DETACHED_MEDIAN_TOTAL,
    nationalBase: STUCCO_NATIONAL_REFERENCE_TOTAL,
    range: STUCCO_ALL_PROJECT_RANGE,
    scopeNoun: 'stucco / exterior cladding',
    materialShare: STUCCO_MATERIAL_SHARE,
  });
}

export function resolvePlumbingRoughLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): GroundUpBarometerLumpFill {
  return resolveProjectLump({
    ...params,
    byProject: PLUMBING_ROUGH_INSTALLED_BY_PROJECT,
    median: PLUMBING_ROUGH_DETACHED_MEDIAN_TOTAL,
    nationalBase: PLUMBING_ROUGH_NATIONAL_REFERENCE_TOTAL,
    range: PLUMBING_ROUGH_ALL_PROJECT_RANGE,
    scopeNoun: 'plumbing rough-in',
    materialShare: MEP_ROUGH_MATERIAL_SHARE,
  });
}

export function resolveElectricalRoughLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): GroundUpBarometerLumpFill {
  return resolveProjectLump({
    ...params,
    byProject: ELECTRICAL_ROUGH_INSTALLED_BY_PROJECT,
    median: ELECTRICAL_ROUGH_DETACHED_MEDIAN_TOTAL,
    nationalBase: ELECTRICAL_ROUGH_NATIONAL_REFERENCE_TOTAL,
    range: ELECTRICAL_ROUGH_ALL_PROJECT_RANGE,
    scopeNoun: 'electrical rough-in',
    materialShare: MEP_ROUGH_MATERIAL_SHARE,
  });
}

export function resolveInsulationLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): GroundUpBarometerLumpFill {
  return resolveProjectLump({
    ...params,
    byProject: INSULATION_INSTALLED_BY_PROJECT,
    median: INSULATION_DETACHED_MEDIAN_TOTAL,
    nationalBase: INSULATION_NATIONAL_REFERENCE_TOTAL,
    range: INSULATION_ALL_PROJECT_RANGE,
    scopeNoun: 'insulation',
    materialShare: INSULATION_MATERIAL_SHARE,
  });
}

export function resolveExteriorPaintLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): GroundUpBarometerLumpFill {
  const national = scaleNationalPackageByLivingSf(
    EXTERIOR_PAINT_NATIONAL_REFERENCE_TOTAL,
    params.livingSf
  );
  const blended = resolveBlendedLump({
    local: national,
    national,
    barometerLabel: 'national mid',
    state: params.state,
    scopeNoun: 'exterior paint',
  });
  const split = splitInstalledPackageByMaterialShare(blended.total, EXTERIOR_PAINT_MATERIAL_SHARE);
  return {
    ...split,
    rateSourceLabel: blended.rateSourceLabel,
    helper:
      `${blended.blendHelper} No separate SHV exterior-paint line — national planning package scaled to living SF. Stucco substrate is on the stucco line.`,
    comparisonRange: { ...EXTERIOR_PAINT_ALL_PROJECT_RANGE },
    projectId: matchSouthernUtahProjectByLivingSf(params.livingSf)?.id ?? null,
  };
}

export function resolveFlooringLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): GroundUpBarometerLumpFill {
  const fill = resolveProjectLump({
    ...params,
    byProject: FLOORING_INSTALLED_BY_PROJECT,
    median: FLOORING_DETACHED_MEDIAN_TOTAL,
    nationalBase: FLOORING_NATIONAL_REFERENCE_TOTAL,
    range: FLOORING_ALL_PROJECT_RANGE,
    scopeNoun: 'LVP / hard flooring',
    materialShare: FLOORING_MATERIAL_SHARE,
  });
  return {
    ...fill,
    helper: `${fill.helper} Mixed-finish house allowance (LVP/tile/carpet) — not 100% tile at $/SF on all living SF.`,
  };
}

/**
 * Whole-house floor SF from the plan is a finish-allocation proxy — use H51 lump,
 * not tile $/SF on every living SF. Partial product takeoffs (e.g. 1,200 SF tile) stay per-SF.
 */
export function flooringUsesBarometerLumpPackage(params: {
  itemId: string;
  livingSf?: number | null;
  floorQuantity?: number | null;
  flooringSqft?: number | null;
  flooringTileSqft?: number | null;
  quantitySource?: string | null;
}): boolean {
  const living = Number(params.livingSf);
  const qty = Number(params.floorQuantity);
  if (!(Number.isFinite(living) && living > 0)) return true;
  if (!(Number.isFinite(qty) && qty > 0)) return true;

  const flooringSf = Number(params.flooringSqft);
  const tileSf = Number(params.flooringTileSqft);
  const matchesLiving = Math.abs(qty - living) < 0.51;
  const matchesFlooring =
    Number.isFinite(flooringSf) && flooringSf > 0 && Math.abs(qty - flooringSf) < 0.51;
  if (!matchesLiving && !matchesFlooring) {
    return false;
  }

  if (
    params.itemId === 'tile_flooring' &&
    params.quantitySource === 'user_entered' &&
    Number.isFinite(tileSf) &&
    tileSf > 0 &&
    Math.abs(tileSf - qty) < 0.51 &&
    Math.abs(tileSf - living) >= 0.51
  ) {
    return false;
  }

  return true;
}

/** Planning exterior wall SF when elevation takeoff is missing. */
export function planningExteriorWallSfFromLiving(livingSf?: number | null): number | null {
  const living = Number(livingSf);
  if (!(Number.isFinite(living) && living > 0)) return null;
  return Math.round(living * 1.05);
}

/**
 * Stucco suggested total: lump package by default; scale with verified user takeoff only.
 */
export function resolveStuccoSuggestedTotal(params: {
  livingSf?: number | null;
  wallSf?: number | null;
  quantitySource?: string | null;
  state?: string | null;
}): GroundUpBarometerLumpFill {
  const lump = resolveStuccoLumpSuggestedFill(params);
  const wall = Number(params.wallSf);
  const hasWall = Number.isFinite(wall) && wall > 0;
  const userConfirmed =
    params.quantitySource === 'user_entered' || params.quantitySource === 'plan_vision';
  if (!hasWall || !userConfirmed) {
    return lump;
  }
  const planningWall = planningExteriorWallSfFromLiving(params.livingSf) || wall;
  const impliedRate = lump.total / planningWall;
  const scaled = Math.round(wall * impliedRate * 100) / 100;
  const cap = Math.round(lump.total * Math.min(1.5, wall / planningWall) * 100) / 100;
  const total = Math.min(scaled, cap);
  const split = splitInstalledPackageByMaterialShare(total, STUCCO_MATERIAL_SHARE);
  return {
    ...split,
    rateSourceLabel: lump.rateSourceLabel,
    helper: `${lump.helper} Priced from verified exterior wall SF at the blended package rate (~$${impliedRate.toFixed(2)}/SF), capped at the SHV barometer package.`,
    comparisonRange: lump.comparisonRange,
    projectId: lump.projectId,
  };
}

/** Cap a takeoff-priced total at the blended barometer lump (prevents inflated notes SF). */
export function capTakeoffTotalAtBarometerLump(
  takeoffTotal: number,
  lumpTotal: number,
  takeoffQty: number,
  planningQty: number
): number {
  if (!(takeoffTotal > 0) || !(lumpTotal > 0)) return takeoffTotal;
  if (!(planningQty > 0)) return Math.min(takeoffTotal, lumpTotal);
  const cap = lumpTotal * Math.min(1.35, takeoffQty / planningQty);
  return Math.min(takeoffTotal, Math.round(cap * 100) / 100);
}
