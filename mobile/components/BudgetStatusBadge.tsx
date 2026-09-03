import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Variant = 'over' | 'onTrack' | 'neutral';

type Props = {
  variant: Variant;
  label?: string;
};

const VARIANT_STYLES: Record<
  Variant,
  { bg: string; border: string; color: string; defaultLabel: string }
> = {
  over: {
    bg: 'rgba(239, 68, 68, 0.16)',
    border: 'rgba(239, 68, 68, 0.38)',
    color: '#f87171',
    defaultLabel: 'Over budget',
  },
  onTrack: {
    bg: 'rgba(34, 197, 94, 0.14)',
    border: 'rgba(34, 197, 94, 0.32)',
    color: '#4ade80',
    defaultLabel: 'On track',
  },
  neutral: {
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.22)',
    color: '#94a3b8',
    defaultLabel: 'No spend yet',
  },
};

export default function BudgetStatusBadge({ variant, label }: Props) {
  const tone = VARIANT_STYLES[variant];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.text, { color: tone.color }]}>{label ?? tone.defaultLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
});
