import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getColors } from "../theme/getColors";

export type ContractTemplateStateValue = "nevada" | "utah" | "other";

const STATE_OPTIONS: { value: ContractTemplateStateValue; label: string }[] = [
  { value: "nevada", label: "Nevada" },
  { value: "utah", label: "Utah" },
  { value: "other", label: "Other / Generic Draft" },
];

const stateLabel = (v: ContractTemplateStateValue) =>
  STATE_OPTIONS.find((s) => s.value === v)?.label ?? v;

type AppColors = ReturnType<typeof getColors>;

export type ContractSettingsCompactProps = {
  colors: AppColors;
  darkMode?: boolean;
  contractTemplateState: ContractTemplateStateValue;
  onContractTemplateStateChange: (v: ContractTemplateStateValue) => void;
  brandingLabel: string;
  /** Shown on the Project address row; use a short fallback when empty. */
  projectAddress?: string;
  projectAddressPlaceholder?: string;
};

export default function ContractSettingsCompact({
  colors,
  darkMode = true,
  contractTemplateState,
  onContractTemplateStateChange,
  brandingLabel,
  projectAddress,
  projectAddressPlaceholder = "Not set",
}: ContractSettingsCompactProps) {
  const [open, setOpen] = useState(false);
  const [draftState, setDraftState] = useState(contractTemplateState);

  useEffect(() => {
    if (open) {
      setDraftState(contractTemplateState);
    }
  }, [open, contractTemplateState]);

  const saveAndClose = () => {
    onContractTemplateStateChange(draftState);
    setOpen(false);
  };

  const border = darkMode ? "rgba(255,255,255,0.10)" : colors.line;
  const cardBg = darkMode ? "rgba(255, 255, 255, 0.03)" : colors.surface2;
  const accent = "#2DFFC4";
  const addressDisplay = projectAddress?.trim() || projectAddressPlaceholder;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Contract Settings</Text>

      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.sub }]}>Contract location</Text>
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={2}>
          {stateLabel(contractTemplateState)}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.sub }]}>Branding</Text>
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={2}>
          {brandingLabel}
        </Text>
      </View>

      <View style={[styles.row, styles.rowTop]}>
        <Text style={[styles.label, { color: colors.sub }]}>Project address</Text>
        <Text style={[styles.value, styles.address, { color: colors.text }]} numberOfLines={3}>
          {addressDisplay}
        </Text>
      </View>

      <Pressable
        style={[styles.changeBtn, { borderColor: accent }]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.changeBtnText, { color: accent }]}>Change settings</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { borderColor: border, backgroundColor: darkMode ? "#09090b" : colors.card }]}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Contract Settings</Text>

              <Text style={[styles.sectionLabel, { color: colors.text }]}>Contract location</Text>
              <View style={styles.optionGroup}>
                {STATE_OPTIONS.map((item) => {
                  const active = draftState === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      style={[
                        styles.optionChip,
                        {
                          borderColor: active ? accent : border,
                          backgroundColor: active ? "rgba(45,255,196,0.12)" : darkMode ? "rgba(255,255,255,0.02)" : colors.bg,
                        },
                      ]}
                      onPress={() => setDraftState(item.value)}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          { color: active ? accent : colors.text },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.helperText, { color: colors.sub }]}>
                Auto-detect from project address when possible. Change only if needed.
              </Text>

              {draftState === "other" && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    Generic draft: confirm jurisdiction-specific requirements before client use.
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.secondaryBtn, { borderColor: border, backgroundColor: darkMode ? "#111113" : colors.bg }]}
                  onPress={() => setOpen(false)}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Cancel</Text>
                </Pressable>

                <Pressable style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={saveAndClose}>
                  <Text style={styles.primaryBtnText}>Save</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowTop: {
    alignItems: "flex-start",
  },
  label: {
    fontSize: 12,
    flex: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1.15,
    textAlign: "right",
  },
  address: {
    lineHeight: 19,
  },
  warningBox: {
    backgroundColor: "rgba(245, 158, 11, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.24)",
    borderRadius: 12,
    padding: 12,
  },
  warningText: {
    color: "rgba(250, 250, 250, 0.92)",
    fontSize: 12,
    lineHeight: 18,
  },
  changeBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    borderTopWidth: 1,
  },
  modalContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  optionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  helperText: {
    fontSize: 12,
    lineHeight: 17,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#04110f",
    fontSize: 15,
    fontWeight: "800",
  },
});
