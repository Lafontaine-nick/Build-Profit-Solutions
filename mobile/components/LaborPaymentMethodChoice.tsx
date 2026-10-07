import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { LaborPaymentMethod } from '@/src/lib/taxCenter';

type Props = {
  value: LaborPaymentMethod | null;
  onChange: (value: LaborPaymentMethod | null) => void;
  darkMode?: boolean;
  textColor?: string;
  lineColor?: string;
};

const OPTIONS: { value: LaborPaymentMethod; title: string }[] = [
  { value: 'check', title: 'Check' },
  { value: 'cash', title: 'Cash' },
  { value: 'card', title: 'Card' },
  { value: 'bank', title: 'Bank' },
];

/** Check, cash, and bank count toward a 1099. Card payments are reported by the card company. */
export default function LaborPaymentMethodChoice({
  value,
  onChange,
  darkMode = true,
  textColor = '#FFFFFF',
  lineColor = 'rgba(148, 163, 184, 0.35)',
}: Props) {
  const helperColor = darkMode ? '#d7e1f0' : '#64748b';
  const helper =
    value === 'card'
      ? 'The card company usually reports this. It stays off their 1099.'
      : value
        ? 'Counts toward their 1099.'
        : 'Check, cash, and bank count toward their 1099. Card usually does not.';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: textColor }]}>Paid with</Text>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(active ? null : option.value);
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: active ? '#2dcc9a' : lineColor,
                  backgroundColor: active ? 'rgba(45, 204, 154, 0.16)' : darkMode ? '#3A3A3C' : '#FFFFFF',
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text style={[styles.title, { color: active ? '#2dcc9a' : darkMode ? '#e2e8f0' : textColor }]}>
                {option.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.helper, { color: helperColor }]}>{helper}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.25 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    width: '48%',
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  title: { fontSize: 15, fontWeight: '700' },
  helper: { fontSize: 12, lineHeight: 17, marginTop: 8 },
});