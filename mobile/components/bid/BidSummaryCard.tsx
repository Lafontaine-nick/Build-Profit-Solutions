import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { BidState } from "../../src/types/bid";

function money(n = 0) { 
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }); 
}

export default function BidSummaryCard({ bid }: { bid: BidState }) {
  const calc = useMemo(() => {
    const materials = bid.materials.reduce((a, b) => a + (b.cost || 0), 0);
    const labor = bid.labor.reduce((a, b) => a + (b.cost || 0), 0);
    const direct = materials + labor;
    const overhead = direct * (bid.overheadPct / 100);
    const contingency = (direct + overhead) * (bid.contingencyPct / 100);
    const subtotal = direct + overhead + contingency;
    const profit = subtotal * (bid.markupPct / 100);
    const total = subtotal + profit;
    return { materials, labor, overhead, contingency, profit, total, subtotal };
  }, [bid]);

  return (
    <View style={s.card}>
      <Text style={s.h}>Live Bid Summary</Text>
      <Row label="Materials" value={money(calc.materials)} />
      <Row label="Labor" value={money(calc.labor)} />
      <Row label={`Overhead (${bid.overheadPct}%)`} value={money(calc.overhead)} />
      <Row label={`Contingency (${bid.contingencyPct}%)`} value={money(calc.contingency)} />
      <Row label={`Markup / Profit (${bid.markupPct}%)`} value={money(calc.profit)} bold />
      <View style={s.sep} />
      <Row label="Total" value={money(calc.total)} big />
    </View>
  );
}

const Row = ({ label, value, bold, big }: { label: string; value: string; bold?: boolean; big?: boolean }) => (
  <View style={s.row}>
    <Text style={[s.label, bold && { fontWeight: "800" }]}>{label}</Text>
    <Text style={[s.val, big && { fontSize: 20, fontWeight: "900" }]}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  card: { backgroundColor: "#173659", borderRadius: 16, padding: 14 },
  h: { color: "#e9f1ff", fontWeight: "800", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  label: { color: "#a7bed9" },
  val: { color: "#e9f1ff", fontWeight: "800" },
  sep: { height: 1, backgroundColor: "#1f3c66", marginVertical: 10 }
}); 