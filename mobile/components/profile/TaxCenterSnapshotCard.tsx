import React, { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useProjectList } from '@/contexts/ProjectListContext';
import { useVendorDirectory } from '@/contexts/VendorDirectoryContext';
import {
  computeTaxCenterSummary,
  formatTaxNetMarginPercent,
  getTaxCenterDataInputs,
  getYearExpenses,
  isCurrentTaxProject,
} from '@/src/lib/taxCenter';
import { build1099ReviewSummary } from '@/src/lib/tax1099Review';

const MINT = '#2dcc9a';
const HELPER = '#d7e1f0';
const AMBER = '#f59e0b';
const RED = '#f87171';

const money = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

function figureColor(value: number): string {
  if (!Number.isFinite(value) || value === 0) return HELPER;
  return value < 0 ? RED : MINT;
}

type Props = {
  cardBackground: string;
  textColor: string;
};

export default function TaxCenterSnapshotCard({ cardBackground, textColor }: Props) {
  const { projects, rehydrateProjectsFromStorage } = useProjectList();
  const { vendors } = useVendorDirectory();
  const rehydrateRef = useRef(rehydrateProjectsFromStorage);
  rehydrateRef.current = rehydrateProjectsFromStorage;

  useFocusEffect(
    useCallback(() => {
      void rehydrateRef.current();
    }, [])
  );

  const year = new Date().getFullYear();
  const currentProjects = useMemo(() => projects.filter(isCurrentTaxProject), [projects]);
  const summary = useMemo(
    () => computeTaxCenterSummary(currentProjects, [], [], [], year, vendors),
    [currentProjects, year, vendors]
  );
  const missingW9Count = useMemo(
    () =>
      build1099ReviewSummary({
        vendors,
        expenses: getYearExpenses(currentProjects, year),
        payments: getTaxCenterDataInputs(currentProjects).payments,
        selectedYear: year,
      }).missingW9Count,
    [vendors, currentProjects, year]
  );

  const hasActivity = summary.grossIncomeCollected > 0 || summary.totalExpenses > 0;
  const marginLabel =
    summary.grossIncomeCollected > 0 ? formatTaxNetMarginPercent(summary.netMargin) : '—';

  const nextStep =
    missingW9Count > 0
      ? `${missingW9Count} contractor${missingW9Count === 1 ? ' needs' : 's need'} a W-9`
      : summary.outstandingReceivables > 0
        ? `${money(summary.outstandingReceivables)} is still owed to you`
        : null;

  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/tax-center');
  };

  const openNextStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(missingW9Count > 0 ? '/tax-center?detail=payees' : '/tax-center');
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Open Tax Center"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBackground },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="request-quote" size={20} color={MINT} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: textColor }]}>Tax Center</Text>
          <Text style={styles.kicker}>{year} · Cash basis</Text>
        </View>
      </View>

      {hasActivity ? (
        <>
          <View style={styles.heroRow}>
            <Text style={[styles.heroValue, { color: figureColor(summary.netProfit) }]}>
              {money(summary.netProfit)}
            </Text>
            <Text style={styles.heroLabel}>net income</Text>
            <Text style={[styles.heroMargin, { color: figureColor(summary.netProfit) }]}>{marginLabel}</Text>
            <Text style={styles.heroLabel}>margin</Text>
          </View>

          <View style={styles.statRow}>
            <Stat label="Collected" value={summary.grossIncomeCollected} />
            <Stat label="Paid" value={summary.totalExpenses} />
            <Stat label="Still owed" value={summary.outstandingReceivables} warn />
          </View>

          {nextStep ? (
            <Pressable
              onPress={openNextStep}
              accessibilityRole="button"
              accessibilityLabel={nextStep}
              hitSlop={{ top: 6, bottom: 6 }}
              style={({ pressed }) => [styles.nextRow, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="error-outline" size={16} color={AMBER} />
              <Text style={styles.nextText}>{nextStep}</Text>
              <MaterialIcons name="chevron-right" size={18} color={AMBER} />
            </Pressable>
          ) : null}
        </>
      ) : (
        <Text style={styles.empty}>
          Payments and bills you log on jobs show up here as this year&apos;s cash income.
        </Text>
      )}

      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>Open Tax Center</Text>
        <MaterialIcons name="arrow-forward" size={16} color={MINT} />
      </View>
    </Pressable>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  const color = !Number.isFinite(value) || value === 0 ? HELPER : warn ? AMBER : MINT;
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{money(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(45, 204, 154, 0.35)',
    marginBottom: 16,
    width: '100%',
    alignSelf: 'stretch',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(45, 204, 154, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  kicker: {
    color: HELPER,
    fontSize: 12,
    marginTop: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: 6,
    marginTop: 14,
  },
  heroValue: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroMargin: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  heroLabel: {
    color: HELPER,
    fontSize: 13,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  stat: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    color: HELPER,
    fontSize: 12,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
  },
  nextText: {
    color: AMBER,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  empty: {
    color: HELPER,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
  },
  ctaText: {
    color: MINT,
    fontSize: 14,
    fontWeight: '600',
  },
});
