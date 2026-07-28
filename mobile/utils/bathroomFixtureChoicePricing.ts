import type {
  BenchmarkScopeAssumption,
  BenchmarkScopeAssumptionProfile,
} from '@/utils/benchmarkScopeAssumptions';
import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

export type BathroomFixtureChoiceId =
  | 'staying'
  | 'replacing'
  | 'relocating'
  | 'not_in_scope'
  | 'unsure';

export type BathroomToiletRelocateFloorType =
  | 'open_wood_framed'
  | 'finished_wood_framed'
  | 'concrete_slab'
  | 'unsure';

export type BathroomToiletRelocateFloorTypeSource = 'user_selected' | 'ai_inferred';

export const BATHROOM_TOILET_RELOCATE_FLOOR_OPTIONS: Array<{
  id: BathroomToiletRelocateFloorType;
  label: string;
}> = [
  { id: 'open_wood_framed', label: 'Open wood-framed floor' },
  { id: 'finished_wood_framed', label: 'Finished wood-framed floor' },
  { id: 'concrete_slab', label: 'Concrete slab' },
  { id: 'unsure', label: 'Not sure yet' },
];

export const TOILET_RELOCATE_QUANTITY_SOURCE_USER_FLOOR = 'Based on selected floor type';

export const TOILET_RELOCATE_UNSURE_STATUS =
  'AI assumption — pricing assumes accessible open wood-framed construction. Confirm the floor condition before finalizing the bid.';

export const TOILET_RELOCATE_PRICING_DISCLAIMER =
  'Final cost may vary substantially based on relocation distance, drain and vent access, framing or slab conditions, local labor rates, permits, and finish-restoration requirements.';

const MATERIAL_BUCKET_LABEL = 'Toilet and plumbing relocation materials';
const LABOR_BUCKET_LABEL = 'Plumbing relocation and installation labor';

/** Toilet full replace — fixture + rough-in materials and install labor. */
const TOILET_REPLACE_EACH = {
  material: 425,
  labor: 475,
  total: 900,
} as const;

const GENERAL_EXCLUDES = [
  'Long-distance toilet relocation',
  'Extensive vent-stack rerouting',
  'Structural framing modifications',
  'Post-tension slab work',
  'Permit and inspection fees',
  'Engineering',
  'Premium or specialty toilet fixtures',
  'Extensive tile, flooring, drywall, ceiling, or finish restoration',
] as const;

type ToiletRelocateFloorContent = {
  material: number;
  labor: number;
  total: number;
  range: { low: number; high: number; highSuffix?: string };
  confidence: 'medium' | 'low';
  assumptionText: string;
  includes: string[];
  conditionAssumptions: string[];
  detailsCopy: string;
  planningRangeLabel: string;
  quantitySourceLabel: string;
  helperSuffix: string;
};

const TOILET_RELOCATE_FLOOR_CONTENT: Record<BathroomToiletRelocateFloorType, ToiletRelocateFloorContent> = {
  open_wood_framed: {
    material: 500,
    labor: 1600,
    total: 2100,
    range: { low: 1600, high: 2500 },
    confidence: 'medium',
    assumptionText:
      'Planning allowance for relocating one toilet a relatively short distance during an open remodel where the framing and plumbing are already exposed.',
    includes: [
      'Standard toilet',
      'Removal of the existing toilet',
      'Short-distance relocation of the toilet drain',
      'Minor vent adjustment when required',
      'Relocation of the water-supply connection',
      'New closet flange, fittings, seal, and connection materials',
      'Installation and testing at the new location',
      'Capping or abandoning the old connections',
      'Basic cleanup',
      'Standard contractor labor, overhead, and profit',
    ],
    conditionAssumptions: [
      'Framing and plumbing are already exposed',
      'Existing drain and vent are readily accessible',
      'Toilet is being moved a relatively short distance',
      'No flooring, drywall, ceiling, or structural repair is included',
      'A standard toilet is included',
      'No major joist modification is required',
    ],
    detailsCopy:
      'Assumes open wood-framed construction with exposed and accessible plumbing. Intended for a short-distance toilet relocation during an open remodel.',
    planningRangeLabel: 'Planning range: $1,600–$2,500 each',
    quantitySourceLabel: TOILET_RELOCATE_QUANTITY_SOURCE_USER_FLOOR,
    helperSuffix: 'open wood-framed floor · short-distance relocate',
  },
  finished_wood_framed: {
    material: 655,
    labor: 2095,
    total: 2750,
    range: { low: 2200, high: 3500 },
    confidence: 'medium',
    assumptionText:
      'Planning allowance for relocating one toilet a relatively short distance where the finished floor or ceiling must be opened to access the plumbing.',
    includes: [
      'Standard toilet',
      'Removal of the existing toilet',
      'Short-distance relocation of the toilet drain',
      'Minor vent adjustment when required',
      'Relocation of the water-supply connection',
      'New closet flange, fittings, seal, and connection materials',
      'Installation and testing at the new location',
      'Minor demolition required for plumbing access',
      'Basic patching or restoration allowance',
      'Capping or abandoning the old connections',
      'Basic cleanup',
      'Standard contractor labor, overhead, and profit',
    ],
    conditionAssumptions: [
      'Floor or ceiling must be opened for plumbing access',
      'Relocation remains relatively close to the existing drain and vent',
      'Minor demolition and basic restoration are included',
      'No major joist modification is required',
      'No extensive flooring, ceiling, drywall, or finish replacement is required',
      'A standard toilet is included',
    ],
    detailsCopy:
      'Assumes finished wood-framed construction requiring limited access demolition and basic restoration. Intended for a short-distance toilet relocation without major joist or structural changes.',
    planningRangeLabel: 'Planning range: $2,200–$3,500 each',
    quantitySourceLabel: TOILET_RELOCATE_QUANTITY_SOURCE_USER_FLOOR,
    helperSuffix: 'finished wood-framed floor · short-distance relocate',
  },
  concrete_slab: {
    material: 833,
    labor: 2667,
    total: 3500,
    range: { low: 2500, high: 5000, highSuffix: '+' },
    confidence: 'medium',
    assumptionText:
      'Planning allowance for relocating one toilet a relatively short distance on a conventional concrete slab where the slab must be cut or chipped and patched after the plumbing is moved.',
    includes: [
      'Standard toilet',
      'Removal of the existing toilet',
      'Short-distance relocation of the toilet waste line',
      'Relocation of the water-supply connection',
      'Minor vent adjustment when required',
      'Slab cutting or chipping',
      'Excavation or trench access required for the plumbing relocation',
      'New closet flange, fittings, seal, and connection materials',
      'Installation and testing at the new location',
      'Basic concrete trench patching',
      'Capping or abandoning the old connections',
      'Basic cleanup',
      'Standard contractor labor, overhead, and profit',
    ],
    conditionAssumptions: [
      'Conventional concrete slab',
      'Toilet is being moved a relatively short distance',
      'Waste and water lines remain reasonably accessible',
      'Concrete trench is patched after the plumbing work',
      'Work does not involve a post-tension cable conflict',
      'Extensive tile replacement is excluded',
      'No structural engineering is required',
      'A standard toilet is included',
    ],
    detailsCopy:
      'Assumes a conventional concrete slab requiring cutting or chipping, short-distance plumbing relocation, and basic concrete patching. Post-tension slab work and extensive tile restoration are excluded.',
    planningRangeLabel: 'Planning range: $2,500–$5,000+ each',
    quantitySourceLabel: TOILET_RELOCATE_QUANTITY_SOURCE_USER_FLOOR,
    helperSuffix: 'concrete slab · short-distance relocate',
  },
  unsure: {
    material: 500,
    labor: 1600,
    total: 2100,
    range: { low: 1600, high: 2500 },
    confidence: 'low',
    assumptionText:
      'Planning allowance for relocating one toilet a relatively short distance during an open remodel where the framing and plumbing are already exposed.',
    includes: [
      'Standard toilet',
      'Removal of the existing toilet',
      'Short-distance relocation of the toilet drain',
      'Minor vent adjustment when required',
      'Relocation of the water-supply connection',
      'New closet flange, fittings, seal, and connection materials',
      'Installation and testing at the new location',
      'Capping or abandoning the old connections',
      'Basic cleanup',
      'Standard contractor labor, overhead, and profit',
    ],
    conditionAssumptions: [
      'Framing and plumbing are already exposed',
      'Existing drain and vent are readily accessible',
      'Toilet is being moved a relatively short distance',
      'No flooring, drywall, ceiling, or structural repair is included',
      'A standard toilet is included',
      'No major joist modification is required',
    ],
    detailsCopy:
      'Assumes open wood-framed construction with exposed and accessible plumbing. Intended for a short-distance toilet relocation during an open remodel.',
    planningRangeLabel: 'Planning range: $1,600–$2,500 each',
    quantitySourceLabel: 'AI assumption',
    helperSuffix: 'Planning assumption — accessible wood-framed construction',
  },
};

const BATHROOM_FIXTURE_CHOICE_IDS = new Set<BathroomFixtureChoiceId>([
  'staying',
  'replacing',
  'relocating',
  'not_in_scope',
  'unsure',
]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function scaleSplitToTotal(material: number, labor: number, total: number): { material: number; labor: number } {
  const raw = material + labor;
  if (!(raw > 0) || Math.abs(raw - total) < 0.01) {
    return { material: round2(material), labor: round2(labor) };
  }
  const ratio = total / raw;
  return {
    material: round2(material * ratio),
    labor: round2(labor * ratio),
  };
}

export function normalizeBathroomToiletRelocateFloorType(
  stored?: string | null
): BathroomToiletRelocateFloorType {
  if (
    stored === 'open_wood_framed' ||
    stored === 'finished_wood_framed' ||
    stored === 'concrete_slab' ||
    stored === 'unsure'
  ) {
    return stored;
  }
  return 'unsure';
}

export function isKnownToiletRelocateFloorType(
  floorType?: string | null
): floorType is Exclude<BathroomToiletRelocateFloorType, 'unsure'> {
  return (
    floorType === 'open_wood_framed' ||
    floorType === 'finished_wood_framed' ||
    floorType === 'concrete_slab'
  );
}

export function isToiletRelocateSuggestedBlock(pricingRecordId?: string | null): boolean {
  return String(pricingRecordId || '').includes('toilet:relocate:');
}

export function toiletRelocateFloorTypeFromPricingRecord(
  pricingRecordId?: string | null
): BathroomToiletRelocateFloorType {
  const id = String(pricingRecordId || '');
  if (id.endsWith(':open_wood_framed')) return 'open_wood_framed';
  if (id.endsWith(':finished_wood_framed')) return 'finished_wood_framed';
  if (id.endsWith(':concrete_slab')) return 'concrete_slab';
  return 'unsure';
}

export const TOILET_RELOCATE_EXCLUDES_COMPACT =
  'Excludes long-distance relocation, vent rerouting, structural/slab work, permits, engineering, premium fixtures, and extensive finish restoration.';

export function buildToiletRelocatePricingDetails(floorType: BathroomToiletRelocateFloorType) {
  const content = TOILET_RELOCATE_FLOOR_CONTENT[floorType];
  return {
    assumptionText: content.assumptionText,
    includes: content.includes,
    conditionAssumptions: content.conditionAssumptions,
    excludes: [...GENERAL_EXCLUDES],
    detailsCopy: content.detailsCopy,
    planningRangeLabel: content.planningRangeLabel,
    disclaimer: TOILET_RELOCATE_PRICING_DISCLAIMER,
    excludesCompact: TOILET_RELOCATE_EXCLUDES_COMPACT,
  };
}

export function resolveToiletRelocateQuantitySourceLabel(params: {
  itemId: string;
  choiceId?: string | null;
  floorType?: string | null;
  floorTypeSource?: string | null;
  defaultSourceLabel: string;
}): string {
  if (params.itemId !== 'toilet' || params.choiceId !== 'relocating') {
    return params.defaultSourceLabel;
  }
  const floorType = normalizeBathroomToiletRelocateFloorType(params.floorType);
  if (
    params.floorTypeSource === 'user_selected' &&
    isKnownToiletRelocateFloorType(floorType)
  ) {
    return TOILET_RELOCATE_QUANTITY_SOURCE_USER_FLOOR;
  }
  return params.defaultSourceLabel;
}

export function isBathroomFixtureChoiceScope(
  itemId: string,
  templateKey?: string | null
): boolean {
  if (String(templateKey || '').toLowerCase() !== 'bathroom') return false;
  return itemId === 'toilet' || itemId === 'vanity';
}

function normalizeChoiceId(choiceId?: string | null): BathroomFixtureChoiceId | null {
  if (!choiceId || !BATHROOM_FIXTURE_CHOICE_IDS.has(choiceId as BathroomFixtureChoiceId)) {
    return null;
  }
  return choiceId as BathroomFixtureChoiceId;
}

function scopeAssumption(
  scopeKey: string,
  status: BenchmarkScopeAssumption['status'],
  displayLabel: string,
  notes: string,
  options: Partial<BenchmarkScopeAssumption> = {}
): BenchmarkScopeAssumption {
  return {
    scopeKey,
    status,
    displayLabel,
    notes,
    source: 'bps_standard_assumption',
    sourceReference: 'Build Profit bathroom toilet relocation scope model',
    confidence: options.confidence ?? 'medium',
    impact: options.impact ?? (status === 'included' ? 'low' : 'high'),
    riskLevel: options.riskLevel ?? (status === 'included' ? 'low' : 'high'),
    recommendedContractorAction:
      options.recommendedContractorAction ??
      (status === 'included'
        ? 'keep_included'
        : status === 'conditional'
          ? 'confirm_conditions'
          : 'add_separate_item'),
    conditionText: options.conditionText,
  };
}

function buildToiletRelocateScopeProfile(params: {
  floorType: BathroomToiletRelocateFloorType;
  content: ToiletRelocateFloorContent;
}): BenchmarkScopeAssumptionProfile {
  const { floorType, content } = params;
  const assumptions: BenchmarkScopeAssumption[] = [
    scopeAssumption('planning_context', 'included', 'Toilet relocation allowance', content.assumptionText),
    ...content.includes.map((label, index) =>
      scopeAssumption(`include_${index}`, 'included', label, label)
    ),
    ...content.conditionAssumptions.map((label, index) =>
      scopeAssumption(`condition_${index}`, 'conditional', label, label)
    ),
    ...GENERAL_EXCLUDES.map((label, index) =>
      scopeAssumption(`exclude_${index}`, 'excluded', label, label, {
        recommendedContractorAction: 'add_separate_item',
        impact: 'high',
        riskLevel: 'high',
      })
    ),
  ];

  return {
    sourceRecordId: `bps_national:toilet:relocate:${floorType}`,
    scopeProfileSource: 'bps_standard_assumption',
    scopeAssumptionsDefined: true,
    scopeAssumptions: assumptions,
    confidence: content.confidence,
    productionStatus: 'review_required',
    audit: {
      rootCause: content.detailsCopy,
      total: content.total,
    },
  };
}

function buildToiletRelocatePricing(
  count: number,
  floorType?: string | null
): ScopeItemSuggestedPricing {
  const profileKey = normalizeBathroomToiletRelocateFloorType(floorType);
  const content = TOILET_RELOCATE_FLOOR_CONTENT[profileKey];
  const scaled = scaleSplitToTotal(content.material, content.labor, content.total);
  const material = round2(scaled.material * count);
  const labor = round2(scaled.labor * count);
  const total = round2(content.total * count);
  const materialRate = round2(scaled.material);
  const laborRate = round2(scaled.labor);
  const rangeHighSuffix = content.range.highSuffix ?? '';

  const helper =
    profileKey === 'unsure'
      ? `${count.toLocaleString()} each · ${content.helperSuffix}`
      : `${count.toLocaleString()} each · ${content.helperSuffix}`;

  return {
    fill: {
      material,
      labor,
      total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'Suggested budget split · National Average · toilet relocation',
      helper,
      mode: 'suggested_price',
      basis: { quantity: count, unit: 'each' },
      splitSource: 'source',
      splitConfidence: content.confidence,
      comparisonRange: {
        low: round2(content.range.low * count),
        high: round2(content.range.high * count),
      },
      benchmarkScopeProfile: buildToiletRelocateScopeProfile({
        floorType: profileKey,
        content,
      }),
      costBuckets: [
        {
          key: 'material',
          label: MATERIAL_BUCKET_LABEL,
          amount: material,
          rate: materialRate,
          source: 'national_average',
        },
        {
          key: 'labor',
          label: LABOR_BUCKET_LABEL,
          amount: labor,
          rate: laborRate,
          source: 'national_average',
        },
      ],
      pricingRecordId: `bps_national:toilet:relocate:${profileKey}`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'toilet',
      benchmarkAction: 'price_ready',
      storedTotalExact: total,
      impliedUnitRateLabel: `$${content.total.toLocaleString()}${rangeHighSuffix ? rangeHighSuffix : ''}/each`,
    },
    comparison: null,
  };
}

/**
 * Returns suggested pricing for bathroom fixture choice cards.
 * - `undefined` → fall through to default national-average resolver (e.g. toilet replace).
 * - `{ fill: null }` → choice handled; no suggested price (staying / excluded).
 * - `{ fill: {...} }` → choice-specific band (toilet relocate).
 */
export function resolveBathroomFixtureChoiceSuggestedPricing(params: {
  itemId: string;
  templateKey?: string | null;
  choiceId?: string | null;
  quantity?: number | null;
  unit?: string | null;
  toiletRelocateFloorType?: string | null;
}): ScopeItemSuggestedPricing | undefined {
  const { itemId, templateKey, quantity, unit, toiletRelocateFloorType } = params;
  if (!isBathroomFixtureChoiceScope(itemId, templateKey)) return undefined;

  const choiceId = normalizeChoiceId(params.choiceId);
  if (!choiceId || choiceId === 'not_in_scope' || choiceId === 'unsure') return undefined;

  if (choiceId === 'staying') {
    return { fill: null, comparison: null };
  }

  if (itemId === 'vanity') {
    return choiceId === 'replacing' ? undefined : { fill: null, comparison: null };
  }

  if (itemId !== 'toilet') return undefined;

  if (choiceId === 'replacing') return undefined;

  if (choiceId === 'relocating') {
    const count = unit === 'each' && quantity != null && quantity > 0 ? quantity : 1;
    return buildToiletRelocatePricing(count, toiletRelocateFloorType);
  }

  return undefined;
}

export const BATHROOM_FIXTURE_CHOICE_PRICING = {
  toiletReplaceEach: TOILET_REPLACE_EACH,
  toiletRelocateDefault: TOILET_RELOCATE_FLOOR_CONTENT.open_wood_framed,
  toiletRelocateProfiles: TOILET_RELOCATE_FLOOR_CONTENT,
} as const;

// Back-compat aliases used in tests / card UI
export const TOILET_RELOCATE_PLANNING_ASSUMPTION =
  TOILET_RELOCATE_FLOOR_CONTENT.unsure.helperSuffix;
