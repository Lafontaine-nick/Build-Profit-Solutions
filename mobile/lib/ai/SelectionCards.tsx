/**
 * SelectionCards — Reusable green-card selection component
 *
 * Shared foundation for all selection flows (expense type, PO, scenario, etc.).
 * Matches the visual style of ProjectSelectionChips and PaymentSelectionChips.
 * Existing components (Project, Payment, Analysis) remain unchanged and can
 * optionally migrate to use this internally later.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export type SelectionOption = {
  id: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
  type?: string;
};

type SelectionCardsProps = {
  options: SelectionOption[];
  onSelect: (id: string, option: SelectionOption) => void;
  label?: string;
  darkMode?: boolean;
  compact?: boolean;
  maxOptions?: number;
};

export default function SelectionCards({
  options,
  onSelect,
  label,
  darkMode = true,
  compact = false,
  maxOptions,
}: SelectionCardsProps) {
  const displayOptions = maxOptions ? options.slice(0, maxOptions) : options;

  const handleSelect = (option: SelectionOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(option.id, option);
  };

  const labelColor = darkMode ? '#F3F4F6' : '#64748b';
  const textColor = darkMode ? '#F9FAFB' : '#1e293b';
  const subtextColor = darkMode ? '#F3F4F6' : '#64748b';
  const gradientColors: readonly [string, string] = darkMode
    ? ['rgba(45, 255, 196, 0.15)', 'rgba(0, 166, 255, 0.15)']
    : ['rgba(45, 255, 196, 0.1)', 'rgba(0, 166, 255, 0.1)'];

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      ) : null}
      <View style={styles.chipsContainer}>
        {displayOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            onPress={() => handleSelect(option)}
            activeOpacity={0.7}
            style={[styles.chipWrapper, compact && styles.chipWrapperCompact]}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.chip, compact && styles.chipCompact]}
            >
              <Text style={[styles.chipText, { color: textColor }]} numberOfLines={1}>
                {option.title}
              </Text>
              {option.subtitle ? (
                <Text style={[styles.chipSubtext, { color: subtextColor }]} numberOfLines={1}>
                  {option.subtitle}
                </Text>
              ) : null}
            </LinearGradient>
          </TouchableOpacity>
        ))}
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
  chipWrapperCompact: {
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.3)',
    minWidth: 120,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 80,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  chipSubtext: {
    fontSize: 11,
    fontWeight: '500',
  },
});
