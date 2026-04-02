import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";

export type ProjectCardProject = {
  id?: string;
  title?: string;
  name?: string;
  location?: string;
  status?: string; // "won" | "bid_submitted" | "draft" | ...
  client?: string;
  margin?: number; // 0–100
  progress?: number; // 0–100
};

const statusLabel = (status?: string) => {
  if (status === "won") return "Won";
  if (status === "bid_submitted") return "Submitted";
  return "Draft";
};

export default function ProjectCard({
  project,
  onPress,
}: {
  project: ProjectCardProject;
  onPress: () => void;
}) {
  const pct = Math.min(100, Math.max(0, project.progress ?? project.margin ?? 100));

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.wrapper}>
      <LinearGradient
        colors={["#2DFFC4", "#00A6FF"]}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={styles.border}
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.name}>{project.title || project.name || "—"}</Text>

              <Text style={styles.meta}>
                {(project.location || "Unknown, Unknown")} · {statusLabel(project.status)}
              </Text>

              <Text style={styles.meta}>Client: {project.client || project.title || "—"}</Text>
            </View>

            <View style={styles.right}>
              <Text style={styles.percent}>{pct}%</Text>
              <Text style={styles.percentLabel}>Margin</Text>

              <View style={styles.track}>
                <LinearGradient
                  colors={["#2DFFC4", "#00A6FF"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.fill, { width: `${pct}%` }]}
                />
              </View>

              <Text style={styles.percentSmall}>{pct}%</Text>

              <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.4)" />
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
  },
  border: {
    borderRadius: 17,
    padding: 1,
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#000000",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.3)',
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 2,
  },
  meta: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  right: {
    width: 90,
    alignItems: "flex-end",
    gap: 3,
  },
  percent: {
    color: "#2DFFC4",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22,
  },
  percentLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 5,
  },
  track: {
    width: 74,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginBottom: 5,
  },
  fill: {
    height: 6,
    borderRadius: 999,
  },
  percentSmall: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 11,
    fontWeight: "600",
  },
});
