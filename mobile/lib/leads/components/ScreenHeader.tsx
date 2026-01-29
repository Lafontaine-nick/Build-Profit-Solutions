/**
 * Screen Header Component
 * Consistent header for all lead screens
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
    backgroundColor: 'transparent',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  metric: {
    color: '#49F2A8',
    fontSize: 16,
    fontWeight: '700',
  },
});



