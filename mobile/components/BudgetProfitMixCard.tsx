import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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
  /** Budget tab: scroll to contract section; Overview: e.g. switch to Budget tab */
  onChipsPress?: () => void;
  /** Outer `sectionCard` vertical margin (default 0 — Budget first card / Overview under header) */
  marginTop?: number;
};

export default function BudgetProfitMixCard({
  currency = 'USD',
  adjustedContractValue,
  spentToDate,
  committedPOsTotal,
  adjustedCostBudget,
  profitForecast,
  onChipsPress,
  marginTop = 0,
}: BudgetProfitMixCardProps) {
  const { darkMode, theme: themeTokens } = useTheme();
  const Colors = useMemo(() => getColors(themeTokens), [themeTokens]);

  const theme = darkMode
    ? {
        text: '#f1f5f9',
      }
    : {
        text: '#1e293b',
      };

  const pageSubtext = darkMode ? 'rgba(255,255,255,0.88)' : '#8891a0';
  const pageCaption = darkMode ? 'rgba(255,255,255,0.78)' : '#8891a0';
  const pageInstructional = darkMode ? 'rgba(255,255,255,0.56)' : '#94a3b8';

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
          <View
            style={[
              styles.budgetProfitMixMarginShell,
              {
                borderTopColor: darkMode ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.1)',
                backgroundColor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.04)',
              },
            ]}
          >
            <View style={styles.budgetProfitMixMarginRow}>
              <Text
                style={{
                  color: pageSubtext,
                  fontSize: 13,
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                  letterSpacing: -0.2,
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {hasContractForMix ? `${profitForecast.projectedMarginPct.toFixed(1)}% projected margin` : '—'}
              </Text>
            </View>
          </View>
          <View style={styles.budgetProfitMixChipRow}>
            <Pressable
              onPress={onChipsPress}
              style={({ pressed }) => [
                styles.budgetProfitMixChip,
                budgetMixChipSurface,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[styles.budgetProfitMixChipText, { color: pageCaption }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                Budget spent {costBudgetUsedPctDisplay.toFixed(1)}%
              </Text>
            </Pressable>
            <Pressable
              onPress={onChipsPress}
              style={({ pressed }) => [
                styles.budgetProfitMixChip,
                budgetMixChipSurface,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[styles.budgetProfitMixChipText, { color: pageCaption }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                Cap {money(adjustedCostBudget, currency)}
              </Text>
            </Pressable>
            <Pressable
              onPress={onChipsPress}
              style={({ pressed }) => [
                styles.budgetProfitMixChip,
                budgetMixChipSurface,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[styles.budgetProfitMixChipText, { color: pageCaption }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                Contract {money(adjustedContractValue, currency)}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.budgetProfitMixDonutWrap}>
          {hasContractForMix ? (
            <BudgetProfitMixDonut
              contractValue={adjustedContractValue}
              spentToDate={spentToDate}
              forecastFinalCost={profitForecast.forecastFinalCost}
              projectedMarginPct={profitForecast.projectedMarginPct}
              currency={currency}
              formatMoney={money}
              darkMode={darkMode}
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
            Projected margin estimates the profit percentage we expect at job completion based on current costs,
            committed costs, and project progress.
          </Text>
          <Text
            style={[
              styles.budgetProfitMixFooterDisclaimer,
              styles.budgetProfitMixFooterItalic,
              { color: pageInstructional },
            ]}
          >
            Estimate only. Actual final margin may change as costs, commitments, change orders, and project progress
            are updated.
          </Text>
          {showNegativeMarginNote ? (
            <Text style={[styles.budgetProfitMixFooterDisclaimer, { color: pageInstructional }]}>
              Negative margin here means expected final cost still exceeds contract value on current figures.
              Open Budget for the full Contract & Cost breakdown.
            </Text>
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
  budgetProfitMixMarginShell: {
    marginTop: 8,
    marginHorizontal: -2,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  budgetProfitMixMarginRow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  budgetProfitMixChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
  },
  budgetProfitMixChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  budgetProfitMixChipText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  budgetProfitMixDonutWrap: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 8,
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
    marginTop: 10,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  budgetProfitMixFooterItalic: {
    fontStyle: 'italic',
  },
  totalsTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.15 },
});
