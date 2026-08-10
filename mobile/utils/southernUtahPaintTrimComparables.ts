/**
 * Southern Utah interior paint + finish-carpentry comparables from
 * southern_utah_residential_benchmark_v1 (Silver Leaf, Plans 39/41/49/58).
 *
 * Silver Leaf twin-home building costs are already normalized per home (/2) in
 * the dataset — do not divide again.
 *
 * Interior paint sources are installed lump sums — never invent a real
 * material/labor split. Finish-carpentry sources have explicit mat/labor.
 *
 * Suggested totals blend 60% barometer + 40% NAHB national, then × state.
 */

import {
  blendBarometerLump,
  installedBudgetLivingSfReference,
  resolveBlendedLump,
  scaleSplitLumpForState,
} from '@/utils/builderBudgetLumpBlend';

export type SouthernUtahProjectId = 'silverLeaf' | 'lot39' | 'lot41' | 'lot49' | 'lot58';

export type SouthernUtahProjectMeta = {
  id: SouthernUtahProjectId;
  label: string;
  livingSf: number;
  buildingType: 'detached' | 'twin_home';
};

/** Living SF used as the benchmark denominator (not the physical paint quantity). */
export const SOUTHERN_UTAH_PAINT_TRIM_PROJECTS: SouthernUtahProjectMeta[] = [
  { id: 'silverLeaf', label: 'Silver Leaf', livingSf: 2171.5, buildingType: 'twin_home' },
  { id: 'lot39', label: 'Plan 39', livingSf: 3098, buildingType: 'detached' },
  { id: 'lot41', label: 'Plan 41', livingSf: 1879, buildingType: 'detached' },
  { id: 'lot49', label: 'Plan 49', livingSf: 2571, buildingType: 'detached' },
  { id: 'lot58', label: 'Plan 58', livingSf: 3660, buildingType: 'detached' },
];

/** H42 — Interior paint / stain (installed lump sum / allowance). */
export const INTERIOR_PAINT_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 7675, // already per-home (building ÷ 2)
  lot39: 8900,
  lot41: 7400,
  lot49: 8900,
  lot58: 8900,
};

export const INTERIOR_PAINT_DETACHED_MEDIAN_TOTAL = 8900;
export const INTERIOR_PAINT_ALL_PROJECT_RANGE = { low: 7400, high: 8900 } as const;
/** NAHB 2024 — X. Painting (~$11,150). */
export const INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL = 11150;

/**
 * Door hardware planning adder on top of H43+H44 trim/doors/shelving.
 * National mid (~15–20 interior doors): materials ~$1,200–$2,000 (~$75–$100/door),
 * installed ~$2,500–$3,500. Local bids often floor materials at $1,500.
 */
export const DOOR_HARDWARE_PLANNING_ADDER = {
  material: 1500,
  labor: 750,
  total: 2250,
} as const;

/** H43 + H44 trim/doors/shelving + door hardware planning adder. */
export const FINISH_CARPENTRY_BY_PROJECT: Record<
  SouthernUtahProjectId,
  { material: number; labor: number; total: number }
> = {
  silverLeaf: {
    material: 4371.23 + DOOR_HARDWARE_PLANNING_ADDER.material,
    labor: 3500 + DOOR_HARDWARE_PLANNING_ADDER.labor,
    total: 7871.23 + DOOR_HARDWARE_PLANNING_ADDER.total,
  },
  lot39: {
    material: 3000 + DOOR_HARDWARE_PLANNING_ADDER.material,
    labor: 3000 + DOOR_HARDWARE_PLANNING_ADDER.labor,
    total: 6000 + DOOR_HARDWARE_PLANNING_ADDER.total,
  },
  lot41: {
    material: 2500 + DOOR_HARDWARE_PLANNING_ADDER.material,
    labor: 2500 + DOOR_HARDWARE_PLANNING_ADDER.labor,
    total: 5000 + DOOR_HARDWARE_PLANNING_ADDER.total,
  },
  lot49: {
    material: 2500 + DOOR_HARDWARE_PLANNING_ADDER.material,
    labor: 2500 + DOOR_HARDWARE_PLANNING_ADDER.labor,
    total: 5000 + DOOR_HARDWARE_PLANNING_ADDER.total,
  },
  lot58: {
    material: 3000 + DOOR_HARDWARE_PLANNING_ADDER.material,
    labor: 3000 + DOOR_HARDWARE_PLANNING_ADDER.labor,
    total: 6000 + DOOR_HARDWARE_PLANNING_ADDER.total,
  },
};

export const FINISH_CARPENTRY_DETACHED_MEDIAN = {
  material: 2750 + DOOR_HARDWARE_PLANNING_ADDER.material,
  labor: 2750 + DOOR_HARDWARE_PLANNING_ADDER.labor,
  total: 5500 + DOOR_HARDWARE_PLANNING_ADDER.total,
} as const;

/** NAHB 2024 — W. Interior Trims, Doors, and Mirrors (~$12,920). */
export const FINISH_CARPENTRY_NATIONAL_AVERAGE_TOTAL = 12920;

export const FINISH_CARPENTRY_SOURCE_SCOPE =
  'Finish trim, interior doors, door hardware & shelving';

/** Living SF match tolerance (same spirit as benchmark exactSourceMatch). */
const LIVING_SF_MATCH_TOLERANCE = 0.005;

export function matchSouthernUtahProjectByLivingSf(
  livingSf: number | null | undefined
): SouthernUtahProjectMeta | null {
  const living = Number(livingSf);
  if (!(Number.isFinite(living) && living > 0)) return null;
  let best: SouthernUtahProjectMeta | null = null;
  let bestDelta = Infinity;
  for (const project of SOUTHERN_UTAH_PAINT_TRIM_PROJECTS) {
    const delta = Math.abs(project.livingSf - living) / project.livingSf;
    if (delta <= LIVING_SF_MATCH_TOLERANCE && delta < bestDelta) {
      best = project;
      bestDelta = delta;
    }
  }
  return best;
}

export type InteriorPaintComparable = {
  total: number;
  projectId: SouthernUtahProjectId | null;
  projectLabel: string;
  matchKind: 'exact_project' | 'detached_median';
  livingSfBenchmark: number | null;
  paintableSf: number | null;
  impliedPerPaintableSf: number | null;
  impliedRateLabel: string | null;
  range: { low: number; high: number };
  sampleCount: number;
  sourceSplitTreatment: 'installed_lump_sum';
  rateSourceLabel: string;
  helper: string;
  warning: string;
};

export type FinishCarpentryComparable = {
  material: number;
  labor: number;
  total: number;
  projectId: SouthernUtahProjectId | null;
  projectLabel: string;
  matchKind: 'exact_project' | 'detached_median';
  sourceScope: string;
  sampleCount: number;
  rateSourceLabel: string;
  helper: string;
  warning: string;
  splitSource: 'source';
  splitConfidence: 'high';
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveInteriorPaintComparable(params: {
  livingSf?: number | null;
  paintableSf?: number | null;
  state?: string | null;
}): InteriorPaintComparable {
  const project = matchSouthernUtahProjectByLivingSf(params.livingSf);
  const paintable = Number(params.paintableSf);
  const hasPaintable = Number.isFinite(paintable) && paintable > 0;
  const local = project
    ? INTERIOR_PAINT_INSTALLED_BY_PROJECT[project.id]
    : INTERIOR_PAINT_DETACHED_MEDIAN_TOTAL;
  const barometerLabel = project ? project.label : 'detached mid';
  const blended = resolveBlendedLump({
    local,
    national: INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL,
    barometerLabel,
    state: params.state,
    scopeNoun: 'interior paint',
  });
  const implied =
    hasPaintable && project?.id === 'lot41' ? round2(blended.total / paintable) : null;
  const livingSfRef = installedBudgetLivingSfReference({
    total: blended.total,
    livingSf: project?.livingSf ?? params.livingSf,
    barometerLabel,
  });

  return {
    total: blended.total,
    projectId: project?.id ?? null,
    projectLabel: project?.label ?? 'Local five-project median',
    matchKind: project ? 'exact_project' : 'detached_median',
    livingSfBenchmark: project?.livingSf ?? livingSfRef?.benchmarkLivingSf ?? null,
    paintableSf: hasPaintable ? paintable : null,
    impliedPerPaintableSf: implied,
    impliedRateLabel:
      implied != null
        ? `Implied from blended ${barometerLabel} · ~$${implied.toFixed(2)}/paintable SF`
        : livingSfRef?.impliedUnitRateLabel ?? null,
    range: { ...INTERIOR_PAINT_ALL_PROJECT_RANGE },
    sampleCount: 5,
    sourceSplitTreatment: 'installed_lump_sum',
    rateSourceLabel: blended.rateSourceLabel,
    helper: `${blended.blendHelper} Changing paintable SF does not change this installed package.`,
    warning:
      'Installed house budget (not × paintable SF). Material and labor were not separated in the source.',
  };
}

export function resolveFinishCarpentryComparable(params: {
  livingSf?: number | null;
  state?: string | null;
}): FinishCarpentryComparable {
  const project = matchSouthernUtahProjectByLivingSf(params.livingSf);
  const pkg = project ? FINISH_CARPENTRY_BY_PROJECT[project.id] : FINISH_CARPENTRY_DETACHED_MEDIAN;
  const barometerLabel = project ? project.label : 'detached mid';
  const blendedTotal = blendBarometerLump(pkg.total, FINISH_CARPENTRY_NATIONAL_AVERAGE_TOTAL);
  const matRatio = pkg.total > 0 ? pkg.material / pkg.total : 0.5;
  const blendedMaterial = round2(blendedTotal * matRatio);
  const blendedLabor = round2(blendedTotal - blendedMaterial);
  const scaled = scaleSplitLumpForState(blendedMaterial, blendedLabor, { state: params.state });
  const stateSuffix =
    scaled.stateCode && scaled.multiplier !== 1 ? ` · ${scaled.stateCode}` : '';

  return {
    material: scaled.material,
    labor: scaled.labor,
    total: scaled.total,
    projectId: project?.id ?? null,
    projectLabel: project?.label ?? 'Local detached median',
    matchKind: project ? 'exact_project' : 'detached_median',
    sourceScope: FINISH_CARPENTRY_SOURCE_SCOPE,
    sampleCount: project ? 5 : 4,
    rateSourceLabel: `Blended national + barometer · ${barometerLabel}${stateSuffix}`,
    helper: `${FINISH_CARPENTRY_SOURCE_SCOPE}: 60% ${barometerLabel} ($${pkg.total.toLocaleString()}) + 40% NAHB interior trim ($${FINISH_CARPENTRY_NATIONAL_AVERAGE_TOTAL.toLocaleString()})${
      scaled.multiplier !== 1 && scaled.stateCode
        ? ` · ${scaled.stateCode} regional ${scaled.multiplier.toFixed(2)}×`
        : ''
    }. Includes +$${DOOR_HARDWARE_PLANNING_ADDER.total.toLocaleString()} door hardware in the local leg.`,
    warning: 'Package allowance until detailed trim/door/shelving/hardware takeoff exists.',
    splitSource: 'source',
    splitConfidence: 'high',
  };
}

/** Exterior paint has no separately itemized local samples in the current dataset. */
export function exteriorPaintLocalSampleCount(): number {
  return 0;
}

export function exteriorPaintLocalCalibrationMessage(): string {
  return 'Exterior paint is not separately identified in the current local project budgets.';
}
