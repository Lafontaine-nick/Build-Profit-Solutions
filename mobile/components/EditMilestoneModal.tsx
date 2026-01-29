import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, SafeAreaView, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, COLORS } from "../src/theme/colors";
import type { Milestone, MilestoneStatus, MilestoneCostCategory } from "../src/types/timeline";
import GreyCalendar from "./GreyCalendar";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

type Props = {
  visible: boolean;
  milestone: Milestone | null;
  projectBudget?: number;
  paymentMilestones?: any[]; // Estimate payment milestones for reference
  onClose: () => void;
  onSave: (milestone: Milestone) => void;
  onDelete?: (id: string) => void;
};

export default function EditMilestoneModal({ visible, milestone, projectBudget = 0, paymentMilestones = [], onClose, onSave, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const ThemeColors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  
  const [title, setTitle] = useState("");
  const [plannedDate, setPlannedDate] = useState(new Date());
  const [progressPct, setProgressPct] = useState("0");
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
      setProgressPct(String(milestone.progressPct));
      setStatus(milestone.status);
      setAssignee(milestone.assignee || "");
      setCostDelta(milestone.costDelta ? String(milestone.costDelta) : "");
      setCostCategory(milestone.costCategory || "materials");
      setPaymentAmount(milestone.amount ? String(milestone.amount) : "");
    }
  }, [visible, milestone]);

  const handleSave = () => {
    if (!milestone) {
      console.error('❌ Cannot save: milestone is null');
      return;
    }
    
    const progress = Math.min(100, Math.max(0, parseFloat(progressPct) || 0));
    const cost = parseFloat(costDelta) || undefined;
    const amount = parseFloat(paymentAmount) || undefined;

    // Use the manually selected status (user has full control)
    // Only auto-update progress percentage if status is manually changed
    let finalProgress = progress;
    if (status === 'completed' && progress < 100) {
      finalProgress = 100;
    } else if (status === 'pending' && progress > 0) {
      // Keep the progress as is - user might want pending with progress
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
      amount: amount,
    };

    console.log(`💾 Saving milestone:`, {
      id: updatedMilestone.id,
      title: updatedMilestone.title,
      status: updatedMilestone.status,
      progress: updatedMilestone.progressPct,
      plannedDate: updatedMilestone.plannedDate
    });

    // Call onSave FIRST to ensure state update happens while modal is still mounted
    // This prevents stale closures and ensures the update is applied
    try {
      onSave(updatedMilestone);
      console.log('✅ onSave callback executed');
    } catch (error) {
      console.error('❌ Error in onSave callback:', error);
      Alert.alert('Error', 'Failed to save milestone. Please try again.');
      return; // Don't close modal if save failed
    }
    
    // Close modal AFTER successful save
    onClose();

    // Show success message after a brief delay
    setTimeout(() => {
      Alert.alert(
        '✅ Saved!',
        `${title} updated to ${Math.round(progress)}%\n\nChanges are automatically saved.`,
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
      onRequestClose={onClose}
    >
      <View style={[styles.container, !darkMode && { backgroundColor: ThemeColors.bg }]}>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.backButtonWrapper}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    onClose();
                  }}
                  style={[styles.backButton, !darkMode && { backgroundColor: ThemeColors.bg }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : ThemeColors.text} />
                </TouchableOpacity>
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
            style={styles.form} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formContent}
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
              <Text style={[styles.label, !darkMode && { color: ThemeColors.text }]}>Progress %</Text>
              <View style={styles.progressSlider}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      width: 80,
                      textAlign: 'center',
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
                  value={progressPct}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, '');
                    setProgressPct(num);
                    // Automatically calculate payment amount when typing percentage
                    const percentage = parseFloat(num) || 0;
                    const calculatedAmount = Math.round((percentage / 100) * projectBudget);
                    console.log(`💰 Typed ${percentage}% = $${calculatedAmount} (${percentage}% of $${projectBudget})`);
                    setPaymentAmount(String(calculatedAmount));
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
                  {(() => {
                    // Always use standard percentages regardless of payment milestones
                    const percentages = [0, 25, 50, 75, 100];
                    
                    console.log(`📊 Using standard percentages:`, percentages);
                    console.log(`📊 Project budget: $${projectBudget}`);
                    console.log(`📊 Payment milestones data:`, paymentMilestones);
                    
                    return percentages.map(val => (
                      <TouchableOpacity
                        key={val}
                        onPress={() => {
                          setProgressPct(String(val));
                          // Calculate payment amount based on percentage of total project budget
                          const calculatedAmount = Math.round((val / 100) * projectBudget);
                          console.log(`💰 Setting ${val}% progress = $${calculatedAmount} (${val}% of $${projectBudget})`);
                          setPaymentAmount(String(calculatedAmount));
                        }}
                        style={[
                          styles.quickPctButton,
                          {
                            backgroundColor: parseInt(progressPct) === val ? "rgba(34, 197, 94, 0.2)" : ThemeColors.surface2,
                            borderColor: parseInt(progressPct) === val ? "#22c55e" : ThemeColors.line,
                            borderWidth: parseInt(progressPct) === val ? 2 : 1,
                            borderRadius: 12,
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickPctText,
                            !darkMode && { color: ThemeColors.sub },
                            parseInt(progressPct) === val && styles.quickPctTextActive,
                          ]}
                        >
                          {val}%
                        </Text>
                      </TouchableOpacity>
                    ));
                  })()}
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, !darkMode && { color: ThemeColors.text }]}>Payment Amount</Text>
              <View style={[
                styles.amountInputContainer,
                {
                  backgroundColor: ThemeColors.surface2,
                  borderColor: ThemeColors.line,
                  borderWidth: 1,
                  borderRadius: 12,
                }
              ]}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.amountInput,
                    {
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                      color: ThemeColors.text,
                      fontSize: 14,
                    }
                  ]}
                  value={paymentAmount}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9.]/g, '');
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
                      // Auto-adjust progress when status is manually changed
                      if (s.value === 'completed') {
                        setProgressPct('100');
                        const calculatedAmount = Math.round(projectBudget);
                        setPaymentAmount(String(calculatedAmount));
                        console.log(`✅ Set to completed - progress=100%, amount=$${calculatedAmount}`);
                      } else if (s.value === 'in_progress' && parseInt(progressPct) === 0) {
                        setProgressPct('50');
                        const calculatedAmount = Math.round(0.5 * projectBudget);
                        setPaymentAmount(String(calculatedAmount));
                        console.log(`🔄 Set to in progress - progress=50%, amount=$${calculatedAmount}`);
                      } else if (s.value === 'pending') {
                        console.log(`⏸️ Set to pending - keeping current progress=${progressPct}%`);
                      }
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
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
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
                <Text style={styles.saveButtonText}>✓ Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 150,
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
  progressSlider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickPctButton: {
    flex: 1,
    // backgroundColor, borderColor, borderWidth, borderRadius are set dynamically
    paddingVertical: 10,
    alignItems: "center",
  },
  quickPctButtonActive: {
    // Styling handled dynamically
  },
  quickPctText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
  },
  quickPctTextActive: {
    color: "#22c55e",
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