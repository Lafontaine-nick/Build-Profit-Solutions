import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import WebPageShell from '@/components/layout/WebPageShell';
import { useWebProfileHelpHeaderMargins } from '@/lib/useWebProfileHelpHeaderMargins';

export default function AboutScreen() {
  const router = useRouter();
  /** Align header with profile chrome; `0` matches `chromeFrame` `marginHorizontal: 0` on web. */
  const webHelpHeaderMargins = useWebProfileHelpHeaderMargins(0);
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);

  const theme = useMemo(
    () => ({
      background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
      card: Colors.surface2,
      text: Colors.text,
      subtext: Colors.sub,
      accent: Colors.primary,
      border: Colors.line,
    }),
    [Colors]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.pageShell}>
            {/* Header */}
            <View
              style={[
                styles.headerRow,
                Platform.OS === 'web' ? webHelpHeaderMargins : styles.headerRowNativeMargins,
              ]}
            >
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
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.back();
                    }}
                    style={[styles.backButton, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
                  >
                    <MaterialIcons
                      name='arrow-back'
                      size={24}
                      color={darkMode ? '#FFFFFF' : '#000000'}
                    />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={styles.titleContainer}>
                <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
                  About
                </Text>
              </View>
              <View style={styles.backButtonWrapper} />
            </View>

            {/* Same chrome as Profile / Getting Started: shell → gradient 1px → card + hairline */}
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
                      {/* Header Section */}
                      <View style={styles.headerSection}>
                        <Text style={[styles.appTitle, { color: theme.text }]}>
                          Build Profit Solutions
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.subtext }]}>
                          All-in-One AI-Powered Construction Management Platform
                        </Text>
                        <Text style={[styles.version, { color: theme.subtext }]}>
                          Version {Constants.expoConfig?.version || '1.0.0'}
                        </Text>
                      </View>

                      {/* Section: About */}
                      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
                        <Text style={[styles.bodyText, { color: theme.subtext }]}>
                          Build Profit Solutions is an AI-driven construction management
                          platform built for contractors, subcontractors, builders, and
                          real-estate investors. Our mission is to give you smarter tools,
                          faster workflows, and clearer insights, helping you bid
                          confidently and run your business with precision.
                        </Text>
                        <Text style={[styles.bodyText, { color: theme.subtext }]}>
                          Powered by advanced AI, BPS automates time-consuming tasks,
                          reduces human error, and helps you make better decisions—whether
                          you're estimating a project, analyzing job costs, or managing
                          leads.
                        </Text>
                        <Text style={[styles.bodyText, { color: theme.subtext }]}>
                          From the field to the office, our platform empowers construction
                          professionals to operate with the speed, accuracy, and efficiency
                          of a full back-office team.
                        </Text>
                      </View>

                      {/* Section: What You Can Do */}
                      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>What You Can Do with BPS</Text>

                        <View style={styles.featureItem}>
                          <Text style={[styles.bulletTitle, { color: theme.text }]}>AI-Powered Estimating</Text>
                          <Text style={[styles.bulletText, { color: theme.subtext }]}>
                            Generate fast, accurate estimates using real-time material
                            pricing, labor calculations, overhead, and markup automatically
                            suggested by AI.
                          </Text>
                        </View>

                        <View style={styles.featureItem}>
                          <Text style={[styles.bulletTitle, { color: theme.text }]}>AI Assistant</Text>
                          <Text style={[styles.bulletText, { color: theme.subtext }]}>
                            Ask questions, request calculations, troubleshoot issues, and
                            get professional-grade guidance instantly—all directly inside the
                            app.
                          </Text>
                        </View>

                        <View style={styles.featureItem}>
                          <Text style={[styles.bulletTitle, { color: theme.text }]}>
                            Lead Management & Sales Pipeline
                          </Text>
                          <Text style={[styles.bulletText, { color: theme.subtext }]}>
                            Track inquiries, communication, and conversions with AI-powered
                            insights that highlight your strongest opportunities.
                          </Text>
                        </View>

                        <View style={styles.featureItem}>
                          <Text style={[styles.bulletTitle, { color: theme.text }]}>
                            Project Tracking & Documentation
                          </Text>
                          <Text style={[styles.bulletText, { color: theme.subtext }]}>
                            Keep tasks, schedules, files, and project status organized with
                            AI-supported reminders and suggested next steps.
                          </Text>
                        </View>

                        <View style={styles.featureItem}>
                          <Text style={[styles.bulletTitle, { color: theme.text }]}>
                            Job Costing & Financial Insights
                          </Text>
                          <Text style={[styles.bulletText, { color: theme.subtext }]}>
                            Instantly see profitability trends and budget health. AI flags
                            unexpected costs, waste, or margin risks in real time.
                          </Text>
                        </View>

                        <View style={styles.featureItem}>
                          <Text style={[styles.bulletTitle, { color: theme.text }]}>Subcontractor Marketplace</Text>
                          <Text style={[styles.bulletText, { color: theme.subtext }]}>
                            Compare pricing, discover subcontractors, and build competitive
                            bids with AI-assisted labor cost suggestions.
                          </Text>
                        </View>

                        <View style={styles.featureItem}>
                          <Text style={[styles.bulletTitle, { color: theme.text }]}>All-In-One Workflow</Text>
                          <Text style={[styles.bulletText, { color: theme.subtext }]}>
                            Manage every part of your construction business—from the first
                            lead to the final payout—inside a single intelligent platform.
                          </Text>
                        </View>
                      </View>

                      {/* Section: Mission */}
                      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Our Mission</Text>
                        <Text style={[styles.bodyText, { color: theme.subtext }]}>
                          To combine construction expertise with cutting-edge AI, delivering
                          professional-grade tools that help contractors win more work, grow
                          profitably, and operate with complete confidence.
                        </Text>
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
    marginTop: 20,
    marginBottom: 12,
    position: 'relative',
  },
  headerRowNativeMargins: {
    marginHorizontal: 20,
  },
  backButtonWrapper: {
    width: 42,
    zIndex: 1,
    alignItems: 'center',
  },
  backButtonBorder: {
    width: 42,
    height: 42,
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
  /** Same chrome frame as Profile / Getting Started (`#2DFFC4` → `#00A6FF`, 1px stroke via padding). */
  chromeFrame: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 16,
    ...Platform.select({
      web: { marginHorizontal: 0 },
      default: { marginHorizontal: 8 },
    }),
  },
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
    opacity: 0.85,
  },
  version: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.85,
  },
  section: {
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
    opacity: 0.85,
  },
  featureItem: {
    marginBottom: 16,
  },
  bulletTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.85,
  },
});

