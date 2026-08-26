import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { hvacCardForMeasurementKey } from '@/utils/subcontractorTrade/hvacPlanConvergence';

export function PlanTakeoffHvacOptionalAddOns({
  showVentilationNotIncluded,
  darkMode,
  captionColor,
}: {
  showVentilationNotIncluded: boolean;
  darkMode: boolean;
  captionColor: string;
}) {
  if (!showVentilationNotIncluded) return null;

  const card = hvacCardForMeasurementKey('hvacVentilationCount');
  const panelBorder = darkMode
    ? 'rgba(148,163,184,0.28)'
    : 'rgba(100,116,139,0.24)';
  const panelBg = darkMode ? '#252527' : '#f1f5f9';
  const titleColor = darkMode ? '#f8fafc' : '#0f172a';

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Optional add-ons</Text>
      <Text style={[styles.title, { color: titleColor }]}>
        Not part of the base HVAC package
      </Text>
      <Text style={[styles.hint, { color: captionColor }]}>
        Add these only when the plans, notes, or bid explicitly include them.
      </Text>
      <View
        style={[
          styles.card,
          { borderColor: panelBorder, backgroundColor: panelBg },
        ]}
      >
        <Text style={[styles.itemTitle, { color: titleColor }]}>
          {card?.label || 'Whole-house ventilation'}
        </Text>
        {card?.helper ? (
          <Text style={[styles.itemSubtext, { color: captionColor }]}>
            {card.helper}
          </Text>
        ) : null}
        <Text style={[styles.itemStatus, { color: captionColor }]}>
          Not included · Not shown on plans
        </Text>
        <Text style={[styles.itemPrice, { color: titleColor }]}>$0</Text>
        <Text style={[styles.itemFootnote, { color: captionColor }]}>
          Tap Whole-house ventilation in Confirm Scope if this bid includes
          ERV/HRV equipment. 1 each = one whole-house unit — not bath exhaust
          fans.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  eyebrow: {
    color: '#94a3b8',
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
    marginBottom: 10,
  },
  itemStatus: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 8,
  },
  itemFootnote: {
    fontSize: 11,
    lineHeight: 16,
  },
});
