import React from "react";
import { Pressable, Platform, type StyleProp, type ViewStyle } from "react-native";
import {
  neutralIconPressableProps,
  neutralIconPressableWebStyle,
} from "@/constants/iconPressable";

export type GradientRingBackInnerProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Matches theme — picks a neutral ripple (not the default theme blue). */
  darkMode: boolean;
  children: React.ReactNode;
  accessibilityLabel?: string;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
};

/**
 * Inner hit target for gradient-ring header backs. Uses Pressable + explicit
 * neutral android_ripple so the circle does not flash the default theme color.
 */
export default function GradientRingBackInner({
  onPress,
  style,
  darkMode,
  children,
  accessibilityLabel = "Go back",
  hitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
}: GradientRingBackInnerProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={hitSlop}
      {...neutralIconPressableProps(darkMode)}
      style={({ pressed }) => [
        style,
        neutralIconPressableWebStyle(),
        Platform.OS === "ios" && pressed ? { opacity: 0.88 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
