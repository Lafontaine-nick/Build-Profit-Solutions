import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatMoneyFull } from '@/src/lib/budgetUtils';

type Props = {
  count: number;
  totalAmount: number;
  darkMode: boolean;
  nestedCardBg: string;
  nestedCardBorder: string;
  labelColor: string;
};

export default function UnlinkedExpensesBanner({
  count,
  totalAmount,
  darkMode,
  nestedCardBg,
  nestedCardBorder,
  labelColor,
}: Props) {
  if (count <= 0) return null;

  const expenseLabel = count === 1 ? 'expense' : 'expenses';

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.1)' : nestedCardBg,
          borderColor: darkMode ? 'rgba(245, 158, 11, 0.34)' : nestedCardBorder,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <MaterialIcons name="link-off" size={16} color="#fbbf24" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>
          {count} unlinked {expenseLabel}
        </Text>
        <Text style={[styles.subtitle, { color: labelColor }]}>
          {formatMoneyFull(totalAmount, { decimals: 0 })} not tied to an estimate line. Tap a
          transaction to link it.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
});
