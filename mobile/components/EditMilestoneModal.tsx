import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, SafeAreaView, StatusBar, KeyboardAvoidingView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, COLORS } from "../src/theme/colors";
import type { Milestone, MilestoneStatus, MilestoneCostCategory } from "../src/types/timeline";
import GreyCalendar from "./GreyCalendar";
import GradientRingBackInner from "./GradientRingBackInner";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

type Props = {
  visible: boolean;
  milestone: Milestone | null;
  projectBudget?: number;
  paymentMilestones?: any[]; // Estimate payment milestones for reference
  onClose: () => void;
  onSave: (milestone: Milestone) => void | boolean | Promise<unknown>;
  onDelete?: (id: string) => void;
};

export default function EditMilestoneModal({ visible, milestone, projectBudget = 0, paymentMilestones = [], onClose, onSave, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const ThemeColors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  
  const [title, setTitle] = useState("");
  const [plannedDate, setPlannedDate] = useState(new Date());
  const [status, setStatus] = useState<MilestoneStatus>("pending");
  const [assignee, setAssignee] = useState("");
  const [costDelta, setCostDelta] = useState("");
  const [costCategory, setCostCategory] = useState<MilestoneCostCategory>("materials");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Debug logging
  useEffect(() => {
    if (visible) {
      console.log('🔍 EditMilestoneModal - visible:', visible, 'milestone:', milestone?.id, milestone?.title);
    }
  }, [visible, milestone]);

  useEffect(() => {
    if (visible && milestone) {
      setTitle(milestone.title);
      setPlannedDate(new Date(milestone.plannedDate + 'T00:00:00'));
      setStatus(milestone.status);
      setAssignee(milestone.assignee || "");
      setCostDelta(milestone.costDelta ? String(milestone.costDelta) : "");
      setCostCategory(milestone.costCategory || "materials");
      // Keep the original payment amount - don't change it
      setPaymentAmount(milestone.amount ? String(milestone.amount) : "");
    }
  }, [visible, milestone]);

  const handleSave = () => {
    if (!milestone) {
      console.error('❌ Cannot save: milestone is null');
      return;
    }
    
    const cost = parseFloat(costDelta) || undefined;
    const amount = parseFloat(paymentAmount) || undefined;

    // Auto-set progress to 100% if completed, otherwise keep existing progress
    let finalProgress = milestone.progressPct || 0;
    if (status === 'completed') {
      finalProgress = 100;
    } else if (status === 'in_progress' && finalProgress === 0) {
      finalProgress = 50;
    }

    const updatedMilestone = {
      ...milestone,
      title: title.trim(),
      plannedDate: `${plannedDate.getFullYear()}-${String(plannedDate.getMonth() + 1).padStart(2, '0')}-${String(plannedDate.getDate()).padStart(2, '0')}`,
      progressPct: finalProgress,
      status: status,
      assignee: assignee.trim() || undefined,
      costDelta: cost,
      costCategory: cost !== undefined ? costCategory : undefined,
      amount: amount, // Keep the original payment amount
    };

    console.log(`💾 Saving milestone:`, {
      id: updatedMilestone.id,
      title: updatedMilestone.title,
      status: updatedMilestone.status,
      progress: updatedMilestone.progressPct,
      amount: updatedMilestone.amount,
      plannedDate: updatedMilestone.plannedDate
    });

    // Call onSave - it may show a confirmation dialog for final payments
    // If it returns a promise or indicates it handled the save, don't close the modal
    try {
      const result = onSave(updatedMilestone);
      console.log('✅ onSave callback executed, result:', result);
      
      // Check if onSave returned a value indicating it's handling the save (like a promise or boolean)
      // If it did, don't close the modal - let the confirmation dialog handle it
      if (result === false || (result && typeof result === 'object' && 'then' in result)) {
        console.log('⏸️ onSave is handling the save flow - not closing modal');
        return; // Don't close modal, let the confirmation dialog handle it
      }
    } catch (error) {
      console.error('❌ Error in onSave callback:', error);
      Alert.alert('Error', 'Failed to save milestone. Please try again.');
      return; // Don't close modal if save failed
    }
    
    // Normal save flow (no confirmation dialog) - close modal
    onClose();

    // Show success message after a brief delay
    setTimeout(() => {
      Alert.alert(
        '✅ Saved!',
        `${title} status updated to ${status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Pending'}\n\nChanges are automatically saved.`,
        [{ text: 'OK' }]
      );
    }, 100);
  };

  // Don't render if not visible or no milestone
  if (!visible || !milestone) return null;

  const statuses: { value: MilestoneStatus; label: string; color: string }[] = [
    { value: 'pending', label: 'Pending', color: Colors.gray },
    { value: 'in_progress', label: 'In Progress', color: "#22d3ee" },
    { value: 'completed', label: 'Completed', color: "#22c55e" },
  ];

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.keyboardAvoid, { backgroundColor: darkMode ? '#000000' : ThemeColors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -120 : 0}
      >
      <View style={[styles.container, !darkMode && { backgroundColor: ThemeColors.bg }]}>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.backButtonWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <GradientRingBackInner
                  darkMode={darkMode}
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    onClose();
                  }}
                  style={[styles.backButton, !darkMode && { backgroundColor: ThemeColors.bg }]}
                >
                  <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : ThemeColors.text} />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.title, !darkMode && { color: ThemeColors.text }]}>Edit Milestone</Text>
              <Text style={[styles.subtitle, !darkMode && { color: ThemeColors.sub }]}>{milestone.title}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* Form */}
          <ScrollView 
            style={[styles.form, { backgroundColor: darkMode ? '#000000' : ThemeColors.bg }]} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
          >
            <View style={styles.field}>
              <Text style={[styles.label, !darkMode && { color: ThemeColors.text }]}>Milestone Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: ThemeColors.surface2,
                    borderColor: ThemeColors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: ThemeColors.text,
                    fontSize: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Foundation Complete"
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : ThemeColors.sub}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, !darkMode && { color: ThemeColors.text }]}>Payment Amount</Text>
              <View style={[
                styles.amountInputContainer,
                {
                  backgroundColor: ThemeColors.surface2,
                  borderColor: ThemeColors.line,
                  borderWidth: 2,
                  borderRadius: 14,
                  minHeight: 60,
                  paddingVertical: 16,
                }
              ]}>
                <Text style={[styles.dollarSign, { fontSize: 22, fontWeight: '700', left: 18 }]}>$</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.amountInput,
                    {
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                      color: ThemeColors.text,
                      fontSize: 20,
                      fontWeight: '600',
                      paddingLeft: 36,
                    }
                  ]}
                  value={paymentAmount ? (() => {
                    const num = parseFloat(paymentAmount.replace(/,/g, ''));
                    return isNaN(num) ? '' : num.toLocaleString('en-US');
                  })() : ''}
                  onChangeText={(text) => {
                    // Remove all non-numeric characters except decimal point
                    const num = text.replace(/[^0-9.]/g, '').replace(/,/g, '');
                    setPaymentAmount(num);
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={darkMode ? Colors.subtext : ThemeColors.sub}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, !darkMode && { color: ThemeColors.text }]}>Status</Text>
              <View style={styles.statusButtons}>
                {statuses.map(s => (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => {
                      console.log(`🔄 Status button clicked: ${s.value}`);
                      setStatus(s.value);
                      // Don't change payment amount - keep it as is
                      console.log(`✅ Status changed to ${s.value} - payment amount remains $${paymentAmount}`);
                    }}
                    style={[
                      styles.statusButton,
                      {
                        backgroundColor: status === s.value ? s.color : ThemeColors.surface2,
                        borderColor: status === s.value ? s.color : ThemeColors.line,
                        borderWidth: 1,
                        borderRadius: 12,
                      }
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        !darkMode && { color: ThemeColors.sub },
                        status === s.value && styles.statusButtonTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, !darkMode && { color: ThemeColors.text }]}>Planned Date</Text>
              <TouchableOpacity 
                onPress={() => setShowDatePicker(!showDatePicker)}
                style={[
                  styles.dateButton,
                  {
                    backgroundColor: ThemeColors.surface2,
                    borderColor: ThemeColors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                  }
                ]}
              >
                <Text style={[styles.dateButtonText, !darkMode && { color: ThemeColors.text }]}>
                  📅 {plannedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <GreyCalendar
                    onDayPress={(day) => {
                      const selectedDate = new Date(day.dateString + 'T00:00:00');
                      setPlannedDate(selectedDate);
                      setShowDatePicker(false);
                    }}
                    markedDates={{
                      [`${plannedDate.getFullYear()}-${String(plannedDate.getMonth() + 1).padStart(2, '0')}-${String(plannedDate.getDate()).padStart(2, '0')}`]: {
                        selected: true,
                        selectedColor: '#22c55e',
                        selectedTextColor: '#000000',
                      }
                    }}
                    initialDate={`${plannedDate.getFullYear()}-${String(plannedDate.getMonth() + 1).padStart(2, '0')}-${String(plannedDate.getDate()).padStart(2, '0')}`}
                  />
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, !darkMode && { color: ThemeColors.text }]}>Assignee (Optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: ThemeColors.surface2,
                    borderColor: ThemeColors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: ThemeColors.text,
                    fontSize: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }
                ]}
                value={assignee}
                onChangeText={setAssignee}
                placeholder="e.g., BrightSpark Electrical LLC"
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : ThemeColors.sub}
                autoCapitalize="words"
                selectionColor={darkMode ? "rgba(34, 197, 94, 0.4)" : "rgba(34, 197, 94, 0.3)"}
                cursorColor={ThemeColors.text}
                keyboardAppearance={darkMode ? "dark" : "light"}
              />
            </View>

          </ScrollView>

          {/* Actions */}
          <View style={[
            styles.actions,
            !darkMode && { backgroundColor: ThemeColors.bg, borderTopColor: ThemeColors.line },
            { paddingBottom: Math.max(insets.bottom, 20) + 30 },
          ]}>
            <View style={styles.cancelButtonWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.cancelButtonBorder}
              >
                <TouchableOpacity 
                  onPress={onClose}
                  style={[styles.button, styles.cancelButton, !darkMode && { backgroundColor: ThemeColors.bg }]}
                >
                  <Text style={[styles.cancelButtonText, !darkMode && { color: ThemeColors.text }]}>Cancel</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
            <TouchableOpacity 
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
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
                <Text style={styles.saveButtonText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    marginBottom: 8,
  },
  backButtonWrapper: {
    marginRight: 12,
  },
  backButtonBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#8DA0B8",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },
  form: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  inputBorder: {
    borderRadius: 20,
    padding: 1,
  },
  input: {
    // backgroundColor, borderColor, borderWidth, borderRadius, color, fontSize, padding are set dynamically
    fontWeight: "500",
  },
  statusButtons: {
    flexDirection: "row",
    gap: 10,
  },
  statusButton: {
    flex: 1,
    // backgroundColor, borderColor, borderWidth, borderRadius are set dynamically
    paddingVertical: 12,
    alignItems: "center",
  },
  statusButtonText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
  },
  statusButtonTextActive: {
    color: "#0d1b2a",
  },
  dateButton: {
    // backgroundColor, borderColor, borderWidth, borderRadius are set dynamically
    padding: 14,
  },
  datePickerContainer: {
    marginTop: 12,
  },
  dateButtonText: {
    color: "white",
    fontSize: 16,
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
  hint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 6,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  button: {
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  cancelButtonWrapper: {
    flex: 1,
  },
  cancelButtonBorder: {
    borderRadius: 16,
    padding: 1,
  },
  cancelButton: {
    backgroundColor: "#000000",
    borderRadius: 15,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  deleteButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  deleteButtonText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "700",
  },
  categoryButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryButton: {
    flex: 1,
    minWidth: "45%",
    // backgroundColor, borderColor, borderWidth, borderRadius are set dynamically
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  categoryButtonActive: {
    // Styling handled dynamically
  },
  categoryButtonText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "600",
  },
  categoryButtonTextActive: {
    color: "#22c55e",
  },
}); 