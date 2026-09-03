import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoneyFull } from '@/src/lib/budgetUtils';
import BudgetStatusBadge from '@/components/BudgetStatusBadge';
import {
  categoryBudgetProgressPercent,
  categoryBudgetSpendColor,
  categoryBudgetStatusVariant,
  formatCategoryBudgetSubtitle,
  type CategoryBudgetSummary,
} from '@/utils/estimateLineBudgetDisplay';
import { ESTIMATE_FLOW_TRACK_BG_DARK } from '@/utils/estimateFlowCardStyle';

type Props = {
  summary: CategoryBudgetSummary;
  darkMode: boolean;
  nestedCardBg: string;
  nestedCardBorder: string;
  labelColor: string;
  valueColor: string;
  /** Fallback label when no estimate budget exists. */
  spentOnlyLabel?: string;
};

export default function CategoryEstimateBudgetCard({
  summary,
  darkMode,
  nestedCardBg,
  nestedCardBorder,
  labelColor,
  valueColor,
  spentOnlyLabel = 'Total Spent',
}: Props) {
  const isOver = summary.hasEstimateBudget && summary.remaining < 0;
  const statusVariant = categoryBudgetStatusVariant(summary);
  const subtitle = formatCategoryBudgetSubtitle(summary);

  if (!summary.hasEstimateBudget) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: nestedCardBg, borderColor: nestedCardBorder },
        ]}
      >
        <Text style={[styles.label, { color: labelColor }]}>{spentOnlyLabel}</Text>
        <Text style={styles.spentValue}>
          {formatMoneyFull(summary.totalSpent, { decimals: 2 })}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: nestedCardBg, borderColor: nestedCardBorder },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.statBlock}>
          <Text style={[styles.label, { color: labelColor }]}>Estimate budget</Text>
          <Text style={[styles.budgetValue, { color: valueColor }]}>
            {formatMoneyFull(summary.totalBudget, { decimals: 0 })}
          </Text>
        </View>
        <View style={[styles.statBlock, styles.statBlockRight]}>
          <Text style={[styles.label, { color: labelColor }]}>Total spent</Text>
          <Text style={[styles.spentValue, isOver && styles.spentValueOver]}>
            {formatMoneyFull(summary.totalSpent, { decimals: 2 })}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: categoryBudgetSpendColor(summary) }]}>
            {subtitle}
          </Text>
        ) : null}
        {statusVariant !== 'neutral' ? <BudgetStatusBadge variant={statusVariant} /> : null}
      </View>

      {summary.totalSpent > 0 ? (
        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor: darkMode
                ? ESTIMATE_FLOW_TRACK_BG_DARK
                : 'rgba(148, 163, 184, 0.2)',
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${categoryBudgetProgressPercent(summary)}%`,
                backgroundColor: categoryBudgetSpendColor(summary),
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  statBlock: { flex: 1, minWidth: 0 },
  statBlockRight: { alignItems: 'flex-end' },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  budgetValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  spentValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#22c55e',
    letterSpacing: -0.4,
  },
  spentValueOver: { color: '#f87171' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.16)',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 17,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
