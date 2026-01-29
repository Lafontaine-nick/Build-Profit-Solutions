import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

export const PoweredBy = () => (
  <View style={styles.wrap}>
    <View style={styles.accent} />
    <Text style={styles.tagline}>Powered by Build Profit Solutions</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  accent: { height: 2, width: 40, backgroundColor: "#3B82F6", borderRadius: 2 },
  tagline: { fontSize: 9, color: "#9CA3AF" },
});



