import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, SafeAreaView, StatusBar, KeyboardAvoidingView, Keyboard } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BRAND_FRAME_GRADIENT_COLORS, BRAND_FRAME_GRADIENT_END, BRAND_FRAME_GRADIENT_START } from "@/constants/brandFrameGradient";
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, COLORS } from "../src/theme/colors";
import type { Milestone, MilestoneStatus, MilestoneCostCategory } from "../src/types/timeline";
import GreyCalendar from "./GreyCalendar";
import GradientRingBackInner from "./GradientRingBackInner";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { FORM_KEYBOARD_SCROLL_PROPS } from "@/constants/keyboardScrollProps";
import { nativeNumericKeyboardProps, resolveTextInputKeyboardProps } from "@/constants/inputKeyboardPresets";
import { estimateFlowCardStyle, ESTIMATE_FLOW_CARD_GAP } from "@/utils/estimateFlowCardStyle";

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
  const isWeb = Platform.OS === "web";
  const headerRule = darkMode ? "rgba(148, 163, 184, 0.1)" : ThemeColors.line;

  const [title, setTitle] = useState("");
  const [plannedDate, setPlannedDate] = useState(new Date());
  const [status, setStatus] = useState<MilestoneStatus>("pending");
  const [assignee, setAssignee] = useState("");
  const [costDelta, setCostDelta] = useState("");
  const [costCategory, setCostCategory] = useState<MilestoneCostCategory>("materials");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [actualDate, setActualDate] = useState<Date | null>(null);
  const [showActualDatePicker, setShowActualDatePicker] = useState(false);

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
      const adRaw = milestone.actualDate
        ? String(milestone.actualDate).match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
        : null;
      setActualDate(adRaw ? new Date(`${adRaw}T00:00:00`) : null);
      setShowDatePicker(false);
      setShowActualDatePicker(false);
    }
  }, [visible, milestone]);

  const handleSave = () => {
    if (!milestone) {
      console.error('❌ Cannot save: milestone is null');
      return;
    }
    
    const cost = parseFloat(costDelta) || undefined;
    const amount = parseFloat(paymentAmount) || undefined;
    const numericAmount =
      (typeof amount === 'number' && Number.isFinite(amount) ? amount : 0) ||
      (typeof milestone.amount === 'number' && Number.isFinite(milestone.amount) ? milestone.amount : 0) ||
      0;

    // Auto-set progress to 100% if completed, otherwise keep existing progress
    let finalProgress = milestone.progressPct || 0;
    if (status === 'completed') {
      finalProgress = 100;
    } else if (status === 'in_progress' && finalProgress === 0) {
      finalProgress = 50;
    }

    const actualDateIso = actualDate
      ? `${actualDate.getFullYear()}-${String(actualDate.getMonth() + 1).padStart(2, '0')}-${String(actualDate.getDate()).padStart(2, '0')}`
      : undefined;

    const updatedMilestone: Milestone & { collectedAt?: string } = {
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

    if (actualDateIso) {
      updatedMilestone.actualDate = actualDateIso;
    } else {
      delete updatedMilestone.actualDate;
    }

    if (status === 'completed' && numericAmount > 0) {
      if (actualDateIso) {
        updatedMilestone.collectedAt = new Date(`${actualDateIso}T12:00:00`).toISOString();
      } else {
        updatedMilestone.collectedAt =
          (milestone as Milestone & { collectedAt?: string }).collectedAt || new Date().toISOString();
      }
    } else {
      delete updatedMilestone.collectedAt;
    }

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

  const handleHeaderBack = () => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const milestoneHeader = (
    <View style={styles.headerRow}>
      <View style={styles.backButtonWrapper}>
        <LinearGradient
          colors={BRAND_FRAME_GRADIENT_COLORS}
          start={BRAND_FRAME_GRADIENT_START}
          end={BRAND_FRAME_GRADIENT_END}
          style={styles.backButtonBorder}
        >
          <GradientRingBackInner
            darkMode={darkMode}
            onPress={handleHeaderBack}
            style={[styles.backButton, !darkMode && { backgroundColor: ThemeColors.bg }]}
          >
            <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : ThemeColors.text} />
          </GradientRingBackInner>
        </LinearGradient>
      </View>
      <View style={styles.headerTitleRow}>
        <View
          style={[
            styles.headerAvatar,
            !darkMode && { backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line },
          ]}
        >
          <MaterialIcons name="event" size={24} color="#22c55e" />
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={[styles.title, !darkMode && { color: ThemeColors.text }]}>Edit Milestone</Text>
          <Text
            style={[styles.subtitle, !darkMode && { color: ThemeColors.sub }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {milestone.title}
          </Text>
        </View>
      </View>
    </View>
  );

  const milestoneFormFields = (
            <>
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
                onSubmitEditing={() => Keyboard.dismiss()}
                {...resolveTextInputKeyboardProps()}
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
                    const num = text.replace(/[^0-9.]/g, '').replace(/,/g, '');
                    setPaymentAmount(num);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={darkMode ? Colors.subtext : ThemeColors.sub}
                  {...nativeNumericKeyboardProps}
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
                onPress={() => {
                  setShowActualDatePicker(false);
                  setShowDatePicker(!showDatePicker);
                }}
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
              <Text style={[styles.label, !darkMode && { color: ThemeColors.text }]}>Actual Date (Optional)</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDatePicker(false);
                  setShowActualDatePicker(!showActualDatePicker);
                }}
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
                <Text
                  style={[
                    styles.dateButtonText,
                    !darkMode && { color: ThemeColors.text },
                    actualDate && { color: '#22c55e', fontWeight: '700' },
                  ]}
                >
                  {actualDate
                    ? `📅 ${actualDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'Tap to set — e.g. paid earlier than planned'}
                </Text>
              </TouchableOpacity>
              {actualDate ? (
                <TouchableOpacity
                  onPress={() => setActualDate(null)}
                  style={{ alignSelf: 'flex-start', marginTop: 8 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.hint, { color: '#22c55e', fontWeight: '600' }]}>Clear actual date</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.hint, !darkMode && { color: ThemeColors.sub }]}>
                  When you were actually paid (can be before the planned date).
                </Text>
              )}
              {showActualDatePicker && (
                <View style={styles.datePickerContainer}>
                  <GreyCalendar
                    onDayPress={(day) => {
                      const selectedDate = new Date(day.dateString + 'T00:00:00');
                      setActualDate(selectedDate);
                      setShowActualDatePicker(false);
                    }}
                    markedDates={{
                      ...(actualDate
                        ? {
                            [`${actualDate.getFullYear()}-${String(actualDate.getMonth() + 1).padStart(2, '0')}-${String(actualDate.getDate()).padStart(2, '0')}`]: {
                              selected: true,
                              selectedColor: '#22c55e',
                              selectedTextColor: '#000000',
                            },
                          }
                        : {}),
                    }}
                    initialDate={
                      actualDate
                        ? `${actualDate.getFullYear()}-${String(actualDate.getMonth() + 1).padStart(2, '0')}-${String(actualDate.getDate()).padStart(2, '0')}`
                        : `${plannedDate.getFullYear()}-${String(plannedDate.getMonth() + 1).padStart(2, '0')}-${String(plannedDate.getDate()).padStart(2, '0')}`
                    }
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
                onSubmitEditing={() => Keyboard.dismiss()}
                {...resolveTextInputKeyboardProps()}
              />
            </View>
            </>
  );

  const milestoneActionRow = (
          <View style={[
            isWeb ? styles.editMilestoneWebBottomActions : styles.actions,
            !darkMode && { backgroundColor: ThemeColors.bg, borderTopColor: ThemeColors.line },
            isWeb
              ? {
                  borderTopColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15, 23, 42, 0.12)",
                  paddingBottom: Platform.OS === "ios" ? 24 : 16,
                }
              : { paddingBottom: Math.max(insets.bottom, 20) + 30 },
          ]}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.cancelButtonFlat,
                darkMode
                  ? { backgroundColor: "#18181b", borderColor: "#3f3f46" }
                  : { backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line },
              ]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.cancelButtonTextFlat,
                  darkMode ? { color: "rgba(226, 232, 240, 0.92)" } : { color: ThemeColors.text },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS === "ios") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                handleSave();
              }}
              style={styles.saveButton}
              activeOpacity={0.9}
            >
              <View style={styles.saveButtonSolid}>
                <Text style={styles.saveButtonText}>{isWeb ? "✓ Save" : "Save"}</Text>
              </View>
            </TouchableOpacity>
          </View>
  );

  const card = (
    <View
      style={[
        styles.container,
        !darkMode && { backgroundColor: ThemeColors.bg },
        isWeb && styles.webPageRoot,
      ]}
    >
        {!isWeb ? <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} /> : null}
        <SafeAreaView style={[styles.safeArea, isWeb && { flex: 1, minHeight: 0 }]}>
          {isWeb ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.editMilestoneWebPageContent}
              showsVerticalScrollIndicator
              {...FORM_KEYBOARD_SCROLL_PROPS}
            >
              <View
                style={[
                  styles.editMilestoneWebHeaderRow,
                  {
                    borderBottomColor: headerRule,
                    paddingTop: 18,
                  },
                ]}
              >
                {milestoneHeader}
              </View>

              <WebMilestoneFormChrome
                isWeb={isWeb}
                innerBackground={darkMode ? "#050807" : ThemeColors.surface2}
                Colors={ThemeColors}
                darkMode={darkMode}
              >
                {milestoneFormFields}
              </WebMilestoneFormChrome>

              {milestoneActionRow}
            </ScrollView>
          ) : (
            <>
          {milestoneHeader}

          {/* Form */}
          <ScrollView
            style={[
              styles.form,
              { backgroundColor: darkMode ? '#000000' : ThemeColors.bg },
            ]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formContent}
            {...FORM_KEYBOARD_SCROLL_PROPS}
          >
            <WebMilestoneFormChrome isWeb={false} Colors={ThemeColors} darkMode={darkMode}>
              {milestoneFormFields}
            </WebMilestoneFormChrome>

          </ScrollView>

          {milestoneActionRow}
            </>
          )}
        </SafeAreaView>
      </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      {...(Platform.OS !== "web"
        ? { statusBarTranslucent: true as const }
        : {})}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[
          styles.keyboardAvoid,
          { flex: 1, backgroundColor: darkMode ? "#000000" : ThemeColors.bg },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
        keyboardVerticalOffset={Platform.OS === "ios" ? -120 : 0}
      >
        {card}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  webPageRoot: {
    flex: 1,
    width: "100%",
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
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
  backButtonWrapper: {
    flexShrink: 0,
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
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.35,
    lineHeight: 30,
  },
  subtitle: {
    color: "#8DA0B8",
    fontSize: 13,
    marginTop: 5,
    fontWeight: "500",
    letterSpacing: 0.12,
    lineHeight: 18,
  },
  form: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  editMilestoneWebPageContent: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 32,
  },
  editMilestoneWebHeaderRow: {
    marginBottom: 24,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editMilestoneWebBottomActions: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    backgroundColor: "#000000",
  },
  /** Web: 1px brand gradient frame around form (matches Edit Team Member / materials). */
  editMilestoneWebFormCardGradient: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    borderRadius: 24,
    padding: 1,
    overflow: "hidden",
    marginBottom: 4,
  },
  editMilestoneWebFormCardInner: {
    width: "100%",
    borderRadius: 23,
    padding: 28,
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
    paddingHorizontal: 12,
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
  cancelButtonFlat: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonTextFlat: {
    fontSize: 16,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  saveButtonSolid: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#22c55e",
    borderRadius: 16,
    shadowColor: "#22c55e",
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

function WebMilestoneFormChrome({
  isWeb,
  innerBackground,
  children,
  Colors,
  darkMode,
}: {
  isWeb: boolean;
  innerBackground?: string;
  children: React.ReactNode;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  if (isWeb) {
    return (
      <LinearGradient
        colors={BRAND_FRAME_GRADIENT_COLORS}
        start={BRAND_FRAME_GRADIENT_START}
        end={BRAND_FRAME_GRADIENT_END}
        style={styles.editMilestoneWebFormCardGradient}
      >
        <View style={[styles.editMilestoneWebFormCardInner, { backgroundColor: innerBackground ?? "#050807" }]}>
          {children}
        </View>
      </LinearGradient>
    );
  }
  return (
    <View style={estimateFlowCardStyle(Colors, darkMode, { marginBottom: ESTIMATE_FLOW_CARD_GAP })}>
      {children}
    </View>
  );
}