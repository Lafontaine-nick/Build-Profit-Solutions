import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ConfirmScopeChip } from '@/components/estimate/ConfirmScopeChip';
import KeyboardPlainAccessory from '@/components/ui/KeyboardPlainAccessory';
import { KEYBOARD_ACCESSORY_IDS } from '@/constants/keyboard';
import { aiScopeConfirmNumericKeyboardProps } from '@/constants/inputKeyboardPresets';
import type { PlanMeasurementConflict } from '@/utils/estimateAiDraft';
import {
  applyPlanConflictChoices,
  availablePlanConflictChoice,
  conflictChooserConfirmedLine,
  conflictEvidenceSubtitle,
  conflictFieldLabel,
  formatPlanTakeoffQuantity,
  labeledConflictCandidates,
  parseManualConflictValue,
  planConflictChooserRowsKey,
  planTakeoffUnit,
  retainPlanTakeoffConflicts,
  togglePlanConflictChoice,
  type PlanConflictChoice,
} from '@/utils/planMeasurementConflictUi';

const SELECTED_GREEN = '#34d399';
const SELECTED_BG = 'rgba(52, 211, 153, 0.12)';

function deferConflictUiPatch(task: () => void) {
  const timer = setTimeout(task, 180);
  return timer;
}

export function PlanTakeoffConflictChooser({
  conflicts,
  choices,
  manualValues,
  onChoose,
  onManualChange,
  onManualSubmit,
  darkMode,
  captionColor,
  keepResolvedCards = false,
}: {
  conflicts: PlanMeasurementConflict[];
  choices: Record<string, PlanConflictChoice | undefined>;
  manualValues: Record<string, string>;
  onChoose: (field: string, choice: PlanConflictChoice | undefined) => void;
  onManualChange: (field: string, value: string) => void;
  onManualSubmit?: (field: string, value: string) => void;
  darkMode: boolean;
  captionColor: string;
  /** Keep confirmed cards mounted so Confirm Scope does not jump. */
  keepResolvedCards?: boolean;
}) {
  const [retained, setRetained] = useState<PlanMeasurementConflict[]>(conflicts);
  const [localChoices, setLocalChoices] = useState(choices);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [committed, setCommitted] = useState<Record<string, boolean>>({});
  const pendingRef = useRef<Record<string, PlanConflictChoice | undefined>>({});
  const onChooseRef = useRef(onChoose);
  const commitTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );
  onChooseRef.current = onChoose;

  useEffect(() => {
    setRetained(prev => {
      const next = keepResolvedCards
        ? retainPlanTakeoffConflicts(conflicts, prev)
        : conflicts;
      return planConflictChooserRowsKey(prev) === planConflictChooserRowsKey(next)
        ? prev
        : next;
    });
  }, [conflicts, keepResolvedCards]);

  useEffect(
    () => () => {
      for (const timer of Object.values(commitTimersRef.current)) {
        clearTimeout(timer);
      }
    },
    []
  );

  const visible = keepResolvedCards
    ? retainPlanTakeoffConflicts(conflicts, retained)
    : conflicts;

  const panelBorder = darkMode
    ? 'rgba(148,163,184,0.28)'
    : 'rgba(100,116,139,0.24)';
  const panelBg = darkMode
    ? 'rgba(148,163,184,0.06)'
    : 'rgba(148,163,184,0.05)';
  const chipBorder = darkMode ? '#52525b' : '#cbd5e1';
  const titleColor = darkMode ? '#f8fafc' : '#0f172a';

  if (!visible.length) return null;

  const choiceFor = (field: string) =>
    field in pendingRef.current ? pendingRef.current[field] : localChoices[field];

  const draftFor = (field: string) =>
    drafts[field] ?? manualValues[field] ?? '';

  const selectOption = (field: string, choice: PlanConflictChoice) => {
    const current = choiceFor(field);
    const next = togglePlanConflictChoice(current, choice);
    if (current === 'manual' && next !== 'manual') {
      Keyboard.dismiss();
    }
    if (next !== 'manual') {
      setCommitted(prev => {
        if (!prev[field]) return prev;
        const nextCommitted = { ...prev };
        delete nextCommitted[field];
        return nextCommitted;
      });
    }
    pendingRef.current[field] = next;
    setLocalChoices(prev => {
      const copy = { ...prev };
      if (next == null) delete copy[field];
      else copy[field] = next;
      return copy;
    });
    if (commitTimersRef.current[field]) {
      clearTimeout(commitTimersRef.current[field]);
    }
    const scheduled = next;
    commitTimersRef.current[field] = deferConflictUiPatch(() => {
      if (pendingRef.current[field] !== scheduled) return;
      delete commitTimersRef.current[field];
      onChooseRef.current(field, scheduled);
    });
  };

  const submitManual = (field: string) => {
    const n = parseManualConflictValue(draftFor(field));
    if (n == null) {
      Alert.alert(
        'Enter the custom count',
        'Type a quantity, then tap Use this count.'
      );
      return;
    }
    const value = String(n);
    setDrafts(prev => ({ ...prev, [field]: value }));
    setCommitted(prev => ({ ...prev, [field]: true }));
    onManualChange(field, value);
    onManualSubmit?.(field, value);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.section}>
      <KeyboardPlainAccessory
        nativeID={KEYBOARD_ACCESSORY_IDS.aiScopeConfirmNumeric}
        backgroundColor={darkMode ? '#000000' : '#E8EDF5'}
      />
      <Text style={styles.eyebrow}>Confirm measurement</Text>
      <Text style={[styles.sectionTitle, { color: titleColor }]}>
        Conflicting plan takeoffs
      </Text>
      {visible.map(conflict => {
        const candidates = labeledConflictCandidates(conflict);
        const choice = availablePlanConflictChoice(
          choiceFor(conflict.field),
          candidates.map(candidate => candidate.value)
        );
        const label = conflictFieldLabel(conflict.field);
        const unit = planTakeoffUnit(conflict.field);
        const manualSelected = choice === 'manual';
        const entered = parseManualConflictValue(draftFor(conflict.field));
        const manualCommitted = Boolean(committed[conflict.field] && entered);
        const confirmedValue =
          typeof choice === 'number'
            ? choice
            : manualSelected && manualCommitted && entered != null
              ? entered
              : null;
        const confirmed = confirmedValue != null;
        return (
          <View
            key={`conflict-${conflict.field}`}
            style={[
              styles.card,
              { borderColor: panelBorder, backgroundColor: panelBg },
            ]}
          >
            <Text style={[styles.itemTitle, { color: titleColor }]}>{label}</Text>
            <Text
              style={[
                styles.itemHint,
                { color: confirmed ? SELECTED_GREEN : '#fbbf24' },
              ]}
            >
              {confirmed
                ? conflictChooserConfirmedLine(conflict.field, confirmedValue)
                : conflictEvidenceSubtitle(conflict)}
            </Text>
            <View style={styles.optionWrap}>
              {candidates.map(candidate => {
                const selected = choice === candidate.value;
                return (
                  <ConfirmScopeChip
                    key={`${conflict.field}-${candidate.value}`}
                    selected={selected}
                    label={formatPlanTakeoffQuantity(
                      conflict.field,
                      candidate.value
                    )}
                    subtitle={candidate.sourceLabel}
                    darkMode={darkMode}
                    onPress={() =>
                      selectOption(conflict.field, candidate.value)
                    }
                  />
                );
              })}
              <ConfirmScopeChip
                selected={manualSelected}
                label={
                  manualSelected && manualCommitted && entered != null
                    ? formatPlanTakeoffQuantity(conflict.field, entered)
                    : 'Enter manually'
                }
                subtitle={
                  manualSelected && manualCommitted ? 'Entered' : null
                }
                darkMode={darkMode}
                onPress={() => selectOption(conflict.field, 'manual')}
              />
            </View>
            {manualSelected && !manualCommitted ? (
              <View style={styles.manualWrap}>
                <View
                  style={[
                    styles.manualInputRow,
                    {
                      borderColor: darkMode
                        ? 'rgba(255,255,255,0.16)'
                        : chipBorder,
                      backgroundColor: darkMode ? '#111111' : '#ffffff',
                    },
                  ]}
                >
                  <TextInput
                    value={draftFor(conflict.field)}
                    onChangeText={value => {
                      setDrafts(prev => ({ ...prev, [conflict.field]: value }));
                      setCommitted(prev => {
                        if (!prev[conflict.field]) return prev;
                        const nextCommitted = { ...prev };
                        delete nextCommitted[conflict.field];
                        return nextCommitted;
                      });
                      onManualChange(conflict.field, value);
                    }}
                    onSubmitEditing={() => submitManual(conflict.field)}
                    autoFocus
                    {...aiScopeConfirmNumericKeyboardProps}
                    returnKeyType='done'
                    blurOnSubmit
                    keyboardType='decimal-pad'
                    placeholder='Enter'
                    placeholderTextColor={captionColor}
                    style={[styles.manualInput, { color: titleColor }]}
                  />
                  <Text style={[styles.manualUnit, { color: captionColor }]}>
                    {unit}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => submitManual(conflict.field)}
                  hitSlop={8}
                  activeOpacity={0.7}
                  style={[
                    styles.useCount,
                    {
                      borderColor: SELECTED_GREEN,
                      backgroundColor: SELECTED_BG,
                    },
                  ]}
                >
                  <Text style={styles.useCountText}>Use this count</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export { applyPlanConflictChoices };

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  eyebrow: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 12,
    fontWeight: '600',
  },
  optionWrap: { gap: 8 },
  option: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  optionQty: { fontSize: 14, fontWeight: '700' },
  optionSource: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  manualWrap: { marginTop: 10 },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  manualInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  manualUnit: { fontSize: 11, fontWeight: '700', marginLeft: 6 },
  useCount: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  useCountText: { fontWeight: '700', fontSize: 13, color: SELECTED_GREEN },
});
