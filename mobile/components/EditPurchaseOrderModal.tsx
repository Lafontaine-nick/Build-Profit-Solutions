import React, { useState, useEffect, useRef } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard } from "react-native";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import { PurchaseOrder } from "../contexts/ProjectDataContext";

type Props = {
  visible: boolean;
  purchaseOrder: PurchaseOrder | null;
  onClose: () => void;
  onSave: (po: PurchaseOrder) => void;
  onCancel: (id: string) => void;
};

export default function EditPurchaseOrderModal({ visible, purchaseOrder, onClose, onSave, onCancel }: Props) {
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

  const handleCancel = () => {
    if (!purchaseOrder) return;
    
    Alert.alert(
      'Cancel Purchase Order?',
      `Cancel ${poNumber}? This cannot be undone.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel PO',
          style: 'destructive',
          onPress: () => {
            onCancel(purchaseOrder.id);
            onClose();
          }
        }
      ]
    );
  };

  const descriptionRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  if (!purchaseOrder) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
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
                  style={styles.backBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.headerIconContainer}>
                  <Text style={{ fontSize: 24 }}>📋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Edit Purchase Orders</Text>
                  <Text style={styles.subtitle}>Transactions & Invoices</Text>
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
            <View style={styles.field}>
              <Text style={styles.label}>Vendor / Supplier *</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={vendor}
                onChangeText={setVendor}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Amount *</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={[styles.input, styles.amountInput]}
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
                style={[styles.input, styles.textArea]}
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
                style={styles.input}
                placeholderTextColor="rgba(255,255,255,0.4)"
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
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity 
              onPress={handleCancel} 
              style={[styles.button, styles.deleteButton]}
            >
              <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                Keyboard.dismiss();
                handleSave();
              }} 
              style={[styles.button, styles.saveButton]}
            >
              <Text style={styles.saveButtonText}>✓ Save</Text>
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
    backgroundColor: "#020617",
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
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(67, 206, 162, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.25)',
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
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dollarSign: {
    position: "absolute",
    left: 14,
    color: "rgba(255,255,255,0.6)",
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
    color: "#10f297",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 10,
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  deleteButton: {
    flex: 0.45,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#10f297",
    shadowColor: '#10f297',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  saveButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
}); 