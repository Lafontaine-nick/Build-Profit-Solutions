import React, { useState, useRef, useEffect } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard, Platform, KeyboardAvoidingView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatMoneyFull } from "@/src/lib/budgetUtils";
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
  const [poNumber, setPONumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("Materials");
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState("");
  const [description, setDescription] = useState("");
  const [orderDate, setOrderDate] = useState(new Date());
  const [expectedDelivery, setExpectedDelivery] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)); // 2 weeks from now
  const [showOrderDatePicker, setShowOrderDatePicker] = useState(false);
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);

  const poRef = useRef<TextInput>(null);
  const vendorRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      // Auto-generate PO number
      const poNum = `PO-${String(Date.now()).slice(-6)}`;
      setPONumber(poNum);
      setTimeout(() => vendorRef.current?.focus(), 100);
    }
  }, [visible]);

  const handleSave = () => {
    if (!vendor.trim()) {
      Alert.alert("Required", "Please enter a vendor name");
      return;
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.summaryCardLabel}>Total Purchase Order Amount</Text>
              <Text style={styles.summaryCardAmount}>
                ${poAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
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
                  placeholderTextColor="rgba(255,255,255,0.4)"
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
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={vendor}
                  onChangeText={setVendor}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => amountRef.current?.focus()}
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
              <Text style={styles.label}>Amount *</Text>
              <View style={styles.inputWrapper}>
                <Feather
                  name="dollar-sign"
                  size={16}
                  color="#22c55e"
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={amountRef}
                  style={styles.input}
                  placeholder="$ 0.00"
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
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>
              {amount && !isNaN(parseFloat(amount)) && (
                <Text style={styles.hint}>{formatMoneyFull(parseFloat(amount), { decimals: 2 })}</Text>
              )}
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
                  placeholderTextColor="rgba(255,255,255,0.4)"
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
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { borderTopColor: Colors.line }]}>
            <TouchableOpacity 
              onPress={handleCancel} 
              style={[styles.cancelButton, { borderColor: '#22c55e', backgroundColor: Colors.surface2 }]}
            >
              <Text style={[styles.cancelText, { color: Colors.text }]}>Cancel</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  form: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: 'transparent',
    elevation: 0,
  },
  summaryCardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCardAmount: {
    color: '#10f297',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
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
    fontSize: 14,
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
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    minHeight: 70,
  },
  categoryButtonActive: {
    backgroundColor: "rgba(16, 242, 151, 0.15)",
    borderColor: "#10f297",
    borderWidth: 2,
  },
  categoryButtonText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  categoryButtonTextActive: {
    color: "#10f297",
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6B7280',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  deliveryHint: {
    color: "#10f297",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
    borderTopWidth: 1,
    backgroundColor: "#020617",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#22d3ee",
    overflow: "hidden",
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22c55e",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  saveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#020617",
    letterSpacing: 0.3,
  },
}); 