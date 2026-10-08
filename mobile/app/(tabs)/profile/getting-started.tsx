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
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import * as Haptics from 'expo-haptics';
import HelpSupportSubpageWebHeader from '@/components/profile/HelpSupportSubpageWebHeader';
import BackButton from '@/components/ui/BackButton';
import WebPageShell from '@/components/layout/WebPageShell';
import { PHONE_CARD_GUTTER } from '@/constants/ScreenLayout';
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
  darkMode: boolean;
}

const StepCard = ({ number, title, description, theme, onPress, isLast, darkMode }: StepCardProps) => (
  <TouchableOpacity
    style={[
      styles.stepRow,
      {
        borderBottomColor: darkMode ? 'rgba(255,255,255,0.1)' : theme.border,
        borderBottomWidth: isLast ? 0 : 1,
      },
    ]}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <View style={[styles.stepNumber, { backgroundColor: darkMode ? '#3A3A3C' : '#e2e8f0' }]}>
      <Text style={[styles.stepNumberText, { color: theme.accent }]}>{number}</Text>
    </View>
    <View style={styles.stepCopy}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.stepDescription, { color: theme.subtext }]}>{description}</Text>
    </View>
    {onPress ? <MaterialIcons name="chevron-right" size={22} color={theme.subtext} /> : null}
  </TouchableOpacity>
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
    card: darkMode ? '#1C1D20' : Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
  }), [Colors, darkMode]);

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

  const tipLines = [
    'Turn on Remember my pricing so approved rates come back on the next bid.',
    'Check quantities on Confirm Scope before you apply a price.',
    'Restore a subscription from Payment & Billing if you reinstall.',
  ];

  const pageBody = (
    <>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: darkMode ? 'rgba(255,255,255,0.08)' : theme.border }]}>
        {steps.map((step, index) => (
          <StepCard
            key={step.number}
            number={step.number}
            title={step.title}
            description={step.description}
            icon={step.icon}
            theme={theme}
            darkMode={darkMode}
            onPress={step.onPress}
            isLast={index === steps.length - 1}
          />
        ))}
      </View>
      <View style={[styles.tipsCard, { backgroundColor: theme.card, borderColor: darkMode ? 'rgba(255,255,255,0.08)' : theme.border }]}>
        <View style={[styles.stepNumber, { backgroundColor: darkMode ? '#3A3A3C' : '#e2e8f0' }]}>
          <MaterialIcons name="lightbulb-outline" size={20} color={theme.accent} />
        </View>
        <View style={styles.tipsContent}>
          <Text style={[styles.tipsTitle, { color: theme.text }]}>Pro Tips</Text>
          {tipLines.map((line) => (
            <Text key={line} style={[styles.tipsText, { color: theme.subtext }]}>
              {line}
            </Text>
          ))}
        </View>
      </View>
    </>
  );

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
            <View style={styles.headerRow}>
              <View style={styles.backButton}>
                <BackButton darkMode={darkMode} onPress={() => router.back()} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={[styles.screenTitle, { color: darkMode ? '#f9fafb' : '#000000' }]}>
                  Getting Started
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
                  Tap a step to open it
                </Text>
              </View>
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
            {Platform.OS === 'web' ? (
              <LinearGradient
                colors={['#2DFFC4', '#00A6FF']}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.chromeFrame}
              >
                <View style={[styles.contentCard, { backgroundColor: darkMode ? Colors.cardDark : Colors.bg }]}>
                  <View style={styles.scrollContent}>{pageBody}</View>
                </View>
              </LinearGradient>
            ) : (
              <View style={styles.scrollContent}>{pageBody}</View>
            )}
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
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
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
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
  },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepCopy: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  tipsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    gap: 12,
    alignItems: 'flex-start',
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  tipsText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
});

