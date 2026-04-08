import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard, Platform, KeyboardAvoidingView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import PricingModeSection, { PricingMode, sanitizeOneDecimalField } from "./PricingModeSection";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from "../contexts/ThemeContext";
import { getColors } from "../theme/getColors";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (po: {
    poNumber: string;
    vendor: string;
    category: string;
    amount: number;
    description: string;
    orderDate: string;
    expectedDelivery: string;
    status: 'Pending';
  }) => void;
};

export default function AddPurchaseOrderModal({ visible, onClose, onSave }: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const placeholderTint = darkMode ? "rgba(226, 232, 240, 0.58)" : Colors.sub;
  const [poNumber, setPONumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("Materials");
  const [amount, setAmount] = useState("");
  const [pricingMode, setPricingMode] = useState<PricingMode>("flat");
  const [sqftInput, setSqftInput] = useState("");
  const [ratePerSqftInput, setRatePerSqftInput] = useState("");
  const [scope, setScope] = useState("");
  const [description, setDescription] = useState("");
  const [orderDate, setOrderDate] = useState(new Date());
  const [expectedDelivery, setExpectedDelivery] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)); // 2 weeks from now
  const [showOrderDatePicker, setShowOrderDatePicker] = useState(false);
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);

  const poRef = useRef<TextInput>(null);
  const vendorRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const sqftRef = useRef<TextInput>(null);
  const ratePerSqftRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      // Auto-generate PO number
      const poNum = `PO-${String(Date.now()).slice(-6)}`;
      setPONumber(poNum);
      setPricingMode("flat");
      setSqftInput("");
      setRatePerSqftInput("");
      setTimeout(() => vendorRef.current?.focus(), 100);
    }
  }, [visible]);

  useEffect(() => {
    if (pricingMode !== "sqft") return;
    const sq = parseFloat(sqftInput.replace(/[^0-9.]/g, "")) || 0;
    const rate = parseFloat(ratePerSqftInput.replace(/[^0-9.]/g, "")) || 0;
    if (sq > 0 && rate > 0) {
      setAmount((sq * rate).toFixed(2));
    } else {
      setAmount("");
    }
  }, [pricingMode, sqftInput, ratePerSqftInput]);

  const onSqftChange = useCallback((text: string) => {
    setSqftInput(sanitizeOneDecimalField(text));
  }, []);

  const onRatePerSqftChange = useCallback((text: string) => {
    setRatePerSqftInput(sanitizeOneDecimalField(text));
  }, []);

  const handleSave = () => {
    if (!vendor.trim()) {
      Alert.alert("Required", "Please enter a vendor name");
      return;
    }

    if (pricingMode === "sqft") {
      const sq = parseFloat(sqftInput.replace(/[^0-9.]/g, "")) || 0;
      const rate = parseFloat(ratePerSqftInput.replace(/[^0-9.]/g, "")) || 0;
      if (sq <= 0 || rate <= 0) {
        Alert.alert(
          "Square feet & rate required",
          "Enter square feet and rate ($/sq ft) to calculate the total, or switch to Flat amount."
        );
        return;
      }
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    onSave({
      poNumber: poNumber.trim(),
      vendor: vendor.trim(),
      category,
      amount: amountNum,
      description: description.trim(),
      orderDate: `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`,
      expectedDelivery: `${expectedDelivery.getFullYear()}-${String(expectedDelivery.getMonth() + 1).padStart(2, '0')}-${String(expectedDelivery.getDate()).padStart(2, '0')}`,
      status: 'Pending',
    });

    // Reset form
    setPONumber("");
    setVendor("");
    setCategory("Materials");
    setAmount("");
    setPricingMode("flat");
    setSqftInput("");
    setRatePerSqftInput("");
    setScope("");
    setDescription("");
    setOrderDate(new Date());
    setExpectedDelivery(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  };

  const handleCancel = () => {
    setPONumber("");
    setVendor("");
    setCategory("Materials");
    setAmount("");
    setPricingMode("flat");
    setSqftInput("");
    setRatePerSqftInput("");
    setPricingMode("flat");
    setSqftInput("");
    setRatePerSqftInput("");
    setScope("");
    setDescription("");
    setOrderDate(new Date());
    setExpectedDelivery(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    onClose();
  };

  const categories = [
    { value: 'Materials', icon: '🧱' },
    { value: 'Labor', icon: '👷' },
    { value: 'Equipment', icon: '🔧' },
    { value: 'Subs', icon: '👥' },
  ];

  const poAmount = parseFloat(amount) || 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <LinearGradient
        colors={['#020617', '#010409']}
        style={{ flex: 1 }}
      >
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
                  handleCancel();
                }}
                style={styles.backBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconContainer}>
              <MaterialCommunityIcons name="clipboard-text" size={24} color="#10f297" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>New Purchase Order</Text>
              <Text style={styles.subtitle}>Transactions & Invoices</Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.form} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          {/* Total Amount Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total Purchase Order Amount</Text>
            <Text style={styles.summaryCardAmount}>
              ${poAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PO Number *</Text>
              <View style={styles.inputWrapper}>
                <Feather
                  name="tag"
                  size={16}
                  color="#8DA0B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={poRef}
                  style={styles.input}
                  placeholder="PO-123456"
                  placeholderTextColor={placeholderTint}
                  value={poNumber}
                  onChangeText={setPONumber}
                  autoCapitalize="characters"
                  returnKeyType="next"
                  onSubmitEditing={() => vendorRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Vendor / Supplier *</Text>
              <View style={styles.inputWrapper}>
                <Feather
                  name="store"
                  size={16}
                  color="#8DA0B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={vendorRef}
                  style={styles.input}
                  placeholder="e.g., Home Depot, ABC Supply"
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
                  blurOnSubmit={false}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Category *</Text>
              <View style={styles.categoryButtons}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => setCategory(cat.value)}
                    style={[
                      styles.categoryButton,
                      category === cat.value && styles.categoryButtonActive
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                    <Text style={[
                      styles.categoryButtonText,
                      category === cat.value && styles.categoryButtonTextActive
                    ]}>
                      {cat.value}
                    </Text>
                  </TouchableOpacity>
                ))}
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
              <Text style={styles.label}>Order Date</Text>
              <TouchableOpacity 
                onPress={() => setShowOrderDatePicker(true)}
                style={styles.dateButton}
              >
                <Feather name="calendar" size={16} color="#8DA0B8" style={{ marginRight: 12 }} />
                <Text style={styles.dateButtonText}>
                  {orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showOrderDatePicker && (
                <DateTimePicker
                  value={orderDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowOrderDatePicker(Platform.OS === 'ios');
                    if (date) setOrderDate(date);
                  }}
                />
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Expected Delivery</Text>
              <TouchableOpacity 
                onPress={() => setShowDeliveryDatePicker(true)}
                style={styles.dateButton}
              >
                <Feather name="truck" size={16} color="#8DA0B8" style={{ marginRight: 12 }} />
                <Text style={styles.dateButtonText}>
                  {expectedDelivery.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showDeliveryDatePicker && (
                <DateTimePicker
                  value={expectedDelivery}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={orderDate}
                  onChange={(event, date) => {
                    setShowDeliveryDatePicker(Platform.OS === 'ios');
                    if (date) setExpectedDelivery(date);
                  }}
                />
              )}
              <Text style={styles.deliveryHint}>
                {Math.ceil((expectedDelivery.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))} days from order
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Scope / Location (Optional)</Text>
              <View style={styles.inputWrapper}>
                <Feather
                  name="layers"
                  size={16}
                  color="#8DA0B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Kitchen, Unit 3, Bathroom"
                  placeholderTextColor={placeholderTint}
                  value={scope}
                  onChangeText={setScope}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Description / Items</Text>
              <View style={styles.textAreaWrapper}>
                <Feather
                  name="file-text"
                  size={16}
                  color="#8DA0B8"
                  style={styles.inputIconTop}
                />
                <TextInput
                  ref={descriptionRef}
                  style={[styles.input, styles.textArea]}
                  placeholder="What items are being ordered?"
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
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
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
        </LinearGradient>
      </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 50,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 242, 151, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 242, 151, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.35,
    lineHeight: 32,
  },
  subtitle: {
    color: "rgba(226, 232, 240, 0.78)",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 6,
    lineHeight: 20,
  },
  form: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    shadowColor: "transparent",
    elevation: 0,
  },
  summaryCardLabel: {
    color: "rgba(226, 232, 240, 0.72)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  summaryCardAmount: {
    color: "#22c55e",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginTop: 10,
    textAlign: "right",
  },
  fieldGroup: {
    marginBottom: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
  },
  textAreaWrapper: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
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
  hint: {
    color: "#22c55e",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  categoryButtons: {
    flexDirection: "row",
    gap: 10,
  },
  categoryButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    minHeight: 72,
  },
  categoryButtonActive: {
    backgroundColor: "rgba(34, 197, 94, 0.14)",
    borderColor: "#22c55e",
    borderWidth: 1,
  },
  categoryButtonText: {
    color: "rgba(226, 232, 240, 0.55)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  categoryButtonTextActive: {
    color: "#22c55e",
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
    color: "white",
    fontSize: 15,
    fontWeight: "500",
  },
  deliveryHint: {
    color: "rgba(34, 211, 238, 0.85)",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 28 : 22,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.12)",
    backgroundColor: "#020617",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(226, 232, 240, 0.78)",
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