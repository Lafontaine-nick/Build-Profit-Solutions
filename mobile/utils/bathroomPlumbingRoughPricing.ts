import type {
  BenchmarkScopeAssumption,
  BenchmarkScopeAssumptionProfile,
} from '@/utils/benchmarkScopeAssumptions';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { wetAreaInScope } from '@/utils/bathroomPlumbingTrimPricing';
import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';
import { checklistItemInScope } from '@/utils/scopeItemQuantities';

export type BathroomShowerRoughFixtureType = 'shower' | 'bathtub' | 'tub_shower_combo' | 'unsure';
export type BathroomShowerRoughWorkType = 'in_place' | 'relocation' | 'unsure';
export type BathroomShowerRoughPlumbingExposed =
  | 'exposed_by_demo'
  | 'separate_access_required'
  | 'unsure';
export type BathroomShowerRoughFloorConstruction = 'wood_framed' | 'concrete_slab' | 'unsure';
export type BathroomShowerRoughSlabWorkRequired = 'yes' | 'no' | 'unsure';
export type ShowerRoughConditionSource = 'user_selected' | 'demo_detected' | 'ai_inferred';

/** @deprecated Legacy wall-access field — migrated to plumbingExposed. */
export type BathroomShowerRoughWallAccess = 'open_framing' | 'finished_wall' | 'unsure';

export const SHOWER_ROUGH_QUANTITY_SOURCE_SELECTED = 'Based on selected remodel conditions';
export const SHOWER_ROUGH_DEMO_DETECTED_LABEL =
  'Plumbing access detected from selected demolition scope';
export const SHOWER_ROUGH_EXPOSED_UNSURE_STATUS =
  'Planning assumption — pricing assumes remodel demolition will expose the plumbing. Separate access work may increase the final cost.';
export const SHOWER_ROUGH_SLAB_UNSURE_STATUS =
  'Planning assumption — concrete cutting or below-slab drain work may be required.';
export const SHOWER_ROUGH_RELOCATE_OVERLAP_WARNING =
  'Possible scope overlap: Some plumbing relocation work may already be included in another selected line item. Review before applying both prices.';
/** @deprecated Use SHOWER_ROUGH_RELOCATE_OVERLAP_WARNING */
export const SHOWER_ROUGH_OVERLAP_WARNING = SHOWER_ROUGH_RELOCATE_OVERLAP_WARNING;
export const SHOWER_ROUGH_ACCESS_OVERLAP_WARNING =
  'Possible access overlap: Selected demolition work may already expose the plumbing. Confirm that separate access demolition is still required before applying the additional price.';
export const SHOWER_ROUGH_PRICING_DISCLAIMER =
  'Final cost may vary based on fixture configuration, relocation distance, wall and floor access, drain and vent conditions, local labor rates, permits, and finish-restoration requirements.';

/** Checklist rows that typically expose shower/tub valve and supply walls during remodel demo. */
export const SHOWER_ROUGH_DEMO_EXPOSES_PLUMBING_IDS = [
  'demo',
  'tub_demo',
] as const;

export const BATHROOM_SHOWER_ROUGH_FIXTURE_OPTIONS: Array<{
  id: BathroomShowerRoughFixtureType;
  label: string;
}> = [
  { id: 'shower', label: 'Shower' },
  { id: 'bathtub', label: 'Bathtub' },
  { id: 'tub_shower_combo', label: 'Tub/shower combination' },
  { id: 'unsure', label: 'Not sure yet' },
];

export const BATHROOM_SHOWER_ROUGH_WORK_TYPE_OPTIONS: Array<{
  id: BathroomShowerRoughWorkType;
  label: string;
}> = [
  { id: 'in_place', label: 'Same-location rough-in' },
  { id: 'relocation', label: 'Relocated rough-in' },
  { id: 'unsure', label: 'Not sure yet' },
];

export const BATHROOM_SHOWER_ROUGH_PLUMBING_EXPOSED_OPTIONS: Array<{
  id: BathroomShowerRoughPlumbingExposed;
  label: string;
}> = [
  { id: 'exposed_by_demo', label: 'Yes — plumbing will be exposed' },
  { id: 'separate_access_required', label: 'No — separate access is required' },
  { id: 'unsure', label: 'Not sure yet' },
];

export const BATHROOM_SHOWER_ROUGH_FLOOR_OPTIONS: Array<{
  id: BathroomShowerRoughFloorConstruction;
  label: string;
}> = [
  { id: 'wood_framed', label: 'Wood-framed floor' },
  { id: 'concrete_slab', label: 'Concrete slab' },
  { id: 'unsure', label: 'Not sure yet' },
];

export const BATHROOM_SHOWER_ROUGH_SLAB_WORK_OPTIONS: Array<{
  id: BathroomShowerRoughSlabWorkRequired;
  label: string;
}> = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
  { id: 'unsure', label: 'Not sure yet' },
];

type ShowerRoughBandKey =
  | 'same_base_wood'
  | 'same_access_premium_wood'
  | 'same_slab_work'
  | 'relocate_base_wood'
  | 'relocate_access_premium_wood'
  | 'relocate_slab';

type ShowerRoughBand = {
  material: number;
  labor: number;
  total: number;
  range: { low: number; high: number; highSuffix?: string };
  assumptionKey: ShowerRoughBandKey;
  includesSlabWork: boolean;
};

const ASSUMPTION_EXPOSED_BY_DEMO =
  'Assumes selected remodel demolition exposes the valve, supply piping, and drain before plumbing work begins. Wall-opening demolition is priced separately and is not included again in this rough-in allowance.';

const ASSUMPTION_SEPARATE_ACCESS =
  'Assumes the plumber or contractor must create additional access that is not included in the selected remodel demolition scope. Extensive tile, drywall, ceiling, or finish restoration is excluded unless separately priced.';

const ASSUMPTION_EXPOSED_UNSURE =
  'Pricing assumes remodel demolition will expose the plumbing. Separate access work may increase the final cost.';

const ASSUMPTION_RELOCATE_SLAB =
  'Assumes a short-distance relocation on a conventional concrete slab, including slab cutting, below-slab plumbing work, and basic concrete patching. Post-tension slab work is excluded.';

const SHOWER_ROUGH_BANDS: Record<ShowerRoughBandKey, ShowerRoughBand> = {
  same_base_wood: {
    material: 300,
    labor: 850,
    total: 1150,
    range: { low: 850, high: 1500 },
    assumptionKey: 'same_base_wood',
    includesSlabWork: false,
  },
  same_access_premium_wood: {
    material: 425,
    labor: 1225,
    total: 1650,
    range: { low: 1200, high: 2200 },
    assumptionKey: 'same_access_premium_wood',
    includesSlabWork: false,
  },
  same_slab_work: {
    material: 575,
    labor: 1675,
    total: 2250,
    range: { low: 1650, high: 3000 },
    assumptionKey: 'same_slab_work',
    includesSlabWork: true,
  },
  relocate_base_wood: {
    material: 450,
    labor: 1300,
    total: 1750,
    range: { low: 1250, high: 2500 },
    assumptionKey: 'relocate_base_wood',
    includesSlabWork: false,
  },
  relocate_access_premium_wood: {
    material: 650,
    labor: 1850,
    total: 2500,
    range: { low: 1800, high: 3500 },
    assumptionKey: 'relocate_access_premium_wood',
    includesSlabWork: false,
  },
  relocate_slab: {
    material: 850,
    labor: 2650,
    total: 3500,
    range: { low: 2500, high: 5000, highSuffix: '+' },
    assumptionKey: 'relocate_slab',
    includesSlabWork: true,
  },
};

const BATHTUB_BAND_TOTALS: Partial<Record<ShowerRoughBandKey, number>> = {
  same_base_wood: 1050,
  same_access_premium_wood: 1500,
  same_slab_work: 2050,
  relocate_base_wood: 1600,
  relocate_access_premium_wood: 2250,
  relocate_slab: 3250,
};

const SHOWER_ROUGH_INCLUDES = [
  'Rough-in piping and fittings',
  'Hot and cold supply connections',
  'Mixing-valve rough-in',
  'Showerhead or tub-spout rough piping when applicable',
  'Drain and trap connection',
  'Minor vent adjustment when required',
  'Testing',
  'Plumbing labor',
  'Standard contractor overhead and profit',
] as const;

const SHOWER_ROUGH_SLAB_INCLUDES = [
  'Concrete cutting or chipping',
  'Basic trench access',
  'Below-slab drain relocation or modification',
  'Basic concrete trench patching',
] as const;

const SHOWER_ROUGH_EXCLUDES = [
  'Demolition already priced elsewhere',
  'Decorative trim',
  'Showerhead or tub filler',
  'Shower base, shower pan, or bathtub',
  'Waterproofing',
  'Backer board',
  'Tile and grout',
  'Extensive wall, ceiling, flooring, or finish restoration',
  'Major vent rerouting',
  'Structural modifications',
  'Permits and engineering',
  'Post-tension slab work',
] as const;

export type ShowerRoughPricingContext = {
  fixtureType: BathroomShowerRoughFixtureType;
  workType: BathroomShowerRoughWorkType;
  plumbingExposed: BathroomShowerRoughPlumbingExposed;
  floorConstruction: BathroomShowerRoughFloorConstruction;
  slabWorkRequired: BathroomShowerRoughSlabWorkRequired | null;
  fixtureTypeSource: ShowerRoughConditionSource | null;
  workTypeSource: ShowerRoughConditionSource | null;
  plumbingExposedSource: ShowerRoughConditionSource | null;
  floorConstructionSource: ShowerRoughConditionSource | null;
  slabWorkRequiredSource: ShowerRoughConditionSource | null;
};

export function resolveShowerRoughFixtureType(
  value: string | null | undefined
): BathroomShowerRoughFixtureType {
  if (value === 'shower' || value === 'bathtub' || value === 'tub_shower_combo') return value;
  return 'unsure';
}

export function resolveBathroomPlumbingRoughWorkType(
  workType: string | null | undefined
): BathroomShowerRoughWorkType {
  if (workType === 'in_place' || workType === 'relocation') return workType;
  return 'unsure';
}

export function resolveShowerRoughPlumbingExposed(
  value: string | null | undefined
): BathroomShowerRoughPlumbingExposed {
  if (value === 'exposed_by_demo' || value === 'separate_access_required') return value;
  if (value === 'open_framing') return 'exposed_by_demo';
  if (value === 'finished_wall') return 'separate_access_required';
  return 'unsure';
}

export function resolveShowerRoughFloorConstruction(
  value: string | null | undefined
): BathroomShowerRoughFloorConstruction {
  if (value === 'wood_framed' || value === 'concrete_slab') return value;
  return 'unsure';
}

export function resolveShowerRoughSlabWorkRequired(
  value: string | null | undefined
): BathroomShowerRoughSlabWorkRequired {
  if (value === 'yes' || value === 'no' || value === 'unsure') return value;
  return 'unsure';
}

function normalizeSource(value: string | null | undefined): ShowerRoughConditionSource | null {
  if (value === 'user_selected' || value === 'demo_detected' || value === 'ai_inferred') {
    return value;
  }
  return null;
}

function legacyAccessToPlumbingExposed(accessType: string | null | undefined): {
  plumbingExposed: BathroomShowerRoughPlumbingExposed;
  floorConstruction: BathroomShowerRoughFloorConstruction;
} {
  if (accessType === 'open_wood_framed') {
    return { plumbingExposed: 'exposed_by_demo', floorConstruction: 'wood_framed' };
  }
  if (accessType === 'finished_wood_framed') {
    return { plumbingExposed: 'separate_access_required', floorConstruction: 'wood_framed' };
  }
  if (accessType === 'concrete_slab') {
    return { plumbingExposed: 'separate_access_required', floorConstruction: 'concrete_slab' };
  }
  return { plumbingExposed: 'unsure', floorConstruction: 'unsure' };
}

export function demoScopeExposesShowerPlumbing(
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null
): boolean {
  if (!checklistItems?.length) return false;
  return checklistItems.some(
    (row) =>
      (SHOWER_ROUGH_DEMO_EXPOSES_PLUMBING_IDS as readonly string[]).includes(row.id) &&
      checklistItemInScope(row)
  );
}

export function inferPlumbingExposedFromDemoScope(
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null
): { plumbingExposed: 'exposed_by_demo'; source: 'demo_detected' } | null {
  if (!demoScopeExposesShowerPlumbing(checklistItems)) return null;
  return { plumbingExposed: 'exposed_by_demo', source: 'demo_detected' };
}

export function buildShowerRoughPricingContext(input: {
  fixtureType?: string | null;
  fixtureTypeSource?: string | null;
  workType?: string | null;
  workTypeSource?: string | null;
  plumbingExposed?: string | null;
  plumbingExposedSource?: string | null;
  floorConstruction?: string | null;
  floorConstructionSource?: string | null;
  slabWorkRequired?: string | null;
  slabWorkRequiredSource?: string | null;
  /** @deprecated Legacy wall access. */
  wallAccess?: string | null;
  /** @deprecated Legacy combined access. */
  legacyAccessType?: string | null;
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
}): ShowerRoughPricingContext {
  const legacy = legacyAccessToPlumbingExposed(input.legacyAccessType);
  const legacyWall = input.wallAccess
    ? resolveShowerRoughPlumbingExposed(input.wallAccess)
    : legacy.plumbingExposed;

  let plumbingExposed = resolveShowerRoughPlumbingExposed(
    input.plumbingExposed ?? legacyWall
  );
  let plumbingExposedSource = normalizeSource(input.plumbingExposedSource);

  if (!input.plumbingExposed && !input.wallAccess && !input.legacyAccessType) {
    const inferred = inferPlumbingExposedFromDemoScope(input.checklistItems);
    if (inferred && plumbingExposed === 'unsure') {
      plumbingExposed = inferred.plumbingExposed;
      plumbingExposedSource = inferred.source;
    }
  }

  const floorConstruction = resolveShowerRoughFloorConstruction(
    input.floorConstruction ?? legacy.floorConstruction
  );
  const workType = resolveBathroomPlumbingRoughWorkType(input.workType);
  const slabApplicable = workType === 'in_place' && floorConstruction === 'concrete_slab';

  return {
    fixtureType: resolveShowerRoughFixtureType(input.fixtureType),
    workType,
    plumbingExposed,
    floorConstruction,
    slabWorkRequired: slabApplicable
      ? resolveShowerRoughSlabWorkRequired(input.slabWorkRequired)
      : workType === 'relocation' && floorConstruction === 'concrete_slab'
        ? 'yes'
        : null,
    fixtureTypeSource: normalizeSource(input.fixtureTypeSource),
    workTypeSource: normalizeSource(input.workTypeSource),
    plumbingExposedSource,
    floorConstructionSource: normalizeSource(input.floorConstructionSource),
    slabWorkRequiredSource: slabApplicable ? normalizeSource(input.slabWorkRequiredSource) : null,
  };
}

function usesAccessPremium(ctx: ShowerRoughPricingContext): boolean {
  return ctx.plumbingExposed === 'separate_access_required';
}

function resolveBandKey(ctx: ShowerRoughPricingContext): ShowerRoughBandKey {
  const work = ctx.workType === 'in_place' ? 'same' : 'relocate';
  const premium = usesAccessPremium(ctx);

  if (work === 'relocate') {
    if (ctx.floorConstruction === 'concrete_slab') return 'relocate_slab';
    return premium ? 'relocate_access_premium_wood' : 'relocate_base_wood';
  }

  if (
    ctx.floorConstruction === 'concrete_slab' &&
    (ctx.slabWorkRequired === 'yes' || ctx.slabWorkRequired === 'unsure')
  ) {
    return 'same_slab_work';
  }

  return premium ? 'same_access_premium_wood' : 'same_base_wood';
}

function resolveAssumptionText(ctx: ShowerRoughPricingContext, bandKey: ShowerRoughBandKey): string {
  if (bandKey === 'relocate_slab') return ASSUMPTION_RELOCATE_SLAB;
  if (ctx.plumbingExposed === 'separate_access_required') return ASSUMPTION_SEPARATE_ACCESS;
  if (ctx.plumbingExposed === 'unsure') return ASSUMPTION_EXPOSED_UNSURE;
  return ASSUMPTION_EXPOSED_BY_DEMO;
}

function applyFixtureAdjustment(band: ShowerRoughBand, fixtureType: BathroomShowerRoughFixtureType) {
  if (fixtureType !== 'bathtub') return band;
  const bathtubTotal = BATHTUB_BAND_TOTALS[band.assumptionKey];
  if (!bathtubTotal) return band;
  const ratio = band.material / band.total;
  const material = round2(bathtubTotal * ratio);
  const labor = round2(bathtubTotal - material);
  return { ...band, material, labor, total: bathtubTotal };
}

function resolveShowerRoughBand(ctx: ShowerRoughPricingContext): ShowerRoughBand & {
  assumptionText: string;
} {
  const key = resolveBandKey(ctx);
  const base = SHOWER_ROUGH_BANDS[key];
  const adjusted = applyFixtureAdjustment(base, ctx.fixtureType);
  return { ...adjusted, assumptionText: resolveAssumptionText(ctx, key) };
}

export function resolveShowerRoughConfidence(ctx: ShowerRoughPricingContext): 'low' | 'medium' {
  const unresolved =
    ctx.fixtureType === 'unsure' ||
    ctx.workType === 'unsure' ||
    ctx.plumbingExposed === 'unsure' ||
    ctx.floorConstruction === 'unsure' ||
    (ctx.slabWorkRequired != null && ctx.slabWorkRequired === 'unsure');
  return unresolved ? 'low' : 'medium';
}

export function showerRoughConditionsConfirmed(ctx: ShowerRoughPricingContext): boolean {
  return (
    ctx.fixtureType !== 'unsure' &&
    ctx.workType !== 'unsure' &&
    ctx.plumbingExposed !== 'unsure' &&
    ctx.floorConstruction !== 'unsure' &&
    (ctx.slabWorkRequired == null || ctx.slabWorkRequired !== 'unsure')
  );
}

export function showerRoughConditionsUserSelected(ctx: ShowerRoughPricingContext): boolean {
  const checks: Array<ShowerRoughConditionSource | null> = [
    ctx.fixtureTypeSource,
    ctx.workTypeSource,
    ctx.plumbingExposedSource === 'demo_detected' ? null : ctx.plumbingExposedSource,
    ctx.floorConstructionSource,
  ];
  if (ctx.slabWorkRequired != null) checks.push(ctx.slabWorkRequiredSource);
  return checks.every((source) => source === 'user_selected');
}

export function formatShowerRoughQuantityLabel(fixtureType: BathroomShowerRoughFixtureType): string {
  if (fixtureType === 'shower') return '1 shower rough-in';
  if (fixtureType === 'bathtub') return '1 bathtub rough-in';
  if (fixtureType === 'tub_shower_combo') return '1 tub/shower combination rough-in';
  return '1 shower/tub rough-in';
}

export function formatShowerRoughWorkTypeSummary(workType: BathroomShowerRoughWorkType): string {
  if (workType === 'in_place') return 'Same location';
  if (workType === 'relocation') return 'Relocated';
  return 'Location TBD';
}

export function formatShowerRoughPlumbingExposedSummary(
  ctx: Pick<ShowerRoughPricingContext, 'plumbingExposed' | 'plumbingExposedSource'>
): string {
  if (ctx.plumbingExposed === 'separate_access_required') return 'Separate access required';
  if (ctx.plumbingExposedSource === 'demo_detected') {
    return 'Plumbing exposed by remodel demolition';
  }
  if (ctx.plumbingExposed === 'exposed_by_demo') return 'Plumbing exposed by remodel demolition';
  return 'Plumbing access TBD';
}

export function formatShowerRoughFloorSummary(
  floor: BathroomShowerRoughFloorConstruction
): string {
  if (floor === 'wood_framed') return 'Wood-framed floor';
  if (floor === 'concrete_slab') return 'Concrete slab';
  return 'Floor TBD';
}

export function formatShowerRoughConditionSummary(ctx: ShowerRoughPricingContext): string {
  return [
    formatShowerRoughQuantityLabel(ctx.fixtureType),
    formatShowerRoughWorkTypeSummary(ctx.workType),
    formatShowerRoughPlumbingExposedSummary(ctx),
    formatShowerRoughFloorSummary(ctx.floorConstruction),
  ].join(' · ');
}

export function formatShowerRoughSuggestedTitle(fixtureType: BathroomShowerRoughFixtureType): string {
  if (fixtureType === 'shower') return 'Suggested pricing · shower rough-in';
  if (fixtureType === 'bathtub') return 'Suggested pricing · bathtub rough-in';
  if (fixtureType === 'tub_shower_combo') return 'Suggested pricing · tub/shower rough-in';
  return 'Suggested pricing · shower/tub rough-in';
}

export function formatShowerRoughPlanningRangeLabel(range: {
  low: number;
  high: number;
  highSuffix?: string;
}): string {
  const high = `${range.high.toLocaleString()}${range.highSuffix || ''}`;
  return `Planning range: $${range.low.toLocaleString()}–$${high}`;
}

export function showerRoughPricingRecordId(ctx: ShowerRoughPricingContext): string {
  const slab = ctx.slabWorkRequired ?? 'na';
  return [
    'bps_national:plumbing_rough:bathroom',
    ctx.fixtureType,
    ctx.workType,
    ctx.plumbingExposed,
    ctx.floorConstruction,
    slab,
  ].join(':');
}

export function isShowerRoughSuggestedBlock(pricingRecordId?: string | null): boolean {
  return String(pricingRecordId || '').startsWith('bps_national:plumbing_rough:bathroom:');
}

export function showerRoughContextFromPricingRecord(
  pricingRecordId?: string | null
): ShowerRoughPricingContext | null {
  if (!isShowerRoughSuggestedBlock(pricingRecordId)) return null;
  const parts = String(pricingRecordId).split(':');
  if (parts.length < 8) return null;
  return buildShowerRoughPricingContext({
    fixtureType: parts[3],
    workType: parts[4],
    plumbingExposed: parts[5],
    floorConstruction: parts[6],
    slabWorkRequired: parts[7] === 'na' ? null : parts[7],
  });
}

export function buildShowerRoughPricingDetails(ctx: ShowerRoughPricingContext) {
  const band = resolveShowerRoughBand(ctx);
  const includes = [
    ...SHOWER_ROUGH_INCLUDES,
    ...(band.includesSlabWork ? SHOWER_ROUGH_SLAB_INCLUDES : []),
  ];
  return {
    assumptionText: band.assumptionText,
    includes: [...includes],
    excludes: [...SHOWER_ROUGH_EXCLUDES],
    planningRangeLabel: formatShowerRoughPlanningRangeLabel(band.range),
    disclaimer: SHOWER_ROUGH_PRICING_DISCLAIMER,
    includesScopeLine: 'Includes rough-in materials and labor',
    quantityLabel: formatShowerRoughQuantityLabel(ctx.fixtureType),
    conditionSummary: formatShowerRoughConditionSummary(ctx),
    confidence: resolveShowerRoughConfidence(ctx),
  };
}

export function detectShowerRoughRelocateOverlap(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  workType?: string | null;
}): { overlap: boolean; relatedItemIds: string[] } {
  const items = params.checklistItems || [];
  const relatedItemIds: string[] = [];
  const relocating = params.workType === 'relocation';

  const toilet = items.find((row) => row.id === 'toilet');
  if (toilet && checklistItemInScope(toilet) && toilet.choiceId === 'relocating') {
    relatedItemIds.push('toilet');
  }
  const vanity = items.find((row) => row.id === 'vanity');
  if (vanity && checklistItemInScope(vanity) && vanity.choiceId === 'relocating') {
    relatedItemIds.push('vanity');
  }

  return { overlap: relatedItemIds.length > 0 && relocating, relatedItemIds };
}

export function detectShowerRoughAccessOverlap(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  plumbingExposed?: string | null;
}): boolean {
  return (
    params.plumbingExposed === 'separate_access_required' &&
    demoScopeExposesShowerPlumbing(params.checklistItems)
  );
}

/** @deprecated Use detectShowerRoughRelocateOverlap */
export const detectShowerRoughScopeOverlap = detectShowerRoughRelocateOverlap;

export function shouldShowShowerRoughSlabWorkPrompt(ctx: ShowerRoughPricingContext): boolean {
  return ctx.workType === 'in_place' && ctx.floorConstruction === 'concrete_slab';
}

export function resolveShowerRoughPriceSourceLabel(ctx: ShowerRoughPricingContext): string {
  if (ctx.plumbingExposedSource === 'demo_detected') return SHOWER_ROUGH_DEMO_DETECTED_LABEL;
  if (showerRoughConditionsUserSelected(ctx)) return SHOWER_ROUGH_QUANTITY_SOURCE_SELECTED;
  return 'National Average · planning allowance';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveBathroomPlumbingRoughSuggestedPricing(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  quantity?: number | null;
  fixtureType?: string | null;
  fixtureTypeSource?: string | null;
  workType?: string | null;
  workTypeSource?: string | null;
  plumbingExposed?: string | null;
  plumbingExposedSource?: string | null;
  floorConstruction?: string | null;
  floorConstructionSource?: string | null;
  slabWorkRequired?: string | null;
  slabWorkRequiredSource?: string | null;
  /** @deprecated */
  wallAccess?: string | null;
  wallAccessSource?: string | null;
  /** @deprecated */
  accessType?: string | null;
  /** @deprecated */
  accessFloorType?: string | null;
}): ScopeItemSuggestedPricing | undefined {
  const items = params.checklistItems;
  if (!items?.length) return undefined;
  if (params.quantity != null && params.quantity > 0) return undefined;
  if (!wetAreaInScope(items)) return { fill: null, comparison: null };

  const ctx = buildShowerRoughPricingContext({
    fixtureType: params.fixtureType,
    fixtureTypeSource: params.fixtureTypeSource,
    workType: params.workType,
    workTypeSource: params.workTypeSource,
    plumbingExposed: params.plumbingExposed ?? params.wallAccess,
    plumbingExposedSource: params.plumbingExposedSource ?? params.wallAccessSource,
    floorConstruction: params.floorConstruction,
    floorConstructionSource: params.floorConstructionSource,
    slabWorkRequired: params.slabWorkRequired,
    slabWorkRequiredSource: params.slabWorkRequiredSource,
    legacyAccessType: params.accessType ?? params.accessFloorType,
    checklistItems: items,
  });

  const band = resolveShowerRoughBand(ctx);
  const confidence = resolveShowerRoughConfidence(ctx);
  const details = buildShowerRoughPricingDetails(ctx);

  let helper = band.assumptionText;
  if (ctx.plumbingExposed === 'unsure') {
    helper = ASSUMPTION_EXPOSED_UNSURE;
  }
  if (ctx.slabWorkRequired === 'unsure' && ctx.workType === 'in_place') {
    helper = `${SHOWER_ROUGH_SLAB_UNSURE_STATUS} ${helper}`;
  }

  return {
    fill: {
      material: round2(band.material),
      labor: round2(band.labor),
      total: round2(band.total),
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: `Suggested budget split · ${resolveShowerRoughPriceSourceLabel(ctx)}`,
      helper,
      mode: 'suggested_price',
      basis: { quantity: 1, unit: 'each' },
      comparisonRange: band.range,
      pricingRecordId: showerRoughPricingRecordId(ctx),
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'plumbing_rough',
      benchmarkAction: 'price_ready',
      storedTotalExact: round2(band.total),
      splitConfidence: confidence,
      benchmarkScopeProfile: buildShowerRoughScopeProfile(ctx, band, details),
    },
    comparison: null,
  };
}

function buildShowerRoughScopeProfile(
  ctx: ShowerRoughPricingContext,
  band: ReturnType<typeof resolveShowerRoughBand>,
  details: ReturnType<typeof buildShowerRoughPricingDetails>
): BenchmarkScopeAssumptionProfile {
  const assumptions: BenchmarkScopeAssumption[] = [
    {
      scopeKey: 'planning_context',
      status: 'included',
      displayLabel: 'Shower/tub rough-in allowance',
      notes: band.assumptionText,
      source: 'bps_standard_assumption',
      sourceReference: 'Build Profit bathroom shower/tub rough-in scope model',
      confidence: details.confidence,
      impact: 'medium',
      riskLevel: details.confidence === 'low' ? 'medium' : 'low',
      recommendedContractorAction: 'confirm_conditions',
    },
    ...details.includes.map((label, index) => ({
      scopeKey: `include_${index}`,
      status: 'included' as const,
      displayLabel: label,
      notes: label,
      source: 'bps_standard_assumption' as const,
      sourceReference: 'Build Profit bathroom shower/tub rough-in scope model',
      confidence: details.confidence,
      impact: 'low' as const,
      riskLevel: 'low' as const,
      recommendedContractorAction: 'keep_included' as const,
    })),
    ...details.excludes.map((label, index) => ({
      scopeKey: `exclude_${index}`,
      status: 'excluded' as const,
      displayLabel: label,
      notes: label,
      source: 'bps_standard_assumption' as const,
      sourceReference: 'Build Profit bathroom shower/tub rough-in scope model',
      confidence: details.confidence,
      impact: 'high' as const,
      riskLevel: 'high' as const,
      recommendedContractorAction: 'add_separate_item' as const,
    })),
  ];

  return {
    sourceRecordId: showerRoughPricingRecordId(ctx),
    scopeProfileSource: 'bps_standard_assumption',
    scopeAssumptionsDefined: true,
    scopeAssumptions: assumptions,
    confidence: details.confidence,
    productionStatus: 'review_required',
    audit: {
      rootCause: details.conditionSummary,
      total: band.total,
    },
  };
}
