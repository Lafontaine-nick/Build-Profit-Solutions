import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { useProjectData } from "@/contexts/ProjectDataContext";
import * as Haptics from "expo-haptics";
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';

const BRAND_GREEN = "#22c55e";
const BRAND_CYAN = "#22d3ee";

interface AddMaterialScreenProps {
  navigation: any;
  // optional: you can pass in a callback and wire it to backend
  onSave?: (payload: {
    vendor: string;
    amount: number;
    description: string;
    poNumber: string;
  }) => void;
}

const presetAmounts = [100, 500, 1000, 2500];

const AddMaterialScreen: React.FC<AddMaterialScreenProps> = ({
  navigation,
  onSave,
}) => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);
  const placeholderTint = darkMode ? "rgba(226, 232, 240, 0.58)" : Colors.sub;
  const { addExpense } = useProjectData();
  
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState("");
  const [description, setDescription] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);

  const numericAmount = parseFloat(amount.replace(/,/g, "") || "0");

  const handlePresetPress = (value: number) => {
    setSelectedPreset(value);
    setAmount(value.toString());
  };

  // Request camera permission
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to take receipt photos');
      return false;
    }
    return true;
  };

  // Request media library permission
  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is required to upload receipts');
      return false;
    }
    return true;
  };

  // Take photo of receipt
  const takeReceiptPhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.55,
        base64: true, // Request base64 directly from ImagePicker
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setReceiptUri(asset.uri);
        // Trigger OCR processing with URI and base64 if available
        processOCR(asset.uri, asset.base64);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Upload receipt from gallery
  const uploadReceipt = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.55,
        base64: true, // Request base64 directly from ImagePicker
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setReceiptUri(asset.uri);
        // Trigger OCR processing with URI and base64 if available
        processOCR(asset.uri, asset.base64);
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
      Alert.alert('Error', 'Failed to upload receipt. Please try again.');
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

  // Process OCR using receiptOCRService
  const processOCR = async (uri: string, base64Data?: string) => {
    setIsProcessingOCR(true);
    setShowOCRModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      console.log('🔍 Starting OCR processing for receipt:', uri);
      
      // Import receiptOCRService dynamically
      const { receiptOCRService } = await import('@/services/receiptOCRService');
      
      // Process receipt with OCR - pass base64 if available, otherwise let service convert
      // Prefer URI/file upload path for faster network payloads.
      const ocrResult = await receiptOCRService.processReceipt(uri);
      
      console.log('📄 OCR Result:', ocrResult);
      
      if (ocrResult.success && ocrResult.data) {
        const receiptData = ocrResult.data;
        
        // Auto-fill form fields from OCR data
        if (receiptData.vendor) {
          setVendor(receiptData.vendor);
        }
        if (receiptData.amount) {
          setAmount(receiptData.amount.toString());
        }
        if (receiptData.items && receiptData.items.length > 0) {
          // Create description from receipt items
          const itemsDescription = receiptData.items
            .map(item => `${item.description}${item.quantity ? ` (Qty: ${item.quantity})` : ''}`)
            .join(', ');
          setDescription(itemsDescription);
        }
        
        // Close modal after a brief delay to show success
        setTimeout(() => {
          setShowOCRModal(false);
          Alert.alert(
            'Receipt Scanned! 📄',
            `Vendor: ${receiptData.vendor}\nAmount: $${receiptData.amount.toFixed(2)}\nConfidence: ${receiptData.confidence}%\n\nFields have been auto-filled.`,
            [{ text: 'OK' }]
          );
        }, 500);
      } else {
        setShowOCRModal(false);
        const errorMsg = ocrResult.error || 'Could not extract data automatically';
        console.warn('⚠️ OCR failed:', errorMsg);
        Alert.alert(
          'OCR Processing',
          `Receipt scanned. ${errorMsg}. Please enter details manually.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('❌ OCR processing error:', error);
      setShowOCRModal(false);
      const errorMessage = error?.message || 'Unknown error occurred';
      Alert.alert(
        'OCR Processing Error',
        `Error: ${errorMessage}\n\nPlease enter details manually.`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const handleSave = () => {
    // basic validation
    if (!vendor.trim() || !numericAmount) {
      Alert.alert('Required Fields', 'Vendor and amount are required.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Save to project data using ProjectDataContext
    try {
      addExpense({
        id: Date.now().toString(),
        vendor: vendor.trim(),
        amount: numericAmount,
        category: 'Materials/Equipment',
        date: new Date().toISOString(),
        notes: description.trim() || undefined,
        receiptUri: receiptUri || undefined,
      });

      // Also call the onSave callback if provided
      if (onSave) {
        onSave({
          vendor: vendor.trim(),
          amount: numericAmount,
          scope: scope.trim(),
          description: description.trim(),
          poNumber: poNumber.trim(),
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate back to Budget tab on project detail page
      if (projectId) {
        router.push({
          pathname: `/project-detail/[id]`,
          params: { id: projectId, activeTab: 'Budget', backToProjects: '1' }
        });
      } else {
        // Fallback to go back if no projectId
        navigation?.goBack?.();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.content}>
            {/* HEADER */}
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => navigation?.goBack?.()}
                style={styles.headerIconButton}
              >
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : Colors.text} />
              </Pressable>

              <View style={styles.headerTitleRow}>
                <View style={styles.headerAvatar}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={24}
                    color={BRAND_GREEN}
                  />
                </View>
                <View style={styles.headerTextBlock}>
                  <Text style={styles.headerTitle}>Add Materials & Equipment</Text>
                  <Text style={styles.headerSubtitle}>
                    Log your material or equipment expense
                  </Text>
                </View>
              </View>
            </View>

            {/* CONTENT */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Vendor */}
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
                    style={styles.input}
                    placeholder="e.g., Home Depot, ABC Contractors"
                    placeholderTextColor={placeholderTint}
                    value={vendor}
                    onChangeText={setVendor}
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Amount */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Amount *</Text>
                <View style={styles.inputWrapper}>
                  <Feather
                    name="dollar-sign"
                    size={16}
                    color={BRAND_GREEN}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="$ 0.00"
                    placeholderTextColor={placeholderTint}
                    value={amount}
                    onChangeText={(text) => {
                      // simple numeric filter
                      const cleaned = text.replace(/[^0-9.]/g, "");
                      setAmount(cleaned);
                      if (selectedPreset) setSelectedPreset(null);
                    }}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>

                {/* Quick amounts */}
                <View style={styles.chipRow}>
                  {presetAmounts.map((val) => {
                    const isActive = selectedPreset === val;
                    return (
                      <Pressable
                        key={val}
                        onPress={() => handlePresetPress(val)}
                        style={({ pressed }) => [
                          styles.chip,
                          isActive && styles.chipActive,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isActive && styles.chipTextActive,
                          ]}
                        >
                          ${val.toLocaleString()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Scope */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Scope (Optional)</Text>
                <View style={styles.inputWrapper}>
                  <Feather
                    name="layers"
                    size={16}
                    color="#8DA0B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Foundation, Framing, Rough-in"
                    placeholderTextColor={placeholderTint}
                    value={scope}
                    onChangeText={setScope}
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Description */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Description (Optional)</Text>
                <View style={styles.textAreaWrapper}>
                  <Feather
                    name="file-text"
                    size={16}
                    color="#8DA0B8"
                    style={styles.inputIconTop}
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="What was purchased or service provided?"
                    placeholderTextColor={placeholderTint}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                  />
                </View>
              </View>

              {/* PO Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>PO Number (Optional)</Text>
                <View style={styles.inputWrapper}>
                  <Feather
                    name="tag"
                    size={16}
                    color="#8DA0B8"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., PO-1003"
                    placeholderTextColor={placeholderTint}
                    value={poNumber}
                    onChangeText={setPoNumber}
                    returnKeyType="done"
                  />
                </View>
              </View>

              {/* Receipt Section */}
              <View style={[styles.fieldGroup, { marginBottom: 90 }]}>
                <Text style={styles.label}>Receipt (Optional)</Text>
                {receiptUri ? (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ position: 'relative', marginBottom: 8 }}>
                      <Image 
                        source={{ uri: receiptUri }} 
                        style={{ width: '100%', height: 200, borderRadius: 12 }} 
                        resizeMode="cover" 
                      />
                      <Pressable
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
                      </Pressable>
                    </View>
                    {isProcessingOCR && (
                      <Text style={{ color: '#22c55e', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                        Processing receipt...
                      </Text>
                    )}
                  </View>
                ) : (
                  <Pressable
                    onPress={showReceiptOptions}
                    style={styles.receiptUploadButton}
                  >
                    <MaterialIcons name="receipt" size={32} color="#8DA0B8" />
                    <Text style={styles.receiptUploadText}>
                      📸 Take Photo or 📄 Upload Receipt
                    </Text>
                    <Text style={styles.receiptUploadSubtext}>
                      Auto-fill from receipt (OCR)
                    </Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>

            {/* OCR Processing Modal */}
            <Modal
              visible={showOCRModal}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowOCRModal(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>OCR Processing</Text>
                  <Text style={styles.modalMessage}>
                    Receipt scanned. Auto-fill available if data detected.
                  </Text>
                  {isProcessingOCR && (
                    <ActivityIndicator size="large" color="#22c55e" style={{ marginTop: 20 }} />
                  )}
                  <Pressable
                    onPress={() => setShowOCRModal(false)}
                    style={styles.modalButton}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>

            {/* BOTTOM ACTION BAR */}
            <View style={styles.bottomBar}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => navigation?.goBack?.()}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                onPress={handleSave}
              >
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveText}>✓ Save</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const getStyles = (Colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    flex: 1,
  },

  /* HEADER */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 22,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: isDark ? "rgba(34, 197, 94, 0.12)" : Colors.surface2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: isDark ? "rgba(148, 163, 184, 0.2)" : Colors.line,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  headerSubtitle: {
    fontSize: 14,
    color: isDark ? "rgba(226, 232, 240, 0.78)" : Colors.sub,
    marginTop: 6,
    fontWeight: "500",
    letterSpacing: 0.15,
    lineHeight: 20,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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

  /* INPUTS */
  inputBorder: {
    borderRadius: 20,
    padding: 1,
  },
  inputWrapper: {
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : Colors.surface2,
    borderWidth: 1,
    borderColor: isDark ? "rgba(148, 163, 184, 0.16)" : Colors.line,
  },
  textAreaWrapper: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : Colors.surface2,
    borderWidth: 1,
    borderColor: isDark ? "rgba(148, 163, 184, 0.16)" : Colors.line,
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
    color: Colors.text,
    fontWeight: "500",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  /* CHIPS */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? "rgba(148, 163, 184, 0.14)" : Colors.line,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : Colors.surface2,
  },
  chipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderColor: "#22c55e",
  },
  chipText: {
    fontSize: 14,
    color: BRAND_GREEN,
    fontWeight: "600",
  },
  chipTextActive: {
    fontWeight: "700",
  },

  /* BOTTOM BAR */
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 28 : 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? "rgba(148, 163, 184, 0.12)" : Colors.line,
    backgroundColor: "#000000",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? "rgba(148, 163, 184, 0.28)" : Colors.line,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : Colors.surface2,
    alignItems: "center",
    justifyContent: "center",
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
    shadowColor: BRAND_GREEN,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: isDark ? "rgba(226, 232, 240, 0.78)" : Colors.sub,
  },
  saveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.25,
  },

  /* RECEIPT */
  receiptUploadButton: {
    borderWidth: 1.5,
    borderColor: isDark ? "rgba(148, 163, 184, 0.28)" : Colors.line,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : Colors.surface2,
    marginTop: 8,
  },
  receiptUploadText: {
    color: isDark ? "rgba(226, 232, 240, 0.82)" : Colors.text,
    fontSize: 14,
    marginTop: 10,
    fontWeight: "600",
  },
  receiptUploadSubtext: {
    color: isDark ? "rgba(226, 232, 240, 0.52)" : Colors.sub,
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButton: {
    marginTop: 24,
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 100,
  },
  modalButtonText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default AddMaterialScreen;


