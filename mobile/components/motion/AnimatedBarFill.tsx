import React, { useEffect } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** 0–100. Values outside the range are clamped. */
  percent: number;
  /** Fill styles (height, radius, color). Width is controlled here. */
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  /** Optional content revealed left-to-right as the fill grows (add overflow: 'hidden' to style). */
  children?: React.ReactNode;
};

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

/** Progress-bar fill that grows from 0 on mount and eases to new values. Static on web (Reanimated is shimmed). */
export default function AnimatedBarFill({
  percent,
  style,
  delay = 0,
  duration = 700,
  children,
}: Props) {
  const target = clamp(percent);
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      delay,
      withTiming(target, { duration, easing: Easing.out(Easing.cubic) })
    );
  }, [target, delay, duration, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  if (Platform.OS === 'web') {
    return <View style={[style, { width: `${target}%` }]}>{children}</View>;
  }
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
