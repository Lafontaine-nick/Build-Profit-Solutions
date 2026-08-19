/**
 * Framing shell package comparables from SHV Iron Mesa Lots 39/41/49/58.
 *
 * Package = H27 lumber + H28 trusses + H18 decks (when in bid) + H29 labor.
 * Quantity basis = covered framed SF (living + garage), matching Confirm Scope.
 *
 * Suggested $/SF blends 60% detached median package rate + 40% national framing
 * mat+labor (same policy as southernUtahCalibratedRates framing:sqft).
 */

import {
  BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT,
  BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT,
} from '@/utils/southernUtahCalibratedRates';
import { SOUTHERN_UTAH_PLAN_FACTS } from '@/utils/southernUtahPlanFacts';
import {
  matchSouthernUtahProjectByLivingSf,
  type SouthernUtahProjectId,
} from '@/utils/southernUtahPaintTrimComparables';

/** H27 — Framing lumber material (installed package). */
export const FRAMING_LUMBER_INSTALLED_BY_PROJECT: Record<
  SouthernUtahProjectId,
  number
> = {
  silverLeaf: 17372,
  lot39: 24500,
  lot41: 17500,
  lot49: 21500,
  lot58: 25500,
};

/** H28 — Floor & roof trusses. */
export const FRAMING_TRUSSES_INSTALLED_BY_PROJECT: Record<
  SouthernUtahProjectId,
  number
> = {
  silverLeaf: 8008.51,
  lot39: 17500,
  lot41: 10500,
  lot49: 14500,
  lot58: 15500,
};

/** H18 — Decks & waterproof decking (optional per plan). */
export const FRAMING_DECKS_INSTALLED_BY_PROJECT: Partial<
  Record<SouthernUtahProjectId, number>
> = {
  lot39: 12500,
  lot49: 7500,
  lot58: 4500,
};

/** H29 — Framing labor. */
export const FRAMING_LABOR_INSTALLED_BY_PROJECT: Record<
  SouthernUtahProjectId,
  number
> = {
  silverLeaf: 16058.75,
  lot39: 26500,
  lot41: 19500,
  lot49: 24500,
  lot58: 26500,
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

export function coveredFramedSfForProject(
  projectId: SouthernUtahProjectId
): number {
  const pack = SOUTHERN_UTAH_PLAN_FACTS[projectId];
  const living = Number(pack.buildingAreas.totalLivingSqft) || 0;
  const garage = Number(pack.buildingAreas.garageSqft) || 0;
  return Math.round(living + Math.max(0, garage));
}

export function framingShellPackageTotalForProject(
  projectId: SouthernUtahProjectId
): number {
  const lumber = FRAMING_LUMBER_INSTALLED_BY_PROJECT[projectId] || 0;
  const trusses = FRAMING_TRUSSES_INSTALLED_BY_PROJECT[projectId] || 0;
  const decks = FRAMING_DECKS_INSTALLED_BY_PROJECT[projectId] || 0;
  const labor = FRAMING_LABOR_INSTALLED_BY_PROJECT[projectId] || 0;
  return round2(lumber + trusses + decks + labor);
}

export function framingShellPackageRateForProject(
  projectId: SouthernUtahProjectId
): number | null {
  const sf = coveredFramedSfForProject(projectId);
  const total = framingShellPackageTotalForProject(projectId);
  if (!(sf > 0) || !(total > 0)) return null;
  return round2(total / sf);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : round2((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Detached median installed $/ covered framed SF (Lots 39/41/49/58). */
export function detachedMedianFramingShellRatePerFramedSf(): number {
  const rates = DETACHED_PLAN_IDS.map(id => framingShellPackageRateForProject(id)).filter(
    (rate): rate is number => rate != null && rate > 0
  );
  return median(rates);
}

export type FramingShellPackageComparable = {
  projectId: SouthernUtahProjectId;
  projectLabel: string;
  coveredFramedSf: number;
  packageTotal: number;
  packageRatePerFramedSf: number;
  /** Scale the plan package to another covered framed SF takeoff. */
  scaledTotalForFramedSf: (framedSf: number) => number;
};

export function resolveFramingShellPackageComparable(
  livingSf?: number | null
): FramingShellPackageComparable | null {
  const project = matchSouthernUtahProjectByLivingSf(Number(livingSf));
  if (!project) return null;
  const rate = framingShellPackageRateForProject(project.id);
  const total = framingShellPackageTotalForProject(project.id);
  const coveredFramedSf = coveredFramedSfForProject(project.id);
  if (rate == null || !(total > 0) || !(coveredFramedSf > 0)) return null;
  return {
    projectId: project.id,
    projectLabel: project.label,
    coveredFramedSf,
    packageTotal: total,
    packageRatePerFramedSf: rate,
    scaledTotalForFramedSf: (framedSf: number) =>
      round2(rate * Math.max(0, framedSf)),
  };
}

export function blendFramingShellRateWithNational(national: {
  material: number;
  labor: number;
}): { material: number; labor: number; total: number } {
  const localMat =
    DETACHED_PLAN_IDS.reduce(
      (sum, id) =>
        sum +
        FRAMING_LUMBER_INSTALLED_BY_PROJECT[id] +
        FRAMING_TRUSSES_INSTALLED_BY_PROJECT[id] +
        (FRAMING_DECKS_INSTALLED_BY_PROJECT[id] || 0),
      0
    ) / DETACHED_PLAN_IDS.length;
  const localLab =
    DETACHED_PLAN_IDS.reduce(
      (sum, id) => sum + FRAMING_LABOR_INSTALLED_BY_PROJECT[id],
      0
    ) / DETACHED_PLAN_IDS.length;
  const localSf =
    DETACHED_PLAN_IDS.reduce((sum, id) => sum + coveredFramedSfForProject(id), 0) /
    DETACHED_PLAN_IDS.length;
  const localMatPerSf = localMat / localSf;
  const localLabPerSf = localLab / localSf;
  const material = round2(
    localMatPerSf * BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT +
      national.material * BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT
  );
  const labor = round2(
    localLabPerSf * BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT +
      national.labor * BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT
  );
  return { material, labor, total: round2(material + labor) };
}

export function framingComparableHelper(
  comparable: FramingShellPackageComparable,
  framedSf: number
): string {
  const scaled = comparable.scaledTotalForFramedSf(framedSf);
  return `${framedSf.toLocaleString()} covered framed SF · ${comparable.projectLabel} shell package reference ~$${comparable.packageTotal.toLocaleString()} (${comparable.coveredFramedSf.toLocaleString()} SF) · scaled ~$${scaled.toLocaleString()}`;
}
