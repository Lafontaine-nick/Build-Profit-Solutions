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
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import * as Haptics from 'expo-haptics';
import HelpSupportSubpageWebHeader from '@/components/profile/HelpSupportSubpageWebHeader';
import BackButton from '@/components/ui/BackButton';
import WebPageShell from '@/components/layout/WebPageShell';
import { PHONE_CARD_GUTTER } from '@/constants/ScreenLayout';
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
  darkMode: boolean;
}

const TutorialStep = ({
  number,
  title,
  description,
  theme,
  isLast,
  darkMode,
}: TutorialStepProps) => (
  <View
    style={[
      styles.stepRow,
      {
        borderBottomColor: darkMode ? 'rgba(255,255,255,0.1)' : theme.border,
        borderBottomWidth: isLast ? 0 : 1,
      },
    ]}
  >
    <View style={[styles.stepNumber, { backgroundColor: darkMode ? '#3A3A3C' : '#e2e8f0' }]}>
      <Text style={[styles.stepNumberText, { color: theme.accent }]}>{number}</Text>
    </View>
    <View style={styles.stepCopy}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.stepDescription, { color: theme.subtext }]}>{description}</Text>
    </View>
  </View>
);

export default function ProjectsTutorialScreen() {
  const tabScrollBottomInset = useTabScrollBottomInset();
  const router = useRouter();
  const webHelpHeaderMargins = useWebProfileHelpHeaderMargins();
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
      title: 'Send the bid',
      description: 'On the estimate summary, tap Send to Projects.',
    },
    {
      title: 'Mark it won',
      description: 'When the client accepts, mark the project as won.',
    },
    {
      title: 'Open the project',
      description: 'Tap it for Overview, Budget, Timeline, Calendar, and Team.',
    },
    {
      title: 'Track the job',
      description: 'Watch the budget, progress, and what is left to spend.',
    },
  ];

  const tipLines = [
    'A bid stays on Estimate until you send it to Projects.',
    'Mark won only after the client accepts.',
    'Budget is where the bid price and job costs meet.',
  ];

  const pageBody = (
    <>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: darkMode ? 'rgba(255,255,255,0.08)' : theme.border }]}>
        {steps.map((step, index) => (
          <TutorialStep
            key={step.title}
            number={index + 1}
            title={step.title}
            description={step.description}
            icon="folder"
            theme={theme}
            darkMode={darkMode}
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
      <TouchableOpacity
        style={[styles.ctaButton, { backgroundColor: theme.accent }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/(tabs)/projects');
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaButtonText}>Open Projects</Text>
      </TouchableOpacity>
    </>
  );

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
            <View style={styles.headerRow}>
              <View style={styles.backButton}>
                <BackButton darkMode={darkMode} onPress={() => router.back()} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={[styles.screenTitle, { color: darkMode ? '#f9fafb' : '#000000' }]}>
                  Project Management
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
                  From a sent bid to a live job
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
    marginHorizontal: PROFILE_HELP_CHROME_H_MARGIN,
    marginBottom: 16,
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
    alignItems: 'flex-start',
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
  ctaButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ctaButtonText: {
    color: '#04120C',
    fontSize: 16,
    fontWeight: '700',
  },
});

