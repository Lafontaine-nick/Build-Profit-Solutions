import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ScrollView as GestureScrollView,
  TouchableOpacity as GestureTouchableOpacity,
} from 'react-native-gesture-handler';
import ReliableFlowPress from '@/components/estimate/ReliableFlowPress';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { Typography } from '@/constants/Typography';
import { nativeNumericKeyboardProps, resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import AIEstimateDisclaimer from '@/components/estimate/AIEstimateDisclaimer';
import {
  SCOPE_MENTIONED_IN_NOTES_LABEL,
  SCOPE_DETECTED_FROM_PHOTOS_LABEL,
  SCOPE_PARSED_FROM_NOTES_LABEL,
  scopeLinkedToNotesSummary,
} from '@/constants/scopeNoteSourceLabels';
import type {
  EstimateAiDraft,
  PlanMeasurementConflict,
  ScopeAssumptionState,
  ScopeChecklistItem,
  ScopeMeasurements,
} from '@/utils/estimateAiDraft';
import {
  applyScopeDetectionsToChecklistItems,
  buildStuccoTradeChecklistItems,
  formatDraftMoney,
  mergeLivePlanImportIntoScopeMeasurements,
  resolveDraftScopeNotes,
  repairDraftRatePricingFromNotes,
} from '@/utils/estimateAiDraft';
import { applyPaintPricingMethodChoice } from '@/utils/subcontractorTrade/paintingPlanConvergence';
import {
  ELECTRICAL_CARDS,
  hasDetailedElectricalQuantities,
  syncElectricalScopeItems,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  PLUMBING_CARDS,
  buildPlumbingStructuredMeasurements,
  plumbingCardForItemId,
  syncPlumbingScopeItems,
  plumbingScopeSyncSignature,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  calculateProjectComplexityMultiplier,
  formatComplexityPercent,
  hasPlanProjectComplexityContext,
  hydrateProjectComplexityInputFields,
  inferProjectComplexitySettings,
  shouldApplySquareFootageComplexity,
} from '@/utils/projectComplexityAdjustments';
import {
  buildFramingStructuredMeasurements,
  shellPackageIncludesSheathing,
  syncFramingScopeItems,
} from '@/utils/subcontractorTrade/framingPlanConvergence';
import {
  applyHvacProvenanceGuardToScopeMeasurements,
  buildHvacStructuredMeasurements,
  HVAC_EQUIPMENT_TYPE_SCOPE_ITEM_IDS,
  HVAC_PLAN_REVIEW_CANONICAL_KEYS,
  hvacQuickMeasurementSourcesFromProvenance,
  syncHvacSkippedTakeoffQuickMeasurementSources,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';
import { isWindowsDoorsCountScopeItemId, syncWindowsDoorsScopeItems, WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS } from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';
import {
  describeTrimFinishLfDerivation,
  resolveTrimFinishFieldPaintIncluded,
} from '@/utils/windowsDoorsTrimFinishPricing';
import { syncGarageDoorsScopeItems } from '@/utils/subcontractorTrade/garageDoorsPlanConvergence';
import {
  reconcilePlumbingEquipmentScopeMeasurements,
  reconcileFramingScopeMeasurements,
  reconcilePlumbingLineScopeMeasurements,
} from '@/utils/planTakeoffReviewUi';
import {
  INSULATION_BATT_FACING_DEFAULT,
  INSULATION_BATT_FACING_OPTIONS,
  insulationAssemblyDuplicateRowIds,
  insulationBattFacingLabel,
  insulationBattFacingNeedsReview,
  insulationAssemblyCeilingRoofDeckConflict,
  insulationAssemblyCodeUpgradeTargets,
  insulationAssemblyRowsWithoutPricedLocation,
  applyHydratedInsulationScopeMeasurements,
  insulationMaterialTypeKey,
  isBattInsulationMaterial,
  isIncompleteInsulationAssembly,
  isPricedInsulationAssembly,
  mergeInsulationAssemblyRowsWithDrafts,
  rowsForInsulationMaterialType,
  syncInsulationAssembliesWithPlanMeasurements,
  type InsulationBattFacing,
} from '@/utils/subcontractorTrade/insulationPlanConvergence';
import { applySouthernUtahPlumbingPackageTakeoffDefaults } from '@/utils/southernUtahPlumbingComparables';
import {
  ElectricalConfirmScopeAttributesPanel,
  ElectricalQuickMeasurementTakeoff,
} from '@/components/estimate/ElectricalQuickMeasurementTakeoff';
import { PlanTakeoffConflictChooser } from '@/components/estimate/PlanTakeoffConflictChooser';
import { PlanTakeoffPendingConfirmationStrip } from '@/components/estimate/PlanTakeoffPendingConfirmationStrip';
import { OpeningTrimFinishChoiceSection } from '@/components/estimate/OpeningTrimFinishChoiceSection';
import {
  applyElectricalQuickMeasurementPatch,
  electricalConfirmScopeAttributesFromMeasurements,
  electricalScopeSyncSignature,
  restorePlanMeasurementConflict,
  unresolvedElectricalConflictFields,
} from '@/utils/electricalQuickMeasurementUi';
import {
  buildConflictResolution,
  conflictedSuggestedItemIds,
  conflictResolutionProvenanceEntry,
  parseManualConflictValue,
  shouldConfirmScopeShowPlanConflict,
  shouldSuppressPlanReviewQuickMeasurementField,
  windowsDoorsPlanReviewFieldSet,
  type PlanConflictChoice,
} from '@/utils/planMeasurementConflictUi';
import {
  checklistDisplayHelper,
  checklistDisplayLabel,
  choiceIdsToScopeState,
  createCustomScopeItem,
  resolveCustomScopeItemPlaceholder,
  groupScopeChecklistItems,
  initialScopeGroupCollapse,
  isCustomScopeChecklistItem,
  mergeScopeProgressIntoDraft,
  partitionScopeChecklistItems,
  applyKitchenScopeInferences,
  hydrateScopeChecklistFromNotes,
  applyMeasuredStuccoScopeInferences,
  suppressBathroomFalsePositiveFloorDemoScope,
  stripBathroomFalsePositiveFloorDemoQuantities,
  QUANTITY_NEEDED_LABELS_BY_TEMPLATE,
  quantityNeededLabel,
  scopeChecklistItemsForEditing,
  scopeChecklistItemsForPersist,
  restoreConfirmedChecklistItemStates,
  expandWetAreaDerivedScopeItems,
  syncWetAreaScopeFromSteppers,
  syncWetAreaTileScopeItems,
  syncWaterproofingFromTileScopeItems,
  syncWetAreaDemoScopeItems,
  syncBathroomFloorTileScopeItems,
  syncInteriorPaintScopeItems,
  WET_AREA_DEMO_EMBEDDED_IDS,
  ensureGroundUpFlatworkScopeCard,
  ensureGroundUpOpeningScopeCards,
  WET_AREA_DERIVED_ITEM_IDS,
  scopeChecklistSummaryCounts,
  listScopeItemsNeedingConfirmation,
  finalizeDrywallScopeChecklistLayout,
  stripStandaloneDrywallTextureItem,
} from '@/utils/estimateScopeChecklistUi';
import {
  PinnedDrywallAssemblyOptionsCard,
  DrywallTextureSelectedLabel,
  filterGroupedItemsWithoutPinnedTexture,
  resolvePinnedDrywallFinishItem,
  shouldShowPinnedDrywallAssemblyOptions,
} from '@/components/estimate/DrywallConfirmScopePanels';
import {
  hydrateDrywallSpecialtyBoardMeasurements,
  isDrywallCompletePackageScope,
  resolveDrywallFinishChoiceId,
  syncDrywallPackageTotalFromBoardBuckets,
  type DrywallBoardBucketDefinition,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import {
  BATHROOM_SHOWER_ROUGH_FIXTURE_OPTIONS,
  BATHROOM_SHOWER_ROUGH_FLOOR_OPTIONS,
  BATHROOM_SHOWER_ROUGH_PLUMBING_EXPOSED_OPTIONS,
  BATHROOM_SHOWER_ROUGH_SLAB_WORK_OPTIONS,
  BATHROOM_SHOWER_ROUGH_WORK_TYPE_OPTIONS,
  buildShowerRoughPricingContext,
  detectShowerRoughAccessOverlap,
  detectShowerRoughScopeOverlap,
  formatShowerRoughConditionSummary,
  inferPlumbingExposedFromDemoScope,
  shouldShowShowerRoughSlabWorkPrompt,
  SHOWER_ROUGH_ACCESS_OVERLAP_WARNING,
  SHOWER_ROUGH_DEMO_DETECTED_LABEL,
  SHOWER_ROUGH_OVERLAP_WARNING,
  isShowerRoughSuggestedBlock,
  showerRoughContextFromPricingRecord,
  type BathroomShowerRoughFixtureType,
  type BathroomShowerRoughFloorConstruction,
  type BathroomShowerRoughPlumbingExposed,
  type BathroomShowerRoughSlabWorkRequired,
  type BathroomShowerRoughWorkType,
} from '@/utils/bathroomPlumbingRoughPricing';
import ShowerRoughPricingDetails from '@/components/estimate/ShowerRoughPricingDetails';
import InteriorPaintPricingDetails from '@/components/estimate/InteriorPaintPricingDetails';
import {
  BATHROOM_INTERIOR_PAINT_CONDITION_OPTIONS,
  BATHROOM_INTERIOR_PAINT_MOBILIZATION_OPTIONS,
  BATHROOM_INTERIOR_PAINT_SURFACE_OPTIONS,
  detectInteriorPaintRepairOverlap,
  interiorPaintContextFromPricingRecord,
  isInteriorPaintSuggestedBlock,
  resolveInteriorPaintCondition,
  resolveInteriorPaintMobilization,
  resolveInteriorPaintSurface,
  type BathroomInteriorPaintCondition,
  type BathroomInteriorPaintMobilization,
  type BathroomInteriorPaintSurface,
} from '@/utils/bathroomInteriorPaintPricing';
import {
  BATHROOM_PAINT_REPAIR_SCOPE_OPTIONS,
  DRYWALL_PAINT_COMBINED_OVERLAP_WARNING,
  DRYWALL_PAINT_COMBINED_SUMMARY_LABEL,
  DRYWALL_PAINT_INTERIOR_OVERLAP_WARNING,
  DRYWALL_PAINT_WET_AREA_NOTE,
  PAINT_REPAIR_FULL_ROOM_NOTE,
  detectDrywallPaintCombinedOverlap,
  detectDrywallPaintInteriorOverlap,
  formatPaintRepairScopeSummary,
  hasPaintRepairScopeSelection,
  paintRepairInScope,
  resolveBathroomPaintRepairMissingLabel,
  resolveBathroomPaintRepairScope,
  resolvePaintRepairEntireRoom,
  formatBathroomFullRoomPaintSqftHint,
  type BathroomPaintRepairScope,
} from '@/utils/bathroomDrywallPaintScope';
import {
  buildBathroomDrywallPaintCombinedSummary,
  buildBathroomSeparateDrywallPaintSuggestedBlock,
  resolveBathroomPaintRepairSuggestedPricing,
} from '@/utils/bathroomPaintRepairPricing';
import type { SuggestedPricingApplyRow } from '@/utils/mergeSuggestedPricingBlocks';
import {
  formatBathroomDrywallPatchSqftHint,
  resolveBathroomDrywallPatchSuggestedPricing,
  syncBathroomPaintRepairItemQuantity,
} from '@/utils/bathroomDrywallPatchPricing';
import {
  BATHROOM_GLASS_DOOR_STYLE_OPTIONS,
  GLASS_DOOR_DOOR_ONLY_NOTE,
  resolveBathroomGlassDoorStyle,
  type BathroomGlassDoorStyle,
} from '@/utils/bathroomGlassDoorPricing';
import {
  BATHROOM_TOILET_RELOCATE_FLOOR_OPTIONS,
  isToiletRelocateSuggestedBlock,
  resolveToiletRelocateQuantitySourceLabel,
  toiletRelocateFloorTypeFromPricingRecord,
  type BathroomToiletRelocateFloorType,
} from '@/utils/bathroomFixtureChoicePricing';
import ToiletRelocatePricingDetails from '@/components/estimate/ToiletRelocatePricingDetails';
import { finalizeWetAreaInstallScopeFromMeasurements } from '@/utils/wetAreaInstallScopeGate';
import {
  buildNormalizedScopeMeasurementsFromInput,
  allowanceSplitSubKey,
  checklistItemInScope,
  countScopePricingReadiness,
  CUSTOM_SCOPE_PRICING_UNITS,
  getScopeQuantityFieldLabels,
  pricingBasisFieldLabel,
  formatUnitLabel,
  formatCountFieldSuffix,
  formatDualCountQuantity,
  getNationalAverageBudgetSplit,
  getChecklistItemQuantityRule,
  getChecklistItemQuantityRuleOrDefault,
  hasCompleteUserSelectedPricing,
  hasFlooringProductTakeoff,
  isNationalAverageComparisonBlock,
  initialScopeMeasurementInputExtended,
  isCustomScopePricingApplied,
  resolveCustomScopeDraftPricing,
  customScopeEditorRateValue,
  isDualAllowanceItem,
  overlayDualRatePricingDisplay,
  prepareScopeMeasurementsInputForUi,
  primaryQuantityForAppliedSuggestedBlock,
  resolveChecklistItemQuantity,
  resolveCustomScopePricingUnit,
  resolveDualRatePricingDisplayFromNotes,
  resolveScopeItemSuggestedPricing,
  resolveInsulationAssemblyLumpBenchmarkComparison,
  resolveInsulationAssemblyNationalRateCardComparison,
  resolveInsulationAssemblyPlanningRateLabel,
  resolveInsulationAssemblyPlanningRateTier,
  resolveInsulationAssemblyRowPricingMap,
  resolveInsulationAssemblyScopeSuggestedPricing,
  type InsulationAssemblyRowPricing,
  isPlaceholderAllowancePricing,
  isPricingLibraryTemplateBlock,
  roughAllowanceSubKey,
  scopeMeasurementsPayloadForPersist,
  shouldSuppressSuggestedPricingAfterApply,
  syncItemQuantitiesToMeasurementFields,
  resolveAllowanceEditorPricingBasis,
  resolveAllowanceEditorDefaultBasisUnit,
  type CalculatedQuantityRevertSnapshot,
  calculatedQuantityRevertLabel,
  type PricingLegSource,
  type QuantitySource,
  type ScopeMeasurementsInputExtended,
  type ScopePricingContext,
  type SuggestedPricingBlock,
} from '@/utils/scopeItemQuantities';
import { parseScopeMeasurementInput } from '@/utils/scopeMeasurements';
import {
  evaluateFlooringDemoPrepOverlap,
  isCustomFlooringDemoPriceBlock,
} from '@/utils/flooringDemoPrepBoundary';
import {
  countFilledQuickMeasurements,
  emptyQuickMeasurementInput,
  isWholeHomeQuickMeasurementTemplate,
  quickMeasurementDisplayLabel,
  quickMeasurementHelperText,
  quickMeasurementPlaceholder,
  quickMeasurementFieldDef,
  quickMeasurementFieldMeta,
  quickMeasurementRowsForInput,
  quickMeasurementRowsForTemplate,
  quickMeasurementSectionsForRows,
  resolveEffectiveQuickMeasurementTemplateKey,
  resolveQuickMeasurementDisplayValue,
  type QuickMeasurementFieldDef,
  type QuickMeasurementFieldKey,
} from '@/utils/scopeQuickMeasurements';
import {
  filterChecklistItemsForTrade,
  getPlanTradeConfiguration,
  resolveSingleTradePlanContext,
  stripScopeInputForSingleTrade,
  tradeQuickMeasurementFieldKeys,
  type PlanTradeKey,
} from '@/utils/planImportTradeConfig';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import {
  groupQuickMeasurementFields,
  quickMeasurementSummaryLine,
  acceptQuickMeasurementSuggestion,
  acceptReviewedQuickMeasurementSuggestions,
  quickMeasurementEstimateBadgeLabel,
  quickMeasurementSuggestionRequiresReview,
  resolveQuickMeasurementFields,
  summarizeQuickMeasurementFieldStates,
  pinQuickMeasurementFieldInGroup,
  splitWetAreaQuickMeasurementFields,
  WET_AREA_QUICK_MEASUREMENT_KEYS,
  tagPlanDetectedQuickMeasurementKeys,
  type QuickMeasurementFieldResult,
  type QuickMeasurementGroupId,
  type QuickMeasurementSummary,
} from '@/utils/quickMeasurementProvenance';
import {
  checklistChoiceFromWetAreaFinish,
  hydrateWetAreaStepperCounts,
  isSplitTileWetAreaCounts,
  BATHROOM_QM_STEPPER_MAX,
  listBathPlanRooms,
  resolveBathCount,
  resolveEffectiveWetAreaFinish,
  shouldShowPlanWetAreaFinishSteppers,
  wetAreaFinishFromChecklistChoice,
  type WetAreaFinishChoice,
  type WetAreaStepperCounts,
} from '@/utils/planBathRooms';
import { syncMeasurementsWithSouthernUtahPlanFacts } from '@/utils/quickMeasurementEstimates';
import type { InsulationAssembly } from '@/utils/estimateAiDraft';
import {
  emptyWetAreaExistingCounts,
  mergeDemoCountsWithOverrides,
  readWetAreaDemoCounts,
  readWetAreaExistingCounts,
  resolveDemoWetAreaFromIntent,
  resolveEffectiveExistingWetArea,
  type WetAreaDemoCounts,
  type WetAreaDemoOverrideKey,
  type WetAreaExistingCounts,
} from '@/utils/wetAreaExistingDemo';
import {
  getQmEmbeddedScopeIds,
  hydrateQmPanelMeasurements,
  isPhotoNotesScopeJob,
  syncFlooringQmScopeItems,
  readFlooringProductScope,
  shouldUseFlooringConfirmScopeLineCard,
  isFlooringConfirmScopePricingCard,
  flooringConfirmScopeIncludedLines,
  flooringConfirmScopeSummaryLabel,
  flooringConfirmScopeMaterialBucketLabel,
  flooringScopeCardLabel,
  flooringScopeCardHelper,
  syncKitchenQmScopeItems,
  syncBathroomFixtureQmScopeItems,
  syncLandscapingQmScopeItems,
  isLandscapingQmScopeItemActive,
  shouldUseLandscapingConfirmScopeLineCard,
  syncConcreteQmScopeItems,
  isConcreteQmScopeItemActive,
  shouldUseConcreteConfirmScopeLineCard,
  syncQmPanelScopeItems,
  shouldHideBathroomFixtureScopeCardInQmEmbed,
  BATHROOM_FIXTURES_QM_EMBEDDED_IDS,
  expandBathroomFixtureScopeDisplayItems,
  HVAC_EMBEDDED_QUICK_MEASUREMENT_KEYS,
  simpleTradePanelFor,
} from '@/utils/qmScopePanels';
import {
  QmBathroomFixturesPanels,
  QmFlooringScopePanels,
  QmLandscapingScopePanels,
  QmConcreteScopePanels,
  QmKitchenScopePanels,
  QmRoofingScopePanels,
  QmStuccoScopePanels,
  QmSimpleTradeScopePanels,
  QmSqftMeasurementRow,
  qmNeutralScopePanelStyle,
} from '@/components/estimate/QmTradeScopePanels';
import {
  GARAGE_DOOR_TYPE_RATES,
  resolveGarageDoorSuggestedPricing,
  type GarageDoorType,
} from '@/utils/exteriorOpeningsPricing';

import {
  CONFIRM_SCOPE_PRICE_TEXT,
  confirmScopeApplyButtonStyle,
  confirmScopeApplyButtonTextStyle,
  confirmScopeChoiceSelectedYesColors,
  estimateFlowCardStyle,
  estimateFlowDividerColor,
  estimateFlowScopeCardAlignStyle,
} from '@/utils/estimateFlowCardStyle';
import {
  SCOPE_ITEM_TIER_OPACITY,
  scopeCardAccentForItem,
  scopeChecklistNoteSummary,
  scopeItemNoteBadge,
  scopeItemHasMeasuredSelection,
  scopeItemVisualTier,
  type ScopeItemNoteBadge,
  type ScopeItemVisualContext,
} from '@/utils/scopeItemVisualTier';
import {
  buildCardIntelligenceDisplay,
  resolveScopeItemIntelligence,
  type ScopeItemIntelligence,
} from '@/utils/scopeIntelligence';
import {
  resolveFormulaQuantityApplyTarget,
  shouldShowFormulaQuantityButton,
  shouldSuppressInsulationEnvelopePlanningFormula,
  isFormulaQuantityApplyTargetActive,
  usesAutoFlatworkSqftPricing,
} from '@/utils/scopeFormulaRegistry';
import { AcceptedPricingSummary } from '@/components/estimate/AcceptedPricingSummary';
import {
  buildAcceptanceFromSuggestedBlock,
  buildAcceptanceFromCustomScopePricing,
  clearAcceptedScopeItemPricing,
  finalizeScopePricingAfterEditorClose,
  hasAcceptedScopePricing,
  liveScopeMoneyFromQuantities,
  markManualPricingAdjustment,
  moneyTotalAfterQuantityEdit,
  parsePricingAmount,
  resolveAcceptedPricingDisplay,
  shouldHideSuggestedPanel,
} from '@/utils/acceptedPricingSummaryUi';
import {
  resyncAppliedScopePricingAfterMeasurementChanges,
  scaleSuggestedBlockToTakeoffQuantity,
} from '@/utils/confirmScopeAppliedPricingResync';
import { type AssemblyComponentStatus } from '@/utils/scopeAssemblyRegistry';
import {
  applyParentScopeGapPriceAddon,
  adjustSuggestedPricingBlock,
  ensureSeparateScopeItemInChecklist,
  getScopeGapRecord,
  scopeGapAddonCostBucketForComponent,
  setScopeGapResolution,
  syncScopeGapPricingStatuses,
  type ScopeGapPricingContext,
  type ScopeGapResolutionsMap,
} from '@/utils/scopeReviewUi';
import type {
  BenchmarkScopeAssumption,
  BenchmarkScopeAssumptionProfile,
} from '@/utils/benchmarkScopeAssumptions';
import {
  benchmarkEngineV1Enabled,
  fetchBenchmarkSuggestions,
  type BenchmarkReasonableness,
} from '@/utils/benchmarkEngine';
import {
  clearSupersededStageHostPricing,
  computeAppliedBuildCostPerLivingSf,
  mergeConfirmScopeSavedMeasurements,
  resolveAppliedBuildCostArea,
  resolveBenchmarkLivingSf,
  shouldShowAppliedBuildCostPerSf,
  scopeShowsConfirmScopeAppliedPricing,
  sumConfirmScopeAppliedPricingBreakdown,
  sumConfirmScopeAppliedPricingTotal,
  listConfirmScopeAppliedPricingLines,
} from '@/utils/benchmarkReasonablenessContext';
import { buildConfirmScopeDisplayItems } from '@/utils/scopePackagesForReview';
import { mergeSuggestedPricingBlocksIntoMeasurements } from '@/utils/mergeSuggestedPricingBlocks';
import {
  assertBenchmarkDoesNotOverwritePrimary,
  benchmarkStageForScopeKey,
  coversLabelList,
  FOOTER_PLANNING_BENCHMARK_INFO,
  footerScrollToPricingButtonLabel,
  footerSuggestedPricingPendingHint,
  footerSuggestedPricingSummary,
  scopeHasCommittedConfirmScopePrice,
  isGrossFlooringDerivedFromLiving,
  livingSfBenchmarkRecord,
  livingSfPricingRecord,
  measurementSemanticsV1Enabled,
  measurementStatusLabel,
  measurementValidationRequiredForBenchmark,
  missingStatusDisplayLabel,
  missingStatusForScope,
  preferredPrimaryUnit,
  stageHasAcceptedBenchmarkPricing,
  stageHasAcceptedTradePricing,
  stageTitle,
  STAGE_BENCHMARK_OWNERS,
  validatePricingBasis,
  type ScopeMeasurementState,
} from '@/utils/measurementSemantics';
import { PLANNING_BID_CONFIDENCE_COPY } from '@/utils/getMeasurementRelevance';
import { step2TierNeedsInlineTakeoffEntry } from '@/utils/confirmScopeStep2Pricing';
import BenchmarkReasonablenessCard from '@/components/estimate/BenchmarkReasonablenessCard';
import {
  buildSuggestedPricingCardDisplay,
  displayPriceSourceLabel,
  includeUnconfirmedSuggestedPricingFill,
  isConfirmScopePlanningBenchmarkRow,
  isInsulationAssemblyConfirmScopePricingCard,
  shouldIncludeConfirmScopeBulkApplyRow,
  suggestedPricingFooterCountsAmperageConfirm,
  type InsulationAssemblyDetailRow,
} from '@/utils/suggestedPricingCardUi';
import {
  insulationEnvelopeInputsFromPlanFacts,
  resolveInsulationEnvelopePlanningQuantity,
} from '@/utils/insulationEnvelopeQuantity';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  /** Session notes when draft.originalNotes was not persisted on the draft object. */
  notesFallback?: string | null;
  applying?: boolean;
  fromAssistant?: boolean;
  onBack: () => void;
  onConfirm: (
    items: ScopeChecklistItem[],
    measurements?: ScopeMeasurements
  ) => void;
  /** Fires immediately on Continue tap so the footer can show a spinner before heavy sync. */
  onConfirmBegin?: () => void;
  /** Persist in-progress scope without API round-trip (e.g. when navigating to review/pricing). */
  onPersistProgress?: (
    items: ScopeChecklistItem[],
    measurements?: ScopeMeasurements
  ) => void;
  /** Saved templates + active bid used to prefer saved $/unit rates in suggested pricing. */
  pricingContext?: ScopePricingContext | null;
  /** Step 1 site photos — when present, existing wet area is AI-seeded and the QM panel stays hidden. */
  hasSitePhotos?: boolean;
  /** Step 1 plan import payload — used to detect single-trade mode when draft metadata is missing. */
  planImport?: import('@/utils/estimateAiDraft').PlanImportPayload | null;
};

const QUANTITY_NEEDED_LABELS: Record<string, string> = {
  tub_demo: 'tub count',
  shower_floor_demo: 'shower floor demo sqft',
  wet_area_install: 'tub or pan count',
  shower_tile: 'shower wall sqft',
  shower_floor_tile: 'shower floor sqft',
  waterproofing: 'shower wall sqft',
  shower_pan: 'shower floor sqft (mud pan area)',
  shower_niche: 'niche count',
  shower_bench: 'bench count or LF',
  floor_tile: 'bathroom floor sqft',
  floor_prep: 'floor sqft or allowance',
  paint: 'wall/ceiling paint sqft',
  trim: 'linear feet',
  tub_shower: 'shower area sqft',
  drywall: 'repair sqft',
  cabinets: 'cabinet LF or allowance',
  countertops: 'countertop sqft',
  backsplash: 'backsplash sqft',
  flooring: 'floor sqft',
  rock: 'sqft, CY, or tons',
  mulch: 'sqft, CY, or tons',
  plants: 'each',
  trees: 'each',
  rock_mulch: 'sqft, CY, or tons',
  sod_turf: 'turf sqft',
  pavers: 'paver sqft',
  concrete: 'concrete sqft or CY',
  excavation: 'excavation CY or sqft',
};

const scopeNumericInputProps = {
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
};

function hapticTap() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
}

/** Yield one frame + post-gesture slot before heavy confirm-scope writes. */
function deferConfirmScopeHeavyWork(run: () => void) {
  requestAnimationFrame(() => {
    InteractionManager.runAfterInteractions(() => {
      startTransition(run);
    });
  });
}

/** Run Apply on the same frame as the tap — rAF/startTransition added visible lag. */
function runConfirmScopeApplyWork(run: () => void) {
  run();
}

function inputShellStyle(
  Colors: ReturnType<typeof getColors>,
  darkMode: boolean
) {
  return {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
  };
}

function formatMeasurementDisplay(
  value: string | number | null | undefined
): string {
  const raw = String(value ?? '').replace(/,/g, '');
  if (!raw) return '';
  const match = raw.match(/^(-?)(\d*)(\.\d*)?$/);
  if (!match) return String(value ?? '');
  const [, sign, integerPart, decimalPart = ''] = match;
  const integer = integerPart || '0';
  return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${decimalPart}`;
}

function flooringDemoLabel(
  type: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  originalNotes?: string | null
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
    if (measurementsInput.flooringExistingSheetVinylType === 'sheet_vinyl')
      return 'Sheet vinyl';
    if (measurementsInput.flooringExistingSheetVinylType === 'vct')
      return 'VCT (vinyl composition tile)';
    return 'Sheet vinyl/VCT — type not confirmed';
  }
  if (type === 'tile') {
    return /heavy\s+tile|difficult(?:y)?\s+(?:tile\s+)?remov|mud[\s-]?set|thick\s+set|multiple\s+tile\s+layers?|bonded\s+underlayment/i.test(
      String(originalNotes || '')
    )
      ? 'Heavy tile or mortar-bed tile'
      : 'Ceramic/porcelain tile';
  }
  return type.replace(/_/g, ' ');
}

function flooringDemoDescription(
  measurementsInput: ScopeMeasurementsInputExtended,
  originalNotes?: string | null,
  templateKey?: string | null
): string {
  const parsed = parseScopeMeasurementsFromNotes(originalNotes || '', {
    templateKey,
  }).flooringExistingTypes;
  const types =
    Array.isArray(measurementsInput.flooringExistingTypes) &&
    measurementsInput.flooringExistingTypes.length
      ? measurementsInput.flooringExistingTypes
      : parsed || [];
  const entries = types
    .filter(type => typeof type === 'string')
    .map(type => ({
      type,
      area: Number(
        measurementsInput.itemQuantities?.[`floor_demo__${type}`]?.quantity || 0
      ),
    }))
    .filter(entry => entry.area > 0)
    .map(
      entry =>
        `${formatMeasurementDisplay(entry.area)} SF of ${flooringDemoLabel(entry.type, measurementsInput, originalNotes)}`
    );
  if (!entries.length)
    return 'Remove the selected existing flooring before installing the selected new flooring.';
  const scope =
    entries.length === 1
      ? entries[0]
      : `${entries.slice(0, -1).join(', ')} and ${entries[entries.length - 1]}`;
  return `Remove ${scope} before installing the selected new flooring.`;
}

function captionColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? 'rgba(255,255,255,0.62)' : Colors.sub;
}

function inactiveChoiceChipStyle(
  darkMode: boolean,
  Colors: ReturnType<typeof getColors>
) {
  return {
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
    backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
    textColor: captionColor(darkMode, Colors),
  };
}

function dividerColor(darkMode: boolean) {
  return estimateFlowDividerColor(darkMode);
}

function ScopeItemTitleRow({
  label,
  noteBadge,
  rightAccessory,
  darkMode,
  Colors,
}: {
  label: string;
  noteBadge?: ScopeItemNoteBadge | null;
  rightAccessory?: React.ReactNode;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
}) {
  const badgeLabel =
    noteBadge === 'prefilled'
      ? 'Prefilled'
      : noteBadge === 'from_photo'
        ? SCOPE_DETECTED_FROM_PHOTOS_LABEL
        : noteBadge === 'from_plan'
          ? 'Detected from plan'
          : noteBadge === 'mentioned'
            ? SCOPE_MENTIONED_IN_NOTES_LABEL
            : noteBadge === 'review'
              ? 'Review'
              : null;
  const badgeColor = noteBadge === 'review' ? '#f59e0b' : '#22c55e';

  return (
    <View style={styles.cardTitleRow}>
      <Text
        style={[
          styles.scopeCardTitle,
          { color: darkMode ? '#F5F7FA' : Colors.text },
        ]}
      >
        {label}
      </Text>
      {badgeLabel ? (
        <View
          style={[
            styles.fromNotesBadge,
            darkMode ? styles.fromNotesBadgeDark : styles.fromNotesBadgeLight,
          ]}
        >
          <Text style={{ color: badgeColor, fontSize: 10, fontWeight: '800' }}>
            {badgeLabel}
          </Text>
        </View>
      ) : null}
      {rightAccessory ?? null}
    </View>
  );
}

function isUserEditingQuantity(
  measurementsInput: ScopeMeasurementsInputExtended,
  itemId: string,
  allowanceKey?: string
): boolean {
  const entry = measurementsInput.itemQuantities[itemId];
  const allowanceEntry = allowanceKey
    ? measurementsInput.itemQuantities[allowanceKey]
    : undefined;
  return (
    entry?.quantitySource === 'user_entered' ||
    allowanceEntry?.quantitySource === 'user_entered'
  );
}

function hasPrimaryTakeoffFromResolved(
  resolved: Pick<
    ReturnType<typeof resolveChecklistItemQuantity>,
    'quantity' | 'quantitySource'
  >
): boolean {
  return Boolean(
    resolved.quantity != null &&
    resolved.quantity > 0 &&
    resolved.quantitySource !== 'missing' &&
    resolved.quantitySource !== 'default_assumption'
  );
}

function formatResolvedQuantityDisplay(
  quantity: number,
  unit: string,
  quantitySource?: string,
  itemId?: string
): string {
  if (unit === 'allowance' || unit === 'lump_sum') {
    if (
      quantitySource === 'default_assumption' ||
      isPlaceholderAllowancePricing(quantity, unit, itemId)
    ) {
      return `${quantity.toLocaleString()} ${formatUnitLabel(unit)}`;
    }
    return formatDraftMoney(quantity);
  }
  return `${quantity.toLocaleString()} ${formatUnitLabel(unit)}`;
}

function pricingTextColor(
  darkMode: boolean,
  Colors: ReturnType<typeof getColors>
) {
  return darkMode ? '#F5F7FA' : Colors.text;
}

function pricingLabelColor(
  darkMode: boolean,
  Colors: ReturnType<typeof getColors>
) {
  return darkMode ? 'rgba(255,255,255,0.72)' : Colors.sub;
}

/** Maps a per-leg pricing source to the small pill shown next to that line. */
function legPillKind(
  source: PricingLegSource
): 'notes' | 'template' | 'benchmark' | 'national' {
  if (source === 'notes') return 'notes';
  if (source === 'template') return 'template';
  if (source === 'local_benchmark') return 'benchmark';
  return 'national';
}

function legSourcePill({
  block,
  leg,
}: {
  block: SuggestedPricingBlock;
  leg: 'material' | 'labor';
}) {
  const source = leg === 'material' ? block.materialSource : block.laborSource;
  if (
    block.mode === 'note_total_split' &&
    leg === 'labor' &&
    source === 'notes'
  ) {
    return <SourcePill kind='remainder' label='Remainder' />;
  }
  return <SourcePill kind={legPillKind(source)} />;
}

function SourcePill({
  kind,
  label,
}: {
  kind: 'notes' | 'national' | 'template' | 'benchmark' | 'remainder';
  label?: string;
}) {
  const defaultText =
    kind === 'notes'
      ? SCOPE_PARSED_FROM_NOTES_LABEL
      : kind === 'template'
        ? 'Saved pricing'
        : kind === 'benchmark'
          ? 'Local benchmark'
          : kind === 'remainder'
            ? 'Remainder'
            : 'National planning rate';
  const text = displayPriceSourceLabel(label || defaultText);
  const color =
    kind === 'notes'
      ? '#22c55e'
      : kind === 'template'
        ? '#a78bfa'
        : kind === 'benchmark'
          ? '#60a5fa'
          : kind === 'remainder'
            ? '#f59e0b'
            : '#60a5fa';
  const pillStyle =
    kind === 'notes'
      ? styles.sourcePillNotes
      : kind === 'template'
        ? styles.sourcePillTemplate
        : kind === 'remainder'
          ? styles.sourcePillRemainder
          : styles.sourcePillNational;
  return (
    <View style={[styles.sourcePill, pillStyle, { maxWidth: '100%' }]}>
      <Text
        numberOfLines={1}
        style={{ color, fontSize: 11, fontWeight: '700', flexShrink: 1 }}
      >
        {text}
      </Text>
    </View>
  );
}

/** Saved templates + active bid, supplied once and consumed by every QuantitySection. */
const ScopePricingContextValue =
  React.createContext<ScopePricingContext | null>(null);
const ScopeAssemblyContextValue = React.createContext<{
  activeScopeKeys: string[];
  excludedScopeKeys: string[];
}>({ activeScopeKeys: [], excludedScopeKeys: [] });
type SharedNormalizedScopeMeasurements = ReturnType<
  typeof buildNormalizedScopeMeasurementsFromInput
>;
const ScopeNormalizedMeasurementsContext =
  React.createContext<SharedNormalizedScopeMeasurements | null>(null);
const ScopeParsedNotesContext = React.createContext<{
  source: string;
  parsed: ReturnType<typeof parseScopeMeasurementsFromNotes>;
} | null>(null);

function PricingAmountRow({
  value,
  label,
  pill,
  helper,
  darkMode,
  Colors,
  emphasized,
}: {
  value: string;
  label?: string;
  pill?: React.ReactNode;
  helper?: string | null;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
  emphasized?: boolean;
}) {
  return (
    <View
      style={[
        styles.pricingRow,
        emphasized ? styles.pricingRowEmphasized : undefined,
      ]}
    >
      <View style={styles.pricingRowMain}>
        <Text
          style={{
            color: pricingTextColor(darkMode, Colors),
            fontSize: emphasized ? 19 : 15,
            fontWeight: emphasized ? '800' : '700',
            letterSpacing: emphasized ? -0.3 : 0,
          }}
        >
          {value}
        </Text>
        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          {pill ?? (
            <Text
              style={{
                color: pricingLabelColor(darkMode, Colors),
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {label}
            </Text>
          )}
        </View>
      </View>
      {helper ? (
        <Text
          style={[
            styles.pricingRateHelper,
            { color: pricingLabelColor(darkMode, Colors) },
          ]}
        >
          Rate: {helper}
        </Text>
      ) : null}
    </View>
  );
}

function PricingSplitRow({
  label,
  value,
  pill,
  helper,
  darkMode,
  Colors,
}: {
  label: string;
  value: string;
  pill?: React.ReactNode;
  helper?: string | null;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
}) {
  return (
    <View style={styles.pricingSplitRow}>
      <View style={styles.pricingSplitRowMain}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flexShrink: 1,
          }}
        >
          <Text
            style={{
              color: pricingLabelColor(darkMode, Colors),
              fontSize: 14,
              fontWeight: '600',
            }}
          >
            {label}
          </Text>
          {pill ?? null}
        </View>
        <Text
          style={{
            color: pricingTextColor(darkMode, Colors),
            fontSize: 15,
            fontWeight: '700',
          }}
        >
          {value}
        </Text>
      </View>
      {helper ? (
        <Text
          style={[
            styles.pricingRateHelper,
            { color: pricingLabelColor(darkMode, Colors) },
          ]}
        >
          Rate: {helper}
        </Text>
      ) : null}
    </View>
  );
}

function calculatedQuantityAlreadyActive(
  intelligence: ScopeItemIntelligence
): boolean {
  const formula = intelligence.formula;
  const current = intelligence.quantity.value;
  if (!formula || current == null) return false;
  return isFormulaQuantityApplyTargetActive({
    scopeKey: intelligence.scopeItemKey,
    formula,
    quantity: current,
    unit: intelligence.quantity.unit,
    source: intelligence.quantity.source,
  });
}

function isNationalAveragePricingBlock(
  block: SuggestedPricingBlock | null | undefined
): boolean {
  if (!block) return false;
  return (
    block.materialSource === 'national_average' ||
    block.laborSource === 'national_average' ||
    /national\s*average/i.test(String(block.rateSourceLabel || ''))
  );
}

function isSavedPricingBlock(
  block: SuggestedPricingBlock | null | undefined
): boolean {
  return isPricingLibraryTemplateBlock(block);
}

function shouldShowPricingComparisonBlock(
  block: SuggestedPricingBlock | null | undefined
): boolean {
  if (!block) return false;
  return (
    isSavedPricingBlock(block) ||
    isNationalAverageComparisonBlock(block) ||
    Boolean(block.isComparison)
  );
}

function resolveFormulaTargetSuggestedPricing(params: {
  itemId: string;
  measurementsInput: ScopeMeasurementsInputExtended;
  templateKey: string | null | undefined;
  resolved: ReturnType<typeof resolveChecklistItemQuantity>;
  pricingContext?: ScopePricingContext | null;
  intelligence: ScopeItemIntelligence;
  suggested: ReturnType<typeof resolveScopeItemSuggestedPricing>;
  choiceId?: string | null;
}): ReturnType<typeof resolveScopeItemSuggestedPricing> {
  const formula = params.intelligence.formula;
  if (!formula || calculatedQuantityAlreadyActive(params.intelligence)) {
    return params.suggested;
  }

  // Auto-preview formula qty whenever it is the pricing basis. Flatwork uses
  // measured sqft instead of converted CY, and kitchen countertops use cabinet
  // LF × countertop depth. The preview must move as the source measurement moves;
  // the user can still explicitly apply the calculated quantity to persist it.
  const isCountertopAreaFormula =
    formula.formulaKey === 'countertop_area_from_cabinet_lf';
  if (
    !usesAutoFlatworkSqftPricing({ scopeKey: params.itemId, formula }) &&
    !(params.itemId === 'countertops' && isCountertopAreaFormula)
  ) {
    return params.suggested;
  }

  const applyTarget = resolveFormulaQuantityApplyTarget({
    scopeKey: params.itemId,
    formula,
  });
  const currentQuantity = Number(
    params.resolved.dualCount?.quantity ?? params.resolved.quantity
  );
  const currentUnit = params.resolved.dualCount?.unit ?? params.resolved.unit;
  if (
    currentUnit === applyTarget.unit &&
    Number.isFinite(currentQuantity) &&
    Math.abs(currentQuantity - applyTarget.quantity) < 0.01
  ) {
    return params.suggested;
  }

  return resolveScopeItemSuggestedPricing(
    params.itemId,
    params.measurementsInput,
    params.templateKey,
    {
      ...params.resolved,
      quantity: applyTarget.quantity,
      unit: applyTarget.unit,
      quantitySource: 'calculated_confirmed',
      dualCount: {
        quantity: applyTarget.quantity,
        unit: applyTarget.unit,
      },
      // The preview represents the calculated quantity basis, not previously-entered totals.
      dualMaterial: undefined,
      dualLabor: undefined,
      dualAllowance: undefined,
    },
    params.pricingContext,
    params.choiceId
  );
}

function buildCalculatedQuantityRevertSnapshot(
  itemId: string,
  itemQuantities: ScopeMeasurementsInputExtended['itemQuantities'],
  pricingAcceptance: ScopeMeasurementsInputExtended['pricingAcceptance'],
  resolved: ReturnType<typeof resolveChecklistItemQuantity>
): CalculatedQuantityRevertSnapshot | undefined {
  const quantity = resolved.dualCount?.quantity ?? resolved.quantity;
  if (
    quantity == null ||
    !Number.isFinite(Number(quantity)) ||
    Number(quantity) <= 0
  ) {
    return undefined;
  }
  const relatedEntries: NonNullable<
    CalculatedQuantityRevertSnapshot['relatedEntries']
  > = {};
  for (const [key, entry] of Object.entries(itemQuantities)) {
    if (key === itemId || key.startsWith(`${itemId}__`)) {
      relatedEntries[key] = {
        quantity: entry.quantity,
        unit: entry.unit,
        quantitySource: entry.quantitySource,
      };
    }
  }
  return {
    quantity: String(quantity),
    unit: resolved.dualCount?.unit ?? resolved.unit ?? 'each',
    quantitySource: resolved.quantitySource,
    pricingAcceptanceBeforeCalculated: pricingAcceptance?.[itemId] ?? null,
    relatedEntries,
  };
}

function ScopeIntelligenceNotice({
  intelligence,
  Colors,
  darkMode,
  onUseCalculatedQuantity,
  onRevertCalculatedQuantity,
  calculatedRevertLabel,
  compact = false,
  pricingAccepted = false,
  suppressFormulaPlanning = false,
  measurements = null,
  /** Pricing card below already shows the one status line — hide duplicate confidence. */
  pricingCardOwnsStatus = false,
}: {
  intelligence: ScopeItemIntelligence;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onUseCalculatedQuantity?: () => void;
  onRevertCalculatedQuantity?: () => void;
  calculatedRevertLabel?: string | null;
  compact?: boolean;
  pricingAccepted?: boolean;
  suppressFormulaPlanning?: boolean;
  measurements?: Record<string, unknown> | null;
  pricingCardOwnsStatus?: boolean;
}) {
  const [warningExpanded, setWarningExpanded] = useState(false);
  const cardDisplay = buildCardIntelligenceDisplay(intelligence, {
    pricingAccepted,
  });
  const formula = intelligence.formula;
  const calculatedActive = calculatedQuantityAlreadyActive(intelligence);
  const applyTarget = formula
    ? resolveFormulaQuantityApplyTarget({
        scopeKey: intelligence.scopeItemKey,
        formula,
      })
    : null;
  const formulaVariance =
    intelligence.formulaComparison?.variancePercent ?? null;
  const showFormulaDetails = Boolean(
    formula && !calculatedActive && !suppressFormulaPlanning
  );
  const showCalculatedRevert =
    calculatedActive &&
    Boolean(onRevertCalculatedQuantity && calculatedRevertLabel);
  const showQuantity =
    !pricingCardOwnsStatus &&
    !calculatedActive &&
    cardDisplay.showQuantityConfidenceLine &&
    (intelligence.quantity.confidence !== 'high' ||
      intelligence.quantity.source === 'calculated_assumption' ||
      intelligence.quantity.source === 'benchmark_estimate' ||
      Boolean(formula));
  // Measurement-needed essays duplicate the pricing card’s single amber status.
  const otherNoticeRaw =
    pricingCardOwnsStatus &&
    (intelligence.validation.status === 'measurement_needed' ||
      /^Measurement needed/i.test(cardDisplay.otherNotice || ''))
      ? null
      : cardDisplay.otherNotice;
  if (compact) {
    if (
      !cardDisplay.conciseBenchmarkWarning &&
      !cardDisplay.duplicatePricingMessage &&
      !otherNoticeRaw &&
      !showFormulaDetails &&
      !showCalculatedRevert
    ) {
      return null;
    }
  } else if (
    !cardDisplay.conciseBenchmarkWarning &&
    !cardDisplay.duplicatePricingMessage &&
    !otherNoticeRaw &&
    !showQuantity &&
    !showFormulaDetails &&
    !showCalculatedRevert
  ) {
    return null;
  }

  const accent =
    intelligence.validation.status === 'measurement_needed'
      ? '#f59e0b'
      : intelligence.validation.status === 'blocked'
        ? '#ef4444'
        : cardDisplay.confidence === 'low'
          ? '#f59e0b'
          : '#60a5fa';

  // Suggested-price cards own "Base national average / planning estimate" status — avoid duplicate vague copy.
  const warningFullRaw = (cardDisplay.conciseBenchmarkWarning || '').trim();
  const warningFull =
    compact && /^Base national average/i.test(warningFullRaw)
      ? ''
      : warningFullRaw;
  const warningFirstSentence =
    warningFull.split(/(?<=\.)\s+/)[0] || warningFull;
  const warningPreview =
    warningFirstSentence.length > 88
      ? `${warningFirstSentence.slice(0, 85).trimEnd()}…`
      : warningFirstSentence;
  const warningCanExpand = Boolean(
    warningFull && warningPreview !== warningFull
  );

  const otherNotice =
    otherNoticeRaw &&
    !(showFormulaDetails && otherNoticeRaw.startsWith('Calculated comparison:'))
      ? otherNoticeRaw
      : null;

  const showConfidenceLine =
    !pricingCardOwnsStatus &&
    (showQuantity ||
      Boolean(
        cardDisplay.conciseBenchmarkWarning || cardDisplay.confidenceLabel
      ));

  return (
    <View
      style={[styles.intelligenceNotice, { backgroundColor: 'transparent' }]}
    >
      {showQuantity ? (
        <Text
          style={[
            styles.intelligenceNoticeText,
            { color: captionColor(darkMode, Colors) },
          ]}
        >
          <Text style={{ color: accent, fontWeight: '800' }}>
            {cardDisplay.confidenceLabel}
          </Text>
          {cardDisplay.conciseBenchmarkWarning ? null : (
            <>
              {' · '}
              {cardDisplay.sourceLabel}
            </>
          )}
        </Text>
      ) : showConfidenceLine ? (
        <Text
          style={[
            styles.intelligenceNoticeText,
            { color: captionColor(darkMode, Colors) },
          ]}
        >
          <Text style={{ color: accent, fontWeight: '800' }}>
            {cardDisplay.confidenceLabel}
          </Text>
        </Text>
      ) : null}
      {warningFull ? (
        <TouchableOpacity
          activeOpacity={warningCanExpand ? 0.75 : 1}
          disabled={!warningCanExpand}
          onPress={() => setWarningExpanded(open => !open)}
          accessibilityRole={warningCanExpand ? 'button' : undefined}
          accessibilityLabel={
            warningCanExpand
              ? warningExpanded
                ? 'Collapse pricing warning'
                : 'Expand pricing warning'
              : undefined
          }
          accessibilityState={
            warningCanExpand ? { expanded: warningExpanded } : undefined
          }
        >
          <Text
            style={[
              styles.intelligenceNoticeText,
              {
                color: warningExpanded
                  ? captionColor(darkMode, Colors)
                  : darkMode
                    ? 'rgba(255,255,255,0.55)'
                    : Colors.sub,
              },
            ]}
          >
            {warningExpanded ? warningFull : warningPreview}
          </Text>
        </TouchableOpacity>
      ) : null}
      {cardDisplay.duplicatePricingMessage ? (
        <Text
          style={[
            styles.intelligenceNoticeText,
            { color: captionColor(darkMode, Colors) },
          ]}
        >
          <Text style={{ color: accent, fontWeight: '800' }}>
            {cardDisplay.duplicatePricingTitle || 'Possible duplicate pricing'}
          </Text>
          {' · '}
          {cardDisplay.duplicatePricingMessage}
        </Text>
      ) : null}
      {otherNotice && warningExpanded ? (
        <Text
          style={[
            styles.intelligenceNoticeText,
            {
              color: /national average/i.test(otherNotice)
                ? '#fbbf24'
                : captionColor(darkMode, Colors),
            },
          ]}
        >
          {otherNotice}
        </Text>
      ) : otherNotice && !warningFull ? (
        <Text
          style={[
            styles.intelligenceNoticeText,
            {
              color: /national average/i.test(otherNotice)
                ? '#fbbf24'
                : captionColor(darkMode, Colors),
            },
          ]}
        >
          {otherNotice}
        </Text>
      ) : null}
      {showFormulaDetails ? (
        <View style={styles.formulaNoticeBlock}>
          {(warningExpanded || !warningFull) && (
            <Text
              style={[
                styles.intelligenceNoticeText,
                { color: captionColor(darkMode, Colors) },
              ]}
            >
              {formula!.formulaExplanation}
            </Text>
          )}
          {(warningExpanded || !warningFull) &&
          formula!.expectedRange &&
          formulaVariance != null &&
          formulaVariance !== 0 &&
          Math.abs(formulaVariance) <= 150 ? (
            <Text
              style={[
                styles.intelligenceNoticeText,
                { color: captionColor(darkMode, Colors) },
              ]}
            >
              Expected range: {formula!.expectedRange.low.toLocaleString()}-
              {formula!.expectedRange.high.toLocaleString()}{' '}
              {formatUnitLabel(formula!.unit)}
            </Text>
          ) : null}
          {onUseCalculatedQuantity &&
          applyTarget &&
          formula &&
          shouldShowFormulaQuantityButton({
            scopeKey: intelligence.scopeItemKey,
            formula,
            measurements,
          }) ? (
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityRole='button'
              accessibilityLabel={applyTarget.accessibilityLabel}
              onPress={onUseCalculatedQuantity}
              style={[
                styles.formulaActionButton,
                {
                  borderColor: darkMode
                    ? 'rgba(34,197,94,0.28)'
                    : 'rgba(22,163,74,0.32)',
                  backgroundColor: darkMode
                    ? 'rgba(34,197,94,0.05)'
                    : 'rgba(34,197,94,0.04)',
                },
              ]}
            >
              <Ionicons
                name='checkmark-circle-outline'
                size={16}
                color={darkMode ? 'rgba(110,231,160,0.9)' : '#16a34a'}
              />
              <Text
                style={[
                  styles.formulaActionText,
                  { color: darkMode ? 'rgba(110,231,160,0.92)' : '#15803d' },
                ]}
              >
                {applyTarget.buttonLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {showCalculatedRevert ? (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole='button'
          accessibilityLabel={
            calculatedRevertLabel ?? 'Revert to original quantity'
          }
          onPress={onRevertCalculatedQuantity}
          style={[
            styles.formulaRevertButton,
            {
              borderColor: darkMode ? 'rgba(255,255,255,0.18)' : Colors.line,
              backgroundColor: darkMode
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(15,23,42,0.03)',
            },
          ]}
        >
          <Ionicons
            name='arrow-undo-outline'
            size={17}
            color={captionColor(darkMode, Colors)}
          />
          <Text
            style={[
              styles.formulaRevertText,
              { color: captionColor(darkMode, Colors) },
            ]}
          >
            {calculatedRevertLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function headerSourcePillLabel(rateSourceLabel: string): string | undefined {
  if (rateSourceLabel.startsWith('Suggested · ')) {
    return rateSourceLabel.slice('Suggested · '.length);
  }
  if (rateSourceLabel.startsWith('Adjusted · ')) {
    return rateSourceLabel.slice('Adjusted · '.length);
  }
  return rateSourceLabel;
}

/**
 * When the editor's basis/material/labor diverge from the original suggestion,
 * rebuild the card so amounts match the live split and title becomes Adjusted pricing.
 */
function overlaySuggestedBlockWithEditorValues(
  block: SuggestedPricingBlock | null | undefined,
  editor: {
    materialValue: string;
    laborValue: string;
    allowanceValue?: string;
    pricingBasisValue: string;
    pricingBasis: { quantity: number; unit: string } | null;
    basisUnit: string;
  }
): SuggestedPricingBlock | null {
  if (!block) return null;
  const basisQty =
    parseMoneyAmount(editor.pricingBasisValue) ||
    (editor.pricingBasis && editor.pricingBasis.quantity > 0
      ? editor.pricingBasis.quantity
      : 0) ||
    (block.basis?.quantity && block.basis.quantity > 0
      ? block.basis.quantity
      : 0);
  const basisUnit =
    editor.pricingBasis?.unit ||
    editor.basisUnit ||
    block.basis?.unit ||
    'sqft';
  const material = parseMoneyAmount(editor.materialValue);
  const labor = parseMoneyAmount(editor.laborValue);
  const allowance = parseMoneyAmount(editor.allowanceValue);
  const hasEditorAmounts = block.lumpSumOnly
    ? allowance > 0
    : material > 0 || labor > 0;
  if (!hasEditorAmounts) return block;

  const total = block.lumpSumOnly ? allowance : material + labor;
  if (!(total > 0)) return block;

  const originalBasisQty =
    block.basis?.quantity && block.basis.quantity > 0
      ? block.basis.quantity
      : 0;
  const amountsDiffer =
    Math.abs(
      (block.lumpSumOnly ? block.total : block.material) -
        (block.lumpSumOnly ? total : material)
    ) >= 0.01 ||
    (!block.lumpSumOnly && Math.abs(block.labor - labor) >= 0.01) ||
    Math.abs(block.total - total) >= 0.01 ||
    (originalBasisQty > 0 &&
      basisQty > 0 &&
      Math.abs(originalBasisQty - basisQty) >= 0.01);

  if (!amountsDiffer) return block;

  const materialRate =
    basisQty > 0 && material > 0 ? roundMoney2(material / basisQty) : null;
  const laborRate =
    basisQty > 0 && labor > 0 ? roundMoney2(labor / basisQty) : null;
  const unitLabel = formatUnitLabel(basisUnit);
  const basisHelper =
    basisQty > 0
      ? `Based on ${basisQty.toLocaleString()} ${unitLabel} · adjusted pricing`
      : 'Adjusted pricing';

  const costBuckets = block.lumpSumOnly
    ? [
        {
          key: 'allowance' as const,
          label: 'Allowance',
          amount: roundMoney2(total),
          rate: null,
          source: 'notes' as const,
        },
      ]
    : (block.costBuckets?.length
        ? block.costBuckets.map(bucket => {
            if (bucket.key === 'labor') {
              return {
                ...bucket,
                amount: roundMoney2(labor),
                rate: laborRate,
                source: 'notes' as const,
              };
            }
            if (
              bucket.key === 'material' ||
              bucket.key === 'equipment' ||
              bucket.key === 'subcontractor' ||
              bucket.key === 'other_direct_cost'
            ) {
              return {
                ...bucket,
                amount: roundMoney2(material),
                rate: materialRate,
                source: 'notes' as const,
              };
            }
            return bucket;
          })
        : [
            ...(material > 0
              ? [
                  {
                    key: 'material' as const,
                    label: 'Material',
                    amount: roundMoney2(material),
                    rate: materialRate,
                    source: 'notes' as const,
                  },
                ]
              : []),
            ...(labor > 0
              ? [
                  {
                    key: 'labor' as const,
                    label: 'Labor',
                    amount: roundMoney2(labor),
                    rate: laborRate,
                    source: 'notes' as const,
                  },
                ]
              : []),
          ]
      ).filter(bucket => bucket.amount > 0);

  const originalLabel = block.rateSourceLabel
    .replace(/^Suggested · /, '')
    .replace(/^Adjusted · /, '');
  return {
    ...block,
    material: roundMoney2(material),
    labor: roundMoney2(labor),
    total: roundMoney2(total),
    materialSource: 'notes',
    laborSource: 'notes',
    rateSourceLabel: `Adjusted · ${originalLabel || 'User entered'}`,
    helper: basisHelper,
    basis: basisQty > 0 ? { quantity: basisQty, unit: basisUnit } : block.basis,
    costBuckets,
    isComparison: false,
  };
}

function InsulationAssemblyPricingBreakdown({
  rows,
  material,
  labor,
  unitRateLine,
  darkMode,
  Colors,
  dividerColor,
}: {
  rows: InsulationAssemblyDetailRow[];
  material: number;
  labor: number;
  unitRateLine: string | null;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
  dividerColor: string;
}) {
  const text = pricingTextColor(darkMode, Colors);
  const caption = pricingLabelColor(darkMode, Colors);

  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      {material > 0 ? (
        <PricingSplitRow
          label='Material'
          value={formatDraftMoney(material)}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
      {labor > 0 ? (
        <PricingSplitRow
          label='Labor'
          value={formatDraftMoney(labor)}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
      {rows.length ? (
        <View
          style={{
            marginTop: 4,
            paddingTop: 10,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: dividerColor,
            gap: 8,
          }}
        >
          <Text style={{ color: text, fontSize: 12, fontWeight: '700' }}>
            Assemblies
          </Text>
          {rows.map(row => (
            <View
              key={`${row.sqft}-${row.description}-${row.rate}`}
              style={{ gap: 2 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    color: text,
                    fontSize: 13,
                    fontWeight: '700',
                    flexShrink: 1,
                  }}
                >
                  {row.sqft || row.description}
                </Text>
                {row.lineTotal ? (
                  <Text
                    style={{
                      color: text,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {row.lineTotal}
                  </Text>
                ) : null}
              </View>
              {row.sqft ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <Text
                    style={{
                      color: caption,
                      fontSize: 12,
                      lineHeight: 16,
                      flex: 1,
                    }}
                  >
                    {row.description}
                  </Text>
                  {row.rate ? (
                    <Text
                      style={{
                        color: caption,
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {row.rate}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {unitRateLine ? (
        <Text
          style={{
            color: caption,
            fontSize: 12,
            fontWeight: '600',
            marginTop: 2,
          }}
        >
          {unitRateLine}
        </Text>
      ) : null}
    </View>
  );
}

function SuggestedPricingApplyButton({
  label,
  onPress,
  style,
  textStyle,
}: {
  label: string;
  onPress?: () => void;
  style: object;
  textStyle: object;
}) {
  if (!onPress) return null;

  return (
    <ReliableFlowPress
      onPress={onPress}
      haptic='light'
      accessibilityLabel={label}
      accessibilityRole='button'
      activeOpacity={0.88}
      style={[style, { zIndex: 2 }]}
    >
      <Text style={textStyle}>{label}</Text>
    </ReliableFlowPress>
  );
}

function SuggestedBudgetSplitRows({
  block,
  Colors,
  darkMode,
  onUsePricing,
  adjusted = false,
  itemId,
  quantitySource,
  hasPrimaryTakeoff,
  livingSf,
  confidenceLabel,
  hasCurrentPricing = false,
  forceCompact = false,
}: {
  block: SuggestedPricingBlock;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onUsePricing?: () => void;
  adjusted?: boolean;
  itemId?: string;
  quantitySource?: string | null;
  hasPrimaryTakeoff?: boolean;
  livingSf?: number | null;
  confidenceLabel?: string | null;
  /** Current entered/applied amount exists — render compact Apply row. */
  hasCurrentPricing?: boolean;
  /** Collapse full Needs/Apply card to one-line suggested row (soft-cost idle). */
  forceCompact?: boolean;
}) {
  const usesBenchmark =
    block.materialSource === 'local_benchmark' ||
    block.laborSource === 'local_benchmark';
  const semantics = measurementSemanticsV1Enabled();
  const action = block.benchmarkAction;
  const includedInStage =
    action === 'included_in_stage' || Boolean(block.includedInStageLabel);
  const caption = pricingLabelColor(darkMode, Colors);
  const text = pricingTextColor(darkMode, Colors);
  const statusAmber = '#fbbf24';
  const divider = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
  const isFlooringLineCard = isFlooringConfirmScopePricingCard(itemId);
  const flooringTransitionLines = isFlooringLineCard
    ? String(block.pricingDetail || '')
        .split('\n')
        .filter(line => /^\d[\d,]*\s+SF\s+/.test(line))
    : [];
  const [flooringTransitionBreakdownOpen, setFlooringTransitionBreakdownOpen] =
    useState(false);
  const isFramingShellLineCard = itemId === 'framing';
  const isHvacPackageLineCard = itemId === 'hvac';
  const packageBreakdownLines =
    isFramingShellLineCard || isHvacPackageLineCard
      ? String(block.pricingDetail || '')
          .split('\n')
          .filter(Boolean)
      : [];
  const [packageBreakdownOpen, setPackageBreakdownOpen] = useState(false);
  const flooringTransitionDisplayLines = isFlooringLineCard
    ? flooringConfirmScopeIncludedLines(itemId || '', block.pricingDetail, {
        rateSourceLabel: block.rateSourceLabel,
      })
    : [];
  const flooringTransitionSummaryLabel = flooringConfirmScopeSummaryLabel(
    itemId || ''
  );
  const flooringMaterialBucketLabel = flooringConfirmScopeMaterialBucketLabel(
    itemId || ''
  );
  const showFlooringBreakdownToggle =
    isFlooringLineCard &&
    (flooringTransitionLines.length > 0 ||
      block.material > 0 ||
      block.labor > 0);

  if (semantics && includedInStage) {
    const stageName =
      block.includedInStageLabel || stageTitle(block.benchmarkStageKey);
    return (
      <View style={[styles.budgetSplitPanel, { borderTopColor: divider }]}>
        <Text style={{ color: text, fontSize: 13, fontWeight: '700' }}>
          Included in {stageName}
        </Text>
        <Text
          style={{ color: caption, fontSize: 12, lineHeight: 17, marginTop: 4 }}
        >
          Detailed takeoff still required. Stage total is on the {stageName}{' '}
          card.
        </Text>
      </View>
    );
  }

  const display = buildSuggestedPricingCardDisplay({
    itemId: itemId || block.benchmarkScopeKey || '',
    block,
    quantitySource,
    hasPrimaryTakeoff,
    livingSf,
    confidenceLabel,
    adjusted,
    hasCurrentPricing,
    forceCompact,
  });

  const rateLabel = String(block.rateSourceLabel || '');
  const isNationalAverageSource =
    /national\s*average|national\s*planning\s*rate/i.test(rateLabel);
  const isNationalComparison =
    /national\s*average\s*comparison/i.test(rateLabel) ||
    (Boolean(block.isComparison) && isNationalAverageSource);
  // When the contractor already entered/applied a price, national rows are
  // comparison-only — never count as "price ready" Apply targets.
  // Stage lumps stay view-only.
  const canWritePrice =
    Boolean(onUsePricing) &&
    !block.needsServiceAmperage &&
    action !== 'included_in_stage' &&
    !(
      hasCurrentPricing &&
      (isNationalAverageSource ||
        isNationalComparison ||
        action === 'comparison_only' ||
        Boolean(block.isComparison))
    ) &&
    (isNationalComparison ||
      (action !== 'comparison_only' &&
        !(block.isComparison && usesBenchmark && semantics)));

  const writeActionLabel = isNationalComparison
    ? display.presentation === 'compact'
      ? 'Apply'
      : 'Use this pricing'
    : display.actionLabel;

  if (display.presentation === 'compact') {
    return (
      <View style={[styles.compactSuggestedRow, { borderTopColor: divider }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: text, fontSize: 14, fontWeight: '700' }}>
            {display.compactLine || display.displayTotal}
          </Text>
          <Text
            style={{
              color: caption,
              fontSize: 12,
              fontWeight: '500',
              marginTop: 2,
            }}
          >
            {display.sourceLine}
          </Text>
        </View>
        {canWritePrice && writeActionLabel ? (
          <SuggestedPricingApplyButton
            label={writeActionLabel}
            onPress={onUsePricing}
            style={styles.compactSuggestedBtn}
            textStyle={styles.compactSuggestedBtnText}
          />
        ) : null}
      </View>
    );
  }

  const headerTitle =
    semantics && usesBenchmark && block.benchmarkLevel === 'stage'
      ? action === 'comparison_only'
        ? `${stageTitle(block.benchmarkStageKey)} comparison`
        : stageTitle(block.benchmarkStageKey)
      : display.title;

  // Show exact apply amounts on the card — same cents stored when user taps Apply.
  const displayTotal = display.displayTotal;

  const coversHint =
    semantics &&
    usesBenchmark &&
    block.benchmarkLevel === 'stage' &&
    block.benchmarkStageKey
      ? coversLabelList(block.benchmarkStageKey)
      : '';

  const actionLabel =
    writeActionLabel ||
    (action === 'comparison_only' ? 'Compare benchmarks' : display.actionLabel);

  // Stage cover list used to live under “Why this price?” — keep a single calm line when useful.
  const stageCoversLine =
    coversHint && !display.statusLine
      ? coversHint.includes('priced separately')
        ? coversHint
        : `Includes ${coversHint}`
      : null;

  const isInsulationAssemblyCard = isInsulationAssemblyConfirmScopePricingCard(
    itemId,
    block
  );
  const insulationAssemblyRows = display.assemblyDetailLines ?? [];

  return (
    <View style={[styles.budgetSplitPanel, { borderTopColor: divider }]}>
      {display.quantityLine &&
      !isInsulationAssemblyCard &&
      !isHvacPackageLineCard ? (
        <Text
          style={{
            color: caption,
            fontSize: 12,
            fontWeight: '600',
            marginBottom: 8,
          }}
        >
          {display.quantityLine}
        </Text>
      ) : null}

      <Text
        style={[styles.budgetSplitHeaderTitle, { color: caption }]}
        numberOfLines={2}
        ellipsizeMode='tail'
      >
        {headerTitle}
      </Text>

      <Text
        style={[
          CONFIRM_SCOPE_PRICE_TEXT,
          { color: text, marginTop: 6 },
        ]}
        accessibilityLabel={`Suggested total ${displayTotal}`}
      >
        {displayTotal}
      </Text>

      {isHvacPackageLineCard && display.quantityLine ? (
        <Text
          style={{
            color: caption,
            fontSize: 13,
            fontWeight: '600',
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          {display.quantityLine}
        </Text>
      ) : null}

      {isFlooringLineCard && flooringTransitionDisplayLines.length ? (
        <View style={{ marginTop: 8, gap: 3 }}>
          <Text style={{ color: text, fontSize: 12, fontWeight: '700' }}>
            {flooringTransitionSummaryLabel}
          </Text>
          {flooringTransitionDisplayLines.map(line => (
            <Text
              key={line}
              style={{ color: caption, fontSize: 12, lineHeight: 16 }}
            >
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      {isInsulationAssemblyCard && insulationAssemblyRows.length ? (
        <InsulationAssemblyPricingBreakdown
          rows={insulationAssemblyRows}
          material={block.material}
          labor={block.labor}
          unitRateLine={display.unitRateLine}
          darkMode={darkMode}
          Colors={Colors}
          dividerColor={divider}
        />
      ) : display.splitLine && !isFlooringLineCard ? (
        <Text
          style={{
            color: caption,
            fontSize: 13,
            fontWeight: '500',
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          {display.splitLine}
        </Text>
      ) : null}

      {display.unitRateLine &&
      !isFlooringLineCard &&
      !isInsulationAssemblyCard ? (
        <Text
          style={{
            color: caption,
            fontSize: 12,
            marginTop: isHvacPackageLineCard ? 4 : 2,
          }}
        >
          {display.unitRateLine}
        </Text>
      ) : null}

      {(isFramingShellLineCard || isHvacPackageLineCard) &&
      packageBreakdownLines.length ? (
        <>
          <TouchableOpacity
            onPress={() => setPackageBreakdownOpen(open => !open)}
            activeOpacity={0.75}
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
          >
            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>
              {packageBreakdownOpen
                ? isHvacPackageLineCard
                  ? "Hide what's included"
                  : 'Hide package breakdown'
                : isHvacPackageLineCard
                  ? "What's included"
                  : 'View included package breakdown'}
            </Text>
          </TouchableOpacity>
          {packageBreakdownOpen ? (
            <View style={{ marginTop: 8, gap: 6 }}>
              {packageBreakdownLines.map(line => (
                <Text
                  key={`${itemId}-package-${line}`}
                  style={{ color: caption, fontSize: 12, lineHeight: 17 }}
                >
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {showFlooringBreakdownToggle ? (
        <>
          <TouchableOpacity
            onPress={() => setFlooringTransitionBreakdownOpen(open => !open)}
            activeOpacity={0.75}
            style={{ marginTop: 8, alignSelf: 'flex-start' }}
          >
            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>
              {flooringTransitionBreakdownOpen
                ? 'Hide pricing breakdown'
                : 'View pricing breakdown'}
            </Text>
          </TouchableOpacity>
          {flooringTransitionBreakdownOpen ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              <Text style={{ color: text, fontSize: 12, fontWeight: '700' }}>
                Pricing breakdown
              </Text>
              {flooringTransitionLines.map(line => (
                <Text
                  key={`detail-${line}`}
                  style={{ color: caption, fontSize: 12, lineHeight: 17 }}
                >
                  {line}
                </Text>
              ))}
              <Text style={{ color: caption, fontSize: 12, lineHeight: 17 }}>
                {flooringMaterialBucketLabel}:{' '}
                {formatDraftMoney(block.material)}
              </Text>
              <Text style={{ color: caption, fontSize: 12, lineHeight: 17 }}>
                Labor: {formatDraftMoney(block.labor)}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      {display.statusLine ? (
        <Text
          style={{
            color: display.statusTone === 'amber' ? statusAmber : caption,
            fontSize: 12,
            fontWeight: '600',
            marginTop: 8,
            lineHeight: 16,
          }}
        >
          {display.statusLine}
        </Text>
      ) : null}

      {isToiletRelocateSuggestedBlock(block.pricingRecordId) ? (
        <ToiletRelocatePricingDetails
          floorType={toiletRelocateFloorTypeFromPricingRecord(
            block.pricingRecordId
          )}
          darkMode={darkMode}
          captionColor={caption}
          textColor={text}
        />
      ) : null}

      {isShowerRoughSuggestedBlock(block.pricingRecordId) ? (
        <ShowerRoughPricingDetails
          context={
            showerRoughContextFromPricingRecord(block.pricingRecordId) ??
            buildShowerRoughPricingContext({})
          }
          darkMode={darkMode}
          captionColor={caption}
          textColor={text}
        />
      ) : null}

      {isInteriorPaintSuggestedBlock(block.pricingRecordId)
        ? (() => {
            const ctx = interiorPaintContextFromPricingRecord(
              block.pricingRecordId
            );
            if (!ctx) return null;
            return (
              <InteriorPaintPricingDetails
                sqft={ctx.sqft}
                mobilization={ctx.mobilization}
                surface={ctx.surface}
                condition={ctx.condition}
                total={block.total}
                darkMode={darkMode}
                captionColor={caption}
                textColor={text}
              />
            );
          })()
        : null}

      {stageCoversLine ? (
        <Text
          style={{
            color: caption,
            fontSize: 12,
            fontWeight: '500',
            marginTop: 6,
            lineHeight: 16,
          }}
        >
          {stageCoversLine}
        </Text>
      ) : null}

      {canWritePrice && actionLabel ? (
        <SuggestedPricingApplyButton
          label={actionLabel}
          onPress={onUsePricing}
          style={
            isNationalComparison
              ? styles.useComparisonPricingBtn
              : styles.useSuggestedPricingBtn
          }
          textStyle={
            isNationalComparison
              ? styles.useComparisonPricingBtnText
              : styles.useSuggestedPricingBtnText
          }
        />
      ) : null}
    </View>
  );
}

/** Side-by-side secondary actions — compact chips; separate targets so Compare and Edit do not mis-tap. */
function ScopeSecondaryActionButton({
  label,
  variant,
  onPress,
  expanded,
  stretch = false,
}: {
  label: string;
  variant: 'compare' | 'edit';
  onPress: () => void;
  expanded?: boolean;
  /** Fill half a row when paired; inline width when Edit stands alone. */
  stretch?: boolean;
}) {
  const { theme } = useTheme();
  const Colors = getColors(theme);
  const darkMode = theme === 'dark';
  const isCompare = variant === 'compare';
  const editIconColor = darkMode ? 'rgba(255,255,255,0.88)' : Colors.text;
  const editTextColor = darkMode ? 'rgba(255,255,255,0.88)' : Colors.text;
  const editBorderColor = darkMode ? 'rgba(255,255,255,0.22)' : Colors.line;
  const editBackgroundColor = darkMode
    ? 'rgba(255,255,255,0.06)'
    : Colors.surface2;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole='button'
      accessibilityState={expanded != null ? { expanded } : undefined}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={[
        styles.secondaryActionBtn,
        stretch
          ? styles.secondaryActionBtnStretch
          : styles.secondaryActionBtnInline,
        isCompare
          ? styles.secondaryActionBtnCompare
          : {
              backgroundColor: editBackgroundColor,
              borderColor: editBorderColor,
            },
      ]}
    >
      {isCompare ? (
        <Ionicons
          name={expanded ? 'chevron-up' : 'stats-chart-outline'}
          size={12}
          color='#fbbf24'
          style={styles.secondaryActionBtnIcon}
        />
      ) : (
        <Ionicons
          name='create-outline'
          size={12}
          color={editIconColor}
          style={styles.secondaryActionBtnIcon}
        />
      )}
      <Text
        style={[
          styles.secondaryActionBtnText,
          isCompare
            ? styles.secondaryActionBtnTextCompare
            : { color: editTextColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ScopeCardActionsRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.scopeCardActionsRow}>{children}</View>;
}

function ScopeCardActionSlot({ children }: { children: React.ReactNode }) {
  return <View style={styles.scopeCardActionSlot}>{children}</View>;
}

/** Compare + Edit on one row when both are shown; full-width Edit when compare is absent. */
function ScopePricingSecondaryActions({
  compare,
  edit,
}: {
  compare?: React.ReactNode;
  edit?: React.ReactNode;
}) {
  if (!compare && !edit) return null;
  if (!compare) {
    return (
      <View
        style={[styles.scopeCardActionsWrap, styles.scopeCardActionsWrapSingle]}
      >
        {edit}
      </View>
    );
  }
  return (
    <View style={styles.scopeCardActionsWrap}>
      <ScopeCardActionsRow>
        <ScopeCardActionSlot>{compare}</ScopeCardActionSlot>
        <ScopeCardActionSlot>{edit}</ScopeCardActionSlot>
      </ScopeCardActionsRow>
    </View>
  );
}

/** Collapsible "Compare to suggested/saved" panel shown when notes priced both legs. */
function ComparisonToggle({
  block,
  Colors,
  darkMode,
  onUsePricing,
  itemId,
  quantitySource,
  hasPrimaryTakeoff,
  livingSf,
  confidenceLabel,
  editAction,
  hasCurrentPricing = false,
}: {
  block: SuggestedPricingBlock;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onUsePricing?: () => void;
  itemId?: string;
  quantitySource?: string | null;
  hasPrimaryTakeoff?: boolean;
  livingSf?: number | null;
  confidenceLabel?: string | null;
  /** When set, Compare and Edit share one row with separate pill buttons. */
  editAction?: React.ReactNode;
  /** Active applied/entered price — national comparison is view-only. */
  hasCurrentPricing?: boolean;
}) {
  const cardProps = {
    itemId,
    quantitySource,
    hasPrimaryTakeoff,
    livingSf,
    confidenceLabel,
    hasCurrentPricing,
  };

  const isNationalComparison =
    /national\s*average\s*comparison/i.test(
      String(block.rateSourceLabel || '')
    ) ||
    (Boolean(block.isComparison) &&
      /national\s*average/i.test(String(block.rateSourceLabel || '')));

  if (isNationalComparison) {
    return (
      <View style={{ marginTop: 8 }}>
        <SuggestedBudgetSplitRows
          block={block}
          Colors={Colors}
          darkMode={darkMode}
          // Already-priced scopes keep the national row for comparison only.
          onUsePricing={hasCurrentPricing ? undefined : onUsePricing}
          forceCompact
          {...cardProps}
        />
      </View>
    );
  }

  const usesTemplate =
    block.materialSource === 'template' || block.laborSource === 'template';
  const hasBenchmark = Boolean(block.benchmarkEvidence);
  const includedInStage =
    block.benchmarkAction === 'included_in_stage' ||
    Boolean(block.includedInStageLabel);
  const comparisonOnly = Boolean(
    block.isComparison ||
    block.benchmarkEvidence?.benchmarkIsComparisonOnly ||
    includedInStage
  );
  // Included-in-stage notices stay visible; other comparisons collapse by default under semantics.
  const [open, setOpen] = useState(
    includedInStage ||
      usesTemplate ||
      (hasBenchmark && !measurementSemanticsV1Enabled())
  );

  useEffect(() => {
    if (includedInStage || usesTemplate) setOpen(true);
  }, [includedInStage, usesTemplate, block.templateName]);

  if (includedInStage) {
    return (
      <View style={{ marginTop: 8 }}>
        <SuggestedBudgetSplitRows
          block={block}
          Colors={Colors}
          darkMode={darkMode}
          onUsePricing={undefined}
          {...cardProps}
        />
      </View>
    );
  }

  const compareLabel = open ? 'Hide' : 'Benchmarks';

  const compareButton = (
    <ScopeSecondaryActionButton
      variant='compare'
      label={compareLabel}
      expanded={open}
      stretch={Boolean(editAction)}
      onPress={() => setOpen(prev => !prev)}
    />
  );

  return (
    <View style={editAction ? undefined : { marginTop: 8 }}>
      {editAction ? (
        <ScopePricingSecondaryActions
          compare={compareButton}
          edit={editAction}
        />
      ) : (
        compareButton
      )}
      {open ? (
        <SuggestedBudgetSplitRows
          block={block}
          Colors={Colors}
          darkMode={darkMode}
          // National average comparison can be applied; stage lumps stay view-only.
          onUsePricing={!comparisonOnly ? onUsePricing : undefined}
          {...cardProps}
        />
      ) : null}
    </View>
  );
}

/** Saved pricing is library-backed — Apply only; manual edit lives on Review. */
function shouldSuppressScopePricingEdit(
  primaryBlock: SuggestedPricingBlock | null | undefined
): boolean {
  return isSavedPricingBlock(primaryBlock);
}

function EditQuantityLink({
  onPress,
  label = 'Edit',
  stretch = false,
}: {
  onPress: () => void;
  label?: string;
  stretch?: boolean;
}) {
  const displayLabel = label === 'Edit pricing' ? 'Edit' : label;
  return (
    <ScopeSecondaryActionButton
      variant='edit'
      label={displayLabel}
      stretch={stretch}
      onPress={onPress}
    />
  );
}

function scopePricingEditAction(
  primaryBlock: SuggestedPricingBlock | null | undefined,
  onPress: () => void,
  stretch?: boolean
): React.ReactNode {
  if (shouldSuppressScopePricingEdit(primaryBlock)) return null;
  return <EditQuantityLink onPress={onPress} stretch={stretch} />;
}

/** Edit chrome with Done at the top so collapse stays reachable above the sticky footer. */
function PricingEditorPanel({
  children,
  Colors,
  darkMode,
}: {
  children: React.ReactNode;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const shell = inputShellStyle(Colors, darkMode);
  return (
    <View
      style={[
        styles.pricingEditorPanel,
        {
          borderColor: shell.borderColor,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.045)'
            : Colors.surface2,
        },
      ]}
    >
      {children}
    </View>
  );
}

function PricingEditorHeader({
  helper,
  onDone,
  Colors,
  darkMode,
}: {
  helper?: string | null;
  onDone: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  return (
    <View style={styles.pricingEditorPanelHeader}>
      <Text
        style={[
          styles.pricingEditorHelper,
          { color: captionColor(darkMode, Colors) },
        ]}
        numberOfLines={2}
      >
        {helper || 'Enter pricing for this scope item.'}
      </Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          Keyboard.dismiss();
          onDone();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole='button'
        accessibilityLabel='Done editing'
        style={styles.pricingEditorDoneBtn}
      >
        <Text style={styles.pricingEditorDoneBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

function PricingMatLabRow({
  material,
  labor,
}: {
  material: React.ReactNode;
  labor: React.ReactNode;
}) {
  return (
    <View style={styles.pricingMatLabRow}>
      <View style={styles.pricingMatLabCol}>{material}</View>
      <View style={styles.pricingMatLabCol}>{labor}</View>
    </View>
  );
}

function isSoftCostAllowanceScope(
  itemId: string,
  lumpSumOnly?: boolean
): boolean {
  return (
    Boolean(lumpSumOnly) ||
    itemId === 'permits' ||
    itemId === 'plans_engineering' ||
    itemId === 'cleanup'
  );
}

type AllowanceOrSplitMode = 'allowance' | 'split';

type PricingEntryMode = 'flat' | 'takeoff';

function inferPricingEntryMode(
  measurementsInput: ScopeMeasurementsInputExtended,
  sqftBasisKey: string,
  splitTotalOnly?: boolean
): PricingEntryMode {
  if (splitTotalOnly) return 'flat';
  const basis = measurementsInput.itemQuantities[sqftBasisKey];
  const basisQty = parseMoneyAmount(basis?.quantity);
  if (basisQty > 0 && basis?.quantitySource === 'user_entered')
    return 'takeoff';
  return 'flat';
}

function pricingEditorHelperForMode(
  mode: PricingEntryMode,
  fallback?: string | null
): string {
  if (mode === 'flat') {
    return 'Enter material and labor totals — no takeoff quantity required.';
  }
  return (
    fallback ||
    'Enter takeoff quantity, then material and labor (flat $ or per-unit).'
  );
}

function resolveAllowanceOrSplitMode(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  defaultUnit: string
): AllowanceOrSplitMode {
  const allowance =
    measurementsInput.itemQuantities[allowanceSplitSubKey(itemId, 'allowance')];
  const material =
    measurementsInput.itemQuantities[allowanceSplitSubKey(itemId, 'material')];
  const labor =
    measurementsInput.itemQuantities[allowanceSplitSubKey(itemId, 'labor')];
  const basis =
    measurementsInput.itemQuantities[
      allowanceSplitSubKey(itemId, 'sqft_basis')
    ];
  const item = measurementsInput.itemQuantities[itemId];
  const hasSplit =
    parseMoneyAmount(material?.quantity) > 0 ||
    parseMoneyAmount(labor?.quantity) > 0 ||
    parseMoneyAmount(basis?.quantity) > 0;
  const hasAllowance =
    parseMoneyAmount(allowance?.quantity) > 0 ||
    ((item?.unit === 'allowance' || item?.unit === 'lump_sum') &&
      parseMoneyAmount(item?.quantity) > 0);
  if (hasSplit && !hasAllowance) return 'split';
  if (hasAllowance && !hasSplit) return 'allowance';
  if (hasSplit) return 'split';
  if (hasAllowance) return 'allowance';
  return defaultUnit === 'allowance' || defaultUnit === 'lump_sum'
    ? 'allowance'
    : 'split';
}

function AllowanceOrSplitModeToggle({
  mode,
  onChange,
  Colors,
  darkMode,
  applying,
}: {
  mode: AllowanceOrSplitMode;
  onChange: (next: AllowanceOrSplitMode) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  return (
    <View style={styles.customPricingModeLinks}>
      {(
        [
          { id: 'allowance' as const, label: 'Allowance' },
          { id: 'split' as const, label: 'Material + Labor' },
        ] as const
      ).map(opt => {
        const active = mode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.75}
            disabled={applying || active}
            onPress={() => onChange(opt.id)}
            style={[
              styles.customPricingModeChip,
              {
                borderColor: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(148, 163, 184, 0.24)'
                    : Colors.line,
                backgroundColor: active
                  ? darkMode
                    ? 'rgba(34, 197, 94, 0.12)'
                    : 'rgba(34, 197, 94, 0.08)'
                  : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: active ? '#22c55e' : '#60a5fa',
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PricingEntryModeToggle({
  mode,
  onChange,
  Colors,
  darkMode,
  applying,
}: {
  mode: PricingEntryMode;
  onChange: (next: PricingEntryMode) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  return (
    <View style={styles.customPricingModeLinks}>
      {(
        [
          { id: 'flat' as const, label: 'Flat mat + lab' },
          { id: 'takeoff' as const, label: 'By takeoff' },
        ] as const
      ).map(opt => {
        const active = mode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.75}
            disabled={applying || active}
            onPress={() => onChange(opt.id)}
            style={[
              styles.customPricingModeChip,
              styles.pricingEntryModeChip,
              {
                borderColor: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(148, 163, 184, 0.24)'
                    : Colors.line,
                backgroundColor: active
                  ? darkMode
                    ? 'rgba(34, 197, 94, 0.12)'
                    : 'rgba(34, 197, 94, 0.08)'
                  : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(255,255,255,0.72)'
                    : Colors.sub,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PricingRateModeToggle({
  mode,
  onChange,
  unitLabel,
  Colors,
  darkMode,
  applying,
}: {
  mode: 'total' | 'rate';
  onChange: (next: 'total' | 'rate') => void;
  unitLabel: string;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const rateLabel = `$/${unitLabel}`;
  const options = [
    { id: 'total' as const, label: 'Total' },
    { id: 'rate' as const, label: rateLabel },
  ];
  return (
    <View
      style={styles.pricingRateModeToggleRow}
      accessibilityRole='tablist'
      accessibilityLabel='Material or labor entry mode'
    >
      {options.map(opt => {
        const active = mode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.75}
            disabled={applying}
            onPress={() => onChange(opt.id)}
            accessibilityRole='tab'
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              opt.id === 'total'
                ? 'Enter total dollar amount'
                : `Enter price per ${unitLabel}`
            }
            style={[
              styles.pricingRateModeChip,
              {
                borderColor: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(148, 163, 184, 0.24)'
                    : Colors.line,
                backgroundColor: active
                  ? darkMode
                    ? 'rgba(34, 197, 94, 0.12)'
                    : 'rgba(22, 197, 94, 0.08)'
                  : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(255,255,255,0.72)'
                    : Colors.sub,
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PricingInputField({
  label,
  value,
  helper,
  basis,
  prefix,
  suffix,
  placeholder = '0',
  defaultInputMode = 'total',
  inputMode: controlledInputMode,
  onInputModeChange,
  hideRateModeToggle = false,
  onFocus,
  onChangeText,
  onBlur,
  Colors,
  darkMode,
  applying,
  embedded = false,
  readOnly = false,
  commitOnBlur = false,
}: {
  label: string;
  value: string;
  helper?: string | null;
  basis?: { quantity: number; unit: string } | null;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  defaultInputMode?: 'total' | 'rate';
  /** When set with onInputModeChange, mat/lab fields share one total vs $/unit toggle. */
  inputMode?: 'total' | 'rate';
  onInputModeChange?: (mode: 'total' | 'rate') => void;
  hideRateModeToggle?: boolean;
  onFocus: () => void;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
  /** Inside PricingEditorPanel — no nested card chrome. */
  embedded?: boolean;
  /** Computed totals — display only. */
  readOnly?: boolean;
  /** Keep the native field stable while parent pricing state recalculates. */
  commitOnBlur?: boolean;
}) {
  const [internalInputMode, setInternalInputMode] = useState<'total' | 'rate'>(
    defaultInputMode
  );
  const inputMode = controlledInputMode ?? internalInputMode;
  const setInputMode = (next: 'total' | 'rate') => {
    onInputModeChange?.(next);
    if (controlledInputMode == null) setInternalInputMode(next);
  };
  const [rateDraft, setRateDraft] = useState('');
  const [rateEditing, setRateEditing] = useState(false);
  const [totalDraft, setTotalDraft] = useState(value);
  const [totalEditing, setTotalEditing] = useState(false);
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const supportsRateMode =
    Boolean(basis?.quantity && basis.quantity > 0) && !readOnly;
  const amount = Number(String(value || '').replace(/,/g, ''));
  const rateValue =
    supportsRateMode && Number.isFinite(amount) && amount > 0
      ? String(Math.round((amount / basis!.quantity) * 100) / 100)
      : '';
  const displayValue =
    inputMode === 'rate'
      ? rateEditing
        ? rateDraft
        : rateValue
      : commitOnBlur && totalEditing
        ? totalDraft
        : value;
  const activePrefix = inputMode === 'rate' ? '$' : prefix;
  const activeSuffix =
    inputMode === 'rate' && basis ? `/${formatUnitLabel(basis.unit)}` : suffix;
  const helperText =
    inputMode === 'rate' && Number.isFinite(amount) && amount > 0
      ? `Total ${formatDraftMoney(amount)}`
      : helper;
  const unitLabel = basis ? formatUnitLabel(basis.unit) : 'unit';
  const fieldPlaceholder =
    supportsRateMode && inputMode === 'rate'
      ? `$/${unitLabel}`
      : supportsRateMode
        ? '0'
        : placeholder;
  const isEmptyValue = !String(displayValue || '').trim();
  useEffect(() => {
    if (inputMode === 'rate' && !rateEditing) {
      setRateDraft(rateValue);
    }
  }, [inputMode, rateEditing, rateValue]);
  useEffect(() => {
    if (commitOnBlur && !totalEditing) setTotalDraft(value);
  }, [commitOnBlur, totalEditing, value]);
  const handleChangeText = (text: string) => {
    if (inputMode === 'rate' && basis?.quantity) {
      const normalized = String(text || '')
        .replace(/,/g, '')
        .replace(/[^\d.]/g, '');
      if (!/^\d*\.?\d*$/.test(normalized)) return;
      setRateDraft(normalized);
      if (!normalized || normalized === '.') {
        onChangeText('');
        return;
      }
      const rate = Number(normalized);
      if (!Number.isFinite(rate)) {
        onChangeText('');
        return;
      }
      onChangeText(String(Math.round(rate * basis.quantity * 100) / 100));
      return;
    }
    if (commitOnBlur) {
      setTotalDraft(text);
      return;
    }
    onChangeText(text);
  };

  return (
    <View
      style={
        embedded
          ? styles.pricingInputEmbedded
          : [
              styles.pricingInputCard,
              {
                borderColor: inputShell.borderColor,
                backgroundColor: darkMode
                  ? 'rgba(255,255,255,0.035)'
                  : 'rgba(248,250,252,0.9)',
              },
            ]
      }
    >
      <View style={styles.pricingInputHeader}>
        <Text
          style={{
            color: embedded
              ? darkMode
                ? 'rgba(255,255,255,0.72)'
                : Colors.sub
              : Colors.sub,
            fontSize: embedded ? 11 : 12,
            fontWeight: '700',
            flex: hideRateModeToggle ? 1 : undefined,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
        {supportsRateMode && !hideRateModeToggle ? (
          <PricingRateModeToggle
            mode={inputMode}
            onChange={next => {
              setRateEditing(false);
              setTotalEditing(false);
              setInputMode(next);
            }}
            unitLabel={unitLabel}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying ?? false}
          />
        ) : null}
      </View>
      <View
        style={[
          styles.pricingInputRow,
          embedded ? styles.pricingInputRowEmbedded : null,
          {
            borderColor: inputShell.borderColor,
            backgroundColor: inputShell.backgroundColor,
            justifyContent: isEmptyValue ? 'center' : 'flex-start',
          },
        ]}
      >
        {activePrefix ? (
          <Text
            style={[
              styles.pricingCurrencyPrefix,
              {
                color: isEmptyValue ? placeholderColor : Colors.text,
              },
            ]}
          >
            {activePrefix}
          </Text>
        ) : null}
        <TextInput
          value={displayValue}
          onFocus={() => {
            if (inputMode === 'rate') {
              setRateEditing(true);
              setRateDraft(rateValue);
            } else if (commitOnBlur) {
              setTotalEditing(true);
              setTotalDraft(value);
            }
            onFocus();
          }}
          onChangeText={handleChangeText}
          onBlur={() => {
            setRateEditing(false);
            if (commitOnBlur) {
              setTotalEditing(false);
              onChangeText(totalDraft);
            }
            onBlur();
          }}
          placeholder={fieldPlaceholder}
          placeholderTextColor={placeholderColor}
          keyboardType='decimal-pad'
          {...scopeNumericInputProps}
          editable={!applying && !readOnly}
          style={[
            activePrefix ? styles.pricingInputPrefixed : styles.pricingInput,
            {
              color: isEmptyValue ? placeholderColor : Colors.text,
            },
            isEmptyValue && !embedded && !activePrefix
              ? {
                  flex: 0,
                  width: Math.min(
                    200,
                    Math.max(128, String(placeholder || '').length * 8.5)
                  ),
                }
              : null,
          ]}
        />
        {activeSuffix ? (
          <Text
            style={{
              color: Colors.sub,
              fontSize: 12,
              fontWeight: '600',
              minWidth: embedded ? 28 : 40,
              lineHeight: 20,
              ...(Platform.OS === 'android'
                ? {
                    includeFontPadding: false,
                    textAlignVertical: 'center' as const,
                  }
                : null),
            }}
          >
            {activeSuffix}
          </Text>
        ) : null}
      </View>
      {helperText ? (
        <Text
          style={{
            color: darkMode ? 'rgba(148, 163, 184, 0.9)' : '#64748b',
            fontSize: 10,
            fontWeight: '600',
            marginTop: 4,
            lineHeight: 14,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

function parseBudgetSplitBasis(block: SuggestedPricingBlock | null) {
  if (block?.basis && block.basis.quantity > 0) {
    return { quantity: block.basis.quantity, unit: block.basis.unit };
  }
  const match = block?.helper?.match(/^([\d,.]+)\s+([A-Z]+)/i);
  if (!match) return null;
  const quantity = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const unit =
    match[2].toLowerCase() === 'sqft' ? 'sqft' : match[2].toLowerCase();
  return { quantity, unit };
}

function unitRateHelper(
  amountValue: string | undefined,
  basis: { quantity: number; unit: string } | null | undefined
): string | null {
  const amount = Number(String(amountValue || '').replace(/,/g, ''));
  if (!basis || !Number.isFinite(amount) || amount <= 0 || basis.quantity <= 0)
    return null;
  const rate = Math.round((amount / basis.quantity) * 100) / 100;
  return `${formatDraftMoney(rate)} / ${formatUnitLabel(basis.unit)}`;
}

function scoreScopeNotesForMeasurements(
  notes: string,
  templateKey?: string | null,
  projectType?: string | null
): number {
  const text = String(notes || '').trim();
  if (!text) return 0;
  const parsed = parseScopeMeasurementsFromNotes(text, {
    templateKey: templateKey ?? undefined,
    projectType: projectType ?? undefined,
  });
  let score = Math.min(text.length, 500) / 1000;
  if (parsed.bathroomFloorSqft) score += 8;
  if (parsed.kitchenFloorSqft) score += 8;
  if (parsed.floorAreaSqft) score += 8;
  if (parsed.baseboardLf) score += 5;
  if (parsed.itemQuantities?.floor_demo?.quantity) score += 8;
  if (parsed.itemQuantities?.trim?.quantity) score += 3;
  if (/\bnot\s+priced\s+yet\b/i.test(text)) score += 3;
  return score;
}

function chooseBestScopeNotes(
  draft: EstimateAiDraft | null,
  notesFallback?: string | null
): string {
  const candidates = [
    String(notesFallback || '').trim(),
    resolveDraftScopeNotes(draft),
    String(draft?.originalNotes || '').trim(),
    String(draft?.projectDescription || '').trim(),
    String(draft?.contractScope || '').trim(),
    String(draft?.scopeChecklist?.intro || '').trim(),
  ].filter(Boolean);

  let best = '';
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreScopeNotesForMeasurements(
      candidate,
      draft?.scopeChecklist?.templateKey,
      draft?.projectType
    );
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function scopeCardStyle(
  tier: ReturnType<typeof scopeItemVisualTier>,
  item: Pick<
    ScopeChecklistItem,
    'state' | 'choiceId' | 'inputType' | 'choiceIds' | 'noteBacked'
  >,
  Colors: ReturnType<typeof getColors>,
  darkMode: boolean,
  measuredSelection = false
) {
  const accent = scopeCardAccentForItem(
    tier,
    item,
    darkMode,
    measuredSelection
  );
  return [
    styles.card,
    estimateFlowCardStyle(Colors, darkMode),
    {
      backgroundColor:
        accent.backgroundColor ||
        (darkMode ? '#202022' : Colors.surface),
      opacity: accent.opacity,
      ...(accent.borderColor ? { borderColor: accent.borderColor } : {}),
    },
  ];
}

function isCustomScopeItem(item: ScopeChecklistItem): boolean {
  return isCustomScopeChecklistItem(item);
}

function CustomScopeItemComposer({
  label,
  onChangeLabel,
  onAdd,
  onCancel,
  applying,
  placeholder,
  Colors,
  darkMode,
}: {
  label: string;
  onChangeLabel: (text: string) => void;
  onAdd: () => void;
  onCancel: () => void;
  applying: boolean;
  placeholder: string;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const trimmed = label.trim();
  return (
    <View
      style={[
        styles.card,
        estimateFlowCardStyle(Colors, darkMode),
        {
          backgroundColor: darkMode ? '#202022' : Colors.surface,
        },
      ]}
    >
      <ScopeItemTitleRow
        label='New scope item'
        darkMode={darkMode}
        Colors={Colors}
      />
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          marginTop: 3,
          lineHeight: 15,
        }}
      >
        Describe work not covered by the template. You can price it after adding.
      </Text>
      <TextInput
        value={label}
        onChangeText={onChangeLabel}
        placeholder={placeholder}
        placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
        onSubmitEditing={() => {
          if (label.trim()) onAdd();
        }}
        editable={!applying}
        style={[
          styles.customRenameInput,
          {
            alignSelf: 'stretch',
            marginTop: 10,
            color: Colors.text,
            borderColor: darkMode
              ? 'rgba(148, 163, 184, 0.16)'
              : Colors.line,
            backgroundColor: darkMode
              ? 'rgba(255,255,255,0.05)'
              : Colors.surface2,
          },
        ]}
        {...resolveTextInputKeyboardProps()}
      />
      <View style={styles.customComposerActions}>
        <TouchableOpacity
          onPress={onCancel}
          disabled={applying}
          activeOpacity={0.75}
          style={styles.customComposerCancelBtn}
        >
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 13,
              fontWeight: '700',
            }}
          >
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.customComposerAddBtn,
            !trimmed && { opacity: 0.45 },
          ]}
          onPress={onAdd}
          disabled={applying || !trimmed}
          activeOpacity={0.88}
        >
          <Text style={styles.customComposerAddBtnText}>Add to scope</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

type NotesScopeMode = 'whole_project' | 'plumbing' | 'plumbing_service';

const NotesScopeSelector = React.memo(function NotesScopeSelector({
  mode,
  disabled,
  Colors,
  darkMode,
  onChange,
}: {
  mode: NotesScopeMode;
  disabled: boolean;
  Colors: { text: string; line: string };
  darkMode: boolean;
  onChange?: (mode: NotesScopeMode) => void;
}) {
  const [optimisticMode, setOptimisticMode] = useState<NotesScopeMode>(mode);

  useEffect(() => {
    setOptimisticMode(mode);
  }, [mode]);

  const panelStyle = qmNeutralScopePanelStyle(darkMode);

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: panelStyle.borderColor,
        backgroundColor: panelStyle.backgroundColor,
        padding: 14,
        marginBottom: 12,
        gap: 12,
      }}
    >
      <Text
        style={{
          color: panelStyle.titleColor,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 2,
        }}
      >
        Notes estimate scope
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(
          [
            ['whole_project', 'Whole Project / General Contractor'],
            ['plumbing', 'Single Trade / Plumbing Only'],
            ['plumbing_service', 'Plumbing Service'],
          ] as Array<[NotesScopeMode, string]>
        ).map(([nextMode, label]) => (
          <TouchableOpacity
            key={nextMode}
            disabled={disabled}
            activeOpacity={1}
            onPress={() => {
              setOptimisticMode(nextMode);
              onChange?.(nextMode);
            }}
            style={{
              borderRadius: 15,
              borderWidth: 1,
              borderColor:
                optimisticMode === nextMode ? '#22c55e' : Colors.line,
              backgroundColor:
                optimisticMode === nextMode
                  ? 'rgba(34,197,94,0.12)'
                  : 'transparent',
              paddingHorizontal: 9,
              paddingVertical: 7,
            }}
          >
            <Text
              style={{
                color: darkMode ? '#F5F7FA' : Colors.text,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

function customScopePricingTotal(
  measurementsInput: ScopeMeasurementsInputExtended,
  itemId: string
): number {
  const base = measurementsInput.itemQuantities[itemId];
  const allowance = measurementsInput.itemQuantities[`${itemId}__allowance`];
  const material = measurementsInput.itemQuantities[`${itemId}__material`];
  const labor = measurementsInput.itemQuantities[`${itemId}__labor`];
  const total =
    Number(allowance?.quantity || 0) ||
    (base?.unit === 'allowance' ? Number(base.quantity || 0) : 0) ||
    Number(material?.quantity || 0) + Number(labor?.quantity || 0);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

function CustomScopeUnitToggle({
  selectedUnit,
  onSelect,
  Colors,
  darkMode,
  applying,
}: {
  selectedUnit: ReturnType<typeof resolveCustomScopePricingUnit>;
  onSelect: (unit: ReturnType<typeof resolveCustomScopePricingUnit>) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  return (
    <View style={[styles.customPricingModeLinks, styles.customScopeUnitRow]}>
      {CUSTOM_SCOPE_PRICING_UNITS.map(unit => {
        const active = selectedUnit === unit;
        return (
          <TouchableOpacity
            key={unit}
            activeOpacity={0.75}
            disabled={applying || active}
            onPress={() => onSelect(unit)}
            style={[
              styles.customPricingModeChip,
              styles.pricingEntryModeChip,
              {
                borderColor: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(148, 163, 184, 0.2)'
                    : Colors.line,
                backgroundColor: active
                  ? darkMode
                    ? 'rgba(34, 197, 94, 0.12)'
                    : 'rgba(34, 197, 94, 0.08)'
                  : darkMode
                    ? 'rgba(255,255,255,0.03)'
                    : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: active
                  ? '#22c55e'
                  : darkMode
                    ? 'rgba(255,255,255,0.72)'
                    : Colors.sub,
                fontSize: 11,
                fontWeight: '800',
              }}
            >
              {formatUnitLabel(unit)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CustomScopePricingSection({
  itemId,
  itemLabel,
  templateKey,
  inScope,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onSavePricing,
  onClearAcceptedPricing,
  Colors,
  darkMode,
  applying,
}: {
  itemId: string;
  itemLabel: string;
  templateKey?: string | null;
  inScope: boolean;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string,
    source?: QuantitySource,
    calculatedRevertFrom?: CalculatedQuantityRevertSnapshot
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onSavePricing?: () => void;
  onClearAcceptedPricing?: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const [pricingEditorOpen, setPricingEditorOpen] = useState(false);
  if (!inScope) return null;
  const itemInput = measurementsInput.itemQuantities[itemId];
  const materialKey = `${itemId}__material`;
  const laborKey = `${itemId}__labor`;
  const allowanceKey = `${itemId}__allowance`;
  const materialValue =
    measurementsInput.itemQuantities[materialKey]?.quantity ?? '';
  const laborValue = measurementsInput.itemQuantities[laborKey]?.quantity ?? '';
  const selectedUnit =
    itemInput?.unit === 'allowance' || itemInput?.unit === 'each'
      ? 'sqft'
      : resolveCustomScopePricingUnit(itemInput?.unit);
  const basis = {
    quantity: Number(String(itemInput?.quantity || '').replace(/,/g, '')),
    unit: selectedUnit,
  };
  const validBasis =
    basis && Number.isFinite(basis.quantity) && basis.quantity > 0
      ? basis
      : null;
  const draftPricing = resolveCustomScopeDraftPricing({
    materialValue,
    laborValue,
    basisQuantity: validBasis?.quantity,
  });
  const materialEditorValue = validBasis
    ? customScopeEditorRateValue(materialValue, validBasis.quantity)
    : materialValue;
  const laborEditorValue = validBasis
    ? customScopeEditorRateValue(laborValue, validBasis.quantity)
    : laborValue;
  const syncAllowanceTotal = (material: string, labor: string) => {
    const total = resolveCustomScopeDraftPricing({
      materialValue: material,
      laborValue: labor,
      basisQuantity: validBasis?.quantity,
    }).total;
    return total > 0 ? String(Math.round(total * 100) / 100) : '';
  };
  const handleMaterialChange = (text: string) => {
    onItemQuantityChange(materialKey, text, 'count', 'allowance', 'user_entered');
    onItemQuantityChange(
      allowanceKey,
      syncAllowanceTotal(text, laborEditorValue),
      'count',
      'allowance',
      'user_entered'
    );
  };
  const handleLaborChange = (text: string) => {
    onItemQuantityChange(laborKey, text, 'count', 'allowance', 'user_entered');
    onItemQuantityChange(
      allowanceKey,
      syncAllowanceTotal(materialEditorValue, text),
      'count',
      'allowance',
      'user_entered'
    );
  };
  const draftTotalAmount = draftPricing.total;
  const matLabUnitLabel = validBasis
    ? ` · $/${formatUnitLabel(selectedUnit)}`
    : '';
  const norm = buildNormFromInput(
    measurementsInput,
    null,
    templateKey
  );
  const resolved = resolveChecklistItemQuantity(itemId, norm, {
    templateKey,
  });
  const accepted = isCustomScopePricingApplied(
    itemId,
    measurementsInput.pricingAcceptance
  );
  const intelligence = resolveScopeItemIntelligence({
    scopeKey: itemId,
    templateKey,
    measurements: norm,
    resolved,
    pricingAcceptance: measurementsInput.pricingAcceptance,
    itemQuantities: measurementsInput.itemQuantities,
    pricingAccepted: accepted,
  });
  const acceptedDisplay = accepted
    ? resolveAcceptedPricingDisplay({
        itemId,
        resolved,
        acceptance: measurementsInput.pricingAcceptance?.[itemId],
        intelligence,
      })
    : null;
  const showEditor = !accepted || pricingEditorOpen;

  if (!showEditor && accepted && acceptedDisplay) {
    return (
      <View
        style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}
      >
        <AcceptedPricingSummary
          display={acceptedDisplay}
          intelligence={intelligence}
          scopeKey={itemId}
          scopeItemLabel={itemLabel}
          resolved={resolved}
          Colors={Colors}
          darkMode={darkMode}
          onEditPricing={() => setPricingEditorOpen(true)}
          onClearPricing={() => setPricingEditorOpen(true)}
          hideEditLink
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}
    >
      <Text
        style={{
          color: Colors.text,
          fontSize: 12,
          fontWeight: '800',
          marginBottom: 8,
        }}
      >
        Price this item
      </Text>
      <PricingEditorPanel Colors={Colors} darkMode={darkMode}>
        <Text
          style={[
            styles.pricingEditorHelper,
            { color: captionColor(darkMode, Colors), marginBottom: 0 },
          ]}
        >
          {validBasis
            ? `Enter $/${formatUnitLabel(selectedUnit)} rates for material and labor. Total updates below.`
            : 'Enter material and labor. Add a quantity when you want $/unit rates.'}
        </Text>
        <CustomScopeUnitToggle
          selectedUnit={selectedUnit}
          onSelect={unit =>
            onItemQuantityChange(
              itemId,
              itemInput?.quantity ?? '',
              'count',
              unit,
              'user_entered'
            )
          }
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
        <PricingInputField
          label='Quantity'
          value={itemInput?.quantity ?? ''}
          suffix={formatUnitLabel(selectedUnit)}
          placeholder='Optional'
          embedded
          onFocus={() => onItemQuantityFocus(itemId)}
          onChangeText={text =>
            onItemQuantityChange(
              itemId,
              text,
              'count',
              selectedUnit,
              'user_entered'
            )
          }
          onBlur={() => onItemQuantityBlur(itemId)}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
        <PricingMatLabRow
          material={
            <PricingInputField
              label={`Material${matLabUnitLabel}`}
              value={materialEditorValue}
              prefix='$'
              placeholder='0'
              embedded
              onFocus={() => onItemQuantityFocus(materialKey)}
              onChangeText={handleMaterialChange}
              onBlur={() => onItemQuantityBlur(materialKey)}
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          }
          labor={
            <PricingInputField
              label={`Labor${matLabUnitLabel}`}
              value={laborEditorValue}
              prefix='$'
              placeholder='0'
              embedded
              onFocus={() => onItemQuantityFocus(laborKey)}
              onChangeText={handleLaborChange}
              onBlur={() => onItemQuantityBlur(laborKey)}
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          }
        />
        {draftTotalAmount > 0 ? (
          <View
            style={[
              styles.pricingEditorTotalRow,
              {
                borderTopColor: darkMode
                  ? 'rgba(148, 163, 184, 0.18)'
                  : Colors.line,
              },
            ]}
          >
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              Total
            </Text>
            <Text
              style={{
                color: darkMode ? '#F5F7FA' : Colors.text,
                fontSize: 15,
                fontWeight: '800',
              }}
            >
              {formatDraftMoney(draftTotalAmount)}
            </Text>
          </View>
        ) : null}
      </PricingEditorPanel>
      {parsePricingAmount(materialEditorValue) > 0 &&
      parsePricingAmount(laborEditorValue) > 0 ? (
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={applying}
          onPress={() => {
            setPricingEditorOpen(false);
            setTimeout(() => {
              Keyboard.dismiss();
              onSavePricing?.();
            }, 120);
          }}
          style={[styles.savePricingBtn, applying && styles.primaryBtnDisabled]}
        >
          <Text style={styles.savePricingBtnText}>Apply pricing</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function buildNormFromInput(
  input: ScopeMeasurementsInputExtended,
  notes?: string | null,
  templateKey?: string | null
) {
  return buildNormalizedScopeMeasurementsFromInput(input, {
    notes,
    templateKey,
  });
}

function noteQuantityForScopeItem(
  itemId: string,
  parsed: ReturnType<typeof parseScopeMeasurementsFromNotes>
): number | null {
  const keyByItem: Record<string, keyof typeof parsed> = {
    floor_demo: 'floorDemoSqft',
    floor_prep: 'floorPrepSqft',
    flooring: 'flooringSqft',
    flooring_lvp: 'flooringLvpSqft',
    flooring_laminate: 'flooringLaminateSqft',
    flooring_engineered_hardwood: 'flooringEngineeredHardwoodSqft',
    flooring_solid_hardwood: 'flooringSolidHardwoodSqft',
    tile_flooring: 'flooringTileSqft',
    flooring_carpet: 'flooringCarpetSqft',
    trim: 'baseboardLf',
  };
  const key = keyByItem[itemId];
  if (!key) return null;
  const value = Number(parsed[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

type UnconfirmedSuggestedPricing = {
  itemId: string;
  label: string;
  block: SuggestedPricingBlock;
};

function parseMoneyAmount(value: string | number | null | undefined): number {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Catalog $/unit rates for takeoff scaling (independent of stale editor totals). */
function nationalAverageUnitRates(
  itemId?: string,
  unit?: string | null
): { materialRate: number; laborRate: number } | null {
  if (!itemId) return null;
  const average = getNationalAverageBudgetSplit(itemId, unit);
  if (!average) return null;
  const materialRate =
    Number(average.material) > 0 ? Number(average.material) : 0;
  const laborRate = Number(average.labor) > 0 ? Number(average.labor) : 0;
  if (materialRate <= 0 && laborRate <= 0) return null;
  return { materialRate, laborRate };
}

/** True when current mat/lab totals are a scale of the catalog $/unit rates. */
function totalsMatchUnitRates(
  materialTotal: number,
  laborTotal: number,
  rates: { materialRate: number; laborRate: number } | null | undefined
): boolean {
  if (!rates) return false;
  if (!(materialTotal > 0) || !(laborTotal > 0)) return false;
  if (!(rates.materialRate > 0) || !(rates.laborRate > 0)) return false;
  const materialScale = materialTotal / rates.materialRate;
  const laborScale = laborTotal / rates.laborRate;
  if (!(materialScale > 0.01) || !(laborScale > 0.01)) return false;
  return (
    Math.abs(materialScale - laborScale) / Math.max(materialScale, laborScale) <
    0.02
  );
}

/** Unit rates from a suggested pricing block (Material/Labor or Equipment+Labor). */
function suggestedUnitRatesFromBlock(
  block: SuggestedPricingBlock | null | undefined,
  basisQty: number,
  itemId?: string,
  unit?: string
): { materialRate: number; laborRate: number } | null {
  // Keep the exact national-average rate shown in the suggestion when it has
  // already been adjusted for the current region. Falling back to the raw
  // catalog here made Takeoff change $108.50 to $105 for the same 50 sqft.
  const suggestedBasisQty = Number(block?.basis?.quantity);
  const usesNationalAverage =
    block?.materialSource === 'national_average' ||
    block?.laborSource === 'national_average' ||
    /national average|national planning rate/i.test(
      String(block?.rateSourceLabel || '')
    );
  if (
    usesNationalAverage &&
    Number.isFinite(suggestedBasisQty) &&
    suggestedBasisQty > 0 &&
    Number(block?.material) >= 0 &&
    Number(block?.labor) >= 0
  ) {
    return {
      materialRate: roundMoney2(Number(block?.material) / suggestedBasisQty),
      laborRate: roundMoney2(Number(block?.labor) / suggestedBasisQty),
    };
  }

  // Catalog rates win for takeoff scaling. Block totals are often stale for a
  // different count (e.g. $325+$475 left over from qty 1 while count is 2/3).
  const nationalRates = nationalAverageUnitRates(
    itemId,
    unit || block?.basis?.unit
  );
  if (nationalRates) return nationalRates;

  if (!block || !(basisQty > 0)) return null;
  const materialBucket =
    block.costBuckets?.find(
      b => b.key === 'material' || b.key === 'equipment'
    ) ?? null;
  const laborBucket = block.costBuckets?.find(b => b.key === 'labor') ?? null;
  const materialAmount = materialBucket?.amount ?? block.material ?? 0;
  const laborAmount = laborBucket?.amount ?? block.labor ?? 0;
  const materialRate =
    materialBucket?.rate != null && materialBucket.rate > 0
      ? materialBucket.rate
      : materialAmount > 0
        ? roundMoney2(materialAmount / basisQty)
        : 0;
  const laborRate =
    laborBucket?.rate != null && laborBucket.rate > 0
      ? laborBucket.rate
      : laborAmount > 0
        ? roundMoney2(laborAmount / basisQty)
        : 0;
  if (materialRate <= 0 && laborRate <= 0) return null;
  return { materialRate, laborRate };
}

function resolveTakeoffScaleRates(params: {
  itemId: string;
  unit: string;
  suggestedBlock: SuggestedPricingBlock | null | undefined;
  suggestedBasisQty: number;
  materialTotal: number;
  laborTotal: number;
  quantity: number;
  lockedMaterialRate: number | null;
  lockedLaborRate: number | null;
  userEditedRates: boolean;
}): { materialRate: number | null; laborRate: number | null } {
  const catalogRates = suggestedUnitRatesFromBlock(
    params.suggestedBlock,
    params.suggestedBasisQty > 0 ? params.suggestedBasisQty : 1,
    params.itemId,
    params.unit
  );

  // Manual Material/Labor edits keep custom $/unit rates across count changes.
  if (params.userEditedRates) {
    return {
      materialRate: params.lockedMaterialRate,
      laborRate: params.lockedLaborRate,
    };
  }

  // Stale editor totals that are still a multiple of catalog rates → use catalog
  // (covers the sink/faucet bug where $325+$475 stayed put at qty 2/3).
  if (
    catalogRates &&
    totalsMatchUnitRates(params.materialTotal, params.laborTotal, catalogRates)
  ) {
    return catalogRates;
  }

  // Once a takeoff rate has been established, keep it stable while the
  // quantity field changes. Reading the still-rendered totals here would
  // divide by the latest intermediate quantity and compound the rate on each
  // keystroke.
  if (
    !params.userEditedRates &&
    (params.lockedMaterialRate != null || params.lockedLaborRate != null)
  ) {
    return {
      materialRate: params.lockedMaterialRate,
      laborRate: params.lockedLaborRate,
    };
  }

  // Non-catalog totals already in the editor → treat as custom $/unit.
  if (
    params.quantity > 0 &&
    (params.materialTotal > 0 || params.laborTotal > 0) &&
    !(
      catalogRates &&
      totalsMatchUnitRates(
        params.materialTotal,
        params.laborTotal,
        catalogRates
      )
    )
  ) {
    // Empty legs still fall back to catalog when available.
    return {
      materialRate:
        params.materialTotal > 0
          ? roundMoney2(params.materialTotal / params.quantity)
          : (catalogRates?.materialRate ?? null),
      laborRate:
        params.laborTotal > 0
          ? roundMoney2(params.laborTotal / params.quantity)
          : (catalogRates?.laborRate ?? null),
    };
  }

  if (catalogRates) return catalogRates;

  if (params.lockedMaterialRate != null || params.lockedLaborRate != null) {
    return {
      materialRate: params.lockedMaterialRate,
      laborRate: params.lockedLaborRate,
    };
  }

  return { materialRate: null, laborRate: null };
}

/**
 * Material + Labor editor: prefills from Suggested pricing when empty, and keeps
 * $/unit rates stable when Pricing basis quantity changes.
 */
function MaterialLaborSplitEditor({
  itemId,
  materialValue,
  laborValue,
  pricingBasisValue,
  pricingBasis,
  basisUnit,
  basisUnitLabel,
  basisFieldLabel = 'Pricing basis',
  suggestedBlock,
  sqftBasisKey,
  materialKey,
  laborKey,
  onBatchItemQuantityChange,
  focusQuantityField,
  blurQuantityField,
  Colors,
  darkMode,
  applying,
  splitTotalOnly = false,
  entryMode = 'flat',
  getPendingUpdatesRef,
}: {
  itemId: string;
  materialValue: string;
  laborValue: string;
  pricingBasisValue: string;
  pricingBasis: { quantity: number; unit: string } | null;
  basisUnit: string;
  basisUnitLabel: string;
  basisFieldLabel?: string;
  suggestedBlock: SuggestedPricingBlock | null;
  sqftBasisKey: string;
  materialKey: string;
  laborKey: string;
  onBatchItemQuantityChange: (
    updates: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  focusQuantityField: (
    targetItemId: string,
    field?: 'count' | 'allowance'
  ) => void;
  blurQuantityField: (
    targetItemId: string,
    field?: 'count' | 'allowance'
  ) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
  splitTotalOnly?: boolean;
  /** Flat $ mat/lab vs takeoff-linked qty with optional $/unit. */
  entryMode?: PricingEntryMode;
  getPendingUpdatesRef?: React.MutableRefObject<
    | (() => Array<{
        itemId: string;
        quantity: string;
        unit?: string;
        quantitySource?: 'user_entered' | 'suggested_prefill';
      }>)
    | null
  >;
}) {
  const lockedRatesRef = useRef<{
    material: number | null;
    labor: number | null;
  }>({
    material: null,
    labor: null,
  });
  const lastBasisQtyRef = useRef<number | null>(null);
  const didPrefillRef = useRef(false);
  /** True only after the contractor types Material/Labor — not after catalog prefill. */
  const userEditedRatesRef = useRef(false);
  const [basisFocused, setBasisFocused] = useState(false);
  const [basisDraft, setBasisDraft] = useState(pricingBasisValue);
  const [matLabInputMode, setMatLabInputMode] = useState<'total' | 'rate'>(
    'total'
  );

  const effectiveBasisQty =
    parseMoneyAmount(basisFocused ? basisDraft : pricingBasisValue) ||
    (pricingBasis && pricingBasis.quantity > 0 ? pricingBasis.quantity : 0);

  const scaleRatesForQuantity = (nextQty: number, previousQty: number) =>
    resolveTakeoffScaleRates({
      itemId,
      unit: basisUnit,
      suggestedBlock,
      suggestedBasisQty:
        suggestedBlock?.basis?.quantity && suggestedBlock.basis.quantity > 0
          ? suggestedBlock.basis.quantity
          : previousQty > 0
            ? previousQty
            : 1,
      materialTotal: parseMoneyAmount(materialValue),
      laborTotal: parseMoneyAmount(laborValue),
      quantity: previousQty > 0 ? previousQty : nextQty,
      lockedMaterialRate: lockedRatesRef.current.material,
      lockedLaborRate: lockedRatesRef.current.labor,
      userEditedRates: userEditedRatesRef.current,
    });

  useEffect(() => {
    if (!getPendingUpdatesRef) return;
    getPendingUpdatesRef.current = () => {
      if (entryMode !== 'takeoff' || splitTotalOnly) return [];
      const nextQty = parseMoneyAmount(basisDraft) || effectiveBasisQty;
      const previousQty = lastBasisQtyRef.current ?? effectiveBasisQty;
      if (!(nextQty > 0)) return [];
      const { materialRate, laborRate } = scaleRatesForQuantity(
        nextQty,
        previousQty
      );
      lockedRatesRef.current = {
        material: materialRate,
        labor: laborRate,
      };
      const updates = [
        {
          itemId: sqftBasisKey,
          quantity: basisDraft || String(nextQty),
          unit: basisUnit,
          quantitySource: 'user_entered' as const,
        },
      ];
      if (!(nextQty > 0)) {
        updates.push(
          {
            itemId,
            quantity: '',
            unit: basisUnit,
            quantitySource: 'user_entered' as const,
          },
          {
            itemId: materialKey,
            quantity: '',
            unit: 'allowance',
            quantitySource: 'user_entered' as const,
          },
          {
            itemId: laborKey,
            quantity: '',
            unit: 'allowance',
            quantitySource: 'user_entered' as const,
          },
          {
            itemId: materialKey.replace(/__material$/, '__allowance'),
            quantity: '',
            unit: 'allowance',
            quantitySource: 'user_entered' as const,
          }
        );
        lastBasisQtyRef.current = null;
        return updates;
      }
      if (nextQty > 0 && materialRate != null && materialRate > 0) {
        updates.push({
          itemId: materialKey,
          quantity: String(roundMoney2(materialRate * nextQty)),
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        });
      }
      if (nextQty > 0 && laborRate != null && laborRate > 0) {
        updates.push({
          itemId: laborKey,
          quantity: String(roundMoney2(laborRate * nextQty)),
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        });
      }
      if (nextQty > 0 && materialRate != null && laborRate != null) {
        updates.push({
          itemId: materialKey.replace(/__material$/, '__allowance'),
          quantity: String(roundMoney2((materialRate + laborRate) * nextQty)),
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        });
      }
      lastBasisQtyRef.current = nextQty > 0 ? nextQty : null;
      return updates;
    };
    return () => {
      getPendingUpdatesRef.current = null;
    };
  }, [
    getPendingUpdatesRef,
    entryMode,
    splitTotalOnly,
    basisFocused,
    basisDraft,
    pricingBasisValue,
    sqftBasisKey,
    basisUnit,
    materialKey,
    laborKey,
    materialValue,
    laborValue,
    effectiveBasisQty,
    suggestedBlock,
    itemId,
  ]);

  useEffect(() => {
    if (!basisFocused) {
      setBasisDraft(pricingBasisValue);
    }
  }, [pricingBasisValue, basisFocused]);

  // Prefill empty Material/Labor from Suggested pricing once per editor open.
  useEffect(() => {
    if (didPrefillRef.current) return;
    const mat = parseMoneyAmount(materialValue);
    const lab = parseMoneyAmount(laborValue);
    if (mat > 0 || lab > 0) {
      didPrefillRef.current = true;
      if (entryMode === 'takeoff' && effectiveBasisQty > 0) {
        const rates = resolveTakeoffScaleRates({
          itemId,
          unit: basisUnit,
          suggestedBlock,
          suggestedBasisQty:
            suggestedBlock?.basis?.quantity && suggestedBlock.basis.quantity > 0
              ? suggestedBlock.basis.quantity
              : 1,
          materialTotal: mat,
          laborTotal: lab,
          quantity: effectiveBasisQty,
          lockedMaterialRate: null,
          lockedLaborRate: null,
          userEditedRates: false,
        });
        const materialRate = rates.materialRate;
        const laborRate = rates.laborRate;
        if (materialRate != null)
          lockedRatesRef.current.material = materialRate;
        if (laborRate != null) lockedRatesRef.current.labor = laborRate;
        lastBasisQtyRef.current = effectiveBasisQty;
        // Always reseed takeoff totals from catalog/custom $/unit × count so a
        // stale $325+$475 (or $487.50+$712.50) does not stick at the wrong qty.
        if (
          (materialRate != null && materialRate > 0) ||
          (laborRate != null && laborRate > 0)
        ) {
          const updates: Array<{
            itemId: string;
            quantity: string;
            unit?: string;
            quantitySource?: 'user_entered' | 'suggested_prefill';
          }> = [];
          if (materialRate != null && materialRate > 0) {
            updates.push({
              itemId: materialKey,
              quantity: String(roundMoney2(materialRate * effectiveBasisQty)),
              unit: 'allowance',
              quantitySource: 'suggested_prefill',
            });
          }
          if (laborRate != null && laborRate > 0) {
            updates.push({
              itemId: laborKey,
              quantity: String(roundMoney2(laborRate * effectiveBasisQty)),
              unit: 'allowance',
              quantitySource: 'suggested_prefill',
            });
          }
          const split =
            (materialRate != null && materialRate > 0
              ? materialRate * effectiveBasisQty
              : 0) +
            (laborRate != null && laborRate > 0
              ? laborRate * effectiveBasisQty
              : 0);
          if (split > 0) {
            updates.push({
              itemId: materialKey.replace(/__material$/, '__allowance'),
              quantity: String(roundMoney2(split)),
              unit: 'allowance',
              quantitySource: 'suggested_prefill',
            });
          }
          if (updates.length) onBatchItemQuantityChange(updates);
        }
      }
      return;
    }
    if (
      entryMode === 'flat' &&
      suggestedBlock &&
      (suggestedBlock.material > 0 || suggestedBlock.labor > 0)
    ) {
      didPrefillRef.current = true;
      const flatPrefill: Array<{
        itemId: string;
        quantity: string;
        unit?: string;
        quantitySource?: 'user_entered' | 'suggested_prefill';
      }> = [];
      if (suggestedBlock.material > 0) {
        flatPrefill.push({
          itemId: materialKey,
          quantity: String(suggestedBlock.material),
          unit: 'allowance',
          quantitySource: 'suggested_prefill',
        });
      }
      if (suggestedBlock.labor > 0) {
        flatPrefill.push({
          itemId: laborKey,
          quantity: String(suggestedBlock.labor),
          unit: 'allowance',
          quantitySource: 'suggested_prefill',
        });
      }
      if (flatPrefill.length) onBatchItemQuantityChange(flatPrefill);
      return;
    }
    if (entryMode === 'flat') return;
    const suggestedBasisQty =
      suggestedBlock?.basis?.quantity && suggestedBlock.basis.quantity > 0
        ? suggestedBlock.basis.quantity
        : 0;
    const suggestedUnit = String(
      suggestedBlock?.basis?.unit || ''
    ).toLowerCase();
    const editorUnit = String(
      basisUnit || pricingBasis?.unit || ''
    ).toLowerCase();
    const unitsCompatible =
      !suggestedUnit ||
      !editorUnit ||
      suggestedUnit === editorUnit ||
      (suggestedUnit === 'living_sqft' && editorUnit === 'sqft') ||
      (suggestedUnit === 'sqft' && editorUnit === 'living_sqft');
    // Prefer Suggest card qty/unit when seeding empty Edit (covers framing living+garage).
    // Never apply $/CY or $/square rates onto living SF (Foundation ~$1M class of bug).
    const qtyForPrefill =
      suggestedBasisQty > 0 && unitsCompatible
        ? suggestedBasisQty
        : unitsCompatible && effectiveBasisQty > 0
          ? effectiveBasisQty
          : suggestedBasisQty > 0
            ? suggestedBasisQty
            : effectiveBasisQty;
    const unitForPrefill =
      suggestedBasisQty > 0 && suggestedUnit
        ? suggestedBlock?.basis?.unit || basisUnit
        : unitsCompatible || !suggestedUnit
          ? basisUnit || pricingBasis?.unit || 'sqft'
          : suggestedBlock?.basis?.unit || basisUnit;
    const rates = suggestedUnitRatesFromBlock(
      suggestedBlock,
      suggestedBasisQty > 0 ? suggestedBasisQty : qtyForPrefill,
      itemId,
      basisUnit
    );
    if (!rates || !(qtyForPrefill > 0)) return;
    didPrefillRef.current = true;
    lastBasisQtyRef.current = qtyForPrefill;
    lockedRatesRef.current = {
      material: rates.materialRate > 0 ? rates.materialRate : null,
      labor: rates.laborRate > 0 ? rates.laborRate : null,
    };
    const updates: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }> = [];
    const basisNeedsSeed =
      !parseMoneyAmount(pricingBasisValue) ||
      !unitsCompatible ||
      (suggestedBasisQty > 0 &&
        effectiveBasisQty > 0 &&
        Math.abs(suggestedBasisQty - effectiveBasisQty) / suggestedBasisQty >
          0.02);
    if (basisNeedsSeed && entryMode === 'takeoff') {
      updates.push({
        itemId: sqftBasisKey,
        quantity: String(qtyForPrefill),
        unit: unitForPrefill,
        quantitySource: 'suggested_prefill',
      });
    }
    if (rates.materialRate > 0) {
      updates.push({
        itemId: materialKey,
        quantity: String(roundMoney2(rates.materialRate * qtyForPrefill)),
        unit: 'allowance',
        quantitySource: 'suggested_prefill',
      });
    }
    if (rates.laborRate > 0) {
      updates.push({
        itemId: laborKey,
        quantity: String(roundMoney2(rates.laborRate * qtyForPrefill)),
        unit: 'allowance',
        quantitySource: 'suggested_prefill',
      });
    }
    if (updates.length) onBatchItemQuantityChange(updates);
  }, [
    materialValue,
    laborValue,
    pricingBasisValue,
    effectiveBasisQty,
    suggestedBlock,
    pricingBasis,
    sqftBasisKey,
    materialKey,
    laborKey,
    basisUnit,
    onBatchItemQuantityChange,
    entryMode,
    itemId,
  ]);

  const previousEntryModeRef = useRef<PricingEntryMode | null>(null);
  useEffect(() => {
    const enteredTakeoff =
      entryMode === 'takeoff' && previousEntryModeRef.current !== 'takeoff';
    previousEntryModeRef.current = entryMode;
    if (!enteredTakeoff || splitTotalOnly) return;

    userEditedRatesRef.current = false;
    const suggestedBasisQty =
      suggestedBlock?.basis?.quantity && suggestedBlock.basis.quantity > 0
        ? suggestedBlock.basis.quantity
        : 1;
    const rates = resolveTakeoffScaleRates({
      itemId,
      unit: basisUnit,
      suggestedBlock,
      suggestedBasisQty,
      materialTotal: parseMoneyAmount(materialValue),
      laborTotal: parseMoneyAmount(laborValue),
      quantity: effectiveBasisQty > 0 ? effectiveBasisQty : suggestedBasisQty,
      lockedMaterialRate: null,
      lockedLaborRate: null,
      userEditedRates: false,
    });
    if (rates.materialRate == null && rates.laborRate == null) return;

    const quantity =
      effectiveBasisQty > 0 ? effectiveBasisQty : suggestedBasisQty;
    lockedRatesRef.current = {
      material: rates.materialRate,
      labor: rates.laborRate,
    };
    lastBasisQtyRef.current = quantity;
    const updates: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }> = [];
    if (!(effectiveBasisQty > 0)) {
      updates.push({
        itemId: sqftBasisKey,
        quantity: String(quantity),
        unit: basisUnit,
        quantitySource: 'suggested_prefill',
      });
    }
    if (rates.materialRate != null && rates.materialRate > 0) {
      updates.push({
        itemId: materialKey,
        quantity: String(roundMoney2(rates.materialRate * quantity)),
        unit: 'allowance',
        quantitySource: 'suggested_prefill',
      });
    }
    if (rates.laborRate != null && rates.laborRate > 0) {
      updates.push({
        itemId: laborKey,
        quantity: String(roundMoney2(rates.laborRate * quantity)),
        unit: 'allowance',
        quantitySource: 'suggested_prefill',
      });
    }
    const split =
      ((rates.materialRate != null && rates.materialRate > 0
        ? rates.materialRate
        : 0) +
        (rates.laborRate != null && rates.laborRate > 0
          ? rates.laborRate
          : 0)) *
      quantity;
    if (split > 0) {
      updates.push({
        itemId: materialKey.replace(/__material$/, '__allowance'),
        quantity: String(roundMoney2(split)),
        unit: 'allowance',
        quantitySource: 'suggested_prefill',
      });
    }
    if (updates.length) onBatchItemQuantityChange(updates);
  }, [
    entryMode,
    splitTotalOnly,
    suggestedBlock,
    itemId,
    effectiveBasisQty,
    sqftBasisKey,
    basisUnit,
    materialKey,
    laborKey,
    materialValue,
    laborValue,
    onBatchItemQuantityChange,
  ]);

  const handleBasisChange = (text: string) => {
    const nextQty = parseMoneyAmount(text);
    const prevQty = lastBasisQtyRef.current ?? effectiveBasisQty;
    const updates: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }> = [
      {
        itemId: sqftBasisKey,
        quantity: text,
        unit: basisUnit,
        quantitySource: 'user_entered',
      },
    ];

    if (!(nextQty > 0)) {
      lastBasisQtyRef.current = null;
      updates.push(
        { itemId, quantity: '', unit: basisUnit },
        { itemId: materialKey, quantity: '', unit: 'allowance' },
        { itemId: laborKey, quantity: '', unit: 'allowance' },
        {
          itemId: materialKey.replace(/__material$/, '__allowance'),
          quantity: '',
          unit: 'allowance',
        }
      );
      onBatchItemQuantityChange(updates);
      return;
    }

    const hasExplicitSuggestedBasis =
      Number(suggestedBlock?.basis?.quantity) > 0;
    const hasEstablishedRate =
      lockedRatesRef.current.material != null ||
      lockedRatesRef.current.labor != null;
    const preserveCurrentTotalsAsNewRates =
      !userEditedRatesRef.current &&
      !hasExplicitSuggestedBasis &&
      !hasEstablishedRate &&
      Boolean(suggestedBlock) &&
      (parseMoneyAmount(materialValue) > 0 || parseMoneyAmount(laborValue) > 0);
    const { materialRate, laborRate } = preserveCurrentTotalsAsNewRates
      ? {
          materialRate:
            parseMoneyAmount(materialValue) > 0
              ? roundMoney2(parseMoneyAmount(materialValue) / nextQty)
              : null,
          laborRate:
            parseMoneyAmount(laborValue) > 0
              ? roundMoney2(parseMoneyAmount(laborValue) / nextQty)
              : null,
        }
      : scaleRatesForQuantity(nextQty, prevQty);
    lockedRatesRef.current = {
      material: materialRate,
      labor: laborRate,
    };
    lastBasisQtyRef.current = nextQty;

    if (materialRate != null && materialRate > 0) {
      updates.push({
        itemId: materialKey,
        quantity: String(roundMoney2(materialRate * nextQty)),
        unit: 'allowance',
      });
    }
    if (laborRate != null && laborRate > 0) {
      updates.push({
        itemId: laborKey,
        quantity: String(roundMoney2(laborRate * nextQty)),
        unit: 'allowance',
      });
    }
    const materialTotal =
      materialRate != null && materialRate > 0
        ? roundMoney2(materialRate * nextQty)
        : parseMoneyAmount(materialValue);
    const laborTotal =
      laborRate != null && laborRate > 0
        ? roundMoney2(laborRate * nextQty)
        : parseMoneyAmount(laborValue);
    const split = materialTotal + laborTotal;
    if (split > 0) {
      const allowanceKey = materialKey.replace(/__material$/, '__allowance');
      updates.push({
        itemId: allowanceKey,
        quantity: String(roundMoney2(split)),
        unit: 'allowance',
      });
    }
    onBatchItemQuantityChange(updates);
  };

  const handleMaterialChange = (text: string) => {
    const amount = parseMoneyAmount(text);
    const laborAmount = parseMoneyAmount(laborValue);
    const allowanceKey = materialKey.replace(/__material$/, '__allowance');
    const updates: Array<{ itemId: string; quantity: string; unit?: string }> =
      [{ itemId: materialKey, quantity: text, unit: 'allowance' }];
    const split =
      (amount > 0 ? amount : 0) + (laborAmount > 0 ? laborAmount : 0);
    // Always sync __allowance. Leaving the last digit (e.g. $2 from $2000) when
    // Material/Labor are cleared kept a phantom Flat allowance card on Done.
    updates.push({
      itemId: allowanceKey,
      quantity: split > 0 ? String(roundMoney2(split)) : '',
      unit: 'allowance',
    });
    onBatchItemQuantityChange(updates);
    userEditedRatesRef.current = true;
    if (effectiveBasisQty > 0 && amount > 0) {
      lockedRatesRef.current.material = roundMoney2(amount / effectiveBasisQty);
    } else if (!text.trim()) {
      lockedRatesRef.current.material = null;
    }
  };

  const handleLaborChange = (text: string) => {
    const amount = parseMoneyAmount(text);
    const materialAmount = parseMoneyAmount(materialValue);
    const allowanceKey = laborKey.replace(/__labor$/, '__allowance');
    const updates: Array<{ itemId: string; quantity: string; unit?: string }> =
      [{ itemId: laborKey, quantity: text, unit: 'allowance' }];
    const split =
      (materialAmount > 0 ? materialAmount : 0) + (amount > 0 ? amount : 0);
    updates.push({
      itemId: allowanceKey,
      quantity: split > 0 ? String(roundMoney2(split)) : '',
      unit: 'allowance',
    });
    onBatchItemQuantityChange(updates);
    userEditedRatesRef.current = true;
    if (effectiveBasisQty > 0 && amount > 0) {
      lockedRatesRef.current.labor = roundMoney2(amount / effectiveBasisQty);
    } else if (!text.trim()) {
      lockedRatesRef.current.labor = null;
    }
  };

  const splitTotal = (() => {
    const materialNumber = parseMoneyAmount(materialValue);
    const laborNumber = parseMoneyAmount(laborValue);
    const total = materialNumber + laborNumber;
    return total > 0 ? total : null;
  })();

  const editorBasis =
    entryMode === 'takeoff' &&
    !splitTotalOnly &&
    effectiveBasisQty > 0 &&
    !basisFocused
      ? { quantity: effectiveBasisQty, unit: pricingBasis?.unit || basisUnit }
      : null;

  const showTakeoffBasis = entryMode === 'takeoff' && !splitTotalOnly;
  const sharedMatLabRateMode = Boolean(
    editorBasis?.quantity && editorBasis.quantity > 0
  );

  return (
    <>
      {splitTotalOnly ? (
        <PricingInputField
          label='Total'
          value={splitTotal != null ? String(splitTotal) : ''}
          prefix='$'
          placeholder='0'
          embedded
          readOnly
          onFocus={() => {}}
          onChangeText={() => {}}
          onBlur={() => {}}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      ) : showTakeoffBasis ? (
        <PricingInputField
          label={basisFieldLabel}
          value={basisFocused ? basisDraft : pricingBasisValue}
          suffix={formatCountFieldSuffix(basisUnit) ?? undefined}
          placeholder={
            pricingBasis
              ? String(pricingBasis.quantity)
              : `Enter ${basisUnitLabel}`
          }
          helper={
            !pricingBasisValue && pricingBasis
              ? `Using ${pricingBasis.quantity.toLocaleString()} ${basisUnitLabel} from job measurements`
              : undefined
          }
          embedded
          onFocus={() => {
            setBasisFocused(true);
            setBasisDraft(pricingBasisValue);
            focusQuantityField(sqftBasisKey);
          }}
          onChangeText={text => {
            setBasisDraft(text);
          }}
          onBlur={() => {
            setBasisFocused(false);
            handleBasisChange(basisDraft);
            blurQuantityField(sqftBasisKey);
          }}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      ) : null}
      {sharedMatLabRateMode ? (
        <View style={styles.pricingMatLabModeRow}>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              fontWeight: '600',
              flex: 1,
              flexShrink: 1,
              paddingRight: 8,
            }}
          >
            Material & labor pricing
          </Text>
          <PricingRateModeToggle
            mode={matLabInputMode}
            onChange={setMatLabInputMode}
            unitLabel={basisUnitLabel}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        </View>
      ) : null}
      <PricingMatLabRow
        material={
          <PricingInputField
            label='Material'
            value={materialValue}
            helper={unitRateHelper(materialValue, editorBasis)}
            basis={editorBasis}
            prefix='$'
            placeholder={editorBasis ? `$/${basisUnitLabel}` : '0'}
            defaultInputMode='total'
            inputMode={sharedMatLabRateMode ? matLabInputMode : undefined}
            onInputModeChange={
              sharedMatLabRateMode ? setMatLabInputMode : undefined
            }
            hideRateModeToggle={sharedMatLabRateMode}
            embedded
            onFocus={() => focusQuantityField(materialKey)}
            onChangeText={handleMaterialChange}
            onBlur={() => blurQuantityField(materialKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        }
        labor={
          <PricingInputField
            label='Labor'
            value={laborValue}
            helper={unitRateHelper(laborValue, editorBasis)}
            basis={editorBasis}
            prefix='$'
            placeholder={editorBasis ? `$/${basisUnitLabel}` : '0'}
            defaultInputMode='total'
            inputMode={sharedMatLabRateMode ? matLabInputMode : undefined}
            onInputModeChange={
              sharedMatLabRateMode ? setMatLabInputMode : undefined
            }
            hideRateModeToggle={sharedMatLabRateMode}
            embedded
            onFocus={() => focusQuantityField(laborKey)}
            onChangeText={handleLaborChange}
            onBlur={() => blurQuantityField(laborKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        }
      />
      {splitTotal ? (
        <View style={styles.pricingEditorTotalRow}>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            Total
          </Text>
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 15,
              fontWeight: '800',
            }}
          >
            {formatDraftMoney(splitTotal)}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function inlineTakeoffQuantityLabel(
  itemId: string,
  templateKey?: string | null,
  unit?: string | null
): string {
  if (String(templateKey || '').toLowerCase() === 'bathroom') {
    if (
      itemId === 'drywall' ||
      itemId === 'patch_repair' ||
      itemId === 'paint_repair'
    ) {
      return 'Patch/repair SF';
    }
    if (itemId === 'demo') return 'Shower tile demo SF';
    if (itemId === 'floor_demo') return 'Bathroom floor demo SF';
  }
  return pricingBasisFieldLabel(itemId, unit);
}

function InlineTakeoffCountInput({
  label,
  value,
  unit,
  onFocus,
  onCommit,
  onBlur,
  Colors,
  darkMode,
  applying,
}: {
  label: string;
  value: string;
  unit?: string | null;
  onFocus: () => void;
  onCommit: (text: string) => void;
  onBlur: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!focused) {
      setDraft(value);
    }
  }, [value, focused]);

  return (
    <View
      style={{
        paddingBottom: 10,
        marginBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: dividerColor(darkMode),
      }}
    >
      <PricingInputField
        label={label}
        value={focused ? draft : value}
        suffix={formatCountFieldSuffix(unit) ?? undefined}
        placeholder='0'
        embedded
        onFocus={() => {
          setFocused(true);
          setDraft(value);
          onFocus();
        }}
        onChangeText={setDraft}
        onBlur={() => {
          setFocused(false);
          onCommit(draft);
          onBlur();
        }}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    </View>
  );
}

function QuantitySection({
  itemId,
  choiceId,
  inScope,
  templateKey,
  originalNotes,
  measurementsInput,
  onItemQuantityChange,
  onBatchItemQuantityChange,
  onClearSuggestedPrefill,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  onClearAcceptedPricing,
  onScopeGapResolutionsChange,
  onScopeGapPriceSeparately,
  onScopeGapIncludeInParentPrice,
  onRevertCalculatedQuantity,
  scopeItemLabel,
  pricingEditorRequest,
  onPricingEditorRequestHandled,
  suppressSuggestedPricing = false,
  hideInlineTakeoff = false,
  Colors,
  darkMode,
  applying,
}: {
  itemId: string;
  choiceId?: string | null;
  inScope: boolean;
  templateKey?: string | null;
  originalNotes?: string | null;
  scopeItemLabel: string;
  /** Parent renders a bundled suggestion (e.g. separate drywall + paint lines). */
  suppressSuggestedPricing?: boolean;
  /** Parent renders per-choice quantity fields instead of one shared takeoff field. */
  hideInlineTakeoff?: boolean;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string,
    source?: QuantitySource,
    calculatedRevertFrom?: CalculatedQuantityRevertSnapshot
  ) => void;
  onBatchItemQuantityChange: (
    updates: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onClearSuggestedPrefill?: (
    itemId: string,
    pendingUpdates?: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onClearAcceptedPricing?: (itemId: string) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (
    itemId: string,
    block: SuggestedPricingBlock
  ) => void;
  onScopeGapResolutionsChange?: (next: ScopeGapResolutionsMap) => void;
  onScopeGapPriceSeparately?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onScopeGapIncludeInParentPrice?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    addonAmount: number,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onRevertCalculatedQuantity?: (itemId: string) => void;
  pricingEditorRequest?: { itemId: string; token: number } | null;
  onPricingEditorRequestHandled?: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const [pricingEditorOpen, setPricingEditorOpen] = useState(false);
  const [electricalQuantityEditorOpen, setElectricalQuantityEditorOpen] =
    useState(false);
  const [focusedPricingField, setFocusedPricingField] = useState<string | null>(
    null
  );
  const [pricingModeOverride, setPricingModeOverride] =
    useState<AllowanceOrSplitMode | null>(null);
  const [pricingEntryModeOverride, setPricingEntryModeOverride] =
    useState<PricingEntryMode | null>(null);
  const pricingEditorPendingRef = useRef<
    | (() => Array<{
        itemId: string;
        quantity: string;
        unit?: string;
        quantitySource?: 'user_entered' | 'suggested_prefill';
      }>)
    | null
  >(null);
  const pricingContext = React.useContext(ScopePricingContextValue);
  const assemblyContext = React.useContext(ScopeAssemblyContextValue);
  const scopeGapPricingContext = React.useMemo<ScopeGapPricingContext>(
    () => ({
      itemQuantities: measurementsInput.itemQuantities,
      pricingAcceptance: measurementsInput.pricingAcceptance,
    }),
    [measurementsInput.itemQuantities, measurementsInput.pricingAcceptance]
  );
  const rule = getChecklistItemQuantityRuleOrDefault(itemId, templateKey);
  const sharedNorm = React.useContext(ScopeNormalizedMeasurementsContext);
  const sharedParsedNotes = React.useContext(ScopeParsedNotesContext);

  React.useEffect(() => {
    if (pricingEditorRequest?.itemId === itemId) {
      setPricingEditorOpen(true);
      onPricingEditorRequestHandled?.();
    }
  }, [pricingEditorRequest, itemId, onPricingEditorRequestHandled]);
  if (!inScope) return null;

  const completeStuccoSystemSelected =
    String(templateKey || '').toLowerCase() === 'stucco' &&
    pricingContext?.checklistItems?.some(
      row =>
        row.id === 'stucco' &&
        row.state === 'included' &&
        ['three_coat', 'one_coat', 'eifs', 'finish_only'].includes(
          String(row.choiceId || '')
        )
    );
  const includedInCompleteStuccoSystem =
    completeStuccoSystemSelected &&
    [
      'stucco_wrb',
      'stucco_lath',
      'stucco_base_coat',
      'stucco_finish_coat',
      'stucco_accessories',
    ].includes(itemId);
  if (includedInCompleteStuccoSystem) {
    return (
      <View
        style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}
      >
        <Text
          style={{
            color: '#22c55e',
            fontSize: 12,
            fontWeight: '700',
          }}
        >
          Included with selected Stucco system · $0 incremental
        </Text>
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            marginTop: 4,
          }}
        >
          Standard component pricing is included in the complete system rate.
          Change to No only when supplied by others or excluded from this bid.
        </Text>
      </View>
    );
  }

  const norm =
    sharedNorm ||
    buildNormFromInput(measurementsInput, originalNotes, templateKey);
  let resolved = resolveChecklistItemQuantity(itemId, norm, {
    choiceId,
    templateKey,
    notes: originalNotes,
  });
  if (rule?.dualAllowanceField) {
    resolved = overlayDualRatePricingDisplay(
      itemId,
      resolved,
      norm,
      originalNotes,
      templateKey
    );
  }
  const hasPrimaryTakeoffForDisplay = hasPrimaryTakeoffFromResolved(resolved);
  const electricalHasAppliedPricing =
    itemId === 'electrical' &&
    (scopeHasCommittedConfirmScopePrice({
      itemId,
      itemQuantities: measurementsInput.itemQuantities,
      pricingAcceptance: measurementsInput.pricingAcceptance,
    }) ||
      hasAcceptedScopePricing(
        itemId,
        measurementsInput.itemQuantities,
        measurementsInput.pricingAcceptance
      ));
  if (!resolved.showInput && !resolved.pricingReady) return null;
  const quantityRowSourceLabel = resolveToiletRelocateQuantitySourceLabel({
    itemId,
    choiceId,
    floorType: measurementsInput.bathroomToiletRelocateFloorType,
    floorTypeSource: measurementsInput.bathroomToiletRelocateFloorTypeSource,
    defaultSourceLabel: resolved.sourceLabel,
  });
  const noteQuantity = originalNotes
    ? noteQuantityForScopeItem(
        itemId,
        sharedParsedNotes?.source === originalNotes
          ? sharedParsedNotes.parsed
          : parseScopeMeasurementsFromNotes(originalNotes, {
              templateKey: templateKey ?? undefined,
            })
      )
    : null;
  const currentQuantity = Number(
    resolved.dualCount?.quantity ?? resolved.quantity
  );
  const noteVarianceNotice =
    noteQuantity != null &&
    Number.isFinite(currentQuantity) &&
    Math.abs(currentQuantity - noteQuantity) > 0.01 ? (
      <Text
        style={{ color: '#fbbf24', fontSize: 11, lineHeight: 15, marginTop: 4 }}
      >
        Measurement {currentQuantity > noteQuantity ? 'exceeds' : 'is below'}{' '}
        note entry ({formatMeasurementDisplay(currentQuantity)} vs{' '}
        {formatMeasurementDisplay(noteQuantity)} {resolved.unit}).
      </Text>
    ) : null;
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const focusQuantityField = (
    targetItemId: string,
    field: 'count' | 'allowance' = 'count'
  ) => {
    setFocusedPricingField(`${targetItemId}:${field}`);
    onItemQuantityFocus(targetItemId, field);
  };
  const blurQuantityField = (
    targetItemId: string,
    field: 'count' | 'allowance' = 'count'
  ) => {
    setFocusedPricingField(null);
    onItemQuantityBlur(targetItemId, field);
  };
  const closePricingEditor = () => {
    const pendingUpdates = pricingEditorPendingRef.current?.() ?? [];
    // Close first so focus/blur side effects cannot keep the editor open.
    setFocusedPricingField(null);
    setPricingEditorOpen(false);
    setPricingEntryModeOverride(null);
    Keyboard.dismiss();
    // Opening Edit seeds Suggest values as suggested_prefill — discard if user
    // never committed so the Apply card returns unchanged.
    onClearSuggestedPrefill?.(
      itemId,
      pendingUpdates.length ? pendingUpdates : undefined
    );
  };

  if (rule.dualAllowanceField) {
    const fieldLabels = getScopeQuantityFieldLabels(itemId);
    const trimFinishLfDerivation =
      itemId === 'trim_finish'
        ? describeTrimFinishLfDerivation(measurementsInput, choiceId)
        : null;
    const allowanceKey = roughAllowanceSubKey(itemId);
    const materialKey = `${itemId}__material`;
    const laborKey = `${itemId}__labor`;
    const countInput = measurementsInput.itemQuantities[itemId];
    const allowanceInput = measurementsInput.itemQuantities[allowanceKey];
    const materialInput = measurementsInput.itemQuantities[materialKey];
    const laborInput = measurementsInput.itemQuantities[laborKey];
    // Only the explicit open flag — field focus must not trap the editor open.
    const showEditor = pricingEditorOpen;

    const hasUserSelectedPricing = shouldSuppressSuggestedPricingAfterApply(
      itemId,
      measurementsInput.itemQuantities || {},
      measurementsInput.pricingAcceptance
    );

    if (!showEditor && originalNotes?.trim() && !hasUserSelectedPricing) {
      const fromNotes = resolveDualRatePricingDisplayFromNotes(
        itemId,
        measurementsInput,
        originalNotes,
        templateKey
      );
      if (fromNotes) {
        resolved = { ...resolved, ...fromNotes, showInput: true };
      }
    }

    const mergeNotesSplitForDisplay = () => {
      if (showEditor || !originalNotes?.trim() || hasUserSelectedPricing)
        return resolved;
      if (resolved.dualMaterial && resolved.dualLabor) return resolved;
      const fromNotes = resolveDualRatePricingDisplayFromNotes(
        itemId,
        measurementsInput,
        originalNotes,
        templateKey
      );
      return fromNotes
        ? { ...resolved, ...fromNotes, showInput: true }
        : resolved;
    };

    if (__DEV__ && itemId === 'backsplash') {
      const raw = measurementsInput.itemQuantities || {};
      console.log('🧮 Backsplash quantity render', {
        raw: {
          material: raw.backsplash__material?.quantity,
          labor: raw.backsplash__labor?.quantity,
          total: raw.backsplash__allowance?.quantity,
        },
        resolved: {
          material: resolved.dualMaterial?.quantity,
          labor: resolved.dualLabor?.quantity,
          total: resolved.dualAllowance?.quantity,
        },
      });
    }

    if (resolved.pricingReady && !showEditor) {
      let displayResolved = mergeNotesSplitForDisplay();
      const rawSuggested = resolveScopeItemSuggestedPricing(
        itemId,
        measurementsInput,
        templateKey,
        displayResolved,
        pricingContext,
        choiceId,
        originalNotes
      );
      const initialSuggested = hasUserSelectedPricing
        ? { fill: null, comparison: rawSuggested.comparison }
        : rawSuggested;
      let suggestedBudgetSplit = initialSuggested.fill;
      let suggestedComparisonSplit = initialSuggested.comparison;
      const intelligence = resolveScopeItemIntelligence({
        scopeKey: itemId,
        templateKey,
        notes: originalNotes,
        measurements: norm,
        resolved: displayResolved,
        suggestedPricing: initialSuggested.fill,
        activeScopeKeys: assemblyContext.activeScopeKeys,
        excludedScopeKeys: assemblyContext.excludedScopeKeys,
        pricingAcceptance: measurementsInput.pricingAcceptance,
        scopeGapResolutions: measurementsInput.scopeGapResolutions,
        itemQuantities: measurementsInput.itemQuantities,
        pricingAccepted: Boolean(measurementsInput.pricingAcceptance?.[itemId]),
      });
      const formulaSuggested = resolveFormulaTargetSuggestedPricing({
        itemId,
        measurementsInput,
        templateKey,
        resolved: displayResolved,
        pricingContext,
        intelligence,
        suggested: rawSuggested,
        choiceId,
      });
      if (
        intelligence.formula?.formulaKey ===
          'countertop_area_from_cabinet_lf' &&
        !calculatedQuantityAlreadyActive(intelligence)
      ) {
        const applyTarget = resolveFormulaQuantityApplyTarget({
          scopeKey: itemId,
          formula: intelligence.formula,
        });
        displayResolved = {
          ...displayResolved,
          quantity: applyTarget.quantity,
          unit: applyTarget.unit,
          quantitySource: 'calculated_confirmed',
          dualCount: {
            quantity: applyTarget.quantity,
            unit: applyTarget.unit,
          },
        };
      }
      if (hasUserSelectedPricing) {
        suggestedComparisonSplit = formulaSuggested.comparison;
      } else {
        suggestedBudgetSplit = formulaSuggested.fill;
        suggestedComparisonSplit = formulaSuggested.comparison;
      }
      // Do not show two Apply choices when both the primary suggestion and
      // comparison are national-average versions of the same scope.
      if (
        suggestedBudgetSplit &&
        (itemId === 'countertops' ||
          (isNationalAveragePricingBlock(suggestedBudgetSplit) &&
            (isNationalAveragePricingBlock(suggestedComparisonSplit) ||
              Boolean(suggestedComparisonSplit?.isComparison))))
      ) {
        suggestedComparisonSplit = null;
      }
      const applySuggestedPricingBlock = (block: SuggestedPricingBlock) => {
        if (onApplySuggestedPricing) {
          onApplySuggestedPricing(itemId, block);
          return;
        }
        hapticTap();
        if (block.basis?.quantity && block.basis.unit) {
          onItemQuantityChange(
            itemId,
            String(block.basis.quantity),
            'count',
            block.basis.unit
          );
        }
        onItemQuantityChange(
          itemId,
          String(block.total),
          'allowance',
          'allowance'
        );
        if (!block.lumpSumOnly) {
          onItemQuantityChange(
            materialKey,
            String(block.material),
            'count',
            'allowance'
          );
          onItemQuantityChange(
            laborKey,
            String(block.labor),
            'count',
            'allowance'
          );
        }
        setTimeout(() => onItemQuantityBlur(itemId), 0);
      };
      const accepted = scopeShowsConfirmScopeAppliedPricing(
        itemId,
        measurementsInput,
        templateKey
      );
      const hideSuggestion =
        suppressSuggestedPricing ||
        shouldHideSuggestedPanel({
          itemId,
          itemQuantities: measurementsInput.itemQuantities,
          pricingAcceptance: measurementsInput.pricingAcceptance,
          suggestedTotal: suggestedBudgetSplit?.total ?? null,
        });
      const acceptedDisplay = accepted
        ? resolveAcceptedPricingDisplay({
            itemId,
            resolved: displayResolved,
            acceptance: measurementsInput.pricingAcceptance?.[itemId],
            suggestedBlock: suggestedBudgetSplit,
            intelligence,
          })
        : null;
      const openPricingEditor = () => {
        setPricingEditorOpen(true);
        // Living SF is only a planning price basis when point/device counts are missing.
        // Do not seed it into the count field (would show e.g. 1879 as "rough-in points").
        const countUnit = String(resolved.dualCount?.unit || '').toLowerCase();
        const countIsLivingAreaFallback =
          countUnit === 'sqft' || countUnit === 'living_sqft';
        if (resolved.dualCount && !countIsLivingAreaFallback) {
          onItemQuantityChange(
            itemId,
            String(resolved.dualCount.quantity),
            'count',
            resolved.dualCount.unit
          );
        }
        if (resolved.dualAllowance) {
          onItemQuantityChange(
            itemId,
            String(resolved.dualAllowance.quantity),
            'allowance',
            resolved.dualAllowance.unit
          );
        }
        if (resolved.dualMaterial) {
          onItemQuantityChange(
            materialKey,
            String(resolved.dualMaterial.quantity),
            'count',
            'allowance'
          );
        }
        if (resolved.dualLabor) {
          onItemQuantityChange(
            laborKey,
            String(resolved.dualLabor.quantity),
            'count',
            'allowance'
          );
        }
      };
      const onUseCalculatedQuantity = intelligence.formula
        ? () => {
            hapticTap();
            const applyTarget = resolveFormulaQuantityApplyTarget({
              scopeKey: itemId,
              formula: intelligence.formula!,
            });
            onItemQuantityChange(
              itemId,
              String(applyTarget.quantity),
              'count',
              applyTarget.unit,
              'calculated_confirmed',
              buildCalculatedQuantityRevertSnapshot(
                itemId,
                measurementsInput.itemQuantities,
                measurementsInput.pricingAcceptance,
                displayResolved
              )
            );
            setTimeout(() => onItemQuantityBlur(itemId), 0);
          }
        : undefined;
      const calculatedRevertLabel = calculatedQuantityRevertLabel(
        measurementsInput.itemQuantities[itemId]?.quantityBeforeCalculated
      );
      const onRevertCalculated =
        calculatedRevertLabel && onRevertCalculatedQuantity
          ? () => onRevertCalculatedQuantity(itemId)
          : undefined;
      const scopeMeasurementsRecord = measurementsInput as Record<string, unknown>;
      const suppressFormulaPlanning = Boolean(
        intelligence.formula &&
          shouldSuppressInsulationEnvelopePlanningFormula({
            scopeKey: itemId,
            formulaKey: intelligence.formula.formulaKey,
            measurements: scopeMeasurementsRecord,
          })
      );
      return (
        <View
          style={[
            styles.qtySection,
            { borderTopColor: dividerColor(darkMode) },
          ]}
        >
          {accepted && acceptedDisplay ? (
            <>
              <AcceptedPricingSummary
                display={acceptedDisplay}
                intelligence={intelligence}
                scopeKey={itemId}
                scopeItemLabel={scopeItemLabel}
                resolved={displayResolved}
                suggestedBlock={suggestedBudgetSplit}
                comparisonBlock={suggestedComparisonSplit}
                scopeGapResolutions={measurementsInput.scopeGapResolutions}
                scopeGapPricingContext={scopeGapPricingContext}
                originalNotes={originalNotes}
                Colors={Colors}
                darkMode={darkMode}
                onEditPricing={openPricingEditor}
                onClearPricing={
                  onClearAcceptedPricing
                    ? () => onClearAcceptedPricing(itemId)
                    : undefined
                }
                onScopeGapResolutionsChange={onScopeGapResolutionsChange}
                onScopeGapPriceSeparately={(
                  componentKey,
                  component,
                  benchmarkAssumption,
                  benchmarkProfile
                ) =>
                  onScopeGapPriceSeparately?.(
                    itemId,
                    component,
                    benchmarkAssumption,
                    benchmarkProfile
                  )
                }
                onScopeGapIncludeInParentPrice={(
                  componentKey,
                  component,
                  addonAmount,
                  benchmarkAssumption,
                  benchmarkProfile
                ) =>
                  onScopeGapIncludeInParentPrice?.(
                    itemId,
                    component,
                    addonAmount,
                    benchmarkAssumption,
                    benchmarkProfile
                  )
                }
              />
              {!hideSuggestion && suggestedBudgetSplit ? (
                <SuggestedBudgetSplitRows
                  block={suggestedBudgetSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() =>
                    applySuggestedPricingBlock(suggestedBudgetSplit)
                  }
                  itemId={itemId}
                  quantitySource={displayResolved.quantitySource}
                  hasPrimaryTakeoff={hasPrimaryTakeoffFromResolved(
                    displayResolved
                  )}
                  livingSf={
                    Number(
                      String(measurementsInput.floorAreaSqft || '').replace(
                        /,/g,
                        ''
                      )
                    ) || null
                  }
                  confidenceLabel={intelligence?.pricing?.confidenceLabel}
                  hasCurrentPricing
                />
              ) : null}
            </>
          ) : (
            <>
              {displayResolved.dualCount &&
              displayResolved.dualCount.quantity > 0 ? (
                <PricingAmountRow
                  value={formatDualCountQuantity(
                    displayResolved.dualCount.quantity,
                    isWindowsDoorsCountScopeItemId(itemId)
                      ? 'each'
                      : fieldLabels?.countUnit ||
                        displayResolved.dualCount.unit
                  )}
                  label={fieldLabels?.count || quantityRowSourceLabel}
                  pill={
                    displayResolved.quantitySource === 'notes' ? (
                      <SourcePill kind='notes' />
                    ) : undefined
                  }
                  emphasized
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {trimFinishLfDerivation ? (
                <>
                  <Text
                    style={{
                      color: captionColor(darkMode, Colors),
                      fontSize: 11,
                      marginTop: 4,
                      lineHeight: 15,
                    }}
                  >
                    {trimFinishLfDerivation.openingSummary}
                  </Text>
                  <Text
                    style={{
                      color: captionColor(darkMode, Colors),
                      fontSize: 10,
                      marginTop: 2,
                      lineHeight: 14,
                    }}
                  >
                    {trimFinishLfDerivation.breakdownLine}
                  </Text>
                  <Text
                    style={{
                      color: captionColor(darkMode, Colors),
                      fontSize: 10,
                      marginTop: 2,
                      lineHeight: 14,
                    }}
                  >
                    {trimFinishLfDerivation.planningNote}
                  </Text>
                </>
              ) : null}
              {itemId === 'hvac' &&
              Number(measurementsInput.hvacSystemTons) > 0 ? (
                <PricingAmountRow
                  value={formatDualCountQuantity(
                    Number(measurementsInput.hvacSystemTons),
                    fieldLabels?.secondaryCountUnit || 'ton'
                  )}
                  label={fieldLabels?.secondaryCount || 'System capacity'}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {noteVarianceNotice}
              {displayResolved.dualMaterial &&
              displayResolved.dualMaterial.quantity > 0 ? (
                <PricingSplitRow
                  label='Material'
                  value={formatDraftMoney(
                    displayResolved.dualMaterial.quantity
                  )}
                  helper={unitRateHelper(
                    String(displayResolved.dualMaterial.quantity),
                    displayResolved.dualCount
                  )}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {displayResolved.dualLabor &&
              displayResolved.dualLabor.quantity > 0 ? (
                <PricingSplitRow
                  label='Labor'
                  value={formatDraftMoney(displayResolved.dualLabor.quantity)}
                  helper={unitRateHelper(
                    String(displayResolved.dualLabor.quantity),
                    displayResolved.dualCount
                  )}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {displayResolved.dualAllowance &&
              displayResolved.dualAllowance.quantity > 0 ? (
                <PricingSplitRow
                  label={
                    displayResolved.dualMaterial || displayResolved.dualLabor
                      ? 'Total'
                      : fieldLabels?.allowance || 'Allowance'
                  }
                  value={formatDraftMoney(
                    displayResolved.dualAllowance.quantity
                  )}
                  pill={
                    !displayResolved.dualMaterial &&
                    !displayResolved.dualLabor &&
                    displayResolved.quantitySource === 'notes' ? (
                      <SourcePill kind='notes' />
                    ) : undefined
                  }
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {displayResolved.quantitySource === 'notes' &&
              (displayResolved.dualMaterial || displayResolved.dualLabor) ? (
                <View
                  style={[styles.pricingRowGap, { alignItems: 'flex-end' }]}
                >
                  <SourcePill kind='notes' />
                </View>
              ) : null}
              <ScopeIntelligenceNotice
                intelligence={intelligence}
                Colors={Colors}
                darkMode={darkMode}
                compact
                pricingCardOwnsStatus={
                  !hideSuggestion && Boolean(suggestedBudgetSplit)
                }
                onUseCalculatedQuantity={onUseCalculatedQuantity}
                onRevertCalculatedQuantity={onRevertCalculated}
                calculatedRevertLabel={calculatedRevertLabel}
                suppressFormulaPlanning={suppressFormulaPlanning}
                measurements={scopeMeasurementsRecord}
              />
              {!hideSuggestion && suggestedBudgetSplit ? (
                <SuggestedBudgetSplitRows
                  block={suggestedBudgetSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() =>
                    applySuggestedPricingBlock(suggestedBudgetSplit)
                  }
                  itemId={itemId}
                  quantitySource={displayResolved.quantitySource}
                  hasPrimaryTakeoff={hasPrimaryTakeoffFromResolved(
                    displayResolved
                  )}
                  livingSf={
                    Number(
                      String(measurementsInput.floorAreaSqft || '').replace(
                        /,/g,
                        ''
                      )
                    ) || null
                  }
                  confidenceLabel={intelligence?.pricing?.confidenceLabel}
                />
              ) : null}
              {shouldShowPricingComparisonBlock(suggestedComparisonSplit) ? (
                <ComparisonToggle
                  block={suggestedComparisonSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() =>
                    applySuggestedPricingBlock(suggestedComparisonSplit)
                  }
                  itemId={itemId}
                  quantitySource={displayResolved.quantitySource}
                  hasPrimaryTakeoff={hasPrimaryTakeoffFromResolved(
                    displayResolved
                  )}
                  livingSf={
                    Number(
                      String(measurementsInput.floorAreaSqft || '').replace(
                        /,/g,
                        ''
                      )
                    ) || null
                  }
                  confidenceLabel={intelligence?.pricing?.confidenceLabel}
                  hasCurrentPricing={
                    scopeHasCommittedConfirmScopePrice({
                      itemId,
                      itemQuantities: measurementsInput.itemQuantities,
                      pricingAcceptance: measurementsInput.pricingAcceptance,
                    }) ||
                    hasAcceptedScopePricing(
                      itemId,
                      measurementsInput.itemQuantities,
                      measurementsInput.pricingAcceptance
                    )
                  }
                  editAction={scopePricingEditAction(
                    suggestedBudgetSplit,
                    () =>
                      itemId === 'electrical'
                        ? setPricingEditorOpen(true)
                        : openPricingEditor(),
                    true
                  )}
                />
              ) : scopePricingEditAction(
                  suggestedBudgetSplit,
                  () =>
                    itemId === 'electrical'
                      ? setPricingEditorOpen(true)
                      : openPricingEditor()
                ) ? (
                <ScopePricingSecondaryActions
                  edit={scopePricingEditAction(
                    suggestedBudgetSplit,
                    () =>
                      itemId === 'electrical'
                        ? setPricingEditorOpen(true)
                        : openPricingEditor()
                  )}
                />
              ) : null}
            </>
          )}
        </View>
      );
    }

    if (!showEditor) {
      const rawPlanningSuggested = resolveScopeItemSuggestedPricing(
        itemId,
        measurementsInput,
        templateKey,
        resolved,
        pricingContext,
        choiceId
      );
      const suppressFill = shouldSuppressSuggestedPricingAfterApply(
        itemId,
        measurementsInput.itemQuantities || {},
        measurementsInput.pricingAcceptance
      );
      const planningSuggested = suppressFill
        ? {
            fill: null as SuggestedPricingBlock | null,
            comparison: rawPlanningSuggested.comparison,
          }
        : rawPlanningSuggested;
      const planningIntelligence = resolveScopeItemIntelligence({
        scopeKey: itemId,
        templateKey,
        notes: originalNotes,
        measurements: norm,
        resolved,
        suggestedPricing: planningSuggested.fill,
        activeScopeKeys: assemblyContext.activeScopeKeys,
        excludedScopeKeys: assemblyContext.excludedScopeKeys,
        pricingAcceptance: measurementsInput.pricingAcceptance,
        scopeGapResolutions: measurementsInput.scopeGapResolutions,
        itemQuantities: measurementsInput.itemQuantities,
        pricingAccepted: Boolean(measurementsInput.pricingAcceptance?.[itemId]),
      });
      const formulaPlanning = resolveFormulaTargetSuggestedPricing({
        itemId,
        measurementsInput,
        templateKey,
        resolved,
        pricingContext,
        intelligence: planningIntelligence,
        suggested: planningSuggested,
        choiceId,
      });
      const planningFill = formulaPlanning.fill;
      const planningComparison =
        planningFill &&
        (itemId === 'countertops' ||
          (isNationalAveragePricingBlock(planningFill) &&
            (isNationalAveragePricingBlock(formulaPlanning.comparison) ||
              Boolean(formulaPlanning.comparison?.isComparison))))
          ? null
          : formulaPlanning.comparison;
      const hidePlanningSuggestion =
        suppressSuggestedPricing ||
        shouldHideSuggestedPanel({
          itemId,
          itemQuantities: measurementsInput.itemQuantities,
          pricingAcceptance: measurementsInput.pricingAcceptance,
          suggestedTotal: planningFill?.total ?? null,
        });
      const neededStatusLine = measurementSemanticsV1Enabled()
        ? missingStatusDisplayLabel(itemId, templateKey)
        : resolved.missingMessage || 'Enter quantity and/or allowance';
      const softCostAllowance = isSoftCostAllowanceScope(
        itemId,
        rule.lumpSumOnly
      );
      // Pricing card owns the single “needs count” / planning status — don’t stack outer copy.
      const cardOwnsMissingCopy =
        Boolean(planningFill) &&
        (softCostAllowance ||
          [
            'windows',
            'windows_doors',
            'exterior_doors',
            'sliding_doors',
            'interior_doors',
            'garage_doors',
            'plumbing_rough',
            'electrical_rough',
            'hvac',
            'insulation',
          ].includes(itemId));
      const planningHelperLine = softCostAllowance
        ? rule.quantityHelper
        : planningFill
          ? null
          : rule.quantityHelper;
      const applyPlanningBlock = (block: SuggestedPricingBlock) => {
        if (onApplySuggestedPricing) {
          onApplySuggestedPricing(itemId, block);
          return;
        }
        hapticTap();
        if (block.basis?.quantity && block.basis.unit) {
          onItemQuantityChange(
            itemId,
            String(block.basis.quantity),
            'count',
            block.basis.unit
          );
        }
        onItemQuantityChange(
          itemId,
          String(block.total),
          'allowance',
          'allowance'
        );
        if (!block.lumpSumOnly) {
          onItemQuantityChange(
            materialKey,
            String(block.material),
            'count',
            'allowance'
          );
          onItemQuantityChange(
            laborKey,
            String(block.labor),
            'count',
            'allowance'
          );
        }
        setTimeout(() => onItemQuantityBlur(itemId), 0);
      };
      return (
        <View
          style={[
            styles.qtySection,
            { borderTopColor: dividerColor(darkMode) },
          ]}
        >
          {cardOwnsMissingCopy ? null : (
            <Text
              style={{
                color: '#fbbf24',
                fontSize: 11,
                fontWeight: '700',
                marginBottom: 6,
              }}
            >
              {neededStatusLine}
            </Text>
          )}
          {!cardOwnsMissingCopy && planningHelperLine ? (
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                marginBottom: 4,
                lineHeight: 15,
              }}
            >
              {planningHelperLine}
            </Text>
          ) : null}
          {cardOwnsMissingCopy ? null : (
            <ScopeIntelligenceNotice
              intelligence={planningIntelligence}
              Colors={Colors}
              darkMode={darkMode}
              compact
            />
          )}
          {!hidePlanningSuggestion && planningFill ? (
            <SuggestedBudgetSplitRows
              block={planningFill}
              Colors={Colors}
              darkMode={darkMode}
              onUsePricing={() => applyPlanningBlock(planningFill)}
              itemId={itemId}
              quantitySource={resolved.quantitySource}
              hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
              livingSf={
                Number(
                  String(measurementsInput.floorAreaSqft || '').replace(
                    /,/g,
                    ''
                  )
                ) || null
              }
              confidenceLabel={planningIntelligence?.pricing?.confidenceLabel}
            />
          ) : null}
          {planningComparison ? (
            <ComparisonToggle
              block={planningComparison}
              Colors={Colors}
              darkMode={darkMode}
              onUsePricing={() => applyPlanningBlock(planningComparison)}
              itemId={itemId}
              quantitySource={resolved.quantitySource}
              hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
              livingSf={
                Number(
                  String(measurementsInput.floorAreaSqft || '').replace(
                    /,/g,
                    ''
                  )
                ) || null
              }
              confidenceLabel={planningIntelligence?.pricing?.confidenceLabel}
              editAction={scopePricingEditAction(
                planningFill,
                () => setPricingEditorOpen(true),
                true
              )}
            />
          ) : scopePricingEditAction(planningFill, () =>
              setPricingEditorOpen(true)
            ) ? (
            <ScopePricingSecondaryActions
              edit={scopePricingEditAction(planningFill, () =>
                setPricingEditorOpen(true)
              )}
            />
          ) : null}
        </View>
      );
    }

    return (
      <View
        style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}
      >
        <PricingEditorPanel Colors={Colors} darkMode={darkMode}>
          <PricingEditorHeader
            helper={rule.quantityHelper}
            onDone={closePricingEditor}
            Colors={Colors}
            darkMode={darkMode}
          />
          <PricingInputField
            label={fieldLabels?.count || 'Quantity'}
            value={countInput?.quantity ?? ''}
            suffix={
              isWindowsDoorsCountScopeItemId(itemId)
                ? 'each'
                : formatCountFieldSuffix(
                    fieldLabels?.countUnit ||
                      resolved.dualCount?.unit ||
                      'each'
                  )
            }
            placeholder='0'
            embedded
            commitOnBlur
            onFocus={() => focusQuantityField(itemId, 'count')}
            onChangeText={text => onItemQuantityChange(itemId, text, 'count')}
            onBlur={() => blurQuantityField(itemId, 'count')}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
          {itemId === 'hvac' ? (
            <PricingInputField
              label={fieldLabels?.secondaryCount || 'System capacity'}
              value={String(measurementsInput.hvacSystemTons ?? '')}
              suffix={formatCountFieldSuffix(
                fieldLabels?.secondaryCountUnit || 'ton'
              )}
              placeholder='0'
              embedded
              commitOnBlur
              onFocus={() => focusQuantityField('hvac__capacity', 'count')}
              onChangeText={text =>
                onItemQuantityChange('hvac__capacity', text, 'count', 'ton')
              }
              onBlur={() => blurQuantityField('hvac__capacity', 'count')}
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          ) : null}
          <PricingMatLabRow
            material={
              <PricingInputField
                label='Material'
                value={
                  materialInput?.quantity ??
                  (resolved.dualMaterial
                    ? String(resolved.dualMaterial.quantity)
                    : '')
                }
                helper={unitRateHelper(
                  materialInput?.quantity ??
                    (resolved.dualMaterial
                      ? String(resolved.dualMaterial.quantity)
                      : ''),
                  resolved.dualCount ?? null
                )}
                basis={resolved.dualCount ?? null}
                prefix='$'
                placeholder='0'
                embedded
                onFocus={() => focusQuantityField(materialKey)}
                onChangeText={text =>
                  onItemQuantityChange(materialKey, text, 'count', 'allowance')
                }
                onBlur={() => blurQuantityField(materialKey)}
                Colors={Colors}
                darkMode={darkMode}
                applying={applying}
              />
            }
            labor={
              <PricingInputField
                label='Labor'
                value={
                  laborInput?.quantity ??
                  (resolved.dualLabor
                    ? String(resolved.dualLabor.quantity)
                    : '')
                }
                helper={unitRateHelper(
                  laborInput?.quantity ??
                    (resolved.dualLabor
                      ? String(resolved.dualLabor.quantity)
                      : ''),
                  resolved.dualCount ?? null
                )}
                basis={resolved.dualCount ?? null}
                prefix='$'
                placeholder='0'
                embedded
                onFocus={() => focusQuantityField(laborKey)}
                onChangeText={text =>
                  onItemQuantityChange(laborKey, text, 'count', 'allowance')
                }
                onBlur={() => blurQuantityField(laborKey)}
                Colors={Colors}
                darkMode={darkMode}
                applying={applying}
              />
            }
          />
          {(() => {
            const mat = parseMoneyAmount(
              materialInput?.quantity ?? resolved.dualMaterial?.quantity
            );
            const lab = parseMoneyAmount(
              laborInput?.quantity ?? resolved.dualLabor?.quantity
            );
            const total = mat + lab;
            if (!(total > 0)) return null;
            return (
              <View style={styles.pricingEditorTotalRow}>
                <Text
                  style={{
                    color: captionColor(darkMode, Colors),
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  Total
                </Text>
                <Text
                  style={{
                    color: darkMode ? '#F5F7FA' : Colors.text,
                    fontSize: 15,
                    fontWeight: '800',
                  }}
                >
                  {formatDraftMoney(total)}
                </Text>
              </View>
            );
          })()}
        </PricingEditorPanel>
      </View>
    );
  }

  const repairSystemCard =
    itemId === 'stucco' && choiceId === 'repair_restucco';
  const quantityEntryItemId = repairSystemCard ? 'stucco_repairs' : itemId;
  const itemInput = measurementsInput.itemQuantities[quantityEntryItemId];
  const materialKey = allowanceSplitSubKey(itemId, 'material');
  const laborKey = allowanceSplitSubKey(itemId, 'labor');
  const allowanceKey = allowanceSplitSubKey(itemId, 'allowance');
  const sqftBasisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
  const materialInput = measurementsInput.itemQuantities[materialKey];
  const laborInput = measurementsInput.itemQuantities[laborKey];
  const allowanceInput = measurementsInput.itemQuantities[allowanceKey];
  const sqftBasisInput = measurementsInput.itemQuantities[sqftBasisKey];
  // Only the explicit open flag — field focus must not trap the editor open.
  const showEditor = pricingEditorOpen;
  const neededLabel = measurementSemanticsV1Enabled()
    ? itemId === 'paint_repair' &&
      String(templateKey || '').toLowerCase() === 'bathroom'
      ? (resolveBathroomPaintRepairMissingLabel({
          bathroomPaintRepairScope: measurementsInput.bathroomPaintRepairScope,
          bathroomPaintRepairEntireRoom:
            measurementsInput.bathroomPaintRepairEntireRoom,
          enteredTakeoffSqft:
            Number(
              String(
                measurementsInput.itemQuantities?.paint_repair?.quantity ?? ''
              ).replace(/,/g, '')
            ) || null,
        })?.replace(/^Needs\s+/i, '') ??
        missingStatusDisplayLabel(itemId, templateKey).replace(
          /^Needs\s+/i,
          ''
        ))
      : missingStatusDisplayLabel(itemId, templateKey).replace(/^Needs\s+/i, '')
    : (templateKey &&
        QUANTITY_NEEDED_LABELS_BY_TEMPLATE[templateKey]?.[itemId]) ||
      QUANTITY_NEEDED_LABELS[itemId] ||
      quantityNeededLabel(itemId, templateKey, rule.defaultUnit);
  const paintRepairMissing =
    itemId === 'paint_repair' &&
    String(templateKey || '').toLowerCase() === 'bathroom'
      ? resolveBathroomPaintRepairMissingLabel({
          bathroomPaintRepairScope: measurementsInput.bathroomPaintRepairScope,
          bathroomPaintRepairEntireRoom:
            measurementsInput.bathroomPaintRepairEntireRoom,
          enteredTakeoffSqft:
            Number(
              String(
                measurementsInput.itemQuantities?.paint_repair?.quantity ?? ''
              ).replace(/,/g, '')
            ) || null,
        })
      : null;
  const neededStatusLine =
    paintRepairMissing ??
    (measurementSemanticsV1Enabled()
      ? missingStatusDisplayLabel(itemId, templateKey)
      : `Needs ${neededLabel}`);

  const initialSuggestedFromCatalog = resolveScopeItemSuggestedPricing(
    itemId,
    measurementsInput,
    templateKey,
    resolved,
    pricingContext,
    choiceId
  );
  const assemblyInsulationPricing =
    itemId === 'insulation'
      ? resolveInsulationAssemblyScopeSuggestedPricing(
          measurementsInput,
          pricingContext,
          templateKey
        )
      : null;
  const insulationNationalComparison =
    itemId === 'insulation' && assemblyInsulationPricing
      ? resolveInsulationAssemblyNationalRateCardComparison(
          measurementsInput,
          pricingContext,
          templateKey
        )
      : null;
  const insulationLumpBenchmark =
    itemId === 'insulation' &&
    assemblyInsulationPricing &&
    !insulationNationalComparison
      ? resolveInsulationAssemblyLumpBenchmarkComparison(
          measurementsInput,
          pricingContext
        )
      : null;
  const catalogSuggested = assemblyInsulationPricing
    ? {
        fill: assemblyInsulationPricing,
        comparison:
          insulationNationalComparison ??
          insulationLumpBenchmark ??
          initialSuggestedFromCatalog.comparison,
      }
    : initialSuggestedFromCatalog;
  const liveMaterial = parsePricingAmount(materialInput?.quantity);
  const liveLabor = parsePricingAmount(laborInput?.quantity);
  const liveManualTotal = (liveMaterial || 0) + (liveLabor || 0);
  const liveManualBlock: SuggestedPricingBlock | null =
    liveManualTotal > 0
      ? {
          material: liveMaterial || 0,
          labor: liveLabor || 0,
          total: liveManualTotal,
          materialSource: 'template',
          laborSource: 'template',
          rateSourceLabel: 'User-entered material and labor',
          helper: 'Based on the material and labor entered in Edit.',
          mode: 'suggested_price',
          lumpSumOnly: false,
          basis:
            resolved.quantity != null && resolved.unit
              ? { quantity: resolved.quantity, unit: resolved.unit }
              : null,
          benchmarkAction: 'price_ready',
          productionStatus: 'review_required',
        }
      : null;
  const initialSuggested = {
    ...catalogSuggested,
    fill: catalogSuggested.fill || liveManualBlock,
  };
  let suggestedBudgetSplit = initialSuggested.fill;
  let suggestedComparisonSplit = initialSuggested.comparison;
  const intelligence = resolveScopeItemIntelligence({
    scopeKey: itemId,
    templateKey,
    notes: originalNotes,
    measurements: norm,
    resolved,
    suggestedPricing: initialSuggested.fill,
    activeScopeKeys: assemblyContext.activeScopeKeys,
    excludedScopeKeys: assemblyContext.excludedScopeKeys,
    pricingAcceptance: measurementsInput.pricingAcceptance,
    scopeGapResolutions: measurementsInput.scopeGapResolutions,
    itemQuantities: measurementsInput.itemQuantities,
    pricingAccepted: Boolean(measurementsInput.pricingAcceptance?.[itemId]),
  });
  const formulaSuggested = resolveFormulaTargetSuggestedPricing({
    itemId,
    measurementsInput,
    templateKey,
    resolved,
    pricingContext,
    intelligence,
    suggested: initialSuggested,
    choiceId,
  });
  suggestedBudgetSplit = formulaSuggested.fill;
  suggestedComparisonSplit = formulaSuggested.comparison;
  if (assemblyInsulationPricing) {
    suggestedBudgetSplit = assemblyInsulationPricing;
    suggestedComparisonSplit =
      insulationNationalComparison ??
      insulationLumpBenchmark ??
      suggestedComparisonSplit;
  }
  // Countertop pricing already has one primary suggested price. Do not render
  // the older generic national-average comparison as a second Apply choice.
  if (
    suggestedBudgetSplit &&
    (itemId === 'countertops' ||
      (isNationalAveragePricingBlock(suggestedBudgetSplit) &&
        (isNationalAveragePricingBlock(suggestedComparisonSplit) ||
          Boolean(suggestedComparisonSplit?.isComparison))))
  ) {
    suggestedComparisonSplit = null;
  }
  const pricingBasis =
    resolveAllowanceEditorPricingBasis(
      itemId,
      measurementsInput,
      templateKey
    ) ?? parseBudgetSplitBasis(suggestedBudgetSplit);
  const fallbackBasisUnit = resolveAllowanceEditorDefaultBasisUnit(
    itemId,
    templateKey,
    rule
  );
  const basisUnit = pricingBasis?.unit || fallbackBasisUnit;
  const basisUnitLabel = formatUnitLabel(basisUnit);
  const applySuggestedPricingBlock = (block: SuggestedPricingBlock) => {
    if (onApplySuggestedPricing) {
      onApplySuggestedPricing(itemId, block);
      setPricingEditorOpen(false);
      return;
    }
    hapticTap();
    if (block.basis?.quantity && block.basis.unit) {
      onItemQuantityChange(
        sqftBasisKey,
        String(block.basis.quantity),
        'count',
        block.basis.unit
      );
    }
    onItemQuantityChange(
      allowanceKey,
      String(block.total),
      'count',
      'allowance'
    );
    if (!block.lumpSumOnly) {
      onItemQuantityChange(
        materialKey,
        String(block.material),
        'count',
        'allowance'
      );
      onItemQuantityChange(laborKey, String(block.labor), 'count', 'allowance');
    }
    setPricingEditorOpen(false);
    setTimeout(() => onItemQuantityBlur(itemId), 0);
  };

  if (resolved.pricingReady && !showEditor) {
    if (resolved.combinedAllowanceRole === 'included_in_combined') {
      const combinedTotal =
        resolved.combinedAllowanceTotal ?? resolved.quantity ?? 0;
      return (
        <View
          style={[
            styles.qtySection,
            { borderTopColor: dividerColor(darkMode) },
          ]}
        >
          <View
            style={[
              styles.includedPill,
              darkMode ? styles.includedPillDark : styles.includedPillLight,
            ]}
          >
            <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>
              Included in cabinet allowance
            </Text>
          </View>
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 12,
              fontWeight: '600',
              marginTop: 8,
            }}
          >
            No separate price
          </Text>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginTop: 4,
              lineHeight: 15,
            }}
          >
            Same ${Number(combinedTotal).toLocaleString()} combined total as
            cabinets above — not added again.
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}
      >
        {itemId === 'electrical' &&
        !electricalHasAppliedPricing &&
        !pricingEditorOpen &&
        (!resolved.pricingReady || electricalQuantityEditorOpen) ? (
          <PricingInputField
            label='Count'
            value={measurementsInput.itemQuantities[itemId]?.quantity ?? ''}
            suffix='each'
            embedded
            commitOnBlur
            onFocus={() => onItemQuantityFocus(itemId, 'count')}
            onChangeText={text =>
              onItemQuantityChange(itemId, text, 'count', 'each')
            }
            onBlur={() => {
              onItemQuantityBlur(itemId, 'count');
              setElectricalQuantityEditorOpen(false);
            }}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        ) : null}
        {resolved.combinedAllowanceRole === 'combined_total' ? (
          <Text
            style={{
              color: pricingLabelColor(darkMode, Colors),
              fontSize: 12,
              marginBottom: 8,
              lineHeight: 17,
            }}
          >
            One allowance for cabinets and countertops — the countertop line
            below is included, not priced again.
          </Text>
        ) : null}
        {(() => {
          const accepted = scopeShowsConfirmScopeAppliedPricing(
            itemId,
            measurementsInput,
            templateKey
          );
          const hideSuggestion =
            suppressSuggestedPricing ||
            shouldHideSuggestedPanel({
              itemId,
              itemQuantities: measurementsInput.itemQuantities,
              pricingAcceptance: measurementsInput.pricingAcceptance,
              suggestedTotal: suggestedBudgetSplit?.total ?? null,
            });
          const acceptedDisplay = accepted
            ? resolveAcceptedPricingDisplay({
                itemId,
                resolved,
                acceptance: measurementsInput.pricingAcceptance?.[itemId],
                suggestedBlock: suggestedBudgetSplit,
                intelligence,
              })
            : null;
          const openPricingEditor = () => {
            setPricingEditorOpen(true);
            // Only seed the allowance field from a money quantity. Physical takeoff
            // (e.g. living/floor SF 1879) must never be written as a dollar total.
            const unit = String(resolved.unit || '').toLowerCase();
            const isMoneyUnit = unit === 'allowance' || unit === 'lump_sum';
            if (!isMoneyUnit) return;
            const existingSplit =
              (parsePricingAmount(
                measurementsInput.itemQuantities[materialKey]?.quantity
              ) || 0) +
              (parsePricingAmount(
                measurementsInput.itemQuantities[laborKey]?.quantity
              ) || 0);
            const existingAllowance = parsePricingAmount(
              measurementsInput.itemQuantities[allowanceKey]?.quantity
            );
            if (existingSplit > 0 || existingAllowance != null) return;
            const total =
              resolved.quantity != null &&
              !isPlaceholderAllowancePricing(
                resolved.quantity,
                resolved.unit,
                itemId
              )
                ? String(resolved.quantity)
                : '';
            if (total) {
              onItemQuantityChange(allowanceKey, total, 'count', 'allowance');
            }
          };
          const onUseCalculatedQuantity = intelligence.formula
            ? () => {
                hapticTap();
                const applyTarget = resolveFormulaQuantityApplyTarget({
                  scopeKey: itemId,
                  formula: intelligence.formula!,
                });
                onItemQuantityChange(
                  itemId,
                  String(applyTarget.quantity),
                  'count',
                  applyTarget.unit,
                  'calculated_confirmed',
                  buildCalculatedQuantityRevertSnapshot(
                    itemId,
                    measurementsInput.itemQuantities,
                    measurementsInput.pricingAcceptance,
                    resolved
                  )
                );
                setTimeout(() => onItemQuantityBlur(itemId), 0);
              }
            : undefined;
          const calculatedRevertLabel = calculatedQuantityRevertLabel(
            measurementsInput.itemQuantities[itemId]?.quantityBeforeCalculated
          );
          const onRevertCalculated =
            calculatedRevertLabel && onRevertCalculatedQuantity
              ? () => onRevertCalculatedQuantity(itemId)
              : undefined;
          const scopeMeasurementsRecord = measurementsInput as Record<
            string,
            unknown
          >;
          const suppressFormulaPlanning = Boolean(
            intelligence.formula &&
              shouldSuppressInsulationEnvelopePlanningFormula({
                scopeKey: itemId,
                formulaKey: intelligence.formula.formulaKey,
                measurements: scopeMeasurementsRecord,
              })
          );
          const showInlineSqftTakeoff =
            !hideInlineTakeoff &&
            !accepted &&
            step2TierNeedsInlineTakeoffEntry(
              itemId,
              templateKey,
              resolved,
              Boolean(measurementsInput.pricingAcceptance?.[itemId])
            ) &&
            String(resolved.unit || rule.defaultUnit).toLowerCase() ===
              'sqft' &&
            !(
              itemId === 'paint_repair' &&
              String(templateKey || '').toLowerCase() === 'bathroom' &&
              resolveBathroomPaintRepairScope(
                measurementsInput.bathroomPaintRepairScope
              ) === 'full_room'
            );
          const inlineSqftTakeoff = showInlineSqftTakeoff ? (
            <InlineTakeoffCountInput
              label={inlineTakeoffQuantityLabel(
                itemId,
                templateKey,
                resolved.unit || rule.defaultUnit
              )}
              value={
                itemInput?.quantity ??
                (resolved.quantity != null && resolved.quantity > 0
                  ? String(resolved.quantity)
                  : '')
              }
              unit={resolved.unit || rule.defaultUnit}
              onFocus={() => focusQuantityField(itemId, 'count')}
              onCommit={text => {
                onItemQuantityChange(
                  itemId,
                  text,
                  'count',
                  resolved.unit || rule.defaultUnit,
                  'user_entered'
                );
              }}
              onBlur={() => blurQuantityField(itemId, 'count')}
              Colors={Colors}
              darkMode={darkMode}
              applying={applying}
            />
          ) : null;
          if (accepted && acceptedDisplay) {
            return (
              <>
                {inlineSqftTakeoff}
                <AcceptedPricingSummary
                  display={acceptedDisplay}
                  intelligence={intelligence}
                  scopeKey={itemId}
                  scopeItemLabel={scopeItemLabel}
                  resolved={resolved}
                  suggestedBlock={suggestedBudgetSplit}
                  comparisonBlock={suggestedComparisonSplit}
                  scopeGapResolutions={measurementsInput.scopeGapResolutions}
                  scopeGapPricingContext={scopeGapPricingContext}
                  originalNotes={originalNotes}
                  Colors={Colors}
                  darkMode={darkMode}
                  onEditPricing={openPricingEditor}
                  onClearPricing={
                    onClearAcceptedPricing
                      ? () => onClearAcceptedPricing(itemId)
                      : undefined
                  }
                  onScopeGapResolutionsChange={onScopeGapResolutionsChange}
                  onScopeGapPriceSeparately={(
                    componentKey,
                    component,
                    benchmarkAssumption,
                    benchmarkProfile
                  ) =>
                    onScopeGapPriceSeparately?.(
                      itemId,
                      component,
                      benchmarkAssumption,
                      benchmarkProfile
                    )
                  }
                  onScopeGapIncludeInParentPrice={(
                    componentKey,
                    component,
                    addonAmount,
                    benchmarkAssumption,
                    benchmarkProfile
                  ) =>
                    onScopeGapIncludeInParentPrice?.(
                      itemId,
                      component,
                      addonAmount,
                      benchmarkAssumption,
                      benchmarkProfile
                    )
                  }
                />
                {!hideSuggestion && suggestedBudgetSplit ? (
                  <SuggestedBudgetSplitRows
                    block={suggestedBudgetSplit}
                    Colors={Colors}
                    darkMode={darkMode}
                    onUsePricing={() =>
                      applySuggestedPricingBlock(suggestedBudgetSplit)
                    }
                    itemId={itemId}
                    quantitySource={resolved.quantitySource}
                    hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
                    livingSf={
                      Number(
                        String(measurementsInput.floorAreaSqft || '').replace(
                          /,/g,
                          ''
                        )
                      ) || null
                    }
                    confidenceLabel={intelligence?.pricing?.confidenceLabel}
                    hasCurrentPricing
                  />
                ) : null}
              </>
            );
          }
          return (
            <>
              {showInlineSqftTakeoff ? (
                inlineSqftTakeoff
              ) : resolved.quantity != null &&
                resolved.quantity > 0 &&
                !(
                  itemId === 'hvac' &&
                  !hideSuggestion &&
                  Boolean(suggestedBudgetSplit?.displayQuantityLine)
                ) ? (
                <PricingAmountRow
                  value={formatResolvedQuantityDisplay(
                    resolved.quantity ?? 0,
                    resolved.unit,
                    resolved.quantitySource,
                    itemId
                  )}
                  pill={
                    resolved.quantitySource === 'notes' ? (
                      <SourcePill kind='notes' />
                    ) : undefined
                  }
                  label={quantityRowSourceLabel}
                  emphasized
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {noteVarianceNotice}
              {!(
                String(templateKey || '').toLowerCase() === 'flooring' &&
                isFlooringConfirmScopePricingCard(itemId) &&
                !hideSuggestion &&
                suggestedBudgetSplit
              ) ? (
                <ScopeIntelligenceNotice
                  intelligence={intelligence}
                  Colors={Colors}
                  darkMode={darkMode}
                  compact
                  pricingCardOwnsStatus={
                    !hideSuggestion && Boolean(suggestedBudgetSplit)
                  }
                  onUseCalculatedQuantity={onUseCalculatedQuantity}
                  onRevertCalculatedQuantity={onRevertCalculated}
                  calculatedRevertLabel={calculatedRevertLabel}
                  suppressFormulaPlanning={suppressFormulaPlanning}
                  measurements={scopeMeasurementsRecord}
                />
              ) : null}
              {!hideSuggestion && suggestedBudgetSplit ? (
                <SuggestedBudgetSplitRows
                  block={suggestedBudgetSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() =>
                    applySuggestedPricingBlock(suggestedBudgetSplit)
                  }
                  itemId={itemId}
                  quantitySource={resolved.quantitySource}
                  hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
                  livingSf={
                    Number(
                      String(measurementsInput.floorAreaSqft || '').replace(
                        /,/g,
                        ''
                      )
                    ) || null
                  }
                  confidenceLabel={intelligence?.pricing?.confidenceLabel}
                />
              ) : null}
              {shouldShowPricingComparisonBlock(suggestedComparisonSplit) ? (
                <ComparisonToggle
                  block={suggestedComparisonSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() =>
                    applySuggestedPricingBlock(suggestedComparisonSplit)
                  }
                  itemId={itemId}
                  quantitySource={resolved.quantitySource}
                  hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
                  livingSf={
                    Number(
                      String(measurementsInput.floorAreaSqft || '').replace(
                        /,/g,
                        ''
                      )
                    ) || null
                  }
                  confidenceLabel={intelligence?.pricing?.confidenceLabel}
                  hasCurrentPricing={
                    scopeHasCommittedConfirmScopePrice({
                      itemId,
                      itemQuantities: measurementsInput.itemQuantities,
                      pricingAcceptance: measurementsInput.pricingAcceptance,
                    }) ||
                    hasAcceptedScopePricing(
                      itemId,
                      measurementsInput.itemQuantities,
                      measurementsInput.pricingAcceptance
                    )
                  }
                  editAction={scopePricingEditAction(
                    suggestedBudgetSplit,
                    () =>
                      itemId === 'electrical'
                        ? setPricingEditorOpen(true)
                        : openPricingEditor(),
                    true
                  )}
                />
              ) : scopePricingEditAction(
                  suggestedBudgetSplit,
                  () =>
                    itemId === 'electrical'
                      ? setPricingEditorOpen(true)
                      : openPricingEditor()
                ) ? (
                <ScopePricingSecondaryActions
                  edit={scopePricingEditAction(
                    suggestedBudgetSplit,
                    () =>
                      itemId === 'electrical'
                        ? setPricingEditorOpen(true)
                        : openPricingEditor()
                  )}
                />
              ) : null}
            </>
          );
        })()}
      </View>
    );
  }

  if (!showEditor) {
    const livingSf = Number(norm.floorAreaSqft);
    const flooringSf = Number(norm.flooringSqft);
    const showGrossFloorPlanning =
      measurementSemanticsV1Enabled() &&
      (itemId === 'tile_flooring' || itemId === 'flooring') &&
      !hasFlooringProductTakeoff(itemId, measurementsInput) &&
      isGrossFlooringDerivedFromLiving({
        flooringSqft: flooringSf,
        floorAreaSqft: livingSf,
      });
    const softCostAllowance = isSoftCostAllowanceScope(
      itemId,
      rule.lumpSumOnly
    );
    const hidePlanningSuggestion =
      suppressSuggestedPricing ||
      shouldHideSuggestedPanel({
        itemId,
        itemQuantities: measurementsInput.itemQuantities,
        pricingAcceptance: measurementsInput.pricingAcceptance,
        suggestedTotal: suggestedBudgetSplit?.total ?? null,
      });
    // Soft-cost suggestion cards already own the "Needs allowance" copy (same pattern as Excavation).
    const cardOwnsMissingCopy =
      Boolean(suggestedBudgetSplit) && softCostAllowance;

    return (
      <View
        style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}
      >
        {showGrossFloorPlanning ? (
          <View style={{ marginBottom: 8 }}>
            <Text
              style={{
                color: darkMode ? '#F5F7FA' : Colors.text,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              Gross interior floor area: {livingSf.toLocaleString()} SF
            </Text>
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                marginTop: 2,
              }}
            >
              Source: Derived from declared living area
            </Text>
            <Text
              style={{
                color: '#fbbf24',
                fontSize: 11,
                fontWeight: '700',
                marginTop: 4,
              }}
            >
              Status: Needs finish allocation and material-specific takeoff
            </Text>
          </View>
        ) : hideInlineTakeoff ||
          cardOwnsMissingCopy ||
          suggestedBudgetSplit ? null : (
          <Text
            style={{
              color: '#fbbf24',
              fontSize: 11,
              fontWeight: '700',
              marginBottom: 6,
            }}
          >
            {neededStatusLine}
          </Text>
        )}
        {!hideInlineTakeoff &&
        !showGrossFloorPlanning &&
        !cardOwnsMissingCopy &&
        rule.quantityHelper ? (
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginBottom: 4,
              lineHeight: 15,
            }}
          >
            {rule.quantityHelper}
          </Text>
        ) : null}
        {!hideInlineTakeoff &&
        (repairSystemCard ||
          step2TierNeedsInlineTakeoffEntry(
            itemId,
            templateKey,
            resolved,
            Boolean(measurementsInput.pricingAcceptance?.[itemId])
          )) &&
        !(
          itemId === 'paint_repair' &&
          String(templateKey || '').toLowerCase() === 'bathroom' &&
          resolveBathroomPaintRepairScope(
            measurementsInput.bathroomPaintRepairScope
          ) === 'full_room'
        ) ? (
          <InlineTakeoffCountInput
            label={inlineTakeoffQuantityLabel(
              itemId,
              templateKey,
              resolved.unit || rule.defaultUnit
            )}
            value={
              itemInput?.quantity ??
              (repairSystemCard
                ? (measurementsInput.stuccoRepairAffectedSqft ?? '')
                : '')
            }
            unit={resolved.unit || rule.defaultUnit}
            onFocus={() => focusQuantityField(quantityEntryItemId, 'count')}
            onCommit={text => {
              onItemQuantityChange(
                quantityEntryItemId,
                text,
                'count',
                resolved.unit || rule.defaultUnit,
                'user_entered'
              );
            }}
            onBlur={() => blurQuantityField(quantityEntryItemId, 'count')}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        ) : null}
        {!hidePlanningSuggestion && suggestedBudgetSplit ? (
          <SuggestedBudgetSplitRows
            block={suggestedBudgetSplit}
            Colors={Colors}
            darkMode={darkMode}
            onUsePricing={
              suggestedBudgetSplit.isComparison
                ? undefined
                : () => applySuggestedPricingBlock(suggestedBudgetSplit)
            }
            itemId={itemId}
            quantitySource={resolved.quantitySource}
            hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
            livingSf={
              Number(
                String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')
              ) || null
            }
            confidenceLabel={intelligence?.pricing?.confidenceLabel}
          />
        ) : null}
        {shouldShowPricingComparisonBlock(suggestedComparisonSplit) ? (
          <ComparisonToggle
            block={suggestedComparisonSplit}
            Colors={Colors}
            darkMode={darkMode}
            onUsePricing={() =>
              applySuggestedPricingBlock(suggestedComparisonSplit)
            }
            itemId={itemId}
            quantitySource={resolved.quantitySource}
            hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
            livingSf={
              Number(
                String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')
              ) || null
            }
            confidenceLabel={intelligence?.pricing?.confidenceLabel}
            editAction={scopePricingEditAction(
              suggestedBudgetSplit,
              () => setPricingEditorOpen(true),
              true
            )}
          />
        ) : scopePricingEditAction(suggestedBudgetSplit, () =>
            setPricingEditorOpen(true)
          ) ? (
          <ScopePricingSecondaryActions
            edit={scopePricingEditAction(suggestedBudgetSplit, () =>
              setPricingEditorOpen(true)
            )}
          />
        ) : null}
      </View>
    );
  }

  const lumpSumValue =
    allowanceInput?.quantity ??
    (itemInput?.unit === 'allowance' || itemInput?.unit === 'lump_sum'
      ? (itemInput?.quantity ?? '')
      : '');
  const pricingBasisValue = sqftBasisInput?.quantity ?? '';
  const materialValue = materialInput?.quantity ?? '';
  const laborValue = laborInput?.quantity ?? '';
  const editorMoneyTotal = rule.lumpSumOnly
    ? parseMoneyAmount(lumpSumValue)
    : parseMoneyAmount(materialValue) + parseMoneyAmount(laborValue);
  // Keep the original benchmark/suggestion available while editing so the user can
  // switch back. Do not overlay editor values onto the Apply card.
  const showEditorSuggestedPanel =
    !suppressSuggestedPricing &&
    isSavedPricingBlock(suggestedBudgetSplit) &&
    (!(editorMoneyTotal > 0) ||
      Math.abs((suggestedBudgetSplit?.total || 0) - editorMoneyTotal) >= 0.01);

  const inferredPricingMode = rule.allowanceOrSplit
    ? resolveAllowanceOrSplitMode(itemId, measurementsInput, rule.defaultUnit)
    : null;
  const pricingMode: AllowanceOrSplitMode | null = rule.lumpSumOnly
    ? 'allowance'
    : rule.allowanceOrSplit
      ? (pricingModeOverride ?? inferredPricingMode)
      : null;
  const showAllowanceEditor = rule.lumpSumOnly || pricingMode === 'allowance';

  const handlePricingModeChange = (next: AllowanceOrSplitMode) => {
    setPricingModeOverride(next);
    if (next === 'allowance') {
      // Keep any existing allowance total; clear split legs so mode sticks.
      const updates: Array<{
        itemId: string;
        quantity: string;
        unit?: string;
      }> = [
        { itemId: materialKey, quantity: '', unit: 'allowance' },
        { itemId: laborKey, quantity: '', unit: 'allowance' },
        { itemId: sqftBasisKey, quantity: '', unit: basisUnit },
      ];
      if (!parseMoneyAmount(lumpSumValue)) {
        updates.push({ itemId: allowanceKey, quantity: '', unit: 'allowance' });
      }
      onBatchItemQuantityChange(updates);
      return;
    }
    // Switching to Material + Labor: clear flat allowance so split mode sticks.
    if (parseMoneyAmount(lumpSumValue)) {
      onBatchItemQuantityChange([
        { itemId: allowanceKey, quantity: '', unit: 'allowance' },
      ]);
    }
  };

  const pricingEntryMode =
    pricingEntryModeOverride ??
    inferPricingEntryMode(measurementsInput, sqftBasisKey, rule.splitTotalOnly);
  const showPricingEntryToggle = !showAllowanceEditor && !rule.splitTotalOnly;

  const handlePricingEntryModeChange = (next: PricingEntryMode) => {
    setPricingEntryModeOverride(next);
    if (
      next === 'takeoff' &&
      !parseMoneyAmount(pricingBasisValue) &&
      pricingBasis &&
      pricingBasis.quantity > 0
    ) {
      onItemQuantityChange(
        sqftBasisKey,
        String(pricingBasis.quantity),
        'count',
        pricingBasis.unit,
        'user_entered'
      );
    }
  };

  return (
    <View
      style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}
    >
      <PricingEditorPanel Colors={Colors} darkMode={darkMode}>
        <PricingEditorHeader
          helper={pricingEditorHelperForMode(
            showPricingEntryToggle ? pricingEntryMode : 'flat',
            rule.quantityHelper
          )}
          onDone={closePricingEditor}
          Colors={Colors}
          darkMode={darkMode}
        />
        {rule.allowanceOrSplit && pricingMode ? (
          <AllowanceOrSplitModeToggle
            mode={pricingMode}
            onChange={handlePricingModeChange}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        ) : null}
        {showPricingEntryToggle ? (
          <PricingEntryModeToggle
            mode={pricingEntryMode}
            onChange={handlePricingEntryModeChange}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        ) : null}
        {showAllowanceEditor ? (
          <PricingInputField
            label='Allowance'
            value={lumpSumValue}
            prefix='$'
            placeholder='Enter allowance'
            embedded
            onFocus={() => focusQuantityField(allowanceKey)}
            onChangeText={text =>
              onItemQuantityChange(allowanceKey, text, 'count', 'allowance')
            }
            onBlur={() => blurQuantityField(allowanceKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        ) : (
          <MaterialLaborSplitEditor
            itemId={itemId}
            materialValue={materialValue}
            laborValue={laborValue}
            pricingBasisValue={pricingBasisValue}
            pricingBasis={pricingBasis}
            basisUnit={basisUnit}
            basisUnitLabel={basisUnitLabel}
            basisFieldLabel={pricingBasisFieldLabel(itemId, basisUnit)}
            suggestedBlock={suggestedBudgetSplit}
            sqftBasisKey={sqftBasisKey}
            materialKey={materialKey}
            laborKey={laborKey}
            onBatchItemQuantityChange={onBatchItemQuantityChange}
            focusQuantityField={focusQuantityField}
            blurQuantityField={blurQuantityField}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
            splitTotalOnly={rule.splitTotalOnly}
            entryMode={pricingEntryMode}
            getPendingUpdatesRef={pricingEditorPendingRef}
          />
        )}
      </PricingEditorPanel>
      {showEditorSuggestedPanel &&
      suggestedBudgetSplit &&
      !showAllowanceEditor ? (
        <SuggestedBudgetSplitRows
          block={suggestedBudgetSplit}
          Colors={Colors}
          darkMode={darkMode}
          onUsePricing={() => applySuggestedPricingBlock(suggestedBudgetSplit)}
          itemId={itemId}
          quantitySource={resolved.quantitySource}
          hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
          livingSf={
            Number(
              String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')
            ) || null
          }
          confidenceLabel={intelligence?.pricing?.confidenceLabel}
          hasCurrentPricing={editorMoneyTotal > 0}
        />
      ) : null}
      {showEditorSuggestedPanel &&
      suggestedBudgetSplit &&
      showAllowanceEditor &&
      suggestedBudgetSplit.lumpSumOnly ? (
        <SuggestedBudgetSplitRows
          block={suggestedBudgetSplit}
          Colors={Colors}
          darkMode={darkMode}
          onUsePricing={() => applySuggestedPricingBlock(suggestedBudgetSplit)}
          itemId={itemId}
          quantitySource={resolved.quantitySource}
          hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
          livingSf={
            Number(
              String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')
            ) || null
          }
          confidenceLabel={intelligence?.pricing?.confidenceLabel}
          hasCurrentPricing={editorMoneyTotal > 0}
        />
      ) : null}
      {shouldShowPricingComparisonBlock(suggestedComparisonSplit) ? (
        <ComparisonToggle
          block={suggestedComparisonSplit}
          Colors={Colors}
          darkMode={darkMode}
          onUsePricing={() =>
            applySuggestedPricingBlock(suggestedComparisonSplit)
          }
          itemId={itemId}
          quantitySource={resolved.quantitySource}
          hasPrimaryTakeoff={hasPrimaryTakeoffForDisplay}
          livingSf={
            Number(
              String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')
            ) || null
          }
          confidenceLabel={intelligence?.pricing?.confidenceLabel}
          hasCurrentPricing={
            editorMoneyTotal > 0 ||
            scopeHasCommittedConfirmScopePrice({
              itemId,
              itemQuantities: measurementsInput.itemQuantities,
              pricingAcceptance: measurementsInput.pricingAcceptance,
            })
          }
        />
      ) : null}
    </View>
  );
}

function YesNoChip({
  label,
  active,
  variant,
  onPress,
  Colors,
  darkMode,
}: {
  label: string;
  active: boolean;
  variant: 'yes' | 'no' | 'unsure';
  onPress: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const inactiveStyle = inactiveChoiceChipStyle(darkMode, Colors);
  let borderColor = inactiveStyle.borderColor;
  let backgroundColor = inactiveStyle.backgroundColor;
  let textColor = inactiveStyle.textColor;

  if (active) {
    if (variant === 'yes') {
      const selectedYes = confirmScopeChoiceSelectedYesColors();
      borderColor = selectedYes.borderColor;
      backgroundColor = selectedYes.backgroundColor;
      textColor = selectedYes.textColor;
    } else if (variant === 'unsure') {
      borderColor = 'rgba(251,191,36,0.55)';
      backgroundColor = 'transparent';
      textColor = '#d4a017';
    } else {
      borderColor = darkMode ? 'rgba(255,255,255,0.2)' : Colors.line;
      backgroundColor = darkMode
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(0,0,0,0.04)';
      textColor = Colors.text;
    }
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.choiceChip, { borderColor, backgroundColor }]}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 12,
          fontWeight: active ? '800' : '600',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function AssemblyChoiceChip({
  label,
  active,
  variant,
  onPress,
  Colors,
  darkMode,
}: {
  label: string;
  active: boolean;
  variant: 'yes' | 'no';
  onPress: () => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const inactiveStyle = inactiveChoiceChipStyle(darkMode, Colors);
  let borderColor = inactiveStyle.borderColor;
  let backgroundColor = inactiveStyle.backgroundColor;
  let textColor = inactiveStyle.textColor;

  if (active) {
    if (variant === 'yes') {
      const selectedYes = confirmScopeChoiceSelectedYesColors();
      borderColor = selectedYes.borderColor;
      backgroundColor = selectedYes.backgroundColor;
      textColor = selectedYes.textColor;
    } else {
      borderColor = darkMode ? 'rgba(255,255,255,0.2)' : Colors.line;
      backgroundColor = darkMode
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(0,0,0,0.04)';
      textColor = Colors.text;
    }
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.assemblyChoiceChip, { borderColor, backgroundColor }]}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 12,
          fontWeight: active ? '800' : '600',
          textAlign: 'center',
          lineHeight: 16,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function WetAreaInstallLineCard({
  item,
  templateKey,
  originalNotes,
  measurementsInput,
  onItemQuantityChange,
  onBatchItemQuantityChange,
  onClearSuggestedPrefill,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  onClearAcceptedPricing,
  onScopeGapResolutionsChange,
  onScopeGapPriceSeparately,
  onScopeGapIncludeInParentPrice,
  onRevertCalculatedQuantity,
  pricingEditorRequest,
  onPricingEditorRequestHandled,
  onSaveCustomPricing,
  visualCtx,
  Colors,
  darkMode,
  applying,
  embedded = false,
}: {
  item: ScopeChecklistItem;
  templateKey?: string | null;
  originalNotes?: string | null;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string,
    source?: QuantitySource,
    calculatedRevertFrom?: CalculatedQuantityRevertSnapshot
  ) => void;
  onBatchItemQuantityChange: (
    updates: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onClearSuggestedPrefill?: (
    itemId: string,
    pendingUpdates?: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (
    itemId: string,
    block: SuggestedPricingBlock
  ) => void;
  onClearAcceptedPricing?: (itemId: string) => void;
  onScopeGapResolutionsChange?: (next: ScopeGapResolutionsMap) => void;
  onScopeGapPriceSeparately?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onScopeGapIncludeInParentPrice?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    addonAmount: number,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onRevertCalculatedQuantity?: (itemId: string) => void;
  pricingEditorRequest?: { itemId: string; token: number } | null;
  onPricingEditorRequestHandled?: () => void;
  onSaveCustomPricing?: () => void;
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
  embedded?: boolean;
}) {
  let helper = checklistDisplayHelper(item, templateKey);
  if (String(templateKey || '').toLowerCase() === 'flooring') {
    helper =
      flooringScopeCardHelper(
        item.id,
        measurementsInput as Record<string, unknown>
      ) ||
      (item.id === 'floor_demo'
        ? 'Removes existing flooring and bulk setting material, then cleans the exposed substrate. Includes protection, haul-off, and disposal. Extra residual grinding, patching, skim coating, and leveling are separate under floor prep.'
        : item.id === 'floor_prep'
          ? 'Extra substrate work after demo and cleaning — residual adhesive/thinset grinding, patching, skim coating, or leveling required for the new floor. Ordinary demo cleanup is not included here.'
          : helper);
  }
  const cardLabel =
    String(templateKey || '').toLowerCase() === 'flooring'
      ? flooringScopeCardLabel(
          item.id,
          measurementsInput as Record<string, unknown>
        ) || checklistDisplayLabel(item, templateKey)
      : checklistDisplayLabel(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const measuredSelection = scopeItemHasMeasuredSelection(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);

  return (
    <View
      style={
        embedded
          ? styles.qmEmbeddedScopeBlock
          : scopeCardStyle(tier, item, Colors, darkMode, measuredSelection)
      }
    >
      <ScopeItemTitleRow
        label={cardLabel}
        noteBadge={noteBadge}
        darkMode={darkMode}
        Colors={Colors}
      />
      {helper ? (
        <Text
          style={[
            styles.scopeCardDescription,
            { color: captionColor(darkMode, Colors) },
          ]}
        >
          {helper}
        </Text>
      ) : null}
      <View style={styles.includedPillRow}>
        <View
          style={[
            styles.includedPill,
            darkMode ? styles.includedPillDark : styles.includedPillLight,
          ]}
        >
          <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>
            {item.id === 'demo_clearing'
              ? 'Included · labor + equipment + disposal'
              : 'Included · labor + materials'}
          </Text>
        </View>
      </View>
      <QuantitySection
        itemId={item.id}
        inScope
        templateKey={templateKey}
        originalNotes={originalNotes}
        hideInlineTakeoff={
          isWholeHomeQuickMeasurementTemplate(templateKey) ||
          ([
            'flooring',
            'landscaping',
            'concrete',
            'stucco',
            'roofing',
          ].includes(String(templateKey || '').toLowerCase()) &&
            !(item.id === 'stucco' && item.choiceId === 'repair_restucco'))
        }
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
        onBatchItemQuantityChange={onBatchItemQuantityChange}
        onClearSuggestedPrefill={onClearSuggestedPrefill}
        onItemQuantityBlur={onItemQuantityBlur}
        onItemQuantityFocus={onItemQuantityFocus}
        onApplySuggestedPricing={onApplySuggestedPricing}
        onClearAcceptedPricing={onClearAcceptedPricing}
        onScopeGapResolutionsChange={onScopeGapResolutionsChange}
        onScopeGapPriceSeparately={onScopeGapPriceSeparately}
        onScopeGapIncludeInParentPrice={onScopeGapIncludeInParentPrice}
        onRevertCalculatedQuantity={onRevertCalculatedQuantity}
        pricingEditorRequest={pricingEditorRequest}
        onPricingEditorRequestHandled={onPricingEditorRequestHandled}
        scopeItemLabel={cardLabel}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    </View>
  );
}

/**
 * Applying pricing updates the shared measurements object. Keep that update
 * from invalidating every pricing card: each row only needs its own quantity
 * entries, acceptance record, scope-gap record, and primitive measurement
 * inputs. This is intentionally narrower than comparing measurementsInput by
 * reference, which made a single Apply tap synchronously rebuild every card.
 */
function scopeRowMeasurementSignature(
  measurementsInput: ScopeMeasurementsInputExtended,
  itemId: string,
  templateKey?: string | null
): string {
  const inputRecord = measurementsInput as Record<string, unknown>;
  const rule = getChecklistItemQuantityRuleOrDefault(itemId, templateKey);
  const electricalOwnershipSensitive =
    itemId === 'electrical_standard_circuit' ||
    itemId === 'electrical_dedicated_20a' ||
    itemId.startsWith('electrical_circuit_') ||
    itemId === 'electrical_240v_receptacle';
  const quantityKeys = Object.keys(measurementsInput.itemQuantities || {})
    .filter(
      key =>
        (electricalOwnershipSensitive && key.startsWith('electrical_')) ||
        key === itemId ||
        key.startsWith(`${itemId}__`) ||
        key === `${itemId}_count` ||
        key === `${itemId}Count`
    )
    .sort();
  const quantityEntries = quantityKeys.map(key => [
    key,
    measurementsInput.itemQuantities[key],
  ]);
  const primitiveMeasurements = Object.keys(measurementsInput)
    .filter(
      key =>
        key !== 'itemQuantities' &&
        key !== 'pricingAcceptance' &&
        key !== 'scopeGapResolutions'
    )
    .sort()
    .map(key => {
      const value = inputRecord[key];
      return Array.isArray(value) || value == null || typeof value !== 'object'
        ? [key, value]
        : null;
    })
    .filter((entry): entry is [string, unknown] => Boolean(entry));

  return JSON.stringify({
    primitiveMeasurements,
    measurementKeys: [rule.measurementKey, ...(rule.measurementKeys || [])].map(
      key => [key, key ? inputRecord[key] : undefined]
    ),
    quantityEntries,
    pricingAcceptance: measurementsInput.pricingAcceptance?.[itemId],
    scopeGapResolutions: measurementsInput.scopeGapResolutions?.[itemId],
  });
}

function YesNoRow({
  item,
  templateKey,
  originalNotes,
  onSetState,
  onRename,
  onDelete,
  measurementsInput,
  onItemQuantityChange,
  onBatchItemQuantityChange,
  onClearSuggestedPrefill,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  onApplySuggestedPricingRows,
  onClearAcceptedPricing,
  onScopeGapResolutionsChange,
  onScopeGapPriceSeparately,
  onScopeGapIncludeInParentPrice,
  onRevertCalculatedQuantity,
  pricingEditorRequest,
  onPricingEditorRequestHandled,
  onSaveCustomPricing,
  onBathroomToiletRelocateFloorTypeChange,
  onBathroomShowerRoughWorkTypeChange,
  onBathroomShowerRoughFixtureTypeChange,
  onBathroomShowerRoughPlumbingExposedChange,
  onBathroomShowerRoughFloorConstructionChange,
  onBathroomShowerRoughSlabWorkRequiredChange,
  onBathroomPaintRepairScopeChange,
  onBathroomDrywallPaintCombinedAssemblyChange,
  onBathroomInteriorPaintMobilizationChange,
  onBathroomInteriorPaintSurfaceChange,
  onBathroomInteriorPaintConditionChange,
  onBathroomGlassDoorStyleChange,
  scopeChecklistItems,
  suppressSuggestedPricing = false,
  visualCtx,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  templateKey?: string | null;
  originalNotes?: string | null;
  onSetState: (state: ScopeAssumptionState) => void;
  onRename?: (label: string) => void;
  onDelete?: () => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string,
    source?: QuantitySource,
    calculatedRevertFrom?: CalculatedQuantityRevertSnapshot
  ) => void;
  onBatchItemQuantityChange: (
    updates: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onClearSuggestedPrefill?: (
    itemId: string,
    pendingUpdates?: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (
    itemId: string,
    block: SuggestedPricingBlock
  ) => void;
  onApplySuggestedPricingRows?: (rows: SuggestedPricingApplyRow[]) => void;
  onClearAcceptedPricing?: (itemId: string) => void;
  onScopeGapResolutionsChange?: (next: ScopeGapResolutionsMap) => void;
  onScopeGapPriceSeparately?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onScopeGapIncludeInParentPrice?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    addonAmount: number,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onRevertCalculatedQuantity?: (itemId: string) => void;
  pricingEditorRequest?: { itemId: string; token: number } | null;
  onPricingEditorRequestHandled?: () => void;
  onSaveCustomPricing?: () => void;
  onBathroomToiletRelocateFloorTypeChange?: (
    floorType: BathroomToiletRelocateFloorType | null
  ) => void;
  onBathroomShowerRoughWorkTypeChange?: (
    workType: BathroomShowerRoughWorkType | null
  ) => void;
  onBathroomShowerRoughFixtureTypeChange?: (
    fixtureType: BathroomShowerRoughFixtureType | null
  ) => void;
  onBathroomShowerRoughPlumbingExposedChange?: (
    plumbingExposed: BathroomShowerRoughPlumbingExposed | null
  ) => void;
  onBathroomShowerRoughFloorConstructionChange?: (
    floorConstruction: BathroomShowerRoughFloorConstruction | null
  ) => void;
  onBathroomShowerRoughSlabWorkRequiredChange?: (
    slabWorkRequired: BathroomShowerRoughSlabWorkRequired | null
  ) => void;
  onBathroomPaintRepairScopeChange?: (
    scope: BathroomPaintRepairScope | null
  ) => void;
  onBathroomDrywallPaintCombinedAssemblyChange?: (
    useCombined: boolean | null
  ) => void;
  onBathroomInteriorPaintMobilizationChange?: (
    mobilization: BathroomInteriorPaintMobilization | null
  ) => void;
  onBathroomInteriorPaintSurfaceChange?: (
    surface: BathroomInteriorPaintSurface | null
  ) => void;
  onBathroomInteriorPaintConditionChange?: (
    condition: BathroomInteriorPaintCondition | null
  ) => void;
  onBathroomGlassDoorStyleChange?: (
    style: BathroomGlassDoorStyle | null
  ) => void;
  scopeChecklistItems?: ScopeChecklistItem[];
  suppressSuggestedPricing?: boolean;
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const tier = scopeItemVisualTier(item, visualCtx);
  const measuredSelection = scopeItemHasMeasuredSelection(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);
  const isCustom = isCustomScopeItem(item);
  const customPricingApplied =
    isCustom &&
    isCustomScopePricingApplied(item.id, measurementsInput.pricingAcceptance);
  let helper = isCustom
    ? 'Added manually. Enter material and labor; optional sqft, LF, or CY basis.'
    : checklistDisplayHelper(item, templateKey);
  if (
    !isCustom &&
    String(templateKey || '').toLowerCase() === 'flooring' &&
    item.id === 'floor_demo'
  ) {
    helper =
      'Removes the existing flooring and bulk setting material. Includes standard protection, haul-off, and disposal. Final grinding, patching, skim coating, and leveling are separate.';
  }
  if (
    !isCustom &&
    String(templateKey || '').toLowerCase() === 'flooring' &&
    item.id === 'floor_prep'
  ) {
    helper =
      'Prepares the exposed substrate after demolition. Includes only confirmed residual removal, grinding, patching, skim coating, or leveling required for the new flooring.';
  }
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(item.label);
  const [plumbingRoughPromptExpanded, setPlumbingRoughPromptExpanded] =
    useState(false);
  const [optimisticState, setOptimisticState] =
    useState<ScopeAssumptionState | null>(null);
  const optimisticStateRef = useRef<ScopeAssumptionState | null>(null);
  const onSetStateRef = useRef(onSetState);
  onSetStateRef.current = onSetState;
  const displayedState = optimisticState ?? item.state;
  useEffect(() => {
    if (
      optimisticStateRef.current != null &&
      item.state === optimisticStateRef.current
    ) {
      optimisticStateRef.current = null;
      setOptimisticState(null);
    }
  }, [item.state]);
  const handleLocalState = useCallback((state: ScopeAssumptionState) => {
    optimisticStateRef.current = state;
    setOptimisticState(state);
    setTimeout(() => onSetStateRef.current(state), 0);
  }, []);
  const showPlumbingRoughAccessPrompt =
    item.id === 'plumbing_rough' &&
    displayedState === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const plumbingRoughPriceApplied = Boolean(
    measurementsInput.pricingAcceptance?.plumbing_rough
  );
  const showPlumbingRoughQuestions =
    showPlumbingRoughAccessPrompt &&
    (!plumbingRoughPriceApplied || plumbingRoughPromptExpanded);
  const showPlumbingRoughCollapsedSummary =
    showPlumbingRoughAccessPrompt &&
    plumbingRoughPriceApplied &&
    !plumbingRoughPromptExpanded;
  const showerRoughCtx = buildShowerRoughPricingContext({
    fixtureType: measurementsInput.bathroomShowerRoughFixtureType,
    workType: measurementsInput.bathroomShowerRoughWorkType,
    plumbingExposed: measurementsInput.bathroomShowerRoughPlumbingExposed,
    plumbingExposedSource:
      measurementsInput.bathroomShowerRoughPlumbingExposedSource,
    floorConstruction: measurementsInput.bathroomShowerRoughFloorConstruction,
    slabWorkRequired: measurementsInput.bathroomShowerRoughSlabWorkRequired,
    wallAccess: measurementsInput.bathroomShowerRoughWallAccess,
    legacyAccessType:
      measurementsInput.bathroomShowerRoughAccessType ??
      measurementsInput.bathroomToiletRelocateFloorType,
    checklistItems: scopeChecklistItems,
  });
  const storedFixtureType =
    measurementsInput.bathroomShowerRoughFixtureType ?? null;
  const storedPlumbingWorkType =
    measurementsInput.bathroomShowerRoughWorkType ?? null;
  const storedPlumbingExposed =
    measurementsInput.bathroomShowerRoughPlumbingExposed ?? null;
  const storedPlumbingExposedSource =
    measurementsInput.bathroomShowerRoughPlumbingExposedSource ?? null;
  const storedFloorConstruction =
    measurementsInput.bathroomShowerRoughFloorConstruction ?? null;
  const storedSlabWork =
    measurementsInput.bathroomShowerRoughSlabWorkRequired ?? null;
  const showSlabWorkPrompt =
    shouldShowShowerRoughSlabWorkPrompt(showerRoughCtx);
  const relocateOverlap = detectShowerRoughScopeOverlap({
    checklistItems: scopeChecklistItems,
    workType: storedPlumbingWorkType,
  });
  const accessOverlap = detectShowerRoughAccessOverlap({
    checklistItems: scopeChecklistItems,
    plumbingExposed: storedPlumbingExposed,
  });
  const showConditionSummary =
    storedFixtureType ||
    storedPlumbingWorkType ||
    storedPlumbingExposed ||
    storedFloorConstruction;

  const showDrywallPaintOptions =
    item.id === 'paint_repair' &&
    displayedState === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const storedPaintRepairScope =
    measurementsInput.bathroomPaintRepairScope ?? null;
  const resolvedPaintRepairScope = resolveBathroomPaintRepairScope(
    storedPaintRepairScope
  );
  const storedPaintEntireRoom =
    resolvedPaintRepairScope === 'full_room' ||
    resolvePaintRepairEntireRoom({
      entireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
      legacyScope: storedPaintRepairScope,
    });
  const paintRepairScopeSelectionComplete = hasPaintRepairScopeSelection({
    localizedScope: storedPaintRepairScope,
    entireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
    legacyScope: storedPaintRepairScope,
    scopeSource: measurementsInput.bathroomPaintRepairScopeSource,
  });
  const combinedEligible =
    resolvedPaintRepairScope === 'affected_area' || !resolvedPaintRepairScope;
  const useCombinedAssembly =
    combinedEligible &&
    measurementsInput.bathroomDrywallPaintUseCombinedAssembly !== false;
  const userPaintRepairSqft = Number(
    String(
      measurementsInput.itemQuantities?.paint_repair?.quantity ?? ''
    ).replace(/,/g, '')
  );
  const entireRoomPaintSqft =
    resolvedPaintRepairScope === 'full_room' && userPaintRepairSqft > 0
      ? userPaintRepairSqft
      : 0;
  const patchRepairSqft =
    resolvedPaintRepairScope === 'affected_area' && userPaintRepairSqft > 0
      ? userPaintRepairSqft
      : 0;
  const combinedSummary = showDrywallPaintOptions
    ? buildBathroomDrywallPaintCombinedSummary({
        checklistItems: scopeChecklistItems,
        showerWallTileSqft:
          Number(measurementsInput.showerWallTileSqft) || null,
        paintRepairScope: storedPaintRepairScope,
        enteredPatchSqft: patchRepairSqft > 0 ? patchRepairSqft : null,
      })
    : null;
  const interiorPaintOverlap = detectDrywallPaintInteriorOverlap({
    checklistItems: scopeChecklistItems,
    paintRepairScope: storedPaintRepairScope,
    paintRepairEntireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
  });
  const combinedAssemblyOverlap = detectDrywallPaintCombinedOverlap({
    checklistItems: scopeChecklistItems,
    useCombinedAssembly,
  });
  const showPaintRepairScopePrompt =
    item.id === 'paint_repair' &&
    displayedState === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const showDrywallPatchSqftHint =
    showPaintRepairScopePrompt &&
    resolvedPaintRepairScope === 'affected_area' &&
    !(Number.isFinite(patchRepairSqft) && patchRepairSqft > 0);
  const showFullRoomPaintSqftHint =
    showPaintRepairScopePrompt &&
    resolvedPaintRepairScope === 'full_room' &&
    !(Number.isFinite(entireRoomPaintSqft) && entireRoomPaintSqft > 0);
  const paintRepairScopeApplied = Boolean(
    measurementsInput.pricingAcceptance?.paint_repair
  );
  const [paintRepairPromptExpanded, setPaintRepairPromptExpanded] =
    useState(false);
  const showPaintRepairQuestions =
    showPaintRepairScopePrompt &&
    (!paintRepairScopeApplied || paintRepairPromptExpanded);
  const showPaintRepairCollapsed =
    showPaintRepairScopePrompt &&
    paintRepairScopeApplied &&
    !paintRepairPromptExpanded;
  const paintInteriorOverlapOnCard = detectDrywallPaintInteriorOverlap({
    checklistItems: scopeChecklistItems,
    paintRepairScope: storedPaintRepairScope,
    paintRepairEntireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
  });
  const separateDrywallPatchFill = useMemo(() => {
    if (
      !showPaintRepairScopePrompt ||
      useCombinedAssembly ||
      resolvedPaintRepairScope === 'full_room'
    ) {
      return null;
    }
    if (!(patchRepairSqft > 0)) return null;
    if (measurementsInput.pricingAcceptance?.drywall) return null;
    return (
      resolveBathroomDrywallPatchSuggestedPricing({
        checklistItems: scopeChecklistItems,
        quantity: patchRepairSqft,
        showerWallTileSqft:
          Number(measurementsInput.showerWallTileSqft) || null,
        useCombinedAssembly: false,
        paintRepairScope: storedPaintRepairScope,
      })?.fill ?? null
    );
  }, [
    showPaintRepairScopePrompt,
    useCombinedAssembly,
    patchRepairSqft,
    measurementsInput.pricingAcceptance?.drywall,
    measurementsInput.showerWallTileSqft,
    scopeChecklistItems,
    storedPaintRepairScope,
  ]);

  const separateLinesPaintFill = useMemo(() => {
    if (!showPaintRepairScopePrompt || useCombinedAssembly) return null;
    if (measurementsInput.pricingAcceptance?.paint_repair) return null;
    const isFullRoom = resolvedPaintRepairScope === 'full_room';
    const isAffectedArea = resolvedPaintRepairScope === 'affected_area';
    if (!isFullRoom && !isAffectedArea) return null;
    if (isAffectedArea && !(patchRepairSqft > 0)) return null;
    if (isFullRoom && !(entireRoomPaintSqft > 0)) return null;
    return (
      resolveBathroomPaintRepairSuggestedPricing({
        checklistItems: scopeChecklistItems,
        patchSqft: patchRepairSqft > 0 ? patchRepairSqft : null,
        showerWallTileSqft:
          Number(measurementsInput.showerWallTileSqft) || null,
        paintRepairScope: storedPaintRepairScope,
        paintRepairEntireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
        entireRoomSqft: entireRoomPaintSqft > 0 ? entireRoomPaintSqft : null,
        interiorPaintMobilization:
          measurementsInput.bathroomInteriorPaintMobilization,
        interiorPaintSurface: measurementsInput.bathroomInteriorPaintSurface,
        interiorPaintCondition:
          measurementsInput.bathroomInteriorPaintCondition,
        useCombinedAssembly: false,
      })?.fill ?? null
    );
  }, [
    showPaintRepairScopePrompt,
    useCombinedAssembly,
    patchRepairSqft,
    entireRoomPaintSqft,
    resolvedPaintRepairScope,
    storedPaintEntireRoom,
    measurementsInput.pricingAcceptance?.paint_repair,
    measurementsInput.showerWallTileSqft,
    measurementsInput.bathroomPaintRepairEntireRoom,
    measurementsInput.bathroomInteriorPaintMobilization,
    measurementsInput.bathroomInteriorPaintSurface,
    measurementsInput.bathroomInteriorPaintCondition,
    scopeChecklistItems,
    storedPaintRepairScope,
  ]);

  const separateLinesMergedBlock = useMemo(() => {
    if (!separateLinesPaintFill) return null;
    if (resolvedPaintRepairScope === 'full_room') return separateLinesPaintFill;
    return buildBathroomSeparateDrywallPaintSuggestedBlock({
      drywall: separateDrywallPatchFill,
      paint: separateLinesPaintFill,
      patchSqft: patchRepairSqft > 0 ? patchRepairSqft : entireRoomPaintSqft,
    });
  }, [
    separateDrywallPatchFill,
    separateLinesPaintFill,
    patchRepairSqft,
    entireRoomPaintSqft,
    resolvedPaintRepairScope,
  ]);

  const paintRepairBundledPricing = Boolean(separateLinesMergedBlock);

  useEffect(() => {
    if (!paintRepairScopeApplied) setPaintRepairPromptExpanded(false);
  }, [paintRepairScopeApplied]);

  const showInteriorPaintScopePrompt =
    (item.id === 'interior_paint' || item.id === 'paint') &&
    displayedState === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const interiorPaintScopeApplied = Boolean(
    measurementsInput.pricingAcceptance?.interior_paint ||
    measurementsInput.pricingAcceptance?.paint
  );
  const [interiorPaintPromptExpanded, setInteriorPaintPromptExpanded] =
    useState(false);
  const showInteriorPaintQuestions =
    showInteriorPaintScopePrompt &&
    (!interiorPaintScopeApplied || interiorPaintPromptExpanded);
  const showInteriorPaintCollapsed =
    showInteriorPaintScopePrompt &&
    interiorPaintScopeApplied &&
    !interiorPaintPromptExpanded;
  const storedInteriorMobilization = resolveInteriorPaintMobilization(
    measurementsInput.bathroomInteriorPaintMobilization
  );
  const storedInteriorSurface = resolveInteriorPaintSurface(
    measurementsInput.bathroomInteriorPaintSurface
  );
  const storedInteriorCondition = resolveInteriorPaintCondition(
    measurementsInput.bathroomInteriorPaintCondition
  );
  const interiorPaintRepairOverlap = detectInteriorPaintRepairOverlap({
    checklistItems: scopeChecklistItems,
    paintRepairScope: storedPaintRepairScope,
    paintRepairEntireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
  });

  useEffect(() => {
    if (!interiorPaintScopeApplied) setInteriorPaintPromptExpanded(false);
  }, [interiorPaintScopeApplied]);

  const showGlassDoorStylePrompt =
    item.id === 'glass_door' &&
    displayedState === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const glassDoorStyleApplied = Boolean(
    measurementsInput.pricingAcceptance?.glass_door
  );
  const [glassDoorPromptExpanded, setGlassDoorPromptExpanded] = useState(false);
  const showGlassDoorQuestions =
    showGlassDoorStylePrompt &&
    (!glassDoorStyleApplied || glassDoorPromptExpanded);
  const showGlassDoorCollapsed =
    showGlassDoorStylePrompt &&
    glassDoorStyleApplied &&
    !glassDoorPromptExpanded;
  const storedGlassDoorStyle = resolveBathroomGlassDoorStyle(
    measurementsInput.bathroomGlassDoorStyle
  );

  useEffect(() => {
    if (!glassDoorStyleApplied) setGlassDoorPromptExpanded(false);
  }, [glassDoorStyleApplied]);

  useEffect(() => {
    setDraftLabel(item.label);
  }, [item.label]);

  useEffect(() => {
    if (!plumbingRoughPriceApplied) {
      setPlumbingRoughPromptExpanded(false);
    }
  }, [plumbingRoughPriceApplied]);

  const saveRename = () => {
    const trimmed = draftLabel.trim();
    if (!trimmed) return;
    onRename?.(trimmed);
    setRenaming(false);
  };

  return (
    <View
      style={scopeCardStyle(tier, item, Colors, darkMode, measuredSelection)}
    >
      {isCustom && renaming ? (
        <View style={styles.customRenameRow}>
          <TextInput
            value={draftLabel}
            onChangeText={setDraftLabel}
            autoFocus
            onSubmitEditing={saveRename}
            placeholder='Scope item name'
            placeholderTextColor={
              darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'
            }
            style={[
              styles.customRenameInput,
              {
                color: Colors.text,
                borderColor: darkMode
                  ? 'rgba(148, 163, 184, 0.16)'
                  : Colors.line,
                backgroundColor: darkMode
                  ? 'rgba(255,255,255,0.05)'
                  : Colors.surface2,
              },
            ]}
            {...resolveTextInputKeyboardProps()}
          />
          <TouchableOpacity
            onPress={saveRename}
            activeOpacity={0.75}
            style={styles.customRenameAction}
          >
            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '800' }}>
              Save
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScopeItemTitleRow
          label={checklistDisplayLabel(item, templateKey)}
          noteBadge={noteBadge}
          rightAccessory={
            isCustom ? (
              <View style={styles.customCardActions}>
                <View
                  style={[
                    styles.customBadge,
                    darkMode ? styles.customBadgeDark : styles.customBadgeLight,
                  ]}
                >
                  <Text
                    style={{
                      color: '#60a5fa',
                      fontSize: 10,
                      fontWeight: '700',
                    }}
                  >
                    Custom
                  </Text>
                </View>
                {!customPricingApplied ? (
                  <TouchableOpacity
                    onPress={() => setRenaming(true)}
                    disabled={applying}
                    activeOpacity={0.75}
                    style={styles.customIconBtn}
                  >
                    <Ionicons name='pencil-outline' size={15} color='#60a5fa' />
                  </TouchableOpacity>
                ) : null}
                {onDelete ? (
                  <TouchableOpacity
                    onPress={onDelete}
                    disabled={applying}
                    activeOpacity={0.75}
                    style={styles.customIconBtn}
                  >
                    <Ionicons name='trash-outline' size={15} color='#ef4444' />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null
          }
          darkMode={darkMode}
          Colors={Colors}
        />
      )}
      {helper ? (
        <Text
          style={[
            styles.scopeCardDescription,
            { color: captionColor(darkMode, Colors) },
          ]}
        >
          {helper}
        </Text>
      ) : null}
      <View style={styles.choiceRow}>
        <YesNoChip
          label='Yes'
          active={displayedState === 'included'}
          variant='yes'
          onPress={() => {
            hapticTap();
            handleLocalState('included');
          }}
          Colors={Colors}
          darkMode={darkMode}
        />
        <YesNoChip
          label='No'
          active={displayedState === 'excluded'}
          variant='no'
          onPress={() => {
            hapticTap();
            handleLocalState('excluded');
          }}
          Colors={Colors}
          darkMode={darkMode}
        />
        {!isCustom ? (
          <YesNoChip
            label='Not sure'
            active={displayedState === 'unsure'}
            variant='unsure'
            onPress={() => {
              hapticTap();
              handleLocalState('unsure');
            }}
            Colors={Colors}
            darkMode={darkMode}
          />
        ) : null}
      </View>
      {showPlumbingRoughCollapsedSummary ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            hapticTap();
            setPlumbingRoughPromptExpanded(true);
          }}
          style={{ marginTop: 10 }}
          accessibilityRole='button'
          accessibilityLabel='Edit shower rough-in conditions'
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
          >
            <Text
              style={{
                flex: 1,
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {formatShowerRoughConditionSummary(showerRoughCtx)}
            </Text>
            <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>
              Edit
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
      {showPlumbingRoughQuestions ? (
        <View style={{ marginTop: 10 }}>
          {plumbingRoughPriceApplied ? (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                hapticTap();
                setPlumbingRoughPromptExpanded(false);
              }}
              style={{ alignSelf: 'flex-start', marginBottom: 8 }}
              accessibilityRole='button'
              accessibilityLabel='Done editing shower rough-in conditions'
            >
              <Text
                style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}
              >
                Done
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            What fixture is being roughed in?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_SHOWER_ROUGH_FIXTURE_OPTIONS.map(opt => {
              const active = storedFixtureType === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomShowerRoughFixtureTypeChange?.(
                      storedFixtureType === opt.id ? null : opt.id
                    );
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginTop: 12,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            Is the plumbing staying in the same location?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_SHOWER_ROUGH_WORK_TYPE_OPTIONS.map(opt => {
              const active = storedPlumbingWorkType === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomShowerRoughWorkTypeChange?.(
                      storedPlumbingWorkType === opt.id ? null : opt.id
                    );
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginTop: 12,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            Will remodel demolition expose the plumbing?
          </Text>
          {storedPlumbingExposedSource === 'demo_detected' &&
          storedPlumbingExposed === 'exposed_by_demo' ? (
            <Text
              style={{
                color: '#60a5fa',
                fontSize: 10,
                marginBottom: 8,
                lineHeight: 14,
                fontWeight: '600',
              }}
            >
              {SHOWER_ROUGH_DEMO_DETECTED_LABEL}
            </Text>
          ) : (
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 10,
                marginBottom: 8,
                lineHeight: 14,
              }}
            >
              On most shower remodels, demo removes tile and opens the wall —
              pick Yes unless the plumber must create separate access elsewhere.
            </Text>
          )}
          <View style={styles.choiceWrap}>
            {BATHROOM_SHOWER_ROUGH_PLUMBING_EXPOSED_OPTIONS.map(opt => {
              const active = storedPlumbingExposed === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomShowerRoughPlumbingExposedChange?.(
                      storedPlumbingExposed === opt.id ? null : opt.id
                    );
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginTop: 12,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            What is the floor construction?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_SHOWER_ROUGH_FLOOR_OPTIONS.map(opt => {
              const active = storedFloorConstruction === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomShowerRoughFloorConstructionChange?.(
                      storedFloorConstruction === opt.id ? null : opt.id
                    );
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {showSlabWorkPrompt ? (
            <>
              <Text
                style={{
                  color: captionColor(darkMode, Colors),
                  fontSize: 11,
                  marginTop: 12,
                  marginBottom: 8,
                  lineHeight: 15,
                }}
              >
                Is concrete cutting or below-slab drain modification required?
              </Text>
              <View style={styles.choiceRow}>
                {BATHROOM_SHOWER_ROUGH_SLAB_WORK_OPTIONS.map(opt => {
                  const active = storedSlabWork === opt.id;
                  return (
                    <YesNoChip
                      key={opt.id}
                      label={opt.label}
                      active={active}
                      variant={
                        opt.id === 'yes'
                          ? 'yes'
                          : opt.id === 'no'
                            ? 'no'
                            : 'unsure'
                      }
                      onPress={() => {
                        hapticTap();
                        onBathroomShowerRoughSlabWorkRequiredChange?.(
                          storedSlabWork === opt.id ? null : opt.id
                        );
                      }}
                      Colors={Colors}
                      darkMode={darkMode}
                    />
                  );
                })}
              </View>
            </>
          ) : null}

          {showConditionSummary ? (
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                marginTop: 12,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {formatShowerRoughConditionSummary(showerRoughCtx)}
            </Text>
          ) : null}

          {accessOverlap ? (
            <Text
              style={{
                color: '#fbbf24',
                fontSize: 11,
                marginTop: 12,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {SHOWER_ROUGH_ACCESS_OVERLAP_WARNING}
            </Text>
          ) : null}

          {relocateOverlap.overlap ? (
            <Text
              style={{
                color: '#fbbf24',
                fontSize: 11,
                marginTop: 12,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {SHOWER_ROUGH_OVERLAP_WARNING}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showDrywallPatchSqftHint ? (
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            marginTop: 10,
            lineHeight: 16,
          }}
        >
          {formatBathroomDrywallPatchSqftHint({
            showerWallTileSqft:
              Number(measurementsInput.showerWallTileSqft) || null,
          })}
        </Text>
      ) : null}

      {showFullRoomPaintSqftHint ? (
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            marginTop: 10,
            lineHeight: 16,
          }}
        >
          {formatBathroomFullRoomPaintSqftHint({
            wallPaintSqft: measurementsInput.wallPaintSqft,
            bathroomFloorSqft: measurementsInput.bathroomFloorSqft,
          })}
        </Text>
      ) : null}

      {showDrywallPaintOptions && combinedEligible ? (
        <View style={{ marginTop: 10 }}>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            Use one combined repair assembly?
          </Text>
          <View style={styles.assemblyChoiceRow}>
            <AssemblyChoiceChip
              label={'Combined patch,\ntexture, prime & paint'}
              active={useCombinedAssembly}
              variant='yes'
              onPress={() => {
                hapticTap();
                onBathroomDrywallPaintCombinedAssemblyChange?.(
                  useCombinedAssembly ? null : true
                );
              }}
              Colors={Colors}
              darkMode={darkMode}
            />
            <AssemblyChoiceChip
              label='Separate lines'
              active={!useCombinedAssembly}
              variant='no'
              onPress={() => {
                hapticTap();
                onBathroomDrywallPaintCombinedAssemblyChange?.(false);
              }}
              Colors={Colors}
              darkMode={darkMode}
            />
          </View>
          {combinedSummary && !useCombinedAssembly ? (
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                marginTop: 10,
                lineHeight: 16,
              }}
            >
              {`Combined planning allowance: $${combinedSummary.drywallTotal.toLocaleString()} drywall + $${combinedSummary.paintTotal.toLocaleString()} paint = $${combinedSummary.combinedTotal.toLocaleString()} (range $${combinedSummary.range.low.toLocaleString()}–$${combinedSummary.range.high.toLocaleString()}). ${DRYWALL_PAINT_COMBINED_SUMMARY_LABEL}`}
            </Text>
          ) : null}
          {combinedAssemblyOverlap ? (
            <Text
              style={{
                color: '#fbbf24',
                fontSize: 11,
                marginTop: 10,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {DRYWALL_PAINT_COMBINED_OVERLAP_WARNING}
            </Text>
          ) : null}
          {interiorPaintOverlap ? (
            <Text
              style={{
                color: '#fbbf24',
                fontSize: 11,
                marginTop: 10,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {DRYWALL_PAINT_INTERIOR_OVERLAP_WARNING}
            </Text>
          ) : null}
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 10,
              marginTop: 8,
              lineHeight: 14,
            }}
          >
            {DRYWALL_PAINT_WET_AREA_NOTE}
          </Text>
        </View>
      ) : null}

      {showPaintRepairCollapsed ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            hapticTap();
            setPaintRepairPromptExpanded(true);
          }}
          style={{ marginTop: 10 }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
          >
            <Text
              style={{
                flex: 1,
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {formatPaintRepairScopeSummary({
                localizedScope: storedPaintRepairScope,
                entireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
                legacyScope: storedPaintRepairScope,
              })}
            </Text>
            <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>
              Edit
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {showPaintRepairQuestions ? (
        <View style={{ marginTop: 10 }}>
          {paintRepairScopeApplied ? (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                hapticTap();
                setPaintRepairPromptExpanded(false);
              }}
              style={{ alignSelf: 'flex-start', marginBottom: 8 }}
            >
              <Text
                style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}
              >
                Done
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            What painting is required after the drywall repair?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_PAINT_REPAIR_SCOPE_OPTIONS.map(opt => {
              const active = resolvedPaintRepairScope === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomPaintRepairScopeChange?.(active ? null : opt.id);
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {resolvedPaintRepairScope === 'full_room' ? (
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                marginTop: 10,
                lineHeight: 15,
              }}
            >
              {PAINT_REPAIR_FULL_ROOM_NOTE}
            </Text>
          ) : null}
          {paintInteriorOverlapOnCard ? (
            <Text
              style={{
                color: '#fbbf24',
                fontSize: 11,
                marginTop: 10,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {DRYWALL_PAINT_INTERIOR_OVERLAP_WARNING}
            </Text>
          ) : null}
        </View>
      ) : null}

      {separateLinesMergedBlock && separateLinesPaintFill ? (
        <View style={{ marginTop: 10 }}>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginBottom: 6,
              lineHeight: 15,
            }}
          >
            {resolvedPaintRepairScope === 'full_room'
              ? 'Full-room paint — patch included'
              : separateDrywallPatchFill
                ? 'Separate lines — patch/texture + paint'
                : 'Paint — affected area'}
          </Text>
          <SuggestedBudgetSplitRows
            block={separateLinesMergedBlock}
            Colors={Colors}
            darkMode={darkMode}
            onUsePricing={() =>
              onApplySuggestedPricingRows?.([
                ...(separateDrywallPatchFill
                  ? [{ itemId: 'drywall', block: separateDrywallPatchFill }]
                  : []),
                { itemId: 'paint_repair', block: separateLinesPaintFill },
              ])
            }
            itemId='paint_repair'
            quantitySource='user'
            hasPrimaryTakeoff
          />
        </View>
      ) : null}

      {showInteriorPaintCollapsed ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            hapticTap();
            setInteriorPaintPromptExpanded(true);
          }}
          style={{ marginTop: 10 }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
          >
            <Text
              style={{
                flex: 1,
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {[
                BATHROOM_INTERIOR_PAINT_MOBILIZATION_OPTIONS.find(
                  opt => opt.id === storedInteriorMobilization
                )?.label,
                BATHROOM_INTERIOR_PAINT_SURFACE_OPTIONS.find(
                  opt => opt.id === storedInteriorSurface
                )?.label,
                BATHROOM_INTERIOR_PAINT_CONDITION_OPTIONS.find(
                  opt => opt.id === storedInteriorCondition
                )?.label,
              ]
                .filter(Boolean)
                .join(' · ') || 'Interior paint scope selected'}
            </Text>
            <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>
              Edit
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {showInteriorPaintQuestions ? (
        <View style={{ marginTop: 10 }}>
          {interiorPaintScopeApplied ? (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                hapticTap();
                setInteriorPaintPromptExpanded(false);
              }}
              style={{ alignSelf: 'flex-start', marginBottom: 8 }}
            >
              <Text
                style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}
              >
                Done
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            Is this area part of a larger painting scope?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_INTERIOR_PAINT_MOBILIZATION_OPTIONS.map(opt => {
              const active = storedInteriorMobilization === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomInteriorPaintMobilizationChange?.(
                      active ? null : opt.id
                    );
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginTop: 12,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            What surface is being painted?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_INTERIOR_PAINT_SURFACE_OPTIONS.map(opt => {
              const active = storedInteriorSurface === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomInteriorPaintSurfaceChange?.(
                      active ? null : opt.id
                    );
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginTop: 12,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            What is the painting condition?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_INTERIOR_PAINT_CONDITION_OPTIONS.map(opt => {
              const active = storedInteriorCondition === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomInteriorPaintConditionChange?.(
                      active ? null : opt.id
                    );
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {interiorPaintRepairOverlap ? (
            <Text
              style={{
                color: '#fbbf24',
                fontSize: 11,
                marginTop: 10,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {DRYWALL_PAINT_INTERIOR_OVERLAP_WARNING}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showGlassDoorCollapsed ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            hapticTap();
            setGlassDoorPromptExpanded(true);
          }}
          style={{ marginTop: 10 }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
          >
            <Text
              style={{
                flex: 1,
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                lineHeight: 16,
                fontWeight: '600',
              }}
            >
              {BATHROOM_GLASS_DOOR_STYLE_OPTIONS.find(
                opt => opt.id === storedGlassDoorStyle
              )?.label || 'Shower door style selected'}
            </Text>
            <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>
              Edit
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {showGlassDoorQuestions ? (
        <View style={{ marginTop: 10 }}>
          {glassDoorStyleApplied ? (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                hapticTap();
                setGlassDoorPromptExpanded(false);
              }}
              style={{ alignSelf: 'flex-start', marginBottom: 8 }}
            >
              <Text
                style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}
              >
                Done
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            What type of shower door?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_GLASS_DOOR_STYLE_OPTIONS.map(opt => {
              const active = storedGlassDoorStyle === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomGlassDoorStyleChange?.(active ? null : opt.id);
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 10,
              marginTop: 8,
              lineHeight: 14,
            }}
          >
            {GLASS_DOOR_DOOR_ONLY_NOTE}
          </Text>
        </View>
      ) : null}
      {isCustom ? (
        <CustomScopePricingSection
          itemId={item.id}
          itemLabel={item.label}
          templateKey={templateKey}
          inScope={displayedState === 'included'}
          measurementsInput={measurementsInput}
          onItemQuantityChange={onItemQuantityChange}
          onItemQuantityBlur={onItemQuantityBlur}
          onItemQuantityFocus={onItemQuantityFocus}
          onSavePricing={onSaveCustomPricing}
          onClearAcceptedPricing={
            onClearAcceptedPricing
              ? () => onClearAcceptedPricing(item.id)
              : undefined
          }
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      ) : (
        <QuantitySection
          itemId={item.id}
          choiceId={item.choiceId}
          inScope={displayedState === 'included'}
          templateKey={templateKey}
          originalNotes={originalNotes}
          hideInlineTakeoff={Boolean(plumbingCardForItemId(item.id))}
          measurementsInput={measurementsInput}
          onItemQuantityChange={onItemQuantityChange}
          onBatchItemQuantityChange={onBatchItemQuantityChange}
          onClearSuggestedPrefill={onClearSuggestedPrefill}
          onItemQuantityBlur={onItemQuantityBlur}
          onItemQuantityFocus={onItemQuantityFocus}
          onApplySuggestedPricing={onApplySuggestedPricing}
          onApplySuggestedPricingRows={onApplySuggestedPricingRows}
          onClearAcceptedPricing={onClearAcceptedPricing}
          onScopeGapResolutionsChange={onScopeGapResolutionsChange}
          onScopeGapPriceSeparately={onScopeGapPriceSeparately}
          onScopeGapIncludeInParentPrice={onScopeGapIncludeInParentPrice}
          onRevertCalculatedQuantity={onRevertCalculatedQuantity}
          pricingEditorRequest={pricingEditorRequest}
          onPricingEditorRequestHandled={onPricingEditorRequestHandled}
          suppressSuggestedPricing={
            paintRepairBundledPricing || suppressSuggestedPricing
          }
          scopeItemLabel={checklistDisplayLabel(item, templateKey)}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      )}
    </View>
  );
}

type YesNoRowProps = React.ComponentProps<typeof YesNoRow>;

function areYesNoRowPropsEqual(
  previous: YesNoRowProps,
  next: YesNoRowProps
): boolean {
  return (
    previous.item === next.item &&
    previous.templateKey === next.templateKey &&
    previous.originalNotes === next.originalNotes &&
    previous.suppressSuggestedPricing === next.suppressSuggestedPricing &&
    previous.darkMode === next.darkMode &&
    previous.applying === next.applying &&
    previous.pricingEditorRequest?.itemId ===
      next.pricingEditorRequest?.itemId &&
    previous.pricingEditorRequest?.token === next.pricingEditorRequest?.token &&
    scopeRowMeasurementSignature(
      previous.measurementsInput,
      previous.item.id,
      previous.templateKey
    ) ===
      scopeRowMeasurementSignature(
        next.measurementsInput,
        next.item.id,
        next.templateKey
      )
  );
}

const MemoizedYesNoRow = React.memo(YesNoRow, areYesNoRowPropsEqual);

function multiChoicePriceRows(
  itemId: string,
  choiceIds: string[],
  quantity: number,
  itemQuantities: ScopeMeasurementsInputExtended['itemQuantities']
): Array<{
  label: string;
  quantity: number;
  unitTotal: number;
  subtotal: number;
}> {
  const rates: Record<string, Record<string, number>> = {
    plumbing: {
      dishwasher_hookup: 275,
      gas_existing_shutoff: 225,
      gas_branch_line: 750,
      rough_in: 900,
    },
    electrical: {
      replace_outlet_switch: 85,
      replace_gfci: 125,
      add_relocate_outlet_gfci: 275,
      dedicated_120v: 750,
      dedicated_240v: 950,
    },
    lighting: {
      standard_existing_location: 325,
      decorative_existing_location: 475,
      new_recessed_led: 250,
      new_location_with_wiring: 650,
    },
    transitions: {
      standard_transition: 50,
      reducer: 65,
      threshold: 75,
      custom_transition: 100,
    },
  };
  const labels: Record<string, Record<string, string>> = {
    plumbing: {
      dishwasher_hookup: 'Dishwasher replacement',
      gas_existing_shutoff: 'Gas range connection',
      gas_branch_line: 'New gas branch line',
      rough_in: 'New plumbing rough-in',
    },
    electrical: {
      replace_outlet_switch: 'Replace outlet or switch',
      replace_gfci: 'Replace or install GFCI',
      add_relocate_outlet_gfci: 'Add or relocate outlet/GFCI',
      dedicated_120v: 'Dedicated 120V circuit',
      dedicated_240v: 'Dedicated 240V circuit',
    },
    lighting: {
      standard_existing_location: 'Standard fixture',
      decorative_existing_location: 'Decorative fixture/pendant',
      new_recessed_led: 'New recessed LED',
      new_location_with_wiring: 'New lighting location with wiring',
    },
    transitions: {
      standard_transition: 'Standard T-molding / transition',
      reducer: 'Reducer',
      threshold: 'Threshold / end cap',
      custom_transition: 'Custom / difficult transition',
    },
  };
  const itemRates = rates[itemId];
  if (!itemRates || !(quantity > 0)) return [];
  return choiceIds
    .filter(choiceId => itemRates[choiceId] != null)
    .map(choiceId => {
      const choiceQuantity = Number(
        itemQuantities?.[`${itemId}__${choiceId}`]?.quantity
      );
      const effectiveQuantity =
        Number.isFinite(choiceQuantity) && choiceQuantity > 0
          ? choiceQuantity
          : quantity;
      return {
        label: labels[itemId]?.[choiceId] || choiceId,
        quantity: effectiveQuantity,
        unitTotal: itemRates[choiceId],
        subtotal: effectiveQuantity * itemRates[choiceId],
      };
    });
}

function MultiChoiceRow({
  item,
  templateKey,
  originalNotes,
  onToggle,
  measurementsInput,
  onItemQuantityChange,
  onBatchItemQuantityChange,
  onClearSuggestedPrefill,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  onClearAcceptedPricing,
  onScopeGapResolutionsChange,
  onScopeGapPriceSeparately,
  onScopeGapIncludeInParentPrice,
  onRevertCalculatedQuantity,
  pricingEditorRequest,
  onPricingEditorRequestHandled,
  visualCtx,
  Colors,
  darkMode,
  applying,
}: {
  item: ScopeChecklistItem;
  templateKey?: string | null;
  originalNotes?: string | null;
  onToggle: (optionId: string) => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string,
    source?: QuantitySource,
    calculatedRevertFrom?: CalculatedQuantityRevertSnapshot
  ) => void;
  onBatchItemQuantityChange: (
    updates: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onClearSuggestedPrefill?: (
    itemId: string,
    pendingUpdates?: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (
    itemId: string,
    block: SuggestedPricingBlock
  ) => void;
  onClearAcceptedPricing?: (itemId: string) => void;
  onScopeGapResolutionsChange?: (next: ScopeGapResolutionsMap) => void;
  onScopeGapPriceSeparately?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onScopeGapIncludeInParentPrice?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    addonAmount: number,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onRevertCalculatedQuantity?: (itemId: string) => void;
  pricingEditorRequest?: { itemId: string; token: number } | null;
  onPricingEditorRequestHandled?: () => void;
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const choiceIds = item.choiceIds ?? (item.choiceId ? [item.choiceId] : []);
  const inScope = choiceIds.some(
    id => id !== 'not_in_scope' && id !== 'unsure'
  );
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const measuredSelection = scopeItemHasMeasuredSelection(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);
  const wallWorkChoiceIds = choiceIds.filter(
    id => id === 'remove' || id === 'add'
  );
  const selectedQuantity = Number(
    measurementsInput.itemQuantities[item.id]?.quantity
  );
  const choicePricingRows = multiChoicePriceRows(
    item.id,
    choiceIds,
    selectedQuantity,
    measurementsInput.itemQuantities
  );
  const countChoiceItem = [
    'plumbing',
    'electrical',
    'lighting',
    'transitions',
  ].includes(item.id);
  const perOptionCountItem = countChoiceItem;
  const countChoiceRateIds: Record<string, string[]> = {
    plumbing: [
      'dishwasher_hookup',
      'gas_existing_shutoff',
      'gas_branch_line',
      'rough_in',
    ],
    electrical: [
      'replace_outlet_switch',
      'replace_gfci',
      'add_relocate_outlet_gfci',
      'dedicated_120v',
      'dedicated_240v',
    ],
    lighting: [
      'standard_existing_location',
      'decorative_existing_location',
      'new_recessed_led',
      'new_location_with_wiring',
    ],
    transitions: [
      'standard_transition',
      'reducer',
      'threshold',
      'custom_transition',
    ],
  };

  return (
    <View
      style={scopeCardStyle(tier, item, Colors, darkMode, measuredSelection)}
    >
      <ScopeItemTitleRow
        label={checklistDisplayLabel(item, templateKey)}
        noteBadge={noteBadge}
        darkMode={darkMode}
        Colors={Colors}
      />
      {helper ? (
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            marginTop: 3,
            lineHeight: 15,
          }}
        >
          {helper}
        </Text>
      ) : null}
      <View style={styles.choiceWrap}>
        {(item.options || []).map(opt => {
          const active = choiceIds.includes(opt.id);
          const isUnsure = opt.id === 'unsure';
          const isExcluded = opt.id === 'not_in_scope';
          const inactiveStyle = inactiveChoiceChipStyle(darkMode, Colors);
          let borderColor = inactiveStyle.borderColor;
          let backgroundColor = inactiveStyle.backgroundColor;
          let textColor = inactiveStyle.textColor;

          if (active) {
            if (isUnsure) {
              borderColor = 'rgba(251,191,36,0.55)';
              textColor = '#d4a017';
            } else if (isExcluded) {
              borderColor = darkMode
                ? 'rgba(148, 163, 184, 0.28)'
                : Colors.line;
              backgroundColor = darkMode
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.04)';
              textColor = darkMode ? '#F5F7FA' : Colors.text;
            } else {
              borderColor = '#60a5fa';
              backgroundColor = 'rgba(96,165,250,0.18)';
              textColor = '#60a5fa';
            }
          }

          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.88}
              onPress={() => {
                hapticTap();
                onToggle(opt.id);
              }}
              style={[
                styles.choiceChipWide,
                item.id === 'stucco' ? styles.stuccoChoiceChip : null,
                { borderColor, backgroundColor },
              ]}
            >
              <Text
                style={[
                  {
                    color: textColor,
                    fontSize: 12,
                    fontWeight: active ? '800' : '600',
                    textAlign: 'center',
                  },
                  item.id === 'stucco' ? styles.stuccoChoiceLabel : null,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {perOptionCountItem && inScope ? (
        choiceIds
          .filter(choiceId => countChoiceRateIds[item.id]?.includes(choiceId))
          .map(choiceId => {
            const label =
              item.options?.find(option => option.id === choiceId)?.label ||
              choiceId;
            const quantityKey = `${item.id}__${choiceId}`;
            return (
              <View key={quantityKey} style={{ marginTop: 10 }}>
                <PricingInputField
                  label={`${label} · count`}
                  value={
                    measurementsInput.itemQuantities[quantityKey]?.quantity ??
                    '1'
                  }
                  suffix='each'
                  embedded
                  commitOnBlur
                  onFocus={() => onItemQuantityFocus(quantityKey, 'count')}
                  onChangeText={text =>
                    onItemQuantityChange(quantityKey, text, 'count', 'each')
                  }
                  onBlur={() => onItemQuantityBlur(quantityKey, 'count')}
                  Colors={Colors}
                  darkMode={darkMode}
                  applying={applying}
                />
              </View>
            );
          })
      ) : countChoiceItem && inScope ? (
        <View style={{ marginTop: 10 }}>
          <PricingInputField
            label='Count'
            value={
              measurementsInput.itemQuantities[item.id]?.quantity ||
              (selectedQuantity > 0 ? String(selectedQuantity) : '1')
            }
            suffix='each'
            embedded
            commitOnBlur
            onFocus={() => onItemQuantityFocus(item.id, 'count')}
            onChangeText={text =>
              onItemQuantityChange(item.id, text, 'count', 'each')
            }
            onBlur={() => onItemQuantityBlur(item.id, 'count')}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        </View>
      ) : null}
      {choicePricingRows.length ? (
        <View
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            backgroundColor: darkMode
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
          }}
        >
          <Text
            style={{
              color: Colors.text,
              fontSize: 12,
              fontWeight: '800',
              marginBottom: 6,
            }}
          >
            Selected work pricing
          </Text>
          {choicePricingRows.map(row => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <Text
                style={{ color: captionColor(darkMode, Colors), fontSize: 12 }}
              >
                {row.label} · {row.quantity} each
              </Text>
              <Text
                style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}
              >
                ${row.subtotal.toLocaleString()}
              </Text>
            </View>
          ))}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line,
              marginTop: 4,
              paddingTop: 6,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{ color: Colors.text, fontSize: 12, fontWeight: '800' }}
            >
              Selected work total
            </Text>
            <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '800' }}>
              $
              {choicePricingRows
                .reduce((sum, row) => sum + row.subtotal, 0)
                .toLocaleString()}
            </Text>
          </View>
        </View>
      ) : null}
      {item.id === 'walls_moving' ? (
        <>
          {wallWorkChoiceIds.map(wallChoiceId => {
            const label =
              item.options?.find(option => option.id === wallChoiceId)?.label ||
              wallChoiceId;
            const quantityKey = `${item.id}__${wallChoiceId}`;
            return (
              <View key={quantityKey} style={{ marginTop: 10 }}>
                <PricingInputField
                  label={`${label} · linear feet`}
                  value={
                    measurementsInput.itemQuantities[quantityKey]?.quantity ??
                    ''
                  }
                  suffix='LF'
                  embedded
                  commitOnBlur
                  onFocus={() => onItemQuantityFocus(quantityKey, 'count')}
                  onChangeText={text =>
                    onItemQuantityChange(quantityKey, text, 'count', 'lf')
                  }
                  onBlur={() => onItemQuantityBlur(quantityKey, 'count')}
                  Colors={Colors}
                  darkMode={darkMode}
                  applying={applying}
                />
              </View>
            );
          })}
          <QuantitySection
            itemId={item.id}
            choiceId={choiceIds.join(',')}
            inScope={inScope}
            templateKey={templateKey}
            originalNotes={originalNotes}
            measurementsInput={measurementsInput}
            onItemQuantityChange={onItemQuantityChange}
            onBatchItemQuantityChange={onBatchItemQuantityChange}
            onClearSuggestedPrefill={onClearSuggestedPrefill}
            onItemQuantityBlur={onItemQuantityBlur}
            onItemQuantityFocus={onItemQuantityFocus}
            onApplySuggestedPricing={onApplySuggestedPricing}
            onClearAcceptedPricing={onClearAcceptedPricing}
            onScopeGapResolutionsChange={onScopeGapResolutionsChange}
            onScopeGapPriceSeparately={onScopeGapPriceSeparately}
            onScopeGapIncludeInParentPrice={onScopeGapIncludeInParentPrice}
            onRevertCalculatedQuantity={onRevertCalculatedQuantity}
            pricingEditorRequest={pricingEditorRequest}
            onPricingEditorRequestHandled={onPricingEditorRequestHandled}
            hideInlineTakeoff
            scopeItemLabel={checklistDisplayLabel(item, templateKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
        </>
      ) : (
        <QuantitySection
          itemId={item.id}
          choiceId={choiceIds.join(',')}
          inScope={inScope}
          templateKey={templateKey}
          originalNotes={originalNotes}
          measurementsInput={measurementsInput}
          onItemQuantityChange={onItemQuantityChange}
          onBatchItemQuantityChange={onBatchItemQuantityChange}
          onClearSuggestedPrefill={onClearSuggestedPrefill}
          onItemQuantityBlur={onItemQuantityBlur}
          onItemQuantityFocus={onItemQuantityFocus}
          onApplySuggestedPricing={onApplySuggestedPricing}
          onClearAcceptedPricing={onClearAcceptedPricing}
          onScopeGapResolutionsChange={onScopeGapResolutionsChange}
          onScopeGapPriceSeparately={onScopeGapPriceSeparately}
          onScopeGapIncludeInParentPrice={onScopeGapIncludeInParentPrice}
          onRevertCalculatedQuantity={onRevertCalculatedQuantity}
          pricingEditorRequest={pricingEditorRequest}
          onPricingEditorRequestHandled={onPricingEditorRequestHandled}
          hideInlineTakeoff={countChoiceItem}
          scopeItemLabel={checklistDisplayLabel(item, templateKey)}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      )}
    </View>
  );
}

function ChoiceRow({
  item,
  templateKey,
  originalNotes,
  onSelect,
  measurementsInput,
  onItemQuantityChange,
  onBatchItemQuantityChange,
  onClearSuggestedPrefill,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  onClearAcceptedPricing,
  onScopeGapResolutionsChange,
  onScopeGapPriceSeparately,
  onScopeGapIncludeInParentPrice,
  onRevertCalculatedQuantity,
  pricingEditorRequest,
  onPricingEditorRequestHandled,
  onBathroomToiletRelocateFloorTypeChange,
  onTrimFinishFieldPaintIncludedChange,
  onTrimFinishChoiceChange,
  visualCtx,
  Colors,
  darkMode,
  applying,
  embedded = false,
}: {
  item: ScopeChecklistItem;
  templateKey?: string | null;
  originalNotes?: string | null;
  onSelect: (choiceId: string) => void;
  onBathroomToiletRelocateFloorTypeChange?: (
    floorType: BathroomToiletRelocateFloorType | null
  ) => void;
  onTrimFinishFieldPaintIncludedChange?: (included: boolean) => void;
  onTrimFinishChoiceChange?: (choiceId: string | null) => void;
  measurementsInput: ScopeMeasurementsInputExtended;
  onItemQuantityChange: (
    itemId: string,
    quantity: string,
    field?: 'count' | 'allowance',
    unit?: string,
    source?: QuantitySource,
    calculatedRevertFrom?: CalculatedQuantityRevertSnapshot
  ) => void;
  onBatchItemQuantityChange: (
    updates: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onClearSuggestedPrefill?: (
    itemId: string,
    pendingUpdates?: Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>
  ) => void;
  onItemQuantityBlur: (itemId: string, field?: 'count' | 'allowance') => void;
  onItemQuantityFocus: (itemId: string, field?: 'count' | 'allowance') => void;
  onApplySuggestedPricing?: (
    itemId: string,
    block: SuggestedPricingBlock
  ) => void;
  onClearAcceptedPricing?: (itemId: string) => void;
  onScopeGapResolutionsChange?: (next: ScopeGapResolutionsMap) => void;
  onScopeGapPriceSeparately?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onScopeGapIncludeInParentPrice?: (
    parentScopeItemId: string,
    component: AssemblyComponentStatus,
    addonAmount: number,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onRevertCalculatedQuantity?: (itemId: string) => void;
  pricingEditorRequest?: { itemId: string; token: number } | null;
  onPricingEditorRequestHandled?: () => void;
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
  /** Inside Quick measurements — skip outer scope card chrome. */
  embedded?: boolean;
}) {
  const [optimisticChoiceId, setOptimisticChoiceId] = useState<
    string | null | undefined
  >(undefined);
  const optimisticChoiceRef = useRef<string | null | undefined>(undefined);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const displayedChoiceId =
    optimisticChoiceId !== undefined ? optimisticChoiceId : item.choiceId;
  useEffect(() => {
    if (
      optimisticChoiceRef.current !== undefined &&
      item.choiceId === optimisticChoiceRef.current
    ) {
      optimisticChoiceRef.current = undefined;
      setOptimisticChoiceId(undefined);
    }
  }, [item.choiceId]);
  const handleLocalChoice = useCallback(
    (choiceId: string) => {
      const nextChoiceId = item.choiceId === choiceId ? null : choiceId;
      optimisticChoiceRef.current = nextChoiceId;
      setOptimisticChoiceId(nextChoiceId);
      setTimeout(() => onSelectRef.current(choiceId), 0);
    },
    [item.choiceId]
  );
  const inScope = Boolean(
    displayedChoiceId &&
    displayedChoiceId !== 'not_in_scope' &&
    displayedChoiceId !== 'unsure'
  );
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const measuredSelection = scopeItemHasMeasuredSelection(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);
  const showToiletRelocateFloorPrompt =
    item.id === 'toilet' &&
    displayedChoiceId === 'relocating' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const storedToiletRelocateFloor =
    measurementsInput.bathroomToiletRelocateFloorType ?? null;
  const trimFinishFieldPaintIncluded = resolveTrimFinishFieldPaintIncluded({
    choiceId: displayedChoiceId,
    stored: measurementsInput.trimFinishFieldPaintIncluded,
  });
  const inactiveStyle = inactiveChoiceChipStyle(darkMode, Colors);

  return (
    <View
      style={
        embedded
          ? styles.qmEmbeddedScopeBlock
          : scopeCardStyle(tier, item, Colors, darkMode, measuredSelection)
      }
    >
      {!embedded ? (
        <ScopeItemTitleRow
          label={checklistDisplayLabel(item, templateKey)}
          noteBadge={noteBadge}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
      {helper ? (
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            marginTop: 3,
            lineHeight: 15,
          }}
        >
          {helper}
        </Text>
      ) : null}
      {item.id === 'trim_finish' ? (
        <OpeningTrimFinishChoiceSection
          choiceId={displayedChoiceId}
          fieldFinishIncluded={trimFinishFieldPaintIncluded}
          onChoiceChange={choiceId => {
            optimisticChoiceRef.current = choiceId;
            setOptimisticChoiceId(choiceId);
            onTrimFinishChoiceChange?.(choiceId);
          }}
          onFieldFinishIncludedChange={included =>
            onTrimFinishFieldPaintIncludedChange?.(included)
          }
          inactiveChipStyle={inactiveStyle}
          captionColor={captionColor(darkMode, Colors)}
          darkMode={darkMode}
          styles={styles}
        />
      ) : (
        <View style={styles.choiceWrap}>
          {(item.options || []).map(opt => {
          const active = displayedChoiceId === opt.id;
          const isUnsure = opt.id === 'unsure';
          const isExcluded = opt.id === 'not_in_scope';
          const chipInactiveStyle = inactiveChoiceChipStyle(darkMode, Colors);
          let borderColor = chipInactiveStyle.borderColor;
          let backgroundColor = chipInactiveStyle.backgroundColor;
          let textColor = chipInactiveStyle.textColor;

          if (active) {
            if (isUnsure) {
              borderColor = 'rgba(251,191,36,0.55)';
              textColor = '#d4a017';
            } else if (isExcluded) {
              borderColor = darkMode
                ? 'rgba(148, 163, 184, 0.28)'
                : Colors.line;
              backgroundColor = darkMode
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.04)';
              textColor = darkMode ? '#F5F7FA' : Colors.text;
            } else {
              borderColor = '#60a5fa';
              backgroundColor = 'rgba(96,165,250,0.18)';
              textColor = '#60a5fa';
            }
          }

          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.88}
              onPress={() => {
                hapticTap();
                handleLocalChoice(opt.id);
              }}
              style={[
                styles.choiceChipWide,
                item.id === 'tear_off'
                  ? [
                      'one_layer',
                      'two_layers',
                      'tile_removal',
                      'metal_removal',
                    ].includes(opt.id)
                    ? styles.roofingChoiceChipHalf
                    : styles.roofingChoiceChipFull
                  : null,
                item.id === 'stucco' ? styles.stuccoChoiceChip : null,
                { borderColor, backgroundColor },
              ]}
            >
              <Text
                style={[
                  {
                    color: textColor,
                    fontSize: 12,
                    fontWeight: active ? '800' : '600',
                    textAlign: 'center',
                  },
                  item.id === 'stucco' ? styles.stuccoChoiceLabel : null,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      )}
      {item.id === 'texture' && displayedChoiceId ? (
        <DrywallTextureSelectedLabel
          choiceId={displayedChoiceId}
          darkMode={darkMode}
        />
      ) : null}
      {showToiletRelocateFloorPrompt ? (
        <View style={{ marginTop: 10 }}>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginBottom: 8,
              lineHeight: 15,
            }}
          >
            What type of floor is the toilet located on?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_TOILET_RELOCATE_FLOOR_OPTIONS.map(opt => {
              const active = storedToiletRelocateFloor === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    const next =
                      storedToiletRelocateFloor === opt.id ? null : opt.id;
                    onBathroomToiletRelocateFloorTypeChange?.(next);
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active
                        ? '#60a5fa'
                        : darkMode
                          ? 'rgba(148, 163, 184, 0.16)'
                          : Colors.line,
                      backgroundColor: active
                        ? 'rgba(96,165,250,0.18)'
                        : darkMode
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? '#60a5fa'
                        : captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: active ? '800' : '600',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
      <QuantitySection
        itemId={item.id}
        choiceId={item.choiceId}
        inScope={inScope}
        templateKey={templateKey}
        originalNotes={originalNotes}
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
        onBatchItemQuantityChange={onBatchItemQuantityChange}
        onClearSuggestedPrefill={onClearSuggestedPrefill}
        onItemQuantityBlur={onItemQuantityBlur}
        onItemQuantityFocus={onItemQuantityFocus}
        onApplySuggestedPricing={onApplySuggestedPricing}
        onClearAcceptedPricing={onClearAcceptedPricing}
        onScopeGapResolutionsChange={onScopeGapResolutionsChange}
        onScopeGapPriceSeparately={onScopeGapPriceSeparately}
        onScopeGapIncludeInParentPrice={onScopeGapIncludeInParentPrice}
        onRevertCalculatedQuantity={onRevertCalculatedQuantity}
        pricingEditorRequest={pricingEditorRequest}
        onPricingEditorRequestHandled={onPricingEditorRequestHandled}
        scopeItemLabel={checklistDisplayLabel(item, templateKey)}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
    </View>
  );
}

function choiceIdToState(choiceId: string): ScopeAssumptionState {
  if (choiceId === 'not_in_scope') return 'excluded';
  if (choiceId === 'unsure' || !choiceId) return 'unsure';
  return 'included';
}

function mepQuickMeasurementPricingHint(
  fieldKey: QuickMeasurementFieldKey,
  quantityValue: string,
  laborComplexityMultiplier = 1
): string | undefined {
  const card =
    PLUMBING_CARDS.find(item => item.measurementKey === fieldKey) ||
    ELECTRICAL_CARDS.find(item => item.measurementKey === fieldKey);
  if (!card) return undefined;
  const unit = card.unit || 'each';
  const split = getNationalAverageBudgetSplit(card.itemId, unit);
  if (!split) return undefined;
  const material = Number(split.material) || 0;
  const labor = Number(split.labor) || 0;
  const adjustedLabor =
    laborComplexityMultiplier > 1
      ? Math.round(labor * laborComplexityMultiplier)
      : labor;
  const unitTotal = material + adjustedLabor;
  if (!(unitTotal > 0)) return undefined;
  const qty = Number(String(quantityValue || '').replace(/,/g, ''));
  const lineTotal =
    Number.isFinite(qty) && qty > 0 ? Math.round(unitTotal * qty) : null;
  const ratePart = `${formatDraftMoney(unitTotal)} / ${formatUnitLabel(unit)} · ${formatDraftMoney(material)} material + ${formatDraftMoney(adjustedLabor)} labor`;
  const complexitySuffix =
    laborComplexityMultiplier > 1
      ? ` · complexity ${formatComplexityPercent(laborComplexityMultiplier)} labor`
      : '';
  if (lineTotal != null) {
    return `Suggested ${formatDraftMoney(lineTotal)} · ${ratePart}${complexitySuffix}`;
  }
  return `Suggested ${ratePart}${complexitySuffix}`;
}

const INSULATION_TYPE_OPTIONS = [
  'Batt',
  'Blown-in',
  'Spray foam',
  'Rigid foam board',
  'Cellulose',
  'Mineral wool',
] as const;

const INSULATION_R_VALUE_OPTIONS = [
  'R-5',
  'R-10',
  'R-13',
  'R-15',
  'R-19',
  'R-21',
  'R-30',
  'R-38',
  'R-49',
  'R-60',
] as const;

const INSULATION_LOCATION_OPTIONS = [
  { key: 'exterior_wall', label: 'Exterior wall' },
  { key: 'attic_ceiling', label: 'Attic / ceiling' },
  { key: 'roof_deck', label: 'Roof deck' },
  { key: 'garage_separation', label: 'Garage separation' },
  { key: 'floor', label: 'Floor' },
] as const;

type InsulationAssemblyLocation =
  (typeof INSULATION_LOCATION_OPTIONS)[number]['key'];

const INSULATION_R_VALUES_BY_MATERIAL: Record<string, readonly string[]> = {
  batt: ['R-13', 'R-15', 'R-19', 'R-21', 'R-23', 'R-30', 'R-38', 'R-49'],
  'blown-in': ['R-30', 'R-38', 'R-49', 'R-60'],
  'spray foam': ['R-13', 'R-21', 'R-30', 'R-38', 'R-49', 'R-60'],
  'rigid foam board': ['R-5', 'R-10', 'R-15', 'R-20', 'R-30'],
  cellulose: ['R-30', 'R-38', 'R-49', 'R-60'],
  'mineral wool': ['R-15', 'R-21', 'R-30', 'R-38'],
};

const INSULATION_R_VALUES_BY_LOCATION: Record<
  InsulationAssemblyLocation,
  readonly string[]
> = {
  exterior_wall: ['R-13', 'R-15', 'R-19', 'R-21', 'R-23'],
  attic_ceiling: ['R-30', 'R-38', 'R-49', 'R-60'],
  roof_deck: ['R-21', 'R-30', 'R-38', 'R-49'],
  floor: ['R-19', 'R-21', 'R-30', 'R-38'],
  garage_separation: ['R-13', 'R-15', 'R-19', 'R-21'],
};

function insulationMaterialKey(materialType: string): string {
  const value = materialType.trim().toLowerCase();
  return (
    Object.keys(INSULATION_R_VALUES_BY_MATERIAL).find(key =>
      value.includes(key)
    ) || 'batt'
  );
}

function insulationLocationForMaterial(
  materialType: string
): InsulationAssemblyLocation {
  const key = insulationMaterialKey(materialType);
  if (key === 'blown-in' || key === 'cellulose') return 'attic_ceiling';
  if (key === 'spray foam') return 'roof_deck';
  return 'exterior_wall';
}

function insulationLocationForAssembly(
  materialType: string,
  rValue: string
): InsulationAssemblyLocation {
  const numericRValue = Number(rValue.match(/\d+/)?.[0] || 0);
  if (numericRValue >= 30) {
    return insulationMaterialKey(materialType) === 'spray foam'
      ? 'roof_deck'
      : 'attic_ceiling';
  }
  return insulationLocationForMaterial(materialType);
}

function supportedInsulationRValues(
  materialType: string,
  location: string | null | undefined
): readonly string[] {
  const materialValues =
    INSULATION_R_VALUES_BY_MATERIAL[insulationMaterialKey(materialType)] ||
    INSULATION_R_VALUES_BY_MATERIAL.batt;
  const locationValues =
    INSULATION_R_VALUES_BY_LOCATION[location as InsulationAssemblyLocation];
  return locationValues
    ? locationValues.filter(value => materialValues.includes(value))
    : materialValues;
}

function defaultInsulationRValue(
  materialType: string,
  location: string,
  preferred: string
): string {
  const values = supportedInsulationRValues(materialType, location);
  return (
    values.find(value => value.toLowerCase() === preferred.toLowerCase()) ||
    values[0] ||
    preferred
  );
}

function insulationLocationLabel(location: string | null | undefined): string {
  return (
    INSULATION_LOCATION_OPTIONS.find(option => option.key === location)?.label ||
    'Assembly location'
  );
}

const GARAGE_INSULATION_OPTIONS = [
  'Yes',
  'No',
  'Separation only',
] as const;

const QuickMeasurementField = React.memo(function QuickMeasurementField({
  field,
  value,
  fromNotes,
  variant,
  estimate,
  detailsOpen,
  onToggleDetails,
  onChangeText,
  onFocus,
  onBlur,
  onQuantityEditFocus,
  onQuantityEditBlur,
  onUseSuggestion,
  Colors,
  darkMode,
  applying,
  inWetAreaPanel = false,
  compact = false,
  relaxedSpacing = false,
  laborComplexityMultiplier = 1,
}: {
  field: QuickMeasurementFieldDef;
  value: string;
  fromNotes?: boolean;
  /** calm = detected/confirmed (no badge); needs_confirmation = yellow only; suggestion = compact Use row */
  variant: 'calm' | 'needs_confirmation' | 'suggestion' | 'more';
  estimate: QuickMeasurementEstimate | null;
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  onChangeText: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onQuantityEditFocus?: () => void;
  onQuantityEditBlur?: () => void;
  onUseSuggestion: (estimate: QuickMeasurementEstimate) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
  /** Inside the gold wet-area panel — skip yellow borders and use a higher-contrast shell. */
  inWetAreaPanel?: boolean;
  /** Whole-home card: less helper copy, tighter suggestion chrome. */
  compact?: boolean;
  /** Extra label/input padding for stacked trade cards like painting. */
  relaxedSpacing?: boolean;
  /** Labor-only project complexity multiplier for MEP plan hints. */
  laborComplexityMultiplier?: number;
}) {
  const isInsulationPresetField = Boolean(insulationOptions);
  const usesNumericEditDraft = !isInsulationPresetField;
  const [numericDraft, setNumericDraft] = useState('');
  const [numericEditing, setNumericEditing] = useState(false);
  useEffect(() => {
    if (!numericEditing) {
      setNumericDraft(String(value ?? '').replace(/,/g, ''));
    }
  }, [value, numericEditing]);
  const inputValue =
    usesNumericEditDraft && numericEditing ? numericDraft : value;
  const textInputValue =
    usesNumericEditDraft && numericEditing
      ? numericDraft
      : formatMeasurementDisplay(inputValue);
  const unitLabel =
    field.key === 'stuccoStories'
      ? Number(String(inputValue).replace(/,/g, '')) === 1
        ? 'story'
        : inputValue
          ? 'stories'
          : field.unit
      : field.unit;
  const handleInputFocus = () => {
    onQuantityEditFocus?.();
    if (usesNumericEditDraft) {
      setNumericDraft(String(value ?? '').replace(/,/g, ''));
      setNumericEditing(true);
    }
    onFocus?.();
  };
  const handleInputChange = (nextValue: string) => {
    const cleaned = nextValue.replace(/,/g, '');
    if (usesNumericEditDraft) {
      setNumericDraft(cleaned);
    } else {
      onChangeText(cleaned);
    }
  };
  const handleInputBlur = () => {
    if (usesNumericEditDraft) {
      onChangeText(numericDraft);
      setNumericEditing(false);
    }
    onBlur?.();
    onQuantityEditBlur?.();
  };
  const baseInputShell = inputShellStyle(Colors, darkMode);
  // Wet-area panel is already amber-tinted; neutral shells keep bath/shower inputs readable.
  const inputShell = inWetAreaPanel
    ? {
        backgroundColor: darkMode ? 'rgba(0,0,0,0.45)' : Colors.surface,
        borderColor: darkMode ? 'rgba(255,255,255,0.22)' : Colors.line,
      }
    : baseInputShell;
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const caption = captionColor(darkMode, Colors);
  const label = estimate?.quantityLabel || quickMeasurementDisplayLabel(field);
  const plumbingFieldSpacing = PLUMBING_CARDS.some(
    card => card.measurementKey === field.key
  )
    ? styles.measurementFieldPlumbing
    : null;
  const mepPricingHint = mepQuickMeasurementPricingHint(
    field.key,
    inputValue,
    laborComplexityMultiplier
  );
  // Living / Gross: calm only. Cabinets / counters helpers are noisy in compact whole-home layout.
  const helperText = (() => {
    if (mepPricingHint) return mepPricingHint;
    if (compact) return undefined;
    const text = quickMeasurementHelperText(field);
    if (!text) return undefined;
    if (field.key === 'cabinetLf' || field.key === 'countertopSqft')
      return text;
    if (
      variant === 'calm' &&
      (field.key === 'floorAreaSqft' || field.key === 'flooringSqft')
    )
      return text;
    return undefined;
  })();
  const showYellowBorder =
    variant === 'needs_confirmation' &&
    !inWetAreaPanel &&
    String(inputValue).trim() !== '';
  const insulationOptions =
    field.key === 'insulationMaterialType'
      ? INSULATION_TYPE_OPTIONS
      : field.key === 'insulationRValue'
        ? INSULATION_R_VALUE_OPTIONS
        : field.key === 'garageInsulationIncluded'
          ? GARAGE_INSULATION_OPTIONS
          : null;
  const insulationPresetSelected = Boolean(
    insulationOptions?.some(
      option => option.toLowerCase() === String(inputValue).trim().toLowerCase()
    )
  );

  if (variant === 'suggestion') {
    const badge = estimate
      ? quickMeasurementEstimateBadgeLabel(estimate)
      : null;
    return (
      <View
        style={[
          styles.measurementField,
          plumbingFieldSpacing,
          compact ? styles.measurementFieldSpaced : null,
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <Text
            style={[
              styles.measurementLabel,
              {
                color: darkMode ? '#F5F7FA' : Colors.text,
                fontSize: 13,
                fontWeight: '700',
                flex: 1,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {estimate ? (
            <TouchableOpacity
              onPress={() => onUseSuggestion(estimate)}
              disabled={applying}
              activeOpacity={0.75}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: '#34d399',
              }}
            >
              <Text
                style={{ color: '#042f2e', fontSize: 12, fontWeight: '800' }}
              >
                Use
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {estimate ? (
          <TouchableOpacity
            onPress={onToggleDetails}
            activeOpacity={0.7}
            style={{ marginBottom: 6, alignSelf: 'flex-start' }}
          >
            <Text
              style={{
                color: '#34d399',
                fontSize: 13,
                fontWeight: '700',
              }}
              numberOfLines={1}
            >
              Suggested {estimate.summary}
              {badge ? ` · ${badge}` : ''}
              {detailsOpen ? ' · Hide' : ''}
            </Text>
          </TouchableOpacity>
        ) : null}
        {estimate && detailsOpen ? (
          <View style={{ marginBottom: 8, gap: 3, paddingLeft: 2 }}>
            <Text style={{ color: caption, fontSize: 11, lineHeight: 15 }}>
              {estimate.basis}
            </Text>
            {estimate.warning ? (
              <Text style={{ color: '#fbbf24', fontSize: 10, lineHeight: 14 }}>
                {estimate.warning}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View
          style={[
            styles.measurementInputRow,
            {
              borderColor: inputShell.borderColor,
              backgroundColor: inputShell.backgroundColor,
            },
          ]}
        >
          <TextInput
            nativeID={`quick-measurement-${field.key}`}
            value={textInputValue}
            onChangeText={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={
              estimate
                ? 'Or enter your own'
                : quickMeasurementPlaceholder(field)
            }
            placeholderTextColor={placeholderColor}
            keyboardType='decimal-pad'
            blurOnSubmit={false}
            {...scopeNumericInputProps}
            editable={!applying}
            style={[styles.measurementInput, { color: Colors.text }]}
          />
          <Text style={[styles.measurementUnit, { color: Colors.sub }]}>
            {unitLabel}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.measurementField,
        plumbingFieldSpacing,
        compact ? styles.measurementFieldSpaced : null,
        insulationOptions
          ? {
              borderWidth: 1,
              borderColor: darkMode
                ? 'rgba(255,255,255,0.14)'
                : Colors.line,
              borderRadius: 16,
              backgroundColor: darkMode ? '#171719' : Colors.surface,
              paddingHorizontal: 12,
              paddingVertical: 12,
            }
          : null,
      ]}
    >
      <View
        style={[
          styles.measurementLabelRow,
          relaxedSpacing ? { marginBottom: 8 } : null,
        ]}
      >
        <Text
          style={[
            styles.measurementLabel,
            {
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: compact ? 13 : 12,
              fontWeight: '700',
            },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {fromNotes ? (
          <View
            style={[
              styles.measurementFromNotesChip,
              {
                borderColor: darkMode
                  ? 'rgba(34, 197, 94, 0.28)'
                  : 'rgba(22, 163, 74, 0.22)',
                backgroundColor: darkMode
                  ? 'rgba(34, 197, 94, 0.1)'
                  : 'rgba(22, 163, 74, 0.08)',
              },
            ]}
          >
            <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700' }}>
              Notes
            </Text>
          </View>
        ) : null}
      </View>
      {helperText ? (
        <Text
          style={{
            color: caption,
            fontSize: 10,
            lineHeight: 13,
            marginBottom: 4,
            minHeight: mepPricingHint ? 26 : undefined,
          }}
          numberOfLines={mepPricingHint ? 2 : undefined}
        >
          {helperText}
        </Text>
      ) : null}
      {insulationOptions ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: darkMode
              ? 'rgba(255,255,255,0.12)'
              : Colors.line,
            borderRadius: 10,
            backgroundColor: darkMode
              ? 'rgba(255,255,255,0.025)'
              : Colors.surface2,
            padding: 6,
            marginBottom: field.key === 'insulationRValue' ? 7 : 0,
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {insulationOptions.map(option => {
              const selected =
                String(inputValue).trim().toLowerCase() ===
                option.toLowerCase();
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => onChangeText(option)}
                  disabled={applying}
                  activeOpacity={0.75}
                  style={{
                    minWidth: field.key === 'insulationRValue' ? 54 : 92,
                    flexGrow: 1,
                    borderRadius: 7,
                    borderWidth: 1,
                    borderColor: selected
                      ? '#34d399'
                      : darkMode
                        ? 'rgba(255,255,255,0.22)'
                        : Colors.line,
                    backgroundColor: selected
                      ? 'rgba(52, 211, 153, 0.14)'
                      : inputShell.backgroundColor,
                    paddingHorizontal: 9,
                    paddingVertical: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: selected ? '#34d399' : Colors.text,
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
      {field.key !== 'insulationMaterialType' &&
      field.key !== 'garageInsulationIncluded' &&
      !(field.key === 'insulationRValue' && insulationPresetSelected) ? (
        <View
          style={[
            styles.measurementInputRow,
            relaxedSpacing ? { minHeight: 44 } : null,
            {
              borderColor: showYellowBorder
                ? darkMode
                  ? 'rgba(251, 191, 36, 0.45)'
                  : 'rgba(217, 119, 6, 0.4)'
                : inputShell.borderColor,
              backgroundColor: inputShell.backgroundColor,
            },
          ]}
        >
          <TextInput
            nativeID={`quick-measurement-${field.key}`}
            value={textInputValue}
            onChangeText={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={
              field.key === 'insulationRValue'
                ? 'Or enter a custom R-value'
                : quickMeasurementPlaceholder(field)
            }
            placeholderTextColor={placeholderColor}
            keyboardType={insulationOptions ? 'default' : 'decimal-pad'}
            blurOnSubmit={false}
            {...scopeNumericInputProps}
            editable={!applying}
            style={[styles.measurementInput, { color: Colors.text }]}
          />
          <Text style={[styles.measurementUnit, { color: Colors.sub }]}>
            {unitLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

function insulationAssemblyRowTitle(
  row: InsulationAssembly,
  materialType: string
): string {
  const facing = insulationBattFacingLabel(row.battFacing);
  return [
    materialType,
    facing,
    insulationLocationLabel(row.location),
    row.rValue.trim() || 'R-value not specified',
  ]
    .filter(Boolean)
    .join(' · ');
}

function battFacingForNewRow(materialType: string): InsulationBattFacing | null {
  return isBattInsulationMaterial(materialType)
    ? INSULATION_BATT_FACING_DEFAULT
    : null;
}

function buildInsulationAssemblyRows(
  measurements: Record<string, unknown>
): InsulationAssembly[] {
  const hasStoredAssemblies = Array.isArray(measurements.insulationAssemblies);
  const storedAssemblies = hasStoredAssemblies
    ? (measurements.insulationAssemblies as InsulationAssembly[])
    : [];
  const parseSqft = (value: unknown) => {
    const sqft = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(sqft) && sqft > 0 ? sqft : 0;
  };
  const wallPlanArea = parseSqft(measurements.exteriorWallInsulationSqft);
  const ceilingPlanArea =
    parseSqft(measurements.insulatedRoofDeckSqft) ||
    parseSqft(measurements.atticInsulationSqft);
  const legacyMaterial =
    String(measurements.insulationMaterialType || '').trim();
  const legacyRValue = String(measurements.insulationRValue || '').trim();
  const legacyLocation = insulationLocationForAssembly(
    legacyMaterial,
    legacyRValue
  );
  const ceilingLocation =
    parseSqft(measurements.insulatedRoofDeckSqft) > 0
      ? 'roof_deck'
      : 'attic_ceiling';
  const fallbackRows: InsulationAssembly[] = [
    wallPlanArea > 0
      ? {
          id: 'insulation-assembly-wall',
          materialType: legacyMaterial,
          rValue: legacyRValue
            ? defaultInsulationRValue(
                legacyMaterial,
                'exterior_wall',
                legacyRValue
              )
            : '',
          sqft: String(Math.round(wallPlanArea)),
          location: 'exterior_wall',
          battFacing: battFacingForNewRow(legacyMaterial),
        }
      : null,
    ceilingPlanArea > 0
      ? {
          id: 'insulation-assembly-ceiling',
          materialType: legacyMaterial,
          rValue: legacyRValue
            ? defaultInsulationRValue(
                legacyMaterial,
                ceilingLocation,
                legacyRValue
              )
            : '',
          sqft: String(Math.round(ceilingPlanArea)),
          location: ceilingLocation,
          battFacing: battFacingForNewRow(legacyMaterial),
        }
      : null,
  ].filter((row): row is InsulationAssembly => Boolean(row));
  if (hasStoredAssemblies) {
    return storedAssemblies.map(row => ({
      ...row,
      location:
        row.location || insulationLocationForMaterial(row.materialType),
    }));
  }
  if (fallbackRows.length) return fallbackRows;
  return [
    {
      id: 'insulation-assembly-1',
      materialType: legacyMaterial,
      rValue: legacyRValue
        ? defaultInsulationRValue(legacyMaterial, legacyLocation, legacyRValue)
        : '',
      sqft: '',
      location: legacyLocation,
      battFacing: battFacingForNewRow(legacyMaterial),
    },
  ];
}

function InsulationAssemblyCard({
  measurements,
  onChange,
  onAssembliesChange,
  templateKey = null,
  Colors,
  darkMode,
}: {
  measurements: Record<string, unknown>;
  onChange: (
    key:
      | 'insulationMaterialType'
      | 'insulationRValue'
      | 'garageInsulationIncluded',
    value: string
  ) => void;
  onAssembliesChange: (assemblies: InsulationAssembly[] | null) => void;
  templateKey?: string | null;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const [expandedAssemblyId, setExpandedAssemblyId] = useState<string | null>(
    null
  );
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(
    () => new Set()
  );
  const planMeasurementSyncKey = useMemo(
    () =>
      [
        measurements.exteriorWallInsulationSqft,
        measurements.atticInsulationSqft,
        measurements.insulatedRoofDeckSqft,
      ].join('|'),
    [
      measurements.exteriorWallInsulationSqft,
      measurements.atticInsulationSqft,
      measurements.insulatedRoofDeckSqft,
    ]
  );
  const assemblySyncKey = useMemo(() => {
    if (Array.isArray(measurements.insulationAssemblies)) {
      return JSON.stringify(measurements.insulationAssemblies);
    }
    return [
      measurements.exteriorWallInsulationSqft,
      measurements.atticInsulationSqft,
      measurements.insulatedRoofDeckSqft,
      measurements.insulationMaterialType,
      measurements.insulationRValue,
    ].join('|');
  }, [
    measurements.insulationAssemblies,
    measurements.exteriorWallInsulationSqft,
    measurements.atticInsulationSqft,
    measurements.insulatedRoofDeckSqft,
    measurements.insulationMaterialType,
    measurements.insulationRValue,
  ]);
  const [rows, setRows] = useState<InsulationAssembly[]>(() =>
    buildInsulationAssemblyRows(measurements)
  );
  const measurementsRef = useRef(measurements);
  measurementsRef.current = measurements;
  useEffect(() => {
    setCollapsedTypes(new Set());
  }, [planMeasurementSyncKey]);
  useEffect(() => {
    const fromParent = buildInsulationAssemblyRows(measurementsRef.current);
    setRows(prev => mergeInsulationAssemblyRowsWithDrafts(fromParent, prev));
  }, [assemblySyncKey]);
  const parseSqft = (value: unknown) => {
    const sqft = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(sqft) && sqft > 0 ? sqft : 0;
  };
  const legacyMaterial =
    String(measurements.insulationMaterialType || '').trim();
  const legacyRValue = String(measurements.insulationRValue || '').trim();
  const updateRows = (next: InsulationAssembly[]) => {
    setRows(next);
    const normalized = next.filter(
      row => row.materialType.trim() && row.rValue.trim()
    );
    onAssembliesChange(normalized.length ? normalized : null);
    const first = normalized[0];
    if (first) {
      onChange('insulationMaterialType', first.materialType);
      onChange('insulationRValue', first.rValue);
    } else {
      onChange('insulationMaterialType', '');
      onChange('insulationRValue', '');
    }
  };
  const updateRow = (id: string, patch: Partial<InsulationAssembly>) => {
    updateRows(
      rows.map(row => {
        if (row.id !== id) return row;
        const confirmsQuantity =
          patch.sqft !== undefined ||
          patch.rValue !== undefined ||
          patch.location !== undefined ||
          patch.battFacing !== undefined;
        return {
          ...row,
          ...patch,
          ...(confirmsQuantity
            ? { source: 'contractor_entered' as const, confirmed: true }
            : {}),
        };
      })
    );
  };
  const isTypeCollapsed = (materialType: string) =>
    collapsedTypes.has(insulationMaterialTypeKey(materialType));
  const visibleRows = rows.filter(
    row => !isTypeCollapsed(row.materialType)
  );
  const hiddenRowCount = rows.length - visibleRows.length;
  const totalConfirmedSqft = rows.reduce(
    (sum, row) =>
      sum +
      (row.confirmed === false || row.source === 'calculated_from_plan'
        ? 0
        : parseSqft(row.sqft)),
    0
  );
  const totalNeedsConfirmationSqft = rows.reduce(
    (sum, row) =>
      sum +
      (row.confirmed === false || row.source === 'calculated_from_plan'
        ? parseSqft(row.sqft)
        : 0),
    0
  );
  const pricedAssemblyCount = rows.filter(isPricedInsulationAssembly).length;
  const setupAssemblyCount = rows.filter(isIncompleteInsulationAssembly).length;
  const duplicateAssemblyIds = useMemo(
    () => insulationAssemblyDuplicateRowIds(rows),
    [rows]
  );
  const pricingContext = React.useContext(ScopePricingContextValue);
  const assemblyPlanningRateLabel = useMemo(
    () =>
      resolveInsulationAssemblyPlanningRateLabel(
        resolveInsulationAssemblyPlanningRateTier(
          templateKey,
          parseScopeMeasurementInput(String(measurements.floorAreaSqft ?? ''))
        )
      ),
    [templateKey, measurements.floorAreaSqft]
  );
  const rowPricingById = useMemo(
    () =>
      resolveInsulationAssemblyRowPricingMap(rows, {
        livingSf: parseScopeMeasurementInput(
          String(measurements.floorAreaSqft ?? '')
        ),
        pricingContext,
        templateKey,
      }),
    [rows, measurements.floorAreaSqft, pricingContext, templateKey]
  );
  const assemblyPricingTotal = useMemo(
    () =>
      Array.from(rowPricingById.values()).reduce(
        (sum, pricing) => sum + pricing.total,
        0
      ),
    [rowPricingById]
  );
  const ceilingRoofConflict = useMemo(
    () => insulationAssemblyCeilingRoofDeckConflict(rows),
    [rows]
  );
  const assemblyCodeUpgradeTargets = useMemo(
    () => insulationAssemblyCodeUpgradeTargets(rows, pricingContext?.state),
    [rows, pricingContext?.state]
  );
  const removePricedAssembliesAtLocation = (
    location: 'attic_ceiling' | 'roof_deck'
  ) => {
    updateRows(insulationAssemblyRowsWithoutPricedLocation(rows, location));
  };
  const assemblySummaryParts = [
    `${pricedAssemblyCount} priced ${
      pricedAssemblyCount === 1 ? 'assembly' : 'assemblies'
    }`,
    `${totalConfirmedSqft.toLocaleString()} sqft`,
    assemblyPricingTotal > 0
      ? formatDraftMoney(assemblyPricingTotal)
      : null,
    setupAssemblyCount > 0
      ? `${setupAssemblyCount} need setup`
      : null,
    hiddenRowCount > 0 ? `${hiddenRowCount} hidden` : null,
    totalNeedsConfirmationSqft > 0
      ? `${totalNeedsConfirmationSqft.toLocaleString()} to confirm`
      : null,
  ].filter(Boolean);
  const selectedTypes = Array.from(
    new Set(
      visibleRows
        .map(row => row.materialType.trim())
        .filter(Boolean)
    )
  );
  const toggleType = (materialType: string) => {
    const key = insulationMaterialTypeKey(materialType);
    const matching = rowsForInsulationMaterialType(rows, materialType);
    if (matching.length && !isTypeCollapsed(materialType)) {
      if (
        expandedAssemblyId &&
        matching.some(row => row.id === expandedAssemblyId)
      ) {
        setExpandedAssemblyId(null);
      }
      setCollapsedTypes(prev => new Set(prev).add(key));
      return;
    }
    if (matching.length && isTypeCollapsed(materialType)) {
      setCollapsedTypes(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setExpandedAssemblyId(matching[0].id);
      return;
    }
    setCollapsedTypes(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    const id = `insulation-assembly-${Date.now()}`;
    setExpandedAssemblyId(id);
    updateRows([
      ...rows,
      {
        id,
        materialType,
        rValue: '',
        sqft: '',
        location: insulationLocationForMaterial(materialType),
        battFacing: battFacingForNewRow(materialType),
      },
    ]);
  };
  const selectRowRValue = (row: InsulationAssembly, rValue: string) => {
    if (row.rValue.trim().toLowerCase() === rValue.toLowerCase()) {
      updateRow(row.id, { rValue: '' });
      return;
    }
    const next = rows
      .filter(
        candidate =>
          candidate.id === row.id ||
          !(
            !candidate.rValue.trim() &&
            insulationMaterialTypeKey(candidate.materialType) ===
              insulationMaterialTypeKey(row.materialType) &&
            candidate.location === row.location
          )
      )
      .map(candidate =>
        candidate.id === row.id
          ? {
              ...candidate,
              rValue,
              location:
                candidate.location ||
                insulationLocationForAssembly(candidate.materialType, rValue),
              source: 'contractor_entered' as const,
              confirmed: true,
            }
          : candidate
      );
    updateRows(next);
  };
  const upgradeAssemblyRValue = (rowId: string, targetRValue: string) => {
    const row = rows.find(candidate => candidate.id === rowId);
    if (!row) return;
    selectRowRValue(row, targetRValue);
  };
  const deleteAssemblyRow = (id: string) => {
    if (expandedAssemblyId === id) setExpandedAssemblyId(null);
    updateRows(rows.filter(row => row.id !== id));
  };
  const addAssemblyRow = (materialType: string) => {
    const id = `insulation-assembly-${Date.now()}`;
    setExpandedAssemblyId(id);
    updateRows([
      ...rows,
      {
        id,
        materialType,
        rValue: '',
        sqft: '',
        location: insulationLocationForMaterial(materialType),
        battFacing: battFacingForNewRow(materialType),
      },
    ]);
  };
  const renderTypeOptions = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingRight: 4 }}
    >
      {INSULATION_TYPE_OPTIONS.map(option => {
        const hasRows = rowsForInsulationMaterialType(rows, option).length > 0;
        const hidden = hasRows && isTypeCollapsed(option);
        const selected = hasRows;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => toggleType(option)}
            activeOpacity={0.75}
            style={{
              minWidth: 96,
              alignItems: 'center',
              paddingVertical: 7,
              paddingHorizontal: 6,
              borderRadius: 9,
              borderWidth: 1,
              borderStyle: hidden ? 'dashed' : 'solid',
              borderColor: selected
                ? hidden
                  ? 'rgba(245,158,11,0.55)'
                  : '#34d399'
                : darkMode
                  ? 'rgba(255,255,255,0.14)'
                  : Colors.line,
              backgroundColor: selected
                ? hidden
                  ? 'rgba(245,158,11,0.1)'
                  : 'rgba(52,211,153,0.14)'
                : darkMode
                  ? '#252527'
                  : Colors.surface2,
            }}
          >
            <Text
              style={{
                color: selected
                  ? hidden
                    ? '#fbbf24'
                    : '#34d399'
                  : Colors.text,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
  const renderRValueOptions = (row: InsulationAssembly) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingRight: 4 }}
    >
      {supportedInsulationRValues(row.materialType, row.location).map(option => {
        const selected =
          row.rValue.trim().toLowerCase() === option.toLowerCase();
        return (
          <TouchableOpacity
            key={option}
            onPress={() => selectRowRValue(row, option)}
            activeOpacity={0.75}
            style={{
              minWidth: 54,
              alignItems: 'center',
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: selected
                ? '#34d399'
                : darkMode
                  ? 'rgba(255,255,255,0.14)'
                  : Colors.line,
              backgroundColor: selected
                ? 'rgba(52,211,153,0.14)'
                : darkMode
                  ? '#252527'
                  : Colors.surface2,
            }}
          >
            <Text
              style={{
                color: selected ? '#34d399' : Colors.text,
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
  const renderBattFacingOptions = (row: InsulationAssembly) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingRight: 4 }}
    >
      {INSULATION_BATT_FACING_OPTIONS.map(option => {
        const selected = (row.battFacing || INSULATION_BATT_FACING_DEFAULT) === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() =>
              updateRow(row.id, {
                battFacing: option.key,
                source: 'contractor_entered',
                confirmed: true,
              })
            }
            activeOpacity={0.75}
            style={{
              minWidth: 78,
              alignItems: 'center',
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: selected
                ? '#34d399'
                : darkMode
                  ? 'rgba(255,255,255,0.14)'
                  : Colors.line,
              backgroundColor: selected
                ? 'rgba(52,211,153,0.14)'
                : darkMode
                  ? '#252527'
                  : Colors.surface2,
            }}
          >
            <Text
              style={{
                color: selected ? '#34d399' : Colors.text,
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
  const renderLocationOptions = (row: InsulationAssembly) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingRight: 4 }}
    >
      {INSULATION_LOCATION_OPTIONS.map(option => {
        const selected = row.location === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => {
              const supported = supportedInsulationRValues(
                row.materialType,
                option.key
              );
              const nextRValue = supported.some(
                value => value.toLowerCase() === row.rValue.toLowerCase()
              )
                ? row.rValue
                : '';
              updateRow(row.id, {
                location: option.key,
                rValue: nextRValue,
              });
            }}
            activeOpacity={0.75}
            style={{
              minWidth: 98,
              alignItems: 'center',
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: selected
                ? '#34d399'
                : darkMode
                  ? 'rgba(255,255,255,0.14)'
                  : Colors.line,
              backgroundColor: selected
                ? 'rgba(52,211,153,0.14)'
                : darkMode
                  ? '#252527'
                  : Colors.surface2,
            }}
          >
            <Text
              style={{
                color: selected ? '#34d399' : Colors.text,
                fontSize: 10,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
  return (
    <View
      style={{
        alignSelf: 'stretch',
        marginTop: 12,
        marginHorizontal: -6,
        marginBottom: 12,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: darkMode ? 'rgba(255,255,255,0.14)' : Colors.line,
        backgroundColor: darkMode ? '#202022' : Colors.surface,
        shadowColor: '#000',
        shadowOpacity: darkMode ? 0.24 : 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={{
              color: Colors.text,
              fontSize: 15,
              fontWeight: '800',
            }}
          >
            Insulation assemblies
          </Text>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 10,
              fontWeight: '600',
              marginTop: 2,
            }}
          >
            {assemblySummaryParts.join(' · ')}
          </Text>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 10,
              marginTop: 2,
            }}
          >
            {assemblyPlanningRateLabel} pricing
          </Text>
        </View>
      </View>
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 10,
          marginTop: 4,
          lineHeight: 14,
        }}
      >
        Tap a row to edit. Tap Done when finished, or add another assembly below.
      </Text>
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          fontWeight: '700',
          marginTop: 10,
          marginBottom: 5,
          letterSpacing: 0.35,
        }}
      >
        Installation type
      </Text>
      {renderTypeOptions()}
      {hiddenRowCount > 0 ? (
        <Text
          style={{
            color: '#fbbf24',
            fontSize: 10,
            marginTop: 6,
            lineHeight: 14,
          }}
        >
          Hidden installation types are still included in bid pricing. Tap the
          dashed chip to show them again.
        </Text>
      ) : null}
      {ceilingRoofConflict.hasConflict && ceilingRoofConflict.message ? (
        <View
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            backgroundColor: 'rgba(245,158,11,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(245,158,11,0.35)',
          }}
        >
          <Text
            style={{
              color: '#fbbf24',
              fontSize: 10,
              lineHeight: 14,
            }}
          >
            {ceilingRoofConflict.message}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 8,
            }}
          >
            <TouchableOpacity
              onPress={() => removePricedAssembliesAtLocation('roof_deck')}
              activeOpacity={0.75}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 6,
                borderRadius: 7,
                backgroundColor: 'rgba(245,158,11,0.16)',
                borderWidth: 1,
                borderColor: 'rgba(245,158,11,0.45)',
              }}
            >
              <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '700' }}>
                Keep attic / ceiling only
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => removePricedAssembliesAtLocation('attic_ceiling')}
              activeOpacity={0.75}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 6,
                borderRadius: 7,
                backgroundColor: 'rgba(245,158,11,0.16)',
                borderWidth: 1,
                borderColor: 'rgba(245,158,11,0.45)',
              }}
            >
              <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '700' }}>
                Keep roof deck only
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {assemblyCodeUpgradeTargets.map(target => (
        <View
          key={`${target.rowId}-${target.targetRValue}`}
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            backgroundColor: 'rgba(96,165,250,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(96,165,250,0.28)',
          }}
        >
          <Text
            style={{
              color: '#60a5fa',
              fontSize: 10,
              lineHeight: 14,
            }}
          >
            {target.message} Review before bid.
          </Text>
          <TouchableOpacity
            onPress={() =>
              upgradeAssemblyRValue(target.rowId, target.targetRValue)
            }
            activeOpacity={0.75}
            style={{
              alignSelf: 'flex-start',
              marginTop: 8,
              paddingHorizontal: 9,
              paddingVertical: 6,
              borderRadius: 7,
              backgroundColor: 'rgba(96,165,250,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(96,165,250,0.4)',
            }}
          >
            <Text style={{ color: '#60a5fa', fontSize: 10, fontWeight: '700' }}>
              Upgrade to {target.targetRValue}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
      {selectedTypes.map(materialType => {
        const typeRows = rows.filter(
          row =>
            row.materialType.toLowerCase() === materialType.toLowerCase()
        );
        return (
          <View
            key={materialType}
            style={{
              marginTop: 8,
            }}
          >
            {typeRows.map(row => {
              const isExpanded = expandedAssemblyId === row.id;
              const area = String(row.sqft ?? '').trim();
              const needsConfirmation =
                row.confirmed === false ||
                row.source === 'calculated_from_plan';
              const isIncomplete = isIncompleteInsulationAssembly(row);
              const isDuplicate = duplicateAssemblyIds.has(row.id);
              const facingNeedsReview = insulationBattFacingNeedsReview(
                materialType,
                row.battFacing
              );
              const pricing = rowPricingById.get(row.id);
              return (
                <View
                  key={row.id}
                  style={{
                    marginTop: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isExpanded
                      ? 'rgba(52,211,153,0.55)'
                      : isDuplicate
                        ? 'rgba(245,158,11,0.55)'
                        : isIncomplete
                          ? 'rgba(245,158,11,0.35)'
                          : darkMode
                            ? 'rgba(255,255,255,0.12)'
                            : Colors.line,
                    backgroundColor: isExpanded
                      ? darkMode
                        ? 'rgba(52,211,153,0.035)'
                        : 'rgba(16,185,129,0.035)'
                      : darkMode
                        ? '#252527'
                        : Colors.surface2,
                    overflow: 'hidden',
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedAssemblyId(isExpanded ? null : row.id)
                    }
                    activeOpacity={0.75}
                    style={{
                      minHeight: 46,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text
                        style={{
                          color: Colors.text,
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        {insulationAssemblyRowTitle(row, materialType)}
                      </Text>
                      <Text
                        style={{
                          color: captionColor(darkMode, Colors),
                          fontSize: 10,
                          marginTop: 2,
                        }}
                      >
                        {area
                          ? pricing
                            ? `${formatDraftMoney(pricing.installedRate)}/SF · ${area} sqft${needsConfirmation ? ' · confirm' : ''}`
                            : `${area} sqft${needsConfirmation ? ' · confirm' : ''}`
                          : 'Square feet needed'}
                        {isDuplicate ? ' · possible duplicate' : ''}
                        {facingNeedsReview ? ' · review facing before bid' : ''}
                        {isIncomplete && !isDuplicate ? ' · setup needed' : ''}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {pricing ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={{
                              color: '#34d399',
                              fontSize: 11,
                              fontWeight: '800',
                            }}
                          >
                            {formatDraftMoney(pricing.total)}
                          </Text>
                          <Text
                            style={{
                              color: captionColor(darkMode, Colors),
                              fontSize: 9,
                              marginTop: 1,
                            }}
                          >
                            {formatDraftMoney(pricing.material)} mat +{' '}
                            {formatDraftMoney(pricing.labor)} lab
                          </Text>
                        </View>
                      ) : null}
                      <Text
                      style={{
                        color: isExpanded
                          ? '#34d399'
                          : captionColor(darkMode, Colors),
                        fontSize: 16,
                        fontWeight: '400',
                        lineHeight: 18,
                      }}
                    >
                      {isExpanded ? '⌃' : '⌄'}
                    </Text>
                    </View>
                  </TouchableOpacity>
                  {isExpanded ? (
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingTop: 2,
                        paddingBottom: 9,
                      }}
                    >
                      {pricing ? (
                        <View
                          style={{
                            marginBottom: 8,
                            paddingHorizontal: 9,
                            paddingVertical: 7,
                            borderRadius: 8,
                            backgroundColor: darkMode
                              ? 'rgba(52,211,153,0.08)'
                              : 'rgba(16,185,129,0.08)',
                            borderWidth: 1,
                            borderColor: 'rgba(52,211,153,0.22)',
                          }}
                        >
                          <Text
                            style={{
                              color: '#34d399',
                              fontSize: 10,
                              fontWeight: '800',
                            }}
                          >
                            {assemblyPlanningRateLabel}{' '}
                            {formatDraftMoney(pricing.total)}
                          </Text>
                          <Text
                            style={{
                              color: captionColor(darkMode, Colors),
                              fontSize: 10,
                              marginTop: 2,
                              lineHeight: 14,
                            }}
                          >
                            {assemblyPlanningRateLabel} ·{' '}
                            {formatDraftMoney(pricing.installedRate)}/SF installed
                            · {formatDraftMoney(pricing.material)} material +{' '}
                            {formatDraftMoney(pricing.labor)} labor
                          </Text>
                        </View>
                      ) : null}
                      {needsConfirmation ? (
                        <TouchableOpacity
                          onPress={() =>
                            updateRow(row.id, {
                              source: 'contractor_entered',
                              confirmed: true,
                            })
                          }
                          activeOpacity={0.75}
                          style={{
                            alignSelf: 'flex-start',
                            marginBottom: 8,
                            paddingHorizontal: 9,
                            paddingVertical: 6,
                            borderRadius: 7,
                            backgroundColor: 'rgba(245,158,11,0.13)',
                            borderWidth: 1,
                            borderColor: 'rgba(245,158,11,0.45)',
                          }}
                        >
                          <Text
                            style={{
                              color: '#fbbf24',
                              fontSize: 10,
                              fontWeight: '800',
                            }}
                          >
                            Use {area || 'this'} sqft
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {isDuplicate ? (
                        <Text
                          style={{
                            color: '#fbbf24',
                            fontSize: 10,
                            marginBottom: 8,
                            lineHeight: 14,
                          }}
                        >
                          Another assembly matches this type, location, and
                          R-value. Review before pricing to avoid
                          double-counting.
                        </Text>
                      ) : null}
                      <Text
                        style={{
                          color: captionColor(darkMode, Colors),
                          fontSize: 10,
                          fontWeight: '700',
                          marginBottom: 5,
                          letterSpacing: 0.35,
                        }}
                      >
                        Target R-value
                      </Text>
                      {renderRValueOptions(row)}
                      {!supportedInsulationRValues(row.materialType, row.location)
                        .length ? (
                        <Text
                          style={{
                            color: captionColor(darkMode, Colors),
                            fontSize: 10,
                            marginTop: 2,
                          }}
                        >
                          No compatible R-values for this material and location.
                        </Text>
                      ) : null}
                      {isBattInsulationMaterial(materialType) ? (
                        <>
                          <Text
                            style={{
                              color: captionColor(darkMode, Colors),
                              fontSize: 10,
                              fontWeight: '700',
                              marginTop: 10,
                              marginBottom: 5,
                              letterSpacing: 0.35,
                            }}
                          >
                            Batt facing
                          </Text>
                          {renderBattFacingOptions(row)}
                          {facingNeedsReview ? (
                            <Text
                              style={{
                                color: '#60a5fa',
                                fontSize: 10,
                                marginTop: 6,
                                lineHeight: 14,
                              }}
                            >
                              Priced at unfaced rate. Review before bid if plans
                              specify kraft or foil facing.
                            </Text>
                          ) : null}
                        </>
                      ) : null}
                      <Text
                        style={{
                          color: captionColor(darkMode, Colors),
                          fontSize: 10,
                          fontWeight: '700',
                          marginTop: 10,
                          marginBottom: 5,
                          letterSpacing: 0.35,
                        }}
                      >
                        Assembly location
                      </Text>
                      {renderLocationOptions(row)}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: captionColor(darkMode, Colors),
                            fontSize: 11,
                          }}
                        >
                          Square feet
                        </Text>
                        <View
                          style={{
                            width: 132,
                            height: 36,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: area
                              ? 'rgba(52,211,153,0.65)'
                              : darkMode
                                ? 'rgba(255,255,255,0.14)'
                                : Colors.line,
                            backgroundColor: 'transparent',
                          }}
                        >
                          <TextInput
                            value={String(row.sqft ?? '')}
                            onChangeText={sqft => updateRow(row.id, { sqft })}
                            keyboardType='decimal-pad'
                            placeholder='Enter'
                            placeholderTextColor={captionColor(
                              darkMode,
                              Colors
                            )}
                            {...nativeNumericKeyboardProps}
                            style={{
                              flex: 1,
                              color: Colors.text,
                              paddingHorizontal: 9,
                              paddingVertical: 4,
                              fontSize: 14,
                              fontWeight: '600',
                            }}
                          />
                          <Text
                            style={{
                              color: captionColor(darkMode, Colors),
                              fontSize: 10,
                              fontWeight: '700',
                              paddingRight: 8,
                            }}
                          >
                            sqft
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 8,
                          marginTop: 12,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => deleteAssemblyRow(row.id)}
                          activeOpacity={0.75}
                          style={{
                            flex: 1,
                            minHeight: 36,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: 'rgba(239,68,68,0.55)',
                            backgroundColor: 'rgba(239,68,68,0.1)',
                          }}
                        >
                          <Text
                            style={{
                              color: '#f87171',
                              fontSize: 12,
                              fontWeight: '800',
                            }}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            Keyboard.dismiss();
                            setExpandedAssemblyId(null);
                          }}
                          activeOpacity={0.75}
                          style={{
                            flex: 1,
                            minHeight: 36,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: 'rgba(52,211,153,0.55)',
                            backgroundColor: 'rgba(52,211,153,0.14)',
                          }}
                        >
                          <Text
                            style={{
                              color: '#34d399',
                              fontSize: 12,
                              fontWeight: '800',
                            }}
                          >
                            Done
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
            <TouchableOpacity
              onPress={() => addAssemblyRow(materialType)}
              activeOpacity={0.75}
              style={{
                alignSelf: 'flex-start',
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: darkMode
                  ? 'rgba(255,255,255,0.14)'
                  : Colors.line,
                backgroundColor: darkMode ? '#252527' : Colors.surface2,
              }}
            >
              <Text
                style={{
                  color: Colors.text,
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                + Add {materialType} assembly
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          fontWeight: '700',
          marginTop: 14,
          marginBottom: 5,
          textAlign: 'center',
          letterSpacing: 0.35,
        }}
      >
        Garage inclusion
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {GARAGE_INSULATION_OPTIONS.map(option => {
          const selected =
            String(measurements.garageInsulationIncluded || '').toLowerCase() ===
            option.toLowerCase();
          return (
            <TouchableOpacity
              key={option}
              onPress={() =>
                onChange(
                  'garageInsulationIncluded',
                  selected ? '' : option
                )
              }
              activeOpacity={0.75}
              style={{
                flex: 1,
                minWidth: 88,
                alignItems: 'center',
                paddingVertical: 9,
                paddingHorizontal: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: selected
                  ? '#34d399'
                  : darkMode
                    ? 'rgba(255,255,255,0.14)'
                    : Colors.line,
                backgroundColor: selected
                  ? 'rgba(52,211,153,0.14)'
                  : darkMode
                    ? '#252527'
                    : Colors.surface2,
              }}
            >
              <Text
                style={{
                  color: selected ? '#34d399' : Colors.text,
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function CollapsibleQuickMeasurements({
  visible,
  expanded,
  onToggle,
  onDone,
  onFlooringBottomCollapse,
  onFloorPrepCollapse,
  scrollRef,
  scrollContentRef,
  containerRef,
  measurements,
  setMeasurements,
  templateKey,
  projectType,
  notes,
  includedScopeKeys,
  onSummaryChange,
  onWetAreaFinishChange,
  onWetAreaSteppersChange,
  onWetAreaExistingDemoChange,
  onKitchenQmChange,
  onFlooringQmChange,
  onFlooringScopeSync,
  onBathroomFixturesQmChange,
  onBathroomCountertopMaterialChange,
  onShowerDoorCountChange,
  onGarageDoorCountsChange,
  wetAreaInstallChoiceId,
  showExistingWetAreaPanel = true,
  hasSitePhotos = false,
  singleTradeImport = false,
  tradeKey = null,
  notesTradeFlow = false,
  notesScopeSelectorVisible = false,
  notesTradeMode = 'whole_project',
  onNotesTradeModeChange,
  onHvacScopeSelectionChange,
  Colors,
  darkMode,
  applying,
  electricalQuantityEditingRef,
  electricalAttributesCommitRef,
  onElectricalAttributesPreview,
}: {
  visible: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Collapse Quick Measurements and settle on Plans / first precon card. */
  onDone?: () => void;
  /** Preserve the outer Confirm Scope position after a flooring card collapses. */
  onFlooringBottomCollapse?: () => void;
  onFloorPrepCollapse?: () => void;
  scrollRef?: React.RefObject<ScrollView | null>;
  scrollContentRef?: React.RefObject<View | null>;
  containerRef?: React.Ref<View>;
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<
    React.SetStateAction<ScopeMeasurementsInputExtended>
  >;
  templateKey?: string;
  projectType?: string | null;
  notes?: string | null;
  includedScopeKeys: string[];
  onSummaryChange?: (summary: QuickMeasurementSummary) => void;
  /** Keep checklist wet_area_install in sync when the QM finish chip changes. */
  onWetAreaFinishChange?: (finish: WetAreaFinishChoice | null) => void;
  /** Bathroom photo jobs — sync wet area + derived scope from stepper counts. */
  onWetAreaSteppersChange?: (
    counts: WetAreaStepperCounts,
    options?: { keepingExisting?: boolean }
  ) => void;
  /** Bathroom photo jobs — sync existing condition + demo tear-out to scope checklist. */
  onWetAreaExistingDemoChange?: (params: {
    existing: WetAreaExistingCounts;
    demo: WetAreaDemoCounts;
    reuseExistingShowerDoor?: boolean;
    demoOverrides?: Partial<Record<WetAreaDemoOverrideKey, boolean>>;
  }) => void;
  /** Kitchen photo/notes jobs — sync install + demo scope from QM steppers. */
  onKitchenQmChange?: (params: {
    existing: import('@/utils/qmScopePanels/kitchenRemodel').KitchenExistingCounts;
    install: import('@/utils/qmScopePanels/kitchenRemodel').KitchenInstallCounts;
    demo: import('@/utils/qmScopePanels/kitchenRemodel').KitchenDemoCounts;
  }) => void;
  /** Flooring photo/notes jobs — sync install + demo scope from QM steppers. */
  onFlooringQmChange?: (params: {
    existing: import('@/utils/qmScopePanels/flooringRemodel').FlooringExistingCounts;
    install: import('@/utils/qmScopePanels/flooringRemodel').FlooringInstallCounts;
    demo: import('@/utils/qmScopePanels/flooringRemodel').FlooringDemoCounts;
  }) => void;
  /** Flooring photo/notes jobs — sync product install cards from full QM measurements. */
  onFlooringScopeSync?: (measurements: Record<string, unknown>) => void;
  /** Stucco trade — sync scope cards when a measurement field is committed. */
  /** Keep checklist wet_area_install in sync when the QM finish chip changes. */
  onFlooringBottomCollapse?: () => void;
  /** Bathroom photo/notes jobs — sync vanity install + demo from QM steppers. */
  onBathroomFixturesQmChange?: (params: {
    existing: import('@/utils/qmScopePanels/bathroomFixtures').BathroomExistingFixtureCounts;
    install: import('@/utils/qmScopePanels/bathroomFixtures').BathroomInstallFixtureCounts;
    demo: import('@/utils/qmScopePanels/bathroomFixtures').BathroomDemoFixtureCounts;
  }) => void;
  onBathroomCountertopMaterialChange?: (
    materialType:
      | import('@/utils/bathroomVanityCountertopPricing').BathroomVanityCountertopMaterialType
      | null
  ) => void;
  /** Keep checklist glass_door in sync when Wet area finish door count changes. */
  onShowerDoorCountChange?: (count: number | null) => void;
  /** Keep checklist garage_doors in sync when QM type counts change. */
  onGarageDoorCountsChange?: (totalCount: number | null) => void;
  /** Sync "Keeping existing" highlight when scope was saved as staying. */
  wetAreaInstallChoiceId?: string | null;
  /** Notes-only bathroom jobs — show manual existing-condition steppers. Hidden when site photos seed existing. */
  showExistingWetAreaPanel?: boolean;
  /** Site photos attached — existing condition is AI-seeded for demo inference. */
  hasSitePhotos?: boolean;
  /** Single-trade plan import — show only trade-relevant quick measurements. */
  singleTradeImport?: boolean;
  tradeKey?: import('@/utils/planImportTradeConfig').PlanTradeKey | null;
  /** Notes-only Plumbing routing selected inside Quick Measurements. */
  notesTradeFlow?: boolean;
  notesScopeSelectorVisible?: boolean;
  notesTradeMode?: NotesScopeMode;
  onNotesTradeModeChange?: (mode: NotesScopeMode) => void;
  /** Sync HVAC Quick Measurement selections into Step 3 scope cards. */
  onHvacScopeSelectionChange?: (measurements: Record<string, unknown>) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
  /** While true, defer Electrical scope-card sync so quantity inputs keep focus. */
  electricalQuantityEditingRef?: React.RefObject<boolean>;
  /** Commit local Electrical attribute chips before leaving Confirm Scope. */
  electricalAttributesCommitRef?: React.MutableRefObject<(() => void) | null>;
  /** Preview local Electrical attributes in pricing cards before commit. */
  onElectricalAttributesPreview?: (
    attributes: ReturnType<
      typeof electricalConfirmScopeAttributesFromMeasurements
    >
  ) => void;
}) {
  const [moreExpanded, setMoreExpanded] = useState(true);
  const [openDetailsKey, setOpenDetailsKey] =
    useState<QuickMeasurementFieldKey | null>(null);
  const [editingFieldKey, setEditingFieldKey] =
    useState<QuickMeasurementFieldKey | null>(null);
  const [editingHomeGroup, setEditingHomeGroup] =
    useState<QuickMeasurementGroupId | null>(null);
  const [editingHomeIndex, setEditingHomeIndex] = useState<number | null>(null);
  const [editingVariant, setEditingVariant] = useState<
    'calm' | 'needs_confirmation' | 'suggestion' | 'more' | null
  >(null);
  const [typedMoreMeasurementKeys, setTypedMoreMeasurementKeys] = useState<
    QuickMeasurementFieldKey[]
  >([]);
  const [typedMoreMeasurementPositions, setTypedMoreMeasurementPositions] =
    useState<Partial<Record<QuickMeasurementFieldKey, number>>>({});
  const [typedMeasurementHomes, setTypedMeasurementHomes] = useState<
    Partial<
      Record<
        QuickMeasurementFieldKey,
        { homeGroup: QuickMeasurementGroupId; homeIndex: number }
      >
    >
  >({});
  const wasVisibleRef = useRef(visible);
  useEffect(() => {
    if (!visible && wasVisibleRef.current) {
      setTypedMoreMeasurementKeys([]);
      setTypedMoreMeasurementPositions({});
      setTypedMeasurementHomes({});
    }
    wasVisibleRef.current = visible;
  }, [visible]);
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, PlanConflictChoice | undefined>
  >({});
  const [conflictManualValues, setConflictManualValues] = useState<
    Record<string, string>
  >({});
  const [resolvedConflictFields, setResolvedConflictFields] = useState<
    string[]
  >([]);
  const originalConflictsRef = useRef<Record<string, PlanMeasurementConflict>>(
    {}
  );
  const paintInputRef = useRef({ wall: '', ceiling: '', primed: false });
  const lastPaintSplitRef = useRef({ wall: '', ceiling: '' });
  const isElectricalQmTemplate =
    String(templateKey || '').toLowerCase() === 'electrical';
  const [
    electricalQuantityTakeoffMounted,
    setElectricalQuantityTakeoffMounted,
  ] = useState(!isElectricalQmTemplate);
  useEffect(() => {
    if (!isElectricalQmTemplate) {
      setElectricalQuantityTakeoffMounted(true);
      return;
    }
    if (!expanded) return;
    if (electricalQuantityTakeoffMounted) return;
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) setElectricalQuantityTakeoffMounted(true);
    });
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [isElectricalQmTemplate, expanded, electricalQuantityTakeoffMounted]);
  useEffect(() => {
    if (!isElectricalQmTemplate) return;
    setElectricalQuantityTakeoffMounted(false);
  }, [isElectricalQmTemplate, templateKey]);
  useEffect(() => {
    const wall = String(measurements.wallPaintSqft || '');
    const ceiling = String(measurements.ceilingPaintSqft || '');
    if (Number(wall) > 0 || Number(ceiling) > 0) {
      lastPaintSplitRef.current = { wall, ceiling };
    }
    if (!paintInputRef.current.primed) {
      paintInputRef.current = { wall, ceiling, primed: true };
      return;
    }
    const changed =
      paintInputRef.current.wall !== wall ||
      paintInputRef.current.ceiling !== ceiling;
    if (
      changed &&
      measurements.paintPricingMethod === 'combined' &&
      (Number(wall) > 0 || Number(ceiling) > 0)
    ) {
      setMeasurements(prev => {
        const itemQuantities = { ...(prev.itemQuantities || {}) };
        delete itemQuantities.interior_paint;
        delete itemQuantities.prep;
        return {
          ...prev,
          paintPricingMethod: 'separate',
          paintAreaNeedsConfirmation: false,
          itemQuantities,
        };
      });
    }
    paintInputRef.current = { wall, ceiling, primed: true };
  }, [
    measurements.wallPaintSqft,
    measurements.ceilingPaintSqft,
    measurements.paintPricingMethod,
    setMeasurements,
  ]);
  useEffect(() => {
    const bothWallsAndCeilings =
      Boolean(measurements.paintScope?.includes('walls')) &&
      Boolean(measurements.paintScope?.includes('ceilings'));
    if (!bothWallsAndCeilings || measurements.paintPricingMethod) return;
    setMeasurements(prev => {
      const stillBoth =
        Boolean(prev.paintScope?.includes('walls')) &&
        Boolean(prev.paintScope?.includes('ceilings'));
      if (!stillBoth || prev.paintPricingMethod) return prev;
      return { ...prev, paintPricingMethod: 'combined' };
    });
  }, [
    measurements.paintScope,
    measurements.paintPricingMethod,
    setMeasurements,
  ]);
  useEffect(() => {
    if (measurements.cabinetMeasurementMethod !== 'linear_feet') return;
    const upper = Number(measurements.cabinetUpperLf || 0);
    const lower = Number(measurements.cabinetLowerLf || 0);
    const tall = Number(measurements.cabinetTallLf || 0);
    const detailTotal = upper + lower + tall;
    if (
      detailTotal <= 0 ||
      String(measurements.cabinetRunLf || '') === String(detailTotal)
    )
      return;
    setMeasurements(prev => ({ ...prev, cabinetRunLf: String(detailTotal) }));
  }, [
    measurements.cabinetMeasurementMethod,
    measurements.cabinetUpperLf,
    measurements.cabinetLowerLf,
    measurements.cabinetTallLf,
    measurements.cabinetRunLf,
    setMeasurements,
  ]);
  const editingFieldKeyRef = useRef<QuickMeasurementFieldKey | null>(null);
  const editingEstimateRef = useRef<QuickMeasurementEstimate | null>(null);
  const editingPinActiveRef = useRef(false);
  const [keepingExistingWetArea, setKeepingExistingWetArea] = useState(
    () => wetAreaInstallChoiceId === 'staying'
  );
  useEffect(() => {
    setKeepingExistingWetArea(wetAreaInstallChoiceId === 'staying');
  }, [wetAreaInstallChoiceId]);
  const editingHomeRef = useRef<{
    homeGroup: QuickMeasurementGroupId | null;
    homeIndex: number | null;
    variant: 'calm' | 'needs_confirmation' | 'suggestion' | 'more' | null;
  }>({ homeGroup: null, homeIndex: null, variant: null });
  const stuccoTradeFlow = useMemo(
    () => String(templateKey || '').toLowerCase() === 'stucco',
    [templateKey]
  );
  const effectiveTemplateKey = useMemo(() => {
    const living =
      Number(String(measurements.floorAreaSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.mainFloorLivingSqft) ||
      null;
    const garage =
      Number(String(measurements.garageSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.garageSqft) ||
      null;
    if (stuccoTradeFlow) return 'stucco';
    return resolveEffectiveQuickMeasurementTemplateKey({
      templateKey,
      projectType,
      planRoomCount: Array.isArray(measurements.planRooms)
        ? measurements.planRooms.length
        : 0,
      livingSf: living,
      garageSf: garage,
    });
  }, [
    templateKey,
    projectType,
    measurements.floorAreaSqft,
    measurements.garageSqft,
    measurements.planRooms,
    measurements.planFacts,
    stuccoTradeFlow,
  ]);
  const wholeHomeLayout =
    !singleTradeImport &&
    !stuccoTradeFlow &&
    isWholeHomeQuickMeasurementTemplate(effectiveTemplateKey);
  const quickMeasurementTemplateKey = stuccoTradeFlow
    ? 'stucco'
    : notesTradeFlow && tradeKey === 'plumbing'
      ? notesTradeMode === 'plumbing_service'
        ? 'plumbing_service'
        : 'plumbing'
      : singleTradeImport && tradeKey
        ? String(tradeKey)
        : effectiveTemplateKey;

  const mepLaborComplexityMultiplier = useMemo(() => {
    const isPlumbingQm =
      (singleTradeImport && tradeKey === 'plumbing') ||
      ['plumbing', 'plumbing_service'].includes(
        String(quickMeasurementTemplateKey || '').toLowerCase()
      );
    const isElectricalQm =
      (singleTradeImport && tradeKey === 'electrical') ||
      String(quickMeasurementTemplateKey || '').toLowerCase() === 'electrical';
    if (
      (!isPlumbingQm || measurements.plumbingWorkflowMode === 'service') &&
      !isElectricalQm
    ) {
      return 1;
    }
    const complexityContext = {
      floorAreaSqft: measurements.floorAreaSqft,
      storyCount: measurements.storyCount,
      planFacts: measurements.planFacts,
      projectComplexity: measurements.projectComplexity,
      plumbingComplexityFactors: measurements.plumbingComplexityFactors,
      planImportMode: measurements.planImportMode,
      planImportTradeKey: measurements.planImportTradeKey,
      planImportFingerprint: measurements.planImportFingerprint,
      quickMeasurementSources: measurements.quickMeasurementSources,
      quickMeasurementUserOverrides: measurements.quickMeasurementUserOverrides,
    };
    const settings = inferProjectComplexitySettings({
      ...complexityContext,
      allowPlanFactsFallback:
        hasPlanProjectComplexityContext(complexityContext),
    });
    const multiplier =
      calculateProjectComplexityMultiplier(settings).totalMultiplier;
    return multiplier > 1 ? multiplier : 1;
  }, [
    singleTradeImport,
    tradeKey,
    quickMeasurementTemplateKey,
    measurements.plumbingWorkflowMode,
    measurements.floorAreaSqft,
    measurements.storyCount,
    measurements.planFacts,
    measurements.projectComplexity,
    measurements.plumbingComplexityFactors,
    measurements.planImportMode,
    measurements.planImportTradeKey,
    measurements.planImportFingerprint,
    measurements.quickMeasurementSources,
    measurements.quickMeasurementUserOverrides,
  ]);

  const noteQuickMeasurements = useMemo(() => {
    if (singleTradeImport || stuccoTradeFlow) {
      return { values: {}, keys: [] as QuickMeasurementFieldKey[] };
    }
    const parsed = parseScopeMeasurementsFromNotes(notes || '', {
      templateKey: quickMeasurementTemplateKey,
      projectType: projectType ?? undefined,
    });
    const out: Partial<Record<QuickMeasurementFieldKey, string>> = {};
    const noteKeys: QuickMeasurementFieldKey[] = [];
    const put = (key: QuickMeasurementFieldKey, value: unknown) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return;
      out[key] = String(n);
      noteKeys.push(key);
    };

    put('bathroomFloorSqft', parsed.bathroomFloorSqft);
    put('kitchenFloorSqft', parsed.kitchenFloorSqft);
    put('floorAreaSqft', parsed.floorAreaSqft);
    put('storyCount', parsed.storyCount);
    put('backsplashSqft', parsed.backsplashSqft);
    put('countertopSqft', parsed.countertopSqft);
    put('cabinetLf', parsed.cabinetLf);
    put('showerWallTileSqft', parsed.showerWallTileSqft);
    put('showerFloorTileSqft', parsed.showerFloorTileSqft);
    put('wallPaintSqft', parsed.wallPaintSqft);
    put('ceilingPaintSqft', parsed.ceilingPaintSqft);
    put('paintAreaSqft', parsed.paintAreaSqft);
    put('exteriorPaintSqft', parsed.exteriorPaintSqft);
    put('baseboardLf', parsed.baseboardLf);
    put('interiorDoorCount', parsed.interiorDoorCount);
    put('windowCount', parsed.windowCount);
    put('exteriorDoorCount', parsed.exteriorDoorCount);
    put('slidingDoorCount', parsed.slidingDoorCount);
    put('garageDoorSingleCount', parsed.garageDoorSingleCount);
    put('garageDoorDoubleCount', parsed.garageDoorDoubleCount);
    put('garageDoorRvCount', parsed.garageDoorRvCount);
    if (parsed.reframingRequested) {
      put('framingOpeningCount', parsed.framingOpeningCount);
    }
    put('cabinetPaintSqft', parsed.cabinetPaintSqft);
    put('cabinetRunLf', parsed.cabinetRunLf);
    put('railingLf', parsed.railingLf);
    put('landscapeSqft', parsed.landscapeSqft);
    put('sodSqft', parsed.sodSqft);
    put('paverSqft', parsed.paverSqft);
    put('rockMulchSqft', parsed.rockMulchSqft);
    put('landscapeTons', parsed.landscapeTons);
    put('roofSquares', parsed.roofSquares);
    put('drywallSqft', parsed.drywallSqft);
    put('exteriorWallInsulationSqft', parsed.exteriorWallInsulationSqft);
    put('atticInsulationSqft', parsed.atticInsulationSqft);
    put('insulatedRoofDeckSqft', parsed.insulatedRoofDeckSqft);
    put('floorInsulationSqft', parsed.floorInsulationSqft);
    put(
      'garageSeparationInsulationSqft',
      parsed.garageSeparationInsulationSqft
    );
    put('insulatedGarageWallSqft', parsed.insulatedGarageWallSqft);
    put('insulatedGarageCeilingSqft', parsed.insulatedGarageCeilingSqft);
    put('openingDeductionSqft', parsed.openingDeductionSqft);
    put('insulationMaterialType', parsed.insulationMaterialType);
    put('insulationRValue', parsed.insulationRValue);
    put('garageInsulationIncluded', parsed.garageInsulationIncluded);
    put('flooringSqft', parsed.flooringSqft);
    put('flooringLvpSqft', parsed.flooringLvpSqft);
    put('flooringLaminateSqft', parsed.flooringLaminateSqft);
    put(
      'flooringEngineeredHardwoodSqft',
      parsed.flooringEngineeredHardwoodSqft
    );
    put('flooringSolidHardwoodSqft', parsed.flooringSolidHardwoodSqft);
    put('flooringTileSqft', parsed.flooringTileSqft);
    put('flooringCarpetSqft', parsed.flooringCarpetSqft);
    put('floorDemoSqft', parsed.floorDemoSqft);
    put('floorPrepSqft', parsed.floorPrepSqft);
    put('floorPrepSqft', parsed.floorPrepSqft);
    put('underlaymentSqft', parsed.underlaymentSqft);
    put('moistureBarrierSqft', parsed.moistureBarrierSqft);
    put('transitionLf', parsed.transitionLf);
    put('transitionCount', parsed.transitionCount);
    put('quarterRoundLf', parsed.quarterRoundLf);
    put('concreteSqft', parsed.concreteSqft);
    put('concreteDemoSqft', parsed.concreteDemoSqft);
    put('concreteCy', parsed.concreteCy);
    put('excavationCy', parsed.excavationCy);
    put('deckSqft', parsed.deckSqft);
    put('garageSqft', parsed.garageSqft);
    put('hvacSystemCount', parsed.hvacSystemCount);
    put('hvacSystemTons', parsed.hvacSystemTons);
    put('hvacServiceCallCount', parsed.hvacServiceCallCount);
    put(
      'hvacEquipmentReplacementCount',
      parsed.hvacEquipmentReplacementCount
    );
    put('hvacRefrigerantCount', parsed.hvacRefrigerantCount);
    put('hvacThermostatCount', parsed.hvacThermostatCount);
    put('hvacDuctworkLf', parsed.hvacDuctworkLf);
    put('hvacVentilationCount', parsed.hvacVentilationCount);
    put('hvacPermitCount', parsed.hvacPermitCount);
    put('hvacCleanupCount', parsed.hvacCleanupCount);

    return { values: out, keys: noteKeys };
  }, [
    notes,
    effectiveTemplateKey,
    quickMeasurementTemplateKey,
    projectType,
    stuccoTradeFlow,
  ]);
  const rows = useMemo(() => {
    const baseRows = quickMeasurementRowsForInput(
      quickMeasurementTemplateKey,
      projectType,
      measurements,
      noteQuickMeasurements.keys,
      {
        plumbingPlanImport: singleTradeImport && tradeKey === 'plumbing',
        windowsDoorsPlanImport:
          singleTradeImport && tradeKey === 'windows_doors',
        garageDoorsPlanImport:
          singleTradeImport && tradeKey === 'garage_doors',
        windowsDoorsNotesFlow:
          !singleTradeImport && quickMeasurementTemplateKey === 'windows_doors',
        plumbingNotesFlow:
          notesTradeFlow ||
          (!singleTradeImport &&
            ['plumbing', 'plumbing_service'].includes(
              String(effectiveTemplateKey || '').toLowerCase()
            )),
        plumbingWorkflowMode: measurements.plumbingWorkflowMode,
      }
    );
    if (singleTradeImport) {
      const allowed = new Set<QuickMeasurementFieldKey>(
        tradeQuickMeasurementFieldKeys(tradeKey) as QuickMeasurementFieldKey[]
      );
      const filteredRows = baseRows
        .map(row => row.filter(field => allowed.has(field.key)))
        .filter(row => row.length > 0);
        if (tradeKey === 'insulation') {
          return filteredRows
            .map(row =>
              row.filter(
                field =>
                  field.key !== 'insulationMaterialType' &&
                  field.key !== 'insulationRValue' &&
                  field.key !== 'garageInsulationIncluded'
              )
            )
            .filter(row => row.length > 0);
        }
      if (
        tradeKey === 'framing' &&
        shellPackageIncludesSheathing(measurements as Record<string, unknown>)
      ) {
        return filteredRows
          .map(row =>
            row.filter(
              field =>
                field.key !== 'wallFramingLf' &&
                field.key !== 'framingOpeningCount'
            )
          )
          .filter(row => row.length > 0);
      }
      return filteredRows;
    }
    if (
      String(effectiveTemplateKey || '').toLowerCase() === 'framing' &&
      shellPackageIncludesSheathing(measurements as Record<string, unknown>)
    ) {
      return baseRows
        .map(row =>
          row.filter(
            field =>
              field.key !== 'wallFramingLf' &&
              field.key !== 'framingOpeningCount'
          )
        )
        .filter(row => row.length > 0);
    }
    if (String(effectiveTemplateKey || '').toLowerCase() === 'flooring') {
      const selected = new Set(includedScopeKeys);
      const selectedProductScope = new Set(
        measurements.flooringProductScope || []
      );
      const allowed = new Set<QuickMeasurementFieldKey>(['flooringSqft']);
      const flooringFields: Array<[string, QuickMeasurementFieldKey]> = [
        ['flooring_lvp', 'flooringLvpSqft'],
        ['flooring_laminate', 'flooringLaminateSqft'],
        ['flooring_engineered_hardwood', 'flooringEngineeredHardwoodSqft'],
        ['flooring_solid_hardwood', 'flooringSolidHardwoodSqft'],
        ['tile_flooring', 'flooringTileSqft'],
        ['flooring_carpet', 'flooringCarpetSqft'],
        ['floor_demo', 'floorDemoSqft'],
        ['floor_prep', 'floorPrepSqft'],
        ['floor_prep', 'floorPrepSqft'],
        ['underlayment', 'underlaymentSqft'],
        ['moisture_barrier', 'moistureBarrierSqft'],
        ['quarter_round', 'quarterRoundLf'],
        ['trim', 'baseboardLf'],
      ];
      for (const [itemId, fieldKey] of flooringFields) {
        const productKey =
          itemId === 'flooring_lvp'
            ? 'lvp'
            : itemId === 'flooring_laminate'
              ? 'laminate'
              : itemId === 'flooring_engineered_hardwood'
                ? 'engineered_hardwood'
                : itemId === 'flooring_solid_hardwood'
                  ? 'solid_hardwood'
                  : itemId === 'tile_flooring'
                    ? 'tile'
                    : itemId === 'flooring_carpet'
                      ? 'carpet'
                      : null;
        if (
          selected.has(itemId) ||
          (productKey && selectedProductScope.has(productKey))
        ) {
          allowed.add(fieldKey);
        }
      }
      return baseRows
        .map(row => row.filter(field => allowed.has(field.key)))
        .filter(row => row.length > 0);
    }
    if (
      String(effectiveTemplateKey || '').toLowerCase() !== 'painting' ||
      !measurements.paintScope
    ) {
      return baseRows;
    }
    const scope = measurements.paintScope;
    const bothWallsCeilings =
      scope.includes('walls') && scope.includes('ceilings');
    const allowed = new Set<QuickMeasurementFieldKey>();
    if (
      scope.includes('walls') &&
      (!bothWallsCeilings || measurements.paintPricingMethod === 'separate')
    ) {
      allowed.add('wallPaintSqft');
    }
    if (
      scope.includes('ceilings') &&
      (!bothWallsCeilings || measurements.paintPricingMethod === 'separate')
    ) {
      allowed.add('ceilingPaintSqft');
    }
    if (scope.includes('trim')) allowed.add('baseboardLf');
    if (scope.includes('doors')) allowed.add('interiorDoorCount');
    if (scope.includes('cabinets')) {
      const noteKeys = new Set(noteQuickMeasurements.keys);
      const hasCabinetSqft =
        noteKeys.has('cabinetPaintSqft') ||
        Number(String(measurements.cabinetPaintSqft || '').replace(/,/g, '')) >
          0;
      const hasCabinetLf =
        noteKeys.has('cabinetRunLf') ||
        Number(String(measurements.cabinetRunLf || '').replace(/,/g, '')) > 0;
      if (hasCabinetSqft) allowed.add('cabinetPaintSqft');
      if (hasCabinetLf || !hasCabinetSqft) allowed.add('cabinetRunLf');
    }
    if (scope.includes('exterior')) allowed.add('exteriorPaintSqft');
    if (bothWallsCeilings && measurements.paintPricingMethod !== 'separate')
      allowed.add('paintAreaSqft');
    return baseRows
      .map(row => row.filter(field => allowed.has(field.key)))
      .filter(row => row.length > 0);
  }, [
    effectiveTemplateKey,
    projectType,
    measurements,
    noteQuickMeasurements.keys,
    includedScopeKeys,
    singleTradeImport,
    tradeKey,
    notesTradeFlow,
    quickMeasurementTemplateKey,
    measurements.plumbingWorkflowMode,
  ]);
  const fillCounts = useMemo(
    () =>
      countFilledQuickMeasurements(
        rows,
        measurements,
        noteQuickMeasurements.values
      ),
    [rows, measurements, noteQuickMeasurements.values]
  );
  const noteKeySet = useMemo(
    () => new Set(noteQuickMeasurements.keys),
    [noteQuickMeasurements.keys]
  );
  const fieldByKey = useMemo(() => {
    const map = new Map<QuickMeasurementFieldKey, QuickMeasurementFieldDef>();
    for (const row of rows) {
      for (const field of row) map.set(field.key, field);
    }
    if (String(effectiveTemplateKey || '').toLowerCase() === 'painting') {
      for (const row of quickMeasurementRowsForTemplate('painting')) {
        for (const field of row) {
          if (!map.has(field.key)) map.set(field.key, field);
        }
      }
    }
    return map;
  }, [rows, effectiveTemplateKey]);

  const fieldResults = useMemo(() => {
    const resolved = resolveQuickMeasurementFields({
      rows,
      measurements,
      noteValues: noteQuickMeasurements.values,
      noteBackedKeys: noteQuickMeasurements.keys,
      sourceMap: measurements.quickMeasurementSources,
      userOverrides: measurements.quickMeasurementUserOverrides,
      measurementConflicts: measurements.measurementConflicts,
      includedScopeKeys,
      templateKey: quickMeasurementTemplateKey,
      wholeHomeLayout,
      keepingExistingWetArea,
      wetAreaInstallChoiceId,
    });
    return resolved.map(result =>
      result.key === 'floorPrepSqft' && editingFieldKey === 'floorPrepSqft'
        ? { ...result, state: 'needs_confirmation' as const }
        : result
    );
  }, [
    rows,
    measurements,
    noteQuickMeasurements.values,
    noteQuickMeasurements.keys,
    includedScopeKeys,
    effectiveTemplateKey,
    quickMeasurementTemplateKey,
    wholeHomeLayout,
    keepingExistingWetArea,
    wetAreaInstallChoiceId,
    editingFieldKey,
  ]);
  const physicalSections = useMemo(() => {
    if (!wholeHomeLayout) return [];
    const wetKeys = new Set<string>(WET_AREA_QUICK_MEASUREMENT_KEYS);
    return quickMeasurementSectionsForRows(rows)
      .map(section => ({
        ...section,
        rows: section.rows
          .map(row => row.filter(field => !wetKeys.has(field.key)))
          .filter(row => row.length > 0),
      }))
      .filter(section => section.rows.length > 0);
  }, [wholeHomeLayout, rows]);
  const resultByKey = useMemo(
    () => new Map(fieldResults.map(result => [result.key, result])),
    [fieldResults]
  );
  const bathRooms = useMemo(
    () => listBathPlanRooms(measurements.planRooms),
    [measurements.planRooms]
  );
  const bathCountFromPlan = bathRooms.length;
  const bathroomPhotoWetArea = isSplitTileWetAreaCounts({
    templateKey: effectiveTemplateKey,
    wholeHomeLayout,
  });
  const kitchenQmJob =
    !wholeHomeLayout &&
    String(effectiveTemplateKey || '').toLowerCase() === 'kitchen';
  const flooringQmJob =
    !wholeHomeLayout &&
    String(effectiveTemplateKey || '').toLowerCase() === 'flooring';
  const landscapingQmJob =
    !wholeHomeLayout &&
    String(effectiveTemplateKey || '').toLowerCase() === 'landscaping';
  const concreteQmJob =
    !wholeHomeLayout &&
    String(effectiveTemplateKey || '').toLowerCase() === 'concrete';
  const deckQmJob =
    !wholeHomeLayout &&
    String(effectiveTemplateKey || '').toLowerCase() === 'deck_patio';
  const hvacQmJob =
    !wholeHomeLayout &&
    String(effectiveTemplateKey || '').toLowerCase() === 'hvac';
  const windowsDoorsPlanImport =
    (singleTradeImport && tradeKey === 'windows_doors') ||
    String(effectiveTemplateKey || '').toLowerCase() === 'windows_doors';
  const roofingQmJob =
    !wholeHomeLayout &&
    String(effectiveTemplateKey || '').toLowerCase() === 'roofing';
  const stuccoQmJob =
    !wholeHomeLayout &&
    (String(effectiveTemplateKey || '').toLowerCase() === 'stucco' ||
      stuccoTradeFlow);
  const paintingQmJob =
    !wholeHomeLayout &&
    String(effectiveTemplateKey || '').toLowerCase() === 'painting';
  const bathroomFixturesQmJob =
    !notesTradeFlow &&
    !wholeHomeLayout &&
    String(effectiveTemplateKey || '').toLowerCase() === 'bathroom';
  const showWetAreaFinishSteppers = useMemo(() => {
    if (notesTradeFlow) return false;
    if (singleTradeImport) return false;
    if (
      shouldShowPlanWetAreaFinishSteppers({
        templateKey: effectiveTemplateKey,
        planBathRoomCount: bathCountFromPlan,
        wholeHomeLayout,
        bathroomPhotoJob: bathroomPhotoWetArea,
      })
    ) {
      if (bathroomPhotoWetArea) return true;
      const keys = new Set(
        fieldResults.filter(r => r.relevant).map(r => r.key)
      );
      return (
        keys.has('bathroomFloorSqft') ||
        keys.has('showerWallTileSqft') ||
        keys.has('showerFloorTileSqft') ||
        includedScopeKeys.some(id =>
          /shower|tile_flooring|interior_finishes|bathroom|bath_floor|waterproofing/i.test(
            id
          )
        )
      );
    }
    return false;
  }, [
    notesTradeFlow,
    effectiveTemplateKey,
    bathCountFromPlan,
    wholeHomeLayout,
    bathroomPhotoWetArea,
    fieldResults,
    includedScopeKeys,
  ]);
  const groups = useMemo(() => {
    let grouped = groupQuickMeasurementFields(fieldResults);
    // Keep optional fields in their More measurements home after typing.
    const keepInMore = new Set(typedMoreMeasurementKeys);
    // Pin on focus as well as after the first state update. Without this,
    // entering the first digit can briefly reclassify the field as Confirmed,
    // remounting the input and dismissing the native keyboard.
    if (editingFieldKey && editingHomeGroup === 'more') {
      keepInMore.add(editingFieldKey);
    }
    if (keepInMore.size) {
      const movedToMore: QuickMeasurementFieldResult[] = [];
      const next = {
        fromPlan: [...grouped.fromPlan],
        suggestions: [...grouped.suggestions],
        needsConfirmation: [...grouped.needsConfirmation],
        confirmed: [...grouped.confirmed],
        more: [...grouped.more],
      };
      (
        ['fromPlan', 'suggestions', 'needsConfirmation', 'confirmed'] as const
      ).forEach(groupId => {
        next[groupId] = next[groupId].filter(result => {
          if (!keepInMore.has(result.key)) return true;
          movedToMore.push(result);
          return false;
        });
      });
      next.more.push(...movedToMore);
      next.more.sort((a, b) => {
        const aPosition = typedMoreMeasurementPositions[a.key];
        const bPosition = typedMoreMeasurementPositions[b.key];
        if (aPosition == null && bPosition == null) return 0;
        if (aPosition == null) return 1;
        if (bPosition == null) return -1;
        return aPosition - bPosition;
      });
      grouped = next;
    }
    // Pin only after typing has moved a field out of its home section. Applying pin on
    // focus alone reorders Needs confirmation (pre-split indexes ≠ post-split indexes)
    // and makes the yellow inputs jump / remount when tapped. Keep the recorded home
    // position after blur too, so a user-edited field does not fall into Confirmed.
    const editingGroup =
      editingHomeGroup && Array.isArray(grouped[editingHomeGroup])
        ? grouped[editingHomeGroup]
        : null;
    const shouldPin =
      Boolean(editingFieldKey && editingGroup) &&
      !editingGroup!.some(result => result.key === editingFieldKey);
    const pinned = shouldPin
      ? pinQuickMeasurementFieldInGroup(
          grouped,
          editingFieldKey,
          editingHomeGroup,
          editingHomeIndex
        )
      : grouped;
    let positioned = pinned;
    for (const [key, home] of Object.entries(typedMeasurementHomes)) {
      if (!home) continue;
      positioned = pinQuickMeasurementFieldInGroup(
        positioned,
        key as QuickMeasurementFieldKey,
        home.homeGroup,
        home.homeIndex
      );
    }
    // Photo/notes bathroom jobs use wet-area steppers — shower SF lives in the wet area panel.
    if (!showWetAreaFinishSteppers)
      return { groups: positioned, wetArea: [] as typeof positioned.more };
    return splitWetAreaQuickMeasurementFields(positioned);
  }, [
    fieldResults,
    editingFieldKey,
    editingHomeGroup,
    editingHomeIndex,
    showWetAreaFinishSteppers,
    typedMoreMeasurementKeys,
    typedMoreMeasurementPositions,
    typedMeasurementHomes,
  ]);
  const displayGroups = groups.groups;
  const wetAreaFields = groups.wetArea;
  const summary = useMemo(
    () => summarizeQuickMeasurementFieldStates(fieldResults),
    [fieldResults]
  );
  const measurementConflicts = useMemo(
    () =>
      (measurements.measurementConflicts || []).filter(
        conflict =>
          !measurements.quickMeasurementUserOverrides?.[conflict.field] &&
          shouldConfirmScopeShowPlanConflict(conflict.field, {
            tradeKey,
            templateKey,
          })
      ),
    [
      measurements.measurementConflicts,
      measurements.quickMeasurementUserOverrides,
      tradeKey,
      templateKey,
    ]
  );
  const windowsDoorsSuppressedQuickMeasurementFields = useMemo(() => {
    if (!windowsDoorsPlanImport) return new Set<string>();
    return new Set(
      WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS.filter(key =>
        shouldSuppressPlanReviewQuickMeasurementField(key, measurements, {
          allowedFields: windowsDoorsPlanReviewFieldSet(),
          conflicts: measurementConflicts,
        })
      )
    );
  }, [windowsDoorsPlanImport, measurements, measurementConflicts]);
  for (const conflict of measurements.measurementConflicts || []) {
    const field = String(conflict?.field || '');
    if (field && !originalConflictsRef.current[field]) {
      originalConflictsRef.current[field] = conflict;
    }
  }
  const commitConflictQuantity = useCallback(
    (field: string, value: number, manual = false) => {
      startTransition(() => {
        setResolvedConflictFields(prev =>
          prev.includes(field) ? prev : [...prev, field]
        );
        setMeasurements(prev => {
          const conflict =
            (prev.measurementConflicts || []).find(
              row => row.field === field
            ) || originalConflictsRef.current[field];
          if (conflict?.field) {
            originalConflictsRef.current[field] = conflict;
          }
          const resolution = conflict
            ? buildConflictResolution(
                conflict,
                manual ? 'manual' : value,
                manual ? String(value) : undefined
              )
            : null;
          const next = applyElectricalQuickMeasurementPatch(prev, field, value);
          return {
            ...next,
            measurementConflicts: (prev.measurementConflicts || []).filter(
              row => row.field !== field
            ),
            measurementProvenance: {
              ...(prev.measurementProvenance || {}),
              ...(resolution
                ? { [field]: conflictResolutionProvenanceEntry(resolution) }
                : {}),
            },
          };
        });
      });
    },
    [setMeasurements]
  );
  const clearConflictQuantity = useCallback(
    (field: string) => {
      startTransition(() => {
        setResolvedConflictFields(prev => prev.filter(id => id !== field));
        setMeasurements(prev =>
          restorePlanMeasurementConflict(
            prev,
            field,
            originalConflictsRef.current[field]
          )
        );
      });
    },
    [setMeasurements]
  );

  const effectiveWetAreaFinish = useMemo(
    () =>
      resolveEffectiveWetAreaFinish({
        bathCount: measurements.bathCount,
        tilePanBathCount: measurements.tilePanBathCount,
        prefabBathCount: measurements.prefabBathCount,
        prefabEnclosureBathCount: measurements.prefabEnclosureBathCount,
        tubBathCount: measurements.tubBathCount,
        wetAreaFinish: measurements.wetAreaFinish,
        templateKey: effectiveTemplateKey,
        wholeHomeLayout,
      }),
    [
      measurements.bathCount,
      measurements.tilePanBathCount,
      measurements.prefabBathCount,
      measurements.prefabEnclosureBathCount,
      measurements.tubBathCount,
      measurements.wetAreaFinish,
      effectiveTemplateKey,
      wholeHomeLayout,
    ]
  );
  const resolvedBathCount = useMemo(
    () =>
      resolveBathCount({
        planRooms: measurements.planRooms,
        bathCount: measurements.bathCount,
        bathroomFloorSqft: measurements.bathroomFloorSqft,
      }),
    [
      measurements.planRooms,
      measurements.bathCount,
      measurements.bathroomFloorSqft,
    ]
  );

  const summarySentRef = useRef<QuickMeasurementSummary | null>(null);
  const summaryLiveRef = useRef(summary);
  summaryLiveRef.current = summary;
  const [qmInputFocused, setQmInputFocused] = useState(false);
  const frozenHeaderSummaryRef = useRef(summary);
  const handleQuantityEditFocus = useCallback(() => {
    frozenHeaderSummaryRef.current = summaryLiveRef.current;
    setQmInputFocused(true);
  }, []);
  const handleQuantityEditBlur = useCallback(() => {
    setQmInputFocused(false);
  }, []);
  const headerSummary = qmInputFocused
    ? frozenHeaderSummaryRef.current
    : summary;
  useEffect(() => {
    if (qmInputFocused) return;
    const prev = summarySentRef.current;
    if (
      prev &&
      prev.detected === summary.detected &&
      prev.estimateAvailable === summary.estimateAvailable &&
      prev.needsConfirmation === summary.needsConfirmation &&
      prev.confirmed === summary.confirmed &&
      prev.relevantTotal === summary.relevantTotal
    ) {
      return;
    }
    summarySentRef.current = summary;
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange, qmInputFocused]);

  const clampBathCount = (
    next: number | null,
    max = BATHROOM_QM_STEPPER_MAX
  ) =>
    next != null && Number.isFinite(next) && next > 0
      ? Math.min(max, Math.round(next))
      : null;

  // Optimistic stepper display so +/- paints immediately; parent measurements sync in a transition.
  const [stepperCounts, setStepperCounts] = useState<WetAreaStepperCounts>({
    bathCount: measurements.bathCount ?? null,
    tilePanBathCount: measurements.tilePanBathCount ?? null,
    prefabBathCount: measurements.prefabBathCount ?? null,
    prefabEnclosureBathCount: measurements.prefabEnclosureBathCount ?? null,
    tubBathCount: measurements.tubBathCount ?? null,
    bathFloorTileCount: measurements.bathFloorTileCount ?? null,
    showerDoorCount: measurements.showerDoorCount ?? null,
  });
  const [existingCounts, setExistingCounts] = useState<WetAreaExistingCounts>(
    () => readWetAreaExistingCounts(measurements)
  );
  const [demoCounts, setDemoCounts] = useState<WetAreaDemoCounts>(() =>
    readWetAreaDemoCounts(measurements)
  );
  const [reuseExistingShowerDoor, setReuseExistingShowerDoor] = useState(() =>
    Boolean(measurements.reuseExistingShowerDoor)
  );
  const demoOverridesRef = useRef<
    Partial<Record<WetAreaDemoOverrideKey, boolean>>
  >(measurements.demoWetAreaManualOverrides || {});
  const existingDemoGenRef = useRef(0);
  const existingDemoAppliedGenRef = useRef(0);
  const latestExistingDemoRef = useRef({
    existing: existingCounts,
    demo: demoCounts,
    reuseExistingShowerDoor,
  });
  const stepperGenRef = useRef(0);
  const stepperAppliedGenRef = useRef(0);
  const latestStepperRef = useRef(stepperCounts);
  useEffect(() => {
    // Skip stale parent catch-up while rapid taps are still committing.
    if (stepperGenRef.current !== stepperAppliedGenRef.current) return;
    setStepperCounts({
      bathCount: measurements.bathCount ?? null,
      tilePanBathCount: measurements.tilePanBathCount ?? null,
      prefabBathCount: measurements.prefabBathCount ?? null,
      prefabEnclosureBathCount: measurements.prefabEnclosureBathCount ?? null,
      tubBathCount: measurements.tubBathCount ?? null,
      bathFloorTileCount: measurements.bathFloorTileCount ?? null,
      showerDoorCount: measurements.showerDoorCount ?? null,
    });
  }, [
    measurements.bathCount,
    measurements.tilePanBathCount,
    measurements.prefabBathCount,
    measurements.prefabEnclosureBathCount,
    measurements.tubBathCount,
    measurements.bathFloorTileCount,
    measurements.showerDoorCount,
  ]);

  const displayTileWallCount = stepperCounts.bathCount;
  const displayTilePanCount = stepperCounts.tilePanBathCount;
  const displayPrefabPanCount = stepperCounts.prefabBathCount;
  const displayPrefabEnclosureCount = stepperCounts.prefabEnclosureBathCount;
  const displayTubBathCount = stepperCounts.tubBathCount;
  const displayBathFloorTileCount = stepperCounts.bathFloorTileCount;
  const displayShowerDoorCount = stepperCounts.showerDoorCount;
  const wetAreaStepperMax = BATHROOM_QM_STEPPER_MAX;

  const buildInstallCounts = useCallback(
    (overrides?: Partial<WetAreaStepperCounts>): WetAreaStepperCounts => ({
      bathCount: overrides?.bathCount ?? stepperCounts.bathCount,
      tilePanBathCount:
        overrides?.tilePanBathCount ?? stepperCounts.tilePanBathCount,
      prefabBathCount:
        overrides?.prefabBathCount ?? stepperCounts.prefabBathCount,
      prefabEnclosureBathCount:
        overrides?.prefabEnclosureBathCount ??
        stepperCounts.prefabEnclosureBathCount,
      tubBathCount: overrides?.tubBathCount ?? stepperCounts.tubBathCount,
      bathFloorTileCount:
        overrides?.bathFloorTileCount ?? stepperCounts.bathFloorTileCount,
      showerDoorCount:
        overrides?.showerDoorCount ?? stepperCounts.showerDoorCount,
    }),
    [stepperCounts]
  );

  const scheduleExistingDemoCommit = useCallback(
    (
      nextExisting: WetAreaExistingCounts,
      install: WetAreaStepperCounts,
      keeping: boolean,
      reuse: boolean,
      gen: number,
      demoOverride?: { key: WetAreaDemoOverrideKey; value: number | null }
    ) => {
      const effectiveExisting = hasSitePhotos
        ? resolveEffectiveExistingWetArea({
            measurements: { ...measurements, ...nextExisting },
            notes,
            hasSitePhotos: true,
            tubDemoIncluded: includedScopeKeys.includes('tub_demo'),
            showerFloorDemoIncluded:
              includedScopeKeys.includes('shower_floor_demo'),
            floorDemoIncluded: includedScopeKeys.includes('floor_demo'),
            glassDoorIncluded: includedScopeKeys.includes('glass_door'),
          })
        : nextExisting;
      const auto = resolveDemoWetAreaFromIntent({
        notes,
        existing: effectiveExisting,
        install,
        keepingExisting: keeping,
        reuseExistingShowerDoor: reuse,
        tubDemoIncluded: includedScopeKeys.includes('tub_demo'),
        showerFloorDemoIncluded:
          includedScopeKeys.includes('shower_floor_demo'),
        floorDemoIncluded: includedScopeKeys.includes('floor_demo'),
        floorTileIncluded: includedScopeKeys.includes('floor_tile'),
        bathroomFloorSqft: measurements.bathroomFloorSqft,
      });
      const overrides = { ...demoOverridesRef.current };
      if (demoOverride) {
        overrides[demoOverride.key] = true;
      }
      const stored = readWetAreaDemoCounts(measurements);
      if (demoOverride) {
        stored[demoOverride.key] = demoOverride.value;
      }
      // Drop stale "demo off" overrides when install/notes inference turns that row back on.
      if (!demoOverride) {
        (Object.keys(auto) as WetAreaDemoOverrideKey[]).forEach(key => {
          if (auto[key] && overrides[key] && !(Number(stored[key]) > 0)) {
            delete overrides[key];
          }
        });
      }
      demoOverridesRef.current = overrides;
      const merged = mergeDemoCountsWithOverrides({ auto, stored, overrides });
      latestExistingDemoRef.current = {
        existing: effectiveExisting,
        demo: merged,
        reuseExistingShowerDoor: reuse,
      };
      queueMicrotask(() => {
        if (gen !== existingDemoGenRef.current) return;
        const latest = latestExistingDemoRef.current;
        startTransition(() => {
          setDemoCounts(latest.demo);
          setMeasurements(prev => ({
            ...prev,
            ...effectiveExisting,
            ...latest.demo,
            reuseExistingShowerDoor: latest.reuseExistingShowerDoor,
            demoWetAreaManualOverrides: overrides,
          }));
          existingDemoAppliedGenRef.current = existingDemoGenRef.current;
          onWetAreaExistingDemoChange?.({
            existing: latest.existing,
            demo: latest.demo,
            reuseExistingShowerDoor: latest.reuseExistingShowerDoor,
            demoOverrides: overrides,
          });
        });
      });
    },
    [
      hasSitePhotos,
      includedScopeKeys,
      measurements,
      notes,
      onWetAreaExistingDemoChange,
      setMeasurements,
    ]
  );

  const scheduleWetAreaCommit = useCallback(
    (
      next: WetAreaStepperCounts,
      gen: number,
      options?: { keepingExisting?: boolean }
    ) => {
      latestStepperRef.current = next;
      queueMicrotask(() => {
        if (gen !== stepperGenRef.current) return; // superseded by a newer tap
        const latest = latestStepperRef.current;
        const wetAreaFinish = resolveEffectiveWetAreaFinish({
          ...latest,
          templateKey: effectiveTemplateKey,
          wholeHomeLayout,
        });
        startTransition(() => {
          setMeasurements(prev => {
            const itemQuantities = { ...(prev.itemQuantities || {}) };
            if (latest.showerDoorCount != null && latest.showerDoorCount > 0) {
              itemQuantities.glass_door = {
                quantity: String(latest.showerDoorCount),
                unit: 'each',
                quantitySource: 'user_entered',
              };
            } else {
              delete itemQuantities.glass_door;
            }
            return {
              ...prev,
              bathCount: latest.bathCount,
              tilePanBathCount: latest.tilePanBathCount,
              prefabBathCount: latest.prefabBathCount,
              prefabEnclosureBathCount: latest.prefabEnclosureBathCount,
              tubBathCount: latest.tubBathCount,
              bathFloorTileCount: latest.bathFloorTileCount,
              showerDoorCount: latest.showerDoorCount,
              wetAreaFinish,
              ...(options?.keepingExisting
                ? { showerFloorTileSqft: undefined }
                : {}),
              itemQuantities,
            };
          });
          stepperAppliedGenRef.current = stepperGenRef.current;
          onWetAreaFinishChange?.(wetAreaFinish);
          onWetAreaSteppersChange?.(latest, options);
          onShowerDoorCountChange?.(latest.showerDoorCount);
          if (bathroomPhotoWetArea) {
            const demoGen = ++existingDemoGenRef.current;
            scheduleExistingDemoCommit(
              latestExistingDemoRef.current.existing,
              latest,
              options?.keepingExisting ?? keepingExistingWetArea,
              latestExistingDemoRef.current.reuseExistingShowerDoor,
              demoGen
            );
          }
        });
      });
    },
    [
      bathroomPhotoWetArea,
      effectiveTemplateKey,
      keepingExistingWetArea,
      onShowerDoorCountChange,
      onWetAreaFinishChange,
      onWetAreaSteppersChange,
      scheduleExistingDemoCommit,
      setMeasurements,
      wholeHomeLayout,
    ]
  );

  const adjustStepperCount = useCallback(
    (key: keyof WetAreaStepperCounts, delta: number) => {
      const gen = ++stepperGenRef.current;
      setKeepingExistingWetArea(false);
      setStepperCounts(prev => {
        const current = prev[key] ?? 0;
        const cleaned = clampBathCount(
          current + delta < 1 ? null : current + delta,
          wetAreaStepperMax
        );
        const next = { ...prev, [key]: cleaned };
        if (bathroomPhotoWetArea) {
          if (key === 'tilePanBathCount' && cleaned != null && cleaned > 0) {
            next.prefabBathCount = null;
          }
          if (key === 'prefabBathCount' && cleaned != null && cleaned > 0) {
            next.tilePanBathCount = null;
          }
        }
        scheduleWetAreaCommit(next, gen, { keepingExisting: false });
        return next;
      });
    },
    [
      clampBathCount,
      bathroomPhotoWetArea,
      scheduleWetAreaCommit,
      wetAreaStepperMax,
    ]
  );

  const adjustTileBathCount = useCallback(
    (delta: number) => {
      const gen = ++stepperGenRef.current;
      setStepperCounts(prev => {
        const current = prev.bathCount ?? 0;
        const cleaned = clampBathCount(
          current + delta < 1 ? null : current + delta,
          wetAreaStepperMax
        );
        const next = { ...prev, bathCount: cleaned };
        scheduleWetAreaCommit(next, gen, {
          keepingExisting: keepingExistingWetArea,
        });
        return next;
      });
    },
    [
      clampBathCount,
      keepingExistingWetArea,
      scheduleWetAreaCommit,
      wetAreaStepperMax,
    ]
  );
  const adjustTilePanCount = useCallback(
    (delta: number) => adjustStepperCount('tilePanBathCount', delta),
    [adjustStepperCount]
  );
  const adjustPrefabBathCount = useCallback(
    (delta: number) => adjustStepperCount('prefabBathCount', delta),
    [adjustStepperCount]
  );
  const adjustPrefabEnclosureCount = useCallback(
    (delta: number) => adjustStepperCount('prefabEnclosureBathCount', delta),
    [adjustStepperCount]
  );
  const adjustTubBathCount = useCallback(
    (delta: number) => adjustStepperCount('tubBathCount', delta),
    [adjustStepperCount]
  );
  const adjustBathFloorTileCount = useCallback(
    (delta: number) => adjustStepperCount('bathFloorTileCount', delta),
    [adjustStepperCount]
  );
  const adjustShowerDoorCount = useCallback(
    (delta: number) => adjustStepperCount('showerDoorCount', delta),
    [adjustStepperCount]
  );

  const toggleKeepingExistingWetArea = useCallback(() => {
    const gen = ++stepperGenRef.current;
    if (keepingExistingWetArea) {
      setKeepingExistingWetArea(false);
      scheduleWetAreaCommit(stepperCounts, gen, { keepingExisting: false });
      scheduleExistingDemoCommit(
        existingCounts,
        stepperCounts,
        false,
        reuseExistingShowerDoor,
        ++existingDemoGenRef.current
      );
      return;
    }
    const cleared: WetAreaStepperCounts = {
      bathCount: stepperCounts.bathCount,
      tilePanBathCount: null,
      prefabBathCount: null,
      prefabEnclosureBathCount: null,
      tubBathCount: null,
      bathFloorTileCount: stepperCounts.bathFloorTileCount,
      showerDoorCount: stepperCounts.showerDoorCount,
    };
    setKeepingExistingWetArea(true);
    setStepperCounts(cleared);
    scheduleWetAreaCommit(cleared, gen, { keepingExisting: true });
    scheduleExistingDemoCommit(
      existingCounts,
      cleared,
      true,
      reuseExistingShowerDoor,
      ++existingDemoGenRef.current
    );
  }, [
    existingCounts,
    keepingExistingWetArea,
    reuseExistingShowerDoor,
    scheduleExistingDemoCommit,
    scheduleWetAreaCommit,
    stepperCounts,
  ]);

  useEffect(() => {
    if (stepperGenRef.current !== stepperAppliedGenRef.current) return;
    if (existingDemoGenRef.current !== existingDemoAppliedGenRef.current)
      return;
    setExistingCounts(readWetAreaExistingCounts(measurements));
    setDemoCounts(readWetAreaDemoCounts(measurements));
    setReuseExistingShowerDoor(Boolean(measurements.reuseExistingShowerDoor));
    demoOverridesRef.current = measurements.demoWetAreaManualOverrides || {};
  }, [
    measurements.existingTubCount,
    measurements.existingTileWallCount,
    measurements.existingTilePanCount,
    measurements.existingPrefabPanCount,
    measurements.existingPrefabEnclosureCount,
    measurements.existingShowerDoorCount,
    measurements.existingBathFloorTileCount,
    measurements.demoTubCount,
    measurements.demoTileWallCount,
    measurements.demoTilePanCount,
    measurements.demoPrefabPanCount,
    measurements.demoPrefabEnclosureCount,
    measurements.demoShowerDoorCount,
    measurements.demoBathFloorTileCount,
    measurements.reuseExistingShowerDoor,
    measurements.demoWetAreaManualOverrides,
  ]);

  useEffect(() => {
    if (!bathroomPhotoWetArea) return;
    scheduleExistingDemoCommit(
      readWetAreaExistingCounts(measurements),
      buildInstallCounts(),
      keepingExistingWetArea,
      Boolean(measurements.reuseExistingShowerDoor),
      ++existingDemoGenRef.current
    );
    // Re-infer demo when notes/floor SF change (walls + prefab pan from job notes).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid loop via scheduleExistingDemoCommit identity
  }, [bathroomPhotoWetArea, measurements.bathroomFloorSqft, notes]);

  const adjustExistingCount = useCallback(
    (key: keyof WetAreaExistingCounts, delta: number) => {
      const gen = ++existingDemoGenRef.current;
      setExistingCounts(prev => {
        const current = prev[key] ?? 0;
        const cleaned = clampBathCount(
          current + delta < 1 ? null : current + delta,
          wetAreaStepperMax
        );
        const next = { ...prev, [key]: cleaned };
        scheduleExistingDemoCommit(
          next,
          buildInstallCounts(),
          keepingExistingWetArea,
          reuseExistingShowerDoor,
          gen
        );
        return next;
      });
    },
    [
      buildInstallCounts,
      clampBathCount,
      keepingExistingWetArea,
      reuseExistingShowerDoor,
      scheduleExistingDemoCommit,
      wetAreaStepperMax,
    ]
  );

  const adjustDemoCount = useCallback(
    (key: WetAreaDemoOverrideKey, delta: number) => {
      const gen = ++existingDemoGenRef.current;
      setDemoCounts(prev => {
        const current = prev[key] ?? 0;
        const cleaned = clampBathCount(
          current + delta < 1 ? null : current + delta,
          wetAreaStepperMax
        );
        demoOverridesRef.current = { ...demoOverridesRef.current, [key]: true };
        const next = { ...prev, [key]: cleaned };
        scheduleExistingDemoCommit(
          existingCounts,
          buildInstallCounts(),
          keepingExistingWetArea,
          reuseExistingShowerDoor,
          gen,
          { key, value: cleaned }
        );
        return next;
      });
    },
    [
      buildInstallCounts,
      clampBathCount,
      existingCounts,
      keepingExistingWetArea,
      reuseExistingShowerDoor,
      scheduleExistingDemoCommit,
      wetAreaStepperMax,
    ]
  );

  const toggleReuseExistingShowerDoor = useCallback(() => {
    const gen = ++existingDemoGenRef.current;
    setReuseExistingShowerDoor(prev => {
      const next = !prev;
      const install = buildInstallCounts({
        showerDoorCount: next ? null : stepperCounts.showerDoorCount,
      });
      if (next) {
        setStepperCounts(s => ({ ...s, showerDoorCount: null }));
        scheduleWetAreaCommit(install, ++stepperGenRef.current, {
          keepingExisting: keepingExistingWetArea,
        });
      }
      scheduleExistingDemoCommit(
        existingCounts,
        install,
        keepingExistingWetArea,
        next,
        gen
      );
      return next;
    });
  }, [
    buildInstallCounts,
    existingCounts,
    keepingExistingWetArea,
    scheduleExistingDemoCommit,
    scheduleWetAreaCommit,
    stepperCounts.showerDoorCount,
  ]);

  // Optimistic garage steppers — never call parent setMeasurements inside the updater
  // (that triggers "Cannot update a component while rendering a different component").
  const [garageDoorSteppers, setGarageDoorSteppers] = useState({
    single: measurements.garageDoorSingleCount ?? 0,
    double: measurements.garageDoorDoubleCount ?? 0,
    rv: measurements.garageDoorRvCount ?? 0,
  });
  const garageDoorGenRef = useRef(0);
  const garageDoorAppliedGenRef = useRef(0);
  const latestGarageDoorRef = useRef(garageDoorSteppers);
  useEffect(() => {
    if (garageDoorGenRef.current !== garageDoorAppliedGenRef.current) return;
    setGarageDoorSteppers({
      single: measurements.garageDoorSingleCount ?? 0,
      double: measurements.garageDoorDoubleCount ?? 0,
      rv: measurements.garageDoorRvCount ?? 0,
    });
  }, [
    measurements.garageDoorSingleCount,
    measurements.garageDoorDoubleCount,
    measurements.garageDoorRvCount,
  ]);

  const scheduleGarageDoorCommit = useCallback(
    (next: { single: number; double: number; rv: number }, gen: number) => {
      latestGarageDoorRef.current = next;
      queueMicrotask(() => {
        if (gen !== garageDoorGenRef.current) return;
        const latest = latestGarageDoorRef.current;
        const total = latest.single + latest.double + latest.rv;
        startTransition(() => {
          setMeasurements(m => {
            const itemQuantities = { ...(m.itemQuantities || {}) };
            if (total > 0) {
              itemQuantities.garage_doors = {
                quantity: String(total),
                unit: 'each',
                quantitySource: 'user_entered',
              };
            } else {
              delete itemQuantities.garage_doors;
            }
            return {
              ...m,
              garageDoorSingleCount: latest.single > 0 ? latest.single : null,
              garageDoorDoubleCount: latest.double > 0 ? latest.double : null,
              garageDoorRvCount: latest.rv > 0 ? latest.rv : null,
              itemQuantities,
            };
          });
          garageDoorAppliedGenRef.current = garageDoorGenRef.current;
          onGarageDoorCountsChange?.(total > 0 ? total : null);
        });
      });
    },
    [onGarageDoorCountsChange, setMeasurements]
  );

  const adjustGarageDoorType = useCallback(
    (type: GarageDoorType, delta: number) => {
      const gen = ++garageDoorGenRef.current;
      setGarageDoorSteppers(prev => {
        const current = prev[type] ?? 0;
        const nextVal = Math.max(0, Math.min(6, current + delta));
        const next = { ...prev, [type]: nextVal };
        scheduleGarageDoorCommit(next, gen);
        return next;
      });
    },
    [scheduleGarageDoorCommit]
  );

  // Use effective whole-home template — checklist may still say room_remodel after plan import.
  const showGarageDoorSteppers = wholeHomeLayout;

  const garageDoorPackage = useMemo(
    () =>
      resolveGarageDoorSuggestedPricing({
        single: garageDoorSteppers.single,
        double: garageDoorSteppers.double,
        rv: garageDoorSteppers.rv,
      }),
    [
      garageDoorSteppers.single,
      garageDoorSteppers.double,
      garageDoorSteppers.rv,
    ]
  );

  const renderGarageDoorTypeRow = (type: GarageDoorType, label: string) => {
    const value = garageDoorSteppers[type] ?? 0;
    const rate = GARAGE_DOOR_TYPE_RATES[type];
    const stepperBtn = (delta: number, disabled: boolean, symbol: string) => (
      <TouchableOpacity
        onPress={() => adjustGarageDoorType(type, delta)}
        disabled={applying || disabled}
        activeOpacity={0.6}
        delayPressIn={0}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: darkMode ? 'rgba(255,255,255,0.14)' : Colors.line,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(15,23,42,0.03)',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: applying || disabled ? 0.35 : 1,
        }}
      >
        <Text
          style={{
            color: darkMode ? '#F5F7FA' : Colors.text,
            fontSize: 18,
            fontWeight: '700',
          }}
        >
          {symbol}
        </Text>
      </TouchableOpacity>
    );
    return (
      <View
        key={type}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(15,23,42,0.08)',
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 14,
              fontWeight: '700',
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              fontWeight: '600',
              marginTop: 2,
            }}
          >
            ~${rate.total.toLocaleString()} each
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {stepperBtn(-1, value <= 0, '−')}
          <Text
            style={{
              minWidth: 22,
              textAlign: 'center',
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 17,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}
          >
            {value}
          </Text>
          {stepperBtn(1, value >= 6, '+')}
        </View>
      </View>
    );
  };

  const renderDemoSqftField = (
    label: string,
    helperText: string,
    field: 'showerWallTileSqft' | 'showerFloorTileSqft' | 'bathroomFloorSqft'
  ) => {
    const value = String(measurements[field] ?? '');
    return (
      <View
        style={{
          marginBottom: 10,
          marginTop: -2,
          paddingLeft: 2,
        }}
      >
        <Text
          style={{
            color: darkMode ? '#F5F7FA' : Colors.text,
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            lineHeight: 15,
            marginBottom: 6,
          }}
        >
          {helperText}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderRadius: 10,
            borderColor: darkMode ? 'rgba(255,255,255,0.16)' : Colors.line,
            backgroundColor: darkMode ? 'rgba(0,0,0,0.25)' : Colors.surface,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <TextInput
            value={formatMeasurementDisplay(value)}
            onChangeText={text => {
              const cleaned = String(text || '').replace(/[^\d.]/g, '');
              setMeasurements(prev => {
                const itemQuantities = { ...(prev.itemQuantities || {}) };
                const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
                // Recalculate demo from wall + pan SF (drop stale card override).
                if (
                  field === 'showerWallTileSqft' ||
                  field === 'showerFloorTileSqft'
                ) {
                  delete itemQuantities.demo;
                  delete pricingAcceptance.demo;
                }
                if (field === 'bathroomFloorSqft') {
                  delete itemQuantities.floor_demo;
                  delete pricingAcceptance.floor_demo;
                }
                return {
                  ...prev,
                  [field]: cleaned,
                  itemQuantities,
                  pricingAcceptance,
                };
              });
            }}
            editable={!applying}
            keyboardType='decimal-pad'
            placeholder='Enter sqft'
            placeholderTextColor={
              darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'
            }
            {...nativeNumericKeyboardProps}
            style={{
              flex: 1,
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 16,
              fontWeight: '700',
              padding: 0,
            }}
          />
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 13,
              fontWeight: '600',
              marginLeft: 8,
            }}
          >
            sqft
          </Text>
        </View>
      </View>
    );
  };

  const renderBathCountStepper = (
    label: string,
    value: number | null,
    onAdjust: (delta: number) => void,
    max = wetAreaStepperMax,
    disabled = false
  ) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text
        style={{
          color: darkMode ? '#F5F7FA' : Colors.text,
          fontSize: 13,
          fontWeight: '700',
          flex: 1,
          paddingRight: 8,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity
          onPress={() => onAdjust(-1)}
          disabled={applying || disabled || !value}
          activeOpacity={0.6}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(255,255,255,0.16)' : Colors.line,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: applying || disabled || !value ? 0.4 : 1,
          }}
        >
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 18,
              fontWeight: '700',
            }}
          >
            −
          </Text>
        </TouchableOpacity>
        <Text
          style={{
            minWidth: 28,
            textAlign: 'center',
            color: darkMode ? '#F5F7FA' : Colors.text,
            fontSize: 16,
            fontWeight: '800',
          }}
        >
          {value ?? '—'}
        </Text>
        <TouchableOpacity
          onPress={() => onAdjust(1)}
          disabled={applying || disabled || (value != null && value >= max)}
          activeOpacity={0.6}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(255,255,255,0.16)' : Colors.line,
            alignItems: 'center',
            justifyContent: 'center',
            opacity:
              applying || disabled || (value != null && value >= max) ? 0.4 : 1,
          }}
        >
          <Text
            style={{
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 18,
              fontWeight: '700',
            }}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderExistingWetAreaPanel = () => {
    const existingPanelStyle = qmNeutralScopePanelStyle(darkMode);
    return (
      <View
        style={[
          styles.quickMeasurementSection,
          styles.wetAreaSection,
          {
            borderColor: existingPanelStyle.borderColor,
            backgroundColor: existingPanelStyle.backgroundColor,
            marginTop: 0,
            marginBottom: 8,
          },
        ]}
      >
        {sectionTitle('Existing wet area', existingPanelStyle.titleColor)}
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            lineHeight: 15,
            marginBottom: 8,
          }}
        >
          What is in the space now — set manually for notes-only jobs.
        </Text>
        {renderBathCountStepper(
          'Existing tub',
          existingCounts.existingTubCount,
          d => adjustExistingCount('existingTubCount', d)
        )}
        {renderBathCountStepper(
          'Existing tile shower walls',
          existingCounts.existingTileWallCount,
          d => adjustExistingCount('existingTileWallCount', d)
        )}
        {renderBathCountStepper(
          'Existing tile shower pan',
          existingCounts.existingTilePanCount,
          d => adjustExistingCount('existingTilePanCount', d)
        )}
        {renderBathCountStepper(
          'Existing prefab pan',
          existingCounts.existingPrefabPanCount,
          d => adjustExistingCount('existingPrefabPanCount', d)
        )}
        {renderBathCountStepper(
          'Existing prefab enclosure',
          existingCounts.existingPrefabEnclosureCount,
          d => adjustExistingCount('existingPrefabEnclosureCount', d)
        )}
        {renderBathCountStepper(
          'Existing shower door',
          existingCounts.existingShowerDoorCount,
          d => adjustExistingCount('existingShowerDoorCount', d)
        )}
        {renderBathCountStepper(
          'Existing bathroom floor tile',
          existingCounts.existingBathFloorTileCount,
          d => adjustExistingCount('existingBathFloorTileCount', d)
        )}
      </View>
    );
  };

  const renderDemoTearOutPanel = () => {
    if (keepingExistingWetArea) return null;
    return (
      <View
        style={[
          styles.quickMeasurementSection,
          styles.wetAreaSection,
          {
            borderColor: darkMode
              ? 'rgba(248, 113, 113, 0.28)'
              : 'rgba(220, 38, 38, 0.2)',
            backgroundColor: darkMode
              ? 'rgba(248, 113, 113, 0.06)'
              : 'rgba(248, 113, 113, 0.05)',
            marginTop: 8,
            marginBottom: 8,
          },
        ]}
      >
        {sectionTitle('Demo / tear-out', '#f87171')}
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            lineHeight: 15,
            marginBottom: 8,
          }}
        >
          Auto-filled from{' '}
          {showExistingWetAreaPanel
            ? 'existing + install'
            : 'photos, notes, and install'}{' '}
          — adjust if needed. Tile by sqft (~$5.50/SF) · tub/prefab pan $350 ·
          enclosure $600 · door $125.
        </Text>
        {renderBathCountStepper('Remove tub', demoCounts.demoTubCount, d =>
          adjustDemoCount('demoTubCount', d)
        )}
        {renderBathCountStepper(
          'Remove tile shower walls',
          demoCounts.demoTileWallCount,
          d => adjustDemoCount('demoTileWallCount', d)
        )}
        {demoCounts.demoTileWallCount != null &&
        demoCounts.demoTileWallCount > 0
          ? renderDemoSqftField(
              'Demo wall tile sqft',
              'Tear-out wall area for this job (also used for new shower wall tile takeoff).',
              'showerWallTileSqft'
            )
          : null}
        {renderBathCountStepper(
          'Remove tile shower pan',
          demoCounts.demoTilePanCount,
          d => adjustDemoCount('demoTilePanCount', d)
        )}
        {demoCounts.demoTilePanCount != null && demoCounts.demoTilePanCount > 0
          ? renderDemoSqftField(
              'Demo pan / shower floor sqft',
              'Tear-out pan area for this job (also used for new shower floor tile takeoff).',
              'showerFloorTileSqft'
            )
          : null}
        {renderBathCountStepper(
          'Remove prefab pan',
          demoCounts.demoPrefabPanCount,
          d => adjustDemoCount('demoPrefabPanCount', d)
        )}
        {renderBathCountStepper(
          'Remove prefab enclosure',
          demoCounts.demoPrefabEnclosureCount,
          d => adjustDemoCount('demoPrefabEnclosureCount', d)
        )}
        {renderBathCountStepper(
          'Remove shower door',
          demoCounts.demoShowerDoorCount,
          d => adjustDemoCount('demoShowerDoorCount', d)
        )}
        {renderBathCountStepper(
          'Remove bathroom floor tile',
          demoCounts.demoBathFloorTileCount,
          d => adjustDemoCount('demoBathFloorTileCount', d)
        )}
        {demoCounts.demoBathFloorTileCount != null &&
        demoCounts.demoBathFloorTileCount > 0
          ? renderDemoSqftField(
              'Demo bathroom floor sqft',
              'Floor tear-out area — priced on Bathroom floor demo (separate from shower).',
              'bathroomFloorSqft'
            )
          : null}
      </View>
    );
  };

  const renderWetAreaFinishPanel = () => (
    <View
      style={[
        styles.quickMeasurementSection,
        styles.wetAreaSection,
        {
          borderColor: darkMode
            ? 'rgba(148,163,184,0.28)'
            : 'rgba(100,116,139,0.24)',
          backgroundColor: darkMode
            ? 'rgba(148,163,184,0.06)'
            : 'rgba(148,163,184,0.05)',
          marginTop: bathroomPhotoWetArea ? 0 : 4,
        },
      ]}
    >
      {sectionTitle(
        bathroomPhotoWetArea ? 'Wet area install' : 'Wet area finish',
        darkMode ? '#cbd5e1' : '#475569'
      )}
      <Text
        style={{
          color: captionColor(darkMode, Colors),
          fontSize: 11,
          lineHeight: 15,
          marginBottom: 8,
        }}
      >
        {bathroomPhotoWetArea
          ? 'Set what is in this bid — shower wall and floor fields update below.'
          : bathCountFromPlan > 0
            ? `${bathCountFromPlan} bath${bathCountFromPlan === 1 ? '' : 's'} on plan — set finish counts below.`
            : 'No baths labeled on plan — set tile / prefab / tub counts below.'}
        {!bathroomPhotoWetArea &&
        effectiveWetAreaFinish === 'tile' &&
        !resolvedBathCount
          ? ' Set tile showers to unlock shower estimates.'
          : ''}
      </Text>
      {bathroomPhotoWetArea ? (
        <>
          {renderBathCountStepper(
            'Tile shower walls',
            displayTileWallCount,
            adjustTileBathCount
          )}
          {renderBathCountStepper(
            'Mud pan (tile shower)',
            displayTilePanCount,
            adjustTilePanCount,
            wetAreaStepperMax,
            keepingExistingWetArea
          )}
          {renderBathCountStepper(
            'Prefab shower pan',
            displayPrefabPanCount,
            adjustPrefabBathCount,
            wetAreaStepperMax,
            keepingExistingWetArea
          )}
          {renderBathCountStepper(
            'Prefab shower enclosure',
            displayPrefabEnclosureCount,
            adjustPrefabEnclosureCount,
            wetAreaStepperMax,
            keepingExistingWetArea
          )}
          {renderBathCountStepper(
            'Tub install',
            displayTubBathCount,
            adjustTubBathCount,
            wetAreaStepperMax,
            keepingExistingWetArea
          )}
          {renderBathCountStepper(
            'Bath floor',
            displayBathFloorTileCount,
            adjustBathFloorTileCount
          )}
          <TouchableOpacity
            onPress={toggleKeepingExistingWetArea}
            disabled={applying}
            activeOpacity={0.75}
            style={{
              alignSelf: 'flex-start',
              marginBottom: 8,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: keepingExistingWetArea
                ? '#38bdf8'
                : darkMode
                  ? 'rgba(255,255,255,0.16)'
                  : Colors.line,
              backgroundColor: keepingExistingWetArea
                ? darkMode
                  ? 'rgba(56, 189, 248, 0.12)'
                  : 'rgba(56, 189, 248, 0.08)'
                : 'transparent',
            }}
          >
            <Text
              style={{
                color: keepingExistingWetArea
                  ? '#38bdf8'
                  : darkMode
                    ? '#F5F7FA'
                    : Colors.text,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              Keeping existing tub/shower
            </Text>
          </TouchableOpacity>
          {(existingCounts.existingShowerDoorCount ?? 0) > 0 ? (
            <TouchableOpacity
              onPress={toggleReuseExistingShowerDoor}
              disabled={applying}
              activeOpacity={0.75}
              style={{
                alignSelf: 'flex-start',
                marginBottom: 8,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: reuseExistingShowerDoor
                  ? '#34d399'
                  : darkMode
                    ? 'rgba(255,255,255,0.16)'
                    : Colors.line,
                backgroundColor: reuseExistingShowerDoor
                  ? darkMode
                    ? 'rgba(52, 211, 153, 0.12)'
                    : 'rgba(52, 211, 153, 0.08)'
                  : 'transparent',
              }}
            >
              <Text
                style={{
                  color: reuseExistingShowerDoor
                    ? '#34d399'
                    : darkMode
                      ? '#F5F7FA'
                      : Colors.text,
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                Reuse existing shower door
              </Text>
            </TouchableOpacity>
          ) : null}
          {!reuseExistingShowerDoor
            ? renderBathCountStepper(
                'Shower doors',
                displayShowerDoorCount,
                adjustShowerDoorCount
              )
            : null}
        </>
      ) : (
        <>
          {renderBathCountStepper(
            'Tile showers',
            displayTileWallCount,
            adjustTileBathCount
          )}
          {renderBathCountStepper(
            'Prefab',
            displayPrefabPanCount,
            adjustPrefabBathCount
          )}
          {renderBathCountStepper(
            'Tub',
            displayTubBathCount,
            adjustTubBathCount
          )}
          {renderBathCountStepper(
            'Shower doors',
            displayShowerDoorCount,
            adjustShowerDoorCount
          )}
        </>
      )}
      {wetAreaSuggestions.length > 1 ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginBottom: 6,
            marginTop: 2,
          }}
        >
          <TouchableOpacity
            onPress={useAllWetAreaSuggestions}
            disabled={applying}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: '#34d399', fontSize: 12, fontWeight: '800' }}>
              Use shower estimates
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {wetAreaFields
        .filter(result => result.relevant)
        .map((result, index) => {
          const variant = wetAreaFieldVariant(result);
          const homeGroup: QuickMeasurementGroupId =
            result.state === 'confirmed'
              ? 'confirmed'
              : result.state === 'detected' || result.state === 'ai_verified'
                ? 'fromPlan'
                : result.state === 'estimate_available'
                  ? 'suggestions'
                  : 'needsConfirmation';
          return renderResultField(result, variant, homeGroup, index, true);
        })}
    </View>
  );

  const setField = useCallback(
    (key: QuickMeasurementFieldKey, value: string) => {
      // Activate section-pinning only when the user types — never on bare focus/tap.
      const home = editingHomeRef.current;
      if (
        editingFieldKeyRef.current === key &&
        !editingPinActiveRef.current &&
        home.homeGroup &&
        home.homeIndex != null &&
        home.variant
      ) {
        editingPinActiveRef.current = true;
        setEditingFieldKey(key);
        setEditingHomeGroup(home.homeGroup);
        setEditingHomeIndex(home.homeIndex);
        setEditingVariant(home.variant);
        setTypedMeasurementHomes(prev =>
          prev[key]
            ? prev
            : {
                ...prev,
                [key]: {
                  homeGroup: home.homeGroup!,
                  homeIndex: home.homeIndex!,
                },
              }
        );
        if (home.homeGroup === 'more') {
          setTypedMoreMeasurementKeys(prev =>
            prev.includes(key) ? prev : [...prev, key]
          );
          setTypedMoreMeasurementPositions(prev =>
            prev[key] === home.homeIndex
              ? prev
              : { ...prev, [key]: home.homeIndex }
          );
        }
      }
      setMeasurements(prev => {
        const nextItemQuantities = { ...(prev.itemQuantities || {}) };
        let nextPlumbingScope = prev.plumbingScope;
        const itemMapping: Partial<
          Record<QuickMeasurementFieldKey, { id: string; unit: string }>
        > = {
          backsplashSqft: { id: 'backsplash', unit: 'sqft' },
          countertopSqft: { id: 'countertops', unit: 'sqft' },
          cabinetLf: { id: 'cabinets', unit: 'lf' },
          flooringSqft: { id: 'flooring', unit: 'sqft' },
          wallPaintSqft: { id: 'paint', unit: 'sqft' },
          exteriorPaintSqft: { id: 'exterior_paint', unit: 'sqft' },
          baseboardLf: { id: 'trim', unit: 'lf' },
          railingLf: { id: 'railing', unit: 'lf' },
          drywallSqft: { id: 'drywall', unit: 'sqft' },
        };
        const mapped = itemMapping[key];
        if (mapped) {
          if (String(value || '').trim()) {
            nextItemQuantities[mapped.id] = {
              quantity: value,
              unit: mapped.unit,
              quantitySource: 'user_entered',
            };
          } else {
            delete nextItemQuantities[mapped.id];
          }
        }
        const plumbingCard = PLUMBING_CARDS.find(
          card => card.measurementKey === key
        );
        if (plumbingCard) {
          const quantity = Number(String(value || '').replace(/,/g, ''));
          const plumbingScope = [...(prev.plumbingScope || [])];
          if (Number.isFinite(quantity) && quantity > 0) {
            nextItemQuantities[plumbingCard.itemId] = {
              quantity: value,
              unit: plumbingCard.unit,
              quantitySource: 'user_entered',
            };
            if (!plumbingScope.includes(plumbingCard.itemId)) {
              plumbingScope.push(plumbingCard.itemId);
            }
          } else {
            delete nextItemQuantities[plumbingCard.itemId];
            const index = plumbingScope.indexOf(plumbingCard.itemId);
            if (index >= 0) plumbingScope.splice(index, 1);
          }
          nextPlumbingScope = plumbingScope;
        }
        if (String(templateKey || '').toLowerCase() === 'painting') {
          const paintingItemMapping: Partial<
            Record<QuickMeasurementFieldKey, { id: string; unit: string }>
          > = {
            wallPaintSqft: { id: 'interior_paint', unit: 'sqft' },
            ceilingPaintSqft: { id: 'ceiling_paint', unit: 'sqft' },
            paintAreaSqft: { id: 'interior_paint', unit: 'sqft' },
            baseboardLf: { id: 'trim_paint', unit: 'lf' },
            interiorDoorCount: { id: 'door_paint', unit: 'each' },
            cabinetRunLf: { id: 'cabinet_paint', unit: 'lf' },
            cabinetPaintSqft: { id: 'cabinet_paint', unit: 'sqft' },
            exteriorPaintSqft: { id: 'exterior_paint', unit: 'sqft' },
          };
          const paintingMapped = paintingItemMapping[key];
          if (paintingMapped) {
            const skipCombinedStamp =
              key === 'paintAreaSqft' && prev.paintPricingMethod !== 'combined';
            if (skipCombinedStamp) {
              // Keep paintAreaSqft as a notes reference in separate mode.
            } else if (
              (key === 'cabinetPaintSqft' || key === 'cabinetRunLf') &&
              !String(value || '').trim()
            ) {
              const otherKey =
                key === 'cabinetPaintSqft'
                  ? 'cabinetRunLf'
                  : 'cabinetPaintSqft';
              const otherValue = String(prev[otherKey] || '').trim();
              if (otherValue) {
                nextItemQuantities.cabinet_paint = {
                  quantity: otherValue,
                  unit: otherKey === 'cabinetRunLf' ? 'lf' : 'sqft',
                  quantitySource: 'user_entered',
                };
              } else {
                delete nextItemQuantities.cabinet_paint;
              }
            } else if (String(value || '').trim()) {
              nextItemQuantities[paintingMapped.id] = {
                quantity: value,
                unit: paintingMapped.unit,
                quantitySource: 'user_entered',
              };
            } else {
              delete nextItemQuantities[paintingMapped.id];
            }
          }
        }
        const flooringProductMeasurementKeys: QuickMeasurementFieldKey[] = [
          'flooringLvpSqft',
          'flooringLaminateSqft',
          'flooringEngineeredHardwoodSqft',
          'flooringSolidHardwoodSqft',
          'flooringTileSqft',
          'flooringCarpetSqft',
        ];
        const existingDemoTotal = Object.entries(nextItemQuantities)
          .filter(([quantityKey]) => quantityKey.startsWith('floor_demo__'))
          .reduce(
            (sum, [, entry]) =>
              sum + Number(String(entry?.quantity || '').replace(/,/g, '')),
            0
          );
        const nextMeasurements = { ...prev, [key]: value };
        if (key === 'paintAreaSqft' && prev.paintPricingMethod === 'combined') {
          nextMeasurements.combinedPaintableAreaSqft = value;
        }
        if (
          flooringProductMeasurementKeys.includes(key) &&
          existingDemoTotal <= 0
        ) {
          const installTotal = flooringProductMeasurementKeys.reduce(
            (sum, productKey) =>
              sum +
              Number(
                String(nextMeasurements[productKey] || '').replace(/,/g, '')
              ),
            0
          );
          nextMeasurements.floorDemoSqft =
            installTotal > 0 ? installTotal : null;
          if (installTotal > 0) {
            nextItemQuantities.floor_demo = {
              quantity: installTotal,
              unit: 'sqft',
              quantitySource: 'user_entered',
            };
          } else {
            delete nextItemQuantities.floor_demo;
          }
        }
        return {
          ...nextMeasurements,
          itemQuantities: nextItemQuantities,
          plumbingScope: nextPlumbingScope,
          quickMeasurementSources: {
            ...(prev.quickMeasurementSources || {}),
            [key]: 'user_entered',
            ...(flooringProductMeasurementKeys.includes(key)
              ? { floorDemoSqft: 'user_entered' as const }
              : {}),
          },
          quickMeasurementUserOverrides: {
            ...(prev.quickMeasurementUserOverrides || {}),
            [key]: true,
          },
        };
      });
    },
    [setMeasurements, templateKey]
  );

  const useSuggestion = useCallback(
    (estimate: QuickMeasurementEstimate) => {
      hapticTap();
      setOpenDetailsKey(null);
      setMeasurements(prev => acceptQuickMeasurementSuggestion(prev, estimate));
    },
    [setMeasurements]
  );

  const useAllSuggestions = useCallback(() => {
    if (!displayGroups.suggestions.length) return;
    hapticTap();
    const suggestions = displayGroups.suggestions
      .map(result => result.estimate)
      .filter((estimate): estimate is QuickMeasurementEstimate =>
        Boolean(estimate)
      );
    const reviewRequired = suggestions.filter(
      quickMeasurementSuggestionRequiresReview
    );
    const reviewLines = suggestions.map(
      estimate =>
        `${estimate.quantityLabel || fieldByKey.get(estimate.key)?.label || estimate.key}: ${estimate.summary} · ${estimate.confidence}`
    );
    Alert.alert(
      'Review planning suggestions',
      [
        ...reviewLines,
        reviewRequired.length
          ? `\n${reviewRequired.length} high-risk or low-confidence ${reviewRequired.length === 1 ? 'quantity requires' : 'quantities require'} explicit review.`
          : '\nAll values remain editable after use.',
      ].join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use reviewed values',
          onPress: () => {
            setOpenDetailsKey(null);
            setMeasurements(prev =>
              acceptReviewedQuickMeasurementSuggestions(prev, suggestions, true)
            );
          },
        },
      ]
    );
  }, [fieldByKey, displayGroups.suggestions, setMeasurements]);

  const wetAreaSuggestions = useMemo(
    () =>
      wetAreaFields.filter(
        result => result.state === 'estimate_available' && result.estimate
      ),
    [wetAreaFields]
  );

  const useAllWetAreaSuggestions = useCallback(() => {
    if (!wetAreaSuggestions.length) return;
    hapticTap();
    const suggestions = wetAreaSuggestions
      .map(result => result.estimate)
      .filter((estimate): estimate is QuickMeasurementEstimate =>
        Boolean(estimate)
      );
    Alert.alert(
      'Use wet-area suggestions',
      suggestions
        .map(
          estimate =>
            `${estimate.quantityLabel || estimate.key}: ${estimate.summary}`
        )
        .join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use values',
          onPress: () => {
            setOpenDetailsKey(null);
            setMeasurements(prev =>
              acceptReviewedQuickMeasurementSuggestions(prev, suggestions, true)
            );
          },
        },
      ]
    );
  }, [setMeasurements, wetAreaSuggestions]);

  const wetAreaFieldVariant = (
    result: QuickMeasurementFieldResult
  ): 'calm' | 'needs_confirmation' | 'suggestion' | 'more' => {
    if (result.state === 'estimate_available') return 'suggestion';
    if (result.state === 'needs_confirmation') return 'needs_confirmation';
    return 'calm';
  };

  const fieldVariantForResult = (
    result: QuickMeasurementFieldResult
  ): 'calm' | 'needs_confirmation' | 'suggestion' | 'more' => {
    if (result.state === 'estimate_available') return 'suggestion';
    if (result.state === 'needs_confirmation') return 'needs_confirmation';
    if (result.state === 'not_relevant') return 'more';
    return 'calm';
  };

  const homeGroupForResult = (
    result: QuickMeasurementFieldResult
  ): QuickMeasurementGroupId => {
    if (result.state === 'confirmed') return 'confirmed';
    if (result.state === 'detected' || result.state === 'ai_verified') {
      return 'fromPlan';
    }
    if (result.state === 'estimate_available') return 'suggestions';
    if (result.state === 'not_relevant') return 'more';
    return 'needsConfirmation';
  };

  const showDone = expanded && headerSummary.relevantTotal > 0;
  const subtitle =
    headerSummary.relevantTotal > 0
      ? headerSummary.needsConfirmation > 0
        ? 'Add missing measurements to improve pricing.'
        : headerSummary.estimateAvailable > 0
          ? 'Review suggestions to apply planning estimates.'
          : 'All set — measurements look complete.'
      : 'Optional — autofill repeated quantities';

  const beginEditingField = useCallback(
    (
      key: QuickMeasurementFieldKey,
      homeGroup: QuickMeasurementGroupId,
      homeIndex: number,
      variant: 'calm' | 'needs_confirmation' | 'suggestion' | 'more',
      estimate: QuickMeasurementEstimate | null
    ) => {
      // Refs only — setState on focus re-renders the list and glitches the yellow inputs.
      const switchingField = editingFieldKeyRef.current !== key;
      editingFieldKeyRef.current = key;
      editingEstimateRef.current = estimate;
      editingHomeRef.current = { homeGroup, homeIndex, variant };
      if (switchingField) {
        editingPinActiveRef.current = false;
      }
    },
    []
  );

  const endEditingField = useCallback((key: QuickMeasurementFieldKey) => {
    if (editingFieldKeyRef.current !== key) return;
    editingFieldKeyRef.current = null;
    editingEstimateRef.current = null;
    editingPinActiveRef.current = false;
    editingHomeRef.current = {
      homeGroup: null,
      homeIndex: null,
      variant: null,
    };
    setEditingFieldKey(null);
    setEditingHomeGroup(null);
    setEditingHomeIndex(null);
    setEditingVariant(null);
  }, []);

  const renderResultField = (
    result: QuickMeasurementFieldResult,
    variant: 'calm' | 'needs_confirmation' | 'suggestion' | 'more',
    homeGroup?: QuickMeasurementGroupId,
    homeIndex?: number,
    inWetAreaPanel = false,
    relaxedSpacing = false
  ) => {
    const field =
      fieldByKey.get(result.key) || quickMeasurementFieldDef(result.key);
    if (!field) return null;
    const displayValue =
      field.key === 'floorPrepSqft'
        ? String(measurements[field.key] ?? '')
        : field.key === 'paintAreaSqft' &&
            measurements.paintPricingMethod === 'combined'
          ? String(
              measurements.paintAreaSqft ||
                measurements.combinedPaintableAreaSqft ||
                noteQuickMeasurements.values.paintAreaSqft ||
                ''
            )
          : resolveQuickMeasurementDisplayValue(
              field.key,
              measurements,
              noteQuickMeasurements.values,
              measurements.quickMeasurementUserOverrides
            );
    const typed = String(measurements[field.key] ?? '').trim() !== '';
    const fromNotes =
      field.key !== 'floorPrepSqft' &&
      !typed &&
      noteKeySet.has(field.key) &&
      Boolean(noteQuickMeasurements.values[field.key]);
    const isEditing = editingFieldKey === field.key;
    const lockedVariant =
      isEditing && editingVariant ? editingVariant : variant;
    const estimateForRender =
      result.estimate ||
      (isEditing && lockedVariant === 'suggestion'
        ? editingEstimateRef.current
        : null);
    const floorPrepExceedsTotal =
      field.key === 'floorPrepSqft' &&
      Number(displayValue.replace(/,/g, '')) >
        Number(measurements.flooringSqft || 0);
    const displayField = {
      ...field,
      ...(field.key === 'paintAreaSqft'
        ? {
            label:
              measurements.paintPricingMethod === 'combined'
                ? 'Combined Paintable Area'
                : 'Original Paint Area Reference',
            helperText:
              measurements.paintPricingMethod === 'combined'
                ? 'One total when walls and ceilings get the same paint.'
                : 'Informational source quantity from job notes. Not priced when walls and ceilings are entered separately.',
          }
        : {}),
      ...(floorPrepExceedsTotal
        ? {
            helperText: `${field.helperText || 'Enter only the area requiring floor prep.'} Warning: this exceeds Total Flooring Area; verify the measurement.`,
          }
        : {}),
    };
    return (
      <QuickMeasurementField
        key={field.key}
        field={displayField}
        value={displayValue}
        fromNotes={fromNotes}
        variant={lockedVariant}
        estimate={estimateForRender}
        detailsOpen={openDetailsKey === field.key}
        onToggleDetails={() =>
          setOpenDetailsKey(prev => (prev === field.key ? null : field.key))
        }
        onChangeText={value => setField(field.key, value.replace(/,/g, ''))}
        onFocus={
          homeGroup != null && homeIndex != null
            ? () =>
                beginEditingField(
                  field.key,
                  homeGroup,
                  homeIndex,
                  variant,
                  result.estimate
                )
            : undefined
        }
        onBlur={() => endEditingField(field.key)}
        onQuantityEditFocus={handleQuantityEditFocus}
        onQuantityEditBlur={handleQuantityEditBlur}
        onUseSuggestion={useSuggestion}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
        inWetAreaPanel={inWetAreaPanel}
        compact={wholeHomeLayout}
        relaxedSpacing={relaxedSpacing}
        laborComplexityMultiplier={mepLaborComplexityMultiplier}
      />
    );
  };

  const sectionTitle = (title: string, color?: string) => (
    <Text
      style={[
        styles.quickMeasurementSectionTitle,
        { color: color || captionColor(darkMode, Colors) },
      ]}
    >
      {title}
    </Text>
  );
  const kitchenEmbeddedMeasurementKeys = new Set<QuickMeasurementFieldKey>([
    'kitchenFloorSqft',
    'backsplashSqft',
    'countertopSqft',
    'cabinetLf',
  ]);
  const flooringEmbeddedMeasurementKeys = new Set<QuickMeasurementFieldKey>([
    'flooringLvpSqft',
    'flooringLaminateSqft',
    'flooringEngineeredHardwoodSqft',
    'flooringSolidHardwoodSqft',
    'flooringTileSqft',
    'flooringCarpetSqft',
    'floorDemoSqft',
  ]);
  const landscapingEmbeddedMeasurementKeys = new Set<QuickMeasurementFieldKey>([
    'landscapeSqft',
    'demoClearingSqft',
    'gradingSqft',
    'soilPrepSqft',
    'sodSqft',
    'paverSqft',
    'rockMulchSqft',
    'landscapeTons',
  ]);
  const concreteEmbeddedMeasurementKeys = new Set<QuickMeasurementFieldKey>([
    'concreteSqft',
    'concreteCy',
    'excavationCy',
  ]);
  const simpleTradeEmbeddedMeasurementKeys = new Set<QuickMeasurementFieldKey>([
    'deckSqft',
    'railingLf',
    'roofSquares',
    ...HVAC_EMBEDDED_QUICK_MEASUREMENT_KEYS,
  ]);
  const stuccoEmbeddedMeasurementKeys = new Set<QuickMeasurementFieldKey>([
    'stuccoGrossWallSqft',
    'stuccoWindowDoorOpeningSqft',
    'stuccoGarageOpeningSqft',
    'stuccoOtherFinishDeductionSqft',
    'stuccoNetWallSqft',
    'stuccoSoffitSqft',
    'stuccoParapetSqft',
    'stuccoFoamTrimLf',
    'stuccoControlJointLf',
    'stuccoAccessAffectedSqft',
    'stuccoRepairAffectedSqft',
    'stuccoStories',
    'stuccoWallHeightFt',
  ]);
  const paintingEmbeddedMeasurementKeys = new Set<QuickMeasurementFieldKey>([
    'wallPaintSqft',
    'ceilingPaintSqft',
    'paintAreaSqft',
    'baseboardLf',
    'interiorDoorCount',
    'cabinetPaintSqft',
    'cabinetRunLf',
    'exteriorPaintSqft',
  ]);
  const flooringInstallSqft =
    Number(measurements.flooringLvpSqft || 0) +
    Number(measurements.flooringLaminateSqft || 0) +
    Number(measurements.flooringEngineeredHardwoodSqft || 0) +
    Number(measurements.flooringSolidHardwoodSqft || 0) +
    Number(measurements.flooringTileSqft || 0) +
    Number(measurements.flooringCarpetSqft || 0);
  const flooringInstallExceedsTotal =
    flooringQmJob &&
    Number(measurements.flooringSqft || 0) > 0 &&
    flooringInstallSqft > Number(measurements.flooringSqft || 0);
  const shouldRenderGeneralResult = (result: QuickMeasurementFieldResult) =>
    !(
      (windowsDoorsPlanImport &&
        windowsDoorsSuppressedQuickMeasurementFields.has(result.key)) ||
      (kitchenQmJob && kitchenEmbeddedMeasurementKeys.has(result.key)) ||
      (flooringQmJob && flooringEmbeddedMeasurementKeys.has(result.key)) ||
      (landscapingQmJob &&
        landscapingEmbeddedMeasurementKeys.has(result.key)) ||
      (concreteQmJob && concreteEmbeddedMeasurementKeys.has(result.key)) ||
      (stuccoQmJob && stuccoEmbeddedMeasurementKeys.has(result.key)) ||
      (paintingQmJob && paintingEmbeddedMeasurementKeys.has(result.key)) ||
      ((deckQmJob || hvacQmJob || roofingQmJob) &&
        simpleTradeEmbeddedMeasurementKeys.has(result.key))
    );
  const renderDisplayedResultField = (
    result: QuickMeasurementFieldResult,
    variant: 'calm' | 'needs_confirmation' | 'suggestion' | 'more',
    homeGroup?: QuickMeasurementGroupId,
    homeIndex?: number
  ) =>
    !shouldRenderGeneralResult(result)
      ? null
      : renderResultField(result, variant, homeGroup, homeIndex);
  const plumbingMeasurementFlow =
    (singleTradeImport && tradeKey === 'plumbing') ||
    ['plumbing', 'plumbing_service'].includes(
      String(quickMeasurementTemplateKey || '').toLowerCase()
    );
  const electricalMeasurementFlow =
    (singleTradeImport && tradeKey === 'electrical') ||
    String(quickMeasurementTemplateKey || '').toLowerCase() === 'electrical';
  const projectComplexityMeasurementFlow =
    (plumbingMeasurementFlow &&
      measurements.plumbingWorkflowMode !== 'service') ||
    electricalMeasurementFlow;
  const plumbingOrderedResults = rows
    .flat()
    .map(field => resultByKey.get(field.key))
    .filter((result): result is QuickMeasurementFieldResult =>
      Boolean(
        result &&
        (result.relevant || result.key === 'gasLineLf') &&
        shouldRenderGeneralResult(result)
      )
    );
  const showPlumbingProjectComplexity =
    plumbingMeasurementFlow && measurements.plumbingWorkflowMode !== 'service';
  const showElectricalProjectComplexity = electricalMeasurementFlow;
  const mepPlanImportStoryOnly = useMemo(() => {
    const importTrade = String(
      measurements.planImportTradeKey || tradeKey || ''
    ).toLowerCase();
    return (
      measurements.planImportMode === 'selected_trade' &&
      (importTrade === 'plumbing' || importTrade === 'electrical') &&
      !measurements.quickMeasurementUserOverrides?.floorAreaSqft
    );
  }, [
    measurements.planImportMode,
    measurements.planImportTradeKey,
    measurements.quickMeasurementUserOverrides?.floorAreaSqft,
    tradeKey,
  ]);
  const plumbingStoryCount = useMemo(() => {
    const fromField = Number(
      String(measurements.storyCount || '').replace(/,/g, '')
    );
    if (Number.isFinite(fromField) && fromField >= 1) {
      return Math.min(3, Math.round(fromField));
    }
    if (hasPlanProjectComplexityContext(measurements)) {
      const fromPlan = Number(measurements.planFacts?.storyCount);
      if (Number.isFinite(fromPlan) && fromPlan >= 1) {
        return Math.min(3, Math.round(fromPlan));
      }
      if (
        Number(measurements.planFacts?.buildingAreas?.upstairsLivingSqft || 0) >
        0
      ) {
        return 2;
      }
    }
    const fromNotes = Number(
      String(noteQuickMeasurements.values.storyCount || '').replace(/,/g, '')
    );
    if (Number.isFinite(fromNotes) && fromNotes >= 1) {
      return Math.min(3, Math.round(fromNotes));
    }
    return 1;
  }, [
    measurements.storyCount,
    measurements.planFacts,
    measurements.planImportMode,
    measurements.planImportTradeKey,
    measurements.planImportFingerprint,
    measurements.quickMeasurementSources,
    noteQuickMeasurements.values.storyCount,
  ]);
  const plumbingLivingAreaDisplay = useMemo(() => {
    const fromField = String(measurements.floorAreaSqft || '').replace(
      /,/g,
      ''
    );
    if (fromField.trim()) return fromField;
    if (mepPlanImportStoryOnly) {
      return '';
    }
    if (hasPlanProjectComplexityContext(measurements)) {
      const fromPlan = measurements.planFacts?.buildingAreas?.totalLivingSqft;
      if (fromPlan != null && Number(fromPlan) > 0) {
        return String(Math.round(Number(fromPlan)));
      }
    }
    return noteQuickMeasurements.values.floorAreaSqft?.trim() || '';
  }, [
    measurements.floorAreaSqft,
    measurements.planFacts,
    measurements.planImportMode,
    measurements.planImportTradeKey,
    measurements.planImportFingerprint,
    measurements.quickMeasurementSources,
    mepPlanImportStoryOnly,
    noteQuickMeasurements.values.floorAreaSqft,
  ]);
  const plumbingComplexityContext = useMemo(
    () => ({
      floorAreaSqft: shouldApplySquareFootageComplexity({
        floorAreaSqft: measurements.floorAreaSqft,
        storyCount: measurements.storyCount,
        planFacts: measurements.planFacts,
        planImportMode: measurements.planImportMode,
        planImportTradeKey: measurements.planImportTradeKey,
        planImportFingerprint: measurements.planImportFingerprint,
        quickMeasurementSources: measurements.quickMeasurementSources,
        quickMeasurementUserOverrides:
          measurements.quickMeasurementUserOverrides,
      })
        ? measurements.floorAreaSqft || plumbingLivingAreaDisplay
        : measurements.floorAreaSqft,
      storyCount: measurements.storyCount || plumbingStoryCount,
      planFacts: measurements.planFacts,
      projectComplexity: measurements.projectComplexity,
      plumbingComplexityFactors: measurements.plumbingComplexityFactors,
      planImportMode: measurements.planImportMode,
      planImportTradeKey: measurements.planImportTradeKey,
      planImportFingerprint: measurements.planImportFingerprint,
      quickMeasurementSources: measurements.quickMeasurementSources,
      quickMeasurementUserOverrides: measurements.quickMeasurementUserOverrides,
      allowPlanFactsFallback: hasPlanProjectComplexityContext(measurements),
    }),
    [measurements, plumbingLivingAreaDisplay, plumbingStoryCount]
  );
  const plumbingComplexitySummary = useMemo(() => {
    const settings = inferProjectComplexitySettings(plumbingComplexityContext);
    const breakdown = calculateProjectComplexityMultiplier(settings);
    if (breakdown.totalMultiplier === 1) {
      return 'Single-story base labor — increase stories to adjust pricing.';
    }
    if (settings.squareFootage == null) {
      return `Labor ${formatComplexityPercent(breakdown.totalMultiplier)} · ${settings.stories === 3 ? '3+ story' : settings.stories === 2 ? '2 story' : '1 story'}`;
    }
    return `Labor ${formatComplexityPercent(breakdown.totalMultiplier)} for ${Math.round(settings.squareFootage).toLocaleString()} SF · ${settings.stories === 3 ? '3+ story' : settings.stories === 2 ? '2 story' : '1 story'}`;
  }, [plumbingComplexityContext]);
  useEffect(() => {
    if (!projectComplexityMeasurementFlow) {
      return;
    }
    if (!hasPlanProjectComplexityContext(measurements)) return;
    const patches = hydrateProjectComplexityInputFields(measurements);
    const allowsLivingArea = shouldApplySquareFootageComplexity(measurements);
    const needsFloor =
      allowsLivingArea &&
      Boolean(patches.floorAreaSqft) &&
      !String(measurements.floorAreaSqft || '').trim() &&
      !measurements.quickMeasurementUserOverrides?.floorAreaSqft;
    const needsStory =
      Boolean(patches.storyCount) &&
      !String(measurements.storyCount || '').trim() &&
      !measurements.quickMeasurementUserOverrides?.storyCount;
    if (!needsFloor && !needsStory) return;
    const livingSqft = patches.floorAreaSqft
      ? Number(String(patches.floorAreaSqft).replace(/,/g, ''))
      : null;
    const stories = patches.storyCount
      ? Number(String(patches.storyCount).replace(/,/g, ''))
      : null;
    setMeasurements(prev => ({
      ...prev,
      ...(needsFloor ? { floorAreaSqft: patches.floorAreaSqft } : {}),
      ...(needsStory ? { storyCount: patches.storyCount } : {}),
      projectComplexity: {
        mode: 'automatic' as const,
        ...(prev.projectComplexity || {}),
        ...(needsFloor &&
        Number.isFinite(livingSqft) &&
        livingSqft != null &&
        livingSqft > 0
          ? { squareFootage: livingSqft }
          : {}),
        ...(Number.isFinite(stories) && stories != null && stories >= 1
          ? { stories: Math.min(3, Math.round(stories)) as 1 | 2 | 3 }
          : {}),
      },
      quickMeasurementSources: {
        ...(prev.quickMeasurementSources || {}),
        ...(needsFloor ? { floorAreaSqft: 'plan_detected' as const } : {}),
        ...(needsStory ? { storyCount: 'plan_detected' as const } : {}),
      },
    }));
  }, [
    projectComplexityMeasurementFlow,
    measurements.plumbingWorkflowMode,
    measurements.planFacts,
    measurements.planImportMode,
    measurements.planImportTradeKey,
    measurements.planImportFingerprint,
    measurements.floorAreaSqft,
    measurements.storyCount,
    measurements.quickMeasurementUserOverrides?.floorAreaSqft,
    measurements.quickMeasurementUserOverrides?.storyCount,
    measurements.quickMeasurementSources,
    setMeasurements,
  ]);
  const adjustPlumbingStoryCount = useCallback(
    (delta: number) => {
      setMeasurements(prev => {
        const current = (() => {
          const fromField = Number(
            String(prev.storyCount || '').replace(/,/g, '')
          );
          if (Number.isFinite(fromField) && fromField >= 1) {
            return Math.min(3, Math.round(fromField));
          }
          const fromPlan = Number(prev.planFacts?.storyCount);
          if (Number.isFinite(fromPlan) && fromPlan >= 1) {
            return Math.min(3, Math.round(fromPlan));
          }
          if (
            Number(prev.planFacts?.buildingAreas?.upstairsLivingSqft || 0) > 0
          ) {
            return 2;
          }
          return 1;
        })();
        const next = Math.max(1, Math.min(3, current + delta));
        const livingSqft = Number(
          String(prev.floorAreaSqft || '').replace(/,/g, '')
        );
        const includeLivingArea = shouldApplySquareFootageComplexity(prev);
        return {
          ...prev,
          storyCount: String(next),
          projectComplexity: {
            mode: 'automatic' as const,
            ...(prev.projectComplexity || {}),
            stories: next as 1 | 2 | 3,
            ...(includeLivingArea &&
            Number.isFinite(livingSqft) &&
            livingSqft > 0
              ? { squareFootage: livingSqft }
              : {}),
          },
          quickMeasurementSources: {
            ...(prev.quickMeasurementSources || {}),
            storyCount: 'user_entered',
          },
          quickMeasurementUserOverrides: {
            ...(prev.quickMeasurementUserOverrides || {}),
            storyCount: true,
          },
        };
      });
    },
    [setMeasurements]
  );
  const enableLivingAreaComplexity = useCallback(() => {
    setMeasurements(prev => {
      const fromPlan = Number(
        prev.planFacts?.buildingAreas?.totalLivingSqft || 0
      );
      const fromField = Number(
        String(prev.floorAreaSqft || '').replace(/,/g, '')
      );
      const livingSqft =
        Number.isFinite(fromField) && fromField > 0
          ? fromField
          : Number.isFinite(fromPlan) && fromPlan > 0
            ? Math.round(fromPlan)
            : null;
      return {
        ...prev,
        ...(livingSqft != null ? { floorAreaSqft: String(livingSqft) } : {}),
        projectComplexity: {
          mode: 'automatic' as const,
          ...(prev.projectComplexity || {}),
          ...(livingSqft != null ? { squareFootage: livingSqft } : {}),
        },
        quickMeasurementSources: {
          ...(prev.quickMeasurementSources || {}),
          ...(livingSqft != null
            ? { floorAreaSqft: 'plan_detected' as const }
            : {}),
        },
        quickMeasurementUserOverrides: {
          ...(prev.quickMeasurementUserOverrides || {}),
          floorAreaSqft: true,
        },
      };
    });
  }, [setMeasurements]);
  const renderProjectComplexityPanel = (
    trade: 'plumbing' | 'electrical' = 'plumbing'
  ) => {
    const panelStyle = qmNeutralScopePanelStyle(darkMode);
    const helperCopy =
      trade === 'electrical'
        ? 'Multi-story and larger homes add labor on rough-in, trim, homeruns, and panel work. Material stays at base rates.'
        : 'Multi-story and larger homes add labor on rough-in, trim, and vertical runs. Material stays at base rates.';
    return (
      <View
        style={[
          styles.quickMeasurementSection,
          styles.wetAreaSection,
          {
            borderColor: panelStyle.borderColor,
            backgroundColor: panelStyle.backgroundColor,
          },
        ]}
      >
        {sectionTitle('Project complexity', panelStyle.titleColor)}
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            lineHeight: 15,
            marginBottom: 10,
          }}
        >
          {helperCopy}
        </Text>
        {mepPlanImportStoryOnly ? (
          <TouchableOpacity
            onPress={enableLivingAreaComplexity}
            disabled={applying}
            style={{ marginBottom: 10 }}
          >
            <Text
              style={{
                color: '#86efac',
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              Add living area adjustment
            </Text>
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                lineHeight: 15,
                marginTop: 2,
              }}
            >
              Plan takeoff already sizes this scope — add living SF only when
              you want a size-based labor stack on top of stories.
            </Text>
          </TouchableOpacity>
        ) : (
          <QmSqftMeasurementRow
            label='Living area'
            helperText={
              hasPlanProjectComplexityContext(measurements)
                ? 'Used for size-based labor adjustment — optional on plan imports.'
                : 'Enter living area when stated in job notes — used for size-based labor adjustment.'
            }
            value={plumbingLivingAreaDisplay}
            placeholder={
              hasPlanProjectComplexityContext(measurements)
                ? 'e.g. 3660'
                : 'Enter SF from notes'
            }
            onChangeText={value =>
              setMeasurements(prev => {
                const livingSqft = Number(
                  String(value || '').replace(/,/g, '')
                );
                return {
                  ...prev,
                  floorAreaSqft: value.replace(/,/g, ''),
                  projectComplexity: {
                    mode: 'automatic' as const,
                    ...(prev.projectComplexity || {}),
                    ...(Number.isFinite(livingSqft) && livingSqft > 0
                      ? { squareFootage: livingSqft }
                      : {}),
                  },
                  quickMeasurementSources: {
                    ...(prev.quickMeasurementSources || {}),
                    floorAreaSqft: 'user_entered',
                  },
                  quickMeasurementUserOverrides: {
                    ...(prev.quickMeasurementUserOverrides || {}),
                    floorAreaSqft: true,
                  },
                };
              })
            }
            applying={applying}
            darkMode={darkMode}
            Colors={Colors}
          />
        )}
        {renderBathCountStepper(
          'Stories',
          plumbingStoryCount,
          adjustPlumbingStoryCount,
          3
        )}
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 11,
            lineHeight: 15,
            marginTop: 2,
          }}
        >
          {hasPlanProjectComplexityContext(measurements)
            ? 'Auto-filled from plan when readable — adjust if the takeoff missed it.'
            : 'Defaults to 1 story unless job notes specify otherwise.'}
        </Text>
        <Text
          style={{
            color: mepLaborComplexityMultiplier > 1 ? '#86efac' : Colors.sub,
            fontSize: 12,
            fontWeight: '700',
            marginTop: 4,
          }}
        >
          {plumbingComplexitySummary}
        </Text>
      </View>
    );
  };
  const renderPlumbingMeasurementsPanel = () => {
    const panelStyle = qmNeutralScopePanelStyle(darkMode);
    return (
      <View
        style={[
          styles.quickMeasurementSection,
          styles.wetAreaSection,
          {
            borderColor: panelStyle.borderColor,
            backgroundColor: panelStyle.backgroundColor,
          },
        ]}
      >
        {sectionTitle('Plumbing measurements', panelStyle.titleColor)}
        {plumbingOrderedResults.map((result, index) =>
          renderDisplayedResultField(
            result,
            fieldVariantForResult(result),
            homeGroupForResult(result),
            index
          )
        )}
      </View>
    );
  };
  const kitchenMeasurementFooter = kitchenQmJob ? (
    <View style={{ gap: 12, marginTop: 8 }}>
      {[
        'kitchenFloorSqft',
        'backsplashSqft',
        'countertopSqft',
        'cabinetLf',
      ].map((key, index) => {
        const result = resultByKey.get(key as QuickMeasurementFieldKey);
        if (!result || !result.relevant) return null;
        return renderResultField(
          result,
          fieldVariantForResult(result),
          homeGroupForResult(result),
          index,
          true
        );
      })}
    </View>
  ) : null;
  const renderPaintEmbeddedField = (
    key: QuickMeasurementFieldKey,
    index: number
  ) => {
    const result = resultByKey.get(key) || {
      key,
      state: 'needs_confirmation' as const,
      showConfirmedBadge: false,
      filled: false,
      fromNotes: false,
      relevant: true,
      blockingPrice: true,
      estimate: null,
      sourceLabel: null,
    };
    return renderResultField(
      result,
      fieldVariantForResult(result),
      homeGroupForResult(result),
      index,
      false,
      true
    );
  };
  const flooringMeasurementFootersByKey: Partial<
    Record<string, React.ReactNode>
  > = {};
  const flooringProductIdByMeasurementKey: Partial<Record<string, string>> = {
    flooringLvpSqft: 'lvp',
    flooringLaminateSqft: 'laminate',
    flooringEngineeredHardwoodSqft: 'engineered_hardwood',
    flooringSolidHardwoodSqft: 'solid_hardwood',
    flooringTileSqft: 'tile',
    flooringCarpetSqft: 'carpet',
  };
  if (flooringQmJob) {
    Array.from(flooringEmbeddedMeasurementKeys)
      .filter(key => key !== 'floorDemoSqft')
      .forEach((key, index) => {
        const result = resultByKey.get(key);
        const productId = flooringProductIdByMeasurementKey[key];
        if (!result || !result.relevant || !productId) return;
        flooringMeasurementFootersByKey[productId] = renderResultField(
          result,
          fieldVariantForResult(result),
          homeGroupForResult(result),
          index,
          true
        );
      });
  }
  const flooringMeasurementFooter =
    flooringQmJob && flooringInstallExceedsTotal ? (
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: '#fbbf24', fontSize: 11, lineHeight: 15 }}>
          Measurements unmatched from notes: selected products exceed Total
          Flooring Area. This is allowed for corrections, but should be
          intentional.
        </Text>
      </View>
    ) : null;
  const ambiguousPaintArea =
    String(templateKey || '').toLowerCase() === 'painting' &&
    Boolean(measurements.paintAreaNeedsConfirmation) &&
    Number(measurements.paintAreaSqft) > 0;
  const choosePaintPricingMethod = (method: 'combined' | 'separate') => {
    setMeasurements(prev =>
      applyPaintPricingMethodChoice(prev, method, lastPaintSplitRef.current)
    );
  };
  const choosePaintScope = (
    surface: NonNullable<ScopeMeasurements['paintScope']>[number]
  ) => {
    setMeasurements(prev => {
      const current = prev.paintScope || [];
      const nextScope = current.includes(surface)
        ? current.filter(value => value !== surface)
        : [...current, surface];
      const hasWallsAndCeilings =
        nextScope.includes('walls') && nextScope.includes('ceilings');
      const itemQuantities = { ...(prev.itemQuantities || {}) };
      if (!hasWallsAndCeilings) {
        delete itemQuantities.interior_paint;
        delete itemQuantities.prep;
      }
      return {
        ...prev,
        paintScope: nextScope,
        paintPricingMethod: hasWallsAndCeilings
          ? prev.paintPricingMethod || 'combined'
          : null,
        itemQuantities,
      };
    });
  };
  const choosePaintAssumption = (
    key: 'paintOccupancy' | 'paintApplicationMethod',
    value:
      | NonNullable<ScopeMeasurements['paintOccupancy']>
      | NonNullable<ScopeMeasurements['paintApplicationMethod']>
  ) => {
    setMeasurements(prev => ({
      ...prev,
      [key]: prev[key] === value ? null : value,
      ...(key === 'paintOccupancy' ? { paintOccupancyConfirmed: true } : {}),
      ...(key === 'paintApplicationMethod'
        ? { paintApplicationMethodConfirmed: true }
        : {}),
    }));
  };
  const paintChipSelectedColor = '#34d399';
  const paintChipStyle = (selected: boolean) => ({
    borderWidth: 1,
    borderColor: selected
      ? paintChipSelectedColor
      : darkMode
        ? '#52525b'
        : '#cbd5e1',
    backgroundColor: selected
      ? 'rgba(52, 211, 153, 0.12)'
      : darkMode
        ? '#27272a'
        : '#f1f5f9',
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });
  const paintChipTextColor = (selected: boolean) =>
    selected ? paintChipSelectedColor : darkMode ? '#e4e4e7' : Colors.text;
  const electricalAttributeValues = useMemo(
    () =>
      electricalConfirmScopeAttributesFromMeasurements(
        measurements as Record<string, unknown>
      ),
    [
      measurements.electricalProjectCondition,
      measurements.serviceAmperage,
      measurements.existingServiceAmperage,
      measurements.electricalPanelLocation,
      measurements.electricalMeterMainCombo,
      measurements.electricalIncludeRough,
      measurements.electricalIncludeTrim,
      measurements.electricalConduit,
      measurements.electricalTrenching,
    ]
  );
  const patchElectricalAttributes = useCallback(
    (
      patch: Partial<
        ReturnType<typeof electricalConfirmScopeAttributesFromMeasurements>
      >
    ) => {
      setMeasurements(prev => ({ ...prev, ...patch }));
    },
    [setMeasurements]
  );
  const patchElectricalQuantity = useCallback(
    (field: string, value: string) => {
      setMeasurements(prev =>
        applyElectricalQuickMeasurementPatch(prev, field, value)
      );
    },
    [setMeasurements]
  );
  const electricalConflictFields = useMemo(
    () => [...unresolvedElectricalConflictFields(measurementConflicts)],
    [measurementConflicts]
  );
  const electricalQuantityTakeoff = useMemo(
    () => (
      <ElectricalQuickMeasurementTakeoff
        measurements={measurements as Record<string, unknown>}
        conflictFields={electricalConflictFields}
        sources={measurements.quickMeasurementSources}
        userOverrides={measurements.quickMeasurementUserOverrides}
        preferExpandedKeys={resolvedConflictFields}
        onChangeQuantity={patchElectricalQuantity}
        quantityEditingRef={electricalQuantityEditingRef}
        darkMode={darkMode}
        Colors={Colors}
        applying={applying}
      />
    ),
    [
      measurements,
      electricalConflictFields,
      measurements.quickMeasurementSources,
      measurements.quickMeasurementUserOverrides,
      resolvedConflictFields,
      patchElectricalQuantity,
      electricalQuantityEditingRef,
      darkMode,
      Colors,
      applying,
    ]
  );
  const choosePaintAreaBasis = (
    basis: 'walls' | 'combined' | 'floor_area' | 'unknown'
  ) => {
    if (basis === 'combined') choosePaintPricingMethod('combined');
    if (basis === 'walls') choosePaintPricingMethod('separate');
    const value = measurements.paintAreaSqft || '';
    if (basis === 'combined' || basis === 'walls') return;
    setMeasurements(prev => ({
      ...prev,
      paintAreaBasis: basis,
      paintAreaNeedsConfirmation: basis === 'unknown' || basis === 'floor_area',
      wallPaintSqft: basis === 'walls' || basis === 'combined' ? value : '',
      ceilingPaintSqft: '',
      paintAreaSqft: basis === 'walls' || basis === 'combined' ? '' : value,
    }));
  };

  return (
    <View
      ref={containerRef}
      collapsable={false}
      style={[
        styles.quickMeasurements,
        estimateFlowCardStyle(Colors, darkMode),
        { backgroundColor: darkMode ? '#202022' : Colors.surface },
      ]}
    >
      <TouchableOpacity
        style={styles.quickMeasurementsHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.quickMeasurementsTitleRow}>
            <Text
              style={{
                color: darkMode ? '#F5F7FA' : Colors.text,
                fontSize: 13,
                fontWeight: '800',
              }}
            >
              Quick measurements
            </Text>
          </View>
          {headerSummary.relevantTotal > 0 ? (
            <Text
              style={{
                color: captionColor(darkMode, Colors),
                fontSize: 11,
                marginTop: 2,
                fontWeight: '600',
              }}
            >
              {quickMeasurementSummaryLine(headerSummary)}
            </Text>
          ) : null}
          {expanded ? (
            <Text
              style={{
                color:
                  headerSummary.needsConfirmation > 0
                    ? '#fbbf24'
                    : captionColor(darkMode, Colors),
                fontSize: 11,
                marginTop: 2,
                minHeight: 28,
                fontWeight: headerSummary.needsConfirmation > 0 ? '700' : '400',
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={captionColor(darkMode, Colors)}
        />
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.quickMeasurementsBody}>
          {notesScopeSelectorVisible ? (
            <NotesScopeSelector
              mode={notesTradeMode}
              disabled={applying}
              Colors={Colors}
              darkMode={darkMode}
              onChange={onNotesTradeModeChange}
            />
          ) : null}
          {false && notesScopeSelectorVisible ? (
            <View
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.line,
                padding: 10,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: Colors.text,
                  fontSize: 12,
                  fontWeight: '800',
                  marginBottom: 7,
                }}
              >
                Notes estimate scope
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(
                  [
                    ['whole_project', 'Whole Project / General Contractor'],
                    ['plumbing', 'Single Trade / Plumbing Only'],
                  ] as Array<['whole_project' | 'plumbing', string]>
                ).map(([mode, label]) => (
                  <TouchableOpacity
                    key={mode}
                    disabled={applying}
                    activeOpacity={1}
                    onPress={() => onNotesTradeModeChange?.(mode)}
                    style={{
                      borderRadius: 15,
                      borderWidth: 1,
                      borderColor:
                        notesTradeMode === mode ? '#22c55e' : Colors.line,
                      backgroundColor:
                        notesTradeMode === mode
                          ? 'rgba(34,197,94,0.12)'
                          : 'transparent',
                      paddingHorizontal: 9,
                      paddingVertical: 7,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.text,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          <PlanTakeoffConflictChooser
            {...(windowsDoorsPlanImport
              ? { conflicts: [] }
              : {
                  conflicts: measurementConflicts,
                  choices: conflictChoices,
                  manualValues: conflictManualValues,
                  keepResolvedCards: true,
                  onChoose: (field: string, choice: PlanConflictChoice | null) => {
                    if (choice == null) {
                      setConflictChoices(prev => {
                        const next = { ...prev };
                        delete next[field];
                        return next;
                      });
                      clearConflictQuantity(field);
                      return;
                    }
                    setConflictChoices(prev => ({ ...prev, [field]: choice }));
                    if (typeof choice === 'number') {
                      commitConflictQuantity(field, choice);
                    }
                  },
                  onManualChange: (field: string, value: string) => {
                    setConflictManualValues(prev => ({ ...prev, [field]: value }));
                  },
                  onManualSubmit: (field: string, value: string) => {
                    const n = parseManualConflictValue(value);
                    if (n != null) {
                      commitConflictQuantity(field, n, true);
                    }
                  },
                })}
            darkMode={darkMode}
            captionColor={captionColor(darkMode, Colors)}
          />
          {ambiguousPaintArea ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: '#fbbf24',
                borderRadius: 14,
                padding: 14,
                marginBottom: 14,
                backgroundColor: darkMode
                  ? 'rgba(120, 80, 0, 0.14)'
                  : 'rgba(251, 191, 36, 0.08)',
              }}
            >
              <Text
                style={{
                  color: darkMode ? '#fef3c7' : '#78350f',
                  fontWeight: '800',
                  fontSize: 15,
                }}
              >
                Paint Area
              </Text>
              <Text
                style={{ color: captionColor(darkMode, Colors), marginTop: 5 }}
              >
                {measurements.paintAreaSqft} sqft detected. What does this
                measurement represent?
              </Text>
              <View style={{ gap: 8, marginTop: 12 }}>
                {[
                  ['walls', 'Walls only'],
                  ['combined', 'Walls and ceilings combined'],
                  ['floor_area', 'Floor area / home size'],
                  ['unknown', 'Not sure'],
                ].map(([basis, label]) => (
                  <TouchableOpacity
                    key={basis}
                    onPress={() =>
                      choosePaintAreaBasis(
                        basis as 'walls' | 'combined' | 'floor_area' | 'unknown'
                      )
                    }
                    style={{
                      borderWidth: 1,
                      borderColor: darkMode
                        ? 'rgba(255,255,255,0.18)'
                        : Colors.line,
                      borderRadius: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: darkMode ? '#F5F7FA' : Colors.text,
                        fontWeight: '700',
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          {String(templateKey || '').toLowerCase() === 'electrical' ? (
            <>
              {showElectricalProjectComplexity
                ? renderProjectComplexityPanel('electrical')
                : null}
              <ElectricalConfirmScopeAttributesPanel
                values={electricalAttributeValues}
                onCommit={patchElectricalAttributes}
                onPreview={onElectricalAttributesPreview}
                commitRef={electricalAttributesCommitRef}
                darkMode={darkMode}
                showExistingService={
                  Number(measurements.serviceUpgradeCount) > 0 ||
                  Number(measurements.existingServiceAmperage) > 0
                }
                hasDetailedQuantities={hasDetailedElectricalQuantities(
                  measurements as Record<string, unknown>
                )}
              />
              {electricalQuantityTakeoffMounted
                ? electricalQuantityTakeoff
                : null}
            </>
          ) : null}
          {String(templateKey || '').toLowerCase() === 'painting' ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: darkMode
                  ? 'rgba(148,163,184,0.28)'
                  : 'rgba(100,116,139,0.24)',
                backgroundColor: darkMode
                  ? 'rgba(148,163,184,0.06)'
                  : 'rgba(148,163,184,0.05)',
                borderRadius: 14,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  color: darkMode ? '#cbd5e1' : '#475569',
                  fontWeight: '800',
                  fontSize: 15,
                }}
              >
                Paint Scope
              </Text>
              <Text
                style={{ color: captionColor(darkMode, Colors), marginTop: 5 }}
              >
                Select the painted surfaces included in this bid.
              </Text>
              <View style={{ gap: 10, marginTop: 14 }}>
                {[
                  ['walls', 'Walls'],
                  ['ceilings', 'Ceilings'],
                  ['trim', 'Baseboards / Trim'],
                  ['doors', 'Interior Doors'],
                  ['cabinets', 'Cabinets'],
                  ['exterior', 'Exterior Paint'],
                ].map(([surface, label]) => {
                  const selected = measurements.paintScope?.includes(
                    surface as never
                  );
                  return (
                    <TouchableOpacity
                      key={surface}
                      onPress={() =>
                        choosePaintScope(
                          surface as NonNullable<
                            ScopeMeasurements['paintScope']
                          >[number]
                        )
                      }
                      activeOpacity={0.85}
                      style={[
                        paintChipStyle(selected),
                        { paddingVertical: 10, paddingHorizontal: 12 },
                      ]}
                    >
                      <Text
                        style={{
                          color: paintChipTextColor(selected),
                          fontWeight: '700',
                          textAlign: 'center',
                        }}
                      >
                        {selected ? '✓ ' : ''}
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {measurements.paintScope?.some(
                surface => surface === 'walls' || surface === 'ceilings'
              ) ? (
                <>
                  <Text
                    style={{
                      color: darkMode ? '#F5F7FA' : Colors.text,
                      fontWeight: '800',
                      fontSize: 15,
                      marginTop: 22,
                    }}
                  >
                    Walls & Ceilings Measurement
                  </Text>
                  <Text
                    style={{
                      color: captionColor(darkMode, Colors),
                      marginTop: 8,
                      lineHeight: 18,
                    }}
                  >
                    {measurements.paintScope?.includes('walls') &&
                    measurements.paintScope?.includes('ceilings')
                      ? 'Use one total when walls and ceilings get the same paint, or enter each surface separately.'
                      : 'The selected surface will be measured separately.'}
                  </Text>
                  {measurements.paintScope?.includes('walls') &&
                  measurements.paintScope?.includes('ceilings') ? (
                    <>
                      <View
                        style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}
                      >
                        {[
                          ['combined', 'Walls + ceilings together'],
                          ['separate', 'Walls and ceilings separate'],
                        ].map(([method, label]) => {
                          const selected =
                            method === 'combined'
                              ? measurements.paintPricingMethod !== 'separate'
                              : measurements.paintPricingMethod === 'separate';
                          return (
                            <TouchableOpacity
                              key={method}
                              onPress={() =>
                                choosePaintPricingMethod(
                                  method as 'combined' | 'separate'
                                )
                              }
                              activeOpacity={0.85}
                              style={[
                                paintChipStyle(selected),
                                {
                                  flex: 1,
                                  paddingVertical: 10,
                                  paddingHorizontal: 12,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: paintChipTextColor(selected),
                                  fontWeight: '700',
                                  textAlign: 'center',
                                  fontSize: 13,
                                  lineHeight: 16,
                                }}
                              >
                                {selected ? '✓ ' : ''}
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {measurements.paintPricingMethod !== 'separate' ? (
                        <View style={{ marginTop: 18, gap: 16 }}>
                          {renderPaintEmbeddedField('paintAreaSqft', 0)}
                        </View>
                      ) : null}
                      {measurements.paintPricingMethod === 'separate' ? (
                        <View style={{ marginTop: 18, gap: 16 }}>
                          {Number(
                            measurements.originalPaintAreaReferenceSqft ||
                              measurements.combinedPaintableAreaSqft ||
                              measurements.paintAreaSqft ||
                              0
                          ) > 0 &&
                          Number(measurements.wallPaintSqft || 0) +
                            Number(measurements.ceilingPaintSqft || 0) <=
                            0 ? (
                            <Text
                              style={{
                                color: captionColor(darkMode, Colors),
                                fontSize: 12,
                                lineHeight: 18,
                              }}
                            >
                              Notes included{' '}
                              {Number(
                                measurements.originalPaintAreaReferenceSqft ||
                                  measurements.combinedPaintableAreaSqft ||
                                  measurements.paintAreaSqft
                              ).toLocaleString()}{' '}
                              sqft as one walls + ceilings total. Enter wall and
                              ceiling areas separately below.
                            </Text>
                          ) : null}
                          {renderPaintEmbeddedField('wallPaintSqft', 0)}
                          {renderPaintEmbeddedField('ceilingPaintSqft', 1)}
                          <View style={{ marginTop: 4 }}>
                            <Text
                              style={{
                                color: captionColor(darkMode, Colors),
                                fontSize: 12,
                                fontWeight: '700',
                              }}
                            >
                              Total walls + ceilings
                            </Text>
                            <Text
                              style={{
                                color: darkMode ? '#F5F7FA' : Colors.text,
                                fontSize: 18,
                                fontWeight: '800',
                                marginTop: 6,
                              }}
                            >
                              {(
                                Number(measurements.wallPaintSqft || 0) +
                                Number(measurements.ceilingPaintSqft || 0)
                              ).toLocaleString()}{' '}
                              sqft
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <View style={{ marginTop: 18, gap: 16 }}>
                      {measurements.paintScope?.includes('walls')
                        ? renderPaintEmbeddedField('wallPaintSqft', 0)
                        : null}
                      {measurements.paintScope?.includes('ceilings')
                        ? renderPaintEmbeddedField('ceilingPaintSqft', 1)
                        : null}
                    </View>
                  )}
                </>
              ) : null}
              {(
                [
                  ['trim', 'baseboardLf'],
                  ['doors', 'interiorDoorCount'],
                  ['cabinets', 'cabinetPaintSqft'],
                  ['cabinets', 'cabinetRunLf'],
                  ['exterior', 'exteriorPaintSqft'],
                ] as Array<
                  [
                    NonNullable<ScopeMeasurements['paintScope']>[number],
                    QuickMeasurementFieldKey,
                  ]
                >
              ).some(([surface]) =>
                measurements.paintScope?.includes(surface)
              ) ? (
                <View style={{ marginTop: 20, gap: 16 }}>
                  {measurements.paintScope?.includes('trim')
                    ? renderPaintEmbeddedField('baseboardLf', 2)
                    : null}
                  {measurements.paintScope?.includes('doors')
                    ? renderPaintEmbeddedField('interiorDoorCount', 3)
                    : null}
                  {measurements.paintScope?.includes('cabinets')
                    ? renderPaintEmbeddedField('cabinetPaintSqft', 4)
                    : null}
                  {measurements.paintScope?.includes('cabinets')
                    ? renderPaintEmbeddedField('cabinetRunLf', 5)
                    : null}
                  {measurements.paintScope?.includes('exterior')
                    ? renderPaintEmbeddedField('exteriorPaintSqft', 6)
                    : null}
                </View>
              ) : null}
              <Text
                style={{
                  color: darkMode ? '#F5F7FA' : Colors.text,
                  fontWeight: '800',
                  fontSize: 14,
                  marginTop: 22,
                }}
              >
                Protection & Prep Assumptions
              </Text>
              <Text
                style={{
                  color: captionColor(darkMode, Colors),
                  marginTop: 8,
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                These selections automatically adjust prep, masking, and
                painting labor. They do not create separate scope items.
              </Text>
              {[
                {
                  key: 'paintOccupancy' as const,
                  label: `Job condition${measurements.paintOccupancyConfirmed ? '' : ' · planning assumption'}`,
                  values: [
                    ['occupied', 'Occupied'],
                    ['vacant', 'Vacant'],
                    ['new_construction', 'New construction'],
                  ],
                  selected: measurements.paintOccupancy,
                },
                {
                  key: 'paintApplicationMethod' as const,
                  label: `Application method${measurements.paintApplicationMethodConfirmed ? '' : ' · planning assumption'}`,
                  values: [
                    ['brush_roll', 'Brush / roll'],
                    ['spray', 'Spray'],
                    ['mixed', 'Brush/roll + spray'],
                  ],
                  selected: measurements.paintApplicationMethod,
                },
              ].map(group => (
                <View key={group.key} style={{ marginTop: 14 }}>
                  <Text
                    style={{
                      color: captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: '700',
                      marginBottom: 6,
                    }}
                  >
                    {group.label}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {group.values.map(([value, label]) => {
                      const selected = group.selected === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          onPress={() =>
                            choosePaintAssumption(group.key, value as never)
                          }
                          style={[
                            paintChipStyle(selected),
                            {
                              flex: 1,
                              paddingVertical: 9,
                              paddingHorizontal: 6,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: paintChipTextColor(selected),
                              fontWeight: '700',
                              fontSize: 11,
                              textAlign: 'center',
                            }}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {wholeHomeLayout ? (
            <>
              {displayGroups.suggestions.length > 1 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    marginBottom: 4,
                  }}
                >
                  <TouchableOpacity
                    onPress={useAllSuggestions}
                    disabled={applying}
                    activeOpacity={0.75}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text
                      style={{
                        color: '#34d399',
                        fontSize: 12,
                        fontWeight: '800',
                      }}
                    >
                      Review and use all suggestions
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {physicalSections.map((section, sectionIndex) => (
                <View
                  key={section.id}
                  style={[
                    styles.quickMeasurementSection,
                    sectionIndex > 0
                      ? styles.quickMeasurementSectionSplit
                      : null,
                    sectionIndex > 0
                      ? {
                          borderTopColor: darkMode
                            ? 'rgba(255,255,255,0.12)'
                            : Colors.line,
                        }
                      : null,
                  ]}
                >
                  {sectionTitle(section.title)}
                  {/* Single-column on whole-home — side-by-side suggestion cards were too cramped. */}
                  {section.rows.flat().map((field, index) => {
                    const result = resultByKey.get(field.key);
                    if (!result) return null;
                    return renderResultField(
                      result,
                      fieldVariantForResult(result),
                      homeGroupForResult(result),
                      index
                    );
                  })}
                </View>
              ))}
            </>
          ) : plumbingMeasurementFlow ? (
            <>
              {showPlumbingProjectComplexity
                ? renderProjectComplexityPanel('plumbing')
                : null}
              {renderPlumbingMeasurementsPanel()}
            </>
          ) : (
            <>
              {showWetAreaFinishSteppers && bathroomPhotoWetArea ? (
                <>
                  {showExistingWetAreaPanel
                    ? renderExistingWetAreaPanel()
                    : null}
                  {renderWetAreaFinishPanel()}
                  {renderDemoTearOutPanel()}
                </>
              ) : null}

              {bathroomFixturesQmJob ? (
                <QmBathroomFixturesPanels
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  notes={notes}
                  includedScopeKeys={includedScopeKeys}
                  hasSitePhotos={hasSitePhotos}
                  showExistingPanel={!hasSitePhotos}
                  applying={applying}
                  onBathroomFixturesQmChange={onBathroomFixturesQmChange}
                  onBathroomCountertopMaterialChange={
                    onBathroomCountertopMaterialChange
                  }
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}

              {kitchenQmJob ? (
                <QmKitchenScopePanels
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  notes={notes}
                  includedScopeKeys={includedScopeKeys}
                  hasSitePhotos={hasSitePhotos}
                  showExistingPanel={!hasSitePhotos}
                  applying={applying}
                  onKitchenQmChange={onKitchenQmChange}
                  measurementFooter={kitchenMeasurementFooter}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}

              {flooringQmJob ? (
                <QmFlooringScopePanels
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  notes={notes}
                  showExistingPanel={!hasSitePhotos}
                  applying={applying}
                  onFlooringQmChange={onFlooringQmChange}
                  onFlooringScopeSync={onFlooringScopeSync}
                  onFlooringBottomCollapse={onFlooringBottomCollapse}
                  onFloorPrepCollapse={onFloorPrepCollapse}
                  scrollRef={scrollRef}
                  scrollContentRef={scrollContentRef}
                  measurementFooter={flooringMeasurementFooter}
                  measurementFootersByKey={flooringMeasurementFootersByKey}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}

              {landscapingQmJob ? (
                <QmLandscapingScopePanels
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}

              {concreteQmJob ? (
                <QmConcreteScopePanels
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {deckQmJob ? (
                <QmSimpleTradeScopePanels
                  scopeKey='deck_patio'
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {hvacQmJob ? (
                <QmSimpleTradeScopePanels
                  scopeKey='hvac'
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  onScopeSelectionChange={onHvacScopeSelectionChange}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {roofingQmJob ? (
                <QmRoofingScopePanels
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {stuccoQmJob ? (
                <QmStuccoScopePanels
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                  applying={applying}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}

              {displayGroups.fromPlan.some(shouldRenderGeneralResult) ? (
                <View style={styles.quickMeasurementSection}>
                  {sectionTitle('From plan')}
                  {displayGroups.fromPlan.map((result, index) =>
                    renderDisplayedResultField(
                      result,
                      'calm',
                      'fromPlan',
                      index
                    )
                  )}
                </View>
              ) : null}

              {displayGroups.suggestions.some(shouldRenderGeneralResult) ? (
                <View style={styles.quickMeasurementSection}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    {sectionTitle('Suggestions')}
                    {displayGroups.suggestions.length > 1 ? (
                      <TouchableOpacity
                        onPress={useAllSuggestions}
                        disabled={applying}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text
                          style={{
                            color: '#34d399',
                            fontSize: 12,
                            fontWeight: '800',
                          }}
                        >
                          Review and use all
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {displayGroups.suggestions.map((result, index) =>
                    renderDisplayedResultField(
                      result,
                      'suggestion',
                      'suggestions',
                      index
                    )
                  )}
                </View>
              ) : null}

              {displayGroups.needsConfirmation.some(
                shouldRenderGeneralResult
              ) ? (
                <View
                  style={[
                    styles.quickMeasurementSection,
                    styles.quickMeasurementSectionSplit,
                    {
                      borderTopColor: darkMode
                        ? 'rgba(255,255,255,0.12)'
                        : Colors.line,
                    },
                  ]}
                >
                  {sectionTitle('Needs confirmation', '#fbbf24')}
                  {displayGroups.needsConfirmation.map((result, index) =>
                    renderDisplayedResultField(
                      result,
                      'needs_confirmation',
                      'needsConfirmation',
                      index
                    )
                  )}
                </View>
              ) : null}

              {displayGroups.confirmed.some(shouldRenderGeneralResult) ? (
                <View
                  style={[
                    styles.quickMeasurementSection,
                    styles.quickMeasurementSectionSplit,
                    {
                      borderTopColor: darkMode
                        ? 'rgba(255,255,255,0.12)'
                        : Colors.line,
                    },
                  ]}
                >
                  {sectionTitle('Confirmed')}
                  {displayGroups.confirmed.map((result, index) =>
                    renderDisplayedResultField(
                      result,
                      'calm',
                      'confirmed',
                      index
                    )
                  )}
                </View>
              ) : null}

              {displayGroups.more.some(shouldRenderGeneralResult) ? (
                <View
                  style={[
                    styles.quickMeasurementSection,
                    styles.quickMeasurementSectionSplit,
                    {
                      borderTopColor: darkMode
                        ? 'rgba(255,255,255,0.12)'
                        : Colors.line,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setMoreExpanded(v => !v)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={[
                        styles.quickMeasurementSectionTitle,
                        { color: captionColor(darkMode, Colors) },
                      ]}
                    >
                      More measurements · {displayGroups.more.length}
                    </Text>
                    <Ionicons
                      name={moreExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={captionColor(darkMode, Colors)}
                    />
                  </TouchableOpacity>
                  {moreExpanded
                    ? displayGroups.more.map((result, index) =>
                        renderDisplayedResultField(
                          result,
                          'more',
                          'more',
                          index
                        )
                      )
                    : null}
                </View>
              ) : null}
            </>
          )}

          {showWetAreaFinishSteppers && !bathroomPhotoWetArea
            ? renderWetAreaFinishPanel()
            : null}

          {showGarageDoorSteppers ? (
            <View
              style={[
                styles.quickMeasurementSection,
                styles.quickMeasurementSectionSplit,
                {
                  borderTopColor: darkMode
                    ? 'rgba(255,255,255,0.12)'
                    : Colors.line,
                },
              ]}
            >
              {sectionTitle('Garage doors', darkMode ? '#F5F7FA' : Colors.text)}
              <Text
                style={{
                  color: darkMode ? 'rgba(245,247,250,0.78)' : Colors.sub,
                  fontSize: 11,
                  lineHeight: 15,
                  marginBottom: 4,
                }}
              >
                Single, double, and RV / oversized — totals update below.
              </Text>
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: darkMode
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(15,23,42,0.08)',
                  backgroundColor: darkMode
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(15,23,42,0.02)',
                  paddingHorizontal: 12,
                  paddingTop: 2,
                  paddingBottom: 2,
                }}
              >
                {renderGarageDoorTypeRow('single', 'Single')}
                {renderGarageDoorTypeRow('double', 'Double')}
                {renderGarageDoorTypeRow('rv', 'RV / oversized')}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                  }}
                >
                  <Text
                    style={{
                      color: captionColor(darkMode, Colors),
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {garageDoorPackage
                      ? `${garageDoorPackage.quantity} door${garageDoorPackage.quantity === 1 ? '' : 's'}`
                      : 'No doors selected'}
                  </Text>
                  <Text
                    style={{
                      color: garageDoorPackage
                        ? darkMode
                          ? '#F5F7FA'
                          : Colors.text
                        : captionColor(darkMode, Colors),
                      fontSize: 15,
                      fontWeight: '800',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {garageDoorPackage
                      ? `~$${garageDoorPackage.total.toLocaleString()}`
                      : '—'}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {showDone ? (
            <TouchableOpacity
              onPress={onDone || onToggle}
              activeOpacity={0.75}
              style={styles.quickMeasurementsDone}
            >
              <Text
                style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}
              >
                Done
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ScopeGroupSection({
  title,
  items,
  collapsed,
  onToggle,
  renderItem,
  noteSummary,
  Colors,
  darkMode,
}: {
  title: string;
  items: ScopeChecklistItem[];
  collapsed: boolean;
  onToggle: () => void;
  renderItem: (item: ScopeChecklistItem) => React.ReactNode;
  noteSummary?: { fromNotes: number; toConfirm: number };
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  if (!items.length) return null;

  const allSecondary =
    noteSummary != null &&
    noteSummary.fromNotes === 0 &&
    noteSummary.toConfirm === items.length;
  const headerOpacity = allSecondary ? SCOPE_ITEM_TIER_OPACITY.secondary : 1;

  return (
    <View style={styles.groupSection}>
      {title ? (
        <TouchableOpacity
          style={[
            styles.groupHeader,
            {
              borderBottomColor: dividerColor(darkMode),
              opacity: headerOpacity,
            },
          ]}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: darkMode ? '#F5F7FA' : Colors.text,
                fontSize: 13,
                fontWeight: '800',
              }}
            >
              {title}
            </Text>
            {noteSummary &&
            (noteSummary.fromNotes > 0 || noteSummary.toConfirm > 0) ? (
              <Text
                style={{
                  color: captionColor(darkMode, Colors),
                  fontSize: 10,
                  marginTop: 2,
                }}
              >
                {noteSummary.fromNotes > 0
                  ? scopeLinkedToNotesSummary(noteSummary.fromNotes)
                  : null}
                {noteSummary.fromNotes > 0 && noteSummary.toConfirm > 0
                  ? ' · '
                  : null}
                {noteSummary.toConfirm > 0
                  ? `${noteSummary.toConfirm} to confirm`
                  : null}
              </Text>
            ) : null}
          </View>
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 11,
              marginRight: 6,
            }}
          >
            {items.length}
          </Text>
          <Ionicons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={captionColor(darkMode, Colors)}
          />
        </TouchableOpacity>
      ) : null}
      {!collapsed || !title
        ? items.map(item => (
            <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>
          ))
        : null}
    </View>
  );
}

export default function AIEstimateScopeAssumptionsModal({
  visible,
  draft,
  notesFallback,
  applying = false,
  fromAssistant = false,
  onBack,
  onConfirm,
  onConfirmBegin,
  onPersistProgress,
  pricingContext = null,
  hasSitePhotos = false,
  planImport = null,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const checklist = draft?.scopeChecklist;
  const scopeNotes = useMemo(
    () => chooseBestScopeNotes(draft, notesFallback),
    [draft, notesFallback]
  );
  const [items, setItems] = useState<ScopeChecklistItem[]>([]);
  const baseItemsRef = useRef<ScopeChecklistItem[]>([]);
  const [notesTradeMode, setNotesTradeMode] =
    useState<NotesScopeMode>('whole_project');
  const [measurements, setMeasurements] =
    useState<ScopeMeasurementsInputExtended>({
      ...emptyQuickMeasurementInput(),
      itemQuantities: {},
    });
  const [electricalPreviewMeasurements, setElectricalPreviewMeasurements] =
    useState<ScopeMeasurementsInputExtended | null>(null);
  const deferredMeasurements = useDeferredValue(measurements);
  const [quickMeasurementsOpen, setQuickMeasurementsOpen] = useState(true);
  // Confirm Scope reuses this modal instance — open Quick measurements on each entry.
  useEffect(() => {
    if (visible) setQuickMeasurementsOpen(true);
  }, [visible]);
  const [quickMeasurementSummary, setQuickMeasurementSummary] =
    useState<QuickMeasurementSummary>({
      detected: 0,
      estimateAvailable: 0,
      needsConfirmation: 0,
      confirmed: 0,
      relevantTotal: 0,
    });
  const footerQuickMeasurementSummaryRef = useRef(quickMeasurementSummary);
  const quickMeasurementsWasOpenRef = useRef(quickMeasurementsOpen);
  useEffect(() => {
    if (quickMeasurementsOpen && !quickMeasurementsWasOpenRef.current) {
      footerQuickMeasurementSummaryRef.current = quickMeasurementSummary;
    }
    if (!quickMeasurementsOpen) {
      footerQuickMeasurementSummaryRef.current = quickMeasurementSummary;
    }
    quickMeasurementsWasOpenRef.current = quickMeasurementsOpen;
  }, [quickMeasurementsOpen, quickMeasurementSummary]);
  const footerQuickMeasurementSummary = quickMeasurementsOpen
    ? footerQuickMeasurementSummaryRef.current
    : quickMeasurementSummary;
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const [customItemLabel, setCustomItemLabel] = useState('');
  const [showCustomItemInput, setShowCustomItemInput] = useState(false);
  const [benchmarkReasonableness, setBenchmarkReasonableness] =
    useState<BenchmarkReasonableness | null>(null);
  const [benchmarkRefresh, setBenchmarkRefresh] = useState(0);
  const itemsRef = useRef(items);
  const measurementsRef = useRef(measurements);
  const electricalMeasurementsStagedRef = useRef(false);
  const electricalScopeSyncKeyRef = useRef('');
  const electricalQmQuantityEditingRef = useRef(false);
  const electricalAttributesCommitRef = useRef<(() => void) | null>(null);
  const selectedPricingRef = useRef<Record<string, SuggestedPricingBlock>>({});
  useEffect(() => {
    if (!electricalPreviewMeasurements) return;
    // Keep the preview through the commit render, then release it so later
    // edits made directly on scope cards cannot read an older QM snapshot.
    if (measurements === electricalPreviewMeasurements) {
      setElectricalPreviewMeasurements(null);
    }
  }, [measurements, electricalPreviewMeasurements]);
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const customScopeSectionRef = useRef<View>(null);
  const pendingCustomItemScrollRef = useRef<string | null>(null);
  const scrollOffsetYRef = useRef(0);
  const quickMeasurementsRef = useRef<View>(null);
  const pendingQmDoneScrollRef = useRef(false);
  const qmDoneFirstScopeItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (String(checklist?.templateKey || '').toLowerCase() !== 'flooring')
      return;
    const productMeasurementKeys: Record<
      string,
      keyof ScopeMeasurementsInputExtended
    > = {
      lvp: 'flooringLvpSqft',
      laminate: 'flooringLaminateSqft',
      engineered_hardwood: 'flooringEngineeredHardwoodSqft',
      solid_hardwood: 'flooringSolidHardwoodSqft',
      tile: 'flooringTileSqft',
      carpet: 'flooringCarpetSqft',
    };
    const products = Array.isArray(measurements.flooringProductScope)
      ? measurements.flooringProductScope
      : [];
    const total = products.reduce((sum, product) => {
      const key = productMeasurementKeys[product];
      const directQuantity = key ? Number(measurements[key] || 0) : 0;
      const itemQuantity = Number(
        measurements.itemQuantities?.[`floor_install__${product}`]?.quantity ||
          0
      );
      return sum + (directQuantity || itemQuantity);
    }, 0);
    const currentTotal = Number(
      String(measurements.floorAreaSqft || '').replace(/,/g, '')
    );
    if (total <= 0 || Math.abs(currentTotal - total) < 0.01) return;
    setMeasurements(prev => ({
      ...prev,
      floorAreaSqft: total,
      flooringSqft: total,
      quickMeasurementSources: {
        ...(prev.quickMeasurementSources || {}),
        floorAreaSqft: 'user_entered',
        flooringSqft: 'user_entered',
      },
      quickMeasurementUserOverrides: {
        ...(prev.quickMeasurementUserOverrides || {}),
        floorAreaSqft: true,
        flooringSqft: true,
      },
    }));
  }, [
    checklist?.templateKey,
    measurements.flooringProductScope,
    measurements.flooringLvpSqft,
    measurements.flooringLaminateSqft,
    measurements.flooringEngineeredHardwoodSqft,
    measurements.flooringSolidHardwoodSqft,
    measurements.flooringTileSqft,
    measurements.flooringCarpetSqft,
    measurements.flooringSqft,
    measurements.floorAreaSqft,
    measurements.itemQuantities,
  ]);

  const reasonablenessLivingSf = useMemo(
    () =>
      resolveBenchmarkLivingSf({
        measurementsInput: measurements,
        draftMeasurements: draft?.scopeMeasurements,
        templateKey: checklist?.templateKey,
      }),
    [measurements, draft?.scopeMeasurements, checklist?.templateKey]
  );

  const appliedBuildCostTemplateKey = useMemo(() => {
    const living =
      Number(String(measurements.floorAreaSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.mainFloorLivingSqft) ||
      null;
    const garage =
      Number(String(measurements.garageSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.garageSqft) ||
      null;
    return resolveEffectiveQuickMeasurementTemplateKey({
      templateKey: checklist?.templateKey,
      projectType: draft?.projectType,
      planRoomCount: Array.isArray(measurements.planRooms)
        ? measurements.planRooms.length
        : 0,
      livingSf: living,
      garageSf: garage,
    });
  }, [
    checklist?.templateKey,
    draft?.projectType,
    measurements.floorAreaSqft,
    measurements.garageSqft,
    measurements.planRooms,
    measurements.planFacts,
  ]);
  const showAppliedBuildCostPerSf = shouldShowAppliedBuildCostPerSf(
    appliedBuildCostTemplateKey
  );

  const appliedBuildCostArea = useMemo(
    () =>
      showAppliedBuildCostPerSf
        ? resolveAppliedBuildCostArea({
            measurementsInput: measurements,
            norm: buildNormalizedScopeMeasurementsFromInput(measurements, {
              notes: scopeNotes,
              templateKey: checklist?.templateKey,
            }),
            draftMeasurements: draft?.scopeMeasurements,
            templateKey: checklist?.templateKey,
          })
        : null,
    [
      showAppliedBuildCostPerSf,
      measurements,
      draft?.scopeMeasurements,
      checklist?.templateKey,
      scopeNotes,
    ]
  );

  const planImportContext = useMemo(
    () =>
      resolveSingleTradePlanContext({
        measurements,
        draftScopeMeasurements: draft?.scopeMeasurements,
        planImport,
      }),
    [
      measurements.planImportMode,
      measurements.planImportTradeKey,
      draft?.scopeMeasurements?.planImportMode,
      draft?.scopeMeasurements?.planImportTradeKey,
      planImport?.estimatingMode,
      planImport?.selectedTrade,
    ]
  );

  const singleTradePlanImport = planImportContext.isSingleTrade;
  const singleTradeKey = planImportContext.tradeKey;
  const pendingPlanConfirmationAllowedFields = useMemo(() => {
    const tradeKeyForPending =
      (measurements.planImportTradeKey as PlanTradeKey | null | undefined) ||
      singleTradeKey ||
      null;
    if (tradeKeyForPending === 'hvac') {
      return new Set<string>(HVAC_PLAN_REVIEW_CANONICAL_KEYS);
    }
    const trade = tradeKeyForPending
      ? getPlanTradeConfiguration(tradeKeyForPending)
      : null;
    const keys = trade?.reviewMeasurementKeys;
    return keys?.length ? new Set(keys) : undefined;
  }, [measurements.planImportTradeKey, singleTradeKey]);
  const notesScopeSelectorVisible =
    !planImport &&
    !singleTradePlanImport &&
    String(checklist?.templateKey || '').toLowerCase() === 'bathroom';
  const notesPlumbingFlow =
    notesScopeSelectorVisible &&
    (notesTradeMode !== 'whole_project' ||
      measurements.tradeWorkflowSource === 'standalone_trade');
  const effectiveNotesTradeMode =
    notesTradeMode !== 'whole_project'
      ? notesTradeMode
      : measurements.plumbingWorkflowMode === 'service'
        ? 'plumbing_service'
        : measurements.tradeWorkflowSource === 'standalone_trade'
          ? 'plumbing'
          : 'whole_project';
  const plumbingItemIds = useMemo(
    () => new Set(PLUMBING_CARDS.map(card => card.itemId)),
    []
  );
  const notesPlumbingPricingTemplateKey =
    effectiveNotesTradeMode === 'plumbing_service'
      ? 'plumbing_service'
      : 'plumbing';
  const scopeCardTemplateKey = useCallback(
    (itemId: string) => {
      if (notesPlumbingFlow && plumbingItemIds.has(itemId)) {
        return notesPlumbingPricingTemplateKey;
      }
      return checklist?.templateKey ?? null;
    },
    [
      notesPlumbingFlow,
      plumbingItemIds,
      notesPlumbingPricingTemplateKey,
      checklist?.templateKey,
    ]
  );
  const scopePricingTemplateKey = notesPlumbingFlow
    ? notesPlumbingPricingTemplateKey
    : checklist?.templateKey ?? null;
  const wholeProjectFlow =
    planImport?.estimatingMode === 'whole_project' ||
    ['ground_up', 'whole_project'].includes(
      String(checklist?.templateKey || '').toLowerCase()
    ) ||
    ['ground_up', 'whole_project'].includes(
      String(draft?.projectType || '').toLowerCase()
    );
  const stuccoTradeFlow =
    !wholeProjectFlow &&
    (items.some(
      item => item.id === 'stucco' || item.id.startsWith('stucco_')
    ) ||
      /\bstucco\b|exterior\s+finish/i.test(scopeNotes));

  const displayItems = useMemo(() => {
    const expanded = buildConfirmScopeDisplayItems(
      items,
      measurements as Record<string, unknown>,
      checklist?.templateKey
    );
    const drywallLayoutCtx = {
      measurements: measurements as Record<string, unknown>,
      planImportMode: measurements.planImportMode ?? null,
      planImportTradeKey: measurements.planImportTradeKey ?? null,
    };
    const withDrywallLayout = (list: ScopeChecklistItem[]) =>
      finalizeDrywallScopeChecklistLayout(
        list,
        checklist?.templateKey,
        drywallLayoutCtx
      );
    if (singleTradePlanImport && singleTradeKey) {
      return withDrywallLayout(
        filterChecklistItemsForTrade(
          expanded,
          'selected_trade',
          singleTradeKey
        )
      );
    }
    if (notesPlumbingFlow) {
      return withDrywallLayout(
        expanded.filter(
          item =>
            plumbingItemIds.has(item.id) || isCustomScopeChecklistItem(item)
        )
      );
    }
    if (stuccoTradeFlow) {
      const customOnly = expanded.filter(isCustomScopeChecklistItem);
      return withDrywallLayout([
        ...buildStuccoTradeChecklistItems(expanded),
        ...customOnly,
      ]);
    }
    if (String(checklist?.templateKey || '').toLowerCase() !== 'flooring')
      return withDrywallLayout(expanded);
    const description = flooringDemoDescription(
      measurements,
      scopeNotes,
      checklist?.templateKey
    );
    const flooringOrder = (itemId: string): number => {
      if (itemId === 'floor_demo') return 0;
      if (itemId === 'floor_prep') return 1;
      if (
        [
          'flooring_lvp',
          'flooring_laminate',
          'flooring_engineered_hardwood',
          'flooring_solid_hardwood',
          'tile_flooring',
          'flooring_carpet',
          'flooring_sheet_vinyl',
          'flooring',
        ].includes(itemId)
      ) {
        return 2;
      }
      return 3;
    };
    return expanded
      .map((item, index) => ({
        item:
          item.id === 'floor_demo'
            ? {
                ...item,
                label: 'Demo Existing Flooring',
                helperText: description,
              }
            : item,
        index,
      }))
      .sort(
        (a, b) =>
          flooringOrder(a.item.id) - flooringOrder(b.item.id) ||
          a.index - b.index
      )
      .map(({ item }) => item);
  }, [
    items,
    checklist?.templateKey,
    draft?.projectType,
    scopeNotes,
    singleTradePlanImport,
    singleTradeKey,
    notesPlumbingFlow,
    plumbingItemIds,
    stuccoTradeFlow,
    measurements.flooringExistingTypes,
    measurements.itemQuantities,
    measurements.tradeScopeSelections,
    measurements.flooringProductScope,
    measurements.flooringLvpSqft,
    measurements.flooringLaminateSqft,
    measurements.flooringEngineeredHardwoodSqft,
    measurements.flooringSolidHardwoodSqft,
    measurements.flooringTileSqft,
    measurements.flooringCarpetSqft,
    measurements.flooringSheetVinylSqft,
    measurements.planImportMode,
    measurements.planImportTradeKey,
    measurements.bathroomInstallVanityCount,
    measurements.bathroomInstallCounterCount,
    measurements.bathroomDemoVanityCount,
    measurements.bathroomDemoCounterCount,
  ]);

  const { templateItems: templateDisplayItems, customItems: customScopeItems } =
    useMemo(() => partitionScopeChecklistItems(displayItems), [displayItems]);

  const customScopeItemPlaceholder = useMemo(
    () =>
      resolveCustomScopeItemPlaceholder({
        templateKey: checklist?.templateKey,
        planImportTradeKey:
          measurements.planImportTradeKey ?? planImport?.selectedTrade ?? null,
        notes: scopeNotes,
      }),
    [
      checklist?.templateKey,
      measurements.planImportTradeKey,
      planImport?.selectedTrade,
      scopeNotes,
    ]
  );

  const enrichedPricingContext = useMemo(
    () =>
      displayItems.length
        ? { ...(pricingContext || {}), checklistItems: displayItems }
        : pricingContext,
    [pricingContext, displayItems]
  );

  /** Applied Confirm Scope dollars — same list as scope cards (flatwork / openings / wet-area). */
  const appliedPricingMeasurementInput =
    String(checklist?.templateKey || '').toLowerCase() === 'electrical'
      ? deferredMeasurements
      : measurements;
  const measurementsForAppliedPricing = useMemo(
    () =>
      clearSupersededStageHostPricing(
        appliedPricingMeasurementInput,
        checklist?.templateKey
      ),
    [appliedPricingMeasurementInput, checklist?.templateKey]
  );
  const step2AppliedPricingBreakdown = useMemo(
    () =>
      sumConfirmScopeAppliedPricingBreakdown({
        items: displayItems,
        measurements: measurementsForAppliedPricing,
        templateKey: checklist?.templateKey,
      }),
    [displayItems, measurementsForAppliedPricing, checklist?.templateKey]
  );
  const step2AppliedEstimateTotal = step2AppliedPricingBreakdown.total;
  const step2AppliedBuildCostPerLivingSf = useMemo(
    () =>
      showAppliedBuildCostPerSf && appliedBuildCostArea
        ? computeAppliedBuildCostPerLivingSf(
            step2AppliedEstimateTotal,
            appliedBuildCostArea.sqft
          )
        : null,
    [showAppliedBuildCostPerSf, step2AppliedEstimateTotal, appliedBuildCostArea]
  );
  const step2AppliedPricingLines = useMemo(
    () =>
      listConfirmScopeAppliedPricingLines({
        items: displayItems,
        measurements: measurementsForAppliedPricing,
        templateKey: checklist?.templateKey,
      }),
    [displayItems, measurementsForAppliedPricing, checklist?.templateKey]
  );

  const benchmarkFetchKey = useMemo(
    () =>
      JSON.stringify({
        visible,
        itemIds: items
          .filter(item => item.inScope !== false)
          .map(item => item.id),
        livingSf: reasonablenessLivingSf || 0,
        garageSf: Number(measurements.garageSqft || 0),
        patioPorchSf: Number(measurements.deckSqft || 0),
        drywallSf: Number(measurements.drywallSqft || 0),
        roofSquares: Number(measurements.roofSquares || 0),
        estimateTotal: step2AppliedEstimateTotal,
      }),
    [
      visible,
      items,
      measurements.garageSqft,
      measurements.deckSqft,
      measurements.drywallSqft,
      measurements.roofSquares,
      reasonablenessLivingSf,
      step2AppliedEstimateTotal,
    ]
  );

  useEffect(() => {
    if (!benchmarkEngineV1Enabled() || !showAppliedBuildCostPerSf) {
      setBenchmarkReasonableness(null);
      return;
    }
    const context = JSON.parse(benchmarkFetchKey) as {
      visible: boolean;
      itemIds: string[];
      livingSf: number;
      garageSf: number;
      patioPorchSf: number;
      drywallSf: number;
      roofSquares: number;
      estimateTotal: number;
    };
    if (
      !context.visible ||
      !context.itemIds.length ||
      !(context.livingSf > 0)
    ) {
      setBenchmarkReasonableness(null);
      return;
    }
    // Wait until Confirm Scope has Applied dollars before computing $/living SF.
    if (!(context.estimateTotal > 0)) {
      setBenchmarkReasonableness(null);
      return;
    }
    let cancelled = false;
    void fetchBenchmarkSuggestions({
      itemIds: context.itemIds,
      livingSf: context.livingSf,
      garageSf: context.garageSf || undefined,
      patioPorchSf: context.patioPorchSf || undefined,
      buildingType: 'detached',
      estimateTotal: context.estimateTotal || undefined,
      primaryTakeoffs: {
        ...(context.drywallSf > 0
          ? {
              drywall: {
                quantity: context.drywallSf,
                unit: 'surface_sqft',
                source: 'plan_takeoff',
              },
            }
          : {}),
        ...(() => {
          // Thermal envelope — never inherit drywall living×3.5 surface.
          const envelope = resolveInsulationEnvelopePlanningQuantity(
            insulationEnvelopeInputsFromPlanFacts(
              measurements.planFacts,
              context.livingSf
            )
          );
          if (!(envelope?.totalInsulationEnvelopeSqft > 0)) return {};
          return {
            insulation: {
              quantity: envelope.totalInsulationEnvelopeSqft,
              unit: 'surface_sqft',
              source: 'plan_takeoff',
            },
          };
        })(),
        ...(context.roofSquares > 0
          ? {
              roofing: {
                quantity: context.roofSquares,
                unit: 'roof_square',
                source: 'plan_takeoff',
              },
            }
          : {}),
      },
    })
      .then(response => {
        if (cancelled) return;
        setBenchmarkReasonableness(response?.reasonableness || null);
        setBenchmarkRefresh(value => value + 1);
      })
      .catch(() => {
        if (!cancelled) setBenchmarkReasonableness(null);
      });
    return () => {
      cancelled = true;
    };
  }, [benchmarkFetchKey, showAppliedBuildCostPerSf]);
  const itemRefs = useRef<Record<string, View | null>>({});
  const pendingScrollToScopeItemRef = useRef<string | null>(null);
  const focusedQuantityRef = useRef<string | null>(null);
  const [pricingEditorRequest, setPricingEditorRequest] = useState<{
    itemId: string;
    token: number;
  } | null>(null);
  const clearPricingEditorRequest = useCallback(
    () => setPricingEditorRequest(null),
    []
  );
  const hydratedVisibleSessionRef = useRef(false);
  const livePlanImportHandoffKeyRef = useRef('');

  const setMeasurementsSynced = useCallback(
    (update: React.SetStateAction<ScopeMeasurementsInputExtended>) => {
      const previous = measurementsRef.current;
      const next =
        typeof update === 'function'
          ? (
              update as (
                prev: ScopeMeasurementsInputExtended
              ) => ScopeMeasurementsInputExtended
            )(previous)
          : update;
      if (next === previous) return;
      let reconciled = next;
      if (
        reconciled.planImportTradeKey === 'plumbing' ||
        ['plumbing', 'plumbing_service'].includes(
          String(checklist?.templateKey || '').toLowerCase()
        )
      ) {
        reconciled = applySouthernUtahPlumbingPackageTakeoffDefaults(
          reconciled as Record<string, unknown>
        ) as ScopeMeasurementsInputExtended;
        reconciled = reconcilePlumbingLineScopeMeasurements(
          reconciled as Record<string, unknown>
        ) as ScopeMeasurementsInputExtended;
        reconciled = reconcilePlumbingEquipmentScopeMeasurements(
          reconciled as Record<string, unknown>
        ) as ScopeMeasurementsInputExtended;
        const complexityPatches = hydrateProjectComplexityInputFields({
          ...reconciled,
          floorAreaSqft: reconciled.floorAreaSqft,
          storyCount: reconciled.storyCount,
          planFacts: reconciled.planFacts,
          plumbingComplexityFactors: reconciled.plumbingComplexityFactors,
          planImportMode: reconciled.planImportMode,
          planImportTradeKey: reconciled.planImportTradeKey,
          planImportFingerprint: reconciled.planImportFingerprint,
          quickMeasurementSources: reconciled.quickMeasurementSources,
        });
        if (complexityPatches.storyCount || complexityPatches.floorAreaSqft) {
          reconciled = {
            ...reconciled,
            ...complexityPatches,
            ...(complexityPatches.storyCount &&
            !reconciled.quickMeasurementUserOverrides?.storyCount
              ? {
                  quickMeasurementSources: {
                    ...(reconciled.quickMeasurementSources || {}),
                    storyCount: 'plan_detected',
                  },
                }
              : {}),
            ...(complexityPatches.floorAreaSqft &&
            !reconciled.quickMeasurementUserOverrides?.floorAreaSqft
              ? {
                  quickMeasurementSources: {
                    ...(reconciled.quickMeasurementSources || {}),
                    floorAreaSqft: 'plan_detected',
                  },
                }
              : {}),
          };
        }
      }
      if (
        reconciled.planImportTradeKey === 'electrical' ||
        String(checklist?.templateKey || '').toLowerCase() === 'electrical'
      ) {
        const complexityPatches = hydrateProjectComplexityInputFields({
          ...reconciled,
          floorAreaSqft: reconciled.floorAreaSqft,
          storyCount: reconciled.storyCount,
          planFacts: reconciled.planFacts,
          plumbingComplexityFactors: reconciled.plumbingComplexityFactors,
          planImportMode: reconciled.planImportMode,
          planImportTradeKey: reconciled.planImportTradeKey,
          planImportFingerprint: reconciled.planImportFingerprint,
          quickMeasurementSources: reconciled.quickMeasurementSources,
        });
        if (complexityPatches.storyCount || complexityPatches.floorAreaSqft) {
          reconciled = {
            ...reconciled,
            ...complexityPatches,
            ...(complexityPatches.storyCount &&
            !reconciled.quickMeasurementUserOverrides?.storyCount
              ? {
                  quickMeasurementSources: {
                    ...(reconciled.quickMeasurementSources || {}),
                    storyCount: 'plan_detected',
                  },
                }
              : {}),
            ...(complexityPatches.floorAreaSqft &&
            !reconciled.quickMeasurementUserOverrides?.floorAreaSqft
              ? {
                  quickMeasurementSources: {
                    ...(reconciled.quickMeasurementSources || {}),
                    floorAreaSqft: 'plan_detected',
                  },
                }
              : {}),
          };
        }
      }
      reconciled = resyncAppliedScopePricingAfterMeasurementChanges({
        previous,
        next: reconciled,
        templateKey: checklist?.templateKey,
        notes: scopeNotes,
        pricingContext: enrichedPricingContext,
      });
      // The selected Apply block is also used when the scope payload is
      // persisted. Keep it aligned with the current plumbing takeoff or the
      // old 50-LF block can overwrite the newly resynced 70-LF pricing.
      if (
        reconciled.planImportTradeKey === 'plumbing' ||
        ['plumbing', 'plumbing_service'].includes(
          String(checklist?.templateKey || '').toLowerCase()
        )
      ) {
        const selected = { ...selectedPricingRef.current };
        let selectedChanged = false;
        for (const [itemId, block] of Object.entries(selected)) {
          const card = plumbingCardForItemId(itemId);
          if (!card) continue;
          const quantity = Number(
            String(
              (reconciled as Record<string, unknown>)[card.measurementKey] ?? ''
            ).replace(/,/g, '')
          );
          if (!(quantity > 0)) continue;
          const syncedBlock = scaleSuggestedBlockToTakeoffQuantity(
            block,
            quantity
          );
          if (syncedBlock !== block) {
            selected[itemId] = syncedBlock;
            selectedChanged = true;
          }
        }
        if (selectedChanged) selectedPricingRef.current = selected;
      }
      // Drop stage-host Applied dollars once trade children are priced so card
      // badges match the Applied pricing summary (no silent double-count).
      reconciled = clearSupersededStageHostPricing(
        reconciled,
        checklist?.templateKey
      );
      if (
        reconciled.planImportTradeKey === 'framing' ||
        String(checklist?.templateKey || '').toLowerCase() === 'framing'
      ) {
        reconciled = reconcileFramingScopeMeasurements(
          reconciled as Record<string, unknown>
        ) as ScopeMeasurementsInputExtended;
      }
      if (
        reconciled.planImportMode === 'selected_trade' &&
        reconciled.planImportTradeKey === 'stucco'
      ) {
        const gross =
          parseScopeMeasurementInput(
            String(reconciled.stuccoGrossWallSqft ?? '')
          ) || 0;
        const hasWindowDoorInput =
          String(reconciled.stuccoWindowDoorOpeningSqft ?? '').trim() !== '';
        const hasGarageInput =
          String(reconciled.stuccoGarageOpeningSqft ?? '').trim() !== '';
        const hasOtherFinishInput =
          String(reconciled.stuccoOtherFinishDeductionSqft ?? '').trim() !== '';
        // Don't publish net===gross while opening fields are still blank — that
        // looked "confirmed" and hid the missing window/door takeoff.
        if (
          gross > 0 &&
          (hasWindowDoorInput || hasGarageInput || hasOtherFinishInput)
        ) {
          const openings =
            (parseScopeMeasurementInput(
              String(reconciled.stuccoWindowDoorOpeningSqft ?? '')
            ) || 0) +
            (parseScopeMeasurementInput(
              String(reconciled.stuccoGarageOpeningSqft ?? '')
            ) || 0) +
            (parseScopeMeasurementInput(
              String(reconciled.stuccoOtherFinishDeductionSqft ?? '')
            ) || 0);
          reconciled = {
            ...reconciled,
            stuccoNetWallSqft: String(Math.max(0, gross - openings)),
            exteriorPaintSqft: String(Math.max(0, gross - openings)),
            quickMeasurementSources: {
              ...(reconciled.quickMeasurementSources || {}),
              stuccoNetWallSqft: 'calculated_from_deductions',
              exteriorPaintSqft: 'calculated_from_deductions',
            },
          };
        }
      }
      if (reconciled === previous) return;
      if (reconciled !== next) {
        const selected = { ...selectedPricingRef.current };
        let selectedChanged = false;
        for (const stageKey of [
          'site-preconstruction',
          'framing',
          'exterior-finishes',
          'major-systems-rough-ins',
          'interior-finishes',
        ]) {
          const owner = STAGE_BENCHMARK_OWNERS[stageKey];
          if (
            owner &&
            selected[owner] &&
            !reconciled.pricingAcceptance?.[owner]
          ) {
            delete selected[owner];
            selectedChanged = true;
          }
        }
        if (selectedChanged) selectedPricingRef.current = selected;
      }
      measurementsRef.current = reconciled;
      setMeasurements(reconciled);
    },
    [checklist?.templateKey, enrichedPricingContext, scopeNotes]
  );

  const previewElectricalAttributes = useCallback(
    (
      attributes: ReturnType<
        typeof electricalConfirmScopeAttributesFromMeasurements
      >
    ) => {
      // Attribute chips are pricing inputs, not staged takeoff quantities.
      // Commit them immediately so service-panel pricing cannot read a stale
      // amperage/location snapshot after the chip turns green.
      setMeasurementsSynced(previous => ({
        ...previous,
        ...attributes,
      }));
      setElectricalPreviewMeasurements(null);
    },
    [setMeasurementsSynced]
  );

  const setElectricalMeasurementsStaged = useCallback(
    (update: React.SetStateAction<ScopeMeasurementsInputExtended>) => {
      const previous = measurementsRef.current;
      const next =
        typeof update === 'function'
          ? (
              update as (
                prev: ScopeMeasurementsInputExtended
              ) => ScopeMeasurementsInputExtended
            )(previous)
          : update;
      if (next === previous) return;
      const complexityChanged =
        previous.storyCount !== next.storyCount ||
        previous.floorAreaSqft !== next.floorAreaSqft ||
        JSON.stringify(previous.projectComplexity ?? null) !==
          JSON.stringify(next.projectComplexity ?? null);
      const synced = resyncAppliedScopePricingAfterMeasurementChanges({
        previous,
        next,
        templateKey: checklist?.templateKey,
        notes: scopeNotes,
        pricingContext: enrichedPricingContext,
      });
      electricalMeasurementsStagedRef.current = true;
      if (complexityChanged) {
        setMeasurementsSynced(synced);
        measurementsRef.current = synced;
        setElectricalPreviewMeasurements(synced);
        return;
      }
      measurementsRef.current = synced;
      const previousItemQuantities = previous.itemQuantities || {};
      const nextItemQuantities = synced.itemQuantities || {};
      const quantityChanged =
        ELECTRICAL_CARDS.some(
          card => previous[card.measurementKey] !== next[card.measurementKey]
        ) ||
        Object.keys({
          ...previousItemQuantities,
          ...nextItemQuantities,
        }).some(key => {
          const before = previousItemQuantities[key];
          const after = nextItemQuantities[key];
          return (
            before?.quantity !== after?.quantity ||
            before?.unit !== after?.unit ||
            before?.quantitySource !== after?.quantitySource
          );
        });
      if (quantityChanged) {
        // Keep the lightweight pricing-card preview responsive while the full
        // electrical measurements state remains staged for the QM interaction.
        setElectricalPreviewMeasurements(synced);
      }
    },
    [
      checklist?.templateKey,
      enrichedPricingContext,
      scopeNotes,
      setMeasurementsSynced,
    ]
  );

  const flushStagedElectricalMeasurements = useCallback(() => {
    if (!electricalMeasurementsStagedRef.current) return;
    electricalMeasurementsStagedRef.current = false;
    const committed = { ...measurementsRef.current };
    setMeasurementsSynced(committed);
    // Keep the same snapshot available to scope-card pricing while the
    // committed measurements state catches up in the same render cycle.
    setElectricalPreviewMeasurements(committed);
  }, [setMeasurementsSynced]);

  const commitElectricalAttributes = useCallback(() => {
    electricalAttributesCommitRef.current?.();
    flushStagedElectricalMeasurements();
  }, [flushStagedElectricalMeasurements]);

  const scopeItemsForCurrentMeasurements = useCallback(
    (currentItems: ScopeChecklistItem[]) => {
      const currentMeasurements = measurementsRef.current;
      const currentTemplate = String(
        checklist?.templateKey || ''
      ).toLowerCase();
      if (
        currentTemplate === 'plumbing' ||
        currentTemplate === 'plumbing_service' ||
        (notesPlumbingFlow &&
          currentMeasurements.tradeWorkflowSource === 'standalone_trade')
      ) {
        return syncPlumbingScopeItems(currentItems, {
          plumbingScope: currentMeasurements.plumbingScope,
          quantities: currentMeasurements as Record<string, unknown>,
        });
      }
      if (currentTemplate === 'framing') {
        return syncFramingScopeItems(currentItems, {
          framingScope: currentMeasurements.framingScope,
          quantities: currentMeasurements as Record<string, unknown>,
        });
      }
      if (currentTemplate === 'windows_doors') {
        return syncWindowsDoorsScopeItems(
          currentItems,
          currentMeasurements as Record<string, unknown>
        );
      }
      if (currentTemplate === 'garage_doors') {
        return syncGarageDoorsScopeItems(
          currentItems,
          currentMeasurements as Record<string, unknown>
        );
      }
      if (currentTemplate !== 'electrical') return currentItems;
      return syncElectricalScopeItems(currentItems, {
        electricalScope: currentMeasurements.electricalScope,
        quantities: currentMeasurements as Partial<Record<string, unknown>>,
      });
    },
    [checklist?.templateKey, notesPlumbingFlow]
  );

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (electricalMeasurementsStagedRef.current) return;
    measurementsRef.current = measurements;
  }, [measurements]);

  // Quick Measurements can update the visible LF field before the scope-card
  // state has rendered its recalculated Applied dollars. Reconcile once against
  // the last rendered snapshot so the footer cannot remain on the old
  // acceptance total (for example, 50 LF / $1,500 after changing to 70 LF).
  const appliedPricingSyncBaselineRef =
    useRef<ScopeMeasurementsInputExtended | null>(null);
  useEffect(() => {
    const template = String(checklist?.templateKey || '').toLowerCase();
    if (!['plumbing', 'plumbing_service'].includes(template)) return;

    const baseline = appliedPricingSyncBaselineRef.current;
    if (!baseline) {
      appliedPricingSyncBaselineRef.current = measurements;
      return;
    }

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous: baseline,
      next: measurements,
      templateKey: checklist?.templateKey,
      notes: scopeNotes,
      pricingContext: enrichedPricingContext,
    });
    appliedPricingSyncBaselineRef.current = synced;
    if (synced === measurements) return;

    measurementsRef.current = synced;
    setMeasurements(synced);
  }, [
    checklist?.templateKey,
    enrichedPricingContext,
    measurements,
    scopeNotes,
    setMeasurements,
  ]);

  const scopeMeasurementsPayloadForCurrentState = useCallback(() => {
    const payload = scopeMeasurementsPayloadForPersist(
      measurementsRef.current,
      {
        notes: scopeNotes,
        templateKey: checklist?.templateKey,
      }
    );
    const itemQuantities = { ...(payload.itemQuantities || {}) };
    const pricingAcceptance = {
      ...(measurementsRef.current.pricingAcceptance || {}),
    };
    for (const [itemId, originalBlock] of Object.entries(
      selectedPricingRef.current
    )) {
      const card = plumbingCardForItemId(itemId);
      const currentTakeoff = card
        ? Number(
            String(
              (measurementsRef.current as Record<string, unknown>)[
                card.measurementKey
              ] ?? ''
            ).replace(/,/g, '')
          )
        : NaN;
      const block =
        card && currentTakeoff > 0
          ? scaleSuggestedBlockToTakeoffQuantity(originalBlock, currentTakeoff)
          : originalBlock;
      if (block !== originalBlock) {
        selectedPricingRef.current[itemId] = block;
      }
      const rule = getChecklistItemQuantityRule(itemId, checklist?.templateKey);
      // Current measurements are authoritative after Apply. If the selected
      // block is stale during persistence, project it onto the current LF
      // takeoff before writing the accepted values.
      if (pricingAcceptance[itemId]) {
        if (block !== originalBlock && card) {
          const allowanceKey = rule?.dualAllowanceField
            ? roughAllowanceSubKey(itemId)
            : `${itemId}__allowance`;
          const primary = primaryQuantityForAppliedSuggestedBlock(
            block,
            getChecklistItemQuantityRuleOrDefault(
              itemId,
              checklist?.templateKey
            )
          );
          itemQuantities[itemId] = {
            quantity: Number(primary.quantity),
            unit: primary.unit || rule?.defaultUnit || card.unit,
            quantitySource: 'user_entered',
          };
          itemQuantities[`${itemId}__sqft_basis`] = {
            quantity: currentTakeoff,
            unit: card.unit,
            quantitySource: 'user_entered',
          };
          itemQuantities[allowanceKey] = {
            quantity: Number(block.total),
            unit: 'allowance',
            quantitySource: 'user_entered',
          };
          itemQuantities[`${itemId}__material`] = {
            quantity: Number(block.material),
            unit: 'allowance',
            quantitySource: 'user_entered',
          };
          itemQuantities[`${itemId}__labor`] = {
            quantity: Number(block.labor),
            unit: 'allowance',
            quantitySource: 'user_entered',
          };
          pricingAcceptance[itemId] = buildAcceptanceFromSuggestedBlock(block);
        }
        continue;
      }
      const allowanceKey = rule?.dualAllowanceField
        ? roughAllowanceSubKey(itemId)
        : `${itemId}__allowance`;
      const primary = primaryQuantityForAppliedSuggestedBlock(
        block,
        getChecklistItemQuantityRuleOrDefault(itemId, checklist?.templateKey)
      );
      itemQuantities[itemId] = {
        quantity: Number(primary.quantity),
        unit:
          primary.unit ||
          (rule?.dualAllowanceField ? rule.defaultUnit : 'allowance'),
        quantitySource: 'user_entered',
      };
      if (card && currentTakeoff > 0) {
        itemQuantities[`${itemId}__sqft_basis`] = {
          quantity: currentTakeoff,
          unit: card.unit,
          quantitySource: 'user_entered',
        };
      }
      itemQuantities[allowanceKey] = {
        quantity: Number(block.total),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      itemQuantities[`${itemId}__material`] = {
        quantity: Number(block.material),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      itemQuantities[`${itemId}__labor`] = {
        quantity: Number(block.labor),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      pricingAcceptance[itemId] = buildAcceptanceFromSuggestedBlock(block);
    }
    const reconciled = clearSupersededStageHostPricing(
      {
        ...payload,
        itemQuantities: Object.keys(itemQuantities).length
          ? itemQuantities
          : payload.itemQuantities,
        pricingAcceptance: Object.keys(pricingAcceptance).length
          ? pricingAcceptance
          : payload.pricingAcceptance,
      },
      checklist?.templateKey
    );
    return reconciled;
  }, [checklist?.templateKey, scopeNotes]);

  const draftScopeRestoreKey = useMemo(
    () =>
      JSON.stringify({
        confirmed: draft?.confirmedAssumptions,
        measurements: draft?.scopeMeasurements,
        checklist: draft?.scopeChecklist?.items,
        notes: scopeNotes,
        suggested: draft?.scopeChecklist?.suggestedMeasurements,
      }),
    [
      draft?.confirmedAssumptions,
      draft?.scopeMeasurements,
      draft?.scopeChecklist?.items,
      draft?.scopeChecklist?.suggestedMeasurements,
      scopeNotes,
      notesFallback,
    ]
  );
  const livePlanImportHandoffKey = useMemo(
    () =>
      planImport
        ? JSON.stringify({
            measurements: planImport.measurements,
            scopeDetections: planImport.scopeDetections,
            fieldConfidence: planImport.fieldConfidence,
            quickMeasurementSources: planImport.quickMeasurementSources,
            measurementProvenance: planImport.measurementProvenance,
            utilityConnections: planImport.utilityConnections,
            fixtureInventory: planImport.fixtureInventory,
            complexityFactors: planImport.complexityFactors,
            plumbingReviewStatus: planImport.plumbingReviewStatus,
            waterHeaterDetail: planImport.waterHeaterDetail,
            gasApplianceScope: planImport.gasApplianceScope,
            measurementConflicts: planImport.measurementConflicts,
            planImportFingerprint: planImport.planImportFingerprint,
            estimatingMode: planImport.estimatingMode,
            selectedTrade: planImport.selectedTrade,
            tradeProvenance: planImport.tradeProvenance,
            missingInfo: planImport.missingInfo,
            planFacts: planImport.planFacts,
            buildingAreas: planImport.buildingAreas,
          })
        : '',
    [planImport]
  );

  useEffect(() => {
    if (visible && checklist?.items?.length) {
      if (hydratedVisibleSessionRef.current) return;
      selectedPricingRef.current = {};
      const sourceItems = scopeChecklistItemsForEditing(draft);
      if (!sourceItems.length) return;
      const draftForScope =
        draft && scopeNotes.trim()
          ? repairDraftRatePricingFromNotes(draft, scopeNotes)
          : draft;
      let nextMeasurements = mergeConfirmScopeSavedMeasurements(
        prepareScopeMeasurementsInputForUi(
          initialScopeMeasurementInputExtended(draftForScope, scopeNotes),
          { notes: scopeNotes, templateKey: checklist.templateKey }
        ),
        draft?.scopeMeasurements
      );
      // The plan review modal can be applied before the draft persistence
      // round-trip completes. Preserve its selected-trade measurements during
      // Confirm Scope hydration so readable plan values are not lost.
      // Prefer the live Step 1 payload, but fall back to the selected-trade
      // metadata/values already persisted on the draft. The draft can arrive
      // one render ahead of the plan-import prop after Step 1 is applied.
      const hydratedPlanTrade =
        planImport?.estimatingMode === 'selected_trade' &&
        planImport.selectedTrade
          ? planImport.selectedTrade
          : draft?.scopeMeasurements?.planImportMode === 'selected_trade'
            ? (draft.scopeMeasurements.planImportTradeKey as
                import('@/utils/planImportTradeConfig').PlanTradeKey | null)
            : null;
      if (hydratedPlanTrade) {
        const allowed = new Set(
          tradeQuickMeasurementFieldKeys(hydratedPlanTrade)
        );
        // Keep the two newly-added affected-area fields in the same restore
        // path as the rest of the stucco takeoff fields.
        if (hydratedPlanTrade === 'stucco') {
          allowed.add('stuccoAccessAffectedSqft');
          allowed.add('stuccoRepairAffectedSqft');
        }
        const persistedTradeMeasurements =
          draft?.scopeMeasurements && hydratedPlanTrade
            ? Object.fromEntries(
                Object.entries(draft.scopeMeasurements).filter(([key]) =>
                  allowed.has(key)
                )
              )
            : {};
        const imported = Object.fromEntries(
          Object.entries(persistedTradeMeasurements)
            .filter(
              ([key, value]) =>
                allowed.has(key) && value != null && value !== ''
            )
            .map(([key, value]) => [key, String(value)])
        );
        for (const [key, value] of Object.entries(
          planImport?.measurements || {}
        )) {
          if (allowed.has(key) && value != null && value !== '') {
            imported[key] = String(value);
          }
        }
        const mergedQuickMeasurementSources = {
          ...(nextMeasurements.quickMeasurementSources || {}),
          ...(planImport?.quickMeasurementSources || {}),
          ...(hydratedPlanTrade === 'hvac' && planImport?.measurementProvenance
            ? hvacQuickMeasurementSourcesFromProvenance(
                imported,
                planImport.measurementProvenance as Record<string, unknown>
              )
            : {}),
        };
        nextMeasurements = {
          ...nextMeasurements,
          ...imported,
          ...(planImport?.measurementProvenance
            ? {
                measurementProvenance: {
                  ...(nextMeasurements.measurementProvenance || {}),
                  ...(planImport.measurementProvenance as Record<
                    string,
                    unknown
                  >),
                },
              }
            : {}),
          quickMeasurementSources: tagPlanDetectedQuickMeasurementKeys(
            mergedQuickMeasurementSources,
            Object.keys(imported)
          ),
        };
      }
      nextMeasurements = mergeLivePlanImportIntoScopeMeasurements(
        nextMeasurements,
        planImport
      );
      const hydrateTradeContext = resolveSingleTradePlanContext({
        measurements: nextMeasurements,
        draftScopeMeasurements: draft?.scopeMeasurements,
        planImport,
      });
      if (hydrateTradeContext.isSingleTrade && hydrateTradeContext.tradeKey) {
        const stripped = stripScopeInputForSingleTrade(
          nextMeasurements,
          hydrateTradeContext.tradeKey
        );
        nextMeasurements = {
          ...stripped,
          planImportMode: 'selected_trade',
          planImportTradeKey: hydrateTradeContext.tradeKey,
          planImportMissingInfo:
            draft?.scopeMeasurements?.planImportMissingInfo ??
            planImport?.missingInfo ??
            [],
        };
      }
      if (
        hydratedPlanTrade === 'insulation' ||
        hydrateTradeContext.tradeKey === 'insulation' ||
        String(checklist.templateKey || '').toLowerCase() === 'insulation'
      ) {
        nextMeasurements = syncMeasurementsWithSouthernUtahPlanFacts(
          nextMeasurements,
          { templateKey: 'insulation' }
        );
        nextMeasurements = applyHydratedInsulationScopeMeasurements(
          nextMeasurements,
          {
            planFacts: nextMeasurements.planFacts,
            buildingAreas: nextMeasurements.planFacts?.buildingAreas,
          }
        );
        const planAssemblies = syncInsulationAssembliesWithPlanMeasurements(
          nextMeasurements as Record<string, unknown>
        );
        if (planAssemblies?.length) {
          nextMeasurements = {
            ...nextMeasurements,
            insulationAssemblies: planAssemblies,
          };
        }
      }
      if (
        hydratedPlanTrade === 'electrical' ||
        hydrateTradeContext.tradeKey === 'electrical' ||
        String(checklist.templateKey || '').toLowerCase() === 'electrical'
      ) {
        const complexityPatches = hydrateProjectComplexityInputFields({
          floorAreaSqft: nextMeasurements.floorAreaSqft,
          storyCount: nextMeasurements.storyCount,
          planFacts: nextMeasurements.planFacts,
          planImportMode: nextMeasurements.planImportMode,
          planImportTradeKey: nextMeasurements.planImportTradeKey,
          planImportFingerprint: nextMeasurements.planImportFingerprint,
          quickMeasurementSources: nextMeasurements.quickMeasurementSources,
        });
        if (
          complexityPatches.storyCount &&
          !nextMeasurements.quickMeasurementUserOverrides?.storyCount
        ) {
          const stories = Math.min(
            3,
            Math.round(Number(complexityPatches.storyCount))
          ) as 1 | 2 | 3;
          nextMeasurements = {
            ...nextMeasurements,
            storyCount: complexityPatches.storyCount,
            projectComplexity: {
              mode: 'automatic' as const,
              ...(nextMeasurements.projectComplexity || {}),
              stories,
            },
            quickMeasurementSources: {
              ...(nextMeasurements.quickMeasurementSources || {}),
              storyCount: 'plan_detected',
            },
          };
        }
      }
      if (
        hydratedPlanTrade === 'plumbing' ||
        hydrateTradeContext.tradeKey === 'plumbing' ||
        ['plumbing', 'plumbing_service'].includes(
          String(checklist.templateKey || '').toLowerCase()
        )
      ) {
        nextMeasurements = applySouthernUtahPlumbingPackageTakeoffDefaults(
          nextMeasurements as Record<string, unknown>
        ) as typeof nextMeasurements;
        nextMeasurements = reconcilePlumbingLineScopeMeasurements(
          nextMeasurements as Record<string, unknown>
        ) as typeof nextMeasurements;
        nextMeasurements = reconcilePlumbingEquipmentScopeMeasurements(
          nextMeasurements as Record<string, unknown>
        ) as typeof nextMeasurements;
        nextMeasurements = prepareScopeMeasurementsInputForUi(
          nextMeasurements,
          {
            notes: scopeNotes,
            templateKey: checklist.templateKey,
          }
        );
        const structured = buildPlumbingStructuredMeasurements(
          nextMeasurements as Record<string, unknown>,
          'plan_detected'
        );
        if (structured.plumbingScope?.length) {
          nextMeasurements = {
            ...nextMeasurements,
            plumbingScope: structured.plumbingScope,
            itemQuantities: {
              ...(nextMeasurements.itemQuantities || {}),
              ...(structured.itemQuantities || {}),
            },
          };
        }
      }
      if (
        hydratedPlanTrade === 'framing' ||
        hydrateTradeContext.tradeKey === 'framing' ||
        String(checklist.templateKey || '').toLowerCase() === 'framing'
      ) {
        nextMeasurements = reconcileFramingScopeMeasurements(
          nextMeasurements as Record<string, unknown>
        ) as typeof nextMeasurements;
        nextMeasurements = prepareScopeMeasurementsInputForUi(
          nextMeasurements,
          {
            notes: scopeNotes,
            templateKey: checklist.templateKey,
          }
        );
        const structured = buildFramingStructuredMeasurements(
          nextMeasurements as Record<string, unknown>,
          'plan_detected'
        );
        if (structured.framingScope?.length) {
          nextMeasurements = {
            ...nextMeasurements,
            framingScope: structured.framingScope,
            itemQuantities: {
              ...(nextMeasurements.itemQuantities || {}),
              ...(structured.itemQuantities || {}),
            },
          };
        }
      }
      if (
        hydratedPlanTrade === 'hvac' ||
        hydrateTradeContext.tradeKey === 'hvac' ||
        String(checklist.templateKey || '').toLowerCase() === 'hvac'
      ) {
        nextMeasurements = applyHvacProvenanceGuardToScopeMeasurements(
          nextMeasurements as Record<string, unknown>
        ) as typeof nextMeasurements;
        nextMeasurements = {
          ...nextMeasurements,
          quickMeasurementSources: syncHvacSkippedTakeoffQuickMeasurementSources(
            nextMeasurements as Record<string, unknown>
          ),
        };
        nextMeasurements = prepareScopeMeasurementsInputForUi(
          nextMeasurements,
          {
            notes: scopeNotes,
            templateKey: checklist.templateKey,
          }
        );
        const structured = buildHvacStructuredMeasurements(
          nextMeasurements as Record<string, unknown>,
          nextMeasurements.quickMeasurementSources || {}
        );
        if (Object.keys(structured.itemQuantities || {}).length) {
          nextMeasurements = {
            ...nextMeasurements,
            itemQuantities: {
              ...(nextMeasurements.itemQuantities || {}),
              ...(structured.itemQuantities || {}),
            },
          };
        }
        nextMeasurements = simpleTradePanelFor('hvac').hydrateMeasurements({
          templateKey: 'hvac',
          wholeHomeLayout: false,
          notes: scopeNotes,
          hasSitePhotos,
          measurements: nextMeasurements as Record<string, unknown>,
          checklistItems: sourceItems,
        }) as typeof nextMeasurements;
      }
      if (
        String(checklist.templateKey || '').toLowerCase() === 'painting' &&
        Number(nextMeasurements.exteriorPaintSqft || 0) > 0
      ) {
        nextMeasurements.paintScope = Array.from(
          new Set([...(nextMeasurements.paintScope || []), 'exterior' as const])
        );
      }
      const strippedQuantities = stripBathroomFalsePositiveFloorDemoQuantities(
        nextMeasurements.itemQuantities,
        checklist.templateKey,
        scopeNotes
      );
      if (strippedQuantities !== nextMeasurements.itemQuantities) {
        nextMeasurements.itemQuantities = strippedQuantities;
      }
      if (!nextMeasurements.wetAreaFinish) {
        const wet = sourceItems.find(row => row.id === 'wet_area_install');
        const finish = wetAreaFinishFromChecklistChoice(wet?.choiceId);
        if (finish) nextMeasurements.wetAreaFinish = finish;
      }
      if (
        isPhotoNotesScopeJob({
          templateKey: checklist.templateKey,
          wholeHomeLayout: false,
        })
      ) {
        const wet = sourceItems.find(row => row.id === 'wet_area_install');
        const showerTile = sourceItems.find(row => row.id === 'shower_tile');
        const showerFloorTile = sourceItems.find(
          row => row.id === 'shower_floor_tile'
        );
        const glassDoor = sourceItems.find(row => row.id === 'glass_door');
        Object.assign(
          nextMeasurements,
          hydrateQmPanelMeasurements({
            templateKey: checklist.templateKey,
            wholeHomeLayout: false,
            notes: scopeNotes,
            hasSitePhotos,
            measurements: nextMeasurements,
            checklistItems: sourceItems,
            wetAreaInstallChoiceId: wet?.choiceId,
            showerTileIncluded: showerTile?.state === 'included',
            showerFloorTileIncluded: showerFloorTile?.state === 'included',
            glassDoorIncluded: glassDoor?.state === 'included',
          })
        );
      }
      const norm = buildNormFromInput(
        nextMeasurements,
        scopeNotes,
        checklist.templateKey
      );
      let normalized = hydrateScopeChecklistFromNotes(
        sourceItems,
        checklist.templateKey,
        scopeNotes,
        norm
      );
      normalized = applyKitchenScopeInferences(
        normalized,
        checklist.templateKey,
        {
          notes: scopeNotes,
          measurements: norm,
        }
      );
      if (
        sourceItems.length &&
        (draft?.confirmedAssumptions?.length ||
          draft?.scopeAssumptionsConfirmed)
      ) {
        normalized = restoreConfirmedChecklistItemStates(
          normalized,
          sourceItems
        );
      }
      normalized = applyMeasuredStuccoScopeInferences(normalized, norm);
      normalized = suppressBathroomFalsePositiveFloorDemoScope(
        normalized,
        checklist.templateKey,
        scopeNotes,
        norm
      );
      normalized = syncQmPanelScopeItems(
        normalized,
        {
          templateKey: singleTradeKey || checklist.templateKey,
          wholeHomeLayout: false,
        },
        nextMeasurements
      );
      // QM sync can re-include wet-area demo rows; re-suppress photo false-positive floor demo.
      normalized = suppressBathroomFalsePositiveFloorDemoScope(
        normalized,
        checklist.templateKey,
        scopeNotes,
        {
          ...norm,
          ...readWetAreaDemoCounts(nextMeasurements),
        } as typeof norm
      );
      normalized = applyScopeDetectionsToChecklistItems(
        normalized,
        planImport?.scopeDetections
      ).items;
      baseItemsRef.current = normalized;
      if (hydrateTradeContext.isSingleTrade && hydrateTradeContext.tradeKey) {
        normalized = filterChecklistItemsForTrade(
          normalized,
          'selected_trade',
          hydrateTradeContext.tradeKey
        );
      }
      if (
        ['plumbing', 'plumbing_service'].includes(
          String(checklist.templateKey || '').toLowerCase()
        ) ||
        hydratedPlanTrade === 'plumbing' ||
        hydrateTradeContext.tradeKey === 'plumbing'
      ) {
        normalized = syncPlumbingScopeItems(normalized, {
          plumbingScope: nextMeasurements.plumbingScope,
          quantities: nextMeasurements as Record<string, unknown>,
        });
      }
      if (
        String(checklist.templateKey || '').toLowerCase() === 'framing' ||
        hydratedPlanTrade === 'framing' ||
        hydrateTradeContext.tradeKey === 'framing'
      ) {
        normalized = syncFramingScopeItems(normalized, {
          framingScope: nextMeasurements.framingScope,
          quantities: nextMeasurements as Record<string, unknown>,
        });
      }
      if (
        String(checklist.templateKey || '').toLowerCase() === 'windows_doors' ||
        hydratedPlanTrade === 'windows_doors' ||
        hydrateTradeContext.tradeKey === 'windows_doors'
      ) {
        normalized = syncWindowsDoorsScopeItems(
          normalized,
          nextMeasurements as Record<string, unknown>
        );
      }
      if (
        String(checklist.templateKey || '').toLowerCase() === 'garage_doors' ||
        hydratedPlanTrade === 'garage_doors' ||
        hydrateTradeContext.tradeKey === 'garage_doors'
      ) {
        normalized = syncGarageDoorsScopeItems(
          normalized,
          nextMeasurements as Record<string, unknown>
        );
      }
      const textureMigration = stripStandaloneDrywallTextureItem(normalized);
      normalized = finalizeDrywallScopeChecklistLayout(
        isDrywallCompletePackageScope({
          templateKey: checklist.templateKey,
          planImportMode: nextMeasurements.planImportMode,
          planImportTradeKey: nextMeasurements.planImportTradeKey,
        })
          ? normalized
          : textureMigration.items,
        checklist.templateKey,
        {
          notes: scopeNotes,
          measurements: {
            ...norm,
            planImportMode: nextMeasurements.planImportMode ?? null,
            planImportTradeKey: nextMeasurements.planImportTradeKey ?? null,
          },
          planImportMode: nextMeasurements.planImportMode ?? null,
          planImportTradeKey: nextMeasurements.planImportTradeKey ?? null,
        }
      );
      const textureChoice = normalized.find(row => row.id === 'texture')?.choiceId;
      if (!nextMeasurements.drywallFinishLevel) {
        nextMeasurements = {
          ...nextMeasurements,
          drywallFinishLevel:
            textureMigration.finishLevel ||
            (textureChoice && textureChoice !== 'unsure'
              ? textureChoice
              : null) ||
            ((hydratedPlanTrade === 'drywall' ||
              hydrateTradeContext.tradeKey === 'drywall')
              ? 'orange_peel'
              : null),
        };
      }
      if (
        !nextMeasurements.drywallSheetLength &&
        (hydratedPlanTrade === 'drywall' ||
          hydrateTradeContext.tradeKey === 'drywall' ||
          isDrywallCompletePackageScope({
            templateKey: checklist.templateKey,
            planImportMode: nextMeasurements.planImportMode,
            planImportTradeKey: nextMeasurements.planImportTradeKey,
          }))
      ) {
        nextMeasurements = {
          ...nextMeasurements,
          drywallSheetLength: '12ft',
        };
      }
      if (
        isDrywallCompletePackageScope({
          templateKey: checklist.templateKey,
          planImportMode: nextMeasurements.planImportMode,
          planImportTradeKey: nextMeasurements.planImportTradeKey,
        })
      ) {
        nextMeasurements = syncDrywallPackageTotalFromBoardBuckets(
          hydrateDrywallSpecialtyBoardMeasurements(nextMeasurements, {
            planFacts: nextMeasurements.planFacts as Record<string, unknown> | null,
          }),
          {
            planFacts: nextMeasurements.planFacts as Record<string, unknown> | null,
          }
        );
      }
      setItems(normalized);
      setMeasurementsSynced(nextMeasurements);
      const displayForHydrate = expandWetAreaDerivedScopeItems(normalized);
      setCustomItemLabel('');
      setShowCustomItemInput(false);
      const grouped = groupScopeChecklistItems(
        displayForHydrate,
        checklist.templateKey
      );
      setCollapsedGroups(
        initialScopeGroupCollapse(
          grouped,
          norm,
          checklist.templateKey,
          scopeNotes
        )
      );
      hydratedVisibleSessionRef.current = true;
    }
    // `draft` is intentionally excluded: re-running on every parent re-render (e.g. when the
    // keyboard opens) remounts the inputs and drops focus. `draftScopeRestoreKey` is the stable
    // content signature that captures the data this effect actually reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, draftScopeRestoreKey, checklist?.templateKey, singleTradeKey]);

  useEffect(() => {
    if (
      !visible ||
      !hydratedVisibleSessionRef.current ||
      !planImport ||
      !livePlanImportHandoffKey ||
      livePlanImportHandoffKeyRef.current === livePlanImportHandoffKey
    ) {
      return;
    }
    livePlanImportHandoffKeyRef.current = livePlanImportHandoffKey;
    setMeasurementsSynced(prev => {
      let next = mergeLivePlanImportIntoScopeMeasurements(prev, planImport);
      if (
        planImport.selectedTrade === 'plumbing' ||
        planImport.selectedTrade === 'hvac' ||
        ['plumbing', 'plumbing_service'].includes(
          String(checklist?.templateKey || '').toLowerCase()
        ) ||
        String(checklist?.templateKey || '').toLowerCase() === 'hvac'
      ) {
        if (
          planImport.selectedTrade === 'hvac' ||
          String(checklist?.templateKey || '').toLowerCase() === 'hvac'
        ) {
          next = applyHvacProvenanceGuardToScopeMeasurements(
            next as Record<string, unknown>
          ) as typeof next;
          next = {
            ...next,
            quickMeasurementSources: syncHvacSkippedTakeoffQuickMeasurementSources(
              next as Record<string, unknown>
            ),
          };
        }
        next = prepareScopeMeasurementsInputForUi(next, {
          notes: scopeNotes,
          templateKey: checklist?.templateKey,
        });
      }
      return next;
    });
    if (planImport.scopeDetections?.length) {
      setItems(prev => {
        const applied = applyScopeDetectionsToChecklistItems(
          prev,
          planImport.scopeDetections
        );
        return applied.appliedCount ? applied.items : prev;
      });
    }
  }, [visible, livePlanImportHandoffKey, planImport, setMeasurementsSynced]);

  useEffect(() => {
    if (visible) return;
    // Persist before wiping local form state. Skip during Continue — parent saves in onConfirm.
    if (onPersistProgress && !applying && itemsRef.current.length) {
      const currentItems = scopeItemsForCurrentMeasurements(itemsRef.current);
      onPersistProgress(
        scopeChecklistItemsForPersist(currentItems),
        scopeMeasurementsPayloadForCurrentState()
      );
    }
    electricalMeasurementsStagedRef.current = false;
    setElectricalPreviewMeasurements(null);
    livePlanImportHandoffKeyRef.current = '';
    hydratedVisibleSessionRef.current = false;
    baseItemsRef.current = [];
    setNotesTradeMode('whole_project');
    setItems([]);
    // Do not clear measurementsRef here. Persist reads measurementsRef above.
    setMeasurements({
      ...emptyQuickMeasurementInput(),
      itemQuantities: {},
    });
    setCollapsedGroups({});
    setCustomItemLabel('');
    setShowCustomItemInput(false);
  }, [
    visible,
    onPersistProgress,
    applying,
    scopeItemsForCurrentMeasurements,
    scopeMeasurementsPayloadForCurrentState,
  ]);

  // Keep rate-pricing subkeys in form state whenever notes are available (handles hot reload / stale saves).
  useEffect(() => {
    if (!visible || !scopeNotes.trim()) return;
    setMeasurementsSynced(prev =>
      prepareScopeMeasurementsInputForUi(prev, {
        notes: scopeNotes,
        templateKey: checklist?.templateKey,
      })
    );
  }, [visible, scopeNotes, checklist?.templateKey]);

  // Keep Garage doors Yes when QM type counts are set.
  // Never expand Structure while Quick measurements is open — that reflows the
  // ScrollView, steals TextInput focus, and makes Needs confirmation feel glitchy.
  // Read open-state from a ref so toggling QM does not re-run item sync.
  const quickMeasurementsOpenRef = useRef(quickMeasurementsOpen);
  quickMeasurementsOpenRef.current = quickMeasurementsOpen;
  useEffect(() => {
    if (!visible) return;
    if (String(checklist?.templateKey || '').toLowerCase() !== 'ground_up')
      return;
    const total =
      (Number(measurements.garageDoorSingleCount) || 0) +
      (Number(measurements.garageDoorDoubleCount) || 0) +
      (Number(measurements.garageDoorRvCount) || 0);
    if (total <= 0) return;
    setItems(prev => {
      let next = ensureGroundUpOpeningScopeCards(prev);
      next = next.map(row =>
        row.id === 'garage_doors' ? { ...row, state: 'included' as const } : row
      );
      const same =
        next.length === prev.length &&
        next.every(
          (row, idx) =>
            row.id === prev[idx]?.id && row.state === prev[idx]?.state
        );
      return same ? prev : next;
    });
    if (!quickMeasurementsOpenRef.current) {
      setCollapsedGroups(prev =>
        prev.Structure === false ? prev : { ...prev, Structure: false }
      );
    }
  }, [
    visible,
    checklist?.templateKey,
    measurements.garageDoorSingleCount,
    measurements.garageDoorDoubleCount,
    measurements.garageDoorRvCount,
  ]);

  // Keep Exterior concrete flatwork Yes when QM SF is set (no Structure expand during QM edit).
  useEffect(() => {
    if (!visible) return;
    if (String(checklist?.templateKey || '').toLowerCase() !== 'ground_up')
      return;
    const flatworkSf = Number(measurements.concreteSqft) || 0;
    if (flatworkSf <= 0) return;
    setItems(prev => {
      let next = ensureGroundUpFlatworkScopeCard(prev);
      next = next.map(row =>
        row.id === 'pour_flatwork'
          ? { ...row, state: 'included' as const }
          : row
      );
      const same =
        next.length === prev.length &&
        next.every(
          (row, idx) =>
            row.id === prev[idx]?.id && row.state === prev[idx]?.state
        );
      return same ? prev : next;
    });
    if (!quickMeasurementsOpenRef.current) {
      setCollapsedGroups(prev =>
        prev.Structure === false ? prev : { ...prev, Structure: false }
      );
    }
  }, [visible, checklist?.templateKey, measurements.concreteSqft]);

  const normMeasurementInput =
    String(checklist?.templateKey || '').toLowerCase() === 'electrical'
      ? deferredMeasurements
      : measurements;
  const normMeasurements = useMemo(
    () =>
      buildNormFromInput(
        normMeasurementInput,
        scopeNotes,
        checklist?.templateKey
      ),
    [normMeasurementInput, scopeNotes, checklist?.templateKey]
  );
  const deferredNormMeasurements = useDeferredValue(normMeasurements);
  const sharedRowMeasurements =
    String(checklist?.templateKey || '').toLowerCase() === 'electrical' &&
    electricalPreviewMeasurements
      ? electricalPreviewMeasurements
      : measurements;
  const sharedRowNorm = useMemo(
    () =>
      buildNormFromInput(
        sharedRowMeasurements,
        scopeNotes,
        checklist?.templateKey
      ),
    [sharedRowMeasurements, scopeNotes, checklist?.templateKey]
  );
  const sharedParsedNotes = useMemo(
    () => ({
      source: scopeNotes,
      parsed: parseScopeMeasurementsFromNotes(scopeNotes, {
        templateKey: checklist?.templateKey ?? undefined,
      }),
    }),
    [scopeNotes, checklist?.templateKey]
  );

  // Keep plan-backed Stucco cards synchronized with Quick Measurements after
  // every hydration/sync pass. This only promotes Not sure; explicit Yes/No
  // or choice selections remain authoritative.
  useEffect(() => {
    const template = String(
      checklist?.templateKey || draft?.projectType || ''
    ).toLowerCase();
    if (template !== 'stucco' && !stuccoTradeFlow) return;
    setItems(prev => {
      const next = applyMeasuredStuccoScopeInferences(prev, normMeasurements);
      const changed =
        next.length !== prev.length ||
        next.some(
          (item, index) =>
            item.state !== prev[index]?.state ||
            item.choiceId !== prev[index]?.choiceId
        );
      return changed ? next : prev;
    });
  }, [
    checklist?.templateKey,
    draft?.projectType,
    stuccoTradeFlow,
    normMeasurements,
    measurements.stuccoSoffitSqft,
    measurements.stuccoParapetSqft,
    measurements.stuccoFoamTrimLf,
    measurements.stuccoOtherFinishDeductionSqft,
  ]);

  const pricingCounts = useMemo(
    () =>
      countScopePricingReadiness(
        displayItems,
        normMeasurements,
        checklist?.templateKey,
        scopeNotes
      ),
    [displayItems, normMeasurements, checklist?.templateKey, scopeNotes]
  );

  const summary = useMemo(
    () =>
      scopeChecklistSummaryCounts(displayItems, pricingCounts.needsMeasurement),
    [displayItems, pricingCounts.needsMeasurement]
  );

  const persistScopeProgressNow = useCallback(() => {
    if (!onPersistProgress || applying) return;
    const currentItems = scopeItemsForCurrentMeasurements(itemsRef.current);
    if (!currentItems.length) return;
    onPersistProgress(
      scopeChecklistItemsForPersist(currentItems),
      scopeMeasurementsPayloadForCurrentState()
    );
  }, [
    onPersistProgress,
    applying,
    scopeItemsForCurrentMeasurements,
    scopeMeasurementsPayloadForCurrentState,
  ]);

  const handleBathroomCountertopMaterialChange = useCallback(
    (
      materialType:
        | import('@/utils/bathroomVanityCountertopPricing').BathroomVanityCountertopMaterialType
        | null
    ) => {
      startTransition(() => {
        setItems(prev =>
          prev.map(row =>
            row.id === 'countertops'
              ? {
                  ...row,
                  choiceId: materialType,
                  state: 'included' as const,
                }
              : row
          )
        );
      });
    },
    []
  );

  const handleBathroomShowerRoughFixtureTypeChange = useCallback(
    (fixtureType: BathroomShowerRoughFixtureType | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughFixtureType: fixtureType,
          bathroomShowerRoughFixtureTypeSource: fixtureType
            ? 'user_selected'
            : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomShowerRoughWorkTypeChange = useCallback(
    (workType: BathroomShowerRoughWorkType | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughWorkType: workType,
          bathroomShowerRoughWorkTypeSource: workType ? 'user_selected' : null,
          bathroomShowerRoughSlabWorkRequired:
            workType === 'relocation'
              ? null
              : prev.bathroomShowerRoughSlabWorkRequired,
          bathroomShowerRoughSlabWorkRequiredSource:
            workType === 'relocation'
              ? null
              : prev.bathroomShowerRoughSlabWorkRequiredSource,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomShowerRoughPlumbingExposedChange = useCallback(
    (plumbingExposed: BathroomShowerRoughPlumbingExposed | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughPlumbingExposed: plumbingExposed,
          bathroomShowerRoughPlumbingExposedSource: plumbingExposed
            ? 'user_selected'
            : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomShowerRoughFloorConstructionChange = useCallback(
    (floorConstruction: BathroomShowerRoughFloorConstruction | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughFloorConstruction: floorConstruction,
          bathroomShowerRoughFloorConstructionSource: floorConstruction
            ? 'user_selected'
            : null,
          bathroomShowerRoughSlabWorkRequired:
            floorConstruction !== 'concrete_slab'
              ? null
              : prev.bathroomShowerRoughSlabWorkRequired,
          bathroomShowerRoughSlabWorkRequiredSource:
            floorConstruction !== 'concrete_slab'
              ? null
              : prev.bathroomShowerRoughSlabWorkRequiredSource,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomShowerRoughSlabWorkRequiredChange = useCallback(
    (slabWorkRequired: BathroomShowerRoughSlabWorkRequired | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughSlabWorkRequired: slabWorkRequired,
          bathroomShowerRoughSlabWorkRequiredSource: slabWorkRequired
            ? 'user_selected'
            : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomPaintRepairScopeChange = useCallback(
    (scope: BathroomPaintRepairScope | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.paint_repair;
        delete pricingAcceptance.drywall;
        delete pricingAcceptance.patch_repair;
        delete pricingAcceptance.interior_paint;
        delete pricingAcceptance.paint;
        const isFullRoom = scope === 'full_room';
        const itemQuantities = { ...prev.itemQuantities };
        delete itemQuantities.paint_repair;
        return {
          ...prev,
          bathroomPaintRepairScope: scope,
          bathroomPaintRepairScopeSource: scope ? 'user_selected' : null,
          bathroomPaintRepairEntireRoom: isFullRoom
            ? true
            : scope === 'affected_area'
              ? false
              : null,
          bathroomPaintRepairEntireRoomSource: scope ? 'user_selected' : null,
          bathroomPaintRepairEntireRoomSqft: null,
          bathroomPaintRepairEntireRoomSqftSource: null,
          itemQuantities,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomDrywallPaintCombinedAssemblyChange = useCallback(
    (useCombined: boolean | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.drywall;
        delete pricingAcceptance.patch_repair;
        delete pricingAcceptance.paint_repair;
        return {
          ...prev,
          bathroomDrywallPaintUseCombinedAssembly: useCombined,
          bathroomDrywallPaintUseCombinedAssemblySource:
            useCombined == null ? null : 'user_selected',
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomInteriorPaintMobilizationChange = useCallback(
    (mobilization: BathroomInteriorPaintMobilization | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.interior_paint;
        delete pricingAcceptance.paint;
        return {
          ...prev,
          bathroomInteriorPaintMobilization: mobilization,
          bathroomInteriorPaintMobilizationSource: mobilization
            ? 'user_selected'
            : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomInteriorPaintSurfaceChange = useCallback(
    (surface: BathroomInteriorPaintSurface | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.interior_paint;
        delete pricingAcceptance.paint;
        return {
          ...prev,
          bathroomInteriorPaintSurface: surface,
          bathroomInteriorPaintSurfaceSource: surface ? 'user_selected' : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomInteriorPaintConditionChange = useCallback(
    (condition: BathroomInteriorPaintCondition | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.interior_paint;
        delete pricingAcceptance.paint;
        return {
          ...prev,
          bathroomInteriorPaintCondition: condition,
          bathroomInteriorPaintConditionSource: condition
            ? 'user_selected'
            : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomGlassDoorStyleChange = useCallback(
    (style: BathroomGlassDoorStyle | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.glass_door;
        return {
          ...prev,
          bathroomGlassDoorStyle: style,
          bathroomGlassDoorStyleSource: style ? 'user_selected' : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleDrywallFinishLevelChange = useCallback(
    (finishLevel: string) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.drywall;
        return {
          ...prev,
          drywallFinishLevel: finishLevel,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleDrywallSheetLengthChange = useCallback((sheetLength: string) => {
    setMeasurementsSynced(prev => {
      const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
      delete pricingAcceptance.drywall;
      return {
        ...prev,
        drywallSheetLength: sheetLength,
        pricingAcceptance,
      };
    });
  }, []);

  const handleDrywallBoardBucketChange = useCallback(
    (
      measurementKey: DrywallBoardBucketDefinition['measurementKey'],
      sqft: number
    ) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.drywall;
        const nextValue = sqft > 0 ? String(Math.round(sqft)) : '';
        const next = {
          ...prev,
          [measurementKey]: nextValue,
          pricingAcceptance,
          quickMeasurementSources: {
            ...(prev.quickMeasurementSources || {}),
            [measurementKey]: 'user_selected',
          },
        };
        return syncDrywallPackageTotalFromBoardBuckets(next, {
          planFacts: next.planFacts as Record<string, unknown> | null,
        });
      });
    },
    []
  );

  const handleBathroomToiletRelocateFloorTypeChange = useCallback(
    (floorType: BathroomToiletRelocateFloorType | null) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.toilet;
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomToiletRelocateFloorType: floorType,
          bathroomToiletRelocateFloorTypeSource: floorType
            ? 'user_selected'
            : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleTrimFinishFieldPaintIncludedChange = useCallback(
    (included: boolean) => {
      setMeasurementsSynced(prev => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.trim_finish;
        return {
          ...prev,
          trimFinishFieldPaintIncluded: included,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const plumbingDemoScopeKey = useMemo(
    () =>
      items
        .map(item => `${item.id}:${item.state}:${item.choiceId ?? ''}`)
        .join('|'),
    [items]
  );

  useEffect(() => {
    const inferred = inferPlumbingExposedFromDemoScope(itemsRef.current);
    setMeasurementsSynced(prev => {
      if (prev.bathroomShowerRoughPlumbingExposedSource === 'user_selected') {
        return prev;
      }
      if (inferred) {
        if (
          prev.bathroomShowerRoughPlumbingExposed ===
            inferred.plumbingExposed &&
          prev.bathroomShowerRoughPlumbingExposedSource === inferred.source
        ) {
          return prev;
        }
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughPlumbingExposed: inferred.plumbingExposed,
          bathroomShowerRoughPlumbingExposedSource: inferred.source,
          pricingAcceptance,
        };
      }
      if (prev.bathroomShowerRoughPlumbingExposedSource === 'demo_detected') {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughPlumbingExposed: null,
          bathroomShowerRoughPlumbingExposedSource: null,
          pricingAcceptance,
        };
      }
      return prev;
    });
  }, [plumbingDemoScopeKey, setMeasurementsSynced]);

  const visualCtx = useMemo<ScopeItemVisualContext>(
    () => ({
      notes: scopeNotes,
      templateKey: checklist?.templateKey,
      measurements: normMeasurements,
    }),
    [scopeNotes, checklist?.templateKey, normMeasurements]
  );

  const noteSummary = useMemo(
    () => scopeChecklistNoteSummary(displayItems, visualCtx),
    [displayItems, visualCtx]
  );

  const pinnedDrywallFinishItem = useMemo(
    () =>
      resolvePinnedDrywallFinishItem(
        checklist?.templateKey,
        measurements as Record<string, unknown>,
        displayItems
      ),
    [
      checklist?.templateKey,
      displayItems,
      measurements,
      measurements.planImportMode,
      measurements.planImportTradeKey,
    ]
  );

  const pinnedDrywallAssemblyOptionsVisible = useMemo(
    () =>
      shouldShowPinnedDrywallAssemblyOptions(
        checklist?.templateKey,
        measurements as Record<string, unknown>
      ),
    [
      checklist?.templateKey,
      measurements,
      measurements.planImportMode,
      measurements.planImportTradeKey,
    ]
  );

  const groupedItems = useMemo(() => {
    const grouped = groupScopeChecklistItems(
      templateDisplayItems,
      checklist?.templateKey
    );
    return filterGroupedItemsWithoutPinnedTexture(
      grouped,
      pinnedDrywallFinishItem
    );
  }, [templateDisplayItems, checklist?.templateKey, pinnedDrywallFinishItem]);
  const embedQmScopeInQuickMeasurements = useMemo(() => {
    const living =
      Number(String(measurements.floorAreaSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.mainFloorLivingSqft) ||
      null;
    const garage =
      Number(String(measurements.garageSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.garageSqft) ||
      null;
    const effectiveKey = resolveEffectiveQuickMeasurementTemplateKey({
      templateKey: checklist?.templateKey,
      projectType: draft?.projectType,
      planRoomCount: Array.isArray(measurements.planRooms)
        ? measurements.planRooms.length
        : 0,
      livingSf: living,
      garageSf: garage,
    });
    return isPhotoNotesScopeJob({
      templateKey: effectiveKey,
      wholeHomeLayout: isWholeHomeQuickMeasurementTemplate(effectiveKey),
    });
  }, [
    checklist?.templateKey,
    draft?.projectType,
    measurements.floorAreaSqft,
    measurements.garageSqft,
    measurements.planRooms,
    measurements.planFacts,
  ]);
  const qmEmbeddedScopeIds = useMemo(() => {
    const living =
      Number(String(measurements.floorAreaSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.mainFloorLivingSqft) ||
      null;
    const garage =
      Number(String(measurements.garageSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.garageSqft) ||
      null;
    const effectiveKey = resolveEffectiveQuickMeasurementTemplateKey({
      templateKey: checklist?.templateKey,
      projectType: draft?.projectType,
      planRoomCount: Array.isArray(measurements.planRooms)
        ? measurements.planRooms.length
        : 0,
      livingSf: living,
      garageSf: garage,
    });
    return getQmEmbeddedScopeIds({
      templateKey: effectiveKey,
      wholeHomeLayout: isWholeHomeQuickMeasurementTemplate(effectiveKey),
    });
  }, [
    checklist?.templateKey,
    draft?.projectType,
    measurements.floorAreaSqft,
    measurements.garageSqft,
    measurements.planRooms,
    measurements.planFacts,
  ]);
  const qmScopeEmbeddedInQuickMeasurements = useCallback(
    (itemId: string) => {
      // Equipment types and whole-house ventilation are add-on pricing
      // cards. Keep them visible on Confirm Scope even though quantities are
      // entered in the HVAC Quick Measurements panel.
      if (
        (String(checklist?.templateKey || '').toLowerCase() === 'hvac' ||
          singleTradeKey === 'hvac') &&
        (itemId === 'equipment_replace' ||
          itemId === 'ventilation' ||
          (HVAC_EQUIPMENT_TYPE_SCOPE_ITEM_IDS as readonly string[]).includes(
            itemId
          ))
      ) {
        return false;
      }
      // Roofing Quick Measurements are only a selector/takeoff surface. Their
      // selected components still need independent Confirm Scope pricing cards.
      if (String(checklist?.templateKey || '').toLowerCase() === 'roofing') {
        return false;
      }
      if (!qmEmbeddedScopeIds.has(itemId)) return false;
      if (
        shouldHideBathroomFixtureScopeCardInQmEmbed(
          itemId,
          measurements as Record<string, unknown>,
          items
        )
      ) {
        return true;
      }
      if (BATHROOM_FIXTURES_QM_EMBEDDED_IDS.has(itemId)) return false;
      return true;
    },
    [checklist?.templateKey, qmEmbeddedScopeIds, measurements, items, singleTradeKey]
  );
  const syncHvacQmScopeItems = useCallback(
    (nextMeasurements: Record<string, unknown>) => {
      setItems(prev => {
        const next = syncQmPanelScopeItems(
          prev,
          {
            templateKey: singleTradeKey || checklist?.templateKey,
            wholeHomeLayout: false,
          },
          nextMeasurements
        );
        const unchanged =
          next.length === prev.length &&
          next.every((item, index) => item === prev[index]);
        return unchanged ? prev : next;
      });
    },
    [checklist?.templateKey, singleTradeKey]
  );
  const hideIncludedStuccoComponentCards = useMemo(() => {
    if (
      String(checklist?.templateKey || '').toLowerCase() !== 'stucco' &&
      !stuccoTradeFlow &&
      singleTradeKey !== 'stucco'
    ) {
      return false;
    }
    const system = displayItems.find(item => item.id === 'stucco');
    // Keep bundled component cards out of the normal Stucco flow. They are
    // included in every complete-system bid, and should not become standalone
    // priced lines while the contractor is still choosing the system.
    return String(system?.choiceId || '') !== 'repair_restucco';
  }, [checklist?.templateKey, displayItems, singleTradeKey, stuccoTradeFlow]);
  const includedStuccoComponentIds = useMemo(
    () =>
      new Set([
        'stucco_wrb',
        'stucco_lath',
        'stucco_base_coat',
        'stucco_finish_coat',
        'stucco_accessories',
      ]),
    []
  );
  const hideDeselectedRoofingQmCard = useCallback(
    (itemId: string) => {
      if (String(checklist?.templateKey || '').toLowerCase() !== 'roofing') {
        return false;
      }
      const selectionAliases: Record<string, string[]> = {
        tear_off: ['tear_off'],
        underlayment: ['underlayment'],
        ice_water_shield: ['ice_water_shield'],
        shingles_roofing: ['shingles', 'shingles_roofing'],
        decking_repair: ['decking_repair'],
        drip_edge: ['drip_edge'],
        ridge_cap: ['ridge_cap'],
        valley_flashing: ['valley_flashing'],
        step_flashing: ['step_flashing'],
        wall_flashing: ['wall_flashing'],
        ridge_vent: ['ridge_vent'],
        roof_vents: ['roof_vents'],
        turbine_vents: ['turbine_vents'],
        pipe_boots: ['pipe_boots'],
        chimney_flashing: ['chimney_flashing'],
        skylight_flashing: ['skylight_flashing'],
        roof_penetrations: ['roof_penetrations'],
        roof_repairs: ['roof_repairs'],
        gutters: ['gutters'],
        downspouts: ['downspouts'],
      };
      const aliases = selectionAliases[itemId];
      if (!aliases) return false;
      const selections = measurements.tradeScopeSelections?.roofing;
      const hasExplicitSelectionState =
        measurements.tradeScopeSelections &&
        Object.prototype.hasOwnProperty.call(
          measurements.tradeScopeSelections,
          'roofing'
        );
      if (!hasExplicitSelectionState) {
        return ['underlayment', 'ice_water_shield'].includes(itemId);
      }
      return !(
        Array.isArray(selections) &&
        aliases.some(alias => selections.includes(alias))
      );
    },
    [checklist?.templateKey, measurements.tradeScopeSelections]
  );
  const hideDuplicateRoofingBaseCard = useCallback(
    (itemId: string) => {
      if (
        String(checklist?.templateKey || '').toLowerCase() !== 'roofing' ||
        itemId !== 'shingles_roofing'
      ) {
        return false;
      }
      return displayItems.some(
        item =>
          item.id === 'roofing_system' &&
          item.state === 'included' &&
          Boolean(item.choiceId) &&
          !['not_in_scope', 'unsure'].includes(String(item.choiceId))
      );
    },
    [checklist?.templateKey, displayItems]
  );
  const scopeGroupedItems = useMemo(() => {
    return groupedItems
      .map(group => ({
        ...group,
        items: group.items.filter(
          item =>
            !hideDeselectedRoofingQmCard(item.id) &&
            !hideDuplicateRoofingBaseCard(item.id) &&
            !(
              hideIncludedStuccoComponentCards &&
              includedStuccoComponentIds.has(item.id)
            ) &&
            (!embedQmScopeInQuickMeasurements ||
              !qmScopeEmbeddedInQuickMeasurements(item.id))
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [
    groupedItems,
    embedQmScopeInQuickMeasurements,
    qmScopeEmbeddedInQuickMeasurements,
    hideIncludedStuccoComponentCards,
    includedStuccoComponentIds,
    hideDeselectedRoofingQmCard,
    hideDuplicateRoofingBaseCard,
  ]);

  const electricalPreviewScopeGroups = useMemo(() => {
    if (String(checklist?.templateKey || '').toLowerCase() !== 'electrical') {
      return [];
    }
    const previewMeasurements = electricalPreviewMeasurements || measurements;
    // Keep the preview in lockstep with Quick Measurements. The persisted
    // checklist can still contain a stale/excluded row (or no row at all)
    // when a contractor selects a quantity, so derive the preview from the
    // same convergence rules instead of waiting for the items effect to run.
    const previewItems = syncElectricalScopeItems(displayItems, {
      electricalScope: previewMeasurements.electricalScope,
      quantities: {
        ...(previewMeasurements as Partial<Record<string, unknown>>),
        ...Object.fromEntries(
          ELECTRICAL_CARDS.map(card => {
            const scalar = Number(previewMeasurements[card.measurementKey]);
            const itemQuantity = Number(
              previewMeasurements.itemQuantities?.[card.itemId]?.quantity
            );
            return [
              card.measurementKey,
              scalar > 0
                ? previewMeasurements[card.measurementKey]
                : itemQuantity,
            ];
          })
        ),
      },
    });
    const previewGroups = groupScopeChecklistItems(
      previewItems,
      checklist?.templateKey
    );
    const previewReadyItemIds = new Set(
      previewItems
        .filter(item => item.state === 'included')
        .filter(
          item =>
            resolveChecklistItemQuantity(item.id, normMeasurements, {
              templateKey: checklist?.templateKey,
              choiceId: item.choiceId,
            }).pricingReady
        )
        .map(item => item.id)
    );
    const unresolved = new Set(
      unresolvedElectricalConflictFields(
        previewMeasurements.measurementConflicts || []
      )
    );
    const blocked = new Set(
      previewMeasurements.electricalValidation?.blockedFields || []
    );
    const needsConfirmation = new Set(
      Object.entries(previewMeasurements.quickMeasurementSources || {})
        .filter(([, source]) => source === 'needs_confirmation')
        .map(([key]) => key)
    );
    const contractorConfirmed = new Set(
      Object.entries(previewMeasurements.quickMeasurementSources || {})
        .filter(
          ([, source]) =>
            source === 'user_entered' ||
            source === 'contractor_confirmed_from_plan_review'
        )
        .map(([key]) => key)
    );
    const selectedItemIds = new Set(
      ELECTRICAL_CARDS.filter(card => {
        const scalar = Number(previewMeasurements[card.measurementKey]);
        const itemQuantity = Number(
          previewMeasurements.itemQuantities?.[card.itemId]?.quantity
        );
        return (
          !unresolved.has(card.measurementKey) &&
          (!blocked.has(card.measurementKey) ||
            contractorConfirmed.has(card.measurementKey) ||
            needsConfirmation.has(card.measurementKey)) &&
          (!needsConfirmation.has(card.measurementKey) ||
            scalar > 0 ||
            itemQuantity > 0) &&
          (scalar > 0 ||
            itemQuantity > 0 ||
            previewReadyItemIds.has(card.itemId))
        );
      }).map(card => card.itemId)
    );
    return previewGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => selectedItemIds.has(item.id)),
      }))
      .filter(group => group.items.length > 0);
  }, [
    measurements,
    electricalPreviewMeasurements,
    displayItems,
    checklist?.templateKey,
    normMeasurements,
  ]);

  // QM steppers / shower SF → auto-include shower wall & floor tile scope cards.
  useEffect(() => {
    const templateKey = String(
      checklist?.templateKey || draft?.projectType || ''
    ).toLowerCase();
    const wholeHomeTileQm = isWholeHomeQuickMeasurementTemplate(templateKey);
    if (!embedQmScopeInQuickMeasurements && !wholeHomeTileQm) return;
    setItems(prev => {
      let next = syncWetAreaTileScopeItems(prev, {
        bathCount: measurements.bathCount,
        tilePanBathCount: measurements.tilePanBathCount,
        showerWallTileSqft: measurements.showerWallTileSqft,
        showerFloorTileSqft: measurements.showerFloorTileSqft,
        splitTileWetArea: !wholeHomeTileQm,
      });
      next = syncBathroomFloorTileScopeItems(next, {
        bathroomFloorSqft: measurements.bathroomFloorSqft,
        bathFloorTileCount: measurements.bathFloorTileCount,
      });
      return next;
    });
  }, [
    checklist?.templateKey,
    draft?.projectType,
    embedQmScopeInQuickMeasurements,
    measurements.bathCount,
    measurements.tilePanBathCount,
    measurements.showerWallTileSqft,
    measurements.showerFloorTileSqft,
    measurements.bathroomFloorSqft,
    measurements.bathFloorTileCount,
  ]);

  const syncFlooringScopeItemsFromMeasurements = useCallback(
    (snapshot: Record<string, unknown>) => {
      setItems(prev => {
        const next = syncFlooringQmScopeItems(prev, snapshot);
        return next === prev ? prev : next;
      });
    },
    []
  );

  useEffect(() => {
    const templateKey = checklist?.templateKey || draft?.projectType;
    if (String(templateKey || '').toLowerCase() !== 'flooring') return;
    syncFlooringScopeItemsFromMeasurements(
      measurements as Record<string, unknown>
    );
  }, [
    checklist?.templateKey,
    draft?.projectType,
    measurements.flooringProductScope,
    measurements.flooringCarpetSqft,
    measurements.flooringTileSqft,
    measurements.flooringLvpSqft,
    measurements.flooringLaminateSqft,
    measurements.flooringEngineeredHardwoodSqft,
    measurements.flooringSolidHardwoodSqft,
    measurements.flooringInstallScopeCount,
    measurements.flooringDemoScopeCount,
    measurements.flooringExistingTypes,
    measurements.flooringNewLvpInstallMethod,
    measurements.flooringExistingLvpInstallMethod,
    syncFlooringScopeItemsFromMeasurements,
  ]);

  // Landscaping QM selections / measurements → keep the saved checklist in sync
  // before Continue, not only during the initial panel hydration.
  useEffect(() => {
    const templateKey = checklist?.templateKey || draft?.projectType;
    if (String(templateKey || '').toLowerCase() !== 'landscaping') return;
    setItems(prev =>
      syncLandscapingQmScopeItems(prev, measurements as Record<string, unknown>)
    );
  }, [
    checklist?.templateKey,
    draft?.projectType,
    measurements.landscapeScope,
    measurements.demoClearingSqft,
    measurements.gradingSqft,
    measurements.soilPrepSqft,
    measurements.drainageLf,
    measurements.sodSqft,
    measurements.paverSqft,
    measurements.rockMulchSqft,
    measurements.landscapeTons,
    measurements.plantCount,
    measurements.treeCount,
    measurements.irrigationZoneCount,
    measurements.concreteEdgingLf,
    measurements.boulderCount,
    measurements.landscapeLightCount,
  ]);

  useEffect(() => {
    const templateKey = String(
      checklist?.templateKey || draft?.projectType || ''
    ).toLowerCase();
    if (templateKey !== 'concrete') return;
    setItems(prev =>
      syncConcreteQmScopeItems(prev, measurements as Record<string, unknown>)
    );
  }, [
    checklist?.templateKey,
    draft?.projectType,
    measurements.concreteScope,
    measurements.concreteDemoSqft,
    measurements.concreteSqft,
    measurements.concreteCy,
    measurements.excavationCy,
  ]);

  useEffect(() => {
    const templateKey = String(
      singleTradeKey || checklist?.templateKey || draft?.projectType || ''
    ).toLowerCase();
    if (!['deck_patio', 'hvac', 'roofing'].includes(templateKey)) return;
    setItems(prev =>
      syncQmPanelScopeItems(
        prev,
        { templateKey, wholeHomeLayout: false },
        measurements as Record<string, unknown>
      )
    );
  }, [
    checklist?.templateKey,
    singleTradeKey,
    draft?.projectType,
    measurements.tradeScopeSelections,
    measurements.concreteSqft,
    measurements.concreteCy,
    measurements.excavationCy,
    measurements.deckSqft,
    measurements.railingLf,
    measurements.roofAreaSqft,
    measurements.roofIceWaterShieldSqft,
    measurements.roofSquares,
  ]);

  // Paint SF in Quick measurements → auto-select Interior painting (Yes).
  useEffect(() => {
    setItems(prev =>
      syncInteriorPaintScopeItems(prev, {
        wallPaintSqft: measurements.wallPaintSqft,
        ceilingPaintSqft: measurements.ceilingPaintSqft,
        paintAreaSqft: measurements.paintAreaSqft,
        paintAreaBasis: measurements.paintAreaBasis,
        paintAreaNeedsConfirmation: measurements.paintAreaNeedsConfirmation,
        paintPricingMethod: measurements.paintPricingMethod,
        combinedPaintableAreaSqft: measurements.combinedPaintableAreaSqft,
        paintScope: measurements.paintScope,
        baseboardLf: measurements.baseboardLf,
        interiorDoorCount: measurements.interiorDoorCount,
        cabinetPaintSqft: measurements.cabinetPaintSqft,
        exteriorPaintSqft: measurements.exteriorPaintSqft,
      })
    );
  }, [
    measurements.wallPaintSqft,
    measurements.ceilingPaintSqft,
    measurements.paintAreaSqft,
    measurements.paintAreaBasis,
    measurements.paintAreaNeedsConfirmation,
    measurements.paintPricingMethod,
    measurements.combinedPaintableAreaSqft,
    measurements.paintScope,
    measurements.baseboardLf,
    measurements.interiorDoorCount,
    measurements.cabinetPaintSqft,
    measurements.exteriorPaintSqft,
  ]);

  useEffect(() => {
    if (String(checklist?.templateKey || '').toLowerCase() !== 'electrical')
      return;
    if (electricalQmQuantityEditingRef.current) return;
    const signature = electricalScopeSyncSignature(
      measurements as Record<string, unknown>
    );
    if (signature === electricalScopeSyncKeyRef.current) return;
    electricalScopeSyncKeyRef.current = signature;
    startTransition(() => {
      setItems(prev =>
        syncElectricalScopeItems(prev, {
          electricalScope: measurements.electricalScope,
          quantities: measurements as Partial<Record<string, unknown>>,
        })
      );
    });
  }, [checklist?.templateKey, measurements]);

  useEffect(() => {
    if (
      !notesPlumbingFlow &&
      !['plumbing', 'plumbing_service'].includes(
        String(checklist?.templateKey || '').toLowerCase()
      )
    )
      return;
    startTransition(() => {
      setItems(prev =>
        syncPlumbingScopeItems(prev, {
          plumbingScope: measurements.plumbingScope,
          quantities: measurements as Record<string, unknown>,
        })
      );
    });
  }, [
    notesPlumbingFlow,
    checklist?.templateKey,
    measurements.plumbingScope,
    measurements.serviceCallCount,
    measurements.fixtureRepairCount,
    measurements.fixtureReplacementCount,
    measurements.drainCleaningCount,
    measurements.waterLineLf,
    measurements.sewerLineLf,
    measurements.gasLineLf,
    measurements.plumbingRoughPointCount,
    measurements.plumbingTrimHookupCount,
    measurements.plumbingFixturesHardwareCount,
    measurements.waterHeaterCount,
    measurements.gasApplianceConnectionCount,
    measurements.partsMaterialsCount,
    measurements.emergencyFeeCount,
    measurements.plumbingCleanupCount,
  ]);

  useEffect(() => {
    if (String(checklist?.templateKey || '').toLowerCase() !== 'framing')
      return;
    startTransition(() => {
      setItems(prev =>
        syncFramingScopeItems(prev, {
          framingScope: measurements.framingScope,
          quantities: measurements as Record<string, unknown>,
        })
      );
    });
  }, [
    checklist?.templateKey,
    measurements.framingScope,
    measurements.framedAreaSqft,
    measurements.wallFramingLf,
    measurements.sheathingSqft,
    measurements.framingOpeningCount,
    measurements.framingCleanupCount,
    measurements.floorAreaSqft,
    measurements.garageSqft,
  ]);

  useEffect(() => {
    if (String(checklist?.templateKey || '').toLowerCase() !== 'windows_doors')
      return;
    startTransition(() => {
      setItems(prev =>
        syncWindowsDoorsScopeItems(
          prev,
          measurements as Record<string, unknown>
        )
      );
    });
  }, [
    checklist?.templateKey,
    measurements.windowCount,
    measurements.exteriorDoorCount,
    measurements.slidingDoorCount,
    measurements.interiorDoorCount,
  ]);

  useEffect(() => {
    if (String(checklist?.templateKey || '').toLowerCase() !== 'garage_doors')
      return;
    startTransition(() => {
      setItems(prev =>
        syncGarageDoorsScopeItems(
          prev,
          measurements as Record<string, unknown>
        )
      );
    });
  }, [
    checklist?.templateKey,
    measurements.garageDoorSingleCount,
    measurements.garageDoorDoubleCount,
    measurements.garageDoorRvCount,
    measurements.garageDoorOpenerCount,
  ]);

  // Quick measurements Paint / shower tile → paint_repair count when scope is selected.
  useEffect(() => {
    if (String(checklist?.templateKey || '').toLowerCase() !== 'bathroom')
      return;
    setMeasurementsSynced(prev =>
      syncBathroomPaintRepairItemQuantity(prev, items)
    );
  }, [
    checklist?.templateKey,
    measurements.wallPaintSqft,
    measurements.showerWallTileSqft,
    measurements.bathroomFloorSqft,
    measurements.bathroomPaintRepairScope,
    items,
  ]);

  // Shower wall/floor tile in scope → auto-select waterproofing & backer board.
  useEffect(() => {
    setItems(prev => syncWaterproofingFromTileScopeItems(prev));
  }, [
    items.find(row => row.id === 'shower_tile')?.state,
    items.find(row => row.id === 'shower_floor_tile')?.state,
  ]);

  useEffect(() => {
    if (!embedQmScopeInQuickMeasurements) return;
    setItems(prev =>
      syncBathroomFixtureQmScopeItems(prev, {
        bathroomInstallVanityCount: measurements.bathroomInstallVanityCount,
        bathroomInstallCounterCount: measurements.bathroomInstallCounterCount,
        bathroomDemoVanityCount: measurements.bathroomDemoVanityCount,
        bathroomDemoCounterCount: measurements.bathroomDemoCounterCount,
      })
    );
  }, [
    embedQmScopeInQuickMeasurements,
    measurements.bathroomInstallVanityCount,
    measurements.bathroomInstallCounterCount,
    measurements.bathroomDemoVanityCount,
    measurements.bathroomDemoCounterCount,
  ]);

  useEffect(() => {
    if (!embedQmScopeInQuickMeasurements) return;
    setItems(prev =>
      syncWetAreaDemoScopeItems(prev, {
        demo: readWetAreaDemoCounts(measurements),
        reuseExistingShowerDoor: Boolean(measurements.reuseExistingShowerDoor),
        installShowerDoorCount: measurements.showerDoorCount,
      })
    );
  }, [
    embedQmScopeInQuickMeasurements,
    measurements.demoTubCount,
    measurements.demoTileWallCount,
    measurements.demoTilePanCount,
    measurements.demoPrefabPanCount,
    measurements.demoPrefabEnclosureCount,
    measurements.demoShowerDoorCount,
    measurements.demoBathFloorTileCount,
    measurements.reuseExistingShowerDoor,
    measurements.showerDoorCount,
  ]);

  const scopeAssemblyContext = useMemo(
    () => ({
      activeScopeKeys: displayItems
        .filter(checklistItemInScope)
        .map(item => item.id),
      excludedScopeKeys: displayItems
        .filter(item => item.state === 'excluded')
        .map(item => item.id),
    }),
    [displayItems]
  );

  const isElectricalConfirmScope =
    String(checklist?.templateKey || '').toLowerCase() === 'electrical';
  const [electricalScopeRowsMounted, setElectricalScopeRowsMounted] =
    useState(false);

  useEffect(() => {
    if (!isElectricalConfirmScope || !visible || quickMeasurementsOpen) {
      setElectricalScopeRowsMounted(!isElectricalConfirmScope);
      return;
    }
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setElectricalScopeRowsMounted(true);
      });
    });
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [isElectricalConfirmScope, visible, quickMeasurementsOpen]);

  const pricingFooterComputeKey = useMemo(
    () =>
      [
        items
          .map(item => `${item.id}:${item.state}:${item.choiceId ?? ''}`)
          .join('|'),
        displayItems
          .map(item => `${item.id}:${item.state}:${item.label}`)
          .join('|'),
        electricalScopeSyncSignature(
          deferredMeasurements as Record<string, unknown>
        ),
        ['plumbing', 'plumbing_service'].includes(
          String(checklist?.templateKey || '').toLowerCase()
        )
          ? plumbingScopeSyncSignature(
              deferredMeasurements as Record<string, unknown>
            )
          : '',
        checklist?.templateKey,
        scopeNotes,
        benchmarkRefresh,
        embedQmScopeInQuickMeasurements ? '1' : '0',
      ].join('\u001f'),
    [
      items,
      displayItems,
      deferredMeasurements,
      checklist?.templateKey,
      scopeNotes,
      benchmarkRefresh,
      embedQmScopeInQuickMeasurements,
    ]
  );

  const [unconfirmedSuggestedPricing, setUnconfirmedSuggestedPricing] =
    useState<UnconfirmedSuggestedPricing[]>([]);
  const computeUnconfirmedSuggestedPricingRef = useRef<
    (generation: number) => Promise<UnconfirmedSuggestedPricing[]>
  >(() => Promise.resolve([]));
  const pricingItemCacheRef = useRef<{
    computeKey: string;
    entries: Map<string, UnconfirmedSuggestedPricing | null>;
  }>({
    computeKey: '',
    entries: new Map(),
  });
  const pricingInteractionGenerationRef = useRef(0);
  const pricingReadyRef = useRef(false);
  const pricingFooterInitialPassRef = useRef(true);
  computeUnconfirmedSuggestedPricingRef.current = async (
    generation: number
  ) => {
    const measurements = deferredMeasurements;
    const normMeasurements = deferredNormMeasurements;
    const rows: UnconfirmedSuggestedPricing[] = [];
    const isStale = () =>
      generation !== pricingInteractionGenerationRef.current;
    if (pricingItemCacheRef.current.computeKey !== pricingFooterComputeKey) {
      pricingItemCacheRef.current = {
        computeKey: pricingFooterComputeKey,
        entries: new Map(),
      };
    }
    const cache = pricingItemCacheRef.current.entries;
    const footerScopeKeys = new Set<string>();
    const bathroomPaintRepairCardVisible =
      items.some(candidate => candidate.id === 'paint_repair') ||
      displayItems.some(candidate => candidate.id === 'paint_repair');
    const bathroomPaintRepairScopeSelected =
      bathroomPaintRepairCardVisible &&
      hasPaintRepairScopeSelection({
        localizedScope: measurements.bathroomPaintRepairScope,
        entireRoom: measurements.bathroomPaintRepairEntireRoom,
        legacyScope: measurements.bathroomPaintRepairScope,
        scopeSource: measurements.bathroomPaintRepairScopeSource,
      });
    const blockedItemIds = conflictedSuggestedItemIds(
      (measurements.measurementConflicts || []).filter(
        conflict =>
          !measurements.quickMeasurementUserOverrides?.[conflict.field] &&
          shouldConfirmScopeShowPlanConflict(conflict.field, {
            tradeKey: singleTradeKey,
            templateKey: checklist?.templateKey,
          })
      )
    );
    for (let index = 0; index < displayItems.length; index += 1) {
      if (isStale()) return [];
      // Each resolver is synchronous and runs on React Native's JS thread.
      // Yield before every item so a tap never waits behind several pricing
      // resolvers in one batch.
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => resolve())
      );
      if (isStale()) return [];
      const item = displayItems[index];
      const cardTemplateKey = scopeCardTemplateKey(item.id);
      if (!checklistItemInScope(item)) continue;
      if (hideDeselectedRoofingQmCard(item.id)) continue;
      if (hideDuplicateRoofingBaseCard(item.id)) continue;
      if (
        embedQmScopeInQuickMeasurements &&
        qmScopeEmbeddedInQuickMeasurements(item.id)
      ) {
        continue;
      }
      if (item.id === 'interior_finishes') continue;
      if (
        bathroomPaintRepairCardVisible &&
        item.id === 'paint_repair' &&
        !bathroomPaintRepairScopeSelected
      ) {
        continue;
      }
      const footerScopeKey =
        bathroomPaintRepairCardVisible &&
        new Set([
          'paint_repair',
          'interior_paint',
          'paint',
          'paint_trim',
          'prep',
          'drywall',
          'patch_repair',
        ]).has(item.id)
          ? 'bathroom_paint_repair'
          : item.id;
      if (footerScopeKeys.has(footerScopeKey)) continue;
      if (
        bathroomPaintRepairCardVisible &&
        item.id !== 'paint_repair' &&
        new Set([
          'interior_paint',
          'paint',
          'paint_trim',
          'prep',
          'drywall',
          'patch_repair',
        ]).has(item.id)
      ) {
        continue;
      }
      if (item.state === 'unsure') continue;
      if (blockedItemIds.has(item.id)) continue;
      if (
        scopeHasCommittedConfirmScopePrice({
          itemId: item.id,
          itemQuantities: measurements.itemQuantities,
          pricingAcceptance: measurements.pricingAcceptance,
        }) ||
        hasAcceptedScopePricing(
          item.id,
          measurements.itemQuantities,
          measurements.pricingAcceptance
        ) ||
        scopeShowsConfirmScopeAppliedPricing(
          item.id,
          measurements,
          cardTemplateKey
        )
      ) {
        continue;
      }
      if (cache.has(item.id)) {
        const cached = cache.get(item.id);
        if (cached) {
          rows.push(cached);
          footerScopeKeys.add(footerScopeKey);
        }
        continue;
      }
      const resolved = resolveChecklistItemQuantity(item.id, normMeasurements, {
        choiceId: item.choiceId,
        templateKey: cardTemplateKey,
        notes: scopeNotes,
      });
      const initialSuggested = resolveScopeItemSuggestedPricing(
        item.id,
        measurements,
        cardTemplateKey,
        resolved,
        enrichedPricingContext,
        item.choiceId
      );
      const intelligence = resolveScopeItemIntelligence({
        scopeKey: item.id,
        templateKey: cardTemplateKey,
        notes: scopeNotes,
        measurements: normMeasurements,
        resolved,
        suggestedPricing: initialSuggested.fill,
        activeScopeKeys: scopeAssemblyContext.activeScopeKeys,
        excludedScopeKeys: scopeAssemblyContext.excludedScopeKeys,
        pricingAcceptance: measurements.pricingAcceptance,
        scopeGapResolutions: measurements.scopeGapResolutions,
        itemQuantities: measurements.itemQuantities,
        pricingAccepted: Boolean(measurements.pricingAcceptance?.[item.id]),
      });
      const suggested = resolveFormulaTargetSuggestedPricing({
        itemId: item.id,
        measurementsInput: measurements,
        templateKey: cardTemplateKey,
        resolved,
        pricingContext: enrichedPricingContext,
        intelligence,
        suggested: initialSuggested,
        choiceId: item.choiceId,
      });
      if (includeUnconfirmedSuggestedPricingFill(suggested.fill)) {
        const row = {
          itemId: item.id,
          label: item.label,
          block: suggested.fill,
        };
        cache.set(item.id, row);
        rows.push(row);
        footerScopeKeys.add(footerScopeKey);
      } else {
        cache.set(item.id, null);
      }
    }
    const tradeStages = new Set(
      rows
        .filter(
          ({ block }) =>
            block.benchmarkAction === 'price_ready' &&
            block.materialSource !== 'local_benchmark' &&
            block.laborSource !== 'local_benchmark' &&
            block.benchmarkStageKey
        )
        .map(({ block }) => block.benchmarkStageKey as string)
    );
    return rows.filter(({ block }) => {
      const stageKey = block.benchmarkStageKey;
      if (
        block.benchmarkAction === 'benchmark_only' &&
        stageKey &&
        tradeStages.has(stageKey)
      ) {
        return false;
      }
      return true;
    });
  };

  useEffect(() => {
    if (!visible) {
      pricingFooterInitialPassRef.current = true;
      pricingReadyRef.current = false;
      setUnconfirmedSuggestedPricing([]);
      pricingItemCacheRef.current = {
        computeKey: '',
        entries: new Map(),
      };
      return;
    }
    // Keep the previous footer row while recomputing. Clearing to [] shrinks the
    // sticky footer ("X prices ready") and makes Continue to review bounce.
    pricingReadyRef.current = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let interactionHandle: { cancel: () => void } | null = null;
    const generation = ++pricingInteractionGenerationRef.current;
    const runImmediate = pricingFooterInitialPassRef.current;
    pricingFooterInitialPassRef.current = false;
    const run = async () => {
      if (cancelled || generation !== pricingInteractionGenerationRef.current) {
        return;
      }
      const next =
        await computeUnconfirmedSuggestedPricingRef.current(generation);
      if (cancelled || generation !== pricingInteractionGenerationRef.current) {
        return;
      }
      pricingReadyRef.current = true;
      startTransition(() => {
        setUnconfirmedSuggestedPricing(next);
      });
    };
    if (!runImmediate && quickMeasurementsOpen) {
      // Debounce while Quick measurements is expanded so keystrokes do not
      // resize the sticky footer on every character. Still run once immediately
      // on first open so "N prices ready" appears when scrolling to cards.
      timer = setTimeout(() => {
        interactionHandle = InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => {
            void run();
          });
        });
      }, 800);
    } else {
      void run();
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      interactionHandle?.cancel();
    };
  }, [
    visible,
    isElectricalConfirmScope,
    pricingFooterComputeKey,
    quickMeasurementsOpen,
    qmScopeEmbeddedInQuickMeasurements,
    hideDeselectedRoofingQmCard,
    hideDuplicateRoofingBaseCard,
  ]);

  const scopeItemsNeedingConfirmation = useMemo(
    () =>
      listScopeItemsNeedingConfirmation(displayItems, normMeasurements, {
        templateKey: checklist?.templateKey,
        notes: scopeNotes,
        pricingAcceptance: measurements.pricingAcceptance,
        bathroomPaintRepairScope: measurements.bathroomPaintRepairScope,
        bathroomPaintRepairEntireRoom:
          measurements.bathroomPaintRepairEntireRoom,
        bathroomToiletRelocateFloorType:
          measurements.bathroomToiletRelocateFloorType,
        bathroomVanityCountertopMaterialType:
          measurements.bathroomVanityCountertopMaterialType,
      }),
    [
      displayItems,
      normMeasurements,
      checklist?.templateKey,
      scopeNotes,
      measurements.pricingAcceptance,
      measurements.bathroomPaintRepairScope,
      measurements.bathroomPaintRepairEntireRoom,
      measurements.bathroomToiletRelocateFloorType,
      measurements.bathroomVanityCountertopMaterialType,
    ]
  );

  const pricingFooterMeasurements =
    String(checklist?.templateKey || '').toLowerCase() === 'electrical'
      ? deferredMeasurements
      : measurements;
  const suggestedPricingFooterBreakdown = useMemo(() => {
    let readyCount = 0;
    let benchmarkOnlyCount = 0;
    let needsAmperageConfirmCount = 0;
    const unresolvedPlanConflicts = (
      pricingFooterMeasurements.measurementConflicts || []
    ).filter(
      conflict =>
        !pricingFooterMeasurements.quickMeasurementUserOverrides?.[
          conflict.field
        ] &&
        shouldConfirmScopeShowPlanConflict(conflict.field, {
          tradeKey: singleTradeKey,
          templateKey: checklist?.templateKey,
        })
    );
    const blockedItemIds = conflictedSuggestedItemIds(unresolvedPlanConflicts);
    const selectedScopeIds = new Set(
      displayItems
        .filter(item => checklistItemInScope(item) && item.state !== 'unsure')
        .map(item => item.id)
    );
    const appliedScopeIds = new Set(
      step2AppliedPricingLines.map(line => line.itemId)
    );
    const appliedScopeLabels = new Set(
      step2AppliedPricingLines.map(line =>
        String(line.label || '')
          .trim()
          .toLowerCase()
      )
    );
    // Legacy drafts can retain a combined pricing owner after the checklist
    // splits it into child rows. Do not count those already-applied dollars as
    // new prices ready to apply.
    const appliedScopeAliases: Record<string, string[]> = {
      cabinets_counters: ['cabinets', 'countertops'],
      cabinets: ['cabinets_counters'],
      countertops: ['cabinets_counters'],
      flooring: ['tile_flooring'],
      tile_flooring: ['flooring'],
      paint: ['interior_paint', 'paint_trim'],
      interior_paint: ['paint', 'paint_trim'],
      paint_trim: ['paint', 'interior_paint'],
    };
    const hasAppliedPricingForScope = (
      itemId: string,
      label: string
    ): boolean =>
      appliedScopeIds.has(itemId) ||
      appliedScopeLabels.has(label) ||
      (appliedScopeAliases[itemId] || []).some(alias =>
        appliedScopeIds.has(alias)
      );
    const readyRows: UnconfirmedSuggestedPricing[] = [];
    for (const row of unconfirmedSuggestedPricing) {
      // The suggestion list can briefly retain a row while a Yes/No/Not sure
      // choice is being synchronized. Count only currently selected scope items.
      if (!selectedScopeIds.has(row.itemId)) continue;
      if (blockedItemIds.has(row.itemId)) continue;
      // Applied pricing lines are the source of truth for this footer. This
      // also prevents stale suggestion rows from being counted after a card
      // has already been priced.
      if (
        hasAppliedPricingForScope(
          row.itemId,
          String(row.label || '')
            .trim()
            .toLowerCase()
        )
      ) {
        continue;
      }
      const hasCommittedPricing =
        scopeHasCommittedConfirmScopePrice({
          itemId: row.itemId,
          itemQuantities: pricingFooterMeasurements.itemQuantities,
          pricingAcceptance: pricingFooterMeasurements.pricingAcceptance,
        }) ||
        hasAcceptedScopePricing(
          row.itemId,
          pricingFooterMeasurements.itemQuantities,
          pricingFooterMeasurements.pricingAcceptance
        );
      if (hasCommittedPricing) {
        continue;
      }
      if (
        !shouldIncludeConfirmScopeBulkApplyRow({
          block: row.block,
          hasCommittedPricing,
        })
      ) {
        continue;
      }
      if (suggestedPricingFooterCountsAmperageConfirm(row.block)) {
        needsAmperageConfirmCount += 1;
        continue;
      }
      if (isConfirmScopePlanningBenchmarkRow(row.block)) {
        benchmarkOnlyCount += 1;
      }
      readyCount += 1;
      readyRows.push(row);
    }
    return {
      readyCount,
      benchmarkOnlyCount,
      needsMeasurementCount:
        unresolvedPlanConflicts.length + needsAmperageConfirmCount,
      readyRows,
      readyLabels: readyRows.map(row => row.label),
    };
  }, [
    checklist?.templateKey,
    displayItems,
    pricingFooterMeasurements,
    step2AppliedPricingLines,
    unconfirmedSuggestedPricing,
  ]);

  const suggestedPricingFooterSummary = footerSuggestedPricingSummary({
    readyCount: suggestedPricingFooterBreakdown.readyCount,
    benchmarkOnlyCount: suggestedPricingFooterBreakdown.benchmarkOnlyCount,
    needsMeasurementCount:
      suggestedPricingFooterBreakdown.needsMeasurementCount,
  });
  const scrollToPricingLabel = footerScrollToPricingButtonLabel(
    suggestedPricingFooterBreakdown.readyCount
  );
  const pricingPendingHint = footerSuggestedPricingPendingHint({
    needsMeasurementCount: suggestedPricingFooterBreakdown.needsMeasurementCount,
  });

  const applySuggestedPricingBlocks = useCallback(
    (rows: UnconfirmedSuggestedPricing[]) => {
      if (!rows.length) return;
      hapticTap();
      deferConfirmScopeHeavyWork(() => {
        selectedPricingRef.current = {
          ...selectedPricingRef.current,
          ...Object.fromEntries(rows.map(row => [row.itemId, row.block])),
        };
        setMeasurementsSynced(prev => {
          const { measurements, clearedSelectedOwners } =
            mergeSuggestedPricingBlocksIntoMeasurements(
              prev,
              rows,
              checklist?.templateKey
            );
          if (clearedSelectedOwners.length) {
            const selected = { ...selectedPricingRef.current };
            for (const owner of clearedSelectedOwners) delete selected[owner];
            selectedPricingRef.current = selected;
          }
          return measurements;
        });
        setTimeout(() => persistScopeProgressNow(), 0);
      });
    },
    [checklist?.templateKey, persistScopeProgressNow, setMeasurementsSynced]
  );

  const handleItemQuantityChange = (
    itemId: string,
    quantity: string,
    field: 'count' | 'allowance' = 'count',
    unit?: string,
    source: QuantitySource = 'user_entered',
    calculatedRevertFrom?: CalculatedQuantityRevertSnapshot
  ) => {
    const baseItemId = itemId.replace(
      /__(allowance|sqft_basis|material|labor)$/,
      ''
    );
    const rule = getChecklistItemQuantityRuleOrDefault(
      baseItemId,
      checklist?.templateKey
    );
    if (field === 'allowance' && rule?.dualAllowanceField) {
      setMeasurementsSynced(prev => ({
        ...prev,
        itemQuantities: {
          ...prev.itemQuantities,
          [roughAllowanceSubKey(itemId)]: {
            quantity,
            unit: unit || 'allowance',
            quantitySource: source,
          },
        },
        pricingAcceptance:
          source === 'user_entered'
            ? markManualPricingAdjustment(
                prev.pricingAcceptance?.[baseItemId],
                baseItemId,
                prev.pricingAcceptance,
                moneyTotalAfterQuantityEdit(
                  baseItemId,
                  {
                    ...prev.itemQuantities,
                    [roughAllowanceSubKey(itemId)]: {
                      quantity,
                      unit: unit || 'allowance',
                      quantitySource: source,
                    },
                  },
                  roughAllowanceSubKey(itemId),
                  quantity
                )
              )
            : prev.pricingAcceptance,
      }));
      return;
    }
    setMeasurementsSynced(prev => {
      const previousEntry = prev.itemQuantities[itemId];
      const resolvedUnit =
        isWindowsDoorsCountScopeItemId(baseItemId) &&
        field === 'count' &&
        !['allowance', 'lump_sum'].includes(
          String(unit || '').toLowerCase()
        )
          ? 'each'
          : unit ||
            (rule?.dualAllowanceField ? 'each' : rule.defaultUnit);
      const itemQuantities = {
        ...prev.itemQuantities,
        [itemId]: {
          quantity,
          unit: resolvedUnit,
          quantitySource: source,
          ...(source === 'calculated_confirmed' && calculatedRevertFrom
            ? {
                quantityBeforeCalculated:
                  previousEntry?.quantityBeforeCalculated ??
                  calculatedRevertFrom,
              }
            : {}),
        },
      };
      if (
        (HVAC_EQUIPMENT_TYPE_SCOPE_ITEM_IDS as readonly string[]).includes(
          itemId
        )
      ) {
        itemQuantities[`equipment_replace__${itemId}`] = {
          ...itemQuantities[itemId],
        };
      }

      if (rule?.dualAllowanceField && field === 'count') {
        const allowanceKey = roughAllowanceSubKey(itemId);
        const materialKey = `${itemId}__material`;
        const laborKey = `${itemId}__labor`;
        if (source === 'calculated_confirmed') {
          delete itemQuantities[allowanceKey];
          delete itemQuantities[materialKey];
          delete itemQuantities[laborKey];
          const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
          delete pricingAcceptance[itemId];
          return syncItemQuantitiesToMeasurementFields({
            ...prev,
            itemQuantities,
            pricingAcceptance,
          });
        }
        const hasManualPricing = [allowanceKey, materialKey, laborKey].some(
          key => {
            const entry = prev.itemQuantities[key];
            return (
              entry?.quantitySource === 'user_entered' &&
              String(entry.quantity || '').trim()
            );
          }
        );

        if (!hasManualPricing) {
          const nextInput = { ...prev, itemQuantities };
          const normalized = buildNormalizedScopeMeasurementsFromInput(
            nextInput,
            {
              notes: scopeNotes,
              templateKey: checklist?.templateKey,
            }
          );
          const resolved = resolveChecklistItemQuantity(itemId, normalized, {
            templateKey: checklist?.templateKey,
            notes: scopeNotes,
          });
          const suggested = resolveScopeItemSuggestedPricing(
            itemId,
            nextInput,
            checklist?.templateKey,
            resolved,
            enrichedPricingContext
          ).fill;

          if (suggested) {
            itemQuantities[allowanceKey] = {
              quantity: String(suggested.total),
              unit: 'allowance',
              quantitySource: 'inferred',
            };
            itemQuantities[materialKey] = {
              quantity: String(suggested.material),
              unit: 'allowance',
              quantitySource: 'inferred',
            };
            itemQuantities[laborKey] = {
              quantity: String(suggested.labor),
              unit: 'allowance',
              quantitySource: 'inferred',
            };
          }
        }
      }

      const pricingAcceptance =
        source === 'calculated_confirmed'
          ? (() => {
              const next = { ...(prev.pricingAcceptance || {}) };
              delete next[itemId];
              return next;
            })()
          : source === 'user_entered' &&
              /__(allowance|sqft_basis|material|labor)$/.test(itemId)
            ? markManualPricingAdjustment(
                prev.pricingAcceptance?.[baseItemId],
                baseItemId,
                prev.pricingAcceptance,
                moneyTotalAfterQuantityEdit(
                  baseItemId,
                  itemQuantities,
                  itemId,
                  quantity
                )
              )
            : prev.pricingAcceptance;

      const nextState = {
        ...prev,
        itemQuantities,
        ...(baseItemId === 'stucco_repairs' && field === 'count'
          ? { stuccoRepairAffectedSqft: quantity }
          : {}),
        ...(itemId === 'hvac__capacity' && field === 'count'
          ? {
              hvacSystemTons: quantity.replace(/,/g, ''),
              quickMeasurementSources: {
                ...(prev.quickMeasurementSources || {}),
                hvacSystemTons: 'user_entered' as const,
              },
            }
          : {}),
        ...(field === 'count' && source === 'user_entered'
          ? (() => {
              if (baseItemId === 'hvac') {
                return {
                  hvacSystemCount: quantity.replace(/,/g, ''),
                  quickMeasurementSources: {
                    ...(prev.quickMeasurementSources || {}),
                    hvacSystemCount: 'user_entered' as const,
                  },
                };
              }
              const card = plumbingCardForItemId(baseItemId);
              if (!card || card.unit === 'allowance') return {};
              return {
                [card.measurementKey]: quantity.replace(/,/g, ''),
                quickMeasurementSources: {
                  ...(prev.quickMeasurementSources || {}),
                  [card.measurementKey]: 'user_entered' as const,
                },
              };
            })()
          : {}),
        pricingAcceptance,
      };
      return source === 'calculated_confirmed'
        ? syncItemQuantitiesToMeasurementFields(nextState)
        : nextState;
    });
  };

  const handleBatchItemQuantityChange = useCallback(
    (
      updates: Array<{
        itemId: string;
        quantity: string;
        unit?: string;
        quantitySource?: 'user_entered' | 'suggested_prefill';
      }>
    ) => {
      if (!updates.length) return;
      setMeasurementsSynced(prev => {
        const itemQuantities = { ...prev.itemQuantities };
        let pricingAcceptance = prev.pricingAcceptance;
        for (const update of updates) {
          const baseItemId = update.itemId.replace(
            /__(allowance|sqft_basis|material|labor)$/,
            ''
          );
          const rule = getChecklistItemQuantityRuleOrDefault(
            baseItemId,
            checklist?.templateKey
          );
          const quantitySource = update.quantitySource || 'user_entered';
          itemQuantities[update.itemId] = {
            quantity: update.quantity,
            unit:
              update.unit ||
              (rule?.dualAllowanceField ? 'each' : rule.defaultUnit),
            quantitySource,
          };
          // Prefill from Suggest must not create acceptance / hide the Apply card.
          if (
            quantitySource !== 'suggested_prefill' &&
            /__(allowance|sqft_basis|material|labor)$/.test(update.itemId)
          ) {
            pricingAcceptance = markManualPricingAdjustment(
              pricingAcceptance?.[baseItemId],
              baseItemId,
              pricingAcceptance,
              moneyTotalAfterQuantityEdit(
                baseItemId,
                itemQuantities,
                update.itemId,
                update.quantity
              )
            );
          }
        }
        return { ...prev, itemQuantities, pricingAcceptance };
      });
    },
    [checklist?.templateKey, setMeasurementsSynced]
  );

  const handleClearSuggestedPrefill = useCallback(
    (
      itemId: string,
      pendingUpdates?: Array<{
        itemId: string;
        quantity: string;
        unit?: string;
        quantitySource?: 'user_entered' | 'suggested_prefill';
      }>
    ) => {
      setMeasurementsSynced(prev => {
        const itemQuantities = { ...(prev.itemQuantities || {}) };
        for (const update of pendingUpdates ?? []) {
          const baseItemId = update.itemId.replace(
            /__(allowance|sqft_basis|material|labor)$/,
            ''
          );
          const rule = getChecklistItemQuantityRuleOrDefault(
            baseItemId,
            checklist?.templateKey
          );
          itemQuantities[update.itemId] = {
            quantity: update.quantity,
            unit: update.unit || rule.defaultUnit,
            quantitySource: update.quantitySource || 'user_entered',
          };
        }
        const finalized = finalizeScopePricingAfterEditorClose({
          itemId,
          itemQuantities,
          pricingAcceptance: prev.pricingAcceptance,
        });
        return {
          ...prev,
          itemQuantities: finalized.itemQuantities,
          pricingAcceptance: finalized.pricingAcceptance,
        };
      });
    },
    [checklist?.templateKey, setMeasurementsSynced]
  );

  const scrollToFirstMissingMeasurement = useCallback(() => {
    for (const item of displayItems) {
      if (!checklistItemInScope(item)) continue;
      if (isCustomScopeItem(item)) {
        if (customScopePricingTotal(measurements, item.id) > 0) continue;
        const node = itemRefs.current[item.id];
        const content = scrollContentRef.current;
        if (node && content) {
          node.measureLayout(content, (_x, y) => {
            scrollRef.current?.scrollTo({
              y: Math.max(0, y - 12),
              animated: true,
            });
          });
        }
        return;
      }
      const rule = getChecklistItemQuantityRuleOrDefault(
        item.id,
        checklist?.templateKey
      );
      const resolved = resolveChecklistItemQuantity(item.id, normMeasurements, {
        choiceId: item.choiceId,
        templateKey: checklist?.templateKey,
        notes: scopeNotes,
      });
      if (!resolved.showInput || resolved.pricingReady) continue;

      const group = groupedItems.find(g =>
        g.items.some(row => row.id === item.id)
      );
      if (group?.title) {
        setCollapsedGroups(prev => ({ ...prev, [group.title]: false }));
      }

      const node = itemRefs.current[item.id];
      const content = scrollContentRef.current;
      if (node && content) {
        node.measureLayout(content, (_x, y) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, y - 12),
            animated: true,
          });
        });
      }
      return;
    }
  }, [
    displayItems,
    groupedItems,
    measurements,
    normMeasurements,
    checklist?.templateKey,
    scopeNotes,
  ]);

  const handleItemQuantityBlur = (
    itemId: string,
    field: 'count' | 'allowance' = 'count'
  ) => {
    const focusKey = `${itemId}:${field}`;
    focusedQuantityRef.current = null;
    setTimeout(() => {
      if (focusedQuantityRef.current === focusKey) return;
      setMeasurementsSynced(prev => {
        const key =
          field === 'allowance' && isDualAllowanceItem(itemId)
            ? roughAllowanceSubKey(itemId)
            : itemId;
        const current = prev.itemQuantities[key];
        if (current?.quantity?.trim()) return prev;
        const itemQuantities = { ...prev.itemQuantities };
        delete itemQuantities[key];
        const baseItemId = key.replace(
          /__(allowance|sqft_basis|material|labor)$/,
          ''
        );
        let pricingAcceptance = prev.pricingAcceptance;
        if (
          pricingAcceptance?.[baseItemId] &&
          !(liveScopeMoneyFromQuantities(baseItemId, itemQuantities) > 0)
        ) {
          pricingAcceptance = { ...pricingAcceptance };
          delete pricingAcceptance[baseItemId];
        }
        return { ...prev, itemQuantities, pricingAcceptance };
      });
    }, 250);
  };

  const handleRevertCalculatedQuantity = useCallback(
    (itemId: string) => {
      hapticTap();
      setMeasurementsSynced(prev => {
        const entry = prev.itemQuantities[itemId];
        const snapshot = entry?.quantityBeforeCalculated;
        if (!snapshot) return prev;
        const itemQuantities = { ...prev.itemQuantities };
        if (
          snapshot.relatedEntries &&
          Object.keys(snapshot.relatedEntries).length > 0
        ) {
          for (const key of Object.keys(itemQuantities)) {
            if (key === itemId || key.startsWith(`${itemId}__`)) {
              delete itemQuantities[key];
            }
          }
          for (const [key, saved] of Object.entries(snapshot.relatedEntries)) {
            itemQuantities[key] = {
              quantity: saved.quantity != null ? String(saved.quantity) : '',
              unit: saved.unit,
              quantitySource: saved.quantitySource ?? 'inferred',
            };
          }
        } else {
          const { quantityBeforeCalculated: _removed, ...restEntry } = entry;
          itemQuantities[itemId] = {
            ...restEntry,
            quantity:
              snapshot.quantity != null ? String(snapshot.quantity) : '',
            unit: snapshot.unit,
            quantitySource: snapshot.quantitySource ?? 'inferred',
          };
        }
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        if (
          Object.prototype.hasOwnProperty.call(
            snapshot,
            'pricingAcceptanceBeforeCalculated'
          )
        ) {
          if (snapshot.pricingAcceptanceBeforeCalculated) {
            pricingAcceptance[itemId] =
              snapshot.pricingAcceptanceBeforeCalculated;
          } else {
            delete pricingAcceptance[itemId];
          }
        } else {
          delete pricingAcceptance[itemId];
        }
        return {
          ...prev,
          itemQuantities,
          pricingAcceptance,
        };
      });
      setTimeout(() => persistScopeProgressNow(), 0);
    },
    [persistScopeProgressNow]
  );

  const handleItemQuantityFocus = (
    itemId: string,
    field: 'count' | 'allowance' = 'count'
  ) => {
    focusedQuantityRef.current = `${itemId}:${field}`;
    setMeasurementsSynced(prev => {
      const baseItemId = itemId.replace(
        /__(allowance|sqft_basis|material|labor)$/,
        ''
      );
      const rule = getChecklistItemQuantityRuleOrDefault(
        baseItemId,
        checklist?.templateKey
      );
      let key = itemId;
      if (
        field === 'allowance' &&
        rule.dualAllowanceField &&
        !itemId.includes('__')
      ) {
        key = roughAllowanceSubKey(baseItemId);
      }
      if (prev.itemQuantities[key]?.quantitySource === 'user_entered')
        return prev;
      const unitForKey = (() => {
        if (
          key.endsWith('__allowance') ||
          key.endsWith('__material') ||
          key.endsWith('__labor')
        ) {
          return 'allowance';
        }
        if (key.endsWith('__sqft_basis')) {
          return (
            resolveAllowanceEditorPricingBasis(
              baseItemId,
              prev,
              checklist?.templateKey
            )?.unit || 'sqft'
          );
        }
        if (field === 'allowance') return 'allowance';
        return rule.defaultUnit;
      })();
      return {
        ...prev,
        itemQuantities: {
          ...prev.itemQuantities,
          [key]: {
            quantity: String(prev.itemQuantities[key]?.quantity ?? ''),
            unit: unitForKey,
            quantitySource: 'user_entered',
          },
        },
      };
    });
  };

  const applySuggestedPricingNow = useCallback(
    (
      itemId: string,
      block: SuggestedPricingBlock,
      overrideConfirmed = false,
      replaceStageKey?: string | null,
      measurementPatch?: Partial<ScopeMeasurementsInputExtended>
    ) => {
      runConfirmScopeApplyWork(() => {
      const currentMeasurements = measurementPatch
        ? { ...measurementsRef.current, ...measurementPatch }
        : measurementsRef.current;
      const plumbingCard = plumbingCardForItemId(itemId);
      const takeoffQuantity = plumbingCard
        ? Number(
            String(
              (currentMeasurements as Record<string, unknown>)[
                plumbingCard.measurementKey
              ] ?? ''
            ).replace(/,/g, '')
          )
        : NaN;
      const pricedBlock = Number.isFinite(takeoffQuantity)
        ? scaleSuggestedBlockToTakeoffQuantity(block, takeoffQuantity)
        : block;
      const replacedStageOwner = replaceStageKey
        ? STAGE_BENCHMARK_OWNERS[replaceStageKey]
        : null;
      if (replacedStageOwner) {
        const nextSelected = { ...selectedPricingRef.current };
        delete nextSelected[replacedStageOwner];
        selectedPricingRef.current = nextSelected;
      }
      selectedPricingRef.current = {
        ...selectedPricingRef.current,
        [itemId]: pricedBlock,
      };
      const semanticsOn = measurementSemanticsV1Enabled();

      setMeasurementsSynced(prev => {
        const merged = measurementPatch
          ? { ...prev, ...measurementPatch }
          : prev;
        const latestTakeoff = plumbingCardForItemId(itemId);
        const latestQuantity = latestTakeoff
          ? Number(
              String(
                (merged as Record<string, unknown>)[
                  latestTakeoff.measurementKey
                ] ?? ''
              ).replace(/,/g, '')
            )
          : NaN;
        const block =
          latestTakeoff && latestQuantity > 0
            ? scaleSuggestedBlockToTakeoffQuantity(pricedBlock, latestQuantity)
            : pricedBlock;
        selectedPricingRef.current = {
          ...selectedPricingRef.current,
          [itemId]: block,
        };
        const acceptance = buildAcceptanceFromSuggestedBlock(block);
        const isBenchmarkBlock =
          block.materialSource === 'local_benchmark' ||
          block.laborSource === 'local_benchmark';
        const rule = getChecklistItemQuantityRuleOrDefault(
          itemId,
          checklist?.templateKey
        );
        const allowanceKey = rule.dualAllowanceField
          ? roughAllowanceSubKey(itemId)
          : allowanceSplitSubKey(itemId, 'allowance');
        const basisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
        const materialKey = allowanceSplitSubKey(itemId, 'material');
        const laborKey = allowanceSplitSubKey(itemId, 'labor');
        const existingEntry = prev.itemQuantities[itemId] as
          | {
              quantity?: string;
              unit?: string;
              quantitySource?: string;
              measurementState?: ScopeMeasurementState;
            }
          | undefined;
        const itemQuantities: Record<
          string,
          {
            quantity: string;
            unit: string;
            quantitySource: string;
            measurementState?: ScopeMeasurementState | null;
          }
        > = {
          ...prev.itemQuantities,
          [allowanceKey]: {
            quantity: String(block.total),
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        };
        const pricingAcceptance = {
          ...(prev.pricingAcceptance || {}),
        };
        let appliedBenchmarkKeys = [...(prev.appliedBenchmarkKeys || [])];
        if (replacedStageOwner && replaceStageKey) {
          delete pricingAcceptance[replacedStageOwner];
          for (const key of [
            replacedStageOwner,
            allowanceSplitSubKey(replacedStageOwner, 'allowance'),
            allowanceSplitSubKey(replacedStageOwner, 'sqft_basis'),
            allowanceSplitSubKey(replacedStageOwner, 'material'),
            allowanceSplitSubKey(replacedStageOwner, 'labor'),
            roughAllowanceSubKey(replacedStageOwner),
          ]) {
            delete itemQuantities[key];
          }
          appliedBenchmarkKeys = appliedBenchmarkKeys.filter(
            key => !key.endsWith(`::stage::${replaceStageKey}`)
          );
        }
        if (block.basis?.quantity && block.basis.unit) {
          itemQuantities[basisKey] = {
            quantity: String(block.basis.quantity),
            unit: block.basis.unit,
            quantitySource: 'user_entered',
          };
        }
        if (!block.lumpSumOnly) {
          itemQuantities[materialKey] = {
            quantity: String(block.material),
            unit: 'allowance',
            quantitySource: 'user_entered',
          };
          itemQuantities[laborKey] = {
            quantity: String(block.labor),
            unit: 'allowance',
            quantitySource: 'user_entered',
          };
        } else if (block.labor > 0) {
          itemQuantities[laborKey] = {
            quantity: String(block.labor),
            unit: 'allowance',
            quantitySource: 'user_entered',
          };
        }

        if (semanticsOn && isBenchmarkBlock) {
          const livingQty = Number(
            block.basis?.quantity ||
              block.benchmarkEvidence?.benchmarkBasis.quantity ||
              0
          );
          const previousPrimaryQty = Number(existingEntry?.quantity);
          const previousPrimaryUnit = existingEntry?.unit || null;
          const preservePrimary =
            existingEntry?.measurementState?.primaryTakeoff?.quantity != null ||
            (Number.isFinite(previousPrimaryQty) &&
              previousPrimaryQty > 0 &&
              previousPrimaryUnit &&
              previousPrimaryUnit !== 'living_sqft' &&
              previousPrimaryUnit !== 'sqft') ||
            existingEntry?.quantitySource === 'user_entered';

          const primaryTakeoff = preservePrimary
            ? existingEntry?.measurementState?.primaryTakeoff || {
                role: 'primary_takeoff' as const,
                quantity: Number.isFinite(previousPrimaryQty)
                  ? previousPrimaryQty
                  : null,
                unit:
                  (previousPrimaryUnit as any) || preferredPrimaryUnit(itemId),
                sourceType: 'user_entered' as const,
                confidence: 'medium' as const,
                requiresReview: false,
                isUserConfirmed: true,
              }
            : null;

          const guard = assertBenchmarkDoesNotOverwritePrimary({
            previousPrimaryQuantity: primaryTakeoff?.quantity ?? null,
            previousPrimaryUnit: primaryTakeoff?.unit ?? null,
            nextPrimaryQuantity: livingQty,
            nextPrimaryUnit: 'living_sqft',
            appliedPricingUnit: 'living_sqft',
          });
          if (!guard.ok) {
            // Keep primary empty / previous; never write living SF into primary.
          }

          const measurementState: ScopeMeasurementState = {
            primaryTakeoff,
            pricing:
              livingQty > 0
                ? livingSfPricingRecord(livingQty, 'local_benchmark')
                : null,
            benchmark:
              livingQty > 0 ? livingSfBenchmarkRecord(livingQty) : null,
            status:
              primaryTakeoff?.quantity != null
                ? 'partially_measured'
                : missingStatusForScope(itemId),
          };

          itemQuantities[itemId] = {
            quantity:
              primaryTakeoff?.quantity != null
                ? String(primaryTakeoff.quantity)
                : '',
            unit: primaryTakeoff?.unit || preferredPrimaryUnit(itemId),
            quantitySource:
              primaryTakeoff?.quantity != null
                ? existingEntry?.quantitySource || 'user_entered'
                : 'missing',
            measurementState,
          };
        } else if (!rule.dualAllowanceField) {
          const primary = primaryQuantityForAppliedSuggestedBlock(block, rule);
          itemQuantities[itemId] = {
            quantity:
              itemId === 'electrical' &&
              block.basis?.unit === 'each' &&
              block.basis.quantity != null
                ? String(block.basis.quantity)
                : primary.quantity,
            unit: itemId === 'electrical' ? 'each' : primary.unit,
            quantitySource: 'user_entered',
          };
        } else {
          const primary = primaryQuantityForAppliedSuggestedBlock(block, rule);
          itemQuantities[itemId] = {
            quantity: primary.quantity,
            unit: primary.unit || rule.defaultUnit,
            quantitySource: 'user_entered',
          };
        }

        const pricingOverrideLog = [...(prev.pricingOverrideLog || [])];
        if (overrideConfirmed && isBenchmarkBlock) {
          pricingOverrideLog.push({
            itemId,
            reason: 'benchmark_apply_confirmed',
            confirmedAt: new Date().toISOString(),
            pricingUnit: block.basis?.unit || 'living_sqft',
            rateUnit: 'living_sqft',
            pricingQuantity: block.basis?.quantity ?? null,
            rate: block.benchmarkEvidence?.blendedBenchmark.rate ?? null,
            calculatedTotal: block.storedTotalExact ?? block.total,
          });
        }

        if (
          block.benchmarkApplicationKey &&
          !appliedBenchmarkKeys.includes(block.benchmarkApplicationKey)
        ) {
          appliedBenchmarkKeys.push(block.benchmarkApplicationKey);
        }

        return {
          ...merged,
          itemQuantities,
          pricingOverrideLog,
          appliedBenchmarkKeys,
          pricingAcceptance: {
            ...pricingAcceptance,
            [itemId]: acceptance,
          },
          scopeGapResolutions: syncScopeGapPricingStatuses(
            merged.scopeGapResolutions,
            {
              itemQuantities,
              pricingAcceptance: {
                ...pricingAcceptance,
                [itemId]: acceptance,
              },
            }
          ),
        };
      });
      // Apply has committed the accepted pricing into measurements. Drop the
      // pre-apply electrical preview in the same batch so the card does not
      // render once from the stale snapshot before showing the accepted state.
      if (isElectricalConfirmScope) {
        setElectricalPreviewMeasurements(null);
      }
      setTimeout(() => persistScopeProgressNow(), 0);
      });
    },
    [
      checklist?.templateKey,
      isElectricalConfirmScope,
      persistScopeProgressNow,
      setMeasurementsSynced,
    ]
  );

  const handleClearAcceptedPricing = useCallback(
    (itemId: string) => {
      hapticTap();
      const nextSelected = { ...selectedPricingRef.current };
      delete nextSelected[itemId];
      selectedPricingRef.current = nextSelected;
      setMeasurementsSynced(prev => {
        const cleared = clearAcceptedScopeItemPricing({
          itemId,
          itemQuantities: prev.itemQuantities || {},
          pricingAcceptance: prev.pricingAcceptance,
        });
        return {
          ...prev,
          itemQuantities: cleared.itemQuantities,
          pricingAcceptance: cleared.pricingAcceptance,
        };
      });
    },
    [setMeasurementsSynced]
  );

  const handleApplySuggestedPricing = useCallback(
    (itemId: string, block: SuggestedPricingBlock) => {
      const currentMeasurements = measurementsRef.current;
      const scheduleApply = (
        applyBlock: SuggestedPricingBlock,
        overrideConfirmed = false,
        replaceStageKey?: string | null,
        measurementPatch?: Partial<ScopeMeasurementsInputExtended>
      ) => {
        applySuggestedPricingNow(
          itemId,
          applyBlock,
          overrideConfirmed,
          replaceStageKey,
          measurementPatch
        );
      };
      // Stage lumps stay view-only; pure national comparison may be applied.
      if (block.benchmarkAction === 'included_in_stage') {
        return;
      }
      if (
        block.benchmarkAction === 'comparison_only' &&
        !isNationalAverageComparisonBlock(block)
      ) {
        return;
      }
      // Never replace an already-committed price via the national comparison row
      // or footer bulk-apply path — that was adding phantom dollars (e.g. $960).
      if (
        (isNationalAverageComparisonBlock(block) ||
          block.isComparison ||
          /national\s*average/i.test(String(block.rateSourceLabel || ''))) &&
        (scopeHasCommittedConfirmScopePrice({
          itemId,
          itemQuantities: currentMeasurements.itemQuantities,
          pricingAcceptance: currentMeasurements.pricingAcceptance,
        }) ||
          hasAcceptedScopePricing(
            itemId,
            currentMeasurements.itemQuantities,
            currentMeasurements.pricingAcceptance
          ))
      ) {
        return;
      }

      const stageKey =
        block.benchmarkStageKey || benchmarkStageForScopeKey(itemId);
      const applyingStageBenchmark =
        block.benchmarkLevel === 'stage' &&
        block.benchmarkAction === 'benchmark_only';
      if (
        applyingStageBenchmark &&
        stageHasAcceptedTradePricing(stageKey, currentMeasurements.pricingAcceptance)
      ) {
        Alert.alert(
          'Planning comparison only',
          `${stageTitle(stageKey)} already has separate trade pricing. Remove those trade prices before using the broad stage allowance.`
        );
        return;
      }

      const isTradePrice =
        block.benchmarkAction === 'price_ready' &&
        block.materialSource !== 'local_benchmark' &&
        block.laborSource !== 'local_benchmark';
      if (
        isTradePrice &&
        stageHasAcceptedBenchmarkPricing(
          stageKey,
          currentMeasurements.pricingAcceptance
        )
      ) {
        Alert.alert(
          'Replace stage allowance?',
          `The ${stageTitle(stageKey)} planning allowance is already applied. Replace it with this separate ${itemId.replace(/_/g, ' ')} material and labor price to avoid double counting?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace allowance',
              onPress: () => scheduleApply(block, false, stageKey),
            },
          ]
        );
        return;
      }

      const appKey = block.benchmarkApplicationKey;
      // Block only duplicate stage allowances — never block Foundation/Framing
      // price_ready trades that share a stage application key.
      if (
        measurementSemanticsV1Enabled() &&
        appKey &&
        block.benchmarkAction === 'benchmark_only' &&
        (currentMeasurements.appliedBenchmarkKeys || []).includes(appKey)
      ) {
        Alert.alert(
          'Already applied',
          'This stage planning benchmark is already applied on another scope. Child scopes stay available for takeoff and quotes.'
        );
        return;
      }

      const evidence = block.benchmarkEvidence;
      const unitMismatch = Boolean(
        evidence?.primaryTakeoff?.unit &&
        evidence.benchmarkBasis.unit !== evidence.primaryTakeoff.unit
      );
      const validation =
        measurementValidationRequiredForBenchmark() && evidence
          ? validatePricingBasis({
              itemId,
              primaryQuantity: evidence.primaryTakeoff?.quantity,
              primaryUnit: evidence.primaryTakeoff?.unit,
              pricingQuantity: evidence.blendedBenchmark.appliedQuantity,
              pricingUnit: evidence.blendedBenchmark.unit,
              rate: evidence.blendedBenchmark.rate,
              rateUnit: evidence.blendedBenchmark.unit,
              calculatedTotal: block.storedTotalExact ?? block.total,
              measurementStatus: missingStatusForScope(itemId),
              selectedSource: 'local_benchmark',
            })
          : null;

      const isTemporary =
        measurementSemanticsV1Enabled() &&
        (block.benchmarkAction === 'benchmark_only' ||
          (Boolean(evidence) &&
            !evidence?.quantityRoles?.primaryTakeoff?.quantity));

      const needsConfirmation =
        isTemporary ||
        (evidence &&
          (evidence.priceConfidence === 'low' ||
            evidence.quantityConfidence === 'low' ||
            unitMismatch)) ||
        Boolean(validation?.requiresExplicitOverride);

      const applyFlooringDemoWithDisclosure = (
        disclosure: 'no' | 'yes' | 'unsure'
      ) => {
        scheduleApply(block, false, null, {
          flooringDemoIncludesSubstratePrep: disclosure,
        });
      };

      if (
        itemId === 'floor_demo' &&
        isCustomFlooringDemoPriceBlock(block) &&
        !currentMeasurements.flooringDemoIncludesSubstratePrep
      ) {
        Alert.alert(
          'Does this demolition price include final substrate preparation?',
          'Final grinding, patching, skim coating, and leveling are separate from standard demolition unless your price already includes them.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'No — price floor prep separately',
              onPress: () => applyFlooringDemoWithDisclosure('no'),
            },
            {
              text: 'Yes — final substrate prep is included',
              onPress: () => applyFlooringDemoWithDisclosure('yes'),
            },
            {
              text: 'Not sure — review before bid',
              onPress: () => applyFlooringDemoWithDisclosure('unsure'),
            },
          ]
        );
        return;
      }

      if (itemId === 'floor_prep') {
        const overlap = evaluateFlooringDemoPrepOverlap(currentMeasurements);
        if (overlap.blockAutoApply) {
          Alert.alert('Possible duplicate scope', overlap.message, [
            { text: 'OK', style: 'cancel' },
          ]);
          return;
        }
      }

      if (!needsConfirmation) {
        scheduleApply(block);
        return;
      }

      const needsExplicitDialog =
        unitMismatch ||
        Boolean(validation?.requiresExplicitOverride) ||
        (evidence &&
          (evidence.priceConfidence === 'low' ||
            evidence.quantityConfidence === 'low'));

      // Card Apply is already an explicit action — skip a second dialog for
      // temporary planning allowances that only need an audit trail.
      if (isTemporary && !needsExplicitDialog) {
        scheduleApply(block, true);
        return;
      }

      const detail = isTemporary
        ? 'This is a temporary planning allowance. Detailed takeoff or a current quote is still required before final bidding.'
        : unitMismatch
          ? `The takeoff uses ${evidence?.primaryTakeoff?.unit}, while this planning benchmark uses living SF.`
          : validation?.warnings?.[0] ||
            'This benchmark is a planning estimate for the current project context.';
      const statusNote = measurementSemanticsV1Enabled()
        ? `\n\n${missingStatusDisplayLabel(itemId, checklist?.templateKey)}.`
        : '';
      Alert.alert(
        'Apply suggested amount?',
        `${detail}${statusNote}\n\nApply ${formatDraftMoney(block.storedTotalExact ?? block.total)} now?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Apply',
            onPress: () => scheduleApply(block, true),
          },
        ]
      );
    },
    [
      applySuggestedPricingNow,
      checklist?.templateKey,
      measurements.appliedBenchmarkKeys,
      measurements.flooringDemoIncludesSubstratePrep,
      measurements,
      measurements.itemQuantities,
      measurements.pricingAcceptance,
    ]
  );

  const performScrollToScopeItem = useCallback(
    (targetItemId: string): boolean => {
      const node = itemRefs.current[targetItemId];
      const content = scrollContentRef.current;
      if (!node || !content) return false;
      node.measureLayout(
        content,
        (_x, y) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, y - 12),
            animated: true,
          });
          if (pendingScrollToScopeItemRef.current === targetItemId) {
            pendingScrollToScopeItemRef.current = null;
          }
        },
        () => {
          /* layout not ready — deferred retry handles this */
        }
      );
      return true;
    },
    []
  );

  const scrollToScopeItem = useCallback(
    (targetItemId: string) => {
      const group = groupedItems.find(g =>
        g.items.some(row => row.id === targetItemId)
      );
      if (group?.title) {
        setCollapsedGroups(prev => ({ ...prev, [group.title]: false }));
      }
      pendingScrollToScopeItemRef.current = targetItemId;
    },
    [groupedItems]
  );

  useLayoutEffect(() => {
    const targetItemId = pendingScrollToScopeItemRef.current;
    if (!targetItemId) return;

    if (performScrollToScopeItem(targetItemId)) return;

    const retryId = requestAnimationFrame(() => {
      if (pendingScrollToScopeItemRef.current === targetItemId) {
        performScrollToScopeItem(targetItemId);
      }
    });
    return () => cancelAnimationFrame(retryId);
  }, [collapsedGroups, groupedItems, displayItems, performScrollToScopeItem]);

  const handleConfirmScopeItemsPress = useCallback(() => {
    const pending = scopeItemsNeedingConfirmation;
    if (!pending.length) return;
    hapticTap();
    if (pending.length === 1) {
      scrollToScopeItem(pending[0].itemId);
      return;
    }
    Alert.alert(
      'Confirm scope items',
      'These scopes still need pricing questions answered on the list below.',
      [
        ...pending.map(item => ({
          text: item.label,
          onPress: () => {
            scrollToScopeItem(item.itemId);
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [scopeItemsNeedingConfirmation, scrollToScopeItem]);

  const handleScrollToReadyPricing = useCallback(() => {
    const rows = suggestedPricingFooterBreakdown.readyRows;
    if (!rows.length) return;
    hapticTap();
    scrollToScopeItem(rows[0].itemId);
  }, [scrollToScopeItem, suggestedPricingFooterBreakdown.readyRows]);

  const scrollToFirstScopeAfterQmDone = useCallback(() => {
    const content = scrollContentRef.current;
    if (!content) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }

    const firstScopeItemId = qmDoneFirstScopeItemIdRef.current;
    const node = firstScopeItemId ? itemRefs.current[firstScopeItemId] : null;

    const applyScroll = (targetY: number) => {
      const y = Math.max(0, targetY);
      const delta = Math.abs(y - scrollOffsetYRef.current);
      scrollRef.current?.scrollTo({
        y,
        animated: delta > 0 && delta <= 200,
      });
    };

    if (node) {
      node.measureLayout(content, (_x, itemY) => {
        applyScroll(itemY - 12);
      });
      return;
    }

    const qm = quickMeasurementsRef.current;
    if (qm) {
      qm.measureLayout(content, (_x, _y, _w, qmH) => {
        applyScroll(Number(qmH) + 8);
      });
      return;
    }

    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  useLayoutEffect(() => {
    if (quickMeasurementsOpen || !pendingQmDoneScrollRef.current) return;
    pendingQmDoneScrollRef.current = false;
    scrollToFirstScopeAfterQmDone();
  }, [quickMeasurementsOpen, scrollToFirstScopeAfterQmDone]);

  /** After Quick Measurements Done: collapse panel and land on the first scope group. */
  const handleQuickMeasurementsDone = useCallback(() => {
    Keyboard.dismiss();
    const firstGroup = scopeGroupedItems[0];
    if (firstGroup?.title) {
      setCollapsedGroups(prev => ({ ...prev, [firstGroup.title]: false }));
    }

    const firstScopeItemId =
      scopeGroupedItems
        .flatMap(g => g.items)
        .find(
          item =>
            !(
              embedQmScopeInQuickMeasurements &&
              qmScopeEmbeddedInQuickMeasurements(item.id)
            )
        )?.id ?? null;

    qmDoneFirstScopeItemIdRef.current = firstScopeItemId;
    pendingQmDoneScrollRef.current = true;

    const content = scrollContentRef.current;
    const qm = quickMeasurementsRef.current;
    const collapseQm = () => {
      commitElectricalAttributes();
      flushStagedElectricalMeasurements();
      setQuickMeasurementsOpen(false);
    };

    // Snap to the QM card top before collapse so a tall expanded card cannot leave a
    // stale deep scroll offset that jumps to the page bottom when content shrinks.
    if (content && qm) {
      qm.measureLayout(content, (_x, qmY) => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, qmY - 8),
          animated: false,
        });
        collapseQm();
      });
      return;
    }

    collapseQm();
  }, [
    scopeGroupedItems,
    embedQmScopeInQuickMeasurements,
    commitElectricalAttributes,
    flushStagedElectricalMeasurements,
    qmScopeEmbeddedInQuickMeasurements,
  ]);

  const preserveFlooringQmScrollPosition = useCallback(() => {
    const y = Math.max(0, scrollOffsetYRef.current);
    setTimeout(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y, animated: false });
      });
    }, 120);
  }, []);

  const handleScopeGapResolutionsChange = useCallback(
    (next: ScopeGapResolutionsMap) => {
      setMeasurementsSynced(prev => {
        const pricingContext: ScopeGapPricingContext = {
          itemQuantities: prev.itemQuantities,
          pricingAcceptance: prev.pricingAcceptance,
        };
        return {
          ...prev,
          scopeGapResolutions: syncScopeGapPricingStatuses(
            next,
            pricingContext
          ),
        };
      });
      setTimeout(() => persistScopeProgressNow(), 0);
    },
    [persistScopeProgressNow, setMeasurementsSynced]
  );

  const handleScopeGapPriceSeparately = useCallback(
    (
      parentScopeItemId: string,
      component: AssemblyComponentStatus,
      benchmarkAssumption?: BenchmarkScopeAssumption | null,
      benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
    ) => {
      hapticTap();
      const { items: nextItems, lineItemId } =
        ensureSeparateScopeItemInChecklist(
          itemsRef.current,
          component,
          parentScopeItemId
        );
      setItems(nextItems);
      setMeasurementsSynced(prev => {
        const pricingContext: ScopeGapPricingContext = {
          itemQuantities: prev.itemQuantities,
          pricingAcceptance: prev.pricingAcceptance,
        };
        return {
          ...prev,
          scopeGapResolutions: setScopeGapResolution(
            prev.scopeGapResolutions,
            parentScopeItemId,
            component.key,
            'price_separately',
            {
              linkedLineItemId: lineItemId,
              parentScopeItemId,
              pricingContext,
              benchmarkAssumption,
              benchmarkProfile,
            }
          ),
        };
      });
      setPricingEditorRequest({ itemId: lineItemId, token: Date.now() });
      setTimeout(() => {
        scrollToScopeItem(lineItemId);
        persistScopeProgressNow();
      }, 150);
    },
    [persistScopeProgressNow, scrollToScopeItem, setMeasurementsSynced]
  );

  const handleScopeGapIncludeInParentPrice = useCallback(
    (
      parentScopeItemId: string,
      component: AssemblyComponentStatus,
      addonAmount: number,
      benchmarkAssumption?: BenchmarkScopeAssumption | null,
      benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
    ) => {
      hapticTap();
      if (!Number.isFinite(addonAmount) || addonAmount <= 0) return;
      setMeasurementsSynced(prev => {
        const previousRecord = getScopeGapRecord(
          prev.scopeGapResolutions,
          parentScopeItemId,
          component.key
        );
        const previousAddon = previousRecord?.parentPriceAddon ?? 0;
        const previousBucket = previousRecord?.parentPriceAddonBucket;
        const bucket = scopeGapAddonCostBucketForComponent(component.key);
        const delta = addonAmount - previousAddon;
        const existingBlock = selectedPricingRef.current[parentScopeItemId];
        if (existingBlock && delta !== 0) {
          selectedPricingRef.current = {
            ...selectedPricingRef.current,
            [parentScopeItemId]: adjustSuggestedPricingBlock(
              existingBlock,
              delta,
              bucket
            ),
          };
        }
        const { itemQuantities, pricingAcceptance } =
          applyParentScopeGapPriceAddon({
            parentScopeItemId,
            componentKey: component.key,
            addonAmount,
            previousAddonAmount: previousAddon,
            previousAddonBucket: previousBucket,
            itemQuantities: prev.itemQuantities,
            pricingAcceptance: prev.pricingAcceptance,
          });
        const pricingContext: ScopeGapPricingContext = {
          itemQuantities,
          pricingAcceptance,
        };
        return {
          ...prev,
          itemQuantities,
          pricingAcceptance,
          scopeGapResolutions: setScopeGapResolution(
            prev.scopeGapResolutions,
            parentScopeItemId,
            component.key,
            'included',
            {
              parentScopeItemId,
              parentPriceAddon: addonAmount,
              pricingContext,
              benchmarkAssumption,
              benchmarkProfile,
            }
          ),
        };
      });
      setTimeout(() => persistScopeProgressNow(), 0);
    },
    [persistScopeProgressNow, setMeasurementsSynced]
  );

  const handleDeleteCustomItem = (itemId: string) => {
    const remove = () => {
      hapticTap();
      setItems(prev => prev.filter(item => item.id !== itemId));
      setMeasurementsSynced(prev => {
        const itemQuantities = { ...prev.itemQuantities };
        delete itemQuantities[itemId];
        delete itemQuantities[`${itemId}__material`];
        delete itemQuantities[`${itemId}__labor`];
        delete itemQuantities[`${itemId}__allowance`];
        return { ...prev, itemQuantities };
      });
    };
    Alert.alert(
      'Delete custom item?',
      'This removes the custom scope card and its price.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: remove },
      ]
    );
  };

  const handleWetAreaInstallSelect = useCallback(
    (choiceId: string) => {
      setItems(prev => {
        const next = prev.map(row =>
          row.id === 'wet_area_install'
            ? { ...row, choiceId, state: choiceIdToState(choiceId) }
            : row
        );
        return next.map(row => {
          if (row.state !== 'unsure') return row;
          if (choiceId === 'tile_pan') {
            if (
              ['shower_floor_tile', 'waterproofing', 'shower_tile'].includes(
                row.id
              )
            ) {
              return { ...row, state: 'included' as const };
            }
          }
          if (choiceId === 'prefab') {
            if (['waterproofing', 'shower_tile'].includes(row.id)) {
              return { ...row, state: 'included' as const };
            }
          }
          return row;
        });
      });
      const finish = wetAreaFinishFromChecklistChoice(choiceId);
      if (finish) {
        setMeasurementsSynced(m => ({ ...m, wetAreaFinish: finish }));
      }
    },
    [setMeasurementsSynced]
  );

  const measurementsForScopeRender =
    isElectricalConfirmScope && electricalPreviewMeasurements
      ? electricalPreviewMeasurements
      : measurements;

  const renderItem = (
    item: ScopeChecklistItem,
    options?: { forcePinnedTexture?: boolean }
  ) => {
    if (
      item.id === 'texture' &&
      pinnedDrywallFinishItem &&
      !options?.forcePinnedTexture
    ) {
      return null;
    }
    if (hideDeselectedRoofingQmCard(item.id)) {
      return null;
    }
    if (hideDuplicateRoofingBaseCard(item.id)) {
      return null;
    }
    if (
      embedQmScopeInQuickMeasurements &&
      qmScopeEmbeddedInQuickMeasurements(item.id)
    ) {
      return null;
    }
    const customScopeCard = isCustomScopeItem(item);
    if (
      !customScopeCard &&
      String(checklist?.templateKey || '').toLowerCase() === 'landscaping'
    ) {
      const landscapingItemActive =
        isLandscapingQmScopeItemActive(
          item.id,
          measurements as Record<string, unknown>
        ) ||
        (item.state === 'included' && item.noteBacked === true);
      if (!landscapingItemActive) {
        return null;
      }
    }
    if (
      !customScopeCard &&
      String(checklist?.templateKey || '').toLowerCase() === 'concrete'
    ) {
      const concreteItemActive =
        isConcreteQmScopeItemActive(
          item.id,
          measurements as Record<string, unknown>
        ) ||
        (item.state === 'included' && item.noteBacked === true);
      if (!concreteItemActive) {
        return null;
      }
    }
    if (String(checklist?.templateKey || '').toLowerCase() === 'flooring') {
      const flooringProductScopeByItemId: Record<string, string> = {
        flooring_lvp: 'lvp',
        flooring_laminate: 'laminate',
        flooring_engineered_hardwood: 'engineered_hardwood',
        flooring_solid_hardwood: 'solid_hardwood',
        tile_flooring: 'tile',
        flooring_carpet: 'carpet',
        flooring_sheet_vinyl: 'sheet_vinyl_vct',
      };
      const flooringMeasurementByItemId: Record<string, number> = {
        flooring_lvp: Number(measurements.flooringLvpSqft || 0),
        flooring_laminate: Number(measurements.flooringLaminateSqft || 0),
        flooring_engineered_hardwood: Number(
          measurements.flooringEngineeredHardwoodSqft || 0
        ),
        flooring_solid_hardwood: Number(
          measurements.flooringSolidHardwoodSqft || 0
        ),
        tile_flooring: Number(measurements.flooringTileSqft || 0),
        flooring_carpet: Number(measurements.flooringCarpetSqft || 0),
        flooring_sheet_vinyl: Number(measurements.flooringSheetVinylSqft || 0),
      };
      const explicitProductSelection = Array.isArray(
        measurements.flooringProductScope
      );
      const selectedProductScope = new Set(
        readFlooringProductScope(measurements as Record<string, unknown>)
      );
      const hasSpecificFlooringProduct = selectedProductScope.size > 0;
      if (item.id === 'flooring' && hasSpecificFlooringProduct) {
        return null;
      }
      const productScope = flooringProductScopeByItemId[item.id];
      if (productScope) {
        if (
          explicitProductSelection &&
          !selectedProductScope.has(productScope)
        ) {
          return null;
        }
        if (
          !explicitProductSelection &&
          hasSpecificFlooringProduct &&
          !selectedProductScope.has(productScope)
        ) {
          return null;
        }
      }
    }
    if (
      String(checklist?.templateKey || '').toLowerCase() === 'painting' &&
      item.id === 'ceiling_paint' &&
      item.state === 'excluded' &&
      measurements.paintPricingMethod === 'combined' &&
      measurements.paintScope?.includes('walls') &&
      measurements.paintScope?.includes('ceilings')
    ) {
      return null;
    }
    const useWetAreaLineCard =
      item.id !== 'shower_pan' &&
      (item.derivedFrom === 'wet_area_install' ||
        WET_AREA_DERIVED_ITEM_IDS.has(item.id));
    const useFlooringLineCard = shouldUseFlooringConfirmScopeLineCard(
      checklist?.templateKey,
      item
    );
    const useLandscapingLineCard = shouldUseLandscapingConfirmScopeLineCard(
      checklist?.templateKey,
      item
    );
    const useConcreteLineCard = shouldUseConcreteConfirmScopeLineCard(
      checklist?.templateKey,
      item
    );
    const row =
      useWetAreaLineCard ||
      useFlooringLineCard ||
      useLandscapingLineCard ||
      useConcreteLineCard ? (
        <WetAreaInstallLineCard
          item={item}
          templateKey={checklist?.templateKey}
          originalNotes={scopeNotes}
          measurementsInput={measurementsForScopeRender}
          onItemQuantityChange={handleItemQuantityChange}
          onBatchItemQuantityChange={handleBatchItemQuantityChange}
          onClearSuggestedPrefill={handleClearSuggestedPrefill}
          onItemQuantityBlur={handleItemQuantityBlur}
          onItemQuantityFocus={handleItemQuantityFocus}
          onApplySuggestedPricing={handleApplySuggestedPricing}
          onClearAcceptedPricing={handleClearAcceptedPricing}
          onScopeGapResolutionsChange={handleScopeGapResolutionsChange}
          onScopeGapPriceSeparately={handleScopeGapPriceSeparately}
          onScopeGapIncludeInParentPrice={handleScopeGapIncludeInParentPrice}
          onRevertCalculatedQuantity={handleRevertCalculatedQuantity}
          pricingEditorRequest={pricingEditorRequest}
          onPricingEditorRequestHandled={clearPricingEditorRequest}
          visualCtx={visualCtx}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      ) : (item.inputType === 'multi_choice' || item.id === 'lighting') &&
        (item.options?.length ?? 0) > 0 ? (
        <MultiChoiceRow
          item={item}
          templateKey={checklist?.templateKey}
          originalNotes={scopeNotes}
          onToggle={optionId => {
            setItems(prev =>
              prev.map(row => {
                if (row.id !== item.id) return row;
                const currentChoiceIds =
                  row.choiceIds ?? (row.choiceId ? [row.choiceId] : []);
                const choiceIds =
                  optionId === 'unsure' || optionId === 'not_in_scope'
                    ? currentChoiceIds.length === 1 &&
                      currentChoiceIds[0] === optionId
                      ? []
                      : [optionId]
                    : [
                        ...currentChoiceIds.filter(
                          id =>
                            id !== 'unsure' &&
                            id !== 'not_in_scope' &&
                            id !== optionId
                        ),
                        ...(currentChoiceIds.includes(optionId)
                          ? []
                          : [optionId]),
                      ];
                return {
                  ...row,
                  choiceIds,
                  choiceId: choiceIds[0] ?? null,
                  state: choiceIdsToScopeState(choiceIds),
                };
              })
            );
            // A choice change invalidates the previous rate selection and count.
            if (
              item.id === 'electrical' ||
              item.id === 'plumbing' ||
              item.id === 'lighting' ||
              item.id === 'transitions'
            ) {
              setMeasurementsSynced(previous => {
                const cleared = clearAcceptedScopeItemPricing({
                  itemId: item.id,
                  itemQuantities: previous.itemQuantities || {},
                  pricingAcceptance: previous.pricingAcceptance,
                });
                const itemQuantities = { ...cleared.itemQuantities };
                if (optionId !== 'unsure' && optionId !== 'not_in_scope') {
                  const existingCount = Number(
                    previous.itemQuantities?.[item.id]?.quantity
                  );
                  itemQuantities[item.id] = {
                    quantity:
                      Number.isFinite(existingCount) && existingCount > 0
                        ? String(existingCount)
                        : '1',
                    unit: 'each',
                    quantitySource: 'user_entered',
                  };
                  if (
                    [
                      'plumbing',
                      'electrical',
                      'lighting',
                      'transitions',
                    ].includes(item.id)
                  ) {
                    const existingOptionCount = Number(
                      previous.itemQuantities?.[`${item.id}__${optionId}`]
                        ?.quantity
                    );
                    itemQuantities[`${item.id}__${optionId}`] = {
                      quantity:
                        Number.isFinite(existingOptionCount) &&
                        existingOptionCount > 0
                          ? String(existingOptionCount)
                          : '1',
                      unit: 'each',
                      quantitySource: 'user_entered',
                    };
                  }
                }
                return {
                  ...previous,
                  itemQuantities,
                  pricingAcceptance: cleared.pricingAcceptance,
                };
              });
            }
          }}
          measurementsInput={measurementsForScopeRender}
          onItemQuantityChange={handleItemQuantityChange}
          onBatchItemQuantityChange={handleBatchItemQuantityChange}
          onClearSuggestedPrefill={handleClearSuggestedPrefill}
          onItemQuantityBlur={handleItemQuantityBlur}
          onItemQuantityFocus={handleItemQuantityFocus}
          onApplySuggestedPricing={handleApplySuggestedPricing}
          onClearAcceptedPricing={handleClearAcceptedPricing}
          onScopeGapResolutionsChange={handleScopeGapResolutionsChange}
          onScopeGapPriceSeparately={handleScopeGapPriceSeparately}
          onScopeGapIncludeInParentPrice={handleScopeGapIncludeInParentPrice}
          onRevertCalculatedQuantity={handleRevertCalculatedQuantity}
          pricingEditorRequest={pricingEditorRequest}
          onPricingEditorRequestHandled={clearPricingEditorRequest}
          visualCtx={visualCtx}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      ) : item.inputType === 'choice' && (item.options?.length ?? 0) > 0 ? (
        <ChoiceRow
          item={item}
          templateKey={checklist?.templateKey}
          originalNotes={scopeNotes}
          onSelect={choiceId => {
            const isBathroomCountertop =
              item.id === 'countertops' &&
              String(templateKey || '').toLowerCase() === 'bathroom';
            const nextChoiceId = item.choiceId === choiceId ? null : choiceId;
            setItems(prev => {
              const next = prev.map(row =>
                row.id === item.id
                  ? {
                      ...row,
                      choiceId: nextChoiceId,
                      state: nextChoiceId
                        ? choiceIdToState(nextChoiceId)
                        : ('unsure' as const),
                    }
                  : row
              );
              if (item.id !== 'wet_area_install') return next;
              return next.map(row => {
                if (row.state !== 'unsure') return row;
                if (choiceId === 'tile_pan') {
                  if (
                    [
                      'shower_floor_tile',
                      'waterproofing',
                      'shower_tile',
                    ].includes(row.id)
                  ) {
                    return { ...row, state: 'included' as const };
                  }
                }
                if (choiceId === 'prefab') {
                  if (['waterproofing', 'shower_tile'].includes(row.id)) {
                    return { ...row, state: 'included' as const };
                  }
                }
                return row;
              });
            });
            if (item.id === 'wet_area_install') {
              const finish = wetAreaFinishFromChecklistChoice(choiceId);
              if (finish) {
                setMeasurementsSynced(m => ({ ...m, wetAreaFinish: finish }));
              }
            }
            if (isBathroomCountertop) {
              setMeasurementsSynced(m => ({
                ...m,
                bathroomVanityCountertopMaterialType: nextChoiceId,
              }));
            }
            if (item.id === 'texture' && nextChoiceId) {
              handleDrywallFinishLevelChange(nextChoiceId);
            } else if (item.id === 'texture' && !nextChoiceId) {
              handleClearAcceptedPricing('drywall');
            }
            if (!nextChoiceId) {
              handleClearAcceptedPricing(item.id);
            }
            if (item.id === 'toilet' && nextChoiceId !== 'relocating') {
              setMeasurementsSynced(m => ({
                ...m,
                bathroomToiletRelocateFloorType: null,
                bathroomToiletRelocateFloorTypeSource: null,
              }));
            }
            // Choice-specific pricing must be recalculated when the selected
            // service changes; do not carry reuse/install or prior fixture rates
            // into the new choice.
            if (item.id === 'lighting' || item.id === 'electrical') {
              // A new price type needs a fresh count entry instead of silently
              // carrying the prior type's count into the new price.
              setMeasurementsSynced(previous => {
                const cleared = clearAcceptedScopeItemPricing({
                  itemId: item.id,
                  itemQuantities: previous.itemQuantities || {},
                  pricingAcceptance: previous.pricingAcceptance,
                });
                const itemQuantities = { ...cleared.itemQuantities };
                delete itemQuantities[item.id];
                return {
                  ...previous,
                  itemQuantities,
                  pricingAcceptance: cleared.pricingAcceptance,
                };
              });
            } else if (['garbage_disposal', 'plumbing'].includes(item.id)) {
              handleClearAcceptedPricing(item.id);
            }
          }}
          onBathroomToiletRelocateFloorTypeChange={
            handleBathroomToiletRelocateFloorTypeChange
          }
          onTrimFinishChoiceChange={nextChoiceId => {
            setItems(prev =>
              prev.map(row =>
                row.id === item.id
                  ? {
                      ...row,
                      choiceId: nextChoiceId,
                      state: nextChoiceId
                        ? choiceIdToState(nextChoiceId)
                        : ('unsure' as const),
                    }
                  : row
              )
            );
            if (!nextChoiceId) {
              handleClearAcceptedPricing('trim_finish');
              setMeasurementsSynced(m => ({
                ...m,
                trimFinishFieldPaintIncluded: null,
              }));
              return;
            }
            handleClearAcceptedPricing('trim_finish');
            if (
              nextChoiceId === 'not_in_scope' ||
              nextChoiceId === 'unsure' ||
              nextChoiceId?.endsWith('_unfinished')
            ) {
              setMeasurementsSynced(m => ({
                ...m,
                trimFinishFieldPaintIncluded: null,
              }));
            }
          }}
          onTrimFinishFieldPaintIncludedChange={
            handleTrimFinishFieldPaintIncludedChange
          }
          onBathroomShowerRoughFixtureTypeChange={
            handleBathroomShowerRoughFixtureTypeChange
          }
          onBathroomShowerRoughWorkTypeChange={
            handleBathroomShowerRoughWorkTypeChange
          }
          onBathroomShowerRoughPlumbingExposedChange={
            handleBathroomShowerRoughPlumbingExposedChange
          }
          onBathroomShowerRoughFloorConstructionChange={
            handleBathroomShowerRoughFloorConstructionChange
          }
          onBathroomShowerRoughSlabWorkRequiredChange={
            handleBathroomShowerRoughSlabWorkRequiredChange
          }
          onBathroomPaintRepairScopeChange={
            handleBathroomPaintRepairScopeChange
          }
          onBathroomDrywallPaintCombinedAssemblyChange={
            handleBathroomDrywallPaintCombinedAssemblyChange
          }
          onBathroomInteriorPaintMobilizationChange={
            handleBathroomInteriorPaintMobilizationChange
          }
          onBathroomInteriorPaintSurfaceChange={
            handleBathroomInteriorPaintSurfaceChange
          }
          onBathroomInteriorPaintConditionChange={
            handleBathroomInteriorPaintConditionChange
          }
          onBathroomGlassDoorStyleChange={handleBathroomGlassDoorStyleChange}
          scopeChecklistItems={displayItems}
          measurementsInput={measurementsForScopeRender}
          onItemQuantityChange={handleItemQuantityChange}
          onBatchItemQuantityChange={handleBatchItemQuantityChange}
          onClearSuggestedPrefill={handleClearSuggestedPrefill}
          onItemQuantityBlur={handleItemQuantityBlur}
          onItemQuantityFocus={handleItemQuantityFocus}
          onApplySuggestedPricing={handleApplySuggestedPricing}
          onClearAcceptedPricing={handleClearAcceptedPricing}
          onScopeGapResolutionsChange={handleScopeGapResolutionsChange}
          onScopeGapPriceSeparately={handleScopeGapPriceSeparately}
          onScopeGapIncludeInParentPrice={handleScopeGapIncludeInParentPrice}
          onRevertCalculatedQuantity={handleRevertCalculatedQuantity}
          pricingEditorRequest={pricingEditorRequest}
          onPricingEditorRequestHandled={clearPricingEditorRequest}
          visualCtx={visualCtx}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      ) : (
        <MemoizedYesNoRow
          item={item}
          templateKey={scopeCardTemplateKey(item.id)}
          originalNotes={scopeNotes}
          onSetState={state => {
            setItems(prev => {
              let next = prev.map(row =>
                row.id === item.id ? { ...row, state } : row
              );
              next = applyKitchenScopeInferences(next, checklist?.templateKey, {
                notes: scopeNotes,
                measurements: normMeasurements,
              });
              if (
                item.id === 'shower_tile' ||
                item.id === 'shower_floor_tile'
              ) {
                next = syncWaterproofingFromTileScopeItems(next);
              }
              return next;
            });
            if (item.id === 'plumbing_rough' && state !== 'included') {
              setMeasurementsSynced(m => ({
                ...m,
                bathroomShowerRoughFixtureType: null,
                bathroomShowerRoughFixtureTypeSource: null,
                bathroomShowerRoughWorkType: null,
                bathroomShowerRoughWorkTypeSource: null,
                bathroomShowerRoughPlumbingExposed: null,
                bathroomShowerRoughPlumbingExposedSource: null,
                bathroomShowerRoughWallAccess: null,
                bathroomShowerRoughWallAccessSource: null,
                bathroomShowerRoughFloorConstruction: null,
                bathroomShowerRoughFloorConstructionSource: null,
                bathroomShowerRoughSlabWorkRequired: null,
                bathroomShowerRoughSlabWorkRequiredSource: null,
                bathroomShowerRoughAccessType: null,
                bathroomShowerRoughAccessTypeSource: null,
              }));
            }
          }}
          onRename={
            isCustomScopeItem(item)
              ? label =>
                  setItems(prev =>
                    prev.map(row =>
                      row.id === item.id ? { ...row, label } : row
                    )
                  )
              : undefined
          }
          onDelete={
            isCustomScopeItem(item)
              ? () => handleDeleteCustomItem(item.id)
              : undefined
          }
          onSaveCustomPricing={
            isCustomScopeItem(item)
              ? () => handleSaveCustomScopePricing(item.id)
              : undefined
          }
          onBathroomToiletRelocateFloorTypeChange={
            handleBathroomToiletRelocateFloorTypeChange
          }
          onBathroomShowerRoughFixtureTypeChange={
            handleBathroomShowerRoughFixtureTypeChange
          }
          onBathroomShowerRoughWorkTypeChange={
            handleBathroomShowerRoughWorkTypeChange
          }
          onBathroomShowerRoughPlumbingExposedChange={
            handleBathroomShowerRoughPlumbingExposedChange
          }
          onBathroomShowerRoughFloorConstructionChange={
            handleBathroomShowerRoughFloorConstructionChange
          }
          onBathroomShowerRoughSlabWorkRequiredChange={
            handleBathroomShowerRoughSlabWorkRequiredChange
          }
          onBathroomPaintRepairScopeChange={
            handleBathroomPaintRepairScopeChange
          }
          onBathroomDrywallPaintCombinedAssemblyChange={
            handleBathroomDrywallPaintCombinedAssemblyChange
          }
          onBathroomInteriorPaintMobilizationChange={
            handleBathroomInteriorPaintMobilizationChange
          }
          onBathroomInteriorPaintSurfaceChange={
            handleBathroomInteriorPaintSurfaceChange
          }
          onBathroomInteriorPaintConditionChange={
            handleBathroomInteriorPaintConditionChange
          }
          onBathroomGlassDoorStyleChange={handleBathroomGlassDoorStyleChange}
          scopeChecklistItems={displayItems}
          measurementsInput={measurementsForScopeRender}
          onItemQuantityChange={handleItemQuantityChange}
          onBatchItemQuantityChange={handleBatchItemQuantityChange}
          onClearSuggestedPrefill={handleClearSuggestedPrefill}
          onItemQuantityBlur={handleItemQuantityBlur}
          onItemQuantityFocus={handleItemQuantityFocus}
          onApplySuggestedPricing={handleApplySuggestedPricing}
          onApplySuggestedPricingRows={applySuggestedPricingBlocks}
          onClearAcceptedPricing={handleClearAcceptedPricing}
          onScopeGapResolutionsChange={handleScopeGapResolutionsChange}
          onScopeGapPriceSeparately={handleScopeGapPriceSeparately}
          onScopeGapIncludeInParentPrice={handleScopeGapIncludeInParentPrice}
          onRevertCalculatedQuantity={handleRevertCalculatedQuantity}
          pricingEditorRequest={pricingEditorRequest}
          onPricingEditorRequestHandled={clearPricingEditorRequest}
          visualCtx={visualCtx}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      );

    return (
      <View
        ref={node => {
          itemRefs.current[item.id] = node;
        }}
        collapsable={false}
      >
        {row}
      </View>
    );
  };

  const handleConfirm = () => {
    if (applying || items.length === 0) return;

    // Do not auto-apply remaining suggestions — Applied pricing is what Continue
    // carries to Step 3. Unpriced scopes stay available to price on review.
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onConfirmBegin?.();
    deferConfirmScopeHeavyWork(() => {
      commitElectricalAttributes();
      const payload = scopeMeasurementsPayloadForCurrentState();
      if (__DEV__) {
        const q = payload.itemQuantities || {};
        console.log('[scope-pricing] confirm payload', {
          flooring: q.flooring,
          material: q.flooring__material,
          labor: q.flooring__labor,
          allowance: q.flooring__allowance,
          appliedTotal: step2AppliedEstimateTotal,
        });
      }
      // Persist display-only cards (flatwork / openings) that were Yes'd in UI.
      const baseItems = scopeItemsForCurrentMeasurements(
        displayItems.length ? displayItems : items
      );
      const tradeFilteredItems =
        singleTradePlanImport && singleTradeKey
          ? filterChecklistItemsForTrade(
              baseItems,
              'selected_trade',
              singleTradeKey
            )
          : notesPlumbingFlow
            ? baseItems.filter(
                item =>
                  plumbingItemIds.has(item.id) ||
                  isCustomScopeChecklistItem(item)
              )
            : baseItems;
      const confirmItems = finalizeWetAreaInstallScopeFromMeasurements(
        scopeChecklistItemsForPersist(tradeFilteredItems),
        payload
      );
      onConfirm(confirmItems, payload);
    });
  };

  const handleSaveCustomScopePricing = useCallback(
    (itemId: string) => {
      setMeasurementsSynced(prev => {
        const basisQty = parsePricingAmount(
          prev.itemQuantities?.[itemId]?.quantity
        );
        const scaled = resolveCustomScopeDraftPricing({
          materialValue: prev.itemQuantities?.[`${itemId}__material`]?.quantity,
          laborValue: prev.itemQuantities?.[`${itemId}__labor`]?.quantity,
          basisQuantity: basisQty > 0 ? basisQty : null,
        });
        const { material, labor, total: lumpTotal } = scaled;
        if (!(lumpTotal > 0)) return prev;

        const itemQuantities = { ...(prev.itemQuantities || {}) };
        const persistScaled = (key: string, amount: number) => {
          const entry = itemQuantities[key];
          if (!entry) return;
          itemQuantities[key] = {
            ...entry,
            quantity: String(Math.round(amount * 100) / 100),
            quantitySource: 'user_entered',
          };
        };
        persistScaled(`${itemId}__material`, material);
        persistScaled(`${itemId}__labor`, labor);
        persistScaled(`${itemId}__allowance`, lumpTotal);
        const itemEntry = itemQuantities[itemId];
        if (itemEntry) {
          itemQuantities[itemId] = {
            ...itemEntry,
            quantitySource: 'user_entered',
          };
        }

        return {
          ...prev,
          itemQuantities,
          pricingAcceptance: {
            ...(prev.pricingAcceptance || {}),
            [itemId]: buildAcceptanceFromCustomScopePricing({
              material,
              labor,
              total: lumpTotal,
              lumpSumOnly: false,
            }),
          },
        };
      });
      setTimeout(() => persistScopeProgressNow(), 0);
    },
    [persistScopeProgressNow, setMeasurementsSynced]
  );

  const handleAddCustomItem = () => {
    const trimmed = customItemLabel.trim();
    if (!trimmed) return;
    hapticTap();
    const newItem = createCustomScopeItem(trimmed);
    pendingCustomItemScrollRef.current = newItem.id;
    setItems(prev => [...prev, newItem]);
    setCustomItemLabel('');
    setShowCustomItemInput(false);
    setTimeout(() => persistScopeProgressNow(), 0);
  };

  useEffect(() => {
    const itemId = pendingCustomItemScrollRef.current;
    if (!itemId) return;
    const node = itemRefs.current[itemId] ?? customScopeSectionRef.current;
    const content = scrollContentRef.current;
    if (!node || !content) return;
    pendingCustomItemScrollRef.current = null;
    requestAnimationFrame(() => {
      node.measureLayout(content, (_x, y) => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, y - 12),
          animated: true,
        });
      });
    });
  }, [customScopeItems]);

  const handleBack = () => {
    commitElectricalAttributes();
    persistScopeProgressNow();
    onBack();
  };

  if (!visible || !draft || !checklist) return null;

  const scopeGroupsToRender =
    isElectricalConfirmScope && quickMeasurementsOpen
      ? electricalPreviewScopeGroups
      : scopeGroupedItems;
  const electricalPreviewPricingCount = electricalPreviewScopeGroups.reduce(
    (total, group) => total + group.items.length,
    0
  );
  const electricalPreviewPendingPricingCount =
    electricalPreviewScopeGroups.reduce((total, group) => {
      return (
        total +
        group.items.filter(item => {
          const applied =
            scopeHasCommittedConfirmScopePrice({
              itemId: item.id,
              itemQuantities: (electricalPreviewMeasurements || measurements)
                .itemQuantities,
              pricingAcceptance: (electricalPreviewMeasurements || measurements)
                .pricingAcceptance,
            }) ||
            hasAcceptedScopePricing(
              item.id,
              (electricalPreviewMeasurements || measurements).itemQuantities,
              (electricalPreviewMeasurements || measurements).pricingAcceptance
            );
          return !applied;
        }).length
      );
    }, 0);

  const body = (
    <View style={[styles.shell, { backgroundColor: Colors.bg }]}>
      <AIEstimateFlowHeader
        title='Confirm scope'
        subtitle='What work is in this bid?'
        step={2}
        stepTotal={3}
        fromAssistant={fromAssistant}
        disabled={applying}
        onBack={handleBack}
      />

      <GestureScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 168,
        }}
        keyboardShouldPersistTaps='always'
        delayContentTouches={false}
        keyboardDismissMode='on-drag'
        automaticallyAdjustKeyboardInsets={false}
        showsVerticalScrollIndicator
        scrollEventThrottle={16}
        onScroll={e => {
          scrollOffsetYRef.current = e.nativeEvent.contentOffset.y;
        }}
      >
        <View ref={scrollContentRef} collapsable={false}>
          <AIEstimateDisclaimer variant='compact' />
          <Text
            style={{
              color: captionColor(darkMode, Colors),
              fontSize: 12,
              marginTop: 4,
              marginBottom: 12,
              lineHeight: 17,
            }}
          >
            {summary.included} in scope
            {summary.needsMeasurement > 0 ? (
              <>
                {' · '}
                <Text
                  onPress={scrollToFirstMissingMeasurement}
                  style={{ color: '#fbbf24', fontWeight: '700' }}
                >
                  {summary.needsMeasurement} need measurements
                </Text>
              </>
            ) : null}
            {summary.unsure > 0 ? (
              <>
                {' · '}
                {summary.unsure} unsure
              </>
            ) : null}
          </Text>

          {false && singleTradePlanImport && singleTradeKey === 'insulation' ? (
            <View
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: darkMode
                  ? 'rgba(255,255,255,0.14)'
                  : Colors.line,
                backgroundColor: darkMode ? '#171719' : Colors.surface,
              }}
            >
              <Text
                style={{
                  color: Colors.text,
                  fontSize: 14,
                  fontWeight: '800',
                  marginBottom: 4,
                }}
              >
                Insulation assembly
              </Text>
              <Text
                style={{
                  color: captionColor(darkMode, Colors),
                  fontSize: 11,
                  lineHeight: 16,
                  marginBottom: 10,
                }}
              >
                Select the installation type and target R-value for this bid.
              </Text>
              {[
                {
                  key: 'insulationMaterialType' as const,
                  label: 'Installation type',
                  options: INSULATION_TYPE_OPTIONS,
                },
                {
                  key: 'insulationRValue' as const,
                  label: 'Target R-value',
                  options: INSULATION_R_VALUE_OPTIONS,
                },
              ].map(group => (
                <View key={group.key} style={{ marginTop: 8 }}>
                  <Text
                    style={{
                      color: Colors.text,
                      fontSize: 12,
                      fontWeight: '700',
                      marginBottom: 6,
                    }}
                  >
                    {group.label}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {group.options.map(option => {
                      const selected =
                        String(measurements[group.key] || '').toLowerCase() ===
                        option.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={option}
                          onPress={() =>
                            setMeasurementsSynced(prev => ({
                              ...prev,
                              [group.key]: option,
                            }))
                          }
                          activeOpacity={0.75}
                          style={{
                            flexGrow: 1,
                            minWidth: group.key === 'insulationRValue' ? 54 : 92,
                            alignItems: 'center',
                            paddingVertical: 9,
                            paddingHorizontal: 10,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: selected
                              ? '#34d399'
                              : darkMode
                                ? 'rgba(255,255,255,0.14)'
                                : Colors.line,
                            backgroundColor: selected
                              ? 'rgba(52,211,153,0.14)'
                              : darkMode
                                ? '#252527'
                                : Colors.surface2,
                          }}
                        >
                          <Text
                            style={{
                              color: selected ? '#34d399' : Colors.text,
                              fontSize: 11,
                              fontWeight: '700',
                            }}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <PlanTakeoffPendingConfirmationStrip
            measurements={measurements as Record<string, unknown>}
            setMeasurements={updater => {
              setMeasurementsSynced(prev => {
                const next =
                  typeof updater === 'function'
                    ? updater(prev as Record<string, unknown>)
                    : updater;
                return next as typeof prev;
              });
            }}
            allowedFields={pendingPlanConfirmationAllowedFields}
            tradeKey={singleTradeKey}
            includeUnresolvedConflicts={
              singleTradePlanImport && singleTradeKey === 'windows_doors'
            }
            darkMode={darkMode}
            captionColor={captionColor(darkMode, Colors)}
          />

          <CollapsibleQuickMeasurements
            visible={visible}
            expanded={quickMeasurementsOpen}
            onToggle={() => {
              if (quickMeasurementsOpen) {
                commitElectricalAttributes();
                flushStagedElectricalMeasurements();
              }
              setQuickMeasurementsOpen(v => !v);
            }}
            onDone={handleQuickMeasurementsDone}
            onFlooringBottomCollapse={preserveFlooringQmScrollPosition}
            onFloorPrepCollapse={handleQuickMeasurementsDone}
            scrollRef={scrollRef}
            scrollContentRef={scrollContentRef}
            containerRef={quickMeasurementsRef}
            measurements={measurements}
            setMeasurements={
              String(checklist?.templateKey || '').toLowerCase() ===
              'electrical'
                ? setElectricalMeasurementsStaged
                : setMeasurementsSynced
            }
            templateKey={checklist?.templateKey}
            projectType={draft?.projectType}
            notes={scopeNotes}
            includedScopeKeys={scopeAssemblyContext.activeScopeKeys}
            onSummaryChange={setQuickMeasurementSummary}
            onHvacScopeSelectionChange={syncHvacQmScopeItems}
            electricalQuantityEditingRef={electricalQmQuantityEditingRef}
            electricalAttributesCommitRef={electricalAttributesCommitRef}
            onElectricalAttributesPreview={previewElectricalAttributes}
            onWetAreaFinishChange={finish => {
              const choiceId = checklistChoiceFromWetAreaFinish(finish);
              if (!choiceId) return;
              setItems(prev =>
                prev.map(row =>
                  row.id === 'wet_area_install'
                    ? { ...row, choiceId, state: choiceIdToState(choiceId) }
                    : row
                )
              );
            }}
            onWetAreaSteppersChange={(counts, options) => {
              setItems(prev => {
                let next = syncWetAreaScopeFromSteppers(prev, {
                  counts,
                  keepingExisting: options?.keepingExisting,
                  showerWallTileSqft: measurements.showerWallTileSqft,
                  showerFloorTileSqft: measurements.showerFloorTileSqft,
                });
                next = syncBathroomFloorTileScopeItems(next, {
                  bathroomFloorSqft: measurements.bathroomFloorSqft,
                  bathFloorTileCount: counts.bathFloorTileCount,
                });
                return next;
              });
            }}
            onWetAreaExistingDemoChange={({
              demo,
              reuseExistingShowerDoor,
            }) => {
              setItems(prev =>
                syncWetAreaDemoScopeItems(prev, {
                  demo,
                  reuseExistingShowerDoor,
                  installShowerDoorCount: measurements.showerDoorCount,
                })
              );
            }}
            onKitchenQmChange={({ existing, install, demo }) => {
              setItems(prev =>
                syncKitchenQmScopeItems(prev, {
                  ...existing,
                  ...install,
                  ...demo,
                })
              );
            }}
            onFlooringQmChange={({ existing, install, demo }) => {
              syncFlooringScopeItemsFromMeasurements({
                ...(measurementsRef.current as Record<string, unknown>),
                ...existing,
                ...install,
                ...demo,
              });
            }}
            onFlooringScopeSync={syncFlooringScopeItemsFromMeasurements}
            onBathroomFixturesQmChange={({ existing, install, demo }) => {
              setItems(prev =>
                syncBathroomFixtureQmScopeItems(prev, {
                  ...existing,
                  ...install,
                  ...demo,
                })
              );
            }}
            onBathroomCountertopMaterialChange={
              handleBathroomCountertopMaterialChange
            }
            onShowerDoorCountChange={count => {
              if (count == null || count < 1) return;
              setItems(prev => {
                if (!prev.some(row => row.id === 'glass_door')) {
                  const afterIdx = prev.findIndex(
                    row => row.id === 'shower_floor_tile'
                  );
                  const doorItem: ScopeChecklistItem = {
                    id: 'glass_door',
                    label: 'Shower doors',
                    helperText:
                      'Glass shower door / enclosure plus bath mirror — material and install.',
                    inputType: 'yes_no',
                    state: 'included',
                    category: 'finishes',
                  };
                  if (afterIdx >= 0) {
                    const nextItems = [...prev];
                    nextItems.splice(afterIdx + 1, 0, doorItem);
                    return nextItems;
                  }
                  return [...prev, doorItem];
                }
                return prev.map(row =>
                  row.id === 'glass_door'
                    ? { ...row, state: 'included' as const }
                    : row
                );
              });
            }}
            onGarageDoorCountsChange={totalCount => {
              if (totalCount == null || totalCount < 1) return;
              setItems(prev => {
                if (!prev.some(row => row.id === 'garage_doors')) {
                  const afterIdx = prev.findIndex(
                    row => row.id === 'sliding_doors'
                  );
                  const fallbackIdx = prev.findIndex(
                    row => row.id === 'windows'
                  );
                  const insertAfter = afterIdx >= 0 ? afterIdx : fallbackIdx;
                  const garageItem: ScopeChecklistItem = {
                    id: 'garage_doors',
                    label: 'Garage doors',
                    helperText:
                      'Priced by type: single, double, or RV/oversized. Enter counts on Quick measurements.',
                    inputType: 'yes_no',
                    state: 'included',
                    category: 'exterior',
                  };
                  if (insertAfter >= 0) {
                    const nextItems = [...prev];
                    nextItems.splice(insertAfter + 1, 0, garageItem);
                    return nextItems;
                  }
                  return [...prev, garageItem];
                }
                return prev.map(row =>
                  row.id === 'garage_doors'
                    ? { ...row, state: 'included' as const }
                    : row
                );
              });
            }}
            wetAreaInstallChoiceId={
              displayItems.find(row => row.id === 'wet_area_install')
                ?.choiceId ?? null
            }
            showExistingWetAreaPanel={!hasSitePhotos && !notesPlumbingFlow}
            hasSitePhotos={hasSitePhotos}
            singleTradeImport={singleTradePlanImport || stuccoTradeFlow}
            tradeKey={
              notesPlumbingFlow
                ? 'plumbing'
                : singleTradePlanImport
                  ? singleTradeKey
                  : 'stucco'
            }
            notesTradeFlow={notesPlumbingFlow}
            notesScopeSelectorVisible={notesScopeSelectorVisible}
            notesTradeMode={effectiveNotesTradeMode}
            onNotesTradeModeChange={mode => {
              startTransition(() => {
                setNotesTradeMode(mode);
                if (mode !== 'whole_project') {
                  const serviceItemIds = new Set([
                    'service_call',
                    'fixture_repair',
                    'fixture_replace',
                    'drain_cleaning',
                  ]);
                  const plumbingItems = PLUMBING_CARDS.filter(card =>
                    mode === 'plumbing_service'
                      ? serviceItemIds.has(card.itemId)
                      : true
                  ).map(card => ({
                    id: card.itemId,
                    label: card.label,
                    helperText: card.helper,
                    category: card.groupTitle,
                    state: 'unsure' as const,
                  }));
                  setItems(plumbingItems);
                  setMeasurementsSynced(prev => ({
                    ...prev,
                    tradeWorkflowSource: 'standalone_trade',
                    plumbingWorkflowMode:
                      mode === 'plumbing_service'
                        ? 'service'
                        : 'bathroom_remodel',
                    plumbingScope: plumbingItems.map(item => item.id),
                  }));
                } else {
                  setItems(baseItemsRef.current);
                  setMeasurementsSynced(prev => ({
                    ...prev,
                    tradeWorkflowSource: null,
                    plumbingWorkflowMode: null,
                    plumbingPerformerMode: null,
                    plumbingScope: null,
                  }));
                }
              });
            }}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
          {singleTradePlanImport && singleTradeKey === 'insulation' ? (
            <InsulationAssemblyCard
              measurements={measurements as Record<string, unknown>}
              templateKey={checklist.templateKey ?? 'insulation'}
              onChange={(key, value) =>
                setMeasurementsSynced(prev => ({ ...prev, [key]: value }))
              }
              onAssembliesChange={assemblies =>
                setMeasurementsSynced(prev => {
                  if (
                    JSON.stringify(prev.insulationAssemblies ?? null) ===
                    JSON.stringify(assemblies ?? null)
                  ) {
                    return prev;
                  }
                  return {
                    ...prev,
                    insulationAssemblies: assemblies,
                  };
                })
              }
              Colors={Colors}
              darkMode={darkMode}
            />
          ) : null}

          {pinnedDrywallFinishItem ? (
            <View style={styles.groupSection}>
              {renderItem(pinnedDrywallFinishItem, {
                forcePinnedTexture: true,
              })}
            </View>
          ) : null}

          {pinnedDrywallAssemblyOptionsVisible ? (
            <View style={styles.groupSection}>
              <PinnedDrywallAssemblyOptionsCard
                measurements={measurements as Record<string, unknown>}
                onSheetLengthChange={handleDrywallSheetLengthChange}
                onBoardBucketChange={handleDrywallBoardBucketChange}
                Colors={Colors}
                darkMode={darkMode}
                cardStyles={{
                  card: styles.card,
                  choiceWrap: styles.choiceWrap,
                  choiceChipWide: styles.choiceChipWide,
                }}
              />
            </View>
          ) : null}

          {!isElectricalConfirmScope ||
          electricalScopeRowsMounted ||
          (quickMeasurementsOpen && electricalPreviewScopeGroups.length > 0)
            ? scopeGroupsToRender.map(group => (
                <ScopeGroupSection
                  key={group.title || 'all'}
                  title={group.title}
                  items={group.items}
                  collapsed={Boolean(collapsedGroups[group.title])}
                  onToggle={() => {
                    const isCollapsed = Boolean(collapsedGroups[group.title]);
                    if (isCollapsed) {
                      flushStagedElectricalMeasurements();
                    }
                    setCollapsedGroups(prev => ({
                      ...prev,
                      [group.title]: !isCollapsed,
                    }));
                  }}
                  renderItem={renderItem}
                  noteSummary={scopeChecklistNoteSummary(
                    group.items,
                    visualCtx
                  )}
                  Colors={Colors}
                  darkMode={darkMode}
                />
              ))
            : null}

          <View ref={customScopeSectionRef} collapsable={false}>
            {customScopeItems.length ? (
              <View style={styles.groupSection}>
                {customScopeItems.map(item => (
                  <React.Fragment key={item.id}>
                    {renderItem(item)}
                  </React.Fragment>
                ))}
              </View>
            ) : null}

            {!showCustomItemInput ? (
              <TouchableOpacity
                style={[
                  estimateFlowScopeCardAlignStyle(),
                  styles.addScopeItemBtn,
                  estimateFlowCardStyle(Colors, darkMode),
                  {
                    backgroundColor: darkMode ? '#202022' : Colors.surface,
                  },
                ]}
                onPress={() => setShowCustomItemInput(true)}
                disabled={applying}
                activeOpacity={0.75}
              >
                <Ionicons name='add-circle-outline' size={18} color='#22c55e' />
                <Text
                  style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}
                >
                  Add scope item
                </Text>
              </TouchableOpacity>
            ) : null}

            {showCustomItemInput ? (
              <CustomScopeItemComposer
                label={customItemLabel}
                onChangeLabel={setCustomItemLabel}
                onAdd={handleAddCustomItem}
                onCancel={() => {
                  setShowCustomItemInput(false);
                  setCustomItemLabel('');
                }}
                placeholder={customScopeItemPlaceholder}
                applying={applying}
                Colors={Colors}
                darkMode={darkMode}
              />
            ) : null}
          </View>

          {step2AppliedEstimateTotal > 0 ? (
            <BenchmarkReasonablenessCard
              value={benchmarkReasonableness}
              buildCostPerLivingSf={step2AppliedBuildCostPerLivingSf}
              buildCostUnitSuffix={
                appliedBuildCostArea?.unitSuffix ?? 'living SF'
              }
              showBuildCostPerSf={showAppliedBuildCostPerSf}
              darkMode={darkMode}
              appliedBreakdown={step2AppliedPricingBreakdown}
              appliedLines={step2AppliedPricingLines}
              scopeConfirmDisclaimer={
                scopeItemsNeedingConfirmation.length
                  ? {
                      label: `Confirm ${scopeItemsNeedingConfirmation.length} scope${
                        scopeItemsNeedingConfirmation.length === 1 ? '' : 's'
                      }`,
                      onPress: handleConfirmScopeItemsPress,
                    }
                  : null
              }
            />
          ) : null}
        </View>
      </GestureScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: Colors.bg,
            borderTopColor: darkMode
              ? 'rgba(148, 163, 184, 0.12)'
              : Colors.line,
          },
        ]}
      >
        <ReliableFlowPress
          style={[styles.primaryBtn, applying && styles.primaryBtnDisabled]}
          onPress={handleConfirm}
          disabled={applying}
        >
          {applying ? (
            <ActivityIndicator color='#0f172a' />
          ) : (
            <Text style={styles.primaryBtnText}>Continue to review</Text>
          )}
        </ReliableFlowPress>

        {isElectricalConfirmScope && quickMeasurementsOpen ? (
          <View style={styles.bulkSuggestedPricingLink}>
            <Text
              style={[styles.bulkSuggestedPricingBtnText, { color: '#22c55e' }]}
            >
              {electricalPreviewPendingPricingCount > 0
                ? `${electricalPreviewPendingPricingCount} pricing card${
                    electricalPreviewPendingPricingCount === 1 ? '' : 's'
                  } remaining to apply`
                : electricalPreviewPricingCount > 0
                  ? `All ${electricalPreviewPricingCount} pricing cards applied`
                  : electricalPreviewScopeGroups.length > 0
                    ? 'Selected scope pricing is shown below · remaining checks finish after Quick measurements'
                    : 'Select a measured scope item to show its pricing card below'}
            </Text>
          </View>
        ) : null}

        {scrollToPricingLabel ||
        suggestedPricingFooterSummary ||
        footerQuickMeasurementSummary.needsConfirmation > 0 ? (
          <View style={styles.bulkSuggestedPricingBlock}>
            {scrollToPricingLabel ? (
              <>
                <ReliableFlowPress
                  style={styles.bulkSuggestedPricingLink}
                  onPress={handleScrollToReadyPricing}
                  disabled={applying}
                  accessibilityLabel={`Scroll to ${scrollToPricingLabel}`}
                >
                  <Text style={[styles.bulkSuggestedPricingBtnText, { color: '#22c55e' }]}>
                    {scrollToPricingLabel}
                  </Text>
                </ReliableFlowPress>
                {pricingPendingHint ? (
                  <Text
                    style={[
                      styles.bulkApplyHint,
                      { color: darkMode ? 'rgba(255,255,255,0.55)' : Colors.sub },
                    ]}
                  >
                    {pricingPendingHint}
                  </Text>
                ) : null}
                {measurementSemanticsV1Enabled() &&
                suggestedPricingFooterBreakdown.benchmarkOnlyCount > 0 ? (
                  <ReliableFlowPress
                    style={styles.bulkApplyInfoLink}
                    onPress={() =>
                      Alert.alert(
                        'Pricing readiness',
                        FOOTER_PLANNING_BENCHMARK_INFO
                      )
                    }
                    disabled={applying}
                    accessibilityLabel='Planning estimate info'
                    accessibilityRole='link'
                  >
                    <Ionicons
                      name='information-circle-outline'
                      size={15}
                      color={darkMode ? 'rgba(255,255,255,0.55)' : Colors.sub}
                    />
                    <Text
                      style={[
                        styles.bulkApplyHint,
                        { color: darkMode ? 'rgba(255,255,255,0.55)' : Colors.sub },
                      ]}
                    >
                      Some are planning estimates until you add a takeoff
                    </Text>
                  </ReliableFlowPress>
                ) : null}
              </>
            ) : suggestedPricingFooterSummary ? (
              <ReliableFlowPress
                style={[
                  styles.bulkApplyBtn,
                  styles.bulkApplyBtnWarning,
                  applying && styles.primaryBtnDisabled,
                ]}
                onPress={() =>
                  Alert.alert(
                    'Confirm measurements',
                    'Choose a quantity for each conflicting takeoff before those cards can price.'
                  )
                }
                disabled={applying}
                accessibilityLabel={suggestedPricingFooterSummary}
              >
                <Ionicons name='alert-circle-outline' size={18} color='#fbbf24' />
                <Text style={[styles.bulkApplyBtnText, { color: '#fbbf24' }]}>
                  {suggestedPricingFooterSummary}
                </Text>
              </ReliableFlowPress>
            ) : footerQuickMeasurementSummary.needsConfirmation > 0 ? (
              <ReliableFlowPress
                style={[
                  styles.bulkApplyBtn,
                  styles.bulkApplyBtnWarning,
                  applying && styles.primaryBtnDisabled,
                ]}
                onPress={() =>
                  Alert.alert(
                    'Pricing readiness',
                    [
                      footerSuggestedPricingSummary({
                        readyCount: suggestedPricingFooterBreakdown.readyCount,
                        benchmarkOnlyCount:
                          suggestedPricingFooterBreakdown.benchmarkOnlyCount,
                      }),
                      suggestedPricingFooterBreakdown.readyLabels.length
                        ? `Waiting to apply: ${suggestedPricingFooterBreakdown.readyLabels.join(', ')}.`
                        : '',
                      FOOTER_PLANNING_BENCHMARK_INFO,
                      `${footerQuickMeasurementSummary.needsConfirmation} measurement${
                        footerQuickMeasurementSummary.needsConfirmation === 1
                          ? ''
                          : 's'
                      } still need${
                        footerQuickMeasurementSummary.needsConfirmation === 1
                          ? 's'
                          : ''
                      } confirmation in Quick measurements before those scopes can move from a planning estimate to a firm price.`,
                      PLANNING_BID_CONFIDENCE_COPY,
                    ]
                      .filter(Boolean)
                      .join('\n\n')
                  )
                }
                disabled={applying}
                accessibilityLabel={`${footerQuickMeasurementSummary.needsConfirmation} measurements need confirmation`}
              >
                <Ionicons name='alert-circle-outline' size={18} color='#fbbf24' />
                <Text style={[styles.bulkApplyBtnText, { color: '#fbbf24' }]}>
                  {`${footerQuickMeasurementSummary.needsConfirmation} measurement${
                    footerQuickMeasurementSummary.needsConfirmation === 1
                      ? ''
                      : 's'
                  } need confirmation`}
                </Text>
              </ReliableFlowPress>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <ScopePricingContextValue.Provider value={enrichedPricingContext}>
      <ScopeAssemblyContextValue.Provider value={scopeAssemblyContext}>
        <ScopeNormalizedMeasurementsContext.Provider value={sharedRowNorm}>
          <ScopeParsedNotesContext.Provider value={sharedParsedNotes}>
            <Modal
              visible
              animationType='slide'
              presentationStyle='fullScreen'
              onRequestClose={handleBack}
            >
              <StatusBar
                barStyle={darkMode ? 'light-content' : 'dark-content'}
              />
              <View style={{ flex: 1, backgroundColor: Colors.bg }}>
                {body}
              </View>
            </Modal>
          </ScopeParsedNotesContext.Provider>
        </ScopeNormalizedMeasurementsContext.Provider>
      </ScopeAssemblyContextValue.Provider>
    </ScopePricingContextValue.Provider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  quickMeasurements: {
    marginHorizontal: -8,
    marginBottom: 14,
  },
  quickMeasurementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickMeasurementsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickMeasurementsBody: {
    marginTop: 14,
    gap: 22,
  },
  quickMeasurementSection: {
    gap: 12,
  },
  qmEmbeddedScopeBlock: {
    gap: 8,
  },
  wetAreaSection: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickMeasurementSectionSplit: {
    marginTop: 4,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  quickMeasurementSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  quickMeasurementsDone: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginTop: 2,
  },
  measurementsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 40,
    gap: 4,
  },
  suggestionValueCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 72,
  },
  measurementField: {
    // Stacked full-width fields — avoid flex:1 so keyboard show/hide does not
    // stretch/shrink rows and make Needs confirmation feel like it jumps.
    width: '100%',
    minWidth: 0,
  },
  measurementFieldPlumbing: {
    marginBottom: 6,
  },
  measurementFieldSpaced: {
    marginBottom: 2,
  },
  measurementFieldPrimary: {
    flex: 1,
  },
  measurementLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  measurementLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  measurementFromNotesChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  measurementInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 38,
  },
  measurementInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    fontSize: 14,
    fontWeight: '600',
    minWidth: 0,
  },
  measurementUnit: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
    flexShrink: 0,
  },
  groupSection: {
    marginBottom: 6,
  },
  addScopeItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 14,
  },
  customItemCard: {
    gap: 10,
    marginBottom: 14,
    padding: 12,
  },
  customItemHeader: {
    gap: 3,
  },
  customItemInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customItemInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
  },
  customItemAddBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  customComposerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  customComposerCancelBtn: {
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  customComposerAddBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 12,
  },
  customComposerAddBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  card: {
    marginHorizontal: -8,
    marginBottom: 12,
  },
  scopeCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    flex: 1,
    letterSpacing: -0.2,
  },
  scopeCardDescription: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  fromNotesBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  fromNotesBadgeLight: {
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  fromNotesBadgeDark: {
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  customCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  customBadgeLight: {
    borderColor: 'rgba(96, 165, 250, 0.32)',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  customBadgeDark: {
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
  },
  customIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  customRenameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customRenameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 7,
    fontSize: 14,
    fontWeight: '700',
  },
  customRenameAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  customPricingModeLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  customPricingModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  customScopeUnitRow: {
    flexWrap: 'nowrap',
    marginBottom: 0,
  },
  pricingEntryModeChip: {
    flex: 1,
    alignItems: 'center',
  },
  savePricingBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 11,
    backgroundColor: '#22c55e',
  },
  savePricingBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  useSuggestedPricingBtn: confirmScopeApplyButtonStyle(),
  useSuggestedPricingBtnText: confirmScopeApplyButtonTextStyle(),
  /** Secondary opt-in for national comparison (distinct from green Apply). */
  useComparisonPricingBtn: {
    marginTop: 8,
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.32)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  useComparisonPricingBtnText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
  },
  includedPillRow: {
    marginTop: 10,
    marginBottom: 2,
  },
  includedPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  includedPillDark: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  includedPillLight: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  assemblyChoiceRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  assemblyChoiceChip: {
    flex: 1,
    minHeight: 58,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  choiceChip: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceChipWide: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: '47%',
    flexGrow: 1,
  },
  roofingChoiceChipHalf: {
    width: '48%',
    minWidth: '48%',
    maxWidth: '48%',
    flexGrow: 0,
    flexShrink: 0,
  },
  roofingChoiceChipFull: {
    width: '100%',
    minWidth: '100%',
    maxWidth: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  stuccoChoiceChip: {
    width: '48%',
    minWidth: '48%',
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stuccoChoiceChipLast: {
    width: '100%',
    minWidth: '100%',
  },
  stuccoChoiceLabel: {
    width: '100%',
  },
  qtySection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  qtyCompactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingRow: {
    minHeight: 30,
  },
  pricingRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pricingRowEmphasized: {
    minHeight: 34,
  },
  pricingRowGap: {
    marginTop: 6,
  },
  pricingSplitRow: {
    marginTop: 10,
  },
  pricingSplitRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pricingRateHelper: {
    alignSelf: 'flex-end',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 3,
    opacity: 0.82,
  },
  intelligenceNotice: {
    // Compact metadata strip — not a nested card.
    marginTop: 8,
    paddingHorizontal: 0,
    paddingVertical: 2,
    borderRadius: 0,
    borderWidth: 0,
    gap: 3,
  },
  intelligenceNoticeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  formulaNoticeBlock: {
    gap: 6,
  },
  formulaActionButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  formulaActionText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  formulaRevertButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  formulaRevertText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  assemblyActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  assemblyActionChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  assemblyActionText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },
  budgetSplitPanel: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  compactSuggestedRow: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactSuggestedBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  compactSuggestedBtnText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '700',
  },
  doneEditingBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    paddingVertical: 9,
  },
  doneEditingBtnText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '700',
  },
  pricingEditorPanel: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  pricingEditorPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 2,
  },
  pricingEditorHelper: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  pricingEditorDoneBtn: {
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
  },
  pricingEditorDoneBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  pricingMatLabRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  pricingMatLabModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  pricingMatLabCol: {
    flex: 1,
    minWidth: 0,
  },
  pricingEditorTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  pricingInputEmbedded: {
    gap: 4,
  },
  pricingInputRowEmbedded: {
    minHeight: 40,
    paddingHorizontal: 8,
    gap: 2,
  },
  budgetSplitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  budgetSplitHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  budgetSplitHeaderPill: {
    flexShrink: 0,
    marginLeft: 4,
  },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  sourcePillNotes: {
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  sourcePillNational: {
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
  },
  sourcePillTemplate: {
    borderColor: 'rgba(167, 139, 250, 0.35)',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  sourcePillRemainder: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  editQuantityLink: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  /** Amber disclosure — distinct from blue Edit. */
  compareQuantityLink: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  scopeCardActionsWrap: {
    marginTop: 8,
    gap: 8,
  },
  scopeCardActionsWrapSingle: {
    alignItems: 'flex-start',
  },
  scopeCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scopeCardActionSlot: {
    flex: 1,
    minWidth: 0,
  },
  secondaryActionBtn: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  secondaryActionBtnStretch: {
    flex: 1,
    alignSelf: 'stretch',
  },
  secondaryActionBtnInline: {
    alignSelf: 'flex-start',
  },
  secondaryActionBtnCompare: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  secondaryActionBtnIcon: {
    flexShrink: 0,
  },
  secondaryActionBtnText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  secondaryActionBtnTextCompare: {
    color: '#fbbf24',
  },
  pricingInputCard: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
  },
  pricingInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 7,
  },
  rateModeToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pricingRateModeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  pricingRateModeChip: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pricingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  pricingInputPrefixed: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: 0,
    paddingRight: 0,
    margin: 0,
    height: undefined,
    minHeight: 20,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    fontFamily: Typography.fonts.secondary,
    fontWeight: '700',
    ...(Platform.OS === 'android'
      ? { lineHeight: 20, textAlignVertical: 'center' as const, includeFontPadding: false }
      : null),
  },
  pricingCurrencyPrefix: {
    fontSize: 15,
    fontFamily: Typography.fonts.secondary,
    fontWeight: '700',
    lineHeight: 20,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : null),
  },
  pricingInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    height: 40,
    ...(Platform.OS === 'android'
      ? { textAlignVertical: 'center' as const, includeFontPadding: false }
      : {}),
  },
  qtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  bulkSuggestedPricingLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  bulkSuggestedPricingBlock: {
    width: '100%',
    gap: 6,
  },
  bulkApplyBtn: {
    minHeight: 44,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bulkApplyBtnDark: {
    borderColor: 'rgba(34, 197, 94, 0.55)',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  bulkApplyBtnLight: {
    borderColor: 'rgba(34, 197, 94, 0.65)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  bulkApplyBtnWarning: {
    borderColor: 'rgba(251, 191, 36, 0.55)',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  bulkApplyBtnText: {
    color: '#22c55e',
    fontWeight: '800',
    fontSize: 15,
  },
  bulkApplyHint: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  bulkApplyInfoLink: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  bulkSuggestedPricingBtnText: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
});
