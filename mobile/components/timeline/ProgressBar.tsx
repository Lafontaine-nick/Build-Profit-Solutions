import React from "react";
import { View, StyleSheet } from "react-native";

export default function ProgressBar({ value = 0, emphasis = false }: { value: number; emphasis?: boolean }) {
  const h = emphasis ? 8 : 8;
  const width = Math.min(Math.max(value, 0), 100);
  return (
    <View style={[styles.track, { height: h }]} pointerEvents="none">
      {width > 0 ? (
        <View style={[styles.fill, { height: h, width: `${width}%` }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    borderRadius: 999,
    backgroundColor: "#2dcc9a",
  },
});
