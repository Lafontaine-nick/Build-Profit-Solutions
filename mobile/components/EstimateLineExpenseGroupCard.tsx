import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatMoneyFull } from '@/src/lib/budgetUtils';
import { ESTIMATE_FLOW_NESTED_FIELD_BG_DARK } from '@/utils/estimateFlowCardStyle';
import EstimateLineBudgetStrip from '@/components/EstimateLineBudgetStrip';
import ReceiptStatusPill from '@/components/ReceiptStatusPill';
import type { EstimateLineSpendSummary } from '@/utils/rateInsightComparisons';
import { laborPaymentBadge } from '@/src/lib/taxCenter';
import LaborPayTypePill from '@/components/LaborPayTypePill';

export type GroupedExpenseRow = {
  id: string;
  vendor: string;
  amount: number;
  date?: string;
  receiptUri?: string | null;
  po?: string;
  trade?: string;
  laborPayType?: '1099' | 'w2';
};

type Props = {
  lineName: string;
  items: GroupedExpenseRow[];
  darkMode: boolean;
  nestedCardBg: string;
  nestedCardBorder: string;
  textColor: string;
  subtextColor: string;
  deletingId?: string | null;
  budgetSummary?: EstimateLineSpendSummary | null;
  /** Materials bills are store trips. Labor bills are payments and keep the trade. */
  entryNoun?: 'store trip' | 'payment';
  onPressItem: (item: GroupedExpenseRow) => void;
};

export default function EstimateLineExpenseGroupCard({
  lineName,
  items,
  darkMode,
  nestedCardBg,
  nestedCardBorder,
  textColor,
  subtextColor,
  deletingId,
  budgetSummary,
  entryNoun = 'store trip',
  onPressItem,
}: Props) {
  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const rowBg = darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : nestedCardBg;
  const hasMultipleTrips = items.length > 1;
  const trades = Array.from(
    new Set(items.map((item) => String(item.trade || '').trim()).filter(Boolean))
  );
  const tradeLabel = trades.length === 1 ? trades[0] : '';
  const noun = items.length === 1 ? entryNoun : `${entryNoun}s`;
  const countLabel = tradeLabel ? `${tradeLabel} · ${items.length} ${noun}` : `${items.length} ${noun}`;
  const sectionLabel = entryNoun === 'payment' ? 'Payments' : 'Store trips';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: nestedCardBg,
          borderColor: nestedCardBorder,
        },
      ]}
    >
      <View style={[styles.header, budgetSummary && styles.headerWithBudget]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.lineName, { color: textColor }]} numberOfLines={1}>
            {lineName}
          </Text>
          <Text style={[styles.tripCount, { color: subtextColor }]}>
            {countLabel}
          </Text>
        </View>
        <Text style={styles.totalAmount}>{formatMoneyFull(total, { decimals: 2 })}</Text>
      </View>

      {budgetSummary ? (
        <EstimateLineBudgetStrip summary={budgetSummary} darkMode={darkMode} inset />
      ) : null}

      {hasMultipleTrips ? (
        <View style={styles.tripsSection}>
          <Text style={[styles.tripsLabel, { color: subtextColor }]}>{sectionLabel}</Text>
          <View style={styles.rows}>
            {items.map((item, index) => {
              const isDeleting = deletingId === item.id;
              const dateLabel = item.date
                ? new Date(item.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'No date';
              const payBadge = entryNoun === 'payment' ? laborPaymentBadge(item) : null;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onPressItem(item)}
                  disabled={isDeleting}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: rowBg,
                      borderColor: nestedCardBorder,
                      opacity: isDeleting ? 0.5 : pressed ? 0.88 : 1,
                      marginBottom: index < items.length - 1 ? 8 : 0,
                    },
                  ]}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.vendorName, { color: textColor }]} numberOfLines={1}>
                          {item.vendor}
                        </Text>
                        {payBadge ? <LaborPayTypePill label={payBadge} /> : null}
                      </View>
                      <Text style={styles.rowAmount}>
                        {formatMoneyFull(item.amount, { decimals: 2 })}
                      </Text>
                    </View>
                    <View style={styles.rowFooter}>
                      <Text style={[styles.date, { color: subtextColor }]}>{dateLabel}</Text>
                      <View style={styles.rowMeta}>
                        <ReceiptStatusPill hasReceipt={Boolean(item.receiptUri)} />
                        <Text style={[styles.tapEdit, { color: subtextColor }]}>Tap to edit</Text>
                        <MaterialIcons name="chevron-right" size={14} color={subtextColor} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerWithBudget: {
    marginBottom: 10,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  lineName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  tripCount: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  totalAmount: { color: '#2dcc9a', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  tripsSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.16)',
  },
  tripsLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  rows: {},
  row: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowMain: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  vendor: { flex: 1, fontSize: 15, fontWeight: '700' },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  vendorName: { flexShrink: 1, fontSize: 15, fontWeight: '700' },
  rowAmount: { color: '#2dcc9a', fontSize: 16, fontWeight: '700' },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.14)',
  },
  date: { fontSize: 12, fontWeight: '500' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tapEdit: { fontSize: 12, fontWeight: '500' },
});
