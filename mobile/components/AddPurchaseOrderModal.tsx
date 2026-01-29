import React, { useState, useRef, useEffect } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard, Platform, KeyboardAvoidingView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import DateTimePicker from '@react-native-community/datetimepicker';

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
  const [poNumber, setPONumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("Materials");
  const [amount, setAmount] = useState("");
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
    setDescription("");
    setOrderDate(new Date());
    setExpectedDelivery(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  };

  const handleCancel = () => {
    setPONumber("");
    setVendor("");
    setCategory("Materials");
    setAmount("");
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
            <View style={styles.field}>
              <Text style={styles.label}>PO Number *</Text>
              <TextInput
                ref={poRef}
                style={styles.input}
                placeholder="PO-123456"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={poNumber}
                onChangeText={setPONumber}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vendor / Supplier *</Text>
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

            <View style={styles.field}>
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

            <View style={styles.field}>
              <Text style={styles.label}>Amount *</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  ref={amountRef}
                  style={[styles.input, styles.amountInput]}
                  placeholder="0.00"
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
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Order Date</Text>
              <TouchableOpacity 
                onPress={() => setShowOrderDatePicker(true)}
                style={styles.dateButton}
              >
                <MaterialIcons name="calendar-today" size={18} color="#10f297" style={{ marginRight: 8 }} />
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

            <View style={styles.field}>
              <Text style={styles.label}>Expected Delivery</Text>
              <TouchableOpacity 
                onPress={() => setShowDeliveryDatePicker(true)}
                style={styles.dateButton}
              >
                <MaterialIcons name="local-shipping" size={18} color="#10f297" style={{ marginRight: 8 }} />
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

            <View style={styles.field}>
              <Text style={styles.label}>Description / Items</Text>
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
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity 
              onPress={handleCancel} 
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                Keyboard.dismiss();
                handleSave();
              }} 
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText} numberOfLines={1}>✓ Create Purchase Order</Text>
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
  field: {
    marginBottom: 20,
  },
  label: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  input: {
    color: "white",
    fontSize: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: 'relative',
  },
  dollarSign: {
    position: "absolute",
    left: 14,
    color: "#10f297",
    fontSize: 18,
    fontWeight: "600",
    zIndex: 1,
  },
  amountInput: {
    paddingLeft: 32,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dateButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  deliveryHint: {
    color: "#10f297",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'transparent',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10f297',
    shadowColor: '#10f297',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#020617',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
}); 