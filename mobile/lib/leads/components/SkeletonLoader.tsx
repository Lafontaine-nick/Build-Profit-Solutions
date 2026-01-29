/**
 * Skeleton Loader Component
 * Beautiful loading states for lead cards
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { c, radius } from '../ui/tokens';

export function LeadCardSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Animated.View style={[styles.title, { opacity }]} />
        <Animated.View style={[styles.badge, { opacity }]} />
      </View>
      <Animated.View style={[styles.line, { opacity }]} />
      <Animated.View style={[styles.subLine, { opacity }]} />
      <View style={styles.actions}>
        <Animated.View style={[styles.actionButton, { opacity }]} />
        <Animated.View style={[styles.actionButton, { opacity }]} />
        <Animated.View style={[styles.actionButton, { opacity }]} />
      </View>
    </View>
  );
}

export function LeadListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <LeadCardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  card: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    width: '60%',
    height: 20,
    backgroundColor: '#ffffff20',
    borderRadius: 4,
  },
  badge: {
    width: 44,
    height: 30,
    backgroundColor: '#ffffff20',
    borderRadius: 12,
  },
  line: {
    width: '80%',
    height: 16,
    backgroundColor: '#ffffff15',
    borderRadius: 4,
    marginBottom: 8,
  },
  subLine: {
    width: '60%',
    height: 14,
    backgroundColor: '#ffffff10',
    borderRadius: 4,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    width: 60,
    height: 24,
    backgroundColor: '#ffffff15',
    borderRadius: 6,
  },
});





