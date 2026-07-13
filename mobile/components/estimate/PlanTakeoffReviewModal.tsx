/**
 * Full-screen verify step for plan takeoff: edit numbers, confirm suggested
 * scope, then Apply — matches Build with AI / Confirm Scope chrome.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import { quickMeasurementFieldMeta } from '@/utils/scopeQuickMeasurements';
import type { PlanToMeasurementsResult, PhotoScopeDetection } from '@/utils/estimateAiDraft';

export type PlanReviewRow = {
  key: string;
  label: string;
  unit: string;
  value: string;
  confidence: number | null;
  /** Value already present in Quick measurements — applying replaces it. */
  conflictValue: string | null;
  include: boolean;
};

type Props = {
  visible: boolean;
  takeoff: PlanToMeasurementsResult | null;
  /** Current Quick measurement values, to flag conflicts. */
  currentValues: Record<string, unknown>;
  onApply: (values: Record<string, string>, scopeDetections: PhotoScopeDetection[]) => void;
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
  kitchenFloorSqft: 10,
  bathroomFloorSqft: 11,
};

/** Only show Verify when confidence is below high — High badges are noise. */
function showVerifyBadge(confidence: number | null): boolean {
  return confidence != null && confidence < 0.85;
}

function positiveString(v: unknown): string | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function applyButtonLabel(includedCount: number, checkedScopeCount: number): string {
  if (includedCount > 0 && checkedScopeCount > 0) return 'Apply to bid';
  if (includedCount > 0) {
    return `Apply ${includedCount} measurement${includedCount === 1 ? '' : 's'}`;
  }
  if (checkedScopeCount > 0) {
    return `Add ${checkedScopeCount} scope item${checkedScopeCount === 1 ? '' : 's'}`;
  }
  return 'Nothing selected';
}

export default function PlanTakeoffReviewModal({
  visible,
  takeoff,
  currentValues,
  onApply,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const lineColor = darkMode ? 'rgba(255,255,255,0.12)' : Colors.line;
  const footerBottomPad = Math.max(insets.bottom, 16);

  const [rows, setRows] = useState<PlanReviewRow[]>([]);
  const [scopeChecked, setScopeChecked] = useState<Record<string, boolean>>({});

  const scopeDetections = useMemo(() => {
    const detections = takeoff?.scope?.detections || [];
    return detections.filter(
      (d) => (d.confidence ?? 0) >= SCOPE_MIN_CONFIDENCE && (d.state === 'included' || d.state === 'excluded')
    );
  }, [takeoff]);

  useEffect(() => {
    if (!visible || !takeoff) return;
    const nextRows: PlanReviewRow[] = Object.entries(takeoff.measurements || {})
      .map(([key, value]) => {
        const meta = quickMeasurementFieldMeta(key);
        const conflictValue = positiveString(currentValues?.[key]);
        return {
          key,
          label: key === 'floorAreaSqft' ? 'Living area' : meta.label,
          unit: meta.unit,
          value: String(value),
          confidence: takeoff.fieldConfidence?.[key] ?? null,
          conflictValue,
          include: conflictValue == null,
        };
      })
      .sort((a, b) => {
        const orderA = MEASUREMENT_SORT_ORDER[a.key] ?? 50;
        const orderB = MEASUREMENT_SORT_ORDER[b.key] ?? 50;
        if (orderA !== orderB) return orderA - orderB;
        // Conflicts last within the same band
        return (a.conflictValue ? 1 : 0) - (b.conflictValue ? 1 : 0);
      });
    setRows(nextRows);
    setScopeChecked(Object.fromEntries(scopeDetections.map((d) => [d.itemId, true])));
    // Rebuild only when a new takeoff arrives, not on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, takeoff]);

  if (!visible || !takeoff) return null;

  const unreadable = takeoff.unreadableFields || [];
  const lowConfidence = takeoff.lowConfidence || [];
  const hasMeasurements = rows.length > 0;
  const hasReadingIssues = lowConfidence.length > 0 || unreadable.length > 0;
  const includedCount = rows.filter((r) => r.include && Number(r.value) > 0).length;
  const checkedScopeCount = scopeDetections.filter((d) => scopeChecked[d.itemId]).length;
  const canApply = includedCount > 0 || checkedScopeCount > 0;

  const setRow = (key: string, patch: Partial<PlanReviewRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleApply = () => {
    const values: Record<string, string> = {};
    for (const row of rows) {
      const n = Number(row.value);
      if (row.include && Number.isFinite(n) && n > 0) values[row.key] = String(n);
    }
    onApply(
      values,
      scopeDetections.filter((d) => scopeChecked[d.itemId])
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          <AIEstimateFlowHeader
            title="Review plan takeoff"
            subtitle="Check numbers before they fill the bid"
            onBack={onCancel}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            {hasMeasurements ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.sub }]}>Measurements</Text>
                {rows.map((row) => {
                  const verify = showVerifyBadge(row.confidence);
                  return (
                    <View key={row.key} style={[styles.row, { borderBottomColor: lineColor }]}>
                      <TouchableOpacity
                        onPress={() => setRow(row.key, { include: !row.include })}
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
                        <View style={styles.rowLabelLine}>
                          <Text style={[styles.rowLabel, { color: Colors.text }]} numberOfLines={1}>
                            {row.label}
                          </Text>
                          {verify ? (
                            <View style={styles.verifyBadge}>
                              <Text style={styles.verifyBadgeText}>Verify</Text>
                            </View>
                          ) : null}
                        </View>
                        {row.conflictValue != null ? (
                          <Text style={styles.conflictText}>
                            Replaces your {row.conflictValue} {row.unit}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.valueShell, { borderColor: lineColor }]}>
                        <TextInput
                          value={row.value}
                          onChangeText={(t) => setRow(row.key, { value: t })}
                          keyboardType="decimal-pad"
                          style={[styles.valueInput, { color: Colors.text }]}
                        />
                        <Text style={[styles.unitText, { color: Colors.sub }]}>{row.unit}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.sub }]}>Measurements</Text>
                <Text style={[styles.emptyText, { color: Colors.sub }]}>
                  {takeoff.reason || 'No square footage could be read from these pages.'}
                </Text>
              </View>
            )}

            {hasReadingIssues ? (
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>Could not read clearly — enter manually</Text>
                {lowConfidence.map((f) => {
                  const meta = quickMeasurementFieldMeta(f.field);
                  return (
                    <Text key={`low-${f.field}`} style={[styles.calloutLine, { color: Colors.sub }]}>
                      {meta.label}: read {f.value} {meta.unit}, confidence too low
                    </Text>
                  );
                })}
                {unreadable.map((f, idx) => {
                  const meta = quickMeasurementFieldMeta(f.field);
                  return (
                    <Text key={`unread-${f.field}-${idx}`} style={[styles.calloutLine, { color: Colors.sub }]}>
                      {meta.label !== f.field ? meta.label : f.field}: {f.reason}
                    </Text>
                  );
                })}
              </View>
            ) : null}

            {scopeDetections.length ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.sub }]}>Suggested scope</Text>
                {scopeDetections.map((d) => (
                  <TouchableOpacity
                    key={d.itemId}
                    style={[styles.row, { borderBottomColor: lineColor }]}
                    onPress={() => setScopeChecked((prev) => ({ ...prev, [d.itemId]: !prev[d.itemId] }))}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={scopeChecked[d.itemId] ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={scopeChecked[d.itemId] ? '#22c55e' : Colors.sub}
                      style={styles.checkbox}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.rowLabel, { color: Colors.text }]} numberOfLines={1}>
                        {d.label || d.itemId}
                      </Text>
                      {d.evidence ? (
                        <Text style={[styles.evidenceText, { color: Colors.sub }]} numberOfLines={1}>
                          {d.evidence}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingBottom: footerBottomPad,
                borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
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
              <Text style={styles.primaryBtnText}>{applyButtonLabel(includedCount, checkedScopeCount)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Text style={{ color: Colors.sub, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: { marginRight: 2 },
  rowLabelLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  verifyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: 'rgba(245,158,11,0.16)',
  },
  verifyBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#d97706' },
  conflictText: { fontSize: 11.5, marginTop: 2, fontWeight: '600', color: '#d97706' },
  evidenceText: { fontSize: 11.5, marginTop: 2, lineHeight: 15 },
  valueShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 5,
  },
  valueInput: { fontSize: 14.5, fontWeight: '700', minWidth: 52, textAlign: 'right', padding: 0 },
  unitText: { fontSize: 11.5, fontWeight: '600' },
  emptyText: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  callout: {
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d97706',
    marginBottom: 6,
  },
  calloutLine: { fontSize: 12.5, lineHeight: 18, marginBottom: 3 },
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
