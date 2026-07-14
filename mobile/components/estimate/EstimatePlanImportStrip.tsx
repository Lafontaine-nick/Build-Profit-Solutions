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
import { readyStateSummary } from '@/utils/planTakeoffReviewUi';

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
};

type Props = {
  Colors: Colors;
  darkMode: boolean;
  disabled?: boolean;
  existingNotes: string;
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
  templateKeyHint = null,
  projectTypeHint = null,
  onApplied,
}: Props) {
  const [importing, setImporting] = useState(false);
  const [planReview, setPlanReview] = useState<PlanToMeasurementsResult | null>(null);
  const [appliedSummary, setAppliedSummary] = useState<string | null>(null);

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
      if (measurementSemanticsV1Enabled()) {
        setAppliedSummary(
          readyStateSummary({
            measurementCount: measCount,
            spaceCount: roomCount,
            scopeCount,
          }).replace(/^Ready ·\s*/, '')
        );
      } else {
        const bits: string[] = [];
        if (measCount) bits.push(`${measCount} measurement${measCount === 1 ? '' : 's'}`);
        if (roomCount) bits.push(`${roomCount} room${roomCount === 1 ? '' : 's'}`);
        if (scopeCount) bits.push(`${scopeCount} scope item${scopeCount === 1 ? '' : 's'}`);
        setAppliedSummary(bits.length ? bits.join(' · ') : 'Plan reviewed');
      }

      onApplied({
        measurements: values,
        scopeDetections,
        mergedNotes: takeoff.mergedNotes || existingNotes,
        notesBlock: takeoff.notesBlock || '',
        rooms,
        areaReconciliation: takeoff.areaReconciliation ?? null,
      });

      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [planReview, onApplied, existingNotes]
  );

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
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: darkMode ? 'rgba(148,163,184,0.25)' : Colors.line,
          backgroundColor: darkMode ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)',
          opacity: importing || disabled ? 0.55 : 1,
        }}
      >
        {importing ? (
          <ActivityIndicator size="small" color="#22c55e" />
        ) : (
          <Ionicons name="map-outline" size={18} color="#22c55e" />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>
            {importing ? 'Reading plan…' : 'Import from plan'}
          </Text>
          <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
            {appliedSummary
              ? `Ready · ${appliedSummary}`
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
