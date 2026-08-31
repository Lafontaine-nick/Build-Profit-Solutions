import { postAiAssistantJson } from '@/utils/resolveAiBackendUrl';
import {
  clearStalePricingWhenNotesUnpriced,
  parseScopeMeasurementsFromNotes,
} from '@/utils/scopeMeasurementParser';
import { resolveScopePackageBudgetBreakdown } from '@/utils/scopeBudgetBreakdown';
import {
  ruleKeysToTryForPackage,
  lookupRuleKeyForPackage,
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  checklistItemInScope,
} from '@/utils/scopeItemQuantities';
import { isSoftCostScopePackage } from '@/utils/softCostScope';
import { hasAcceptedScopePricing } from '@/utils/acceptedPricingSummaryUi';
import {
  SCOPE_MATERIAL_PARSED_FROM_NOTES_LABEL,
  SCOPE_LABOR_PARSED_FROM_NOTES_LABEL,
  SCOPE_PARSED_FROM_NOTES_LABEL,
} from '@/constants/scopeNoteSourceLabels';
import {
  NO_LIVING_SF_PRIMARY_SEED_KEYS,
  buildAreaReconciliation,
  buildSemanticsStateForScope,
  measurementSemanticsV1Enabled,
  preferredPrimaryUnit,
  type MeasurementUnit,
} from '@/utils/measurementSemantics';
import { tagPlanDetectedQuickMeasurementKeys } from '@/utils/quickMeasurementProvenance';
import {
  hydratePaintingPlanMeasurements,
  resolvePaintingPlanTakeoffApiSelection,
} from '@/utils/hydratePaintingPlanMeasurements';
import {
  isCustomScopeChecklistItem,
  stripBathroomFalsePositiveFloorDemoQuantities,
} from '@/utils/estimateScopeChecklistUi';
import { syncMeasurementsWithSouthernUtahPlanFacts } from '@/utils/quickMeasurementEstimates';
import {
  getScopePackagesForReview,
  withReconciledScopePackages,
  confirmScopeDisplayItemsFromDraft,
} from '@/utils/scopePackagesForReview';
import { sumBathFloorSqft } from '@/utils/planBathRooms';
import { applyExistingFeaturesToMeasurements } from '@/utils/wetAreaExistingDemo';
import {
  filterChecklistItemsForTrade,
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
  getTradeScopeAllowlist,
  stripScopeInputForSingleTrade,
  type PlanTradeKey,
} from '@/utils/planImportTradeConfig';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import { normalizePlumbingPlanMeasurements } from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  hydratePlumbingPlanMeasurementsFromInventory,
  reconcilePlumbingEquipmentScopeMeasurements,
} from '@/utils/planTakeoffReviewUi';
import { confirmedPaintingMeasurementTextLines } from '@/utils/subcontractorTrade/paintingPlanConvergence';
import { applyHydratedInsulationScopeMeasurements } from '@/utils/subcontractorTrade/insulationPlanConvergence';
import type {
  ElectricalPanelLocation,
  ElectricalProjectCondition,
  ElectricalTrenchCondition,
  ElectricalQuantityKey,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { ELECTRICAL_CARDS } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  PLUMBING_CARDS,
  PLUMBING_INVENTORY_DERIVED_ITEM_IDS,
  PLUMBING_INVENTORY_DERIVED_KEYS,
  PLUMBING_PLAN_QUICK_MEASUREMENT_KEYS,
  PLUMBING_REVIEW_MEASUREMENT_KEYS,
  buildPlumbingStructuredMeasurements,
  syncPlumbingScopeItems,
  type PlumbingPerformerMode,
  type PlumbingWorkflowMode,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  FRAMING_CARDS,
  buildFramingStructuredMeasurements,
  normalizeFramingPlanMeasurements,
  syncFramingScopeItems,
} from '@/utils/subcontractorTrade/framingPlanConvergence';
import {
  COMPLETE_DRYWALL_ASSEMBLY_HELPER,
  COMPLETE_DRYWALL_ASSEMBLY_LABEL,
  DRYWALL_PLAN_QUICK_MEASUREMENT_KEYS,
  DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS,
  hydrateDrywallComponentMeasurementsFromPlanContext,
  normalizeDrywallPlanMeasurements,
  reconcileIncompleteDrywallGeometryTakeoff,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import {
  WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS,
  classifyWindowsDoorsPlanMeasurements,
  normalizeWindowsDoorsPlanMeasurements,
  syncWindowsDoorsScopeItems,
} from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';
import {
  GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS,
  normalizeGarageDoorsPlanMeasurements,
  syncGarageDoorsScopeItems,
} from '@/utils/subcontractorTrade/garageDoorsPlanConvergence';
import {
  applyHvacProvenanceGuardToScopeMeasurements,
  buildHvacStructuredMeasurements,
  HVAC_CARDS,
  HVAC_PLAN_REVIEW_MEASUREMENT_KEYS,
  normalizeHvacPlanMeasurements,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';
import { reconcileFramingScopeMeasurements } from '@/utils/planTakeoffReviewUi';
import type { NormalizedTradeMeasurements } from '@/utils/subcontractorTrade/types';
import type {
  MeasurementSuggestion,
  PlanBuildingAreas,
  PlanFacts,
} from '@/utils/planMeasurementFacts';
import {
  hydrateProjectComplexityMeasurements,
  seedMepProjectComplexityFromPlanImport,
} from '@/utils/projectComplexityAdjustments';

export type DraftItemStatus =
  | 'confirmed'
  | 'user_provided'
  | 'rough_price'
  | 'partial_pricing'
  | 'calculated'
  | 'ai_suggested'
  | 'needs_review'
  | 'missing_price';

export type EstimateConfidenceLevel = 'high' | 'medium' | 'low';

export type EstimateNoteProfile = {
  primary: 'exact_rate' | 'lump_sum' | 'scope_only' | 'mixed';
  calculatedCount?: number;
  lumpSumCount?: number;
  scopeOnlyCount?: number;
  partialCount?: number;
  roughCount?: number;
};

export type EstimateDraftConfidence = {
  level: EstimateConfidenceLevel;
  label: string;
  summary: string;
  reasons?: string[];
};

export type EstimateRoughEstimateRange = {
  enabled: boolean;
  label: string;
  confidence: EstimateConfidenceLevel;
  low: number;
  mid: number;
  high: number;
  assumptions: string[];
  disclaimer: string;
};

export type EstimateBuilderMode =
  | 'organize_only'
  | 'organize_calculate'
  | 'suggest_breakdown';

export type EstimateTier =
  | 'simple_unit'
  | 'room_remodel'
  | 'addition'
  | 'ground_up';

export type ScopeAssumptionState = 'included' | 'excluded' | 'unsure';

/** yes_no = is this work part of the bid? choice = pick a specific answer (e.g. staying vs replacing). */
export type ScopeChecklistInputType = 'yes_no' | 'choice' | 'multi_choice';

export type ScopeChecklistOption = {
  id: string;
  label: string;
};

export type ScopeChecklistItem = {
  id: string;
  label: string;
  helperText?: string;
  category?: string;
  inputType?: ScopeChecklistInputType;
  options?: ScopeChecklistOption[];
  /** yes_no: included = Yes in scope, excluded = No, unsure = Not sure */
  state: ScopeAssumptionState;
  /** choice: selected option id */
  choiceId?: string | null;
  /** multi_choice: selected option ids (e.g. wall remove + add) */
  choiceIds?: string[];
  /** UI-only line injected from wet_area_install picker (not sent to server). */
  derivedFrom?: string;
  /** Server-added custom row created from a priced/mentioned note outside the selected template. */
  noteBacked?: boolean;
};

export type ScopeChecklist = {
  estimateTier: EstimateTier;
  templateKey: string;
  title: string;
  intro: string;
  items: ScopeChecklistItem[];
  legend?: string;
  options?: Array<{ id: string; label: string }>;
  summary?: string;
  requiresConfirmation?: boolean;
  /** Parsed from job notes — used to prefill quick measurements */
  suggestedMeasurements?: ScopeMeasurements | null;
};

/** Area (tile, paint, concrete, framing) and length (baseboard, trim) for scope pricing. */
export type ScopeItemQuantity = {
  quantity: number | null;
  unit: string;
  quantitySource?:
    | 'notes'
    | 'user_entered'
    | 'calculated_confirmed'
    | 'manual_override'
    | 'inferred'
    | 'default_assumption'
    | 'missing'
    | 'not_applicable'
    | 'plan_vision';
  /** Cabinets allowance in notes also covered countertops on the same line. */
  includesCountertops?: boolean;
  /**
   * Optional durable measurement roles (primary / pricing / benchmark).
   * Present only when BUILD_AI_MEASUREMENT_SEMANTICS_V1 is enabled for new writes.
   * Legacy records without this field continue to load unchanged.
   */
  measurementState?:
    | import('@/utils/measurementSemantics').ScopeMeasurementState
    | null;
};

/** Persisted accepted-pricing metadata for Confirm Scope cards. */
export type ScopePricingAcceptanceMetadata = {
  selectionStatus: 'accepted' | 'user_entered' | 'manual_adjusted';
  pricingSourceLabel: string;
  pricingSourceKind:
    | 'national_average'
    | 'local_benchmark'
    | 'saved_rate'
    | 'parsed_from_notes'
    | 'user_entered'
    | 'allowance'
    | 'unknown';
  pricingTypeLabel: string;
  geographicBasis?: string;
  originalSuggestionLabel?: string;
  originalPricingSourceLabel?: string;
  rateSourceLabel?: string;
  lumpSumOnly?: boolean;
  materialAmount?: number;
  laborAmount?: number;
  allowanceAmount?: number;
  subcontractorAmount?: number;
  totalAmount: number;
  benchmarkProvenance?: import('@/utils/benchmarkEngine').BenchmarkProvenance;
};

export type PlanRoomMeasurement = {
  name: string;
  areaSqft: number | null;
  lengthFt?: number | null;
  widthFt?: number | null;
  sourcePage?: number | null;
  sourceSheet?: string | null;
  sourceLabel?: string | null;
  sourceType?: 'plan_explicit' | 'plan_derived' | 'user_entered' | 'unknown';
  confidence?: number | null;
};

export type ScopeMeasurements = {
  insulationAssemblies?: InsulationAssembly[] | null;
  stuccoGrossWallSqft?: number | null;
  stuccoWindowDoorOpeningSqft?: number | null;
  stuccoGarageOpeningSqft?: number | null;
  stuccoOtherFinishDeductionSqft?: number | null;
  stuccoNetWallSqft?: number | null;
  stuccoSoffitSqft?: number | null;
  stuccoParapetSqft?: number | null;
  stuccoFoamTrimLf?: number | null;
  stuccoControlJointLf?: number | null;
  stuccoAccessAffectedSqft?: number | null;
  stuccoRepairAffectedSqft?: number | null;
  stuccoStories?: number | null;
  stuccoWallHeightFt?: number | null;
  /** Plan-import routing/provenance; does not imply detailed trade quantities. */
  planImportMode?:
    | import('@/utils/planImportTradeConfig').PlanEstimatingMode
    | null;
  planImportTradeKey?:
    | import('@/utils/planImportTradeConfig').PlanTradeKey
    | null;
  /** Stable client fingerprint for recognizing a repeat import of the same plan. */
  planImportFingerprint?: string | null;
  planImportProvenance?: PlanImportPayload['tradeProvenance'];
  planImportMissingInfo?: string[];
  paintScope?: Array<
    'walls' | 'ceilings' | 'trim' | 'doors' | 'cabinets' | 'exterior'
  > | null;
  paintAreaBasis?:
    | 'walls'
    | 'ceilings'
    | 'combined'
    | 'floor_area'
    | 'unknown'
    | null;
  paintAreaNeedsConfirmation?: boolean | null;
  paintAreaSqft?: number | null;
  paintPricingMethod?: 'combined' | 'separate' | null;
  combinedPaintableAreaSqft?: number | null;
  paintOccupancy?: 'occupied' | 'vacant' | 'new_construction' | null;
  paintApplicationMethod?: 'brush_roll' | 'spray' | 'mixed' | null;
  paintOccupancyConfirmed?: boolean | null;
  paintApplicationMethodConfirmed?: boolean | null;
  cabinetMeasurementMethod?:
    | 'linear_feet'
    | 'doors_drawers'
    | 'lump_sum'
    | 'surface_area'
    | null;
  cabinetUpperLf?: number | null;
  cabinetLowerLf?: number | null;
  cabinetTallLf?: number | null;
  cabinetRunLf?: number | null;
  /** Bathroom floor sqft — used for floor tile, demo, etc. */
  bathroomFloorSqft?: number | null;
  kitchenFloorSqft?: number | null;
  /** Flooring / multi-area floor jobs (tile demo, laminate install, etc.) */
  floorAreaSqft?: number | null;
  /** Finished floor install area — separate from building/ADU sqft on addition jobs */
  flooringSqft?: number | null;
  flooringProductScope?: Array<
    | 'lvp'
    | 'laminate'
    | 'engineered_hardwood'
    | 'solid_hardwood'
    | 'tile'
    | 'carpet'
    | 'sheet_vinyl_vct'
    | 'unknown'
  > | null;
  flooringLvpSqft?: number | null;
  flooringLaminateSqft?: number | null;
  flooringEngineeredHardwoodSqft?: number | null;
  flooringSolidHardwoodSqft?: number | null;
  flooringTileSqft?: number | null;
  flooringCarpetSqft?: number | null;
  flooringSheetVinylSqft?: number | null;
  floorDemoSqft?: number | null;
  floorPrepSqft?: number | null;
  flooringExistingLvpInstallMethod?:
    | 'floating'
    | 'glue_down'
    | 'unknown'
    | null;
  flooringExistingSheetVinylType?: 'sheet_vinyl' | 'vct' | 'unknown' | null;
  flooringNewLvpInstallMethod?: 'floating' | 'glue_down' | 'unknown' | null;
  flooringNewSheetVinylType?: 'sheet_vinyl' | 'vct' | 'unknown' | null;
  flooringAttachedPad?: 'yes' | 'no' | 'unknown' | null;
  flooringMoistureMembraneIncluded?: 'yes' | 'no' | 'unknown' | null;
  floorPrepLevel?: 0 | 1 | 2 | 3 | 4 | null;
  /** Custom/local demolition price disclosure — whether final substrate prep is included. */
  flooringDemoIncludesSubstratePrep?: 'no' | 'yes' | 'unsure' | null;
  /** Per new-flooring-product prep area and severity (primary QM input). */
  floorPrepByProduct?: Record<
    string,
    {
      sqft: number | null;
      severity: 'none' | 'light' | 'medium' | 'heavy' | 'extensive' | null;
    }
  > | null;
  /** @deprecated Legacy transition rows — migrated to floorPrepByProduct when possible. */
  floorPrepTransitions?: Array<{
    existingType: string;
    newProduct: string;
    sqft: number;
    prepLevel?: 0 | 1 | 2 | 3 | 4 | null;
  }> | null;
  underlaymentSqft?: number | null;
  moistureBarrierSqft?: number | null;
  transitionLf?: number | null;
  transitionCount?: number | null;
  quarterRoundLf?: number | null;
  backsplashSqft?: number | null;
  countertopSqft?: number | null;
  cabinetLf?: number | null;
  wallDemoSqft?: number | null;
  wallDemoLf?: number | null;
  showerWallTileSqft?: number | null;
  showerFloorTileSqft?: number | null;
  wallPaintSqft?: number | null;
  ceilingPaintSqft?: number | null;
  exteriorPaintSqft?: number | null;
  baseboardLf?: number | null;
  interiorDoorCount?: number | null;
  windowCount?: number | null;
  exteriorDoorCount?: number | null;
  slidingDoorCount?: number | null;
  /** Manual LF override for opening trim & finish takeoff. */
  trimFinishLf?: number | null;
  /** When true, suggested opening trim pricing includes field paint/stain labor. */
  trimFinishFieldPaintIncluded?: boolean | null;
  /** Garage door schedule counts by type. */
  garageDoorSingleCount?: number | null;
  garageDoorDoubleCount?: number | null;
  garageDoorRvCount?: number | null;
  garageDoorOpenerCount?: number | null;
  cabinetPaintSqft?: number | null;
  railingLf?: number | null;
  landscapeSqft?: number | null;
  artificialTurfSqft?: number | null;
  demoClearingSqft?: number | null;
  gradingSqft?: number | null;
  soilPrepSqft?: number | null;
  sodSqft?: number | null;
  paverSqft?: number | null;
  rockMulchSqft?: number | null;
  landscapeTons?: number | null;
  plantCount?: number | null;
  treeCount?: number | null;
  irrigationZoneCount?: number | null;
  drainageLf?: number | null;
  concreteEdgingLf?: number | null;
  boulderCount?: number | null;
  landscapeLightCount?: number | null;
  landscapeScope?: string[] | null;
  landscapeClearingLevel?:
    | 'light_clearing'
    | 'medium_vegetation'
    | 'dense_vegetation'
    | 'unsure'
    | null;
  concreteScope?: string[] | null;
  concreteDemoSqft?: number | null;
  concreteDemoThicknessBand?:
    | 'thin_2_3'
    | 'standard_4'
    | 'heavy_5_6'
    | 'structural_7_plus'
    | null;
  concreteDemoThicknessBands?: Array<
    'thin_2_3' | 'standard_4' | 'heavy_5_6' | 'structural_7_plus'
  > | null;
  concreteDemoAreaByThickness?: Partial<
    Record<
      'thin_2_3' | 'standard_4' | 'heavy_5_6' | 'structural_7_plus',
      number | null
    >
  > | null;
  concreteDemoReinforced?: boolean | null;
  concreteDemoLimitedAccess?: boolean | null;
  concreteDemoCy?: number | null;
  tradeScopeSelections?: Partial<
    Record<'concrete' | 'deck_patio' | 'hvac' | 'roofing', string[] | null>
  > | null;
  roofSquares?: number | null;
  roofAreaSqft?: number | null;
  roofIceWaterShieldSqft?: number | null;
  roofPitch?: string | null;
  storyCount?: number | null;
  roofDeckingReplacementSqft?: number | null;
  roofDripEdgeLf?: number | null;
  roofRidgeCapLf?: number | null;
  roofRidgeVentLf?: number | null;
  roofValleyFlashingLf?: number | null;
  roofStepFlashingLf?: number | null;
  roofWallFlashingLf?: number | null;
  roofChimneyFlashingCount?: number | null;
  roofPipeBootCount?: number | null;
  roofVentCount?: number | null;
  roofTurbineVentCount?: number | null;
  roofSkylightCount?: number | null;
  roofPenetrationCount?: number | null;
  roofRepairAffectedSqft?: number | null;
  roofGutterLf?: number | null;
  roofDownspoutCount?: number | null;
  hvacSystemCount?: number | null;
  hvacSystemTons?: number | null;
  hvacServiceCallCount?: number | null;
  hvacEquipmentReplacementCount?: number | null;
  hvacRefrigerantCount?: number | null;
  hvacThermostatCount?: number | null;
  hvacDuctworkLf?: number | null;
  hvacSupplyRegisterCount?: number | null;
  hvacReturnGrilleCount?: number | null;
  hvacVentilationCount?: number | null;
  hvacPermitCount?: number | null;
  hvacCleanupCount?: number | null;
  drywallSqft?: number | null;
  drywallWallSqft?: number | null;
  drywallCeilingSqft?: number | null;
  drywallOpeningDeductionSqft?: number | null;
  drywallGarageFireRatedSqft?: number | null;
  drywallMoistureResistantSqft?: number | null;
  drywallVaultedSlopedSqft?: number | null;
  drywallHighCeilingSqft?: number | null;
  drywallFinishLevel?: string | null;
  drywallSheetLength?: string | null;
  drywallStandardBoardType?: string | null;
  garageWallDrywallSqft?: number | null;
  garageCeilingDrywallSqft?: number | null;
  moistureResistantDrywallSqft?: number | null;
  fireRatedDrywallSqft?: number | null;
  specialtyDrywallSqft?: number | null;
  highCeilingDrywallSqft?: number | null;
  vaultedCeilingDrywallSqft?: number | null;
  level5FinishSqft?: number | null;
  exteriorWallGrossSqft?: number | null;
  exteriorWallInsulationSqft?: number | null;
  atticInsulationSqft?: number | null;
  insulatedRoofDeckSqft?: number | null;
  floorInsulationSqft?: number | null;
  garageSeparationInsulationSqft?: number | null;
  insulatedGarageWallSqft?: number | null;
  insulatedGarageCeilingSqft?: number | null;
  openingDeductionSqft?: number | null;
  insulationMaterialType?: string | null;
  insulationRValue?: string | null;
  garageInsulationIncluded?: string | null;
  concreteSqft?: number | null;
  concreteReinforcementSqft?: number | null;
  concreteSealerSqft?: number | null;
  concreteSubgradePrepSqft?: number | null;
  concreteAreaByType?: Partial<
    Record<
      'driveways' | 'sidewalks' | 'patios' | 'rv_pads' | 'walkways',
      number | null
    >
  > | null;
  concreteThicknessByType?: Partial<
    Record<
      'driveways' | 'sidewalks' | 'patios' | 'rv_pads' | 'walkways',
      number | null
    >
  > | null;
  concreteThicknessInches?: number | null;
  concreteDecorativeFinish?:
    | 'integral_color'
    | 'exposed_aggregate'
    | 'basic_stamped'
    | 'premium_stamped'
    | null;
  complexFormingLf?: number | null;
  additionalHaulOffLoadCount?: number | null;
  concreteCy?: number | null;
  excavationCy?: number | null;
  excavationAreaSqft?: number | null;
  excavationDepthInches?: number | null;
  excavationQuantityMode?: 'direct_cy' | 'area_depth' | null;
  deckSqft?: number | null;
  /** Detached/attached garage area from plan schedule (not living SF). */
  garageSqft?: number | null;
  /** Named rooms read from the plan (for Quick measurements display). */
  planRooms?: PlanRoomMeasurement[];
  /**
   * Wet-area finish for Quick Measurements. Gates shower wall/floor tile fields
   * and optional planning estimates. Independent of checklist choiceId but can sync.
   * Prefer bathCount / prefabBathCount / tubBathCount when mixed finishes are used.
   */
  wetAreaFinish?: import('@/utils/planBathRooms').WetAreaFinishChoice | null;
  /** Tile shower / tiled wet-area bath count (drives shower SF planning). */
  bathCount?: number | null;
  /** Tile shower pan (mud pan) — bathroom photo jobs split from bathCount (walls). */
  tilePanBathCount?: number | null;
  /** Prefab pan baths — does not clear or replace tile shower SF. */
  prefabBathCount?: number | null;
  /** Prefab shower enclosure / surround unit count. */
  prefabEnclosureBathCount?: number | null;
  /** Tub baths — does not clear or replace tile shower SF. */
  tubBathCount?: number | null;
  /** Bathroom floor tile install count (outside shower) — Wet area finish. */
  bathFloorTileCount?: number | null;
  /** Glass shower door / enclosure count (Wet area finish). */
  showerDoorCount?: number | null;
  /** Existing wet-area features (QM — bathroom photo/notes). */
  existingTubCount?: number | null;
  existingTileWallCount?: number | null;
  existingTilePanCount?: number | null;
  existingPrefabPanCount?: number | null;
  existingPrefabEnclosureCount?: number | null;
  existingShowerDoorCount?: number | null;
  existingBathFloorTileCount?: number | null;
  /** Bathroom fixtures QM — vanity / countertop existing, install, demo. */
  bathroomExistingVanityCount?: number | null;
  bathroomExistingCounterCount?: number | null;
  bathroomInstallVanityCount?: number | null;
  bathroomInstallCounterCount?: number | null;
  bathroomDemoVanityCount?: number | null;
  bathroomDemoCounterCount?: number | null;
  /** Bathroom vanity countertop material profile for national-average pricing. */
  bathroomVanityCountertopMaterialType?: string | null;
  /** Bathroom toilet relocate — floor construction type for conditional pricing. */
  bathroomToiletRelocateFloorType?: string | null;
  /** Whether toilet relocate floor type was user-selected or AI-inferred. */
  bathroomToiletRelocateFloorTypeSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  /** Bathroom shower/tub rough-in — wall & floor access for valve, head, and drain lines. */
  bathroomShowerRoughAccessType?: string | null;
  /** Whether shower rough-in access was user-selected or AI-inferred. */
  bathroomShowerRoughAccessTypeSource?: 'user_selected' | 'ai_inferred' | null;
  /** In-place stub-out vs relocating shower/tub valve, head, or drain lines. */
  bathroomShowerRoughWorkType?: string | null;
  /** Whether shower rough-in work type was user-selected or AI-inferred. */
  bathroomShowerRoughWorkTypeSource?: 'user_selected' | 'ai_inferred' | null;
  /** Shower, bathtub, or tub/shower combination being roughed in. */
  bathroomShowerRoughFixtureType?: string | null;
  bathroomShowerRoughFixtureTypeSource?: 'user_selected' | 'ai_inferred' | null;
  /** Remodel demolition exposes plumbing vs separate access required. */
  bathroomShowerRoughPlumbingExposed?: string | null;
  bathroomShowerRoughPlumbingExposedSource?:
    | 'user_selected'
    | 'demo_detected'
    | 'ai_inferred'
    | null;
  /** @deprecated Migrated to bathroomShowerRoughPlumbingExposed. */
  bathroomShowerRoughWallAccess?: string | null;
  /** @deprecated Migrated to bathroomShowerRoughPlumbingExposedSource. */
  bathroomShowerRoughWallAccessSource?: 'user_selected' | 'ai_inferred' | null;
  /** Wood-framed floor vs concrete slab. */
  bathroomShowerRoughFloorConstruction?: string | null;
  bathroomShowerRoughFloorConstructionSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  /** Same-location slab — is cutting or below-slab drain work required? */
  bathroomShowerRoughSlabWorkRequired?: string | null;
  bathroomShowerRoughSlabWorkRequiredSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  /** Localized prime/paint scope after bath drywall repair. */
  bathroomPaintRepairScope?: string | null;
  bathroomPaintRepairScopeSource?: 'user_selected' | 'ai_inferred' | null;
  /** Also repaint full room — price on Interior painting (can combine with localized repair scope). */
  bathroomPaintRepairEntireRoom?: boolean | null;
  bathroomPaintRepairEntireRoomSource?: 'user_selected' | 'ai_inferred' | null;
  /** Wall/ceiling paintable SF for entire-room add-on on paint_repair. */
  bathroomPaintRepairEntireRoomSqft?: string | number | null;
  bathroomPaintRepairEntireRoomSqftSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  /** One-line combined drywall + texture + prime + paint assembly. */
  bathroomDrywallPaintUseCombinedAssembly?: boolean | null;
  bathroomDrywallPaintUseCombinedAssemblySource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  /** Interior paint mobilization — bundled vs standalone minimum. */
  bathroomInteriorPaintMobilization?: string | null;
  bathroomInteriorPaintMobilizationSource?:
    | 'user_selected'
    | 'ai_inferred'
    | null;
  bathroomInteriorPaintSurface?: string | null;
  bathroomInteriorPaintSurfaceSource?: 'user_selected' | 'ai_inferred' | null;
  bathroomInteriorPaintCondition?: string | null;
  bathroomInteriorPaintConditionSource?: 'user_selected' | 'ai_inferred' | null;
  /** Shower door style tier — standard slider vs premium frameless. */
  bathroomGlassDoorStyle?: string | null;
  bathroomGlassDoorStyleSource?: 'user_selected' | 'ai_inferred' | null;
  /** Demo tear-out selections derived from existing + install (QM). */
  demoTubCount?: number | null;
  demoTileWallCount?: number | null;
  demoTilePanCount?: number | null;
  demoPrefabPanCount?: number | null;
  demoPrefabEnclosureCount?: number | null;
  demoShowerDoorCount?: number | null;
  demoBathFloorTileCount?: number | null;
  /** Keep existing glass door — no new door install scope. */
  reuseExistingShowerDoor?: boolean | null;
  /** Per-demo-row manual overrides when contractor adjusts auto demo counts. */
  demoWetAreaManualOverrides?: Partial<Record<string, boolean>> | null;
  /** Kitchen QM — existing / install / demo scope panels (photo/notes jobs). */
  kitchenExistingCabinetCount?: number | null;
  kitchenExistingCounterCount?: number | null;
  kitchenExistingApplianceCount?: number | null;
  kitchenExistingBacksplashCount?: number | null;
  kitchenExistingFloorCount?: number | null;
  kitchenInstallCabinetCount?: number | null;
  kitchenInstallCounterCount?: number | null;
  kitchenInstallApplianceCount?: number | null;
  kitchenInstallBacksplashCount?: number | null;
  kitchenInstallFlooringCount?: number | null;
  kitchenInstallIslandCount?: number | null;
  kitchenDemoCabinetCount?: number | null;
  kitchenDemoCounterCount?: number | null;
  kitchenDemoIslandCount?: number | null;
  kitchenDemoApplianceCount?: number | null;
  kitchenDemoFloorCount?: number | null;
  kitchenDemoWallCount?: number | null;
  /** Flooring QM — existing / install / demo scope panels. */
  flooringExistingCount?: number | null;
  flooringExistingTypes?: Array<
    | 'carpet'
    | 'tile'
    | 'solid_hardwood'
    | 'engineered_hardwood'
    | 'laminate'
    | 'lvp'
    | 'sheet_vinyl_vct'
    | 'unknown'
  > | null;
  flooringInstallScopeCount?: number | null;
  flooringDemoScopeCount?: number | null;
  /** Structured, sheet-aware facts retained after plan review for planning formulas. */
  planFacts?: PlanFacts;
  /** Original metadata for accepted planning suggestions, retained after edits. */
  quickMeasurementSuggestionMetadata?: Partial<
    Record<string, MeasurementSuggestion>
  >;
  /** Per-field numeric confidence from the original takeoff. */
  quickMeasurementFieldConfidence?: Record<string, number>;
  /** Competing plan-pass candidates retained for contractor confirmation. */
  measurementProvenance?: Record<string, unknown>;
  /** Plumbing utility tie-ins retained as scope/allowance confirmations. */
  plumbingUtilityConnections?: PlanToMeasurementsResult['utilityConnections'];
  /** Plumbing fixture inventory retained for auditability after review. */
  plumbingFixtureInventory?: Record<string, number>;
  /** Complexity flags retained for contractor review; they do not alter rates. */
  plumbingComplexityFactors?: PlanToMeasurementsResult['complexityFactors'];
  /** Dynamic Plumbing review status grouped for contractor confirmation. */
  plumbingReviewStatus?: PlanToMeasurementsResult['plumbingReviewStatus'];
  plumbingWaterHeaterDetail?: PlanToMeasurementsResult['waterHeaterDetail'];
  plumbingGasApplianceScope?: PlanToMeasurementsResult['gasApplianceScope'];
  /** Material conflicts retained through plan import and scope hydration. */
  measurementConflicts?: PlanMeasurementConflict[];
  /** Electrical confidence-tier readiness and sheet coverage validation. */
  electricalValidation?: {
    sheetCoverage?: {
      expectedPages?: number[];
      coveredPages?: number[];
      missingPages?: number[];
      complete?: boolean;
    };
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
  /** Declared vs detected living/garage reconciliation (measurement-semantics). */
  areaReconciliation?:
    | import('@/utils/measurementSemantics').AreaReconciliation
    | null;
  /**
   * Per-Quick-Measurement-field provenance: which fields were populated
   * directly from plan takeoff vs accepted from a planning estimate.
   * Absent/undefined for a key means "typed/legacy" — rendered as a plain
   * confirmed value, matching pre-provenance behavior.
   */
  quickMeasurementSources?: import('@/utils/quickMeasurementProvenance').QuickMeasurementSourceMap;
  /**
   * Quick Measurement keys the contractor has explicitly edited or accepted
   * a suggestion for. Original detected/estimated provenance in
   * quickMeasurementSources is preserved even after an override.
   */
  quickMeasurementUserOverrides?: import('@/utils/quickMeasurementProvenance').QuickMeasurementOverrideMap;
  /** Per-checklist-item overrides keyed by checklist id */
  itemQuantities?: Record<string, ScopeItemQuantity>;
  /** Accepted pricing metadata keyed by checklist item id */
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
  /** Item-specific scope gap resolutions keyed by `${scopeItemId}::${componentKey}` */
  scopeGapResolutions?: Record<
    string,
    import('@/utils/scopeReviewUi').ScopeGapResolutionRecord
  >;
  /** Explicit pricing override confirmations (measurement-semantics). */
  pricingOverrideLog?: import('@/utils/measurementSemantics').PricingOverrideLog[];
  /** Electrical canonical Notes/Voice/Manual selections — not fake quantities. */
  electricalScope?: string[] | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
  electricalIncludeRough?: boolean | null;
  electricalIncludeTrim?: boolean | null;
  electricalConduit?: boolean | null;
  electricalTrenching?: boolean | null;
  electricalConduitSpecialty?: boolean | null;
  electricalTrenchCondition?: ElectricalTrenchCondition | null;
  existingServiceAmperage?: number | null;
  electricalPanelLocation?: ElectricalPanelLocation | null;
  electricalMeterMainCombo?: boolean | null;
  /** Plumbing canonical Notes/Voice/Manual selections — not fake quantities. */
  plumbingScope?: string[] | null;
  serviceCallCount?: number | null;
  fixtureRepairCount?: number | null;
  fixtureReplacementCount?: number | null;
  drainCleaningCount?: number | null;
  waterLineLf?: number | null;
  sewerLineLf?: number | null;
  gasLineLf?: number | null;
  plumbingRoughPointCount?: number | null;
  plumbingTrimHookupCount?: number | null;
  plumbingFixturesHardwareCount?: number | null;
  waterHeaterCount?: number | null;
  gasApplianceConnectionCount?: number | null;
  partsMaterialsCount?: number | null;
  emergencyFeeCount?: number | null;
  plumbingCleanupCount?: number | null;
  plumbingWorkflowMode?: PlumbingWorkflowMode | null;
  plumbingPerformerMode?: PlumbingPerformerMode | null;
  /** Framing canonical plan export / notes selections. */
  framingScope?: string[] | null;
  framedAreaSqft?: number | null;
  wallFramingLf?: number | null;
  sheathingSqft?: number | null;
  framingOpeningCount?: number | null;
  framingCleanupCount?: number | null;
  /** Set only when notes/photos explicitly call for a modified opening. */
  reframingRequested?: boolean | null;
  /** Project complexity multiplier inputs — applied after regional/national base rates. */
  projectComplexity?:
    | import('@/utils/projectComplexityAdjustments').ProjectComplexitySettings
    | null;
  plumbingComplexityFactors?: Array<{
    key?: string;
    label?: string;
  }> | null;
  /** Set for the standalone Plumbing notes/photos entry point. */
  tradeWorkflowSource?: 'standalone_trade' | null;
  /** @deprecated use bathroomFloorSqft */
  sqft?: number | null;
  /** @deprecated use baseboardLf */
  lf?: number | null;
} & Partial<Record<ElectricalQuantityKey, number | null>>;

export type EstimateDraftRoom = {
  name: string;
  scope: string;
  scopeQuantities?: Array<{ label: string; quantity: number; unit: string }>;
  price: number | null;
  laborPrice: number | null;
  materialPrice: number | null;
  priceIncludesLaborAndMaterials: boolean;
  splitIsSuggested?: boolean;
  splitApprovedByUser?: boolean;
  priceProvidedByUser: boolean;
  pricedFromSqftAllowances?: boolean;
  partialPricing?: boolean;
  knownSubtotal?: number | null;
  packageStatus?: DraftItemStatus;
  applyEligible?: boolean;
  roughPricePendingApproval?: boolean;
  pricingItems?: EstimateDraftPricingItem[];
  missingPriceItems?: string[];
};

export type InsulationAssembly = {
  id: string;
  materialType: string;
  rValue: string;
  sqft: number | string | null;
  location?: string | null;
  source?:
    | 'detected_from_plan'
    | 'calculated_from_plan'
    | 'contractor_entered'
    | 'parsed_from_notes'
    | null;
  confirmed?: boolean;
  /** Batt only — faced vs unfaced vapor retarder; defaults to not_sure. */
  battFacing?: 'faced' | 'unfaced' | 'not_sure' | null;
};

export type EstimateDraftPricingItem = {
  name: string;
  description?: string;
  quantity?: number | null;
  unit?: string | null;
  unitRate?: number | null;
  amount?: number | null;
  pricingType?: string;
  priceSource?: string;
  status?: DraftItemStatus;
  formula?: string | null;
  includedInSubtotal?: boolean;
  approvedByUser?: boolean;
  needsReview?: boolean;
};

export type EstimateDraftScopePackage = {
  name: string;
  category?: string;
  trade?: string | null;
  /** Checklist / Confirm Scope item id (excavation, roofing, drywall, …). */
  checklistItemId?: string | null;
  /** Stable cost-code alias for Projects (defaults to checklistItemId). */
  costCode?: string | null;
  scope: string;
  price: number | null;
  laborPrice: number | null;
  materialPrice: number | null;
  pricingType: string;
  includesLabor: boolean | null;
  includesMaterials: boolean | null;
  priceSource: string;
  status: DraftItemStatus;
  knownSubtotal?: number | null;
  calculatedSubtotal?: number | null;
  aiSuggestedSubtotal?: number | null;
  finalApprovedTotal?: number | null;
  formula: string | null;
  pricingItems?: EstimateDraftPricingItem[];
  scopeQuantities?: Array<{ label: string; quantity: number; unit: string }>;
  budgetSplitBasis?: { quantity: number; unit: string } | null;
  missingPriceItems?: string[];
  missingInfo: string[];
  warnings?: string[];
  priceIncludesLaborAndMaterials: boolean;
  splitIsSuggested: boolean;
  priceProvidedByUser: boolean;
  applyEligible?: boolean;
  roughPricePendingApproval?: boolean;
};

export type EstimateDraftAllowance = {
  name: string;
  amount: number | null;
  unit: string | null;
  description: string;
  rate?: number | null;
  quantity?: number | null;
  calculatedAmount?: number | null;
  appliesTo?: string | null;
  kind?: string;
  status?: DraftItemStatus;
  missingInfo?: string[];
};

export type EstimateDraftSuggestedSplit = {
  parentItemName: string;
  total: number;
  suggestedLabor: number;
  suggestedMaterials: number;
  confidence: 'low' | 'medium' | 'high';
  approvedByUser: boolean;
  status?: string;
  previewOnly?: boolean;
};

export type EstimateDraftPayment = {
  label: string;
  amount: number | null;
  percentage: number | null;
  dueTiming: string;
};

export type EstimateAiDraft = {
  originalNotes?: string | null;
  builderMode?: EstimateBuilderMode;
  customerName: string | null;
  projectTitle: string | null;
  projectType: string;
  projectDescription: string | null;
  rooms: EstimateDraftRoom[];
  scopePackages?: EstimateDraftScopePackage[];
  allowances: EstimateDraftAllowance[];
  suggestedSplits?: EstimateDraftSuggestedSplit[];
  inclusions: string[];
  exclusions: string[];
  statedTotal: number | null;
  calculatedLineItemTotal: number | null;
  calculatedLaborTotal: number | null;
  calculatedMaterialTotal: number | null;
  calculatedTotal?: number | null;
  totalMatches?: boolean | null;
  combinedPriceRoomCount?: number;
  suggestedSplitRoomCount?: number;
  pricingWarnings: string[];
  warnings?: string[];
  missingInfo: string[];
  needsReviewItems?: string[];
  contractScope: string | null;
  suggestedPaymentSchedule: EstimateDraftPayment[] | null;
  applySuggestedSplits?: boolean;
  detectedTrades?: string[];
  knownSubtotal?: number | null;
  partialPricingCount?: number;
  bidCompletenessScore?: number | null;
  bidCompletenessGood?: string[];
  bidCompletenessNeedsReview?: string[];
  estimateConfidence?: EstimateDraftConfidence | null;
  whatAiDid?: string[];
  noteProfile?: EstimateNoteProfile | null;
  noPricingDetected?: boolean;
  stillNeededReview?: string[];
  pendingPricingProposal?: {
    empty: boolean;
    source: string;
    sourceLabel: string;
    lines: Array<{
      packageName: string;
      formula: string;
      total: number;
      sourceLabel: string;
    }>;
    totalSuggested: number;
  } | null;
  pricingProposalApproved?: boolean;
  roughEstimate?: EstimateRoughEstimateRange | null;
  roughEstimateRequested?: boolean;
  pricingMemoryEnabled?: boolean;
  pricingMemoryNote?: string | null;
  pricingMemorySettings?: Record<string, unknown> | null;
  pricingMemorySuggestions?: PricingMemorySuggestion[];
  pricingMemorySummary?: {
    label: string;
    lines: string[];
  } | null;
  pricingMemoryMessage?: string | null;
  pricingMemoryActualInsights?: Array<{
    scopeItemName: string;
    message: string;
    historicalBidRate?: number;
    actualAverageRate?: number;
  }>;
  pricingMemoryMissingSuggestions?: Array<{
    missingItem: string;
    scopeItemName: string;
    suggestedUnitRate?: number;
    estimatedTotal?: number | null;
    unitType?: string;
    sourceLabel: string;
    label: string;
    confidence: string;
    requiresApproval: boolean;
  }>;
  pricingMemoryMissingMessage?: string | null;
  /** Shown on review after applying saved pricing from the modal. */
  savedPricingApplySummary?: {
    appliedCount: number;
    stillNeedCount: number;
  } | null;
  /** simple_unit skips scope checklist; complex tiers require confirmation before pricing. */
  estimateTier?: EstimateTier;
  scopeChecklist?: ScopeChecklist | null;
  scopeAssumptionsConfirmed?: boolean;
  requiresScopeConfirmation?: boolean;
  confirmedAssumptions?: ScopeChecklistItem[];
  scopeMeasurements?: ScopeMeasurements | null;
  projectAddress?: string | null;
  addressMissing?: boolean;
  laborTradeItems?: Array<{
    packageName?: string;
    name: string;
    amount: number | null;
    status?: string;
    missing?: boolean;
    missingItems?: string[];
  }>;
  totalValidation?: {
    materialsTotal: number | null;
    laborTotal: number | null;
    calculatedLineItemsTotal: number | null;
    knownSubtotal: number | null;
    aiSuggestedSubtotal: number | null;
    statedTotal: number | null;
    totalMatches?: boolean | null;
    warnings?: string[];
  };
};

export type PricingMemorySuggestion = {
  scopeItemName: string;
  category: string;
  unitType: string;
  suggestedUnitRate: number;
  quantity?: number | null;
  estimatedTotal?: number | null;
  source: string;
  sourceLabel: string;
  sourcePriority: number;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  sampleCount: number;
  requiresApproval: boolean;
  status: string;
};

export type ApplyDraftOptions = {
  applySuggestedSplits?: boolean;
  /** When true, skip AI-suggested splits and packages with no applyable pricing. */
  applyConfirmedOnly?: boolean;
  /** Scope, inclusions, exclusions, and notes only — no labor/material line items. */
  scopeOnly?: boolean;
};

export type ApplyDraftResult = {
  bid: Record<string, unknown>;
  materialsCart: Record<string, unknown>[];
};

export type ClarifyQuestionItem = {
  id: string;
  question: string;
  why?: string | null;
  kind: 'measurement' | 'pricing' | 'scope' | 'project_info';
  targetKey?: string | null;
  targetPackage?: string | null;
};

export type ClarifyDraftResult = {
  questions: string[];
  questionItems?: ClarifyQuestionItem[];
  needsReviewCount: number;
  missingInfoCount: number;
  source?: 'ai' | 'rules';
};

export type ClarifyAnswer = {
  question: string;
  answer: string;
  targetKey?: string | null;
  targetPackage?: string | null;
};

export type ClarifyApplyResult = {
  draft: EstimateAiDraft;
  appliedSummary: string[];
  source: 'ai' | 'rules';
};

export type RefineDraftResult = {
  draft: EstimateAiDraft;
  appliedSummary: string[];
  warnings?: string[];
  markupPct?: number | null;
  source: 'ai' | 'rules';
  command?: string;
};

/** Markup-only Ask AI must not re-sync scope prices (only bid.markupPct changes). */
export function isMarkupOnlyRefineResult(
  result: Pick<RefineDraftResult, 'markupPct' | 'appliedSummary' | 'warnings'>
): boolean {
  if (result.markupPct == null || !Number.isFinite(Number(result.markupPct))) return false;
  if (result.warnings?.length) return false;
  const summary = result.appliedSummary || [];
  if (!summary.length) return false;
  return summary.every((line) => /^Markup set to/i.test(String(line).trim()));
}

const PROJECT_CATEGORY_SLUGS: Record<string, string> = {
  kitchen: 'kitchen-remodel',
  bathroom: 'bathroom-remodel',
  room_addition: 'addition',
  home_addition: 'home-renovation',
  adu: 'adu',
  garage_conversion: 'garage-conversion',
  new_build: 'new-build',
  roofing: 'roofing',
  deck_patio: 'deck-patio',
  plumbing_service: 'plumbing-service',
  landscaping: 'landscaping',
  other: 'other',
};

function newLineItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDraftMoney(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const value = Math.round(Number(amount) * 100) / 100;
  const hasCents = Math.abs(value % 1) > 0.0001;
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

/** Whole-dollar display for planning hero totals and quick summaries. */
export function formatPlanningMoney(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const value = Math.round(Number(amount));
  return `$${value.toLocaleString()}`;
}

export const BUILDER_MODE_LABELS: Record<
  EstimateBuilderMode,
  { title: string; subtitle: string }
> = {
  organize_only: {
    title: 'Organize Only',
    subtitle: 'Keep your numbers; sort scope only',
  },
  organize_calculate: {
    title: 'Organize + Calculate',
    subtitle: 'Calculate sqft × rate when clear',
  },
  suggest_breakdown: {
    title: 'Suggest Breakdown',
    subtitle: 'Lump sums + optional L/M splits',
  },
};

function stripRatePricingSubkeys(
  itemQuantities?: ScopeMeasurements['itemQuantities']
): ScopeMeasurements['itemQuantities'] {
  const out: NonNullable<ScopeMeasurements['itemQuantities']> = {};
  for (const [id, val] of Object.entries(itemQuantities || {})) {
    if (/__(?:material|labor|allowance)$/.test(id)) continue;
    out[id] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

export function repairDraftRatePricingFromNotes(
  draft: EstimateAiDraft,
  notes: string
): EstimateAiDraft {
  const text = String(notes || draft.originalNotes || '').trim();
  if (!text) return draft;

  const parsed = parseScopeMeasurementsFromNotes(text, {
    templateKey: draft.scopeChecklist?.templateKey,
    projectType: draft.projectType,
  });
  if (!Object.keys(parsed).length) {
    return { ...draft, originalNotes: draft.originalNotes || text };
  }

  const mergedItemQuantities = stripBathroomFalsePositiveFloorDemoQuantities(
    {
      ...stripRatePricingSubkeys(draft.scopeMeasurements?.itemQuantities),
      ...stripRatePricingSubkeys(
        draft.scopeChecklist?.suggestedMeasurements?.itemQuantities
      ),
      ...(parsed.itemQuantities || {}),
    },
    draft.scopeChecklist?.templateKey,
    text
  );
  if (parsed.itemQuantities?.floor_demo && !parsed.itemQuantities?.demo) {
    delete mergedItemQuantities.demo;
  }
  clearStalePricingWhenNotesUnpriced(
    mergedItemQuantities,
    text,
    parsed.itemQuantities
  );

  let mergedScopeMeasurements: ScopeMeasurements = {
    ...(draft.scopeMeasurements || {}),
    ...parsed,
    itemQuantities: mergedItemQuantities,
  };
  if (
    draft.scopeChecklist?.templateKey === 'roofing' ||
    draft.projectType === 'roofing'
  ) {
    const normalizedRoofing = normalizeTradeMeasurements(
      'roofing',
      parsed,
      'notes'
    );
    mergedScopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
      mergedScopeMeasurements,
      normalizedRoofing
    );
  }
  if (
    draft.scopeChecklist?.templateKey === 'concrete' ||
    draft.projectType === 'concrete'
  ) {
    const normalizedConcrete = normalizeTradeMeasurements(
      'concrete',
      parsed,
      'notes'
    );
    mergedScopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
      mergedScopeMeasurements,
      normalizedConcrete
    );
  }
  if (
    draft.scopeChecklist?.templateKey === 'flooring' ||
    draft.projectType === 'flooring'
  ) {
    const normalizedFlooring = normalizeTradeMeasurements(
      'flooring',
      parsed,
      'notes'
    );
    mergedScopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
      mergedScopeMeasurements,
      normalizedFlooring
    );
  }
  if (
    draft.scopeChecklist?.templateKey === 'painting' ||
    draft.projectType === 'painting'
  ) {
    const normalizedPainting = normalizeTradeMeasurements(
      'painting',
      parsed,
      'notes'
    );
    mergedScopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
      mergedScopeMeasurements,
      normalizedPainting
    );
  }
  if (
    draft.scopeChecklist?.templateKey === 'electrical' ||
    draft.projectType === 'electrical' ||
    String(draft.projectType || '').toLowerCase() === 'electrical service'
  ) {
    const normalizedElectrical = normalizeTradeMeasurements(
      'electrical',
      parsed,
      'notes'
    );
    mergedScopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
      mergedScopeMeasurements,
      normalizedElectrical
    );
  }
  if (
    ['plumbing', 'plumbing_service'].includes(
      String(draft.scopeChecklist?.templateKey || '').toLowerCase()
    ) ||
    String(draft.projectType || '').toLowerCase() === 'plumbing'
  ) {
    const normalizedPlumbing = normalizeTradeMeasurements(
      'plumbing',
      { ...parsed, notes: text },
      'notes'
    );
    mergedScopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
      mergedScopeMeasurements,
      normalizedPlumbing
    );
  }
  if (
    draft.scopeChecklist?.templateKey === 'drywall' ||
    draft.projectType === 'drywall'
  ) {
    const normalizedDrywall = normalizeTradeMeasurements(
      'drywall',
      { ...parsed, notes: text },
      'notes'
    );
    mergedScopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
      mergedScopeMeasurements,
      normalizedDrywall
    );
  }
  if (
    draft.scopeChecklist?.templateKey === 'windows_doors' ||
    draft.projectType === 'windows_doors' ||
    [
      'windowCount',
      'exteriorDoorCount',
      'slidingDoorCount',
    ].some(key => Number(parsed[key as keyof typeof parsed]) > 0)
  ) {
    const normalizedWindowsDoors = normalizeTradeMeasurements(
      'windows_doors',
      { ...parsed, notes: text },
      'notes'
    );
    mergedScopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
      mergedScopeMeasurements,
      normalizedWindowsDoors
    );
  }
  if (
    draft.scopeChecklist?.templateKey === 'garage_doors' ||
    draft.projectType === 'garage_doors' ||
    [
      'garageDoorSingleCount',
      'garageDoorDoubleCount',
      'garageDoorRvCount',
      'garageDoorOpenerCount',
    ].some(key => Number(parsed[key as keyof typeof parsed]) > 0)
  ) {
    const normalizedGarageDoors = normalizeTradeMeasurements(
      'garage_doors',
      { ...parsed, notes: text },
      'notes'
    );
    mergedScopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
      mergedScopeMeasurements,
      normalizedGarageDoors
    );
  }

  if (__DEV__) {
    const serverIq =
      draft.scopeChecklist?.suggestedMeasurements?.itemQuantities || {};
    console.log('🧮 AI draft backsplash repair', {
      server: {
        material: serverIq.backsplash__material?.quantity,
        labor: serverIq.backsplash__labor?.quantity,
        total: serverIq.backsplash__allowance?.quantity,
      },
      parsed: {
        material: parsed.itemQuantities?.backsplash__material?.quantity,
        labor: parsed.itemQuantities?.backsplash__labor?.quantity,
        total: parsed.itemQuantities?.backsplash__allowance?.quantity,
      },
      merged: {
        material: mergedItemQuantities.backsplash__material?.quantity,
        labor: mergedItemQuantities.backsplash__labor?.quantity,
        total: mergedItemQuantities.backsplash__allowance?.quantity,
      },
    });
  }

  return {
    ...draft,
    originalNotes: draft.originalNotes || text,
    scopeMeasurements: mergedScopeMeasurements,
    scopeChecklist: draft.scopeChecklist
      ? {
          ...draft.scopeChecklist,
          suggestedMeasurements: {
            ...(draft.scopeChecklist.suggestedMeasurements || {}),
            ...parsed,
            itemQuantities: mergedItemQuantities,
          },
        }
      : draft.scopeChecklist,
  };
}

export async function fetchEstimateDraftFromNotes(
  notes: string,
  savedTemplates: unknown[] = [],
  authToken?: string | null
): Promise<EstimateAiDraft> {
  if (__DEV__) {
    console.warn('🤖 fetchEstimateDraftFromNotes entered');
  }
  const payload = await postAiAssistantJson<{
    draft?: EstimateAiDraft;
    error?: string;
    message?: string;
  }>('/estimate-draft-from-notes', { notes, savedTemplates }, 45000, authToken);

  if (!payload?.draft) {
    throw new Error(
      payload?.message || payload?.error || 'Failed to generate estimate draft'
    );
  }

  return repairDraftRatePricingFromNotes(payload.draft, notes);
}

export async function fetchSuggestedDraftSplits(
  draft: EstimateAiDraft,
  applySuggestedSplits = false
): Promise<EstimateAiDraft> {
  const payload = await postAiAssistantJson<{
    draft?: EstimateAiDraft;
    error?: string;
    message?: string;
  }>('/estimate-draft-suggest-splits', { draft, applySuggestedSplits }, 90000);

  if (!payload?.draft) {
    throw new Error(
      payload?.message || payload?.error || 'Failed to suggest splits'
    );
  }

  return syncSelectedScopePricing(payload.draft);
}

export async function fetchRoughEstimateRange(draft: EstimateAiDraft): Promise<{
  draft: EstimateAiDraft;
  roughEstimate: EstimateRoughEstimateRange;
}> {
  const payload = await postAiAssistantJson<{
    draft?: EstimateAiDraft;
    roughEstimate?: EstimateRoughEstimateRange;
    error?: string;
    message?: string;
  }>('/estimate-draft-rough-range', { draft }, 60000);

  if (!payload?.roughEstimate) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        'Failed to generate rough budget range'
    );
  }

  return {
    draft: payload.draft || { ...draft, roughEstimate: payload.roughEstimate },
    roughEstimate: payload.roughEstimate,
  };
}

export async function fetchClarifyDraftQuestions(
  draft: EstimateAiDraft
): Promise<ClarifyDraftResult> {
  const payload = await postAiAssistantJson<
    ClarifyDraftResult & { error?: string; message?: string }
  >('/estimate-draft-clarify', { draft }, 60000);

  if (!payload?.questions) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        'Failed to load clarification questions'
    );
  }

  return payload;
}

export async function applyClarifyAnswersToDraft(
  draft: EstimateAiDraft,
  answers: ClarifyAnswer[]
): Promise<ClarifyApplyResult> {
  const payload = await postAiAssistantJson<
    Partial<ClarifyApplyResult> & { error?: string; message?: string }
  >('/estimate-draft-clarify-apply', { draft, answers }, 90000);

  if (!payload?.draft) {
    throw new Error(
      payload?.message || payload?.error || 'Failed to apply answers'
    );
  }

  return {
    draft: syncSelectedScopePricing(payload.draft),
    appliedSummary: payload.appliedSummary || [],
    source: payload.source === 'ai' ? 'ai' : 'rules',
  };
}

export async function refineDraftWithCommand(
  draft: EstimateAiDraft,
  command: string
): Promise<RefineDraftResult> {
  const payload = await postAiAssistantJson<
    Partial<RefineDraftResult> & { error?: string; message?: string }
  >('/estimate-draft-refine', { draft, command }, 90000);

  if (!payload?.draft) {
    throw new Error(
      payload?.message || payload?.error || 'Failed to apply revision'
    );
  }

  return {
    draft: syncSelectedScopePricing(payload.draft),
    appliedSummary: payload.appliedSummary || [],
    warnings: payload.warnings || [],
    markupPct: payload.markupPct ?? null,
    source: payload.source === 'ai' ? 'ai' : 'rules',
    command: payload.command,
  };
}

export type PhotoScopeImage = {
  base64: string;
  mimeType?: string;
  /** Filename hint — used for PDF plan uploads. */
  name?: string;
};

export type PhotoScopeDetection = {
  itemId: string;
  label?: string;
  state: 'included' | 'excluded' | 'unsure';
  choiceId?: string | null;
  confidence: number;
  evidence?: string | null;
};

export type PhotoExistingFeature = {
  feature: string;
  confidence?: number;
  evidence?: string | null;
};

export type PhotoToScopeResult = {
  success: boolean;
  reason?: string | null;
  scopeText: string;
  notesBlock: string;
  mergedNotes: string;
  detections: PhotoScopeDetection[];
  existingFeatures?: PhotoExistingFeature[];
  templateKey?: string | null;
  projectTypeHint?: string | null;
};

/** Analyze site photos → scope notes block (client merges into Job notes before Generate). */
export async function fetchPhotoToScope(params: {
  images: PhotoScopeImage[];
  existingNotes?: string;
  projectTypeHint?: string | null;
  templateKeyHint?: string | null;
}): Promise<PhotoToScopeResult> {
  const payload = await postAiAssistantJson<
    Partial<PhotoToScopeResult> & { error?: string; message?: string }
  >(
    '/photo-to-scope',
    {
      images: params.images,
      existingNotes: params.existingNotes || '',
      projectTypeHint: params.projectTypeHint || null,
      templateKeyHint: params.templateKeyHint || null,
      mergeIntoNotes: true,
    },
    120000
  );

  if (payload?.error && payload.success !== true && payload.success !== false) {
    throw new Error(
      payload.message || payload.error || 'Photo analysis failed'
    );
  }

  return {
    success: payload.success !== false,
    reason: payload.reason ?? null,
    scopeText: payload.scopeText || '',
    notesBlock: payload.notesBlock || '',
    mergedNotes: payload.mergedNotes || params.existingNotes || '',
    detections: Array.isArray(payload.detections)
      ? (payload.detections as PhotoScopeDetection[])
      : [],
    existingFeatures: Array.isArray(payload.existingFeatures)
      ? (payload.existingFeatures as PhotoExistingFeature[])
      : [],
    templateKey: payload.templateKey ?? null,
    projectTypeHint: payload.projectTypeHint ?? null,
  };
}

export type PlanLowConfidenceField = {
  field: string;
  value: number;
  confidence: number;
};

export type PlanUnreadableField = {
  field: string;
  reason: string;
};

export type PlanScopeResult = {
  scopeText: string;
  detections: PhotoScopeDetection[];
};

export type PlanMeasurementConflict = {
  field: string;
  selectedValue: number;
  selectedSource: string;
  threshold: number;
  requiresConfirmation: boolean;
  candidates: Array<{
    value: number;
    source: string;
    confidence: number;
    directEvidence: boolean;
  }>;
};

export type PlanToMeasurementsResult = {
  success: boolean;
  reason?: string | null;
  /** Vision's own read of the pages: good | partial | unreadable. */
  imageQuality?: string | null;
  rooms: Array<{
    name: string;
    lengthFt?: number | null;
    widthFt?: number | null;
    areaSqft?: number | null;
    measurementKey?: string | null;
    confidence: number;
  }>;
  measurements: Record<string, number>;
  buildingAreas?: PlanBuildingAreas;
  planFacts?: PlanFacts;
  /** Per-field 0-1 confidence that the value was read (not guessed). */
  fieldConfidence: Record<string, number>;
  /** Sheet/page evidence retained for Plumbing quantities and derived counts. */
  fieldEvidence?: Record<
    string,
    Array<{
      page?: number;
      sheet?: string;
      label?: string;
      sourceText?: string;
      sourceType?: string;
      evidenceKind?: string;
      confidence?: number;
      derivedFrom?: string[];
    }>
  >;
  /** Fixture counts read from plumbing schedules/symbols before rough/trim derivation. */
  fixtureInventory?: Record<string, number>;
  /** Plumbing utility tie-ins are scope/allowance confirmations, never quantities. */
  utilityConnections?: Array<{
    label: string;
    status?: 'scope_only' | 'confirmed';
    evidence?: Array<{
      page?: number;
      sheet?: string;
      label?: string;
      sourceText?: string;
    }>;
  }>;
  /** Explicit plan conditions that may affect labor review; never price automatically. */
  complexityFactors?: Array<{
    key?: string;
    label: string;
    status?: 'review';
    confidence?: number;
    evidence?: Array<{
      page?: number;
      sheet?: string;
      label?: string;
      sourceText?: string;
    }>;
  }>;
  /** Dynamic Plumbing review status grouped for contractor confirmation. */
  plumbingReviewStatus?: {
    detected?: string[];
    needsConfirmation?: string[];
    notFound?: string[];
  };
  waterHeaterDetail?: {
    count?: number;
    type?: string | null;
    fuel?: string | null;
    location?: string | null;
    confidence?: number;
  } | null;
  gasApplianceScope?: {
    range?: boolean;
    waterHeater?: boolean;
    fireplace?: boolean;
    dryer?: boolean;
    grill?: boolean;
    gasPipingRequired?: boolean;
    confidence?: number;
  } | null;
  /** Selected candidate and retained alternatives from competing plan passes. */
  measurementProvenance?: Record<string, unknown>;
  /** Material conflicts that require contractor confirmation. */
  measurementConflicts?: PlanMeasurementConflict[];
  /** Electrical confidence-tier readiness and sheet coverage validation. */
  electricalValidation?: {
    sheetCoverage?: {
      expectedPages?: number[];
      coveredPages?: number[];
      missingPages?: number[];
      complete?: boolean;
    };
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
  /** Fields the AI read but withheld because confidence was too low. */
  lowConfidence: PlanLowConfidenceField[];
  /** Fields the AI saw on the plan but could not read (blurry/cut off). */
  unreadableFields: PlanUnreadableField[];
  itemQuantities: Record<
    string,
    { quantity: number; unit: string; quantitySource?: string }
  >;
  assumptions: string[];
  notesBlock: string;
  mergedNotes: string;
  /** Draft scope detections read from the plan sheets (confirm before applying). */
  scope: PlanScopeResult | null;
  /** Declared vs detected living/garage reconciliation (measurement-semantics). */
  areaReconciliation?:
    | import('@/utils/measurementSemantics').AreaReconciliation
    | null;
  estimatingMode?: import('@/utils/planImportTradeConfig').PlanEstimatingMode;
  selectedTrade?: import('@/utils/planImportTradeConfig').PlanTradeKey | null;
  tradeProvenance?: PlanImportPayload['tradeProvenance'];
  missingInfo?: string[];
};

/** Analyze floor plan / blueprint pages (images or PDF) → Quick Measurement fields + draft scope. */
export async function fetchPlanToMeasurements(params: {
  images: PhotoScopeImage[];
  existingNotes?: string;
  projectTypeHint?: string | null;
  templateKeyHint?: string | null;
  includeScope?: boolean;
  estimatingMode?: import('@/utils/planImportTradeConfig').PlanEstimatingMode;
  selectedTradeKey?:
    | import('@/utils/planImportTradeConfig').PlanTradeKey
    | null;
}): Promise<PlanToMeasurementsResult> {
  const takeoffRequest = resolvePaintingPlanTakeoffApiSelection({
    estimatingMode: params.estimatingMode,
    selectedTradeKey: params.selectedTradeKey,
  });
  const payload = await postAiAssistantJson<
    Partial<PlanToMeasurementsResult> & { error?: string; message?: string }
  >(
    '/plan-to-measurements',
    {
      images: params.images,
      existingNotes: params.existingNotes || '',
      projectTypeHint: params.projectTypeHint || null,
      templateKeyHint: params.templateKeyHint || null,
      mergeIntoNotes: true,
      includeScope: params.includeScope !== false,
      estimatingMode: takeoffRequest.estimatingMode,
      selectedTradeKey: takeoffRequest.selectedTradeKey,
    },
    180000
  );

  if (payload?.error && payload.success !== true && payload.success !== false) {
    throw new Error(payload.message || payload.error || 'Plan takeoff failed');
  }

  const result: PlanToMeasurementsResult = {
    success: payload.success !== false,
    reason: payload.reason ?? null,
    imageQuality: payload.imageQuality ?? null,
    rooms: Array.isArray(payload.rooms) ? payload.rooms : [],
    measurements:
      payload.measurements && typeof payload.measurements === 'object'
        ? (payload.measurements as Record<string, number>)
        : {},
    buildingAreas:
      payload.buildingAreas && typeof payload.buildingAreas === 'object'
        ? (payload.buildingAreas as PlanBuildingAreas)
        : undefined,
    planFacts:
      payload.planFacts && typeof payload.planFacts === 'object'
        ? (payload.planFacts as PlanFacts)
        : undefined,
    fieldConfidence:
      payload.fieldConfidence && typeof payload.fieldConfidence === 'object'
        ? (payload.fieldConfidence as Record<string, number>)
        : {},
    fieldEvidence:
      payload.fieldEvidence && typeof payload.fieldEvidence === 'object'
        ? (payload.fieldEvidence as PlanToMeasurementsResult['fieldEvidence'])
        : undefined,
    fixtureInventory:
      payload.fixtureInventory && typeof payload.fixtureInventory === 'object'
        ? (payload.fixtureInventory as Record<string, number>)
        : undefined,
    utilityConnections: Array.isArray(payload.utilityConnections)
      ? payload.utilityConnections
      : undefined,
    complexityFactors: Array.isArray(payload.complexityFactors)
      ? payload.complexityFactors
      : undefined,
    plumbingReviewStatus:
      payload.plumbingReviewStatus &&
      typeof payload.plumbingReviewStatus === 'object'
        ? payload.plumbingReviewStatus
        : undefined,
    measurementProvenance:
      payload.measurementProvenance &&
      typeof payload.measurementProvenance === 'object'
        ? (payload.measurementProvenance as Record<string, unknown>)
        : {},
    measurementConflicts: Array.isArray(payload.measurementConflicts)
      ? (payload.measurementConflicts as PlanMeasurementConflict[])
      : [],
    electricalValidation:
      payload.electricalValidation &&
      typeof payload.electricalValidation === 'object'
        ? (payload.electricalValidation as PlanToMeasurementsResult['electricalValidation'])
        : null,
    lowConfidence: Array.isArray(payload.lowConfidence)
      ? (payload.lowConfidence as PlanLowConfidenceField[])
      : [],
    unreadableFields: Array.isArray(payload.unreadableFields)
      ? (payload.unreadableFields as PlanUnreadableField[])
      : [],
    itemQuantities:
      payload.itemQuantities && typeof payload.itemQuantities === 'object'
        ? (payload.itemQuantities as PlanToMeasurementsResult['itemQuantities'])
        : {},
    assumptions: Array.isArray(payload.assumptions)
      ? payload.assumptions.map(String)
      : [],
    notesBlock: payload.notesBlock || '',
    mergedNotes: payload.mergedNotes || params.existingNotes || '',
    scope:
      payload.scope &&
      typeof payload.scope === 'object' &&
      Array.isArray((payload.scope as PlanScopeResult).detections)
        ? (payload.scope as PlanScopeResult)
        : null,
    areaReconciliation:
      payload.areaReconciliation &&
      typeof payload.areaReconciliation === 'object'
        ? (payload.areaReconciliation as PlanToMeasurementsResult['areaReconciliation'])
        : null,
    estimatingMode: payload.estimatingMode || 'whole_project',
    selectedTrade:
      (payload.selectedTrade as PlanToMeasurementsResult['selectedTrade']) ||
      null,
    tradeProvenance: payload.tradeProvenance || null,
    missingInfo: Array.isArray(payload.missingInfo)
      ? payload.missingInfo.map(String)
      : [],
  };

  return hydratePaintingPlanMeasurements({
    ...result,
    estimatingMode:
      params.estimatingMode || result.estimatingMode || 'whole_project',
    selectedTrade: params.selectedTradeKey || result.selectedTrade || null,
  });
}

const PHOTO_DETECTION_MIN_CONFIDENCE = 0.45;

/**
 * Plan/photo detections sometimes use sibling ids from another checklist
 * template (e.g. exterior_finishes vs exterior). Remap onto ids that exist
 * in the current Confirm Scope checklist before applying.
 */
const PLAN_SCOPE_ID_ALIASES: Record<string, string[]> = {
  exterior_finishes: ['exterior', 'exterior_finishes'],
  exterior: ['exterior', 'exterior_finishes'],
  roof_tie_in: ['roofing', 'roof_tie_in', 'shingles_roofing'],
  roofing: ['roofing', 'roof_tie_in', 'shingles_roofing'],
  framing_structure: ['framing', 'framing_structure', 'wall_framing'],
  framing: ['framing', 'framing_structure'],
  electrical_rough: ['mep_rough', 'electrical_rough', 'electrical'],
  plumbing_rough: ['mep_rough', 'plumbing_rough', 'plumbing'],
  hvac: ['mep_rough', 'hvac'],
  mep_rough: ['mep_rough', 'electrical_rough', 'plumbing_rough', 'hvac'],
  paint: ['paint_trim', 'paint', 'exterior_paint'],
  paint_trim: ['paint_trim', 'paint', 'interior_trim'],
  interior_trim: ['paint_trim', 'interior_trim'],
  flooring: ['tile_flooring', 'flooring'],
  tile: ['tile_flooring', 'tile', 'flooring'],
  tile_flooring: ['tile_flooring', 'flooring', 'tile'],
  site_prep: ['sitework', 'site_prep', 'excavation'],
  sitework: ['sitework', 'site_prep', 'excavation'],
  excavation: ['sitework', 'excavation'],
  grading: ['sitework', 'grading'],
  cabinets: ['cabinets_counters', 'cabinets'],
  countertops: ['cabinets_counters', 'countertops'],
  cabinets_counters: ['cabinets_counters', 'cabinets', 'countertops'],
  windows_doors: [
    'windows',
    'exterior_doors',
    'sliding_doors',
    'interior_doors',
    'exterior',
  ],
  windows: ['windows', 'exterior'],
  exterior_doors: ['exterior_doors', 'exterior'],
  sliding_doors: ['sliding_doors', 'exterior'],
  garage_doors: ['garage_doors', 'garage_door_openers', 'exterior'],
  concrete: ['foundation', 'concrete'],
  pour_foundation: ['foundation', 'pour_foundation'],
  pour_flatwork: ['pour_flatwork'],
  flatwork: ['pour_flatwork'],
  landscaping: ['landscaping'],
  landscape: ['landscaping'],
  plumbing_trim: ['plumbing_trim'],
  electrical_trim: ['electrical_trim'],
};

function remapDetectionItemId(
  itemId: string,
  allowedIds: Set<string>
): string | null {
  if (allowedIds.has(itemId)) return itemId;
  for (const alt of PLAN_SCOPE_ID_ALIASES[itemId] || []) {
    if (allowedIds.has(alt)) return alt;
  }
  return null;
}

export function applyPhotoExistingFeaturesToDraft(
  draft: EstimateAiDraft,
  features: PhotoExistingFeature[] | null | undefined
): EstimateAiDraft {
  if (!features?.length) return draft;
  const scopeMeasurements = applyExistingFeaturesToMeasurements(
    draft.scopeMeasurements || {},
    features
  );
  return { ...draft, scopeMeasurements };
}

/**
 * Apply structured vision detections directly onto the draft's Step 2 checklist,
 * so photo scope doesn't depend on notes-text regex re-parsing. Only fills items
 * the notes/AI left "unsure" — never overrides explicit states.
 */
export function applyPhotoDetectionsToDraft(
  draft: EstimateAiDraft,
  detections: PhotoScopeDetection[] | null | undefined
): EstimateAiDraft {
  const items = draft?.scopeChecklist?.items;
  if (!items?.length || !detections?.length) return draft;

  const { items: nextItems, appliedCount } =
    applyScopeDetectionsToChecklistItems(items, detections);
  if (!appliedCount) return draft;

  return {
    ...draft,
    scopeChecklist: { ...draft.scopeChecklist!, items: nextItems },
  };
}

/**
 * Apply plan/photo scope detections to a local checklist items array (Confirm
 * Scope modal state). Same rules as applyPhotoDetectionsToDraft: only fills
 * "unsure" items, never overrides explicit states. Remaps cross-template ids
 * so ground_up jobs receive exterior / mep_rough / paint_trim / etc.
 */
export function applyScopeDetectionsToChecklistItems(
  items: ScopeChecklistItem[],
  detections: PhotoScopeDetection[] | null | undefined
): {
  items: ScopeChecklistItem[];
  appliedCount: number;
  appliedLabels: string[];
} {
  if (!items?.length || !detections?.length) {
    return { items, appliedCount: 0, appliedLabels: [] };
  }

  const allowedIds = new Set(items.map(i => i.id));
  const byId = new Map<string, PhotoScopeDetection>();
  for (const d of detections) {
    if (!d?.itemId || (d.confidence ?? 0) < PHOTO_DETECTION_MIN_CONFIDENCE)
      continue;
    if (d.state !== 'included' && d.state !== 'excluded') continue;
    const mappedId = remapDetectionItemId(d.itemId, allowedIds);
    if (!mappedId || byId.has(mappedId)) continue;
    byId.set(mappedId, { ...d, itemId: mappedId });
  }
  if (!byId.size) return { items, appliedCount: 0, appliedLabels: [] };

  const appliedLabels: string[] = [];
  const nextItems = items.map(item => {
    const detection = byId.get(item.id);
    if (!detection) return item;

    if (item.inputType === 'choice') {
      if (item.choiceId && item.choiceId !== 'unsure') return item;
      const validChoice =
        detection.choiceId &&
        (item.options || []).some(o => o.id === detection.choiceId)
          ? detection.choiceId
          : null;
      if (!validChoice) return item;
      appliedLabels.push(item.label);
      return {
        ...item,
        choiceId: validChoice,
        state: 'included' as const,
        noteBacked: true,
      };
    }

    if (item.inputType === 'multi_choice') return item;

    if (item.state !== 'unsure') return item;
    appliedLabels.push(item.label);
    return { ...item, state: detection.state, noteBacked: true };
  });

  return {
    items: nextItems,
    appliedCount: appliedLabels.length,
    appliedLabels,
  };
}

export type PlanImportPayload = {
  measurements?: Record<string, number | string>;
  scopeDetections?: PhotoScopeDetection[];
  estimatingMode?: import('@/utils/planImportTradeConfig').PlanEstimatingMode;
  selectedTrade?: import('@/utils/planImportTradeConfig').PlanTradeKey | null;
  /** Stable client fingerprint for recognizing a repeat import of the same plan. */
  planImportFingerprint?: string | null;
  tradeProvenance?: {
    source: 'plan_import';
    mode: import('@/utils/planImportTradeConfig').PlanEstimatingMode;
    selectedTrade: import('@/utils/planImportTradeConfig').PlanTradeKey | null;
    routerStatus?: 'reference' | 'stub' | null;
  } | null;
  missingInfo?: string[];
  rooms?: PlanRoomMeasurement[];
  /** Read-only plan takeoff summary text (kept separate from editable Job notes). */
  notesBlock?: string | null;
  areaReconciliation?:
    | import('@/utils/measurementSemantics').AreaReconciliation
    | null;
  buildingAreas?: PlanBuildingAreas;
  planFacts?: PlanFacts;
  fieldConfidence?: Record<string, number>;
  fieldEvidence?: PlanToMeasurementsResult['fieldEvidence'];
  fixtureInventory?: Record<string, number>;
  utilityConnections?: PlanToMeasurementsResult['utilityConnections'];
  complexityFactors?: PlanToMeasurementsResult['complexityFactors'];
  plumbingReviewStatus?: PlanToMeasurementsResult['plumbingReviewStatus'];
  waterHeaterDetail?: PlanToMeasurementsResult['waterHeaterDetail'];
  gasApplianceScope?: PlanToMeasurementsResult['gasApplianceScope'];
  quickMeasurementSources?: Record<string, string>;
  measurementProvenance?: Record<string, unknown>;
  measurementConflicts?: PlanMeasurementConflict[];
  electricalValidation?: ScopeMeasurements['electricalValidation'];
  /** Standalone trade routing; absent for the existing whole-project flow. */
  tradeWorkflowSource?: 'standalone_trade' | null;
  plumbingWorkflowMode?: PlumbingWorkflowMode | null;
  plumbingPerformerMode?: PlumbingPerformerMode | null;
};

type LivePlanImportMeasurementMetadata = {
  quickMeasurementSources?: Record<string, string>;
  quickMeasurementFieldConfidence?: Record<string, number>;
  measurementProvenance?: Record<string, unknown>;
  plumbingUtilityConnections?: ScopeMeasurements['plumbingUtilityConnections'];
  plumbingFixtureInventory?: ScopeMeasurements['plumbingFixtureInventory'];
  plumbingComplexityFactors?: ScopeMeasurements['plumbingComplexityFactors'];
  plumbingReviewStatus?: ScopeMeasurements['plumbingReviewStatus'];
  plumbingWaterHeaterDetail?: ScopeMeasurements['plumbingWaterHeaterDetail'];
  plumbingGasApplianceScope?: ScopeMeasurements['plumbingGasApplianceScope'];
  measurementConflicts?: PlanMeasurementConflict[];
  electricalValidation?: ScopeMeasurements['electricalValidation'];
  planImportFingerprint?: PlanImportPayload['planImportFingerprint'];
  planImportMode?: PlanImportPayload['estimatingMode'];
  planImportTradeKey?: PlanImportPayload['selectedTrade'];
  planImportProvenance?: PlanImportPayload['tradeProvenance'];
  planImportMissingInfo?: string[];
};

function applyPlumbingEquipmentHydrationToMeasurements(
  target: Record<string, unknown>,
  payload: {
    fixtureInventory?: Record<string, number> | null;
    waterHeaterDetail?: PlanImportPayload['waterHeaterDetail'];
    gasApplianceScope?: PlanImportPayload['gasApplianceScope'];
    complexityFactors?: PlanImportPayload['complexityFactors'];
  },
  options?: { skipKeys?: Set<string>; storeAsNumber?: boolean }
): boolean {
  const hydrated = hydratePlumbingPlanMeasurementsFromInventory(
    target as Record<string, number | string>,
    payload.fixtureInventory ??
      (target.plumbingFixtureInventory as
        | Record<string, number>
        | null
        | undefined),
    {
      waterHeaterDetail:
        payload.waterHeaterDetail ?? target.plumbingWaterHeaterDetail ?? null,
      gasApplianceScope:
        payload.gasApplianceScope ?? target.plumbingGasApplianceScope ?? null,
      complexityFactors:
        payload.complexityFactors ??
        (target.plumbingComplexityFactors as
          | Array<{ key?: string | null; label?: string | null }>
          | null
          | undefined),
    }
  );
  let updated = false;
  for (const key of PLUMBING_PLAN_QUICK_MEASUREMENT_KEYS) {
    if (options?.skipKeys?.has(key)) continue;
    const value = hydrated[key];
    if (value == null || value === '') continue;
    const existing = Number(target[key]);
    const hydratedNum = Number(value);
    if (Number.isFinite(existing) && existing > 0) {
      if (
        key === 'gasApplianceConnectionCount' &&
        Number.isFinite(hydratedNum) &&
        hydratedNum > existing
      ) {
        target[key] =
          typeof target[key] === 'number' || options?.storeAsNumber
            ? hydratedNum
            : String(hydratedNum);
        updated = true;
      }
      continue;
    }
    const quantity = hydratedNum;
    target[key] =
      typeof target[key] === 'number' || options?.storeAsNumber
        ? quantity
        : String(value);
    updated = true;
  }
  return updated;
}

function rebuildFramingStructuredScopeFromMeasurements(
  target: Record<string, unknown>,
  quantitySource = 'plan_detected'
): boolean {
  const structured = buildFramingStructuredMeasurements(target, quantitySource);
  let updated = false;
  if (structured.framingScope?.length) {
    target.framingScope = [
      ...new Set([
        ...((target.framingScope as string[] | null | undefined) || []),
        ...structured.framingScope,
      ]),
    ];
    updated = true;
  }
  if (structured.itemQuantities) {
    target.itemQuantities = {
      ...((target.itemQuantities as
        | Record<string, unknown>
        | null
        | undefined) || {}),
      ...structured.itemQuantities,
    };
    updated = true;
  }
  return updated;
}

function rebuildPlumbingStructuredScopeFromMeasurements(
  target: Record<string, unknown>,
  quantitySource = 'plan_detected'
): boolean {
  const structured = buildPlumbingStructuredMeasurements(
    target,
    quantitySource
  );
  let updated = false;
  if (structured.plumbingScope?.length) {
    target.plumbingScope = [
      ...new Set([
        ...((target.plumbingScope as string[] | null | undefined) || []),
        ...structured.plumbingScope,
      ]),
    ];
    updated = true;
  }
  if (structured.itemQuantities) {
    target.itemQuantities = {
      ...((target.itemQuantities as
        | Record<string, unknown>
        | null
        | undefined) || {}),
      ...structured.itemQuantities,
    };
    updated = true;
  }
  return updated;
}

function plumbingPayloadReplacesTakeoff(payload: PlanImportPayload): boolean {
  return (
    payload.selectedTrade === 'plumbing' &&
    Object.keys(payload.measurements || {}).length > 0
  );
}

function plumbingDerivedQuantityStillSupported(
  key: string,
  target: Record<string, unknown>,
  hydratedFromIncoming: Record<string, number | string>
): boolean {
  if (Number(hydratedFromIncoming[key]) > 0) return true;
  if (
    key === 'waterHeaterCount' ||
    key === 'gasApplianceConnectionCount' ||
    key === 'plumbingFixturesHardwareCount'
  ) {
    return Number(target[key]) > 0;
  }
  return false;
}

function plumbingSamePlanDerivedKeySupported(
  key: string,
  previous: unknown,
  hydratedFromIncoming: Record<string, number | string>,
  samePlanImport: boolean
): boolean {
  const hydratedNum = Number(hydratedFromIncoming[key]);
  const previousNum = Number(previous);
  if (hydratedNum > 0) {
    if (previousNum > 0 && hydratedNum > previousNum) return false;
    return true;
  }
  if (
    samePlanImport &&
    (key === 'waterHeaterCount' ||
      key === 'gasApplianceConnectionCount' ||
      key === 'plumbingFixturesHardwareCount') &&
    previousNum > 0
  ) {
    return true;
  }
  return false;
}

function stripStalePlumbingInventoryDerivedFields(
  target: Record<string, unknown>,
  payload: PlanImportPayload
): boolean {
  const hydratedFromIncoming = hydratePlumbingPlanMeasurementsFromInventory(
    { ...(payload.measurements || {}) } as Record<string, number | string>,
    payload.fixtureInventory ??
      (target.plumbingFixtureInventory as
        | Record<string, number>
        | null
        | undefined),
    {
      waterHeaterDetail:
        payload.waterHeaterDetail ??
        (target.plumbingWaterHeaterDetail as PlanImportPayload['waterHeaterDetail']) ??
        null,
      gasApplianceScope:
        payload.gasApplianceScope ??
        (target.plumbingGasApplianceScope as PlanImportPayload['gasApplianceScope']) ??
        null,
      complexityFactors:
        payload.complexityFactors ??
        (target.plumbingComplexityFactors as PlanImportPayload['complexityFactors']) ??
        null,
    }
  );
  let updated = false;
  const itemQuantities = {
    ...((target.itemQuantities as
      | Record<string, { quantity?: unknown }>
      | null
      | undefined) || {}),
  };
  for (const key of PLUMBING_INVENTORY_DERIVED_KEYS) {
    if (
      plumbingDerivedQuantityStillSupported(key, target, hydratedFromIncoming)
    ) {
      continue;
    }
    if (target[key] == null || target[key] === '') continue;
    target[key] = '';
    updated = true;
    const card = PLUMBING_CARDS.find(entry => entry.measurementKey === key);
    if (card && itemQuantities[card.itemId]) {
      delete itemQuantities[card.itemId];
    }
  }
  if (updated) target.itemQuantities = itemQuantities;
  const pricingAcceptance = {
    ...((target.pricingAcceptance as
      | Record<string, unknown>
      | null
      | undefined) || {}),
  };
  let pricingChanged = false;
  for (const itemId of PLUMBING_INVENTORY_DERIVED_ITEM_IDS) {
    const card = PLUMBING_CARDS.find(entry => entry.itemId === itemId);
    if (
      card &&
      plumbingDerivedQuantityStillSupported(
        card.measurementKey,
        target,
        hydratedFromIncoming
      )
    ) {
      continue;
    }
    if (pricingAcceptance[itemId]) {
      delete pricingAcceptance[itemId];
      pricingChanged = true;
    }
  }
  if (pricingChanged) {
    target.pricingAcceptance = pricingAcceptance;
    updated = true;
  }
  const derivedIds = new Set<string>(PLUMBING_INVENTORY_DERIVED_ITEM_IDS);
  if (Array.isArray(target.plumbingScope)) {
    const nextScope = target.plumbingScope.filter(id => {
      if (!derivedIds.has(String(id))) return true;
      const card = PLUMBING_CARDS.find(entry => entry.itemId === id);
      return Boolean(
        card &&
          plumbingDerivedQuantityStillSupported(
            card.measurementKey,
            target,
            hydratedFromIncoming
          )
      );
    });
    if (nextScope.length !== target.plumbingScope.length) {
      target.plumbingScope = nextScope;
      updated = true;
    }
  }
  const fixtureInventory =
    payload.fixtureInventory ??
    (target.plumbingFixtureInventory as
      | Record<string, number>
      | null
      | undefined);
  if (
    !fixtureInventory ||
    !Object.values(fixtureInventory).some(value => Number(value) > 0)
  ) {
    if (target.plumbingFixtureInventory) {
      target.plumbingFixtureInventory = {};
      updated = true;
    }
  }
  return updated;
}

/**
 * Preserve reviewed plan metadata while Confirm Scope opens before the draft
 * persistence round-trip finishes. An explicit empty conflict list clears
 * stale draft conflicts after the contractor resolves them in plan review.
 */
export function mergeLivePlanImportIntoScopeMeasurements<T extends object>(
  measurements: T,
  payload: PlanImportPayload | null | undefined
): T {
  if (!payload) return measurements;
  const current = measurements as T &
    LivePlanImportMeasurementMetadata &
    Record<string, unknown>;
  let changed = false;
  const next: T & LivePlanImportMeasurementMetadata & Record<string, unknown> =
    { ...current };
  const samePlan =
    Boolean(current.planImportFingerprint) &&
    Boolean(payload.planImportFingerprint) &&
    current.planImportFingerprint === payload.planImportFingerprint;
  const previousPlan =
    Boolean(current.planImportFingerprint) &&
    Boolean(payload.planImportFingerprint) &&
    current.planImportFingerprint !== payload.planImportFingerprint;
  const confirmedFields = new Set(
    Object.entries(current.quickMeasurementSources || {})
      .filter(
        ([, source]) => source === 'contractor_confirmed_from_plan_review'
      )
      .map(([key]) => key)
  );
  const deselectedFields = new Set(
    Object.entries(payload.quickMeasurementSources || {})
      .filter(([, source]) => source === 'needs_confirmation')
      .map(([key]) => key)
  );

  for (const [key, value] of Object.entries(payload.measurements || {})) {
    if (value == null || value === '') continue;
    if (samePlan && confirmedFields.has(key)) continue;
    (next as Record<string, unknown>)[key] = String(value);
    changed = true;
  }

  if (
    payload.quickMeasurementSources &&
    Object.keys(payload.quickMeasurementSources).length
  ) {
    next.quickMeasurementSources = {
      ...(current.quickMeasurementSources || {}),
      ...payload.quickMeasurementSources,
    };
    if (samePlan) {
      for (const key of confirmedFields) {
        if (deselectedFields.has(key)) continue;
        next.quickMeasurementSources[key] =
          'contractor_confirmed_from_plan_review';
      }
    }
    changed = true;
  }
  if (payload.utilityConnections !== undefined) {
    next.plumbingUtilityConnections = payload.utilityConnections;
    changed = true;
  }
  if (payload.fixtureInventory !== undefined) {
    next.plumbingFixtureInventory = payload.fixtureInventory;
    changed = true;
  }
  if (payload.complexityFactors !== undefined) {
    next.plumbingComplexityFactors = payload.complexityFactors;
    changed = true;
  }
  if (payload.plumbingReviewStatus !== undefined) {
    next.plumbingReviewStatus = payload.plumbingReviewStatus;
    changed = true;
  }
  if (payload.waterHeaterDetail !== undefined) {
    next.plumbingWaterHeaterDetail = payload.waterHeaterDetail;
    changed = true;
  }
  if (payload.gasApplianceScope !== undefined) {
    next.plumbingGasApplianceScope = payload.gasApplianceScope;
    changed = true;
  }
  if (plumbingPayloadReplacesTakeoff(payload)) {
    if (stripStalePlumbingInventoryDerivedFields(next, payload)) {
      changed = true;
    }
  }
  if (
    payload.selectedTrade === 'plumbing' &&
    (payload.fixtureInventory !== undefined ||
      payload.waterHeaterDetail !== undefined ||
      payload.gasApplianceScope !== undefined)
  ) {
    if (
      applyPlumbingEquipmentHydrationToMeasurements(next, payload, {
        skipKeys: samePlan ? confirmedFields : undefined,
      })
    ) {
      changed = true;
    }
  }
  if (payload.fieldConfidence && Object.keys(payload.fieldConfidence).length) {
    next.quickMeasurementFieldConfidence = {
      ...(current.quickMeasurementFieldConfidence || {}),
      ...payload.fieldConfidence,
    };
    changed = true;
  }
  if (
    payload.measurementProvenance &&
    Object.keys(payload.measurementProvenance).length
  ) {
    next.measurementProvenance = {
      ...(current.measurementProvenance || {}),
      ...payload.measurementProvenance,
    };
    if (samePlan) {
      for (const key of confirmedFields) {
        if (deselectedFields.has(key)) continue;
        const previous = current.measurementProvenance?.[key];
        if (previous !== undefined) next.measurementProvenance[key] = previous;
      }
    }
    changed = true;
  }
  if (payload.measurementConflicts !== undefined) {
    next.measurementConflicts = payload.measurementConflicts.filter(
      conflict =>
        !samePlan ||
        !confirmedFields.has(String(conflict?.field || '')) ||
        deselectedFields.has(String(conflict?.field || ''))
    );
    changed = true;
  }
  if (payload.electricalValidation !== undefined) {
    next.electricalValidation = payload.electricalValidation;
    changed = true;
  }
  if (payload.estimatingMode !== undefined) {
    next.planImportMode = payload.estimatingMode;
    changed = true;
  }
  if (payload.selectedTrade !== undefined) {
    next.planImportTradeKey = payload.selectedTrade;
    changed = true;
  }
  if (payload.tradeProvenance !== undefined) {
    next.planImportProvenance = payload.tradeProvenance;
    changed = true;
  }
  if (payload.missingInfo !== undefined) {
    next.planImportMissingInfo = [...payload.missingInfo];
    changed = true;
  }
  if (payload.planImportFingerprint !== undefined) {
    next.planImportFingerprint = payload.planImportFingerprint;
    changed = true;
  }
  if (payload.planFacts || payload.buildingAreas) {
    next.planFacts = {
      ...(current.planFacts || {}),
      ...(payload.planFacts || {}),
      buildingAreas: {
        ...(current.planFacts?.buildingAreas || {}),
        ...(payload.buildingAreas || {}),
        ...(payload.planFacts?.buildingAreas || {}),
      },
    };
    changed = true;
    const planStory = Number(next.planFacts?.storyCount);
    if (
      Number.isFinite(planStory) &&
      planStory >= 1 &&
      !String(next.storyCount || '').trim()
    ) {
      next.storyCount = String(Math.min(3, Math.round(planStory)));
      next.quickMeasurementSources = {
        ...(next.quickMeasurementSources || {}),
        storyCount: 'plan_detected',
      };
      changed = true;
    }
    const planLiving = Number(next.planFacts?.buildingAreas?.totalLivingSqft);
    const mepSelectedTradeImport =
      next.planImportMode === 'selected_trade' &&
      (next.planImportTradeKey === 'plumbing' ||
        next.planImportTradeKey === 'electrical' ||
        payload.selectedTrade === 'plumbing' ||
        payload.selectedTrade === 'electrical');
    if (
      Number.isFinite(planLiving) &&
      planLiving > 0 &&
      !String(next.floorAreaSqft || '').trim() &&
      !mepSelectedTradeImport
    ) {
      next.floorAreaSqft = String(Math.round(planLiving));
      next.quickMeasurementSources = {
        ...(next.quickMeasurementSources || {}),
        floorAreaSqft: 'plan_detected',
      };
      changed = true;
    }
  }
  if (
    payload.selectedTrade === 'plumbing' ||
    payload.selectedTrade === 'electrical' ||
    payload.planFacts ||
    payload.buildingAreas
  ) {
    const hydrated = hydrateProjectComplexityMeasurements(
      next as Record<string, unknown>
    );
    if (hydrated !== next) {
      Object.assign(next, hydrated);
      changed = true;
    }
  }
  if (
    payload.selectedTrade === 'drywall' ||
    next.planImportTradeKey === 'drywall'
  ) {
    const planFacts = (next.planFacts || payload.planFacts || null) as Record<
      string,
      unknown
    > | null;
    const hydrated = hydrateDrywallComponentMeasurementsFromPlanContext(
      next as Record<string, unknown>,
      payload.rooms,
      planFacts
    );
    const reconciled = reconcileIncompleteDrywallGeometryTakeoff(hydrated, {
      planFacts,
    });
    const componentKeys = [
      ...DRYWALL_PLAN_QUICK_MEASUREMENT_KEYS,
      'drywallSqft',
    ] as const;
    for (const key of componentKeys) {
      const value = reconciled.measurements[key];
      if (value == null || value === '') continue;
      if (samePlan && confirmedFields.has(key)) continue;
      const nextValue = String(value);
      if ((next as Record<string, unknown>)[key] === nextValue) continue;
      (next as Record<string, unknown>)[key] = nextValue;
      changed = true;
    }
    const newlyHydrated = componentKeys.filter(
      key =>
        reconciled.measurements[key] != null &&
        !(current as Record<string, unknown>)[key] &&
        !(samePlan && confirmedFields.has(key))
    );
    const planningKeys = reconciled.planningEstimateKeys.filter(key =>
      newlyHydrated.includes(key as (typeof componentKeys)[number])
    );
    const detectedKeys = newlyHydrated.filter(
      key => !planningKeys.includes(key)
    );
    if (detectedKeys.length) {
      next.quickMeasurementSources = tagPlanDetectedQuickMeasurementKeys(
        next.quickMeasurementSources,
        detectedKeys
      );
      changed = true;
    }
    if (planningKeys.length) {
      next.quickMeasurementSources = {
        ...(next.quickMeasurementSources || {}),
        ...Object.fromEntries(
          planningKeys.map(key => [key, 'needs_confirmation' as const])
        ),
      };
      changed = true;
    }
  }
  if (previousPlan && confirmedFields.size) {
    const overrides = { ...(current.quickMeasurementUserOverrides || {}) };
    const sources = { ...(next.quickMeasurementSources || {}) };
    const provenance = { ...(next.measurementProvenance || {}) };
    const itemQuantities = { ...(next.itemQuantities || {}) };
    const staleItemIds = new Set<string>();

    for (const [itemId, entry] of Object.entries(itemQuantities)) {
      if (
        entry &&
        typeof entry === 'object' &&
        entry.quantitySource === 'contractor_confirmed_from_plan_review'
      ) {
        staleItemIds.add(itemId);
        delete itemQuantities[itemId];
      }
    }
    for (const key of confirmedFields) {
      if (
        !Object.prototype.hasOwnProperty.call(payload.measurements || {}, key)
      ) {
        delete (next as Record<string, unknown>)[key];
      }
      delete overrides[key];
      delete sources[key];
      delete provenance[key];
    }
    next.quickMeasurementUserOverrides = overrides;
    next.quickMeasurementSources = sources;
    next.measurementProvenance = provenance;
    next.itemQuantities = itemQuantities;
    if (Array.isArray(next.electricalScope) && staleItemIds.size) {
      next.electricalScope = next.electricalScope.filter(
        itemId => !staleItemIds.has(itemId)
      );
    }
    changed = true;
  }

  if (
    payload.selectedTrade === 'plumbing' ||
    payload.selectedTrade === 'electrical' ||
    payload.selectedTrade === 'drywall'
  ) {
    const normalizationInput =
      payload.selectedTrade === 'plumbing'
        ? {
            ...(next as Record<string, unknown>),
            ...(payload.measurements || {}),
            ...(next.quickMeasurementSources
              ? { quickMeasurementSources: next.quickMeasurementSources }
              : {}),
            ...(next.measurementProvenance
              ? { measurementProvenance: next.measurementProvenance }
              : {}),
            ...(next.measurementConflicts
              ? { measurementConflicts: next.measurementConflicts }
              : {}),
          }
        : {
            ...(payload.measurements || {}),
            ...(next.quickMeasurementSources
              ? { quickMeasurementSources: next.quickMeasurementSources }
              : {}),
            ...(next.measurementProvenance
              ? { measurementProvenance: next.measurementProvenance }
              : {}),
            ...(next.measurementConflicts
              ? { measurementConflicts: next.measurementConflicts }
              : {}),
          };
    const tradeNormalization = normalizeTradeMeasurements(
      payload.selectedTrade,
      normalizationInput,
      'plan'
    );
    const mergedScope = mergeTradeNormalizationIntoScopeMeasurements(
      next as ScopeMeasurements,
      tradeNormalization
    );
    if (mergedScope.plumbingScope) {
      next.plumbingScope = mergedScope.plumbingScope;
      changed = true;
    }
    if (mergedScope.electricalScope) {
      next.electricalScope = mergedScope.electricalScope;
      changed = true;
    }
    if (mergedScope.itemQuantities) {
      next.itemQuantities = mergedScope.itemQuantities;
      changed = true;
    }
    for (const [key, value] of Object.entries(
      tradeNormalization.measurements || {}
    )) {
      if (value == null || value === '') continue;
      if (samePlan && confirmedFields.has(key)) continue;
      (next as Record<string, unknown>)[key] = String(value);
      changed = true;
    }
    if (payload.selectedTrade === 'plumbing') {
      if (rebuildPlumbingStructuredScopeFromMeasurements(next)) {
        changed = true;
      }
    }
    if (payload.selectedTrade === 'framing') {
      const reconciled = reconcileFramingScopeMeasurements(next);
      Object.assign(next, reconciled);
      if (
        rebuildFramingStructuredScopeFromMeasurements(next, 'plan_detected')
      ) {
        changed = true;
      }
    }
  }

  return changed ? next : measurements;
}

/** Normalize vision room list for Quick measurements + field mapping. */
export function normalizePlanRooms(
  rooms:
    | Array<{
        name?: string;
        areaSqft?: number | null;
        lengthFt?: number | null;
        widthFt?: number | null;
        sourcePage?: number | null;
        sourceSheet?: string | null;
        sourceLabel?: string | null;
        sourceType?: PlanRoomMeasurement['sourceType'];
        confidence?: number | null;
      }>
    | null
    | undefined
): PlanRoomMeasurement[] {
  const out: PlanRoomMeasurement[] = [];
  for (const room of rooms || []) {
    const name = String(room?.name || '').trim();
    if (!name) continue;
    let areaSqft =
      room?.areaSqft != null &&
      Number.isFinite(Number(room.areaSqft)) &&
      Number(room.areaSqft) > 0
        ? Math.round(Number(room.areaSqft) * 10) / 10
        : null;
    const lengthFt =
      room?.lengthFt != null &&
      Number.isFinite(Number(room.lengthFt)) &&
      Number(room.lengthFt) > 0
        ? Number(room.lengthFt)
        : null;
    const widthFt =
      room?.widthFt != null &&
      Number.isFinite(Number(room.widthFt)) &&
      Number(room.widthFt) > 0
        ? Number(room.widthFt)
        : null;
    if (areaSqft == null && lengthFt != null && widthFt != null) {
      areaSqft = Math.round(lengthFt * widthFt * 10) / 10;
    }
    out.push({
      name,
      areaSqft,
      lengthFt,
      widthFt,
      sourcePage: room.sourcePage ?? null,
      sourceSheet: room.sourceSheet ?? null,
      sourceLabel: room.sourceLabel ?? null,
      sourceType: room.sourceType || 'plan_explicit',
      confidence:
        room.confidence != null && Number.isFinite(Number(room.confidence))
          ? Math.max(0, Math.min(1, Number(room.confidence)))
          : null,
    });
  }
  return out.slice(0, 48);
}

/** Fold named plan rooms into kitchen/bath/garage/deck quick fields when empty. */
export function applyPlanRoomsToScopeMeasurements(
  scopeMeasurements: ScopeMeasurements,
  rooms: PlanRoomMeasurement[]
): ScopeMeasurements {
  if (!rooms.length) return scopeMeasurements;
  const next: ScopeMeasurements = {
    ...scopeMeasurements,
    planRooms: rooms,
  };
  const detectedKeys: string[] = [];
  const sumMatching = (test: RegExp) => {
    let sum = 0;
    let hits = 0;
    for (const room of rooms) {
      if (!test.test(room.name) || !(Number(room.areaSqft) > 0)) continue;
      sum += Number(room.areaSqft);
      hits += 1;
    }
    return hits ? Math.round(sum * 10) / 10 : null;
  };

  if (!(Number(next.kitchenFloorSqft) > 0)) {
    const kitchen = sumMatching(/\bkitchen\b/i);
    if (kitchen) {
      next.kitchenFloorSqft = kitchen;
      detectedKeys.push('kitchenFloorSqft');
    }
  }
  if (!(Number(next.bathroomFloorSqft) > 0)) {
    const baths = sumBathFloorSqft(rooms);
    if (baths) {
      next.bathroomFloorSqft = baths;
      detectedKeys.push('bathroomFloorSqft');
    }
  }
  // Do not auto-fill bathCount from labeled rooms — tile/prefab/tub counts are
  // contractor choices and must not invent tile showers for every bath label.
  if (!(Number(next.garageSqft) > 0)) {
    const garage = sumMatching(/\bgarage\b/i);
    if (garage) {
      next.garageSqft = garage;
      detectedKeys.push('garageSqft');
    }
  }
  if (!(Number(next.deckSqft) > 0)) {
    const deck = sumMatching(/\b(deck|patio|porch)\b/i);
    if (deck) {
      next.deckSqft = deck;
      detectedKeys.push('deckSqft');
    }
  }
  if (detectedKeys.length) {
    next.quickMeasurementSources = tagPlanDetectedQuickMeasurementKeys(
      scopeMeasurements.quickMeasurementSources,
      detectedKeys
    );
  }
  return next;
}

/** Convert plan review string/number map into ScopeMeasurements numbers. */
export function planMeasurementsToScopeMeasurements(
  measurements: Record<string, number | string> | null | undefined
): ScopeMeasurements {
  const out: ScopeMeasurements = {};
  if (!measurements) return out;
  const detectedKeys: string[] = [];
  for (const [key, value] of Object.entries(measurements)) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) continue;
    (out as Record<string, number>)[key] = n;
    detectedKeys.push(key);
  }
  // Living SF from plans also drives flooring when the takeoff didn't send a separate field.
  const living = Number(out.floorAreaSqft);
  if (Number.isFinite(living) && living > 0) {
    if (!(Number(out.flooringSqft) > 0)) {
      out.flooringSqft = living;
      detectedKeys.push('flooringSqft');
    }
  }
  if (detectedKeys.length) {
    out.quickMeasurementSources = tagPlanDetectedQuickMeasurementKeys(
      undefined,
      detectedKeys
    );
  }
  const gross = Number(out.stuccoGrossWallSqft);
  const srcKeys = new Set(Object.keys(measurements || {}));
  const hasOpeningInputs =
    srcKeys.has('stuccoWindowDoorOpeningSqft') ||
    srcKeys.has('stuccoGarageOpeningSqft') ||
    srcKeys.has('stuccoOtherFinishDeductionSqft');
  const openings = Number(out.stuccoWindowDoorOpeningSqft) || 0;
  const totalDeductions =
    openings +
    (Number(out.stuccoGarageOpeningSqft) || 0) +
    (Number(out.stuccoOtherFinishDeductionSqft) || 0);
  if (gross > 0 && hasOpeningInputs && totalDeductions >= 0) {
    const net = Math.max(0, gross - totalDeductions);
    if (!(Number(out.stuccoNetWallSqft) > 0)) {
      out.stuccoNetWallSqft = net;
      detectedKeys.push('stuccoNetWallSqft');
    }
    if (!(Number(out.exteriorPaintSqft) > 0) && net > 0) {
      out.exteriorPaintSqft = net;
      detectedKeys.push('exteriorPaintSqft');
    }
  } else if (
    Number(out.stuccoNetWallSqft) > 0 &&
    !(Number(out.exteriorPaintSqft) > 0)
  ) {
    out.exteriorPaintSqft = Number(out.stuccoNetWallSqft);
    detectedKeys.push('exteriorPaintSqft');
  }
  if (detectedKeys.length) {
    out.quickMeasurementSources = tagPlanDetectedQuickMeasurementKeys(
      out.quickMeasurementSources,
      detectedKeys
    );
  }
  const livingForFraming = Number(out.floorAreaSqft);
  const garageForFraming = Number(out.garageSqft) || 0;
  if (!(Number(out.framedAreaSqft) > 0) && livingForFraming > 0) {
    out.framedAreaSqft = livingForFraming + Math.max(0, garageForFraming);
    out.quickMeasurementSources = tagPlanDetectedQuickMeasurementKeys(
      out.quickMeasurementSources,
      ['framedAreaSqft']
    );
  }
  return out;
}

/**
 * When plan takeoff has living SF, seed itemQuantities for included ground-up
 * (or addition) checklist items so Confirm Scope no longer shows "Needs sqft".
 *
 * When measurement-semantics is enabled, living SF is NOT copied into primary
 * takeoff for physical trades — it is stored as benchmark (+ optional pricing)
 * roles and physical quantities only when truly available.
 */
export function seedPlanFloorAreaItemQuantities(
  draft: EstimateAiDraft,
  scopeMeasurements: ScopeMeasurements
): ScopeMeasurements {
  const living = Number(scopeMeasurements.floorAreaSqft);
  if (!Number.isFinite(living) || living <= 0) return scopeMeasurements;

  const includedIds = new Set(
    (draft.scopeChecklist?.items || [])
      .filter(i => i.state === 'included')
      .map(i => i.id)
  );
  if (!includedIds.size) return scopeMeasurements;

  const FLOOR_AREA_ITEMS = [
    'sitework',
    'excavation',
    'foundation',
    'framing',
    'roofing',
    'exterior',
    'exterior_finishes',
    'stucco',
    'mep_rough',
    'insulation',
    'drywall',
    'cabinets',
    'countertops',
    'tile_flooring',
    'flooring',
    'floor_tile',
    'shower_tile',
    'shower_floor_tile',
    'hvac',
  ] as const;

  const semanticsOn = measurementSemanticsV1Enabled();
  const areaReconciliation = semanticsOn
    ? buildAreaReconciliation({
        declaredLivingSf: living,
        declaredGarageSf: scopeMeasurements.garageSqft,
        patioDeckSf: scopeMeasurements.deckSqft,
        rooms: scopeMeasurements.planRooms,
      })
    : (scopeMeasurements.areaReconciliation ?? null);

  const nextIq = { ...(scopeMeasurements.itemQuantities || {}) };
  for (const id of FLOOR_AREA_ITEMS) {
    if (!includedIds.has(id)) continue;
    const existing = nextIq[id];
    const hasExistingPrimary = Boolean(
      existing?.quantity && Number(existing.quantity) > 0
    );

    if (semanticsOn && NO_LIVING_SF_PRIMARY_SEED_KEYS.has(id)) {
      let primaryQuantity: number | null = null;
      let primaryUnit: MeasurementUnit | null = null;
      if (id === 'drywall' && Number(scopeMeasurements.drywallSqft) > 0) {
        primaryQuantity = Number(scopeMeasurements.drywallSqft);
        primaryUnit = 'surface_sqft';
      } else if (
        id === 'roofing' &&
        Number(scopeMeasurements.roofSquares) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.roofSquares);
        primaryUnit = 'roof_square';
      } else if (
        id === 'stucco' &&
        Number(scopeMeasurements.exteriorPaintSqft) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.exteriorPaintSqft);
        primaryUnit = 'surface_sqft';
      } else if (
        id === 'foundation' &&
        Number(scopeMeasurements.concreteCy) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.concreteCy);
        primaryUnit = 'cy';
      } else if (
        id === 'pour_flatwork' &&
        Number(scopeMeasurements.concreteSqft) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.concreteSqft);
        primaryUnit = 'sqft';
      } else if (
        id === 'excavation' &&
        Number(scopeMeasurements.excavationCy) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.excavationCy);
        primaryUnit = 'cy';
      } else if (id === 'cabinets' && Number(scopeMeasurements.cabinetLf) > 0) {
        primaryQuantity = Number(scopeMeasurements.cabinetLf);
        primaryUnit = 'lf';
      } else if (
        id === 'countertops' &&
        Number(scopeMeasurements.countertopSqft) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.countertopSqft);
        primaryUnit = 'sqft';
      } else if (
        id === 'shower_tile' &&
        Number(scopeMeasurements.showerWallTileSqft) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.showerWallTileSqft);
        primaryUnit = 'sqft';
      } else if (
        id === 'shower_floor_tile' &&
        Number(scopeMeasurements.showerFloorTileSqft) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.showerFloorTileSqft);
        primaryUnit = 'sqft';
      } else if (
        id === 'floor_tile' &&
        Number(scopeMeasurements.bathroomFloorSqft) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.bathroomFloorSqft);
        primaryUnit = 'floor_sqft';
      } else if (
        (id === 'tile_flooring' || id === 'flooring') &&
        Number(scopeMeasurements.flooringSqft) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.flooringSqft);
        primaryUnit = 'floor_sqft';
      } else if (hasExistingPrimary && String(existing.unit || '') !== 'sqft') {
        // Preserve non-living physical quantities already present.
        primaryQuantity = Number(existing.quantity);
        primaryUnit = String(
          existing.unit || preferredPrimaryUnit(id)
        ) as MeasurementUnit;
      } else if (
        hasExistingPrimary &&
        existing?.quantitySource === 'user_entered'
      ) {
        primaryQuantity = Number(existing.quantity);
        primaryUnit = String(existing.unit || 'unknown') as MeasurementUnit;
      }

      const measurementState = buildSemanticsStateForScope({
        scopeKey: id,
        livingSf: living,
        primaryQuantity,
        primaryUnit,
        drywallSf: scopeMeasurements.drywallSqft,
        roofSquares: scopeMeasurements.roofSquares,
        flooringSf: scopeMeasurements.flooringSqft,
        concreteCy: scopeMeasurements.concreteCy,
        excavationCy: scopeMeasurements.excavationCy,
        cabinetLf: scopeMeasurements.cabinetLf,
        countertopSqft: scopeMeasurements.countertopSqft,
        showerWallTileSqft: scopeMeasurements.showerWallTileSqft,
        showerFloorTileSqft: scopeMeasurements.showerFloorTileSqft,
        bathroomFloorSqft: scopeMeasurements.bathroomFloorSqft,
        primarySourceType: 'plan_explicit',
        primarySourceLabel:
          primaryQuantity != null ? 'Detected from plan' : 'Needs takeoff',
      });

      // Do not seed living SF into legacy quantity for these scopes.
      if (primaryQuantity != null && primaryQuantity > 0) {
        nextIq[id] = {
          quantity: primaryQuantity,
          unit: primaryUnit || preferredPrimaryUnit(id),
          quantitySource: existing?.quantitySource || 'plan_vision',
          measurementState,
          includesCountertops: existing?.includesCountertops,
        };
      } else {
        nextIq[id] = {
          quantity: null,
          unit: preferredPrimaryUnit(id),
          quantitySource: 'missing',
          measurementState,
          includesCountertops: existing?.includesCountertops,
        };
      }
      continue;
    }

    if (hasExistingPrimary) continue;

    let qty = living;
    let unit = 'sqft';
    if (id === 'tile_flooring' || id === 'flooring') {
      qty =
        Number(scopeMeasurements.flooringSqft) > 0
          ? Number(scopeMeasurements.flooringSqft)
          : living;
    } else if (id === 'drywall' && Number(scopeMeasurements.drywallSqft) > 0) {
      qty = Number(scopeMeasurements.drywallSqft);
    } else if (id === 'roofing' && Number(scopeMeasurements.roofSquares) > 0) {
      qty = Number(scopeMeasurements.roofSquares);
      unit = 'squares';
    } else if (
      id === 'foundation' &&
      Number(scopeMeasurements.concreteCy) > 0
    ) {
      qty = Number(scopeMeasurements.concreteCy);
      unit = 'cy';
    } else if (
      id === 'excavation' &&
      Number(scopeMeasurements.excavationCy) > 0
    ) {
      qty = Number(scopeMeasurements.excavationCy);
      unit = 'cy';
    } else if (id === 'cabinets' && Number(scopeMeasurements.cabinetLf) > 0) {
      qty = Number(scopeMeasurements.cabinetLf);
      unit = 'lf';
    } else if (
      id === 'countertops' &&
      Number(scopeMeasurements.countertopSqft) > 0
    ) {
      qty = Number(scopeMeasurements.countertopSqft);
    } else if (
      id === 'shower_tile' &&
      Number(scopeMeasurements.showerWallTileSqft) > 0
    ) {
      qty = Number(scopeMeasurements.showerWallTileSqft);
    } else if (
      id === 'shower_floor_tile' &&
      Number(scopeMeasurements.showerFloorTileSqft) > 0
    ) {
      qty = Number(scopeMeasurements.showerFloorTileSqft);
    } else if (
      id === 'floor_tile' &&
      Number(scopeMeasurements.bathroomFloorSqft) > 0
    ) {
      qty = Number(scopeMeasurements.bathroomFloorSqft);
    } else if (
      id === 'excavation' ||
      id === 'foundation' ||
      id === 'cabinets' ||
      id === 'countertops' ||
      id === 'stucco' ||
      id === 'shower_tile' ||
      id === 'shower_floor_tile' ||
      id === 'floor_tile'
    ) {
      // No physical takeoff yet — do not seed living SF.
      continue;
    }
    nextIq[id] = {
      quantity: qty,
      unit,
      quantitySource: 'plan_vision',
    };
  }

  return {
    ...scopeMeasurements,
    itemQuantities: nextIq,
    areaReconciliation: areaReconciliation ?? undefined,
  };
}

/** Whether Step 3 should prefetch clarifying questions without waiting for a tap. */
export function shouldAutoClarifyDraft(
  draft: EstimateAiDraft | null | undefined
): boolean {
  if (!draft) return false;
  if (draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length) {
    return false;
  }
  if (draft.noPricingDetected) return true;
  if (draft.estimateConfidence?.level === 'low') return true;
  const packages = draft.scopePackages || draft.rooms || [];
  const unpriced = packages.some(p => {
    const price =
      Number(p.price ?? p.knownSubtotal ?? p.calculatedSubtotal ?? 0) || 0;
    return price <= 0;
  });
  if (unpriced) return true;
  if ((draft.missingInfo || []).length >= 2) return true;
  return false;
}

export function isComplexEstimateTier(
  draft: EstimateAiDraft | null | undefined
): boolean {
  return Boolean(draft?.estimateTier && draft.estimateTier !== 'simple_unit');
}

export function aiFlowStepTotal(
  draft: EstimateAiDraft | null | undefined
): 2 | 3 {
  return isComplexEstimateTier(draft) ? 3 : 2;
}

function overlayScopeMeasurements(
  draft: EstimateAiDraft,
  scopeMeasurements?: ScopeMeasurements | null
): EstimateAiDraft {
  if (!scopeMeasurements) return draft;
  return {
    ...draft,
    scopeMeasurements: {
      ...(draft.scopeMeasurements || {}),
      ...scopeMeasurements,
      planRooms: scopeMeasurements.planRooms?.length
        ? scopeMeasurements.planRooms
        : draft.scopeMeasurements?.planRooms,
      planFacts: scopeMeasurements.planFacts
        ? {
            ...(draft.scopeMeasurements?.planFacts || {}),
            ...scopeMeasurements.planFacts,
            buildingAreas: {
              ...(draft.scopeMeasurements?.planFacts?.buildingAreas || {}),
              ...(scopeMeasurements.planFacts.buildingAreas || {}),
            },
            fieldEvidence: {
              ...(draft.scopeMeasurements?.planFacts?.fieldEvidence || {}),
              ...(scopeMeasurements.planFacts.fieldEvidence || {}),
            },
          }
        : draft.scopeMeasurements?.planFacts,
      itemQuantities: {
        ...(draft.scopeMeasurements?.itemQuantities || {}),
        ...(scopeMeasurements.itemQuantities || {}),
      },
      quickMeasurementSources: {
        ...(draft.scopeMeasurements?.quickMeasurementSources || {}),
        ...(scopeMeasurements.quickMeasurementSources || {}),
      },
      quickMeasurementUserOverrides: {
        ...(draft.scopeMeasurements?.quickMeasurementUserOverrides || {}),
        ...(scopeMeasurements.quickMeasurementUserOverrides || {}),
      },
      quickMeasurementSuggestionMetadata: {
        ...(draft.scopeMeasurements?.quickMeasurementSuggestionMetadata || {}),
        ...(scopeMeasurements.quickMeasurementSuggestionMetadata || {}),
      },
      quickMeasurementFieldConfidence: {
        ...(draft.scopeMeasurements?.quickMeasurementFieldConfidence || {}),
        ...(scopeMeasurements.quickMeasurementFieldConfidence || {}),
      },
      measurementProvenance:
        scopeMeasurements.measurementProvenance ||
        draft.scopeMeasurements?.measurementProvenance,
      measurementConflicts:
        scopeMeasurements.measurementConflicts ||
        draft.scopeMeasurements?.measurementConflicts,
      pricingAcceptance: {
        ...(draft.scopeMeasurements?.pricingAcceptance || {}),
        ...(scopeMeasurements.pricingAcceptance || {}),
      },
    },
  };
}

/**
 * Rebuild a Step 1 plan-import payload from a draft that already received plan
 * takeoff — used when regenerating after Back wiped the builder's local state.
 */
export function planImportPayloadFromDraft(
  draft: EstimateAiDraft | null | undefined
): PlanImportPayload | null {
  const sm = draft?.scopeMeasurements;
  if (!sm) return null;
  const sourceMap = sm.quickMeasurementSources || {};
  const hasPlanMeasurementSource = Object.values(sourceMap).some(
    source =>
      source === 'detected_from_plan' ||
      source === 'plan_detected' ||
      source === 'plan_verified' ||
      source === 'ai_verified' ||
      source === 'contractor_confirmed_from_plan_review' ||
      source === 'needs_confirmation' ||
      source === 'measured_from_geometry' ||
      source === 'calculated_from_components' ||
      source === 'estimated_from_formula' ||
      source === 'fallback_multiplier'
  );
  const hasPlanFacts =
    Boolean(
      sm.planFacts?.fieldEvidence &&
        Object.keys(sm.planFacts.fieldEvidence).length
    ) ||
    Boolean(sm.planFacts?.geometry && sm.planFacts.geometry.length) ||
    Boolean(
      sm.planFacts?.buildingAreas &&
        Object.keys(sm.planFacts.buildingAreas).length
    );
  // Notes-derived measurements and parsed rooms are not a plan import. Only
  // restore the Step 1 plan card when the draft contains takeoff provenance.
  if (!hasPlanMeasurementSource && !hasPlanFacts) return null;
  const measurements: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(sm)) {
    if (
      key === 'itemQuantities' ||
      key === 'pricingAcceptance' ||
      key === 'planFacts' ||
      key === 'planRooms' ||
      key === 'quickMeasurementSources' ||
      key === 'quickMeasurementSuggestionMetadata' ||
      key === 'quickMeasurementFieldConfidence' ||
      key === 'areaReconciliation' ||
      key === 'wetAreaFinish' ||
      key === 'planImportMode' ||
      key === 'planImportTradeKey' ||
      key === 'planImportProvenance' ||
      key === 'planImportMissingInfo' ||
      typeof value === 'object'
    ) {
      continue;
    }
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) measurements[key] = n;
  }
  const rooms = sm.planRooms?.length ? sm.planRooms : [];
  const planFacts = sm.planFacts || undefined;
  const buildingAreas = planFacts?.buildingAreas;
  const hasMeasurements = Object.keys(measurements).length > 0;
  const hasRooms = (rooms?.length || 0) > 0;
  const hasFacts = Boolean(planFacts || buildingAreas);
  if (!hasMeasurements && !hasRooms && !hasFacts) return null;
  return {
    measurements: hasMeasurements ? measurements : undefined,
    rooms: hasRooms ? rooms : undefined,
    planFacts,
    buildingAreas,
    areaReconciliation: sm.areaReconciliation ?? null,
    fieldConfidence: sm.quickMeasurementFieldConfidence,
    quickMeasurementSources: sm.quickMeasurementSources,
    measurementProvenance: sm.measurementProvenance,
    utilityConnections: sm.plumbingUtilityConnections,
    fixtureInventory: sm.plumbingFixtureInventory,
    complexityFactors: sm.plumbingComplexityFactors,
    plumbingReviewStatus: sm.plumbingReviewStatus,
    measurementConflicts: sm.measurementConflicts,
    electricalValidation: sm.electricalValidation,
    planImportFingerprint: sm.planImportFingerprint,
    estimatingMode: sm.planImportMode,
    selectedTrade: sm.planImportTradeKey,
    tradeProvenance: sm.planImportProvenance,
    missingInfo: sm.planImportMissingInfo,
  };
}

/**
 * Apply Step 1 plan import onto a freshly generated draft: seed Quick
 * measurements and fill unsure checklist items from plan scope detections.
 */
export function mergeTradeNormalizationIntoScopeMeasurements(
  scopeMeasurements: ScopeMeasurements,
  normalization: NormalizedTradeMeasurements | null | undefined
): ScopeMeasurements {
  if (!normalization) return scopeMeasurements;
  const next: ScopeMeasurements = { ...scopeMeasurements };
  for (const [key, value] of Object.entries(normalization.measurements)) {
    if (value === undefined || value === null) continue;
    (next as Record<string, unknown>)[key] =
      typeof value === 'number' ? value : String(value);
  }
  const structured = normalization.structuredMeasurements || {};
  if (structured.concreteAreaByType) {
    next.concreteAreaByType =
      structured.concreteAreaByType as ScopeMeasurements['concreteAreaByType'];
  }
  if (structured.concreteThicknessByType) {
    next.concreteThicknessByType =
      structured.concreteThicknessByType as ScopeMeasurements['concreteThicknessByType'];
  }
  if (
    Array.isArray(structured.concreteScope) &&
    structured.concreteScope.length
  ) {
    next.concreteScope = structured.concreteScope.map(String);
  }
  if (
    Array.isArray(structured.flooringProductScope) &&
    structured.flooringProductScope.length
  ) {
    next.flooringProductScope =
      structured.flooringProductScope as ScopeMeasurements['flooringProductScope'];
  }
  if (
    Array.isArray(structured.flooringExistingTypes) &&
    structured.flooringExistingTypes.length
  ) {
    next.flooringExistingTypes =
      structured.flooringExistingTypes as ScopeMeasurements['flooringExistingTypes'];
  }
  if (structured.flooringInstallScopeCount != null) {
    next.flooringInstallScopeCount = Number(
      structured.flooringInstallScopeCount
    );
  }
  if (structured.flooringDemoScopeCount != null) {
    next.flooringDemoScopeCount = Number(structured.flooringDemoScopeCount);
  }
  if (
    structured.itemQuantities &&
    typeof structured.itemQuantities === 'object' &&
    !Array.isArray(structured.itemQuantities)
  ) {
    next.itemQuantities = {
      ...(next.itemQuantities || {}),
      ...(structured.itemQuantities as ScopeMeasurements['itemQuantities']),
    };
  }
  if (
    structured.floorPrepByProduct &&
    typeof structured.floorPrepByProduct === 'object' &&
    !Array.isArray(structured.floorPrepByProduct)
  ) {
    next.floorPrepByProduct =
      structured.floorPrepByProduct as ScopeMeasurements['floorPrepByProduct'];
  }
  if (Array.isArray(structured.paintScope) && structured.paintScope.length) {
    next.paintScope = structured.paintScope as ScopeMeasurements['paintScope'];
  }
  if (
    structured.paintPricingMethod === 'combined' ||
    structured.paintPricingMethod === 'separate'
  ) {
    next.paintPricingMethod = structured.paintPricingMethod;
  }
  if (
    structured.paintOccupancy === 'occupied' ||
    structured.paintOccupancy === 'vacant' ||
    structured.paintOccupancy === 'new_construction'
  ) {
    next.paintOccupancy = structured.paintOccupancy;
  }
  if (
    structured.paintApplicationMethod === 'brush_roll' ||
    structured.paintApplicationMethod === 'spray' ||
    structured.paintApplicationMethod === 'mixed'
  ) {
    next.paintApplicationMethod = structured.paintApplicationMethod;
  }
  if (typeof structured.paintOccupancyConfirmed === 'boolean') {
    next.paintOccupancyConfirmed = structured.paintOccupancyConfirmed;
  }
  if (typeof structured.paintApplicationMethodConfirmed === 'boolean') {
    next.paintApplicationMethodConfirmed =
      structured.paintApplicationMethodConfirmed;
  }
  if (typeof structured.paintAreaNeedsConfirmation === 'boolean') {
    next.paintAreaNeedsConfirmation = structured.paintAreaNeedsConfirmation;
  }
  if (
    Array.isArray(structured.electricalScope) &&
    structured.electricalScope.length
  ) {
    next.electricalScope = structured.electricalScope.map(String);
  }
  if (
    Array.isArray(structured.plumbingScope) &&
    structured.plumbingScope.length
  ) {
    next.plumbingScope = structured.plumbingScope.map(String);
  }
  if (
    Array.isArray(structured.framingScope) &&
    structured.framingScope.length
  ) {
    next.framingScope = structured.framingScope.map(String);
  }
  if (
    structured.electricalProjectCondition === 'new_construction' ||
    structured.electricalProjectCondition === 'remodel_open_wall' ||
    structured.electricalProjectCondition === 'finished_wall_service'
  ) {
    next.electricalProjectCondition = structured.electricalProjectCondition;
  }
  if (typeof structured.electricalIncludeRough === 'boolean') {
    next.electricalIncludeRough = structured.electricalIncludeRough;
  }
  if (typeof structured.electricalIncludeTrim === 'boolean') {
    next.electricalIncludeTrim = structured.electricalIncludeTrim;
  }
  if (typeof structured.electricalConduit === 'boolean') {
    next.electricalConduit = structured.electricalConduit;
  }
  if (typeof structured.electricalTrenching === 'boolean') {
    next.electricalTrenching = structured.electricalTrenching;
  }
  if (typeof structured.electricalConduitSpecialty === 'boolean') {
    next.electricalConduitSpecialty = structured.electricalConduitSpecialty;
  }
  if (
    structured.electricalTrenchCondition === 'normal_soil' ||
    structured.electricalTrenchCondition === 'rocky'
  ) {
    next.electricalTrenchCondition = structured.electricalTrenchCondition;
  }
  if (
    typeof structured.existingServiceAmperage === 'number' &&
    Number.isFinite(structured.existingServiceAmperage) &&
    structured.existingServiceAmperage > 0
  ) {
    next.existingServiceAmperage = structured.existingServiceAmperage;
  }
  if (
    structured.electricalPanelLocation === 'indoor' ||
    structured.electricalPanelLocation === 'outdoor'
  ) {
    next.electricalPanelLocation = structured.electricalPanelLocation;
  }
  if (typeof structured.electricalMeterMainCombo === 'boolean') {
    next.electricalMeterMainCombo = structured.electricalMeterMainCombo;
  }
  if (
    structured.paintAreaBasis === 'walls' ||
    structured.paintAreaBasis === 'ceilings' ||
    structured.paintAreaBasis === 'combined' ||
    structured.paintAreaBasis === 'floor_area' ||
    structured.paintAreaBasis === 'unknown'
  ) {
    next.paintAreaBasis = structured.paintAreaBasis;
  }
  if (normalization.quickMeasurementSources) {
    next.quickMeasurementSources = {
      ...next.quickMeasurementSources,
      ...normalization.quickMeasurementSources,
    } as ScopeMeasurements['quickMeasurementSources'];
  }
  if (normalization.measurementProvenance) {
    next.measurementProvenance = {
      ...next.measurementProvenance,
      ...normalization.measurementProvenance,
    };
  }
  return next;
}

function normalizeImportedTradeMeasurements(
  tradeKey: PlanTradeKey | null,
  measurements: Record<string, number | string>,
  extras: Record<string, unknown> = {},
  source: 'plan' | 'notes' = 'plan'
): NormalizedTradeMeasurements | null {
  if (
    tradeKey !== 'roofing' &&
    tradeKey !== 'concrete' &&
    tradeKey !== 'flooring' &&
    tradeKey !== 'painting' &&
    tradeKey !== 'electrical' &&
    tradeKey !== 'plumbing' &&
    tradeKey !== 'framing' &&
    tradeKey !== 'drywall' &&
    tradeKey !== 'windows_doors' &&
    tradeKey !== 'garage_doors' &&
    tradeKey !== 'hvac'
  )
    return null;
  return normalizeTradeMeasurements(
    tradeKey,
    {
      ...measurements,
      ...extras,
    },
    source
  );
}

function normalizeTradePlanMeasurements(
  measurements: Record<string, number | string>,
  tradeKey: PlanTradeKey | null
): Record<string, number | string> {
  if (tradeKey === 'plumbing') {
    return normalizePlumbingPlanMeasurements(measurements) as Record<
      string,
      number | string
    >;
  }
  if (tradeKey === 'framing') {
    return normalizeFramingPlanMeasurements(measurements) as Record<
      string,
      number | string
    >;
  }
  if (tradeKey === 'drywall') {
    return normalizeDrywallPlanMeasurements(measurements) as Record<
      string,
      number | string
    >;
  }
  if (tradeKey === 'windows_doors') {
    return normalizeWindowsDoorsPlanMeasurements(measurements) as Record<
      string,
      number | string
    >;
  }
  if (tradeKey === 'garage_doors') {
    return normalizeGarageDoorsPlanMeasurements(measurements) as Record<
      string,
      number | string
    >;
  }
  if (tradeKey === 'hvac') {
    return normalizeHvacPlanMeasurements(measurements);
  }
  if (tradeKey !== 'stucco') return measurements;
  const out = { ...measurements };
  const gross = Number(out.stuccoGrossWallSqft);
  const deductions =
    (Number(out.stuccoWindowDoorOpeningSqft) || 0) +
    (Number(out.stuccoGarageOpeningSqft) || 0) +
    (Number(out.stuccoOtherFinishDeductionSqft) || 0);
  if (gross > 0) {
    out.stuccoNetWallSqft = Math.max(0, gross - deductions);
  }
  const netWall =
    Number(out.stuccoNetWallSqft) ||
    Number(out.stuccoSqft) ||
    Number(out.exteriorWallSqft) ||
    Number(out.exteriorFinishSqft) ||
    Number(out.exteriorFinishesSqft);
  if (netWall > 0 && !(Number(out.exteriorPaintSqft) > 0)) {
    out.exteriorPaintSqft = netWall;
  }
  return out;
}

const WHOLE_PROJECT_QUICK_MEASUREMENT_KEYS = [
  'floorAreaSqft',
  'flooringSqft',
  'garageSqft',
  'deckSqft',
  'kitchenFloorSqft',
  'bathroomFloorSqft',
  'concreteSqft',
  'concreteDemoSqft',
  'concreteCy',
  'excavationCy',
  'roofSquares',
  'wallPaintSqft',
  'ceilingPaintSqft',
  'paintAreaSqft',
  'combinedPaintableAreaSqft',
  'baseboardLf',
  'interiorDoorCount',
  'cabinetRunLf',
] as const;

function stripWholeProjectScopeMeasurements(
  scopeMeasurements: ScopeMeasurements | null | undefined
): ScopeMeasurements {
  const tradeKey = scopeMeasurements?.planImportTradeKey;
  const preserveMepComplexity =
    tradeKey === 'electrical' || tradeKey === 'plumbing';
  const preserveInsulationPlanFacts = tradeKey === 'insulation';
  const complexitySnapshot = preserveMepComplexity
    ? {
        planFacts: scopeMeasurements?.planFacts,
        floorAreaSqft: scopeMeasurements?.floorAreaSqft,
        storyCount: scopeMeasurements?.storyCount,
        projectComplexity: scopeMeasurements?.projectComplexity,
        floorAreaSource:
          scopeMeasurements?.quickMeasurementSources?.floorAreaSqft,
        storySource: scopeMeasurements?.quickMeasurementSources?.storyCount,
      }
    : preserveInsulationPlanFacts
      ? {
          planFacts: scopeMeasurements?.planFacts,
          floorAreaSqft: scopeMeasurements?.floorAreaSqft,
          storyCount: scopeMeasurements?.storyCount,
          floorAreaSource:
            scopeMeasurements?.quickMeasurementSources?.floorAreaSqft,
          storySource: scopeMeasurements?.quickMeasurementSources?.storyCount,
        }
      : null;
  const next: ScopeMeasurements = { ...(scopeMeasurements || {}) };
  for (const key of WHOLE_PROJECT_QUICK_MEASUREMENT_KEYS) {
    delete (next as Record<string, unknown>)[key];
  }
  delete next.planRooms;
  delete next.planFacts;
  delete next.areaReconciliation;
  if (next.itemQuantities) {
    const tradeKey = next.planImportTradeKey as PlanTradeKey | null | undefined;
    const allowedIds = getTradeScopeAllowlist(tradeKey);
    if (allowedIds?.length) {
      next.itemQuantities = Object.fromEntries(
        Object.entries(next.itemQuantities).filter(([id]) =>
          allowedIds.some(
            allowed => id === allowed || id.startsWith(`${allowed}__`)
          )
        )
      );
    } else {
      const allowed = new Set(['stucco', 'electrical_rough']);
      next.itemQuantities = Object.fromEntries(
        Object.entries(next.itemQuantities).filter(([id]) => allowed.has(id))
      );
    }
  }
  if (complexitySnapshot) {
    if (complexitySnapshot.planFacts)
      next.planFacts = complexitySnapshot.planFacts;
    if (complexitySnapshot.floorAreaSqft) {
      next.floorAreaSqft = complexitySnapshot.floorAreaSqft;
    }
    if (complexitySnapshot.storyCount)
      next.storyCount = complexitySnapshot.storyCount;
    if (complexitySnapshot.projectComplexity) {
      next.projectComplexity = complexitySnapshot.projectComplexity;
    }
    if (complexitySnapshot.floorAreaSource || complexitySnapshot.storySource) {
      next.quickMeasurementSources = {
        ...(next.quickMeasurementSources || {}),
        ...(complexitySnapshot.floorAreaSource
          ? { floorAreaSqft: complexitySnapshot.floorAreaSource }
          : {}),
        ...(complexitySnapshot.storySource
          ? { storyCount: complexitySnapshot.storySource }
          : {}),
      };
    }
  }
  return next;
}

export function buildStuccoTradeChecklistItems(
  existing: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  const byId = new Map(existing.map(item => [item.id, item]));
  const yesNo = (
    id: string,
    label: string,
    helperText: string,
    category = 'stucco'
  ): ScopeChecklistItem => ({
    ...(byId.get(id) || {}),
    id,
    label,
    helperText,
    category,
    inputType: 'yes_no',
    state: byId.get(id)?.state || 'unsure',
  });
  const choice = (
    id: string,
    label: string,
    helperText: string,
    options: { id: string; label: string }[],
    category = 'stucco'
  ): ScopeChecklistItem => ({
    ...(byId.get(id) || {}),
    id,
    label,
    helperText,
    category,
    inputType: 'choice',
    options,
    choiceId: byId.get(id)?.choiceId || 'unsure',
    state: byId.get(id)?.state || 'unsure',
  });
  const system = byId.get('stucco');
  const items: ScopeChecklistItem[] = [
    {
      ...(system || {}),
      id: 'stucco',
      label: 'Stucco system',
      helperText:
        'Select the assembly being bid. Quantity is based on net stucco wall area. Complete systems include WRB, metal lath, scratch/brown coats, standard finish, and standard accessories at $0 incremental.',
      category: 'stucco',
      inputType: 'choice',
      options: [
        { id: 'three_coat', label: '3-coat traditional stucco' },
        { id: 'one_coat', label: '1-coat stucco' },
        { id: 'eifs', label: 'EIFS / synthetic stucco' },
        { id: 'finish_only', label: 'Finish coat only' },
      ],
      choiceId: system?.choiceId || 'unsure',
      state: system?.state || 'unsure',
    },
    yesNo(
      'stucco_wrb',
      'Weather barrier / building paper',
      'Confirm whether WRB is included with this stucco bid or supplied by others.'
    ),
    yesNo(
      'stucco_lath',
      'Metal lath',
      'Confirm lath type and whether it is included in this subcontractor bid.'
    ),
    yesNo(
      'stucco_base_coat',
      'Base / scratch & brown coats',
      'For traditional stucco, includes scratch coat, brown coat, mixing, application, and curing.'
    ),
    yesNo(
      'stucco_finish_coat',
      'Finish coat',
      'Confirm finish texture and whether color or specialty coating is included.'
    ),
    choice(
      'stucco_foam_trim',
      'Foam trim / architectural bands',
      'Window bands, door bands, columns, cornices, quoins, and custom shapes.',
      [
        { id: 'basic_flat', label: 'Basic flat band' },
        { id: 'medium_profiled', label: 'Medium / profiled trim' },
        { id: 'complex_custom', label: 'Complex cornice / custom shape' },
        { id: 'custom_price', label: 'Custom price' },
      ]
    ),
    yesNo(
      'stucco_accessories',
      'Stucco accessories',
      'Corner bead, casing bead, weep screed, control joints, expansion joints, and flashing details.'
    ),
    yesNo(
      'stucco_soffits',
      'Soffits / stucco ceilings',
      'Overhead stucco is priced separately from vertical wall application.'
    ),
    yesNo(
      'stucco_parapets',
      'Parapets / raised walls',
      'Stucco surface on parapets and raised walls is measured and priced separately from the main exterior wall area.'
    ),
    choice(
      'stucco_access',
      'Access and scaffolding',
      'Price only the affected wall area when access exceeds standard ground access.',
      [
        { id: 'standard_ground', label: 'Standard ground access' },
        {
          id: 'difficult_single_story',
          label: 'Difficult single-story · +$0.75/SF',
        },
        { id: 'two_story', label: 'Two-story · +$1.50/SF' },
        {
          id: 'major_scaffolding',
          label: 'Three-story / major scaffolding · custom',
        },
      ]
    ),
    choice(
      'stucco_repairs',
      'Stucco repair / re-stucco',
      'Separate repair add-on. Enter affected repair SF only; this does not change net stucco wall area.',
      [
        { id: 'no_repair', label: 'No repair work' },
        { id: 'light_repair', label: 'Light patch / crack repair · $5.00/SF' },
        { id: 'moderate_repair', label: 'Moderate stucco repair · $8.50/SF' },
        {
          id: 'full_depth_repair',
          label: 'Full-depth / re-stucco repair · $12.00/SF',
        },
        {
          id: 'severe_damage',
          label: 'Severe / substrate damage · Custom price',
        },
      ]
    ),
    yesNo(
      'stucco_other_finish',
      'Other exterior finishes / exclusions',
      'Confirm stone, brick, siding, panels, or wood accents excluded from stucco area.'
    ),
  ];
  const customItems = existing.filter(isCustomScopeChecklistItem);
  return customItems.length ? [...items, ...customItems] : items;
}

function standaloneFramingChecklistItems(): ScopeChecklistItem[] {
  return FRAMING_CARDS.flatMap(card => [
    {
      id: card.itemId,
      label: card.label,
      helperText: card.helper,
      category: card.groupTitle,
      state: 'unsure' as const,
    },
  ]);
}

function standaloneInsulationChecklistItems(): ScopeChecklistItem[] {
  return [
    {
      id: 'insulation',
      label: 'Insulation',
      helperText:
        'Thermal-envelope insulation: exterior walls plus attic/ceiling or insulated roof deck. Confirm assembly and R-value before applying.',
      category: 'Insulation',
      state: 'unsure' as const,
    },
    {
      id: 'cleanup',
      label: 'Cleanup & disposal',
      helperText:
        'Confirm debris handling and final cleanup separately from insulation installation.',
      category: 'Insulation add-ons',
      state: 'unsure' as const,
    },
  ];
}

function standaloneDrywallChecklistItems(): ScopeChecklistItem[] {
  return [
    {
      id: 'drywall',
      label: COMPLETE_DRYWALL_ASSEMBLY_LABEL,
      helperText: COMPLETE_DRYWALL_ASSEMBLY_HELPER,
      category: 'Drywall',
      state: 'included' as const,
    },
    {
      id: 'texture',
      label: 'Drywall finish',
      helperText:
        'Select the finish style. The base drywall install includes standard board, mud/tape, finishing, and orange-peel texture.',
      category: 'Drywall',
      inputType: 'choice',
      options: [
        { id: 'orange_peel', label: 'Orange peel — base' },
        { id: 'knockdown', label: 'Knockdown — +10% finishing labor' },
        { id: 'skip_trowel', label: 'Skip trowel / hand texture — +23% finishing labor' },
        { id: 'smooth_level_4', label: 'Smooth — Level 4 — +17% finishing labor' },
        { id: 'smooth_level_5', label: 'Smooth — Level 5 — +52% finishing labor' },
        {
          id: 'custom_specialty',
          label: 'Custom / specialty — review required',
        },
        { id: 'unsure', label: 'Not sure yet' },
      ],
      choiceId: 'orange_peel',
      state: 'included' as const,
    },
    {
      id: 'patch_repair',
      label: 'Drywall patch / repair',
      helperText:
        'Use affected repair SF only; do not reuse the full new-drywall surface quantity.',
      category: 'Drywall add-ons',
      state: 'unsure' as const,
    },
    {
      id: 'cleanup',
      label: 'Cleanup & disposal',
      helperText:
        'Confirm debris handling and final cleanup separately from drywall installation.',
      category: 'Drywall add-ons',
      state: 'unsure' as const,
    },
  ];
}

function standalonePlumbingChecklistItems(
  mode: PlumbingWorkflowMode | null | undefined
): ScopeChecklistItem[] {
  const ids =
    mode === 'service'
      ? ['service_call', 'fixture_repair', 'fixture_replace', 'drain_cleaning']
      : [
          'plumbing_rough',
          'plumbing_trim',
          'water_line',
          'sewer_line',
          'gas_line',
        ];
  return ids.flatMap(id => {
    const card = PLUMBING_CARDS.find(item => item.itemId === id);
    if (!card) return [];
    return [
      {
        id: card.itemId,
        label: card.label,
        helperText: card.helper,
        category: card.groupTitle,
        state: 'unsure' as const,
      },
    ];
  });
}

function standaloneHvacChecklistItems(): ScopeChecklistItem[] {
  return HVAC_CARDS.map(card => ({
    id: card.itemId,
    label: card.label,
    helperText: card.helper,
    category: card.groupTitle,
    state: 'unsure' as const,
  }));
}

export function applyPlanImportToDraft(
  draft: EstimateAiDraft,
  payload: PlanImportPayload | null | undefined
): EstimateAiDraft {
  if (!draft || !payload) return draft;
  let next = draft;

  const planImportMode = payload.estimatingMode || 'whole_project';
  const planImportTradeKey = payload.selectedTrade || null;
  const standalonePlumbingWorkflow =
    payload.tradeWorkflowSource === 'standalone_trade' &&
    planImportTradeKey === 'plumbing';
  const applyAsSelectedTrade =
    planImportMode === 'selected_trade' || standalonePlumbingWorkflow;
  let rawMeasurements = normalizeTradePlanMeasurements(
    (payload.measurements || {}) as Record<string, number | string>,
    planImportTradeKey
  );
  if (planImportTradeKey === 'windows_doors') {
    rawMeasurements = classifyWindowsDoorsPlanMeasurements(
      rawMeasurements,
      payload.planFacts?.openingSchedules
    ).measurements as Record<string, number | string>;
  }
  const samePlanImport =
    Boolean(draft.scopeMeasurements?.planImportFingerprint) &&
    Boolean(payload.planImportFingerprint) &&
    draft.scopeMeasurements?.planImportFingerprint ===
      payload.planImportFingerprint;
  const retainedSamePlanElectricalFields = new Set<string>();
  const repeatReviewElectricalFields = new Set<string>();
  const PLUMBING_LINE_LF_KEYS = new Set([
    'waterLineLf',
    'sewerLineLf',
    'gasLineLf',
  ]);
  if (samePlanImport) {
    const previousMeasurements = (draft.scopeMeasurements || {}) as Record<
      string,
      unknown
    >;
    const previousSources =
      draft.scopeMeasurements?.quickMeasurementSources || {};
    const repeatKeys =
      planImportTradeKey === 'plumbing'
        ? new Set(PLUMBING_REVIEW_MEASUREMENT_KEYS)
        : planImportTradeKey === 'windows_doors'
          ? new Set(WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS)
          : planImportTradeKey === 'garage_doors'
            ? new Set(GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS)
          : planImportTradeKey === 'hvac'
            ? new Set(HVAC_PLAN_REVIEW_MEASUREMENT_KEYS)
        : new Set([
            ...ELECTRICAL_CARDS.map(card => card.measurementKey),
            'serviceAmperage',
          ]);
    for (const key of repeatKeys) {
      const incoming = rawMeasurements[key];
      const previous = previousMeasurements[key];
      const incomingNumber = Number(incoming);
      const previousNumber = Number(previous);
      const previousWasContractorConfirmed =
        previousSources[key] === 'contractor_confirmed_from_plan_review';
      if (
        !previousWasContractorConfirmed &&
        Number.isFinite(previousNumber) &&
        previousNumber > 0 &&
        (incoming == null ||
          incoming === '' ||
          !Number.isFinite(incomingNumber) ||
          incomingNumber !== previousNumber)
      ) {
        if (
          planImportTradeKey === 'plumbing' &&
          PLUMBING_LINE_LF_KEYS.has(key) &&
          Number.isFinite(incomingNumber) &&
          incomingNumber > 0 &&
          incomingNumber !== previousNumber
        ) {
          // Keep the new LF reading. The takeoff review page owns the 25 vs 30
          // chooser — do not pin the previous import or re-open it in Confirm Scope.
          continue;
        }
        if (
          planImportTradeKey === 'plumbing' &&
          (PLUMBING_INVENTORY_DERIVED_KEYS as readonly string[]).includes(
            key
          ) &&
          !plumbingSamePlanDerivedKeySupported(
            key,
            previous,
            hydratePlumbingPlanMeasurementsFromInventory(
              (payload.measurements || {}) as Record<string, number | string>,
              payload.fixtureInventory ??
                (draft.scopeMeasurements?.plumbingFixtureInventory as
                  | Record<string, number>
                  | null
                  | undefined),
              {
                waterHeaterDetail:
                  payload.waterHeaterDetail ??
                  draft.scopeMeasurements?.plumbingWaterHeaterDetail ??
                  null,
                gasApplianceScope:
                  payload.gasApplianceScope ??
                  draft.scopeMeasurements?.plumbingGasApplianceScope ??
                  null,
                complexityFactors:
                  payload.complexityFactors ??
                  draft.scopeMeasurements?.plumbingComplexityFactors ??
                  null,
              }
            ),
            samePlanImport
          )
        ) {
          // A weaker re-read without fixture inventory must not keep the
          // previous rough/trim/equipment counts in Confirm Scope.
          continue;
        }
        // A repeat read of the same document must not make a previously
        // visible electrical count disappear or silently switch quantities.
        // Keep the old count visible, but downgrade it until the contractor
        // confirms the value again.
        rawMeasurements[key] = previous as number | string;
        retainedSamePlanElectricalFields.add(key);
        repeatReviewElectricalFields.add(key);
      }
    }
    if (planImportTradeKey === 'drywall') {
      for (const key of DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS) {
        const previous = previousMeasurements[key];
        const previousNumber = Number(previous);
        const incoming = rawMeasurements[key];
        const incomingNumber = Number(incoming);
        if (
          Number.isFinite(previousNumber) &&
          previousNumber > 0 &&
          (incoming == null ||
            incoming === '' ||
            !Number.isFinite(incomingNumber) ||
            incomingNumber !== previousNumber)
        ) {
          // Same fingerprint means the same document. Keep the prior accepted
          // takeoff rather than allowing a weaker vision re-read to revert it.
          rawMeasurements[key] = previous as number | string;
        }
      }
    }
  }
  const filteredPlanMeasurements = filterPlanMeasurementsForTrade(
    rawMeasurements as Record<string, number>,
    planImportMode,
    planImportTradeKey
  );
  const tradeNormalization = normalizeImportedTradeMeasurements(
    planImportTradeKey,
    filteredPlanMeasurements as Record<string, number | string>,
    {
      ...(planImportTradeKey === 'roofing'
        ? {
            roofPitch: payload.planFacts?.roofPitch,
            storyCount: payload.planFacts?.storyCount,
          }
        : planImportTradeKey === 'plumbing'
          ? {
              storyCount: payload.planFacts?.storyCount,
            }
          : planImportTradeKey === 'electrical'
            ? {
                storyCount: payload.planFacts?.storyCount,
              }
            : {}),
      ...(payload.quickMeasurementSources
        ? { quickMeasurementSources: payload.quickMeasurementSources }
        : {}),
      ...(payload.measurementProvenance
        ? { measurementProvenance: payload.measurementProvenance }
        : {}),
    },
    'plan'
  );
  const canonicalPlanMeasurements =
    tradeNormalization?.measurements || filteredPlanMeasurements;
  let scopeMeasurements = planMeasurementsToScopeMeasurements(
    canonicalPlanMeasurements as Record<string, number>
  );
  if (standalonePlumbingWorkflow) {
    scopeMeasurements = {
      ...stripScopeInputForSingleTrade(
        (next.scopeMeasurements || {}) as Record<string, unknown>,
        'plumbing'
      ),
      ...scopeMeasurements,
      tradeWorkflowSource: 'standalone_trade',
      plumbingWorkflowMode: payload.plumbingWorkflowMode || 'bathroom_remodel',
      plumbingPerformerMode: payload.plumbingPerformerMode || null,
      planImportMode: null,
      planImportTradeKey: null,
      planImportFingerprint: null,
    } as ScopeMeasurements;
  }
  scopeMeasurements = mergeTradeNormalizationIntoScopeMeasurements(
    scopeMeasurements,
    tradeNormalization
  );
  if (planImportTradeKey === 'drywall') {
    const planFacts = (scopeMeasurements.planFacts ||
      payload.planFacts ||
      null) as Record<string, unknown> | null;
    const hydrated = hydrateDrywallComponentMeasurementsFromPlanContext(
      scopeMeasurements as Record<string, unknown>,
      payload.rooms,
      planFacts
    );
    const reconciled = reconcileIncompleteDrywallGeometryTakeoff(hydrated, {
      planFacts,
    });
    scopeMeasurements = {
      ...scopeMeasurements,
      ...Object.fromEntries(
        Object.entries(reconciled.measurements)
          .filter(([, value]) => value != null && value !== '')
          .map(([key, value]) => [key, value as number | string])
      ),
    } as ScopeMeasurements;
    const detectedKeys = DRYWALL_PLAN_QUICK_MEASUREMENT_KEYS.filter(
      key =>
        reconciled.measurements[key] != null &&
        !reconciled.planningEstimateKeys.includes(key)
    );
    if (detectedKeys.length) {
      scopeMeasurements.quickMeasurementSources =
        tagPlanDetectedQuickMeasurementKeys(
          scopeMeasurements.quickMeasurementSources,
          detectedKeys
        );
    }
    if (reconciled.planningEstimateKeys.length) {
      scopeMeasurements.quickMeasurementSources = {
        ...(scopeMeasurements.quickMeasurementSources || {}),
        ...Object.fromEntries(
          reconciled.planningEstimateKeys.map(key => [
            key,
            'needs_confirmation' as const,
          ])
        ),
      };
    }
  }
  if (planImportTradeKey === 'plumbing') {
    scopeMeasurements.plumbingWorkflowMode =
      payload.plumbingWorkflowMode || 'new_construction';
    scopeMeasurements.plumbingPerformerMode =
      payload.plumbingPerformerMode || null;
  }
  if (
    applyAsSelectedTrade &&
    (planImportTradeKey === 'electrical' || planImportTradeKey === 'plumbing')
  ) {
    seedMepProjectComplexityFromPlanImport(
      scopeMeasurements as Record<string, unknown>,
      payload
    );
  }
  if (!standalonePlumbingWorkflow) {
    scopeMeasurements.planImportMode = planImportMode;
    scopeMeasurements.planImportTradeKey = planImportTradeKey;
    scopeMeasurements.planImportFingerprint =
      payload.planImportFingerprint ?? null;
    scopeMeasurements.planImportProvenance = payload.tradeProvenance || {
      source: 'plan_import',
      mode: planImportMode,
      selectedTrade: planImportTradeKey,
    };
    scopeMeasurements.planImportMissingInfo = payload.missingInfo || [];
  }
  const tradeChecklistItems = filterChecklistItemsForTrade(
    next.scopeChecklist?.items || [],
    planImportMode,
    planImportTradeKey
  );
  const selectedTradeItems = standalonePlumbingWorkflow
    ? standalonePlumbingChecklistItems(payload.plumbingWorkflowMode)
    : planImportTradeKey === 'framing'
      ? standaloneFramingChecklistItems()
      : planImportTradeKey === 'insulation'
        ? standaloneInsulationChecklistItems()
        : planImportTradeKey === 'drywall'
          ? standaloneDrywallChecklistItems()
        : planImportTradeKey === 'hvac'
          ? standaloneHvacChecklistItems()
          : planImportTradeKey === 'stucco'
            ? buildStuccoTradeChecklistItems(tradeChecklistItems)
            : tradeChecklistItems;
  if (applyAsSelectedTrade && planImportTradeKey) {
    next = {
      ...next,
      scopeChecklist: {
        ...next.scopeChecklist!,
        items: selectedTradeItems,
        templateKey:
          planImportTradeKey === 'stucco'
            ? 'stucco'
            : planImportTradeKey === 'concrete'
              ? 'concrete'
              : planImportTradeKey === 'flooring'
                ? 'flooring'
                : planImportTradeKey === 'painting'
                  ? 'painting'
                  : planImportTradeKey === 'framing'
                    ? 'framing'
                    : planImportTradeKey === 'insulation'
                      ? 'insulation'
                      : planImportTradeKey === 'drywall'
                        ? 'drywall'
                      : planImportTradeKey === 'hvac'
                        ? 'hvac'
                        : planImportTradeKey === 'windows_doors'
                          ? 'windows_doors'
                        : planImportTradeKey === 'garage_doors'
                          ? 'garage_doors'
                        : planImportTradeKey === 'plumbing'
                          ? 'plumbing_service'
                          : planImportTradeKey === 'electrical'
                            ? 'electrical'
                            : next.scopeChecklist?.templateKey ||
                              'plumbing_service',
        title:
          planImportTradeKey === 'stucco'
            ? 'Stucco / exterior finish — confirm trade scope'
            : planImportTradeKey === 'concrete'
              ? 'Concrete — confirm project scope'
              : planImportTradeKey === 'flooring'
                ? 'Flooring — confirm project scope'
                : planImportTradeKey === 'painting'
                  ? 'Painting — confirm project scope'
                  : planImportTradeKey === 'framing'
                    ? 'Framing — confirm project scope'
                    : planImportTradeKey === 'insulation'
                      ? 'Insulation — confirm project scope'
                      : planImportTradeKey === 'drywall'
                        ? 'Drywall — confirm project scope'
                        : planImportTradeKey === 'hvac'
                          ? 'HVAC — confirm project scope'
                        : planImportTradeKey === 'windows_doors'
                          ? 'Windows & doors — confirm installation scope'
                        : planImportTradeKey === 'garage_doors'
                          ? 'Garage doors — confirm installation scope'
                        : planImportTradeKey === 'plumbing'
                          ? 'Plumbing — confirm project scope'
                          : next.scopeChecklist?.title ||
                            'Plumbing — confirm project scope',
        intro:
          planImportTradeKey === 'stucco'
            ? 'Confirm the stucco system, quantities, accessories, and access included in this bid.'
            : planImportTradeKey === 'concrete'
              ? 'Confirm concrete scope before pricing.'
              : planImportTradeKey === 'flooring'
                ? 'Confirm flooring scope before pricing.'
                : planImportTradeKey === 'painting'
                  ? 'Confirm painting scope before pricing.'
                  : planImportTradeKey === 'framing'
                    ? 'Confirm framing scope before pricing.'
                    : planImportTradeKey === 'insulation'
                      ? 'Confirm insulation scope and thermal-envelope quantities before pricing.'
                      : planImportTradeKey === 'drywall'
                        ? 'Confirm wall and ceiling drywall surface, finish level, add-ons, and cleanup before pricing.'
                      : planImportTradeKey === 'hvac'
                        ? 'Confirm HVAC systems, capacity, distribution, add-ons, and cleanup before pricing.'
                        : planImportTradeKey === 'windows_doors'
                          ? 'Confirm windows, exterior swing/French openings, explicit sliding units, and interior doors before pricing. Garage doors are a separate trade.'
                        : planImportTradeKey === 'garage_doors'
                          ? 'Confirm garage door type counts and openers before pricing.'
                        : planImportTradeKey === 'plumbing'
                          ? standalonePlumbingWorkflow
                            ? 'Confirm the Plumbing-only scope before pricing.'
                            : 'Confirm Plumbing scope before pricing.'
                          : next.scopeChecklist?.intro ||
                            'Confirm Plumbing scope before pricing.',
      },
    };
  }
  const payloadBuildingAreas = {
    ...(payload.buildingAreas || {}),
    ...(payload.planFacts?.buildingAreas || {}),
  };
  const insulationLiving =
    Number(
      payloadBuildingAreas.totalLivingSqft ??
        payloadBuildingAreas.mainFloorLivingSqft ??
        (
          payload.planFacts as
            | (PlanFacts & {
                totalLivingSqft?: number | null;
                floorAreaSqft?: number | null;
                mainFloorAreaSqft?: number | null;
              })
            | undefined
        )?.totalLivingSqft ??
        (
          payload.planFacts as
            | (PlanFacts & {
                totalLivingSqft?: number | null;
                floorAreaSqft?: number | null;
                mainFloorAreaSqft?: number | null;
              })
            | undefined
        )?.floorAreaSqft ??
        (payload.measurements as Record<string, unknown> | undefined)
          ?.floorAreaSqft ??
        (payload.measurements as Record<string, unknown> | undefined)
          ?.totalLivingSqft
    ) || null;
  const importedPlanFacts: PlanFacts | undefined =
    applyAsSelectedTrade && planImportTradeKey !== 'insulation'
      ? undefined
      : payload.planFacts || payload.buildingAreas || insulationLiving
        ? {
            ...(payload.planFacts || {}),
            buildingAreas: payloadBuildingAreas,
          }
        : undefined;
  if (planImportTradeKey === 'insulation' && insulationLiving) {
    if (!(Number(scopeMeasurements.floorAreaSqft) > 0)) {
      scopeMeasurements.floorAreaSqft = insulationLiving;
    }
    const garage =
      Number(payloadBuildingAreas.garageSqft) ||
      Number(
        (payload.measurements as Record<string, unknown> | undefined)
          ?.garageSqft
      ) ||
      null;
    if (garage && !(Number(scopeMeasurements.garageSqft) > 0)) {
      scopeMeasurements.garageSqft = garage;
    }
  }
  if (importedPlanFacts) scopeMeasurements.planFacts = importedPlanFacts;
  if (planImportTradeKey === 'insulation' && scopeMeasurements.planFacts) {
    scopeMeasurements = syncMeasurementsWithSouthernUtahPlanFacts(
      scopeMeasurements,
      { templateKey: 'insulation' }
    );
  }
  if (payload.fieldConfidence && Object.keys(payload.fieldConfidence).length) {
    scopeMeasurements.quickMeasurementFieldConfidence = {
      ...payload.fieldConfidence,
    };
  }
  if (tradeNormalization?.quickMeasurementSources) {
    scopeMeasurements.quickMeasurementSources = {
      ...scopeMeasurements.quickMeasurementSources,
      ...tradeNormalization.quickMeasurementSources,
    } as ScopeMeasurements['quickMeasurementSources'];
  }
  if (tradeNormalization?.measurementProvenance) {
    scopeMeasurements.measurementProvenance = {
      ...scopeMeasurements.measurementProvenance,
      ...tradeNormalization.measurementProvenance,
    };
  }
  if (payload.measurementProvenance) {
    scopeMeasurements.measurementProvenance = payload.measurementProvenance;
  }
  if (planImportTradeKey === 'hvac') {
    if (payload.quickMeasurementSources) {
      scopeMeasurements.quickMeasurementSources = {
        ...(scopeMeasurements.quickMeasurementSources || {}),
        ...payload.quickMeasurementSources,
      } as ScopeMeasurements['quickMeasurementSources'];
    }
    scopeMeasurements = applyHvacProvenanceGuardToScopeMeasurements(
      scopeMeasurements as Record<string, unknown>
    ) as ScopeMeasurements;
    const structured = buildHvacStructuredMeasurements(
      scopeMeasurements as Record<string, unknown>,
      scopeMeasurements.quickMeasurementSources || {}
    );
    if (Object.keys(structured.itemQuantities).length) {
      scopeMeasurements = {
        ...scopeMeasurements,
        itemQuantities: {
          ...(scopeMeasurements.itemQuantities || {}),
          ...structured.itemQuantities,
        },
      };
    }
  }
  if (planImportTradeKey === 'insulation') {
    scopeMeasurements = applyHydratedInsulationScopeMeasurements(
      scopeMeasurements,
      {
        planFacts: scopeMeasurements.planFacts,
        buildingAreas: scopeMeasurements.planFacts?.buildingAreas,
      }
    );
  }
  if (payload.utilityConnections !== undefined) {
    scopeMeasurements.plumbingUtilityConnections = payload.utilityConnections;
  }
  if (payload.fixtureInventory !== undefined) {
    scopeMeasurements.plumbingFixtureInventory = payload.fixtureInventory;
  }
  if (payload.complexityFactors !== undefined) {
    scopeMeasurements.plumbingComplexityFactors = payload.complexityFactors;
  }
  if (payload.plumbingReviewStatus !== undefined) {
    scopeMeasurements.plumbingReviewStatus = payload.plumbingReviewStatus;
  }
  if (payload.waterHeaterDetail !== undefined) {
    scopeMeasurements.plumbingWaterHeaterDetail = payload.waterHeaterDetail;
  }
  if (payload.gasApplianceScope !== undefined) {
    scopeMeasurements.plumbingGasApplianceScope = payload.gasApplianceScope;
  }
  if (planImportTradeKey === 'plumbing') {
    const previousPlumbing = draft.scopeMeasurements || {};
    if (
      scopeMeasurements.plumbingWaterHeaterDetail == null &&
      previousPlumbing.plumbingWaterHeaterDetail != null
    ) {
      scopeMeasurements.plumbingWaterHeaterDetail =
        previousPlumbing.plumbingWaterHeaterDetail;
    }
    if (
      scopeMeasurements.plumbingGasApplianceScope == null &&
      previousPlumbing.plumbingGasApplianceScope != null
    ) {
      scopeMeasurements.plumbingGasApplianceScope =
        previousPlumbing.plumbingGasApplianceScope;
    }
    if (
      scopeMeasurements.plumbingComplexityFactors == null &&
      previousPlumbing.plumbingComplexityFactors != null
    ) {
      scopeMeasurements.plumbingComplexityFactors =
        previousPlumbing.plumbingComplexityFactors;
    }
    applyPlumbingEquipmentHydrationToMeasurements(
      scopeMeasurements as Record<string, unknown>,
      {
        fixtureInventory:
          payload.fixtureInventory ??
          scopeMeasurements.plumbingFixtureInventory ??
          null,
        waterHeaterDetail:
          payload.waterHeaterDetail ??
          scopeMeasurements.plumbingWaterHeaterDetail ??
          null,
        gasApplianceScope:
          payload.gasApplianceScope ??
          scopeMeasurements.plumbingGasApplianceScope ??
          null,
        complexityFactors:
          payload.complexityFactors ??
          scopeMeasurements.plumbingComplexityFactors ??
          null,
      },
      { storeAsNumber: true }
    );
    reconcilePlumbingEquipmentScopeMeasurements(
      scopeMeasurements as Record<string, unknown>
    );
    rebuildPlumbingStructuredScopeFromMeasurements(
      scopeMeasurements as Record<string, unknown>,
      'plan_detected'
    );
    stripStalePlumbingInventoryDerivedFields(
      scopeMeasurements as Record<string, unknown>,
      payload
    );
  }
  if (planImportTradeKey === 'framing') {
    reconcileFramingScopeMeasurements(
      scopeMeasurements as Record<string, unknown>
    );
    rebuildFramingStructuredScopeFromMeasurements(
      scopeMeasurements as Record<string, unknown>,
      'plan_detected'
    );
  }
  if (samePlanImport && retainedSamePlanElectricalFields.size) {
    const previous = draft.scopeMeasurements || {};
    const previousSources = previous.quickMeasurementSources || {};
    const previousProvenance = previous.measurementProvenance || {};
    scopeMeasurements.quickMeasurementSources = {
      ...(scopeMeasurements.quickMeasurementSources || {}),
    };
    scopeMeasurements.measurementProvenance = {
      ...(scopeMeasurements.measurementProvenance || {}),
    };
    for (const key of retainedSamePlanElectricalFields) {
      if (repeatReviewElectricalFields.has(key)) {
        scopeMeasurements.quickMeasurementSources[key] = 'needs_confirmation';
        const previousEntry = previousProvenance[key];
        scopeMeasurements.measurementProvenance[key] = {
          ...(previousEntry && typeof previousEntry === 'object'
            ? previousEntry
            : {}),
          value: Number(scopeMeasurements[key]),
          status: 'needs_review',
          normalizedSource: 'NEEDS_REVIEW',
          pricingEligible: false,
          deterministicRepeatedImportStable: false,
          reason:
            'The same imported plan produced a different quantity on repeat import; confirm this field before pricing.',
        };
      } else if (previousSources[key]) {
        scopeMeasurements.quickMeasurementSources[key] = previousSources[key];
      }
      if (
        !repeatReviewElectricalFields.has(key) &&
        previousProvenance[key] !== undefined
      ) {
        scopeMeasurements.measurementProvenance[key] = previousProvenance[key];
      }
    }
  }
  if (payload.measurementConflicts !== undefined) {
    scopeMeasurements.measurementConflicts =
      payload.measurementConflicts.filter(
        conflict =>
          !repeatReviewElectricalFields.has(String(conflict?.field || ''))
      );
  }
  if (payload.electricalValidation !== undefined) {
    scopeMeasurements.electricalValidation = payload.electricalValidation;
  }
  if (repeatReviewElectricalFields.size) {
    const validation = scopeMeasurements.electricalValidation || {};
    const fields = { ...(validation.fields || {}) };
    const priceableFields = new Set(validation.priceableFields || []);
    const blockedFields = new Set(validation.blockedFields || []);
    for (const key of repeatReviewElectricalFields) {
      fields[key] = {
        ...(fields[key] || {}),
        status: 'needs_review',
        pricingEligible: false,
        deterministicRepeatedImportStable: false,
        reason:
          'The same imported plan produced a different quantity on repeat import; confirm this field before pricing.',
      };
      priceableFields.delete(key);
      blockedFields.add(key);
    }
    scopeMeasurements.electricalValidation = {
      ...validation,
      fields,
      priceableFields: [...priceableFields],
      blockedFields: [...blockedFields],
    };
  }
  if (!applyAsSelectedTrade && payload.areaReconciliation) {
    scopeMeasurements.areaReconciliation = payload.areaReconciliation;
  }
  const rooms = applyAsSelectedTrade ? [] : normalizePlanRooms(payload.rooms);
  if (rooms.length) {
    scopeMeasurements = applyPlanRoomsToScopeMeasurements(
      scopeMeasurements,
      rooms
    );
  }

  const detections = filterPlanScopesForTrade(
    payload.scopeDetections || [],
    planImportMode,
    planImportTradeKey
  );
  let items = next.scopeChecklist?.items || [];
  if (detections?.length && items.length) {
    const { items: nextItems } = applyScopeDetectionsToChecklistItems(
      items,
      detections
    );
    items = nextItems;
    next = {
      ...next,
      scopeChecklist: { ...next.scopeChecklist!, items: nextItems },
    };
  }
  if (planImportTradeKey === 'plumbing') {
    const syncedItems = syncPlumbingScopeItems(items, {
      plumbingScope: scopeMeasurements.plumbingScope,
      quantities: scopeMeasurements as Record<string, unknown>,
    });
    items = syncedItems;
    next = {
      ...next,
      scopeChecklist: {
        ...(next.scopeChecklist || {
          templateKey: 'plumbing_service',
          title: 'Plumbing — confirm project scope',
          intro: 'Confirm Plumbing scope before pricing.',
          items: [],
        }),
        items: syncedItems,
      },
    };
  }
  if (planImportTradeKey === 'framing') {
    const syncedItems = syncFramingScopeItems(items, {
      framingScope: scopeMeasurements.framingScope,
      quantities: scopeMeasurements as Record<string, unknown>,
    });
    items = syncedItems;
    next = {
      ...next,
      scopeChecklist: {
        ...(next.scopeChecklist || {
          templateKey: 'framing',
          title: 'Framing — confirm project scope',
          intro: 'Confirm framing scope before pricing.',
          items: [],
        }),
        items: syncedItems,
      },
    };
  }
  if (planImportTradeKey === 'windows_doors') {
    const syncedItems = syncWindowsDoorsScopeItems(
      items,
      scopeMeasurements as Record<string, unknown>
    );
    items = syncedItems;
    next = {
      ...next,
      scopeChecklist: {
        ...next.scopeChecklist!,
        items: syncedItems,
      },
    };
  }
  if (planImportTradeKey === 'garage_doors') {
    const reconciled = normalizeGarageDoorsPlanMeasurements(
      scopeMeasurements as Record<string, unknown>,
      {
        rooms: scopeMeasurements.planRooms || rooms,
        openingSchedules:
          scopeMeasurements.planFacts?.openingSchedules ?? null,
      }
    );
    for (const key of GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
      if (reconciled[key] != null) {
        (scopeMeasurements as Record<string, unknown>)[key] = reconciled[key];
      } else {
        delete (scopeMeasurements as Record<string, unknown>)[key];
      }
    }
    const syncedItems = syncGarageDoorsScopeItems(
      items,
      scopeMeasurements as Record<string, unknown>
    );
    items = syncedItems;
    next = {
      ...next,
      scopeChecklist: {
        ...next.scopeChecklist!,
        items: syncedItems,
      },
    };
  }

  if (Object.keys(scopeMeasurements).length || rooms.length) {
    if (!applyAsSelectedTrade) {
      scopeMeasurements = seedPlanFloorAreaItemQuantities(
        next,
        scopeMeasurements
      );
      scopeMeasurements = syncMeasurementsWithSouthernUtahPlanFacts(
        scopeMeasurements,
        {
          templateKey: next.scopeChecklist?.templateKey,
        }
      );
      scopeMeasurements = hydrateProjectComplexityMeasurements(
        scopeMeasurements as Record<string, unknown>
      ) as ScopeMeasurements;
    }
    if (applyAsSelectedTrade) {
      next = {
        ...next,
        scopeMeasurements: stripWholeProjectScopeMeasurements(
          next.scopeMeasurements
        ),
      };
    }
    next = overlayScopeMeasurements(next, scopeMeasurements);
  } else if (applyAsSelectedTrade) {
    next = {
      ...next,
      scopeMeasurements: stripWholeProjectScopeMeasurements(
        next.scopeMeasurements
      ),
    };
    next = overlayScopeMeasurements(next, scopeMeasurements);
  }
  if (planImportTradeKey === 'plumbing' && next.scopeMeasurements) {
    stripStalePlumbingInventoryDerivedFields(
      next.scopeMeasurements as Record<string, unknown>,
      payload
    );
    const syncedAfterOverlay = syncPlumbingScopeItems(
      next.scopeChecklist?.items || [],
      {
        plumbingScope: next.scopeMeasurements.plumbingScope,
        quantities: next.scopeMeasurements as Record<string, unknown>,
      }
    );
    next = {
      ...next,
      scopeChecklist: {
        ...(next.scopeChecklist || {
          templateKey: 'plumbing_service',
          title: 'Plumbing — confirm project scope',
          intro: 'Confirm Plumbing scope before pricing.',
          items: [],
        }),
        items: syncedAfterOverlay,
      },
    };
  }
  if (planImportTradeKey === 'framing' && next.scopeMeasurements) {
    const syncedAfterOverlay = syncFramingScopeItems(
      next.scopeChecklist?.items || [],
      {
        framingScope: next.scopeMeasurements.framingScope,
        quantities: next.scopeMeasurements as Record<string, unknown>,
      }
    );
    next = {
      ...next,
      scopeChecklist: {
        ...(next.scopeChecklist || {
          templateKey: 'framing',
          title: 'Framing — confirm project scope',
          intro: 'Confirm framing scope before pricing.',
          items: [],
        }),
        items: syncedAfterOverlay,
      },
    };
  }

  return next;
}

export async function applyScopeAssumptionsToDraft(
  draft: EstimateAiDraft,
  confirmedItems: ScopeChecklistItem[],
  scopeMeasurements?: ScopeMeasurements | null
): Promise<EstimateAiDraft> {
  const draftForApply = overlayScopeMeasurements(draft, scopeMeasurements);
  const payload = await postAiAssistantJson<{
    draft?: EstimateAiDraft;
    error?: string;
    message?: string;
  }>(
    '/estimate-draft-apply-scope-assumptions',
    {
      draft: draftForApply,
      confirmedItems,
      scopeMeasurements: scopeMeasurements ?? undefined,
    },
    60000
  );

  if (!payload?.draft) {
    throw new Error(
      payload?.message || payload?.error || 'Failed to apply scope assumptions'
    );
  }

  return withReconciledScopePackages(
    syncSelectedScopePricing(
      overlayScopeMeasurements(payload.draft, scopeMeasurements)
    ),
    confirmedItems
  );
}

export function draftHasCombinedRoomPrices(
  draft: EstimateAiDraft | null
): boolean {
  return (draft?.combinedPriceRoomCount || 0) > 0;
}

export function getScopePackageForRoom(
  draft: EstimateAiDraft,
  roomName: string
): EstimateDraftScopePackage | undefined {
  const exact = draft.scopePackages?.find(p => p.name === roomName);
  if (exact) return exact;
  if (!draft.scopePackages?.length) {
    return getScopePackages(draft).find(p => p.name === roomName);
  }
  const normalizedRoom = roomName.toLowerCase();
  return draft.scopePackages.find(p => {
    const normalizedPkg = p.name.toLowerCase();
    if (normalizedPkg === normalizedRoom) return true;
    const roomIsDemo = /\bdemo|removal\b/.test(normalizedRoom);
    const pkgIsDemo = /\bdemo|removal\b/.test(normalizedPkg);
    if (roomIsDemo || pkgIsDemo) return roomIsDemo && pkgIsDemo;
    if (
      /\bbaseboard|trim\b/.test(normalizedRoom) &&
      /\bbaseboard|trim\b/.test(normalizedPkg)
    )
      return true;
    if (
      /\blvp|flooring|floor\b/.test(normalizedRoom) &&
      /\blvp|flooring|floor\b/.test(normalizedPkg)
    ) {
      return true;
    }
    return false;
  });
}

type SelectedScopePricing = {
  total: number;
  materialPrice: number | null;
  laborPrice: number | null;
  basis: { quantity: number; unit: string } | null;
  ruleKey: string;
};

function selectedPricingForRuleKey(
  draft: EstimateAiDraft,
  ruleKey: string
): SelectedScopePricing | null {
  const itemQuantities = draft.scopeMeasurements?.itemQuantities || {};
  const acceptance = draft.scopeMeasurements?.pricingAcceptance?.[ruleKey];
  const base = itemQuantities[ruleKey];
  const allowance = itemQuantities[`${ruleKey}__allowance`];
  const material = itemQuantities[`${ruleKey}__material`];
  const labor = itemQuantities[`${ruleKey}__labor`];
  const materialPrice = Number(material?.quantity || 0);
  const laborPrice = Number(labor?.quantity || 0);
  const splitTotal = materialPrice + laborPrice;
  const hasSplitLegs = Boolean(material || labor);
  const splitLegsEmpty = !(materialPrice > 0) && !(laborPrice > 0);
  const userSelected =
    base?.quantitySource === 'user_entered' ||
    allowance?.quantitySource === 'user_entered' ||
    material?.quantitySource === 'user_entered' ||
    labor?.quantitySource === 'user_entered' ||
    acceptance?.selectionStatus === 'accepted' ||
    acceptance?.selectionStatus === 'manual_adjusted';

  // Only sync splits the user confirmed in Confirm Scope / Step 3.
  // Auto national-average amounts must not rewrite packages on apply.
  if (!userSelected) return null;

  const physicalBasis =
    base?.quantity &&
    base.unit &&
    !['allowance', 'lump_sum'].includes(base.unit)
      ? { quantity: Number(base.quantity), unit: base.unit }
      : null;

  if (
    acceptance &&
    Number(acceptance.totalAmount) > 0 &&
    (acceptance.selectionStatus === 'accepted' ||
      acceptance.selectionStatus === 'manual_adjusted')
  ) {
    // Match Step 2: wiped Material/Labor with orphan __allowance must not stamp stale acceptance.
    if (hasSplitLegs && splitLegsEmpty) {
      return null;
    }
    // Prefer live Confirm Scope M/L over sticky acceptance amounts so Step 3 stays accurate.
    const acceptedMaterial =
      materialPrice > 0
        ? materialPrice
        : acceptance.materialAmount != null &&
            Number(acceptance.materialAmount) > 0
          ? Number(acceptance.materialAmount)
          : null;
    const acceptedLabor =
      laborPrice > 0
        ? laborPrice
        : acceptance.laborAmount != null && Number(acceptance.laborAmount) > 0
          ? Number(acceptance.laborAmount)
          : null;
    const liveTotal =
      splitTotal > 0 ? splitTotal : Number(acceptance.totalAmount);
    // Dollar totals stored as unit "allowance" are not a takeoff qty — omit basis so Step 3
    // does not show "10,118 allowance" under finish carpentry / similar packages.
    const basis =
      physicalBasis &&
      !(
        Number(physicalBasis.quantity) > 0 &&
        Math.abs(Number(physicalBasis.quantity) - liveTotal) < 0.02
      )
        ? physicalBasis
        : null;
    return {
      total: liveTotal,
      materialPrice: acceptedMaterial,
      laborPrice: acceptedLabor,
      basis,
      ruleKey,
    };
  }

  const allowanceTotal = Number(allowance?.quantity || 0);
  const baseTotal = ['allowance', 'lump_sum'].includes(base?.unit || '')
    ? Number(base?.quantity || 0)
    : 0;
  // Split legs present but empty → ignore orphan __allowance leftover.
  const total =
    splitTotal > 0
      ? splitTotal
      : hasSplitLegs && splitLegsEmpty
        ? 0
        : allowanceTotal || baseTotal;
  if (!Number.isFinite(total) || total <= 0) return null;

  return {
    total,
    materialPrice: materialPrice > 0 ? materialPrice : null,
    laborPrice: laborPrice > 0 ? laborPrice : null,
    basis: physicalBasis,
    ruleKey,
  };
}

function selectedPricingForScopeName(
  draft: EstimateAiDraft,
  name: string,
  scope = '',
  checklistItemId?: string | null
): SelectedScopePricing | null {
  // Prefer Confirm Scope checklist id when packages already carry it — name regex
  // has repeatedly mapped Electrical fixtures → electrical_rough, etc.
  if (checklistItemId) {
    return selectedPricingForRuleKey(draft, checklistItemId);
  }
  for (const ruleKey of ruleKeysToTryForPackage(name, scope)) {
    const selected = selectedPricingForRuleKey(draft, ruleKey);
    if (selected) return selected;
  }
  return null;
}

function resolvedScopeQuantityBasis(
  draft: EstimateAiDraft,
  ruleKey: string
): { quantity: number; unit: string } | null {
  const resolved = resolveChecklistItemQuantity(
    ruleKey,
    normalizeScopeMeasurements(draft.scopeMeasurements),
    {
      templateKey: draft.scopeChecklist?.templateKey,
      notes: draft.originalNotes,
    }
  );
  if (resolved.quantity == null || resolved.quantity <= 0 || !resolved.unit)
    return null;
  return { quantity: Number(resolved.quantity), unit: resolved.unit };
}

function packageMoneyTotal(pkg: {
  finalApprovedTotal?: number | null;
  knownSubtotal?: number | null;
  calculatedSubtotal?: number | null;
  price?: number | null;
}): number {
  const candidates = [
    pkg.finalApprovedTotal,
    pkg.knownSubtotal,
    pkg.calculatedSubtotal,
    pkg.price,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

const SOFT_COST_SYNC_KEYS = new Set([
  'cleanup',
  'haul_off',
  'permits',
  'contingency',
  'mobilization',
  'emergency_fee',
  'final_inspections',
]);

/**
 * Keep Ask AI / manual soft-cost line prices when Confirm Scope sync would
 * rewrite them via a shared/sibling rule key (e.g. trash haul-off ≠ cleanup).
 * Same checklist key still receives Confirm Scope updates.
 */
function isAutoCalculatedUnconfirmedPackage(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft,
  ruleKey: string | null
): boolean {
  if (!(packageMoneyTotal(pkg) > 0)) return false;
  if (
    pkg.priceProvidedByUser ||
    pkg.status === 'user_provided' ||
    pkg.priceSource === 'user_provided'
  ) {
    return false;
  }
  if (
    ruleKey &&
    hasAcceptedScopePricing(
      ruleKey,
      draft.scopeMeasurements?.itemQuantities || {},
      draft.scopeMeasurements?.pricingAcceptance
    )
  ) {
    return false;
  }

  const confirmedFromScope = Boolean(
    draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length
  );

  // Before Confirm Scope, keep AI-approved / applyEligible package prices.
  if (!confirmedFromScope) {
    if (pkg.status === 'confirmed' && pkg.applyEligible) return false;
    if (pkg.applyEligible) return false;
    return true;
  }

  // After Confirm Scope: checklist rows without Applied pricing are stripped even
  // when AI marked them confirmed+applyEligible (that path inflated Bid Summary).
  if (ruleKey) {
    const onChecklist = confirmScopeDisplayItemsFromDraft(draft).some(
      item => item.id === ruleKey && checklistItemInScope(item)
    );
    if (onChecklist) return true;
  }

  // Off-checklist Ask AI rows may still use applyEligible / confirmed.
  if (pkg.applyEligible || pkg.status === 'confirmed') return false;
  return true;
}

/** Drop takeoff/backend prices that never got Applied on Confirm Scope. */
function stripUnconfirmedAutoPackagePricing<
  T extends EstimateDraftScopePackage,
>(
  pkg: T,
  draft: EstimateAiDraft,
  base: T,
  basis: { quantity: number; unit: string } | null
): T {
  const ruleKey =
    base.checklistItemId ||
    lookupRuleKeyForPackage(pkg.name, pkg.scope || '') ||
    null;
  if (!isAutoCalculatedUnconfirmedPackage(pkg, draft, ruleKey)) {
    return basis
      ? {
          ...base,
          scopeQuantities: [{ quantity: basis.quantity, unit: basis.unit }],
          budgetSplitBasis: basis,
        }
      : base;
  }

  return {
    ...base,
    price: null,
    knownSubtotal: null,
    calculatedSubtotal: null,
    finalApprovedTotal: null,
    materialPrice: null,
    laborPrice: null,
    priceSource: 'missing',
    status: 'missing_price',
    packageStatus: 'missing_price',
    applyEligible: false,
    priceProvidedByUser: false,
    pricedFromSqftAllowances: false,
    scopeQuantities: basis
      ? [{ quantity: basis.quantity, unit: basis.unit }]
      : pkg.scopeQuantities,
    budgetSplitBasis: basis ?? pkg.budgetSplitBasis ?? null,
    missingPriceItems: pkg.missingPriceItems?.length
      ? pkg.missingPriceItems
      : ['Materials / supplies', 'Install labor'],
  };
}

function physicalScopeQuantityFromRoom(
  draft: EstimateAiDraft,
  packageName: string
): { quantity: number; unit: string } | null {
  const roomQty = (draft.rooms || []).find((room) => room.name === packageName)
    ?.scopeQuantities?.[0];
  if (roomQty?.quantity == null || !(Number(roomQty.quantity) > 0) || !roomQty.unit) {
    return null;
  }
  const unit = String(roomQty.unit).toLowerCase();
  if (['allowance', 'lump_sum'].includes(unit)) return null;
  return { quantity: Number(roomQty.quantity), unit: String(roomQty.unit) };
}

function shouldPreserveUserPackagePrice(
  pkg: {
    priceProvidedByUser?: boolean;
    price?: number | null;
    checklistItemId?: string | null;
  },
  selected: SelectedScopePricing
): boolean {
  if (!pkg.priceProvidedByUser) return false;
  const current = Number(pkg.price);
  if (!(current > 0)) return false;
  // Ask AI / manual row price wins whenever it differs from Confirm Scope sync.
  return Math.abs(current - selected.total) > 0.01;
}

function applySelectedPricingToScopePackage(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): EstimateDraftScopePackage {
  const selected = selectedPricingForScopeName(
    draft,
    pkg.name,
    pkg.scope,
    pkg.checklistItemId
  );
  // Keep a stable checklist identity; do not overwrite with a wrong regex match.
  const ruleKey =
    pkg.checklistItemId ||
    selected?.ruleKey ||
    lookupRuleKeyForPackage(pkg.name, pkg.scope || '') ||
    null;
  // When Confirm Scope already selected a price, honor its basis only (null = no
  // takeoff qty). Do not fall back to resolvedScopeQuantityBasis — that re-reads
  // dollar "allowance" itemQuantities as 10,118 lump sum under finish carpentry.
  const basis = selected
    ? selected.basis
    : ((ruleKey ? resolvedScopeQuantityBasis(draft, ruleKey) : null) ??
      pkg.budgetSplitBasis ??
      pkg.scopeQuantities?.[0] ??
      null);
  const withIdentity: EstimateDraftScopePackage = {
    ...pkg,
    checklistItemId: ruleKey,
    costCode: pkg.costCode || ruleKey,
  };
  if (!selected) {
    return stripUnconfirmedAutoPackagePricing(pkg, draft, withIdentity, basis);
  }
  const roomPhysicalQty = physicalScopeQuantityFromRoom(draft, pkg.name);
  if (shouldPreserveUserPackagePrice(pkg, selected)) {
    const preserved = Number(pkg.price) || selected.total;
    const displayBasis = roomPhysicalQty ?? basis;
    return {
      ...withIdentity,
      price: preserved,
      knownSubtotal: preserved,
      calculatedSubtotal: preserved,
      checklistItemId: pkg.checklistItemId || ruleKey,
      materialPrice: selected.materialPrice ?? pkg.materialPrice ?? null,
      laborPrice: selected.laborPrice ?? pkg.laborPrice ?? null,
      budgetSplitBasis: displayBasis ?? pkg.budgetSplitBasis ?? null,
      scopeQuantities: displayBasis
        ? [{ quantity: displayBasis.quantity, unit: displayBasis.unit }]
        : pkg.scopeQuantities,
    };
  }
  const displayBasis = roomPhysicalQty ?? basis;
  return {
    ...withIdentity,
    price: selected.total,
    knownSubtotal: selected.total,
    calculatedSubtotal: selected.total,
    finalApprovedTotal: selected.total,
    materialPrice: selected.materialPrice,
    laborPrice: selected.laborPrice,
    includesLabor: selected.laborPrice != null ? true : pkg.includesLabor,
    includesMaterials:
      selected.materialPrice != null ? true : pkg.includesMaterials,
    priceSource: 'user_provided',
    status: 'user_provided',
    pricingType:
      selected.materialPrice || selected.laborPrice ? 'split' : 'lump_sum',
    priceIncludesLaborAndMaterials: Boolean(
      selected.total && !(selected.materialPrice && selected.laborPrice)
    ),
    splitIsSuggested: false,
    priceProvidedByUser: true,
    applyEligible: true,
    budgetSplitBasis: displayBasis ?? pkg.budgetSplitBasis ?? null,
    scopeQuantities: displayBasis
      ? [{ quantity: displayBasis.quantity, unit: displayBasis.unit }]
      : pkg.scopeQuantities,
    missingPriceItems: [],
  };
}

function applySelectedPricingToRoom(
  room: EstimateDraftRoom,
  draft: EstimateAiDraft
): EstimateDraftRoom {
  const checklistItemId =
    (room as { checklistItemId?: string | null }).checklistItemId ||
    lookupRuleKeyForPackage(room.name, room.scope || '');
  const selected = selectedPricingForScopeName(
    draft,
    room.name,
    room.scope,
    checklistItemId
  );
  if (!selected) {
    const asPkg = {
      name: room.name,
      scope: room.scope,
      checklistItemId,
      price: room.price,
      knownSubtotal: room.knownSubtotal,
      calculatedSubtotal: room.calculatedSubtotal,
      materialPrice: room.materialPrice,
      laborPrice: room.laborPrice,
      priceProvidedByUser: room.priceProvidedByUser,
      status: room.packageStatus || room.status,
      scopeQuantities: room.scopeQuantities,
      budgetSplitBasis: room.budgetSplitBasis,
      missingPriceItems: room.missingPriceItems,
      pricedFromSqftAllowances: room.pricedFromSqftAllowances,
    } as EstimateDraftScopePackage;
    const basis =
      (checklistItemId
        ? resolvedScopeQuantityBasis(draft, checklistItemId)
        : null) ??
      room.budgetSplitBasis ??
      room.scopeQuantities?.[0] ??
      null;
    const stripped = stripUnconfirmedAutoPackagePricing(
      asPkg,
      draft,
      asPkg,
      basis
    );
    return {
      ...room,
      price: stripped.price ?? null,
      knownSubtotal: stripped.knownSubtotal ?? null,
      calculatedSubtotal: stripped.calculatedSubtotal ?? null,
      materialPrice: stripped.materialPrice ?? null,
      laborPrice: stripped.laborPrice ?? null,
      priceProvidedByUser: stripped.priceProvidedByUser,
      packageStatus: stripped.packageStatus ?? room.packageStatus,
      pricedFromSqftAllowances: stripped.pricedFromSqftAllowances,
      scopeQuantities: stripped.scopeQuantities,
      budgetSplitBasis: stripped.budgetSplitBasis ?? null,
      missingPriceItems: stripped.missingPriceItems,
      applyEligible: stripped.applyEligible,
    };
  }
  if (
    shouldPreserveUserPackagePrice(
      {
        priceProvidedByUser: room.priceProvidedByUser,
        price: room.price,
        checklistItemId,
      },
      selected
    )
  ) {
    return room;
  }
  return {
    ...room,
    price: selected.total,
    knownSubtotal: selected.total,
    materialPrice: selected.materialPrice,
    laborPrice: selected.laborPrice,
    priceIncludesLaborAndMaterials: Boolean(
      selected.total && !(selected.materialPrice && selected.laborPrice)
    ),
    splitIsSuggested: false,
    priceProvidedByUser: true,
    pricedFromSqftAllowances: false,
    packageStatus: 'user_provided',
    applyEligible: true,
    missingPriceItems: [],
  };
}

function recomputeClientDraftTotals(draft: EstimateAiDraft): EstimateAiDraft {
  const packages = draft.scopePackages || [];
  if (!packages.length) return draft;
  let lineTotal = 0;
  let laborTotal = 0;
  let materialTotal = 0;
  for (const pkg of packages) {
    const amount = packageMoneyTotal(pkg);
    if (!(amount > 0)) continue;
    lineTotal += amount;
    materialTotal +=
      Number(pkg.materialPrice) > 0 ? Number(pkg.materialPrice) : 0;
    laborTotal += Number(pkg.laborPrice) > 0 ? Number(pkg.laborPrice) : 0;
  }
  if (!(lineTotal > 0)) return draft;
  return {
    ...draft,
    calculatedLineItemTotal: Math.round(lineTotal * 100) / 100,
    calculatedLaborTotal:
      laborTotal > 0
        ? Math.round(laborTotal * 100) / 100
        : draft.calculatedLaborTotal,
    calculatedMaterialTotal:
      materialTotal > 0
        ? Math.round(materialTotal * 100) / 100
        : draft.calculatedMaterialTotal,
    calculatedTotal: Math.round(lineTotal * 100) / 100,
  };
}

export function syncSelectedScopePricing(
  draft: EstimateAiDraft
): EstimateAiDraft {
  if (
    !draft?.scopeMeasurements?.itemQuantities &&
    !draft?.scopeMeasurements?.pricingAcceptance
  ) {
    return recomputeClientDraftTotals(draft);
  }
  const nextDraft = { ...draft };
  if (draft.scopePackages?.length) {
    nextDraft.scopePackages = draft.scopePackages.map(pkg =>
      applySelectedPricingToScopePackage(pkg, draft)
    );
  }
  if (draft.rooms?.length) {
    nextDraft.rooms = draft.rooms.map(room =>
      applySelectedPricingToRoom(room, draft)
    );
  }
  return recomputeClientDraftTotals(nextDraft);
}

/** Remove a scope package/room from the Step 3 draft and drop its Confirm Scope pricing. */
export function removeScopePackageFromDraft(
  draft: EstimateAiDraft,
  packageName: string
): EstimateAiDraft {
  const name = String(packageName || '').trim();
  if (!draft || !name) return draft;

  const matchPkg = (pkg: { name?: string | null; scope?: string | null }) =>
    pkg.name === name || pkg.scope === name;

  const removed =
    (draft.scopePackages || []).find(matchPkg) ||
    (draft.rooms || []).find(matchPkg) ||
    null;
  const ruleKey =
    (removed as { checklistItemId?: string | null } | null)?.checklistItemId ||
    lookupRuleKeyForPackage(removed?.name || name, removed?.scope || '') ||
    null;

  const nextScopePackages = (draft.scopePackages || []).filter(
    pkg => !matchPkg(pkg)
  );
  const nextRooms = (draft.rooms || []).filter(room => !matchPkg(room));

  let nextMeasurements = draft.scopeMeasurements;
  if (ruleKey && draft.scopeMeasurements) {
    const itemQuantities = {
      ...(draft.scopeMeasurements.itemQuantities || {}),
    };
    delete itemQuantities[ruleKey];
    delete itemQuantities[`${ruleKey}__material`];
    delete itemQuantities[`${ruleKey}__labor`];
    delete itemQuantities[`${ruleKey}__allowance`];
    const pricingAcceptance = {
      ...(draft.scopeMeasurements.pricingAcceptance || {}),
    };
    delete pricingAcceptance[ruleKey];
    nextMeasurements = {
      ...draft.scopeMeasurements,
      itemQuantities,
      pricingAcceptance,
    };
  }

  let nextChecklist = draft.scopeChecklist;
  if (ruleKey && draft.scopeChecklist?.items?.length) {
    nextChecklist = {
      ...draft.scopeChecklist,
      items: draft.scopeChecklist.items.map(item =>
        item.id === ruleKey
          ? {
              ...item,
              state: 'excluded',
              choiceId:
                item.inputType === 'choice' ? 'not_in_scope' : item.choiceId,
            }
          : item
      ),
    };
  }

  const nextDraft: EstimateAiDraft = {
    ...draft,
    scopePackages: draft.scopePackages?.length
      ? nextScopePackages
      : draft.scopePackages,
    rooms: nextRooms,
    scopeMeasurements: nextMeasurements,
    scopeChecklist: nextChecklist,
  };

  if (nextScopePackages.length > 0) {
    return recomputeClientDraftTotals({
      ...nextDraft,
      scopePackages: nextScopePackages,
    });
  }

  // Rooms-only drafts: recompute from remaining rooms.
  let lineTotal = 0;
  for (const room of nextRooms) {
    lineTotal += packageMoneyTotal(room);
  }
  const rounded = Math.round(lineTotal * 100) / 100;
  return {
    ...nextDraft,
    calculatedLineItemTotal: rounded > 0 ? rounded : 0,
    calculatedTotal: rounded > 0 ? rounded : 0,
  };
}

export function roomIsApplyEligible(
  room: EstimateDraftRoom,
  draft: EstimateAiDraft,
  applyConfirmedOnly = false
): boolean {
  const pkg = getScopePackageForRoom(draft, room.name);
  if (pkg?.status === 'missing_price') return false;
  if (
    applyConfirmedOnly &&
    (pkg?.status === 'ai_suggested' || pkg?.status === 'rough_price') &&
    !pkg?.applyEligible &&
    !pkg?.priceProvidedByUser &&
    !room.applyEligible &&
    !room.priceProvidedByUser
  ) {
    return false;
  }
  if (pkg?.applyEligible || room.applyEligible) return true;
  if (room.price != null && room.price > 0) return true;
  if ((pkg?.knownSubtotal || room.knownSubtotal || 0) > 0) return true;
  return false;
}

/** Resolve effective room pricing for apply (respects split approval). */
export function resolveRoomForApply(
  room: EstimateDraftRoom,
  draft: EstimateAiDraft
): EstimateDraftRoom {
  const applySplits = Boolean(draft.applySuggestedSplits);
  if (
    room.splitIsSuggested &&
    room.laborPrice != null &&
    room.materialPrice != null &&
    applySplits
  ) {
    return { ...room, splitApprovedByUser: true };
  }

  const approvedPreview = (draft.suggestedSplits || []).find(
    s => s.parentItemName === room.name && s.approvedByUser && s.previewOnly
  );
  if (approvedPreview && applySplits) {
    return {
      ...room,
      laborPrice: approvedPreview.suggestedLabor,
      materialPrice: approvedPreview.suggestedMaterials,
      priceIncludesLaborAndMaterials: false,
      splitIsSuggested: true,
      splitApprovedByUser: true,
    };
  }

  if (room.splitIsSuggested && !applySplits) {
    return {
      ...room,
      laborPrice: null,
      materialPrice: null,
      priceIncludesLaborAndMaterials: true,
    };
  }

  return room;
}

/** Job notes blob for scope parsing — prefers originalNotes, then description / rooms. */
export function resolveDraftScopeNotes(
  draft:
    | {
        originalNotes?: string | null;
        projectDescription?: string | null;
        contractScope?: string | null;
        rooms?: Array<{ name?: string; scope?: string }>;
        scopeChecklist?: { intro?: string } | null;
      }
    | null
    | undefined
): string {
  const direct = String(draft?.originalNotes || '').trim();
  if (direct) return direct;

  const parts: string[] = [];
  const desc = String(draft?.projectDescription || '').trim();
  if (desc) parts.push(desc);
  const contract = String(draft?.contractScope || '').trim();
  if (contract) parts.push(contract);
  for (const room of draft?.rooms || []) {
    const body = String(room?.scope || '').trim();
    if (!body) continue;
    const header = String(room?.name || '').trim();
    parts.push(header ? `${header}\n${body}` : body);
  }
  if (!parts.length) {
    const intro = String(draft?.scopeChecklist?.intro || '').trim();
    if (intro) parts.push(intro);
  }
  return parts.join('\n\n').trim();
}

function buildScopeDescription(draft: EstimateAiDraft): string {
  const parts: string[] = [];

  if (draft.projectDescription) {
    parts.push(draft.projectDescription.trim());
  }

  if (draft.contractScope) {
    parts.push(draft.contractScope.trim());
  }

  const useChecklistScopeOrder =
    draft.scopeAssumptionsConfirmed ||
    (draft.confirmedAssumptions?.length ?? 0) > 0;
  if (useChecklistScopeOrder) {
    const packages = getScopePackages(draft);
    if (packages.length > 0) {
      const roomBlocks = packages.map(pkg => {
        const header = String(pkg.name || '').trim();
        const body = String(pkg.scope || '').trim();
        return body ? `${header}\n${body}` : header;
      });
      parts.push(roomBlocks.join('\n\n'));
    }
  } else {
    const rooms = draft.rooms || [];
    if (rooms.length > 0) {
      const roomBlocks = rooms.map(room => {
        const header = room.name.trim();
        const body = room.scope.trim();
        return body ? `${header}\n${body}` : header;
      });
      parts.push(roomBlocks.join('\n\n'));
    }
  }

  const allowances = draft.allowances || [];
  if (allowances.length > 0) {
    const allowanceLines = allowances.map(allowance => {
      const label = allowance.name || allowance.description || 'Allowance';
      const rate = allowance.rate ?? allowance.amount;
      const amount =
        rate != null
          ? formatDraftMoney(rate) +
            (allowance.unit ? ` ${allowance.unit}` : '')
          : allowance.unit || '';
      const calc =
        allowance.calculatedAmount != null
          ? ` → ${formatDraftMoney(allowance.calculatedAmount)}`
          : '';
      const detail = allowance.description?.trim();
      return [label, amount, calc, detail].filter(Boolean).join(' — ');
    });
    parts.push(
      ['Allowances', ...allowanceLines.map(line => `• ${line}`)].join('\n')
    );
  }

  const inclusions = draft.inclusions || [];
  if (inclusions.length > 0) {
    parts.push(
      ['Inclusions', ...inclusions.map(line => `• ${line}`)].join('\n')
    );
  }

  const exclusions = draft.exclusions || [];
  if (exclusions.length > 0) {
    parts.push(
      ['Exclusions', ...exclusions.map(line => `• ${line}`)].join('\n')
    );
  }

  const measurementLines = confirmedPaintingMeasurementTextLines(
    draft.scopeMeasurements as Record<string, unknown> | null | undefined
  );
  if (measurementLines.length > 0) {
    parts.push(
      [
        'Confirmed measurements',
        ...measurementLines.map(line => `• ${line}`),
      ].join('\n')
    );
  }

  return parts.filter(Boolean).join('\n\n').trim();
}

function laborPortion(room: EstimateDraftRoom): number {
  if (room.laborPrice != null) return room.laborPrice;
  if (room.priceIncludesLaborAndMaterials && room.price != null)
    return room.price;
  if (room.price != null) return room.price;
  return 0;
}

function materialPortion(room: EstimateDraftRoom): number {
  if (room.materialPrice != null) return room.materialPrice;
  return 0;
}

function parsedNoteSplitForPackage(
  pkg: EstimateDraftScopePackage | undefined,
  draft: EstimateAiDraft
): {
  material: number;
  labor: number;
  total: number;
  splitIsSuggested?: boolean;
} | null {
  if (!pkg) return null;
  const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
  if (!breakdown) return null;
  if (breakdown.material <= 0 && breakdown.labor <= 0) return null;

  const isSuggested =
    breakdown.materialSource === 'suggested' &&
    breakdown.laborSource === 'suggested';
  const hasApprovedPkgSplit =
    Number(pkg.materialPrice ?? 0) > 0 && Number(pkg.laborPrice ?? 0) > 0;
  if (isSuggested && !draft.applySuggestedSplits && !hasApprovedPkgSplit) {
    return null;
  }

  return {
    material: breakdown.material,
    labor: breakdown.labor,
    total: breakdown.total,
    splitIsSuggested: isSuggested && !hasApprovedPkgSplit,
  };
}

function laborDescription(
  room: EstimateDraftRoom,
  pkg?: EstimateDraftScopePackage,
  parsedSplit?: { splitIsSuggested?: boolean } | null
): string {
  const scope = room.scope?.trim() || room.name;
  const parts = [scope];
  if (pkg?.status === 'partial_pricing') {
    const priced = (pkg.pricingItems || [])
      .filter(i => i.amount != null && i.amount > 0)
      .map(
        i =>
          `• ${i.name}: ${formatDraftMoney(i.amount)}${i.status === 'rough_price' ? ' (rough)' : ''}`
      )
      .join('\n');
    if (priced) parts.push(`\nKnown pricing from notes:\n${priced}`);
    const missing = (pkg.missingPriceItems || [])
      .slice(0, 8)
      .map(m => `• ${m}`)
      .join('\n');
    if (missing) {
      parts.push(
        `\nStill needs pricing (not included in line total):\n${missing}`
      );
    }
    parts.push(
      '\n(Partial package — add remaining scope on Labor/Materials steps.)'
    );
  }
  if (parsedSplit) {
    parts.push(
      parsedSplit.splitIsSuggested
        ? '\n(National Average budget split applied — review on Labor step.)'
        : '\n(Material/labor split from notes — review on Labor step.)'
    );
  } else if (room.splitIsSuggested && room.splitApprovedByUser) {
    parts.push('\n(AI-suggested labor split — review on Labor step.)');
  } else if (room.priceIncludesLaborAndMaterials && !room.splitIsSuggested) {
    parts.push(
      '\n(Price from notes includes labor and materials — split on steps if needed.)'
    );
  }
  return parts.join('');
}

function effectiveLaborTotal(
  room: EstimateDraftRoom,
  pkg: EstimateDraftScopePackage | undefined,
  draft: EstimateAiDraft
): number | null {
  const resolved = resolveRoomForApply(room, draft);
  const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
  if (parsedSplit) {
    return parsedSplit.labor > 0 ? parsedSplit.labor : null;
  }
  if (pkg) {
    return laborAmountForPackage(
      pkg,
      null,
      Boolean(draft.applySuggestedSplits)
    );
  }
  if (resolved.priceIncludesLaborAndMaterials && !resolved.splitIsSuggested) {
    const total = Number(resolved.price) || 0;
    return total > 0 ? total : null;
  }
  const total = laborPortion(resolved);
  return total > 0 ? total : null;
}

function packageHasAppliedOrUserPricing(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): boolean {
  if (
    pkg.priceProvidedByUser ||
    pkg.status === 'user_provided' ||
    pkg.priceSource === 'user_provided'
  ) {
    return true;
  }

  const ruleKey =
    pkg.checklistItemId ||
    lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '') ||
    null;
  if (!ruleKey) {
    // Off-checklist Ask AI rows (e.g. Disposal Bid) may rely on applyEligible.
    return Boolean(pkg.applyEligible);
  }

  // Checklist rows must have Confirm Scope Applied pricing — do not trust
  // applyEligible alone (AI drafts often mark confirmed packages eligible).
  return hasAcceptedScopePricing(
    ruleKey,
    draft.scopeMeasurements?.itemQuantities || {},
    draft.scopeMeasurements?.pricingAcceptance
  );
}

function packageIsOnConfirmScopeChecklist(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): boolean {
  const ruleKey =
    pkg.checklistItemId ||
    lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '') ||
    null;
  if (!ruleKey) return false;
  const items = confirmScopeDisplayItemsFromDraft(draft);
  return items.some(item => item.id === ruleKey && checklistItemInScope(item));
}

function packageIsApplyEligible(
  pkg: EstimateDraftScopePackage,
  applyConfirmedOnly: boolean,
  draft?: EstimateAiDraft
): boolean {
  if (pkg.status === 'missing_price') return false;
  // Approved rough/AI pricing is apply-eligible once the user confirmed it in Step 3.
  if (
    applyConfirmedOnly &&
    (pkg.status === 'ai_suggested' || pkg.status === 'rough_price') &&
    !pkg.applyEligible &&
    !pkg.priceProvidedByUser
  ) {
    return false;
  }
  // Apply Confirmed Only must match Step 3 — skip checklist rows without Applied pricing.
  if (
    applyConfirmedOnly &&
    draft &&
    packageIsOnConfirmScopeChecklist(pkg, draft)
  ) {
    return packageHasAppliedOrUserPricing(pkg, draft);
  }
  if (pkg.applyEligible) return true;
  if (
    pkg.priceProvidedByUser ||
    pkg.status === 'user_provided' ||
    pkg.priceSource === 'user_provided'
  ) {
    return true;
  }
  const amount = pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0;
  return amount > 0;
}

function packageAllowanceAmount(pkg: EstimateDraftScopePackage): number {
  const amount = Number(
    pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0
  );
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function packageRuleKeyForApply(pkg: {
  checklistItemId?: string | null;
  name?: string | null;
  scope?: string | null;
}): string | null {
  return (
    pkg.checklistItemId ||
    lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '') ||
    null
  );
}

/** Scope rows for apply — synced scopePackages plus Ask AI rooms missing from scopePackages. */
function resolveDraftPackagesForApply(
  draft: EstimateAiDraft,
  applyConfirmedOnly = false
): EstimateDraftScopePackage[] {
  const rawPackages = [...getScopePackages(draft)];
  const preferredDrywallIndex = rawPackages.findIndex(
    pkg => packageRuleKeyForApply(pkg) === 'drywall'
  );
  const packages = rawPackages.filter((pkg, index, all) => {
    // `patch_repair` and `drywall` are sibling IDs for the same physical
    // trade. Older AI drafts can retain both packages after the checklist
    // normalizes them to one Drywall / patching line, which duplicated that
    // line in Step 3 while Confirm Scope counted it once.
    const ruleKey = packageRuleKeyForApply(pkg);
    if (ruleKey !== 'patch_repair' && ruleKey !== 'drywall') return true;
    // Prefer the canonical checklist ID when both legacy siblings exist.
    if (preferredDrywallIndex >= 0) return index === preferredDrywallIndex;
    return (
      index ===
      all.findIndex(candidate => {
        const candidateKey = packageRuleKeyForApply(candidate);
        return candidateKey === 'patch_repair' || candidateKey === 'drywall';
      })
    );
  });
  if (!draft.rooms?.length) return packages;

  const seenNames = new Set(
    packages
      .map(p =>
        String(p.name || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );
  const seenRuleKeys = new Set(
    packages.map(p => packageRuleKeyForApply(p)).filter(Boolean) as string[]
  );
  const confirmedFromScope = Boolean(
    draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length
  );
  const merged = [...packages];

  for (const room of draft.rooms) {
    const key = String(room.name || '')
      .trim()
      .toLowerCase();
    if (!key || seenNames.has(key)) continue;

    const ruleKey =
      (room as { checklistItemId?: string | null }).checklistItemId ||
      lookupRuleKeyForPackage(room.name || '', room.scope || '') ||
      null;
    // Same checklist trade under a different room name must not apply twice.
    if (ruleKey && seenRuleKeys.has(ruleKey)) continue;

    if (confirmedFromScope && applyConfirmedOnly) {
      const userOwned = Boolean(
        room.priceProvidedByUser || room.packageStatus === 'user_provided'
      );
      if (!userOwned) continue;
      // Checklist coverage comes from reconciled packages only after Confirm Scope.
      if (
        ruleKey &&
        packageIsOnConfirmScopeChecklist(
          { name: room.name, scope: room.scope, checklistItemId: ruleKey },
          draft
        )
      ) {
        continue;
      }
    }

    merged.push(
      applySelectedPricingToScopePackage(
        {
          name: room.name,
          scope: room.scope,
          scopeQuantities: room.scopeQuantities,
          price: room.price,
          laborPrice: room.laborPrice,
          materialPrice: room.materialPrice,
          pricingType: room.price != null ? 'lump_sum' : 'unknown',
          includesLabor: room.priceIncludesLaborAndMaterials
            ? true
            : room.laborPrice != null
              ? true
              : null,
          includesMaterials:
            room.materialPrice != null
              ? true
              : room.priceIncludesLaborAndMaterials
                ? true
                : null,
          priceSource: room.priceProvidedByUser ? 'user_provided' : 'missing',
          status: (room.packageStatus ||
            (room.price != null
              ? 'user_provided'
              : room.knownSubtotal
                ? 'partial_pricing'
                : 'missing_price')) as DraftItemStatus,
          knownSubtotal: room.knownSubtotal ?? null,
          priceProvidedByUser: room.priceProvidedByUser,
          priceIncludesLaborAndMaterials: room.priceIncludesLaborAndMaterials,
          missingPriceItems: room.missingPriceItems || [],
          pricingItems: room.pricingItems || [],
          checklistItemId: ruleKey,
        } as EstimateDraftScopePackage,
        draft
      )
    );
    seenNames.add(key);
    if (ruleKey) seenRuleKeys.add(ruleKey);
  }
  return merged;
}

function resolvePackageCostCode(
  pkg: EstimateDraftScopePackage | null | undefined,
  name?: string,
  scope?: string
): string | undefined {
  if (pkg?.costCode) return String(pkg.costCode);
  if (pkg?.checklistItemId) return String(pkg.checklistItemId);
  const ruleKey = lookupRuleKeyForPackage(
    name || pkg?.name || '',
    scope || pkg?.scope || ''
  );
  return ruleKey || undefined;
}

function allowanceLineItemsFromDraft(
  draft: EstimateAiDraft,
  applyConfirmedOnly: boolean
): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];

  for (const pkg of resolveDraftPackagesForApply(draft, applyConfirmedOnly)) {
    if (!packageIsApplyEligible(pkg, applyConfirmedOnly, draft)) continue;
    if (!isSoftCostScopePackage(pkg, draft)) continue;
    const total = packageAllowanceAmount(pkg);
    if (total <= 0) continue;
    const ruleKey = resolvePackageCostCode(pkg);
    lines.push({
      id: newLineItemId(),
      name: pkg.name,
      description: pkg.scope?.trim() || 'Soft-cost allowance',
      amount: total,
      total,
      totalCost: total,
      category: 'Allowance',
      section: pkg.name,
      source: 'ai-draft',
      sourceItemId: ruleKey,
      costCode: ruleKey,
      checklistItemId: ruleKey,
      priceProvidedByUser: true,
    });
  }
  return lines;
}

function laborDescriptionForPackage(
  pkg: EstimateDraftScopePackage,
  parsedSplit?: { splitIsSuggested?: boolean } | null
): string {
  const parts = [pkg.scope?.trim() || pkg.name];
  if (parsedSplit) {
    parts.push(
      parsedSplit.splitIsSuggested
        ? '\n(National Average budget split applied — review on Labor step.)'
        : '\n(Material/labor split from notes — review on Labor step.)'
    );
  } else if (
    pkg.priceIncludesLaborAndMaterials ||
    (pkg.includesLabor && pkg.includesMaterials)
  ) {
    parts.push(
      '\n(Price from notes includes labor and materials — split on steps if needed.)'
    );
  }
  return parts.join('');
}

function budgetSplitDisplaySubtitle(
  parsedSplit: { splitIsSuggested?: boolean } | null | undefined,
  type: 'material' | 'labor'
): string | null {
  if (!parsedSplit) return null;
  if (parsedSplit.splitIsSuggested) {
    return type === 'material'
      ? 'National Average material budget split'
      : 'National Average labor remainder';
  }
  return type === 'material'
    ? SCOPE_MATERIAL_PARSED_FROM_NOTES_LABEL
    : SCOPE_LABOR_PARSED_FROM_NOTES_LABEL;
}

/** True when package material/labor fields are only a suggested national split, not confirmed. */
function packageSplitIsSuggestedOnly(pkg: EstimateDraftScopePackage): boolean {
  if (pkg.splitIsSuggested) return true;
  // Approved rough proposals store real material/labor — those are confirmed, not suggested.
  if (pkg.priceSource === 'ai_rough_estimate' && pkg.applyEligible)
    return false;
  if (
    pkg.priceSource === 'manual' ||
    pkg.priceSource === 'user' ||
    pkg.priceSource === 'user_provided'
  ) {
    return false;
  }
  return false;
}

/** Labor amount for a package without double-counting material already on the package. */
function laborAmountForPackage(
  pkg: EstimateDraftScopePackage,
  parsedSplit: {
    labor: number;
    material?: number;
    splitIsSuggested?: boolean;
  } | null,
  applySuggestedSplits = false
): number {
  const pkgPrice = Number(
    pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0
  );

  if (
    parsedSplit &&
    (parsedSplit.labor > 0 || (parsedSplit.material || 0) > 0)
  ) {
    if (parsedSplit.splitIsSuggested && !applySuggestedSplits) {
      return pkgPrice > 0 ? pkgPrice : 0;
    }
    const splitMat = Number(parsedSplit.material || 0);
    const splitLab = Number(parsedSplit.labor || 0);
    const splitTotal = splitMat + splitLab;
    // Confirmed split may be only a portion (Step 3 puts the rest in Allowances).
    // Keep the remainder on labor so the package total is preserved.
    if (pkgPrice > splitTotal + 1) {
      return Math.max(0, splitLab + (pkgPrice - splitTotal));
    }
    return splitLab > 0 ? splitLab : 0;
  }

  // Unconfirmed suggested splits stay as a combined trade package (Step 3 Allowances).
  if (packageSplitIsSuggestedOnly(pkg) && !applySuggestedSplits) {
    return pkgPrice > 0 ? pkgPrice : 0;
  }
  const pkgLab = Number(pkg.laborPrice ?? 0);
  const pkgMat = Number(pkg.materialPrice ?? 0);
  const materialFromItems = (pkg.pricingItems || [])
    .filter(i => i.pricingType === 'material' && (i.amount || 0) > 0)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const separateMaterial = pkgMat > 0 ? pkgMat : materialFromItems;

  // Explicit labor+material split on the package.
  if (pkgLab > 0 && separateMaterial > 0) {
    const splitTotal = pkgLab + separateMaterial;
    if (pkgPrice > splitTotal + 1) {
      return Math.max(0, pkgLab + (pkgPrice - splitTotal));
    }
    // laborPrice sometimes stores the combined total — never add materials on top of that.
    if (pkgPrice > 0 && Math.abs(pkgLab - pkgPrice) <= 1) {
      return Math.max(0, pkgPrice - separateMaterial);
    }
    return pkgLab;
  }
  if (pkgLab > 0) return pkgLab;

  // If materials are priced separately, labor is the remainder — never the full package total.
  if (separateMaterial > 0 && pkgPrice > separateMaterial) {
    return Math.max(0, pkgPrice - separateMaterial);
  }
  if (pkgPrice > 0) return pkgPrice;
  const laborFromItems = (pkg.pricingItems || [])
    .filter(i => i.pricingType === 'labor' && (i.amount || 0) > 0)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  return laborFromItems > 0 ? laborFromItems : 0;
}

/** Material amount for a package — only confirmed Step 2–3 splits, not invented national averages. */
function materialAmountForPackage(
  pkg: EstimateDraftScopePackage,
  parsedSplit: { material: number; splitIsSuggested?: boolean } | null,
  applySuggestedSplits = false
): number {
  if (parsedSplit && parsedSplit.material > 0) {
    if (parsedSplit.splitIsSuggested && !applySuggestedSplits) return 0;
    return parsedSplit.material;
  }
  if (packageSplitIsSuggestedOnly(pkg) && !applySuggestedSplits) return 0;
  const pkgMat = Number(pkg.materialPrice ?? 0);
  if (pkgMat > 0) return pkgMat;
  return 0;
}

const PHYSICAL_LINE_ITEM_UNITS = new Set([
  'sqft',
  'sf',
  'lf',
  'each',
  'ea',
  'cy',
  'squares',
  'ton',
  'tons',
]);

function physicalQuantityFromPackage(
  pkg: EstimateDraftScopePackage
): { quantity: number; unit: string } | null {
  const q = pkg.scopeQuantities?.[0] || pkg.budgetSplitBasis || null;
  if (!q) return null;
  const qty = Number(q.quantity);
  const unit = String(q.unit || '').toLowerCase();
  if (!(qty > 0) || !PHYSICAL_LINE_ITEM_UNITS.has(unit)) return null;
  return { quantity: qty, unit };
}

function catalogUnitToLineItemUnit(unit: string): string {
  const u = String(unit || '').toLowerCase();
  if (u === 'sqft' || u === 'sf' || u === 'sq ft') return 'sq ft';
  if (u === 'lf') return 'lf';
  if (u === 'ea' || u === 'each') return 'each';
  return u;
}

function laborLineItemsFromDraft(
  draft: EstimateAiDraft,
  applyConfirmedOnly: boolean
): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  const applySuggestedSplits = Boolean(draft.applySuggestedSplits);

  for (const pkg of resolveDraftPackagesForApply(draft, applyConfirmedOnly)) {
    if (!packageIsApplyEligible(pkg, applyConfirmedOnly, draft)) continue;
    if (isSoftCostScopePackage(pkg, draft)) continue;

    const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
    const total = laborAmountForPackage(pkg, parsedSplit, applySuggestedSplits);
    if (total <= 0) continue;

    const splitMaterial = materialAmountForPackage(
      pkg,
      parsedSplit,
      applySuggestedSplits
    );
    const materialFromItems =
      splitMaterial > 0
        ? 0
        : (pkg.pricingItems || [])
            .filter(i => i.pricingType === 'material' && (i.amount || 0) > 0)
            .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const hasSeparateMaterial = splitMaterial > 0 || materialFromItems > 0;
    const isCombinedOnly =
      !hasSeparateMaterial &&
      (pkg.priceIncludesLaborAndMaterials ||
        (pkg.includesLabor && pkg.includesMaterials) ||
        (packageSplitIsSuggestedOnly(pkg) && !applySuggestedSplits));
    const costCode = resolvePackageCostCode(pkg);
    const physical = physicalQuantityFromPackage(pkg);
    const hours = physical ? physical.quantity : 1;
    const lineUnit = physical
      ? catalogUnitToLineItemUnit(physical.unit)
      : undefined;
    lines.push({
      id: newLineItemId(),
      name: pkg.name,
      description: laborDescriptionForPackage(pkg, parsedSplit),
      hours,
      quantity: hours,
      qty: hours,
      unit: lineUnit,
      mode: lineUnit === 'sq ft' ? 'sqft' : undefined,
      rate: total,
      total,
      totalCost: total,
      category: isCombinedOnly ? 'Trade package' : 'Labor',
      section: pkg.name,
      source: 'ai-draft',
      sourceItemId: costCode,
      costCode,
      checklistItemId: costCode,
      priceProvidedByUser: true,
      priceIncludesLaborAndMaterials: isCombinedOnly,
      splitIsSuggested: Boolean(
        parsedSplit?.splitIsSuggested || pkg.splitIsSuggested
      ),
      displaySubtitle: budgetSplitDisplaySubtitle(parsedSplit, 'labor'),
      partialPricing: pkg.status === 'partial_pricing',
    });
  }

  return lines;
}

function materialLineItemsFromDraft(
  draft: EstimateAiDraft,
  applyConfirmedOnly: boolean
): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  const applySuggestedSplits = Boolean(draft.applySuggestedSplits);

  for (const pkg of resolveDraftPackagesForApply(draft, applyConfirmedOnly)) {
    if (!packageIsApplyEligible(pkg, applyConfirmedOnly, draft)) continue;
    if (isSoftCostScopePackage(pkg, draft)) continue;

    const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
    const splitMaterial = materialAmountForPackage(
      pkg,
      parsedSplit,
      applySuggestedSplits
    );
    const splitIsSuggested =
      parsedSplit?.splitIsSuggested ?? Boolean(pkg.splitIsSuggested);
    const costCode = resolvePackageCostCode(pkg);
    const physical = physicalQuantityFromPackage(pkg);
    const qty = physical ? physical.quantity : 1;
    const unit = physical ? catalogUnitToLineItemUnit(physical.unit) : 'lot';

    if (splitMaterial > 0) {
      lines.push({
        id: newLineItemId(),
        name: `${pkg.name} — materials`,
        description: splitIsSuggested
          ? `Suggested materials split for ${pkg.name} — adjust after applying.`
          : `Materials for ${pkg.name}`,
        quantity: qty,
        qty,
        unit,
        mode: unit === 'sq ft' ? 'sqft' : undefined,
        unitPrice: qty > 0 ? splitMaterial / qty : splitMaterial,
        cost: qty > 0 ? splitMaterial / qty : splitMaterial,
        total: splitMaterial,
        section: pkg.name,
        source: 'ai-draft',
        sourceItemId: costCode,
        costCode,
        checklistItemId: costCode,
        isManual: true,
        displaySubtitle: budgetSplitDisplaySubtitle(parsedSplit, 'material'),
      });
      continue;
    }

    if (pkg.pricingItems?.length) {
      for (const item of pkg.pricingItems) {
        if (
          item.pricingType !== 'material' ||
          item.amount == null ||
          item.amount <= 0
        )
          continue;
        if (
          applyConfirmedOnly &&
          item.status === 'ai_suggested' &&
          !item.approvedByUser
        )
          continue;
        lines.push({
          id: newLineItemId(),
          name: `${pkg.name} — ${item.name}`,
          description:
            item.description ||
            `${SCOPE_PARSED_FROM_NOTES_LABEL} (${item.status || 'confirmed'})`,
          quantity: qty,
          qty,
          unit,
          mode: unit === 'sq ft' ? 'sqft' : undefined,
          unitPrice: qty > 0 ? item.amount / qty : item.amount,
          cost: qty > 0 ? item.amount / qty : item.amount,
          total: item.amount,
          section: pkg.name,
          source: 'ai-draft',
          sourceItemId: costCode,
          costCode,
          checklistItemId: costCode,
          isManual: true,
        });
      }
    }
  }

  return lines;
}

function cartItemFromMaterialLine(
  item: Record<string, unknown>
): Record<string, unknown> {
  const qty = Number(item.quantity || item.qty || 1);
  const unitPrice = Number(item.unitPrice || item.cost || 0);
  const total = Number(item.total) || qty * unitPrice;
  return {
    ...item,
    id: item.id || newLineItemId(),
    name: item.name || item.description || 'Material',
    description: item.description || item.name || 'Material',
    quantity: qty,
    qty,
    unitPrice,
    cost: Number(item.cost) || unitPrice,
    total,
    unit: item.unit || 'ea',
    section: item.section || 'General Materials',
    isManual: item.isManual ?? true,
  };
}

export function applyDraftToEstimate(
  bid: Record<string, unknown>,
  draft: EstimateAiDraft,
  options: ApplyDraftOptions = {}
): ApplyDraftResult {
  draft = syncSelectedScopePricing(draft);
  if (options.scopeOnly) {
    return applyScopeDraftOnly(bid, draft);
  }

  const applyConfirmedOnly = Boolean(options.applyConfirmedOnly);
  const draftForApply: EstimateAiDraft = {
    ...draft,
    // Never invent National Average splits on apply unless the user opted in.
    applySuggestedSplits:
      options.applySuggestedSplits ?? Boolean(draft.applySuggestedSplits),
  };

  const projectType = draftForApply.projectType || 'other';
  const category =
    PROJECT_CATEGORY_SLUGS[projectType] || PROJECT_CATEGORY_SLUGS.other;
  const scopeDescription = buildScopeDescription(draftForApply);
  const laborLineItems = laborLineItemsFromDraft(
    draftForApply,
    applyConfirmedOnly
  );
  const materialLineItems = materialLineItemsFromDraft(
    draftForApply,
    applyConfirmedOnly
  );
  const allowanceLineItems = allowanceLineItemsFromDraft(
    draftForApply,
    applyConfirmedOnly
  );
  const materialsCart = materialLineItems.map(cartItemFromMaterialLine);
  const tradeBudgetRollup = tradeBudgetRollupFromEstimate({
    laborLineItems,
    materialLineItems,
    allowanceLineItems,
  });

  const nextBid: Record<string, unknown> = {
    ...bid,
    _isNewBid: false,
    title: draftForApply.projectTitle?.trim() || bid.title || '',
    projectType,
    projectCategory: category,
    category,
    scopeDescription: scopeDescription || bid.scopeDescription || '',
    laborLineItems,
    materialLineItems,
    allowanceLineItems,
    tradeBudgetRollup,
    aiEstimateOriginalNotes: draftForApply.originalNotes || null,
    aiEstimateDraftSnapshot: {
      savedAt: new Date().toISOString(),
      builderMode: draftForApply.builderMode || 'organize_calculate',
      draft: draftForApply,
    },
  };

  if (draftForApply.customerName?.trim()) {
    nextBid.customerName = draftForApply.customerName.trim();
    nextBid.clientName = draftForApply.customerName.trim();
  }

  return { bid: nextBid, materialsCart };
}

/** Saves scope and project context without applying labor/material pricing. */
export function applyScopeDraftOnly(
  bid: Record<string, unknown>,
  draft: EstimateAiDraft
): ApplyDraftResult {
  const scopeDescription = buildScopeDescription(draft);
  const nextBid: Record<string, unknown> = {
    ...bid,
    _isNewBid: false,
    title: draft.projectTitle?.trim() || bid.title || '',
    projectType: draft.projectType || bid.projectType || 'other',
    scopeDescription: scopeDescription || bid.scopeDescription || '',
    aiEstimateOriginalNotes: draft.originalNotes || null,
    aiEstimateDraftSnapshot: {
      savedAt: new Date().toISOString(),
      builderMode: draft.builderMode || 'organize_only',
      applyMode: 'scope_only',
      draft,
    },
  };

  if (draft.customerName?.trim()) {
    nextBid.customerName = draft.customerName.trim();
    nextBid.clientName = draft.customerName.trim();
  }

  return { bid: nextBid, materialsCart: [] };
}

export type TradeBudgetRollupLine = {
  costCode: string;
  label: string;
  material: number;
  labor: number;
  allowance: number;
  total: number;
};

/**
 * Group applied estimate lines by Confirm Scope cost code for Projects
 * trade budgets (materials + labor + allowances per trade).
 */
export function tradeBudgetRollupFromEstimate(bid: {
  laborLineItems?: Array<Record<string, unknown>> | null;
  materialLineItems?: Array<Record<string, unknown>> | null;
  allowanceLineItems?: Array<Record<string, unknown>> | null;
}): TradeBudgetRollupLine[] {
  const byCode = new Map<string, TradeBudgetRollupLine>();

  const ensure = (rawCode: unknown, label: string): TradeBudgetRollupLine => {
    const costCode =
      String(rawCode || label || 'uncategorized').trim() || 'uncategorized';
    let row = byCode.get(costCode);
    if (!row) {
      row = { costCode, label, material: 0, labor: 0, allowance: 0, total: 0 };
      byCode.set(costCode, row);
    }
    return row;
  };

  for (const item of bid.materialLineItems || []) {
    const amount = Number(item.total ?? item.cost ?? item.unitPrice ?? 0) || 0;
    if (amount <= 0) continue;
    const label = String(item.section || item.name || 'Materials');
    const row = ensure(
      item.costCode || item.sourceItemId || item.checklistItemId,
      label
    );
    row.material += amount;
    row.total += amount;
  }

  for (const item of bid.laborLineItems || []) {
    const amount = Number(item.total ?? item.totalCost ?? item.rate ?? 0) || 0;
    if (amount <= 0) continue;
    const label = String(item.section || item.name || 'Labor');
    const row = ensure(
      item.costCode || item.sourceItemId || item.checklistItemId,
      label
    );
    row.labor += amount;
    row.total += amount;
  }

  for (const item of bid.allowanceLineItems || []) {
    const amount =
      Number(item.amount ?? item.total ?? item.totalCost ?? 0) || 0;
    if (amount <= 0) continue;
    const label = String(item.section || item.name || 'Allowance');
    const row = ensure(
      item.costCode || item.sourceItemId || item.checklistItemId,
      label
    );
    row.allowance += amount;
    row.total += amount;
  }

  return Array.from(byCode.values()).sort((a, b) =>
    a.costCode.localeCompare(b.costCode)
  );
}

export function draftHasApprovedSuggestions(
  draft: EstimateAiDraft | null
): boolean {
  if (!draft) return false;
  const approvedSplit = (draft.suggestedSplits || []).some(
    s => s.approvedByUser
  );
  const approvedRoom = (draft.rooms || []).some(r => r.splitApprovedByUser);
  return approvedSplit || approvedRoom;
}

/** Step 3 inline edits → Confirm Scope itemQuantities for back-navigation restore. */
export function syncConfirmScopeMeasurementsFromPackages(
  draft: EstimateAiDraft
): EstimateAiDraft {
  if (!draft.scopePackages?.length) return draft;

  const itemQuantities = { ...(draft.scopeMeasurements?.itemQuantities || {}) };
  let changed = false;

  for (const pkg of draft.scopePackages) {
    if (pkg.status === 'missing_price') continue;
    if (
      !pkg.priceProvidedByUser &&
      pkg.status !== 'user_provided' &&
      pkg.priceSource !== 'manual' &&
      pkg.priceSource !== 'user_provided'
    ) {
      continue;
    }
    const ruleKey =
      pkg.checklistItemId || lookupRuleKeyForPackage(pkg.name, pkg.scope || '');
    if (!ruleKey) continue;
    const total = Number(
      pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0
    );
    if (!(total > 0)) continue;

    const mat = Number(pkg.materialPrice ?? 0);
    const lab = Number(pkg.laborPrice ?? 0);
    if (mat > 0 || lab > 0) {
      itemQuantities[`${ruleKey}__material`] = {
        quantity: String(Math.round(mat * 100) / 100),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      itemQuantities[`${ruleKey}__labor`] = {
        quantity: String(Math.round(lab * 100) / 100),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
    } else {
      itemQuantities[`${ruleKey}__allowance`] = {
        quantity: String(Math.round(total * 100) / 100),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
    }
    changed = true;
  }

  if (!changed) return draft;
  return {
    ...draft,
    scopeMeasurements: {
      ...(draft.scopeMeasurements || {}),
      itemQuantities,
    },
  };
}

export function getScopePackagesRaw(
  draft: EstimateAiDraft
): EstimateDraftScopePackage[] {
  if (draft.scopePackages?.length) {
    return draft.scopePackages.map(pkg =>
      applySelectedPricingToScopePackage(pkg, draft)
    );
  }
  return (draft.rooms || []).map(room =>
    applySelectedPricingToScopePackage(
      {
        name: room.name,
        scope: room.scope,
        scopeQuantities: room.scopeQuantities,
        price: room.price,
        laborPrice: room.laborPrice,
        materialPrice: room.materialPrice,
        pricingType: room.price != null ? 'lump_sum' : 'unknown',
        includesLabor: room.priceIncludesLaborAndMaterials
          ? true
          : room.laborPrice != null
            ? true
            : null,
        includesMaterials:
          room.materialPrice != null
            ? true
            : room.priceIncludesLaborAndMaterials
              ? true
              : null,
        priceSource: room.priceProvidedByUser ? 'user_provided' : 'missing',
        status: (room.packageStatus ||
          (room.price != null
            ? room.splitIsSuggested
              ? 'ai_suggested'
              : room.pricedFromSqftAllowances
                ? 'calculated'
                : room.priceIncludesLaborAndMaterials
                  ? 'user_provided'
                  : 'confirmed'
            : room.knownSubtotal
              ? 'partial_pricing'
              : 'missing_price')) as DraftItemStatus,
        knownSubtotal: room.knownSubtotal ?? null,
        formula: null,
        missingInfo: [],
        missingPriceItems: room.missingPriceItems || [],
        pricingItems: room.pricingItems || [],
        priceIncludesLaborAndMaterials: room.priceIncludesLaborAndMaterials,
        splitIsSuggested: Boolean(room.splitIsSuggested),
        priceProvidedByUser: Boolean(room.priceProvidedByUser),
        applyEligible:
          room.applyEligible ??
          (room.price != null || (room.knownSubtotal || 0) > 0),
      },
      draft
    )
  );
}

export function getScopePackages(
  draft: EstimateAiDraft
): EstimateDraftScopePackage[] {
  return getScopePackagesForReview(draft);
}
