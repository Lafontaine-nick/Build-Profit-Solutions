import React, { useEffect } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  /** Starting scale. 0.6 for icons, ~0.94 for cards. */
  from?: number;
};

const POP_SPRING = { damping: 14, stiffness: 220, mass: 0.8 };

/** Springs its children in on mount. Change `key` to replay. Static on web (Reanimated is shimmed). */
export default function PopIn({ children, style, delay = 0, from = 0.6 }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, POP_SPRING));
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value),
    transform: [{ scale: from + (1 - from) * progress.value }],
  }));

  if (Platform.OS === 'web') {
    return <View style={style}>{children}</View>;
  }
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
