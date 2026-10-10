import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '@/utils/haptics';

/** Reanimated is shimmed on web, so the chip animation only runs natively. */
const CAN_ANIMATE = Platform.OS !== 'web';
const CHIP_SPRING = { damping: 16, stiffness: 260, mass: 0.8 };

function pressIn(props: BottomTabBarButtonProps) {
  return (ev: Parameters<NonNullable<BottomTabBarButtonProps['onPressIn']>>[0]) => {
    if (!props.accessibilityState?.selected) haptic.select();
    props.onPressIn?.(ev);
  };
}

export function HapticTab(props: BottomTabBarButtonProps) {
  return <PlatformPressable {...props} onPressIn={pressIn(props)} />;
}

/** Bottom bar item. Selected tab gets a light mint chip behind the icon and label. */
export function PillHapticTab(props: BottomTabBarButtonProps) {
  const selected = Boolean(props.accessibilityState?.selected);
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, CHIP_SPRING);
  }, [selected, progress]);

  const chipBgStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value)),
    transform: [{ scale: 0.82 + 0.18 * progress.value }],
  }));

  return (
    <PlatformPressable
      {...props}
      onPressIn={pressIn(props)}
      style={[props.style, styles.hit]}
    >
      <View style={[styles.chip, !CAN_ANIMATE && selected && styles.chipSelected]}>
        {CAN_ANIMATE ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.chipSelected, styles.chipBg, chipBgStyle]}
          />
        ) : null}
        {props.children}
      </View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 2,
    minWidth: 68,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipBg: {
    borderRadius: 18,
    borderWidth: 1,
    margin: -1,
  },
  chipSelected: {
    backgroundColor: 'rgba(45, 204, 154, 0.16)',
    borderColor: 'rgba(45, 204, 154, 0.55)',
  },
});
