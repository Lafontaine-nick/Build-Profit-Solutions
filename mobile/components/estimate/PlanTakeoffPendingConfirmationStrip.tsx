import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ConfirmScopeChip } from '@/components/estimate/ConfirmScopeChip';
import {
  confirmPendingPlanConfirmationRead,
  conflictChooserLowConfidenceAcceptedLine,
  formatPlanTakeoffQuantity,
  isPendingPlanReadConfirmed,
  pendingPlanConfirmationReads,
  shortPlanTakeoffHelper,
  unconfirmPendingPlanConfirmationRead,
  type PendingPlanConfirmationRead,
} from '@/utils/planMeasurementConflictUi';

const SELECTED_GREEN = '#34d399';

export function PlanTakeoffPendingConfirmationStrip({
  measurements,
  setMeasurements,
  allowedFields,
  darkMode,
  captionColor,
}: {
  measurements: Record<string, unknown>;
  setMeasurements: React.Dispatch<
    React.SetStateAction<Record<string, unknown>>
  >;
  allowedFields?: Set<string>;
  darkMode: boolean;
  captionColor: string;
}) {
  const pending = useMemo(
    () => pendingPlanConfirmationReads(measurements, allowedFields),
    [measurements, allowedFields]
  );
  const [trackedReads, setTrackedReads] = useState<
    PendingPlanConfirmationRead[]
  >([]);

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
    trackedReads.length > 0 &&
    trackedReads.every(read =>
      isPendingPlanReadConfirmed(measurements, read.field)
    );

  if (!trackedReads.length || allConfirmed) return null;

  const panelBorder = darkMode
    ? 'rgba(148,163,184,0.28)'
    : 'rgba(100,116,139,0.24)';
  const panelBg = darkMode
    ? 'rgba(148,163,184,0.06)'
    : 'rgba(148,163,184,0.05)';
  const titleColor = darkMode ? '#f8fafc' : '#0f172a';

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Needs review</Text>
      <Text style={[styles.title, { color: titleColor }]}>
        Unverified plan reads
      </Text>
      <Text style={[styles.hint, { color: captionColor }]}>
        {trackedReads.length === 1
          ? 'One quantity from plan takeoff still needs confirmation.'
          : `${trackedReads.length} quantities from plan takeoff still need confirmation.`}{' '}
        Accept each count below or edit it in Quick measurements.
      </Text>
      <View style={styles.cardList}>
        {trackedReads.map(reading => {
          const confirmed = isPendingPlanReadConfirmed(
            measurements,
            reading.field
          );
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
                {confirmed
                  ? conflictChooserLowConfidenceAcceptedLine(
                      reading.field,
                      reading.value
                    )
                  : 'Needs manual confirmation'}
              </Text>
              <ConfirmScopeChip
                selected={confirmed}
                label={formatPlanTakeoffQuantity(reading.field, reading.value)}
                subtitle='Low-confidence plan read'
                darkMode={darkMode}
                onPress={() => {
                  setMeasurements(prev =>
                    confirmed
                      ? unconfirmPendingPlanConfirmationRead(
                          prev,
                          reading.field,
                          reading.value
                        )
                      : confirmPendingPlanConfirmationRead(
                          prev,
                          reading.field,
                          reading.value
                        )
                  );
                }}
              />
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
});
