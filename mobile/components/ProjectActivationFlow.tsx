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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import * as Haptics from 'expo-haptics';

interface ProjectActivationFlowProps {
  visible: boolean;
  onComplete: (completedSteps?: { timeline?: boolean; paymentSchedule?: boolean; team?: boolean }) => void;
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
  onSkip,
  initialStep = 1,
  project,
}: ProjectActivationFlowProps) {
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
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

  useEffect(() => {
    if (visible && project) {
      // Initialize dates from estimate or project data
      const estimateStart = project.estimateData?.projectStartDate || project.startDate;
      const estimateEnd = project.estimateData?.projectEndDate || project.endDate;
      
      if (estimateStart) {
        setStartDate(estimateStart.split('T')[0]);
      } else {
        setStartDate(new Date().toISOString().split('T')[0]);
      }
      
      if (estimateEnd) {
        setEndDate(estimateEnd.split('T')[0]);
      } else {
        const defaultEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        setEndDate(defaultEnd.toISOString().split('T')[0]);
      }

      // Load payment schedule from estimate
      if (project.estimateData?.weeklyPayments && project.estimateData.weeklyPayments.length > 0) {
        setPaymentSchedule(project.estimateData.weeklyPayments);
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
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            <TextInput
              style={[styles.dateInput, { color: Colors.text, borderColor: Colors.line }]}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.sub}
            />
          </View>
          <View style={styles.dateItem}>
            <Text style={[styles.dateLabel, { color: Colors.sub }]}>End date</Text>
            <TextInput
              style={[styles.dateInput, { color: Colors.text, borderColor: Colors.line }]}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.sub}
            />
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

      <View style={styles.stepActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            // Could open date picker here
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={styles.editButtonText}>Edit dates</Text>
        </TouchableOpacity>
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
            <Text style={[styles.teamValue, { color: Colors.text }]}>Not assigned</Text>
          </View>
          <TouchableOpacity
            style={styles.assignButton}
            onPress={() => {
              // Could open team assignment modal
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.assignButtonText}>Assign</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.teamRow}>
          <View style={styles.teamItem}>
            <Ionicons name="people-outline" size={20} color={Colors.sub} />
            <Text style={[styles.teamLabel, { color: Colors.sub }]}>Crew:</Text>
            <Text style={[styles.teamValue, { color: Colors.text }]}>Not assigned</Text>
          </View>
          <TouchableOpacity
            style={styles.assignButton}
            onPress={() => {
              // Could open crew assignment modal
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          <View style={[styles.footer, { borderTopColor: Colors.line }]}>
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
    fontSize: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
});
