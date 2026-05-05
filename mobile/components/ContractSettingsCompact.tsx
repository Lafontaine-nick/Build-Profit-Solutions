import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getColors } from "../theme/getColors";

export type ContractTemplateStateValue = "nevada" | "utah" | "other";

const STATE_OPTIONS: { value: ContractTemplateStateValue; label: string }[] = [
  { value: "nevada", label: "Nevada" },
  { value: "utah", label: "Utah" },
  { value: "other", label: "Other / Generic Draft" },
];

type AppColors = ReturnType<typeof getColors>;

const isWeb = Platform.OS === "web";

export type ContractSettingsSavePayload = {
  contractTemplateState: ContractTemplateStateValue;
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerZip: string;
  contractBrandingCompany: string;
  contractBrandingContractorName: string;
  contractBrandingContractorTitle: string;
};

export type ContractSettingsCompactProps = {
  colors: AppColors;
  darkMode?: boolean;
  contractTemplateState: ContractTemplateStateValue;
  onSave: (payload: ContractSettingsSavePayload) => void;
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerZip: string;
  contractBrandingCompany: string;
  contractBrandingContractorName: string;
  contractBrandingContractorTitle: string;
  profileDefaultCompany: string;
  profileDefaultContractorName: string;
  profileDefaultContractorTitle: string;
};

const mergeDisplayBranding = (
  company: string,
  name: string,
  title: string,
  profileCompany: string,
  profileName: string,
  profileTitle: string,
) => {
  const c = String(company || "").trim() || String(profileCompany || "").trim();
  const n = String(name || "").trim() || String(profileName || "").trim();
  const t = String(title || "").trim() || String(profileTitle || "").trim();
  return [c, n, t].filter(Boolean).join(" · ") || "Not set";
};

const formatProjectAddress = (
  address: string,
  city: string,
  state: string,
  zip: string,
  placeholder: string,
) => {
  const line = [
    String(address || "").trim(),
    [String(city || "").trim(), String(state || "").trim()].filter(Boolean).join(", "),
    String(zip || "").trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+,/g, ",")
    .trim();
  return line || placeholder;
};

type ModalBodyProps = {
  colors: AppColors;
  darkMode: boolean;
  accent: string;
  panelBg: string;
  panelBorder: string;
  inputBase: Record<string, unknown>;
  draftTemplateState: ContractTemplateStateValue;
  setDraftTemplateState: (v: ContractTemplateStateValue) => void;
  draftCustomerName: string;
  setDraftCustomerName: (v: string) => void;
  draftAddress: string;
  setDraftAddress: (v: string) => void;
  draftCity: string;
  setDraftCity: (v: string) => void;
  draftState: string;
  setDraftState: (v: string) => void;
  draftZip: string;
  setDraftZip: (v: string) => void;
  draftCompany: string;
  setDraftCompany: (v: string) => void;
  draftContractorName: string;
  setDraftContractorName: (v: string) => void;
  draftTitle: string;
  setDraftTitle: (v: string) => void;
  profileLine: string;
  profileDefaultCompany: string;
  profileDefaultContractorName: string;
  profileDefaultContractorTitle: string;
  onSave: () => void;
  onCancel: () => void;
  actionsBorder: string;
};

function ContractSettingsModalBody({
  colors,
  darkMode,
  accent,
  panelBg,
  panelBorder,
  inputBase,
  draftTemplateState,
  setDraftTemplateState,
  draftCustomerName,
  setDraftCustomerName,
  draftAddress,
  setDraftAddress,
  draftCity,
  setDraftCity,
  draftState,
  setDraftState,
  draftZip,
  setDraftZip,
  draftCompany,
  setDraftCompany,
  draftContractorName,
  setDraftContractorName,
  draftTitle,
  setDraftTitle,
  profileLine,
  profileDefaultCompany,
  profileDefaultContractorName,
  profileDefaultContractorTitle,
  onSave,
  onCancel,
  actionsBorder,
}: ModalBodyProps) {
  return (
    <>
      <View style={styles.modalHeader}>
        <View style={[styles.accentRule, { backgroundColor: accent }]} />
        <Text style={[styles.modalTitle, { color: colors.text }]}>Contract Settings</Text>
        <Text style={[styles.modalSubtitle, { color: colors.sub }]}>
          Who the agreement is for, where the work is, and how your name appears on the PDF.
        </Text>
      </View>

      <SectionPanel borderColor={panelBorder} bg={panelBg}>
        <Text style={[styles.sectionEyebrow, { color: accent }]}>Client</Text>
        <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 0 }]}>Customer name</Text>
        <TextInput
          value={draftCustomerName}
          onChangeText={setDraftCustomerName}
          placeholder="Client name on the agreement"
          placeholderTextColor={colors.sub}
          style={inputBase as any}
        />
      </SectionPanel>

      <SectionPanel borderColor={panelBorder} bg={panelBg}>
        <Text style={[styles.sectionEyebrow, { color: accent }]}>Site</Text>
        <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 0 }]}>Project address</Text>
        <TextInput
          value={draftAddress}
          onChangeText={setDraftAddress}
          placeholder="Street address"
          placeholderTextColor={colors.sub}
          style={[inputBase, { marginBottom: 10 }] as any}
        />
        <View style={styles.inlineRow}>
          <TextInput
            value={draftCity}
            onChangeText={setDraftCity}
            placeholder="City"
            placeholderTextColor={colors.sub}
            style={[inputBase, { flex: 1.2, marginRight: 10 }] as any}
          />
          <TextInput
            value={draftState}
            onChangeText={setDraftState}
            placeholder="ST"
            placeholderTextColor={colors.sub}
            style={[inputBase, { width: 64, marginRight: 10 }] as any}
            autoCapitalize="characters"
          />
          <TextInput
            value={draftZip}
            onChangeText={setDraftZip}
            placeholder="ZIP"
            placeholderTextColor={colors.sub}
            style={[inputBase, { width: 104 }] as any}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </SectionPanel>

      <SectionPanel borderColor={panelBorder} bg={panelBg}>
        <Text style={[styles.sectionEyebrow, { color: accent }]}>PDF header</Text>
        <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 0 }]}>
          Contractor (cover & signature block)
        </Text>
        <Text style={[styles.helperText, { color: colors.sub, marginBottom: 4 }]}>
          Leave a field blank to use your profile ({profileLine}).
        </Text>
        <TextInput
          value={draftCompany}
          onChangeText={setDraftCompany}
          placeholder={
            profileDefaultCompany ? `Company (profile: ${profileDefaultCompany})` : "Company"
          }
          placeholderTextColor={colors.sub}
          style={[inputBase, { marginBottom: 10 }] as any}
        />
        <TextInput
          value={draftContractorName}
          onChangeText={setDraftContractorName}
          placeholder={
            profileDefaultContractorName
              ? `Your name (profile: ${profileDefaultContractorName})`
              : "Your name"
          }
          placeholderTextColor={colors.sub}
          style={[inputBase, { marginBottom: 10 }] as any}
        />
        <TextInput
          value={draftTitle}
          onChangeText={setDraftTitle}
          placeholder={
            profileDefaultContractorTitle
              ? `Title / role (profile: ${profileDefaultContractorTitle})`
              : "Title / role"
          }
          placeholderTextColor={colors.sub}
          style={inputBase as any}
        />
      </SectionPanel>

      <SectionPanel borderColor={panelBorder} bg={panelBg}>
        <Text style={[styles.sectionEyebrow, { color: accent }]}>Legal template</Text>
        <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 0 }]}>Contract location</Text>
        <View style={[styles.optionGroup, isWeb && styles.optionGroupWeb]}>
          {STATE_OPTIONS.map((item) => {
            const active = draftTemplateState === item.value;
            return (
              <Pressable
                key={item.value}
                style={({ pressed }) => [
                  styles.optionChip,
                  isWeb && styles.optionChipWeb,
                  {
                    borderColor: active ? accent : panelBorder,
                    backgroundColor: active
                      ? "rgba(45,255,196,0.14)"
                      : darkMode
                        ? "rgba(255,255,255,0.04)"
                        : colors.bg,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
                onPress={() => setDraftTemplateState(item.value)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    { color: active ? accent : colors.text },
                    isWeb && styles.optionChipTextWeb,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.helperText, { color: colors.sub, marginTop: 8 }]}>
          Auto-detect from project address when possible. Change only if needed.
        </Text>

        {draftTemplateState === "other" ? (
          <View style={[styles.warningBox, { marginTop: 10 }]}>
            <Text
              style={[
                styles.warningText,
                { color: darkMode ? "rgba(250, 250, 250, 0.94)" : "#1a1206" },
              ]}
            >
              Generic draft: confirm jurisdiction-specific requirements before client use.
            </Text>
          </View>
        ) : null}
      </SectionPanel>

      <View
        style={[
          styles.modalActions,
          isWeb && styles.modalActionsWeb,
          isWeb && { borderTopColor: actionsBorder },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            {
              borderColor: panelBorder,
              backgroundColor: darkMode ? "rgba(255,255,255,0.05)" : colors.bg,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={onCancel}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Cancel</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: accent, opacity: pressed ? 0.92 : 1 },
            isWeb && styles.primaryBtnWeb,
          ]}
          onPress={onSave}
        >
          <Text style={styles.primaryBtnText}>Save</Text>
        </Pressable>
      </View>
    </>
  );
}

function SectionPanel({
  children,
  borderColor,
  bg,
}: {
  children: React.ReactNode;
  borderColor: string;
  bg: string;
}) {
  return (
    <View style={[styles.sectionPanel, { borderColor: borderColor, backgroundColor: bg }]}>
      {children}
    </View>
  );
}

export default function ContractSettingsCompact({
  colors,
  darkMode = true,
  contractTemplateState,
  onSave,
  customerName,
  customerAddress,
  customerCity,
  customerState,
  customerZip,
  contractBrandingCompany,
  contractBrandingContractorName,
  contractBrandingContractorTitle,
  profileDefaultCompany,
  profileDefaultContractorName,
  profileDefaultContractorTitle,
}: ContractSettingsCompactProps) {
  const [open, setOpen] = useState(false);
  const [draftTemplateState, setDraftTemplateState] = useState(contractTemplateState);
  const [draftCustomerName, setDraftCustomerName] = useState(customerName);
  const [draftAddress, setDraftAddress] = useState(customerAddress);
  const [draftCity, setDraftCity] = useState(customerCity);
  const [draftState, setDraftState] = useState(customerState);
  const [draftZip, setDraftZip] = useState(customerZip);
  const [draftCompany, setDraftCompany] = useState(contractBrandingCompany);
  const [draftContractorName, setDraftContractorName] = useState(contractBrandingContractorName);
  const [draftTitle, setDraftTitle] = useState(contractBrandingContractorTitle);

  useEffect(() => {
    if (!open) return;
    setDraftTemplateState(contractTemplateState);
    setDraftCustomerName(customerName);
    setDraftAddress(customerAddress);
    setDraftCity(customerCity);
    setDraftState(customerState);
    setDraftZip(customerZip);
    setDraftCompany(contractBrandingCompany);
    setDraftContractorName(contractBrandingContractorName);
    setDraftTitle(contractBrandingContractorTitle);
  }, [
    open,
    contractTemplateState,
    customerName,
    customerAddress,
    customerCity,
    customerState,
    customerZip,
    contractBrandingCompany,
    contractBrandingContractorName,
    contractBrandingContractorTitle,
  ]);

  const saveAndClose = () => {
    onSave({
      contractTemplateState: draftTemplateState,
      customerName: draftCustomerName,
      customerAddress: draftAddress,
      customerCity: draftCity,
      customerState: draftState,
      customerZip: draftZip,
      contractBrandingCompany: draftCompany,
      contractBrandingContractorName: draftContractorName,
      contractBrandingContractorTitle: draftTitle,
    });
    setOpen(false);
  };

  const border = darkMode ? "rgba(255,255,255,0.10)" : colors.line;
  const cardBg = darkMode ? "rgba(255, 255, 255, 0.03)" : colors.surface2;
  const accent = "#2DFFC4";
  const inputBg = darkMode ? "rgba(255,255,255,0.04)" : colors.bg;
  const panelBg = darkMode ? "rgba(255,255,255,0.02)" : colors.surface2;
  const panelBorder = darkMode ? "rgba(255,255,255,0.08)" : colors.line;
  const placeholder = "Not set";

  const contractorSummary = mergeDisplayBranding(
    contractBrandingCompany,
    contractBrandingContractorName,
    contractBrandingContractorTitle,
    profileDefaultCompany,
    profileDefaultContractorName,
    profileDefaultContractorTitle,
  );

  const projectSummary = formatProjectAddress(
    customerAddress,
    customerCity,
    customerState,
    customerZip,
    placeholder,
  );

  const profileLine =
    [profileDefaultCompany, profileDefaultContractorName].filter(Boolean).join(" · ") ||
    "saved in Profile";

  const inputBase = {
    borderWidth: 1,
    borderColor: darkMode ? "rgba(255,255,255,0.12)" : colors.line,
    backgroundColor: inputBg,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: isWeb ? 12 : Platform.OS === "ios" ? 12 : 10,
    fontSize: isWeb ? 15 : 14,
    ...(isWeb
      ? ({
          outlineStyle: "none" as const,
          outlineWidth: 0,
        } as object)
      : {}),
  } as const;

  const modalSheetWebShadow = isWeb
    ? ({
        boxShadow:
          "0 28px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 1px 0 rgba(255,255,255,0.04)",
      } as object)
    : {};

  const actionsBorder = darkMode ? "rgba(255,255,255,0.08)" : colors.line;

  const modalBodyProps: ModalBodyProps = {
    colors,
    darkMode,
    accent,
    panelBg,
    panelBorder,
    inputBase,
    draftTemplateState,
    setDraftTemplateState,
    draftCustomerName,
    setDraftCustomerName,
    draftAddress,
    setDraftAddress,
    draftCity,
    setDraftCity,
    draftState,
    setDraftState,
    draftZip,
    setDraftZip,
    draftCompany,
    setDraftCompany,
    draftContractorName,
    setDraftContractorName,
    draftTitle,
    setDraftTitle,
    profileLine,
    profileDefaultCompany,
    profileDefaultContractorName,
    profileDefaultContractorTitle,
    onSave: saveAndClose,
    onCancel: () => setOpen(false),
    actionsBorder,
  };

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
        <Text style={[styles.label, { color: colors.sub }]}>Customer name</Text>
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={2}>
          {String(customerName || "").trim() || placeholder}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.sub }]}>Contractor</Text>
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={3}>
          {contractorSummary}
        </Text>
      </View>

      <View style={[styles.row, styles.rowTop]}>
        <Text style={[styles.label, { color: colors.sub }]}>Project address</Text>
        <Text style={[styles.value, styles.address, { color: colors.text }]} numberOfLines={4}>
          {projectSummary}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.changeBtn,
          { borderColor: accent, opacity: pressed ? 0.88 : 1 },
        ]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.changeBtnText, { color: darkMode ? accent : "#000000" }]}>
          Change settings
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        {isWeb ? (
          <View style={[styles.modalBackdrop, styles.modalBackdropWeb]}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} />
            <View
              style={[
                styles.modalSheet,
                { borderColor: border, backgroundColor: darkMode ? "#0c0c0f" : colors.card },
                styles.modalSheetWeb,
                modalSheetWebShadow,
              ]}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.modalContent, styles.modalContentWeb]}
                showsVerticalScrollIndicator={false}
              >
                <ContractSettingsModalBody {...modalBodyProps} />
              </ScrollView>
            </View>
          </View>
        ) : (
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalBackdropTap} onPress={() => setOpen(false)} />
            <View
              style={[
                styles.modalSheet,
                { borderColor: border, backgroundColor: darkMode ? "#0c0c0f" : colors.card },
              ]}
            >
              <View style={styles.sheetGrabber} />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                <ContractSettingsModalBody {...modalBodyProps} />
              </ScrollView>
            </View>
          </View>
        )}
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
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderRadius: 12,
    padding: 14,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 19,
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
    backgroundColor: "rgba(0,0,0,0.62)",
    justifyContent: "flex-end",
  },
  modalBackdropWeb: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    borderTopWidth: 1,
  },
  modalSheetWeb: {
    width: "100%",
    maxWidth: 520,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopWidth: 0,
    borderWidth: 1,
    maxHeight: 720,
    zIndex: 2,
  },
  modalBackdropTap: {
    flex: 1,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginTop: 10,
    marginBottom: 4,
  },
  modalContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  modalContentWeb: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 16,
  },
  modalHeader: {
    marginBottom: 4,
  },
  accentRule: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 440,
  },
  sectionPanel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  optionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionGroupWeb: {
    flexWrap: "nowrap",
    gap: 10,
  },
  optionChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  optionChipWeb: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    paddingVertical: 12,
  },
  optionChipText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  optionChipTextWeb: {
    fontSize: 12,
    lineHeight: 16,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    paddingTop: 4,
  },
  modalActionsWeb: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 15,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnWeb: {
    shadowColor: "#2DFFC4",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  primaryBtnText: {
    color: "#04110f",
    fontSize: 15,
    fontWeight: "800",
  },
});
