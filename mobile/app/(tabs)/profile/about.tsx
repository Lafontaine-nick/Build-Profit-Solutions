import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import BackButton from '@/components/ui/BackButton';
import HelpSupportSubpageWebHeader from '@/components/profile/HelpSupportSubpageWebHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import WebPageShell from '@/components/layout/WebPageShell';
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import { PHONE_CARD_GUTTER } from '@/constants/ScreenLayout';
import {
  PROFILE_HELP_CHROME_H_MARGIN,
  useWebProfileHelpHeaderMargins,
} from '@/lib/useWebProfileHelpHeaderMargins';

type Feature = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    icon: 'calculate',
    title: 'AI-Powered Estimating',
    body: 'Generate fast, accurate estimates using real-time material pricing, labor calculations, overhead, and markup automatically suggested by AI.',
  },
  {
    icon: 'smart-toy',
    title: 'AI Assistant',
    body: 'Ask questions, request calculations, troubleshoot issues, and get professional-grade guidance instantly—all directly inside the app.',
  },
  {
    icon: 'filter-alt',
    title: 'Lead Management & Sales Pipeline',
    body: 'Track inquiries, communication, and conversions with AI-powered insights that highlight your strongest opportunities.',
  },
  {
    icon: 'folder',
    title: 'Project Tracking & Documentation',
    body: 'Keep tasks, schedules, files, and project status organized with AI-supported reminders and suggested next steps.',
  },
  {
    icon: 'insights',
    title: 'Job Costing & Financial Insights',
    body: 'Instantly see profitability trends and budget health. AI flags unexpected costs, waste, or margin risks in real time.',
  },
  {
    icon: 'groups',
    title: 'Find Subcontractors',
    body: 'Discover verified subs in the BPS directory, compare options, and build competitive bids with AI-assisted labor cost suggestions.',
  },
  {
    icon: 'hub',
    title: 'All-In-One Workflow',
    body: 'Manage every part of your construction business—from the first lead to the final payout—inside a single intelligent platform.',
  },
];

const ABOUT_PARAGRAPHS = [
  'Build Profit Solutions is an AI-driven construction management platform built for contractors, subcontractors, builders, and real-estate investors. Our mission is to give you smarter tools, faster workflows, and clearer insights, helping you bid confidently and run your business with precision.',
  "Powered by advanced AI, BPS automates time-consuming tasks, reduces human error, and helps you make better decisions—whether you're estimating a project, analyzing job costs, or managing leads.",
  'From the field to the office, our platform empowers construction professionals to operate with the speed, accuracy, and efficiency of a full back-office team.',
];

export default function AboutScreen() {
  const tabScrollBottomInset = useTabScrollBottomInset();
  const router = useRouter();
  const webHelpHeaderMargins = useWebProfileHelpHeaderMargins();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);

  const version = Constants.expoConfig?.version || '1.0.0';
  const dividerColor = darkMode ? 'rgba(255,255,255,0.1)' : Colors.line;
  const iconTileBg = darkMode ? '#3A3A3C' : '#e2e8f0';
  const sectionCardStyle = [
    styles.sectionCard,
    {
      backgroundColor: darkMode ? '#1C1D20' : Colors.surface2,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
    },
  ];

  const sectionHeader = (icon: keyof typeof MaterialIcons.glyphMap, title: string) => (
    <View style={[styles.sectionHeader, { borderBottomColor: dividerColor }]}>
      <MaterialIcons name={icon} size={22} color={Colors.primary} />
      <Text style={[styles.sectionTitle, { color: Colors.text }]}>{title}</Text>
    </View>
  );

  const aboutSections = (
    <>
      <View style={sectionCardStyle}>
        <View style={styles.heroRow}>
          <View
            style={[
              styles.logoTile,
              {
                backgroundColor: darkMode ? '#000000' : Colors.bg,
                borderColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line,
              },
            ]}
          >
            <Image
              source={
                darkMode
                  ? require('../../../assets/images/bps-logo-house-dark.png')
                  : require('../../../assets/images/bps-logo-house-light.png')
              }
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.appTitle, { color: Colors.text }]}>Build Profit Solutions</Text>
            <Text style={[styles.tagline, { color: Colors.sub }]}>
              All-in-One AI-Powered Construction Management Platform
            </Text>
            <Text style={[styles.version, { color: Colors.sub }]}>Version {version}</Text>
          </View>
        </View>
      </View>

      <View style={sectionCardStyle}>
        {sectionHeader('info-outline', 'About')}
        <View style={styles.sectionBody}>
          {ABOUT_PARAGRAPHS.map((paragraph, index) => (
            <Text
              key={index}
              style={[
                styles.bodyText,
                { color: Colors.sub },
                index === ABOUT_PARAGRAPHS.length - 1 && styles.lastParagraph,
              ]}
            >
              {paragraph}
            </Text>
          ))}
        </View>
      </View>

      <View style={sectionCardStyle}>
        {sectionHeader('auto-awesome', 'What You Can Do with BPS')}
        {FEATURES.map((feature, index) => (
          <View
            key={feature.title}
            style={[
              styles.featureRow,
              {
                borderBottomColor: dividerColor,
                borderBottomWidth: index === FEATURES.length - 1 ? 0 : 1,
              },
            ]}
          >
            <View style={[styles.iconContainer, { backgroundColor: iconTileBg }]}>
              <MaterialIcons name={feature.icon} size={20} color={Colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: Colors.text }]}>{feature.title}</Text>
              <Text style={[styles.featureBody, { color: Colors.sub }]}>{feature.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={sectionCardStyle}>
        {sectionHeader('flag', 'Our Mission')}
        <View style={styles.sectionBody}>
          <Text style={[styles.bodyText, styles.lastParagraph, { color: Colors.sub }]}>
            To combine construction expertise with cutting-edge AI, delivering professional-grade
            tools that help contractors win more work, grow profitably, and operate with complete
            confidence.
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[Colors.bg, Colors.bg, Colors.bg]} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {Platform.OS === 'web' ? (
            <HelpSupportSubpageWebHeader
              title="About"
              darkMode={darkMode}
              lightBg={Colors.bg}
              webHelpHeaderMargins={webHelpHeaderMargins}
            />
          ) : (
            <View style={styles.headerRow}>
              <View style={styles.backButton}>
                <BackButton darkMode={darkMode} onPress={() => router.back()} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={[styles.screenTitle, { color: darkMode ? '#f9fafb' : '#000000' }]}>
                  About
                </Text>
                <Text style={[styles.headerSubtitle, { color: Colors.sub }]}>
                  Our platform and mission
                </Text>
              </View>
            </View>
          )}

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
              {Platform.OS === 'web' ? (
                <LinearGradient
                  colors={['#2DFFC4', '#00A6FF']}
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
                    <View style={styles.content}>{aboutSections}</View>
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.content}>{aboutSections}</View>
              )}
            </WebPageShell>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
  },
  content: {
    paddingHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
    paddingBottom: 8,
  },
  chromeFrame: {
    borderRadius: 24,
    padding: 1,
    marginHorizontal: PROFILE_HELP_CHROME_H_MARGIN,
    marginBottom: 16,
  },
  headerRow: {
    position: 'relative',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
    marginHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
  },
  headerCopy: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 52,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  sectionBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  logoTile: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 14,
  },
  logoImage: {
    width: 46,
    height: 46,
    transform: [{ translateY: -2.6 }],
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  tagline: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  version: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.65,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  lastParagraph: {
    marginBottom: 0,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
    minWidth: 0,
  },
  featureTitle: {
    fontSize: 16,
    marginBottom: 3,
  },
  featureBody: {
    fontSize: 13,
    lineHeight: 19,
  },
});
