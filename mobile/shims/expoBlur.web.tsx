import React from 'react';
import { View, type ViewProps } from 'react-native';

/**
 * Web substitute for `expo-blur` `BlurView`. Real blur uses native + worklets and is a
 * frequent source of Metro web crashes, Safari glitches, and blank regions.
 */
export type BlurViewProps = ViewProps & {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent';
  blurReductionFactor?: number;
};

export function BlurView({
  intensity = 50,
  tint = 'light',
  style,
  children,
  pointerEvents = 'box-none',
  ...rest
}: BlurViewProps) {
  const isDark = tint === 'dark' || tint === 'prominent';
  const clamped = Math.min(100, Math.max(0, intensity));
  const alpha = Math.min(0.92, 0.26 + (clamped / 100) * 0.55);
  const backgroundColor = isDark
    ? `rgba(15, 23, 42, ${alpha})`
    : `rgba(255, 255, 255, ${alpha})`;

  return (
    <View {...rest} pointerEvents={pointerEvents} style={[{ backgroundColor, overflow: 'hidden' }, style]}>
      {children}
    </View>
  );
}
