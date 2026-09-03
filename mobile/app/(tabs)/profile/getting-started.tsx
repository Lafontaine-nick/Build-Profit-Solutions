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
import { useWebProfileHelpHeaderMargins } from '@/lib/useWebProfileHelpHeaderMargins';
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import { isLeadsNetworkingReleased } from '@/constants/releaseFlags';

interface StepCardProps {
  number: number;
  title: string;
  description: string;
  icon: string;
  theme: any;
  onPress?: () => void;
  isLast?: boolean;
}

const StepCard = ({ number, title, description, icon, theme, onPress, isLast }: StepCardProps) => (
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
      <TouchableOpacity
        style={[
          styles.stepCard,
          { borderColor: theme.border, backgroundColor: theme.card },
          onPress && styles.stepCardClickable,
        ]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <MaterialIcons name={icon as any} size={24} color={theme.accent} />
            <Text style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
            {onPress && (
              <MaterialIcons name='chevron-right' size={20} color={theme.subtext} />
            )}
          </View>
          <Text style={[styles.stepDescription, { color: theme.subtext }]}>
            {description}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  </View>
);


export default function GettingStartedScreen() {
  const tabScrollBottomInset = useTabScrollBottomInset();
  const router = useRouter();
  /** Web chrome uses no horizontal inset — frame is flush with shell padding. */
  const webHelpHeaderMargins = useWebProfileHelpHeaderMargins(0);
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
      title: 'Complete Your Profile',
      description:
        'Add your company information, licenses, and insurance details to get started.',
      icon: 'person',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/profile');
      },
    },
    {
      number: 2,
      title: 'Explore the Dashboard',
      description:
        'View your project overview, revenue metrics, and active projects at a glance.',
      icon: 'dashboard',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/dashboard');
      },
    },
    ...(isLeadsNetworkingReleased()
      ? [
          {
            number: 3,
            title: 'Add Your First Lead',
            description:
              'Start managing leads by adding new opportunities from the Leads tab.',
            icon: 'person-add',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(tabs)/leads');
            },
          },
        ]
      : []),
    {
      number: isLeadsNetworkingReleased() ? 4 : 3,
      title: 'Create an Estimate',
      description:
        'Use the Estimate Generator to create professional project estimates with AI assistance.',
      icon: 'calculate',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/estimate-generator');
      },
    },
    {
      number: isLeadsNetworkingReleased() ? 5 : 4,
      title: 'Manage Projects',
      description:
        'Track project progress, manage budgets, and collaborate with your team.',
      icon: 'folder',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/projects');
      },
    },
  ];


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.pageShell}>
          {Platform.OS === 'web' ? (
            <HelpSupportSubpageWebHeader
              title='Getting Started'
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
                <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
                  Getting Started
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
                      <MaterialIcons name='rocket-launch' size={32} color={theme.accent} />
                    </View>
                    <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                      Welcome to Build Profit Solutions!
                    </Text>
                    <Text style={[styles.welcomeText, { color: theme.subtext }]}>
                      We're here to help you manage your construction business more
                      efficiently. Follow these steps to get started.
                    </Text>
                  </View>

                  {/* Steps Section */}
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Quick Start Guide
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: theme.subtext }]}>
                      Tap on any step to get started
                    </Text>
                    {steps.map((step, index) => (
                      <StepCard
                        key={step.number}
                        number={step.number}
                        title={step.title}
                        description={step.description}
                        icon={step.icon}
                        theme={theme}
                        onPress={step.onPress}
                        isLast={index === steps.length - 1}
                      />
                    ))}
                  </View>

                  {/* Tips Section */}
                  <View style={[styles.tipsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <MaterialIcons name='lightbulb-outline' size={24} color={theme.accent} />
                    <View style={styles.tipsContent}>
                      <Text style={[styles.tipsTitle, { color: theme.text }]}>
                        Pro Tips
                      </Text>
                      <Text style={[styles.tipsText, { color: theme.subtext }]}>
                        • Complete your profile to unlock all features{'\n'}
                        • Use the Dashboard to track your business metrics{'\n'}
                        • Create estimates to win more projects{'\n'}
                        • Manage leads to grow your pipeline
                      </Text>
                    </View>
                  </View>

                </View>
              </View>
            </LinearGradient>
            </WebPageShell>
          </ScrollView>
          </View>
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
  pageShell: {
    flex: 1,
    width: '100%',
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
    marginBottom: 16,
    ...Platform.select({
      web: { marginHorizontal: 0 },
      default: { marginHorizontal: 8 },
    }),
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
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
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
  stepCardClickable: {
    // Additional styling for clickable cards if needed
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
});

