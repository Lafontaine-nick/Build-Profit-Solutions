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
  children: React.ReactNode;
  /** Position in the list; later items wait a little longer. */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

const STEP_MS = 45;
const MAX_DELAY_MS = 315;

/** Fades and lifts a list item in on mount, staggered by index. Static on web (Reanimated is shimmed). */
export default function StaggerIn({ children, index = 0, style }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      Math.min(index * STEP_MS, MAX_DELAY_MS),
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    );
    // Mount-only: re-renders with a new index should not replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: 14 * (1 - progress.value) }],
  }));

  if (Platform.OS === 'web') {
    return <View style={style}>{children}</View>;
  }
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
