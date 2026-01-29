// src/screens/Budget.tsx
import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import ThresholdSettingsSheet from "@/components/ThresholdSettingsSheet";
import { loadThresholds, Thresholds } from "@/src/lib/thresholds";
import { useBudgetAlerts } from "@/src/hooks/useBudgetAlerts";

export default function BudgetScreen({ route }: any) {
  const projectId = route.params.projectId as string;
  const nav = useNavigation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [thresholds, setThresholds] = useState<Thresholds>({
    overallPct: 10, materialsPct: 20, laborPct: 15, equipmentPct: 15,
  });

  // Example live numbers (replace with selectors from your context)
  const overall = { planned: 45000, projected: 52000 };
  const categories = [
    { name: "materials" as const, budget: 20000, projected: 26000 },
    { name: "labor" as const,     budget: 18000, projected: 21000 },
    { name: "equipment" as const, budget: 7000,  projected: 7500  },
  ];

  useEffect(() => { 
    (async () => setThresholds(await loadThresholds(projectId)))(); 
  }, [projectId]);

  const alerts = useBudgetAlerts({ 
    projectId, 
    thresholds, 
    overall, 
    categories, 
    notify: true 
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header line w/ Alerts & Thresholds button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💰 Budget</Text>
        <Pressable 
          onPress={() => setSheetOpen(true)} 
          style={styles.thresholdsButton}
        >
          <Text style={styles.thresholdsButtonText}>⚙️ Alerts & Thresholds</Text>
        </Pressable>
      </View>

      {/* Alert badges list */}
      {alerts.length > 0 && (
        <View style={styles.alertsSection}>
          <Text style={styles.alertsTitle}>🚨 Active Alerts</Text>
          {alerts.map((a) => (
            <View 
              key={a.id} 
              style={[
                styles.alertBadge,
                {
                  backgroundColor: a.level === "high" ? "#7f1d1d" : "#5a3b0b",
                  borderColor: a.level === "high" ? "#ef4444" : "#f59e0b",
                }
              ]}
            >
              <Text style={styles.alertIcon}>
                {a.level === "high" ? "🔴" : "⚠️"}
              </Text>
              <Text style={styles.alertMessage}>{a.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Budget Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Budget Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Planned Budget</Text>
          <Text style={styles.summaryValue}>${overall.planned.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Projected Cost</Text>
          <Text style={[styles.summaryValue, { color: overall.projected > overall.planned ? "#ef4444" : "#10b981" }]}>
            ${overall.projected.toLocaleString()}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Variance</Text>
          <Text style={[styles.summaryValue, { color: overall.projected > overall.planned ? "#ef4444" : "#10b981" }]}>
            {overall.projected > overall.planned ? "+" : ""}
            ${Math.abs(overall.projected - overall.planned).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Category cards - press to drill down */}
      <Text style={styles.sectionTitle}>Categories</Text>
      
      <CategoryCard
        title="Materials"
        budget={categories[0].budget}
        projected={categories[0].projected}
        subtitle="Tap for transactions"
        onPress={() => nav.navigate("CategoryDetail" as never, { projectId, category: "materials" } as never)}
      />
      <CategoryCard
        title="Labor"
        budget={categories[1].budget}
        projected={categories[1].projected}
        subtitle="Tap for transactions"
        onPress={() => nav.navigate("CategoryDetail" as never, { projectId, category: "labor" } as never)}
      />
      <CategoryCard
        title="Equipment"
        budget={categories[2].budget}
        projected={categories[2].projected}
        subtitle="Tap for transactions"
        onPress={() => nav.navigate("CategoryDetail" as never, { projectId, category: "equipment" } as never)}
      />

      <ThresholdSettingsSheet
        projectId={projectId}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={setThresholds}
      />
    </ScrollView>
  );
}

function CategoryCard({ 
  title, 
  budget,
  projected,
  subtitle, 
  onPress 
}: { 
  title: string; 
  budget: number;
  projected: number;
  subtitle?: string; 
  onPress: () => void;
}) {
  const variance = projected - budget;
  const variancePct = ((variance / budget) * 100).toFixed(1);
  const isOver = variance > 0;

  return (
    <Pressable onPress={onPress} style={styles.categoryCard}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryTitle}>{title}</Text>
        {isOver && (
          <View style={[styles.varianceBadge, { backgroundColor: "#7f1d1d", borderColor: "#ef4444" }]}>
            <Text style={styles.varianceText}>+{variancePct}%</Text>
          </View>
        )}
      </View>
      <View style={styles.categoryStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Budget</Text>
          <Text style={styles.statValue}>${budget.toLocaleString()}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Projected</Text>
          <Text style={[styles.statValue, { color: isOver ? "#ef4444" : "#10b981" }]}>
            ${projected.toLocaleString()}
          </Text>
        </View>
      </View>
      {subtitle ? <Text style={styles.categorySubtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#081a2d",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: {
    color: "white",
    fontSize: 28,
    fontWeight: "700",
  },
  thresholdsButton: {
    backgroundColor: "#17314f",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  thresholdsButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  alertsSection: {
    marginBottom: 12,
  },
  alertsTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  alertIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  alertMessage: {
    color: "white",
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  summaryCard: {
    backgroundColor: "#0f2540",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
  },
  summaryValue: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  sectionTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 8,
  },
  categoryCard: {
    backgroundColor: "#0f2540",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  varianceBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  varianceText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  categoryStats: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  categorySubtitle: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  rowInput: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    width: 80,
    color: "white",
    backgroundColor: "#17314f",
    padding: 10,
    borderRadius: 12,
    textAlign: "right",
    fontSize: 16,
    fontWeight: "600",
  },
  percentSign: {
    color: "white",
    marginLeft: 6,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 10,
  },
  cancelButton: {
    padding: 12,
    paddingHorizontal: 20,
  },
  cancelText: {
    color: "#9fb3c8",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#10b981",
    padding: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  saveText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
}); 