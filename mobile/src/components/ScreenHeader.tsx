/**
 * ScreenHeader Component
 * Reusable header component for screens
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ScreenHeaderProps {
  title: string;
  metric?: string;
  subtitle?: string;
}

export function ScreenHeader({ title, metric, subtitle }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {metric && <Text style={styles.metric}>{metric}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
  },
  metric: {
    color: '#49F2A8',
    marginTop: 6,
    fontWeight: '700',
    fontSize: 16,
  },
});



