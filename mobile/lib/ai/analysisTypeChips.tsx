/**
 * Analysis Type Selection Chips Component
 * 
 * Displays clickable chips for choosing quick health check vs full breakdown
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

type AnalysisTypeChipsProps = {
  onSelect: (type: 'quick' | 'full') => void;
  darkMode?: boolean;
};

export default function AnalysisTypeChips({
  onSelect,
  darkMode = true,
}: AnalysisTypeChipsProps) {
  const handleSelect = (type: 'quick' | 'full') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(type);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: darkMode ? '#FFFFFF' : '#64748b' }]}>
        Do you want a quick health check or full breakdown?
      </Text>
      <View style={styles.chipsContainer}>
        <TouchableOpacity
          onPress={() => handleSelect('quick')}
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
              Quick Health Check
            </Text>
            <Text style={[styles.chipSubtext, { color: darkMode ? '#FFFFFF' : '#64748b' }]}>
              Status, budget, progress
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => handleSelect('full')}
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
              Full Breakdown
            </Text>
            <Text style={[styles.chipSubtext, { color: darkMode ? '#FFFFFF' : '#64748b' }]}>
              Detailed analysis & insights
            </Text>
          </LinearGradient>
        </TouchableOpacity>
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
    flex: 1,
    minWidth: 140,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.3)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  chipSubtext: {
    fontSize: 11,
    fontWeight: '400',
  },
});
