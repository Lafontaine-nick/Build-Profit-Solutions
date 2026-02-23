import React, { useState, useEffect, useRef } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard } from "react-native";
import { MaterialIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import { PurchaseOrder } from "../contexts/ProjectDataContext";
import { useTheme } from "../contexts/ThemeContext";
import { getColors } from "../theme/getColors";

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
  const [poNumber, setPONumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (visible && purchaseOrder) {
      setPONumber(purchaseOrder.poNumber);
      setVendor(purchaseOrder.vendor);
      setAmount(String(purchaseOrder.amount));
      setDescription(purchaseOrder.description || "");
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
      // Preserve category and expectedDelivery from original
    });

    Alert.alert('Updated!', 'Purchase Order updated successfully');
    onClose();
  };


  const descriptionRef = useRef<TextInput>(null);
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
                  style={[styles.backBtn, !darkMode && { backgroundColor: '#FFFFFF' }]}
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
                  <View style={[styles.headerIconContainer, !darkMode && { backgroundColor: '#FFFFFF' }]}>
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
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>Vendor / Supplier *</Text>
              <View style={[styles.inputWrapper, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <Feather
                  name="store"
                  size={16}
                  color={darkMode ? "#8DA0B8" : "#6B7280"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, !darkMode && { color: '#000000' }]}
                  placeholder="e.g., Home Depot, ABC Contractors"
                  placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
                  value={vendor}
                  onChangeText={setVendor}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: '#000000' }]}>Amount *</Text>
              <View style={[styles.inputWrapper, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <Feather
                  name="dollar-sign"
                  size={16}
                  color="#22c55e"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, !darkMode && { color: '#000000' }]}
                  placeholder="$ 0.00"
                  placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
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
                  placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
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
                  placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
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
          <View style={[styles.actions, { borderTopColor: Colors.line, backgroundColor: darkMode ? '#000000' : '#FFFFFF' }]}>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
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
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
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