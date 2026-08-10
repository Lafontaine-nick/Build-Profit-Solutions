/**
 * Ground-up Confirm Scope finish packages from SHV / Silver Leaf cost sheets:
 * - Plumbing fixtures & trim
 * - Electrical fixtures (mat + install)
 * - Landscaping / site walls / fences & gates (H16)
 *
 * Installed lump / allowance when detailed fixture or site takeoff is missing.
 * Each package blends 60% SHV barometer + 40% NAHB national, then × state.
 */

import { blendBarometerLump, resolveBlendedLump } from '@/utils/builderBudgetLumpBlend';
import {
  matchSouthernUtahProjectByLivingSf,
  type SouthernUtahProjectId,
} from '@/utils/southernUtahPaintTrimComparables';

/**
 * SHV "Plumbing Fixt & Hardware" — fixtures + trim-out (not rough-in).
 * Sheet lines (~$2–2.8k) are builder-thin vs size-adjusted NAHB. Barometer local
 * leg floors at the size-adjusted national package so Confirm Scope does not
 * suggest a fixtures-only stub.
 */
export const PLUMBING_TRIM_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 2500, // no separate line — use detached mid
  lot39: 2500,
  lot41: 2000,
  lot49: 2500,
  lot58: 2800,
};
export const PLUMBING_TRIM_DETACHED_MEDIAN_TOTAL = 2500;
export const PLUMBING_TRIM_ALL_PROJECT_RANGE = { low: 2000, high: 2800 } as const;

/**
 * Size-adjusted NAHB planning anchor for ~1,879 SF detached (Plan 41 class).
 * Raw NAHB 2024 AC. Plumbing Fixtures is ~$7,922 on a larger average new home —
 * unscaled is too high for Plan 41-sized jobs (~$5,600 size-adjusted).
 */
export const PLUMBING_TRIM_NATIONAL_AVERAGE_TOTAL = 5600;
/** Published NAHB package before living-SF scale (documentation / audit). */
export const PLUMBING_TRIM_NATIONAL_PACKAGE_RAW = 7922;

/**
 * SHV "Electrical Fixtures" — fixture material + install (not rough-in).
 * Sheet lines (~$2.3–4k) sit under size-adjusted NAHB lighting. Floor the local
 * barometer leg at the size-adjusted national package.
 */
export const ELECTRICAL_TRIM_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 2506, // Silver Leaf lighting fixtures per-home
  lot39: 2300,
  lot41: 2300,
  lot49: 2500,
  lot58: 4000,
};
export const ELECTRICAL_TRIM_DETACHED_MEDIAN_TOTAL = 2400;
export const ELECTRICAL_TRIM_ALL_PROJECT_RANGE = { low: 2300, high: 4000 } as const;

/**
 * Size-adjusted NAHB planning anchor for ~1,879 SF detached (Plan 41 class).
 * Raw NAHB 2024 Y. Lighting is ~$5,392 — Plan 41-class planning sits under that;
 * ~$3,400 keeps Confirm Scope from reading high on mid-size / Plan 39 homes.
 */
export const ELECTRICAL_TRIM_NATIONAL_AVERAGE_TOTAL = 3400;
/** Published NAHB package before living-SF scale (documentation / audit). */
export const ELECTRICAL_TRIM_NATIONAL_PACKAGE_RAW = 5392;

/** Living SF that the size-adjusted fixture national anchors above represent. */
export const FIXTURE_NATIONAL_REFERENCE_LIVING_SF = 1879;

/**
 * Scale fixture national packages with living SF (defaults to Plan 41 class).
 * Below ref SF: linear size-adjust down. Above ref: dampen — fixture count does
 * not grow 1:1 with living SF (Plan 39 was overshooting to ~$9.2k past NAHB raw).
 * Never exceed the published NAHB package cap.
 */
export function scaleFixtureNationalPackage(
  baseNational: number,
  livingSf?: number | null,
  rawCap?: number | null
): number {
  const sf =
    livingSf != null && Number.isFinite(Number(livingSf)) && Number(livingSf) > 0
      ? Number(livingSf)
      : FIXTURE_NATIONAL_REFERENCE_LIVING_SF;
  const ratio = sf / FIXTURE_NATIONAL_REFERENCE_LIVING_SF;
  const scale = ratio <= 1 ? ratio : 1 + 0.35 * (ratio - 1);
  const scaled = Math.round(baseNational * scale);
  if (rawCap != null && Number.isFinite(rawCap) && rawCap > 0) {
    return Math.min(scaled, Math.round(rawCap));
  }
  return scaled;
}

/** Never use a project plumbing-fixture line below the size-adjusted NAHB floor. */
export function plumbingTrimBarometerLocal(
  projectInstalled: number | null | undefined,
  nationalFloor: number = PLUMBING_TRIM_NATIONAL_AVERAGE_TOTAL
): number {
  const raw =
    projectInstalled != null && Number.isFinite(projectInstalled) && projectInstalled > 0
      ? Number(projectInstalled)
      : PLUMBING_TRIM_DETACHED_MEDIAN_TOTAL;
  return Math.max(raw, PLUMBING_TRIM_DETACHED_MEDIAN_TOTAL, nationalFloor);
}

/** Never use a project electrical-fixture line below the size-adjusted NAHB floor. */
export function electricalTrimBarometerLocal(
  projectInstalled: number | null | undefined,
  nationalFloor: number = ELECTRICAL_TRIM_NATIONAL_AVERAGE_TOTAL
): number {
  const raw =
    projectInstalled != null && Number.isFinite(projectInstalled) && projectInstalled > 0
      ? Number(projectInstalled)
      : ELECTRICAL_TRIM_DETACHED_MEDIAN_TOTAL;
  return Math.max(raw, ELECTRICAL_TRIM_DETACHED_MEDIAN_TOTAL, nationalFloor);
}

/**
 * H16 — Landscaping, exterior walls, fences & gates.
 * Includes site walls/gates — not house flatwork or iron entry doors.
 */
export const LANDSCAPING_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 8300,
  lot39: 15500,
  lot41: 9800,
  lot49: 10500,
  lot58: 15500,
};
export const LANDSCAPING_DETACHED_MEDIAN_TOTAL = 13000;
export const LANDSCAPING_ALL_PROJECT_RANGE = { low: 8300, high: 15500 } as const;

/**
 * NAHB 2024 Cost of Constructing a Home — AF. Landscaping (~$9,269).
 * National line is plants/sod/beds; SHV H16 also includes site walls/gates.
 * Still blend 60% barometer + 40% national (suggest need not match H16 exactly).
 */
export const LANDSCAPING_NATIONAL_AVERAGE_TOTAL = 9269;

/**
 * Planning Material/Labor share for the blended landscaping package.
 * Materials (plants, sod, hardscape/wall materials, gate materials) carry a slight
 * majority; install labor is the balance. Used until a site-plan takeoff exists.
 */
export const LANDSCAPING_NATIONAL_MATERIAL_SHARE = 0.55;

/**
 * NAHB installed-package planning shares (fixtures/disposal vs install/haul labor).
 * Applied to blended barometer totals when detailed takeoff is missing.
 */
export const PLUMBING_TRIM_NATIONAL_MATERIAL_SHARE = 0.65;
export const ELECTRICAL_TRIM_NATIONAL_MATERIAL_SHARE = 0.58;
/** Dumpsters, bags, dump fees vs load/haul labor. */
export const HAUL_OFF_NATIONAL_MATERIAL_SHARE = 0.45;

export function splitInstalledPackageByMaterialShare(
  total: number,
  materialShare: number
): { material: number; labor: number; total: number } {
  const material = Math.round(total * materialShare * 100) / 100;
  const labor = Math.round((total - material) * 100) / 100;
  return { material, labor, total: Math.round((material + labor) * 100) / 100 };
}

export type GroundUpFinishPackageKey = 'plumbing_trim' | 'electrical_trim' | 'landscaping';

export type GroundUpFinishPackageFill = {
  material: number;
  labor: number;
  total: number;
  rateSourceLabel: string;
  helper: string;
  comparisonRange: { low: number; high: number };
  projectId: SouthernUtahProjectId | null;
  scopeKey: GroundUpFinishPackageKey;
};

/** @deprecated Prefer resolveBlendedLump — kept for tests that assert the blend math. */
export function blendLandscapingWithNationalAverage(localInstalled: number): number {
  return blendBarometerLump(localInstalled, LANDSCAPING_NATIONAL_AVERAGE_TOTAL);
}

function resolveBlendedPackage(params: {
  livingSf?: number | null;
  state?: string | null;
  byProject: Record<SouthernUtahProjectId, number>;
  median: number;
  national: number;
  range: { low: number; high: number };
  scopeKey: GroundUpFinishPackageKey;
  scopeNoun: string;
  exclusionNote: string;
  /** Optional floor for thin SHV lines (fixtures). */
  floorLocal?: (raw: number) => number;
  floorNote?: (rawLocal: number) => string;
}): GroundUpFinishPackageFill {
  const project = matchSouthernUtahProjectByLivingSf(params.livingSf);
  const rawLocal = project ? params.byProject[project.id] : params.median;
  const local = params.floorLocal ? params.floorLocal(rawLocal) : rawLocal;
  const floored = local > rawLocal;
  const barometerLabel = project
    ? floored
      ? `${project.label} (national floor)`
      : project.label
    : floored
      ? 'national floor'
      : 'detached mid';
  const blended = resolveBlendedLump({
    local,
    national: params.national,
    barometerLabel,
    state: params.state,
    scopeNoun: params.scopeNoun,
  });
  return {
    material: 0,
    labor: blended.total,
    total: blended.total,
    rateSourceLabel: blended.rateSourceLabel,
    helper: `${blended.blendHelper}${
      floored && params.floorNote ? ` ${params.floorNote(rawLocal)}` : ''
    } ${params.exclusionNote}`,
    comparisonRange: { ...params.range },
    projectId: project?.id ?? null,
    scopeKey: params.scopeKey,
  };
}

export function resolvePlumbingTrimLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): GroundUpFinishPackageFill {
  const national = scaleFixtureNationalPackage(
    PLUMBING_TRIM_NATIONAL_AVERAGE_TOTAL,
    params.livingSf,
    PLUMBING_TRIM_NATIONAL_PACKAGE_RAW
  );
  const blended = resolveBlendedPackage({
    livingSf: params.livingSf,
    state: params.state,
    byProject: PLUMBING_TRIM_INSTALLED_BY_PROJECT,
    median: PLUMBING_TRIM_DETACHED_MEDIAN_TOTAL,
    national,
    range: PLUMBING_TRIM_ALL_PROJECT_RANGE,
    scopeKey: 'plumbing_trim',
    scopeNoun: 'plumbing fixtures & trim',
    exclusionNote: 'Not plumbing rough-in.',
  });
  const split = splitInstalledPackageByMaterialShare(
    blended.total,
    PLUMBING_TRIM_NATIONAL_MATERIAL_SHARE
  );
  return {
    ...blended,
    ...split,
    helper: `${blended.helper} Material/labor split uses national fixture planning share (${Math.round(
      PLUMBING_TRIM_NATIONAL_MATERIAL_SHARE * 100
    )}% fixtures / ${Math.round((1 - PLUMBING_TRIM_NATIONAL_MATERIAL_SHARE) * 100)}% install).`,
  };
}

export function resolveElectricalTrimLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): GroundUpFinishPackageFill {
  const national = scaleFixtureNationalPackage(
    ELECTRICAL_TRIM_NATIONAL_AVERAGE_TOTAL,
    params.livingSf,
    ELECTRICAL_TRIM_NATIONAL_PACKAGE_RAW
  );
  const blended = resolveBlendedPackage({
    livingSf: params.livingSf,
    state: params.state,
    byProject: ELECTRICAL_TRIM_INSTALLED_BY_PROJECT,
    median: ELECTRICAL_TRIM_DETACHED_MEDIAN_TOTAL,
    national,
    range: ELECTRICAL_TRIM_ALL_PROJECT_RANGE,
    scopeKey: 'electrical_trim',
    scopeNoun: 'electrical fixtures',
    exclusionNote: 'Not electrical rough-in.',
  });
  const split = splitInstalledPackageByMaterialShare(
    blended.total,
    ELECTRICAL_TRIM_NATIONAL_MATERIAL_SHARE
  );
  return {
    ...blended,
    ...split,
    helper: `${blended.helper} Material/labor split uses national lighting planning share (${Math.round(
      ELECTRICAL_TRIM_NATIONAL_MATERIAL_SHARE * 100
    )}% fixtures / ${Math.round((1 - ELECTRICAL_TRIM_NATIONAL_MATERIAL_SHARE) * 100)}% install).`,
  };
}

export function resolveLandscapingLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): GroundUpFinishPackageFill {
  const blended = resolveBlendedPackage({
    livingSf: params.livingSf,
    state: params.state,
    byProject: LANDSCAPING_INSTALLED_BY_PROJECT,
    median: LANDSCAPING_DETACHED_MEDIAN_TOTAL,
    national: LANDSCAPING_NATIONAL_AVERAGE_TOTAL,
    range: LANDSCAPING_ALL_PROJECT_RANGE,
    scopeKey: 'landscaping',
    scopeNoun: 'landscaping / site walls / gates',
    exclusionNote: 'Not driveway flatwork or iron entry doors.',
  });
  const material = Math.round(blended.total * LANDSCAPING_NATIONAL_MATERIAL_SHARE * 100) / 100;
  const labor = Math.round((blended.total - material) * 100) / 100;
  return {
    ...blended,
    material,
    labor,
    total: Math.round((material + labor) * 100) / 100,
    helper: `${blended.helper} Material/labor split uses national landscaping planning share (${Math.round(
      LANDSCAPING_NATIONAL_MATERIAL_SHARE * 100
    )}% / ${Math.round((1 - LANDSCAPING_NATIONAL_MATERIAL_SHARE) * 100)}%).`,
  };
}

export function resolveGroundUpFinishPackageLump(params: {
  itemId: string;
  livingSf?: number | null;
  state?: string | null;
}): GroundUpFinishPackageFill | null {
  const id = String(params.itemId || '')
    .trim()
    .toLowerCase();
  if (id === 'plumbing_trim') return resolvePlumbingTrimLumpSuggestedFill(params);
  if (id === 'electrical_trim') return resolveElectricalTrimLumpSuggestedFill(params);
  if (id === 'landscaping') return resolveLandscapingLumpSuggestedFill(params);
  return null;
}
