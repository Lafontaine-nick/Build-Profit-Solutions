/**
 * Step 1 "Import from plan" strip — camera / library / PDF → review modal.
 * Measurements + scope detections are returned to the parent for Generate handoff.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import PlanTakeoffReviewModal from '@/components/estimate/PlanTakeoffReviewModal';
import type {
  PhotoScopeDetection,
  PlanToMeasurementsResult,
} from '@/utils/estimateAiDraft';
import {
  imagesFromPickerAssets,
  pickPlanFromLibrary,
  pickPlanPdf,
  promptPlanImportSource,
  runPlanTakeoff,
  takePlanPhoto,
} from '@/utils/planImportRunner';
import { measurementSemanticsV1Enabled } from '@/utils/measurementSemantics';
import {
  PLAN_EXPORT_TRADE_CONFIGURATIONS,
  PLAN_TRADE_CONFIGURATIONS,
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
  normalizePlanImportSelection,
  type PlanEstimatingMode,
  type PlanTradeKey,
} from '@/utils/planImportTradeConfig';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import type {
  PlumbingPerformerMode,
  PlumbingWorkflowMode,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import { ELECTRICAL_CARDS } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { hydratePaintingPlanMeasurements } from '@/utils/hydratePaintingPlanMeasurements';
import { electricalQuickMeasurementSourceFromProvenance } from '@/utils/electricalQuickMeasurementUi';

function keepPaintingPlanGeometry(
  mode: PlanEstimatingMode,
  tradeKey?: PlanTradeKey | null
): boolean {
  return mode === 'selected_trade' && tradeKey === 'painting';
}

type ElectricalRepeatSnapshot = {
  fingerprint: string;
  measurements: Record<string, number | string | null | undefined>;
};

function planImportFingerprint(
  pages: Array<{ base64: string; mimeType: string; name?: string }>,
  mode: PlanEstimatingMode,
  trade: PlanTradeKey | null
): string {
  let hash = 2166136261;
  const source = `${mode}:${trade || ''}|${pages
    .map(
      page =>
        `${page.name || ''}:${page.mimeType}:${page.base64.length}:${page.base64}`
    )
    .join('|')}`;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${hash >>> 0}:${source.length}:${pages.length}`;
}

function applyRepeatedElectricalImportStability(
  takeoff: PlanToMeasurementsResult,
  previous: ElectricalRepeatSnapshot | null,
  fingerprint: string
): PlanToMeasurementsResult {
  const currentMeasurements = takeoff.measurements || {};
  const electricalKeys = new Set([
    ...ELECTRICAL_CARDS.map(card => card.measurementKey),
    'serviceAmperage',
  ]);
  const current = Object.fromEntries(
    [...electricalKeys].map(key => [key, currentMeasurements[key] ?? null])
  );
  if (!previous || previous.fingerprint !== fingerprint) return takeoff;
  const stabilizedMeasurements = { ...currentMeasurements };
  const measurementConflicts = [...(takeoff.measurementConflicts || [])];
  const samePlanReviewFields = new Set<string>();

  const changed = new Set<string>();
  for (const key of electricalKeys) {
    if (Number(previous.measurements[key] ?? 0) !== Number(current[key] ?? 0)) {
      changed.add(key);
    }
  }
  const provenance = { ...(takeoff.measurementProvenance || {}) };
  const validation = takeoff.electricalValidation;
  const fields = { ...(validation?.fields || {}) };
  const priceableFields = new Set(validation?.priceableFields || []);
  const blockedFields = new Set(validation?.blockedFields || []);

  for (const key of electricalKeys) {
    const existing =
      provenance[key] && typeof provenance[key] === 'object'
        ? provenance[key]
        : {};
    const previousValue = Number(previous.measurements[key] ?? 0);
    const currentValue = Number(current[key] ?? 0);
    if (changed.has(key)) {
      const reason =
        'The same imported plan produced a different quantity on repeat import; confirm this field before pricing.';
      if (previousValue > 0 && currentValue <= 0) {
        // Do not let a silent repeat read erase a quantity already found on
        // this exact plan. Keep it visible, but with pricing blocked until
        // the contractor confirms the repeat result.
        stabilizedMeasurements[key] = previous.measurements[key];
        samePlanReviewFields.add(key);
      } else if (previousValue > 0 && currentValue > 0) {
        // The exact same document produced two positive counts. Keep the
        // previously visible quantity in the contractor's flow instead of
        // making the chip randomly disappear; the validation gate below
        // prevents pricing until it is confirmed.
        stabilizedMeasurements[key] = previous.measurements[key];
        samePlanReviewFields.add(key);
      }
      provenance[key] = {
        ...existing,
        ...(previousValue > 0
          ? {
              value: previousValue,
              source: String(
                (existing as { source?: string }).source ||
                  'previous_same_plan_import'
              ),
            }
          : {}),
        status: 'needs_review',
        normalizedSource: 'NEEDS_REVIEW',
        pricingEligible: false,
        deterministicRepeatedImportStable: false,
        reason,
      };
      fields[key] = {
        ...(fields[key] || {}),
        status: 'needs_review',
        pricingEligible: false,
        deterministicRepeatedImportStable: false,
        reason,
      };
      priceableFields.delete(key);
      blockedFields.add(key);
    } else if (provenance[key]) {
      provenance[key] = {
        ...existing,
        deterministicRepeatedImportStable: true,
      };
      if (fields[key]) {
        fields[key] = {
          ...fields[key],
          deterministicRepeatedImportStable: true,
        };
      }
    }
  }

  const retainedConflicts = measurementConflicts.filter(
    conflict => !samePlanReviewFields.has(String(conflict?.field || ''))
  );
  const nextElectricalValidation = validation
    ? {
        ...validation,
        fields,
        priceableFields: [...priceableFields],
        blockedFields: [...blockedFields],
      }
    : samePlanReviewFields.size
      ? {
          fields: Object.fromEntries(
            [...samePlanReviewFields].map(key => [
              key,
              {
                status: 'needs_review',
                pricingEligible: false,
                deterministicRepeatedImportStable: false,
                reason:
                  'The same imported plan produced a different quantity on repeat import; confirm this field before pricing.',
              },
            ])
          ),
          priceableFields: [],
          blockedFields: [...samePlanReviewFields],
        }
      : validation;

  return {
    ...takeoff,
    measurements: stabilizedMeasurements,
    measurementConflicts: retainedConflicts,
    measurementProvenance: provenance,
    electricalValidation: nextElectricalValidation,
  };
}

type Colors = {
  text: string;
  sub: string;
  line: string;
};

export type PlanImportApplyResult = {
  measurements: Record<string, string>;
  planImportFingerprint?: string | null;
  scopeDetections: PhotoScopeDetection[];
  mergedNotes: string;
  notesBlock: string;
  rooms?: Array<{
    name: string;
    areaSqft: number | null;
    lengthFt?: number | null;
    widthFt?: number | null;
  }>;
  areaReconciliation?:
    import('@/utils/measurementSemantics').AreaReconciliation | null;
  buildingAreas?: import('@/utils/planMeasurementFacts').PlanBuildingAreas;
  planFacts?: import('@/utils/planMeasurementFacts').PlanFacts;
  fieldConfidence?: Record<string, number>;
  quickMeasurementSources?: Record<string, string>;
  measurementProvenance?: Record<string, unknown>;
  measurementConflicts?: import('@/utils/estimateAiDraft').PlanMeasurementConflict[];
  electricalValidation?: PlanToMeasurementsResult['electricalValidation'];
  estimatingMode: PlanEstimatingMode;
  selectedTrade: PlanTradeKey | null;
  tradeProvenance: {
    source: 'plan_import';
    mode: PlanEstimatingMode;
    selectedTrade: PlanTradeKey | null;
    routerStatus: 'reference' | 'stub' | null;
  };
  missingInfo: string[];
};

type PlanReviewState = PlanToMeasurementsResult & {
  planImportFingerprint: string;
};

type Props = {
  Colors: Colors;
  darkMode: boolean;
  disabled?: boolean;
  existingNotes: string;
  /** When set, shows unified "Plan ready" card instead of import CTA. */
  planReadySubtitle?: string | null;
  /** Optional template/project hints once known; Step 1 usually has none yet. */
  templateKeyHint?: string | null;
  projectTypeHint?: string | null;
  /** Lock Plan Import to the standalone trade selected in Build With AI. */
  forcedTradeKey?: PlanTradeKey | null;
  disablePlanImport?: boolean;
  plumbingWorkflowMode?: PlumbingWorkflowMode;
  plumbingPerformerMode?: PlumbingPerformerMode | null;
  onPlumbingWorkflowModeChange?: (mode: PlumbingWorkflowMode) => void;
  onPlumbingPerformerModeChange?: (mode: PlumbingPerformerMode | null) => void;
  onApplied: (result: PlanImportApplyResult) => void;
};

export default function EstimatePlanImportStrip({
  Colors,
  darkMode,
  disabled = false,
  existingNotes,
  planReadySubtitle = null,
  templateKeyHint = null,
  projectTypeHint = null,
  forcedTradeKey = null,
  disablePlanImport = false,
  plumbingWorkflowMode = 'bathroom_remodel',
  plumbingPerformerMode = null,
  onPlumbingWorkflowModeChange,
  onPlumbingPerformerModeChange,
  onApplied,
}: Props) {
  const [importing, setImporting] = useState(false);
  const previousElectricalImportRef = useRef<ElectricalRepeatSnapshot | null>(
    null
  );
  const [planReview, setPlanReview] = useState<PlanReviewState | null>(null);
  const [showImportChooser, setShowImportChooser] = useState(false);
  const [estimatingMode, setEstimatingMode] = useState<PlanEstimatingMode>(
    forcedTradeKey ? 'selected_trade' : 'whole_project'
  );
  const [selectedTrade, setSelectedTrade] = useState<PlanTradeKey | null>(
    forcedTradeKey
  );
  const planReady = Boolean(planReadySubtitle?.trim());
  const routingLocked = Boolean(forcedTradeKey);
  const showPlanRouting =
    routingLocked || showImportChooser || planReady || planReview != null;
  const semanticsOn = measurementSemanticsV1Enabled();
  const plumbingPlanDisabled = disablePlanImport;

  useEffect(() => {
    if (forcedTradeKey) {
      setEstimatingMode('selected_trade');
      setSelectedTrade(forcedTradeKey);
    }
  }, [forcedTradeKey]);

  const updateRouting = (
    nextMode: PlanEstimatingMode,
    nextTrade: PlanTradeKey | null
  ) => {
    setEstimatingMode(nextMode);
    setSelectedTrade(nextTrade);
  };

  const executeTakeoff = useCallback(
    async (
      pages: Array<{ base64: string; mimeType: string; name?: string }>
    ) => {
      if (!pages.length || disabled) return;
      setImporting(true);
      try {
        const takeoff = await runPlanTakeoff(pages, {
          existingNotes,
          templateKeyHint,
          projectTypeHint,
          estimatingMode,
          selectedTradeKey: selectedTrade,
        });
        if (!takeoff) return;
        const hydrated = hydratePaintingPlanMeasurements({
          ...takeoff,
          estimatingMode,
          selectedTrade,
        });
        const fingerprint = planImportFingerprint(
          pages,
          estimatingMode,
          selectedTrade
        );
        const stabilized = applyRepeatedElectricalImportStability(
          hydrated,
          previousElectricalImportRef.current,
          fingerprint
        );
        previousElectricalImportRef.current = {
          fingerprint,
          measurements: { ...(stabilized.measurements || {}) },
        };
        const selection = normalizePlanImportSelection(
          estimatingMode,
          selectedTrade
        );
        const stamped: PlanToMeasurementsResult = {
          ...stabilized,
          estimatingMode: selection.mode,
          selectedTrade: selection.trade?.key || null,
        };
        if (selection.mode === 'selected_trade' && selection.trade) {
          stamped.measurements = filterPlanMeasurementsForTrade(
            stabilized.measurements || {},
            selection.mode,
            selection.trade.key
          );
          if (!keepPaintingPlanGeometry(selection.mode, selection.trade.key)) {
            stamped.rooms = [];
          }
          stamped.areaReconciliation = null;
          if (stabilized.scope?.detections) {
            stamped.scope = {
              ...stabilized.scope,
              detections: filterPlanScopesForTrade(
                stabilized.scope.detections,
                selection.mode,
                selection.trade.key
              ),
            };
          }
        }
        setPlanReview({
          ...stamped,
          planImportFingerprint: fingerprint,
          measurementProvenance: stabilized.measurementProvenance,
          electricalValidation: stabilized.electricalValidation,
        });
        setShowImportChooser(false);
        if (Platform.OS === 'ios') {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        }
      } catch (e) {
        Alert.alert(
          'Plan import failed',
          e instanceof Error ? e.message : 'Try again with a clearer image.'
        );
      } finally {
        setImporting(false);
      }
    },
    [
      disabled,
      existingNotes,
      templateKeyHint,
      projectTypeHint,
      estimatingMode,
      selectedTrade,
    ]
  );

  const onCamera = useCallback(async () => {
    if (importing || disabled || plumbingPlanDisabled) return;
    try {
      const assets = await takePlanPhoto();
      if (!assets?.length) return;
      const images = await imagesFromPickerAssets(assets);
      await executeTakeoff(images);
    } catch (e) {
      Alert.alert(
        'Camera failed',
        e instanceof Error ? e.message : 'Could not take a photo.'
      );
    }
  }, [importing, disabled, plumbingPlanDisabled, executeTakeoff]);

  const onLibrary = useCallback(async () => {
    if (importing || disabled || plumbingPlanDisabled) return;
    try {
      const assets = await pickPlanFromLibrary();
      if (!assets?.length) return;
      const images = await imagesFromPickerAssets(assets);
      await executeTakeoff(images);
    } catch (e) {
      Alert.alert(
        'Library failed',
        e instanceof Error ? e.message : 'Could not open photos.'
      );
    }
  }, [importing, disabled, plumbingPlanDisabled, executeTakeoff]);

  const onPdf = useCallback(async () => {
    if (importing || disabled || plumbingPlanDisabled) return;
    try {
      const pages = await pickPlanPdf();
      if (!pages?.length) return;
      await executeTakeoff(pages);
    } catch (e) {
      Alert.alert(
        'PDF import failed',
        e instanceof Error ? e.message : 'Could not read the PDF.'
      );
    }
  }, [importing, disabled, plumbingPlanDisabled, executeTakeoff]);

  const openPicker = useCallback(() => {
    if (importing || disabled) return;
    if (!showImportChooser && !routingLocked) {
      setShowImportChooser(true);
      return;
    }
    if (plumbingPlanDisabled) return;
    if (estimatingMode === 'selected_trade' && !selectedTrade) {
      Alert.alert(
        'Select a trade',
        'Choose the trade you are bidding before importing the plan.'
      );
      return;
    }
    promptPlanImportSource({
      onCamera: () => void onCamera(),
      onLibrary: () => void onLibrary(),
      onPdf: () => void onPdf(),
    });
  }, [
    importing,
    disabled,
    plumbingPlanDisabled,
    showImportChooser,
    routingLocked,
    estimatingMode,
    selectedTrade,
    onCamera,
    onLibrary,
    onPdf,
  ]);

  const handleApply = useCallback(
    (
      values: Record<string, string>,
      scopeDetections: PhotoScopeDetection[],
      rooms: Array<{
        name: string;
        areaSqft: number | null;
        lengthFt: number | null;
        widthFt: number | null;
      }>,
      metadata?: {
        measurementProvenance?: PlanToMeasurementsResult['measurementProvenance'];
        measurementConflicts?: PlanToMeasurementsResult['measurementConflicts'];
        electricalValidation?: PlanToMeasurementsResult['electricalValidation'];
        utilityConnections?: PlanToMeasurementsResult['utilityConnections'];
        fixtureInventory?: PlanToMeasurementsResult['fixtureInventory'];
      }
    ) => {
      const takeoff = planReview;
      setPlanReview(null);
      if (!takeoff) return;

      const selection = normalizePlanImportSelection(
        estimatingMode,
        selectedTrade
      );
      let tradeMeasurements =
        selection.mode === 'selected_trade' && selection.trade
          ? Object.fromEntries(
              Object.entries(
                filterPlanMeasurementsForTrade(
                  Object.fromEntries(
                    Object.entries({
                      ...values,
                      ...(selection.trade.key === 'roofing'
                        ? {
                            roofPitch: takeoff.planFacts?.roofPitch,
                            storyCount: takeoff.planFacts?.storyCount,
                          }
                        : {}),
                    })
                      .map(([key, value]) => [
                        key,
                        key === 'roofPitch'
                          ? String(value || '')
                          : Number(value),
                      ])
                      .filter(([key, value]) => {
                        if (
                          selection.trade?.key === 'roofing' &&
                          key === 'roofPitch'
                        ) {
                          return (
                            typeof value === 'string' && value.trim().length > 0
                          );
                        }
                        const n = Number(value);
                        return Number.isFinite(n) && n > 0;
                      })
                  ),
                  selection.mode,
                  selection.trade.key
                )
              ).map(([key, value]) => [
                key,
                key === 'roofPitch' ? String(value) : String(Number(value)),
              ])
            )
          : values;
      const normalizedTrade =
        selection.trade?.key === 'roofing' ||
        selection.trade?.key === 'concrete' ||
        selection.trade?.key === 'flooring' ||
        selection.trade?.key === 'painting' ||
        selection.trade?.key === 'electrical' ||
        selection.trade?.key === 'plumbing'
          ? normalizeTradeMeasurements(
              selection.trade.key,
              {
                ...tradeMeasurements,
                ...(selection.trade.key === 'roofing'
                  ? {
                      roofPitch:
                        takeoff.planFacts?.roofPitch ||
                        tradeMeasurements.roofPitch,
                      storyCount:
                        takeoff.planFacts?.storyCount ||
                        tradeMeasurements.storyCount,
                    }
                  : {}),
              },
              'plan'
            )
          : null;
      if (normalizedTrade) {
        tradeMeasurements = Object.fromEntries(
          Object.entries(normalizedTrade.measurements).map(([key, value]) => [
            key,
            String(value),
          ])
        );
      }
      const keepPaintingGeometry = keepPaintingPlanGeometry(
        selection.mode,
        selection.trade?.key
      );
      const tradeRooms =
        selection.mode === 'selected_trade' && !keepPaintingGeometry
          ? []
          : rooms;
      const tradeScopeDetections =
        selection.mode === 'selected_trade' && selection.trade
          ? filterPlanScopesForTrade(
              scopeDetections,
              selection.mode,
              selection.trade.key
            )
          : scopeDetections;
      const allowedConflictKeys = new Set(
        selection.trade?.reviewMeasurementKeys || []
      );
      const unresolvedConflicts = (
        metadata?.measurementConflicts ??
        takeoff.measurementConflicts ??
        []
      ).filter(conflict => {
        const field = String(conflict?.field || '');
        if (!field || !conflict?.requiresConfirmation) return false;
        if (allowedConflictKeys.size && !allowedConflictKeys.has(field)) {
          return false;
        }
        return true;
      });
      const appliedProvenance = {
        ...(normalizedTrade?.measurementProvenance || {}),
        ...(takeoff.measurementProvenance
          ? Object.fromEntries(
              Object.entries(takeoff.measurementProvenance).filter(([key]) =>
                Object.prototype.hasOwnProperty.call(tradeMeasurements, key)
              )
            )
          : {}),
        ...(metadata?.measurementProvenance || {}),
      };
      const electricalQuickMeasurementSources =
        selection.trade?.key === 'electrical'
          ? Object.fromEntries(
              Object.entries(appliedProvenance)
                .filter(([key]) =>
                  Object.prototype.hasOwnProperty.call(tradeMeasurements, key)
                )
                .map(([key, entry]) => [
                  key,
                  electricalQuickMeasurementSourceFromProvenance(entry),
                ])
            )
          : {};

      onApplied({
        measurements: tradeMeasurements,
        planImportFingerprint: takeoff.planImportFingerprint,
        scopeDetections: tradeScopeDetections,
        mergedNotes: takeoff.mergedNotes || existingNotes,
        notesBlock: takeoff.notesBlock || '',
        rooms: tradeRooms,
        areaReconciliation:
          selection.mode === 'selected_trade'
            ? null
            : (takeoff.areaReconciliation ?? null),
        buildingAreas:
          selection.mode === 'selected_trade' && !keepPaintingGeometry
            ? undefined
            : takeoff.buildingAreas,
        planFacts:
          selection.mode === 'selected_trade' && !keepPaintingGeometry
            ? undefined
            : takeoff.planFacts,
        fieldConfidence: takeoff.fieldConfidence,
        quickMeasurementSources: {
          ...(normalizedTrade?.quickMeasurementSources || {}),
          ...electricalQuickMeasurementSources,
        },
        measurementProvenance: appliedProvenance,
        measurementConflicts: unresolvedConflicts,
        electricalValidation:
          metadata?.electricalValidation ??
          takeoff.electricalValidation ??
          null,
        utilityConnections:
          metadata?.utilityConnections ?? takeoff.utilityConnections,
        fixtureInventory:
          metadata?.fixtureInventory ?? takeoff.fixtureInventory,
        estimatingMode: selection.mode,
        selectedTrade: selection.trade?.key || null,
        tradeProvenance: {
          source: 'plan_import',
          mode: selection.mode,
          selectedTrade: selection.trade?.key || null,
          routerStatus:
            selection.trade?.key === 'electrical'
              ? 'reference'
              : selection.trade?.key
                ? 'stub'
                : null,
        },
        missingInfo: selection.trade?.missingInfo || [],
      });

      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }
    },
    [planReview, onApplied, existingNotes, estimatingMode, selectedTrade]
  );

  const cardShell = {
    borderRadius: 14,
    borderWidth: planReady ? 1.5 : 1,
    borderColor: planReady
      ? 'rgba(56,211,159,0.5)'
      : darkMode
        ? 'rgba(148,163,184,0.25)'
        : Colors.line,
    backgroundColor: planReady
      ? darkMode
        ? 'rgba(56,211,159,0.12)'
        : 'rgba(34,197,94,0.08)'
      : darkMode
        ? 'rgba(34,197,94,0.08)'
        : 'rgba(34,197,94,0.06)',
    opacity:
      importing || disabled || (plumbingPlanDisabled && showPlanRouting)
        ? 0.55
        : 1,
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: Colors.text,
          fontSize: 14,
          fontWeight: '700',
          marginBottom: 4,
        }}
      >
        Plans
      </Text>
      <Text
        style={{
          color: Colors.sub,
          fontSize: 12,
          lineHeight: 16,
          marginBottom: 10,
        }}
      >
        Import a floor-plan PDF or photos — AI fills measurements and drafts
        scope for you to review.
      </Text>
      {showPlanRouting ? (
        <>
          <Text
            style={{
              color: Colors.text,
              fontSize: 13,
              fontWeight: '700',
              marginBottom: 6,
            }}
          >
            What are you estimating?
          </Text>
          <View style={{ gap: 8, marginBottom: 10 }}>
            {!routingLocked ? (
              <TouchableOpacity
                onPress={() => {
                  updateRouting('whole_project', null);
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor:
                    estimatingMode === 'whole_project'
                      ? '#22c55e'
                      : Colors.line,
                  backgroundColor:
                    estimatingMode === 'whole_project'
                      ? 'rgba(34,197,94,0.12)'
                      : 'transparent',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    color: Colors.text,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  Whole Project / General Contractor
                </Text>
                <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                  Estimate multiple trades from the full plan set.
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                updateRouting('selected_trade', forcedTradeKey);
              }}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor:
                  estimatingMode === 'selected_trade' ? '#22c55e' : Colors.line,
                backgroundColor:
                  estimatingMode === 'selected_trade'
                    ? 'rgba(34,197,94,0.12)'
                    : 'transparent',
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}
              >
                {routingLocked
                  ? 'Single Trade / Plumbing Only'
                  : 'Single Trade / Subcontractor'}
              </Text>
              <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                {routingLocked
                  ? 'Import plan quantities for the Plumbing-only estimate.'
                  : 'Build an estimate for one trade only.'}
              </Text>
            </TouchableOpacity>
          </View>
          {estimatingMode === 'selected_trade' ? (
            <>
              <Text
                style={{
                  color: Colors.text,
                  fontSize: 13,
                  fontWeight: '700',
                  marginBottom: 6,
                }}
              >
                Select your trade
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {(routingLocked
                  ? PLAN_EXPORT_TRADE_CONFIGURATIONS.filter(
                      trade => trade.key === forcedTradeKey
                    )
                  : PLAN_EXPORT_TRADE_CONFIGURATIONS
                ).map(trade => (
                  <TouchableOpacity
                    key={trade.key}
                    onPress={() => updateRouting('selected_trade', trade.key)}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor:
                        selectedTrade === trade.key ? '#22c55e' : Colors.line,
                      backgroundColor:
                        selectedTrade === trade.key
                          ? 'rgba(34,197,94,0.12)'
                          : 'transparent',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.text,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {trade.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
          {estimatingMode === 'selected_trade' && !selectedTrade ? (
            <Text style={{ color: '#fbbf24', fontSize: 11, marginBottom: 10 }}>
              Select a trade before importing the plan.
            </Text>
          ) : null}
          {selectedTrade ? (
            <Text
              style={{
                color: Colors.sub,
                fontSize: 11,
                lineHeight: 15,
                marginBottom: 10,
              }}
            >
              {selectedTrade === 'electrical'
                ? 'Electrical plan selected — symbol and schedule counts map onto the existing Electrical cards. Confirm the takeoff before it fills the bid.'
                : `${PLAN_EXPORT_TRADE_CONFIGURATIONS.find(trade => trade.key === selectedTrade)?.label || PLAN_TRADE_CONFIGURATIONS.find(trade => trade.key === selectedTrade)?.label || 'Trade'} plan selected — we will focus on relevant sheets and quantities.`}
            </Text>
          ) : null}
          {false && selectedTrade === 'plumbing' ? (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: Colors.line,
                paddingTop: 10,
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: Colors.text,
                  fontSize: 12,
                  fontWeight: '700',
                  marginBottom: 6,
                }}
              >
                Plumbing scope
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(
                  [
                    ['bathroom_remodel', 'Bathroom Remodel'],
                    ['new_construction', 'New Construction'],
                    ['service', 'Service'],
                  ] as Array<[PlumbingWorkflowMode, string]>
                ).map(([mode, label]) => (
                  <TouchableOpacity
                    key={mode}
                    disabled={disabled}
                    onPress={() => onPlumbingWorkflowModeChange?.(mode)}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor:
                        plumbingWorkflowMode === mode ? '#22c55e' : Colors.line,
                      backgroundColor:
                        plumbingWorkflowMode === mode
                          ? 'rgba(34,197,94,0.12)'
                          : 'transparent',
                      paddingHorizontal: 9,
                      paddingVertical: 6,
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
              <Text
                style={{
                  color: Colors.text,
                  fontSize: 12,
                  fontWeight: '700',
                  marginTop: 10,
                  marginBottom: 6,
                }}
              >
                Performer
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(
                  [
                    ['self_performed', 'I do the work'],
                    ['subcontracted', 'I hire a plumber'],
                    ['existing_quote', 'Existing quote'],
                  ] as Array<[PlumbingPerformerMode, string]>
                ).map(([mode, label]) => (
                  <TouchableOpacity
                    key={mode}
                    disabled={disabled}
                    onPress={() => onPlumbingPerformerModeChange?.(mode)}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor:
                        plumbingPerformerMode === mode
                          ? '#22c55e'
                          : Colors.line,
                      backgroundColor:
                        plumbingPerformerMode === mode
                          ? 'rgba(34,197,94,0.12)'
                          : 'transparent',
                      paddingHorizontal: 9,
                      paddingVertical: 6,
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
        </>
      ) : null}
      <TouchableOpacity
        onPress={openPicker}
        disabled={
          importing || disabled || (plumbingPlanDisabled && showPlanRouting)
        }
        activeOpacity={0.75}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            padding: planReady ? 14 : 10,
            paddingHorizontal: planReady ? 14 : 12,
          },
          cardShell,
        ]}
      >
        {importing ? (
          <ActivityIndicator
            size='small'
            color='#22c55e'
            style={{ marginTop: 2 }}
          />
        ) : (
          <Ionicons
            name={planReady ? 'checkmark-circle' : 'map-outline'}
            size={planReady ? 24 : 18}
            color={planReady ? '#38d39f' : '#22c55e'}
            style={{ marginTop: planReady ? 0 : 1 }}
          />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: Colors.text,
              fontSize: planReady ? 15 : 13,
              fontWeight: planReady ? '800' : '700',
            }}
          >
            {importing
              ? 'Reading plan…'
              : planReady
                ? 'Plan ready to generate'
                : 'Import from plan'}
          </Text>
          {planReady && planReadySubtitle ? (
            <Text
              style={{
                color: '#38d39f',
                fontSize: 13,
                fontWeight: '700',
                marginTop: 4,
              }}
            >
              {planReadySubtitle}
            </Text>
          ) : null}
          <Text
            style={{
              color: planReady ? Colors.sub : Colors.sub,
              fontSize: planReady ? 12 : 11,
              lineHeight: planReady ? 17 : 16,
              marginTop: planReady ? 6 : 2,
              fontWeight: '400',
            }}
          >
            {plumbingPlanDisabled
              ? 'Notes and photos are used for this Plumbing mode.'
              : planReady
                ? semanticsOn
                  ? 'Tap Generate Estimate Draft below — job notes are optional. Tap here to import a different plan.'
                  : 'Review Job notes, then Generate. Tap here to import a different plan.'
                : 'Photo, library pages, or PDF — you review before Generate'}
          </Text>
        </View>
      </TouchableOpacity>

      <PlanTakeoffReviewModal
        visible={planReview != null}
        takeoff={planReview}
        estimatingMode={estimatingMode}
        selectedTrade={selectedTrade}
        currentValues={{}}
        onApply={handleApply}
        onCancel={() => setPlanReview(null)}
      />
    </View>
  );
}
