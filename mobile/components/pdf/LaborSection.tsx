import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

type LaborItem = {
  task?: string;        // e.g., "Demolition"
  amount: number;
};

export const LaborSection: React.FC<{ items: LaborItem[]; currency?: string }> = ({
  items,
  currency = "USD",
}) => {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const safeLabel = (t?: string) => t?.trim() || "To be determined (scope pending)";

  const subtotal = items.reduce((s, i) => s + (i?.amount || 0), 0);

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.h}>LABOR</Text>
      <View style={styles.hr} />
      {items.map((it, idx) => (
        <View key={idx} style={styles.row}>
          <Text style={styles.desc}>{`Labor — ${safeLabel(it.task)}`}</Text>
          <Text style={styles.amount}>{fmt(it.amount)}</Text>
        </View>
      ))}
      <View style={styles.hrLight} />
      <View style={styles.row}>
        <Text style={[styles.desc, { fontWeight: 700 }]}>Section Subtotal</Text>
        <Text style={[styles.amount, { fontWeight: 700 }]}>{fmt(subtotal)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  h: { fontSize: 12, fontWeight: 700, letterSpacing: 0.2 },
  hr: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 6 },
  hrLight: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  desc: { fontSize: 10, color: "#1F2937" },
  amount: { fontSize: 10, color: "#1F2937", textAlign: "right", minWidth: 100 },
});



