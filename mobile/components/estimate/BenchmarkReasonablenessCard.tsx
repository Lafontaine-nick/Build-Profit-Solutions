import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import type { BenchmarkReasonableness } from '@/utils/benchmarkEngine';
import type { ConfirmScopeAppliedPricingBreakdown } from '@/utils/benchmarkReasonablenessContext';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

type Props = {
  value: BenchmarkReasonableness;
  darkMode: boolean;
  /** Applied Confirm Scope dollars — total + material / labor / allowances. */
  appliedBreakdown?: ConfirmScopeAppliedPricingBreakdown | null;
};

const APP_GREEN = '#22c55e';

function formatWholeDollars(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

export default function BenchmarkReasonablenessCard({
  value,
  darkMode,
  appliedBreakdown = null,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const text = darkMode ? '#ffffff' : Colors.text;
  const muted = darkMode ? 'rgba(255,255,255,0.72)' : Colors.sub;
  const farOff =
    value.variancePercent != null && Math.abs(value.variancePercent) > 20;
  const verdictColor = farOff ? '#f59e0b' : APP_GREEN;

  const variance =
    value.variancePercent == null
      ? null
      : `${Math.abs(value.variancePercent).toFixed(0)}% ${
          value.variancePercent >= 0 ? 'above' : 'below'
        } planning baseline`;

  const cardStyle = [
    estimateFlowCardStyle(Colors, darkMode, { marginBottom: 14 }),
    styles.cardPad,
  ];

  const showBreakdown =
    appliedBreakdown != null &&
    appliedBreakdown.total > 0 &&
    (appliedBreakdown.material > 0 ||
      appliedBreakdown.labor > 0 ||
      appliedBreakdown.allowance > 0);

  return (
    <View style={cardStyle}>
      {showBreakdown ? (
        <>
          <Text style={[styles.label, { color: text }]}>Applied pricing</Text>
          <Text style={[styles.primary, { color: text }]} accessibilityRole="text">
            {formatWholeDollars(appliedBreakdown.total)}
          </Text>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownText, { color: muted }]}>
              Material {formatWholeDollars(appliedBreakdown.material)}
            </Text>
            <Text style={[styles.breakdownDot, { color: muted }]}>·</Text>
            <Text style={[styles.breakdownText, { color: muted }]}>
              Labor {formatWholeDollars(appliedBreakdown.labor)}
            </Text>
            <Text style={[styles.breakdownDot, { color: muted }]}>·</Text>
            <Text style={[styles.breakdownText, { color: muted }]}>
              Allowances {formatWholeDollars(appliedBreakdown.allowance)}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line }]} />
        </>
      ) : null}

      <Text style={[styles.label, { color: text }]}>Build cost / SF</Text>
      <Text style={[styles.primary, { color: text }]} accessibilityRole="text">
        {formatWholeDollars(value.currentPerLivingSf)}
        <Text style={[styles.primaryUnit, { color: muted }]}>/living SF</Text>
      </Text>

      {variance ? (
        <Text style={[styles.verdict, { color: verdictColor }]}>{variance}</Text>
      ) : null}

      <Pressable
        onPress={() => setDetailsOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsOpen }}
        accessibilityLabel={
          detailsOpen ? 'Hide benchmark comparisons' : 'Show Local, National, and planning baseline'
        }
        style={styles.detailsToggle}
      >
        <Text style={[styles.detailsToggleText, { color: text }]}>
          {detailsOpen ? 'Hide' : 'Compare'}
        </Text>
        <Ionicons
          name={detailsOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={text}
        />
      </Pressable>

      {detailsOpen ? (
        <View style={styles.detailsBlock}>
          <Text style={[styles.detailRow, { color: muted }]}>
            Local {formatWholeDollars(value.localDetachedMedianPerLivingSf)}
          </Text>
          <Text style={[styles.detailRow, { color: muted }]}>
            National {formatWholeDollars(value.nationalPerLivingSf)}
          </Text>
          <Text style={[styles.detailRow, { color: muted }]}>
            Planning baseline {formatWholeDollars(value.blendedPlanningPerLivingSf)}
          </Text>
          <Text style={[styles.disclaimer, { color: muted }]}>
            Comparison only — estimate values unchanged.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardPad: {
    paddingVertical: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primary: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  primaryUnit: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  breakdownText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  breakdownDot: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 14,
    marginBottom: 12,
  },
  verdict: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  detailsToggle: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  detailsToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsBlock: {
    marginTop: 8,
    gap: 3,
  },
  detailRow: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
    fontWeight: '400',
  },
});
