import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { W2PaymentSummary } from '@/src/lib/taxCenter';
import { taxCenterPanelCard } from '@/src/components/tax/taxPanelCardStyle';

type Props = {
  people: W2PaymentSummary[];
  formatMoney: (value: number) => string;
};

export default function W2PaymentReport({ people, formatMoney }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>W-2 payments</Text>
      <Text style={styles.subtitle}>
        Employees entered as Paid to on labor bills. This list is for year-end review. It is not a W-2 form.
      </Text>
      {people.length === 0 ? (
        <Text style={styles.empty}>No W-2 payments found for this tax year.</Text>
      ) : (
        people.map((person) => (
          <View key={person.name} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{person.name}</Text>
              <Text style={styles.projects} numberOfLines={2}>
                {person.projects.length ? person.projects.join(', ') : 'No project linked'}
              </Text>
            </View>
            <Text style={styles.amount}>{formatMoney(person.totalPaid)}</Text>
          </View>
        ))
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
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  name: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  projects: { color: 'rgba(203, 213, 225, 0.82)', fontSize: 12, marginTop: 2 },
  amount: { color: '#2dcc9a', fontSize: 16, fontWeight: '800' },
  empty: { color: 'rgba(203, 213, 225, 0.82)', fontSize: 13 },
});
