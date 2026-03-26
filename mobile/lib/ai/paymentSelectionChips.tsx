/**
 * Payment Selection Chips Component
 *
 * Displays clickable cards for payment selection in AI Assistant chat.
 * Mirrors the project selection card UI with title, status, and optional meta (amount, due date).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export type PaymentOption = {
  id: string;
  title: string;
  status?: string;
  amount?: number;
  dueDate?: string;
};

type PaymentSelectionChipsProps = {
  options: PaymentOption[];
  onSelect: (paymentId: string, paymentTitle: string) => void;
  darkMode?: boolean;
  /** Preferred clarification label */
  clarificationLabel?: string;
};

function formatAmount(amount: number): string {
  if (amount <= 0) return '';
  return `$${Number(amount).toLocaleString()}`;
}

function formatDueDate(dueDate?: string): string {
  if (!dueDate) return '';
  try {
    const d = new Date(dueDate);
    if (isNaN(d.getTime())) return '';
    const month = d.toLocaleString('default', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day}`;
  } catch {
    return '';
  }
}

export default function PaymentSelectionChips({
  options,
  onSelect,
  darkMode = true,
  clarificationLabel,
}: PaymentSelectionChipsProps) {
  const label = clarificationLabel ?? 'Which payment should I mark as completed?';

  const handleSelect = (paymentId: string, paymentTitle: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(paymentId, paymentTitle);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: darkMode ? '#F3F4F6' : '#64748b' }]}>
        {label}
      </Text>
      <View style={styles.chipsContainer}>
        {options.map((option) => {
          const amountStr = option.amount != null && option.amount > 0 ? formatAmount(option.amount) : '';
          const dueStr = formatDueDate(option.dueDate);
          const status = option.status ?? 'Pending';
          const subtitleParts = [status, amountStr, dueStr].filter(Boolean);
          const subtitle = subtitleParts.join(' · ');

          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => handleSelect(option.id, option.title)}
              activeOpacity={0.7}
              style={styles.chipWrapper}
            >
              <LinearGradient
                colors={
                  darkMode
                    ? ['rgba(45, 255, 196, 0.15)', 'rgba(0, 166, 255, 0.15)']
                    : ['rgba(45, 255, 196, 0.1)', 'rgba(0, 166, 255, 0.1)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.chip}
              >
                <Text style={[styles.chipText, { color: darkMode ? '#F9FAFB' : '#1e293b' }]}>
                  {option.title}
                </Text>
                <Text style={[styles.chipStatus, { color: darkMode ? '#F3F4F6' : '#64748b' }]}>
                  {subtitle}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipWrapper: {
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.3)',
    minWidth: 120,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  chipStatus: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});
