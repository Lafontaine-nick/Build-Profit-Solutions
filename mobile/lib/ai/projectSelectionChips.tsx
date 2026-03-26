/**
 * Project Selection Chips Component
 * 
 * Displays clickable chips for project selection in AI Assistant chat
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export type ProjectOption = {
  id: string;
  title: string;
  status?: string;
  lastOpened?: string;
};

type ProjectSelectionChipsProps = {
  options: ProjectOption[];
  onSelect: (projectId: string) => void;
  darkMode?: boolean;
  /** Compact mode: horizontal scroll, smaller chips, inline label */
  compact?: boolean;
  /** Preferred clarification label: "Which project do you want me to check?" or "Do you mean Jerry, Bob, or Nick?" */
  clarificationLabel?: string;
};

export default function ProjectSelectionChips({
  options,
  onSelect,
  darkMode = true,
  compact = false,
  clarificationLabel,
}: ProjectSelectionChipsProps) {
  const label = clarificationLabel ?? (options.length >= 2 && options.length <= 4
    ? `Do you mean ${options.map((o) => o.title).join(', ')}?`
    : 'Which project do you want me to check?');
  const handleSelect = (projectId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(projectId);
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={[styles.compactLabel, { color: darkMode ? '#FFFFFF' : '#64748b' }]}>
          {clarificationLabel ?? 'Select Project'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.compactScrollWrapper}
          contentContainerStyle={styles.compactScrollContent}
        >
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => handleSelect(option.id)}
              activeOpacity={0.7}
              style={styles.compactChipWrapper}
            >
              <LinearGradient
                colors={darkMode
                  ? ['rgba(45, 255, 196, 0.15)', 'rgba(0, 166, 255, 0.15)']
                  : ['rgba(45, 255, 196, 0.1)', 'rgba(0, 166, 255, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.compactChip}
              >
                <Text style={[styles.compactChipText, { color: darkMode ? '#F9FAFB' : '#1e293b' }]} numberOfLines={1}>
                  {option.title}
                  {option.status ? ` · ${option.status}` : ''}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: darkMode ? '#FFFFFF' : '#64748b' }]}>
        {label}
      </Text>
      <View style={styles.chipsContainer}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={option.id}
            onPress={() => handleSelect(option.id)}
            activeOpacity={0.7}
            style={styles.chipWrapper}
          >
            <LinearGradient
              colors={darkMode 
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
              {option.status && (
                <Text style={[styles.chipStatus, { color: darkMode ? '#FFFFFF' : '#64748b' }]}>
                  {option.status}
                </Text>
              )}
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
  // Compact mode
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    marginHorizontal: 0,
    gap: 8,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactScrollWrapper: {
    flex: 1,
    maxHeight: 36,
  },
  compactScrollContent: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingRight: 8,
  },
  compactChipWrapper: {
    marginRight: 0,
  },
  compactChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.3)',
    minWidth: 60,
  },
  compactChipText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 0,
  },
});
