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
  'site-preconstruction': 'Sitework',
  foundations: 'Foundation',
  framing: 'Framing',
  'exterior-finishes': 'Exterior Envelope',
  'major-systems-rough-ins': 'Major Systems Rough-ins',
  'interior-finishes': 'Interior Finishes',
  'final-steps': 'Final Steps',
};

export const STAGE_COVERS_SCOPE_KEYS: Record<string, string[]> = {
  // Excavation stays here for mutual exclusion only — it is priced as its own trade.
  // Plans/engineering are soft costs with their own allowance, not part of this living-SF package.
  'site-preconstruction': ['sitework', 'excavation'],
  foundations: ['foundation'],
  framing: ['framing'],
  'exterior-finishes': ['roofing', 'exterior', 'windows_doors', 'stucco'],
  'major-systems-rough-ins': ['mep_rough', 'plumbing_rough', 'electrical_rough', 'hvac'],
  'interior-finishes': [
    'insulation',
    'drywall',
    'paint_trim',
    'cabinets_counters',
    'cabinets',
    'countertops',
    'tile_flooring',
    'shower_tile',
    'shower_floor_tile',
    'floor_tile',
    'appliances',
  ],
  'final-steps': ['cleanup'],
};

/**
 * Child scopes with their own qty × rate (or soft-cost) pricing.
 * Still in STAGE_COVERS for double-count exclusion, but never listed in stage "Covers …" copy.
 */
export const STAGE_SEPARATE_TRADE_SCOPE_KEYS: Record<string, string[]> = {
  'site-preconstruction': ['excavation'],
  'exterior-finishes': ['roofing', 'windows_doors', 'stucco'],
  'major-systems-rough-ins': ['plumbing_rough', 'electrical_rough', 'hvac'],
  'interior-finishes': [
    'insulation',
    'drywall',
    'paint_trim',
    'paint',
    'cabinets',
    'countertops',
    'cabinets_counters',
    'tile_flooring',
    'floor_tile',
    'shower_tile',
    'shower_floor_tile',
  ],
};

/**
 * Ground-up: living-SF stage hosts are planning comparison only.
 * Sellable dollars come from trade cards (excavation, roofing, MEP, framing mat+labor, etc.).
 */
export const GROUND_UP_COMPARISON_ONLY_STAGE_KEYS = new Set([
  'site-preconstruction',
  'framing',
  'exterior-finishes',
  'major-systems-rough-ins',
  'interior-finishes',
]);

export function isGroundUpStageComparisonOnly(
  stageId: string | null | undefined,
  templateKey?: string | null
): boolean {
  if (!stageId || String(templateKey || '').toLowerCase() !== 'ground_up') return false;
  return GROUND_UP_COMPARISON_ONLY_STAGE_KEYS.has(stageId);
}

type PricingAcceptanceLike = Record<
  string,
  {
    selectionStatus?: string | null;
    pricingSourceKind?: string | null;
    totalAmount?: number | null;
  } | null | undefined
>;

function acceptanceIsActive(
  acceptance: PricingAcceptanceLike[string]
): boolean {
  return Boolean(
    acceptance &&
      Number(acceptance.totalAmount || 0) > 0 &&
      ['accepted', 'user_entered', 'manual_adjusted'].includes(
        String(acceptance.selectionStatus || '')
      )
  );
}

/** Find the planning stage that owns/covers a scope item. */
export function benchmarkStageForScopeKey(scopeKey: string): string | null {
  for (const [stageKey, scopeKeys] of Object.entries(STAGE_COVERS_SCOPE_KEYS)) {
    if (scopeKeys.includes(scopeKey)) return stageKey;
  }
  return null;
}

/** Accepted physical/component prices that should replace the broad stage allowance. */
export function acceptedTradeScopeKeysForStage(
  stageKey: string | null | undefined,
  pricingAcceptance?: PricingAcceptanceLike | null
): string[] {
  if (!stageKey || !pricingAcceptance) return [];
  const owner = STAGE_BENCHMARK_OWNERS[stageKey];
  return (STAGE_COVERS_SCOPE_KEYS[stageKey] || []).filter((scopeKey) => {
    const acceptance = pricingAcceptance[scopeKey];
    if (!acceptanceIsActive(acceptance)) return false;
    // A non-benchmark price on the owner (e.g. foundation CY) is trade mode too.
    if (scopeKey === owner) return acceptance?.pricingSourceKind !== 'local_benchmark';
    return true;
  });
}

export function stageHasAcceptedTradePricing(
  stageKey: string | null | undefined,
  pricingAcceptance?: PricingAcceptanceLike | null
): boolean {
  return acceptedTradeScopeKeysForStage(stageKey, pricingAcceptance).length > 0;
}

export function stageHasAcceptedBenchmarkPricing(
  stageKey: string | null | undefined,
  pricingAcceptance?: PricingAcceptanceLike | null
): boolean {
  if (!stageKey || !pricingAcceptance) return false;
  const owner = STAGE_BENCHMARK_OWNERS[stageKey];
  if (!owner) return false;
  const acceptance = pricingAcceptance[owner];
  return Boolean(
    acceptanceIsActive(acceptance) &&
      acceptance?.pricingSourceKind === 'local_benchmark'
  );
}

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
  // Separate trades own their qty × rate pricing — never "Included in {stage}".
  if ((STAGE_SEPARATE_TRADE_SCOPE_KEYS[stageId] || []).includes(itemId)) return false;
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
    case 'stucco':
      return 'Needs exterior wall surface SF';
    case 'mep_rough':
      return 'Needs trade counts or installed-package pricing';
    case 'plumbing_rough':
      return 'Needs plumbing rough-in points';
    case 'electrical_rough':
      return 'Needs circuit / device count';
    case 'hvac':
      return 'Needs HVAC system count or tons';
    case 'windows_doors':
      return 'Needs window/door opening count';
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
  const separate = new Set(STAGE_SEPARATE_TRADE_SCOPE_KEYS[stageId] || []);
  const keys = (STAGE_COVERS_SCOPE_KEYS[stageId] || []).filter((key) => !separate.has(key));
  const labels: Record<string, string> = {
    sitework: 'general sitework',
    plans_engineering: 'plans / engineering',
    excavation: 'excavation',
    foundation: 'foundation',
    framing: 'framing',
    roofing: 'roofing',
    exterior: 'wall finish / envelope',
    exterior_finishes: 'exterior finishes',
    windows_doors: 'windows / doors',
    mep_rough: 'MEP rough-in',
    plumbing_rough: 'plumbing rough-in',
    electrical_rough: 'electrical rough-in',
    hvac: 'HVAC',
    insulation: 'insulation',
    drywall: 'drywall',
    paint_trim: 'paint & trim',
    paint: 'paint & trim',
    cabinets_counters: 'cabinets / countertops',
    cabinets: 'cabinets',
    countertops: 'countertops',
    tile_flooring: 'flooring',
    flooring: 'flooring',
    shower_tile: 'shower wall tile',
    shower_floor_tile: 'shower floor tile',
    floor_tile: 'bath floor tile',
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
  const separateLabels = (STAGE_SEPARATE_TRADE_SCOPE_KEYS[stageId] || [])
    .map((key) => labels[key] || key)
    .filter((label, index, arr) => arr.indexOf(label) === index);
  if (unique.length === 0 && separateLabels.length === 0) return '';
  if (separateLabels.length === 0) return unique.join(', ');
  if (unique.length === 0) {
    return `${separateLabels.join(', ')} priced separately`;
  }
  return `${unique.join(', ')} · ${separateLabels.join(', ')} priced separately`;
}
