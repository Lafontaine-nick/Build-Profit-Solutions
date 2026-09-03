import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { EstimateLineSpendSummary } from '@/utils/rateInsightComparisons';
import BudgetStatusBadge from '@/components/BudgetStatusBadge';
import {
  formatSpendDetail,
  lineBudgetStatusVariant,
  lineSpendColor,
  progressFillPercent,
} from '@/utils/estimateLineBudgetDisplay';
import { ESTIMATE_FLOW_NESTED_FIELD_BG_DARK, ESTIMATE_FLOW_TRACK_BG_DARK } from '@/utils/estimateFlowCardStyle';

type Props = {
  summary: EstimateLineSpendSummary;
  darkMode: boolean;
  trackBg?: string;
  compact?: boolean;
  /** Nest budget info in a subtle inset panel (group cards). */
  inset?: boolean;
};

export default function EstimateLineBudgetStrip({
  summary,
  darkMode,
  trackBg,
  compact = false,
  inset = false,
}: Props) {
  if (summary.budget <= 0 && summary.loggedTotal <= 0) return null;

  const showProgress = summary.budget > 0 && summary.loggedTotal > 0;
  const showDetail = summary.loggedTotal > 0 || summary.budget > 0;
  if (!showDetail) return null;

  const statusVariant = lineBudgetStatusVariant(summary);
  const insetBg = darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : 'rgba(148, 163, 184, 0.08)';

  const content = (
    <>
      <View style={styles.detailRow}>
        {summary.loggedTotal > 0 ? (
          <Text
            style={[
              styles.detail,
              { color: lineSpendColor(summary) },
              compact && styles.detailCompact,
            ]}
            numberOfLines={2}
          >
            {formatSpendDetail(summary)}
          </Text>
        ) : null}
        {statusVariant !== 'neutral' ? <BudgetStatusBadge variant={statusVariant} /> : null}
      </View>
      {showProgress ? (
        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor:
                trackBg ?? (darkMode ? ESTIMATE_FLOW_TRACK_BG_DARK : 'rgba(148, 163, 184, 0.2)'),
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressFillPercent(summary)}%`,
                backgroundColor: lineSpendColor(summary),
              },
            ]}
          />
        </View>
      ) : null}
    </>
  );

  if (inset) {
    return (
      <View
        style={[
          styles.insetWrap,
          compact && styles.wrapCompact,
          { backgroundColor: insetBg },
        ]}
      >
        {content}
      </View>
    );
  }

  return <View style={[styles.wrap, compact && styles.wrapCompact]}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  wrapCompact: { marginTop: 2 },
  insetWrap: {
    marginTop: 2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  detail: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  detailCompact: { fontSize: 11, lineHeight: 16 },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
