/**
 * Project Selection Chips Component
 * 
 * Displays clickable chips for project selection in AI Assistant chat
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
};

export default function ProjectSelectionChips({
  options,
  onSelect,
  darkMode = true,
}: ProjectSelectionChipsProps) {
  const handleSelect = (projectId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(projectId);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: darkMode ? '#8DA0B8' : '#64748b' }]}>
        Which project do you mean?
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
                <Text style={[styles.chipStatus, { color: darkMode ? '#8DA0B8' : '#64748b' }]}>
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
});
