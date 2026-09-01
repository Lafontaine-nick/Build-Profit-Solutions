import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions,
  Image,
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
import { onboardingDataKeyForUser, setPendingOpenBuildWithAi } from '../lib/onboardingStorage';
import {
  AI_FLOW_CARD_BG_DARK,
  ESTIMATE_FLOW_CHIP_GREEN,
  ESTIMATE_FLOW_CHIP_GREEN_BG,
  confirmScopeSectionLabelStyle,
  estimateFlowPrimaryButtonStyle,
  estimateFlowPrimaryButtonTextStyle,
} from '../utils/estimateFlowCardStyle';
import { BRAND_FRAME_GRADIENT_COLORS } from '../constants/brandFrameGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  markWalkthroughCompleted,
  markWalkthroughSkipped,
} from '../lib/walkthroughStateService';
import { mergeOnboardingRoleIntoContractorProfile } from '../lib/onboardingRoleMapping';
import { clearUnifiedProjectsListCache } from '../lib/projectListCache';
import { useProjectList } from '../contexts/ProjectListContext';
import { applyWorkspaceMemberFirstRunIfNeeded } from '../lib/workspaceMemberOnboarding';

interface OnboardingFlowProps {
  onComplete: () => void;
}

type RoleOption = 'gc' | 'subcontractor' | 'developer' | 'owner-builder' | 'other';
type HelpOption = 'estimates' | 'projects' | 'costs' | 'schedule' | 'profit';

const ONBOARDING_PAGE_COUNT = 4;
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
  const insets = useSafeAreaInsets();

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

  // Always use dark mode colors for onboarding (aligned with Estimates / Build with AI)
  const colors = {
    background: ['#000000', '#000000'] as const,
    card: AI_FLOW_CARD_BG_DARK,
    cardElevated: '#242424',
    text: '#f9fafb',
    subtext: 'rgba(255,255,255,0.82)',
    muted: 'rgba(229,231,235,0.55)',
    accent: ESTIMATE_FLOW_CHIP_GREEN,
    accentCyan: ESTIMATE_FLOW_CHIP_GREEN,
    accentGradient: BRAND_FRAME_GRADIENT_COLORS,
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
  const webBody = webDesktop
    ? ({ fontSize: 18, lineHeight: 28 } as const)
    : undefined;
  const webBullet = webDesktop
    ? ({ fontSize: 17, lineHeight: 24 } as const)
    : undefined;
  const webOptionText = webDesktop ? ({ fontSize: 17 } as const) : undefined;
  const webHelper = webDesktop ? ({ fontSize: 15, lineHeight: 22 } as const) : undefined;

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

  const pageOuterFinalStyle = webMainColumn
    ? [styles.pageContainer, styles.pageContainerFinal, webMainColumn]
    : [styles.pageContainer, styles.pageContainerFinal];

  const pageOuterHeroStyle = webMainColumn
    ? [styles.pageContainer, styles.pageContainerHero, styles.pageWithSkipClearance, webMainColumn]
    : [styles.pageContainer, styles.pageContainerHero, styles.pageWithSkipClearance];

  const contentQuestionStyle = [styles.content, styles.contentQuestion, webInnerClamp];

  const skipTop = Math.max(insets.top, Platform.OS === 'web' ? 12 : 8) + 4;

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
        return renderGoalsPage();
      case 3:
        return renderFinalPage();
      default:
        return null;
    }
  };

  const renderStepEyebrow = (stepIndex: number, label?: string) => (
    <Text
      style={[
        confirmScopeSectionLabelStyle(),
        stepIndex === 0 ? styles.stepEyebrowCenter : styles.stepEyebrow,
        { color: colors.text },
      ]}
    >
      {label ?? `Step ${stepIndex + 1} of ${ONBOARDING_PAGE_COUNT}`}
    </Text>
  );

  const optionCardStyle = (selected: boolean) => ({
    backgroundColor: selected ? ESTIMATE_FLOW_CHIP_GREEN_BG : colors.card,
    borderColor: selected ? ESTIMATE_FLOW_CHIP_GREEN : 'rgba(148,163,184,0.22)',
    borderWidth: selected ? 1.5 : 1,
  });

  // PAGE 1 — Product positioning + AI-first hook
  const renderPage1 = () => (
    <View style={pageOuterHeroStyle}>
      <View
        style={[
          styles.content,
          styles.contentHero,
          webInnerClamp,
        ]}
      >
        {renderStepEyebrow(0, 'Welcome')}
        <View style={styles.heroLogoGlow}>
          <LinearGradient
            colors={BRAND_FRAME_GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIconRing}
          >
            <View style={styles.heroIconInner}>
              <Image
                source={require('../assets/images/bps-logo-updated.png')}
                style={styles.heroLogoImage}
                resizeMode="contain"
              />
            </View>
          </LinearGradient>
        </View>
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
          Turn job notes, photos, or plans into an estimate—then use it to run the job and protect your profit.
        </Text>
        <View style={[styles.bulletList, styles.bulletListHero]}>
          <View style={styles.bulletItem}>
            <MaterialIcons name="auto-awesome" size={iconMd} color={colors.accentCyan} />
            <Text style={[styles.bulletText, webBullet, { color: colors.text }]}>
              Create detailed estimates with AI
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="trending-up" size={iconMd} color={colors.accent} />
            <Text style={[styles.bulletText, webBullet, { color: colors.text }]}>
              Track costs and progress from the estimate
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <MaterialIcons name="shield" size={iconMd} color={colors.accent} />
            <Text style={[styles.bulletText, webBullet, { color: colors.text }]}>
              Protect your margin throughout the job
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const toggleRole = (roleId: RoleOption) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const toggleHelpOption = (optionId: HelpOption) => {
    setSelectedHelpOptions((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    );
  };

  const finalScreenCopy = () => {
    const estimateFocused =
      selectedHelpOptions.length === 0 ||
      selectedHelpOptions.includes('estimates') ||
      !selectedHelpOptions.some((id) => ['projects', 'costs', 'schedule', 'profit'].includes(id));

    if (estimateFocused) {
      return {
        title: "Let's build your first estimate",
        body: 'The fastest way to start: paste job notes, add photos, or upload plans with Build with AI.',
        preferAi: true,
      };
    }

    return {
      title: "Let's set up your first job",
      body: 'Start with an estimate — it becomes your live budget, schedule, and profit tracker as work progresses.',
      preferAi: false,
    };
  };

  // PAGE 2 — Role selection (multi-select)
  const renderPage2 = () => {
    const roles: { id: RoleOption; label: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }[] = [
      { id: 'gc', label: 'General contractor', icon: 'engineering' },
      { id: 'subcontractor', label: 'Trade contractor', icon: 'construction' },
      { id: 'developer', label: 'Developer', icon: 'apartment' },
      { id: 'owner-builder', label: 'Owner-builder', icon: 'home-work' },
      { id: 'other', label: 'Other', icon: 'more-horiz' },
    ];

    return (
      <View style={[pageOuterStyle, styles.pageWithSkipClearance]}>
        <View style={contentQuestionStyle}>
          {renderStepEyebrow(1, 'About you')}
          <Text style={[styles.title, styles.titleQuestion, webTitle, { color: colors.text }]}>
            What best describes you?
          </Text>
          <Text style={[styles.helperText, webHelper, { color: colors.subtext }]}>
            Select all that apply. We use this for contract defaults and guidance — update anytime in Profile.
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
                  toggleRole(role.id);
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={role.icon}
                  size={iconSm}
                  color={isSelected ? ESTIMATE_FLOW_CHIP_GREEN : colors.muted}
                  style={styles.optionIcon}
                />
                <Text
                  style={[
                    styles.optionText,
                    webOptionText,
                    {
                      color: colors.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {role.label}
                </Text>
                {isSelected ? (
                  <MaterialIcons name="check-circle" size={iconSm} color={ESTIMATE_FLOW_CHIP_GREEN} />
                ) : null}
              </TouchableOpacity>
            );
            })}
          </View>
        </View>
      </View>
    );
  };

  // PAGE 3 — Immediate goals (multi-select, optional)
  const renderGoalsPage = () => {
    const helpOptions: {
      id: HelpOption;
      label: string;
      icon: React.ComponentProps<typeof MaterialIcons>['name'];
    }[] = [
      { id: 'estimates', label: 'Create an accurate estimate', icon: 'description' },
      { id: 'projects', label: 'Turn estimates into live projects', icon: 'folder-shared' },
      { id: 'costs', label: 'Track project costs and labor', icon: 'payments' },
      { id: 'schedule', label: 'Manage schedule and progress', icon: 'event' },
      { id: 'profit', label: 'Protect profit on every job', icon: 'trending-up' },
    ];

    return (
      <View style={[pageOuterStyle, styles.pageWithSkipClearance]}>
        <View style={contentQuestionStyle}>
          {renderStepEyebrow(2, 'Your goals')}
          <Text style={[styles.title, styles.titleQuestion, webTitle, { color: colors.text }]}>
            What do you want to do first?
          </Text>
          <Text style={[styles.helperText, webHelper, { color: colors.subtext }]}>
            Choose one or more. Skip if you are not sure — you can change this anytime.
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
                <MaterialIcons
                  name={option.icon}
                  size={iconSm}
                  color={isSelected ? ESTIMATE_FLOW_CHIP_GREEN : colors.muted}
                  style={styles.optionIcon}
                />
                <Text
                  style={[
                    styles.optionText,
                    webOptionText,
                    {
                      color: colors.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected ? (
                  <MaterialIcons name="check-circle" size={iconSm} color={ESTIMATE_FLOW_CHIP_GREEN} />
                ) : null}
              </TouchableOpacity>
            );
            })}
          </View>
        </View>
      </View>
    );
  };

  const completeOnboarding = async (options?: { openBuildWithAi?: boolean }) => {
    try {
      const roles = selectedRoles;
      const copy = finalScreenCopy();
      const useBuildWithAi = options?.openBuildWithAi ?? copy.preferAi;
      const onboardingData = {
        role: selectedRoles[0] ?? null,
        roles,
        help: selectedHelpOptions[0] ?? null,
        helpOptions: selectedHelpOptions,
        completedAt: new Date().toISOString(),
        entryPath: useBuildWithAi ? 'build-with-ai' : 'manual-estimate',
      };
      await AsyncStorage.setItem(
        onboardingDataKeyForUser(userId),
        JSON.stringify(onboardingData)
      );
      if (roles.length > 0) {
        await mergeOnboardingRoleIntoContractorProfile(roles);
      }
      await markWalkthroughCompleted(userId, 'appOnboarding');
      await resyncProjectsFromServer();
      await AsyncStorage.setItem('bps.isFirstTimeEstimate', 'true');
      if (useBuildWithAi) {
        await setPendingOpenBuildWithAi();
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.replace('/(tabs)/estimate-generator');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      router.replace('/(tabs)/estimate-generator');
    }
  };

  // PAGE 4 — Activate
  const renderFinalPage = () => {
    const copy = finalScreenCopy();
    return (
    <View style={pageOuterFinalStyle}>
      <View style={contentFinalStyle}>
        {renderStepEyebrow(3, 'Get started')}
        <Text style={[styles.title, webTitle, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[styles.body, styles.bodyFinal, webBody, { color: colors.subtext }]}>
          {copy.body}
        </Text>
        <View style={styles.finalActionsContainer}>
          <TouchableOpacity
            style={[estimateFlowPrimaryButtonStyle(), webDesktop && styles.primaryButtonWeb]}
            onPress={() => completeOnboarding({ openBuildWithAi: true })}
            activeOpacity={0.88}
          >
            <MaterialIcons name="auto-awesome" size={iconMd} color="#071018" />
            <Text style={estimateFlowPrimaryButtonTextStyle()}>Build with AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineButtonCompact, webDesktop && styles.secondaryButtonWeb]}
            onPress={() => completeOnboarding({ openBuildWithAi: false })}
            activeOpacity={0.88}
          >
            <MaterialIcons name="description" size={iconMd} color={ESTIMATE_FLOW_CHIP_GREEN} />
            <Text style={styles.outlineButtonText}>Start manually instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    );
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

      <View
        style={[
          styles.navigation,
          {
            backgroundColor: '#000000',
            borderTopColor: 'rgba(255,255,255,0.05)',
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
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
                style={[styles.backButtonCompact, webDesktop && styles.backButtonWeb]}
                onPress={handleBack}
                activeOpacity={0.88}
              >
                <MaterialIcons name="arrow-back" size={iconMd} color={ESTIMATE_FLOW_CHIP_GREEN} />
                <Text style={styles.outlineButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            {currentPage < LAST_PAGE_INDEX && (
              <TouchableOpacity
                style={[
                  estimateFlowPrimaryButtonStyle(),
                  styles.nextButtonSolid,
                  webDesktop && styles.nextButtonInnerWeb,
                ]}
                onPress={handleNext}
                activeOpacity={0.88}
              >
                <Text style={estimateFlowPrimaryButtonTextStyle()}>Continue</Text>
                <MaterialIcons name="arrow-forward" size={iconMd} color="#071018" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {currentPage < LAST_PAGE_INDEX && (
        <TouchableOpacity
          style={[
            styles.skipButton,
            { top: skipTop },
            skipButtonRight != null && { right: skipButtonRight },
          ]}
          onPress={handleSkip}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.skipButtonText, { color: colors.text }]}>
            {currentPage === 0 ? 'Skip setup' : 'Skip for now'}
          </Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

function OnboardingFlowWithClerk({ onComplete }: OnboardingFlowProps) {
  const { user } = useUser();
  const userId = user?.id;
  const [checkingWorkspaceMember, setCheckingWorkspaceMember] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCheckingWorkspaceMember(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const result = await applyWorkspaceMemberFirstRunIfNeeded(userId, {
          firstName: user?.firstName,
          lastName: user?.lastName,
          email:
            user?.primaryEmailAddress?.emailAddress ||
            user?.emailAddresses?.[0]?.emailAddress ||
            null,
        });
        if (!cancelled && result.applied) {
          onComplete();
          return;
        }
      } finally {
        if (!cancelled) {
          setCheckingWorkspaceMember(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, user?.firstName, user?.lastName, user?.primaryEmailAddress, user?.emailAddresses, onComplete]);

  if (!userId) return null;
  if (checkingWorkspaceMember) return null;
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
    paddingBottom: 188,
  },
  pageWithSkipClearance: {
    paddingTop: 56,
    justifyContent: 'flex-start',
  },
  pageContainerHero: {
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
    justifyContent: 'flex-start',
    paddingTop: 4,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
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
    marginTop: 0,
  },
  contentQuestion: {
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  titleQuestion: {
    textAlign: 'left',
    marginBottom: 10,
    marginTop: 2,
  },
  stepEyebrow: {
    textAlign: 'left',
    marginBottom: 16,
  },
  stepEyebrowCenter: {
    textAlign: 'center',
    marginBottom: 20,
  },
  heroLogoGlow: {
    alignSelf: 'center',
    marginBottom: 28,
    shadowColor: '#22c55e',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  /** Logo ring — slightly smaller than landing so headline stays focal. */
  heroIconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLogoImage: {
    width: 152,
    height: 152,
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
    marginTop: 16,
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  optionIcon: {
    marginRight: 10,
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
    lineHeight: 21,
    marginTop: 0,
    marginBottom: 16,
    textAlign: 'left',
    fontWeight: '400',
  },
  outlineButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ESTIMATE_FLOW_CHIP_GREEN,
    backgroundColor: 'transparent',
    gap: 8,
    width: '100%',
  },
  outlineButtonText: {
    color: ESTIMATE_FLOW_CHIP_GREEN,
    fontSize: 15,
    fontWeight: '700',
  },
  backButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ESTIMATE_FLOW_CHIP_GREEN,
    backgroundColor: 'transparent',
    gap: 6,
    flexGrow: 0,
    flexShrink: 0,
  },
  finalActionsContainer: {
    marginTop: 28,
    gap: 12,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  primaryButtonWeb: {
    minHeight: 52,
  },
  secondaryButtonWeb: {
    minHeight: 48,
  },
  nextButtonSolid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    width: 'auto',
    flexGrow: 0,
    flexShrink: 0,
    flex: 0,
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
  backButtonWeb: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  nextButtonInnerWeb: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    minHeight: 48,
  },
  skipButton: {
    position: 'absolute',
    right: 20,
    paddingVertical: 6,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
