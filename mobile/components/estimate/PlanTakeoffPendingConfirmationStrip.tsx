import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ConfirmScopeChip } from '@/components/estimate/ConfirmScopeChip';
import { aiScopeConfirmNumericKeyboardProps } from '@/constants/inputKeyboardPresets';
import {
  confirmPendingPlanConfirmationRead,
  conflictChooserLowConfidenceAcceptedLine,
  emptyPlanTakeoffReadingDisplay,
  formatPlanTakeoffQuantity,
  isPendingPlanReadConfirmed,
  pendingPlanConfirmationReads,
  resolveHvacPendingPlanConfirmationReads,
  shortPlanTakeoffHelper,
  unconfirmPendingPlanConfirmationRead,
  type PendingPlanConfirmationRead,
} from '@/utils/planMeasurementConflictUi';
import { applyHvacScopeSelectionForConfirmedField } from '@/utils/qmScopePanels/simpleTradeRemodel';
import { HVAC_PLAN_REVIEW_CANONICAL_KEYS } from '@/utils/subcontractorTrade/hvacPlanConvergence';

const SELECTED_GREEN = '#34d399';

export function PlanTakeoffPendingConfirmationStrip({
  measurements,
  setMeasurements,
  allowedFields,
  tradeKey,
  darkMode,
  captionColor,
  onPlanReadConfirmed,
}: {
  measurements: Record<string, unknown>;
  setMeasurements: React.Dispatch<
    React.SetStateAction<Record<string, unknown>>
  >;
  allowedFields?: Set<string>;
  tradeKey?: string | null;
  darkMode: boolean;
  captionColor: string;
  onPlanReadConfirmed?: (field: string) => void;
}) {
  const commitPlanReadConfirmation = (
    field: string,
    value: number,
    confirmed: boolean
  ) => {
    setMeasurements(prev => {
      const base = confirmed
        ? confirmPendingPlanConfirmationRead(prev, field, value)
        : unconfirmPendingPlanConfirmationRead(prev, field, value);
      return confirmed
        ? applyHvacScopeSelectionForConfirmedField(base, field)
        : base;
    });
    if (confirmed) {
      onPlanReadConfirmed?.(field);
    }
  };
  const [trackedReads, setTrackedReads] = useState<
    PendingPlanConfirmationRead[]
  >([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const pending = useMemo(() => {
    const effectiveTradeKey =
      tradeKey ||
      (typeof measurements.planImportTradeKey === 'string'
        ? measurements.planImportTradeKey
        : null);
    const isHvacPlanImport =
      effectiveTradeKey === 'hvac' ||
      (allowedFields &&
        HVAC_PLAN_REVIEW_CANONICAL_KEYS.some(key => allowedFields.has(key)));
    if (isHvacPlanImport) {
      return resolveHvacPendingPlanConfirmationReads(measurements);
    }
    return pendingPlanConfirmationReads(measurements, allowedFields);
  }, [measurements, allowedFields, tradeKey]);
  const displayReads = useMemo(() => {
    const byField = new Map<string, PendingPlanConfirmationRead>();
    for (const read of trackedReads) {
      byField.set(read.field, read);
    }
    for (const read of pending) {
      byField.set(read.field, read);
    }
    return Array.from(byField.values());
  }, [pending, trackedReads]);

  useEffect(() => {
    if (!pending.length) return;
    setTrackedReads(prev => {
      const byField = new Map(prev.map(read => [read.field, read]));
      for (const read of pending) {
        byField.set(read.field, read);
      }
      return Array.from(byField.values());
    });
  }, [pending]);

  const allConfirmed =
    displayReads.length > 0 &&
    displayReads.every(read =>
      isPendingPlanReadConfirmed(measurements, read.field)
    );

  if (!displayReads.length || allConfirmed) return null;

  const panelBorder = darkMode
    ? 'rgba(148,163,184,0.28)'
    : 'rgba(100,116,139,0.24)';
  const panelBg = darkMode ? '#252527' : '#f1f5f9';
  const inputBg = darkMode ? 'rgba(255,255,255,0.05)' : '#ffffff';
  const titleColor = darkMode ? '#f8fafc' : '#0f172a';

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Needs review</Text>
      <Text style={[styles.title, { color: titleColor }]}>
        Unverified plan reads
      </Text>
      <Text style={[styles.hint, { color: captionColor }]}>
        {displayReads.length === 1
          ? 'One quantity from plan takeoff still needs confirmation.'
          : `${displayReads.length} quantities from plan takeoff still need confirmation.`}{' '}
        Accept each count below or edit it in Quick measurements.
      </Text>
      <View style={styles.cardList}>
        {displayReads.map(reading => {
          const confirmed = isPendingPlanReadConfirmed(
            measurements,
            reading.field
          );
          const editedValue =
            editValues[reading.field] == null
              ? null
              : Number(editValues[reading.field]);
          const displayValue =
            editedValue != null &&
            Number.isFinite(editedValue) &&
            editedValue > 0
              ? editedValue
              : reading.value;
          const hasQuantity = displayValue > 0;
          const editing = editingField === reading.field;
          const emptyDisplay = emptyPlanTakeoffReadingDisplay(reading.field);
          const unitHint = formatPlanTakeoffQuantity(reading.field, 1)
            .replace(/^1\s*/, '')
            .replace(/^1/, '');
          return (
            <View
              key={reading.field}
              style={[
                styles.card,
                { borderColor: panelBorder, backgroundColor: panelBg },
              ]}
            >
              <Text style={[styles.itemTitle, { color: titleColor }]}>
                {reading.label}
              </Text>
              {shortPlanTakeoffHelper(reading.subtext) ? (
                <Text style={[styles.itemSubtext, { color: captionColor }]}>
                  {shortPlanTakeoffHelper(reading.subtext)}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.itemHint,
                  { color: confirmed ? SELECTED_GREEN : '#fbbf24' },
                ]}
              >
                {confirmed && hasQuantity
                  ? conflictChooserLowConfidenceAcceptedLine(
                      reading.field,
                      displayValue
                    )
                  : hasQuantity
                    ? 'Needs manual confirmation'
                    : emptyDisplay.statusLine}
              </Text>
              {hasQuantity ? (
                <ConfirmScopeChip
                  selected={confirmed}
                  label={formatPlanTakeoffQuantity(reading.field, displayValue)}
                  subtitle='Low-confidence plan read'
                  darkMode={darkMode}
                  onPress={() => {
                    commitPlanReadConfirmation(
                      reading.field,
                      displayValue,
                      !confirmed
                    );
                  }}
                />
              ) : (
                <ConfirmScopeChip
                  selected={false}
                  label={emptyDisplay.chipLabel}
                  subtitle={emptyDisplay.chipSubtitle}
                  darkMode={darkMode}
                  onPress={() => {
                    setEditingField(reading.field);
                    setEditValues(prev => ({
                      ...prev,
                      [reading.field]: prev[reading.field] ?? '',
                    }));
                  }}
                />
              )}
              <TouchableOpacity
                onPress={() => {
                  setEditingField(editing ? null : reading.field);
                  if (!editing) {
                    setEditValues(prev => ({
                      ...prev,
                      [reading.field]: String(displayValue),
                    }));
                  }
                }}
                activeOpacity={0.75}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>
                  {editing ? 'Done editing' : 'Edit quantity'}
                </Text>
              </TouchableOpacity>
              {editing ? (
                <View
                  style={[
                    styles.editShell,
                    {
                      borderColor: panelBorder,
                      backgroundColor: inputBg,
                    },
                  ]}
                >
                  <TextInput
                    value={
                      editValues[reading.field] ?? String(displayValue)
                    }
                    autoFocus
                    selectTextOnFocus
                    returnKeyType='done'
                    onSubmitEditing={() => setEditingField(null)}
                    onChangeText={next => {
                      setEditValues(prev => ({
                        ...prev,
                        [reading.field]: next,
                      }));
                      const value = Number(next);
                      if (Number.isFinite(value) && value > 0) {
                        commitPlanReadConfirmation(reading.field, value, true);
                      }
                    }}
                    {...aiScopeConfirmNumericKeyboardProps}
                    keyboardType='decimal-pad'
                    style={[
                      styles.editInput,
                      { color: darkMode ? '#f8fafc' : '#0f172a' },
                    ]}
                  />
                  <Text style={[styles.editUnit, { color: captionColor }]}>
                    {formatPlanTakeoffQuantity(reading.field, 1)
                      .replace(/^1\s*/, '')
                      .replace(/^1/, '')}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  eyebrow: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
  },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  cardList: { gap: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  itemSubtext: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  itemHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
    fontWeight: '600',
  },
  editButton: {
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  editButtonText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },
  editShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 8,
    textAlign: 'center',
  },
  editUnit: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
});
