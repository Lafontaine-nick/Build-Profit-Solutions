import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { haptic } from '@/utils/haptics';

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
  return (
    <PlatformPressable
      {...props}
      onPressIn={pressIn(props)}
      style={[props.style, styles.hit]}
    >
      <View style={[styles.chip, selected && styles.chipSelected]}>{props.children}</View>
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
  chipSelected: {
    backgroundColor: 'rgba(45, 204, 154, 0.16)',
    borderColor: 'rgba(45, 204, 154, 0.55)',
  },
});
