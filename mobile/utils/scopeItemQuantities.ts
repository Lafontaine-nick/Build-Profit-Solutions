/**
 * Client-side mirror of bathroom checklist quantity rules for Confirm Scope UI.
 * Backend source of truth: backend/src/services/scopeItemQuantityCatalog.js
 */

import type { EstimateAiDraft, ScopeMeasurements, ScopePricingAcceptanceMetadata } from '@/utils/estimateAiDraft';
import {
  SCOPE_PARSED_FROM_NOTES_LABEL,
  SCOPE_MATERIAL_PARSED_FROM_NOTES_LABEL,
  SCOPE_LABOR_PARSED_FROM_NOTES_LABEL,
} from '@/constants/scopeNoteSourceLabels';
import {
  applyRegionalMultiplierToBudgetSplit,
  resolveRegionalPricingMultiplier,
  type RegionalPricingLocation,
  type ResolvedRegionalPricing,
} from '@/utils/regionalPricingMultipliers';
import {
  applyBuilderBudgetBarometer,
} from '@/utils/southernUtahCalibratedRates';
import { resolveDraftScopeNotes } from '@/utils/estimateAiDraft';
import { parseScopeMeasurementInput } from '@/utils/scopeMeasurements';
import { parseScopeItemAllowancesFromNotes } from '@/utils/scopeAllowanceParser';
import {
  clearStalePricingWhenNotesUnpriced,
  parseScopeMeasurementsFromNotes,
} from '@/utils/scopeMeasurementParser';
import {
  getRatePricingMatcher,
  parseScopeItemRatePricingFromNotes,
  resolveItemRatePricingFromNotes,
} from '@/utils/scopeRatePricingParser';
import {
  emptyQuickMeasurementInput,
  type QuickMeasurementFieldKey,
} from '@/utils/scopeQuickMeasurements';
import {
  createUndefinedBenchmarkScopeProfile,
  type BenchmarkScopeAssumption,
  type BenchmarkScopeAssumptionProfile,
  type ScopeProfileSource,
} from '@/utils/benchmarkScopeAssumptions';
import {
  benchmarkEngineV1Enabled,
  buildBenchmarkProvenance,
  getCachedBenchmarkSuggestion,
  type BenchmarkProvenance,
  type BenchmarkSuggestion,
} from '@/utils/benchmarkEngine';
import {
  benchmarkActionForBlock,
  benchmarkApplicationKey,
  benchmarkStageForScopeKey,
  canApplyStageBenchmarkFill,
  classifyBenchmarkLevel,
  coversLabelList,
  getTradeMeasurementProfile,
  isGroundUpStageComparisonOnly,
  isGrossFlooringDerivedFromLiving,
  isIncludedInStageChild,
  measurementSemanticsV1Enabled,
  missingStatusDisplayLabel,
  NO_LIVING_SF_PRIMARY_SEED_KEYS,
  preferredPrimaryUnit,
  STAGE_COVERS_SCOPE_KEYS,
  STAGE_SEPARATE_TRADE_SCOPE_KEYS,
  stageHasAcceptedTradePricing,
  stageTitle,
  type BenchmarkCardAction,
  type BenchmarkLevel,
} from '@/utils/measurementSemantics';

export type QuantitySource =
  | 'notes'
  | 'user_entered'
  | 'calculated_confirmed'
  | 'manual_override'
  | 'inferred'
  | 'default_assumption'
  | 'missing'
  | 'not_applicable'
  | 'plan_vision';

export type ScopeItemQuantityRule = {
  defaultUnit: string;
  allowedUnits: string[];
  measurementKey?: keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>;
  measurementKeys?: Array<keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>>;
  pricingBasisMeasurementKey?: keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>;
  pricingBasisMeasurementKeys?: Array<keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>>;
  aggregateMeasurementKeys?: Array<keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>>;
  choiceIds?: string[];
  canUseRoomSqft?: boolean;
  requiresUserQuantity?: boolean;
  /** Separate count + dollar allowance inputs (plumbing/electrical rough-in). */
  dualAllowanceField?: boolean;
  /** Flat allowance lines (permits, cleanup, fees) — no material/labor split in UI or suggestions. */
  lumpSumOnly?: boolean;
  /**
   * Deprecated for trade scopes. Soft costs use lumpSumOnly instead.
   * Kept optional for backward-compatible rule reads.
   */
  allowanceOrSplit?: boolean;
  defaultQuantity?: number;
  quantityHelper?: string;
  missingMessage?: string;
};

export const DUAL_ALLOWANCE_ITEM_IDS = ['plumbing_rough', 'electrical_rough'] as const;

export function roughAllowanceSubKey(itemId: string): string {
  return `${itemId}__allowance`;
}

export function isDualAllowanceItem(itemId: string): boolean {
  return Boolean(CHECKLIST_ITEM_QUANTITY_RULES[itemId]?.dualAllowanceField);
}

export const DUAL_QUANTITY_FIELD_LABELS: Record<
  string,
  { count: string; countUnit: string; allowance: string }
> = {
  plumbing_rough: {
    count: 'Rough-in points',
    countUnit: 'points',
    allowance: 'Allowance ($)',
  },
  electrical_rough: {
    count: 'Circuits / devices / boxes',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  backsplash: {
    count: 'Tile area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
  paint: {
    count: 'Paint area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
  shower_tile: {
    count: 'Shower wall tile area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
  flooring: {
    count: 'Flooring area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
  floor_demo: {
    count: 'Floor demo area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
};

export type NormalizedScopeMeasurements = {
  bathroomFloorSqft: number | null;
  kitchenFloorSqft: number | null;
  floorAreaSqft: number | null;
  flooringSqft: number | null;
  backsplashSqft: number | null;
  countertopSqft: number | null;
  cabinetLf: number | null;
  landscapeSqft: number | null;
  sodSqft: number | null;
  paverSqft: number | null;
  rockMulchSqft: number | null;
  landscapeTons: number | null;
  roofSquares: number | null;
  drywallSqft: number | null;
  concreteSqft: number | null;
  concreteCy: number | null;
  excavationCy: number | null;
  deckSqft: number | null;
  garageSqft: number | null;
  exteriorPaintSqft: number | null;
  railingLf: number | null;
  baseboardLf: number | null;
  showerWallTileSqft: number | null;
  showerFloorTileSqft: number | null;
  wallPaintSqft: number | null;
  itemQuantities: Record<string, ScopeItemQuantityValue>;
};

export type ScopeItemQuantityValue = {
  quantity: number | null;
  unit: string;
  quantitySource?: QuantitySource;
  /** Saved when the user switches to a formula quantity so they can revert. */
  quantityBeforeCalculated?: {
    quantity: number | string | null;
    unit: string;
    quantitySource?: QuantitySource;
    pricingAcceptanceBeforeCalculated?: ScopePricingAcceptanceMetadata | null;
    relatedEntries?: Record<
      string,
      {
        quantity: number | string | null;
        unit: string;
        quantitySource?: QuantitySource;
      }
    >;
  };
  /** Cabinets allowance line in notes also covered countertops. */
  includesCountertops?: boolean;
  /** Optional durable primary/pricing/benchmark roles (measurement-semantics). */
  measurementState?: import('@/utils/measurementSemantics').ScopeMeasurementState | null;
};

export type ResolvedItemQuantity = {
  quantity: number | null;
  unit: string;
  quantitySource: QuantitySource;
  sourceLabel: string;
  pricingReady: boolean;
  quantityHelper?: string;
  missingMessage?: string;
  showInput: boolean;
  dualCount?: { quantity: number; unit: string } | null;
  dualMaterial?: { quantity: number; unit: string } | null;
  dualLabor?: { quantity: number; unit: string } | null;
  dualAllowance?: { quantity: number; unit: string } | null;
  /** Parent line shows the single combined $; child line is confirm-only. */
  combinedAllowanceRole?: 'combined_total' | 'included_in_combined';
  combinedAllowanceTotal?: number;
};

export type SuggestedBudgetSplitDisplay = {
  material: number;
  labor: number;
  total: number;
  sourceLabel: string;
  helper: string;
  mode: 'note_total_split' | 'suggested_price';
  basis?: { quantity: number; unit: string } | null;
};

export type NationalAverageBudgetSplit = {
  unit: string;
  material: number;
  labor: number;
  sourceLabel: string;
  effectiveDate?: string | null;
  scopeAssumptions?: BenchmarkScopeAssumptionProfile | null;
  trade?: string;
  category?: string;
  pricingMethod?: 'unit_price' | 'material_labor' | 'lump_sum' | 'allowance' | 'equipment' | 'subcontractor';
  quantityType?: string;
  materialBucketLabel?: string;
  laborBucketLabel?: string;
  rateSource?: 'bps_national_benchmark' | 'bps_southern_utah_calibrated';
  rateSourceReference?: string;
  scopeProfileSource?: ScopeProfileSource;
  productionStatus?: 'production_ready' | 'review_required' | 'fallback_only' | 'disabled';
  geographicBasis?: 'national' | 'state' | 'southern_utah';
  regionalMultiplier?: number;
  regionalStateCode?: string | null;
};

export type SuggestedPricingCostBucketKind =
  | 'material'
  | 'labor'
  | 'equipment'
  | 'subcontractor'
  | 'allowance'
  | 'other_direct_cost';

export type SuggestedPricingCostBucket = {
  key: SuggestedPricingCostBucketKind;
  label: string;
  amount: number;
  rate?: number | null;
  source: PricingLegSource;
};

export type BenchmarkPricingCoverageStatus =
  | 'complete'
  | 'partial'
  | 'rate_only'
  | 'scope_only'
  | 'missing'
  | 'invalid'
  | 'needs_review';

export type BenchmarkPricingProductionStatus =
  | 'production_ready'
  | 'review_required'
  | 'fallback_only'
  | 'disabled';

const NATIONAL_AVERAGE_BUDGET_SPLITS: Record<
  string,
  NationalAverageBudgetSplit
> = {
  trim: { unit: 'lf', material: 2, labor: 5, sourceLabel: 'Suggested budget split · National Average' },
  flooring: { unit: 'sqft', material: 4, labor: 5, sourceLabel: 'Suggested budget split · National Average' },
  floor_demo: { unit: 'sqft', material: 0.5, labor: 5, sourceLabel: 'Suggested budget split · National Average' },
  demo: { unit: 'sqft', material: 0.5, labor: 5, sourceLabel: 'Suggested budget split · National Average' },
  backsplash: { unit: 'sqft', material: 8, labor: 14, sourceLabel: 'Suggested budget split · National Average' },
  paint: {
    unit: 'sqft',
    material: 0.85,
    labor: 2.5,
    sourceLabel: 'Suggested · National Average · wall/ceiling surface sqft',
  },
  interior_paint: {
    unit: 'sqft',
    material: 0.85,
    labor: 2.5,
    sourceLabel: 'Suggested · National Average · wall/ceiling surface sqft',
  },
  exterior_paint: {
    unit: 'sqft',
    material: 0.85,
    labor: 2.5,
    sourceLabel: 'Suggested · National Average · exterior surface sqft',
  },
  shower_tile: { unit: 'sqft', material: 8, labor: 14, sourceLabel: 'Suggested budget split · National Average' },
  floor_tile: { unit: 'sqft', material: 8, labor: 14, sourceLabel: 'Suggested budget split · National Average' },
  /** Basic patch/level prep — not full flooring install. Prior $9/sqft was mis-scoped. */
  floor_prep: {
    unit: 'sqft',
    material: 0.75,
    labor: 1.75,
    sourceLabel: 'Suggested · National Average · basic floor prep (not flooring)',
  },
  waterproofing: { unit: 'sqft', material: 5, labor: 7, sourceLabel: 'Suggested budget split · National Average' },
  electrical_rough: { unit: 'each', material: 50, labor: 125, sourceLabel: 'Suggested budget split · National Average · per circuit/device' },
  plumbing_rough: { unit: 'each', material: 150, labor: 350, sourceLabel: 'Suggested budget split · National Average · per rough-in point' },
  railing: { unit: 'lf', material: 15, labor: 25, sourceLabel: 'Suggested budget split · National Average' },
  pour_flatwork: { unit: 'sqft', material: 4, labor: 6, sourceLabel: 'Suggested budget split · National Average' },
  concrete: { unit: 'sqft', material: 4, labor: 6, sourceLabel: 'Suggested budget split · National Average' },
  drywall: {
    unit: 'sqft',
    material: 1.5,
    labor: 3,
    sourceLabel: 'Suggested · National Average · wall/ceiling surface sqft',
  },
  decking: { unit: 'sqft', material: 8, labor: 12, sourceLabel: 'Suggested budget split · National Average' },
  countertops: { unit: 'sqft', material: 35, labor: 25, sourceLabel: 'Suggested budget split · National Average' },
  cabinets: { unit: 'lf', material: 150, labor: 75, sourceLabel: 'Suggested budget split · National Average' },
  shingles_roofing: { unit: 'squares', material: 350, labor: 450, sourceLabel: 'Suggested budget split · National Average' },
  stucco: {
    unit: 'sqft',
    material: 3.5,
    labor: 5.5,
    sourceLabel: 'Suggested budget split · National Average · exterior wall surface',
  },
  tear_off: { unit: 'squares', material: 50, labor: 200, sourceLabel: 'Suggested budget split · National Average' },
  pavers: { unit: 'sqft', material: 6, labor: 8, sourceLabel: 'Suggested budget split · National Average' },
  permits: {
    unit: 'allowance',
    material: 0,
    labor: 3500,
    sourceLabel: 'Suggested allowance · National Average',
  },
  cleanup: {
    unit: 'lump_sum',
    material: 0,
    labor: 1000,
    sourceLabel: 'Suggested allowance · National Average',
  },
  /** Align with rough Suggested pricing national bands so Step 3 can show splits for note lump sums. */
  framing: {
    unit: 'sqft',
    material: 14,
    labor: 18,
    sourceLabel: 'Suggested budget split · National Average · framing/shell',
  },
  hvac: {
    unit: 'sqft',
    material: 4.5,
    labor: 6,
    sourceLabel: 'Suggested budget split · National Average · HVAC',
  },
  insulation: {
    unit: 'sqft',
    material: 1.25,
    labor: 1.75,
    sourceLabel: 'Suggested budget split · National Average · insulation',
  },
  excavation: {
    unit: 'cy',
    material: 5,
    labor: 45,
    sourceLabel: 'Suggested budget split · National Average · excavation',
  },
  pour_foundation: {
    unit: 'sqft',
    material: 4,
    labor: 6,
    sourceLabel: 'Suggested budget split · National Average · foundation',
  },
};

/** Allowance/lump-sum lines that defaulted to quantity 1 — not a real dollar amount. */
export const PLACEHOLDER_ALLOWANCE_ITEM_IDS = [
  'permits',
  'cleanup',
  'plumbing_trim',
  'electrical_trim',
  'mirror_accessories',
  'plans_engineering',
  'contingency',
  'final_inspections',
  'mobilization',
  'emergency_fee',
  'haul_off',
  'survey',
  'general_conditions',
  'supervision',
  'overhead_profit',
  'cabinets_counters',
] as const;

export function isPlaceholderAllowancePricing(
  quantity: number | null | undefined,
  unit: string | null | undefined,
  itemId?: string | null
): boolean {
  if (
    !itemId ||
    !PLACEHOLDER_ALLOWANCE_ITEM_IDS.includes(itemId as (typeof PLACEHOLDER_ALLOWANCE_ITEM_IDS)[number])
  ) {
    return false;
  }
  if (quantity == null || !Number.isFinite(Number(quantity))) return false;
  const normalizedUnit = String(unit || '').toLowerCase();
  if (normalizedUnit !== 'allowance' && normalizedUnit !== 'lump_sum') return false;
  return Number(quantity) === 1;
}

const NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT: Record<
  string,
  Record<string, NationalAverageBudgetSplit>
> = {
  concrete: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.concrete,
    cy: { unit: 'cy', material: 165, labor: 185, sourceLabel: 'Suggested budget split · National Average' },
  },
  pour_flatwork: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.pour_flatwork,
    cy: { unit: 'cy', material: 165, labor: 185, sourceLabel: 'Suggested budget split · National Average' },
  },
  excavation: {
    cy: { unit: 'cy', material: 5, labor: 45, sourceLabel: 'Suggested budget split · National Average' },
    sqft: { unit: 'sqft', material: 0.5, labor: 2.5, sourceLabel: 'Suggested budget split · National Average' },
    lf: { unit: 'lf', material: 1, labor: 8, sourceLabel: 'Suggested budget split · National Average' },
  },
  hvac: {
    each: {
      unit: 'each',
      material: 5500,
      labor: 4500,
      sourceLabel: 'Suggested budget split · National Average · per HVAC system',
    },
    ton: {
      unit: 'ton',
      material: 2800,
      labor: 2200,
      sourceLabel: 'Suggested budget split · National Average · per ton',
    },
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.hvac,
  },
  windows_doors: {
    each: {
      unit: 'each',
      material: 450,
      labor: 275,
      sourceLabel: 'Suggested budget split · National Average · per opening',
    },
    sqft: {
      unit: 'sqft',
      material: 2.55,
      labor: 1.55,
      sourceLabel: 'Suggested budget split · National Average · openings per living SF',
    },
  },
  plumbing_rough: {
    each: NATIONAL_AVERAGE_BUDGET_SPLITS.plumbing_rough,
    sqft: {
      unit: 'sqft',
      material: 3.3,
      labor: 7.7,
      sourceLabel: 'Suggested budget split · National Average · plumbing rough per living SF',
    },
  },
  electrical_rough: {
    each: NATIONAL_AVERAGE_BUDGET_SPLITS.electrical_rough,
    sqft: {
      unit: 'sqft',
      material: 3.2,
      labor: 7.8,
      sourceLabel: 'Suggested budget split · National Average · electrical rough per living SF',
    },
  },
};

const NATIONAL_AVERAGE_BUDGET_SPLIT_ALIASES: Record<string, string> = {
  hang: 'drywall',
  finish_tape: 'drywall',
  patch_repair: 'drywall',
  /** Ground-up foundation CY uses the concrete CY national band. */
  foundation: 'concrete',
  pour_foundation: 'concrete',
  /** Shower floor tile uses the same $/SF band as shower wall tile. */
  shower_floor_tile: 'shower_tile',
  /** Ground-up roofing squares use the shingles national band. */
  roofing: 'shingles_roofing',
  roof_tie_in: 'shingles_roofing',
  /** Ground-up paint & trim surface SF uses interior paint rates. */
  paint_trim: 'paint',
  /** Combined tile & flooring line uses the flooring $/SF band. */
  tile_flooring: 'flooring',
};

const BPS_SCOPE_SOURCE: ScopeProfileSource = 'bps_standard_assumption';
const BPS_SCOPE_REFERENCE = 'Build Profit national-average scope model';

function assumption(
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
    source: BPS_SCOPE_SOURCE,
    sourceReference: BPS_SCOPE_REFERENCE,
    confidence: options.confidence ?? 'medium',
    impact: options.impact ?? (status === 'included' ? 'low' : 'high'),
    riskLevel: options.riskLevel ?? (status === 'included' ? 'low' : 'high'),
    recommendedContractorAction:
      options.recommendedContractorAction ??
      (status === 'included'
        ? 'keep_included'
        : status === 'conditional'
          ? 'confirm_conditions'
          : status === 'unknown'
            ? 'confirm_before_excluding'
            : 'add_separate_item'),
    conditionText: options.conditionText,
  };
}

const BPS_STANDARD_SCOPE_PROFILES: Record<
  string,
  {
    category: string;
    rootCause: string;
    assumptions: BenchmarkScopeAssumption[];
  }
> = {
  excavation: {
    category: 'sitework',
    rootCause:
      'Build Profit national-average excavation is modeled as base excavation only; adjacent earthwork scopes are separate when required.',
    assumptions: [
      assumption('excavation', 'included', 'Base excavation', 'Excavation of the measured quantity is included.'),
      assumption('equipment', 'included', 'Standard excavation equipment', 'Typical machine cost is embedded in the rate.', { impact: 'medium' }),
      assumption('operator', 'included', 'Operator labor', 'Operator labor for base excavation is included in the labor rate.', { impact: 'medium' }),
      assumption('haul_off', 'excluded', 'Haul-off / export', 'Offsite export is not included in this base excavation suggestion.'),
      assumption('dump_fees', 'excluded', 'Dump fees', 'Disposal facility fees are not included in this base excavation suggestion.'),
      assumption('backfill', 'excluded', 'Backfill', 'Backfill placement or imported fill should be priced separately unless intentionally included.'),
      assumption('compaction', 'excluded', 'Compaction', 'Placement, moisture conditioning, and compaction are not included.'),
      assumption('shoring', 'excluded', 'Shoring', 'Shoring is condition-dependent and not included in this base excavation suggestion.'),
    ],
  },
  concrete: {
    category: 'concrete',
    rootCause:
      'Build Profit national-average concrete is modeled as base material and placement only; access, reinforcement, sawcutting, and disposal are separate scopes.',
    assumptions: [
      assumption('concrete_placement', 'included', 'Concrete placement', 'Base concrete placement for the measured quantity is included.'),
      assumption('finishing', 'included', 'Basic finishing', 'Basic placement finishing is included; decorative or specialty finish scope is not implied.'),
      assumption('pumping', 'excluded', 'Concrete pumping', 'Pump truck or special placement equipment is not included.'),
      assumption('reinforcement', 'excluded', 'Reinforcement', 'Rebar, mesh, chairs, and related reinforcement are not included unless priced separately.'),
      assumption('sawcutting', 'excluded', 'Sawcutting', 'Sawcut control joints are not included in this base concrete suggestion.'),
      assumption('disposal', 'excluded', 'Disposal / haul-off', 'Demo debris, excess concrete, or haul-off is not included.'),
    ],
  },
  pour_flatwork: {
    category: 'concrete',
    rootCause:
      'Build Profit national-average flatwork is modeled as base material and placement only; access, reinforcement, sawcutting, and disposal are separate scopes.',
    assumptions: [
      assumption('concrete_placement', 'included', 'Flatwork placement', 'Base flatwork placement for the measured quantity is included.'),
      assumption('finishing', 'included', 'Basic finishing', 'Basic broom or trowel finish is included; decorative finishing is not implied.'),
      assumption('pumping', 'excluded', 'Concrete pumping', 'Pump truck or special placement equipment is not included.'),
      assumption('reinforcement', 'excluded', 'Reinforcement', 'Rebar, mesh, chairs, and related reinforcement are not included unless priced separately.'),
      assumption('sawcutting', 'excluded', 'Sawcutting', 'Sawcut control joints are not included in this base flatwork suggestion.'),
      assumption('disposal', 'excluded', 'Disposal / haul-off', 'Demo debris, excess concrete, or haul-off is not included.'),
    ],
  },
  flooring: {
    category: 'flooring',
    rootCause: 'Build Profit national-average flooring is modeled as new flooring material plus standard installation.',
    assumptions: [
      assumption('flooring_material', 'included', 'Flooring material', 'Standard flooring material for the measured area is included.'),
      assumption('flooring_installation', 'included', 'Standard installation', 'Standard layout, cutting, and installation labor are included.'),
      assumption('floor_demo', 'excluded', 'Existing-floor demolition', 'Removal of existing flooring is not included.'),
      assumption('disposal', 'excluded', 'Disposal / haul-off', 'Disposal of removed flooring is not included.'),
      assumption('floor_prep', 'excluded', 'Floor prep / leveling', 'Leveling, patching, moisture mitigation, and substrate repair are not included.'),
      assumption('underlayment', 'excluded', 'Underlayment', 'Underlayment is not included unless selected separately.'),
      assumption('transitions', 'excluded', 'Transitions', 'Transitions, thresholds, and reducers are not included.'),
      assumption('baseboard', 'excluded', 'Baseboards', 'Baseboard removal or installation is not included.'),
      assumption('stairs', 'conditional', 'Stairs', 'Stair installation needs separate confirmation and pricing.', {
        conditionText: 'Included only if the measured quantity and rate explicitly account for stairs.',
        recommendedContractorAction: 'confirm_conditions',
      }),
    ],
  },
  floor_tile: {
    category: 'tile',
    rootCause: 'Build Profit national-average floor tile is modeled as tile material plus standard tile installation.',
    assumptions: [
      assumption('tile_material', 'included', 'Tile material', 'Standard tile material for the measured area is included.'),
      assumption('tile_installation', 'included', 'Standard tile installation', 'Standard thinset/grout installation labor is included.'),
      assumption('floor_demo', 'excluded', 'Existing-floor demolition', 'Removal of existing flooring is not included.'),
      assumption('floor_prep', 'excluded', 'Floor prep / leveling', 'Substrate prep, leveling, and repair are not included.'),
      assumption('underlayment', 'excluded', 'Underlayment / backer board', 'Backer board, uncoupling membrane, or underlayment is not included.'),
      assumption('transitions', 'excluded', 'Transitions', 'Transitions and thresholds are not included.'),
    ],
  },
  shower_tile: {
    category: 'tile',
    rootCause: 'Build Profit national-average shower tile is modeled as tile material plus standard wall/floor tile labor.',
    assumptions: [
      assumption('tile_material', 'included', 'Tile material', 'Standard tile material for the measured shower area is included.'),
      assumption('tile_installation', 'included', 'Standard tile installation', 'Standard tile setting and grout labor are included.'),
      assumption('waterproofing', 'excluded', 'Waterproofing', 'Waterproofing membrane/system is not included unless priced separately.'),
      assumption('backer_board', 'excluded', 'Backer board', 'Backer board or substrate replacement is not included.'),
      assumption('niche_bench', 'excluded', 'Niches / benches', 'Niches, benches, and specialty layouts are not included.'),
    ],
  },
  paint: {
    category: 'paint',
    rootCause:
      'Build Profit national-average paint is modeled per wall/ceiling surface sqft (not floor area) as standard paint material, labor, and basic prep.',
    assumptions: [
      assumption('paint_material', 'included', 'Paint material', 'Standard paint material is included.'),
      assumption('paint_labor', 'included', 'Standard paint labor', 'Standard application labor is included.'),
      assumption('surface_basis', 'included', 'Wall/ceiling surface basis', 'Rates apply to paintable wall/ceiling surface area, not floor sqft.', {
        impact: 'medium',
      }),
      assumption('prep', 'included', 'Basic prep', 'Minor surface prep, masking, and cleanup are included.', { impact: 'medium' }),
      assumption('repairs', 'excluded', 'Wall repairs', 'Drywall/plaster repairs and texture repair are not included.'),
      assumption('doors', 'excluded', 'Doors', 'Door painting is not included unless scoped separately.'),
      assumption('trim', 'excluded', 'Trim', 'Trim painting is not included unless scoped separately.'),
      assumption('high_access', 'conditional', 'High ceilings / access', 'High ceilings, scaffolding, lifts, or difficult access require confirmation.', {
        conditionText: 'Price separately when height or access is outside normal reach.',
      }),
      assumption('specialty_finish', 'excluded', 'Specialty finishes', 'Specialty coatings, cabinet finishes, and decorative finishes are not included.'),
    ],
  },
  interior_paint: {
    category: 'paint',
    rootCause:
      'Build Profit national-average interior paint is modeled per wall/ceiling surface sqft (not floor area) as standard paint material, labor, and basic prep.',
    assumptions: [
      assumption('paint_material', 'included', 'Paint material', 'Standard interior paint material is included.'),
      assumption('paint_labor', 'included', 'Standard paint labor', 'Standard wall/ceiling application labor is included.'),
      assumption('surface_basis', 'included', 'Wall/ceiling surface basis', 'Rates apply to paintable wall/ceiling surface area, not floor sqft.', {
        impact: 'medium',
      }),
      assumption('prep', 'included', 'Basic prep', 'Minor prep, masking, and cleanup are included.', { impact: 'medium' }),
      assumption('repairs', 'excluded', 'Wall repairs', 'Drywall/plaster repairs and texture repair are not included.'),
      assumption('doors', 'excluded', 'Doors', 'Door painting is not included unless scoped separately.'),
      assumption('trim', 'excluded', 'Trim', 'Trim painting is not included unless scoped separately.'),
    ],
  },
  exterior_paint: {
    category: 'paint',
    rootCause:
      'Build Profit national-average exterior paint is modeled per exterior surface sqft (not floor area) as standard exterior paint material, labor, and basic prep.',
    assumptions: [
      assumption('paint_material', 'included', 'Exterior paint material', 'Standard exterior paint material is included.'),
      assumption('paint_labor', 'included', 'Standard paint labor', 'Standard exterior application labor is included.'),
      assumption('surface_basis', 'included', 'Exterior surface basis', 'Rates apply to exterior painted surface area, not floor sqft.', {
        impact: 'medium',
      }),
      assumption('prep', 'included', 'Basic prep', 'Minor prep and cleanup are included.', { impact: 'medium' }),
      assumption('repairs', 'excluded', 'Exterior repairs', 'Siding, trim, stucco, or substrate repairs are not included.'),
      assumption('high_access', 'conditional', 'Access equipment', 'Ladders, lifts, scaffolding, or difficult access require confirmation.', {
        conditionText: 'Price separately when access is outside standard ladder work.',
      }),
    ],
  },
  drywall: {
    category: 'drywall',
    rootCause:
      'Build Profit national-average drywall is modeled per wall/ceiling surface sqft (not floor area) as board, hang, tape, finish, and standard texture.',
    assumptions: [
      assumption('drywall_board', 'included', 'Drywall board', 'Standard drywall board material is included.'),
      assumption('hang', 'included', 'Hang drywall', 'Standard drywall hanging labor is included.'),
      assumption('finish_tape', 'included', 'Tape and finish', 'Standard taping and finishing are included.'),
      assumption('texture', 'included', 'Standard texture', 'Standard texture is included where typical for the job.', { impact: 'medium' }),
      assumption('surface_basis', 'included', 'Wall/ceiling surface basis', 'Rates apply to drywall surface area, not floor sqft.', {
        impact: 'medium',
      }),
      assumption('demo', 'excluded', 'Demolition', 'Removal of existing wall/ceiling material is not included.'),
      assumption('disposal', 'excluded', 'Disposal / haul-off', 'Debris disposal is not included.'),
      assumption('insulation', 'excluded', 'Insulation', 'Insulation is not included.'),
      assumption('fire_rating', 'conditional', 'Fire-rated assemblies', 'Fire-rated or specialty assemblies require confirmation.', {
        conditionText: 'Price separately when a rated assembly is required.',
      }),
      assumption('level_5', 'excluded', 'Level 5 finish', 'Level 5 finish is not included.'),
      assumption('paint', 'excluded', 'Painting', 'Primer and paint are not included.'),
    ],
  },
  plumbing_rough: {
    category: 'plumbing',
    rootCause:
      'Build Profit national-average plumbing rough-in is modeled per rough-in point (fixture stub-out), not per floor sqft.',
    assumptions: [
      assumption('rough_labor', 'included', 'Rough-in labor', 'Standard rough-in labor is included.'),
      assumption('standard_fittings', 'included', 'Standard fittings', 'Common rough-in fittings and supplies are included.'),
      assumption('point_basis', 'included', 'Per rough-in point', 'Rates are per supply/drain rough-in point, not floor sqft.', {
        impact: 'medium',
      }),
      assumption('fixtures', 'excluded', 'Fixtures', 'Fixtures and trim-out are not included.'),
      assumption('permits', 'excluded', 'Permits', 'Permits and inspection fees are not included.'),
      assumption('trenching', 'excluded', 'Trenching', 'Trenching, sawcutting, and excavation are not included.'),
      assumption('patching', 'excluded', 'Patching', 'Wall, floor, and concrete patching are not included.'),
      assumption('testing', 'conditional', 'Testing', 'Pressure testing and special inspections require confirmation.', {
        conditionText: 'Include only when required testing is part of the rough-in scope.',
      }),
    ],
  },
  electrical_rough: {
    category: 'electrical',
    rootCause:
      'Build Profit national-average electrical rough-in is modeled per circuit/device/box, not per floor sqft.',
    assumptions: [
      assumption('wiring', 'included', 'Standard wiring', 'Standard branch wiring is included.'),
      assumption('device_boxes', 'included', 'Boxes / rough devices', 'Standard boxes and rough device installation are included.'),
      assumption('point_basis', 'included', 'Per circuit/device', 'Rates are per circuit, device, or box affected, not floor sqft.', {
        impact: 'medium',
      }),
      assumption('fixtures', 'excluded', 'Fixtures', 'Light fixtures and finish devices are not included.'),
      assumption('permits', 'excluded', 'Permits', 'Permits and utility fees are not included.'),
      assumption('panel_upgrade', 'excluded', 'Panel / service upgrade', 'Panel, service, and meter upgrades are not included.'),
      assumption('trenching', 'excluded', 'Trenching', 'Trenching and underground conduit work are not included.'),
      assumption('patching', 'excluded', 'Patching', 'Wall, ceiling, and concrete patching are not included.'),
      assumption('controls', 'conditional', 'Specialty controls', 'Dimmers, smart controls, low-voltage, and specialty systems require confirmation.', {
        conditionText: 'Price separately when specialty controls are required.',
      }),
    ],
  },
  cabinets: {
    category: 'cabinets',
    rootCause: 'Build Profit national-average cabinets are modeled as cabinet boxes plus standard installation.',
    assumptions: [
      assumption('cabinet_boxes', 'included', 'Cabinet boxes', 'Standard cabinet boxes are included.'),
      assumption('installation', 'included', 'Standard installation', 'Standard cabinet installation labor is included.'),
      assumption('hardware', 'included', 'Basic hardware', 'Basic standard hardware is included when typical.', { impact: 'medium' }),
      assumption('demo', 'excluded', 'Demolition', 'Existing cabinet removal is not included.'),
      assumption('disposal', 'excluded', 'Disposal / haul-off', 'Disposal of removed cabinets is not included.'),
      assumption('countertops', 'excluded', 'Countertops', 'Countertops are not included.'),
      assumption('trim', 'excluded', 'Crown / specialty trim', 'Crown, fillers, panels, and specialty trim are not included.'),
      assumption('appliance_panels', 'excluded', 'Appliance panels', 'Appliance panels and custom modifications are not included.'),
      assumption('plumbing_reconnect', 'excluded', 'Plumbing reconnection', 'Sink/faucet/disposal reconnection is not included.'),
    ],
  },
  countertops: {
    category: 'countertops',
    rootCause: 'Build Profit national-average countertops are modeled as countertop material, fabrication, and standard installation.',
    assumptions: [
      assumption('countertop_material', 'included', 'Countertop material', 'Standard countertop material is included.'),
      assumption('fabrication', 'included', 'Fabrication', 'Standard fabrication is included.'),
      assumption('installation', 'included', 'Standard installation', 'Standard countertop installation is included.'),
      assumption('standard_edge', 'included', 'Standard edge', 'A standard edge profile is included.', { impact: 'medium' }),
      assumption('demo', 'excluded', 'Demolition', 'Existing countertop removal is not included.'),
      assumption('disposal', 'excluded', 'Disposal / haul-off', 'Disposal of removed countertops is not included.'),
      assumption('plumbing_reconnect', 'excluded', 'Plumbing reconnect', 'Plumbing disconnect/reconnect is not included.'),
      assumption('sink', 'excluded', 'Sink', 'Sink purchase or specialty sink work is not included.'),
      assumption('backsplash', 'excluded', 'Backsplash', 'Backsplash is not included.'),
      assumption('support', 'conditional', 'Structural support', 'Brackets, substrate, or structural support require confirmation.', {
        conditionText: 'Price separately when additional support is required.',
      }),
    ],
  },
  shingles_roofing: {
    category: 'roofing',
    rootCause: 'Build Profit national-average roofing is modeled as new roofing material and standard installation.',
    assumptions: [
      assumption('roofing_material', 'included', 'Roofing material', 'Standard shingle roofing material is included.'),
      assumption('underlayment', 'included', 'Underlayment', 'Standard underlayment is included.'),
      assumption('roof_installation', 'included', 'Standard installation', 'Standard roofing installation labor is included.'),
      assumption('flashing', 'conditional', 'Flashing', 'Basic flashing may be included; extensive flashing replacement requires confirmation.', {
        conditionText: 'Confirm whether required flashing is standard or needs separate pricing.',
      }),
      assumption('tear_off', 'excluded', 'Tear-off', 'Existing roofing tear-off is not included.'),
      assumption('disposal', 'excluded', 'Disposal / haul-off', 'Disposal of removed roofing is not included.'),
      assumption('permits', 'excluded', 'Permits', 'Roofing permits are not included.'),
      assumption('deck_repair', 'excluded', 'Deck repair', 'Roof deck repair or sheathing replacement is not included.'),
      assumption('steep_slope', 'conditional', 'Steep slope / difficult access', 'Steep-slope, height, or difficult access premiums require confirmation.', {
        conditionText: 'Price separately when roof pitch/access exceeds standard installation.',
      }),
      assumption('gutters', 'excluded', 'Gutters', 'Gutters and downspouts are not included.'),
      assumption('skylights', 'excluded', 'Skylights', 'Skylights and specialty penetrations are not included.'),
    ],
  },
  tear_off: {
    category: 'roofing',
    rootCause: 'Build Profit national-average tear-off is modeled as roofing removal labor plus basic disposal handling.',
    assumptions: [
      assumption('tear_off', 'included', 'Roof tear-off', 'Removal of existing roofing for the measured squares is included.'),
      assumption('loading', 'included', 'Loading debris', 'Loading removed roofing into disposal container is included.'),
      assumption('disposal', 'conditional', 'Disposal / dump fees', 'Disposal fees require confirmation because local fees vary.', {
        conditionText: 'Add separate pricing when dump fees are not included in the removal rate.',
      }),
      assumption('deck_repair', 'excluded', 'Deck repair', 'Roof deck repair is not included.'),
      assumption('multiple_layers', 'conditional', 'Multiple layers', 'Multiple layers require confirmation and may need separate pricing.', {
        conditionText: 'Price separately when more than one layer is removed.',
      }),
    ],
  },
  permits: {
    category: 'permits',
    rootCause: 'Build Profit national-average permit pricing is modeled as a placeholder permit/inspection allowance.',
    assumptions: [
      assumption('building_permit', 'included', 'Building permit allowance', 'A basic building permit allowance is included.'),
      assumption('standard_inspections', 'included', 'Standard inspections', 'Standard inspection fees are included as an allowance.', { impact: 'medium' }),
      assumption('impact_fees', 'excluded', 'Impact fees', 'Impact, school, utility, and connection fees are not included.'),
      assumption('meter_fees', 'excluded', 'Meter fees', 'Meter or utility service fees are not included.'),
      assumption('engineering_review', 'excluded', 'Engineering / special review', 'Engineering, fire, special inspection, and expedited review fees are not included.'),
      assumption('reinspection_fees', 'excluded', 'Reinspection fees', 'Reinspection or penalty fees are not included.'),
    ],
  },
  cleanup: {
    category: 'cleanup',
    rootCause: 'Build Profit national-average cleanup is modeled as a job cleanup allowance.',
    assumptions: [
      assumption('cleanup', 'included', 'Final cleanup allowance', 'Basic job cleanup allowance is included.'),
      assumption('loading', 'included', 'Loading light debris', 'Loading light construction debris is included as part of cleanup.', { impact: 'medium' }),
      assumption('dump_fees', 'excluded', 'Dump fees', 'Dump fees and landfill charges are not included unless confirmed.'),
      assumption('hazardous_materials', 'excluded', 'Hazardous materials', 'Hazardous material handling is not included.'),
      assumption('large_haul_off', 'conditional', 'Large haul-off', 'Large dumpsters or heavy debris require confirmation.', {
        conditionText: 'Price separately when cleanup requires dumpsters, heavy debris, or multiple loads.',
      }),
    ],
  },
  demo: {
    category: 'demolition',
    rootCause: 'Build Profit national-average demolition is modeled as standard removal labor with light loading.',
    assumptions: [
      assumption('removal', 'included', 'Demolition labor', 'Standard removal labor for the measured area is included.'),
      assumption('loading', 'included', 'Loading debris', 'Loading debris is included.', { impact: 'medium' }),
      assumption('dump_fees', 'excluded', 'Dump fees', 'Dump fees and disposal facility costs are not included.'),
      assumption('hazardous_materials', 'excluded', 'Hazardous materials', 'Hazardous materials and abatement are not included.'),
      assumption('protection', 'excluded', 'Protection', 'Dust protection, containment, and specialty protection are not included.'),
    ],
  },
  floor_demo: {
    category: 'demolition',
    rootCause: 'Build Profit national-average floor demolition is modeled as flooring removal labor with light loading.',
    assumptions: [
      assumption('floor_demo', 'included', 'Floor removal', 'Removal of existing flooring for the measured area is included.'),
      assumption('loading', 'included', 'Loading debris', 'Loading removed flooring is included.', { impact: 'medium' }),
      assumption('dump_fees', 'excluded', 'Dump fees', 'Dump fees and disposal facility costs are not included.'),
      assumption('subfloor_repair', 'excluded', 'Subfloor repair', 'Subfloor repair or leveling is not included.'),
    ],
  },
  trim: {
    category: 'finish_carpentry',
    rootCause: 'Build Profit national-average trim is modeled as standard trim material plus installation.',
    assumptions: [
      assumption('trim_material', 'included', 'Trim material', 'Standard trim material is included.'),
      assumption('trim_installation', 'included', 'Trim installation', 'Standard trim installation labor is included.'),
      assumption('paint', 'excluded', 'Painting / finishing', 'Painting, staining, or finishing trim is not included.'),
      assumption('demo', 'excluded', 'Existing trim removal', 'Existing trim removal and disposal are not included.'),
    ],
  },
  backsplash: {
    category: 'tile',
    rootCause: 'Build Profit national-average backsplash is modeled as backsplash tile material plus standard installation.',
    assumptions: [
      assumption('tile_material', 'included', 'Backsplash tile material', 'Standard backsplash tile material is included.'),
      assumption('tile_installation', 'included', 'Backsplash installation', 'Standard backsplash tile installation labor is included.'),
      assumption('wall_prep', 'excluded', 'Wall prep / repair', 'Wall repair, substrate replacement, and leveling are not included.'),
      assumption('specialty_pattern', 'conditional', 'Specialty pattern', 'Specialty layout or pattern work requires confirmation.', {
        conditionText: 'Price separately for complex pattern, mosaic, or specialty layout.',
      }),
    ],
  },
  waterproofing: {
    category: 'waterproofing',
    rootCause: 'Build Profit national-average waterproofing is modeled as membrane/material plus standard installation.',
    assumptions: [
      assumption('waterproofing_material', 'included', 'Waterproofing material', 'Standard membrane/liquid waterproofing material is included.'),
      assumption('waterproofing_labor', 'included', 'Waterproofing labor', 'Standard waterproofing installation labor is included.'),
      assumption('substrate_repair', 'excluded', 'Substrate repair', 'Substrate repair or replacement is not included.'),
      assumption('flood_test', 'conditional', 'Flood test', 'Flood testing requires confirmation.', {
        conditionText: 'Include only when required by scope, code, or inspector.',
      }),
    ],
  },
  floor_prep: {
    category: 'flooring',
    rootCause:
      'Build Profit national-average floor prep is modeled as basic patch/level prep (~$2.50/sqft), not full flooring material and install.',
    assumptions: [
      assumption('floor_prep', 'included', 'Basic floor prep', 'Basic patching and light leveling for the measured area are included.'),
      assumption('leveling', 'conditional', 'Heavy self-leveling', 'Significant self-leveling compound and labor require confirmation.', {
        conditionText: 'Price separately when floor flatness requires substantial leveling material/labor.',
      }),
      assumption('flooring_material', 'excluded', 'Flooring material', 'Finished flooring material is not included — use Flooring scope.'),
      assumption('flooring_install', 'excluded', 'Flooring install', 'Finished flooring installation is not included — use Flooring scope.'),
      assumption('moisture_mitigation', 'excluded', 'Moisture mitigation', 'Moisture mitigation systems are not included.'),
      assumption('subfloor_repair', 'excluded', 'Subfloor repair', 'Subfloor replacement or structural repair is not included.'),
    ],
  },
  cabinets_counters: {
    category: 'cabinets',
    rootCause: 'Build Profit combined cabinet/counter allowance is a placeholder allowance and should be reviewed before production use.',
    assumptions: [
      assumption('cabinets', 'conditional', 'Cabinets', 'Cabinet scope must be confirmed for combined allowances.', {
        conditionText: 'Use only when the allowance intentionally covers cabinets.',
      }),
      assumption('countertops', 'conditional', 'Countertops', 'Countertop scope must be confirmed for combined allowances.', {
        conditionText: 'Use only when the allowance intentionally covers countertops.',
      }),
    ],
  },
  decking: {
    category: 'decking',
    rootCause: 'Build Profit national-average decking is modeled as decking material plus standard installation.',
    assumptions: [
      assumption('decking_material', 'included', 'Decking material', 'Standard decking material is included.'),
      assumption('decking_labor', 'included', 'Decking installation', 'Standard decking installation labor is included.'),
      assumption('framing', 'excluded', 'Deck framing', 'Structural framing, posts, footings, and beams are not included.'),
      assumption('railing', 'excluded', 'Railing', 'Deck railing is not included.'),
      assumption('stairs', 'excluded', 'Stairs', 'Deck stairs are not included.'),
      assumption('demo', 'excluded', 'Demolition', 'Existing deck demolition and disposal are not included.'),
    ],
  },
  railing: {
    category: 'railing',
    rootCause: 'Build Profit national-average railing is modeled as standard railing material plus installation.',
    assumptions: [
      assumption('railing_material', 'included', 'Railing material', 'Standard railing material is included.'),
      assumption('railing_labor', 'included', 'Railing installation', 'Standard railing installation labor is included.'),
      assumption('blocking', 'excluded', 'Blocking / structural support', 'Blocking or structural reinforcement is not included.'),
      assumption('stairs', 'conditional', 'Stair railing', 'Stair railing requires confirmation.', {
        conditionText: 'Price separately when railing is on stairs or complex geometry.',
      }),
    ],
  },
  pavers: {
    category: 'sitework',
    rootCause: 'Build Profit national-average pavers are modeled as paver material plus basic installation.',
    assumptions: [
      assumption('paver_material', 'included', 'Paver material', 'Standard paver material is included.'),
      assumption('paver_installation', 'included', 'Paver installation', 'Basic paver installation labor is included.'),
      assumption('excavation', 'excluded', 'Excavation', 'Excavation and subgrade preparation are not included.'),
      assumption('base_material', 'excluded', 'Base material', 'Base rock, bedding sand, and compaction are not included unless priced separately.'),
      assumption('edge_restraint', 'excluded', 'Edge restraint', 'Edge restraint is not included.'),
      assumption('drainage', 'conditional', 'Drainage', 'Drainage requirements need confirmation.', {
        conditionText: 'Price separately when drainage improvements are required.',
      }),
    ],
  },
};

function canonicalNationalAverageItemKey(itemId: string): string {
  const aliased = NATIONAL_AVERAGE_BUDGET_SPLIT_ALIASES[itemId] || itemId;
  if (aliased === 'interior_paint' || aliased === 'exterior_paint') return aliased;
  return aliased;
}

function buildNationalAverageDefinedScopeProfile(params: {
  itemId: string;
  average: NationalAverageBudgetSplit;
  quantity?: number | null;
  total?: number | null;
  regional?: ResolvedRegionalPricing | null;
}): BenchmarkScopeAssumptionProfile | null {
  const profileKey = canonicalNationalAverageItemKey(params.itemId);
  const definition = BPS_STANDARD_SCOPE_PROFILES[profileKey];
  if (!definition) return null;
  const geographicBasis = params.regional?.geographicBasis || params.average.geographicBasis || 'national';
  return {
    sourceRecordId: `national_average:${params.itemId}:${params.average.unit}`,
    parentPricingRecordId: `bps_national:${profileKey}:${params.average.unit}`,
    pricingSource: 'national_average',
    rateSource: params.average.rateSource || 'bps_national_benchmark',
    rateSourceReference: params.average.rateSourceReference || 'Build Profit national-average rate table',
    geographicBasis,
    effectiveDate: params.average.effectiveDate ?? null,
    verifiedAt: null,
    scopeProfileSource: BPS_SCOPE_SOURCE,
    scopeAssumptionsDefined: true,
    scopeAssumptions: definition.assumptions,
    confidence: 'low',
    confidenceReasons: [
      'bps_standard_scope_profile',
      'national_rate_geographic_basis',
      'freshness_not_verified',
    ],
    productionStatus: params.average.productionStatus || 'review_required',
    audit: {
      quantity: params.quantity,
      unit: params.average.unit,
      materialRate: params.average.material,
      laborRate: params.average.labor,
      equipmentRate: null,
      total: params.total,
      rootCause: definition.rootCause,
    },
  };
}

function costBucketKindForLabel(label: string): SuggestedPricingCostBucketKind {
  const normalized = label.toLowerCase();
  if (normalized.includes('equipment')) return 'equipment';
  if (normalized.includes('allowance')) return 'allowance';
  if (normalized.includes('subcontract')) return 'subcontractor';
  if (normalized.includes('labor')) return 'labor';
  if (normalized.includes('material')) return 'material';
  return 'other_direct_cost';
}

function nationalAverageMaterialBucketLabel(itemId: string, average?: NationalAverageBudgetSplit | null): string {
  if (average?.materialBucketLabel) return average.materialBucketLabel;
  if (itemId === 'excavation') return 'Equipment';
  return 'Material';
}

function nationalAverageLaborBucketLabel(itemId: string, average?: NationalAverageBudgetSplit | null): string {
  if (average?.laborBucketLabel) return average.laborBucketLabel;
  if (average?.unit === 'allowance' || average?.unit === 'lump_sum') return 'Allowance';
  return 'Labor';
}

function buildSuggestedPricingCostBuckets(params: {
  itemId: string;
  average?: NationalAverageBudgetSplit | null;
  material: number;
  labor: number;
  materialSource: PricingLegSource;
  laborSource: PricingLegSource;
  materialRate?: number | null;
  laborRate?: number | null;
  lumpSumOnly?: boolean;
}): SuggestedPricingCostBucket[] {
  if (params.lumpSumOnly) {
    return [
      {
        key: 'allowance',
        label: 'Allowance',
        amount: round2(params.material + params.labor),
        rate: null,
        source: params.laborSource,
      },
    ];
  }
  const buckets: SuggestedPricingCostBucket[] = [];
  if (params.material > 0) {
    const label = nationalAverageMaterialBucketLabel(params.itemId, params.average);
    buckets.push({
      key: costBucketKindForLabel(label),
      label,
      amount: params.material,
      rate: params.materialRate,
      source: params.materialSource,
    });
  }
  if (params.labor > 0) {
    const label = nationalAverageLaborBucketLabel(params.itemId, params.average);
    buckets.push({
      key: costBucketKindForLabel(label),
      label,
      amount: params.labor,
      rate: params.laborRate,
      source: params.laborSource,
    });
  }
  return buckets;
}

export function getNationalAverageBudgetSplit(itemId: string, unit?: string | null) {
  const key = NATIONAL_AVERAGE_BUDGET_SPLIT_ALIASES[itemId] || itemId;
  const normalizedUnit = String(unit || '').toLowerCase();
  if (normalizedUnit && NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT[key]?.[normalizedUnit]) {
    return NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT[key][normalizedUnit];
  }
  return (
    NATIONAL_AVERAGE_BUDGET_SPLITS[key] ??
    NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT[key]?.[Object.keys(NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT[key] || {})[0]]
  );
}

/** National-average rates adjusted for the customer's state when available. */
export function getRegionalAdjustedNationalAverageBudgetSplit(
  itemId: string,
  unit?: string | null,
  location?: RegionalPricingLocation | ScopePricingContext | null
) {
  return regionalAdjustedNationalAverage(itemId, unit, location);
}

export type BenchmarkPricingCatalogRecord = {
  id: string;
  itemKey: string;
  trade: string;
  category: string;
  pricingMethod: NonNullable<NationalAverageBudgetSplit['pricingMethod']>;
  quantityType: string;
  unit: string;
  materialRate: number;
  laborRate: number;
  equipmentRate: number | null;
  subcontractorRate: number | null;
  combinedRate: number;
  rateSource: string;
  rateSourceReference: string;
  geographicBasis: 'national';
  effectiveDate: string | null;
  verifiedAt: string | null;
  scopeProfileSource: ScopeProfileSource;
  scopeAssumptionsDefined: boolean;
  scopeAssumptionCount: number;
  includedAssumptionCount: number;
  excludedAssumptionCount: number;
  conditionalAssumptionCount: number;
  freshnessKnown: boolean;
  pricingCoverage: BenchmarkPricingCoverageStatus;
  scopeProfileCoverage: BenchmarkPricingCoverageStatus;
  sourceCoverage: BenchmarkPricingCoverageStatus;
  freshnessCoverage: BenchmarkPricingCoverageStatus;
  productionStatus: BenchmarkPricingProductionStatus;
  productionReady: boolean;
  confidence: 'high' | 'medium' | 'low';
  confidenceReasons: string[];
  costBucketLabels: string[];
};

function categoryForNationalAverageItem(itemKey: string, average: NationalAverageBudgetSplit): string {
  if (average.category) return average.category;
  return BPS_STANDARD_SCOPE_PROFILES[canonicalNationalAverageItemKey(itemKey)]?.category || 'general';
}

function tradeForNationalAverageItem(itemKey: string, average: NationalAverageBudgetSplit): string {
  if (average.trade) return average.trade;
  const category = categoryForNationalAverageItem(itemKey, average);
  if (category === 'paint') return 'painting';
  if (category === 'finish_carpentry') return 'carpentry';
  return category;
}

function pricingCoverageForRecord(average: NationalAverageBudgetSplit): BenchmarkPricingCoverageStatus {
  const hasUnit = Boolean(average.unit);
  const hasRate = Number(average.material) > 0 || Number(average.labor) > 0;
  if (!hasUnit || !hasRate) return 'invalid';
  return 'complete';
}

function scopeCoverageForProfile(profile: BenchmarkScopeAssumptionProfile | undefined): BenchmarkPricingCoverageStatus {
  if (!profile) return 'missing';
  if (!profile.scopeAssumptionsDefined) return 'missing';
  const hasIncluded = profile.scopeAssumptions.some((assumption) => assumption.status === 'included');
  const hasActionable = profile.scopeAssumptions.some(
    (assumption) => assumption.status === 'excluded' || assumption.status === 'conditional' || assumption.status === 'unknown'
  );
  if (hasIncluded && hasActionable) return 'complete';
  if (hasIncluded || hasActionable) return 'partial';
  return 'missing';
}

export function listNationalAverageBenchmarkRecords(): BenchmarkPricingCatalogRecord[] {
  const entries: Array<{ itemKey: string; average: NationalAverageBudgetSplit }> = [];
  for (const [itemKey, average] of Object.entries(NATIONAL_AVERAGE_BUDGET_SPLITS)) {
    entries.push({ itemKey, average });
  }
  for (const [itemKey, byUnit] of Object.entries(NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT)) {
    for (const [unit, average] of Object.entries(byUnit)) {
      if (NATIONAL_AVERAGE_BUDGET_SPLITS[itemKey] === average) continue;
      entries.push({ itemKey, average: { ...average, unit: average.unit || unit } });
    }
  }

  return entries.map(({ itemKey, average }) => {
    const profile = buildNationalAverageBenchmarkScopeProfile({
      itemId: itemKey,
      average,
      quantity: 1,
      total: round2(average.material + average.labor),
    });
    const pricingCoverage = pricingCoverageForRecord(average);
    const scopeProfileCoverage = scopeCoverageForProfile(profile);
    const freshnessCoverage: BenchmarkPricingCoverageStatus = average.effectiveDate ? 'complete' : 'missing';
    const sourceCoverage: BenchmarkPricingCoverageStatus = average.sourceLabel ? 'partial' : 'missing';
    const productionStatus: BenchmarkPricingProductionStatus =
      average.productionStatus ||
      (pricingCoverage === 'complete' && scopeProfileCoverage === 'complete'
        ? 'review_required'
        : pricingCoverage === 'invalid'
          ? 'disabled'
          : 'fallback_only');
    const materialLabel = nationalAverageMaterialBucketLabel(itemKey, average);
    const laborLabel = nationalAverageLaborBucketLabel(itemKey, average);
    return {
      id: `bps_national:${itemKey}:${average.unit}`,
      itemKey,
      trade: tradeForNationalAverageItem(itemKey, average),
      category: categoryForNationalAverageItem(itemKey, average),
      pricingMethod:
        average.pricingMethod ||
        (average.unit === 'allowance' ? 'allowance' : average.unit === 'lump_sum' ? 'lump_sum' : 'material_labor'),
      quantityType: average.quantityType || average.unit,
      unit: average.unit,
      materialRate: average.material,
      laborRate: average.labor,
      equipmentRate: materialLabel.toLowerCase().includes('equipment') ? average.material : null,
      subcontractorRate: null,
      combinedRate: round2(average.material + average.labor),
      rateSource: average.rateSource || 'bps_national_benchmark',
      rateSourceReference: average.rateSourceReference || 'Build Profit national-average rate table',
      geographicBasis: 'national',
      effectiveDate: average.effectiveDate ?? null,
      verifiedAt: null,
      scopeProfileSource: profile?.scopeProfileSource || 'unknown',
      scopeAssumptionsDefined: Boolean(profile?.scopeAssumptionsDefined),
      scopeAssumptionCount: profile?.scopeAssumptions.length || 0,
      includedAssumptionCount: profile?.scopeAssumptions.filter((item) => item.status === 'included').length || 0,
      excludedAssumptionCount: profile?.scopeAssumptions.filter((item) => item.status === 'excluded').length || 0,
      conditionalAssumptionCount: profile?.scopeAssumptions.filter((item) => item.status === 'conditional').length || 0,
      freshnessKnown: Boolean(average.effectiveDate),
      pricingCoverage,
      scopeProfileCoverage,
      sourceCoverage,
      freshnessCoverage,
      productionStatus,
      productionReady: productionStatus === 'production_ready',
      confidence: profile?.confidence || 'low',
      confidenceReasons: profile?.confidenceReasons || ['national_rate_geographic_basis'],
      costBucketLabels:
        average.unit === 'allowance' || average.unit === 'lump_sum'
          ? ['Allowance']
          : [materialLabel, laborLabel].filter(Boolean),
    };
  });
}

function buildNationalAverageBenchmarkScopeProfile(params: {
  itemId: string;
  average: NationalAverageBudgetSplit | null | undefined;
  quantity?: number | null;
  total?: number | null;
  regional?: ResolvedRegionalPricing | null;
}): BenchmarkScopeAssumptionProfile | undefined {
  const { itemId, average, quantity, total, regional } = params;
  if (!average) return undefined;
  if (average.scopeAssumptions) return average.scopeAssumptions;
  const definedProfile = buildNationalAverageDefinedScopeProfile({
    itemId,
    average,
    quantity,
    total,
    regional,
  });
  if (definedProfile) return definedProfile;
  const undefinedProfile = createUndefinedBenchmarkScopeProfile({
    itemId,
    pricingSource: 'national_average',
    geographicBasis: 'national',
    effectiveDate: average.effectiveDate ?? null,
    quantity,
    unit: average.unit,
    materialRate: average.material,
    laborRate: average.labor,
    equipmentRate: null,
    total,
  });
  return {
    ...undefinedProfile,
    rateSource: average.rateSource || 'bps_national_benchmark',
    rateSourceReference: average.rateSourceReference || 'Build Profit national-average rate table',
    scopeProfileSource: 'unknown',
    confidence: 'low',
    confidenceReasons: ['missing_scope_profile', 'national_rate_geographic_basis', 'freshness_not_verified'],
    productionStatus: 'fallback_only',
  };
}

export function computeNationalAverageBudgetSplit(
  itemId: string,
  total: number,
  count: number,
  unit?: string | null
): { material: number; labor: number } | null {
  const average = getNationalAverageBudgetSplit(itemId, unit);
  if (!average || !Number.isFinite(count) || count <= 0 || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  const material = Math.min(total, Math.round(count * average.material * 100) / 100);
  const labor = Math.max(0, Math.round((total - material) * 100) / 100);
  if (material <= 0 || labor <= 0) return null;
  return { material, labor };
}

export const CHECKLIST_ITEM_QUANTITY_RULES: Record<string, ScopeItemQuantityRule> = {
  demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    aggregateMeasurementKeys: ['bathroomFloorSqft', 'showerWallTileSqft', 'showerFloorTileSqft'],
    canUseRoomSqft: true,
    quantityHelper: 'Sums bathroom floor + shower walls + shower floor for full tear-out.',
  },
  floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['bathroomFloorSqft', 'showerFloorTileSqft', 'kitchenFloorSqft', 'floorAreaSqft'],
    canUseRoomSqft: true,
    quantityHelper: 'Uses bathroom floor sqft for floor removal.',
  },
  tub_demo: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 tub removal. Edit if multiple.',
  },
  shower_floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerFloorTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter shower pan / shower floor demo sqft.',
    missingMessage: 'Enter shower floor demo sqft.',
  },
  shower_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper: 'Enter shower wall tile sqft — not bathroom floor sqft.',
    missingMessage: 'Enter shower wall tile sqft.',
  },
  waterproofing: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Usually same as shower wall tile sqft.',
    missingMessage: 'Enter shower waterproofing sqft.',
  },
  floor_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    quantityHelper: 'Uses bathroom floor sqft.',
  },
  shower_pan: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Mud pan build — labor + materials (1 shower).',
  },
  wet_area_install: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Pick install type above — labor + materials show on the line below.',
  },
  tub_install: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 tub install (labor + materials).',
  },
  prefab_shower_pan: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 prefab pan install (labor + materials).',
  },
  shower_floor_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerFloorTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter shower floor tile sqft — not bathroom floor sqft.',
    missingMessage: 'Enter shower floor tile sqft.',
  },
  shower_niche: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 niche. Edit count if different.',
  },
  shower_bench_curb: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lf'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 bench/curb — or enter linear feet.',
  },
  tub_shower: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'each'],
    measurementKey: 'showerWallTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter shower wall tile sqft if replacing tile.',
    missingMessage: 'Enter shower area sqft.',
  },
  vanity: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 vanity. Edit if different.',
  },
  toilet: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 toilet. Edit if different.',
  },
  plumbing_rough: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Rough-in points = supply/drain relocations. Fixture hookup is on Toilet, Vanity, or Plumbing trim.',
    missingMessage: 'Enter rough-in points and/or a dollar allowance.',
  },
  electrical_rough: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum', 'hr'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Circuits, boxes, or devices affected. Device trim and plates are on Electrical trim.',
    missingMessage: 'Enter circuit/device count and/or a dollar allowance.',
  },
  lighting: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 light fixture. Edit count if different.',
  },
  exhaust_fan: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 bath fan. Edit if different.',
  },
  mirror_accessories: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum', 'sqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Price accessories by count or sqft with material and labor.',
    missingMessage: 'Enter accessories allowance.',
  },
  floor_prep: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    quantityHelper: 'Uses bathroom floor sqft or enter allowance.',
  },
  drywall: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter patch/repair sqft or lump sum.',
    missingMessage: 'Enter drywall repair sqft.',
  },
  paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'wallPaintSqft',
    dualAllowanceField: true,
    requiresUserQuantity: true,
    quantityHelper: 'Enter paint sqft and/or calculated total from notes rates.',
    missingMessage: 'Enter wall/ceiling paint sqft.',
  },
  trim: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'baseboardLf',
    requiresUserQuantity: true,
    quantityHelper: 'Linear feet around bathroom perimeter.',
    missingMessage: 'Enter baseboard LF.',
  },
  glass_door: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 shower door.',
  },
  plumbing_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter plumbing trim-out allowance for this job.',
    missingMessage: 'Enter plumbing trim allowance.',
  },
  electrical_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter electrical trim-out allowance for this job.',
    missingMessage: 'Enter electrical trim allowance.',
  },
  permits: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter permit and inspection allowance for this job.',
    missingMessage: 'Enter permit allowance.',
  },
  cleanup: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter cleanup and disposal allowance for this job.',
    missingMessage: 'Enter cleanup/disposal allowance.',
  },
  interior_finishes: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance'],
    requiresUserQuantity: false,
    lumpSumOnly: true,
    quantityHelper:
      'Stage planning benchmark for related finish trades. Apply once, then replace with takeoffs/quotes.',
    missingMessage: 'Planning benchmark available for Interior Finishes.',
  },
  appliances: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter appliance count and price material and labor.',
    missingMessage: 'Enter appliance count or a labor lump sum.',
  },
  appliance_removal: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lump_sum'],
    defaultQuantity: 1,
    quantityHelper: 'Price appliance removal by count with material and labor.',
  },
  cabinets: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'each', 'allowance', 'lump_sum'],
    measurementKey: 'cabinetLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter cabinet run LF and price material and labor.',
    missingMessage: 'Enter cabinet LF or allowance.',
  },
  cabinet_hardware: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter hardware count or allowance (pulls/knobs).',
    missingMessage: 'Enter cabinet hardware count or allowance.',
  },
  countertops: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'countertopSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter countertop sqft and price material and labor.',
    missingMessage: 'Enter countertop sqft.',
  },
  cabinets_counters: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter cabinet and counter allowance for this job.',
    missingMessage: 'Enter cabinet/counter allowance.',
  },
  plans_engineering: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter plans and engineering allowance for this job.',
    missingMessage: 'Enter plans/engineering allowance.',
  },
  contingency: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter contingency as a lump-sum allowance for this job.',
    missingMessage: 'Enter contingency allowance.',
  },
  final_inspections: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter final inspection allowance for this job.',
    missingMessage: 'Enter final inspection allowance.',
  },
  mobilization: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter mobilization / job setup allowance.',
    missingMessage: 'Enter mobilization allowance.',
  },
  emergency_fee: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter emergency / after-hours fee as a flat allowance.',
    missingMessage: 'Enter emergency fee.',
  },
  haul_off: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum', 'cy'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter haul-off / dumpster allowance for this job.',
    missingMessage: 'Enter haul-off allowance.',
  },
  survey: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter survey allowance for this job.',
    missingMessage: 'Enter survey allowance.',
  },
  general_conditions: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter general conditions allowance for this job.',
    missingMessage: 'Enter general conditions allowance.',
  },
  supervision: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter supervision allowance for this job.',
    missingMessage: 'Enter supervision allowance.',
  },
  overhead_profit: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper: 'Enter overhead and profit as a lump-sum allowance.',
    missingMessage: 'Enter overhead/profit allowance.',
  },
  service_call: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum', 'each', 'hr'],
    requiresUserQuantity: true,
    quantityHelper: 'Price the service call by trip or hour with material and labor.',
    missingMessage: 'Enter service-call pricing.',
  },
  parts_materials: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Price parts and materials with material and labor totals.',
    missingMessage: 'Enter parts/materials pricing.',
  },
  hardware: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Price hardware with material and labor totals.',
    missingMessage: 'Enter hardware pricing.',
  },
  materials_package: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum', 'sqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Price the materials package by sqft with material and labor.',
    missingMessage: 'Enter materials-package pricing.',
  },
  utility_taps: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum', 'each'],
    requiresUserQuantity: true,
    quantityHelper: 'Price utility taps by count with material and labor.',
    missingMessage: 'Enter utility-tap pricing.',
  },
  utility_coordination: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum', 'lf'],
    requiresUserQuantity: true,
    quantityHelper: 'Price utility coordination by LF with material and labor.',
    missingMessage: 'Enter utility coordination pricing.',
  },
  hvac_startup: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum', 'sqft'],
    requiresUserQuantity: true,
    pricingBasisMeasurementKey: 'floorAreaSqft',
    quantityHelper: 'Price HVAC startup by floor sqft with material and labor.',
    missingMessage: 'Enter HVAC startup pricing.',
  },
  refrigerant: {
    defaultUnit: 'lb',
    allowedUnits: ['lb', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Price refrigerant by pound with material and labor.',
    missingMessage: 'Enter refrigerant pricing.',
  },
  thermostat: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Price thermostat by count with material and labor.',
    missingMessage: 'Enter thermostat pricing.',
  },
  backsplash: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'allowance'],
    measurementKey: 'backsplashSqft',
    dualAllowanceField: true,
    requiresUserQuantity: true,
    quantityHelper: 'Enter backsplash sqft and/or calculated total from notes.',
    missingMessage: 'Enter backsplash sqft.',
  },
  flooring: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['flooringSqft', 'floorAreaSqft', 'kitchenFloorSqft', 'bathroomFloorSqft'],
    dualAllowanceField: true,
    requiresUserQuantity: true,
    quantityHelper: 'Enter kitchen or room floor sqft.',
    missingMessage: 'Enter floor sqft.',
  },
  sod_turf: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['sodSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter sod/turf sqft.',
    missingMessage: 'Enter sod/turf sqft.',
  },
  pavers: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['paverSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter paver sqft.',
    missingMessage: 'Enter paver sqft.',
  },
  rock_mulch: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'ton', 'allowance', 'lump_sum'],
    measurementKeys: ['rockMulchSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter coverage sqft, CY, or tons.',
    missingMessage: 'Enter rock/mulch quantity.',
  },
  tear_off: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'lump_sum'],
    measurementKey: 'roofSquares',
    requiresUserQuantity: true,
    quantityHelper: 'Enter roof squares.',
    missingMessage: 'Enter roof squares.',
  },
  shingles_roofing: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'lump_sum'],
    measurementKey: 'roofSquares',
    requiresUserQuantity: true,
    quantityHelper: 'Enter roof squares.',
    missingMessage: 'Enter roof squares.',
  },
  decking: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'deckSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter deck surface sqft or LF.',
    missingMessage: 'Enter deck sqft or LF.',
  },
  railing: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'railingLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter railing linear feet.',
    missingMessage: 'Enter railing LF.',
  },
  concrete: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteSqft', 'concreteCy'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter concrete sqft or CY.',
    missingMessage: 'Enter concrete quantity.',
  },
  pour_flatwork: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteSqft', 'concreteCy'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter concrete sqft or CY.',
    missingMessage: 'Enter concrete quantity.',
  },
  hang: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter drywall hang sqft.',
    missingMessage: 'Enter drywall sqft.',
  },
  finish_tape: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter drywall finish sqft.',
    missingMessage: 'Enter drywall sqft.',
  },
  patch_repair: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter patch/repair sqft.',
    missingMessage: 'Enter drywall repair sqft.',
  },
  interior_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'wallPaintSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter interior paint sqft.',
    missingMessage: 'Enter paint sqft.',
  },
  exterior_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'exteriorPaintSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter exterior paint sqft.',
    missingMessage: 'Enter exterior paint sqft.',
  },
  excavation: {
    defaultUnit: 'cy',
    allowedUnits: ['cy', 'sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'excavationCy',
    requiresUserQuantity: true,
    quantityHelper: 'Enter excavation CY for material and labor rates.',
    missingMessage: 'Enter excavation quantity.',
  },
};

function sourceLabel(source: QuantitySource): string {
  switch (source) {
    case 'notes':
      return SCOPE_PARSED_FROM_NOTES_LABEL;
    case 'user_entered':
      return 'User entered';
    case 'calculated_confirmed':
      return 'Calculated';
    case 'manual_override':
      return 'Manual override';
    case 'inferred':
      return 'Calculated';
    case 'plan_vision':
      return 'From plan takeoff';
    case 'default_assumption':
      return 'AI assumption';
    case 'missing':
      return 'Needs measurement';
    default:
      return '';
  }
}

export function normalizeScopeMeasurements(measurements?: ScopeMeasurements | null): NormalizedScopeMeasurements {
  const itemQuantities = { ...(measurements?.itemQuantities || {}) };
  const num = (v: unknown) => parseScopeMeasurementInput(String(v ?? ''));
  return {
    bathroomFloorSqft:
      num(measurements?.bathroomFloorSqft) ?? num(measurements?.sqft),
    kitchenFloorSqft: num(measurements?.kitchenFloorSqft),
    floorAreaSqft: num(measurements?.floorAreaSqft),
    flooringSqft: num(measurements?.flooringSqft),
    backsplashSqft: num(measurements?.backsplashSqft),
    countertopSqft: num(measurements?.countertopSqft),
    cabinetLf: num(measurements?.cabinetLf),
    landscapeSqft: num(measurements?.landscapeSqft),
    sodSqft: num(measurements?.sodSqft),
    paverSqft: num(measurements?.paverSqft),
    rockMulchSqft: num(measurements?.rockMulchSqft),
    landscapeTons: num(measurements?.landscapeTons),
    roofSquares: num(measurements?.roofSquares),
    drywallSqft: num(measurements?.drywallSqft),
    concreteSqft: num(measurements?.concreteSqft),
    concreteCy: num(measurements?.concreteCy),
    excavationCy: num(measurements?.excavationCy),
    deckSqft: num(measurements?.deckSqft),
    garageSqft: num(measurements?.garageSqft),
    exteriorPaintSqft: num(measurements?.exteriorPaintSqft),
    railingLf: num(measurements?.railingLf),
    baseboardLf:
      num(measurements?.baseboardLf) ?? num(measurements?.lf),
    showerWallTileSqft: num(measurements?.showerWallTileSqft),
    showerFloorTileSqft: num(measurements?.showerFloorTileSqft),
    wallPaintSqft: num(measurements?.wallPaintSqft),
    itemQuantities,
  };
}

export function formatUnitLabel(unit: string): string {
  if (unit === 'sqft') return 'sqft';
  if (unit === 'lf') return 'LF';
  if (unit === 'each') return 'each';
  if (unit === 'allowance') return 'allowance';
  if (unit === 'lump_sum') return 'lump sum';
  if (unit === 'hr') return 'hr';
  if (unit === 'squares') return 'squares';
  if (unit === 'cy') return 'CY';
  if (unit === 'ton') return 'tons';
  return unit;
}

export type CalculatedQuantityRevertSnapshot = NonNullable<
  ScopeItemQuantityValue['quantityBeforeCalculated']
>;

export function calculatedQuantityRevertLabel(
  snapshot: CalculatedQuantityRevertSnapshot | null | undefined
): string | null {
  if (!snapshot) return null;
  const qty = Number(String(snapshot.quantity ?? '').replace(/,/g, ''));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = formatUnitLabel(snapshot.unit);
  const sourceHint =
    snapshot.quantitySource === 'notes'
      ? 'from notes'
      : snapshot.quantitySource === 'user_entered'
        ? 'entered'
        : 'original';
  return `Revert to ${qty.toLocaleString()} ${unit} (${sourceHint})`;
}

function sumMeasurementKeys(
  measurements: NormalizedScopeMeasurements,
  keys: Array<keyof NormalizedScopeMeasurements>
): { quantity: number; parts: number } | null {
  let total = 0;
  let parts = 0;
  for (const key of keys) {
    const v = measurements[key];
    if (typeof v === 'number' && v > 0) {
      total += v;
      parts += 1;
    }
  }
  if (parts === 0) return null;
  return { quantity: total, parts };
}

function aggregatedMeasurementSourceLabel(parts: number): string {
  if (parts >= 3) return 'Floor + shower walls + shower floor';
  if (parts === 2) return 'Combined tear-out sqft';
  return 'From room measurement';
}

export function notesHaveCombinedCabinetsCounters(notes?: string | null): boolean {
  const n = String(notes || '').toLowerCase();
  return (
    /\b(cabinets?|cabinetry)\b/.test(n) && /\b(counters?|countertops?|quartz|granite)\b/.test(n)
  );
}

function parsedNotesItemQuantities(
  notes?: string | null,
  templateKey?: string | null
): Record<string, ScopeItemQuantityValue> {
  const text = String(notes || '').trim();
  if (!text) return {};
  const parsed = parseScopeMeasurementsFromNotes(text, { templateKey: templateKey ?? undefined });
  return (parsed.itemQuantities || {}) as Record<string, ScopeItemQuantityValue>;
}

function resolvedQuantityFromNotes(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  ctx: { templateKey?: string | null; notes?: string | null }
): ResolvedItemQuantity | null {
  const rule = getChecklistItemQuantityRule(itemId, ctx.templateKey);
  if (!rule || !ctx.notes) return null;

  const fromNotes = parsedNotesItemQuantities(ctx.notes, ctx.templateKey);
  const linkedCountertop = resolveLinkedCountertopAllowance(itemId, measurements, ctx.notes);
  if (linkedCountertop) return linkedCountertop;

  if (rule.dualAllowanceField) {
    const countMeasurement =
      itemId === 'floor_demo' && measurements.floorAreaSqft
        ? { quantity: measurements.floorAreaSqft, unit: 'sqft' }
        : rule.measurementKey && measurements[rule.measurementKey]
          ? {
              quantity: measurements[rule.measurementKey],
              unit: measurementUnitForKey(rule.measurementKey, rule.defaultUnit),
            }
          : (rule.measurementKeys || [])
              .map((key) =>
                measurements[key]
                  ? { quantity: measurements[key], unit: measurementUnitForKey(key, rule.defaultUnit) }
                  : null
              )
              .find((entry) => entry?.quantity != null && entry.quantity > 0) ?? null;
    let countEntry =
      countMeasurement?.quantity && countMeasurement.quantity > 0
        ? {
            quantity: countMeasurement.quantity,
            unit: countMeasurement.unit,
            quantitySource: 'inferred' as const,
          }
        : null;
    const allowanceEntry = parseStoredItemQuantity(measurements, roughAllowanceSubKey(itemId));
    const legacyAllowance =
      !allowanceEntry &&
      fromNotes[itemId] &&
      ['allowance', 'lump_sum'].includes(fromNotes[itemId].unit || '')
        ? parseStoredItemQuantity(measurements, itemId)
        : null;
    const { effectiveAllowance, materialEntry, laborEntry } = applyRatePricingBreakdown(
      itemId,
      measurements,
      ctx.notes,
      ctx.templateKey,
      countEntry,
      allowanceEntry,
      legacyAllowance
    );
    if (!countEntry && !effectiveAllowance) return null;
    const primary = countEntry || effectiveAllowance!;
    return {
      quantity: primary.quantity,
      unit: primary.unit,
      quantitySource: 'notes',
      sourceLabel: sourceLabel('notes'),
      pricingReady: true,
      quantityHelper: rule.quantityHelper,
      showInput: true,
      dualCount: countEntry,
      dualMaterial: materialEntry,
      dualLabor: laborEntry,
      dualAllowance: effectiveAllowance,
    };
  }

  const raw = fromNotes[itemId];
  if (!raw?.quantity || Number(raw.quantity) <= 0) return null;
  return {
    quantity: Number(raw.quantity),
    unit: raw.unit || rule.defaultUnit,
    quantitySource: 'notes',
    sourceLabel: sourceLabel('notes'),
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
  };
}

function resolveLinkedCountertopAllowance(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  notes?: string | null
): ResolvedItemQuantity | null {
  if (itemId !== 'countertops') return null;
  const rule = getChecklistItemQuantityRule('countertops');
  if (!rule) return null;

  const cabinetEntry = measurements.itemQuantities.cabinets;
  if (!cabinetEntry?.quantity || cabinetEntry.quantity <= 0) return null;
  if (!['allowance', 'lump_sum'].includes(cabinetEntry.unit || '')) return null;
  const countertopEntry = measurements.itemQuantities.countertops;
  const combined =
    Boolean(cabinetEntry.includesCountertops) ||
    notesHaveCombinedCabinetsCounters(notes) ||
    (cabinetEntry.unit === 'allowance' &&
      cabinetEntry.quantity >= 5000 &&
      !(countertopEntry?.quantity != null && countertopEntry.quantity > 0));
  if (!combined) return null;

  return {
    quantity: cabinetEntry.quantity,
    unit: 'allowance',
    quantitySource: 'notes',
    sourceLabel: 'No separate charge',
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
    combinedAllowanceRole: 'included_in_combined',
    combinedAllowanceTotal: cabinetEntry.quantity,
  };
}

/** Kitchen shares checklist ids with bathroom — override quantity semantics per template. */
const KITCHEN_CHECKLIST_ITEM_QUANTITY_RULES: Record<string, ScopeItemQuantityRule> = {
  demo: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance', 'lf'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 cabinet/counter demo lump sum. Edit LF if priced by run.',
  },
  floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['kitchenFloorSqft', 'floorAreaSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter kitchen floor sqft for flooring removal.',
    missingMessage: 'Enter kitchen floor demo sqft.',
  },
  flooring: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.flooring,
    measurementKeys: ['kitchenFloorSqft', 'flooringSqft', 'floorAreaSqft', 'bathroomFloorSqft'],
    quantityHelper: 'Enter kitchen floor sqft for flooring install.',
    missingMessage: 'Enter kitchen floor sqft.',
  },
};

const additionFloorAreaRule = (
  quantityHelper: string,
  missingMessage = 'Enter pricing basis or lump sum.'
): ScopeItemQuantityRule => ({
  defaultUnit: 'sqft',
  allowedUnits: ['sqft', 'allowance', 'lump_sum'],
  measurementKeys: ['floorAreaSqft'],
  pricingBasisMeasurementKey: 'floorAreaSqft',
  canUseRoomSqft: true,
  requiresUserQuantity: false,
  quantityHelper,
  missingMessage,
});

const ADDITION_CHECKLIST_ITEM_QUANTITY_RULES: Record<string, ScopeItemQuantityRule> = {
  plans_engineering: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.plans_engineering,
  },
  permits: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.permits,
  },
  utility_coordination: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.utility_coordination,
  },
  sitework: additionFloorAreaRule(
    'Enter site prep sqft, or price site prep with lump sum/material/labor.',
    'Enter site prep sqft or pricing.'
  ),
  grading: additionFloorAreaRule(
    'Finish/rough grading is usually priced by sqft; use CY for mass cut/fill.',
    'Enter grading sqft or pricing.'
  ),
  utility_trenching: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'cy', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Price utility trenching by LF with material and labor.',
    missingMessage: 'Enter utility trenching LF or pricing.',
  },
  foundation: additionFloorAreaRule(
    'Enter foundation/slab footprint sqft, or use concrete CY on the concrete line.',
    'Enter foundation sqft or pricing.'
  ),
  concrete: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.concrete,
    defaultUnit: 'cy',
    measurementKeys: ['concreteCy', 'concreteSqft'],
    quantityHelper: 'Enter foundation concrete CY, or flatwork sqft if this is slab/flatwork.',
    missingMessage: 'Enter foundation concrete CY or flatwork sqft.',
  },
  framing: additionFloorAreaRule(
    'Enter framed floor area sqft, or price framing with lump sum/material/labor.',
    'Enter framing sqft or pricing.'
  ),
  roof_tie_in: {
    ...additionFloorAreaRule(
      'Enter roof/tie-in area sqft and price material and labor.',
      'Enter roof/tie-in sqft or pricing.'
    ),
  },
  windows_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum', 'sqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter window/door count and price material and labor.',
    missingMessage: 'Enter window/door count or pricing.',
  },
  exterior_finishes: additionFloorAreaRule(
    'Enter exterior finish area sqft, or price with lump sum/material/labor.',
    'Enter exterior finish sqft or pricing.'
  ),
  hvac: {
    ...additionFloorAreaRule(
      'Enter conditioned floor sqft and price HVAC material and labor.',
      'Enter HVAC sqft or pricing.'
    ),
  },
  insulation: additionFloorAreaRule(
    'Enter insulation area sqft, or price insulation with lump sum/material/labor.',
    'Enter insulation sqft or pricing.'
  ),
  drywall: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.drywall,
    measurementKey: 'drywallSqft',
    quantityHelper: 'Enter drywall sqft, or price drywall with lump sum/material/labor.',
  },
  paint: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.paint,
    measurementKey: 'wallPaintSqft',
    quantityHelper: 'Enter paint sqft and/or calculated material/labor totals.',
  },
  flooring: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.flooring,
    measurementKeys: ['flooringSqft', 'floorAreaSqft'],
    quantityHelper: 'Enter flooring sqft and/or calculated material/labor totals.',
  },
  cabinets_counters: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.cabinets_counters,
  },
  tile: additionFloorAreaRule(
    'Enter tile area sqft, or price tile with lump sum/material/labor.',
    'Enter tile sqft or pricing.'
  ),
  interior_trim: additionFloorAreaRule(
    'Enter trim area sqft, or use lump sum/material/labor.',
    'Enter interior trim pricing.'
  ),
  plumbing_trim: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.plumbing_trim,
  },
  electrical_trim: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.electrical_trim,
  },
  hvac_startup: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.hvac_startup,
  },
  appliances: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.appliances,
  },
  final_inspections: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.final_inspections,
  },
  cleanup: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.cleanup,
  },
  contingency: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.contingency,
  },
};

/** Ground-up: living SF drives stage benchmarks; physical QM keys drive material/labor when present. */
const GROUND_UP_CHECKLIST_ITEM_QUANTITY_RULES: Record<string, ScopeItemQuantityRule> = {
  plans_engineering: ADDITION_CHECKLIST_ITEM_QUANTITY_RULES.plans_engineering,
  permits: ADDITION_CHECKLIST_ITEM_QUANTITY_RULES.permits,
  sitework: additionFloorAreaRule(
    'Uses living area from the plan for sitework basis — edit if needed.',
    'Enter sitework sqft or pricing.'
  ),
  excavation: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.excavation,
    quantityHelper:
      'Planning material + labor from living-SF pad/trench CY until excavation takeoff is entered.',
    missingMessage: 'Needs excavation CY',
  },
  foundation: {
    defaultUnit: 'cy',
    allowedUnits: ['cy', 'sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteCy', 'concreteSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter foundation / slab concrete CY for material and labor.',
    missingMessage: 'Needs structural takeoff (slab/footings/walls/CY). Living SF is not foundation quantity.',
  },
  framing: additionFloorAreaRule(
    'Uses living area from the plan as framed floor area — edit if needed.',
    'Enter framing sqft or pricing.'
  ),
  roofing: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['roofSquares'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter roof squares for material and labor.',
    missingMessage: 'Enter roof squares or pricing.',
  },
  exterior: additionFloorAreaRule(
    'Uses living area from the plan as exterior finish basis — edit if needed.',
    'Enter exterior finish sqft or pricing.'
  ),
  stucco: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['exteriorPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter exterior wall surface SF for stucco material and labor.',
    missingMessage: 'Needs exterior wall surface SF for stucco.',
  },
  mep_rough: additionFloorAreaRule(
    'Uses living area from the plan as MEP rough-in basis — edit if needed.',
    'Enter MEP rough-in sqft or pricing.'
  ),
  plumbing_rough: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.plumbing_rough,
    quantityHelper:
      'Enter plumbing rough-in points for material and labor — planning from living SF when count is missing.',
    missingMessage: 'Enter plumbing rough-in points or pricing.',
  },
  electrical_rough: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.electrical_rough,
    quantityHelper:
      'Enter circuit / box / device count for material and labor — planning from living SF when count is missing.',
    missingMessage: 'Enter electrical rough-in count or pricing.',
  },
  hvac: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'ton', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper: 'Enter HVAC system count (or tons) for material and labor — not living SF.',
    missingMessage: 'Enter HVAC system count, tons, or pricing.',
  },
  windows_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'sqft', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Enter window/door opening count for material and labor — planning from living SF when count is missing.',
    missingMessage: 'Enter window/door count or pricing.',
  },
  insulation: additionFloorAreaRule(
    'Uses living area from the plan as insulation basis — edit if needed.',
    'Enter insulation sqft or pricing.'
  ),
  drywall: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['drywallSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter wall/ceiling drywall surface sqft for material and labor.',
    missingMessage: 'Enter drywall surface sqft or pricing.',
  },
  cabinets: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.cabinets,
  },
  countertops: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.countertops,
  },
  /** Legacy combined line — prefer cabinets + countertops when both measurements exist. */
  cabinets_counters: ADDITION_CHECKLIST_ITEM_QUANTITY_RULES.cabinets_counters,
  shower_tile: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.shower_tile,
  },
  shower_floor_tile: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.shower_floor_tile,
  },
  floor_tile: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.floor_tile,
  },
  tile_flooring: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['flooringSqft', 'floorAreaSqft'],
    pricingBasisMeasurementKey: 'floorAreaSqft',
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    quantityHelper: 'Uses flooring / living area from the plan — edit if needed.',
    missingMessage: 'Enter flooring sqft or pricing.',
  },
  paint_trim: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['wallPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter wall/ceiling paint surface sqft for material and labor.',
    missingMessage: 'Enter paint surface sqft or pricing.',
  },
  appliances: ADDITION_CHECKLIST_ITEM_QUANTITY_RULES.appliances,
  utility_taps: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.utility_taps,
  },
  contingency: ADDITION_CHECKLIST_ITEM_QUANTITY_RULES.contingency,
  overhead_profit: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.overhead_profit,
  },
  cleanup: ADDITION_CHECKLIST_ITEM_QUANTITY_RULES.cleanup,
};

/** Fallback when a checklist item has no explicit rule — still show pricing entry in Step 2. */
export const DEFAULT_SCOPE_ALLOWANCE_QUANTITY_RULE: ScopeItemQuantityRule = {
  defaultUnit: 'sqft',
  allowedUnits: ['sqft', 'each', 'lf', 'allowance', 'lump_sum'],
  requiresUserQuantity: true,
  quantityHelper: 'Enter material and labor pricing for this scope using the right job basis.',
  missingMessage: 'Needs pricing',
};

export function usesAllowanceSplitEditor(rule: ScopeItemQuantityRule): boolean {
  return !rule.dualAllowanceField;
}

type PricingBasisPreference = {
  unit: string;
  measurementKeys?: Array<keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>>;
  useFloorAreaFallback?: boolean;
};

const GLOBAL_PRICING_BASIS_PREFERENCES: Record<string, PricingBasisPreference> = {
  demo: { unit: 'sqft', measurementKeys: ['bathroomFloorSqft', 'floorAreaSqft'] },
  floor_demo: { unit: 'sqft', measurementKeys: ['bathroomFloorSqft', 'kitchenFloorSqft', 'floorAreaSqft'] },
  demo_removal: { unit: 'sqft', measurementKeys: ['floorAreaSqft', 'deckSqft', 'concreteSqft', 'drywallSqft'] },
  floor_tile: { unit: 'sqft', measurementKeys: ['bathroomFloorSqft', 'floorAreaSqft'] },
  flooring: { unit: 'sqft', measurementKeys: ['flooringSqft', 'floorAreaSqft', 'kitchenFloorSqft', 'bathroomFloorSqft'] },
  floor_prep: { unit: 'sqft', measurementKeys: ['bathroomFloorSqft', 'kitchenFloorSqft', 'floorAreaSqft'] },
  drywall: { unit: 'sqft', measurementKeys: ['drywallSqft', 'floorAreaSqft'] },
  hang: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
  finish_tape: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
  texture: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
  patch_repair: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
  paint: { unit: 'sqft', measurementKeys: ['wallPaintSqft', 'floorAreaSqft'] },
  interior_paint: { unit: 'sqft', measurementKeys: ['wallPaintSqft', 'floorAreaSqft'] },
  exterior_paint: { unit: 'sqft', measurementKeys: ['exteriorPaintSqft'] },
  prep: { unit: 'sqft', measurementKeys: ['wallPaintSqft', 'floorAreaSqft'] },
  trim: { unit: 'lf', measurementKeys: ['baseboardLf'] },
  trim_paint: { unit: 'lf', measurementKeys: ['baseboardLf'] },
  baseboard: { unit: 'lf', measurementKeys: ['baseboardLf'] },
  shower_tile: { unit: 'sqft', measurementKeys: ['showerWallTileSqft'] },
  shower_floor_tile: { unit: 'sqft', measurementKeys: ['showerFloorTileSqft'] },
  waterproofing: { unit: 'sqft', measurementKeys: ['showerWallTileSqft'] },
  backsplash: { unit: 'sqft', measurementKeys: ['backsplashSqft'] },
  countertops: { unit: 'sqft', measurementKeys: ['countertopSqft'] },
  cabinets: { unit: 'lf', measurementKeys: ['cabinetLf'] },
  pavers: { unit: 'sqft', measurementKeys: ['paverSqft', 'landscapeSqft'] },
  sod_turf: { unit: 'sqft', measurementKeys: ['sodSqft', 'landscapeSqft'] },
  rock_mulch: { unit: 'sqft', measurementKeys: ['rockMulchSqft', 'landscapeSqft'] },
  concrete: { unit: 'sqft', measurementKeys: ['concreteSqft', 'concreteCy'] },
  pour_flatwork: { unit: 'sqft', measurementKeys: ['concreteSqft', 'concreteCy'] },
  concrete_patio: { unit: 'sqft', measurementKeys: ['concreteSqft', 'deckSqft', 'floorAreaSqft'] },
  pour_foundation: { unit: 'cy', measurementKeys: ['concreteCy', 'concreteSqft'] },
  excavation: { unit: 'cy', measurementKeys: ['excavationCy'] },
  trenching: { unit: 'lf' },
  utility_trenching: { unit: 'lf' },
  grading: { unit: 'sqft', measurementKeys: ['landscapeSqft', 'floorAreaSqft'] },
  sitework: { unit: 'sqft', measurementKeys: ['landscapeSqft', 'floorAreaSqft'] },
  site_prep: { unit: 'sqft', measurementKeys: ['concreteSqft', 'landscapeSqft', 'floorAreaSqft'] },
  soil_prep: { unit: 'sqft', measurementKeys: ['landscapeSqft'] },
  clearing: { unit: 'sqft', measurementKeys: ['landscapeSqft', 'floorAreaSqft'] },
  demo_clearing: { unit: 'sqft', measurementKeys: ['landscapeSqft'] },
  backfill: { unit: 'cy', measurementKeys: ['excavationCy'] },
  haul_off: { unit: 'cy', measurementKeys: ['excavationCy'] },
  imported_fill: { unit: 'cy', measurementKeys: ['excavationCy'] },
  railing: { unit: 'lf', measurementKeys: ['railingLf'] },
  decking: { unit: 'sqft', measurementKeys: ['deckSqft'] },
  footings_piers: { unit: 'each' },
  framing_structure: { unit: 'sqft', measurementKeys: ['deckSqft'] },
  stairs: { unit: 'each' },
  staining_sealing: { unit: 'sqft', measurementKeys: ['deckSqft'] },
  tear_off: { unit: 'squares', measurementKeys: ['roofSquares'] },
  shingles_roofing: { unit: 'squares', measurementKeys: ['roofSquares'] },
  decking_repair: { unit: 'sqft', measurementKeys: ['roofSquares'] },
  underlayment: { unit: 'squares', measurementKeys: ['roofSquares'] },
  flashing: { unit: 'lf' },
  vents_penetrations: { unit: 'each' },
  gutters_downspouts: { unit: 'lf' },
  service_call: { unit: 'each' },
  fixture_repair: { unit: 'each' },
  fixture_replace: { unit: 'each' },
  drain_cleaning: { unit: 'lf' },
  water_line: { unit: 'lf' },
  sewer_line: { unit: 'lf' },
  drainage: { unit: 'lf' },
  irrigation: { unit: 'sqft', measurementKeys: ['landscapeSqft'] },
  plants_trees: { unit: 'each' },
  landscape_lighting: { unit: 'each' },
  mobilization: { unit: 'allowance' },
  emergency_fee: { unit: 'allowance' },
  parts_materials: { unit: 'allowance' },
  materials_package: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
  labor: { unit: 'hr' },
  layout: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
  wall_framing: { unit: 'lf', measurementKeys: ['baseboardLf'] },
  openings: { unit: 'each' },
  blocking: { unit: 'lf' },
  shear_sheathing: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
  hardware: { unit: 'allowance' },
  tub_demo: { unit: 'each' },
  wet_area_install: { unit: 'each' },
  tub_install: { unit: 'each' },
  prefab_shower_pan: { unit: 'each' },
  shower_pan: { unit: 'each' },
  shower_niche: { unit: 'each' },
  shower_bench_curb: { unit: 'each' },
  vanity: { unit: 'each' },
  toilet: { unit: 'each' },
  lighting: { unit: 'each' },
  exhaust_fan: { unit: 'each' },
  glass_door: { unit: 'each' },
  appliances: { unit: 'each' },
  appliance_removal: { unit: 'each' },
  sink_faucet: { unit: 'each' },
  cabinet_hardware: { unit: 'each' },
  island: { unit: 'lf', measurementKeys: ['cabinetLf'] },
  plumbing: { unit: 'each' },
  electrical: { unit: 'each' },
  hvac: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
  walls_moving: { unit: 'lf' },
  equipment_replace: { unit: 'each' },
  refrigerant: { unit: 'lb' },
  thermostat: { unit: 'each' },
  ductwork: { unit: 'lf' },
  ventilation: { unit: 'each' },
};

const TEMPLATE_PRICING_BASIS_PREFERENCES: Record<string, Record<string, PricingBasisPreference>> = {
  addition: {
    sitework: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    grading: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    utility_trenching: { unit: 'lf' },
    foundation: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    framing: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    roof_tie_in: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    windows_doors: { unit: 'each' },
    exterior_finishes: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    hvac: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    insulation: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    tile: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    interior_trim: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
  },
  ground_up: {
    sitework: { unit: 'sqft', measurementKeys: ['floorAreaSqft', 'landscapeSqft'] },
    foundation: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    framing: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    roofing: { unit: 'squares', measurementKeys: ['roofSquares'] },
    exterior: { unit: 'sqft', measurementKeys: ['floorAreaSqft', 'exteriorPaintSqft'] },
    windows_doors: { unit: 'each' },
    mep_rough: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    plumbing_rough: { unit: 'each' },
    electrical_rough: { unit: 'each' },
    hvac: { unit: 'each' },
    insulation: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    tile_flooring: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    paint_trim: { unit: 'sqft', measurementKeys: ['wallPaintSqft', 'floorAreaSqft'] },
  },
  room_remodel: {
    framing: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    plumbing: { unit: 'each' },
    electrical: { unit: 'each' },
    hvac: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    drywall: { unit: 'sqft', measurementKeys: ['drywallSqft', 'floorAreaSqft'] },
    flooring: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    paint: { unit: 'sqft', measurementKeys: ['wallPaintSqft', 'floorAreaSqft'] },
    trim: { unit: 'lf', measurementKeys: ['baseboardLf'] },
  },
  kitchen: {
    floor_demo: { unit: 'sqft', measurementKeys: ['kitchenFloorSqft', 'flooringSqft', 'floorAreaSqft'] },
    flooring: { unit: 'sqft', measurementKeys: ['kitchenFloorSqft', 'flooringSqft', 'floorAreaSqft'] },
    cabinets: { unit: 'lf', measurementKeys: ['cabinetLf'] },
    countertops: { unit: 'sqft', measurementKeys: ['countertopSqft', 'kitchenFloorSqft'] },
    backsplash: { unit: 'sqft', measurementKeys: ['backsplashSqft'] },
  },
};

function pricingBasisPreferenceFor(
  itemId: string,
  templateKey?: string | null
): PricingBasisPreference | null {
  return (
    (templateKey && TEMPLATE_PRICING_BASIS_PREFERENCES[templateKey]?.[itemId]) ||
    GLOBAL_PRICING_BASIS_PREFERENCES[itemId] ||
    null
  );
}

export function resolveAllowanceEditorDefaultBasisUnit(
  itemId: string,
  templateKey?: string | null,
  rule?: ScopeItemQuantityRule
): string {
  const preferred = pricingBasisPreferenceFor(itemId, templateKey)?.unit;
  if (preferred) return preferred;
  const fallbackRule = rule ?? getChecklistItemQuantityRuleOrDefault(itemId, templateKey);
  if (fallbackRule.defaultUnit === 'allowance' || fallbackRule.defaultUnit === 'lump_sum') return 'sqft';
  return fallbackRule.defaultUnit;
}

export function resolveAllowanceEditorPricingBasis(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  templateKey?: string | null
): { quantity: number; unit: string } | null {
  const rule = getChecklistItemQuantityRuleOrDefault(itemId, templateKey);
  const basisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
  const stored = measurementsInput.itemQuantities[basisKey];
  const storedQty = parseScopeMeasurementInput(String(stored?.quantity ?? ''));
  if (storedQty && storedQty > 0) {
    return { quantity: storedQty, unit: stored?.unit || 'sqft' };
  }
  const preferred = pricingBasisPreferenceFor(itemId, templateKey);
  if (preferred?.measurementKeys?.length) {
    for (const key of preferred.measurementKeys) {
      const quantity = parseScopeMeasurementInput(
        String(measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? '')
      );
      if (quantity && quantity > 0) {
        return { quantity, unit: measurementUnitForKey(key, preferred.unit) };
      }
    }
  }
  const fromPricingBasis = firstPricingBasisMeasurementForRule(rule, measurementsInput);
  if (fromPricingBasis) return fromPricingBasis;
  const fromRule = firstMeasurementForRule(rule, measurementsInput);
  if (fromRule) return fromRule;
  if (rule.defaultUnit && rule.defaultUnit !== 'sqft' && rule.defaultUnit !== 'allowance' && rule.defaultUnit !== 'lump_sum') {
    return null;
  }
  const canUseFloorFallback = preferred?.useFloorAreaFallback || rule.canUseRoomSqft || rule.defaultUnit === 'sqft';
  if (!canUseFloorFallback) return null;
  const floor = parseScopeMeasurementInput(String(measurementsInput.floorAreaSqft ?? ''));
  if (floor && floor > 0) return { quantity: floor, unit: 'sqft' };
  return null;
}

export function allowanceSplitSubKey(
  itemId: string,
  part: 'allowance' | 'sqft_basis' | 'material' | 'labor'
): string {
  return `${itemId}__${part}`;
}

export function getChecklistItemQuantityRule(
  itemId: string,
  templateKey?: string | null
): ScopeItemQuantityRule | undefined {
  let rule: ScopeItemQuantityRule | undefined;
  if (templateKey === 'ground_up' && GROUND_UP_CHECKLIST_ITEM_QUANTITY_RULES[itemId]) {
    rule = GROUND_UP_CHECKLIST_ITEM_QUANTITY_RULES[itemId];
  } else if (templateKey === 'addition' && ADDITION_CHECKLIST_ITEM_QUANTITY_RULES[itemId]) {
    rule = ADDITION_CHECKLIST_ITEM_QUANTITY_RULES[itemId];
  } else if (templateKey === 'kitchen' && KITCHEN_CHECKLIST_ITEM_QUANTITY_RULES[itemId]) {
    rule = KITCHEN_CHECKLIST_ITEM_QUANTITY_RULES[itemId];
  } else {
    rule = CHECKLIST_ITEM_QUANTITY_RULES[itemId];
  }
  if (!rule) return undefined;

  // Measurement-semantics: do not resolve primary takeoff from living SF for physical trades.
  if (measurementSemanticsV1Enabled() && NO_LIVING_SF_PRIMARY_SEED_KEYS.has(itemId)) {
    const keys = (rule.measurementKeys || (rule.measurementKey ? [rule.measurementKey] : [])).filter(
      (key) => key !== 'floorAreaSqft'
    );
    const physicalKey =
      itemId === 'drywall'
        ? 'drywallSqft'
        : itemId === 'roofing'
          ? 'roofSquares'
          : itemId === 'stucco'
            ? 'exteriorPaintSqft'
          : itemId === 'paint_trim' || itemId === 'paint' || itemId === 'interior_paint'
            ? 'wallPaintSqft'
            : itemId === 'excavation'
              ? 'excavationCy'
              : itemId === 'foundation'
                ? 'concreteCy'
                : itemId === 'cabinets'
                  ? 'cabinetLf'
                  : itemId === 'countertops'
                    ? 'countertopSqft'
                    : itemId === 'shower_tile'
                      ? 'showerWallTileSqft'
                      : itemId === 'shower_floor_tile'
                        ? 'showerFloorTileSqft'
                        : itemId === 'floor_tile'
                          ? 'bathroomFloorSqft'
                          : itemId === 'tile_flooring' || itemId === 'flooring'
                            ? 'flooringSqft'
                            : keys[0];
    const preferred = preferredPrimaryUnit(itemId);
    return {
      ...rule,
      measurementKey: physicalKey as ScopeItemQuantityRule['measurementKey'],
      measurementKeys: physicalKey
        ? ([physicalKey] as ScopeItemQuantityRule['measurementKeys'])
        : undefined,
      pricingBasisMeasurementKey: undefined,
      defaultUnit:
        itemId === 'excavation' || itemId === 'foundation'
          ? 'cy'
          : itemId === 'roofing'
            ? 'squares'
            : itemId === 'cabinets'
              ? 'lf'
              : itemId === 'paint_trim' ||
                  itemId === 'paint' ||
                  itemId === 'interior_paint' ||
                  itemId === 'drywall' ||
                  itemId === 'stucco'
                ? 'sqft'
                : preferred === 'package' || preferred === 'unknown'
                  ? rule.defaultUnit
                  : preferred === 'surface_sqft' || preferred === 'floor_sqft'
                    ? 'sqft'
                    : rule.defaultUnit,
      requiresUserQuantity: true,
      quantityHelper:
        itemId === 'framing'
          ? 'Planning material + labor from living SF until a board-foot / package takeoff is entered.'
          : itemId === 'stucco'
            ? 'Enter exterior wall surface SF for stucco material and labor.'
          : itemId === 'foundation'
            ? 'Needs structural takeoff (slab/footings/walls/CY). Living SF is not foundation quantity.'
            : itemId === 'insulation'
              ? 'Planning material + labor from living SF until envelope surface SF is entered.'
              : itemId === 'roofing'
                ? 'Enter roof squares for material and labor.'
                : itemId === 'drywall'
                  ? 'Enter wall/ceiling drywall surface sqft for material and labor.'
                  : itemId === 'paint_trim'
                    ? 'Enter wall/ceiling paint surface sqft for material and labor.'
                    : itemId === 'tile_flooring' || itemId === 'flooring'
                      ? 'Gross interior floor area may display for planning — finish allocation (LVP/carpet/tile) still required.'
                      : rule.quantityHelper,
      missingMessage: missingStatusDisplayLabel(itemId),
    };
  }
  return rule;
}

export function getChecklistItemQuantityRuleOrDefault(
  itemId: string,
  templateKey?: string | null
): ScopeItemQuantityRule {
  return getChecklistItemQuantityRule(itemId, templateKey) ?? DEFAULT_SCOPE_ALLOWANCE_QUANTITY_RULE;
}

function parseStoredItemQuantity(
  measurements: NormalizedScopeMeasurements,
  key: string
): { quantity: number; unit: string; quantitySource?: QuantitySource } | null {
  const override = measurements.itemQuantities[key];
  if (override?.quantity != null && override.quantity > 0) {
    return {
      quantity: override.quantity,
      unit: override.unit || 'each',
      quantitySource: override.quantitySource,
    };
  }
  return null;
}

function sqftFromItemQuantities(
  measurements: NormalizedScopeMeasurements | ScopeMeasurementsInputExtended,
  itemId: string
): number | undefined {
  const entry = measurements.itemQuantities?.[itemId];
  if (!entry?.quantity || entry.unit !== 'sqft') return undefined;
  const q = parseScopeMeasurementInput(String(entry.quantity));
  return q && q > 0 ? q : undefined;
}

/** Copy sqft counts saved on itemQuantities into quick-measurement fields when missing. */
export function syncDualAllowanceSqftFields(
  input: ScopeMeasurementsInputExtended
): ScopeMeasurementsInputExtended {
  const next = { ...input };
  const sync = (
    itemId: string,
    field: 'backsplashSqft' | 'wallPaintSqft' | 'showerWallTileSqft' | 'flooringSqft'
  ) => {
    if (parseScopeMeasurementInput(String(next[field] ?? ''))) return;
    const q = sqftFromItemQuantities(input, itemId);
    if (q) next[field] = String(q);
  };
  sync('backsplash', 'backsplashSqft');
  sync('paint', 'wallPaintSqft');
  sync('shower_tile', 'showerWallTileSqft');
  sync('flooring', 'flooringSqft');
  return next;
}

const EXPLICIT_ITEM_QUANTITY_SOURCES = new Set<QuantitySource>([
  'calculated_confirmed',
  'user_entered',
  'manual_override',
  'plan_vision',
]);

function explicitItemQuantityOverride(
  measurements: NormalizedScopeMeasurements,
  itemId: string,
  rule: ScopeItemQuantityRule,
  ctx: { templateKey?: string | null | undefined; notes?: string | null }
): ResolvedItemQuantity | null {
  const override = measurements.itemQuantities[itemId];
  if (
    override?.quantity == null ||
    override.quantity <= 0 ||
    isPlaceholderAllowancePricing(override.quantity, override.unit, itemId) ||
    !EXPLICIT_ITEM_QUANTITY_SOURCES.has(override.quantitySource || 'user_entered')
  ) {
    return null;
  }
  const includesCountertops =
    Boolean(override.includesCountertops) ||
    (itemId === 'cabinets' && notesHaveCombinedCabinetsCounters(ctx.notes));
  const baseLabel = sourceLabel(override.quantitySource || 'user_entered');
  const combinedCabinetsCounters = itemId === 'cabinets' && includesCountertops;
  return {
    quantity: override.quantity,
    unit: normalizedOverrideUnitForRule(itemId, ctx.templateKey, override.unit, rule),
    quantitySource: override.quantitySource || 'user_entered',
    sourceLabel: combinedCabinetsCounters
      ? `Combined total · cabinets + counters · ${baseLabel}`
      : baseLabel,
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
    ...(combinedCabinetsCounters
      ? {
          combinedAllowanceRole: 'combined_total' as const,
          combinedAllowanceTotal: override.quantity,
        }
      : {}),
  };
}

/** Keep quick-measurement fields aligned with explicit Step 2 quantity choices. */
export function syncItemQuantitiesToMeasurementFields(
  input: ScopeMeasurementsInputExtended
): ScopeMeasurementsInputExtended {
  const safeInput: ScopeMeasurementsInputExtended = {
    ...(input || {}),
    itemQuantities: input?.itemQuantities || {},
  };
  const next = syncDualAllowanceSqftFields(safeInput);
  const mappings: Array<[string, QuickMeasurementFieldKey]> = [
    ['drywall', 'drywallSqft'],
    ['hang', 'drywallSqft'],
    ['finish_tape', 'drywallSqft'],
    ['paint', 'wallPaintSqft'],
    ['interior_paint', 'wallPaintSqft'],
    ['flooring', 'flooringSqft'],
    ['concrete', 'concreteSqft'],
    ['pour_flatwork', 'concreteSqft'],
  ];
  for (const [itemId, field] of mappings) {
    const entry = safeInput.itemQuantities?.[itemId];
    if (!entry?.quantity || entry.unit !== 'sqft') continue;
    if (!EXPLICIT_ITEM_QUANTITY_SOURCES.has(entry.quantitySource || 'user_entered')) continue;
    next[field] = String(entry.quantity);
  }
  return next;
}

function measurementsForRatePricing(
  measurements: NormalizedScopeMeasurements
): Parameters<typeof resolveItemRatePricingFromNotes>[1] {
  return {
    backsplashSqft: measurements.backsplashSqft ?? sqftFromItemQuantities(measurements, 'backsplash'),
    wallPaintSqft: measurements.wallPaintSqft ?? sqftFromItemQuantities(measurements, 'paint'),
    showerWallTileSqft: measurements.showerWallTileSqft ?? sqftFromItemQuantities(measurements, 'shower_tile'),
    kitchenFloorSqft: measurements.kitchenFloorSqft ?? undefined,
    bathroomFloorSqft: measurements.bathroomFloorSqft ?? undefined,
    floorAreaSqft: measurements.floorAreaSqft ?? undefined,
    flooringSqft: measurements.flooringSqft ?? undefined,
    drywallSqft: measurements.drywallSqft ?? undefined,
    exteriorPaintSqft: measurements.exteriorPaintSqft ?? undefined,
    landscapeSqft: measurements.landscapeSqft ?? undefined,
    sodSqft: measurements.sodSqft ?? undefined,
    paverSqft: measurements.paverSqft ?? undefined,
    rockMulchSqft: measurements.rockMulchSqft ?? undefined,
    landscapeTons: measurements.landscapeTons ?? undefined,
    roofSquares: measurements.roofSquares ?? undefined,
    concreteSqft: measurements.concreteSqft ?? undefined,
    concreteCy: measurements.concreteCy ?? undefined,
    excavationCy: measurements.excavationCy ?? undefined,
    deckSqft: measurements.deckSqft ?? undefined,
    railingLf: measurements.railingLf ?? undefined,
    baseboardLf: measurements.baseboardLf ?? undefined,
  };
}

function measurementsForRatePricingWithCount(
  measurements: NormalizedScopeMeasurements,
  itemId: string,
  countEntry: ReturnType<typeof parseStoredItemQuantity>
): Parameters<typeof resolveItemRatePricingFromNotes>[1] {
  const base = measurementsForRatePricing(measurements);
  if (countEntry?.unit !== 'sqft' || !countEntry.quantity) return base;
  if (itemId === 'backsplash' && !base.backsplashSqft) {
    return { ...base, backsplashSqft: countEntry.quantity };
  }
  if (itemId === 'paint' && !base.wallPaintSqft) {
    return { ...base, wallPaintSqft: countEntry.quantity };
  }
  if (itemId === 'shower_tile' && !base.showerWallTileSqft) {
    return { ...base, showerWallTileSqft: countEntry.quantity };
  }
  return base;
}

function isRatePricingSubKey(key: string): boolean {
  return /__(?:material|labor|allowance)$/.test(key);
}

function measurementsPayloadForRatePricing(
  input: ScopeMeasurementsInputExtended
): NonNullable<Parameters<typeof parseScopeItemRatePricingFromNotes>[1]> {
  const synced = syncDualAllowanceSqftFields(input);
  return {
    backsplashSqft:
      parseScopeMeasurementInput(synced.backsplashSqft) ??
      sqftFromItemQuantities(synced, 'backsplash'),
    wallPaintSqft:
      parseScopeMeasurementInput(synced.wallPaintSqft) ??
      sqftFromItemQuantities(synced, 'paint'),
    showerWallTileSqft:
      parseScopeMeasurementInput(synced.showerWallTileSqft) ??
      sqftFromItemQuantities(synced, 'shower_tile'),
    kitchenFloorSqft: parseScopeMeasurementInput(input.kitchenFloorSqft) ?? undefined,
    bathroomFloorSqft: parseScopeMeasurementInput(input.bathroomFloorSqft) ?? undefined,
    floorAreaSqft: parseScopeMeasurementInput(input.floorAreaSqft) ?? undefined,
    drywallSqft: parseScopeMeasurementInput(input.drywallSqft) ?? undefined,
    exteriorPaintSqft: parseScopeMeasurementInput(input.exteriorPaintSqft) ?? undefined,
    landscapeSqft: parseScopeMeasurementInput(input.landscapeSqft) ?? undefined,
    sodSqft: parseScopeMeasurementInput(input.sodSqft) ?? undefined,
    paverSqft: parseScopeMeasurementInput(input.paverSqft) ?? undefined,
    rockMulchSqft: parseScopeMeasurementInput(input.rockMulchSqft) ?? undefined,
    landscapeTons: parseScopeMeasurementInput(input.landscapeTons) ?? undefined,
    roofSquares: parseScopeMeasurementInput(input.roofSquares) ?? undefined,
    concreteSqft: parseScopeMeasurementInput(input.concreteSqft) ?? undefined,
    concreteCy: parseScopeMeasurementInput(input.concreteCy) ?? undefined,
    excavationCy: parseScopeMeasurementInput(input.excavationCy) ?? undefined,
    deckSqft: parseScopeMeasurementInput(input.deckSqft) ?? undefined,
    railingLf: parseScopeMeasurementInput(input.railingLf) ?? undefined,
    baseboardLf: parseScopeMeasurementInput(input.baseboardLf) ?? undefined,
  };
}

/** Drop allowance totals that are actually $/sqft rates saved by mistake. */
export function sanitizeMistakenUnitRateAllowances(
  input: ScopeMeasurementsInputExtended
): ScopeMeasurementsInputExtended {
  const synced = syncDualAllowanceSqftFields(input);
  const itemQuantities = { ...synced.itemQuantities };
  const checks: Array<{ itemId: string; sqftKey: keyof ScopeMeasurementsInputExtended }> = [
    { itemId: 'backsplash', sqftKey: 'backsplashSqft' },
    { itemId: 'paint', sqftKey: 'wallPaintSqft' },
    { itemId: 'shower_tile', sqftKey: 'showerWallTileSqft' },
    { itemId: 'flooring', sqftKey: 'flooringSqft' },
    { itemId: 'floor_demo', sqftKey: 'floorAreaSqft' },
  ];
  for (const { itemId, sqftKey } of checks) {
    const sqft =
      parseScopeMeasurementInput(String(synced[sqftKey] ?? '')) ??
      sqftFromItemQuantities(synced, itemId);
    if (!sqft) continue;
    const allowanceKey = roughAllowanceSubKey(itemId);
    const entry = itemQuantities[allowanceKey];
    if (entry?.quantity && Number(entry.quantity) > 0 && Number(entry.quantity) < sqft) {
      delete itemQuantities[allowanceKey];
    }
  }
  for (const itemId of PLACEHOLDER_ALLOWANCE_ITEM_IDS) {
    const entry = itemQuantities[itemId];
    if (
      entry &&
      isPlaceholderAllowancePricing(parseScopeMeasurementInput(String(entry.quantity)), entry.unit)
    ) {
      delete itemQuantities[itemId];
    }
    if (isDualAllowanceItem(itemId)) {
      const allowanceKey = roughAllowanceSubKey(itemId);
      const allowanceEntry = itemQuantities[allowanceKey];
      if (
        allowanceEntry &&
        isPlaceholderAllowancePricing(
          parseScopeMeasurementInput(String(allowanceEntry.quantity)),
          allowanceEntry.unit
        )
      ) {
        delete itemQuantities[allowanceKey];
      }
    }
  }
  return { ...synced, itemQuantities };
}

function ratePricingItemIdFromKey(key: string): string | null {
  const match = String(key || '').match(/^(.+)__(?:material|labor|allowance)$/);
  return match ? match[1] : null;
}

type ScopeItemQuantityLike = {
  quantity?: number | string | null;
  unit?: string;
  quantitySource?: QuantitySource;
  includesCountertops?: boolean;
};

function isUserEnteredQuantity(val: ScopeItemQuantityLike | undefined): boolean {
  return val?.quantitySource === 'user_entered';
}

function itemHasUserEnteredPricing(
  itemQuantities: Record<string, ScopeItemQuantityLike>,
  itemId: string
): boolean {
  return (
    isUserEnteredQuantity(itemQuantities[itemId]) ||
    isUserEnteredQuantity(itemQuantities[`${itemId}__material`]) ||
    isUserEnteredQuantity(itemQuantities[`${itemId}__labor`]) ||
    isUserEnteredQuantity(itemQuantities[`${itemId}__allowance`])
  );
}

function hasUserEnteredFlatAllowancePricing(
  itemQuantities: Record<string, ScopeItemQuantityLike>,
  itemId: string
): boolean {
  const allowance = itemQuantities[roughAllowanceSubKey(itemId)];
  if (isUserEnteredQuantity(allowance) && Number(allowance.quantity || 0) > 0) return true;

  const item = itemQuantities[itemId];
  const unit = String(item?.unit || '').toLowerCase();
  return (
    isUserEnteredQuantity(item) &&
    ['allowance', 'lump_sum'].includes(unit) &&
    Number(item?.quantity || 0) > 0 &&
    !isPlaceholderAllowancePricing(Number(item?.quantity || 0), unit, itemId)
  );
}

/** True only when the user explicitly chose material, labor, and total (e.g. "Use this pricing"). */
export function hasCompleteUserSelectedPricing(
  itemQuantities: Record<string, ScopeItemQuantityLike>,
  itemId: string
): boolean {
  const material = itemQuantities[`${itemId}__material`];
  const labor = itemQuantities[`${itemId}__labor`];
  const allowance = itemQuantities[roughAllowanceSubKey(itemId)];
  return (
    material?.quantitySource === 'user_entered' &&
    labor?.quantitySource === 'user_entered' &&
    allowance?.quantitySource === 'user_entered' &&
    Number(material.quantity || 0) > 0 &&
    Number(labor.quantity || 0) > 0 &&
    Number(allowance.quantity || 0) > 0
  );
}

function stripRatePricingSubkeys(
  itemQuantities: Record<string, ScopeItemQuantityValue> | undefined
): Record<string, ScopeItemQuantityValue> {
  const out: Record<string, ScopeItemQuantityValue> = {};
  for (const [id, val] of Object.entries(itemQuantities || {})) {
    if (/__(?:material|labor|allowance)$/.test(id)) continue;
    out[id] = val;
  }
  return out;
}

/** Bake sqft × rate totals into itemQuantities so UI does not depend on live notes at render. */
export function reparseRatePricingIntoItemQuantities(
  input: ScopeMeasurementsInputExtended,
  scopeNotes: string,
  templateKey?: string | null
): ScopeMeasurementsInputExtended {
  const text = String(scopeNotes || '').trim();
  if (!text) return input;

  const itemQuantities = { ...input.itemQuantities };
  const rateItems = parseScopeItemRatePricingFromNotes(
    text,
    measurementsPayloadForRatePricing(input),
    { templateKey: templateKey ?? undefined }
  );

  const touchedItemIds = new Set<string>();
  for (const key of Object.keys(rateItems)) {
    const itemId = ratePricingItemIdFromKey(key) || (rateItems[key] ? key : null);
    if (itemId) touchedItemIds.add(itemId);
  }
  for (const itemId of touchedItemIds) {
    if (hasCompleteUserSelectedPricing(itemQuantities, itemId)) continue;
    delete itemQuantities[`${itemId}__material`];
    delete itemQuantities[`${itemId}__labor`];
    delete itemQuantities[`${itemId}__allowance`];
  }

  for (const [id, val] of Object.entries(rateItems)) {
    if (!val.quantity || Number(val.quantity) <= 0) continue;
    const itemId = ratePricingItemIdFromKey(id) || id;
    if (hasCompleteUserSelectedPricing(itemQuantities, itemId)) continue;
    itemQuantities[id] = {
      quantity: String(val.quantity),
      unit: val.unit || 'allowance',
      quantitySource: 'notes',
    };
  }
  return { ...input, itemQuantities };
}

function finalizeRateAllowanceTotal(
  effectiveAllowance: ReturnType<typeof parseStoredItemQuantity>,
  materialEntry: ReturnType<typeof parseStoredItemQuantity>,
  laborEntry: ReturnType<typeof parseStoredItemQuantity>,
  countEntry: ReturnType<typeof parseStoredItemQuantity>
): ReturnType<typeof parseStoredItemQuantity> {
  const sqft = countEntry?.quantity ?? null;
  const splitTotal = (materialEntry?.quantity || 0) + (laborEntry?.quantity || 0);
  const looksLikeUnitRate =
    effectiveAllowance &&
    sqft != null &&
    effectiveAllowance.quantity > 0 &&
    effectiveAllowance.quantity < sqft;
  if (
    splitTotal > 0 &&
    (!effectiveAllowance || looksLikeUnitRate || effectiveAllowance.quantity < splitTotal)
  ) {
    return {
      quantity: splitTotal,
      unit: 'allowance',
      quantitySource:
        materialEntry?.quantitySource || laborEntry?.quantitySource || effectiveAllowance?.quantitySource || 'notes',
    };
  }
  if (looksLikeUnitRate && effectiveAllowance && sqft != null) {
    return {
      quantity: Math.round(effectiveAllowance.quantity * sqft * 100) / 100,
      unit: 'allowance',
      quantitySource: effectiveAllowance.quantitySource || 'notes',
    };
  }
  return effectiveAllowance;
}

function withRatePricingHydratedFromNotes(
  measurements: NormalizedScopeMeasurements,
  itemId: string,
  notes?: string | null,
  templateKey?: string | null,
  countEntry?: ReturnType<typeof parseStoredItemQuantity>
): NormalizedScopeMeasurements {
  const text = String(notes || '').trim();
  if (!text) return measurements;

  const parsed = parseScopeItemRatePricingFromNotes(
    text,
    measurementsForRatePricingWithCount(measurements, itemId, countEntry ?? null),
    { templateKey: templateKey ?? undefined }
  );
  if (!Object.keys(parsed).length) return measurements;

  const itemQuantities = { ...measurements.itemQuantities };
  for (const [key, val] of Object.entries(parsed)) {
    if (!key.startsWith(`${itemId}__`)) continue;
    const existing = itemQuantities[key];
    if (existing?.quantitySource === 'user_entered') {
      continue;
    }
    itemQuantities[key] = {
      quantity: val.quantity,
      unit: val.unit || 'allowance',
      quantitySource: val.quantitySource || 'notes',
    };
  }
  return { ...measurements, itemQuantities };
}

function applyRatePricingBreakdown(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  notes: string | null | undefined,
  templateKey: string | null | undefined,
  countEntry: ReturnType<typeof parseStoredItemQuantity>,
  allowanceEntry: ReturnType<typeof parseStoredItemQuantity>,
  legacyAllowance: ReturnType<typeof parseStoredItemQuantity>
): {
  effectiveAllowance: ReturnType<typeof parseStoredItemQuantity>;
  materialEntry: ReturnType<typeof parseStoredItemQuantity>;
  laborEntry: ReturnType<typeof parseStoredItemQuantity>;
} {
  let effectiveAllowance = allowanceEntry || legacyAllowance;
  let materialEntry = parseStoredItemQuantity(measurements, `${itemId}__material`);
  let laborEntry = parseStoredItemQuantity(measurements, `${itemId}__labor`);

  const sqft = countEntry?.quantity ?? null;

  if (!notes?.trim()) {
    if (materialEntry || laborEntry) {
      effectiveAllowance = finalizeRateAllowanceTotal(
        effectiveAllowance,
        materialEntry,
        laborEntry,
        countEntry
      );
    } else if (
      effectiveAllowance &&
      sqft != null &&
      effectiveAllowance.quantity > 0 &&
      effectiveAllowance.quantity < sqft
    ) {
      effectiveAllowance = {
        quantity: Math.round(effectiveAllowance.quantity * sqft * 100) / 100,
        unit: 'allowance',
        quantitySource: effectiveAllowance.quantitySource || 'notes',
      };
    }
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  const rateBreakdown = resolveItemRatePricingFromNotes(
    itemId,
    measurementsForRatePricingWithCount(measurements, itemId, countEntry),
    notes,
    { templateKey: templateKey ?? undefined }
  );
  if (!rateBreakdown) {
    effectiveAllowance = finalizeRateAllowanceTotal(
      effectiveAllowance,
      materialEntry,
      laborEntry,
      countEntry
    );
    if (
      !effectiveAllowance &&
      sqft != null &&
      allowanceEntry &&
      allowanceEntry.quantity > 0 &&
      allowanceEntry.quantity < sqft
    ) {
      effectiveAllowance = {
        quantity: Math.round(allowanceEntry.quantity * sqft * 100) / 100,
        unit: 'allowance',
        quantitySource: allowanceEntry.quantitySource || 'notes',
      };
    }
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  if (hasCompleteUserSelectedPricing(measurements.itemQuantities || {}, itemId)) {
    effectiveAllowance = finalizeRateAllowanceTotal(
      effectiveAllowance,
      materialEntry,
      laborEntry,
      countEntry
    );
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  effectiveAllowance = {
    quantity: rateBreakdown.total,
    unit: 'allowance',
    quantitySource: 'notes',
  };
  if (rateBreakdown.material != null) {
    materialEntry = {
      quantity: rateBreakdown.material,
      unit: 'allowance',
      quantitySource: 'notes',
    };
  }
  if (rateBreakdown.labor != null) {
    laborEntry = {
      quantity: rateBreakdown.labor,
      unit: 'allowance',
      quantitySource: 'notes',
    };
  }
  effectiveAllowance = finalizeRateAllowanceTotal(
    effectiveAllowance,
    materialEntry,
    laborEntry,
    countEntry
  );
  return { effectiveAllowance, materialEntry, laborEntry };
}

/**
 * Display-only: sqft × $/sqft from notes, ignoring persisted __material/__labor/__allowance.
 * Used when Step 2 reopens with stale saved measurements from an older parse.
 */
export function resolveDualRatePricingDisplayFromNotes(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  notes?: string | null,
  templateKey?: string | null
): Pick<
  ResolvedItemQuantity,
  'dualCount' | 'dualMaterial' | 'dualLabor' | 'dualAllowance' | 'pricingReady' | 'quantitySource' | 'sourceLabel'
> | null {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule?.dualAllowanceField) return null;

  const text = String(notes || '').trim();
  if (!text) return null;

  let sqft: number | null = null;
  if (rule.measurementKey) {
    sqft = parseScopeMeasurementInput(
      String(measurementsInput[rule.measurementKey as keyof ScopeMeasurementsInputExtended] ?? '')
    );
  }
  if (!sqft && rule.measurementKeys?.length) {
    for (const key of rule.measurementKeys) {
      sqft = parseScopeMeasurementInput(
        String(measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? '')
      );
      if (sqft) break;
    }
  }
  sqft = sqft ?? sqftFromItemQuantities(measurementsInput, itemId) ?? null;
  if (!sqft) return null;

  const syncedInput: ScopeMeasurementsInputExtended = {
    ...measurementsInput,
    ...(itemId === 'backsplash' ? { backsplashSqft: String(sqft) } : {}),
    ...(itemId === 'paint' ? { wallPaintSqft: String(sqft) } : {}),
    ...(itemId === 'shower_tile' ? { showerWallTileSqft: String(sqft) } : {}),
    ...(itemId === 'flooring' ? { floorAreaSqft: String(sqft) } : {}),
  };

  const breakdown = resolveItemRatePricingFromNotes(
    itemId,
    measurementsPayloadForRatePricing(syncedInput),
    text,
    { templateKey: templateKey ?? undefined }
  );
  if (!breakdown?.total) return null;

  const countEntry = {
    quantity: sqft,
    unit: rule.defaultUnit,
    quantitySource: 'notes' as const,
  };
  const materialEntry =
    breakdown.material != null
      ? { quantity: breakdown.material, unit: 'allowance' as const, quantitySource: 'notes' as const }
      : null;
  let laborEntry =
    breakdown.labor != null
      ? { quantity: breakdown.labor, unit: 'allowance' as const, quantitySource: 'notes' as const }
      : null;
  const allowanceEntry = {
    quantity: breakdown.total,
    unit: 'allowance' as const,
    quantitySource: 'notes' as const,
  };

  return {
    dualCount: countEntry,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
    dualAllowance: finalizeRateAllowanceTotal(
      allowanceEntry,
      materialEntry,
      laborEntry,
      countEntry
    ),
    pricingReady: true,
    quantitySource: 'notes',
    sourceLabel: sourceLabel('notes'),
  };
}

function firstMeasurementQuantityForRule(
  rule: ScopeItemQuantityRule,
  measurementsInput: ScopeMeasurementsInputExtended
): number | null {
  return firstMeasurementForRule(rule, measurementsInput)?.quantity ?? null;
}

function measurementUnitForKey(key: keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>, fallbackUnit: string): string {
  if (/Sqft$/.test(key)) return 'sqft';
  if (/Lf$/.test(key)) return 'lf';
  if (/Cy$/.test(key)) return 'cy';
  if (/Tons$/.test(key)) return 'ton';
  if (/Squares$/.test(key)) return 'squares';
  return fallbackUnit;
}

function shouldIgnoreFlooringMeasurementKey(
  key: string,
  measurementsInput: ScopeMeasurementsInputExtended
): boolean {
  if (!measurementSemanticsV1Enabled() || key !== 'flooringSqft') return false;
  return isGrossFlooringDerivedFromLiving({
    flooringSqft: parseScopeMeasurementInput(String(measurementsInput.flooringSqft ?? '')),
    floorAreaSqft: parseScopeMeasurementInput(String(measurementsInput.floorAreaSqft ?? '')),
  });
}

function firstMeasurementForRule(
  rule: ScopeItemQuantityRule,
  measurementsInput: ScopeMeasurementsInputExtended
): { quantity: number; unit: string } | null {
  if (rule.measurementKey) {
    if (!shouldIgnoreFlooringMeasurementKey(rule.measurementKey, measurementsInput)) {
      const quantity = parseScopeMeasurementInput(
        String(measurementsInput[rule.measurementKey as keyof ScopeMeasurementsInputExtended] ?? '')
      );
      if (quantity && quantity > 0) {
        return { quantity, unit: measurementUnitForKey(rule.measurementKey, rule.defaultUnit) };
      }
    }
  }
  if (rule.measurementKeys?.length) {
    for (const key of rule.measurementKeys) {
      if (shouldIgnoreFlooringMeasurementKey(key, measurementsInput)) continue;
      const quantity = parseScopeMeasurementInput(
        String(measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? '')
      );
      if (quantity && quantity > 0) {
        return { quantity, unit: measurementUnitForKey(key, rule.defaultUnit) };
      }
    }
  }
  return null;
}

function firstPricingBasisMeasurementForRule(
  rule: ScopeItemQuantityRule,
  measurementsInput: ScopeMeasurementsInputExtended
): { quantity: number; unit: string } | null {
  const keys = rule.pricingBasisMeasurementKeys?.length
    ? rule.pricingBasisMeasurementKeys
    : rule.pricingBasisMeasurementKey
      ? [rule.pricingBasisMeasurementKey]
      : [];
  for (const key of keys) {
    const quantity = parseScopeMeasurementInput(
      String(measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? '')
    );
    if (quantity && quantity > 0) {
      return { quantity, unit: measurementUnitForKey(key, rule.defaultUnit) };
    }
  }
  return null;
}

export function resolveBudgetSplitQuantity(
  itemId: string,
  templateKey: string | null | undefined,
  measurementsInput: ScopeMeasurementsInputExtended,
  resolved: Pick<ResolvedItemQuantity, 'quantity' | 'unit' | 'dualCount'>,
  scopeQuantity?: { quantity: number; unit: string } | null
): number | null {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule) return null;
  const measurementMatch = firstMeasurementForRule(rule, measurementsInput);
  const preferredUnit =
    scopeQuantity?.unit ||
    resolved.dualCount?.unit ||
    (resolved.unit && !['allowance', 'lump_sum'].includes(resolved.unit) ? resolved.unit : null) ||
    measurementMatch?.unit ||
    rule?.defaultUnit;
  const average = getNationalAverageBudgetSplit(itemId, preferredUnit);
  if (!average) return null;

  if (scopeQuantity && scopeQuantity.quantity > 0 && scopeQuantity.unit === average.unit) {
    return scopeQuantity.quantity;
  }
  if (resolved.dualCount?.unit === average.unit && resolved.dualCount.quantity > 0) {
    return resolved.dualCount.quantity;
  }
  if (resolved.quantity != null && resolved.unit === average.unit && resolved.quantity > 0) {
    return resolved.quantity;
  }
  if (itemId === 'floor_demo' && average.unit === 'sqft') {
    const floorArea = parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
    if (floorArea && floorArea > 0) return floorArea;
  }
  return measurementMatch?.quantity ?? null;
}

export function resolveSuggestedBudgetSplitDisplay(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  templateKey: string | null | undefined,
  resolved: Pick<
    ResolvedItemQuantity,
    'quantity' | 'unit' | 'quantitySource' | 'dualCount' | 'dualMaterial' | 'dualLabor' | 'dualAllowance'
  >
): SuggestedBudgetSplitDisplay | null {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule) return null;
  const measurementMatch = firstMeasurementForRule(rule, measurementsInput);
  const preferredUnit =
    resolved.dualCount?.unit ||
    (resolved.unit && !['allowance', 'lump_sum'].includes(resolved.unit) ? resolved.unit : null) ||
    measurementMatch?.unit ||
    rule?.defaultUnit;
  const average = getNationalAverageBudgetSplit(itemId, preferredUnit);
  if (!average) return null;
  if (resolved.dualMaterial || resolved.dualLabor) return null;

  const count =
    resolved.dualCount?.unit === average.unit && resolved.dualCount.quantity > 0
      ? resolved.dualCount.quantity
      : itemId === 'floor_demo' && average.unit === 'sqft'
        ? parseScopeMeasurementInput(measurementsInput.floorAreaSqft) ?? firstMeasurementQuantityForRule(rule, measurementsInput)
        : measurementMatch?.quantity ?? null;

  const hasNoteTotal = resolved.quantitySource === 'notes' || resolved.dualAllowance?.quantity != null;
  const inferredCountCanPrice =
    !hasNoteTotal &&
    resolved.quantity != null &&
    resolved.unit === average.unit &&
    resolved.quantity > 0;
  if (!hasNoteTotal && !inferredCountCanPrice) return null;

  const total = hasNoteTotal
    ? Number(resolved.dualAllowance?.quantity ?? resolved.quantity ?? 0)
    : Math.round(Number(resolved.quantity) * (average.material + average.labor) * 100) / 100;
  if (!Number.isFinite(total) || total <= 0) return null;

  const split = computeNationalAverageBudgetSplit(itemId, total, count ?? 0, average.unit);
  if (!split || !count) return null;

  return {
    material: split.material,
    labor: split.labor,
    total,
    sourceLabel: average.sourceLabel,
    helper: `Based on ${count.toLocaleString()} ${average.unit}`,
    mode: hasNoteTotal ? 'note_total_split' : 'suggested_price',
    basis: { quantity: count, unit: average.unit },
  };
}

// ---------------------------------------------------------------------------
// Unified scope pricing engine
// ---------------------------------------------------------------------------
// One model that resolves each item's material + labor legs independently from
// a clear source priority: notes (explicit) -> saved template/bid rate (same
// trade family) -> national average. Handles lump-sum split, material-only
// fill, labor-only fill, and a comparison split when notes priced both legs.

export type PricingLegSource = 'notes' | 'template' | 'local_benchmark' | 'national_average';

export type ScopePricingLineItem = {
  name?: string | null;
  label?: string | null;
  description?: string | null;
  mode?: string | null;
  unit?: string | null;
  unitType?: string | null;
  quantity?: number | null;
  qty?: number | null;
  hours?: number | null;
  unitPrice?: number | null;
  cost?: number | null;
  rate?: number | null;
  total?: number | null;
};

export type ScopePricingTemplateSource = {
  name?: string | null;
  materialLineItems?: ScopePricingLineItem[] | null;
  laborLineItems?: ScopePricingLineItem[] | null;
};

/** Saved templates + the active bid, used to derive $/unit rates by trade family. */
export type ScopePricingContext = {
  templates?: ScopePricingTemplateSource[] | null;
  bid?: ScopePricingTemplateSource | null;
  state?: string | null;
  zipCode?: string | null;
  city?: string | null;
};

export type TemplateRateMatch = {
  materialRate: number | null;
  laborRate: number | null;
  source: string;
};

/** Fallback trade families for items that have no rate-pricing matcher. */
const TEMPLATE_FAMILY_FALLBACK: Record<string, RegExp> = {
  countertops: /counter\s*top|quartz|granite|laminate\s*top|solid\s*surface|butcher\s*block/i,
  cabinets: /cabinet|cabinetry|vanity/i,
  floor_prep: /floor\s*prep|underlayment|leveling|self\s*level|patch/i,
  waterproofing: /waterproof|kerdi|redgard|red\s*guard|schluter|membrane/i,
  demo: /demo|demolition|tear\s*out|removal|remove|haul/i,
  floor_demo: /demo|demolition|tear\s*out|removal|remove/i,
};

function normalizeRateUnit(unit?: string | null): string | null {
  const value = String(unit || '').toLowerCase().trim();
  if (!value) return null;
  if (/^(sqft|sf|sq\.?\s*ft|sq\s*ft|sq\s*feet|square\s*f(?:oo|ee)t)$/.test(value)) return 'sqft';
  if (/^(lf|linear\s*f(?:oo|ee)t|ln\.?\s*ft|lin\.?\s*ft)$/.test(value)) return 'lf';
  if (/^(cy|cubic\s*yards?)$/.test(value)) return 'cy';
  if (/^(ton|tons)$/.test(value)) return 'ton';
  if (/^(square|squares)$/.test(value)) return 'squares';
  return value;
}

function lineItemRatePerUnit(item: ScopePricingLineItem): number | null {
  const direct = Number(item.unitPrice ?? item.cost ?? item.rate ?? 0);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct * 100) / 100;
  const qty = Number(item.quantity ?? item.qty ?? item.hours ?? 0);
  const total = Number(item.total ?? 0);
  if (qty > 0 && total > 0) return Math.round((total / qty) * 100) / 100;
  return null;
}

function lineItemNormalizedUnit(item: ScopePricingLineItem): string | null {
  const explicit = normalizeRateUnit(item.unit ?? item.unitType);
  if (explicit) return explicit;
  if (String(item.mode || '').toLowerCase() === 'sqft') return 'sqft';
  return null;
}

function lineItemMatchesFamily(
  item: ScopePricingLineItem,
  matcher: { match: RegExp; exclude?: RegExp }
): boolean {
  const text = `${item.name || ''} ${item.label || ''} ${item.description || ''}`.trim();
  if (!text) return false;
  if (!matcher.match.test(text)) return false;
  if (matcher.exclude?.test(text)) return false;
  return true;
}

function averageMatchingRate(
  items: ScopePricingLineItem[] | null | undefined,
  matcher: { match: RegExp; exclude?: RegExp },
  targetUnit: string | null
): number | null {
  if (!Array.isArray(items) || !items.length) return null;
  const rates: number[] = [];
  for (const item of items) {
    if (!lineItemMatchesFamily(item, matcher)) continue;
    if (targetUnit && lineItemNormalizedUnit(item) !== targetUnit) continue;
    const rate = lineItemRatePerUnit(item);
    if (rate) rates.push(rate);
  }
  if (!rates.length) return null;
  const sum = rates.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / rates.length) * 100) / 100;
}

/**
 * Resolve a $/unit material + labor rate for a checklist item from saved
 * templates and the active bid, matched within the same trade family and unit.
 * The active bid is checked first (most specific to the current job).
 */
export function resolveTemplateRateForItem(
  itemId: string,
  unit: string | null | undefined,
  ctx?: ScopePricingContext | null
): TemplateRateMatch | null {
  if (!ctx) return null;
  const matcher =
    getRatePricingMatcher(itemId) ||
    (TEMPLATE_FAMILY_FALLBACK[itemId] ? { match: TEMPLATE_FAMILY_FALLBACK[itemId] } : null);
  if (!matcher) return null;

  const targetUnit = normalizeRateUnit(unit);
  const sources: ScopePricingTemplateSource[] = [
    ...(ctx.bid ? [ctx.bid] : []),
    ...((ctx.templates || []).filter(Boolean) as ScopePricingTemplateSource[]),
  ];

  for (const source of sources) {
    const materialRate = averageMatchingRate(source.materialLineItems, matcher, targetUnit);
    const laborRate = averageMatchingRate(source.laborLineItems, matcher, targetUnit);
    if (materialRate || laborRate) {
      return {
        materialRate: materialRate ?? null,
        laborRate: laborRate ?? null,
        source: String(source.name || 'Saved pricing'),
      };
    }
  }
  return null;
}

export type SuggestedPricingMode =
  | 'note_total_split'
  | 'fill_missing'
  | 'suggested_price';

/** Suggested pricing block enriched with per-leg sources for the Confirm Scope UI. */
export type SuggestedPricingBlock = {
  material: number;
  labor: number;
  total: number;
  materialSource: PricingLegSource;
  laborSource: PricingLegSource;
  rateSourceLabel: string;
  templateName?: string | null;
  helper: string;
  mode: SuggestedPricingMode;
  isComparison?: boolean;
  /** Permit/fees-style flat allowance — hide material row in UI. */
  lumpSumOnly?: boolean;
  basis?: { quantity: number; unit: string } | null;
  benchmarkScopeProfile?: BenchmarkScopeAssumptionProfile;
  costBuckets?: SuggestedPricingCostBucket[];
  pricingRecordId?: string;
  productionStatus?: BenchmarkPricingProductionStatus;
  benchmarkEvidence?: BenchmarkSuggestion;
  benchmarkProvenance?: BenchmarkProvenance;
  /** Presentation/application metadata for stage vs scope benchmarks. */
  benchmarkLevel?: BenchmarkLevel;
  benchmarkStageKey?: string | null;
  benchmarkScopeKey?: string | null;
  coversScopeKeys?: string[];
  benchmarkAction?: BenchmarkCardAction;
  benchmarkApplicationKey?: string | null;
  includedInStageLabel?: string | null;
  /** Exact total retained for apply; UI may round for display. */
  storedTotalExact?: number | null;
};

export type ScopeItemSuggestedPricing = {
  /** Inline suggestion: fills a missing leg, splits a lump sum, or prices a quantity. */
  fill: SuggestedPricingBlock | null;
  /** Collapsible comparison shown when notes already priced both legs. */
  comparison: SuggestedPricingBlock | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function medianPositive(values: number[]): number | null {
  const sorted = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round2((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Plans/engineering should use local component refs (~$1–2k), not the full site stage. */
function plansEngineeringComponentTotal(evidence: BenchmarkSuggestion): number | null {
  const fromDetached = (evidence.detachedComparables || [])
    .map((p) => Number(p.scopeCost))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 20000);
  const fromAll = (evidence.comparables || [])
    .map((p) => Number(p.scopeCost))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 20000);
  return medianPositive(fromDetached.length ? fromDetached : fromAll);
}

function benchmarkSuggestedPricingBlock(
  itemId: string,
  comparison: boolean,
  pricingAcceptance?: ScopeMeasurementsInputExtended['pricingAcceptance'],
  templateKey?: string | null
): SuggestedPricingBlock | null {
  if (!benchmarkEngineV1Enabled()) return null;
  const evidence = getCachedBenchmarkSuggestion(itemId);
  const selected = evidence?.selectedSuggestion;
  const stageTotal = evidence?.blendedBenchmark.total;
  if (!evidence || !selected || stageTotal == null || stageTotal <= 0) return null;

  const stageId = evidence.stageId;
  const level = classifyBenchmarkLevel({ itemId, stageId });
  const includedChild = isIncludedInStageChild(itemId, stageId);
  const isStageHost = canApplyStageBenchmarkFill(itemId, stageId);
  const isSeparateTrade = Boolean(
    stageId && (STAGE_SEPARATE_TRADE_SCOPE_KEYS[stageId] || []).includes(itemId)
  );
  const groundUpLocked = isGroundUpStageComparisonOnly(stageId, templateKey);
  const tradeModeActive =
    level === 'stage' &&
    (groundUpLocked || stageHasAcceptedTradePricing(stageId, pricingAcceptance));

  // Separate trades never inherit the living-SF stage lump (fill or comparison).
  if (isSeparateTrade && !isStageHost && measurementSemanticsV1Enabled()) {
    return null;
  }

  // Plans/engineering: component references only — not Site Work / Preconstruction stage.
  // Must run before included-child short-circuit (plans is listed under that stage's covers).
  if (itemId === 'plans_engineering' && measurementSemanticsV1Enabled()) {
    const componentTotal = plansEngineeringComponentTotal(evidence);
    if (componentTotal == null) {
      return {
        material: 0,
        labor: 0,
        total: 0,
        materialSource: 'local_benchmark',
        laborSource: 'local_benchmark',
        rateSourceLabel: 'Suggested · Southern Utah benchmark',
        helper:
          'Plans/engineering is a separate soft-cost allowance — not part of the Sitework living-SF package. Enter an allowance or use local project references.',
        mode: 'suggested_price',
        isComparison: true,
        lumpSumOnly: true,
        basis: null,
        benchmarkLevel: 'component',
        benchmarkStageKey: stageId,
        benchmarkScopeKey: itemId,
        benchmarkAction: 'comparison_only',
        includedInStageLabel: undefined,
        storedTotalExact: null,
        benchmarkEvidence: {
          ...evidence,
          benchmarkIsComparisonOnly: true,
          benchmarkLevel: 'component',
        } as BenchmarkSuggestion,
      };
    }
    const action = benchmarkActionForBlock({
      isLocalBenchmark: true,
      hasPrimaryTakeoff: false,
      isComparisonOnly: comparison || evidence.benchmarkIsComparisonOnly,
    });
    return {
      material: 0,
      labor: round2(componentTotal),
      total: round2(componentTotal),
      materialSource: 'local_benchmark',
      laborSource: 'local_benchmark',
      rateSourceLabel: 'Suggested · Southern Utah benchmark',
      helper: `Local plans/engineering references (~$${Math.round(componentTotal).toLocaleString()}). Sitework living-SF package is separate.`,
      mode: 'suggested_price',
      isComparison: action === 'comparison_only',
      lumpSumOnly: true,
      basis: { quantity: 1, unit: 'ls' },
      pricingRecordId: `${evidence.datasetId}:plans_component:${evidence.datasetVersion}`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkStageKey: stageId,
      benchmarkScopeKey: itemId,
      coversScopeKeys: ['plans_engineering'],
      benchmarkAction: action === 'comparison_only' ? 'comparison_only' : 'benchmark_only',
      benchmarkApplicationKey: benchmarkApplicationKey({
        datasetId: evidence.datasetId,
        benchmarkLevel: 'component',
        benchmarkStageKey: `plans_engineering`,
      }),
      storedTotalExact: round2(componentTotal),
      benchmarkEvidence: {
        ...evidence,
        benchmarkIsComparisonOnly: action === 'comparison_only',
        benchmarkLevel: 'component',
        selectedSuggestion: {
          total: round2(componentTotal),
          rate: null,
          unit: 'ls',
          source: 'Local plans/engineering references',
        },
        blendedBenchmark: {
          ...evidence.blendedBenchmark,
          total: round2(componentTotal),
          rate: round2(componentTotal),
          appliedQuantity: 1,
          unit: 'living_sqft',
        },
      } as BenchmarkSuggestion,
    };
  }

  // Child scopes: never repeat the full stage dollar amount.
  if (includedChild && measurementSemanticsV1Enabled()) {
    const title = stageTitle(stageId);
    return {
      material: 0,
      labor: 0,
      total: 0,
      materialSource: 'local_benchmark',
      laborSource: 'local_benchmark',
      rateSourceLabel: 'Suggested · Southern Utah benchmark',
      helper: `Included in ${title} stage benchmark. Detailed takeoff still required.`,
      mode: 'suggested_price',
      isComparison: true,
      lumpSumOnly: true,
      basis: null,
      pricingRecordId: `${evidence.datasetId}:included:${itemId}`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkStageKey: stageId,
      benchmarkScopeKey: itemId,
      coversScopeKeys: [],
      benchmarkAction: 'included_in_stage',
      benchmarkApplicationKey: null,
      includedInStageLabel: title,
      storedTotalExact: null,
      benchmarkEvidence: {
        ...evidence,
        benchmarkIsComparisonOnly: true,
        benchmarkLevel: 'component',
        benchmarkStageKey: stageId,
        coversScopeKeys: [],
      } as BenchmarkSuggestion,
    };
  }

  const canApplyFill =
    isStageHost &&
    !tradeModeActive &&
    !evidence.benchmarkIsComparisonOnly &&
    !comparison;
  const comparisonOnly =
    tradeModeActive ||
    !canApplyFill ||
    evidence.benchmarkIsComparisonOnly ||
    comparison;
  const action = benchmarkActionForBlock({
    isLocalBenchmark: true,
    hasPrimaryTakeoff: Boolean(evidence.quantityRoles?.primaryTakeoff?.quantity),
    isComparisonOnly: comparisonOnly,
  });
  const appKey = benchmarkApplicationKey({
    datasetId: evidence.datasetId,
    benchmarkLevel: level === 'stage' ? 'stage' : level,
    benchmarkStageKey: stageId,
  });
  const title = stageTitle(stageId);
  const covers = level === 'stage' ? coversLabelList(stageId) : '';

  const benchmarkProvenance = comparisonOnly
    ? null
    : buildBenchmarkProvenance({
        ...evidence,
        benchmarkIsComparisonOnly: false,
        selectedSuggestion: {
          total: stageTotal,
          rate: evidence.blendedBenchmark.rate,
          unit: evidence.blendedBenchmark.unit,
          source: selected.source,
        },
      });

  return {
    material: 0,
    labor: round2(stageTotal),
    total: round2(stageTotal),
    materialSource: 'local_benchmark',
    laborSource: 'local_benchmark',
    rateSourceLabel: 'Suggested · Southern Utah benchmark',
    helper:
      tradeModeActive
        ? groundUpLocked
          ? `${title} planning comparison only · price separate trades (not this living-SF package)`
          : `${title} planning comparison only · separate trade pricing is active`
        : level === 'stage'
        ? `${title} planning benchmark · ${Number(evidence.blendedBenchmark.appliedQuantity || 0).toLocaleString()} living SF · covers ${covers}`
        : `Based on ${Number(evidence.blendedBenchmark.appliedQuantity || 0).toLocaleString()} living SF · planning benchmark`,
    mode: 'suggested_price',
    isComparison: comparisonOnly || action === 'comparison_only',
    lumpSumOnly: true,
    basis: evidence.blendedBenchmark.appliedQuantity
      ? {
          quantity: evidence.blendedBenchmark.appliedQuantity,
          unit: 'living_sqft',
        }
      : null,
    pricingRecordId: `${evidence.datasetId}:${stageId || itemId}:${evidence.datasetVersion}`,
    productionStatus: 'review_required',
    benchmarkLevel: level,
    benchmarkStageKey: stageId,
    benchmarkScopeKey: itemId,
    coversScopeKeys:
      level === 'stage' ? STAGE_COVERS_SCOPE_KEYS[stageId || ''] || [itemId] : [itemId],
    benchmarkAction: action,
    benchmarkApplicationKey: appKey,
    storedTotalExact: round2(stageTotal),
    benchmarkEvidence: {
      ...evidence,
      benchmarkIsComparisonOnly: comparisonOnly || evidence.benchmarkIsComparisonOnly,
      benchmarkLevel: level,
      benchmarkStageKey: stageId,
      coversScopeKeys:
        level === 'stage' ? STAGE_COVERS_SCOPE_KEYS[stageId || ''] || [itemId] : [itemId],
    } as BenchmarkSuggestion,
    benchmarkProvenance: benchmarkProvenance || undefined,
  };
}

/** When primary takeoff is missing, still surface cached living-SF benchmark evidence. */
function benchmarkFillWithoutPrimaryTakeoff(
  itemId: string,
  pricingAcceptance?: ScopeMeasurementsInputExtended['pricingAcceptance'],
  templateKey?: string | null
): ScopeItemSuggestedPricing | null {
  if (!benchmarkEngineV1Enabled() || !measurementSemanticsV1Enabled()) return null;
  const profile = getTradeMeasurementProfile(itemId);
  if (!profile?.canUseLivingSfAsBenchmark) return null;
  const block = benchmarkSuggestedPricingBlock(itemId, false, pricingAcceptance, templateKey);
  if (!block) return null;
  if (block.isComparison) return { fill: null, comparison: block };
  return { fill: block, comparison: null };
}

function rateSourceLabelFor(
  materialSource: PricingLegSource,
  laborSource: PricingLegSource,
  templateName: string | null,
  regional?: ResolvedRegionalPricing | null,
  average?: NationalAverageBudgetSplit | null
): string {
  const usesTemplate = materialSource === 'template' || laborSource === 'template';
  if (usesTemplate && templateName) return 'Suggested · Saved rate';
  if (regional && regional.multiplier !== 1) return regional.rateSourceLabel;
  if (
    (materialSource === 'national_average' || laborSource === 'national_average') &&
    average?.sourceLabel
  ) {
    return average.sourceLabel;
  }
  return 'Suggested · National Average';
}

function regionalPricingFromContext(
  pricingContext?: ScopePricingContext | null
): ResolvedRegionalPricing {
  return resolveRegionalPricingMultiplier({
    state: pricingContext?.state,
    zipCode: pricingContext?.zipCode,
    city: pricingContext?.city,
  });
}

function regionalAdjustedNationalAverage(
  itemId: string,
  unit: string | null | undefined,
  pricingContext?: ScopePricingContext | null
): {
  average: NationalAverageBudgetSplit | null | undefined;
  regional: ResolvedRegionalPricing;
} {
  const base = getNationalAverageBudgetSplit(itemId, unit);
  const regional = regionalPricingFromContext(pricingContext);
  if (!base) {
    return { average: base, regional };
  }

  // Nationwide baseline: national rates nudged by the builder-budget barometer,
  // then scaled by state multiplier (CA, NY, etc.).
  const withBarometer = applyBuilderBudgetBarometer(itemId, unit || base.unit, base) || base;

  if (regional.multiplier === 1) {
    return { average: withBarometer, regional };
  }
  return {
    average: applyRegionalMultiplierToBudgetSplit(withBarometer, regional),
    regional,
  };
}

function flatAllowanceCopyFor(itemId: string): { fromNotes: string; suggested: string } {
  const copyByItem: Record<string, { fromNotes: string; suggested: string }> = {
    cleanup: {
      fromNotes: 'Cleanup/disposal allowance parsed from notes.',
      suggested: 'Suggested cleanup and disposal allowance.',
    },
    plans_engineering: {
      fromNotes: 'Plans/engineering allowance parsed from notes.',
      suggested: 'Suggested plans and engineering allowance.',
    },
    cabinets_counters: {
      fromNotes: 'Cabinet and counter allowance parsed from notes.',
      suggested: 'Suggested cabinet and counter allowance.',
    },
    plumbing_trim: {
      fromNotes: 'Plumbing trim-out allowance parsed from notes.',
      suggested: 'Suggested plumbing trim-out allowance.',
    },
    electrical_trim: {
      fromNotes: 'Electrical trim-out allowance parsed from notes.',
      suggested: 'Suggested electrical trim-out allowance.',
    },
    final_inspections: {
      fromNotes: 'Final inspection allowance parsed from notes.',
      suggested: 'Suggested final inspection allowance.',
    },
    contingency: {
      fromNotes: 'Contingency allowance parsed from notes.',
      suggested: 'Suggested contingency allowance.',
    },
    mobilization: {
      fromNotes: 'Mobilization allowance parsed from notes.',
      suggested: 'Suggested mobilization allowance.',
    },
    emergency_fee: {
      fromNotes: 'Emergency fee parsed from notes.',
      suggested: 'Suggested emergency fee allowance.',
    },
    haul_off: {
      fromNotes: 'Haul-off allowance parsed from notes.',
      suggested: 'Suggested haul-off / dumpster allowance.',
    },
    survey: {
      fromNotes: 'Survey allowance parsed from notes.',
      suggested: 'Suggested survey allowance.',
    },
    general_conditions: {
      fromNotes: 'General conditions allowance parsed from notes.',
      suggested: 'Suggested general conditions allowance.',
    },
    supervision: {
      fromNotes: 'Supervision allowance parsed from notes.',
      suggested: 'Suggested supervision allowance.',
    },
    overhead_profit: {
      fromNotes: 'Overhead and profit allowance parsed from notes.',
      suggested: 'Suggested overhead and profit allowance.',
    },
  };
  return (
    copyByItem[itemId] ?? {
      fromNotes: 'Permit allowance parsed from notes.',
      suggested: 'Suggested permit and inspection allowance.',
    }
  );
}

/**
 * Canonical pricing resolver for the Confirm Scope UI. Resolves material and
 * labor independently with the priority notes -> template/bid -> national
 * average, and works for any trade/material/labor combination.
 */
export function resolveScopeItemSuggestedPricing(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  templateKey: string | null | undefined,
  resolved: Pick<
    ResolvedItemQuantity,
    'quantity' | 'unit' | 'quantitySource' | 'dualCount' | 'dualMaterial' | 'dualLabor' | 'dualAllowance'
  >,
  pricingContext?: ScopePricingContext | null
): ScopeItemSuggestedPricing {
  const empty: ScopeItemSuggestedPricing = { fill: null, comparison: null };
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule) return empty;
  const measurementMatch = firstMeasurementForRule(rule, measurementsInput);
  const preferredUnit =
    resolved.dualCount?.unit ||
    (resolved.unit && !['allowance', 'lump_sum'].includes(resolved.unit) ? resolved.unit : null) ||
    measurementMatch?.unit ||
    rule.defaultUnit ||
    'sqft';
  const { average: averageInitial, regional } = regionalAdjustedNationalAverage(
    itemId,
    preferredUnit,
    pricingContext
  );
  let average = averageInitial;

  let unit = average?.unit || preferredUnit;

  // Quantity in the rate unit (e.g. 850 sqft, 220 lf).
  let count =
    resolved.dualCount?.unit === unit && resolved.dualCount.quantity > 0
      ? resolved.dualCount.quantity
      : itemId === 'floor_demo' && unit === 'sqft'
        ? parseScopeMeasurementInput(measurementsInput.floorAreaSqft) ??
          firstMeasurementQuantityForRule(rule, measurementsInput)
        : resolved.quantity != null && resolved.unit === unit && resolved.quantity > 0
          ? resolved.quantity
          : measurementMatch?.unit === unit
            ? measurementMatch.quantity
            : firstMeasurementQuantityForRule(rule, measurementsInput);
  if ((!count || count <= 0) && (rule.defaultUnit === 'allowance' || rule.defaultUnit === 'lump_sum')) {
    const { average: flatAverageBase } = regionalAdjustedNationalAverage(itemId, rule.defaultUnit, pricingContext);
    const flatAverage = flatAverageBase;
    if (rule.lumpSumOnly && (flatAverage?.labor || flatAverage?.material)) {
      count = 1;
      unit = flatAverage?.unit || rule.defaultUnit;
    }
  }
  // Ground-up framing: living SF is a planning quantity for mat+labor until package takeoff exists.
  // Primary takeoff stays empty (needs_takeoff); rates come from national + builder-budget barometer.
  if (
    (!count || count <= 0) &&
    itemId === 'framing' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
    if (livingSf && livingSf > 0) {
      const reframed = regionalAdjustedNationalAverage(itemId, 'sqft', pricingContext);
      if (reframed.average?.material != null && reframed.average?.labor != null) {
        count = livingSf;
        unit = 'sqft';
        average = reframed.average;
      }
    }
  }
  // Windows/doors: prefer opening count; otherwise plan from living SF × calibrated $/SF.
  if (
    (!count || count <= 0) &&
    itemId === 'windows_doors' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
    if (livingSf && livingSf > 0) {
      const reframed = regionalAdjustedNationalAverage(itemId, 'sqft', pricingContext);
      if (reframed.average?.material != null && reframed.average?.labor != null) {
        count = livingSf;
        unit = 'sqft';
        average = reframed.average;
      }
    }
  }
  // Plumbing / electrical rough: plan from living SF when point/device counts are missing.
  if (
    (!count || count <= 0) &&
    (itemId === 'plumbing_rough' || itemId === 'electrical_rough') &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
    if (livingSf && livingSf > 0) {
      const reframed = regionalAdjustedNationalAverage(itemId, 'sqft', pricingContext);
      if (reframed.average?.material != null && reframed.average?.labor != null) {
        count = livingSf;
        unit = 'sqft';
        average = reframed.average;
      }
    }
  }
  // Excavation: plan shallow pad + footing trench CY from living SF when CY takeoff is missing.
  if (
    (!count || count <= 0) &&
    itemId === 'excavation' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
    if (livingSf && livingSf > 0) {
      // Same shallow-pad + footing-trench planning basis as Quick Measurements (~Lot 41 ~100–130 CY).
      const perimeter = 4 * Math.sqrt(livingSf);
      const trenchCy = (perimeter * 3 * 3) / 27;
      const padCutCy = (livingSf * 0.5) / 27;
      const planningCy = Math.max(1, Math.round(trenchCy + padCutCy + trenchCy * 0.1));
      const reframed = regionalAdjustedNationalAverage(itemId, 'cy', pricingContext);
      if (reframed.average?.material != null && reframed.average?.labor != null) {
        count = planningCy;
        unit = 'cy';
        average = reframed.average;
      }
    }
  }
  // HVAC: default to 1 system when included and no count/tons entered.
  if (
    (!count || count <= 0) &&
    itemId === 'hvac' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const reframed = regionalAdjustedNationalAverage(itemId, 'each', pricingContext);
    if (reframed.average?.material != null && reframed.average?.labor != null) {
      count = 1;
      unit = 'each';
      average = reframed.average;
    }
  }
  // Stucco: exterior wall SF from Quick Measurements, else planning ~1.05 × living SF.
  if (
    (!count || count <= 0) &&
    itemId === 'stucco' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const wallSf =
      parseScopeMeasurementInput(measurementsInput.exteriorPaintSqft) ||
      (() => {
        const livingSf = parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
        return livingSf && livingSf > 0 ? Math.round(livingSf * 1.05) : null;
      })();
    if (wallSf && wallSf > 0) {
      const reframed = regionalAdjustedNationalAverage(itemId, 'sqft', pricingContext);
      if (reframed.average?.material != null && reframed.average?.labor != null) {
        count = wallSf;
        unit = 'sqft';
        average = reframed.average;
      }
    }
  }
  // Cabinets: plan LF ≈ living SF / 25 until run takeoff exists (same basis as barometer).
  if (
    (!count || count <= 0) &&
    itemId === 'cabinets' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
    if (livingSf && livingSf > 0) {
      const planningLf = Math.max(1, Math.round(livingSf / 25));
      const reframed = regionalAdjustedNationalAverage(itemId, 'lf', pricingContext);
      if (reframed.average?.material != null && reframed.average?.labor != null) {
        count = planningLf;
        unit = 'lf';
        average = reframed.average;
      }
    }
  }
  // Counters: plan ~80 SF kitchen tops when countertop takeoff is missing.
  if (
    (!count || count <= 0) &&
    itemId === 'countertops' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const reframed = regionalAdjustedNationalAverage(itemId, 'sqft', pricingContext);
    if (reframed.average?.material != null && reframed.average?.labor != null) {
      count = 80;
      unit = 'sqft';
      average = reframed.average;
    }
  }
  // Tile & flooring: plan from living/floor area when finish allocation takeoff is missing.
  if (
    (!count || count <= 0) &&
    (itemId === 'tile_flooring' || itemId === 'flooring') &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const floorSf =
      parseScopeMeasurementInput(measurementsInput.flooringSqft) ||
      parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
    if (floorSf && floorSf > 0) {
      const reframed = regionalAdjustedNationalAverage(itemId, 'sqft', pricingContext);
      if (reframed.average?.material != null && reframed.average?.labor != null) {
        count = floorSf;
        unit = 'sqft';
        average = reframed.average;
      }
    }
  }
  // Insulation: plan from living SF × calibrated $/SF until envelope surface takeoff exists.
  if (
    (!count || count <= 0) &&
    itemId === 'insulation' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
    if (livingSf && livingSf > 0) {
      const reframed = regionalAdjustedNationalAverage(itemId, 'sqft', pricingContext);
      if (reframed.average?.material != null && reframed.average?.labor != null) {
        count = livingSf;
        unit = 'sqft';
        average = reframed.average;
      }
    }
  }
  if (!count || count <= 0) {
    // Measurement-semantics: missing primary takeoff must not hide read-only/planning
    // benchmark evidence (living SF × stage rate). Do not invent a national $/sqft fill.
    const benchmarkOnly = benchmarkFillWithoutPrimaryTakeoff(
      itemId,
      measurementsInput.pricingAcceptance,
      templateKey
    );
    if (benchmarkOnly) return benchmarkOnly;
    return empty;
  }

  const basis = { quantity: count, unit };
  const basisHelper = rule.lumpSumOnly
    ? 'Suggested allowance for this job'
    : `Based on ${count.toLocaleString()} ${unit}`;

  if (rule.lumpSumOnly) {
    if (hasUserEnteredFlatAllowancePricing(measurementsInput.itemQuantities || {}, itemId)) {
      return empty;
    }
    const copy = flatAllowanceCopyFor(itemId);
    const noteTotal =
      resolved.dualAllowance?.quantity ??
      (resolved.quantitySource === 'notes' &&
      (resolved.unit === 'allowance' || resolved.unit === 'lump_sum')
        ? resolved.quantity
        : null);
    if (noteTotal != null && noteTotal > 0) {
      return {
        fill: {
          material: 0,
          labor: round2(noteTotal),
          total: round2(noteTotal),
          materialSource: 'notes',
          laborSource: 'notes',
          rateSourceLabel: SCOPE_PARSED_FROM_NOTES_LABEL,
          helper: copy.fromNotes,
          mode: 'suggested_price',
          lumpSumOnly: true,
        },
        comparison: null,
      };
    }
    const { average: flatAverageBase } = regionalAdjustedNationalAverage(itemId, rule.defaultUnit, pricingContext);
    const flatAverage = flatAverageBase;
    const total = round2((flatAverage?.material ?? 0) + (flatAverage?.labor ?? 0));
    if (total <= 0) return empty;
    return {
      fill: {
        material: 0,
        labor: total,
        total,
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel: rateSourceLabelFor('national_average', 'national_average', null, regional, flatAverage),
        helper: copy.suggested,
        mode: 'suggested_price',
        lumpSumOnly: true,
        benchmarkScopeProfile: buildNationalAverageBenchmarkScopeProfile({
          itemId,
          average: flatAverage,
          quantity: 1,
          total,
          regional,
        }),
        costBuckets: buildSuggestedPricingCostBuckets({
          itemId,
          average: flatAverage,
          material: 0,
          labor: total,
          materialSource: 'national_average',
          laborSource: 'national_average',
          lumpSumOnly: true,
        }),
        pricingRecordId: `bps_national:${itemId}:${unit}`,
        productionStatus: flatAverage?.productionStatus || 'review_required',
      },
      comparison: null,
    };
  }

  const template = resolveTemplateRateForItem(itemId, unit, pricingContext);
  const materialRate = template?.materialRate ?? average?.material ?? null;
  const laborRate = template?.laborRate ?? average?.labor ?? null;
  const materialRateSource: PricingLegSource = template?.materialRate ? 'template' : 'national_average';
  const laborRateSource: PricingLegSource = template?.laborRate ? 'template' : 'national_average';
  const templateName = template?.source ?? null;

  if (!materialRate && !laborRate) return empty;

  // Notes breakdown (canonical from the resolved item).
  const noteMaterial = resolved.dualMaterial?.quantity ?? null;
  const noteLabor = resolved.dualLabor?.quantity ?? null;
  const noteTotal =
    resolved.dualAllowance?.quantity ??
    (resolved.quantitySource === 'notes' &&
    (resolved.unit === 'allowance' || resolved.unit === 'lump_sum')
      ? resolved.quantity
      : null);

  // Case A: notes priced both legs -> collapsible comparison only.
  if (noteMaterial != null && noteLabor != null) {
    const benchmarkComparison = !template
      ? benchmarkSuggestedPricingBlock(
          itemId,
          true,
          measurementsInput.pricingAcceptance,
          templateKey
        )
      : null;
    if (benchmarkComparison) {
      return { fill: null, comparison: benchmarkComparison };
    }
    if (!materialRate || !laborRate) return empty;
    const material = round2(count * materialRate);
    const labor = round2(count * laborRate);
    return {
      fill: null,
      comparison: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: materialRateSource,
        laborSource: laborRateSource,
        rateSourceLabel: rateSourceLabelFor(materialRateSource, laborRateSource, templateName, regional),
        templateName,
        helper: `${basisHelper} · suggested comparison`,
        mode: 'suggested_price',
        isComparison: true,
        basis,
        benchmarkScopeProfile: buildNationalAverageBenchmarkScopeProfile({
          itemId,
          average,
          quantity: count,
          total: round2(material + labor),
          regional,
        }),
      },
    };
  }

  // Case B: exactly one leg from notes -> fill the missing leg.
  if (noteMaterial != null && noteLabor == null) {
    if (!laborRate) return empty;
    const labor = round2(count * laborRate);
    const material = round2(noteMaterial);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'notes',
        laborSource: laborRateSource,
        rateSourceLabel: rateSourceLabelFor('notes', laborRateSource, templateName, regional),
        templateName,
        helper: `${basisHelper} · labor suggested, ${SCOPE_MATERIAL_PARSED_FROM_NOTES_LABEL.toLowerCase()}`,
        mode: 'fill_missing',
        basis,
        benchmarkScopeProfile:
          laborRateSource === 'national_average'
            ? buildNationalAverageBenchmarkScopeProfile({
                itemId,
                average,
                quantity: count,
                total: round2(material + labor),
                regional,
              })
            : undefined,
      },
      comparison: null,
    };
  }
  if (noteLabor != null && noteMaterial == null) {
    if (!materialRate) return empty;
    const material = round2(count * materialRate);
    const labor = round2(noteLabor);
    // Demo/removal notes often give one labor total — keep compact card + budget split panel.
    if (itemId === 'floor_demo' && noteTotal != null && Math.abs(noteTotal - labor) < 0.01) {
      return empty;
    }
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: materialRateSource,
        laborSource: 'notes',
        rateSourceLabel: rateSourceLabelFor(materialRateSource, 'notes', templateName, regional),
        templateName,
        helper: `${basisHelper} · material suggested, ${SCOPE_LABOR_PARSED_FROM_NOTES_LABEL.toLowerCase()}`,
        mode: 'fill_missing',
        basis,
        benchmarkScopeProfile:
          materialRateSource === 'national_average'
            ? buildNationalAverageBenchmarkScopeProfile({
                itemId,
                average,
                quantity: count,
                total: round2(material + labor),
                regional,
              })
            : undefined,
      },
      comparison: null,
    };
  }

  // Case C: lump-sum total from notes -> split via template/national ratio.
  if (noteTotal != null && noteTotal > 0) {
    if (template?.materialRate && template?.laborRate) {
      const material = round2(count * template.materialRate);
      const labor = round2(count * template.laborRate);
      return {
        fill: null,
        comparison: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'template',
          laborSource: 'template',
          rateSourceLabel: rateSourceLabelFor('template', 'template', templateName, regional),
          templateName,
          helper: `${basisHelper} · suggested comparison`,
          mode: 'suggested_price',
          isComparison: true,
          basis,
        },
      };
    }
    const benchmarkComparison = benchmarkSuggestedPricingBlock(
      itemId,
      true,
      measurementsInput.pricingAcceptance,
      templateKey
    );
    if (benchmarkComparison) {
      return { fill: null, comparison: benchmarkComparison };
    }
    if (!materialRate) return empty;
    const material = Math.min(noteTotal, round2(count * materialRate));
    const labor = round2(noteTotal - material);
    if (material <= 0 || labor <= 0) return empty;
    return {
      fill: {
        material,
        labor,
        total: round2(noteTotal),
        materialSource: materialRateSource,
        laborSource: 'notes',
        rateSourceLabel: rateSourceLabelFor(materialRateSource, materialRateSource, templateName, regional),
        templateName,
        helper: `${basisHelper} · budget split`,
        mode: 'note_total_split',
        basis,
        benchmarkScopeProfile:
          materialRateSource === 'national_average'
            ? buildNationalAverageBenchmarkScopeProfile({
                itemId,
                average,
                quantity: count,
                total: round2(noteTotal),
                regional,
              })
            : undefined,
      },
      comparison: null,
    };
  }

  // Case D: quantity only, no notes pricing -> full suggested price.
  // Prefer physical takeoff × national/template rates over living-SF stage lumps so
  // Confirm Scope can produce material+labor for project cost tracking.
  const isPhysicalTakeoffUnit = !['allowance', 'lump_sum', 'living_sqft', 'ls'].includes(
    String(unit || '').toLowerCase()
  );
  const hasPhysicalTakeoffRates = Boolean(
    isPhysicalTakeoffUnit && count > 0 && materialRate && laborRate
  );
  if (!template && !hasPhysicalTakeoffRates) {
    const benchmarkFill = benchmarkSuggestedPricingBlock(
      itemId,
      false,
      measurementsInput.pricingAcceptance,
      templateKey
    );
    if (benchmarkFill) {
      if (benchmarkFill.isComparison) {
        return { fill: null, comparison: benchmarkFill };
      }
      return { fill: benchmarkFill, comparison: null };
    }
  }
  if (!materialRate || !laborRate) return empty;
  const material = round2(count * materialRate);
  const labor = round2(count * laborRate);
  const takeoffFill: SuggestedPricingBlock = {
    material,
    labor,
    total: round2(material + labor),
    materialSource: materialRateSource,
    laborSource: laborRateSource,
    rateSourceLabel: rateSourceLabelFor(
      materialRateSource,
      laborRateSource,
      templateName,
      regional,
      average
    ),
    templateName,
    helper: `${basisHelper} · suggested pricing`,
    mode: 'suggested_price',
    basis,
    benchmarkScopeProfile:
      materialRateSource === 'national_average' || laborRateSource === 'national_average'
        ? buildNationalAverageBenchmarkScopeProfile({
            itemId,
            average,
            quantity: count,
            total: round2(material + labor),
            regional,
          })
        : undefined,
    costBuckets: buildSuggestedPricingCostBuckets({
      itemId,
      average,
      material,
      labor,
      materialSource: materialRateSource,
      laborSource: laborRateSource,
      materialRate,
      laborRate,
    }),
    pricingRecordId: `bps_national:${itemId}:${unit}`,
    productionStatus: average?.productionStatus || 'review_required',
    benchmarkLevel: 'component',
    benchmarkStageKey: benchmarkStageForScopeKey(itemId),
    benchmarkScopeKey: itemId,
    benchmarkAction: 'price_ready',
  };
  // Keep stage lump as comparison when takeoff rates win on a stage host (not included children).
  const stageComparison =
    hasPhysicalTakeoffRates && !template
      ? benchmarkSuggestedPricingBlock(
          itemId,
          true,
          measurementsInput.pricingAcceptance,
          templateKey
        )
      : null;
  return {
    fill: takeoffFill,
    comparison:
      stageComparison?.isComparison && stageComparison.benchmarkAction !== 'included_in_stage'
        ? stageComparison
        : null,
  };
}

/** Last-resort display merge: sqft × $/sqft from notes and/or baked itemQuantities subkeys. */
export function overlayDualRatePricingDisplay(
  itemId: string,
  resolved: ResolvedItemQuantity,
  measurements: NormalizedScopeMeasurements,
  notes?: string | null,
  templateKey?: string | null
): ResolvedItemQuantity {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule?.dualAllowanceField) return resolved;
  if (hasCompleteUserSelectedPricing(measurements.itemQuantities || {}, itemId)) return resolved;

  let countEntry: (NonNullable<ReturnType<typeof parseStoredItemQuantity>> & {
    quantitySource?: QuantitySource;
  }) | null =
    resolved.dualCount ??
    (resolved.quantity != null && resolved.unit === 'sqft'
      ? {
          quantity: resolved.quantity,
          unit: 'sqft' as const,
          quantitySource: resolved.quantitySource || ('inferred' as const),
        }
      : null);

  if (!countEntry && rule.measurementKey && measurements[rule.measurementKey]) {
    countEntry = {
      quantity: measurements[rule.measurementKey]!,
      unit: rule.defaultUnit,
      quantitySource: 'inferred',
    };
  }

  let materialEntry = parseStoredItemQuantity(measurements, `${itemId}__material`);
  let laborEntry = parseStoredItemQuantity(measurements, `${itemId}__labor`);
  let allowanceEntry = parseStoredItemQuantity(measurements, roughAllowanceSubKey(itemId));

  const text = String(notes || '').trim();
  if (text && countEntry) {
    const rateBreakdown = resolveItemRatePricingFromNotes(
      itemId,
      measurementsForRatePricingWithCount(measurements, itemId, countEntry),
      text,
      { templateKey: templateKey ?? undefined }
    );
    if (rateBreakdown) {
      if (rateBreakdown.material != null) {
        materialEntry = {
          quantity: rateBreakdown.material,
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
      if (rateBreakdown.labor != null) {
        laborEntry = {
          quantity: rateBreakdown.labor,
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
      allowanceEntry = {
        quantity: rateBreakdown.total,
        unit: 'allowance',
        quantitySource: 'notes',
      };
    } else {
      const parsed = parseScopeItemRatePricingFromNotes(
        text,
        measurementsForRatePricingWithCount(measurements, itemId, countEntry),
        { templateKey: templateKey ?? undefined }
      );
      const material = parsed[`${itemId}__material`];
      const labor = parsed[`${itemId}__labor`];
      const total = parsed[`${itemId}__allowance`];
      if (material?.quantity) {
        materialEntry = {
          quantity: Number(material.quantity),
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
      if (labor?.quantity) {
        laborEntry = {
          quantity: Number(labor.quantity),
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
      if (total?.quantity) {
        allowanceEntry = {
          quantity: Number(total.quantity),
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
    }
  }

  const effectiveAllowance = finalizeRateAllowanceTotal(
    allowanceEntry,
    materialEntry,
    laborEntry,
    countEntry
  );

  if (!countEntry && !effectiveAllowance) return resolved;

  const fromNotes =
    materialEntry?.quantitySource === 'notes' ||
    laborEntry?.quantitySource === 'notes' ||
    effectiveAllowance?.quantitySource === 'notes';

  return {
    ...resolved,
    quantity: countEntry?.quantity ?? effectiveAllowance!.quantity,
    unit: countEntry?.unit ?? effectiveAllowance!.unit,
    quantitySource: fromNotes ? 'notes' : resolved.quantitySource,
    sourceLabel: fromNotes ? sourceLabel('notes') : resolved.sourceLabel,
    pricingReady: true,
    showInput: true,
    dualCount: countEntry,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
    dualAllowance: effectiveAllowance,
  };
}

function resolveDualAllowanceQuantity(
  itemId: string,
  rule: ScopeItemQuantityRule,
  measurements: NormalizedScopeMeasurements,
  notes?: string | null,
  templateKey?: string | null
): ResolvedItemQuantity | null {
  const storedItemEntry = parseStoredItemQuantity(measurements, itemId);
  let countEntry =
    storedItemEntry && !['allowance', 'lump_sum'].includes(storedItemEntry.unit)
      ? storedItemEntry
      : null;
  if (!countEntry && rule.measurementKey && measurements[rule.measurementKey]) {
    countEntry = {
      quantity: measurements[rule.measurementKey]!,
      unit: rule.defaultUnit,
      quantitySource: 'inferred',
    };
  }
  if (!countEntry && itemId === 'floor_demo' && measurements.floorAreaSqft) {
    countEntry = {
      quantity: measurements.floorAreaSqft,
      unit: rule.defaultUnit,
      quantitySource: 'inferred',
    };
  }
  if (!countEntry && Array.isArray(rule.measurementKeys)) {
    const quantity = rule.measurementKeys
      .map((key) => measurements[key])
      .find((value) => value != null && value > 0);
    if (quantity) {
      countEntry = {
        quantity,
        unit: rule.defaultUnit,
        quantitySource: 'inferred',
      };
    }
  }

  const hydrated = withRatePricingHydratedFromNotes(
    measurements,
    itemId,
    notes,
    templateKey,
    countEntry
  );
  const allowanceEntry = parseStoredItemQuantity(hydrated, roughAllowanceSubKey(itemId));

  // Legacy: single field saved as allowance/lump_sum on the main key
  const legacyAllowance =
    !allowanceEntry &&
    storedItemEntry &&
    ['allowance', 'lump_sum'].includes(storedItemEntry.unit || '')
      ? storedItemEntry
      : null;

  let { effectiveAllowance, materialEntry, laborEntry } = applyRatePricingBreakdown(
    itemId,
    hydrated,
    notes,
    templateKey,
    countEntry,
    allowanceEntry,
    legacyAllowance
  );

  const forced = overlayDualRatePricingDisplay(
    itemId,
    {
      quantity: countEntry?.quantity ?? effectiveAllowance?.quantity ?? null,
      unit: countEntry?.unit ?? effectiveAllowance?.unit ?? rule.defaultUnit,
      quantitySource: 'inferred',
      sourceLabel: '',
      pricingReady: Boolean(countEntry || effectiveAllowance),
      showInput: true,
      dualCount: countEntry,
      dualMaterial: materialEntry,
      dualLabor: laborEntry,
      dualAllowance: effectiveAllowance,
    },
    hydrated,
    notes,
    templateKey
  );
  countEntry = forced.dualCount ?? countEntry;
  materialEntry = forced.dualMaterial ?? materialEntry;
  laborEntry = forced.dualLabor ?? laborEntry;
  effectiveAllowance = forced.dualAllowance ?? effectiveAllowance;

  if (!countEntry && !effectiveAllowance) return null;

  const primary = countEntry || effectiveAllowance!;
  const summaryParts: string[] = [];
  if (countEntry) {
    const unitLabel =
      itemId === 'plumbing_rough' ? 'rough-in points' : formatUnitLabel(countEntry.unit);
    summaryParts.push(`${countEntry.quantity.toLocaleString()} ${unitLabel}`);
  }
  if (materialEntry) {
    summaryParts.push(`$${materialEntry.quantity.toLocaleString()} material`);
  }
  if (laborEntry) {
    summaryParts.push(`$${laborEntry.quantity.toLocaleString()} labor`);
  }
  if (effectiveAllowance && (materialEntry || laborEntry)) {
    summaryParts.push(`$${effectiveAllowance.quantity.toLocaleString()} total`);
  } else if (effectiveAllowance) {
    summaryParts.push(`$${effectiveAllowance.quantity.toLocaleString()} allowance`);
  }

  const quantitySource: QuantitySource =
    allowanceEntry?.quantitySource === 'notes' ||
    countEntry?.quantitySource === 'notes' ||
    materialEntry?.quantitySource === 'notes' ||
    laborEntry?.quantitySource === 'notes' ||
    effectiveAllowance?.quantitySource === 'notes'
      ? 'notes'
      : 'user_entered';

  return {
    quantity: primary.quantity,
    unit: primary.unit,
    quantitySource,
    sourceLabel:
      quantitySource === 'notes' ? sourceLabel('notes') : summaryParts.join(' · '),
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
    dualCount: countEntry,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
    dualAllowance: effectiveAllowance,
  };
}

function applyPricingReadyFlags(
  resolved: ResolvedItemQuantity,
  itemId: string,
  ctx: { notes?: string | null } = {}
): ResolvedItemQuantity {
  void itemId;
  void ctx;
  return resolved;
}

function normalizedOverrideUnitForRule(
  itemId: string,
  templateKey: string | null | undefined,
  unit: string | null | undefined,
  rule: ScopeItemQuantityRule
): string {
  void itemId;
  void templateKey;
  return unit || rule.defaultUnit;
}

const AUTO_FLATWORK_SQFT_PRICING_SCOPE_KEYS = new Set([
  'concrete',
  'pour_flatwork',
  'sidewalk',
  'patio',
  'driveway',
]);

function applyAutoFlatworkSqftPricingQuantity(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  resolved: ResolvedItemQuantity
): ResolvedItemQuantity {
  if (!AUTO_FLATWORK_SQFT_PRICING_SCOPE_KEYS.has(itemId)) return resolved;
  if (!getNationalAverageBudgetSplit(itemId, 'sqft')) return resolved;

  const sqft = measurements.concreteSqft;
  if (!sqft || sqft <= 0) return resolved;

  const stored = measurements.itemQuantities[itemId];
  if (stored?.quantitySource === 'user_entered' || stored?.quantitySource === 'manual_override') {
    return resolved;
  }
  if (
    stored?.quantitySource === 'calculated_confirmed' &&
    stored.unit &&
    stored.unit !== 'sqft'
  ) {
    return resolved;
  }

  if (
    resolved.unit === 'sqft' &&
    resolved.quantity != null &&
    Math.abs(resolved.quantity - sqft) < 0.01
  ) {
    return resolved;
  }

  return {
    ...resolved,
    quantity: sqft,
    unit: 'sqft',
    quantitySource:
      stored?.quantitySource === 'calculated_confirmed' ? 'calculated_confirmed' : 'inferred',
    sourceLabel:
      resolved.quantitySource === 'notes' || stored?.quantitySource === 'notes'
        ? 'Slab area · Calculated'
        : sourceLabel('inferred'),
    dualCount: resolved.dualCount
      ? { ...resolved.dualCount, quantity: sqft, unit: 'sqft' }
      : resolved.dualCount,
  };
}

function resolveChecklistItemQuantityCore(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  ctx: { choiceId?: string | null; templateKey?: string | null; notes?: string | null } = {}
): ResolvedItemQuantity {
  const choiceId = ctx.choiceId ?? null;
  const explicitRule = getChecklistItemQuantityRule(itemId, ctx.templateKey);
  if (!explicitRule && String(itemId).startsWith('custom_')) {
    return {
      quantity: null,
      unit: 'lump_sum',
      quantitySource: 'missing',
      sourceLabel: 'Needs measurement',
      pricingReady: false,
      showInput: false,
    };
  }
  const rule = explicitRule ?? DEFAULT_SCOPE_ALLOWANCE_QUANTITY_RULE;

  if (rule.choiceIds?.length && choiceId && !rule.choiceIds.includes(choiceId)) {
    return {
      quantity: null,
      unit: rule.defaultUnit,
      quantitySource: 'not_applicable',
      sourceLabel: '',
      pricingReady: false,
      showInput: false,
    };
  }

  if (
    itemId === 'wet_area_install' &&
    choiceId &&
    ['tub', 'prefab', 'tile_pan', 'staying', 'not_in_scope', 'unsure'].includes(choiceId)
  ) {
    return {
      quantity: null,
      unit: 'each',
      quantitySource: 'not_applicable',
      sourceLabel: '',
      pricingReady: false,
      showInput: false,
    };
  }

  const linkedCountertop = resolveLinkedCountertopAllowance(itemId, measurements, ctx.notes);
  if (linkedCountertop) return linkedCountertop;

  const override = measurements.itemQuantities[itemId];
  const explicitOverride = explicitItemQuantityOverride(measurements, itemId, rule, ctx);
  if (explicitOverride) return explicitOverride;

  if (!rule.dualAllowanceField && override?.quantitySource !== 'user_entered' && ctx.notes?.trim()) {
    const parsedAllowance = parseScopeItemAllowancesFromNotes(ctx.notes, {
      templateKey: ctx.templateKey ?? undefined,
    })[itemId];
    if (parsedAllowance?.quantity && Number(parsedAllowance.quantity) > 0) {
      const includesCountertops =
        Boolean(parsedAllowance.includesCountertops) ||
        (itemId === 'cabinets' && notesHaveCombinedCabinetsCounters(ctx.notes));
      const combinedCabinetsCounters = itemId === 'cabinets' && includesCountertops;
      return {
        quantity: Number(parsedAllowance.quantity),
        unit: parsedAllowance.unit || rule.defaultUnit,
        quantitySource: 'notes',
        sourceLabel: combinedCabinetsCounters
          ? `Combined total · cabinets + counters · ${sourceLabel('notes')}`
          : sourceLabel('notes'),
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
        ...(combinedCabinetsCounters
          ? {
              combinedAllowanceRole: 'combined_total' as const,
              combinedAllowanceTotal: Number(parsedAllowance.quantity),
            }
          : {}),
      };
    }
  }
  if (rule.dualAllowanceField) {
    const dual = resolveDualAllowanceQuantity(
      itemId,
      rule,
      measurements,
      ctx.notes,
      ctx.templateKey
    );
    if (dual) return dual;
  } else if (
    override?.quantity != null &&
    override.quantity > 0 &&
    !isPlaceholderAllowancePricing(override.quantity, override.unit, itemId)
  ) {
    const includesCountertops =
      Boolean(override.includesCountertops) ||
      (itemId === 'cabinets' && notesHaveCombinedCabinetsCounters(ctx.notes));
    const baseLabel = sourceLabel(override.quantitySource || 'user_entered');
    const combinedCabinetsCounters =
      itemId === 'cabinets' && includesCountertops;
    return {
      quantity: override.quantity,
      unit: normalizedOverrideUnitForRule(itemId, ctx.templateKey, override.unit, rule),
      quantitySource: override.quantitySource || 'user_entered',
      sourceLabel: combinedCabinetsCounters
        ? `Combined total · cabinets + counters · ${baseLabel}`
        : baseLabel,
      pricingReady: true,
      quantityHelper: rule.quantityHelper,
      showInput: true,
      ...(combinedCabinetsCounters
        ? {
            combinedAllowanceRole: 'combined_total' as const,
            combinedAllowanceTotal: override.quantity,
          }
        : {}),
    };
  }

  if (rule.aggregateMeasurementKeys?.length) {
    const agg = sumMeasurementKeys(measurements, rule.aggregateMeasurementKeys);
    if (agg) {
      return {
        quantity: agg.quantity,
        unit: rule.defaultUnit,
        quantitySource: 'inferred',
        sourceLabel: aggregatedMeasurementSourceLabel(agg.parts),
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
      };
    }
  }

  for (const key of rule.measurementKeys || (rule.measurementKey ? [rule.measurementKey] : [])) {
    if (
      measurementSemanticsV1Enabled() &&
      key === 'flooringSqft' &&
      isGrossFlooringDerivedFromLiving({
        flooringSqft: Number(measurements.flooringSqft),
        floorAreaSqft: Number(measurements.floorAreaSqft),
      })
    ) {
      // Gross interior floor area copied from living SF is planning-only, not finish takeoff.
      continue;
    }
    const val = Number(measurements[key]);
    if (Number.isFinite(val) && val > 0) {
      const resolved: ResolvedItemQuantity = {
        quantity: val,
        unit: measurementUnitForKey(key, rule.defaultUnit),
        quantitySource: 'inferred',
        sourceLabel: SCOPE_PARSED_FROM_NOTES_LABEL,
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
      };
      return applyPricingReadyFlags(resolved, itemId, ctx);
    }
  }

  if (rule.defaultQuantity != null && !rule.requiresUserQuantity) {
    return {
      quantity: rule.defaultQuantity,
      unit: rule.defaultUnit,
      quantitySource: 'default_assumption',
      sourceLabel: sourceLabel('default_assumption'),
      pricingReady: true,
      quantityHelper: rule.quantityHelper,
      showInput: true,
    };
  }

  const fromNotes = resolvedQuantityFromNotes(itemId, measurements, ctx);
  if (fromNotes) return fromNotes;

  if (usesAllowanceSplitEditor(rule)) {
    const allowanceEntry =
      parseStoredItemQuantity(measurements, allowanceSplitSubKey(itemId, 'allowance')) ??
      (override &&
      ['allowance', 'lump_sum'].includes(override.unit || '') &&
      override.quantity != null &&
      override.quantity > 0 &&
      !isPlaceholderAllowancePricing(override.quantity, override.unit, itemId)
        ? {
            quantity: override.quantity,
            unit: override.unit || 'allowance',
            quantitySource: override.quantitySource,
          }
        : null);
    const materialEntry = parseStoredItemQuantity(measurements, allowanceSplitSubKey(itemId, 'material'));
    const laborEntry = parseStoredItemQuantity(measurements, allowanceSplitSubKey(itemId, 'labor'));
    const splitTotal =
      (materialEntry?.quantity ?? 0) + (laborEntry?.quantity ?? 0);
    const total = allowanceEntry?.quantity ?? (splitTotal > 0 ? splitTotal : null);
    if (total != null && total > 0) {
      return {
        quantity: total,
        unit: 'allowance',
        quantitySource:
          allowanceEntry?.quantitySource ||
          materialEntry?.quantitySource ||
          laborEntry?.quantitySource ||
          'user_entered',
        sourceLabel: sourceLabel(
          allowanceEntry?.quantitySource ||
            materialEntry?.quantitySource ||
            laborEntry?.quantitySource ||
            'user_entered'
        ),
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
      };
    }
  }

  return {
    quantity: null,
    unit: rule.defaultUnit,
    quantitySource: 'missing',
    sourceLabel: sourceLabel('missing'),
    pricingReady: false,
    quantityHelper: rule.quantityHelper,
    missingMessage: rule.missingMessage,
    showInput: true,
  };
}

export function resolveChecklistItemQuantity(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  ctx: { choiceId?: string | null; templateKey?: string | null; notes?: string | null } = {}
): ResolvedItemQuantity {
  return applyAutoFlatworkSqftPricingQuantity(
    itemId,
    measurements,
    resolveChecklistItemQuantityCore(itemId, measurements, ctx)
  );
}

/** Package name patterns → checklist quantity rule key (mirrors backend catalog).
 * Order matters: specific trade+action rows MUST win before broad word matchers,
 * or unrelated Step 3 packages inherit the wrong LF/sqft and national rates
 * (same class of bug as cabinet hardware / appliance reinstall → cabinets).
 */
const PACKAGE_NAME_TO_RULE_KEY: Array<{ test: RegExp; key: string }> = [
  { test: /\bbath(?:room)?\s+demo\b|\bdemo\b.*\bbath/i, key: 'demo' },
  // Flooring / tile demo before any install matcher (carpet alone used to → flooring $).
  {
    test: /\b(carpet|lvp|laminate|vinyl|tile|flooring|floor)\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,40}\b(carpet|lvp|laminate|vinyl|tile|flooring|floor)\b/i,
    key: 'floor_demo',
  },
  { test: /\btile\s+demo|\btile\s+removal|\btile\s+demolition/i, key: 'floor_demo' },
  { test: /\bfloor\s+demo|\bflooring\s+demo/i, key: 'floor_demo' },
  {
    test: /\b(lvp|laminate|vinyl|carpet|flooring)\b.*\b(install|installation)\b|\b(install|installation)\b.*\b(lvp|laminate|vinyl|carpet|flooring)\b/i,
    key: 'flooring',
  },
  { test: /\b(lvp|laminate|vinyl)\b|\bflooring\s+install/i, key: 'flooring' },
  { test: /\bshower\s+floor\s+tile|\btile\s+shower\s+floor/i, key: 'shower_floor_tile' },
  { test: /\bprefab\s+shower\s+pan|\bshower\s+pan\s+install/i, key: 'prefab_shower_pan' },
  { test: /\btile\s+shower\s+pan|\bmud\s+pan/i, key: 'shower_pan' },
  { test: /\bshower\s+pan|\btile\s+pan/i, key: 'shower_pan' },
  // Tub demo before tub install (bare "bathtub" used to → tub_install).
  {
    test: /\b(tub|bathtub)\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,40}\b(tub|bathtub)\b/i,
    key: 'tub_demo',
  },
  { test: /\btub\s+install|\btub\s+installation|\b(?:new\s+)?bathtub\s+install/i, key: 'tub_install' },
  { test: /\bshower\s+niche\b/i, key: 'shower_niche' },
  { test: /\bshower\s+bench\b|\bshower\s+curb\b/i, key: 'shower_bench_curb' },
  // HVAC ventilation before bath exhaust fan.
  {
    test: /\b(hvac|furnace|duct|mechanical)\b[^.]{0,40}\bventilation\b|\bventilation\b[^.]{0,40}\b(hvac|duct|mechanical)\b/i,
    key: 'ventilation',
  },
  { test: /\bexhaust\s+fan\b|\bbath(?:room)?\s+fan\b|\bbath(?:room)?\s+ventilation\b/i, key: 'exhaust_fan' },
  { test: /\bmirror\b|\btowel\s+bar\b|\bbath(?:room)?\s+accessories\b/i, key: 'mirror_accessories' },
  // Roof underlayment before floor_prep (shared "underlayment" word).
  {
    test: /\b(roof|shingle|ice\s*(?:&|and)\s*water|felt|synthetic)\b[^.]{0,40}\bunderlayment\b|\bunderlayment\b[^.]{0,40}\b(roof|shingle|ice\s*(?:&|and)\s*water)\b|\bice\s*(?:&|and)\s*water\b/i,
    key: 'underlayment',
  },
  { test: /\bfloor\s+prep\b|\bsubfloor\b|\bfloor\s+underlayment\b/i, key: 'floor_prep' },
  { test: /\bback\s*splash/i, key: 'backsplash' },
  // Specific kitchen lines must win before the broad cabinet matcher —
  // otherwise "Cabinet hardware" and scope text like "after cabinets" steal
  // cabinet LF + national cabinet rates ($150+$75).
  { test: /\bcabinet\s*hardware\b|\bhardware\b.*\b(?:pulls?|knobs?)\b|\bpulls?\s*(?:&|and|,)?\s*knobs?\b/i, key: 'cabinet_hardware' },
  { test: /\bappliance\s*removal\b|\bremove\s+(?:existing\s+)?appliances?\b/i, key: 'appliance_removal' },
  {
    test: /\bappliance\s*reinstall\b|\breinstall\b.*\bappliances?\b|\bappliances?\s*(?:&|and)?\s*hookup\b|\bappliance\s+hookup\b|\bappliances?\b/i,
    key: 'appliances',
  },
  {
    test: /\bcabinet[s\s&/,]*counter.*\bdemo\b|\bdemo\b.*\bcabinets?\b|\bkitchen\s+demo\b/i,
    key: 'demo',
  },
  // Cabinet paint before cabinets LF rates.
  {
    test: /\b(?:paint|painting|stain|refinish)\b[^.]{0,40}\bcabinets?\b|\bcabinets?\b[^.]{0,40}\b(?:paint|painting|stain|refinish)\b/i,
    key: 'trim_paint',
  },
  { test: /\bkitchen\s+island\b|\bisland\b.*\bcabinet|\bcabinet\b.*\bisland\b/i, key: 'island' },
  { test: /\bcabinets?\s*(?:&|and|\/)\s*counters?|\bcounters?\s*(?:&|and|\/)\s*cabinets?/i, key: 'cabinets_counters' },
  // Real cabinet install only — not "after cabinets" incidental mentions in other scopes.
  { test: /(?<!after\s)(?<!before\s)\b(?:new\s+)?cabinets?\b(?!\s*hardware)/i, key: 'cabinets' },
  // Countertop demo before countertop install rates.
  {
    test: /\bcountertops?\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out)\b[^.]{0,40}\bcountertops?\b/i,
    key: 'demo',
  },
  { test: /\bcountertop/i, key: 'countertops' },
  // Sink/faucet before cleanup (bare "disposal" used to → cleanup $).
  {
    test: /\bsink\b|\bfaucet\b|\bgarbage\s+disposal\b|\bdisposals?\b.*\b(sink|faucet|garbage)\b|\bsink[,\s]+faucet/i,
    key: 'sink_faucet',
  },
  { test: /\bplans?\s*(?:&|and|\/|,)?\s*engineering|\bengineering\s*(?:&|and|\/|,)?\s*plans?/i, key: 'plans_engineering' },
  { test: /\bcontingenc/i, key: 'contingency' },
  { test: /\bfinal\s+inspection/i, key: 'final_inspections' },
  { test: /\bmobiliz|\bjob\s+setup/i, key: 'mobilization' },
  { test: /\bemergency\s*(?:fee|call|service)|\bafter[\s-]?hours\s+fee/i, key: 'emergency_fee' },
  { test: /\bsurvey\b/i, key: 'survey' },
  { test: /\bgeneral\s+conditions/i, key: 'general_conditions' },
  { test: /\bsupervision|\bsuperintend/i, key: 'supervision' },
  { test: /\boverhead\s*(?:&|and|\/)?\s*profit|\bprofit\s*(?:&|and|\/)?\s*overhead/i, key: 'overhead_profit' },
  { test: /\brock|\bmulch|\bgravel/i, key: 'rock_mulch' },
  { test: /\bsod|\bturf/i, key: 'sod_turf' },
  { test: /\bpaver/i, key: 'pavers' },
  {
    test: /\b(flatwork|slab\s+pour|concrete\s+patio|patio\s+concrete|driveway|sidewalk)\b/i,
    key: 'pour_flatwork',
  },
  { test: /\bfootings?\b|\bpiers?\b|\bfoundation\s+pour\b/i, key: 'pour_foundation' },
  // Concrete demo/removal before concrete install rates.
  {
    test: /\bconcrete\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|break[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|break[\s-]?out)\b[^.]{0,40}\bconcrete\b/i,
    key: 'demo_removal',
  },
  { test: /\bconcrete\b/i, key: 'concrete' },
  { test: /\butility\s+trench|\btrench(?:ing)?\b/i, key: 'utility_trenching' },
  { test: /\bgrading\b/i, key: 'grading' },
  { test: /\bsite\s*(?:prep|work)\b/i, key: 'sitework' },
  { test: /\bexcavat/i, key: 'excavation' },
  { test: /\brail(?:ing)?\b|\bguardrail\b/i, key: 'railing' },
  { test: /\bshower\s+wall\s+tile\b|\bshower\b[^.]{0,30}\bwall\b[^.]{0,20}\btile\b|\btile\b[^.]{0,30}\bshower\s+wall\b/i, key: 'shower_tile' },
  { test: /\bwaterproof|\bbacker\s+board/i, key: 'waterproofing' },
  { test: /\bfloor\s+tile\b|\btile\s+floor\b|\bfloor\b[^.]{0,20}\btile\b|\btile\b[^.]{0,20}\bfloor\b/i, key: 'floor_tile' },
  { test: /\bvanity\b/i, key: 'vanity' },
  { test: /\btoilet\b/i, key: 'toilet' },
  // Framing hardware before framing $/sqft.
  {
    test: /\b(framing|structural|connector|fastener|hurricane|simpson)\b[^.]{0,40}\bhardware\b|\bhardware\b[^.]{0,40}\b(connector|framing|structural|fastener)\b/i,
    key: 'hardware',
  },
  { test: /\bframing\b(?!\s*hardware)|\bshell\b/i, key: 'framing' },
  { test: /\bhvac\b|\bheat(?:ing)?\s*(?:&|and)?\s*air|\bfurnace|\bmini[\s-]?split/i, key: 'hvac' },
  { test: /\binsulat/i, key: 'insulation' },
  // Deck demo / stain / roof decking before deck surface install.
  {
    test: /\b(deck|patio)\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out)\b[^.]{0,40}\b(deck|patio)\b/i,
    key: 'demo_removal',
  },
  {
    test: /\b(roof|shingle)\b[^.]{0,40}\bdeck(?:ing)?\b|\bdeck(?:ing)?\b[^.]{0,40}\b(repair|replace|sheath|sheathing)\b/i,
    key: 'decking_repair',
  },
  {
    test: /\bstain\b[^.]{0,40}\bdeck\b|\bseal\b[^.]{0,40}\bdeck\b|\bdeck\b[^.]{0,40}\b(stain|seal|finish)\b/i,
    key: 'staining_sealing',
  },
  {
    test: /\bdeck(?:ing)?\b[^.]{0,40}\b(install|surface|boards?|composite|wood)\b|\b(?:install|build|replace)\b[^.]{0,40}\bdeck(?:ing)?\b/i,
    key: 'decking',
  },
  { test: /\btear[\s-]?off\b|\bremove\b[^.]{0,30}\bshingles?\b/i, key: 'tear_off' },
  { test: /\broof(?:ing)?\s*(?:\/\s*)?tie[\s-]?in\b|\btie[\s-]?in\b[^.]{0,30}\broof\b/i, key: 'roof_tie_in' },
  {
    test: /\bshingles?\b[^.]{0,40}\b(install|installation|replace)\b|\broof(?:ing)?\b[^.]{0,40}\b(install|installation|replace)\b|\bshingle\b|\broof(?:ing)?\b/i,
    key: 'shingles_roofing',
  },
  // Shower/glass door BEFORE bare window/door (was stealing glass_door → windows_doors).
  { test: /\bshower\s+door\b|\bglass\s+(?:shower\s+)?door\b|\bshower\s+enclosure\b|\bglass\s+door\b/i, key: 'glass_door' },
  { test: /\b(?:interior|exterior|entry|patio|sliding|french)\s+doors?\b|\bwindows?\b|\bdoor\b/i, key: 'windows_doors' },
  { test: /\bplant|\btree\b|\bshrub/i, key: 'plants_trees' },
  { test: /\bfoundation\b/i, key: 'pour_foundation' },
  { test: /\btile\s+flooring\b|\bflooring\s+tile\b/i, key: 'floor_tile' },
  { test: /\bplumb.*\brough|\brough[\s-]?in\b.*\bplumb/i, key: 'plumbing_rough' },
  { test: /\belectrical\b(?!.*trim)|\bnew\s+circuits\b/i, key: 'electrical_rough' },
  { test: /\blight(?:ing)?\s+fix|\bfixture.*\blight/i, key: 'lighting' },
  // Drywall hang/finish/patch before bare drywall/patch.
  { test: /\bhang\b[^.]{0,30}\bdrywall\b|\bdrywall\b[^.]{0,30}\bhang\b/i, key: 'hang' },
  { test: /\b(tape|mud|finish)\b[^.]{0,30}\bdrywall\b|\bdrywall\b[^.]{0,30}\b(tape|mud|finish)\b/i, key: 'finish_tape' },
  { test: /\bpatch\b[^.]{0,30}\b(drywall|sheetrock|gypsum)\b|\b(drywall|sheetrock)\b[^.]{0,30}\bpatch\b/i, key: 'patch_repair' },
  { test: /\bdrywall\b/i, key: 'drywall' },
  // Exterior/interior must win over the generic paint key so Confirm Scope rates
  // for interior paint are not copied onto an "add exterior painting" package.
  { test: /\bexterior[\s-]*(?:paint|painting)\b|\b(?:paint|painting)[\s-]*exterior\b|\b(siding|stucco|soffit|fascia)\b[^.]{0,30}\b(?:paint|painting)\b/i, key: 'exterior_paint' },
  { test: /\binterior[\s-]*(?:paint|painting)\b|\b(?:paint|painting)[\s-]*interior\b|\bceiling\b[^.]{0,20}\b(?:paint|painting)\b/i, key: 'interior_paint' },
  {
    test: /\btrim\b[^.]{0,30}\b(?:paint|painting)\b|\b(?:paint|painting)\b[^.]{0,30}\btrim\b|\bdoors?\b[^.]{0,20}\b(?:paint|painting)\b/i,
    key: 'trim_paint',
  },
  { test: /\bpaint|\bpainting/i, key: 'paint' },
  { test: /\bbaseboard|\btrim\s+install|\btrim\s+&\s+baseboard|\binterior\s+trim\b/i, key: 'trim' },
  { test: /\bplumb.*\btrim|\bplumbing\s+trim|\bfinal\s+plumb|\bfixture\s+hookup\b/i, key: 'plumbing_trim' },
  { test: /\bplumbing\s+connections?\b/i, key: 'plumbing' },
  { test: /\belectrical\s+trim|\bdevices.*\bplates/i, key: 'electrical_trim' },
  { test: /\bpermit|\binspection/i, key: 'permits' },
  // Cleanup: drop bare "disposal" (conflicts with garbage disposal).
  { test: /\bcleanup\b|\bhaul[\s-]?off\b|\bdumpster\b|\bfinal\s+clean\b|\bjob\s+cleanup\b/i, key: 'cleanup' },
  { test: /\bplumb(?!.*trim)/i, key: 'plumbing_rough' },
];

export function lookupRuleKeyForPackage(name: string, scope = ''): string | null {
  const nameStr = String(name || '');
  const fullBlob = `${nameStr} ${scope || ''}`;
  for (const row of PACKAGE_NAME_TO_RULE_KEY) {
    if (row.test.test(nameStr)) return row.key;
  }
  for (const row of PACKAGE_NAME_TO_RULE_KEY) {
    if (row.test.test(fullBlob)) return row.key;
  }
  return null;
}

/** Checklist keys that may hold pricing for a package name (primary + concrete aliases). */
export function ruleKeysToTryForPackage(name: string, scope = ''): string[] {
  const primary = lookupRuleKeyForPackage(name, scope);
  const keys: string[] = primary ? [primary] : [];
  const blob = `${name || ''} ${scope || ''}`.toLowerCase();
  const concreteFamily =
    /\bconcrete\b/.test(blob) ||
    primary === 'concrete' ||
    primary === 'pour_flatwork' ||
    primary === 'pour_foundation' ||
    primary === 'foundation';
  if (concreteFamily) {
    for (const alias of ['foundation', 'concrete', 'pour_flatwork', 'pour_foundation'] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  const roofingFamily =
    /\broof|\bshingle/.test(blob) ||
    primary === 'roofing' ||
    primary === 'shingles_roofing' ||
    primary === 'roof_tie_in';
  if (roofingFamily) {
    for (const alias of ['roofing', 'shingles_roofing', 'roof_tie_in'] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  // Interior / generic paint share Confirm Scope keys; exterior must stay isolated.
  if (primary === 'interior_paint' || primary === 'paint' || primary === 'paint_trim') {
    for (const alias of ['paint_trim', 'interior_paint', 'paint'] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  return keys;
}

/** Planning qty when measurements/notes are missing — enables saved template $/sqft on demo/install rows. */
export function inferPlanningQuantityForPackage(
  packageName: string,
  scopeText: string,
  draft?: { projectType?: string; estimateTier?: string; originalNotes?: string } | null
): { quantity: number; unit: string } | null {
  const tier = String(draft?.estimateTier || '').toLowerCase();
  const pt = String(draft?.projectType || '').toLowerCase();
  const notes = String(draft?.originalNotes || '');
  const isRemodel =
    tier === 'room_remodel' ||
    tier === 'addition' ||
    tier === 'ground_up' ||
    ['bathroom', 'bath', 'kitchen', 'flooring'].includes(pt) ||
    /\b(bath(?:room)?\s+remodel|kitchen\s+remodel|floor\s+job|floor\s+remodel)\b/i.test(notes);
  if (!isRemodel) return null;

  const blob = `${packageName} ${scopeText}`.toLowerCase();
  if (/shower/.test(blob) && /tile/.test(blob) && !/\b(demo|removal)\b/.test(blob)) {
    return { quantity: 90, unit: 'sqft' };
  }
  if ((/floor/.test(blob) && /tile/.test(blob)) || /\btile\s+demo\b/.test(blob)) {
    return { quantity: 45, unit: 'sqft' };
  }
  if (/tile/.test(blob) && /\binstall/.test(blob) && !/\b(demo|removal)\b/.test(blob)) {
    return { quantity: /\bshower\b/.test(blob) || /\bshower\b/.test(notes.toLowerCase()) ? 90 : 45, unit: 'sqft' };
  }
  if (/\b(demo|removal|tear[\s-]?out)\b/.test(blob) && /\btile\b/.test(blob)) {
    return { quantity: 45, unit: 'sqft' };
  }
  if (/\b(paint|painting)\b/.test(blob) && !/\b(floor|tile|exterior)\b/.test(blob)) {
    return { quantity: 175, unit: 'sqft' };
  }
  return null;
}

export function checklistItemInScope(item: {
  inputType?: string;
  state?: string;
  choiceId?: string | null;
  choiceIds?: string[];
}): boolean {
  if (item.inputType === 'multi_choice') {
    const ids = item.choiceIds ?? [];
    if (!ids.length || ids.includes('not_in_scope') || ids.includes('unsure')) return false;
    if (ids.includes('no_changes') && !ids.some((id) => id === 'remove' || id === 'add')) return false;
    return ids.some((id) => id === 'remove' || id === 'add');
  }
  if (item.inputType === 'choice') {
    return Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');
  }
  return item.state === 'included';
}

export function countScopePricingReadiness(
  items: Array<{ id: string; inputType?: string; state?: string; choiceId?: string | null }>,
  measurements: NormalizedScopeMeasurements,
  templateKey?: string | null,
  notes?: string | null
): { ready: number; needsMeasurement: number } {
  let ready = 0;
  let needsMeasurement = 0;
  for (const item of items) {
    if (!checklistItemInScope(item)) continue;
    if (String(item.id || '').startsWith('custom_')) {
      const base = measurements.itemQuantities?.[item.id];
      const allowance = measurements.itemQuantities?.[`${item.id}__allowance`];
      const material = measurements.itemQuantities?.[`${item.id}__material`];
      const labor = measurements.itemQuantities?.[`${item.id}__labor`];
      const total =
        Number(allowance?.quantity || 0) ||
        (base?.unit === 'allowance' ? Number(base.quantity || 0) : 0) ||
        Number(material?.quantity || 0) + Number(labor?.quantity || 0);
      if (Number.isFinite(total) && total > 0) ready += 1;
      else needsMeasurement += 1;
      continue;
    }
    const rule = getChecklistItemQuantityRuleOrDefault(item.id, templateKey);
    const resolved = resolveChecklistItemQuantity(item.id, measurements, {
      choiceId: item.choiceId,
      templateKey,
      notes,
    });
    if (!resolved.showInput && !resolved.pricingReady) continue;
    // Already has Confirm Scope material/labor or allowance — not "ready for suggested pricing".
    const mat = Number(resolved.dualMaterial?.quantity || 0);
    const lab = Number(resolved.dualLabor?.quantity || 0);
    const allowance = Number(resolved.dualAllowance?.quantity || 0);
    const alreadyPriced =
      (mat > 0 && lab > 0) ||
      allowance > 0 ||
      (resolved.unit === 'allowance' && Number(resolved.quantity || 0) > 0);
    if (alreadyPriced) continue;
    if (resolved.pricingReady) ready += 1;
    else needsMeasurement += 1;
  }
  return { ready, needsMeasurement };
}

function countPackageScopeReadiness(draft: EstimateAiDraft): { ready: number; needsMeasurement: number } {
  let ready = 0;
  let needsMeasurement = 0;
  const packages = draft.scopePackages?.length
    ? draft.scopePackages
    : (draft.rooms || []).map((room) => ({
        name: room.name,
        scope: room.scope,
        scopeQuantities: room.scopeQuantities,
        price: room.price,
        knownSubtotal: room.knownSubtotal,
        materialPrice: room.materialPrice,
        laborPrice: room.laborPrice,
        priceSource: room.priceProvidedByUser ? 'user_provided' : undefined,
        splitIsSuggested: room.splitIsSuggested,
        budgetSplitBasis: undefined,
      }));
  for (const pkg of packages) {
    const q = pkg.scopeQuantities?.[0];
    // Skip packages that already have a price or Confirm Scope budget split.
    const packageAmount = Number(pkg.price ?? pkg.knownSubtotal ?? 0);
    const mat = Number(pkg.materialPrice ?? 0);
    const lab = Number(pkg.laborPrice ?? 0);
    const alreadyPriced = packageAmount > 0 || (mat > 0 && lab > 0 && mat + lab > 0);
    if (alreadyPriced) continue;
    if (q && q.quantity > 0) ready += 1;
    else needsMeasurement += 1;
  }
  return { ready, needsMeasurement };
}

export function countDraftPricingReadiness(draft: EstimateAiDraft | null | undefined): {
  ready: number;
  needsMeasurement: number;
} {
  if (!draft) return { ready: 0, needsMeasurement: 0 };
  const items = draft.confirmedAssumptions || draft.scopeChecklist?.items || [];
  const norm = normalizeScopeMeasurements(draft.scopeMeasurements);
  const fromChecklist = countScopePricingReadiness(
    items,
    norm,
    draft.scopeChecklist?.templateKey,
    draft.originalNotes
  );
  const fromPackages = countPackageScopeReadiness(draft);
  return {
    ready: Math.max(fromChecklist.ready, fromPackages.ready),
    needsMeasurement:
      fromPackages.ready > fromChecklist.ready
        ? fromPackages.needsMeasurement
        : fromChecklist.needsMeasurement,
  };
}

export function buildNormalizedScopeMeasurementsFromInput(
  input: ScopeMeasurementsInputExtended | null | undefined,
  options?: { notes?: string | null; templateKey?: string | null }
): NormalizedScopeMeasurements {
  const safeInput: ScopeMeasurementsInputExtended = {
    ...emptyQuickMeasurementInput(),
    ...(input || {}),
    itemQuantities: input?.itemQuantities || {},
  };
  let extended = syncItemQuantitiesToMeasurementFields(safeInput);
  const notes = String(options?.notes || '').trim();
  if (notes) {
    extended = reparseRatePricingIntoItemQuantities(extended, notes, options?.templateKey);
  }
  return normalizeScopeMeasurements(scopeMeasurementsToPayload(extended));
}

/** Persist scope measurements with rate-pricing subkeys baked from notes when available. */
export function scopeMeasurementsPayloadForPersist(
  input: ScopeMeasurementsInputExtended | null | undefined,
  options?: { notes?: string | null; templateKey?: string | null }
): ScopeMeasurements {
  const safeInput: ScopeMeasurementsInputExtended = {
    ...emptyQuickMeasurementInput(),
    ...(input || {}),
    itemQuantities: input?.itemQuantities || {},
  };
  let extended = syncItemQuantitiesToMeasurementFields(safeInput);
  const notes = String(options?.notes || '').trim();
  if (notes) {
    extended = reparseRatePricingIntoItemQuantities(extended, notes, options?.templateKey);
  }
  return scopeMeasurementsToPayload(extended);
}

export function scopeMeasurementsToPayload(
  input: ScopeMeasurementsInputExtended
): ScopeMeasurements {
  const sanitized = sanitizeMistakenUnitRateAllowances(input);
  const itemQuantities: Record<string, ScopeItemQuantityValue> = {};
  for (const [id, raw] of Object.entries(sanitized.itemQuantities || {})) {
    const q = parseScopeMeasurementInput(raw.quantity);
    if (q) {
      itemQuantities[id] = {
        quantity: q,
        unit: raw.unit,
        quantitySource: raw.quantitySource,
        ...(raw.includesCountertops ? { includesCountertops: true } : {}),
      };
    }
  }
  const payload: ScopeMeasurements = {
    bathroomFloorSqft: parseScopeMeasurementInput(sanitized.bathroomFloorSqft),
    kitchenFloorSqft: parseScopeMeasurementInput(sanitized.kitchenFloorSqft),
    floorAreaSqft: parseScopeMeasurementInput(sanitized.floorAreaSqft),
    flooringSqft: parseScopeMeasurementInput(sanitized.flooringSqft),
    backsplashSqft: parseScopeMeasurementInput(sanitized.backsplashSqft),
    countertopSqft: parseScopeMeasurementInput(sanitized.countertopSqft),
    cabinetLf: parseScopeMeasurementInput(sanitized.cabinetLf),
    landscapeSqft: parseScopeMeasurementInput(sanitized.landscapeSqft),
    sodSqft: parseScopeMeasurementInput(sanitized.sodSqft),
    paverSqft: parseScopeMeasurementInput(sanitized.paverSqft),
    rockMulchSqft: parseScopeMeasurementInput(sanitized.rockMulchSqft),
    landscapeTons: parseScopeMeasurementInput(sanitized.landscapeTons),
    roofSquares: parseScopeMeasurementInput(sanitized.roofSquares),
    drywallSqft: parseScopeMeasurementInput(sanitized.drywallSqft),
    concreteSqft: parseScopeMeasurementInput(sanitized.concreteSqft),
    concreteCy: parseScopeMeasurementInput(sanitized.concreteCy),
    excavationCy: parseScopeMeasurementInput(sanitized.excavationCy),
    deckSqft: parseScopeMeasurementInput(sanitized.deckSqft),
    garageSqft: parseScopeMeasurementInput(sanitized.garageSqft),
    exteriorPaintSqft: parseScopeMeasurementInput(sanitized.exteriorPaintSqft),
    railingLf: parseScopeMeasurementInput(sanitized.railingLf),
    planRooms: Array.isArray(sanitized.planRooms) ? sanitized.planRooms : undefined,
    wetAreaFinish:
      sanitized.wetAreaFinish === 'tile' ||
      sanitized.wetAreaFinish === 'tub' ||
      sanitized.wetAreaFinish === 'prefab'
        ? sanitized.wetAreaFinish
        : null,
    bathCount:
      sanitized.bathCount != null && Number(sanitized.bathCount) > 0
        ? Math.round(Number(sanitized.bathCount))
        : null,
    prefabBathCount:
      sanitized.prefabBathCount != null && Number(sanitized.prefabBathCount) > 0
        ? Math.round(Number(sanitized.prefabBathCount))
        : null,
    tubBathCount:
      sanitized.tubBathCount != null && Number(sanitized.tubBathCount) > 0
        ? Math.round(Number(sanitized.tubBathCount))
        : null,
    baseboardLf: parseScopeMeasurementInput(sanitized.baseboardLf),
    showerWallTileSqft: parseScopeMeasurementInput(sanitized.showerWallTileSqft),
    showerFloorTileSqft: parseScopeMeasurementInput(sanitized.showerFloorTileSqft),
    wallPaintSqft: parseScopeMeasurementInput(sanitized.wallPaintSqft),
    sqft: parseScopeMeasurementInput(sanitized.bathroomFloorSqft),
    lf: parseScopeMeasurementInput(sanitized.baseboardLf),
    itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : undefined,
    pricingAcceptance:
      input.pricingAcceptance && Object.keys(input.pricingAcceptance).length
        ? input.pricingAcceptance
        : undefined,
    scopeGapResolutions:
      input.scopeGapResolutions && Object.keys(input.scopeGapResolutions).length
        ? input.scopeGapResolutions
        : undefined,
    quickMeasurementSources:
      input.quickMeasurementSources && Object.keys(input.quickMeasurementSources).length
        ? input.quickMeasurementSources
        : undefined,
    quickMeasurementUserOverrides:
      input.quickMeasurementUserOverrides && Object.keys(input.quickMeasurementUserOverrides).length
        ? input.quickMeasurementUserOverrides
        : undefined,
    planFacts: input.planFacts,
    quickMeasurementSuggestionMetadata:
      input.quickMeasurementSuggestionMetadata &&
      Object.keys(input.quickMeasurementSuggestionMetadata).length
        ? input.quickMeasurementSuggestionMetadata
        : undefined,
    quickMeasurementFieldConfidence:
      input.quickMeasurementFieldConfidence &&
      Object.keys(input.quickMeasurementFieldConfidence).length
        ? input.quickMeasurementFieldConfidence
        : undefined,
    areaReconciliation: input.areaReconciliation,
  };
  return payload;
}

function measurementFieldString(value: unknown): string {
  const n = parseScopeMeasurementInput(String(value ?? ''));
  return n != null && n > 0 ? String(n) : '';
}

/** Round-trip persisted payload back into Confirm Scope form state. */
export function scopeMeasurementsInputFromPayload(
  payload: ScopeMeasurements
): ScopeMeasurementsInputExtended {
  const base = emptyQuickMeasurementInput();
  const itemQuantities: ScopeMeasurementsInputExtended['itemQuantities'] = {};
  for (const [id, val] of Object.entries(payload.itemQuantities || {})) {
    if (!val?.quantity) continue;
    itemQuantities[id] = {
      quantity: String(val.quantity),
      unit: val.unit || 'sqft',
      quantitySource: val.quantitySource,
      ...(val.includesCountertops ? { includesCountertops: true } : {}),
    };
  }
  return {
    ...base,
    bathroomFloorSqft: measurementFieldString(payload.bathroomFloorSqft ?? payload.sqft),
    kitchenFloorSqft: measurementFieldString(payload.kitchenFloorSqft),
    floorAreaSqft: measurementFieldString(payload.floorAreaSqft),
    flooringSqft: measurementFieldString(payload.flooringSqft),
    backsplashSqft: measurementFieldString(payload.backsplashSqft),
    countertopSqft: measurementFieldString(payload.countertopSqft),
    cabinetLf: measurementFieldString(payload.cabinetLf),
    landscapeSqft: measurementFieldString(payload.landscapeSqft),
    sodSqft: measurementFieldString(payload.sodSqft),
    paverSqft: measurementFieldString(payload.paverSqft),
    rockMulchSqft: measurementFieldString(payload.rockMulchSqft),
    landscapeTons: measurementFieldString(payload.landscapeTons),
    roofSquares: measurementFieldString(payload.roofSquares),
    drywallSqft: measurementFieldString(payload.drywallSqft),
    concreteSqft: measurementFieldString(payload.concreteSqft),
    concreteCy: measurementFieldString(payload.concreteCy),
    excavationCy: measurementFieldString(payload.excavationCy),
    deckSqft: measurementFieldString(payload.deckSqft),
    garageSqft: measurementFieldString(payload.garageSqft),
    exteriorPaintSqft: measurementFieldString(payload.exteriorPaintSqft),
    railingLf: measurementFieldString(payload.railingLf),
    baseboardLf: measurementFieldString(payload.baseboardLf),
    showerWallTileSqft: measurementFieldString(payload.showerWallTileSqft),
    showerFloorTileSqft: measurementFieldString(payload.showerFloorTileSqft),
    wallPaintSqft: measurementFieldString(payload.wallPaintSqft),
    planRooms: Array.isArray(payload.planRooms) ? payload.planRooms : undefined,
    wetAreaFinish:
      payload.wetAreaFinish === 'tile' ||
      payload.wetAreaFinish === 'tub' ||
      payload.wetAreaFinish === 'prefab'
        ? payload.wetAreaFinish
        : null,
    bathCount:
      payload.bathCount != null && Number(payload.bathCount) > 0
        ? Math.round(Number(payload.bathCount))
        : null,
    prefabBathCount:
      payload.prefabBathCount != null && Number(payload.prefabBathCount) > 0
        ? Math.round(Number(payload.prefabBathCount))
        : null,
    tubBathCount:
      payload.tubBathCount != null && Number(payload.tubBathCount) > 0
        ? Math.round(Number(payload.tubBathCount))
        : null,
    itemQuantities,
    pricingAcceptance: payload.pricingAcceptance,
    scopeGapResolutions: payload.scopeGapResolutions,
    quickMeasurementSources: payload.quickMeasurementSources,
    quickMeasurementUserOverrides: payload.quickMeasurementUserOverrides,
    planFacts: payload.planFacts,
    quickMeasurementSuggestionMetadata: payload.quickMeasurementSuggestionMetadata,
    quickMeasurementFieldConfidence: payload.quickMeasurementFieldConfidence,
    areaReconciliation: payload.areaReconciliation,
  };
}

/** Sync sqft fields, sanitize mistaken rates, and bake sqft × $/sqft totals for the form. */
export function prepareScopeMeasurementsInputForUi(
  input: ScopeMeasurementsInputExtended,
  options?: { notes?: string | null; templateKey?: string | null }
): ScopeMeasurementsInputExtended {
  const notes = String(options?.notes || '').trim();
  const payload = scopeMeasurementsPayloadForPersist(input, options);
  if (!notes) return scopeMeasurementsInputFromPayload(payload);

  const parsed = parseScopeMeasurementsFromNotes(notes, {
    templateKey: options?.templateKey ?? undefined,
  });
  const itemQuantities = { ...(parsed.itemQuantities || {}) };
  for (const [id, val] of Object.entries(payload.itemQuantities || {})) {
    if (!itemQuantities[id] || val.quantitySource === 'user_entered') {
      itemQuantities[id] = val;
    }
  }
  clearStalePricingWhenNotesUnpriced(itemQuantities, notes, parsed.itemQuantities);

  // Notes fill gaps only — never wipe plan/user quick-measurement fields already on payload.
  const mergedFields: ScopeMeasurements = { ...parsed, ...payload, itemQuantities };
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'itemQuantities' || key === 'planRooms' || key === 'pricingAcceptance') continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      (mergedFields as Record<string, unknown>)[key] = n;
    }
  }
  if (Array.isArray(payload.planRooms) && payload.planRooms.length) {
    mergedFields.planRooms = payload.planRooms;
  }

  const reparsed = reparseRatePricingIntoItemQuantities(
    scopeMeasurementsInputFromPayload(mergedFields),
    notes,
    options?.templateKey
  );

  return reparsed;
}

export type ScopeMeasurementsInputExtended = ReturnType<typeof emptyQuickMeasurementInput> & {
  itemQuantities: Record<
    string,
    {
      quantity: string;
      unit: string;
      quantitySource?: QuantitySource;
      includesCountertops?: boolean;
      measurementState?: import('@/utils/measurementSemantics').ScopeMeasurementState | null;
    }
  >;
  pricingAcceptance?: Record<string, import('@/utils/estimateAiDraft').ScopePricingAcceptanceMetadata>;
  scopeGapResolutions?: Record<string, import('@/utils/scopeReviewUi').ScopeGapResolutionRecord>;
  planRooms?: import('@/utils/estimateAiDraft').PlanRoomMeasurement[];
  wetAreaFinish?: import('@/utils/planBathRooms').WetAreaFinishChoice | null;
  bathCount?: number | null;
  prefabBathCount?: number | null;
  tubBathCount?: number | null;
  areaReconciliation?: import('@/utils/measurementSemantics').AreaReconciliation | null;
  pricingOverrideLog?: import('@/utils/measurementSemantics').PricingOverrideLog[];
  /** Applied stage/component benchmark keys — blocks double application. */
  appliedBenchmarkKeys?: string[];
  quickMeasurementSources?: import('@/utils/quickMeasurementProvenance').QuickMeasurementSourceMap;
  quickMeasurementUserOverrides?: import('@/utils/quickMeasurementProvenance').QuickMeasurementOverrideMap;
  planFacts?: import('@/utils/planMeasurementFacts').PlanFacts;
  quickMeasurementSuggestionMetadata?: Partial<
    Record<string, import('@/utils/planMeasurementFacts').MeasurementSuggestion>
  >;
  quickMeasurementFieldConfidence?: Record<string, number>;
};

export function initialScopeMeasurementInputExtended(
  draft: {
    scopeMeasurements?: ScopeMeasurements | null;
    originalNotes?: string | null;
    scopeChecklist?: { templateKey?: string; suggestedMeasurements?: ScopeMeasurements | null } | null;
    projectType?: string | null;
  } | null,
  notesOverride?: string | null
): ScopeMeasurementsInputExtended {
  const saved = draft?.scopeMeasurements;
  const suggested = draft?.scopeChecklist?.suggestedMeasurements;
  const scopeNotes = String(
    notesOverride || resolveDraftScopeNotes(draft as Parameters<typeof resolveDraftScopeNotes>[0]) || ''
  ).trim();
  const parsedFromNotes = scopeNotes
    ? parseScopeMeasurementsFromNotes(scopeNotes, {
        templateKey: draft?.scopeChecklist?.templateKey,
        projectType: draft?.projectType ?? undefined,
      })
    : {};
  // Fresh notes parse wins over stale suggestedMeasurements persisted on older drafts
  const parsed = {
    ...suggested,
    ...parsedFromNotes,
    itemQuantities: {
      ...(suggested?.itemQuantities || {}),
      ...(parsedFromNotes.itemQuantities || {}),
    },
  };

  const itemQuantities: ScopeMeasurementsInputExtended['itemQuantities'] = {};
  const putItemQuantity = (
    id: string,
    val: { quantity: number | string | null; unit: string; quantitySource?: QuantitySource; includesCountertops?: boolean }
  ) => {
    if (val.quantity == null || Number(val.quantity) <= 0 || !val.unit) return;
    const includesCountertops = val.includesCountertops;
    if (id.endsWith('__allowance')) {
      itemQuantities[id] = {
        quantity: String(val.quantity),
        unit: val.unit || 'lump_sum',
        quantitySource: val.quantitySource,
      };
      return;
    }
    if (isDualAllowanceItem(id) && (val.unit === 'allowance' || val.unit === 'lump_sum')) {
      itemQuantities[roughAllowanceSubKey(id)] = {
        quantity: String(val.quantity),
        unit: val.unit || 'lump_sum',
        quantitySource: val.quantitySource,
      };
      return;
    }
    itemQuantities[id] = {
      quantity: String(val.quantity),
      unit: val.unit,
      quantitySource: val.quantitySource,
      ...(includesCountertops ? { includesCountertops: true } : {}),
    };
  };

  const isPricingSubKey = (id: string) => /__(?:material|labor|allowance)$/.test(id);
  const hasCompleteUserSelectedSplit = (itemId: string) =>
    hasCompleteUserSelectedPricing(saved?.itemQuantities || {}, itemId);

  for (const [id, val] of Object.entries(saved?.itemQuantities || {})) {
    if (!val.quantity) continue;
    // Reparse stale/incomplete rate splits from notes. Preserve only complete pricing selected by the user.
    if (isPricingSubKey(id) && !hasCompleteUserSelectedSplit(ratePricingItemIdFromKey(id) || id)) continue;
    putItemQuantity(id, {
      quantity: val.quantity,
      unit: val.unit,
      quantitySource: val.quantitySource,
      includesCountertops: (val as ScopeItemQuantityValue).includesCountertops,
    });
  }

  const mergeParsedItemQuantities = (
    source: Record<string, ScopeItemQuantityValue> | undefined
  ) => {
    for (const [id, val] of Object.entries(source || {})) {
      if (id === 'demo' && parsedFromNotes.itemQuantities?.floor_demo && !parsedFromNotes.itemQuantities?.demo) {
        continue;
      }
      const existing = itemQuantities[id];
      const notesQty = String(val.quantity);
      if (existing?.quantity && existing.quantitySource === 'user_entered') {
        const itemId = ratePricingItemIdFromKey(id) || id;
        if (isPricingSubKey(id) && hasCompleteUserSelectedSplit(itemId)) {
          continue;
        }
        if (existing.quantity === notesQty) {
          putItemQuantity(id, {
            quantity: val.quantity,
            unit: val.unit,
            quantitySource: 'notes',
            includesCountertops: (val as { includesCountertops?: boolean }).includesCountertops,
          });
        }
        continue;
      }
      putItemQuantity(id, {
        quantity: val.quantity,
        unit: val.unit,
        quantitySource: val.quantitySource || 'notes',
        includesCountertops: (val as { includesCountertops?: boolean }).includesCountertops,
      });
    }
  };

  // Backend suggestedMeasurements first, then fresh notes parse — current notes win over stale server/saved totals.
  mergeParsedItemQuantities(suggested?.itemQuantities as Record<string, ScopeItemQuantityValue>);
  mergeParsedItemQuantities(parsedFromNotes.itemQuantities as Record<string, ScopeItemQuantityValue>);
  clearStalePricingWhenNotesUnpriced(itemQuantities, scopeNotes, parsedFromNotes.itemQuantities);

  const cabinetsEntry = itemQuantities.cabinets;
  if (cabinetsEntry) {
    const combinedFlag =
      parsedFromNotes.itemQuantities?.cabinets?.includesCountertops ||
      suggested?.itemQuantities?.cabinets?.includesCountertops ||
      notesHaveCombinedCabinetsCounters(scopeNotes);
    if (combinedFlag) {
      itemQuantities.cabinets = { ...cabinetsEntry, includesCountertops: true };
    }
  }

  const pick = (key: QuickMeasurementFieldKey) => {
    const parsedNoteValueRaw = parsedFromNotes[key as keyof typeof parsedFromNotes];
    const parsedNoteValue =
      typeof parsedNoteValueRaw === 'number' || typeof parsedNoteValueRaw === 'string'
        ? parsedNoteValueRaw
        : undefined;
    const fromNotes =
      parsedNoteValue ??
      suggested?.[key as keyof ScopeMeasurements];
    const s = saved?.[key as keyof ScopeMeasurements];
    const backsplashFromNotes = parsedFromNotes.backsplashSqft;

    // Explicit note values beat stale draft fields when regenerating from edited notes.
    // When notes omit a field (common for plan takeoff), fall through to saved plan import.
    if (parsedNoteValue != null && Number(parsedNoteValue) > 0) {
      return String(parsedNoteValue);
    }

    // Paint sqft often stale at 45 when it duplicated backsplash on older drafts / parsers
    if (key === 'wallPaintSqft' && fromNotes != null && Number(fromNotes) > 0) {
      const savedNum = s != null ? Number(s) : null;
      const leaked =
        savedNum != null &&
        backsplashFromNotes != null &&
        savedNum === Number(backsplashFromNotes) &&
        Number(fromNotes) !== savedNum;
      if (leaked || savedNum == null || savedNum <= 0) {
        return String(fromNotes);
      }
    }

    if (s != null && Number(s) > 0) return String(s);
    if (fromNotes != null && Number(fromNotes) > 0) return String(fromNotes);
    return '';
  };

  const hasBaseboardNotes = /\b(baseboards?|trim|crown|moulding|molding|casing)\b/i.test(scopeNotes);
  const pickBaseboardLf = () => {
    if (!hasBaseboardNotes) return '';
    const fromNotes =
      parsedFromNotes.baseboardLf ??
      suggested?.baseboardLf;
    if (fromNotes != null && Number(fromNotes) > 0) return String(fromNotes);
    return pick('baseboardLf') || (saved?.lf ? String(saved.lf) : parsed.lf ? String(parsed.lf) : '');
  };

  const base = emptyQuickMeasurementInput();
  let result: ScopeMeasurementsInputExtended = {
    ...base,
    bathroomFloorSqft:
      pick('bathroomFloorSqft') ||
      (saved?.sqft ? String(saved.sqft) : parsed.sqft ? String(parsed.sqft) : ''),
    kitchenFloorSqft: pick('kitchenFloorSqft'),
    floorAreaSqft: pick('floorAreaSqft'),
    flooringSqft: pick('flooringSqft'),
    backsplashSqft: pick('backsplashSqft'),
    countertopSqft: pick('countertopSqft'),
    cabinetLf: pick('cabinetLf'),
    landscapeSqft: pick('landscapeSqft'),
    sodSqft: pick('sodSqft'),
    paverSqft: pick('paverSqft'),
    rockMulchSqft: pick('rockMulchSqft'),
    landscapeTons: pick('landscapeTons'),
    roofSquares: pick('roofSquares'),
    drywallSqft: pick('drywallSqft'),
    concreteSqft: pick('concreteSqft'),
    concreteCy: pick('concreteCy'),
    excavationCy: pick('excavationCy'),
    deckSqft: pick('deckSqft'),
    garageSqft: pick('garageSqft'),
    exteriorPaintSqft: pick('exteriorPaintSqft'),
    railingLf: pick('railingLf'),
    baseboardLf: pickBaseboardLf(),
    showerWallTileSqft: pick('showerWallTileSqft'),
    showerFloorTileSqft: pick('showerFloorTileSqft'),
    wallPaintSqft: pick('wallPaintSqft'),
    itemQuantities,
    pricingAcceptance: saved?.pricingAcceptance,
    scopeGapResolutions: saved?.scopeGapResolutions,
    planRooms: saved?.planRooms?.length ? saved.planRooms : suggested?.planRooms,
    wetAreaFinish: saved?.wetAreaFinish ?? suggested?.wetAreaFinish ?? null,
    bathCount: saved?.bathCount ?? suggested?.bathCount ?? null,
    prefabBathCount: saved?.prefabBathCount ?? suggested?.prefabBathCount ?? null,
    tubBathCount: saved?.tubBathCount ?? suggested?.tubBathCount ?? null,
    planFacts: saved?.planFacts || suggested?.planFacts,
    quickMeasurementSources: saved?.quickMeasurementSources,
    quickMeasurementUserOverrides: saved?.quickMeasurementUserOverrides,
    quickMeasurementSuggestionMetadata: saved?.quickMeasurementSuggestionMetadata,
    quickMeasurementFieldConfidence: saved?.quickMeasurementFieldConfidence,
    areaReconciliation: saved?.areaReconciliation,
  };

  // Living SF must not masquerade as paint when notes never priced paint.
  const livingN = parseScopeMeasurementInput(result.floorAreaSqft);
  const paintN = parseScopeMeasurementInput(result.wallPaintSqft);
  if (
    livingN &&
    paintN &&
    livingN === paintN &&
    !/\bpaint(?:ing)?\b/i.test(scopeNotes)
  ) {
    result.wallPaintSqft = '';
  }

  result = syncDualAllowanceSqftFields(result);
  result = sanitizeMistakenUnitRateAllowances(result);
  result = reparseRatePricingIntoItemQuantities(
    result,
    scopeNotes,
    draft?.scopeChecklist?.templateKey
  );

  if (result.itemQuantities.cabinets) {
    const combinedFlag =
      parsedFromNotes.itemQuantities?.cabinets?.includesCountertops ||
      suggested?.itemQuantities?.cabinets?.includesCountertops ||
      notesHaveCombinedCabinetsCounters(scopeNotes) ||
      Boolean(result.itemQuantities.cabinets.includesCountertops);
    if (combinedFlag) {
      result.itemQuantities.cabinets = {
        ...result.itemQuantities.cabinets,
        includesCountertops: true,
      };
    }
  }

  return result;
}
