import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

type MaterialItem = {
  description: string;
  quantity?: number;
  unit?: string;
  materials?: number;
  section?: string;
};

type MaterialsSectionProps = {
  items: MaterialItem[];
  currency?: string;
  minVisibleAmount?: number; // Default $75 - hide items below this
};

export const MaterialsSection: React.FC<MaterialsSectionProps> = ({
  items,
  currency = "USD",
  minVisibleAmount = 75,
}) => {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  // Group materials by section
  const grouped: Record<string, MaterialItem[]> = {};
  const visibleItems = items.filter((it) => (it.materials ?? 0) >= minVisibleAmount);
  
  visibleItems.forEach((item) => {
    const section = item.section || "General Materials";
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(item);
  });

  const sections = Object.keys(grouped).sort();

  return (
    <View style={{ marginTop: 12 }}>
      {sections.map((section) => {
        const sectionItems = grouped[section];
        const sectionSubtotal = sectionItems.reduce((s, it) => s + (it.materials ?? 0), 0);

        return (
          <View key={section} style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeader}>MATERIALS — {section.toUpperCase()}</Text>
            <View style={styles.hr} />
            
            {sectionItems.map((it, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={styles.desc}>
                  {it.description}
                  {it.quantity && it.quantity > 1 ? ` (${it.quantity} ${it.unit || 'ea'})` : ''}
                </Text>
                <Text style={styles.amount}>{fmt(it.materials ?? 0)}</Text>
              </View>
            ))}
            
            <View style={styles.hrLight} />
            <View style={styles.row}>
              <Text style={[styles.desc, { fontWeight: 700 }]}>Section Subtotal</Text>
              <Text style={[styles.amount, { fontWeight: 700 }]}>{fmt(sectionSubtotal)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionHeader: { 
    fontSize: 12, 
    fontWeight: 700, 
    letterSpacing: 0.2,
    backgroundColor: "#FBFBFB",
    padding: 6,
  },
  hr: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 6 },
  hrLight: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 6 },
  row: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginVertical: 3,
    paddingHorizontal: 4,
  },
  desc: { fontSize: 10, color: "#1F2937", flex: 1 },
  amount: { fontSize: 10, color: "#1F2937", textAlign: "right", minWidth: 100 },
});



