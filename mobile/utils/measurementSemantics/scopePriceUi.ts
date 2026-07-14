import { getTradeMeasurementProfile, missingStatusForScope } from './tradeMeasurementRegistry';
import { measurementStatusLabel } from './records';
import type { MeasurementStatus } from './types';
import { measurementSemanticsV1Enabled } from './flags';

export type BenchmarkLevel = 'scope' | 'component' | 'stage' | 'overall';

export type BenchmarkCardAction = 'price_ready' | 'benchmark_only' | 'comparison_only' | 'included_in_stage';

export type ScopePriceUiState =
  | 'price_ready'
  | 'benchmark_available'
  | 'needs_takeoff'
  | 'needs_allowance'
  | 'needs_count'
  | 'not_applicable';

/** Checklist item that may display/apply the stage total (once). */
export const STAGE_BENCHMARK_OWNERS: Record<string, string | null> = {
  'site-preconstruction': 'sitework',
  foundations: 'foundation',
  framing: 'framing',
  'exterior-finishes': 'exterior',
  'major-systems-rough-ins': 'mep_rough',
  // Synthetic Finishes-group card — not Insulation.
  'interior-finishes': 'interior_finishes',
  'final-steps': 'cleanup',
};

export const STAGE_DISPLAY_TITLES: Record<string, string> = {
  'site-preconstruction': 'Site Work / Preconstruction',
  foundations: 'Foundation',
  framing: 'Framing',
  'exterior-finishes': 'Exterior Envelope',
  'major-systems-rough-ins': 'Major Systems Rough-ins',
  'interior-finishes': 'Interior Finishes',
  'final-steps': 'Final Steps',
};

export const STAGE_COVERS_SCOPE_KEYS: Record<string, string[]> = {
  'site-preconstruction': ['sitework', 'plans_engineering', 'excavation'],
  foundations: ['foundation'],
  framing: ['framing'],
  'exterior-finishes': ['roofing', 'exterior', 'windows_doors'],
  'major-systems-rough-ins': ['mep_rough', 'hvac'],
  'interior-finishes': [
    'insulation',
    'drywall',
    'paint_trim',
    'cabinets_counters',
    'tile_flooring',
    'appliances',
  ],
  'final-steps': ['cleanup'],
};

export function stageTitle(stageId: string | null | undefined): string {
  if (!stageId) return 'Stage';
  return STAGE_DISPLAY_TITLES[stageId] || stageId;
}

export function isStageBenchmarkOwner(itemId: string, stageId: string | null | undefined): boolean {
  if (!stageId) return false;
  const owner = STAGE_BENCHMARK_OWNERS[stageId];
  if (owner == null) return false;
  return owner === itemId;
}

export function canApplyStageBenchmarkFill(itemId: string, stageId: string | null | undefined): boolean {
  return isStageBenchmarkOwner(itemId, stageId);
}

export function isIncludedInStageChild(itemId: string, stageId: string | null | undefined): boolean {
  if (!stageId) return false;
  const owner = STAGE_BENCHMARK_OWNERS[stageId];
  if (!owner || owner === itemId) return false;
  const covers = STAGE_COVERS_SCOPE_KEYS[stageId] || [];
  return covers.includes(itemId);
}

export function classifyBenchmarkLevel(input: {
  itemId: string;
  stageId?: string | null;
}): BenchmarkLevel {
  const stageId = input.stageId || null;
  if (!stageId) return 'scope';
  if (isStageBenchmarkOwner(input.itemId, stageId)) return 'stage';
  if (isIncludedInStageChild(input.itemId, stageId)) return 'component';
  return 'scope';
}

export function benchmarkApplicationKey(input: {
  datasetId: string;
  benchmarkLevel: BenchmarkLevel;
  benchmarkStageKey?: string | null;
}): string {
  return [input.datasetId, input.benchmarkLevel, input.benchmarkStageKey || 'none'].join('::');
}

/** Display-only rounding — keep exact totals for storage/apply math. */
export function roundDisplayTotalToNearest100(total: number | null | undefined): number | null {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n / 100) * 100;
}

export function formatDisplayMoneyNearest100(total: number | null | undefined): string {
  const rounded = roundDisplayTotalToNearest100(total);
  if (rounded == null) return '—';
  return `$${rounded.toLocaleString()}`;
}

export function missingStatusDisplayLabel(scopeKey: string): string {
  if (!measurementSemanticsV1Enabled()) {
    return measurementStatusLabel(missingStatusForScope(scopeKey));
  }
  switch (scopeKey) {
    case 'sitework':
    case 'excavation':
      return 'Needs site takeoff';
    case 'foundation':
      return 'Needs structural takeoff';
    case 'framing':
      return 'Needs detailed framing takeoff';
    case 'roofing':
      return 'Needs roof area / roof squares';
    case 'exterior':
    case 'exterior_finishes':
      return 'Needs exterior wall and opening takeoff';
    case 'mep_rough':
      return 'Needs trade counts or installed-package pricing';
    case 'insulation':
      return 'Needs envelope surface SF';
    case 'drywall':
      return 'Needs wall and ceiling surface SF';
    case 'paint':
    case 'paint_trim':
      return 'Needs paintable wall and ceiling SF';
    case 'appliances':
      return 'Needs appliance count';
    case 'tile_flooring':
    case 'flooring':
    case 'tile':
      return 'Needs finish allocation and material-specific takeoff';
    case 'cabinets_counters':
    case 'cabinets':
    case 'cleanup':
    case 'plans_engineering':
      return 'Needs allowance';
    case 'interior_finishes':
      return 'Planning benchmark — takeoff still required';
    default: {
      const status = missingStatusForScope(scopeKey);
      return measurementStatusLabel(status);
    }
  }
}

export function scopePriceUiStateFromStatus(status: MeasurementStatus | undefined): ScopePriceUiState {
  switch (status) {
    case 'needs_allowance':
      return 'needs_allowance';
    case 'needs_count':
      return 'needs_count';
    case 'not_applicable':
      return 'not_applicable';
    case 'benchmark_only':
      return 'benchmark_available';
    case 'needs_takeoff':
    case 'needs_structural_takeoff':
      return 'needs_takeoff';
    default:
      return 'needs_takeoff';
  }
}

export function classifySuggestedPricingState(input: {
  itemId: string;
  hasPrimaryTakeoff: boolean;
  isLocalBenchmark: boolean;
  isComparisonOnly?: boolean;
}): ScopePriceUiState {
  if (input.isLocalBenchmark || input.isComparisonOnly) {
    if (!input.hasPrimaryTakeoff) return 'benchmark_available';
  }
  if (input.isLocalBenchmark && input.hasPrimaryTakeoff) return 'price_ready';
  const profile = getTradeMeasurementProfile(input.itemId);
  if (!input.hasPrimaryTakeoff && profile) {
    return scopePriceUiStateFromStatus(profile.missingQuantityBehavior);
  }
  return 'price_ready';
}

export function benchmarkActionForBlock(input: {
  isLocalBenchmark: boolean;
  hasPrimaryTakeoff: boolean;
  isComparisonOnly?: boolean;
  includedInStage?: boolean;
  isNationalAverage?: boolean;
}): BenchmarkCardAction {
  if (input.includedInStage || input.isComparisonOnly) return 'comparison_only';
  if (input.isLocalBenchmark && !input.hasPrimaryTakeoff) return 'benchmark_only';
  if (input.isLocalBenchmark || input.isNationalAverage) return 'price_ready';
  return 'price_ready';
}

export function benchmarkActionButtonLabel(action: BenchmarkCardAction): string | null {
  switch (action) {
    case 'price_ready':
      return 'Use price';
    case 'benchmark_only':
      return 'Use as temporary allowance';
    case 'comparison_only':
      return 'View benchmark';
    case 'included_in_stage':
      return null;
    default:
      return null;
  }
}

export function footerSuggestedPricingSummary(input: {
  readyCount: number;
  benchmarkOnlyCount: number;
  needsMeasurementCount?: number;
}): string | null {
  if (!measurementSemanticsV1Enabled()) {
    const parts: string[] = [];
    if (input.readyCount > 0) {
      parts.push(
        `${input.readyCount} price${input.readyCount === 1 ? '' : 's'} ready to apply`
      );
    }
    if (input.benchmarkOnlyCount > 0) {
      parts.push(
        `${input.benchmarkOnlyCount} benchmark-only suggestion${input.benchmarkOnlyCount === 1 ? '' : 's'}`
      );
    }
    return parts.length ? parts.join(' · ') : null;
  }
  const parts: string[] = [];
  if (input.readyCount > 0) {
    parts.push(`${input.readyCount} price${input.readyCount === 1 ? '' : 's'} ready`);
  }
  if (input.benchmarkOnlyCount > 0) {
    parts.push(
      `${input.benchmarkOnlyCount} planning benchmark${input.benchmarkOnlyCount === 1 ? '' : 's'}`
    );
  }
  return parts.length ? parts.join(' · ') : null;
}

export const FOOTER_PLANNING_BENCHMARK_INFO =
  'Planning benchmarks require a detailed takeoff or quote before final bidding.';

/** Gross floor area copied from living SF is not a finish takeoff. */
export function isGrossFlooringDerivedFromLiving(input: {
  flooringSqft?: number | null;
  floorAreaSqft?: number | null;
}): boolean {
  const flooring = Number(input.flooringSqft);
  const living = Number(input.floorAreaSqft);
  return (
    Number.isFinite(flooring) &&
    flooring > 0 &&
    Number.isFinite(living) &&
    living > 0 &&
    Math.abs(flooring - living) < 0.05
  );
}

export function coversLabelList(stageId: string): string {
  const keys = STAGE_COVERS_SCOPE_KEYS[stageId] || [];
  const labels: Record<string, string> = {
    sitework: 'sitework',
    plans_engineering: 'plans / engineering',
    excavation: 'excavation',
    foundation: 'foundation',
    framing: 'framing',
    roofing: 'roofing',
    exterior: 'wall finish / envelope',
    exterior_finishes: 'exterior finishes',
    windows_doors: 'windows / doors',
    mep_rough: 'MEP rough-in',
    hvac: 'HVAC',
    insulation: 'insulation',
    drywall: 'drywall',
    paint_trim: 'paint & trim',
    paint: 'paint & trim',
    cabinets_counters: 'cabinets / countertops',
    cabinets: 'cabinets / countertops',
    tile_flooring: 'flooring',
    flooring: 'flooring',
    appliances: 'appliances',
    cleanup: 'cleanup',
  };
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const key of keys) {
    const label = labels[key] || key;
    if (seen.has(label)) continue;
    seen.add(label);
    unique.push(label);
  }
  return unique.join(', ');
}
