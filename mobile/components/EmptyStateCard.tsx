import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface EmptyStateCardProps {
  onPress: () => void;
  subtitle?: string;
}

export default function EmptyStateCard({ onPress, subtitle }: EmptyStateCardProps) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(34, 197, 94, 0.15)', 'rgba(34, 211, 238, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="description" size={32} color="#22c55e" />
          </View>
          <Text style={styles.title}>Create your first estimate</Text>
          <Text style={styles.body}>
            Start with scope, labor, and materials.{'\n'}
            We'll help you protect profit as you go.
          </Text>
          {subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onPress();
            }}
            activeOpacity={0.8}
            style={styles.button}
          >
            <MaterialIcons name="add" size={20} color="#000000" />
            <Text style={styles.buttonText}>New Estimate</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    borderRadius: 20,
    padding: 2,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    backgroundColor: '#1a1a1a',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
