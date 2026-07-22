/**
 * Step 1 "Import from plan" strip — camera / library / PDF → review modal.
 * Measurements + scope detections are returned to the parent for Generate handoff.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import PlanTakeoffReviewModal from '@/components/estimate/PlanTakeoffReviewModal';
import type { PhotoScopeDetection, PlanToMeasurementsResult } from '@/utils/estimateAiDraft';
import {
  imagesFromPickerAssets,
  pickPlanFromLibrary,
  pickPlanPdf,
  promptPlanImportSource,
  runPlanTakeoff,
  takePlanPhoto,
} from '@/utils/planImportRunner';
import { measurementSemanticsV1Enabled } from '@/utils/measurementSemantics';

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
  areaReconciliation?: import('@/utils/measurementSemantics').AreaReconciliation | null;
  buildingAreas?: import('@/utils/planMeasurementFacts').PlanBuildingAreas;
  planFacts?: import('@/utils/planMeasurementFacts').PlanFacts;
  fieldConfidence?: Record<string, number>;
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
  const [planReview, setPlanReview] = useState<PlanToMeasurementsResult | null>(null);
  const planReady = Boolean(planReadySubtitle?.trim());
  const semanticsOn = measurementSemanticsV1Enabled();

  const executeTakeoff = useCallback(
    async (pages: Array<{ base64: string; mimeType: string; name?: string }>) => {
      if (!pages.length || disabled) return;
      setImporting(true);
      try {
        const takeoff = await runPlanTakeoff(pages, {
          existingNotes,
          templateKeyHint,
          projectTypeHint,
        });
        if (!takeoff) return;
        setPlanReview(takeoff);
        if (Platform.OS === 'ios') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        Alert.alert('Plan import failed', e instanceof Error ? e.message : 'Try again with a clearer image.');
      } finally {
        setImporting(false);
      }
    },
    [disabled, existingNotes, templateKeyHint, projectTypeHint]
  );

  const onCamera = useCallback(async () => {
    if (importing || disabled) return;
    try {
      const assets = await takePlanPhoto();
      if (!assets?.length) return;
      const images = await imagesFromPickerAssets(assets);
      await executeTakeoff(images);
    } catch (e) {
      Alert.alert('Camera failed', e instanceof Error ? e.message : 'Could not take a photo.');
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
      Alert.alert('Library failed', e instanceof Error ? e.message : 'Could not open photos.');
    }
  }, [importing, disabled, executeTakeoff]);

  const onPdf = useCallback(async () => {
    if (importing || disabled) return;
    try {
      const pages = await pickPlanPdf();
      if (!pages?.length) return;
      await executeTakeoff(pages);
    } catch (e) {
      Alert.alert('PDF import failed', e instanceof Error ? e.message : 'Could not read the PDF.');
    }
  }, [importing, disabled, executeTakeoff]);

  const openPicker = useCallback(() => {
    if (importing || disabled) return;
    promptPlanImportSource({
      onCamera: () => void onCamera(),
      onLibrary: () => void onLibrary(),
      onPdf: () => void onPdf(),
    });
  }, [importing, disabled, onCamera, onLibrary, onPdf]);

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

      const measCount = Object.keys(values).length;
      const roomCount = rooms.length;
      const scopeCount = scopeDetections.length;

      onApplied({
        measurements: values,
        scopeDetections,
        mergedNotes: takeoff.mergedNotes || existingNotes,
        notesBlock: takeoff.notesBlock || '',
        rooms,
        areaReconciliation: takeoff.areaReconciliation ?? null,
        buildingAreas: takeoff.buildingAreas,
        planFacts: takeoff.planFacts,
        fieldConfidence: takeoff.fieldConfidence,
      });

      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [planReview, onApplied, existingNotes]
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
      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
        Plans
      </Text>
      <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 16, marginBottom: 10 }}>
        Import a floor-plan PDF or photos — AI fills measurements and drafts scope for you to review.
      </Text>
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
          <ActivityIndicator size="small" color="#22c55e" style={{ marginTop: 2 }} />
        ) : (
          <Ionicons
            name={planReady ? 'checkmark-circle' : 'map-outline'}
            size={planReady ? 24 : 18}
            color={planReady ? '#38d39f' : '#22c55e'}
            style={{ marginTop: planReady ? 0 : 1 }}
          />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: Colors.text, fontSize: planReady ? 15 : 13, fontWeight: planReady ? '800' : '700' }}>
            {importing ? 'Reading plan…' : planReady ? 'Plan ready to generate' : 'Import from plan'}
          </Text>
          {planReady && planReadySubtitle ? (
            <Text style={{ color: '#38d39f', fontSize: 13, fontWeight: '700', marginTop: 4 }}>
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
        currentValues={{}}
        onApply={handleApply}
        onCancel={() => setPlanReview(null)}
      />
    </View>
  );
}
