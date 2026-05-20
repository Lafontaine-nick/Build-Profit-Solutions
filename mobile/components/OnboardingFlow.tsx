import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions,
  type ViewStyle,
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

type RoleOption = 'gc' | 'subcontractor' | 'developer' | 'owner-builder' | 'other';
type HelpOption = 'estimates' | 'projects' | 'costs' | 'schedule' | 'profit' | 'all';

const ONBOARDING_PAGE_COUNT = 5;
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
  const [selectedRoles, setSelectedRoles] = useState<RoleOption[]>([]);
  const [selectedHelpOptions, setSelectedHelpOptions] = useState<HelpOption[]>([]);

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

  const { width: windowWidth } = useWindowDimensions();
  const webDesktop = Platform.OS === 'web' && windowWidth >= 640;
  /** Readable column width on desktop web — avoids a tiny island on large monitors */
  const webColumnMax = webDesktop ? Math.min(800, windowWidth - 64) : undefined;
  const webNavMax = webDesktop ? Math.min(800, windowWidth - 48) : undefined;
  const iconMd = webDesktop ? 24 : 20;
  const iconSm = webDesktop ? 22 : 20;

  const webTitleHero = webDesktop
    ? ({ fontSize: 38, lineHeight: 46, letterSpacing: 0.25 } as const)
    : undefined;
  const webTitle = webDesktop
    ? ({ fontSize: 32, lineHeight: 40, letterSpacing: 0.2 } as const)
    : undefined;
  const webTitleCompact = webDesktop
    ? ({ fontSize: 30, lineHeight: 38 } as const)
    : undefined;
  const webBody = webDesktop
    ? ({ fontSize: 18, lineHeight: 28 } as const)
    : undefined;
  const webBodyCompact = webDesktop
    ? ({ fontSize: 17, lineHeight: 26 } as const)
    : undefined;
  const webBullet = webDesktop
    ? ({ fontSize: 17, lineHeight: 24 } as const)
    : undefined;
  const webOptionText = webDesktop ? ({ fontSize: 17 } as const) : undefined;
  const webHelper = webDesktop ? ({ fontSize: 15, lineHeight: 22 } as const) : undefined;
  const webCallout = webDesktop ? ({ fontSize: 17, lineHeight: 24 } as const) : undefined;

  /** Desktop web: centered readable column (native / narrow web unchanged). */
  const webMainColumn: ViewStyle | undefined =
    webColumnMax != null
      ? {
          paddingHorizontal: 40,
          maxWidth: webColumnMax,
          alignSelf: 'center',
          width: '100%',
        }
      : undefined;

  const webInnerClamp: ViewStyle | undefined =
    webColumnMax != null
      ? {
          maxWidth: webColumnMax,
          alignSelf: 'center',
          width: '100%',
        }
      : undefined;

  const pageOuterStyle = webMainColumn
    ? [styles.pageContainer, webMainColumn]
    : styles.pageContainer;

  const pageOuterCompactStyle = webMainColumn
    ? [styles.pageContainer, styles.pageContainerCompact, webMainColumn]
    : [styles.pageContainer, styles.pageContainerCompact];

  const pageOuterFinalStyle = webMainColumn
    ? [styles.pageContainer, styles.pageContainerFinal, webMainColumn]
    : [styles.pageContainer, styles.pageContainerFinal];

  const pageOuterHeroStyle = webMainColumn
    ? [styles.pageContainer, styles.pageContainerHero, webMainColumn]
    : [styles.pageContainer, styles.pageContainerHero];

  const contentCenteredStyle = [styles.content, webInnerClamp];

  const contentCompactTopStyle = [styles.content, styles.contentCompactTop, webInnerClamp];

  const contentFinalStyle = [styles.content, styles.contentFinal, webInnerClamp];

  const skipButtonRight =
    webDesktop && webColumnMax != null
      ? Math.max(16, (windowWidth - webColumnMax) / 2 + 12)
      : undefined;

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
        return renderPage4();
      case 3:
        return renderCombinedProductPage();
      case 4:
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
    <View style={pageOuterHeroStyle}>
      <View
        style={[
          styles.content,
          styles.contentHero,
          webInnerClamp,
        ]}
      >
        <Text
          style={[
            styles.title,
            styles.titleHero,
            webTitleHero,
            { color: colors.text },
          ]}
        >
          Your AI Project Manager{'\n'}for Construction
        </Text>
        <Text
          style={[
            styles.body,
            styles.bodyHero,
            webBody,
            { color: colors.subtext },
          ]}
        >
          Build Profit Solutions helps contractors turn estimates into profitable, well-run projects.
        </Text>
        <View style={[styles.bulletList, styles.bulletListHero]}>
          <View style={styles.bulletItem}>
            <MaterialIcons name="check-circle" size={iconMd} color={colors.accent} />
            <Text style={[styles.bulletText, webBullet, { color: colors.text }]}>
              Estimate with confidence
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="check-circle" size={iconMd} color={colors.accent} />
            <Text style={[styles.bulletText, webBullet, { color: colors.text }]}>
              Manage jobs in real time
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="check-circle" size={iconMd} color={colors.accent} />
            <Text style={[styles.bulletText, webBullet, { color: colors.text }]}>
              Protect your margin from day one
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const toggleSelectedRole = (roleId: RoleOption) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const toggleHelpOption = (optionId: HelpOption) => {
    setSelectedHelpOptions((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    );
  };

  // PAGE 2 — Role Selection (multi-select)
  const renderPage2 = () => {
    const roles = [
      { id: 'gc' as RoleOption, label: 'General contractor' },
      { id: 'subcontractor' as RoleOption, label: 'Subcontractor' },
      { id: 'developer' as RoleOption, label: 'Developer' },
      { id: 'owner-builder' as RoleOption, label: 'Owner-Builder' },
      { id: 'other' as RoleOption, label: 'Other' },
    ];

    return (
      <View style={pageOuterStyle}>
        <View style={contentCenteredStyle}>
          <Text style={[styles.title, webTitle, { color: colors.text }]}>
            What best describes you?
          </Text>
          <Text style={[styles.helperText, styles.helperTextSubtle, webHelper, { marginBottom: 16 }]}>
            Select all that apply.
          </Text>
          <View style={styles.optionsContainer}>
            {roles.map((role) => {
              const isSelected = selectedRoles.includes(role.id);
              return (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.optionButton,
                  optionCardStyle(isSelected),
                  webDesktop && styles.optionButtonWeb,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleSelectedRole(role.id);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    webOptionText,
                    {
                      color: isSelected ? '#fff' : colors.text,
                      fontWeight: isSelected ? '600' : '400',
                    },
                  ]}
                >
                  {role.label}
                </Text>
                {isSelected && (
                  <MaterialIcons name="check" size={iconSm} color="#fff" />
                )}
              </TouchableOpacity>
            );
            })}
          </View>
        </View>
      </View>
    );
  };

  // PAGE 3 — Primary goals (estimates + project management)
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
      <View style={pageOuterStyle}>
        <View style={contentCenteredStyle}>
          <Text style={[styles.title, webTitle, { color: colors.text }]}>
            What do you want help with most?
          </Text>
          <Text style={[styles.helperText, styles.helperTextSubtle, webHelper, { marginBottom: 16 }]}>
            Select all that apply — we will tailor tips around estimates and running the job.
          </Text>
          <View style={styles.optionsContainer}>
            {helpOptions.map((option) => {
              const isSelected = selectedHelpOptions.includes(option.id);
              return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  optionCardStyle(isSelected),
                  webDesktop && styles.optionButtonWeb,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleHelpOption(option.id);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    webOptionText,
                    {
                      color: isSelected ? '#fff' : colors.text,
                      fontWeight: isSelected ? '600' : '400',
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <MaterialIcons name="check" size={iconSm} color="#fff" />
                )}
              </TouchableOpacity>
            );
            })}
          </View>
        </View>
      </View>
    );
  };

  const saveOnboardingAndOpenEstimate = async () => {
    try {
      const onboardingData = {
        role: selectedRoles[0] ?? null,
        roles: selectedRoles,
        help: selectedHelpOptions[0] ?? null,
        helpOptions: selectedHelpOptions,
        completedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        onboardingDataKeyForUser(userId),
        JSON.stringify(onboardingData)
      );
      await mergeOnboardingRoleIntoContractorProfile(selectedRoles);
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

  // PAGE 4 — Combined product flow (estimate → execution → margin → AI)
  const renderCombinedProductPage = () => {
    const flowBullets: { icon: 'account-balance-wallet' | 'engineering' | 'trending-up' | 'flag'; text: string }[] = [
      { icon: 'account-balance-wallet', text: 'Estimate becomes the live job budget' },
      { icon: 'engineering', text: 'Labor and materials become tracked costs' },
      { icon: 'trending-up', text: 'Profit becomes a live metric during the job' },
      { icon: 'flag', text: 'AI flags budget and scope risks early' },
    ];

    return (
      <View style={pageOuterCompactStyle}>
        <View style={contentCompactTopStyle}>
          <Text style={[styles.title, styles.titleCompact, webTitleCompact, { color: colors.text }]}>
            From estimate to live job control
          </Text>
          <Text
            style={[
              styles.body,
              styles.bodyCompact,
              webBodyCompact,
              { color: colors.subtext },
            ]}
          >
            Build Profit Solutions does not stop after the bid is sent.{'\n'}
            Your estimate becomes the foundation for running the job in real time.
          </Text>
          <View style={[styles.bulletList, styles.bulletListTight]}>
            {flowBullets.map((row) => (
              <View key={row.text} style={styles.bulletItem}>
                <MaterialIcons name={row.icon} size={iconMd} color={colors.accent} />
                <Text style={[styles.bulletText, webBullet, { color: colors.text }]}>{row.text}</Text>
              </View>
            ))}
          </View>
          <View
            style={[
              styles.calloutBox,
              webDesktop && styles.calloutBoxWeb,
              {
                backgroundColor: 'rgba(34,197,94,0.12)',
                borderColor: colors.accent,
              },
            ]}
          >
            <MaterialIcons name="insights" size={webDesktop ? 28 : 24} color={colors.accent} />
            <Text style={[styles.calloutText, webCallout, { color: colors.text }]}>
              Project Health Score shows how your job is performing at a glance.
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // PAGE 5 — Final action (single primary CTA)
  const renderFinalPage = () => (
    <View style={pageOuterFinalStyle}>
      <View style={contentFinalStyle}>
        <Text style={[styles.title, webTitle, { color: colors.text }]}>{"Let's get to work"}</Text>
        <Text style={[styles.body, styles.bodyFinal, webBody, { color: colors.subtext }]}>
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
              style={[styles.primaryButtonInner, webDesktop && styles.primaryButtonInnerWeb]}
              onPress={saveOnboardingAndOpenEstimate}
              activeOpacity={0.8}
            >
              <MaterialIcons name="description" size={iconMd} color="#fff" />
              <Text style={[styles.primaryButtonText, webDesktop && styles.primaryButtonTextWeb]}>
                Create First Estimate
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </View>
  );

  const canProceed = () => {
    if (currentPage === 1) return selectedRoles.length > 0;
    if (currentPage === 2) return selectedHelpOptions.length > 0;
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
        <View
          style={[
            styles.navigationContent,
            webNavMax != null && {
              maxWidth: webNavMax,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
        >
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
                style={[
                  styles.backButton,
                  { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1a1a1a' },
                  webDesktop && styles.backButtonWeb,
                ]}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={iconMd} color={colors.text} />
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
                  style={[styles.nextButtonInner, webDesktop && styles.nextButtonInnerWeb]}
                  onPress={handleNext}
                  disabled={!canProceed()}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.nextButtonText, webDesktop && styles.nextButtonTextWeb]}>Continue</Text>
                  <MaterialIcons name="arrow-forward" size={iconMd} color="#fff" />
                </TouchableOpacity>
              </LinearGradient>
            )}
          </View>
        </View>
      </View>

      {/* Skip button (only on first few pages) */}
      {currentPage < 3 && (
        <TouchableOpacity
          style={[
            styles.skipButton,
            skipButtonRight != null && { right: skipButtonRight, top: 16 },
          ]}
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
  optionButtonWeb: {
    paddingVertical: 18,
    paddingHorizontal: 22,
    minHeight: 56,
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
  calloutBoxWeb: {
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 14,
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
  primaryButtonInnerWeb: {
    paddingVertical: 20,
    paddingHorizontal: 28,
    minHeight: 56,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  primaryButtonTextWeb: {
    fontSize: 18,
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
  backButtonWeb: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 48,
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
  nextButtonInnerWeb: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 52,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  nextButtonTextWeb: {
    fontSize: 18,
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
