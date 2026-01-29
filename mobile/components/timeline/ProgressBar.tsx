import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../src/theme/colors";
import { SURFACES } from "../../src/theme/surfaces";

export default function ProgressBar({ value = 0 }: { value: number }) {
  return (
    <View style={styles.track}>
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fill, { width: `${Math.min(Math.max(value,0),100)}%` }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { 
    width: "100%", 
    height: 10, 
    backgroundColor: "rgba(255, 255, 255, 0.1)", 
    borderRadius: 999, 
    overflow: "hidden" 
  },
  fill: { 
    height: 10, 
    borderRadius: 999,
  },
}); 