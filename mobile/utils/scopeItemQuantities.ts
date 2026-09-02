/**
 * Client-side mirror of bathroom checklist quantity rules for Confirm Scope UI.
 * Backend source of truth: backend/src/services/scopeItemQuantityCatalog.js
 */

import {
  stripScopeInputForSingleTrade,
  type PlanTradeKey,
} from '@/utils/planImportTradeConfig';
import {
  copyElectricalConditionFields,
  copyElectricalQuantityFields,
  electricalQuantityRules,
  isCanonicalElectricalItemId,
  shouldAutoPriceElectricalRoughPackage,
  shouldAutoPriceElectricalTrimPackage,
  ELECTRICAL_CARDS,
  type ElectricalQuantityKey,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  PLUMBING_CARDS,
  copyPlumbingQuantityFields,
  hasDetailedPlumbingRoughQuantities,
  hasDetailedPlumbingTrimQuantities,
  plumbingCardForItemId,
  plumbingMeasurementKeyForItemId,
  shouldAutoPricePlumbingRoughPackage,
  shouldAutoPricePlumbingTrimPackage,
  type PlumbingPerformerMode,
  type PlumbingQuantityKey,
  type PlumbingWorkflowMode,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  HVAC_CARDS,
  HVAC_EQUIPMENT_TYPE_SCOPE_ITEM_IDS,
  copyHvacQuantityFields,
  hvacCardForItemId,
  hvacSystemTierBudgetSplit,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';
import {
  isWindowsDoorsCountScopeItemId,
  openingScheduleRowsForMeasurementKey,
  openingSchedulesFromPlanFacts,
  openingSizeMixFromRows,
} from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';
import { isGarageDoorsCountScopeItemId } from '@/utils/subcontractorTrade/garageDoorsPlanConvergence';
import {
  FRAMING_CARDS,
  copyFramingQuantityFields,
  framingCardForItemId,
  isShellFramingPackageBid,
  resolveCoveredFramedAreaSqft,
  resolveFramingSheathingSqft,
  shellPackageIncludesSheathing,
  shouldPreserveShellFramingComponentMeasurement,
} from '@/utils/subcontractorTrade/framingPlanConvergence';
import {
  copyInsulationAssemblyFields,
  copyInsulationScopeNumericFields,
  copyInsulationScopeTextFields,
  insulationBattFacingLabel,
  insulationBattFacingMaterialAddPerSqft,
  INSULATION_ASSEMBLY_RATE_CARD_LABEL,
  INSULATION_CALIBRATED_RATE_CARD_LABEL,
  INSULATION_PRODUCTION_BATT_BASELINE,
  INSULATION_PRODUCTION_RATE_CARD_LABEL,
  type InsulationAssemblyPlanningRateTier,
  insulationAssemblyCeilingRoofDeckConflict,
  insulationAssemblyCodeWarnings,
  type InsulationBattFacing,
} from '@/utils/subcontractorTrade/insulationPlanConvergence';
import {
  isElectricalServicePanelItemId,
  resolveElectricalServicePanelSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalServicePanelPricing';
import {
  isElectricalCircuitItemId,
  resolveElectricalCircuitSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalCircuitPricing';
import {
  isElectricalReceptacleItemId,
  resolveElectricalReceptacleSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalReceptaclePricing';
import {
  isElectricalSwitchItemId,
  resolveElectricalSwitchSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalSwitchPricing';
import {
  isElectricalLightingFanItemId,
  resolveElectricalLightingFanSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalLightingFanPricing';
import {
  isElectricalHookupItemId,
  resolveElectricalHookupSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalHookupPricing';
import {
  isElectricalSpecialSystemItemId,
  resolveElectricalSpecialSystemSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalSpecialSystemsPricing';
import {
  isElectricalModificationItemId,
  resolveElectricalModificationSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalModificationPricing';
import {
  isElectricalRacewayItemId,
  resolveElectricalRacewaySuggestedPricing,
} from '@/utils/subcontractorTrade/electricalRacewayPricing';
import {
  isElectricalTrimItemId,
  resolveElectricalTrimSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalTrimPricing';
import {
  isElectricalRoughItemId,
  resolveElectricalRoughSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalRoughPricing';
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
  applyProjectComplexityToSuggestedPricing,
  hydrateProjectComplexityInputFields,
  type ProjectComplexitySettings,
  type SuggestedPricingComplexityMeta,
} from '@/utils/projectComplexityAdjustments';
import { resolvePlumbingWaterHeaterSuggestedPricing } from '@/utils/subcontractorTrade/plumbingEquipmentPricing';
import {
  applyBuilderBudgetBarometer,
  getBuilderBudgetSoftCostAllowance,
} from '@/utils/southernUtahCalibratedRates';
import {
  framingShellPackageBreakdownForProject,
  framingComparableHelper,
  resolveFramingShellPackageComparable,
} from '@/utils/southernUtahFramingComparables';
import {
  plumbingPackageComparableHelper,
  resolvePlumbingPackageComparable,
} from '@/utils/southernUtahPlumbingComparables';
import {
  hvacPackageComparableHelper,
  hvacPlanBarometerComparisonSplit,
  HVAC_BPS_PLANNING_PACKAGE_RANGE,
  HVAC_NATIONAL_COMPLETE_PACKAGE_RANGE,
  HVAC_NATIONAL_MULTI_SYSTEM_PACKAGE_RANGE,
  isSouthernUtahPricingLocation,
  hvacUsesInstalledPackagePricing,
  isHvacComponentScopeItemId,
  resolveHvacInstalledPackageSuggestedTotal,
  resolveHvacPackageComparable,
  resolveHvacPricingEvidenceTier,
} from '@/utils/southernUtahHvacComparables';
import {
  barometerLabelForProjectId,
  installedBudgetLivingSfReference,
} from '@/utils/builderBudgetLumpBlend';
import {
  exteriorPaintLocalCalibrationMessage,
  exteriorPaintLocalSampleCount,
  matchSouthernUtahProjectByLivingSf,
  resolveFinishCarpentryComparable,
  resolveInteriorPaintComparable,
  type SouthernUtahProjectId,
} from '@/utils/southernUtahPaintTrimComparables';
import {
  EXTERIOR_OPENING_NATIONAL_RATES,
  inferDefaultGarageDoorCounts,
  normalizeGarageDoorCounts,
  resolveExteriorDoorsLumpSuggestedFill,
  resolveGarageDoorSuggestedPricing,
  resolveOpeningSizeTierSuggestedPricing,
  resolveSlidingDoorsLumpSuggestedFill,
  totalGarageDoorCount,
} from '@/utils/exteriorOpeningsPricing';
import {
  deriveTrimFinishLfFromMeasurements,
  OPENING_TRIM_FINISH_PLANNING_LF_LABEL,
  OPENING_TRIM_FINISH_SCOPE_HELPER,
  resolveTrimFinishFieldPaintIncluded,
  resolveTrimFinishSuggestedPricing,
} from '@/utils/windowsDoorsTrimFinishPricing';
import {
  isBathroomVanityCountertopScope,
  resolveBathroomVanityCountertopMaterialType,
  resolveBathroomVanityCountertopSuggestedPricing,
} from '@/utils/bathroomVanityCountertopPricing';
import { resolveBathroomFixtureChoiceSuggestedPricing } from '@/utils/bathroomFixtureChoicePricing';
import { resolveKitchenGarbageDisposalChoiceSuggestedPricing } from '@/utils/kitchenGarbageDisposalChoicePricing';
import {
  mergeBathroomPaintRepairEntireRoom,
  mergeBathroomPaintRepairLocalizedScope,
  sanitizeBathroomPaintRepairEntireRoom,
  sanitizeBathroomPaintRepairScopeForPersist,
} from '@/utils/bathroomDrywallPaintScope';
import { resolveStep2ComponentSuggestedPricing } from '@/utils/confirmScopeStep2Pricing';
import { resolveExteriorFlatworkLumpSuggestedFill } from '@/utils/exteriorFlatworkPricing';
import {
  capTakeoffTotalAtBarometerLump,
  flooringUsesBarometerLumpPackage,
  resolveElectricalRoughLumpSuggestedFill,
  resolveExteriorPaintLumpSuggestedFill,
  resolveFlooringLumpSuggestedFill,
  resolveInsulationLumpSuggestedFill,
  resolvePlumbingRoughLumpSuggestedFill,
  resolveStuccoSuggestedTotal,
} from '@/utils/groundUpBarometerLumpPackages';
import { resolveGroundUpFinishPackageLump } from '@/utils/groundUpFinishPackages';
import {
  isUndercountedDrywallSurface,
  syncMeasurementsWithSouthernUtahPlanFacts,
} from '@/utils/quickMeasurementEstimates';
import {
  copyDrywallQuantityFields,
  DRYWALL_INSTALLED_MATERIAL_SHARE,
  drywallPackageSurfacePlanningQuantity,
  drywallSurfaceFromComponents,
  drywallSurfacePlanningQuantity,
  hasDrywallSurfaceComponentTakeoff,
  isProtectedDrywallQuantity,
  resolveDrywallPackageSurfaceQuantity,
  resolveDrywallProductionAssemblyBaseline,
  isDrywallCompletePackageScope,
  resolveRemodelDrywallAssemblyBaseline,
  resolveDrywallConditionedSurfaceQuantity,
  resolveDrywallFinishChoiceId,
  drywallFinishLaborMultiplier,
  drywallFinishLaborBucketLabel,
  resolveDrywallPackageMaterialMultiplier,
  resolveDrywallPackageLaborMultiplier,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import {
  insulationEnvelopeInputsFromPlanFacts,
  resolveInsulationEnvelopePlanningQuantity,
  type InsulationEnvelopeInputs,
} from '@/utils/insulationEnvelopeQuantity';
import {
  resolveDraftScopeNotes,
  type ScopeMeasurements,
} from '@/utils/estimateAiDraft';
import {
  buildFloorPrepPricingContext,
  demoCatalogAssumptionNote,
  resolveConfirmedAffectedPrepArea,
} from '@/utils/flooringDemoPrepBoundary';
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
  resolveLibraryRateForItem,
  resolveLibraryLumpSumForItem,
  type ScopePricingLibraryRate,
} from '@/utils/scopePricingLibraryContext';
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
  | 'plan_vision'
  | 'contractor_confirmed_from_plan_review'
  /** Edit editor seed from Suggest — not accepted until the user edits or Applies. */
  | 'suggested_prefill';

export type ScopeItemQuantityRule = {
  defaultUnit: string;
  allowedUnits: string[];
  measurementKey?: keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>;
  measurementKeys?: Array<
    keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>
  >;
  pricingBasisMeasurementKey?: keyof Omit<
    NormalizedScopeMeasurements,
    'itemQuantities'
  >;
  pricingBasisMeasurementKeys?: Array<
    keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>
  >;
  aggregateMeasurementKeys?: Array<
    keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>
  >;
  choiceIds?: string[];
  canUseRoomSqft?: boolean;
  requiresUserQuantity?: boolean;
  /** Separate count + dollar allowance inputs (plumbing/electrical rough-in). */
  dualAllowanceField?: boolean;
  /** Flat allowance lines (permits, cleanup, fees) — no material/labor split in UI or suggestions. */
  lumpSumOnly?: boolean;
  /** Material + labor only — total is derived from legs (no count / SF basis field). */
  splitTotalOnly?: boolean;
  /**
   * Deprecated for trade scopes. Soft costs use lumpSumOnly instead.
   * Kept optional for backward-compatible rule reads.
   */
  allowanceOrSplit?: boolean;
  defaultQuantity?: number;
  quantityHelper?: string;
  missingMessage?: string;
};

export const DUAL_ALLOWANCE_ITEM_IDS = [
  'plumbing_rough',
  'electrical_rough',
] as const;

export function roughAllowanceSubKey(itemId: string): string {
  return `${itemId}__allowance`;
}

export function isDualAllowanceItem(itemId: string): boolean {
  return Boolean(CHECKLIST_ITEM_QUANTITY_RULES[itemId]?.dualAllowanceField);
}

export const DUAL_QUANTITY_FIELD_LABELS: Record<
  string,
  {
    count: string;
    countUnit: string;
    allowance: string;
    secondaryCount?: string;
    secondaryCountUnit?: string;
  }
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
  windows_doors: {
    count: 'Window & door openings',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  windows: {
    count: 'Window count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  exterior_doors: {
    count: 'Exterior door count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  sliding_doors: {
    count: 'Sliding door count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  garage_doors: {
    count: 'Garage door count (from types)',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  garage_door_openers: {
    count: 'Garage door opener count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  interior_doors: {
    count: 'Interior door count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  trim_finish: {
    count: OPENING_TRIM_FINISH_PLANNING_LF_LABEL,
    countUnit: 'lf',
    allowance: 'Allowance ($)',
  },
  doors: {
    count: 'Door count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  hvac: {
    count: 'System count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
    secondaryCount: 'System capacity',
    secondaryCountUnit: 'ton',
  },
  insulation: {
    count: 'Whole-house insulation area',
    countUnit: 'sqft',
    allowance: 'Allowance ($)',
  },
  appliances: {
    count: 'Appliances',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  lighting: {
    count: 'Light fixture count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  toilet: {
    count: 'Toilet count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  vanity: {
    count: 'Vanity count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  sink_faucet: {
    count: 'Sink / faucet count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  garbage_disposal: {
    count: 'Disposal count',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  exhaust_fan: {
    count: 'Exhaust fan count',
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
  backsplash_demo: {
    count: 'Backsplash demo area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
};

/** Clear editor label for count/area fields — never leave measurement-needed scopes as bare "Quantity". */
export function getScopeQuantityFieldLabels(itemId: string): {
  count: string;
  countUnit: string;
  allowance: string;
  secondaryCount?: string;
  secondaryCountUnit?: string;
} {
  const known = DUAL_QUANTITY_FIELD_LABELS[itemId];
  if (known) return known;
  return {
    count: 'Quantity',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  };
}

/** Material/Labor editor basis field label (replaces generic "Pricing basis" when we know the measurement). */
export function pricingBasisFieldLabel(
  itemId: string,
  unit?: string | null
): string {
  const labels = getScopeQuantityFieldLabels(itemId);
  if (labels.count !== 'Quantity') return labels.count;
  const u = String(unit || '').toLowerCase();
  if (u === 'each' || u === 'ea' || u === 'count') return 'Count';
  if (u === 'ton' || u === 'tons') return 'Tons';
  if (u === 'lf') return 'Linear feet';
  if (u === 'cy') return 'Cubic yards';
  if (u === 'sqft' || u === 'sf') return 'Area (sqft)';
  return 'Pricing basis';
}

export type NormalizedScopeMeasurements = {
  bathroomFloorSqft: number | null;
  kitchenFloorSqft: number | null;
  floorAreaSqft: number | null;
  flooringSqft: number | null;
  flooringLvpSqft: number | null;
  flooringLaminateSqft: number | null;
  flooringEngineeredHardwoodSqft: number | null;
  flooringSolidHardwoodSqft: number | null;
  flooringTileSqft: number | null;
  flooringCarpetSqft: number | null;
  floorDemoSqft: number | null;
  floorPrepSqft: number | null;
  underlaymentSqft: number | null;
  moistureBarrierSqft: number | null;
  transitionLf: number | null;
  transitionCount: number | null;
  quarterRoundLf: number | null;
  backsplashSqft: number | null;
  countertopSqft: number | null;
  cabinetLf: number | null;
  landscapeSqft: number | null;
  artificialTurfSqft: number | null;
  demoClearingSqft: number | null;
  gradingSqft: number | null;
  soilPrepSqft: number | null;
  sodSqft: number | null;
  paverSqft: number | null;
  rockMulchSqft: number | null;
  landscapeTons: number | null;
  plantCount: number | null;
  treeCount: number | null;
  irrigationZoneCount: number | null;
  drainageLf: number | null;
  concreteEdgingLf: number | null;
  boulderCount: number | null;
  landscapeLightCount: number | null;
  roofAreaSqft: number | null;
  roofIceWaterShieldSqft: number | null;
  roofSquares: number | null;
  roofPitch: string | null;
  storyCount: number | null;
  roofDeckingReplacementSqft: number | null;
  roofDripEdgeLf: number | null;
  roofRidgeCapLf: number | null;
  roofRidgeVentLf: number | null;
  roofValleyFlashingLf: number | null;
  roofStepFlashingLf: number | null;
  roofWallFlashingLf: number | null;
  roofChimneyFlashingCount: number | null;
  roofPipeBootCount: number | null;
  roofVentCount: number | null;
  roofTurbineVentCount: number | null;
  roofSkylightCount: number | null;
  roofPenetrationCount: number | null;
  roofRepairAffectedSqft: number | null;
  roofGutterLf: number | null;
  roofDownspoutCount: number | null;
  drywallSqft: number | null;
  drywallWallSqft: number | null;
  drywallCeilingSqft: number | null;
  drywallOpeningDeductionSqft: number | null;
  concreteSqft: number | null;
  concreteReinforcementSqft: number | null;
  concreteSealerSqft: number | null;
  concreteSubgradePrepSqft: number | null;
  concreteThicknessInches: number | null;
  complexFormingLf: number | null;
  additionalHaulOffLoadCount: number | null;
  concreteDemoSqft: number | null;
  concreteDemoThicknessBand:
    | 'thin_2_3'
    | 'standard_4'
    | 'heavy_5_6'
    | 'structural_7_plus'
    | null;
  concreteDemoThicknessBands: Array<
    'thin_2_3' | 'standard_4' | 'heavy_5_6' | 'structural_7_plus'
  > | null;
  concreteDemoAreaByThickness: Partial<
    Record<
      'thin_2_3' | 'standard_4' | 'heavy_5_6' | 'structural_7_plus',
      number | null
    >
  > | null;
  concreteDemoReinforced: boolean | null;
  concreteDemoLimitedAccess: boolean | null;
  concreteDemoCy: number | null;
  concreteCy: number | null;
  excavationCy: number | null;
  excavationAreaSqft: number | null;
  excavationDepthInches: number | null;
  deckSqft: number | null;
  garageSqft: number | null;
  exteriorPaintSqft: number | null;
  windowCount: number | null;
  exteriorDoorCount: number | null;
  slidingDoorCount: number | null;
  stuccoGrossWallSqft: number | null;
  stuccoWindowDoorOpeningSqft: number | null;
  stuccoGarageOpeningSqft: number | null;
  stuccoOtherFinishDeductionSqft: number | null;
  stuccoNetWallSqft: number | null;
  stuccoSoffitSqft: number | null;
  stuccoParapetSqft: number | null;
  stuccoFoamTrimLf: number | null;
  stuccoControlJointLf: number | null;
  stuccoAccessAffectedSqft: number | null;
  stuccoRepairAffectedSqft: number | null;
  stuccoStories: number | null;
  stuccoWallHeightFt: number | null;
  exteriorWallGrossSqft: number | null;
  exteriorWallInsulationSqft: number | null;
  atticInsulationSqft: number | null;
  insulatedRoofDeckSqft: number | null;
  floorInsulationSqft: number | null;
  garageSeparationInsulationSqft: number | null;
  insulatedGarageWallSqft: number | null;
  insulatedGarageCeilingSqft: number | null;
  openingDeductionSqft: number | null;
  insulationMaterialType: string | null;
  insulationRValue: string | null;
  garageInsulationIncluded: string | null;
  insulationAssemblies:
    | import('@/utils/estimateAiDraft').InsulationAssembly[]
    | null;
  planFacts?: ScopeMeasurements['planFacts'];
  quickMeasurementSources?: Record<string, string>;
  railingLf: number | null;
  baseboardLf: number | null;
  interiorDoorCount: number | null;
  cabinetPaintSqft: number | null;
  cabinetUpperLf: number | null;
  cabinetLowerLf: number | null;
  cabinetTallLf: number | null;
  cabinetRunLf: number | null;
  ceilingPaintSqft: number | null;
  paintAreaSqft: number | null;
  combinedPaintableAreaSqft: number | null;
  showerWallTileSqft: number | null;
  showerFloorTileSqft: number | null;
  wallPaintSqft: number | null;
  bathCount: number | null;
  prefabBathCount: number | null;
  tubBathCount: number | null;
  showerDoorCount: number | null;
  garageDoorSingleCount: number | null;
  garageDoorDoubleCount: number | null;
  garageDoorRvCount: number | null;
  garageDoorOpenerCount: number | null;
  framingOpeningCount: number | null;
  reframingRequested?: boolean | null;
  measurementProvenance?: Record<string, unknown>;
  measurementConflicts?: import('@/utils/estimateAiDraft').PlanMeasurementConflict[];
  itemQuantities: Record<string, ScopeItemQuantityValue>;
} & Partial<Record<ElectricalQuantityKey | PlumbingQuantityKey, number | null>>;

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
  measurementState?:
    | import('@/utils/measurementSemantics').ScopeMeasurementState
    | null;
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
  pricingMethod?:
    | 'unit_price'
    | 'material_labor'
    | 'lump_sum'
    | 'allowance'
    | 'equipment'
    | 'subcontractor';
  quantityType?: string;
  materialBucketLabel?: string;
  laborBucketLabel?: string;
  rateSource?: 'bps_national_benchmark' | 'bps_southern_utah_calibrated';
  rateSourceReference?: string;
  scopeProfileSource?: ScopeProfileSource;
  productionStatus?:
    | 'production_ready'
    | 'review_required'
    | 'fallback_only'
    | 'disabled';
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
  trim: {
    unit: 'lf',
    material: 2,
    labor: 6.5,
    sourceLabel:
      'Suggested budget split · National Average · baseboard install, prep & paint',
  },
  flooring: {
    unit: 'sqft',
    material: 4,
    labor: 5,
    sourceLabel: 'Suggested budget split · National Average',
  },
  flooring_lvp: {
    unit: 'sqft',
    material: 3.5,
    labor: 3.5,
    sourceLabel: 'Suggested budget split · National Average · LVP',
  },
  flooring_laminate: {
    unit: 'sqft',
    material: 2.5,
    labor: 3.25,
    sourceLabel: 'Suggested budget split · National Average · laminate',
  },
  flooring_engineered_hardwood: {
    unit: 'sqft',
    material: 5.5,
    labor: 5.5,
    sourceLabel:
      'Suggested budget split · National Average · engineered hardwood',
  },
  flooring_solid_hardwood: {
    unit: 'sqft',
    material: 6,
    labor: 7,
    sourceLabel: 'Suggested budget split · National Average · solid hardwood',
  },
  tile_flooring: {
    unit: 'sqft',
    material: 6,
    labor: 10,
    sourceLabel: 'Suggested budget split · National Average · floor tile',
  },
  flooring_carpet: {
    unit: 'sqft',
    material: 3.5,
    labor: 1.5,
    sourceLabel: 'Suggested budget split · National Average · carpet + pad',
  },
  flooring_sheet_vinyl: {
    unit: 'sqft',
    material: 2.5,
    labor: 2.5,
    sourceLabel: 'Suggested budget split · National Average · sheet vinyl',
  },
  lighting: {
    unit: 'each',
    material: 200,
    labor: 275,
    sourceLabel:
      'Suggested budget split · National Average · light fixture supply and installation',
  },
  floor_demo: {
    unit: 'sqft',
    material: 0.3,
    labor: 2.7,
    materialBucketLabel: 'Equipment, protection, haul-off & disposal',
    sourceLabel:
      'Suggested budget split · National Average planning estimate · flooring demolition',
  },
  underlayment: {
    unit: 'sqft',
    material: 0.75,
    labor: 0.75,
    sourceLabel:
      'Suggested budget split · National Average · standard underlayment',
  },
  moisture_barrier: {
    unit: 'sqft',
    material: 0.65,
    labor: 0.6,
    sourceLabel: 'Suggested budget split · National Average · vapor barrier',
  },
  transitions: {
    unit: 'each',
    material: 20,
    labor: 30,
    sourceLabel:
      'Suggested budget split · National Average · standard transition',
  },
  quarter_round: {
    unit: 'lf',
    material: 1.5,
    labor: 2.5,
    sourceLabel: 'Suggested budget split · National Average · quarter round',
  },
  backsplash_demo: {
    unit: 'sqft',
    material: 0.5,
    labor: 5,
    sourceLabel:
      'Suggested budget split · National Average · backsplash removal',
  },
  demo: {
    unit: 'sqft',
    material: 0.5,
    labor: 5,
    sourceLabel: 'Suggested budget split · National Average',
  },
  cabinet_hardware: {
    unit: 'each',
    material: 12,
    labor: 15,
    materialBucketLabel: 'Cabinet pull/knob materials',
    laborBucketLabel: 'Hardware layout, drilling & installation labor',
    sourceLabel: 'Suggested budget split · National Average · cabinet hardware',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'cabinets',
    category: 'finish_carpentry',
    pricingMethod: 'material_labor',
  },
  /**
   * Tile national planning benchmarks — distinct labor by subtype.
   * Checklist IDs (floor_tile, shower_tile, backsplash, …) alias into these keys.
   * rateSource: bps_national_benchmark · scopeProfileSource: bps_standard_assumption
   */
  floor_tile_standard: {
    unit: 'sqft',
    material: 8,
    labor: 11,
    sourceLabel:
      'Suggested budget split · National Average · standard floor tile',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'tile',
    pricingMethod: 'material_labor',
  },
  bath_floor_tile: {
    unit: 'sqft',
    material: 8,
    labor: 13,
    sourceLabel:
      'Suggested budget split · National Average · bathroom floor tile',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'tile',
    pricingMethod: 'material_labor',
  },
  wall_tile_dry_area: {
    unit: 'sqft',
    material: 8,
    labor: 15,
    sourceLabel:
      'Suggested budget split · National Average · dry-area wall tile',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'tile',
    pricingMethod: 'material_labor',
  },
  backsplash_tile: {
    unit: 'sqft',
    material: 8,
    labor: 17,
    sourceLabel:
      'Suggested budget split · National Average · kitchen backsplash tile',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'tile',
    pricingMethod: 'material_labor',
  },
  shower_wall_tile: {
    unit: 'sqft',
    material: 8,
    labor: 18,
    sourceLabel: 'Suggested budget split · National Average · shower wall tile',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'tile',
    pricingMethod: 'material_labor',
  },
  /**
   * Shower floor tile-setting only (~$30/SF mid-market). Pan, waterproofing,
   * and mud bed are separate — prior $31/SF overstated tile-only work.
   */
  shower_floor_tile: {
    unit: 'sqft',
    material: 9,
    labor: 21,
    sourceLabel:
      'Suggested budget split · National Average · shower floor tile',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'tile',
    pricingMethod: 'material_labor',
  },
  /**
   * Standard sliding shower door installed (door only). Scales with showerDoorCount.
   * Retail door kits ~$700–$1,200; installed mid-market ~$1,200–$1,900/door.
   * Premium frameless is priced via bathroomGlassDoorPricing tier resolver.
   */
  glass_door: {
    unit: 'each',
    material: 835,
    labor: 615,
    sourceLabel:
      'Suggested budget split · National Average · shower door installed (standard slider)',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'glazing',
    category: 'wet_area',
    pricingMethod: 'material_labor',
  },
  /**
   * Tile mud pan build (~$99/SF · ~$1,485 at 15 SF typical shower floor). Liner, drain,
   * mud-bed materials, and entry curb scale with pan area — curb frame labor is ~1 hr, not a bench.
   */
  tile_shower_pan: {
    unit: 'sqft',
    material: 27,
    labor: 72,
    materialBucketLabel: 'Pan liner, drain, mud & curb lumber',
    laborBucketLabel: 'Mud pan build & curb frame labor',
    sourceLabel:
      'Suggested budget split · National Average · shower mud pan build + entry curb',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'wet_area',
    pricingMethod: 'material_labor',
  },
  prefab_shower_pan: {
    unit: 'each',
    material: 400,
    labor: 600,
    materialBucketLabel: 'Prefab shower pan / base materials',
    laborBucketLabel: 'Prefab shower pan install labor',
    sourceLabel:
      'Suggested budget split · National Average · prefab shower pan',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'wet_area',
    pricingMethod: 'material_labor',
  },
  shower_bench: {
    unit: 'each',
    material: 350,
    labor: 650,
    materialBucketLabel: 'Shower bench materials & tile',
    laborBucketLabel: 'Shower bench build & tile labor',
    sourceLabel:
      'Suggested budget split · National Average · shower bench (not entry curb)',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'wet_area',
    pricingMethod: 'material_labor',
  },
  shower_niche: {
    unit: 'each',
    material: 275,
    labor: 450,
    materialBucketLabel: 'Niche kit / backer / tile materials',
    laborBucketLabel: 'Niche frame, waterproof & tile labor',
    sourceLabel: 'Suggested budget split · National Average · shower niche',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'tile',
    category: 'wet_area',
    pricingMethod: 'material_labor',
  },
  tub: {
    unit: 'each',
    material: 1200,
    labor: 850,
    materialBucketLabel: 'Tub / surround materials',
    laborBucketLabel: 'Tub install labor',
    sourceLabel: 'Suggested budget split · National Average · tub install',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'plumbing',
    category: 'wet_area',
    pricingMethod: 'material_labor',
  },
  toilet: {
    unit: 'each',
    material: 425,
    labor: 475,
    materialBucketLabel: 'Toilet & rough-in materials',
    laborBucketLabel: 'Toilet install labor',
    sourceLabel: 'Suggested budget split · National Average · toilet install',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'plumbing',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
  vanity: {
    unit: 'each',
    material: 650,
    labor: 450,
    materialBucketLabel: 'Vanity cabinet materials',
    laborBucketLabel: 'Vanity install labor',
    sourceLabel:
      'Suggested budget split · National Average · vanity cabinet install',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'cabinets',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
  cabinet_hardware: {
    unit: 'each',
    material: 12,
    labor: 15,
    materialBucketLabel: 'Cabinet pull/knob materials',
    laborBucketLabel: 'Hardware layout, drilling & installation labor',
    sourceLabel: 'Suggested budget split · National Average · cabinet hardware',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'cabinets',
    category: 'finish_carpentry',
    pricingMethod: 'material_labor',
  },
  sink_faucet: {
    unit: 'each',
    material: 325,
    labor: 475,
    materialBucketLabel: 'Sink & faucet materials',
    laborBucketLabel: 'Sink & faucet install labor',
    sourceLabel:
      'Suggested budget split · National Average · sink & faucet install',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'plumbing',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
  garbage_disposal: {
    unit: 'each',
    material: 185,
    labor: 215,
    materialBucketLabel: 'Disposal unit materials',
    laborBucketLabel: 'Disposal replace/install labor',
    sourceLabel:
      'Suggested budget split · National Average · garbage disposal replace/install',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'plumbing',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
  vanity_demo: {
    unit: 'each',
    material: 25,
    labor: 200,
    materialBucketLabel: 'Disposal / protection materials',
    laborBucketLabel: 'Vanity demo & haul labor',
    sourceLabel:
      'Suggested budget split · National Average · vanity cabinet removal',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'demo',
    category: 'demo',
    pricingMethod: 'material_labor',
  },
  countertop_demo: {
    unit: 'each',
    material: 0,
    labor: 175,
    laborBucketLabel: 'Countertop demo & haul labor',
    sourceLabel:
      'Suggested budget split · National Average · countertop removal',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'demo',
    category: 'demo',
    pricingMethod: 'material_labor',
  },
  backsplash_demo: {
    category: 'demolition',
    rootCause:
      'Backsplash demolition is modeled as tile removal, light adhesive scraping, and loading; wall repair and disposal fees are separate.',
    assumptions: [
      assumption(
        'removal',
        'included',
        'Backsplash removal',
        'Remove existing backsplash tile and light adhesive scraping.'
      ),
      assumption(
        'loading',
        'included',
        'Loading debris',
        'Load removed backsplash debris for disposal.'
      ),
      assumption(
        'wall_repair',
        'excluded',
        'Wall repair',
        'Drywall repair or substrate replacement is separate.'
      ),
      assumption(
        'dump_fees',
        'excluded',
        'Dump fees',
        'Dump fees and disposal facility charges are separate.'
      ),
    ],
  },
  plumbing_trim: {
    unit: 'allowance',
    material: 150,
    labor: 300,
    materialBucketLabel: 'Trim-out supplies',
    laborBucketLabel: 'Fixture hookup labor',
    sourceLabel:
      'Suggested budget split · National Average · plumbing trim-out hookups (non-bath fallback)',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'plumbing',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
  mirror_accessories: {
    unit: 'allowance',
    material: 200,
    labor: 175,
    materialBucketLabel: 'Accessories allowance',
    laborBucketLabel: 'Install labor',
    sourceLabel:
      'Suggested budget split · National Average · bath accessories allowance',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'general',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
  exhaust_fan: {
    unit: 'each',
    material: 150,
    labor: 275,
    materialBucketLabel: 'Exhaust fan & vent materials',
    laborBucketLabel: 'Exhaust fan install labor',
    sourceLabel: 'Suggested budget split · National Average · bath exhaust fan',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'electrical',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
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
  ceiling_paint: {
    unit: 'sqft',
    material: 0.85,
    labor: 2.5,
    sourceLabel: 'Suggested · National Average · ceiling surface sqft',
  },
  prep: {
    unit: 'sqft',
    material: 0.2,
    labor: 0.8,
    sourceLabel:
      'Suggested · National Average · protection, masking, and standard surface prep',
  },
  door_paint: {
    unit: 'each',
    material: 20,
    labor: 105,
    sourceLabel:
      'Suggested · National Average · interior door slab, edges, and frame paint',
  },
  cabinet_paint: {
    unit: 'lf',
    material: 13.333333,
    labor: 41.666667,
    sourceLabel: 'Suggested · National Average · cabinet run length',
  },
  exterior_prep: {
    unit: 'sqft',
    material: 0.15,
    labor: 0.65,
    sourceLabel: 'Suggested · National Average · exterior prep and masking',
  },
  exterior_paint: {
    unit: 'sqft',
    material: 0.9,
    labor: 2.25,
    sourceLabel:
      'Suggested · National Average · exterior/stucco paint (mid-market)',
    rateSource: 'bps_national_benchmark',
    scopeProfileSource: 'bps_standard_assumption',
    productionStatus: 'review_required',
    geographicBasis: 'national',
    trade: 'paint',
    category: 'paint',
    pricingMethod: 'material_labor',
  },
  /** Fallback only; flooring template pricing uses the selected prep level and minimum. */
  floor_prep: {
    unit: 'sqft',
    material: 0.75,
    labor: 1.75,
    sourceLabel: 'Suggested · National Average · selected floor-prep level',
  },
  waterproofing: {
    unit: 'sqft',
    material: 5,
    labor: 7,
    sourceLabel:
      'Suggested budget split · National Average · backer + membrane assembly',
  },
  electrical_rough: {
    unit: 'each',
    material: 50,
    labor: 125,
    sourceLabel:
      'Suggested budget split · National Average · per circuit/device',
  },
  plumbing_rough: {
    unit: 'each',
    material: 150,
    labor: 350,
    sourceLabel:
      'Suggested budget split · National Average · per rough-in point',
  },
  plumbing: {
    unit: 'each',
    material: 100,
    labor: 200,
    sourceLabel:
      'Suggested budget split · National Average · per plumbing connection',
  },
  service_call: {
    unit: 'each',
    material: 0,
    labor: 250,
    sourceLabel:
      'Suggested budget split · National Average · plumbing service call',
    trade: 'plumbing',
    category: 'service',
    pricingMethod: 'material_labor',
  },
  fixture_repair: {
    unit: 'each',
    material: 50,
    labor: 250,
    sourceLabel:
      'Suggested budget split · National Average · plumbing fixture repair',
    trade: 'plumbing',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
  fixture_replace: {
    unit: 'each',
    material: 100,
    labor: 200,
    sourceLabel:
      'Suggested budget split · National Average · plumbing fixture setting at documented rough',
    trade: 'plumbing',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
  drain_cleaning: {
    unit: 'each',
    material: 25,
    labor: 275,
    sourceLabel:
      'Suggested budget split · National Average · plumbing drain cleaning',
    trade: 'plumbing',
    category: 'service',
    pricingMethod: 'material_labor',
  },
  water_line: {
    unit: 'lf',
    material: 8,
    labor: 22,
    sourceLabel:
      'Suggested budget split · National Average · water-supply line',
    trade: 'plumbing',
    category: 'lines',
    pricingMethod: 'material_labor',
  },
  sewer_line: {
    unit: 'lf',
    material: 12,
    labor: 38,
    sourceLabel: 'Suggested budget split · National Average · sewer/drain line',
    trade: 'plumbing',
    category: 'lines',
    pricingMethod: 'material_labor',
  },
  gas_line: {
    unit: 'lf',
    material: 10,
    labor: 20,
    sourceLabel:
      'Suggested budget split · National Average · documented gas piping',
    trade: 'plumbing',
    category: 'lines',
    pricingMethod: 'material_labor',
  },
  plumbing_fixtures_hardware: {
    unit: 'each',
    material: 280,
    labor: 0,
    materialBucketLabel: 'Fixture & hardware allowance',
    laborBucketLabel: 'Install labor',
    sourceLabel:
      'Suggested budget split · National Average · builder-grade fixture product allowance',
    trade: 'plumbing',
    category: 'fixtures',
    pricingMethod: 'material_labor',
  },
  water_heater: {
    unit: 'each',
    material: 1200,
    labor: 800,
    sourceLabel:
      'Suggested budget split · National Average · tank water heater supply and set',
    trade: 'plumbing',
    category: 'equipment',
    pricingMethod: 'material_labor',
  },
  gas_appliance_connections: {
    unit: 'each',
    material: 75,
    labor: 150,
    sourceLabel:
      'Suggested budget split · National Average · gas appliance hookup at documented stub',
    trade: 'plumbing',
    category: 'lines',
    pricingMethod: 'material_labor',
  },
  railing: {
    unit: 'lf',
    material: 15,
    labor: 25,
    sourceLabel: 'Suggested budget split · National Average',
  },
  pour_flatwork: {
    unit: 'sqft',
    material: 4,
    labor: 6,
    sourceLabel: 'National average · Standard flatwork · 4 in base',
  },
  concrete: {
    unit: 'sqft',
    material: 4,
    labor: 6,
    sourceLabel: 'National planning rate · Concrete flatwork',
  },
  complex_forming: {
    unit: 'lf',
    material: 4,
    labor: 2,
    sourceLabel: 'National average · Complex forming · additional LF',
  },
  reinforcement: {
    unit: 'sqft',
    material: 1,
    labor: 0.75,
    sourceLabel: 'National planning rate · Rebar / mesh',
  },
  concrete_sealer: {
    unit: 'sqft',
    material: 0.6,
    labor: 0.9,
    sourceLabel: 'National average · Concrete sealer · optional upgrade',
  },
  decorative_finish: {
    unit: 'sqft',
    material: 1.5,
    labor: 0,
    sourceLabel: 'National average · Integral color · optional upgrade',
  },
  additional_haul_off: {
    unit: 'load',
    material: 300,
    labor: 100,
    sourceLabel: 'National average · Additional haul-off / disposal · per load',
  },
  concrete_demo: {
    unit: 'sqft',
    material: 1.5,
    labor: 2.5,
    materialBucketLabel: 'Equipment & disposal',
    sourceLabel:
      'National average · Concrete demo / removal · normal disposal included',
  },
  drywall: {
    unit: 'sqft',
    // New-construction hang/finish band (~$2.10/SF). Prior $4.50/SF made living×3.5
    // planning qty price ~$34k on Plan 39 vs SHV H41 ~$22.5k.
    material: 0.85,
    labor: 1.25,
    sourceLabel: 'Suggested · National Average · wall/ceiling surface sqft',
  },
  decking: {
    unit: 'sqft',
    material: 8,
    labor: 12,
    sourceLabel: 'Suggested budget split · National Average',
  },
  countertops: {
    unit: 'sqft',
    material: 35,
    labor: 25,
    sourceLabel: 'Suggested budget split · National Average',
  },
  cabinets: {
    unit: 'lf',
    material: 250,
    labor: 90,
    sourceLabel:
      'Suggested budget split · National Average · standard semi-custom cabinet benchmark',
  },
  /**
   * New-construction shingle roof (mat + install). Anchored near NAHB 2024 roofing
   * package (~$16.7k on the survey home) rather than a full re-roof mid (~$800/sq),
   * which was pulling Plan 41–sized planning bids to ~$20k.
   */
  shingles_roofing: {
    unit: 'squares',
    material: 250,
    labor: 325,
    sourceLabel:
      'Suggested budget split · National Average · new-construction roofing',
  },
  decking_repair: {
    unit: 'sqft',
    material: 2,
    labor: 3,
    sourceLabel:
      'BPS national planning rate · standard roof decking replacement',
  },
  drip_edge: {
    unit: 'lf',
    material: 1.5,
    labor: 2.5,
    sourceLabel: 'BPS national planning rate · drip-edge replacement/add-on',
  },
  ridge_cap: {
    unit: 'lf',
    material: 2.5,
    labor: 4.5,
    sourceLabel: 'BPS national planning rate · ridge-cap replacement/add-on',
  },
  valley_flashing: {
    unit: 'lf',
    material: 3.5,
    labor: 6.5,
    sourceLabel: 'BPS national planning rate · valley flashing',
  },
  step_flashing: {
    unit: 'lf',
    material: 4,
    labor: 8,
    sourceLabel: 'BPS national planning rate · step flashing',
  },
  wall_flashing: {
    unit: 'lf',
    material: 3.5,
    labor: 6.5,
    sourceLabel: 'BPS national planning rate · wall flashing',
  },
  ridge_vent: {
    unit: 'each',
    material: 4,
    labor: 8,
    sourceLabel: 'BPS national planning rate · ridge vent',
  },
  roof_vents: {
    unit: 'each',
    material: 75,
    labor: 150,
    sourceLabel: 'BPS national planning rate · standard roof vent',
  },
  turbine_vents: {
    unit: 'each',
    material: 100,
    labor: 200,
    sourceLabel: 'BPS national planning rate · turbine vent',
  },
  pipe_boots: {
    unit: 'each',
    material: 50,
    labor: 125,
    sourceLabel: 'BPS national planning rate · pipe boot',
  },
  chimney_flashing: {
    unit: 'each',
    material: 250,
    labor: 400,
    sourceLabel: 'BPS national planning rate · chimney flashing',
  },
  skylight_flashing: {
    unit: 'each',
    material: 200,
    labor: 300,
    sourceLabel: 'BPS national planning rate · skylight flashing',
  },
  roof_penetrations: {
    unit: 'each',
    material: 75,
    labor: 125,
    sourceLabel: 'BPS national planning rate · other roof penetration',
  },
  gutters: {
    unit: 'lf',
    material: 4,
    labor: 6,
    sourceLabel:
      'BPS national planning rate · standard seamless aluminum gutters',
  },
  downspouts: {
    unit: 'each',
    material: 50,
    labor: 75,
    sourceLabel: 'BPS national planning rate · standard aluminum downspouts',
  },
  stucco: {
    unit: 'sqft',
    material: 3.25,
    labor: 4.25,
    sourceLabel:
      'BPS national planning rate · 3-coat traditional stucco complete system',
  },
  stucco_wrb: {
    unit: 'sqft',
    material: 0.35,
    labor: 0.3,
    sourceLabel: 'BPS national planning rate · stucco WRB / building paper',
  },
  stucco_lath: {
    unit: 'sqft',
    material: 0.7,
    labor: 0.8,
    sourceLabel: 'BPS national planning rate · expanded metal lath',
  },
  stucco_base_coat: {
    unit: 'sqft',
    material: 1.5,
    labor: 2,
    sourceLabel: 'BPS national planning rate · scratch and brown coats',
  },
  stucco_finish_coat: {
    unit: 'sqft',
    material: 0.7,
    labor: 0.85,
    sourceLabel: 'BPS national planning rate · standard finish coat',
  },
  stucco_foam_trim: {
    unit: 'lf',
    material: 3.5,
    labor: 5,
    sourceLabel:
      'BPS national planning rate · basic architectural foam trim / bands',
  },
  stucco_accessories: {
    unit: 'allowance',
    material: 650,
    labor: 850,
    sourceLabel:
      'National planning allowance · stucco accessories and flashing details',
  },
  stucco_soffits: {
    unit: 'sqft',
    material: 3.25,
    labor: 5.25,
    sourceLabel: 'BPS national planning rate · stucco soffit / ceiling',
  },
  stucco_parapets: {
    unit: 'sqft',
    material: 0,
    labor: 0,
    sourceLabel:
      'BPS planning rate · separate parapet stucco uses selected system rate',
  },
  stucco_access: {
    unit: 'allowance',
    material: 500,
    labor: 1500,
    sourceLabel:
      'National planning allowance · access / scaffolding review required',
  },
  stucco_repairs: {
    unit: 'allowance',
    material: 500,
    labor: 1000,
    sourceLabel: 'Planning allowance · substrate repair review required',
  },
  tear_off: {
    unit: 'squares',
    material: 50,
    labor: 200,
    sourceLabel: 'Suggested budget split · National Average',
  },
  pavers: {
    unit: 'sqft',
    material: 6,
    labor: 9,
    sourceLabel: 'National planning rate · Pavers',
  },
  demo_clearing: {
    unit: 'sqft',
    material: 0.4,
    labor: 1.1,
    materialBucketLabel: 'Equipment, haul-off & disposal',
    sourceLabel:
      'National planning rate · Demo / clearing · normal haul-off included',
  },
  grading: {
    unit: 'sqft',
    material: 0.35,
    labor: 0.9,
    materialBucketLabel: 'Grading equipment',
    sourceLabel: 'National planning rate · Grading',
  },
  soil_prep: {
    unit: 'sqft',
    material: 0.65,
    labor: 0.85,
    sourceLabel: 'National planning rate · Soil prep',
  },
  sod_turf: {
    unit: 'sqft',
    material: 0.85,
    labor: 0.9,
    sourceLabel: 'National planning rate · Sod',
  },
  artificial_turf: {
    unit: 'sqft',
    material: 8.5,
    labor: 7.5,
    sourceLabel:
      'National planning rate · Artificial turf · normal base included',
  },
  rock: {
    unit: 'sqft',
    material: 1.9,
    labor: 0.85,
    sourceLabel: 'National planning rate · Decorative rock · 3 inch depth',
  },
  mulch: {
    unit: 'sqft',
    material: 0.35,
    labor: 0.25,
    sourceLabel: 'National planning rate · Mulch',
  },
  plants: {
    unit: 'each',
    material: 35,
    labor: 30,
    sourceLabel: 'National planning rate · Plants / shrubs',
  },
  trees: {
    unit: 'each',
    material: 250,
    labor: 200,
    sourceLabel: 'National planning rate · Standard landscape tree',
  },
  /** @deprecated Use `rock` or `mulch` — kept for legacy draft pricing. */
  rock_mulch: {
    unit: 'sqft',
    material: 1.9,
    labor: 0.85,
    sourceLabel: 'National planning rate · Decorative rock · 3 inch depth',
  },
  /** @deprecated Use `plants` or `trees` — kept for legacy draft pricing. */
  plants_trees: {
    unit: 'each',
    material: 35,
    labor: 30,
    sourceLabel: 'National planning rate · Plants / shrubs',
  },
  irrigation: {
    unit: 'zone',
    material: 650,
    labor: 600,
    sourceLabel: 'National planning rate · Sprinkler irrigation',
  },
  landscape_lighting: {
    unit: 'each',
    material: 90,
    labor: 60,
    sourceLabel: 'National planning rate · Landscape lighting',
  },
  concrete_edging: {
    unit: 'lf',
    material: 4,
    labor: 6,
    sourceLabel: 'National planning rate · Concrete edging',
  },
  drainage: {
    unit: 'lf',
    material: 10,
    labor: 12,
    sourceLabel: 'National planning rate · Drainage · review unusual systems',
  },
  landscape_boulders: {
    unit: 'each',
    material: 250,
    labor: 150,
    sourceLabel:
      'National planning rate · Standard / medium boulder · review before bid',
  },
  mobilization: {
    unit: 'allowance',
    material: 750,
    labor: 0,
    sourceLabel:
      'National planning rate · EXTRA project-level mobilization · review before bid',
  },
  permits: {
    unit: 'allowance',
    material: 0,
    labor: 3500,
    sourceLabel: 'National planning rate · Permit allowance',
  },
  cleanup: {
    unit: 'allowance',
    material: 450,
    labor: 550,
    sourceLabel:
      'National planning rate · EXTRA cleanup / haul-off / disposal · review before bid',
  },
  // Appliance install is job-specific — never auto-suggest a national average allowance.
  // Contingency is job-specific — never auto-suggest a national average allowance.
  haul_off: {
    unit: 'lump_sum',
    material: 450,
    labor: 550,
    sourceLabel:
      'Suggested budget split · National Average · dumpster/disposal + haul labor',
  },
  /**
   * Framing national planning on applicable framed/covered SF (living + garage).
   * Labor band ~$5–$10/framed SF (mid $7.50); material is package lumber+trusses planning.
   * Do not treat $18/living SF as a national labor default.
   */
  framing: {
    unit: 'sqft',
    material: 10,
    labor: 7.5,
    sourceLabel: 'Suggested budget split · National Average · framing/shell',
  },
  shear_sheathing: {
    unit: 'sqft',
    material: 2.5,
    labor: 2,
    sourceLabel:
      'Suggested budget split · National Average · wall/roof sheathing',
  },
  wall_framing: {
    unit: 'lf',
    material: 4,
    labor: 8,
    sourceLabel:
      'Suggested budget split · National Average · stud wall framing',
  },
  openings: {
    unit: 'each',
    material: 85,
    labor: 165,
    sourceLabel:
      'Suggested budget split · National Average · rough opening framing',
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
  site_prep: {
    unit: 'sqft',
    material: 0.75,
    labor: 1.25,
    sourceLabel:
      'National planning rate · Basic subgrade prep / grading · $2.00/sqft',
  },
  excavation: {
    unit: 'cy',
    material: 34,
    labor: 51,
    sourceLabel:
      'National planning rate · Excavation / soil movement · volume-based tiered planning rates',
  },
  pour_foundation: {
    unit: 'cy',
    material: 165,
    labor: 185,
    sourceLabel:
      'National planning rate · Footing / foundation concrete pour · $350/CY',
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
  'appliances',
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
    !PLACEHOLDER_ALLOWANCE_ITEM_IDS.includes(
      itemId as (typeof PLACEHOLDER_ALLOWANCE_ITEM_IDS)[number]
    )
  ) {
    return false;
  }
  if (quantity == null || !Number.isFinite(Number(quantity))) return false;
  const normalizedUnit = String(unit || '').toLowerCase();
  if (normalizedUnit !== 'allowance' && normalizedUnit !== 'lump_sum')
    return false;
  return Number(quantity) === 1;
}

const NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT: Record<
  string,
  Record<string, NationalAverageBudgetSplit>
> = {
  plumbing: {
    each: NATIONAL_AVERAGE_BUDGET_SPLITS.plumbing,
  },
  wall_framing: {
    lf: NATIONAL_AVERAGE_BUDGET_SPLITS.wall_framing,
  },
  openings: {
    each: NATIONAL_AVERAGE_BUDGET_SPLITS.openings,
  },
  shear_sheathing: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.shear_sheathing,
  },
  framing: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.framing,
  },
  backsplash_demo: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.backsplash_demo,
  },
  lighting: {
    each: NATIONAL_AVERAGE_BUDGET_SPLITS.lighting,
  },
  concrete: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.concrete,
    cy: {
      unit: 'cy',
      material: 165,
      labor: 185,
      sourceLabel: 'Suggested budget split · National Average',
    },
  },
  pour_flatwork: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.pour_flatwork,
    cy: {
      unit: 'cy',
      material: 165,
      labor: 185,
      sourceLabel: 'National planning rate · Footings / foundation',
    },
  },
  pour_foundation: {
    cy: NATIONAL_AVERAGE_BUDGET_SPLITS.pour_foundation,
  },
  complex_forming: {
    lf: NATIONAL_AVERAGE_BUDGET_SPLITS.complex_forming,
  },
  reinforcement: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.reinforcement,
  },
  concrete_sealer: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.concrete_sealer,
  },
  decorative_finish: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.decorative_finish,
  },
  additional_haul_off: {
    load: NATIONAL_AVERAGE_BUDGET_SPLITS.additional_haul_off,
  },
  site_prep: {
    sqft: NATIONAL_AVERAGE_BUDGET_SPLITS.site_prep,
  },
  excavation: {
    cy: NATIONAL_AVERAGE_BUDGET_SPLITS.excavation,
    sqft: {
      unit: 'sqft',
      material: 0.5,
      labor: 2.5,
      sourceLabel: 'Suggested budget split · National Average',
    },
    lf: {
      unit: 'lf',
      material: 1,
      labor: 8,
      sourceLabel: 'Suggested budget split · National Average',
    },
  },
  hvac: {
    each: {
      unit: 'each',
      // National production/new-construction planning baseline for one
      // complete installed system. Multi-system package pricing is resolved
      // by the HVAC package model with a shared-mobilization adjustment.
      material: 6200,
      labor: 4300,
      sourceLabel:
        'Suggested budget split · National Average · per HVAC system',
    },
    ton: {
      unit: 'ton',
      material: 2800,
      labor: 2200,
      sourceLabel: 'Suggested budget split · National Average · per ton',
    },
    // Retained for legacy pricing reads; HVAC takeoff rules no longer seed
    // this unit from living area.
    sqft: {
      unit: 'sqft',
      material: 4.5,
      labor: 6,
      sourceLabel: 'Suggested budget split · National Average · legacy HVAC sqft',
    },
  },
  ductwork: {
    lf: {
      unit: 'lf',
      material: 4.5,
      labor: 8.5,
      sourceLabel:
        'Suggested budget split · National Average · HVAC ductwork per LF',
    },
  },
  supply_registers: {
    each: {
      unit: 'each',
      material: 85,
      labor: 65,
      sourceLabel:
        'Suggested budget split · National Average · per supply register',
    },
  },
  return_grilles: {
    each: {
      unit: 'each',
      material: 75,
      labor: 55,
      sourceLabel:
        'Suggested budget split · National Average · per return grille',
    },
  },
  equipment_replace: {
    each: {
      unit: 'each',
      material: 5500,
      labor: 3500,
      sourceLabel:
        'Suggested budget split · National Average · HVAC equipment replacement',
    },
  },
  furnace: {
    each: {
      unit: 'each',
      material: 3800,
      labor: 2200,
      sourceLabel:
        'Suggested budget split · National Average · furnace replacement',
    },
  },
  condenser: {
    each: {
      unit: 'each',
      material: 3900,
      labor: 2100,
      sourceLabel:
        'Suggested budget split · National Average · condenser replacement',
    },
  },
  heat_pump: {
    each: {
      unit: 'each',
      material: 5500,
      labor: 3000,
      sourceLabel:
        'Suggested budget split · National Average · heat-pump replacement',
    },
  },
  mini_split: {
    each: {
      unit: 'each',
      material: 5000,
      labor: 2500,
      sourceLabel:
        'Suggested budget split · National Average · mini-split replacement',
    },
  },
  air_handler: {
    each: {
      unit: 'each',
      material: 3500,
      labor: 2000,
      sourceLabel:
        'Suggested budget split · National Average · air-handler replacement',
    },
  },
  thermostat: {
    each: {
      unit: 'each',
      material: 175,
      labor: 225,
      sourceLabel:
        'Suggested budget split · National Average · thermostat supply and install',
    },
  },
  ventilation: {
    each: {
      unit: 'each',
      material: 2000,
      labor: 1500,
      sourceLabel:
        'Suggested budget split · National Average · ERV/HRV whole-house ventilation',
    },
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
      sourceLabel:
        'Suggested budget split · National Average · openings per living SF',
    },
  },
  windows: {
    each: EXTERIOR_OPENING_NATIONAL_RATES.windows,
    sqft: EXTERIOR_OPENING_NATIONAL_RATES.windows_sqft,
  },
  exterior_doors: {
    each: EXTERIOR_OPENING_NATIONAL_RATES.exterior_doors,
  },
  sliding_doors: {
    each: EXTERIOR_OPENING_NATIONAL_RATES.sliding_doors,
  },
  interior_doors: {
    each: {
      unit: 'each',
      material: 180,
      labor: 170,
      sourceLabel:
        'Suggested budget split · National Average · interior prehung door (builder grade)',
    },
  },
  trim_finish: {
    lf: {
      unit: 'lf',
      material: 2.75,
      labor: 3.5,
      sourceLabel:
        'Suggested budget split · National Average · paint-grade opening casing · install only',
    },
  },
  garage_door_openers: {
    each: {
      unit: 'each',
      material: 350,
      labor: 200,
      sourceLabel:
        'Suggested budget split · National Average · garage door opener',
    },
  },
  plumbing_rough: {
    each: NATIONAL_AVERAGE_BUDGET_SPLITS.plumbing_rough,
    sqft: {
      unit: 'sqft',
      material: 3.3,
      labor: 7.7,
      sourceLabel:
        'Suggested budget split · National Average · plumbing rough per living SF',
    },
  },
  plumbing_trim: {
    each: {
      unit: 'each',
      material: 150,
      labor: 300,
      sourceLabel:
        'Suggested budget split · National Average · per plumbing trim hookup',
    },
    allowance: NATIONAL_AVERAGE_BUDGET_SPLITS.plumbing_trim,
  },
  electrical_rough: {
    each: NATIONAL_AVERAGE_BUDGET_SPLITS.electrical_rough,
    sqft: {
      unit: 'sqft',
      material: 3.2,
      labor: 7.8,
      sourceLabel:
        'Suggested budget split · National Average · electrical rough per living SF',
    },
  },
};

const HVAC_EQUIPMENT_REPLACEMENT_RATES: Record<
  string,
  { material: number; labor: number; label: string }
> = {
  furnace: {
    material: 3800,
    labor: 2200,
    label: 'furnace replacement',
  },
  condenser: {
    material: 3900,
    labor: 2100,
    label: 'condenser replacement',
  },
  heat_pump: {
    material: 5500,
    labor: 3000,
    label: 'heat-pump replacement',
  },
  mini_split: {
    material: 5000,
    labor: 2500,
    label: 'mini-split replacement',
  },
  air_handler: {
    material: 3500,
    labor: 2000,
    label: 'air-handler replacement',
  },
};

/**
 * Tile checklist / parser IDs → distinct national rate + profile keys.
 * Ambiguous bare "tile" must not silently become shower tile (handled in parsers).
 */
export const TILE_NATIONAL_AVERAGE_ALIASES: Record<string, string> = {
  /** Existing bathroom checklist id for bath floor tile. */
  floor_tile: 'bath_floor_tile',
  bathroom_floor_tile: 'bath_floor_tile',
  bath_floor: 'bath_floor_tile',
  /** Generic / dry-area floor tile (non-bath). */
  tile_floor: 'floor_tile_standard',
  floor_tile_standard: 'floor_tile_standard',
  /** Dry-area wall tile — not shower unless shower context is explicit. */
  wall_tile: 'wall_tile_dry_area',
  wall_tile_dry: 'wall_tile_dry_area',
  dry_wall_tile: 'wall_tile_dry_area',
  /** Kitchen backsplash checklist id. */
  backsplash: 'backsplash_tile',
  backsplash_tile: 'backsplash_tile',
  /** Existing shower wall checklist id. */
  shower_tile: 'shower_wall_tile',
  shower_wall: 'shower_wall_tile',
  shower_wall_tile: 'shower_wall_tile',
  /** Shower floor has its own rate band (not wall). */
  shower_floor: 'shower_floor_tile',
  shower_floor_tile: 'shower_floor_tile',
};

const NATIONAL_AVERAGE_BUDGET_SPLIT_ALIASES: Record<string, string> = {
  hang: 'drywall',
  finish_tape: 'drywall',
  patch_repair: 'drywall',
  /** Ground-up foundation CY uses the concrete CY national band. */
  foundation: 'concrete',
  pour_foundation: 'concrete',
  /** Ground-up roofing squares use the shingles national band. */
  roofing: 'shingles_roofing',
  roof_tie_in: 'shingles_roofing',
  /** Ground-up paint & trim surface SF uses interior paint rates. */
  paint_trim: 'paint',
  /** Combined tile & flooring line uses the flooring $/SF band. */
  tile_flooring: 'flooring',
  /** AI draft / planning key → checklist id. */
  shower_door: 'glass_door',
  shower_pan: 'tile_shower_pan',
  tub_install: 'tub',
  shower_bench_curb: 'shower_bench',
  ...TILE_NATIONAL_AVERAGE_ALIASES,
};

/** Resolve checklist/parser tile ids to the canonical national tile rate key. */
export function canonicalTileScopeKey(itemId: string): string {
  return TILE_NATIONAL_AVERAGE_ALIASES[itemId] || itemId;
}

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
      assumption(
        'excavation',
        'included',
        'Base excavation',
        'Excavation of the measured quantity is included.'
      ),
      assumption(
        'equipment',
        'included',
        'Standard excavation equipment',
        'Typical machine cost is embedded in the rate.',
        { impact: 'medium' }
      ),
      assumption(
        'operator',
        'included',
        'Operator labor',
        'Operator labor for base excavation is included in the labor rate.',
        { impact: 'medium' }
      ),
      assumption(
        'haul_off',
        'excluded',
        'Haul-off / export',
        'Offsite export is not included in this base excavation suggestion.'
      ),
      assumption(
        'dump_fees',
        'excluded',
        'Dump fees',
        'Disposal facility fees are not included in this base excavation suggestion.'
      ),
      assumption(
        'backfill',
        'excluded',
        'Backfill',
        'Backfill placement or imported fill should be priced separately unless intentionally included.'
      ),
      assumption(
        'compaction',
        'excluded',
        'Compaction',
        'Placement, moisture conditioning, and compaction are not included.'
      ),
      assumption(
        'shoring',
        'excluded',
        'Shoring',
        'Shoring is condition-dependent and not included in this base excavation suggestion.'
      ),
    ],
  },
  concrete: {
    category: 'concrete',
    rootCause:
      'Build Profit national-average standard flatwork includes concrete, delivery, placement, basic forming, finishing, curing, and normal cleanup; reinforcement and unusual work are separate scopes.',
    assumptions: [
      assumption(
        'concrete_material',
        'included',
        'Ready-mix concrete',
        'Standard ready-mix material and delivery allowance are included.'
      ),
      assumption(
        'concrete_placement',
        'included',
        'Concrete placement',
        'Base concrete placement for the measured quantity is included.'
      ),
      assumption(
        'basic_forming',
        'included',
        'Basic perimeter forming',
        'Straight perimeter forming, screeding, and floating are included.'
      ),
      assumption(
        'finishing',
        'included',
        'Basic finishing and curing',
        'Standard broom/basic finish and normal curing are included.'
      ),
      assumption(
        'cleanup',
        'included',
        'Normal cleanup',
        'Normal jobsite cleanup is included.'
      ),
      assumption(
        'pumping',
        'excluded',
        'Concrete pumping',
        'Pump truck or special placement equipment is not included.'
      ),
      assumption(
        'reinforcement',
        'excluded',
        'Reinforcement',
        'Rebar, mesh, chairs, and related reinforcement are not included unless priced separately.'
      ),
      assumption(
        'sawcutting',
        'excluded',
        'Sawcutting',
        'Sawcut control joints are not included in this base concrete suggestion.'
      ),
      assumption(
        'complex_forming',
        'excluded',
        'Complex forming',
        'Curves, steps, isolated pours, thickened edges, and unusual formwork are not included.'
      ),
    ],
  },
  pour_flatwork: {
    category: 'concrete',
    rootCause:
      'Build Profit national-average standard flatwork includes concrete, delivery, placement, basic forming, finishing, curing, and normal cleanup; reinforcement and unusual work are separate scopes.',
    assumptions: [
      assumption(
        'concrete_material',
        'included',
        'Ready-mix concrete',
        'Standard ready-mix material and delivery allowance are included.'
      ),
      assumption(
        'concrete_placement',
        'included',
        'Flatwork placement',
        'Base flatwork placement for the measured quantity is included.'
      ),
      assumption(
        'basic_forming',
        'included',
        'Basic perimeter forming',
        'Straight perimeter forming, screeding, and floating are included.'
      ),
      assumption(
        'finishing',
        'included',
        'Basic finishing and curing',
        'Standard broom/basic finish and normal curing are included.'
      ),
      assumption(
        'cleanup',
        'included',
        'Normal cleanup',
        'Normal jobsite cleanup is included.'
      ),
      assumption(
        'pumping',
        'excluded',
        'Concrete pumping',
        'Pump truck or special placement equipment is not included.'
      ),
      assumption(
        'reinforcement',
        'excluded',
        'Reinforcement',
        'Rebar, mesh, chairs, and related reinforcement are not included unless priced separately.'
      ),
      assumption(
        'sawcutting',
        'excluded',
        'Sawcutting',
        'Sawcut control joints are not included in this base flatwork suggestion.'
      ),
      assumption(
        'complex_forming',
        'excluded',
        'Complex forming',
        'Curves, steps, isolated pours, thickened edges, and unusual formwork are not included.'
      ),
    ],
  },
  flooring: {
    category: 'flooring',
    rootCause:
      'Build Profit national-average flooring is modeled as new flooring material plus standard installation.',
    assumptions: [
      assumption(
        'flooring_material',
        'included',
        'Flooring material',
        'Standard flooring material for the measured area is included.'
      ),
      assumption(
        'flooring_installation',
        'included',
        'Standard installation',
        'Standard layout, cutting, and installation labor are included.'
      ),
      assumption(
        'floor_demo',
        'excluded',
        'Existing-floor demolition',
        'Removal of existing flooring is not included.'
      ),
      assumption(
        'disposal',
        'excluded',
        'Disposal / haul-off',
        'Disposal of removed flooring is not included.'
      ),
      assumption(
        'floor_prep',
        'excluded',
        'Floor prep / leveling',
        'Leveling, patching, moisture mitigation, and substrate repair are not included.'
      ),
      assumption(
        'underlayment',
        'excluded',
        'Underlayment',
        'Underlayment is not included unless selected separately.'
      ),
      assumption(
        'transitions',
        'excluded',
        'Transitions',
        'Transitions, thresholds, and reducers are not included.'
      ),
      assumption(
        'baseboard',
        'excluded',
        'Baseboards',
        'Baseboard removal or installation is not included.'
      ),
      assumption(
        'stairs',
        'conditional',
        'Stairs',
        'Stair installation needs separate confirmation and pricing.',
        {
          conditionText:
            'Included only if the measured quantity and rate explicitly account for stairs.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
    ],
  },
  floor_tile_standard: {
    category: 'tile',
    rootCause:
      'Build Profit national-average standard floor tile ($19/SF planning) is modeled as ceramic/porcelain tile material plus standard floor installation. Large-format, mosaic, stone, and membrane premiums are separate.',
    assumptions: [
      assumption(
        'tile_material',
        'included',
        'Standard ceramic/porcelain tile',
        'Standard ceramic or porcelain tile allowance is included.'
      ),
      assumption(
        'thinset',
        'included',
        'Thinset',
        'Standard thinset/mortar is included.'
      ),
      assumption('grout', 'included', 'Grout', 'Standard grout is included.'),
      assumption(
        'tile_installation',
        'included',
        'Standard floor installation',
        'Standard floor tile-setting labor, routine cuts, and basic layout are included.'
      ),
      assumption(
        'cleanup',
        'included',
        'Basic cleanup',
        'Final tile cleanup for the measured area is included.',
        { impact: 'medium' }
      ),
      assumption(
        'floor_demo',
        'excluded',
        'Demolition',
        'Existing-floor demolition is not included.'
      ),
      assumption(
        'floor_prep',
        'excluded',
        'Floor leveling',
        'Floor leveling and major substrate correction are not included.'
      ),
      assumption(
        'crack_isolation',
        'excluded',
        'Crack-isolation membrane',
        'Crack-isolation / uncoupling membrane is not included.'
      ),
      assumption(
        'waterproofing',
        'excluded',
        'Waterproofing',
        'Floor waterproofing is not included.'
      ),
      assumption(
        'heated_floor',
        'excluded',
        'Heated-floor systems',
        'Radiant / heated-floor systems are not included.'
      ),
      assumption(
        'baseboard',
        'excluded',
        'Baseboard removal or replacement',
        'Baseboard removal or replacement is not included.'
      ),
      assumption(
        'large_format',
        'excluded',
        'Large-format premium',
        'Large-format tile labor premium is not included.'
      ),
      assumption(
        'specialty_pattern',
        'excluded',
        'Mosaic / specialty-pattern premium',
        'Mosaic or specialty-pattern premiums are not included.'
      ),
      assumption(
        'natural_stone',
        'excluded',
        'Natural stone',
        'Natural stone material and setting premiums are not included.'
      ),
      assumption(
        'transitions',
        'excluded',
        'Transitions',
        'Transitions and thresholds are not included.'
      ),
    ],
  },
  bath_floor_tile: {
    category: 'tile',
    rootCause:
      'Build Profit national-average bathroom floor tile ($21/SF planning) is modeled as tile material plus bathroom floor installation. Waterproofing, demo, and leveling are separate.',
    assumptions: [
      assumption(
        'tile_material',
        'included',
        'Standard ceramic/porcelain tile',
        'Standard ceramic or porcelain tile allowance is included.'
      ),
      assumption(
        'thinset',
        'included',
        'Thinset',
        'Standard thinset/mortar is included.'
      ),
      assumption('grout', 'included', 'Grout', 'Standard grout is included.'),
      assumption(
        'tile_installation',
        'included',
        'Bathroom floor installation',
        'Standard bathroom floor tile-setting labor, routine cuts, and basic cleanup are included.'
      ),
      assumption(
        'floor_demo',
        'excluded',
        'Demolition',
        'Existing-floor demolition is not included.'
      ),
      assumption(
        'floor_prep',
        'excluded',
        'Floor leveling',
        'Floor leveling and major substrate correction are not included.'
      ),
      assumption(
        'crack_isolation',
        'excluded',
        'Crack-isolation membrane',
        'Crack-isolation / uncoupling membrane is not included.'
      ),
      assumption(
        'waterproofing',
        'excluded',
        'Waterproofing',
        'Floor waterproofing is not included.'
      ),
      assumption(
        'heated_floor',
        'excluded',
        'Heated-floor systems',
        'Radiant / heated-floor systems are not included.'
      ),
      assumption(
        'baseboard',
        'excluded',
        'Baseboard removal or replacement',
        'Baseboard removal or replacement is not included.'
      ),
      assumption(
        'large_format',
        'excluded',
        'Large-format premium',
        'Large-format tile labor premium is not included.'
      ),
      assumption(
        'specialty_pattern',
        'excluded',
        'Mosaic / specialty-pattern premium',
        'Mosaic or specialty-pattern premiums are not included.'
      ),
      assumption(
        'natural_stone',
        'excluded',
        'Natural stone',
        'Natural stone material and setting premiums are not included.'
      ),
      assumption(
        'transitions',
        'excluded',
        'Transitions',
        'Transitions and thresholds are not included.'
      ),
    ],
  },
  wall_tile_dry_area: {
    category: 'tile',
    rootCause:
      'Build Profit national-average dry-area wall tile ($23/SF planning) is modeled as vertical tile material and setting labor. Waterproofing and backer board are not included.',
    assumptions: [
      assumption(
        'tile_material',
        'included',
        'Standard tile material',
        'Standard wall tile material allowance is included.'
      ),
      assumption(
        'tile_installation',
        'included',
        'Vertical installation labor',
        'Standard vertical tile-setting labor is included.'
      ),
      assumption(
        'thinset',
        'included',
        'Thinset',
        'Standard thinset/mortar is included.'
      ),
      assumption('grout', 'included', 'Grout', 'Standard grout is included.'),
      assumption(
        'cleanup',
        'included',
        'Standard cuts and cleanup',
        'Routine cuts and final cleanup are included.',
        { impact: 'medium' }
      ),
      assumption(
        'waterproofing',
        'excluded',
        'Waterproofing',
        'Waterproofing is not included for dry-area wall tile.'
      ),
      assumption(
        'backer_board',
        'excluded',
        'Backer board replacement',
        'Backer board or substrate replacement is not included.'
      ),
      assumption(
        'demo',
        'excluded',
        'Demolition',
        'Demolition is not included.'
      ),
      assumption(
        'wall_prep',
        'excluded',
        'Wall repair or leveling',
        'Wall repair, flattening, and major leveling are not included.'
      ),
      assumption(
        'niche_bench',
        'excluded',
        'Niches',
        'Niches and specialty recesses are not included.'
      ),
      assumption(
        'specialty_pattern',
        'excluded',
        'Specialty patterns',
        'Specialty pattern premiums are not included.'
      ),
      assumption(
        'natural_stone',
        'excluded',
        'Natural stone',
        'Natural stone premiums are not included.'
      ),
      assumption(
        'specialty_trim',
        'excluded',
        'Specialty trim',
        'Schluter and specialty trim are not included.'
      ),
    ],
  },
  shower_wall_tile: {
    category: 'tile',
    rootCause:
      'Build Profit national-average shower wall tile ($26/SF planning) is tile-setting only. The suggested price does not automatically include waterproofing membrane or substrate systems — price those separately when in scope.',
    assumptions: [
      assumption(
        'tile_material',
        'included',
        'Standard ceramic/porcelain tile allowance',
        'Standard ceramic or porcelain tile allowance is included.'
      ),
      assumption(
        'tile_installation',
        'included',
        'Standard vertical tile-setting labor',
        'Standard vertical tile-setting labor is included.'
      ),
      assumption(
        'thinset',
        'included',
        'Thinset or mortar',
        'Standard thinset/mortar is included.'
      ),
      assumption(
        'grout',
        'included',
        'Standard grout',
        'Standard grout is included.'
      ),
      assumption(
        'straight_cuts',
        'included',
        'Routine straight cuts',
        'Routine straight cuts are included.',
        { impact: 'medium' }
      ),
      assumption(
        'basic_layout',
        'included',
        'Basic layout',
        'Basic layout is included.',
        { impact: 'medium' }
      ),
      assumption(
        'cleanup',
        'included',
        'Final tile cleanup',
        'Final tile cleanup for the measured area is included.',
        { impact: 'medium' }
      ),
      assumption(
        'waterproofing',
        'excluded',
        'Waterproofing membrane',
        'Waterproofing membrane/system is not included in the $26/SF tile suggestion — confirm or price waterproofing separately.'
      ),
      assumption(
        'backer_board',
        'excluded',
        'Cement board / foam board / backer substrate',
        'Cement board, foam board, or backer substrate is not included.'
      ),
      assumption(
        'demo',
        'excluded',
        'Demolition',
        'Demolition is not included.'
      ),
      assumption(
        'wall_prep',
        'excluded',
        'Wall flattening / major substrate correction',
        'Wall flattening and major substrate correction are not included.'
      ),
      assumption('niche', 'excluded', 'Niches', 'Niches are not included.'),
      assumption('bench', 'excluded', 'Benches', 'Benches are not included.'),
      assumption('curb', 'excluded', 'Curbs', 'Curbs are not included.'),
      assumption(
        'decorative_band',
        'excluded',
        'Decorative bands',
        'Decorative bands are not included.'
      ),
      assumption(
        'specialty_pattern',
        'excluded',
        'Mosaic pattern premium',
        'Mosaic pattern premiums are not included.'
      ),
      assumption(
        'large_format',
        'excluded',
        'Large-format tile premium',
        'Large-format tile labor premium is not included.'
      ),
      assumption(
        'natural_stone',
        'excluded',
        'Natural stone premium',
        'Natural stone premiums are not included.'
      ),
      assumption(
        'specialty_trim',
        'excluded',
        'Schluter or specialty trim',
        'Schluter and specialty trim are not included.'
      ),
      assumption(
        'fixture_reset',
        'excluded',
        'Plumbing-fixture removal or reset',
        'Plumbing-fixture removal or reset is not included.'
      ),
      assumption(
        'minor_substrate_prep',
        'conditional',
        'Minor substrate preparation',
        'Minor substrate prep may apply when surfaces are already suitable.',
        {
          conditionText:
            'Confirm whether minor prep is included or needs a separate line.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
      assumption(
        'standard_edge',
        'conditional',
        'Standard edge finishing',
        'Standard edge finishing when no specialty trim is required.',
        {
          conditionText:
            'Confirm edge finish scope when Schluter/specialty trim is not selected.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
      assumption(
        'valve_penetrations',
        'conditional',
        'Typical valve / showerhead penetrations',
        'Typical penetrations for valves and showerheads.',
        {
          conditionText:
            'Confirm penetration count and specialty cutting needs.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
    ],
  },
  glass_door: {
    category: 'wet_area',
    rootCause:
      'Build Profit standard shower door package is modeled per installed glass door/enclosure (~$1,450 standard slider, ~$2,500 premium frameless). Door hardware and install labor included — bath mirror and accessories are separate lines. Total scales with door count.',
    assumptions: [
      assumption(
        'door_unit',
        'included',
        'Glass door / enclosure unit',
        'Standard tempered glass shower door or enclosure unit is included.'
      ),
      assumption(
        'door_hardware',
        'included',
        'Door hardware',
        'Standard hinges, track, or clips for the shower door are included.'
      ),
      assumption(
        'install_labor',
        'included',
        'Door install labor',
        'Standard two-person shower-door install labor is included.'
      ),
      assumption(
        'sealing',
        'included',
        'Basic sealing',
        'Basic silicone sealing at the door unit is included.',
        { impact: 'medium' }
      ),
      assumption(
        'mirror_material',
        'excluded',
        'Bath mirror',
        'Vanity mirror material and install are not included on this line.'
      ),
      assumption(
        'towel_bars',
        'excluded',
        'Towel bars / accessories',
        'Towel bars, paper holders, and robe hooks are not included.'
      ),
      assumption(
        'custom_frameless',
        'conditional',
        'Luxury custom frameless',
        'Heavy custom frameless / specialty glass may exceed the premium frameless tier.',
        {
          conditionText:
            'Confirm door style — use Premium frameless or custom quote if needed.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
      assumption(
        'medicine_cabinet',
        'excluded',
        'Medicine cabinet',
        'Medicine cabinets and lighted mirrors are not included.'
      ),
      assumption(
        'out_of_plumb',
        'conditional',
        'Out-of-plumb corrections',
        'Significant out-of-plumb wall corrections may require extra labor.',
        {
          conditionText: 'Confirm walls are within normal install tolerance.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
    ],
  },
  tile_shower_pan: {
    category: 'wet_area',
    rootCause:
      'Build Profit national-average shower mud pan build (~$99/SF · ~$1,485 at 15 SF typical shower floor) includes liner, drain, mud-bed materials, and entry curb scaled to pan area. Curb framing is ~1 hr — not a tiled bench. Floor tile and curb tile finish are on the Shower floor tile line, not here.',
    assumptions: [
      assumption(
        'pan_liner',
        'included',
        'Shower pan liner',
        'PVC or CPE shower pan liner is included.'
      ),
      assumption(
        'drain',
        'included',
        'Drain assembly',
        'Standard shower drain assembly is included.'
      ),
      assumption(
        'mud_bed',
        'included',
        'Mud-bed / mortar materials',
        'Sand, portland, and wire mesh for the mortar bed are included.'
      ),
      assumption(
        'curb_lumber',
        'included',
        'Entry curb lumber',
        'Simple entry curb — typically 2× 2×4 studs plus screws/fasteners (~$25 materials).'
      ),
      assumption(
        'pan_labor',
        'included',
        'Mud pan build labor',
        'Pitch, pack, and waterproof the mortar pan before floor tile.'
      ),
      assumption(
        'curb_frame_labor',
        'included',
        'Curb frame labor',
        'Frame the entry curb (~1 hr) — lumber box only, not tile finish.'
      ),
      assumption(
        'floor_tile',
        'excluded',
        'Shower floor tile',
        'Floor tile setting is on the shower floor tile line.'
      ),
      assumption(
        'waterproofing',
        'excluded',
        'Wall waterproofing',
        'Wall backer and membrane are on the waterproofing line.'
      ),
      assumption(
        'curb_tile',
        'excluded',
        'Curb tile finish',
        'Tile on the curb face is on shower floor tile, not here.'
      ),
      assumption(
        'bench',
        'excluded',
        'Shower bench',
        'Tiled shower bench is a separate scope.'
      ),
      assumption(
        'curb_only_standalone',
        'excluded',
        'Standalone curb-only line',
        'Entry curb is included here — do not add a separate curb line.'
      ),
    ],
  },
  shower_floor_tile: {
    category: 'tile',
    rootCause:
      'Build Profit national-average shower floor tile ($30/SF planning) is tile-setting on an existing pitched floor. Shower pan construction, waterproofing, and drain assembly are separate scopes.',
    assumptions: [
      assumption(
        'tile_material',
        'included',
        'Standard shower-floor tile allowance',
        'Standard shower-floor tile allowance is included.'
      ),
      assumption(
        'tile_installation',
        'included',
        'Standard installation labor',
        'Standard shower-floor tile-setting labor is included.'
      ),
      assumption(
        'thinset',
        'included',
        'Thinset or mortar',
        'Standard thinset/mortar is included.'
      ),
      assumption('grout', 'included', 'Grout', 'Standard grout is included.'),
      assumption(
        'drain_cuts',
        'included',
        'Normal drain cuts',
        'Normal drain cuts are included.',
        { impact: 'medium' }
      ),
      assumption(
        'slope_follow',
        'included',
        'Basic slope-following installation',
        'Basic installation following an existing slope is included.',
        {
          impact: 'medium',
        }
      ),
      assumption(
        'cleanup',
        'included',
        'Final cleanup',
        'Final cleanup for the measured area is included.',
        { impact: 'medium' }
      ),
      assumption(
        'shower_pan',
        'excluded',
        'Shower pan construction',
        'Shower pan construction is not included.'
      ),
      assumption(
        'waterproofing',
        'excluded',
        'Waterproofing membrane',
        'Waterproofing membrane is not included — confirm or price separately.'
      ),
      assumption(
        'drain_assembly',
        'excluded',
        'Drain assembly',
        'Drain assembly is not included.'
      ),
      assumption(
        'major_slope',
        'excluded',
        'Major slope correction',
        'Major slope correction is not included.'
      ),
      assumption(
        'mud_bed',
        'excluded',
        'Mud-bed construction',
        'Mud-bed construction is not included unless explicitly scoped.'
      ),
      assumption('curb', 'excluded', 'Curbs', 'Curbs are not included.'),
      assumption(
        'niche_bench',
        'excluded',
        'Niches or benches',
        'Niches and benches are not included.'
      ),
      assumption(
        'specialty_pattern',
        'excluded',
        'Mosaic or specialty-pattern premium',
        'Specialty-pattern premiums are not included by default.'
      ),
      assumption(
        'demo',
        'excluded',
        'Demolition',
        'Demolition is not included.'
      ),
      assumption(
        'plumbing_changes',
        'excluded',
        'Plumbing changes',
        'Plumbing changes are not included.'
      ),
      assumption(
        'standard_mosaic',
        'conditional',
        'Standard mosaic installation',
        'Standard mosaic floor installation may apply when that is the specified finish.',
        {
          conditionText:
            'Confirm mosaic vs standard tile layout before treating mosaic as included.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
      assumption(
        'minor_drain_adjust',
        'conditional',
        'Minor drain-area adjustments',
        'Minor drain-area adjustments when the pan/slope is already correct.',
        {
          conditionText:
            'Confirm drain-area adjustments are minor and do not require pan rebuild.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
    ],
  },
  paint: {
    category: 'paint',
    rootCause:
      'Build Profit national-average paint is modeled per wall/ceiling surface sqft (not floor area) as standard paint material, labor, and basic prep.',
    assumptions: [
      assumption(
        'paint_material',
        'included',
        'Paint material',
        'Standard paint material is included.'
      ),
      assumption(
        'paint_labor',
        'included',
        'Standard paint labor',
        'Standard application labor is included.'
      ),
      assumption(
        'surface_basis',
        'included',
        'Wall/ceiling surface basis',
        'Rates apply to paintable wall/ceiling surface area, not floor sqft.',
        {
          impact: 'medium',
        }
      ),
      assumption(
        'prep',
        'included',
        'Basic prep',
        'Minor surface prep, masking, and cleanup are included.',
        { impact: 'medium' }
      ),
      assumption(
        'repairs',
        'excluded',
        'Wall repairs',
        'Drywall/plaster repairs and texture repair are not included.'
      ),
      assumption(
        'doors',
        'excluded',
        'Doors',
        'Door painting is not included unless scoped separately.'
      ),
      assumption(
        'trim',
        'excluded',
        'Trim',
        'Trim painting is not included unless scoped separately.'
      ),
      assumption(
        'high_access',
        'conditional',
        'High ceilings / access',
        'High ceilings, scaffolding, lifts, or difficult access require confirmation.',
        {
          conditionText:
            'Price separately when height or access is outside normal reach.',
        }
      ),
      assumption(
        'specialty_finish',
        'excluded',
        'Specialty finishes',
        'Specialty coatings, cabinet finishes, and decorative finishes are not included.'
      ),
    ],
  },
  interior_paint: {
    category: 'paint',
    rootCause:
      'Build Profit national-average interior paint is modeled per wall/ceiling surface sqft (not floor area) as standard paint material, labor, and basic prep.',
    assumptions: [
      assumption(
        'paint_material',
        'included',
        'Paint material',
        'Standard interior paint material is included.'
      ),
      assumption(
        'paint_labor',
        'included',
        'Standard paint labor',
        'Standard wall/ceiling application labor is included.'
      ),
      assumption(
        'surface_basis',
        'included',
        'Wall/ceiling surface basis',
        'Rates apply to paintable wall/ceiling surface area, not floor sqft.',
        {
          impact: 'medium',
        }
      ),
      assumption(
        'prep',
        'included',
        'Basic prep',
        'Minor prep, masking, and cleanup are included.',
        { impact: 'medium' }
      ),
      assumption(
        'repairs',
        'excluded',
        'Wall repairs',
        'Drywall/plaster repairs and texture repair are not included.'
      ),
      assumption(
        'doors',
        'excluded',
        'Doors',
        'Door painting is not included unless scoped separately.'
      ),
      assumption(
        'trim',
        'excluded',
        'Trim',
        'Trim painting is not included unless scoped separately.'
      ),
    ],
  },
  exterior_paint: {
    category: 'paint',
    rootCause:
      'Build Profit mid-market national exterior/stucco paint is modeled per painted exterior surface sqft (not floor area). Prep, masking, heavy repairs, access work, and specialty coatings are separate.',
    assumptions: [
      assumption(
        'paint_material',
        'included',
        'Exterior / masonry paint',
        'Standard exterior acrylic or masonry paint for stucco/siding is included (not premium elastomeric upgrades).'
      ),
      assumption(
        'paint_labor',
        'included',
        'Spray / roll labor',
        'Standard exterior application labor (typically spray and back-roll) is included.'
      ),
      assumption(
        'masking',
        'excluded',
        'Tape and masking',
        'Standard exterior tape and masking are priced on the Exterior Prep & Masking line when scoped separately.',
        { impact: 'medium' }
      ),
      assumption(
        'exterior_prep',
        'excluded',
        'Exterior prep & masking',
        'Cleaning, masking, scraping, and spot priming are on the Exterior Prep & Masking scope line — not in the exterior application rate.',
        { impact: 'medium' }
      ),
      assumption(
        'soffit_fascia',
        'included',
        'Light soffit / fascia',
        'Routine soffit/fascia paint adjacent to wall work is included at a planning level — detailed trim packages may still need a separate line.',
        { impact: 'medium' }
      ),
      assumption(
        'surface_basis',
        'included',
        'Exterior surface basis',
        'Rates apply to exterior painted surface area, not floor sqft.',
        {
          impact: 'medium',
        }
      ),
      assumption(
        'repairs',
        'excluded',
        'Stucco / substrate repairs',
        'Crack repair, stucco patching, and substrate repairs are not included.'
      ),
      assumption(
        'elastomeric',
        'excluded',
        'Elastomeric / specialty coating',
        'Thick elastomeric or specialty coatings are not included.'
      ),
      assumption(
        'high_access',
        'conditional',
        'Access equipment',
        'Ladders, lifts, scaffolding, or difficult access require confirmation.',
        {
          conditionText:
            'Price separately when access is outside standard ladder work.',
        }
      ),
    ],
  },
  drywall: {
    category: 'drywall',
    rootCause:
      'Build Profit national-average drywall is modeled per wall/ceiling surface sqft (not floor area) as board, hang, tape, finish, and standard texture.',
    assumptions: [
      assumption(
        'drywall_board',
        'included',
        'Drywall board',
        'Standard drywall board material is included.'
      ),
      assumption(
        'hang',
        'included',
        'Hang drywall',
        'Standard drywall hanging labor is included.'
      ),
      assumption(
        'finish_tape',
        'included',
        'Tape and finish',
        'Standard taping and finishing are included.'
      ),
      assumption(
        'texture',
        'included',
        'Standard texture',
        'Standard texture is included where typical for the job.',
        { impact: 'medium' }
      ),
      assumption(
        'surface_basis',
        'included',
        'Wall/ceiling surface basis',
        'Rates apply to drywall surface area, not floor sqft.',
        {
          impact: 'medium',
        }
      ),
      assumption(
        'demo',
        'excluded',
        'Demolition',
        'Removal of existing wall/ceiling material is not included.'
      ),
      assumption(
        'disposal',
        'excluded',
        'Disposal / haul-off',
        'Debris disposal is not included.'
      ),
      assumption(
        'insulation',
        'excluded',
        'Insulation',
        'Insulation is not included.'
      ),
      assumption(
        'fire_rating',
        'conditional',
        'Fire-rated assemblies',
        'Fire-rated or specialty assemblies require confirmation.',
        {
          conditionText: 'Price separately when a rated assembly is required.',
        }
      ),
      assumption(
        'level_5',
        'excluded',
        'Level 5 finish',
        'Level 5 finish is not included.'
      ),
      assumption(
        'paint',
        'excluded',
        'Painting',
        'Primer and paint are not included.'
      ),
    ],
  },
  plumbing_rough: {
    category: 'plumbing',
    rootCause:
      'Build Profit national-average plumbing rough-in is modeled per rough-in point (supply/drain stub-out). In bath remodels this line is for shower/tub wet-area relocations — toilet and lav rough-in belong on their fixture lines.',
    assumptions: [
      assumption(
        'rough_labor',
        'included',
        'Rough-in labor',
        'Standard rough-in labor is included.'
      ),
      assumption(
        'standard_fittings',
        'included',
        'Standard fittings',
        'Common rough-in fittings and supplies are included.'
      ),
      assumption(
        'point_basis',
        'included',
        'Per rough-in point',
        'Rates are per supply/drain rough-in point, not floor sqft.',
        {
          impact: 'medium',
        }
      ),
      assumption(
        'wet_area_rough',
        'included',
        'Shower/tub rough-in',
        'Supply and drain rough-in for shower, tub, or wet-area relocations when counted.',
        {
          impact: 'medium',
        }
      ),
      assumption(
        'toilet_rough',
        'excluded',
        'Toilet rough-in / relocation',
        'Toilet drain and supply relocation is on the Toilet fixture line when selected.'
      ),
      assumption(
        'lav_rough',
        'excluded',
        'Lavatory / vanity rough-in',
        'Lav sink supply and drain rough-in is on the Vanity fixture line when selected.'
      ),
      assumption(
        'fixtures',
        'excluded',
        'Fixtures & trim-out',
        'Fixtures and trim-out hookups are not included.'
      ),
      assumption(
        'permits',
        'excluded',
        'Permits',
        'Permits and inspection fees are not included.'
      ),
      assumption(
        'trenching',
        'excluded',
        'Trenching',
        'Trenching, sawcutting, and excavation are not included.'
      ),
      assumption(
        'patching',
        'excluded',
        'Patching',
        'Wall, floor, and concrete patching are not included.'
      ),
      assumption(
        'testing',
        'conditional',
        'Testing',
        'Pressure testing and special inspections require confirmation.',
        {
          conditionText:
            'Include only when required testing is part of the rough-in scope.',
        }
      ),
    ],
  },
  electrical_rough: {
    category: 'electrical',
    rootCause:
      'Build Profit national-average electrical rough-in is modeled per circuit/device/box, not per floor sqft.',
    assumptions: [
      assumption(
        'wiring',
        'included',
        'Standard wiring',
        'Standard branch wiring is included.'
      ),
      assumption(
        'device_boxes',
        'included',
        'Boxes / rough devices',
        'Standard boxes and rough device installation are included.'
      ),
      assumption(
        'point_basis',
        'included',
        'Per circuit/device',
        'Rates are per circuit, device, or box affected, not floor sqft.',
        {
          impact: 'medium',
        }
      ),
      assumption(
        'fixtures',
        'excluded',
        'Fixtures',
        'Light fixtures and finish devices are not included.'
      ),
      assumption(
        'permits',
        'excluded',
        'Permits',
        'Permits and utility fees are not included.'
      ),
      assumption(
        'panel_upgrade',
        'excluded',
        'Panel / service upgrade',
        'Panel, service, and meter upgrades are not included.'
      ),
      assumption(
        'trenching',
        'excluded',
        'Trenching',
        'Trenching and underground conduit work are not included.'
      ),
      assumption(
        'patching',
        'excluded',
        'Patching',
        'Wall, ceiling, and concrete patching are not included.'
      ),
      assumption(
        'controls',
        'conditional',
        'Specialty controls',
        'Dimmers, smart controls, low-voltage, and specialty systems require confirmation.',
        {
          conditionText:
            'Price separately when specialty controls are required.',
        }
      ),
    ],
  },
  cabinets: {
    category: 'cabinets',
    rootCause:
      'Build Profit national-average cabinets are modeled as cabinet boxes plus standard installation.',
    assumptions: [
      assumption(
        'cabinet_boxes',
        'included',
        'Cabinet boxes',
        'Standard cabinet boxes are included.'
      ),
      assumption(
        'installation',
        'included',
        'Standard installation',
        'Standard cabinet installation labor is included.'
      ),
      assumption(
        'hardware',
        'included',
        'Basic hardware',
        'Basic standard hardware is included when typical.',
        { impact: 'medium' }
      ),
      assumption(
        'demo',
        'excluded',
        'Demolition',
        'Existing cabinet removal is not included.'
      ),
      assumption(
        'disposal',
        'excluded',
        'Disposal / haul-off',
        'Disposal of removed cabinets is not included.'
      ),
      assumption(
        'countertops',
        'excluded',
        'Countertops',
        'Countertops are not included.'
      ),
      assumption(
        'trim',
        'excluded',
        'Crown / specialty trim',
        'Crown, fillers, panels, and specialty trim are not included.'
      ),
      assumption(
        'appliance_panels',
        'excluded',
        'Appliance panels',
        'Appliance panels and custom modifications are not included.'
      ),
      assumption(
        'plumbing_reconnect',
        'excluded',
        'Plumbing reconnection',
        'Sink/faucet/disposal reconnection is not included.'
      ),
    ],
  },
  countertops: {
    category: 'countertops',
    rootCause:
      'Build Profit national-average countertops are modeled as countertop material, fabrication, and standard installation.',
    assumptions: [
      assumption(
        'countertop_material',
        'included',
        'Countertop material',
        'Standard countertop material is included.'
      ),
      assumption(
        'fabrication',
        'included',
        'Fabrication',
        'Standard fabrication is included.'
      ),
      assumption(
        'installation',
        'included',
        'Standard installation',
        'Standard countertop installation is included.'
      ),
      assumption(
        'standard_edge',
        'included',
        'Standard edge',
        'A standard edge profile is included.',
        { impact: 'medium' }
      ),
      assumption(
        'demo',
        'excluded',
        'Demolition',
        'Existing countertop removal is not included.'
      ),
      assumption(
        'disposal',
        'excluded',
        'Disposal / haul-off',
        'Disposal of removed countertops is not included.'
      ),
      assumption(
        'plumbing_reconnect',
        'excluded',
        'Plumbing reconnect',
        'Plumbing disconnect/reconnect is not included.'
      ),
      assumption(
        'sink',
        'excluded',
        'Sink',
        'Sink purchase or specialty sink work is not included.'
      ),
      assumption(
        'backsplash',
        'excluded',
        'Backsplash',
        'Backsplash is not included.'
      ),
      assumption(
        'support',
        'conditional',
        'Structural support',
        'Brackets, substrate, or structural support require confirmation.',
        {
          conditionText:
            'Price separately when additional support is required.',
        }
      ),
    ],
  },
  shingles_roofing: {
    category: 'roofing',
    rootCause:
      'Build Profit national-average roofing is modeled as new-construction shingle material and standard installation (~$575/square planning), aligned with the NAHB roofing package band—not a full re-roof mid.',
    assumptions: [
      assumption(
        'roofing_material',
        'included',
        'Roofing material',
        'Standard shingle roofing material is included.'
      ),
      assumption(
        'underlayment',
        'included',
        'Underlayment',
        'Standard underlayment is included.'
      ),
      assumption(
        'roof_installation',
        'included',
        'Standard installation',
        'Standard roofing installation labor is included.'
      ),
      assumption(
        'flashing',
        'conditional',
        'Flashing',
        'Basic flashing may be included; extensive flashing replacement requires confirmation.',
        {
          conditionText:
            'Confirm whether required flashing is standard or needs separate pricing.',
        }
      ),
      assumption(
        'tear_off',
        'excluded',
        'Tear-off',
        'Existing roofing tear-off is not included.'
      ),
      assumption(
        'disposal',
        'excluded',
        'Disposal / haul-off',
        'Disposal of removed roofing is not included.'
      ),
      assumption(
        'permits',
        'excluded',
        'Permits',
        'Roofing permits are not included.'
      ),
      assumption(
        'deck_repair',
        'excluded',
        'Deck repair',
        'Roof deck repair or sheathing replacement is not included.'
      ),
      assumption(
        'steep_slope',
        'conditional',
        'Steep slope / difficult access',
        'Steep-slope, height, or difficult access premiums require confirmation.',
        {
          conditionText:
            'Price separately when roof pitch/access exceeds standard installation.',
        }
      ),
      assumption(
        'gutters',
        'excluded',
        'Gutters',
        'Gutters and downspouts are not included.'
      ),
      assumption(
        'skylights',
        'excluded',
        'Skylights',
        'Skylights and specialty penetrations are not included.'
      ),
    ],
  },
  tear_off: {
    category: 'roofing',
    rootCause:
      'Build Profit national-average tear-off is modeled as roofing removal labor plus basic disposal handling.',
    assumptions: [
      assumption(
        'tear_off',
        'included',
        'Roof tear-off',
        'Removal of existing roofing for the measured squares is included.'
      ),
      assumption(
        'loading',
        'included',
        'Loading debris',
        'Loading removed roofing into disposal container is included.'
      ),
      assumption(
        'disposal',
        'conditional',
        'Disposal / dump fees',
        'Disposal fees require confirmation because local fees vary.',
        {
          conditionText:
            'Add separate pricing when dump fees are not included in the removal rate.',
        }
      ),
      assumption(
        'deck_repair',
        'excluded',
        'Deck repair',
        'Roof deck repair is not included.'
      ),
      assumption(
        'multiple_layers',
        'conditional',
        'Multiple layers',
        'Multiple layers require confirmation and may need separate pricing.',
        {
          conditionText:
            'Price separately when more than one layer is removed.',
        }
      ),
    ],
  },
  permits: {
    category: 'permits',
    rootCause:
      'Build Profit national-average permit pricing is modeled as a placeholder permit/inspection allowance.',
    assumptions: [
      assumption(
        'building_permit',
        'included',
        'Building permit allowance',
        'A basic building permit allowance is included.'
      ),
      assumption(
        'standard_inspections',
        'included',
        'Standard inspections',
        'Standard inspection fees are included as an allowance.',
        { impact: 'medium' }
      ),
      assumption(
        'impact_fees',
        'excluded',
        'Impact fees',
        'Impact, school, utility, and connection fees are not included.'
      ),
      assumption(
        'meter_fees',
        'excluded',
        'Meter fees',
        'Meter or utility service fees are not included.'
      ),
      assumption(
        'engineering_review',
        'excluded',
        'Engineering / special review',
        'Engineering, fire, special inspection, and expedited review fees are not included.'
      ),
      assumption(
        'reinspection_fees',
        'excluded',
        'Reinspection fees',
        'Reinspection or penalty fees are not included.'
      ),
    ],
  },
  cleanup: {
    category: 'cleanup',
    rootCause:
      'Build Profit national-average cleanup splits disposal (dumpsters/dump fees) from final clean and haul labor.',
    assumptions: [
      assumption(
        'cleanup',
        'included',
        'Final clean labor',
        'Final jobsite clean and light loading labor is included.'
      ),
      assumption(
        'loading',
        'included',
        'Loading light debris',
        'Loading light construction debris is included as part of cleanup labor.',
        { impact: 'medium' }
      ),
      assumption(
        'dump_fees',
        'conditional',
        'Dumpsters & dump fees',
        'Price in Material — typical 30-yd dumpsters run about $300–$600 each depending on market and load.',
        {
          conditionText:
            'Adjust Material for dumpster count; set to $0 if none needed.',
        }
      ),
      assumption(
        'hazardous_materials',
        'excluded',
        'Hazardous materials',
        'Hazardous material handling is not included.'
      ),
      assumption(
        'large_haul_off',
        'conditional',
        'Heavy haul-off',
        'Multiple dumpsters, export, or heavy debris may need a separate haul-off line.',
        {
          conditionText:
            'Add haul-off scope or increase Material when debris exceeds one dumpster.',
        }
      ),
    ],
  },
  demo: {
    category: 'demolition',
    rootCause:
      'Build Profit national-average demolition is modeled as standard removal labor with light loading.',
    assumptions: [
      assumption(
        'removal',
        'included',
        'Demolition labor',
        'Standard removal labor for the measured area is included.'
      ),
      assumption(
        'loading',
        'included',
        'Loading debris',
        'Loading debris is included.',
        { impact: 'medium' }
      ),
      assumption(
        'dump_fees',
        'excluded',
        'Dump fees',
        'Dump fees and disposal facility costs are not included.'
      ),
      assumption(
        'hazardous_materials',
        'excluded',
        'Hazardous materials',
        'Hazardous materials and abatement are not included.'
      ),
      assumption(
        'protection',
        'excluded',
        'Protection',
        'Dust protection, containment, and specialty protection are not included.'
      ),
    ],
  },
  floor_demo: {
    category: 'demolition',
    rootCause:
      'Build Profit national-average floor demolition is modeled as flooring removal labor with light loading.',
    assumptions: [
      assumption(
        'floor_demo',
        'included',
        'Floor removal',
        'Removal of existing flooring for the measured area is included.'
      ),
      assumption(
        'loading',
        'included',
        'Loading debris',
        'Loading removed flooring is included.',
        { impact: 'medium' }
      ),
      assumption(
        'dump_fees',
        'excluded',
        'Dump fees',
        'Dump fees and disposal facility costs are not included.'
      ),
      assumption(
        'subfloor_repair',
        'excluded',
        'Subfloor repair',
        'Subfloor repair or leveling is not included.'
      ),
    ],
  },
  trim: {
    category: 'finish_carpentry',
    rootCause:
      'Build Profit national-average trim is modeled as standard trim material plus installation.',
    assumptions: [
      assumption(
        'trim_material',
        'included',
        'Trim material',
        'Standard trim material is included.'
      ),
      assumption(
        'trim_installation',
        'included',
        'Trim installation',
        'Standard trim installation labor is included.'
      ),
      assumption(
        'paint',
        'excluded',
        'Painting / finishing',
        'Painting, staining, or finishing trim is not included.'
      ),
      assumption(
        'demo',
        'excluded',
        'Existing trim removal',
        'Existing trim removal and disposal are not included.'
      ),
    ],
  },
  backsplash_tile: {
    category: 'tile',
    rootCause:
      'Build Profit national-average kitchen backsplash tile ($25/SF planning) is modeled as standard backsplash tile material plus outlet-aware installation. Demo, wall repair, and specialty patterns are separate.',
    assumptions: [
      assumption(
        'tile_material',
        'included',
        'Standard tile allowance',
        'Standard backsplash tile material allowance is included.'
      ),
      assumption(
        'thinset',
        'included',
        'Thinset or adhesive',
        'Standard thinset or adhesive is included.'
      ),
      assumption('grout', 'included', 'Grout', 'Standard grout is included.'),
      assumption(
        'outlet_cuts',
        'included',
        'Standard outlet cuts',
        'Standard outlet cuts are included.',
        { impact: 'medium' }
      ),
      assumption(
        'tile_installation',
        'included',
        'Basic installation and cleanup',
        'Standard backsplash installation labor and cleanup are included.'
      ),
      assumption(
        'demo',
        'excluded',
        'Demolition',
        'Existing backsplash demolition is not included.'
      ),
      assumption(
        'wall_prep',
        'excluded',
        'Wall repair',
        'Wall repair is not included.'
      ),
      assumption(
        'substrate_flatten',
        'excluded',
        'Extensive substrate flattening',
        'Extensive substrate flattening is not included.'
      ),
      assumption(
        'specialty_pattern',
        'excluded',
        'Specialty patterns',
        'Specialty pattern premiums are not included.'
      ),
      assumption(
        'natural_stone',
        'excluded',
        'Natural stone',
        'Natural stone premiums are not included.'
      ),
      assumption(
        'slab_backsplash',
        'excluded',
        'Slab backsplash',
        'Full-slab / solid-surface backsplash is not included.'
      ),
      assumption(
        'specialty_trim',
        'excluded',
        'Specialty trim',
        'Specialty trim is not included.'
      ),
      assumption(
        'electrical_relocation',
        'excluded',
        'Electrical relocation',
        'Outlet or switch relocation is not included.'
      ),
      assumption(
        'cabinet_modifications',
        'excluded',
        'Cabinet modifications',
        'Cabinet modifications are not included.'
      ),
    ],
  },
  waterproofing: {
    category: 'waterproofing',
    rootCause:
      'Build Profit national-average shower waterproofing is modeled as a complete wall substrate system before tile: backer board, liquid membrane, vapor barrier, seam tape, fasteners, and cavity insulation at the shower.',
    assumptions: [
      assumption(
        'backer_board',
        'included',
        'Backer board',
        '1/2" cement board (Hardie), foam board (GoBoard/Wedi-class), or fiber-cement board (DensShield-class) is included.'
      ),
      assumption(
        'liquid_membrane',
        'included',
        'Liquid waterproofing',
        'Roll-on or brush-applied membrane (RedGard, Hydro Ban, or equivalent) is included.'
      ),
      assumption(
        'vapor_barrier',
        'included',
        'Vapor barrier',
        'Poly or rated vapor retarder at shower walls (behind backer / in assembly) is included.'
      ),
      assumption(
        'seam_tape',
        'included',
        'Seam tape',
        'Mesh or fiber tape at backer board seams and transitions is included.'
      ),
      assumption(
        'fasteners',
        'included',
        'Screws & fasteners',
        'Backer screws, washers, and standard fasteners are included.'
      ),
      assumption(
        'cavity_insulation',
        'included',
        'Wall-cavity insulation',
        'Batt or foam insulation in stud bays at the shower walls is included (not whole-home attic/envelope insulation).'
      ),
      assumption(
        'waterproofing_labor',
        'included',
        'Installation labor',
        'Labor to install backer, membrane, vapor barrier, tape, and insulation at the shower is included.'
      ),
      assumption(
        'substrate_repair',
        'excluded',
        'Substrate / framing repair',
        'Stud repair, rot remediation, or major framing correction is not included.'
      ),
      assumption(
        'flood_test',
        'conditional',
        'Flood test',
        'Flood testing requires confirmation.',
        {
          conditionText:
            'Include only when required by scope, code, or inspector.',
        }
      ),
      assumption(
        'premium_sheet_membrane',
        'conditional',
        'Premium sheet-membrane systems',
        'Full Kerdi/Wedi sheet kits, niches, and corner bands may exceed the standard $/SF allowance.',
        {
          conditionText:
            'Edit material/labor or use a lump sum when specifying a full sheet-membrane system.',
        }
      ),
    ],
  },
  floor_prep: {
    category: 'flooring',
    rootCause:
      'Build Profit national-average floor prep is modeled as basic patch/level prep (~$2.50/sqft), not full flooring material and install.',
    assumptions: [
      assumption(
        'floor_prep',
        'included',
        'Basic floor prep',
        'Basic patching and light leveling for the measured area are included.'
      ),
      assumption(
        'leveling',
        'conditional',
        'Heavy self-leveling',
        'Significant self-leveling compound and labor require confirmation.',
        {
          conditionText:
            'Price separately when floor flatness requires substantial leveling material/labor.',
        }
      ),
      assumption(
        'flooring_material',
        'excluded',
        'Flooring material',
        'Finished flooring material is not included — use Flooring scope.'
      ),
      assumption(
        'flooring_install',
        'excluded',
        'Flooring install',
        'Finished flooring installation is not included — use Flooring scope.'
      ),
      assumption(
        'moisture_mitigation',
        'excluded',
        'Moisture mitigation',
        'Moisture mitigation systems are not included.'
      ),
      assumption(
        'subfloor_repair',
        'excluded',
        'Subfloor repair',
        'Subfloor replacement or structural repair is not included.'
      ),
    ],
  },
  cabinets_counters: {
    category: 'cabinets',
    rootCause:
      'Build Profit combined cabinet/counter allowance is a placeholder allowance and should be reviewed before production use.',
    assumptions: [
      assumption(
        'cabinets',
        'conditional',
        'Cabinets',
        'Cabinet scope must be confirmed for combined allowances.',
        {
          conditionText:
            'Use only when the allowance intentionally covers cabinets.',
        }
      ),
      assumption(
        'countertops',
        'conditional',
        'Countertops',
        'Countertop scope must be confirmed for combined allowances.',
        {
          conditionText:
            'Use only when the allowance intentionally covers countertops.',
        }
      ),
    ],
  },
  decking: {
    category: 'decking',
    rootCause:
      'Build Profit national-average decking is modeled as decking material plus standard installation.',
    assumptions: [
      assumption(
        'decking_material',
        'included',
        'Decking material',
        'Standard decking material is included.'
      ),
      assumption(
        'decking_labor',
        'included',
        'Decking installation',
        'Standard decking installation labor is included.'
      ),
      assumption(
        'framing',
        'excluded',
        'Deck framing',
        'Structural framing, posts, footings, and beams are not included.'
      ),
      assumption(
        'railing',
        'excluded',
        'Railing',
        'Deck railing is not included.'
      ),
      assumption(
        'stairs',
        'excluded',
        'Stairs',
        'Deck stairs are not included.'
      ),
      assumption(
        'demo',
        'excluded',
        'Demolition',
        'Existing deck demolition and disposal are not included.'
      ),
    ],
  },
  railing: {
    category: 'railing',
    rootCause:
      'Build Profit national-average railing is modeled as standard railing material plus installation.',
    assumptions: [
      assumption(
        'railing_material',
        'included',
        'Railing material',
        'Standard railing material is included.'
      ),
      assumption(
        'railing_labor',
        'included',
        'Railing installation',
        'Standard railing installation labor is included.'
      ),
      assumption(
        'blocking',
        'excluded',
        'Blocking / structural support',
        'Blocking or structural reinforcement is not included.'
      ),
      assumption(
        'stairs',
        'conditional',
        'Stair railing',
        'Stair railing requires confirmation.',
        {
          conditionText:
            'Price separately when railing is on stairs or complex geometry.',
        }
      ),
    ],
  },
  pavers: {
    category: 'sitework',
    rootCause:
      'Build Profit national-average pavers are modeled as paver material plus basic installation.',
    assumptions: [
      assumption(
        'paver_material',
        'included',
        'Paver material',
        'Standard paver material is included.'
      ),
      assumption(
        'paver_installation',
        'included',
        'Paver installation',
        'Basic paver installation labor is included.'
      ),
      assumption(
        'excavation',
        'excluded',
        'Excavation',
        'Excavation and subgrade preparation are not included.'
      ),
      assumption(
        'base_material',
        'excluded',
        'Base material',
        'Base rock, bedding sand, and compaction are not included unless priced separately.'
      ),
      assumption(
        'edge_restraint',
        'excluded',
        'Edge restraint',
        'Edge restraint is not included.'
      ),
      assumption(
        'drainage',
        'conditional',
        'Drainage',
        'Drainage requirements need confirmation.',
        {
          conditionText:
            'Price separately when drainage improvements are required.',
        }
      ),
    ],
  },
  vanity: {
    category: 'fixtures',
    rootCause:
      'Build Profit national-average vanity install (~$1,100 each) is a mid-market cabinet box plus standard set — not countertop, faucet, or trim-out hookups.',
    assumptions: [
      assumption(
        'vanity_box',
        'included',
        'Vanity cabinet',
        'Standard vanity cabinet material is included.'
      ),
      assumption(
        'vanity_install',
        'included',
        'Vanity set labor',
        'Level, secure, and set the vanity cabinet is included.'
      ),
      assumption(
        'countertop',
        'excluded',
        'Countertop',
        'Countertop material, fabrication, and install are on the countertop line.'
      ),
      assumption(
        'plumbing_trim',
        'excluded',
        'Faucet / trim hookups',
        'Lav faucet trim-out and supply connections are on plumbing trim, not here.'
      ),
      assumption(
        'demo',
        'excluded',
        'Demolition',
        'Existing vanity removal is on vanity demo.'
      ),
      assumption(
        'plumbing_rough',
        'excluded',
        'Plumbing rough-in',
        'New or relocated rough-in points are not included.'
      ),
      assumption(
        'mirror',
        'excluded',
        'Mirror',
        'Mirror and accessories are separate lines.'
      ),
    ],
  },
  vanity_demo: {
    category: 'demo',
    rootCause:
      'Build Profit national-average vanity demo (~$225 each) is cabinet disconnect, removal, and haul — not countertop-only demo.',
    assumptions: [
      assumption(
        'disconnect',
        'included',
        'Disconnect',
        'Basic disconnect at the cabinet is included.',
        { impact: 'medium' }
      ),
      assumption(
        'cabinet_removal',
        'included',
        'Cabinet removal',
        'Remove and haul the vanity cabinet body is included.'
      ),
      assumption(
        'countertop_demo',
        'excluded',
        'Countertop demo',
        'Countertop-only removal is on countertop demo.'
      ),
      assumption(
        'plumbing_rough',
        'excluded',
        'Plumbing rough-in changes',
        'Rough-in changes are not included.'
      ),
      assumption(
        'patch_repair',
        'excluded',
        'Wall/floor patch',
        'Drywall or floor patch after removal is not included.'
      ),
    ],
  },
  countertop_demo: {
    category: 'demo',
    rootCause:
      'Build Profit national-average countertop demo (~$175 each) is top removal and haul — not vanity cabinet demo.',
    assumptions: [
      assumption(
        'top_removal',
        'included',
        'Countertop removal',
        'Remove and haul the vanity top or bath counter is included.'
      ),
      assumption(
        'vanity_demo',
        'excluded',
        'Vanity cabinet demo',
        'Vanity cabinet removal is on vanity demo.'
      ),
      assumption(
        'plumbing_rough',
        'excluded',
        'Plumbing rough-in changes',
        'Rough-in changes are not included.'
      ),
      assumption(
        'patch_repair',
        'excluded',
        'Wall/floor patch',
        'Drywall or floor patch is not included.'
      ),
    ],
  },
  plumbing_trim: {
    category: 'fixtures',
    rootCause:
      'Build Profit bathroom plumbing trim is trim-out hookup labor and minor supplies — not fixture purchases, rough-in, or installs priced on separate toilet/vanity lines.',
    assumptions: [
      assumption(
        'lav_hookup',
        'conditional',
        'Lavatory faucet hookup',
        'Connect lav supply/stop and faucet when vanity is a separate line.',
        {
          conditionText: 'Included when vanity is in scope on its own line.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
      assumption(
        'shower_trim',
        'conditional',
        'Shower/tub trim hookup',
        'Set shower valve trim and tub spout when wet-area work is in scope.',
        {
          conditionText:
            'Included when shower/tub wet-area scopes are selected.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
      assumption(
        'toilet_hookup',
        'conditional',
        'Toilet trim hookup',
        'Set toilet flange/wax ring/supply when toilet is not a separate Fixtures line.',
        {
          conditionText: 'Excluded when toilet has its own Fixtures row.',
          recommendedContractorAction: 'confirm_conditions',
        }
      ),
      assumption(
        'toilet_fixture',
        'excluded',
        'Toilet fixture install',
        'Toilet purchase and full install are on the toilet line when selected separately.'
      ),
      assumption(
        'vanity_fixture',
        'excluded',
        'Vanity cabinet install',
        'Vanity cabinet set is on the vanity line when selected separately.'
      ),
      assumption(
        'countertop',
        'excluded',
        'Countertop',
        'Countertop material and install are not included.'
      ),
      assumption(
        'plumbing_rough',
        'excluded',
        'Plumbing rough-in',
        'Rough-in points are on plumbing rough-in.'
      ),
      assumption(
        'fixture_allowance',
        'excluded',
        'Fixture purchases',
        'Fixture and faucet purchases are not included — hookup labor only.'
      ),
    ],
  },
  mirror_accessories: {
    category: 'fixtures',
    rootCause:
      'Build Profit national-average bath accessories (~$375 allowance) covers towel bars, hooks, and paper holders with install — not shower doors or medicine cabinets.',
    assumptions: [
      assumption(
        'accessories_material',
        'included',
        'Accessories allowance',
        'Standard bath accessory material allowance is included.'
      ),
      assumption(
        'accessories_install',
        'included',
        'Install labor',
        'Standard drill/mount labor for bars and hooks is included.'
      ),
      assumption(
        'glass_door',
        'excluded',
        'Shower door',
        'Glass shower doors are on the glass door line.'
      ),
      assumption(
        'mirror',
        'excluded',
        'Vanity mirror',
        'Vanity mirror may be on the glass door package when bundled.'
      ),
      assumption(
        'medicine_cabinet',
        'excluded',
        'Medicine cabinet',
        'Medicine cabinets and lighted mirrors are not included.'
      ),
    ],
  },
  sink_faucet: {
    category: 'fixtures',
    rootCause:
      'Build Profit national-average sink & faucet install (~$800 each) is mid-market fixture allowance plus set — garbage disposal is priced on its own line.',
    assumptions: [
      assumption(
        'sink_fixture',
        'included',
        'Sink & faucet allowance',
        'Standard mid-market sink and faucet materials are included.'
      ),
      assumption(
        'install_labor',
        'included',
        'Install labor',
        'Set sink, faucet, and standard hookups at existing rough-in are included.'
      ),
      assumption(
        'garbage_disposal',
        'excluded',
        'Garbage disposal',
        'Garbage disposal install or replace is on the Garbage disposal line.'
      ),
      assumption(
        'plumbing_rough',
        'excluded',
        'Plumbing rough-in',
        'New or relocated rough-in points are not included.'
      ),
      assumption(
        'countertop',
        'excluded',
        'Countertop',
        'Countertop fabrication and install are on the countertop line.'
      ),
    ],
  },
  garbage_disposal: {
    category: 'fixtures',
    rootCause:
      'Build Profit national-average garbage disposal replace/install (~$400 each) is a new unit plus hookup — reuse/install is a lower labor band when the existing unit is reinstalled.',
    assumptions: [
      assumption(
        'disposal_unit',
        'included',
        'Disposal unit',
        'Standard disposal unit allowance is included on replace/install.'
      ),
      assumption(
        'install_labor',
        'included',
        'Install labor',
        'Hook up, test, and mount at existing drain are included.'
      ),
      assumption(
        'electrical',
        'conditional',
        'Electrical connection',
        'Cord-and-plug or hardwire connection is included when an outlet or switch leg is already present.',
        {
          conditionText: 'Confirm power is available at the sink base.',
        }
      ),
      assumption(
        'sink_faucet',
        'excluded',
        'Sink & faucet',
        'Sink and faucet install are on the Sink & faucet line.'
      ),
      assumption(
        'plumbing_rough',
        'excluded',
        'Plumbing rough-in',
        'New drain or relocated rough-in is not included.'
      ),
    ],
  },
  toilet: {
    category: 'fixtures',
    rootCause:
      'Build Profit national-average toilet install (~$900 each) is mid-market fixture allowance plus set — not rough-in relocation or trim-out when those are separate lines.',
    assumptions: [
      assumption(
        'toilet_fixture',
        'included',
        'Toilet fixture allowance',
        'Standard toilet fixture allowance is included.'
      ),
      assumption(
        'toilet_install',
        'included',
        'Toilet set labor',
        'Set, seal, and connect at existing rough is included.'
      ),
      assumption(
        'plumbing_rough',
        'excluded',
        'Plumbing rough-in',
        'New or relocated rough-in is on plumbing rough-in.'
      ),
      assumption(
        'plumbing_trim',
        'excluded',
        'Trim-out hookups',
        'Trim-out is on plumbing trim when toilet is not bundled there.'
      ),
      assumption(
        'floor_repair',
        'excluded',
        'Floor repair',
        'Floor patch or tile repair after set is not included.'
      ),
    ],
  },
};

function canonicalNationalAverageItemKey(itemId: string): string {
  const aliased = NATIONAL_AVERAGE_BUDGET_SPLIT_ALIASES[itemId] || itemId;
  if (aliased === 'interior_paint' || aliased === 'exterior_paint')
    return aliased;
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
  const geographicBasis =
    params.regional?.geographicBasis ||
    params.average.geographicBasis ||
    'national';
  return {
    sourceRecordId: `national_average:${params.itemId}:${params.average.unit}`,
    parentPricingRecordId: `bps_national:${profileKey}:${params.average.unit}`,
    pricingSource: 'national_average',
    rateSource: params.average.rateSource || 'bps_national_benchmark',
    rateSourceReference:
      params.average.rateSourceReference ||
      'Build Profit national-average rate table',
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

function nationalAverageMaterialBucketLabel(
  itemId: string,
  average?: NationalAverageBudgetSplit | null
): string {
  if (average?.materialBucketLabel) return average.materialBucketLabel;
  if (itemId === 'excavation') return 'Equipment';
  if (itemId === 'drywall') return 'Drywall board and accessories';
  return 'Material';
}

function nationalAverageLaborBucketLabel(
  itemId: string,
  average?: NationalAverageBudgetSplit | null
): string {
  if (average?.laborBucketLabel) return average.laborBucketLabel;
  if (average?.unit === 'allowance' || average?.unit === 'lump_sum')
    return 'Allowance';
  if (itemId === 'drywall')
    return 'Hang, tape, finish, and standard texture labor';
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
  laborBucketLabel?: string | null;
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
  if (
    params.itemId === 'trim' &&
    params.materialSource === 'national_average' &&
    params.laborSource === 'national_average' &&
    Math.abs(Number(params.materialRate) - 2) < 0.01 &&
    Math.abs(Number(params.laborRate) - 6.5) < 0.01
  ) {
    const quantity = params.material / 2;
    return [
      {
        key: 'material',
        label: 'Baseboard / trim material',
        amount: round2(quantity * 2),
        rate: 2,
        source: 'national_average',
      },
      {
        key: 'labor',
        label: 'Cut, fit & installation labor',
        amount: round2(quantity * 3.5),
        rate: 3.5,
        source: 'national_average',
      },
      {
        key: 'prep',
        label: 'Fill nail holes, caulk & light prep',
        amount: round2(quantity),
        rate: 1,
        source: 'national_average',
      },
      {
        key: 'paint',
        label: 'Standard finish painting',
        amount: round2(quantity * 2),
        rate: 2,
        source: 'national_average',
      },
    ];
  }
  const buckets: SuggestedPricingCostBucket[] = [];
  if (params.material > 0) {
    const label = nationalAverageMaterialBucketLabel(
      params.itemId,
      params.average
    );
    buckets.push({
      key: costBucketKindForLabel(label),
      label,
      amount: params.material,
      rate: params.materialRate,
      source: params.materialSource,
    });
  }
  if (params.labor > 0) {
    const label =
      params.laborBucketLabel ||
      nationalAverageLaborBucketLabel(params.itemId, params.average);
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

export function getNationalAverageBudgetSplit(
  itemId: string,
  unit?: string | null
) {
  const key = NATIONAL_AVERAGE_BUDGET_SPLIT_ALIASES[itemId] || itemId;
  const normalizedUnit = String(unit || '').toLowerCase();
  if (
    normalizedUnit &&
    NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT[key]?.[normalizedUnit]
  ) {
    return NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT[key][normalizedUnit];
  }
  return (
    NATIONAL_AVERAGE_BUDGET_SPLITS[key] ??
    NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT[key]?.[
      Object.keys(NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT[key] || {})[0]
    ]
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

function categoryForNationalAverageItem(
  itemKey: string,
  average: NationalAverageBudgetSplit
): string {
  if (average.category) return average.category;
  return (
    BPS_STANDARD_SCOPE_PROFILES[canonicalNationalAverageItemKey(itemKey)]
      ?.category || 'general'
  );
}

function tradeForNationalAverageItem(
  itemKey: string,
  average: NationalAverageBudgetSplit
): string {
  if (average.trade) return average.trade;
  const category = categoryForNationalAverageItem(itemKey, average);
  if (category === 'paint') return 'painting';
  if (category === 'finish_carpentry') return 'carpentry';
  return category;
}

function pricingCoverageForRecord(
  average: NationalAverageBudgetSplit
): BenchmarkPricingCoverageStatus {
  const hasUnit = Boolean(average.unit);
  const hasRate = Number(average.material) > 0 || Number(average.labor) > 0;
  if (!hasUnit || !hasRate) return 'invalid';
  return 'complete';
}

function scopeCoverageForProfile(
  profile: BenchmarkScopeAssumptionProfile | undefined
): BenchmarkPricingCoverageStatus {
  if (!profile) return 'missing';
  if (!profile.scopeAssumptionsDefined) return 'missing';
  const hasIncluded = profile.scopeAssumptions.some(
    assumption => assumption.status === 'included'
  );
  const hasActionable = profile.scopeAssumptions.some(
    assumption =>
      assumption.status === 'excluded' ||
      assumption.status === 'conditional' ||
      assumption.status === 'unknown'
  );
  if (hasIncluded && hasActionable) return 'complete';
  if (hasIncluded || hasActionable) return 'partial';
  return 'missing';
}

export function listNationalAverageBenchmarkRecords(): BenchmarkPricingCatalogRecord[] {
  const entries: Array<{
    itemKey: string;
    average: NationalAverageBudgetSplit;
  }> = [];
  for (const [itemKey, average] of Object.entries(
    NATIONAL_AVERAGE_BUDGET_SPLITS
  )) {
    entries.push({ itemKey, average });
  }
  for (const [itemKey, byUnit] of Object.entries(
    NATIONAL_AVERAGE_BUDGET_SPLITS_BY_UNIT
  )) {
    for (const [unit, average] of Object.entries(byUnit)) {
      if (NATIONAL_AVERAGE_BUDGET_SPLITS[itemKey] === average) continue;
      entries.push({
        itemKey,
        average: { ...average, unit: average.unit || unit },
      });
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
    const freshnessCoverage: BenchmarkPricingCoverageStatus =
      average.effectiveDate ? 'complete' : 'missing';
    const sourceCoverage: BenchmarkPricingCoverageStatus = average.sourceLabel
      ? 'partial'
      : 'missing';
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
        (average.unit === 'allowance'
          ? 'allowance'
          : average.unit === 'lump_sum'
            ? 'lump_sum'
            : 'material_labor'),
      quantityType: average.quantityType || average.unit,
      unit: average.unit,
      materialRate: average.material,
      laborRate: average.labor,
      equipmentRate: materialLabel.toLowerCase().includes('equipment')
        ? average.material
        : null,
      subcontractorRate: null,
      combinedRate: round2(average.material + average.labor),
      rateSource: average.rateSource || 'bps_national_benchmark',
      rateSourceReference:
        average.rateSourceReference ||
        'Build Profit national-average rate table',
      geographicBasis: 'national',
      effectiveDate: average.effectiveDate ?? null,
      verifiedAt: null,
      scopeProfileSource: profile?.scopeProfileSource || 'unknown',
      scopeAssumptionsDefined: Boolean(profile?.scopeAssumptionsDefined),
      scopeAssumptionCount: profile?.scopeAssumptions.length || 0,
      includedAssumptionCount:
        profile?.scopeAssumptions.filter(item => item.status === 'included')
          .length || 0,
      excludedAssumptionCount:
        profile?.scopeAssumptions.filter(item => item.status === 'excluded')
          .length || 0,
      conditionalAssumptionCount:
        profile?.scopeAssumptions.filter(item => item.status === 'conditional')
          .length || 0,
      freshnessKnown: Boolean(average.effectiveDate),
      pricingCoverage,
      scopeProfileCoverage,
      sourceCoverage,
      freshnessCoverage,
      productionStatus,
      productionReady: productionStatus === 'production_ready',
      confidence: profile?.confidence || 'low',
      confidenceReasons: profile?.confidenceReasons || [
        'national_rate_geographic_basis',
      ],
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
    rateSourceReference:
      average.rateSourceReference || 'Build Profit national-average rate table',
    scopeProfileSource: 'unknown',
    confidence: 'low',
    confidenceReasons: [
      'missing_scope_profile',
      'national_rate_geographic_basis',
      'freshness_not_verified',
    ],
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
  if (
    !average ||
    !Number.isFinite(count) ||
    count <= 0 ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return null;
  }
  const material = Math.min(
    total,
    Math.round(count * average.material * 100) / 100
  );
  const labor = Math.max(0, Math.round((total - material) * 100) / 100);
  if (material <= 0 || labor <= 0) return null;
  return { material, labor };
}

export const CHECKLIST_ITEM_QUANTITY_RULES: Record<
  string,
  ScopeItemQuantityRule
> = {
  demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    aggregateMeasurementKeys: [
      'bathroomFloorSqft',
      'showerWallTileSqft',
      'showerFloorTileSqft',
    ],
    canUseRoomSqft: true,
    quantityHelper:
      'Sums bathroom floor + shower walls + shower floor for full tear-out.',
  },
  floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: [
      'bathroomFloorSqft',
      'showerFloorTileSqft',
      'kitchenFloorSqft',
      'floorAreaSqft',
    ],
    canUseRoomSqft: true,
    quantityHelper: 'Uses bathroom floor sqft for floor removal.',
  },
  tub_demo: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 tub removal. Edit if multiple.',
  },
  vanity_demo: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lump_sum', 'allowance'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 vanity cabinet removal. Edit if multiple.',
  },
  countertop_demo: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lump_sum', 'allowance'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 countertop removal. Edit if multiple.',
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
    quantityHelper:
      'Shower wall sqft — includes backer, RedGard-class membrane, vapor barrier, tape, screws, and wall-cavity insulation.',
    missingMessage: 'Enter shower waterproofing sqft.',
  },
  floor_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'bathroomFloorSqft',
    // Living SF is whole-home — never a bath floor tile takeoff basis.
    canUseRoomSqft: false,
    quantityHelper: 'Uses bathroom floor sqft — not whole-home living area.',
  },
  shower_pan: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerFloorTileSqft',
    requiresUserQuantity: true,
    quantityHelper:
      'Uses shower floor sqft — liner, mud bed, curb, and drain scale with pan size. Floor tile is separate.',
    missingMessage: 'Enter shower floor sqft for mud pan build.',
  },
  wet_area_install: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper:
      'Pick install type above — labor + materials show on the line below.',
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
    quantityHelper:
      'Floor tile on the mud pan (tile/thinset/grout). Pan build is the separate mud pan line.',
    missingMessage: 'Enter shower floor tile sqft.',
  },
  shower_niche: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 niche. Edit count if different.',
  },
  shower_bench: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lf'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 shower bench — or enter linear feet.',
  },
  shower_bench_curb: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lf'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 shower bench — or enter linear feet.',
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
  plumbing: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: false,
    defaultQuantity: 1,
    quantityHelper:
      'Choose the connection type, then enter the quantity for the selected connection. Sink/faucet, disposal, and other appliance hookups are separate scope items.',
    missingMessage: 'Enter plumbing connection count or pricing.',
  },
  electrical: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter the quantity for each selected outlet, GFCI, relocation, or dedicated circuit type. Lighting is separate.',
    missingMessage: 'Enter electrical item quantity or pricing.',
  },
  walls_moving: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter the linear feet of wall removed and/or added. Removal and new wall construction are priced separately.',
    missingMessage: 'Enter wall linear feet or pricing.',
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
    requiresUserQuantity: true,
    quantityHelper:
      'Enter the number of light fixtures to supply and install. Fixture cost and installation are included.',
    missingMessage: 'Enter light fixture count.',
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
    defaultQuantity: 1,
    requiresUserQuantity: false,
    quantityHelper: 'Towel bars/hooks allowance — not shower doors.',
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
    quantityHelper:
      'Enter paint sqft and/or calculated total from notes rates.',
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
  trim_paint: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'baseboardLf',
    requiresUserQuantity: true,
    quantityHelper:
      'Enter baseboard, casing, crown, and other painted trim in LF.',
    missingMessage: 'Enter painted trim LF.',
  },
  glass_door: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper:
      'Shower door + mirror count — often matches tile/prefab showers. Builder mid ~$3,250 installed each; price rises with door count.',
  },
  plumbing_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    lumpSumOnly: false,
    quantityHelper:
      'Price plumbing fixtures & trim-out with material and labor.',
    missingMessage: 'Enter plumbing trim pricing (material + labor).',
  },
  electrical_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: false,
    quantityHelper:
      'Package trim-out allowance, or enter a trim device count. Not living SF. Detailed receptacle / switch / fixture cards own those devices instead.',
    missingMessage: 'Enter electrical trim pricing (material + labor).',
  },
  permits: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper:
      'Confirm permit and impact fees for the project jurisdiction.',
    missingMessage: 'Needs local fee confirmation',
  },
  cleanup: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: false,
    lumpSumOnly: false,
    splitTotalOnly: true,
    quantityHelper:
      'Material = dumpsters, bags, and dump fees ($300–$600 each typical). Labor = final clean and load/haul.',
    missingMessage: 'Enter cleanup and disposal pricing.',
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
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    quantityHelper:
      'Enter appliance install allowance if needed — hookup/labor only, not appliance purchase.',
    missingMessage: 'Enter appliance install allowance.',
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
  sink_faucet: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter sink & faucet count or price material and labor.',
    missingMessage: 'Enter sink & faucet count or allowance.',
  },
  garbage_disposal: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper:
      'Pick reuse/install or replace/install, then enter disposal count or price.',
    missingMessage: 'Enter garbage disposal count or allowance.',
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
    quantityHelper: 'Enter a plans and engineering allowance for this job.',
    missingMessage: 'Needs allowance',
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
    lumpSumOnly: false,
    quantityHelper:
      'Price haul-off with dumpster/disposal (material) and haul labor.',
    missingMessage: 'Enter haul-off pricing (material + labor).',
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
    quantityHelper:
      'Price the service call by trip or hour with material and labor.',
    missingMessage: 'Enter service-call pricing.',
  },
  fixture_repair: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter the number of plumbing fixtures repaired. Replacement and new rough-in are separate.',
    missingMessage: 'Enter fixture-repair quantity or pricing.',
  },
  fixture_replace: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter the number of plumbing fixtures set, installed, or replaced at documented rough. Trim and final connections are separate.',
    missingMessage: 'Enter fixture-installation quantity or pricing.',
  },
  drain_cleaning: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter drain-cleaning service count. Drain-line replacement is separate.',
    missingMessage: 'Enter drain-cleaning quantity or pricing.',
  },
  water_line: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'waterLineLf',
    requiresUserQuantity: true,
    quantityHelper:
      'Enter documented water-supply line length in LF. Do not infer from living area.',
    missingMessage: 'Enter water-line LF or pricing.',
  },
  sewer_line: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'sewerLineLf',
    requiresUserQuantity: true,
    quantityHelper:
      'Enter documented sewer/drain-line length in LF. Cleaning and rough-in are separate.',
    missingMessage: 'Enter sewer/drain-line LF or pricing.',
  },
  gas_line: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'gasLineLf',
    requiresUserQuantity: true,
    quantityHelper:
      'Enter documented gas-piping length in LF. Include only explicit gas piping or gas stubs.',
    missingMessage: 'Enter gas-piping LF or pricing.',
  },
  plumbing_fixtures_hardware: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter fixture count for product allowance — toilets, faucets, shower trim, sinks, and drains. Rough-in and trim labor are separate.',
    missingMessage: 'Enter fixture count or fixture allowance pricing.',
  },
  water_heater: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter water heater count when shown on plan or notes. Tankless pricing applies when documented.',
    missingMessage: 'Enter water heater count or pricing.',
  },
  gas_appliance_connections: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter gas appliance hookup count for range, fireplace, dryer, or grill. Gas piping LF is separate.',
    missingMessage: 'Enter gas appliance connection count or pricing.',
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
    quantityHelper:
      'Price the materials package by sqft with material and labor.',
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
  furnace: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: true,
    quantityHelper:
      'Additional / replacement furnace. Not included in the complete HVAC system package.',
    missingMessage: 'Enter furnace quantity.',
  },
  condenser: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: true,
    quantityHelper:
      'Additional / replacement condenser. Not included in the complete HVAC system package.',
    missingMessage: 'Enter condenser quantity.',
  },
  heat_pump: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: true,
    quantityHelper:
      'Additional / replacement heat pump. Not included in the complete HVAC system package.',
    missingMessage: 'Enter heat pump quantity.',
  },
  mini_split: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: true,
    quantityHelper:
      'Additional / replacement mini split. Not included in the complete HVAC system package.',
    missingMessage: 'Enter mini-split quantity.',
  },
  air_handler: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: true,
    quantityHelper:
      'Additional / replacement air handler. Not included in the complete HVAC system package.',
    missingMessage: 'Enter air-handler quantity.',
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
    measurementKeys: [
      'flooringSqft',
      'floorAreaSqft',
      'kitchenFloorSqft',
      'bathroomFloorSqft',
    ],
    dualAllowanceField: true,
    requiresUserQuantity: true,
    quantityHelper: 'Enter kitchen or room floor sqft.',
    missingMessage: 'Enter floor sqft.',
  },
  flooring_lvp: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'flooringLvpSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter LVP flooring sqft.',
    missingMessage: 'Enter LVP sqft.',
  },
  flooring_laminate: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'flooringLaminateSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter laminate flooring sqft.',
    missingMessage: 'Enter laminate sqft.',
  },
  flooring_engineered_hardwood: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'flooringEngineeredHardwoodSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter engineered hardwood sqft.',
    missingMessage: 'Enter engineered hardwood sqft.',
  },
  flooring_solid_hardwood: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'flooringSolidHardwoodSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter solid hardwood sqft.',
    missingMessage: 'Enter solid hardwood sqft.',
  },
  tile_flooring: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'flooringTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter floor tile sqft.',
    missingMessage: 'Enter floor tile sqft.',
  },
  flooring_carpet: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'flooringCarpetSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter carpet sqft.',
    missingMessage: 'Enter carpet sqft.',
  },
  flooring_sheet_vinyl: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'flooringSheetVinylSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter sheet vinyl / VCT flooring sqft.',
    missingMessage: 'Enter sheet vinyl / VCT sqft.',
  },
  underlayment: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'underlaymentSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter underlayment sqft.',
    missingMessage: 'Enter underlayment sqft.',
  },
  ice_water_shield: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'roofIceWaterShieldSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter dedicated ice & water shield area sqft.',
    missingMessage: 'Enter ice & water shield area sqft.',
  },
  moisture_barrier: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'moistureBarrierSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter vapor / moisture barrier sqft.',
    missingMessage: 'Enter vapor / moisture barrier sqft.',
  },
  transitions: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'transitionCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter transition pieces.',
    missingMessage: 'Enter transition piece count.',
  },
  quarter_round: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'quarterRoundLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter quarter-round LF.',
    missingMessage: 'Enter quarter-round LF.',
  },
  sod_turf: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['sodSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter sod/turf sqft.',
    missingMessage: 'Enter sod/turf sqft.',
  },
  artificial_turf: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'artificialTurfSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter artificial turf sqft.',
    missingMessage: 'Enter artificial turf sqft.',
  },
  demo_clearing: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['demoClearingSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter landscape clearing sqft.',
    missingMessage: 'Enter landscape clearing sqft.',
  },
  grading: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'allowance', 'lump_sum'],
    measurementKeys: ['gradingSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter grading sqft or mass excavation quantity.',
    missingMessage: 'Enter grading quantity.',
  },
  soil_prep: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['soilPrepSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter soil preparation sqft.',
    missingMessage: 'Enter soil preparation sqft.',
  },
  drainage: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'drainageLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter drainage LF.',
    missingMessage: 'Enter drainage LF.',
  },
  plants: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'plantCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter plant or shrub quantity.',
    missingMessage: 'Enter plant count.',
  },
  trees: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'treeCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter tree quantity.',
    missingMessage: 'Enter tree count.',
  },
  landscape_boulders: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'boulderCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter standard / medium boulder count.',
    missingMessage: 'Enter boulder count.',
  },
  irrigation: {
    defaultUnit: 'zone',
    allowedUnits: ['zone', 'each', 'allowance', 'lump_sum'],
    measurementKey: 'irrigationZoneCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter irrigation zones.',
    missingMessage: 'Enter irrigation zone count.',
  },
  landscape_lighting: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'landscapeLightCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter light fixture count.',
    missingMessage: 'Enter landscape light count.',
  },
  concrete_edging: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'concreteEdgingLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter concrete edging LF.',
    missingMessage: 'Enter concrete edging LF.',
  },
  pavers: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['paverSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter paver sqft.',
    missingMessage: 'Enter paver sqft.',
  },
  rock: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'ton', 'allowance', 'lump_sum'],
    measurementKeys: ['rockMulchSqft', 'landscapeTons'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter decorative rock coverage sqft, CY, or tons.',
    missingMessage: 'Enter rock quantity.',
  },
  mulch: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'ton', 'allowance', 'lump_sum'],
    measurementKeys: ['rockMulchSqft', 'landscapeTons'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter mulch coverage sqft, CY, or tons.',
    missingMessage: 'Enter mulch quantity.',
  },
  tear_off: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'lump_sum'],
    measurementKey: 'roofSquares',
    requiresUserQuantity: true,
    quantityHelper: 'Enter roof squares.',
    missingMessage: 'Enter roof squares.',
  },
  roofing_system: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'lump_sum', 'allowance'],
    measurementKey: 'roofSquares',
    requiresUserQuantity: false,
    quantityHelper:
      'Select one primary roofing system; unsupported systems remain PRICING_GAP.',
    missingMessage: 'Select one roofing system.',
  },
  roof_pitch_complexity_access: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: false,
    quantityHelper:
      'Confirm conditions only; no premium is applied in this phase.',
    missingMessage: 'Confirm pitch, complexity, and access conditions.',
  },
  roof_exclusions: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: false,
    quantityHelper:
      'Confirm structural, hazardous, solar, crane, permit, and specialty exclusions.',
    missingMessage: 'Confirm Roofing exclusions and special conditions.',
  },
  decking_repair: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'roofDeckingReplacementSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter only the roof decking replacement area in sqft.',
    missingMessage: 'Enter roof decking replacement sqft.',
  },
  roof_repairs: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'roofRepairAffectedSqft',
    requiresUserQuantity: true,
    quantityHelper:
      'Enter affected repair area only, separate from total roof area.',
    missingMessage: 'Enter affected roof repair sqft or custom pricing.',
  },
  flashing: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    measurementKeys: [],
    requiresUserQuantity: false,
    quantityHelper:
      'Legacy flashing row migrated to dedicated LF accessory items.',
    missingMessage: 'Select a dedicated flashing accessory.',
  },
  vents_penetrations: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    measurementKeys: [],
    requiresUserQuantity: false,
    quantityHelper:
      'Legacy mixed-unit row migrated to dedicated ventilation and penetration items.',
    missingMessage: 'Select a dedicated ventilation or penetration item.',
  },
  drip_edge: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'roofDripEdgeLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter drip-edge LF only.',
    missingMessage: 'Enter drip-edge LF or custom pricing.',
  },
  ridge_cap: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'roofRidgeCapLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter ridge-cap LF only.',
    missingMessage: 'Enter ridge-cap LF or custom pricing.',
  },
  valley_flashing: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'roofValleyFlashingLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter valley flashing LF only.',
    missingMessage: 'Enter valley flashing LF or custom pricing.',
  },
  step_flashing: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'roofStepFlashingLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter step flashing LF only.',
    missingMessage: 'Enter step flashing LF or custom pricing.',
  },
  wall_flashing: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'roofWallFlashingLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter wall flashing LF only.',
    missingMessage: 'Enter wall flashing LF or custom pricing.',
  },
  ridge_vent: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'roofRidgeVentLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter ridge vent count only.',
    missingMessage: 'Enter ridge vent EA or custom pricing.',
  },
  roof_vents: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'roofVentCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter standard roof vent count only.',
    missingMessage: 'Enter standard roof vent EA or custom pricing.',
  },
  turbine_vents: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'roofTurbineVentCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter turbine vent count only.',
    missingMessage: 'Enter turbine vent EA or custom pricing.',
  },
  pipe_boots: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'roofPipeBootCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter pipe boot count only.',
    missingMessage: 'Enter pipe boot EA or custom pricing.',
  },
  chimney_flashing: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'roofChimneyFlashingCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter chimney flashing count only.',
    missingMessage: 'Enter chimney flashing EA or custom pricing.',
  },
  skylight_flashing: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'roofSkylightCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter skylight flashing count only.',
    missingMessage: 'Enter skylight flashing EA or custom pricing.',
  },
  roof_penetrations: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'roofPenetrationCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter other roof penetration count only.',
    missingMessage: 'Enter other penetration EA or custom pricing.',
  },
  gutters: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'roofGutterLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter gutter run LF only.',
    missingMessage: 'Enter gutter LF or custom pricing.',
  },
  downspouts: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'roofDownspoutCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter downspout count only.',
    missingMessage: 'Enter downspout EA or custom pricing.',
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
  demo_removal: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'concreteDemoSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter concrete demo removal area in sqft.',
    missingMessage: 'Enter demo removal area.',
  },
  pour_flatwork: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteSqft', 'concreteCy'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter flatwork pour area in sqft.',
    missingMessage: 'Enter flatwork pour area.',
  },
  complex_forming: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'complexFormingLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter additional complex formwork LF.',
    missingMessage: 'Enter complex forming LF.',
  },
  forms: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'concreteSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Uses flatwork pour area from Quick Measurements.',
    missingMessage: 'Enter flatwork pour area.',
  },
  reinforcement: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'concreteReinforcementSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Uses flatwork pour area from Quick Measurements.',
    missingMessage: 'Enter flatwork pour area.',
  },
  concrete_sealer: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'concreteSealerSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Uses flatwork pour area for optional sealer.',
    missingMessage: 'Enter flatwork pour area.',
  },
  decorative_finish: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'concreteSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Uses flatwork pour area for optional decorative finish.',
    missingMessage: 'Enter flatwork pour area.',
  },
  finish_seal: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'concreteSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Uses flatwork pour area from Quick Measurements.',
    missingMessage: 'Enter flatwork pour area.',
  },
  pour_foundation: {
    defaultUnit: 'cy',
    allowedUnits: ['cy', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteCy', 'concreteSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter footing or foundation concrete in CY.',
    missingMessage: 'Enter foundation CY.',
  },
  site_prep: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'concreteSubgradePrepSqft',
    requiresUserQuantity: true,
    quantityHelper:
      'Enter affected flatwork area for basic subgrade prep / grading.',
    missingMessage: 'Enter basic subgrade prep area.',
  },
  additional_haul_off: {
    defaultUnit: 'load',
    allowedUnits: ['load', 'allowance', 'lump_sum'],
    measurementKey: 'additionalHaulOffLoadCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter additional disposal loads.',
    missingMessage: 'Enter additional haul-off loads.',
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
  texture: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: false,
    quantityHelper: 'Enter drywall texture or specialty-finish sqft.',
    missingMessage: 'Enter texture sqft or pricing.',
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
    measurementKeys: ['wallPaintSqft', 'combinedPaintableAreaSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter interior paint sqft.',
    missingMessage: 'Enter paint sqft.',
  },
  ceiling_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'ceilingPaintSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter ceiling paint sqft.',
    missingMessage: 'Enter ceiling paint sqft.',
  },
  prep: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    aggregateMeasurementKeys: ['wallPaintSqft', 'ceilingPaintSqft'],
    measurementKeys: ['combinedPaintableAreaSqft', 'paintAreaSqft'],
    requiresUserQuantity: true,
    quantityHelper:
      'Uses the interior wall/ceiling paint area for standard protection and prep.',
    missingMessage: 'Enter paintable wall/ceiling sqft.',
  },
  door_paint: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'interiorDoorCount',
    requiresUserQuantity: true,
    quantityHelper: 'Enter the number of interior doors and frames.',
    missingMessage: 'Enter interior door count.',
  },
  cabinet_paint: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'sqft', 'allowance', 'lump_sum'],
    measurementKey: 'cabinetRunLf',
    measurementKeys: ['cabinetRunLf', 'cabinetPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter total linear feet of upper and lower cabinets being painted. Do not use kitchen floor area.',
    missingMessage: 'Enter cabinet run LF.',
  },
  exterior_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'exteriorPaintSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter exterior paint sqft.',
    missingMessage: 'Enter exterior paint sqft.',
  },
  exterior_prep: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'exteriorPaintSqft',
    requiresUserQuantity: true,
    quantityHelper:
      'Uses the exterior paint surface area for standard exterior prep and masking.',
    missingMessage: 'Enter exterior paint sqft.',
  },
  windows_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKeys: [
      'windowCount',
      'exteriorDoorCount',
      'slidingDoorCount',
      'interiorDoorCount',
    ],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Window, exterior swing door, sliding/patio door, and interior door counts. Garage doors are a separate trade.',
    missingMessage: 'Enter window/door counts or pricing.',
  },
  windows: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'windowCount',
    measurementKeys: ['windowCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Window units and standard install. Count × national size tier when plan schedule dimensions are available (~$740/ea standard). Trim on Opening trim & finish add-on.',
    missingMessage: 'Enter window count or pricing.',
  },
  exterior_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'exteriorDoorCount',
    measurementKeys: ['exteriorDoorCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Exterior swing / French entry doors — standard ~$1,650/ea. Upgraded, glass, and double units price higher when plan sizes are available. Trim on Opening trim & finish add-on.',
    missingMessage: 'Enter exterior door count or pricing.',
  },
  sliding_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'slidingDoorCount',
    measurementKeys: ['slidingDoorCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Sliding / patio doors — standard 2-panel ~$3,400/ea. Large and multi-panel units price higher when plan sizes are available. Trim on Opening trim & finish add-on.',
    missingMessage: 'Enter sliding door count or pricing.',
  },
  garage_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKeys: [
      'garageDoorSingleCount',
      'garageDoorDoubleCount',
      'garageDoorRvCount',
    ],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Garage door units, tracks, hardware, and installation, priced by single, double, or RV/oversized type. Structural reframing is separate.',
    missingMessage: 'Enter garage door type counts or pricing.',
  },
  interior_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'interiorDoorCount',
    measurementKeys: ['interiorDoorCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Prehung interior door units, jambs, hinges, and standard hardware install. Casing and finish are on the Opening trim & finish add-on.',
    missingMessage: 'Enter interior door count or pricing.',
  },
  trim_finish: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'trimFinishLf',
    measurementKeys: [
      'trimFinishLf',
      'windowCount',
      'exteriorDoorCount',
      'slidingDoorCount',
      'interiorDoorCount',
    ],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper: OPENING_TRIM_FINISH_SCOPE_HELPER,
    missingMessage: 'Select trim coverage/grade and confirm LF or pricing.',
  },
  garage_door_openers: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'garageDoorOpenerCount',
    measurementKeys: ['garageDoorOpenerCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Count garage door openers only when labeled or specified. Do not assume one opener per door.',
    missingMessage: 'Enter garage door opener count or pricing.',
  },
  openings: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'framingOpeningCount',
    measurementKeys: ['framingOpeningCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Structural reframing only for an explicitly new, resized, enlarged, or reframed opening.',
    missingMessage: 'Enter reframed/new opening count or pricing.',
  },
  excavation: {
    defaultUnit: 'cy',
    allowedUnits: ['cy', 'sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'excavationCy',
    requiresUserQuantity: true,
    quantityHelper:
      'Enter excavation CY directly, or calculate CY from excavation area and depth. Pricing includes labor and equipment; export, haul-off, dump fees, and imported fill are separate.',
    missingMessage: 'Enter excavation quantity.',
  },
  ...electricalQuantityRules(),
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
    case 'contractor_confirmed_from_plan_review':
      return 'Contractor confirmed from plan review';
    case 'default_assumption':
      return 'AI assumption';
    case 'missing':
      return 'Needs measurement';
    default:
      return '';
  }
}

export function normalizeScopeMeasurements(
  measurements?: ScopeMeasurements | null
): NormalizedScopeMeasurements {
  const itemQuantities = { ...(measurements?.itemQuantities || {}) };
  const num = (v: unknown) => parseScopeMeasurementInput(String(v ?? ''));
  return {
    bathroomFloorSqft:
      num(measurements?.bathroomFloorSqft) ?? num(measurements?.sqft),
    kitchenFloorSqft: num(measurements?.kitchenFloorSqft),
    floorAreaSqft: num(measurements?.floorAreaSqft),
    flooringSqft: num(measurements?.flooringSqft),
    flooringLvpSqft: num(measurements?.flooringLvpSqft),
    flooringLaminateSqft: num(measurements?.flooringLaminateSqft),
    flooringEngineeredHardwoodSqft: num(
      measurements?.flooringEngineeredHardwoodSqft
    ),
    flooringSolidHardwoodSqft: num(measurements?.flooringSolidHardwoodSqft),
    flooringTileSqft: num(measurements?.flooringTileSqft),
    flooringCarpetSqft: num(measurements?.flooringCarpetSqft),
    floorDemoSqft: num(measurements?.floorDemoSqft),
    floorPrepSqft: num(measurements?.floorPrepSqft),
    underlaymentSqft: num(measurements?.underlaymentSqft),
    moistureBarrierSqft: num(measurements?.moistureBarrierSqft),
    transitionLf: num(measurements?.transitionLf),
    transitionCount: num(measurements?.transitionCount),
    quarterRoundLf: num(measurements?.quarterRoundLf),
    backsplashSqft: num(measurements?.backsplashSqft),
    countertopSqft: num(measurements?.countertopSqft),
    cabinetLf: num(measurements?.cabinetLf),
    landscapeSqft: num(measurements?.landscapeSqft),
    artificialTurfSqft: num(measurements?.artificialTurfSqft),
    demoClearingSqft: num(measurements?.demoClearingSqft),
    gradingSqft: num(measurements?.gradingSqft),
    soilPrepSqft: num(measurements?.soilPrepSqft),
    sodSqft: num(measurements?.sodSqft),
    paverSqft: num(measurements?.paverSqft),
    rockMulchSqft: num(measurements?.rockMulchSqft),
    landscapeTons: num(measurements?.landscapeTons),
    plantCount: num(measurements?.plantCount),
    treeCount: num(measurements?.treeCount),
    irrigationZoneCount: num(measurements?.irrigationZoneCount),
    drainageLf: num(measurements?.drainageLf),
    concreteEdgingLf: num(measurements?.concreteEdgingLf),
    boulderCount: num(measurements?.boulderCount),
    landscapeLightCount: num(measurements?.landscapeLightCount),
    roofAreaSqft: num(measurements?.roofAreaSqft),
    roofIceWaterShieldSqft: num(measurements?.roofIceWaterShieldSqft),
    roofSquares: num(measurements?.roofSquares),
    roofPitch: measurements?.roofPitch ?? null,
    storyCount: num(measurements?.storyCount),
    roofDeckingReplacementSqft: num(measurements?.roofDeckingReplacementSqft),
    roofDripEdgeLf: num(measurements?.roofDripEdgeLf),
    roofRidgeCapLf: num(measurements?.roofRidgeCapLf),
    roofRidgeVentLf: num(measurements?.roofRidgeVentLf),
    roofValleyFlashingLf: num(measurements?.roofValleyFlashingLf),
    roofStepFlashingLf: num(measurements?.roofStepFlashingLf),
    roofWallFlashingLf: num(measurements?.roofWallFlashingLf),
    roofChimneyFlashingCount: num(measurements?.roofChimneyFlashingCount),
    roofPipeBootCount: num(measurements?.roofPipeBootCount),
    roofVentCount: num(measurements?.roofVentCount),
    roofTurbineVentCount: num(measurements?.roofTurbineVentCount),
    roofSkylightCount: num(measurements?.roofSkylightCount),
    roofPenetrationCount: num(measurements?.roofPenetrationCount),
    roofRepairAffectedSqft: num(measurements?.roofRepairAffectedSqft),
    roofGutterLf: num(measurements?.roofGutterLf),
    roofDownspoutCount: num(measurements?.roofDownspoutCount),
    drywallSqft: num(measurements?.drywallSqft),
    drywallWallSqft: num(measurements?.drywallWallSqft),
    drywallCeilingSqft: num(measurements?.drywallCeilingSqft),
    drywallOpeningDeductionSqft: num(measurements?.drywallOpeningDeductionSqft),
    garageWallDrywallSqft: num(measurements?.garageWallDrywallSqft),
    garageCeilingDrywallSqft: num(measurements?.garageCeilingDrywallSqft),
    moistureResistantDrywallSqft: num(
      measurements?.moistureResistantDrywallSqft ??
        measurements?.drywallMoistureResistantSqft
    ),
    fireRatedDrywallSqft: num(
      measurements?.fireRatedDrywallSqft ??
        measurements?.drywallGarageFireRatedSqft
    ),
    specialtyDrywallSqft: num(measurements?.specialtyDrywallSqft),
    highCeilingDrywallSqft: num(
      measurements?.highCeilingDrywallSqft ??
        measurements?.drywallHighCeilingSqft
    ),
    vaultedCeilingDrywallSqft: num(
      measurements?.vaultedCeilingDrywallSqft ??
        measurements?.drywallVaultedSlopedSqft
    ),
    level5FinishSqft: num(measurements?.level5FinishSqft),
    exteriorWallGrossSqft: num(measurements?.exteriorWallGrossSqft),
    exteriorWallInsulationSqft: num(measurements?.exteriorWallInsulationSqft),
    atticInsulationSqft: num(measurements?.atticInsulationSqft),
    insulatedRoofDeckSqft: num(measurements?.insulatedRoofDeckSqft),
    floorInsulationSqft: num(measurements?.floorInsulationSqft),
    garageSeparationInsulationSqft: num(
      measurements?.garageSeparationInsulationSqft
    ),
    insulatedGarageWallSqft: num(measurements?.insulatedGarageWallSqft),
    insulatedGarageCeilingSqft: num(measurements?.insulatedGarageCeilingSqft),
    openingDeductionSqft: num(measurements?.openingDeductionSqft),
    insulationMaterialType: measurements?.insulationMaterialType ?? null,
    insulationRValue: measurements?.insulationRValue ?? null,
    garageInsulationIncluded: measurements?.garageInsulationIncluded ?? null,
    insulationAssemblies: copyInsulationAssemblyFields(
      measurements as Record<string, unknown>
    ),
    planFacts: measurements?.planFacts,
    quickMeasurementSources: measurements?.quickMeasurementSources,
    concreteSqft: num(measurements?.concreteSqft),
    concreteReinforcementSqft: num(measurements?.concreteReinforcementSqft),
    concreteSealerSqft: num(measurements?.concreteSealerSqft),
    concreteSubgradePrepSqft: num(measurements?.concreteSubgradePrepSqft),
    concreteThicknessInches: num(measurements?.concreteThicknessInches),
    complexFormingLf: num(measurements?.complexFormingLf),
    additionalHaulOffLoadCount: num(measurements?.additionalHaulOffLoadCount),
    concreteDemoSqft: num(measurements?.concreteDemoSqft),
    concreteDemoThicknessBand: measurements?.concreteDemoThicknessBand ?? null,
    concreteDemoThicknessBands:
      measurements?.concreteDemoThicknessBands ?? null,
    concreteDemoAreaByThickness:
      measurements?.concreteDemoAreaByThickness ?? null,
    concreteDemoReinforced: measurements?.concreteDemoReinforced ?? null,
    concreteDemoLimitedAccess: measurements?.concreteDemoLimitedAccess ?? null,
    concreteDemoCy: num(measurements?.concreteDemoCy),
    concreteCy: num(measurements?.concreteCy),
    excavationCy: num(measurements?.excavationCy),
    excavationAreaSqft: num(measurements?.excavationAreaSqft),
    excavationDepthInches: num(measurements?.excavationDepthInches),
    deckSqft: num(measurements?.deckSqft),
    garageSqft: num(measurements?.garageSqft),
    exteriorPaintSqft: num(measurements?.exteriorPaintSqft),
    stuccoGrossWallSqft: num(measurements?.stuccoGrossWallSqft),
    stuccoWindowDoorOpeningSqft: num(measurements?.stuccoWindowDoorOpeningSqft),
    stuccoGarageOpeningSqft: num(measurements?.stuccoGarageOpeningSqft),
    stuccoOtherFinishDeductionSqft: num(
      measurements?.stuccoOtherFinishDeductionSqft
    ),
    stuccoNetWallSqft: num(measurements?.stuccoNetWallSqft),
    stuccoSoffitSqft: num(measurements?.stuccoSoffitSqft),
    stuccoParapetSqft: num(measurements?.stuccoParapetSqft),
    stuccoFoamTrimLf: num(measurements?.stuccoFoamTrimLf),
    stuccoControlJointLf: num(measurements?.stuccoControlJointLf),
    stuccoAccessAffectedSqft: num(measurements?.stuccoAccessAffectedSqft),
    stuccoRepairAffectedSqft: num(measurements?.stuccoRepairAffectedSqft),
    stuccoStories: num(measurements?.stuccoStories),
    stuccoWallHeightFt: num(measurements?.stuccoWallHeightFt),
    railingLf: num(measurements?.railingLf),
    baseboardLf: num(measurements?.baseboardLf) ?? num(measurements?.lf),
    interiorDoorCount: num(measurements?.interiorDoorCount),
    windowCount: num(measurements?.windowCount),
    exteriorDoorCount: num(measurements?.exteriorDoorCount),
    slidingDoorCount: num(measurements?.slidingDoorCount),
    cabinetPaintSqft: num(measurements?.cabinetPaintSqft),
    cabinetUpperLf: num(measurements?.cabinetUpperLf),
    cabinetLowerLf: num(measurements?.cabinetLowerLf),
    cabinetTallLf: num(measurements?.cabinetTallLf),
    cabinetRunLf: num(measurements?.cabinetRunLf),
    showerWallTileSqft: num(measurements?.showerWallTileSqft),
    showerFloorTileSqft: num(measurements?.showerFloorTileSqft),
    wallPaintSqft: num(measurements?.wallPaintSqft),
    ceilingPaintSqft: num(measurements?.ceilingPaintSqft),
    paintAreaSqft: num(measurements?.paintAreaSqft),
    combinedPaintableAreaSqft:
      num(measurements?.combinedPaintableAreaSqft) ??
      (measurements?.paintPricingMethod === 'combined'
        ? num(measurements?.paintAreaSqft)
        : null),
    serviceCallCount: num(measurements?.serviceCallCount),
    fixtureRepairCount: num(measurements?.fixtureRepairCount),
    fixtureReplacementCount: num(measurements?.fixtureReplacementCount),
    drainCleaningCount: num(measurements?.drainCleaningCount),
    waterLineLf: num(measurements?.waterLineLf),
    sewerLineLf: num(measurements?.sewerLineLf),
    gasLineLf: num(measurements?.gasLineLf),
    plumbingRoughPointCount: num(measurements?.plumbingRoughPointCount),
    plumbingTrimHookupCount: num(measurements?.plumbingTrimHookupCount),
    plumbingFixturesHardwareCount: num(
      measurements?.plumbingFixturesHardwareCount
    ),
    waterHeaterCount: num(measurements?.waterHeaterCount),
    gasApplianceConnectionCount: num(measurements?.gasApplianceConnectionCount),
    partsMaterialsCount: num(measurements?.partsMaterialsCount),
    emergencyFeeCount: num(measurements?.emergencyFeeCount),
    plumbingCleanupCount: num(measurements?.plumbingCleanupCount),
    bathCount:
      measurements?.bathCount != null && Number(measurements.bathCount) > 0
        ? Math.round(Number(measurements.bathCount))
        : null,
    prefabBathCount:
      measurements?.prefabBathCount != null &&
      Number(measurements.prefabBathCount) > 0
        ? Math.round(Number(measurements.prefabBathCount))
        : null,
    tubBathCount:
      measurements?.tubBathCount != null &&
      Number(measurements.tubBathCount) > 0
        ? Math.round(Number(measurements.tubBathCount))
        : null,
    showerDoorCount:
      measurements?.showerDoorCount != null &&
      Number(measurements.showerDoorCount) > 0
        ? Math.round(Number(measurements.showerDoorCount))
        : null,
    garageDoorSingleCount:
      measurements?.garageDoorSingleCount != null &&
      Number(measurements.garageDoorSingleCount) > 0
        ? Math.round(Number(measurements.garageDoorSingleCount))
        : null,
    garageDoorDoubleCount:
      measurements?.garageDoorDoubleCount != null &&
      Number(measurements.garageDoorDoubleCount) > 0
        ? Math.round(Number(measurements.garageDoorDoubleCount))
        : null,
    garageDoorRvCount:
      measurements?.garageDoorRvCount != null &&
      Number(measurements.garageDoorRvCount) > 0
        ? Math.round(Number(measurements.garageDoorRvCount))
        : null,
    garageDoorOpenerCount:
      measurements?.garageDoorOpenerCount != null &&
      Number(measurements.garageDoorOpenerCount) > 0
        ? Math.round(Number(measurements.garageDoorOpenerCount))
        : null,
    framingOpeningCount:
      measurements?.framingOpeningCount != null &&
      Number(measurements.framingOpeningCount) > 0
        ? Math.round(Number(measurements.framingOpeningCount))
        : null,
    reframingRequested:
      measurements?.reframingRequested === true ? true : null,
    ...copyElectricalQuantityFields(
      measurements as Record<string, unknown>,
      num
    ),
    measurementProvenance: measurements?.measurementProvenance,
    measurementConflicts: measurements?.measurementConflicts,
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

/** Meaningful count units only — hide generic "each" when the label already says "count". */
export function formatCountFieldSuffix(
  unit: string | null | undefined
): string | undefined {
  const normalized = String(unit || '').toLowerCase();
  if (
    !normalized ||
    normalized === 'each' ||
    normalized === 'ea' ||
    normalized === 'count'
  ) {
    return undefined;
  }
  return formatUnitLabel(normalized);
}

export function formatDualCountQuantity(
  quantity: number,
  unit?: string | null
): string {
  const suffix = formatCountFieldSuffix(unit);
  return suffix
    ? `${quantity.toLocaleString()} ${suffix}`
    : quantity.toLocaleString();
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

function aggregatedMeasurementSourceLabel(
  parts: number,
  keys?: Array<keyof NormalizedScopeMeasurements>
): string {
  const keySet = new Set(keys || []);
  if (
    keySet.has('showerWallTileSqft') &&
    keySet.has('showerFloorTileSqft') &&
    !keySet.has('bathroomFloorSqft')
  ) {
    if (parts >= 2) return 'Shower walls + shower floor';
    return 'Shower tile tear-out';
  }
  if (
    keySet.has('bathroomFloorSqft') &&
    !keySet.has('showerWallTileSqft') &&
    !keySet.has('showerFloorTileSqft')
  ) {
    return 'Bathroom floor tile';
  }
  if (parts >= 3) return 'Floor + shower walls + shower floor';
  if (parts === 2) return 'Combined tear-out sqft';
  return 'From room measurement';
}

export function notesHaveCombinedCabinetsCounters(
  notes?: string | null
): boolean {
  const n = String(notes || '').toLowerCase();
  return (
    /\b(cabinets?|cabinetry)\b/.test(n) &&
    /\b(counters?|countertops?|quartz|granite)\b/.test(n)
  );
}

function parsedNotesItemQuantities(
  notes?: string | null,
  templateKey?: string | null
): Record<string, ScopeItemQuantityValue> {
  const text = String(notes || '').trim();
  if (!text) return {};
  const parsed = parseScopeMeasurementsFromNotes(text, {
    templateKey: templateKey ?? undefined,
  });
  return (parsed.itemQuantities || {}) as Record<
    string,
    ScopeItemQuantityValue
  >;
}

function resolvedQuantityFromNotes(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  ctx: { templateKey?: string | null; notes?: string | null }
): ResolvedItemQuantity | null {
  const rule = getChecklistItemQuantityRule(itemId, ctx.templateKey);
  if (!rule || !ctx.notes) return null;

  const fromNotes = parsedNotesItemQuantities(ctx.notes, ctx.templateKey);
  const linkedCountertop = resolveLinkedCountertopAllowance(
    itemId,
    measurements,
    ctx.notes
  );
  if (linkedCountertop) return linkedCountertop;

  if (rule.dualAllowanceField) {
    const countMeasurement =
      itemId === 'floor_demo' && measurements.floorAreaSqft
        ? { quantity: measurements.floorAreaSqft, unit: 'sqft' }
        : rule.measurementKey && measurements[rule.measurementKey]
          ? {
              quantity: Number(measurements[rule.measurementKey]),
              unit: measurementUnitForKey(
                rule.measurementKey,
                rule.defaultUnit
              ),
            }
          : ((rule.measurementKeys || [])
              .map(key =>
                measurements[key]
                  ? {
                      quantity: Number(measurements[key]),
                      unit: measurementUnitForKey(key, rule.defaultUnit),
                    }
                  : null
              )
              .find(
                entry => entry?.quantity != null && Number(entry.quantity) > 0
              ) ?? null);
    let countEntry =
      countMeasurement && Number(countMeasurement.quantity) > 0
        ? {
            quantity: Number(countMeasurement.quantity),
            unit: countMeasurement.unit,
            quantitySource: 'inferred' as const,
          }
        : null;
    const allowanceEntry = parseStoredItemQuantity(
      measurements,
      roughAllowanceSubKey(itemId)
    );
    const legacyAllowance =
      !allowanceEntry &&
      fromNotes[itemId] &&
      ['allowance', 'lump_sum'].includes(fromNotes[itemId].unit || '')
        ? parseStoredItemQuantity(measurements, itemId)
        : null;
    const { effectiveAllowance, materialEntry, laborEntry } =
      applyRatePricingBreakdown(
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
const KITCHEN_CHECKLIST_ITEM_QUANTITY_RULES: Record<
  string,
  ScopeItemQuantityRule
> = {
  demo: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance', 'lf'],
    defaultQuantity: 1,
    quantityHelper:
      'Assuming 1 cabinet/counter demo lump sum. Edit LF if priced by run.',
  },
  floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['kitchenFloorSqft', 'floorAreaSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter kitchen floor sqft for flooring removal.',
    missingMessage: 'Enter kitchen floor demo sqft.',
  },
  backsplash_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'backsplashSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter backsplash sqft for removal.',
    missingMessage: 'Enter backsplash demo sqft.',
  },
  electrical: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.electrical,
    quantityHelper:
      'Enter the quantity for each selected electrical work type. Lighting fixtures and installation are separate.',
  },
  flooring: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.flooring,
    measurementKeys: [
      'kitchenFloorSqft',
      'flooringSqft',
      'floorAreaSqft',
      'bathroomFloorSqft',
    ],
    quantityHelper: 'Enter kitchen floor sqft for flooring install.',
    missingMessage: 'Enter kitchen floor sqft.',
  },
};

/** Bathroom shares checklist ids with kitchen — shower demo vs bath floor demo are separate lines. */
const BATHROOM_CHECKLIST_ITEM_QUANTITY_RULES: Record<
  string,
  ScopeItemQuantityRule
> = {
  demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    aggregateMeasurementKeys: ['showerWallTileSqft', 'showerFloorTileSqft'],
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    quantityHelper:
      'Enter shower wall + pan tear-out SF (~$5.50/SF). Tub/prefab pan $350 · enclosure $600 · door $125 from Demo / tear-out counts.',
    missingMessage: 'Enter shower tile demo sqft.',
  },
  floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['bathroomFloorSqft'],
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    quantityHelper:
      'Enter bathroom floor demo SF — priced ~$5.50/SF (separate from shower demo).',
    missingMessage: 'Enter bathroom floor demo sqft.',
  },
  plumbing_rough: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.plumbing_rough,
    quantityHelper:
      'Pick fixture type, same-location vs relocated, whether remodel demolition exposes the plumbing, and floor construction. Valve, head, and drain rough-in only — toilet and lav are on Toilet and Vanity.',
    missingMessage:
      'Select work type and plumbing exposure, or enter shower/tub rough-in pricing.',
  },
  drywall: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.drywall,
    quantityHelper:
      'Enter localized patch SF at shower or plumbing openings (wall surface, not floor). Primer and paint are on Interior painting/patch and repair.',
    missingMessage: 'Enter patch/repair SF to price drywall and texture.',
  },
  patch_repair: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.patch_repair,
    quantityHelper:
      'Enter localized patch SF at shower or plumbing openings (wall surface, not floor). Primer and paint are separate.',
    missingMessage: 'Enter patch/repair SF to price drywall and texture.',
  },
  paint_repair: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'each', 'allowance', 'lump_sum'],
    // Patch SF is stored on paint_repair only — do not inherit global drywallSqft.
    requiresUserQuantity: true,
    quantityHelper:
      'Enter patch SF (affected area) or room wall/ceiling SF (full room), pick paint scope above, then apply pricing. Quick measurements Paint can pre-fill room SF.',
    missingMessage: 'Enter SF and select paint scope.',
  },
  windows_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKeys: [
      'windowCount',
      'exteriorDoorCount',
      'slidingDoorCount',
      'interiorDoorCount',
    ],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Window, exterior swing door, sliding/patio door, and interior door counts. Garage doors are a separate trade.',
    missingMessage: 'Enter window/door counts or pricing.',
  },
  windows: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'windowCount',
    measurementKeys: ['windowCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Window units and standard install. Count × national size tier when plan schedule dimensions are available (~$740/ea standard). Trim on Opening trim & finish add-on.',
    missingMessage: 'Enter window count or pricing.',
  },
  exterior_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'exteriorDoorCount',
    measurementKeys: ['exteriorDoorCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Exterior swing / French entry doors — standard ~$1,650/ea. Upgraded, glass, and double units price higher when plan sizes are available. Trim on Opening trim & finish add-on.',
    missingMessage: 'Enter exterior door count or pricing.',
  },
  sliding_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'slidingDoorCount',
    measurementKeys: ['slidingDoorCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Sliding / patio doors — standard 2-panel ~$3,400/ea. Large and multi-panel units price higher when plan sizes are available. Trim on Opening trim & finish add-on.',
    missingMessage: 'Enter sliding door count or pricing.',
  },
  garage_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKeys: [
      'garageDoorSingleCount',
      'garageDoorDoubleCount',
      'garageDoorRvCount',
    ],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Garage door units, tracks, hardware, and installation, priced by single, double, or RV/oversized type. Structural reframing is separate.',
    missingMessage: 'Enter garage door type counts or pricing.',
  },
  interior_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'interiorDoorCount',
    measurementKeys: ['interiorDoorCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Prehung interior door units, jambs, hinges, and standard hardware install. Casing and finish are on the Opening trim & finish add-on.',
    missingMessage: 'Enter interior door count or pricing.',
  },
  trim_finish: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'trimFinishLf',
    measurementKeys: [
      'trimFinishLf',
      'windowCount',
      'exteriorDoorCount',
      'slidingDoorCount',
      'interiorDoorCount',
    ],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper: OPENING_TRIM_FINISH_SCOPE_HELPER,
    missingMessage: 'Select trim coverage/grade and confirm LF or pricing.',
  },
  garage_door_openers: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'garageDoorOpenerCount',
    measurementKeys: ['garageDoorOpenerCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Count garage door openers only when labeled or specified. Do not assume one opener per door.',
    missingMessage: 'Enter garage door opener count or pricing.',
  },
  openings: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'framingOpeningCount',
    measurementKeys: ['framingOpeningCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Structural reframing only for an explicitly new, resized, enlarged, or reframed opening.',
    missingMessage: 'Enter reframed/new opening count or pricing.',
  },
};

/** Per-product install SF from Quick measurements — not the rolled-up flooringSqft total. */
const FLOORING_PRODUCT_SQFT_MEASUREMENT_KEY: Record<string, string> = {
  flooring_lvp: 'flooringLvpSqft',
  flooring_laminate: 'flooringLaminateSqft',
  flooring_engineered_hardwood: 'flooringEngineeredHardwoodSqft',
  flooring_solid_hardwood: 'flooringSolidHardwoodSqft',
  tile_flooring: 'flooringTileSqft',
  flooring_carpet: 'flooringCarpetSqft',
  flooring_sheet_vinyl: 'flooringSheetVinylSqft',
};

export function hasFlooringProductTakeoff(
  itemId: string,
  measurements: Record<string, unknown>
): boolean {
  const key = FLOORING_PRODUCT_SQFT_MEASUREMENT_KEY[itemId];
  if (!key) return false;
  const val = parseScopeMeasurementInput(String(measurements[key] ?? ''));
  return val != null && val > 0;
}

const FLOORING_CHECKLIST_ITEM_QUANTITY_RULES: Record<
  string,
  ScopeItemQuantityRule
> = {
  floor_prep: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.floor_prep,
    measurementKey: 'floorPrepSqft',
    measurementKeys: ['floorPrepSqft'],
    quantityHelper: 'Enter only the area requiring subfloor or floor prep.',
    missingMessage: 'Enter prep area sqft.',
  },
  trim: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.trim,
    measurementKey: 'baseboardLf',
    quantityHelper: 'Enter baseboard and trim linear feet.',
    missingMessage: 'Enter baseboard/trim LF.',
  },
};

const FRAMING_CHECKLIST_ITEM_QUANTITY_RULES: Record<
  string,
  ScopeItemQuantityRule
> = {
  framing: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['framedAreaSqft', 'floorAreaSqft', 'garageSqft'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Covered framed SF — living plus garage when documented. Sheathing is a separate card.',
    missingMessage: 'Enter framed floor area sqft or pricing.',
  },
  wall_framing: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'wallFramingLf',
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Enter stud wall LF when documented — separate from shell SF framing.',
    missingMessage: 'Enter wall framing LF or pricing.',
  },
  shear_sheathing: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['sheathingSqft', 'stuccoGrossWallSqft'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper: 'Enter structural sheathing SF when documented.',
    missingMessage: 'Enter sheathing SF or pricing.',
  },
  openings: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'framingOpeningCount',
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper: 'Count each documented door/window rough opening.',
    missingMessage: 'Enter opening count or pricing.',
  },
  cleanup: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.cleanup,
    measurementKey: 'framingCleanupCount',
    defaultQuantity: 1,
    quantityHelper:
      'Framing scrap haul-off and jobsite cleanup when explicitly in scope.',
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

const ADDITION_CHECKLIST_ITEM_QUANTITY_RULES: Record<
  string,
  ScopeItemQuantityRule
> = {
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
  foundation: {
    defaultUnit: 'cy',
    allowedUnits: ['cy', 'sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteCy'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter foundation / slab concrete CY for material and labor.',
    missingMessage:
      'Needs structural takeoff (slab/footings/walls/CY). Living SF is not foundation quantity.',
  },
  concrete: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.concrete,
    defaultUnit: 'cy',
    measurementKeys: ['concreteCy', 'concreteSqft'],
    quantityHelper:
      'Enter foundation concrete CY, or flatwork sqft if this is slab/flatwork.',
    missingMessage: 'Enter foundation concrete CY or flatwork sqft.',
  },
  framing: additionFloorAreaRule(
    'Enter framed floor area sqft, or price framing with lump sum/material/labor.',
    'Enter framing sqft or pricing.'
  ),
  roof_tie_in: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['roofSquares'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter roof squares for tie-in material and labor.',
    missingMessage: 'Enter roof squares or pricing.',
  },
  windows_doors: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.windows_doors,
  },
  windows: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.windows,
  },
  exterior_doors: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.exterior_doors,
  },
  sliding_doors: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.sliding_doors,
  },
  garage_doors: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.garage_doors,
  },
  interior_doors: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.interior_doors,
  },
  trim_finish: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.trim_finish,
  },
  garage_door_openers: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.garage_door_openers,
  },
  openings: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.openings,
  },
  exterior_finishes: additionFloorAreaRule(
    'Enter exterior finish area sqft, or price with lump sum/material/labor.',
    'Enter exterior finish sqft or pricing.'
  ),
  hvac: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'ton', 'allowance', 'lump_sum'],
    measurementKeys: ['hvacSystemCount', 'hvacSystemTons'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Enter HVAC system count and labeled capacity (tons) separately — not living SF.',
    missingMessage: 'Enter HVAC system count, capacity, or pricing.',
  },
  insulation: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: [
      'exteriorWallGrossSqft',
      'exteriorWallInsulationSqft',
      'openingDeductionSqft',
    ],
    requiresUserQuantity: true,
    quantityHelper:
      'Use net walls plus a confirmed attic/ceiling or insulated roof-deck SF. Do not invent missing surfaces from living area.',
    missingMessage: 'Needs whole-house insulation surface takeoff',
  },
  drywall: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.drywall,
    measurementKey: 'drywallSqft',
    quantityHelper:
      'Enter drywall sqft, or price drywall with lump sum/material/labor.',
  },
  paint: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.paint,
    measurementKey: 'wallPaintSqft',
    quantityHelper: 'Enter paint sqft and/or calculated material/labor totals.',
  },
  flooring: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.flooring,
    measurementKeys: ['flooringSqft', 'floorAreaSqft'],
    quantityHelper:
      'Enter flooring sqft and/or calculated material/labor totals.',
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
const GROUND_UP_CHECKLIST_ITEM_QUANTITY_RULES: Record<
  string,
  ScopeItemQuantityRule
> = {
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
    quantityHelper:
      'Enter foundation / slab concrete CY for material and labor.',
    missingMessage:
      'Needs structural takeoff (slab/footings/walls/CY). Living SF is not foundation quantity.',
  },
  pour_flatwork: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteSqft'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Enter exterior flatwork SF (driveway, walks, porch) — not house/garage slab. Local allowance when SF is unknown.',
    missingMessage:
      'Needs exterior flatwork SF (driveway / walks / porch), or use local allowance.',
  },
  framing: additionFloorAreaRule(
    'Uses covered framed area (living + garage) for planning — edit if deck/patio framing is included.',
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
    measurementKeys: ['stuccoNetWallSqft', 'exteriorPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter exterior wall surface SF for stucco material and labor.',
    missingMessage: 'Needs exterior wall surface SF for stucco.',
  },
  stucco_wrb: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['stuccoNetWallSqft', 'exteriorPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Uses net stucco wall SF when included.',
    missingMessage: 'Needs net stucco wall SF or an allowance.',
  },
  stucco_lath: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['stuccoNetWallSqft', 'exteriorPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Uses net stucco wall SF when included.',
    missingMessage: 'Needs net stucco wall SF or an allowance.',
  },
  stucco_base_coat: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['stuccoNetWallSqft', 'exteriorPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper:
      'Uses net stucco wall SF; one-coat systems should replace scratch/brown pricing.',
    missingMessage: 'Needs net stucco wall SF or an allowance.',
  },
  stucco_finish_coat: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['stuccoNetWallSqft', 'exteriorPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Uses net stucco wall SF.',
    missingMessage: 'Needs net stucco wall SF or an allowance.',
  },
  stucco_foam_trim: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKeys: ['stuccoFoamTrimLf'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter architectural foam trim / band LF.',
    missingMessage: 'Needs foam trim LF or an allowance.',
  },
  stucco_accessories: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    measurementKeys: [],
    requiresUserQuantity: false,
    quantityHelper:
      'Accessory allowance for bead, screed, joints, and flashing details.',
  },
  stucco_soffits: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['stuccoSoffitSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter soffit / stucco ceiling SF.',
    missingMessage: 'Needs soffit SF or an allowance.',
  },
  stucco_parapets: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['stuccoParapetSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter parapet / raised wall SF.',
    missingMessage: 'Needs parapet SF or an allowance.',
  },
  stucco_access: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['stuccoAccessAffectedSqft'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter affected wall SF only; standard ground access has no premium.',
    missingMessage: 'Needs affected access SF or custom pricing.',
  },
  stucco_repairs: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['stuccoRepairAffectedSqft'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter affected repair SF only; do not use total net stucco area.',
    missingMessage: 'Needs affected repair SF or custom pricing.',
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
    measurementKeys: ['hvacSystemCount', 'hvacSystemTons'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Enter HVAC system count and labeled capacity (tons) separately — not living SF.',
    missingMessage: 'Enter HVAC system count, capacity, or pricing.',
  },
  windows_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKeys: [
      'windowCount',
      'exteriorDoorCount',
      'slidingDoorCount',
      'interiorDoorCount',
    ],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Legacy combined openings — prefer Windows / Exterior doors / Sliding / Garage doors.',
    missingMessage: 'Enter window/door count or pricing.',
  },
  windows: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'windowCount',
    measurementKeys: ['windowCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Enter window count for material and labor. Do not use living SF as a substitute for counts.',
    missingMessage: 'Enter window count or pricing.',
  },
  exterior_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'exteriorDoorCount',
    measurementKeys: ['exteriorDoorCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Enter exterior swing door count (entry/exit). Not sliding or garage.',
    missingMessage: 'Enter exterior door count or pricing.',
  },
  sliding_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'slidingDoorCount',
    measurementKeys: ['slidingDoorCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Enter exterior sliding / patio door count for material and labor.',
    missingMessage: 'Enter sliding door count or pricing.',
  },
  garage_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKeys: [
      'garageDoorSingleCount',
      'garageDoorDoubleCount',
      'garageDoorRvCount',
    ],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Set single / double / RV garage door counts — pricing is by type (double ~$2,400; double+RV ~$10,700 locally).',
    missingMessage: 'Enter garage door type counts or pricing.',
  },
  interior_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'interiorDoorCount',
    measurementKeys: ['interiorDoorCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Prehung interior door units, jambs, hinges, and standard hardware install. Casing and finish are on the Opening trim & finish add-on.',
    missingMessage: 'Enter interior door count or pricing.',
  },
  trim_finish: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'trimFinishLf',
    measurementKeys: [
      'trimFinishLf',
      'windowCount',
      'exteriorDoorCount',
      'slidingDoorCount',
      'interiorDoorCount',
    ],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper: OPENING_TRIM_FINISH_SCOPE_HELPER,
    missingMessage: 'Select trim coverage/grade and confirm LF or pricing.',
  },
  garage_door_openers: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    measurementKey: 'garageDoorOpenerCount',
    measurementKeys: ['garageDoorOpenerCount'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Count garage door openers only when labeled or specified. Do not assume one opener per door.',
    missingMessage: 'Enter garage door opener count or pricing.',
  },
  openings: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.openings,
  },
  insulation: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: [
      'exteriorWallGrossSqft',
      'exteriorWallInsulationSqft',
      'openingDeductionSqft',
    ],
    requiresUserQuantity: true,
    quantityHelper:
      'Use net walls plus a confirmed attic/ceiling or insulated roof-deck SF. Do not invent missing surfaces from living area.',
    missingMessage: 'Needs whole-house insulation surface takeoff',
  },
  drywall: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: [
      'drywallSqft',
      'drywallWallSqft',
      'drywallCeilingSqft',
      'drywallOpeningDeductionSqft',
      'garageWallDrywallSqft',
      'garageCeilingDrywallSqft',
      'moistureResistantDrywallSqft',
      'fireRatedDrywallSqft',
      'specialtyDrywallSqft',
      'highCeilingDrywallSqft',
      'vaultedCeilingDrywallSqft',
      'level5FinishSqft',
    ],
    requiresUserQuantity: true,
    quantityHelper:
      'Uses net wall + ceiling drywall surface sqft for board, hang, mud/tape, finish, and standard texture.',
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
    quantityHelper:
      'Uses flooring / living area from the plan — edit if needed.',
    missingMessage: 'Enter flooring sqft or pricing.',
  },
  paint_trim: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['wallPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper:
      'Enter wall/ceiling paint surface sqft for material and labor.',
    missingMessage: 'Enter paint surface sqft or pricing.',
  },
  interior_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['wallPaintSqft'],
    requiresUserQuantity: false,
    quantityHelper:
      'Paintable wall/ceiling SF is the physical quantity. Local paint budgets are installed lump sums (living SF is only the benchmark denominator).',
    missingMessage:
      'Enter paint surface sqft or apply the local installed paint budget.',
  },
  exterior_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['exteriorPaintSqft'],
    requiresUserQuantity: true,
    quantityHelper:
      'Exterior paint application for siding, stucco, soffit, and fascia. Prep, masking, heavy repairs, access work, and specialty coatings are separate.',
    missingMessage: 'Enter exterior paint surface sqft or pricing.',
  },
  interior_trim: {
    // Finish-carpentry barometer returns material + labor — keep as a trade split, not a soft-cost lump.
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    lumpSumOnly: false,
    requiresUserQuantity: false,
    quantityHelper:
      'Finish trim, interior doors, door hardware & shelving package until baseboard/casing/door takeoff exists.',
    missingMessage: 'Apply the finish-carpentry package or enter an allowance.',
  },
  plumbing_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    lumpSumOnly: false,
    requiresUserQuantity: false,
    quantityHelper:
      'Plumbing fixtures & trim package (material + install) until fixture schedule takeoff. Not plumbing rough-in.',
    missingMessage:
      'Apply the plumbing fixtures package or enter material and labor.',
  },
  electrical_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    lumpSumOnly: false,
    requiresUserQuantity: false,
    quantityHelper:
      'Electrical fixtures package (material + install) until lighting schedule takeoff. Not electrical rough-in.',
    missingMessage:
      'Apply the electrical fixtures package or enter material and labor.',
  },
  landscaping: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum', 'sqft'],
    measurementKeys: ['landscapeSqft'],
    lumpSumOnly: false,
    requiresUserQuantity: false,
    quantityHelper:
      'Landscaping / site walls / fences & gates package (material + labor) until site-plan takeoff. Not driveway flatwork.',
    missingMessage:
      'Apply the landscaping package or enter material and labor.',
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
  quantityHelper:
    'Enter material and labor pricing for this scope using the right job basis.',
  missingMessage: 'Needs pricing',
};

export function usesAllowanceSplitEditor(rule: ScopeItemQuantityRule): boolean {
  return !rule.dualAllowanceField;
}

/** Applied/stored material+labor split — wins over a stale primary count (e.g. 1 allowance). */
function resolveStoredAllowanceSplitQuantity(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  rule: ScopeItemQuantityRule,
  override?: ScopeItemQuantityValue | null
): ResolvedItemQuantity | null {
  if (!usesAllowanceSplitEditor(rule)) return null;

  const materialEntry = parseStoredItemQuantity(
    measurements,
    allowanceSplitSubKey(itemId, 'material')
  );
  const laborEntry = parseStoredItemQuantity(
    measurements,
    allowanceSplitSubKey(itemId, 'labor')
  );
  const storedAllowance = parseStoredItemQuantity(
    measurements,
    allowanceSplitSubKey(itemId, 'allowance')
  );
  const storedBasis = parseStoredItemQuantity(
    measurements,
    allowanceSplitSubKey(itemId, 'sqft_basis')
  );
  const splitTotal =
    (materialEntry?.quantity ?? 0) + (laborEntry?.quantity ?? 0);

  const overrideMoney =
    override &&
    ['allowance', 'lump_sum'].includes(
      String(override.unit || '').toLowerCase()
    ) &&
    override.quantity != null &&
    override.quantity > 0 &&
    !isPlaceholderAllowancePricing(override.quantity, override.unit, itemId)
      ? override.quantity
      : null;

  const total =
    storedAllowance?.quantity ??
    (splitTotal > 0 ? splitTotal : null) ??
    (overrideMoney != null && overrideMoney > (rule.defaultQuantity ?? 1)
      ? overrideMoney
      : null);

  if (total == null || total <= 0) return null;

  const physicalOverride =
    override &&
    override.quantity != null &&
    override.quantity > 0 &&
    !['allowance', 'lump_sum'].includes(
      normalizeBasisUnit(String(override.unit || ''))
    ) &&
    !plumbingStoredQuantityLooksLikeDollarTotal(
      itemId,
      override,
      measurements.itemQuantities
    )
      ? override
      : null;

  const quantitySource =
    storedAllowance?.quantitySource ||
    materialEntry?.quantitySource ||
    laborEntry?.quantitySource ||
    override?.quantitySource ||
    'user_entered';

  // Split pricing stores both the dollar total and the physical takeoff. The
  // card must display the takeoff (for example, 50 sqft), never the dollar
  // total (for example, $108.50) as if it were a measurement.
  return {
    quantity: physicalOverride
      ? physicalOverride.quantity
      : storedBasis?.quantity > 0
        ? storedBasis.quantity
        : total,
    unit: physicalOverride
      ? normalizeBasisUnit(String(physicalOverride.unit || rule.defaultUnit))
      : storedBasis?.quantity > 0
        ? storedBasis.unit
        : 'allowance',
    quantitySource,
    sourceLabel: sourceLabel(quantitySource),
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
  };
}

/** Primary item quantity after Apply — never store a count (1 allowance) as the dollar total. */
export function primaryQuantityForAppliedSuggestedBlock(
  block: SuggestedPricingBlock,
  rule: ScopeItemQuantityRule
): { quantity: string; unit: string } {
  const basisUnit = normalizeBasisUnit(
    block.basis?.unit || rule.defaultUnit || 'allowance'
  );
  const basisQty = block.basis?.quantity;
  const moneyBasisUnits = new Set(['allowance', 'lump_sum']);
  if (
    moneyBasisUnits.has(basisUnit) &&
    basisQty != null &&
    basisQty > 0 &&
    basisQty < block.total
  ) {
    return { quantity: String(block.total), unit: 'allowance' };
  }
  if (basisQty != null && basisQty > 0) {
    if (
      !moneyBasisUnits.has(basisUnit) &&
      block.total > 0 &&
      Math.abs(basisQty - block.total) < 0.02
    ) {
      const fallback = rule.defaultQuantity ?? 1;
      return { quantity: String(fallback), unit: basisUnit };
    }
    return { quantity: String(basisQty), unit: basisUnit };
  }
  if (!moneyBasisUnits.has(basisUnit)) {
    const fallback = rule.defaultQuantity ?? 1;
    return { quantity: String(fallback), unit: basisUnit };
  }
  return { quantity: String(block.total), unit: 'allowance' };
}

type SuggestedPricingResolvedQty = Pick<
  ResolvedItemQuantity,
  | 'quantity'
  | 'unit'
  | 'quantitySource'
  | 'dualCount'
  | 'dualMaterial'
  | 'dualLabor'
>;

/**
 * Physical takeoff count for rate × qty — never treat an applied dollar total
 * (e.g. $375 allowance) as a multiplier (375 × $375 = $140k).
 */
function resolveSuggestedPricingPhysicalCount(
  itemId: string,
  rule: ScopeItemQuantityRule,
  resolved: SuggestedPricingResolvedQty,
  unit: string,
  itemQuantities?: Record<string, ScopeItemQuantityLike>
): number | null {
  if (itemQuantities && unit === 'sqft') {
    const storedBasis = readStoredSqftPricingBasis(itemQuantities, itemId);
    if (storedBasis != null) {
      if (
        storedBasis <= 1 &&
        hasUserEnteredFlatAllowancePricing(itemQuantities, itemId)
      ) {
        // Stale 1 SF placeholder — prefer QM takeoff in the caller.
      } else {
        return storedBasis;
      }
    }
  }

  if (resolved.dualCount?.unit === unit && resolved.dualCount.quantity > 0) {
    return resolved.dualCount.quantity;
  }

  if (
    usesAllowanceSplitEditor(rule) &&
    ['allowance', 'lump_sum'].includes(unit)
  ) {
    const defaultCount = rule.defaultQuantity ?? 1;
    const mat = resolved.dualMaterial?.quantity ?? 0;
    const lab = resolved.dualLabor?.quantity ?? 0;
    const splitTotal = mat + lab;
    const qty = resolved.quantity;
    if (splitTotal > 0) {
      if (
        qty == null ||
        qty <= 0 ||
        Math.abs(qty - splitTotal) < 0.02 ||
        qty > defaultCount + 0.001
      ) {
        return defaultCount;
      }
    }
    if (
      qty != null &&
      qty > 0 &&
      resolved.unit === unit &&
      qty <= defaultCount + 0.001
    ) {
      return qty;
    }
    if (
      qty != null &&
      qty > defaultCount + 0.001 &&
      splitTotal <= 0 &&
      ['allowance', 'lump_sum'].includes(
        String(resolved.unit || '').toLowerCase()
      )
    ) {
      return defaultCount;
    }
  }

  if (
    resolved.quantity != null &&
    resolved.unit === unit &&
    resolved.quantity > 0
  ) {
    const card = plumbingCardForItemId(itemId);
    if (
      card &&
      card.unit === unit &&
      plumbingStoredQuantityLooksLikeDollarTotal(
        itemId,
        { quantity: resolved.quantity, unit: resolved.unit },
        itemQuantities
      )
    ) {
      return null;
    }
    if (
      itemQuantities &&
      hasUserEnteredFlatAllowancePricing(itemQuantities, itemId)
    ) {
      const defaultCount = rule.defaultQuantity ?? 1;
      const allowanceEntry = itemQuantities[roughAllowanceSubKey(itemId)];
      const allowanceTotal = Number(
        String(allowanceEntry?.quantity ?? '').replace(/,/g, '')
      );
      if (
        unit === rule.defaultUnit &&
        resolved.quantity > defaultCount + 0.001 &&
        (allowanceTotal > 0
          ? Math.abs(resolved.quantity - allowanceTotal) < 0.02
          : true)
      ) {
        return defaultCount;
      }
    }
    return resolved.quantity;
  }

  if (
    itemQuantities &&
    hasUserEnteredFlatAllowancePricing(itemQuantities, itemId) &&
    unit === rule.defaultUnit &&
    (rule.defaultQuantity ?? 1) > 0
  ) {
    return rule.defaultQuantity ?? 1;
  }

  return null;
}

function splitLegsFromNotes(resolved: SuggestedPricingResolvedQty): boolean {
  return (
    resolved.dualMaterial?.quantitySource === 'notes' ||
    resolved.dualLabor?.quantitySource === 'notes' ||
    resolved.quantitySource === 'notes'
  );
}

function splitLegsUserEntered(resolved: SuggestedPricingResolvedQty): boolean {
  if (
    resolved.dualMaterial?.quantity == null ||
    resolved.dualLabor?.quantity == null
  ) {
    return false;
  }
  const source = resolved.quantitySource || 'user_entered';
  return EXPLICIT_ITEM_QUANTITY_SOURCES.has(source) && source !== 'notes';
}

type PricingBasisPreference = {
  unit: string;
  measurementKeys?: Array<
    keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>
  >;
  /** When true, sum all preferred measurement keys (e.g. framing living + garage). */
  sumMeasurementKeys?: boolean;
  useFloorAreaFallback?: boolean;
};

const GLOBAL_PRICING_BASIS_PREFERENCES: Record<string, PricingBasisPreference> =
  {
    demo: {
      unit: 'sqft',
      measurementKeys: ['bathroomFloorSqft', 'floorAreaSqft'],
    },
    floor_demo: {
      unit: 'sqft',
      measurementKeys: [
        'floorDemoSqft',
        'bathroomFloorSqft',
        'kitchenFloorSqft',
        'floorAreaSqft',
      ],
    },
    adhesive_mastic_removal: {
      unit: 'sqft',
      measurementKeys: ['floorDemoSqft', 'floorAreaSqft'],
    },
    demo_removal: {
      unit: 'sqft',
      measurementKeys: [
        'concreteDemoSqft',
        'concreteSqft',
        'floorAreaSqft',
        'deckSqft',
        'drywallSqft',
      ],
    },
    floor_tile: { unit: 'sqft', measurementKeys: ['bathroomFloorSqft'] },
    flooring: {
      unit: 'sqft',
      measurementKeys: [
        'flooringSqft',
        'floorAreaSqft',
        'kitchenFloorSqft',
        'bathroomFloorSqft',
      ],
    },
    flooring_lvp: { unit: 'sqft', measurementKeys: ['flooringLvpSqft'] },
    flooring_laminate: {
      unit: 'sqft',
      measurementKeys: ['flooringLaminateSqft'],
    },
    flooring_engineered_hardwood: {
      unit: 'sqft',
      measurementKeys: ['flooringEngineeredHardwoodSqft'],
    },
    flooring_solid_hardwood: {
      unit: 'sqft',
      measurementKeys: ['flooringSolidHardwoodSqft'],
    },
    tile_flooring: { unit: 'sqft', measurementKeys: ['flooringTileSqft'] },
    flooring_carpet: { unit: 'sqft', measurementKeys: ['flooringCarpetSqft'] },
    flooring_sheet_vinyl: {
      unit: 'sqft',
      measurementKeys: ['flooringSheetVinylSqft'],
    },
    underlayment: { unit: 'sqft', measurementKeys: ['underlaymentSqft'] },
    moisture_barrier: {
      unit: 'sqft',
      measurementKeys: ['moistureBarrierSqft'],
    },
    transitions: {
      unit: 'each',
      measurementKeys: ['transitionCount', 'transitionLf'],
    },
    quarter_round: { unit: 'lf', measurementKeys: ['quarterRoundLf'] },
    floor_prep: { unit: 'sqft', measurementKeys: ['floorPrepSqft'] },
    drywall: {
      unit: 'sqft',
      measurementKeys: [
        'drywallSqft',
        'drywallWallSqft',
        'drywallCeilingSqft',
        'drywallOpeningDeductionSqft',
        'garageWallDrywallSqft',
        'garageCeilingDrywallSqft',
        'moistureResistantDrywallSqft',
        'fireRatedDrywallSqft',
        'specialtyDrywallSqft',
        'highCeilingDrywallSqft',
        'vaultedCeilingDrywallSqft',
        'level5FinishSqft',
      ],
    },
    hang: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
    finish_tape: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
    texture: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
    patch_repair: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
    paint: {
      unit: 'sqft',
      measurementKeys: ['wallPaintSqft', 'combinedPaintableAreaSqft'],
    },
    interior_paint: {
      unit: 'sqft',
      measurementKeys: ['wallPaintSqft', 'combinedPaintableAreaSqft'],
    },
    ceiling_paint: { unit: 'sqft', measurementKeys: ['ceilingPaintSqft'] },
    exterior_paint: { unit: 'sqft', measurementKeys: ['exteriorPaintSqft'] },
    prep: {
      unit: 'sqft',
      measurementKeys: [
        'wallPaintSqft',
        'ceilingPaintSqft',
        'combinedPaintableAreaSqft',
      ],
    },
    trim: { unit: 'lf', measurementKeys: ['baseboardLf'] },
    trim_paint: { unit: 'lf', measurementKeys: ['baseboardLf'] },
    door_paint: { unit: 'each', measurementKeys: ['interiorDoorCount'] },
    cabinet_paint: {
      unit: 'lf',
      measurementKeys: ['cabinetRunLf', 'cabinetPaintSqft'],
    },
    baseboard: { unit: 'lf', measurementKeys: ['baseboardLf'] },
    shower_tile: { unit: 'sqft', measurementKeys: ['showerWallTileSqft'] },
    shower_floor_tile: {
      unit: 'sqft',
      measurementKeys: ['showerFloorTileSqft'],
    },
    shower_pan: { unit: 'sqft', measurementKeys: ['showerFloorTileSqft'] },
    waterproofing: { unit: 'sqft', measurementKeys: ['showerWallTileSqft'] },
    backsplash: { unit: 'sqft', measurementKeys: ['backsplashSqft'] },
    backsplash_demo: { unit: 'sqft', measurementKeys: ['backsplashSqft'] },
    countertops: { unit: 'sqft', measurementKeys: ['countertopSqft'] },
    cabinets: { unit: 'lf', measurementKeys: ['cabinetLf'] },
    pavers: { unit: 'sqft', measurementKeys: ['paverSqft'] },
    sod_turf: { unit: 'sqft', measurementKeys: ['sodSqft'] },
    artificial_turf: { unit: 'sqft', measurementKeys: ['artificialTurfSqft'] },
    rock: { unit: 'sqft', measurementKeys: ['rockMulchSqft', 'landscapeTons'] },
    mulch: {
      unit: 'sqft',
      measurementKeys: ['rockMulchSqft', 'landscapeTons'],
    },
    plants: { unit: 'each', measurementKey: 'plantCount' },
    trees: { unit: 'each', measurementKey: 'treeCount' },
    irrigation: { unit: 'zone', measurementKeys: ['irrigationZoneCount'] },
    drainage: { unit: 'lf', measurementKeys: ['drainageLf'] },
    concrete_edging: { unit: 'lf', measurementKeys: ['concreteEdgingLf'] },
    landscape_lighting: {
      unit: 'each',
      measurementKeys: ['landscapeLightCount'],
    },
    concrete: { unit: 'sqft', measurementKeys: ['concreteSqft', 'concreteCy'] },
    pour_flatwork: {
      unit: 'sqft',
      measurementKeys: ['concreteSqft', 'concreteCy'],
    },
    concrete_patio: {
      unit: 'sqft',
      measurementKeys: ['concreteSqft', 'deckSqft', 'floorAreaSqft'],
    },
    pour_foundation: {
      unit: 'cy',
      measurementKeys: ['concreteCy', 'concreteSqft'],
    },
    excavation: { unit: 'cy', measurementKeys: ['excavationCy'] },
    trenching: { unit: 'lf' },
    utility_trenching: { unit: 'lf' },
    grading: {
      unit: 'sqft',
      measurementKeys: ['gradingSqft', 'landscapeSqft', 'floorAreaSqft'],
    },
    sitework: {
      unit: 'sqft',
      measurementKeys: ['landscapeSqft', 'floorAreaSqft'],
    },
    site_prep: {
      unit: 'sqft',
      measurementKeys: [
        'concreteSubgradePrepSqft',
        'concreteSqft',
        'landscapeSqft',
        'floorAreaSqft',
      ],
    },
    soil_prep: {
      unit: 'sqft',
      measurementKeys: ['soilPrepSqft', 'landscapeSqft'],
    },
    clearing: {
      unit: 'sqft',
      measurementKeys: ['landscapeSqft', 'floorAreaSqft'],
    },
    demo_clearing: {
      unit: 'sqft',
      measurementKeys: ['demoClearingSqft', 'landscapeSqft'],
    },
    backfill: { unit: 'cy', measurementKeys: ['excavationCy'] },
    // Soft-cost dumpster / trash haul — never excavator CY.
    haul_off: { unit: 'allowance' },
    imported_fill: { unit: 'cy', measurementKeys: ['excavationCy'] },
    railing: { unit: 'lf', measurementKeys: ['railingLf'] },
    decking: { unit: 'sqft', measurementKeys: ['deckSqft'] },
    footings_piers: { unit: 'each' },
    framing_structure: { unit: 'sqft', measurementKeys: ['deckSqft'] },
    stairs: { unit: 'each' },
    staining_sealing: { unit: 'sqft', measurementKeys: ['deckSqft'] },
    tear_off: { unit: 'squares', measurementKeys: ['roofSquares'] },
    shingles_roofing: { unit: 'squares', measurementKeys: ['roofSquares'] },
    decking_repair: {
      unit: 'sqft',
      measurementKeys: ['roofDeckingReplacementSqft'],
    },
    flashing: {
      unit: 'allowance',
      measurementKeys: [],
    },
    vents_penetrations: {
      unit: 'allowance',
      measurementKeys: [],
    },
    drip_edge: { unit: 'lf', measurementKeys: ['roofDripEdgeLf'] },
    ridge_cap: { unit: 'lf', measurementKeys: ['roofRidgeCapLf'] },
    valley_flashing: { unit: 'lf', measurementKeys: ['roofValleyFlashingLf'] },
    step_flashing: { unit: 'lf', measurementKeys: ['roofStepFlashingLf'] },
    wall_flashing: { unit: 'lf', measurementKeys: ['roofWallFlashingLf'] },
    ridge_vent: { unit: 'each', measurementKeys: ['roofRidgeVentLf'] },
    roof_vents: { unit: 'each', measurementKeys: ['roofVentCount'] },
    turbine_vents: { unit: 'each', measurementKeys: ['roofTurbineVentCount'] },
    pipe_boots: { unit: 'each', measurementKeys: ['roofPipeBootCount'] },
    chimney_flashing: {
      unit: 'each',
      measurementKeys: ['roofChimneyFlashingCount'],
    },
    skylight_flashing: {
      unit: 'each',
      measurementKeys: ['roofSkylightCount'],
    },
    roof_penetrations: {
      unit: 'each',
      measurementKeys: ['roofPenetrationCount'],
    },
    gutters: { unit: 'lf', measurementKeys: ['roofGutterLf'] },
    downspouts: { unit: 'each', measurementKeys: ['roofDownspoutCount'] },
    service_call: { unit: 'each' },
    fixture_repair: { unit: 'each' },
    fixture_replace: { unit: 'each' },
    drain_cleaning: { unit: 'lf' },
    water_line: { unit: 'lf' },
    sewer_line: { unit: 'lf' },
    gas_line: { unit: 'lf' },
    plumbing_fixtures_hardware: { unit: 'each' },
    water_heater: { unit: 'each' },
    gas_appliance_connections: { unit: 'each' },
    mobilization: { unit: 'allowance' },
    emergency_fee: { unit: 'allowance' },
    parts_materials: { unit: 'allowance' },
    materials_package: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    labor: { unit: 'hr' },
    layout: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    wall_framing: { unit: 'lf', measurementKeys: ['wallFramingLf'] },
    openings: { unit: 'each', measurementKeys: ['framingOpeningCount'] },
    shear_sheathing: {
      unit: 'sqft',
      measurementKeys: ['sheathingSqft', 'stuccoGrossWallSqft'],
    },
    framing: {
      unit: 'sqft',
      measurementKeys: ['framedAreaSqft', 'floorAreaSqft', 'garageSqft'],
    },
    hardware: { unit: 'allowance' },
    tub_demo: { unit: 'each' },
    vanity_demo: { unit: 'each' },
    countertop_demo: { unit: 'each' },
    wet_area_install: { unit: 'each' },
    tub_install: { unit: 'each' },
    prefab_shower_pan: { unit: 'each' },
    shower_pan: { unit: 'sqft', measurementKeys: ['showerFloorTileSqft'] },
    shower_niche: { unit: 'each' },
    shower_bench: { unit: 'each' },
    shower_bench_curb: { unit: 'each' },
    vanity: { unit: 'each' },
    toilet: { unit: 'each' },
    lighting: { unit: 'each' },
    exhaust_fan: { unit: 'each' },
    glass_door: { unit: 'each' },
    appliances: { unit: 'each' },
    appliance_removal: { unit: 'each' },
    sink_faucet: { unit: 'each' },
    garbage_disposal: { unit: 'each' },
    cabinet_hardware: { unit: 'each' },
    island: { unit: 'lf', measurementKeys: ['cabinetLf'] },
    plumbing: { unit: 'each' },
    electrical: { unit: 'each' },
    windows: { unit: 'each', measurementKeys: ['windowCount'] },
    exterior_doors: { unit: 'each', measurementKeys: ['exteriorDoorCount'] },
    sliding_doors: { unit: 'each', measurementKeys: ['slidingDoorCount'] },
    interior_doors: { unit: 'each', measurementKeys: ['interiorDoorCount'] },
    garage_doors: {
      unit: 'each',
      measurementKeys: [
        'garageDoorSingleCount',
        'garageDoorDoubleCount',
        'garageDoorRvCount',
      ],
      sumMeasurementKeys: true,
    },
    garage_door_openers: {
      unit: 'each',
      measurementKeys: ['garageDoorOpenerCount'],
    },
    windows_doors: { unit: 'each', measurementKeys: ['windowCount'] },
    hvac: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    walls_moving: { unit: 'lf' },
    equipment_replace: { unit: 'each' },
    refrigerant: { unit: 'lb' },
    thermostat: { unit: 'each' },
    ductwork: { unit: 'lf' },
    ventilation: { unit: 'each' },
  };

const TEMPLATE_PRICING_BASIS_PREFERENCES: Record<
  string,
  Record<string, PricingBasisPreference>
> = {
  addition: {
    sitework: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    grading: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    utility_trenching: { unit: 'lf' },
    // Same class of bug as ground-up: never pair living SF with $/CY foundation rates.
    foundation: { unit: 'cy', measurementKeys: ['concreteCy'] },
    concrete: { unit: 'cy', measurementKeys: ['concreteCy', 'concreteSqft'] },
    framing: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    roof_tie_in: { unit: 'squares', measurementKeys: ['roofSquares'] },
    windows_doors: { unit: 'each' },
    exterior_finishes: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    hvac: { unit: 'each' },
    // Insulation Edit must use thermal envelope — never living SF (Suggest rewrites living).
    insulation: { unit: 'sqft', measurementKeys: [] },
    tile: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    interior_trim: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
  },
  ground_up: {
    sitework: {
      unit: 'sqft',
      measurementKeys: ['floorAreaSqft', 'landscapeSqft'],
    },
    // Foundation / excavation: CY only — living SF × $/CY produced ~$1M on Plan 39.
    foundation: { unit: 'cy', measurementKeys: ['concreteCy'] },
    excavation: { unit: 'cy', measurementKeys: ['excavationCy'] },
    pour_flatwork: { unit: 'sqft', measurementKeys: ['concreteSqft'] },
    // Covered framed SF = living + garage (must match suggest card; never living alone).
    framing: {
      unit: 'sqft',
      measurementKeys: ['floorAreaSqft', 'garageSqft'],
      sumMeasurementKeys: true,
    },
    roofing: { unit: 'squares', measurementKeys: ['roofSquares'] },
    exterior: {
      unit: 'sqft',
      measurementKeys: ['exteriorPaintSqft', 'floorAreaSqft'],
    },
    stucco: { unit: 'sqft', measurementKeys: ['exteriorPaintSqft'] },
    drywall: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
    hang: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
    finish_tape: { unit: 'sqft', measurementKeys: ['drywallSqft'] },
    cabinets: { unit: 'lf', measurementKeys: ['cabinetLf'] },
    countertops: { unit: 'sqft', measurementKeys: ['countertopSqft'] },
    windows_doors: { unit: 'each', measurementKeys: ['windowCount'] },
    windows: { unit: 'each', measurementKeys: ['windowCount'] },
    exterior_doors: { unit: 'each', measurementKeys: ['exteriorDoorCount'] },
    sliding_doors: { unit: 'each', measurementKeys: ['slidingDoorCount'] },
    interior_doors: { unit: 'each', measurementKeys: ['interiorDoorCount'] },
    garage_doors: {
      unit: 'each',
      measurementKeys: [
        'garageDoorSingleCount',
        'garageDoorDoubleCount',
        'garageDoorRvCount',
      ],
      sumMeasurementKeys: true,
    },
    mep_rough: { unit: 'sqft', measurementKeys: ['floorAreaSqft'] },
    plumbing_rough: { unit: 'each' },
    electrical_rough: { unit: 'each' },
    hvac: { unit: 'each' },
    // Envelope planning — never seed living SF into Edit.
    insulation: { unit: 'sqft', measurementKeys: [] },
    tile_flooring: {
      unit: 'sqft',
      measurementKeys: ['flooringSqft', 'floorAreaSqft'],
    },
    // Paintable SF only — living SF must not become paint Edit basis.
    paint_trim: { unit: 'sqft', measurementKeys: ['wallPaintSqft'] },
    interior_paint: { unit: 'sqft', measurementKeys: ['wallPaintSqft'] },
    exterior_paint: { unit: 'sqft', measurementKeys: ['exteriorPaintSqft'] },
  },
  windows_doors: {
    windows: { unit: 'each', measurementKeys: ['windowCount'] },
    exterior_doors: { unit: 'each', measurementKeys: ['exteriorDoorCount'] },
    sliding_doors: { unit: 'each', measurementKeys: ['slidingDoorCount'] },
    interior_doors: { unit: 'each', measurementKeys: ['interiorDoorCount'] },
    trim_finish: {
      unit: 'lf',
      measurementKeys: [
        'trimFinishLf',
        'windowCount',
        'exteriorDoorCount',
        'slidingDoorCount',
        'interiorDoorCount',
      ],
    },
    windows_doors: { unit: 'each', measurementKeys: ['windowCount'] },
    openings: { unit: 'each', measurementKeys: ['framingOpeningCount'] },
  },
  garage_doors: {
    garage_doors: {
      unit: 'each',
      measurementKeys: [
        'garageDoorSingleCount',
        'garageDoorDoubleCount',
        'garageDoorRvCount',
      ],
      sumMeasurementKeys: true,
    },
    garage_door_openers: {
      unit: 'each',
      measurementKeys: ['garageDoorOpenerCount'],
    },
  },
  framing: {
    framing: {
      unit: 'sqft',
      measurementKeys: ['framedAreaSqft', 'floorAreaSqft', 'garageSqft'],
    },
    wall_framing: { unit: 'lf', measurementKeys: ['wallFramingLf'] },
    shear_sheathing: {
      unit: 'sqft',
      measurementKeys: ['sheathingSqft', 'stuccoGrossWallSqft'],
    },
    openings: { unit: 'each', measurementKeys: ['framingOpeningCount'] },
  },
  room_remodel: {
    framing: {
      unit: 'sqft',
      measurementKeys: ['framedAreaSqft', 'floorAreaSqft'],
    },
    plumbing: { unit: 'each' },
    electrical: { unit: 'each' },
    hvac: { unit: 'each' },
    drywall: {
      unit: 'sqft',
      measurementKeys: ['drywallSqft', 'floorAreaSqft'],
    },
    flooring: {
      unit: 'sqft',
      measurementKeys: ['flooringSqft', 'floorAreaSqft'],
    },
    paint: {
      unit: 'sqft',
      measurementKeys: ['wallPaintSqft', 'floorAreaSqft'],
    },
    trim: { unit: 'lf', measurementKeys: ['baseboardLf'] },
  },
  kitchen: {
    floor_demo: {
      unit: 'sqft',
      measurementKeys: ['kitchenFloorSqft', 'flooringSqft', 'floorAreaSqft'],
    },
    flooring: {
      unit: 'sqft',
      measurementKeys: ['kitchenFloorSqft', 'flooringSqft', 'floorAreaSqft'],
    },
    cabinets: { unit: 'lf', measurementKeys: ['cabinetLf'] },
    countertops: {
      unit: 'sqft',
      measurementKeys: ['countertopSqft', 'kitchenFloorSqft'],
    },
    backsplash: { unit: 'sqft', measurementKeys: ['backsplashSqft'] },
  },
};

/** Units that must never use raw living SF as an Edit pricing basis. */
const NON_LIVING_SF_BASIS_UNITS = new Set([
  'cy',
  'squares',
  'each',
  'lf',
  'ton',
  'hr',
  'lb',
]);

function normalizeBasisUnit(unit: string | null | undefined): string {
  const u = String(unit || 'sqft').toLowerCase();
  if (u === 'sf' || u === 'sq.ft' || u === 'living_sqft' || u === 'floor_sqft')
    return 'sqft';
  if (u === 'sq' || u === 'square') return 'squares';
  if (u === 'ea' || u === 'count') return 'each';
  return u;
}

/**
 * True when a stored `__sqft_basis` is living SF (or wrong unit) for a trade that
 * prices on CY / squares / each / LF — the Foundation ~$1M class of bug.
 * Also true for ground-up framing when stored qty is living-only but garage exists
 * (suggest uses covered framed SF = living + garage).
 */
export function isStaleLivingSfPricingBasis(params: {
  itemId: string;
  storedQty: number;
  storedUnit?: string | null;
  livingSf?: number | null;
  garageSf?: number | null;
  preferredUnit?: string | null;
  preferredMeasurementKeys?: string[] | null;
  sumMeasurementKeys?: boolean;
  defaultUnit?: string | null;
}): boolean {
  const storedUnit = normalizeBasisUnit(params.storedUnit);
  const preferredUnit = normalizeBasisUnit(
    params.preferredUnit || params.defaultUnit || 'sqft'
  );
  const living = Number(params.livingSf);
  const garage = Number(params.garageSf);
  const qty = Number(params.storedQty);
  if (!(qty > 0)) return false;

  const looksLikeLivingSf =
    Number.isFinite(living) &&
    living > 0 &&
    storedUnit === 'sqft' &&
    Math.abs(qty - living) < 0.51;

  if (NON_LIVING_SF_BASIS_UNITS.has(preferredUnit)) {
    if (storedUnit !== preferredUnit) return true;
    if (looksLikeLivingSf) return true;
  }

  // Preferred physical keys omit floorAreaSqft — don't keep a living-SF proxy.
  const keys = params.preferredMeasurementKeys || [];
  if (looksLikeLivingSf && keys.length > 0 && !keys.includes('floorAreaSqft')) {
    return true;
  }

  // Framing (and any summed basis): living-only is stale when garage SF is available.
  if (
    looksLikeLivingSf &&
    params.sumMeasurementKeys &&
    keys.includes('garageSqft') &&
    Number.isFinite(garage) &&
    garage > 0
  ) {
    return true;
  }

  const id = String(params.itemId || '').toLowerCase();
  // Insulation Suggest uses thermal envelope — living or living×3.5 proxies are stale.
  if (
    id === 'insulation' &&
    Number.isFinite(living) &&
    living > 0 &&
    storedUnit === 'sqft' &&
    (looksLikeLivingSf || Math.abs(qty - Math.round(living * 3.5)) < 1)
  ) {
    return true;
  }
  // Ground-up drywall Suggest expands living / thin takeoffs to living×3.5 surface.
  if (
    (id === 'drywall' || id === 'hang' || id === 'finish_tape') &&
    Number.isFinite(living) &&
    living > 0 &&
    storedUnit === 'sqft' &&
    (looksLikeLivingSf || isUndercountedDrywallSurface(qty, living))
  ) {
    return true;
  }
  // Interior paint: living SF is never a valid Edit basis (installed lump or paintable SF).
  if (
    (id === 'interior_paint' || id === 'paint' || id === 'paint_trim') &&
    looksLikeLivingSf
  ) {
    return true;
  }

  return false;
}

/**
 * Edit pricing basis that matches Confirm Scope Suggest planning quantities.
 * Used when physical takeoff is missing or known-wrong (living proxy, thin drywall, etc.).
 */
export function resolveSuggestAlignedEditorPricingBasis(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  templateKey?: string | null
): { quantity: number; unit: string } | null {
  const id = String(itemId || '').toLowerCase();
  const tk = String(templateKey || '').toLowerCase();
  const livingSf = parseScopeMeasurementInput(
    String(measurementsInput.floorAreaSqft ?? '')
  );
  const garageSf =
    parseScopeMeasurementInput(String(measurementsInput.garageSqft ?? '')) || 0;

  if (id === 'framing' && tk === 'ground_up' && livingSf && livingSf > 0) {
    return { quantity: livingSf + Math.max(0, garageSf), unit: 'sqft' };
  }

  if (id === 'framing' && tk === 'framing') {
    const framed = resolveCoveredFramedAreaSqft({
      framedAreaSqft: measurementsInput.framedAreaSqft,
      floorAreaSqft: measurementsInput.floorAreaSqft,
      garageSqft: measurementsInput.garageSqft,
    });
    if (framed && framed > 0) return { quantity: framed, unit: 'sqft' };
  }

  if (
    (id === 'drywall' || id === 'hang' || id === 'finish_tape') &&
    tk === 'ground_up' &&
    livingSf &&
    livingSf > 0
  ) {
    const componentQuantity = resolveDrywallPackageSurfaceQuantity(
      measurementsInput as unknown as Record<string, unknown>,
      { planFacts: measurementsInput.planFacts }
    );
    if (componentQuantity != null) {
      return { quantity: componentQuantity, unit: 'sqft' };
    }
    const drywallSf = parseScopeMeasurementInput(
      String(measurementsInput.drywallSqft ?? '')
    );
    const needsSurface =
      !drywallSf ||
      drywallSf <= 0 ||
      Math.abs(drywallSf - livingSf) < 0.51 ||
      isUndercountedDrywallSurface(drywallSf, livingSf);
    if (needsSurface) {
      const garageSf =
        parseScopeMeasurementInput(String(measurementsInput.garageSqft ?? '')) ||
        parseScopeMeasurementInput(
          String(
            measurementsInput.planFacts?.buildingAreas?.garageSqft ?? ''
          )
        ) ||
        0;
      const packageSf = drywallPackageSurfacePlanningQuantity(
        livingSf,
        garageSf > 0 ? garageSf : null
      );
      return {
        quantity: packageSf ?? Math.round(livingSf * 3.5),
        unit: 'sqft',
      };
    }
    return { quantity: drywallSf, unit: 'sqft' };
  }

  if (id === 'insulation') {
    const envelope = resolveInsulationEnvelopePlanningQuantity(
      insulationEnvelopeInputsFromPlanFacts(
        measurementsInput.planFacts,
        livingSf,
        measurementsInput
      )
    );
    const envelopeSf = envelope?.totalInsulationEnvelopeSqft;
    if (envelopeSf && envelopeSf > 0) {
      return { quantity: envelopeSf, unit: 'sqft' };
    }
    return null;
  }

  if (tk !== 'ground_up') return null;

  if (id === 'excavation') {
    const cy = parseScopeMeasurementInput(
      String(measurementsInput.excavationCy ?? '')
    );
    if (cy && cy > 0) return { quantity: cy, unit: 'cy' };
    if (livingSf && livingSf > 0) {
      const perimeter = 4 * Math.sqrt(livingSf);
      const trenchCy = (perimeter * 3 * 3) / 27;
      const padCutCy = (livingSf * 0.5) / 27;
      return {
        quantity: Math.max(1, Math.round(trenchCy + padCutCy + trenchCy * 0.1)),
        unit: 'cy',
      };
    }
    return null;
  }

  if (id === 'hvac') {
    return { quantity: 1, unit: 'each' };
  }

  if (id === 'stucco') {
    const wallSf =
      parseScopeMeasurementInput(
        String(measurementsInput.exteriorPaintSqft ?? '')
      ) || (livingSf && livingSf > 0 ? Math.round(livingSf * 1.05) : null);
    if (wallSf && wallSf > 0) return { quantity: wallSf, unit: 'sqft' };
    return null;
  }

  if (id === 'cabinets') {
    const lf = parseScopeMeasurementInput(
      String(measurementsInput.cabinetLf ?? '')
    );
    if (lf && lf > 0) return { quantity: lf, unit: 'lf' };
    if (livingSf && livingSf > 0) {
      return { quantity: Math.max(1, Math.round(livingSf / 25)), unit: 'lf' };
    }
    return null;
  }

  if (id === 'countertops') {
    const tops = parseScopeMeasurementInput(
      String(measurementsInput.countertopSqft ?? '')
    );
    if (tops && tops > 0) return { quantity: tops, unit: 'sqft' };
    return { quantity: 80, unit: 'sqft' };
  }

  if (id === 'plumbing_rough') {
    const countEntry = measurementsInput.itemQuantities[itemId];
    const countQty = parseScopeMeasurementInput(
      String(countEntry?.quantity ?? '')
    );
    const countUnit = normalizeBasisUnit(countEntry?.unit);
    if (countQty && countQty > 0 && countUnit === 'each') {
      return { quantity: countQty, unit: 'each' };
    }
    // Suggest plans from living SF when point/device counts are missing.
    if (livingSf && livingSf > 0) return { quantity: livingSf, unit: 'sqft' };
    return null;
  }

  if (id === 'electrical_rough') {
    const countEntry = measurementsInput.itemQuantities[itemId];
    const countQty = parseScopeMeasurementInput(
      String(countEntry?.quantity ?? '')
    );
    const countUnit = normalizeBasisUnit(countEntry?.unit);
    if (countQty && countQty > 0 && countUnit === 'each') {
      return { quantity: countQty, unit: 'each' };
    }
    if (String(tk || '').toLowerCase() === 'electrical') {
      return null;
    }
    // Canonical Electrical is count-based. Living/floor/building SF must not
    // own detailed cards or auto-price a rough package beside them.
    if (
      !shouldAutoPriceElectricalRoughPackage(
        measurementsInput as unknown as Record<string, unknown>,
        tk
      )
    ) {
      return null;
    }
    if (livingSf && livingSf > 0) return { quantity: livingSf, unit: 'sqft' };
    return null;
  }

  if (id === 'windows' || id === 'windows_doors') {
    const countEntry = measurementsInput.itemQuantities[itemId];
    const countQty = parseScopeMeasurementInput(
      String(countEntry?.quantity ?? '')
    );
    const countUnit = normalizeBasisUnit(countEntry?.unit);
    if (countQty && countQty > 0 && countUnit === 'each') {
      return { quantity: countQty, unit: 'each' };
    }
    const windowCount = parseScopeMeasurementInput(
      String(measurementsInput.windowCount ?? '')
    );
    if (windowCount && windowCount > 0) {
      return { quantity: windowCount, unit: 'each' };
    }
    return null;
  }

  if (id === 'interior_paint' || id === 'paint' || id === 'paint_trim') {
    const paintSf = parseScopeMeasurementInput(
      String(measurementsInput.wallPaintSqft ?? '')
    );
    if (paintSf && paintSf > 0) return { quantity: paintSf, unit: 'sqft' };
    return null;
  }

  if (id === 'exterior_paint') {
    const paintSf = parseScopeMeasurementInput(
      String(measurementsInput.exteriorPaintSqft ?? '')
    );
    if (paintSf && paintSf > 0) return { quantity: paintSf, unit: 'sqft' };
    return null;
  }

  return null;
}

function pricingBasisPreferenceFor(
  itemId: string,
  templateKey?: string | null
): PricingBasisPreference | null {
  return (
    (templateKey &&
      TEMPLATE_PRICING_BASIS_PREFERENCES[templateKey]?.[itemId]) ||
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
  const fallbackRule =
    rule ?? getChecklistItemQuantityRuleOrDefault(itemId, templateKey);
  if (
    fallbackRule.defaultUnit === 'allowance' ||
    fallbackRule.defaultUnit === 'lump_sum'
  )
    return 'sqft';
  return fallbackRule.defaultUnit;
}

export function resolveAllowanceEditorPricingBasis(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  templateKey?: string | null
): { quantity: number; unit: string } | null {
  const rule = getChecklistItemQuantityRuleOrDefault(itemId, templateKey);
  const livingSf = parseScopeMeasurementInput(
    String(measurementsInput.floorAreaSqft ?? '')
  );
  const garageSf = parseScopeMeasurementInput(
    String(measurementsInput.garageSqft ?? '')
  );
  const preferred = pricingBasisPreferenceFor(itemId, templateKey);
  const preferredUnit = preferred?.unit || rule.defaultUnit;
  const basisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
  const stored = measurementsInput.itemQuantities[basisKey];
  const storedQty = parseScopeMeasurementInput(String(stored?.quantity ?? ''));
  const storedUnit = String(stored?.unit || 'sqft').toLowerCase();
  const storedIsStale = isStaleLivingSfPricingBasis({
    itemId,
    storedQty: storedQty ?? 0,
    storedUnit,
    livingSf,
    garageSf,
    preferredUnit,
    preferredMeasurementKeys: preferred?.measurementKeys as
      | string[]
      | undefined,
    sumMeasurementKeys: preferred?.sumMeasurementKeys,
    defaultUnit: rule.defaultUnit,
  });
  if (storedQty && storedQty > 0 && !storedIsStale) {
    return { quantity: storedQty, unit: stored?.unit || 'sqft' };
  }

  // A committed physical takeoff is the source of truth for the editor.
  // Never fall back to a default basis (often 1) when the scope card already
  // contains a user-entered count, area, LF, or other matching-unit quantity.
  const direct = measurementsInput.itemQuantities[itemId];
  const directQty = parseScopeMeasurementInput(String(direct?.quantity ?? ''));
  const directUnit = normalizeBasisUnit(String(direct?.unit || ''));
  if (
    directQty != null &&
    directQty > 0 &&
    directUnit === normalizeBasisUnit(preferredUnit) &&
    !['allowance', 'lump_sum'].includes(directUnit)
  ) {
    return { quantity: directQty, unit: direct?.unit || preferredUnit };
  }

  // Prefer Suggest-aligned planning qty before raw measurement keys that can be
  // living SF / thin drywall / wrong proxies (same class of bug as Framing Edit).
  const suggestAligned = resolveSuggestAlignedEditorPricingBasis(
    itemId,
    measurementsInput,
    templateKey
  );
  const id = String(itemId || '').toLowerCase();
  const prefersSuggestAlignedFirst =
    id === 'framing' ||
    id === 'drywall' ||
    id === 'hang' ||
    id === 'finish_tape' ||
    id === 'insulation' ||
    id === 'excavation' ||
    id === 'hvac' ||
    id === 'stucco' ||
    id === 'cabinets' ||
    id === 'countertops' ||
    id === 'plumbing_rough' ||
    id === 'electrical_rough' ||
    id === 'windows' ||
    id === 'windows_doors' ||
    id === 'interior_paint' ||
    id === 'paint' ||
    id === 'paint_trim' ||
    id === 'exterior_paint';
  if (suggestAligned && prefersSuggestAlignedFirst) {
    return suggestAligned;
  }

  if (preferred?.measurementKeys?.length) {
    if (preferred.sumMeasurementKeys) {
      let sum = 0;
      let found = false;
      for (const key of preferred.measurementKeys) {
        if (
          key === 'floorAreaSqft' &&
          NON_LIVING_SF_BASIS_UNITS.has(normalizeBasisUnit(preferred.unit))
        ) {
          continue;
        }
        const quantity = parseScopeMeasurementInput(
          String(
            measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? ''
          )
        );
        if (quantity && quantity > 0) {
          sum += quantity;
          found = true;
        }
      }
      if (found && sum > 0) {
        return { quantity: sum, unit: preferred.unit };
      }
    }
    for (const key of preferred.measurementKeys) {
      // Never seed CY/squares/each/LF trades from living SF via a preferred key list.
      if (
        key === 'floorAreaSqft' &&
        NON_LIVING_SF_BASIS_UNITS.has(normalizeBasisUnit(preferred.unit))
      ) {
        continue;
      }
      const quantity = parseScopeMeasurementInput(
        String(
          measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? ''
        )
      );
      if (quantity && quantity > 0) {
        // Undercounted drywall takeoff must not win over living×3.5 planning.
        if (
          (id === 'drywall' || id === 'hang' || id === 'finish_tape') &&
          key === 'drywallSqft' &&
          !hasDrywallSurfaceComponentTakeoff(
            measurementsInput as unknown as Record<string, unknown>,
            { planFacts: measurementsInput.planFacts }
          ) &&
          livingSf &&
          isUndercountedDrywallSurface(quantity, livingSf) &&
          suggestAligned
        ) {
          return suggestAligned;
        }
        return { quantity, unit: measurementUnitForKey(key, preferred.unit) };
      }
    }
  }
  if (suggestAligned) return suggestAligned;

  const fromPricingBasis = firstPricingBasisMeasurementForRule(
    rule,
    measurementsInput
  );
  if (fromPricingBasis) {
    if (
      !(
        fromPricingBasis.unit === 'sqft' &&
        livingSf != null &&
        Math.abs(fromPricingBasis.quantity - livingSf) < 0.51 &&
        (NON_LIVING_SF_BASIS_UNITS.has(normalizeBasisUnit(preferredUnit)) ||
          id === 'insulation' ||
          id === 'interior_paint' ||
          id === 'paint' ||
          id === 'paint_trim' ||
          id === 'drywall' ||
          id === 'hang' ||
          id === 'finish_tape')
      )
    ) {
      return fromPricingBasis;
    }
  }
  const fromRule = firstMeasurementForRule(rule, measurementsInput);
  if (fromRule) {
    if (
      !(
        fromRule.unit === 'sqft' &&
        livingSf != null &&
        Math.abs(fromRule.quantity - livingSf) < 0.51 &&
        (NON_LIVING_SF_BASIS_UNITS.has(normalizeBasisUnit(preferredUnit)) ||
          id === 'insulation' ||
          id === 'interior_paint' ||
          id === 'paint' ||
          id === 'paint_trim' ||
          id === 'drywall' ||
          id === 'hang' ||
          id === 'finish_tape')
      )
    ) {
      return fromRule;
    }
  }
  if (
    rule.defaultUnit &&
    rule.defaultUnit !== 'sqft' &&
    rule.defaultUnit !== 'allowance' &&
    rule.defaultUnit !== 'lump_sum'
  ) {
    return null;
  }
  if (NON_LIVING_SF_BASIS_UNITS.has(normalizeBasisUnit(preferredUnit))) {
    return null;
  }
  // Never fall back to living SF for scopes that Suggest prices on a different basis.
  if (
    id === 'insulation' ||
    id === 'interior_paint' ||
    id === 'paint' ||
    id === 'paint_trim' ||
    id === 'exterior_paint' ||
    id === 'drywall' ||
    id === 'hang' ||
    id === 'finish_tape'
  ) {
    return null;
  }
  const canUseFloorFallback =
    preferred?.useFloorAreaFallback ||
    rule.canUseRoomSqft ||
    rule.defaultUnit === 'sqft';
  if (!canUseFloorFallback) return null;
  if (livingSf && livingSf > 0) return { quantity: livingSf, unit: 'sqft' };
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
  const resolvedId = itemId === 'shower_bench_curb' ? 'shower_bench' : itemId;
  let rule: ScopeItemQuantityRule | undefined;
  if (
    (templateKey === 'ground_up' ||
      templateKey === 'stucco' ||
      templateKey === 'windows_doors' ||
      templateKey === 'garage_doors') &&
    GROUND_UP_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId]
  ) {
    rule = GROUND_UP_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId];
  } else if (
    templateKey === 'addition' &&
    ADDITION_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId]
  ) {
    rule = ADDITION_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId];
  } else if (
    templateKey === 'kitchen' &&
    KITCHEN_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId]
  ) {
    rule = KITCHEN_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId];
  } else if (
    templateKey === 'bathroom' &&
    BATHROOM_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId]
  ) {
    rule = BATHROOM_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId];
  } else if (
    templateKey === 'flooring' &&
    FLOORING_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId]
  ) {
    rule = FLOORING_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId];
  } else if (
    String(templateKey || '').toLowerCase() === 'framing' &&
    FRAMING_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId]
  ) {
    rule = FRAMING_CHECKLIST_ITEM_QUANTITY_RULES[resolvedId];
  } else {
    rule = CHECKLIST_ITEM_QUANTITY_RULES[resolvedId];
  }
  const hvacCard = hvacCardForItemId(resolvedId);
  if (
    hvacCard &&
    String(templateKey || '').toLowerCase() === 'hvac'
  ) {
    rule = {
      ...(rule || {}),
      defaultUnit: hvacCard.unit,
      allowedUnits:
        hvacCard.itemId === 'hvac'
          ? ['each', 'ton', 'allowance', 'lump_sum']
          : hvacCard.unit === 'lf'
            ? ['lf', 'allowance', 'lump_sum']
            : ['each', 'allowance', 'lump_sum'],
      measurementKey:
        hvacCard.measurementKey as ScopeItemQuantityRule['measurementKey'],
      measurementKeys:
        hvacCard.itemId === 'hvac'
          ? (['hvacSystemCount', 'hvacSystemTons'] as ScopeItemQuantityRule['measurementKeys'])
          : undefined,
      requiresUserQuantity: true,
      quantityHelper: hvacCard.helper,
      missingMessage: `Enter ${hvacCard.label.toLowerCase()} quantity or pricing.`,
    };
  }
  if (!rule) return undefined;
  if (
    ['plumbing', 'plumbing_service'].includes(
      String(templateKey || '').toLowerCase()
    ) &&
    resolvedId === 'plumbing_trim'
  ) {
    rule = {
      ...rule,
      defaultUnit: 'each',
      allowedUnits: ['each', 'allowance', 'lump_sum'],
      defaultQuantity: undefined,
      requiresUserQuantity: true,
      quantityHelper:
        'Enter plumbing trim / hookup count. Fixture replacement, rough-in, and line work are separate.',
    };
  }
  const plumbingCard = plumbingCardForItemId(resolvedId);
  if (
    plumbingCard &&
    ['plumbing', 'plumbing_service'].includes(
      String(templateKey || '').toLowerCase()
    )
  ) {
    rule = {
      ...rule,
      measurementKey:
        plumbingCard.measurementKey as ScopeItemQuantityRule['measurementKey'],
      defaultUnit: plumbingCard.unit,
      requiresUserQuantity: true,
    };
  }
  const framingCard = framingCardForItemId(resolvedId);
  if (framingCard && String(templateKey || '').toLowerCase() === 'framing') {
    rule = {
      ...rule,
      measurementKey:
        framingCard.measurementKey as ScopeItemQuantityRule['measurementKey'],
      defaultUnit: framingCard.unit,
      requiresUserQuantity: true,
    };
  }

  // Measurement-semantics: do not resolve primary takeoff from living SF for physical trades.
  if (
    measurementSemanticsV1Enabled() &&
    NO_LIVING_SF_PRIMARY_SEED_KEYS.has(resolvedId)
  ) {
    const keys = (
      rule.measurementKeys || (rule.measurementKey ? [rule.measurementKey] : [])
    ).filter(key => key !== 'floorAreaSqft');
    const physicalKey =
      itemId === 'drywall'
        ? 'drywallSqft'
        : itemId === 'roofing'
          ? 'roofSquares'
          : itemId === 'stucco'
            ? 'exteriorPaintSqft'
            : itemId === 'paint_trim' ||
                itemId === 'paint' ||
                itemId === 'interior_paint'
              ? 'wallPaintSqft'
              : itemId === 'excavation'
                ? 'excavationCy'
                : itemId === 'foundation'
                  ? 'concreteCy'
                  : itemId === 'pour_flatwork'
                    ? 'concreteSqft'
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
                              : itemId === 'flooring'
                                ? 'flooringSqft'
                                : (FLOORING_PRODUCT_SQFT_MEASUREMENT_KEY[
                                    resolvedId
                                  ] ?? keys[0]);
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
                  itemId === 'stucco' ||
                  itemId === 'pour_flatwork'
                ? 'sqft'
                : preferred === 'package' || preferred === 'unknown'
                  ? rule.defaultUnit
                  : preferred === 'surface_sqft' || preferred === 'floor_sqft'
                    ? 'sqft'
                    : rule.defaultUnit,
      requiresUserQuantity: true,
      quantityHelper:
        itemId === 'framing'
          ? 'Planning material + labor from covered framed SF (living + garage) until a board-foot / package takeoff is entered.'
          : itemId === 'stucco'
            ? 'Enter exterior wall surface SF for stucco material and labor.'
            : itemId === 'foundation'
              ? 'Needs structural takeoff (slab/footings/walls/CY). Living SF is not foundation quantity.'
              : itemId === 'pour_flatwork'
                ? 'Enter exterior flatwork SF (driveway, walks, porch) — not house/garage slab. Local allowance when SF is unknown.'
                : itemId === 'insulation'
                  ? 'Planning estimate from exterior walls + conditioned attic/ceiling. Verify openings, garage scope, and R-values.'
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
  return (
    getChecklistItemQuantityRule(itemId, templateKey) ??
    DEFAULT_SCOPE_ALLOWANCE_QUANTITY_RULE
  );
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
    field:
      | 'backsplashSqft'
      | 'wallPaintSqft'
      | 'showerWallTileSqft'
      | 'flooringSqft'
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
  'plan_detected',
]);

function itemQuantityEntryForId(
  measurements: NormalizedScopeMeasurements,
  itemId: string
): ScopeItemQuantityValue | undefined {
  const direct = measurements.itemQuantities[itemId];
  if (direct) return direct;
  if (
    itemId === 'interior_paint' ||
    itemId === 'paint' ||
    itemId === 'paint_trim'
  ) {
    for (const alias of ['paint', 'interior_paint', 'paint_trim'] as const) {
      const entry = measurements.itemQuantities[alias];
      if (entry) return entry;
    }
  }
  return undefined;
}

function explicitItemQuantityOverride(
  measurements: NormalizedScopeMeasurements,
  itemId: string,
  rule: ScopeItemQuantityRule,
  ctx: { templateKey?: string | null | undefined; notes?: string | null }
): ResolvedItemQuantity | null {
  const override = itemQuantityEntryForId(measurements, itemId);
  if (
    override?.quantity == null ||
    override.quantity <= 0 ||
    isPlaceholderAllowancePricing(override.quantity, override.unit, itemId) ||
    !EXPLICIT_ITEM_QUANTITY_SOURCES.has(
      override.quantitySource || 'user_entered'
    )
  ) {
    return null;
  }
  const includesCountertops =
    Boolean(override.includesCountertops) ||
    (itemId === 'cabinets' && notesHaveCombinedCabinetsCounters(ctx.notes));
  const baseLabel = sourceLabel(override.quantitySource || 'user_entered');
  const combinedCabinetsCounters = itemId === 'cabinets' && includesCountertops;
  const materialEntry = usesAllowanceSplitEditor(rule)
    ? parseStoredItemQuantity(
        measurements,
        allowanceSplitSubKey(itemId, 'material')
      )
    : null;
  const laborEntry = usesAllowanceSplitEditor(rule)
    ? parseStoredItemQuantity(
        measurements,
        allowanceSplitSubKey(itemId, 'labor')
      )
    : null;
  const splitTotal =
    (materialEntry?.quantity ?? 0) + (laborEntry?.quantity ?? 0);
  let quantity = override.quantity;
  if (
    usesAllowanceSplitEditor(rule) &&
    splitTotal > 0 &&
    ['allowance', 'lump_sum'].includes(
      normalizeBasisUnit(String(override.unit || ''))
    ) &&
    (Math.abs(quantity - splitTotal) < 0.02 ||
      quantity <= (rule.defaultQuantity ?? 1) + 0.001)
  ) {
    quantity = splitTotal;
  }
  return {
    quantity,
    unit: normalizedOverrideUnitForRule(
      itemId,
      ctx.templateKey,
      override.unit,
      rule
    ),
    quantitySource: override.quantitySource || 'user_entered',
    sourceLabel: combinedCabinetsCounters
      ? `Combined total · cabinets + counters · ${baseLabel}`
      : baseLabel,
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
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
    ['flooring_lvp', 'flooringLvpSqft'],
    ['flooring_laminate', 'flooringLaminateSqft'],
    ['flooring_engineered_hardwood', 'flooringEngineeredHardwoodSqft'],
    ['flooring_solid_hardwood', 'flooringSolidHardwoodSqft'],
    ['tile_flooring', 'flooringTileSqft'],
    ['flooring_carpet', 'flooringCarpetSqft'],
    ['floor_demo', 'floorDemoSqft'],
    ['floor_prep', 'floorPrepSqft'],
    ['underlayment', 'underlaymentSqft'],
    ['moisture_barrier', 'moistureBarrierSqft'],
    ['transitions', 'transitionCount'],
    ['quarter_round', 'quarterRoundLf'],
    ['concrete', 'concreteSqft'],
    ['pour_flatwork', 'concreteSqft'],
  ];
  for (const [itemId, field] of mappings) {
    const entry = safeInput.itemQuantities?.[itemId];
    if (!entry?.quantity || entry.unit !== 'sqft') continue;
    if (
      !EXPLICIT_ITEM_QUANTITY_SOURCES.has(
        entry.quantitySource || 'user_entered'
      )
    )
      continue;
    next[field] = String(entry.quantity);
  }
  const insulationWalls =
    Number(next.exteriorWallInsulationSqft) ||
    Number(next.exteriorWallGrossSqft);
  const insulationOpenings = Number(next.openingDeductionSqft);
  const hasInsulationAssemblies = resolvedInsulationAssemblies(next).length > 0;
  if (
    insulationWalls > 0 ||
    insulationOpenings > 0 ||
    hasInsulationAssemblies
  ) {
    const envelope = resolveInsulationEnvelopePlanningQuantity(
      insulationEnvelopeInputsFromPlanFacts(
        next.planFacts,
        parseScopeMeasurementInput(String(next.floorAreaSqft ?? '')),
        {
          ...next,
          suppressAtticPlanningFallback:
            insulationWalls > 0 || insulationOpenings > 0,
        } as unknown as Partial<InsulationEnvelopeInputs>
      )
    );
    if (envelope && Number(envelope.totalInsulationEnvelopeSqft) > 0) {
      const existing = next.itemQuantities?.insulation;
      if (!(Number(existing?.quantity) > 0)) {
        next.itemQuantities = {
          ...next.itemQuantities,
          insulation: {
            quantity: String(envelope.totalInsulationEnvelopeSqft),
            unit: 'sqft',
            quantitySource: 'plan_vision',
          },
        };
      }
    }
  }
  for (const card of ELECTRICAL_CARDS) {
    if (card.measurementKey === 'serviceAmperage') continue;
    const entry = safeInput.itemQuantities?.[card.itemId];
    if (!entry?.quantity) continue;
    if (
      !EXPLICIT_ITEM_QUANTITY_SOURCES.has(
        entry.quantitySource || 'user_entered'
      )
    )
      continue;
    const quantity = Number(String(entry.quantity).replace(/,/g, ''));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    (next as Record<string, unknown>)[card.measurementKey] = String(quantity);
  }
  for (const card of PLUMBING_CARDS) {
    const entry = safeInput.itemQuantities?.[card.itemId];
    if (!entry?.quantity) continue;
    if (
      !EXPLICIT_ITEM_QUANTITY_SOURCES.has(
        entry.quantitySource || 'user_entered'
      )
    )
      continue;
    if (
      plumbingStoredQuantityLooksLikeDollarTotal(
        card.itemId,
        entry,
        safeInput.itemQuantities
      )
    ) {
      continue;
    }
    const quantity = Number(String(entry.quantity).replace(/,/g, ''));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const existingQm = Number(
      String(
        (next as Record<string, unknown>)[card.measurementKey] ?? ''
      ).replace(/,/g, '')
    );
    if (
      Number.isFinite(existingQm) &&
      existingQm > 0 &&
      Math.abs(existingQm - quantity) > 0.01
    ) {
      continue;
    }
    (next as Record<string, unknown>)[card.measurementKey] = String(quantity);
  }
  for (const card of HVAC_CARDS) {
    const entry = safeInput.itemQuantities?.[card.itemId];
    if (!entry?.quantity) continue;
    if (
      !EXPLICIT_ITEM_QUANTITY_SOURCES.has(
        entry.quantitySource || 'user_entered'
      )
    )
      continue;
    const quantity = Number(String(entry.quantity).replace(/,/g, ''));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    (next as Record<string, unknown>)[card.measurementKey] = String(quantity);
  }
  for (const card of FRAMING_CARDS) {
    const entry = safeInput.itemQuantities?.[card.itemId];
    if (!entry?.quantity) continue;
    if (
      !EXPLICIT_ITEM_QUANTITY_SOURCES.has(
        entry.quantitySource || 'user_entered'
      )
    )
      continue;
    const quantity = Number(String(entry.quantity).replace(/,/g, ''));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const existingQm = Number(
      String(
        (next as Record<string, unknown>)[card.measurementKey] ?? ''
      ).replace(/,/g, '')
    );
    if (
      Number.isFinite(existingQm) &&
      existingQm > 0 &&
      Math.abs(existingQm - quantity) > 0.01
    ) {
      continue;
    }
    (next as Record<string, unknown>)[card.measurementKey] = String(quantity);
  }
  return next;
}

function measurementsForRatePricing(
  measurements: NormalizedScopeMeasurements
): Parameters<typeof resolveItemRatePricingFromNotes>[1] {
  return {
    backsplashSqft:
      measurements.backsplashSqft ??
      sqftFromItemQuantities(measurements, 'backsplash'),
    wallPaintSqft:
      measurements.wallPaintSqft ??
      sqftFromItemQuantities(measurements, 'paint'),
    showerWallTileSqft:
      measurements.showerWallTileSqft ??
      sqftFromItemQuantities(measurements, 'shower_tile'),
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
    concreteReinforcementSqft:
      measurements.concreteReinforcementSqft ?? undefined,
    concreteSealerSqft: measurements.concreteSealerSqft ?? undefined,
    concreteSubgradePrepSqft:
      measurements.concreteSubgradePrepSqft ?? undefined,
    concreteDemoSqft: measurements.concreteDemoSqft ?? undefined,
    concreteDemoThicknessBand:
      measurements.concreteDemoThicknessBand ?? undefined,
    concreteDemoThicknessBands:
      measurements.concreteDemoThicknessBands ?? undefined,
    concreteDemoAreaByThickness:
      measurements.concreteDemoAreaByThickness ?? undefined,
    concreteDemoReinforced: measurements.concreteDemoReinforced ?? undefined,
    concreteDemoLimitedAccess:
      measurements.concreteDemoLimitedAccess ?? undefined,
    concreteDemoCy: measurements.concreteDemoCy ?? undefined,
    concreteThicknessInches: measurements.concreteThicknessInches ?? undefined,
    complexFormingLf: measurements.complexFormingLf ?? undefined,
    additionalHaulOffLoadCount:
      measurements.additionalHaulOffLoadCount ?? undefined,
    concreteCy: measurements.concreteCy ?? undefined,
    excavationCy: measurements.excavationCy ?? undefined,
    excavationAreaSqft: measurements.excavationAreaSqft ?? undefined,
    excavationDepthInches: measurements.excavationDepthInches ?? undefined,
    excavationQuantityMode: measurements.excavationQuantityMode ?? undefined,
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
    kitchenFloorSqft:
      parseScopeMeasurementInput(input.kitchenFloorSqft) ?? undefined,
    bathroomFloorSqft:
      parseScopeMeasurementInput(input.bathroomFloorSqft) ?? undefined,
    floorAreaSqft: parseScopeMeasurementInput(input.floorAreaSqft) ?? undefined,
    drywallSqft: parseScopeMeasurementInput(input.drywallSqft) ?? undefined,
    exteriorPaintSqft:
      parseScopeMeasurementInput(input.exteriorPaintSqft) ?? undefined,
    landscapeSqft: parseScopeMeasurementInput(input.landscapeSqft) ?? undefined,
    sodSqft: parseScopeMeasurementInput(input.sodSqft) ?? undefined,
    paverSqft: parseScopeMeasurementInput(input.paverSqft) ?? undefined,
    rockMulchSqft: parseScopeMeasurementInput(input.rockMulchSqft) ?? undefined,
    landscapeTons: parseScopeMeasurementInput(input.landscapeTons) ?? undefined,
    roofSquares: parseScopeMeasurementInput(input.roofSquares) ?? undefined,
    concreteSqft: parseScopeMeasurementInput(input.concreteSqft) ?? undefined,
    concreteReinforcementSqft:
      parseScopeMeasurementInput(input.concreteReinforcementSqft) ?? undefined,
    concreteSealerSqft:
      parseScopeMeasurementInput(input.concreteSealerSqft) ?? undefined,
    concreteSubgradePrepSqft:
      parseScopeMeasurementInput(input.concreteSubgradePrepSqft) ?? undefined,
    concreteThicknessInches:
      parseScopeMeasurementInput(input.concreteThicknessInches) ?? undefined,
    complexFormingLf:
      parseScopeMeasurementInput(input.complexFormingLf) ?? undefined,
    additionalHaulOffLoadCount:
      parseScopeMeasurementInput(input.additionalHaulOffLoadCount) ?? undefined,
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
  const checks: Array<{
    itemId: string;
    sqftKey: keyof ScopeMeasurementsInputExtended;
  }> = [
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
    if (
      entry?.quantity &&
      Number(entry.quantity) > 0 &&
      Number(entry.quantity) < sqft
    ) {
      delete itemQuantities[allowanceKey];
    }
  }
  for (const itemId of PLACEHOLDER_ALLOWANCE_ITEM_IDS) {
    const entry = itemQuantities[itemId];
    if (
      entry &&
      isPlaceholderAllowancePricing(
        parseScopeMeasurementInput(String(entry.quantity)),
        entry.unit
      )
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

function isUserEnteredQuantity(
  val: ScopeItemQuantityLike | undefined
): boolean {
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
  if (isUserEnteredQuantity(allowance) && Number(allowance.quantity || 0) > 0)
    return true;

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

/** Applied material + labor split (even when __allowance metadata is missing). */
export function hasUserEnteredMaterialLaborSplit(
  itemQuantities: Record<string, ScopeItemQuantityLike>,
  itemId: string
): boolean {
  const material = itemQuantities[allowanceSplitSubKey(itemId, 'material')];
  const labor = itemQuantities[allowanceSplitSubKey(itemId, 'labor')];
  return (
    material?.quantitySource === 'user_entered' &&
    labor?.quantitySource === 'user_entered' &&
    Number(material.quantity || 0) > 0 &&
    Number(labor.quantity || 0) > 0
  );
}

/** Sqft takeoff stored when the user tapped Apply (demo__sqft_basis). */
export function readStoredSqftPricingBasis(
  itemQuantities: Record<string, ScopeItemQuantityLike>,
  itemId: string
): number | null {
  const entry = itemQuantities[allowanceSplitSubKey(itemId, 'sqft_basis')];
  const unit = String(entry?.unit || '').toLowerCase();
  const qty = Number(String(entry?.quantity ?? '').replace(/,/g, ''));
  if (unit === 'sqft' && Number.isFinite(qty) && qty > 0) return qty;
  return null;
}

/**
 * After Apply, do not compute a second suggested total — it often uses stale QM
 * aggregates or treats applied dollar totals as multipliers (375 × $375, 935 sf, etc.).
 * User-entered / manual_adjusted pricing keeps the benchmark row for comparison.
 */
export function shouldSuppressSuggestedPricingAfterApply(
  itemId: string,
  _itemQuantities: Record<string, ScopeItemQuantityLike>,
  pricingAcceptance?: Record<string, { selectionStatus?: string }>
): boolean {
  void _itemQuantities;
  return pricingAcceptance?.[itemId]?.selectionStatus === 'accepted';
}

/** True when Edit only seeded Suggest values (user has not committed a price). */
export function hasOnlySuggestedPrefillPricing(
  itemQuantities: Record<string, ScopeItemQuantityLike>,
  itemId: string
): boolean {
  const keys = [
    `${itemId}__material`,
    `${itemId}__labor`,
    `${itemId}__allowance`,
    allowanceSplitSubKey(itemId, 'sqft_basis'),
    roughAllowanceSubKey(itemId),
  ];
  let sawPrefill = false;
  for (const key of keys) {
    const entry = itemQuantities[key];
    if (!entry?.quantity || !(Number(entry.quantity) > 0)) continue;
    if (entry.quantitySource === 'suggested_prefill') {
      sawPrefill = true;
      continue;
    }
    if (
      entry.quantitySource === 'user_entered' ||
      entry.quantitySource === 'manual_override'
    ) {
      return false;
    }
  }
  return sawPrefill;
}

/** Drop Edit-only Suggest seeds so the Apply card returns after Done without edits. */
export function clearSuggestedPrefillPricing(
  itemQuantities: Record<string, ScopeItemQuantityValue>,
  itemId: string
): Record<string, ScopeItemQuantityValue> {
  const next = { ...itemQuantities };
  const keys = [
    `${itemId}__material`,
    `${itemId}__labor`,
    `${itemId}__allowance`,
    allowanceSplitSubKey(itemId, 'sqft_basis'),
    roughAllowanceSubKey(itemId),
  ];
  for (const key of keys) {
    if (next[key]?.quantitySource === 'suggested_prefill') {
      delete next[key];
    }
  }
  return next;
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
    const itemId =
      ratePricingItemIdFromKey(key) || (rateItems[key] ? key : null);
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
  const splitTotal =
    (materialEntry?.quantity || 0) + (laborEntry?.quantity || 0);
  const looksLikeUnitRate =
    effectiveAllowance &&
    sqft != null &&
    effectiveAllowance.quantity > 0 &&
    effectiveAllowance.quantity < sqft;
  if (
    splitTotal > 0 &&
    (!effectiveAllowance ||
      looksLikeUnitRate ||
      effectiveAllowance.quantity < splitTotal)
  ) {
    return {
      quantity: splitTotal,
      unit: 'allowance',
      quantitySource:
        materialEntry?.quantitySource ||
        laborEntry?.quantitySource ||
        effectiveAllowance?.quantitySource ||
        'notes',
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
    measurementsForRatePricingWithCount(
      measurements,
      itemId,
      countEntry ?? null
    ),
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
  let materialEntry = parseStoredItemQuantity(
    measurements,
    `${itemId}__material`
  );
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

  if (
    hasCompleteUserSelectedPricing(measurements.itemQuantities || {}, itemId)
  ) {
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
  | 'dualCount'
  | 'dualMaterial'
  | 'dualLabor'
  | 'dualAllowance'
  | 'pricingReady'
  | 'quantitySource'
  | 'sourceLabel'
> | null {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule?.dualAllowanceField) return null;

  const text = String(notes || '').trim();
  if (!text) return null;

  let sqft: number | null = null;
  if (rule.measurementKey) {
    sqft = parseScopeMeasurementInput(
      String(
        measurementsInput[
          rule.measurementKey as keyof ScopeMeasurementsInputExtended
        ] ?? ''
      )
    );
  }
  if (!sqft && rule.measurementKeys?.length) {
    for (const key of rule.measurementKeys) {
      sqft = parseScopeMeasurementInput(
        String(
          measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? ''
        )
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
      ? {
          quantity: breakdown.material,
          unit: 'allowance' as const,
          quantitySource: 'notes' as const,
        }
      : null;
  let laborEntry =
    breakdown.labor != null
      ? {
          quantity: breakdown.labor,
          unit: 'allowance' as const,
          quantitySource: 'notes' as const,
        }
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

/** floor_demo pricing count — prefer resolved/rule takeoff before whole-room floorAreaSqft. */
function floorDemoPricingSqftCount(
  resolved: Pick<ResolvedItemQuantity, 'quantity' | 'unit' | 'dualCount'>,
  rule: ScopeItemQuantityRule,
  measurementsInput: ScopeMeasurementsInputExtended
): number | null {
  if (resolved.dualCount?.unit === 'sqft' && resolved.dualCount.quantity > 0) {
    return resolved.dualCount.quantity;
  }
  if (
    resolved.quantity != null &&
    resolved.unit === 'sqft' &&
    resolved.quantity > 0
  ) {
    return resolved.quantity;
  }
  const fromRule = firstMeasurementQuantityForRule(rule, measurementsInput);
  if (fromRule && fromRule > 0) return fromRule;
  return parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
}

function measurementUnitForKey(
  key: keyof Omit<NormalizedScopeMeasurements, 'itemQuantities'>,
  fallbackUnit: string
): string {
  if (key === 'roofRidgeVentLf') return 'each';
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
    flooringSqft: parseScopeMeasurementInput(
      String(measurementsInput.flooringSqft ?? '')
    ),
    floorAreaSqft: parseScopeMeasurementInput(
      String(measurementsInput.floorAreaSqft ?? '')
    ),
  });
}

function firstMeasurementForRule(
  rule: ScopeItemQuantityRule,
  measurementsInput: ScopeMeasurementsInputExtended
): { quantity: number; unit: string } | null {
  if (rule.measurementKey) {
    if (
      !shouldIgnoreFlooringMeasurementKey(
        rule.measurementKey,
        measurementsInput
      )
    ) {
      const quantity = parseScopeMeasurementInput(
        String(
          measurementsInput[
            rule.measurementKey as keyof ScopeMeasurementsInputExtended
          ] ?? ''
        )
      );
      if (quantity && quantity > 0) {
        return {
          quantity,
          unit: measurementUnitForKey(rule.measurementKey, rule.defaultUnit),
        };
      }
    }
  }
  if (rule.measurementKeys?.length) {
    for (const key of rule.measurementKeys) {
      if (shouldIgnoreFlooringMeasurementKey(key, measurementsInput)) continue;
      const quantity = parseScopeMeasurementInput(
        String(
          measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? ''
        )
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
      String(
        measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? ''
      )
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
    (resolved.unit && !['allowance', 'lump_sum'].includes(resolved.unit)
      ? resolved.unit
      : null) ||
    measurementMatch?.unit ||
    rule?.defaultUnit;
  const average = getNationalAverageBudgetSplit(itemId, preferredUnit);
  if (!average) return null;

  if (
    scopeQuantity &&
    scopeQuantity.quantity > 0 &&
    scopeQuantity.unit === average.unit
  ) {
    return scopeQuantity.quantity;
  }
  if (
    resolved.dualCount?.unit === average.unit &&
    resolved.dualCount.quantity > 0
  ) {
    return resolved.dualCount.quantity;
  }
  if (
    resolved.quantity != null &&
    resolved.unit === average.unit &&
    resolved.quantity > 0
  ) {
    return resolved.quantity;
  }
  if (itemId === 'floor_demo' && average.unit === 'sqft') {
    return floorDemoPricingSqftCount(resolved, rule, measurementsInput);
  }
  return measurementMatch?.quantity ?? null;
}

export function resolveSuggestedBudgetSplitDisplay(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  templateKey: string | null | undefined,
  resolved: Pick<
    ResolvedItemQuantity,
    | 'quantity'
    | 'unit'
    | 'quantitySource'
    | 'dualCount'
    | 'dualMaterial'
    | 'dualLabor'
    | 'dualAllowance'
  >
): SuggestedBudgetSplitDisplay | null {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule) return null;
  const measurementMatch = firstMeasurementForRule(rule, measurementsInput);
  const preferredUnit =
    resolved.dualCount?.unit ||
    (resolved.unit && !['allowance', 'lump_sum'].includes(resolved.unit)
      ? resolved.unit
      : null) ||
    measurementMatch?.unit ||
    rule?.defaultUnit;
  const average = getNationalAverageBudgetSplit(itemId, preferredUnit);
  if (!average) return null;
  if (resolved.dualMaterial || resolved.dualLabor) return null;

  const count =
    resolved.dualCount?.unit === average.unit && resolved.dualCount.quantity > 0
      ? resolved.dualCount.quantity
      : itemId === 'floor_demo' && average.unit === 'sqft'
        ? floorDemoPricingSqftCount(resolved, rule, measurementsInput)
        : (measurementMatch?.quantity ?? null);

  const hasNoteTotal =
    resolved.quantitySource === 'notes' ||
    resolved.dualAllowance?.quantity != null;
  const inferredCountCanPrice =
    !hasNoteTotal &&
    resolved.quantity != null &&
    resolved.unit === average.unit &&
    resolved.quantity > 0;
  if (!hasNoteTotal && !inferredCountCanPrice) return null;

  const total = hasNoteTotal
    ? Number(resolved.dualAllowance?.quantity ?? resolved.quantity ?? 0)
    : Math.round(
        Number(resolved.quantity) * (average.material + average.labor) * 100
      ) / 100;
  if (!Number.isFinite(total) || total <= 0) return null;

  const split = computeNationalAverageBudgetSplit(
    itemId,
    total,
    count ?? 0,
    average.unit
  );
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

export type PricingLegSource =
  | 'notes'
  | 'template'
  | 'local_benchmark'
  | 'national_average';

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

/** Saved templates, pricing library, and the active bid — $/unit by trade family. */
export type ScopePricingContext = {
  templates?: ScopePricingTemplateSource[] | null;
  bid?: ScopePricingTemplateSource | null;
  /** Median unit rates learned from past applied bids (backend pricing library). */
  libraryRates?: ScopePricingLibraryRate[] | null;
  state?: string | null;
  zipCode?: string | null;
  city?: string | null;
  /** In-scope Confirm Scope rows — used for bathroom trim-out component pricing. */
  checklistItems?: Array<{
    id: string;
    state?: string;
    choiceId?: string | null;
  }> | null;
};

export type TemplateRateOrigin = 'pricing_library' | 'bid' | 'saved_template';

export type TemplateRateMatch = {
  materialRate: number | null;
  laborRate: number | null;
  source: string;
  origin?: TemplateRateOrigin;
};

/** Confirm Scope chip/title for template-backed rates — library only uses "Saved pricing". */
export function templateRateSourceLabel(
  match: Pick<TemplateRateMatch, 'origin' | 'source'> | null | undefined
): string {
  switch (match?.origin) {
    case 'pricing_library':
      return 'Saved pricing';
    case 'bid':
      return 'From this bid';
    case 'saved_template': {
      const name = String(match.source || '').trim();
      if (name && !/^saved pricing$/i.test(name)) {
        const label = `From saved template · ${name}`;
        return label.length > 48 ? `${label.slice(0, 45).trimEnd()}…` : label;
      }
      return 'From saved template';
    }
    default:
      return 'National planning rate';
  }
}

export function isPricingLibraryTemplateBlock(
  block:
    | Pick<
        SuggestedPricingBlock,
        'materialSource' | 'laborSource' | 'rateSourceLabel'
      >
    | null
    | undefined
): boolean {
  if (!block) return false;
  const usesTemplate =
    block.materialSource === 'template' || block.laborSource === 'template';
  if (!usesTemplate) return false;
  return /^saved pricing$/i.test(String(block.rateSourceLabel || '').trim());
}

/** Fallback trade families for items that have no rate-pricing matcher. */
const TEMPLATE_FAMILY_FALLBACK: Record<string, RegExp> = {
  countertops:
    /counter\s*top|quartz|granite|laminate\s*top|solid\s*surface|butcher\s*block/i,
  cabinets: /cabinet|cabinetry|vanity/i,
  floor_prep: /floor\s*prep|underlayment|leveling|self\s*level|patch/i,
  waterproofing:
    /waterproof|backer\s*board|kerdi|redgard|red\s*guard|schluter|membrane/i,
  demo: /demo|demolition|tear\s*out|removal|remove|haul/i,
  floor_demo: /demo|demolition|tear\s*out|removal|remove/i,
  adhesive_mastic_removal:
    /adhesive|mastic|thinset|thin\s*set|grind(?:ing)?\s+(?:the\s+)?(?:floor|residue)/i,
};

function normalizeRateUnit(unit?: string | null): string | null {
  const value = String(unit || '')
    .toLowerCase()
    .trim();
  if (!value) return null;
  if (
    /^(sqft|sf|sq\.?\s*ft|sq\s*ft|sq\s*feet|square\s*f(?:oo|ee)t)$/.test(value)
  )
    return 'sqft';
  if (/^(lf|linear\s*f(?:oo|ee)t|ln\.?\s*ft|lin\.?\s*ft)$/.test(value))
    return 'lf';
  if (/^(cy|cubic\s*yards?)$/.test(value)) return 'cy';
  if (/^(ton|tons)$/.test(value)) return 'ton';
  if (/^(square|squares)$/.test(value)) return 'squares';
  return value;
}

function lineItemRatePerUnit(item: ScopePricingLineItem): number | null {
  const direct = Number(item.unitPrice ?? item.cost ?? item.rate ?? 0);
  if (Number.isFinite(direct) && direct > 0)
    return Math.round(direct * 100) / 100;
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
  const text =
    `${item.name || ''} ${item.label || ''} ${item.description || ''}`.trim();
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
 * templates, pricing library, and the active bid, matched within the same trade
 * family and unit. Priority: active bid → pricing library → saved templates.
 */
export function resolveTemplateRateForItem(
  itemId: string,
  unit: string | null | undefined,
  ctx?: ScopePricingContext | null,
  takeoffQuantity?: number | null
): TemplateRateMatch | null {
  if (!ctx) return null;
  const matcher =
    getRatePricingMatcher(itemId) ||
    (TEMPLATE_FAMILY_FALLBACK[itemId]
      ? { match: TEMPLATE_FAMILY_FALLBACK[itemId] }
      : null);
  if (!matcher) return null;

  const targetUnit = normalizeRateUnit(unit);

  // Saved pricing library beats stale line items on the active bid (often national-average prefill).
  const library = resolveLibraryRateForItem(
    itemId,
    unit,
    ctx.libraryRates,
    matcher,
    takeoffQuantity
  );
  if (library) return { ...library, origin: 'pricing_library' as const };

  if (ctx.bid) {
    const materialRate = averageMatchingRate(
      ctx.bid.materialLineItems,
      matcher,
      targetUnit
    );
    const laborRate = averageMatchingRate(
      ctx.bid.laborLineItems,
      matcher,
      targetUnit
    );
    if (materialRate || laborRate) {
      return {
        materialRate: materialRate ?? null,
        laborRate: laborRate ?? null,
        source: String(ctx.bid.name || 'This bid'),
        origin: 'bid',
      };
    }
  }

  for (const source of (ctx.templates || []).filter(
    Boolean
  ) as ScopePricingTemplateSource[]) {
    const materialRate = averageMatchingRate(
      source.materialLineItems,
      matcher,
      targetUnit
    );
    const laborRate = averageMatchingRate(
      source.laborLineItems,
      matcher,
      targetUnit
    );
    if (materialRate || laborRate) {
      return {
        materialRate: materialRate ?? null,
        laborRate: laborRate ?? null,
        source: String(source.name || 'Saved template'),
        origin: 'saved_template',
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
  /**
   * Installed lump-sum local budget (e.g. interior paint). Preserve source total;
   * do not treat mat/labor as verified source splits.
   */
  installedBudgetBenchmark?: boolean;
  /** How material/labor on the card relate to the source record. */
  splitSource?: 'source' | 'estimated' | 'none';
  splitConfidence?: 'high' | 'medium' | 'low' | 'none';
  comparisonRange?: { low: number; high: number } | null;
  /** Optional card-specific quantity context (for example, HVAC total tons). */
  displayQuantityLine?: string | null;
  /** Optional card-specific effective rate wording. */
  displayUnitRateLabel?: string | null;
  /** Display-only implied $/paintable SF from an installed comparable. */
  impliedUnitRateLabel?: string | null;
  basis?: { quantity: number; unit: string } | null;
  /** Living SF used as benchmark denominator (separate from physical takeoff). */
  benchmarkLivingSf?: number | null;
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
  /** Material-specific quantity breakdown shown for weighted pricing. */
  pricingDetail?: string | null;
  /**
   * Panel/service card is in scope but cannot produce a production price until
   * the contractor selects service amperage. Not a $0 bid.
   */
  needsServiceAmperage?: boolean;
  /** Base vs adjusted totals when project complexity multiplier is applied. */
  complexityAdjustment?: SuggestedPricingComplexityMeta;
};

export type ScopeItemSuggestedPricing = {
  /** Inline suggestion: fills a missing leg, splits a lump sum, or prices a quantity. */
  fill: SuggestedPricingBlock | null;
  /** Collapsible comparison shown when notes already priced both legs. */
  comparison: SuggestedPricingBlock | null;
};

export type ScopeItemSuggestedPricingResolveOptions = {
  /** Recompute applied pricing after complexity/QM changes — bypass post-Apply suppress. */
  bypassAppliedSuppress?: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function volumeSensitiveExcavationPricing(quantityCy: number) {
  const cy = Math.max(0, quantityCy);
  const tier =
    cy <= 2
      ? { rate: 175, minimum: 350, label: '1–2 CY' }
      : cy <= 5
        ? { rate: 140, minimum: 0, label: '2–5 CY' }
        : cy <= 10
          ? { rate: 115, minimum: 0, label: '5–10 CY' }
          : cy <= 25
            ? { rate: 95, minimum: 0, label: '10–25 CY' }
            : cy <= 50
              ? { rate: 85, minimum: 0, label: '25–50 CY' }
              : { rate: 75, minimum: 0, label: '50+ CY' };
  const calculatedTotal = round2(cy * tier.rate);
  const total = Math.max(calculatedTotal, tier.minimum);
  return {
    total,
    equipment: round2(total * 0.4),
    labor: round2(total * 0.6),
    effectiveRate: cy > 0 ? round2(total / cy) : 0,
    tierLabel: tier.label,
    tierRate: tier.rate,
    minimumApplied: total > calculatedTotal,
  };
}

function pricingRateDefined(rate: number | null | undefined): rate is number {
  return rate != null && Number.isFinite(rate);
}

function hasAnyPricingRate(
  materialRate: number | null | undefined,
  laborRate: number | null | undefined
): boolean {
  return pricingRateDefined(materialRate) || pricingRateDefined(laborRate);
}

/** Mid-market planning band for national-average takeoff fills. */
function planningComparisonRange(total: number): { low: number; high: number } {
  return { low: Math.round(total * 0.75), high: Math.round(total * 1.35) };
}

function medianPositive(values: number[]): number | null {
  const sorted = values
    .filter(n => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : round2((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Plans/engineering soft cost — prefer builder-budget architectural allowance (~$3k),
 * not the full site stage or Silver Leaf twin-home $1.5k seed line alone.
 */
function plansEngineeringComponentTotal(
  evidence: BenchmarkSuggestion,
  templateKey?: string | null
): number | null {
  const soft = getBuilderBudgetSoftCostAllowance(
    'plans_engineering',
    templateKey
  );
  if (soft?.amount) return soft.amount;

  const fromDetached = (evidence.detachedComparables || [])
    .map(p => Number(p.scopeCost))
    .filter(n => Number.isFinite(n) && n > 0 && n < 20000);
  const fromAll = (evidence.comparables || [])
    .map(p => Number(p.scopeCost))
    .filter(n => Number.isFinite(n) && n > 0 && n < 20000);
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
  if (!evidence || !selected || stageTotal == null || stageTotal <= 0)
    return null;

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
    (groundUpLocked ||
      stageHasAcceptedTradePricing(stageId, pricingAcceptance));

  // Separate trades never inherit the living-SF stage lump (fill or comparison).
  if (isSeparateTrade && !isStageHost && measurementSemanticsV1Enabled()) {
    return null;
  }

  // Cleanup/haul-off: dumpster + final clean mat/labor — not the living-SF Final Steps package.
  if (itemId === 'cleanup' && measurementSemanticsV1Enabled()) {
    return null;
  }

  // Plans/engineering: soft-cost allowance — not Site Work / Preconstruction stage.
  // Must run before included-child short-circuit (plans is listed under that stage's covers).
  if (itemId === 'plans_engineering' && measurementSemanticsV1Enabled()) {
    const soft = getBuilderBudgetSoftCostAllowance(
      'plans_engineering',
      templateKey
    );
    const componentTotal = plansEngineeringComponentTotal(
      evidence,
      templateKey
    );
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
    const rateLabel =
      soft?.sourceLabel || 'Suggested · Southern Utah benchmark';
    const helper = soft
      ? `${soft.note} Sitework living-SF package is separate.`
      : `Local plans/engineering references (~$${Math.round(componentTotal).toLocaleString()}). Sitework living-SF package is separate.`;
    return {
      material: 0,
      labor: round2(componentTotal),
      total: round2(componentTotal),
      materialSource: 'local_benchmark',
      laborSource: 'local_benchmark',
      rateSourceLabel: rateLabel,
      helper,
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
      benchmarkAction:
        action === 'comparison_only' ? 'comparison_only' : 'benchmark_only',
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
          source: soft
            ? 'Builder-budget architectural plan allowance'
            : 'Local plans/engineering references',
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
    hasPrimaryTakeoff: Boolean(
      evidence.quantityRoles?.primaryTakeoff?.quantity
    ),
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
    helper: tradeModeActive
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
      level === 'stage'
        ? STAGE_COVERS_SCOPE_KEYS[stageId || ''] || [itemId]
        : [itemId],
    benchmarkAction: action,
    benchmarkApplicationKey: appKey,
    storedTotalExact: round2(stageTotal),
    benchmarkEvidence: {
      ...evidence,
      benchmarkIsComparisonOnly:
        comparisonOnly || evidence.benchmarkIsComparisonOnly,
      benchmarkLevel: level,
      benchmarkStageKey: stageId,
      coversScopeKeys:
        level === 'stage'
          ? STAGE_COVERS_SCOPE_KEYS[stageId || ''] || [itemId]
          : [itemId],
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
  if (!benchmarkEngineV1Enabled() || !measurementSemanticsV1Enabled())
    return null;
  const profile = getTradeMeasurementProfile(itemId);
  if (!profile?.canUseLivingSfAsBenchmark) return null;
  const block = benchmarkSuggestedPricingBlock(
    itemId,
    false,
    pricingAcceptance,
    templateKey
  );
  if (!block) return null;
  if (block.isComparison) return { fill: null, comparison: block };
  return { fill: block, comparison: null };
}

function rateSourceLabelFor(
  materialSource: PricingLegSource,
  laborSource: PricingLegSource,
  template: TemplateRateMatch | null | undefined,
  regional?: ResolvedRegionalPricing | null,
  average?: NationalAverageBudgetSplit | null
): string {
  const usesTemplate =
    materialSource === 'template' || laborSource === 'template';
  if (usesTemplate) return templateRateSourceLabel(template);
  if (regional && regional.multiplier !== 1) return regional.rateSourceLabel;
  if (
    (materialSource === 'national_average' ||
      laborSource === 'national_average') &&
    average?.sourceLabel
  ) {
    return average.sourceLabel;
  }
  return 'Suggested · National Average';
}

function drywallScopeRowIncluded(
  pricingContext: ScopePricingContext | null | undefined,
  itemId: string
): boolean {
  return Boolean(
    pricingContext?.checklistItems?.some(
      item =>
        item.id === itemId &&
        String(item.state || '').toLowerCase() === 'included' &&
        String(item.choiceId || '').toLowerCase() !== 'no'
    )
  );
}

function drywallAddonHasExplicitPricing(
  resolved: Pick<
    ResolvedItemQuantity,
    'dualMaterial' | 'dualLabor' | 'dualAllowance'
  >
): boolean {
  return [
    resolved.dualMaterial,
    resolved.dualLabor,
    resolved.dualAllowance,
  ].some(value => Number(value?.quantity) > 0);
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
  const withBarometer =
    itemId === 'site_prep' ||
    itemId === 'excavation' ||
    itemId === 'pour_foundation' ||
    itemId === 'roofing' ||
    itemId === 'roof_tie_in' ||
    itemId === 'shingles_roofing' ||
    itemId === 'tear_off' ||
    itemId === 'decking_repair' ||
    itemId === 'roof_repairs'
      ? base
      : applyBuilderBudgetBarometer(itemId, unit || base.unit, base) || base;

  if (regional.multiplier === 1) {
    return { average: withBarometer, regional };
  }
  return {
    average: applyRegionalMultiplierToBudgetSplit(withBarometer, regional),
    regional,
  };
}

function hvacEquipmentReplacementAverage(
  measurementsInput: Record<string, unknown>,
  regional: ResolvedRegionalPricing
): NationalAverageBudgetSplit {
  const itemQuantities =
    (measurementsInput.itemQuantities as Record<string, unknown>) || {};
  const typed = Object.entries(itemQuantities).filter(([key, entry]) => {
    const quantity = parseScopeMeasurementInput(
      String((entry as { quantity?: unknown })?.quantity ?? '')
    );
    return key.startsWith('equipment_replace__') && quantity != null && quantity > 0;
  });
  const generic = { material: 5500, labor: 3500 };
  let material = 0;
  let labor = 0;
  const labels: string[] = [];

  for (const [key, entry] of typed) {
    const optionId = key.slice('equipment_replace__'.length);
    const rate = HVAC_EQUIPMENT_REPLACEMENT_RATES[optionId] || {
      ...generic,
      label: 'HVAC equipment replacement',
    };
    const quantity = parseScopeMeasurementInput(
      String((entry as { quantity?: unknown })?.quantity ?? '')
    ) || 0;
    material += quantity * rate.material;
    labor += quantity * rate.labor;
    labels.push(`${quantity} ${rate.label}`);
  }

  const requestedCount = parseScopeMeasurementInput(
    String(measurementsInput.hvacEquipmentReplacementCount ?? '')
  );
  const typedCount = typed.reduce((sum, [, entry]) => {
    return (
      sum +
      (parseScopeMeasurementInput(
        String((entry as { quantity?: unknown })?.quantity ?? '')
      ) || 0)
    );
  }, 0);
  const untypedCount = Math.max(0, (requestedCount || typedCount) - typedCount);
  if (untypedCount > 0 || typed.length === 0) {
    const fallbackCount = typed.length === 0 ? requestedCount || 1 : untypedCount;
    material += fallbackCount * generic.material;
    labor += fallbackCount * generic.labor;
    if (typed.length === 0) labels.push('standard HVAC equipment replacement');
    else if (untypedCount > 0) labels.push(`${untypedCount} unspecified HVAC replacement`);
  }

  const basisCount = requestedCount || typedCount || 1;
  const base = {
    unit: 'each' as const,
    material: material / basisCount,
    labor: labor / basisCount,
    sourceLabel: 'Suggested budget split · National Average · HVAC equipment replacement',
  };
  const adjusted =
    regional.multiplier === 1
      ? base
      : applyRegionalMultiplierToBudgetSplit(base, regional) || base;
  return {
    unit: 'each',
    material: round2(adjusted.material),
    labor: round2(adjusted.labor),
    sourceLabel: `Suggested budget split · National Average · ${labels.join(', ')}`,
    geographicBasis: regional.geographicBasis || 'national',
  };
}

/** True when Confirm Scope comparison is pure national (eligible to Apply / Use this pricing). */
export function isNationalAverageComparisonBlock(
  block:
    | Pick<
        SuggestedPricingBlock,
        'isComparison' | 'rateSourceLabel' | 'pricingRecordId'
      >
    | null
    | undefined
): boolean {
  if (!block?.isComparison) return false;
  if (
    /national\s*average\s*comparison/i.test(String(block.rateSourceLabel || ''))
  )
    return true;
  return String(block.pricingRecordId || '').startsWith(
    'bps_national_comparison:'
  );
}

/** National-average planning estimates for standard residential demolition. */
const FLOORING_DEMO_TOTAL_RATES: Record<string, number> = {
  carpet: 1.75,
  laminate: 1.75,
  lvp: 2,
  sheet_vinyl_vct: 2.25,
  engineered_hardwood: 3.5,
  solid_hardwood: 4,
  tile: 4.5,
  unknown: 3,
};

function flooringInstallNationalAverage(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended
): { material: number; labor: number; sourceLabel: string } | null {
  if (itemId === 'flooring_carpet') {
    return {
      material: 3.5,
      labor: 1.5,
      sourceLabel: 'Suggested budget split · National Average · carpet + pad',
    };
  }
  if (itemId === 'flooring_sheet_vinyl') {
    if (measurementsInput.flooringNewSheetVinylType === 'vct') {
      return {
        material: 3,
        labor: 4,
        sourceLabel:
          'Suggested budget split · National Average · VCT / vinyl composition tile',
      };
    }
    if (measurementsInput.flooringNewSheetVinylType === 'sheet_vinyl') {
      return {
        material: 2.5,
        labor: 2.5,
        sourceLabel: 'Suggested budget split · National Average · sheet vinyl',
      };
    }
    return null;
  }
  if (itemId !== 'flooring_lvp') return null;
  if (measurementsInput.flooringNewLvpInstallMethod === 'floating') {
    return {
      material: 3.5,
      labor: 3.5,
      sourceLabel:
        'Suggested budget split · National Average · floating/click-lock LVP',
    };
  }
  if (measurementsInput.flooringNewLvpInstallMethod === 'glue_down') {
    return {
      material: 4.25,
      labor: 4.75,
      sourceLabel: 'Suggested budget split · National Average · glue-down LVP',
    };
  }
  return null;
}

function flooringDemoRateFor(
  type: string,
  notes: string | null | undefined,
  measurementsInput?: ScopeMeasurementsInputExtended
): number {
  if (
    type === 'tile' &&
    /heavy\s+tile|difficult(?:y)?\s+(?:tile\s+)?remov|mud[\s-]?set|thick\s+set|multiple\s+tile\s+layers?|bonded\s+underlayment/i.test(
      String(notes || '')
    )
  )
    return 5.5;
  if (type === 'lvp') {
    if (measurementsInput?.flooringExistingLvpInstallMethod === 'glue_down')
      return 3.25;
    if (measurementsInput?.flooringExistingLvpInstallMethod === 'floating')
      return 2;
    // Missing/unknown method — keep pricing visible as a reviewable mid-rate.
    return 2.5;
  }
  if (type === 'sheet_vinyl_vct') {
    if (measurementsInput?.flooringExistingSheetVinylType === 'vct')
      return 3.25;
    if (measurementsInput?.flooringExistingSheetVinylType === 'sheet_vinyl')
      return 2.25;
    // Missing/unknown subtype — keep pricing visible as a reviewable mid-rate.
    return 2.75;
  }
  if (
    type === 'vinyl' &&
    /glue[\s-]?down|adhesive[\s-]?backed/i.test(String(notes || ''))
  ) {
    return 3;
  }
  return FLOORING_DEMO_TOTAL_RATES[type] ?? FLOORING_DEMO_TOTAL_RATES.unknown;
}

function flooringDemoSplitFor(
  type: string,
  notes: string | null | undefined,
  measurementsInput?: ScopeMeasurementsInputExtended
): { material: number; labor: number; rate: number; review: boolean } {
  const rate = flooringDemoRateFor(type, notes, measurementsInput);
  if (type === 'carpet')
    return { material: 0.35, labor: 1.4, rate: 1.75, review: false };
  if (type === 'tile') {
    const heavy = rate === 5.5;
    return {
      material: heavy ? 1.1 : 0.9,
      labor: heavy ? 4.4 : 3.6,
      rate,
      review: heavy,
    };
  }
  if (type === 'solid_hardwood')
    return { material: 0.65, labor: 3.35, rate: 4, review: false };
  if (type === 'engineered_hardwood') {
    const review = !/floating|nailed|stapled|glue[\s-]?down/i.test(
      String(notes || '')
    );
    return { material: 0.55, labor: 2.95, rate: 3.5, review };
  }
  if (type === 'laminate')
    return { material: 0.3, labor: 1.45, rate: 1.75, review: false };
  if (type === 'lvp') {
    if (measurementsInput?.flooringExistingLvpInstallMethod === 'glue_down') {
      return { material: 0.55, labor: 2.7, rate: 3.25, review: false };
    }
    if (measurementsInput?.flooringExistingLvpInstallMethod === 'floating') {
      return { material: 0.4, labor: 1.6, rate: 2, review: false };
    }
    return { material: 0.45, labor: 2.05, rate: 2.5, review: true };
  }
  if (type === 'sheet_vinyl_vct') {
    if (measurementsInput?.flooringExistingSheetVinylType === 'vct') {
      return { material: 0.6, labor: 2.65, rate: 3.25, review: false };
    }
    if (measurementsInput?.flooringExistingSheetVinylType === 'sheet_vinyl') {
      return { material: 0.45, labor: 1.8, rate: 2.25, review: false };
    }
    return { material: 0.5, labor: 2.25, rate: 2.75, review: true };
  }
  return { material: 0.6, labor: 2.4, rate: 3, review: true };
}

function flooringDemoLabelForPricing(
  type: string,
  notes: string | null | undefined,
  measurementsInput: ScopeMeasurementsInputExtended
): string {
  if (type === 'carpet') return 'Carpet and pad';
  if (type === 'laminate') return 'Floating laminate';
  if (type === 'solid_hardwood') return 'Solid hardwood';
  if (type === 'engineered_hardwood') return 'Engineered hardwood';
  if (type === 'unknown') return 'Existing flooring — type not confirmed';
  if (type === 'lvp') {
    if (measurementsInput.flooringExistingLvpInstallMethod === 'glue_down')
      return 'Glue-down LVP';
    if (measurementsInput.flooringExistingLvpInstallMethod === 'floating')
      return 'Floating/click-lock LVP';
    return 'LVP — installation method not confirmed';
  }
  if (type === 'sheet_vinyl_vct') {
    if (measurementsInput.flooringExistingSheetVinylType === 'vct')
      return 'VCT (vinyl composition tile)';
    if (measurementsInput.flooringExistingSheetVinylType === 'sheet_vinyl')
      return 'Sheet vinyl';
    return 'Sheet vinyl/VCT — type not confirmed';
  }
  if (type === 'tile') {
    return /heavy\s+tile|difficult(?:y)?\s+(?:tile\s+)?remov|mud[\s-]?set|thick\s+set|multiple\s+tile\s+layers?|bonded\s+underlayment/i.test(
      String(notes || '')
    )
      ? 'Heavy tile or mortar-bed tile'
      : 'Ceramic/porcelain tile';
  }
  return type.replace(/_/g, ' ');
}

function flooringDemoNationalAverage(
  measurementsInput: ScopeMeasurementsInputExtended,
  fallbackCount: number,
  originalNotes?: string | null
): {
  material: number;
  labor: number;
  materialBucketLabel: string;
  sourceLabel: string;
  pricingDetail: string | null;
} {
  const types = Array.isArray(measurementsInput.flooringExistingTypes)
    ? measurementsInput.flooringExistingTypes.filter(
        type => typeof type === 'string'
      )
    : [];
  const itemQuantities = (measurementsInput.itemQuantities || {}) as Record<
    string,
    { quantity?: number | string } | undefined
  >;
  const areas = types
    .map(type => ({
      type,
      area: Number(itemQuantities[`floor_demo__${type}`]?.quantity || 0),
    }))
    .filter(entry => entry.area > 0);
  const weightedArea = areas.reduce((sum, entry) => sum + entry.area, 0);
  const area = weightedArea > 0 ? weightedArea : Math.max(0, fallbackCount);
  if (types.length > 0 && areas.length !== types.length) {
    return {
      material: 0,
      labor: 0,
      materialBucketLabel:
        'Equipment, protection, cleaning, haul-off & disposal',
      sourceLabel: 'Suggested · National Average · demo area required',
      pricingDetail:
        'Enter a removal area greater than zero for every selected existing flooring type.',
    };
  }
  const pricedAreas = areas.map(entry => ({
    ...entry,
    split: flooringDemoSplitFor(entry.type, originalNotes, measurementsInput),
  }));
  const fallbackSplits = types.length
    ? types.map(type =>
        flooringDemoSplitFor(type, originalNotes, measurementsInput)
      )
    : [flooringDemoSplitFor('unknown', originalNotes, measurementsInput)];
  const fallbackRate =
    fallbackSplits.reduce((sum, split) => sum + split.rate, 0) /
    fallbackSplits.length;
  const exactDemoTotal =
    weightedArea > 0
      ? pricedAreas.reduce(
          (sum, entry) => sum + entry.area * entry.split.rate,
          0
        )
      : area * fallbackRate;
  const materialTotal =
    weightedArea > 0
      ? pricedAreas.reduce(
          (sum, entry) => sum + entry.area * entry.split.material,
          0
        )
      : area *
        (fallbackSplits.reduce((sum, split) => sum + split.material, 0) /
          fallbackSplits.length);
  const laborTotal =
    weightedArea > 0
      ? pricedAreas.reduce(
          (sum, entry) => sum + entry.area * entry.split.labor,
          0
        )
      : area *
        (fallbackSplits.reduce((sum, split) => sum + split.labor, 0) /
          fallbackSplits.length);
  const material = area > 0 ? materialTotal / area : 0;
  const labor = area > 0 ? laborTotal / area : 0;
  const hasReview =
    pricedAreas.some(entry => entry.split.review) ||
    fallbackSplits.some(split => split.review);
  const pricingDetail =
    areas.length > 0
      ? [
          ...pricedAreas.map(entry => {
            const rate = entry.split.rate;
            const label = flooringDemoLabelForPricing(
              entry.type,
              originalNotes,
              measurementsInput
            );
            const title = label.charAt(0).toUpperCase() + label.slice(1);
            return [
              `${entry.area.toLocaleString()} SF ${title} removal @ $${rate.toFixed(2)}/SF = $${round2(entry.area * rate).toLocaleString()}`,
              demoCatalogAssumptionNote(entry.type, measurementsInput),
            ].join('\n');
          }),
          'Protection, ordinary substrate cleaning, haul-off, and disposal included.',
          `Total: $${round2(exactDemoTotal).toLocaleString()}`,
          `Blended rate: $${(area > 0 ? exactDemoTotal / area : 0).toFixed(2)}/SF`,
          'Extra residual grinding, patching, skim coating, and leveling are priced under floor prep.',
          ...(hasReview
            ? [
                'Review before bid: verify the existing installation or demolition difficulty.',
              ]
            : []),
        ].join('\n')
      : null;
  return {
    material,
    labor,
    materialBucketLabel: 'Equipment, protection, cleaning, haul-off & disposal',
    sourceLabel: `Suggested budget split · National Average planning estimate · flooring demolition · ${area.toLocaleString()} SF${hasReview ? ' · Review before bid' : ''}`,
    pricingDetail,
  };
}

function floorPrepPricing(
  measurementsInput: ScopeMeasurementsInputExtended,
  pricingCount: number,
  quantitySource?: string | null
): {
  material: number;
  labor: number;
  sourceLabel: string;
  pricingDetail: string | null;
  reviewBeforeBid?: boolean;
} {
  const context = buildFloorPrepPricingContext(measurementsInput, {
    pricingCount,
    quantitySource,
  });
  if (!context.ok) {
    // An unresolved demo disclosure must remain visible for review. Returning
    // zero rates here made the entire prep card disappear, hiding the overlap
    // that the user still needs to resolve.
    if (context.reviewBeforeBid) {
      const reviewContext = buildFloorPrepPricingContext(
        { ...measurementsInput, flooringDemoIncludesSubstratePrep: 'no' },
        { pricingCount, quantitySource }
      );
      if (
        reviewContext.ok &&
        !reviewContext.includedInDemo &&
        reviewContext.totalPrepArea > 0
      ) {
        return {
          material: reviewContext.totalMaterial / reviewContext.totalPrepArea,
          labor: reviewContext.totalLabor / reviewContext.totalPrepArea,
          sourceLabel: context.sourceLabel,
          pricingDetail: `${context.pricingDetail}\n\n${reviewContext.pricingDetail}`,
          reviewBeforeBid: true,
        };
      }
    }
    return {
      material: 0,
      labor: 0,
      sourceLabel: context.sourceLabel,
      pricingDetail: context.pricingDetail,
      reviewBeforeBid: context.reviewBeforeBid,
    };
  }
  if (context.includedInDemo || context.totalPrepArea <= 0) {
    return {
      material: 0,
      labor: 0,
      sourceLabel: context.sourceLabel,
      pricingDetail: context.pricingDetail,
    };
  }
  return {
    material:
      context.totalPrepArea > 0
        ? context.totalMaterial / context.totalPrepArea
        : 0,
    labor:
      context.totalPrepArea > 0
        ? context.totalLabor / context.totalPrepArea
        : 0,
    sourceLabel: context.sourceLabel,
    pricingDetail: context.pricingDetail,
  };
}

/**
 * Confirm Scope comparison card: pure national average on the same qty/unit as the
 * suggested fill (no local barometer, no living-SF stage lump). Only paired when
 * the primary fill comes from the contractor pricing library.
 */
function pricingLibraryTemplateMatch(
  template: TemplateRateMatch | null | undefined
): boolean {
  return template?.origin === 'pricing_library';
}

export function buildPureNationalAverageComparisonBlock(params: {
  itemId: string;
  basis: { quantity: number; unit: string } | null | undefined;
  /** When fill is already within ~2% of pure national, skip a redundant card. */
  fillTotal?: number | null;
}): SuggestedPricingBlock | null {
  const qty = Number(params.basis?.quantity);
  const unit = String(params.basis?.unit || '').toLowerCase();
  if (!(qty > 0) || !unit) return null;
  if (
    unit === 'allowance' ||
    unit === 'lump_sum' ||
    unit === 'ls' ||
    unit === 'living_sqft'
  ) {
    return null;
  }

  const average = getNationalAverageBudgetSplit(params.itemId, unit);
  if (
    !average ||
    average.material == null ||
    average.labor == null ||
    !(average.material >= 0) ||
    !(average.labor >= 0) ||
    average.material + average.labor <= 0
  ) {
    return null;
  }

  const material = round2(qty * average.material);
  const labor = round2(qty * average.labor);
  const total = round2(material + labor);
  if (!(total > 0)) return null;

  const fillTotal = Number(params.fillTotal);
  if (
    Number.isFinite(fillTotal) &&
    fillTotal > 0 &&
    Math.abs(total - fillTotal) / fillTotal < 0.02
  ) {
    return null;
  }

  const unitLabel = formatUnitLabel(unit);
  const qtyLabel =
    Math.abs(qty - Math.round(qty)) < 0.05
      ? Math.round(qty).toLocaleString()
      : qty.toLocaleString(undefined, { maximumFractionDigits: 1 });

  return {
    material,
    labor,
    total,
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel: 'National average comparison',
    helper: `Based on ${qtyLabel} ${unitLabel} · national average (no local barometer)`,
    mode: 'suggested_price',
    isComparison: true,
    basis: { quantity: qty, unit },
    costBuckets: [
      {
        key: 'material',
        label: 'Material',
        amount: material,
        rate: average.material,
        source: 'national_average',
      },
      {
        key: 'labor',
        label: 'Labor',
        amount: labor,
        rate: average.labor,
        source: 'national_average',
      },
    ],
    pricingRecordId: `bps_national_comparison:${params.itemId}:${unit}`,
    productionStatus: average.productionStatus || 'review_required',
    benchmarkLevel: 'component',
    benchmarkStageKey: benchmarkStageForScopeKey(params.itemId),
    benchmarkScopeKey: params.itemId,
    benchmarkAction: 'comparison_only',
    storedTotalExact: total,
  };
}

/** Plan H64 installed HVAC package — Utah-only reference comparison. */
export function buildHvacPlanBarometerComparisonBlock(params: {
  livingSf?: number | null;
  fillTotal?: number | null;
  pricingContext?: ScopePricingContext | null;
}): SuggestedPricingBlock | null {
  if (!isSouthernUtahPricingLocation(params.pricingContext)) return null;
  const comparable = resolveHvacPackageComparable(params.livingSf);
  if (!comparable) return null;
  const total = comparable.h64InstalledTotal;
  const fillTotal = Number(params.fillTotal);
  if (
    Number.isFinite(fillTotal) &&
    fillTotal > 0 &&
    Math.abs(total - fillTotal) / fillTotal < 0.02
  ) {
    return null;
  }
  const split = hvacPlanBarometerComparisonSplit(total);
  return {
    material: split.material,
    labor: split.labor,
    total,
    materialSource: 'local_benchmark',
    laborSource: 'local_benchmark',
    rateSourceLabel: `${comparable.projectLabel} H64 HVAC package`,
    helper: `Reference only · ${hvacPackageComparableHelper(comparable)} · builder budget`,
    mode: 'suggested_price',
    isComparison: true,
    basis: { quantity: 1, unit: 'each' },
    costBuckets: [
      {
        key: 'material',
        label: 'Material',
        amount: split.material,
        source: 'local_benchmark',
      },
      {
        key: 'labor',
        label: 'Labor',
        amount: split.labor,
        source: 'local_benchmark',
      },
    ],
    pricingRecordId: `bps_local_hvac_h64:${comparable.projectId}`,
    productionStatus: 'review_required',
    benchmarkAction: 'comparison_only',
  };
}

function buildHvacInstalledPackageSuggestedPricing(
  measurementsInput: Record<string, unknown>,
  pricingContext?: ScopePricingContext | null
): ScopeItemSuggestedPricing | null {
  const resolved = resolveHvacInstalledPackageSuggestedTotal(
    measurementsInput,
    pricingContext
  );
  if (!resolved) return null;
  const { comparable, tier } = resolved;
  const basisQuantity = resolved.basisQuantity ?? 1;
  const regional =
    tier === 'plan_barometer'
      ? null
      : regionalPricingFromContext(pricingContext);
  const baseSplit = {
    unit: 'each' as const,
    material: resolved.material,
    labor: resolved.labor,
    sourceLabel: 'Suggested budget split · National Average · HVAC package',
  };
  const adjustedSplit =
    regional && regional.multiplier !== 1
      ? applyRegionalMultiplierToBudgetSplit(
          baseSplit,
          regional
        ) || baseSplit
      : baseSplit;
  const material = round2(adjustedSplit.material);
  const labor = round2(adjustedSplit.labor);
  const total = round2(material + labor);
  const comparisonRange =
    basisQuantity > 1
      ? HVAC_NATIONAL_MULTI_SYSTEM_PACKAGE_RANGE
      : HVAC_NATIONAL_COMPLETE_PACKAGE_RANGE;
  const totalTons = Number(
    String(measurementsInput.hvacSystemTons ?? '').replace(/,/g, '')
  );
  const displayQuantityLine =
    totalTons > 0
      ? `${basisQuantity} ${basisQuantity === 1 ? 'system' : 'systems'} · ${totalTons.toLocaleString()} tons`
      : `${basisQuantity} ${basisQuantity === 1 ? 'system' : 'systems'}`;
  const displayUnitRateLabel =
    tier === 'plan_barometer'
      ? null
      : `$${(total / basisQuantity).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}/system`;
  const helper =
    tier === 'plan_barometer' && comparable
      ? `Complete builder package · ${hvacPackageComparableHelper(comparable)} · includes equipment, ductwork, registers, thermostat, startup`
      : basisQuantity > 1
        ? `${basisQuantity} complete HVAC systems · planning estimate · includes standard equipment, ductwork, registers, thermostat, and startup`
        : `Complete-system planning allowance · national package ~$${HVAC_BPS_PLANNING_PACKAGE_RANGE.low.toLocaleString()}–$${HVAC_BPS_PLANNING_PACKAGE_RANGE.high.toLocaleString()}`;
  const fill: SuggestedPricingBlock = {
    material,
    labor,
    total,
    materialSource: tier === 'plan_barometer' ? 'local_benchmark' : 'national_average',
    laborSource: tier === 'plan_barometer' ? 'local_benchmark' : 'national_average',
    rateSourceLabel:
      tier === 'plan_barometer' && comparable
        ? `${comparable.projectLabel} builder budget (H64)`
        : 'Suggested · National Average (planning package)',
    helper,
    mode: 'suggested_price',
    basis: { quantity: basisQuantity, unit: 'each' },
    comparisonRange,
    displayQuantityLine,
    displayUnitRateLabel,
    pricingDetail:
      tier === 'plan_barometer' && comparable
        ? [
            'Included: equipment, ductwork, registers, returns, thermostat, and startup.',
            'Excluded: ERV/HRV, gas lines, electrical, and permits unless added separately.',
          ].join('\n')
        : [
            'Included: equipment, ductwork, registers, returns, thermostat, and startup.',
            'Excluded: ERV/HRV, gas lines, electrical, and permits unless added separately.',
            `Typical national range: $${comparisonRange.low.toLocaleString()}–$${comparisonRange.high.toLocaleString()}.`,
          ].join('\n'),
    costBuckets: [
      {
        key: 'material',
        label: 'Material',
        amount: material,
        source: tier === 'plan_barometer' ? 'local_benchmark' : 'national_average',
      },
      {
        key: 'labor',
        label: 'Labor',
        amount: labor,
        source: tier === 'plan_barometer' ? 'local_benchmark' : 'national_average',
      },
    ],
    pricingRecordId:
      tier === 'plan_barometer' && comparable
        ? `bps_local_hvac_h64:${comparable.projectId}`
        : 'bps_national:hvac:package_allowance',
    productionStatus: 'review_required',
    benchmarkAction: 'price_ready',
  };
  const nationalComparison = buildPureNationalAverageComparisonBlock({
    itemId: 'hvac',
    basis: { quantity: basisQuantity, unit: 'each' },
    fillTotal: total,
  });
  return applyProjectComplexityToSuggestedPricing(
    'hvac',
    measurementsInput.planImportTradeKey === 'hvac' ? 'hvac' : 'ground_up',
    {
      floorAreaSqft: measurementsInput.floorAreaSqft,
      storyCount: measurementsInput.storyCount,
      planFacts: measurementsInput.planFacts,
      projectComplexity: measurementsInput.projectComplexity,
      planImportMode: measurementsInput.planImportMode,
      planImportTradeKey: measurementsInput.planImportTradeKey,
      planImportFingerprint: measurementsInput.planImportFingerprint,
      quickMeasurementSources: measurementsInput.quickMeasurementSources,
      quickMeasurementUserOverrides:
        measurementsInput.quickMeasurementUserOverrides,
    },
    {
      fill,
      comparison:
        nationalComparison &&
        Math.abs(nationalComparison.total - total) / total >= 0.02
          ? nationalComparison
          : buildHvacPlanBarometerComparisonBlock({
              livingSf:
                Number(measurementsInput.floorAreaSqft) ||
                Number(
                  (
                    measurementsInput.planFacts as
                      | { buildingAreas?: { totalLivingSqft?: number } }
                      | undefined
                  )?.buildingAreas?.totalLivingSqft
                ) ||
                null,
              fillTotal: total,
              pricingContext,
            }),
    }
  ) as ScopeItemSuggestedPricing;
}

function flatAllowanceCopyFor(itemId: string): {
  fromNotes: string;
  suggested: string;
} {
  const copyByItem: Record<string, { fromNotes: string; suggested: string }> = {
    cleanup: {
      fromNotes: 'Cleanup/disposal parsed from notes.',
      suggested:
        'Suggested cleanup and disposal — adjust Material for dumpster count.',
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
    appliances: {
      fromNotes: 'Appliance install allowance parsed from notes.',
      suggested: 'Suggested appliance install allowance.',
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

function resolveSouthernUtahPaintTrimSuggestedFill(params: {
  itemId: string;
  templateKey?: string | null;
  measurementsInput: ScopeMeasurementsInputExtended;
  paintableOrCount?: number | null;
  unit?: string | null;
  pricingContext?: ScopePricingContext | null;
}): SuggestedPricingBlock | null {
  const id = String(params.itemId || '')
    .trim()
    .toLowerCase();
  const livingSf = parseScopeMeasurementInput(
    params.measurementsInput.floorAreaSqft
  );
  const paintableSf =
    parseScopeMeasurementInput(params.measurementsInput.wallPaintSqft) ||
    (params.unit === 'sqft' && Number(params.paintableOrCount) > 0
      ? Number(params.paintableOrCount)
      : null);
  const state = params.pricingContext?.state;

  if (id === 'interior_paint' || id === 'paint' || id === 'paint_trim') {
    const isGroundUp =
      String(params.templateKey || '').toLowerCase() === 'ground_up';
    const hasExactProject = Boolean(
      livingSf && matchSouthernUtahProjectByLivingSf(livingSf)
    );
    // Remodel / non-ground-up: only use local when living SF exactly matches a source project.
    if (!isGroundUp && !hasExactProject) return null;
    // Combined paint_trim legacy line: price interior paint only (trim is separate).
    const comparable = resolveInteriorPaintComparable({
      livingSf,
      paintableSf,
      state,
    });
    const total = round2(comparable.total);
    return {
      material: 0,
      labor: total,
      total,
      materialSource: 'local_benchmark',
      laborSource: 'local_benchmark',
      rateSourceLabel: comparable.rateSourceLabel,
      helper: comparable.helper,
      mode: 'suggested_price',
      lumpSumOnly: true,
      installedBudgetBenchmark: true,
      splitSource: 'none',
      splitConfidence: 'none',
      comparisonRange: comparable.range,
      impliedUnitRateLabel: comparable.impliedRateLabel,
      basis:
        comparable.paintableSf != null
          ? { quantity: comparable.paintableSf, unit: 'sqft' }
          : null,
      benchmarkLivingSf: comparable.livingSfBenchmark,
      costBuckets: [
        {
          key: 'allowance',
          label: 'Installed paint budget',
          amount: total,
          rate: null,
          source: 'local_benchmark',
        },
      ],
      pricingRecordId: `su_paint:${comparable.projectId || 'median'}:installed`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: id === 'paint_trim' ? 'interior_paint' : id,
      benchmarkAction: 'price_ready',
      storedTotalExact: total,
    };
  }

  if (id === 'interior_trim' || id === 'finish_carpentry') {
    const isGroundUp =
      String(params.templateKey || '').toLowerCase() === 'ground_up';
    const hasExactProject = Boolean(
      livingSf && matchSouthernUtahProjectByLivingSf(livingSf)
    );
    if (!isGroundUp && !hasExactProject) return null;
    const comparable = resolveFinishCarpentryComparable({ livingSf, state });
    const trimLivingSfRef = installedBudgetLivingSfReference({
      total: comparable.total,
      livingSf:
        (livingSf && matchSouthernUtahProjectByLivingSf(livingSf)?.livingSf) ||
        livingSf,
      barometerLabel: comparable.projectLabel,
    });
    return {
      material: round2(comparable.material),
      labor: round2(comparable.labor),
      total: round2(comparable.total),
      materialSource: 'local_benchmark',
      laborSource: 'local_benchmark',
      rateSourceLabel: comparable.rateSourceLabel,
      helper: comparable.helper,
      mode: 'suggested_price',
      lumpSumOnly: false,
      installedBudgetBenchmark: false,
      splitSource: comparable.splitSource,
      splitConfidence: comparable.splitConfidence,
      basis: null,
      impliedUnitRateLabel: trimLivingSfRef?.impliedUnitRateLabel ?? null,
      benchmarkLivingSf: trimLivingSfRef?.benchmarkLivingSf ?? null,
      costBuckets: [
        {
          key: 'material',
          label: 'Material',
          amount: round2(comparable.material),
          rate: null,
          source: 'local_benchmark',
        },
        {
          key: 'labor',
          label: 'Labor',
          amount: round2(comparable.labor),
          rate: null,
          source: 'local_benchmark',
        },
      ],
      pricingRecordId: `su_trim:${comparable.projectId || 'median'}:package`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'interior_trim',
      benchmarkAction: 'price_ready',
      storedTotalExact: round2(comparable.total),
    };
  }

  if (id === 'exterior_paint') {
    // No local samples — leave national path, but never claim SU calibration.
    void params.templateKey;
    if (exteriorPaintLocalSampleCount() !== 0) return null;
    return null;
  }

  return null;
}

function userHasCommittedScopePricing(
  itemId: string,
  itemQuantities: Record<string, ScopeItemQuantityLike>,
  pricingAcceptance?: Record<string, { selectionStatus?: string }>
): boolean {
  if (
    pricingAcceptance?.[itemId]?.selectionStatus === 'user_entered' ||
    pricingAcceptance?.[itemId]?.selectionStatus === 'manual_adjusted'
  ) {
    return true;
  }
  return (
    hasUserEnteredFlatAllowancePricing(itemQuantities, itemId) ||
    hasUserEnteredMaterialLaborSplit(itemQuantities, itemId)
  );
}

/** National benchmark row for user-entered pricing — never treat dollar totals as qty multipliers. */
function resolveNationalAveragePhysicalCountForBenchmark(
  itemId: string,
  rule: ScopeItemQuantityRule,
  measurementsInput: ScopeMeasurementsInputExtended,
  resolved: SuggestedPricingResolvedQty,
  safeAllowanceCount?: number | null
): { count: number; unit: string } | null {
  const itemQuantities = measurementsInput.itemQuantities || {};
  const measurementMatch = firstMeasurementForRule(rule, measurementsInput);
  const fromMeasurement = firstMeasurementQuantityForRule(
    rule,
    measurementsInput
  );
  const storedSqft = readStoredSqftPricingBasis(itemQuantities, itemId);
  const allowanceEntry = itemQuantities[roughAllowanceSubKey(itemId)];
  const allowanceTotal = Number(
    String(allowanceEntry?.quantity ?? '').replace(/,/g, '')
  );

  let unit =
    rule.defaultUnit === 'allowance' || rule.defaultUnit === 'lump_sum'
      ? rule.defaultUnit
      : measurementMatch?.unit || rule.defaultUnit || 'sqft';

  let count: number | null = safeAllowanceCount ?? null;

  if (fromMeasurement != null && fromMeasurement > 0) {
    const takeoffUnit = measurementMatch?.unit || rule.defaultUnit;
    if (
      count == null ||
      (takeoffUnit === 'sqft' && count <= 1 && fromMeasurement > 1)
    ) {
      count = fromMeasurement;
      unit = takeoffUnit;
    }
  }

  if (
    (count == null || count <= 0) &&
    measurementMatch &&
    measurementMatch.quantity > 0
  ) {
    count = measurementMatch.quantity;
    unit = measurementMatch.unit;
  }

  if ((count == null || count <= 0) && storedSqft != null && storedSqft > 1) {
    count = storedSqft;
    unit = 'sqft';
  }

  if (count == null || count <= 0) {
    count = resolveSuggestedPricingPhysicalCount(
      itemId,
      rule,
      resolved,
      unit,
      itemQuantities
    );
  }

  if (
    count != null &&
    count > 0 &&
    hasUserEnteredFlatAllowancePricing(itemQuantities, itemId)
  ) {
    const defaultCount = rule.defaultQuantity ?? 1;
    if (
      unit === rule.defaultUnit &&
      count > defaultCount + 0.001 &&
      (allowanceTotal > 0 ? Math.abs(count - allowanceTotal) < 0.02 : true)
    ) {
      count = defaultCount;
    }
    if (
      unit === 'sqft' &&
      count <= 1 &&
      allowanceTotal > 50 &&
      fromMeasurement != null &&
      fromMeasurement > 1
    ) {
      count = fromMeasurement;
      unit = measurementMatch?.unit || 'sqft';
    }
  }

  if (
    (!count || count <= 0) &&
    (rule.defaultUnit === 'allowance' || rule.defaultUnit === 'lump_sum')
  ) {
    const { average: flatAverage } = regionalAdjustedNationalAverage(
      itemId,
      rule.defaultUnit,
      null
    );
    if (flatAverage?.labor || flatAverage?.material) {
      count = rule.defaultQuantity ?? 1;
      unit = flatAverage.unit || rule.defaultUnit;
    }
  }

  if (
    (!count || count <= 0) &&
    rule.defaultQuantity != null &&
    hasUserEnteredFlatAllowancePricing(itemQuantities, itemId)
  ) {
    count = rule.defaultQuantity;
    unit = rule.defaultUnit;
  }

  if (count == null || count <= 0) return null;
  return { count, unit };
}

function buildNationalAverageRateFill(
  itemId: string,
  count: number,
  unit: string,
  pricingContext?: ScopePricingContext | null
): ScopeItemSuggestedPricing | null {
  if (unit === 'allowance' || unit === 'lump_sum') {
    return buildSplitTotalOnlySuggestedFill(itemId, pricingContext);
  }
  const { average, regional } = regionalAdjustedNationalAverage(
    itemId,
    unit,
    pricingContext
  );
  const materialRate = average?.material ?? null;
  const laborRate = average?.labor ?? null;
  if (!hasAnyPricingRate(materialRate, laborRate)) return null;
  const material = round2(count * (materialRate ?? 0));
  const labor = round2(count * (laborRate ?? 0));
  const total = round2(material + labor);
  if (total <= 0) return null;
  const national = getNationalAverageBudgetSplit(itemId, unit);
  return {
    fill: {
      material,
      labor,
      total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel:
        national?.sourceLabel ??
        rateSourceLabelFor(
          'national_average',
          'national_average',
          null,
          regional,
          average
        ),
      helper: `Based on ${count.toLocaleString()} ${unit}`,
      mode: 'suggested_price',
      lumpSumOnly: false,
      basis: { quantity: count, unit },
      benchmarkScopeProfile: buildNationalAverageBenchmarkScopeProfile({
        itemId,
        average,
        quantity: count,
        total,
        regional,
      }),
      costBuckets: buildSuggestedPricingCostBuckets({
        itemId,
        average,
        material,
        labor,
        materialRate: materialRate ?? 0,
        laborRate: laborRate ?? 0,
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
      pricingRecordId: `bps_national:${itemId}:${unit}`,
      productionStatus: average?.productionStatus || 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: itemId,
      benchmarkAction: 'price_ready',
    },
    comparison: null,
  };
}

function isPerUnitRateMistakenForTotal(
  fill: SuggestedPricingBlock | null | undefined,
  itemId: string,
  rule: ScopeItemQuantityRule,
  pricingContext?: ScopePricingContext | null
): boolean {
  if (!fill) return false;
  const basisUnit = fill.basis?.unit || rule.defaultUnit;
  if (!['sqft', 'living_sqft'].includes(String(basisUnit).toLowerCase()))
    return false;
  const basisQty = fill.basis?.quantity ?? 0;
  if (basisQty > 1) return false;
  const { average } = regionalAdjustedNationalAverage(
    itemId,
    basisUnit,
    pricingContext
  );
  const perUnit = round2((average?.material ?? 0) + (average?.labor ?? 0));
  return perUnit > 0 && Math.abs(fill.total - perUnit) < 0.02;
}

/** After the contractor already priced a scope, national average is comparison-only. */
function asNationalAverageComparisonOnly(
  result: ScopeItemSuggestedPricing | null
): ScopeItemSuggestedPricing | null {
  if (!result) return null;
  const block = result.comparison || result.fill;
  if (!block || !(block.total > 0)) {
    return result.fill || result.comparison
      ? { fill: null, comparison: result.comparison }
      : null;
  }
  return {
    fill: null,
    comparison: {
      ...block,
      isComparison: true,
      benchmarkAction: 'comparison_only',
      rateSourceLabel: /national\s*average/i.test(
        String(block.rateSourceLabel || '')
      )
        ? String(block.rateSourceLabel).includes('comparison')
          ? block.rateSourceLabel
          : 'National average comparison'
        : 'National average comparison',
      helper: String(block.helper || '')
        .replace(/\s*·\s*suggested comparison$/i, '')
        .concat(' · suggested comparison'),
    },
  };
}

function withUserEnteredNationalBenchmarkFallback(
  itemId: string,
  rule: ScopeItemQuantityRule,
  measurementsInput: ScopeMeasurementsInputExtended,
  resolved: SuggestedPricingResolvedQty,
  templateKey: string | null | undefined,
  pricingContext: ScopePricingContext | null | undefined,
  result: ScopeItemSuggestedPricing,
  options?: ScopeItemSuggestedPricingResolveOptions
): ScopeItemSuggestedPricing {
  result = applyProjectComplexityToSuggestedPricing(
    itemId,
    templateKey,
    {
      floorAreaSqft: measurementsInput.floorAreaSqft,
      storyCount: measurementsInput.storyCount,
      planFacts: measurementsInput.planFacts,
      projectComplexity: measurementsInput.projectComplexity,
      plumbingComplexityFactors: measurementsInput.plumbingComplexityFactors,
      planImportMode: measurementsInput.planImportMode,
      planImportTradeKey: measurementsInput.planImportTradeKey,
      planImportFingerprint: measurementsInput.planImportFingerprint,
      quickMeasurementSources: measurementsInput.quickMeasurementSources,
      quickMeasurementUserOverrides:
        measurementsInput.quickMeasurementUserOverrides,
    },
    result
  ) as ScopeItemSuggestedPricing;
  if (
    shouldSuppressSuggestedPricingAfterApply(
      itemId,
      measurementsInput.itemQuantities || {},
      measurementsInput.pricingAcceptance
    )
  ) {
    return result;
  }
  if (
    !userHasCommittedScopePricing(
      itemId,
      measurementsInput.itemQuantities || {},
      measurementsInput.pricingAcceptance
    )
  ) {
    return result;
  }

  // Exterior paint may show the national comparison only when the primary
  // saved price came from the contractor pricing library. A manually entered
  // or saved-template price is not a library sample and must not create the
  // "National planning rate" comparison card.
  if (
    itemId === 'exterior_paint' &&
    resolveTemplateRateForItem(
      itemId,
      resolved.unit,
      pricingContext,
      resolved.quantity
    )?.origin !== 'pricing_library'
  ) {
    const nationalFill =
      result.fill &&
      !result.fill.isComparison &&
      (result.fill.materialSource === 'national_average' ||
        result.fill.laborSource === 'national_average' ||
        /national\s*average|national\s*planning\s*rate/i.test(
          String(result.fill.rateSourceLabel || '')
        ));
    return {
      fill: nationalFill ? null : result.fill,
      comparison: null,
    };
  }

  // Manual/user pricing is already active — never leave national average as an
  // applyable fill (that drives the footer "N prices ready" count).
  if (
    !options?.bypassAppliedSuppress &&
    result.fill &&
    !result.fill.isComparison
  ) {
    return {
      fill: null,
      comparison:
        result.comparison ||
        asNationalAverageComparisonOnly({ fill: result.fill, comparison: null })
          ?.comparison ||
        null,
    };
  }

  const needsFallback =
    (!result.fill && !result.comparison) ||
    isPerUnitRateMistakenForTotal(result.fill, itemId, rule, pricingContext);
  if (!needsFallback) return result;

  const physical = resolveNationalAveragePhysicalCountForBenchmark(
    itemId,
    rule,
    measurementsInput,
    resolved
  );
  if (!physical) {
    if (
      rule.defaultUnit === 'allowance' ||
      rule.defaultUnit === 'lump_sum' ||
      rule.splitTotalOnly
    ) {
      const flat = asNationalAverageComparisonOnly(
        buildSplitTotalOnlySuggestedFill(itemId, pricingContext)
      );
      if (flat?.comparison) return flat;
    }
    return result;
  }

  const benchmark = asNationalAverageComparisonOnly(
    buildNationalAverageRateFill(
      itemId,
      physical.count,
      physical.unit,
      pricingContext
    )
  );
  return benchmark?.comparison ? benchmark : result;
}

/** National benchmark row for user-entered pricing — never treat dollar totals as qty multipliers. */
function buildNationalBenchmarkForUserEnteredPricing(
  itemId: string,
  rule: ScopeItemQuantityRule,
  measurementsInput: ScopeMeasurementsInputExtended,
  resolved: SuggestedPricingResolvedQty,
  templateKey: string | null | undefined,
  pricingContext?: ScopePricingContext | null,
  safeAllowanceCount?: number | null
): ScopeItemSuggestedPricing | null {
  void templateKey;
  if (rule.splitTotalOnly) {
    return asNationalAverageComparisonOnly(
      buildSplitTotalOnlySuggestedFill(itemId, pricingContext)
    );
  }

  const physical = resolveNationalAveragePhysicalCountForBenchmark(
    itemId,
    rule,
    measurementsInput,
    resolved,
    safeAllowanceCount
  );
  if (!physical) {
    if (rule.defaultUnit === 'allowance' || rule.defaultUnit === 'lump_sum') {
      return asNationalAverageComparisonOnly(
        buildSplitTotalOnlySuggestedFill(itemId, pricingContext)
      );
    }
    return null;
  }

  return asNationalAverageComparisonOnly(
    buildNationalAverageRateFill(
      itemId,
      physical.count,
      physical.unit,
      pricingContext
    )
  );
}

function buildSplitTotalOnlySuggestedFill(
  itemId: string,
  pricingContext?: ScopePricingContext | null
): ScopeItemSuggestedPricing | null {
  const national = getNationalAverageBudgetSplit(itemId, 'allowance');
  if (!national) return null;
  const { average, regional } = regionalAdjustedNationalAverage(
    itemId,
    'allowance',
    pricingContext
  );
  const material = round2(average?.material ?? national.material ?? 0);
  const labor = round2(average?.labor ?? national.labor ?? 0);
  const total = round2(material + labor);
  if (!(total > 0)) return null;
  return {
    fill: {
      material,
      labor,
      total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: national.sourceLabel,
      helper:
        'National average install/hookup — edit material and labor below.',
      mode: 'suggested_price',
      lumpSumOnly: false,
      splitSource: material > 0 && labor > 0 ? 'estimated' : 'none',
      splitConfidence: material > 0 && labor > 0 ? 'medium' : 'none',
      basis: null,
      regionalMultiplier: regional.multiplier,
      costBuckets: buildSuggestedPricingCostBuckets({
        itemId,
        average: average ?? national,
        material,
        labor,
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
      pricingRecordId: `bps_national:${itemId}:allowance`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: itemId,
      benchmarkAction: 'price_ready',
    },
    comparison: null,
  };
}

function buildGroundUpBarometerLumpPricing(
  itemId: string,
  lump: {
    material: number;
    labor: number;
    total: number;
    rateSourceLabel: string;
    helper: string;
    comparisonRange: { low: number; high: number };
    projectId: SouthernUtahProjectId | null;
    pricingDetail?: string | null;
  },
  opts?: {
    basis?: { quantity: number; unit: string } | null;
    allowanceLabel?: string;
    livingSf?: number | null;
  }
): ScopeItemSuggestedPricing {
  const hasSplit = lump.material > 0 && lump.labor > 0;
  const livingSfRef = installedBudgetLivingSfReference({
    total: lump.total,
    livingSf: opts?.livingSf,
    barometerLabel: barometerLabelForProjectId(lump.projectId),
  });
  return {
    fill: {
      material: lump.material,
      labor: lump.labor,
      total: lump.total,
      materialSource: hasSplit ? 'national_average' : 'local_benchmark',
      laborSource: hasSplit ? 'national_average' : 'local_benchmark',
      rateSourceLabel: lump.rateSourceLabel,
      helper: lump.helper,
      mode: 'suggested_price',
      lumpSumOnly: !hasSplit,
      installedBudgetBenchmark: true,
      splitSource: hasSplit ? 'estimated' : 'none',
      splitConfidence: hasSplit ? 'medium' : 'none',
      comparisonRange: lump.comparisonRange,
      basis: opts?.basis ?? null,
      pricingDetail: lump.pricingDetail ?? null,
      impliedUnitRateLabel: livingSfRef?.impliedUnitRateLabel ?? null,
      benchmarkLivingSf: livingSfRef?.benchmarkLivingSf ?? null,
      costBuckets: hasSplit
        ? [
            {
              key: 'material',
              label: 'Material',
              amount: lump.material,
              rate: null,
              source: 'national_average',
            },
            {
              key: 'labor',
              label: 'Labor',
              amount: lump.labor,
              rate: null,
              source: 'national_average',
            },
          ]
        : [
            {
              key: 'allowance',
              label: opts?.allowanceLabel || 'Installed planning budget',
              amount: lump.total,
              rate: null,
              source: 'local_benchmark',
            },
          ],
      pricingRecordId: `su_${itemId}:${lump.projectId || 'median'}:${hasSplit ? 'split' : 'installed'}`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: itemId,
      benchmarkAction: 'price_ready',
      storedTotalExact: lump.total,
    },
    comparison: null,
  };
}

/**
 * Canonical pricing resolver for the Confirm Scope UI. Resolves material and
 * labor independently with the priority notes -> template/bid -> national
 * average, and works for any trade/material/labor combination.
 */
function insulationAssemblyRateAdjustments(
  measurements: ScopeMeasurementsInputExtended
): {
  materialMultiplier: number;
  laborMultiplier: number;
  label: string;
} {
  return insulationAssemblyRateAdjustmentsForValues(
    measurements.insulationMaterialType,
    measurements.insulationRValue
  );
}

function insulationAssemblyRateAdjustmentsForValues(
  materialType: unknown,
  rValueInput: unknown,
  battFacing?: InsulationBattFacing | null
): {
  materialMultiplier: number;
  materialAddPerSqft: number;
  laborMultiplier: number;
  label: string;
} {
  const type = String(materialType || '')
    .trim()
    .toLowerCase();
  const typeRates: Record<string, [number, number]> = {
    batt: [1, 1],
    'blown-in': [0.9, 1.1],
    'spray foam': [2.5, 1.35],
    'rigid foam board': [2, 1.25],
    cellulose: [0.9, 1],
    'mineral wool': [1.35, 1.15],
  };
  const typeKey = Object.keys(typeRates).find(key => type.includes(key));
  const [typeMaterial, typeLabor] = typeKey ? typeRates[typeKey] : [1, 1];
  const rValue = Number(String(rValueInput || '').match(/\d{2,3}/)?.[0] || '');
  const rMaterial =
    {
      13: 0.85,
      15: 0.9,
      19: 0.95,
      21: 1,
      30: 1.1875,
      38: 1.3,
      49: 1.5,
      60: 1.7,
    }[rValue] ??
    (rValue > 0 ? Math.max(0.85, Math.min(1.7, 0.65 + rValue / 60)) : 1);
  const materialAddPerSqft =
    typeKey === 'batt' ? insulationBattFacingMaterialAddPerSqft(battFacing) : 0;
  return {
    materialMultiplier: typeMaterial * rMaterial,
    materialAddPerSqft,
    laborMultiplier: typeLabor,
    label: [
      typeKey ? typeKey : null,
      typeKey === 'batt' ? insulationBattFacingLabel(battFacing) : null,
      rValue > 0 ? `R-${rValue}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

function resolvedInsulationAssemblies(
  measurements: ScopeMeasurementsInputExtended
): Array<{
  materialType: string;
  rValue: string;
  sqft: number;
  location: string | null;
  battFacing: InsulationBattFacing | null;
}> {
  if (!Array.isArray(measurements.insulationAssemblies)) return [];
  return measurements.insulationAssemblies
    .map(row => ({
      materialType: String(row.materialType || '').trim(),
      rValue: String(row.rValue || '').trim(),
      sqft: parseScopeMeasurementInput(String(row.sqft ?? '')),
      location: String(row.location || '').trim() || null,
      battFacing: row.battFacing ?? null,
      source: row.source,
      confirmed: row.confirmed,
    }))
    .filter(
      row =>
        row.sqft != null &&
        row.sqft > 0 &&
        Boolean(row.materialType) &&
        Boolean(row.rValue) &&
        row.confirmed !== false &&
        row.source !== 'calculated_from_plan'
    ) as Array<{
    materialType: string;
    rValue: string;
    sqft: number;
    location: string | null;
    battFacing: InsulationBattFacing | null;
  }>;
}

function insulationRateAdjustmentsForMeasurements(
  measurements: ScopeMeasurementsInputExtended
): {
  materialMultiplier: number;
  materialAddPerSqft: number;
  laborMultiplier: number;
  label: string;
} {
  const rows = resolvedInsulationAssemblies(measurements);
  if (!rows.length) return insulationAssemblyRateAdjustments(measurements);
  const totalSqft = rows.reduce((sum, row) => sum + row.sqft, 0);
  const materialMultiplier =
    rows.reduce(
      (sum, row) =>
        sum +
        row.sqft *
          insulationAssemblyRateAdjustmentsForValues(
            row.materialType,
            row.rValue,
            row.battFacing
          ).materialMultiplier,
      0
    ) / totalSqft;
  const materialAddPerSqft =
    rows.reduce(
      (sum, row) =>
        sum +
        row.sqft *
          insulationAssemblyRateAdjustmentsForValues(
            row.materialType,
            row.rValue,
            row.battFacing
          ).materialAddPerSqft,
      0
    ) / totalSqft;
  const laborMultiplier =
    rows.reduce(
      (sum, row) =>
        sum +
        row.sqft *
          insulationAssemblyRateAdjustmentsForValues(
            row.materialType,
            row.rValue,
            row.battFacing
          ).laborMultiplier,
      0
    ) / totalSqft;
  return {
    materialMultiplier,
    materialAddPerSqft,
    laborMultiplier,
    label: rows
      .map(
        row =>
          insulationAssemblyRateAdjustmentsForValues(
            row.materialType,
            row.rValue,
            row.battFacing
          ).label
      )
      .join(' + '),
  };
}

const INSULATION_COMPONENT_RATES: Record<
  | 'insulatedRoofDeckSqft'
  | 'floorInsulationSqft'
  | 'garageSeparationInsulationSqft'
  | 'insulatedGarageWallSqft'
  | 'insulatedGarageCeilingSqft',
  { material: number; labor: number; label: string }
> = {
  insulatedRoofDeckSqft: {
    material: 2.5,
    labor: 3.5,
    label: 'insulated roof deck',
  },
  floorInsulationSqft: {
    material: 1.15,
    labor: 1.6,
    label: 'floor insulation',
  },
  garageSeparationInsulationSqft: {
    material: 1.5,
    labor: 2.25,
    label: 'garage separation',
  },
  insulatedGarageWallSqft: {
    material: 1.5,
    labor: 2.25,
    label: 'insulated garage walls',
  },
  insulatedGarageCeilingSqft: {
    material: 1.5,
    labor: 2.25,
    label: 'insulated garage ceiling',
  },
};

type InsulationEnvelopePricing = {
  material: number;
  labor: number;
  total: number;
  detail: string | null;
};

function insulationAssemblyLocationRate(location: string | null) {
  switch (location) {
    case 'roof_deck':
      return INSULATION_COMPONENT_RATES.insulatedRoofDeckSqft;
    case 'floor':
      return INSULATION_COMPONENT_RATES.floorInsulationSqft;
    case 'garage_separation':
      return INSULATION_COMPONENT_RATES.garageSeparationInsulationSqft;
    default:
      return null;
  }
}

function isInsulationGroundUpPlanningTemplate(
  templateKey?: string | null
): boolean {
  const key = String(templateKey || '').toLowerCase();
  return key === 'ground_up' || key === 'insulation';
}

export function resolveInsulationAssemblyPlanningRateTier(
  templateKey?: string | null,
  livingSf?: number | null
): InsulationAssemblyPlanningRateTier {
  if (!isInsulationGroundUpPlanningTemplate(templateKey)) return 'national';
  if (matchSouthernUtahProjectByLivingSf(livingSf)) return 'production';
  return 'calibrated';
}

export function resolveInsulationAssemblyPlanningRateLabel(
  tier: InsulationAssemblyPlanningRateTier
): string {
  switch (tier) {
    case 'production':
      return INSULATION_PRODUCTION_RATE_CARD_LABEL;
    case 'calibrated':
      return INSULATION_CALIBRATED_RATE_CARD_LABEL;
    default:
      return INSULATION_ASSEMBLY_RATE_CARD_LABEL;
  }
}

type InsulationAssemblyPlanningRates = {
  material: number;
  labor: number;
  tier: InsulationAssemblyPlanningRateTier;
  label: string;
  materialSource: PricingLegSource;
};

/** Assembly row mat/lab — production, barometer-calibrated, or national ceiling. */
function resolveInsulationAssemblyPlanningRates(
  pricingContext?: ScopePricingContext | null,
  options?: {
    templateKey?: string | null;
    livingSf?: number | null;
    tier?: InsulationAssemblyPlanningRateTier;
  }
): InsulationAssemblyPlanningRates {
  const tier =
    options?.tier ??
    resolveInsulationAssemblyPlanningRateTier(
      options?.templateKey,
      options?.livingSf
    );
  const regional = regionalPricingFromContext(pricingContext);

  if (tier === 'production') {
    const base = { ...INSULATION_PRODUCTION_BATT_BASELINE };
    const adjusted =
      regional.multiplier === 1
        ? base
        : (applyRegionalMultiplierToBudgetSplit(base, regional) ?? base);
    return {
      material: adjusted?.material ?? base.material,
      labor: adjusted?.labor ?? base.labor,
      tier,
      label: INSULATION_PRODUCTION_RATE_CARD_LABEL,
      materialSource: 'local_benchmark',
    };
  }

  if (tier === 'national') {
    const national = getNationalAverageBudgetSplit('insulation', 'sqft');
    const base = {
      material: national?.material ?? 1.25,
      labor: national?.labor ?? 1.75,
    };
    const adjusted =
      regional.multiplier === 1
        ? base
        : (applyRegionalMultiplierToBudgetSplit(base, regional) ?? base);
    return {
      material: adjusted?.material ?? base.material,
      labor: adjusted?.labor ?? base.labor,
      tier,
      label: INSULATION_ASSEMBLY_RATE_CARD_LABEL,
      materialSource: 'national_average',
    };
  }

  const { average } = regionalAdjustedNationalAverage(
    'insulation',
    'sqft',
    pricingContext
  );
  const base = {
    material: average?.material ?? 1.25,
    labor: average?.labor ?? 1.75,
  };
  return {
    material: base.material,
    labor: base.labor,
    tier,
    label: INSULATION_CALIBRATED_RATE_CARD_LABEL,
    materialSource: 'national_average',
  };
}

function insulationAssemblyLocationLabel(location: string | null): string {
  return (
    {
      exterior_wall: 'exterior wall',
      attic_ceiling: 'attic / ceiling',
      roof_deck: 'roof deck',
      garage_separation: 'garage separation',
      floor: 'floor',
    }[location || ''] || 'whole-house'
  );
}

function priceInsulationEnvelopeComponents(params: {
  lump: { material: number; labor: number; total: number };
  envelope: {
    totalInsulationEnvelopeSqft: number;
    components: Array<{
      key: string;
      quantity: number;
      included: boolean;
    }>;
  } | null;
  assembly: {
    materialMultiplier: number;
    materialAddPerSqft?: number;
    laborMultiplier: number;
  };
  assemblies?: Array<{
    materialType: string;
    rValue: string;
    sqft: number;
    location: string | null;
    battFacing?: InsulationBattFacing | null;
  }>;
  pricingContext?: ScopePricingContext | null;
  templateKey?: string | null;
  livingSf?: number | null;
  rateTier?: InsulationAssemblyPlanningRateTier;
}): InsulationEnvelopePricing {
  const assemblies = params.assemblies || [];
  if (!params.envelope && !assemblies.length) {
    return {
      material: params.lump.material,
      labor: params.lump.labor,
      total: params.lump.total,
      detail: null,
    };
  }

  const baseKeys = new Set([
    'exteriorWallInsulationSqft',
    'atticInsulationSqft',
    'insulatedRoofDeckSqft',
  ]);
  const baseComponents = (params.envelope?.components || []).filter(
    component => component.included && baseKeys.has(component.key)
  );
  const baseQuantity =
    assemblies.length > 0
      ? assemblies.reduce((sum, row) => sum + Math.max(0, row.sqft), 0)
      : baseComponents.reduce(
          (sum, component) => sum + Math.max(0, component.quantity),
          0
        );
  if (!(baseQuantity > 0)) {
    return {
      material: params.lump.material,
      labor: params.lump.labor,
      total: params.lump.total,
      detail: null,
    };
  }

  const baseMaterialRate = params.lump.material / baseQuantity;
  const baseLaborRate = params.lump.labor / baseQuantity;
  const assemblyPlanningRates = resolveInsulationAssemblyPlanningRates(
    params.pricingContext,
    {
      templateKey: params.templateKey,
      livingSf: params.livingSf,
      tier: params.rateTier,
    }
  );
  const standardMaterialRate = assemblies.length
    ? assemblyPlanningRates.material
    : baseMaterialRate;
  const standardLaborRate = assemblies.length
    ? assemblyPlanningRates.labor
    : baseLaborRate;
  let material = params.lump.material;
  let labor = params.lump.labor;
  const detail: string[] = [];
  if (assemblies.length) {
    material = 0;
    labor = 0;
    for (const row of assemblies) {
      const rowAssembly = insulationAssemblyRateAdjustmentsForValues(
        row.materialType,
        row.rValue,
        row.battFacing
      );
      const locationRate = insulationAssemblyLocationRate(row.location);
      const rowMaterialRate = locationRate
        ? locationRate.material * rowAssembly.materialMultiplier +
          rowAssembly.materialAddPerSqft
        : standardMaterialRate * rowAssembly.materialMultiplier +
          rowAssembly.materialAddPerSqft;
      const rowLaborRate = locationRate
        ? locationRate.labor * rowAssembly.laborMultiplier
        : standardLaborRate * rowAssembly.laborMultiplier;
      material += round2(row.sqft * rowMaterialRate);
      labor += round2(row.sqft * rowLaborRate);
      const facingLabel = insulationBattFacingLabel(row.battFacing);
      detail.push(
        `${Math.round(row.sqft).toLocaleString()} SF ${row.materialType}${
          facingLabel ? ` ${facingLabel.toLowerCase()}` : ''
        } ${row.rValue} ${insulationAssemblyLocationLabel(row.location)} @ $${round2(
          rowMaterialRate + rowLaborRate
        ).toFixed(2)}/SF`
      );
    }
  } else {
    detail.push(
      `${Math.round(baseQuantity).toLocaleString()} SF standard envelope @ $${round2(
        params.lump.total / baseQuantity
      ).toFixed(2)}/SF`
    );
  }

  const roofDeck = params.envelope?.components.find(
    component => component.key === 'insulatedRoofDeckSqft' && component.included
  );
  if (!assemblies.length && roofDeck && roofDeck.quantity > 0) {
    const rate = INSULATION_COMPONENT_RATES.insulatedRoofDeckSqft;
    material -= round2(roofDeck.quantity * baseMaterialRate);
    labor -= round2(roofDeck.quantity * baseLaborRate);
    material += round2(
      roofDeck.quantity * rate.material * params.assembly.materialMultiplier
    );
    labor += round2(
      roofDeck.quantity * rate.labor * params.assembly.laborMultiplier
    );
    if (!assemblies.length) {
      detail[0] = `${Math.round(baseQuantity).toLocaleString()} SF standard envelope @ $${round2(
        params.lump.total / baseQuantity
      ).toFixed(2)}/SF`;
    }
    detail.push(
      `${Math.round(roofDeck.quantity).toLocaleString()} SF ${rate.label} @ $${round2(
        rate.material * params.assembly.materialMultiplier +
          rate.labor * params.assembly.laborMultiplier
      ).toFixed(2)}/SF`
    );
  }

  for (const component of params.envelope?.components || []) {
    if (!component.included || baseKeys.has(component.key)) continue;
    const rate =
      INSULATION_COMPONENT_RATES[
        component.key as keyof typeof INSULATION_COMPONENT_RATES
      ];
    if (!rate || !(component.quantity > 0)) continue;
    const materialRate = rate.material * params.assembly.materialMultiplier;
    const laborRate = rate.labor * params.assembly.laborMultiplier;
    material += round2(component.quantity * materialRate);
    labor += round2(component.quantity * laborRate);
    detail.push(
      `${Math.round(component.quantity).toLocaleString()} SF ${rate.label} @ $${round2(
        materialRate + laborRate
      ).toFixed(2)}/SF`
    );
  }

  return {
    material: round2(material),
    labor: round2(labor),
    total: round2(material + labor),
    detail: detail.join(' · '),
  };
}

export type InsulationAssemblyRowPricing = {
  sqft: number;
  materialRate: number;
  laborRate: number;
  installedRate: number;
  material: number;
  labor: number;
  total: number;
  detail: string;
};

export function resolveInsulationAssemblyRowPricingMap(
  rows: Array<{
    id: string;
    materialType: string;
    rValue: string;
    sqft: number | string | null | undefined;
    location?: string | null;
    battFacing?: InsulationBattFacing | null;
    confirmed?: boolean;
    source?: string | null;
  }>,
  options?: {
    livingSf?: number | null;
    pricingContext?: ScopePricingContext | null;
    templateKey?: string | null;
    rateTier?: InsulationAssemblyPlanningRateTier;
  }
): Map<string, InsulationAssemblyRowPricing> {
  const pricedRows = rows
    .map(row => ({
      ...row,
      sqft: parseScopeMeasurementInput(String(row.sqft ?? '')),
    }))
    .filter(
      row =>
        row.sqft > 0 &&
        Boolean(String(row.materialType || '').trim()) &&
        Boolean(String(row.rValue || '').trim()) &&
        row.confirmed !== false &&
        row.source !== 'calculated_from_plan'
    );
  const map = new Map<string, InsulationAssemblyRowPricing>();
  const totalSqft = pricedRows.reduce((sum, row) => sum + row.sqft, 0);
  if (!(totalSqft > 0)) return map;

  const { material: standardMaterialRate, labor: standardLaborRate } =
    resolveInsulationAssemblyPlanningRates(options?.pricingContext, {
      templateKey: options?.templateKey,
      livingSf: options?.livingSf,
      tier: options?.rateTier,
    });

  for (const row of pricedRows) {
    const assembly = insulationAssemblyRateAdjustmentsForValues(
      row.materialType,
      row.rValue,
      row.battFacing
    );
    const locationRate = insulationAssemblyLocationRate(row.location ?? null);
    const materialRate = locationRate
      ? locationRate.material * assembly.materialMultiplier +
        assembly.materialAddPerSqft
      : standardMaterialRate * assembly.materialMultiplier +
        assembly.materialAddPerSqft;
    const laborRate = locationRate
      ? locationRate.labor * assembly.laborMultiplier
      : standardLaborRate * assembly.laborMultiplier;
    const material = round2(row.sqft * materialRate);
    const labor = round2(row.sqft * laborRate);
    const installedRate = round2(materialRate + laborRate);
    const facingLabel = insulationBattFacingLabel(row.battFacing);
    map.set(row.id, {
      sqft: row.sqft,
      materialRate: round2(materialRate),
      laborRate: round2(laborRate),
      installedRate,
      material,
      labor,
      total: round2(material + labor),
      detail: `${Math.round(row.sqft).toLocaleString()} SF ${row.materialType}${
        facingLabel ? ` ${facingLabel.toLowerCase()}` : ''
      } ${row.rValue} ${insulationAssemblyLocationLabel(row.location ?? null)} @ $${installedRate.toFixed(2)}/SF`,
    });
  }
  return map;
}

export function resolveInsulationAssemblyRowPricing(
  row: {
    materialType: string;
    rValue: string;
    sqft: number | string | null | undefined;
    location?: string | null;
    battFacing?: InsulationBattFacing | null;
  },
  pricingContext?: ScopePricingContext | null,
  options?: { livingSf?: number | null }
): InsulationAssemblyRowPricing | null {
  const pricing = resolveInsulationAssemblyRowPricingMap(
    [{ id: 'row', ...row }],
    { livingSf: options?.livingSf, pricingContext }
  );
  return pricing.get('row') ?? null;
}

export function resolveInsulationAssemblyLumpBenchmarkComparison(
  measurementsInput: ScopeMeasurementsInputExtended,
  pricingContext?: ScopePricingContext | null
): SuggestedPricingBlock | null {
  const livingSf = parseScopeMeasurementInput(
    String(measurementsInput.floorAreaSqft ?? '')
  );
  if (!(livingSf > 0)) return null;

  const lump = resolveInsulationLumpSuggestedFill({
    livingSf,
    state: pricingContext?.state,
  });
  const livingSfLabel = Math.round(livingSf).toLocaleString();

  return {
    material: lump.material,
    labor: lump.labor,
    total: lump.total,
    materialSource: 'local_benchmark',
    laborSource: 'local_benchmark',
    rateSourceLabel: 'Reference only · whole-house insulation lump benchmark',
    helper: `Planning benchmark scaled to ${livingSfLabel} living SF — not assembly rate-card pricing. Assembly rows above are the bid total.`,
    mode: 'suggested_price',
    installedBudgetBenchmark: true,
    isComparison: true,
    lumpSumOnly: false,
    comparisonRange: lump.comparisonRange,
    benchmarkLivingSf: livingSf,
    basis: { quantity: livingSf, unit: 'living_sqft' },
    benchmarkAction: 'comparison_only',
    productionStatus: 'review_required',
    benchmarkLevel: 'component',
    benchmarkScopeKey: 'insulation',
  };
}

export function resolveInsulationAssemblyScopeSuggestedPricing(
  measurementsInput: ScopeMeasurementsInputExtended,
  pricingContext?: ScopePricingContext | null,
  templateKey?: string | null,
  rateTier?: InsulationAssemblyPlanningRateTier
): SuggestedPricingBlock | null {
  const rows = Array.isArray(measurementsInput.insulationAssemblies)
    ? measurementsInput.insulationAssemblies
    : [];
  if (!rows.length) return null;

  const livingSf = parseScopeMeasurementInput(
    String(measurementsInput.floorAreaSqft ?? '')
  );
  const resolvedTier =
    rateTier ??
    resolveInsulationAssemblyPlanningRateTier(templateKey, livingSf);
  const planningRates = resolveInsulationAssemblyPlanningRates(pricingContext, {
    templateKey,
    livingSf,
    tier: resolvedTier,
  });

  const pricingMap = resolveInsulationAssemblyRowPricingMap(
    rows.map((row, index) => ({
      id: String(row.id || `insulation-assembly-${index + 1}`),
      materialType: row.materialType,
      rValue: row.rValue,
      sqft: row.sqft,
      location: row.location,
      battFacing: row.battFacing,
      confirmed: row.confirmed,
      source: row.source,
    })),
    {
      livingSf,
      pricingContext,
      templateKey,
      rateTier: resolvedTier,
    }
  );
  if (!pricingMap.size) return null;

  let material = 0;
  let labor = 0;
  let total = 0;
  let sqft = 0;
  const details: string[] = [];
  for (const pricing of pricingMap.values()) {
    material += pricing.material;
    labor += pricing.labor;
    total += pricing.total;
    sqft += pricing.sqft;
    details.push(pricing.detail);
  }

  const assemblyCount = pricingMap.size;
  const codeWarnings = insulationAssemblyCodeWarnings(
    rows,
    pricingContext?.state
  );
  const ceilingRoofConflict = insulationAssemblyCeilingRoofDeckConflict(rows);
  const reviewNotes = [ceilingRoofConflict.message, ...codeWarnings].filter(
    Boolean
  );
  const project = matchSouthernUtahProjectByLivingSf(livingSf);
  const productionHelper =
    resolvedTier === 'production' && project
      ? `Aligned with ${project.label} detached insulation bids on the same thermal-envelope SF.`
      : null;
  return {
    material: round2(material),
    labor: round2(labor),
    total: round2(total),
    materialSource: planningRates.materialSource,
    laborSource: planningRates.materialSource,
    rateSourceLabel: `${planningRates.label} · insulation assemblies`,
    helper: [
      ...reviewNotes,
      productionHelper,
      `${assemblyCount} priced ${
        assemblyCount === 1 ? 'assembly' : 'assemblies'
      } · ${Math.round(sqft).toLocaleString()} sqft thermal envelope`,
    ]
      .filter(Boolean)
      .join(' · '),
    mode: 'suggested_price',
    lumpSumOnly: false,
    basis: { quantity: round2(sqft), unit: 'sqft' },
    pricingDetail: details.join(' · '),
    benchmarkAction: 'price_ready',
    productionStatus: 'review_required',
  };
}

/** National rate-card assembly total for the same rows — comparison only. */
export function resolveInsulationAssemblyNationalRateCardComparison(
  measurementsInput: ScopeMeasurementsInputExtended,
  pricingContext?: ScopePricingContext | null,
  templateKey?: string | null
): SuggestedPricingBlock | null {
  const livingSf = parseScopeMeasurementInput(
    String(measurementsInput.floorAreaSqft ?? '')
  );
  const primaryTier = resolveInsulationAssemblyPlanningRateTier(
    templateKey,
    livingSf
  );
  if (primaryTier === 'national') return null;

  const nationalPricing = resolveInsulationAssemblyScopeSuggestedPricing(
    measurementsInput,
    pricingContext,
    templateKey,
    'national'
  );
  if (!nationalPricing) return null;

  return {
    ...nationalPricing,
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel:
      'Reference only · national rate-card insulation assemblies',
    helper:
      'National planning ceiling for the same assemblies. The production or calibrated assembly total above is the suggested bid price.',
    isComparison: true,
    benchmarkAction: 'comparison_only',
    productionStatus: 'review_required',
    benchmarkLevel: 'component',
    benchmarkScopeKey: 'insulation',
  };
}

export function resolveScopeItemSuggestedPricing(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  templateKey: string | null | undefined,
  resolved: Pick<
    ResolvedItemQuantity,
    | 'quantity'
    | 'unit'
    | 'quantitySource'
    | 'dualCount'
    | 'dualMaterial'
    | 'dualLabor'
    | 'dualAllowance'
  >,
  pricingContext?: ScopePricingContext | null,
  choiceId?: string | null,
  originalNotes?: string | null,
  options?: ScopeItemSuggestedPricingResolveOptions
): ScopeItemSuggestedPricing {
  const empty: ScopeItemSuggestedPricing = { fill: null, comparison: null };
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule) return empty;
  if (
    isHvacComponentScopeItemId(itemId) &&
    hvacUsesInstalledPackagePricing(
      measurementsInput as Record<string, unknown>,
      pricingContext
    )
  ) {
    return empty;
  }
  if (itemId === 'hvac') {
    const packagePricing = buildHvacInstalledPackageSuggestedPricing(
      measurementsInput as Record<string, unknown>,
      pricingContext
    );
    if (packagePricing) return packagePricing;
  }
  const isDrywallAddon =
    itemId === 'hang' || itemId === 'finish_tape' || itemId === 'texture';
  const completeDrywallPackage = isDrywallCompletePackageScope({
    templateKey,
    planImportMode: measurementsInput.planImportMode,
    planImportTradeKey: measurementsInput.planImportTradeKey,
  });
  if (isDrywallAddon && !drywallAddonHasExplicitPricing(resolved)) {
    if (
      completeDrywallPackage &&
      drywallScopeRowIncluded(pricingContext, 'drywall')
    ) {
      // Complete package already prices board, hang, tape, finish, and texture.
      return empty;
    }
    if (
      !completeDrywallPackage &&
      itemId === 'texture' &&
      drywallScopeRowIncluded(pricingContext, 'finish_tape')
    ) {
      // Remodel finish card includes orange-peel base; texture choice adjusts labor.
      return empty;
    }
  }
  const hasConfirmedInsulationBoundary =
    itemId === 'insulation' &&
    (Array.isArray(measurementsInput.insulationAssemblies)
      ? resolvedInsulationAssemblies(measurementsInput).some(row =>
          ['attic_ceiling', 'roof_deck'].includes(String(row.location || ''))
        )
      : (Number(measurementsInput.atticInsulationSqft) > 0 &&
          ![
            'calculated_from_components',
            'estimated_from_formula',
            'needs_confirmation',
          ].includes(
            String(
              measurementsInput.quickMeasurementSources?.atticInsulationSqft
            )
          )) ||
        Number(measurementsInput.insulatedRoofDeckSqft) > 0);
  if (
    itemId === 'insulation' &&
    !(
      hasConfirmedInsulationBoundary ||
      (['user_entered', 'manual_override'].includes(
        String(resolved.quantitySource)
      ) &&
        Number(resolved.quantity) > 0)
    )
  ) {
    return empty;
  }
  if (
    String(templateKey || '').toLowerCase() === 'framing' &&
    itemId === 'shear_sheathing' &&
    shellPackageIncludesSheathing(measurementsInput as Record<string, unknown>)
  ) {
    return empty;
  }
  if (
    String(templateKey || '').toLowerCase() === 'framing' &&
    (itemId === 'wall_framing' || itemId === 'openings') &&
    isShellFramingPackageBid(measurementsInput as Record<string, unknown>)
  ) {
    const measurementKey =
      itemId === 'wall_framing' ? 'wallFramingLf' : 'framingOpeningCount';
    const input = measurementsInput as Record<string, unknown>;
    const sources = input.quickMeasurementSources as
      | Record<string, string>
      | undefined;
    const overrides = input.quickMeasurementUserOverrides as
      | Record<string, boolean>
      | undefined;
    const source = sources?.[measurementKey];
    const userEntered =
      source === 'user_entered' ||
      source === 'manual_override' ||
      overrides?.[measurementKey];
    if (!userEntered) {
      return empty;
    }
  }
  const plumbingMeasurementKey = plumbingMeasurementKeyForItemId(itemId);
  if (
    plumbingMeasurementKey &&
    (
      measurementsInput.quickMeasurementSources as
        | Record<string, string>
        | undefined
    )?.[plumbingMeasurementKey] === 'needs_confirmation'
  ) {
    return empty;
  }
  const hvacCard = hvacCardForItemId(itemId);
  if (hvacCard) {
    const sources = measurementsInput.quickMeasurementSources as
      | Record<string, string>
      | undefined;
    const provenance = measurementsInput.measurementProvenance as
      | Record<string, unknown>
      | undefined;
    const reviewKeys =
      itemId === 'hvac'
        ? (['hvacSystemCount', 'hvacSystemTons'] as const)
        : ([hvacCard.measurementKey] as const);
    const blocked = reviewKeys.some(key => {
      const value = parseScopeMeasurementInput(
        (measurementsInput as Record<string, unknown>)[key]
      );
      if (!(value != null && value > 0)) return false;
      if (sources?.[key] === 'needs_confirmation') return true;
      const entry = provenance?.[key];
      if (
        entry &&
        typeof entry === 'object' &&
        (entry as { pricingEligible?: boolean }).pricingEligible === false
      ) {
        return true;
      }
      return false;
    });
    if (blocked) return empty;
  }
  if (itemId === 'water_heater') {
    const whPricing = resolvePlumbingWaterHeaterSuggestedPricing({
      quantity: resolved.quantity,
      waterHeaterDetail:
        measurementsInput.plumbingWaterHeaterDetail ??
        (measurementsInput as { waterHeaterDetail?: { type?: string | null } })
          .waterHeaterDetail ??
        null,
    });
    if (!whPricing.fill) return empty;
    return withUserEnteredNationalBenchmarkFallback(
      itemId,
      rule,
      measurementsInput,
      resolved,
      templateKey,
      pricingContext,
      whPricing,
      options
    );
  }
  const electricalTemplate =
    String(templateKey || '').toLowerCase() === 'electrical';
  const applyElectricalComplexity = (
    result: ScopeItemSuggestedPricing
  ): ScopeItemSuggestedPricing =>
    applyProjectComplexityToSuggestedPricing(
      itemId,
      templateKey,
      {
        floorAreaSqft: measurementsInput.floorAreaSqft,
        storyCount: measurementsInput.storyCount,
        planFacts: measurementsInput.planFacts,
        projectComplexity: measurementsInput.projectComplexity,
        plumbingComplexityFactors: measurementsInput.plumbingComplexityFactors,
        planImportMode: measurementsInput.planImportMode,
        planImportTradeKey: measurementsInput.planImportTradeKey,
        planImportFingerprint: measurementsInput.planImportFingerprint,
        quickMeasurementSources: measurementsInput.quickMeasurementSources,
        quickMeasurementUserOverrides:
          measurementsInput.quickMeasurementUserOverrides,
      },
      result
    ) as ScopeItemSuggestedPricing;
  if (isElectricalRoughItemId(itemId) && electricalTemplate) {
    if (
      !shouldAutoPriceElectricalRoughPackage(
        measurementsInput as unknown as Record<string, unknown>,
        templateKey
      )
    ) {
      return empty;
    }
    return applyElectricalComplexity(
      resolveElectricalRoughSuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        unit: resolved.unit,
        quantitySource: resolved.quantitySource,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
        electricalIncludeRough: measurementsInput.electricalIncludeRough,
        electricalScope: measurementsInput.electricalScope,
      })
    );
  }
  if (isElectricalServicePanelItemId(itemId)) {
    return applyElectricalComplexity(
      resolveElectricalServicePanelSuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        quantitySource: resolved.quantitySource,
        serviceAmperage: Number(measurementsInput.serviceAmperage) || null,
        existingServiceAmperage:
          Number(measurementsInput.existingServiceAmperage) || null,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
        electricalPanelLocation: measurementsInput.electricalPanelLocation,
        electricalMeterMainCombo: measurementsInput.electricalMeterMainCombo,
        mainPanelCount: Number(measurementsInput.mainPanelCount) || null,
        panelUpgradeCount: Number(measurementsInput.panelUpgradeCount) || null,
        serviceUpgradeCount:
          Number(measurementsInput.serviceUpgradeCount) || null,
        subpanelCount: Number(measurementsInput.subpanelCount) || null,
        electricalScope: measurementsInput.electricalScope,
      })
    );
  }
  if (isElectricalCircuitItemId(itemId)) {
    return applyElectricalComplexity(
      resolveElectricalCircuitSuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        quantitySource: resolved.quantitySource,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
        rangeHookupCount: Number(measurementsInput.rangeHookupCount) || null,
        dryerHookupCount: Number(measurementsInput.dryerHookupCount) || null,
        waterHeaterHookupCount:
          Number(measurementsInput.waterHeaterHookupCount) || null,
        evChargerHookupCount:
          Number(measurementsInput.evChargerHookupCount) || null,
        dishwasherHookupCount:
          Number(measurementsInput.dishwasherHookupCount) || null,
        disposalHookupCount:
          Number(measurementsInput.disposalHookupCount) || null,
        microwaveHookupCount:
          Number(measurementsInput.microwaveHookupCount) || null,
        refrigeratorHookupCount:
          Number(measurementsInput.refrigeratorHookupCount) || null,
        hvacHookupCount: Number(measurementsInput.hvacHookupCount) || null,
      })
    );
  }
  if (isElectricalReceptacleItemId(itemId)) {
    return applyElectricalComplexity(
      resolveElectricalReceptacleSuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        quantitySource: resolved.quantitySource,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
        rangeHookupCount: Number(measurementsInput.rangeHookupCount) || null,
        dryerHookupCount: Number(measurementsInput.dryerHookupCount) || null,
        waterHeaterHookupCount:
          Number(measurementsInput.waterHeaterHookupCount) || null,
        evChargerHookupCount:
          Number(measurementsInput.evChargerHookupCount) || null,
        dishwasherHookupCount:
          Number(measurementsInput.dishwasherHookupCount) || null,
        disposalHookupCount:
          Number(measurementsInput.disposalHookupCount) || null,
        microwaveHookupCount:
          Number(measurementsInput.microwaveHookupCount) || null,
        refrigeratorHookupCount:
          Number(measurementsInput.refrigeratorHookupCount) || null,
        hvacHookupCount: Number(measurementsInput.hvacHookupCount) || null,
      })
    );
  }
  if (isElectricalSwitchItemId(itemId)) {
    return applyElectricalComplexity(
      resolveElectricalSwitchSuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        quantitySource: resolved.quantitySource,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
      })
    );
  }
  if (isElectricalLightingFanItemId(itemId)) {
    return applyElectricalComplexity(
      resolveElectricalLightingFanSuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        quantitySource: resolved.quantitySource,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
      })
    );
  }
  if (isElectricalHookupItemId(itemId)) {
    return applyElectricalComplexity(
      resolveElectricalHookupSuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        quantitySource: resolved.quantitySource,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
      })
    );
  }
  if (isElectricalSpecialSystemItemId(itemId)) {
    return applyElectricalComplexity(
      resolveElectricalSpecialSystemSuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        quantitySource: resolved.quantitySource,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
      })
    );
  }
  if (isElectricalModificationItemId(itemId)) {
    return applyElectricalComplexity(
      resolveElectricalModificationSuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        quantitySource: resolved.quantitySource,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
      })
    );
  }
  if (isElectricalRacewayItemId(itemId)) {
    return applyElectricalComplexity(
      resolveElectricalRacewaySuggestedPricing({
        itemId,
        quantity: resolved.quantity,
        quantitySource: resolved.quantitySource,
        electricalProjectCondition:
          measurementsInput.electricalProjectCondition,
        electricalTrenchCondition: measurementsInput.electricalTrenchCondition,
        electricalConduitSpecialty:
          measurementsInput.electricalConduitSpecialty,
      })
    );
  }
  if (isElectricalTrimItemId(itemId)) {
    if (
      !shouldAutoPriceElectricalTrimPackage(
        measurementsInput as unknown as Record<string, unknown>,
        templateKey
      )
    ) {
      return empty;
    }
    if (electricalTemplate) {
      return applyElectricalComplexity(
        resolveElectricalTrimSuggestedPricing({
          itemId,
          quantity: resolved.quantity,
          unit: resolved.unit,
          quantitySource: resolved.quantitySource,
          electricalProjectCondition:
            measurementsInput.electricalProjectCondition,
          electricalIncludeTrim: measurementsInput.electricalIncludeTrim,
          electricalScope: measurementsInput.electricalScope,
        })
      );
    }
  }
  if (electricalTemplate && isCanonicalElectricalItemId(itemId)) {
    return empty;
  }
  if (
    itemId === 'electrical_rough' &&
    !shouldAutoPriceElectricalRoughPackage(
      measurementsInput as unknown as Record<string, unknown>,
      templateKey
    )
  ) {
    const countEntry = measurementsInput.itemQuantities?.[itemId];
    const eachQty = parseScopeMeasurementInput(
      String(countEntry?.quantity ?? '')
    );
    const eachUnit = normalizeBasisUnit(countEntry?.unit);
    if (!(eachQty && eachQty > 0 && eachUnit === 'each')) {
      return empty;
    }
  }
  const isRoofingTemplate =
    String(templateKey || '').toLowerCase() === 'roofing';
  if (
    isRoofingTemplate &&
    (itemId === 'underlayment' || itemId === 'ice_water_shield')
  ) {
    const selections = measurementsInput.tradeScopeSelections?.roofing;
    if (!Array.isArray(selections) || !selections.includes(itemId)) {
      return { fill: null, comparison: null };
    }
  }
  const selectedRoofingSystem = pricingContext?.checklistItems?.find(
    row => row.id === 'roofing_system'
  );
  if (
    isRoofingTemplate &&
    itemId === 'roofing_system' &&
    selectedRoofingSystem?.choiceId &&
    !['not_in_scope', 'unsure'].includes(selectedRoofingSystem.choiceId)
  ) {
    const roofingSelections = measurementsInput.tradeScopeSelections?.roofing;
    const hasExplicitRoofingSelectionState =
      measurementsInput.tradeScopeSelections &&
      Object.prototype.hasOwnProperty.call(
        measurementsInput.tradeScopeSelections,
        'roofing'
      );
    const baseSystemSelected =
      Array.isArray(roofingSelections) &&
      roofingSelections.some(
        selection =>
          selection === 'shingles' || selection === 'shingles_roofing'
      );
    if (hasExplicitRoofingSelectionState && !baseSystemSelected) {
      return empty;
    }
    return resolveScopeItemSuggestedPricing(
      'shingles_roofing',
      measurementsInput,
      templateKey,
      resolved,
      pricingContext,
      selectedRoofingSystem.choiceId,
      originalNotes
    );
  }
  const isStuccoTemplate = String(templateKey || '').toLowerCase() === 'stucco';
  const stuccoAssemblyComponents = new Set([
    'stucco_wrb',
    'stucco_lath',
    'stucco_base_coat',
    'stucco_finish_coat',
    'stucco_accessories',
  ]);
  const stuccoSystem = pricingContext?.checklistItems?.find(
    row => row.id === 'stucco'
  );
  const completeStuccoSystemSelected =
    isStuccoTemplate &&
    stuccoSystem?.state === 'included' &&
    ['three_coat', 'one_coat', 'eifs', 'finish_only'].includes(
      String(stuccoSystem.choiceId || '')
    );
  if (completeStuccoSystemSelected && stuccoAssemblyComponents.has(itemId)) {
    // The selected system is an installed assembly. Component cards define
    // inclusions/exclusions but must not stack another full-area charge.
    return empty;
  }
  if (
    isStuccoTemplate &&
    itemId === 'stucco' &&
    choiceId === 'repair_restucco'
  ) {
    // Repairs use affected-area/condition pricing, never the new-system rate.
    return empty;
  }
  if (
    isStuccoTemplate &&
    itemId === 'stucco' &&
    (!choiceId || choiceId === 'unsure')
  ) {
    return empty;
  }
  if (
    String(templateKey || '').toLowerCase() === 'concrete' &&
    ['forms', 'finish_seal', 'cleanup'].includes(itemId)
  ) {
    // Legacy concrete checklist IDs are retained for migration, but their
    // standard work is included in the base flatwork rate.
    return empty;
  }

  if (
    itemId === 'trim_paint' &&
    String(templateKey || '').toLowerCase() === 'painting' &&
    Number(resolved.quantity) > 0
  ) {
    const quantity = Number(resolved.quantity);
    const material = round2(quantity * 2);
    const labor = round2(quantity * 5);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel:
          'Suggested · National Average · painted interior trim LF',
        helper: `${quantity.toLocaleString()} LF`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: 'lf' },
        benchmarkAction: 'price_ready',
        pricingRecordId: 'bps_national:trim_paint:lf',
      },
      comparison: null,
    };
  }

  if (
    itemId === 'prep' &&
    String(templateKey || '').toLowerCase() === 'painting' &&
    Number(resolved.quantity) > 0
  ) {
    const occupancy = measurementsInput.paintOccupancy || 'occupied';
    const application =
      measurementsInput.paintApplicationMethod || 'brush_roll';
    const conditionPrepLaborRate =
      occupancy === 'occupied'
        ? 0.9
        : occupancy === 'new_construction'
          ? 0.72
          : 0.81;
    const prepMethodMultiplier =
      application === 'spray' ? 1.1 : application === 'mixed' ? 1.05 : 1;
    const hasWalls =
      measurementsInput.paintScope?.includes('walls') ||
      Number(measurementsInput.wallPaintSqft) > 0;
    const hasCeilings =
      measurementsInput.paintScope?.includes('ceilings') ||
      Number(measurementsInput.ceilingPaintSqft) > 0;
    const hasCombinedArea =
      measurementsInput.paintPricingMethod === 'combined' &&
      Number(
        measurementsInput.combinedPaintableAreaSqft ||
          measurementsInput.paintAreaSqft
      ) > 0;
    const hasTrim =
      measurementsInput.paintScope?.includes('trim') ||
      Number(measurementsInput.baseboardLf) > 0;
    const hasDoors =
      measurementsInput.paintScope?.includes('doors') ||
      Number(measurementsInput.interiorDoorCount) > 0;
    const scopeMaskingMultiplier =
      hasTrim && hasDoors
        ? 0.9
        : hasCombinedArea || (hasWalls && hasCeilings)
          ? 1
          : hasWalls || hasCeilings
            ? 1.1
            : 1;
    const maskingLevel =
      hasTrim && hasDoors
        ? 'low to medium'
        : hasCombinedArea || (hasWalls && hasCeilings)
          ? 'medium'
          : hasWalls || hasCeilings
            ? 'high'
            : 'standard';
    const quantity = Number(resolved.quantity);
    const material = round2(quantity * 0.2 * scopeMaskingMultiplier);
    const labor = round2(
      quantity *
        conditionPrepLaborRate *
        prepMethodMultiplier *
        scopeMaskingMultiplier
    );
    const total = round2(material + labor);
    return {
      fill: {
        material,
        labor,
        total,
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel:
          'Suggested · National Average · protection, masking, and surface prep',
        helper: `${maskingLevel} masking · ${occupancy.replace('_', ' ')} · ${application.replace('_', '/')} application`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: resolved.unit || 'sqft' },
        benchmarkAction: 'price_ready',
        pricingRecordId: 'bps_national:prep:painting',
      },
      comparison: null,
    };
  }

  if (
    (itemId === 'interior_paint' || itemId === 'ceiling_paint') &&
    String(templateKey || '').toLowerCase() === 'painting' &&
    Number(resolved.quantity) > 0
  ) {
    const occupancy = measurementsInput.paintOccupancy || 'occupied';
    const application =
      measurementsInput.paintApplicationMethod || 'brush_roll';
    const wallRate =
      occupancy === 'occupied' ? 3.35 : occupancy === 'vacant' ? 3.2 : 3.05;
    const paintingMethodMultiplier =
      application === 'spray' ? 0.82 : application === 'mixed' ? 0.95 : 1;
    const ceilingLaborMultiplier = itemId === 'ceiling_paint' ? 1.15 : 1;
    const quantity = Number(resolved.quantity);
    const materialWasteFactor =
      application === 'spray' ? 1.05 : application === 'mixed' ? 1.02 : 1;
    const materialRate = 3.35 * 0.26;
    const laborRate = (wallRate - materialRate) * ceilingLaborMultiplier;
    const material = round2(quantity * materialRate * materialWasteFactor);
    const labor = round2(quantity * laborRate * paintingMethodMultiplier);
    const total = round2(material + labor);
    return {
      fill: {
        material,
        labor,
        total,
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel:
          'Suggested · National Average · interior paint application',
        helper: `${quantity.toLocaleString()} sqft · ${application.replace('_', '/')} application`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: resolved.unit || 'sqft' },
        benchmarkAction: 'price_ready',
        pricingRecordId: `bps_national:${itemId}:painting`,
      },
      comparison: null,
    };
  }

  if (
    (itemId === 'exterior_prep' || itemId === 'exterior_paint') &&
    String(templateKey || '').toLowerCase() === 'painting' &&
    Number(resolved.quantity) > 0
  ) {
    const itemQuantities = measurementsInput.itemQuantities || {};
    if (
      !options?.bypassAppliedSuppress &&
      shouldSuppressSuggestedPricingAfterApply(
        itemId,
        itemQuantities,
        measurementsInput.pricingAcceptance
      )
    ) {
      return empty;
    }
    if (
      userHasCommittedScopePricing(
        itemId,
        itemQuantities,
        measurementsInput.pricingAcceptance
      )
    ) {
      return { fill: null, comparison: null };
    }
    const quantity = Number(resolved.quantity);
    if (itemId === 'exterior_prep') {
      const material = round2(quantity * 0.15);
      const labor = round2(quantity * 0.65);
      return {
        fill: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel:
            'Suggested · National Average · exterior prep and masking',
          helper: `${quantity.toLocaleString()} sqft exterior surface`,
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis: { quantity, unit: resolved.unit || 'sqft' },
          benchmarkAction: 'price_ready',
          pricingRecordId: 'bps_national:exterior_prep:painting',
        },
        comparison: null,
      };
    }
    const material = round2(quantity * 0.9);
    const labor = round2(quantity * 2.25);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel:
          'Suggested · National Average · exterior/stucco paint (mid-market)',
        helper: exteriorPaintLocalCalibrationMessage(),
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: resolved.unit || 'sqft' },
        benchmarkAction: 'price_ready',
        pricingRecordId: 'bps_national:exterior_paint:painting',
      },
      comparison: null,
    };
  }

  const itemQuantities = measurementsInput.itemQuantities || {};
  if (
    !options?.bypassAppliedSuppress &&
    shouldSuppressSuggestedPricingAfterApply(
      itemId,
      itemQuantities,
      measurementsInput.pricingAcceptance
    )
  ) {
    return empty;
  }

  // A garbage disposal is optional and has no implicit quantity. Do not show
  // a national-average price while its count is zero or missing.
  if (
    itemId === 'garbage_disposal' &&
    !(Number(resolved.dualCount?.quantity ?? resolved.quantity) > 0)
  ) {
    return empty;
  }

  // Kitchen backsplash removal has a dedicated national benchmark. Keep this
  // explicit because the scope-profile catalog also contains a backsplash
  // demolition definition, which must not be mistaken for a rate record.
  if (itemId === 'backsplash_demo') {
    const measuredCount = Number(
      String(measurementsInput.backsplashSqft ?? '').replace(/,/g, '')
    );
    const count =
      Number.isFinite(measuredCount) && measuredCount > 0
        ? measuredCount
        : Number(resolved.dualCount?.quantity ?? resolved.quantity);
    const unit = String(
      resolved.dualCount?.unit ?? resolved.unit ?? 'sqft'
    ).toLowerCase();
    if (Number.isFinite(count) && count > 0 && unit === 'sqft') {
      const material = round2(count * 0.5);
      const labor = round2(count * 5);
      return {
        fill: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel:
            'Suggested budget split · National Average · backsplash removal',
          helper: `Based on ${count.toLocaleString()} sqft`,
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis: { quantity: count, unit: 'sqft' },
          benchmarkAction: 'price_ready',
          pricingRecordId: 'bps_national:backsplash_demo:sqft',
          productionStatus: 'review_required',
        },
        comparison: null,
      };
    }
  }

  // An explicit countertop takeoff is authoritative for the national-average
  // card. Do not let a notes-derived or stale per-SF split override 35 + 25
  // installed pricing when the user entered the countertop area.
  if (itemId === 'countertops') {
    const count = Number(
      String(measurementsInput.countertopSqft ?? '').replace(/,/g, '')
    );
    if (Number.isFinite(count) && count > 0) {
      const material = round2(count * 35);
      const labor = round2(count * 25);
      return {
        fill: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel:
            'Suggested budget split · National Average · countertop fabrication and install',
          helper: `Based on ${count.toLocaleString()} sqft`,
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis: { quantity: count, unit: 'sqft' },
          benchmarkAction: 'price_ready',
          pricingRecordId: 'bps_national:countertops:sqft',
          productionStatus: 'review_required',
        },
        comparison: null,
      };
    }
  }

  if (itemId === 'lighting') {
    const rates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      standard_existing_location: {
        material: 150,
        labor: 175,
        label: 'standard fixture at existing location',
      },
      decorative_existing_location: {
        material: 250,
        labor: 225,
        label: 'decorative fixture / pendant at existing location',
      },
      new_recessed_led: {
        material: 50,
        labor: 200,
        label: 'new recessed LED light',
      },
      new_location_with_wiring: {
        material: 150,
        labor: 500,
        label: 'new lighting location with wiring',
      },
    };
    const selectedTypes = String(choiceId || '')
      .split(',')
      .map(id => rates[id])
      .map((rate, index) => ({
        rate,
        choiceId: String(choiceId || '').split(',')[index],
      }))
      .filter(
        (
          entry
        ): entry is {
          rate: { material: number; labor: number; label: string };
          choiceId: string;
        } => Boolean(entry.rate)
      );
    if (selectedTypes.length) {
      const directQuantity = Number(itemQuantities[itemId]?.quantity);
      const fallbackCount =
        Number.isFinite(directQuantity) && directQuantity > 0
          ? directQuantity
          : Math.max(1, Number(resolved.quantity) || 1);
      const quantities = selectedTypes.map(
        ({ choiceId: selectedChoiceId }) => ({
          choiceId: selectedChoiceId,
          quantity:
            Number(
              itemQuantities[`${itemId}__${selectedChoiceId}`]?.quantity
            ) || fallbackCount,
        })
      );
      const material = round2(
        selectedTypes.reduce(
          (sum, { rate }, index) =>
            sum + quantities[index].quantity * rate.material,
          0
        )
      );
      const labor = round2(
        selectedTypes.reduce(
          (sum, { rate }, index) =>
            sum + quantities[index].quantity * rate.labor,
          0
        )
      );
      const hasPerOptionQuantities = selectedTypes.some(
        ({ choiceId: selectedChoiceId }) =>
          itemQuantities[`${itemId}__${selectedChoiceId}`] != null
      );
      const totalQuantity = hasPerOptionQuantities
        ? round2(quantities.reduce((sum, entry) => sum + entry.quantity, 0))
        : fallbackCount;
      const labels = selectedTypes.map(({ rate }) => rate.label).join(' + ');
      return {
        fill: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel: `Suggested budget split · National Average · ${labels}`,
          helper: `${totalQuantity.toLocaleString()} total fixtures across selected types`,
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis: { quantity: totalQuantity, unit: 'each' },
          benchmarkAction: 'price_ready',
          pricingRecordId: `bps_national:lighting:${String(choiceId)}:each`,
          productionStatus: 'review_required',
        },
        comparison: null,
      };
    }
    if (choiceId === 'not_in_scope' || choiceId === 'unsure') return empty;
  }

  const fixtureChoicePricing = resolveBathroomFixtureChoiceSuggestedPricing({
    itemId,
    templateKey,
    choiceId,
    quantity: resolved.quantity,
    unit: resolved.unit,
    toiletRelocateFloorType: measurementsInput.bathroomToiletRelocateFloorType,
  });
  if (fixtureChoicePricing !== undefined) return fixtureChoicePricing;

  const disposalChoicePricing =
    resolveKitchenGarbageDisposalChoiceSuggestedPricing({
      itemId,
      templateKey,
      choiceId,
      quantity: resolved.quantity,
      unit: resolved.unit,
    });
  if (disposalChoicePricing !== undefined) return disposalChoicePricing;

  if (itemId === 'transitions') {
    const rates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      standard_transition: {
        material: 20,
        labor: 30,
        label: 'standard T-molding / transition',
      },
      reducer: { material: 30, labor: 35, label: 'reducer' },
      threshold: { material: 35, labor: 40, label: 'threshold / end cap' },
      custom_transition: {
        material: 40,
        labor: 60,
        label: 'custom / difficult transition',
      },
    };
    const selectedTypes = String(choiceId || '')
      .split(',')
      .map(selectedChoiceId => ({
        choiceId: selectedChoiceId,
        rate: rates[selectedChoiceId],
      }))
      .filter(
        (
          entry
        ): entry is {
          choiceId: string;
          rate: { material: number; labor: number; label: string };
        } => Boolean(entry.rate)
      );
    if (selectedTypes.length) {
      const quantities = selectedTypes.map(
        ({ choiceId: selectedChoiceId }) => ({
          choiceId: selectedChoiceId,
          quantity:
            Number(
              measurementsInput.itemQuantities?.[
                `${itemId}__${selectedChoiceId}`
              ]?.quantity
            ) || Number(resolved.quantity),
        })
      );
      if (
        quantities.some(
          ({ quantity }) => !Number.isFinite(quantity) || quantity <= 0
        )
      )
        return empty;
      const material = round2(
        quantities.reduce(
          (sum, entry, index) =>
            sum + entry.quantity * selectedTypes[index].rate.material,
          0
        )
      );
      const labor = round2(
        quantities.reduce(
          (sum, entry, index) =>
            sum + entry.quantity * selectedTypes[index].rate.labor,
          0
        )
      );
      const totalQuantity = round2(
        quantities.reduce((sum, entry) => sum + entry.quantity, 0)
      );
      return {
        fill: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel: `Suggested budget split · National Average · ${selectedTypes
            .map(({ rate }) => rate.label)
            .join(' + ')}`,
          helper: `${totalQuantity.toLocaleString()} transition pieces`,
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis: { quantity: totalQuantity, unit: 'each' },
          benchmarkAction: 'price_ready',
          pricingRecordId: `bps_national:transitions:${selectedTypes.map(({ choiceId: id }) => id).join('+')}:each`,
          productionStatus: 'review_required',
        },
        comparison: null,
      };
    }
    if (
      String(choiceId || '')
        .split(',')
        .includes('unsure')
    )
      return empty;
  }

  if (
    itemId === 'excavation' &&
    String(templateKey || '').toLowerCase() === 'concrete' &&
    resolved.unit === 'cy' &&
    Number(resolved.quantity) > 0
  ) {
    const quantity = Number(resolved.quantity);
    const pricing = volumeSensitiveExcavationPricing(quantity);
    return {
      fill: {
        material: pricing.equipment,
        labor: pricing.labor,
        total: pricing.total,
        materialSource: 'national_average',
        laborSource: 'national_average',
        costBuckets: [
          {
            key: 'equipment',
            label: 'Equipment',
            amount: pricing.equipment,
            rate: round2(pricing.equipment / quantity),
            source: 'national_average',
          },
          {
            key: 'labor',
            label: 'Labor',
            amount: pricing.labor,
            rate: round2(pricing.labor / quantity),
            source: 'national_average',
          },
        ],
        rateSourceLabel: `National planning rate · Excavation / soil movement · ${pricing.tierLabel} · $${pricing.tierRate.toFixed(2)}/CY`,
        helper: `${quantity.toLocaleString()} CY · labor + equipment · export, haul-off, dump fees, and imported fill are separate${pricing.minimumApplied ? ' · $350 minimum applied' : ''}`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: 'cy' },
        benchmarkAction: 'price_ready',
        pricingRecordId: `bps_national:excavation:volume-sensitive:${quantity}cy`,
        productionStatus: 'review_required',
      },
      comparison: null,
    };
  }

  if (
    itemId === 'demo_removal' &&
    String(templateKey || '').toLowerCase() === 'concrete' &&
    Number(resolved.quantity) > 0
  ) {
    const selectedThicknessBands = measurementsInput.concreteDemoThicknessBands
      ?.length
      ? measurementsInput.concreteDemoThicknessBands
      : measurementsInput.concreteDemoThicknessBand
        ? [measurementsInput.concreteDemoThicknessBand]
        : [];
    const demoRates: Record<
      (typeof selectedThicknessBands)[number],
      { material: number; labor: number; label: string }
    > = {
      thin_2_3: { material: 1.1, labor: 1.9, label: '2–3" concrete' },
      standard_4: { material: 1.5, labor: 2.5, label: '4" concrete' },
      heavy_5_6: { material: 2.25, labor: 3.25, label: '5–6" concrete' },
      structural_7_plus: {
        material: 87.5,
        labor: 87.5,
        label: '7+" structural concrete',
      },
    };
    if (!selectedThicknessBands.length) return empty;
    if (selectedThicknessBands.includes('structural_7_plus')) {
      if (resolved.unit !== 'cy' || Number(resolved.quantity) <= 0)
        return empty;
      const quantity = Number(resolved.quantity);
      const material = round2(quantity * 87.5);
      const labor = round2(quantity * 87.5);
      return {
        fill: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel:
            'National planning allowance · Heavy / structural concrete demolition · $175/CY',
          helper: `${quantity.toLocaleString()} CY · heavy structural concrete — verify pricing`,
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis: { quantity, unit: 'cy' },
          benchmarkAction: 'comparison_only',
          pricingRecordId: 'bps_national:concrete_demo:structural:cy',
          isComparison: true,
          productionStatus: 'review_required',
        },
        comparison: null,
      };
    }
    const areaByThickness = measurementsInput.concreteDemoAreaByThickness || {};
    const segments = selectedThicknessBands.map(band => ({
      band,
      quantity:
        Number(areaByThickness[band]) > 0
          ? Number(areaByThickness[band])
          : selectedThicknessBands.length === 1
            ? Number(resolved.quantity)
            : 0,
    }));
    if (segments.some(segment => segment.quantity <= 0)) return empty;
    const reinforcedSurcharge = measurementsInput.concreteDemoReinforced
      ? 1.25
      : 0;
    const accessSurcharge = measurementsInput.concreteDemoLimitedAccess
      ? 1.5
      : 0;
    const material = round2(
      segments.reduce(
        (sum, segment) =>
          sum +
          segment.quantity *
            (demoRates[segment.band].material +
              reinforcedSurcharge +
              accessSurcharge),
        0
      )
    );
    const labor = round2(
      segments.reduce(
        (sum, segment) =>
          sum + segment.quantity * demoRates[segment.band].labor,
        0
      )
    );
    const totalQuantity = round2(
      segments.reduce((sum, segment) => sum + segment.quantity, 0)
    );
    const averageMaterialRate =
      totalQuantity > 0 ? round2(material / totalQuantity) : 0;
    const averageLaborRate =
      totalQuantity > 0 ? round2(labor / totalQuantity) : 0;
    const conditionLabels = [
      measurementsInput.concreteDemoReinforced
        ? 'reinforced +$1.25/sqft'
        : null,
      measurementsInput.concreteDemoLimitedAccess
        ? 'limited access +$1.50/sqft'
        : null,
    ].filter(Boolean);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'national_average',
        laborSource: 'national_average',
        costBuckets: [
          {
            key: 'equipment',
            label: 'Equipment & disposal',
            amount: material,
            rate: averageMaterialRate,
            source: 'national_average',
          },
          {
            key: 'labor',
            label: 'Labor',
            amount: labor,
            rate: averageLaborRate,
            source: 'national_average',
          },
        ],
        rateSourceLabel: `National average · Concrete demolition · ${segments.map(segment => demoRates[segment.band].label).join(' + ')} · normal haul-off included`,
        helper: `${totalQuantity.toLocaleString()} sqft · normal haul-off included${conditionLabels.length ? ` · ${conditionLabels.join(' · ')}` : ''}`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity: totalQuantity, unit: 'sqft' },
        benchmarkAction: 'price_ready',
        pricingRecordId: `bps_national:concrete_demo:${selectedThicknessBands.join('+')}:sqft`,
      },
      comparison: null,
    };
  }

  if (itemId === 'demo_clearing' && Number(resolved.quantity) > 0) {
    const clearingRates: Record<
      string,
      {
        material: number;
        labor: number;
        label: string;
        minimum: number;
        review?: boolean;
      }
    > = {
      light_clearing: {
        material: 0.4,
        labor: 1.1,
        label: 'Light clearing · normal haul-off included',
        minimum: 250,
      },
      medium_vegetation: {
        material: 0.7,
        labor: 1.8,
        label: 'Medium vegetation clearing',
        minimum: 350,
      },
      dense_vegetation: {
        material: 1.25,
        labor: 2.75,
        label: 'Dense vegetation clearing',
        minimum: 500,
        review: false,
      },
    };
    const clearingChoiceId =
      choiceId ?? measurementsInput.landscapeClearingLevel;
    const rate =
      clearingChoiceId === 'unsure'
        ? {
            ...clearingRates.medium_vegetation,
            label: 'Medium vegetation clearing · conditions review required',
            review: true,
          }
        : clearingRates[clearingChoiceId || 'light_clearing'] ||
          clearingRates.light_clearing;
    const quantity = Number(resolved.quantity);
    let material = round2(quantity * rate.material);
    let labor = round2(quantity * rate.labor);
    const minimum = rate.minimum;
    if (material + labor > 0 && material + labor < minimum) {
      const scale = minimum / (material + labor);
      material = round2(material * scale);
      labor = round2(labor * scale);
    }
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'national_average',
        laborSource: 'national_average',
        costBuckets: [
          {
            key: 'equipment',
            label: 'Equipment, haul-off & disposal',
            amount: material,
            rate: rate.material,
            source: 'national_average',
          },
          {
            key: 'labor',
            label: 'Labor',
            amount: labor,
            rate: rate.labor,
            source: 'national_average',
          },
        ],
        rateSourceLabel: `National planning rate · ${rate.label}`,
        helper: `${quantity.toLocaleString()} sqft${material + labor >= minimum && quantity * (rate.material + rate.labor) < minimum ? ` ($${minimum.toLocaleString()} minimum applied)` : ''}${rate.review ? ' · Review clearing conditions before bid' : ''}`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: 'sqft' },
        benchmarkAction: 'price_ready',
        pricingRecordId: `bps_national:demo_clearing:${clearingChoiceId || 'light_clearing'}:sqft`,
        productionStatus: rate.review ? 'review_required' : undefined,
      },
      comparison: null,
    };
  }

  if (itemId === 'irrigation' && Number(resolved.quantity) > 0) {
    const irrigationRates: Record<
      string,
      { material: number; labor: number; label: string; review?: boolean }
    > = {
      sprinkler: { material: 650, labor: 600, label: 'sprinkler irrigation' },
      drip: { material: 375, labor: 375, label: 'drip irrigation' },
      unsure: {
        material: 500,
        labor: 500,
        label: 'irrigation type not sure',
        review: true,
      },
    };
    const rate =
      irrigationRates[choiceId || 'sprinkler'] || irrigationRates.sprinkler;
    const quantity = Number(resolved.quantity);
    const material = round2(quantity * rate.material);
    const labor = round2(quantity * rate.labor);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel: `National planning rate · ${rate.label}`,
        helper: `${quantity.toLocaleString()} zones${rate.review ? ' · Review before bid' : ''}`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: 'zone' },
        benchmarkAction: 'price_ready',
        pricingRecordId: `bps_national:irrigation:${choiceId || 'sprinkler'}:zone`,
        productionStatus: rate.review ? 'review_required' : undefined,
      },
      comparison: null,
    };
  }

  if (itemId === 'landscape_boulders' && Number(resolved.quantity) > 0) {
    const quantity = Number(resolved.quantity);
    const material = round2(quantity * 250);
    const labor = round2(quantity * 150);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel:
          'National planning rate · Standard / medium boulder · Review before bid',
        helper: `${quantity.toLocaleString()} each · Review before bid`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: 'each' },
        benchmarkAction: 'price_ready',
        pricingRecordId: 'bps_national:landscape_boulders:each',
        productionStatus: 'review_required',
      },
      comparison: null,
    };
  }

  if (
    [
      'sod_turf',
      'artificial_turf',
      'rock',
      'mulch',
      'plants',
      'trees',
      'rock_mulch',
      'plants_trees',
    ].includes(itemId) &&
    Number(resolved.quantity) > 0
  ) {
    const selectedLandscapeScope = Array.isArray(
      measurementsInput.landscapeScope
    )
      ? measurementsInput.landscapeScope.map(String)
      : [];
    const normalizedId =
      itemId === 'rock_mulch'
        ? selectedLandscapeScope.includes('mulch')
          ? 'mulch'
          : 'rock'
        : itemId === 'plants_trees'
          ? selectedLandscapeScope.includes('trees') ||
            (Number(measurementsInput.treeCount) > 0 &&
              !(Number(measurementsInput.plantCount) > 0))
            ? 'trees'
            : 'plants'
          : itemId;
    const splitById: Record<
      string,
      { material: number; labor: number; label: string; unit: string }
    > = {
      sod_turf: { material: 0.85, labor: 0.9, label: 'sod', unit: 'sqft' },
      artificial_turf: {
        material: 8.5,
        labor: 7.5,
        label: 'artificial turf',
        unit: 'sqft',
      },
      rock: {
        material: 1.9,
        labor: 0.85,
        label: 'decorative rock · 3 inch depth',
        unit: 'sqft',
      },
      mulch: { material: 0.35, labor: 0.25, label: 'mulch', unit: 'sqft' },
      plants: {
        material: 35,
        labor: 30,
        label: 'standard shrub / plant',
        unit: 'each',
      },
      trees: {
        material: 250,
        labor: 200,
        label: 'standard landscape tree',
        unit: 'each',
      },
    };
    if (itemId === 'rock' || itemId === 'rock_mulch') {
      if (choiceId === 'premium_heavy' || choiceId === 'unsure') return empty;
      if (choiceId === 'rock_2in') {
        splitById.rock = {
          material: 1.55,
          labor: 0.7,
          label: 'decorative rock · 2 inch depth',
          unit: 'sqft',
        };
      }
    }
    const split =
      splitById[normalizedId] ??
      (() => {
        const fallback = NATIONAL_AVERAGE_BUDGET_SPLITS[itemId];
        return {
          material: fallback.material,
          labor: fallback.labor,
          label: fallback.sourceLabel,
          unit: fallback.unit,
        };
      })();
    const quantity = Number(resolved.quantity);
    const rockDepthInches =
      normalizedId === 'rock'
        ? choiceId === 'rock_2in'
          ? 2
          : choiceId === 'rock_3in' || !choiceId
            ? 3
            : null
        : null;
    const supportingTakeoff =
      rockDepthInches != null
        ? ` · approx ${((quantity * (rockDepthInches / 12)) / 27).toFixed(2)} CY at ${rockDepthInches} in`
        : '';
    let material = round2(quantity * split.material);
    let labor = round2(quantity * split.labor);
    const landscapingMinimums: Record<string, number> = {
      rock: 250,
    };
    const minimum = landscapingMinimums[normalizedId];
    if (minimum && material + labor > 0 && material + labor < minimum) {
      const scale = minimum / (material + labor);
      material = round2(material * scale);
      labor = round2(labor * scale);
    }
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel: `National planning rate · ${split.label}`,
        helper: `${quantity.toLocaleString()} ${split.unit || resolved.unit || 'units'}${supportingTakeoff}${
          minimum &&
          round2(material + labor) >= minimum &&
          quantity * (split.material + split.labor) < minimum
            ? ` ($${minimum.toLocaleString()} minimum applied)`
            : ''
        }`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: split.unit || resolved.unit },
        benchmarkAction: 'price_ready',
        pricingRecordId: `bps_national:${normalizedId}:${split.label}`,
      },
      comparison: null,
    };
  }

  if (
    ['demo_clearing', 'grading', 'soil_prep'].includes(itemId) &&
    Number(resolved.quantity) > 0
  ) {
    const fallback = NATIONAL_AVERAGE_BUDGET_SPLITS[itemId];
    const quantity = Number(resolved.quantity);
    let material = round2(quantity * fallback.material);
    let labor = round2(quantity * fallback.labor);
    const minimum =
      itemId === 'demo_clearing' ? 250 : itemId === 'grading' ? 500 : 300;
    if (material + labor > 0 && material + labor < minimum) {
      const scale = minimum / (material + labor);
      material = round2(material * scale);
      labor = round2(labor * scale);
    }
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel: fallback.sourceLabel,
        helper: `${quantity.toLocaleString()} sqft${
          round2(material + labor) >= minimum &&
          quantity * (fallback.material + fallback.labor) < minimum
            ? ` ($${minimum.toLocaleString()} minimum applied)`
            : ''
        }`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: 'sqft' },
        benchmarkAction: 'price_ready',
        pricingRecordId: `bps_national:${itemId}:sqft`,
      },
      comparison: null,
    };
  }

  if (
    itemId === 'concrete' &&
    String(templateKey || '').toLowerCase() === 'landscaping' &&
    Array.isArray(measurementsInput.landscapeScope) &&
    measurementsInput.landscapeScope.some(
      id => String(id) === 'concrete_edging'
    ) &&
    Number(resolved.quantity) > 0
  ) {
    const quantity = Number(resolved.quantity);
    const material = round2(quantity * 4);
    const labor = round2(quantity * 6);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel: 'National planning rate · Concrete edging',
        helper: `${quantity.toLocaleString()} LF`,
        mode: 'suggested_price',
        lumpSumOnly: false,
        basis: { quantity, unit: 'lf' },
        benchmarkAction: 'price_ready',
        pricingRecordId: 'bps_national:concrete_edging:lf',
      },
      comparison: null,
    };
  }

  if (itemId === 'electrical') {
    const rates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      replace_outlet_switch: {
        material: 15,
        labor: 70,
        label: 'replace outlet or switch',
      },
      replace_gfci: { material: 30, labor: 95, label: 'GFCI outlet' },
      add_relocate_outlet_gfci: {
        material: 50,
        labor: 225,
        label: 'add or relocate outlet or GFCI',
      },
      dedicated_120v: {
        material: 175,
        labor: 575,
        label: 'dedicated 120V appliance circuit',
      },
      dedicated_240v: {
        material: 250,
        labor: 700,
        label: 'dedicated 240V appliance circuit',
      },
    };
    const selectedTypes = String(choiceId || '')
      .split(',')
      .map(selectedChoiceId => ({
        choiceId: selectedChoiceId,
        rate: rates[selectedChoiceId],
      }))
      .filter(
        (
          entry
        ): entry is {
          choiceId: string;
          rate: { material: number; labor: number; label: string };
        } => Boolean(entry.rate)
      );
    if (selectedTypes.length) {
      const directQuantity = Number(itemQuantities[itemId]?.quantity);
      const appliedAllowance = Number(
        itemQuantities[`${itemId}__allowance`]?.quantity
      );
      const staleAppliedCount =
        Number.isFinite(directQuantity) &&
        Number.isFinite(appliedAllowance) &&
        directQuantity > 1 &&
        Math.abs(directQuantity - appliedAllowance) < 0.01;
      const fallbackCount = staleAppliedCount
        ? 1
        : Math.max(1, Number(resolved.quantity) || 1);
      const quantities = selectedTypes.map(({ choiceId: selectedChoiceId }) => {
        const optionQuantity = Number(
          itemQuantities[`${itemId}__${selectedChoiceId}`]?.quantity
        );
        return Number.isFinite(optionQuantity) && optionQuantity > 0
          ? optionQuantity
          : fallbackCount;
      });
      const material = round2(
        selectedTypes.reduce(
          (sum, { rate }, index) => sum + quantities[index] * rate.material,
          0
        )
      );
      const labor = round2(
        selectedTypes.reduce(
          (sum, { rate }, index) => sum + quantities[index] * rate.labor,
          0
        )
      );
      const hasPerOptionQuantities = selectedTypes.some(
        ({ choiceId: selectedChoiceId }) =>
          itemQuantities[`${itemId}__${selectedChoiceId}`] != null
      );
      const totalQuantity = hasPerOptionQuantities
        ? round2(quantities.reduce((sum, quantity) => sum + quantity, 0))
        : fallbackCount;
      const labels = selectedTypes.map(({ rate }) => rate.label).join(' + ');
      return {
        fill: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel: `Suggested budget split · National Average · ${labels}`,
          helper: `${totalQuantity.toLocaleString()} total electrical items across selected types`,
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis: { quantity: totalQuantity, unit: 'each' },
          benchmarkAction: 'price_ready',
          pricingRecordId: `bps_national:electrical:${String(choiceId)}:each`,
          productionStatus: 'review_required',
        },
        comparison: null,
      };
    }
    if (
      String(choiceId || '')
        .split(',')
        .includes('unsure')
    )
      return empty;
  }

  if (itemId === 'walls_moving') {
    const rates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      remove: {
        material: 8,
        labor: 18,
        label: 'remove and haul existing non-load-bearing wall',
      },
      add: {
        material: 20,
        labor: 45,
        label: 'frame, drywall, finish, and install new wall',
      },
    };
    const selectedTypes = String(choiceId || '')
      .split(',')
      .map(selectedChoiceId => ({
        choiceId: selectedChoiceId,
        rate: rates[selectedChoiceId],
      }))
      .filter(
        (
          entry
        ): entry is {
          choiceId: string;
          rate: { material: number; labor: number; label: string };
        } => Boolean(entry.rate)
      );
    if (selectedTypes.length) {
      const quantities = selectedTypes.map(
        ({ choiceId: selectedChoiceId }) => ({
          choiceId: selectedChoiceId,
          quantity: Number(
            measurementsInput.itemQuantities?.[`${itemId}__${selectedChoiceId}`]
              ?.quantity
          ),
        })
      );
      if (
        quantities.some(
          ({ quantity }) => !Number.isFinite(quantity) || quantity <= 0
        )
      ) {
        return empty;
      }
      const material = round2(
        selectedTypes.reduce(
          (sum, { rate }, index) =>
            sum + quantities[index].quantity * rate.material,
          0
        )
      );
      const labor = round2(
        selectedTypes.reduce(
          (sum, { rate }, index) =>
            sum + quantities[index].quantity * rate.labor,
          0
        )
      );
      const totalQuantity = round2(
        quantities.reduce((sum, entry) => sum + entry.quantity, 0)
      );
      const labels = selectedTypes.map(({ rate }) => rate.label).join(' + ');
      return {
        fill: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel: `Suggested budget split · National Average · ${labels}`,
          helper: `Based on ${totalQuantity.toLocaleString()} linear feet across selected wall work`,
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis: { quantity: totalQuantity, unit: 'lf' },
          benchmarkAction: 'price_ready',
          pricingRecordId: `bps_national:walls_moving:${String(choiceId)}:lf`,
          productionStatus: 'review_required',
        },
        comparison: null,
      };
    }
    if (
      String(choiceId || '')
        .split(',')
        .includes('unsure')
    )
      return empty;
  }

  if (
    itemId === 'plumbing' &&
    String(templateKey || '').toLowerCase() === 'kitchen'
  ) {
    const rates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      dishwasher_hookup: {
        material: 50,
        labor: 225,
        label: 'dishwasher replacement using existing plumbing/electrical',
      },
      gas_existing_shutoff: {
        material: 50,
        labor: 175,
        label: 'gas range connection to existing shutoff valve',
      },
      gas_branch_line: {
        material: 175,
        labor: 575,
        label: 'new short gas branch line for range',
      },
      rough_in: {
        material: 250,
        labor: 650,
        label: 'new plumbing rough-in point',
      },
    };
    const selectedTypes = String(choiceId || '')
      .split(',')
      .map(selectedChoiceId => ({
        choiceId: selectedChoiceId,
        rate: rates[selectedChoiceId],
      }))
      .filter(
        (
          entry
        ): entry is {
          choiceId: string;
          rate: { material: number; labor: number; label: string };
        } => Boolean(entry.rate)
      );
    if (selectedTypes.length) {
      const directQuantity = Number(itemQuantities[itemId]?.quantity);
      const appliedAllowance = Number(
        itemQuantities[`${itemId}__allowance`]?.quantity
      );
      const staleAppliedCount =
        Number.isFinite(directQuantity) &&
        Number.isFinite(appliedAllowance) &&
        directQuantity > 1 &&
        Math.abs(directQuantity - appliedAllowance) < 0.01;
      const fallbackCount = staleAppliedCount
        ? 1
        : Math.max(1, Number(resolved.quantity) || 1);
      const quantities = selectedTypes.map(({ choiceId: selectedChoiceId }) => {
        const optionQuantity = Number(
          itemQuantities[`${itemId}__${selectedChoiceId}`]?.quantity
        );
        return Number.isFinite(optionQuantity) && optionQuantity > 0
          ? optionQuantity
          : fallbackCount;
      });
      const material = round2(
        selectedTypes.reduce(
          (sum, { rate }, index) => sum + quantities[index] * rate.material,
          0
        )
      );
      const labor = round2(
        selectedTypes.reduce(
          (sum, { rate }, index) => sum + quantities[index] * rate.labor,
          0
        )
      );
      const hasPerOptionQuantities = selectedTypes.some(
        ({ choiceId: selectedChoiceId }) =>
          itemQuantities[`${itemId}__${selectedChoiceId}`] != null
      );
      const totalQuantity = hasPerOptionQuantities
        ? round2(quantities.reduce((sum, quantity) => sum + quantity, 0))
        : fallbackCount;
      const labels = selectedTypes.map(({ rate }) => rate.label).join(' + ');
      return {
        fill: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel: `Suggested budget split · National Average · ${labels}`,
          helper: `${totalQuantity.toLocaleString()} total connections across selected types`,
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis: { quantity: totalQuantity, unit: 'each' },
          benchmarkAction: 'price_ready',
          pricingRecordId: `bps_national:plumbing:${String(choiceId)}:each`,
          productionStatus: 'review_required',
        },
        comparison: null,
      };
    }
    if (choiceId === 'not_in_scope' || choiceId === 'unsure') return empty;
  }

  if (rule.splitTotalOnly) {
    const splitOnly = buildSplitTotalOnlySuggestedFill(itemId, pricingContext);
    if (splitOnly?.fill) {
      // Manual/user pricing is active — never leave national average as applyable.
      if (
        !options?.bypassAppliedSuppress &&
        userHasCommittedScopePricing(
          itemId,
          itemQuantities,
          measurementsInput.pricingAcceptance
        )
      ) {
        return asNationalAverageComparisonOnly(splitOnly) || empty;
      }
      return splitOnly;
    }
  }

  const componentSuggested = resolveStep2ComponentSuggestedPricing({
    itemId,
    templateKey,
    measurementsInput,
    resolved,
    pricingContext,
  });
  if (componentSuggested !== undefined) {
    if (
      !options?.bypassAppliedSuppress &&
      componentSuggested.fill &&
      userHasCommittedScopePricing(
        itemId,
        itemQuantities,
        measurementsInput.pricingAcceptance
      )
    ) {
      return asNationalAverageComparisonOnly(componentSuggested) || empty;
    }
    return componentSuggested;
  }

  if (isBathroomVanityCountertopScope(itemId, templateKey)) {
    const materialType = resolveBathroomVanityCountertopMaterialType({
      storedType: (measurementsInput as Record<string, unknown>)
        .bathroomVanityCountertopMaterialType,
    });
    if (materialType === 'unknown' || materialType === 'other_manual') {
      return empty;
    }
    const sqft =
      resolved.unit === 'sqft' && resolved.quantity
        ? resolved.quantity
        : parseScopeMeasurementInput(measurementsInput.countertopSqft);
    const installCount = parseScopeMeasurementInput(
      String(
        (measurementsInput as Record<string, unknown>)
          .bathroomInstallCounterCount ?? ''
      )
    );
    const eachCount =
      resolved.unit === 'each' && resolved.quantity
        ? resolved.quantity
        : installCount && installCount > 0
          ? installCount
          : 1;
    const vanityCountertop = resolveBathroomVanityCountertopSuggestedPricing({
      materialType,
      quantitySqft: sqft,
      quantityEach: eachCount,
    });
    if (vanityCountertop.fill)
      return vanityCountertop as ScopeItemSuggestedPricing;
    return empty;
  }

  // Ground-up fixture packages — blended barometer + national × state as flat installed
  // allowance unless the user already entered pricing. Landscaping uses Material/Labor below.
  if (
    String(templateKey || '').toLowerCase() === 'ground_up' &&
    (itemId === 'plumbing_trim' || itemId === 'electrical_trim') &&
    !hasUserEnteredFlatAllowancePricing(
      measurementsInput.itemQuantities || {},
      itemId
    )
  ) {
    if (
      itemId === 'electrical_trim' &&
      !shouldAutoPriceElectricalTrimPackage(
        measurementsInput as unknown as Record<string, unknown>,
        templateKey
      )
    ) {
      return empty;
    }
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const lump = resolveGroundUpFinishPackageLump({
      itemId,
      livingSf,
      state: pricingContext?.state,
    });
    if (lump) {
      return buildGroundUpBarometerLumpPricing(itemId, lump, {
        livingSf,
        allowanceLabel:
          itemId === 'plumbing_trim'
            ? 'Installed plumbing fixtures budget'
            : 'Installed electrical fixtures budget',
      });
    }
  }

  // Ground-up landscaping — same blended package total, with national Material/Labor share.
  if (
    String(templateKey || '').toLowerCase() === 'ground_up' &&
    itemId === 'landscaping' &&
    !hasUserEnteredFlatAllowancePricing(
      measurementsInput.itemQuantities || {},
      itemId
    )
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const lump = resolveGroundUpFinishPackageLump({
      itemId: 'landscaping',
      livingSf,
      state: pricingContext?.state,
    });
    if (lump && lump.material > 0 && lump.labor > 0) {
      return {
        fill: {
          material: lump.material,
          labor: lump.labor,
          total: lump.total,
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel: lump.rateSourceLabel,
          helper: lump.helper,
          mode: 'suggested_price',
          lumpSumOnly: false,
          installedBudgetBenchmark: false,
          splitSource: 'estimated',
          splitConfidence: 'medium',
          comparisonRange: lump.comparisonRange,
          basis: null,
          costBuckets: [
            {
              key: 'material',
              label: 'Material',
              amount: lump.material,
              rate: null,
              source: 'national_average',
            },
            {
              key: 'labor',
              label: 'Labor',
              amount: lump.labor,
              rate: null,
              source: 'national_average',
            },
          ],
          pricingRecordId: `su_landscaping:${lump.projectId || 'median'}:split`,
          productionStatus: 'review_required',
          benchmarkLevel: 'component',
          benchmarkScopeKey: 'landscaping',
          benchmarkAction: 'price_ready',
          storedTotalExact: lump.total,
        },
        comparison: null,
      };
    }
  }

  const measurementMatch = firstMeasurementForRule(rule, measurementsInput);
  const preferredUnit =
    resolved.dualCount?.unit ||
    (resolved.unit && !['allowance', 'lump_sum'].includes(resolved.unit)
      ? resolved.unit
      : null) ||
    measurementMatch?.unit ||
    rule.defaultUnit ||
    'sqft';
  const { average: averageInitial, regional } = regionalAdjustedNationalAverage(
    itemId,
    preferredUnit,
    pricingContext
  );
  let average = averageInitial;
  if (itemId === 'equipment_replace' && preferredUnit === 'each') {
    average = hvacEquipmentReplacementAverage(
      measurementsInput as Record<string, unknown>,
      regional
    );
  }
  if (
    (HVAC_EQUIPMENT_TYPE_SCOPE_ITEM_IDS as readonly string[]).includes(itemId) &&
    preferredUnit === 'each'
  ) {
    const rate = HVAC_EQUIPMENT_REPLACEMENT_RATES[itemId];
    if (rate) {
      const base = {
        unit: 'each' as const,
        material: rate.material,
        labor: rate.labor,
        sourceLabel: `Suggested budget split · National Average · ${rate.label}`,
      };
      average =
        regional.multiplier === 1
          ? base
          : applyRegionalMultiplierToBudgetSplit(base, regional) || base;
    }
  }
  if (
    itemId === 'drywall' &&
    completeDrywallPackage
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const packageSf = resolveDrywallPackageSurfaceQuantity(
      measurementsInput as unknown as Record<string, unknown>,
      { planFacts: measurementsInput.planFacts }
    );
    const baseline = resolveDrywallProductionAssemblyBaseline({
      livingSf,
      packageSurfaceSqft: packageSf,
    });
    const adjusted =
      regional.multiplier === 1
        ? baseline
        : applyRegionalMultiplierToBudgetSplit(baseline, regional) || baseline;
    average = {
      ...(average || {}),
      unit: 'sqft',
      material: adjusted.material,
      labor: adjusted.labor,
      sourceLabel: baseline.sourceLabel,
      rateSource: 'bps_southern_utah_calibrated',
      rateSourceReference:
        baseline.barometerTotal != null
          ? `SHV gypsum board $${baseline.barometerTotal.toLocaleString()} ÷ ${Math.round(packageSf || 0).toLocaleString()} SF package`
          : 'Southern Utah production gypsum-board package rate; state multiplier applied when available',
      productionStatus: 'production_ready',
      geographicBasis: 'southern_utah',
    };
  }
  if (
    (itemId === 'hang' || itemId === 'finish_tape') &&
    String(templateKey || '').toLowerCase() === 'drywall' &&
    !completeDrywallPackage
  ) {
    const counterpart = itemId === 'hang' ? 'finish_tape' : 'hang';
    const scopeAlone = !drywallScopeRowIncluded(pricingContext, counterpart);
    const split = resolveRemodelDrywallAssemblyBaseline(itemId, { scopeAlone });
    const adjusted =
      regional.multiplier === 1
        ? split
        : applyRegionalMultiplierToBudgetSplit(split, regional) || split;
    average = {
      ...(average || {}),
      unit: 'sqft',
      material: adjusted.material,
      labor: adjusted.labor,
      sourceLabel: split.sourceLabel,
      rateSource: 'bps_southern_utah_calibrated',
      rateSourceReference:
        'Southern Utah production gypsum-board package rate split for remodel scope',
      productionStatus: 'production_ready',
      geographicBasis: 'southern_utah',
    };
  }
  if (isStuccoTemplate && itemId === 'stucco') {
    const systemRates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      three_coat: {
        material: 3.75,
        labor: 5.25,
        label: '3-coat traditional stucco complete system',
      },
      one_coat: {
        material: 3,
        labor: 4,
        label: '1-coat stucco complete system',
      },
      eifs: {
        material: 4.75,
        labor: 5.75,
        label: 'EIFS / synthetic stucco complete system',
      },
      finish_only: {
        material: 1.25,
        labor: 2,
        label: 'finish coat only',
      },
    };
    const selectedRate = systemRates[String(choiceId || '')];
    if (selectedRate) {
      const componentShares: Record<string, number> = {
        stucco_wrb: 0.1,
        stucco_lath: 0.15,
        stucco_base_coat: 0.35,
        stucco_finish_coat: 0.25,
        stucco_accessories: 0.15,
      };
      const excludedShare = Array.from(Object.entries(componentShares)).reduce(
        (sum, [componentId, share]) => {
          const component = pricingContext?.checklistItems?.find(
            row => row.id === componentId
          );
          return component?.state === 'excluded' || component?.choiceId === 'no'
            ? sum + share
            : sum;
        },
        0
      );
      const retainedShare = Math.max(0, 1 - excludedShare);
      average = {
        ...(average || {}),
        material: selectedRate.material * retainedShare,
        labor: selectedRate.labor * retainedShare,
        unit: 'sqft',
        sourceLabel:
          excludedShare > 0
            ? `BPS national planning rate · ${selectedRate.label} · standard components excluded`
            : `BPS national planning rate · ${selectedRate.label}`,
      };
    }
  }
  if (isStuccoTemplate && itemId === 'stucco_foam_trim') {
    const trimRates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      basic_flat: { material: 3.5, labor: 5, label: 'basic flat foam band' },
      medium_profiled: {
        material: 5,
        labor: 7,
        label: 'medium / profiled architectural trim',
      },
      complex_custom: {
        material: 7.5,
        labor: 10.5,
        label: 'complex cornice / custom shape',
      },
    };
    const selectedRate = trimRates[String(choiceId || '')];
    if (!selectedRate) return empty;
    average = {
      ...(average || {}),
      material: selectedRate.material,
      labor: selectedRate.labor,
      unit: 'lf',
      sourceLabel: `BPS national planning rate · ${selectedRate.label}`,
    };
  }
  if (isStuccoTemplate && itemId === 'stucco_access') {
    const accessRates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      difficult_single_story: {
        material: 0.25,
        labor: 0.5,
        label: 'difficult single-story access',
      },
      two_story: { material: 0.5, labor: 1, label: 'two-story access' },
    };
    const selectedRate = accessRates[String(choiceId || '')];
    if (!selectedRate) return empty;
    average = {
      ...(average || {}),
      material: selectedRate.material,
      labor: selectedRate.labor,
      unit: 'sqft',
      sourceLabel: `BPS national planning rate · ${selectedRate.label}`,
    };
  }
  if (isStuccoTemplate && itemId === 'stucco_repairs') {
    const repairRates: Record<
      string,
      { material: number; labor: number; minimum: number; label: string }
    > = {
      light_repair: {
        material: 2,
        labor: 6,
        minimum: 400,
        label: 'light patch / crack repair',
      },
      moderate_repair: {
        material: 3.5,
        labor: 8.5,
        minimum: 600,
        label: 'moderate stucco repair',
      },
      full_depth_repair: {
        material: 6,
        labor: 12,
        minimum: 750,
        label: 'full-depth / re-stucco repair',
      },
    };
    const selectedRate = repairRates[String(choiceId || '')];
    if (!selectedRate) return empty;
    average = {
      ...(average || {}),
      material: selectedRate.material,
      labor: selectedRate.labor,
      unit: 'sqft',
      sourceLabel: `BPS national planning rate · ${selectedRate.label}`,
    };
  }
  if (isStuccoTemplate && itemId === 'stucco_parapets') {
    const parapetItem = pricingContext?.checklistItems?.find(
      row => row.id === 'stucco_parapets'
    );
    if (parapetItem?.state !== 'included') return empty;
    const systemChoice = pricingContext?.checklistItems?.find(
      row => row.id === 'stucco'
    )?.choiceId;
    const systemRates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      three_coat: {
        material: 3.75,
        labor: 5.25,
        label: '3-coat traditional stucco',
      },
      one_coat: {
        material: 3,
        labor: 4,
        label: '1-coat stucco',
      },
      eifs: {
        material: 4.75,
        labor: 5.75,
        label: 'EIFS / synthetic stucco',
      },
      finish_only: {
        material: 1.25,
        labor: 2,
        label: 'finish coat only',
      },
    };
    const selectedRate = systemRates[String(systemChoice || '')];
    if (!selectedRate) return empty;
    average = {
      ...(average || {}),
      material: selectedRate.material,
      labor: selectedRate.labor,
      unit: 'sqft',
      sourceLabel: `BPS national planning rate · separate parapet stucco · ${selectedRate.label}`,
    };
  }

  if (
    itemId === 'underlayment' &&
    String(templateKey || '').toLowerCase() === 'roofing'
  ) {
    average = {
      ...(average || {}),
      material: 0.75,
      labor: 0.5,
      unit: 'sqft',
      sourceLabel:
        'BPS national planning rate · premium / synthetic roofing underlayment upgrade',
    };
  }

  if (
    itemId === 'ice_water_shield' &&
    String(templateKey || '').toLowerCase() === 'roofing'
  ) {
    average = {
      ...(average || {}),
      material: 1.2,
      labor: 0.8,
      unit: 'sqft',
      sourceLabel: 'BPS national planning rate · localized ice & water shield',
    };
  }

  if (itemId === 'tear_off') {
    const tearOffRates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      one_layer: {
        material: 35,
        labor: 140,
        label:
          'one-layer asphalt removal, loading, ordinary haul-off, and cleanup',
      },
      two_layers: {
        material: 50,
        labor: 200,
        label:
          'two-layer asphalt removal, loading, ordinary haul-off, and cleanup',
      },
      three_plus_custom: {
        material: 65,
        labor: 260,
        label:
          'three-plus-layer asphalt removal, loading, ordinary haul-off, and cleanup · review before bid',
      },
      tile_removal: {
        material: 100,
        labor: 300,
        label:
          'tile roof removal, loading, ordinary haul-off, and cleanup · review before bid',
      },
      metal_removal: {
        material: 55,
        labor: 220,
        label:
          'metal roof removal, loading, ordinary haul-off, and cleanup · review before bid',
      },
      membrane_removal: {
        material: 60,
        labor: 240,
        label:
          'membrane roof removal, loading, ordinary haul-off, and cleanup · review before bid',
      },
    };
    if (!choiceId || choiceId === 'new_construction') return empty;
    const selectedRate = tearOffRates[String(choiceId)];
    if (!selectedRate) return empty;
    average = {
      ...(average || {}),
      material: selectedRate.material,
      labor: selectedRate.labor,
      unit: 'squares',
      sourceLabel: `BPS national planning rate · ${selectedRate.label}`,
    };
  }

  if (itemId === 'roof_repairs') {
    const repairRates: Record<
      string,
      { material: number; labor: number; minimum: number; label: string }
    > = {
      light_repair: {
        material: 2.4,
        labor: 5.6,
        minimum: 400,
        label: 'light patch / shingle repair',
      },
      moderate_repair: {
        material: 3.6,
        labor: 8.4,
        minimum: 600,
        label: 'moderate localized repair',
      },
      full_depth_repair: {
        material: 5.4,
        labor: 12.6,
        minimum: 750,
        label: 'full-depth roofing repair',
      },
    };
    const selectedRate = repairRates[String(choiceId || '')];
    if (!selectedRate) return empty;
    average = {
      ...(average || {}),
      material: selectedRate.material,
      labor: selectedRate.labor,
      unit: 'sqft',
      sourceLabel: `BPS national planning rate · ${selectedRate.label}`,
    };
  }

  if (itemId === 'shingles_roofing') {
    const roofingSystem = pricingContext?.checklistItems?.find(
      row => row.id === 'roofing_system'
    )?.choiceId;
    const systemRates: Record<
      string,
      { material: number; labor: number; label: string }
    > = {
      architectural_shingles: {
        material: 250,
        labor: 325,
        label: 'architectural asphalt shingles',
      },
      three_tab_shingles: {
        material: 220,
        labor: 280,
        label: '3-tab asphalt shingles',
      },
      exposed_fastener_metal: {
        material: 400,
        labor: 500,
        label: 'exposed-fastener metal roofing',
      },
      standing_seam_metal: {
        material: 575,
        labor: 725,
        label: 'standing-seam metal roofing',
      },
      concrete_clay_tile: {
        material: 650,
        labor: 850,
        label: 'concrete / clay tile roofing',
      },
      tpo: {
        material: 375,
        labor: 475,
        label: 'TPO roofing',
      },
      epdm: {
        material: 400,
        labor: 500,
        label: 'EPDM roofing',
      },
      modified_bitumen: {
        material: 275,
        labor: 375,
        label: 'modified bitumen roofing',
      },
    };
    if (roofingSystem && roofingSystem !== 'architectural_shingles') {
      const selectedRate = systemRates[String(roofingSystem)];
      if (!selectedRate) return empty;
      average = {
        ...(average || {}),
        material: selectedRate.material,
        labor: selectedRate.labor,
        unit: 'squares',
        sourceLabel: `BPS national planning rate · ${selectedRate.label} · review before bid`,
      };
    }
  }

  if (
    itemId === 'insulation' &&
    average?.material != null &&
    average?.labor != null
  ) {
    const assembly =
      insulationRateAdjustmentsForMeasurements(measurementsInput);
    average = {
      ...average,
      material: round2(
        average.material * assembly.materialMultiplier +
          assembly.materialAddPerSqft
      ),
      labor: round2(average.labor * assembly.laborMultiplier),
      sourceLabel: `${average.sourceLabel || 'Insulation rate'}${
        assembly.label ? ` · ${assembly.label}` : ''
      }`,
    };
  }

  if (itemId === 'hvac') {
    const evidenceTier = resolveHvacPricingEvidenceTier(
      measurementsInput as Record<string, unknown>,
      pricingContext
    );
    if (evidenceTier !== 'verified_equipment') {
      // Package pricing handled above; do not multiply unverified counts.
    } else {
      const systemTons = parseScopeMeasurementInput(
        measurementsInput.hvacSystemTons
      );
      const systemCount = parseScopeMeasurementInput(
        measurementsInput.hvacSystemCount
      );
      const capacityTons =
        systemTons && systemCount && systemCount > 0
          ? systemTons / systemCount
          : systemTons;
      if (capacityTons && capacityTons > 0) {
        const tier = hvacSystemTierBudgetSplit(capacityTons);
        average = {
          ...(average || {}),
          unit: 'each',
          material: tier.material,
          labor: tier.labor,
          sourceLabel: tier.sourceLabel,
        };
      }
    }
  }

  let unit = average?.unit || preferredUnit;

  // Quantity in the rate unit (e.g. 850 sqft, 220 lf) — not applied dollar totals.
  let count =
    resolveSuggestedPricingPhysicalCount(
      itemId,
      rule,
      resolved,
      unit,
      itemQuantities
    ) ??
    (itemId === 'floor_demo' && unit === 'sqft'
      ? floorDemoPricingSqftCount(resolved, rule, measurementsInput)
      : measurementMatch?.unit === unit
        ? measurementMatch.quantity
        : firstMeasurementQuantityForRule(rule, measurementsInput));
  if (
    (!count || count <= 0) &&
    (rule.defaultUnit === 'allowance' || rule.defaultUnit === 'lump_sum')
  ) {
    const { average: flatAverageBase } = regionalAdjustedNationalAverage(
      itemId,
      rule.defaultUnit,
      pricingContext
    );
    const flatAverage = flatAverageBase;
    if (flatAverage?.labor || flatAverage?.material) {
      count = rule.defaultQuantity ?? 1;
      unit = flatAverage?.unit || rule.defaultUnit;
    }
  }
  if (
    userHasCommittedScopePricing(
      itemId,
      itemQuantities,
      measurementsInput.pricingAcceptance
    )
  ) {
    const fromMeasurement = firstMeasurementQuantityForRule(
      rule,
      measurementsInput
    );
    if (
      fromMeasurement &&
      fromMeasurement > 0 &&
      ['sqft', 'living_sqft'].includes(String(unit).toLowerCase()) &&
      (!count || count <= 1) &&
      fromMeasurement > 1
    ) {
      count = fromMeasurement;
    }
    if ((!count || count <= 0) && rule.defaultQuantity != null) {
      count = rule.defaultQuantity;
      unit = rule.defaultUnit;
    }
  }
  // Ground-up / framing trade: covered framed SF (living + garage) for planning rates.
  // Living-only SF would inflate $/SF vs the $5–$10/framed labor band.
  if (
    itemId === 'framing' &&
    ['ground_up', 'framing'].includes(
      String(templateKey || '').toLowerCase()
    ) &&
    !(
      resolved.quantity != null &&
      resolved.quantity > 0 &&
      resolved.quantitySource === 'user_entered'
    )
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const garageSf =
      parseScopeMeasurementInput(measurementsInput.garageSqft) || 0;
    const framedSf =
      livingSf && livingSf > 0 ? livingSf + Math.max(0, garageSf) : null;
    if (framedSf && framedSf > 0) {
      const reframed = regionalAdjustedNationalAverage(
        itemId,
        'sqft',
        pricingContext
      );
      if (
        reframed.average?.material != null &&
        reframed.average?.labor != null
      ) {
        count = framedSf;
        unit = 'sqft';
        average = reframed.average;
      }
    }
  }
  // Ground-up barometer lumps — SHV Lots 39/41/49/58 + national (not × inflated notes SF).
  if (String(templateKey || '').toLowerCase() === 'ground_up') {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );

    if (itemId === 'stucco') {
      const wallSf = parseScopeMeasurementInput(
        measurementsInput.exteriorPaintSqft
      );
      const lump = resolveStuccoSuggestedTotal({
        livingSf,
        wallSf,
        quantitySource: resolved.quantitySource,
        state: pricingContext?.state,
      });
      return buildGroundUpBarometerLumpPricing('stucco', lump, {
        livingSf,
        basis:
          wallSf && resolved.quantitySource === 'user_entered'
            ? { quantity: wallSf, unit: 'sqft' }
            : null,
        allowanceLabel: 'Installed stucco budget',
      });
    }

    if (itemId === 'plumbing_rough' || itemId === 'electrical_rough') {
      const countEntry = measurementsInput.itemQuantities?.[itemId];
      const eachQty = parseScopeMeasurementInput(
        String(countEntry?.quantity ?? '')
      );
      const eachUnit = normalizeBasisUnit(countEntry?.unit);
      const hasEachCount =
        eachQty != null && eachQty > 0 && eachUnit === 'each';
      if (!hasEachCount) {
        if (
          itemId === 'electrical_rough' &&
          !shouldAutoPriceElectricalRoughPackage(
            measurementsInput as unknown as Record<string, unknown>,
            templateKey
          )
        ) {
          return empty;
        }
        const lump =
          itemId === 'plumbing_rough'
            ? resolvePlumbingRoughLumpSuggestedFill({
                livingSf,
                state: pricingContext?.state,
              })
            : resolveElectricalRoughLumpSuggestedFill({
                livingSf,
                state: pricingContext?.state,
              });
        return buildGroundUpBarometerLumpPricing(itemId, lump, {
          livingSf,
          allowanceLabel:
            itemId === 'plumbing_rough'
              ? 'Installed plumbing rough-in budget'
              : 'Installed electrical rough-in budget',
        });
      }
    }

    if (itemId === 'insulation') {
      const lump = resolveInsulationLumpSuggestedFill({
        livingSf,
        state: pricingContext?.state,
      });
      const assemblyRows = resolvedInsulationAssemblies(measurementsInput);
      const assembly =
        insulationRateAdjustmentsForMeasurements(measurementsInput);
      const legacyAssembly =
        insulationAssemblyRateAdjustments(measurementsInput);
      const adjustedLegacyLump = {
        ...lump,
        material: round2(lump.material * legacyAssembly.materialMultiplier),
        labor: round2(lump.labor * legacyAssembly.laborMultiplier),
        total: round2(
          lump.material * legacyAssembly.materialMultiplier +
            lump.labor * legacyAssembly.laborMultiplier
        ),
        rateSourceLabel: legacyAssembly.label
          ? `${lump.rateSourceLabel} · ${legacyAssembly.label}`
          : lump.rateSourceLabel,
      };
      const assemblyLump = {
        ...(assemblyRows.length ? lump : adjustedLegacyLump),
        ...(assemblyRows.length && assembly.label
          ? { rateSourceLabel: `${lump.rateSourceLabel} · ${assembly.label}` }
          : {}),
      };
      const envelope = resolveInsulationEnvelopePlanningQuantity(
        insulationEnvelopeInputsFromPlanFacts(
          measurementsInput.planFacts,
          livingSf,
          {
            ...(measurementsInput as unknown as Record<string, unknown>),
            suppressAtticPlanningFallback:
              Number(measurementsInput.exteriorWallGrossSqft) > 0 ||
              Number(measurementsInput.exteriorWallInsulationSqft) > 0 ||
              Number(measurementsInput.openingDeductionSqft) > 0,
          } as unknown as Partial<InsulationEnvelopeInputs>
        )
      );
      const componentPricing = priceInsulationEnvelopeComponents({
        lump: assemblyLump,
        envelope,
        assembly,
        assemblies: assemblyRows,
        pricingContext,
        templateKey,
        livingSf,
      });
      const adjustedLump = {
        ...assemblyLump,
        ...componentPricing,
        pricingDetail: componentPricing.detail,
        helper: [
          lump.helper,
          assembly.label ? `Assembly: ${assembly.label}.` : null,
          String(measurementsInput.garageInsulationIncluded || '').trim()
            ? `Garage: ${String(
                measurementsInput.garageInsulationIncluded
              ).trim()}.`
            : null,
        ]
          .filter(Boolean)
          .join(' '),
      };
      return buildGroundUpBarometerLumpPricing('insulation', adjustedLump, {
        livingSf,
        basis:
          envelope && Number(envelope.totalInsulationEnvelopeSqft) > 0
            ? {
                quantity: envelope.totalInsulationEnvelopeSqft,
                unit: 'sqft',
              }
            : null,
        allowanceLabel: 'Installed insulation budget',
      });
    }

    if (itemId === 'exterior_paint') {
      const paintSf = parseScopeMeasurementInput(
        measurementsInput.exteriorPaintSqft
      );
      const userPaint =
        resolved.quantitySource === 'user_entered' &&
        paintSf != null &&
        paintSf > 0;
      if (!userPaint) {
        const lump = resolveExteriorPaintLumpSuggestedFill({
          livingSf,
          state: pricingContext?.state,
        });
        return buildGroundUpBarometerLumpPricing('exterior_paint', lump, {
          livingSf,
          allowanceLabel: 'Installed exterior paint budget',
        });
      }
    }

    if (itemId === 'tile_flooring' || itemId === 'flooring') {
      const floorQty =
        resolved.quantity != null && Number(resolved.quantity) > 0
          ? Number(resolved.quantity)
          : parseScopeMeasurementInput(measurementsInput.flooringSqft) ||
            parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
      if (
        flooringUsesBarometerLumpPackage({
          itemId,
          livingSf,
          floorQuantity: floorQty,
          flooringSqft: parseScopeMeasurementInput(
            measurementsInput.flooringSqft
          ),
          flooringTileSqft: parseScopeMeasurementInput(
            measurementsInput.flooringTileSqft
          ),
          quantitySource: resolved.quantitySource,
        })
      ) {
        const lump = resolveFlooringLumpSuggestedFill({
          livingSf,
          state: pricingContext?.state,
        });
        return buildGroundUpBarometerLumpPricing(itemId, lump, {
          livingSf,
          basis:
            floorQty && floorQty > 0
              ? { quantity: floorQty, unit: 'sqft' }
              : null,
          allowanceLabel: 'Installed flooring budget',
        });
      }
    }
  }

  // Exterior flatwork: blended H17 barometer + NAHB driveway when SF takeoff is missing.
  if (
    (!count || count <= 0) &&
    itemId === 'pour_flatwork' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const lump = resolveExteriorFlatworkLumpSuggestedFill({
      livingSf,
      state: pricingContext?.state,
    });
    return buildGroundUpBarometerLumpPricing('pour_flatwork', lump, {
      livingSf,
      allowanceLabel: 'Installed flatwork budget',
    });
  }

  // Exterior swing / sliding doors: blended H36 / H35 packages when door count is missing.
  if (
    (!count || count <= 0) &&
    (itemId === 'exterior_doors' || itemId === 'sliding_doors') &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const lump =
      itemId === 'exterior_doors'
        ? resolveExteriorDoorsLumpSuggestedFill({
            livingSf,
            state: pricingContext?.state,
          })
        : resolveSlidingDoorsLumpSuggestedFill({
            livingSf,
            state: pricingContext?.state,
          });
    return buildGroundUpBarometerLumpPricing(itemId, lump, {
      livingSf,
      allowanceLabel:
        itemId === 'exterior_doors'
          ? 'Installed exterior door budget'
          : 'Installed sliding door budget',
    });
  }

  if (itemId === 'trim_finish') {
    const choice = String(choiceId || '');
    if (!choice || choice === 'not_in_scope' || choice === 'unsure') {
      return empty;
    }
    const manualLf = Number(measurementsInput.trimFinishLf);
    const derivedLf = deriveTrimFinishLfFromMeasurements(
      measurementsInput as Record<string, unknown>,
      choice
    );
    const lf =
      Number.isFinite(manualLf) && manualLf > 0
        ? manualLf
        : resolved.quantity != null && resolved.quantity > 0
          ? resolved.quantity
          : derivedLf;
    if (lf == null || lf <= 0) return empty;
    const pkg = resolveTrimFinishSuggestedPricing({
      choiceId: choice,
      linearFeet: lf,
      fieldFinishIncluded: resolveTrimFinishFieldPaintIncluded({
        choiceId: choice,
        stored: measurementsInput.trimFinishFieldPaintIncluded,
      }),
    });
    if (!pkg) return empty;
    return {
      fill: {
        material: pkg.material,
        labor: pkg.labor,
        total: pkg.total,
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel: pkg.sourceLabel,
        helper: pkg.helper,
        mode: 'suggested_price',
        basis: { quantity: lf, unit: 'lf' },
        splitSource: 'source',
        splitConfidence: derivedLf === lf ? 'medium' : 'high',
      },
      comparison: null,
    };
  }

  if (
    count > 0 &&
    (itemId === 'windows' ||
      itemId === 'exterior_doors' ||
      itemId === 'sliding_doors')
  ) {
    const measurementKey =
      itemId === 'windows'
        ? 'windowCount'
        : itemId === 'exterior_doors'
          ? 'exteriorDoorCount'
          : 'slidingDoorCount';
    const rows = openingScheduleRowsForMeasurementKey(
      measurementKey,
      openingSchedulesFromPlanFacts(
        measurementsInput.planFacts as {
          openingSchedules?: import('@/utils/subcontractorTrade/windowsDoorsPlanConvergence').OpeningSchedules;
        } | null
      )
    );
    const mix = rows.length
      ? openingSizeMixFromRows(itemId, rows, count)
      : {
          standard: count,
          medium: 0,
          large: 0,
          oversized: 0,
        };
    const sizedPkg = resolveOpeningSizeTierSuggestedPricing({
      itemId,
      quantity: count,
      mix,
      location: { state: pricingContext?.state },
    });
    if (sizedPkg) {
      return {
        fill: {
          material: sizedPkg.material,
          labor: sizedPkg.labor,
          total: sizedPkg.total,
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel: sizedPkg.sourceLabel,
          helper: sizedPkg.helper,
          mode: 'suggested_price',
          basis: { quantity: sizedPkg.quantity, unit: 'each' },
          splitSource: 'source',
          splitConfidence:
            rows.length && mix.medium + mix.large + mix.oversized > 0
              ? 'high'
              : 'medium',
        },
        comparison: null,
      };
    }
  }

  // Garage doors: type-based package (single / double / RV), scaled by state.
  if (itemId === 'garage_doors') {
    const counts = normalizeGarageDoorCounts(measurementsInput);
    if (totalGarageDoorCount(counts) > 0) {
      const garagePkg = resolveGarageDoorSuggestedPricing(counts, {
        state: pricingContext?.state,
      });
      if (garagePkg) {
        return {
          fill: {
            material: garagePkg.material,
            labor: garagePkg.labor,
            total: garagePkg.total,
            materialSource: 'national_average',
            laborSource: 'national_average',
            rateSourceLabel: garagePkg.sourceLabel,
            helper: garagePkg.helper,
            mode: 'suggested_price',
            basis: { quantity: garagePkg.quantity, unit: 'each' },
            splitSource: 'source',
            splitConfidence: 'high',
          },
          comparison: null,
        };
      }
    }
  }
  // Excavation: plan shallow pad + footing trench CY from living SF when CY takeoff is missing.
  if (
    (!count || count <= 0) &&
    itemId === 'excavation' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    if (livingSf && livingSf > 0) {
      // Same shallow-pad + footing-trench planning basis as Quick Measurements (~Lot 41 ~100–130 CY).
      const perimeter = 4 * Math.sqrt(livingSf);
      const trenchCy = (perimeter * 3 * 3) / 27;
      const padCutCy = (livingSf * 0.5) / 27;
      const planningCy = Math.max(
        1,
        Math.round(trenchCy + padCutCy + trenchCy * 0.1)
      );
      const reframed = regionalAdjustedNationalAverage(
        itemId,
        'cy',
        pricingContext
      );
      if (
        reframed.average?.material != null &&
        reframed.average?.labor != null
      ) {
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
    const reframed = regionalAdjustedNationalAverage(
      itemId,
      'each',
      pricingContext
    );
    if (reframed.average?.material != null && reframed.average?.labor != null) {
      count = 1;
      unit = 'each';
      average = reframed.average;
    }
  }
  // Cabinets: plan LF ≈ living SF / 25 until run takeoff exists (same basis as barometer).
  if (
    (!count || count <= 0) &&
    itemId === 'cabinets' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    if (livingSf && livingSf > 0) {
      const planningLf = Math.max(1, Math.round(livingSf / 25));
      const reframed = regionalAdjustedNationalAverage(
        itemId,
        'lf',
        pricingContext
      );
      if (
        reframed.average?.material != null &&
        reframed.average?.labor != null
      ) {
        count = planningLf;
        unit = 'lf';
        average = reframed.average;
      }
    }
  }
  // Counters: plan ~80 SF kitchen tops when takeoff is missing.
  // Do not price on whole-home cabinet LF × 25" depth (e.g. 120 LF → 250 SF)
  // or living SF wrongly seeded onto the package (e.g. 3,098 SF → ~$465k).
  if (
    itemId === 'countertops' &&
    String(templateKey || '').toLowerCase() === 'ground_up'
  ) {
    const cabinetLf = parseScopeMeasurementInput(measurementsInput.cabinetLf);
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const countertopTakeoff = parseScopeMeasurementInput(
      measurementsInput.countertopSqft
    );
    const COUNTERTOP_DEPTH_FT = 2.083;
    const GROUND_UP_PLANNING_TOPS_SF = 80;
    const lfDepthProxy =
      cabinetLf != null &&
      cabinetLf > 0 &&
      count != null &&
      count > 0 &&
      Math.abs(count - cabinetLf * COUNTERTOP_DEPTH_FT) <
        Math.max(2, cabinetLf * COUNTERTOP_DEPTH_FT * 0.03);
    const looksLikeLivingSf =
      livingSf != null &&
      livingSf > 0 &&
      count != null &&
      count > 0 &&
      Math.abs(count - livingSf) < Math.max(1, livingSf * 0.02) &&
      !(countertopTakeoff != null && countertopTakeoff > 0);
    const source = resolved.quantitySource;
    const trustTakeoff =
      !looksLikeLivingSf &&
      (source === 'user_entered' ||
        source === 'plan_vision' ||
        source === 'notes');
    const usePlanning =
      !count ||
      count <= 0 ||
      looksLikeLivingSf ||
      (lfDepthProxy && !trustTakeoff);
    if (usePlanning) {
      const reframed = regionalAdjustedNationalAverage(
        itemId,
        'sqft',
        pricingContext
      );
      if (
        reframed.average?.material != null &&
        reframed.average?.labor != null
      ) {
        count = GROUND_UP_PLANNING_TOPS_SF;
        unit = 'sqft';
        average = reframed.average;
      }
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
      const reframed = regionalAdjustedNationalAverage(
        itemId,
        'sqft',
        pricingContext
      );
      if (
        reframed.average?.material != null &&
        reframed.average?.labor != null
      ) {
        count = floorSf;
        unit = 'sqft';
        average = reframed.average;
      }
    }
  }
  // Drywall/hang/finish: expand living SF or thin notes takeoffs (e.g. 4,056) with 3.5× surface.
  if (
    (itemId === 'drywall' || itemId === 'hang' || itemId === 'finish_tape') &&
    ['ground_up', 'drywall'].includes(String(templateKey || '').toLowerCase())
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const usePackageQuantity =
      itemId === 'drywall' && completeDrywallPackage;
    const componentQuantity = usePackageQuantity
      ? resolveDrywallPackageSurfaceQuantity(
          measurementsInput as unknown as Record<string, unknown>,
          { planFacts: measurementsInput.planFacts }
        )
      : resolveDrywallConditionedSurfaceQuantity(
          measurementsInput as unknown as Record<string, unknown>,
          { planFacts: measurementsInput.planFacts }
        );
    const protectedDrywallQty =
      isProtectedDrywallQuantity(
        measurementsInput as unknown as Record<string, unknown>
      ) ||
      ['user_entered', 'manual_override'].includes(
        String(resolved.quantitySource)
      );
    if (componentQuantity != null && !protectedDrywallQty) {
      count = componentQuantity;
      unit = 'sqft';
    } else if (livingSf && livingSf > 0) {
      const floorProxy =
        !count ||
        count <= 0 ||
        Math.abs(count - livingSf) < 0.51 ||
        isUndercountedDrywallSurface(count, livingSf);
      if (floorProxy) {
        const surfaceSf = drywallSurfacePlanningQuantity(livingSf);
        const reframed = regionalAdjustedNationalAverage(
          itemId,
          'sqft',
          pricingContext
        );
        if (
          surfaceSf > 0 &&
          reframed.average?.material != null &&
          reframed.average?.labor != null
        ) {
          count = surfaceSf;
          unit = 'sqft';
          average = reframed.average;
        }
      }
    }
  }
  // Insulation: whole-house thermal envelope from explicit surfaces only.
  if (itemId === 'insulation') {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const looksLikeWrongBasis =
      !count ||
      count <= 0 ||
      (livingSf != null &&
        (Math.abs(count - livingSf) < 0.51 ||
          Math.abs(count - Math.round(livingSf * 3.5)) < 1));
    if (looksLikeWrongBasis) {
      const envelope = resolveInsulationEnvelopePlanningQuantity(
        insulationEnvelopeInputsFromPlanFacts(
          (measurementsInput as ScopeMeasurementsInputExtended).planFacts,
          livingSf,
          measurementsInput
        )
      );
      const envelopeSf = envelope?.totalInsulationEnvelopeSqft;
      const reframed = regionalAdjustedNationalAverage(
        itemId,
        'sqft',
        pricingContext
      );
      if (
        envelopeSf &&
        envelopeSf > 0 &&
        reframed.average?.material != null &&
        reframed.average?.labor != null
      ) {
        count = envelopeSf;
        unit = 'sqft';
        average = reframed.average;
      }
    }
  }
  if (!count || count <= 0) {
    if (
      itemId === 'floor_prep' &&
      measurementsInput.flooringDemoIncludesSubstratePrep === 'yes' &&
      !(resolveConfirmedAffectedPrepArea(measurementsInput) > 0)
    ) {
      const includedPrep = buildFloorPrepPricingContext(measurementsInput);
      if (includedPrep.ok && includedPrep.includedInDemo) {
        return {
          fill: {
            material: 0,
            labor: 0,
            total: 0,
            materialSource: 'national_average',
            laborSource: 'national_average',
            rateSourceLabel: includedPrep.sourceLabel,
            helper: 'Included in demolition pricing',
            mode: 'suggested_price',
            basis: { quantity: 0, unit: 'sqft' },
            pricingDetail: includedPrep.pricingDetail,
          },
          comparison: null,
        };
      }
    }
    const paintTrimMissing = resolveSouthernUtahPaintTrimSuggestedFill({
      itemId,
      templateKey,
      measurementsInput,
      paintableOrCount: null,
      unit: preferredUnit,
      pricingContext,
    });
    if (paintTrimMissing) {
      const paintItemId =
        itemId === 'paint_trim' || itemId === 'paint'
          ? 'interior_paint'
          : itemId;
      return {
        fill: paintTrimMissing,
        comparison: null,
      };
    }
    // Ground-up soft costs (plans / permits) even when no qty or stage evidence is cached.
    const softMissing = getBuilderBudgetSoftCostAllowance(itemId, templateKey);
    if (softMissing?.amount) {
      const total = round2(softMissing.amount);
      return {
        fill: {
          material: 0,
          labor: total,
          total,
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel: softMissing.sourceLabel,
          helper: softMissing.note,
          mode: 'suggested_price',
          lumpSumOnly: true,
          pricingRecordId: `bps_soft_cost:${itemId}:allowance`,
          productionStatus: 'review_required',
          benchmarkAction: 'benchmark_only',
        },
        comparison: null,
      };
    }
    // Measurement-semantics: missing primary takeoff must not hide read-only/planning
    // benchmark evidence (living SF × stage rate). Do not invent a national $/sqft fill.
    const benchmarkOnly = benchmarkFillWithoutPrimaryTakeoff(
      itemId,
      measurementsInput.pricingAcceptance,
      templateKey
    );
    if (benchmarkOnly) return benchmarkOnly;
    if (
      userHasCommittedScopePricing(
        itemId,
        itemQuantities,
        measurementsInput.pricingAcceptance
      )
    ) {
      const userBenchmark = buildNationalBenchmarkForUserEnteredPricing(
        itemId,
        rule,
        measurementsInput,
        resolved,
        templateKey,
        pricingContext
      );
      if (userBenchmark?.fill || userBenchmark?.comparison)
        return userBenchmark;
    }
    return empty;
  }

  const basis = { quantity: count, unit };
  const basisHelper = rule.lumpSumOnly
    ? 'Suggested allowance for this job'
    : `Based on ${count.toLocaleString()} ${unit}`;

  if (rule.lumpSumOnly) {
    const paintTrimPackage = resolveSouthernUtahPaintTrimSuggestedFill({
      itemId,
      templateKey,
      measurementsInput,
      paintableOrCount: count,
      unit,
      pricingContext,
    });
    if (paintTrimPackage) {
      const paintItemId =
        itemId === 'paint_trim' || itemId === 'paint'
          ? 'interior_paint'
          : itemId;
      return {
        fill: paintTrimPackage,
        comparison: null,
      };
    }
    // Keep the benchmark/suggested allowance available after the user edits so they
    // can switch back via Apply / Use suggested. Do not treat user-entered amounts
    // as the suggestion source.
    const userEnteredFlat = hasUserEnteredFlatAllowancePricing(
      measurementsInput.itemQuantities || {},
      itemId
    );
    const copy = flatAllowanceCopyFor(itemId);
    if (userEnteredFlat) {
      // Prefer ground-up soft-cost barometer (permits/plans) over remodel national.
      const softCost = getBuilderBudgetSoftCostAllowance(itemId, templateKey);
      if (softCost?.amount) {
        const total = round2(softCost.amount);
        return {
          fill: null,
          comparison: {
            material: 0,
            labor: total,
            total,
            materialSource: 'national_average',
            laborSource: 'national_average',
            rateSourceLabel: 'National average comparison',
            helper: `${softCost.note} · suggested comparison`,
            mode: 'suggested_price',
            lumpSumOnly: true,
            isComparison: true,
            benchmarkAction: 'comparison_only',
            pricingRecordId: `bps_soft_cost:${itemId}:allowance`,
            productionStatus: 'review_required',
          },
        };
      }
      const userBenchmark = buildNationalBenchmarkForUserEnteredPricing(
        itemId,
        rule,
        measurementsInput,
        resolved,
        templateKey,
        pricingContext
      );
      if (userBenchmark?.comparison || userBenchmark?.fill)
        return userBenchmark;
    }
    const noteTotal = userEnteredFlat
      ? null
      : (resolved.dualAllowance?.quantity ??
        (resolved.quantitySource === 'notes' &&
        (resolved.unit === 'allowance' || resolved.unit === 'lump_sum')
          ? resolved.quantity
          : null));
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
    const libraryLump = resolveLibraryLumpSumForItem(
      itemId,
      pricingContext?.libraryRates
    );
    if (libraryLump != null && libraryLump > 0) {
      const total = round2(libraryLump);
      return {
        fill: {
          material: 0,
          labor: total,
          total,
          materialSource: 'template',
          laborSource: 'template',
          rateSourceLabel: 'Saved pricing',
          helper: copy.suggested || 'Saved allowance from your pricing library',
          mode: 'suggested_price',
          lumpSumOnly: true,
          basis: { quantity: 1, unit: 'allowance' },
        },
        comparison: buildPureNationalAverageComparisonBlock({
          itemId,
          basis: { quantity: 1, unit: 'allowance' },
          fillTotal: total,
        }),
      };
    }
    // Ground-up soft costs (permits / plans): use bid barometer, not remodel-scale national.
    const softCost = getBuilderBudgetSoftCostAllowance(itemId, templateKey);
    if (softCost?.amount) {
      const total = round2(softCost.amount);
      return {
        fill: {
          material: 0,
          labor: total,
          total,
          materialSource: 'national_average',
          laborSource: 'national_average',
          rateSourceLabel: softCost.sourceLabel,
          helper: softCost.note,
          mode: 'suggested_price',
          lumpSumOnly: true,
          pricingRecordId: `bps_soft_cost:${itemId}:allowance`,
          productionStatus: 'review_required',
          benchmarkAction: 'benchmark_only',
        },
        comparison: null,
      };
    }
    const { average: flatAverageBase } = regionalAdjustedNationalAverage(
      itemId,
      rule.defaultUnit,
      pricingContext
    );
    const flatAverage = flatAverageBase;
    const total = round2(
      (flatAverage?.material ?? 0) + (flatAverage?.labor ?? 0)
    );
    if (total <= 0) return empty;
    return {
      fill: {
        material: 0,
        labor: total,
        total,
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel: rateSourceLabelFor(
          'national_average',
          'national_average',
          null,
          regional,
          flatAverage
        ),
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

  let flooringDemoPricingDetail: string | null = null;
  let floorPrepPricingDetail: string | null = null;
  let floorPrepReviewBeforeBid = false;
  if (itemId === 'adhesive_mastic_removal' && unit === 'sqft') {
    const adhesiveNotes = String(originalNotes || '');
    const adhesiveRate = /heavy|grind|difficult|bonded/i.test(adhesiveNotes)
      ? 2.75
      : /moderate|mastic/i.test(adhesiveNotes)
        ? 1.75
        : 1;
    average = {
      ...(average || {}),
      unit: 'sqft',
      material: 0,
      labor: adhesiveRate,
      sourceLabel: `National Average planning estimate · adhesive/mastic removal · $${adhesiveRate.toFixed(2)}/SF`,
    };
  }
  if (
    itemId === 'floor_demo' &&
    String(templateKey || '').toLowerCase() === 'flooring' &&
    unit === 'sqft'
  ) {
    const demoAverage = flooringDemoNationalAverage(
      measurementsInput,
      count,
      originalNotes
    );
    flooringDemoPricingDetail = demoAverage.pricingDetail;
    average = {
      ...(average || {}),
      unit: 'sqft',
      material: demoAverage.material,
      labor: demoAverage.labor,
      materialBucketLabel: demoAverage.materialBucketLabel,
      sourceLabel: demoAverage.sourceLabel,
    };
  }
  if (
    itemId === 'floor_prep' &&
    (String(templateKey || '').toLowerCase() === 'flooring' ||
      Array.isArray(measurementsInput.flooringExistingTypes) ||
      Array.isArray(measurementsInput.flooringProductScope)) &&
    unit === 'sqft'
  ) {
    // Confirm Scope can resolve a notes-backed quantity without persisting it
    // into the QM field. Feed that resolved quantity into the boundary as the
    // affected prep area; never derive it from demolition SF.
    const prepMeasurements =
      Number(measurementsInput.floorPrepSqft || 0) > 0 ||
      resolved.quantitySource === 'missing' ||
      resolved.quantitySource === 'default_assumption'
        ? measurementsInput
        : { ...measurementsInput, floorPrepSqft: String(count) };
    const prepAverage = floorPrepPricing(
      prepMeasurements,
      count,
      resolved.quantitySource
    );
    floorPrepPricingDetail = prepAverage.pricingDetail;
    floorPrepReviewBeforeBid = Boolean(prepAverage.reviewBeforeBid);
    average = {
      ...(average || {}),
      unit: 'sqft',
      material: prepAverage.material,
      labor: prepAverage.labor,
      sourceLabel: prepAverage.sourceLabel,
    };
  }
  const flooringInstallAverage = flooringInstallNationalAverage(
    itemId,
    measurementsInput
  );
  const dynamicFlooringInstall = Boolean(
    flooringInstallAverage &&
      unit === 'sqft' &&
      String(templateKey || '').toLowerCase() === 'flooring'
  );
  if (dynamicFlooringInstall && flooringInstallAverage) {
    average = {
      ...(average || {}),
      unit: 'sqft',
      material: flooringInstallAverage.material,
      labor: flooringInstallAverage.labor,
      sourceLabel: flooringInstallAverage.sourceLabel,
    };
  }
  const template = resolveTemplateRateForItem(
    itemId,
    unit,
    pricingContext,
    count
  );
  const decorativeFinishRates = {
    integral_color: { material: 1.5, labor: 0, label: 'Integral color' },
    exposed_aggregate: { material: 4, labor: 0, label: 'Exposed aggregate' },
    basic_stamped: { material: 5, labor: 0, label: 'Basic stamped concrete' },
    premium_stamped: {
      material: 8,
      labor: 0,
      label: 'Premium / multi-color stamped concrete',
    },
  } as const;
  const decorativeFinish =
    itemId === 'decorative_finish' && unit === 'sqft'
      ? decorativeFinishRates[
          measurementsInput.concreteDecorativeFinish || 'integral_color'
        ]
      : null;
  const dynamicFloorPrep =
    itemId === 'floor_prep' &&
    (String(templateKey || '').toLowerCase() === 'flooring' ||
      Array.isArray(measurementsInput.flooringExistingTypes) ||
      Array.isArray(measurementsInput.flooringProductScope)) &&
    unit === 'sqft';
  let materialRate = decorativeFinish
    ? (template?.materialRate ?? decorativeFinish.material)
    : dynamicFloorPrep || dynamicFlooringInstall
      ? (average?.material ?? null)
      : (template?.materialRate ?? average?.material ?? null);
  let laborRate = decorativeFinish
    ? (template?.laborRate ?? decorativeFinish.labor)
    : dynamicFloorPrep || dynamicFlooringInstall
      ? (average?.labor ?? null)
      : (template?.laborRate ?? average?.labor ?? null);
  if (itemId === 'drywall' && count > 0) {
    const measurementRecord = measurementsInput as Record<string, unknown>;
    const materialMultiplier = resolveDrywallPackageMaterialMultiplier(
      measurementRecord,
      count,
      {
        planFacts:
          measurementRecord.planFacts as Record<string, unknown> | null,
        completePackage: true,
      }
    );
    const laborMultiplier = resolveDrywallPackageLaborMultiplier(
      measurementRecord,
      count,
      {
        planFacts:
          measurementRecord.planFacts as Record<string, unknown> | null,
        completePackage: true,
        checklistItems: pricingContext?.checklistItems,
      }
    );
    if (materialRate != null) materialRate *= materialMultiplier;
    if (laborRate != null) laborRate *= laborMultiplier;
  }
  if (itemId === 'finish_tape' && count > 0) {
    const finishChoice = resolveDrywallFinishChoiceId(
      measurementsInput as Record<string, unknown>,
      pricingContext?.checklistItems
    );
    const finishLaborMultiplier = drywallFinishLaborMultiplier(finishChoice);
    if (laborRate != null && finishLaborMultiplier !== 1) {
      laborRate *= finishLaborMultiplier;
    }
  }
  const materialRateSource: PricingLegSource =
    dynamicFloorPrep || dynamicFlooringInstall
      ? 'national_average'
      : template?.materialRate
        ? 'template'
        : 'national_average';
  const laborRateSource: PricingLegSource =
    dynamicFloorPrep || dynamicFlooringInstall
      ? 'national_average'
      : template?.laborRate
        ? 'template'
        : 'national_average';
  const templateName = template?.source ?? null;
  if (decorativeFinish && average) {
    average = {
      ...average,
      material: materialRate ?? decorativeFinish.material,
      labor: laborRate ?? decorativeFinish.labor,
      sourceLabel: `National average · ${decorativeFinish.label} · optional upgrade`,
    };
  }

  if (!hasAnyPricingRate(materialRate, laborRate)) return empty;

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
    if (splitLegsUserEntered(resolved) && !splitLegsFromNotes(resolved)) {
      const userBenchmark = buildNationalBenchmarkForUserEnteredPricing(
        itemId,
        rule,
        measurementsInput,
        resolved,
        templateKey,
        pricingContext,
        rule.defaultQuantity ?? 1
      );
      if (userBenchmark?.fill || userBenchmark?.comparison)
        return userBenchmark;
      return empty;
    }
    if (splitLegsFromNotes(resolved)) {
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
      if (!hasAnyPricingRate(materialRate, laborRate)) return empty;
      const material = round2(count * (materialRate ?? 0));
      const labor = round2(count * (laborRate ?? 0));
      return {
        fill: null,
        comparison: {
          material,
          labor,
          total: round2(material + labor),
          materialSource: materialRateSource,
          laborSource: laborRateSource,
          rateSourceLabel: rateSourceLabelFor(
            materialRateSource,
            laborRateSource,
            template,
            regional
          ),
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
  }

  // Case B: exactly one leg from notes -> fill the missing leg.
  if (noteMaterial != null && noteLabor == null) {
    if (!pricingRateDefined(laborRate)) return empty;
    const labor = round2(count * laborRate);
    const material = round2(noteMaterial);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'notes',
        laborSource: laborRateSource,
        rateSourceLabel: rateSourceLabelFor(
          'notes',
          laborRateSource,
          template,
          regional
        ),
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
    if (!pricingRateDefined(materialRate)) return empty;
    const material = round2(count * materialRate);
    const labor = round2(noteLabor);
    // Demo/removal notes often give one labor total — keep compact card + budget split panel.
    if (
      itemId === 'floor_demo' &&
      noteTotal != null &&
      Math.abs(noteTotal - labor) < 0.01
    ) {
      return empty;
    }
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: materialRateSource,
        laborSource: 'notes',
        rateSourceLabel: rateSourceLabelFor(
          materialRateSource,
          'notes',
          template,
          regional
        ),
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
          rateSourceLabel: rateSourceLabelFor(
            'template',
            'template',
            template,
            regional
          ),
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
    if (!pricingRateDefined(materialRate)) return empty;
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
        rateSourceLabel: rateSourceLabelFor(
          materialRateSource,
          materialRateSource,
          template,
          regional
        ),
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

  // Blended barometer paint / finish-carpentry packages beat bare national $/SF rates.
  const localPaintTrim =
    !template &&
    resolveSouthernUtahPaintTrimSuggestedFill({
      itemId,
      templateKey,
      measurementsInput,
      paintableOrCount: count,
      unit,
      pricingContext,
    });
  if (localPaintTrim) {
    const paintItemId =
      itemId === 'paint_trim' || itemId === 'paint' ? 'interior_paint' : itemId;
    return {
      fill: localPaintTrim,
      comparison: null,
    };
  }

  // Case D: quantity only, no notes pricing -> full suggested price.
  // Prefer physical takeoff × national/template rates over living-SF stage lumps so
  // Confirm Scope can produce material+labor for project cost tracking.
  const isPhysicalTakeoffUnit = ![
    'allowance',
    'lump_sum',
    'living_sqft',
    'ls',
  ].includes(String(unit || '').toLowerCase());
  const hasPhysicalTakeoffRates = Boolean(
    isPhysicalTakeoffUnit &&
      count > 0 &&
      hasAnyPricingRate(materialRate, laborRate)
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
  if (!hasAnyPricingRate(materialRate, laborRate)) return empty;
  const isStandardConcreteFlatwork =
    itemId === 'pour_flatwork' ||
    (itemId === 'concrete' &&
      String(templateKey || '').toLowerCase() === 'concrete');
  const concreteThicknessInches = parseScopeMeasurementInput(
    measurementsInput.concreteThicknessInches
  );
  const concreteAreaByType = measurementsInput.concreteAreaByType || {};
  const concreteThicknessByType =
    measurementsInput.concreteThicknessByType || {};
  const segmentedFlatworkPricing =
    itemId === 'pour_flatwork' &&
    unit === 'sqft' &&
    Object.keys(concreteAreaByType).length
      ? Object.entries(concreteAreaByType).reduce(
          (totals, [type, rawArea]) => {
            const area = parseScopeMeasurementInput(rawArea);
            if (area == null || area <= 0) return totals;
            const defaultThickness = type === 'rv_pads' ? 5 : 4;
            const thickness =
              parseScopeMeasurementInput(concreteThicknessByType[type]) ||
              defaultThickness;
            totals.material += area * ((materialRate ?? 0) * (thickness / 4));
            totals.labor += area * (laborRate ?? 0);
            return totals;
          },
          { material: 0, labor: 0 }
        )
      : null;
  const concreteThicknessMultiplier =
    isStandardConcreteFlatwork &&
    !segmentedFlatworkPricing &&
    unit === 'sqft' &&
    concreteThicknessInches != null &&
    concreteThicknessInches > 0
      ? concreteThicknessInches / 4
      : 1;
  const effectiveMaterialRate =
    materialRate != null
      ? round2(materialRate * concreteThicknessMultiplier)
      : materialRate;
  const effectiveAverage =
    concreteThicknessMultiplier !== 1 && average
      ? {
          ...average,
          material: effectiveMaterialRate ?? average.material,
          sourceLabel: `${average.sourceLabel || 'National average'} · ${concreteThicknessInches}" slab basis`,
        }
      : average;
  let calculatedMaterial = segmentedFlatworkPricing
    ? round2(segmentedFlatworkPricing.material)
    : round2(count * (effectiveMaterialRate ?? 0));
  let calculatedLabor = segmentedFlatworkPricing
    ? round2(segmentedFlatworkPricing.labor)
    : round2(count * (laborRate ?? 0));
  let calculatedFlatworkTotal = round2(calculatedMaterial + calculatedLabor);
  if (
    itemId === 'drywall' &&
    completeDrywallPackage &&
    unit === 'sqft' &&
    calculatedFlatworkTotal > 0
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const drywallBaseline = resolveDrywallProductionAssemblyBaseline({
      livingSf,
      packageSurfaceSqft: count,
    });
    if (
      drywallBaseline.barometerTotal != null &&
      drywallBaseline.barometerTotal > 0 &&
      !isProtectedDrywallQuantity(
        measurementsInput as unknown as Record<string, unknown>
      ) &&
      !['user_entered', 'manual_override'].includes(
        String(resolved.quantitySource)
      )
    ) {
      const expectedPackage = drywallPackageSurfacePlanningQuantity(
        livingSf,
        parseScopeMeasurementInput(String(measurementsInput.garageSqft ?? '')) ||
          parseScopeMeasurementInput(
            String(
              measurementsInput.planFacts?.buildingAreas?.garageSqft ?? ''
            )
          ) ||
          null
      );
      const matchesBarometerPackage =
        expectedPackage != null &&
        Math.abs(count - expectedPackage) / expectedPackage <= 0.1;
      if (matchesBarometerPackage) {
        calculatedMaterial = round2(
          drywallBaseline.barometerTotal * DRYWALL_INSTALLED_MATERIAL_SHARE
        );
        calculatedLabor = round2(
          drywallBaseline.barometerTotal * (1 - DRYWALL_INSTALLED_MATERIAL_SHARE)
        );
        const measurementRecord = measurementsInput as Record<string, unknown>;
        const packageMaterialMultiplier = resolveDrywallPackageMaterialMultiplier(
          measurementRecord,
          count,
          {
            planFacts:
              measurementRecord.planFacts as Record<string, unknown> | null,
            completePackage: true,
          }
        );
        if (packageMaterialMultiplier !== 1) {
          calculatedMaterial = round2(
            calculatedMaterial * packageMaterialMultiplier
          );
        }
        const packageLaborMultiplier = resolveDrywallPackageLaborMultiplier(
          measurementRecord,
          count,
          {
            planFacts:
              measurementRecord.planFacts as Record<string, unknown> | null,
            completePackage: true,
            checklistItems: pricingContext?.checklistItems,
          }
        );
        if (packageLaborMultiplier !== 1) {
          calculatedLabor = round2(calculatedLabor * packageLaborMultiplier);
        }
        calculatedFlatworkTotal = round2(
          calculatedMaterial + calculatedLabor
        );
      }
    }
  }
  const repairMinimum =
    isStuccoTemplate && itemId === 'stucco_repairs'
      ? (
          {
            light_repair: 400,
            moderate_repair: 600,
            full_depth_repair: 750,
          } as Record<string, number>
        )[String(choiceId || '')] || 0
      : itemId === 'roof_repairs'
        ? (
            {
              light_repair: 400,
              moderate_repair: 600,
              full_depth_repair: 750,
            } as Record<string, number>
          )[String(choiceId || '')] || 0
        : 0;
  const smallJobMinimum = Math.max(
    repairMinimum,
    itemId === 'decking_repair'
      ? 300
      : itemId === 'gutters'
        ? 400
        : itemId === 'downspouts'
          ? 250
          : [
                'drip_edge',
                'ridge_cap',
                'valley_flashing',
                'step_flashing',
                'wall_flashing',
                'ridge_vent',
                'roof_vents',
                'turbine_vents',
                'pipe_boots',
                'chimney_flashing',
                'skylight_flashing',
                'roof_penetrations',
              ].includes(itemId)
            ? 250
            : 0
  );
  const repairMinimumApplied =
    smallJobMinimum > calculatedFlatworkTotal && calculatedFlatworkTotal > 0;
  const repairMinimumScale = repairMinimumApplied
    ? smallJobMinimum / calculatedFlatworkTotal
    : 1;
  if (
    isStandardConcreteFlatwork &&
    String(templateKey || '').toLowerCase() === 'ground_up' &&
    unit === 'sqft' &&
    calculatedFlatworkTotal > 0
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const flatworkLump = resolveExteriorFlatworkLumpSuggestedFill({
      livingSf,
      state: pricingContext?.state,
    });
    if (flatworkLump.total > calculatedFlatworkTotal) {
      const scale = flatworkLump.total / calculatedFlatworkTotal;
      calculatedMaterial = round2(calculatedMaterial * scale);
      calculatedLabor = round2(calculatedLabor * scale);
      calculatedFlatworkTotal = round2(calculatedMaterial + calculatedLabor);
    }
  }
  const flatworkMinimumApplied =
    isStandardConcreteFlatwork &&
    unit === 'sqft' &&
    calculatedFlatworkTotal > 0 &&
    calculatedFlatworkTotal < 1750;
  const flatworkMinimumScale = flatworkMinimumApplied
    ? 1750 / calculatedFlatworkTotal
    : 1;
  let material = round2(calculatedMaterial * flatworkMinimumScale);
  let labor = round2(calculatedLabor * flatworkMinimumScale);
  if (repairMinimumApplied) {
    material = round2(material * repairMinimumScale);
    labor = round2(labor * repairMinimumScale);
  }
  if (
    String(templateKey || '').toLowerCase() === 'ground_up' &&
    (itemId === 'insulation' || itemId === 'exterior_paint') &&
    count > 0
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const takeoffTotal = round2(material + labor);
    const lump =
      itemId === 'insulation'
        ? resolveInsulationLumpSuggestedFill({
            livingSf,
            state: pricingContext?.state,
          })
        : resolveExteriorPaintLumpSuggestedFill({
            livingSf,
            state: pricingContext?.state,
          });
    const planningQty =
      itemId === 'insulation'
        ? resolveInsulationEnvelopePlanningQuantity(
            insulationEnvelopeInputsFromPlanFacts(
              (measurementsInput as ScopeMeasurementsInputExtended).planFacts,
              livingSf,
              measurementsInput
            )
          )?.totalInsulationEnvelopeSqft || livingSf
        : livingSf != null && livingSf > 0
          ? Math.round(livingSf * 1.05)
          : count;
    const capped = capTakeoffTotalAtBarometerLump(
      takeoffTotal,
      lump.total,
      count,
      Number(planningQty) || count
    );
    if (capped < takeoffTotal && takeoffTotal > 0) {
      const scale = capped / takeoffTotal;
      material = round2(material * scale);
      labor = round2(labor * scale);
    }
  }
  const effectiveMaterialRateForBuckets =
    effectiveMaterialRate != null
      ? round2(
          effectiveMaterialRate *
            (repairMinimumApplied &&
            String(templateKey || '').toLowerCase() === 'roofing'
              ? 1
              : flatworkMinimumScale)
        )
      : effectiveMaterialRate;
  const effectiveLaborRate =
    laborRate != null
      ? round2(
          laborRate *
            (repairMinimumApplied &&
            String(templateKey || '').toLowerCase() === 'roofing'
              ? 1
              : flatworkMinimumScale)
        )
      : laborRate;
  if (material + labor <= 0) return empty;
  const drywallFinishChoice = resolveDrywallFinishChoiceId(
    measurementsInput as Record<string, unknown>,
    pricingContext?.checklistItems
  );
  const drywallLaborBucketLabel =
    itemId === 'drywall'
      ? drywallFinishLaborBucketLabel(drywallFinishChoice, {
          scope: 'complete',
        })
      : itemId === 'finish_tape'
        ? drywallFinishLaborBucketLabel(drywallFinishChoice, {
            scope: 'finish_tape',
          })
        : null;
  let takeoffFill: SuggestedPricingBlock = {
    material,
    labor,
    total: round2(material + labor),
    materialSource: materialRateSource,
    laborSource: laborRateSource,
    rateSourceLabel: rateSourceLabelFor(
      materialRateSource,
      laborRateSource,
      template,
      regional,
      effectiveAverage
    ),
    templateName,
    helper: floorPrepReviewBeforeBid
      ? 'Possible duplicate scope · review whether final substrate preparation is included in demolition before bidding.'
      : repairMinimumApplied
        ? String(templateKey || '').toLowerCase() === 'roofing'
          ? `$${smallJobMinimum.toLocaleString()} minimum applied`
          : `${itemId === 'decking_repair' ? 'Roof decking' : itemId === 'roof_repairs' ? 'Roofing repair' : itemId.startsWith('roof_') || ['drip_edge', 'ridge_cap', 'valley_flashing', 'step_flashing', 'wall_flashing', 'ridge_vent', 'roof_vents', 'turbine_vents', 'pipe_boots', 'chimney_flashing', 'skylight_flashing'].includes(itemId) ? 'Roofing accessory' : 'Stucco'} small-job minimum charge · calculated price was below the $${smallJobMinimum.toLocaleString()} minimum.`
        : flatworkMinimumApplied
          ? 'Concrete flatwork minimum charge · calculated sqft price was below the $1,750 small-job minimum.'
          : itemId === 'exterior_paint'
            ? exteriorPaintLocalCalibrationMessage()
            : `${basisHelper} · suggested pricing`,
    mode: 'suggested_price',
    basis,
    benchmarkScopeProfile:
      materialRateSource === 'national_average' ||
      laborRateSource === 'national_average'
        ? buildNationalAverageBenchmarkScopeProfile({
            itemId,
            average: effectiveAverage,
            quantity: count,
            total: round2(material + labor),
            regional,
          })
        : undefined,
    costBuckets: buildSuggestedPricingCostBuckets({
      itemId,
      average: effectiveAverage,
      material,
      labor,
      materialSource: materialRateSource,
      laborSource: laborRateSource,
      materialRate: effectiveMaterialRateForBuckets,
      laborRate: effectiveLaborRate,
      laborBucketLabel: drywallLaborBucketLabel,
    }),
    pricingRecordId: `bps_national:${itemId}:${unit}`,
    productionStatus: average?.productionStatus || 'review_required',
    benchmarkLevel: 'component',
    benchmarkStageKey: benchmarkStageForScopeKey(itemId),
    benchmarkScopeKey: itemId,
    benchmarkAction: floorPrepReviewBeforeBid
      ? 'comparison_only'
      : 'price_ready',
    comparisonRange:
      materialRateSource === 'national_average' ||
      laborRateSource === 'national_average'
        ? planningComparisonRange(round2(material + labor))
        : undefined,
    pricingDetail:
      itemId === 'floor_demo'
        ? flooringDemoPricingDetail
        : itemId === 'floor_prep'
          ? floorPrepPricingDetail
          : itemId === 'ice_water_shield'
            ? 'Included: self-adhered waterproofing membrane; layout and installation; standard laps/seams; normal fastening/adhesion; typical localized roofing application.\n\nExcluded / separate where applicable: decking replacement; structural repair; extensive water-damage remediation; full-roof membrane systems; unusual access or specialty conditions.'
            : itemId === 'underlayment' &&
                String(templateKey || '').toLowerCase() === 'roofing'
              ? 'Incremental upgrade only. Standard roofing underlayment remains included in supported base Roofing systems.'
              : null,
    isComparison: floorPrepReviewBeforeBid || undefined,
  };
  if (
    itemId === 'framing' &&
    ['ground_up', 'framing'].includes(
      String(templateKey || '').toLowerCase()
    ) &&
    count > 0 &&
    unit === 'sqft'
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const comparable = resolveFramingShellPackageComparable(livingSf);
    if (comparable) {
      const reference = framingShellPackageBreakdownForProject(
        comparable.projectId,
        count
      );
      takeoffFill = {
        ...takeoffFill,
        helper: `${framingComparableHelper(comparable, count)} · blended with national average`,
        pricingDetail: [
          'Included package components — not additional charges',
          `Framing lumber/material: $${Math.round(reference.lumberMaterial).toLocaleString()}`,
          `Trusses: $${Math.round(reference.trusses).toLocaleString()}`,
          `Decks: $${Math.round(reference.decks).toLocaleString()}`,
          `Framing labor: $${Math.round(reference.labor).toLocaleString()}`,
          'Sheathing is included in the framing material package; it is not a second card.',
          `Reference package total: $${Math.round(reference.total).toLocaleString()}`,
        ].join('\n'),
      };
    }
  }
  if (
    itemId === 'plumbing_rough' &&
    ['ground_up', 'plumbing_service', 'plumbing'].includes(
      String(templateKey || '').toLowerCase()
    ) &&
    count > 0 &&
    unit === 'each'
  ) {
    const livingSf = parseScopeMeasurementInput(
      measurementsInput.floorAreaSqft
    );
    const comparable = resolvePlumbingPackageComparable(livingSf);
    if (comparable) {
      takeoffFill = {
        ...takeoffFill,
        helper: `${plumbingPackageComparableHelper(comparable)} · blended with national average`,
      };
    }
  }
  if (
    itemId === 'hvac' &&
    ['ground_up', 'hvac'].includes(String(templateKey || '').toLowerCase()) &&
    count > 0 &&
    unit === 'each'
  ) {
    const livingSf =
      parseScopeMeasurementInput(measurementsInput.floorAreaSqft) ||
      Number(
        measurementsInput.planFacts?.buildingAreas?.totalLivingSqft ??
          measurementsInput.planFacts?.totalLivingSqft
      ) ||
      null;
    const comparable = isSouthernUtahPricingLocation(pricingContext)
      ? resolveHvacPackageComparable(livingSf)
      : null;
    if (comparable) {
      takeoffFill = {
        ...takeoffFill,
        helper: `${hvacPackageComparableHelper(comparable)} · compare with national average below`,
        pricingDetail: [
          takeoffFill.pricingDetail,
          `${comparable.projectLabel} builder budget (H64) documents ~$${comparable.h64InstalledTotal.toLocaleString()} for the complete package on this plan size.`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      };
    }
  }
  // Comparison = pure national on the same qty/unit as fill (not living-SF stage lump).
  const nationalComparison =
    hasPhysicalTakeoffRates &&
    concreteThicknessMultiplier === 1 &&
    pricingLibraryTemplateMatch(template)
      ? buildPureNationalAverageComparisonBlock({
          itemId,
          basis: takeoffFill.basis,
          fillTotal: takeoffFill.total,
        })
      : null;
  const hvacPlanComparison =
    itemId === 'hvac'
      ? buildHvacPlanBarometerComparisonBlock({
          livingSf:
            parseScopeMeasurementInput(measurementsInput.floorAreaSqft) ||
            Number(
              measurementsInput.planFacts?.buildingAreas?.totalLivingSqft ??
                measurementsInput.planFacts?.totalLivingSqft
            ) ||
            null,
          fillTotal: takeoffFill.total,
          pricingContext,
        })
      : null;
  const comparisonBlock =
    nationalComparison ||
    (itemId === 'hvac' ? hvacPlanComparison : null);
  return withUserEnteredNationalBenchmarkFallback(
    itemId,
    rule,
    measurementsInput,
    resolved,
    templateKey,
    pricingContext,
    {
      fill: takeoffFill,
      comparison: comparisonBlock,
    },
    options
  );
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
  if (hasCompleteUserSelectedPricing(measurements.itemQuantities || {}, itemId))
    return resolved;

  let countEntry:
    | (NonNullable<ReturnType<typeof parseStoredItemQuantity>> & {
        quantitySource?: QuantitySource;
      })
    | null =
    resolved.dualCount ??
    (resolved.quantity != null &&
    resolved.unit === 'sqft' &&
    String(rule.defaultUnit || '').toLowerCase() !== 'each'
      ? {
          quantity: resolved.quantity,
          unit: 'sqft' as const,
          quantitySource: resolved.quantitySource || ('inferred' as const),
        }
      : null);

  if (
    countEntry &&
    String(countEntry.unit || '').toLowerCase() === 'sqft' &&
    String(rule.defaultUnit || '').toLowerCase() === 'each'
  ) {
    countEntry = null;
  }

  if (!countEntry && rule.measurementKey && measurements[rule.measurementKey]) {
    countEntry = {
      quantity: measurements[rule.measurementKey]!,
      unit: rule.defaultUnit,
      quantitySource: 'inferred',
    };
  }

  let materialEntry = parseStoredItemQuantity(
    measurements,
    `${itemId}__material`
  );
  let laborEntry = parseStoredItemQuantity(measurements, `${itemId}__labor`);
  let allowanceEntry = parseStoredItemQuantity(
    measurements,
    roughAllowanceSubKey(itemId)
  );

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
  if (!countEntry && Array.isArray(rule.measurementKeys)) {
    if (itemId === 'garage_doors') {
      const doors = rule.measurementKeys.reduce((sum, key) => {
        const value = Number(measurements[key]);
        return Number.isFinite(value) && value > 0 ? sum + value : sum;
      }, 0);
      if (doors > 0) {
        countEntry = {
          quantity: doors,
          unit: rule.defaultUnit,
          quantitySource: 'inferred',
        };
      }
    } else {
      const quantity = rule.measurementKeys
        .map(key => measurements[key])
        .find(value => value != null && value > 0);
      if (quantity) {
        countEntry = {
          quantity,
          unit: rule.defaultUnit,
          quantitySource: 'inferred',
        };
      }
    }
  }
  if (!countEntry && itemId === 'floor_demo' && measurements.floorAreaSqft) {
    countEntry = {
      quantity: measurements.floorAreaSqft,
      unit: rule.defaultUnit,
      quantitySource: 'inferred',
    };
  }

  const hydrated = withRatePricingHydratedFromNotes(
    measurements,
    itemId,
    notes,
    templateKey,
    countEntry
  );
  const allowanceEntry = parseStoredItemQuantity(
    hydrated,
    roughAllowanceSubKey(itemId)
  );

  // Legacy: single field saved as allowance/lump_sum on the main key
  const legacyAllowance =
    !allowanceEntry &&
    storedItemEntry &&
    ['allowance', 'lump_sum'].includes(storedItemEntry.unit || '')
      ? storedItemEntry
      : null;

  let { effectiveAllowance, materialEntry, laborEntry } =
    applyRatePricingBreakdown(
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
      itemId === 'plumbing_rough'
        ? 'rough-in points'
        : formatUnitLabel(countEntry.unit);
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
    summaryParts.push(
      `$${effectiveAllowance.quantity.toLocaleString()} allowance`
    );
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
      quantitySource === 'notes'
        ? sourceLabel('notes')
        : summaryParts.join(' · '),
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

  const sqft = Number(measurements.concreteSqft);
  if (!Number.isFinite(sqft) || sqft <= 0) return resolved;

  const stored = measurements.itemQuantities[itemId];
  if (
    stored?.quantitySource === 'user_entered' ||
    stored?.quantitySource === 'manual_override'
  ) {
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
    Math.abs(Number(resolved.quantity) - sqft) < 0.01
  ) {
    // Normalize string QM values (e.g. concreteSqft: '800') to numeric quantity.
    return {
      ...resolved,
      quantity: sqft,
      dualCount: resolved.dualCount
        ? { ...resolved.dualCount, quantity: sqft, unit: 'sqft' }
        : resolved.dualCount,
    };
  }

  return {
    ...resolved,
    quantity: sqft,
    unit: 'sqft',
    quantitySource:
      stored?.quantitySource === 'calculated_confirmed'
        ? 'calculated_confirmed'
        : 'inferred',
    sourceLabel:
      resolved.quantitySource === 'notes' || stored?.quantitySource === 'notes'
        ? 'Slab area · Calculated'
        : sourceLabel('inferred'),
    dualCount: resolved.dualCount
      ? { ...resolved.dualCount, quantity: sqft, unit: 'sqft' }
      : resolved.dualCount,
  };
}

const AUTO_DRYWALL_SURFACE_ITEM_IDS = new Set([
  'drywall',
  'hang',
  'finish_tape',
]);

/**
 * Ground-up: drop thin notes drywall SF (Plan 39 4,056 → $8.8k) and use the approved
 * living×3.5 surface qty so Confirm Scope defaults to ~$23k, not the wrong notes total.
 */
function applyAutoDrywallSurfaceQuantity(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  resolved: ResolvedItemQuantity,
  ctx: { templateKey?: string | null } = {}
): ResolvedItemQuantity {
  if (!AUTO_DRYWALL_SURFACE_ITEM_IDS.has(itemId)) return resolved;
  if (String(ctx.templateKey || '').toLowerCase() !== 'ground_up')
    return resolved;

  const stored = measurements.itemQuantities[itemId];
  if (
    stored?.quantitySource === 'user_entered' ||
    stored?.quantitySource === 'manual_override' ||
    hasDrywallSurfaceComponentTakeoff(
      measurements as unknown as Record<string, unknown>,
      { planFacts: measurements.planFacts }
    ) ||
    isProtectedDrywallQuantity(
      measurements as unknown as Record<string, unknown>,
      'drywallSqft'
    ) ||
    isProtectedDrywallQuantity(
      measurements as unknown as Record<string, unknown>,
      itemId
    )
  ) {
    return resolved;
  }

  const living = Number(measurements.floorAreaSqft);
  if (!Number.isFinite(living) || living <= 0) return resolved;

  const current = Number(resolved.quantity);
  const needsSurface =
    !Number.isFinite(current) ||
    current <= 0 ||
    resolved.unit !== 'sqft' ||
    isUndercountedDrywallSurface(current, living);
  if (!needsSurface) return resolved;

  // Same package SF fallback used by Quick Measurement, kept in the
  // canonical drywall convergence module.
  const garageSf = Number(measurements.garageSqft);
  const packageSf =
    drywallPackageSurfacePlanningQuantity(
      living,
      Number.isFinite(garageSf) && garageSf > 0
        ? garageSf
        : Number(
            measurements.planFacts?.buildingAreas?.garageSqft ?? 0
          ) || null
    ) ?? drywallSurfacePlanningQuantity(living);
  if (!(packageSf > 0)) return resolved;

  return {
    ...resolved,
    quantity: packageSf,
    unit: 'sqft',
    quantitySource:
      stored?.quantitySource === 'calculated_confirmed'
        ? 'calculated_confirmed'
        : 'inferred',
    sourceLabel: 'Calculated',
    dualCount: resolved.dualCount
      ? { ...resolved.dualCount, quantity: packageSf, unit: 'sqft' }
      : resolved.dualCount,
  };
}

/**
 * Ground-up framing: covered framed SF (living + garage) is a planning assumption —
 * same class as Suggest pricing. Do not leave pricingReady false (which shows an empty
 * on-card Area box) when plan measurements already supply living SF.
 */
function applyAutoFramingCoveredSfQuantity(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  resolved: ResolvedItemQuantity,
  ctx: { templateKey?: string | null } = {}
): ResolvedItemQuantity {
  if (itemId !== 'framing') return resolved;
  const template = String(ctx.templateKey || '').toLowerCase();
  if (template !== 'ground_up' && template !== 'framing') return resolved;

  const stored = measurements.itemQuantities[itemId];
  const storedBasis = parseStoredItemQuantity(
    measurements,
    allowanceSplitSubKey(itemId, 'sqft_basis')
  );
  if (
    stored?.quantitySource === 'user_entered' ||
    stored?.quantitySource === 'manual_override' ||
    storedBasis?.quantitySource === 'user_entered'
  ) {
    return resolved;
  }

  const living = Number(measurements.floorAreaSqft);
  if (!Number.isFinite(living) || living <= 0) return resolved;

  const garage = Number(measurements.garageSqft);
  const framedSf =
    living + (Number.isFinite(garage) && garage > 0 ? garage : 0);
  if (!(framedSf > 0)) return resolved;

  if (
    resolved.pricingReady &&
    resolved.quantity != null &&
    Math.abs(Number(resolved.quantity) - framedSf) < 0.51
  ) {
    return resolved;
  }

  const rule = getChecklistItemQuantityRule(itemId, ctx.templateKey);
  const quantitySource =
    stored?.quantitySource === 'calculated_confirmed'
      ? 'calculated_confirmed'
      : 'inferred';

  return {
    ...resolved,
    quantity: framedSf,
    unit: 'sqft',
    quantitySource,
    sourceLabel: sourceLabel(quantitySource),
    pricingReady: true,
    quantityHelper: rule?.quantityHelper ?? resolved.quantityHelper,
    showInput: true,
    dualCount: { quantity: framedSf, unit: 'sqft' },
  };
}

function resolvePlumbingCardQuickMeasurementQuantity(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  templateKey?: string | null
): ResolvedItemQuantity | null {
  if (
    !['plumbing', 'plumbing_service'].includes(
      String(templateKey || '').toLowerCase()
    )
  ) {
    return null;
  }
  const card = plumbingCardForItemId(itemId);
  if (!card) return null;
  const value = Number(measurements[card.measurementKey]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const sourceTag =
    measurements.measurementProvenance?.[card.measurementKey] != null
      ? 'plan_detected'
      : 'inferred';
  return {
    quantity: value,
    unit: card.unit,
    quantitySource: sourceTag,
    sourceLabel: 'Quick Measurements · Plan takeoff',
    pricingReady: true,
    showInput: true,
  };
}

function plumbingAppliedTotalAmount(
  itemId: string,
  itemQuantities: Record<string, ScopeItemQuantityLike> | undefined
): number | null {
  if (!itemQuantities) return null;
  const allowance = Number(
    String(itemQuantities[`${itemId}__allowance`]?.quantity ?? '').replace(
      /,/g,
      ''
    )
  );
  if (Number.isFinite(allowance) && allowance > 0) return allowance;
  const material = Number(
    String(itemQuantities[`${itemId}__material`]?.quantity ?? '').replace(
      /,/g,
      ''
    )
  );
  const labor = Number(
    String(itemQuantities[`${itemId}__labor`]?.quantity ?? '').replace(/,/g, '')
  );
  const splitTotal =
    (Number.isFinite(material) ? material : 0) +
    (Number.isFinite(labor) ? labor : 0);
  return splitTotal > 0 ? splitTotal : null;
}

function plumbingStoredQuantityLooksLikeDollarTotal(
  itemId: string,
  entry: { quantity?: unknown; unit?: string } | undefined,
  itemQuantities: Record<string, ScopeItemQuantityLike> | undefined
): boolean {
  const card = plumbingCardForItemId(itemId);
  if (!card || card.unit === 'allowance') return false;
  const qty = Number(String(entry?.quantity ?? '').replace(/,/g, ''));
  if (!Number.isFinite(qty) || qty <= 0) return false;
  const appliedTotal = plumbingAppliedTotalAmount(itemId, itemQuantities);
  if (appliedTotal != null && Math.abs(qty - appliedTotal) < 0.02) {
    return true;
  }
  return false;
}

function parseCustomScopeMoney(value: unknown): number {
  const amount = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export const CUSTOM_SCOPE_PRICING_UNITS = ['sqft', 'lf', 'cy'] as const;

export type CustomScopePricingUnit = (typeof CUSTOM_SCOPE_PRICING_UNITS)[number];

/** Physical quantity basis for custom scope — not lump-sum allowance. */
export function resolveCustomScopePricingUnit(
  unit: string | null | undefined
): CustomScopePricingUnit {
  if (unit === 'lf' || unit === 'cy') {
    return unit;
  }
  return 'sqft';
}

export function customScopePricingModeLabel(
  unit: CustomScopePricingUnit
): string {
  return `Use ${formatUnitLabel(unit)}`;
}

export function isCustomScopePricingApplied(
  itemId: string,
  pricingAcceptance?: Record<
    string,
    { selectionStatus?: string | null }
  > | null
): boolean {
  if (!String(itemId || '').startsWith('custom_')) return false;
  const status = pricingAcceptance?.[itemId]?.selectionStatus;
  return status === 'accepted' || status === 'manual_adjusted';
}

/** True when a stored custom-scope amount is a per-unit rate, not a job total. */
export function looksLikeCustomScopeUnitRate(
  value: number,
  basisQuantity: number
): boolean {
  return value > 0 && value <= 100 && value < basisQuantity;
}

function customScopeBasisQuantity(
  basisQuantity: number | null | undefined
): number | null {
  return Number.isFinite(basisQuantity) && Number(basisQuantity) > 1
    ? Number(basisQuantity)
    : null;
}

/** Convert stored mat/lab to job totals when the value is a per-unit rate. */
export function scaleCustomScopeStoredAmount(
  rawValue: unknown,
  basisQuantity: number | null | undefined
): number {
  const raw = parseCustomScopeMoney(rawValue);
  const basisQty = customScopeBasisQuantity(basisQuantity);
  if (!basisQty || raw <= 0) return raw;
  if (looksLikeCustomScopeUnitRate(raw, basisQty)) {
    return Math.round(raw * basisQty * 100) / 100;
  }
  return raw;
}

/** Rate shown in the editor — divides applied job totals back into $/unit. */
export function customScopeEditorRateValue(
  storedValue: unknown,
  basisQuantity: number | null | undefined
): string {
  const raw = parseCustomScopeMoney(storedValue);
  if (raw <= 0) return String(storedValue ?? '').replace(/,/g, '') || '';
  const basisQty = customScopeBasisQuantity(basisQuantity);
  if (!basisQty) return String(raw);
  if (looksLikeCustomScopeUnitRate(raw, basisQty)) return String(raw);
  return String(Math.round((raw / basisQty) * 100) / 100);
}

/** Job totals for custom scope — scales per-unit mat/lab by takeoff qty when present. */
export function resolveCustomScopeDraftPricing(params: {
  materialValue: unknown;
  laborValue: unknown;
  basisQuantity: number | null | undefined;
}): {
  material: number;
  labor: number;
  total: number;
  treatedAsRates: boolean;
} {
  const basisQty = customScopeBasisQuantity(params.basisQuantity);
  const rawMaterial = parseCustomScopeMoney(params.materialValue);
  const rawLabor = parseCustomScopeMoney(params.laborValue);
  const material = scaleCustomScopeStoredAmount(rawMaterial, basisQty);
  const labor = scaleCustomScopeStoredAmount(rawLabor, basisQty);
  const treatedAsRates = Boolean(
    basisQty &&
      ((rawMaterial > 0 && looksLikeCustomScopeUnitRate(rawMaterial, basisQty)) ||
        (rawLabor > 0 && looksLikeCustomScopeUnitRate(rawLabor, basisQty)))
  );
  return { material, labor, total: material + labor, treatedAsRates };
}

function resolveCustomScopeChecklistItemQuantity(
  itemId: string,
  measurements: NormalizedScopeMeasurements
): ResolvedItemQuantity {
  const itemInput = measurements.itemQuantities?.[itemId];
  const materialKey = `${itemId}__material`;
  const laborKey = `${itemId}__labor`;
  const storedUnit = itemInput?.unit;
  const basisQty = parseCustomScopeMoney(itemInput?.quantity);
  const scaled = resolveCustomScopeDraftPricing({
    materialValue: measurements.itemQuantities?.[materialKey]?.quantity,
    laborValue: measurements.itemQuantities?.[laborKey]?.quantity,
    basisQuantity: basisQty,
  });
  const materialAmount = scaled.material;
  const laborAmount = scaled.labor;
  const lumpTotal = materialAmount + laborAmount;
  const legacyLumpOnly =
    (storedUnit === 'allowance' || storedUnit === 'each') &&
    basisQty > 0 &&
    lumpTotal <= 0;
  const hasPricing = lumpTotal > 0 || legacyLumpOnly;
  const unit =
    storedUnit === 'each' || storedUnit === 'allowance'
      ? 'sqft'
      : resolveCustomScopePricingUnit(storedUnit);

  return {
    quantity: legacyLumpOnly && basisQty > 0 ? basisQty : null,
    unit: legacyLumpOnly ? 'allowance' : unit,
    quantitySource:
      itemInput?.quantitySource ||
      (basisQty > 0 || hasPricing ? 'user_entered' : 'missing'),
    sourceLabel: hasPricing ? 'User entered' : 'Needs pricing',
    pricingReady: hasPricing,
    showInput: true,
    dualCount:
      !legacyLumpOnly && basisQty > 0
        ? { quantity: basisQty, unit }
        : undefined,
    dualMaterial:
      materialAmount > 0
        ? { quantity: materialAmount, unit: 'allowance' }
        : undefined,
    dualLabor:
      laborAmount > 0 ? { quantity: laborAmount, unit: 'allowance' } : undefined,
    dualAllowance:
      legacyLumpOnly && basisQty > 0
        ? { quantity: basisQty, unit: 'allowance' }
        : undefined,
  };
}

function resolveChecklistItemQuantityCore(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  ctx: {
    choiceId?: string | null;
    templateKey?: string | null;
    notes?: string | null;
  } = {}
): ResolvedItemQuantity {
  const choiceId = ctx.choiceId ?? null;
  const explicitRule = getChecklistItemQuantityRule(itemId, ctx.templateKey);
  if (!explicitRule && String(itemId).startsWith('custom_')) {
    return resolveCustomScopeChecklistItemQuantity(itemId, measurements);
  }
  const rule = explicitRule ?? DEFAULT_SCOPE_ALLOWANCE_QUANTITY_RULE;

  const plumbingQuickMeasurement = resolvePlumbingCardQuickMeasurementQuantity(
    itemId,
    measurements,
    ctx.templateKey
  );
  if ((HVAC_EQUIPMENT_TYPE_SCOPE_ITEM_IDS as readonly string[]).includes(itemId)) {
    const typed =
      parseStoredItemQuantity(
        measurements,
        `equipment_replace__${itemId}`
      ) || parseStoredItemQuantity(measurements, itemId);
    const quantity =
      typed?.quantity != null ? Number(typed.quantity) : 1;
    if (Number.isFinite(quantity) && quantity > 0) {
      return applyPricingReadyFlags(
        {
          quantity,
          unit: 'each',
          quantitySource: typed?.quantitySource || 'user_entered',
          sourceLabel: 'HVAC equipment type · Confirm Scope',
          pricingReady: true,
          quantityHelper: rule.quantityHelper,
          showInput: true,
        },
        itemId,
        ctx
      );
    }
  }

  if (plumbingQuickMeasurement) {
    const override = measurements.itemQuantities[itemId];
    if (
      !override?.quantity ||
      plumbingStoredQuantityLooksLikeDollarTotal(
        itemId,
        override,
        measurements.itemQuantities
      )
    ) {
      return applyPricingReadyFlags(plumbingQuickMeasurement, itemId, ctx);
    }
    // LF line cards: Quick Measurements is authoritative when it disagrees with
    // a stale scope-card takeoff count (matches applied-pricing resync).
    const card = plumbingCardForItemId(itemId);
    if (card?.unit === 'lf') {
      const overrideQty = Number(
        String(override.quantity ?? '').replace(/,/g, '')
      );
      const qmQty = Number(plumbingQuickMeasurement.quantity);
      if (
        Number.isFinite(qmQty) &&
        qmQty > 0 &&
        (!Number.isFinite(overrideQty) || Math.abs(overrideQty - qmQty) > 0.01)
      ) {
        return applyPricingReadyFlags(plumbingQuickMeasurement, itemId, ctx);
      }
    }
  }

  const hasExplicitInsulationTakeoff =
    itemId === 'insulation' &&
    (Number(measurements.exteriorWallGrossSqft) > 0 ||
      Number(measurements.exteriorWallInsulationSqft) > 0 ||
      Number(measurements.atticInsulationSqft) > 0 ||
      Number(measurements.insulatedRoofDeckSqft) > 0 ||
      Number(measurements.openingDeductionSqft) > 0);
  if (
    itemId === 'insulation' &&
    Array.isArray(measurements.insulationAssemblies)
  ) {
    const assemblyRows = resolvedInsulationAssemblies(
      measurements as ScopeMeasurementsInputExtended
    );
    if (assemblyRows.length > 0) {
      const assemblySqft = assemblyRows.reduce((sum, row) => sum + row.sqft, 0);
      const hasWallAssembly = assemblyRows.some(
        row => row.location === 'exterior_wall'
      );
      const hasCeilingAssembly = assemblyRows.some(row =>
        ['attic_ceiling', 'roof_deck'].includes(String(row.location || ''))
      );
      return {
        quantity: assemblySqft,
        unit: 'sqft',
        quantitySource: 'inferred',
        sourceLabel: 'Insulation assemblies · plan takeoff',
        pricingReady: hasWallAssembly && hasCeilingAssembly,
        quantityHelper:
          hasWallAssembly && hasCeilingAssembly
            ? rule.quantityHelper
            : 'Add a confirmed attic/ceiling or roof-deck assembly before pricing this whole-house scope.',
        showInput: true,
      };
    }
  }
  if (hasExplicitInsulationTakeoff) {
    const hasWallTakeoff =
      Number(measurements.exteriorWallGrossSqft) > 0 ||
      Number(measurements.exteriorWallInsulationSqft) > 0;
    const atticSource = String(
      measurements.quickMeasurementSources?.atticInsulationSqft || ''
    );
    const atticIsSuggested =
      atticSource === 'calculated_from_components' ||
      atticSource === 'estimated_from_formula' ||
      atticSource === 'needs_confirmation';
    const hasCeilingBoundary =
      (Number(measurements.atticInsulationSqft) > 0 && !atticIsSuggested) ||
      Number(measurements.insulatedRoofDeckSqft) > 0;
    const envelopeInputs = insulationEnvelopeInputsFromPlanFacts(
      measurements.planFacts,
      Number(measurements.floorAreaSqft) || null,
      {
        ...(measurements as unknown as InsulationEnvelopeInputs),
        suppressAtticPlanningFallback: true,
        requireExplicitSurfaceTakeoff: true,
        allowConditionedAreaCeilingSuggestion: true,
        atticInsulationSqft: atticIsSuggested
          ? null
          : measurements.atticInsulationSqft,
      }
    );
    const hasSuggestedCeiling =
      atticIsSuggested ||
      (!hasCeilingBoundary &&
        Number(envelopeInputs.conditionedCeilingAreaSqft) > 0);
    const envelope = resolveInsulationEnvelopePlanningQuantity(envelopeInputs);
    if (envelope?.totalInsulationEnvelopeSqft > 0) {
      return {
        quantity: envelope.totalInsulationEnvelopeSqft,
        unit: 'sqft',
        quantitySource: 'inferred',
        sourceLabel:
          hasWallTakeoff && hasCeilingBoundary
            ? 'Whole-house insulation · plan takeoff'
            : hasWallTakeoff && hasSuggestedCeiling
              ? 'Calculated conditioned ceiling area · confirm'
              : 'Partial insulation takeoff · ceiling boundary required',
        pricingReady: hasWallTakeoff && hasCeilingBoundary,
        quantityHelper:
          hasWallTakeoff && hasCeilingBoundary
            ? rule.quantityHelper
            : hasWallTakeoff && hasSuggestedCeiling
              ? 'Calculated from conditioned main + upper floor areas; confirm vaulted, open-to-below, or roof-deck areas.'
              : 'Add attic/ceiling or insulated roof-deck SF before pricing this whole-house scope.',
        showInput: true,
      };
    }
  }

  if (
    itemId === 'roofing_system' &&
    String(ctx.templateKey || '').toLowerCase() === 'roofing' &&
    choiceId &&
    !['not_in_scope', 'unsure'].includes(choiceId) &&
    Number(measurements.roofSquares) > 0
  ) {
    return {
      quantity: Number(measurements.roofSquares),
      unit: 'squares',
      quantitySource: 'inferred',
      sourceLabel: 'Roof squares · Quick Measurements',
      pricingReady: true,
      quantityHelper: 'Roof squares feed the selected primary roofing system.',
      showInput: false,
    };
  }

  if (
    itemId === 'underlayment' &&
    String(ctx.templateKey || '').toLowerCase() === 'roofing' &&
    Number(measurements.roofAreaSqft) > 0
  ) {
    return {
      quantity: Number(measurements.roofAreaSqft),
      unit: 'sqft',
      quantitySource: 'inferred',
      sourceLabel: 'Roofing underlayment area · Quick Measurements',
      pricingReady: true,
      quantityHelper: 'Roofing underlayment uses the entered roof area.',
      showInput: false,
    };
  }

  if (
    itemId === 'ice_water_shield' &&
    String(ctx.templateKey || '').toLowerCase() === 'roofing' &&
    Number(measurements.roofIceWaterShieldSqft) > 0
  ) {
    return {
      quantity: Number(measurements.roofIceWaterShieldSqft),
      unit: 'sqft',
      quantitySource: 'inferred',
      sourceLabel: 'Ice & water shield area · Quick Measurements',
      pricingReady: true,
      quantityHelper:
        'Ice & water shield uses only the dedicated measured protection area.',
      showInput: false,
    };
  }

  if (
    itemId === 'concrete' &&
    String(ctx.templateKey || '').toLowerCase() === 'landscaping' &&
    measurements.concreteEdgingLf != null &&
    measurements.concreteEdgingLf > 0
  ) {
    return {
      quantity: measurements.concreteEdgingLf,
      unit: 'lf',
      quantitySource: 'user_entered',
      sourceLabel: 'User-entered concrete edging LF',
      pricingReady: true,
      showInput: true,
    };
  }

  if (
    rule.choiceIds?.length &&
    choiceId &&
    !rule.choiceIds.includes(choiceId)
  ) {
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
    ['tub', 'prefab', 'tile_pan', 'staying', 'not_in_scope', 'unsure'].includes(
      choiceId
    )
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

  const linkedCountertop = resolveLinkedCountertopAllowance(
    itemId,
    measurements,
    ctx.notes
  );
  if (linkedCountertop) return linkedCountertop;

  // Landscaping QM values are the contractor's current takeoff and must win
  // over an older or broader notes allowance.
  if (String(ctx.templateKey || '').toLowerCase() === 'landscaping') {
    const landscapingMeasurementKeys = rule.measurementKey
      ? [rule.measurementKey]
      : rule.measurementKeys || [];
    for (const key of landscapingMeasurementKeys) {
      // General yard coverage from notes is not scope-specific QM input.
      if (key === 'landscapeSqft' || key === 'floorAreaSqft') continue;
      const value = Number(measurements[key]);
      if (Number.isFinite(value) && value > 0) {
        return applyPricingReadyFlags(
          {
            quantity: value,
            unit: measurementUnitForKey(key, rule.defaultUnit),
            quantitySource: 'user_entered',
            sourceLabel: 'User-entered Quick Measurement',
            pricingReady: true,
            quantityHelper: rule.quantityHelper,
            showInput: true,
          },
          itemId,
          ctx
        );
      }
    }
  }

  // Concrete QM values are the contractor's current takeoff and must win
  // over notes-derived allowances.
  if (String(ctx.templateKey || '').toLowerCase() === 'concrete') {
    if (
      itemId === 'demo_removal' &&
      measurements.concreteDemoThicknessBand === 'structural_7_plus' &&
      measurements.concreteDemoCy != null &&
      measurements.concreteDemoCy > 0
    ) {
      return applyPricingReadyFlags(
        {
          quantity: measurements.concreteDemoCy,
          unit: 'cy',
          quantitySource: 'user_entered',
          sourceLabel: 'User-entered heavy structural demolition CY',
          pricingReady: true,
          quantityHelper: rule.quantityHelper,
          showInput: true,
        },
        itemId,
        ctx
      );
    }
    if (
      itemId === 'excavation' &&
      measurements.excavationAreaSqft != null &&
      measurements.excavationDepthInches != null &&
      measurements.excavationAreaSqft > 0 &&
      measurements.excavationDepthInches > 0
    ) {
      const derivedCy = round2(
        (measurements.excavationAreaSqft *
          (measurements.excavationDepthInches / 12)) /
          27
      );
      return applyPricingReadyFlags(
        {
          quantity: derivedCy,
          unit: 'cy',
          quantitySource: 'calculated_confirmed',
          sourceLabel: 'Calculated from area × excavation depth',
          pricingReady: true,
          quantityHelper: rule.quantityHelper,
          showInput: true,
        },
        itemId,
        ctx
      );
    }
    const concreteMeasurementKeys = rule.measurementKey
      ? [rule.measurementKey]
      : rule.measurementKeys || [];
    for (const key of concreteMeasurementKeys) {
      if (
        key === 'floorAreaSqft' ||
        key === 'deckSqft' ||
        key === 'drywallSqft' ||
        key === 'landscapeSqft'
      ) {
        continue;
      }
      const value = Number(measurements[key]);
      if (Number.isFinite(value) && value > 0) {
        return applyPricingReadyFlags(
          {
            quantity: value,
            unit: measurementUnitForKey(key, rule.defaultUnit),
            quantitySource: 'user_entered',
            sourceLabel: 'User-entered Quick Measurement',
            pricingReady: true,
            quantityHelper: rule.quantityHelper,
            showInput: true,
          },
          itemId,
          ctx
        );
      }
    }
  }

  // Stucco system/component cards use the net wall takeoff as their shared
  // surface basis. Keep this linked to Quick Measurements instead of the
  // separate itemQuantities editor, whose initial placeholder can be zero.
  if (
    String(ctx.templateKey || '').toLowerCase() === 'stucco' &&
    itemId === 'stucco' &&
    choiceId === 'repair_restucco' &&
    Number(measurements.stuccoRepairAffectedSqft) > 0
  ) {
    return {
      quantity: Number(measurements.stuccoRepairAffectedSqft),
      unit: 'sqft',
      quantitySource: 'inferred',
      sourceLabel: 'Affected repair area · Quick Measurements',
      pricingReady: true,
      quantityHelper:
        'Enter affected repair SF only; choose repair severity below.',
      showInput: true,
    };
  }

  if (
    String(ctx.templateKey || '').toLowerCase() === 'stucco' &&
    choiceId !== 'repair_restucco' &&
    [
      'stucco',
      'stucco_wrb',
      'stucco_lath',
      'stucco_base_coat',
      'stucco_finish_coat',
    ].includes(itemId) &&
    Number(measurements.stuccoNetWallSqft) > 0 &&
    !(
      measurements.itemQuantities?.[itemId]?.quantitySource &&
      EXPLICIT_ITEM_QUANTITY_SOURCES.has(
        measurements.itemQuantities[itemId].quantitySource || 'user_entered'
      )
    )
  ) {
    return applyPricingReadyFlags(
      {
        quantity: Number(measurements.stuccoNetWallSqft),
        unit: 'sqft',
        quantitySource: 'inferred',
        sourceLabel: 'Net stucco wall area · Quick Measurements',
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
      },
      itemId,
      ctx
    );
  }

  const override = measurements.itemQuantities[itemId];
  const explicitOverride = explicitItemQuantityOverride(
    measurements,
    itemId,
    rule,
    ctx
  );
  if (explicitOverride) return explicitOverride;

  if (
    !rule.dualAllowanceField &&
    override?.quantitySource !== 'user_entered' &&
    ctx.notes?.trim()
  ) {
    const parsedAllowance = parseScopeItemAllowancesFromNotes(ctx.notes, {
      templateKey: ctx.templateKey ?? undefined,
    })[itemId];
    if (parsedAllowance?.quantity && Number(parsedAllowance.quantity) > 0) {
      const includesCountertops =
        Boolean(parsedAllowance.includesCountertops) ||
        (itemId === 'cabinets' && notesHaveCombinedCabinetsCounters(ctx.notes));
      const combinedCabinetsCounters =
        itemId === 'cabinets' && includesCountertops;
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
  } else {
    const allowanceSplit = resolveStoredAllowanceSplitQuantity(
      itemId,
      measurements,
      rule,
      override
    );
    if (allowanceSplit) return allowanceSplit;
  }

  if (
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
      unit: normalizedOverrideUnitForRule(
        itemId,
        ctx.templateKey,
        override.unit,
        rule
      ),
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
        sourceLabel: aggregatedMeasurementSourceLabel(
          agg.parts,
          rule.aggregateMeasurementKeys
        ),
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
      };
    }
  }

  for (const key of rule.measurementKeys ||
    (rule.measurementKey ? [rule.measurementKey] : [])) {
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
      const card = plumbingCardForItemId(itemId);
      if (
        card &&
        card.measurementKey === key &&
        plumbingStoredQuantityLooksLikeDollarTotal(
          itemId,
          { quantity: val, unit: card.unit },
          measurements.itemQuantities
        )
      ) {
        continue;
      }
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

  if (itemId === 'glass_door') {
    const explicitDoors =
      measurements.showerDoorCount != null &&
      Number(measurements.showerDoorCount) > 0
        ? Math.round(Number(measurements.showerDoorCount))
        : null;
    const tile =
      measurements.bathCount != null && Number(measurements.bathCount) > 0
        ? Math.round(Number(measurements.bathCount))
        : 0;
    const prefab =
      measurements.prefabBathCount != null &&
      Number(measurements.prefabBathCount) > 0
        ? Math.round(Number(measurements.prefabBathCount))
        : 0;
    const inferred = tile + prefab > 0 ? tile + prefab : null;
    const doors = explicitDoors ?? inferred;
    if (doors != null) {
      return {
        quantity: doors,
        unit: 'each',
        quantitySource: explicitDoors != null ? 'user_entered' : 'inferred',
        sourceLabel:
          explicitDoors != null
            ? sourceLabel('user_entered')
            : 'From tile + prefab baths',
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
      };
    }
  }

  if (itemId === 'garage_doors') {
    const counts = {
      single: measurements.garageDoorSingleCount ?? 0,
      double: measurements.garageDoorDoubleCount ?? 0,
      rv: measurements.garageDoorRvCount ?? 0,
    };
    const doors = totalGarageDoorCount(counts);
    if (doors > 0) {
      return {
        quantity: doors,
        unit: 'each',
        quantitySource: 'user_entered',
        sourceLabel: sourceLabel('user_entered'),
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
        dualCount: { quantity: doors, unit: 'each' },
      };
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

  const allowanceSplitFallback = resolveStoredAllowanceSplitQuantity(
    itemId,
    measurements,
    rule,
    override
  );
  if (allowanceSplitFallback) return allowanceSplitFallback;

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
  ctx: {
    choiceId?: string | null;
    templateKey?: string | null;
    notes?: string | null;
  } = {}
): ResolvedItemQuantity {
  const resolved = applyAutoDrywallSurfaceQuantity(
    itemId,
    measurements,
    applyAutoFramingCoveredSfQuantity(
      itemId,
      measurements,
      applyAutoFlatworkSqftPricingQuantity(
        itemId,
        measurements,
        resolveChecklistItemQuantityCore(itemId, measurements, ctx)
      ),
      ctx
    ),
    ctx
  );
  if (isGarageDoorsCountScopeItemId(itemId)) {
    const garageCount =
      itemId === 'garage_door_openers'
        ? Number(measurements.garageDoorOpenerCount)
        : (Number(measurements.garageDoorSingleCount) || 0) +
          (Number(measurements.garageDoorDoubleCount) || 0) +
          (Number(measurements.garageDoorRvCount) || 0);
    if (Number.isFinite(garageCount) && garageCount > 0) {
      return {
        ...resolved,
        quantity: garageCount,
        unit: 'each',
        dualCount: { quantity: garageCount, unit: 'each' },
        pricingReady: true,
      };
    }
    return resolved;
  }
  if (itemId === 'trim_finish') {
    const choiceId = String(ctx.choiceId || '');
    if (
      !choiceId ||
      choiceId === 'not_in_scope' ||
      choiceId === 'unsure'
    ) {
      return resolved;
    }
    const manualLf = Number(measurements.trimFinishLf);
    const fromItem = Number(
      (
        measurements.itemQuantities as
          | Record<string, { quantity?: unknown } | undefined>
          | undefined
      )?.trim_finish?.quantity
    );
    const derived = deriveTrimFinishLfFromMeasurements(
      measurements as Record<string, unknown>,
      choiceId
    );
    const lf =
      Number.isFinite(manualLf) && manualLf > 0
        ? manualLf
        : Number.isFinite(fromItem) && fromItem > 0
          ? fromItem
          : derived;
    if (lf != null && lf > 0) {
      return {
        ...resolved,
        quantity: lf,
        unit: 'lf',
        dualCount: { quantity: lf, unit: 'lf' },
        pricingReady: true,
        quantitySource:
          lf === derived ? 'inferred' : resolved.quantitySource ?? 'user_entered',
      };
    }
    return {
      ...resolved,
      quantity: null,
      unit: 'lf',
      dualCount: undefined,
      quantitySource: 'missing',
      pricingReady: false,
    };
  }
  if (!isWindowsDoorsCountScopeItemId(itemId)) return resolved;
  const openingCount =
    itemId === 'exterior_doors'
      ? Number(measurements.exteriorDoorCount)
      : itemId === 'sliding_doors'
        ? Number(measurements.slidingDoorCount)
        : itemId === 'interior_doors'
          ? Number(measurements.interiorDoorCount)
          : itemId === 'windows_doors'
            ? (Number(measurements.windowCount) || 0) +
              (Number(measurements.exteriorDoorCount) || 0) +
              (Number(measurements.slidingDoorCount) || 0) +
              (Number(measurements.interiorDoorCount) || 0)
            : Number(measurements.windowCount);
  if (Number.isFinite(openingCount) && openingCount > 0) {
    return {
      ...resolved,
      quantity: openingCount,
      unit: 'each',
      dualCount: { quantity: openingCount, unit: 'each' },
      pricingReady: true,
      quantitySource:
        resolved.quantitySource === 'missing'
          ? 'inferred'
          : resolved.quantitySource,
    };
  }
  if (
    resolved.quantity != null &&
    resolved.quantity > 0 &&
    String(resolved.unit || '').toLowerCase() !== 'sqft'
  ) {
    return {
      ...resolved,
      unit: 'each',
      dualCount: { quantity: resolved.quantity, unit: 'each' },
    };
  }
  return {
    ...resolved,
    quantity: null,
    unit: 'each',
    dualCount: undefined,
    quantitySource: 'missing',
    pricingReady: false,
  };
}

/** Package name patterns → checklist quantity rule key (mirrors backend catalog).
 * Order matters: specific trade+action rows MUST win before broad word matchers,
 * or unrelated Step 3 packages inherit the wrong LF/sqft and national rates
 * (same class of bug as cabinet hardware / appliance reinstall → cabinets).
 */
const PACKAGE_NAME_TO_RULE_KEY: Array<{ test: RegExp; key: string }> = [
  { test: /\bbath(?:room)?\s+demo\b|\bdemo\b.*\bbath/i, key: 'demo' },
  // Flooring / tile demo before any install matcher (carpet alone used to → flooring $).
  // Flooring demo — bare "tile" must not match tub surround / shower wall tear-out.
  {
    test: /\b(carpet|lvp|laminate|vinyl|flooring|floor(?:\s+tile)?|tile\s+floor)\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,40}\b(carpet|lvp|laminate|vinyl|flooring|floor(?:\s+tile)?|tile\s+floor)\b/i,
    key: 'floor_demo',
  },
  {
    test: /\b(?:floor\s+tile|tile\s+floor)\s+(?:demo|demolition|removal)\b|\bfloor\s+tile\s+demo/i,
    key: 'floor_demo',
  },
  { test: /\bfloor\s+demo|\bflooring\s+demo/i, key: 'floor_demo' },
  {
    test: /\btile\s+removal\b|\bremove\s+existing\s+tile\b/i,
    key: 'floor_demo',
  },
  {
    test: /\b(lvp|laminate|vinyl|carpet|flooring)\b.*\b(install|installation)\b|\b(install|installation)\b.*\b(lvp|laminate|vinyl|carpet|flooring)\b/i,
    key: 'flooring',
  },
  { test: /\b(lvp|laminate|vinyl)\b|\bflooring\s+install/i, key: 'flooring' },
  {
    test: /\bshower\s+floor\s+tile|\btile\s+shower\s+floor/i,
    key: 'shower_floor_tile',
  },
  {
    test: /\bshower\s+tile\s+install(?:ation)?\b|\bshower\s+tile\b(?!\s*(?:demo|removal|tear))/i,
    key: 'shower_tile',
  },
  {
    test: /\bprefab\s+shower\s+pan|\bshower\s+pan\s+install/i,
    key: 'prefab_shower_pan',
  },
  { test: /\btile\s+shower\s+pan|\bmud\s+pan/i, key: 'shower_pan' },
  { test: /\bshower\s+pan|\btile\s+pan/i, key: 'shower_pan' },
  // Tub demo before tub install (bare "bathtub" used to → tub_install).
  {
    test: /\b(tub|bathtub)\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,40}\b(tub|bathtub)\b/i,
    key: 'tub_demo',
  },
  {
    test: /\bvanity\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,40}\bvanity\b|\bremove\s+existing\s+vanity\b/i,
    key: 'vanity_demo',
  },
  {
    test: /\b(countertops?|counters?)\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,40}\b(countertops?|counters?)\b/i,
    key: 'countertop_demo',
  },
  {
    test: /\btub\s+install|\btub\s+installation|\b(?:new\s+)?bathtub\s+install/i,
    key: 'tub_install',
  },
  { test: /\bshower\s+niche\b/i, key: 'shower_niche' },
  { test: /\bshower\s+bench\b/i, key: 'shower_bench' },
  { test: /\bshower\s+curb\b/i, key: 'shower_pan' },
  { test: /\bshower\s+bench\b|\bshower\s+curb\b/i, key: 'shower_bench_curb' },
  // HVAC ventilation before bath exhaust fan.
  {
    test: /\b(hvac|furnace|duct|mechanical)\b[^.]{0,40}\bventilation\b|\bventilation\b[^.]{0,40}\b(hvac|duct|mechanical)\b/i,
    key: 'ventilation',
  },
  {
    test: /\bexhaust\s+fan\b|\bbath(?:room)?\s+fan\b|\bbath(?:room)?\s+ventilation\b/i,
    key: 'exhaust_fan',
  },
  {
    test: /\bmirror\b|\btowel\s+bar\b|\bbath(?:room)?\s+accessories\b/i,
    key: 'mirror_accessories',
  },
  // Roof underlayment before floor_prep (shared "underlayment" word).
  {
    test: /\b(roof|shingle|ice\s*(?:&|and)\s*water|felt|synthetic)\b[^.]{0,40}\bunderlayment\b|\bunderlayment\b[^.]{0,40}\b(roof|shingle|ice\s*(?:&|and)\s*water)\b|\bice\s*(?:&|and)\s*water\b/i,
    key: 'underlayment',
  },
  {
    test: /\bfloor\s+prep\b|\bsubfloor\b|\bfloor\s+underlayment\b/i,
    key: 'floor_prep',
  },
  { test: /\bback\s*splash/i, key: 'backsplash' },
  // Specific kitchen lines must win before the broad cabinet matcher —
  // otherwise "Cabinet hardware" and scope text like "after cabinets" steal
  // cabinet LF + national cabinet rates ($150+$75).
  {
    test: /\bcabinet\s*hardware\b|\bhardware\b.*\b(?:pulls?|knobs?)\b|\bpulls?\s*(?:&|and|,)?\s*knobs?\b/i,
    key: 'cabinet_hardware',
  },
  {
    test: /\bappliance\s*removal\b|\bremove\s+(?:existing\s+)?appliances?\b/i,
    key: 'appliance_removal',
  },
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
  {
    test: /\bkitchen\s+island\b|\bisland\b.*\bcabinet|\bcabinet\b.*\bisland\b/i,
    key: 'island',
  },
  {
    test: /\bcabinets?\s*(?:&|and|\/)\s*counters?|\bcounters?\s*(?:&|and|\/)\s*cabinets?/i,
    key: 'cabinets_counters',
  },
  // Real cabinet install only — not "after cabinets" incidental mentions in other scopes.
  {
    test: /(?<!after\s)(?<!before\s)\b(?:new\s+)?cabinets?\b(?!\s*hardware)/i,
    key: 'cabinets',
  },
  // Countertop demo before countertop install rates.
  {
    test: /\bcountertops?\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out)\b[^.]{0,40}\bcountertops?\b/i,
    key: 'demo',
  },
  // "Counters" (ground-up package label) must map here — `\bcountertop` alone misses it,
  // so Step 3 fell through to kitchen $/living-SF rates (~$55+$95 × living SF).
  {
    test: /\bcounters?\b|\bcounter\s*tops?\b|\bcountertop/i,
    key: 'countertops',
  },
  // Legacy bundled kitchen package labels stay on sink_faucet before bare disposal matching.
  {
    test: /\bsink\b[^.]{0,50}\b(?:faucet|disposal)\b|\bfaucet\b[^.]{0,50}\bdisposal\b/i,
    key: 'sink_faucet',
  },
  // Jobsite/cleanup disposal — not kitchen garbage disposal fixture.
  {
    test: /\b(?:cleanup|final\s+clean|jobsite\s+clean|haul[\s-]?off|dumpster|debris|trash)\b[^.]{0,50}\bdisposal\b|\bdisposal\b[^.]{0,50}\b(?:cleanup|haul|dumpster|debris|trash)\b/i,
    key: 'cleanup',
  },
  // Garbage disposal before sink/faucet — bare "disposal" must not map to cleanup $.
  { test: /\bgarbage\s+disposal\b|\bdisposals?\b/i, key: 'garbage_disposal' },
  { test: /\bsink\b|\bfaucet\b|\bsink[,\s]+faucet/i, key: 'sink_faucet' },
  {
    test: /\bplans?\s*(?:&|and|\/|,)?\s*engineering|\bengineering\s*(?:&|and|\/|,)?\s*plans?/i,
    key: 'plans_engineering',
  },
  { test: /\bcontingenc/i, key: 'contingency' },
  { test: /\bfinal\s+inspection/i, key: 'final_inspections' },
  { test: /\bmobiliz|\bjob\s+setup/i, key: 'mobilization' },
  {
    test: /\bemergency\s*(?:fee|call|service)|\bafter[\s-]?hours\s+fee/i,
    key: 'emergency_fee',
  },
  { test: /\bsurvey\b/i, key: 'survey' },
  { test: /\bgeneral\s+conditions/i, key: 'general_conditions' },
  { test: /\bsupervision|\bsuperintend/i, key: 'supervision' },
  {
    test: /\boverhead\s*(?:&|and|\/)?\s*profit|\bprofit\s*(?:&|and|\/)?\s*overhead/i,
    key: 'overhead_profit',
  },
  { test: /\brock|\bgravel/i, key: 'rock' },
  { test: /\bmulch\b/i, key: 'mulch' },
  { test: /\bplant|\bshrub/i, key: 'plants' },
  { test: /\btree\b/i, key: 'trees' },
  {
    test: /\b(?:artificial|fake|synthetic)\s+(?:grass|turf)\b|\bturf\b/i,
    key: 'artificial_turf',
  },
  { test: /\bsod\b|\bnatural\s+grass\b/i, key: 'sod_turf' },
  { test: /\bpaver/i, key: 'pavers' },
  // Before flatwork: landscaping helpers say "Not driveway flatwork" and used to steal $8.5k.
  {
    test: /\blandscap|\bsite\s+walls?\b|\bfences?\s*(?:&|and|\/)\s*gates?\b/i,
    key: 'landscaping',
  },
  {
    test: /\bexterior\s+concrete\s+flatwork\b|\b(flatwork|slab\s+pour|concrete\s+patio|patio\s+concrete|driveway|sidewalk)\b/i,
    key: 'pour_flatwork',
  },
  {
    test: /\bfootings?\b|\bpiers?\b|\bfoundation\s+pour\b/i,
    key: 'pour_foundation',
  },
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
  {
    test: /\bshower\s+wall\s+tile\b|\bshower\b[^.]{0,30}\bwall\b[^.]{0,20}\btile\b|\btile\b[^.]{0,30}\bshower\s+wall\b/i,
    key: 'shower_tile',
  },
  { test: /\bwet\s+area\s+install\b/i, key: 'wet_area_install' },
  { test: /\bwaterproof|\bbacker\s+board/i, key: 'waterproofing' },
  // Ground-up "Tile & flooring" must not fall through unmapped (or map to bath floor_tile).
  {
    test: /\btile\s*(?:&|and|\/)\s*flooring\b|\btile\s+flooring\b|\bflooring\s+tile\b/i,
    key: 'tile_flooring',
  },
  {
    test: /\bbath(?:room)?\s+floor\s+tile\b|\bfloor\s+tile\b|\btile\s+floor\b/i,
    key: 'floor_tile',
  },
  { test: /\btile\s+install(?:ation)?\b/i, key: 'floor_tile' },
  { test: /\bvanity\b/i, key: 'vanity' },
  // Fixture trim-out labels mention "toilet" as scope — must not map to the toilet choice card.
  {
    test: /\bplumbing\s+fixtures?\b|\bplumb(?:ing)?\s+fixtures?\s+&\s*trim|\bfixture\s+hookups?\b/i,
    key: 'plumbing_trim',
  },
  { test: /\btoilet\b/i, key: 'toilet' },
  // Framing hardware before framing $/sqft.
  {
    test: /\b(framing|structural|connector|fastener|hurricane|simpson)\b[^.]{0,40}\bhardware\b|\bhardware\b[^.]{0,40}\b(connector|framing|structural|fastener)\b/i,
    key: 'hardware',
  },
  { test: /\bframing\b(?!\s*hardware)|\bshell\b/i, key: 'framing' },
  {
    test: /\bhvac\b|\bheat(?:ing)?\s*(?:&|and)?\s*air|\bfurnace|\bmini[\s-]?split/i,
    key: 'hvac',
  },
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
  {
    test: /\btear[\s-]?off\b|\bremove\b[^.]{0,30}\bshingles?\b/i,
    key: 'tear_off',
  },
  {
    test: /\broof(?:ing)?\s*(?:\/\s*)?tie[\s-]?in\b|\btie[\s-]?in\b[^.]{0,30}\broof\b/i,
    key: 'roof_tie_in',
  },
  {
    test: /\bshingles?\b[^.]{0,40}\b(install|installation|replace)\b|\broof(?:ing)?\b[^.]{0,40}\b(install|installation|replace)\b|\bshingle\b|\broof(?:ing)?\b/i,
    key: 'shingles_roofing',
  },
  // Shower/glass door BEFORE bare window/door (was stealing glass_door → windows_doors).
  {
    test: /\bshower\s+doors?\s*(?:&|and)\s*mirrors?\b|\bshower\s+door\b|\bglass\s+(?:shower\s+)?door\b|\bshower\s+enclosure\b|\bglass\s+door\b/i,
    key: 'glass_door',
  },
  { test: /\bgarage\s+doors?\b/i, key: 'garage_doors' },
  {
    test: /\b(?:sliding|patio)\s+doors?\b|\bsliders?\b/i,
    key: 'sliding_doors',
  },
  { test: /\b(?:exterior|entry|iron)\s+doors?\b/i, key: 'exterior_doors' },
  // Combined legacy label before bare "windows".
  { test: /\bwindows?\s*(?:&|and|\/)\s*doors?\b/i, key: 'windows_doors' },
  {
    test: /\btrim\s*&?\s*finish\b|\b(?:window|door)\s+casing\b|\bstool\s*(?:\/|and)?\s*apron\b/i,
    key: 'trim_finish',
  },
  { test: /\bwindows?\b/i, key: 'windows' },
  { test: /\b(?:interior|french)\s+doors?\b|\bdoor\b/i, key: 'windows_doors' },
  { test: /\bplant|\bshrub/i, key: 'plants' },
  { test: /\btree\b/i, key: 'trees' },
  { test: /\bfoundation\b/i, key: 'pour_foundation' },
  {
    test: /\bplumb.*\brough|\brough[\s-]?in\b.*\bplumb/i,
    key: 'plumbing_rough',
  },
  // Before electrical_rough — "Electrical fixtures" is electrical_trim ($4k), not rough-in.
  {
    test: /\belectrical\s+fixtures?\b|\belectrical\s+trim\b|\bdevices?.*\bplates?\b/i,
    key: 'electrical_trim',
  },
  {
    test: /\belectrical\s+rough|\brough[\s-]?in\b.*\belectrical|\bnew\s+circuits?\b/i,
    key: 'electrical_rough',
  },
  { test: /\blight(?:ing)?\s+fix|\bfixture.*\blight/i, key: 'lighting' },
  // Drywall hang/finish/patch before bare drywall/patch.
  {
    test: /\bhang\b[^.]{0,30}\bdrywall\b|\bdrywall\b[^.]{0,30}\bhang\b/i,
    key: 'hang',
  },
  {
    test: /\b(tape|mud|finish)\b[^.]{0,30}\bdrywall\b|\bdrywall\b[^.]{0,30}\b(tape|mud|finish)\b/i,
    key: 'finish_tape',
  },
  { test: /\bdrywall\b[^.]{0,40}\b(repair|patch)/i, key: 'patch_repair' },
  {
    test: /\bpatch\b[^.]{0,30}\b(drywall|sheetrock|gypsum)\b|\b(drywall|sheetrock)\b[^.]{0,30}\bpatch\b/i,
    key: 'patch_repair',
  },
  { test: /\bdrywall\b/i, key: 'drywall' },
  // Exterior/interior must win over the generic paint key so Confirm Scope rates
  // for interior paint are not copied onto an "add exterior painting" package.
  // Stucco+paint must win before bare stucco install.
  {
    test: /\bexterior[\s-]*(?:paint|painting)\b|\b(?:paint|painting)[\s-]*exterior\b|\b(siding|stucco|soffit|fascia)\b[^.]{0,30}\b(?:paint|painting)\b/i,
    key: 'exterior_paint',
  },
  // "Stucco / exterior wall finish" — without this, Step 3 used exterior trade $7+$9 × living SF.
  { test: /\bstucco\b/i, key: 'stucco' },
  // Painting Step 3 split rows — must map before generic paint / site-walls landscaping.
  { test: /^walls?$/i, key: 'interior_paint' },
  { test: /^ceilings?$/i, key: 'ceiling_paint' },
  { test: /^prep\s*(?:&|and)\s*masking$/i, key: 'prep' },
  { test: /^exterior\s+prep(?:\s*(?:&|and)\s*masking)?$/i, key: 'exterior_prep' },
  { test: /^trim$/i, key: 'trim_paint' },
  {
    test: /\bbaseboards?\b[^.]{0,40}\btrim\b|\btrim\b[^.]{0,40}\b(?:molding|baseboard)\b|\bpainted?\s+trim\b/i,
    key: 'trim_paint',
  },
  {
    test: /\binterior[\s-]*(?:paint|painting)\b|\b(?:paint|painting)[\s-]*interior\b|\bceiling\b[^.]{0,20}\b(?:paint|painting)\b/i,
    key: 'interior_paint',
  },
  {
    test: /\btrim\b[^.]{0,30}\b(?:paint|painting)\b|\b(?:paint|painting)\b[^.]{0,30}\btrim\b|\bdoors?\b[^.]{0,20}\b(?:paint|painting)\b/i,
    key: 'trim_paint',
  },
  { test: /\bpaint|\bpainting/i, key: 'paint' },
  // Finish carpentry package stores acceptance under interior_trim — not generic trim.
  { test: /\bfinish\s+carpentry\b|\binterior\s+trim\b/i, key: 'interior_trim' },
  { test: /\bbaseboard|\btrim\s+install|\btrim\s+&\s+baseboard/i, key: 'trim' },
  {
    test: /\bplumb.*\btrim|\bplumbing\s+trim|\bfinal\s+plumb|\bfixture\s+hookup\b/i,
    key: 'plumbing_trim',
  },
  { test: /\bplumbing\s+connections?\b/i, key: 'plumbing' },
  { test: /\bpermit|\binspection/i, key: 'permits' },
  // Cleanup first when the name is cleanup-led (e.g. "Job cleanup / haul-off").
  { test: /\bcleanup\b|\bfinal\s+clean\b|\bjob\s+cleanup\b/i, key: 'cleanup' },
  // Trash / haul-off / dumpster is its own soft-cost — must not share cleanup's $1k allowance.
  { test: /\btrash\s+haul|\bhaul[\s-]?off\b|\bdumpster\b/i, key: 'haul_off' },
  { test: /\bplumb(?!.*trim)/i, key: 'plumbing_rough' },
];

export function lookupRuleKeyForPackage(
  name: string,
  scope = ''
): string | null {
  const nameStr = String(name || '');
  // Strip exclusionary helper phrases so "Not driveway flatwork" cannot steal landscaping.
  const scopeStr = String(scope || '')
    .replace(
      /\bnot\b[^.!?]{0,80}\b(driveway|flatwork|iron\s+entry|house\/garage|stucco\s+install)\b[^.!?]*/gi,
      ' '
    )
    .trim();
  const fullBlob = `${nameStr} ${scopeStr}`.trim();
  for (const row of PACKAGE_NAME_TO_RULE_KEY) {
    if (row.test.test(nameStr)) return row.key;
  }
  if (scopeStr) {
    for (const row of PACKAGE_NAME_TO_RULE_KEY) {
      if (row.test.test(fullBlob)) return row.key;
    }
  }
  return null;
}

/** Checklist keys that may hold pricing for a package name (primary + concrete aliases). */
export function ruleKeysToTryForPackage(name: string, scope = ''): string[] {
  const primary = lookupRuleKeyForPackage(name, scope);
  const keys: string[] = primary ? [primary] : [];
  const blob = `${name || ''} ${scope || ''}`.toLowerCase();
  // Landscaping must never inherit concrete/flatwork Confirm Scope totals.
  const concreteFamily =
    primary !== 'landscaping' &&
    (/\bconcrete\b/.test(blob) ||
      primary === 'concrete' ||
      primary === 'pour_flatwork' ||
      primary === 'pour_foundation' ||
      primary === 'foundation');
  if (concreteFamily) {
    for (const alias of [
      'foundation',
      'concrete',
      'pour_flatwork',
      'pour_foundation',
    ] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  if (primary === 'tile_flooring' || primary === 'flooring') {
    for (const alias of ['tile_flooring', 'flooring'] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  const roofingFamily =
    /\broof|\bshingle/.test(blob) ||
    primary === 'roofing' ||
    primary === 'shingles_roofing' ||
    primary === 'roof_tie_in';
  if (roofingFamily) {
    for (const alias of [
      'roofing',
      'shingles_roofing',
      'roof_tie_in',
    ] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  // Interior / generic paint share Confirm Scope keys; exterior must stay isolated.
  if (
    primary === 'interior_paint' ||
    primary === 'paint' ||
    primary === 'paint_trim'
  ) {
    for (const alias of ['paint_trim', 'interior_paint', 'paint'] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  if (
    primary === 'floor_demo' ||
    primary === 'demo' ||
    /\btile\s+removal\b/i.test(blob) ||
    /\bremove\s+existing\s+tile\b/i.test(blob)
  ) {
    for (const alias of ['floor_demo', 'demo', 'tub_demo'] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  if (
    primary === 'floor_tile' ||
    primary === 'shower_tile' ||
    primary === 'shower_floor_tile' ||
    /\btile\s+install\b/i.test(blob)
  ) {
    for (const alias of [
      'shower_tile',
      'shower_floor_tile',
      'floor_tile',
    ] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  if (
    primary === 'shower_bench' ||
    primary === 'shower_bench_curb' ||
    /\bshower\s+bench\b/i.test(blob)
  ) {
    for (const alias of ['shower_bench', 'shower_bench_curb'] as const) {
      if (!keys.includes(alias)) keys.push(alias);
    }
  }
  return keys;
}

/** Planning qty when measurements/notes are missing — enables saved template $/sqft on demo/install rows. */
export function inferPlanningQuantityForPackage(
  packageName: string,
  scopeText: string,
  draft?: {
    projectType?: string;
    estimateTier?: string;
    originalNotes?: string;
  } | null
): { quantity: number; unit: string } | null {
  const tier = String(draft?.estimateTier || '').toLowerCase();
  const pt = String(draft?.projectType || '').toLowerCase();
  const notes = String(draft?.originalNotes || '');
  const isRemodel =
    tier === 'room_remodel' ||
    tier === 'addition' ||
    tier === 'ground_up' ||
    ['bathroom', 'bath', 'kitchen', 'flooring'].includes(pt) ||
    /\b(bath(?:room)?\s+remodel|kitchen\s+remodel|floor\s+job|floor\s+remodel)\b/i.test(
      notes
    );
  if (!isRemodel) return null;

  const blob = `${packageName} ${scopeText}`.toLowerCase();
  if (
    /shower/.test(blob) &&
    /tile/.test(blob) &&
    !/\b(demo|removal)\b/.test(blob)
  ) {
    return { quantity: 90, unit: 'sqft' };
  }
  if (
    (/floor/.test(blob) && /tile/.test(blob)) ||
    /\btile\s+demo\b/.test(blob)
  ) {
    return { quantity: 45, unit: 'sqft' };
  }
  if (
    /tile/.test(blob) &&
    /\binstall/.test(blob) &&
    !/\b(demo|removal)\b/.test(blob)
  ) {
    return {
      quantity:
        /\bshower\b/.test(blob) || /\bshower\b/.test(notes.toLowerCase())
          ? 90
          : 45,
      unit: 'sqft',
    };
  }
  if (/\b(demo|removal|tear[\s-]?out)\b/.test(blob) && /\btile\b/.test(blob)) {
    return { quantity: 45, unit: 'sqft' };
  }
  if (
    /\b(paint|painting)\b/.test(blob) &&
    !/\b(floor|tile|exterior)\b/.test(blob)
  ) {
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
    if (!ids.length || ids.includes('not_in_scope') || ids.includes('unsure'))
      return false;
    if (
      ids.includes('no_changes') &&
      !ids.some(id => id === 'remove' || id === 'add')
    )
      return false;
    return ids.some(id => id === 'remove' || id === 'add');
  }
  if (item.inputType === 'choice') {
    return Boolean(
      item.choiceId &&
        item.choiceId !== 'not_in_scope' &&
        item.choiceId !== 'unsure'
    );
  }
  return item.state === 'included';
}

export function countScopePricingReadiness(
  items: Array<{
    id: string;
    inputType?: string;
    state?: string;
    choiceId?: string | null;
  }>,
  measurements: NormalizedScopeMeasurements,
  templateKey?: string | null,
  notes?: string | null
): { ready: number; needsMeasurement: number } {
  let ready = 0;
  let needsMeasurement = 0;
  const isPainting = String(templateKey || '').toLowerCase() === 'painting';
  const skippedPaintingIds = new Set([
    'paint',
    'interior_paint',
    'ceiling_paint',
    'prep',
    'exterior_prep',
    'trim_paint',
    'door_paint',
    'cabinet_paint',
    'exterior_paint',
  ]);
  if (isPainting) {
    const active = new Set(
      items.filter(item => checklistItemInScope(item)).map(item => item.id)
    );
    const raw = measurements as unknown as {
      paintPricingMethod?: 'combined' | 'separate' | null;
      combinedPaintableAreaSqft?: string | number | null;
      paintAreaSqft?: string | number | null;
      exteriorPaintSqft?: string | number | null;
    };
    const positive = (value: unknown) => Number(value || 0) > 0;
    const combinedArea = raw.combinedPaintableAreaSqft || raw.paintAreaSqft;
    const wallReady =
      raw.paintPricingMethod === 'combined'
        ? positive(combinedArea) ||
          positive(measurements.itemQuantities?.interior_paint?.quantity)
        : positive(measurements.wallPaintSqft);
    const ceilingReady = positive(measurements.ceilingPaintSqft);
    const paintReadiness: Array<[string, boolean]> = [
      ['interior_paint', wallReady],
      ['ceiling_paint', ceilingReady],
      ['trim_paint', positive(measurements.baseboardLf)],
      ['door_paint', positive(measurements.interiorDoorCount)],
      [
        'cabinet_paint',
        positive(measurements.cabinetPaintSqft) ||
          positive(measurements.cabinetRunLf),
      ],
      ['exterior_paint', positive(raw.exteriorPaintSqft)],
    ];
    for (const [id, readyForQuantity] of paintReadiness) {
      if (!active.has(id)) continue;
      if (readyForQuantity) ready += 1;
      else needsMeasurement += 1;
    }
    if (active.has('prep')) {
      if (wallReady || ceilingReady) ready += 1;
      else if (active.has('interior_paint') || active.has('ceiling_paint')) {
        // The missing wall/ceiling measurement is counted by the surface card.
      }
    }
    if (active.has('exterior_prep')) {
      if (positive(raw.exteriorPaintSqft)) ready += 1;
      else if (active.has('exterior_paint')) needsMeasurement += 1;
    }
  }
  for (const item of items) {
    if (!checklistItemInScope(item)) continue;
    if (isPainting && skippedPaintingIds.has(item.id)) continue;
    if (String(item.id || '').startsWith('custom_')) {
      const applied = isCustomScopePricingApplied(
        item.id,
        (
          measurements as {
            pricingAcceptance?: Record<string, { selectionStatus?: string }>;
          }
        )?.pricingAcceptance
      );
      if (!applied) {
        needsMeasurement += 1;
        continue;
      }
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
    const acceptanceTotal = Number(
      (
        measurements as {
          pricingAcceptance?: Record<string, { totalAmount?: number }>;
        }
      )?.pricingAcceptance?.[item.id]?.totalAmount || 0
    );
    const alreadyPriced =
      mat > 0 ||
      lab > 0 ||
      allowance > 0 ||
      acceptanceTotal > 0 ||
      (['allowance', 'lump_sum'].includes(
        String(resolved.unit || '').toLowerCase()
      ) &&
        Number(resolved.quantity || 0) > 0);
    if (alreadyPriced) continue;
    if (resolved.pricingReady) ready += 1;
    else needsMeasurement += 1;
  }
  return { ready, needsMeasurement };
}

function countPackageScopeReadiness(draft: EstimateAiDraft): {
  ready: number;
  needsMeasurement: number;
} {
  let ready = 0;
  let needsMeasurement = 0;
  const packages = draft.scopePackages?.length
    ? draft.scopePackages
    : (draft.rooms || []).map(room => ({
        name: room.name,
        scope: room.scope,
        scopeQuantities: room.scopeQuantities,
        price: room.price,
        knownSubtotal: room.knownSubtotal,
        calculatedSubtotal: room.calculatedSubtotal,
        materialPrice: room.materialPrice,
        laborPrice: room.laborPrice,
        priceSource: room.priceProvidedByUser ? 'user_provided' : undefined,
        splitIsSuggested: room.splitIsSuggested,
        budgetSplitBasis: undefined,
        status:
          room.price != null && room.price > 0
            ? 'user_provided'
            : 'missing_price',
      }));
  for (const pkg of packages) {
    const q = pkg.scopeQuantities?.[0];
    // Skip packages that already have a price or Confirm Scope budget split.
    const packageAmount = Number(
      pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0
    );
    const mat = Number(pkg.materialPrice ?? 0);
    const lab = Number(pkg.laborPrice ?? 0);
    const alreadyPriced = packageAmount > 0 || mat > 0 || lab > 0;
    if (alreadyPriced) continue;
    if (q && q.quantity > 0) ready += 1;
    else needsMeasurement += 1;
  }
  return { ready, needsMeasurement };
}

export function countDraftPricingReadiness(
  draft: EstimateAiDraft | null | undefined
): {
  ready: number;
  needsMeasurement: number;
} {
  if (!draft) return { ready: 0, needsMeasurement: 0 };
  const hasScopePackages = Boolean(
    (draft.scopePackages && draft.scopePackages.length > 0) ||
      (draft.rooms && draft.rooms.length > 0)
  );
  // Step 3 review always has scope packages. Prefer that count — checklist
  // "ready" counts measured items even when Confirm Scope already priced them,
  // which produced "Suggest pricing for 24 measured items" on a nearly-priced bid.
  if (hasScopePackages) {
    return countPackageScopeReadiness(draft);
  }
  const items = draft.confirmedAssumptions || draft.scopeChecklist?.items || [];
  const norm = normalizeScopeMeasurements(draft.scopeMeasurements);
  return countScopePricingReadiness(
    items,
    norm,
    draft.scopeChecklist?.templateKey,
    draft.originalNotes
  );
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
  let extended = syncPlumbingQuantitiesIntoItemQuantities(
    safeInput,
    options?.templateKey
  );
  extended = syncFramingQuantitiesIntoItemQuantities(
    extended,
    options?.templateKey
  );
  extended = syncItemQuantitiesToMeasurementFields(extended);
  const notes = String(options?.notes || '').trim();
  if (notes) {
    extended = reparseRatePricingIntoItemQuantities(
      extended,
      notes,
      options?.templateKey
    );
  }
  if (
    options?.templateKey === 'painting' &&
    extended.paintPricingMethod === 'combined' &&
    Number(extended.combinedPaintableAreaSqft || extended.paintAreaSqft) > 0
  ) {
    const quantity = String(
      extended.combinedPaintableAreaSqft || extended.paintAreaSqft
    );
    extended = {
      ...extended,
      itemQuantities: {
        ...extended.itemQuantities,
        interior_paint: {
          quantity,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        prep: { quantity, unit: 'sqft', quantitySource: 'user_entered' },
      },
    };
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
  let extended = syncPlumbingQuantitiesIntoItemQuantities(
    safeInput,
    options?.templateKey
  );
  extended = syncFramingQuantitiesIntoItemQuantities(
    extended,
    options?.templateKey
  );
  extended = syncHvacQuantitiesIntoItemQuantities(
    extended,
    options?.templateKey
  );
  extended = syncItemQuantitiesToMeasurementFields(extended);
  const notes = String(options?.notes || '').trim();
  if (notes) {
    extended = reparseRatePricingIntoItemQuantities(
      extended,
      notes,
      options?.templateKey
    );
  }
  extended = syncPaintingCombinedQuantitiesIntoItemQuantities(
    extended,
    options?.templateKey
  );
  extended = syncElectricalQuantitiesIntoItemQuantities(
    extended,
    options?.templateKey
  );
  return scopeMeasurementsToPayload(extended);
}

function syncPlumbingQuantitiesIntoItemQuantities(
  extended: ScopeMeasurementsInputExtended,
  templateKey?: string | null
): ScopeMeasurementsInputExtended {
  const template = String(templateKey || '').toLowerCase();
  const isPlumbing = template === 'plumbing' || template === 'plumbing_service';
  if (!isPlumbing && !Array.isArray(extended.plumbingScope)) {
    return extended;
  }
  const nextQuantities = { ...(extended.itemQuantities || {}) };
  let changed = false;
  for (const card of PLUMBING_CARDS) {
    const raw = (extended as Record<string, unknown>)[card.measurementKey];
    const quantity = Number(String(raw ?? '').replace(/,/g, ''));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const existing = nextQuantities[card.itemId];
    const existingQty = Number(
      String(existing?.quantity ?? '').replace(/,/g, '')
    );
    if (
      Number.isFinite(existingQty) &&
      existingQty > 0 &&
      !plumbingStoredQuantityLooksLikeDollarTotal(
        card.itemId,
        existing,
        nextQuantities
      ) &&
      Math.abs(existingQty - quantity) < 0.01
    ) {
      continue;
    }
    const sourceTag = extended.quickMeasurementSources?.[card.measurementKey];
    const source =
      sourceTag === 'plan_detected' ||
      sourceTag === 'plan_verified' ||
      sourceTag === 'ai_verified' ||
      sourceTag === 'contractor_confirmed_from_plan_review'
        ? 'plan_detected'
        : 'user_entered';
    nextQuantities[card.itemId] = {
      quantity: String(quantity),
      unit: card.unit,
      quantitySource: source,
    };
    (extended as Record<string, unknown>)[card.measurementKey] =
      String(quantity);
    changed = true;
  }
  return changed ? { ...extended, itemQuantities: nextQuantities } : extended;
}

function syncFramingQuantitiesIntoItemQuantities(
  extended: ScopeMeasurementsInputExtended,
  templateKey?: string | null
): ScopeMeasurementsInputExtended {
  const template = String(templateKey || '').toLowerCase();
  const isFraming = template === 'framing';
  if (!isFraming && !Array.isArray(extended.framingScope)) {
    return extended;
  }
  const enriched = { ...(extended as Record<string, unknown>) };
  const framed = resolveCoveredFramedAreaSqft(enriched);
  if (framed != null && framed > 0) {
    enriched.framedAreaSqft = framed;
  }
  const sheathing = resolveFramingSheathingSqft(enriched);
  if (sheathing != null && sheathing > 0) {
    enriched.sheathingSqft = sheathing;
  }
  const nextQuantities = { ...(extended.itemQuantities || {}) };
  let changed =
    (framed != null && framed > 0) || (sheathing != null && sheathing > 0);
  const shellBid = isShellFramingPackageBid(enriched);
  for (const card of FRAMING_CARDS) {
    if (
      shellBid &&
      (card.itemId === 'wall_framing' || card.itemId === 'openings') &&
      !shouldPreserveShellFramingComponentMeasurement(
        enriched,
        card.measurementKey
      )
    ) {
      continue;
    }
    let quantity = Number(
      String(enriched[card.measurementKey] ?? '').replace(/,/g, '')
    );
    if (
      card.measurementKey === 'framedAreaSqft' &&
      resolveCoveredFramedAreaSqft(enriched) != null
    ) {
      quantity = resolveCoveredFramedAreaSqft(enriched)!;
    }
    if (
      card.measurementKey === 'sheathingSqft' &&
      resolveFramingSheathingSqft(enriched) != null
    ) {
      quantity = resolveFramingSheathingSqft(enriched)!;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (Number(nextQuantities[card.itemId]?.quantity) > 0) continue;
    const sourceTag = extended.quickMeasurementSources?.[card.measurementKey];
    const source =
      sourceTag === 'plan_detected' ||
      sourceTag === 'plan_verified' ||
      sourceTag === 'ai_verified' ||
      sourceTag === 'contractor_confirmed_from_plan_review'
        ? 'plan_detected'
        : 'user_entered';
    nextQuantities[card.itemId] = {
      quantity: String(quantity),
      unit: card.unit,
      quantitySource: source,
    };
    enriched[card.measurementKey] = String(quantity);
    changed = true;
  }
  return changed
    ? ({
        ...extended,
        ...enriched,
        itemQuantities: nextQuantities,
      } as ScopeMeasurementsInputExtended)
    : extended;
}

function syncHvacQuantitiesIntoItemQuantities(
  extended: ScopeMeasurementsInputExtended,
  templateKey?: string | null
): ScopeMeasurementsInputExtended {
  const template = String(templateKey || '').toLowerCase();
  const isHvac = template === 'hvac';
  if (!isHvac && extended.planImportTradeKey !== 'hvac') {
    return extended;
  }
  const nextQuantities = { ...(extended.itemQuantities || {}) };
  let changed = false;
  for (const card of HVAC_CARDS) {
    const raw = (extended as Record<string, unknown>)[card.measurementKey];
    const quantity = Number(String(raw ?? '').replace(/,/g, ''));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const existing = nextQuantities[card.itemId];
    const existingQty = Number(
      String(existing?.quantity ?? '').replace(/,/g, '')
    );
    if (Number.isFinite(existingQty) && existingQty > 0) continue;
    const sourceTag = extended.quickMeasurementSources?.[card.measurementKey];
    const source =
      sourceTag === 'plan_detected' ||
      sourceTag === 'plan_verified' ||
      sourceTag === 'ai_verified' ||
      sourceTag === 'contractor_confirmed_from_plan_review'
        ? sourceTag === 'contractor_confirmed_from_plan_review'
          ? 'contractor_confirmed_from_plan_review'
          : 'plan_detected'
        : sourceTag === 'needs_confirmation'
          ? 'needs_confirmation'
          : 'user_entered';
    nextQuantities[card.itemId] = {
      quantity: String(quantity),
      unit: card.unit,
      quantitySource: source,
    };
    (extended as Record<string, unknown>)[card.measurementKey] =
      String(quantity);
    changed = true;
  }
  return changed ? { ...extended, itemQuantities: nextQuantities } : extended;
}

function syncElectricalQuantitiesIntoItemQuantities(
  extended: ScopeMeasurementsInputExtended,
  templateKey?: string | null
): ScopeMeasurementsInputExtended {
  const isElectrical = String(templateKey || '').toLowerCase() === 'electrical';
  if (!isElectrical && !Array.isArray(extended.electricalScope))
    return extended;
  const nextQuantities = { ...(extended.itemQuantities || {}) };
  let changed = false;
  for (const card of ELECTRICAL_CARDS) {
    if (card.measurementKey === 'serviceAmperage') continue;
    const raw = (extended as Record<string, unknown>)[card.measurementKey];
    const quantity = Number(String(raw ?? '').replace(/,/g, ''));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (Number(nextQuantities[card.itemId]?.quantity) > 0) continue;
    nextQuantities[card.itemId] = {
      quantity: String(quantity),
      unit: card.unit,
      quantitySource: 'user_entered',
    };
    changed = true;
  }
  return changed ? { ...extended, itemQuantities: nextQuantities } : extended;
}

function syncPaintingCombinedQuantitiesIntoItemQuantities(
  extended: ScopeMeasurementsInputExtended,
  templateKey?: string | null
): ScopeMeasurementsInputExtended {
  const isPainting = String(templateKey || '').toLowerCase() === 'painting';
  if (!isPainting && extended.paintPricingMethod !== 'combined')
    return extended;
  if (
    extended.paintPricingMethod === 'combined' &&
    Number(extended.combinedPaintableAreaSqft || extended.paintAreaSqft) > 0
  ) {
    const quantity = String(
      extended.combinedPaintableAreaSqft || extended.paintAreaSqft
    );
    extended = {
      ...extended,
      itemQuantities: {
        ...extended.itemQuantities,
        interior_paint: {
          quantity,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        prep: {
          ...(extended.itemQuantities?.prep || {}),
          quantity: extended.itemQuantities?.prep?.quantity || quantity,
          unit: extended.itemQuantities?.prep?.unit || 'sqft',
          quantitySource:
            extended.itemQuantities?.prep?.quantitySource || 'user_entered',
        },
      },
    };
  }
  const copyIfMissing = (
    itemId: string,
    quantity: string | number | null | undefined,
    unit: string
  ) => {
    if (!(Number(quantity) > 0)) return;
    if (Number(extended.itemQuantities?.[itemId]?.quantity) > 0) return;
    extended = {
      ...extended,
      itemQuantities: {
        ...extended.itemQuantities,
        [itemId]: {
          quantity: String(quantity),
          unit,
          quantitySource: 'user_entered',
        },
      },
    };
  };
  if (isPainting) {
    copyIfMissing('trim_paint', extended.baseboardLf, 'lf');
    copyIfMissing('door_paint', extended.interiorDoorCount, 'each');
    copyIfMissing('cabinet_paint', extended.cabinetRunLf, 'lf');
    copyIfMissing('exterior_paint', extended.exteriorPaintSqft, 'sqft');
    copyIfMissing('ceiling_paint', extended.ceilingPaintSqft, 'sqft');
  }
  return extended;
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
    flooringProductScope: Array.isArray(sanitized.flooringProductScope)
      ? sanitized.flooringProductScope
      : null,
    flooringExistingLvpInstallMethod:
      sanitized.flooringExistingLvpInstallMethod ?? null,
    flooringExistingSheetVinylType:
      sanitized.flooringExistingSheetVinylType ?? null,
    floorPrepLevel: sanitized.floorPrepLevel ?? null,
    flooringDemoIncludesSubstratePrep:
      sanitized.flooringDemoIncludesSubstratePrep ?? null,
    floorPrepTransitions: Array.isArray(sanitized.floorPrepTransitions)
      ? sanitized.floorPrepTransitions
      : null,
    floorPrepByProduct: sanitized.floorPrepByProduct ?? null,
    flooringLvpSqft: parseScopeMeasurementInput(sanitized.flooringLvpSqft),
    flooringLaminateSqft: parseScopeMeasurementInput(
      sanitized.flooringLaminateSqft
    ),
    flooringEngineeredHardwoodSqft: parseScopeMeasurementInput(
      sanitized.flooringEngineeredHardwoodSqft
    ),
    flooringSolidHardwoodSqft: parseScopeMeasurementInput(
      sanitized.flooringSolidHardwoodSqft
    ),
    flooringTileSqft: parseScopeMeasurementInput(sanitized.flooringTileSqft),
    flooringCarpetSqft: parseScopeMeasurementInput(
      sanitized.flooringCarpetSqft
    ),
    floorDemoSqft: parseScopeMeasurementInput(sanitized.floorDemoSqft),
    floorPrepSqft: parseScopeMeasurementInput(sanitized.floorPrepSqft),
    underlaymentSqft: parseScopeMeasurementInput(sanitized.underlaymentSqft),
    moistureBarrierSqft: parseScopeMeasurementInput(
      sanitized.moistureBarrierSqft
    ),
    transitionLf: parseScopeMeasurementInput(sanitized.transitionLf),
    transitionCount: parseScopeMeasurementInput(sanitized.transitionCount),
    quarterRoundLf: parseScopeMeasurementInput(sanitized.quarterRoundLf),
    backsplashSqft: parseScopeMeasurementInput(sanitized.backsplashSqft),
    countertopSqft: parseScopeMeasurementInput(sanitized.countertopSqft),
    cabinetLf: parseScopeMeasurementInput(sanitized.cabinetLf),
    landscapeSqft: parseScopeMeasurementInput(sanitized.landscapeSqft),
    artificialTurfSqft: parseScopeMeasurementInput(
      sanitized.artificialTurfSqft
    ),
    demoClearingSqft: parseScopeMeasurementInput(sanitized.demoClearingSqft),
    gradingSqft: parseScopeMeasurementInput(sanitized.gradingSqft),
    soilPrepSqft: parseScopeMeasurementInput(sanitized.soilPrepSqft),
    sodSqft: parseScopeMeasurementInput(sanitized.sodSqft),
    paverSqft: parseScopeMeasurementInput(sanitized.paverSqft),
    rockMulchSqft: parseScopeMeasurementInput(sanitized.rockMulchSqft),
    landscapeTons: parseScopeMeasurementInput(sanitized.landscapeTons),
    plantCount: parseScopeMeasurementInput(sanitized.plantCount),
    treeCount: parseScopeMeasurementInput(sanitized.treeCount),
    irrigationZoneCount: parseScopeMeasurementInput(
      sanitized.irrigationZoneCount
    ),
    drainageLf: parseScopeMeasurementInput(sanitized.drainageLf),
    concreteEdgingLf: parseScopeMeasurementInput(sanitized.concreteEdgingLf),
    boulderCount: parseScopeMeasurementInput(sanitized.boulderCount),
    landscapeLightCount: parseScopeMeasurementInput(
      sanitized.landscapeLightCount
    ),
    landscapeScope: Array.isArray(sanitized.landscapeScope)
      ? sanitized.landscapeScope
      : null,
    landscapeClearingLevel: sanitized.landscapeClearingLevel ?? null,
    tradeScopeSelections: sanitized.tradeScopeSelections ?? null,
    roofAreaSqft: parseScopeMeasurementInput(sanitized.roofAreaSqft),
    roofIceWaterShieldSqft: parseScopeMeasurementInput(
      sanitized.roofIceWaterShieldSqft
    ),
    roofSquares: parseScopeMeasurementInput(sanitized.roofSquares),
    roofPitch: sanitized.roofPitch ?? null,
    storyCount: parseScopeMeasurementInput(sanitized.storyCount),
    roofDeckingReplacementSqft: parseScopeMeasurementInput(
      sanitized.roofDeckingReplacementSqft
    ),
    roofDripEdgeLf: parseScopeMeasurementInput(sanitized.roofDripEdgeLf),
    roofRidgeCapLf: parseScopeMeasurementInput(sanitized.roofRidgeCapLf),
    roofRidgeVentLf: parseScopeMeasurementInput(sanitized.roofRidgeVentLf),
    roofValleyFlashingLf: parseScopeMeasurementInput(
      sanitized.roofValleyFlashingLf
    ),
    roofStepFlashingLf: parseScopeMeasurementInput(
      sanitized.roofStepFlashingLf
    ),
    roofWallFlashingLf: parseScopeMeasurementInput(
      sanitized.roofWallFlashingLf
    ),
    roofChimneyFlashingCount: parseScopeMeasurementInput(
      sanitized.roofChimneyFlashingCount
    ),
    roofPipeBootCount: parseScopeMeasurementInput(sanitized.roofPipeBootCount),
    roofVentCount: parseScopeMeasurementInput(sanitized.roofVentCount),
    roofTurbineVentCount: parseScopeMeasurementInput(
      sanitized.roofTurbineVentCount
    ),
    roofSkylightCount: parseScopeMeasurementInput(sanitized.roofSkylightCount),
    roofPenetrationCount: parseScopeMeasurementInput(
      sanitized.roofPenetrationCount
    ),
    roofRepairAffectedSqft: parseScopeMeasurementInput(
      sanitized.roofRepairAffectedSqft
    ),
    roofGutterLf: parseScopeMeasurementInput(sanitized.roofGutterLf),
    roofDownspoutCount: parseScopeMeasurementInput(
      sanitized.roofDownspoutCount
    ),
    drywallSqft: parseScopeMeasurementInput(sanitized.drywallSqft),
    concreteSqft: parseScopeMeasurementInput(sanitized.concreteSqft),
    concreteReinforcementSqft: parseScopeMeasurementInput(
      sanitized.concreteReinforcementSqft
    ),
    concreteSealerSqft: parseScopeMeasurementInput(
      sanitized.concreteSealerSqft
    ),
    concreteSubgradePrepSqft: parseScopeMeasurementInput(
      sanitized.concreteSubgradePrepSqft
    ),
    concreteAreaByType: sanitized.concreteAreaByType ?? null,
    concreteThicknessByType: sanitized.concreteThicknessByType ?? null,
    concreteThicknessInches: parseScopeMeasurementInput(
      sanitized.concreteThicknessInches
    ),
    concreteDecorativeFinish: sanitized.concreteDecorativeFinish,
    complexFormingLf: parseScopeMeasurementInput(sanitized.complexFormingLf),
    additionalHaulOffLoadCount: parseScopeMeasurementInput(
      sanitized.additionalHaulOffLoadCount
    ),
    concreteDemoSqft: parseScopeMeasurementInput(sanitized.concreteDemoSqft),
    concreteDemoThicknessBand: sanitized.concreteDemoThicknessBand ?? null,
    concreteDemoThicknessBands: sanitized.concreteDemoThicknessBands ?? null,
    concreteDemoAreaByThickness: sanitized.concreteDemoAreaByThickness ?? null,
    concreteDemoReinforced: sanitized.concreteDemoReinforced ?? null,
    concreteDemoLimitedAccess: sanitized.concreteDemoLimitedAccess ?? null,
    concreteDemoCy: parseScopeMeasurementInput(sanitized.concreteDemoCy),
    concreteCy: parseScopeMeasurementInput(sanitized.concreteCy),
    excavationCy: parseScopeMeasurementInput(sanitized.excavationCy),
    excavationAreaSqft: parseScopeMeasurementInput(
      sanitized.excavationAreaSqft
    ),
    excavationDepthInches: parseScopeMeasurementInput(
      sanitized.excavationDepthInches
    ),
    concreteScope: Array.isArray(sanitized.concreteScope)
      ? sanitized.concreteScope
      : null,
    deckSqft: parseScopeMeasurementInput(sanitized.deckSqft),
    garageSqft: parseScopeMeasurementInput(sanitized.garageSqft),
    exteriorPaintSqft: parseScopeMeasurementInput(sanitized.exteriorPaintSqft),
    stuccoGrossWallSqft: parseScopeMeasurementInput(
      sanitized.stuccoGrossWallSqft
    ),
    stuccoWindowDoorOpeningSqft: parseScopeMeasurementInput(
      sanitized.stuccoWindowDoorOpeningSqft
    ),
    stuccoGarageOpeningSqft: parseScopeMeasurementInput(
      sanitized.stuccoGarageOpeningSqft
    ),
    stuccoOtherFinishDeductionSqft: parseScopeMeasurementInput(
      sanitized.stuccoOtherFinishDeductionSqft
    ),
    stuccoNetWallSqft: parseScopeMeasurementInput(sanitized.stuccoNetWallSqft),
    stuccoSoffitSqft: parseScopeMeasurementInput(sanitized.stuccoSoffitSqft),
    stuccoParapetSqft: parseScopeMeasurementInput(sanitized.stuccoParapetSqft),
    stuccoFoamTrimLf: parseScopeMeasurementInput(sanitized.stuccoFoamTrimLf),
    stuccoControlJointLf: parseScopeMeasurementInput(
      sanitized.stuccoControlJointLf
    ),
    stuccoAccessAffectedSqft: parseScopeMeasurementInput(
      sanitized.stuccoAccessAffectedSqft
    ),
    stuccoRepairAffectedSqft: parseScopeMeasurementInput(
      sanitized.stuccoRepairAffectedSqft
    ),
    stuccoStories: parseScopeMeasurementInput(sanitized.stuccoStories),
    stuccoWallHeightFt: parseScopeMeasurementInput(
      sanitized.stuccoWallHeightFt
    ),
    ...copyInsulationScopeNumericFields(
      sanitized as Record<string, unknown>,
      parseScopeMeasurementInput
    ),
    ...copyInsulationScopeTextFields(sanitized as Record<string, unknown>),
    insulationAssemblies: copyInsulationAssemblyFields(
      sanitized as Record<string, unknown>
    ),
    paintScope: sanitized.paintScope ?? null,
    wallPaintSqft: parseScopeMeasurementInput(sanitized.wallPaintSqft),
    ceilingPaintSqft: parseScopeMeasurementInput(sanitized.ceilingPaintSqft),
    paintAreaSqft: parseScopeMeasurementInput(sanitized.paintAreaSqft),
    paintAreaBasis: sanitized.paintAreaBasis ?? null,
    paintAreaNeedsConfirmation: sanitized.paintAreaNeedsConfirmation ?? null,
    paintPricingMethod: sanitized.paintPricingMethod ?? null,
    combinedPaintableAreaSqft: parseScopeMeasurementInput(
      String(sanitized.combinedPaintableAreaSqft ?? '')
    ),
    originalPaintAreaReferenceSqft: parseScopeMeasurementInput(
      String(sanitized.originalPaintAreaReferenceSqft ?? '')
    ),
    paintOccupancy: sanitized.paintOccupancy ?? null,
    paintApplicationMethod: sanitized.paintApplicationMethod ?? null,
    paintOccupancyConfirmed: sanitized.paintOccupancyConfirmed ?? null,
    paintApplicationMethodConfirmed:
      sanitized.paintApplicationMethodConfirmed ?? null,
    ...copyElectricalQuantityFields(
      sanitized as Record<string, unknown>,
      parseScopeMeasurementInput
    ),
    ...copyHvacQuantityFields(
      sanitized as Record<string, unknown>,
      parseScopeMeasurementInput
    ),
    ...copyElectricalConditionFields(sanitized as Record<string, unknown>),
    cabinetMeasurementMethod: sanitized.cabinetMeasurementMethod ?? null,
    interiorDoorCount: parseScopeMeasurementInput(sanitized.interiorDoorCount),
    windowCount: parseScopeMeasurementInput(sanitized.windowCount),
    exteriorDoorCount: parseScopeMeasurementInput(sanitized.exteriorDoorCount),
    slidingDoorCount: parseScopeMeasurementInput(sanitized.slidingDoorCount),
    framingOpeningCount: parseScopeMeasurementInput(
      sanitized.framingOpeningCount
    ),
    reframingRequested: sanitized.reframingRequested === true ? true : null,
    cabinetPaintSqft: parseScopeMeasurementInput(sanitized.cabinetPaintSqft),
    cabinetUpperLf: parseScopeMeasurementInput(
      String(sanitized.cabinetUpperLf ?? '')
    ),
    cabinetLowerLf: parseScopeMeasurementInput(
      String(sanitized.cabinetLowerLf ?? '')
    ),
    cabinetTallLf: parseScopeMeasurementInput(
      String(sanitized.cabinetTallLf ?? '')
    ),
    cabinetRunLf: parseScopeMeasurementInput(
      String(sanitized.cabinetRunLf ?? '')
    ),
    railingLf: parseScopeMeasurementInput(sanitized.railingLf),
    planRooms: Array.isArray(sanitized.planRooms)
      ? sanitized.planRooms
      : undefined,
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
    tilePanBathCount:
      sanitized.tilePanBathCount != null &&
      Number(sanitized.tilePanBathCount) > 0
        ? Math.round(Number(sanitized.tilePanBathCount))
        : null,
    prefabBathCount:
      sanitized.prefabBathCount != null && Number(sanitized.prefabBathCount) > 0
        ? Math.round(Number(sanitized.prefabBathCount))
        : null,
    prefabEnclosureBathCount:
      sanitized.prefabEnclosureBathCount != null &&
      Number(sanitized.prefabEnclosureBathCount) > 0
        ? Math.round(Number(sanitized.prefabEnclosureBathCount))
        : null,
    tubBathCount:
      sanitized.tubBathCount != null && Number(sanitized.tubBathCount) > 0
        ? Math.round(Number(sanitized.tubBathCount))
        : null,
    bathFloorTileCount:
      sanitized.bathFloorTileCount != null &&
      Number(sanitized.bathFloorTileCount) > 0
        ? Math.round(Number(sanitized.bathFloorTileCount))
        : null,
    showerDoorCount:
      sanitized.showerDoorCount != null && Number(sanitized.showerDoorCount) > 0
        ? Math.round(Number(sanitized.showerDoorCount))
        : null,
    existingTubCount:
      sanitized.existingTubCount != null &&
      Number(sanitized.existingTubCount) > 0
        ? Math.round(Number(sanitized.existingTubCount))
        : null,
    existingTileWallCount:
      sanitized.existingTileWallCount != null &&
      Number(sanitized.existingTileWallCount) > 0
        ? Math.round(Number(sanitized.existingTileWallCount))
        : null,
    existingTilePanCount:
      sanitized.existingTilePanCount != null &&
      Number(sanitized.existingTilePanCount) > 0
        ? Math.round(Number(sanitized.existingTilePanCount))
        : null,
    existingPrefabPanCount:
      sanitized.existingPrefabPanCount != null &&
      Number(sanitized.existingPrefabPanCount) > 0
        ? Math.round(Number(sanitized.existingPrefabPanCount))
        : null,
    existingPrefabEnclosureCount:
      sanitized.existingPrefabEnclosureCount != null &&
      Number(sanitized.existingPrefabEnclosureCount) > 0
        ? Math.round(Number(sanitized.existingPrefabEnclosureCount))
        : null,
    existingShowerDoorCount:
      sanitized.existingShowerDoorCount != null &&
      Number(sanitized.existingShowerDoorCount) > 0
        ? Math.round(Number(sanitized.existingShowerDoorCount))
        : null,
    existingBathFloorTileCount:
      sanitized.existingBathFloorTileCount != null &&
      Number(sanitized.existingBathFloorTileCount) > 0
        ? Math.round(Number(sanitized.existingBathFloorTileCount))
        : null,
    bathroomExistingVanityCount:
      sanitized.bathroomExistingVanityCount != null &&
      Number(sanitized.bathroomExistingVanityCount) > 0
        ? Math.round(Number(sanitized.bathroomExistingVanityCount))
        : null,
    bathroomExistingCounterCount:
      sanitized.bathroomExistingCounterCount != null &&
      Number(sanitized.bathroomExistingCounterCount) > 0
        ? Math.round(Number(sanitized.bathroomExistingCounterCount))
        : null,
    bathroomInstallVanityCount:
      sanitized.bathroomInstallVanityCount != null &&
      Number(sanitized.bathroomInstallVanityCount) > 0
        ? Math.round(Number(sanitized.bathroomInstallVanityCount))
        : null,
    bathroomInstallCounterCount:
      sanitized.bathroomInstallCounterCount != null &&
      Number(sanitized.bathroomInstallCounterCount) > 0
        ? Math.round(Number(sanitized.bathroomInstallCounterCount))
        : null,
    bathroomDemoVanityCount:
      sanitized.bathroomDemoVanityCount != null &&
      Number(sanitized.bathroomDemoVanityCount) > 0
        ? Math.round(Number(sanitized.bathroomDemoVanityCount))
        : null,
    bathroomDemoCounterCount:
      sanitized.bathroomDemoCounterCount != null &&
      Number(sanitized.bathroomDemoCounterCount) > 0
        ? Math.round(Number(sanitized.bathroomDemoCounterCount))
        : null,
    bathroomVanityCountertopMaterialType:
      typeof sanitized.bathroomVanityCountertopMaterialType === 'string' &&
      sanitized.bathroomVanityCountertopMaterialType.trim()
        ? sanitized.bathroomVanityCountertopMaterialType.trim()
        : null,
    bathroomToiletRelocateFloorType:
      sanitized.bathroomToiletRelocateFloorType === 'open_wood_framed' ||
      sanitized.bathroomToiletRelocateFloorType === 'finished_wood_framed' ||
      sanitized.bathroomToiletRelocateFloorType === 'concrete_slab' ||
      sanitized.bathroomToiletRelocateFloorType === 'unsure'
        ? sanitized.bathroomToiletRelocateFloorType
        : null,
    bathroomToiletRelocateFloorTypeSource:
      sanitized.bathroomToiletRelocateFloorTypeSource === 'user_selected' ||
      sanitized.bathroomToiletRelocateFloorTypeSource === 'ai_inferred'
        ? sanitized.bathroomToiletRelocateFloorTypeSource
        : null,
    bathroomShowerRoughAccessType:
      sanitized.bathroomShowerRoughAccessType === 'open_wood_framed' ||
      sanitized.bathroomShowerRoughAccessType === 'finished_wood_framed' ||
      sanitized.bathroomShowerRoughAccessType === 'concrete_slab' ||
      sanitized.bathroomShowerRoughAccessType === 'unsure'
        ? sanitized.bathroomShowerRoughAccessType
        : null,
    bathroomShowerRoughAccessTypeSource:
      sanitized.bathroomShowerRoughAccessTypeSource === 'user_selected' ||
      sanitized.bathroomShowerRoughAccessTypeSource === 'ai_inferred'
        ? sanitized.bathroomShowerRoughAccessTypeSource
        : null,
    bathroomShowerRoughWorkType:
      sanitized.bathroomShowerRoughWorkType === 'in_place' ||
      sanitized.bathroomShowerRoughWorkType === 'relocation' ||
      sanitized.bathroomShowerRoughWorkType === 'unsure'
        ? sanitized.bathroomShowerRoughWorkType
        : null,
    bathroomShowerRoughWorkTypeSource:
      sanitized.bathroomShowerRoughWorkTypeSource === 'user_selected' ||
      sanitized.bathroomShowerRoughWorkTypeSource === 'ai_inferred'
        ? sanitized.bathroomShowerRoughWorkTypeSource
        : null,
    bathroomShowerRoughFixtureType:
      sanitized.bathroomShowerRoughFixtureType === 'shower' ||
      sanitized.bathroomShowerRoughFixtureType === 'bathtub' ||
      sanitized.bathroomShowerRoughFixtureType === 'tub_shower_combo' ||
      sanitized.bathroomShowerRoughFixtureType === 'unsure'
        ? sanitized.bathroomShowerRoughFixtureType
        : null,
    bathroomShowerRoughFixtureTypeSource:
      sanitized.bathroomShowerRoughFixtureTypeSource === 'user_selected' ||
      sanitized.bathroomShowerRoughFixtureTypeSource === 'ai_inferred'
        ? sanitized.bathroomShowerRoughFixtureTypeSource
        : null,
    bathroomShowerRoughWallAccess:
      sanitized.bathroomShowerRoughWallAccess === 'open_framing' ||
      sanitized.bathroomShowerRoughWallAccess === 'finished_wall' ||
      sanitized.bathroomShowerRoughWallAccess === 'unsure'
        ? sanitized.bathroomShowerRoughWallAccess
        : null,
    bathroomShowerRoughWallAccessSource:
      sanitized.bathroomShowerRoughWallAccessSource === 'user_selected' ||
      sanitized.bathroomShowerRoughWallAccessSource === 'ai_inferred'
        ? sanitized.bathroomShowerRoughWallAccessSource
        : null,
    bathroomShowerRoughPlumbingExposed:
      sanitized.bathroomShowerRoughPlumbingExposed === 'exposed_by_demo' ||
      sanitized.bathroomShowerRoughPlumbingExposed ===
        'separate_access_required' ||
      sanitized.bathroomShowerRoughPlumbingExposed === 'unsure'
        ? sanitized.bathroomShowerRoughPlumbingExposed
        : sanitized.bathroomShowerRoughWallAccess === 'open_framing'
          ? 'exposed_by_demo'
          : sanitized.bathroomShowerRoughWallAccess === 'finished_wall'
            ? 'separate_access_required'
            : null,
    bathroomShowerRoughPlumbingExposedSource:
      sanitized.bathroomShowerRoughPlumbingExposedSource === 'user_selected' ||
      sanitized.bathroomShowerRoughPlumbingExposedSource === 'demo_detected' ||
      sanitized.bathroomShowerRoughPlumbingExposedSource === 'ai_inferred'
        ? sanitized.bathroomShowerRoughPlumbingExposedSource
        : sanitized.bathroomShowerRoughWallAccess === 'open_framing' ||
            sanitized.bathroomShowerRoughWallAccess === 'finished_wall'
          ? sanitized.bathroomShowerRoughWallAccessSource === 'user_selected' ||
            sanitized.bathroomShowerRoughWallAccessSource === 'ai_inferred'
            ? sanitized.bathroomShowerRoughWallAccessSource
            : 'user_selected'
          : null,
    bathroomShowerRoughFloorConstruction:
      sanitized.bathroomShowerRoughFloorConstruction === 'wood_framed' ||
      sanitized.bathroomShowerRoughFloorConstruction === 'concrete_slab' ||
      sanitized.bathroomShowerRoughFloorConstruction === 'unsure'
        ? sanitized.bathroomShowerRoughFloorConstruction
        : null,
    bathroomShowerRoughFloorConstructionSource:
      sanitized.bathroomShowerRoughFloorConstructionSource ===
        'user_selected' ||
      sanitized.bathroomShowerRoughFloorConstructionSource === 'ai_inferred'
        ? sanitized.bathroomShowerRoughFloorConstructionSource
        : null,
    bathroomShowerRoughSlabWorkRequired:
      sanitized.bathroomShowerRoughSlabWorkRequired === 'yes' ||
      sanitized.bathroomShowerRoughSlabWorkRequired === 'no' ||
      sanitized.bathroomShowerRoughSlabWorkRequired === 'unsure'
        ? sanitized.bathroomShowerRoughSlabWorkRequired
        : null,
    bathroomShowerRoughSlabWorkRequiredSource:
      sanitized.bathroomShowerRoughSlabWorkRequiredSource === 'user_selected' ||
      sanitized.bathroomShowerRoughSlabWorkRequiredSource === 'ai_inferred'
        ? sanitized.bathroomShowerRoughSlabWorkRequiredSource
        : null,
    bathroomPaintRepairScope: sanitizeBathroomPaintRepairScopeForPersist(
      sanitized.bathroomPaintRepairScope
    ),
    bathroomPaintRepairScopeSource:
      sanitized.bathroomPaintRepairScopeSource === 'user_selected' ||
      sanitized.bathroomPaintRepairScopeSource === 'ai_inferred'
        ? sanitized.bathroomPaintRepairScopeSource
        : null,
    bathroomPaintRepairEntireRoom: sanitizeBathroomPaintRepairEntireRoom(
      sanitized.bathroomPaintRepairEntireRoom,
      sanitized.bathroomPaintRepairScope
    ),
    bathroomPaintRepairEntireRoomSource:
      sanitized.bathroomPaintRepairEntireRoomSource === 'user_selected' ||
      sanitized.bathroomPaintRepairEntireRoomSource === 'ai_inferred'
        ? sanitized.bathroomPaintRepairEntireRoomSource
        : sanitized.bathroomPaintRepairScope === 'entire_room' ||
            sanitized.bathroomPaintRepairScope === 'full_room'
          ? sanitized.bathroomPaintRepairScopeSource === 'user_selected' ||
            sanitized.bathroomPaintRepairScopeSource === 'ai_inferred'
            ? sanitized.bathroomPaintRepairScopeSource
            : null
          : null,
    bathroomPaintRepairEntireRoomSqft: measurementFieldString(
      sanitized.bathroomPaintRepairEntireRoomSqft
    ),
    bathroomPaintRepairEntireRoomSqftSource:
      sanitized.bathroomPaintRepairEntireRoomSqftSource === 'user_selected' ||
      sanitized.bathroomPaintRepairEntireRoomSqftSource === 'ai_inferred'
        ? sanitized.bathroomPaintRepairEntireRoomSqftSource
        : null,
    bathroomDrywallPaintUseCombinedAssembly:
      sanitized.bathroomDrywallPaintUseCombinedAssembly === true ||
      sanitized.bathroomDrywallPaintUseCombinedAssembly === false
        ? sanitized.bathroomDrywallPaintUseCombinedAssembly
        : null,
    bathroomDrywallPaintUseCombinedAssemblySource:
      sanitized.bathroomDrywallPaintUseCombinedAssemblySource ===
        'user_selected' ||
      sanitized.bathroomDrywallPaintUseCombinedAssemblySource === 'ai_inferred'
        ? sanitized.bathroomDrywallPaintUseCombinedAssemblySource
        : null,
    bathroomInteriorPaintMobilization:
      sanitized.bathroomInteriorPaintMobilization === 'bundled' ||
      sanitized.bathroomInteriorPaintMobilization === 'standalone' ||
      sanitized.bathroomInteriorPaintMobilization === 'unsure'
        ? sanitized.bathroomInteriorPaintMobilization
        : null,
    bathroomInteriorPaintMobilizationSource:
      sanitized.bathroomInteriorPaintMobilizationSource === 'user_selected' ||
      sanitized.bathroomInteriorPaintMobilizationSource === 'ai_inferred'
        ? sanitized.bathroomInteriorPaintMobilizationSource
        : null,
    bathroomInteriorPaintSurface:
      sanitized.bathroomInteriorPaintSurface === 'walls' ||
      sanitized.bathroomInteriorPaintSurface === 'ceiling' ||
      sanitized.bathroomInteriorPaintSurface === 'walls_and_ceiling' ||
      sanitized.bathroomInteriorPaintSurface === 'unsure'
        ? sanitized.bathroomInteriorPaintSurface
        : null,
    bathroomInteriorPaintSurfaceSource:
      sanitized.bathroomInteriorPaintSurfaceSource === 'user_selected' ||
      sanitized.bathroomInteriorPaintSurfaceSource === 'ai_inferred'
        ? sanitized.bathroomInteriorPaintSurfaceSource
        : null,
    bathroomInteriorPaintCondition:
      sanitized.bathroomInteriorPaintCondition === 'same_color' ||
      sanitized.bathroomInteriorPaintCondition === 'color_change' ||
      sanitized.bathroomInteriorPaintCondition === 'new_drywall' ||
      sanitized.bathroomInteriorPaintCondition === 'stained_damaged' ||
      sanitized.bathroomInteriorPaintCondition === 'unsure'
        ? sanitized.bathroomInteriorPaintCondition
        : null,
    bathroomInteriorPaintConditionSource:
      sanitized.bathroomInteriorPaintConditionSource === 'user_selected' ||
      sanitized.bathroomInteriorPaintConditionSource === 'ai_inferred'
        ? sanitized.bathroomInteriorPaintConditionSource
        : null,
    bathroomGlassDoorStyle:
      sanitized.bathroomGlassDoorStyle === 'standard_slider' ||
      sanitized.bathroomGlassDoorStyle === 'premium_frameless' ||
      sanitized.bathroomGlassDoorStyle === 'unsure'
        ? sanitized.bathroomGlassDoorStyle
        : null,
    bathroomGlassDoorStyleSource:
      sanitized.bathroomGlassDoorStyleSource === 'user_selected' ||
      sanitized.bathroomGlassDoorStyleSource === 'ai_inferred'
        ? sanitized.bathroomGlassDoorStyleSource
        : null,
    demoTubCount:
      sanitized.demoTubCount != null && Number(sanitized.demoTubCount) > 0
        ? Math.round(Number(sanitized.demoTubCount))
        : null,
    demoTileWallCount:
      sanitized.demoTileWallCount != null &&
      Number(sanitized.demoTileWallCount) > 0
        ? Math.round(Number(sanitized.demoTileWallCount))
        : null,
    demoTilePanCount:
      sanitized.demoTilePanCount != null &&
      Number(sanitized.demoTilePanCount) > 0
        ? Math.round(Number(sanitized.demoTilePanCount))
        : null,
    demoPrefabPanCount:
      sanitized.demoPrefabPanCount != null &&
      Number(sanitized.demoPrefabPanCount) > 0
        ? Math.round(Number(sanitized.demoPrefabPanCount))
        : null,
    demoPrefabEnclosureCount:
      sanitized.demoPrefabEnclosureCount != null &&
      Number(sanitized.demoPrefabEnclosureCount) > 0
        ? Math.round(Number(sanitized.demoPrefabEnclosureCount))
        : null,
    demoShowerDoorCount:
      sanitized.demoShowerDoorCount != null &&
      Number(sanitized.demoShowerDoorCount) > 0
        ? Math.round(Number(sanitized.demoShowerDoorCount))
        : null,
    demoBathFloorTileCount:
      sanitized.demoBathFloorTileCount != null &&
      Number(sanitized.demoBathFloorTileCount) > 0
        ? Math.round(Number(sanitized.demoBathFloorTileCount))
        : null,
    reuseExistingShowerDoor: sanitized.reuseExistingShowerDoor ? true : null,
    demoWetAreaManualOverrides:
      sanitized.demoWetAreaManualOverrides &&
      Object.keys(sanitized.demoWetAreaManualOverrides).length
        ? sanitized.demoWetAreaManualOverrides
        : undefined,
    kitchenExistingCabinetCount:
      sanitized.kitchenExistingCabinetCount != null &&
      Number(sanitized.kitchenExistingCabinetCount) > 0
        ? Math.round(Number(sanitized.kitchenExistingCabinetCount))
        : null,
    kitchenExistingCounterCount:
      sanitized.kitchenExistingCounterCount != null &&
      Number(sanitized.kitchenExistingCounterCount) > 0
        ? Math.round(Number(sanitized.kitchenExistingCounterCount))
        : null,
    kitchenExistingApplianceCount:
      sanitized.kitchenExistingApplianceCount != null &&
      Number(sanitized.kitchenExistingApplianceCount) > 0
        ? Math.round(Number(sanitized.kitchenExistingApplianceCount))
        : null,
    kitchenExistingBacksplashCount:
      sanitized.kitchenExistingBacksplashCount != null &&
      Number(sanitized.kitchenExistingBacksplashCount) > 0
        ? Math.round(Number(sanitized.kitchenExistingBacksplashCount))
        : null,
    kitchenExistingFloorCount:
      sanitized.kitchenExistingFloorCount != null &&
      Number(sanitized.kitchenExistingFloorCount) > 0
        ? Math.round(Number(sanitized.kitchenExistingFloorCount))
        : null,
    kitchenInstallCabinetCount:
      sanitized.kitchenInstallCabinetCount != null &&
      Number(sanitized.kitchenInstallCabinetCount) > 0
        ? Math.round(Number(sanitized.kitchenInstallCabinetCount))
        : null,
    kitchenInstallCounterCount:
      sanitized.kitchenInstallCounterCount != null &&
      Number(sanitized.kitchenInstallCounterCount) > 0
        ? Math.round(Number(sanitized.kitchenInstallCounterCount))
        : null,
    kitchenInstallApplianceCount:
      sanitized.kitchenInstallApplianceCount != null &&
      Number(sanitized.kitchenInstallApplianceCount) > 0
        ? Math.round(Number(sanitized.kitchenInstallApplianceCount))
        : null,
    kitchenInstallBacksplashCount:
      sanitized.kitchenInstallBacksplashCount != null &&
      Number(sanitized.kitchenInstallBacksplashCount) > 0
        ? Math.round(Number(sanitized.kitchenInstallBacksplashCount))
        : null,
    kitchenInstallFlooringCount:
      sanitized.kitchenInstallFlooringCount != null &&
      Number(sanitized.kitchenInstallFlooringCount) > 0
        ? Math.round(Number(sanitized.kitchenInstallFlooringCount))
        : null,
    kitchenInstallIslandCount:
      sanitized.kitchenInstallIslandCount != null &&
      Number(sanitized.kitchenInstallIslandCount) > 0
        ? Math.round(Number(sanitized.kitchenInstallIslandCount))
        : null,
    kitchenDemoCabinetCount:
      sanitized.kitchenDemoCabinetCount != null &&
      Number(sanitized.kitchenDemoCabinetCount) > 0
        ? Math.round(Number(sanitized.kitchenDemoCabinetCount))
        : null,
    kitchenDemoCounterCount:
      sanitized.kitchenDemoCounterCount != null &&
      Number(sanitized.kitchenDemoCounterCount) > 0
        ? Math.round(Number(sanitized.kitchenDemoCounterCount))
        : null,
    kitchenDemoIslandCount:
      sanitized.kitchenDemoIslandCount != null &&
      Number(sanitized.kitchenDemoIslandCount) > 0
        ? Math.round(Number(sanitized.kitchenDemoIslandCount))
        : null,
    kitchenDemoApplianceCount:
      sanitized.kitchenDemoApplianceCount != null &&
      Number(sanitized.kitchenDemoApplianceCount) > 0
        ? Math.round(Number(sanitized.kitchenDemoApplianceCount))
        : null,
    kitchenDemoFloorCount:
      sanitized.kitchenDemoFloorCount != null &&
      Number(sanitized.kitchenDemoFloorCount) > 0
        ? Math.round(Number(sanitized.kitchenDemoFloorCount))
        : null,
    kitchenDemoWallCount:
      sanitized.kitchenDemoWallCount != null &&
      Number(sanitized.kitchenDemoWallCount) > 0
        ? Math.round(Number(sanitized.kitchenDemoWallCount))
        : null,
    flooringExistingCount:
      sanitized.flooringExistingCount != null &&
      Number(sanitized.flooringExistingCount) > 0
        ? Math.round(Number(sanitized.flooringExistingCount))
        : null,
    flooringExistingTypes: Array.isArray(sanitized.flooringExistingTypes)
      ? sanitized.flooringExistingTypes
      : null,
    flooringInstallScopeCount:
      sanitized.flooringInstallScopeCount != null &&
      Number(sanitized.flooringInstallScopeCount) > 0
        ? Math.round(Number(sanitized.flooringInstallScopeCount))
        : null,
    flooringDemoScopeCount:
      sanitized.flooringDemoScopeCount != null &&
      Number(sanitized.flooringDemoScopeCount) > 0
        ? Math.round(Number(sanitized.flooringDemoScopeCount))
        : null,
    garageDoorSingleCount:
      sanitized.garageDoorSingleCount != null &&
      Number(sanitized.garageDoorSingleCount) > 0
        ? Math.round(Number(sanitized.garageDoorSingleCount))
        : null,
    garageDoorDoubleCount:
      sanitized.garageDoorDoubleCount != null &&
      Number(sanitized.garageDoorDoubleCount) > 0
        ? Math.round(Number(sanitized.garageDoorDoubleCount))
        : null,
    garageDoorRvCount:
      sanitized.garageDoorRvCount != null &&
      Number(sanitized.garageDoorRvCount) > 0
        ? Math.round(Number(sanitized.garageDoorRvCount))
        : null,
    garageDoorOpenerCount:
      sanitized.garageDoorOpenerCount != null &&
      Number(sanitized.garageDoorOpenerCount) > 0
        ? Math.round(Number(sanitized.garageDoorOpenerCount))
        : null,
    baseboardLf: parseScopeMeasurementInput(sanitized.baseboardLf),
    ...copyPlumbingQuantityFields(sanitized as Record<string, unknown>),
    plumbingScope: Array.isArray(sanitized.plumbingScope)
      ? sanitized.plumbingScope
      : undefined,
    ...copyFramingQuantityFields(sanitized as Record<string, unknown>),
    framingScope: Array.isArray(sanitized.framingScope)
      ? sanitized.framingScope
      : undefined,
    ...copyDrywallQuantityFields(sanitized as Record<string, unknown>),
    showerWallTileSqft: parseScopeMeasurementInput(
      sanitized.showerWallTileSqft
    ),
    showerFloorTileSqft: parseScopeMeasurementInput(
      sanitized.showerFloorTileSqft
    ),
    wallPaintSqft: parseScopeMeasurementInput(sanitized.wallPaintSqft),
    sqft: parseScopeMeasurementInput(sanitized.bathroomFloorSqft),
    lf: parseScopeMeasurementInput(sanitized.baseboardLf),
    itemQuantities: Object.keys(itemQuantities).length
      ? itemQuantities
      : undefined,
    pricingAcceptance:
      input.pricingAcceptance && Object.keys(input.pricingAcceptance).length
        ? input.pricingAcceptance
        : undefined,
    scopeGapResolutions:
      input.scopeGapResolutions && Object.keys(input.scopeGapResolutions).length
        ? input.scopeGapResolutions
        : undefined,
    quickMeasurementSources:
      input.quickMeasurementSources &&
      Object.keys(input.quickMeasurementSources).length
        ? input.quickMeasurementSources
        : undefined,
    quickMeasurementUserOverrides:
      input.quickMeasurementUserOverrides &&
      Object.keys(input.quickMeasurementUserOverrides).length
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
    measurementProvenance: input.measurementProvenance,
    measurementConflicts: input.measurementConflicts,
    electricalValidation: input.electricalValidation,
    planImportMode: input.planImportMode ?? null,
    planImportTradeKey: input.planImportTradeKey ?? null,
    planImportFingerprint: input.planImportFingerprint ?? null,
    planImportMissingInfo: Array.isArray(input.planImportMissingInfo)
      ? input.planImportMissingInfo
      : undefined,
    plumbingWorkflowMode: input.plumbingWorkflowMode ?? null,
    plumbingPerformerMode: input.plumbingPerformerMode ?? null,
    projectComplexity: input.projectComplexity ?? null,
    plumbingComplexityFactors: input.plumbingComplexityFactors ?? null,
    tradeWorkflowSource: input.tradeWorkflowSource ?? null,
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
  const input: ScopeMeasurementsInputExtended = {
    ...base,
    paintScope: payload.paintScope ?? null,
    ...Object.fromEntries(
      Object.entries(
        copyElectricalQuantityFields(payload as Record<string, unknown>)
      ).map(([key, value]) => [key, value != null ? String(value) : ''])
    ),
    ...Object.fromEntries(
      Object.entries(
        copyPlumbingQuantityFields(payload as Record<string, unknown>)
      ).map(([key, value]) => [key, value != null ? String(value) : ''])
    ),
    ...Object.fromEntries(
      Object.entries(
        copyFramingQuantityFields(payload as Record<string, unknown>)
      ).map(([key, value]) => [key, value != null ? String(value) : ''])
    ),
    framingScope: Array.isArray(payload.framingScope)
      ? payload.framingScope
      : null,
    ...Object.fromEntries(
      Object.entries(
        copyDrywallQuantityFields(payload as Record<string, unknown>)
      ).map(([key, value]) => [key, value != null ? String(value) : ''])
    ),
    ...Object.fromEntries(
      Object.entries(
        copyHvacQuantityFields(payload as Record<string, unknown>)
      ).map(([key, value]) => [key, value != null ? String(value) : ''])
    ),
    ...copyElectricalConditionFields(payload as Record<string, unknown>),
    bathroomFloorSqft: measurementFieldString(
      payload.bathroomFloorSqft ?? payload.sqft
    ),
    kitchenFloorSqft: measurementFieldString(payload.kitchenFloorSqft),
    floorAreaSqft: measurementFieldString(payload.floorAreaSqft),
    flooringSqft: measurementFieldString(payload.flooringSqft),
    backsplashSqft: measurementFieldString(payload.backsplashSqft),
    countertopSqft: measurementFieldString(payload.countertopSqft),
    cabinetLf: measurementFieldString(payload.cabinetLf),
    landscapeSqft: measurementFieldString(payload.landscapeSqft),
    artificialTurfSqft: measurementFieldString(payload.artificialTurfSqft),
    demoClearingSqft: measurementFieldString(payload.demoClearingSqft),
    gradingSqft: measurementFieldString(payload.gradingSqft),
    soilPrepSqft: measurementFieldString(payload.soilPrepSqft),
    sodSqft: measurementFieldString(payload.sodSqft),
    paverSqft: measurementFieldString(payload.paverSqft),
    rockMulchSqft: measurementFieldString(payload.rockMulchSqft),
    landscapeTons: measurementFieldString(payload.landscapeTons),
    plantCount: measurementFieldString(payload.plantCount),
    treeCount: measurementFieldString(payload.treeCount),
    irrigationZoneCount: measurementFieldString(payload.irrigationZoneCount),
    drainageLf: measurementFieldString(payload.drainageLf),
    concreteEdgingLf: measurementFieldString(payload.concreteEdgingLf),
    boulderCount: measurementFieldString(payload.boulderCount),
    landscapeLightCount: measurementFieldString(payload.landscapeLightCount),
    landscapeScope: Array.isArray(payload.landscapeScope)
      ? payload.landscapeScope
      : null,
    landscapeClearingLevel: payload.landscapeClearingLevel ?? null,
    tradeScopeSelections: payload.tradeScopeSelections ?? null,
    roofAreaSqft: measurementFieldString(payload.roofAreaSqft),
    roofIceWaterShieldSqft: measurementFieldString(
      payload.roofIceWaterShieldSqft
    ),
    roofSquares: measurementFieldString(payload.roofSquares),
    roofPitch: payload.roofPitch ?? null,
    storyCount: measurementFieldString(payload.storyCount),
    roofDeckingReplacementSqft: measurementFieldString(
      payload.roofDeckingReplacementSqft
    ),
    roofDripEdgeLf: measurementFieldString(payload.roofDripEdgeLf),
    roofRidgeCapLf: measurementFieldString(payload.roofRidgeCapLf),
    roofRidgeVentLf: measurementFieldString(payload.roofRidgeVentLf),
    roofValleyFlashingLf: measurementFieldString(payload.roofValleyFlashingLf),
    roofStepFlashingLf: measurementFieldString(payload.roofStepFlashingLf),
    roofWallFlashingLf: measurementFieldString(payload.roofWallFlashingLf),
    roofChimneyFlashingCount: measurementFieldString(
      payload.roofChimneyFlashingCount
    ),
    roofPipeBootCount: measurementFieldString(payload.roofPipeBootCount),
    roofVentCount: measurementFieldString(payload.roofVentCount),
    roofTurbineVentCount: measurementFieldString(payload.roofTurbineVentCount),
    roofSkylightCount: measurementFieldString(payload.roofSkylightCount),
    roofPenetrationCount: measurementFieldString(payload.roofPenetrationCount),
    roofRepairAffectedSqft: measurementFieldString(
      payload.roofRepairAffectedSqft
    ),
    roofGutterLf: measurementFieldString(payload.roofGutterLf),
    roofDownspoutCount: measurementFieldString(payload.roofDownspoutCount),
    concreteSqft: measurementFieldString(payload.concreteSqft),
    concreteReinforcementSqft: measurementFieldString(
      payload.concreteReinforcementSqft
    ),
    concreteSealerSqft: measurementFieldString(payload.concreteSealerSqft),
    concreteSubgradePrepSqft: measurementFieldString(
      payload.concreteSubgradePrepSqft
    ),
    concreteAreaByType: payload.concreteAreaByType ?? null,
    concreteThicknessByType: payload.concreteThicknessByType ?? null,
    concreteThicknessInches: measurementFieldString(
      payload.concreteThicknessInches
    ),
    concreteDecorativeFinish: payload.concreteDecorativeFinish ?? null,
    complexFormingLf: measurementFieldString(payload.complexFormingLf),
    additionalHaulOffLoadCount: measurementFieldString(
      payload.additionalHaulOffLoadCount
    ),
    concreteDemoSqft: measurementFieldString(payload.concreteDemoSqft),
    concreteDemoThicknessBand: payload.concreteDemoThicknessBand ?? null,
    concreteDemoThicknessBands: payload.concreteDemoThicknessBands ?? null,
    concreteDemoAreaByThickness: payload.concreteDemoAreaByThickness ?? null,
    concreteDemoReinforced: payload.concreteDemoReinforced ?? null,
    concreteDemoLimitedAccess: payload.concreteDemoLimitedAccess ?? null,
    concreteDemoCy: measurementFieldString(payload.concreteDemoCy),
    concreteCy: measurementFieldString(payload.concreteCy),
    excavationCy: measurementFieldString(payload.excavationCy),
    excavationAreaSqft: measurementFieldString(payload.excavationAreaSqft),
    excavationDepthInches: measurementFieldString(
      payload.excavationDepthInches
    ),
    excavationQuantityMode: payload.excavationQuantityMode ?? null,
    concreteScope: Array.isArray(payload.concreteScope)
      ? payload.concreteScope
      : null,
    deckSqft: measurementFieldString(payload.deckSqft),
    garageSqft: measurementFieldString(payload.garageSqft),
    exteriorPaintSqft: measurementFieldString(payload.exteriorPaintSqft),
    stuccoGrossWallSqft: measurementFieldString(payload.stuccoGrossWallSqft),
    stuccoWindowDoorOpeningSqft: measurementFieldString(
      payload.stuccoWindowDoorOpeningSqft
    ),
    stuccoGarageOpeningSqft: measurementFieldString(
      payload.stuccoGarageOpeningSqft
    ),
    stuccoOtherFinishDeductionSqft: measurementFieldString(
      payload.stuccoOtherFinishDeductionSqft
    ),
    stuccoNetWallSqft: measurementFieldString(payload.stuccoNetWallSqft),
    stuccoSoffitSqft: measurementFieldString(payload.stuccoSoffitSqft),
    stuccoParapetSqft: measurementFieldString(payload.stuccoParapetSqft),
    stuccoFoamTrimLf: measurementFieldString(payload.stuccoFoamTrimLf),
    stuccoControlJointLf: measurementFieldString(payload.stuccoControlJointLf),
    stuccoAccessAffectedSqft: measurementFieldString(
      payload.stuccoAccessAffectedSqft
    ),
    stuccoRepairAffectedSqft: measurementFieldString(
      payload.stuccoRepairAffectedSqft
    ),
    stuccoStories: measurementFieldString(payload.stuccoStories),
    stuccoWallHeightFt: measurementFieldString(payload.stuccoWallHeightFt),
    ...Object.fromEntries(
      Object.entries(
        copyInsulationScopeNumericFields(
          payload as Record<string, unknown>,
          value => {
            const n = Number(value);
            return Number.isFinite(n) && n > 0 ? n : null;
          }
        )
      ).map(([key, value]) => [key, value != null ? String(value) : ''])
    ),
    ...Object.fromEntries(
      Object.entries(
        copyInsulationScopeTextFields(payload as Record<string, unknown>)
      ).map(([key, value]) => [key, value ?? ''])
    ),
    insulationAssemblies: copyInsulationAssemblyFields(
      payload as Record<string, unknown>
    ),
    railingLf: measurementFieldString(payload.railingLf),
    baseboardLf: measurementFieldString(payload.baseboardLf),
    showerWallTileSqft: measurementFieldString(payload.showerWallTileSqft),
    showerFloorTileSqft: measurementFieldString(payload.showerFloorTileSqft),
    wallPaintSqft: measurementFieldString(payload.wallPaintSqft),
    ceilingPaintSqft: measurementFieldString(payload.ceilingPaintSqft),
    paintAreaSqft: measurementFieldString(payload.paintAreaSqft),
    paintAreaBasis: payload.paintAreaBasis ?? null,
    paintAreaNeedsConfirmation: payload.paintAreaNeedsConfirmation ?? null,
    paintPricingMethod: payload.paintPricingMethod ?? null,
    combinedPaintableAreaSqft: measurementFieldString(
      payload.combinedPaintableAreaSqft
    ),
    originalPaintAreaReferenceSqft: measurementFieldString(
      payload.originalPaintAreaReferenceSqft
    ),
    paintOccupancy: payload.paintOccupancy ?? null,
    paintApplicationMethod: payload.paintApplicationMethod ?? null,
    paintOccupancyConfirmed: payload.paintOccupancyConfirmed ?? null,
    paintApplicationMethodConfirmed:
      payload.paintApplicationMethodConfirmed ?? null,
    cabinetMeasurementMethod: payload.cabinetMeasurementMethod ?? null,
    interiorDoorCount: measurementFieldString(payload.interiorDoorCount),
    windowCount: measurementFieldString(payload.windowCount),
    exteriorDoorCount: measurementFieldString(payload.exteriorDoorCount),
    slidingDoorCount: measurementFieldString(payload.slidingDoorCount),
    garageDoorSingleCount: measurementFieldString(
      payload.garageDoorSingleCount
    ),
    garageDoorDoubleCount: measurementFieldString(
      payload.garageDoorDoubleCount
    ),
    garageDoorRvCount: measurementFieldString(payload.garageDoorRvCount),
    garageDoorOpenerCount: measurementFieldString(
      payload.garageDoorOpenerCount
    ),
    framingOpeningCount: measurementFieldString(payload.framingOpeningCount),
    reframingRequested: payload.reframingRequested === true ? true : null,
    cabinetPaintSqft: measurementFieldString(payload.cabinetPaintSqft),
    cabinetUpperLf: measurementFieldString(payload.cabinetUpperLf),
    cabinetLowerLf: measurementFieldString(payload.cabinetLowerLf),
    cabinetTallLf: measurementFieldString(payload.cabinetTallLf),
    cabinetRunLf: measurementFieldString(payload.cabinetRunLf),
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
    tilePanBathCount:
      payload.tilePanBathCount != null && Number(payload.tilePanBathCount) > 0
        ? Math.round(Number(payload.tilePanBathCount))
        : null,
    prefabBathCount:
      payload.prefabBathCount != null && Number(payload.prefabBathCount) > 0
        ? Math.round(Number(payload.prefabBathCount))
        : null,
    prefabEnclosureBathCount:
      payload.prefabEnclosureBathCount != null &&
      Number(payload.prefabEnclosureBathCount) > 0
        ? Math.round(Number(payload.prefabEnclosureBathCount))
        : null,
    tubBathCount:
      payload.tubBathCount != null && Number(payload.tubBathCount) > 0
        ? Math.round(Number(payload.tubBathCount))
        : null,
    bathFloorTileCount:
      payload.bathFloorTileCount != null &&
      Number(payload.bathFloorTileCount) > 0
        ? Math.round(Number(payload.bathFloorTileCount))
        : null,
    showerDoorCount:
      payload.showerDoorCount != null && Number(payload.showerDoorCount) > 0
        ? Math.round(Number(payload.showerDoorCount))
        : null,
    existingTubCount:
      payload.existingTubCount != null && Number(payload.existingTubCount) > 0
        ? Math.round(Number(payload.existingTubCount))
        : null,
    existingTileWallCount:
      payload.existingTileWallCount != null &&
      Number(payload.existingTileWallCount) > 0
        ? Math.round(Number(payload.existingTileWallCount))
        : null,
    existingTilePanCount:
      payload.existingTilePanCount != null &&
      Number(payload.existingTilePanCount) > 0
        ? Math.round(Number(payload.existingTilePanCount))
        : null,
    existingPrefabPanCount:
      payload.existingPrefabPanCount != null &&
      Number(payload.existingPrefabPanCount) > 0
        ? Math.round(Number(payload.existingPrefabPanCount))
        : null,
    existingPrefabEnclosureCount:
      payload.existingPrefabEnclosureCount != null &&
      Number(payload.existingPrefabEnclosureCount) > 0
        ? Math.round(Number(payload.existingPrefabEnclosureCount))
        : null,
    existingShowerDoorCount:
      payload.existingShowerDoorCount != null &&
      Number(payload.existingShowerDoorCount) > 0
        ? Math.round(Number(payload.existingShowerDoorCount))
        : null,
    existingBathFloorTileCount:
      payload.existingBathFloorTileCount != null &&
      Number(payload.existingBathFloorTileCount) > 0
        ? Math.round(Number(payload.existingBathFloorTileCount))
        : null,
    bathroomExistingVanityCount:
      payload.bathroomExistingVanityCount != null &&
      Number(payload.bathroomExistingVanityCount) > 0
        ? Math.round(Number(payload.bathroomExistingVanityCount))
        : null,
    bathroomExistingCounterCount:
      payload.bathroomExistingCounterCount != null &&
      Number(payload.bathroomExistingCounterCount) > 0
        ? Math.round(Number(payload.bathroomExistingCounterCount))
        : null,
    bathroomInstallVanityCount:
      payload.bathroomInstallVanityCount != null &&
      Number(payload.bathroomInstallVanityCount) > 0
        ? Math.round(Number(payload.bathroomInstallVanityCount))
        : null,
    bathroomInstallCounterCount:
      payload.bathroomInstallCounterCount != null &&
      Number(payload.bathroomInstallCounterCount) > 0
        ? Math.round(Number(payload.bathroomInstallCounterCount))
        : null,
    bathroomDemoVanityCount:
      payload.bathroomDemoVanityCount != null &&
      Number(payload.bathroomDemoVanityCount) > 0
        ? Math.round(Number(payload.bathroomDemoVanityCount))
        : null,
    bathroomDemoCounterCount:
      payload.bathroomDemoCounterCount != null &&
      Number(payload.bathroomDemoCounterCount) > 0
        ? Math.round(Number(payload.bathroomDemoCounterCount))
        : null,
    bathroomVanityCountertopMaterialType:
      typeof payload.bathroomVanityCountertopMaterialType === 'string' &&
      payload.bathroomVanityCountertopMaterialType.trim()
        ? payload.bathroomVanityCountertopMaterialType.trim()
        : null,
    bathroomToiletRelocateFloorType:
      payload.bathroomToiletRelocateFloorType === 'open_wood_framed' ||
      payload.bathroomToiletRelocateFloorType === 'finished_wood_framed' ||
      payload.bathroomToiletRelocateFloorType === 'concrete_slab' ||
      payload.bathroomToiletRelocateFloorType === 'unsure'
        ? payload.bathroomToiletRelocateFloorType
        : null,
    bathroomToiletRelocateFloorTypeSource:
      payload.bathroomToiletRelocateFloorTypeSource === 'user_selected' ||
      payload.bathroomToiletRelocateFloorTypeSource === 'ai_inferred'
        ? payload.bathroomToiletRelocateFloorTypeSource
        : null,
    bathroomShowerRoughAccessType:
      payload.bathroomShowerRoughAccessType === 'open_wood_framed' ||
      payload.bathroomShowerRoughAccessType === 'finished_wood_framed' ||
      payload.bathroomShowerRoughAccessType === 'concrete_slab' ||
      payload.bathroomShowerRoughAccessType === 'unsure'
        ? payload.bathroomShowerRoughAccessType
        : null,
    bathroomShowerRoughAccessTypeSource:
      payload.bathroomShowerRoughAccessTypeSource === 'user_selected' ||
      payload.bathroomShowerRoughAccessTypeSource === 'ai_inferred'
        ? payload.bathroomShowerRoughAccessTypeSource
        : null,
    bathroomShowerRoughWorkType:
      payload.bathroomShowerRoughWorkType === 'in_place' ||
      payload.bathroomShowerRoughWorkType === 'relocation' ||
      payload.bathroomShowerRoughWorkType === 'unsure'
        ? payload.bathroomShowerRoughWorkType
        : null,
    bathroomShowerRoughWorkTypeSource:
      payload.bathroomShowerRoughWorkTypeSource === 'user_selected' ||
      payload.bathroomShowerRoughWorkTypeSource === 'ai_inferred'
        ? payload.bathroomShowerRoughWorkTypeSource
        : null,
    bathroomShowerRoughFixtureType:
      payload.bathroomShowerRoughFixtureType === 'shower' ||
      payload.bathroomShowerRoughFixtureType === 'bathtub' ||
      payload.bathroomShowerRoughFixtureType === 'tub_shower_combo' ||
      payload.bathroomShowerRoughFixtureType === 'unsure'
        ? payload.bathroomShowerRoughFixtureType
        : null,
    bathroomShowerRoughFixtureTypeSource:
      payload.bathroomShowerRoughFixtureTypeSource === 'user_selected' ||
      payload.bathroomShowerRoughFixtureTypeSource === 'ai_inferred'
        ? payload.bathroomShowerRoughFixtureTypeSource
        : null,
    bathroomShowerRoughWallAccess:
      payload.bathroomShowerRoughWallAccess === 'open_framing' ||
      payload.bathroomShowerRoughWallAccess === 'finished_wall' ||
      payload.bathroomShowerRoughWallAccess === 'unsure'
        ? payload.bathroomShowerRoughWallAccess
        : null,
    bathroomShowerRoughWallAccessSource:
      payload.bathroomShowerRoughWallAccessSource === 'user_selected' ||
      payload.bathroomShowerRoughWallAccessSource === 'ai_inferred'
        ? payload.bathroomShowerRoughWallAccessSource
        : null,
    bathroomShowerRoughPlumbingExposed:
      payload.bathroomShowerRoughPlumbingExposed === 'exposed_by_demo' ||
      payload.bathroomShowerRoughPlumbingExposed ===
        'separate_access_required' ||
      payload.bathroomShowerRoughPlumbingExposed === 'unsure'
        ? payload.bathroomShowerRoughPlumbingExposed
        : payload.bathroomShowerRoughWallAccess === 'open_framing'
          ? 'exposed_by_demo'
          : payload.bathroomShowerRoughWallAccess === 'finished_wall'
            ? 'separate_access_required'
            : null,
    bathroomShowerRoughPlumbingExposedSource:
      payload.bathroomShowerRoughPlumbingExposedSource === 'user_selected' ||
      payload.bathroomShowerRoughPlumbingExposedSource === 'demo_detected' ||
      payload.bathroomShowerRoughPlumbingExposedSource === 'ai_inferred'
        ? payload.bathroomShowerRoughPlumbingExposedSource
        : payload.bathroomShowerRoughWallAccess === 'open_framing' ||
            payload.bathroomShowerRoughWallAccess === 'finished_wall'
          ? payload.bathroomShowerRoughWallAccessSource === 'user_selected' ||
            payload.bathroomShowerRoughWallAccessSource === 'ai_inferred'
            ? payload.bathroomShowerRoughWallAccessSource
            : 'user_selected'
          : null,
    bathroomShowerRoughFloorConstruction:
      payload.bathroomShowerRoughFloorConstruction === 'wood_framed' ||
      payload.bathroomShowerRoughFloorConstruction === 'concrete_slab' ||
      payload.bathroomShowerRoughFloorConstruction === 'unsure'
        ? payload.bathroomShowerRoughFloorConstruction
        : null,
    bathroomShowerRoughFloorConstructionSource:
      payload.bathroomShowerRoughFloorConstructionSource === 'user_selected' ||
      payload.bathroomShowerRoughFloorConstructionSource === 'ai_inferred'
        ? payload.bathroomShowerRoughFloorConstructionSource
        : null,
    bathroomShowerRoughSlabWorkRequired:
      payload.bathroomShowerRoughSlabWorkRequired === 'yes' ||
      payload.bathroomShowerRoughSlabWorkRequired === 'no' ||
      payload.bathroomShowerRoughSlabWorkRequired === 'unsure'
        ? payload.bathroomShowerRoughSlabWorkRequired
        : null,
    bathroomShowerRoughSlabWorkRequiredSource:
      payload.bathroomShowerRoughSlabWorkRequiredSource === 'user_selected' ||
      payload.bathroomShowerRoughSlabWorkRequiredSource === 'ai_inferred'
        ? payload.bathroomShowerRoughSlabWorkRequiredSource
        : null,
    bathroomPaintRepairScope: sanitizeBathroomPaintRepairScopeForPersist(
      payload.bathroomPaintRepairScope
    ),
    bathroomPaintRepairScopeSource:
      payload.bathroomPaintRepairScopeSource === 'user_selected' ||
      payload.bathroomPaintRepairScopeSource === 'ai_inferred'
        ? payload.bathroomPaintRepairScopeSource
        : null,
    bathroomPaintRepairEntireRoom: sanitizeBathroomPaintRepairEntireRoom(
      payload.bathroomPaintRepairEntireRoom,
      payload.bathroomPaintRepairScope
    ),
    bathroomPaintRepairEntireRoomSource:
      payload.bathroomPaintRepairEntireRoomSource === 'user_selected' ||
      payload.bathroomPaintRepairEntireRoomSource === 'ai_inferred'
        ? payload.bathroomPaintRepairEntireRoomSource
        : payload.bathroomPaintRepairScope === 'entire_room'
          ? payload.bathroomPaintRepairScopeSource === 'user_selected' ||
            payload.bathroomPaintRepairScopeSource === 'ai_inferred'
            ? payload.bathroomPaintRepairScopeSource
            : null
          : null,
    bathroomPaintRepairEntireRoomSqft: measurementFieldString(
      payload.bathroomPaintRepairEntireRoomSqft
    ),
    bathroomPaintRepairEntireRoomSqftSource:
      payload.bathroomPaintRepairEntireRoomSqftSource === 'user_selected' ||
      payload.bathroomPaintRepairEntireRoomSqftSource === 'ai_inferred'
        ? payload.bathroomPaintRepairEntireRoomSqftSource
        : null,
    bathroomDrywallPaintUseCombinedAssembly:
      payload.bathroomDrywallPaintUseCombinedAssembly === true ||
      payload.bathroomDrywallPaintUseCombinedAssembly === false
        ? payload.bathroomDrywallPaintUseCombinedAssembly
        : null,
    bathroomDrywallPaintUseCombinedAssemblySource:
      payload.bathroomDrywallPaintUseCombinedAssemblySource ===
        'user_selected' ||
      payload.bathroomDrywallPaintUseCombinedAssemblySource === 'ai_inferred'
        ? payload.bathroomDrywallPaintUseCombinedAssemblySource
        : null,
    bathroomInteriorPaintMobilization:
      payload.bathroomInteriorPaintMobilization === 'bundled' ||
      payload.bathroomInteriorPaintMobilization === 'standalone' ||
      payload.bathroomInteriorPaintMobilization === 'unsure'
        ? payload.bathroomInteriorPaintMobilization
        : null,
    bathroomInteriorPaintMobilizationSource:
      payload.bathroomInteriorPaintMobilizationSource === 'user_selected' ||
      payload.bathroomInteriorPaintMobilizationSource === 'ai_inferred'
        ? payload.bathroomInteriorPaintMobilizationSource
        : null,
    bathroomInteriorPaintSurface:
      payload.bathroomInteriorPaintSurface === 'walls' ||
      payload.bathroomInteriorPaintSurface === 'ceiling' ||
      payload.bathroomInteriorPaintSurface === 'walls_and_ceiling' ||
      payload.bathroomInteriorPaintSurface === 'unsure'
        ? payload.bathroomInteriorPaintSurface
        : null,
    bathroomInteriorPaintSurfaceSource:
      payload.bathroomInteriorPaintSurfaceSource === 'user_selected' ||
      payload.bathroomInteriorPaintSurfaceSource === 'ai_inferred'
        ? payload.bathroomInteriorPaintSurfaceSource
        : null,
    bathroomInteriorPaintCondition:
      payload.bathroomInteriorPaintCondition === 'same_color' ||
      payload.bathroomInteriorPaintCondition === 'color_change' ||
      payload.bathroomInteriorPaintCondition === 'new_drywall' ||
      payload.bathroomInteriorPaintCondition === 'stained_damaged' ||
      payload.bathroomInteriorPaintCondition === 'unsure'
        ? payload.bathroomInteriorPaintCondition
        : null,
    bathroomInteriorPaintConditionSource:
      payload.bathroomInteriorPaintConditionSource === 'user_selected' ||
      payload.bathroomInteriorPaintConditionSource === 'ai_inferred'
        ? payload.bathroomInteriorPaintConditionSource
        : null,
    bathroomGlassDoorStyle:
      payload.bathroomGlassDoorStyle === 'standard_slider' ||
      payload.bathroomGlassDoorStyle === 'premium_frameless' ||
      payload.bathroomGlassDoorStyle === 'unsure'
        ? payload.bathroomGlassDoorStyle
        : null,
    bathroomGlassDoorStyleSource:
      payload.bathroomGlassDoorStyleSource === 'user_selected' ||
      payload.bathroomGlassDoorStyleSource === 'ai_inferred'
        ? payload.bathroomGlassDoorStyleSource
        : null,
    demoTubCount:
      payload.demoTubCount != null && Number(payload.demoTubCount) > 0
        ? Math.round(Number(payload.demoTubCount))
        : null,
    demoTileWallCount:
      payload.demoTileWallCount != null && Number(payload.demoTileWallCount) > 0
        ? Math.round(Number(payload.demoTileWallCount))
        : null,
    demoTilePanCount:
      payload.demoTilePanCount != null && Number(payload.demoTilePanCount) > 0
        ? Math.round(Number(payload.demoTilePanCount))
        : null,
    demoPrefabPanCount:
      payload.demoPrefabPanCount != null &&
      Number(payload.demoPrefabPanCount) > 0
        ? Math.round(Number(payload.demoPrefabPanCount))
        : null,
    demoPrefabEnclosureCount:
      payload.demoPrefabEnclosureCount != null &&
      Number(payload.demoPrefabEnclosureCount) > 0
        ? Math.round(Number(payload.demoPrefabEnclosureCount))
        : null,
    demoShowerDoorCount:
      payload.demoShowerDoorCount != null &&
      Number(payload.demoShowerDoorCount) > 0
        ? Math.round(Number(payload.demoShowerDoorCount))
        : null,
    demoBathFloorTileCount:
      payload.demoBathFloorTileCount != null &&
      Number(payload.demoBathFloorTileCount) > 0
        ? Math.round(Number(payload.demoBathFloorTileCount))
        : null,
    reuseExistingShowerDoor: payload.reuseExistingShowerDoor ? true : null,
    demoWetAreaManualOverrides: payload.demoWetAreaManualOverrides,
    kitchenExistingCabinetCount:
      payload.kitchenExistingCabinetCount != null &&
      Number(payload.kitchenExistingCabinetCount) > 0
        ? Math.round(Number(payload.kitchenExistingCabinetCount))
        : null,
    kitchenExistingCounterCount:
      payload.kitchenExistingCounterCount != null &&
      Number(payload.kitchenExistingCounterCount) > 0
        ? Math.round(Number(payload.kitchenExistingCounterCount))
        : null,
    kitchenExistingApplianceCount:
      payload.kitchenExistingApplianceCount != null &&
      Number(payload.kitchenExistingApplianceCount) > 0
        ? Math.round(Number(payload.kitchenExistingApplianceCount))
        : null,
    kitchenExistingBacksplashCount:
      payload.kitchenExistingBacksplashCount != null &&
      Number(payload.kitchenExistingBacksplashCount) > 0
        ? Math.round(Number(payload.kitchenExistingBacksplashCount))
        : null,
    kitchenExistingFloorCount:
      payload.kitchenExistingFloorCount != null &&
      Number(payload.kitchenExistingFloorCount) > 0
        ? Math.round(Number(payload.kitchenExistingFloorCount))
        : null,
    kitchenInstallCabinetCount:
      payload.kitchenInstallCabinetCount != null &&
      Number(payload.kitchenInstallCabinetCount) > 0
        ? Math.round(Number(payload.kitchenInstallCabinetCount))
        : null,
    kitchenInstallCounterCount:
      payload.kitchenInstallCounterCount != null &&
      Number(payload.kitchenInstallCounterCount) > 0
        ? Math.round(Number(payload.kitchenInstallCounterCount))
        : null,
    kitchenInstallApplianceCount:
      payload.kitchenInstallApplianceCount != null &&
      Number(payload.kitchenInstallApplianceCount) > 0
        ? Math.round(Number(payload.kitchenInstallApplianceCount))
        : null,
    kitchenInstallBacksplashCount:
      payload.kitchenInstallBacksplashCount != null &&
      Number(payload.kitchenInstallBacksplashCount) > 0
        ? Math.round(Number(payload.kitchenInstallBacksplashCount))
        : null,
    kitchenInstallFlooringCount:
      payload.kitchenInstallFlooringCount != null &&
      Number(payload.kitchenInstallFlooringCount) > 0
        ? Math.round(Number(payload.kitchenInstallFlooringCount))
        : null,
    kitchenInstallIslandCount:
      payload.kitchenInstallIslandCount != null &&
      Number(payload.kitchenInstallIslandCount) > 0
        ? Math.round(Number(payload.kitchenInstallIslandCount))
        : null,
    kitchenDemoCabinetCount:
      payload.kitchenDemoCabinetCount != null &&
      Number(payload.kitchenDemoCabinetCount) > 0
        ? Math.round(Number(payload.kitchenDemoCabinetCount))
        : null,
    kitchenDemoCounterCount:
      payload.kitchenDemoCounterCount != null &&
      Number(payload.kitchenDemoCounterCount) > 0
        ? Math.round(Number(payload.kitchenDemoCounterCount))
        : null,
    kitchenDemoIslandCount:
      payload.kitchenDemoIslandCount != null &&
      Number(payload.kitchenDemoIslandCount) > 0
        ? Math.round(Number(payload.kitchenDemoIslandCount))
        : null,
    kitchenDemoApplianceCount:
      payload.kitchenDemoApplianceCount != null &&
      Number(payload.kitchenDemoApplianceCount) > 0
        ? Math.round(Number(payload.kitchenDemoApplianceCount))
        : null,
    kitchenDemoFloorCount:
      payload.kitchenDemoFloorCount != null &&
      Number(payload.kitchenDemoFloorCount) > 0
        ? Math.round(Number(payload.kitchenDemoFloorCount))
        : null,
    kitchenDemoWallCount:
      payload.kitchenDemoWallCount != null &&
      Number(payload.kitchenDemoWallCount) > 0
        ? Math.round(Number(payload.kitchenDemoWallCount))
        : null,
    flooringExistingCount:
      payload.flooringExistingCount != null &&
      Number(payload.flooringExistingCount) > 0
        ? Math.round(Number(payload.flooringExistingCount))
        : null,
    flooringExistingTypes: Array.isArray(payload.flooringExistingTypes)
      ? payload.flooringExistingTypes
      : null,
    flooringInstallScopeCount:
      payload.flooringInstallScopeCount != null &&
      Number(payload.flooringInstallScopeCount) > 0
        ? Math.round(Number(payload.flooringInstallScopeCount))
        : null,
    flooringDemoScopeCount:
      payload.flooringDemoScopeCount != null &&
      Number(payload.flooringDemoScopeCount) > 0
        ? Math.round(Number(payload.flooringDemoScopeCount))
        : null,
    garageDoorSingleCount:
      payload.garageDoorSingleCount != null &&
      Number(payload.garageDoorSingleCount) > 0
        ? Math.round(Number(payload.garageDoorSingleCount))
        : null,
    garageDoorDoubleCount:
      payload.garageDoorDoubleCount != null &&
      Number(payload.garageDoorDoubleCount) > 0
        ? Math.round(Number(payload.garageDoorDoubleCount))
        : null,
    garageDoorRvCount:
      payload.garageDoorRvCount != null && Number(payload.garageDoorRvCount) > 0
        ? Math.round(Number(payload.garageDoorRvCount))
        : null,
    garageDoorOpenerCount:
      payload.garageDoorOpenerCount != null &&
      Number(payload.garageDoorOpenerCount) > 0
        ? Math.round(Number(payload.garageDoorOpenerCount))
        : null,
    itemQuantities,
    pricingAcceptance: payload.pricingAcceptance,
    scopeGapResolutions: payload.scopeGapResolutions,
    quickMeasurementSources: payload.quickMeasurementSources,
    quickMeasurementUserOverrides: payload.quickMeasurementUserOverrides,
    planFacts: payload.planFacts,
    quickMeasurementSuggestionMetadata:
      payload.quickMeasurementSuggestionMetadata,
    quickMeasurementFieldConfidence: payload.quickMeasurementFieldConfidence,
    measurementProvenance: payload.measurementProvenance,
    measurementConflicts: payload.measurementConflicts,
    electricalValidation: payload.electricalValidation,
    planImportMode: payload.planImportMode ?? null,
    planImportTradeKey: payload.planImportTradeKey ?? null,
    planImportFingerprint: payload.planImportFingerprint ?? null,
    planImportMissingInfo: payload.planImportMissingInfo ?? [],
    plumbingWorkflowMode: payload.plumbingWorkflowMode ?? null,
    plumbingPerformerMode: payload.plumbingPerformerMode ?? null,
    plumbingScope: Array.isArray(payload.plumbingScope)
      ? payload.plumbingScope
      : null,
    projectComplexity: payload.projectComplexity ?? null,
    plumbingComplexityFactors: payload.plumbingComplexityFactors ?? null,
    tradeWorkflowSource: payload.tradeWorkflowSource ?? null,
    areaReconciliation: payload.areaReconciliation,
  };
  return {
    ...input,
    ...hydrateProjectComplexityInputFields(input),
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
  clearStalePricingWhenNotesUnpriced(
    itemQuantities,
    notes,
    parsed.itemQuantities
  );

  // Notes fill gaps only — never wipe plan/user quick-measurement fields already on payload.
  const mergedFields: ScopeMeasurements = {
    ...parsed,
    ...payload,
    itemQuantities,
  };
  for (const [key, value] of Object.entries(payload)) {
    if (
      key === 'itemQuantities' ||
      key === 'planRooms' ||
      key === 'pricingAcceptance'
    )
      continue;
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

  return syncMeasurementsWithSouthernUtahPlanFacts(reparsed, {
    templateKey: options?.templateKey,
  });
}

export type ScopeMeasurementsInputExtended = ReturnType<
  typeof emptyQuickMeasurementInput
> & {
  /** QM landscaping selections shown in the trade scope panel. */
  landscapeScope?: string[] | null;
  landscapeClearingLevel?:
    | 'light_clearing'
    | 'medium_vegetation'
    | 'dense_vegetation'
    | 'unsure'
    | null;
  concreteScope?: string[] | null;
  excavationQuantityMode?: 'direct_cy' | 'area_depth' | null;
  concreteAreaByType?: Partial<
    Record<
      'driveways' | 'sidewalks' | 'patios' | 'rv_pads' | 'walkways',
      string | number | null
    >
  > | null;
  concreteThicknessByType?: Partial<
    Record<
      'driveways' | 'sidewalks' | 'patios' | 'rv_pads' | 'walkways',
      string | number | null
    >
  > | null;
  concreteReinforcementSqft?: string | number | null;
  concreteSealerSqft?: string | number | null;
  concreteDemoThicknessBand?:
    | 'thin_2_3'
    | 'standard_4'
    | 'heavy_5_6'
    | 'structural_7_plus'
    | null;
  concreteDemoReinforced?: boolean | null;
  concreteDemoLimitedAccess?: boolean | null;
  concreteDemoThicknessBands?: Array<
    'thin_2_3' | 'standard_4' | 'heavy_5_6' | 'structural_7_plus'
  > | null;
  concreteDemoAreaByThickness?: Partial<
    Record<
      'thin_2_3' | 'standard_4' | 'heavy_5_6' | 'structural_7_plus',
      string | number | null
    >
  > | null;
  concreteSubgradePrepSqft?: string | number | null;
  concreteThicknessInches?: string | number | null;
  concreteDecorativeFinish?: ScopeMeasurements['concreteDecorativeFinish'];
  complexFormingLf?: string | number | null;
  additionalHaulOffLoadCount?: string | number | null;
  plumbingScope?: ScopeMeasurements['plumbingScope'];
  framingScope?: ScopeMeasurements['framingScope'];
  framedAreaSqft?: string | number | null;
  wallFramingLf?: string | number | null;
  sheathingSqft?: string | number | null;
  framingOpeningCount?: string | number | null;
  framingCleanupCount?: string | number | null;
  tradeScopeSelections?: ScopeMeasurements['tradeScopeSelections'];
  insulationAssemblies?: ScopeMeasurements['insulationAssemblies'];
  planRooms?: import('@/utils/estimateAiDraft').ScopeMeasurements['planRooms'];
  flooringExistingTypes?: import('@/utils/estimateAiDraft').ScopeMeasurements['flooringExistingTypes'];
  flooringProductScope?: import('@/utils/estimateAiDraft').ScopeMeasurements['flooringProductScope'];
  flooringExistingLvpInstallMethod?: import('@/utils/estimateAiDraft').ScopeMeasurements['flooringExistingLvpInstallMethod'];
  flooringExistingSheetVinylType?: import('@/utils/estimateAiDraft').ScopeMeasurements['flooringExistingSheetVinylType'];
  flooringNewLvpInstallMethod?: import('@/utils/estimateAiDraft').ScopeMeasurements['flooringNewLvpInstallMethod'];
  flooringNewSheetVinylType?: import('@/utils/estimateAiDraft').ScopeMeasurements['flooringNewSheetVinylType'];
  floorPrepLevel?: import('@/utils/estimateAiDraft').ScopeMeasurements['floorPrepLevel'];
  flooringDemoIncludesSubstratePrep?: import('@/utils/estimateAiDraft').ScopeMeasurements['flooringDemoIncludesSubstratePrep'];
  floorPrepTransitions?: import('@/utils/estimateAiDraft').ScopeMeasurements['floorPrepTransitions'];
  floorPrepByProduct?: import('@/utils/estimateAiDraft').ScopeMeasurements['floorPrepByProduct'];
  paintScope?: import('@/utils/estimateAiDraft').ScopeMeasurements['paintScope'];
  paintPricingMethod?: 'combined' | 'separate' | null;
  combinedPaintableAreaSqft?: string | number | null;
  originalPaintAreaReferenceSqft?: string | number | null;
  paintOccupancy?: import('@/utils/estimateAiDraft').ScopeMeasurements['paintOccupancy'];
  paintApplicationMethod?: import('@/utils/estimateAiDraft').ScopeMeasurements['paintApplicationMethod'];
  paintOccupancyConfirmed?: import('@/utils/estimateAiDraft').ScopeMeasurements['paintOccupancyConfirmed'];
  paintApplicationMethodConfirmed?: import('@/utils/estimateAiDraft').ScopeMeasurements['paintApplicationMethodConfirmed'];
  plumbingWorkflowMode?: PlumbingWorkflowMode | null;
  plumbingPerformerMode?: PlumbingPerformerMode | null;
  projectComplexity?: ProjectComplexitySettings | null;
  plumbingComplexityFactors?: Array<{ key?: string; label?: string }> | null;
  plumbingWaterHeaterDetail?: import('@/utils/estimateAiDraft').ScopeMeasurements['plumbingWaterHeaterDetail'];
  tradeWorkflowSource?: 'standalone_trade' | null;
  cabinetMeasurementMethod?: import('@/utils/estimateAiDraft').ScopeMeasurements['cabinetMeasurementMethod'];
  paintAreaBasis?: import('@/utils/estimateAiDraft').ScopeMeasurements['paintAreaBasis'];
  paintAreaNeedsConfirmation?: boolean | null;
  electricalScope?: string[] | null;
  electricalProjectCondition?: import('@/utils/estimateAiDraft').ScopeMeasurements['electricalProjectCondition'];
  electricalIncludeRough?: boolean | null;
  electricalIncludeTrim?: boolean | null;
  electricalConduit?: boolean | null;
  electricalTrenching?: boolean | null;
  electricalConduitSpecialty?: boolean | null;
  electricalTrenchCondition?:
    | import('@/utils/subcontractorTrade/electricalPlanConvergence').ElectricalTrenchCondition
    | null;
  existingServiceAmperage?: string | number | null;
  electricalPanelLocation?: import('@/utils/estimateAiDraft').ScopeMeasurements['electricalPanelLocation'];
  electricalMeterMainCombo?: boolean | null;
  itemQuantities: Record<
    string,
    {
      quantity: string;
      unit: string;
      quantitySource?: QuantitySource;
      includesCountertops?: boolean;
      measurementState?:
        | import('@/utils/measurementSemantics').ScopeMeasurementState
        | null;
    }
  >;
  pricingAcceptance?: Record<
    string,
    import('@/utils/estimateAiDraft').ScopePricingAcceptanceMetadata
  >;
  scopeGapResolutions?: Record<
    string,
    import('@/utils/scopeReviewUi').ScopeGapResolutionRecord
  >;
  planRooms?: import('@/utils/estimateAiDraft').PlanRoomMeasurement[];
  quickMeasurementSources?: Record<string, string>;
  measurementProvenance?: Record<string, unknown>;
  measurementConflicts?: import('@/utils/estimateAiDraft').PlanMeasurementConflict[];
  wetAreaFinish?: import('@/utils/planBathRooms').WetAreaFinishChoice | null;
  bathCount?: number | null;
  tilePanBathCount?: number | null;
  prefabBathCount?: number | null;
  prefabEnclosureBathCount?: number | null;
  tubBathCount?: number | null;
  /** Bathroom floor tile install count (outside shower). */
  bathFloorTileCount?: number | null;
  showerDoorCount?: number | null;
  windowCount?: number | null;
  exteriorDoorCount?: number | null;
  slidingDoorCount?: number | null;
  garageDoorSingleCount?: number | null;
  garageDoorDoubleCount?: number | null;
  garageDoorRvCount?: number | null;
  garageDoorOpenerCount?: number | null;
  framingOpeningCount?: number | null;
  reframingRequested?: boolean | null;
  areaReconciliation?:
    | import('@/utils/measurementSemantics').AreaReconciliation
    | null;
  pricingOverrideLog?: import('@/utils/measurementSemantics').PricingOverrideLog[];
  /** Applied stage/component benchmark keys — blocks double application. */
  appliedBenchmarkKeys?: string[];
  /** Bathroom vanity countertop pricing profile (custom vs prefab). */
  bathroomVanityCountertopMaterialType?: string | null;
  /** Bathroom toilet relocate floor type (open/finished wood, slab, unsure). */
  bathroomToiletRelocateFloorType?: string | null;
  /** Whether toilet relocate floor type was user-selected or AI-inferred. */
  bathroomToiletRelocateFloorTypeSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  /** Opening trim & finish — include field paint/stain labor in suggested pricing. */
  trimFinishFieldPaintIncluded?: boolean | null;
  trimFinishLf?: string | number | null;
  /** Bathroom shower/tub rough-in wall & floor access (valve, head, drain). */
  bathroomShowerRoughAccessType?: string | null;
  /** Whether shower rough-in access was user-selected or AI-inferred. */
  bathroomShowerRoughAccessTypeSource?: 'user_selected' | 'ai_inferred' | null;
  /** In-place stub-out vs relocating shower/tub valve, head, or drain lines. */
  bathroomShowerRoughWorkType?: string | null;
  /** Whether shower rough-in work type was user-selected or AI-inferred. */
  bathroomShowerRoughWorkTypeSource?: 'user_selected' | 'ai_inferred' | null;
  bathroomShowerRoughFixtureType?: string | null;
  bathroomShowerRoughFixtureTypeSource?: 'user_selected' | 'ai_inferred' | null;
  bathroomShowerRoughWallAccess?: string | null;
  bathroomShowerRoughWallAccessSource?: 'user_selected' | 'ai_inferred' | null;
  bathroomShowerRoughPlumbingExposed?: string | null;
  bathroomShowerRoughPlumbingExposedSource?:
    | 'user_selected'
    | 'demo_detected'
    | 'ai_inferred'
    | null;
  bathroomShowerRoughFloorConstruction?: string | null;
  bathroomShowerRoughFloorConstructionSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  bathroomShowerRoughSlabWorkRequired?: string | null;
  bathroomShowerRoughSlabWorkRequiredSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  bathroomDrywallPaintUseCombinedAssemblySource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  bathroomPaintRepairScope?: string | null;
  bathroomPaintRepairScopeSource?: 'user_selected' | 'ai_inferred' | null;
  bathroomPaintRepairEntireRoom?: boolean | null;
  bathroomPaintRepairEntireRoomSource?: 'user_selected' | 'ai_inferred' | null;
  bathroomPaintRepairEntireRoomSqft?: string | number | null;
  bathroomPaintRepairEntireRoomSqftSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  bathroomInteriorPaintMobilization?: string | null;
  bathroomInteriorPaintMobilizationSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  bathroomInteriorPaintSurface?: string | null;
  bathroomInteriorPaintSurfaceSource?: 'user_selected' | 'ai_inferred' | null;
  bathroomInteriorPaintCondition?: string | null;
  bathroomInteriorPaintConditionSource?: 'user_selected' | 'ai_inferred' | null;
  bathroomGlassDoorStyle?: string | null;
  bathroomGlassDoorStyleSource?: 'user_selected' | 'ai_inferred' | null;
  quickMeasurementSources?: import('@/utils/quickMeasurementProvenance').QuickMeasurementSourceMap;
  quickMeasurementUserOverrides?: import('@/utils/quickMeasurementProvenance').QuickMeasurementOverrideMap;
  planFacts?: import('@/utils/planMeasurementFacts').PlanFacts;
  quickMeasurementSuggestionMetadata?: Partial<
    Record<string, import('@/utils/planMeasurementFacts').MeasurementSuggestion>
  >;
  quickMeasurementFieldConfidence?: Record<string, number>;
  planImportMode?:
    | import('@/utils/planImportTradeConfig').PlanEstimatingMode
    | null;
  planImportTradeKey?:
    | import('@/utils/planImportTradeConfig').PlanTradeKey
    | null;
  planImportMissingInfo?: string[];
  electricalValidation?: {
    fields?: Record<
      string,
      {
        status?: string;
        pricingEligible?: boolean;
        reason?: string;
        deterministicRepeatedImportStable?: boolean;
      }
    >;
    priceableFields?: string[];
    blockedFields?: string[];
  } | null;
} & Partial<
    Record<ElectricalQuantityKey | PlumbingQuantityKey, string | number | null>
  >;

export function initialScopeMeasurementInputExtended(
  draft: {
    scopeMeasurements?: ScopeMeasurements | null;
    originalNotes?: string | null;
    scopeChecklist?: {
      templateKey?: string;
      suggestedMeasurements?: ScopeMeasurements | null;
    } | null;
    projectType?: string | null;
  } | null,
  notesOverride?: string | null
): ScopeMeasurementsInputExtended {
  const saved = draft?.scopeMeasurements;
  const suggested = draft?.scopeChecklist?.suggestedMeasurements;
  const scopeNotes = String(
    notesOverride ||
      resolveDraftScopeNotes(
        draft as Parameters<typeof resolveDraftScopeNotes>[0]
      ) ||
      ''
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
    val: {
      quantity: number | string | null;
      unit: string;
      quantitySource?: QuantitySource;
      includesCountertops?: boolean;
    }
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
    if (
      isDualAllowanceItem(id) &&
      (val.unit === 'allowance' || val.unit === 'lump_sum')
    ) {
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

  const isPricingSubKey = (id: string) =>
    /__(?:material|labor|allowance)$/.test(id);
  const hasCompleteUserSelectedSplit = (itemId: string) =>
    hasCompleteUserSelectedPricing(saved?.itemQuantities || {}, itemId);

  for (const [id, val] of Object.entries(saved?.itemQuantities || {})) {
    if (!val.quantity) continue;
    // Reparse stale/incomplete rate splits from notes. Preserve only complete pricing selected by the user.
    if (
      isPricingSubKey(id) &&
      !hasCompleteUserSelectedSplit(ratePricingItemIdFromKey(id) || id)
    )
      continue;
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
      if (
        id === 'demo' &&
        parsedFromNotes.itemQuantities?.floor_demo &&
        !parsedFromNotes.itemQuantities?.demo
      ) {
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
            includesCountertops: (val as { includesCountertops?: boolean })
              .includesCountertops,
          });
        }
        continue;
      }
      putItemQuantity(id, {
        quantity: val.quantity,
        unit: val.unit,
        quantitySource: val.quantitySource || 'notes',
        includesCountertops: (val as { includesCountertops?: boolean })
          .includesCountertops,
      });
    }
  };

  // Backend suggestedMeasurements first, then fresh notes parse — current notes win over stale server/saved totals.
  mergeParsedItemQuantities(
    suggested?.itemQuantities as Record<string, ScopeItemQuantityValue>
  );
  mergeParsedItemQuantities(
    parsedFromNotes.itemQuantities as Record<string, ScopeItemQuantityValue>
  );
  clearStalePricingWhenNotesUnpriced(
    itemQuantities,
    scopeNotes,
    parsedFromNotes.itemQuantities
  );

  // A total yard measurement must not resurrect an old notes-derived
  // material quantity after the notes are edited. Keep an explicitly
  // user-entered allocation, but clear stale sod/rock/paver quantities.
  if (
    String(draft?.scopeChecklist?.templateKey || '').toLowerCase() ===
    'landscaping'
  ) {
    const materialMeasurements = [
      ['sodSqft', 'sod_turf'],
      ['artificialTurfSqft', 'artificial_turf'],
      ['rockMulchSqft', 'rock'],
      ['rockMulchSqft', 'mulch'],
      ['paverSqft', 'pavers'],
    ] as const;
    for (const [measurementKey, itemId] of materialMeasurements) {
      if (parsedFromNotes[measurementKey] != null) continue;
      const savedEntry = saved?.itemQuantities?.[itemId];
      const currentEntry = itemQuantities[itemId];
      if (
        savedEntry?.quantitySource === 'user_entered' ||
        currentEntry?.quantitySource === 'user_entered'
      ) {
        continue;
      }
      delete itemQuantities[itemId];
      delete itemQuantities[`${itemId}__material`];
      delete itemQuantities[`${itemId}__labor`];
      delete itemQuantities[`${itemId}__allowance`];
    }
  }

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
    const parsedNoteValueRaw =
      parsedFromNotes[key as keyof typeof parsedFromNotes];
    const parsedNoteValue =
      typeof parsedNoteValueRaw === 'number' ||
      typeof parsedNoteValueRaw === 'string'
        ? parsedNoteValueRaw
        : undefined;
    const fromNotes =
      parsedNoteValue ?? suggested?.[key as keyof ScopeMeasurements];
    const s = saved?.[key as keyof ScopeMeasurements];
    const backsplashFromNotes = parsedFromNotes.backsplashSqft;

    // Explicit note values beat stale draft fields when regenerating from edited notes.
    // When notes omit a field (common for plan takeoff), fall through to saved plan import.
    if (parsedNoteValue != null && Number(parsedNoteValue) > 0) {
      return String(parsedNoteValue);
    }

    if (
      String(draft?.scopeChecklist?.templateKey || '').toLowerCase() ===
        'landscaping' &&
      (key === 'sodSqft' ||
        key === 'artificialTurfSqft' ||
        key === 'rockMulchSqft' ||
        key === 'paverSqft') &&
      saved?.itemQuantities?.[
        key === 'sodSqft'
          ? 'sod_turf'
          : key === 'artificialTurfSqft'
            ? 'artificial_turf'
            : key === 'rockMulchSqft'
              ? 'rock'
              : 'pavers'
      ]?.quantitySource !== 'user_entered' &&
      itemQuantities[
        key === 'sodSqft'
          ? 'sod_turf'
          : key === 'artificialTurfSqft'
            ? 'artificial_turf'
            : key === 'rockMulchSqft'
              ? 'rock'
              : 'pavers'
      ]?.quantitySource !== 'user_entered' &&
      (key !== 'rockMulchSqft' ||
        (saved?.itemQuantities?.mulch?.quantitySource !== 'user_entered' &&
          itemQuantities.mulch?.quantitySource !== 'user_entered'))
    ) {
      return '';
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

  const pickString = (key: QuickMeasurementFieldKey) => {
    const parsedNoteValue =
      parsedFromNotes[key as keyof typeof parsedFromNotes];
    if (typeof parsedNoteValue === 'string' && parsedNoteValue.trim()) {
      return parsedNoteValue.trim();
    }
    const fromNotes = suggested?.[key as keyof ScopeMeasurements];
    if (typeof fromNotes === 'string' && fromNotes.trim())
      return fromNotes.trim();
    const savedValue = saved?.[key as keyof ScopeMeasurements];
    if (typeof savedValue === 'string' && savedValue.trim()) {
      return savedValue.trim();
    }
    return '';
  };

  const hasBaseboardNotes =
    /\b(baseboards?|trim|crown|moulding|molding|casing)\b/i.test(scopeNotes);
  const pickBaseboardLf = () => {
    if (!hasBaseboardNotes) return '';
    const fromNotes = parsedFromNotes.baseboardLf ?? suggested?.baseboardLf;
    if (fromNotes != null && Number(fromNotes) > 0) return String(fromNotes);
    return (
      pick('baseboardLf') ||
      (saved?.lf ? String(saved.lf) : parsed.lf ? String(parsed.lf) : '')
    );
  };

  const base = emptyQuickMeasurementInput();
  const hydratedPaintScope = Array.from(
    new Set([
      ...(parsedFromNotes.paintScope ??
        suggested?.paintScope ??
        saved?.paintScope ??
        []),
      ...(Number(parsedFromNotes.exteriorPaintSqft || 0) > 0
        ? ['exterior' as const]
        : []),
    ])
  );
  let result: ScopeMeasurementsInputExtended = {
    ...base,
    planRooms:
      parsedFromNotes.planRooms ?? suggested?.planRooms ?? saved?.planRooms,
    paintScope: hydratedPaintScope.length ? hydratedPaintScope : null,
    bathroomFloorSqft:
      pick('bathroomFloorSqft') ||
      (saved?.sqft
        ? String(saved.sqft)
        : parsed.sqft
          ? String(parsed.sqft)
          : ''),
    kitchenFloorSqft: pick('kitchenFloorSqft'),
    floorAreaSqft: pick('floorAreaSqft'),
    flooringSqft: pick('flooringSqft'),
    flooringProductScope:
      parsedFromNotes.flooringProductScope ??
      suggested?.flooringProductScope ??
      saved?.flooringProductScope ??
      null,
    flooringExistingLvpInstallMethod:
      parsedFromNotes.flooringExistingLvpInstallMethod ??
      suggested?.flooringExistingLvpInstallMethod ??
      saved?.flooringExistingLvpInstallMethod ??
      null,
    flooringExistingSheetVinylType:
      parsedFromNotes.flooringExistingSheetVinylType ??
      suggested?.flooringExistingSheetVinylType ??
      saved?.flooringExistingSheetVinylType ??
      null,
    floorPrepLevel: suggested?.floorPrepLevel ?? saved?.floorPrepLevel ?? null,
    flooringDemoIncludesSubstratePrep:
      suggested?.flooringDemoIncludesSubstratePrep ??
      saved?.flooringDemoIncludesSubstratePrep ??
      null,
    floorPrepTransitions:
      suggested?.floorPrepTransitions ?? saved?.floorPrepTransitions ?? null,
    floorPrepByProduct:
      suggested?.floorPrepByProduct ?? saved?.floorPrepByProduct ?? null,
    flooringLvpSqft: pick('flooringLvpSqft'),
    flooringLaminateSqft: pick('flooringLaminateSqft'),
    flooringEngineeredHardwoodSqft: pick('flooringEngineeredHardwoodSqft'),
    flooringSolidHardwoodSqft: pick('flooringSolidHardwoodSqft'),
    flooringTileSqft: pick('flooringTileSqft'),
    flooringCarpetSqft: pick('flooringCarpetSqft'),
    floorDemoSqft: pick('floorDemoSqft'),
    floorPrepSqft: pick('floorPrepSqft'),
    underlaymentSqft: pick('underlaymentSqft'),
    moistureBarrierSqft: pick('moistureBarrierSqft'),
    transitionLf: pick('transitionLf'),
    transitionCount: pick('transitionCount'),
    quarterRoundLf: pick('quarterRoundLf'),
    backsplashSqft: pick('backsplashSqft'),
    countertopSqft: pick('countertopSqft'),
    cabinetLf: pick('cabinetLf'),
    landscapeSqft: pick('landscapeSqft'),
    artificialTurfSqft: pick('artificialTurfSqft'),
    sodSqft: pick('sodSqft'),
    paverSqft: pick('paverSqft'),
    rockMulchSqft: pick('rockMulchSqft'),
    landscapeTons: pick('landscapeTons'),
    landscapeScope:
      (Array.isArray(saved?.landscapeScope) && saved.landscapeScope.length > 0
        ? saved.landscapeScope
        : null) ??
      (Array.isArray(suggested?.landscapeScope) &&
      suggested.landscapeScope.length > 0
        ? suggested.landscapeScope
        : null) ??
      (parsedFromNotes as ScopeMeasurements).landscapeScope ??
      null,
    landscapeClearingLevel:
      saved?.landscapeClearingLevel ??
      suggested?.landscapeClearingLevel ??
      null,
    tradeScopeSelections:
      saved?.tradeScopeSelections ?? suggested?.tradeScopeSelections ?? null,
    roofSquares: pick('roofSquares'),
    drywallSqft: pick('drywallSqft'),
    drywallWallSqft: pick('drywallWallSqft'),
    drywallCeilingSqft: pick('drywallCeilingSqft'),
    drywallOpeningDeductionSqft: pick('drywallOpeningDeductionSqft'),
    garageWallDrywallSqft: pick('garageWallDrywallSqft'),
    garageCeilingDrywallSqft: pick('garageCeilingDrywallSqft'),
    moistureResistantDrywallSqft: pick('moistureResistantDrywallSqft'),
    fireRatedDrywallSqft: pick('fireRatedDrywallSqft'),
    highCeilingDrywallSqft: pick('highCeilingDrywallSqft'),
    vaultedCeilingDrywallSqft: pick('vaultedCeilingDrywallSqft'),
    level5FinishSqft: pick('level5FinishSqft'),
    concreteSqft: pick('concreteSqft'),
    concreteReinforcementSqft: pick('concreteReinforcementSqft'),
    concreteSealerSqft: pick('concreteSealerSqft'),
    concreteSubgradePrepSqft: pick('concreteSubgradePrepSqft'),
    concreteDemoSqft: pick('concreteDemoSqft'),
    concreteDemoThicknessBand:
      saved?.concreteDemoThicknessBand ??
      suggested?.concreteDemoThicknessBand ??
      null,
    concreteDemoThicknessBands:
      saved?.concreteDemoThicknessBands ??
      suggested?.concreteDemoThicknessBands ??
      null,
    concreteDemoAreaByThickness:
      saved?.concreteDemoAreaByThickness ??
      suggested?.concreteDemoAreaByThickness ??
      null,
    concreteDemoReinforced:
      saved?.concreteDemoReinforced ??
      suggested?.concreteDemoReinforced ??
      null,
    concreteDemoLimitedAccess:
      saved?.concreteDemoLimitedAccess ??
      suggested?.concreteDemoLimitedAccess ??
      null,
    concreteDemoCy: pick('concreteDemoCy'),
    excavationAreaSqft: pick('excavationAreaSqft'),
    excavationDepthInches: pick('excavationDepthInches'),
    excavationQuantityMode:
      saved?.excavationQuantityMode ??
      suggested?.excavationQuantityMode ??
      null,
    concreteAreaByType:
      saved?.concreteAreaByType ?? suggested?.concreteAreaByType ?? null,
    concreteThicknessByType:
      saved?.concreteThicknessByType ??
      suggested?.concreteThicknessByType ??
      null,
    concreteThicknessInches: pick('concreteThicknessInches'),
    concreteDecorativeFinish:
      parsedFromNotes.concreteDecorativeFinish ??
      suggested?.concreteDecorativeFinish ??
      saved?.concreteDecorativeFinish ??
      null,
    complexFormingLf: pick('complexFormingLf'),
    additionalHaulOffLoadCount: pick('additionalHaulOffLoadCount'),
    concreteCy: pick('concreteCy'),
    excavationCy: pick('excavationCy'),
    deckSqft: pick('deckSqft'),
    garageSqft: pick('garageSqft'),
    exteriorPaintSqft: pick('exteriorPaintSqft'),
    stuccoGrossWallSqft: pick('stuccoGrossWallSqft'),
    stuccoWindowDoorOpeningSqft: pick('stuccoWindowDoorOpeningSqft'),
    stuccoGarageOpeningSqft: pick('stuccoGarageOpeningSqft'),
    stuccoOtherFinishDeductionSqft: pick('stuccoOtherFinishDeductionSqft'),
    stuccoNetWallSqft: pick('stuccoNetWallSqft'),
    stuccoSoffitSqft: pick('stuccoSoffitSqft'),
    stuccoParapetSqft: pick('stuccoParapetSqft'),
    stuccoFoamTrimLf: pick('stuccoFoamTrimLf'),
    stuccoControlJointLf: pick('stuccoControlJointLf'),
    stuccoAccessAffectedSqft: pick('stuccoAccessAffectedSqft'),
    stuccoRepairAffectedSqft: pick('stuccoRepairAffectedSqft'),
    stuccoStories: pick('stuccoStories'),
    stuccoWallHeightFt: pick('stuccoWallHeightFt'),
    exteriorWallGrossSqft: pick('exteriorWallGrossSqft'),
    exteriorWallInsulationSqft: pick('exteriorWallInsulationSqft'),
    atticInsulationSqft: pick('atticInsulationSqft'),
    insulatedRoofDeckSqft: pick('insulatedRoofDeckSqft'),
    floorInsulationSqft: pick('floorInsulationSqft'),
    garageSeparationInsulationSqft: pick('garageSeparationInsulationSqft'),
    insulatedGarageWallSqft: pick('insulatedGarageWallSqft'),
    insulatedGarageCeilingSqft: pick('insulatedGarageCeilingSqft'),
    openingDeductionSqft: pick('openingDeductionSqft'),
    insulationMaterialType: pickString('insulationMaterialType'),
    insulationRValue: pickString('insulationRValue'),
    garageInsulationIncluded: pickString('garageInsulationIncluded'),
    insulationAssemblies: copyInsulationAssemblyFields({
      insulationAssemblies:
        parsedFromNotes.insulationAssemblies ??
        suggested?.insulationAssemblies ??
        saved?.insulationAssemblies,
    }),
    railingLf: pick('railingLf'),
    baseboardLf: pickBaseboardLf(),
    showerWallTileSqft: pick('showerWallTileSqft'),
    showerFloorTileSqft: pick('showerFloorTileSqft'),
    wallPaintSqft:
      parsedFromNotes.paintPricingMethod === 'combined' ||
      parsedFromNotes.paintAreaBasis === 'combined'
        ? ''
        : pick('wallPaintSqft'),
    ceilingPaintSqft:
      parsedFromNotes.paintPricingMethod === 'combined' ||
      parsedFromNotes.paintAreaBasis === 'combined'
        ? ''
        : pick('ceilingPaintSqft'),
    paintAreaSqft: pick('paintAreaSqft'),
    paintAreaBasis:
      parsedFromNotes.paintAreaBasis ??
      suggested?.paintAreaBasis ??
      saved?.paintAreaBasis ??
      null,
    paintAreaNeedsConfirmation:
      parsedFromNotes.paintAreaNeedsConfirmation ??
      suggested?.paintAreaNeedsConfirmation ??
      saved?.paintAreaNeedsConfirmation ??
      null,
    paintPricingMethod:
      parsedFromNotes.paintPricingMethod ??
      suggested?.paintPricingMethod ??
      saved?.paintPricingMethod ??
      (parsedFromNotes.paintAreaBasis === 'combined' ? 'combined' : null),
    combinedPaintableAreaSqft:
      parsedFromNotes.paintPricingMethod === 'combined' ||
      parsedFromNotes.paintAreaBasis === 'combined'
        ? String(
            parsedFromNotes.combinedPaintableAreaSqft ||
              parsedFromNotes.paintAreaSqft ||
              ''
          )
        : (suggested?.combinedPaintableAreaSqft ??
          saved?.combinedPaintableAreaSqft ??
          null),
    originalPaintAreaReferenceSqft:
      suggested?.originalPaintAreaReferenceSqft ??
      saved?.originalPaintAreaReferenceSqft ??
      parsedFromNotes.paintAreaSqft ??
      null,
    paintOccupancy:
      parsedFromNotes.paintOccupancy ??
      suggested?.paintOccupancy ??
      saved?.paintOccupancy ??
      'occupied',
    paintApplicationMethod:
      parsedFromNotes.paintApplicationMethod ??
      suggested?.paintApplicationMethod ??
      saved?.paintApplicationMethod ??
      'brush_roll',
    paintOccupancyConfirmed:
      parsedFromNotes.paintOccupancyConfirmed ??
      suggested?.paintOccupancyConfirmed ??
      saved?.paintOccupancyConfirmed ??
      false,
    paintApplicationMethodConfirmed:
      parsedFromNotes.paintApplicationMethodConfirmed ??
      suggested?.paintApplicationMethodConfirmed ??
      saved?.paintApplicationMethodConfirmed ??
      false,
    cabinetMeasurementMethod:
      suggested?.cabinetMeasurementMethod ??
      saved?.cabinetMeasurementMethod ??
      'linear_feet',
    cabinetUpperLf: pick('cabinetUpperLf'),
    cabinetLowerLf: pick('cabinetLowerLf'),
    cabinetTallLf: pick('cabinetTallLf'),
    cabinetRunLf:
      pick('cabinetRunLf') ||
      (Number(pick('cabinetUpperLf')) +
        Number(pick('cabinetLowerLf')) +
        Number(pick('cabinetTallLf')) >
      0
        ? String(
            Number(pick('cabinetUpperLf')) +
              Number(pick('cabinetLowerLf')) +
              Number(pick('cabinetTallLf'))
          )
        : ''),
    interiorDoorCount: pick('interiorDoorCount'),
    windowCount: pick('windowCount'),
    exteriorDoorCount: pick('exteriorDoorCount'),
    slidingDoorCount: pick('slidingDoorCount'),
    cabinetPaintSqft: pick('cabinetPaintSqft'),
    itemQuantities,
    pricingAcceptance: saved?.pricingAcceptance,
    scopeGapResolutions: saved?.scopeGapResolutions,
    planRooms: saved?.planRooms?.length
      ? saved.planRooms
      : suggested?.planRooms,
    wetAreaFinish: saved?.wetAreaFinish ?? suggested?.wetAreaFinish ?? null,
    bathCount: saved?.bathCount ?? suggested?.bathCount ?? null,
    tilePanBathCount:
      saved?.tilePanBathCount ?? suggested?.tilePanBathCount ?? null,
    prefabBathCount:
      saved?.prefabBathCount ?? suggested?.prefabBathCount ?? null,
    prefabEnclosureBathCount:
      saved?.prefabEnclosureBathCount ??
      suggested?.prefabEnclosureBathCount ??
      null,
    tubBathCount: saved?.tubBathCount ?? suggested?.tubBathCount ?? null,
    bathFloorTileCount:
      saved?.bathFloorTileCount ?? suggested?.bathFloorTileCount ?? null,
    showerDoorCount:
      saved?.showerDoorCount ?? suggested?.showerDoorCount ?? null,
    existingTubCount:
      saved?.existingTubCount ?? suggested?.existingTubCount ?? null,
    existingTileWallCount:
      saved?.existingTileWallCount ?? suggested?.existingTileWallCount ?? null,
    existingTilePanCount:
      saved?.existingTilePanCount ?? suggested?.existingTilePanCount ?? null,
    existingPrefabPanCount:
      saved?.existingPrefabPanCount ??
      suggested?.existingPrefabPanCount ??
      null,
    existingPrefabEnclosureCount:
      saved?.existingPrefabEnclosureCount ??
      suggested?.existingPrefabEnclosureCount ??
      null,
    existingShowerDoorCount:
      saved?.existingShowerDoorCount ??
      suggested?.existingShowerDoorCount ??
      null,
    existingBathFloorTileCount:
      saved?.existingBathFloorTileCount ??
      suggested?.existingBathFloorTileCount ??
      null,
    bathroomExistingVanityCount:
      saved?.bathroomExistingVanityCount ??
      suggested?.bathroomExistingVanityCount ??
      null,
    bathroomExistingCounterCount:
      saved?.bathroomExistingCounterCount ??
      suggested?.bathroomExistingCounterCount ??
      null,
    bathroomInstallVanityCount:
      saved?.bathroomInstallVanityCount ??
      suggested?.bathroomInstallVanityCount ??
      null,
    bathroomInstallCounterCount:
      saved?.bathroomInstallCounterCount ??
      suggested?.bathroomInstallCounterCount ??
      null,
    bathroomDemoVanityCount:
      saved?.bathroomDemoVanityCount ??
      suggested?.bathroomDemoVanityCount ??
      null,
    bathroomDemoCounterCount:
      saved?.bathroomDemoCounterCount ??
      suggested?.bathroomDemoCounterCount ??
      null,
    bathroomVanityCountertopMaterialType:
      saved?.bathroomVanityCountertopMaterialType ??
      suggested?.bathroomVanityCountertopMaterialType ??
      null,
    bathroomToiletRelocateFloorType:
      saved?.bathroomToiletRelocateFloorType ??
      suggested?.bathroomToiletRelocateFloorType ??
      null,
    bathroomToiletRelocateFloorTypeSource:
      saved?.bathroomToiletRelocateFloorTypeSource ??
      suggested?.bathroomToiletRelocateFloorTypeSource ??
      null,
    bathroomShowerRoughAccessType:
      saved?.bathroomShowerRoughAccessType ??
      suggested?.bathroomShowerRoughAccessType ??
      null,
    bathroomShowerRoughAccessTypeSource:
      saved?.bathroomShowerRoughAccessTypeSource ??
      suggested?.bathroomShowerRoughAccessTypeSource ??
      null,
    bathroomShowerRoughWorkType:
      saved?.bathroomShowerRoughWorkType ??
      suggested?.bathroomShowerRoughWorkType ??
      null,
    bathroomShowerRoughWorkTypeSource:
      saved?.bathroomShowerRoughWorkTypeSource ??
      suggested?.bathroomShowerRoughWorkTypeSource ??
      null,
    bathroomShowerRoughFixtureType:
      saved?.bathroomShowerRoughFixtureType ??
      suggested?.bathroomShowerRoughFixtureType ??
      null,
    bathroomShowerRoughFixtureTypeSource:
      saved?.bathroomShowerRoughFixtureTypeSource ??
      suggested?.bathroomShowerRoughFixtureTypeSource ??
      null,
    bathroomShowerRoughWallAccess:
      saved?.bathroomShowerRoughWallAccess ??
      suggested?.bathroomShowerRoughWallAccess ??
      null,
    bathroomShowerRoughWallAccessSource:
      saved?.bathroomShowerRoughWallAccessSource ??
      suggested?.bathroomShowerRoughWallAccessSource ??
      null,
    bathroomShowerRoughPlumbingExposed:
      saved?.bathroomShowerRoughPlumbingExposed ??
      suggested?.bathroomShowerRoughPlumbingExposed ??
      (saved?.bathroomShowerRoughWallAccess === 'open_framing' ||
      suggested?.bathroomShowerRoughWallAccess === 'open_framing'
        ? 'exposed_by_demo'
        : saved?.bathroomShowerRoughWallAccess === 'finished_wall' ||
            suggested?.bathroomShowerRoughWallAccess === 'finished_wall'
          ? 'separate_access_required'
          : null),
    bathroomShowerRoughPlumbingExposedSource:
      saved?.bathroomShowerRoughPlumbingExposedSource ??
      suggested?.bathroomShowerRoughPlumbingExposedSource ??
      (saved?.bathroomShowerRoughWallAccess === 'open_framing' ||
      suggested?.bathroomShowerRoughWallAccess === 'open_framing' ||
      saved?.bathroomShowerRoughWallAccess === 'finished_wall' ||
      suggested?.bathroomShowerRoughWallAccess === 'finished_wall'
        ? (saved?.bathroomShowerRoughWallAccessSource ??
          suggested?.bathroomShowerRoughWallAccessSource ??
          'user_selected')
        : null),
    bathroomShowerRoughFloorConstruction:
      saved?.bathroomShowerRoughFloorConstruction ??
      suggested?.bathroomShowerRoughFloorConstruction ??
      null,
    bathroomShowerRoughFloorConstructionSource:
      saved?.bathroomShowerRoughFloorConstructionSource ??
      suggested?.bathroomShowerRoughFloorConstructionSource ??
      null,
    bathroomShowerRoughSlabWorkRequired:
      saved?.bathroomShowerRoughSlabWorkRequired ??
      suggested?.bathroomShowerRoughSlabWorkRequired ??
      null,
    bathroomShowerRoughSlabWorkRequiredSource:
      saved?.bathroomShowerRoughSlabWorkRequiredSource ??
      suggested?.bathroomShowerRoughSlabWorkRequiredSource ??
      null,
    bathroomPaintRepairScope: mergeBathroomPaintRepairLocalizedScope(
      saved?.bathroomPaintRepairScope,
      suggested?.bathroomPaintRepairScope
    ),
    bathroomPaintRepairScopeSource:
      saved?.bathroomPaintRepairScopeSource ??
      suggested?.bathroomPaintRepairScopeSource ??
      null,
    bathroomPaintRepairEntireRoom: mergeBathroomPaintRepairEntireRoom(
      saved?.bathroomPaintRepairEntireRoom,
      suggested?.bathroomPaintRepairEntireRoom,
      saved?.bathroomPaintRepairScope ?? suggested?.bathroomPaintRepairScope
    ),
    bathroomPaintRepairEntireRoomSource:
      saved?.bathroomPaintRepairEntireRoomSource ??
      suggested?.bathroomPaintRepairEntireRoomSource ??
      (saved?.bathroomPaintRepairScope === 'entire_room' ||
      suggested?.bathroomPaintRepairScope === 'entire_room'
        ? (saved?.bathroomPaintRepairScopeSource ??
          suggested?.bathroomPaintRepairScopeSource ??
          null)
        : null),
    bathroomPaintRepairEntireRoomSqft:
      saved?.bathroomPaintRepairEntireRoomSqft ??
      suggested?.bathroomPaintRepairEntireRoomSqft ??
      null,
    bathroomPaintRepairEntireRoomSqftSource:
      saved?.bathroomPaintRepairEntireRoomSqftSource ??
      suggested?.bathroomPaintRepairEntireRoomSqftSource ??
      null,
    bathroomDrywallPaintUseCombinedAssembly:
      saved?.bathroomDrywallPaintUseCombinedAssembly ??
      suggested?.bathroomDrywallPaintUseCombinedAssembly ??
      null,
    bathroomDrywallPaintUseCombinedAssemblySource:
      saved?.bathroomDrywallPaintUseCombinedAssemblySource ??
      suggested?.bathroomDrywallPaintUseCombinedAssemblySource ??
      null,
    bathroomInteriorPaintMobilization:
      saved?.bathroomInteriorPaintMobilization ??
      suggested?.bathroomInteriorPaintMobilization ??
      null,
    bathroomInteriorPaintMobilizationSource:
      saved?.bathroomInteriorPaintMobilizationSource ??
      suggested?.bathroomInteriorPaintMobilizationSource ??
      null,
    bathroomInteriorPaintSurface:
      saved?.bathroomInteriorPaintSurface ??
      suggested?.bathroomInteriorPaintSurface ??
      null,
    bathroomInteriorPaintSurfaceSource:
      saved?.bathroomInteriorPaintSurfaceSource ??
      suggested?.bathroomInteriorPaintSurfaceSource ??
      null,
    bathroomInteriorPaintCondition:
      saved?.bathroomInteriorPaintCondition ??
      suggested?.bathroomInteriorPaintCondition ??
      null,
    bathroomInteriorPaintConditionSource:
      saved?.bathroomInteriorPaintConditionSource ??
      suggested?.bathroomInteriorPaintConditionSource ??
      null,
    bathroomGlassDoorStyle:
      saved?.bathroomGlassDoorStyle ??
      suggested?.bathroomGlassDoorStyle ??
      null,
    bathroomGlassDoorStyleSource:
      saved?.bathroomGlassDoorStyleSource ??
      suggested?.bathroomGlassDoorStyleSource ??
      null,
    demoTubCount: saved?.demoTubCount ?? suggested?.demoTubCount ?? null,
    demoTileWallCount:
      saved?.demoTileWallCount ?? suggested?.demoTileWallCount ?? null,
    demoTilePanCount:
      saved?.demoTilePanCount ?? suggested?.demoTilePanCount ?? null,
    demoPrefabPanCount:
      saved?.demoPrefabPanCount ?? suggested?.demoPrefabPanCount ?? null,
    demoPrefabEnclosureCount:
      saved?.demoPrefabEnclosureCount ??
      suggested?.demoPrefabEnclosureCount ??
      null,
    demoShowerDoorCount:
      saved?.demoShowerDoorCount ?? suggested?.demoShowerDoorCount ?? null,
    demoBathFloorTileCount:
      saved?.demoBathFloorTileCount ??
      suggested?.demoBathFloorTileCount ??
      null,
    reuseExistingShowerDoor:
      saved?.reuseExistingShowerDoor ??
      suggested?.reuseExistingShowerDoor ??
      null,
    demoWetAreaManualOverrides:
      saved?.demoWetAreaManualOverrides ??
      suggested?.demoWetAreaManualOverrides ??
      null,
    kitchenExistingCabinetCount:
      saved?.kitchenExistingCabinetCount ??
      suggested?.kitchenExistingCabinetCount ??
      null,
    kitchenExistingCounterCount:
      saved?.kitchenExistingCounterCount ??
      suggested?.kitchenExistingCounterCount ??
      null,
    kitchenExistingApplianceCount:
      saved?.kitchenExistingApplianceCount ??
      suggested?.kitchenExistingApplianceCount ??
      null,
    kitchenExistingBacksplashCount:
      saved?.kitchenExistingBacksplashCount ??
      suggested?.kitchenExistingBacksplashCount ??
      null,
    kitchenExistingFloorCount:
      saved?.kitchenExistingFloorCount ??
      suggested?.kitchenExistingFloorCount ??
      null,
    kitchenInstallCabinetCount:
      saved?.kitchenInstallCabinetCount ??
      suggested?.kitchenInstallCabinetCount ??
      null,
    kitchenInstallCounterCount:
      saved?.kitchenInstallCounterCount ??
      suggested?.kitchenInstallCounterCount ??
      null,
    kitchenInstallApplianceCount:
      saved?.kitchenInstallApplianceCount ??
      suggested?.kitchenInstallApplianceCount ??
      null,
    kitchenInstallBacksplashCount:
      saved?.kitchenInstallBacksplashCount ??
      suggested?.kitchenInstallBacksplashCount ??
      null,
    kitchenInstallFlooringCount:
      saved?.kitchenInstallFlooringCount ??
      suggested?.kitchenInstallFlooringCount ??
      null,
    kitchenInstallIslandCount:
      saved?.kitchenInstallIslandCount ??
      suggested?.kitchenInstallIslandCount ??
      null,
    kitchenDemoCabinetCount:
      saved?.kitchenDemoCabinetCount ??
      suggested?.kitchenDemoCabinetCount ??
      null,
    kitchenDemoCounterCount:
      saved?.kitchenDemoCounterCount ??
      suggested?.kitchenDemoCounterCount ??
      null,
    kitchenDemoIslandCount:
      saved?.kitchenDemoIslandCount ??
      suggested?.kitchenDemoIslandCount ??
      null,
    kitchenDemoApplianceCount:
      saved?.kitchenDemoApplianceCount ??
      suggested?.kitchenDemoApplianceCount ??
      null,
    kitchenDemoFloorCount:
      saved?.kitchenDemoFloorCount ?? suggested?.kitchenDemoFloorCount ?? null,
    kitchenDemoWallCount:
      saved?.kitchenDemoWallCount ?? suggested?.kitchenDemoWallCount ?? null,
    flooringExistingCount:
      saved?.flooringExistingCount ?? suggested?.flooringExistingCount ?? null,
    flooringExistingTypes:
      saved?.flooringExistingTypes ?? suggested?.flooringExistingTypes ?? null,
    flooringProductScope:
      saved?.flooringProductScope ?? suggested?.flooringProductScope ?? null,
    flooringInstallScopeCount:
      saved?.flooringInstallScopeCount ??
      suggested?.flooringInstallScopeCount ??
      null,
    flooringDemoScopeCount:
      saved?.flooringDemoScopeCount ??
      suggested?.flooringDemoScopeCount ??
      null,
    garageDoorSingleCount:
      saved?.garageDoorSingleCount ?? suggested?.garageDoorSingleCount ?? null,
    garageDoorDoubleCount:
      saved?.garageDoorDoubleCount ?? suggested?.garageDoorDoubleCount ?? null,
    garageDoorRvCount:
      saved?.garageDoorRvCount ?? suggested?.garageDoorRvCount ?? null,
    garageDoorOpenerCount:
      saved?.garageDoorOpenerCount ?? suggested?.garageDoorOpenerCount ?? null,
    planFacts: saved?.planFacts || suggested?.planFacts,
    quickMeasurementSources: saved?.quickMeasurementSources,
    quickMeasurementUserOverrides: saved?.quickMeasurementUserOverrides,
    quickMeasurementSuggestionMetadata:
      saved?.quickMeasurementSuggestionMetadata,
    quickMeasurementFieldConfidence: saved?.quickMeasurementFieldConfidence,
    measurementProvenance: saved?.measurementProvenance,
    measurementConflicts: saved?.measurementConflicts,
    areaReconciliation: saved?.areaReconciliation,
    planImportMode: saved?.planImportMode ?? null,
    planImportTradeKey: saved?.planImportTradeKey ?? null,
    planImportFingerprint: saved?.planImportFingerprint ?? null,
    planImportMissingInfo: saved?.planImportMissingInfo ?? [],
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
  if (saved?.planImportMode === 'selected_trade' && saved?.planImportTradeKey) {
    result.planImportMode = 'selected_trade';
    result.planImportTradeKey = saved.planImportTradeKey as PlanTradeKey;
    result.planImportMissingInfo = saved.planImportMissingInfo ?? [];
    result = stripScopeInputForSingleTrade(
      result,
      saved.planImportTradeKey as PlanTradeKey
    );
    if (saved.planImportTradeKey === 'insulation') {
      result = syncMeasurementsWithSouthernUtahPlanFacts(result, {
        templateKey: 'insulation',
      });
    }
  } else {
    result = syncMeasurementsWithSouthernUtahPlanFacts(result, {
      templateKey: draft?.scopeChecklist?.templateKey,
    });
  }

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
