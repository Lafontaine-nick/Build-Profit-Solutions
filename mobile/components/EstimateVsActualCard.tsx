import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { EstimateFeedbackResult } from '@/utils/estimateFeedback';
import { formatMoneyFull } from '@/src/lib/budgetUtils';
import { ESTIMATE_FLOW_TRACK_BG_DARK } from '@/utils/estimateFlowCardStyle';
import {
  ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS,
  formatCostBudgetVsBidNote,
  formatEstimateStatusLabel,
  formatMapCostsCtaLabel,
  formatSpendDollarsLine,
  formatSpendProgress,
  resolveEstimateTipCount,
  shouldShowRateInsightsCta,
} from '@/utils/estimateVsActualCard';

type EstimateVsActualCardProps = {
  estimateFeedback: EstimateFeedbackResult;
  closeoutTipCount: number | null;
  darkMode: boolean;
  nestedCardBg: string;
  nestedCardBorder: string;
  theme: { text: string; metricLabelColor?: string };
  pageCaption: string;
  bidPrice?: number;
  totalCategoryCount?: number;
  linkCostsTarget?: string | null;
  /** When true, CTA opens the Budget tab (Overview). Otherwise targets a category (Budget tab). */
  mapCostsOpensBudgetTab?: boolean;
  /** When true, skip the card chrome — parent already provides the surface (e.g. Budget flow card). */
  embeddedInFlow?: boolean;
  onReviewTips: () => void;
  onMapCosts?: () => void;
  showInsightsCta: boolean;
};

export default function EstimateVsActualCard({
  estimateFeedback,
  closeoutTipCount,
  darkMode,
  nestedCardBg,
  nestedCardBorder,
  theme,
  pageCaption,
  bidPrice,
  totalCategoryCount,
  linkCostsTarget,
  mapCostsOpensBudgetTab = false,
  embeddedInFlow = false,
  onReviewTips,
  onMapCosts,
  showInsightsCta,
}: EstimateVsActualCardProps) {
  const summary = estimateFeedback.projectSummary;
  const tipCount = resolveEstimateTipCount(estimateFeedback, closeoutTipCount);
  const spendProgress = formatSpendProgress(summary);
  const spendDollars = formatSpendDollarsLine(summary, (amount) => formatMoneyFull(amount));
  const coverage = summary.mappedActualCoveragePercent ?? 0;
  const showMapCosts =
    Boolean(onMapCosts) &&
    coverage < ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS &&
    estimateFeedback.unresolvedMappings.length === 0 &&
    (mapCostsOpensBudgetTab || Boolean(linkCostsTarget));
  const costBudget = summary.estimatedDirectCost ?? 0;
  const spent = summary.actualDirectCost ?? summary.mappedDirectCostActual ?? 0;
  const overCostCap = costBudget > 0 && spent > costBudget;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const statusLabel = formatEstimateStatusLabel(estimateFeedback.status);
  const mapCostsCtaLabel = formatMapCostsCtaLabel(linkCostsTarget, {
    opensBudgetTab: mapCostsOpensBudgetTab,
  });
  const tipLine =
    tipCount === 1 ? '1 rate tip from what you logged.' : tipCount > 1 ? `${tipCount} rate tips from what you logged.` : '';
  const costBudgetNote =
    bidPrice != null && costBudget > 0
      ? formatCostBudgetVsBidNote(costBudget, bidPrice, (amount) => formatMoneyFull(amount))
      : undefined;
  const lead =
    overCostCap
      ? 'Spending is over the cost cap.'
      : statusLabel === 'No costs logged'
        ? 'No job costs logged yet.'
        : null;

  const body = (
    <>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '800',
            letterSpacing: -0.35,
            color: darkMode ? '#F5F7FA' : theme.text,
          }}
          numberOfLines={2}
        >
          Estimate vs actual
        </Text>

        {lead ? (
          <Text
            style={{
              marginTop: 12,
              fontSize: 15,
              fontWeight: '700',
              lineHeight: 20,
              color: overCostCap ? '#F97316' : (darkMode ? '#d7e1f0' : theme.text),
            }}
          >
            {lead}
          </Text>
        ) : null}
        {spendDollars ? (
          <Text style={{ marginTop: lead ? 6 : 12, fontSize: 15, fontWeight: '700', lineHeight: 20, color: darkMode ? '#d7e1f0' : theme.text }}>
            {spendDollars.replace(' cost budget', '')}.
          </Text>
        ) : null}

        <Text style={[
          { marginTop: 16, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: pageCaption },
        ]}>
          COST CAP USED
        </Text>
        <Text style={{ marginTop: 4, fontSize: 32, fontWeight: '800', letterSpacing: -0.4, lineHeight: 38, color: '#2dcc9a' }}>
          {spendProgress.percentLabel}
        </Text>

        <View style={{ marginTop: 14, marginBottom: 14 }}>
          <View
            style={{
              height: 8,
              borderRadius: 999,
              overflow: 'hidden',
              backgroundColor: darkMode ? ESTIMATE_FLOW_TRACK_BG_DARK : 'rgba(148, 163, 184, 0.2)',
            }}
          >
            {spendProgress.progressPercent > 0 ? (
            <View
              style={{
                height: '100%',
                width: `${Math.min(spendProgress.progressPercent, 100)}%`,
                backgroundColor: overCostCap ? '#F97316' : '#2dcc9a',
              }}
            />
            ) : null}
          </View>
        </View>

        {tipLine ? (
          <Text style={{ color: pageCaption, fontSize: 14, fontWeight: '500', lineHeight: 20 }}>
            {tipLine}
          </Text>
        ) : null}

        {showMapCosts ? (
          <Pressable onPress={onMapCosts} accessibilityRole="button" accessibilityLabel={mapCostsCtaLabel.replace(/\s*→\s*$/, '')}>
            <Text style={{ color: '#2dcc9a', fontSize: 14, fontWeight: '700', marginTop: 10 }}>
              {mapCostsCtaLabel}
            </Text>
          </Pressable>
        ) : null}

        {showInsightsCta && shouldShowRateInsightsCta(estimateFeedback, tipCount) ? (
          <Pressable onPress={onReviewTips} accessibilityRole="button" accessibilityLabel={`View rate insights (${tipCount})`}>
            <View style={{ marginTop: 12, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: '#2dcc9a' }}>
              <Text style={{ color: '#050B13', fontWeight: '700', fontSize: 15 }}>
                View rate tips ({tipCount})
              </Text>
            </View>
          </Pressable>
        ) : null}

        <Pressable onPress={() => setDetailsOpen((open) => !open)} hitSlop={8} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          <Text style={{ color: pageCaption, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>
            {detailsOpen ? 'Hide details' : 'Learn more'}
          </Text>
        </Pressable>
        {detailsOpen ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            <Text style={{ color: pageCaption, fontSize: 13, lineHeight: 18 }}>
              This is money spent against the cost cap. The bid is higher because it includes markup.
            </Text>
            <Text style={{ color: pageCaption, fontSize: 13, lineHeight: 18 }}>
              Rate tips compare logged labor and materials with the estimate. They do not change your saved rates.
            </Text>
            {costBudgetNote ? (
              <Text style={{ color: pageCaption, fontSize: 13, lineHeight: 18 }}>{costBudgetNote}</Text>
            ) : null}
          </View>
        ) : null}
    </>
  );

  if (embeddedInFlow) {
    return <View>{body}</View>;
  }

  return (
    <View>
      <View
        style={{
          borderRadius: 14,
          padding: 15,
          backgroundColor: nestedCardBg,
          borderWidth: 1,
          borderColor: nestedCardBorder,
        }}
      >
        {body}
      </View>
    </View>
  );
}
