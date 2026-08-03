import React, {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
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
  ScopeAssumptionState,
  ScopeChecklistItem,
  ScopeMeasurements,
} from '@/utils/estimateAiDraft';
import {
  formatDraftMoney,
  resolveDraftScopeNotes,
  repairDraftRatePricingFromNotes,
} from '@/utils/estimateAiDraft';
import {
  checklistDisplayHelper,
  checklistDisplayLabel,
  choiceIdsToScopeState,
  createCustomScopeItem,
  groupScopeChecklistItems,
  initialScopeGroupCollapse,
  mergeScopeProgressIntoDraft,
  applyKitchenScopeInferences,
  hydrateScopeChecklistFromNotes,
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
} from '@/utils/estimateScopeChecklistUi';
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
import { formatBathroomDrywallPatchSqftHint, resolveBathroomDrywallPatchSuggestedPricing, syncBathroomPaintRepairItemQuantity } from '@/utils/bathroomDrywallPatchPricing';
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
  getScopeQuantityFieldLabels,
  pricingBasisFieldLabel,
  formatUnitLabel,
  formatCountFieldSuffix,
  formatDualCountQuantity,
  getNationalAverageBudgetSplit,
  getChecklistItemQuantityRule,
  getChecklistItemQuantityRuleOrDefault,
  hasCompleteUserSelectedPricing,
  isNationalAverageComparisonBlock,
  initialScopeMeasurementInputExtended,
  isDualAllowanceItem,
  overlayDualRatePricingDisplay,
  prepareScopeMeasurementsInputForUi,
  primaryQuantityForAppliedSuggestedBlock,
  resolveChecklistItemQuantity,
  resolveDualRatePricingDisplayFromNotes,
  resolveScopeItemSuggestedPricing,
  isPlaceholderAllowancePricing,
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
import {
  countFilledQuickMeasurements,
  emptyQuickMeasurementInput,
  isWholeHomeQuickMeasurementTemplate,
  quickMeasurementDisplayLabel,
  quickMeasurementHelperText,
  quickMeasurementPlaceholder,
  quickMeasurementRowsForInput,
  quickMeasurementSectionsForRows,
  resolveEffectiveQuickMeasurementTemplateKey,
  resolveQuickMeasurementDisplayValue,
  type QuickMeasurementFieldDef,
  type QuickMeasurementFieldKey,
} from '@/utils/scopeQuickMeasurements';
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
  syncKitchenQmScopeItems,
  syncBathroomFixtureQmScopeItems,
  syncQmPanelScopeItems,
  shouldHideBathroomFixtureScopeCardInQmEmbed,
  BATHROOM_FIXTURES_QM_EMBEDDED_IDS,
  expandBathroomFixtureScopeDisplayItems,
} from '@/utils/qmScopePanels';
import {
  QmBathroomFixturesPanels,
  QmFlooringScopePanels,
  QmKitchenScopePanels,
  qmNeutralScopePanelStyle,
} from '@/components/estimate/QmTradeScopePanels';
import {
  GARAGE_DOOR_TYPE_RATES,
  resolveGarageDoorSuggestedPricing,
  type GarageDoorType,
} from '@/utils/exteriorOpeningsPricing';

import { estimateFlowCardStyle, estimateFlowDividerColor } from '@/utils/estimateFlowCardStyle';
import {
  SCOPE_ITEM_TIER_OPACITY,
  scopeCardAccentForItem,
  scopeChecklistNoteSummary,
  scopeItemNoteBadge,
  scopeItemVisualTier,
  type ScopeItemNoteBadge,
  type ScopeItemVisualContext,
} from '@/utils/scopeItemVisualTier';
import {
  buildCardIntelligenceDisplay,
  resolveScopeItemIntelligence,
  type ScopeItemIntelligence,
} from '@/utils/scopeIntelligence';
import { resolveFormulaQuantityApplyTarget, shouldShowFormulaQuantityButton, isFormulaQuantityApplyTargetActive, usesAutoFlatworkSqftPricing } from '@/utils/scopeFormulaRegistry';
import {
  AcceptedPricingSummary,
} from '@/components/estimate/AcceptedPricingSummary';
import {
  buildAcceptanceFromSuggestedBlock,
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
  onClose: () => void;
  onConfirm: (items: ScopeChecklistItem[], measurements?: ScopeMeasurements) => void;
  onScopeOnly?: (measurements?: ScopeMeasurements) => void;
  /** Persist in-progress scope without API round-trip (e.g. when navigating to review/pricing). */
  onPersistProgress?: (items: ScopeChecklistItem[], measurements?: ScopeMeasurements) => void;
  /** Saved templates + active bid used to prefer saved $/unit rates in suggested pricing. */
  pricingContext?: ScopePricingContext | null;
  /** Step 1 site photos — when present, existing wet area is AI-seeded and the QM panel stays hidden. */
  hasSitePhotos?: boolean;
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

function inputShellStyle(Colors: ReturnType<typeof getColors>, darkMode: boolean) {
  return {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
  };
}

function captionColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? 'rgba(255,255,255,0.62)' : Colors.sub;
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
        : noteBadge === 'mentioned'
          ? SCOPE_MENTIONED_IN_NOTES_LABEL
          : noteBadge === 'review'
            ? 'Review'
            : null;
  const badgeColor = noteBadge === 'review' ? '#f59e0b' : '#22c55e';

  return (
    <View style={styles.cardTitleRow}>
      <Text
        style={{
          color: darkMode ? '#F5F7FA' : Colors.text,
          fontSize: 14,
          fontWeight: '700',
          lineHeight: 20,
          flex: 1,
        }}
      >
        {label}
      </Text>
      {badgeLabel ? (
        <View style={[styles.fromNotesBadge, darkMode ? styles.fromNotesBadgeDark : styles.fromNotesBadgeLight]}>
          <Text style={{ color: badgeColor, fontSize: 10, fontWeight: '700' }}>{badgeLabel}</Text>
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
  const allowanceEntry = allowanceKey ? measurementsInput.itemQuantities[allowanceKey] : undefined;
  return entry?.quantitySource === 'user_entered' || allowanceEntry?.quantitySource === 'user_entered';
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

function pricingTextColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? '#F5F7FA' : Colors.text;
}

function pricingLabelColor(darkMode: boolean, Colors: ReturnType<typeof getColors>) {
  return darkMode ? 'rgba(255,255,255,0.72)' : Colors.sub;
}

/** Maps a per-leg pricing source to the small pill shown next to that line. */
function legPillKind(source: PricingLegSource): 'notes' | 'template' | 'benchmark' | 'national' {
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
  if (block.mode === 'note_total_split' && leg === 'labor' && source === 'notes') {
    return <SourcePill kind="remainder" label="Remainder" />;
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
          : 'National average';
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
const ScopePricingContextValue = React.createContext<ScopePricingContext | null>(null);
const ScopeAssemblyContextValue = React.createContext<{
  activeScopeKeys: string[];
  excludedScopeKeys: string[];
}>({ activeScopeKeys: [], excludedScopeKeys: [] });

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
    <View style={[styles.pricingRow, emphasized ? styles.pricingRowEmphasized : undefined]}>
      <View style={styles.pricingRowMain}>
        <Text
          style={{
            color: pricingTextColor(darkMode, Colors),
            fontSize: emphasized ? 17 : 15,
            fontWeight: '700',
            letterSpacing: emphasized ? -0.2 : 0,
          }}
        >
          {value}
        </Text>
        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          {pill ?? (
            <Text style={{ color: pricingLabelColor(darkMode, Colors), fontSize: 13, fontWeight: '600' }}>
              {label}
            </Text>
          )}
        </View>
      </View>
      {helper ? (
        <Text style={[styles.pricingRateHelper, { color: pricingLabelColor(darkMode, Colors) }]}>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <Text style={{ color: pricingLabelColor(darkMode, Colors), fontSize: 14, fontWeight: '600' }}>
            {label}
          </Text>
          {pill ?? null}
        </View>
        <Text style={{ color: pricingTextColor(darkMode, Colors), fontSize: 15, fontWeight: '700' }}>
          {value}
        </Text>
      </View>
      {helper ? (
        <Text style={[styles.pricingRateHelper, { color: pricingLabelColor(darkMode, Colors) }]}>
          Rate: {helper}
        </Text>
      ) : null}
    </View>
  );
}

function calculatedQuantityAlreadyActive(intelligence: ScopeItemIntelligence): boolean {
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

function isNationalAveragePricingBlock(block: SuggestedPricingBlock | null | undefined): boolean {
  if (!block) return false;
  return (
    block.materialSource === 'national_average' ||
    block.laborSource === 'national_average' ||
    /national\s*average/i.test(String(block.rateSourceLabel || ''))
  );
}

function isSavedPricingBlock(block: SuggestedPricingBlock | null | undefined): boolean {
  return Boolean(
    block &&
      (block.materialSource === 'local_benchmark' || block.laborSource === 'local_benchmark')
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
  const isCountertopAreaFormula = formula.formulaKey === 'countertop_area_from_cabinet_lf';
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
  const currentQuantity = Number(params.resolved.dualCount?.quantity ?? params.resolved.quantity);
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
  if (quantity == null || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
    return undefined;
  }
  const relatedEntries: NonNullable<CalculatedQuantityRevertSnapshot['relatedEntries']> = {};
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
  pricingCardOwnsStatus?: boolean;
}) {
  const [warningExpanded, setWarningExpanded] = useState(false);
  const cardDisplay = buildCardIntelligenceDisplay(intelligence, { pricingAccepted });
  const formula = intelligence.formula;
  const calculatedActive = calculatedQuantityAlreadyActive(intelligence);
  const applyTarget = formula
    ? resolveFormulaQuantityApplyTarget({ scopeKey: intelligence.scopeItemKey, formula })
    : null;
  const formulaVariance = intelligence.formulaComparison?.variancePercent ?? null;
  const showFormulaDetails = Boolean(formula && !calculatedActive);
  const showCalculatedRevert = calculatedActive && Boolean(onRevertCalculatedQuantity && calculatedRevertLabel);
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
    compact && /^Base national average/i.test(warningFullRaw) ? '' : warningFullRaw;
  const warningFirstSentence = warningFull.split(/(?<=\.)\s+/)[0] || warningFull;
  const warningPreview =
    warningFirstSentence.length > 88
      ? `${warningFirstSentence.slice(0, 85).trimEnd()}…`
      : warningFirstSentence;
  const warningCanExpand = Boolean(warningFull && warningPreview !== warningFull);

  const otherNotice =
    otherNoticeRaw &&
    !(showFormulaDetails && otherNoticeRaw.startsWith('Calculated comparison:'))
      ? otherNoticeRaw
      : null;

  const showConfidenceLine =
    !pricingCardOwnsStatus &&
    (showQuantity ||
      Boolean(cardDisplay.conciseBenchmarkWarning || cardDisplay.confidenceLabel));

  return (
    <View style={[styles.intelligenceNotice, { backgroundColor: 'transparent' }]}>
      {showQuantity ? (
        <Text style={[styles.intelligenceNoticeText, { color: captionColor(darkMode, Colors) }]}>
          <Text style={{ color: accent, fontWeight: '800' }}>{cardDisplay.confidenceLabel}</Text>
          {cardDisplay.conciseBenchmarkWarning ? null : (
            <>
              {' · '}
              {cardDisplay.sourceLabel}
            </>
          )}
        </Text>
      ) : showConfidenceLine ? (
        <Text style={[styles.intelligenceNoticeText, { color: captionColor(darkMode, Colors) }]}>
          <Text style={{ color: accent, fontWeight: '800' }}>{cardDisplay.confidenceLabel}</Text>
        </Text>
      ) : null}
      {warningFull ? (
        <TouchableOpacity
          activeOpacity={warningCanExpand ? 0.75 : 1}
          disabled={!warningCanExpand}
          onPress={() => setWarningExpanded((open) => !open)}
          accessibilityRole={warningCanExpand ? 'button' : undefined}
          accessibilityLabel={
            warningCanExpand
              ? warningExpanded
                ? 'Collapse pricing warning'
                : 'Expand pricing warning'
              : undefined
          }
          accessibilityState={warningCanExpand ? { expanded: warningExpanded } : undefined}
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
        <Text style={[styles.intelligenceNoticeText, { color: captionColor(darkMode, Colors) }]}>
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
            <Text style={[styles.intelligenceNoticeText, { color: captionColor(darkMode, Colors) }]}>
              {formula!.formulaExplanation}
            </Text>
          )}
          {(warningExpanded || !warningFull) &&
          formula!.expectedRange &&
          formulaVariance != null &&
          formulaVariance !== 0 &&
          Math.abs(formulaVariance) <= 150 ? (
            <Text style={[styles.intelligenceNoticeText, { color: captionColor(darkMode, Colors) }]}>
              Expected range: {formula!.expectedRange.low.toLocaleString()}-
              {formula!.expectedRange.high.toLocaleString()} {formatUnitLabel(formula!.unit)}
            </Text>
          ) : null}
          {onUseCalculatedQuantity &&
          applyTarget &&
          formula &&
          shouldShowFormulaQuantityButton({ scopeKey: intelligence.scopeItemKey, formula }) ? (
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={applyTarget.accessibilityLabel}
              onPress={onUseCalculatedQuantity}
              style={[
                styles.formulaActionButton,
                {
                  borderColor: darkMode ? 'rgba(34,197,94,0.28)' : 'rgba(22,163,74,0.32)',
                  backgroundColor: darkMode ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)',
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
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
          accessibilityRole="button"
          accessibilityLabel={calculatedRevertLabel ?? 'Revert to original quantity'}
          onPress={onRevertCalculatedQuantity}
          style={[
            styles.formulaRevertButton,
            {
              borderColor: darkMode ? 'rgba(255,255,255,0.18)' : Colors.line,
              backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
            },
          ]}
        >
          <Ionicons name="arrow-undo-outline" size={17} color={captionColor(darkMode, Colors)} />
          <Text style={[styles.formulaRevertText, { color: captionColor(darkMode, Colors) }]}>
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
    (editor.pricingBasis && editor.pricingBasis.quantity > 0 ? editor.pricingBasis.quantity : 0) ||
    (block.basis?.quantity && block.basis.quantity > 0 ? block.basis.quantity : 0);
  const basisUnit = editor.pricingBasis?.unit || editor.basisUnit || block.basis?.unit || 'sqft';
  const material = parseMoneyAmount(editor.materialValue);
  const labor = parseMoneyAmount(editor.laborValue);
  const allowance = parseMoneyAmount(editor.allowanceValue);
  const hasEditorAmounts = block.lumpSumOnly ? allowance > 0 : material > 0 || labor > 0;
  if (!hasEditorAmounts) return block;

  const total = block.lumpSumOnly ? allowance : material + labor;
  if (!(total > 0)) return block;

  const originalBasisQty = block.basis?.quantity && block.basis.quantity > 0 ? block.basis.quantity : 0;
  const amountsDiffer =
    Math.abs((block.lumpSumOnly ? block.total : block.material) - (block.lumpSumOnly ? total : material)) >= 0.01 ||
    (!block.lumpSumOnly && Math.abs(block.labor - labor) >= 0.01) ||
    Math.abs(block.total - total) >= 0.01 ||
    (originalBasisQty > 0 && basisQty > 0 && Math.abs(originalBasisQty - basisQty) >= 0.01);

  if (!amountsDiffer) return block;

  const materialRate = basisQty > 0 && material > 0 ? roundMoney2(material / basisQty) : null;
  const laborRate = basisQty > 0 && labor > 0 ? roundMoney2(labor / basisQty) : null;
  const unitLabel = formatUnitLabel(basisUnit);
  const basisHelper =
    basisQty > 0 ? `Based on ${basisQty.toLocaleString()} ${unitLabel} · adjusted pricing` : 'Adjusted pricing';

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
        ? block.costBuckets.map((bucket) => {
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
      ).filter((bucket) => bucket.amount > 0);

  const originalLabel = block.rateSourceLabel.replace(/^Suggested · /, '').replace(/^Adjusted · /, '');
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
    block.materialSource === 'local_benchmark' || block.laborSource === 'local_benchmark';
  const semantics = measurementSemanticsV1Enabled();
  const action = block.benchmarkAction;
  const includedInStage = action === 'included_in_stage' || Boolean(block.includedInStageLabel);
  const caption = pricingLabelColor(darkMode, Colors);
  const text = pricingTextColor(darkMode, Colors);
  const statusAmber = '#fbbf24';
  const divider = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';

  if (semantics && includedInStage) {
    const stageName = block.includedInStageLabel || stageTitle(block.benchmarkStageKey);
    return (
      <View style={[styles.budgetSplitPanel, { borderTopColor: divider }]}>
        <Text style={{ color: text, fontSize: 13, fontWeight: '700' }}>Included in {stageName}</Text>
        <Text style={{ color: caption, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
          Detailed takeoff still required. Stage total is on the {stageName} card.
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
  const isNationalAverageSource = /national\s*average/i.test(rateLabel);
  const isNationalComparison =
    /national\s*average\s*comparison/i.test(rateLabel) ||
    (Boolean(block.isComparison) && isNationalAverageSource);
  // When the contractor already entered/applied a price, national rows are
  // comparison-only — never count as "price ready" Apply targets.
  // Stage lumps stay view-only.
  const canWritePrice =
    Boolean(onUsePricing) &&
    action !== 'included_in_stage' &&
    !(
      hasCurrentPricing &&
      (isNationalAverageSource ||
        isNationalComparison ||
        action === 'comparison_only' ||
        Boolean(block.isComparison))
    ) &&
    (isNationalComparison ||
      (action !== 'comparison_only' && !(block.isComparison && usesBenchmark && semantics)));

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
          <Text style={{ color: caption, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
            {display.sourceLine}
          </Text>
        </View>
        {canWritePrice && writeActionLabel ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onUsePricing}
            style={styles.compactSuggestedBtn}
            accessibilityLabel={writeActionLabel}
            accessibilityRole="button"
          >
            <Text style={styles.compactSuggestedBtnText}>{writeActionLabel}</Text>
          </TouchableOpacity>
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
    semantics && usesBenchmark && block.benchmarkLevel === 'stage' && block.benchmarkStageKey
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

  return (
    <View style={[styles.budgetSplitPanel, { borderTopColor: divider }]}>
      {display.quantityLine ? (
        <Text style={{ color: caption, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
          {display.quantityLine}
        </Text>
      ) : null}

      <Text
        style={[styles.budgetSplitHeaderTitle, { color: text }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {headerTitle}
      </Text>

      <Text
        style={{
          color: text,
          fontSize: 26,
          fontWeight: '700',
          letterSpacing: -0.4,
          marginTop: 6,
        }}
        accessibilityLabel={`Suggested total ${displayTotal}`}
      >
        {displayTotal}
      </Text>

      {display.splitLine ? (
        <Text style={{ color: caption, fontSize: 13, fontWeight: '500', marginTop: 6, lineHeight: 18 }}>
          {display.splitLine}
        </Text>
      ) : null}

      {display.unitRateLine ? (
        <Text style={{ color: caption, fontSize: 12, marginTop: 2 }}>{display.unitRateLine}</Text>
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
          floorType={toiletRelocateFloorTypeFromPricingRecord(block.pricingRecordId)}
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

      {isInteriorPaintSuggestedBlock(block.pricingRecordId) ? (
        (() => {
          const ctx = interiorPaintContextFromPricingRecord(block.pricingRecordId);
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
      ) : null}

      {stageCoversLine ? (
        <Text style={{ color: caption, fontSize: 12, fontWeight: '500', marginTop: 6, lineHeight: 16 }}>
          {stageCoversLine}
        </Text>
      ) : null}

      {canWritePrice && actionLabel ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onUsePricing}
          style={
            isNationalComparison
              ? styles.useComparisonPricingBtn
              : styles.useSuggestedPricingBtn
          }
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
        >
          <Text
            style={
              isNationalComparison
                ? styles.useComparisonPricingBtnText
                : styles.useSuggestedPricingBtnText
            }
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
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
  const editBackgroundColor = darkMode ? 'rgba(255,255,255,0.06)' : Colors.surface2;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={expanded != null ? { expanded } : undefined}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={[
        styles.secondaryActionBtn,
        stretch ? styles.secondaryActionBtnStretch : styles.secondaryActionBtnInline,
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
          color="#fbbf24"
          style={styles.secondaryActionBtnIcon}
        />
      ) : (
        <Ionicons
          name="create-outline"
          size={12}
          color={editIconColor}
          style={styles.secondaryActionBtnIcon}
        />
      )}
      <Text
        style={[
          styles.secondaryActionBtnText,
          isCompare ? styles.secondaryActionBtnTextCompare : { color: editTextColor },
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
  edit: React.ReactNode;
}) {
  if (!compare) {
    return (
      <View style={[styles.scopeCardActionsWrap, styles.scopeCardActionsWrapSingle]}>{edit}</View>
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
    /national\s*average\s*comparison/i.test(String(block.rateSourceLabel || '')) ||
    (Boolean(block.isComparison) && /national\s*average/i.test(String(block.rateSourceLabel || '')));

  if (isNationalComparison) {
    return (
      <View style={editAction ? undefined : { marginTop: 8 }}>
        <SuggestedBudgetSplitRows
          block={block}
          Colors={Colors}
          darkMode={darkMode}
          // Already-priced scopes keep the national row for comparison only.
          onUsePricing={hasCurrentPricing ? undefined : onUsePricing}
          forceCompact
          {...cardProps}
        />
        {editAction ? (
          <ScopePricingSecondaryActions edit={editAction} />
        ) : null}
      </View>
    );
  }

  const usesTemplate = block.materialSource === 'template' || block.laborSource === 'template';
  const hasBenchmark = Boolean(block.benchmarkEvidence);
  const includedInStage =
    block.benchmarkAction === 'included_in_stage' || Boolean(block.includedInStageLabel);
  const comparisonOnly = Boolean(
    block.isComparison || block.benchmarkEvidence?.benchmarkIsComparisonOnly || includedInStage
  );
  // Included-in-stage notices stay visible; other comparisons collapse by default under semantics.
  const [open, setOpen] = useState(
    includedInStage || usesTemplate || (hasBenchmark && !measurementSemanticsV1Enabled())
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
      variant="compare"
      label={compareLabel}
      expanded={open}
      stretch={Boolean(editAction)}
      onPress={() => setOpen((prev) => !prev)}
    />
  );

  return (
    <View style={editAction ? undefined : { marginTop: 8 }}>
      {editAction ? (
        <ScopePricingSecondaryActions compare={compareButton} edit={editAction} />
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
      variant="edit"
      label={displayLabel}
      stretch={stretch}
      onPress={onPress}
    />
  );
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
          backgroundColor: darkMode ? 'rgba(255,255,255,0.045)' : Colors.surface2,
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
        style={[styles.pricingEditorHelper, { color: captionColor(darkMode, Colors) }]}
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
        accessibilityRole="button"
        accessibilityLabel="Done editing"
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

function isSoftCostAllowanceScope(itemId: string, lumpSumOnly?: boolean): boolean {
  return Boolean(lumpSumOnly) || itemId === 'permits' || itemId === 'plans_engineering' || itemId === 'cleanup';
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
  if (basisQty > 0 && basis?.quantitySource === 'user_entered') return 'takeoff';
  return 'flat';
}

function pricingEditorHelperForMode(
  mode: PricingEntryMode,
  fallback?: string | null
): string {
  if (mode === 'flat') {
    return 'Enter material and labor totals — no takeoff quantity required.';
  }
  return fallback || 'Enter takeoff quantity, then material and labor (flat $ or per-unit).';
}

function resolveAllowanceOrSplitMode(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  defaultUnit: string
): AllowanceOrSplitMode {
  const allowance = measurementsInput.itemQuantities[allowanceSplitSubKey(itemId, 'allowance')];
  const material = measurementsInput.itemQuantities[allowanceSplitSubKey(itemId, 'material')];
  const labor = measurementsInput.itemQuantities[allowanceSplitSubKey(itemId, 'labor')];
  const basis = measurementsInput.itemQuantities[allowanceSplitSubKey(itemId, 'sqft_basis')];
  const item = measurementsInput.itemQuantities[itemId];
  const hasSplit =
    parseMoneyAmount(material?.quantity) > 0 ||
    parseMoneyAmount(labor?.quantity) > 0 ||
    parseMoneyAmount(basis?.quantity) > 0;
  const hasAllowance =
    parseMoneyAmount(allowance?.quantity) > 0 ||
    ((item?.unit === 'allowance' || item?.unit === 'lump_sum') && parseMoneyAmount(item?.quantity) > 0);
  if (hasSplit && !hasAllowance) return 'split';
  if (hasAllowance && !hasSplit) return 'allowance';
  if (hasSplit) return 'split';
  if (hasAllowance) return 'allowance';
  return defaultUnit === 'allowance' || defaultUnit === 'lump_sum' ? 'allowance' : 'split';
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
      ).map((opt) => {
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
                borderColor: active ? '#22c55e' : darkMode ? 'rgba(148, 163, 184, 0.24)' : Colors.line,
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
      ).map((opt) => {
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
                borderColor: active ? '#22c55e' : darkMode ? 'rgba(148, 163, 184, 0.24)' : Colors.line,
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
                color: active ? '#22c55e' : darkMode ? 'rgba(255,255,255,0.72)' : Colors.sub,
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

function PricingInputField({
  label,
  value,
  helper,
  basis,
  prefix,
  suffix,
  placeholder = '0',
  defaultInputMode = 'total',
  onFocus,
  onChangeText,
  onBlur,
  Colors,
  darkMode,
  applying,
  embedded = false,
  readOnly = false,
}: {
  label: string;
  value: string;
  helper?: string | null;
  basis?: { quantity: number; unit: string } | null;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  defaultInputMode?: 'total' | 'rate';
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
}) {
  const [inputMode, setInputMode] = useState<'total' | 'rate'>(defaultInputMode);
  const [rateDraft, setRateDraft] = useState('');
  const [rateEditing, setRateEditing] = useState(false);
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const supportsRateMode = Boolean(basis?.quantity && basis.quantity > 0) && !readOnly;
  const amount = Number(String(value || '').replace(/,/g, ''));
  const rateValue =
    supportsRateMode && Number.isFinite(amount) && amount > 0
      ? String(Math.round((amount / basis!.quantity) * 100) / 100)
      : '';
  const displayValue = inputMode === 'rate' ? (rateEditing ? rateDraft : rateValue) : value;
  const activePrefix = inputMode === 'rate' ? '$' : prefix;
  const activeSuffix = inputMode === 'rate' && basis ? `/${formatUnitLabel(basis.unit)}` : suffix;
  const helperText =
    inputMode === 'rate' && Number.isFinite(amount) && amount > 0
      ? `Total ${formatDraftMoney(amount)}`
      : helper;
  const isEmptyValue = !String(displayValue || '').trim();
  useEffect(() => {
    if (inputMode === 'rate' && !rateEditing) {
      setRateDraft(rateValue);
    }
  }, [inputMode, rateEditing, rateValue]);
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
                backgroundColor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(248,250,252,0.9)',
              },
            ]
      }
    >
      <View style={styles.pricingInputHeader}>
        <Text
          style={{
            color: embedded ? (darkMode ? 'rgba(255,255,255,0.72)' : Colors.sub) : Colors.sub,
            fontSize: embedded ? 11 : 12,
            fontWeight: '700',
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
        {supportsRateMode ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setInputMode((mode) => (mode === 'total' ? 'rate' : 'total'))}
            style={[
              styles.rateModeToggle,
              {
                borderColor: darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(22, 163, 74, 0.24)',
                backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(22, 163, 74, 0.08)',
              },
            ]}
          >
            <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '700' }}>
              {inputMode === 'total' ? `$/${formatUnitLabel(basis!.unit)}` : 'Total'}
            </Text>
          </TouchableOpacity>
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
            style={{
              color: isEmptyValue ? placeholderColor : captionColor(darkMode, Colors),
              fontSize: 15,
              fontWeight: '700',
              lineHeight: 20,
              ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : null),
              marginTop: Platform.OS === 'ios' ? 1 : 0,
            }}
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
            }
            onFocus();
          }}
          onChangeText={handleChangeText}
          onBlur={() => {
            setRateEditing(false);
            onBlur();
          }}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          keyboardType="decimal-pad"
          {...scopeNumericInputProps}
          editable={!applying && !readOnly}
          style={[
            styles.pricingInput,
            { color: Colors.text },
            isEmptyValue && !embedded
              ? {
                  flex: 0,
                  width: Math.min(200, Math.max(128, String(placeholder || '').length * 8.5)),
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
                ? { includeFontPadding: false, textAlignVertical: 'center' as const }
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
  const unit = match[2].toLowerCase() === 'sqft' ? 'sqft' : match[2].toLowerCase();
  return { quantity, unit };
}

function unitRateHelper(
  amountValue: string | undefined,
  basis: { quantity: number; unit: string } | null | undefined
): string | null {
  const amount = Number(String(amountValue || '').replace(/,/g, ''));
  if (!basis || !Number.isFinite(amount) || amount <= 0 || basis.quantity <= 0) return null;
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
  item: Pick<ScopeChecklistItem, 'state' | 'choiceId' | 'inputType' | 'choiceIds'>,
  Colors: ReturnType<typeof getColors>,
  darkMode: boolean
) {
  const accent = scopeCardAccentForItem(tier, item, darkMode);
  return [
    styles.card,
    estimateFlowCardStyle(Colors, darkMode),
    {
      opacity: accent.opacity,
      ...(accent.backgroundColor ? { backgroundColor: accent.backgroundColor } : {}),
      ...(accent.borderColor ? { borderColor: accent.borderColor } : {}),
    },
  ];
}

function isCustomScopeItem(item: ScopeChecklistItem): boolean {
  return item.category === 'custom' || String(item.id || '').startsWith('custom_');
}

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

function CustomScopePricingSection({
  itemId,
  inScope,
  measurementsInput,
  onItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onSavePricing,
  Colors,
  darkMode,
  applying,
}: {
  itemId: string;
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
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const [pricingEditorOpen, setPricingEditorOpen] = useState(true);
  if (!inScope) return null;
  const itemInput = measurementsInput.itemQuantities[itemId];
  const materialKey = `${itemId}__material`;
  const laborKey = `${itemId}__labor`;
  const allowanceKey = `${itemId}__allowance`;
  const materialValue = measurementsInput.itemQuantities[materialKey]?.quantity ?? '';
  const laborValue = measurementsInput.itemQuantities[laborKey]?.quantity ?? '';
  const selectedUnit = itemInput?.unit === 'lf' || itemInput?.unit === 'allowance' ? itemInput.unit : 'sqft';
  const basis =
    selectedUnit === 'sqft' || selectedUnit === 'lf'
      ? {
          quantity: Number(String(itemInput?.quantity || '').replace(/,/g, '')),
          unit: selectedUnit,
        }
      : null;
  const validBasis = basis && Number.isFinite(basis.quantity) && basis.quantity > 0 ? basis : null;
  const moneyTotal = (material: string, labor: string) => {
    const materialNumber = Number(String(material || '').replace(/,/g, ''));
    const laborNumber = Number(String(labor || '').replace(/,/g, ''));
    const total =
      (Number.isFinite(materialNumber) && materialNumber > 0 ? materialNumber : 0) +
      (Number.isFinite(laborNumber) && laborNumber > 0 ? laborNumber : 0);
    return total > 0 ? String(Math.round(total * 100) / 100) : '';
  };
  const handleMaterialChange = (text: string) => {
    onItemQuantityChange(materialKey, text, 'count', 'allowance');
    onItemQuantityChange(allowanceKey, moneyTotal(text, laborValue), 'count', 'allowance');
  };
  const handleLaborChange = (text: string) => {
    onItemQuantityChange(laborKey, text, 'count', 'allowance');
    onItemQuantityChange(allowanceKey, moneyTotal(materialValue, text), 'count', 'allowance');
  };
  const splitTotal = moneyTotal(materialValue, laborValue);
  const hasBasis = selectedUnit !== 'allowance' && Boolean(validBasis);
  const hasSplitPricing = hasBasis && Boolean(splitTotal);
  const totalOnlyAmount =
    selectedUnit === 'allowance'
      ? Number(String(itemInput?.quantity || '').replace(/,/g, ''))
      : 0;
  const hasTotalOnlyPricing = selectedUnit === 'allowance' && Number.isFinite(totalOnlyAmount) && totalOnlyAmount > 0;
  const showEditor = pricingEditorOpen || (!hasSplitPricing && !hasTotalOnlyPricing);

  if (!showEditor) {
    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        {hasTotalOnlyPricing ? (
          <PricingSplitRow
            label="Total"
            value={formatDraftMoney(totalOnlyAmount)}
            darkMode={darkMode}
            Colors={Colors}
          />
        ) : null}
        {hasSplitPricing && validBasis ? (
          <>
            <PricingSplitRow
              label={`Total ${formatUnitLabel(validBasis.unit)}`}
              value={`${validBasis.quantity.toLocaleString()} ${formatUnitLabel(validBasis.unit)}`}
              darkMode={darkMode}
              Colors={Colors}
            />
            {materialValue ? (
              <PricingSplitRow
                label="Material"
                value={formatDraftMoney(Number(materialValue))}
                helper={unitRateHelper(materialValue, validBasis)}
                darkMode={darkMode}
                Colors={Colors}
              />
            ) : null}
            {laborValue ? (
              <PricingSplitRow
                label="Labor"
                value={formatDraftMoney(Number(laborValue))}
                helper={unitRateHelper(laborValue, validBasis)}
                darkMode={darkMode}
                Colors={Colors}
              />
            ) : null}
            <PricingSplitRow
              label="Total"
              value={formatDraftMoney(Number(splitTotal))}
              darkMode={darkMode}
              Colors={Colors}
            />
          </>
        ) : null}
        <ScopePricingSecondaryActions
          edit={<EditQuantityLink onPress={() => setPricingEditorOpen(true)} />}
        />
      </View>
    );
  }

  return (
    <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => (hasSplitPricing || hasTotalOnlyPricing) && setPricingEditorOpen(false)}
      >
        <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          Edit
        </Text>
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
          Enter a quantity basis, then material and labor totals.
        </Text>
        {hasSplitPricing || hasTotalOnlyPricing ? (
          <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
            Tap card to collapse
          </Text>
        ) : null}
      </TouchableOpacity>
      <View style={styles.customPricingModeLinks}>
        {(['sqft', 'lf', 'allowance'] as const).map((unit) => {
          const active = selectedUnit === unit;
          const label = unit === 'allowance' ? 'Use total' : `Use ${formatUnitLabel(unit)}`;
          return (
            <TouchableOpacity
              key={unit}
              activeOpacity={0.75}
              disabled={applying || active}
              onPress={() => onItemQuantityChange(itemId, unit === 'allowance' ? '' : itemInput?.quantity ?? '', 'count', unit)}
              style={[
                styles.customPricingModeChip,
                {
                  borderColor: active ? '#22c55e' : darkMode ? 'rgba(148, 163, 184, 0.24)' : Colors.line,
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
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <PricingInputField
        label={selectedUnit === 'allowance' ? 'Lump sum / total' : `Total ${formatUnitLabel(selectedUnit)}`}
        value={itemInput?.quantity ?? ''}
        prefix={selectedUnit === 'allowance' ? '$' : undefined}
        suffix={selectedUnit === 'allowance' ? undefined : formatUnitLabel(selectedUnit)}
        placeholder={selectedUnit === 'allowance' ? 'Enter total' : `Enter ${formatUnitLabel(selectedUnit)}`}
        onFocus={() => onItemQuantityFocus(itemId)}
        onChangeText={(text) => onItemQuantityChange(itemId, text, 'count', selectedUnit)}
        onBlur={() => onItemQuantityBlur(itemId)}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
      {selectedUnit !== 'allowance' ? (
        <>
          <PricingInputField
            key={`custom-material-${selectedUnit}-${validBasis ? 'rate' : 'total'}`}
            label="Material"
            value={materialValue}
            helper={unitRateHelper(materialValue, validBasis)}
            basis={validBasis}
            prefix="$"
            placeholder={validBasis ? `Material $/${formatUnitLabel(selectedUnit)}` : 'Material total'}
            defaultInputMode={validBasis ? 'rate' : 'total'}
            onFocus={() => onItemQuantityFocus(materialKey)}
            onChangeText={handleMaterialChange}
            onBlur={() => onItemQuantityBlur(materialKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
          <PricingInputField
            key={`custom-labor-${selectedUnit}-${validBasis ? 'rate' : 'total'}`}
            label="Labor"
            value={laborValue}
            helper={unitRateHelper(laborValue, validBasis)}
            basis={validBasis}
            prefix="$"
            placeholder={validBasis ? `Labor $/${formatUnitLabel(selectedUnit)}` : 'Labor total'}
            defaultInputMode={validBasis ? 'rate' : 'total'}
            onFocus={() => onItemQuantityFocus(laborKey)}
            onChangeText={handleLaborChange}
            onBlur={() => onItemQuantityBlur(laborKey)}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
          {splitTotal ? (
            <PricingSplitRow
              label="Total"
              value={formatDraftMoney(Number(splitTotal))}
              darkMode={darkMode}
              Colors={Colors}
            />
          ) : null}
        </>
      ) : null}
      {hasSplitPricing || hasTotalOnlyPricing ? (
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={applying}
          onPress={() => {
            setPricingEditorOpen(false);
            setTimeout(() => {
              Keyboard.dismiss();
              onSavePricing?.();
            }, 180);
          }}
          style={[styles.savePricingBtn, applying && styles.primaryBtnDisabled]}
        >
          <Text style={styles.savePricingBtnText}>Save pricing</Text>
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
  return buildNormalizedScopeMeasurementsFromInput(input, { notes, templateKey });
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
  const materialRate = Number(average.material) > 0 ? Number(average.material) : 0;
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
  return Math.abs(materialScale - laborScale) / Math.max(materialScale, laborScale) < 0.02;
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
    /national average/i.test(String(block?.rateSourceLabel || ''));
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
  const nationalRates = nationalAverageUnitRates(itemId, unit || block?.basis?.unit);
  if (nationalRates) return nationalRates;

  if (!block || !(basisQty > 0)) return null;
  const materialBucket =
    block.costBuckets?.find((b) => b.key === 'material' || b.key === 'equipment') ?? null;
  const laborBucket = block.costBuckets?.find((b) => b.key === 'labor') ?? null;
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

  // Non-catalog totals already in the editor → treat as custom $/unit.
  if (
    params.quantity > 0 &&
    (params.materialTotal > 0 || params.laborTotal > 0) &&
    !(catalogRates && totalsMatchUnitRates(params.materialTotal, params.laborTotal, catalogRates))
  ) {
    // Empty legs still fall back to catalog when available.
    return {
      materialRate:
        params.materialTotal > 0
          ? roundMoney2(params.materialTotal / params.quantity)
          : catalogRates?.materialRate ?? null,
      laborRate:
        params.laborTotal > 0
          ? roundMoney2(params.laborTotal / params.quantity)
          : catalogRates?.laborRate ?? null,
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
  focusQuantityField: (targetItemId: string, field?: 'count' | 'allowance') => void;
  blurQuantityField: (targetItemId: string, field?: 'count' | 'allowance') => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
  splitTotalOnly?: boolean;
  /** Flat $ mat/lab vs takeoff-linked qty with optional $/unit. */
  entryMode?: PricingEntryMode;
  getPendingUpdatesRef?: React.MutableRefObject<
    (() => Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>) | null
  >;
}) {
  const lockedRatesRef = useRef<{ material: number | null; labor: number | null }>({
    material: null,
    labor: null,
  });
  const lastBasisQtyRef = useRef<number | null>(null);
  const didPrefillRef = useRef(false);
  /** True only after the contractor types Material/Labor — not after catalog prefill. */
  const userEditedRatesRef = useRef(false);
  const [basisFocused, setBasisFocused] = useState(false);
  const [basisDraft, setBasisDraft] = useState(pricingBasisValue);

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
      const { materialRate, laborRate } = scaleRatesForQuantity(nextQty, previousQty);
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
        if (materialRate != null) lockedRatesRef.current.material = materialRate;
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
            (laborRate != null && laborRate > 0 ? laborRate * effectiveBasisQty : 0);
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
    const suggestedUnit = String(suggestedBlock?.basis?.unit || '').toLowerCase();
    const editorUnit = String(basisUnit || pricingBasis?.unit || '').toLowerCase();
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
        Math.abs(suggestedBasisQty - effectiveBasisQty) / suggestedBasisQty > 0.02);
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
    const enteredTakeoff = entryMode === 'takeoff' && previousEntryModeRef.current !== 'takeoff';
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

    const quantity = effectiveBasisQty > 0 ? effectiveBasisQty : suggestedBasisQty;
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
      ((rates.materialRate != null && rates.materialRate > 0 ? rates.materialRate : 0) +
        (rates.laborRate != null && rates.laborRate > 0 ? rates.laborRate : 0)) *
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
      { itemId: sqftBasisKey, quantity: text, unit: basisUnit, quantitySource: 'user_entered' },
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

    const { materialRate, laborRate } = scaleRatesForQuantity(nextQty, prevQty);
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
      materialRate != null && materialRate > 0 ? roundMoney2(materialRate * nextQty) : parseMoneyAmount(materialValue);
    const laborTotal =
      laborRate != null && laborRate > 0 ? roundMoney2(laborRate * nextQty) : parseMoneyAmount(laborValue);
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
    const updates: Array<{ itemId: string; quantity: string; unit?: string }> = [
      { itemId: materialKey, quantity: text, unit: 'allowance' },
    ];
    const split = (amount > 0 ? amount : 0) + (laborAmount > 0 ? laborAmount : 0);
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
    const updates: Array<{ itemId: string; quantity: string; unit?: string }> = [
      { itemId: laborKey, quantity: text, unit: 'allowance' },
    ];
    const split = (materialAmount > 0 ? materialAmount : 0) + (amount > 0 ? amount : 0);
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
    entryMode === 'takeoff' && !splitTotalOnly && effectiveBasisQty > 0 && !basisFocused
      ? { quantity: effectiveBasisQty, unit: pricingBasis?.unit || basisUnit }
      : null;

  const showTakeoffBasis = entryMode === 'takeoff' && !splitTotalOnly;

  return (
    <>
      {splitTotalOnly ? (
        <PricingInputField
          label="Total"
          value={splitTotal != null ? String(splitTotal) : ''}
          prefix="$"
          placeholder="0"
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
          placeholder={pricingBasis ? String(pricingBasis.quantity) : `Enter ${basisUnitLabel}`}
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
          onChangeText={(text) => {
            setBasisDraft(text);
            // Scale mat/lab live while typing so count 1/2/3 updates Total immediately.
            if (parseMoneyAmount(text) > 0) {
              handleBasisChange(text);
            }
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
      <PricingMatLabRow
        material={
          <PricingInputField
            label="Material"
            value={materialValue}
            helper={unitRateHelper(materialValue, editorBasis)}
            basis={editorBasis}
            prefix="$"
            placeholder={editorBasis ? `$/${basisUnitLabel}` : '0'}
            defaultInputMode="total"
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
            label="Labor"
            value={laborValue}
            helper={unitRateHelper(laborValue, editorBasis)}
            basis={editorBasis}
            prefix="$"
            placeholder={editorBasis ? `$/${basisUnitLabel}` : '0'}
            defaultInputMode="total"
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
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 12, fontWeight: '600' }}>
            Total
          </Text>
          <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 15, fontWeight: '800' }}>
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
    if (itemId === 'drywall' || itemId === 'patch_repair' || itemId === 'paint_repair') {
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
    <PricingInputField
      label={label}
      value={focused ? draft : value}
      suffix={formatCountFieldSuffix(unit) ?? undefined}
      placeholder="0"
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
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
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
  const [electricalQuantityEditorOpen, setElectricalQuantityEditorOpen] = useState(false);
  const [focusedPricingField, setFocusedPricingField] = useState<string | null>(null);
  const [pricingModeOverride, setPricingModeOverride] = useState<AllowanceOrSplitMode | null>(null);
  const [pricingEntryModeOverride, setPricingEntryModeOverride] = useState<PricingEntryMode | null>(null);
  const pricingEditorPendingRef = useRef<
    (() => Array<{
      itemId: string;
      quantity: string;
      unit?: string;
      quantitySource?: 'user_entered' | 'suggested_prefill';
    }>) | null
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

  React.useEffect(() => {
    if (pricingEditorRequest?.itemId === itemId) {
      setPricingEditorOpen(true);
      onPricingEditorRequestHandled?.();
    }
  }, [pricingEditorRequest, itemId, onPricingEditorRequestHandled]);
  if (!inScope) return null;

  const norm = buildNormFromInput(measurementsInput, originalNotes, templateKey);
  let resolved = resolveChecklistItemQuantity(itemId, norm, {
    choiceId,
    templateKey,
    notes: originalNotes,
  });
  if (rule?.dualAllowanceField) {
    resolved = overlayDualRatePricingDisplay(itemId, resolved, norm, originalNotes, templateKey);
  }
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
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const focusQuantityField = (targetItemId: string, field: 'count' | 'allowance' = 'count') => {
    setFocusedPricingField(`${targetItemId}:${field}`);
    onItemQuantityFocus(targetItemId, field);
  };
  const blurQuantityField = (targetItemId: string, field: 'count' | 'allowance' = 'count') => {
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
    onClearSuggestedPrefill?.(itemId, pendingUpdates.length ? pendingUpdates : undefined);
  };

  if (rule.dualAllowanceField) {
    const fieldLabels = getScopeQuantityFieldLabels(itemId);
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
      if (showEditor || !originalNotes?.trim() || hasUserSelectedPricing) return resolved;
      if (resolved.dualMaterial && resolved.dualLabor) return resolved;
      const fromNotes = resolveDualRatePricingDisplayFromNotes(
        itemId,
        measurementsInput,
        originalNotes,
        templateKey
      );
      return fromNotes ? { ...resolved, ...fromNotes, showInput: true } : resolved;
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
        choiceId
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
        intelligence.formula?.formulaKey === 'countertop_area_from_cabinet_lf' &&
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
          onItemQuantityChange(itemId, String(block.basis.quantity), 'count', block.basis.unit);
        }
        onItemQuantityChange(itemId, String(block.total), 'allowance', 'allowance');
        if (!block.lumpSumOnly) {
          onItemQuantityChange(materialKey, String(block.material), 'count', 'allowance');
          onItemQuantityChange(laborKey, String(block.labor), 'count', 'allowance');
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
        const countIsLivingAreaFallback = countUnit === 'sqft' || countUnit === 'living_sqft';
        if (resolved.dualCount && !countIsLivingAreaFallback) {
          onItemQuantityChange(itemId, String(resolved.dualCount.quantity), 'count', resolved.dualCount.unit);
        }
        if (resolved.dualAllowance) {
          onItemQuantityChange(itemId, String(resolved.dualAllowance.quantity), 'allowance', resolved.dualAllowance.unit);
        }
        if (resolved.dualMaterial) {
          onItemQuantityChange(materialKey, String(resolved.dualMaterial.quantity), 'count', 'allowance');
        }
        if (resolved.dualLabor) {
          onItemQuantityChange(laborKey, String(resolved.dualLabor.quantity), 'count', 'allowance');
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
      return (
        <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
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
                  onClearAcceptedPricing ? () => onClearAcceptedPricing(itemId) : undefined
                }
                onScopeGapResolutionsChange={onScopeGapResolutionsChange}
                onScopeGapPriceSeparately={(componentKey, component, benchmarkAssumption, benchmarkProfile) =>
                  onScopeGapPriceSeparately?.(itemId, component, benchmarkAssumption, benchmarkProfile)
                }
                onScopeGapIncludeInParentPrice={(componentKey, component, addonAmount, benchmarkAssumption, benchmarkProfile) =>
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
                  onUsePricing={() => applySuggestedPricingBlock(suggestedBudgetSplit)}
                  itemId={itemId}
                  quantitySource={displayResolved.quantitySource}
                  hasPrimaryTakeoff={Boolean(
                    displayResolved.quantity != null &&
                      displayResolved.quantity > 0 &&
                      displayResolved.quantitySource !== 'missing' &&
                      displayResolved.quantitySource !== 'default_assumption'
                  )}
                  livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
                  confidenceLabel={intelligence?.pricing?.confidenceLabel}
                  hasCurrentPricing
                />
              ) : null}
            </>
          ) : (
            <>
              {displayResolved.dualCount ? (
                <PricingAmountRow
                  value={formatDualCountQuantity(
                    displayResolved.dualCount.quantity,
                    fieldLabels?.countUnit || displayResolved.dualCount.unit
                  )}
                  label={quantityRowSourceLabel}
                  pill={displayResolved.quantitySource === 'notes' ? <SourcePill kind="notes" /> : undefined}
                  emphasized
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {displayResolved.dualMaterial ? (
                <PricingSplitRow
                  label="Material"
                  value={formatDraftMoney(displayResolved.dualMaterial.quantity)}
                  helper={unitRateHelper(String(displayResolved.dualMaterial.quantity), displayResolved.dualCount)}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {displayResolved.dualLabor ? (
                <PricingSplitRow
                  label="Labor"
                  value={formatDraftMoney(displayResolved.dualLabor.quantity)}
                  helper={unitRateHelper(String(displayResolved.dualLabor.quantity), displayResolved.dualCount)}
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {displayResolved.dualAllowance ? (
                <PricingSplitRow
                  label={
                    displayResolved.dualMaterial || displayResolved.dualLabor
                      ? 'Total'
                      : fieldLabels?.allowance || 'Allowance'
                  }
                  value={formatDraftMoney(displayResolved.dualAllowance.quantity)}
                  pill={
                    !displayResolved.dualMaterial && !displayResolved.dualLabor && displayResolved.quantitySource === 'notes' ? (
                      <SourcePill kind="notes" />
                    ) : undefined
                  }
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}
              {displayResolved.quantitySource === 'notes' && (displayResolved.dualMaterial || displayResolved.dualLabor) ? (
                <View style={[styles.pricingRowGap, { alignItems: 'flex-end' }]}>
                  <SourcePill kind="notes" />
                </View>
              ) : null}
              <ScopeIntelligenceNotice
                intelligence={intelligence}
                Colors={Colors}
                darkMode={darkMode}
                compact
                pricingCardOwnsStatus={!hideSuggestion && Boolean(suggestedBudgetSplit)}
                onUseCalculatedQuantity={onUseCalculatedQuantity}
                onRevertCalculatedQuantity={onRevertCalculated}
                calculatedRevertLabel={calculatedRevertLabel}
              />
              {!hideSuggestion && suggestedBudgetSplit ? (
                <SuggestedBudgetSplitRows
                  block={suggestedBudgetSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() => applySuggestedPricingBlock(suggestedBudgetSplit)}
                  itemId={itemId}
                  quantitySource={displayResolved.quantitySource}
                  hasPrimaryTakeoff={Boolean(
                    displayResolved.quantity != null &&
                      displayResolved.quantity > 0 &&
                      displayResolved.quantitySource !== 'missing' &&
                      displayResolved.quantitySource !== 'default_assumption'
                  )}
                  livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
                  confidenceLabel={intelligence?.pricing?.confidenceLabel}
                />
              ) : null}
              {isSavedPricingBlock(suggestedComparisonSplit) ? (
                <ComparisonToggle
                  block={suggestedComparisonSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
                  itemId={itemId}
                  quantitySource={displayResolved.quantitySource}
                  hasPrimaryTakeoff={Boolean(
                    displayResolved.quantity != null &&
                      displayResolved.quantity > 0 &&
                      displayResolved.quantitySource !== 'missing' &&
                      displayResolved.quantitySource !== 'default_assumption'
                  )}
                  livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
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
                  editAction={
                    itemId === 'electrical' ? (
                      <EditQuantityLink onPress={() => setPricingEditorOpen(true)} stretch />
                    ) : (
                      <EditQuantityLink onPress={openPricingEditor} stretch />
                    )
                  }
                />
              ) : (
                <ScopePricingSecondaryActions
                  edit={
                    itemId === 'electrical' ? (
                      <EditQuantityLink onPress={() => setPricingEditorOpen(true)} />
                    ) : (
                      <EditQuantityLink onPress={openPricingEditor} />
                    )
                  }
                />
              )}
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
        ? { fill: null as SuggestedPricingBlock | null, comparison: rawPlanningSuggested.comparison }
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
      const softCostAllowance = isSoftCostAllowanceScope(itemId, rule.lumpSumOnly);
      // Pricing card owns the single “needs count” / planning status — don’t stack outer copy.
      const cardOwnsMissingCopy =
        Boolean(planningFill) &&
        (softCostAllowance ||
          [
            'windows',
            'windows_doors',
            'exterior_doors',
            'sliding_doors',
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
          onItemQuantityChange(itemId, String(block.basis.quantity), 'count', block.basis.unit);
        }
        onItemQuantityChange(itemId, String(block.total), 'allowance', 'allowance');
        if (!block.lumpSumOnly) {
          onItemQuantityChange(materialKey, String(block.material), 'count', 'allowance');
          onItemQuantityChange(laborKey, String(block.labor), 'count', 'allowance');
        }
        setTimeout(() => onItemQuantityBlur(itemId), 0);
      };
      return (
        <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
          {cardOwnsMissingCopy ? null : (
            <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
              {neededStatusLine}
            </Text>
          )}
          {!cardOwnsMissingCopy && planningHelperLine ? (
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
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
              hasPrimaryTakeoff={false}
              livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
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
              hasPrimaryTakeoff={false}
              livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
              confidenceLabel={planningIntelligence?.pricing?.confidenceLabel}
              editAction={<EditQuantityLink onPress={() => setPricingEditorOpen(true)} stretch />}
            />
          ) : (
            <ScopePricingSecondaryActions
              edit={<EditQuantityLink onPress={() => setPricingEditorOpen(true)} />}
            />
          )}
        </View>
      );
    }

    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
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
            suffix={formatCountFieldSuffix(fieldLabels?.countUnit || resolved.dualCount?.unit || 'each')}
            placeholder="0"
            embedded
            onFocus={() => focusQuantityField(itemId, 'count')}
            onChangeText={(text) => onItemQuantityChange(itemId, text, 'count')}
            onBlur={() => blurQuantityField(itemId, 'count')}
            Colors={Colors}
            darkMode={darkMode}
            applying={applying}
          />
          <PricingMatLabRow
            material={
              <PricingInputField
                label="Material"
                value={materialInput?.quantity ?? (resolved.dualMaterial ? String(resolved.dualMaterial.quantity) : '')}
                helper={unitRateHelper(
                  materialInput?.quantity ?? (resolved.dualMaterial ? String(resolved.dualMaterial.quantity) : ''),
                  resolved.dualCount ?? null
                )}
                basis={resolved.dualCount ?? null}
                prefix="$"
                placeholder="0"
                embedded
                onFocus={() => focusQuantityField(materialKey)}
                onChangeText={(text) => onItemQuantityChange(materialKey, text, 'count', 'allowance')}
                onBlur={() => blurQuantityField(materialKey)}
                Colors={Colors}
                darkMode={darkMode}
                applying={applying}
              />
            }
            labor={
              <PricingInputField
                label="Labor"
                value={laborInput?.quantity ?? (resolved.dualLabor ? String(resolved.dualLabor.quantity) : '')}
                helper={unitRateHelper(
                  laborInput?.quantity ?? (resolved.dualLabor ? String(resolved.dualLabor.quantity) : ''),
                  resolved.dualCount ?? null
                )}
                basis={resolved.dualCount ?? null}
                prefix="$"
                placeholder="0"
                embedded
                onFocus={() => focusQuantityField(laborKey)}
                onChangeText={(text) => onItemQuantityChange(laborKey, text, 'count', 'allowance')}
                onBlur={() => blurQuantityField(laborKey)}
                Colors={Colors}
                darkMode={darkMode}
                applying={applying}
              />
            }
          />
          {(() => {
            const mat = parseMoneyAmount(materialInput?.quantity ?? resolved.dualMaterial?.quantity);
            const lab = parseMoneyAmount(laborInput?.quantity ?? resolved.dualLabor?.quantity);
            const total = mat + lab;
            if (!(total > 0)) return null;
            return (
              <View style={styles.pricingEditorTotalRow}>
                <Text style={{ color: captionColor(darkMode, Colors), fontSize: 12, fontWeight: '600' }}>
                  Total
                </Text>
                <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 15, fontWeight: '800' }}>
                  {formatDraftMoney(total)}
                </Text>
              </View>
            );
          })()}
        </PricingEditorPanel>
      </View>
    );
  }

  const itemInput = measurementsInput.itemQuantities[itemId];
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
    ? (itemId === 'paint_repair' && String(templateKey || '').toLowerCase() === 'bathroom'
        ? resolveBathroomPaintRepairMissingLabel({
            bathroomPaintRepairScope: measurementsInput.bathroomPaintRepairScope,
            bathroomPaintRepairEntireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
            enteredTakeoffSqft: Number(
              String(measurementsInput.itemQuantities?.paint_repair?.quantity ?? '').replace(/,/g, '')
            ) || null,
          })?.replace(/^Needs\s+/i, '') ??
          missingStatusDisplayLabel(itemId, templateKey).replace(/^Needs\s+/i, '')
        : missingStatusDisplayLabel(itemId, templateKey).replace(/^Needs\s+/i, ''))
    : (templateKey && QUANTITY_NEEDED_LABELS_BY_TEMPLATE[templateKey]?.[itemId]) ||
      QUANTITY_NEEDED_LABELS[itemId] ||
      quantityNeededLabel(itemId, templateKey, rule.defaultUnit);
  const paintRepairMissing =
    itemId === 'paint_repair' && String(templateKey || '').toLowerCase() === 'bathroom'
      ? resolveBathroomPaintRepairMissingLabel({
          bathroomPaintRepairScope: measurementsInput.bathroomPaintRepairScope,
          bathroomPaintRepairEntireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
          enteredTakeoffSqft: Number(
            String(measurementsInput.itemQuantities?.paint_repair?.quantity ?? '').replace(/,/g, '')
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
    ...initialSuggestedFromCatalog,
    fill: initialSuggestedFromCatalog.fill || liveManualBlock,
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
    resolveAllowanceEditorPricingBasis(itemId, measurementsInput, templateKey) ??
    parseBudgetSplitBasis(suggestedBudgetSplit);
  const fallbackBasisUnit = resolveAllowanceEditorDefaultBasisUnit(itemId, templateKey, rule);
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
      onItemQuantityChange(sqftBasisKey, String(block.basis.quantity), 'count', block.basis.unit);
    }
    onItemQuantityChange(allowanceKey, String(block.total), 'count', 'allowance');
    if (!block.lumpSumOnly) {
      onItemQuantityChange(materialKey, String(block.material), 'count', 'allowance');
      onItemQuantityChange(laborKey, String(block.labor), 'count', 'allowance');
    }
    setPricingEditorOpen(false);
    setTimeout(() => onItemQuantityBlur(itemId), 0);
  };

  if (resolved.pricingReady && !showEditor) {
    if (resolved.combinedAllowanceRole === 'included_in_combined') {
      const combinedTotal = resolved.combinedAllowanceTotal ?? resolved.quantity ?? 0;
      return (
        <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
          <View style={[styles.includedPill, darkMode ? styles.includedPillDark : styles.includedPillLight]}>
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
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 4, lineHeight: 15 }}>
            Same ${Number(combinedTotal).toLocaleString()} combined total as cabinets above — not added
            again.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        {itemId === 'electrical' &&
        !electricalHasAppliedPricing &&
        !pricingEditorOpen &&
        (!resolved.pricingReady || electricalQuantityEditorOpen) ? (
          <PricingInputField
            label="Count"
            value={measurementsInput.itemQuantities[itemId]?.quantity ?? ''}
            suffix="each"
            embedded
            onFocus={() => onItemQuantityFocus(itemId, 'count')}
            onChangeText={(text) => onItemQuantityChange(itemId, text, 'count', 'each')}
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
            One allowance for cabinets and countertops — the countertop line below is included, not
            priced again.
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
              (parsePricingAmount(measurementsInput.itemQuantities[materialKey]?.quantity) || 0) +
              (parsePricingAmount(measurementsInput.itemQuantities[laborKey]?.quantity) || 0);
            const existingAllowance = parsePricingAmount(
              measurementsInput.itemQuantities[allowanceKey]?.quantity
            );
            if (existingSplit > 0 || existingAllowance != null) return;
            const total =
              resolved.quantity != null &&
              !isPlaceholderAllowancePricing(resolved.quantity, resolved.unit, itemId)
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
          const showInlineSqftTakeoff =
            !hideInlineTakeoff &&
            !accepted &&
            step2TierNeedsInlineTakeoffEntry(
              itemId,
              templateKey,
              resolved,
              Boolean(measurementsInput.pricingAcceptance?.[itemId])
            ) &&
            String(resolved.unit || rule.defaultUnit).toLowerCase() === 'sqft' &&
            !(
              itemId === 'paint_repair' &&
              String(templateKey || '').toLowerCase() === 'bathroom' &&
              resolveBathroomPaintRepairScope(measurementsInput.bathroomPaintRepairScope) === 'full_room'
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
              onCommit={(text) => {
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
                    onClearAcceptedPricing ? () => onClearAcceptedPricing(itemId) : undefined
                  }
                  onScopeGapResolutionsChange={onScopeGapResolutionsChange}
                  onScopeGapPriceSeparately={(componentKey, component, benchmarkAssumption, benchmarkProfile) =>
                    onScopeGapPriceSeparately?.(itemId, component, benchmarkAssumption, benchmarkProfile)
                  }
                  onScopeGapIncludeInParentPrice={(componentKey, component, addonAmount, benchmarkAssumption, benchmarkProfile) =>
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
                    onUsePricing={() => applySuggestedPricingBlock(suggestedBudgetSplit)}
                    itemId={itemId}
                    quantitySource={resolved.quantitySource}
                    hasPrimaryTakeoff={Boolean(
                      resolved.quantity != null &&
                        resolved.quantity > 0 &&
                        resolved.quantitySource !== 'missing' &&
                        resolved.quantitySource !== 'default_assumption'
                    )}
                    livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
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
              ) : (
                <PricingAmountRow
                  value={formatResolvedQuantityDisplay(
                    resolved.quantity ?? 0,
                    resolved.unit,
                    resolved.quantitySource,
                    itemId
                  )}
                  pill={resolved.quantitySource === 'notes' ? <SourcePill kind="notes" /> : undefined}
                  label={quantityRowSourceLabel}
                  emphasized
                  darkMode={darkMode}
                  Colors={Colors}
                />
              )}
              <ScopeIntelligenceNotice
                intelligence={intelligence}
                Colors={Colors}
                darkMode={darkMode}
                compact
                pricingCardOwnsStatus={!hideSuggestion && Boolean(suggestedBudgetSplit)}
                onUseCalculatedQuantity={onUseCalculatedQuantity}
                onRevertCalculatedQuantity={onRevertCalculated}
                calculatedRevertLabel={calculatedRevertLabel}
              />
              {!hideSuggestion && suggestedBudgetSplit ? (
                <SuggestedBudgetSplitRows
                  block={suggestedBudgetSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() => applySuggestedPricingBlock(suggestedBudgetSplit)}
                  itemId={itemId}
                  quantitySource={resolved.quantitySource}
                  hasPrimaryTakeoff={Boolean(
                    resolved.quantity != null &&
                      resolved.quantity > 0 &&
                      resolved.quantitySource !== 'missing' &&
                      resolved.quantitySource !== 'default_assumption'
                  )}
                  livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
                  confidenceLabel={intelligence?.pricing?.confidenceLabel}
                />
              ) : null}
              {isSavedPricingBlock(suggestedComparisonSplit) ? (
                <ComparisonToggle
                  block={suggestedComparisonSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
                  itemId={itemId}
                  quantitySource={resolved.quantitySource}
                  hasPrimaryTakeoff={Boolean(
                    resolved.quantity != null &&
                      resolved.quantity > 0 &&
                      resolved.quantitySource !== 'missing' &&
                      resolved.quantitySource !== 'default_assumption'
                  )}
                  livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
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
                  editAction={
                    itemId === 'electrical' ? (
                      <EditQuantityLink onPress={() => setPricingEditorOpen(true)} stretch />
                    ) : (
                      <EditQuantityLink onPress={openPricingEditor} stretch />
                    )
                  }
                />
              ) : (
                <ScopePricingSecondaryActions
                  edit={
                    itemId === 'electrical' ? (
                      <EditQuantityLink onPress={() => setPricingEditorOpen(true)} />
                    ) : (
                      <EditQuantityLink onPress={openPricingEditor} />
                    )
                  }
                />
              )}
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
      isGrossFlooringDerivedFromLiving({ flooringSqft: flooringSf, floorAreaSqft: livingSf });
    const softCostAllowance = isSoftCostAllowanceScope(itemId, rule.lumpSumOnly);
    const hidePlanningSuggestion =
      suppressSuggestedPricing ||
      shouldHideSuggestedPanel({
      itemId,
      itemQuantities: measurementsInput.itemQuantities,
      pricingAcceptance: measurementsInput.pricingAcceptance,
      suggestedTotal: suggestedBudgetSplit?.total ?? null,
    });
    // Soft-cost suggestion cards already own the "Needs allowance" copy (same pattern as Excavation).
    const cardOwnsMissingCopy = Boolean(suggestedBudgetSplit) && softCostAllowance;

    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        {showGrossFloorPlanning ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '700' }}>
              Gross interior floor area: {livingSf.toLocaleString()} SF
            </Text>
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 2 }}>
              Source: Derived from declared living area
            </Text>
            <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
              Status: Needs finish allocation and material-specific takeoff
            </Text>
          </View>
        ) : hideInlineTakeoff || cardOwnsMissingCopy || suggestedBudgetSplit ? null : (
          <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
            {neededStatusLine}
          </Text>
        )}
        {!hideInlineTakeoff && !showGrossFloorPlanning && !cardOwnsMissingCopy && rule.quantityHelper ? (
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
            {rule.quantityHelper}
          </Text>
        ) : null}
        {!hideInlineTakeoff && step2TierNeedsInlineTakeoffEntry(
          itemId,
          templateKey,
          resolved,
          Boolean(measurementsInput.pricingAcceptance?.[itemId])
        ) &&
        !(
          itemId === 'paint_repair' &&
          String(templateKey || '').toLowerCase() === 'bathroom' &&
          resolveBathroomPaintRepairScope(measurementsInput.bathroomPaintRepairScope) === 'full_room'
        ) ? (
          <InlineTakeoffCountInput
            label={inlineTakeoffQuantityLabel(itemId, templateKey, resolved.unit || rule.defaultUnit)}
            value={itemInput?.quantity ?? ''}
            unit={resolved.unit || rule.defaultUnit}
            onFocus={() => focusQuantityField(itemId, 'count')}
            onCommit={(text) => {
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
            hasPrimaryTakeoff={false}
            livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
            confidenceLabel={intelligence?.pricing?.confidenceLabel}
          />
        ) : null}
        {isSavedPricingBlock(suggestedComparisonSplit) ? (
          <ComparisonToggle
            block={suggestedComparisonSplit}
            Colors={Colors}
            darkMode={darkMode}
            onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
            itemId={itemId}
            quantitySource={resolved.quantitySource}
            hasPrimaryTakeoff={false}
            livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
            confidenceLabel={intelligence?.pricing?.confidenceLabel}
            editAction={<EditQuantityLink onPress={() => setPricingEditorOpen(true)} stretch />}
          />
        ) : (
          <ScopePricingSecondaryActions
            edit={<EditQuantityLink onPress={() => setPricingEditorOpen(true)} />}
          />
        )}
      </View>
    );
  }

  const lumpSumValue =
    allowanceInput?.quantity ??
    (itemInput?.unit === 'allowance' || itemInput?.unit === 'lump_sum' ? itemInput?.quantity ?? '' : '');
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
      ? pricingModeOverride ?? inferredPricingMode
      : null;
  const showAllowanceEditor = rule.lumpSumOnly || pricingMode === 'allowance';

  const handlePricingModeChange = (next: AllowanceOrSplitMode) => {
    setPricingModeOverride(next);
    if (next === 'allowance') {
      // Keep any existing allowance total; clear split legs so mode sticks.
      const updates: Array<{ itemId: string; quantity: string; unit?: string }> = [
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
      onBatchItemQuantityChange([{ itemId: allowanceKey, quantity: '', unit: 'allowance' }]);
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
    <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
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
            label="Allowance"
            value={lumpSumValue}
            prefix="$"
            placeholder="Enter allowance"
            embedded
            onFocus={() => focusQuantityField(allowanceKey)}
            onChangeText={(text) => onItemQuantityChange(allowanceKey, text, 'count', 'allowance')}
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
      {showEditorSuggestedPanel && suggestedBudgetSplit && !showAllowanceEditor ? (
        <SuggestedBudgetSplitRows
          block={suggestedBudgetSplit}
          Colors={Colors}
          darkMode={darkMode}
          onUsePricing={() => applySuggestedPricingBlock(suggestedBudgetSplit)}
          itemId={itemId}
          quantitySource={resolved.quantitySource}
          hasPrimaryTakeoff={Boolean(
            resolved.quantity != null &&
              resolved.quantity > 0 &&
              resolved.quantitySource !== 'missing' &&
              resolved.quantitySource !== 'default_assumption'
          )}
          livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
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
          hasPrimaryTakeoff={Boolean(
            resolved.quantity != null &&
              resolved.quantity > 0 &&
              resolved.quantitySource !== 'missing' &&
              resolved.quantitySource !== 'default_assumption'
          )}
          livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
          confidenceLabel={intelligence?.pricing?.confidenceLabel}
          hasCurrentPricing={editorMoneyTotal > 0}
        />
      ) : null}
      {isSavedPricingBlock(suggestedComparisonSplit) ? (
        <ComparisonToggle
          block={suggestedComparisonSplit}
          Colors={Colors}
          darkMode={darkMode}
          onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
          itemId={itemId}
          quantitySource={resolved.quantitySource}
          hasPrimaryTakeoff={Boolean(
            resolved.quantity != null &&
              resolved.quantity > 0 &&
              resolved.quantitySource !== 'missing' &&
              resolved.quantitySource !== 'default_assumption'
          )}
          livingSf={Number(String(measurementsInput.floorAreaSqft || '').replace(/,/g, '')) || null}
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
  let borderColor = darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line;
  let backgroundColor = darkMode ? 'rgba(255,255,255,0.04)' : 'transparent';
  let textColor = captionColor(darkMode, Colors);

  if (active) {
    if (variant === 'yes') {
      borderColor = '#22c55e';
      backgroundColor = '#22c55e';
      textColor = '#0f172a';
    } else if (variant === 'unsure') {
      borderColor = 'rgba(251,191,36,0.55)';
      backgroundColor = 'transparent';
      textColor = '#d4a017';
    } else {
      borderColor = darkMode ? 'rgba(255,255,255,0.2)' : Colors.line;
      backgroundColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
      textColor = Colors.text;
    }
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.choiceChip, { borderColor, backgroundColor }]}
    >
      <Text style={{ color: textColor, fontSize: 12, fontWeight: active ? '800' : '600' }}>{label}</Text>
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
  let borderColor = darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line;
  let backgroundColor = darkMode ? 'rgba(255,255,255,0.04)' : 'transparent';
  let textColor = captionColor(darkMode, Colors);

  if (active) {
    if (variant === 'yes') {
      borderColor = '#22c55e';
      backgroundColor = '#22c55e';
      textColor = '#0f172a';
    } else {
      borderColor = darkMode ? 'rgba(255,255,255,0.2)' : Colors.line;
      backgroundColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
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
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
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
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);

  return (
    <View style={embedded ? styles.qmEmbeddedScopeBlock : scopeCardStyle(tier, item, Colors, darkMode)}>
      <ScopeItemTitleRow
        label={checklistDisplayLabel(item, templateKey)}
        noteBadge={noteBadge}
        darkMode={darkMode}
        Colors={Colors}
      />
      {helper ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 3, lineHeight: 15 }}>
          {helper}
        </Text>
      ) : null}
      <View style={styles.includedPillRow}>
        <View style={[styles.includedPill, darkMode ? styles.includedPillDark : styles.includedPillLight]}>
          <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>Included · labor + materials</Text>
        </View>
      </View>
      <QuantitySection
        itemId={item.id}
        inScope
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
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
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
  onBathroomPaintRepairScopeChange?: (scope: BathroomPaintRepairScope | null) => void;
  onBathroomDrywallPaintCombinedAssemblyChange?: (useCombined: boolean | null) => void;
  onBathroomInteriorPaintMobilizationChange?: (
    mobilization: BathroomInteriorPaintMobilization | null
  ) => void;
  onBathroomInteriorPaintSurfaceChange?: (surface: BathroomInteriorPaintSurface | null) => void;
  onBathroomInteriorPaintConditionChange?: (
    condition: BathroomInteriorPaintCondition | null
  ) => void;
  onBathroomGlassDoorStyleChange?: (style: BathroomGlassDoorStyle | null) => void;
  scopeChecklistItems?: ScopeChecklistItem[];
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);
  const isCustom = isCustomScopeItem(item);
  const helper = isCustom ? 'Added manually. Price as total, sqft, or LF.' : checklistDisplayHelper(item, templateKey);
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(item.label);
  const [plumbingRoughPromptExpanded, setPlumbingRoughPromptExpanded] = useState(false);
  const showPlumbingRoughAccessPrompt =
    item.id === 'plumbing_rough' &&
    item.state === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const plumbingRoughPriceApplied = Boolean(measurementsInput.pricingAcceptance?.plumbing_rough);
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
    plumbingExposedSource: measurementsInput.bathroomShowerRoughPlumbingExposedSource,
    floorConstruction: measurementsInput.bathroomShowerRoughFloorConstruction,
    slabWorkRequired: measurementsInput.bathroomShowerRoughSlabWorkRequired,
    wallAccess: measurementsInput.bathroomShowerRoughWallAccess,
    legacyAccessType:
      measurementsInput.bathroomShowerRoughAccessType ??
      measurementsInput.bathroomToiletRelocateFloorType,
    checklistItems: scopeChecklistItems,
  });
  const storedFixtureType = measurementsInput.bathroomShowerRoughFixtureType ?? null;
  const storedPlumbingWorkType = measurementsInput.bathroomShowerRoughWorkType ?? null;
  const storedPlumbingExposed = measurementsInput.bathroomShowerRoughPlumbingExposed ?? null;
  const storedPlumbingExposedSource = measurementsInput.bathroomShowerRoughPlumbingExposedSource ?? null;
  const storedFloorConstruction = measurementsInput.bathroomShowerRoughFloorConstruction ?? null;
  const storedSlabWork = measurementsInput.bathroomShowerRoughSlabWorkRequired ?? null;
  const showSlabWorkPrompt = shouldShowShowerRoughSlabWorkPrompt(showerRoughCtx);
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
    item.state === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const storedPaintRepairScope = measurementsInput.bathroomPaintRepairScope ?? null;
  const resolvedPaintRepairScope = resolveBathroomPaintRepairScope(storedPaintRepairScope);
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
  const combinedEligible = resolvedPaintRepairScope === 'affected_area' || !resolvedPaintRepairScope;
  const useCombinedAssembly =
    combinedEligible && measurementsInput.bathroomDrywallPaintUseCombinedAssembly !== false;
  const userPaintRepairSqft = Number(
    String(measurementsInput.itemQuantities?.paint_repair?.quantity ?? '').replace(/,/g, '')
  );
  const entireRoomPaintSqft =
    resolvedPaintRepairScope === 'full_room' && userPaintRepairSqft > 0 ? userPaintRepairSqft : 0;
  const patchRepairSqft =
    resolvedPaintRepairScope === 'affected_area' && userPaintRepairSqft > 0
      ? userPaintRepairSqft
      : 0;
  const combinedSummary =
    showDrywallPaintOptions
      ? buildBathroomDrywallPaintCombinedSummary({
          checklistItems: scopeChecklistItems,
          showerWallTileSqft: Number(measurementsInput.showerWallTileSqft) || null,
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
    item.state === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const showDrywallPatchSqftHint =
    showPaintRepairScopePrompt &&
    resolvedPaintRepairScope === 'affected_area' &&
    !(Number.isFinite(patchRepairSqft) && patchRepairSqft > 0);
  const showFullRoomPaintSqftHint =
    showPaintRepairScopePrompt &&
    resolvedPaintRepairScope === 'full_room' &&
    !(Number.isFinite(entireRoomPaintSqft) && entireRoomPaintSqft > 0);
  const paintRepairScopeApplied = Boolean(measurementsInput.pricingAcceptance?.paint_repair);
  const [paintRepairPromptExpanded, setPaintRepairPromptExpanded] = useState(false);
  const showPaintRepairQuestions =
    showPaintRepairScopePrompt && (!paintRepairScopeApplied || paintRepairPromptExpanded);
  const showPaintRepairCollapsed =
    showPaintRepairScopePrompt && paintRepairScopeApplied && !paintRepairPromptExpanded;
  const paintInteriorOverlapOnCard = detectDrywallPaintInteriorOverlap({
    checklistItems: scopeChecklistItems,
    paintRepairScope: storedPaintRepairScope,
    paintRepairEntireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
  });
  const separateDrywallPatchFill = useMemo(() => {
    if (!showPaintRepairScopePrompt || useCombinedAssembly || resolvedPaintRepairScope === 'full_room') {
      return null;
    }
    if (!(patchRepairSqft > 0)) return null;
    if (measurementsInput.pricingAcceptance?.drywall) return null;
    return (
      resolveBathroomDrywallPatchSuggestedPricing({
        checklistItems: scopeChecklistItems,
        quantity: patchRepairSqft,
        showerWallTileSqft: Number(measurementsInput.showerWallTileSqft) || null,
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
        showerWallTileSqft: Number(measurementsInput.showerWallTileSqft) || null,
        paintRepairScope: storedPaintRepairScope,
        paintRepairEntireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
        entireRoomSqft: entireRoomPaintSqft > 0 ? entireRoomPaintSqft : null,
        interiorPaintMobilization: measurementsInput.bathroomInteriorPaintMobilization,
        interiorPaintSurface: measurementsInput.bathroomInteriorPaintSurface,
        interiorPaintCondition: measurementsInput.bathroomInteriorPaintCondition,
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
    item.state === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const interiorPaintScopeApplied = Boolean(
    measurementsInput.pricingAcceptance?.interior_paint || measurementsInput.pricingAcceptance?.paint
  );
  const [interiorPaintPromptExpanded, setInteriorPaintPromptExpanded] = useState(false);
  const showInteriorPaintQuestions =
    showInteriorPaintScopePrompt && (!interiorPaintScopeApplied || interiorPaintPromptExpanded);
  const showInteriorPaintCollapsed =
    showInteriorPaintScopePrompt && interiorPaintScopeApplied && !interiorPaintPromptExpanded;
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
    item.state === 'included' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const glassDoorStyleApplied = Boolean(measurementsInput.pricingAcceptance?.glass_door);
  const [glassDoorPromptExpanded, setGlassDoorPromptExpanded] = useState(false);
  const showGlassDoorQuestions =
    showGlassDoorStylePrompt && (!glassDoorStyleApplied || glassDoorPromptExpanded);
  const showGlassDoorCollapsed =
    showGlassDoorStylePrompt && glassDoorStyleApplied && !glassDoorPromptExpanded;
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
    <View style={scopeCardStyle(tier, item, Colors, darkMode)}>
      {isCustom && renaming ? (
        <View style={styles.customRenameRow}>
          <TextInput
            value={draftLabel}
            onChangeText={setDraftLabel}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveRename}
            placeholder="Scope item name"
            placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
            style={[
              styles.customRenameInput,
              {
                color: Colors.text,
                borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
              },
            ]}
          />
          <TouchableOpacity onPress={saveRename} activeOpacity={0.75} style={styles.customRenameAction}>
            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '800' }}>Save</Text>
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
                  <Text style={{ color: '#60a5fa', fontSize: 10, fontWeight: '700' }}>Custom</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setRenaming(true)}
                  disabled={applying}
                  activeOpacity={0.75}
                  style={styles.customIconBtn}
                >
                  <Ionicons name="pencil-outline" size={15} color="#60a5fa" />
                </TouchableOpacity>
                {onDelete ? (
                  <TouchableOpacity
                    onPress={onDelete}
                    disabled={applying}
                    activeOpacity={0.75}
                    style={styles.customIconBtn}
                  >
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
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
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 3, lineHeight: 15 }}>
          {helper}
        </Text>
      ) : null}
      <View style={styles.choiceRow}>
        <YesNoChip
          label="Yes"
          active={item.state === 'included'}
          variant="yes"
          onPress={() => {
            hapticTap();
            onSetState('included');
          }}
          Colors={Colors}
          darkMode={darkMode}
        />
        <YesNoChip
          label="No"
          active={item.state === 'excluded'}
          variant="no"
          onPress={() => {
            hapticTap();
            onSetState('excluded');
          }}
          Colors={Colors}
          darkMode={darkMode}
        />
        {!isCustom ? (
          <YesNoChip
            label="Not sure"
            active={item.state === 'unsure'}
            variant="unsure"
            onPress={() => {
              hapticTap();
              onSetState('unsure');
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
          accessibilityRole="button"
          accessibilityLabel="Edit shower rough-in conditions"
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
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
            <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>Edit</Text>
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
              accessibilityRole="button"
              accessibilityLabel="Done editing shower rough-in conditions"
            >
              <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 8, lineHeight: 15 }}>
            What fixture is being roughed in?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_SHOWER_ROUGH_FIXTURE_OPTIONS.map((opt) => {
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
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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

          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 12, marginBottom: 8, lineHeight: 15 }}>
            Is the plumbing staying in the same location?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_SHOWER_ROUGH_WORK_TYPE_OPTIONS.map((opt) => {
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
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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

          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 12, marginBottom: 8, lineHeight: 15 }}>
            Will remodel demolition expose the plumbing?
          </Text>
          {storedPlumbingExposedSource === 'demo_detected' && storedPlumbingExposed === 'exposed_by_demo' ? (
            <Text style={{ color: '#60a5fa', fontSize: 10, marginBottom: 8, lineHeight: 14, fontWeight: '600' }}>
              {SHOWER_ROUGH_DEMO_DETECTED_LABEL}
            </Text>
          ) : (
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 10, marginBottom: 8, lineHeight: 14 }}>
              On most shower remodels, demo removes tile and opens the wall — pick Yes unless the plumber must create separate access elsewhere.
            </Text>
          )}
          <View style={styles.choiceWrap}>
            {BATHROOM_SHOWER_ROUGH_PLUMBING_EXPOSED_OPTIONS.map((opt) => {
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
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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

          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 12, marginBottom: 8, lineHeight: 15 }}>
            What is the floor construction?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_SHOWER_ROUGH_FLOOR_OPTIONS.map((opt) => {
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
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 12, marginBottom: 8, lineHeight: 15 }}>
                Is concrete cutting or below-slab drain modification required?
              </Text>
              <View style={styles.choiceRow}>
                {BATHROOM_SHOWER_ROUGH_SLAB_WORK_OPTIONS.map((opt) => {
                  const active = storedSlabWork === opt.id;
                  return (
                    <YesNoChip
                      key={opt.id}
                      label={opt.label}
                      active={active}
                      variant={opt.id === 'yes' ? 'yes' : opt.id === 'no' ? 'no' : 'unsure'}
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
            <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 12, lineHeight: 16, fontWeight: '600' }}>
              {SHOWER_ROUGH_ACCESS_OVERLAP_WARNING}
            </Text>
          ) : null}

          {relocateOverlap.overlap ? (
            <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 12, lineHeight: 16, fontWeight: '600' }}>
              {SHOWER_ROUGH_OVERLAP_WARNING}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showDrywallPatchSqftHint ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 10, lineHeight: 16 }}>
          {formatBathroomDrywallPatchSqftHint({
            showerWallTileSqft: Number(measurementsInput.showerWallTileSqft) || null,
          })}
        </Text>
      ) : null}

      {showFullRoomPaintSqftHint ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 10, lineHeight: 16 }}>
          {formatBathroomFullRoomPaintSqftHint({
            wallPaintSqft: measurementsInput.wallPaintSqft,
            bathroomFloorSqft: measurementsInput.bathroomFloorSqft,
          })}
        </Text>
      ) : null}

      {showDrywallPaintOptions && combinedEligible ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 8, lineHeight: 15 }}>
            Use one combined repair assembly?
          </Text>
          <View style={styles.assemblyChoiceRow}>
            <AssemblyChoiceChip
              label={'Combined patch,\ntexture, prime & paint'}
              active={useCombinedAssembly}
              variant="yes"
              onPress={() => {
                hapticTap();
                onBathroomDrywallPaintCombinedAssemblyChange?.(useCombinedAssembly ? null : true);
              }}
              Colors={Colors}
              darkMode={darkMode}
            />
            <AssemblyChoiceChip
              label="Separate lines"
              active={!useCombinedAssembly}
              variant="no"
              onPress={() => {
                hapticTap();
                onBathroomDrywallPaintCombinedAssemblyChange?.(false);
              }}
              Colors={Colors}
              darkMode={darkMode}
            />
          </View>
          {combinedSummary && !useCombinedAssembly ? (
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 10, lineHeight: 16 }}>
              {`Combined planning allowance: $${combinedSummary.drywallTotal.toLocaleString()} drywall + $${combinedSummary.paintTotal.toLocaleString()} paint = $${combinedSummary.combinedTotal.toLocaleString()} (range $${combinedSummary.range.low.toLocaleString()}–$${combinedSummary.range.high.toLocaleString()}). ${DRYWALL_PAINT_COMBINED_SUMMARY_LABEL}`}
            </Text>
          ) : null}
          {combinedAssemblyOverlap ? (
            <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 10, lineHeight: 16, fontWeight: '600' }}>
              {DRYWALL_PAINT_COMBINED_OVERLAP_WARNING}
            </Text>
          ) : null}
          {interiorPaintOverlap ? (
            <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 10, lineHeight: 16, fontWeight: '600' }}>
              {DRYWALL_PAINT_INTERIOR_OVERLAP_WARNING}
            </Text>
          ) : null}
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 10, marginTop: 8, lineHeight: 14 }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={{ flex: 1, color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 16, fontWeight: '600' }}>
              {formatPaintRepairScopeSummary({
                localizedScope: storedPaintRepairScope,
                entireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
                legacyScope: storedPaintRepairScope,
              })}
            </Text>
            <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>Edit</Text>
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
              <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 8, lineHeight: 15 }}>
            What painting is required after the drywall repair?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_PAINT_REPAIR_SCOPE_OPTIONS.map((opt) => {
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
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 10, lineHeight: 15 }}>
              {PAINT_REPAIR_FULL_ROOM_NOTE}
            </Text>
          ) : null}
          {paintInteriorOverlapOnCard ? (
            <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 10, lineHeight: 16, fontWeight: '600' }}>
              {DRYWALL_PAINT_INTERIOR_OVERLAP_WARNING}
            </Text>
          ) : null}
        </View>
      ) : null}

      {separateLinesMergedBlock && separateLinesPaintFill ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 6, lineHeight: 15 }}>
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
            itemId="paint_repair"
            quantitySource="user"
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={{ flex: 1, color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 16, fontWeight: '600' }}>
              {[
                BATHROOM_INTERIOR_PAINT_MOBILIZATION_OPTIONS.find((opt) => opt.id === storedInteriorMobilization)
                  ?.label,
                BATHROOM_INTERIOR_PAINT_SURFACE_OPTIONS.find((opt) => opt.id === storedInteriorSurface)?.label,
                BATHROOM_INTERIOR_PAINT_CONDITION_OPTIONS.find((opt) => opt.id === storedInteriorCondition)?.label,
              ]
                .filter(Boolean)
                .join(' · ') || 'Interior paint scope selected'}
            </Text>
            <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>Edit</Text>
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
              <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 8, lineHeight: 15 }}>
            Is this area part of a larger painting scope?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_INTERIOR_PAINT_MOBILIZATION_OPTIONS.map((opt) => {
              const active = storedInteriorMobilization === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomInteriorPaintMobilizationChange?.(active ? null : opt.id);
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 12, marginBottom: 8, lineHeight: 15 }}>
            What surface is being painted?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_INTERIOR_PAINT_SURFACE_OPTIONS.map((opt) => {
              const active = storedInteriorSurface === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomInteriorPaintSurfaceChange?.(active ? null : opt.id);
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 12, marginBottom: 8, lineHeight: 15 }}>
            What is the painting condition?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_INTERIOR_PAINT_CONDITION_OPTIONS.map((opt) => {
              const active = storedInteriorCondition === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    onBathroomInteriorPaintConditionChange?.(active ? null : opt.id);
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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
            <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 10, lineHeight: 16, fontWeight: '600' }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={{ flex: 1, color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 16, fontWeight: '600' }}>
              {BATHROOM_GLASS_DOOR_STYLE_OPTIONS.find((opt) => opt.id === storedGlassDoorStyle)?.label ||
                'Shower door style selected'}
            </Text>
            <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>Edit</Text>
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
              <Text style={{ color: '#0f766e', fontSize: 12, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 8, lineHeight: 15 }}>
            What type of shower door?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_GLASS_DOOR_STYLE_OPTIONS.map((opt) => {
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
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 10, marginTop: 8, lineHeight: 14 }}>
            {GLASS_DOOR_DOOR_ONLY_NOTE}
          </Text>
        </View>
      ) : null}
      {isCustom ? (
        <CustomScopePricingSection
          itemId={item.id}
          inScope={item.state === 'included'}
          measurementsInput={measurementsInput}
          onItemQuantityChange={onItemQuantityChange}
          onItemQuantityBlur={onItemQuantityBlur}
          onItemQuantityFocus={onItemQuantityFocus}
          onSavePricing={onSaveCustomPricing}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      ) : (
        <QuantitySection
          itemId={item.id}
          choiceId={item.choiceId}
          inScope={item.state === 'included'}
          templateKey={templateKey}
          originalNotes={originalNotes}
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
          suppressSuggestedPricing={paintRepairBundledPricing}
          scopeItemLabel={checklistDisplayLabel(item, templateKey)}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      )}
    </View>
  );
}

function multiChoicePriceRows(
  itemId: string,
  choiceIds: string[],
  quantity: number,
  itemQuantities: ScopeMeasurementsInputExtended['itemQuantities']
): Array<{ label: string; quantity: number; unitTotal: number; subtotal: number }> {
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
  };
  const itemRates = rates[itemId];
  if (!itemRates || !(quantity > 0)) return [];
  return choiceIds
    .filter((choiceId) => itemRates[choiceId] != null)
    .map((choiceId) => {
      const choiceQuantity = Number(itemQuantities?.[`${itemId}__${choiceId}`]?.quantity);
      const effectiveQuantity =
        Number.isFinite(choiceQuantity) && choiceQuantity > 0 ? choiceQuantity : quantity;
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
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
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
  const inScope = choiceIds.some((id) => id !== 'not_in_scope' && id !== 'unsure');
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);
  const wallWorkChoiceIds = choiceIds.filter((id) => id === 'remove' || id === 'add');
  const selectedQuantity = Number(measurementsInput.itemQuantities[item.id]?.quantity);
  const choicePricingRows = multiChoicePriceRows(
    item.id,
    choiceIds,
    selectedQuantity,
    measurementsInput.itemQuantities
  );
  const countChoiceItem = ['plumbing', 'electrical', 'lighting'].includes(item.id);
  const perOptionCountItem = countChoiceItem;
  const countChoiceRateIds: Record<string, string[]> = {
    plumbing: ['dishwasher_hookup', 'gas_existing_shutoff', 'gas_branch_line', 'rough_in'],
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
  };

  return (
    <View style={scopeCardStyle(tier, item, Colors, darkMode)}>
      <ScopeItemTitleRow
        label={checklistDisplayLabel(item, templateKey)}
        noteBadge={noteBadge}
        darkMode={darkMode}
        Colors={Colors}
      />
      {helper ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 3, lineHeight: 15 }}>
          {helper}
        </Text>
      ) : null}
      <View style={styles.choiceWrap}>
        {(item.options || []).map((opt) => {
          const active = choiceIds.includes(opt.id);
          const isUnsure = opt.id === 'unsure';
          const isExcluded = opt.id === 'not_in_scope';
          let borderColor = darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line;
          let backgroundColor = darkMode ? 'rgba(255,255,255,0.04)' : 'transparent';
          let textColor = captionColor(darkMode, Colors);

          if (active) {
            if (isUnsure) {
              borderColor = 'rgba(251,191,36,0.55)';
              textColor = '#d4a017';
            } else if (isExcluded) {
              borderColor = darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line;
              backgroundColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
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
              style={[styles.choiceChipWide, { borderColor, backgroundColor }]}
            >
              <Text
                style={{
                  color: textColor,
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
      {perOptionCountItem && inScope ? (
        choiceIds
          .filter((choiceId) => countChoiceRateIds[item.id]?.includes(choiceId))
          .map((choiceId) => {
            const label =
              item.options?.find((option) => option.id === choiceId)?.label || choiceId;
            const quantityKey = `${item.id}__${choiceId}`;
            return (
              <View key={quantityKey} style={{ marginTop: 10 }}>
                <PricingInputField
                  label={`${label} · count`}
                  value={measurementsInput.itemQuantities[quantityKey]?.quantity ?? '1'}
                  suffix="each"
                  embedded
                  onFocus={() => onItemQuantityFocus(quantityKey, 'count')}
                  onChangeText={(text) => onItemQuantityChange(quantityKey, text, 'count', 'each')}
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
            label="Count"
            value={
              measurementsInput.itemQuantities[item.id]?.quantity ||
              (selectedQuantity > 0 ? String(selectedQuantity) : '1')
            }
            suffix="each"
            embedded
            onFocus={() => onItemQuantityFocus(item.id, 'count')}
            onChangeText={(text) => onItemQuantityChange(item.id, text, 'count', 'each')}
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
            backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          }}
        >
          <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '800', marginBottom: 6 }}>
            Selected work pricing
          </Text>
          {choicePricingRows.map((row) => (
            <View
              key={row.label}
              style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
            >
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 12 }}>
                {row.label} · {row.quantity} each
              </Text>
              <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>
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
            <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '800' }}>
              Selected work total
            </Text>
            <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '800' }}>
              ${choicePricingRows.reduce((sum, row) => sum + row.subtotal, 0).toLocaleString()}
            </Text>
          </View>
        </View>
      ) : null}
      {item.id === 'walls_moving' ? (
        <>
          {wallWorkChoiceIds.map((wallChoiceId) => {
            const label =
              item.options?.find((option) => option.id === wallChoiceId)?.label || wallChoiceId;
            const quantityKey = `${item.id}__${wallChoiceId}`;
            return (
              <View key={quantityKey} style={{ marginTop: 10 }}>
                <PricingInputField
                  label={`${label} · linear feet`}
                  value={measurementsInput.itemQuantities[quantityKey]?.quantity ?? ''}
                  suffix="LF"
                  embedded
                  onFocus={() => onItemQuantityFocus(quantityKey, 'count')}
                  onChangeText={(text) => onItemQuantityChange(quantityKey, text, 'count', 'lf')}
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
  onApplySuggestedPricing?: (itemId: string, block: SuggestedPricingBlock) => void;
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
  const inScope = Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);
  const showToiletRelocateFloorPrompt =
    item.id === 'toilet' &&
    item.choiceId === 'relocating' &&
    String(templateKey || '').toLowerCase() === 'bathroom';
  const storedToiletRelocateFloor = measurementsInput.bathroomToiletRelocateFloorType ?? null;

  return (
    <View style={embedded ? styles.qmEmbeddedScopeBlock : scopeCardStyle(tier, item, Colors, darkMode)}>
      {!embedded ? (
        <ScopeItemTitleRow
          label={checklistDisplayLabel(item, templateKey)}
          noteBadge={noteBadge}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
      {helper ? (
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 3, lineHeight: 15 }}>
          {helper}
        </Text>
      ) : null}
      <View style={styles.choiceWrap}>
        {(item.options || []).map((opt) => {
          const active = item.choiceId === opt.id;
          const isUnsure = opt.id === 'unsure';
          const isExcluded = opt.id === 'not_in_scope';
          let borderColor = darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line;
          let backgroundColor = darkMode ? 'rgba(255,255,255,0.04)' : 'transparent';
          let textColor = captionColor(darkMode, Colors);

          if (active) {
            if (isUnsure) {
              borderColor = 'rgba(251,191,36,0.55)';
              textColor = '#d4a017';
            } else if (isExcluded) {
              borderColor = darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line;
              backgroundColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
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
                onSelect(opt.id);
              }}
              style={[styles.choiceChipWide, { borderColor, backgroundColor }]}
            >
              <Text
                style={{
                  color: textColor,
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
      {showToiletRelocateFloorPrompt ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 8, lineHeight: 15 }}>
            What type of floor is the toilet located on?
          </Text>
          <View style={styles.choiceWrap}>
            {BATHROOM_TOILET_RELOCATE_FLOOR_OPTIONS.map((opt) => {
              const active = storedToiletRelocateFloor === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    hapticTap();
                    const next = storedToiletRelocateFloor === opt.id ? null : opt.id;
                    onBathroomToiletRelocateFloorTypeChange?.(next);
                  }}
                  style={[
                    styles.choiceChipWide,
                    {
                      borderColor: active ? '#60a5fa' : darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      backgroundColor: active ? 'rgba(96,165,250,0.18)' : darkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#60a5fa' : captionColor(darkMode, Colors),
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
  onUseSuggestion,
  Colors,
  darkMode,
  applying,
  inWetAreaPanel = false,
  compact = false,
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
  onUseSuggestion: (estimate: QuickMeasurementEstimate) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
  /** Inside the gold wet-area panel — skip yellow borders and use a higher-contrast shell. */
  inWetAreaPanel?: boolean;
  /** Whole-home card: less helper copy, tighter suggestion chrome. */
  compact?: boolean;
}) {
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
  // Living / Gross: calm only. Cabinets / counters helpers are noisy in compact whole-home layout.
  const helperText = (() => {
    if (compact) return undefined;
    const text = quickMeasurementHelperText(field);
    if (!text) return undefined;
    if (field.key === 'cabinetLf' || field.key === 'countertopSqft') return text;
    if (variant === 'calm' && (field.key === 'floorAreaSqft' || field.key === 'flooringSqft')) return text;
    return undefined;
  })();
  const showYellowBorder = variant === 'needs_confirmation' && !inWetAreaPanel;

  if (variant === 'suggestion') {
    const badge = estimate ? quickMeasurementEstimateBadgeLabel(estimate) : null;
    return (
      <View style={[styles.measurementField, compact ? styles.measurementFieldSpaced : null]}>
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
              { color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '700', flex: 1 },
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
              <Text style={{ color: '#042f2e', fontSize: 12, fontWeight: '800' }}>Use</Text>
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
            <Text style={{ color: caption, fontSize: 11, lineHeight: 15 }}>{estimate.basis}</Text>
            {estimate.warning ? (
              <Text style={{ color: '#fbbf24', fontSize: 10, lineHeight: 14 }}>{estimate.warning}</Text>
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
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={estimate ? 'Or enter your own' : quickMeasurementPlaceholder(field)}
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
            blurOnSubmit={false}
            {...scopeNumericInputProps}
            editable={!applying}
            style={[styles.measurementInput, { color: Colors.text }]}
          />
          <Text style={[styles.measurementUnit, { color: Colors.sub }]}>{field.unit}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.measurementField, compact ? styles.measurementFieldSpaced : null]}>
      <View style={styles.measurementLabelRow}>
        <Text
          style={[
            styles.measurementLabel,
            { color: darkMode ? '#F5F7FA' : Colors.text, fontSize: compact ? 13 : 12, fontWeight: '700' },
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
                borderColor: darkMode ? 'rgba(34, 197, 94, 0.28)' : 'rgba(22, 163, 74, 0.22)',
                backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(22, 163, 74, 0.08)',
              },
            ]}
          >
            <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700' }}>Notes</Text>
          </View>
        ) : null}
      </View>
      {helperText ? (
        <Text style={{ color: caption, fontSize: 10, lineHeight: 13, marginBottom: 4 }}>{helperText}</Text>
      ) : null}
      <View
        style={[
          styles.measurementInputRow,
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
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={quickMeasurementPlaceholder(field)}
          placeholderTextColor={placeholderColor}
          keyboardType="decimal-pad"
          blurOnSubmit={false}
          {...scopeNumericInputProps}
          editable={!applying}
          style={[styles.measurementInput, { color: Colors.text }]}
        />
        <Text style={[styles.measurementUnit, { color: Colors.sub }]}>{field.unit}</Text>
      </View>
    </View>
  );
});

function CollapsibleQuickMeasurements({
  expanded,
  onToggle,
  onDone,
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
  onBathroomFixturesQmChange,
  onBathroomCountertopMaterialChange,
  onShowerDoorCountChange,
  onGarageDoorCountsChange,
  wetAreaInstallChoiceId,
  showExistingWetAreaPanel = true,
  hasSitePhotos = false,
  Colors,
  darkMode,
  applying,
}: {
  expanded: boolean;
  onToggle: () => void;
  /** Collapse Quick Measurements and settle on Plans / first precon card. */
  onDone?: () => void;
  containerRef?: React.Ref<View>;
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
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
  /** Bathroom photo/notes jobs — sync vanity install + demo from QM steppers. */
  onBathroomFixturesQmChange?: (params: {
    existing: import('@/utils/qmScopePanels/bathroomFixtures').BathroomExistingFixtureCounts;
    install: import('@/utils/qmScopePanels/bathroomFixtures').BathroomInstallFixtureCounts;
    demo: import('@/utils/qmScopePanels/bathroomFixtures').BathroomDemoFixtureCounts;
  }) => void;
  onBathroomCountertopMaterialChange?: (
    materialType: import('@/utils/bathroomVanityCountertopPricing').BathroomVanityCountertopMaterialType | null
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
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(true);
  const [openDetailsKey, setOpenDetailsKey] = useState<QuickMeasurementFieldKey | null>(null);
  const [editingFieldKey, setEditingFieldKey] = useState<QuickMeasurementFieldKey | null>(null);
  const [editingHomeGroup, setEditingHomeGroup] = useState<QuickMeasurementGroupId | null>(null);
  const [editingHomeIndex, setEditingHomeIndex] = useState<number | null>(null);
  const [editingVariant, setEditingVariant] = useState<
    'calm' | 'needs_confirmation' | 'suggestion' | 'more' | null
  >(null);
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
  const effectiveTemplateKey = useMemo(() => {
    const living =
      Number(String(measurements.floorAreaSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.mainFloorLivingSqft) ||
      null;
    const garage =
      Number(String(measurements.garageSqft || '').replace(/,/g, '')) ||
      Number(measurements.planFacts?.buildingAreas?.garageSqft) ||
      null;
    return resolveEffectiveQuickMeasurementTemplateKey({
      templateKey,
      projectType,
      planRoomCount: Array.isArray(measurements.planRooms) ? measurements.planRooms.length : 0,
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
  ]);
  const wholeHomeLayout = isWholeHomeQuickMeasurementTemplate(effectiveTemplateKey);

  const noteQuickMeasurements = useMemo(() => {
    const parsed = parseScopeMeasurementsFromNotes(notes || '', {
      templateKey: effectiveTemplateKey,
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
    put('backsplashSqft', parsed.backsplashSqft);
    put('countertopSqft', parsed.countertopSqft);
    put('cabinetLf', parsed.cabinetLf);
    put('showerWallTileSqft', parsed.showerWallTileSqft);
    put('showerFloorTileSqft', parsed.showerFloorTileSqft);
    put('wallPaintSqft', parsed.wallPaintSqft);
    put('exteriorPaintSqft', parsed.exteriorPaintSqft);
    put('baseboardLf', parsed.baseboardLf);
    put('railingLf', parsed.railingLf);
    put('landscapeSqft', parsed.landscapeSqft);
    put('sodSqft', parsed.sodSqft);
    put('paverSqft', parsed.paverSqft);
    put('rockMulchSqft', parsed.rockMulchSqft);
    put('landscapeTons', parsed.landscapeTons);
    put('roofSquares', parsed.roofSquares);
    put('drywallSqft', parsed.drywallSqft);
    put('flooringSqft', parsed.flooringSqft);
    put('concreteSqft', parsed.concreteSqft);
    put('concreteCy', parsed.concreteCy);
    put('excavationCy', parsed.excavationCy);
    put('deckSqft', parsed.deckSqft);
    put('garageSqft', parsed.garageSqft);

    return { values: out, keys: noteKeys };
  }, [notes, effectiveTemplateKey, projectType]);
  const rows = useMemo(
    () =>
      quickMeasurementRowsForInput(
        effectiveTemplateKey,
        projectType,
        measurements,
        noteQuickMeasurements.keys
      ),
    [effectiveTemplateKey, projectType, measurements, noteQuickMeasurements.keys]
  );
  const fillCounts = useMemo(
    () => countFilledQuickMeasurements(rows, measurements, noteQuickMeasurements.values),
    [rows, measurements, noteQuickMeasurements.values]
  );
  const noteKeySet = useMemo(() => new Set(noteQuickMeasurements.keys), [noteQuickMeasurements.keys]);
  const fieldByKey = useMemo(() => {
    const map = new Map<QuickMeasurementFieldKey, QuickMeasurementFieldDef>();
    for (const row of rows) {
      for (const field of row) map.set(field.key, field);
    }
    return map;
  }, [rows]);

  const fieldResults = useMemo(
    () =>
      resolveQuickMeasurementFields({
        rows,
        measurements,
        noteValues: noteQuickMeasurements.values,
        noteBackedKeys: noteQuickMeasurements.keys,
        sourceMap: measurements.quickMeasurementSources,
        userOverrides: measurements.quickMeasurementUserOverrides,
        includedScopeKeys,
        templateKey: effectiveTemplateKey,
        wholeHomeLayout,
        keepingExistingWetArea,
        wetAreaInstallChoiceId,
      }),
    [
      rows,
      measurements,
      noteQuickMeasurements.values,
      noteQuickMeasurements.keys,
      includedScopeKeys,
      effectiveTemplateKey,
      wholeHomeLayout,
      keepingExistingWetArea,
      wetAreaInstallChoiceId,
    ]
  );
  const physicalSections = useMemo(() => {
    if (!wholeHomeLayout) return [];
    const wetKeys = new Set<string>(WET_AREA_QUICK_MEASUREMENT_KEYS);
    return quickMeasurementSectionsForRows(rows)
      .map((section) => ({
        ...section,
        rows: section.rows
          .map((row) => row.filter((field) => !wetKeys.has(field.key)))
          .filter((row) => row.length > 0),
      }))
      .filter((section) => section.rows.length > 0);
  }, [wholeHomeLayout, rows]);
  const resultByKey = useMemo(
    () => new Map(fieldResults.map((result) => [result.key, result])),
    [fieldResults]
  );
  const bathRooms = useMemo(() => listBathPlanRooms(measurements.planRooms), [measurements.planRooms]);
  const bathCountFromPlan = bathRooms.length;
  const bathroomPhotoWetArea = isSplitTileWetAreaCounts({
    templateKey: effectiveTemplateKey,
    wholeHomeLayout,
  });
  const kitchenQmJob =
    !wholeHomeLayout && String(effectiveTemplateKey || '').toLowerCase() === 'kitchen';
  const flooringQmJob =
    !wholeHomeLayout && String(effectiveTemplateKey || '').toLowerCase() === 'flooring';
  const bathroomFixturesQmJob =
    !wholeHomeLayout && String(effectiveTemplateKey || '').toLowerCase() === 'bathroom';
  const showWetAreaFinishSteppers = useMemo(() => {
    if (
      shouldShowPlanWetAreaFinishSteppers({
        templateKey: effectiveTemplateKey,
        planBathRoomCount: bathCountFromPlan,
        wholeHomeLayout,
        bathroomPhotoJob: bathroomPhotoWetArea,
      })
    ) {
      if (bathroomPhotoWetArea) return true;
      const keys = new Set(fieldResults.filter((r) => r.relevant).map((r) => r.key));
      return (
        keys.has('bathroomFloorSqft') ||
        keys.has('showerWallTileSqft') ||
        keys.has('showerFloorTileSqft') ||
        includedScopeKeys.some((id) =>
          /shower|tile_flooring|interior_finishes|bathroom|bath_floor|waterproofing/i.test(id)
        )
      );
    }
    return false;
  }, [
    effectiveTemplateKey,
    bathCountFromPlan,
    wholeHomeLayout,
    bathroomPhotoWetArea,
    fieldResults,
    includedScopeKeys,
  ]);
  const groups = useMemo(() => {
    const grouped = groupQuickMeasurementFields(fieldResults);
    // Pin only after typing has moved a field out of its home section. Applying pin on
    // focus alone reorders Needs confirmation (pre-split indexes ≠ post-split indexes)
    // and makes the yellow inputs jump / remount when tapped.
    const shouldPin =
      Boolean(editingFieldKey && editingHomeGroup) &&
      !grouped[editingHomeGroup!].some((result) => result.key === editingFieldKey);
    const pinned = shouldPin
      ? pinQuickMeasurementFieldInGroup(
          grouped,
          editingFieldKey,
          editingHomeGroup,
          editingHomeIndex
        )
      : grouped;
    // Photo/notes bathroom jobs use wet-area steppers — shower SF lives in the wet area panel.
    if (!showWetAreaFinishSteppers) return { groups: pinned, wetArea: [] as typeof pinned.more };
    return splitWetAreaQuickMeasurementFields(pinned);
  }, [fieldResults, editingFieldKey, editingHomeGroup, editingHomeIndex, showWetAreaFinishSteppers]);
  const displayGroups = groups.groups;
  const wetAreaFields = groups.wetArea;
  const summary = useMemo(() => summarizeQuickMeasurementFieldStates(fieldResults), [fieldResults]);

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
    [measurements.planRooms, measurements.bathCount, measurements.bathroomFloorSqft]
  );

  const summarySentRef = useRef<QuickMeasurementSummary | null>(null);
  useEffect(() => {
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
  }, [summary, onSummaryChange]);

  const clampBathCount = (next: number | null, max = BATHROOM_QM_STEPPER_MAX) =>
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
  const [existingCounts, setExistingCounts] = useState<WetAreaExistingCounts>(() =>
    readWetAreaExistingCounts(measurements)
  );
  const [demoCounts, setDemoCounts] = useState<WetAreaDemoCounts>(() =>
    readWetAreaDemoCounts(measurements)
  );
  const [reuseExistingShowerDoor, setReuseExistingShowerDoor] = useState(
    () => Boolean(measurements.reuseExistingShowerDoor)
  );
  const demoOverridesRef = useRef<Partial<Record<WetAreaDemoOverrideKey, boolean>>>(
    measurements.demoWetAreaManualOverrides || {}
  );
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
      tilePanBathCount: overrides?.tilePanBathCount ?? stepperCounts.tilePanBathCount,
      prefabBathCount: overrides?.prefabBathCount ?? stepperCounts.prefabBathCount,
      prefabEnclosureBathCount:
        overrides?.prefabEnclosureBathCount ?? stepperCounts.prefabEnclosureBathCount,
      tubBathCount: overrides?.tubBathCount ?? stepperCounts.tubBathCount,
      bathFloorTileCount: overrides?.bathFloorTileCount ?? stepperCounts.bathFloorTileCount,
      showerDoorCount: overrides?.showerDoorCount ?? stepperCounts.showerDoorCount,
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
            showerFloorDemoIncluded: includedScopeKeys.includes('shower_floor_demo'),
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
        showerFloorDemoIncluded: includedScopeKeys.includes('shower_floor_demo'),
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
        (Object.keys(auto) as WetAreaDemoOverrideKey[]).forEach((key) => {
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
          setMeasurements((prev) => ({
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
    [hasSitePhotos, includedScopeKeys, measurements, notes, onWetAreaExistingDemoChange, setMeasurements]
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
          setMeasurements((prev) => {
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
              ...(options?.keepingExisting ? { showerFloorTileSqft: undefined } : {}),
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
    (
      key: keyof WetAreaStepperCounts,
      delta: number
    ) => {
      const gen = ++stepperGenRef.current;
      setKeepingExistingWetArea(false);
      setStepperCounts((prev) => {
        const current = prev[key] ?? 0;
        const cleaned = clampBathCount(current + delta < 1 ? null : current + delta, wetAreaStepperMax);
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
    [clampBathCount, bathroomPhotoWetArea, scheduleWetAreaCommit, wetAreaStepperMax]
  );

  const adjustTileBathCount = useCallback(
    (delta: number) => {
      const gen = ++stepperGenRef.current;
      setStepperCounts((prev) => {
        const current = prev.bathCount ?? 0;
        const cleaned = clampBathCount(current + delta < 1 ? null : current + delta, wetAreaStepperMax);
        const next = { ...prev, bathCount: cleaned };
        scheduleWetAreaCommit(next, gen, { keepingExisting: keepingExistingWetArea });
        return next;
      });
    },
    [clampBathCount, keepingExistingWetArea, scheduleWetAreaCommit, wetAreaStepperMax]
  );
  const adjustTilePanCount = useCallback((delta: number) => adjustStepperCount('tilePanBathCount', delta), [adjustStepperCount]);
  const adjustPrefabBathCount = useCallback((delta: number) => adjustStepperCount('prefabBathCount', delta), [adjustStepperCount]);
  const adjustPrefabEnclosureCount = useCallback(
    (delta: number) => adjustStepperCount('prefabEnclosureBathCount', delta),
    [adjustStepperCount]
  );
  const adjustTubBathCount = useCallback((delta: number) => adjustStepperCount('tubBathCount', delta), [adjustStepperCount]);
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
    scheduleExistingDemoCommit(existingCounts, cleared, true, reuseExistingShowerDoor, ++existingDemoGenRef.current);
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
    if (existingDemoGenRef.current !== existingDemoAppliedGenRef.current) return;
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
      setExistingCounts((prev) => {
        const current = prev[key] ?? 0;
        const cleaned = clampBathCount(current + delta < 1 ? null : current + delta, wetAreaStepperMax);
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
      setDemoCounts((prev) => {
        const current = prev[key] ?? 0;
        const cleaned = clampBathCount(current + delta < 1 ? null : current + delta, wetAreaStepperMax);
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
    setReuseExistingShowerDoor((prev) => {
      const next = !prev;
      const install = buildInstallCounts({
        showerDoorCount: next ? null : stepperCounts.showerDoorCount,
      });
      if (next) {
        setStepperCounts((s) => ({ ...s, showerDoorCount: null }));
        scheduleWetAreaCommit(install, ++stepperGenRef.current, { keepingExisting: keepingExistingWetArea });
      }
      scheduleExistingDemoCommit(existingCounts, install, keepingExistingWetArea, next, gen);
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
    (
      next: { single: number; double: number; rv: number },
      gen: number
    ) => {
      latestGarageDoorRef.current = next;
      queueMicrotask(() => {
        if (gen !== garageDoorGenRef.current) return;
        const latest = latestGarageDoorRef.current;
        const total = latest.single + latest.double + latest.rv;
        startTransition(() => {
          setMeasurements((m) => {
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
      setGarageDoorSteppers((prev) => {
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
    [garageDoorSteppers.single, garageDoorSteppers.double, garageDoorSteppers.rv]
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
          backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: applying || disabled ? 0.35 : 1,
        }}
      >
        <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 18, fontWeight: '700' }}>
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
          borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
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
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 15, marginBottom: 6 }}>
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
            value={value}
            onChangeText={(text) => {
              const cleaned = String(text || '').replace(/[^\d.]/g, '');
              setMeasurements((prev) => {
                const itemQuantities = { ...(prev.itemQuantities || {}) };
                const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
                // Recalculate demo from wall + pan SF (drop stale card override).
                if (field === 'showerWallTileSqft' || field === 'showerFloorTileSqft') {
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
            keyboardType="decimal-pad"
            placeholder="Enter sqft"
            placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
            style={{
              flex: 1,
              color: darkMode ? '#F5F7FA' : Colors.text,
              fontSize: 16,
              fontWeight: '700',
              padding: 0,
            }}
          />
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 13, fontWeight: '600', marginLeft: 8 }}>
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
          <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 18, fontWeight: '700' }}>−</Text>
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
            opacity: applying || disabled || (value != null && value >= max) ? 0.4 : 1,
          }}
        >
          <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 18, fontWeight: '700' }}>+</Text>
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
      <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 15, marginBottom: 8 }}>
        What is in the space now — set manually for notes-only jobs.
      </Text>
      {renderBathCountStepper('Existing tub', existingCounts.existingTubCount, (d) =>
        adjustExistingCount('existingTubCount', d)
      )}
      {renderBathCountStepper('Existing tile shower walls', existingCounts.existingTileWallCount, (d) =>
        adjustExistingCount('existingTileWallCount', d)
      )}
      {renderBathCountStepper('Existing tile shower pan', existingCounts.existingTilePanCount, (d) =>
        adjustExistingCount('existingTilePanCount', d)
      )}
      {renderBathCountStepper('Existing prefab pan', existingCounts.existingPrefabPanCount, (d) =>
        adjustExistingCount('existingPrefabPanCount', d)
      )}
      {renderBathCountStepper('Existing prefab enclosure', existingCounts.existingPrefabEnclosureCount, (d) =>
        adjustExistingCount('existingPrefabEnclosureCount', d)
      )}
      {renderBathCountStepper('Existing shower door', existingCounts.existingShowerDoorCount, (d) =>
        adjustExistingCount('existingShowerDoorCount', d)
      )}
      {renderBathCountStepper('Existing bathroom floor tile', existingCounts.existingBathFloorTileCount, (d) =>
        adjustExistingCount('existingBathFloorTileCount', d)
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
            borderColor: darkMode ? 'rgba(248, 113, 113, 0.28)' : 'rgba(220, 38, 38, 0.2)',
            backgroundColor: darkMode ? 'rgba(248, 113, 113, 0.06)' : 'rgba(248, 113, 113, 0.05)',
            marginTop: 8,
            marginBottom: 8,
          },
        ]}
      >
        {sectionTitle('Demo / tear-out', '#f87171')}
        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 15, marginBottom: 8 }}>
          Auto-filled from {showExistingWetAreaPanel ? 'existing + install' : 'photos, notes, and install'} — adjust if needed.
          Tile by sqft (~$5.50/SF) · tub/prefab pan $350 · enclosure $600 · door $125.
        </Text>
        {renderBathCountStepper('Remove tub', demoCounts.demoTubCount, (d) =>
          adjustDemoCount('demoTubCount', d)
        )}
        {renderBathCountStepper('Remove tile shower walls', demoCounts.demoTileWallCount, (d) =>
          adjustDemoCount('demoTileWallCount', d)
        )}
        {demoCounts.demoTileWallCount != null && demoCounts.demoTileWallCount > 0
          ? renderDemoSqftField(
              'Demo wall tile sqft',
              'Tear-out wall area for this job (also used for new shower wall tile takeoff).',
              'showerWallTileSqft'
            )
          : null}
        {renderBathCountStepper('Remove tile shower pan', demoCounts.demoTilePanCount, (d) =>
          adjustDemoCount('demoTilePanCount', d)
        )}
        {demoCounts.demoTilePanCount != null && demoCounts.demoTilePanCount > 0
          ? renderDemoSqftField(
              'Demo pan / shower floor sqft',
              'Tear-out pan area for this job (also used for new shower floor tile takeoff).',
              'showerFloorTileSqft'
            )
          : null}
        {renderBathCountStepper('Remove prefab pan', demoCounts.demoPrefabPanCount, (d) =>
          adjustDemoCount('demoPrefabPanCount', d)
        )}
        {renderBathCountStepper('Remove prefab enclosure', demoCounts.demoPrefabEnclosureCount, (d) =>
          adjustDemoCount('demoPrefabEnclosureCount', d)
        )}
        {renderBathCountStepper('Remove shower door', demoCounts.demoShowerDoorCount, (d) =>
          adjustDemoCount('demoShowerDoorCount', d)
        )}
        {renderBathCountStepper('Remove bathroom floor tile', demoCounts.demoBathFloorTileCount, (d) =>
          adjustDemoCount('demoBathFloorTileCount', d)
        )}
        {demoCounts.demoBathFloorTileCount != null && demoCounts.demoBathFloorTileCount > 0
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
          borderColor: darkMode ? 'rgba(251, 191, 36, 0.28)' : 'rgba(217, 119, 6, 0.22)',
          backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.06)' : 'rgba(251, 191, 36, 0.05)',
          marginTop: bathroomPhotoWetArea ? 0 : 4,
        },
      ]}
    >
      {sectionTitle(bathroomPhotoWetArea ? 'Wet area install' : 'Wet area finish', '#fbbf24')}
      <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 15, marginBottom: 8 }}>
        {bathroomPhotoWetArea
          ? 'Set what is in this bid — shower wall and floor fields update below.'
          : bathCountFromPlan > 0
            ? `${bathCountFromPlan} bath${bathCountFromPlan === 1 ? '' : 's'} on plan — set finish counts below.`
            : 'No baths labeled on plan — set tile / prefab / tub counts below.'}
        {!bathroomPhotoWetArea && effectiveWetAreaFinish === 'tile' && !resolvedBathCount
          ? ' Set tile showers to unlock shower estimates.'
          : ''}
      </Text>
      {bathroomPhotoWetArea ? (
        <>
          {renderBathCountStepper('Tile shower walls', displayTileWallCount, adjustTileBathCount)}
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
                color: keepingExistingWetArea ? '#38bdf8' : darkMode ? '#F5F7FA' : Colors.text,
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
                  color: reuseExistingShowerDoor ? '#34d399' : darkMode ? '#F5F7FA' : Colors.text,
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                Reuse existing shower door
              </Text>
            </TouchableOpacity>
          ) : null}
          {!reuseExistingShowerDoor
            ? renderBathCountStepper('Shower doors', displayShowerDoorCount, adjustShowerDoorCount)
            : null}
        </>
      ) : (
        <>
          {renderBathCountStepper('Tile showers', displayTileWallCount, adjustTileBathCount)}
          {renderBathCountStepper('Prefab', displayPrefabPanCount, adjustPrefabBathCount)}
          {renderBathCountStepper('Tub', displayTubBathCount, adjustTubBathCount)}
          {renderBathCountStepper('Shower doors', displayShowerDoorCount, adjustShowerDoorCount)}
        </>
      )}
      {wetAreaSuggestions.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6, marginTop: 2 }}>
          <TouchableOpacity
            onPress={useAllWetAreaSuggestions}
            disabled={applying}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: '#34d399', fontSize: 12, fontWeight: '800' }}>Use shower estimates</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {wetAreaFields
        .filter((result) => result.relevant)
        .map((result, index) => {
        const variant = wetAreaFieldVariant(result);
        const homeGroup: QuickMeasurementGroupId =
          result.state === 'confirmed'
            ? 'confirmed'
            : result.state === 'detected'
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
      }
      setMeasurements((prev) => ({
        ...prev,
        [key]: value,
        quickMeasurementSources: {
          ...(prev.quickMeasurementSources || {}),
          [key]: prev.quickMeasurementSources?.[key] || 'user_entered',
        },
        quickMeasurementUserOverrides: { ...(prev.quickMeasurementUserOverrides || {}), [key]: true },
      }));
    },
    [setMeasurements]
  );

  const useSuggestion = useCallback(
    (estimate: QuickMeasurementEstimate) => {
      hapticTap();
      setOpenDetailsKey(null);
      setMeasurements((prev) => acceptQuickMeasurementSuggestion(prev, estimate));
    },
    [setMeasurements]
  );

  const useAllSuggestions = useCallback(() => {
    if (!displayGroups.suggestions.length) return;
    hapticTap();
    const suggestions = displayGroups.suggestions
      .map((result) => result.estimate)
      .filter((estimate): estimate is QuickMeasurementEstimate => Boolean(estimate));
    const reviewRequired = suggestions.filter(quickMeasurementSuggestionRequiresReview);
    const reviewLines = suggestions.map(
      (estimate) =>
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
            setMeasurements((prev) =>
              acceptReviewedQuickMeasurementSuggestions(prev, suggestions, true)
            );
          },
        },
      ]
    );
  }, [fieldByKey, displayGroups.suggestions, setMeasurements]);

  const wetAreaSuggestions = useMemo(
    () => wetAreaFields.filter((result) => result.state === 'estimate_available' && result.estimate),
    [wetAreaFields]
  );

  const useAllWetAreaSuggestions = useCallback(() => {
    if (!wetAreaSuggestions.length) return;
    hapticTap();
    const suggestions = wetAreaSuggestions
      .map((result) => result.estimate)
      .filter((estimate): estimate is QuickMeasurementEstimate => Boolean(estimate));
    Alert.alert(
      'Use wet-area suggestions',
      suggestions.map((estimate) => `${estimate.quantityLabel || estimate.key}: ${estimate.summary}`).join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use values',
          onPress: () => {
            setOpenDetailsKey(null);
            setMeasurements((prev) =>
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

  const homeGroupForResult = (result: QuickMeasurementFieldResult): QuickMeasurementGroupId => {
    if (result.state === 'confirmed') return 'confirmed';
    if (result.state === 'detected') return 'fromPlan';
    if (result.state === 'estimate_available') return 'suggestions';
    if (result.state === 'not_relevant') return 'more';
    return 'needsConfirmation';
  };

  const showDone = expanded && fillCounts.filled > 0;
  const roomCount = Array.isArray(measurements.planRooms) ? measurements.planRooms.length : 0;
  const subtitle =
    summary.relevantTotal > 0
      ? summary.needsConfirmation > 0
        ? 'Add missing measurements to improve pricing.'
        : summary.estimateAvailable > 0
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
    editingHomeRef.current = { homeGroup: null, homeIndex: null, variant: null };
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
    inWetAreaPanel = false
  ) => {
    const field = fieldByKey.get(result.key);
    if (!field) return null;
    const displayValue = resolveQuickMeasurementDisplayValue(
      field.key,
      measurements,
      noteQuickMeasurements.values
    );
    const typed = String(measurements[field.key] ?? '').trim() !== '';
    const fromNotes = !typed && noteKeySet.has(field.key) && Boolean(noteQuickMeasurements.values[field.key]);
    const isEditing = editingFieldKey === field.key;
    const lockedVariant = isEditing && editingVariant ? editingVariant : variant;
    const estimateForRender =
      result.estimate || (isEditing && lockedVariant === 'suggestion' ? editingEstimateRef.current : null);
    return (
      <QuickMeasurementField
        key={field.key}
        field={field}
        value={displayValue}
        fromNotes={fromNotes}
        variant={lockedVariant}
        estimate={estimateForRender}
        detailsOpen={openDetailsKey === field.key}
        onToggleDetails={() => setOpenDetailsKey((prev) => (prev === field.key ? null : field.key))}
        onChangeText={(value) => setField(field.key, value)}
        onFocus={
          homeGroup != null && homeIndex != null
            ? () => beginEditingField(field.key, homeGroup, homeIndex, variant, result.estimate)
            : undefined
        }
        onBlur={() => endEditingField(field.key)}
        onUseSuggestion={useSuggestion}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
        inWetAreaPanel={inWetAreaPanel}
        compact={wholeHomeLayout}
      />
    );
  };

  const sectionTitle = (title: string, color?: string) => (
    <Text style={[styles.quickMeasurementSectionTitle, { color: color || captionColor(darkMode, Colors) }]}>
      {title}
    </Text>
  );
  const kitchenEmbeddedMeasurementKeys = new Set<QuickMeasurementFieldKey>([
    'kitchenFloorSqft',
    'backsplashSqft',
    'countertopSqft',
    'cabinetLf',
  ]);
  const shouldRenderGeneralResult = (result: QuickMeasurementFieldResult) =>
    !(kitchenQmJob && kitchenEmbeddedMeasurementKeys.has(result.key));
  const renderDisplayedResultField = (
    result: QuickMeasurementFieldResult,
    variant: 'calm' | 'needs_confirmation' | 'suggestion' | 'more',
    homeGroup?: QuickMeasurementGroupId,
    homeIndex?: number
  ) =>
    !shouldRenderGeneralResult(result)
      ? null
      : renderResultField(result, variant, homeGroup, homeIndex);
  const kitchenMeasurementFooter = kitchenQmJob ? (
    <View style={{ gap: 12, marginTop: 8 }}>
      {['kitchenFloorSqft', 'backsplashSqft', 'countertopSqft', 'cabinetLf'].map((key, index) => {
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

  return (
    <View
      ref={containerRef}
      collapsable={false}
      style={[styles.quickMeasurements, estimateFlowCardStyle(Colors, darkMode)]}
    >
      <TouchableOpacity style={styles.quickMeasurementsHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.quickMeasurementsTitleRow}>
            <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '800' }}>
              Quick measurements
            </Text>
          </View>
          {summary.relevantTotal > 0 ? (
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 2, fontWeight: '600' }}>
              {quickMeasurementSummaryLine(summary)}
            </Text>
          ) : null}
          <Text
            style={{
              color: summary.needsConfirmation > 0 ? '#fbbf24' : captionColor(darkMode, Colors),
              fontSize: 11,
              marginTop: 2,
              fontWeight: summary.needsConfirmation > 0 ? '700' : '400',
            }}
          >
            {subtitle}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={captionColor(darkMode, Colors)} />
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.quickMeasurementsBody}>
          {wholeHomeLayout ? (
            <>
              {displayGroups.suggestions.length > 1 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                  <TouchableOpacity
                    onPress={useAllSuggestions}
                    disabled={applying}
                    activeOpacity={0.75}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ color: '#34d399', fontSize: 12, fontWeight: '800' }}>
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
                    sectionIndex > 0 ? styles.quickMeasurementSectionSplit : null,
                    sectionIndex > 0
                      ? { borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line }
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
          ) : (
            <>
              {showWetAreaFinishSteppers && bathroomPhotoWetArea ? (
                <>
                  {showExistingWetAreaPanel ? renderExistingWetAreaPanel() : null}
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
                  onBathroomCountertopMaterialChange={onBathroomCountertopMaterialChange}
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
                  darkMode={darkMode}
                  Colors={Colors}
                />
              ) : null}

              {displayGroups.fromPlan.some(shouldRenderGeneralResult) ? (
                <View style={styles.quickMeasurementSection}>
                  {sectionTitle('From plan')}
                  {displayGroups.fromPlan.map((result, index) =>
                    renderDisplayedResultField(result, 'calm', 'fromPlan', index)
                  )}
                </View>
              ) : null}

              {displayGroups.suggestions.some(shouldRenderGeneralResult) ? (
                <View style={styles.quickMeasurementSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {sectionTitle('Suggestions')}
                    {displayGroups.suggestions.length > 1 ? (
                      <TouchableOpacity
                        onPress={useAllSuggestions}
                        disabled={applying}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ color: '#34d399', fontSize: 12, fontWeight: '800' }}>
                          Review and use all
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {displayGroups.suggestions.map((result, index) =>
                    renderDisplayedResultField(result, 'suggestion', 'suggestions', index)
                  )}
                </View>
              ) : null}

              {displayGroups.needsConfirmation.some(shouldRenderGeneralResult) ? (
                <View
                  style={[
                    styles.quickMeasurementSection,
                    styles.quickMeasurementSectionSplit,
                    { borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line },
                  ]}
                >
                  {sectionTitle('Needs confirmation', '#fbbf24')}
                  {displayGroups.needsConfirmation.map((result, index) =>
                    renderDisplayedResultField(result, 'needs_confirmation', 'needsConfirmation', index)
                  )}
                </View>
              ) : null}

              {displayGroups.confirmed.some(shouldRenderGeneralResult) ? (
                <View
                  style={[
                    styles.quickMeasurementSection,
                    styles.quickMeasurementSectionSplit,
                    { borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line },
                  ]}
                >
                  {sectionTitle('Confirmed')}
                  {displayGroups.confirmed.map((result, index) =>
                    renderDisplayedResultField(result, 'calm', 'confirmed', index)
                  )}
                </View>
              ) : null}

              {displayGroups.more.some(shouldRenderGeneralResult) ? (
                <View
                  style={[
                    styles.quickMeasurementSection,
                    styles.quickMeasurementSectionSplit,
                    { borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setMoreExpanded((v) => !v)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Text style={[styles.quickMeasurementSectionTitle, { color: captionColor(darkMode, Colors) }]}>
                      More measurements · {displayGroups.more.length}
                    </Text>
                    <Ionicons
                      name={moreExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={captionColor(darkMode, Colors)}
                    />
                  </TouchableOpacity>
                  {moreExpanded
                    ? displayGroups.more.map((result) => renderDisplayedResultField(result, 'more'))
                    : null}
                </View>
              ) : null}
            </>
          )}

          {showWetAreaFinishSteppers && !bathroomPhotoWetArea ? renderWetAreaFinishPanel() : null}

          {showGarageDoorSteppers ? (
            <View
              style={[
                styles.quickMeasurementSection,
                styles.quickMeasurementSectionSplit,
                { borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line },
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
                  borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
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
                    {garageDoorPackage ? `~$${garageDoorPackage.total.toLocaleString()}` : '—'}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {roomCount > 0 ? (
            <View
              style={[
                styles.quickMeasurementSection,
                styles.quickMeasurementSectionSplit,
                { borderTopColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line },
              ]}
            >
              <TouchableOpacity
                onPress={() => setRoomsExpanded((v) => !v)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={[styles.quickMeasurementSectionTitle, { color: captionColor(darkMode, Colors) }]}>
                  Rooms from plan · {roomCount} room{roomCount === 1 ? '' : 's'} detected
                </Text>
                <Ionicons
                  name={roomsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={captionColor(darkMode, Colors)}
                />
              </TouchableOpacity>
              {roomsExpanded
                ? (measurements.planRooms || []).map((room, idx) => {
                    const area =
                      room.areaSqft != null && Number(room.areaSqft) > 0
                        ? `${Number(room.areaSqft).toLocaleString()} sqft`
                        : room.lengthFt != null && room.widthFt != null
                          ? `${room.lengthFt}×${room.widthFt} ft`
                          : 'size unclear';
                    return (
                      <View
                        key={`${room.name}-${idx}`}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingVertical: 8,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                        }}
                      >
                        <Text
                          style={{
                            color: darkMode ? '#F5F7FA' : Colors.text,
                            fontSize: 13,
                            fontWeight: '600',
                            flex: 1,
                            paddingRight: 12,
                          }}
                          numberOfLines={1}
                        >
                          {room.name}
                        </Text>
                        <Text style={{ color: captionColor(darkMode, Colors), fontSize: 13, fontWeight: '600' }}>
                          {area}
                        </Text>
                      </View>
                    );
                  })
                : null}
            </View>
          ) : null}
          {showDone ? (
            <TouchableOpacity
              onPress={onDone || onToggle}
              activeOpacity={0.75}
              style={styles.quickMeasurementsDone}
            >
              <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>Done</Text>
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
    noteSummary != null && noteSummary.fromNotes === 0 && noteSummary.toConfirm === items.length;
  const headerOpacity = allSecondary ? SCOPE_ITEM_TIER_OPACITY.secondary : 1;

  return (
    <View style={styles.groupSection}>
      {title ? (
        <TouchableOpacity
          style={[styles.groupHeader, { borderBottomColor: dividerColor(darkMode), opacity: headerOpacity }]}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '800' }}>
              {title}
            </Text>
            {noteSummary && (noteSummary.fromNotes > 0 || noteSummary.toConfirm > 0) ? (
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 10, marginTop: 2 }}>
                {noteSummary.fromNotes > 0 ? scopeLinkedToNotesSummary(noteSummary.fromNotes) : null}
                {noteSummary.fromNotes > 0 && noteSummary.toConfirm > 0 ? ' · ' : null}
                {noteSummary.toConfirm > 0 ? `${noteSummary.toConfirm} to confirm` : null}
              </Text>
            ) : null}
          </View>
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginRight: 6 }}>
            {items.length}
          </Text>
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} color={captionColor(darkMode, Colors)} />
        </TouchableOpacity>
      ) : null}
      {!collapsed || !title
        ? items.map((item) => <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>)
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
  onClose,
  onConfirm,
  onScopeOnly,
  onPersistProgress,
  pricingContext = null,
  hasSitePhotos = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const checklist = draft?.scopeChecklist;
  const scopeNotes = useMemo(() => chooseBestScopeNotes(draft, notesFallback), [draft, notesFallback]);
  const [items, setItems] = useState<ScopeChecklistItem[]>([]);
  const [measurements, setMeasurements] = useState<ScopeMeasurementsInputExtended>({
    ...emptyQuickMeasurementInput(),
    itemQuantities: {},
  });
  const [quickMeasurementsOpen, setQuickMeasurementsOpen] = useState(false);
  const [quickMeasurementSummary, setQuickMeasurementSummary] = useState<QuickMeasurementSummary>({
    detected: 0,
    estimateAvailable: 0,
    needsConfirmation: 0,
    confirmed: 0,
    relevantTotal: 0,
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [customItemLabel, setCustomItemLabel] = useState('');
  const [showCustomItemInput, setShowCustomItemInput] = useState(false);
  const [benchmarkReasonableness, setBenchmarkReasonableness] =
    useState<BenchmarkReasonableness | null>(null);
  const [benchmarkRefresh, setBenchmarkRefresh] = useState(0);
  const itemsRef = useRef(items);
  const measurementsRef = useRef(measurements);
  const selectedPricingRef = useRef<Record<string, SuggestedPricingBlock>>({});
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const scrollOffsetYRef = useRef(0);
  const quickMeasurementsRef = useRef<View>(null);
  const pendingQmDoneScrollRef = useRef(false);
  const qmDoneFirstScopeItemIdRef = useRef<string | null>(null);

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
      planRoomCount: Array.isArray(measurements.planRooms) ? measurements.planRooms.length : 0,
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
  const showAppliedBuildCostPerSf = shouldShowAppliedBuildCostPerSf(appliedBuildCostTemplateKey);

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

  const displayItems = useMemo(
    () =>
      buildConfirmScopeDisplayItems(
        items,
        measurements as Record<string, unknown>,
        checklist?.templateKey
      ),
    [
      items,
      checklist?.templateKey,
      measurements.bathroomInstallVanityCount,
      measurements.bathroomInstallCounterCount,
      measurements.bathroomDemoVanityCount,
      measurements.bathroomDemoCounterCount,
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
  const measurementsForAppliedPricing = useMemo(
    () => clearSupersededStageHostPricing(measurements, checklist?.templateKey),
    [measurements, checklist?.templateKey]
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
        ? computeAppliedBuildCostPerLivingSf(step2AppliedEstimateTotal, appliedBuildCostArea.sqft)
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
        itemIds: items.filter((item) => item.inScope !== false).map((item) => item.id),
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
    if (!context.visible || !context.itemIds.length || !(context.livingSf > 0)) {
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
            insulationEnvelopeInputsFromPlanFacts(measurements.planFacts, context.livingSf)
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
      .then((response) => {
        if (cancelled) return;
        setBenchmarkReasonableness(response?.reasonableness || null);
        setBenchmarkRefresh((value) => value + 1);
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
  const [pricingEditorRequest, setPricingEditorRequest] = useState<{ itemId: string; token: number } | null>(
    null
  );
  const clearPricingEditorRequest = useCallback(() => setPricingEditorRequest(null), []);
  const hydratedVisibleSessionRef = useRef(false);

  const setMeasurementsSynced = useCallback((update: React.SetStateAction<ScopeMeasurementsInputExtended>) => {
    const previous = measurementsRef.current;
    const next =
      typeof update === 'function'
        ? (update as (prev: ScopeMeasurementsInputExtended) => ScopeMeasurementsInputExtended)(previous)
        : update;
    // Drop stage-host Applied dollars once trade children are priced so card
    // badges match the Applied pricing summary (no silent double-count).
    const reconciled = clearSupersededStageHostPricing(next, checklist?.templateKey);
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
        if (owner && selected[owner] && !reconciled.pricingAcceptance?.[owner]) {
          delete selected[owner];
          selectedChanged = true;
        }
      }
      if (selectedChanged) selectedPricingRef.current = selected;
    }
    measurementsRef.current = reconciled;
    setMeasurements(reconciled);
  }, [checklist?.templateKey]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    measurementsRef.current = measurements;
  }, [measurements]);

  const scopeMeasurementsPayloadForCurrentState = useCallback(() => {
    const payload = scopeMeasurementsPayloadForPersist(measurementsRef.current, {
      notes: scopeNotes,
      templateKey: checklist?.templateKey,
    });
    const itemQuantities = { ...(payload.itemQuantities || {}) };
    const pricingAcceptance = {
      ...(measurementsRef.current.pricingAcceptance || {}),
    };
    for (const [itemId, block] of Object.entries(selectedPricingRef.current)) {
      const rule = getChecklistItemQuantityRule(itemId, checklist?.templateKey);
      const allowanceKey = rule?.dualAllowanceField ? roughAllowanceSubKey(itemId) : `${itemId}__allowance`;
      const primary = primaryQuantityForAppliedSuggestedBlock(
        block,
        getChecklistItemQuantityRuleOrDefault(itemId, checklist?.templateKey)
      );
      itemQuantities[itemId] = {
        quantity: Number(primary.quantity),
        unit: primary.unit || (rule?.dualAllowanceField ? rule.defaultUnit : 'allowance'),
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
    const reconciled = clearSupersededStageHostPricing(
      {
        ...payload,
        itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : payload.itemQuantities,
        pricingAcceptance:
          Object.keys(pricingAcceptance).length ? pricingAcceptance : payload.pricingAcceptance,
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

  useEffect(() => {
    if (visible && checklist?.items?.length) {
      if (hydratedVisibleSessionRef.current) return;
      selectedPricingRef.current = {};
      const sourceItems = scopeChecklistItemsForEditing(draft);
      if (!sourceItems.length) return;
      const draftForScope =
        draft && scopeNotes.trim() ? repairDraftRatePricingFromNotes(draft, scopeNotes) : draft;
      const nextMeasurements = mergeConfirmScopeSavedMeasurements(
        prepareScopeMeasurementsInputForUi(
          initialScopeMeasurementInputExtended(draftForScope, scopeNotes),
          { notes: scopeNotes, templateKey: checklist.templateKey }
        ),
        draft?.scopeMeasurements
      );
      const strippedQuantities = stripBathroomFalsePositiveFloorDemoQuantities(
        nextMeasurements.itemQuantities,
        checklist.templateKey,
        scopeNotes
      );
      if (strippedQuantities !== nextMeasurements.itemQuantities) {
        nextMeasurements.itemQuantities = strippedQuantities;
      }
      if (!nextMeasurements.wetAreaFinish) {
        const wet = sourceItems.find((row) => row.id === 'wet_area_install');
        const finish = wetAreaFinishFromChecklistChoice(wet?.choiceId);
        if (finish) nextMeasurements.wetAreaFinish = finish;
      }
      if (
        isPhotoNotesScopeJob({
          templateKey: checklist.templateKey,
          wholeHomeLayout: false,
        })
      ) {
        const wet = sourceItems.find((row) => row.id === 'wet_area_install');
        const showerTile = sourceItems.find((row) => row.id === 'shower_tile');
        const showerFloorTile = sourceItems.find((row) => row.id === 'shower_floor_tile');
        const glassDoor = sourceItems.find((row) => row.id === 'glass_door');
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
      const norm = buildNormFromInput(nextMeasurements, scopeNotes, checklist.templateKey);
      let normalized = hydrateScopeChecklistFromNotes(
        sourceItems,
        checklist.templateKey,
        scopeNotes,
        norm
      );
      normalized = applyKitchenScopeInferences(normalized, checklist.templateKey, {
        notes: scopeNotes,
        measurements: norm,
      });
      if (sourceItems.length && (draft?.confirmedAssumptions?.length || draft?.scopeAssumptionsConfirmed)) {
        normalized = restoreConfirmedChecklistItemStates(normalized, sourceItems);
      }
      normalized = suppressBathroomFalsePositiveFloorDemoScope(
        normalized,
        checklist.templateKey,
        scopeNotes,
        norm
      );
      normalized = syncQmPanelScopeItems(normalized, {
        templateKey: checklist.templateKey,
        wholeHomeLayout: false,
      }, nextMeasurements);
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
      setItems(normalized);
      setMeasurementsSynced(nextMeasurements);
      const displayForHydrate = expandWetAreaDerivedScopeItems(normalized);
      const hydratePricing = countScopePricingReadiness(
        displayForHydrate,
        norm,
        checklist.templateKey,
        scopeNotes
      );
      // Open when scopes still need quantities so users see where to fill them.
      setQuickMeasurementsOpen(hydratePricing.needsMeasurement > 0);
      setCustomItemLabel('');
      setShowCustomItemInput(false);
      const grouped = groupScopeChecklistItems(displayForHydrate, checklist.templateKey);
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
  }, [visible, draftScopeRestoreKey, checklist?.templateKey]);

  useEffect(() => {
    if (visible) return;
    // Persist before wiping local form state. Skip during Continue — parent saves in onConfirm.
    if (onPersistProgress && !applying && itemsRef.current.length) {
      onPersistProgress(
        scopeChecklistItemsForPersist(itemsRef.current),
        scopeMeasurementsPayloadForCurrentState()
      );
    }
    hydratedVisibleSessionRef.current = false;
    setItems([]);
    // Do not clear measurementsRef here. Persist reads measurementsRef above.
    setMeasurements({
      ...emptyQuickMeasurementInput(),
      itemQuantities: {},
    });
    setCollapsedGroups({});
    setQuickMeasurementsOpen(false);
    setCustomItemLabel('');
    setShowCustomItemInput(false);
  }, [visible, onPersistProgress, applying, scopeMeasurementsPayloadForCurrentState]);

  // Keep rate-pricing subkeys in form state whenever notes are available (handles hot reload / stale saves).
  useEffect(() => {
    if (!visible || !scopeNotes.trim()) return;
    setMeasurementsSynced((prev) =>
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
    if (String(checklist?.templateKey || '').toLowerCase() !== 'ground_up') return;
    const total =
      (Number(measurements.garageDoorSingleCount) || 0) +
      (Number(measurements.garageDoorDoubleCount) || 0) +
      (Number(measurements.garageDoorRvCount) || 0);
    if (total <= 0) return;
    setItems((prev) => {
      let next = ensureGroundUpOpeningScopeCards(prev);
      next = next.map((row) =>
        row.id === 'garage_doors' ? { ...row, state: 'included' as const } : row
      );
      const same =
        next.length === prev.length &&
        next.every((row, idx) => row.id === prev[idx]?.id && row.state === prev[idx]?.state);
      return same ? prev : next;
    });
    if (!quickMeasurementsOpenRef.current) {
      setCollapsedGroups((prev) =>
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
    if (String(checklist?.templateKey || '').toLowerCase() !== 'ground_up') return;
    const flatworkSf = Number(measurements.concreteSqft) || 0;
    if (flatworkSf <= 0) return;
    setItems((prev) => {
      let next = ensureGroundUpFlatworkScopeCard(prev);
      next = next.map((row) =>
        row.id === 'pour_flatwork' ? { ...row, state: 'included' as const } : row
      );
      const same =
        next.length === prev.length &&
        next.every((row, idx) => row.id === prev[idx]?.id && row.state === prev[idx]?.state);
      return same ? prev : next;
    });
    if (!quickMeasurementsOpenRef.current) {
      setCollapsedGroups((prev) =>
        prev.Structure === false ? prev : { ...prev, Structure: false }
      );
    }
  }, [visible, checklist?.templateKey, measurements.concreteSqft]);

  const normMeasurements = useMemo(
    () => buildNormFromInput(measurements, scopeNotes, checklist?.templateKey),
    [measurements, scopeNotes, checklist?.templateKey]
  );

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
    () => scopeChecklistSummaryCounts(displayItems, pricingCounts.needsMeasurement),
    [displayItems, pricingCounts.needsMeasurement]
  );

  const persistScopeProgressNow = useCallback(() => {
    if (!onPersistProgress || applying) return;
    const currentItems = itemsRef.current;
    if (!currentItems.length) return;
    onPersistProgress(
      scopeChecklistItemsForPersist(currentItems),
      scopeMeasurementsPayloadForCurrentState()
    );
  }, [onPersistProgress, applying, scopeMeasurementsPayloadForCurrentState]);

  const handleBathroomCountertopMaterialChange = useCallback(
    (materialType: import('@/utils/bathroomVanityCountertopPricing').BathroomVanityCountertopMaterialType | null) => {
      startTransition(() => {
        setItems((prev) =>
          prev.map((row) =>
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
      setMeasurementsSynced((prev) => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughFixtureType: fixtureType,
          bathroomShowerRoughFixtureTypeSource: fixtureType ? 'user_selected' : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomShowerRoughWorkTypeChange = useCallback(
    (workType: BathroomShowerRoughWorkType | null) => {
      setMeasurementsSynced((prev) => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughWorkType: workType,
          bathroomShowerRoughWorkTypeSource: workType ? 'user_selected' : null,
          bathroomShowerRoughSlabWorkRequired:
            workType === 'relocation' ? null : prev.bathroomShowerRoughSlabWorkRequired,
          bathroomShowerRoughSlabWorkRequiredSource:
            workType === 'relocation' ? null : prev.bathroomShowerRoughSlabWorkRequiredSource,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomShowerRoughPlumbingExposedChange = useCallback(
    (plumbingExposed: BathroomShowerRoughPlumbingExposed | null) => {
      setMeasurementsSynced((prev) => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughPlumbingExposed: plumbingExposed,
          bathroomShowerRoughPlumbingExposedSource: plumbingExposed ? 'user_selected' : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomShowerRoughFloorConstructionChange = useCallback(
    (floorConstruction: BathroomShowerRoughFloorConstruction | null) => {
      setMeasurementsSynced((prev) => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughFloorConstruction: floorConstruction,
          bathroomShowerRoughFloorConstructionSource: floorConstruction ? 'user_selected' : null,
          bathroomShowerRoughSlabWorkRequired:
            floorConstruction !== 'concrete_slab' ? null : prev.bathroomShowerRoughSlabWorkRequired,
          bathroomShowerRoughSlabWorkRequiredSource:
            floorConstruction !== 'concrete_slab' ? null : prev.bathroomShowerRoughSlabWorkRequiredSource,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomShowerRoughSlabWorkRequiredChange = useCallback(
    (slabWorkRequired: BathroomShowerRoughSlabWorkRequired | null) => {
      setMeasurementsSynced((prev) => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomShowerRoughSlabWorkRequired: slabWorkRequired,
          bathroomShowerRoughSlabWorkRequiredSource: slabWorkRequired ? 'user_selected' : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomPaintRepairScopeChange = useCallback(
    (scope: BathroomPaintRepairScope | null) => {
      setMeasurementsSynced((prev) => {
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
          bathroomPaintRepairEntireRoom: isFullRoom ? true : scope === 'affected_area' ? false : null,
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
      setMeasurementsSynced((prev) => {
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
      setMeasurementsSynced((prev) => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.interior_paint;
        delete pricingAcceptance.paint;
        return {
          ...prev,
          bathroomInteriorPaintMobilization: mobilization,
          bathroomInteriorPaintMobilizationSource: mobilization ? 'user_selected' : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomInteriorPaintSurfaceChange = useCallback(
    (surface: BathroomInteriorPaintSurface | null) => {
      setMeasurementsSynced((prev) => {
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
      setMeasurementsSynced((prev) => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.interior_paint;
        delete pricingAcceptance.paint;
        return {
          ...prev,
          bathroomInteriorPaintCondition: condition,
          bathroomInteriorPaintConditionSource: condition ? 'user_selected' : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  const handleBathroomGlassDoorStyleChange = useCallback(
    (style: BathroomGlassDoorStyle | null) => {
      setMeasurementsSynced((prev) => {
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

  const handleBathroomToiletRelocateFloorTypeChange = useCallback(
    (floorType: BathroomToiletRelocateFloorType | null) => {
      setMeasurementsSynced((prev) => {
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        delete pricingAcceptance.toilet;
        delete pricingAcceptance.plumbing_rough;
        return {
          ...prev,
          bathroomToiletRelocateFloorType: floorType,
          bathroomToiletRelocateFloorTypeSource: floorType ? 'user_selected' : null,
          pricingAcceptance,
        };
      });
    },
    []
  );

  useEffect(() => {
    const inferred = inferPlumbingExposedFromDemoScope(displayItems);
    setMeasurementsSynced((prev) => {
      if (prev.bathroomShowerRoughPlumbingExposedSource === 'user_selected') {
        return prev;
      }
      if (inferred) {
        if (
          prev.bathroomShowerRoughPlumbingExposed === inferred.plumbingExposed &&
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
  }, [displayItems]);

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

  const groupedItems = useMemo(
    () => groupScopeChecklistItems(displayItems, checklist?.templateKey),
    [displayItems, checklist?.templateKey]
  );
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
      planRoomCount: Array.isArray(measurements.planRooms) ? measurements.planRooms.length : 0,
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
      planRoomCount: Array.isArray(measurements.planRooms) ? measurements.planRooms.length : 0,
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
    [qmEmbeddedScopeIds, measurements, items]
  );
  const scopeGroupedItems = useMemo(() => {
    if (!embedQmScopeInQuickMeasurements) return groupedItems;
    return groupedItems
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !qmScopeEmbeddedInQuickMeasurements(item.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedItems, embedQmScopeInQuickMeasurements, qmScopeEmbeddedInQuickMeasurements]);

  // QM steppers / shower SF → auto-include shower wall & floor tile scope cards.
  useEffect(() => {
    if (!embedQmScopeInQuickMeasurements) return;
    setItems((prev) => {
      let next = syncWetAreaTileScopeItems(prev, {
        bathCount: measurements.bathCount,
        tilePanBathCount: measurements.tilePanBathCount,
        showerWallTileSqft: measurements.showerWallTileSqft,
        showerFloorTileSqft: measurements.showerFloorTileSqft,
      });
      next = syncBathroomFloorTileScopeItems(next, {
        bathroomFloorSqft: measurements.bathroomFloorSqft,
        bathFloorTileCount: measurements.bathFloorTileCount,
      });
      return next;
    });
  }, [
    embedQmScopeInQuickMeasurements,
    measurements.bathCount,
    measurements.tilePanBathCount,
    measurements.showerWallTileSqft,
    measurements.showerFloorTileSqft,
    measurements.bathroomFloorSqft,
    measurements.bathFloorTileCount,
  ]);

  // Paint SF in Quick measurements → auto-select Interior painting (Yes).
  useEffect(() => {
    setItems((prev) =>
      syncInteriorPaintScopeItems(prev, { wallPaintSqft: measurements.wallPaintSqft })
    );
  }, [measurements.wallPaintSqft]);

  // Quick measurements Paint / shower tile → paint_repair count when scope is selected.
  useEffect(() => {
    if (String(checklist?.templateKey || '').toLowerCase() !== 'bathroom') return;
    setMeasurementsSynced((prev) => syncBathroomPaintRepairItemQuantity(prev, items));
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
    setItems((prev) => syncWaterproofingFromTileScopeItems(prev));
  }, [
    items.find((row) => row.id === 'shower_tile')?.state,
    items.find((row) => row.id === 'shower_floor_tile')?.state,
  ]);

  useEffect(() => {
    if (!embedQmScopeInQuickMeasurements) return;
    setItems((prev) =>
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
    setItems((prev) =>
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
      activeScopeKeys: displayItems.filter(checklistItemInScope).map((item) => item.id),
      excludedScopeKeys: displayItems.filter((item) => item.state === 'excluded').map((item) => item.id),
    }),
    [displayItems]
  );

  const unconfirmedSuggestedPricing = useMemo<UnconfirmedSuggestedPricing[]>(() => {
    const rows: UnconfirmedSuggestedPricing[] = [];
    const footerScopeKeys = new Set<string>();
    const bathroomPaintRepairCardVisible =
      items.some((candidate) => candidate.id === 'paint_repair') ||
      displayItems.some((candidate) => candidate.id === 'paint_repair');
    const bathroomPaintRepairScopeSelected =
      bathroomPaintRepairCardVisible &&
      hasPaintRepairScopeSelection({
        localizedScope: measurements.bathroomPaintRepairScope,
        entireRoom: measurements.bathroomPaintRepairEntireRoom,
        legacyScope: measurements.bathroomPaintRepairScope,
        scopeSource: measurements.bathroomPaintRepairScopeSource,
      });
    for (const item of displayItems) {
      if (!checklistItemInScope(item)) continue;
      // Interior Finishes is a planning comparison host, not a selectable
      // price line. Its child trades must be priced separately.
      if (item.id === 'interior_finishes') continue;
      // Paint/patch is a two-step scope: Yes selects the card, but the
      // contractor must still choose affected-area or full-room before it
      // becomes a ready price.
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
      // Bathroom patch/full-room paint is one physical card. Legacy QM paint IDs
      // (interior_paint/paint/prep) and drywall/patch must not create a second
      // ready row when paint_repair becomes priceable after scope selection.
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
      // "Not sure" means the scope is not selected yet. Do not count or bulk-apply
      // its pricing suggestion until the contractor chooses Yes/included.
      if (item.state === 'unsure') continue;
      // Any committed/manual/applied price — national average is comparison-only.
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
          checklist?.templateKey
        )
      ) {
        continue;
      }
      const resolved = resolveChecklistItemQuantity(item.id, normMeasurements, {
        choiceId: item.choiceId,
        templateKey: checklist?.templateKey,
        notes: scopeNotes,
      });
      const initialSuggested = resolveScopeItemSuggestedPricing(
        item.id,
        measurements,
        checklist?.templateKey,
        resolved,
        enrichedPricingContext,
        item.choiceId
      );
      const intelligence = resolveScopeItemIntelligence({
        scopeKey: item.id,
        templateKey: checklist?.templateKey,
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
        templateKey: checklist?.templateKey,
        resolved,
        pricingContext: enrichedPricingContext,
        intelligence,
        suggested: initialSuggested,
        choiceId: item.choiceId,
      });
      // Applyable fills only — never included-in-stage or comparison-only cards.
      if (
        suggested.fill &&
        !suggested.fill.isComparison &&
        suggested.fill.benchmarkAction !== 'included_in_stage' &&
        suggested.fill.benchmarkAction !== 'comparison_only' &&
        suggested.fill.total > 0
      ) {
        rows.push({ itemId: item.id, label: item.label, block: suggested.fill });
        footerScopeKeys.add(footerScopeKey);
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
      // Prefer trade cards over a broad stage allowance in the same Use-all batch.
      if (
        block.benchmarkAction === 'benchmark_only' &&
        stageKey &&
        tradeStages.has(stageKey)
      ) {
        return false;
      }
      // Keep price_ready trades (Foundation, Framing, …) in the bulk list even when
      // a stage allowance is already applied — merge clears the allowance on apply.
      return true;
    });
  }, [items, displayItems, measurements, normMeasurements, checklist?.templateKey, scopeNotes, enrichedPricingContext, scopeAssemblyContext, benchmarkRefresh]);

  const scopeItemsNeedingConfirmation = useMemo(
    () =>
      listScopeItemsNeedingConfirmation(displayItems, normMeasurements, {
        templateKey: checklist?.templateKey,
        notes: scopeNotes,
        pricingAcceptance: measurements.pricingAcceptance,
        bathroomPaintRepairScope: measurements.bathroomPaintRepairScope,
        bathroomPaintRepairEntireRoom: measurements.bathroomPaintRepairEntireRoom,
        bathroomToiletRelocateFloorType: measurements.bathroomToiletRelocateFloorType,
        bathroomVanityCountertopMaterialType: measurements.bathroomVanityCountertopMaterialType,
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

  const suggestedPricingFooterBreakdown = useMemo(() => {
    let readyCount = 0;
    let benchmarkOnlyCount = 0;
    const selectedScopeIds = new Set(
      displayItems
        .filter((item) => checklistItemInScope(item) && item.state !== 'unsure')
        .map((item) => item.id)
    );
    const appliedScopeIds = new Set(step2AppliedPricingLines.map((line) => line.itemId));
    const appliedScopeLabels = new Set(
      step2AppliedPricingLines.map((line) => String(line.label || '').trim().toLowerCase())
    );
    const readyRows: UnconfirmedSuggestedPricing[] = [];
    for (const row of unconfirmedSuggestedPricing) {
      // The suggestion list can briefly retain a row while a Yes/No/Not sure
      // choice is being synchronized. Count only currently selected scope items.
      if (!selectedScopeIds.has(row.itemId)) continue;
      // Applied pricing lines are the source of truth for this footer. This
      // also prevents stale suggestion rows from being counted after a card
      // has already been priced.
      if (
        appliedScopeIds.has(row.itemId) ||
        appliedScopeLabels.has(String(row.label || '').trim().toLowerCase())
      ) {
        continue;
      }
      if (
        scopeHasCommittedConfirmScopePrice({
          itemId: row.itemId,
          itemQuantities: measurements.itemQuantities,
          pricingAcceptance: measurements.pricingAcceptance,
        }) ||
        hasAcceptedScopePricing(
          row.itemId,
          measurements.itemQuantities,
          measurements.pricingAcceptance
        )
      ) {
        continue;
      }
      // National / comparison rows are never "price ready".
      if (
        row.block.isComparison ||
        row.block.benchmarkAction === 'comparison_only' ||
        row.block.benchmarkAction === 'included_in_stage' ||
        /national\s*average\s*comparison/i.test(String(row.block.rateSourceLabel || ''))
      ) {
        continue;
      }
      const isBenchmark =
        row.block.laborSource === 'local_benchmark' || Boolean(row.block.benchmarkEvidence);
      const action = row.block.benchmarkAction;
      if (measurementSemanticsV1Enabled() && (action === 'benchmark_only' || (isBenchmark && !row.block.benchmarkEvidence?.quantityRoles?.primaryTakeoff?.quantity))) {
        benchmarkOnlyCount += 1;
      } else {
        readyCount += 1;
        readyRows.push(row);
      }
    }
    return {
      readyCount,
      benchmarkOnlyCount,
      readyRows,
      readyLabels: readyRows.map((row) => row.label),
    };
  }, [
    displayItems,
    measurements.itemQuantities,
    measurements.pricingAcceptance,
    step2AppliedPricingLines,
    unconfirmedSuggestedPricing,
  ]);

  const applySuggestedPricingBlocks = useCallback(
    (rows: UnconfirmedSuggestedPricing[]) => {
      if (!rows.length) return;
      hapticTap();
      selectedPricingRef.current = {
        ...selectedPricingRef.current,
        ...Object.fromEntries(rows.map((row) => [row.itemId, row.block])),
      };
      setMeasurementsSynced((prev) => {
        const { measurements, clearedSelectedOwners } = mergeSuggestedPricingBlocksIntoMeasurements(
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
    const baseItemId = itemId.replace(/__(allowance|sqft_basis|material|labor)$/, '');
    const rule = getChecklistItemQuantityRuleOrDefault(baseItemId, checklist?.templateKey);
    if (field === 'allowance' && rule?.dualAllowanceField) {
      setMeasurementsSynced((prev) => ({
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
    setMeasurementsSynced((prev) => {
      const previousEntry = prev.itemQuantities[itemId];
      const itemQuantities = {
        ...prev.itemQuantities,
        [itemId]: {
          quantity,
          unit: unit || (rule?.dualAllowanceField ? 'each' : rule.defaultUnit),
          quantitySource: source,
          ...(source === 'calculated_confirmed' && calculatedRevertFrom
            ? {
                quantityBeforeCalculated:
                  previousEntry?.quantityBeforeCalculated ?? calculatedRevertFrom,
              }
            : {}),
        },
      };

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
        const hasManualPricing = [allowanceKey, materialKey, laborKey].some((key) => {
          const entry = prev.itemQuantities[key];
          return entry?.quantitySource === 'user_entered' && String(entry.quantity || '').trim();
        });

        if (!hasManualPricing) {
          const nextInput = { ...prev, itemQuantities };
          const normalized = buildNormalizedScopeMeasurementsFromInput(nextInput, {
            notes: scopeNotes,
            templateKey: checklist?.templateKey,
          });
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
          : source === 'user_entered' && field === 'count' && !/__(allowance|sqft_basis|material|labor)$/.test(itemId)
            ? (() => {
                const next = { ...(prev.pricingAcceptance || {}) };
                delete next[itemId];
                return next;
              })()
          : source === 'user_entered' && /__(allowance|sqft_basis|material|labor)$/.test(itemId)
            ? markManualPricingAdjustment(
                prev.pricingAcceptance?.[baseItemId],
                baseItemId,
                prev.pricingAcceptance,
                moneyTotalAfterQuantityEdit(baseItemId, itemQuantities, itemId, quantity)
              )
            : prev.pricingAcceptance;

      const nextState = {
        ...prev,
        itemQuantities,
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
      setMeasurementsSynced((prev) => {
        const itemQuantities = { ...prev.itemQuantities };
        let pricingAcceptance = prev.pricingAcceptance;
        for (const update of updates) {
          const baseItemId = update.itemId.replace(/__(allowance|sqft_basis|material|labor)$/, '');
          const rule = getChecklistItemQuantityRuleOrDefault(baseItemId, checklist?.templateKey);
          const quantitySource = update.quantitySource || 'user_entered';
          itemQuantities[update.itemId] = {
            quantity: update.quantity,
            unit: update.unit || (rule?.dualAllowanceField ? 'each' : rule.defaultUnit),
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
      setMeasurementsSynced((prev) => {
        const itemQuantities = { ...(prev.itemQuantities || {}) };
        for (const update of pendingUpdates ?? []) {
          const baseItemId = update.itemId.replace(/__(allowance|sqft_basis|material|labor)$/, '');
          const rule = getChecklistItemQuantityRuleOrDefault(baseItemId, checklist?.templateKey);
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
            scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
          });
        }
        return;
      }
      const rule = getChecklistItemQuantityRuleOrDefault(item.id, checklist?.templateKey);
      const resolved = resolveChecklistItemQuantity(item.id, normMeasurements, {
        choiceId: item.choiceId,
        templateKey: checklist?.templateKey,
        notes: scopeNotes,
      });
      if (!resolved.showInput || resolved.pricingReady) continue;

      const group = groupedItems.find((g) => g.items.some((row) => row.id === item.id));
      if (group?.title) {
        setCollapsedGroups((prev) => ({ ...prev, [group.title]: false }));
      }

      const node = itemRefs.current[item.id];
      const content = scrollContentRef.current;
      if (node && content) {
        node.measureLayout(content, (_x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
        });
      }
      return;
    }
  }, [displayItems, groupedItems, measurements, normMeasurements, checklist?.templateKey, scopeNotes]);

  const handleItemQuantityBlur = (itemId: string, field: 'count' | 'allowance' = 'count') => {
    const focusKey = `${itemId}:${field}`;
    focusedQuantityRef.current = null;
    setTimeout(() => {
      if (focusedQuantityRef.current === focusKey) return;
      setMeasurementsSynced((prev) => {
        const key = field === 'allowance' && isDualAllowanceItem(itemId) ? roughAllowanceSubKey(itemId) : itemId;
        const current = prev.itemQuantities[key];
        if (current?.quantity?.trim()) return prev;
        const itemQuantities = { ...prev.itemQuantities };
        delete itemQuantities[key];
        const baseItemId = key.replace(/__(allowance|sqft_basis|material|labor)$/, '');
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
      setMeasurementsSynced((prev) => {
        const entry = prev.itemQuantities[itemId];
        const snapshot = entry?.quantityBeforeCalculated;
        if (!snapshot) return prev;
        const itemQuantities = { ...prev.itemQuantities };
        if (snapshot.relatedEntries && Object.keys(snapshot.relatedEntries).length > 0) {
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
            quantity: snapshot.quantity != null ? String(snapshot.quantity) : '',
            unit: snapshot.unit,
            quantitySource: snapshot.quantitySource ?? 'inferred',
          };
        }
        const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
        if (Object.prototype.hasOwnProperty.call(snapshot, 'pricingAcceptanceBeforeCalculated')) {
          if (snapshot.pricingAcceptanceBeforeCalculated) {
            pricingAcceptance[itemId] = snapshot.pricingAcceptanceBeforeCalculated;
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

  const handleItemQuantityFocus = (itemId: string, field: 'count' | 'allowance' = 'count') => {
    focusedQuantityRef.current = `${itemId}:${field}`;
    setMeasurementsSynced((prev) => {
      const baseItemId = itemId.replace(/__(allowance|sqft_basis|material|labor)$/, '');
      const rule = getChecklistItemQuantityRuleOrDefault(baseItemId, checklist?.templateKey);
      let key = itemId;
      if (field === 'allowance' && rule.dualAllowanceField && !itemId.includes('__')) {
        key = roughAllowanceSubKey(baseItemId);
      }
      if (prev.itemQuantities[key]?.quantitySource === 'user_entered') return prev;
      const unitForKey = (() => {
        if (key.endsWith('__allowance') || key.endsWith('__material') || key.endsWith('__labor')) {
          return 'allowance';
        }
        if (key.endsWith('__sqft_basis')) {
          return (
            resolveAllowanceEditorPricingBasis(baseItemId, prev, checklist?.templateKey)?.unit || 'sqft'
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
      replaceStageKey?: string | null
    ) => {
      hapticTap();
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
        [itemId]: block,
      };
      const acceptance = buildAcceptanceFromSuggestedBlock(block);
      const semanticsOn = measurementSemanticsV1Enabled();
      const isBenchmarkBlock =
        block.materialSource === 'local_benchmark' || block.laborSource === 'local_benchmark';

      setMeasurementsSynced((prev) => {
        const rule = getChecklistItemQuantityRuleOrDefault(itemId, checklist?.templateKey);
        const allowanceKey = rule.dualAllowanceField
          ? roughAllowanceSubKey(itemId)
          : allowanceSplitSubKey(itemId, 'allowance');
        const basisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
        const materialKey = allowanceSplitSubKey(itemId, 'material');
        const laborKey = allowanceSplitSubKey(itemId, 'labor');
        const existingEntry = prev.itemQuantities[itemId] as
          | { quantity?: string; unit?: string; quantitySource?: string; measurementState?: ScopeMeasurementState }
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
            (key) => !key.endsWith(`::stage::${replaceStageKey}`)
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
          const livingQty = Number(block.basis?.quantity || block.benchmarkEvidence?.benchmarkBasis.quantity || 0);
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
                quantity: Number.isFinite(previousPrimaryQty) ? previousPrimaryQty : null,
                unit: (previousPrimaryUnit as any) || preferredPrimaryUnit(itemId),
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
            pricing: livingQty > 0 ? livingSfPricingRecord(livingQty, 'local_benchmark') : null,
            benchmark: livingQty > 0 ? livingSfBenchmarkRecord(livingQty) : null,
            status: primaryTakeoff?.quantity != null ? 'partially_measured' : missingStatusForScope(itemId),
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
              itemId === 'electrical' && block.basis?.unit === 'each' && block.basis.quantity != null
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
          ...prev,
          itemQuantities,
          pricingOverrideLog,
          appliedBenchmarkKeys,
          pricingAcceptance: {
            ...pricingAcceptance,
            [itemId]: acceptance,
          },
          scopeGapResolutions: syncScopeGapPricingStatuses(prev.scopeGapResolutions, {
            itemQuantities,
            pricingAcceptance: {
              ...pricingAcceptance,
              [itemId]: acceptance,
            },
          }),
        };
      });
      setTimeout(() => persistScopeProgressNow(), 0);
    },
    [checklist?.templateKey, persistScopeProgressNow, setMeasurementsSynced]
  );

  const handleClearAcceptedPricing = useCallback(
    (itemId: string) => {
      hapticTap();
      const nextSelected = { ...selectedPricingRef.current };
      delete nextSelected[itemId];
      selectedPricingRef.current = nextSelected;
      setMeasurementsSynced((prev) => {
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
          itemQuantities: measurements.itemQuantities,
          pricingAcceptance: measurements.pricingAcceptance,
        }) ||
          hasAcceptedScopePricing(
            itemId,
            measurements.itemQuantities,
            measurements.pricingAcceptance
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
        stageHasAcceptedTradePricing(stageKey, measurements.pricingAcceptance)
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
        stageHasAcceptedBenchmarkPricing(stageKey, measurements.pricingAcceptance)
      ) {
        Alert.alert(
          'Replace stage allowance?',
          `The ${stageTitle(stageKey)} planning allowance is already applied. Replace it with this separate ${itemId.replace(/_/g, ' ')} material and labor price to avoid double counting?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace allowance',
              onPress: () =>
                applySuggestedPricingNow(itemId, block, false, stageKey),
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
        (measurements.appliedBenchmarkKeys || []).includes(appKey)
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
          (Boolean(evidence) && !evidence?.quantityRoles?.primaryTakeoff?.quantity));

      const needsConfirmation =
        isTemporary ||
        (evidence &&
          (evidence.priceConfidence === 'low' ||
            evidence.quantityConfidence === 'low' ||
            unitMismatch)) ||
        Boolean(validation?.requiresExplicitOverride);

      if (!needsConfirmation) {
        applySuggestedPricingNow(itemId, block);
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
            onPress: () => applySuggestedPricingNow(itemId, block, true),
          },
        ]
      );
    },
    [
      applySuggestedPricingNow,
      measurements.appliedBenchmarkKeys,
      measurements.itemQuantities,
      measurements.pricingAcceptance,
    ]
  );

  const performScrollToScopeItem = useCallback((targetItemId: string): boolean => {
    const node = itemRefs.current[targetItemId];
    const content = scrollContentRef.current;
    if (!node || !content) return false;
    node.measureLayout(
      content,
      (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
        if (pendingScrollToScopeItemRef.current === targetItemId) {
          pendingScrollToScopeItemRef.current = null;
        }
      },
      () => {
        /* layout not ready — deferred retry handles this */
      }
    );
    return true;
  }, []);

  const scrollToScopeItem = useCallback((targetItemId: string) => {
    const group = groupedItems.find((g) => g.items.some((row) => row.id === targetItemId));
    if (group?.title) {
      setCollapsedGroups((prev) => ({ ...prev, [group.title]: false }));
    }
    pendingScrollToScopeItemRef.current = targetItemId;
  }, [groupedItems]);

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
        ...pending.map((item) => ({
          text: item.label,
          onPress: () => {
            scrollToScopeItem(item.itemId);
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [scopeItemsNeedingConfirmation, scrollToScopeItem]);

  const handleUseAllSuggestedPricing = useCallback(() => {
    // Only apply rows the footer counted as ready — never national comparisons
    // or scopes that already have committed pricing.
    const rows = suggestedPricingFooterBreakdown.readyRows;
    if (!rows.length) return;

    const needsReview = rows.filter(({ itemId, block }) => {
      const evidence = block.benchmarkEvidence;
      if (!evidence) return false;
      const unitMismatch = Boolean(
        evidence.primaryTakeoff?.unit &&
          evidence.primaryTakeoff.unit !== evidence.benchmarkBasis.unit
      );
      const validation = measurementValidationRequiredForBenchmark()
        ? validatePricingBasis({
            itemId,
            primaryQuantity: evidence.primaryTakeoff?.quantity,
            primaryUnit: evidence.primaryTakeoff?.unit,
            pricingQuantity: evidence.blendedBenchmark.appliedQuantity,
            pricingUnit: evidence.blendedBenchmark.unit,
            rate: evidence.blendedBenchmark.rate,
            rateUnit: evidence.blendedBenchmark.unit,
            calculatedTotal: block.total,
            measurementStatus: missingStatusForScope(itemId),
            selectedSource: 'local_benchmark',
          })
        : null;
      return Boolean(
        evidence.priceConfidence === 'low' ||
          evidence.quantityConfidence === 'low' ||
          unitMismatch ||
          validation?.requiresExplicitOverride
      );
    });

    if (!needsReview.length) {
      applySuggestedPricingBlocks(rows);
      return;
    }

    const reviewNames = needsReview
      .slice(0, 3)
      .map((row) => row.label || row.itemId.replace(/_/g, ' '))
      .join(', ');
    const more = needsReview.length > 3 ? ` (+${needsReview.length - 3} more)` : '';
    Alert.alert(
      'Apply all suggested prices?',
      `${rows.length} price${rows.length === 1 ? '' : 's'} will be applied. ${
        needsReview.length
      } planning estimate${needsReview.length === 1 ? '' : 's'} (${reviewNames}${more}) still need review later — you can edit any price after applying.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply all',
          onPress: () => applySuggestedPricingBlocks(rows),
        },
      ]
    );
  }, [applySuggestedPricingBlocks, suggestedPricingFooterBreakdown.readyRows]);

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
      setCollapsedGroups((prev) => ({ ...prev, [firstGroup.title]: false }));
    }

    const firstScopeItemId =
      scopeGroupedItems
        .flatMap((g) => g.items)
        .find(
          (item) => !(embedQmScopeInQuickMeasurements && qmScopeEmbeddedInQuickMeasurements(item.id))
        )?.id ?? null;

    qmDoneFirstScopeItemIdRef.current = firstScopeItemId;
    pendingQmDoneScrollRef.current = true;

    const content = scrollContentRef.current;
    const qm = quickMeasurementsRef.current;
    const collapseQm = () => setQuickMeasurementsOpen(false);

    // Snap to the QM card top before collapse so a tall expanded card cannot leave a
    // stale deep scroll offset that jumps to the page bottom when content shrinks.
    if (content && qm) {
      qm.measureLayout(content, (_x, qmY) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, qmY - 8), animated: false });
        collapseQm();
      });
      return;
    }

    collapseQm();
  }, [scopeGroupedItems, embedQmScopeInQuickMeasurements, qmScopeEmbeddedInQuickMeasurements]);

  const handleScopeGapResolutionsChange = useCallback(
    (next: ScopeGapResolutionsMap) => {
      setMeasurementsSynced((prev) => {
        const pricingContext: ScopeGapPricingContext = {
          itemQuantities: prev.itemQuantities,
          pricingAcceptance: prev.pricingAcceptance,
        };
        return {
          ...prev,
          scopeGapResolutions: syncScopeGapPricingStatuses(next, pricingContext),
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
      const { items: nextItems, lineItemId } = ensureSeparateScopeItemInChecklist(
        itemsRef.current,
        component,
        parentScopeItemId
      );
      setItems(nextItems);
      setMeasurementsSynced((prev) => {
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
      setMeasurementsSynced((prev) => {
        const previousRecord = getScopeGapRecord(prev.scopeGapResolutions, parentScopeItemId, component.key);
        const previousAddon = previousRecord?.parentPriceAddon ?? 0;
        const previousBucket = previousRecord?.parentPriceAddonBucket;
        const bucket = scopeGapAddonCostBucketForComponent(component.key);
        const delta = addonAmount - previousAddon;
        const existingBlock = selectedPricingRef.current[parentScopeItemId];
        if (existingBlock && delta !== 0) {
          selectedPricingRef.current = {
            ...selectedPricingRef.current,
            [parentScopeItemId]: adjustSuggestedPricingBlock(existingBlock, delta, bucket),
          };
        }
        const { itemQuantities, pricingAcceptance } = applyParentScopeGapPriceAddon({
          parentScopeItemId,
          componentKey: component.key,
          addonAmount,
          previousAddonAmount: previousAddon,
          previousAddonBucket: previousBucket,
          itemQuantities: prev.itemQuantities,
          pricingAcceptance: prev.pricingAcceptance,
        });
        const pricingContext: ScopeGapPricingContext = { itemQuantities, pricingAcceptance };
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
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setMeasurementsSynced((prev) => {
        const itemQuantities = { ...prev.itemQuantities };
        delete itemQuantities[itemId];
        delete itemQuantities[`${itemId}__material`];
        delete itemQuantities[`${itemId}__labor`];
        delete itemQuantities[`${itemId}__allowance`];
        return { ...prev, itemQuantities };
      });
    };
    Alert.alert('Delete custom item?', 'This removes the custom scope card and its price.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  };

  const handleWetAreaInstallSelect = useCallback(
    (choiceId: string) => {
      setItems((prev) => {
        const next = prev.map((row) =>
          row.id === 'wet_area_install'
            ? { ...row, choiceId, state: choiceIdToState(choiceId) }
            : row
        );
        return next.map((row) => {
          if (row.state !== 'unsure') return row;
          if (choiceId === 'tile_pan') {
            if (['shower_floor_tile', 'waterproofing', 'shower_tile'].includes(row.id)) {
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
        setMeasurementsSynced((m) => ({ ...m, wetAreaFinish: finish }));
      }
    },
    [setMeasurementsSynced]
  );

  const renderItem = (item: ScopeChecklistItem) => {
    if (embedQmScopeInQuickMeasurements && qmScopeEmbeddedInQuickMeasurements(item.id)) {
      return null;
    }
    const useWetAreaLineCard =
      item.id !== 'shower_pan' &&
      (item.derivedFrom === 'wet_area_install' || WET_AREA_DERIVED_ITEM_IDS.has(item.id));
    const row = useWetAreaLineCard ? (
      <WetAreaInstallLineCard
        item={item}
        templateKey={checklist?.templateKey}
        originalNotes={scopeNotes}
        measurementsInput={measurements}
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
        onToggle={(optionId) => {
          setItems((prev) =>
            prev.map((row) => {
              if (row.id !== item.id) return row;
              const currentChoiceIds = row.choiceIds ?? (row.choiceId ? [row.choiceId] : []);
              const choiceIds =
                optionId === 'unsure' || optionId === 'not_in_scope'
                  ? currentChoiceIds.length === 1 && currentChoiceIds[0] === optionId
                    ? []
                    : [optionId]
                  : [
                      ...currentChoiceIds.filter(
                        (id) => id !== 'unsure' && id !== 'not_in_scope' && id !== optionId
                      ),
                      ...(currentChoiceIds.includes(optionId) ? [] : [optionId]),
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
          if (item.id === 'electrical' || item.id === 'plumbing' || item.id === 'lighting') {
            setMeasurementsSynced((previous) => {
              const cleared = clearAcceptedScopeItemPricing({
                itemId: item.id,
                itemQuantities: previous.itemQuantities || {},
                pricingAcceptance: previous.pricingAcceptance,
              });
              const itemQuantities = { ...cleared.itemQuantities };
              if (optionId !== 'unsure' && optionId !== 'not_in_scope') {
                const existingCount = Number(previous.itemQuantities?.[item.id]?.quantity);
                itemQuantities[item.id] = {
                  quantity:
                    Number.isFinite(existingCount) && existingCount > 0
                      ? String(existingCount)
                      : '1',
                  unit: 'each',
                  quantitySource: 'user_entered',
                };
                if (['plumbing', 'electrical', 'lighting'].includes(item.id)) {
                  const existingOptionCount = Number(
                    previous.itemQuantities?.[`${item.id}__${optionId}`]?.quantity
                  );
                  itemQuantities[`${item.id}__${optionId}`] = {
                    quantity:
                      Number.isFinite(existingOptionCount) && existingOptionCount > 0
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
        measurementsInput={measurements}
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
        onSelect={(choiceId) => {
          const isBathroomCountertop =
            item.id === 'countertops' && String(templateKey || '').toLowerCase() === 'bathroom';
          const nextChoiceId =
            isBathroomCountertop && item.choiceId === choiceId ? null : choiceId;
          setItems((prev) => {
            const next = prev.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    choiceId: nextChoiceId,
                    state: nextChoiceId ? choiceIdToState(nextChoiceId) : row.state,
                  }
                : row
            );
            if (item.id !== 'wet_area_install') return next;
            return next.map((row) => {
              if (row.state !== 'unsure') return row;
              if (choiceId === 'tile_pan') {
                if (['shower_floor_tile', 'waterproofing', 'shower_tile'].includes(row.id)) {
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
              setMeasurementsSynced((m) => ({ ...m, wetAreaFinish: finish }));
            }
          }
          if (isBathroomCountertop) {
            setMeasurementsSynced((m) => ({
              ...m,
              bathroomVanityCountertopMaterialType: nextChoiceId,
            }));
          }
          if (item.id === 'toilet' && nextChoiceId !== 'relocating') {
            setMeasurementsSynced((m) => ({
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
            setMeasurementsSynced((previous) => {
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
        onBathroomToiletRelocateFloorTypeChange={handleBathroomToiletRelocateFloorTypeChange}
        onBathroomShowerRoughFixtureTypeChange={handleBathroomShowerRoughFixtureTypeChange}
        onBathroomShowerRoughWorkTypeChange={handleBathroomShowerRoughWorkTypeChange}
        onBathroomShowerRoughPlumbingExposedChange={handleBathroomShowerRoughPlumbingExposedChange}
        onBathroomShowerRoughFloorConstructionChange={handleBathroomShowerRoughFloorConstructionChange}
        onBathroomShowerRoughSlabWorkRequiredChange={handleBathroomShowerRoughSlabWorkRequiredChange}
        onBathroomPaintRepairScopeChange={handleBathroomPaintRepairScopeChange}
        onBathroomDrywallPaintCombinedAssemblyChange={handleBathroomDrywallPaintCombinedAssemblyChange}
        onBathroomInteriorPaintMobilizationChange={handleBathroomInteriorPaintMobilizationChange}
        onBathroomInteriorPaintSurfaceChange={handleBathroomInteriorPaintSurfaceChange}
        onBathroomInteriorPaintConditionChange={handleBathroomInteriorPaintConditionChange}
        onBathroomGlassDoorStyleChange={handleBathroomGlassDoorStyleChange}
        scopeChecklistItems={displayItems}
        measurementsInput={measurements}
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
      <YesNoRow
        item={item}
        templateKey={checklist?.templateKey}
        originalNotes={scopeNotes}
        onSetState={(state) => {
          setItems((prev) => {
            let next = prev.map((row) => (row.id === item.id ? { ...row, state } : row));
            next = applyKitchenScopeInferences(next, checklist?.templateKey, {
              notes: scopeNotes,
              measurements: normMeasurements,
            });
            if (item.id === 'shower_tile' || item.id === 'shower_floor_tile') {
              next = syncWaterproofingFromTileScopeItems(next);
            }
            return next;
          });
          if (item.id === 'plumbing_rough' && state !== 'included') {
            setMeasurementsSynced((m) => ({
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
            ? (label) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, label } : row)))
            : undefined
        }
        onDelete={isCustomScopeItem(item) ? () => handleDeleteCustomItem(item.id) : undefined}
        onSaveCustomPricing={isCustomScopeItem(item) ? persistScopeProgressNow : undefined}
        onBathroomToiletRelocateFloorTypeChange={handleBathroomToiletRelocateFloorTypeChange}
        onBathroomShowerRoughFixtureTypeChange={handleBathroomShowerRoughFixtureTypeChange}
        onBathroomShowerRoughWorkTypeChange={handleBathroomShowerRoughWorkTypeChange}
        onBathroomShowerRoughPlumbingExposedChange={handleBathroomShowerRoughPlumbingExposedChange}
        onBathroomShowerRoughFloorConstructionChange={handleBathroomShowerRoughFloorConstructionChange}
        onBathroomShowerRoughSlabWorkRequiredChange={handleBathroomShowerRoughSlabWorkRequiredChange}
        onBathroomPaintRepairScopeChange={handleBathroomPaintRepairScopeChange}
        onBathroomDrywallPaintCombinedAssemblyChange={handleBathroomDrywallPaintCombinedAssemblyChange}
        onBathroomInteriorPaintMobilizationChange={handleBathroomInteriorPaintMobilizationChange}
        onBathroomInteriorPaintSurfaceChange={handleBathroomInteriorPaintSurfaceChange}
        onBathroomInteriorPaintConditionChange={handleBathroomInteriorPaintConditionChange}
        onBathroomGlassDoorStyleChange={handleBathroomGlassDoorStyleChange}
        scopeChecklistItems={displayItems}
        measurementsInput={measurements}
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
        ref={(node) => {
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
    const baseItems = displayItems.length ? displayItems : items;
    const confirmItems = finalizeWetAreaInstallScopeFromMeasurements(
      scopeChecklistItemsForPersist(baseItems),
      payload
    );
    onConfirm(confirmItems, payload);
  };

  const handleAddCustomItem = () => {
    const trimmed = customItemLabel.trim();
    if (!trimmed) return;
    hapticTap();
    setItems((prev) => [...prev, createCustomScopeItem(trimmed)]);
    setCustomItemLabel('');
    setShowCustomItemInput(false);
    setCollapsedGroups((prev) => ({ ...prev, ['Other']: false }));
  };

  const handleBack = () => {
    persistScopeProgressNow();
    onBack();
  };

  const handleClose = () => {
    persistScopeProgressNow();
    onClose();
  };

  const handleScopeOnly = () => {
    persistScopeProgressNow();
    onScopeOnly?.(scopeMeasurementsPayloadForCurrentState());
  };

  if (!visible || !draft || !checklist) return null;

  const body = (
    <View style={[styles.shell, { backgroundColor: Colors.bg }]}>
      <AIEstimateFlowHeader
        title="Confirm scope"
        subtitle="What work is in this bid?"
        step={2}
        stepTotal={3}
        fromAssistant={fromAssistant}
        disabled={applying}
        onBack={handleBack}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + (showCustomItemInput ? 260 : 200),
        }}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}
        showsVerticalScrollIndicator
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollOffsetYRef.current = e.nativeEvent.contentOffset.y;
        }}
      >
        <View ref={scrollContentRef} collapsable={false}>
        <AIEstimateDisclaimer variant="review" />
        <Text
          style={{
            color: captionColor(darkMode, Colors),
            fontSize: 12,
            marginTop: 4,
            marginBottom: 12,
            lineHeight: 17,
          }}
        >
          {noteSummary.fromNotes > 0 ? `${scopeLinkedToNotesSummary(noteSummary.fromNotes)} · ` : ''}
          {summary.included} included
          {summary.needsMeasurement > 0 ? (
            <>
              {' · '}
              <Text onPress={scrollToFirstMissingMeasurement} style={{ color: '#fbbf24', fontWeight: '700' }}>
                {summary.needsMeasurement} need measurements
              </Text>
            </>
          ) : (
            ' · 0 need measurements'
          )}
          {summary.unsure > 0 ? (
            <>
              {' · '}
              {summary.unsure} not sure
            </>
          ) : null}
        </Text>

        <CollapsibleQuickMeasurements
          expanded={quickMeasurementsOpen}
          onToggle={() => setQuickMeasurementsOpen((v) => !v)}
          onDone={handleQuickMeasurementsDone}
          containerRef={quickMeasurementsRef}
          measurements={measurements}
          setMeasurements={setMeasurementsSynced}
          templateKey={checklist?.templateKey}
          projectType={draft?.projectType}
          notes={scopeNotes}
          includedScopeKeys={scopeAssemblyContext.activeScopeKeys}
          onSummaryChange={setQuickMeasurementSummary}
          onWetAreaFinishChange={(finish) => {
            const choiceId = checklistChoiceFromWetAreaFinish(finish);
            if (!choiceId) return;
            setItems((prev) =>
              prev.map((row) =>
                row.id === 'wet_area_install'
                  ? { ...row, choiceId, state: choiceIdToState(choiceId) }
                  : row
              )
            );
          }}
          onWetAreaSteppersChange={(counts, options) => {
            setItems((prev) => {
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
          onWetAreaExistingDemoChange={({ demo, reuseExistingShowerDoor }) => {
            setItems((prev) =>
              syncWetAreaDemoScopeItems(prev, {
                demo,
                reuseExistingShowerDoor,
                installShowerDoorCount: measurements.showerDoorCount,
              })
            );
          }}
          onKitchenQmChange={({ existing, install, demo }) => {
            setItems((prev) => syncKitchenQmScopeItems(prev, { ...existing, ...install, ...demo }));
          }}
          onFlooringQmChange={({ existing, install, demo }) => {
            setItems((prev) => syncFlooringQmScopeItems(prev, { ...existing, ...install, ...demo }));
          }}
          onBathroomFixturesQmChange={({ existing, install, demo }) => {
            setItems((prev) =>
              syncBathroomFixtureQmScopeItems(prev, { ...existing, ...install, ...demo })
            );
          }}
          onBathroomCountertopMaterialChange={handleBathroomCountertopMaterialChange}
          onShowerDoorCountChange={(count) => {
            if (count == null || count < 1) return;
            setItems((prev) => {
              if (!prev.some((row) => row.id === 'glass_door')) {
                const afterIdx = prev.findIndex((row) => row.id === 'shower_floor_tile');
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
              return prev.map((row) =>
                row.id === 'glass_door' ? { ...row, state: 'included' as const } : row
              );
            });
          }}
          onGarageDoorCountsChange={(totalCount) => {
            if (totalCount == null || totalCount < 1) return;
            setItems((prev) => {
              if (!prev.some((row) => row.id === 'garage_doors')) {
                const afterIdx = prev.findIndex((row) => row.id === 'sliding_doors');
                const fallbackIdx = prev.findIndex((row) => row.id === 'windows');
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
              return prev.map((row) =>
                row.id === 'garage_doors' ? { ...row, state: 'included' as const } : row
              );
            });
          }}
          wetAreaInstallChoiceId={
            displayItems.find((row) => row.id === 'wet_area_install')?.choiceId ?? null
          }
          showExistingWetAreaPanel={!hasSitePhotos}
          hasSitePhotos={hasSitePhotos}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />

        {scopeGroupedItems.map((group) => (
          <ScopeGroupSection
            key={group.title || 'all'}
            title={group.title}
            items={group.items}
            collapsed={Boolean(collapsedGroups[group.title])}
            onToggle={() =>
              setCollapsedGroups((prev) => ({ ...prev, [group.title]: !prev[group.title] }))
            }
            renderItem={renderItem}
            noteSummary={scopeChecklistNoteSummary(group.items, visualCtx)}
            Colors={Colors}
            darkMode={darkMode}
          />
        ))}

        {step2AppliedEstimateTotal > 0 ? (
          <BenchmarkReasonablenessCard
            value={benchmarkReasonableness}
            buildCostPerLivingSf={step2AppliedBuildCostPerLivingSf}
            buildCostUnitSuffix={appliedBuildCostArea?.unitSuffix ?? 'living SF'}
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

        <TouchableOpacity
          style={[
            styles.addScopeItemBtn,
            {
              borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
              backgroundColor: darkMode ? 'rgba(255,255,255,0.02)' : Colors.surface2,
            },
          ]}
          onPress={() => {
            setShowCustomItemInput((open) => {
              const next = !open;
              if (next) {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
              }
              return next;
            });
          }}
          disabled={applying}
          activeOpacity={0.75}
        >
          <Ionicons name="add-circle-outline" size={18} color="#22c55e" />
          <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}>Add scope item</Text>
        </TouchableOpacity>

        {showCustomItemInput ? (
          <View style={[styles.customItemCard, estimateFlowCardStyle(Colors, darkMode)]}>
            <View style={styles.customItemHeader}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800' }}>
                Custom scope item
              </Text>
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, lineHeight: 16 }}>
                Add work the AI or template missed. You can price it after adding.
              </Text>
            </View>
            <View style={styles.customItemInputRow}>
              <TextInput
                value={customItemLabel}
                onChangeText={setCustomItemLabel}
                placeholder="e.g. heated floor, transition strip"
                placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
                returnKeyType="done"
                blurOnSubmit
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)}
                onSubmitEditing={() => Keyboard.dismiss()}
                editable={!applying}
                style={[
                  styles.customItemInput,
                  {
                    color: Colors.text,
                    borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
                  },
                ]}
              />
              <TouchableOpacity
                style={[styles.customItemAddBtn, !customItemLabel.trim() && { opacity: 0.45 }]}
                onPress={handleAddCustomItem}
                disabled={applying || !customItemLabel.trim()}
              >
                <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 12 }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: Colors.bg,
            borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.primaryBtn, applying && styles.primaryBtnDisabled]}
          onPress={handleConfirm}
          disabled={applying}
          activeOpacity={0.88}
        >
          {applying ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.primaryBtnText}>Continue to review</Text>
          )}
        </TouchableOpacity>

        {suggestedPricingFooterBreakdown.readyCount > 0 ||
        suggestedPricingFooterBreakdown.benchmarkOnlyCount > 0 ||
        quickMeasurementSummary.needsConfirmation > 0 ? (
          <View style={styles.bulkSuggestedPricingLink}>
            {quickMeasurementSummary.needsConfirmation > 0 ? (
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Pricing readiness',
                    [
                      footerSuggestedPricingSummary({
                        readyCount: suggestedPricingFooterBreakdown.readyCount,
                        benchmarkOnlyCount: suggestedPricingFooterBreakdown.benchmarkOnlyCount,
                      }),
                      suggestedPricingFooterBreakdown.readyLabels.length
                        ? `Waiting to apply: ${suggestedPricingFooterBreakdown.readyLabels.join(', ')}.`
                        : '',
                      FOOTER_PLANNING_BENCHMARK_INFO,
                      `${quickMeasurementSummary.needsConfirmation} measurement${
                        quickMeasurementSummary.needsConfirmation === 1 ? '' : 's'
                      } still need${
                        quickMeasurementSummary.needsConfirmation === 1 ? 's' : ''
                      } confirmation in Quick measurements before those scopes can move from a planning estimate to a firm price.`,
                      PLANNING_BID_CONFIDENCE_COPY,
                    ]
                      .filter(Boolean)
                      .join('\n\n')
                  )
                }
                disabled={applying}
                activeOpacity={0.75}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                accessibilityLabel={`${quickMeasurementSummary.needsConfirmation} measurements need confirmation`}
              >
                <Text style={[styles.bulkSuggestedPricingBtnText, { color: '#fbbf24' }]}>
                  {`${quickMeasurementSummary.needsConfirmation} measurement${
                    quickMeasurementSummary.needsConfirmation === 1 ? '' : 's'
                  } need confirmation`}
                </Text>
                <Ionicons name="information-circle-outline" size={16} color="#fbbf24" />
              </TouchableOpacity>
            ) : suggestedPricingFooterBreakdown.readyCount > 0 ||
              suggestedPricingFooterBreakdown.benchmarkOnlyCount > 0 ? (
              <TouchableOpacity
                onPress={handleUseAllSuggestedPricing}
                disabled={applying || suggestedPricingFooterBreakdown.readyCount === 0}
                activeOpacity={0.75}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                accessibilityLabel={
                  footerSuggestedPricingSummary({
                    readyCount: suggestedPricingFooterBreakdown.readyCount,
                    benchmarkOnlyCount: suggestedPricingFooterBreakdown.benchmarkOnlyCount,
                  }) || 'Suggested pricing'
                }
              >
                <Text style={styles.bulkSuggestedPricingBtnText}>
                  {footerSuggestedPricingSummary({
                    readyCount: suggestedPricingFooterBreakdown.readyCount,
                    benchmarkOnlyCount: suggestedPricingFooterBreakdown.benchmarkOnlyCount,
                  })}
                </Text>
                {measurementSemanticsV1Enabled() && suggestedPricingFooterBreakdown.benchmarkOnlyCount > 0 ? (
                  <TouchableOpacity
                    onPress={() => Alert.alert('Pricing readiness', FOOTER_PLANNING_BENCHMARK_INFO)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Pricing readiness info"
                  >
                    <Ionicons name="information-circle-outline" size={16} color="#22c55e" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {onScopeOnly ? (
          <TouchableOpacity
            onPress={handleScopeOnly}
            disabled={applying}
            activeOpacity={0.88}
          >
            <Text style={{ color: Colors.sub, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
              Save scope only
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={handleClose} disabled={applying}>
          <Text style={{ color: Colors.sub, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScopePricingContextValue.Provider value={enrichedPricingContext}>
      <ScopeAssemblyContextValue.Provider value={scopeAssemblyContext}>
        <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBack}>
          <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
          <View style={{ flex: 1, backgroundColor: Colors.bg }}>
            {body}
          </View>
        </Modal>
      </ScopeAssemblyContextValue.Provider>
    </ScopePricingContextValue.Provider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  quickMeasurements: {
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
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
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
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  card: {
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  fromNotesBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
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
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pricingEntryModeChip: {
    flex: 1,
    alignItems: 'center',
  },
  savePricingBtn: {
    marginTop: 10,
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
  useSuggestedPricingBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  useSuggestedPricingBtnText: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '700',
  },
  /** Secondary opt-in for national comparison (distinct from green Apply). */
  useComparisonPricingBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  useComparisonPricingBtnText: {
    color: '#fbbf24',
    fontSize: 15,
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  choiceChipWide: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: '47%',
    flexGrow: 1,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  compactSuggestedBtnText: {
    color: '#22c55e',
    fontSize: 13,
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
  },
  budgetSplitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  budgetSplitHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
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
  pricingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 44,
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
  bulkSuggestedPricingBtnText: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
});
