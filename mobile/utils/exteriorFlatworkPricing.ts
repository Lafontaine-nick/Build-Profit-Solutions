/**
 * Exterior concrete flatwork — driveway, walks, porch, exterior patio slabs.
 * Not house or garage slab (those stay on Foundation / concreteCy).
 *
 * National path: $4 mat + $6 labor / SF when concreteSqft takeoff exists.
 * When SF is unknown: 60% SHV H17 barometer + 40% NAHB driveway package, × state.
 */

import { resolveBlendedLump } from '@/utils/builderBudgetLumpBlend';
import {
  matchSouthernUtahProjectByLivingSf,
  type SouthernUtahProjectId,
} from '@/utils/southernUtahPaintTrimComparables';

/** Same national split as scopeItemQuantities NATIONAL_AVERAGE_BUDGET_SPLITS.pour_flatwork. */
export const EXTERIOR_FLATWORK_NATIONAL_RATE = {
  unit: 'sqft' as const,
  material: 4,
  labor: 6,
  total: 10,
  sourceLabel: 'Suggested budget split · National Average · exterior flatwork per SF',
} as const;

/**
 * H17 — Flatwork, driveway & walks (southern_utah_residential_benchmark_v1).
 * Installed lump sum / allowance — not a calibrated $/SF.
 *
 * Plan 41 ($7,500) looks like a thin walks/porch package vs Silver Leaf ($12,500)
 * and NAHB driveway (~$9,635). Barometer local leg floors at the package mid so
 * Confirm Scope does not suggest below a full driveway + walks allowance.
 */
export const EXTERIOR_FLATWORK_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 12500, // already per-home (building ÷ 2)
  lot39: 9000,
  lot41: 7500,
  lot49: 13500,
  lot58: 10500,
};

/**
 * Package mid across Silver Leaf + Lots 39/49/58 (excludes Plan 41 low outlier).
 * Sorted 9k / 10.5k / 12.5k / 13.5k → mid ≈ $11,500.
 */
export const EXTERIOR_FLATWORK_DETACHED_MEDIAN_TOTAL = 11500;
export const EXTERIOR_FLATWORK_ALL_PROJECT_RANGE = { low: 7500, high: 13500 } as const;
/** NAHB 2024 — AH. Driveway (~$9,635). Closest national package for flatwork lump. */
export const EXTERIOR_FLATWORK_NATIONAL_PACKAGE_TOTAL = 9635;

/** Never use a project H17 below this as the local blend leg. */
export function exteriorFlatworkBarometerLocal(projectInstalled: number | null | undefined): number {
  const raw =
    projectInstalled != null && Number.isFinite(projectInstalled) && projectInstalled > 0
      ? Number(projectInstalled)
      : EXTERIOR_FLATWORK_DETACHED_MEDIAN_TOTAL;
  return Math.max(
    raw,
    EXTERIOR_FLATWORK_DETACHED_MEDIAN_TOTAL,
    EXTERIOR_FLATWORK_NATIONAL_PACKAGE_TOTAL
  );
}

export type ExteriorFlatworkComparable = {
  total: number;
  projectId: SouthernUtahProjectId | null;
  projectLabel: string;
  matchKind: 'exact_project' | 'detached_median';
  livingSfBenchmark: number | null;
  flatworkSf: number | null;
  range: { low: number; high: number };
  sampleCount: number;
  sourceSplitTreatment: 'installed_lump_sum';
  rateSourceLabel: string;
  helper: string;
  warning: string;
};

export function resolveExteriorFlatworkComparable(params: {
  livingSf?: number | null;
  flatworkSf?: number | null;
  state?: string | null;
}): ExteriorFlatworkComparable {
  const project = matchSouthernUtahProjectByLivingSf(params.livingSf);
  const flatwork = Number(params.flatworkSf);
  const hasFlatwork = Number.isFinite(flatwork) && flatwork > 0;
  const rawLocal = project
    ? EXTERIOR_FLATWORK_INSTALLED_BY_PROJECT[project.id]
    : EXTERIOR_FLATWORK_DETACHED_MEDIAN_TOTAL;
  const local = exteriorFlatworkBarometerLocal(rawLocal);
  const floored = local > rawLocal;
  const barometerLabel = project
    ? floored
      ? `${project.label} (package mid)`
      : project.label
    : 'package mid';
  const blended = resolveBlendedLump({
    local,
    national: EXTERIOR_FLATWORK_NATIONAL_PACKAGE_TOTAL,
    barometerLabel,
    state: params.state,
    scopeNoun: 'flatwork / driveway & walks',
  });

  return {
    total: blended.total,
    projectId: project?.id ?? null,
    projectLabel: project?.label ?? 'Local package mid',
    matchKind: project ? 'exact_project' : 'detached_median',
    livingSfBenchmark: project?.livingSf ?? (Number(params.livingSf) > 0 ? Number(params.livingSf) : null),
    flatworkSf: hasFlatwork ? flatwork : null,
    range: { ...EXTERIOR_FLATWORK_ALL_PROJECT_RANGE },
    sampleCount: 5,
    sourceSplitTreatment: 'installed_lump_sum',
    rateSourceLabel: blended.rateSourceLabel,
    helper: `${blended.blendHelper}${
      floored
        ? ` Source H17 ($${rawLocal.toLocaleString()}) floored to package mid — full driveway + walks, not porch-only.`
        : ''
    } Enter exterior flatwork SF for national $/SF pricing instead.`,
    warning:
      'Installed house allowance (not × flatwork SF). Validate driveway/walk takeoff before firm bid.',
  };
}

/** Suggested fill when ground-up Confirm Scope has no exterior flatwork SF. */
export function resolveExteriorFlatworkLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): {
  material: number;
  labor: number;
  total: number;
  rateSourceLabel: string;
  helper: string;
  comparisonRange: { low: number; high: number };
  projectId: SouthernUtahProjectId | null;
} {
  const comparable = resolveExteriorFlatworkComparable(params);
  return {
    material: 0,
    labor: comparable.total,
    total: comparable.total,
    rateSourceLabel: comparable.rateSourceLabel,
    helper: comparable.helper,
    comparisonRange: comparable.range,
    projectId: comparable.projectId,
  };
}
