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
import type {
  PlanToMeasurementsResult,
  PhotoScopeDetection,
} from '@/utils/estimateAiDraft';
import { measurementSemanticsV1Enabled } from '@/utils/measurementSemantics';
import {
  applyPlanTakeoffButtonLabel,
  buildConcretePlanReviewSummary,
  buildFlooringPlanReviewSummary,
  classifyPlanSpaceName,
  formatSf,
  garageReconciliationStatusLabel,
  livingReconciliationStatusLabel,
  measurementDisplayLabel,
  measurementSourceLabel,
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

export type PlanReviewRow = {
  key: string;
  label: string;
  subtext?: string | null;
  sourceLabel?: string | null;
  unit: string;
  value: string;
  confidence: number | null;
  provenance: PlanMeasurementProvenance;
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
      'measurementProvenance' | 'measurementConflicts'
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
  kitchenFloorSqft: 50,
  bathroomFloorSqft: 51,
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

function positiveString(v: unknown): string | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function positiveMeasurement(v: unknown): number | null {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
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
  const lineColor = darkMode ? 'rgba(255,255,255,0.12)' : Colors.line;
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

  const visibleMeasurements = useMemo(
    () =>
      filterPlanMeasurementsForTrade(
        takeoff?.measurements || {},
        effectiveMode,
        effectiveTradeKey
      ),
    [takeoff, effectiveMode, effectiveTradeKey]
  );

  const scopeDetections = useMemo(() => {
    const detections = takeoff?.scope?.detections || [];
    return filterPlanScopesForTrade(
      detections,
      effectiveMode,
      effectiveTradeKey
    ).filter(
      d =>
        (d.confidence ?? 0) >= SCOPE_MIN_CONFIDENCE &&
        (d.state === 'included' || d.state === 'excluded')
    );
  }, [takeoff, effectiveMode, effectiveTradeKey]);

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
    const livingSf = Number(visibleMeasurements?.floorAreaSqft);
    const nextRows: PlanReviewRow[] = Object.entries(visibleMeasurements)
      .map(([key, value]) => {
        const meta = quickMeasurementFieldMeta(key);
        const conflictValue = positiveString(currentValues?.[key]);
        const display = semanticsOn
          ? measurementDisplayLabel(key, Number(value), livingSf)
          : {
              label: key === 'floorAreaSqft' ? 'Living area' : meta.label,
              subtext: null as string | null,
            };
        const sourceLabel = semanticsOn
          ? measurementSourceLabel({
              key,
              value: Number(value),
              livingSf,
              assumptions: takeoff.assumptions,
            })
          : null;
        const provenance = resolvePlanMeasurementProvenance({
          key,
          fieldConfidence: takeoff.fieldConfidence?.[key] ?? null,
          hasExplicitPlanSource:
            key === 'floorAreaSqft' ||
            key === 'garageSqft' ||
            key === 'deckSqft',
          hasReliableDimensions:
            key === 'kitchenFloorSqft' || key === 'bathroomFloorSqft',
          roomDependent:
            key === 'kitchenFloorSqft' || key === 'bathroomFloorSqft',
          reconciliationVariancePercent:
            areaReconciliation?.livingVariancePercent,
        });
        return {
          key,
          label: display.label,
          subtext: display.subtext ?? null,
          sourceLabel,
          unit: meta.unit,
          value: String(value),
          confidence: takeoff.fieldConfidence?.[key] ?? null,
          provenance,
          conflictValue,
          include: conflictValue == null,
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

  if (!visible || !takeoff) return null;

  const unreadable = takeoff.unreadableFields || [];
  const lowConfidence = takeoff.lowConfidence || [];
  const measurementConflicts = (takeoff.measurementConflicts || []).filter(
    conflict =>
      Object.prototype.hasOwnProperty.call(
        visibleMeasurements,
        conflict.field
      ) ||
      Object.prototype.hasOwnProperty.call(
        takeoff.measurements || {},
        conflict.field
      )
  );
  const hasMeasurements = rows.length > 0;
  const hasRooms = roomRows.length > 0;
  const hasReadingIssues = lowConfidence.length > 0 || unreadable.length > 0;
  const includedCount = rows.filter(
    r => r.include && Number(r.value) > 0
  ).length;
  const includedRoomCount = roomRows.filter(
    r => r.include && Number(r.areaSqft) > 0
  ).length;
  const checkedScopeCount = scopeDetections.filter(
    d => scopeChecked[d.itemId]
  ).length;
  const canApply =
    includedCount > 0 || includedRoomCount > 0 || checkedScopeCount > 0;
  const tradeLabel =
    tradeReview
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

  const setRow = (key: string, patch: Partial<PlanReviewRow>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  };

  const setRoomRow = (id: string, patch: Partial<PlanReviewRoomRow>) => {
    setRoomRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleApply = () => {
    const values: Record<string, string> = {};
    for (const row of rows) {
      const n = Number(row.value);
      if (row.include && Number.isFinite(n) && n > 0)
        values[row.key] = String(n);
    }
    const rooms = roomRows
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
      .filter(r => r.name);
    onApply(
      values,
      scopeDetections.filter(d => scopeChecked[d.itemId]),
      rooms,
      {
        measurementProvenance: takeoff.measurementProvenance,
        measurementConflicts: takeoff.measurementConflicts,
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
          <AIEstimateFlowHeader
            title={
              tradeLabel
                ? `Review ${tradeLabel} Takeoff`
                : 'Review plan takeoff'
            }
            subtitle={
              tradeLabel
                ? `Check ${tradeLabel.toLowerCase()} quantities before they fill the bid`
                : 'Check numbers before they fill the bid'
            }
            onBack={onCancel}
          />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : 'on-drag'
            }
            showsVerticalScrollIndicator={false}
          >
            {concretePlanSummary ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.sub }]}>
                  Concrete
                </Text>
                <View
                  style={[
                    styles.concreteSummaryCard,
                    {
                      borderColor: lineColor,
                      backgroundColor: darkMode
                        ? 'rgba(148,163,184,0.08)'
                        : 'rgba(148,163,184,0.06)',
                    },
                  ]}
                >
                  {concretePlanSummary.map(line => (
                    <View key={line.label} style={styles.concreteSummaryRow}>
                      <Text
                        style={[styles.concreteSummaryLabel, { color: Colors.sub }]}
                      >
                        {line.label}
                      </Text>
                      <Text
                        style={[
                          styles.concreteSummaryValue,
                          {
                            color:
                              line.value === '—' || line.value === 'Needs confirmation'
                                ? Colors.sub
                                : Colors.text,
                          },
                        ]}
                      >
                        {line.value}
                      </Text>
                      {line.note ? (
                        <Text
                          style={[styles.evidenceText, { color: Colors.sub }]}
                          numberOfLines={2}
                        >
                          {line.note}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {flooringPlanSummary ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.sub }]}>
                  Flooring
                </Text>
                <View
                  style={[
                    styles.concreteSummaryCard,
                    {
                      borderColor: lineColor,
                      backgroundColor: darkMode
                        ? 'rgba(148,163,184,0.08)'
                        : 'rgba(148,163,184,0.06)',
                    },
                  ]}
                >
                  {flooringPlanSummary.map(line => (
                    <View key={line.label} style={styles.concreteSummaryRow}>
                      <Text
                        style={[styles.concreteSummaryLabel, { color: Colors.sub }]}
                      >
                        {line.label}
                      </Text>
                      <Text
                        style={[
                          styles.concreteSummaryValue,
                          {
                            color:
                              line.value === '—' || line.value === 'Needs confirmation'
                                ? Colors.sub
                                : Colors.text,
                          },
                        ]}
                      >
                        {line.value}
                      </Text>
                      {line.note ? (
                        <Text
                          style={[styles.evidenceText, { color: Colors.sub }]}
                          numberOfLines={2}
                        >
                          {line.note}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {hasMeasurements ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.sub }]}>
                  {concretePlanSummary || flooringPlanSummary
                    ? 'Edit quantities'
                    : 'Measurements'}
                </Text>
                {rows.map(row => {
                  return (
                    <View
                      key={row.key}
                      style={[styles.row, { borderBottomColor: lineColor }]}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          setRow(row.key, { include: !row.include })
                        }
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
                          <Text
                            style={[styles.rowLabel, { color: Colors.text }]}
                            numberOfLines={2}
                          >
                            {row.label}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.provenanceBadge,
                            {
                              borderColor: planProvenanceColor(
                                row.provenance.status,
                                Colors
                              ),
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.provenanceBadgeText,
                              {
                                color: planProvenanceColor(
                                  row.provenance.status,
                                  Colors
                                ),
                              },
                            ]}
                          >
                            {row.provenance.label}
                          </Text>
                        </View>
                        {row.subtext ? (
                          <Text
                            style={[styles.evidenceText, { color: Colors.sub }]}
                            numberOfLines={2}
                          >
                            {row.subtext}
                          </Text>
                        ) : null}
                        {row.sourceLabel ? (
                          <Text
                            style={[styles.evidenceText, { color: Colors.sub }]}
                            numberOfLines={2}
                          >
                            {row.sourceLabel}
                          </Text>
                        ) : null}
                        <Text
                          style={[
                            styles.evidenceText,
                            {
                              color: planProvenanceColor(
                                row.provenance.status,
                                Colors
                              ),
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {row.provenance.reason}
                        </Text>
                        {row.conflictValue != null ? (
                          <Text style={styles.conflictText}>
                            Replaces your {row.conflictValue} {row.unit}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[styles.valueShell, { borderColor: lineColor }]}
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
                            })
                          }
                          keyboardType='decimal-pad'
                          style={[styles.valueInput, { color: Colors.text }]}
                        />
                        <Text style={[styles.unitText, { color: Colors.sub }]}>
                          {row.unit}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.sub }]}>
                  Measurements
                </Text>
                <Text style={[styles.emptyText, { color: Colors.sub }]}>
                  {tradeLabel
                    ? `No ${tradeLabel} quantities were verified from the selected plan pages yet. ${
                        takeoff.missingInfo?.length
                          ? `Confirm: ${takeoff.missingInfo.join(', ')}.`
                          : 'Review the relevant trade sheets and confirm the missing quantities.'
                      }`
                    : takeoff.reason ||
                      'No square footage could be read from these pages.'}
                </Text>
              </View>
            )}

            {measurementConflicts.length ? (
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>
                  Conflicting plan takeoffs — confirm measurement
                </Text>
                {measurementConflicts.map(conflict => (
                  <Text
                    key={`conflict-${conflict.field}`}
                    style={[styles.calloutLine, { color: Colors.sub }]}
                  >
                    {quickMeasurementFieldMeta(conflict.field).label}:{' '}
                    {conflict.selectedValue.toLocaleString()} selected from{' '}
                    {conflict.selectedSource.replace(/_/g, ' ')}; alternate
                    values were also read from the plan.
                  </Text>
                ))}
              </View>
            ) : null}

            {semanticsOn && areaReconciliation ? (
              <View
                style={[
                  styles.reconcileCard,
                  {
                    borderColor: darkMode
                      ? 'rgba(148,163,184,0.25)'
                      : Colors.line,
                    backgroundColor: darkMode
                      ? 'rgba(255,255,255,0.04)'
                      : Colors.surface2,
                  },
                ]}
              >
                <Text style={[styles.reconcileTitle, { color: Colors.text }]}>
                  Area reconciliation
                </Text>
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
                <Text style={[styles.reconcileStatus, { color: Colors.text }]}>
                  Status: {livingReconciliationStatusLabel(areaReconciliation)}
                </Text>

                <Text
                  style={[
                    styles.reconcileBlockTitle,
                    { color: Colors.text, marginTop: 10 },
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
                <Text style={[styles.reconcileStatus, { color: Colors.text }]}>
                  Status: {garageReconciliationStatusLabel(areaReconciliation)}
                </Text>

                <Text style={[styles.reconcileHint, { color: Colors.sub }]}>
                  Room dimensions are net detected spaces and may not include
                  bathrooms, halls, closets, wall area or circulation.
                </Text>
              </View>
            ) : null}

            {hasRooms ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.sub }]}>
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
                  <View
                    key={room.id}
                    style={[styles.row, { borderBottomColor: lineColor }]}
                  >
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
                      <View style={styles.rowLabelLine}>
                        <Text
                          style={[styles.rowLabel, { color: Colors.text }]}
                          numberOfLines={1}
                        >
                          {room.name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.provenanceBadge,
                          {
                            borderColor: planProvenanceColor(
                              room.provenance.status,
                              Colors
                            ),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.provenanceBadgeText,
                            {
                              color: planProvenanceColor(
                                room.provenance.status,
                                Colors
                              ),
                            },
                          ]}
                        >
                          {room.provenance.label}
                        </Text>
                      </View>
                      {room.lengthFt != null && room.widthFt != null ? (
                        <Text
                          style={[styles.evidenceText, { color: Colors.sub }]}
                        >
                          {room.lengthFt}×{room.widthFt} ft
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.evidenceText,
                          {
                            color: planProvenanceColor(
                              room.provenance.status,
                              Colors
                            ),
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {room.provenance.reason}
                      </Text>
                      {room.sourceLabel ? (
                        <Text
                          style={[styles.evidenceText, { color: Colors.sub }]}
                          numberOfLines={2}
                        >
                          {room.sourceLabel}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[styles.valueShell, { borderColor: lineColor }]}
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
                        keyboardType='decimal-pad'
                        placeholder='—'
                        placeholderTextColor={Colors.sub}
                        style={[styles.valueInput, { color: Colors.text }]}
                      />
                      <Text style={[styles.unitText, { color: Colors.sub }]}>
                        sqft
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {hasReadingIssues ? (
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>
                  Could not read clearly — enter manually
                </Text>
                {lowConfidence.map(f => {
                  const meta = quickMeasurementFieldMeta(f.field);
                  return (
                    <Text
                      key={`low-${f.field}`}
                      style={[styles.calloutLine, { color: Colors.sub }]}
                    >
                      {meta.label}: read {f.value} {meta.unit}, confidence too
                      low
                    </Text>
                  );
                })}
                {unreadable.map((f, idx) => {
                  const meta = quickMeasurementFieldMeta(f.field);
                  return (
                    <Text
                      key={`unread-${f.field}-${idx}`}
                      style={[styles.calloutLine, { color: Colors.sub }]}
                    >
                      {meta.label !== f.field ? meta.label : f.field}:{' '}
                      {f.reason}
                    </Text>
                  );
                })}
              </View>
            ) : null}

            {scopeDetections.length ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors.sub }]}>
                  Suggested scope
                </Text>
                {scopeDetections.map(d => {
                  const statusLines = scopeTakeoffStatusLines({
                    itemId: d.itemId,
                    evidence: d.evidence,
                    hasRoofQuantity,
                    assumptions: takeoff.assumptions,
                    hasPlanFloorAreas,
                  });
                  return (
                    <TouchableOpacity
                      key={d.itemId}
                      style={[styles.row, { borderBottomColor: lineColor }]}
                      onPress={() =>
                        setScopeChecked(prev => ({
                          ...prev,
                          [d.itemId]: !prev[d.itemId],
                        }))
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          scopeChecked[d.itemId] ? 'checkbox' : 'square-outline'
                        }
                        size={22}
                        color={scopeChecked[d.itemId] ? '#22c55e' : Colors.sub}
                        style={styles.checkbox}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[styles.rowLabel, { color: Colors.text }]}
                          numberOfLines={1}
                        >
                          {d.label || d.itemId}
                        </Text>
                        {statusLines.map(line => (
                          <Text
                            key={`${d.itemId}-${line}`}
                            style={[styles.evidenceText, { color: Colors.sub }]}
                            numberOfLines={2}
                          >
                            {line}
                          </Text>
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

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
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: { marginRight: 2 },
  rowLabelLine: { marginBottom: 3 },
  rowLabel: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  provenanceBadge: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
    marginBottom: 3,
  },
  provenanceBadgeText: { fontSize: 9.5, fontWeight: '800' },
  conflictText: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '600',
    color: '#d97706',
  },
  evidenceText: { fontSize: 11.5, marginTop: 3, lineHeight: 17 },
  valueShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 5,
    minWidth: 116,
    marginTop: 1,
  },
  valueInput: {
    fontSize: 14.5,
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'right',
    padding: 0,
  },
  unitText: { fontSize: 11.5, fontWeight: '600' },
  emptyText: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  roomHint: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  reconcileCard: {
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reconcileTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  reconcileBlockTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  reconcileLine: { fontSize: 12, lineHeight: 17, marginBottom: 1 },
  reconcileStatus: { fontSize: 12.5, fontWeight: '700', marginTop: 3 },
  reconcileHint: { fontSize: 11.5, lineHeight: 16, marginTop: 10 },
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
  concreteSummaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  concreteSummaryRow: { gap: 2 },
  concreteSummaryLabel: { fontSize: 12, fontWeight: '700' },
  concreteSummaryValue: { fontSize: 15, fontWeight: '800' },
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
