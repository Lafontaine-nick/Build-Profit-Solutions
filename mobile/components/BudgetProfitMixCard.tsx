import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
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
};

export default function BudgetProfitMixCard({
  currency = 'USD',
  adjustedContractValue,
  spentToDate,
  committedPOsTotal,
  adjustedCostBudget,
  profitForecast,
  originalEstimateMarginPct,
  originalEstimateProfit,
  onChipsPress,
  marginTop = 0,
  jobCompleted = false,
}: BudgetProfitMixCardProps) {
  const { darkMode, theme: themeTokens } = useTheme();
  const Colors = useMemo(() => getColors(themeTokens), [themeTokens]);
  const [footerExpanded, setFooterExpanded] = useState(false);

  const theme = darkMode
    ? {
        text: '#f1f5f9',
      }
    : {
        text: '#1e293b',
      };

  const pageSubtext = darkMode ? 'rgba(255,255,255,0.88)' : '#64748b';
  const pageCaption = darkMode ? 'rgba(255,255,255,0.78)' : '#64748b';
  const pageInstructional = darkMode ? 'rgba(255,255,255,0.56)' : '#64748b';

  const budgetMixChipSurface = useMemo(
    () => ({
      borderColor: darkMode ? 'rgba(148,163,184,0.22)' : 'rgba(15,23,42,0.12)',
      backgroundColor: darkMode ? 'rgba(255,255,255,0.055)' : 'rgba(15,23,42,0.055)',
    }),
    [darkMode]
  );

  const costBudgetUsedPctDisplay = useMemo(() => {
    const cap = adjustedCostBudget;
    if (!(cap > 0)) return 0;
    return Math.min(100, Math.max(0, ((spentToDate + committedPOsTotal) / cap) * 100));
  }, [adjustedCostBudget, spentToDate, committedPOsTotal]);

  const hasContractForMix = adjustedContractValue > 0;
  /** True margin stress vs contract (rare once run-rate is capped while under cost budget). */
  const showNegativeMarginNote =
    hasContractForMix && profitForecast.projectedMarginPct < 0;
  const originalEstimateMarginPctResolved = useMemo(() => {
    if (typeof originalEstimateMarginPct === 'number' && Number.isFinite(originalEstimateMarginPct)) {
      return originalEstimateMarginPct;
    }
    if (!(adjustedContractValue > 0)) return 0;
    return (profitForecast.estimatedProfit / adjustedContractValue) * 100;
  }, [adjustedContractValue, originalEstimateMarginPct, profitForecast.estimatedProfit]);
  const originalEstimateProfitResolved = useMemo(() => {
    if (typeof originalEstimateProfit === 'number' && Number.isFinite(originalEstimateProfit)) {
      return originalEstimateProfit;
    }
    return profitForecast.estimatedProfit;
  }, [originalEstimateProfit, profitForecast.estimatedProfit]);
  const marginDriftPts = profitForecast.projectedMarginPct - originalEstimateMarginPctResolved;
  const profitDrift = profitForecast.projectedProfit - originalEstimateProfitResolved;
  const estimateDriftColor =
    Math.abs(marginDriftPts) < 0.15
      ? pageSubtext
      : marginDriftPts >= 0
        ? '#22C55E'
        : '#F97316';
  const estimateDriftPillLabel =
    Math.abs(marginDriftPts) < 0.15
      ? 'On estimate'
      : `${marginDriftPts > 0 ? '+' : ''}${marginDriftPts.toFixed(1)} pts`;
  const estimateDriftDetail =
    Math.abs(profitDrift) < 1
      ? `Profit on estimate (${originalEstimateMarginPctResolved.toFixed(1)}% baseline)`
      : `${profitDrift >= 0 ? '+' : '-'}${money(Math.abs(profitDrift), currency)} vs ${originalEstimateMarginPctResolved.toFixed(1)}% baseline`;
  const burnVsPlanPts = costBudgetUsedPctDisplay - profitForecast.scheduleProgressPct;
  const burnVsPlanColor =
    Math.abs(burnVsPlanPts) < 3
      ? pageSubtext
      : burnVsPlanPts > 0
        ? '#F97316'
        : '#22C55E';
  /** Same number as before (budget used % minus job progress %); wording aimed at non-finance users. */
  const burnVsPlanPillLabel =
    Math.abs(burnVsPlanPts) < 3
      ? 'On pace'
      : burnVsPlanPts > 0
        ? `${burnVsPlanPts.toFixed(1)}% over`
        : `${Math.abs(burnVsPlanPts).toFixed(1)}% under`;
  const spendVsScheduleDetail = `${costBudgetUsedPctDisplay.toFixed(1)}% of cost budget used · ${profitForecast.scheduleProgressPct.toFixed(1)}% done on the schedule`;

  return (
    <View style={[styles.sectionCardContainer, { marginTop }]}>
      <View
        style={[
          styles.sectionCard,
          darkMode && styles.sectionCardElevated,
          {
            backgroundColor: Colors.surface2,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
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
          <View style={styles.budgetProfitMixTitleRow}>
            <View style={styles.budgetProfitMixTitleCenter}>
              <MaterialCommunityIcons name="chart-donut" size={21} color="#22c55e" />
              <Text style={[styles.totalsTitle, { color: theme.text, marginLeft: 9 }]} numberOfLines={1}>
                Budget & Profit Mix
              </Text>
            </View>
          </View>
          {hasContractForMix ? (
            <View
              style={[
                styles.signalPillRow,
                {
                  borderTopColor: darkMode ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.1)',
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.04)',
                },
              ]}
            >
              <View style={styles.signalPill}>
                <Text style={[styles.signalPillLabel, { color: pageCaption }]} numberOfLines={1}>
                  Margin vs bid
                </Text>
                <Text style={[styles.signalPillValue, { color: estimateDriftColor }]} numberOfLines={1}>
                  {estimateDriftPillLabel}
                </Text>
              </View>
              <View style={styles.signalPillDivider} />
              <View style={styles.signalPill}>
                <Text style={[styles.signalPillLabel, { color: pageCaption }]} numberOfLines={1}>
                  Spend vs progress
                </Text>
                <Text style={[styles.signalPillValue, { color: burnVsPlanColor }]} numberOfLines={1}>
                  {burnVsPlanPillLabel}
                </Text>
              </View>
              <View style={styles.signalPillDivider} />
              <View style={styles.signalPill}>
                <Text style={[styles.signalPillLabel, { color: pageCaption }]} numberOfLines={1}>
                  Budget spent
                </Text>
                <Text style={[styles.signalPillValue, { color: pageSubtext }]} numberOfLines={1}>
                  {`${costBudgetUsedPctDisplay.toFixed(1)}%`}
                </Text>
              </View>
            </View>
          ) : null}
          {hasContractForMix ? (
            <View style={styles.referenceChipRow}>
              <Pressable
                onPress={onChipsPress}
                style={({ pressed }) => [
                  styles.referenceChip,
                  budgetMixChipSurface,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Text
                  style={[styles.referenceChipText, { color: pageInstructional }]}
                  numberOfLines={1}
                >
                  Contract {money(adjustedContractValue, currency)}
                </Text>
              </Pressable>
              <Pressable
                onPress={onChipsPress}
                style={({ pressed }) => [
                  styles.referenceChip,
                  budgetMixChipSurface,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Text
                  style={[styles.referenceChipText, { color: pageInstructional }]}
                  numberOfLines={1}
                >
                  Cap {money(adjustedCostBudget, currency)}
                </Text>
              </Pressable>
              <View style={[styles.referenceChip, budgetMixChipSurface]}>
                <Text
                  style={[styles.referenceChipText, { color: pageInstructional }]}
                  numberOfLines={1}
                >
                  Est. {originalEstimateMarginPctResolved.toFixed(1)}%
                </Text>
              </View>
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
              projectedMarginPct={profitForecast.projectedMarginPct}
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
          <Text style={[styles.budgetProfitMixFooterCaption, { color: pageInstructional }]}>
            {jobCompleted
              ? 'Net margin is contract value vs final cost at closeout (actuals in the app).'
              : 'Projected margin is estimated from current spend, commitments, and progress. Estimate only.'}
          </Text>
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
                Margin vs bid compares the projected finish margin to your original bid baseline
                ({originalEstimateMarginPctResolved.toFixed(1)}%).
              </Text>
              <Text style={[styles.budgetProfitMixFooterDisclaimer, { color: pageInstructional }]}>
                Spend vs progress compares two percentages: how much of your cost budget is used (money out
                the door plus open POs) vs how far along the job is on the schedule ({spendVsScheduleDetail}).
              </Text>
              <Text style={[styles.budgetProfitMixFooterDisclaimer, { color: pageInstructional }]}>
                If the middle number is under, you have used less budget than the schedule suggests for this
                point in the job (usually good). If it is over, you have used more budget than the schedule
                suggests (worth a look). On pace means the two are within a few percent.
              </Text>
              <Text style={[styles.budgetProfitMixFooterDisclaimer, { color: pageInstructional }]}>
                {estimateDriftDetail}.
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
    borderRadius: 16,
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
    alignItems: 'center',
    width: '100%',
  },
  budgetProfitMixTitleCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  signalPillRow: {
    marginTop: 10,
    marginHorizontal: -2,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    gap: 6,
  },
  signalPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  signalPillDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.18)',
    alignSelf: 'stretch',
  },
  signalPillLabel: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
    textAlign: 'center',
    marginBottom: 3,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  signalPillValue: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  referenceChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  referenceChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    minHeight: 22,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  referenceChipText: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 13,
    letterSpacing: 0.1,
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
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  budgetProfitMixFooterDisclaimer: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  learnMoreToggle: {
    marginTop: 6,
    alignSelf: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  learnMoreText: {
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerDetailBlock: {
    marginTop: 2,
    paddingTop: 2,
  },
  totalsTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.15 },
});
