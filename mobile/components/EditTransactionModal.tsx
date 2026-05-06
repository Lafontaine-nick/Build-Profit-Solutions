import React, { useState, useRef, useEffect } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard, SafeAreaView, StatusBar, Platform } from "react-native";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import { KEYBOARD_SCROLL_DEFAULTS } from "@/constants/keyboardScrollProps";
import GradientRingBackInner from "./GradientRingBackInner";
import { getWebPageShellMaxWidth } from "@/components/layout/WebPageShell";
import WebFormGradientFrame from "@/components/layout/WebFormGradientFrame";

/** Web: space below browser tabs / address bar so the card does not touch the chrome */
const WEB_MODAL_TOP_INSET = 52;

/** Web: remove browser default focus ring on inputs (blue rectangle). */
const WEB_TEXT_INPUT_NO_FOCUS_RING =
  Platform.OS === "web"
    ? ({ outlineStyle: "none" as const, outlineWidth: 0 } as const)
    : null;

type Transaction = {
  id: string;
  vendor: string;
  amount: number;
  description: string;
  date: string;
  po?: string;
};

type Props = {
  visible: boolean;
  transaction: Transaction | null;
  categoryName: string;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
};

export default function EditTransactionModal({ visible, transaction, categoryName, onClose, onSave, onDelete }: Props) {
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [po, setPo] = useState("");

  const vendorRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const descriptionRef = useRef<TextInput>(null);

  const categoryIcon = categoryName === 'Labor' ? '👷' : 
                       categoryName === 'Materials' ? '🧱' :
                       categoryName === 'Equipment' ? '🔧' : 
                       categoryName === 'Subs' ? '👥' : '📦';

  const vendorLabel = categoryName === 'Labor' || categoryName === 'Subs' 
    ? 'Sub / Trade *' 
    : 'Vendor / Supplier *';

  useEffect(() => {
    if (visible && transaction) {
      setVendor(transaction.vendor);
      setAmount(String(transaction.amount));
      setDescription(transaction.description);
      setPo(transaction.po || "");
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

  const subtitleText = categoryName === 'Change Orders' 
    ? 'Transactions & Invoices'
    : categoryName === 'Labor' 
    ? 'Subs & Trades'
    : categoryName === 'Materials/Equipment'
    ? 'Materials & Equipment'
    : 'Transactions';

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
      <SafeAreaView style={[styles.safeArea, Platform.OS === "web" && styles.safeAreaWeb]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View
          style={[
            styles.container,
            webFormColumn,
            Platform.OS === "web" && styles.containerWeb,
          ]}
        >
          <WebFormGradientFrame
            innerBackgroundColor="#000000"
            style={Platform.OS === "web" ? styles.webFrameOuter : undefined}
            innerStyle={Platform.OS === "web" ? styles.webFrameInner : undefined}
          >
          {/* Header */}
          <View style={[styles.header, Platform.OS === "web" && styles.headerWeb]}>
            <View style={styles.backBtnWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backBtnBorder}
              >
                <GradientRingBackInner
                  darkMode
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                  }}
                  style={styles.backBtn}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.headerIconContainer}>
                  <Text style={{ fontSize: 24 }}>{categoryIcon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Edit {categoryName}</Text>
                  <Text style={styles.subtitle}>{subtitleText}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Form */}
          <ScrollView
            ref={scrollViewRef}
            style={[styles.form, Platform.OS === "web" && styles.formWebScroll]}
            contentContainerStyle={{
              paddingBottom: Platform.OS === "web" ? 20 : 100,
              ...(Platform.OS === "web" ? { flexGrow: 0 } : {}),
            }}
            showsVerticalScrollIndicator={false}
            {...KEYBOARD_SCROLL_DEFAULTS}
          >
            <View style={styles.field}>
              <Text style={styles.label}>{vendorLabel}</Text>
              <TextInput
                ref={vendorRef}
                style={[styles.input, WEB_TEXT_INPUT_NO_FOCUS_RING]}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={vendor}
                onChangeText={setVendor}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => amountRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Amount *</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  ref={amountRef}
                  style={[styles.input, styles.amountInput, WEB_TEXT_INPUT_NO_FOCUS_RING]}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={amount}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    if (parts.length > 2) {
                      setAmount(parts[0] + '.' + parts.slice(1).join(''));
                    } else {
                      setAmount(cleaned);
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>
              {amount && !isNaN(parseFloat(amount)) && (
                <Text style={styles.hint}>{formatMoneyFull(parseFloat(amount), { decimals: 2 })}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                ref={descriptionRef}
                style={[styles.input, styles.textArea, WEB_TEXT_INPUT_NO_FOCUS_RING]}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={description}
                onChangeText={setDescription}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PO Number</Text>
              <TextInput
                style={[styles.input, WEB_TEXT_INPUT_NO_FOCUS_RING]}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={po}
                onChangeText={setPo}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                autoCapitalize="characters"
              />
            </View>
          </ScrollView>

          {/* Actions — native: pinned; web: in flow so gradient frame hugs content */}
          <View
            style={
              Platform.OS === "web"
                ? styles.actionsWeb
                : styles.actions
            }
          >
            <View style={styles.deleteButtonWrapper}>
              <LinearGradient
                colors={["#ef4444", "#dc2626"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.deleteButtonBorder}
              >
                <TouchableOpacity 
                  onPress={handleDelete} 
                  style={styles.deleteButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
            <TouchableOpacity
              style={styles.saveButtonWrapper}
              onPress={() => {
                Keyboard.dismiss();
                handleSave();
              }}
              activeOpacity={0.9}
            >
              <View style={styles.saveButtonSolid}>
                <Text style={styles.saveButtonText}>✓ Save</Text>
              </View>
            </TouchableOpacity>
          </View>
          </WebFormGradientFrame>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  safeAreaWeb: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: WEB_MODAL_TOP_INSET,
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingBottom: 20,
  },
  /** Web: do not stretch the form column to full viewport height */
  containerWeb: {
    flexGrow: 0,
    flexShrink: 0,
    flex: 0,
  },
  /** Web: gradient ring height follows content, full width of column */
  webFrameOuter: {
    alignSelf: "stretch",
    width: "100%",
  },
  webFrameInner: {
    alignSelf: "stretch",
    width: "100%",
  },
  /** Web: ScrollView only as tall as fields (no flex fill) */
  formWebScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
  },
  headerWeb: {
    paddingTop: 20,
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  title: {
    color: "white",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  form: {
    padding: 20,
  },
  actionsWeb: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    marginTop: 4,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "#000000",
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    color: "white",
    fontSize: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6B7280", // Grey border
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dollarSign: {
    position: "absolute",
    left: 14,
    color: "#22c55e",
    fontSize: 18,
    fontWeight: "600",
    zIndex: 1,
  },
  amountInput: {
    paddingLeft: 32,
    flex: 1,
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  hint: {
    color: "#22d3ee",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "#000000",
  },
  deleteButtonWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  deleteButtonBorder: {
    borderRadius: 12,
    padding: 1.5,
  },
  deleteButton: {
    paddingVertical: 14,
    borderRadius: 10.5,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  saveButtonWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveButtonSolid: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    borderRadius: 12,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
}); 