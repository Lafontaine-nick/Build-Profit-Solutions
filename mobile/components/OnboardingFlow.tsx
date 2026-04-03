import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { isClerkEnabled } from '../lib/isClerkEnabled';
import { clerkAuthService } from '../services/clerkAuth';
import {
  onboardingDataKeyForUser,
  setOnboardingCompleteForUser,
} from '../lib/onboardingStorage';

interface OnboardingFlowProps {
  onComplete: () => void;
}

type RoleOption = 'solo' | 'small-team' | 'gc' | 'subcontractor';
type WorkSource = 'referrals' | 'repeat' | 'online' | 'subcontractor' | 'mix';
type HelpOption = 'estimates' | 'projects' | 'costs' | 'schedule' | 'profit' | 'all';

function OnboardingFlowCore({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [selectedWorkSource, setSelectedWorkSource] = useState<WorkSource | null>(null);
  const [selectedHelp, setSelectedHelp] = useState<HelpOption | null>(null);

  // Always use dark mode colors for onboarding
  const colors = {
    background: ['#000000', '#000000'],
    card: '#1a1a1a',
    cardElevated: '#242424',
    text: '#f9fafb',
    subtext: '#FFFFFF',
    muted: '#E5E7EB',
    accent: '#22c55e',
    accentCyan: '#22d3ee',
    accentGradient: ['#22c55e', '#22d3ee'],
    border: 'rgba(148,163,184,0.20)',
    borderLight: 'rgba(148,163,184,0.10)',
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (currentPage < 8) {
      setCurrentPage(currentPage + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleComplete = async () => {
    try {
      // Save onboarding data
      const onboardingData = {
        role: selectedRole,
        workSource: selectedWorkSource,
        help: selectedHelp,
        completedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        onboardingDataKeyForUser(userId),
        JSON.stringify(onboardingData)
      );
      await setOnboardingCompleteForUser(userId);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onComplete();
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      onComplete();
    }
  };

  const handleSkip = async () => {
    try {
      await setOnboardingCompleteForUser(userId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onComplete();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      onComplete();
    }
  };

  const renderPage = (pageIndex: number) => {
    switch (pageIndex) {
      case 0:
        return renderPage1();
      case 1:
        return renderPage2();
      case 2:
        return renderPage3();
      case 3:
        return renderPage4();
      case 4:
        return renderPage5();
      case 5:
        return renderPage6();
      case 6:
        return renderPage7();
      case 7:
        return renderPage8();
      case 8:
        return renderPage9();
      default:
        return null;
    }
  };

  // PAGE 1 — Product Positioning
  const renderPage1 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Your AI Project Manager{'\n'}for Construction
        </Text>
        <Text style={[styles.body, { color: colors.subtext }]}>
          Build Profit Solutions helps contractors turn estimates into profitable, well-run projects.
        </Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Estimate with confidence.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Manage jobs in real time.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Protect your margin from day one.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  // PAGE 2 — Role Selection
  const renderPage2 = () => {
    const roles = [
      { id: 'solo' as RoleOption, label: 'Solo Contractor' },
      { id: 'small-team' as RoleOption, label: 'Small Team (2–10 people)' },
      { id: 'gc' as RoleOption, label: 'General Contractor / Developer' },
      { id: 'subcontractor' as RoleOption, label: 'Subcontractor' },
    ];

    return (
      <View style={styles.pageContainer}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            What best describes you?
          </Text>
          <View style={styles.optionsContainer}>
            {roles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: selectedRole === role.id ? colors.accent : '#1a1a1a',
                    borderColor: selectedRole === role.id ? colors.accent : 'rgba(255,255,255,0.15)',
                    borderWidth: selectedRole === role.id ? 1.5 : 1,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedRole(role.id);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: selectedRole === role.id ? '#fff' : colors.text,
                      fontWeight: selectedRole === role.id ? '600' : '400',
                    },
                  ]}
                >
                  {role.label}
                </Text>
                {selectedRole === role.id && (
                  <MaterialIcons name="check" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // PAGE 3 — Work Source
  const renderPage3 = () => {
    const workSources = [
      { id: 'referrals' as WorkSource, label: 'Referrals or word of mouth' },
      { id: 'repeat' as WorkSource, label: 'Repeat clients' },
      { id: 'online' as WorkSource, label: 'Online leads' },
      { id: 'subcontractor' as WorkSource, label: 'Subcontractor work' },
      { id: 'mix' as WorkSource, label: 'A mix of everything' },
    ];

    return (
      <View style={styles.pageContainer}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            How do you usually get work?
          </Text>
          <View style={styles.optionsContainer}>
            {workSources.map((source) => (
              <TouchableOpacity
                key={source.id}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: selectedWorkSource === source.id ? colors.accent : '#1a1a1a',
                    borderColor: selectedWorkSource === source.id ? colors.accent : 'rgba(255,255,255,0.15)',
                    borderWidth: selectedWorkSource === source.id ? 1.5 : 1,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedWorkSource(source.id);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: selectedWorkSource === source.id ? '#fff' : colors.text,
                      fontWeight: selectedWorkSource === source.id ? '600' : '400',
                    },
                  ]}
                >
                  {source.label}
                </Text>
                {selectedWorkSource === source.id && (
                  <MaterialIcons name="check" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.helperText, { color: colors.muted }]}>
            You can also connect with builders and contractors inside Build Profit Solutions.
          </Text>
        </View>
      </View>
    );
  };

  // PAGE 4 — What Happens After the Bid
  const renderPage4 = () => {
    const helpOptions = [
      { id: 'estimates' as HelpOption, label: 'Building accurate estimates' },
      { id: 'projects' as HelpOption, label: 'Turning estimates into live projects' },
      { id: 'costs' as HelpOption, label: 'Tracking costs and labor' },
      { id: 'schedule' as HelpOption, label: 'Staying on schedule' },
      { id: 'profit' as HelpOption, label: 'Protecting profit' },
      { id: 'all' as HelpOption, label: 'All of the above' },
    ];

    return (
      <View style={styles.pageContainer}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            What do you want help with after you win a job?
          </Text>
          <View style={styles.optionsContainer}>
            {helpOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: selectedHelp === option.id ? colors.accent : '#1a1a1a',
                    borderColor: selectedHelp === option.id ? colors.accent : 'rgba(255,255,255,0.15)',
                    borderWidth: selectedHelp === option.id ? 1.5 : 1,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedHelp(option.id);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: selectedHelp === option.id ? '#fff' : colors.text,
                      fontWeight: selectedHelp === option.id ? '600' : '400',
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {selectedHelp === option.id && (
                  <MaterialIcons name="check" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // PAGE 5 — Key Differentiator
  const renderPage5 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Most apps stop after the estimate
        </Text>
        <Text style={[styles.body, { color: colors.subtext }]}>
          In Build Profit Solutions, estimates don't disappear once a job is won.{'\n\n'}
          They become the blueprint for running the project.
        </Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <MaterialIcons name="arrow-forward" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              The estimate becomes the job budget
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="arrow-forward" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Labor hours become performance targets
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="arrow-forward" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Materials become tracked costs
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="arrow-forward" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Profit becomes a live metric
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  // PAGE 6 — Active Project Management Preview
  const renderPage6 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Run your jobs with clarity — not guesswork
        </Text>
        <Text style={[styles.body, { color: colors.subtext }]}>
          Track budgets, labor, materials, and payments while the job is in progress — not after it's too late.
        </Text>
        <View style={[styles.calloutBox, { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: colors.accent }]}>
          <MaterialIcons name="insights" size={24} color={colors.accent} />
          <Text style={[styles.calloutText, { color: colors.text }]}>
            Project Health Score shows how your job is performing at a glance.
          </Text>
        </View>
      </View>
    </View>
  );

  // PAGE 7 — AI Project Manager Mode
  const renderPage7 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Your AI Project Manager watches every job
        </Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <MaterialIcons name="flag" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Flags cost overruns early
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="warning" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Warns when labor is burning too fast
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="search" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Detects missing or risky scope
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="trending-up" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Predicts final profit before the job ends
            </Text>
          </View>
        </View>
        <Text style={[styles.helperText, { color: colors.muted, marginTop: 20 }]}>
          You stay in control. AI keeps watch.
        </Text>
      </View>
    </View>
  );

  // PAGE 8 — Estimates
  const renderPage8 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Every great project starts with a strong estimate
        </Text>
        <Text style={[styles.body, { color: colors.subtext }]}>
          Create clear, professional estimates you can actually execute.
        </Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <MaterialIcons name="lightbulb" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Smart labor and material logic
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="visibility" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Transparent assumptions
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="health-and-safety" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Health score before you send the bid
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  // PAGE 9 — Final Action
  const renderPage9 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Let's get to work
        </Text>
        <Text style={[styles.body, { color: colors.subtext }]}>
          Start by creating your first estimate.
        </Text>
        <View style={styles.finalActionsContainer}>
          <LinearGradient
            colors={colors.accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButton}
          >
            <TouchableOpacity
              style={styles.primaryButtonInner}
              onPress={async () => {
                try {
                  // Mark onboarding as complete
                  await setOnboardingCompleteForUser(userId);
                  // Set flag to indicate first-time user for smart defaults
                  await AsyncStorage.setItem('bps.isFirstTimeEstimate', 'true');
                  // Navigate to estimate generator
                  router.replace('/(tabs)/estimate-generator');
                } catch (error) {
                  console.error('Error navigating to estimate:', error);
                  router.replace('/(tabs)/estimate-generator');
                }
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons name="description" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Create an estimate</Text>
            </TouchableOpacity>
          </LinearGradient>
          <TouchableOpacity
            style={styles.tertiaryButton}
            onPress={handleComplete}
            activeOpacity={0.7}
          >
            <Text style={[styles.tertiaryButtonText, { color: colors.muted }]}>
              View a sample project
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const canProceed = () => {
    if (currentPage === 1) return selectedRole !== null;
    if (currentPage === 2) return selectedWorkSource !== null;
    if (currentPage === 3) return selectedHelp !== null;
    return true;
  };

  return (
    <LinearGradient colors={colors.background} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageWrapper}>
          {renderPage(currentPage)}
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={[styles.navigation, { backgroundColor: '#000000', borderTopColor: 'rgba(255,255,255,0.05)' }]}>
        <View style={styles.navigationContent}>
          {/* Progress dots */}
          <View style={styles.progressDots}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((pageIndex) => (
              <View
                key={pageIndex}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        pageIndex === currentPage ? colors.accent : 'rgba(255,255,255,0.15)',
                      width: pageIndex === currentPage ? 24 : 8,
                      opacity: pageIndex === currentPage ? 1 : 0.6,
                    },
                  ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {currentPage > 0 && (
              <TouchableOpacity
                style={[styles.backButton, { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1a1a1a' }]}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={20} color={colors.text} />
                <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            {currentPage < 8 && (
              <LinearGradient
                colors={canProceed() ? colors.accentGradient : [colors.border, colors.border]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.nextButton, { opacity: canProceed() ? 1 : 0.5 }]}
              >
                <TouchableOpacity
                  style={styles.nextButtonInner}
                  onPress={handleNext}
                  disabled={!canProceed()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nextButtonText}>Continue</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </LinearGradient>
            )}
            {currentPage === 8 && (
              <LinearGradient
                colors={colors.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButton}
              >
                <TouchableOpacity
                  style={styles.nextButtonInner}
                  onPress={handleComplete}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nextButtonText}>Get Started</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}
          </View>
        </View>
      </View>

      {/* Skip button (only on first few pages) */}
      {currentPage < 3 && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipButtonText, { color: colors.muted }]}>Skip</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

function OnboardingFlowWithClerk({ onComplete }: OnboardingFlowProps) {
  const { user } = useUser();
  const userId = user?.id;
  if (!userId) return null;
  return <OnboardingFlowCore userId={userId} onComplete={onComplete} />;
}

function OnboardingFlowWithoutClerk({ onComplete }: OnboardingFlowProps) {
  const [userId, setUserId] = useState<string | null>(
    () => clerkAuthService.getAuthState().user?.id ?? null
  );
  useEffect(() => {
    const unsub = clerkAuthService.addListener((s) => {
      setUserId(s.user?.id ?? null);
    });
    return unsub;
  }, []);
  if (!userId) return null;
  return <OnboardingFlowCore userId={userId} onComplete={onComplete} />;
}

export default function OnboardingFlow(props: OnboardingFlowProps) {
  return isClerkEnabled() ? (
    <OnboardingFlowWithClerk {...props} />
  ) : (
    <OnboardingFlowWithoutClerk {...props} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  pageWrapper: {
    flex: 1,
    width: '100%',
  },
  pageContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 200,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    lineHeight: 36,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
    fontWeight: '500',
  },
  bulletList: {
    marginTop: 24,
    gap: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bulletText: {
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },
  optionsContainer: {
    marginTop: 24,
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  calloutText: {
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },
  finalActionsContainer: {
    marginTop: 32,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  tertiaryButton: {
    padding: 12,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    fontSize: 15,
  },
  navigation: {
    borderTopWidth: 1,
    paddingBottom: 20,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  navigationContent: {
    paddingHorizontal: 24,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  skipButton: {
    position: 'absolute',
    top: 8,
    right: 16,
    padding: 10,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
