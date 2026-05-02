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
import { useUser } from '@clerk/clerk-react';
import { isClerkEnabled } from '../lib/isClerkEnabled';
import { clerkAuthService } from '../services/clerkAuth';
import { onboardingDataKeyForUser } from '../lib/onboardingStorage';
import {
  markWalkthroughCompleted,
  markWalkthroughSkipped,
} from '../lib/walkthroughStateService';
import { mergeOnboardingRoleIntoContractorProfile } from '../lib/onboardingRoleMapping';
import { clearUnifiedProjectsListCache } from '../lib/projectListCache';
import { useProjectList } from '../contexts/ProjectListContext';

interface OnboardingFlowProps {
  onComplete: () => void;
}

type RoleOption = 'gc' | 'subcontractor' | 'developer' | 'owner-builder';
type WorkSource = 'referrals' | 'repeat' | 'online' | 'subcontractor' | 'mix';
type HelpOption = 'estimates' | 'projects' | 'costs' | 'schedule' | 'profit' | 'all';

const ONBOARDING_PAGE_COUNT = 6;
const LAST_PAGE_INDEX = ONBOARDING_PAGE_COUNT - 1;

function OnboardingFlowCore({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const router = useRouter();
  const { refreshProjects } = useProjectList();

  const resyncProjectsFromServer = async () => {
    try {
      await clearUnifiedProjectsListCache();
      await refreshProjects();
    } catch (e) {
      if (__DEV__) {
        console.warn('OnboardingFlow: project list resync after onboarding failed', e);
      }
    }
  };
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [selectedWorkSource, setSelectedWorkSource] = useState<WorkSource | null>(null);
  const [selectedHelp, setSelectedHelp] = useState<HelpOption | null>(null);

  // Always use dark mode colors for onboarding
  const colors = {
    background: ['#000000', '#000000'] as const,
    card: '#1a1a1a',
    cardElevated: '#242424',
    text: '#f9fafb',
    subtext: '#FFFFFF',
    muted: '#E5E7EB',
    accent: '#22c55e',
    accentCyan: '#22d3ee',
    accentGradient: ['#22c55e', '#22d3ee'] as const,
    border: 'rgba(148,163,184,0.20)',
    borderLight: 'rgba(148,163,184,0.10)',
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentPage < LAST_PAGE_INDEX) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleSkip = async () => {
    try {
      await markWalkthroughSkipped(userId, 'appOnboarding');
      await resyncProjectsFromServer();
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
        return renderCombinedProductPage();
      case 5:
        return renderFinalPage();
      default:
        return null;
    }
  };

  const optionCardStyle = (selected: boolean) => ({
    backgroundColor: selected ? colors.accent : colors.card,
    borderColor: selected ? colors.accent : 'rgba(255,255,255,0.22)',
    borderWidth: selected ? 1.5 : 1,
    shadowOpacity: selected ? 0.12 : 0.18,
    shadowRadius: selected ? 4 : 6,
    elevation: selected ? 2 : 3,
  });

  // PAGE 1 — Product Positioning
  const renderPage1 = () => (
    <View style={[styles.pageContainer, styles.pageContainerHero]}>
      <View style={[styles.content, styles.contentHero]}>
        <Text style={[styles.title, styles.titleHero, { color: colors.text }]}>
          Your AI Project Manager{'\n'}for Construction
        </Text>
        <Text style={[styles.body, styles.bodyHero, { color: colors.subtext }]}>
          Build Profit Solutions helps contractors turn estimates into profitable, well-run projects.
        </Text>
        <View style={[styles.bulletList, styles.bulletListHero]}>
          <View style={styles.bulletItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Estimate with confidence
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Manage jobs in real time
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.text }]}>
              Protect your margin from day one
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  // PAGE 2 — Role Selection
  const renderPage2 = () => {
    const roles = [
      { id: 'gc' as RoleOption, label: 'General contractor' },
      { id: 'subcontractor' as RoleOption, label: 'Subcontractor' },
      { id: 'developer' as RoleOption, label: 'Developer' },
      { id: 'owner-builder' as RoleOption, label: 'Owner-Builder' },
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
                  optionCardStyle(selectedRole === role.id),
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
                  optionCardStyle(selectedWorkSource === source.id),
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
          <Text style={[styles.helperText, styles.helperTextSubtle]}>
            You can also connect with builders and contractors inside Build Profit Solutions.
          </Text>
        </View>
      </View>
    );
  };

  // PAGE 4 — Primary goal / personalization
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
            What do you want help with most?
          </Text>
          <View style={styles.optionsContainer}>
            {helpOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  optionCardStyle(selectedHelp === option.id),
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

  const saveOnboardingAndOpenEstimate = async () => {
    try {
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
      await mergeOnboardingRoleIntoContractorProfile(selectedRole);
      await markWalkthroughCompleted(userId, 'appOnboarding');
      await resyncProjectsFromServer();
      await AsyncStorage.setItem('bps.isFirstTimeEstimate', 'true');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.replace('/(tabs)/estimate-generator');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      router.replace('/(tabs)/estimate-generator');
    }
  };

  // PAGE 5 — Combined product flow (estimate → execution → margin → AI)
  const renderCombinedProductPage = () => {
    const flowBullets: { icon: 'account-balance-wallet' | 'engineering' | 'trending-up' | 'flag'; text: string }[] = [
      { icon: 'account-balance-wallet', text: 'Estimate becomes the live job budget' },
      { icon: 'engineering', text: 'Labor and materials become tracked costs' },
      { icon: 'trending-up', text: 'Profit becomes a live metric during the job' },
      { icon: 'flag', text: 'AI flags budget and scope risks early' },
    ];

    return (
      <View style={[styles.pageContainer, styles.pageContainerCompact]}>
        <View style={[styles.content, styles.contentCompactTop]}>
          <Text style={[styles.title, styles.titleCompact, { color: colors.text }]}>
            From estimate to live job control
          </Text>
          <Text style={[styles.body, styles.bodyCompact, { color: colors.subtext }]}>
            Build Profit Solutions does not stop after the bid is sent.{'\n'}
            Your estimate becomes the foundation for running the job in real time.
          </Text>
          <View style={[styles.bulletList, styles.bulletListTight]}>
            {flowBullets.map((row) => (
              <View key={row.text} style={styles.bulletItem}>
                <MaterialIcons name={row.icon} size={20} color={colors.accent} />
                <Text style={[styles.bulletText, { color: colors.text }]}>{row.text}</Text>
              </View>
            ))}
          </View>
          <View
            style={[
              styles.calloutBox,
              {
                backgroundColor: 'rgba(34,197,94,0.12)',
                borderColor: colors.accent,
              },
            ]}
          >
            <MaterialIcons name="insights" size={24} color={colors.accent} />
            <Text style={[styles.calloutText, { color: colors.text }]}>
              Project Health Score shows how your job is performing at a glance.
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // PAGE 6 — Final action (single primary CTA)
  const renderFinalPage = () => (
    <View style={[styles.pageContainer, styles.pageContainerFinal]}>
      <View style={[styles.content, styles.contentFinal]}>
        <Text style={[styles.title, { color: colors.text }]}>{"Let's get to work"}</Text>
        <Text style={[styles.body, styles.bodyFinal, { color: colors.subtext }]}>
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
              onPress={saveOnboardingAndOpenEstimate}
              activeOpacity={0.8}
            >
              <MaterialIcons name="description" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Create First Estimate</Text>
            </TouchableOpacity>
          </LinearGradient>
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
            {Array.from({ length: ONBOARDING_PAGE_COUNT }, (_, pageIndex) => (
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
            {currentPage < LAST_PAGE_INDEX && (
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
    paddingTop: 32,
    paddingBottom: 168,
  },
  pageContainerHero: {
    paddingTop: 28,
    justifyContent: 'center',
  },
  pageContainerCompact: {
    paddingTop: 24,
    justifyContent: 'flex-start',
  },
  pageContainerFinal: {
    paddingTop: 28,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  contentHero: {
    justifyContent: 'center',
    paddingVertical: 8,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  contentCompactTop: {
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  contentFinal: {
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
  titleHero: {
    marginBottom: 12,
  },
  titleCompact: {
    marginBottom: 12,
    fontSize: 26,
    lineHeight: 34,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
    fontWeight: '500',
  },
  bodyHero: {
    marginBottom: 20,
  },
  bodyCompact: {
    marginBottom: 18,
  },
  bodyFinal: {
    marginBottom: 24,
  },
  bulletList: {
    marginTop: 24,
    gap: 16,
  },
  bulletListHero: {
    marginTop: 16,
    gap: 12,
  },
  bulletListTight: {
    marginTop: 14,
    gap: 12,
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
  helperTextSubtle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
    color: 'rgba(229,231,235,0.55)',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 18,
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
