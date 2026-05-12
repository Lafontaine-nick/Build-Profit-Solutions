import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import * as Haptics from 'expo-haptics';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import HelpSupportSubpageWebHeader from '@/components/profile/HelpSupportSubpageWebHeader';
import WebPageShell from '@/components/layout/WebPageShell';
import {
  PROFILE_HELP_CHROME_H_MARGIN,
  useWebProfileHelpHeaderMargins,
} from '@/lib/useWebProfileHelpHeaderMargins';

interface TutorialStepProps {
  number: number;
  title: string;
  description: string;
  icon: string;
  theme: any;
  isLast?: boolean;
}

const TutorialStep = ({
  number,
  title,
  description,
  icon,
  theme,
  isLast,
}: TutorialStepProps) => (
  <View style={styles.stepContainer}>
    <View style={styles.stepRow}>
      <View style={styles.stepLeft}>
        <View style={[styles.stepNumber, { backgroundColor: theme.iconBg }]}>
          <Text style={[styles.stepNumberText, { color: theme.accent }]}>
            {number}
          </Text>
        </View>
        {!isLast && (
          <View style={[styles.stepConnector, { backgroundColor: theme.border }]} />
        )}
      </View>
      <View style={[styles.stepCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <MaterialIcons name={icon as any} size={24} color={theme.accent} />
            <Text style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
          </View>
          <Text style={[styles.stepDescription, { color: theme.subtext }]}>
            {description}
          </Text>
        </View>
      </View>
    </View>
  </View>
);

export default function ProjectsTutorialScreen() {
  const router = useRouter();
  const webHelpHeaderMargins = useWebProfileHelpHeaderMargins();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);

  const theme = useMemo(() => ({
    background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
    card: Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
  }), [Colors]);

  const steps = [
    {
      number: 1,
      title: 'View All Projects',
      description:
        'See all your projects in one place. Projects are organized by status: In Progress, Active, and Completed.',
      icon: 'folder',
    },
    {
      number: 2,
      title: 'Convert Estimates to Projects',
      description:
        'Projects are created by converting estimates from the Estimate Generator. After winning a bid, convert your estimate to a project to start tracking progress.',
      icon: 'swap-horiz',
    },
    {
      number: 3,
      title: 'Track Project Progress',
      description:
        'Monitor project completion with visual progress bars. Track budgets, labor costs, how much you\'ve spent, and how much budget is available. Progress is calculated based on timeline and completion milestones.',
      icon: 'trending-up',
    },
    {
      number: 4,
      title: 'Filter and Search',
      description:
        'Use the search bar to find projects by name or location. Filter by status to see only active, completed, or draft projects.',
      icon: 'search',
    },
    {
      number: 5,
      title: 'View Project Details',
      description:
        'Tap any project card to see detailed information including timeline, budget, margin, client information, and project notes.',
      icon: 'info',
    },
    {
      number: 6,
      title: 'Monitor Profitability',
      description:
        'Track project margins and profitability in real-time. See which projects are performing well and which need attention.',
      icon: 'show-chart',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {Platform.OS === 'web' ? (
            <HelpSupportSubpageWebHeader
              title='Project Management'
              darkMode={darkMode}
              lightBg={Colors.bg}
              webHelpHeaderMargins={webHelpHeaderMargins}
            />
          ) : (
            <View style={[styles.headerRow, webHelpHeaderMargins]}>
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
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      router.back();
                    }}
                    style={[styles.backButton, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}
                  >
                    <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={styles.titleContainer}>
                <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
                  Project Management
                </Text>
              </View>
              <View style={styles.backButtonWrapper} />
            </View>
          )}

          {/* Content Card */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: Platform.OS === 'web' ? 0 : 16,
              paddingBottom: 40,
              paddingHorizontal: 0,
            }}
            showsVerticalScrollIndicator={true}
          >
            <WebPageShell size="profile" scroll={false} contentStyle={{ paddingBottom: 0 }}>
            <LinearGradient
              colors={["#2DFFC4", "#00A6FF"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.chromeFrame}
            >
              <View
                style={[
                  styles.contentCard,
                  {
                    backgroundColor: darkMode ? Colors.cardDark : Colors.bg,
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={styles.scrollContent}>
                  {/* Welcome Section */}
                  <View style={[styles.welcomeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={[styles.welcomeIcon, { backgroundColor: theme.iconBg }]}>
                      <MaterialIcons name='folder' size={32} color={theme.accent} />
                    </View>
                    <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                      Manage Your Projects
                    </Text>
                    <Text style={[styles.welcomeText, { color: theme.subtext }]}>
                      Keep track of all your projects from start to finish. Monitor progress,
                      profitability, and timelines in one centralized location.
                    </Text>
                  </View>

                  {/* Tutorial Steps */}
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Getting Started
                    </Text>
                    {steps.map((step, index) => (
                      <TutorialStep
                        key={step.number}
                        number={step.number}
                        title={step.title}
                        description={step.description}
                        icon={step.icon}
                        theme={theme}
                        isLast={index === steps.length - 1}
                      />
                    ))}
                  </View>

                  {/* Quick Tips */}
                  <View style={[styles.tipsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <MaterialIcons name='lightbulb-outline' size={24} color={theme.accent} />
                    <View style={styles.tipsContent}>
                      <Text style={[styles.tipsTitle, { color: theme.text }]}>
                        Pro Tips
                      </Text>
                      <Text style={[styles.tipsText, { color: theme.subtext }]}>
                        • Convert estimates to projects after winning bids{'\n'}
                        • Update project status regularly for accurate tracking{'\n'}
                        • Use filters to focus on active projects{'\n'}
                        • Monitor margins to ensure profitability
                      </Text>
                    </View>
                  </View>

                  {/* CTA Button */}
                  <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push('/(tabs)/projects');
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name='play-arrow' size={24} color='#FFFFFF' />
                    <Text style={styles.ctaButtonText}>Go to Projects</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
            </WebPageShell>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 12,
    ...(Platform.OS === 'web' ? {} : { marginHorizontal: 20 }),
    position: 'relative',
  },
  chromeFrame: {
    borderRadius: 24,
    padding: 1,
    marginHorizontal: PROFILE_HELP_CHROME_H_MARGIN,
    marginBottom: 16,
  },
  backButtonWrapper: {
    width: 42,
    zIndex: 1,
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeCard: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  stepContainer: {
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepLeft: {
    alignItems: 'center',
    marginRight: 12,
    width: 40,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: 40,
    marginTop: 4,
  },
  stepCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  tipsCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    gap: 16,
    alignItems: 'flex-start',
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 13,
    lineHeight: 22,
    opacity: 0.65,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
    backgroundColor: '#43cea2',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

