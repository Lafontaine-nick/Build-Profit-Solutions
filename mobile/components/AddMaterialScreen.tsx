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
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState("");
  const [description, setDescription] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const numericAmount = parseFloat(amount.replace(/,/g, "") || "0");

  const handlePresetPress = (value: number) => {
    setSelectedPreset(value);
    setAmount(value.toString());
  };

  const handleSave = () => {
    // basic validation
    if (!vendor.trim() || !numericAmount) {
      // you can replace with your toast/snackbar
      console.log("Vendor and amount are required.");
      return;
    }

    const payload = {
      vendor: vendor.trim(),
      amount: numericAmount,
      scope: scope.trim(),
      description: description.trim(),
      poNumber: poNumber.trim(),
    };

    if (onSave) {
      onSave(payload);
    }

    // navigate back or to success state
    navigation?.goBack?.();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

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
                    placeholderTextColor="rgba(255,255,255,0.4)"
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
                    placeholderTextColor="rgba(255,255,255,0.4)"
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
                    placeholderTextColor="rgba(255,255,255,0.4)"
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
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                  />
                </View>
              </View>

              {/* PO Number */}
              <View style={[styles.fieldGroup, { marginBottom: 90 }]}>
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
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={poNumber}
                    onChangeText={setPoNumber}
                    returnKeyType="done"
                  />
                </View>
              </View>
            </ScrollView>

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

const getStyles = (Colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    flex: 1,
  },

  /* HEADER */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    marginBottom: 24,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
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
    fontSize: 13,
    color: "#8DA0B8",
    marginTop: 4,
    fontWeight: "500",
    letterSpacing: 0.2,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
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

  /* INPUTS */
  inputBorder: {
    borderRadius: 20,
    padding: 1,
  },
  inputWrapper: {
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  textAreaWrapper: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.line,
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
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface2,
  },
  chipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
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
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    backgroundColor: Colors.bg,
  },
  cancelButton: {
    flex: 1,
    marginRight: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND_GREEN,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  saveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#020617",
    letterSpacing: 0.3,
  },
});

export default AddMaterialScreen;


