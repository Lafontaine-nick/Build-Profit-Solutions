import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import {
  ESTIMATE_FLOW_TEXT_LABEL_DARK,
  ESTIMATE_FLOW_TEXT_MUTED_DARK,
  ESTIMATE_FLOW_TEXT_SECONDARY_DARK,
} from '../utils/estimateFlowCardStyle';
import type { ProfitForecastOutput } from '../src/lib/profitForecast';
import BudgetProfitMixDonut from './BudgetProfitMixDonut';

const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.round((n || 0) * 100) / 100);

export type BudgetProfitMixCardProps = {
  currency?: string;
  adjustedContractValue: number;
  spentToDate: number;
  committedPOsTotal: number;
  adjustedCostBudget: number;
  profitForecast: ProfitForecastOutput;
  originalEstimateMarginPct?: number | null;
  originalEstimateProfit?: number | null;
  /** Budget tab: scroll to contract section; Overview: e.g. switch to Budget tab */
  onChipsPress?: () => void;
  /** Outer `sectionCard` vertical margin (default 0 — Budget first card / Overview under header) */
  marginTop?: number;
  /** Job status completed — donut + copy use net / closeout wording */
  jobCompleted?: boolean;
  /** Start date is still in the future. Spend before that day is ahead of the job. */
  beforeJobStart?: boolean;
};

export default function BudgetProfitMixCard({
  currency = 'USD',
  adjustedContractValue,
  spentToDate,
  committedPOsTotal,
  adjustedCostBudget,
  profitForecast,
  marginTop = 0,
  jobCompleted = false,
  beforeJobStart = false,
}: BudgetProfitMixCardProps) {
  const { darkMode, theme: themeTokens } = useTheme();
  const Colors = useMemo(() => getColors(themeTokens), [themeTokens]);
  const [footerExpanded, setFooterExpanded] = useState(false);

  const pageSubtext = darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : '#64748b';
  const pageCaption = darkMode ? ESTIMATE_FLOW_TEXT_LABEL_DARK : '#64748b';
  const pageInstructional = darkMode ? ESTIMATE_FLOW_TEXT_MUTED_DARK : '#64748b';

  const costBudgetUsedPctDisplay = useMemo(() => {
    const cap = adjustedCostBudget;
    if (!(cap > 0)) return 0;
    return Math.min(100, Math.max(0, ((spentToDate + committedPOsTotal) / cap) * 100));
  }, [adjustedCostBudget, spentToDate, committedPOsTotal]);

  const hasContractForMix = adjustedContractValue > 0;
  /** True margin stress vs contract (rare once run-rate is capped while under cost budget). */
  const showNegativeMarginNote =
    hasContractForMix && profitForecast.projectedMarginPct < 0;
  // Pill tracks net margin vs the estimate net margin. The Est. chip stays the builder-margin
  // percent, so the planned overhead gap is not shown as a miss before any spend.
  const marginDriftPts =
    profitForecast.projectedMarginPct - profitForecast.originalEstimateMarginPct;
  const profitDrift = profitForecast.profitVarianceVsEstimate;
  const marginOnEstimate = Math.abs(marginDriftPts) < 0.15;
  const estimateDriftColor = marginOnEstimate
    ? '#2dcc9a'
    : marginDriftPts >= 0
      ? '#2dcc9a'
      : '#F97316';
  const estimateDriftDetail =
    Math.abs(profitDrift) < 1
      ? `Profit on estimate (${profitForecast.originalEstimateMarginPct.toFixed(1)}% baseline)`
      : `${profitDrift >= 0 ? '+' : '-'}${money(Math.abs(profitDrift), currency)} vs ${profitForecast.originalEstimateMarginPct.toFixed(1)}% baseline`;
  const burnVsPlanPts = costBudgetUsedPctDisplay - profitForecast.scheduleProgressPct;
  const schedulePct = profitForecast.scheduleProgressPct;
  const spentWithCommitted = spentToDate + committedPOsTotal;
  const overCostCap = adjustedCostBudget > 0 && spentWithCommitted > adjustedCostBudget + 0.5;
  const profitStatus = !hasContractForMix
    ? ''
    : marginOnEstimate
      ? 'Profit is on the estimate.'
      : profitDrift >= 0
        ? `Profit is ${money(profitDrift, currency)} above the estimate.`
        : `Profit is ${money(Math.abs(profitDrift), currency)} under the estimate.`;
  const paceWords = overCostCap
    ? 'Spending is over the cost cap.'
    : schedulePct < 1 && spentToDate > 0 && beforeJobStart
      ? 'Spending started before the schedule.'
      : schedulePct < 1 && spentToDate > 0
        ? 'Spending is inside the cost cap.'
      : Math.abs(burnVsPlanPts) < 3
        ? 'Spending is in line with the schedule.'
        : burnVsPlanPts > 0
          ? `Spending is ahead of the ${schedulePct.toFixed(0)}% schedule.`
          : `The schedule is further along, at ${schedulePct.toFixed(0)}%.`;

  return (
    <View style={[styles.sectionCardContainer, { marginTop }]}>
      <View
        style={[
          styles.sectionCard,
          !darkMode && styles.sectionCardElevated,
          {
            backgroundColor: 'transparent',
            borderWidth: 0,
            paddingHorizontal: 0,
            paddingVertical: 0,
          },
        ]}
      >
        <View
          style={[
            styles.spendingTrendHeaderBlock,
            styles.budgetProfitMixHeaderBlock,
            { borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.08)' : Colors.line },
          ]}
        >
          {hasContractForMix ? (
            <View style={styles.plainStatusBlock}>
              <Text style={[styles.plainStatusLead, { color: estimateDriftColor }]}>
                {profitStatus}
              </Text>
              <Text style={[styles.plainStatusBody, { color: overCostCap ? '#F97316' : pageSubtext }]}>
                {paceWords}
              </Text>
              <Text style={[styles.plainStatusMeta, { color: pageInstructional }]}>
                Contract {money(adjustedContractValue, currency)} · Cost cap {money(adjustedCostBudget, currency)}
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.budgetProfitMixDonutWrap,
            Platform.OS === 'web' && styles.budgetProfitMixDonutWrapWeb,
          ]}
        >
          {hasContractForMix ? (
            <BudgetProfitMixDonut
              contractValue={adjustedContractValue}
              spentToDate={spentToDate}
              forecastFinalCost={profitForecast.forecastFinalCost}
              allocatedCompanyOverhead={profitForecast.allocatedCompanyOverhead}
              projectedMarginPct={profitForecast.projectedMarginPct}
              spentNote={
                adjustedCostBudget > 0
                  ? `${((spentToDate / adjustedCostBudget) * 100).toFixed(1)}% of the cost cap`
                  : undefined
              }
              committedPOs={committedPOsTotal}
              currency={currency}
              formatMoney={money}
              darkMode={darkMode}
              jobCompleted={jobCompleted}
            />
          ) : (
            <Text
              style={{
                color: pageInstructional,
                fontSize: 13,
                fontWeight: '600',
                textAlign: 'center',
                paddingVertical: 20,
                paddingHorizontal: 12,
                lineHeight: 19,
              }}
            >
              Add an adjusted contract value to see the spend, remaining cost, and profit mix.
            </Text>
          )}
        </View>
        <View style={styles.budgetProfitMixFooterBlock}>
          {hasContractForMix ? (
            <Pressable
              onPress={() => setFooterExpanded(prev => !prev)}
              hitSlop={8}
              style={styles.learnMoreToggle}
            >
              <Text style={[styles.learnMoreText, { color: pageCaption }]}>
                {footerExpanded ? 'Hide details' : 'Learn more'}
              </Text>
            </Pressable>
          ) : null}
          {footerExpanded ? (
            <View style={styles.footerDetailBlock}>
              <Text style={[styles.budgetProfitMixFooterDisclaimer, { color: pageInstructional }]}>
                The {profitForecast.projectedMarginPct.toFixed(1)}% is net profit after every job cost, including project overhead.
              </Text>
              <Text style={[styles.budgetProfitMixFooterDisclaimer, { color: pageInstructional }]}>
                The bar splits the contract into money spent, cost still left, and your profit. {estimateDriftDetail}.
              </Text>
              {showNegativeMarginNote ? (
                <Text style={[styles.budgetProfitMixFooterDisclaimer, { color: pageInstructional }]}>
                  Negative margin means expected final cost still exceeds contract value on current figures.
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCardContainer: {
    marginTop: 12,
  },
  sectionCard: {
    borderRadius: 14,
    padding: 15,
  },
  sectionCardElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  spendingTrendHeaderBlock: {
    paddingBottom: 12,
    marginBottom: 2,
    borderBottomWidth: 1,
  },
  budgetProfitMixHeaderBlock: {
    paddingBottom: 10,
    marginBottom: 0,
  },
  budgetProfitMixTitleRow: {
    alignItems: 'flex-start',
    width: '100%',
  },
  budgetProfitMixTitleCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    maxWidth: '100%',
  },
  plainStatusBlock: {
    marginTop: 4,
    gap: 6,
  },
  plainStatusLead: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  plainStatusBody: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  plainStatusMeta: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  budgetProfitMixDonutWrap: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 8,
  },
  /** Web layout: nudge donut down vs chip row (native spacing already reads balanced). */
  budgetProfitMixDonutWrapWeb: {
    marginTop: 24,
  },
  budgetProfitMixFooterBlock: {
    paddingTop: 4,
    paddingBottom: 14,
    paddingHorizontal: 4,
  },
  budgetProfitMixFooterCaption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    textAlign: 'left',
    paddingHorizontal: 0,
  },
  budgetProfitMixFooterDisclaimer: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'left',
    paddingHorizontal: 8,
  },
  learnMoreToggle: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerDetailBlock: {
    marginTop: 2,
    paddingTop: 2,
  },
  totalsTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, textAlign: 'left' },
});
