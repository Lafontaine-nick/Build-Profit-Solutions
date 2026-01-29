import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, COLORS } from "../../src/theme/colors";
import type { Milestone } from "../../src/types/timeline";

function money(n?: number) {
  if (n === undefined) return "—";
  const sign = n >= 0 ? "+" : "−";
  const abs = Math.abs(n);
  const suffix =
    abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M` :
    abs >= 1_000 ? `${(abs / 1_000).toFixed(1)}K` :
    `${abs}`;
  return `${sign}$${suffix}`;
}

function daysLate(plannedISO: string, pct: number, status: Milestone["status"]) {
  if (status === "completed") return 0;
  if (status === "in_progress") return 0;
  if (pct >= 100) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const planned = new Date(plannedISO + "T00:00:00");
  planned.setHours(0, 0, 0, 0);

  const diff = Math.floor((today.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function StatusPill({ status }: { status: Milestone["status"] }) {
  const isCompleted = status === "completed";
  const isPending = status === "pending";

  const badgeStyle = isCompleted
    ? styles.badgeCompleted
    : isPending
    ? styles.badgePending
    : styles.badgeInProgress;

  const badgeTextStyle = isCompleted
    ? styles.badgeTextCompleted
    : isPending
    ? styles.badgeTextPending
    : styles.badgeTextInProgress;

  const label = isCompleted ? "Completed" : isPending ? "Pending" : "In Progress";

  return (
    <View style={[styles.badgeBase, badgeStyle]}>
      <Text style={[styles.badgeTextBase, badgeTextStyle]}>{label}</Text>
    </View>
  );
}

// ✅ MATCH PROJECT CARD FEEL
const CARD_GLOW = "rgba(21, 224, 138, 0.10)";

export default memo(function MilestoneCard({
  item,
  onPress,
  dependencyTitle,
  cardColors,
  borderColor,
}: {
  item: Milestone;
  dependencyTitle?: string;
  onPress?: (m: Milestone) => void;
  cardColors?: readonly [string, string, ...string[]];
  borderColor?: string;
}) {
  const lateDays = daysLate(item.plannedDate, item.progressPct, item.status);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  };

  const gradientColors = cardColors ?? ["rgba(16, 242, 151, 0.07)", "rgba(16, 242, 151, 0)"];
  const cardBorderColor = borderColor ?? "#102131";

  return (
    <TouchableOpacity
      onPress={() => {
        console.log('🖱️ MilestoneCard pressed:', item.id, item.title);
        onPress?.(item);
      }}
      activeOpacity={0.85}
      style={[styles.cardContainer, { borderColor: cardBorderColor }]}
    >
      <LinearGradient
        colors={gradientColors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}
      >
        <View style={styles.glowOverlay} />

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
          </View>

          <View style={styles.rightHeader}>
            {!!item.amount && item.amount > 0 && (
              <View style={styles.amountPill}>
                <Text style={styles.amountText}>${item.amount.toLocaleString()}</Text>
              </View>
            )}
            <Text style={styles.percentText}>{Math.round(item.progressPct)}%</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <StatusPill status={item.status} />
          <Text style={styles.dateText}>{formatDate(item.plannedDate)}</Text>
          {lateDays > 0 && <Text style={styles.overdue}> • {lateDays}d late</Text>}
        </View>

        {item.assignee && <Text style={styles.metaText}>Assigned: {item.assignee}</Text>}

        {item.costDelta !== undefined && (
          <Text style={styles.costImpactText}>
            Cost Impact: {money(item.costDelta)}
            {item.costCategory &&
              ` → ${item.costCategory.charAt(0).toUpperCase() + item.costCategory.slice(1)}`}
          </Text>
        )}

        {dependencyTitle && <Text style={styles.dependsText}>Depends on: {dependencyTitle}</Text>}

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(0, Math.min(100, item.progressPct))}%` },
            ]}
          />
        </View>

        {(item.attachmentsCount || item.notesCount) ? (
          <Text style={styles.attach}>
            📎 {item.attachmentsCount ?? 0} files   •   📝 {item.notesCount ?? 0} notes
          </Text>
        ) : null}
      </LinearGradient>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 16,
    marginTop: 12,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    // borderColor will be set via inline style
  },
  card: {
    borderRadius: 20,
    padding: 16,
    position: "relative",
  },
  glowOverlay: {
    position: "absolute",
    left: -40,
    top: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: CARD_GLOW,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  rightHeader: {
    alignItems: "flex-end",
    gap: 8,
  },
  amountPill: {
    backgroundColor: "#15E08A",
    borderWidth: 1,
    borderColor: "rgba(21, 224, 138, 0.3)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  amountText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  percentText: {
    color: "rgba(234,241,255,0.75)",
    fontSize: 16,
    fontWeight: "700",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 6,
  },

  badgeBase: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeTextBase: {
    fontSize: 14,
    fontWeight: "800",
  },

  badgeCompleted: {
    backgroundColor: "#15E08A",
    borderColor: "rgba(21, 224, 138, 0.3)",
  },
  badgeTextCompleted: { color: "#FFFFFF" },

  badgePending: {
    backgroundColor: COLORS.slateSoft,
    borderColor: "rgba(148,163,184,0.28)",
  },
  badgeTextPending: { color: COLORS.slateText },

  badgeInProgress: {
    borderColor: "rgba(21, 224, 138, 0.25)",
  },
  badgeTextInProgress: { color: "#FFFFFF" },

  dateText: {
    color: "rgba(234,241,255,0.7)",
    fontSize: 16,
    fontWeight: "700",
  },
  metaText: {
    color: "rgba(234,241,255,0.65)",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  costImpactText: {
    color: "#C7E3F7",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  dependsText: {
    color: "rgba(234,241,255,0.55)",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 6,
  },

  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 14,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.green,
    opacity: 0.85,
  },

  overdue: {
    color: Colors.red,
    fontSize: 16,
    fontWeight: "700",
  },

  attach: {
    color: COLORS.subtext,
    marginTop: 10,
    fontSize: 12,
  },
});
