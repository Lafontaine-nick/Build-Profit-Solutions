import React, { useState, useEffect, useRef } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard, Platform, Pressable } from "react-native";
import { MaterialIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PurchaseOrder } from "../contexts/ProjectDataContext";
import { useTheme } from "../contexts/ThemeContext";
import { getColors } from "../theme/getColors";
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import { FORM_KEYBOARD_SCROLL_PROPS } from "@/constants/keyboardScrollProps";
import { nativeNumericKeyboardProps, resolveTextInputKeyboardProps } from "@/constants/inputKeyboardPresets";
import { getWebPageShellMaxWidth } from "@/components/layout/WebPageShell";
import WebFormGradientFrame from "@/components/layout/WebFormGradientFrame";

/** Web: space below browser tabs / address bar */
const WEB_MODAL_TOP_INSET = 52;

const WEB_TEXT_INPUT_NO_FOCUS_RING =
  Platform.OS === "web"
    ? ({ outlineStyle: "none" as const, outlineWidth: 0 } as const)
    : null;

function parseISODateToLocal(iso: string | undefined): Date {
  if (!iso) return new Date();
  const dayPart = iso.split('T')[0];
  const parts = dayPart.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date();
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function toYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Props = {
  visible: boolean;
  purchaseOrder: PurchaseOrder | null;
  onClose: () => void;
  onSave: (po: PurchaseOrder) => void;
  onCancel: (id: string) => void;
};

export default function EditPurchaseOrderModal({ visible, purchaseOrder, onClose, onSave, onCancel }: Props) {
  const { theme, darkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const Colors = getColors(theme);
  const placeholderTint = darkMode ? "rgba(226, 232, 240, 0.58)" : Colors.sub;
  const [poNumber, setPONumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => new Date());
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);

  useEffect(() => {
    if (visible && purchaseOrder) {
      setPONumber(purchaseOrder.poNumber);
      setVendor(purchaseOrder.vendor);
      setAmount(purchaseOrder.amount != null ? String(purchaseOrder.amount) : "");
      setDescription(purchaseOrder.description || "");
      const od = parseISODateToLocal(purchaseOrder.orderDate);
      setOrderDate(od);
      const ed = purchaseOrder.expectedDelivery
        ? parseISODateToLocal(purchaseOrder.expectedDelivery)
        : new Date(od.getTime() + 14 * 24 * 60 * 60 * 1000);
      setExpectedDeliveryDate(ed);
    }
  }, [visible, purchaseOrder]);

  const handleSave = () => {
    if (!purchaseOrder) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    onSave({
      ...purchaseOrder,
      poNumber: poNumber.trim(),
      vendor: vendor.trim(),
      amount: amountNum,
      description: description.trim(),
      expectedDelivery: toYYYYMMDD(expectedDeliveryDate),
    });

    Alert.alert('Updated!', 'Purchase Order updated successfully');
    onClose();
  };


  const descriptionRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  if (!purchaseOrder) return null;

  const webFormColumn =
    Platform.OS === "web"
      ? {
          maxWidth: getWebPageShellMaxWidth("form"),
          width: "100%" as const,
        }
      : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View
        style={[
          styles.modalFill,
          { backgroundColor: darkMode ? "#000000" : "#FFFFFF" },
          Platform.OS === "web" && styles.modalFillWeb,
        ]}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: darkMode ? "#000000" : "#FFFFFF" },
            { paddingTop: Platform.OS === "web" ? WEB_MODAL_TOP_INSET : insets.top },
            webFormColumn,
            Platform.OS === "web" && styles.containerWeb,
          ]}
        >
          <WebFormGradientFrame
            innerBackgroundColor={darkMode ? "#000000" : Colors.bg}
            style={Platform.OS === "web" ? styles.webFrameOuter : undefined}
            innerStyle={Platform.OS === "web" ? styles.webFrameInner : undefined}
          >
          {/* Header */}
          <View style={[styles.header, { paddingTop: 8 }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              style={[
                styles.backBtn,
                { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.surface2 },
              ]}
            >
              <MaterialIcons name="arrow-back" size={22} color={darkMode ? '#FFFFFF' : Colors.text} />
            </Pressable>
            <Text style={[styles.title, !darkMode && { color: '#000000' }]}>Edit Purchase Order</Text>
            <Text style={[styles.subtitle, !darkMode && { color: '#4B5563' }]}>Purchase Orders</Text>
          </View>

          {/* Form */}
          <ScrollView
            ref={scrollViewRef}
            style={[
              styles.form,
              Platform.OS === "web" && { flex: 1, minHeight: 0 },
            ]}
            contentContainerStyle={
              Platform.OS === "web" ? { flexGrow: 0, paddingBottom: 8 } : undefined
            }
            showsVerticalScrollIndicator={false}
            {...FORM_KEYBOARD_SCROLL_PROPS}
          >
            <View style={[styles.formCard, { backgroundColor: darkMode ? '#202022' : Colors.surface2, borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>Vendor / Supplier *</Text>
              <View style={[styles.inputWrapper, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <Feather
                  name="package"
                  size={16}
                  color={darkMode ? "#d7e1f0" : "#64748b"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, !darkMode && { color: '#000000' }, WEB_TEXT_INPUT_NO_FOCUS_RING]}
                  placeholder="e.g., Home Depot, ABC Contractors"
                  placeholderTextColor={placeholderTint}
                  value={vendor}
                  onChangeText={setVendor}
                  autoCapitalize="words"
                  onSubmitEditing={() => amountRef.current?.focus()}
                  {...resolveTextInputKeyboardProps()}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>Amount *</Text>
              <View style={[styles.inputWrapper, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  ref={amountRef}
                  style={[styles.input, !darkMode && { color: '#000000' }, WEB_TEXT_INPUT_NO_FOCUS_RING]}
                  placeholder="0"
                  placeholderTextColor={placeholderTint}
                  value={amount}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, "");
                    const parts = cleaned.split(".");
                    setAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned);
                  }}
                  selectionColor="#2dcc9a"
                  keyboardType="decimal-pad"
                  {...nativeNumericKeyboardProps}
                />
              </View>
              {amount && !isNaN(parseFloat(amount)) ? (
                <Text style={styles.amountHint}>{formatMoneyFull(parseFloat(amount), { decimals: 2 })}</Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>Description</Text>
              <View style={[styles.inputWrapper, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <Feather
                  name="file-text"
                  size={16}
                  color={darkMode ? "#d7e1f0" : "#64748b"}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={descriptionRef}
                  style={[styles.input, !darkMode && { color: '#000000' }, WEB_TEXT_INPUT_NO_FOCUS_RING]}
                  placeholder="Windows, wire, fixtures"
                  placeholderTextColor={placeholderTint}
                  value={description}
                  onChangeText={setDescription}
                  onSubmitEditing={() => Keyboard.dismiss()}
                  {...resolveTextInputKeyboardProps()}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>
                Arrives
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDeliveryDatePicker(true);
                }}
                style={[
                  styles.dateButton,
                  !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line },
                ]}
              >
                <Feather
                  name="truck"
                  size={16}
                  color={darkMode ? "#d7e1f0" : "#64748b"}
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.dateButtonText, !darkMode && { color: '#000000' }]}>
                  {expectedDeliveryDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
              {showDeliveryDatePicker && (
                <DateTimePicker
                  value={expectedDeliveryDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={orderDate}
                  onChange={(_, date) => {
                    setShowDeliveryDatePicker(Platform.OS === 'ios');
                    if (date) setExpectedDeliveryDate(date);
                  }}
                />
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>PO Number</Text>
              <View style={[styles.inputWrapper, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <Feather
                  name="hash"
                  size={16}
                  color={darkMode ? "#d7e1f0" : "#64748b"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, !darkMode && { color: '#000000' }, WEB_TEXT_INPUT_NO_FOCUS_RING]}
                  placeholder="e.g., PO-1003"
                  placeholderTextColor={placeholderTint}
                  value={poNumber}
                  onChangeText={setPONumber}
                  autoCapitalize="characters"
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                  onSubmitEditing={() => Keyboard.dismiss()}
                  {...resolveTextInputKeyboardProps()}
                />
              </View>
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                handleSave();
              }}
              style={styles.saveButton}
              activeOpacity={0.9}
            >
              <View style={styles.saveButtonSolid}>
                <Text style={styles.saveText}>Save</Text>
              </View>
            </TouchableOpacity>
            <Pressable
              onPress={() => {
                if (!purchaseOrder) return;
                Alert.alert("Cancel this purchase order?", `${poNumber || "This order"} will be removed from the open orders.`, [
                  { text: "Keep", style: "cancel" },
                  { text: "Cancel order", style: "destructive", onPress: () => onCancel(purchaseOrder.id) },
                ]);
              }}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
          </WebFormGradientFrame>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalFill: {
    flex: 1,
    width: "100%",
  },
  modalFillWeb: {
    flex: 1,
    width: "100%",
    minHeight: 0,
    alignItems: "center",
    paddingTop: WEB_MODAL_TOP_INSET,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  container: {
    flex: 1,
    paddingBottom: 20,
  },
  containerWeb: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxHeight: "100%" as const,
  },
  webFrameOuter: {
    alignSelf: "stretch",
    width: "100%",
    flex: 1,
    minHeight: 0,
  },
  webFrameInner: {
    alignSelf: "stretch",
    width: "100%",
    flex: 1,
    minHeight: 0,
    flexDirection: "column",
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 56,
    paddingBottom: 14,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.14)",
  },
  backBtn: {
    position: "absolute",
    left: 8,
    top: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  title: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.25,
    lineHeight: 23,
    textAlign: "center",
  },
  subtitle: {
    color: "#d7e1f0",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
    lineHeight: 18,
    textAlign: "center",
  },
  formCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
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
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 24,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: 0.25,
  },
  inputWrapper: {
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2dcc9a",
    marginRight: 4,
  },
  amountHint: {
    color: "#2dcc9a",
    fontSize: 13,
    marginTop: 8,
    fontWeight: "600",
  },
  textAreaWrapper: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "#6B7280",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  inputIcon: {
    marginRight: 12,
  },
  inputIconTop: {
    marginRight: 12,
    marginTop: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "white",
    fontWeight: "500",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  hint: {
    color: "#22c55e",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  dateButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  deliveryHint: {
    color: '#22c55e',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
    opacity: 0.9,
  },
  actions: {
    flexDirection: "column",
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 22,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.14)",
  },
  deleteBtn: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f87171",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  saveButtonSolid: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2dcc9a",
  },
  saveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#050B13",
    letterSpacing: 0.25,
  },
}); 