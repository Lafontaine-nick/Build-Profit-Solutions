import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

type PayType = '1099' | 'w2';

type Props = {
  value: PayType;
  onChange: (value: PayType) => void;
  darkMode?: boolean;
  textColor?: string;
  lineColor?: string;
};

const OPTIONS: { value: PayType; title: string; caption: string }[] = [
  { value: '1099', title: '1099', caption: 'Contractor' },
  { value: 'w2', title: 'W-2', caption: 'Employee' },
];

/** 1099 goes to Subcontractor Payments. W-2 goes to W-2 Payments. */
export default function LaborPayTypeChoice({
  value,
  onChange,
  darkMode = true,
  textColor = '#FFFFFF',
  lineColor = 'rgba(148, 163, 184, 0.35)',
}: Props) {
  const helperColor = darkMode ? '#d7e1f0' : '#64748b';
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: textColor }]}>Paid as</Text>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (active) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(option.value);
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
              <Text
                style={[
                  styles.caption,
                  { color: active ? 'rgba(45, 204, 154, 0.85)' : helperColor },
                ]}
              >
                {option.caption}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.helper, { color: helperColor }]}>
        {value === 'w2' ? 'Counts toward W-2 Payments in Tax Center.' : 'Counts toward Subcontractor Payments in Tax Center.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.25 },
  row: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700' },
  caption: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  helper: { fontSize: 12, lineHeight: 16, marginTop: 8 },
});
