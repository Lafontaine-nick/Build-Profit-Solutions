import React from "react";
import { View, Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const BUDGET_FRAME_COLORS: [string, string] = ["#2DFFC4", "#00A6FF"];

export type WebFormGradientFrameProps = {
  children: React.ReactNode;
  /** Inner panel fill (matches modal / screen theme). */
  innerBackgroundColor?: string;
  /** Outer ring corner radius; inner is one less (1px ring). Defaults to 30 (Budget Categories forms). */
  ringBorderRadius?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
};

/**
 * Budget Categories–style green→cyan ring around form content.
 * Web only; native renders children with no wrapper.
 */
const DEFAULT_RING_BORDER_RADIUS = 30;

export default function WebFormGradientFrame({
  children,
  innerBackgroundColor = "#000000",
  ringBorderRadius = DEFAULT_RING_BORDER_RADIUS,
  style,
  innerStyle,
}: WebFormGradientFrameProps) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  const innerRadius = Math.max(0, ringBorderRadius - 1);

  return (
    <LinearGradient
      colors={BUDGET_FRAME_COLORS}
      start={{ x: 0.05, y: 0.15 }}
      end={{ x: 0.95, y: 0.85 }}
      style={[styles.ring, { borderRadius: ringBorderRadius }, style]}
    >
      <View
        style={[
          styles.inner,
          { borderRadius: innerRadius, backgroundColor: innerBackgroundColor },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  /** Default: height follows children. Pass `style={{ flex: 1 }}` when the frame should fill a flex parent (e.g. Add Material). */
  ring: {
    width: "100%",
    alignSelf: "stretch",
    padding: 1,
    overflow: "hidden",
  },
  inner: {
    width: "100%",
    alignSelf: "stretch",
    overflow: "hidden",
  },
});
