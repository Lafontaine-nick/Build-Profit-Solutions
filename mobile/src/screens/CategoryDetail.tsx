// src/screens/CategoryDetail.tsx
import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { formatMoneyFull } from "@/src/lib/budgetUtils";

type Txn = { id: string; date: string; vendor: string; amount: number; po?: string };

const mockTxns: Record<string, Txn[]> = {
  materials: [
    { id: "1", date: "2025-09-01", vendor: "Home Depot", amount: 1250.43, po: "PO-1003" },
    { id: "2", date: "2025-09-04", vendor: "Lowe's", amount: 842.12 },
    { id: "3", date: "2025-09-08", vendor: "Ferguson", amount: 3420.75, po: "PO-1005" },
    { id: "4", date: "2025-09-15", vendor: "Home Depot", amount: 2105.88 },
  ],
  labor: [
    { id: "3", date: "2025-09-03", vendor: "Crew A – Week 35", amount: 3200.0 },
    { id: "4", date: "2025-09-10", vendor: "Crew A – Week 36", amount: 3200.0 },
    { id: "5", date: "2025-09-17", vendor: "Crew B – Week 37", amount: 2800.0 },
  ],
  equipment: [
    { id: "4", date: "2025-09-02", vendor: "Sunbelt Rentals", amount: 410.0, po: "PO-1021" },
    { id: "5", date: "2025-09-09", vendor: "United Rentals", amount: 825.0 },
  ],
};

export default function CategoryDetail({ route }: any) {
  const { category } = route.params as { projectId: string; category: "materials" | "labor" | "equipment" };
  const data = mockTxns[category] || [];

  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {category[0].toUpperCase() + category.slice(1)}
        </Text>
        <Text style={styles.headerSubtitle}>Transactions</Text>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Spent</Text>
          <Text style={styles.totalValue}>{formatMoneyFull(total, { decimals: 2 })}</Text>
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.transactionCard}>
            <View style={styles.transactionHeader}>
              <Text style={styles.vendor}>{item.vendor}</Text>
              <Text style={styles.amount}>{formatMoneyFull(item.amount, { decimals: 2 })}</Text>
            </View>
            <Text style={styles.date}>
              {new Date(item.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </Text>
            {item.po && (
              <View style={styles.poBadge}>
                <Text style={styles.poText}>📋 {item.po}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#081a2d",
  },
  header: {
    padding: 16,
    backgroundColor: "#0f2540",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    color: "white",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginBottom: 16,
  },
  totalCard: {
    backgroundColor: "#17314f",
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "500",
  },
  totalValue: {
    color: "#10b981",
    fontSize: 20,
    fontWeight: "700",
  },
  list: {
    padding: 16,
    gap: 10,
  },
  transactionCard: {
    backgroundColor: "#0f2540",
    padding: 14,
    borderRadius: 14,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  vendor: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    flex: 1,
  },
  amount: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  date: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginBottom: 6,
  },
  poBadge: {
    backgroundColor: "#17314f",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  poText: {
    color: "#9fb3c8",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
  },
}); 