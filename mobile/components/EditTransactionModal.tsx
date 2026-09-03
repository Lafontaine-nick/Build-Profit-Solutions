import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Keyboard,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import { FORM_KEYBOARD_SCROLL_PROPS } from "@/constants/keyboardScrollProps";
import {
  nativeNumericKeyboardProps,
  resolveTextInputKeyboardProps,
} from "@/constants/inputKeyboardPresets";
import GradientRingBackInner from "@/components/GradientRingBackInner";
import { getWebPageShellMaxWidth } from "@/components/layout/WebPageShell";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import {
  getProjectExpenseFormHorizontalPadding,
  isDesktopWebLayoutWidth,
} from "@/constants/ScreenLayout";
import {
  AI_FLOW_CARD_BG_DARK,
  ESTIMATE_FLOW_NESTED_CARD_BG_DARK,
  ESTIMATE_FLOW_NESTED_FIELD_BG_DARK,
} from "@/utils/estimateFlowCardStyle";
import { useProjectData } from "@/contexts/ProjectDataContext";
import EstimateLinePicker, { type EstimateLineOption } from "@/components/EstimateLinePicker";

/** Web: space below browser tabs / address bar so the card does not touch the chrome */
const WEB_MODAL_TOP_INSET = 52;

type Transaction = {
  id: string;
  vendor: string;
  amount: number;
  description: string;
  date: string;
  po?: string;
  material?: string;
  linkedLineId?: string;
};

type Props = {
  visible: boolean;
  transaction: Transaction | null;
  categoryName: string;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
};

export default function EditTransactionModal({
  visible,
  transaction,
  categoryName,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { width: layoutWidth } = useWindowDimensions();
  const desktopWeb = Platform.OS === "web" && isDesktopWebLayoutWidth(layoutWidth);
  const formPad = useMemo(
    () => getProjectExpenseFormHorizontalPadding({ desktopWeb }),
    [desktopWeb],
  );

  const { projectData } = useProjectData();
  const categoryLower = categoryName.toLowerCase();
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [po, setPo] = useState("");
  const [selectedEstimateLine, setSelectedEstimateLine] = useState<EstimateLineOption | null>(null);

  const isMaterialsEquipment =
    categoryLower.includes("material") || categoryLower.includes("equipment");
  const isLaborCategory =
    categoryLower.includes("labor") || categoryLower.includes("subs");
  const showEstimateLinePicker = isMaterialsEquipment || isLaborCategory;
  const estimatePickerKind = isLaborCategory ? ("labor" as const) : ("materials" as const);

  const amountRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const descriptionRef = useRef<TextInput>(null);

  const headerMci = useMemo(() => {
    if (categoryLower.includes("labor") || categoryLower.includes("subs")) {
      return "account-hard-hat" as const;
    }
    if (categoryLower.includes("change")) {
      return "file-document-edit-outline" as const;
    }
    if (categoryLower.includes("purchase")) {
      return "file-document-outline" as const;
    }
    return "package-variant-closed" as const;
  }, [categoryLower]);

  const vendorFeatherIcon = useMemo(() => {
    if (categoryLower.includes("labor") || categoryLower.includes("subs")) {
      return "user" as const;
    }
    if (categoryLower.includes("change")) {
      return "file-text" as const;
    }
    return "package" as const;
  }, [categoryLower]);

  const expenseChrome = useMemo(
    () => ({
      headerRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: formPad.header,
        paddingTop: Platform.OS === "web" ? 20 : 8,
        paddingBottom: 14,
        marginBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: darkMode ? "rgba(148, 163, 184, 0.14)" : Colors.line,
      },
      materialTitle: {
        fontSize: 24,
        fontWeight: "800" as const,
        color: Colors.text,
        letterSpacing: -0.35,
        lineHeight: 30,
      },
      materialSubtitle: {
        fontSize: 13,
        color: Colors.sub,
        marginTop: 5,
        lineHeight: 18,
        fontWeight: "500" as const,
        opacity: 0.92,
      },
      iconBorder: { borderRadius: 12, padding: 1 },
      fieldGroup: { marginBottom: 18 },
      materialLabel: {
        fontSize: 13,
        fontWeight: "600" as const,
        color: Colors.text,
        marginBottom: 8,
        letterSpacing: 0.25,
      },
      materialInputWrap: {
        borderRadius: 14,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: 14,
        backgroundColor: darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : Colors.surface2,
        borderWidth: 1,
        borderColor: darkMode ? "rgba(148, 163, 184, 0.12)" : Colors.line,
        paddingVertical: 12,
        minHeight: 48,
      },
      materialInputWrapMultiline: {
        borderRadius: 14,
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : Colors.surface2,
        borderWidth: 1,
        borderColor: darkMode ? "rgba(148, 163, 184, 0.12)" : Colors.line,
        minHeight: 88,
      },
      materialInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: "500" as const,
        color: Colors.text,
        ...(Platform.OS === "web" ? { outlineStyle: "none" as const, outlineWidth: 0 } : {}),
      },
      amountShell: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: darkMode ? "rgba(148, 163, 184, 0.12)" : Colors.line,
        backgroundColor: darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : Colors.surface2,
      },
      dollarSign: {
        fontSize: 18,
        fontWeight: "600" as const,
        color: "#22c55e",
        marginLeft: 12,
        marginRight: 4,
      },
      amountInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 14,
        paddingHorizontal: 12,
        paddingLeft: 4,
        fontWeight: "500" as const,
        color: Colors.text,
        ...(Platform.OS === "web" ? { outlineStyle: "none" as const, outlineWidth: 0 } : {}),
      },
      hint: {
        color: "#22d3ee",
        fontSize: 13,
        marginTop: 8,
        fontWeight: "600" as const,
      },
      formCard: {
        borderRadius: 14,
        padding: 16,
        backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : Colors.bg,
        borderWidth: 1,
        borderColor: darkMode ? "rgba(148, 163, 184, 0.12)" : Colors.line,
        marginBottom: 8,
      },
      footerFlow: {
        paddingHorizontal: formPad.footer,
        paddingTop: 14,
        flexDirection: "row" as const,
        alignItems: "stretch" as const,
        gap: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: darkMode ? "rgba(148, 163, 184, 0.14)" : Colors.line,
        backgroundColor: darkMode ? "#000000" : Colors.bg,
      },
      deleteBtn: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: darkMode ? "rgba(239, 68, 68, 0.35)" : "rgba(239, 68, 68, 0.4)",
        backgroundColor: darkMode ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.06)",
        alignItems: "center" as const,
        justifyContent: "center" as const,
        minHeight: 48,
      },
      deleteText: {
        fontSize: 15,
        fontWeight: "600" as const,
        color: darkMode ? "#f87171" : "#dc2626",
      },
      saveBtnWrap: {
        flex: 1,
        borderRadius: 14,
        overflow: "hidden" as const,
        minHeight: 48,
      },
      saveBtnInner: {
        flex: 1,
        paddingVertical: 15,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        backgroundColor: "#22c55e",
        minHeight: 48,
      },
      saveBtnText: {
        fontSize: 15,
        fontWeight: "700" as const,
        color: "#050B13",
        letterSpacing: 0.3,
      },
    }),
    [Colors, darkMode, formPad.footer, formPad.header],
  );

  const vendorLabel =
    categoryName === "Labor" || categoryName === "Subs"
      ? "Sub / Trade *"
      : "Vendor / Supplier *";

  const displayLineName = (name: string) =>
    name.replace(/\s*[—–-]\s*(materials?|labor)\s*$/i, "").trim() || name;

  useEffect(() => {
    if (visible && transaction) {
      setVendor(transaction.vendor);
      setAmount(String(transaction.amount));
      setDescription(transaction.description);
      setPo(transaction.po || "");
      if (transaction.linkedLineId) {
        setSelectedEstimateLine({
          id: transaction.linkedLineId,
          name: transaction.material || transaction.description || transaction.vendor,
          budget: 0,
        });
      } else {
        setSelectedEstimateLine(null);
      }
    }
  }, [visible, transaction]);

  const webAlert = (title: string, message: string) => {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.alert === "function"
    ) {
      window.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
    Alert.alert(title, message);
  };

  const handleSave = () => {
    if (!transaction) return;

    if (!vendor.trim()) {
      webAlert("Required", "Please enter a vendor name");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      webAlert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    onSave({
      ...transaction,
      vendor: vendor.trim(),
      amount: amountNum,
      description: description.trim(),
      po: po.trim() || undefined,
      material: selectedEstimateLine
        ? displayLineName(selectedEstimateLine.name)
        : transaction.material,
      linkedLineId: selectedEstimateLine?.id ?? null,
    });
  };

  const handleDelete = () => {
    if (!transaction) return;

    const msg = `Remove ${vendor} - ${formatMoneyFull(parseFloat(amount) || 0, { decimals: 2 })}?`;

    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.confirm === "function"
    ) {
      const ok = window.confirm(`Delete Transaction?\n\n${msg}`);
      if (ok) {
        onDelete(transaction.id);
        onClose();
      }
      return;
    }

    Alert.alert("Delete Transaction?", msg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          onDelete(transaction.id);
          onClose();
        },
      },
    ]);
  };

  if (!transaction) return null;

  const subtitleText =
    categoryName === "Change Orders"
      ? "Transactions & Invoices"
      : categoryName === "Labor"
        ? "Subs & Trades"
        : categoryName === "Materials/Equipment"
          ? "Materials & Equipment"
          : "Transactions";

  const displayCategoryName = categoryName.replace("/", " & ");

  const webFormColumn =
    Platform.OS === "web"
      ? {
          maxWidth: getWebPageShellMaxWidth("form"),
          width: "100%" as const,
          alignSelf: "center" as const,
        }
      : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <KeyboardAvoidingView
        style={[styles.keyboardAvoid, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}
        behavior={Platform.OS === "android" ? "padding" : undefined}
        enabled={Platform.OS === "android"}
      >
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        <View
          style={[
            styles.container,
            webFormColumn,
            Platform.OS === "web" && styles.containerWeb,
            { paddingTop: Platform.OS === "web" ? WEB_MODAL_TOP_INSET : insets.top },
            !darkMode && { backgroundColor: Colors.bg },
          ]}
        >
          <View style={expenseChrome.headerRow}>
            <View style={styles.backBtnWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backBtnBorder}
              >
                <GradientRingBackInner
                  darkMode={darkMode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                  }}
                  style={[styles.backBtn, { backgroundColor: Colors.bg }]}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={24}
                    color={darkMode ? "#FFFFFF" : Colors.text}
                  />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconContainerWrapper}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={expenseChrome.iconBorder}
                >
                  <View
                    style={[
                      styles.headerIconContainer,
                      { backgroundColor: Colors.bg },
                    ]}
                  >
                    <MaterialCommunityIcons name={headerMci} size={24} color="#22c55e" />
                  </View>
                </LinearGradient>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={expenseChrome.materialTitle}>
                  Edit {displayCategoryName}
                </Text>
                <Text style={expenseChrome.materialSubtitle}>{subtitleText}</Text>
              </View>
            </View>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={[styles.formScroll, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}
            contentContainerStyle={{
              paddingHorizontal: formPad.scroll,
              paddingTop: 8,
              paddingBottom: 24,
            }}
            showsVerticalScrollIndicator={false}
            {...FORM_KEYBOARD_SCROLL_PROPS}
          >
            <View style={expenseChrome.formCard}>
              {showEstimateLinePicker ? (
                <EstimateLinePicker
                  kind={estimatePickerKind}
                  projectLike={projectData as unknown as Record<string, unknown>}
                  selectedLineId={selectedEstimateLine?.id}
                  readOnly={Boolean(transaction.linkedLineId)}
                  onSelect={(line) => {
                    setSelectedEstimateLine(line);
                    if (line && isMaterialsEquipment) {
                      setDescription((current) => current || displayLineName(line.name));
                    }
                  }}
                  darkMode={darkMode}
                  colors={{
                    background: darkMode ? "#000000" : Colors.bg,
                    card: darkMode ? AI_FLOW_CARD_BG_DARK : Colors.surface2,
                    text: Colors.text,
                    secondary: Colors.sub,
                    border: Colors.line,
                    nestedCard: darkMode ? ESTIMATE_FLOW_NESTED_CARD_BG_DARK : Colors.surface2,
                    accent: "#22c55e",
                  }}
                />
              ) : null}
              <View style={expenseChrome.fieldGroup}>
                <Text style={expenseChrome.materialLabel}>{vendorLabel}</Text>
                <View style={expenseChrome.materialInputWrap}>
                  <Feather
                    name={vendorFeatherIcon}
                    size={16}
                    color="#8DA0B8"
                    style={{ marginRight: 12 }}
                  />
                  <TextInput
                    style={expenseChrome.materialInput}
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    value={vendor}
                    onChangeText={setVendor}
                    autoCapitalize="words"
                    selectionColor="#22c55e"
                    underlineColorAndroid="transparent"
                    {...resolveTextInputKeyboardProps()}
                  />
                </View>
              </View>

              <View style={expenseChrome.fieldGroup}>
                <Text style={expenseChrome.materialLabel}>Amount *</Text>
                <View style={expenseChrome.amountShell}>
                  <Text style={expenseChrome.dollarSign}>$</Text>
                  <TextInput
                    ref={amountRef}
                    style={expenseChrome.amountInput}
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    value={amount}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.]/g, "");
                      const parts = cleaned.split(".");
                      if (parts.length > 2) {
                        setAmount(parts[0] + "." + parts.slice(1).join(""));
                      } else {
                        setAmount(cleaned);
                      }
                    }}
                    keyboardType="decimal-pad"
                    selectionColor="#22c55e"
                    underlineColorAndroid="transparent"
                    {...nativeNumericKeyboardProps}
                  />
                </View>
                {amount && !isNaN(parseFloat(amount)) ? (
                  <Text style={expenseChrome.hint}>
                    {formatMoneyFull(parseFloat(amount), { decimals: 2 })}
                  </Text>
                ) : null}
              </View>

              <View style={expenseChrome.fieldGroup}>
                <Text style={expenseChrome.materialLabel}>Description</Text>
                <View style={expenseChrome.materialInputWrapMultiline}>
                  <Feather
                    name="file-text"
                    size={16}
                    color="#8DA0B8"
                    style={{ marginRight: 12, marginTop: 2 }}
                  />
                  <TextInput
                    ref={descriptionRef}
                    style={[expenseChrome.materialInput, { minHeight: 64, textAlignVertical: "top" }]}
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    value={description}
                    onChangeText={setDescription}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 100);
                    }}
                    selectionColor="#22c55e"
                    underlineColorAndroid="transparent"
                    {...resolveTextInputKeyboardProps({ multiline: true })}
                  />
                </View>
              </View>

              <View style={expenseChrome.fieldGroup}>
                <Text style={expenseChrome.materialLabel}>PO Number</Text>
                <View style={expenseChrome.materialInputWrap}>
                  <Feather name="hash" size={16} color="#8DA0B8" style={{ marginRight: 12 }} />
                  <TextInput
                    style={expenseChrome.materialInput}
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    value={po}
                    onChangeText={setPo}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 100);
                    }}
                    autoCapitalize="characters"
                    selectionColor="#22c55e"
                    underlineColorAndroid="transparent"
                    {...resolveTextInputKeyboardProps()}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          <View
            style={[
              expenseChrome.footerFlow,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                expenseChrome.deleteBtn,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={expenseChrome.deleteText}>Delete</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                handleSave();
              }}
              style={({ pressed }) => [
                expenseChrome.saveBtnWrap,
                pressed && { opacity: 0.92 },
              ]}
            >
              <View style={expenseChrome.saveBtnInner}>
                <Text style={expenseChrome.saveBtnText}>✓ Save</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  containerWeb: {
    flexGrow: 0,
    flexShrink: 0,
    flex: 0,
  },
  formScroll: {
    flex: 1,
  },
  backBtnWrapper: {
    marginRight: 12,
  },
  backBtnBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconContainerWrapper: {
    flexShrink: 0,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});
