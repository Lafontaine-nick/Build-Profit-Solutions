import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatMoneyFull } from '@/src/lib/budgetUtils';
import { ESTIMATE_FLOW_NESTED_FIELD_BG_DARK } from '@/utils/estimateFlowCardStyle';

export type GroupedExpenseRow = {
  id: string;
  vendor: string;
  amount: number;
  date?: string;
  receiptUri?: string | null;
  po?: string;
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
  onPressItem,
}: Props) {
  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const rowBg = darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : nestedCardBg;

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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.lineName, { color: textColor }]} numberOfLines={1}>
            {lineName}
          </Text>
          <Text style={[styles.tripCount, { color: subtextColor }]}>
            {items.length} store {items.length === 1 ? 'trip' : 'trips'}
          </Text>
        </View>
        <Text style={styles.totalAmount}>{formatMoneyFull(total, { decimals: 2 })}</Text>
      </View>

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
                  <Text style={[styles.vendor, { color: textColor }]} numberOfLines={1}>
                    {item.vendor}
                  </Text>
                  <Text style={styles.rowAmount}>{formatMoneyFull(item.amount, { decimals: 2 })}</Text>
                </View>
                <View style={styles.rowFooter}>
                  <Text style={[styles.date, { color: subtextColor }]}>{dateLabel}</Text>
                  <View style={styles.rowMeta}>
                    {item.receiptUri ? (
                      <MaterialIcons name="receipt" size={14} color="#22c55e" />
                    ) : (
                      <Text style={[styles.noReceipt, { color: '#ef4444' }]}>No receipt</Text>
                    )}
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
  headerLeft: { flex: 1, minWidth: 0 },
  lineName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  tripCount: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  totalAmount: { color: '#22c55e', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
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
  rowAmount: { color: '#22c55e', fontSize: 16, fontWeight: '700' },
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
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  noReceipt: { fontSize: 10, fontWeight: '600' },
  tapEdit: { fontSize: 12, fontWeight: '500' },
});
