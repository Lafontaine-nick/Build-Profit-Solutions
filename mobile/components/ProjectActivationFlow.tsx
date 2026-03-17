import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import * as Haptics from 'expo-haptics';
import GreyCalendar from './GreyCalendar';
import { useProjectData } from '../contexts/ProjectDataContext';

interface ProjectActivationFlowProps {
  visible: boolean;
  onComplete: (completedSteps?: { timeline?: boolean; paymentSchedule?: boolean; team?: boolean }) => void;
  onStepComplete?: (completedSteps: { timeline?: boolean; paymentSchedule?: boolean; team?: boolean }) => void;
  onSkip: () => void;
  initialStep?: number;
  project: {
    id: string;
    title: string;
    startDate?: string;
    endDate?: string;
    estimateData?: {
      projectStartDate?: string;
      projectEndDate?: string;
      weeklyPayments?: Array<{
        weekNumber?: number;
        amount?: number;
        scheduledDate?: string;
        description?: string;
      }>;
      paymentSchedule?: string;
    };
  };
}

export default function ProjectActivationFlow({
  visible,
  onComplete,
  onStepComplete,
  onSkip,
  initialStep = 1,
  project,
}: ProjectActivationFlowProps) {
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const { updateTeam, projectData: contextProjectData } = useProjectData();
  const [currentStep, setCurrentStep] = useState(initialStep);
  
  // Reset to initial step when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentStep(initialStep);
    }
  }, [visible, initialStep]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentSchedule, setPaymentSchedule] = useState<any[]>([]);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDateObj, setStartDateObj] = useState(new Date());
  const [endDateObj, setEndDateObj] = useState(new Date());
  const [showPMModal, setShowPMModal] = useState(false);
  const [showCrewModal, setShowCrewModal] = useState(false);
  const [assignedPM, setAssignedPM] = useState<string | null>(null);
  const [assignedCrew, setAssignedCrew] = useState<string[]>([]);
  const [crewInputValue, setCrewInputValue] = useState('');
  
  // Load team data from context when modal opens or data changes
  useEffect(() => {
    if (visible && contextProjectData) {
      setAssignedPM(contextProjectData.team?.pmName || null);
      // Load crew members from context
      const crewMembers = (contextProjectData.team as any)?.crewMembers || [];
      if (Array.isArray(crewMembers)) {
        setAssignedCrew(crewMembers);
        console.log('Loaded crew members from context:', crewMembers);
      }
    }
  }, [visible, contextProjectData?.team?.pmName, (contextProjectData?.team as any)?.crewMembers]);
  
  // Also update crew when context data changes (even if modal is open)
  useEffect(() => {
    if (contextProjectData) {
      const crewMembers = (contextProjectData.team as any)?.crewMembers || [];
      if (Array.isArray(crewMembers)) {
        setAssignedCrew(prevCrew => {
          // Only update if different to avoid unnecessary re-renders
          if (JSON.stringify(prevCrew) !== JSON.stringify(crewMembers)) {
            console.log('Updated crew members from context:', crewMembers);
            return crewMembers;
          }
          return prevCrew;
        });
      }
    }
  }, [(contextProjectData?.team as any)?.crewMembers]);

  useEffect(() => {
    console.log('Calendar state changed:', { showStartDatePicker, showEndDatePicker });
  }, [showStartDatePicker, showEndDatePicker]);

  useEffect(() => {
    if (visible && project) {
      // Initialize dates from estimate or project data
      const estimateStart = project.estimateData?.projectStartDate || project.startDate;
      const estimateEnd = project.estimateData?.projectEndDate || project.endDate;
      
      let startDateValue: Date;
      let endDateValue: Date;
      
      if (estimateStart) {
        startDateValue = new Date(estimateStart);
        setStartDate(estimateStart.split('T')[0]);
      } else {
        startDateValue = new Date();
        setStartDate(startDateValue.toISOString().split('T')[0]);
      }
      
      if (estimateEnd) {
        endDateValue = new Date(estimateEnd);
        setEndDate(estimateEnd.split('T')[0]);
      } else {
        endDateValue = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        setEndDate(endDateValue.toISOString().split('T')[0]);
      }
      
      setStartDateObj(startDateValue);
      setEndDateObj(endDateValue);

      // Load payment schedule from estimate (hybrid: paymentMilestones + weeklyPayments)
      const ed = project.estimateData || {};
      const paymentMs = ed.paymentMilestones || [];
      const weekly = ed.weeklyPayments || [];
      const hasBoth = paymentMs.length > 0 && weekly.length > 0;
      const isHybrid = (ed.paymentSchedule || project.estimateData?.paymentSchedule) === 'hybrid' || hasBoth;
      const startDateOnly = (ed.projectStartDate || project.startDate || '')?.toString().match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
      const addDays = (dateStr: string, days: number): string => {
        if (!dateStr) return '';
        try {
          const d = new Date(dateStr + 'T12:00:00');
          d.setDate(d.getDate() + days);
          return d.toISOString().split('T')[0];
        } catch { return dateStr; }
      };
      const fixDepositDate = (item: any, isDeposit: boolean): any => {
        if (!isDeposit || !startDateOnly) return item;
        const raw = item.scheduledDate || item.dueDate || '';
        const rawNorm = raw ? raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '' : '';
        if (!rawNorm || rawNorm === startDateOnly) {
          return { ...item, scheduledDate: addDays(startDateOnly, 7), dueDate: addDays(startDateOnly, 7) };
        }
        return item;
      };
      if (isHybrid && paymentMs.length > 0 && weekly.length > 0) {
        const fromPayment = paymentMs.map((m: any) => {
          const isDep = (m.type || '').toString().toLowerCase() === 'deposit' || /deposit/.test((m.name || m.title || '').toString().toLowerCase());
          return fixDepositDate({
            description: m.name || m.title || 'Deposit',
            scheduledDate: m.scheduledDate || m.dueDate,
            amount: m.paymentAmount ?? m.amount ?? 0,
            weekNumber: 0,
          }, isDep);
        });
        const fromWeekly = weekly.map((w: any) => {
          const isDep = w.weekNumber === 0 || /deposit/.test((w.description || '').toString().toLowerCase());
          return fixDepositDate({ ...w }, isDep);
        });
        const combined = [...fromPayment, ...fromWeekly].sort((a, b) => {
          const da = a.scheduledDate || a.dueDate || '';
          const db = b.scheduledDate || b.dueDate || '';
          return da.localeCompare(db);
        });
        setPaymentSchedule(combined);
      } else if (weekly.length > 0) {
        const fixed = weekly.map((w: any) => {
          const isDep = w.weekNumber === 0 || /deposit/.test((w.description || '').toString().toLowerCase());
          return fixDepositDate({ ...w }, isDep);
        });
        setPaymentSchedule(fixed);
      } else if (paymentMs.length > 0) {
        const fixed = paymentMs.map((m: any) => {
          const isDep = (m.type || '').toString().toLowerCase() === 'deposit' || /deposit/.test((m.name || m.title || '').toString().toLowerCase());
          return fixDepositDate({
            description: m.name || m.title || `Payment`,
            scheduledDate: m.scheduledDate || m.dueDate,
            amount: m.paymentAmount ?? m.amount ?? 0,
            weekNumber: 0,
          }, isDep);
        });
        setPaymentSchedule(fixed);
      }
    }
  }, [visible, project]);

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const calculateDuration = () => {
    try {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 0;
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 1) {
      onStepComplete?.({ timeline: true });
    }
    if (currentStep === 2) {
      onStepComplete?.({ paymentSchedule: true });
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 3) {
      onStepComplete?.({ team: true });
    }
    // Return which steps were completed
    const completedSteps = {
      timeline: currentStep >= 1,
      paymentSchedule: currentStep >= 2,
      team: currentStep >= 3,
    };
    onComplete(completedSteps);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip();
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="time-outline" size={28} color="#2DFFC4" />
        <Text style={[styles.stepTitle, { color: Colors.text }]}>Confirm project timeline</Text>
        <Text style={[styles.stepSubtitle, { color: Colors.sub }]}>
          Based on your estimate — editable anytime.
        </Text>
      </View>

      <View style={[styles.dateCard, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
        <View style={styles.dateRow}>
          <View style={styles.dateItem}>
            <Text style={[styles.dateLabel, { color: Colors.sub }]}>Start date</Text>
            <TouchableOpacity
              style={[styles.dateInput, { borderColor: Colors.line }]}
              onPress={() => {
                console.log('Start date pressed, setting showStartDatePicker to true');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowEndDatePicker(false); // Close end date picker if open
                setShowStartDatePicker(true);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="calendar-today" size={18} color="#2DFFC4" style={{ marginRight: 8 }} />
              <Text style={[styles.dateInputText, { color: Colors.text }]}>
                {startDate ? formatDate(startDate) : 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dateItem}>
            <Text style={[styles.dateLabel, { color: Colors.sub }]}>End date</Text>
            <TouchableOpacity
              style={[styles.dateInput, { borderColor: Colors.line }]}
              onPress={() => {
                console.log('End date pressed, setting showEndDatePicker to true');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowStartDatePicker(false); // Close start date picker if open
                setShowEndDatePicker(true);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="calendar-today" size={18} color="#2DFFC4" style={{ marginRight: 8 }} />
              <Text style={[styles.dateInputText, { color: Colors.text }]}>
                {endDate ? formatDate(endDate) : 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.durationRow, { borderTopColor: Colors.line }]}>
          <Text style={[styles.durationLabel, { color: Colors.sub }]}>Duration:</Text>
          <Text style={[styles.durationValue, { color: Colors.text }]}>
            {calculateDuration()} days
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
          <Text style={[styles.statusText, { color: Colors.text }]}>Early / On Track</Text>
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="calendar-outline" size={28} color="#2DFFC4" />
        <Text style={[styles.stepTitle, { color: Colors.text }]}>Review payment schedule</Text>
        <Text style={[styles.stepSubtitle, { color: Colors.sub }]}>
          From your estimate — confirm or adjust as needed.
        </Text>
      </View>

      {paymentSchedule.length > 0 ? (
        <ScrollView style={styles.paymentList}>
          {paymentSchedule.map((payment, index) => (
            <View
              key={index}
              style={[styles.paymentCard, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
            >
              <View style={styles.paymentRow}>
                <View style={styles.paymentLeft}>
                  <Text style={[styles.paymentLabel, { color: Colors.sub }]}>
                    {payment.description || `Week ${payment.weekNumber || index + 1}`}
                  </Text>
                  <Text style={[styles.paymentDate, { color: Colors.sub }]}>
                    {payment.scheduledDate ? formatDate(payment.scheduledDate) : 'Date TBD'}
                  </Text>
                </View>
                <View style={styles.paymentRight}>
                  <Text style={[styles.paymentAmount, { color: Colors.text }]}>
                    ${(payment.amount || 0).toLocaleString()}
                  </Text>
                  <View style={[styles.paymentStatus, { backgroundColor: 'rgba(148, 163, 184, 0.2)' }]}>
                    <Text style={[styles.paymentStatusText, { color: Colors.sub }]}>Pending</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.emptyPaymentCard, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
          <Ionicons name="calendar-outline" size={32} color={Colors.sub} />
          <Text style={[styles.emptyPaymentText, { color: Colors.sub }]}>
            No payment schedule set yet
          </Text>
          <Text style={[styles.emptyPaymentSubtext, { color: Colors.sub }]}>
            You can add payment milestones in the Timeline tab
          </Text>
        </View>
      )}

      <View style={styles.stepActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            // Could navigate to timeline/payment editor
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={styles.editButtonText}>Edit schedule</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="people-outline" size={28} color="#2DFFC4" />
        <Text style={[styles.stepTitle, { color: Colors.text }]}>Assign responsibility</Text>
        <Text style={[styles.stepSubtitle, { color: Colors.sub }]}>
          Optional — assign now or later.
        </Text>
      </View>

      <View style={[styles.teamCard, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
        <View style={styles.teamRow}>
          <View style={styles.teamItem}>
            <Ionicons name="person-outline" size={20} color={Colors.sub} />
            <Text style={[styles.teamLabel, { color: Colors.sub }]}>PM:</Text>
            <Text style={[styles.teamValue, { color: Colors.text }]}>
              {assignedPM || 'Not assigned'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.assignButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPMModal(true);
            }}
          >
            <Text style={styles.assignButtonText}>Assign</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.teamRow, { borderTopColor: Colors.line }]}>
          <View style={styles.teamItem}>
            <Ionicons name="people-outline" size={20} color={Colors.sub} />
            <Text style={[styles.teamLabel, { color: Colors.sub }]}>Crew:</Text>
            <Text style={[styles.teamValue, { color: Colors.text }]}>
              {assignedCrew.length > 0 
                ? assignedCrew.length === 1 
                  ? assignedCrew[0] 
                  : `${assignedCrew.length} assigned`
                : 'Not assigned'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.assignButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCrewModal(true);
            }}
          >
            <Text style={styles.assignButtonText}>Assign</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: darkMode ? '#0A0E1A' : '#FFFFFF' }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: Colors.line }]}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(currentStep / 3) * 100}%` }]} />
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleSkip}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Step Content */}
          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: Colors.line, backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.2)' : 'transparent' }]}>
            {currentStep < 3 ? (
              <>
                <TouchableOpacity
                  style={[styles.skipButton, { borderColor: Colors.line }]}
                  onPress={handleSkip}
                >
                  <Text style={[styles.skipButtonText, { color: Colors.sub }]}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleNext}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#2DFFC4', '#00A6FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextButtonGradient}
                  >
                    <Text style={styles.nextButtonText}>Next</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.skipButton, { borderColor: Colors.line }]}
                  onPress={handleSkip}
                >
                  <Text style={[styles.skipButtonText, { color: Colors.sub }]}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={handleComplete}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#2DFFC4', '#00A6FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.completeButtonGradient}
                  >
                    <Text style={styles.completeButtonText}>Looks good</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        
        {/* Calendar Overlay */}
        {(showStartDatePicker || showEndDatePicker) && (
          <View style={styles.calendarOverlay}>
            <TouchableOpacity
              style={styles.calendarBackdrop}
              activeOpacity={1}
              onPress={() => {
                setShowStartDatePicker(false);
                setShowEndDatePicker(false);
              }}
            />
            <View style={styles.calendarModalContent}>
              <View style={styles.calendarModalHeader}>
                <Text style={[styles.calendarModalTitle, { color: Colors.text }]}>
                  {showStartDatePicker ? 'Select Start Date' : 'Select End Date'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowStartDatePicker(false);
                    setShowEndDatePicker(false);
                  }}
                  style={styles.calendarCloseButton}
                >
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.calendarWrapper}>
                <GreyCalendar
                  onDayPress={(day) => {
                    const selectedDate = new Date(day.dateString + 'T00:00:00');
                    if (showStartDatePicker) {
                      setStartDateObj(selectedDate);
                      setStartDate(day.dateString);
                      setShowStartDatePicker(false);
                      // Ensure end date is after start date
                      if (endDateObj < selectedDate) {
                        const newEndDate = new Date(selectedDate);
                        newEndDate.setDate(newEndDate.getDate() + 90); // Default 90 days
                        setEndDateObj(newEndDate);
                        setEndDate(newEndDate.toISOString().split('T')[0]);
                      }
                    } else if (showEndDatePicker) {
                      // Ensure end date is after start date
                      if (selectedDate >= startDateObj) {
                        setEndDateObj(selectedDate);
                        setEndDate(day.dateString);
                        setShowEndDatePicker(false);
                      } else {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        return;
                      }
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  markedDates={{
                    [showStartDatePicker ? startDate : endDate]: {
                      selected: true,
                      selectedColor: '#22c55e',
                      selectedTextColor: '#000000',
                    }
                  }}
                  initialDate={showStartDatePicker ? startDate : endDate}
                />
              </View>
            </View>
          </View>
        )}

        {/* PM Assignment Modal */}
        <Modal
          visible={showPMModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPMModal(false)}
        >
          <View style={styles.assignmentModalOverlay}>
            <TouchableOpacity
              style={styles.assignmentModalBackdrop}
              activeOpacity={1}
              onPress={() => setShowPMModal(false)}
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? -100 : -50}
            >
              <View style={styles.assignmentModalContent}>
              <View style={styles.assignmentModalHeader}>
                <Text style={[styles.assignmentModalTitle, { color: Colors.text }]}>Assign Project Manager</Text>
                <TouchableOpacity
                  onPress={() => setShowPMModal(false)}
                  style={styles.assignmentCloseButton}
                >
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.assignmentModalBody}>
                <TextInput
                  style={[styles.assignmentInput, { backgroundColor: Colors.surface2, borderColor: Colors.line, color: Colors.text }]}
                  placeholder="Enter PM name"
                  placeholderTextColor={Colors.sub}
                  value={assignedPM || ''}
                  onChangeText={setAssignedPM}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.assignmentSaveButton}
                  onPress={() => {
                    if (assignedPM && assignedPM.trim()) {
                      // Save PM to project data, preserving existing crew members
                      const existingCrew = (contextProjectData?.team as any)?.crewMembers || assignedCrew;
                      updateTeam(
                        true, 
                        assignedPM.trim(), 
                        existingCrew.length || contextProjectData?.crewCount,
                        existingCrew
                      );
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowPMModal(false);
                    }
                  }}
                >
                  <LinearGradient
                    colors={['#2DFFC4', '#00A6FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.assignmentSaveButtonGradient}
                  >
                    <Text style={styles.assignmentSaveButtonText}>Save</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Crew Assignment Modal */}
        <Modal
          visible={showCrewModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCrewModal(false)}
        >
          <View style={styles.assignmentModalOverlay}>
            <TouchableOpacity
              style={styles.assignmentModalBackdrop}
              activeOpacity={1}
              onPress={() => setShowCrewModal(false)}
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? -100 : -50}
            >
              <View style={styles.assignmentModalContent}>
              <View style={styles.assignmentModalHeader}>
                <Text style={[styles.assignmentModalTitle, { color: Colors.text }]}>Assign Crew Members</Text>
                <TouchableOpacity
                  onPress={() => setShowCrewModal(false)}
                  style={styles.assignmentCloseButton}
                >
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.assignmentModalBody}>
                <TextInput
                  style={[styles.assignmentInput, { backgroundColor: Colors.surface2, borderColor: Colors.line, color: Colors.text }]}
                  placeholder="Enter crew member name"
                  placeholderTextColor={Colors.sub}
                  value={crewInputValue}
                  onChangeText={setCrewInputValue}
                  onSubmitEditing={(e) => {
                    const name = e.nativeEvent.text.trim();
                    if (name && !assignedCrew.includes(name)) {
                      const newCrew = [...assignedCrew, name];
                      setAssignedCrew(newCrew);
                      setCrewInputValue(''); // Clear input
                      // Save immediately to project data
                      updateTeam(
                        contextProjectData?.team?.pmAssigned || false,
                        contextProjectData?.team?.pmName,
                        newCrew.length,
                        newCrew
                      );
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                />
                {assignedCrew.length > 0 && (
                  <View style={styles.crewList}>
                    {assignedCrew.map((member, index) => (
                      <View key={index} style={[styles.crewMemberTag, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                        <Text style={[styles.crewMemberText, { color: Colors.text }]}>{member}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const newCrew = assignedCrew.filter((_, i) => i !== index);
                            setAssignedCrew(newCrew);
                            // Save immediately when crew member is removed
                            updateTeam(
                              contextProjectData?.team?.pmAssigned || false,
                              contextProjectData?.team?.pmName,
                              newCrew.length,
                              newCrew
                            );
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color={Colors.sub} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.assignmentSaveButton}
                  onPress={() => {
                    // If there's text in the input, add it before closing
                    let finalCrew = assignedCrew;
                    if (crewInputValue.trim() && !assignedCrew.includes(crewInputValue.trim())) {
                      finalCrew = [...assignedCrew, crewInputValue.trim()];
                      setAssignedCrew(finalCrew);
                      setCrewInputValue('');
                    }
                    
                    // Save crew to project data
                    console.log('Saving crew members:', finalCrew);
                    updateTeam(
                      contextProjectData?.team?.pmAssigned || false,
                      contextProjectData?.team?.pmName,
                      finalCrew.length,
                      finalCrew
                    );
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    // Small delay to ensure save completes
                    setTimeout(() => {
                      setShowCrewModal(false);
                    }, 100);
                  }}
                >
                  <LinearGradient
                    colors={['#2DFFC4', '#00A6FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.assignmentSaveButtonGradient}
                  >
                    <Text style={styles.assignmentSaveButtonText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 500,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    height: '85%',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.2)',
  },
  modalHeader: {
    padding: 24,
    paddingBottom: 16,
    paddingTop: 24,
    borderBottomWidth: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2DFFC4',
    borderRadius: 2,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  stepContainer: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  dateCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    minHeight: 48,
  },
  dateInputText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  durationLabel: {
    fontSize: 14,
    marginRight: 10,
    fontWeight: '500',
  },
  durationValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    marginTop: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepActions: {
    marginTop: 8,
  },
  editButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(45, 255, 196, 0.08)',
    borderColor: 'rgba(45, 255, 196, 0.3)',
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2DFFC4',
  },
  paymentList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  paymentCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 12,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  paymentStatus: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyPaymentCard: {
    borderRadius: 20,
    padding: 40,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
    borderStyle: 'dashed',
  },
  emptyPaymentText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyPaymentSubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  teamCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamLabel: {
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
  },
  teamValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  assignButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'rgba(45, 255, 196, 0.08)',
    borderColor: 'rgba(45, 255, 196, 0.3)',
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2DFFC4',
  },
  footer: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    gap: 14,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  nextButton: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2DFFC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  completeButton: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2DFFC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completeButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  calendarOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  calendarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  calendarModalContent: {
    width: '95%',
    maxWidth: 420,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 1000,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  calendarCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarWrapper: {
    width: '100%',
  },
  assignmentModalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
  },
  assignmentModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  assignmentModalContent: {
    width: '95%',
    maxWidth: 500,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 1000,
  },
  assignmentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  assignmentModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  assignmentCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentModalBody: {
    gap: 16,
  },
  assignmentInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  assignmentSaveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  assignmentSaveButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignmentSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  crewList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  crewMemberTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  crewMemberText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
