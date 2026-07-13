import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  PhotoScopeDetection,
  PlanToMeasurementsResult,
  ScopeAssumptionState,
  ScopeChecklistItem,
  ScopeMeasurements,
} from '@/utils/estimateAiDraft';
import {
  applyScopeDetectionsToChecklistItems,
  formatDraftMoney,
  resolveDraftScopeNotes,
  repairDraftRatePricingFromNotes,
} from '@/utils/estimateAiDraft';
import PlanTakeoffReviewModal from '@/components/estimate/PlanTakeoffReviewModal';
import {
  imagesFromPickerAssets,
  pickPlanFromLibrary,
  pickPlanPdf,
  promptPlanImportSource,
  runPlanTakeoff,
  takePlanPhoto,
} from '@/utils/planImportRunner';
import {
  checklistDisplayHelper,
  choiceIdsToScopeState,
  createCustomScopeItem,
  groupScopeChecklistItems,
  initialScopeGroupCollapse,
  mergeScopeProgressIntoDraft,
  applyKitchenScopeInferences,
  hydrateScopeChecklistFromNotes,
  QUANTITY_NEEDED_LABELS_BY_TEMPLATE,
  quantityNeededLabel,
  scopeChecklistItemsForEditing,
  scopeChecklistItemsForPersist,
  expandWetAreaDerivedScopeItems,
  toggleWallLayoutChoiceIds,
  WET_AREA_DERIVED_ITEM_IDS,
  scopeChecklistSummaryCounts,
} from '@/utils/estimateScopeChecklistUi';
import {
  buildNormalizedScopeMeasurementsFromInput,
  allowanceSplitSubKey,
  checklistItemInScope,
  countScopePricingReadiness,
  DUAL_QUANTITY_FIELD_LABELS,
  formatUnitLabel,
  getChecklistItemQuantityRule,
  getChecklistItemQuantityRuleOrDefault,
  hasCompleteUserSelectedPricing,
  initialScopeMeasurementInputExtended,
  isDualAllowanceItem,
  overlayDualRatePricingDisplay,
  prepareScopeMeasurementsInputForUi,
  resolveChecklistItemQuantity,
  resolveDualRatePricingDisplayFromNotes,
  resolveScopeItemSuggestedPricing,
  isPlaceholderAllowancePricing,
  roughAllowanceSubKey,
  scopeMeasurementsPayloadForPersist,
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
  quickMeasurementRowsForInput,
  quickMeasurementSectionsForRows,
  resolveQuickMeasurementDisplayValue,
  type QuickMeasurementFieldDef,
  type QuickMeasurementFieldKey,
} from '@/utils/scopeQuickMeasurements';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';

import { estimateFlowCardStyle, estimateFlowDividerColor } from '@/utils/estimateFlowCardStyle';
import {
  SCOPE_ITEM_TIER_OPACITY,
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
  hasAcceptedScopePricing,
  markManualPricingAdjustment,
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
};

const QUANTITY_NEEDED_LABELS: Record<string, string> = {
  tub_demo: 'tub count',
  shower_floor_demo: 'shower floor demo sqft',
  wet_area_install: 'tub or pan count',
  shower_tile: 'shower wall sqft',
  shower_floor_tile: 'shower floor sqft',
  waterproofing: 'shower wall sqft',
  shower_pan: 'mud pan count (labor + materials)',
  shower_niche: 'niche count',
  shower_bench_curb: 'bench/curb count or LF',
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
function legPillKind(source: PricingLegSource): 'notes' | 'template' | 'national' {
  if (source === 'notes') return 'notes';
  if (source === 'template') return 'template';
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
  kind: 'notes' | 'national' | 'template' | 'remainder';
  label?: string;
}) {
  const defaultText =
    kind === 'notes'
      ? SCOPE_PARSED_FROM_NOTES_LABEL
      : kind === 'template'
        ? 'Saved rate'
        : kind === 'remainder'
          ? 'Remainder'
          : 'National Average';
  const text = label || defaultText;
  const color =
    kind === 'notes'
      ? '#22c55e'
      : kind === 'template'
        ? '#a78bfa'
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
        numberOfLines={2}
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

function resolveFormulaTargetSuggestedPricing(params: {
  itemId: string;
  measurementsInput: ScopeMeasurementsInputExtended;
  templateKey: string | null | undefined;
  resolved: ReturnType<typeof resolveChecklistItemQuantity>;
  pricingContext?: ScopePricingContext | null;
  intelligence: ScopeItemIntelligence;
  suggested: ReturnType<typeof resolveScopeItemSuggestedPricing>;
}): ReturnType<typeof resolveScopeItemSuggestedPricing> {
  const formula = params.intelligence.formula;
  if (!formula || calculatedQuantityAlreadyActive(params.intelligence)) {
    return params.suggested;
  }

  // Only auto-preview formula-based pricing for concrete flatwork (no manual apply button).
  // Drywall and other trades keep suggested pricing on the notes/current quantity until applied.
  if (!usesAutoFlatworkSqftPricing({ scopeKey: params.itemId, formula })) {
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
    params.pricingContext
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
}: {
  intelligence: ScopeItemIntelligence;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onUseCalculatedQuantity?: () => void;
  onRevertCalculatedQuantity?: () => void;
  calculatedRevertLabel?: string | null;
  compact?: boolean;
  pricingAccepted?: boolean;
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
    !calculatedActive &&
    cardDisplay.showQuantityConfidenceLine &&
    (intelligence.quantity.confidence !== 'high' ||
      intelligence.quantity.source === 'calculated_assumption' ||
      intelligence.quantity.source === 'benchmark_estimate' ||
      Boolean(formula));
  if (compact) {
    if (
      !cardDisplay.conciseBenchmarkWarning &&
      !cardDisplay.duplicatePricingMessage &&
      !cardDisplay.otherNotice &&
      !showFormulaDetails &&
      !showCalculatedRevert
    ) {
      return null;
    }
  } else if (
    !cardDisplay.conciseBenchmarkWarning &&
    !cardDisplay.duplicatePricingMessage &&
    !cardDisplay.otherNotice &&
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

  const warningFull = (cardDisplay.conciseBenchmarkWarning || '').trim();
  const warningFirstSentence = warningFull.split(/(?<=\.)\s+/)[0] || warningFull;
  const warningPreview =
    warningFirstSentence.length > 88
      ? `${warningFirstSentence.slice(0, 85).trimEnd()}…`
      : warningFirstSentence;
  const warningCanExpand = Boolean(warningFull && warningPreview !== warningFull);

  const otherNotice =
    cardDisplay.otherNotice &&
    !(showFormulaDetails && cardDisplay.otherNotice.startsWith('Calculated comparison:'))
      ? cardDisplay.otherNotice
      : null;

  return (
    <View
      style={[
        styles.intelligenceNotice,
        {
          borderColor: darkMode ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.16)',
          backgroundColor: 'transparent',
        },
      ]}
    >
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
      ) : cardDisplay.conciseBenchmarkWarning || cardDisplay.confidenceLabel ? (
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
            {warningCanExpand && !warningExpanded ? ' More' : ''}
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
        <Text style={[styles.intelligenceNoticeText, { color: captionColor(darkMode, Colors) }]}>
          {otherNotice}
        </Text>
      ) : otherNotice && !warningFull ? (
        <Text style={[styles.intelligenceNoticeText, { color: captionColor(darkMode, Colors) }]}>
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
}: {
  block: SuggestedPricingBlock;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onUsePricing?: () => void;
  adjusted?: boolean;
}) {
  const panelBg = darkMode ? 'rgba(96, 165, 250, 0.08)' : 'rgba(96, 165, 250, 0.06)';
  const panelBorder = darkMode ? 'rgba(96, 165, 250, 0.22)' : 'rgba(96, 165, 250, 0.18)';
  const usesTemplate = block.materialSource === 'template' || block.laborSource === 'template';
  const isAdjusted = adjusted || block.rateSourceLabel.startsWith('Adjusted · ');
  const headerTitle =
    block.lumpSumOnly
      ? isAdjusted
        ? 'Adjusted allowance'
        : 'Suggested allowance'
      : block.mode === 'note_total_split' && !isAdjusted
        ? 'Budget split'
        : block.isComparison
          ? 'Suggested comparison'
          : isAdjusted
            ? 'Adjusted pricing'
            : 'Suggested pricing';
  const headerPillKind = isAdjusted ? 'notes' : usesTemplate ? 'template' : 'national';
  const headerPillLabel = isAdjusted
    ? block.rateSourceLabel.replace(/^Adjusted · /, '') || 'User adjusted'
    : block.rateSourceLabel;

  const explanation = isAdjusted
    ? null
    : block.lumpSumOnly
      ? 'Flat allowance, not a material/labor split.'
      : block.mode === 'note_total_split'
        ? `Notes total split using ${usesTemplate ? 'saved rate' : 'National Average'} material.`
        : block.mode === 'fill_missing'
          ? `Missing side filled from ${usesTemplate ? 'saved rate' : 'National Average'}.`
          : block.isComparison
            ? `Compare to ${usesTemplate ? 'saved rate' : 'National Average'}. Notes pricing stays primary.`
            : null;
  const displayBuckets = block.costBuckets?.length
    ? block.costBuckets
    : block.lumpSumOnly
      ? [
          {
            key: 'allowance' as const,
            label: 'Allowance',
            amount: block.total,
            source: block.laborSource,
          },
        ]
      : [
          {
            key: 'material' as const,
            label: 'Material',
            amount: block.material,
            source: block.materialSource,
          },
          {
            key: 'labor' as const,
            label: 'Labor',
            amount: block.labor,
            source: block.laborSource,
          },
        ].filter((bucket) => bucket.amount > 0);

  return (
    <View
      style={[
        styles.budgetSplitPanel,
        { backgroundColor: panelBg, borderColor: panelBorder },
      ]}
    >
      <View style={styles.budgetSplitHeader}>
        <Text
          style={[styles.budgetSplitHeaderTitle, { color: pricingTextColor(darkMode, Colors) }]}
          numberOfLines={2}
        >
          {headerTitle}
        </Text>
        <View style={styles.budgetSplitHeaderPill}>
          <SourcePill
            kind={headerPillKind}
            label={headerSourcePillLabel(headerPillLabel)}
          />
        </View>
      </View>
      {displayBuckets.map((bucket) => (
        <PricingSplitRow
          key={`${bucket.key}:${bucket.label}`}
          label={bucket.label}
          value={formatDraftMoney(bucket.amount)}
          helper={
            bucket.key === 'allowance'
              ? 'Flat allowance'
              : bucket.rate != null
                ? unitRateHelper(String(bucket.rate * (block.basis?.quantity || 1)), block.basis)
                : unitRateHelper(String(bucket.amount), block.basis)
          }
          darkMode={darkMode}
          Colors={Colors}
        />
      ))}
      <PricingSplitRow
        label="Total"
        value={formatDraftMoney(block.total)}
        darkMode={darkMode}
        Colors={Colors}
      />
      {block.helper ? (
        <Text
          style={{
            color: pricingLabelColor(darkMode, Colors),
            fontSize: 12,
            lineHeight: 17,
            marginTop: 8,
          }}
        >
          {block.helper}
        </Text>
      ) : null}
      {explanation ? (
        <Text
          style={{
            color: pricingLabelColor(darkMode, Colors),
            fontSize: 12,
            lineHeight: 17,
            marginTop: 4,
          }}
        >
          {explanation}
        </Text>
      ) : null}
      {onUsePricing ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onUsePricing}
          style={styles.useSuggestedPricingBtn}
        >
          <Text style={styles.useSuggestedPricingBtnText}>
            {block.lumpSumOnly ? 'Use this allowance in estimate' : 'Use this price in estimate'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Collapsible "Compare to suggested/saved" panel shown when notes priced both legs. */
function ComparisonToggle({
  block,
  Colors,
  darkMode,
  onUsePricing,
}: {
  block: SuggestedPricingBlock;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onUsePricing?: () => void;
}) {
  const usesTemplate = block.materialSource === 'template' || block.laborSource === 'template';
  const [open, setOpen] = useState(usesTemplate);

  useEffect(() => {
    if (usesTemplate) setOpen(true);
  }, [usesTemplate, block.templateName]);

  return (
    <View style={{ marginTop: 8 }}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen((prev) => !prev)}>
        <Text style={styles.editQuantityLink}>
          {open ? 'Hide comparison' : `Compare to ${usesTemplate ? 'saved rate' : 'National Average'}`}
        </Text>
      </TouchableOpacity>
      {open ? (
        <SuggestedBudgetSplitRows
          block={block}
          Colors={Colors}
          darkMode={darkMode}
          onUsePricing={onUsePricing}
        />
      ) : null}
    </View>
  );
}

function EditQuantityLink({ onPress, label = 'Edit pricing' }: { onPress: () => void; label?: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.editQuantityLink}>{label}</Text>
    </TouchableOpacity>
  );
}

type AllowanceOrSplitMode = 'allowance' | 'split';

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
}) {
  const [inputMode, setInputMode] = useState<'total' | 'rate'>(defaultInputMode);
  const [rateDraft, setRateDraft] = useState('');
  const [rateEditing, setRateEditing] = useState(false);
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const supportsRateMode = Boolean(basis?.quantity && basis.quantity > 0);
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
      style={[
        styles.pricingInputCard,
        {
          borderColor: inputShell.borderColor,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(248,250,252,0.9)',
        },
      ]}
    >
      <View style={styles.pricingInputHeader}>
        <Text
          style={{
            color: Colors.sub,
            fontSize: 12,
            fontWeight: '700',
            flexShrink: 0,
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
            <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>
              {inputMode === 'total' ? `Edit $/${formatUnitLabel(basis!.unit)}` : 'Edit total'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View
        style={[
          styles.pricingInputRow,
          {
            borderColor: inputShell.borderColor,
            backgroundColor: inputShell.backgroundColor,
          },
        ]}
      >
        {activePrefix ? (
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 15, fontWeight: '700' }}>
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
          editable={!applying}
          style={[
            styles.pricingInput,
            { color: Colors.text },
          ]}
        />
        {activeSuffix ? (
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', minWidth: 40 }}>
            {activeSuffix}
          </Text>
        ) : null}
      </View>
      {helperText ? (
        <Text
          style={{
            color: darkMode ? 'rgba(148, 163, 184, 0.9)' : '#64748b',
            fontSize: 11,
            fontWeight: '600',
            marginTop: 6,
            lineHeight: 15,
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
  Colors: ReturnType<typeof getColors>,
  darkMode: boolean
) {
  return [styles.card, estimateFlowCardStyle(Colors, darkMode), { opacity: SCOPE_ITEM_TIER_OPACITY[tier] }];
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
        <EditQuantityLink onPress={() => setPricingEditorOpen(true)} />
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
          Edit pricing
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

/** Unit rates from a suggested pricing block (Material/Labor or Equipment+Labor). */
function suggestedUnitRatesFromBlock(
  block: SuggestedPricingBlock | null | undefined,
  basisQty: number
): { materialRate: number; laborRate: number } | null {
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

/**
 * Material + Labor editor: prefills from Suggested pricing when empty, and keeps
 * $/unit rates stable when Pricing basis quantity changes.
 */
function MaterialLaborSplitEditor({
  materialValue,
  laborValue,
  pricingBasisValue,
  pricingBasis,
  basisUnit,
  basisUnitLabel,
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
}: {
  materialValue: string;
  laborValue: string;
  pricingBasisValue: string;
  pricingBasis: { quantity: number; unit: string } | null;
  basisUnit: string;
  basisUnitLabel: string;
  suggestedBlock: SuggestedPricingBlock | null;
  sqftBasisKey: string;
  materialKey: string;
  laborKey: string;
  onBatchItemQuantityChange: (
    updates: Array<{ itemId: string; quantity: string; unit?: string }>
  ) => void;
  focusQuantityField: (targetItemId: string, field?: 'count' | 'allowance') => void;
  blurQuantityField: (targetItemId: string, field?: 'count' | 'allowance') => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const lockedRatesRef = useRef<{ material: number | null; labor: number | null }>({
    material: null,
    labor: null,
  });
  const lastBasisQtyRef = useRef<number | null>(null);
  const didPrefillRef = useRef(false);

  const effectiveBasisQty =
    parseMoneyAmount(pricingBasisValue) ||
    (pricingBasis && pricingBasis.quantity > 0 ? pricingBasis.quantity : 0);

  // Prefill empty Material/Labor from Suggested pricing once per editor open.
  useEffect(() => {
    if (didPrefillRef.current) return;
    const mat = parseMoneyAmount(materialValue);
    const lab = parseMoneyAmount(laborValue);
    if (mat > 0 || lab > 0) {
      didPrefillRef.current = true;
      if (effectiveBasisQty > 0) {
        if (mat > 0) lockedRatesRef.current.material = roundMoney2(mat / effectiveBasisQty);
        if (lab > 0) lockedRatesRef.current.labor = roundMoney2(lab / effectiveBasisQty);
        lastBasisQtyRef.current = effectiveBasisQty;
      }
      return;
    }
    const suggestedBasisQty =
      suggestedBlock?.basis?.quantity && suggestedBlock.basis.quantity > 0
        ? suggestedBlock.basis.quantity
        : effectiveBasisQty;
    const rates = suggestedUnitRatesFromBlock(suggestedBlock, suggestedBasisQty);
    if (!rates || effectiveBasisQty <= 0) return;
    didPrefillRef.current = true;
    lastBasisQtyRef.current = effectiveBasisQty;
    lockedRatesRef.current = {
      material: rates.materialRate > 0 ? rates.materialRate : null,
      labor: rates.laborRate > 0 ? rates.laborRate : null,
    };
    const updates: Array<{ itemId: string; quantity: string; unit?: string }> = [];
    if (!parseMoneyAmount(pricingBasisValue) && effectiveBasisQty > 0) {
      updates.push({ itemId: sqftBasisKey, quantity: String(effectiveBasisQty), unit: basisUnit });
    }
    if (rates.materialRate > 0) {
      updates.push({
        itemId: materialKey,
        quantity: String(roundMoney2(rates.materialRate * effectiveBasisQty)),
        unit: 'allowance',
      });
    }
    if (rates.laborRate > 0) {
      updates.push({
        itemId: laborKey,
        quantity: String(roundMoney2(rates.laborRate * effectiveBasisQty)),
        unit: 'allowance',
      });
    }
    if (updates.length) onBatchItemQuantityChange(updates);
  }, [
    materialValue,
    laborValue,
    pricingBasisValue,
    effectiveBasisQty,
    suggestedBlock,
    sqftBasisKey,
    materialKey,
    laborKey,
    basisUnit,
    onBatchItemQuantityChange,
  ]);

  const handleBasisChange = (text: string) => {
    const nextQty = parseMoneyAmount(text);
    const prevQty = lastBasisQtyRef.current ?? effectiveBasisQty;
    const updates: Array<{ itemId: string; quantity: string; unit?: string }> = [
      { itemId: sqftBasisKey, quantity: text, unit: basisUnit },
    ];

    if (!(nextQty > 0)) {
      lastBasisQtyRef.current = null;
      onBatchItemQuantityChange(updates);
      return;
    }

    // Prefer locked rates; otherwise derive from current totals before rescale.
    let materialRate = lockedRatesRef.current.material;
    let laborRate = lockedRatesRef.current.labor;
    if (prevQty && prevQty > 0) {
      if (materialRate == null) {
        const mat = parseMoneyAmount(materialValue);
        if (mat > 0) materialRate = roundMoney2(mat / prevQty);
      }
      if (laborRate == null) {
        const lab = parseMoneyAmount(laborValue);
        if (lab > 0) laborRate = roundMoney2(lab / prevQty);
      }
    }
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
    const updates: Array<{ itemId: string; quantity: string; unit?: string }> = [
      { itemId: materialKey, quantity: text, unit: 'allowance' },
    ];
    const split = (amount > 0 ? amount : 0) + (laborAmount > 0 ? laborAmount : 0);
    if (split > 0) {
      updates.push({
        itemId: materialKey.replace(/__material$/, '__allowance'),
        quantity: String(roundMoney2(split)),
        unit: 'allowance',
      });
    }
    onBatchItemQuantityChange(updates);
    if (effectiveBasisQty > 0 && amount > 0) {
      lockedRatesRef.current.material = roundMoney2(amount / effectiveBasisQty);
    } else if (!text.trim()) {
      lockedRatesRef.current.material = null;
    }
  };

  const handleLaborChange = (text: string) => {
    const amount = parseMoneyAmount(text);
    const materialAmount = parseMoneyAmount(materialValue);
    const updates: Array<{ itemId: string; quantity: string; unit?: string }> = [
      { itemId: laborKey, quantity: text, unit: 'allowance' },
    ];
    const split = (materialAmount > 0 ? materialAmount : 0) + (amount > 0 ? amount : 0);
    if (split > 0) {
      updates.push({
        itemId: laborKey.replace(/__labor$/, '__allowance'),
        quantity: String(roundMoney2(split)),
        unit: 'allowance',
      });
    }
    onBatchItemQuantityChange(updates);
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
    effectiveBasisQty > 0
      ? { quantity: effectiveBasisQty, unit: pricingBasis?.unit || basisUnit }
      : pricingBasis;

  return (
    <>
      <PricingInputField
        label="Pricing basis"
        value={pricingBasisValue}
        suffix={basisUnitLabel}
        placeholder={pricingBasis ? String(pricingBasis.quantity) : `Enter ${basisUnitLabel}`}
        helper={
          !pricingBasisValue && pricingBasis
            ? `Using ${pricingBasis.quantity.toLocaleString()} ${basisUnitLabel} from job measurements`
            : undefined
        }
        onFocus={() => focusQuantityField(sqftBasisKey)}
        onChangeText={handleBasisChange}
        onBlur={() => blurQuantityField(sqftBasisKey)}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
      <PricingInputField
        label="Material"
        value={materialValue}
        helper={unitRateHelper(materialValue, editorBasis)}
        basis={editorBasis}
        prefix="$"
        placeholder={editorBasis ? `Material $/${basisUnitLabel}` : 'Material total'}
        defaultInputMode={editorBasis ? 'rate' : 'total'}
        onFocus={() => focusQuantityField(materialKey)}
        onChangeText={handleMaterialChange}
        onBlur={() => blurQuantityField(materialKey)}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
      <PricingInputField
        label="Labor"
        value={laborValue}
        helper={unitRateHelper(laborValue, editorBasis)}
        basis={editorBasis}
        prefix="$"
        placeholder={editorBasis ? `Labor $/${basisUnitLabel}` : 'Labor total'}
        defaultInputMode={editorBasis ? 'rate' : 'total'}
        onFocus={() => focusQuantityField(laborKey)}
        onChangeText={handleLaborChange}
        onBlur={() => blurQuantityField(laborKey)}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
      {splitTotal ? (
        <PricingSplitRow
          label="Split total"
          value={formatDraftMoney(splitTotal)}
          darkMode={darkMode}
          Colors={Colors}
        />
      ) : null}
    </>
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
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
  onScopeGapResolutionsChange,
  onScopeGapPriceSeparately,
  onScopeGapIncludeInParentPrice,
  onRevertCalculatedQuantity,
  scopeItemLabel,
  pricingEditorRequest,
  onPricingEditorRequestHandled,
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
    updates: Array<{ itemId: string; quantity: string; unit?: string }>
  ) => void;
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
  const [focusedPricingField, setFocusedPricingField] = useState<string | null>(null);
  const [pricingModeOverride, setPricingModeOverride] = useState<AllowanceOrSplitMode | null>(null);
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
  if (!resolved.showInput && !resolved.pricingReady) return null;
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

  if (rule.dualAllowanceField) {
    const fieldLabels = DUAL_QUANTITY_FIELD_LABELS[itemId];
    const allowanceKey = roughAllowanceSubKey(itemId);
    const materialKey = `${itemId}__material`;
    const laborKey = `${itemId}__labor`;
    const countInput = measurementsInput.itemQuantities[itemId];
    const allowanceInput = measurementsInput.itemQuantities[allowanceKey];
    const materialInput = measurementsInput.itemQuantities[materialKey];
    const laborInput = measurementsInput.itemQuantities[laborKey];
    const showEditor = pricingEditorOpen || focusedPricingField != null;

    const hasUserSelectedPricing = hasCompleteUserSelectedPricing(
      measurementsInput.itemQuantities,
      itemId
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
      const displayResolved = mergeNotesSplitForDisplay();
      const initialSuggested = hasUserSelectedPricing
        ? { fill: null, comparison: null }
        : resolveScopeItemSuggestedPricing(
            itemId,
            measurementsInput,
            templateKey,
            displayResolved,
            pricingContext
          );
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
      if (!hasUserSelectedPricing) {
        const formulaSuggested = resolveFormulaTargetSuggestedPricing({
          itemId,
          measurementsInput,
          templateKey,
          resolved: displayResolved,
          pricingContext,
          intelligence,
          suggested: initialSuggested,
        });
        suggestedBudgetSplit = formulaSuggested.fill;
        suggestedComparisonSplit = formulaSuggested.comparison;
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
      const accepted = hasAcceptedScopePricing(
        itemId,
        measurementsInput.itemQuantities,
        measurementsInput.pricingAcceptance
      );
      const hideSuggestion = shouldHideSuggestedPanel({
        itemId,
        itemQuantities: measurementsInput.itemQuantities,
        pricingAcceptance: measurementsInput.pricingAcceptance,
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
        if (resolved.dualCount) {
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
          ) : (
            <>
              {displayResolved.dualCount ? (
                <PricingAmountRow
                  value={`${displayResolved.dualCount.quantity.toLocaleString()} ${
                    fieldLabels?.countUnit || formatUnitLabel(displayResolved.dualCount.unit)
                  }`}
                  label={displayResolved.sourceLabel}
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
                />
              ) : null}
              {suggestedComparisonSplit ? (
                <ComparisonToggle
                  block={suggestedComparisonSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
                />
              ) : null}
              <EditQuantityLink onPress={openPricingEditor} />
            </>
          )}
        </View>
      );
    }

    if (!showEditor) {
      return (
        <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
          <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
            {resolved.missingMessage || 'Enter quantity and/or allowance'}
          </Text>
          {rule.quantityHelper ? (
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
              {rule.quantityHelper}
            </Text>
          ) : null}
          <EditQuantityLink onPress={() => setPricingEditorOpen(true)} />
        </View>
      );
    }

    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            if (focusedPricingField) return;
            setPricingEditorOpen(false);
          }}
        >
          <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
            Edit pricing
          </Text>
          {rule.quantityHelper ? (
            <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
              {rule.quantityHelper}
            </Text>
          ) : null}
          <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
            Tap card to collapse
          </Text>
        </TouchableOpacity>
        <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
          {fieldLabels?.count || 'Quantity'}
        </Text>
        <View style={styles.qtyInputRow}>
          <TextInput
            value={countInput?.quantity ?? ''}
            onFocus={() => focusQuantityField(itemId, 'count')}
            onChangeText={(text) => onItemQuantityChange(itemId, text, 'count')}
            onBlur={() => blurQuantityField(itemId, 'count')}
            placeholder="0"
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
            {...scopeNumericInputProps}
            editable={!applying}
            style={[
              styles.qtyInput,
              { color: Colors.text, borderColor: inputShell.borderColor, backgroundColor: inputShell.backgroundColor },
            ]}
          />
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', minWidth: 48 }}>
            {fieldLabels?.countUnit || 'each'}
          </Text>
        </View>
        <PricingInputField
          label="Material"
          value={materialInput?.quantity ?? (resolved.dualMaterial ? String(resolved.dualMaterial.quantity) : '')}
          helper={unitRateHelper(
            materialInput?.quantity ?? (resolved.dualMaterial ? String(resolved.dualMaterial.quantity) : ''),
            resolved.dualCount ?? null
          )}
          basis={resolved.dualCount ?? null}
          prefix="$"
          placeholder="Material total"
          onFocus={() => focusQuantityField(materialKey)}
          onChangeText={(text) => onItemQuantityChange(materialKey, text, 'count', 'allowance')}
          onBlur={() => blurQuantityField(materialKey)}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
        <PricingInputField
          label="Labor"
          value={laborInput?.quantity ?? (resolved.dualLabor ? String(resolved.dualLabor.quantity) : '')}
          helper={unitRateHelper(
            laborInput?.quantity ?? (resolved.dualLabor ? String(resolved.dualLabor.quantity) : ''),
            resolved.dualCount ?? null
          )}
          basis={resolved.dualCount ?? null}
          prefix="$"
          placeholder="Labor total"
          onFocus={() => focusQuantityField(laborKey)}
          onChangeText={(text) => onItemQuantityChange(laborKey, text, 'count', 'allowance')}
          onBlur={() => blurQuantityField(laborKey)}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
        <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4 }}>
          {fieldLabels?.allowance || 'Allowance ($)'}
        </Text>
        <View style={styles.qtyInputRow}>
          <Text style={{ color: Colors.sub, fontSize: 14, fontWeight: '600' }}>$</Text>
          <TextInput
            value={allowanceInput?.quantity ?? ''}
            onFocus={() => focusQuantityField(itemId, 'allowance')}
            onChangeText={(text) => onItemQuantityChange(itemId, text, 'allowance')}
            onBlur={() => blurQuantityField(itemId, 'allowance')}
            placeholder="0"
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
            {...scopeNumericInputProps}
            editable={!applying}
            style={[
              styles.qtyInput,
              { color: Colors.text, borderColor: inputShell.borderColor, backgroundColor: inputShell.backgroundColor },
            ]}
          />
        </View>
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
  const showEditor = pricingEditorOpen || focusedPricingField != null;
  const neededLabel =
    (templateKey && QUANTITY_NEEDED_LABELS_BY_TEMPLATE[templateKey]?.[itemId]) ||
    QUANTITY_NEEDED_LABELS[itemId] ||
    quantityNeededLabel(itemId, templateKey, rule.defaultUnit);

  const initialSuggested = resolveScopeItemSuggestedPricing(
    itemId,
    measurementsInput,
    templateKey,
    resolved,
    pricingContext
  );
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
  });
  suggestedBudgetSplit = formulaSuggested.fill;
  suggestedComparisonSplit = formulaSuggested.comparison;
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
    if (__DEV__ && itemId === 'demo') {
      const raw = measurementsInput.itemQuantities || {};
      console.log('🧮 Demo quantity render', {
        rawDemo: raw.demo,
        resolved: {
          quantity: resolved.quantity,
          unit: resolved.unit,
          source: resolved.quantitySource,
          label: resolved.sourceLabel,
        },
        hasNotes: Boolean(originalNotes?.trim()),
      });
    }

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
          const accepted = hasAcceptedScopePricing(
            itemId,
            measurementsInput.itemQuantities,
            measurementsInput.pricingAcceptance
          );
          const hideSuggestion = shouldHideSuggestedPanel({
            itemId,
            itemQuantities: measurementsInput.itemQuantities,
            pricingAcceptance: measurementsInput.pricingAcceptance,
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
          if (accepted && acceptedDisplay) {
            return (
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
            );
          }
          return (
            <>
              <PricingAmountRow
                value={formatResolvedQuantityDisplay(
                  resolved.quantity ?? 0,
                  resolved.unit,
                  resolved.quantitySource,
                  itemId
                )}
                pill={resolved.quantitySource === 'notes' ? <SourcePill kind="notes" /> : undefined}
                label={resolved.sourceLabel}
                emphasized
                darkMode={darkMode}
                Colors={Colors}
              />
              <ScopeIntelligenceNotice
                intelligence={intelligence}
                Colors={Colors}
                darkMode={darkMode}
                compact
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
                />
              ) : null}
              {suggestedComparisonSplit ? (
                <ComparisonToggle
                  block={suggestedComparisonSplit}
                  Colors={Colors}
                  darkMode={darkMode}
                  onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
                />
              ) : null}
              <EditQuantityLink onPress={openPricingEditor} />
            </>
          );
        })()}
      </View>
    );
  }

  if (!showEditor) {
    return (
      <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
        <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          Needs {neededLabel}
        </Text>
        {rule.quantityHelper ? (
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
            {rule.quantityHelper}
          </Text>
        ) : null}
        {suggestedBudgetSplit ? (
          <SuggestedBudgetSplitRows
            block={suggestedBudgetSplit}
            Colors={Colors}
            darkMode={darkMode}
            onUsePricing={() => applySuggestedPricingBlock(suggestedBudgetSplit)}
          />
        ) : null}
        {suggestedComparisonSplit ? (
          <ComparisonToggle
            block={suggestedComparisonSplit}
            Colors={Colors}
            darkMode={darkMode}
            onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
          />
        ) : null}
        <EditQuantityLink onPress={() => setPricingEditorOpen(true)} />
      </View>
    );
  }

  const lumpSumValue =
    allowanceInput?.quantity ??
    (itemInput?.unit === 'allowance' || itemInput?.unit === 'lump_sum' ? itemInput?.quantity ?? '' : '');
  const pricingBasisValue = sqftBasisInput?.quantity ?? '';
  const materialValue = materialInput?.quantity ?? '';
  const laborValue = laborInput?.quantity ?? '';
  const displaySuggestedBudgetSplit = overlaySuggestedBlockWithEditorValues(suggestedBudgetSplit, {
    materialValue,
    laborValue,
    allowanceValue: lumpSumValue,
    pricingBasisValue,
    pricingBasis,
    basisUnit,
  });
  const suggestedCardIsAdjusted =
    Boolean(displaySuggestedBudgetSplit) &&
    displaySuggestedBudgetSplit !== suggestedBudgetSplit &&
    Boolean(displaySuggestedBudgetSplit?.rateSourceLabel.startsWith('Adjusted · '));

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

  return (
    <View style={[styles.qtySection, { borderTopColor: dividerColor(darkMode) }]}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          if (focusedPricingField) return;
          setPricingEditorOpen(false);
        }}
      >
        <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          Edit pricing
        </Text>
        {rule.quantityHelper ? (
          <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginBottom: 4, lineHeight: 15 }}>
            {rule.quantityHelper}
          </Text>
        ) : null}
        <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
          Tap card to collapse
        </Text>
      </TouchableOpacity>
      {rule.allowanceOrSplit && pricingMode ? (
        <AllowanceOrSplitModeToggle
          mode={pricingMode}
          onChange={handlePricingModeChange}
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
          onFocus={() => focusQuantityField(allowanceKey)}
          onChangeText={(text) => onItemQuantityChange(allowanceKey, text, 'count', 'allowance')}
          onBlur={() => blurQuantityField(allowanceKey)}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      ) : (
        <MaterialLaborSplitEditor
          materialValue={materialValue}
          laborValue={laborValue}
          pricingBasisValue={pricingBasisValue}
          pricingBasis={pricingBasis}
          basisUnit={basisUnit}
          basisUnitLabel={basisUnitLabel}
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
        />
      )}
      {displaySuggestedBudgetSplit && !showAllowanceEditor ? (
        <SuggestedBudgetSplitRows
          block={displaySuggestedBudgetSplit}
          Colors={Colors}
          darkMode={darkMode}
          adjusted={suggestedCardIsAdjusted}
          onUsePricing={() => applySuggestedPricingBlock(displaySuggestedBudgetSplit)}
        />
      ) : null}
      {displaySuggestedBudgetSplit && showAllowanceEditor && displaySuggestedBudgetSplit.lumpSumOnly ? (
        <SuggestedBudgetSplitRows
          block={displaySuggestedBudgetSplit}
          Colors={Colors}
          darkMode={darkMode}
          adjusted={suggestedCardIsAdjusted}
          onUsePricing={() => applySuggestedPricingBlock(displaySuggestedBudgetSplit)}
        />
      ) : null}
      {suggestedComparisonSplit ? (
        <ComparisonToggle
          block={suggestedComparisonSplit}
          Colors={Colors}
          darkMode={darkMode}
          onUsePricing={() => applySuggestedPricingBlock(suggestedComparisonSplit)}
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

function WetAreaInstallLineCard({
  item,
  templateKey,
  originalNotes,
  measurementsInput,
  onItemQuantityChange,
  onBatchItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
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
    updates: Array<{ itemId: string; quantity: string; unit?: string }>
  ) => void;
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
  onSaveCustomPricing?: () => void;
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);

  return (
    <View style={scopeCardStyle(tier, Colors, darkMode)}>
      <ScopeItemTitleRow
        label={item.label}
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
        onItemQuantityBlur={onItemQuantityBlur}
        onItemQuantityFocus={onItemQuantityFocus}
        onApplySuggestedPricing={onApplySuggestedPricing}
        onScopeGapResolutionsChange={onScopeGapResolutionsChange}
        onScopeGapPriceSeparately={onScopeGapPriceSeparately}
        onScopeGapIncludeInParentPrice={onScopeGapIncludeInParentPrice}
        onRevertCalculatedQuantity={onRevertCalculatedQuantity}
        pricingEditorRequest={pricingEditorRequest}
        onPricingEditorRequestHandled={onPricingEditorRequestHandled}
        scopeItemLabel={item.label}
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
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
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
    updates: Array<{ itemId: string; quantity: string; unit?: string }>
  ) => void;
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
  onSaveCustomPricing?: () => void;
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

  useEffect(() => {
    setDraftLabel(item.label);
  }, [item.label]);

  const saveRename = () => {
    const trimmed = draftLabel.trim();
    if (!trimmed) return;
    onRename?.(trimmed);
    setRenaming(false);
  };

  return (
    <View style={scopeCardStyle(tier, Colors, darkMode)}>
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
          label={item.label}
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
          onItemQuantityBlur={onItemQuantityBlur}
          onItemQuantityFocus={onItemQuantityFocus}
          onApplySuggestedPricing={onApplySuggestedPricing}
          onScopeGapResolutionsChange={onScopeGapResolutionsChange}
          onScopeGapPriceSeparately={onScopeGapPriceSeparately}
          onScopeGapIncludeInParentPrice={onScopeGapIncludeInParentPrice}
          onRevertCalculatedQuantity={onRevertCalculatedQuantity}
          pricingEditorRequest={pricingEditorRequest}
          onPricingEditorRequestHandled={onPricingEditorRequestHandled}
          scopeItemLabel={item.label}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
        />
      )}
    </View>
  );
}

function MultiChoiceRow({
  item,
  templateKey,
  originalNotes,
  onToggle,
  measurementsInput,
  onItemQuantityChange,
  onBatchItemQuantityChange,
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
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
    updates: Array<{ itemId: string; quantity: string; unit?: string }>
  ) => void;
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
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const choiceIds = item.choiceIds ?? [];
  const inScope = choiceIds.some((id) => id === 'remove' || id === 'add');
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);

  return (
    <View style={scopeCardStyle(tier, Colors, darkMode)}>
      <ScopeItemTitleRow
        label={item.label}
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
      <QuantitySection
        itemId={item.id}
        inScope={inScope}
        templateKey={templateKey}
        originalNotes={originalNotes}
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
        onBatchItemQuantityChange={onBatchItemQuantityChange}
        onItemQuantityBlur={onItemQuantityBlur}
        onItemQuantityFocus={onItemQuantityFocus}
        onApplySuggestedPricing={onApplySuggestedPricing}
        onScopeGapResolutionsChange={onScopeGapResolutionsChange}
        onScopeGapPriceSeparately={onScopeGapPriceSeparately}
        onScopeGapIncludeInParentPrice={onScopeGapIncludeInParentPrice}
        onRevertCalculatedQuantity={onRevertCalculatedQuantity}
        pricingEditorRequest={pricingEditorRequest}
        onPricingEditorRequestHandled={onPricingEditorRequestHandled}
        scopeItemLabel={item.label}
        Colors={Colors}
        darkMode={darkMode}
        applying={applying}
      />
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
  onItemQuantityBlur,
  onItemQuantityFocus,
  onApplySuggestedPricing,
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
  onSelect: (choiceId: string) => void;
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
    updates: Array<{ itemId: string; quantity: string; unit?: string }>
  ) => void;
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
  visualCtx: ScopeItemVisualContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const inScope = Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');
  const helper = checklistDisplayHelper(item, templateKey);
  const tier = scopeItemVisualTier(item, visualCtx);
  const noteBadge = scopeItemNoteBadge(item, visualCtx);

  return (
    <View style={scopeCardStyle(tier, Colors, darkMode)}>
      <ScopeItemTitleRow
        label={item.label}
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
      <QuantitySection
        itemId={item.id}
        choiceId={item.choiceId}
        inScope={inScope}
        templateKey={templateKey}
        originalNotes={originalNotes}
        measurementsInput={measurementsInput}
        onItemQuantityChange={onItemQuantityChange}
        onBatchItemQuantityChange={onBatchItemQuantityChange}
        onItemQuantityBlur={onItemQuantityBlur}
        onItemQuantityFocus={onItemQuantityFocus}
        onApplySuggestedPricing={onApplySuggestedPricing}
        onScopeGapResolutionsChange={onScopeGapResolutionsChange}
        onScopeGapPriceSeparately={onScopeGapPriceSeparately}
        onScopeGapIncludeInParentPrice={onScopeGapIncludeInParentPrice}
        onRevertCalculatedQuantity={onRevertCalculatedQuantity}
        pricingEditorRequest={pricingEditorRequest}
        onPricingEditorRequestHandled={onPricingEditorRequestHandled}
        scopeItemLabel={item.label}
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
  onChangeText,
  Colors,
  darkMode,
  applying,
}: {
  field: QuickMeasurementFieldDef;
  value: string;
  fromNotes?: boolean;
  onChangeText: (v: string) => void;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
}) {
  const inputShell = inputShellStyle(Colors, darkMode);
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8';
  const isPrimary = Boolean(field.primary);

  return (
    <View style={[styles.measurementField, isPrimary && styles.measurementFieldPrimary]}>
      <View style={styles.measurementLabelRow}>
        <Text style={[styles.measurementLabel, { color: captionColor(darkMode, Colors) }]}>
          {field.label}
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
          placeholder={field.placeholder}
          placeholderTextColor={placeholderColor}
          keyboardType="decimal-pad"
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
  measurements,
  setMeasurements,
  templateKey,
  projectType,
  notes,
  needsMeasurements = false,
  Colors,
  darkMode,
  applying,
  onPlanNotesMerged,
  onPlanScopeDetections,
}: {
  expanded: boolean;
  onToggle: () => void;
  measurements: ScopeMeasurementsInputExtended;
  setMeasurements: React.Dispatch<React.SetStateAction<ScopeMeasurementsInputExtended>>;
  templateKey?: string;
  projectType?: string | null;
  notes?: string | null;
  needsMeasurements?: boolean;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  applying: boolean;
  onPlanNotesMerged?: (mergedNotes: string) => void;
  onPlanScopeDetections?: (detections: PhotoScopeDetection[]) => void;
}) {
  const [planImporting, setPlanImporting] = useState(false);
  const [planReview, setPlanReview] = useState<PlanToMeasurementsResult | null>(null);
  const noteQuickMeasurements = useMemo(() => {
    const parsed = parseScopeMeasurementsFromNotes(notes || '', { templateKey, projectType: projectType ?? undefined });
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
  }, [notes, templateKey, projectType]);
  const rows = useMemo(
    () => quickMeasurementRowsForInput(templateKey, projectType, measurements, noteQuickMeasurements.keys),
    [templateKey, projectType, measurements, noteQuickMeasurements.keys]
  );
  const sections = useMemo(() => quickMeasurementSectionsForRows(rows), [rows]);
  const fillCounts = useMemo(
    () => countFilledQuickMeasurements(rows, measurements, noteQuickMeasurements.values),
    [rows, measurements, noteQuickMeasurements.values]
  );
  const noteKeySet = useMemo(() => new Set(noteQuickMeasurements.keys), [noteQuickMeasurements.keys]);

  const executePlanTakeoff = useCallback(
    async (pages: Array<{ base64: string; mimeType: string; name?: string }>) => {
      if (!pages.length) return;
      setPlanImporting(true);
      if (!expanded) onToggle();
      try {
        const takeoff = await runPlanTakeoff(pages, {
          existingNotes: notes || '',
          templateKeyHint: templateKey || null,
          projectTypeHint: projectType || null,
        });
        if (!takeoff) return;
        setPlanReview(takeoff);
        if (Platform.OS === 'ios') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        Alert.alert('Plan import failed', e instanceof Error ? e.message : 'Try again with a clearer image.');
      } finally {
        setPlanImporting(false);
      }
    },
    [expanded, onToggle, notes, templateKey, projectType]
  );

  const applyPlanReview = useCallback(
    (values: Record<string, string>, scopeDetections: PhotoScopeDetection[]) => {
      const takeoff = planReview;
      setPlanReview(null);
      if (!takeoff) return;

      if (Object.keys(values).length || takeoff.rooms?.length) {
        setMeasurements((prev) => {
          const next = { ...prev, ...values } as ScopeMeasurementsInputExtended;
          if (takeoff.rooms?.length) {
            const rooms = takeoff.rooms
              .map((r) => ({
                name: String(r.name || '').trim(),
                areaSqft: r.areaSqft != null && Number(r.areaSqft) > 0 ? Number(r.areaSqft) : null,
                lengthFt: r.lengthFt != null ? Number(r.lengthFt) : null,
                widthFt: r.widthFt != null ? Number(r.widthFt) : null,
              }))
              .filter((r) => r.name);
            (next as ScopeMeasurementsInputExtended & { planRooms?: typeof rooms }).planRooms = rooms;
            // Fill empty kitchen/bath/garage/deck from named rooms.
            const kitchen = rooms
              .filter((r) => /\bkitchen\b/i.test(r.name) && r.areaSqft)
              .reduce((s, r) => s + (r.areaSqft || 0), 0);
            const baths = rooms
              .filter((r) => /\b(bath|powder)\b/i.test(r.name) && r.areaSqft)
              .reduce((s, r) => s + (r.areaSqft || 0), 0);
            const garage = rooms
              .filter((r) => /\bgarage\b/i.test(r.name) && r.areaSqft)
              .reduce((s, r) => s + (r.areaSqft || 0), 0);
            const deck = rooms
              .filter((r) => /\b(deck|patio|porch)\b/i.test(r.name) && r.areaSqft)
              .reduce((s, r) => s + (r.areaSqft || 0), 0);
            if (kitchen > 0 && !Number(next.kitchenFloorSqft)) next.kitchenFloorSqft = String(Math.round(kitchen * 10) / 10);
            if (baths > 0 && !Number(next.bathroomFloorSqft)) next.bathroomFloorSqft = String(Math.round(baths * 10) / 10);
            if (garage > 0 && !Number(next.garageSqft)) next.garageSqft = String(Math.round(garage * 10) / 10);
            if (deck > 0 && !Number(next.deckSqft)) next.deckSqft = String(Math.round(deck * 10) / 10);
          }
          return next;
        });
      }
      if (takeoff.mergedNotes && onPlanNotesMerged) {
        onPlanNotesMerged(takeoff.mergedNotes);
      }
      if (scopeDetections.length && onPlanScopeDetections) {
        onPlanScopeDetections(scopeDetections);
      }
      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [planReview, setMeasurements, onPlanNotesMerged, onPlanScopeDetections]
  );

  const importFromPlan = useCallback(() => {
    if (planImporting || applying) return;
    promptPlanImportSource({
      title: 'Update from plan',
      message:
        'Re-read plan photos or a PDF to update Quick measurements. Prefer importing on the first Build with AI step when starting a new bid.',
      onCamera: () => {
        void (async () => {
          try {
            const assets = await takePlanPhoto();
            if (!assets?.length) return;
            await executePlanTakeoff(await imagesFromPickerAssets(assets));
          } catch (e) {
            Alert.alert('Camera failed', e instanceof Error ? e.message : 'Could not take a photo.');
          }
        })();
      },
      onLibrary: () => {
        void (async () => {
          try {
            const assets = await pickPlanFromLibrary();
            if (!assets?.length) return;
            await executePlanTakeoff(await imagesFromPickerAssets(assets));
          } catch (e) {
            Alert.alert('Library failed', e instanceof Error ? e.message : 'Could not open photos.');
          }
        })();
      },
      onPdf: () => {
        void (async () => {
          try {
            const pages = await pickPlanPdf();
            if (!pages?.length) return;
            await executePlanTakeoff(pages);
          } catch (e) {
            Alert.alert('PDF import failed', e instanceof Error ? e.message : 'Could not read the PDF.');
          }
        })();
      },
    });
  }, [planImporting, applying, executePlanTakeoff]);

  const setField = useCallback(
    (key: QuickMeasurementFieldKey, value: string) => {
      setMeasurements((prev) => ({ ...prev, [key]: value }));
    },
    [setMeasurements]
  );

  const showDone = expanded && fillCounts.filled > 0;

  return (
    <View style={[styles.quickMeasurements, estimateFlowCardStyle(Colors, darkMode)]}>
      <TouchableOpacity style={styles.quickMeasurementsHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.quickMeasurementsTitleRow}>
            <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '800' }}>
              Quick measurements
            </Text>
            {fillCounts.total > 0 ? (
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, fontWeight: '600' }}>
                {fillCounts.filled} of {fillCounts.total} filled
              </Text>
            ) : null}
          </View>
          <Text
            style={{
              color: needsMeasurements ? '#fbbf24' : captionColor(darkMode, Colors),
              fontSize: 11,
              marginTop: 2,
              fontWeight: needsMeasurements ? '700' : '400',
            }}
          >
            {needsMeasurements
              ? 'Fill these to price more scopes'
              : 'Optional — autofill repeated quantities'}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={captionColor(darkMode, Colors)} />
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.quickMeasurementsBody}>
          <TouchableOpacity
            onPress={importFromPlan}
            disabled={planImporting || applying}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: darkMode ? 'rgba(148,163,184,0.25)' : Colors.line,
              backgroundColor: darkMode ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)',
              opacity: planImporting || applying ? 0.55 : 1,
            }}
          >
            {planImporting ? (
              <ActivityIndicator size="small" color="#22c55e" />
            ) : (
              <Ionicons name="map-outline" size={18} color="#22c55e" />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: darkMode ? '#F5F7FA' : Colors.text, fontSize: 13, fontWeight: '700' }}>
                {planImporting ? 'Reading plan…' : 'Update from plan'}
              </Text>
              <Text style={{ color: captionColor(darkMode, Colors), fontSize: 11, marginTop: 2 }}>
                Re-import photos or PDF to refresh these fields — primary import is on Build with AI
              </Text>
            </View>
          </TouchableOpacity>
          {sections.map((section) => (
            <View key={section.id} style={styles.quickMeasurementSection}>
              {sections.length > 1 ? (
                <Text style={[styles.quickMeasurementSectionTitle, { color: captionColor(darkMode, Colors) }]}>
                  {section.title}
                </Text>
              ) : null}
              {section.rows.map((row, rowIdx) => (
                <View
                  key={row.map((f) => f.key).join('-') || `${section.id}-${rowIdx}`}
                  style={row.length > 1 ? styles.measurementsRow : undefined}
                >
                  {row.map((field) => {
                    const displayValue = resolveQuickMeasurementDisplayValue(
                      field.key,
                      measurements,
                      noteQuickMeasurements.values
                    );
                    const typed = String(measurements[field.key] ?? '').trim() !== '';
                    const fromNotes =
                      !typed &&
                      noteKeySet.has(field.key) &&
                      Boolean(noteQuickMeasurements.values[field.key]);
                    return (
                      <QuickMeasurementField
                        key={field.key}
                        field={field}
                        value={displayValue}
                        fromNotes={fromNotes}
                        onChangeText={(value) => setField(field.key, value)}
                        Colors={Colors}
                        darkMode={darkMode}
                        applying={applying}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
          {Array.isArray(measurements.planRooms) && measurements.planRooms.length > 0 ? (
            <View style={styles.quickMeasurementSection}>
              <Text style={[styles.quickMeasurementSectionTitle, { color: captionColor(darkMode, Colors) }]}>
                Rooms from plan
              </Text>
              {measurements.planRooms.map((room, idx) => {
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
              })}
            </View>
          ) : null}
          {showDone ? (
            <TouchableOpacity onPress={onToggle} activeOpacity={0.75} style={styles.quickMeasurementsDone}>
              <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <PlanTakeoffReviewModal
        visible={planReview != null}
        takeoff={planReview}
        currentValues={measurements as unknown as Record<string, unknown>}
        onApply={applyPlanReview}
        onCancel={() => setPlanReview(null)}
      />
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
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const checklist = draft?.scopeChecklist;
  const [planNotesOverride, setPlanNotesOverride] = useState<string | null>(null);
  const scopeNotes = useMemo(() => {
    return planNotesOverride || chooseBestScopeNotes(draft, notesFallback);
  }, [draft, notesFallback, planNotesOverride]);
  const [items, setItems] = useState<ScopeChecklistItem[]>([]);
  const [measurements, setMeasurements] = useState<ScopeMeasurementsInputExtended>({
    ...emptyQuickMeasurementInput(),
    itemQuantities: {},
  });
  const [quickMeasurementsOpen, setQuickMeasurementsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [customItemLabel, setCustomItemLabel] = useState('');
  const [showCustomItemInput, setShowCustomItemInput] = useState(false);
  const itemsRef = useRef(items);
  const measurementsRef = useRef(measurements);
  const selectedPricingRef = useRef<Record<string, SuggestedPricingBlock>>({});
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const itemRefs = useRef<Record<string, View | null>>({});
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
    measurementsRef.current = next;
    setMeasurements(next);
  }, []);

  /** Plan-derived scope suggestions (already user-confirmed in the review screen). */
  const handlePlanScopeDetections = useCallback((detections: PhotoScopeDetection[]) => {
    if (!detections?.length) return;
    setItems((prev) => {
      const { items: nextItems, appliedCount, appliedLabels } = applyScopeDetectionsToChecklistItems(
        prev,
        detections
      );
      if (appliedCount > 0) {
        Alert.alert(
          'Scope updated from plans',
          `Set ${appliedCount} checklist item${appliedCount === 1 ? '' : 's'}:\n${appliedLabels
            .slice(0, 8)
            .map((l) => `• ${l}`)
            .join('\n')}`
        );
      } else {
        Alert.alert(
          'Scope already set',
          'The plan suggestions matched items you had already answered, so nothing was changed.'
        );
      }
      return nextItems;
    });
  }, []);

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
      itemQuantities[itemId] = {
        quantity: Number(block.basis?.quantity ?? block.total),
        unit: block.basis?.unit || (rule?.dualAllowanceField ? rule.defaultUnit : 'allowance'),
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
    return {
      ...payload,
      itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : payload.itemQuantities,
      pricingAcceptance: Object.keys(pricingAcceptance).length ? pricingAcceptance : payload.pricingAcceptance,
    };
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
      const nextMeasurements = prepareScopeMeasurementsInputForUi(
        initialScopeMeasurementInputExtended(draftForScope, scopeNotes),
        { notes: scopeNotes, templateKey: checklist.templateKey }
      );
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
    hydratedVisibleSessionRef.current = false;
    setPlanNotesOverride(null);
    setItems([]);
    // Do not clear measurementsRef here. A hidden persist effect runs after
    // this cleanup; clearing the ref first can overwrite the just-confirmed
    // selected pricing in the parent draft.
    setMeasurements({
      ...emptyQuickMeasurementInput(),
      itemQuantities: {},
    });
    setCollapsedGroups({});
    setQuickMeasurementsOpen(false);
    setCustomItemLabel('');
    setShowCustomItemInput(false);
  }, [visible]);

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

  useEffect(() => {
    if (visible || !onPersistProgress || applying) return;
    const currentItems = itemsRef.current;
    if (!currentItems.length) return;
    onPersistProgress(
      scopeChecklistItemsForPersist(currentItems),
      scopeMeasurementsPayloadForCurrentState()
    );
  }, [visible, onPersistProgress, applying, scopeMeasurementsPayloadForCurrentState]);

  const displayItems = useMemo(() => expandWetAreaDerivedScopeItems(items), [items]);

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
  const scopeAssemblyContext = useMemo(
    () => ({
      activeScopeKeys: displayItems.filter(checklistItemInScope).map((item) => item.id),
      excludedScopeKeys: displayItems.filter((item) => item.state === 'excluded').map((item) => item.id),
    }),
    [displayItems]
  );

  const unconfirmedSuggestedPricing = useMemo<UnconfirmedSuggestedPricing[]>(() => {
    const rows: UnconfirmedSuggestedPricing[] = [];
    for (const item of displayItems) {
      if (!checklistItemInScope(item)) continue;
      if (hasAcceptedScopePricing(item.id, measurements.itemQuantities, measurements.pricingAcceptance)) continue;
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
        pricingContext
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
        pricingContext,
        intelligence,
        suggested: initialSuggested,
      });
      if (suggested.fill) {
        rows.push({ itemId: item.id, label: item.label, block: suggested.fill });
      }
    }
    return rows;
  }, [displayItems, measurements, normMeasurements, checklist?.templateKey, scopeNotes, pricingContext, scopeAssemblyContext]);

  const applySuggestedPricingBlocks = useCallback(
    (rows: UnconfirmedSuggestedPricing[]) => {
      if (!rows.length) return;
      hapticTap();
      selectedPricingRef.current = {
        ...selectedPricingRef.current,
        ...Object.fromEntries(rows.map((row) => [row.itemId, row.block])),
      };
      setMeasurementsSynced((prev) => {
        const itemQuantities: Record<string, { quantity: string; unit: string; quantitySource: string }> = {
          ...prev.itemQuantities,
        };
        const pricingAcceptance = {
          ...(prev.pricingAcceptance || {}),
        };
        for (const { itemId, block } of rows) {
          const rule = getChecklistItemQuantityRuleOrDefault(itemId, checklist?.templateKey);
          const allowanceKey = rule.dualAllowanceField
            ? roughAllowanceSubKey(itemId)
            : allowanceSplitSubKey(itemId, 'allowance');
          const basisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
          const materialKey = allowanceSplitSubKey(itemId, 'material');
          const laborKey = allowanceSplitSubKey(itemId, 'labor');
          itemQuantities[allowanceKey] = {
            quantity: String(block.total),
            unit: 'allowance',
            quantitySource: 'user_entered',
          };
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
          if (!rule.dualAllowanceField) {
            itemQuantities[itemId] = {
              quantity: String(block.basis?.quantity ?? block.total),
              unit: block.basis?.unit || 'allowance',
              quantitySource: 'user_entered',
            };
          }
          pricingAcceptance[itemId] = buildAcceptanceFromSuggestedBlock(block);
        }
        return {
          ...prev,
          itemQuantities,
          pricingAcceptance,
          scopeGapResolutions: syncScopeGapPricingStatuses(prev.scopeGapResolutions, {
            itemQuantities,
            pricingAcceptance,
          }),
        };
      });
      setTimeout(() => persistScopeProgressNow(), 0);
    },
    [checklist?.templateKey, persistScopeProgressNow, setMeasurementsSynced]
  );

  const handleUseAllSuggestedPricing = useCallback(
    () => applySuggestedPricingBlocks(unconfirmedSuggestedPricing),
    [applySuggestedPricingBlocks, unconfirmedSuggestedPricing]
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
                parsePricingAmount(quantity)
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
            pricingContext
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
          : source === 'user_entered' && /__(allowance|sqft_basis|material|labor)$/.test(itemId)
            ? markManualPricingAdjustment(
                prev.pricingAcceptance?.[baseItemId],
                baseItemId,
                prev.pricingAcceptance,
                parsePricingAmount(quantity)
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
    (updates: Array<{ itemId: string; quantity: string; unit?: string }>) => {
      if (!updates.length) return;
      setMeasurementsSynced((prev) => {
        const itemQuantities = { ...prev.itemQuantities };
        let pricingAcceptance = prev.pricingAcceptance;
        for (const update of updates) {
          const baseItemId = update.itemId.replace(/__(allowance|sqft_basis|material|labor)$/, '');
          const rule = getChecklistItemQuantityRuleOrDefault(baseItemId, checklist?.templateKey);
          itemQuantities[update.itemId] = {
            quantity: update.quantity,
            unit: update.unit || (rule?.dualAllowanceField ? 'each' : rule.defaultUnit),
            quantitySource: 'user_entered',
          };
          if (/__(allowance|sqft_basis|material|labor)$/.test(update.itemId)) {
            pricingAcceptance = markManualPricingAdjustment(
              pricingAcceptance?.[baseItemId],
              baseItemId,
              pricingAcceptance,
              parsePricingAmount(update.quantity) ?? undefined
            );
          }
        }
        return { ...prev, itemQuantities, pricingAcceptance };
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
        return { ...prev, itemQuantities };
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

  const handleApplySuggestedPricing = useCallback(
    (itemId: string, block: SuggestedPricingBlock) => {
      hapticTap();
      selectedPricingRef.current = {
        ...selectedPricingRef.current,
        [itemId]: block,
      };
      const acceptance = buildAcceptanceFromSuggestedBlock(block);
      setMeasurementsSynced((prev) => {
        const rule = getChecklistItemQuantityRuleOrDefault(itemId, checklist?.templateKey);
        const allowanceKey = rule.dualAllowanceField
          ? roughAllowanceSubKey(itemId)
          : allowanceSplitSubKey(itemId, 'allowance');
        const basisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
        const materialKey = allowanceSplitSubKey(itemId, 'material');
        const laborKey = allowanceSplitSubKey(itemId, 'labor');
        const itemQuantities: Record<string, { quantity: string; unit: string; quantitySource: string }> = {
          ...prev.itemQuantities,
          [allowanceKey]: {
            quantity: String(block.total),
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        };
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
        if (!rule.dualAllowanceField) {
          itemQuantities[itemId] = {
            quantity: String(block.basis?.quantity ?? block.total),
            unit: block.basis?.unit || 'allowance',
            quantitySource: 'user_entered',
          };
        } else {
          itemQuantities[itemId] = {
            quantity: String(block.basis?.quantity ?? block.total),
            unit: block.basis?.unit || rule.defaultUnit,
            quantitySource: 'user_entered',
          };
        }
        return {
          ...prev,
          itemQuantities,
          pricingAcceptance: {
            ...(prev.pricingAcceptance || {}),
            [itemId]: acceptance,
          },
          scopeGapResolutions: syncScopeGapPricingStatuses(prev.scopeGapResolutions, {
            itemQuantities,
            pricingAcceptance: {
              ...(prev.pricingAcceptance || {}),
              [itemId]: acceptance,
            },
          }),
        };
      });
      setTimeout(() => persistScopeProgressNow(), 0);
    },
    [checklist?.templateKey, persistScopeProgressNow, setMeasurementsSynced]
  );

  const scrollToScopeItem = useCallback((targetItemId: string) => {
    const group = groupedItems.find((g) => g.items.some((row) => row.id === targetItemId));
    if (group?.title) {
      setCollapsedGroups((prev) => ({ ...prev, [group.title]: false }));
    }
    const node = itemRefs.current[targetItemId];
    const content = scrollContentRef.current;
    if (node && content) {
      node.measureLayout(content, (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      });
    }
  }, [groupedItems]);

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

  const renderItem = (item: ScopeChecklistItem) => {
    const row =
      item.derivedFrom === 'wet_area_install' || WET_AREA_DERIVED_ITEM_IDS.has(item.id) ? (
      <WetAreaInstallLineCard
        item={item}
        templateKey={checklist?.templateKey}
        originalNotes={scopeNotes}
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onBatchItemQuantityChange={handleBatchItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        onItemQuantityFocus={handleItemQuantityFocus}
        onApplySuggestedPricing={handleApplySuggestedPricing}
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
    ) : item.inputType === 'multi_choice' && (item.options?.length ?? 0) > 0 ? (
      <MultiChoiceRow
        item={item}
        templateKey={checklist?.templateKey}
        originalNotes={scopeNotes}
        onToggle={(optionId) =>
          setItems((prev) =>
            prev.map((row) => {
              if (row.id !== item.id) return row;
              const choiceIds = toggleWallLayoutChoiceIds(row.choiceIds, optionId);
              return {
                ...row,
                choiceIds,
                choiceId: choiceIds[0] ?? null,
                state: choiceIdsToScopeState(choiceIds),
              };
            })
          )
        }
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onBatchItemQuantityChange={handleBatchItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        onItemQuantityFocus={handleItemQuantityFocus}
        onApplySuggestedPricing={handleApplySuggestedPricing}
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
        onSelect={(choiceId) =>
          setItems((prev) => {
            const next = prev.map((row) =>
              row.id === item.id ? { ...row, choiceId, state: choiceIdToState(choiceId) } : row
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
          })
        }
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onBatchItemQuantityChange={handleBatchItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        onItemQuantityFocus={handleItemQuantityFocus}
        onApplySuggestedPricing={handleApplySuggestedPricing}
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
        onSetState={(state) =>
          setItems((prev) => {
            const next = prev.map((row) => (row.id === item.id ? { ...row, state } : row));
            return applyKitchenScopeInferences(next, checklist?.templateKey, {
              notes: scopeNotes,
              measurements: normMeasurements,
            });
          })
        }
        onRename={
          isCustomScopeItem(item)
            ? (label) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, label } : row)))
            : undefined
        }
        onDelete={isCustomScopeItem(item) ? () => handleDeleteCustomItem(item.id) : undefined}
        onSaveCustomPricing={isCustomScopeItem(item) ? persistScopeProgressNow : undefined}
        measurementsInput={measurements}
        onItemQuantityChange={handleItemQuantityChange}
        onBatchItemQuantityChange={handleBatchItemQuantityChange}
        onItemQuantityBlur={handleItemQuantityBlur}
        onItemQuantityFocus={handleItemQuantityFocus}
        onApplySuggestedPricing={handleApplySuggestedPricing}
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

    const proceed = () => {
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
        });
      }
      onConfirm(items, payload);
    };

    if (unconfirmedSuggestedPricing.length > 0) {
      const count = unconfirmedSuggestedPricing.length;
      Alert.alert(
        'Use suggested prices?',
        `${count} included item${count === 1 ? '' : 's'} have suggested pricing that has not been added to the estimate yet.`,
        [
          {
            text: `Use ${count} suggested price${count === 1 ? '' : 's'}`,
            onPress: () => {
              applySuggestedPricingBlocks(unconfirmedSuggestedPricing);
              setTimeout(proceed, 0);
            },
          },
          {
            text: 'Continue without prices',
            style: 'destructive',
            onPress: proceed,
          },
          { text: 'Review individually', style: 'cancel' },
        ]
      );
      return;
    }

    proceed();
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
          paddingBottom: insets.bottom + (showCustomItemInput ? 220 : 120),
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
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
          measurements={measurements}
          setMeasurements={setMeasurementsSynced}
          templateKey={checklist?.templateKey}
          projectType={draft?.projectType}
          notes={scopeNotes}
          needsMeasurements={summary.needsMeasurement > 0}
          Colors={Colors}
          darkMode={darkMode}
          applying={applying}
          onPlanNotesMerged={(merged) => {
            if (merged?.trim()) setPlanNotesOverride(merged);
          }}
          onPlanScopeDetections={handlePlanScopeDetections}
        />

        {groupedItems.map((group) => (
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

        {unconfirmedSuggestedPricing.length > 0 ? (
          <TouchableOpacity
            onPress={handleUseAllSuggestedPricing}
            disabled={applying}
            activeOpacity={0.75}
            style={styles.bulkSuggestedPricingLink}
          >
            <Text style={styles.bulkSuggestedPricingBtnText}>
              Use {unconfirmedSuggestedPricing.length} suggested price
              {unconfirmedSuggestedPricing.length === 1 ? '' : 's'} in estimate
            </Text>
          </TouchableOpacity>
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
    <ScopePricingContextValue.Provider value={pricingContext}>
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
    marginTop: 12,
    gap: 14,
  },
  quickMeasurementSection: {
    gap: 8,
  },
  quickMeasurementSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  measurementField: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  useSuggestedPricingBtnText: {
    color: '#22c55e',
    fontSize: 13,
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
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
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
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  budgetSplitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  budgetSplitHeaderTitle: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 14,
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
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  pricingInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
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
