import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isLaborBill, laborPayeeIsNamed } from '@/src/lib/taxCenter';

type ExpenseLike = {
  category?: string;
  vendor?: string;
  vendorName?: string;
  trade?: string;
};

/** Names already used as Paid to on labor bills, keeping the first spelling. */
export function namedLaborPayeesFromExpenses(expenses: ExpenseLike[] | null | undefined): string[] {
  const seen = new Map<string, string>();
  for (const expense of expenses || []) {
    if (!isLaborBill(expense) || !laborPayeeIsNamed(expense)) continue;
    const name = String(expense.vendorName || expense.vendor || '').trim();
    const key = name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.set(key, name);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

type Props = {
  query: string;
  expenses: ExpenseLike[] | null | undefined;
  onPick: (name: string) => void;
};

/** Matches for the Paid to field. Hidden once the typed name already matches someone exactly. */
export default function PaidToNameSuggestions({ query, expenses, onPick }: Props) {
  const names = useMemo(() => namedLaborPayeesFromExpenses(expenses), [expenses]);
  const typed = query.trim().toLowerCase();
  if (!typed) return null;
  const matches = names
    .filter((name) => name.toLowerCase().includes(typed) && name.toLowerCase() !== typed)
    .slice(0, 4);
  if (matches.length === 0) return null;

  return (
    <View style={styles.row}>
      {matches.map((name) => (
        <Pressable
          key={name}
          onPress={() => onPick(name)}
          style={({ pressed }) => [styles.chip, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel={`Use ${name}`}
        >
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(45, 204, 154, 0.45)',
    backgroundColor: 'rgba(45, 204, 154, 0.14)',
  },
  name: {
    color: '#2dcc9a',
    fontSize: 14,
    fontWeight: '700',
  },
});
