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
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getColors } from "../theme/getColors";

export type ContractTemplateStateValue = "nevada" | "utah" | "other";

const templateStateFromAddress = (state: string): ContractTemplateStateValue => {
  const normalized = String(state || "").trim().toLowerCase();
  if (normalized === "nv" || normalized === "nevada") return "nevada";
  if (normalized === "ut" || normalized === "utah") return "utah";
  return "other";
};

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
  /** When true, omit outer card chrome — parent supplies `estimateFlowCardStyle`. */
  embedded?: boolean;
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
  inputBase: Record<string, unknown>;
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
  showIntro?: boolean;
  showActions?: boolean;
};

function ContractSettingsModalBody({
  colors,
  darkMode,
  inputBase,
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
  showIntro = true,
  showActions = true,
}: ModalBodyProps) {
  return (
    <>
      {showIntro ? (
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Contract settings</Text>
          <Text style={[styles.modalSubtitle, { color: "#d7e1f0" }]}>
            Who the agreement is for, where the work is, and how your name appears on the PDF.
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.formCard,
          {
            backgroundColor: darkMode ? "#202022" : colors.card,
            borderColor: darkMode ? "rgba(148, 163, 184, 0.12)" : colors.line,
          },
        ]}
      >
      <SectionPanel borderColor="transparent" bg="transparent">
        <Text style={[styles.sectionLabel, { marginTop: 0 }]}>Customer name</Text>
        <TextInput
          value={draftCustomerName}
          onChangeText={setDraftCustomerName}
          placeholder="Client name on the agreement"
          placeholderTextColor="rgba(255,255,255,0.42)"
          style={inputBase as any}
        />
      </SectionPanel>

      <SectionPanel borderColor="transparent" bg="transparent">
        <Text style={[styles.sectionLabel, { marginTop: 0 }]}>Project address</Text>
        <TextInput
          value={draftAddress}
          onChangeText={setDraftAddress}
          placeholder="Street address"
          placeholderTextColor="rgba(255,255,255,0.42)"
          style={[inputBase, { marginBottom: 10 }] as any}
        />
        <View style={styles.inlineRow}>
          <TextInput
            value={draftCity}
            onChangeText={setDraftCity}
            placeholder="City"
            placeholderTextColor="rgba(255,255,255,0.42)"
            style={[inputBase, { flex: 1.2, marginRight: 10 }] as any}
          />
          <TextInput
            value={draftState}
            onChangeText={setDraftState}
            placeholder="ST"
            placeholderTextColor="rgba(255,255,255,0.42)"
            style={[inputBase, { width: 64, marginRight: 10 }] as any}
            autoCapitalize="characters"
          />
          <TextInput
            value={draftZip}
            onChangeText={setDraftZip}
            placeholder="ZIP"
            placeholderTextColor="rgba(255,255,255,0.42)"
            style={[inputBase, { width: 104 }] as any}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </SectionPanel>

      <SectionPanel borderColor="transparent" bg="transparent">
        <Text style={[styles.sectionLabel, { marginTop: 0 }]}>
          Contractor on the PDF
        </Text>
        <Text style={[styles.helperText, { marginBottom: 4 }]}>
          Leave a field blank to use your profile ({profileLine}).
        </Text>
        <TextInput
          value={draftCompany}
          onChangeText={setDraftCompany}
          placeholder={
            profileDefaultCompany ? `Company (profile: ${profileDefaultCompany})` : "Company"
          }
          placeholderTextColor="rgba(255,255,255,0.42)"
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
          placeholderTextColor="rgba(255,255,255,0.42)"
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
          placeholderTextColor="rgba(255,255,255,0.42)"
          style={inputBase as any}
        />
      </SectionPanel>

      <SectionPanel borderColor="transparent" bg="transparent">
        <Text style={[styles.sectionLabel, { marginTop: 0 }]}>Contract location</Text>
        <Text style={styles.helperText}>
          Nationwide draft. The agreement follows the project state on the address.
        </Text>
      </SectionPanel>
      </View>

      {showActions ? (
        <ContractSettingsActions
          darkMode={darkMode}
          colors={colors}
          onSave={onSave}
          onCancel={onCancel}
          actionsBorder={actionsBorder}
        />
      ) : null}
    </>
  );
}

function ContractSettingsActions({
  darkMode,
  colors,
  onSave,
  onCancel,
  actionsBorder,
}: {
  darkMode: boolean;
  colors: AppColors;
  onSave: () => void;
  onCancel: () => void;
  actionsBorder: string;
}) {
  return (
    <View
      style={[
        styles.modalActions,
        isWeb && styles.modalActionsWeb,
        isWeb && { borderTopColor: actionsBorder },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: "#2dcc9a", opacity: pressed ? 0.92 : 1 },
        ]}
        onPress={onSave}
      >
        <Text style={styles.primaryBtnText}>Save</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.secondaryBtn,
          {
            borderColor: darkMode ? "rgba(148, 163, 184, 0.35)" : colors.line,
            backgroundColor: darkMode ? "#3A3A3C" : colors.bg,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        onPress={onCancel}
      >
        <Text style={[styles.secondaryBtnText, { color: darkMode ? "#e2e8f0" : colors.text }]}>
          Cancel
        </Text>
      </Pressable>
    </View>
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
  embedded = false,
}: ContractSettingsCompactProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
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
      contractTemplateState: templateStateFromAddress(draftState),
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
  const inputBg = darkMode ? "rgba(255,255,255,0.04)" : colors.bg;
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
    borderColor: darkMode ? "rgba(148, 163, 184, 0.12)" : colors.line,
    backgroundColor: inputBg,
    color: colors.text,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: isWeb ? 12 : Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
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
    inputBase,
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
      style={
        embedded
          ? { gap: 10 }
          : [
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: border,
              },
            ]
      }
    >
      <Text style={[styles.title, { color: colors.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.2 }]}>Contract settings</Text>

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
          {
            backgroundColor: "#3A3A3C",
            borderColor: "rgba(148, 163, 184, 0.35)",
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.changeBtnText, { color: "#e2e8f0" }]}>
          Change settings
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent={isWeb}
        presentationStyle={isWeb ? "overFullScreen" : "fullScreen"}
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
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
          <View
            style={[
              styles.fullPage,
              {
                backgroundColor: darkMode ? "#000000" : colors.card,
                paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 54 : 0) + 8,
              },
            ]}
          >
            <View style={styles.pageHeader} pointerEvents="box-none">
              <View style={styles.pageTitleRow} pointerEvents="box-none">
                <Text style={[styles.pageTitle, { color: colors.text }]} numberOfLines={1}>
                  Contract settings
                </Text>
                <Pressable
                  style={[
                    styles.backBtn,
                    {
                      backgroundColor: darkMode
                        ? "rgba(255,255,255,0.08)"
                        : (colors.surface2 ?? "#f3f4f6"),
                    },
                  ]}
                  onPress={() => setOpen(false)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={26}
                    color={darkMode ? "#e2e8f0" : colors.text}
                  />
                </Pressable>
              </View>
              <Text style={styles.pageSubtitle}>
                Who the agreement is for, where the work is, and how your name appears on the PDF.
              </Text>
            </View>
            <ScrollView
              style={styles.fullPageScroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.modalContent,
                { paddingBottom: Math.max(insets.bottom, 16) + 16 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <ContractSettingsModalBody {...modalBodyProps} showIntro={false} />
            </ScrollView>
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
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  fullPage: {
    flex: 1,
  },
  fullPageScroll: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pageTitleRow: {
    minHeight: 44,
    justifyContent: "center",
  },
  pageTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.25,
    lineHeight: 23,
  },
  pageSubtitle: {
    textAlign: "center",
    color: "#d7e1f0",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
    letterSpacing: 0.12,
    lineHeight: 20,
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: 4,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 22,
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
  formCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 18,
  },
  sectionPanel: {
    borderRadius: 0,
    borderWidth: 0,
    padding: 0,
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
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
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
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  optionChipTextWeb: {
    fontSize: 12,
    lineHeight: 16,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#d7e1f0",
  },
  pageFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  modalActions: {
    flexDirection: "column",
    gap: 10,
    marginTop: 8,
    paddingTop: 4,
  },
  modalActionsWeb: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  secondaryBtn: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  primaryBtn: {
    width: "100%",
    minHeight: 50,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnWeb: {
    shadowColor: "#2dcc9a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  primaryBtnText: {
    color: "#050B13",
    fontSize: 16,
    fontWeight: "800",
  },
});
