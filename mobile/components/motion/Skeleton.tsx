import React, { useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useReduceMotion } from './useReduceMotion';

type BlockProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

const CAN_ANIMATE = Platform.OS !== 'web';

/** Pulsing placeholder block. Static on web and with Reduce Motion. */
export function SkeletonBlock({ width = '100%', height = 12, radius = 6, style }: BlockProps) {
  const { darkMode } = useTheme();
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    if (!CAN_ANIMATE || reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const base = [
    {
      width,
      height,
      borderRadius: radius,
      backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.28)',
    },
    style,
  ];

  if (!CAN_ANIMATE || reduceMotion) {
    return <View style={[base, { opacity: 0.75 }]} />;
  }
  return <Animated.View style={[base, animatedStyle]} />;
}

type RowsProps = {
  count?: number;
  /** Leading circle, e.g. for avatars. */
  avatar?: boolean;
  /** Trailing short block, e.g. a money value or status pill. */
  trailing?: boolean;
  /** Thin progress bar under each row. */
  progress?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** List-shaped loading placeholder. */
export function SkeletonRows({
  count = 3,
  avatar = false,
  trailing = true,
  progress = false,
  style,
  accessibilityLabel = 'Loading',
}: RowsProps) {
  return (
    <View
      style={[styles.rows, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.rowTop}>
            {avatar ? <SkeletonBlock width={40} height={40} radius={20} /> : null}
            <View style={styles.rowText}>
              <SkeletonBlock width={i % 2 === 0 ? '62%' : '48%'} height={14} />
              <SkeletonBlock width={i % 2 === 0 ? '38%' : '52%'} height={11} style={styles.subLine} />
            </View>
            {trailing ? <SkeletonBlock width={64} height={20} radius={10} /> : null}
          </View>
          {progress ? <SkeletonBlock height={6} radius={999} style={styles.progress} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: 20,
    paddingVertical: 4,
  },
  row: {
    gap: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  subLine: {
    marginTop: 8,
  },
  progress: {
    marginTop: 2,
  },
});
