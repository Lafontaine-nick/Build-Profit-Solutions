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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import PlanTakeoffReviewModal from '@/components/estimate/PlanTakeoffReviewModal';
import type {
  PhotoScopeDetection,
  PlanImportPayload,
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
import { aiFlowCardBackground } from '@/utils/estimateFlowCardStyle';
import type { AiGeneratePhaseId } from '@/utils/aiEstimateGeneratingUi';
import {
  applyHvacProvenanceGuardToScopeMeasurements,
  hasDocumentedHvacVentilationCount,
  HVAC_PLAN_REVIEW_CANONICAL_KEYS,
  HVAC_VENTILATION_MEASUREMENT_KEY,
  hvacQuickMeasurementSourcesFromProvenance,
  resolveHvacPlanReviewMeasurements,
  syncHvacSkippedTakeoffQuickMeasurementSources,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';
import {
  GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS,
  garageDoorsMeasurementKeysForScopeItem,
} from '@/utils/subcontractorTrade/garageDoorsPlanConvergence';
import {
  WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS,
  windowsDoorsMeasurementKeyForScopeItem,
} from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';
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
import {
  reconcileFramingScopeMeasurements,
  tagFramingQuickMeasurementSourcesFromProvenance,
} from '@/utils/planTakeoffReviewUi';
import { applyRepeatedPlumbingImportConflicts, lowConfidenceNeedsReviewProvenance } from '@/utils/planMeasurementConflictUi';
import { tagPlanDetectedQuickMeasurementKeys } from '@/utils/quickMeasurementProvenance';
import { tagPlanReviewLockedQuickMeasurementSources } from '@/utils/planReviewMeasurementLock';
import {
  canonicalizeInsulationRepeatImportMeasurements,
  hasCompleteInsulationRepeatImportSnapshot,
  hydrateInsulationPlanMeasurementsFromTakeoff,
  INSULATION_SCOPE_NUMERIC_KEYS,
  mergeInsulationPlanFactsFromTakeoff,
} from '@/utils/subcontractorTrade/insulationPlanConvergence';

function keepPaintingPlanGeometry(
  mode: PlanEstimatingMode,
  tradeKey?: PlanTradeKey | null
): boolean {
  return mode === 'selected_trade' && tradeKey === 'painting';
}

function keepSelectedTradePlanContext(
  mode: PlanEstimatingMode,
  tradeKey?: PlanTradeKey | null
): boolean {
  return (
    keepPaintingPlanGeometry(mode, tradeKey) ||
    (mode === 'selected_trade' &&
      (tradeKey === 'insulation' || tradeKey === 'drywall'))
  );
}

type PlanRepeatSnapshot = {
  fingerprint: string;
  measurements: Record<string, number | string | null | undefined>;
};

// Keep repeat-read stability across the picker/modal being remounted before
// the contractor has pressed Apply. lastGoodInsulationSnapshot only stores a
// complete wall+opening+attic result so a later empty vision pass cannot wipe it.
let lastPlanImportSnapshot: PlanRepeatSnapshot | null = null;
let lastGoodInsulationSnapshot: PlanRepeatSnapshot | null = null;

function positiveRepeatImportValue(value: unknown): number | null {
  const parsed = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * A repeat AI pass must not erase an HVAC read from the same document. Keep the
 * prior value visible, but mark it for confirmation because the new pass did
 * not reproduce it.
 */
function applyRepeatedHvacImportStability(
  takeoff: PlanToMeasurementsResult,
  previous: PlanRepeatSnapshot | null,
  fingerprint: string
): PlanToMeasurementsResult {
  if (!previous || previous.fingerprint !== fingerprint) return takeoff;

  const currentMeasurements = { ...(takeoff.measurements || {}) };
  const previousMeasurements = previous.measurements || {};
  const provenance = { ...(takeoff.measurementProvenance || {}) };
  const currentResolved = resolveHvacPlanReviewMeasurements(takeoff);
  let changed = false;

  for (const key of HVAC_PLAN_REVIEW_CANONICAL_KEYS) {
    if (
      key === HVAC_VENTILATION_MEASUREMENT_KEY &&
      !hasDocumentedHvacVentilationCount({
        hvacVentilationCount: positiveRepeatImportValue(
          previousMeasurements[key]
        ),
        measurementProvenance: provenance,
      })
    ) {
      continue;
    }
    const previousValue = positiveRepeatImportValue(previousMeasurements[key]);
    if (previousValue == null) continue;
    const currentValue =
      positiveRepeatImportValue(currentMeasurements[key]) ??
      positiveRepeatImportValue(currentResolved[key]);
    if (currentValue != null) continue;

    currentMeasurements[key] = previousMeasurements[key];
    const existing = provenance[key];
    provenance[key] = {
      ...(existing && typeof existing === 'object' ? existing : {}),
      value: previousValue,
      source:
        existing &&
        typeof existing === 'object' &&
        typeof (existing as { source?: unknown }).source === 'string'
          ? (existing as { source: string }).source
          : 'previous_same_plan_import',
      normalizedSource: 'NEEDS_REVIEW',
      status: 'needs_review',
      pricingEligible: false,
      deterministicRepeatedImportStable: false,
      reason:
        'The same imported plan did not reproduce this HVAC quantity; confirm it before pricing.',
    };
    changed = true;
  }

  return changed
    ? {
        ...takeoff,
        measurements: currentMeasurements,
        measurementProvenance: provenance,
      }
    : takeoff;
}

function planImportFingerprint(
  pages: Array<{ base64: string; mimeType: string; name?: string }>,
  mode: PlanEstimatingMode,
  trade: PlanTradeKey | null
): string {
  let hash = 2166136261;
  // File names can change when the same PDF is selected again. Use normalized
  // page content so AI repeat stability is tied to the document, not picker
  // metadata.
  const source = `${mode}:${trade || ''}|${pages
    .map(page => {
      const content = String(page.base64 || '')
        .replace(/^data:[^,]+,/, '')
        .replace(/\s+/g, '');
      return `${page.mimeType}:${content.length}:${content}`;
    })
    .sort()
    .join('|')}`;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${hash >>> 0}:${source.length}:${pages.length}`;
}

function applyRepeatedElectricalImportStability(
  takeoff: PlanToMeasurementsResult,
  previous: PlanRepeatSnapshot | null,
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

const INSULATION_REPEAT_KEYS = [
  'exteriorWallInsulationSqft',
  'atticInsulationSqft',
  'insulatedRoofDeckSqft',
  'openingDeductionSqft',
];

function applyRepeatedInsulationImportStability(
  takeoff: PlanToMeasurementsResult,
  previous: PlanRepeatSnapshot | null,
  fingerprint: string
): PlanToMeasurementsResult {
  if (
    !previous ||
    previous.fingerprint !== fingerprint ||
    takeoff.selectedTrade !== 'insulation'
  ) {
    return takeoff;
  }

  const repeatContext = {
    planFacts: takeoff.planFacts,
    buildingAreas: takeoff.buildingAreas,
  };
  const canonicalCurrent = canonicalizeInsulationRepeatImportMeasurements(
    takeoff.measurements || {},
    repeatContext
  );
  const canonicalPrevious = canonicalizeInsulationRepeatImportMeasurements(
    previous.measurements,
    repeatContext
  );
  const stabilizedMeasurements = {
    ...(takeoff.measurements || {}),
    ...canonicalCurrent,
  };
  const provenance = { ...(takeoff.measurementProvenance || {}) };
  const changedFields: string[] = [];

  for (const key of INSULATION_REPEAT_KEYS) {
    const previousValue = Number(canonicalPrevious[key] ?? 0);
    const currentValue = Number(canonicalCurrent[key] ?? 0);

    if (currentValue > 0) {
      stabilizedMeasurements[key] = canonicalCurrent[key] as number | string;
      if (
        previousValue > 0 &&
        Math.abs(previousValue - currentValue) >
          Math.max(1, Math.abs(previousValue) * 0.02)
      ) {
        changedFields.push(key);
      }
      continue;
    }

    if (previousValue <= 0) continue;

    stabilizedMeasurements[key] = canonicalPrevious[key] as number | string;
    changedFields.push(key);
    provenance[key] = {
      ...(provenance[key] && typeof provenance[key] === 'object'
        ? provenance[key]
        : {}),
      value: previousValue,
      status: 'needs_review',
      normalizedSource: 'NEEDS_REVIEW',
      pricingEligible: false,
      deterministicRepeatedImportStable: true,
      reason:
        'Repeat import dropped this insulation quantity; the prior canonical read was retained for review.',
    };
  }

  if (!changedFields.length) {
    return {
      ...takeoff,
      measurements: stabilizedMeasurements,
    };
  }
  return {
    ...takeoff,
    measurements: stabilizedMeasurements,
    measurementProvenance: provenance,
  };
}

function stabilizeInsulationTakeoff(
  takeoff: PlanToMeasurementsResult
): PlanToMeasurementsResult {
  if (takeoff.selectedTrade !== 'insulation') return takeoff;
  const planFacts = mergeInsulationPlanFactsFromTakeoff(
    takeoff.planFacts,
    takeoff.buildingAreas,
    takeoff.measurements
  );
  return {
    ...takeoff,
    measurements: hydrateInsulationPlanMeasurementsFromTakeoff(
      takeoff.measurements || {},
      planFacts
    ),
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
    | import('@/utils/measurementSemantics').AreaReconciliation
    | null;
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
  utilityConnections?: PlanToMeasurementsResult['utilityConnections'];
  fixtureInventory?: PlanToMeasurementsResult['fixtureInventory'];
  complexityFactors?: PlanToMeasurementsResult['complexityFactors'];
  plumbingReviewStatus?: PlanToMeasurementsResult['plumbingReviewStatus'];
  waterHeaterDetail?: PlanToMeasurementsResult['waterHeaterDetail'];
  gasApplianceScope?: PlanToMeasurementsResult['gasApplianceScope'];
};

type PlanReviewState = PlanToMeasurementsResult & {
  planImportFingerprint: string;
};

type Props = {
  Colors: Colors;
  darkMode: boolean;
  disabled?: boolean;
  existingNotes: string;
  /** Previously applied import used to stabilize repeat reads after remount. */
  existingPlanImport?: Pick<
    PlanImportPayload,
    'planImportFingerprint' | 'measurements' | 'selectedTrade'
  > | null;
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
  /** Tighter layout inside Build with AI accordion (no duplicate headers). */
  embedded?: boolean;
  onImportingChange?: (importing: boolean) => void;
  onImportPhaseChange?: (phase: AiGeneratePhaseId | null) => void;
};

export default function EstimatePlanImportStrip({
  Colors,
  darkMode,
  disabled = false,
  existingNotes,
  existingPlanImport = null,
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
  embedded = false,
  onImportingChange,
  onImportPhaseChange,
}: Props) {
  const [importing, setImporting] = useState(false);
  const updateImporting = useCallback(
    (next: boolean) => {
      setImporting(next);
      onImportingChange?.(next);
      if (!next) onImportPhaseChange?.(null);
    },
    [onImportingChange, onImportPhaseChange]
  );
  const previousPlanImportRef = useRef<PlanRepeatSnapshot | null>(null);
  const [planReview, setPlanReview] = useState<PlanReviewState | null>(null);
  const [showImportChooser, setShowImportChooser] = useState(false);
  const [estimatingMode, setEstimatingMode] = useState<
    PlanEstimatingMode | null
  >(forcedTradeKey ? 'selected_trade' : 'whole_project');
  const [selectedTrade, setSelectedTrade] = useState<PlanTradeKey | null>(
    forcedTradeKey
  );
  const lastTradeTapRef = useRef<{ key: PlanTradeKey; at: number } | null>(null);
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
    nextMode: PlanEstimatingMode | null,
    nextTrade: PlanTradeKey | null
  ) => {
    setEstimatingMode(nextMode);
    setSelectedTrade(nextTrade);
  };

  const handleTradePress = useCallback(
    (tradeKey: PlanTradeKey) => {
      if (routingLocked) return;

      const now = Date.now();
      const lastTap = lastTradeTapRef.current;
      if (
        selectedTrade === tradeKey &&
        lastTap?.key === tradeKey &&
        now - lastTap.at < 350
      ) {
        lastTradeTapRef.current = null;
        updateRouting('selected_trade', null);
        return;
      }

      lastTradeTapRef.current = { key: tradeKey, at: now };
      updateRouting('selected_trade', tradeKey);
    },
    [routingLocked, selectedTrade]
  );

  const executeTakeoff = useCallback(
    async (
      pages: Array<{ base64: string; mimeType: string; name?: string }>
    ) => {
      if (!pages.length || disabled) return;
      updateImporting(true);
      onImportPhaseChange?.('reading_plan');
      try {
        const takeoff = await runPlanTakeoff(pages, {
          existingNotes,
          templateKeyHint,
          projectTypeHint,
          estimatingMode,
          selectedTradeKey: selectedTrade,
        });
        if (!takeoff) return;
        onImportPhaseChange?.('building_scope');
        const hydrated = hydratePaintingPlanMeasurements({
          ...takeoff,
          estimatingMode,
          selectedTrade,
        });
        const preparedTakeoff = stabilizeInsulationTakeoff({
          ...hydrated,
          selectedTrade,
        });
        const fingerprint = planImportFingerprint(
          pages,
          estimatingMode,
          selectedTrade
        );
        const persistedMeasurements = {
          ...(existingPlanImport?.measurements || {}),
          ...(preparedTakeoff.measurements?.openingDeductionSqft &&
          !existingPlanImport?.measurements?.openingDeductionSqft
            ? {
                openingDeductionSqft:
                  preparedTakeoff.measurements.openingDeductionSqft,
              }
            : {}),
        };
        const persistedPlanFacts = mergeInsulationPlanFactsFromTakeoff(
          preparedTakeoff.planFacts,
          preparedTakeoff.buildingAreas,
          preparedTakeoff.measurements
        );
        const persistedPrevious =
          existingPlanImport?.planImportFingerprint === fingerprint
            ? {
                fingerprint,
                measurements:
                  existingPlanImport.selectedTrade === 'insulation'
                    ? // Canonicalize values restored from the parent as well, so an
                      // older gross-wall import cannot become the stable value.
                      hydrateInsulationPlanMeasurementsFromTakeoff(
                        persistedMeasurements,
                        persistedPlanFacts
                      )
                    : persistedMeasurements,
              }
            : null;
        const previousPlanImport =
          (previousPlanImportRef.current?.fingerprint === fingerprint &&
          (selectedTrade !== 'insulation' ||
            hasCompleteInsulationRepeatImportSnapshot(
              previousPlanImportRef.current.measurements,
              {
                planFacts: preparedTakeoff.planFacts,
                buildingAreas: preparedTakeoff.buildingAreas,
              }
            ))
            ? previousPlanImportRef.current
            : null) ||
          persistedPrevious ||
          (lastPlanImportSnapshot?.fingerprint === fingerprint &&
          (selectedTrade !== 'insulation' ||
            hasCompleteInsulationRepeatImportSnapshot(
              lastPlanImportSnapshot.measurements,
              {
                planFacts: preparedTakeoff.planFacts,
                buildingAreas: preparedTakeoff.buildingAreas,
              }
            ))
            ? lastPlanImportSnapshot
            : null) ||
          (lastGoodInsulationSnapshot?.fingerprint === fingerprint
            ? lastGoodInsulationSnapshot
            : null);
        const hvacStabilized =
          selectedTrade === 'hvac'
            ? applyRepeatedHvacImportStability(
                preparedTakeoff,
                previousPlanImport,
                fingerprint
              )
            : preparedTakeoff;
        const afterRepeatStability = applyRepeatedPlumbingImportConflicts(
          applyRepeatedElectricalImportStability(
            applyRepeatedInsulationImportStability(
              hvacStabilized,
              previousPlanImport,
              fingerprint
            ),
            previousPlanImport,
            fingerprint
          ),
          previousPlanImport,
          fingerprint
        );
        const stabilized =
          selectedTrade === 'insulation'
            ? stabilizeInsulationTakeoff(afterRepeatStability)
            : afterRepeatStability;
        const nextPlanSnapshot = {
          fingerprint,
          measurements: {
            ...(stabilized.measurements || {}),
            ...(selectedTrade === 'hvac'
              ? Object.fromEntries(
                  Object.entries(resolveHvacPlanReviewMeasurements(stabilized))
                    .filter(
                      ([, value]) => positiveRepeatImportValue(value) != null
                    )
                    .map(([key, value]) => [key, Number(value)])
                )
              : {}),
          },
        };
        previousPlanImportRef.current = nextPlanSnapshot;
        lastPlanImportSnapshot = nextPlanSnapshot;
        if (
          selectedTrade === 'insulation' &&
          hasCompleteInsulationRepeatImportSnapshot(
            nextPlanSnapshot.measurements,
            {
              planFacts: stabilized.planFacts,
              buildingAreas: stabilized.buildingAreas,
            }
          )
        ) {
          lastGoodInsulationSnapshot = nextPlanSnapshot;
        }
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
          if (
            !keepSelectedTradePlanContext(selection.mode, selection.trade.key)
          ) {
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
          if (selection.trade.key === 'hvac') {
            const resolved = resolveHvacPlanReviewMeasurements(stabilized);
            const lowConfidenceMeasurements = Object.fromEntries(
              (stabilized.lowConfidence || [])
                .map(
                  reading =>
                    [
                      String(reading?.field || '').trim(),
                      reading?.value,
                    ] as const
                )
                .filter(([field]) =>
                  HVAC_PLAN_REVIEW_CANONICAL_KEYS.includes(
                    field as (typeof HVAC_PLAN_REVIEW_CANONICAL_KEYS)[number]
                  )
                )
                .map(
                  ([field, value]) =>
                    [field, positiveRepeatImportValue(value)] as const
                )
                .filter((entry): entry is [string, number] => entry[1] != null)
            );
            stamped.measurements = {
              ...stamped.measurements,
              ...lowConfidenceMeasurements,
              ...Object.fromEntries(
                Object.entries(resolved)
                  .filter(([, value]) => value.trim() !== '')
                  .map(([key, value]) => [key, Number(value)])
              ),
            };
          }
        }
        onImportPhaseChange?.('finalizing');
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
        updateImporting(false);
      }
    },
    [
      disabled,
      existingNotes,
      templateKeyHint,
      projectTypeHint,
      estimatingMode,
      selectedTrade,
      updateImporting,
      onImportPhaseChange,
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
    if (!estimatingMode) {
      Alert.alert(
        'Select an option',
        'Choose whole project or single trade before importing the plan.'
      );
      return;
    }
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
        complexityFactors?: PlanToMeasurementsResult['complexityFactors'];
        plumbingReviewStatus?: PlanToMeasurementsResult['plumbingReviewStatus'];
        waterHeaterDetail?: PlanToMeasurementsResult['waterHeaterDetail'];
        gasApplianceScope?: PlanToMeasurementsResult['gasApplianceScope'];
        quickMeasurementSources?: PlanToMeasurementsResult['quickMeasurementSources'];
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
                      ...takeoff.measurements,
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
        selection.trade?.key === 'plumbing' ||
        selection.trade?.key === 'framing' ||
        selection.trade?.key === 'drywall' ||
        selection.trade?.key === 'hvac'
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
        selection.mode === 'selected_trade' &&
        !keepSelectedTradePlanContext(selection.mode, selection.trade?.key)
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
      const provenanceQuickMeasurementSources =
        selection.trade?.key === 'hvac'
          ? hvacQuickMeasurementSourcesFromProvenance(
              tradeMeasurements,
              appliedProvenance as Record<string, unknown>
            )
          : selection.trade?.key === 'electrical' ||
              selection.trade?.key === 'plumbing'
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
            : selection.trade?.key === 'framing'
              ? tagFramingQuickMeasurementSourcesFromProvenance(
                  Object.fromEntries(
                    Object.entries(tradeMeasurements).map(([key, value]) => [
                      key,
                      Number(value),
                    ])
                  ),
                  appliedProvenance as Record<string, unknown>
                )
              : {};

      let framingQuickSources: Record<string, string> = {};
      if (selection.trade?.key === 'framing') {
        const reconciled = reconcileFramingScopeMeasurements({
          planImportTradeKey: 'framing',
          ...Object.fromEntries(
            Object.entries(tradeMeasurements).map(([key, value]) => [
              key,
              Number(value),
            ])
          ),
          quickMeasurementSources: {
            ...(normalizedTrade?.quickMeasurementSources || {}),
            ...provenanceQuickMeasurementSources,
          },
        }) as Record<string, unknown>;
        for (const [key, value] of Object.entries(reconciled)) {
          if (key === 'itemQuantities' || key === 'framingScope') continue;
          const n = Number(value);
          if (Number.isFinite(n) && n > 0) {
            tradeMeasurements[key] = String(n);
          }
        }
        framingQuickSources =
          (reconciled.quickMeasurementSources as Record<string, string>) || {};
      }

      if (selection.trade?.key === 'insulation') {
        const insulationPlanFacts = mergeInsulationPlanFactsFromTakeoff(
          takeoff.planFacts,
          takeoff.buildingAreas,
          tradeMeasurements
        );
        const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
          tradeMeasurements,
          insulationPlanFacts
        );
        for (const key of INSULATION_SCOPE_NUMERIC_KEYS) {
          const value = hydrated[key];
          if (value == null || value === '') continue;
          tradeMeasurements[key] = String(value);
        }
        if (takeoff.planImportFingerprint) {
          const appliedSnapshot = {
            fingerprint: takeoff.planImportFingerprint,
            measurements: { ...tradeMeasurements },
          };
          lastPlanImportSnapshot = appliedSnapshot;
          if (
            hasCompleteInsulationRepeatImportSnapshot(
              appliedSnapshot.measurements,
              {
                planFacts: takeoff.planFacts,
                buildingAreas: takeoff.buildingAreas,
              }
            )
          ) {
            lastGoodInsulationSnapshot = appliedSnapshot;
          }
        }
      }

      const mergedQuickMeasurementSources = tagPlanDetectedQuickMeasurementKeys(
        tagPlanReviewLockedQuickMeasurementSources(
          appliedProvenance,
          Object.keys(tradeMeasurements),
          {
            ...(normalizedTrade?.quickMeasurementSources || {}),
            ...provenanceQuickMeasurementSources,
            ...framingQuickSources,
            ...(metadata?.quickMeasurementSources || {}),
          }
        ),
        Object.keys(tradeMeasurements)
      );
      const quickMeasurementSourcesWithDeselectedOpenings =
        selection.trade?.key === 'windows_doors' ||
        selection.trade?.key === 'garage_doors'
          ? (() => {
              const reviewKeys =
                selection.trade?.key === 'garage_doors'
                  ? GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS
                  : WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS;
              const selectedOpeningKeys = new Set(
                tradeScopeDetections
                  .filter(d => d.state === 'included')
                  .flatMap(d =>
                    selection.trade?.key === 'garage_doors'
                      ? garageDoorsMeasurementKeysForScopeItem(d.itemId)
                      : (() => {
                          const key = windowsDoorsMeasurementKeyForScopeItem(
                            d.itemId
                          );
                          return key ? [key] : [];
                        })()
                  )
              );
              const pendingOpeningKeys = reviewKeys.filter(
                key =>
                  Number(tradeMeasurements[key]) > 0 &&
                  (!selectedOpeningKeys.has(key) ||
                    mergedQuickMeasurementSources[key] === 'needs_confirmation')
              );
              return {
                ...mergedQuickMeasurementSources,
                ...Object.fromEntries(
                  pendingOpeningKeys.map(key => [key, 'needs_confirmation'])
                ),
              };
            })()
          : mergedQuickMeasurementSources;
      const measurementProvenanceWithDeselectedOpenings =
        selection.trade?.key === 'windows_doors' ||
        selection.trade?.key === 'garage_doors'
          ? (() => {
              const reviewKeys =
                selection.trade?.key === 'garage_doors'
                  ? GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS
                  : WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS;
              const next = {
                ...(appliedProvenance as Record<string, unknown>),
              };
              for (const key of reviewKeys) {
                if (
                  quickMeasurementSourcesWithDeselectedOpenings[key] !==
                    'needs_confirmation' ||
                  !(Number(tradeMeasurements[key]) > 0)
                ) {
                  continue;
                }
                const value = Number(tradeMeasurements[key]);
                const existing = next[key];
                next[key] = {
                  ...(existing && typeof existing === 'object' ? existing : {}),
                  ...lowConfidenceNeedsReviewProvenance(key, value),
                };
              }
              return next;
            })()
          : appliedProvenance;
      const hvacGuarded =
        selection.trade?.key === 'hvac'
          ? applyHvacProvenanceGuardToScopeMeasurements({
              ...tradeMeasurements,
              measurementProvenance: appliedProvenance,
              quickMeasurementSources: mergedQuickMeasurementSources,
            })
          : null;
      const hvacQuickMeasurementSources =
        selection.trade?.key === 'hvac' && hvacGuarded
          ? syncHvacSkippedTakeoffQuickMeasurementSources({
              ...tradeMeasurements,
              measurementProvenance:
                hvacGuarded.measurementProvenance || appliedProvenance,
              quickMeasurementSources:
                hvacGuarded.quickMeasurementSources ||
                mergedQuickMeasurementSources,
            })
          : null;

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
          selection.mode === 'selected_trade' &&
          !keepSelectedTradePlanContext(selection.mode, selection.trade?.key)
            ? undefined
            : takeoff.buildingAreas,
        planFacts:
          selection.mode === 'selected_trade' &&
          !keepSelectedTradePlanContext(selection.mode, selection.trade?.key)
            ? undefined
            : takeoff.planFacts,
        fieldConfidence: takeoff.fieldConfidence,
        quickMeasurementSources:
          hvacQuickMeasurementSources ||
          (hvacGuarded?.quickMeasurementSources as Record<string, string>) ||
          quickMeasurementSourcesWithDeselectedOpenings,
        measurementProvenance:
          (hvacGuarded?.measurementProvenance as Record<string, unknown>) ||
          measurementProvenanceWithDeselectedOpenings,
        measurementConflicts: unresolvedConflicts,
        electricalValidation:
          metadata?.electricalValidation ??
          takeoff.electricalValidation ??
          null,
        utilityConnections:
          metadata?.utilityConnections ?? takeoff.utilityConnections,
        fixtureInventory:
          metadata?.fixtureInventory ?? takeoff.fixtureInventory,
        complexityFactors:
          metadata?.complexityFactors ?? takeoff.complexityFactors,
        plumbingReviewStatus:
          metadata?.plumbingReviewStatus ?? takeoff.plumbingReviewStatus,
        waterHeaterDetail:
          metadata?.waterHeaterDetail ?? takeoff.waterHeaterDetail,
        gasApplianceScope:
          metadata?.gasApplianceScope ?? takeoff.gasApplianceScope,
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

  const tradeOptions = routingLocked
    ? PLAN_EXPORT_TRADE_CONFIGURATIONS.filter(trade => trade.key === forcedTradeKey)
    : PLAN_EXPORT_TRADE_CONFIGURATIONS;

  const selectedTradeLabel =
    PLAN_EXPORT_TRADE_CONFIGURATIONS.find(trade => trade.key === selectedTrade)
      ?.label ||
    PLAN_TRADE_CONFIGURATIONS.find(trade => trade.key === selectedTrade)?.label ||
    null;

  const importButton = (
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
            color: Colors.sub,
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
              : embedded && showPlanRouting
                ? estimatingMode === 'selected_trade' && !selectedTrade
                  ? 'Pick a trade below, then choose your plan file.'
                  : 'Photo, library pages, or PDF — you review before Generate.'
                : 'Photo, library pages, or PDF — you review before Generate'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const planRoutingPanel = showPlanRouting ? (
    <View
      style={
        embedded
          ? {
              marginTop: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: darkMode
                ? 'rgba(148, 163, 184, 0.12)'
                : Colors.line,
              backgroundColor: aiFlowCardBackground(darkMode, Colors.surface2),
              padding: 12,
            }
          : undefined
      }
    >
      {!embedded ? (
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
      ) : null}
      {embedded ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {!routingLocked ? (
            <TouchableOpacity
              onPress={() => {
                if (estimatingMode === 'whole_project') {
                  updateRouting(null, null);
                } else {
                  updateRouting('whole_project', null);
                }
              }}
              style={{
                flex: 1,
                borderRadius: 10,
                borderWidth: 1,
                borderColor:
                  estimatingMode === 'whole_project' ? '#22c55e' : Colors.line,
                backgroundColor:
                  estimatingMode === 'whole_project'
                    ? 'rgba(34,197,94,0.12)'
                    : 'transparent',
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text
                style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}
              >
                Whole project
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              if (estimatingMode === 'selected_trade') {
                updateRouting(null, null);
              } else {
                updateRouting('selected_trade', forcedTradeKey);
              }
            }}
            style={{
              flex: routingLocked ? 1 : 1,
              borderRadius: 10,
              borderWidth: 1,
              borderColor:
                estimatingMode === 'selected_trade' ? '#22c55e' : Colors.line,
              backgroundColor:
                estimatingMode === 'selected_trade'
                  ? 'rgba(34,197,94,0.12)'
                  : 'transparent',
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>
              {routingLocked ? 'Plumbing only' : 'Single trade'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 8, marginBottom: 10 }}>
          {!routingLocked ? (
            <TouchableOpacity
              onPress={() => {
                if (estimatingMode === 'whole_project') {
                  updateRouting(null, null);
                } else {
                  updateRouting('whole_project', null);
                }
              }}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor:
                  estimatingMode === 'whole_project' ? '#22c55e' : Colors.line,
                backgroundColor:
                  estimatingMode === 'whole_project'
                    ? 'rgba(34,197,94,0.12)'
                    : 'transparent',
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}
              >
                Whole Project / General Contractor
              </Text>
              {estimatingMode === 'whole_project' ? (
                <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                  Estimate multiple trades from the full plan set.
                </Text>
              ) : null}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              if (estimatingMode === 'selected_trade') {
                updateRouting(null, null);
              } else {
                updateRouting('selected_trade', forcedTradeKey);
              }
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
            <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>
              {routingLocked
                ? 'Single Trade / Plumbing Only'
                : 'Single Trade / Subcontractor'}
            </Text>
            {estimatingMode === 'selected_trade' ? (
              <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                {routingLocked
                  ? 'Import plan quantities for the Plumbing-only estimate.'
                  : 'Build an estimate for one trade only.'}
              </Text>
            ) : null}
          </TouchableOpacity>
        </View>
      )}
      {estimatingMode === 'selected_trade' ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                color: Colors.text,
                fontSize: embedded ? 12 : 13,
                fontWeight: '700',
              }}
            >
              Select your trade
            </Text>
            {embedded && selectedTradeLabel ? (
              <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>
                {selectedTradeLabel}
              </Text>
            ) : null}
          </View>
          {(() => {
            const tradeGrid = (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {tradeOptions.map(trade => {
                  const selected = selectedTrade === trade.key;
                  return (
                    <TouchableOpacity
                      key={trade.key}
                      onPress={() => handleTradePress(trade.key)}
                      style={{
                        width: '48%',
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selected ? '#22c55e' : Colors.line,
                        backgroundColor: selected
                          ? 'rgba(34,197,94,0.12)'
                          : 'transparent',
                        paddingHorizontal: 8,
                        paddingVertical: embedded ? 10 : 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: embedded ? 44 : 40,
                      }}
                    >
                      <Text
                        style={{
                          color: Colors.text,
                          fontSize: 12,
                          fontWeight: '700',
                          textAlign: 'center',
                        }}
                        numberOfLines={2}
                      >
                        {trade.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
            return embedded ? (
              <ScrollView
                style={{ maxHeight: 220 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {tradeGrid}
              </ScrollView>
            ) : (
              tradeGrid
            );
          })()}
        </>
      ) : null}
      {!embedded && estimatingMode === 'selected_trade' && !selectedTrade ? (
        <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 10 }}>
          Select a trade before importing the plan.
        </Text>
      ) : null}
      {!embedded && selectedTrade ? (
        <Text
          style={{
            color: Colors.sub,
            fontSize: 11,
            lineHeight: 15,
            marginTop: 10,
          }}
        >
          {selectedTrade === 'electrical'
            ? 'Electrical plan selected — symbol and schedule counts map onto the existing Electrical cards. Confirm the takeoff before it fills the bid.'
            : `${selectedTradeLabel || 'Trade'} plan selected — we will focus on relevant sheets and quantities.`}
        </Text>
      ) : null}
      {false && selectedTrade === 'plumbing' ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: Colors.line,
            paddingTop: 10,
            marginTop: 10,
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
                    plumbingPerformerMode === mode ? '#22c55e' : Colors.line,
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
    </View>
  ) : null;

  return (
    <View style={{ marginBottom: embedded ? 12 : 16 }}>
      {!embedded ? (
        <>
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
        </>
      ) : null}
      {embedded ? (
        <>
          {importButton}
          {planRoutingPanel}
        </>
      ) : (
        <>
          {planRoutingPanel}
          {importButton}
        </>
      )}

      <PlanTakeoffReviewModal
        visible={planReview != null}
        takeoff={planReview}
        estimatingMode={estimatingMode ?? undefined}
        selectedTrade={selectedTrade}
        currentValues={{}}
        onApply={handleApply}
        onCancel={() => setPlanReview(null)}
      />
    </View>
  );
}
