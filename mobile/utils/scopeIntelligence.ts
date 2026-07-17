import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import {
  evaluateAssemblyForScope,
  evaluateProjectScopeGaps,
  type AssemblyEvaluationResult,
  type ScopeDependencyNotice,
  type ScopeGapNotice,
  type ScopeInclusionMetadata,
  type ScopeOverlapNotice,
} from '@/utils/scopeAssemblyRegistry';
import {
  evaluatePricingCompleteness,
  type PricingCompletenessResult,
  type ProjectLocation,
  type RateMetadata,
} from '@/utils/scopePricingIntelligence';
import {
  calculateFormulaForScope,
  getMissingFormulaInputs,
  type FormulaCalculationResult,
} from '@/utils/scopeFormulaRegistry';
import {
  formatUnitLabel,
  getChecklistItemQuantityRule,
  getNationalAverageBudgetSplit,
  type NormalizedScopeMeasurements,
  type QuantitySource,
  type ResolvedItemQuantity,
  type ScopeItemQuantityRule,
  type SuggestedPricingBlock,
} from '@/utils/scopeItemQuantities';
import {
  benchmarkScopeDefinitionQuality,
  buildConciseBenchmarkScopeWarning,
  NATIONAL_AVERAGE_BASE_SCOPE_NOTE,
  canonicalBenchmarkScopeKey,
  HIGH_IMPACT_FALLBACK_SCOPE_KEYS,
  type BenchmarkScopeAssumptionProfile,
} from '@/utils/benchmarkScopeAssumptions';
import {
  countUnresolvedScopeGaps,
  getReviewableScopeComponents,
  type ScopeGapResolutionsMap,
} from '@/utils/scopeReviewUi';

export type IntelligenceQuantitySource =
  | 'from_notes'
  | 'from_plans'
  | 'user_entered'
  | 'saved_template'
  | 'calculated_confirmed'
  | 'calculated_assumption'
  | 'benchmark_estimate'
  | 'manual_override'
  | 'missing';

export type IntelligenceConfidence = 'high' | 'medium' | 'low' | 'missing';
export type IntelligenceSeverity = 'info' | 'review' | 'warning' | 'blocking';
export type MeasurementRelationshipType = 'direct' | 'derived' | 'incompatible' | 'unknown';
export type UnitValidationStatus = 'valid' | 'review' | 'invalid' | 'unknown';
export type UnitCode =
  | 'sqft'
  | 'lf'
  | 'cy'
  | 'cf'
  | 'squares'
  | 'acre'
  | 'each'
  | 'pair'
  | 'set'
  | 'sheet'
  | 'board_foot'
  | 'ton'
  | 'lb'
  | 'gallon'
  | 'hr'
  | 'day'
  | 'load'
  | 'dumpster'
  | 'room'
  | 'fixture'
  | 'allowance'
  | 'lump_sum'
  | 'percentage'
  | string;
export type MeasurementType =
  | 'building_floor_area'
  | 'conditioned_floor_area'
  | 'room_floor_area'
  | 'flooring_area'
  | 'wall_surface_area'
  | 'ceiling_surface_area'
  | 'paintable_surface_area'
  | 'exterior_wall_area'
  | 'roof_area'
  | 'site_area'
  | 'grading_area'
  | 'demolition_area'
  | 'linear_length'
  | 'perimeter'
  | 'trench_length'
  | 'trench_width'
  | 'trench_depth'
  | 'excavation_volume'
  | 'concrete_volume'
  | 'slab_area'
  | 'slab_thickness'
  | 'footing_length'
  | 'footing_width'
  | 'footing_depth'
  | 'wall_height'
  | 'partition_length'
  | 'cabinet_length'
  | 'countertop_area'
  | 'door_count'
  | 'window_count'
  | 'opening_count'
  | 'rough_in_count'
  | 'circuit_device_count'
  | 'system_count'
  | 'envelope_area'
  | 'appliance_count'
  | 'fixture_count'
  | 'equipment_duration'
  | 'disposal_loads'
  | 'allowance_amount'
  | 'percentage'
  | string;
export type PricingSourceKind =
  | 'project_quote'
  | 'user_entered'
  | 'saved_rate'
  | 'company_rate'
  | 'local_average'
  | 'national_average'
  | 'allowance'
  | 'manual_pricing_required'
  | 'parsed_from_notes'
  | 'unknown';

export type ScopeUnitDefinition = {
  scopeKey: string;
  trade: string;
  preferredUnits: UnitCode[];
  alternateUnits: UnitCode[];
  prohibitedUnits: UnitCode[];
  requiredMeasurementInputs: string[];
  directMeasurementTypes: MeasurementType[];
  derivedMeasurementTypes: MeasurementType[];
  requiredMeasurementTypes: MeasurementType[];
  optionalMeasurementTypes: MeasurementType[];
  allowInheritedQuantity: boolean;
  allowDerivedQuantity: boolean;
  allowManualOverride: boolean;
  allowLumpSum: boolean;
  allowAllowance: boolean;
  normallyAllowance: boolean;
  mayBeLumpSum: boolean;
  incompatibleUnitSeverity: IntelligenceSeverity;
};

export type ScopeIntelligenceIssue = {
  ruleKey: string;
  severity: IntelligenceSeverity;
  title?: string;
  message: string;
  recommendedResolution?: string;
  pricingMayContinue: boolean;
  missingMeasurementTypes?: MeasurementType[];
  relatedMeasurementType?: MeasurementType;
  relatedUnit?: UnitCode;
};

export type MeasurementRequirement = {
  type: MeasurementType;
  label: string;
  optional?: boolean;
};

export type ScopeValidationNotice = ScopeIntelligenceIssue;

export type ScopeQuantityIntelligence = {
  value: number | null;
  unit: string;
  source: IntelligenceQuantitySource;
  sourceLabel: string;
  confidence: IntelligenceConfidence;
  confidenceLabel: string;
  reason: string;
  missingInputs: string[];
};

export type ScopePricingIntelligence = {
  source: PricingSourceKind;
  confidence: IntelligenceConfidence;
  confidenceLabel: string;
  reason: string;
};

export type OverlapRisk = {
  hasOverlapRisk: boolean;
  relatedScopeKeys: string[];
  reason?: string;
  title?: string;
};

export type CardIntelligenceDisplay = {
  confidence: IntelligenceConfidence;
  confidenceLabel: string;
  sourceLabel: string;
  conciseBenchmarkWarning: string | null;
  duplicatePricingMessage: string | null;
  duplicatePricingTitle: string | null;
  otherNotice: string | null;
  confidenceReasons: string[];
  showQuantityConfidenceLine: boolean;
};

export type ScopeItemIntelligence = {
  scopeItemKey: string;
  unitDefinition: ScopeUnitDefinition;
  unitValidation: {
    status: UnitValidationStatus;
    currentUnit?: UnitCode;
    preferredUnits: UnitCode[];
    alternateUnits: UnitCode[];
  };
  measurementRelationship: {
    type: MeasurementRelationshipType;
    sourceMeasurementType?: MeasurementType;
    targetMeasurementType?: MeasurementType;
    formulaKey?: string;
  };
  missingMeasurements: MeasurementRequirement[];
  validationNotices: ScopeValidationNotice[];
  formula?: FormulaCalculationResult | null;
  formulaComparison?: {
    currentValue: number;
    currentUnit: string;
    calculatedValue: number;
    calculatedUnit: string;
    variancePercent: number;
  } | null;
  assembly?: AssemblyEvaluationResult | null;
  scopeGaps: ScopeGapNotice[];
  overlaps: ScopeOverlapNotice[];
  dependencies: ScopeDependencyNotice[];
  canContinue: boolean;
  quantity: ScopeQuantityIntelligence;
  pricing: ScopePricingIntelligence;
  benchmarkScopeProfile?: BenchmarkScopeAssumptionProfile | null;
  overlapRisk: OverlapRisk;
  confidenceReasons: string[];
  pricingCompleteness?: PricingCompletenessResult | null;
  reviewableAssumptionCount: number;
  unresolvedAssumptionCount: number;
  validation: {
    status: 'ready' | 'review_required' | 'measurement_needed' | 'blocked';
    issues: ScopeIntelligenceIssue[];
  };
};

type ScopeGapResolutionsLike = Record<string, { status?: string }>;

const CONFIDENCE_LABELS: Record<IntelligenceConfidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  missing: 'Measurement needed',
};

const MEASUREMENT_LABELS: Record<string, string> = {
  building_floor_area: 'building floor area',
  conditioned_floor_area: 'conditioned floor area',
  room_floor_area: 'room floor area',
  flooring_area: 'flooring area',
  wall_surface_area: 'wall surface area',
  ceiling_surface_area: 'ceiling area',
  paintable_surface_area: 'paintable wall/ceiling area',
  exterior_wall_area: 'exterior wall area',
  roof_area: 'roof area',
  site_area: 'site area',
  grading_area: 'grading area',
  demolition_area: 'demolition area',
  linear_length: 'linear feet',
  perimeter: 'perimeter',
  trench_length: 'trench length',
  trench_width: 'trench width',
  trench_depth: 'trench depth',
  excavation_volume: 'excavation CY',
  concrete_volume: 'concrete CY',
  slab_area: 'slab area',
  slab_thickness: 'slab thickness',
  footing_length: 'footing length',
  footing_width: 'footing width',
  footing_depth: 'footing depth',
  wall_height: 'wall height',
  partition_length: 'partition length',
  cabinet_length: 'cabinet LF',
  countertop_area: 'countertop area',
  door_count: 'door count',
  window_count: 'window count',
  opening_count: 'window/door opening count',
  rough_in_count: 'plumbing rough-in points',
  circuit_device_count: 'circuit/device count',
  system_count: 'HVAC system count',
  envelope_area: 'envelope surface area',
  appliance_count: 'appliance count',
  fixture_count: 'fixture count',
  equipment_duration: 'equipment duration',
  disposal_loads: 'disposal loads',
  allowance_amount: 'allowance',
  percentage: 'percentage',
};

const MEASUREMENT_FIELD_TYPES: Record<string, MeasurementType[]> = {
  bathroomFloorSqft: ['room_floor_area', 'flooring_area'],
  kitchenFloorSqft: ['room_floor_area', 'flooring_area'],
  floorAreaSqft: ['building_floor_area', 'conditioned_floor_area', 'room_floor_area', 'flooring_area'],
  flooringSqft: ['flooring_area', 'room_floor_area'],
  backsplashSqft: ['wall_surface_area'],
  countertopSqft: ['countertop_area'],
  cabinetLf: ['cabinet_length', 'linear_length'],
  landscapeSqft: ['site_area', 'grading_area'],
  sodSqft: ['site_area'],
  paverSqft: ['site_area', 'slab_area'],
  rockMulchSqft: ['site_area'],
  landscapeTons: ['ton'],
  roofSquares: ['roof_area'],
  drywallSqft: ['wall_surface_area', 'ceiling_surface_area'],
  concreteSqft: ['slab_area'],
  concreteCy: ['concrete_volume'],
  excavationCy: ['excavation_volume'],
  deckSqft: ['room_floor_area', 'slab_area'],
  garageSqft: ['building_floor_area', 'room_floor_area'],
  exteriorPaintSqft: ['exterior_wall_area', 'paintable_surface_area'],
  railingLf: ['linear_length'],
  baseboardLf: ['perimeter', 'linear_length'],
  showerWallTileSqft: ['wall_surface_area'],
  showerFloorTileSqft: ['flooring_area'],
  wallPaintSqft: ['paintable_surface_area', 'wall_surface_area', 'ceiling_surface_area'],
};

type ScopeRegistryEntry = {
  trade: string;
  preferredUnits?: UnitCode[];
  alternateUnits?: UnitCode[];
  prohibitedUnits?: UnitCode[];
  directMeasurementTypes?: MeasurementType[];
  derivedMeasurementTypes?: MeasurementType[];
  requiredMeasurementTypes?: MeasurementType[];
  optionalMeasurementTypes?: MeasurementType[];
  allowLumpSum?: boolean;
  allowAllowance?: boolean;
  allowManualQuantity?: boolean;
  incompatibleUnitSeverity?: IntelligenceSeverity;
};

const ENTRY = (
  trade: string,
  preferredUnits: UnitCode[],
  directMeasurementTypes: MeasurementType[] = [],
  derivedMeasurementTypes: MeasurementType[] = [],
  options: Partial<ScopeRegistryEntry> = {}
): ScopeRegistryEntry => ({
  trade,
  preferredUnits,
  directMeasurementTypes,
  derivedMeasurementTypes,
  requiredMeasurementTypes: directMeasurementTypes,
  allowLumpSum: true,
  allowAllowance: true,
  allowManualQuantity: true,
  incompatibleUnitSeverity: 'warning',
  ...options,
});

const FLAT_ALLOWANCE = (trade: string): ScopeRegistryEntry =>
  ENTRY(trade, ['allowance'], ['allowance_amount'], [], {
    alternateUnits: ['lump_sum', 'percentage'],
    requiredMeasurementTypes: ['allowance_amount'],
    incompatibleUnitSeverity: 'review',
  });

const EACH_SCOPE = (trade: string): ScopeRegistryEntry =>
  ENTRY(trade, ['each'], ['fixture_count'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
    requiredMeasurementTypes: ['fixture_count'],
  });

const AREA_TO_SURFACE_DERIVED: MeasurementType[] = [
  'building_floor_area',
  'conditioned_floor_area',
  'room_floor_area',
  'flooring_area',
  'wall_height',
  'partition_length',
];

const SCOPE_UNIT_REGISTRY: Record<string, ScopeRegistryEntry> = {
  // Preconstruction and project-level items
  plans_engineering: FLAT_ALLOWANCE('preconstruction'),
  permits: FLAT_ALLOWANCE('preconstruction'),
  utility_coordination: ENTRY('preconstruction', ['lf'], ['linear_length'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
    requiredMeasurementTypes: ['linear_length'],
  }),
  survey: FLAT_ALLOWANCE('preconstruction'),
  general_conditions: FLAT_ALLOWANCE('general_conditions'),
  mobilization: FLAT_ALLOWANCE('general_conditions'),
  supervision: FLAT_ALLOWANCE('general_conditions'),
  overhead_profit: FLAT_ALLOWANCE('markup'),
  contingency: FLAT_ALLOWANCE('allowance'),

  // Sitework
  sitework: ENTRY('sitework', ['sqft'], ['site_area'], ['allowance_amount'], {
    alternateUnits: ['acre', 'cy', 'allowance', 'lump_sum'],
    requiredMeasurementTypes: ['site_area'],
  }),
  demo: ENTRY('demolition', ['sqft'], ['demolition_area', 'room_floor_area'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  floor_demo: ENTRY('demolition', ['sqft'], ['flooring_area', 'room_floor_area'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  wall_demo: ENTRY('demolition', ['sqft'], ['wall_surface_area'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  appliance_removal: EACH_SCOPE('demolition'),
  excavation: ENTRY('sitework', ['cy'], ['excavation_volume'], ['trench_length', 'trench_width', 'trench_depth', 'site_area'], {
    alternateUnits: ['sqft', 'lf', 'allowance', 'lump_sum'],
    requiredMeasurementTypes: ['excavation_volume'],
  }),
  grading: ENTRY('sitework', ['sqft'], ['grading_area', 'site_area'], ['excavation_volume'], {
    alternateUnits: ['acre', 'cy', 'allowance', 'lump_sum'],
    requiredMeasurementTypes: ['grading_area'],
  }),
  utility_trenching: ENTRY('sitework', ['lf'], ['trench_length', 'linear_length'], ['trench_width', 'trench_depth', 'excavation_volume'], {
    alternateUnits: ['cy', 'allowance', 'lump_sum'],
    prohibitedUnits: ['sqft'],
    requiredMeasurementTypes: ['trench_length'],
  }),
  backfill: ENTRY('sitework', ['cy'], ['excavation_volume'], ['trench_length', 'trench_width', 'trench_depth'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  compaction: ENTRY('sitework', ['sqft'], ['site_area', 'grading_area'], ['allowance_amount'], {
    alternateUnits: ['cy', 'allowance', 'lump_sum'],
  }),
  haul_off: FLAT_ALLOWANCE('disposal'),
  cleanup: FLAT_ALLOWANCE('disposal'),

  // Concrete and masonry
  foundation: ENTRY('concrete', ['sqft'], ['slab_area'], ['concrete_volume', 'slab_thickness', 'footing_length'], {
    alternateUnits: ['cy', 'allowance', 'lump_sum'],
  }),
  concrete: ENTRY('concrete', ['cy'], ['concrete_volume'], ['slab_area', 'slab_thickness', 'footing_length', 'footing_width', 'footing_depth'], {
    alternateUnits: ['sqft', 'allowance', 'lump_sum'],
    requiredMeasurementTypes: ['concrete_volume'],
  }),
  pour_flatwork: ENTRY('concrete', ['sqft'], ['slab_area'], ['slab_thickness', 'concrete_volume'], {
    alternateUnits: ['cy', 'allowance', 'lump_sum'],
    requiredMeasurementTypes: ['slab_area'],
  }),
  sidewalk: ENTRY('concrete', ['sqft'], ['slab_area'], ['slab_thickness', 'concrete_volume'], {
    alternateUnits: ['cy', 'lf', 'allowance', 'lump_sum'],
  }),
  patio: ENTRY('concrete', ['sqft'], ['slab_area'], ['slab_thickness', 'concrete_volume'], {
    alternateUnits: ['cy', 'allowance', 'lump_sum'],
  }),
  driveway: ENTRY('concrete', ['sqft'], ['slab_area'], ['slab_thickness', 'concrete_volume'], {
    alternateUnits: ['cy', 'allowance', 'lump_sum'],
  }),
  masonry_wall: ENTRY('masonry', ['sqft'], ['wall_surface_area'], ['linear_length', 'wall_height'], {
    alternateUnits: ['each', 'allowance', 'lump_sum'],
  }),
  block: ENTRY('masonry', ['each'], ['fixture_count'], ['wall_surface_area'], {
    alternateUnits: ['sqft', 'allowance', 'lump_sum'],
  }),
  retaining_wall: ENTRY('masonry', ['sqft'], ['wall_surface_area'], ['linear_length', 'wall_height'], {
    alternateUnits: ['lf', 'allowance', 'lump_sum'],
  }),

  // Shell
  framing: ENTRY('framing', ['sqft'], ['building_floor_area', 'room_floor_area'], ['linear_length'], {
    alternateUnits: ['lf', 'each', 'board_foot', 'allowance', 'lump_sum'],
  }),
  roof_tie_in: ENTRY('roofing', ['sqft'], ['roof_area'], ['building_floor_area'], {
    alternateUnits: ['squares', 'allowance', 'lump_sum'],
    requiredMeasurementTypes: ['roof_area'],
  }),
  shingles_roofing: ENTRY('roofing', ['squares'], ['roof_area'], ['building_floor_area'], {
    alternateUnits: ['sqft', 'lump_sum'],
    requiredMeasurementTypes: ['roof_area'],
  }),
  tear_off: ENTRY('roofing', ['squares'], ['roof_area'], ['building_floor_area'], {
    alternateUnits: ['sqft', 'lump_sum'],
  }),
  exterior_finishes: ENTRY('exterior', ['sqft'], ['exterior_wall_area'], ['building_floor_area', 'wall_height', 'perimeter'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  windows_doors: ENTRY('openings', ['each'], ['opening_count'], ['window_count', 'door_count', 'allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum', 'sqft'],
    requiredMeasurementTypes: ['opening_count'],
  }),
  windows: ENTRY('openings', ['each'], ['window_count', 'opening_count'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
    requiredMeasurementTypes: ['window_count'],
  }),
  doors: ENTRY('openings', ['each'], ['door_count', 'opening_count'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
    requiredMeasurementTypes: ['door_count'],
  }),

  // Interiors
  insulation: ENTRY(
    'insulation',
    ['sqft'],
    ['envelope_area', 'exterior_wall_area', 'ceiling_surface_area'],
    ['exterior_wall_area', 'building_floor_area', 'conditioned_floor_area'],
    {
      alternateUnits: ['allowance', 'lump_sum'],
      requiredMeasurementTypes: ['envelope_area'],
    }
  ),
  drywall: ENTRY('drywall', ['sqft'], ['wall_surface_area', 'ceiling_surface_area'], AREA_TO_SURFACE_DERIVED, {
    alternateUnits: ['allowance', 'lump_sum'],
    requiredMeasurementTypes: ['wall_surface_area'],
  }),
  hang: ENTRY('drywall', ['sqft'], ['wall_surface_area', 'ceiling_surface_area'], AREA_TO_SURFACE_DERIVED, {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  finish_tape: ENTRY('drywall', ['sqft'], ['wall_surface_area', 'ceiling_surface_area'], AREA_TO_SURFACE_DERIVED, {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  patch_repair: ENTRY('drywall', ['sqft'], ['wall_surface_area'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  paint: ENTRY('painting', ['sqft'], ['paintable_surface_area', 'wall_surface_area', 'ceiling_surface_area'], AREA_TO_SURFACE_DERIVED, {
    alternateUnits: ['room', 'allowance', 'lump_sum'],
    requiredMeasurementTypes: ['paintable_surface_area'],
  }),
  interior_paint: ENTRY('painting', ['sqft'], ['paintable_surface_area'], AREA_TO_SURFACE_DERIVED, {
    alternateUnits: ['room', 'allowance', 'lump_sum'],
  }),
  exterior_paint: ENTRY('painting', ['sqft'], ['exterior_wall_area', 'paintable_surface_area'], ['perimeter', 'wall_height'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  flooring: ENTRY('flooring', ['sqft'], ['flooring_area', 'room_floor_area'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  floor_tile: ENTRY('tile', ['sqft'], ['flooring_area', 'room_floor_area'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  shower_tile: ENTRY('tile', ['sqft'], ['wall_surface_area'], ['fixture_count'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  shower_floor_tile: ENTRY('tile', ['sqft'], ['flooring_area'], ['fixture_count'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  backsplash: ENTRY('tile', ['sqft'], ['wall_surface_area'], ['countertop_area'], {
    alternateUnits: ['lf', 'allowance'],
  }),
  trim: ENTRY('finish_carpentry', ['lf'], ['linear_length', 'perimeter'], ['room_floor_area'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  interior_trim: ENTRY('finish_carpentry', ['lf'], ['linear_length', 'perimeter'], ['room_floor_area'], {
    alternateUnits: ['sqft', 'allowance', 'lump_sum'],
  }),
  baseboard: ENTRY('finish_carpentry', ['lf'], ['linear_length', 'perimeter'], ['room_floor_area'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  cabinets: ENTRY('cabinets', ['lf'], ['cabinet_length'], ['room_floor_area'], {
    alternateUnits: ['each', 'allowance', 'lump_sum'],
    requiredMeasurementTypes: ['cabinet_length'],
  }),
  cabinets_counters: FLAT_ALLOWANCE('cabinets'),
  countertops: ENTRY('countertops', ['sqft'], ['countertop_area'], ['cabinet_length'], {
    alternateUnits: ['lf', 'allowance', 'lump_sum'],
    requiredMeasurementTypes: ['countertop_area'],
  }),

  // MEP
  plumbing_rough: ENTRY('plumbing', ['each'], ['rough_in_count'], ['building_floor_area', 'fixture_count'], {
    alternateUnits: ['allowance', 'lump_sum'],
    requiredMeasurementTypes: ['rough_in_count'],
  }),
  plumbing_trim: FLAT_ALLOWANCE('plumbing'),
  sink_faucet: EACH_SCOPE('plumbing'),
  toilet: EACH_SCOPE('plumbing'),
  vanity: EACH_SCOPE('plumbing'),
  electrical_rough: ENTRY(
    'electrical',
    ['each'],
    ['circuit_device_count'],
    ['building_floor_area', 'fixture_count'],
    {
      alternateUnits: ['allowance', 'lump_sum', 'hr'],
      requiredMeasurementTypes: ['circuit_device_count'],
    }
  ),
  electrical_trim: FLAT_ALLOWANCE('electrical'),
  lighting: EACH_SCOPE('electrical'),
  exhaust_fan: EACH_SCOPE('hvac'),
  hvac: ENTRY('hvac', ['each', 'ton'], ['system_count'], ['conditioned_floor_area', 'building_floor_area'], {
    alternateUnits: ['allowance', 'lump_sum', 'sqft'],
    requiredMeasurementTypes: ['system_count'],
  }),
  hvac_startup: ENTRY('hvac', ['allowance'], ['allowance_amount'], ['conditioned_floor_area'], {
    alternateUnits: ['lump_sum', 'sqft'],
    requiredMeasurementTypes: ['allowance_amount'],
  }),
  appliances: ENTRY('appliances', ['each'], ['appliance_count'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
    requiredMeasurementTypes: ['appliance_count'],
  }),

  // Exterior and landscaping
  decking: ENTRY('decking', ['sqft'], ['room_floor_area', 'slab_area'], ['allowance_amount'], {
    alternateUnits: ['lf', 'allowance', 'lump_sum'],
  }),
  railing: ENTRY('decking', ['lf'], ['linear_length'], ['room_floor_area'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  sod_turf: ENTRY('landscaping', ['sqft'], ['site_area'], ['allowance_amount'], {
    alternateUnits: ['acre', 'allowance', 'lump_sum'],
  }),
  pavers: ENTRY('hardscape', ['sqft'], ['site_area', 'slab_area'], ['allowance_amount'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  rock_mulch: ENTRY('landscaping', ['sqft'], ['site_area'], ['ton', 'excavation_volume'], {
    alternateUnits: ['cy', 'ton', 'allowance', 'lump_sum'],
  }),
  plants_trees: EACH_SCOPE('landscaping'),
  irrigation: ENTRY('irrigation', ['lf'], ['linear_length'], ['site_area'], {
    alternateUnits: ['zone', 'allowance', 'lump_sum'],
  }),
  fencing: ENTRY('fencing', ['lf'], ['linear_length'], ['site_area'], {
    alternateUnits: ['allowance', 'lump_sum'],
  }),
  paving: ENTRY('paving', ['sqft'], ['site_area', 'slab_area'], ['allowance_amount'], {
    alternateUnits: ['ton', 'allowance', 'lump_sum'],
  }),
};

function normalizeUnit(unit?: string | null): UnitCode {
  const u = String(unit || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!u) return '';
  if (['sf', 'sq_ft', 'square_feet', 'square_foot'].includes(u)) return 'sqft';
  if (['linear_feet', 'linear_foot', 'linear_ft', 'ln_ft'].includes(u)) return 'lf';
  if (['cy', 'cubic_yard', 'cubic_yards'].includes(u)) return 'cy';
  if (['cf', 'cubic_foot', 'cubic_feet'].includes(u)) return 'cf';
  if (['square', 'roof_square', 'roof_squares'].includes(u)) return 'squares';
  if (['allowance', 'lump', 'lump_sum', 'flat', 'lot'].includes(u)) {
    return u === 'allowance' ? 'allowance' : 'lump_sum';
  }
  if (['ea', 'count', 'fixture_count'].includes(u)) return 'each';
  if (['bf', 'board_feet'].includes(u)) return 'board_foot';
  if (['lbs', 'pounds'].includes(u)) return 'lb';
  if (['hour', 'hours', 'hrs'].includes(u)) return 'hr';
  if (['percent', '%'].includes(u)) return 'percentage';
  return u;
}

function measurementKeysForRule(rule?: ScopeItemQuantityRule | null): string[] {
  if (!rule) return [];
  return [
    rule.measurementKey,
    ...(rule.measurementKeys || []),
    rule.pricingBasisMeasurementKey,
    ...(rule.pricingBasisMeasurementKeys || []),
    ...(rule.aggregateMeasurementKeys || []),
  ].filter(Boolean) as string[];
}

function measurementTypesForFields(fields: string[]): MeasurementType[] {
  return [...new Set(fields.flatMap((field) => MEASUREMENT_FIELD_TYPES[field] || []))];
}

function mergeUnique<T extends string>(...groups: Array<Array<T | string | undefined>>): T[] {
  return [...new Set(groups.flat().filter(Boolean) as T[])];
}

function fallbackRegistryEntry(scopeKey: string, rule?: ScopeItemQuantityRule | null): ScopeRegistryEntry {
  const fields = measurementKeysForRule(rule);
  const fieldTypes = measurementTypesForFields(fields);
  return {
    trade: 'unknown',
    preferredUnits: rule?.defaultUnit ? [normalizeUnit(rule.defaultUnit)] : ['allowance'],
    alternateUnits: (rule?.allowedUnits || ['allowance', 'lump_sum']).map(normalizeUnit),
    directMeasurementTypes: fieldTypes,
    derivedMeasurementTypes: [],
    requiredMeasurementTypes: fieldTypes,
    allowLumpSum: true,
    allowAllowance: true,
    allowManualQuantity: true,
    incompatibleUnitSeverity: 'review',
  };
}

export function getScopeUnitDefinition(
  scopeKey: string,
  templateKey?: string | null
): ScopeUnitDefinition {
  const rule = getChecklistItemQuantityRule(scopeKey, templateKey);
  const registry = SCOPE_UNIT_REGISTRY[scopeKey] || fallbackRegistryEntry(scopeKey, rule);
  const allowed = (rule?.allowedUnits || []).map(normalizeUnit);
  const registryPreferred = (registry.preferredUnits || []).map(normalizeUnit);
  const preferred = registryPreferred.length
    ? registryPreferred
    : [normalizeUnit(rule?.defaultUnit || allowed[0] || 'allowance')];
  const alternates = mergeUnique<UnitCode>(
    registry.alternateUnits || [],
    allowed.filter((u) => !preferred.includes(u))
  );
  const allowAllowance =
    registry.allowAllowance ?? allowed.includes('allowance') ?? preferred.includes('allowance');
  const allowLumpSum =
    registry.allowLumpSum ?? allowed.includes('lump_sum') ?? preferred.includes('lump_sum');
  const directMeasurementTypes =
    registry.directMeasurementTypes != null
      ? mergeUnique<MeasurementType>(registry.directMeasurementTypes)
      : measurementTypesForFields(measurementKeysForRule(rule));
  const normallyAllowance = preferred.includes('allowance') || Boolean(rule?.lumpSumOnly);
  return {
    scopeKey,
    trade: registry.trade || 'unknown',
    preferredUnits: preferred,
    alternateUnits: alternates,
    prohibitedUnits: (registry.prohibitedUnits || []).map(normalizeUnit),
    requiredMeasurementInputs: measurementKeysForRule(rule),
    directMeasurementTypes,
    derivedMeasurementTypes: mergeUnique<MeasurementType>(registry.derivedMeasurementTypes || []),
    requiredMeasurementTypes: mergeUnique<MeasurementType>(
      registry.requiredMeasurementTypes || [],
      directMeasurementTypes
    ),
    optionalMeasurementTypes: mergeUnique<MeasurementType>(registry.optionalMeasurementTypes || []),
    allowInheritedQuantity:
      registry.directMeasurementTypes != null
        ? registry.directMeasurementTypes.length > 0
        : Boolean(rule?.canUseRoomSqft || rule?.measurementKey || rule?.measurementKeys?.length),
    allowDerivedQuantity:
      registry.derivedMeasurementTypes != null
        ? registry.derivedMeasurementTypes.length > 0
        : Boolean(rule?.aggregateMeasurementKeys?.length || rule?.pricingBasisMeasurementKey),
    allowManualOverride: registry.allowManualQuantity ?? true,
    allowLumpSum,
    allowAllowance,
    normallyAllowance,
    mayBeLumpSum: allowLumpSum || allowAllowance || normallyAllowance,
    incompatibleUnitSeverity: registry.incompatibleUnitSeverity || 'review',
  };
}

function noteMeasurementMatchesResolved(params: {
  scopeKey: string;
  templateKey?: string | null;
  notes?: string | null;
  rule?: ScopeItemQuantityRule | null;
  resolved: ResolvedItemQuantity;
}): boolean {
  const notes = String(params.notes || '').trim();
  if (!notes || params.resolved.quantity == null || params.resolved.quantity <= 0) return false;

  const parsed = parseScopeMeasurementsFromNotes(notes, {
    templateKey: params.templateKey ?? undefined,
  });
  const directItem = parsed.itemQuantities?.[params.scopeKey];
  if (directItem?.quantity && Number(directItem.quantity) === Number(params.resolved.quantity)) {
    return true;
  }

  for (const key of measurementKeysForRule(params.rule)) {
    const parsedValue = Number((parsed as Record<string, unknown>)[key]);
    if (Number.isFinite(parsedValue) && parsedValue > 0 && parsedValue === Number(params.resolved.quantity)) {
      return true;
    }
  }
  return false;
}

function inferredMeasurementTypeForResolved(params: {
  rule?: ScopeItemQuantityRule | null;
  measurements: NormalizedScopeMeasurements;
  resolved: ResolvedItemQuantity;
}): MeasurementType | undefined {
  const value = Number(params.resolved.quantity);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  for (const key of measurementKeysForRule(params.rule)) {
    const measurementValue = Number((params.measurements as unknown as Record<string, unknown>)[key]);
    if (!Number.isFinite(measurementValue) || measurementValue <= 0) continue;
    if (Math.abs(measurementValue - value) <= 0.0001) {
      return MEASUREMENT_FIELD_TYPES[key]?.[0];
    }
  }
  for (const [key, raw] of Object.entries(params.measurements as unknown as Record<string, unknown>)) {
    if (key === 'itemQuantities') continue;
    const measurementValue = Number(raw);
    if (!Number.isFinite(measurementValue) || measurementValue <= 0) continue;
    if (Math.abs(measurementValue - value) <= 0.0001) {
      return MEASUREMENT_FIELD_TYPES[key]?.[0];
    }
  }
  return undefined;
}

export function classifyMeasurementRelationship(params: {
  scopeKey: string;
  templateKey?: string | null;
  measurementType?: MeasurementType | null;
}): MeasurementRelationshipType {
  const definition = getScopeUnitDefinition(params.scopeKey, params.templateKey);
  const measurementType = params.measurementType;
  if (!measurementType) return 'unknown';
  if (definition.directMeasurementTypes.includes(measurementType)) return 'direct';
  if (definition.derivedMeasurementTypes.includes(measurementType)) return 'derived';
  const targetUnit = definition.preferredUnits[0];
  if (targetUnit && measurementTypeUnitFamily(measurementType) !== unitFamily(targetUnit)) {
    return 'incompatible';
  }
  return 'unknown';
}

function relationshipForResolved(params: {
  scopeKey: string;
  templateKey?: string | null;
  rule?: ScopeItemQuantityRule | null;
  measurements: NormalizedScopeMeasurements;
  resolved: ResolvedItemQuantity;
}): ScopeItemIntelligence['measurementRelationship'] {
  const sourceMeasurementType = inferredMeasurementTypeForResolved(params);
  const type = classifyMeasurementRelationship({
    scopeKey: params.scopeKey,
    templateKey: params.templateKey,
    measurementType: sourceMeasurementType,
  });
  const definition = getScopeUnitDefinition(params.scopeKey, params.templateKey);
  return {
    type,
    sourceMeasurementType,
    targetMeasurementType: definition.requiredMeasurementTypes[0],
    formulaKey:
      type === 'derived' && sourceMeasurementType
        ? `${sourceMeasurementType}_to_${definition.requiredMeasurementTypes[0] || 'scope_quantity'}`
        : undefined,
  };
}

function unitFamily(unit?: string | null): 'area' | 'linear' | 'volume' | 'count' | 'time' | 'allowance' | 'percentage' | 'weight' | 'unknown' {
  const u = normalizeUnit(unit);
  if (['sqft', 'acre', 'squares'].includes(u)) return 'area';
  if (['lf'].includes(u)) return 'linear';
  if (['cy', 'cf'].includes(u)) return 'volume';
  if (['each', 'pair', 'set', 'sheet', 'room', 'fixture'].includes(u)) return 'count';
  if (['hr', 'day'].includes(u)) return 'time';
  if (['allowance', 'lump_sum'].includes(u)) return 'allowance';
  if (['percentage'].includes(u)) return 'percentage';
  if (['ton', 'lb', 'board_foot', 'gallon', 'load', 'dumpster'].includes(u)) return 'weight';
  return 'unknown';
}

function measurementTypeUnitFamily(type?: MeasurementType): ReturnType<typeof unitFamily> {
  if (!type) return 'unknown';
  if (/area|sqft|surface|roof|site|grading|slab/.test(type)) return 'area';
  if (/length|perimeter|lf|width|depth|height|cabinet/.test(type)) return 'linear';
  if (/volume|cy|concrete|excavation/.test(type)) return 'volume';
  if (/count|fixture|door|window/.test(type)) return 'count';
  if (/duration/.test(type)) return 'time';
  if (/allowance/.test(type)) return 'allowance';
  if (/percentage/.test(type)) return 'percentage';
  if (/ton|load|dumpster/.test(type)) return 'weight';
  return 'unknown';
}

function measurementRequirement(type: MeasurementType, optional = false): MeasurementRequirement {
  return {
    type,
    label: MEASUREMENT_LABELS[type] || String(type).replace(/_/g, ' '),
    optional,
  };
}

function quantitySourceMetadata(params: {
  scopeKey: string;
  templateKey?: string | null;
  notes?: string | null;
  rule?: ScopeItemQuantityRule | null;
  resolved: ResolvedItemQuantity;
}): Pick<ScopeQuantityIntelligence, 'source' | 'sourceLabel' | 'confidence' | 'reason'> {
  const { resolved } = params;
  const currentSource = resolved.quantitySource as QuantitySource;
  const noteMatched = noteMeasurementMatchesResolved(params);

  if (noteMatched) {
    return {
      source: 'from_notes',
      sourceLabel: 'From notes',
      confidence: 'high',
      reason: 'The quantity or directly usable measurement was found in the walkthrough notes.',
    };
  }

  if (currentSource === 'notes' && !noteMatched) {
    return {
      source: 'calculated_assumption',
      sourceLabel: 'Calculated',
      confidence: 'medium',
      reason: 'The value is note-backed internally, but the directly matching measurement was not found in notes.',
    };
  }

  if (currentSource === 'user_entered') {
    return {
      source: 'user_entered',
      sourceLabel: 'User entered',
      confidence: 'high',
      reason: 'The quantity was entered or confirmed by the user.',
    };
  }

  if (currentSource === 'calculated_confirmed') {
    return {
      source: 'calculated_confirmed',
      sourceLabel: 'Calculated',
      confidence: 'high',
      reason: 'The user accepted an approved formula result for this quantity.',
    };
  }

  if (currentSource === 'manual_override') {
    return {
      source: 'manual_override',
      sourceLabel: 'Manual override',
      confidence: 'high',
      reason: 'The user manually overrode the calculated quantity.',
    };
  }

  if (currentSource === 'default_assumption') {
    return {
      source: 'benchmark_estimate',
      sourceLabel: 'AI assumption',
      confidence: 'low',
      reason: 'The value is a default working assumption, not a measured quantity.',
    };
  }

  if (currentSource === 'missing' || resolved.quantity == null) {
    return {
      source: 'missing',
      sourceLabel: 'Measurement needed',
      confidence: 'missing',
      reason: 'A required measurement is missing for this scope item.',
    };
  }

  if (currentSource === 'inferred') {
    return {
      source: 'calculated_assumption',
      sourceLabel: 'Calculated',
      confidence: 'medium',
      reason: 'The quantity was calculated from available project measurements.',
    };
  }

  return {
    source: 'missing',
    sourceLabel: resolved.sourceLabel || 'Needs review',
    confidence: 'missing',
    reason: 'The quantity source is unclear.',
  };
}

type ValidationContext = {
  scopeKey: string;
  resolved: ResolvedItemQuantity;
  definition: ScopeUnitDefinition;
  quantityMeta: Pick<ScopeQuantityIntelligence, 'source' | 'confidence'>;
  relationship: ScopeItemIntelligence['measurementRelationship'];
};

type ScopeValidationRule = {
  key: string;
  severity: IntelligenceSeverity;
  evaluate: (context: ValidationContext) => ScopeIntelligenceIssue | null;
};

const SCOPE_VALIDATION_RULES: ScopeValidationRule[] = [
  {
    key: 'measurement_required',
    severity: 'review',
    evaluate: ({ resolved, definition }) => {
      if (resolved.quantity != null && resolved.pricingReady) return null;
      const missing = definition.requiredMeasurementTypes.map((type) => type);
      return {
        ruleKey: 'measurement_required',
        severity: 'review',
        title: 'Measurement needed',
        message: 'Measurement needed before this line is estimate-ready.',
        recommendedResolution: missing.length
          ? `Enter ${missing.map((m) => MEASUREMENT_LABELS[m] || m).slice(0, 2).join(' or ')}, use an allowance, or leave it for manual pricing.`
          : 'Enter the measurement, use an allowance, or leave it for manual pricing.',
        missingMeasurementTypes: missing,
        pricingMayContinue: true,
      };
    },
  },
  {
    key: 'unit_not_approved_for_scope',
    severity: 'warning',
    evaluate: ({ resolved, definition }) => {
      if (resolved.quantity == null) return null;
      const unit = normalizeUnit(resolved.unit);
      const approved = new Set([...definition.preferredUnits, ...definition.alternateUnits]);
      if (!unit || approved.size === 0 || approved.has(unit)) return null;
      return {
        ruleKey: 'unit_not_approved_for_scope',
        severity: definition.incompatibleUnitSeverity,
        title: 'Unit needs review',
        message: `${formatUnitLabel(resolved.unit)} is not an approved unit for this scope item.`,
        recommendedResolution: `Use ${[...approved].map(formatUnitLabel).join(', ')} or enter a lump sum/allowance if appropriate.`,
        relatedUnit: unit,
        pricingMayContinue: true,
      };
    },
  },
  {
    key: 'derived_measurement_requires_formula',
    severity: 'review',
    evaluate: ({ relationship, definition, resolved }) => {
      if (relationship.type !== 'derived') return null;
      if (resolved.quantity == null) return null;
      const source = relationship.sourceMeasurementType
        ? MEASUREMENT_LABELS[relationship.sourceMeasurementType] || relationship.sourceMeasurementType
        : 'this measurement';
      const target = relationship.targetMeasurementType
        ? MEASUREMENT_LABELS[relationship.targetMeasurementType] || relationship.targetMeasurementType
        : 'the target quantity';
      return {
        ruleKey: 'derived_measurement_requires_formula',
        severity: 'review',
        title: 'Calculation required',
        message: `${source} needs an approved formula before it can be used for ${target}.`,
        recommendedResolution: definition.requiredMeasurementTypes.length
          ? `Enter ${definition.requiredMeasurementTypes.map((t) => MEASUREMENT_LABELS[t] || t).slice(0, 2).join(' or ')} or use a lump sum/allowance.`
          : 'Enter the direct measurement or use a lump sum/allowance.',
        missingMeasurementTypes: definition.requiredMeasurementTypes,
        relatedMeasurementType: relationship.sourceMeasurementType,
        pricingMayContinue: true,
      };
    },
  },
  {
    key: 'incompatible_measurement_relationship',
    severity: 'warning',
    evaluate: ({ relationship, definition, resolved }) => {
      if (relationship.type !== 'incompatible') return null;
      if (resolved.quantity == null) return null;
      const source = relationship.sourceMeasurementType
        ? MEASUREMENT_LABELS[relationship.sourceMeasurementType] || relationship.sourceMeasurementType
        : 'This measurement';
      const preferred = definition.preferredUnits.map(formatUnitLabel).join(', ');
      return {
        ruleKey: 'incompatible_measurement_relationship',
        severity: definition.incompatibleUnitSeverity,
        title: 'Measurement relationship needs review',
        message: `${source} cannot be used directly for this scope item.`,
        recommendedResolution: preferred
          ? `Enter a compatible measurement (${preferred}) or use a lump sum/allowance.`
          : 'Enter a compatible measurement or use a lump sum/allowance.',
        missingMeasurementTypes: definition.requiredMeasurementTypes,
        relatedMeasurementType: relationship.sourceMeasurementType,
        pricingMayContinue: true,
      };
    },
  },
  {
    key: 'allowance_as_physical_quantity',
    severity: 'review',
    evaluate: ({ resolved, definition }) => {
      if (resolved.quantity == null) return null;
      const unit = normalizeUnit(resolved.unit);
      if (unit !== 'allowance' && unit !== 'lump_sum') return null;
      if (definition.normallyAllowance || definition.allowAllowance || definition.allowLumpSum) return null;
      return {
        ruleKey: 'allowance_as_physical_quantity',
        severity: 'review',
        title: 'Allowance needs confirmation',
        message: 'This line is using an allowance where a physical measurement is normally expected.',
        recommendedResolution: 'Confirm what the allowance includes or enter the measured quantity.',
        pricingMayContinue: true,
      };
    },
  },
];

function evaluateValidationRules(context: ValidationContext): ScopeIntelligenceIssue[] {
  return SCOPE_VALIDATION_RULES
    .map((rule) => rule.evaluate(context))
    .filter(Boolean) as ScopeIntelligenceIssue[];
}

function pricingSourceFromBlock(block?: SuggestedPricingBlock | null): PricingSourceKind {
  if (!block) return 'unknown';
  if (block.lumpSumOnly) return 'allowance';
  if (block.materialSource === 'template' || block.laborSource === 'template') return 'saved_rate';
  if (block.materialSource === 'notes' || block.laborSource === 'notes') return 'parsed_from_notes';
  if (block.materialSource === 'national_average' || block.laborSource === 'national_average') return 'national_average';
  return 'unknown';
}

export function pricingConfidenceForSource(source: PricingSourceKind): ScopePricingIntelligence {
  switch (source) {
    case 'project_quote':
    case 'user_entered':
      return {
        source,
        confidence: 'high',
        confidenceLabel: CONFIDENCE_LABELS.high,
        reason: 'Project-specific or user-entered pricing is the highest-confidence source.',
      };
    case 'saved_rate':
    case 'company_rate':
    case 'local_average':
    case 'parsed_from_notes':
      return {
        source,
        confidence: 'medium',
        confidenceLabel: CONFIDENCE_LABELS.medium,
        reason: 'Pricing is based on a relevant saved, local, company, or parsed source. Review inclusions.',
      };
    case 'national_average':
      return {
        source,
        confidence: 'low',
        confidenceLabel: CONFIDENCE_LABELS.low,
        reason: 'Pricing uses a broad national average fallback.',
      };
    case 'allowance':
      return {
        source,
        confidence: 'low',
        confidenceLabel: CONFIDENCE_LABELS.low,
        reason: 'Allowance pricing needs confirmation of what is included.',
      };
    case 'manual_pricing_required':
      return {
        source,
        confidence: 'missing',
        confidenceLabel: CONFIDENCE_LABELS.missing,
        reason: 'Manual pricing is required.',
      };
    default:
      return {
        source: 'unknown',
        confidence: 'missing',
        confidenceLabel: CONFIDENCE_LABELS.missing,
        reason: 'Pricing source is not available yet.',
      };
  }
}

export function pricingConfidenceForSuggestedBlock(
  block?: SuggestedPricingBlock | null
): ScopePricingIntelligence {
  if (block?.benchmarkScopeProfile) {
    const quality = benchmarkScopeDefinitionQuality(block.benchmarkScopeProfile);
    if (quality === 'undefined') {
      return {
        source: pricingSourceFromBlock(block),
        confidence: 'low',
        confidenceLabel: CONFIDENCE_LABELS.low,
        reason: 'Pricing source does not fully define what is included.',
      };
    }
    if (quality === 'partial') {
      return {
        source: pricingSourceFromBlock(block),
        confidence: 'low',
        confidenceLabel: CONFIDENCE_LABELS.low,
        reason: 'Pricing source has incomplete scope assumptions.',
      };
    }
  }
  return pricingConfidenceForSource(pricingSourceFromBlock(block));
}

export function resolveScopeItemIntelligence(params: {
  scopeKey: string;
  templateKey?: string | null;
  notes?: string | null;
  measurements: NormalizedScopeMeasurements;
  resolved: ResolvedItemQuantity;
  suggestedPricing?: SuggestedPricingBlock | null;
  activeScopeKeys?: string[];
  excludedScopeKeys?: string[];
  inclusionMetadata?: ScopeInclusionMetadata | null;
  rateMetadata?: RateMetadata | null;
  projectLocation?: ProjectLocation | null;
  projectMarkupPercent?: number | null;
  projectMarginPercent?: number | null;
  pricingAcceptance?: Record<string, { selectionStatus?: string; totalAmount?: number }>;
  scopeGapResolutions?: ScopeGapResolutionsLike;
  itemQuantities?: Record<string, { quantity?: string | number | null; unit?: string; quantitySource?: string }>;
  pricingAccepted?: boolean;
}): ScopeItemIntelligence {
  const rule = getChecklistItemQuantityRule(params.scopeKey, params.templateKey);
  const unitDefinition = getScopeUnitDefinition(params.scopeKey, params.templateKey);
  const measurementRelationship = relationshipForResolved({
    scopeKey: params.scopeKey,
    templateKey: params.templateKey,
    rule,
    measurements: params.measurements,
    resolved: params.resolved,
  });
  const quantityMeta = quantitySourceMetadata({
    scopeKey: params.scopeKey,
    templateKey: params.templateKey,
    notes: params.notes,
    rule,
    resolved: params.resolved,
  });
  const formula = calculateFormulaForScope({
    scopeKey: params.scopeKey,
    measurements: params.measurements,
    projectContext: params.templateKey,
  });
  const calculatedValue = formula?.roundedValue ?? null;
  const formulaComparison =
    formula && params.resolved.quantity != null && calculatedValue != null && params.resolved.quantity > 0
      ? {
          currentValue: params.resolved.quantity,
          currentUnit: params.resolved.unit,
          calculatedValue,
          calculatedUnit: formula.unit,
          variancePercent: Math.round(((params.resolved.quantity - calculatedValue) / calculatedValue) * 100),
        }
      : null;
  const missingInputs =
    quantityMeta.source === 'missing'
      ? unitDefinition.requiredMeasurementInputs
      : [];
  const missingFormulaInputs = !formula ? getMissingFormulaInputs(params.scopeKey) : [];
  const missingMeasurements =
    quantityMeta.source === 'missing' || measurementRelationship.type === 'derived' || measurementRelationship.type === 'incompatible'
      ? (unitDefinition.requiredMeasurementTypes.length
          ? unitDefinition.requiredMeasurementTypes.map((type) => measurementRequirement(type))
          : missingFormulaInputs.map((missing) => ({
              type: missing.type,
              label: missing.label,
            })))
      : [];
  const quantity: ScopeQuantityIntelligence = {
    value: params.resolved.quantity,
    unit: params.resolved.unit,
    ...quantityMeta,
    confidenceLabel: CONFIDENCE_LABELS[quantityMeta.confidence],
    missingInputs,
  };
  const validationIssues = evaluateValidationRules({
    scopeKey: params.scopeKey,
    resolved: params.resolved,
    definition: unitDefinition,
    quantityMeta,
    relationship: measurementRelationship,
  }).filter((issue) => !(formula && issue.ruleKey === 'derived_measurement_requires_formula'));
  const formulaNotices: ScopeValidationNotice[] =
    formula?.validationNotices.map((notice) => ({
      ...notice,
      title: notice.ruleKey === 'formula_missing_input' ? 'Formula input needed' : 'Formula review',
      recommendedResolution: 'Edit measurements, use a manual quantity, or choose a lump sum/allowance.',
      pricingMayContinue: true,
    })) || [];
  const pricing =
    params.suggestedPricing
      ? pricingConfidenceForSuggestedBlock(params.suggestedPricing)
      : pricingConfidenceForSource(
          getNationalAverageBudgetSplit(params.scopeKey, params.resolved.unit)
            ? 'national_average'
            : 'unknown'
        );
  const activeScopeKeys = params.activeScopeKeys || [];
  const assembly = evaluateAssemblyForScope({
    scopeKey: params.scopeKey,
    projectContext: params.templateKey,
    activeScopeKeys,
    notes: params.notes,
    inclusionMetadata: params.inclusionMetadata,
    pricingSource: pricing.source,
  });
  const scopeGaps = evaluateProjectScopeGaps({
    projectContext: params.templateKey,
    activeScopeKeys,
    excludedScopeKeys: params.excludedScopeKeys,
  });
  const overlaps = assembly?.possibleOverlaps || [];
  const benchmarkScopeProfile = params.suggestedPricing?.benchmarkScopeProfile ?? null;
  const reviewableAssumptionCount = countReviewableScopeAssumptionsForIntelligence(
    params.scopeKey,
    benchmarkScopeProfile
  );
  const reviewableComponents = getReviewableScopeComponents(
    assembly?.unknownComponents,
    params.scopeKey,
    params.notes,
    benchmarkScopeProfile
  );
  const unresolvedAssumptionCount = countUnresolvedScopeGaps(
    params.scopeKey,
    reviewableComponents,
    params.scopeGapResolutions as ScopeGapResolutionsMap | undefined,
    {
      itemQuantities: params.itemQuantities,
      pricingAcceptance: params.pricingAcceptance,
    }
  );
  const overlapRisk = detectActualDuplicatePricingConflicts({
    scopeKey: params.scopeKey,
    activeScopeKeys: params.activeScopeKeys || [],
    overlaps,
    pricingAcceptance: params.pricingAcceptance,
    benchmarkProfile: benchmarkScopeProfile,
    scopeGapResolutions: params.scopeGapResolutions,
  });
  const confidenceReasons = buildConfidenceReasons({
    quantity,
    pricing,
    benchmarkScopeProfile,
    overlapRisk,
  });
  const dependencies = assembly?.dependencies || [];
  const assemblyNotices = (assembly?.notices || []).filter(
    (notice) => notice.ruleKey !== 'scope_possible_overlap'
  );
  const pricingCompleteness = evaluatePricingCompleteness({
    scopeKey: params.scopeKey,
    trade: unitDefinition.trade,
    projectContext: params.templateKey,
    pricingSource: pricing.source,
    suggestedPricing: params.suggestedPricing,
    resolved: params.resolved,
    metadata: params.rateMetadata,
    projectLocation: params.projectLocation,
    projectMarkupPercent: params.projectMarkupPercent,
    projectMarginPercent: params.projectMarginPercent,
  });
  const allValidationIssues = [
    ...validationIssues,
    ...formulaNotices,
    ...assemblyNotices,
    ...pricingCompleteness.notices,
  ];
  const approvedUnits = new Set([...unitDefinition.preferredUnits, ...unitDefinition.alternateUnits]);
  const currentUnit = normalizeUnit(params.resolved.unit);
  const unitValidationStatus: UnitValidationStatus =
    !currentUnit
      ? 'unknown'
      : approvedUnits.size === 0
        ? 'unknown'
        : approvedUnits.has(currentUnit)
          ? 'valid'
          : allValidationIssues.some((issue) => issue.severity === 'blocking')
            ? 'invalid'
            : 'review';
  const blocking = allValidationIssues.some((issue) => issue.severity === 'blocking');
  const review = allValidationIssues.length > 0 || quantity.confidence === 'low' || Boolean(formulaComparison);
  return {
    scopeItemKey: params.scopeKey,
    unitDefinition,
    unitValidation: {
      status: unitValidationStatus,
      currentUnit,
      preferredUnits: unitDefinition.preferredUnits,
      alternateUnits: unitDefinition.alternateUnits,
    },
    measurementRelationship,
    missingMeasurements,
    validationNotices: allValidationIssues,
    formula,
    formulaComparison,
    assembly,
    scopeGaps,
    overlaps,
    dependencies,
    canContinue: !blocking,
    quantity,
    pricing,
    benchmarkScopeProfile,
    reviewableAssumptionCount,
    unresolvedAssumptionCount,
    overlapRisk,
    confidenceReasons,
    pricingCompleteness,
    validation: {
      status: blocking
        ? 'blocked'
        : quantity.confidence === 'missing'
          ? 'measurement_needed'
          : review
            ? 'review_required'
            : 'ready',
      issues: allValidationIssues,
    },
  };
}

const CONFIDENCE_RANK: Record<IntelligenceConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  missing: 0,
};

function lowerConfidence(
  current: IntelligenceConfidence,
  candidate: IntelligenceConfidence
): IntelligenceConfidence {
  return CONFIDENCE_RANK[current] <= CONFIDENCE_RANK[candidate] ? current : candidate;
}

export function buildOverlapRisk(overlaps: ScopeOverlapNotice[]): OverlapRisk {
  const primary = overlaps[0];
  if (!primary) {
    return { hasOverlapRisk: false, relatedScopeKeys: [] };
  }
  return {
    hasOverlapRisk: true,
    relatedScopeKeys: primary.relatedScopeKeys,
    reason: primary.message,
  };
}

function countReviewableScopeAssumptionsForIntelligence(
  scopeKey: string,
  profile: BenchmarkScopeAssumptionProfile | null | undefined
): number {
  if (!profile?.scopeAssumptionsDefined) {
    if (scopeKey === 'excavation') return 5;
    const keys = HIGH_IMPACT_FALLBACK_SCOPE_KEYS[scopeKey] || [];
    return new Set(keys.map((key) => canonicalBenchmarkScopeKey(key))).size;
  }
  return profile.scopeAssumptions.filter((assumption) => {
    if (assumption.status === 'included') return assumption.riskLevel === 'high';
    return assumption.status === 'excluded' || assumption.status === 'conditional' || assumption.status === 'unknown';
  }).length;
}

function scopeKeyLabel(scopeKey: string): string {
  return scopeKey.replace(/_/g, ' ');
}

function scopeHasAcceptedPricing(
  scopeKey: string,
  pricingAcceptance?: Record<string, { selectionStatus?: string; totalAmount?: number }>
): boolean {
  const acceptance = pricingAcceptance?.[scopeKey];
  if (!acceptance) return false;
  return acceptance.selectionStatus === 'accepted' || acceptance.selectionStatus === 'manual_adjusted';
}

export function detectActualDuplicatePricingConflicts(params: {
  scopeKey: string;
  activeScopeKeys: string[];
  overlaps: ScopeOverlapNotice[];
  pricingAcceptance?: Record<string, { selectionStatus?: string; totalAmount?: number }>;
  benchmarkProfile?: BenchmarkScopeAssumptionProfile | null;
  scopeGapResolutions?: ScopeGapResolutionsLike;
}): OverlapRisk {
  const relatedKeys: string[] = [];
  const messages: string[] = [];
  const active = new Set(params.activeScopeKeys);
  const currentAccepted = scopeHasAcceptedPricing(params.scopeKey, params.pricingAcceptance);

  for (const overlap of params.overlaps) {
    const pricedRelated = overlap.relatedScopeKeys.filter(
      (key) =>
        key !== params.scopeKey &&
        active.has(key) &&
        scopeHasAcceptedPricing(key, params.pricingAcceptance)
    );
    if (currentAccepted && pricedRelated.length > 0) {
      const relatedLabel = scopeKeyLabel(pricedRelated[0]);
      const parentLabel = scopeKeyLabel(params.scopeKey);
      messages.push(
        `${relatedLabel.charAt(0).toUpperCase()}${relatedLabel.slice(1)} may already be included in ${parentLabel} and also has a separate price. Review both items.`
      );
      relatedKeys.push(...pricedRelated);
    }
  }

  if (params.benchmarkProfile?.scopeAssumptionsDefined) {
    for (const assumption of params.benchmarkProfile.scopeAssumptions) {
      if (assumption.status !== 'included') continue;
      const relatedScopeKey = assumption.scopeKey;
      if (
        active.has(relatedScopeKey) &&
        scopeHasAcceptedPricing(relatedScopeKey, params.pricingAcceptance) &&
        relatedScopeKey !== params.scopeKey
      ) {
        const label = assumption.displayLabel || scopeKeyLabel(relatedScopeKey);
        messages.push(
          `${label} is included in the suggested ${scopeKeyLabel(params.scopeKey)} price but also has separate pricing. Review both items.`
        );
        relatedKeys.push(relatedScopeKey);
      }
    }
  }

  if (params.scopeGapResolutions) {
    for (const [key, record] of Object.entries(params.scopeGapResolutions)) {
      const separator = key.indexOf('::');
      if (separator <= 0) continue;
      const parentScopeItemId = key.slice(0, separator);
      const componentKey = key.slice(separator + 2);
      if (parentScopeItemId !== params.scopeKey || record.status !== 'included') continue;
      for (const relatedScopeKey of [componentKey, ...(params.overlaps[0]?.relatedScopeKeys || [])]) {
        if (
          relatedScopeKey !== params.scopeKey &&
          active.has(relatedScopeKey) &&
          scopeHasAcceptedPricing(relatedScopeKey, params.pricingAcceptance)
        ) {
          const label = scopeKeyLabel(relatedScopeKey);
          messages.push(
            `${label.charAt(0).toUpperCase()}${label.slice(1)} may already be covered by ${scopeKeyLabel(params.scopeKey)} and also has a separate price. Review both items.`
          );
          relatedKeys.push(relatedScopeKey);
        }
      }
    }
  }

  if (!messages.length) {
    return { hasOverlapRisk: false, relatedScopeKeys: [] };
  }
  return {
    hasOverlapRisk: true,
    relatedScopeKeys: [...new Set(relatedKeys)],
    reason: messages[0],
    title: 'Possible duplicate pricing',
  };
}

export function benchmarkScopeUndefinedCardMessage(
  profile: BenchmarkScopeAssumptionProfile | null | undefined,
  pricingSource?: PricingSourceKind
): string | null {
  if (benchmarkScopeDefinitionQuality(profile) !== 'undefined') return null;
  if (pricingSource === 'national_average') {
    return `${NATIONAL_AVERAGE_BASE_SCOPE_NOTE} Review high-impact scope items before using it.`;
  }
  return 'This price source does not fully define its inclusions. Review high-impact scope items before using it.';
}

export function buildConfidenceReasons(params: {
  quantity: ScopeQuantityIntelligence;
  pricing: ScopePricingIntelligence;
  benchmarkScopeProfile?: BenchmarkScopeAssumptionProfile | null;
  overlapRisk: OverlapRisk;
}): string[] {
  const reasons: string[] = [];
  if (params.benchmarkScopeProfile && !params.benchmarkScopeProfile.scopeAssumptionsDefined) {
    reasons.push('missing_scope_profile');
  }
  if (params.pricing.confidence === 'low' && params.pricing.reason) {
    reasons.push(params.pricing.reason);
  }
  if (params.overlapRisk.hasOverlapRisk) {
    reasons.push('possible_scope_overlap');
  }
  if (params.quantity.confidence === 'medium' || params.quantity.confidence === 'low') {
    reasons.push(params.quantity.reason);
  }
  return reasons;
}

export function cardConfidenceForIntelligence(intelligence: ScopeItemIntelligence): IntelligenceConfidence {
  let confidence = intelligence.quantity.confidence;
  const profile = intelligence.benchmarkScopeProfile;
  if (profile && benchmarkScopeDefinitionQuality(profile) !== 'defined') {
    confidence = lowerConfidence(confidence, 'low');
  } else if (intelligence.pricing.source !== 'unknown') {
    confidence = lowerConfidence(confidence, intelligence.pricing.confidence);
  }
  return confidence;
}

export function buildCardIntelligenceDisplay(
  intelligence: ScopeItemIntelligence,
  options?: { pricingAccepted?: boolean }
): CardIntelligenceDisplay {
  const confidence = cardConfidenceForIntelligence(intelligence);
  const profileUndefined = benchmarkScopeDefinitionQuality(intelligence.benchmarkScopeProfile) === 'undefined';
  const conciseBenchmarkWarning = buildConciseBenchmarkScopeWarning({
    profile: intelligence.benchmarkScopeProfile,
    pricingSource: intelligence.pricing.source,
    assumptionCount: intelligence.unresolvedAssumptionCount ?? intelligence.reviewableAssumptionCount,
    pricingAccepted: options?.pricingAccepted,
    scopeKey: intelligence.scopeItemKey,
  });
  const otherNotice = primaryIntelligenceNotice(intelligence);
  const suppressOtherNotice =
    Boolean(conciseBenchmarkWarning) &&
    Boolean(
      otherNotice &&
        (/national average|does not fully define|pricing source/i.test(otherNotice) ||
          otherNotice === intelligence.pricing.reason)
    );

  return {
    confidence,
    confidenceLabel: CONFIDENCE_LABELS[confidence],
    sourceLabel: intelligence.quantity.sourceLabel,
    conciseBenchmarkWarning,
    duplicatePricingMessage: intelligence.overlapRisk.hasOverlapRisk
      ? intelligence.overlapRisk.reason ?? null
      : null,
    duplicatePricingTitle: intelligence.overlapRisk.title ?? null,
    otherNotice: suppressOtherNotice ? null : otherNotice,
    confidenceReasons: intelligence.confidenceReasons,
    showQuantityConfidenceLine: !profileUndefined || confidence !== intelligence.quantity.confidence,
  };
}

export function primaryIntelligenceNotice(intelligence: ScopeItemIntelligence): string | null {
  if (intelligence.formula && intelligence.quantity.source === 'missing') {
    return intelligence.formula.formulaExplanation;
  }
  if (intelligence.quantity.confidence === 'missing') {
    const missing = (intelligence.missingMeasurements.length
      ? intelligence.missingMeasurements.map((m) => m.label)
      : intelligence.quantity.missingInputs)
      .slice(0, 2)
      .join(', ');
    return missing ? `Measurement needed: ${missing}` : 'Measurement needed for this scope item.';
  }
  if (intelligence.formulaComparison) {
    if (
      intelligence.quantity.source !== 'calculated_confirmed' &&
      intelligence.formulaComparison.variancePercent !== 0
    ) {
      const variance = intelligence.formulaComparison.variancePercent;
      // Extreme % usually means unit mismatch (e.g. CY vs sqft) — show value only.
      if (Math.abs(variance) > 150) {
        return `Calculated comparison: ${intelligence.formulaComparison.calculatedValue.toLocaleString()} ${formatUnitLabel(intelligence.formulaComparison.calculatedUnit)}.`;
      }
      const sign = variance > 0 ? '+' : '';
      return `Calculated comparison: ${intelligence.formulaComparison.calculatedValue.toLocaleString()} ${formatUnitLabel(intelligence.formulaComparison.calculatedUnit)} (${sign}${variance}% vs current).`;
    }
  }
  const issue = intelligence.validation.issues.find(
    (i) =>
      (i.severity === 'warning' || i.severity === 'review') && i.ruleKey !== 'scope_possible_overlap'
  );
  if (issue) return issue.message;
  if (intelligence.quantity.confidence === 'low') return intelligence.quantity.reason;
  return null;
}
