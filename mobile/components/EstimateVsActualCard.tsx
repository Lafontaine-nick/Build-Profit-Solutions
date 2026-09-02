import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { EstimateFeedbackResult } from '@/utils/estimateFeedback';
import { BRAND_FRAME_GRADIENT_COLORS, BRAND_FRAME_GRADIENT_END, BRAND_FRAME_GRADIENT_START } from '@/constants/brandFrameGradient';
import { formatMoneyFull } from '@/src/lib/budgetUtils';
import { ESTIMATE_FLOW_PROGRESS_GRADIENT, ESTIMATE_FLOW_TRACK_BG_DARK } from '@/utils/estimateFlowCardStyle';
import {
  ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS,
  formatCategoriesLinkedLabel,
  formatCategoriesLinkedSublabel,
  formatCostBudgetVsBidNote,
  formatEstimateStatusLabel,
  formatEstimateVarianceDisplay,
  formatSpendDollarsLine,
  formatSpendProgress,
  formatVarianceDollarsLine,
  getEstimateVsActualCardMessage,
  getLinkedCategoryLabels,
  resolveEstimateTipCount,
  shouldShowRateInsightsCta,
  shouldShowTipsRow,
  shouldShowVarianceRow,
} from '@/utils/estimateVsActualCard';

type RowProps = {
  label: string;
  value: string;
  sublabel?: string;
  valueColor?: string;
  theme: { metricLabelColor?: string; text?: string };
};

function MetricRow({ label, value, sublabel, valueColor, theme }: RowProps) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text
          style={{
            flex: 1,
            paddingRight: 12,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: theme.metricLabelColor,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            letterSpacing: -0.28,
            color: valueColor ?? theme.text,
            fontVariant: ['tabular-nums'],
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      {sublabel ? (
        <Text style={{ color: theme.metricLabelColor, fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: 'right' }}>
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}

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
  onReviewTips,
  onMapCosts,
  showInsightsCta,
}: EstimateVsActualCardProps) {
  const summary = estimateFeedback.projectSummary;
  const linkedCategories = getLinkedCategoryLabels(estimateFeedback);
  const tipCount = resolveEstimateTipCount(estimateFeedback, closeoutTipCount);
  const spendProgress = formatSpendProgress(summary);
  const spendDollars = formatSpendDollarsLine(summary, (amount) => formatMoneyFull(amount));
  const variance = formatEstimateVarianceDisplay(summary);
  const varianceDollars = formatVarianceDollarsLine(summary, (amount) => formatMoneyFull(amount));
  const message = getEstimateVsActualCardMessage(estimateFeedback, tipCount);
  const coverage = summary.mappedActualCoveragePercent ?? 0;
  const showVariance = shouldShowVarianceRow(estimateFeedback);
  const showTips = shouldShowTipsRow(estimateFeedback, tipCount);
  const showMapCosts =
    Boolean(onMapCosts) &&
    Boolean(linkCostsTarget) &&
    coverage < ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS &&
    estimateFeedback.unresolvedMappings.length === 0;
  const varianceColor =
    !variance.reliable
      ? pageCaption
      : variance.tone === 'over'
        ? '#f97316'
        : variance.tone === 'under'
          ? '#22c55e'
          : theme.text;
  const messageColor =
    message.tone === 'warn' ? '#fbbf24' : message.tone === 'positive' ? '#22c55e' : pageCaption;
  const costBudget = summary.estimatedDirectCost;
  const costBudgetNote =
    bidPrice != null && costBudget != null
      ? formatCostBudgetVsBidNote(costBudget, bidPrice, (amount) => formatMoneyFull(amount))
      : undefined;
  const categoriesLinkedLabel = formatCategoriesLinkedLabel(linkedCategories.length, totalCategoryCount);
  const categoriesLinkedSublabel = formatCategoriesLinkedSublabel(linkedCategories);

  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          borderRadius: 14,
          padding: 15,
          backgroundColor: nestedCardBg,
          borderWidth: 1,
          borderColor: nestedCardBorder,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                borderWidth: 1,
                borderColor: 'rgba(34, 197, 94, 0.22)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <MaterialIcons name="analytics" size={16} color="#22c55e" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: darkMode ? '#F5F7FA' : theme.text }}>
              Estimate vs actual
            </Text>
          </View>
          <Text style={{ color: pageCaption, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>
            {formatEstimateStatusLabel(estimateFeedback.status)}
          </Text>
        </View>

        <MetricRow
          label="Cost budget used"
          value={spendProgress.percentLabel}
          sublabel={spendDollars}
          theme={theme}
        />

        <View style={{ marginBottom: 10 }}>
          <View
            style={{
              height: 6,
              borderRadius: 999,
              overflow: 'hidden',
              backgroundColor: darkMode ? ESTIMATE_FLOW_TRACK_BG_DARK : 'rgba(148, 163, 184, 0.2)',
            }}
          >
            <LinearGradient
              colors={[...ESTIMATE_FLOW_PROGRESS_GRADIENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: '100%', width: `${spendProgress.progressPercent}%` }}
            />
          </View>
          <Text style={{ color: pageCaption, fontSize: 11, lineHeight: 15, marginTop: 5 }}>
            Spent vs cost budget — not bid price
          </Text>
        </View>

        {(totalCategoryCount ?? 0) > 1 ? (
          <MetricRow
            label="Categories linked"
            value={categoriesLinkedLabel}
            sublabel={categoriesLinkedSublabel}
            theme={theme}
          />
        ) : null}

        {showVariance ? (
          <MetricRow
            label="Over / under cost budget"
            value={variance.value}
            sublabel={varianceDollars}
            valueColor={varianceColor}
            theme={theme}
          />
        ) : null}

        {showTips ? (
          <MetricRow label="Rate insights" value={String(tipCount)} theme={theme} />
        ) : null}

        {variance.hint && message.showVarianceHint !== false ? (
          <Text style={{ color: pageCaption, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{variance.hint}</Text>
        ) : null}

        <Text style={{ color: messageColor, fontSize: 12, lineHeight: 17, marginTop: 6 }}>{message.text}</Text>

        {costBudgetNote ? (
          <Text style={{ color: pageCaption, fontSize: 11, lineHeight: 16, marginTop: 6 }}>
            {costBudgetNote}
          </Text>
        ) : null}

        {showMapCosts ? (
          <Pressable onPress={onMapCosts} accessibilityRole="button" accessibilityLabel={`Link costs to ${linkCostsTarget}`}>
            <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700', marginTop: 10 }}>
              Link costs to {linkCostsTarget} →
            </Text>
          </Pressable>
        ) : null}

        {showInsightsCta && shouldShowRateInsightsCta(estimateFeedback, tipCount) ? (
          <Pressable onPress={onReviewTips} accessibilityRole="button" accessibilityLabel={`View rate insights (${tipCount})`}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={BRAND_FRAME_GRADIENT_START}
              end={BRAND_FRAME_GRADIENT_END}
              style={{ marginTop: 12, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
            >
              <Text style={{ color: '#04140C', fontWeight: '800', fontSize: 14 }}>
                View rate insights ({tipCount})
              </Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
