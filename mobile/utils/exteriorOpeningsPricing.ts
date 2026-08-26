/**
 * Exterior openings — windows, swing doors, sliding doors, garage doors.
 *
 * Garage doors are priced by type (single / double / RV), not a flat each:
 * - Double ~$2,400 matches Silver Leaf + national mid steel insulated
 * - Double + RV ~$10,700 matches SHV Lots 41/49
 *
 * Exterior swing / sliding: count × national each when known; when count is
 * missing on ground-up, use SHV H36 / H35 installed packages (or planning
 * count of 2 × national each outside a matched project).
 */

import {
  resolveBlendedLump,
  scaleSplitLumpForState,
} from '@/utils/builderBudgetLumpBlend';
import {
  matchSouthernUtahProjectByLivingSf,
  type SouthernUtahProjectId,
} from '@/utils/southernUtahPaintTrimComparables';
import type {
  OpeningSizeMix,
  OpeningSizeTier,
} from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';
import { openingSizeMixSummary } from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';

export type GarageDoorType = 'single' | 'double' | 'rv';

export type GarageDoorCounts = {
  single: number;
  double: number;
  rv: number;
};

/** National mid-market installed (mat + labor), new-construction builder grade. */
export const EXTERIOR_OPENING_NATIONAL_RATES = {
  windows: {
    unit: 'each' as const,
    material: 450,
    labor: 275,
    sourceLabel: 'Suggested budget split · National Average · per window (mid-market vinyl/low-E)',
  },
  /** Living-SF planning when window count is missing (legacy windows_doors $/SF). */
  windows_sqft: {
    unit: 'sqft' as const,
    material: 2.55,
    labor: 1.55,
    sourceLabel: 'Suggested budget split · National Average · windows per living SF',
  },
  exterior_doors: {
    unit: 'each' as const,
    material: 1400,
    labor: 900,
    sourceLabel: 'Suggested budget split · National Average · exterior swing door (mid-market)',
  },
  sliding_doors: {
    unit: 'each' as const,
    material: 1700,
    labor: 800,
    sourceLabel: 'Suggested budget split · National Average · sliding patio door (mid-market)',
  },
} as const;

/**
 * Garage door installed packages.
 * Single/double: national mid steel insulated + opener-ready.
 * RV: local SHV schedule (above national $3k–$7k) so double+RV ≈ $10,700.
 */
export const GARAGE_DOOR_TYPE_RATES: Record<
  GarageDoorType,
  { material: number; labor: number; total: number; label: string; nationalNote: string }
> = {
  single: {
    material: 1200,
    labor: 600,
    total: 1800,
    label: 'Single garage door',
    nationalNote: 'National mid ~$800–$2,500 installed (8–9′ steel)',
  },
  double: {
    material: 1700,
    labor: 700,
    total: 2400,
    label: 'Double garage door',
    nationalNote: 'National mid ~$1,500–$4,500; Silver Leaf double $2,364',
  },
  rv: {
    material: 5800,
    labor: 2500,
    total: 8300,
    label: 'RV / oversized garage door',
    nationalNote: 'National RV ~$3,000–$7,000; local SHV with double ≈ $10,700',
  },
};

export function normalizeGarageDoorCounts(raw?: {
  garageDoorSingleCount?: number | null;
  garageDoorDoubleCount?: number | null;
  garageDoorRvCount?: number | null;
} | null): GarageDoorCounts {
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? Math.round(x) : 0;
  };
  return {
    single: n(raw?.garageDoorSingleCount),
    double: n(raw?.garageDoorDoubleCount),
    rv: n(raw?.garageDoorRvCount),
  };
}

export function totalGarageDoorCount(counts: GarageDoorCounts): number {
  return counts.single + counts.double + counts.rv;
}

export function resolveGarageDoorSuggestedPricing(
  counts: GarageDoorCounts,
  location?: { state?: string | null } | null
): {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  breakdown: Array<{ type: GarageDoorType; count: number; unitTotal: number; lineTotal: number }>;
  sourceLabel: string;
  helper: string;
} | null {
  const quantity = totalGarageDoorCount(counts);
  if (quantity <= 0) return null;

  let material = 0;
  let labor = 0;
  const breakdown: Array<{
    type: GarageDoorType;
    count: number;
    unitTotal: number;
    lineTotal: number;
  }> = [];

  (['single', 'double', 'rv'] as GarageDoorType[]).forEach((type) => {
    const count = counts[type];
    if (count <= 0) return;
    const rate = GARAGE_DOOR_TYPE_RATES[type];
    material += rate.material * count;
    labor += rate.labor * count;
    breakdown.push({
      type,
      count,
      unitTotal: rate.total,
      lineTotal: rate.total * count,
    });
  });

  const scaled = scaleSplitLumpForState(material, labor, location);
  const parts = breakdown.map(
    (b) => `${b.count}× ${GARAGE_DOOR_TYPE_RATES[b.type].label.replace(/ garage door$/i, '')} @ $${b.unitTotal.toLocaleString()}`
  );
  const stateSuffix =
    scaled.stateCode && scaled.multiplier !== 1 ? ` · ${scaled.stateCode}` : '';

  return {
    material: scaled.material,
    labor: scaled.labor,
    total: scaled.total,
    quantity,
    unit: 'each',
    breakdown,
    sourceLabel: `Suggested budget split · National Average + local garage schedule${stateSuffix}`,
    helper: parts.join(' · '),
  };
}

/**
 * When garage SF is known but door types are unset, assume one double
 * (Silver Leaf / typical 2-car). RV must be chosen explicitly — SF alone
 * cannot tell a tall bay from a wide two-car.
 */
export function inferDefaultGarageDoorCounts(garageSqft?: number | null): GarageDoorCounts | null {
  const sf = Number(garageSqft);
  if (!(Number.isFinite(sf) && sf >= 200)) return null;
  return { single: 0, double: 1, rv: 0 };
}

/** Typical new-construction planning count when the door schedule is missing. */
export const EXTERIOR_DOOR_PLANNING_COUNT = 2;
export const SLIDING_DOOR_PLANNING_COUNT = 2;

/**
 * Exterior doors package = SHV "Exterior Doors" (8100) + "Iron Door" (16300).
 * Iron here is the specialty iron/wrought entry door — not site gates (those are H16).
 * Silver Leaf H36 is already per-home exterior door mat + install (no separate iron line).
 */
export const EXTERIOR_DOORS_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> = {
  silverLeaf: 1693,
  lot39: 2000 + 4500, // Exterior Doors + Iron Door
  lot41: 2000 + 2000,
  lot49: 3000 + 3000,
  lot58: 3000 + 3000,
};
export const EXTERIOR_DOORS_DETACHED_MEDIAN_TOTAL = 6000;
export const EXTERIOR_DOORS_ALL_PROJECT_RANGE = { low: 1693, high: 6500 } as const;
/** National package when count missing: planning count × mid-market each. */
export const EXTERIOR_DOORS_NATIONAL_PACKAGE_TOTAL =
  EXTERIOR_DOOR_PLANNING_COUNT *
  (EXTERIOR_OPENING_NATIONAL_RATES.exterior_doors.material +
    EXTERIOR_OPENING_NATIONAL_RATES.exterior_doors.labor);

/**
 * H35 — Exterior sliding doors (SHV line 8075).
 * Lot 39 ($16.5k) is a large multi-panel package — keep for exact match only.
 * Unmatched planning uses the mid of Lot 41 + Lot 49 (~$7.3k), not the $16.5k outlier.
 */
export const SLIDING_DOORS_INSTALLED_BY_PROJECT: Partial<Record<SouthernUtahProjectId, number>> = {
  lot39: 16500,
  lot41: 9800,
  lot49: 4800,
};
export const SLIDING_DOORS_DETACHED_MEDIAN_TOTAL = 7300;
export const SLIDING_DOORS_ALL_PROJECT_RANGE = { low: 4800, high: 16500 } as const;
/** National package when count missing: planning count × mid-market each. */
export const SLIDING_DOORS_NATIONAL_PACKAGE_TOTAL =
  SLIDING_DOOR_PLANNING_COUNT *
  (EXTERIOR_OPENING_NATIONAL_RATES.sliding_doors.material +
    EXTERIOR_OPENING_NATIONAL_RATES.sliding_doors.labor);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ExteriorDoorOpeningLumpFill = {
  material: number;
  labor: number;
  total: number;
  rateSourceLabel: string;
  helper: string;
  comparisonRange: { low: number; high: number };
  projectId: SouthernUtahProjectId | null;
  scopeKey: 'exterior_doors' | 'sliding_doors';
};

/** SHV H36 planning lump when exterior swing door count is missing — blended + state. */
export function resolveExteriorDoorsLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): ExteriorDoorOpeningLumpFill {
  const project = matchSouthernUtahProjectByLivingSf(params.livingSf);
  const local = project
    ? EXTERIOR_DOORS_INSTALLED_BY_PROJECT[project.id]
    : EXTERIOR_DOORS_DETACHED_MEDIAN_TOTAL;
  const barometerLabel = project ? project.label : 'detached mid';
  const blended = resolveBlendedLump({
    local,
    national: EXTERIOR_DOORS_NATIONAL_PACKAGE_TOTAL,
    barometerLabel,
    state: params.state,
    scopeNoun: 'exterior + iron entry doors',
  });
  return {
    material: 0,
    labor: blended.total,
    total: blended.total,
    rateSourceLabel: blended.rateSourceLabel,
    helper: `${blended.blendHelper} Enter door count for per-door pricing. Site gates stay under landscaping.`,
    comparisonRange: { ...EXTERIOR_DOORS_ALL_PROJECT_RANGE },
    projectId: project?.id ?? null,
    scopeKey: 'exterior_doors',
  };
}

/** SHV H35 planning lump when sliding / patio door count is missing — blended + state. */
export function resolveSlidingDoorsLumpSuggestedFill(params: {
  livingSf?: number | null;
  state?: string | null;
}): ExteriorDoorOpeningLumpFill {
  const project = matchSouthernUtahProjectByLivingSf(params.livingSf);
  const projectTotal =
    project != null ? SLIDING_DOORS_INSTALLED_BY_PROJECT[project.id] : undefined;
  const local =
    projectTotal != null ? projectTotal : SLIDING_DOORS_DETACHED_MEDIAN_TOTAL;
  const barometerLabel = project && projectTotal != null ? project.label : 'detached mid';
  const blended = resolveBlendedLump({
    local,
    national: SLIDING_DOORS_NATIONAL_PACKAGE_TOTAL,
    barometerLabel,
    state: params.state,
    scopeNoun: 'sliding / patio doors',
  });
  return {
    material: 0,
    labor: blended.total,
    total: blended.total,
    rateSourceLabel: blended.rateSourceLabel,
    helper: `${blended.blendHelper} Enter sliding door count for per-door national pricing.`,
    comparisonRange: { ...SLIDING_DOORS_ALL_PROJECT_RANGE },
    projectId: project && projectTotal != null ? project.id : null,
    scopeKey: 'sliding_doors',
  };
}

/** Size-tier multipliers on the mid-market each allowance. */
export const OPENING_SIZE_TIER_MULTIPLIERS: Record<
  'windows' | 'exterior_doors' | 'sliding_doors',
  Record<OpeningSizeTier, number>
> = {
  windows: {
    standard: 1,
    medium: 1.2,
    large: 1.65,
    oversized: 2.4,
  },
  exterior_doors: {
    standard: 1,
    medium: 1.2,
    large: 1.55,
    oversized: 2.1,
  },
  sliding_doors: {
    standard: 1,
    medium: 1.35,
    large: 1.85,
    oversized: 2.6,
  },
};

export function resolveOpeningSizeTierSuggestedPricing(params: {
  itemId: 'windows' | 'exterior_doors' | 'sliding_doors';
  quantity: number;
  mix?: OpeningSizeMix | null;
  location?: { state?: string | null } | null;
}): {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  sourceLabel: string;
  helper: string;
} | null {
  const quantity = Math.round(Number(params.quantity) || 0);
  if (quantity <= 0) return null;
  const base = EXTERIOR_OPENING_NATIONAL_RATES[params.itemId];
  const multipliers = OPENING_SIZE_TIER_MULTIPLIERS[params.itemId];
  const mix = params.mix || {
    standard: quantity,
    medium: 0,
    large: 0,
    oversized: 0,
  };
  const mixTotal =
    mix.standard + mix.medium + mix.large + mix.oversized || quantity;
  const scale = quantity / mixTotal;
  let material = 0;
  let labor = 0;
  (['standard', 'medium', 'large', 'oversized'] as OpeningSizeTier[]).forEach(
    tier => {
      const count = mix[tier] * scale;
      if (!(count > 0)) return;
      material += base.material * multipliers[tier] * count;
      labor += base.labor * multipliers[tier] * count;
    }
  );
  const scaled = scaleSplitLumpForState(material, labor, params.location);
  const mixLabel = openingSizeMixSummary(mix);
  const sized =
    mix.medium + mix.large + mix.oversized > 0
      ? mixLabel
      : 'Standard size allowance — confirm if picture or oversized units are on the plans';
  const stateSuffix =
    scaled.stateCode && scaled.multiplier !== 1 ? ` · ${scaled.stateCode}` : '';
  return {
    material: scaled.material,
    labor: scaled.labor,
    total: scaled.total,
    quantity,
    unit: 'each',
    sourceLabel: `Suggested budget split · National Average · size-tier each${stateSuffix}`,
    helper: sized || base.sourceLabel,
  };
}
