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
    ? ['rgba(71, 85, 105, 0.42)', 'rgba(30, 41, 59, 0.72)']
    : ['rgba(226, 232, 240, 0.92)', 'rgba(203, 213, 225, 0.92)'];

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
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 2,
  },
  chipWrapperCompact: {
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 17,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.34)',
    minWidth: 120,
    overflow: 'hidden',
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 80,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  chipSubtext: {
    fontSize: 12,
    fontWeight: '500',
  },
});
