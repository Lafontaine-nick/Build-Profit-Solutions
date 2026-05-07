import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TaxCategoryRow } from '@/src/lib/taxCenter';
import { ACCOUNTING_CATEGORY_MAPPING_ENABLED } from '@/src/lib/taxCenterLaunchFlags';
import { taxCenterPanelCard } from '@/src/components/tax/taxPanelCardStyle';

type Props = {
  rows: TaxCategoryRow[];
  formatMoney: (value: number) => string;
};

export default function TaxCategoryBreakdown({ rows, formatMoney }: Props) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Expense categories</Text>
      <Text style={styles.subtitle}>
        Based on Build Profit Solutions project categories from expenses paid and paid purchase orders.
      </Text>

      {rows.length === 0 ? (
        <Text style={styles.empty}>No expenses found for this tax year.</Text>
      ) : (
        rows.map((row) => {
          const pct = total > 0 ? row.amount / total : 0;
          return (
            <View key={row.category} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.category}>{row.category}</Text>
                <Text style={styles.amount}>{formatMoney(row.amount)}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(3, pct * 100)}%` }]} />
              </View>
              {ACCOUNTING_CATEGORY_MAPPING_ENABLED && !!row.accountingLabel?.trim() ? (
                <Text style={styles.accounting} numberOfLines={2}>
                  Accounting mapping: {row.accountingLabel.trim()}
                </Text>
              ) : null}
              <Text style={styles.count}>{row.count} item{row.count === 1 ? '' : 's'}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...taxCenterPanelCard,
    paddingBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(203, 213, 225, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 16,
  },
  row: {
    marginBottom: 14,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  category: {
    color: '#EAF2FF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  amount: {
    color: '#2DFFC4',
    fontSize: 14,
    fontWeight: '800',
  },
  track: {
    height: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#2DFFC4',
  },
  accounting: {
    color: 'rgba(148, 163, 184, 0.88)',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
  },
  count: {
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 11,
    marginTop: 5,
  },
  empty: {
    color: 'rgba(203, 213, 225, 0.75)',
    fontSize: 13,
    lineHeight: 18,
  },
});
