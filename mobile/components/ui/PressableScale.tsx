import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { haptic, type HapticKind } from '@/utils/haptics';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  /** Visual styles; scales with the press. */
  style?: StyleProp<ViewStyle>;
  /** Layout/position styles (absolute, margins, alignSelf) for the outer touch target. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Scale while pressed. Rows use ~0.98, buttons ~0.97. */
  scaleTo?: number;
  haptic?: HapticKind;
};

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduce(value))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export default function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = 0.97,
  haptic: hapticKind,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();

  const animateTo = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      reduceMotion
        ? Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true })
        : Animated.spring(scale, {
            toValue: toScale,
            useNativeDriver: true,
            speed: 40,
            bounciness: toScale < 1 ? 0 : 6,
          }),
      Animated.timing(opacity, { toValue: toOpacity, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      {...rest}
      style={containerStyle}
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        animateTo(scaleTo, 0.85);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        animateTo(1, 1);
        onPressOut?.(e);
      }}
      onPress={(e: GestureResponderEvent) => {
        if (hapticKind) haptic[hapticKind]();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>{children}</Animated.View>
    </Pressable>
  );
}
