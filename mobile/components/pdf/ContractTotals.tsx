import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

type TotalsProps = {
  materialsTotal: number;
  laborTotal: number;
  currency?: string;            // default: USD
  noteConsumables?: string;     // optional override
};

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

export const ContractTotals: React.FC<TotalsProps> = ({
  materialsTotal,
  laborTotal,
  currency = "USD",
  noteConsumables = "Minor consumables (fasteners, adhesives, caulk, tape, etc.) are included in the Materials total and not itemized individually."
}) => {
  const subtotal = materialsTotal + laborTotal;

  return (
    <View style={styles.wrap}>
      {/* Divider above totals */}
      <View style={styles.hr} />

      <Row label="Materials" value={fmt(materialsTotal, currency)} strong />
      <DividerLight />

      <Row label="Labor" value={fmt(laborTotal, currency)} strong />
      <DividerLight />

      <Row label="Subtotal" value={fmt(subtotal, currency)} strong />
      <View style={styles.thickDivider} />

      {/* Shaded total box */}
      <View style={styles.totalBox}>
        <Row label="TOTAL" value={fmt(subtotal, currency)} xl strong />
      </View>

      {/* Consumables note */}
      <Text style={styles.note}><Text style={{fontStyle:'italic'}}>{noteConsumables}</Text></Text>
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

const DividerLight = () => <View style={styles.hrLight} />;

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginVertical: 4,
  },
  label: { fontSize: 11, color: "#1F2937" },
  value: { fontSize: 11, color: "#1F2937", textAlign: "right", minWidth: 120 },
  strong: { fontWeight: 700 },
  xl: { fontSize: 14 },
  hr: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  hrLight: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 4 },
  thickDivider: { height: 2, backgroundColor: "#111827", marginVertical: 10 },
  totalBox: {
    backgroundColor: "#FAFAFA",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    border: "1px solid #E5E7EB",
    marginBottom: 8,
  },
  note: { fontSize: 9, color: "#6B7280", marginTop: 6, lineHeight: 1.4 },
});



