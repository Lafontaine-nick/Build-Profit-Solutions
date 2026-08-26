/**
 * Full-screen verify step for plan takeoff: edit numbers, confirm suggested
 * scope, then Apply — matches Build with AI / Confirm Scope chrome.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardPlainAccessory from '@/components/ui/KeyboardPlainAccessory';
import { KEYBOARD_ACCESSORY_IDS } from '@/constants/keyboard';
import { aiScopeConfirmNumericKeyboardProps } from '@/constants/inputKeyboardPresets';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import { PlanTakeoffConflictChooser } from '@/components/estimate/PlanTakeoffConflictChooser';
import { PlanTakeoffLowConfidenceChooser } from '@/components/estimate/PlanTakeoffLowConfidenceChooser';
import { quickMeasurementFieldMeta, quickMeasurementFieldDef } from '@/utils/scopeQuickMeasurements';
import {
  applyPlanConflictChoices,
  conflictResolutionProvenanceEntry,
  filterLowConfidenceForReview,
  filterUnreadableForReview,
  lowConfidenceConfirmationProvenance,
  lowConfidenceNeedsReviewProvenance,
  pendingManualConflictFields,
  planConflictChooserRowsKey,
  planTakeoffConflictFieldSet,
  reviewablePlanMeasurementConflicts,
  uniqueUnreadablePlanFields,
  type PlanConflictChoice,
} from '@/utils/planMeasurementConflictUi';
import type {
  PlanToMeasurementsResult,
  PhotoScopeDetection,
} from '@/utils/estimateAiDraft';
import { measurementSemanticsV1Enabled } from '@/utils/measurementSemantics';
import {
  applyPlanTakeoffButtonLabel,
  buildConcretePlanReviewSummary,
  buildElectricalPlanReviewSummary,
  buildFlooringPlanReviewSummary,
  buildPaintingPlanReviewSummary,
  buildPlanReviewMeasurementRowState,
  electricalPlanReadinessLine,
  electricalPlanReviewDetectedLines,
  electricalPlanReviewStatusLines,
  mergeElectricalConflictReadings,
  classifyPlanSpaceName,
  formatSf,
  garageReconciliationStatusLabel,
  livingReconciliationStatusLabel,
  filterPlanReviewMeasurementEntries,
  measurementDisplayLabel,
  measurementSourceLabel,
  formatPlumbingGasApplianceScope,
  formatPlumbingWaterHeaterDetail,
  PLUMBING_FIXTURE_INVENTORY_ORDER,
  hydratePlumbingPlanMeasurementsFromInventory,
  hydrateFramingPlanMeasurementsFromAreas,
  reconcileFramingScopeMeasurements,
  augmentFramingScopeDetections,
  framingMeasurementDisplayUnit,
  plumbingFixtureInventoryLabel,
  plumbingInventoryDerivedProvenance,
  plumbingMeasurementDisplayUnit,
  sumPlumbingFixtureInventoryPoints,
  planFieldEvidenceLabel,
  planReviewCheckboxBlockedMessage,
  resolvePlanAreaReconciliation,
  roomSourceLabel,
  scopeTakeoffStatusLines,
  spacesDetectedTitle,
} from '@/utils/planTakeoffReviewUi';
import {
  planProvenanceColor,
  resolvePlanMeasurementProvenance,
  type PlanMeasurementProvenance,
} from '@/utils/planMeasurementProvenance';
import {
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
  getPlanTradeConfiguration,
  normalizePlanImportSelection,
  type PlanEstimatingMode,
  type PlanTradeKey,
} from '@/utils/planImportTradeConfig';
import {
  expectedInsulationGrossWallSqft,
  hasFullInsulationCeilingBoundary,
  hydrateInsulationPlanMeasurementsFromTakeoff,
  insulationAtticMateriallyDiffersFromCeilingBoundary,
  mergeInsulationPlanFactsFromTakeoff,
  resolveInsulationOpeningDeductionForReview,
} from '@/utils/subcontractorTrade/insulationPlanConvergence';
import { buildPlanReviewLockedProvenance } from '@/utils/planReviewMeasurementLock';
import { mergePlanFactsWithBuildingAreas } from '@/utils/planMeasurementFacts';
import {
  insulationCeilingBoundaryBreakdownFromPlanFacts,
  insulationEnvelopeInputsFromPlanFacts,
  resolveInsulationEnvelopePlanningQuantity,
} from '@/utils/insulationEnvelopeQuantity';
import {
  DRYWALL_PLAN_QUICK_MEASUREMENT_KEYS,
  hydrateDrywallComponentMeasurementsFromPlanContext,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import {
  buildHvacPlanReviewLowConfidenceReadings,
  hvacTakeoffSkippedCanonicalReadings,
  resolveHvacPlanReviewMeasurements,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';

export type PlanReviewRow = {
  key: string;
  label: string;
  subtext?: string | null;
  sourceLabel?: string | null;
  unit: string;
  value: string;
  confidence: number | null;
  provenance: PlanMeasurementProvenance;
  pricingEligible: boolean;
  /** Value already present in Quick measurements — applying replaces it. */
  conflictValue: string | null;
  include: boolean;
};

export type PlanReviewRoomRow = {
  id: string;
  name: string;
  lengthFt: number | null;
  widthFt: number | null;
  areaSqft: string;
  include: boolean;
  spaceKind: 'living' | 'garage' | 'other';
  sourceLabel?: string | null;
  provenance: PlanMeasurementProvenance;
};

type Props = {
  visible: boolean;
  takeoff: PlanToMeasurementsResult | null;
  /** Fallback when the API omits trade routing on the takeoff payload. */
  estimatingMode?: PlanEstimatingMode;
  selectedTrade?: PlanTradeKey | null;
  /** Current Quick measurement values, to flag conflicts. */
  currentValues: Record<string, unknown>;
  onApply: (
    values: Record<string, string>,
    scopeDetections: PhotoScopeDetection[],
    rooms: Array<{
      name: string;
      areaSqft: number | null;
      lengthFt: number | null;
      widthFt: number | null;
    }>,
    metadata?: Pick<
      PlanToMeasurementsResult,
      | 'measurementProvenance'
      | 'measurementConflicts'
      | 'electricalValidation'
      | 'utilityConnections'
      | 'fixtureInventory'
      | 'complexityFactors'
      | 'plumbingReviewStatus'
      | 'waterHeaterDetail'
      | 'gasApplianceScope'
      | 'quickMeasurementSources'
    >
  ) => void;
  onCancel: () => void;
};

const SCOPE_MIN_CONFIDENCE = 0.45;

/** Primary whole-house fields first; room-level extras after. */
const MEASUREMENT_SORT_ORDER: Record<string, number> = {
  floorAreaSqft: 0,
  flooringSqft: 1,
  garageSqft: 2,
  deckSqft: 3,
  concreteSqft: 4,
  concreteDrivewaySqft: 5,
  concretePatioSqft: 6,
  concreteWalkwaySqft: 7,
  concreteSidewalkSqft: 8,
  concreteRvPadSqft: 9,
  concreteCy: 10,
  excavationCy: 11,
  concreteDemoSqft: 12,
  concreteReinforcementSqft: 13,
  concreteSubgradePrepSqft: 14,
  complexFormingLf: 15,
  exteriorWallInsulationSqft: 20,
  atticInsulationSqft: 21,
  flooringLvpSqft: 30,
  flooringLaminateSqft: 31,
  flooringEngineeredHardwoodSqft: 32,
  flooringSolidHardwoodSqft: 33,
  flooringTileSqft: 34,
  flooringCarpetSqft: 35,
  flooringSheetVinylSqft: 36,
  floorDemoSqft: 37,
  floorPrepSqft: 38,
  underlaymentSqft: 39,
  moistureBarrierSqft: 40,
  baseboardLf: 41,
  transitionCount: 42,
  transitionLf: 43,
  quarterRoundLf: 44,
  wallPaintSqft: 45,
  ceilingPaintSqft: 46,
  paintAreaSqft: 47,
  combinedPaintableAreaSqft: 48,
  interiorDoorCount: 49,
  cabinetRunLf: 52,
  cabinetPaintSqft: 53,
  kitchenFloorSqft: 50,
  bathroomFloorSqft: 51,
  waterLineLf: 60,
  sewerLineLf: 61,
  gasLineLf: 62,
  plumbingRoughPointCount: 63,
  plumbingTrimHookupCount: 64,
  plumbingFixturesHardwareCount: 65,
  waterHeaterCount: 66,
  gasApplianceConnectionCount: 67,
};

const CONCRETE_REVIEW_THICKNESS_KEYS = new Set([
  'concreteDrivewayThicknessInches',
  'concreteSidewalkThicknessInches',
  'concretePatioThicknessInches',
  'concreteWalkwayThicknessInches',
  'concreteRvPadThicknessInches',
  'concreteThicknessInches',
]);

const FLOORING_REVIEW_ADAPTER_KEYS = new Set([
  'floorDemoCarpetSqft',
  'floorDemoTileSqft',
  'floorDemoLvpSqft',
  'floorDemoLaminateSqft',
  'floorDemoEngineeredHardwoodSqft',
  'floorDemoSolidHardwoodSqft',
  'floorDemoSheetVinylSqft',
]);

const CONFIRM_YELLOW = '#fbbf24';
const CONFIRM_RED = '#ef4444';
const PANEL_BORDER_DARK = 'rgba(148,163,184,0.28)';
const PANEL_BORDER_LIGHT = 'rgba(100,116,139,0.24)';
const PANEL_BG_DARK = 'rgba(148,163,184,0.06)';
const PANEL_BG_LIGHT = 'rgba(148,163,184,0.05)';

function isNeedsConfirmationValue(value: string | null | undefined): boolean {
  return (
    value === 'Needs confirmation' ||
    value === 'Not auto-priced from detailed takeoff'
  );
}

function ReviewPanel({
  darkMode,
  children,
}: {
  darkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderColor: darkMode ? PANEL_BORDER_DARK : PANEL_BORDER_LIGHT,
        backgroundColor: darkMode ? PANEL_BG_DARK : PANEL_BG_LIGHT,
      }}
    >
      {children}
    </View>
  );
}

function TradeSummaryPanel({
  darkMode,
  labelColor,
  valueColor,
  lines,
}: {
  darkMode: boolean;
  labelColor: string;
  valueColor: string;
  lines: Array<{ label: string; value: string; note?: string | null }>;
}) {
  return (
    <ReviewPanel darkMode={darkMode}>
      {lines.map((line, index) => (
        <View
          key={`${line.label}-${index}`}
          style={index === 0 ? undefined : { marginTop: 12 }}
        >
          <Text style={[styles.summaryLabel, { color: labelColor }]}>
            {line.label}
          </Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color: isNeedsConfirmationValue(line.value)
                  ? CONFIRM_YELLOW
                  : valueColor,
              },
            ]}
          >
            {line.value}
          </Text>
          {line.note ? (
            <Text
              style={[styles.evidenceText, { color: labelColor }]}
              numberOfLines={2}
            >
              {line.note}
            </Text>
          ) : null}
        </View>
      ))}
    </ReviewPanel>
  );
}

function positiveString(v: unknown): string | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function positiveMeasurement(v: unknown): number | null {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function hydrateDrywallMeasurementsFromRooms(
  measurements: Record<string, unknown>,
  rooms: unknown,
  planFacts: Record<string, unknown> | null | undefined
) {
  return hydrateDrywallComponentMeasurementsFromPlanContext(
    measurements,
    rooms,
    planFacts
  );
}

function insulationOpeningNeedsReview(
  takeoff: PlanToMeasurementsResult | null
): boolean {
  const isOpeningField = (field: unknown) =>
    /opening|window|door/i.test(String(field || ''));
  return (
    [
      ...(takeoff?.lowConfidence || []),
      ...(takeoff?.unreadableFields || []),
      ...(takeoff?.measurementConflicts || []),
    ].some(item => isOpeningField(item?.field)) ||
    takeoff?.measurementProvenance?.openingDeductionSqft?.pricingEligible ===
      false
  );
}

export default function PlanTakeoffReviewModal({
  visible,
  takeoff,
  estimatingMode: estimatingModeOverride,
  selectedTrade: selectedTradeOverride,
  currentValues,
  onApply,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const footerBottomPad = Math.max(insets.bottom, 16);
  const semanticsOn = measurementSemanticsV1Enabled();

  const importSelection = useMemo(
    () =>
      normalizePlanImportSelection(
        takeoff?.estimatingMode || estimatingModeOverride,
        takeoff?.selectedTrade || selectedTradeOverride
      ),
    [takeoff, estimatingModeOverride, selectedTradeOverride]
  );
  const effectiveMode = importSelection.mode;
  const effectiveTradeKey = importSelection.trade?.key || null;
  const tradeReview = effectiveMode === 'selected_trade';

  const [rows, setRows] = useState<PlanReviewRow[]>([]);
  const [roomRows, setRoomRows] = useState<PlanReviewRoomRow[]>([]);
  const [scopeChecked, setScopeChecked] = useState<Record<string, boolean>>({});
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, PlanConflictChoice | undefined>
  >({});
  const [conflictManualValues, setConflictManualValues] = useState<
    Record<string, string>
  >({});
  const [conflictManualCommitted, setConflictManualCommitted] = useState<
    Record<string, boolean>
  >({});
  const [lowConfidenceAccepted, setLowConfidenceAccepted] = useState<
    Record<string, boolean>
  >({});
  const [conflictChooserKey, setConflictChooserKey] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const visibleMeasurements = useMemo(() => {
    const filtered = filterPlanMeasurementsForTrade(
      takeoff?.measurements || {},
      effectiveMode,
      effectiveTradeKey
    );
    if (effectiveTradeKey === 'hvac') {
      return resolveHvacPlanReviewMeasurements(takeoff);
    }
    if (effectiveTradeKey === 'plumbing') {
      return filterPlanReviewMeasurementEntries(
        hydratePlumbingPlanMeasurementsFromInventory(
          filtered,
          takeoff?.fixtureInventory,
          {
            waterHeaterDetail: takeoff?.waterHeaterDetail,
            gasApplianceScope: takeoff?.gasApplianceScope,
            complexityFactors: takeoff?.complexityFactors,
          }
        )
      );
    }
    if (effectiveTradeKey === 'framing') {
      return filterPlanReviewMeasurementEntries(
        hydrateFramingPlanMeasurementsFromAreas(filtered)
      );
    }
    if (effectiveTradeKey === 'insulation') {
      const insulationPlanFacts = mergeInsulationPlanFactsFromTakeoff(
        takeoff?.planFacts,
        takeoff?.buildingAreas,
        takeoff?.measurements
      );
      const insulationTakeoffMeasurements = {
        ...(takeoff?.measurements || {}),
      };
      const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
        insulationTakeoffMeasurements,
        insulationPlanFacts
      );
      const calculationMeasurements = {
        ...filtered,
        ...hydrated,
      };
      const geometryGross =
        expectedInsulationGrossWallSqft(insulationPlanFacts);
      const openingDeduction = resolveInsulationOpeningDeductionForReview(
        calculationMeasurements,
        insulationPlanFacts
      );
      const hasOpeningBasis = openingDeduction != null;
      if (
        hasOpeningBasis &&
        positiveMeasurement(calculationMeasurements.openingDeductionSqft) ==
          null
      ) {
        calculationMeasurements.openingDeductionSqft = String(openingDeduction);
      }
      if (
        geometryGross != null &&
        openingDeduction != null &&
        positiveMeasurement(
          calculationMeasurements.exteriorWallInsulationSqft
        ) == null
      ) {
        calculationMeasurements.exteriorWallInsulationSqft = String(
          Math.max(0, Math.round((geometryGross - openingDeduction) * 10) / 10)
        );
      }
      if (!hasOpeningBasis) {
        delete calculationMeasurements.exteriorWallInsulationSqft;
      } else {
        Object.assign(
          calculationMeasurements,
          hydrateInsulationPlanMeasurementsFromTakeoff(
            calculationMeasurements,
            insulationPlanFacts
          )
        );
      }
      const envelope = resolveInsulationEnvelopePlanningQuantity(
        insulationEnvelopeInputsFromPlanFacts(
          insulationPlanFacts,
          Number(
            calculationMeasurements.floorAreaSqft ??
              takeoff?.buildingAreas?.totalLivingSqft
          ),
          {
            ...calculationMeasurements,
            exteriorPerimeterLf: insulationPlanFacts?.exteriorPerimeterLf,
            foundationPerimeterLf: insulationPlanFacts?.foundationPerimeterLf,
            wallHeightFt: insulationPlanFacts?.wallHeightFt,
            plateHeightFt: insulationPlanFacts?.plateHeightFt,
            storyCount: insulationPlanFacts?.storyCount,
            allowConditionedAreaCeilingSuggestion: true,
            requireExplicitSurfaceTakeoff: true,
          }
        )
      );
      if (!envelope) {
        const fallback = { ...filtered, ...calculationMeasurements };
        delete fallback.floorAreaSqft;
        delete fallback.garageSqft;
        delete fallback.storyCount;
        delete fallback.openingDeductionSqft;
        return filterPlanReviewMeasurementEntries(fallback);
      }
      const suggestions = Object.fromEntries(
        envelope.components
          .filter(component => {
            if (
              ![
                'exteriorWallInsulationSqft',
                'atticInsulationSqft',
                'insulatedRoofDeckSqft',
              ].includes(component.key)
            ) {
              return false;
            }
            if (
              component.key === 'exteriorWallInsulationSqft' &&
              !hasOpeningBasis
            ) {
              return false;
            }
            if (
              component.source === 'planning_assumption' &&
              component.key !== 'exteriorWallInsulationSqft'
            ) {
              return false;
            }
            return (
              component.quantity > 0 &&
              positiveString(calculationMeasurements[component.key]) == null
            );
          })
          .map(component => [component.key, component.quantity])
      );
      const reviewMeasurements = {
        ...calculationMeasurements,
        ...suggestions,
        ...(positiveString(
          calculationMeasurements.exteriorWallInsulationSqft
        ) == null && suggestions.exteriorWallInsulationSqft == null
          ? { exteriorWallInsulationSqft: '' }
          : {}),
      };
      const envelopeWall = envelope.components.find(
        component => component.key === 'exteriorWallInsulationSqft'
      );
      const reviewWall = positiveMeasurement(
        reviewMeasurements.exteriorWallInsulationSqft
      );
      if (
        envelopeWall &&
        reviewWall != null &&
        envelopeWall.quantity > 0 &&
        envelopeWall.quantity < reviewWall - 0.5
      ) {
        reviewMeasurements.exteriorWallInsulationSqft = String(
          envelopeWall.quantity
        );
      }
      const atticBoundary =
        insulationCeilingBoundaryBreakdownFromPlanFacts(insulationPlanFacts);
      const reviewAttic = positiveMeasurement(
        reviewMeasurements.atticInsulationSqft
      );
      if (
        atticBoundary?.calculatedSqft != null &&
        hasFullInsulationCeilingBoundary(
          insulationPlanFacts?.ceilingBoundary
        ) &&
        (reviewAttic == null ||
          insulationAtticMateriallyDiffersFromCeilingBoundary(
            reviewAttic,
            atticBoundary.calculatedSqft
          ))
      ) {
        reviewMeasurements.atticInsulationSqft = String(
          atticBoundary.calculatedSqft
        );
      }
      // Living and garage areas are plan context, not insulation bid
      // quantities. Opening deductions explain the net wall number but are
      // not a separate insulation scope.
      delete reviewMeasurements.floorAreaSqft;
      delete reviewMeasurements.garageSqft;
      delete reviewMeasurements.storyCount;
      delete reviewMeasurements.openingDeductionSqft;
      return filterPlanReviewMeasurementEntries(reviewMeasurements);
    }
    if (effectiveTradeKey === 'drywall') {
      return filterPlanReviewMeasurementEntries(
        hydrateDrywallMeasurementsFromRooms(
          filtered,
          takeoff?.rooms,
          takeoff?.planFacts
        )
      );
    }
    return filterPlanReviewMeasurementEntries(filtered);
  }, [takeoff, effectiveMode, effectiveTradeKey]);

  const scopeDetections = useMemo(() => {
    const detections = takeoff?.scope?.detections || [];
    const filtered = filterPlanScopesForTrade(
      detections,
      effectiveMode,
      effectiveTradeKey
    ).filter(
      d =>
        (d.confidence ?? 0) >= SCOPE_MIN_CONFIDENCE &&
        (d.state === 'included' || d.state === 'excluded')
    );
    if (effectiveTradeKey === 'framing') {
      return augmentFramingScopeDetections(filtered, visibleMeasurements);
    }
    return filtered;
  }, [takeoff, effectiveMode, effectiveTradeKey, visibleMeasurements]);

  const areaReconciliation = useMemo(() => {
    if (!takeoff || !semanticsOn || tradeReview) return null;
    return resolvePlanAreaReconciliation({
      areaReconciliation: takeoff.areaReconciliation,
      measurements: takeoff.measurements,
      rooms: takeoff.rooms,
    });
  }, [takeoff, semanticsOn, tradeReview]);

  useEffect(() => {
    if (!visible || !takeoff) return;
    setConflictChoices({});
    setConflictManualValues({});
    setConflictManualCommitted({});
    setLowConfidenceAccepted({});
    setConflictChooserKey(key => key + 1);
    const livingSf = Number(
      takeoff.measurements?.floorAreaSqft ??
        takeoff.buildingAreas?.totalLivingSqft
    );
    const unresolvedConflictFields = new Set(
      reviewablePlanMeasurementConflicts({
        conflicts: takeoff.measurementConflicts,
        provenance: takeoff.measurementProvenance,
      }).map(conflict => String(conflict.field))
    );
    const nextRows: PlanReviewRow[] = Object.entries(visibleMeasurements)
      .filter(([key]) => !unresolvedConflictFields.has(key))
      .map(([key, value]) => {
        const meta = quickMeasurementFieldMeta(key);
        const fieldDef = quickMeasurementFieldDef(
          key as import('@/utils/scopeQuickMeasurements').QuickMeasurementFieldKey
        );
        const conflictValue = positiveString(currentValues?.[key]);
        const display = semanticsOn
          ? measurementDisplayLabel(key, Number(value), livingSf)
          : {
              label: key === 'floorAreaSqft' ? 'Living area' : meta.label,
              subtext: fieldDef?.helperText ?? null,
            };
        const ceilingBoundary =
          key === 'atticInsulationSqft'
            ? insulationCeilingBoundaryBreakdownFromPlanFacts(
                mergePlanFactsWithBuildingAreas(
                  takeoff.planFacts,
                  takeoff.buildingAreas
                )
              )
            : null;
        const ceilingBoundaryText = ceilingBoundary
          ? [
              ceilingBoundary.upperFloorAtticSqft != null
                ? `Upper attic ${ceilingBoundary.upperFloorAtticSqft.toLocaleString()} SF`
                : null,
              ceilingBoundary.mainFloorAtticExposureSqft != null
                ? `Main-floor attic exposure ${ceilingBoundary.mainFloorAtticExposureSqft.toLocaleString()} SF`
                : null,
              ceilingBoundary.pendingExclusionSqft != null
                ? `${ceilingBoundary.pendingExclusionSqft.toLocaleString()} SF exclusion pending confirmation`
                : null,
              ceilingBoundary.vaultedOpenToBelowSqft != null &&
              ceilingBoundary.pendingExclusionSqft == null
                ? `Excludes ${ceilingBoundary.vaultedOpenToBelowSqft.toLocaleString()} SF vaulted/open-to-below`
                : null,
              ceilingBoundary.roofDeckInsulationSqft != null &&
              ceilingBoundary.pendingExclusionSqft == null
                ? `Excludes ${ceilingBoundary.roofDeckInsulationSqft.toLocaleString()} SF roof deck`
                : null,
              !ceilingBoundary.complete
                ? 'Boundary requires contractor confirmation'
                : null,
            ]
              .filter(Boolean)
              .join(' + ')
          : null;
        const openingDeductionSqft = resolveInsulationOpeningDeductionForReview(
          takeoff.measurements,
          mergeInsulationPlanFactsFromTakeoff(
            takeoff.planFacts,
            takeoff.buildingAreas,
            takeoff.measurements
          )
        );
        const sourceLabel = semanticsOn
          ? key === 'atticInsulationSqft' &&
            Number(value) > 0 &&
            !(Number(takeoff.measurements?.atticInsulationSqft) > 0) &&
            !takeoff.measurementProvenance?.[key]
            ? 'Calculated from conditioned ceiling geometry — confirm before pricing'
            : key === 'exteriorWallInsulationSqft' &&
                insulationOpeningNeedsReview(takeoff) &&
                !(Number(value) > 0)
              ? 'Opening deduction needs review — enter wall SF manually'
              : key === 'exteriorWallInsulationSqft' &&
                  Number(value) > 0 &&
                  openingDeductionSqft != null
                ? `Net wall area after ${openingDeductionSqft.toLocaleString()} SF window/door openings`
                : measurementSourceLabel({
                    key,
                    value: Number(value),
                    livingSf,
                    assumptions: takeoff.assumptions,
                  })
          : null;
        const evidenceLabel = planFieldEvidenceLabel(
          takeoff.measurementProvenance?.[key]
        );
        const provenanceEntry =
          takeoff.measurementProvenance?.[key] ??
          plumbingInventoryDerivedProvenance(takeoff.fixtureInventory, key);
        const needsManualInsulationWall =
          effectiveTradeKey === 'insulation' &&
          key === 'exteriorWallInsulationSqft' &&
          !(Number(value) > 0);
        const needsInsulationConfirmation =
          effectiveTradeKey === 'insulation' &&
          key === 'atticInsulationSqft' &&
          Number(value) > 0 &&
          !takeoff.measurementProvenance?.[key];
        const keepInsulationSuggestionSelected =
          effectiveTradeKey === 'insulation' &&
          (key === 'exteriorWallInsulationSqft' ||
            key === 'atticInsulationSqft') &&
          Number(value) > 0;
        const rowState = buildPlanReviewMeasurementRowState({
          key,
          provenanceEntry:
            provenanceEntry ??
            (needsManualInsulationWall || needsInsulationConfirmation
              ? { pricingEligible: false }
              : undefined),
          fieldConfidence: takeoff.fieldConfidence?.[key] ?? null,
          hasConflict: unresolvedConflictFields.has(key),
          reconciliationVariancePercent:
            areaReconciliation?.livingVariancePercent,
          validationField: takeoff.electricalValidation?.fields?.[key],
          tradeKey: effectiveTradeKey,
        });
        return {
          key,
          label: display.label,
          subtext:
            [display.subtext, fieldDef?.helperText, ceilingBoundaryText]
              .filter(Boolean)
              .join(' · ') || null,
          sourceLabel:
            [sourceLabel, evidenceLabel].filter(Boolean).join(' · ') || null,
          unit:
            effectiveTradeKey === 'plumbing'
              ? plumbingMeasurementDisplayUnit(key, meta.unit)
              : meta.unit,
          value: String(value),
          confidence: takeoff.fieldConfidence?.[key] ?? null,
          provenance: rowState.provenance,
          pricingEligible: rowState.pricingEligible,
          conflictValue,
          include:
            conflictValue == null &&
            (effectiveTradeKey === 'hvac'
              ? Number(value) > 0
              : rowState.includeDefault || keepInsulationSuggestionSelected),
        };
      })
      .sort((a, b) => {
        const orderA = MEASUREMENT_SORT_ORDER[a.key] ?? 50;
        const orderB = MEASUREMENT_SORT_ORDER[b.key] ?? 50;
        if (orderA !== orderB) return orderA - orderB;
        return (a.conflictValue ? 1 : 0) - (b.conflictValue ? 1 : 0);
      })
      .filter(
        row =>
          !(
            effectiveTradeKey === 'concrete' &&
            CONCRETE_REVIEW_THICKNESS_KEYS.has(row.key)
          ) &&
          !(
            effectiveTradeKey === 'flooring' &&
            FLOORING_REVIEW_ADAPTER_KEYS.has(row.key)
          ) &&
          !(
            effectiveTradeKey === 'flooring' &&
            row.key === 'floorAreaSqft' &&
            positiveMeasurement(visibleMeasurements.flooringSqft) != null
          ) &&
          !(
            effectiveTradeKey === 'painting' &&
            (row.key === 'paintAreaSqft' ||
              row.key === 'combinedPaintableAreaSqft') &&
            (positiveMeasurement(visibleMeasurements.wallPaintSqft) != null ||
              positiveMeasurement(visibleMeasurements.ceilingPaintSqft) != null)
          ) &&
          !(
            effectiveTradeKey === 'painting' &&
            row.key === 'combinedPaintableAreaSqft' &&
            positiveMeasurement(visibleMeasurements.paintAreaSqft) != null
          )
      );
    setRows(nextRows);

    const nextRooms: PlanReviewRoomRow[] = (
      tradeReview ? [] : takeoff.rooms || []
    )
      .map((room, idx) => {
        const name = String(room?.name || '').trim();
        if (!name) return null;
        const lengthFt =
          room.lengthFt != null &&
          Number.isFinite(Number(room.lengthFt)) &&
          Number(room.lengthFt) > 0
            ? Number(room.lengthFt)
            : null;
        const widthFt =
          room.widthFt != null &&
          Number.isFinite(Number(room.widthFt)) &&
          Number(room.widthFt) > 0
            ? Number(room.widthFt)
            : null;
        let area =
          room.areaSqft != null &&
          Number.isFinite(Number(room.areaSqft)) &&
          Number(room.areaSqft) > 0
            ? Math.round(Number(room.areaSqft) * 10) / 10
            : null;
        if (area == null && lengthFt != null && widthFt != null) {
          area = Math.round(lengthFt * widthFt * 10) / 10;
        }
        const provenance = resolvePlanMeasurementProvenance({
          key: `room:${name}`,
          hasReliableDimensions: lengthFt != null && widthFt != null,
          roomDependent: true,
          reconciliationVariancePercent:
            areaReconciliation?.livingVariancePercent,
        });
        return {
          id: `${name}-${idx}`,
          name,
          lengthFt,
          widthFt,
          areaSqft: area != null ? String(area) : '',
          include: area != null,
          spaceKind: classifyPlanSpaceName(name),
          sourceLabel: semanticsOn
            ? roomSourceLabel({
                name,
                lengthFt,
                widthFt,
                assumptions: takeoff.assumptions,
              })
            : null,
          provenance,
        };
      })
      .filter((r): r is PlanReviewRoomRow => r != null)
      .sort((a, b) => {
        if (semanticsOn && a.spaceKind !== b.spaceKind) {
          const order = { living: 0, other: 1, garage: 2 } as const;
          return order[a.spaceKind] - order[b.spaceKind];
        }
        return a.name.localeCompare(b.name);
      });
    setRoomRows(nextRooms);

    setScopeChecked(
      Object.fromEntries(scopeDetections.map(d => [d.itemId, true]))
    );
    // Rebuild only when a new takeoff arrives, not on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, takeoff, visibleMeasurements, tradeReview]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true)
    );
    const hidden = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false)
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) setKeyboardVisible(false);
  }, [visible]);

  const concreteReviewMeasurements = useMemo(() => {
    const merged: Record<string, string | number> = {
      ...(visibleMeasurements || {}),
    };
    for (const row of rows) {
      const n = Number(row.value);
      if (Number.isFinite(n) && n > 0) merged[row.key] = row.value;
    }
    return merged;
  }, [visibleMeasurements, rows]);

  const concretePlanSummary = useMemo(() => {
    if (effectiveTradeKey !== 'concrete') return null;
    return buildConcretePlanReviewSummary(concreteReviewMeasurements);
  }, [effectiveTradeKey, concreteReviewMeasurements]);

  const flooringReviewMeasurements = useMemo(() => {
    const merged: Record<string, string | number> = {
      ...(visibleMeasurements || {}),
    };
    for (const row of rows) {
      const n = Number(row.value);
      if (Number.isFinite(n) && n > 0) merged[row.key] = row.value;
    }
    return merged;
  }, [visibleMeasurements, rows]);

  const flooringPlanSummary = useMemo(() => {
    if (effectiveTradeKey !== 'flooring') return null;
    return buildFlooringPlanReviewSummary(flooringReviewMeasurements);
  }, [effectiveTradeKey, flooringReviewMeasurements]);

  const paintingReviewMeasurements = useMemo(() => {
    const merged: Record<string, string | number> = {
      ...(visibleMeasurements || {}),
    };
    for (const row of rows) {
      const n = Number(row.value);
      if (Number.isFinite(n) && n > 0) merged[row.key] = row.value;
    }
    return merged;
  }, [visibleMeasurements, rows]);

  const paintingPlanSummary = useMemo(() => {
    if (effectiveTradeKey !== 'painting') return null;
    return buildPaintingPlanReviewSummary(
      paintingReviewMeasurements,
      takeoff?.measurementProvenance
    );
  }, [
    effectiveTradeKey,
    paintingReviewMeasurements,
    takeoff?.measurementProvenance,
  ]);

  const electricalConflictState = useMemo(
    () =>
      applyPlanConflictChoices(
        takeoff?.measurementConflicts || [],
        conflictChoices,
        conflictManualValues
      ),
    [takeoff?.measurementConflicts, conflictChoices, conflictManualValues]
  );

  const electricalReviewMeasurements = useMemo(() => {
    const merged: Record<string, string | number> = {
      ...(visibleMeasurements || {}),
    };
    for (const row of rows) {
      if (row.key === 'unclassifiedFixtureCount') continue;
      const n = Number(row.value);
      if (Number.isFinite(n) && n > 0) merged[row.key] = row.value;
    }
    return mergeElectricalConflictReadings(
      merged,
      takeoff?.measurementConflicts,
      electricalConflictState.resolved
    );
  }, [
    visibleMeasurements,
    rows,
    takeoff?.measurementConflicts,
    electricalConflictState.resolved,
  ]);

  const electricalUnreadable = useMemo(
    () => uniqueUnreadablePlanFields(takeoff?.unreadableFields),
    [takeoff?.unreadableFields]
  );

  const electricalPlanSummary = useMemo(() => {
    if (effectiveTradeKey !== 'electrical') return null;
    const unclassified = electricalUnreadable.find(
      field => field.field === 'unclassifiedFixtureCount'
    );
    const unclassifiedCountMatch =
      unclassified?.reason?.match(/^(\d+)\s+lighting/i);
    return buildElectricalPlanReviewSummary(
      electricalReviewMeasurements,
      takeoff?.measurementProvenance,
      {
        unresolvedConflictFields: electricalConflictState.unresolved.map(
          conflict => conflict.field
        ),
        unclassifiedFixtureCount: unclassifiedCountMatch
          ? Number(unclassifiedCountMatch[1])
          : null,
        unclassifiedFixtureNote: unclassified?.reason || null,
        electricalValidation: takeoff?.electricalValidation,
      }
    );
  }, [
    effectiveTradeKey,
    electricalReviewMeasurements,
    takeoff?.measurementProvenance,
    takeoff?.electricalValidation,
    electricalConflictState.unresolved,
    electricalUnreadable,
  ]);

  const electricalDetectedLines = useMemo(
    () =>
      electricalPlanSummary
        ? electricalPlanReviewDetectedLines(electricalPlanSummary)
        : [],
    [electricalPlanSummary]
  );

  const electricalStatusLines = useMemo(
    () =>
      electricalPlanSummary
        ? electricalPlanReviewStatusLines(electricalPlanSummary)
        : [],
    [electricalPlanSummary]
  );

  const electricalReadiness = useMemo(() => {
    if (effectiveTradeKey !== 'electrical') return null;
    const unclassified = electricalUnreadable.find(
      field => field.field === 'unclassifiedFixtureCount'
    );
    const count = unclassified?.reason?.match(/^(\d+)\s+lighting/i)?.[1];
    return electricalPlanReadinessLine({
      measurements: electricalReviewMeasurements,
      provenance: takeoff?.measurementProvenance,
      conflicts: electricalConflictState.unresolved,
      unreadableFields: electricalUnreadable,
      unclassifiedFixtureCount: count ? Number(count) : null,
      validation: takeoff?.electricalValidation,
    });
  }, [
    effectiveTradeKey,
    electricalReviewMeasurements,
    takeoff?.measurementProvenance,
    takeoff?.electricalValidation,
    electricalConflictState.unresolved,
    electricalUnreadable,
  ]);

  if (!visible || !takeoff) return null;

  const tradeReviewKeys = new Set(
    getPlanTradeConfiguration(effectiveTradeKey)?.reviewMeasurementKeys || []
  );
  const unreadable = uniqueUnreadablePlanFields(
    takeoff.unreadableFields
  ).filter(field =>
    tradeReview
      ? tradeReviewKeys.has(String(field.field || '')) ||
        field.field === 'unclassifiedFixtureCount'
      : true
  );
  const lowConfidence = (takeoff.lowConfidence || []).filter(field =>
    tradeReview ? tradeReviewKeys.has(String(field.field || '')) : true
  );
  const measurementConflicts = reviewablePlanMeasurementConflicts({
    conflicts: takeoff.measurementConflicts,
    provenance: takeoff.measurementProvenance,
  }).filter(conflict =>
    tradeReview ? tradeReviewKeys.has(String(conflict.field || '')) : true
  );
  const conflictFieldSet = planTakeoffConflictFieldSet(measurementConflicts);
  const reviewLowConfidence = filterLowConfidenceForReview(
    lowConfidence,
    conflictFieldSet
  );
  const reviewUnreadable = filterUnreadableForReview(
    unreadable,
    conflictFieldSet
  );
  const hvacReviewReadings =
    effectiveTradeKey === 'hvac'
      ? buildHvacPlanReviewLowConfidenceReadings(
          takeoff,
          Object.fromEntries(rows.map(row => [row.key, row.value]))
        ).filter(reading => !conflictFieldSet.has(reading.field))
      : [];
  const hasMeasurements = rows.length > 0;
  const hasRooms = roomRows.length > 0;
  const hasReadingIssues =
    reviewLowConfidence.length > 0 || reviewUnreadable.length > 0;
  const plumbingMissingItems =
    effectiveTradeKey === 'plumbing'
      ? [
          ...unreadable.map(field => {
            const label = quickMeasurementFieldMeta(field.field).label;
            return `${label}: ${field.reason}`;
          }),
          ...(takeoff.plumbingReviewStatus ? [] : takeoff.missingInfo || []),
        ]
          .map(item => String(item).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
  const plumbingReviewStatus = takeoff.plumbingReviewStatus;
  const includedCount = rows.filter(
    r => r.include && Number(r.value) > 0
  ).length;
  const includedRoomCount = roomRows.filter(
    r => r.include && Number(r.areaSqft) > 0
  ).length;
  const checkedScopeCount = scopeDetections.filter(
    d => scopeChecked[d.itemId]
  ).length;
  const canApply = tradeReview
    ? true
    : includedCount > 0 || includedRoomCount > 0 || checkedScopeCount > 0;
  const tradeLabel = tradeReview
    ? importSelection.trade?.label ||
      getPlanTradeConfiguration(effectiveTradeKey)?.label ||
      'Trade'
    : null;
  const livingSpaceCount = roomRows.filter(
    r => r.spaceKind === 'living'
  ).length;
  const garageSpaceCount = roomRows.filter(
    r => r.spaceKind === 'garage'
  ).length;
  const hasRoofQuantity =
    Number(takeoff.measurements?.roofSquares) > 0 ||
    Number(
      (
        takeoff.itemQuantities as
          | Record<string, { quantity?: number }>
          | undefined
      )?.roofing?.quantity
    ) > 0;
  const hasPlanFloorAreas =
    (takeoff.rooms || []).some(r => Number(r.areaSqft) > 0) ||
    Number(takeoff.measurements?.kitchenFloorSqft) > 0 ||
    Number(takeoff.measurements?.bathroomFloorSqft) > 0 ||
    Number(takeoff.measurements?.flooringSqft) > 0;
  const plumbingInventory = Object.entries(
    takeoff.fixtureInventory || {}
  ).filter(([, value]) => Number(value) > 0);
  const plumbingInventoryTotal = sumPlumbingFixtureInventoryPoints(
    takeoff.fixtureInventory
  );
  const plumbingWaterHeaterDetail = takeoff.waterHeaterDetail;
  const plumbingGasApplianceScope = takeoff.gasApplianceScope;
  const plumbingWaterHeaterLine = formatPlumbingWaterHeaterDetail(
    plumbingWaterHeaterDetail
  );
  const plumbingGasLines = formatPlumbingGasApplianceScope(
    plumbingGasApplianceScope
  );
  const plumbingDerivedRows = rows.filter(
    row => row.provenance.status === 'ai_inferred'
  );
  const plumbingUtilityConnections = takeoff.utilityConnections || [];
  const plumbingComplexityFactors = takeoff.complexityFactors || [];

  const setRow = (key: string, patch: Partial<PlanReviewRow>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  };

  const setRoomRow = (id: string, patch: Partial<PlanReviewRoomRow>) => {
    setRoomRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleApply = () => {
    const pendingManual = pendingManualConflictFields(
      conflictChoices,
      conflictManualValues,
      conflictManualCommitted
    );
    if (pendingManual.length) {
      Alert.alert(
        'Enter the custom count',
        'Type a quantity for Enter manually, then tap Use this count — or pick one of the plan readings. This page stays open until the takeoff is applied.'
      );
      return;
    }
    const { resolved, unresolved, resolutions } = applyPlanConflictChoices(
      measurementConflicts,
      conflictChoices,
      conflictManualValues
    );
    if (effectiveTradeKey === 'plumbing' && unresolved.length) {
      Alert.alert(
        'Choose the plan reading',
        'These conflicting plumbing lengths have to be resolved on this takeoff page. Pick the value that matches the drawing, then apply.'
      );
      return;
    }
    const unresolvedFields = new Set(
      unresolved.map(conflict => String(conflict.field))
    );
    const values: Record<string, string> = {};
    for (const row of rows) {
      if (unresolvedFields.has(row.key)) continue;
      const n = Number(row.value);
      if (!(Number.isFinite(n) && n > 0)) continue;
      if (effectiveTradeKey === 'hvac' || row.include) {
        values[row.key] = String(n);
      }
    }
    for (const [key, value] of Object.entries(resolved)) {
      values[key] = String(value);
    }
    if (effectiveTradeKey === 'plumbing') {
      const hydrated = hydratePlumbingPlanMeasurementsFromInventory(
        values,
        takeoff.fixtureInventory,
        {
          waterHeaterDetail: takeoff.waterHeaterDetail,
          gasApplianceScope: takeoff.gasApplianceScope,
          complexityFactors: takeoff.complexityFactors,
        }
      );
      for (const [key, value] of Object.entries(hydrated)) {
        if (values[key] != null && values[key] !== '') continue;
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) values[key] = String(n);
      }
    }
    if (effectiveTradeKey === 'framing') {
      const reconciled = reconcileFramingScopeMeasurements({
        ...values,
        planImportTradeKey: 'framing',
        quickMeasurementSources: takeoff?.quickMeasurementSources,
      }) as Record<string, string | number>;
      for (const [key, value] of Object.entries(reconciled)) {
        if (key === 'itemQuantities' || key === 'framingScope') continue;
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) continue;
        values[key] = String(n);
      }
    }
    if (effectiveTradeKey === 'drywall') {
      const hydrated = hydrateDrywallComponentMeasurementsFromPlanContext(
        { ...visibleMeasurements, ...values },
        takeoff?.rooms,
        (takeoff?.planFacts || null) as Record<string, unknown> | null
      );
      for (const key of [...DRYWALL_PLAN_QUICK_MEASUREMENT_KEYS, 'drywallSqft']) {
        const n = positiveMeasurement(hydrated[key]);
        if (n != null) values[key] = String(n);
      }
    }
    const retainedConflictProvenance = Object.fromEntries(
      unresolved.flatMap(conflict => {
        const field = String(conflict.field || '').trim();
        const candidateValue =
          conflict.selectedValue ??
          conflict.candidates?.find(candidate => Number(candidate?.value) > 0)
            ?.value;
        if (!field || !Number.isFinite(Number(candidateValue))) return [];
        values[field] = String(candidateValue);
        const existing = takeoff.measurementProvenance?.[field];
        return [
          [
            field,
            {
              ...(existing && typeof existing === 'object' ? existing : {}),
              value: Number(candidateValue),
              status: 'needs_review',
              normalizedSource: 'NEEDS_REVIEW',
              pricingEligible: false,
              reason:
                'A plan conflict is still unresolved; confirm this quantity before pricing.',
            },
          ],
        ];
      })
    );
    const hvacLowConfidenceSource =
      effectiveTradeKey === 'hvac'
        ? hvacReviewReadings
        : reviewLowConfidence;
    const confirmedLowConfidence = hvacLowConfidenceSource.filter(
      reading => lowConfidenceAccepted[String(reading.field || '').trim()]
    );
    for (const reading of confirmedLowConfidence) {
      const field = String(reading.field || '').trim();
      const value = Number(reading.value);
      if (!field || !(value > 0)) continue;
      values[field] = String(value);
    }
    const unconfirmedLowConfidence = filterLowConfidenceForReview(
      hvacLowConfidenceSource,
      new Set([
        ...conflictFieldSet,
        ...confirmedLowConfidence.map(reading =>
          String(reading.field || '').trim()
        ),
      ])
    );
    const hvacUnconfirmedReadings =
      effectiveTradeKey === 'hvac'
        ? hvacTakeoffSkippedCanonicalReadings(
            hvacLowConfidenceSource,
            lowConfidenceAccepted
          )
        : unconfirmedLowConfidence;
    for (const reading of hvacUnconfirmedReadings) {
      const field = String(reading.field || '').trim();
      const value = Number(reading.value);
      if (!field || !(value > 0)) continue;
      values[field] = String(value);
    }
    // An HVAC edit is the contractor's replacement for the AI read. Reapply
    // the row values after the low-confidence pass so the edited value wins.
    if (effectiveTradeKey === 'hvac') {
      for (const row of rows) {
        const value = Number(row.value);
        if (row.key && Number.isFinite(value) && value > 0) {
          values[row.key] = String(value);
        }
      }
    }
    const electricalUnconfirmedLowConfidence =
      effectiveTradeKey === 'electrical' ? unconfirmedLowConfidence : [];
    const retainedLowConfidenceProvenance = Object.fromEntries([
      ...confirmedLowConfidence.flatMap(reading => {
        const field = String(reading.field || '').trim();
        const value = Number(reading.value);
        if (!field || !(value > 0)) return [];
        const existing = takeoff.measurementProvenance?.[field];
        return [
          [
            field,
            {
              ...(existing && typeof existing === 'object' ? existing : {}),
              ...lowConfidenceConfirmationProvenance(field, value),
            },
          ],
        ];
      }),
      ...((effectiveTradeKey === 'hvac'
        ? hvacUnconfirmedReadings
        : unconfirmedLowConfidence
      ).flatMap(reading => {
        const field = String(reading.field || '').trim();
        const value = Number(reading.value);
        if (!field || !(value > 0)) return [];
        const existing = takeoff.measurementProvenance?.[field];
        return [
          [
            field,
            {
              ...(existing && typeof existing === 'object' ? existing : {}),
              ...lowConfidenceNeedsReviewProvenance(field, value),
            },
          ],
        ];
      })),
    ]);
    const hvacReviewProvenance =
      effectiveTradeKey === 'hvac'
        ? Object.fromEntries(
            rows.flatMap(row => {
              const value = Number(row.value);
              if (!(value > 0) || unresolvedFields.has(row.key)) return [];
              const existing = takeoff.measurementProvenance?.[row.key];
              const field = row.key;
              if (
                row.provenance.status === 'user_confirmed' ||
                lowConfidenceAccepted[field]
              ) {
                return [
                  [
                    field,
                    {
                      ...(existing && typeof existing === 'object'
                        ? existing
                        : {}),
                      ...lowConfidenceConfirmationProvenance(field, value),
                    },
                  ],
                ];
              }
              if (!row.pricingEligible) {
                return [
                  [
                    field,
                    {
                      ...(existing && typeof existing === 'object'
                        ? existing
                        : {}),
                      ...lowConfidenceNeedsReviewProvenance(field, value),
                    },
                  ],
                ];
              }
              return [];
            })
          )
        : {};
    const retainedPlanReviewLockProvenance = tradeReview
      ? buildPlanReviewLockedProvenance(
          rows
            .filter(row => {
              if (unresolvedFields.has(row.key)) return false;
              if (!(Number(row.value) > 0)) return false;
              if (effectiveTradeKey === 'hvac') {
                return Boolean(lowConfidenceAccepted[row.key]);
              }
              return (
                row.include &&
                row.pricingEligible &&
                !unconfirmedLowConfidence.some(
                  reading => String(reading.field || '') === row.key
                )
              );
            })
            .map(row => ({
              key: row.key,
              value: row.value,
              include: true,
              pricingEligible: row.pricingEligible,
            })),
          takeoff.measurementProvenance
        )
      : {};
    const reviewElectricalValidation = (() => {
      const confirmedFields =
        effectiveTradeKey === 'electrical'
          ? new Set([
              ...Object.keys(resolved),
              ...confirmedLowConfidence.map(reading =>
                String(reading.field || '').trim()
              ),
              ...rows
                .filter(
                  row =>
                    row.include &&
                    row.pricingEligible &&
                    takeoff.electricalValidation?.fields?.[row.key]
                      ?.pricingEligible !== true
                )
                .map(row => row.key),
            ])
          : new Set<string>();
      if (
        !electricalUnconfirmedLowConfidence.length &&
        !confirmedLowConfidence.length &&
        !confirmedFields.size
      ) {
        return takeoff.electricalValidation;
      }
      const validation = takeoff.electricalValidation || {};
      const fields = { ...(validation.fields || {}) };
      const priceableFields = new Set(validation.priceableFields || []);
      const blockedFields = new Set(validation.blockedFields || []);
      for (const reading of electricalUnconfirmedLowConfidence) {
        const field = String(reading.field || '').trim();
        if (!field) continue;
        fields[field] = {
          ...(fields[field] || {}),
          status: 'needs_review',
          pricingEligible: false,
          reason:
            'The plan reading confidence is too low; confirm this quantity before pricing.',
        };
        priceableFields.delete(field);
        blockedFields.add(field);
      }
      for (const field of confirmedFields) {
        fields[field] = {
          ...(fields[field] || {}),
          status: 'user_confirmed',
          pricingEligible: true,
          reason: 'Contractor confirmed this quantity during plan review.',
        };
        priceableFields.add(field);
        blockedFields.delete(field);
      }
      return {
        ...validation,
        fields,
        priceableFields: [...priceableFields],
        blockedFields: [...blockedFields],
      };
    })();
    const rooms = (
      effectiveTradeKey === 'painting' && roomRows.length === 0
        ? (takeoff.rooms || []).map(room => ({
            name: String(room?.name || '').trim(),
            areaSqft:
              room.areaSqft != null && Number(room.areaSqft) > 0
                ? Math.round(Number(room.areaSqft) * 10) / 10
                : null,
            lengthFt: room.lengthFt ?? null,
            widthFt: room.widthFt ?? null,
          }))
        : roomRows
            .filter(r => r.include)
            .map(r => {
              const area = Number(r.areaSqft);
              return {
                name: r.name,
                areaSqft:
                  Number.isFinite(area) && area > 0
                    ? Math.round(area * 10) / 10
                    : null,
                lengthFt: r.lengthFt,
                widthFt: r.widthFt,
              };
            })
    ).filter(r => r.name);
    const hvacQuickMeasurementSourcesFromReview =
      effectiveTradeKey === 'hvac'
        ? Object.fromEntries([
            ...confirmedLowConfidence.flatMap(reading => {
              const field = String(reading.field || '').trim();
              if (!field) return [];
              return [[field, 'contractor_confirmed_from_plan_review'] as const];
            }),
            ...hvacUnconfirmedReadings.flatMap(reading => {
              const field = String(reading.field || '').trim();
              if (!field) return [];
              return [[field, 'needs_confirmation'] as const];
            }),
          ])
        : undefined;
    onApply(
      values,
      scopeDetections.filter(d => scopeChecked[d.itemId]),
      rooms,
      {
        measurementProvenance: {
          ...(takeoff.measurementProvenance || {}),
          ...retainedConflictProvenance,
          ...retainedLowConfidenceProvenance,
          ...hvacReviewProvenance,
          ...retainedPlanReviewLockProvenance,
          ...Object.fromEntries(
            Object.entries(resolutions).map(([field, resolution]) => [
              field,
              conflictResolutionProvenanceEntry(resolution),
            ])
          ),
        },
        measurementConflicts: unresolved,
        electricalValidation: reviewElectricalValidation,
        utilityConnections: takeoff.utilityConnections,
        fixtureInventory: takeoff.fixtureInventory,
        complexityFactors: takeoff.complexityFactors,
        plumbingReviewStatus: takeoff.plumbingReviewStatus,
        waterHeaterDetail: takeoff.waterHeaterDetail,
        gasApplianceScope: takeoff.gasApplianceScope,
        ...(hvacQuickMeasurementSourcesFromReview
          ? { quickMeasurementSources: hvacQuickMeasurementSourcesFromReview }
          : {}),
      }
    );
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='fullScreen'
      onRequestClose={onCancel}
    >
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          <KeyboardPlainAccessory
            nativeID={KEYBOARD_ACCESSORY_IDS.aiScopeConfirmNumeric}
            backgroundColor={Colors.bg}
          />
          <AIEstimateFlowHeader
            title={
              tradeLabel
                ? `Review ${tradeLabel} Takeoff`
                : 'Review plan takeoff'
            }
            subtitle={
              tradeLabel
                ? `Check ${
                    tradeLabel === 'HVAC' ? 'HVAC' : tradeLabel.toLowerCase()
                  } quantities before they fill the bid`
                : 'Check numbers before they fill the bid'
            }
            onBack={onCancel}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps='always'
            keyboardDismissMode='on-drag'
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {measurementConflicts.length ? (
              <PlanTakeoffConflictChooser
                key={`${conflictChooserKey}-${planConflictChooserRowsKey(measurementConflicts)}`}
                conflicts={measurementConflicts}
                choices={conflictChoices}
                manualValues={conflictManualValues}
                onChoose={(field, choice) => {
                  if (choice !== 'manual') {
                    setConflictManualCommitted(committed => {
                      if (!committed[field]) return committed;
                      const nextCommitted = { ...committed };
                      delete nextCommitted[field];
                      return nextCommitted;
                    });
                  }
                  setConflictChoices(prev => {
                    if (choice == null) {
                      const next = { ...prev };
                      delete next[field];
                      return next;
                    }
                    return { ...prev, [field]: choice };
                  });
                }}
                onManualChange={(field, value) => {
                  setConflictManualValues(prev => ({
                    ...prev,
                    [field]: value,
                  }));
                  setConflictManualCommitted(prev => {
                    if (!prev[field]) return prev;
                    const next = { ...prev };
                    delete next[field];
                    return next;
                  });
                }}
                onManualSubmit={(field, value) => {
                  setConflictManualValues(prev => ({
                    ...prev,
                    [field]: value,
                  }));
                  setConflictManualCommitted(prev => ({
                    ...prev,
                    [field]: true,
                  }));
                }}
                darkMode={darkMode}
                captionColor={Colors.sub}
              />
            ) : null}

            {hasReadingIssues && effectiveTradeKey !== 'hvac' ? (
              <PlanTakeoffLowConfidenceChooser
                lowConfidence={reviewLowConfidence}
                unreadable={reviewUnreadable}
                accepted={lowConfidenceAccepted}
                onToggleAccept={(field, _value) => {
                  setLowConfidenceAccepted(prev => {
                    const next = { ...prev };
                    if (next[field]) delete next[field];
                    else next[field] = true;
                    return next;
                  });
                }}
                darkMode={darkMode}
                captionColor={Colors.sub}
              />
            ) : null}

            {effectiveTradeKey === 'plumbing' &&
            (plumbingInventory.length ||
              plumbingWaterHeaterLine ||
              plumbingGasLines.length ||
              plumbingDerivedRows.length ||
              plumbingUtilityConnections.length ||
              plumbingComplexityFactors.length ||
              plumbingReviewStatus?.detected?.length ||
              plumbingReviewStatus?.needsConfirmation?.length ||
              plumbingReviewStatus?.notFound?.length ||
              plumbingMissingItems.length) ? (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  AI detection
                </Text>
                <Text style={[styles.sectionHeading, { color: Colors.text }]}>
                  Plumbing detection
                </Text>
                <ReviewPanel darkMode={darkMode}>
                  {plumbingReviewStatus?.detected?.length ? (
                    <>
                      <Text
                        style={[styles.summaryLabel, { color: Colors.sub }]}
                      >
                        Detected
                      </Text>
                      {plumbingReviewStatus.detected.map((item, index) => (
                        <Text
                          key={`plumbing-detected-${index}`}
                          style={[styles.evidenceText, { color: Colors.text }]}
                        >
                          {item}
                        </Text>
                      ))}
                    </>
                  ) : null}
                  {plumbingInventory.length ? (
                    <>
                      <Text
                        style={[
                          styles.summaryLabel,
                          {
                            color: Colors.sub,
                            marginTop: plumbingReviewStatus?.detected?.length
                              ? 10
                              : 0,
                          },
                        ]}
                      >
                        Fixture inventory read from the plan
                      </Text>
                      {PLUMBING_FIXTURE_INVENTORY_ORDER.filter(
                        key => Number(takeoff.fixtureInventory?.[key]) > 0
                      ).map(key => (
                        <Text
                          key={`fixture-${key}`}
                          style={[styles.evidenceText, { color: Colors.text }]}
                        >
                          {plumbingFixtureInventoryLabel(key)}:{' '}
                          {takeoff.fixtureInventory?.[key]}
                        </Text>
                      ))}
                      {plumbingInventoryTotal > 0 ? (
                        <Text
                          style={[
                            styles.evidenceText,
                            { color: Colors.sub, marginTop: 6 },
                          ]}
                        >
                          Total rough-in points: {plumbingInventoryTotal}{' '}
                          fixtures
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                  {plumbingWaterHeaterLine ? (
                    <>
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: Colors.sub, marginTop: 10 },
                        ]}
                      >
                        Water heater
                      </Text>
                      <Text
                        style={[styles.evidenceText, { color: Colors.text }]}
                      >
                        {plumbingWaterHeaterLine}
                      </Text>
                    </>
                  ) : null}
                  {plumbingGasLines.length ? (
                    <>
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: Colors.sub, marginTop: 10 },
                        ]}
                      >
                        Gas appliances
                      </Text>
                      {plumbingGasLines.map((line, index) => (
                        <Text
                          key={`gas-scope-${index}`}
                          style={[styles.evidenceText, { color: Colors.text }]}
                        >
                          {line}
                        </Text>
                      ))}
                    </>
                  ) : null}
                  {plumbingDerivedRows.length ? (
                    <Text
                      style={[styles.evidenceText, { color: CONFIRM_YELLOW }]}
                    >
                      {plumbingDerivedRows
                        .map(row => `${row.label} ${row.value} ${row.unit}`)
                        .join(' · ')}
                      {
                        ' — derived from the fixture inventory; confirm before pricing.'
                      }
                    </Text>
                  ) : null}
                  {plumbingUtilityConnections.length ? (
                    <>
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: Colors.sub, marginTop: 10 },
                        ]}
                      >
                        Utility connections / allowances
                      </Text>
                      {plumbingUtilityConnections.map((connection, index) => (
                        <Text
                          key={`utility-${connection.label}-${index}`}
                          style={[
                            styles.evidenceText,
                            { color: CONFIRM_YELLOW },
                          ]}
                        >
                          {connection.label} — confirm scope/allowance; no
                          automatic quantity
                        </Text>
                      ))}
                    </>
                  ) : null}
                  {plumbingComplexityFactors.length ? (
                    <>
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: Colors.sub, marginTop: 10 },
                        ]}
                      >
                        Complexity flags — review only
                      </Text>
                      {plumbingComplexityFactors.map((factor, index) => (
                        <Text
                          key={`complexity-${factor.label}-${index}`}
                          style={[styles.evidenceText, { color: Colors.sub }]}
                        >
                          {factor.label} — does not automatically change labor
                          pricing
                        </Text>
                      ))}
                    </>
                  ) : null}
                  {plumbingReviewStatus?.needsConfirmation?.length ? (
                    <>
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: CONFIRM_YELLOW, marginTop: 10 },
                        ]}
                      >
                        Needs confirmation
                      </Text>
                      {plumbingReviewStatus.needsConfirmation.map(
                        (item, index) => (
                          <Text
                            key={`plumbing-confirm-${index}`}
                            style={[
                              styles.evidenceText,
                              { color: CONFIRM_YELLOW },
                            ]}
                          >
                            {item}
                          </Text>
                        )
                      )}
                    </>
                  ) : null}
                  {plumbingReviewStatus?.notFound?.length ? (
                    <>
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: CONFIRM_RED, marginTop: 10 },
                        ]}
                      >
                        Not found
                      </Text>
                      {plumbingReviewStatus.notFound.map((item, index) => (
                        <Text
                          key={`plumbing-notfound-${index}`}
                          style={[styles.evidenceText, { color: CONFIRM_RED }]}
                        >
                          {item}
                        </Text>
                      ))}
                    </>
                  ) : null}
                  {plumbingMissingItems.length ? (
                    <>
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: CONFIRM_RED, marginTop: 10 },
                        ]}
                      >
                        Missing or unreadable
                      </Text>
                      {plumbingMissingItems.map((item, index) => (
                        <Text
                          key={`missing-plumbing-${index}`}
                          style={[styles.evidenceText, { color: CONFIRM_RED }]}
                        >
                          {item}
                        </Text>
                      ))}
                    </>
                  ) : null}
                </ReviewPanel>
              </View>
            ) : null}

            {concretePlanSummary ? (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  Project
                </Text>
                <Text style={[styles.sectionHeading, { color: Colors.text }]}>
                  Concrete
                </Text>
                <TradeSummaryPanel
                  darkMode={darkMode}
                  labelColor={Colors.sub}
                  valueColor={Colors.text}
                  lines={concretePlanSummary}
                />
              </View>
            ) : null}
            {flooringPlanSummary ? (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  Project
                </Text>
                <Text style={[styles.sectionHeading, { color: Colors.text }]}>
                  Flooring
                </Text>
                <TradeSummaryPanel
                  darkMode={darkMode}
                  labelColor={Colors.sub}
                  valueColor={Colors.text}
                  lines={flooringPlanSummary}
                />
              </View>
            ) : null}
            {paintingPlanSummary ? (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  Project
                </Text>
                <Text style={[styles.sectionHeading, { color: Colors.text }]}>
                  Painting
                </Text>
                <TradeSummaryPanel
                  darkMode={darkMode}
                  labelColor={Colors.sub}
                  valueColor={Colors.text}
                  lines={paintingPlanSummary}
                />
              </View>
            ) : null}
            {effectiveTradeKey === 'hvac' ? (
              <PlanTakeoffLowConfidenceChooser
                lowConfidence={hvacReviewReadings}
                unreadable={[]}
                accepted={lowConfidenceAccepted}
                includeEmptyReadings
                onToggleAccept={(field, _value) => {
                  setLowConfidenceAccepted(prev => {
                    const next = { ...prev };
                    if (next[field]) delete next[field];
                    else next[field] = true;
                    return next;
                  });
                }}
                onEditValue={(field, value) => {
                  setRow(field, {
                    value,
                    include: true,
                    pricingEligible: true,
                    provenance: resolvePlanMeasurementProvenance({
                      key: field,
                      userConfirmed: true,
                    }),
                  });
                  if (Number(value) > 0) {
                    setLowConfidenceAccepted(prev => ({
                      ...prev,
                      [field]: true,
                    }));
                  }
                }}
                darkMode={darkMode}
                captionColor={Colors.sub}
              />
            ) : hasMeasurements && effectiveTradeKey !== 'hvac' ? (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  Takeoff
                </Text>
                <Text style={[styles.sectionHeading, { color: Colors.text }]}>
                  {concretePlanSummary ||
                  flooringPlanSummary ||
                  paintingPlanSummary ||
                  electricalStatusLines.length
                    ? 'Quantities'
                    : 'Measurements'}
                </Text>
                {electricalReadiness ? (
                  <ReviewPanel darkMode={darkMode}>
                    <Text style={[styles.summaryLabel, { color: Colors.sub }]}>
                      {electricalReadiness.label}
                    </Text>
                    <Text style={[styles.summaryValue, { color: Colors.text }]}>
                      {electricalReadiness.value}
                    </Text>
                    <Text style={[styles.evidenceText, { color: Colors.sub }]}>
                      {electricalReadiness.note}
                    </Text>
                  </ReviewPanel>
                ) : null}
                {rows.map(row => {
                  const provenanceColor = planProvenanceColor(
                    row.provenance.status,
                    Colors
                  );
                  const confirmRow = !row.pricingEligible;
                  return (
                    <ReviewPanel key={row.key} darkMode={darkMode}>
                      <View style={styles.quantityHeader}>
                        <TouchableOpacity
                          onPress={() => {
                            if (row.pricingEligible) {
                              setRow(row.key, { include: !row.include });
                              return;
                            }
                            const prompt = planReviewCheckboxBlockedMessage(
                              row.provenance,
                              row
                            );
                            Alert.alert(prompt.title, prompt.message, [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: prompt.confirmLabel,
                                onPress: () =>
                                  setRow(row.key, {
                                    include: true,
                                    pricingEligible: true,
                                    provenance:
                                      resolvePlanMeasurementProvenance({
                                        key: row.key,
                                        userConfirmed: true,
                                      }),
                                  }),
                              },
                            ]);
                          }}
                          style={styles.checkbox}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons
                            name={row.include ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={row.include ? '#22c55e' : Colors.sub}
                          />
                        </TouchableOpacity>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[
                              styles.itemTitle,
                              styles.measurementTitle,
                              { color: Colors.text },
                            ]}
                            numberOfLines={3}
                          >
                            {row.label}
                          </Text>
                          <Text
                            style={{
                              color: confirmRow
                                ? CONFIRM_YELLOW
                                : provenanceColor,
                              fontSize: 12,
                              fontWeight: '700',
                              marginTop: 4,
                            }}
                          >
                            {row.provenance.label}
                          </Text>
                          {row.sourceLabel || row.subtext ? (
                            <Text
                              style={[
                                styles.evidenceText,
                                { color: Colors.sub },
                              ]}
                              numberOfLines={2}
                            >
                              {row.sourceLabel || row.subtext}
                            </Text>
                          ) : null}
                          {row.conflictValue != null ? (
                            <Text style={styles.conflictText}>
                              Replaces your {row.conflictValue} {row.unit}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View
                        style={[
                          styles.valueShell,
                          {
                            borderColor: darkMode
                              ? PANEL_BORDER_DARK
                              : PANEL_BORDER_LIGHT,
                            backgroundColor: darkMode ? '#27272a' : '#f1f5f9',
                          },
                        ]}
                      >
                        <TextInput
                          value={row.value}
                          onChangeText={t =>
                            setRow(row.key, {
                              value: t,
                              provenance: resolvePlanMeasurementProvenance({
                                key: row.key,
                                userConfirmed: true,
                              }),
                              pricingEligible: true,
                              include: true,
                            })
                          }
                          {...aiScopeConfirmNumericKeyboardProps}
                          keyboardType='decimal-pad'
                          style={[styles.valueInput, { color: Colors.text }]}
                        />
                        <Text style={[styles.unitText, { color: Colors.sub }]}>
                          {row.unit}
                        </Text>
                      </View>
                    </ReviewPanel>
                  );
                })}
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  Takeoff
                </Text>
                <Text style={[styles.sectionHeading, { color: Colors.text }]}>
                  Measurements
                </Text>
                <ReviewPanel darkMode={darkMode}>
                  <Text style={[styles.emptyText, { color: Colors.sub }]}>
                    {effectiveTradeKey === 'plumbing'
                      ? 'AI reviewed available plumbing sheets. Confirm quantities before applying pricing.'
                      : tradeLabel
                        ? `No ${tradeLabel} quantities were verified from the selected plan pages yet. ${
                            takeoff.missingInfo?.length
                              ? `Confirm: ${takeoff.missingInfo.join(', ')}. `
                              : 'Review the relevant trade sheets and confirm the missing quantities. '
                          }You can still apply and enter quantities in Confirm Scope.`
                        : takeoff.reason ||
                          'No square footage could be read from these pages.'}
                  </Text>
                </ReviewPanel>
              </View>
            )}

            {electricalDetectedLines.length || electricalStatusLines.length ? (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  Project
                </Text>
                {electricalDetectedLines.length ? (
                  <>
                    <Text
                      style={[styles.sectionHeading, { color: Colors.text }]}
                    >
                      Detected quantities
                    </Text>
                    <TradeSummaryPanel
                      darkMode={darkMode}
                      labelColor={Colors.sub}
                      valueColor={Colors.text}
                      lines={electricalDetectedLines}
                    />
                  </>
                ) : null}
                {electricalStatusLines.length ? (
                  <>
                    <Text
                      style={[
                        styles.sectionHeading,
                        {
                          color: Colors.text,
                          marginTop: electricalDetectedLines.length ? 8 : 0,
                        },
                      ]}
                    >
                      Electrical status
                    </Text>
                    <TradeSummaryPanel
                      darkMode={darkMode}
                      labelColor={Colors.sub}
                      valueColor={Colors.text}
                      lines={electricalStatusLines}
                    />
                  </>
                ) : null}
              </View>
            ) : null}

            {semanticsOn && areaReconciliation ? (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  Areas
                </Text>
                <Text style={[styles.sectionHeading, { color: Colors.text }]}>
                  Area reconciliation
                </Text>
                <ReviewPanel darkMode={darkMode}>
                  <Text
                    style={[styles.reconcileBlockTitle, { color: Colors.text }]}
                  >
                    Living area
                  </Text>
                  <Text style={[styles.reconcileLine, { color: Colors.sub }]}>
                    Declared: {formatSf(areaReconciliation.declaredLivingSf)} SF
                  </Text>
                  <Text style={[styles.reconcileLine, { color: Colors.sub }]}>
                    Assigned to detected rooms: approximately{' '}
                    {formatSf(areaReconciliation.detectedLivingRoomSf)} SF
                  </Text>
                  <Text style={[styles.reconcileLine, { color: Colors.sub }]}>
                    Unassigned: approximately{' '}
                    {formatSf(areaReconciliation.unassignedLivingSf)} SF
                  </Text>
                  <Text style={[styles.reconcileLine, { color: Colors.sub }]}>
                    Variance: approximately{' '}
                    {formatSf(areaReconciliation.livingVariancePercent)}%
                  </Text>
                  <Text
                    style={[styles.reconcileStatus, { color: Colors.text }]}
                  >
                    Status:{' '}
                    {livingReconciliationStatusLabel(areaReconciliation)}
                  </Text>

                  <Text
                    style={[
                      styles.reconcileBlockTitle,
                      { color: Colors.text, marginTop: 12 },
                    ]}
                  >
                    Garage area
                  </Text>
                  <Text style={[styles.reconcileLine, { color: Colors.sub }]}>
                    Declared: {formatSf(areaReconciliation.declaredGarageSf)} SF
                  </Text>
                  <Text style={[styles.reconcileLine, { color: Colors.sub }]}>
                    Assigned to detected garage spaces: approximately{' '}
                    {formatSf(areaReconciliation.detectedGarageRoomSf)} SF
                  </Text>
                  <Text style={[styles.reconcileLine, { color: Colors.sub }]}>
                    Unassigned: approximately{' '}
                    {formatSf(areaReconciliation.unassignedGarageSf)} SF
                  </Text>
                  <Text style={[styles.reconcileLine, { color: Colors.sub }]}>
                    Variance: approximately{' '}
                    {formatSf(areaReconciliation.garageVariancePercent)}%
                  </Text>
                  <Text
                    style={[styles.reconcileStatus, { color: Colors.text }]}
                  >
                    Status:{' '}
                    {garageReconciliationStatusLabel(areaReconciliation)}
                  </Text>

                  <Text style={[styles.reconcileHint, { color: Colors.sub }]}>
                    Room dimensions are net detected spaces and may not include
                    bathrooms, halls, closets, wall area or circulation.
                  </Text>
                </ReviewPanel>
              </View>
            ) : null}

            {hasRooms ? (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  Spaces
                </Text>
                <Text style={[styles.sectionHeading, { color: Colors.text }]}>
                  {semanticsOn
                    ? spacesDetectedTitle(roomRows.length)
                    : `Rooms (${includedRoomCount} of ${roomRows.length})`}
                </Text>
                <Text style={[styles.roomHint, { color: Colors.sub }]}>
                  {semanticsOn
                    ? [
                        livingSpaceCount
                          ? `${livingSpaceCount} living space${livingSpaceCount === 1 ? '' : 's'}`
                          : null,
                        garageSpaceCount
                          ? `${garageSpaceCount} garage space${garageSpaceCount === 1 ? '' : 's'}`
                          : null,
                        'Per-space SF for finishes that differ by area (tile, carpet, etc.)',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'Per-room SF for finishes that differ by space (tile, carpet, etc.)'}
                </Text>
                {roomRows.map(room => (
                  <ReviewPanel key={room.id} darkMode={darkMode}>
                    <View style={styles.quantityHeader}>
                      <TouchableOpacity
                        onPress={() =>
                          setRoomRow(room.id, { include: !room.include })
                        }
                        style={styles.checkbox}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons
                          name={room.include ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={room.include ? '#22c55e' : Colors.sub}
                        />
                      </TouchableOpacity>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[styles.itemTitle, { color: Colors.text }]}
                          numberOfLines={1}
                        >
                          {room.name}
                        </Text>
                        <Text
                          style={{
                            color: planProvenanceColor(
                              room.provenance.status,
                              Colors
                            ),
                            fontSize: 12,
                            fontWeight: '700',
                            marginTop: 4,
                          }}
                        >
                          {room.provenance.label}
                        </Text>
                        {room.lengthFt != null && room.widthFt != null ? (
                          <Text
                            style={[styles.evidenceText, { color: Colors.sub }]}
                          >
                            {room.lengthFt}×{room.widthFt} ft
                          </Text>
                        ) : null}
                        {room.sourceLabel ? (
                          <Text
                            style={[styles.evidenceText, { color: Colors.sub }]}
                            numberOfLines={2}
                          >
                            {room.sourceLabel}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.valueShell,
                        {
                          borderColor: darkMode
                            ? PANEL_BORDER_DARK
                            : PANEL_BORDER_LIGHT,
                          backgroundColor: darkMode ? '#27272a' : '#f1f5f9',
                        },
                      ]}
                    >
                      <TextInput
                        value={room.areaSqft}
                        onChangeText={t =>
                          setRoomRow(room.id, {
                            areaSqft: t,
                            include: true,
                            provenance: resolvePlanMeasurementProvenance({
                              key: `room:${room.name}`,
                              userConfirmed: true,
                            }),
                          })
                        }
                        {...aiScopeConfirmNumericKeyboardProps}
                        keyboardType='decimal-pad'
                        placeholder='—'
                        placeholderTextColor={Colors.sub}
                        style={[styles.valueInput, { color: Colors.text }]}
                      />
                      <Text style={[styles.unitText, { color: Colors.sub }]}>
                        sqft
                      </Text>
                    </View>
                  </ReviewPanel>
                ))}
              </View>
            ) : null}

            {scopeDetections.length ? (
              <View style={styles.section}>
                <Text style={[styles.mutedEyebrow, { color: Colors.sub }]}>
                  Scope
                </Text>
                <Text style={[styles.sectionHeading, { color: Colors.text }]}>
                  Suggested scope
                </Text>
                {scopeDetections.map(d => {
                  const statusLines = scopeTakeoffStatusLines({
                    itemId: d.itemId,
                    evidence: d.evidence,
                    hasRoofQuantity,
                    assumptions: takeoff.assumptions,
                    hasPlanFloorAreas,
                    hasInsulationPrimaryTakeoff:
                      effectiveTradeKey === 'insulation' &&
                      rows.some(
                        row =>
                          row.key === 'exteriorWallInsulationSqft' &&
                          Number(row.value) > 0
                      ) &&
                      rows.some(
                        row =>
                          row.key === 'atticInsulationSqft' &&
                          Number(row.value) > 0
                      ),
                    insulationPrimaryConfirmed:
                      effectiveTradeKey === 'insulation' &&
                      rows.some(
                        row =>
                          row.key === 'exteriorWallInsulationSqft' &&
                          Number(row.value) > 0 &&
                          row.pricingEligible &&
                          row.include
                      ) &&
                      rows.some(
                        row =>
                          row.key === 'atticInsulationSqft' &&
                          Number(row.value) > 0 &&
                          row.pricingEligible &&
                          row.include
                      ),
                    hasDrywallPrimaryTakeoff:
                      effectiveTradeKey === 'drywall' &&
                      rows.some(
                        row =>
                          row.key === 'drywallSqft' && Number(row.value) > 0
                      ),
                    drywallPrimaryConfirmed:
                      effectiveTradeKey === 'drywall' &&
                      rows.some(
                        row =>
                          row.key === 'drywallSqft' &&
                          Number(row.value) > 0 &&
                          row.pricingEligible &&
                          row.include
                      ),
                  });
                  return (
                    <TouchableOpacity
                      key={d.itemId}
                      onPress={() =>
                        setScopeChecked(prev => ({
                          ...prev,
                          [d.itemId]: !prev[d.itemId],
                        }))
                      }
                      activeOpacity={0.7}
                    >
                      <ReviewPanel darkMode={darkMode}>
                        <View style={styles.quantityHeader}>
                          <Ionicons
                            name={
                              scopeChecked[d.itemId]
                                ? 'checkbox'
                                : 'square-outline'
                            }
                            size={22}
                            color={
                              scopeChecked[d.itemId] ? '#22c55e' : Colors.sub
                            }
                            style={styles.checkbox}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={[styles.itemTitle, { color: Colors.text }]}
                              numberOfLines={2}
                            >
                              {d.label || d.itemId}
                            </Text>
                            {statusLines.map(line => (
                              <Text
                                key={`${d.itemId}-${line}`}
                                style={[
                                  styles.evidenceText,
                                  { color: Colors.sub },
                                ]}
                                numberOfLines={2}
                              >
                                {line}
                              </Text>
                            ))}
                          </View>
                        </View>
                      </ReviewPanel>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

          {!keyboardVisible ? (
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: footerBottomPad,
                  borderTopColor: darkMode
                    ? 'rgba(255,255,255,0.08)'
                    : Colors.line,
                  backgroundColor: Colors.bg,
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.primaryBtn, { opacity: canApply ? 1 : 0.5 }]}
                onPress={handleApply}
                disabled={!canApply}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryBtnText}>
                  {tradeLabel
                    ? `Apply ${tradeLabel} Takeoff`
                    : applyPlanTakeoffButtonLabel({
                        includedMeasurementCount: includedCount,
                        checkedScopeCount,
                        semanticsEnabled: semanticsOn,
                      })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Text style={{ color: Colors.sub, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  section: { marginBottom: 24 },
  mutedEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  attentionEyebrow: {
    color: CONFIRM_YELLOW,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  attentionTitle: {
    color: CONFIRM_YELLOW,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 12,
  },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  measurementTitle: { fontSize: 15, lineHeight: 20 },
  quantityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700' },
  summaryValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  checkbox: { marginTop: 1 },
  conflictText: {
    fontSize: 11.5,
    marginTop: 4,
    fontWeight: '600',
    color: CONFIRM_YELLOW,
  },
  evidenceText: { fontSize: 11.5, marginTop: 3, lineHeight: 17 },
  valueShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    marginTop: 12,
  },
  valueInput: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
    padding: 0,
  },
  unitText: { fontSize: 11, fontWeight: '600' },
  emptyText: { fontSize: 13.5, lineHeight: 19 },
  roomHint: { fontSize: 12, lineHeight: 16, marginBottom: 12 },
  reconcileBlockTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  reconcileLine: { fontSize: 12, lineHeight: 17, marginBottom: 1 },
  reconcileStatus: { fontSize: 12.5, fontWeight: '700', marginTop: 3 },
  reconcileHint: { fontSize: 11.5, lineHeight: 16, marginTop: 10 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 6 },
});
