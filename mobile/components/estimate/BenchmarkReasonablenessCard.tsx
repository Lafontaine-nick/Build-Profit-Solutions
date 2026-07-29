import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import type { BenchmarkReasonableness } from '@/utils/benchmarkEngine';
import type { ConfirmScopeAppliedPricingBreakdown, ConfirmScopeAppliedPricingLine } from '@/utils/benchmarkReasonablenessContext';
import ConfirmScopeAppliedPricingSummary from '@/components/estimate/ConfirmScopeAppliedPricingSummary';
import { formatDraftMoney } from '@/utils/estimateAiDraft';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

type Props = {
  /** Full benchmark payload — enables variance + Compare. */
  value?: BenchmarkReasonableness | null;
  /** Fallback $/living SF when benchmark API has not returned yet. */
  buildCostPerLivingSf?: number | null;
  buildCostUnitSuffix?: 'living SF' | 'SF';
  darkMode: boolean;
  /** Applied Confirm Scope dollars — total + material / labor / allowances. */
  appliedBreakdown?: ConfirmScopeAppliedPricingBreakdown | null;
  /** Per-scope Applied lines — same totals as scope cards. */
  appliedLines?: ConfirmScopeAppliedPricingLine[];
  /** Card chrome — footer uses tighter margins. */
  embedded?: boolean;
  /** Whole-home builds only — hide $/SF for remodels and trade jobs. */
  showBuildCostPerSf?: boolean;
  scopeConfirmDisclaimer?: { label: string; onPress: () => void } | null;
};

const APP_GREEN = '#22c55e';

/** Planning $/SF comparisons — whole dollars is fine. */
function formatWholeDollars(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

export default function BenchmarkReasonablenessCard({
  value = null,
  buildCostPerLivingSf = null,
  buildCostUnitSuffix = 'living SF',
  darkMode,
  appliedBreakdown = null,
  appliedLines = [],
  embedded = false,
  showBuildCostPerSf = true,
  scopeConfirmDisclaimer = null,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [itemizeOpen, setItemizeOpen] = useState(false);
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const text = darkMode ? '#ffffff' : Colors.text;
  const muted = darkMode ? 'rgba(255,255,255,0.72)' : Colors.sub;
  const farOff =
    value?.variancePercent != null && Math.abs(value.variancePercent) > 20;
  const verdictColor = farOff ? '#f59e0b' : APP_GREEN;

  const variance =
    value?.variancePercent == null
      ? null
      : `${Math.abs(value.variancePercent).toFixed(0)}% ${
          value.variancePercent >= 0 ? 'above' : 'below'
        } planning baseline`;

  const cardStyle = [
    estimateFlowCardStyle(Colors, darkMode, { marginBottom: embedded ? 8 : 14 }),
    styles.cardPad,
  ];

  const resolvedPerLivingSf = showBuildCostPerSf
    ? value?.currentPerLivingSf ?? buildCostPerLivingSf ?? null
    : null;
  const showCompare =
    showBuildCostPerSf && value != null && value.blendedPlanningPerLivingSf > 0;

  const showBreakdown =
    appliedBreakdown != null &&
    appliedBreakdown.total > 0 &&
    (appliedBreakdown.material > 0 ||
      appliedBreakdown.labor > 0 ||
      appliedBreakdown.allowance > 0);

  if (!showBreakdown && !(resolvedPerLivingSf != null && resolvedPerLivingSf > 0)) {
    return null;
  }

  const itemizeBlock =
    showBreakdown && appliedLines.length > 0 ? (
      <>
        <Pressable
          onPress={() => setItemizeOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: itemizeOpen }}
          accessibilityLabel={itemizeOpen ? 'Hide applied scope list' : 'Show applied scope list'}
          style={[styles.detailsToggle, { marginTop: 10 }]}
        >
          <Text style={[styles.detailsToggleText, { color: text }]}>
            {itemizeOpen ? 'Hide scopes' : `Itemize (${appliedLines.length})`}
          </Text>
          <Ionicons
            name={itemizeOpen ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={text}
          />
        </Pressable>
        {itemizeOpen ? (
          <View style={[styles.detailsBlock, { marginTop: 6 }]}>
            {appliedLines.map((line) => (
              <Text key={line.itemId} style={[styles.detailRow, { color: muted }]}>
                {line.label} {formatDraftMoney(line.total)}
              </Text>
            ))}
            <Text style={[styles.disclaimer, { color: muted }]}>
              Sum of these lines matches Applied pricing above.
            </Text>
          </View>
        ) : null}
      </>
    ) : null;

  return (
    <View style={cardStyle}>
      <ConfirmScopeAppliedPricingSummary
        breakdown={
          appliedBreakdown ?? { material: 0, labor: 0, allowance: 0, total: 0 }
        }
        buildCostPerLivingSf={resolvedPerLivingSf}
        buildCostUnitSuffix={buildCostUnitSuffix}
        darkMode={darkMode}
        middleContent={itemizeBlock}
        scopeConfirmDisclaimer={scopeConfirmDisclaimer}
      />

      {showBuildCostPerSf && variance && value ? (
        <Text style={[styles.verdict, { color: verdictColor }]}>{variance}</Text>
      ) : null}

      {showCompare ? (
        <>
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
                Local {formatWholeDollars(value!.localDetachedMedianPerLivingSf)}
              </Text>
              <Text style={[styles.detailRow, { color: muted }]}>
                National {formatWholeDollars(value!.nationalPerLivingSf)}
              </Text>
              <Text style={[styles.detailRow, { color: muted }]}>
                Planning baseline {formatWholeDollars(value!.blendedPlanningPerLivingSf)}
              </Text>
              <Text style={[styles.disclaimer, { color: muted }]}>
                Comparison only — estimate values unchanged.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardPad: {
    paddingVertical: 16,
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
