import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

export const GrandTotalWithTax: React.FC<{
  subtotal: number;
  taxRate?: number;        // e.g., 0.0838 (8.38%)
  currency?: string;
}> = ({ subtotal, taxRate = 0, currency = "USD" }) => {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const tax = +(subtotal * taxRate);
  const grand = subtotal + tax;

  return (
    <View style={{ marginTop: 6 }}>
      {taxRate > 0 ? (
        <>
          <Row label={`Sales Tax (${(taxRate * 100).toFixed(2)}%)`} value={fmt(tax)} />
          <View style={styles.hrLight} />
          <View style={styles.totalBox}>
            <Row label="Grand Total" value={fmt(grand)} strong xl />
          </View>
        </>
      ) : (
        <Text style={styles.muted}>Sales Tax: Not Applicable</Text>
      )}
    </View>
  );
};

const Row = ({
  label,
  value,
  strong,
  xl,
}: {
  label: string;
  value: string;
  strong?: boolean;
  xl?: boolean;
}) => (
  <View style={styles.row}>
    <Text style={[styles.label, strong && styles.strong, xl && styles.xl]}>{label}</Text>
    <Text style={[styles.value, strong && styles.strong, xl && styles.xl]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  label: { fontSize: 11, color: "#1F2937" },
  value: { fontSize: 11, color: "#1F2937", textAlign: "right", minWidth: 120 },
  strong: { fontWeight: 700 },
  xl: { fontSize: 14 },
  hrLight: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 6 },
  totalBox: {
    backgroundColor: "#FAFAFA",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    border: "1px solid #E5E7EB",
  },
  muted: { fontSize: 9, color: "#6B7280" },
});



