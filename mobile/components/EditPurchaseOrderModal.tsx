import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard, Platform } from "react-native";
import { MaterialIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import PricingModeSection, { PricingMode } from "./PricingModeSection";
import {
  centsDigitsToNumber,
  clampCentsDigitsInput,
  decimalMoneyInputToNumber,
  digitsOnly,
  dollarsToCentsDigits,
  sanitizeDecimalMoneyInput,
} from "@/src/lib/keyboardMoney";
import { PurchaseOrder } from "../contexts/ProjectDataContext";
import { useTheme } from "../contexts/ThemeContext";
import { getColors } from "../theme/getColors";
import { KEYBOARD_SCROLL_DEFAULTS } from "@/constants/keyboardScrollProps";

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
  const Colors = getColors(theme);
  const placeholderTint = darkMode ? "rgba(226, 232, 240, 0.58)" : Colors.sub;
  const [poNumber, setPONumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [pricingMode, setPricingMode] = useState<PricingMode>("flat");
  const [sqftInput, setSqftInput] = useState("");
  const [ratePerSqftInput, setRatePerSqftInput] = useState("");
  const [description, setDescription] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => new Date());
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);

  useEffect(() => {
    if (visible && purchaseOrder) {
      setPONumber(purchaseOrder.poNumber);
      setVendor(purchaseOrder.vendor);
      setAmount(dollarsToCentsDigits(purchaseOrder.amount));
      setDescription(purchaseOrder.description || "");
      const od = parseISODateToLocal(purchaseOrder.orderDate);
      setOrderDate(od);
      const ed = purchaseOrder.expectedDelivery
        ? parseISODateToLocal(purchaseOrder.expectedDelivery)
        : new Date(od.getTime() + 14 * 24 * 60 * 60 * 1000);
      setExpectedDeliveryDate(ed);
      setPricingMode("flat");
      setSqftInput("");
      setRatePerSqftInput("");
    }
  }, [visible, purchaseOrder]);

  useEffect(() => {
    if (pricingMode !== "sqft") return;
    const sq = parseInt(digitsOnly(sqftInput), 10) || 0;
    const rate = decimalMoneyInputToNumber(ratePerSqftInput);
    if (sq > 0 && rate > 0) {
      setAmount(dollarsToCentsDigits(sq * rate));
    } else {
      setAmount("");
    }
  }, [pricingMode, sqftInput, ratePerSqftInput]);

  const onSqftChange = useCallback((text: string) => {
    setSqftInput(digitsOnly(text));
  }, []);

  const onRatePerSqftChange = useCallback((text: string) => {
    setRatePerSqftInput(sanitizeDecimalMoneyInput(text));
  }, []);

  const handleSave = () => {
    if (!purchaseOrder) return;

    if (pricingMode === "sqft") {
      const sq = parseInt(digitsOnly(sqftInput), 10) || 0;
      const rate = decimalMoneyInputToNumber(ratePerSqftInput);
      if (sq <= 0 || rate <= 0) {
        Alert.alert(
          "Square feet & rate required",
          "Enter square feet and rate ($/sq ft) to calculate the total, or switch to Flat amount."
        );
        return;
      }
    }

    const amountNum = centsDigitsToNumber(amount);
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
  const sqftRef = useRef<TextInput>(null);
  const ratePerSqftRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  if (!purchaseOrder) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: darkMode ? '#000000' : '#FFFFFF' }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.backBtnWrapper}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backBtnBorder}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                  }}
                  style={[styles.backBtn, !darkMode && { backgroundColor: Colors.bg }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
                </TouchableOpacity>
              </LinearGradient>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.headerIconBorder}
                >
                  <View style={[styles.headerIconContainer, !darkMode && { backgroundColor: Colors.bg }]}>
                    <Text style={{ fontSize: 24 }}>📋</Text>
                  </View>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, !darkMode && { color: '#000000' }]}>Edit Purchase Orders</Text>
                  <Text style={[styles.subtitle, !darkMode && { color: '#4B5563' }]}>Transactions & Invoices</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Form */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.form}
            showsVerticalScrollIndicator={false}
            {...KEYBOARD_SCROLL_DEFAULTS}
          >
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>Vendor / Supplier *</Text>
              <View style={[styles.inputWrapper, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <Feather
                  name="shopping-bag"
                  size={16}
                  color={darkMode ? "#8DA0B8" : "#6B7280"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, !darkMode && { color: '#000000' }]}
                  placeholder="e.g., Home Depot, ABC Contractors"
                  placeholderTextColor={placeholderTint}
                  value={vendor}
                  onChangeText={setVendor}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    if (pricingMode === "sqft") {
                      sqftRef.current?.focus();
                    } else {
                      amountRef.current?.focus();
                    }
                  }}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <PricingModeSection
                pricingMode={pricingMode}
                onPricingModeChange={(mode) => {
                  setPricingMode(mode);
                  if (mode === "sqft") {
                    setSqftInput("");
                    setRatePerSqftInput("");
                    setAmount("");
                  }
                }}
                sqftInput={sqftInput}
                ratePerSqftInput={ratePerSqftInput}
                onSqftInputChange={onSqftChange}
                onRatePerSqftInputChange={onRatePerSqftChange}
                amount={amount}
                onAmountChange={setAmount}
                sqftRef={sqftRef}
                ratePerSqftRef={ratePerSqftRef}
                amountRef={amountRef}
                onFlatAmountSubmitEditing={() => Keyboard.dismiss()}
                onSqftSubmitEditing={() => ratePerSqftRef.current?.focus()}
                onRateSubmitEditing={() => {
                  Keyboard.dismiss();
                  descriptionRef.current?.focus();
                }}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>Description</Text>
              <View style={[styles.textAreaWrapper, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <Feather
                  name="file-text"
                  size={16}
                  color={darkMode ? "#8DA0B8" : "#6B7280"}
                  style={styles.inputIconTop}
                />
                <TextInput
                  ref={descriptionRef}
                  style={[styles.input, styles.textArea, !darkMode && { color: '#000000' }]}
                  placeholder="What was purchased or service provided?"
                  placeholderTextColor={placeholderTint}
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
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>
                Delivery or pickup date
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
                  color={darkMode ? '#8DA0B8' : '#6B7280'}
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
              <Text style={[styles.deliveryHint, !darkMode && { color: '#059669' }]}>
                Used for calendar and job-site scheduling
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>PO Number</Text>
              <View style={[styles.inputWrapper, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <Feather
                  name="tag"
                  size={16}
                  color={darkMode ? "#8DA0B8" : "#6B7280"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, !darkMode && { color: '#000000' }]}
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
                />
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { backgroundColor: darkMode ? "#000000" : "#FFFFFF" }]}>
            <TouchableOpacity 
              onPress={() => {
                Keyboard.dismiss();
                handleSave();
              }} 
              style={styles.saveButton}
            >
              <LinearGradient
                colors={["#22c55e", "#22d3ee"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButtonGradient}
              >
                <Text style={styles.saveText}>✓ Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  container: {
    flex: 1,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.12)",
  },
  backBtnWrapper: {
    marginRight: 16,
  },
  backBtnBorder: {
    borderRadius: 22,
    padding: 1,
    overflow: "hidden",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 21,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconBorder: {
    borderRadius: 15,
    padding: 1,
  },
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: "white",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  subtitle: {
    color: "rgba(226, 232, 240, 0.78)",
    fontSize: 14,
    marginTop: 6,
    fontWeight: "500",
    letterSpacing: 0.15,
    lineHeight: 20,
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
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "#6B7280",
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
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
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 28 : 22,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.12)",
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
  saveButtonGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22c55e",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  saveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.25,
  },
}); 