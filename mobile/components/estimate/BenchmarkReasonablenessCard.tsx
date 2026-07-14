import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BenchmarkReasonableness } from '@/utils/benchmarkEngine';

type Props = {
  value: BenchmarkReasonableness;
  darkMode: boolean;
};

export default function BenchmarkReasonablenessCard({ value, darkMode }: Props) {
  const text = darkMode ? '#f8fafc' : '#0f172a';
  const sub = darkMode ? '#94a3b8' : '#64748b';
  const variance = value.variancePercent == null
    ? 'No variance available'
    : `${Math.abs(value.variancePercent).toFixed(1)}% ${value.variancePercent >= 0 ? 'above' : 'below'} planning baseline`;
  return (
    <View style={[styles.wrap, { borderColor: darkMode ? '#334155' : '#cbd5e1' }]}>
      <Text style={[styles.title, { color: text }]}>Whole-estimate reasonableness</Text>
      <Text style={[styles.primary, { color: text }]}>
        ${value.currentPerLivingSf.toFixed(2)}/living SF
      </Text>
      <Text style={[styles.detail, { color: sub }]}>
        Local ${value.localDetachedMedianPerLivingSf.toFixed(2)} · National ${value.nationalPerLivingSf.toFixed(2)} · Planning baseline ${value.blendedPlanningPerLivingSf.toFixed(2)}
      </Text>
      <Text style={[styles.variance, { color: value.variancePercent != null && Math.abs(value.variancePercent) > 20 ? '#d97706' : '#0f766e' }]}>
        {variance}
      </Text>
      <Text style={[styles.disclaimer, { color: sub }]}>{value.disclaimer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginBottom: 14 },
  title: { fontSize: 13, fontWeight: '800' },
  primary: { fontSize: 20, fontWeight: '800', marginTop: 6 },
  detail: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  variance: { fontSize: 11, fontWeight: '800', marginTop: 7 },
  disclaimer: { fontSize: 10, lineHeight: 15, marginTop: 5 },
});
