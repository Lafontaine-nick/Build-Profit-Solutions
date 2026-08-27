import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface EmptyStateCardProps {
  /** Manual estimate walkthrough (Steps 1–10). */
  onPress: () => void;
  /** Primary path — Build with AI modal. */
  onBuildWithAi?: () => void;
  subtitle?: string;
}

export default function EmptyStateCard({
  onPress,
  onBuildWithAi,
  subtitle,
}: EmptyStateCardProps) {
  const aiFirst = Boolean(onBuildWithAi);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(45, 255, 196, 0.14)', 'rgba(0, 166, 255, 0.1)']}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={styles.card}
      >
        <View style={styles.content}>
          <LinearGradient
            colors={['#2DFFC4', '#00A6FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <MaterialIcons name="auto-awesome" size={28} color="#0f172a" />
          </LinearGradient>
          <Text style={styles.title}>
            {aiFirst ? 'Build your first estimate with AI' : 'Create your first estimate'}
          </Text>
          <Text style={styles.body}>
            {aiFirst
              ? 'Paste job notes, add photos, or import a plan.\nAI drafts scope for you to review.'
              : "Start with scope, labor, and materials.\nWe'll help you protect profit as you go."}
          </Text>
          {subtitle && !aiFirst ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {aiFirst ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onBuildWithAi?.();
                }}
                activeOpacity={0.88}
                style={styles.primaryButton}
              >
                <MaterialIcons name="auto-awesome" size={20} color="#0f172a" />
                <Text style={styles.primaryButtonText}>Build with AI</Text>
              </TouchableOpacity>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onPress();
                }}
                style={({ pressed }) => [styles.manualLink, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Text style={styles.manualLinkText}>Start manually instead</Text>
              </Pressable>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onPress();
              }}
              activeOpacity={0.8}
              style={styles.primaryButton}
            >
              <MaterialIcons name="add" size={20} color="#0f172a" />
              <Text style={styles.primaryButtonText}>New Estimate</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 24,
  },
  card: {
    borderRadius: 20,
    padding: 1,
    alignSelf: 'stretch',
    width: '100%',
  },
  content: {
    backgroundColor: '#141416',
    borderRadius: 19,
    padding: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f9fafb',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 22,
    gap: 8,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  manualLink: {
    marginTop: 14,
    paddingVertical: 6,
  },
  manualLinkText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
});
