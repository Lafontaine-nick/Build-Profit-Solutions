import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { aiScopeConfirmNumericKeyboardProps } from '@/constants/inputKeyboardPresets';
import { ConfirmScopeChip } from '@/components/estimate/ConfirmScopeChip';
import type {
  PlanLowConfidenceField,
  PlanUnreadableField,
} from '@/utils/estimateAiDraft';
import {
  conflictChooserLowConfidenceAcceptedLine,
  conflictFieldDisplay,
  emptyPlanTakeoffReadingDisplay,
  formatPlanTakeoffQuantity,
  shortPlanTakeoffHelper,
} from '@/utils/planMeasurementConflictUi';
import { measurementDisplayLabel } from '@/utils/planTakeoffReviewUi';
import { quickMeasurementFieldMeta } from '@/utils/scopeQuickMeasurements';

const SELECTED_GREEN = '#34d399';
const COLLAPSE_THRESHOLD = 3; // hide/show toggle only — list starts expanded

export function PlanTakeoffLowConfidenceChooser({
  lowConfidence,
  unreadable,
  accepted,
  onToggleAccept,
  onEditValue,
  includeEmptyReadings = false,
  darkMode,
  captionColor,
}: {
  lowConfidence: PlanLowConfidenceField[];
  unreadable: PlanUnreadableField[];
  accepted: Record<string, boolean>;
  onToggleAccept: (field: string, value: number) => void;
  onEditValue?: (field: string, value: string) => void;
  includeEmptyReadings?: boolean;
  darkMode: boolean;
  captionColor: string;
}) {
  const visibleLowConfidence = includeEmptyReadings
    ? lowConfidence.filter(reading => String(reading.field || '').trim())
    : lowConfidence.filter(reading => {
        const field = String(reading.field || '').trim();
        const value = Number(reading.value);
        return Boolean(field) && value > 0;
      });
  const total = visibleLowConfidence.length + unreadable.length;
  const [expanded, setExpanded] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  if (!total) return null;

  const panelBorder = darkMode
    ? 'rgba(148,163,184,0.28)'
    : 'rgba(100,116,139,0.24)';
  const panelBg = darkMode ? '#252527' : '#f1f5f9';
  const inputBg = darkMode ? 'rgba(255,255,255,0.05)' : '#ffffff';
  const titleColor = darkMode ? '#f8fafc' : '#0f172a';

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Needs review</Text>
      <Text style={[styles.sectionTitle, { color: titleColor }]}>
        Unverified plan reads
      </Text>
      <Text style={[styles.sectionHint, { color: captionColor }]}>
        {total === 1
          ? 'One quantity needs confirmation before it can fill the bid.'
          : `${total} quantities need confirmation before they can fill the bid.`}{' '}
        Accept a suggested count or enter it later in Confirm Scope.
      </Text>
      {total > COLLAPSE_THRESHOLD ? (
        <TouchableOpacity
          onPress={() => setExpanded(value => !value)}
          activeOpacity={0.75}
          style={[
            styles.collapseTrigger,
            { borderColor: panelBorder, backgroundColor: panelBg },
          ]}
        >
          <Text style={[styles.collapseText, { color: titleColor }]}>
            {expanded
              ? `Hide ${total} unverified quantities`
              : `Show ${total} unverified quantities`}
          </Text>
        </TouchableOpacity>
      ) : null}
      {expanded ? (
        <View style={styles.cardList}>
          {visibleLowConfidence.map(reading => {
            const field = String(reading.field || '').trim();
            const value = Number(reading.value);
            if (!field) return null;
            if (!(value > 0) && !includeEmptyReadings) return null;
            const { label, subtext } = conflictFieldDisplay(field);
            const confirmed = Boolean(accepted[field]);
            const editedValue =
              editValues[field] == null ? null : Number(editValues[field]);
            const displayValue =
              editedValue != null &&
              Number.isFinite(editedValue) &&
              editedValue > 0
                ? editedValue
                : value;
            const hasQuantity = displayValue > 0;
            const editing = editingField === field;
            const emptyDisplay = emptyPlanTakeoffReadingDisplay(field);
            const unitHint = formatPlanTakeoffQuantity(field, 1)
              .replace(/^1\s*/, '')
              .replace(/^1/, '');
            return (
              <View
                key={`low-${field}`}
                style={[
                  styles.card,
                  { borderColor: panelBorder, backgroundColor: panelBg },
                ]}
              >
                <Text style={[styles.itemTitle, { color: titleColor }]}>
                  {label}
                </Text>
                {shortPlanTakeoffHelper(subtext) ? (
                  <Text style={[styles.itemSubtext, { color: captionColor }]}>
                    {shortPlanTakeoffHelper(subtext)}
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
                        field,
                        displayValue
                      )
                    : hasQuantity
                      ? 'Needs manual confirmation'
                      : emptyDisplay.statusLine}
                </Text>
                {hasQuantity ? (
                  <ConfirmScopeChip
                    selected={confirmed}
                    label={formatPlanTakeoffQuantity(field, displayValue)}
                    subtitle='Low-confidence plan read'
                    darkMode={darkMode}
                    onPress={() => onToggleAccept(field, displayValue)}
                  />
                ) : (
                  <ConfirmScopeChip
                    selected={false}
                    label={emptyDisplay.chipLabel}
                    subtitle={emptyDisplay.chipSubtitle}
                    darkMode={darkMode}
                    onPress={() => {
                      setEditingField(field);
                      setEditValues(prev => ({
                        ...prev,
                        [field]: prev[field] ?? '',
                      }));
                    }}
                  />
                )}
                {onEditValue ? (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingField(editing ? null : field);
                        if (!editing) {
                          setEditValues(prev => ({
                            ...prev,
                            [field]: String(displayValue),
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
                          value={editValues[field] ?? String(displayValue)}
                          autoFocus
                          selectTextOnFocus
                          returnKeyType='done'
                          onSubmitEditing={() => setEditingField(null)}
                          onChangeText={next => {
                            setEditValues(prev => ({
                              ...prev,
                              [field]: next,
                            }));
                            onEditValue(field, next);
                          }}
                          {...aiScopeConfirmNumericKeyboardProps}
                          keyboardType='decimal-pad'
                          style={[
                            styles.editInput,
                            { color: darkMode ? '#f8fafc' : '#0f172a' },
                          ]}
                        />
                        <Text style={[styles.editUnit, { color: captionColor }]}>
                          {formatPlanTakeoffQuantity(field, 1)
                            .replace(/^1\s*/, '')
                            .replace(/^1/, '')}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            );
          })}
          {unreadable.map((field, idx) => {
            const key = String(field.field || '').trim();
            if (!key) return null;
            const meta = quickMeasurementFieldMeta(key);
            const label =
              meta.label !== key
                ? meta.label
                : measurementDisplayLabel(key, null).label;
            return (
              <View
                key={`unread-${key}-${idx}`}
                style={[
                  styles.card,
                  { borderColor: panelBorder, backgroundColor: panelBg },
                ]}
              >
                <Text style={[styles.itemTitle, { color: titleColor }]}>
                  {label}
                </Text>
                <Text style={[styles.itemHint, { color: '#fbbf24' }]}>
                  {field.reason || 'Not readable from the plan'}
                </Text>
                <Text style={[styles.manualNote, { color: captionColor }]}>
                  Enter manually in Confirm Scope.
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  eyebrow: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
  },
  sectionHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  collapseTrigger: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  collapseText: { fontSize: 13, fontWeight: '700' },
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
  manualNote: {
    fontSize: 11,
    lineHeight: 16,
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
