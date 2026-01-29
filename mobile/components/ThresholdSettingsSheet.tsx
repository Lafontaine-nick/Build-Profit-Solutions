// src/components/ThresholdSettingsSheet.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, TextInput, StyleSheet } from "react-native";
import { Thresholds, loadThresholds, saveThresholds } from "@/src/lib/thresholds";

type Props = {
  projectId: string;
  visible: boolean;
  onClose: () => void;
  onSaved?: (t: Thresholds) => void;
};

export default function ThresholdSettingsSheet({ projectId, visible, onClose, onSaved }: Props) {
  const [t, setT] = useState<Thresholds>({
    overallPct: 10, materialsPct: 20, laborPct: 15, equipmentPct: 15,
  });

  useEffect(() => {
    if (!visible) return;
    (async () => setT(await loadThresholds(projectId)))();
  }, [visible, projectId]);

  const update = (k: keyof Thresholds, v: string) =>
    setT((prev) => ({ ...prev, [k]: Number(v.replace(/[^\d.]/g, "")) || 0 }));

  const save = async () => {
    await saveThresholds(projectId, t);
    onSaved?.(t);
    onClose();
  };

  const Row = ({ label, k }: { label: string; k: keyof Thresholds }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowInput}>
        <TextInput
          keyboardType="numeric"
          value={String(t[k])}
          onChangeText={(v) => update(k, v)}
          style={styles.input}
        />
        <Text style={styles.percentSign}>%</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>⚙️ Alerts & Thresholds</Text>
          <Text style={styles.subtitle}>
            Set budget variance % thresholds to trigger alerts
          </Text>

          <View style={styles.form}>
            <Row label="Overall variance" k="overallPct" />
            <Row label="Materials variance" k="materialsPct" />
            <Row label="Labor variance" k="laborPct" />
            <Row label="Equipment variance" k="equipmentPct" />
          </View>

          <View style={styles.buttonRow}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={styles.saveButton}>
              <Text style={styles.saveText}>💾 Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0f2540",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginBottom: 20,
  },
  form: {
    gap: 16,
    marginBottom: 20,
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