import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
export default function ProgressBar({ value = 0, emphasis = false }: { value: number; emphasis?: boolean }) {
  const h = emphasis ? 12 : 10;
  return (
    <View style={[styles.track, { height: h }]}>
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fill, { height: h, width: `${Math.min(Math.max(value,0),100)}%` }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { 
    width: "100%", 
    backgroundColor: "rgba(255, 255, 255, 0.1)", 
    borderRadius: 999, 
    overflow: "hidden" 
  },
  fill: { 
    borderRadius: 999,
  },
}); 