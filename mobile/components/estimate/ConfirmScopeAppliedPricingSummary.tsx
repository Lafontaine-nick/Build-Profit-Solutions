import React, { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import type { ConfirmScopeAppliedPricingBreakdown } from '@/utils/benchmarkReasonablenessContext';
import { formatBuildCostPerLivingSf } from '@/utils/benchmarkReasonablenessContext';
import { formatPlanningMoney } from '@/utils/estimateAiDraft';
import { formatAppliedDisplayMoney } from '@/utils/suggestedPricingCardUi';

type Props = {
  breakdown: ConfirmScopeAppliedPricingBreakdown;
  buildCostPerLivingSf?: number | null;
  /** Plan export uses /living SF; room remodels use /SF when bath floor is the basis. */
  buildCostUnitSuffix?: 'living SF' | 'SF';
  darkMode: boolean;
  /** Footer uses full width left align — same as plan export card. */
  align?: 'left' | 'center';
  /** Optional slot between applied breakdown and build cost / SF (e.g. itemize list). */
  middleContent?: ReactNode;
  /** Tappable hint when scopes still need confirmation before pricing (e.g. toilet, paint). */
  scopeConfirmDisclaimer?: { label: string; onPress: () => void } | null;
};

export default function ConfirmScopeAppliedPricingSummary({
  breakdown,
  buildCostPerLivingSf = null,
  buildCostUnitSuffix = 'living SF',
  darkMode,
  align = 'left',
  middleContent = null,
  scopeConfirmDisclaimer = null,
}: Props) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const text = darkMode ? '#ffffff' : Colors.text;
  const muted = darkMode ? 'rgba(255,255,255,0.72)' : Colors.sub;

  const showApplied =
    breakdown.total > 0 &&
    (breakdown.material > 0 || breakdown.labor > 0 || breakdown.allowance > 0);
  const showBuildCost = buildCostPerLivingSf != null && buildCostPerLivingSf > 0;

  if (!showApplied && !showBuildCost) return null;

  return (
    <View style={[styles.root, align === 'center' ? styles.center : null]}>
      {showApplied ? (
        <>
          <Text style={[styles.label, { color: text }]}>Selected pricing</Text>
          <Text style={[styles.primary, { color: text }]} accessibilityRole="text">
            {formatAppliedDisplayMoney(breakdown.total)}
          </Text>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownText, { color: muted }]}>
              Material {formatPlanningMoney(breakdown.material)}
            </Text>
            <Text style={[styles.breakdownDot, { color: muted }]}>·</Text>
            <Text style={[styles.breakdownText, { color: muted }]}>
              Labor {formatPlanningMoney(breakdown.labor)}
            </Text>
            <Text style={[styles.breakdownDot, { color: muted }]}>·</Text>
            <Text style={[styles.breakdownText, { color: muted }]}>
              Allowances {formatPlanningMoney(breakdown.allowance)}
            </Text>
          </View>
        </>
      ) : null}

      {middleContent}

      {scopeConfirmDisclaimer ? (
        <Pressable
          onPress={scopeConfirmDisclaimer.onPress}
          accessibilityRole="button"
          accessibilityLabel={scopeConfirmDisclaimer.label}
          style={[styles.scopeConfirmLink, align === 'center' ? styles.scopeConfirmLinkCenter : null]}
        >
          <Text style={[styles.scopeConfirmLinkText, { color: '#fbbf24' }]}>
            {scopeConfirmDisclaimer.label}
          </Text>
        </Pressable>
      ) : null}

      {showApplied && showBuildCost ? (
        <View
          style={[
            styles.divider,
            { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line },
          ]}
        />
      ) : null}

      {showBuildCost ? (
        <>
          <Text style={[styles.label, { color: text }]}>Build cost / SF</Text>
          <Text style={[styles.primary, { color: text }]} accessibilityRole="text">
            {formatBuildCostPerLivingSf(buildCostPerLivingSf)}
            <Text style={[styles.primaryUnit, { color: muted }]}>/{buildCostUnitSuffix}</Text>
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingBottom: 4,
  },
  center: {
    alignItems: 'center',
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
  scopeConfirmLink: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  scopeConfirmLinkCenter: {
    alignSelf: 'center',
  },
  scopeConfirmLinkText: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 14,
    marginBottom: 12,
  },
});
