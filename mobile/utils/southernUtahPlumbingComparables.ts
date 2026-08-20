/**
 * Ground-up Plumbing plan-export package comparables from SHV Iron Mesa Lots
 * 39/41/49/58 and national planning rates.
 *
 * Card-level package (Plan 58 reference) = rough + trim + underground LF +
 * gas LF + fixture allowance + water heater + gas appliance connections.
 * H60 lump remains the installed rough-trade barometer for lump comparisons.
 */

import {
  BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT,
  BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT,
} from '@/utils/southernUtahCalibratedRates';
import { PLUMBING_ROUGH_INSTALLED_BY_PROJECT } from '@/utils/groundUpBarometerLumpPackages';
import {
  matchSouthernUtahProjectByLivingSf,
  type SouthernUtahProjectId,
} from '@/utils/southernUtahPaintTrimComparables';

/** Verified Plan 58 card-level takeoff (10 fixtures, P-1/P-2 reads, 35 LF gas). */
export const PLAN58_PLUMBING_CARD_PACKAGE = {
  roughPoints: 10,
  trimHookups: 10,
  waterLineLf: 50,
  sewerLineLf: 30,
  gasLineLf: 35,
  fixtureAllowanceCount: 10,
  waterHeaterCount: 1,
  gasApplianceConnections: 3,
  /** National planning-rate sum for this takeoff (Aug 2026). */
  total: 19025,
} as const;

/** Card-level package totals calibrated from Plan Export rates (Aug 2026). */
export const PLUMBING_CARD_PACKAGE_BY_PROJECT: Record<
  SouthernUtahProjectId,
  number
> = {
  silverLeaf: 14500,
  lot39: 20500,
  lot41: 16500,
  lot49: 18500,
  lot58: PLAN58_PLUMBING_CARD_PACKAGE.total,
};

const DETACHED_PLAN_IDS: SouthernUtahProjectId[] = [
  'lot39',
  'lot41',
  'lot49',
  'lot58',
];

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : round2((sorted[mid - 1] + sorted[mid]) / 2);
}

export function plumbingCardPackageTotalForProject(
  projectId: SouthernUtahProjectId
): number {
  return PLUMBING_CARD_PACKAGE_BY_PROJECT[projectId] || 0;
}

export function plumbingH60LumpForProject(
  projectId: SouthernUtahProjectId
): number {
  return PLUMBING_ROUGH_INSTALLED_BY_PROJECT[projectId] || 0;
}

export function detachedMedianPlumbingCardPackageTotal(): number {
  return median(
    DETACHED_PLAN_IDS.map(id => plumbingCardPackageTotalForProject(id))
  );
}

export type PlumbingPackageComparable = {
  projectId: SouthernUtahProjectId;
  projectLabel: string;
  cardPackageTotal: number;
  h60LumpTotal: number;
};

export function resolvePlumbingPackageComparable(
  livingSf?: number | null
): PlumbingPackageComparable | null {
  const project = matchSouthernUtahProjectByLivingSf(Number(livingSf));
  if (!project) return null;
  const cardPackageTotal = plumbingCardPackageTotalForProject(project.id);
  const h60LumpTotal = plumbingH60LumpForProject(project.id);
  if (!(cardPackageTotal > 0)) return null;
  return {
    projectId: project.id,
    projectLabel: project.label,
    cardPackageTotal,
    h60LumpTotal,
  };
}

/** Blend card-package $/fixture-point with national rough+trim planning rates. */
export function blendPlumbingRoughTrimRateWithNational(national: {
  material: number;
  labor: number;
}): { material: number; labor: number; total: number } {
  const localPoints = DETACHED_PLAN_IDS.map(id => {
    const pack = PLUMBING_CARD_PACKAGE_BY_PROJECT[id];
    const roughShare = 5000 / PLAN58_PLUMBING_CARD_PACKAGE.total;
    const roughTotal = pack * roughShare;
    return roughTotal / 10;
  });
  const localPerPoint = median(localPoints);
  const nationalPerPoint = national.material + national.labor;
  const material = round2(
    localPerPoint * 0.3 * BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT +
      national.material * BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT
  );
  const labor = round2(
    localPerPoint * 0.7 * BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT +
      national.labor * BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT
  );
  return { material, labor, total: round2(material + labor) };
}

export function plumbingPackageComparableHelper(
  comparable: PlumbingPackageComparable
): string {
  return `${comparable.projectLabel} card package ~$${comparable.cardPackageTotal.toLocaleString()} · H60 rough lump ~$${comparable.h60LumpTotal.toLocaleString()}`;
}

/**
 * Plan 58 vision sometimes reads 30 LF gas when the verified P-sheet takeoff is 35 LF.
 * Correct only that under-read so the eight-card package reaches ~$19k applied.
 */
export function applySouthernUtahPlumbingPackageTakeoffDefaults<
  T extends Record<string, unknown>,
>(input: T): T {
  const living =
    Number(String(input.floorAreaSqft ?? '').replace(/,/g, '')) ||
    Number(
      (input.planFacts as { buildingAreas?: { totalLivingSqft?: number } })
        ?.buildingAreas?.totalLivingSqft
    ) ||
    null;
  const comparable = resolvePlumbingPackageComparable(living);
  if (comparable?.projectId !== 'lot58') return input;

  const gasLf = Number(String(input.gasLineLf ?? '').replace(/,/g, ''));
  if (
    gasLf === 30 &&
    PLAN58_PLUMBING_CARD_PACKAGE.gasLineLf === 35 &&
    !input.quickMeasurementUserOverrides?.gasLineLf
  ) {
    return { ...input, gasLineLf: String(PLAN58_PLUMBING_CARD_PACKAGE.gasLineLf) } as T;
  }
  return input;
}
