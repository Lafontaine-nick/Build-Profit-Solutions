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
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
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

export default function EstimateTutorialScreen() {
  const tabScrollBottomInset = useTabScrollBottomInset();
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
      title: 'Start a New Estimate',
      description:
        'Tap the "+ New" button to create a new estimate. Give it a descriptive title that helps you identify the project later.',
      icon: 'add-circle-outline',
    },
    {
      number: 2,
      title: 'Enter Customer Information',
      description:
        'Fill in your customer\'s name, email, phone, and address. This information will be included in the final proposal.',
      icon: 'person',
    },
    {
      number: 3,
      title: 'Set Project Details',
      description:
        'Select the project type (Kitchen, Bathroom, etc.), enter the square footage, location, and desired timeline.',
      icon: 'folder',
    },
    {
      number: 4,
      title: 'Add Materials & Supplies',
      description:
        'Search for materials using Material Search. Add line items with quantities and the system will calculate costs with live pricing.',
      icon: 'inventory',
    },
    {
      number: 5,
      title: 'Add Labor & Subcontractors',
      description:
        'Add labor line items or search for subcontractors in your area. The system uses regional wage data for accurate labor costs.',
      icon: 'people',
    },
    {
      number: 6,
      title: 'Direct costs, overhead & markup',
      description:
        'Enter equipment rental, plans, permits, and other direct costs; then overhead (insurance, equipment maintenance, facilities, other); then your markup percentage.',
      icon: 'trending-up',
    },
    {
      number: 7,
      title: 'Review Project Analysis',
      description:
        'Use the Project Analysis tool to see profitability metrics, margin breakdown, and what-if scenarios before finalizing.',
      icon: 'analytics',
    },
    {
      number: 8,
      title: 'Set Payment Schedule',
      description:
        'Define payment terms, milestones, and work schedule. This helps ensure timely payments throughout the project.',
      icon: 'payment',
    },
    {
      number: 9,
      title: 'Add Legal & Compliance',
      description:
        'Include licensing information, insurance details, and safety compliance requirements in your proposal.',
      icon: 'gavel',
    },
    {
      number: 10,
      title: 'Generate & Export Proposal',
      description:
        'Review your final bid, check the health score, and export as a professional PDF proposal to send to your customer.',
      icon: 'description',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {Platform.OS === 'web' ? (
            <HelpSupportSubpageWebHeader
              title='How to Create an'
              titleLine2='Estimate'
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
                <View style={styles.titleWrapper}>
                  <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
                    How to Create an
                  </Text>
                  <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
                    Estimate
                  </Text>
                </View>
              </View>
              <View style={styles.backButtonWrapper} />
            </View>
          )}

          {/* Content Card */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: Platform.OS === 'web' ? 0 : 16,
              paddingBottom: tabScrollBottomInset,
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
                    borderColor: Colors.line,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={styles.scrollContent}>
                  {/* Welcome Section */}
                  <View style={[styles.welcomeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={[styles.welcomeIcon, { backgroundColor: theme.iconBg }]}>
                      <MaterialIcons name='calculate' size={32} color={theme.accent} />
                    </View>
                    <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                      Create Professional Estimates
                    </Text>
                    <Text style={[styles.welcomeText, { color: theme.subtext }]}>
                      Follow these steps to create accurate, professional project estimates
                      with live material pricing and AI-powered insights.
                    </Text>
                  </View>

                  {/* Tutorial Steps */}
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: Colors.text }]}>
                      Step-by-Step Guide
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
                        • Use Material Search for accurate material pricing{'\n'}
                        • Save estimates frequently to avoid losing work{'\n'}
                        • Review the Project Analysis before finalizing{'\n'}
                        • Export as PDF for professional proposals
                      </Text>
                    </View>
                  </View>

                  {/* CTA Button */}
                  <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push('/(tabs)/estimate-generator');
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name='play-arrow' size={24} color='#FFFFFF' />
                    <Text style={styles.ctaButtonText}>Start Creating an Estimate</Text>
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
  },
  titleWrapper: {
    alignItems: 'center',
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
    fontSize: 20,
    fontWeight: 'bold',
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
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    lineHeight: 22,
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

