import React, { useState, useRef, useEffect, useMemo } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

type Props = {
  visible: boolean;
  categoryName: string;
  onClose: () => void;
  onSave: (transaction: { 
    id: string; 
    vendor: string; 
    amount: number; 
    description: string; 
    po?: string; 
    date: string;
    receiptUri?: string;
    isPlanned?: boolean;
    projectPhase?: string;
    scope?: string;
    priceReasonableness?: 'normal' | 'high' | 'outlier';
  }) => void;
};

export default function AddTransactionModal({ visible, categoryName, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [po, setPo] = useState("");
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isPlanned, setIsPlanned] = useState<boolean>(true);
  const [projectPhase, setProjectPhase] = useState<string>('');
  const [scope, setScope] = useState<string>('');
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [priceReasonableness, setPriceReasonableness] = useState<'normal' | 'high' | 'outlier' | null>(null);

  // Input refs for keyboard navigation
  const vendorRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const poRef = useRef<TextInput>(null);

  // Auto-focus vendor field when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => vendorRef.current?.focus(), 100);
      // Reset form when modal opens
      setReceiptUri(null);
      setIsPlanned(true);
      setProjectPhase('');
      setScope('');
      setPriceReasonableness(null);
    }
  }, [visible]);

  // Check price reasonableness when amount changes
  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
      const amountNum = parseFloat(amount);
      // Simple heuristic: >$5000 is high, >$10000 is outlier (can be enhanced with AI)
      if (amountNum > 10000) {
        setPriceReasonableness('outlier');
      } else if (amountNum > 5000) {
        setPriceReasonableness('high');
      } else {
        setPriceReasonableness('normal');
      }
    } else {
      setPriceReasonableness(null);
    }
  }, [amount]);

  // Request camera permissions
  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to take receipt photos');
      return false;
    }
    return true;
  };

  // Request media library permissions
  const requestMediaLibraryPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is required to upload receipts');
      return false;
    }
    return true;
  };

  // Take photo of receipt
  const takeReceiptPhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setReceiptUri(uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Trigger OCR processing
        processOCR(uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Upload receipt from gallery
  const uploadReceipt = async () => {
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setReceiptUri(uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Trigger OCR processing
        processOCR(uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Show receipt options
  const showReceiptOptions = () => {
    Alert.alert(
      "Add Receipt",
      "Capture or upload a receipt",
      [
        { text: "📸 Take Photo", onPress: takeReceiptPhoto },
        { text: "🖼️ Upload from Gallery", onPress: uploadReceipt },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  // Process OCR (mock implementation - can be replaced with real OCR service)
  const processOCR = async (uri: string) => {
    setIsProcessingOCR(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Simulate OCR processing delay
    setTimeout(() => {
      // Mock OCR results - in production, this would call an OCR API
      // For now, we'll just show a success message
      // In real implementation, extract: vendor, amount, date from receipt
      Alert.alert(
        'OCR Processing',
        'Receipt scanned. Auto-fill available if data detected.',
        [{ text: 'OK' }]
      );
      setIsProcessingOCR(false);
      
      // In production, you would:
      // 1. Send image to OCR service
      // 2. Extract vendor, amount, date
      // 3. Auto-fill fields if data is found
      // Example:
      // const ocrResult = await callOCRService(uri);
      // if (ocrResult.vendor) setVendor(ocrResult.vendor);
      // if (ocrResult.amount) setAmount(ocrResult.amount.toString());
      // if (ocrResult.date) setDate(ocrResult.date);
    }, 1500);
  };

  const categoryIcon = categoryName === 'Labor' ? '👷' : 
                       categoryName === 'Materials' ? '🧱' :
                       categoryName === 'Equipment' ? '🔧' : 
                       categoryName === 'Subs' ? '👥' : '📦';

  // Customize labels based on category
  const vendorLabel = categoryName === 'Labor' || categoryName === 'Subs' 
    ? 'Sub / Trade *' 
    : 'Vendor / Supplier *';
  
  const vendorPlaceholder = categoryName === 'Labor' || categoryName === 'Subs'
    ? 'e.g., ABC Electrical, Joe\'s Plumbing'
    : 'e.g., Home Depot, ABC Contractors';

  const descriptionPlaceholder = categoryName === 'Labor' || categoryName === 'Subs'
    ? 'What work was performed?'
    : categoryName === 'Equipment'
    ? 'What was rented or purchased?'
    : 'What was purchased or service provided?';

  const handleSave = () => {
    if (!vendor.trim()) {
      const fieldName = categoryName === 'Labor' || categoryName === 'Subs' ? 'sub/trade name' : 'vendor name';
      Alert.alert("Required", `Please enter a ${fieldName}`);
      return;
    }
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    onSave({
      id: `txn-${Date.now()}`,
      vendor: vendor.trim(),
      amount: amountNum,
      description: description.trim(),
      po: po.trim() || undefined,
      date: new Date().toISOString(),
      receiptUri: receiptUri || undefined,
      isPlanned,
      projectPhase: projectPhase || undefined,
      scope: scope || undefined,
      priceReasonableness: priceReasonableness || undefined,
    });

    // Reset form
    setVendor("");
    setAmount("");
    setDescription("");
    setPo("");
    setReceiptUri(null);
    setIsPlanned(true);
    setProjectPhase('');
    setScope('');
    setPriceReasonableness(null);
  };

  const handleCancel = () => {
    setVendor("");
    setAmount("");
    setDescription("");
    setPo("");
    setReceiptUri(null);
    setIsPlanned(true);
    setProjectPhase('');
    setScope('');
    setPriceReasonableness(null);
    onClose();
  };

  const scrollViewRef = useRef<ScrollView>(null);

  // Format category name for display
  const displayCategoryName = categoryName.replace('/', ' & ');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, !darkMode && { backgroundColor: Colors.bg }]}>
          {/* Header */}
          <View style={[styles.header, !darkMode && { borderBottomColor: Colors.line }]}>
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
                  style={[styles.backBtn, { backgroundColor: Colors.bg }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : Colors.text} />
                </TouchableOpacity>
              </LinearGradient>
            </View>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconContainerWrapper}>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.headerIconBorder}
                >
                  <View style={[styles.headerIconContainer, { backgroundColor: Colors.bg }]}>
                    <Text style={{ fontSize: 24 }}>{categoryIcon}</Text>
                  </View>
                </LinearGradient>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: Colors.text }]}>Add {displayCategoryName}</Text>
                <Text style={[styles.subtitle, { color: Colors.sub }]}>Log your expense</Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.form} 
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>{vendorLabel}</Text>
              <TextInput
                ref={vendorRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: Colors.text,
                  }
                ]}
                placeholder={vendorPlaceholder}
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                value={vendor}
                onChangeText={setVendor}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => amountRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.field}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={[styles.label, { color: Colors.text }]}>Amount *</Text>
                {priceReasonableness && (
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: 
                      priceReasonableness === 'normal' ? 'rgba(34, 197, 94, 0.2)' :
                      priceReasonableness === 'high' ? 'rgba(245, 158, 11, 0.2)' :
                      'rgba(239, 68, 68, 0.2)',
                    borderWidth: 1,
                    borderColor:
                      priceReasonableness === 'normal' ? 'rgba(34, 197, 94, 0.4)' :
                      priceReasonableness === 'high' ? 'rgba(245, 158, 11, 0.4)' :
                      'rgba(239, 68, 68, 0.4)',
                  }}>
                    <Text style={{
                      color:
                        priceReasonableness === 'normal' ? '#22c55e' :
                        priceReasonableness === 'high' ? '#f59e0b' :
                        '#ef4444',
                      fontSize: 11,
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}>
                      {priceReasonableness === 'normal' ? '✓ Normal' :
                       priceReasonableness === 'high' ? '⚠ High' :
                       '🚨 Outlier'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[
                styles.amountInputContainer,
                {
                  backgroundColor: Colors.surface2,
                  borderColor: Colors.line,
                  borderWidth: 1,
                  borderRadius: 12,
                }
              ]}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  ref={amountRef}
                  style={[
                    styles.input,
                    styles.amountInput,
                    {
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                      color: Colors.text,
                    }
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                  value={amount}
                  onChangeText={(text) => {
                    // Allow only numbers and one decimal point
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    if (parts.length > 2) {
                      setAmount(parts[0] + '.' + parts.slice(1).join(''));
                    } else {
                      setAmount(cleaned);
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="next"
                  onSubmitEditing={() => descriptionRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {amount && !isNaN(parseFloat(amount)) && (
                <Text style={styles.hint}>{formatMoneyFull(parseFloat(amount), { decimals: 2 })}</Text>
              )}
            </View>

            {/* Receipt Capture */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>Receipt (Optional)</Text>
              {receiptUri ? (
                <View style={{ marginTop: 8 }}>
                  <View style={{ position: 'relative', marginBottom: 8 }}>
                    <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setReceiptUri(null);
                      }}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: 20,
                        width: 32,
                        height: 32,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <MaterialIcons name="close" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  {isProcessingOCR && (
                    <Text style={{ color: '#22c55e', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                      Processing receipt...
                    </Text>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  onPress={showReceiptOptions}
                  style={{
                    borderWidth: 2,
                    borderColor: Colors.line,
                    borderStyle: 'dashed',
                    borderRadius: 12,
                    padding: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: Colors.surface2,
                  }}
                >
                  <MaterialIcons name="receipt" size={32} color="#8DA0B8" />
                  <Text style={{ color: '#8DA0B8', fontSize: 14, marginTop: 8, fontWeight: '500' }}>
                    📸 Take Photo or 📄 Upload Receipt
                  </Text>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 12, marginTop: 4 }}>
                    Auto-fill from receipt (OCR)
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Planned vs Unplanned Toggle */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>Budget Status *</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsPlanned(true);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isPlanned ? '#22c55e' : Colors.line,
                    backgroundColor: isPlanned ? '#22c55e' : Colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{
                    color: isPlanned ? '#000000' : Colors.text,
                    fontWeight: '600',
                    fontSize: 14,
                  }}>✓ Planned</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsPlanned(false);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: !isPlanned ? '#f59e0b' : Colors.line,
                    backgroundColor: !isPlanned ? 'rgba(245, 158, 11, 0.2)' : Colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{
                    color: !isPlanned ? '#f59e0b' : Colors.text,
                    fontWeight: '600',
                    fontSize: 14,
                  }}>⚠ Unplanned</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Phase / Scope Link */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>Project Phase (Optional)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {['Foundation', 'Framing', 'Rough-in', 'Finish', 'Other'].map((phase) => (
                  <TouchableOpacity
                    key={phase}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setProjectPhase(projectPhase === phase ? '' : phase);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: projectPhase === phase ? '#22c55e' : Colors.line,
                      backgroundColor: projectPhase === phase ? '#22c55e' : Colors.surface2,
                    }}
                  >
                    <Text style={{
                      color: projectPhase === phase ? '#000000' : Colors.text,
                      fontSize: 13,
                      fontWeight: '600',
                    }}>{phase}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>Scope / Location (Optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: Colors.text,
                  }
                ]}
                placeholder="e.g., Kitchen, Unit 3, Bathroom"
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                value={scope}
                onChangeText={setScope}
                returnKeyType="next"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>Description (Optional)</Text>
              <TextInput
                ref={descriptionRef}
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: Colors.text,
                  }
                ]}
                placeholder={descriptionPlaceholder}
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                value={description}
                onChangeText={setDescription}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                multiline
                numberOfLines={2}
                returnKeyType="next"
                onSubmitEditing={() => poRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>PO Number (Optional)</Text>
              <TextInput
                ref={poRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: Colors.text,
                  }
                ]}
                placeholder="e.g., PO-1003"
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                value={po}
                onChangeText={setPo}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                  handleSave();
                }}
              />
            </View>
          </ScrollView>

          {/* Actions */}
          <View
            style={[
              styles.actions,
              { paddingBottom: Math.max(insets.bottom, 20) + 10 },
              !darkMode && { borderTopColor: Colors.line, backgroundColor: Colors.bg },
            ]}
          >
            <View style={styles.cancelButtonWrapper}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.cancelButtonBorder}
              >
                <TouchableOpacity 
                  onPress={handleCancel} 
                  style={[styles.cancelButton, !darkMode && { backgroundColor: Colors.bg }]}
                >
                  <Text style={[styles.cancelButtonText, { color: Colors.text }]}>Cancel</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
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
                <Text style={styles.saveButtonText}>✓ Save</Text>
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
    backgroundColor: "#000000",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
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
  headerIconContainerWrapper: {
    borderRadius: 14,
  },
  headerIconBorder: {
    borderRadius: 14,
    padding: 1,
  },
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 13,
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
    color: "#8DA0B8",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
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
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  inputBorder: {
    borderRadius: 20,
    padding: 1,
  },
  input: {
    // backgroundColor, borderColor, borderWidth, borderRadius, color are set dynamically
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontWeight: "500",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    // backgroundColor, borderColor, borderWidth, borderRadius are set dynamically
  },
  dollarSign: {
    position: "absolute",
    left: 16,
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
    minHeight: 80,
    textAlignVertical: "top",
  },
  hint: {
    color: "#22d3ee",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#000000",
  },
  cancelButtonWrapper: {
    flex: 1,
  },
  cancelButtonBorder: {
    borderRadius: 12,
    padding: 1,
  },
  cancelButton: {
    backgroundColor: "#000000",
    borderRadius: 11,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
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