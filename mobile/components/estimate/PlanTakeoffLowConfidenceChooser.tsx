import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConfirmScopeChip } from '@/components/estimate/ConfirmScopeChip';
import type {
  PlanLowConfidenceField,
  PlanUnreadableField,
} from '@/utils/estimateAiDraft';
import {
  conflictFieldDisplay,
  conflictChooserConfirmedLine,
  conflictChooserLowConfidenceAcceptedLine,
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
  darkMode,
  captionColor,
}: {
  lowConfidence: PlanLowConfidenceField[];
  unreadable: PlanUnreadableField[];
  accepted: Record<string, boolean>;
  onToggleAccept: (field: string, value: number) => void;
  darkMode: boolean;
  captionColor: string;
}) {
  const total = lowConfidence.length + unreadable.length;
  const [expanded, setExpanded] = useState(true);
  if (!total) return null;

  const panelBorder = darkMode
    ? 'rgba(148,163,184,0.28)'
    : 'rgba(100,116,139,0.24)';
  const panelBg = darkMode
    ? 'rgba(148,163,184,0.06)'
    : 'rgba(148,163,184,0.05)';
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
          {lowConfidence.map(reading => {
            const field = String(reading.field || '').trim();
            const value = Number(reading.value);
            if (!field || !(value > 0)) return null;
            const { label, subtext } = conflictFieldDisplay(field);
            const confirmed = Boolean(accepted[field]);
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
                  {confirmed
                    ? conflictChooserLowConfidenceAcceptedLine(field, value)
                    : 'Needs manual confirmation'}
                </Text>
                <ConfirmScopeChip
                  selected={confirmed}
                  label={formatPlanTakeoffQuantity(field, value)}
                  subtitle='Low-confidence plan read'
                  darkMode={darkMode}
                  onPress={() => onToggleAccept(field, value)}
                />
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
});
