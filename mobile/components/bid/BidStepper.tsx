import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function BidStepper({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Text style={s.title}>Personal Bid Builder</Text>
        <Text style={s.pct}>{pct}%</Text>
      </View>
      <View style={s.track}><View style={[s.fill, { width: `${pct}%` }]} /></View>
      <Text style={s.sub}>{current} of {total} steps completed</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: "#173659", borderRadius: 20, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#e9f1ff", fontSize: 20, fontWeight: "800" },
  pct: { color: "#e9f1ff", fontWeight: "900" },
  track: { height: 10, backgroundColor: "#1f3c66", borderRadius: 999, marginTop: 8 },
  fill: { height: 10, backgroundColor: "#38d39f", borderRadius: 999 },
  sub: { color: "#a7bed9", marginTop: 6 }
}); 