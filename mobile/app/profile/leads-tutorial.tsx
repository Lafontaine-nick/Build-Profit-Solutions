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
import WebPageShell from '@/components/layout/WebPageShell';

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

export default function LeadsTutorialScreen() {
  const router = useRouter();
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
      title: 'View Your Leads',
      description:
        'See all your leads organized by stage: New, Contacted, Qualified, Proposal, Won, and Lost. Leads are automatically scored by AI to help you prioritize.',
      icon: 'people',
    },
    {
      number: 2,
      title: 'Understand AI Scoring',
      description:
        'Each lead has a Perfect Fit score (0-100) based on project type, budget, location, and timeline. Higher scores indicate better matches for your business.',
      icon: 'star',
    },
    {
      number: 3,
      title: 'Update Lead Stages',
      description:
        'Tap on leads to update their status and move them through stages. Track your sales pipeline from initial contact to closed deals.',
      icon: 'arrow-forward',
    },
    {
      number: 4,
      title: 'View Lead Details',
      description:
        'Tap any lead to see full information including contact details, project requirements, budget range, timeline, and location.',
      icon: 'info',
    },
    {
      number: 5,
      title: 'Set Your Preferences',
      description:
        'Configure your trade types, service area, budget range, and timeline preferences. The system will prioritize leads that match your criteria.',
      icon: 'tune',
    },
    {
      number: 6,
      title: 'View Lead Analytics',
      description:
        'See your overall lead analytics including total leads, active leads, win rate, closed revenue, and top project types. Track your sales performance at a glance.',
      icon: 'analytics',
    },
    {
      number: 7,
      title: 'Filter and Search',
      description:
        'Use filters to view leads by stage, trade type, or score. Search by project title, location, or contact name to find specific leads quickly.',
      icon: 'search',
    },
    {
      number: 8,
      title: 'Convert to Projects',
      description:
        'When you win a lead, convert it to a project to start tracking progress, budget, and timeline in the Projects section.',
      icon: 'check-circle',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerRow}>
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
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                Lead Management
              </Text>
            </View>
            <View style={styles.backButtonWrapper} />
          </View>

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
              style={{ borderRadius: 24, padding: 1, marginHorizontal: 8, marginBottom: 16 }}
            >
              <View style={[styles.contentCard, { backgroundColor: theme.background[0] }]}>
                <View style={styles.scrollContent}>
                  {/* Welcome Section */}
                  <View style={[styles.welcomeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={[styles.welcomeIcon, { backgroundColor: theme.iconBg }]}>
                      <MaterialIcons name='person-add' size={32} color={theme.accent} />
                    </View>
                    <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                      Manage Your Sales Pipeline
                    </Text>
                    <Text style={[styles.welcomeText, { color: theme.subtext }]}>
                      Track and manage leads from initial contact to closed deals. Use AI-powered
                      scoring to prioritize the best opportunities for your business.
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
                        • Focus on leads with high AI scores first{'\n'}
                        • Check your analytics regularly to track win rate and revenue{'\n'}
                        • Set preferences to get better-matched leads{'\n'}
                        • Monitor top project types to focus your marketing efforts{'\n'}
                        • Convert won leads to projects immediately
                      </Text>
                    </View>
                  </View>

                  {/* CTA Button */}
                  <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push('/(tabs)/leads');
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name='play-arrow' size={24} color='#FFFFFF' />
                    <Text style={styles.ctaButtonText}>Go to Leads</Text>
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
    marginHorizontal: 20,
    position: 'relative',
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

