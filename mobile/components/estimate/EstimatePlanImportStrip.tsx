/**
 * Step 1 "Import from plan" strip — camera / library / PDF → review modal.
 * Measurements + scope detections are returned to the parent for Generate handoff.
 */
import React, { useCallback, useState } from 'react';
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

type Colors = {
  text: string;
  sub: string;
  line: string;
};

export type PlanImportApplyResult = {
  measurements: Record<string, string>;
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
  onApplied,
}: Props) {
  const [importing, setImporting] = useState(false);
  const [planReview, setPlanReview] = useState<PlanToMeasurementsResult | null>(
    null
  );
  const [showImportChooser, setShowImportChooser] = useState(false);
  const [estimatingMode, setEstimatingMode] =
    useState<PlanEstimatingMode>('whole_project');
  const [selectedTrade, setSelectedTrade] = useState<PlanTradeKey | null>(null);
  const planReady = Boolean(planReadySubtitle?.trim());
  const showPlanRouting = showImportChooser || planReady || planReview != null;
  const semanticsOn = measurementSemanticsV1Enabled();

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
        const selection = normalizePlanImportSelection(
          estimatingMode,
          selectedTrade
        );
        const stamped: PlanToMeasurementsResult = {
          ...takeoff,
          estimatingMode: selection.mode,
          selectedTrade: selection.trade?.key || null,
        };
        if (selection.mode === 'selected_trade' && selection.trade) {
          stamped.measurements = filterPlanMeasurementsForTrade(
            takeoff.measurements || {},
            selection.mode,
            selection.trade.key
          );
          stamped.rooms = [];
          stamped.areaReconciliation = null;
          if (takeoff.scope?.detections) {
            stamped.scope = {
              ...takeoff.scope,
              detections: filterPlanScopesForTrade(
                takeoff.scope.detections,
                selection.mode,
                selection.trade.key
              ),
            };
          }
        }
        setPlanReview(stamped);
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
    if (importing || disabled) return;
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
  }, [importing, disabled, executeTakeoff]);

  const onLibrary = useCallback(async () => {
    if (importing || disabled) return;
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
  }, [importing, disabled, executeTakeoff]);

  const onPdf = useCallback(async () => {
    if (importing || disabled) return;
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
  }, [importing, disabled, executeTakeoff]);

  const openPicker = useCallback(() => {
    if (importing || disabled) return;
    if (!showImportChooser) {
      setShowImportChooser(true);
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
    showImportChooser,
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
      }>
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
                        key === 'roofPitch' ? String(value || '') : Number(value),
                      ])
                      .filter(([key, value]) => {
                        if (selection.trade?.key === 'roofing' && key === 'roofPitch') {
                          return typeof value === 'string' && value.trim().length > 0;
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
        selection.trade?.key === 'flooring'
          ? normalizeTradeMeasurements(
              selection.trade.key,
              {
                ...tradeMeasurements,
                ...(selection.trade.key === 'roofing'
                  ? {
                      roofPitch:
                        takeoff.planFacts?.roofPitch || tradeMeasurements.roofPitch,
                      storyCount:
                        takeoff.planFacts?.storyCount || tradeMeasurements.storyCount,
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
      const tradeRooms =
        selection.mode === 'selected_trade' ? [] : rooms;
      const tradeScopeDetections =
        selection.mode === 'selected_trade' && selection.trade
          ? filterPlanScopesForTrade(
              scopeDetections,
              selection.mode,
              selection.trade.key
            )
          : scopeDetections;

      onApplied({
        measurements: tradeMeasurements,
        scopeDetections: tradeScopeDetections,
        mergedNotes: takeoff.mergedNotes || existingNotes,
        notesBlock: takeoff.notesBlock || '',
        rooms: tradeRooms,
        areaReconciliation:
          selection.mode === 'selected_trade'
            ? null
            : takeoff.areaReconciliation ?? null,
        buildingAreas:
          selection.mode === 'selected_trade' ? undefined : takeoff.buildingAreas,
        planFacts:
          selection.mode === 'selected_trade' ? undefined : takeoff.planFacts,
        fieldConfidence: takeoff.fieldConfidence,
        quickMeasurementSources: normalizedTrade?.quickMeasurementSources,
        measurementProvenance: {
          ...(normalizedTrade?.measurementProvenance || {}),
          ...(takeoff.measurementProvenance
            ? Object.fromEntries(
                Object.entries(takeoff.measurementProvenance).filter(([key]) =>
                  Object.prototype.hasOwnProperty.call(tradeMeasurements, key)
                )
              )
            : {}),
        },
        measurementConflicts: (takeoff.measurementConflicts || []).filter(
          conflict =>
            Object.prototype.hasOwnProperty.call(tradeMeasurements, conflict.field)
        ),
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
    opacity: importing || disabled ? 0.55 : 1,
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
            <TouchableOpacity
              onPress={() => {
                setEstimatingMode('whole_project');
                setSelectedTrade(null);
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
              <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                Estimate multiple trades from the full plan set.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEstimatingMode('selected_trade')}
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
                Single Trade / Subcontractor
              </Text>
              <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                Build an estimate for one trade only.
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
                {PLAN_EXPORT_TRADE_CONFIGURATIONS.map(trade => (
                  <TouchableOpacity
                    key={trade.key}
                    onPress={() => setSelectedTrade(trade.key)}
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
                ? 'Electrical plan selected — we will focus on electrical sheets and quantities that can be verified.'
                : `${PLAN_EXPORT_TRADE_CONFIGURATIONS.find(trade => trade.key === selectedTrade)?.label || PLAN_TRADE_CONFIGURATIONS.find(trade => trade.key === selectedTrade)?.label || 'Trade'} plan selected — we will focus on relevant sheets and quantities.`}
            </Text>
          ) : null}
        </>
      ) : null}
      <TouchableOpacity
        onPress={openPicker}
        disabled={importing || disabled}
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
            {planReady
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
